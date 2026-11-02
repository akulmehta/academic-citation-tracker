// Build the citation ledger: one row per publication, plus global totals.
//
//   node tools/build-ledger.js            write dated JSON + CSV, print summary
//   node tools/build-ledger.js --json     print the ledger as JSON only
//
// Why this exists separately from summarize-progress.js: the filing packet
// needs numbers that can be handed over and re-checked, per article and in
// total. This writes them to disk as a dated record tied to one Google Scholar
// snapshot, so a figure quoted later can be traced to the run that produced it.
//
// Reading rules, so the columns mean what they claim:
//   - A publication is counted only when its exhibit PDF is currently in
//     Exhibits/PDFs (Archive and SUPERSEDED- files do not count).
//   - Publications in the snapshot list with no exhibit are still listed, with
//     status "not-started", so the denominator for progress is visible.
//   - "independent" is the countable total: classified independent, corroborated
//     or covered by a complete Scholar list, and not flagged non-English.
//   - Every count is tied to the snapshot date recorded in the reports.

const fs = require("fs");
const path = require("path");
const tally = require("./tally");

const ROOT = path.resolve(__dirname, "..");
const EXHIBITS = path.join(ROOT, "Independent Citation Record", "Exhibits");
const PDF_DIR = path.join(EXHIBITS, "PDFs");
const SUPPORT_DIR = path.join(EXHIBITS, "Supporting");

const asJson = process.argv.includes("--json");

function readList() {
  // The dated publication list is the authoritative snapshot: it carries the
  // citation count for every publication, including those not yet captured.
  const candidates = fs
    .readdirSync(SUPPORT_DIR)
    .filter((f) => /^publications-list-\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .sort();
  if (!candidates.length) {
    throw new Error(
      `No publications-list-<date>.json in Exhibits/Supporting. ` +
        `Run tools/list-all-publications.js first.`
    );
  }
  const file = candidates[candidates.length - 1];
  const data = JSON.parse(fs.readFileSync(path.join(SUPPORT_DIR, file), "utf8"));
  return { file, data };
}

function pdfsFor(base) {
  const out = [];
  const walk = (dir, prefix) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        walk(path.join(dir, entry.name), `${prefix}${entry.name}/`);
        continue;
      }
      if (!entry.name.endsWith(".pdf")) continue;
      if (dir.includes(`${path.sep}Archive`)) continue;
      const stem = entry.name.replace(/\.pdf$/, "").replace(/-p\d+$/, "");
      if (stem === base) out.push(`${prefix}${entry.name}`);
    }
  };
  walk(PDF_DIR, "");
  return out.sort();
}

function build() {
  const { file: listFile, data: listData } = readList();
  const groups = tally.groupReports(SUPPORT_DIR, PDF_DIR);

  // Two exhibit sets for one citing list mean a publication was captured again
  // while the earlier PDFs were still filed. Only one set can be counted, so
  // without this warning the totals would depend on folder order and nobody
  // would know a superseded capture was sitting in the filing folder.
  const byId = new Map();
  for (const g of groups.values()) {
    if (!g.cites_id) continue;
    if (!byId.has(g.cites_id)) byId.set(g.cites_id, []);
    byId.get(g.cites_id).push(g.base);
  }
  const duplicates = [...byId.entries()].filter(([, bases]) => bases.length > 1);

  const rows = [];

  for (const pub of listData.publications || []) {
    const id = tally.citesId(pub.citesUrl);
    const citedBy = Number(pub.citedBy) || 0;
    // Match on the cites id only when there is one: an empty id would match
    // every other publication whose citing list could not be resolved.
    const group = id ? [...groups.values()].find((g) => g.cites_id === id) : undefined;
    const captured = Boolean(group);

    const t = captured ? tally.tallyEntries(group.entries) : tally.emptyTally();
    // A publication showing no count on the profile needs no exhibit, so it
    // must not add a page to the expected total.
    const expected = citedBy ? tally.expectedPages(citedBy) : 0;
    const pages = captured ? group.pages.length : 0;

    rows.push({
      cites_id: id,
      title: pub.title,
      venue: pub.venue || "",
      year: pub.year || "",
      snapshot_date: listData.snapshot_date,
      cited_by_at_snapshot: citedBy,
      status: captured ? "captured" : citedBy ? "not-started" : "no-citations-shown",
      pages_expected: expected,
      pages_captured: pages,
      pages_complete: captured && pages >= expected,
      records_captured: t.records,
      independent: t.independent,
      independent_confirmed: t.independent_confirmed,
      independent_coverage: t.independent_coverage,
      independent_pending: t.independent_pending,
      dependent: t.dependent,
      self_pi: t.self_pi,
      self_former_pi: t.self_former_pi,
      review: t.review,
      non_english: t.non_english,
      non_english_withheld: t.non_english_withheld,
      english_records: t.english_records,
      english_independent: t.english_independent,
      unique_english_records: t.unique_english_records,
      unique_english_independent: t.unique_english_independent,
      // Scholar lists some papers twice (publisher copy plus a repository or
      // thesis copy), so rows exceed distinct papers. The exhibit shows every
      // row; these are the counts of distinct papers. The dependent and self
      // counts must be carried here too: the global uniqueDecided sums them,
      // and without them unique_independent_share_of_decided_pct reads a false
      // 100 because unique_decided_records collapses to unique_independent.
      unique_records: t.unique_records,
      unique_independent: t.unique_independent,
      unique_dependent: t.unique_dependent,
      unique_self_pi: t.unique_self_pi,
      unique_self_former_pi: t.unique_self_former_pi,
      duplicate_records: t.duplicate_records,
      // Records captured over the citation count Scholar showed. Below 1 means
      // either a truncated capture or duplicate versions Scholar counts but the
      // per-record dedupe removes, so it is a cross-check, never a verdict.
      coverage_pct: tally.pct(t.records, citedBy),
      independent_share_pct: tally.pct(t.independent, t.records),
      unique_independent_share_pct: tally.pct(t.unique_independent, t.unique_records),
      exhibit_pdfs: captured ? pdfsFor(group.base) : [],
      exhibit_folder: captured ? "Exhibits/PDFs" : "",
      // Anything a reviewer still has to settle, including a capture that is
      // missing citing pages, so an incomplete exhibit cannot look finished.
      open_items:
        t.review + t.independent_pending + t.non_english + (captured && pages < expected ? 1 : 0),
    });
  }

  // A captured publication missing from the list would otherwise vanish from
  // the ledger while its PDFs sat in the exhibit folder.
  for (const [base, g] of groups) {
    if (rows.some((r) => r.cites_id && r.cites_id === g.cites_id)) continue;
    const t = tally.tallyEntries(g.entries);
    rows.push({
      cites_id: g.cites_id,
      title: g.title || base,
      venue: g.cited_venue || "",
      year: "",
      snapshot_date: [...g.snapshots][0] || listData.snapshot_date,
      cited_by_at_snapshot: 0,
      status: "captured-not-in-list",
      pages_expected: 0,
      pages_captured: g.pages.length,
      pages_complete: true,
      records_captured: t.records,
      independent: t.independent,
      independent_confirmed: t.independent_confirmed,
      independent_coverage: t.independent_coverage,
      independent_pending: t.independent_pending,
      dependent: t.dependent,
      self_pi: t.self_pi,
      self_former_pi: t.self_former_pi,
      review: t.review,
      non_english: t.non_english,
      non_english_withheld: t.non_english_withheld,
      english_records: t.english_records,
      english_independent: t.english_independent,
      unique_english_records: t.unique_english_records,
      unique_english_independent: t.unique_english_independent,
      unique_records: t.unique_records,
      unique_independent: t.unique_independent,
      // The distinct-paper side must carry the dependent and self counts too.
      // Without them the global uniqueDecided sums to unique_independent alone
      // and unique_independent_share_of_decided_pct reads a false 100.
      unique_dependent: t.unique_dependent,
      unique_self_pi: t.unique_self_pi,
      unique_self_former_pi: t.unique_self_former_pi,
      duplicate_records: t.duplicate_records,
      coverage_pct: null,
      independent_share_pct: tally.pct(t.independent, t.records),
      unique_independent_share_pct: tally.pct(t.unique_independent, t.unique_records),
      exhibit_pdfs: pdfsFor(base),
      exhibit_folder: "Exhibits/PDFs",
      open_items: t.review + t.independent_pending + t.non_english,
    });
  }

  const capturedRows = rows.filter((r) => r.status === "captured" || r.status === "captured-not-in-list");
  // Seeded with every key used below. Accumulating onto an absent key yields
  // NaN, which would then silently poison every percentage in the ledger.
  const total = rows.reduce((acc, r) => {
    for (const k of [
      "records_captured",
      "independent",
      "independent_confirmed",
      "independent_coverage",
      "independent_pending",
      "dependent",
      "self_pi",
      "self_former_pi",
      "review",
      "non_english",
      "non_english_withheld",
      "english_records",
      "english_independent",
      "unique_english_records",
      "unique_english_independent",
      "unique_records",
      "unique_independent",
      "unique_dependent",
      "unique_self_pi",
      "unique_self_former_pi",
      "duplicate_records",
      "pages_captured",
      "pages_expected",
      "cited_by_at_snapshot",
    ]) {
      acc[k] += Number(r[k]) || 0;
    }
    return acc;
  }, {
    ...tally.emptyTally(),
    records_captured: 0,
    pages_captured: 0,
    pages_expected: 0,
    cited_by_at_snapshot: 0,
  });

  // Decided records exclude anything still open, so a percentage quoted from
  // this ledger is never padded by unresolved entries.
  const decided = total.independent + total.dependent + total.self_pi + total.self_former_pi;
  // The same figures again with Scholar's duplicate versions collapsed to one
  // paper each. Quote THESE when stating how many papers cite the work; the
  // row-based numbers above describe the exhibit pages, which show every row.
  const uniqueDecided =
    total.unique_independent +
    total.unique_dependent +
    total.unique_self_pi +
    total.unique_self_former_pi;

  const global = {
    snapshot_date: listData.snapshot_date,
    snapshot_source: listData.source || "publications list snapshot",
    publication_list_file: `Exhibits/Supporting/${listFile}`,
    publications_total: (listData.publications || []).length,
    publications_captured: capturedRows.length,
    publications_remaining: (listData.publications || []).length - capturedRows.length,
    publications_no_count: rows.filter((r) => r.status === "no-citations-shown").length,
    publications_incomplete: capturedRows.filter((r) => !r.pages_complete).length,
    exhibit_pages: total.pages_captured,
    exhibit_pages_expected: total.pages_expected,
    citation_records_reviewed: total.records_captured,
    unique_papers_citing: total.unique_records,
    duplicate_records: total.duplicate_records,
    independent_countable: total.independent,
    independent_unique_papers: total.unique_independent,
    unique_decided_records: uniqueDecided,
    unique_independent_share_of_decided_pct: tally.pct(
      total.unique_independent,
      uniqueDecided
    ),
    independent_externally_confirmed: total.independent_confirmed,
    independent_scholar_list_only: total.independent_coverage,
    independent_pending: total.independent_pending,
    dependent: total.dependent,
    self_pi: total.self_pi,
    self_former_pi: total.self_former_pi,
    awaiting_review: total.review,
    flagged_non_english: total.non_english,
    non_english_withheld: total.non_english_withheld,
    // The guide's second path, which the user chose on 2026-11-01: no certified
    // translations, so non-English entries are left unhighlighted and the
    // record reports an adjusted total and percentage based solely on English
    // citations. The denominator is the English citations on the citing lists,
    // since Scholar does not publish an English-only total for the profile.
    english_citation_records: total.english_records,
    english_independent_records: total.english_independent,
    english_independent_share_pct: tally.pct(
      total.english_independent,
      total.english_records
    ),
    unique_english_papers: total.unique_english_records,
    unique_english_independent: total.unique_english_independent,
    unique_english_independent_share_pct: tally.pct(
      total.unique_english_independent,
      total.unique_english_records
    ),
    decided_records: decided,
    independent_share_of_reviewed_pct: tally.pct(total.independent, total.records_captured),
    independent_share_of_decided_pct: tally.pct(total.independent, decided),
    dependent_share_of_decided_pct: tally.pct(
      total.dependent + total.self_pi + total.self_former_pi,
      decided
    ),
    note:
      "independent_countable counts rows on the exhibit pages and excludes entries " +
      "flagged non-English and entries whose author list no source has settled. Per " +
      "the guide a non-English citation needs a certified human translation and " +
      "affidavit before it may be counted. independent_unique_papers collapses the " +
      "duplicate versions Scholar shows of the same paper and is the figure to quote " +
      "when stating how many distinct papers cite this work. Per the user's decision " +
      "on 2026-11-01 no certified translations are being obtained, so every " +
      "non-English entry is left unhighlighted and the english_* columns are the " +
      "adjusted English-only figures the guide asks for; non_english_withheld is the " +
      "count of entries that look independent and corroborated but are withheld for " +
      "language. The english_* denominator is the English rows on the citing lists, " +
      "because Google Scholar publishes no English-only total for a profile.",
  };

  return { global, rows, duplicates };
}

const CSV_COLUMNS = [
  "cites_id",
  "title",
  "venue",
  "year",
  "snapshot_date",
  "status",
  "cited_by_at_snapshot",
  "pages_expected",
  "pages_captured",
  "pages_complete",
  "records_captured",
  "independent",
  "independent_confirmed",
  "independent_coverage",
  "independent_pending",
  "dependent",
  "self_pi",
  "self_former_pi",
  "review",
  "non_english",
  "non_english_withheld",
  "english_records",
  "english_independent",
  "unique_english_records",
  "unique_english_independent",
  "unique_records",
  "unique_independent",
  "unique_dependent",
  "unique_self_pi",
  "unique_self_former_pi",
  "duplicate_records",
  "coverage_pct",
  "independent_share_pct",
  "unique_independent_share_pct",
  "open_items",
  "exhibit_pdfs",
];

// Quoted so a title containing a comma stays one cell when opened in Excel.
function csvCell(v) {
  const s = Array.isArray(v) ? v.join(" | ") : v === null || v === undefined ? "" : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(rows) {
  const lines = [CSV_COLUMNS.join(",")];
  for (const r of rows) lines.push(CSV_COLUMNS.map((c) => csvCell(r[c])).join(","));
  return lines.join("\r\n") + "\r\n";
}

// One line per build, so the running totals form a log rather than being
// replaced each time the ledger is rebuilt from the same Scholar snapshot.
const HISTORY_COLUMNS = [
  "run_at",
  "snapshot_date",
  "publications_captured",
  "publications_total",
  "exhibit_pages",
  "citation_records_reviewed",
  "unique_papers_citing",
  "duplicate_records",
  "independent_countable",
  "independent_unique_papers",
  "independent_externally_confirmed",
  "dependent",
  "self_pi",
  "self_former_pi",
  "awaiting_review",
  "flagged_non_english",
  "independent_share_of_reviewed_pct",
];

function appendHistory(ledger) {
  const historyPath = path.join(SUPPORT_DIR, "citation-ledger-history.csv");
  const exists = fs.existsSync(historyPath);
  const g = ledger.global;
  const row = {
    run_at: new Date().toISOString().slice(0, 19).replace("T", " "),
    snapshot_date: g.snapshot_date,
    publications_captured: g.publications_captured,
    publications_total: g.publications_total,
    exhibit_pages: g.exhibit_pages,
    citation_records_reviewed: g.citation_records_reviewed,
    unique_papers_citing: g.unique_papers_citing,
    duplicate_records: g.duplicate_records,
    independent_countable: g.independent_countable,
    independent_unique_papers: g.independent_unique_papers,
    independent_externally_confirmed: g.independent_externally_confirmed,
    dependent: g.dependent,
    self_pi: g.self_pi,
    self_former_pi: g.self_former_pi,
    awaiting_review: g.awaiting_review,
    flagged_non_english: g.flagged_non_english,
    independent_share_of_reviewed_pct: g.independent_share_of_reviewed_pct,
  };

  // The history file is append-only, so earlier rows keep whatever columns it
  // was created with. Writing today's wider column set onto an older header
  // would shift every value under the wrong name. Honour the header that is
  // already there and say so; the dated ledger JSON/CSV carries everything.
  let columns = HISTORY_COLUMNS;
  if (exists) {
    const header = fs.readFileSync(historyPath, "utf8").split(/\r?\n/)[0].split(",");
    if (header.join(",") !== HISTORY_COLUMNS.join(",")) columns = header;
  }

  const text = exists
    ? columns.map((c) => csvCell(row[c])).join(",") + "\r\n"
    : [HISTORY_COLUMNS.join(","), HISTORY_COLUMNS.map((c) => csvCell(row[c])).join(",")].join(
        "\r\n"
      ) + "\r\n";
  fs.appendFileSync(historyPath, text, "utf8");
  if (exists && columns !== HISTORY_COLUMNS) {
    console.log(
      `[ledger] NOTE: history keeps its original ${columns.length} columns, so the new ` +
        `distinct-paper figures are not logged there.\n` +
        `           Delete citation-ledger-history.csv to restart it with ` +
        `${HISTORY_COLUMNS.length} columns, or keep it as the audit trail.`
    );
  }
  return historyPath;
}

function printSummary(ledger) {
  const g = ledger.global;
  for (const [id, bases] of ledger.duplicates || []) {
    console.log(
      `[ledger] WARNING: cites=${id} has ${bases.length} filed exhibit sets `
    );
    for (const b of bases) console.log(`           ${b}`);
    console.log(
      "           Only one is counted. Move the superseded PDFs to Exhibits/Archive\n" +
        "           with a SUPERSEDED- prefix so the totals cannot depend on order."
    );
  }
  console.log(`[ledger] Snapshot: ${g.snapshot_date} (${g.snapshot_source})`);
  console.log(
    `[ledger] Publications: ${g.publications_captured} captured of ${g.publications_total}` +
      ` (${g.publications_remaining} remaining, ${g.publications_no_count} showing no count)`
  );
  if (g.publications_incomplete) {
    console.log(`[ledger] NOTE: ${g.publications_incomplete} captured publication(s) look incomplete.`);
  }
  console.log(`[ledger] Exhibit pages:            ${g.exhibit_pages} of ~${g.exhibit_pages_expected}`);
  console.log(
    `[ledger] Citation records reviewed: ${g.citation_records_reviewed}` +
      (g.duplicate_records
        ? `  (${g.unique_papers_citing} distinct papers; Scholar shows ` +
          `${g.duplicate_records} extra copy/copies of the same paper)`
        : "")
  );
  console.log(
    `[ledger] Independent (countable):   ${g.independent_countable}  ` +
      `(${g.independent_externally_confirmed} externally confirmed, ` +
      `${g.independent_scholar_list_only} Scholar's own complete list)`
  );
  if (g.duplicate_records) {
    console.log(
      `[ledger]   distinct papers basis:   ${g.independent_unique_papers} independent of ` +
        `${g.unique_papers_citing} papers  <-- quote this figure for "papers citing the work"`
    );
  }
  console.log(`[ledger] Dependent (shares author): ${g.dependent}`);
  console.log(`[ledger] Self-citations PI/former:  ${g.self_pi} / ${g.self_former_pi}`);
  console.log(`[ledger] Awaiting review:           ${g.awaiting_review}`);
  console.log(`[ledger] Flagged non-English:       ${g.flagged_non_english}`);
  if (g.independent_pending) {
    console.log(`[ledger] Independent but unsettled:  ${g.independent_pending} (not counted)`);
  }
  // The adjusted English-only figures the guide asks for when no certified
  // translations are filed. Printed on their own lines so the headline count
  // and the adjusted count can never be confused for one another.
  console.log(
    `[ledger] English only (adjusted):  ${g.english_independent_records} independent of ` +
      `${g.english_citation_records} English citation records = ${g.english_independent_share_pct}%`
  );
  console.log(
    `[ledger]   distinct papers basis:  ${g.unique_english_independent} independent of ` +
      `${g.unique_english_papers} English papers = ${g.unique_english_independent_share_pct}%`
  );
  if (g.non_english_withheld) {
    console.log(
      `[ledger]   withheld for language:  ${g.non_english_withheld} entry/entries that look ` +
        `independent and are corroborated, left unhighlighted without a certified translation`
    );
  }
  console.log(
    `[ledger] Independent share: ${g.independent_share_of_reviewed_pct}% of reviewed records, ` +
      `${g.independent_share_of_decided_pct}% of decided ones`
  );
}

function main() {
  const ledger = build();
  if (asJson) {
    console.log(JSON.stringify(ledger, null, 2));
    return;
  }

  const stamp = ledger.global.snapshot_date;
  const jsonPath = path.join(SUPPORT_DIR, `citation-ledger-${stamp}.json`);
  const csvPath = path.join(SUPPORT_DIR, `citation-ledger-${stamp}.csv`);
  fs.writeFileSync(jsonPath, JSON.stringify(ledger, null, 2) + "\n", "utf8");
  fs.writeFileSync(csvPath, toCsv(ledger.rows), "utf8");
  const historyPath = appendHistory(ledger);

  printSummary(ledger);
  console.log(`[ledger] Per-article rows: ${csvPath}`);
  console.log(`[ledger] Full ledger:      ${jsonPath}`);
  console.log(`[ledger] Run history:      ${historyPath}`);
  console.log(
    "\nRe-run after every batch. The dated file is the record; the CSV opens in a\n" +
      "spreadsheet for per-article statistics, and the global block is the same\n" +
      "figures for the packet. Counts are tied to the snapshot date shown above.\n" +
      "The history file keeps one line per run, so growth across sessions is\n" +
      "visible instead of being overwritten by the next rebuild."
  );
}

if (require.main === module) {
  try {
    main();
  } catch (e) {
    console.error(`[ledger] ${e.message}`);
    process.exitCode = 1;
  }
}

module.exports = { build, toCsv, CSV_COLUMNS };

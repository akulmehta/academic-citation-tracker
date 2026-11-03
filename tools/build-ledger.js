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
// THIS FILE IS A DERIVED REPORT. Since the database became the primary store on
// 2026-11-02, the citation rows here come from Database/citation-catalog.sqlite
// (schema v4 or later) -- the active ones, which are the filed exhibits that
// have not been retired. The per-article figures are still computed by tally.js,
// over the rows read out of the store, so "independent" means exactly what it
// has always meant here and no rule is reimplemented.
//
// The report JSON is read too, and compared, figure by figure. A disagreement is
// NOT resolved in either side's favour: it is a defect to investigate, this tool
// exits non-zero, and no figure from either source may be quoted for the packet
// until it is explained. That is the inversion of the earlier rule, under which
// the CSV was authoritative and the database disposable.
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
const { DatabaseSync } = require("node:sqlite");
const tally = require("./tally");
const { DB_PATH } = require("./build-catalog");

const ROOT = path.resolve(__dirname, "..");
const EXHIBITS = path.join(ROOT, "Independent Citation Record", "Exhibits");
const PDF_DIR = path.join(EXHIBITS, "PDFs");
const SUPPORT_DIR = path.join(EXHIBITS, "Supporting");

const asJson = process.argv.includes("--json");

// The lowest schema this tool can read. v4 is where superseded_at appeared, and
// the query below only needs columns that exist from v4 on. An exact comparison
// here used to break the ledger on every schema bump -- adding one column in v5
// made a clean rebuild refuse to produce a ledger -- so the test is a floor.
// Raise it only when this tool starts depending on a column a later version adds.
const MIN_SCHEMA = 4;

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

// Active citation rows from the primary store, grouped by the publication they
// cite, and shaped like a report entry so tally.js needs no new code path. The
// store already carries the resolved language-edition decision in duplicate_of,
// so the rows go straight to tallyEntries -- groupReports' own page walk must not
// be replayed here, or the edition rule would be applied twice.
function parseJsonArray(v) {
  if (Array.isArray(v)) return v;
  if (!v || typeof v !== "string") return [];
  try {
    const parsed = JSON.parse(v);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function storeEntries() {
  if (!fs.existsSync(DB_PATH)) {
    throw new Error(
      `No catalog at ${DB_PATH}. The ledger reads the citation rows from it, so ` +
        `run: node tools/build-catalog.js --write`
    );
  }
  const db = new DatabaseSync(DB_PATH, { readOnly: true });
  const meta = db.prepare("SELECT value FROM meta WHERE key = 'schema_version'").get();
  const version = meta ? Number(meta.value) : NaN;
  if (!Number.isFinite(version) || version < MIN_SCHEMA) {
    db.close();
    throw new Error(
      `The catalog is at schema v${meta ? meta.value : "?"}; the ledger needs at ` +
        `least v${MIN_SCHEMA}, which is where superseded_at lives. Run: ` +
        `node tools/build-catalog.js --write`
    );
  }
  const rows = db
    .prepare(
      `SELECT cites_id, base, page, row_index, cid, title, raw_title, authors,
              authors_used, author_source, status, confirm_state, language_flag,
              duplicate_of, edition_key, same_work_key,
              matched_authors, matched_pi, matched_former_pi
         FROM citations
        WHERE filed = 1 AND superseded_at = ''
        ORDER BY cites_id, page, row_index`
    )
    .all();
  db.close();

  const byId = new Map();
  const byBase = new Map();
  for (const r of rows) {
    const e = {
      ...r,
      // tally.paperKey falls back to page + cid, and copyReliability reads
      // author_source; both arrive under the name the reports use.
      index: r.row_index,
      rawTitle: r.raw_title,
      // The matched_* columns are stored as JSON text. copyReliability needs
      // them as arrays: which copy of a duplicated paper stands for it can turn
      // on a demonstrated shared author, and reading the store without them
      // made the store pick a different copy than the reports did -- the ledger
      // then reported one more distinct independent paper than the store, per
      // publication. Parse here so both sides of the comparison see the same
      // fields.
      matched_authors: parseJsonArray(r.matched_authors),
      matched_pi: parseJsonArray(r.matched_pi),
      matched_former_pi: parseJsonArray(r.matched_former_pi),
    };
    if (!byId.has(r.cites_id)) byId.set(r.cites_id, []);
    byId.get(r.cites_id).push(e);
    const pubBase = r.base.replace(/-p\d+$/, "");
    if (!byBase.has(pubBase)) byBase.set(pubBase, []);
    byBase.get(pubBase).push(e);
  }
  return { byId, byBase, count: rows.length };
}

function build() {
  const { file: listFile, data: listData } = readList();
  // The reports are still read -- as the independent recomputation this ledger is
  // checked against, and for the exhibit file inventory, which is a fact about
  // Exhibits/PDFs rather than about a citation.
  const groups = tally.groupReports(SUPPORT_DIR, PDF_DIR);
  const store = storeEntries();

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
  // Every figure below is computed twice: once from the store and once from the
  // reports that produced it. Any disagreement lands here and fails the run, per
  // the rule that a mismatch is a defect rather than a choice of source.
  const diffs = [];
  const FIGURES = [
    "records",
    "independent",
    "dependent",
    "self_pi",
    "self_former_pi",
    "review",
    "review_queue",
    "withheld_language",
    "unique_records",
    "unique_independent",
  ];

  for (const pub of listData.publications || []) {
    const id = tally.citesId(pub.citesUrl);
    const citedBy = Number(pub.citedBy) || 0;
    // Match on the cites id only when there is one: an empty id would match
    // every other publication whose citing list could not be resolved.
    const group = id ? [...groups.values()].find((g) => g.cites_id === id) : undefined;

    // Tally the rows from the store. The report group still supplies the page
    // count and the exhibit file list; when a publication has store rows they
    // drive every figure.
    const entries = (id && store.byId.get(id)) || [];
    const t = tally.tallyEntries(entries);
    // A publication with no store rows at all -- unfiled, or a citing list never
    // captured -- falls back to the reports, which is the only source left.
    const fromStore = entries.length > 0;
    const captured = fromStore || Boolean(group);
    if (group) {
      const tr = tally.tallyEntries(group.entries);
      if (!fromStore) {
        // Filed exhibit pages whose rows are not in the store: the store would
        // report zero for a publication that plainly has citations on file. Do
        // not quietly fall back to the reports -- say which publication is
        // missing rows so the store gets rebuilt.
        if (tr.records > 0) {
          diffs.push({
            cites_id: id,
            publication: pub.title,
            figure: "records (captured pages, no rows in the store)",
            store: 0,
            reports: tr.records,
          });
        }
      } else {
        for (const k of FIGURES) {
          if (tr[k] !== t[k]) {
            diffs.push({
              cites_id: id,
              publication: pub.title,
              figure: k,
              store: t[k],
              reports: tr[k],
            });
          }
        }
      }
    }
    // A publication showing no count on the profile needs no exhibit, so it
    // must not add a page to the expected total.
    const expected = citedBy ? tally.expectedPages(citedBy) : 0;
    const pages = group
      ? group.pages.length
      : new Set(entries.map((e) => e.page)).size;

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
      independent_user_decided: t.independent_user_decided,
      independent_pending: t.independent_pending,
      // The independent-classified rows the language screen supersedes. Named so
      // the status partition (independent + pending + non_english_independent +
      // dependent + self + review = records) still sums after non-English rows
      // left the unsettled bucket on 2026-11-03.
      non_english_independent: t.non_english_independent,
      dependent: t.dependent,
      self_pi: t.self_pi,
      self_former_pi: t.self_former_pi,
      review: t.review,
      // The actionable subset of review. Both are carried: `review` keeps the
      // status partition (independent + dependent + self + review = records),
      // `review_queue` is the length of the sheet a person opens, and their
      // difference is the non-English rows that belong on the Non-English page
      // rather than in a work queue (user instruction, 2026-11-03).
      review_queue: t.review_queue,
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
      // review_queue and not review: a non-English row is not something a
      // reviewer settles (no translations are being obtained) and it is already
      // counted by the non_english term, so using `review` here counted those
      // rows twice. Likewise independent_pending stopped including non-English
      // rows on 2026-11-03, so the pending and non_english terms no longer
      // overlap -- before that this line counted 45 rows twice.
      open_items:
        t.review_queue + t.independent_pending + t.non_english + (captured && pages < expected ? 1 : 0),
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
      independent_user_decided: t.independent_user_decided,
      independent_pending: t.independent_pending,
      non_english_independent: t.non_english_independent,
      dependent: t.dependent,
      self_pi: t.self_pi,
      self_former_pi: t.self_former_pi,
      review: t.review,
      review_queue: t.review_queue,
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
      open_items:
        t.review_queue + t.independent_pending + t.non_english,
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
      "independent_user_decided",
      "independent_pending",
      "non_english_independent",
      "dependent",
      "self_pi",
      "self_former_pi",
      "review",
      "review_queue",
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
    // Stated in the file itself, so a quoted figure can be traced to where it
    // was computed rather than assumed.
    figures_source:
      "Database/citation-catalog.sqlite (rows with filed = 1 and superseded_at = ''), " +
      "recomputed independently from the report JSON in Exhibits/Supporting and " +
      "Exhibits/PDFs; the two agreed figure by figure when this file was written",
    store_rows_counted: store.count,
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
    independent_user_decided: total.independent_user_decided,
    independent_pending: total.independent_pending,
    // The independent-classified rows held by the language screen. Published so
    // the partition reconciles: with non-English rows no longer counted as
    // unsettled work, they need a named bucket of their own. See tally.js.
    non_english_independent: total.non_english_independent,
    dependent: total.dependent,
    self_pi: total.self_pi,
    self_former_pi: total.self_former_pi,
    awaiting_review: total.review,
    // The queue a person works. Awaiting review counts every row still classified
    // REVIEW; the queue excludes the ones that are also non-English, which cannot
    // be settled by reading a byline and are reported under flagged_non_english
    // instead. Awaiting a decision that cannot change the packet is not work.
    review_queue: total.review_queue,
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

  // Rows in the store under a citing id the snapshot list does not mention -- a
  // publication captured after the list was taken, or one removed from the
  // profile. Either way its rows would be left out of every total below.
  const listedIds = new Set(
    (listData.publications || []).map((p) => tally.citesId(p.citesUrl)).filter(Boolean)
  );
  const orphanCitesIds = [...store.byId.keys()].filter((id) => id && !listedIds.has(id));

  return { global, rows, duplicates, diffs, orphanCitesIds };
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
  "independent_user_decided",
  "independent_pending",
  "non_english_independent",
  "dependent",
  "self_pi",
  "self_former_pi",
  "review",
  "review_queue",
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
      `${g.independent_scholar_list_only} Scholar's own complete list` +
      // Named only when non-zero, so the three bases always add up to the number
      // on the left. A row settled by hand is not "externally confirmed" and
      // must not be folded into that figure.
      (g.independent_user_decided
        ? `, ${g.independent_user_decided} settled by you`
        : "") +
      ")"
  );
  if (g.duplicate_records) {
    console.log(
      `[ledger]   distinct papers basis:   ${g.independent_unique_papers} independent of ` +
        `${g.unique_papers_citing} papers  <-- quote this figure for "papers citing the work"`
    );
  }
  console.log(`[ledger] Dependent (shares author): ${g.dependent}`);
  console.log(`[ledger] Self-citations PI/former:  ${g.self_pi} / ${g.self_former_pi}`);
  // The queue length first, since that is the number of rows a person opens.
  // The raw REVIEW count is shown alongside only when it is larger, so the
  // difference -- rows that are non-English and therefore not a decision to make
  // -- is visible rather than silently dropped from the queue.
  console.log(
    `[ledger] Review queue:              ${g.review_queue}` +
      (g.awaiting_review > g.review_queue
        ? `  (${g.awaiting_review} classified REVIEW, ${
            g.awaiting_review - g.review_queue
          } of them non-English and reported under Flagged non-English below)`
        : "")
  );
  console.log(
    `[ledger] Flagged non-English:       ${g.flagged_non_english}` +
      (g.non_english_independent
        ? `  (${g.non_english_independent} carry an INDEPENDENT classification but the ` +
          `language screen supersedes it -- reported here, not as unsettled work)`
        : "")
  );
  if (g.independent_pending) {
    console.log(
      `[ledger] Independent but unsettled:  ${g.independent_pending} English rows ` +
        `awaiting corroboration (not counted)`
    );
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

// Every reason this ledger must not be written, as human-readable lines. Empty
// means the store and the reports agree figure by figure. Pulled out of main()
// so tools/test-catalog-merge.js can feed it a fabricated disagreement -- the
// case the gate exists for cannot be produced from real data without corrupting
// the store first.
function findDefects(ledger) {
  const out = [];
  for (const d of ledger.diffs || []) {
    out.push(
      `cites=${d.cites_id} ${d.figure}: store ${d.store} vs reports ${d.reports}` +
        `  ::  ${String(d.publication).slice(0, 70)}`
    );
  }
  const listed = new Set((ledger.rows || []).map((r) => r.cites_id).filter(Boolean));
  for (const id of [...new Set(ledger.orphanCitesIds || [])]) {
    if (listed.has(id)) continue;
    out.push(
      `the store has citation rows for cites=${id}, which is not in the publication ` +
        `list snapshot. Re-run tools/list-all-publications.js.`
    );
  }
  return out;
}

function main() {
  const ledger = build();

  // The disagreement gate. Nothing is written when it trips: a derived report
  // that disagrees with the store is worse than no report, because the packet
  // would quote one of two numbers with no record of which was checked.
  const defects = findDefects(ledger);
  if (defects.length) {
    console.error(
      `[ledger] DEFECT: the store and the reports do not agree. No ledger file was ` +
        `written and no figure from either may be quoted for the packet until this ` +
        `is resolved. This is not a choice of source -- investigate which side is wrong.`
    );
    for (const line of defects) console.error(`           ${line}`);
    process.exitCode = 4;
    return;
  }
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
    "\nRe-run after every batch. This file is a DERIVED REPORT: the citation rows come\n" +
      "from Database/citation-catalog.sqlite, which is the primary store, and every\n" +
      "figure above was recomputed from the report JSON as a cross-check. Quote from\n" +
      "this file so per-article and global statistics cannot drift apart, and rebuild\n" +
      "it with: node tools/build-ledger.js\n" +
      "Counts are tied to the snapshot date shown above. The history file keeps one\n" +
      "line per run, so growth across sessions is visible rather than overwritten."
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

module.exports = { build, toCsv, CSV_COLUMNS, storeEntries, findDefects };

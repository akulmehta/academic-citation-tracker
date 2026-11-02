// Build the data file the dashboard reads.
//
//   node tools/build-dashboard-data.js            (writes dashboard/data/citation-data.json)
//   node tools/build-dashboard-data.js --check     (print totals, write nothing)
//
// Every figure comes from the two artefacts the project already treats as
// authoritative, and nothing is recomputed here with a private rule:
//
//   - Exhibits/Supporting/citation-ledger-<snapshot>.json  (build-ledger.js)
//       global totals and the per-article rows. Project instructions say to
//       quote this file, so the dashboard's headline numbers are copied from it.
//   - Database/citation-catalog.sqlite                     (build-catalog.js)
//       the detail the ledger does not carry: the citing patents, the year of
//       each citing work, corroboration source, and the marked rows themselves.
//
// The catalog builder re-derives its own totals through tally.js on every run
// and prints ok/DIFF, so a disagreement would already have surfaced there. This
// script additionally refuses to write if the two sources disagree on the
// headline independent/records figures - a dashboard that quietly drifts from
// the ledger is worse than no dashboard.
//
// Read-only against both sources. Writes one JSON file.

const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");

const ROOT = path.resolve(__dirname, "..");
const SUPPORT = path.join(
  ROOT,
  "Independent Citation Record",
  "Exhibits",
  "Supporting"
);
const DB_PATH = path.join(ROOT, "Database", "citation-catalog.sqlite");
const OUT_DIR = path.join(ROOT, "dashboard", "data");
const OUT_FILE = path.join(OUT_DIR, "citation-data.json");
const CHECK = process.argv.includes("--check");

function log(m) {
  console.log(`[dash] ${m}`);
}

function latestLedger() {
  const files = fs
    .readdirSync(SUPPORT)
    .filter((f) => /^citation-ledger-\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .sort();
  if (!files.length) {
    throw new Error("No citation-ledger-<date>.json found. Run build-ledger.js.");
  }
  return path.join(SUPPORT, files[files.length - 1]);
}

const ledgerPath = latestLedger();
const ledger = JSON.parse(fs.readFileSync(ledgerPath, "utf8"));
const g = ledger.global;
log(`Ledger: ${path.basename(ledgerPath)} (snapshot ${g.snapshot_date})`);

if (!fs.existsSync(DB_PATH)) {
  throw new Error(
    `${DB_PATH} not found. Run node tools/build-catalog.js first - the ` +
      `dashboard's patent and per-work detail comes from it.`
  );
}
const db = new DatabaseSync(DB_PATH, { readOnly: true });
const q = (sql, ...args) => db.prepare(sql).all(...args);
const meta = Object.fromEntries(
  q("SELECT key, value FROM meta").map((r) => [r.key, r.value])
);
log(`Catalog: schema v${meta.schema_version}, snapshot ${meta.snapshot_date}`);

if (meta.snapshot_date !== g.snapshot_date) {
  throw new Error(
    `The ledger describes ${g.snapshot_date} but the catalog describes ` +
      `${meta.snapshot_date}. Rebuild the catalog so the dashboard shows one snapshot.`
  );
}

// ---- guard: the two sources must agree on the headline figures ----
const dbTotals = q(`SELECT
    SUM(CASE WHEN filed=1 THEN 1 ELSE 0 END) AS records,
    SUM(CASE WHEN filed=1 AND is_countable_independent=1 THEN 1 ELSE 0 END) AS independent,
    SUM(CASE WHEN filed=1 AND is_primary_copy=1 THEN 1 ELSE 0 END) AS unique_records,
    SUM(CASE WHEN filed=1 AND is_primary_copy=1 AND is_countable_independent=1 THEN 1 ELSE 0 END) AS unique_independent
  FROM citations`)[0];
const guards = [
  ["citation records", dbTotals.records, g.citation_records_reviewed],
  ["independent", dbTotals.independent, g.independent_countable],
  ["distinct papers", dbTotals.unique_records, g.unique_papers_citing],
  ["distinct independent", dbTotals.unique_independent, g.independent_unique_papers],
];
for (const [name, dbv, ledv] of guards) {
  if (Number(dbv) !== Number(ledv)) {
    throw new Error(
      `Refusing to write: ${name} is ${dbv} in the catalog and ${ledv} in the ` +
        `ledger. Reconcile before publishing a dashboard.`
    );
  }
  log(`ok  ${name.padEnd(20)} ${ledv}`);
}

// ---- per-article rows: copied from the ledger, enriched with catalog detail ----
const pubDetail = q(`SELECT
    p.cites_id, p.authors AS cited_authors, p.paper_url, p.cites_url,
    p.exhibit_base,
    (SELECT COUNT(*) FROM citations c WHERE c.cites_id=p.cites_id AND c.filed=1
       AND c.work_type IN ('patent','patent-application')) AS patent_rows,
    (SELECT COUNT(*) FROM citations c WHERE c.cites_id=p.cites_id AND c.filed=1
       AND c.is_countable_independent=1
       AND c.work_type IN ('patent','patent-application')) AS patent_independent
  FROM publications p`);
const detailById = new Map(pubDetail.map((r) => [r.cites_id, r]));

const articles = ledger.rows.map((r) => {
  const d = detailById.get(r.cites_id) || {};
  return {
    cites_id: r.cites_id,
    title: r.title,
    venue: r.venue,
    year: r.year ? Number(r.year) : null,
    status: r.status,
    cited_by_at_snapshot: Number(r.cited_by_at_snapshot),
    pages_expected: Number(r.pages_expected),
    pages_captured: Number(r.pages_captured),
    pages_complete: r.pages_complete === true || r.pages_complete === "1",
    records: Number(r.records_captured),
    unique_records: Number(r.unique_records),
    duplicate_records: Number(r.duplicate_records),
    independent: Number(r.independent),
    independent_confirmed: Number(r.independent_confirmed),
    independent_coverage: Number(r.independent_coverage),
    independent_pending: Number(r.independent_pending),
    unique_independent: Number(r.unique_independent),
    dependent: Number(r.dependent),
    self_pi: Number(r.self_pi),
    self_former_pi: Number(r.self_former_pi),
    review: Number(r.review),
    non_english: Number(r.non_english),
    non_english_withheld: Number(r.non_english_withheld),
    english_records: Number(r.english_records),
    english_independent: Number(r.english_independent),
    coverage_pct: r.coverage_pct === "" ? null : Number(r.coverage_pct),
    independent_share_pct:
      r.independent_share_pct === "" ? null : Number(r.independent_share_pct),
    open_items: Number(r.open_items),
    patent_rows: Number(d.patent_rows || 0),
    patent_independent: Number(d.patent_independent || 0),
    exhibit_base: d.exhibit_base || "",
    paper_url: d.paper_url || "",
    cites_url: d.cites_url || "",
  };
});

// ---- citing patents: the dedicated section the user asked for ----
const patents = q(`SELECT
    c.patent_number, c.patent_kind, c.work_type, c.title, c.authors,
    c.status, c.confirm_state, c.is_countable_independent, c.link,
    c.cid, c.cites_id, p.title AS cited_title, p.year AS cited_year,
    c.base, c.page
  FROM citations c
  LEFT JOIN publications p ON p.cites_id = c.cites_id
  WHERE c.filed = 1 AND c.work_type IN ('patent','patent-application')
  ORDER BY c.is_countable_independent DESC, c.patent_number, c.title`).map((r) => ({
  patent_number: r.patent_number,
  kind: r.patent_kind,
  work_type: r.work_type,
  granted: r.work_type === "patent",
  title: r.title,
  applicants: r.authors,
  status: r.status,
  confirm_state: r.confirm_state,
  counted: r.is_countable_independent === 1,
  link: r.link,
  cid: r.cid,
  cites_id: r.cites_id,
  cited_title: r.cited_title,
  cited_year: r.cited_year,
  exhibit_base: r.base,
  exhibit_page: r.page,
}));
log(`Citing patents/applications: ${patents.length} (${patents.filter((p) => p.counted).length} counted)`);

// ---- year distribution of the citing works, from the venue string in the snippet ----
// Scholar puts the year in the byline ("X Author - Journal, 2014 - site"), so it
// is parsed here rather than trusted from a separate field. Only rows on filed
// pages contribute.
const yearRows = q(`SELECT c.authors, c.is_countable_independent AS ind, c.is_primary_copy AS prim
  FROM citations c WHERE c.filed = 1`);
const byYear = new Map();
for (const r of yearRows) {
  // Take the last 4-digit year in the byline: "X Author - Journal, 2014 - site".
  const matches = String(r.authors || "").match(/\b(19|20)\d{2}\b/g) || [];
  const year = matches.length ? Number(matches[matches.length - 1]) : null;
  const key = year && year >= 1990 && year <= new Date().getFullYear() + 1 ? year : null;
  const slot = byYear.get(key) || { year: key, records: 0, independent: 0 };
  slot.records += 1;
  if (r.ind === 1) slot.independent += 1;
  byYear.set(key, slot);
}
const years = [...byYear.values()]
  .filter((y) => y.year !== null)
  .sort((a, b) => a.year - b.year);
const undated = byYear.get(null) || { year: null, records: 0, independent: 0 };

// ---- corroboration split among the marked rows ----
// Two bases, both from the ledger's own definitions: rows on the exhibit pages
// (1033 at this snapshot) and distinct papers after Scholar's duplicate versions
// collapse (1020). The dashboard labels whichever it shows.
const corroboration = q(`SELECT
    c.confirm_state, c.author_source, COUNT(*) AS n
  FROM citations c
  WHERE c.filed = 1 AND c.is_countable_independent = 1
  GROUP BY c.confirm_state, c.author_source`).map((r) => ({
  confirm_state: r.confirm_state,
  author_source: r.author_source,
  count: r.n,
}));
const corroborationDistinct = q(`SELECT
    c.confirm_state, COUNT(*) AS n
  FROM citations c
  WHERE c.filed = 1 AND c.is_countable_independent = 1 AND c.is_primary_copy = 1
  GROUP BY c.confirm_state`).map((r) => ({
  confirm_state: r.confirm_state,
  count: r.n,
}));

// ---- every distinct citing work, marked or not, for the scrolling list ----
// No LIMIT and no status filter: the user asked for the entire dataset to be
// visualisable, and a list of only the highlighted rows would make the
// dependent and unresolved side invisible. `marked` carries the exhibit's own
// decision so the dashboard can never disagree with the PDF.
const allWorks = q(`SELECT
    c.title, c.authors, c.status, c.confirm_state, c.external_source,
    c.external_url, c.link, c.work_type, c.cites_id, p.title AS cited_title,
    p.year AS cited_year, c.base, c.page, c.cid,
    c.is_countable_independent AS marked, c.language_flag, c.attention_reason,
    p.cited_by_at_snapshot AS cited_by
  FROM citations c
  LEFT JOIN publications p ON p.cites_id = c.cites_id
  WHERE c.filed = 1 AND c.is_primary_copy = 1
  ORDER BY p.cited_by_at_snapshot DESC, c.title`).map((r) => ({
  title: r.title,
  byline: r.authors,
  status: r.status,
  marked: r.marked === 1,
  confirm_state: r.confirm_state,
  language_flag: r.language_flag || "",
  attention_reason: r.attention_reason || "",
  external_source: r.external_source,
  external_url: r.external_url,
  link: r.link,
  work_type: r.work_type,
  cites_id: r.cites_id,
  cited_title: r.cited_title,
  cited_year: r.cited_year,
  cited_by: r.cited_by,
  exhibit_base: r.base,
  exhibit_page: r.page,
  cid: r.cid,
}));

// ---- unresolved items, so the dashboard does not overstate certainty ----
const openItems = q(`SELECT
    c.status, c.attention_reason, COUNT(*) AS n
  FROM citations c WHERE c.filed = 1 AND c.needs_attention = 1
  GROUP BY c.status, c.attention_reason
  ORDER BY n DESC`).map((r) => ({
  status: r.status,
  reason: r.attention_reason,
  count: r.n,
}));

// ---- snapshot metric history from the tracker, for the trend strip ----
let metricHistory = [];
try {
  const tracker = JSON.parse(
    fs.readFileSync(
      path.join(ROOT, "Independent Citation Record", "Progress Tracker.json"),
      "utf8"
    )
  );
  metricHistory = (tracker.primary_platform?.citation_total_history || []).map(
    (h) => ({
      snapshot_date: h.snapshot_date,
      cited_by_all: h.cited_by_all,
      cited_by_since_2021: h.cited_by_since_2021,
      basis: h.basis || "",
      source: h.source || "",
    })
  );
} catch (e) {
  log(`WARNING: could not read metric history from the tracker: ${e.message}`);
}

const out = {
  generated_at: new Date().toISOString(),
  sources: {
    ledger: `Exhibits/Supporting/${path.basename(ledgerPath)}`,
    catalog: "Database/citation-catalog.sqlite",
    catalog_built_at: meta.built_at || "",
    note:
      "Headline figures are copied from the dated ledger written by tools/build-ledger.js, " +
      "which the project instructions make authoritative. The catalog supplies the detail it " +
      "does not carry. This file is generated; regenerate it rather than editing it.",
  },
  global: {
    snapshot_date: g.snapshot_date,
    profile_url: g.snapshot_source,
    publications_total: g.publications_total,
    publications_captured: g.publications_captured,
    publications_remaining: g.publications_remaining,
    publications_no_count: g.publications_no_count,
    exhibit_pages: g.exhibit_pages,
    citation_records_reviewed: g.citation_records_reviewed,
    unique_papers_citing: g.unique_papers_citing,
    duplicate_records: g.duplicate_records,
    independent_countable: g.independent_countable,
    independent_unique_papers: g.independent_unique_papers,
    independent_externally_confirmed: g.independent_externally_confirmed,
    independent_scholar_list_only: g.independent_scholar_list_only,
    independent_pending: g.independent_pending,
    dependent: g.dependent,
    self_pi: g.self_pi,
    self_former_pi: g.self_former_pi,
    awaiting_review: g.awaiting_review,
    flagged_non_english: g.flagged_non_english,
    non_english_withheld: g.non_english_withheld,
    decided_records: g.decided_records,
    unique_decided_records: g.unique_decided_records,
    english_citation_records: g.english_citation_records,
    english_independent_records: g.english_independent_records,
    english_independent_share_pct: g.english_independent_share_pct,
    unique_english_papers: g.unique_english_papers,
    unique_english_independent: g.unique_english_independent,
    unique_english_independent_share_pct: g.unique_english_independent_share_pct,
    independent_share_of_reviewed_pct: g.independent_share_of_reviewed_pct,
    independent_share_of_decided_pct: g.independent_share_of_decided_pct,
    scholar_cited_by: g.scholar_cited_by ?? null,
    note: g.note,
  },
  metric_history: metricHistory,
  articles,
  patents,
  years,
  undated,
  corroboration,
  corroboration_distinct: corroborationDistinct,
  works: allWorks,
  open_items: openItems,
};

if (CHECK) {
  log(`--check: ${articles.length} articles, ${patents.length} patents, ` +
    `${years.length} years, ${allWorks.length} distinct citing works ` +
    `(${allWorks.filter((w) => w.marked).length} marked). Nothing written.`);
  db.close();
  return;
}

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(OUT_FILE, JSON.stringify(out, null, 1) + "\n", "utf8");
db.close();
log(`Wrote ${path.relative(ROOT, OUT_FILE)} (${(fs.statSync(OUT_FILE).size / 1024).toFixed(1)} KB)`);

// A second copy as a script tag. Over the file:// protocol a browser refuses
// fetch() of a local JSON file, which would leave the dashboard blank for
// anyone who just double-clicks index.html to review and print it. Assigning to
// a global from a .js file is allowed there, so the page loads this first and
// falls back to fetch() when served over http.
const JS_FILE = path.join(OUT_DIR, "citation-data.js");
fs.writeFileSync(
  JS_FILE,
  "// Generated by tools/build-dashboard-data.js - do not edit.\n" +
    "// Same content as citation-data.json in this folder.\n" +
    "window.CITATION_DATA = " +
    JSON.stringify(out) +
    ";\n",
  "utf8"
);
log(`Wrote ${path.relative(ROOT, JS_FILE)} (${(fs.statSync(JS_FILE).size / 1024).toFixed(1)} KB)`);

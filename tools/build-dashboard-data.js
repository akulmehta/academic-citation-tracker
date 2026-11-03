// Build the data file the dashboard reads.
//
//   node tools/build-dashboard-data.js            (writes dashboard/data/citation-data.json)
//   node tools/build-dashboard-data.js --check     (print totals, write nothing)
//
// Two artefacts feed this file and neither has a private counting rule:
//
//   - Database/citation-catalog.sqlite                     (build-catalog.js)
//       the PRIMARY store. Every per-row detail comes from it: the citing works,
//       the patents, the year, corroboration, and the review queue. Reads go
//       through the active set (filed = 1 AND superseded_at = ''), which is the
//       set the ledger sums.
//   - Exhibits/Supporting/citation-ledger-<snapshot>.json  (build-ledger.js)
//       a DERIVED report of those same rows. Its global block supplies the
//       headline figures so the dashboard quotes the same numbers as the packet.
//
// Both build-ledger.js and build-catalog.js recompute the totals independently,
// so a disagreement would already have surfaced there. This script additionally
// refuses to write if the store and the ledger disagree on the headline
// figures: a dashboard that quietly drifts from the packet is worse than no
// dashboard, and per the project rules no figure may be quoted while the two
// disagree at all.
//
// row_uid is carried on every citing work and patent so a row visible in the
// dashboard can be quoted back and still mean the same row next month. The
// integer id is never used.
//
// Read-only against both sources. Writes one JSON file and its .js twin.

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
const PDF_DIR = path.join(ROOT, "Independent Citation Record", "Exhibits", "PDFs");
const OUT_DIR = path.join(ROOT, "dashboard", "data");
const OUT_FILE = path.join(OUT_DIR, "citation-data.json");
const CHECK = process.argv.includes("--check");

function log(m) {
  console.log(`[dash] ${m}`);
}

// The external record's URL, or "" when the match behind it was discarded.
//
// A row can carry an external_source and external_url whose title overlap was
// judged too thin to be the same work (external_match_credible = 0). That record
// is the audit trail of a rejection, not a source to check: cit-001476's PubMed
// hit is a swine-lung article that scored 0.07. Publishing the link would put a
// pointer to an unrelated paper in data that ships with the packet, and the page
// could only hide it at render time -- the JSON underneath would still carry it.
// One helper, used by every projection out of the store, so a rejected link is
// absent from the published data rather than merely unrendered. The source name
// is kept, since "we looked and rejected it" is the useful fact.
function externalUrl(r) {
  return r.external_match_credible === 0 ? "" : r.external_url || "";
}

// A row's exhibit PDF, as a path relative to dashboard/ so a file:// page can
// open it. Filed sets live in PDFs/ or PDFs/Production/, and page 1 carries no
// -pN suffix, so all four combinations are tried. Returns "" when nothing is on
// disk: a link that 404s is worse than no link, because it looks like the
// evidence is missing rather than merely unlinked here.
const pdfCache = new Map();
function exhibitPdf(base, page) {
  if (!base) return "";
  const cacheKey = `${base}|${page}`;
  if (pdfCache.has(cacheKey)) return pdfCache.get(cacheKey);
  const suffix = page && page > 1 ? `-p${page}` : "";
  let found = "";
  for (const dir of [PDF_DIR, path.join(PDF_DIR, "Production")]) {
    const f = path.join(dir, `${base}${suffix}.pdf`);
    if (fs.existsSync(f)) {
      // path.relative gives "x.pdf" for a root set and "Production/x.pdf" for a
      // batch one, so the separator belongs here rather than on either branch.
      const rel = path.relative(PDF_DIR, f).split(path.sep).join("/");
      found = `../Independent Citation Record/Exhibits/PDFs/${rel}`;
      break;
    }
  }
  pdfCache.set(cacheKey, found);
  return found;
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

// The sheet a reviewer writes decisions into. It is dated, so it is discovered
// rather than assumed: naming a file that was never written sends the reader
// looking for a sheet that does not exist. The current snapshot's sheet wins;
// otherwise the newest one, since an undated decision list is worse than none.
function reviewSheet() {
  const dir = path.join(ROOT, "Drafts");
  const files = fs.existsSync(dir)
    ? fs
        .readdirSync(dir)
        .filter((f) => /^review-queue-\d{4}-\d{2}-\d{2}\.csv$/.test(f))
        .sort()
    : [];
  if (!files.length) {
    return "Drafts/review-queue-<snapshot>.csv -- not written yet, run node tools/build-review-sheet.js";
  }
  const wanted = files.find((f) => f === `review-queue-${g.snapshot_date}.csv`);
  return `Drafts/${wanted || files[files.length - 1]}`;
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

// The rows that make up the current record. A row retired by a re-capture is
// history and must not appear on the dashboard, or a count there would exceed
// the packet it is meant to mirror.
const ACTIVE = "c.filed = 1 AND c.superseded_at = ''";

if (meta.schema_version && Number(meta.schema_version) < 4) {
  throw new Error(
    `The catalog is at schema v${meta.schema_version}; the dashboard needs v4, which ` +
      `is where row_uid and superseded_at live. Run: node tools/build-catalog.js --write`
  );
}

if (meta.snapshot_date !== g.snapshot_date) {
  throw new Error(
    `The ledger describes ${g.snapshot_date} but the catalog describes ` +
      `${meta.snapshot_date}. Rebuild the catalog so the dashboard shows one snapshot.`
  );
}

// ---- guard: the store and the derived ledger must agree on the headline figures ----
const dbTotals = q(`SELECT
    SUM(CASE WHEN ${ACTIVE} THEN 1 ELSE 0 END) AS records,
    SUM(CASE WHEN ${ACTIVE} AND is_countable_independent=1 THEN 1 ELSE 0 END) AS independent,
    SUM(CASE WHEN ${ACTIVE} AND is_primary_copy=1 THEN 1 ELSE 0 END) AS unique_records,
    SUM(CASE WHEN ${ACTIVE} AND is_primary_copy=1 AND is_countable_independent=1 THEN 1 ELSE 0 END) AS unique_independent
  FROM citations c`)[0];
const guards = [
  ["citation records", dbTotals.records, g.citation_records_reviewed],
  ["independent", dbTotals.independent, g.independent_countable],
  ["distinct papers", dbTotals.unique_records, g.unique_papers_citing],
  ["distinct independent", dbTotals.unique_independent, g.independent_unique_papers],
];
for (const [name, dbv, ledv] of guards) {
  if (Number(dbv) !== Number(ledv)) {
    throw new Error(
      `Refusing to write: ${name} is ${dbv} in the store and ${ledv} in the derived ` +
        `ledger. That is a defect, not a choice of source: reconcile it before ` +
        `publishing a dashboard, and quote no figure until it is resolved.`
    );
  }
  log(`ok  ${name.padEnd(20)} ${ledv}`);
}

// ---- per-article rows: copied from the ledger, enriched with catalog detail ----
const pubDetail = q(`SELECT
    p.cites_id, p.authors AS cited_authors, p.paper_url, p.cites_url,
    p.exhibit_base,
    (SELECT COUNT(*) FROM citations c WHERE c.cites_id=p.cites_id AND ${ACTIVE}
       AND c.work_type IN ('patent','patent-application')) AS patent_rows,
    (SELECT COUNT(*) FROM citations c WHERE c.cites_id=p.cites_id AND ${ACTIVE}
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
    non_english_independent: Number(r.non_english_independent),
    unique_independent: Number(r.unique_independent),
    dependent: Number(r.dependent),
    self_pi: Number(r.self_pi),
    self_former_pi: Number(r.self_former_pi),
    review: Number(r.review),
    // The actionable queue, kept apart from the raw REVIEW count so the table's
    // numeric columns partition the records exactly: with the non-English rows in
    // their own column, showing every REVIEW row would count the five
    // non-English ones twice.
    review_queue: Number(r.review_queue || 0),
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
    c.row_uid, c.patent_number, c.patent_kind, c.work_type, c.title, c.authors,
    c.status, c.confirm_state, c.is_countable_independent, c.link,
    c.cid, c.cites_id, p.title AS cited_title, p.year AS cited_year,
    c.base, c.page
  FROM citations c
  LEFT JOIN publications p ON p.cites_id = c.cites_id
  WHERE ${ACTIVE} AND c.work_type IN ('patent','patent-application')
  ORDER BY c.is_countable_independent DESC, c.patent_number, c.title`).map((r) => ({
  row_uid: r.row_uid,
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
//
// A year is also refused when it is impossible rather than unreadable: a citing
// work cannot predate the paper it cites. Found 2026-11-03 when the chart showed
// a 2003 bar although the earliest publication in the packet is 2011. The row
// behind it (cit-000036, "Anticoagulants", DOI 10.1002/0471266949.bmc182.pub2)
// is a reference-work chapter whose Scholar byline carries the date of the
// parent work — Scholar itself renders "2003", so this is not a capture
// artifact, and Crossref dates the chapter 2021-04-26. The citation is real and
// stays counted and highlighted on its exhibit; only its date is unusable, so
// the row leaves the year chart and is reported by name in `year_anomalies`
// rather than silently dropped. Nothing here changes a counting rule or an
// exhibit mark: deleting a counted citation is a filing decision, not a chart
// cleanup.
const yearRows = q(`SELECT c.row_uid, c.title, c.authors, c.base, c.page,
    c.is_countable_independent AS ind, p.year AS cited_year
  FROM citations c
  LEFT JOIN publications p ON p.cites_id = c.cites_id
  WHERE ${ACTIVE}`);
const byYear = new Map();
const yearAnomalies = [];
const thisYear = new Date().getFullYear();
for (const r of yearRows) {
  // Take the last 4-digit year in the byline: "X Author - Journal, 2014 - site".
  const matches = String(r.authors || "").match(/\b(19|20)\d{2}\b/g) || [];
  const year = matches.length ? Number(matches[matches.length - 1]) : null;
  const readable = year && year >= 1990 && year <= thisYear + 1;
  // Only a known cited year can rule a date out. An empty cited_year is
  // unknown, not evidence, and must never exclude a row.
  const impossible =
    readable && r.cited_year && Number(r.cited_year) > 0 && year < Number(r.cited_year);
  if (impossible) {
    yearAnomalies.push({
      row_uid: r.row_uid,
      title: r.title,
      citing_year: year,
      cited_year: Number(r.cited_year),
      byline: r.authors,
      counted: r.ind === 1,
      exhibit_base: r.base,
      exhibit_page: r.page,
    });
    continue;
  }
  const key = readable ? year : null;
  const slot = byYear.get(key) || { year: key, records: 0, independent: 0 };
  slot.records += 1;
  if (r.ind === 1) slot.independent += 1;
  byYear.set(key, slot);
}
yearAnomalies.sort((a, b) => a.citing_year - b.citing_year || a.row_uid.localeCompare(b.row_uid));
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
  WHERE ${ACTIVE} AND c.is_countable_independent = 1
  GROUP BY c.confirm_state, c.author_source`).map((r) => ({
  confirm_state: r.confirm_state,
  author_source: r.author_source,
  count: r.n,
}));
const corroborationDistinct = q(`SELECT
    c.confirm_state, COUNT(*) AS n
  FROM citations c
  WHERE ${ACTIVE} AND c.is_countable_independent = 1 AND c.is_primary_copy = 1
  GROUP BY c.confirm_state`).map((r) => ({
  confirm_state: r.confirm_state,
  count: r.n,
}));

// ---- every distinct citing work, marked or not, for the scrolling list ----
// No LIMIT and no status filter: the user asked for the entire dataset to be
// visualisable, and a list of only the highlighted rows would make the
// dependent and unresolved side invisible. `marked` carries the exhibit's own
// decision so the dashboard can never disagree with the PDF. row_uid is the
// handle for a row: quote it, not the integer id, which is a frozen legacy alias.
const allWorks = q(`SELECT
    c.row_uid, c.title, c.authors, c.status, c.confirm_state, c.external_source,
    c.external_url, c.link, c.work_type, c.cites_id, p.title AS cited_title,
    p.year AS cited_year, c.base, c.page, c.cid,
    c.is_countable_independent AS marked, c.language_flag, c.attention_reason,
    c.external_match_credible,
    p.cited_by_at_snapshot AS cited_by
  FROM citations c
  LEFT JOIN publications p ON p.cites_id = c.cites_id
  WHERE ${ACTIVE} AND c.is_primary_copy = 1
  ORDER BY p.cited_by_at_snapshot DESC, c.title`).map((r) => ({
  row_uid: r.row_uid,
  title: r.title,
  byline: r.authors,
  status: r.status,
  marked: r.marked === 1,
  confirm_state: r.confirm_state,
  language_flag: r.language_flag || "",
  attention_reason: r.attention_reason || "",
  external_source: r.external_source,
  external_url: externalUrl(r),
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

// ---- the review queue: citations whose independence is still unresolved ----
// Read from v_review, the same view tools/query-catalog.js prints, so the
// dashboard, the query tool and a decision sheet all name the same rows in the
// same three buckets. The user works through these by row_uid; a decision on one
// changes the totals, so nothing here infers an answer.
//
// Since 2026-11-03 the view itself excludes non-English rows, so every row here
// is one a decision can actually settle. Earlier the queue held them and the page
// had to explain, row by row, which five were not worth reading; that per-row
// split (review_also_non_english) is gone from the published data entirely, since
// a queue that excludes them at the source makes it always zero. The non-English
// rows are published once, in language_held, and listed on the Non-English page.
const reviewQueue = q(`SELECT
    row_uid, bucket, cites_id, cited_work, cited_venue, cited_year, cid, title,
    scholar_byline, truncated, confirm_state, why, external_source, external_url,
    external_authors, external_matched, matched_authors, external_match_credible,
    language_flag, link, base, page, row_index
  FROM v_review`).map((r) => ({
  row_uid: r.row_uid,
  bucket: r.bucket,
  cites_id: r.cites_id,
  cited_work: r.cited_work,
  cited_venue: r.cited_venue,
  cited_year: r.cited_year,
  cid: r.cid,
  title: r.title,
  scholar_byline: r.scholar_byline,
  // Scholar ended the byline with an ellipsis, which is the whole reason the row
  // is unresolved: the list it shows cannot prove a shared author absent.
  byline_truncated: r.truncated === 1,
  confirm_state: r.confirm_state,
  why: r.why,
  external_source: r.external_source,
  external_url: externalUrl(r),
  external_authors: r.external_authors,
  // False when the stored record was discarded because its title overlap is too
  // thin to be the same work. The record stays on the row as the audit trail of
  // that rejection, so the page must not present it as a source to check -- the
  // External column would otherwise link an "unresolvable" row to a paper it is
  // not (cit-001476, a swine-lung article).
  external_match_credible: r.external_match_credible !== 0,
  // The names an external record matched against the PI's. Two columns hold
  // that idea and only the corroboration one is populated on a contradicted
  // row, so take whichever has names -- an empty overlap beside
  // confirm_state "contradicted" would contradict itself.
  external_overlap: [r.external_matched, r.matched_authors]
    .map((v) => { try { const p = JSON.parse(v); return Array.isArray(p) ? p : []; } catch { return []; } })
    .find((a) => a.length) || [],
  language_flag: r.language_flag,
  link: r.link,
  exhibit_base: r.base,
  exhibit_page: r.page,
  exhibit_row: r.row_index,
  exhibit_pdf: exhibitPdf(r.base, r.page),
  // Left empty on purpose: this is where a human decision lands later, and it
  // must never be pre-filled by an inference.
  decision: "",
}));
const reviewBuckets = reviewQueue.reduce((acc, r) => {
  acc[r.bucket] = (acc[r.bucket] || 0) + 1;
  return acc;
}, {});
// v_review no longer admits a non-English row, so this filter is expected to
// return nothing. It is computed rather than assumed: if a future view edit lets
// a flagged row back in, the log line below says so, instead of the page quietly
// presenting an unactionable row as work.
const reviewLanguage = reviewQueue.filter((r) => r.language_flag);
log(
  `Review queue: ${reviewQueue.length} unresolved citation(s) -- ` +
    Object.entries(reviewBuckets)
      .sort()
      .map(([k, v]) => `${v} ${k.replace(/^\d+ /, "")}`)
      .join(", ") +
    // Only printed when the invariant breaks, so the normal line stays short.
    (reviewLanguage.length
      ? `; WARNING ${reviewLanguage.length} of them is/are also flagged non-English ` +
        `and cannot be settled (no translations are being obtained) -- v_review is ` +
        `admitting rows tally.isReviewQueue excludes`
      : "")
);
// The ledger keeps both figures: awaiting_review is every row whose status is
// REVIEW, review_queue is the actionable subset the view and this page show.
// Checking the queue against the raw status count would fail on the five
// non-English rows the user asked to move out of the queue on 2026-11-03.
if (Number(g.review_queue ?? g.awaiting_review) !== reviewQueue.length) {
  throw new Error(
    `The ledger says ${g.review_queue ?? g.awaiting_review} citations await a decision ` +
      `and the store's v_review says ${reviewQueue.length}. Rebuild both; do not publish a ` +
      `dashboard over a disagreement.`
  );
}

// ---- independent-but-unsettled: the ENGLISH open rows only ----
// tally.isIndependentPending is "classified INDEPENDENT, not highlighted, and
// NOT flagged non-English". Per the user's instruction on 2026-11-03 the
// language screen supersedes the independence classification: a non-English row
// is reported once, under the non-English bucket below, and never here -- with no
// certified translations being obtained (decision of 2026-11-01) no reading of
// its byline can change the packet, so it is a closed matter, not open work.
//
// The query mirrors that exactly with `is_non_english = 0`, so this list cannot
// re-admit a language row that the ledger already filed elsewhere.
const pendingRows = q(`SELECT
    c.row_uid, c.title, COALESCE(NULLIF(c.authors_used,''), c.authors) AS byline,
    c.status, c.confirm_state, c.language_flag, c.withheld_for_language,
    c.duplicate_of, c.edition_key,
    c.attention_reason, c.external_source, c.external_url, c.link,
    c.external_match_credible,
    p.title AS cited_title, p.year AS cited_year, c.cites_id,
    c.patent_number, c.work_type, c.base, c.page, c.row_index, c.cid
  FROM citations c
  LEFT JOIN publications p ON p.cites_id = c.cites_id
  WHERE ${ACTIVE} AND c.status = 'INDEPENDENT' AND c.is_highlighted = 0
    AND c.is_non_english = 0
  ORDER BY p.title, c.page, c.row_index`);

const mapPending = (r) => ({
  row_uid: r.row_uid,
  title: r.title,
  byline: r.byline,
  status: r.status,
  confirm_state: r.confirm_state,
  language_flag: r.language_flag || "",
  reason: r.attention_reason || "",
  external_source: r.external_source || "",
  external_url: externalUrl(r),
  link: r.link || "",
  cited_title: r.cited_title,
  cited_year: r.cited_year,
  cites_id: r.cites_id,
  patent_number: r.patent_number || "",
  work_type: r.work_type,
  exhibit_base: r.base,
  exhibit_page: r.page,
  exhibit_row: r.row_index,
  exhibit_pdf: exhibitPdf(r.base, r.page),
  cid: r.cid,
});

// Every row the query returns is genuinely open author work: English, classified
// independent, not highlighted, and held by neither the language screen nor a
// same-work fold. On the 2026-11-03 store this is empty, and that is the honest
// result rather than a broken query -- every independently-classified English row
// has already been settled, and the 45 non-English rows that used to appear here
// now live only in `language_held` below. The guard further down fails loudly if
// a future capture produces a genuinely open row, so the review page cannot
// silently omit one.
const unsettledRows = pendingRows.map(mapPending);

// The closed half, from v_non_english so the reason and the "would count"
// judgement come from the same place the audit reads. Deliberately NOT part of
// the review queue: these are listed so the packet can state honestly what was
// given up, not so someone re-opens them.
const languageHeld = q(`SELECT
    row_uid, cites_id, cited_work, cid, title, authors AS byline, link, reason,
    status, confirm_state, would_count, language_edition, work_type,
    base, page, row_index
  FROM v_non_english
  WHERE filed = 1 AND superseded_at = ''
  ORDER BY would_count DESC, cited_work, page, row_index`).map((r) => ({
  row_uid: r.row_uid,
  cites_id: r.cites_id,
  cited_title: r.cited_work,
  cid: r.cid,
  title: r.title,
  byline: r.byline,
  link: r.link || "",
  reason: r.reason || "",
  status: r.status,
  confirm_state: r.confirm_state,
  would_count: r.would_count === 1,
  language_edition: r.language_edition === 1,
  work_type: r.work_type,
  exhibit_base: r.base,
  exhibit_page: r.page,
  exhibit_row: r.row_index,
  exhibit_pdf: exhibitPdf(r.base, r.page),
}));

// The open list must equal the ledger's figure exactly, or the review page would
// show a different set than the packet counts. Because both now exclude
// non-English rows, a language row cannot leak into (or vanish from) this bucket.
if (unsettledRows.length !== Number(g.independent_pending)) {
  throw new Error(
    `The store holds ${unsettledRows.length} English independent-but-unhighlighted ` +
      `rows and the ledger reports independent_pending = ${g.independent_pending}. ` +
      `Rebuild both; publish neither figure until they agree.`
  );
}
// The Non-English listing must be the whole flagged set, so collapsing the
// unsettled bucket into it cannot drop a row. v_non_english is keyed on
// is_non_english, the same column the ledger's flagged_non_english counts.
if (languageHeld.length !== Number(g.flagged_non_english)) {
  throw new Error(
    `The Non-English listing holds ${languageHeld.length} rows but the ledger flags ` +
      `${g.flagged_non_english} as non-English. The two must be the same set now ` +
      `that language supersedes independence; rebuild both before publishing.`
  );
}
log(
  `Not counted as independent: ${unsettledRows.length} English open rows, ` +
    `${languageHeld.length} non-English (reported once, on the language page)`
);

// ---- unresolved items, so the dashboard does not overstate certainty ----
const openItems = q(`SELECT
    c.status, c.attention_reason, COUNT(*) AS n
  FROM citations c WHERE ${ACTIVE} AND c.needs_attention = 1
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
    // The dated sheet the reviewer writes decisions into. Named here so the
    // review page points at the file that actually exists instead of a
    // placeholder the reader has to guess at.
    review_sheet: reviewSheet(),
    note:
      "Database/citation-catalog.sqlite is the primary store; the dated ledger written by " +
      "tools/build-ledger.js is a derived report of the same rows, and the headline " +
      "figures here are that report's global block. The two were checked against each " +
      "other when this file was written and agreed. Rows are the active set (filed and " +
      "not superseded). Quote row_uid to refer to a row -- it never changes. This file is " +
      "generated; regenerate it rather than editing it.",
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
    // The independent-classified rows the language screen supersedes (2026-11-03).
    // Published so the waffle can draw them as their own bucket and the open-work
    // figure can state plainly that it excludes them.
    non_english_independent: g.non_english_independent,
    dependent: g.dependent,
    self_pi: g.self_pi,
    self_former_pi: g.self_former_pi,
    awaiting_review: g.awaiting_review,
    // The actionable queue, which is what the Review page lists. Kept apart from
    // awaiting_review (every row whose status is REVIEW) so the status partition
    // still sums while the queue length means the same thing everywhere.
    review_queue: g.review_queue,
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
  // Byline dates that cannot be right, named rather than quietly omitted. See
  // the year block above.
  year_anomalies: yearAnomalies,
  corroboration,
  corroboration_distinct: corroborationDistinct,
  works: allWorks,
  review_queue: reviewQueue,
  review_buckets: reviewBuckets,
  // No review_actionable / review_also_non_english split any more. Since
  // 2026-11-03 the queue excludes non-English rows at the source, so every row
  // published here is actionable and a split would only restate that; the
  // non-English rows are published once, in language_held.
  unsettled_rows: unsettledRows,
  language_held: languageHeld,
  open_items: openItems,
};

if (CHECK) {
  log(`--check: ${articles.length} articles, ${patents.length} patents, ` +
    `${years.length} years, ${allWorks.length} distinct citing works ` +
    `(${allWorks.filter((w) => w.marked).length} marked), ` +
    `${reviewQueue.length} in the review queue, ${unsettledRows.length} unsettled, ` +
    `${languageHeld.length} held for language, ` +
    `${yearAnomalies.length} impossible byline dates. Nothing written.`);
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

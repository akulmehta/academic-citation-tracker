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
const { TOPICS, FAMILY } = require("./topics.js");

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

// ---- the third basis, which the two above are routinely mistaken for ----
//
// `unique_papers_citing` and `independent_unique_papers` have always been
// per-CITATION counts, not paper counts: applyPrimaryCopy in
// tools/build-catalog.js partitions by `cites_id`, so a citing paper that cites
// two of the PI's works keeps one standing row under each, and contributes two.
// That is the correct basis for a packet built on citations, and it is what the
// ledger's bucket_independent reports -- but the column names say "papers", and
// every label downstream inherited the word, so a reader could only conclude the
// packet was collapsing a two-work paper to one and losing a citation.
//
// Measured on the store's own identity (a hand-proved same_work_key where a
// person recorded one, else the ledger's normalised work_key -- never a
// dashboard title, which has Scholar's [CITATION] markers stripped):
//
//   1,094  rows carrying a yellow mark on a filed exhibit page
//   1,077  ...of which stand for their work against the paper they cite
//     917  distinct papers among those
//
// The 17 between the first two are Google Scholar listing the same paper twice
// against the SAME cited work, which is not a second citation; the 160 between
// the last two are one paper cited by two or more of the PI's works, which IS a
// second citation. Those two gaps point in opposite directions and must never be
// described by the same word, so the real paper counts are published here rather
// than left for a caption to gesture at.
const distinctPapers = (where) =>
  q(`SELECT COUNT(*) AS n FROM (
       SELECT DISTINCT COALESCE(NULLIF(c.same_work_key,''), c.work_key) AS k
         FROM citations c
        WHERE ${ACTIVE} AND c.is_primary_copy = 1
          AND (c.duplicate_of = '' OR c.duplicate_of IS NULL) ${where}
     )`)[0].n;
const STANDALONE_ENGLISH =
  "AND (c.language_flag = '' OR c.language_flag IS NULL)";
const STANDALONE_INDEP = "AND c.is_countable_independent = 1";
const basis = {
  // Distinct works, globally, collapsing a paper cited by several PI works to one.
  distinct_citing_papers: distinctPapers(""),
  distinct_independent_papers: distinctPapers(STANDALONE_INDEP),
  distinct_independent_papers_english: distinctPapers(
    `${STANDALONE_ENGLISH} ${STANDALONE_INDEP}`
  ),
  distinct_citing_papers_english: distinctPapers(STANDALONE_ENGLISH),
};
log(
  `basis distinct papers:    ${basis.distinct_citing_papers} citing / ` +
    `${basis.distinct_independent_papers} independent ` +
    `(against ${g.unique_papers_citing} / ${g.independent_unique_papers} citations)`
);
// A distinct-paper total can never exceed the citation total it collapses: the
// two are equal only when no paper cites more than one of the PI's works.
if (basis.distinct_independent_papers > g.independent_unique_papers) {
  throw new Error(
    `Distinct independent papers (${basis.distinct_independent_papers}) exceeds the ` +
      `independent citation count (${g.independent_unique_papers}). A paper cannot ` +
      `count as more works than it is cited by — check the identity columns.`
  );
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
    // Same five categories as the waffle, per publication, so a bar's segments
    // add up to its record count and mean the same thing the waffle says they
    // mean. Read straight from the ledger row -- recomputing them here from the
    // status columns is how the two charts would drift apart.
    bucket_independent: Number(r.bucket_independent),
    bucket_dependent: Number(r.bucket_dependent),
    bucket_review: Number(r.bucket_review),
    bucket_non_english: Number(r.bucket_non_english),
    bucket_preprint_copy: Number(r.bucket_preprint_copy),
    bucket_pending: Number(r.bucket_pending),
    bucket_other: Number(r.bucket_other),
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

// ---- every citing row on a filed exhibit page, marked or not ----
// No LIMIT and no status filter: the user asked for the entire dataset to be
// visualisable, and a list of only the highlighted rows would make the
// dependent and unresolved side invisible. `marked` carries the exhibit's own
// decision so the dashboard can never disagree with the PDF. row_uid is the
// handle for a row: quote it, not the integer id, which is a frozen legacy alias.
//
// This list used to carry only the copy that stands for each work
// (`is_primary_copy = 1`), which made it a list of distinct PAPERS. That was
// wrong for a page titled "every citing work ON THE EXHIBIT PAGES": a row the
// exhibit prints, and in many cases highlights, was simply absent and could not
// be searched for. Found 2026-11-03 when the user could not find cit-000220 --
// a second Scholar listing of the JACS Au article cit-000187, same DOI, marked
// yellow on exhibit page 5, and invisible here. The preprint/copy appendix on
// the main page named it, but that is a different page and a reviewer following
// a row off a PDF has no reason to go looking there.
//
// So the filter is gone and every active row appears, with `stands_for_row_uid`
// and `duplicate_kind` carried so the renderer can say which rows are one work.
// No counted figure comes from this list -- the headline guards above read their
// own aggregate queries, and the ledger is still the source a filing quotes --
// so widening it cannot move a packet number. It is a listing, and a listing
// that hides rows the exhibit shows is the defect.
const allWorks = q(`SELECT
    c.row_uid, c.title, c.authors, c.status, c.confirm_state, c.external_source,
    c.external_url, c.link, c.work_type, c.cites_id, p.title AS cited_title,
    p.year AS cited_year, c.base, c.page, c.cid,
    c.is_countable_independent AS marked, c.language_flag, c.attention_reason,
    c.external_match_credible, c.is_primary_copy, c.duplicate_kind,
    c.duplicate_of, c.inherited_status, c.stands_for_row_uid,
    p.cited_by_at_snapshot AS cited_by,
    -- The row that stands for this work, found the way tally.uniquePapers groups
    -- it: same_work_key when a person proved one, otherwise the normalised title.
    -- Same correlated lookup the preprint/copy listing uses, so the two pages
    -- cannot name different anchors for the same copy.
    (SELECT o.row_uid FROM citations o
      WHERE o.filed = 1 AND o.superseded_at = ''
        AND o.cites_id = c.cites_id
        AND COALESCE(NULLIF(o.same_work_key,''), o.work_key)
          = COALESCE(NULLIF(c.same_work_key,''), c.work_key)
        AND o.is_primary_copy = 1 AND o.duplicate_of = ''
      ORDER BY o.page, o.row_index LIMIT 1) AS stands_uid
  FROM citations c
  LEFT JOIN publications p ON p.cites_id = c.cites_id
  WHERE ${ACTIVE}
  ORDER BY p.cited_by_at_snapshot DESC, c.title, c.page, c.row_index`).map((r) => ({
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
  // A row is a copy when it does not stand for its work, or when a recorded fold
  // points elsewhere. This is deliberately the same predicate the preprint/copy
  // listing below uses (`is_primary_copy = 0 OR duplicate_of <> ''`) rather than
  // `is_primary_copy = 0` alone: three German language-edition rows are the
  // primary copy on their own page yet carry a duplicate_of pointing at the
  // English copy that stands, so a narrower test would label them as standing
  // work here while the copy appendix lists them as copies.
  is_copy: r.is_primary_copy === 0 || !!r.duplicate_of,
  duplicate_kind: r.duplicate_kind || "",
  inherited_status: r.inherited_status || "",
  stands_for_row_uid: r.stands_uid || r.stands_for_row_uid || "",
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

// ---- the preprint / copy listing ----
//
// Google Scholar lists some papers twice on one citing page: a journal record and
// its bioRxiv, institutional-repository, academia.edu, ProQuest or Ovid copy. The
// exhibit must show both rows because that is the page that was printed, but the
// packet credits the work once -- otherwise a preprint whose published article is
// already counted would be claimed a second time.
//
// This listing names every row that does not stand for its work, and the row that
// does, so a reviewer holding a two-sheet PDF can see why one row is counted and
// the other is not. It is the fifth bucket on the waffle.
//
// `stands_for` is resolved here rather than read from stands_for_row_uid, which
// build-catalog.js only fills for rows carrying duplicate_of -- that is, the
// language editions and the same-work folds a person proved. A machine-detected
// copy has no duplicate_of, so its anchor is found the same way uniquePapers
// found it: the sibling on the same citing list with the same work key that was
// not deferred.
const copyRows = q(`SELECT
    c.row_uid, c.cites_id, c.cid, c.title,
    COALESCE(NULLIF(c.authors_used,''), c.authors) AS byline,
    c.link, c.work_key, c.duplicate_kind, c.duplicate_of, c.patent_number,
    c.work_type, c.status, c.confirm_state, c.is_highlighted,
    c.inherited_status, c.inherited_confirm_state, c.stands_for_row_uid,
    p.title AS cited_title, p.year AS cited_year,
    c.base, c.page, c.row_index,
    -- The copy that stands for this work, found the way uniquePapers groups it:
    -- same_work_key when a person proved one, otherwise the normalised title.
    -- Matching on work_key alone cannot find cit-000108 from cit-000132, because
    -- the fold that links them was proven by hand across DIFFERENT titles (a
    -- bioRxiv preprint and the article it became), so the two rows carry different
    -- work_key values and only same_work_key joins them.
    (SELECT o.row_uid FROM citations o
      WHERE o.filed = 1 AND o.superseded_at = ''
        AND o.cites_id = c.cites_id
        AND COALESCE(NULLIF(o.same_work_key,''), o.work_key)
          = COALESCE(NULLIF(c.same_work_key,''), c.work_key)
        AND o.is_primary_copy = 1 AND o.duplicate_of = ''
      ORDER BY o.page, o.row_index LIMIT 1) AS stands_uid,
    (SELECT o.title FROM citations o
      WHERE o.filed = 1 AND o.superseded_at = ''
        AND o.cites_id = c.cites_id
        AND COALESCE(NULLIF(o.same_work_key,''), o.work_key)
          = COALESCE(NULLIF(c.same_work_key,''), c.work_key)
        AND o.is_primary_copy = 1 AND o.duplicate_of = ''
      ORDER BY o.page, o.row_index LIMIT 1) AS stands_title,
    (SELECT o.link FROM citations o
      WHERE o.filed = 1 AND o.superseded_at = ''
        AND o.cites_id = c.cites_id
        AND COALESCE(NULLIF(o.same_work_key,''), o.work_key)
          = COALESCE(NULLIF(c.same_work_key,''), c.work_key)
        AND o.is_primary_copy = 1 AND o.duplicate_of = ''
      ORDER BY o.page, o.row_index LIMIT 1) AS stands_link
  FROM citations c
  LEFT JOIN publications p ON p.cites_id = c.cites_id
  WHERE ${ACTIVE} AND c.is_non_english = 0
    -- Mirrors the copy term of bucketOf in tools/tally.js exactly: a row that does
    -- not stand for its work (is_primary_copy = 0, or a recorded duplicate_of fold),
    -- MINUS a row still genuinely open on the queue. A REVIEW row is only excluded
    -- when it has NOTHING to inherit (inherited_status = ''); a REVIEW row that IS
    -- a settled copy -- cit-000132, cit-000144, both copies of the INDEPENDENT
    -- cit-000108 -- belongs here, per the instruction of 2026-11-03. The guard
    -- below compares this listing against bucket_preprint_copy, so the two clauses
    -- are the same rule and must be edited together.
    AND NOT (c.status = 'REVIEW' AND c.inherited_status = '')
    AND (c.is_primary_copy = 0 OR c.duplicate_of <> '')
  ORDER BY p.title, c.page, c.row_index`);

// Which kind of second listing, in words a reviewer can read without knowing the
// pipeline. Ordered most-specific first: a proven same-work fold or a patent
// family is a stronger claim than a host-name guess, and the reason shown should
// be the one that actually decided it.
function copyReason(r) {
  if (r.duplicate_kind === "same-work") {
    return "Same work under a different title, proven and recorded by hand";
  }
  if (r.patent_number) {
    return "Another document in the same patent family (same title, different number)";
  }
  const url = String(r.link || "");
  const host = (re) => re.test(url);
  if (/biorxiv|medrxiv|chemrxiv|researchsquare/.test(url)) {
    return "Preprint of the published article";
  }
  if (/academia\.edu|researchgate/.test(url)) {
    return "Author-uploaded copy of the published article";
  }
  if (/handle\.|dspace|scholarlypublications|scientiasalut|scholarscompass|salilab|repository|etd\b|proquest/.test(url)) {
    return "Repository or thesis copy of the published article";
  }
  if (/ovid|scitepress|ebsco|gencat|digital\.csic/.test(url)) {
    return "Database or aggregator copy of the published article";
  }
  if (!url) return "Second Google Scholar entry for the same record (no link)";
  return "Second listing of the same work on this citing page";
}

const preprintCopies = copyRows.map((r) => ({
  row_uid: r.row_uid,
  cites_id: r.cites_id,
  cited_title: r.cited_title,
  cited_year: r.cited_year,
  title: r.title,
  byline: r.byline,
  link: r.link || "",
  reason: copyReason(r),
  duplicate_kind: r.duplicate_kind || "",
  patent_number: r.patent_number || "",
  work_type: r.work_type,
  // Whether this row is nevertheless marked yellow on the exhibit. It usually is:
  // the exhibit is a picture of Scholar's page and both rows are printed, so the
  // mark and the count differ by design. Saying so here is what lets a reviewer
  // reconcile 1077 marks with 1059 counted works.
  marked: r.is_highlighted === 1,
  // The verdict this row takes from the copy that stands for its work, and the
  // basis of that verdict. Empty when the row's own classification already stands.
  // A REVIEW row here is the case the user asked for on 2026-11-03: its own byline
  // was unresolved, so the row reads as its parent's category rather than as work
  // still awaiting a decision.
  inherited_status: r.inherited_status || "",
  inherited_confirm_state: r.inherited_confirm_state || "",
  // The row's own classification, needed alongside the inherited one: a copy can
  // be settled on its own reading, and a listing that showed only the inherited
  // field would have to imply those were open review rows. They are not.
  status: r.status || "",
  confirm_state: r.confirm_state || "",
  stands_for_row_uid: r.stands_uid || r.stands_for_row_uid || "",
  stands_for_title: r.stands_title || "",
  stands_for_link: r.stands_link || "",
  exhibit_base: r.base,
  exhibit_page: r.page,
  exhibit_row: r.row_index,
  exhibit_pdf: exhibitPdf(r.base, r.page),
  cid: r.cid,
}));

// The listing must be the fifth bucket exactly, or the waffle square count and
// the page that explains it would disagree.
if (preprintCopies.length !== Number(g.bucket_preprint_copy)) {
  throw new Error(
    `The preprint/copy listing holds ${preprintCopies.length} rows but the ledger's ` +
      `fifth bucket is ${g.bucket_preprint_copy}. The listing's WHERE clause and ` +
      `bucketOf in tools/tally.js must be the same rule; rebuild both before ` +
      `publishing either.`
  );
}

// The invariant the user asked for on 2026-11-03: a row the exhibit prints must
// be findable on the citing-work page. The preprint/copy appendix names rows
// deliberately left out of the distinct-paper count, and before this they were
// left out of that listing too -- which is how cit-000220, marked yellow on
// exhibit page 5, became impossible to search for. Every copy named anywhere has
// to be present there. Checked here rather than next to allWorks because it
// needs both lists.
{
  const listed = new Set(allWorks.map((w) => w.row_uid));
  const missing = preprintCopies.filter((c) => !listed.has(c.row_uid));
  if (missing.length) {
    throw new Error(
      `The citing-work listing omits ${missing.length} row(s) the preprint/copy ` +
        `appendix names: ${missing.map((m) => m.row_uid).join(", ")}. Every row ` +
        `on an exhibit page has to be findable on that page.`
    );
  }
  // And the flag has to agree with the appendix, or a row would read as standing
  // work on one page and as a copy on the other.
  const disagree = preprintCopies.filter((c) => {
    const w = allWorks.find((x) => x.row_uid === c.row_uid);
    return w && !w.is_copy;
  });
  if (disagree.length) {
    throw new Error(
      `${disagree.length} row(s) are listed as a copy in the appendix but not ` +
        `flagged as one on the citing-work page: ${disagree
          .map((d) => d.row_uid)
          .join(", ")}. The two use the same predicate and must say the same thing.`
    );
  }
}
log(
  `Preprint/copy bucket: ${preprintCopies.length} rows that do not stand for their ` +
    `work (${preprintCopies.filter((r) => r.marked).length} of them still marked on the exhibit)`
);

// =====================================================================
// The two network figures: which of the PI's publications an independent
// citing work attaches to, and which publications the literature cites
// together.
//
// Both are built from the SAME set of rows, and that set is the packet's own:
//
//     is_countable_independent = 1 AND is_primary_copy = 1 AND duplicate_of = ''
//
// which is `tally.bucketOf` returning "independent" — the 1,077 counted
// independent citations. Not every highlighted row: a second listing of a work
// already counted is marked on the exhibit but contributes nothing, so drawing
// it would put 17 dots on a diagram that claims to show counted citations. A
// node here therefore means the same thing as a yellow square in the waffle.
//
// One citing WORK can appear on the cited-by page of two of the PI's papers. It
// is one node with two links, which is exactly what makes the co-citation figure
// worth drawing: an edge means a real, independent paper treated two of these
// publications as one conversation.
// =====================================================================
const graphRows = q(`SELECT
    c.row_uid, c.work_key, c.title, c.authors, c.link, c.cites_id,
    COALESCE(NULLIF(c.same_work_key,''), c.work_key) AS ident,
    p.title AS cited_title, p.year AS cited_year,
    c.base, c.page
  FROM citations c
  LEFT JOIN publications p ON p.cites_id = c.cites_id
  WHERE ${ACTIVE} AND c.is_countable_independent = 1
    AND c.is_primary_copy = 1 AND c.duplicate_of = ''
    AND c.cites_id IS NOT NULL AND c.cites_id <> ''
  ORDER BY c.cites_id, c.title`).map((r) => ({
  row_uid: r.row_uid,
  // `ident` is the identity the ledger itself uses for a work: a hand-proved
  // same-work key when a person recorded one, otherwise the normalised title.
  // Using anything looser here would invent links the packet does not count.
  ident: r.ident,
  title: r.title,
  byline: r.authors,
  link: r.link,
  cites_id: r.cites_id,
  cited_title: r.cited_title,
  cited_year: r.cited_year,
  // The citing work's own year, parsed by the same rule the year chart uses: the
  // last four-digit year in Scholar's byline. Kept so a citing node's tooltip can
  // name a date rather than leave the reader with a bare title.
  year: (() => {
    const m = String(r.authors || "").match(/\b(19|20)\d{2}\b/g) || [];
    const y = m.length ? Number(m[m.length - 1]) : null;
    return y && y >= 1990 && y <= thisYear + 1 ? y : null;
  })(),
  exhibit_base: r.base,
  exhibit_page: r.page,
}));

// Nodes: one per publication that has at least one counted independent citation.
// The eight publications with no captured citing list have no edges to draw, so
// they are absent rather than drawn as isolated dots — the caption says so.
function graphNodesFor(rows, arts) {
  const degree = new Map();
  for (const r of rows) degree.set(r.cites_id, (degree.get(r.cites_id) || 0) + 1);
  return [...degree.entries()].map(([cites_id, n]) => {
    const a = arts.find((x) => x.cites_id === cites_id) || {};
    const topic = TOPICS[cites_id] || "unknown";
    const fam = FAMILY[topic] || FAMILY.unknown;
    return {
      cites_id,
      n,
      topic,
      family: fam.label,
      title: a.title || rows.find((r) => r.cites_id === cites_id).cited_title,
      venue: a.venue || "",
      year: a.year ?? null,
      exhibit_base: a.exhibit_base || "",
      cites_url: a.cites_url || "",
      records: a.records ?? null,
      bucket_independent: a.bucket_independent ?? null,
    };
  });
}

const graphNodes = graphNodesFor(graphRows, articles);

// Edges for the co-citation figure: a pair of publications cited together by the
// same independent work, weighted by how many such works there are.
const graphEdges = (() => {
  const byWork = new Map();
  for (const r of graphRows) {
    if (!byWork.has(r.ident)) byWork.set(r.ident, new Set());
    byWork.get(r.ident).add(r.cites_id);
  }
  const pairs = new Map();
  for (const set of byWork.values()) {
    if (set.size < 2) continue;
    const ids = [...set].sort();
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const k = `${ids[i]}|${ids[j]}`;
        pairs.set(k, (pairs.get(k) || 0) + 1);
      }
    }
  }
  return [...pairs.entries()]
    .map(([k, weight]) => {
      const [a, b] = k.split("|");
      return { source: a, target: b, weight };
    })
    .sort((x, y) => y.weight - x.weight);
})();

const graphWorks = (() => {
  const byWork = new Map();
  for (const r of graphRows) {
    if (!byWork.has(r.ident)) {
      byWork.set(r.ident, {
        // The identity key itself, so a link can be resolved back to a node and
        // the guard below can prove no link dangles. It is a normalised title, or
        // a hand-proved same-work key, never a row id -- a row id would mean a
        // different work after a re-capture.
        ident: r.ident,
        title: r.title,
        byline: r.byline,
        link: r.link,
        year: r.year,
        cites: [],
        rows: [],
      });
    }
    const w = byWork.get(r.ident);
    w.cites.push(r.cites_id);
    w.rows.push(r.row_uid);
  }
  return [...byWork.values()];
})();

// The bipartite figure's links, one per counted citation.
const graphLinks = graphRows.map((r) => ({
  work: r.ident,
  cites_id: r.cites_id,
  row_uid: r.row_uid,
}));
// is worse than no diagram, because it is read as the evidence. Checked against
// the ledger's own bucket figure rather than against a number restated here.
if (graphRows.length !== g.bucket_independent) {
  throw new Error(
    `The network figure has ${graphRows.length} counted independent citations but ` +
      `the ledger's bucket_independent is ${g.bucket_independent}. The graph's WHERE ` +
      `clause and bucketOf in tools/tally.js must be the same rule; fix the query ` +
      `rather than the figure.`
  );
}
{
  const ids = new Set(graphNodes.map((n) => n.cites_id));
  const stranded = graphRows.filter((r) => !ids.has(r.cites_id));
  if (stranded.length) {
    throw new Error(
      `${stranded.length} graph citation(s) point at a publication with no node.`
    );
  }
  const known = new Set(graphWorks.map((w) => w.ident));
  const lost = graphLinks.filter((l) => !known.has(l.work));
  if (lost.length) {
    throw new Error(
      `${lost.length} graph link(s) reference a citing work that has no node.`
    );
  }
}
const graph = {
  nodes: graphNodes,
  edges: graphEdges,
  works: graphWorks,
  links: graphLinks,
  // Stated once, from the rows, so neither figure's caption restates a figure by
  // hand and drifts. `independent_countable` is the row count and is higher by
  // the second copies; the graph uses the counted set.
  citations: graphRows.length,
  distinct_works: graphWorks.length,
  multi_cited_works: graphWorks.filter((w) => w.cites.length > 1).length,
  publications: graphNodes.length,
  families: Object.fromEntries(
    Object.keys(FAMILY).map((k) => [
      k,
      graphNodes.filter((n) => n.topic === k).length,
    ])
  ),
};
log(
  `Network figure: ${graph.publications} publication nodes, ` +
    `${graph.distinct_works} distinct independent citing works, ` +
    `${graph.links.length} links, ${graph.edges.length} co-citation edges ` +
    `across ${graph.multi_cited_works} multi-paper citing works.`
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
    // The true distinct-WORK totals, collapsing a paper that cites several of the
    // PI's publications to one. `unique_papers_citing` and
    // `independent_unique_papers` are per-citation despite their names -- see the
    // block above that derives these -- so anything that says "distinct papers"
    // must read one of these four instead.
    distinct_citing_papers: basis.distinct_citing_papers,
    distinct_independent_papers: basis.distinct_independent_papers,
    distinct_independent_papers_english:
      basis.distinct_independent_papers_english,
    distinct_citing_papers_english: basis.distinct_citing_papers_english,
    independent_externally_confirmed: g.independent_externally_confirmed,
    independent_scholar_list_only: g.independent_scholar_list_only,
    // How much of the counted total rests on a person reading the published
    // article rather than on a machine match. Published so chapter 6 can state
    // the three-way split in one place; the corroboration chart below reports the
    // same states on the distinct-paper basis, so the two are not interchangeable.
    independent_user_decided: g.independent_user_decided,
    independent_pending: g.independent_pending,
    // The independent-classified rows the language screen supersedes (2026-11-03).
    // Published so the waffle can draw them as their own bucket and the open-work
    // figure can state plainly that it excludes them.
    non_english_independent: g.non_english_independent,
    // The five reviewer-facing categories (user instruction, 2026-11-03). The
    // charts draw THESE rather than recombining the status counts below, so a
    // bucket means one thing everywhere: self-citations are inside
    // bucket_dependent, a second copy of a counted work is in bucket_preprint_copy,
    // and the seven terms sum to citation_records_reviewed with no remainder.
    // bucket_review is the raw REVIEW count, which on this store equals the queue
    // because non-English rows left it; review_queue above is what the queue page
    // lists, and the two are kept apart so neither is silently substituted.
    bucket_independent: g.bucket_independent,
    bucket_dependent: g.bucket_dependent,
    bucket_review: g.bucket_review,
    bucket_non_english: g.bucket_non_english,
    bucket_preprint_copy: g.bucket_preprint_copy,
    bucket_pending: g.bucket_pending,
    bucket_other: g.bucket_other,
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
  // The fifth bucket, named row by row: every citing work Scholar lists twice on
  // a page, with the row that stands in its place.
  preprint_copies: preprintCopies,
  open_items: openItems,
  // The topic table itself, so the browser colours from the same list a person
  // reviewed rather than from a second copy of the rules. `order` is the legend
  // order; the figures number nodes by their own rule so "node 7" is stable.
  topics: {
    family: FAMILY,
    order: Object.keys(FAMILY),
    assigned: Object.keys(TOPICS).length,
  },
  // The two network figures. Built from the counted independent set and guarded
  // above against the ledger's own bucket figure.
  graph,
};

if (CHECK) {
  log(`--check: ${articles.length} articles, ${patents.length} patents, ` +
    `${years.length} years, ${allWorks.length} citing rows on the exhibit pages ` +
    `(${allWorks.filter((w) => w.marked).length} marked, ` +
    `${allWorks.filter((w) => w.is_copy).length} of them a copy of another row), ` +
    `${reviewQueue.length} in the review queue, ${unsettledRows.length} unsettled, ` +
    `${languageHeld.length} held for language, ` +
    `${preprintCopies.length} preprint/copy, ` +
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

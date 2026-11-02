// Build the citation catalog: a SQLite lookup layer over the captured reports.
//
//   node tools/build-catalog.js                 full rebuild, prints totals
//   node tools/build-catalog.js --pub=<base>    upsert one publication (batch hook)
//   node tools/build-catalog.js --check         rebuild in memory, report only
//
// WHAT THIS DATABASE IS, and what it is not.
//
//   It is a LOOKUP layer. It exists so a question like "which patents cite this
//   work?" or "show me every row still awaiting review?" can be answered
//   without re-reading 51 report files. It is NEVER the ledger. Per the project
//   instructions, any figure quoted in the packet comes from
//   citation-ledger-<snapshot>.csv written by tools/build-ledger.js. If a number
//   here ever disagrees with that CSV, the CSV is right and this file has a bug:
//   report it, do not quote the DB.
//
//   Because of that, every counting rule is imported from tools/tally.js -- the
//   single definition of what counts -- and nothing here reimplements one. The
//   rebuild ends by recounting straight from the reports through tally.js and
//   comparing, so a drift fails loudly instead of quietly.
//
//   Rows are kept for EVERY report observed, including superseded captures in
//   Exhibits/Archive and reports whose exhibit PDF is no longer filed, each with
//   a `filed` flag. That lets a reviewer widen a query to see history. Default
//   totals in query-catalog.js are filed-only, matching the ledger.
//
//   Full rebuild is idempotent: the file is rewritten from scratch, so running
//   it twice produces the same contents. Nothing outside the DB file is written.
//
//   The database lives in Database/ at the project root, NOT under Exhibits/.
//   Exhibits/ is the evidence folder that gets reviewed, zipped and filed, and a
//   generated binary that changes on every run does not belong in it. Deleting
//   Database/citation-catalog.sqlite is always safe: it is rebuilt from the
//   reports, which remain the source of truth.

const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");
const tally = require("./tally");
const { classifyWork } = require("./work-type");

const ROOT = path.resolve(__dirname, "..");
const EXHIBITS = path.join(ROOT, "Independent Citation Record", "Exhibits");
const PDF_DIR = path.join(EXHIBITS, "PDFs");
const SUPPORT_DIR = path.join(EXHIBITS, "Supporting");
const ARCHIVE_DIR = path.join(EXHIBITS, "Archive");
const DB_DIR = path.join(ROOT, "Database");
const DB_PATH = path.join(DB_DIR, "citation-catalog.sqlite");

const SCHEMA_VERSION = 3;

// ---------------------------------------------------------------------------
// Reading the workpapers
// ---------------------------------------------------------------------------

// The dated publication snapshot, newest file wins. Same rule build-ledger uses,
// so the two always describe the same Scholar snapshot.
function readSnapshot() {
  const candidates = fs
    .readdirSync(SUPPORT_DIR)
    .filter((f) => /^publications-list-\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .sort();
  if (!candidates.length) {
    throw new Error(
      "No publications-list-<date>.json in Exhibits/Supporting. Run tools/list-all-publications.js first."
    );
  }
  const file = candidates[candidates.length - 1];
  return { file, data: JSON.parse(fs.readFileSync(path.join(SUPPORT_DIR, file), "utf8")) };
}

// Every report JSON on disk, filed or not. Archive is included on purpose: a
// superseded capture is history worth querying, and the `filed` flag is what
// keeps it out of the totals.
function readReports() {
  const out = [];
  for (const dir of [SUPPORT_DIR, ARCHIVE_DIR]) {
    let names;
    try {
      names = fs.readdirSync(dir);
    } catch {
      continue; // no Archive folder yet is normal
    }
    for (const name of names) {
      if (!name.endsWith(".report.json")) continue;
      const full = path.join(dir, name);
      let data;
      try {
        data = JSON.parse(fs.readFileSync(full, "utf8"));
      } catch (e) {
        // A half-written report from an interrupted capture must not stop the
        // rebuild of everything else. Say so and skip it.
        console.log(`[catalog] WARNING: could not parse ${name} (${e.message}); skipped.`);
        continue;
      }
      const base = name.replace(/\.report\.json$/, "");
      out.push({
        file: name,
        dir,
        full,
        base,
        pub: base.replace(/-p\d+$/, ""),
        archived: dir === ARCHIVE_DIR,
        data,
      });
    }
  }
  return out.sort((a, b) => a.base.localeCompare(b.base) || (a.data.page || 1) - (b.data.page || 1));
}

// Group the reports by publication base name. Kept local rather than reusing
// tally.groupReports because that one filters to filed publications, and this
// builder deliberately stores the unfiled ones too. The filed flag itself comes
// from tally.filedBases, so "filed" means exactly what it means in the ledger.
function groupByBase(reports, filedBases) {
  const groups = new Map();
  for (const r of reports) {
    if (!groups.has(r.pub)) {
      groups.set(r.pub, {
        base: r.pub,
        pages: [],
        cites_ids: new Set(),
        snapshots: new Set(),
      });
    }
    const g = groups.get(r.pub);
    g.pages.push({
      base: r.base,
      file: r.file,
      archived: r.archived,
      page: r.data.page || 1,
      entries: r.data.entries || [],
      snapshot: r.data.snapshot || "",
      end_reason: r.data.end_reason || "",
    });
    const id = tally.citesId(r.data.cites_url);
    if (id) g.cites_ids.add(id);
    if (r.data.snapshot) g.snapshots.add(String(r.data.snapshot).slice(0, 10));
    g.cited_title = r.data.cited_title || g.cited_title || "";
    g.cited_authors = r.data.cited_authors || g.cited_authors || "";
    g.cited_venue = r.data.cited_venue || g.cited_venue || "";
    g.paper_url = r.data.paper_url || g.paper_url || "";
    g.cites_url = r.data.cites_url || g.cites_url || "";
  }
  for (const g of groups.values()) {
    g.pages.sort((a, b) => a.page - b.page);
    g.cites_id = [...g.cites_ids][0] || "";
    g.filed = filedBases.has(g.base) && !g.pages.some((p) => p.archived);
  }
  return groups;
}

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const COLUMNS = [
  "id",
  "cites_id",
  "base",
  "page",
  "row_index",
  "cid",
  "title",
  "raw_title",
  "authors",
  "authors_used",
  "author_source",
  "truncated",
  "link",
  "snippet",
  "status",
  "confirm_state",
  "corroboration",
  "corroboration_note",
  "language_flag",
  "is_non_english",
  "non_english_reason",
  "is_countable_independent",
  "withheld_for_language",
  "needs_attention",
  "attention_reason",
  "resolution",
  "external_source",
  "external_url",
  "external_title",
  "external_authors",
  "external_similarity",
  "matched_authors",
  "matched_pi",
  "matched_former_pi",
  "full_authors",
  "pubmed_near_miss",
  "openalex_near_miss",
  "is_highlighted",
  "paper_key",
  "is_primary_copy",
  "doi",
  "edition_key",
  "duplicate_of",
  "is_language_edition",
  "is_edition_primary",
  "edition_note",
  "work_type",
  "patent_number",
  "patent_kind",
  "work_type_evidence",
  "filed",
  "archived",
  "snapshot",
  "report_file",
];

const DDL = `
PRAGMA journal_mode = WAL;

CREATE TABLE meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- One row per publication in the Scholar snapshot, plus any captured
-- publication that is not in the list. cites_id is the natural key; a capture
-- whose cites url could not be resolved gets a synthetic key built from its
-- base name so it still has somewhere to hang its rows.
CREATE TABLE publications (
  cites_id             TEXT PRIMARY KEY,
  title                TEXT NOT NULL DEFAULT '',
  authors              TEXT NOT NULL DEFAULT '',
  venue                TEXT NOT NULL DEFAULT '',
  year                 TEXT NOT NULL DEFAULT '',
  cited_by_at_snapshot INTEGER NOT NULL DEFAULT 0,
  paper_url            TEXT NOT NULL DEFAULT '',
  cites_url            TEXT NOT NULL DEFAULT '',
  exhibit_base         TEXT NOT NULL DEFAULT '',
  filed                INTEGER NOT NULL DEFAULT 0,
  in_snapshot          INTEGER NOT NULL DEFAULT 0,
  status               TEXT NOT NULL DEFAULT '',
  pages_expected       INTEGER NOT NULL DEFAULT 0,
  pages_captured       INTEGER NOT NULL DEFAULT 0,
  pages_complete       INTEGER NOT NULL DEFAULT 0,
  snapshot_date        TEXT NOT NULL DEFAULT ''
);

-- One row per Google Scholar row observed on a citing-articles page. A paper
-- Scholar lists twice appears twice here, which is what the exhibit shows;
-- is_primary_copy marks the copy a distinct-paper count should use.
CREATE TABLE citations (
  id                  INTEGER PRIMARY KEY,
  cites_id            TEXT NOT NULL,
  base                TEXT NOT NULL,
  page                INTEGER NOT NULL DEFAULT 1,
  row_index           INTEGER,
  cid                 TEXT NOT NULL DEFAULT '',
  title               TEXT NOT NULL DEFAULT '',
  raw_title           TEXT NOT NULL DEFAULT '',
  authors             TEXT NOT NULL DEFAULT '',
  authors_used        TEXT NOT NULL DEFAULT '',
  author_source       TEXT NOT NULL DEFAULT '',
  truncated           INTEGER NOT NULL DEFAULT 0,
  link                TEXT NOT NULL DEFAULT '',
  snippet             TEXT NOT NULL DEFAULT '',
  status              TEXT NOT NULL DEFAULT '',
  confirm_state       TEXT NOT NULL DEFAULT '',
  corroboration       TEXT NOT NULL DEFAULT '',
  corroboration_note  TEXT NOT NULL DEFAULT '',
  language_flag       TEXT NOT NULL DEFAULT '',
  -- Non-English separation, added 2026-11-01 at the user's request so the
  -- packet's adjusted English-only figures can be produced by a query. Per the
  -- guide a citation not listed in English needs a certified human translation
  -- and affidavit before it may be highlighted or counted; the user chose not
  -- to obtain translations, so these rows stay unmarked and are excluded.
  --   is_non_english          1 when the language screen flagged the entry
  --   non_english_reason      why: script, foreign words, or diacritics
  --   is_countable_independent  1 exactly when tally.isHighlighted says the row
  --                           counts -- the exhibit mark and this column cannot
  --                           disagree, because both call the same function
  --   withheld_for_language   1 when the row would count but for the language
  --                           flag, ie what filing a certified translation
  --                           would recover. Never counted anywhere.
  is_non_english           INTEGER NOT NULL DEFAULT 0,
  non_english_reason       TEXT NOT NULL DEFAULT '',
  is_countable_independent INTEGER NOT NULL DEFAULT 0,
  withheld_for_language    INTEGER NOT NULL DEFAULT 0,
  needs_attention     INTEGER NOT NULL DEFAULT 0,
  attention_reason    TEXT NOT NULL DEFAULT '',
  resolution          TEXT NOT NULL DEFAULT '',
  external_source     TEXT NOT NULL DEFAULT '',
  external_url        TEXT NOT NULL DEFAULT '',
  external_title      TEXT NOT NULL DEFAULT '',
  external_authors    TEXT NOT NULL DEFAULT '',
  external_similarity REAL,
  matched_authors     TEXT NOT NULL DEFAULT '[]',
  matched_pi          TEXT NOT NULL DEFAULT '[]',
  matched_former_pi   TEXT NOT NULL DEFAULT '[]',
  full_authors        TEXT NOT NULL DEFAULT '[]',
  pubmed_near_miss    TEXT,
  openalex_near_miss  TEXT,
  is_highlighted      INTEGER NOT NULL DEFAULT 0,
  paper_key           TEXT NOT NULL DEFAULT '',
  is_primary_copy     INTEGER NOT NULL DEFAULT 1,
  -- Language editions. A publisher can serve one article in two languages and
  -- Scholar lists both rows with separate cids and separate DOIs, so title
  -- matching cannot see the relationship. doi is read off the row's own link;
  -- edition_key is set only when a DOI and an identical author list together
  -- prove the work, so an empty key means "not established", never "distinct".
  -- These columns DOCUMENT the relationship and change no count: the non-English
  -- copy is already excluded from the independent total by language_flag.
  doi                 TEXT NOT NULL DEFAULT '',
  edition_key         TEXT NOT NULL DEFAULT '',
  duplicate_of        TEXT NOT NULL DEFAULT '',
  is_language_edition INTEGER NOT NULL DEFAULT 0,
  is_edition_primary  INTEGER NOT NULL DEFAULT 1,
  edition_note        TEXT NOT NULL DEFAULT '',
  work_type           TEXT NOT NULL DEFAULT 'article',
  patent_number       TEXT NOT NULL DEFAULT '',
  patent_kind         TEXT NOT NULL DEFAULT '',
  work_type_evidence  TEXT NOT NULL DEFAULT '',
  filed               INTEGER NOT NULL DEFAULT 0,
  archived            INTEGER NOT NULL DEFAULT 0,
  snapshot            TEXT NOT NULL DEFAULT '',
  report_file         TEXT NOT NULL DEFAULT ''
);

CREATE INDEX idx_citations_cites_id ON citations(cites_id);
CREATE INDEX idx_citations_status ON citations(status);
CREATE INDEX idx_citations_work_type ON citations(work_type);
CREATE INDEX idx_citations_confirm ON citations(confirm_state);
CREATE INDEX idx_citations_filed ON citations(filed);
CREATE INDEX idx_citations_patent ON citations(patent_number);
CREATE INDEX idx_citations_edition ON citations(edition_key);
CREATE INDEX idx_citations_non_english ON citations(is_non_english);

-- Full-text over the three fields a reviewer searches. External content keeps
-- one copy of the text in the citations table; the triggers below mean the index
-- cannot fall out of step with the table, whichever path writes the rows.
CREATE VIRTUAL TABLE citations_fts USING fts5(
  title,
  authors_used,
  snippet,
  content='citations',
  content_rowid='id',
  tokenize='unicode61 remove_diacritics 2'
);

CREATE TRIGGER citations_ai AFTER INSERT ON citations BEGIN
  INSERT INTO citations_fts(rowid, title, authors_used, snippet)
  VALUES (new.id, new.title, new.authors_used, new.snippet);
END;

CREATE TRIGGER citations_ad AFTER DELETE ON citations BEGIN
  INSERT INTO citations_fts(citations_fts, rowid, title, authors_used, snippet)
  VALUES ('delete', old.id, old.title, old.authors_used, old.snippet);
END;

CREATE TRIGGER citations_au AFTER UPDATE ON citations BEGIN
  INSERT INTO citations_fts(citations_fts, rowid, title, authors_used, snippet)
  VALUES ('delete', old.id, old.title, old.authors_used, old.snippet);
  INSERT INTO citations_fts(rowid, title, authors_used, snippet)
  VALUES (new.id, new.title, new.authors_used, new.snippet);
END;

-- Citing patents, separable from the article citations by design. Both the
-- granted form and an application publication count as the patent family; a
-- work_type of 'unknown' (a venue that merely mentions patents) is excluded
-- here and surfaces under the review query instead.
CREATE VIEW v_patents AS
SELECT
  c.patent_number,
  c.patent_kind,
  CASE c.work_type WHEN 'patent-application' THEN 'application' ELSE 'granted' END AS kind,
  c.title,
  -- authors_used is the list independence was judged from (the Cite-popup
  -- record when Scholar truncated the snippet); the raw authors field still
  -- carries the venue text Scholar printed after it.
  COALESCE(NULLIF(c.authors_used, ''), c.authors) AS authors,
  c.link,
  c.status,
  c.confirm_state,
  c.is_highlighted,
  c.filed,
  c.work_type_evidence AS evidence,
  p.title AS cited_title,
  p.cites_id,
  c.base,
  c.page,
  c.row_index,
  c.id
FROM citations c
LEFT JOIN publications p ON p.cites_id = c.cites_id
WHERE c.work_type IN ('patent', 'patent-application');

-- The rows the ledger counts as independent: filed exhibits only, and
-- is_highlighted comes from tally.isHighlighted, so it already excludes a
-- non-English entry or one whose author list no source has settled.
CREATE VIEW v_independent_counted AS
SELECT c.*
FROM citations c
WHERE c.is_highlighted = 1 AND c.filed = 1;

-- Every entry the language screen holds back, with the reason and whether it
-- would otherwise have counted. This is the separation the adjusted
-- English-only figures are built from, and the list a certified translation
-- would have to cover to reclaim them.
--
--   would_count        1 when the entry is independent and corroborated and is
--                      withheld for language alone
--   language_edition   1 when this row is a second-language copy of another
--                      row on the same citing list (see v_language_editions)
CREATE VIEW v_non_english AS
SELECT
  c.cites_id,
  p.title AS cited_work,
  c.cid,
  c.title,
  COALESCE(NULLIF(c.authors_used, ''), c.authors) AS authors,
  c.link,
  c.language_flag AS reason,
  c.status,
  c.confirm_state,
  c.is_highlighted,
  c.withheld_for_language AS would_count,
  CASE WHEN c.duplicate_of <> '' THEN 1 ELSE 0 END AS language_edition,
  c.work_type,
  c.base,
  c.page,
  c.row_index,
  c.filed,
  c.id
FROM citations c
LEFT JOIN publications p ON p.cites_id = c.cites_id
WHERE c.is_non_english = 1
ORDER BY c.withheld_for_language DESC, c.cites_id, c.page, c.row_index;

-- Language editions of one another within a single citing list. A publisher can
-- serve the same article in two languages and Scholar lists both rows, each
-- with its own cid and its own DOI, so the exhibit shows the article twice and
-- marks it once.
--
-- edition_key is recorded on every row whose work can be proven from a DOI plus
-- an author list, which is most rows -- that is provenance, not a duplicate
-- claim. A family exists only where one key carries TWO different DOIs, so that
-- is what this view filters on. Two rows sharing one DOI exactly are the ordinary
-- duplicate-version case that paper_key already merges, and are excluded here.
--
-- Within a family, is_language_edition = 0 is the copy that stands for the work
-- and is the one a reader should cite; is_highlighted shows what the exhibit
-- marks, which is never the edition.
--
-- This view documents the relationship and changes no count: the non-English
-- copy is already excluded from the independent total by language_flag.
CREATE VIEW v_language_editions AS
SELECT
  c.cites_id,
  p.title AS cited_work,
  c.edition_key,
  c.is_language_edition,
  c.cid,
  c.page,
  c.row_index,
  c.doi,
  c.duplicate_of,
  c.title,
  c.language_flag,
  c.status,
  c.is_highlighted,
  c.edition_note,
  c.base,
  c.filed
FROM citations c
LEFT JOIN publications p ON p.cites_id = c.cites_id
WHERE EXISTS (
  SELECT 1 FROM citations f
  WHERE f.cites_id = c.cites_id AND f.edition_key = c.edition_key
    AND f.edition_key <> ''
  GROUP BY f.cites_id, f.edition_key
  HAVING COUNT(DISTINCT f.doi) > 1
)
ORDER BY c.cites_id, c.edition_key, c.is_language_edition DESC, c.page;

-- Per-publication rollup. Totals are filed-only; join on filed = 1 rows so an
-- archived capture cannot add to a count.
CREATE VIEW v_pub_stats AS
SELECT
  p.cites_id,
  p.title,
  p.venue,
  p.year,
  p.cited_by_at_snapshot,
  p.exhibit_base,
  p.filed,
  p.status,
  p.pages_expected,
  p.pages_captured,
  p.pages_complete,
  SUM(CASE WHEN c.filed = 1 THEN 1 ELSE 0 END) AS records,
  SUM(CASE WHEN c.filed = 1 AND c.is_highlighted = 1 THEN 1 ELSE 0 END) AS independent,
  SUM(CASE WHEN c.filed = 1 AND c.is_highlighted = 1 AND c.confirm_state = 'confirmed' THEN 1 ELSE 0 END) AS independent_confirmed,
  SUM(CASE WHEN c.filed = 1 AND c.is_highlighted = 1 AND c.confirm_state = 'unverified-coverage' THEN 1 ELSE 0 END) AS independent_coverage,
  SUM(CASE WHEN c.filed = 1 AND c.status = 'DEPENDENT' THEN 1 ELSE 0 END) AS dependent,
  SUM(CASE WHEN c.filed = 1 AND c.status = 'SELF (PI)' THEN 1 ELSE 0 END) AS self_pi,
  SUM(CASE WHEN c.filed = 1 AND c.status = 'SELF (FORMER PI)' THEN 1 ELSE 0 END) AS self_former_pi,
  SUM(CASE WHEN c.filed = 1 AND c.status = 'REVIEW' THEN 1 ELSE 0 END) AS review,
  SUM(CASE WHEN c.filed = 1 AND c.language_flag <> '' THEN 1 ELSE 0 END) AS non_english,
  SUM(CASE WHEN c.filed = 1 AND c.withheld_for_language = 1 THEN 1 ELSE 0 END) AS non_english_withheld,
  SUM(CASE WHEN c.filed = 1 AND c.is_non_english = 0 THEN 1 ELSE 0 END) AS english_records,
  SUM(CASE WHEN c.filed = 1 AND c.is_non_english = 0 AND c.is_highlighted = 1 THEN 1 ELSE 0 END) AS english_independent,
  SUM(CASE WHEN c.filed = 1 AND c.work_type IN ('patent','patent-application') THEN 1 ELSE 0 END) AS patents,
  SUM(CASE WHEN c.filed = 1 AND (c.needs_attention = 1 OR c.status = 'REVIEW') THEN 1 ELSE 0 END) AS needs_attention
FROM publications p
LEFT JOIN citations c ON c.cites_id = p.cites_id
GROUP BY p.cites_id;
`;

// ---------------------------------------------------------------------------
// Row building
// ---------------------------------------------------------------------------

const bool = (v) => (v ? 1 : 0);
const text = (v) => (v === null || v === undefined ? "" : String(v));
const json = (v) =>
  v === null || v === undefined ? null : JSON.stringify(v);

// Array-ish fields arrive as an array, a string, or are absent. Absent means
// empty per the verified data shapes, and storing "[]" keeps json_each() usable.
function asArray(v) {
  if (Array.isArray(v)) return v;
  if (v === null || v === undefined || v === "") return [];
  return [v];
}

// One Scholar row -> one database row. Derived columns come from tally.js and
// work-type.js; nothing is decided here.
function citationRow(entry, ctx) {
  const work = classifyWork(entry);
  const sim = entry.external_similarity;
  return {
    cites_id: ctx.cites_id,
    base: ctx.base,
    page: Number(entry.page || ctx.page || 1),
    row_index: Number.isFinite(Number(entry.index)) ? Number(entry.index) : null,
    cid: text(entry.cid),
    title: text(entry.title),
    raw_title: text(entry.rawTitle),
    authors: text(entry.authors),
    authors_used: text(entry.authors_used),
    author_source: text(entry.author_source),
    truncated: bool(entry.truncated),
    link: text(entry.link),
    snippet: text(entry.snippet),
    status: text(entry.status),
    confirm_state: text(entry.confirm_state),
    corroboration: text(entry.corroboration),
    corroboration_note: text(entry.corroboration_note),
    language_flag: text(entry.language_flag),
    // Derived, never decided here: the flag itself comes from the report and
    // the countability from tally.isHighlighted, so the exhibit mark, the
    // ledger and this database cannot disagree about what is non-English.
    is_non_english: bool(entry.language_flag),
    non_english_reason: text(entry.language_flag),
    is_countable_independent: bool(tally.isHighlighted(entry)),
    withheld_for_language: bool(tally.isWithheldForLanguage(entry)),
    needs_attention: bool(entry.needs_attention),
    attention_reason: text(entry.attention_reason),
    resolution: text(entry.resolution),
    external_source: text(entry.external_source),
    external_url: text(entry.external_url),
    external_title: text(entry.external_title),
    external_authors: text(entry.external_authors),
    external_similarity: sim === null || sim === undefined || sim === "" ? null : Number(sim),
    matched_authors: json(asArray(entry.matched_authors)),
    matched_pi: json(asArray(entry.matched_pi)),
    matched_former_pi: json(asArray(entry.matched_former_pi)),
    full_authors: json(asArray(entry.full_authors)),
    pubmed_near_miss: json(entry.pubmed_near_miss),
    openalex_near_miss: json(entry.openalex_near_miss),
    is_highlighted: bool(tally.isHighlighted(entry)),
    paper_key: tally.paperKey(entry),
    is_primary_copy: 1, // settled below, once every copy of the paper is known
    doi: tally.doiOf(entry.link) || tally.doiOf(entry.external_url),
    edition_key: "", // settled below, once every row of the publication is known
    duplicate_of: "",
    is_language_edition: 0,
    is_edition_primary: 1,
    edition_note: "",
    work_type: work.work_type,
    patent_number: work.patent_number,
    patent_kind: work.patent_kind,
    work_type_evidence: work.evidence,
    filed: bool(ctx.filed),
    archived: bool(ctx.archived),
    snapshot: text(ctx.snapshot),
    report_file: ctx.file,
  };
}

// Mark the copy a distinct-paper count should use, per publication and per
// filed/unfiled partition. The rule is tally.uniquePapers -- the same one the
// ledger uses -- so "distinct papers" means the same thing in both places.
function applyPrimaryCopy(rows) {
  const partitions = new Map();
  for (const r of rows) {
    const k = `${r.cites_id}\u0000${r.filed}`;
    if (!partitions.has(k)) partitions.set(k, []);
    partitions.get(k).push(r);
  }
  for (const group of partitions.values()) {
    if (group.length === 1) {
      group[0].is_primary_copy = 1;
      continue;
    }
    // uniquePapers returns its own objects, so carry the position along and
    // read it back rather than comparing object identity.
    const { kept } = tally.uniquePapers(
      group.map((r, i) => ({
        __i: i,
        title: r.title,
        page: r.page,
        cid: r.cid,
        index: r.row_index,
        author_source: r.author_source,
        confirm_state: r.confirm_state,
        status: r.status,
        language_flag: r.language_flag,
      }))
    );
    for (const r of group) r.is_primary_copy = 0;
    for (const winner of kept) group[winner.__i].is_primary_copy = 1;
  }
  return rows;
}

// Document language editions, per publication. A publisher can serve one
// article in two languages and Scholar lists both rows with separate cids and
// separate DOIs, so title matching cannot see the relationship. The rule is
// tally.markLanguageEditions -- the same one the capture applies before it
// marks an exhibit -- so the database and the PDF never disagree about which
// copy stands for the work.
//
// Grouped by cites_id because a language edition is a duplicate *within one
// citing list*. The same article can legitimately appear in two different
// publications' lists and those are separate citations.
//
// Stored columns only: no counted figure moves, because the non-English copy is
// already excluded by language_flag. is_highlighted is recomputed afterwards so
// a row deferred here can never be stored as marked.
function applyEditions(rows) {
  const partitions = new Map();
  for (const r of rows) {
    const k = `${r.cites_id}\u0000${r.filed}`;
    if (!partitions.has(k)) partitions.set(k, []);
    partitions.get(k).push(r);
  }
  for (const group of partitions.values()) {
    // Walk in page order with a carried `prior` map, exactly as the capture and
    // build-ledger do. Handing the whole partition to one call instead would
    // resolve a pair that straddles two pages differently -- the batch call has
    // no notion of a copy already printed on an earlier page -- and the two
    // paths then disagree about which row stands for the work. That disagreement
    // was caught on 2026-11-01 by the reconciliation below (44 vs 46 rows
    // withheld for language), not by eye.
    group.sort((a, b) => (a.page || 1) - (b.page || 1));
    const prior = new Map();
    let offset = 0;
    while (offset < group.length) {
      const page = group[offset].page || 1;
      let end = offset;
      while (end < group.length && (group[end].page || 1) === page) end++;
      tally.markLanguageEditions(group.slice(offset, end), prior);
      offset = end;
    }
    for (const r of group) {
      r.doi = tally.doiOf(r.link) || tally.doiOf(r.external_url);
      r.is_language_edition = r.duplicate_of ? 1 : 0;
      r.is_edition_primary = r.duplicate_of ? 0 : 1;
      r.is_highlighted = bool(tally.isHighlighted(r));
      // Both of these depend on duplicate_of, which the walk above only just
      // settled, so they are refreshed here rather than trusted from row building.
      r.is_countable_independent = bool(tally.isHighlighted(r));
      r.withheld_for_language = bool(tally.isWithheldForLanguage(r));
    }
  }
  return rows;
}

// Everything the catalog knows, ready to write.
function collect() {
  const { file: listFile, data: listData } = readSnapshot();
  const filedBases = tally.filedBases(PDF_DIR);
  const reports = readReports();
  const groups = groupByBase(reports, filedBases);

  const citations = [];
  for (const g of groups.values()) {
    for (const page of g.pages) {
      const ctx = {
        cites_id: g.cites_id || `base:${g.base}`,
        base: g.base,
        file: page.file,
        page: page.page,
        filed: g.filed,
        archived: page.archived,
        snapshot: page.snapshot,
      };
      for (const e of page.entries) citations.push(citationRow(e, ctx));
    }
  }
  applyPrimaryCopy(citations);
  applyEditions(citations);
  // Publications: the snapshot drives the denominator, and a capture with no
  // matching snapshot row is kept and labelled rather than dropped.
  const publications = [];
  const claimed = new Set();
  const byId = new Map();
  for (const g of groups.values()) {
    const id = g.cites_id || `base:${g.base}`;
    if (!byId.has(id)) byId.set(id, []);
    byId.get(id).push(g);
  }

  for (const pub of listData.publications || []) {
    const id = tally.citesId(pub.citesUrl);
    const citedBy = Number(pub.citedBy) || 0;
    const matches = id ? byId.get(id) || [] : [];
    // Prefer the filed exhibit set; otherwise the most recent base, which is
    // what a reviewer would want to look at next.
    const chosen =
      matches.find((m) => m.filed) || matches[matches.length - 1] || null;
    if (chosen) claimed.add(chosen.base);
    for (const m of matches) claimed.add(m.base);
    publications.push({
      cites_id: id || `base:unnamed-${publications.length}`,
      title: text(pub.title),
      authors: text(pub.authors),
      venue: text(pub.venue),
      year: text(pub.year),
      cited_by_at_snapshot: citedBy,
      paper_url: text(pub.paperUrl),
      cites_url: text(pub.citesUrl),
      exhibit_base: chosen ? chosen.base : "",
      filed: bool(chosen && chosen.filed),
      in_snapshot: 1,
      status: chosen && chosen.filed ? "captured" : citedBy ? "not-started" : "no-citations-shown",
      pages_expected: citedBy ? tally.expectedPages(citedBy) : 0,
      pages_captured: chosen && chosen.filed ? chosen.pages.length : 0,
      pages_complete: bool(chosen && chosen.filed && chosen.pages.length >= (citedBy ? tally.expectedPages(citedBy) : 0)),
      snapshot_date: text(listData.snapshot_date),
    });
  }

  // A captured publication that matched no snapshot row would otherwise vanish
  // from the catalog while its report sat on disk.
  for (const [id, list] of byId) {
    if (claimed.has(list[list.length - 1].base)) continue;
    if (publications.some((p) => p.cites_id === id)) continue;
    const chosen = list.find((m) => m.filed) || list[list.length - 1];
    publications.push({
      cites_id: id,
      title: chosen.cited_title || chosen.base,
      authors: chosen.cited_authors || "",
      venue: chosen.cited_venue || "",
      year: "",
      cited_by_at_snapshot: 0,
      paper_url: chosen.paper_url || "",
      cites_url: chosen.cites_url || "",
      exhibit_base: chosen.base,
      filed: bool(chosen.filed),
      in_snapshot: 0,
      status: chosen.filed ? "captured-not-in-list" : "archived-not-filed",
      pages_expected: 0,
      pages_captured: chosen.pages.length,
      pages_complete: 1,
      snapshot_date: [...chosen.snapshots][0] || text(listData.snapshot_date),
    });
  }

  // More than one filed exhibit set for one citing list means the totals depend
  // on folder order. build-ledger warns about the same thing; repeating it here
  // is deliberate, because a silently ambiguous DB is just as bad as a ledger.
  const duplicateFiled = [...byId.entries()]
    .filter(([, list]) => list.filter((g) => g.filed).length > 1)
    .map(([id, list]) => ({
      cites_id: id,
      bases: list.filter((g) => g.filed).map((g) => g.base),
    }));

  return {
    listFile,
    listData,
    groups,
    publications,
    citations,
    duplicateFiled,
    reportFileCount: reports.length,
  };
}

// ---------------------------------------------------------------------------
// Writing
// ---------------------------------------------------------------------------

const INSERT_PUBLICATION = `
INSERT INTO publications (
  cites_id, title, authors, venue, year, cited_by_at_snapshot, paper_url,
  cites_url, exhibit_base, filed, in_snapshot, status, pages_expected,
  pages_captured, pages_complete, snapshot_date)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;

const INSERT_CITATION = `
INSERT INTO citations (${COLUMNS.slice(1).join(", ")})
VALUES (${COLUMNS.slice(1).map(() => "?").join(", ")})`;

const PUBLICATION_FIELDS = [
  "cites_id",
  "title",
  "authors",
  "venue",
  "year",
  "cited_by_at_snapshot",
  "paper_url",
  "cites_url",
  "exhibit_base",
  "filed",
  "in_snapshot",
  "status",
  "pages_expected",
  "pages_captured",
  "pages_complete",
  "snapshot_date",
];

function writePublications(db, publications) {
  const stmt = db.prepare(INSERT_PUBLICATION);
  for (const p of publications) {
    stmt.run(...PUBLICATION_FIELDS.map((k) => p[k]));
  }
}

function writeCitations(db, rows) {
  const stmt = db.prepare(INSERT_CITATION);
  for (const r of rows) {
    stmt.run(...COLUMNS.slice(1).map((k) => {
      const v = r[k];
      return v === undefined ? null : v;
    }));
  }
}

function writeMeta(db, data) {
  const stmt = db.prepare("INSERT OR REPLACE INTO meta(key, value) VALUES (?, ?)");
  const values = {
    schema_version: String(SCHEMA_VERSION),
    built_at: new Date().toISOString(),
    snapshot_date: data.listData.snapshot_date || "",
    snapshot_source: data.listData.source || "",
    publication_list_file: `Exhibits/Supporting/${data.listFile}`,
    report_file_count: String(data.reportFileCount),
    publications_total: String((data.listData.publications || []).length),
    // Kept in the file itself so anyone opening the DB is told what it is.
    role:
      "LOOKUP AID ONLY. Authoritative figures come from citation-ledger-<snapshot>.csv " +
      "written by tools/build-ledger.js. If the two disagree, the CSV is right.",
    filed_rule: "citations.filed = 1 means the exhibit PDF is currently in Exhibits/PDFs (Archive excluded).",
  };
  for (const [k, v] of Object.entries(values)) stmt.run(k, String(v));
}

function buildFull(db, data) {
  db.exec("BEGIN");
  try {
    db.exec("DELETE FROM citations");
    db.exec("DELETE FROM publications");
    writePublications(db, data.publications);
    writeCitations(db, data.citations);
    writeMeta(db, data);
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

// ---------------------------------------------------------------------------
// Reconciliation
// ---------------------------------------------------------------------------

// Recompute the filed totals straight from the reports through tally.js -- the
// same call build-ledger makes -- and compare with what is in the DB. Any
// difference is a bug in one of the two and must be reported, not smoothed over.
function reconcile(db) {
  const groups = tally.groupReports(SUPPORT_DIR, PDF_DIR);
  const expected = tally.emptyTally();
  let pages = 0;
  for (const g of groups.values()) {
    tally.addTally(expected, tally.tallyEntries(g.entries));
    pages += g.pages.length;
  }

  const row = db
    .prepare(
      `SELECT
         COUNT(*) AS records,
         SUM(is_highlighted) AS independent,
         SUM(CASE WHEN is_highlighted = 1 AND confirm_state = 'confirmed' THEN 1 ELSE 0 END) AS independent_confirmed,
         SUM(CASE WHEN is_highlighted = 1 AND confirm_state = 'unverified-coverage' THEN 1 ELSE 0 END) AS independent_coverage,
         SUM(CASE WHEN status = 'DEPENDENT' THEN 1 ELSE 0 END) AS dependent,
         SUM(CASE WHEN status = 'SELF (PI)' THEN 1 ELSE 0 END) AS self_pi,
         SUM(CASE WHEN status = 'SELF (FORMER PI)' THEN 1 ELSE 0 END) AS self_former_pi,
         SUM(CASE WHEN status = 'REVIEW' THEN 1 ELSE 0 END) AS review,
         SUM(CASE WHEN language_flag <> '' THEN 1 ELSE 0 END) AS non_english,
         SUM(CASE WHEN withheld_for_language = 1 THEN 1 ELSE 0 END) AS non_english_withheld,
         SUM(CASE WHEN is_non_english = 0 THEN 1 ELSE 0 END) AS english_records,
         SUM(CASE WHEN is_non_english = 0 AND is_highlighted = 1 THEN 1 ELSE 0 END) AS english_independent,
         SUM(CASE WHEN is_primary_copy = 1 THEN 1 ELSE 0 END) AS unique_records,
         SUM(CASE WHEN is_primary_copy = 1 AND is_highlighted = 1 THEN 1 ELSE 0 END) AS unique_independent
       FROM citations WHERE filed = 1`
    )
    .get();

  const pubFiled = Number(
    db.prepare("SELECT COUNT(*) AS n FROM publications WHERE filed = 1").get().n
  );

  const checks = [
    ["publications filed", pubFiled, groups.size],
    ["citation records", Number(row.records), expected.records],
    ["independent (countable)", Number(row.independent), expected.independent],
    ["  externally confirmed", Number(row.independent_confirmed), expected.independent_confirmed],
    ["  Scholar list only", Number(row.independent_coverage), expected.independent_coverage],
    ["dependent", Number(row.dependent), expected.dependent],
    ["self (PI)", Number(row.self_pi), expected.self_pi],
    ["self (former PI)", Number(row.self_former_pi), expected.self_former_pi],
    ["awaiting review", Number(row.review), expected.review],
    ["flagged non-English", Number(row.non_english), expected.non_english],
    ["  withheld for language", Number(row.non_english_withheld), expected.non_english_withheld],
    ["English citation records", Number(row.english_records), expected.english_records],
    ["English independent", Number(row.english_independent), expected.english_independent],
    ["distinct papers", Number(row.unique_records), expected.unique_records],
    ["distinct independent", Number(row.unique_independent), expected.unique_independent],
  ];

  const mismatches = checks.filter(([, a, b]) => a !== b);
  return { checks, mismatches, pages, row, pubFiled };
}

// ---------------------------------------------------------------------------
// --pub=<base>: upsert one publication after a capture
// ---------------------------------------------------------------------------

// Used by run-batch.js so each capture refreshes the catalog without a full
// rebuild. Safe when a run was blocked: if no report file exists for the base,
// nothing at all is written, so a failed attempt cannot empty a good publication.
function upsertPublication(baseArg) {
  // Accept either the publication base or one page's file base.
  const base = baseArg.replace(/\.report\.json$/, "").replace(/-p\d+$/, "");
  const exists = fs.existsSync(DB_PATH);
  if (!exists) {
    console.log("[catalog] No catalog yet; doing a full build instead of a single upsert.");
    return main([]);
  }

  // A catalog written by an older schema must be rebuilt, not appended to. The
  // batch hook treats a rebuild-needed answer as "skip this upsert", so an
  // out-of-date DB never receives a partial write.
  {
    const probe = new DatabaseSync(DB_PATH, { readOnly: true });
    let version = "";
    try {
      const row = probe.prepare("SELECT value FROM meta WHERE key = 'schema_version'").get();
      version = row ? row.value : "";
    } catch {
      version = "";
    } finally {
      probe.close();
    }
    if (version !== String(SCHEMA_VERSION)) {
      console.log(
        `[catalog] Catalog schema is ${version || "unknown"}, this tool expects ${SCHEMA_VERSION}. ` +
          `Run: node tools/build-catalog.js  (nothing was changed)`
      );
      process.exitCode = 3;
      return;
    }
  }

  const reports = readReports().filter((r) => r.pub === base);
  if (!reports.length) {
    console.log(
      `[catalog] No report file for "${base}" -- nothing written. ` +
        `A blocked or empty capture leaves the catalog as it was.`
    );
    return;
  }

  const { file: listFile, data: listData } = readSnapshot();
  const filedBases = tally.filedBases(PDF_DIR);
  const groups = groupByBase(reports, filedBases);
  const g = groups.get(base);
  if (!g) throw new Error(`Grouping produced nothing for ${base}`);

  const citesId = g.cites_id || `base:${g.base}`;
  const rows = [];
  for (const page of g.pages) {
    const ctx = {
      cites_id: citesId,
      base: g.base,
      file: page.file,
      page: page.page,
      filed: g.filed,
      archived: page.archived,
      snapshot: page.snapshot,
    };
    for (const e of page.entries) rows.push(citationRow(e, ctx));
  }
  applyPrimaryCopy(rows);
  applyEditions(rows);
  const snap = (listData.publications || []).find(
    (p) => tally.citesId(p.citesUrl) && tally.citesId(p.citesUrl) === g.cites_id
  );
  const citedBy = Number(snap && snap.citedBy) || 0;

  const db = new DatabaseSync(DB_PATH);
  try {
    db.exec("BEGIN");
    try {
      // Replace this base's rows only. Other bases sharing the cites id (an
      // older capture of the same publication) are left alone.
      db.prepare("DELETE FROM citations WHERE base = ?").run(base);
      writeCitations(db, rows);
      const existing = db
        .prepare("SELECT cites_id FROM publications WHERE cites_id = ?")
        .get(citesId);
      const pubRow = {
        cites_id: citesId,
        title: (snap && snap.title) || g.cited_title || base,
        authors: (snap && snap.authors) || g.cited_authors || "",
        venue: (snap && snap.venue) || g.cited_venue || "",
        year: (snap && snap.year) || "",
        cited_by_at_snapshot: citedBy,
        paper_url: (snap && snap.paperUrl) || g.paper_url || "",
        cites_url: (snap && snap.citesUrl) || g.cites_url || "",
        exhibit_base: base,
        filed: g.filed ? 1 : 0,
        in_snapshot: snap ? 1 : 0,
        status: g.filed ? "captured" : "archived-not-filed",
        pages_expected: citedBy ? tally.expectedPages(citedBy) : 0,
        pages_captured: g.filed ? g.pages.length : 0,
        pages_complete: g.filed && g.pages.length >= (citedBy ? tally.expectedPages(citedBy) : 0) ? 1 : 0,
        snapshot_date: [...g.snapshots][0] || listData.snapshot_date || "",
      };
      if (existing) {
        db.prepare(
          `UPDATE publications SET title=?, authors=?, venue=?, year=?,
             cited_by_at_snapshot=?, paper_url=?, cites_url=?, exhibit_base=?,
             filed=?, in_snapshot=?, status=?, pages_expected=?,
             pages_captured=?, pages_complete=?, snapshot_date=?
           WHERE cites_id=?`
        ).run(
          pubRow.title,
          pubRow.authors,
          pubRow.venue,
          pubRow.year,
          pubRow.cited_by_at_snapshot,
          pubRow.paper_url,
          pubRow.cites_url,
          pubRow.exhibit_base,
          pubRow.filed,
          pubRow.in_snapshot,
          pubRow.status,
          pubRow.pages_expected,
          pubRow.pages_captured,
          pubRow.pages_complete,
          pubRow.snapshot_date,
          citesId
        );
      } else {
        writePublications(db, [pubRow]);
      }
      db.prepare("INSERT OR REPLACE INTO meta(key, value) VALUES ('last_upsert_base', ?)").run(base);
      db.prepare("INSERT OR REPLACE INTO meta(key, value) VALUES ('last_upsert_at', ?)").run(
        new Date().toISOString()
      );
      db.exec("COMMIT");
    } catch (e) {
      db.exec("ROLLBACK");
      throw e;
    }
    const t = tally.tallyEntries(rows.map((r) => ({
      status: r.status,
      confirm_state: r.confirm_state,
      language_flag: r.language_flag,
    })));
    console.log(
      `[catalog] Upserted ${base}: ${rows.length} record(s), ` +
        `${t.independent} independent, filed=${g.filed ? "yes" : "no"} (cites=${g.cites_id || "?"})`
    );
  } finally {
    db.close();
  }
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------

function argValue(name) {
  const hit = process.argv.slice(2).find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : "";
}

function main() {
  const pub = argValue("pub");
  if (pub) return upsertPublication(pub);

  const data = collect();
  const check = process.argv.includes("--check");
  if (check) {
    console.log(`[catalog] --check: ${data.reportFileCount} report file(s), ` +
      `${data.publications.length} publication(s), ${data.citations.length} citation row(s). Nothing written.`);
    return;
  }

  fs.mkdirSync(DB_DIR, { recursive: true });
  // A rebuild replaces the file. WAL sidecars go too, or a stale -wal could be
  // replayed into the new database.
  for (const suffix of ["", "-wal", "-shm"]) {
    const p = DB_PATH + suffix;
    if (fs.existsSync(p)) fs.rmSync(p);
  }

  const db = new DatabaseSync(DB_PATH);
  try {
    db.exec(DDL);
    buildFull(db, data);

    const totalRows = db.prepare("SELECT COUNT(*) AS n FROM citations").get().n;
    const filedRows = db.prepare("SELECT COUNT(*) AS n FROM citations WHERE filed = 1").get().n;
    const { checks, mismatches } = reconcile(db);

    for (const dup of data.duplicateFiled) {
      console.log(`[catalog] WARNING: cites=${dup.cites_id} has ${dup.bases.length} filed exhibit sets`);
      for (const b of dup.bases) console.log(`           ${b}`);
    }
    if (data.duplicateFiled.length) {
      console.log(
        "[catalog]          More than one filed exhibit set for one citing list.\n" +
          "           Move the superseded PDFs to Exhibits/Archive with a SUPERSEDED- prefix."
      );
    }

    console.log(`[catalog] Database: ${DB_PATH}`);
    console.log(`[catalog] Snapshot: ${data.listData.snapshot_date} from ${data.listFile}`);
    console.log(
      `[catalog] Report files read: ${data.reportFileCount}  ` +
        `(all observed rows kept; filed flag decides what counts)`
    );
    console.log(`[catalog] Publications: ${data.publications.length} row(s)`);
    console.log(`[catalog] Citation rows: ${totalRows} total, ${filedRows} filed`);
    console.log(`\n[catalog] Reconciled against tally.js (what build-ledger.js counts):`);
    for (const [label, db_, ledger] of checks) {
      const mark = db_ === ledger ? "ok  " : "DIFF";
      console.log(`           ${mark} ${label.padEnd(24)} db=${String(db_).padEnd(6)} ledger=${ledger}`);
    }
    if (mismatches.length) {
      console.log(
        `\n[catalog] MISMATCH with the ledger rule. Do not quote either figure until\n` +
          `           this is explained. The ledger CSV stays authoritative.`
      );
      process.exitCode = 1;
    } else {
      console.log(
        `\n[catalog] Totals reconcile. Quote figures from\n` +
          `           Exhibits/Supporting/citation-ledger-${data.listData.snapshot_date}.csv --\n` +
          `           this database is a lookup aid, not the ledger.`
      );
    }
  } finally {
    db.close();
  }
}

if (require.main === module) {
  try {
    main();
  } catch (e) {
    console.error(`[catalog] ${e.stack || e.message}`);
    process.exitCode = 1;
  }
}

module.exports = { DB_PATH, COLUMNS, collect, reconcile, SCHEMA_VERSION };

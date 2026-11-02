// Build the citation catalog: the durable SQLite store for the citation record.
//
//   node tools/build-catalog.js              MERGE PLAN ONLY - writes nothing
//   node tools/build-catalog.js --write      apply the merge to the database
//   node tools/build-catalog.js --pub=<base> upsert one publication (batch hook)
//
// WHAT THIS DATABASE IS.
//
//   It is the PRIMARY, durable store for the independent-citation record. It is
//   NOT rebuilt from scratch and MUST NEVER be deleted. Every row carries a
//   `row_uid` minted once on insert and never reused, so a number quoted to a
//   reviewer, an attorney or USCIS still means the same row next month.
//
//   Deleting Database/citation-catalog.sqlite is NOT safe. The file is the
//   authoritative copy of the data; the report JSON in Exhibits/Supporting is
//   the evidence behind it and the ledger CSV is the derived report. If this
//   file is lost, every row_uid ever quoted with it is lost too. A verified
//   snapshot is taken with VACUUM INTO into Database/Backups before any
//   structural change, and the newest snapshots are tracked in git.
//
//   MERGE, never replace. Rows are upserted on the natural key
//   (base, page, row_index), which is unique across the whole table. New rows
//   are inserted, rows whose content changed are updated, and row_uid is minted
//   only on insert. A row whose report file has gone away is KEPT and flagged,
//   never deleted. A re-capture under a new dated base creates new rows and the
//   old ones are retired via superseded_at, so capture history accumulates.
//
//   THE PRE-WRITE GUARD decides whether anything is saved. Before writing, the
//   rows the merge would produce are compared with the live table. If any
//   existing row would vanish, or any row_uid would be re-pointed at a different
//   (base, page, row_index), the build refuses to write and exits non-zero.
//
//   Duplicate versions of one citing paper -- a preprint and its final article,
//   or a publisher copy and a repository copy -- are a first-class case. Scholar
//   shows both rows and the exhibit marks both, so both are stored. work_key
//   (tally.paperKey) groups copies of the same work and is_primary_copy marks
//   the copy a distinct-paper count uses, both imported from tally.js. The
//   pointer to the copy that stands is stands_for_row_uid, which names a ROW.
//   The captured duplicate_of holds Scholar's cid, which is NOT a row key: one
//   cid appears on many rows across citing lists, so it is kept as provenance
//   only and never used to resolve a row.
//
//   Counting rules are imported from tools/tally.js -- the single definition of
//   what counts -- and nothing here reimplements one. The build ends by
//   re-deriving the filed totals straight from the reports through tally.js and
//   comparing, printing ok/DIFF per figure.
//
//   WHEN THE DATABASE AND THE REPORT-DERIVED FIGURES DISAGREE: the disagreement
//   is a defect to investigate, and no figure may be quoted for the packet until
//   it is resolved. The build exits non-zero. Neither side is "right" by rule
//   any more; a DIFF means one of the two is wrong and nobody yet knows which.
//
//   Rows are kept for EVERY report ingested, including superseded captures, each
//   with a `filed` flag and, once retired, a superseded_at stamp. Default totals
//   in query-catalog.js are active-only (filed = 1 and not superseded), which is
//   exactly the current Scholar record.
//
//   The database lives in Database/ at the project root, NOT under Exhibits/.
//   Exhibits/ is the evidence folder that gets reviewed, zipped and filed.

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
const BACKUP_DIR = path.join(DB_DIR, "Backups");

const SCHEMA_VERSION = 5;

// A short opaque token, not a bare integer, so it reads as an identifier when
// quoted in a sentence: "row cit-000123 is contradicted". Minted from the id
// the row already had on 2026-11-02 so the user can quote either number and both
// resolve; after the migration the id column is frozen and row_uid is the key.
const rowUidForId = (id) => `cit-${String(id).padStart(6, "0")}`;

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

// Every report JSON ingested into the store, filed or not. Archive is included
// on purpose: a superseded capture is history worth querying, and the `filed`
// flag is what keeps it out of the totals.
//
// This reads the TOP LEVEL of Supporting/ and Archive/ only. It deliberately
// does not descend into the Pre-* backup subfolders -- see scanSubfolders().
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
        // merge of everything else. Say so and skip it.
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

// The Pre-* subfolders, read for DETECTION and never for ingest.
//
// archive-exhibits.js moves a retired capture's workpapers into
// Supporting/Pre-recapture-<date>/ and reapply-language.js backs up a report
// before rewriting a rule flag into Supporting/Pre-rule-reapply-<date>/. A
// non-recursive scan made those invisible, which is how the Recognition capture
// of 2026-10-30 was silently forgotten on rebuild: the archive move removed its
// workpapers from the scanned folder and the next build concluded the capture had
// never existed. Under the durable-store model a rebuild must not be the thing
// that decides what history exists, so the subfolders are scanned and anything
// they hold that the store does not know about is REPORTED.
//
// They are not ingested, for two verified reasons (2026-11-02):
//   - Pre-rule-reapply-2026-11-01 holds 166 page-sets that are PRIOR VERSIONS of
//     captures still live at the top level -- same snapshot stamp to the second,
//     same entries, differing only in language_flag. All 52 of those prior values
//     are already preserved inside the live report as language_flag_captured, so
//     ingesting them would add 1482 rows that collide on (base, page, row_index)
//     with live rows and repeat information the store already holds.
//   - Pre-recapture-2026-11-02 holds the retired Recognition capture, 30 rows,
//     whose replacement (cites=4082711194076959494, 2026-11-02) is filed and
//     contains all 15 of its citing titles. The user decided on 2026-11-02 that
//     the store mirrors the current Scholar record, so these stay out.
//
// Reporting is what makes that a recorded decision rather than a silent loss.
function scanSubfolders(knownBases) {
  const found = [];
  for (const dir of [SUPPORT_DIR, ARCHIVE_DIR]) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      const sub = path.join(dir, e.name);
      let names;
      try {
        names = fs.readdirSync(sub);
      } catch {
        continue;
      }
      for (const name of names) {
        if (!name.endsWith(".report.json")) continue;
        const pageBase = name.replace(/\.report\.json$/, "");
        found.push({
          folder: e.name,
          file: name,
          pageBase,
          pubBase: pageBase.replace(/-p\d+$/, ""),
          dir: sub,
          entries: (() => {
            try {
              return (JSON.parse(fs.readFileSync(path.join(sub, name), "utf8")).entries || []).length;
            } catch {
              return 0;
            }
          })(),
        });
      }
    }
  }
  // Group by publication base and ask whether the store has ever seen it.
  // Deduped by PAGE first: reapply-language and archive-exhibits each keep their
  // own backup folder, so one retired page legitimately appears in two of them
  // and must be counted once.
  const byPage = new Map();
  for (const f of found) {
    const prev = byPage.get(f.pageBase);
    if (prev) {
      if (!prev.folders.includes(f.folder)) prev.folders.push(f.folder);
      prev.entries = Math.max(prev.entries, f.entries);
      continue;
    }
    byPage.set(f.pageBase, { ...f, folders: [f.folder] });
  }
  const byPub = new Map();
  for (const f of byPage.values()) {
    if (!byPub.has(f.pubBase)) byPub.set(f.pubBase, []);
    byPub.get(f.pubBase).push(f);
  }
  const unknown = [...byPub.values()].filter((list) => !knownBases.has(list[0].pubBase));
  return { scanned: found.length, distinctPages: byPage.size, unknown };
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
      dir: r.dir,
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
  "row_uid",
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
  // 1 when the stored external record really describes the same work, 0 when the
  // title overlap was too thin to believe and the record has been disregarded.
  // Queryable on purpose: "which rows rest on a match we would not accept today"
  // is a question a packet reviewer asks, and the answer should not require
  // re-running the matcher over 168 reports. Written by the corroboration step
  // and re-derived by tools/reapply-corroboration.js.
  "external_match_credible",
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
  // Durable identity, provenance and retirement (schema v4).
  "origin_dir",
  "work_key",
  "stands_for_row_uid",
  "superseded_at",
  "replaced_by_row_uid",
  "supersede_reason",
  "external_matched",
];

// Columns a merge may refresh on an existing row. row_uid, id, base, page and
// row_index are absent on purpose: the natural key never changes after insert
// and neither does the identifier minted from it.
const MUTABLE_COLUMNS = COLUMNS.filter(
  (c) => !["id", "row_uid", "base", "page", "row_index"].includes(c)
);

// Comparison form of a CREATE statement: SQLite keeps the text it was given but
// not necessarily the comments or line breaks around it, so a definition check
// has to ignore both. Anything that changes the query itself still differs.
const canonSql = (s) =>
  String(s || "")
    .split("\n")
    .filter((line) => !/^\s*--/.test(line))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/;+$/, "")
    .toLowerCase();

// The views the migration must (re)create: every view DDL defines. Read from
// DDL rather than a list, so adding a view to the schema cannot leave a
// migrated file without it.
function ddlViewNames() {
  const names = [];
  for (const m of DDL.matchAll(/CREATE VIEW (\w+) AS/g)) names.push(m[1]);
  return names;
}

// One CREATE statement out of DDL, so the migration recreates a view with the
// definition a fresh build uses instead of a second copy that could drift.
// Statements are separated by a line ending in ';', and a comment line never
// closes a statement, so the scan skips those.
function ddlView(name) {
  const statements = [];
  let current = "";
  for (const line of DDL.split("\n")) {
    current += line + "\n";
    if (!/^\s*--/.test(line) && /;\s*$/.test(line)) {
      statements.push(current);
      current = "";
    }
  }
  const hit = statements.find((s) =>
    new RegExp(`^\\s*CREATE\\s+VIEW\\s+${name}\\s+AS\\b`, "m").test(s)
  );
  if (!hit) throw new Error(`DDL has no view named ${name}.`);
  return hit;
}

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
--
-- Identity, schema v4. The id column is the legacy integer alias, frozen on
-- 2026-11-02 so numbers already quoted still resolve; it is never renumbered
-- again. row_uid is the identifier to quote from now on, minted once on insert
-- from the id the row had at migration time and never reused.
-- (base, page, row_index) is the natural key the merge upserts on -- unique
-- across the whole table, verified 2026-11-02. cites_id is NOT a row key: four
-- publications carry two dated base names under one cites_id.
CREATE TABLE citations (
  id                  INTEGER PRIMARY KEY,
  row_uid             TEXT UNIQUE NOT NULL,
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
  -- 1 when the stored external record really describes the same work, 0 when the
  -- title overlap was too thin to believe and the record has been disregarded.
  -- Queryable on purpose: "which rows rest on a match we would not accept today"
  -- is a question a packet reviewer asks, and the answer should not require
  -- re-running the matcher over 168 reports.
  external_match_credible INTEGER NOT NULL DEFAULT 1,
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
  report_file         TEXT NOT NULL DEFAULT '',
  -- Provenance and durable lifecycle, schema v4.
  --   origin_dir            the folder its report file was read from, relative
  --                         to the project root, so a row states where it came
  --                         from without a join.
  --   work_key              tally.paperKey -- the work this row represents.
  --                         Copies of one citing paper (a preprint and its
  --                         final article, a publisher copy and a repository or
  --                         thesis copy) share it, which is what makes the
  --                         duplicate relationship queryable across capture
  --                         sets rather than only inside one publication.
  --   stands_for_row_uid    the row_uid of the copy that stands for this work,
  --                         empty when this row is that copy. A pointer to a
  --                         ROW. The captured duplicate_of holds Scholar's cid,
  --                         which repeats across citing lists -- one cid matched
  --                         three rows on 2026-11-02 -- so it is provenance only
  --                         and must never be used to resolve a row.
  --   superseded_at         set once when a row's exhibit was archived or
  --                         re-captured. The row is KEPT; it is excluded from
  --                         every default count. Never a delete.
  --   replaced_by_row_uid   the row_uid that took its place, where a re-capture
  --                         produced a one-for-one replacement.
  --   supersede_reason      why it was retired, in plain language.
  --   external_matched      the authors an external record contradicted, carried
  --                         through from the report so a contradicted row names
  --                         the overlap without re-reading the JSON.
  origin_dir          TEXT NOT NULL DEFAULT '',
  work_key            TEXT NOT NULL DEFAULT '',
  stands_for_row_uid  TEXT NOT NULL DEFAULT '',
  superseded_at       TEXT NOT NULL DEFAULT '',
  replaced_by_row_uid TEXT NOT NULL DEFAULT '',
  supersede_reason    TEXT NOT NULL DEFAULT '',
  external_matched    TEXT NOT NULL DEFAULT '[]'
);

CREATE UNIQUE INDEX idx_citations_natural_key ON citations(base, page, row_index);
CREATE INDEX idx_citations_row_uid ON citations(row_uid);
CREATE INDEX idx_citations_work_key ON citations(cites_id, work_key);
CREATE INDEX idx_citations_superseded ON citations(superseded_at);

CREATE INDEX idx_citations_cites_id ON citations(cites_id);
CREATE INDEX idx_citations_status ON citations(status);
CREATE INDEX idx_citations_work_type ON citations(work_type);
CREATE INDEX idx_citations_confirm ON citations(confirm_state);
CREATE INDEX idx_citations_filed ON citations(filed);
CREATE INDEX idx_citations_patent ON citations(patent_number);
CREATE INDEX idx_citations_edition ON citations(edition_key);
CREATE INDEX idx_citations_non_english ON citations(is_non_english);

-- The rows that make up the current record: filed exhibits that have not been
-- retired. Every default count and every listing reads through this, which is
-- what keeps a quoted figure equal to the exhibit packet rather than to the sum
-- of every capture ever made. Widen with --all to see superseded history.
CREATE VIEW v_active AS
SELECT c.* FROM citations c WHERE c.filed = 1 AND c.superseded_at = '';

-- The unresolved citations, bucketed the way a person reads them. This is the
-- queue behind the review subcommand of tools/query-catalog.js and the
-- dashboard's review section, so both quote the same rows and the same buckets.
--
--   1 contradicted        an external record publishes a complete author list
--                         that overlaps the cited paper's, so Scholar's list is
--                         wrong. Since 2026-11-02 a credible overlap DECIDES the
--                         row as DEPENDENT or a self-citation instead of leaving
--                         it here, so a re-applied corpus has no rows in this
--                         bucket; it is kept because a capture predating that
--                         date still carries the state.
--   2 external-no-overlap an external record has a complete list with no
--                         overlap, but the row was not promoted. After the
--                         2026-11-02 decision the only rows left here are the
--                         ones that CANNOT be promoted because the entry is
--                         non-English and no translations are being obtained.
--   3 unresolvable        nothing credible to compare against -- neither PubMed
--                         nor OpenAlex indexes the paper (or the look-up's title
--                         overlap was too thin to be the same work) and
--                         Scholar's own list is incomplete.
--
-- Bucketing reads attention_reason, the string the corroboration step wrote at
-- the time, rather than external_source alone: a row can name a source and
-- still be unresolvable when that source returned nothing usable for it.
CREATE VIEW v_review AS
SELECT
  c.row_uid,
  CASE
    WHEN c.attention_reason LIKE 'contradicted%' THEN '1 contradicted'
    WHEN c.attention_reason LIKE 'external list shows no overlap%' THEN '2 external-no-overlap'
    ELSE '3 unresolvable'
  END AS bucket,
  c.cites_id,
  p.title AS cited_work,
  p.venue AS cited_venue,
  p.year AS cited_year,
  c.cid,
  c.title,
  COALESCE(NULLIF(c.authors_used, ''), c.authors) AS scholar_byline,
  c.truncated,
  c.status,
  c.confirm_state,
  c.attention_reason AS why,
  c.external_source,
  c.external_url,
  c.external_authors,
  -- Both overlap columns are exposed because they come from different steps and
  -- are not interchangeable. external_matched is what the corroboration step
  -- recorded against the external list and is the one populated on a contradicted
  -- row; matched_authors is the older Scholar-side field and is empty here. A
  -- reviewer wants whichever names the overlap, so read external_matched first
  -- and fall back -- showing an empty cell on a row that was contradicted by a
  -- specific name would hide the reason the row is in the queue at all.
  c.external_matched,
  c.matched_authors,
  c.language_flag,
  c.link,
  c.base,
  c.page,
  c.row_index,
  c.id
FROM citations c
LEFT JOIN publications p ON p.cites_id = c.cites_id
WHERE c.status = 'REVIEW' AND c.filed = 1 AND c.superseded_at = ''
ORDER BY bucket, c.base, c.page, c.row_index;

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
  c.superseded_at,
  c.work_type_evidence AS evidence,
  p.title AS cited_title,
  p.cites_id,
  c.base,
  c.page,
  c.row_index,
  c.row_uid,
  c.id
FROM citations c
LEFT JOIN publications p ON p.cites_id = c.cites_id
WHERE c.work_type IN ('patent', 'patent-application');

-- The rows the ledger counts as independent: active exhibits only, and
-- is_highlighted comes from tally.isHighlighted, so it already excludes a
-- non-English entry or one whose author list no source has settled.
CREATE VIEW v_independent_counted AS
SELECT c.*
FROM citations c
WHERE c.is_highlighted = 1 AND c.filed = 1 AND c.superseded_at = '';

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
  c.superseded_at,
  c.row_uid,
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
  -- duplicate_of is Scholar's cid, which repeats across citing lists and so does
  -- not identify a row. stands_for_row_uid is the pointer that does: it names the
  -- single row that stands for the work.
  c.stands_for_row_uid,
  c.title,
  c.language_flag,
  c.status,
  c.is_highlighted,
  c.edition_note,
  c.base,
  c.filed,
  c.superseded_at,
  c.row_uid,
  c.id
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

-- Per-publication rollup. Totals are active-only -- filed and not superseded --
-- so neither an archived capture nor a retired re-capture can add to a count.
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
  SUM(CASE WHEN c.filed = 1 AND c.superseded_at = '' THEN 1 ELSE 0 END) AS records,
  SUM(CASE WHEN c.filed = 1 AND c.superseded_at = '' AND c.is_highlighted = 1 THEN 1 ELSE 0 END) AS independent,
  SUM(CASE WHEN c.filed = 1 AND c.superseded_at = '' AND c.is_highlighted = 1 AND c.confirm_state = 'confirmed' THEN 1 ELSE 0 END) AS independent_confirmed,
  SUM(CASE WHEN c.filed = 1 AND c.superseded_at = '' AND c.is_highlighted = 1 AND c.confirm_state = 'unverified-coverage' THEN 1 ELSE 0 END) AS independent_coverage,
  SUM(CASE WHEN c.filed = 1 AND c.superseded_at = '' AND c.status = 'DEPENDENT' THEN 1 ELSE 0 END) AS dependent,
  SUM(CASE WHEN c.filed = 1 AND c.superseded_at = '' AND c.status = 'SELF (PI)' THEN 1 ELSE 0 END) AS self_pi,
  SUM(CASE WHEN c.filed = 1 AND c.superseded_at = '' AND c.status = 'SELF (FORMER PI)' THEN 1 ELSE 0 END) AS self_former_pi,
  SUM(CASE WHEN c.filed = 1 AND c.superseded_at = '' AND c.status = 'REVIEW' THEN 1 ELSE 0 END) AS review,
  SUM(CASE WHEN c.filed = 1 AND c.superseded_at = '' AND c.language_flag <> '' THEN 1 ELSE 0 END) AS non_english,
  SUM(CASE WHEN c.filed = 1 AND c.superseded_at = '' AND c.withheld_for_language = 1 THEN 1 ELSE 0 END) AS non_english_withheld,
  SUM(CASE WHEN c.filed = 1 AND c.superseded_at = '' AND c.is_non_english = 0 THEN 1 ELSE 0 END) AS english_records,
  SUM(CASE WHEN c.filed = 1 AND c.superseded_at = '' AND c.is_non_english = 0 AND c.is_highlighted = 1 THEN 1 ELSE 0 END) AS english_independent,
  SUM(CASE WHEN c.filed = 1 AND c.superseded_at = '' AND c.work_type IN ('patent','patent-application') THEN 1 ELSE 0 END) AS patents,
  SUM(CASE WHEN c.filed = 1 AND c.superseded_at = '' AND (c.needs_attention = 1 OR c.status = 'REVIEW') THEN 1 ELSE 0 END) AS needs_attention
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
    external_match_credible: bool(
      entry.external_match_credible === undefined ? true : entry.external_match_credible,
    ),
    matched_authors: json(asArray(entry.matched_authors)),
    matched_pi: json(asArray(entry.matched_pi)),
    matched_former_pi: json(asArray(entry.matched_former_pi)),
    full_authors: json(asArray(entry.full_authors)),
    pubmed_near_miss: json(entry.pubmed_near_miss),
    openalex_near_miss: json(entry.openalex_near_miss),
    is_highlighted: bool(tally.isHighlighted(entry)),
    // The work this row represents, straight from tally.paperKey. Two copies of
    // one citing paper -- a preprint and its published article, a publisher copy
    // and a repository or thesis copy -- share this key, which is what lets the
    // duplicate relationship be queried across capture sets and not only inside
    // one publication's list. The pointer to the copy that stands is
    // stands_for_row_uid, resolved after insert because it names a row_uid.
    paper_key: tally.paperKey(entry),
    work_key: tally.paperKey(entry),
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
    // Which folder the report was read from, relative to the project root, so a
    // row states its own provenance. Supporting/, Archive/, or a Pre-* subfolder.
    origin_dir: ctx.origin_dir || "",
    external_matched: json(asArray(entry.external_matched)),
    // Retirement is a property of the store, not of a report, so a fresh row
    // starts unretired. The merge preserves whatever a previous run stamped.
    superseded_at: "",
    replaced_by_row_uid: "",
    supersede_reason: "",
    stands_for_row_uid: "",
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
        origin_dir: path.relative(ROOT, page.dir).split(path.sep).join("/"),
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

  // Captures the store has never seen, sitting in a Pre-* backup subfolder. This
  // is the guard against the silent history loss found on 2026-11-02: the builder
  // reports them instead of quietly forgetting they exist. Ingest is a separate,
  // deliberate decision (see scanSubfolders), never a side effect of a rebuild.
  const knownBases = new Set(groups.keys());
  const subfolderScan = scanSubfolders(knownBases);

  return {
    listFile,
    listData,
    groups,
    publications,
    citations,
    duplicateFiled,
    subfolderScan,
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

// Column values in COLUMNS order, with the natural-key fields normalised so an
// absent row_index is a stable sentinel rather than NULL. A UNIQUE index treats
// each NULL as distinct, which would let two rows claim the same page position.
const NO_INDEX = -1;
const keyOf = (base, page, rowIndex) =>
  `${base}\u0000${Number(page) || 1}\u0000${rowIndex === null || rowIndex === undefined ? NO_INDEX : Number(rowIndex)}`;

function valuesOf(r) {
  return COLUMNS.slice(1).map((k) => {
    const v = r[k];
    if (k === "row_index" && (v === null || v === undefined)) return NO_INDEX;
    return v === undefined ? null : v;
  });
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
    // Kept in the file itself so anyone opening the DB is told what it is and
    // what to do when the two records disagree.
    role:
      "PRIMARY DURABLE STORE for the independent-citation record. Do not delete this file; " +
      "row_uid values minted here are quoted in review sheets and must never be reused. " +
      "citation-ledger-<snapshot>.csv written by tools/build-ledger.js is a DERIVED REPORT of " +
      "these rows. If the two disagree, that is a defect to investigate and NO figure may be " +
      "quoted for the packet until it is resolved.",
    filed_rule:
      "citations.filed = 1 means the exhibit PDF is currently in Exhibits/PDFs (Archive excluded). " +
      "superseded_at <> '' means the row was retired by an archive or re-capture and is kept as " +
      "history; v_active is filed and not superseded, which is the current Scholar record.",
    identity_rule:
      "row_uid is the identifier to quote. id is its frozen legacy alias. The natural key is " +
      "(base, page, row_index) and is unique across the table. duplicate_of holds Scholar's cid " +
      "and is NOT a row key -- a cid repeats across citing lists; stands_for_row_uid is the " +
      "pointer that resolves to one row.",
  };
  for (const [k, v] of Object.entries(values)) stmt.run(k, String(v));
}

// ---------------------------------------------------------------------------
// Migration from schema v3, in place
// ---------------------------------------------------------------------------

// Ids are permanent from schema v4 onward, so the v3 file is migrated rather
// than rebuilt. Nothing here deletes a row: columns are added, backfilled from
// the row's own current values, then indexed. A verified snapshot is taken first
// and the migration refuses to run without one.
// Structural, not just the version string. A migration that died part way --
// columns added but views not yet recreated -- must be detected and finished,
// because meta.schema_version is written last and would otherwise claim success.
// migrateV3toV4 is idempotent: every ALTER is guarded on the column being
// absent, the backfills are WHERE col = '', indexes are IF NOT EXISTS, and the
// retirement stamps only rows not already stamped.
function needsMigration(db) {
  let current = "";
  try {
    const row = db.prepare("SELECT value FROM meta WHERE key = 'schema_version'").get();
    current = row ? row.value : "";
  } catch {
    current = "";
  }
  const cols = tableColumns(db);
  const stored = new Map(
    db
      .prepare("SELECT name, sql FROM sqlite_master WHERE type = 'view'")
      .all()
      .map((r) => [r.name, r.sql])
  );
  const missingCols = [
    "row_uid",
    "origin_dir",
    "work_key",
    "stands_for_row_uid",
    "superseded_at",
    "replaced_by_row_uid",
    "supersede_reason",
    "external_matched",
    "external_match_credible",
  ].filter((c) => !cols.has(c));
  // Every view DDL defines must exist, and must say what DDL says. A view
  // cannot be ALTERed, so a definition edited after the fact only lands on a
  // rebuild -- checking the stored text means a later edit to v_review is
  // repaired automatically instead of silently serving last month's definition.
  const missingViews = [];
  const staleViews = [];
  for (const name of ddlViewNames()) {
    if (!stored.has(name)) {
      missingViews.push(name);
    } else if (canonSql(stored.get(name)) !== canonSql(ddlView(name))) {
      staleViews.push(name);
    }
  }
  return {
    current,
    needed:
      current !== String(SCHEMA_VERSION) ||
      missingCols.length > 0 ||
      missingViews.length > 0 ||
      staleViews.length > 0,
    missingCols,
    missingViews,
    staleViews,
  };
}

function tableColumns(db) {
  return new Set(db.prepare("PRAGMA table_info(citations)").all().map((c) => c.name));
}

// The prior rule state and the external contradiction live in the report JSON.
// Brought into the store once, at migration, so a contradicted row names its
// overlap without a caller re-reading 175 files.
function reportLookups() {
  const map = new Map();
  for (const r of readReports()) {
    for (const e of r.data.entries || []) {
      const page = Number(e.page || r.data.page || 1);
      const idx = Number.isFinite(Number(e.index)) ? Number(e.index) : NO_INDEX;
      map.set(keyOf(r.pub, page, idx), {
        external_matched: e.external_matched,
        origin_dir: path.relative(ROOT, r.dir).split(path.sep).join("/"),
      });
    }
  }
  return map;
}

function migrateV3toV4(db, { write }) {
  const before = db.prepare("SELECT COUNT(*) AS n FROM citations").get().n;
  const uidsBefore = db
    .prepare("SELECT id, base, page, row_index FROM citations ORDER BY id")
    .all();
  const have = tableColumns(db);
  const add = [
    ["row_uid", "TEXT NOT NULL DEFAULT ''"],
    ["origin_dir", "TEXT NOT NULL DEFAULT ''"],
    ["work_key", "TEXT NOT NULL DEFAULT ''"],
    ["stands_for_row_uid", "TEXT NOT NULL DEFAULT ''"],
    ["superseded_at", "TEXT NOT NULL DEFAULT ''"],
    ["replaced_by_row_uid", "TEXT NOT NULL DEFAULT ''"],
    ["supersede_reason", "TEXT NOT NULL DEFAULT ''"],
    ["external_matched", "TEXT NOT NULL DEFAULT '[]'"],
    // Default 1: a row captured before this column existed carries a match that
    // was accepted under the old matcher, and reapply-corroboration.js is what
    // sets it to 0 where the overlap turns out to be too thin.
    ["external_match_credible", "INTEGER NOT NULL DEFAULT 1"],
  ];
  console.log(
    `[catalog] Bringing the store to schema v${SCHEMA_VERSION} in place (${before} citation rows).`
  );
  if (!write) {
    console.log("[catalog]   plan only; pass --write to migrate.");
    return { migrated: true, write };
  }

  // Declared outside the transaction so the post-commit report can read them.
  let matched = 0;
  let deferredRows = [];
  let unresolved = 0;

  db.exec("BEGIN");
  try {
    for (const [name, type] of add) {
      if (have.has(name)) continue;
      db.exec(`ALTER TABLE citations ADD COLUMN ${name} ${type}`);
    }
    // row_uid minted from the id each row already has, so a number the user has
    // already quoted and the new identifier both resolve to the same row.
    db.exec(
      `UPDATE citations SET row_uid = 'cit-' || printf('%06d', id) WHERE row_uid = ''`
    );
    db.exec(`UPDATE citations SET work_key = paper_key WHERE work_key = ''`);

    // Provenance and the external contradiction, from the reports.
    const lookups = reportLookups();
    const upd = db.prepare(
      "UPDATE citations SET origin_dir = ?, external_matched = ? WHERE id = ?"
    );
    for (const r of db.prepare("SELECT id, base, page, row_index FROM citations").all()) {
      const hit = lookups.get(keyOf(r.base, r.page, r.row_index));
      if (!hit) continue;
      matched++;
      const em =
        hit.external_matched === undefined || hit.external_matched === null
          ? "[]"
          : JSON.stringify(
              Array.isArray(hit.external_matched)
                ? hit.external_matched
                : [hit.external_matched]
            );
      upd.run(hit.origin_dir, em, r.id);
    }

    // stands_for_row_uid: the copy that stands, resolved to a ROW. duplicate_of
    // holds Scholar's cid, which repeats across citing lists, so the lookup is
    // scoped to the same cites_id -- a language edition is always a duplicate
    // within one citing list -- and to the copy that is not itself deferred.
    const rows = db
      .prepare(
        "SELECT id, cites_id, cid, duplicate_of, page FROM citations WHERE duplicate_of <> ''"
      )
      .all();
    deferredRows = rows;
    const uidByCid = new Map();
    for (const r of db
      .prepare("SELECT cites_id, cid, row_uid, duplicate_of, filed FROM citations WHERE cid <> ''")
      .all()) {
      if (r.duplicate_of) continue; // a deferred copy cannot be the one that stands
      const k = `${r.cites_id}\u0000${r.cid}`;
      const prev = uidByCid.get(k);
      // Prefer a copy on a filed page; deterministic when they tie.
      if (prev && (!r.filed || prev.filed)) continue;
      uidByCid.set(k, r.row_uid);
    }
    const setStands = db.prepare(
      "UPDATE citations SET stands_for_row_uid = ? WHERE id = ?"
    );
    let unresolved = 0;
    for (const r of rows) {
      const target = uidByCid.get(`${r.cites_id}\u0000${r.duplicate_of}`);
      if (target) setStands.run(target, r.id);
      else unresolved++;
    }

    // Retire the rows that are not behind a filed exhibit. They are kept and
    // flagged, never deleted, so a quoted row_uid keeps resolving. The user
    // decided on 2026-11-02 that the store mirrors the current Scholar record,
    // which is what v_active reports; the retired rows stay as history.
    db.exec(
      `UPDATE citations
         SET superseded_at = COALESCE(NULLIF(superseded_at,''), '2026-11-02'),
             supersede_reason = COALESCE(NULLIF(supersede_reason,''),
               'Retired at the 2026-11-02 migration: no exhibit PDF is filed for this capture.')
       WHERE filed = 0 AND superseded_at = ''`
    );

    // Durable keys and the active view. Created after the backfill so the unique
    // index cannot fail on a half-populated column.
    db.exec(
      `CREATE UNIQUE INDEX IF NOT EXISTS idx_citations_natural_key ON citations(base, page, row_index)`
    );
    db.exec(`CREATE INDEX IF NOT EXISTS idx_citations_row_uid ON citations(row_uid)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_citations_work_key ON citations(cites_id, work_key)`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_citations_superseded ON citations(superseded_at)`);

    // A view cannot be ALTERed, so every view in the DDL is dropped and recreated
    // here from the DDL text -- v_independent_counted now excludes retired rows,
    // v_patents, v_non_english and v_language_editions now carry row_uid, v_review
    // is new in v4, and v_pub_stats sums only active rows. Listing them from
    // ddlViewNames() rather than by hand matters: needsMigration() compares every
    // DDL view's stored text, so a hand-written list that omits one (as v_pub_stats
    // was here until 2026-11-02) leaves that view permanently stale. The build then
    // reports the same work on every run, takes a fresh multi-megabyte snapshot
    // each time to do it, and two runs inside the same second collide on the
    // snapshot filename and abort. Deriving the list from the DDL means the check
    // and the fix can never disagree about which views exist.
    for (const name of ddlViewNames()) {
      db.exec(`DROP VIEW IF EXISTS ${name}`);
      db.exec(ddlView(name));
    }

    writeMeta(db, { listData: snapshotMetaFor(db) });
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }

  // Post-migration proof: same row count, same id -> natural key mapping, and a
  // unique non-empty row_uid on every row.
  const after = db.prepare("SELECT COUNT(*) AS n FROM citations").get().n;
  const uidsAfter = db
    .prepare("SELECT id, base, page, row_index, row_uid FROM citations ORDER BY id")
    .all();
  const problems = [];
  if (after !== before) problems.push(`row count moved ${before} -> ${after}`);
  const byId = new Map(uidsAfter.map((r) => [r.id, r]));
  for (const r of uidsBefore) {
    const now = byId.get(r.id);
    if (!now) {
      problems.push(`id ${r.id} disappeared`);
      continue;
    }
    if (keyOf(r.base, r.page, r.row_index) !== keyOf(now.base, now.page, now.row_index)) {
      problems.push(`id ${r.id} changed natural key`);
    }
    if (!now.row_uid) problems.push(`id ${r.id} has no row_uid`);
  }
  const dupUid = db
    .prepare("SELECT COUNT(*) n FROM (SELECT row_uid FROM citations WHERE row_uid<>'' GROUP BY row_uid HAVING COUNT(*)>1)")
    .get().n;
  if (dupUid) problems.push(`${dupUid} row_uid value(s) are not unique`);
  if (problems.length) {
    throw new Error(`Migration verification FAILED: ${problems.join("; ")}`);
  }
  const retired = db
    .prepare("SELECT COUNT(*) n FROM citations WHERE superseded_at <> ''")
    .get().n;
  console.log(`[catalog]   migrated: ${after} rows, ${retired} retired, row_uid unique.`);
  console.log(`[catalog]   provenance filled for ${matched} row(s) from the reports.`);
  console.log(
    `[catalog]   duplicate pointers: ${deferredRows.length - unresolved} of ${deferredRows.length}` +
      ` resolved to a row (${unresolved} left blank rather than guessed).`
  );
  return { migrated: true, write, matched, unresolved };
}

// meta already in the file, for a migration that has no fresh snapshot to offer.
function snapshotMetaFor(db) {
  const m = Object.fromEntries(
    db.prepare("SELECT key, value FROM meta").all().map((r) => [r.key, r.value])
  );
  return {
    listData: {
      snapshot_date: m.snapshot_date || "",
      source: m.snapshot_source || "",
      publications: [],
    },
    listFile: (m.publication_list_file || "").split("/").pop(),
    reportFileCount: m.report_file_count || "",
  };
}

// ---------------------------------------------------------------------------
// Snapshot / backup
// ---------------------------------------------------------------------------

function snapshot(label) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d+Z$/, "Z");
  const base = `citation-catalog-${stamp}${label ? `-${label}` : ""}`;
  // The stamp only has second resolution, so two writes in the same second would
  // pick the same name. VACUUM INTO refuses to overwrite, and an abort here would
  // take a perfectly good merge down with it -- worse than a renamed backup. Add a
  // counter rather than clobber, so an earlier snapshot is never destroyed.
  let out = path.join(BACKUP_DIR, `${base}.sqlite`);
  for (let n = 2; fs.existsSync(out); n++) {
    out = path.join(BACKUP_DIR, `${base}--${n}.sqlite`);
  }
  const src = new DatabaseSync(DB_PATH, { readOnly: true });
  const counts = {
    citations: src.prepare("SELECT COUNT(*) n FROM citations").get().n,
    filed: src.prepare("SELECT COUNT(*) n FROM citations WHERE filed = 1").get().n,
    publications: src.prepare("SELECT COUNT(*) n FROM publications").get().n,
  };
  src.exec(`VACUUM INTO '${out.replace(/'/g, "''")}'`);
  src.close();
  const copy = new DatabaseSync(out, { readOnly: true });
  const checked = {
    citations: copy.prepare("SELECT COUNT(*) n FROM citations").get().n,
    filed: copy.prepare("SELECT COUNT(*) n FROM citations WHERE filed = 1").get().n,
    publications: copy.prepare("SELECT COUNT(*) n FROM publications").get().n,
  };
  copy.close();
  for (const k of Object.keys(counts)) {
    if (counts[k] !== checked[k]) {
      throw new Error(
        `Snapshot ${path.basename(out)} does not match the live file on ${k} ` +
          `(${counts[k]} vs ${checked[k]}). Refusing to continue.`
      );
    }
  }
  console.log(
    `[catalog] Snapshot verified: ${path.relative(ROOT, out)} ` +
      `(${counts.citations} rows, ${counts.filed} filed, ${counts.publications} publications)`
  );
  return out;
}

// ---------------------------------------------------------------------------
// Merge, never replace
// ---------------------------------------------------------------------------

// Rows currently in the store, keyed by the natural key.
function loadExisting(db) {
  const map = new Map();
  for (const r of db.prepare("SELECT * FROM citations").all()) {
    map.set(keyOf(r.base, r.page, r.row_index), r);
  }
  return map;
}

// Values compared to decide whether a row's content moved. Columns the store
// owns -- retirement stamps and the durable identity -- are excluded: a rebuild
// must never clear a superseded_at stamp another process set.
const STORE_OWNED = new Set([
  "id",
  "row_uid",
  "superseded_at",
  "replaced_by_row_uid",
  "supersede_reason",
  "stands_for_row_uid",
]);

const norm = (v) =>
  v === null || v === undefined ? "" : typeof v === "number" ? String(v) : String(v);

// Decide the merge in memory, then check it is safe before anything is written.
// The guard is the thing that decides whether a save happens at all.
// `startId` must come from the GLOBAL maximum, not from the maximum of whatever
// subset `existing` holds. The batch hook merges one publication's rows while the
// table already holds thousands more, and an id minted below the global maximum
// would collide with a row that is already there.
function planMerge(existing, rows, startId = 1) {
  const plan = { inserts: [], updates: [], unchanged: 0, minted: [], collisions: [] };
  const seen = new Set();
  let nextId = Math.max(1, Number(startId) || 1);
  for (const r of rows) {
    const k = keyOf(r.base, r.page, r.row_index);
    if (seen.has(k)) {
      // Two report entries claiming one page position. Loud, not silent: the
      // natural key is what makes an identifier durable, so a collision has to
      // stop the build rather than let one entry overwrite the other.
      plan.collisions.push(k);
      continue;
    }
    seen.add(k);
    const cur = existing.get(k);
    if (!cur) {
      plan.inserts.push({ row: r, id: nextId, row_uid: rowUidForId(nextId) });
      plan.minted.push(rowUidForId(nextId));
      nextId++;
      continue;
    }
    const changed = COLUMNS.slice(1).some(
      (c) => !STORE_OWNED.has(c) && norm(cur[c]) !== norm(r[c] ?? "")
    );
    if (changed) plan.updates.push({ row: r, existing: cur });
    else plan.unchanged++;
  }
  // Rows the store has that this run's reports do not mention. They are KEPT.
  // This is what makes a rebuild non-destructive: a report file that went away,
  // or a capture sitting in a folder this run does not scan, cannot empty a row.
  plan.retained = [...existing.values()].filter(
    (e) => !seen.has(keyOf(e.base, e.page, e.row_index))
  );
  return plan;
}

function maxIdOf(db) {
  const row = db.prepare("SELECT COALESCE(MAX(id), 0) AS m FROM citations").get();
  return Number(row.m) || 0;
}

// Non-negotiable 4: refuse to write if any existing row would disappear or any
// row_uid would be re-pointed. Returns the list of reasons; empty means safe.
// The merge can only ever grow the table or leave it alone, so the arithmetic
// check below is a tripwire against a future edit that reintroduces a delete.
function guardMerge(db, plan) {
  const reasons = [];
  const before = db.prepare("SELECT COUNT(*) AS n FROM citations").get().n;

  const uidToKey = new Map(
    db
      .prepare("SELECT row_uid, base, page, row_index FROM citations WHERE row_uid <> ''")
      .all()
      .map((r) => [r.row_uid, keyOf(r.base, r.page, r.row_index)])
  );

  // A minted identifier must be genuinely new. If it is already in use for a
  // different position, the id sequence has drifted and reusing it would make a
  // previously quoted number mean something else.
  for (const ins of plan.inserts) {
    const clash = uidToKey.get(ins.row_uid);
    if (clash !== undefined) {
      reasons.push(
        `row_uid ${ins.row_uid} already means ${clash}; the new row at ` +
          `${keyOf(ins.row.base, ins.row.page, ins.row.row_index)} would re-use it`
      );
    }
  }
  if (plan.collisions && plan.collisions.length) {
    reasons.push(
      `${plan.collisions.length} report entr(ies) collide on one natural key, e.g. ${plan.collisions[0]}`
    );
  }
  // An update must never move a row or touch its identity.
  for (const u of plan.updates) {
    if (
      keyOf(u.existing.base, u.existing.page, u.existing.row_index) !==
      keyOf(u.row.base, u.row.page, u.row.row_index)
    ) {
      reasons.push(`update would move row ${u.existing.row_uid} to a different position`);
    }
    if (!u.existing.row_uid) {
      reasons.push(`row at ${keyOf(u.row.base, u.row.page, u.row.row_index)} has no row_uid`);
    }
  }
  const projected = before + plan.inserts.length;
  if (projected < before) {
    reasons.push(`projected row count ${projected} is below the current ${before}`);
  }
  return { reasons, before, projected };
}

// Insert the new rows and refresh the changed ones. The caller owns the
// transaction, so the batch hook can fold this into its publication update.
// row_uid is supplied only for an insert; an update never touches it, which is
// what makes an identifier permanent.
function applyInsertsUpdates(db, plan) {
  const insertCols = ["id", "row_uid", ...COLUMNS.slice(1).filter((c) => c !== "row_uid")];
  const ins = db.prepare(
    `INSERT INTO citations (${insertCols.join(", ")}) VALUES (${insertCols.map(() => "?").join(", ")})`
  );
  const setClause = COLUMNS.slice(1)
    .filter((c) => !STORE_OWNED.has(c))
    .map((c) => `${c} = ?`)
    .join(", ");
  const upd = db.prepare(`UPDATE citations SET ${setClause} WHERE id = ?`);

  for (const { row, id, row_uid } of plan.inserts) {
    const vals = insertCols.map((c) => {
      if (c === "id") return id;
      if (c === "row_uid") return row_uid;
      const v = row[c];
      if (c === "row_index" && (v === null || v === undefined)) return NO_INDEX;
      return v === undefined ? null : v;
    });
    ins.run(...vals);
  }
  for (const { row, existing } of plan.updates) {
    const vals = COLUMNS.slice(1)
      .filter((c) => !STORE_OWNED.has(c))
      .map((c) => {
        const v = row[c];
        if (c === "row_index" && (v === null || v === undefined)) return NO_INDEX;
        return v === undefined ? null : v;
      });
    upd.run(...vals, existing.id);
  }
}

function applyMerge(db, plan, publications) {
  db.exec("BEGIN");
  try {
    applyInsertsUpdates(db, plan);
    // publications is a per-snapshot rollup, not history: it has no durable
    // identifier quoted anywhere, so it is refreshed by key rather than appended.
    const pubUpd = db.prepare(
      `UPDATE publications SET title=?, authors=?, venue=?, year=?,
         cited_by_at_snapshot=?, paper_url=?, cites_url=?, exhibit_base=?,
         filed=?, in_snapshot=?, status=?, pages_expected=?,
         pages_captured=?, pages_complete=?, snapshot_date=?
       WHERE cites_id=?`
    );
    const havePub = new Set(
      db.prepare("SELECT cites_id FROM publications").all().map((r) => r.cites_id)
    );
    for (const p of publications) {
      if (havePub.has(p.cites_id)) {
        pubUpd.run(
          p.title, p.authors, p.venue, p.year, p.cited_by_at_snapshot, p.paper_url,
          p.cites_url, p.exhibit_base, p.filed, p.in_snapshot, p.status,
          p.pages_expected, p.pages_captured, p.pages_complete, p.snapshot_date,
          p.cites_id
        );
      } else {
        writePublications(db, [p]);
      }
    }
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

// Lifecycle: retire, never delete.
//
// Two things retire a row, and both are recorded on the row rather than enacted
// by removing it:
//   1. its exhibit PDF is no longer in Exhibits/PDFs -- it was archived, or a
//      re-capture replaced it. `filed` drops to 0, which is the flag that keeps
//      it out of every total.
//   2. its report file is no longer in a folder this builder scans. archive-
//      exhibits.js moves a retired capture's workpapers into Supporting/Pre-
//      recapture-<date>/, so the rows stop being refreshed. Without a stamp here
//      they would keep their last known `filed = 1` forever and quietly inflate
//      every figure -- which is the exact failure found on 2026-11-02.
//
// A row retired by a re-capture also records which row took its place, where the
// replacement covers the same citing list one for one.
function retireOrphans(db, scannedBases, filedBases, stamp) {
  const rows = db
    .prepare("SELECT id, row_uid, base, cites_id, filed FROM citations WHERE superseded_at = ''")
    .all();
  const set = db.prepare(
    "UPDATE citations SET filed = 0, superseded_at = ?, supersede_reason = ?, replaced_by_row_uid = ? WHERE id = ?"
  );
  const reasons = { exhibit: 0, report: 0 };
  db.exec("BEGIN");
  try {
    for (const r of rows) {
      const exhibitGone = !filedBases.has(r.base);
      const reportGone = !scannedBases.has(r.base);
      // Active means: sits behind a filed exhibit AND is still refreshed by a
      // report this builder reads. Anything else is retired.
      if (r.filed === 1 && !exhibitGone && !reportGone) continue;
      const why = [];
      if (exhibitGone) {
        why.push("its exhibit PDF is no longer in Exhibits/PDFs");
        reasons.exhibit++;
      }
      if (reportGone) {
        why.push("its report file is no longer in a folder the builder scans");
        reasons.report++;
      }
      if (!why.length) why.push("no exhibit PDF is filed for it");
      // A newer filed set under the same cites id is what replaced it.
      const repl = db
        .prepare(
          `SELECT row_uid FROM citations
             WHERE cites_id = ? AND base <> ? AND filed = 1 AND superseded_at = ''
             ORDER BY base DESC LIMIT 1`
        )
        .get(r.cites_id, r.base);
      set.run(stamp, `Retired ${stamp}: ${why.join("; and ")}.`, repl ? repl.row_uid : "", r.id);
    }
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
  return reasons;
}

// How many rows retireOrphans would stamp, without stamping them. Lets the
// caller tell "nothing to do" from "about to change the store" and snapshot only
// for the latter.
function retireCount(db, scannedBases) {
  const filedBases = tally.filedBases(PDF_DIR);
  const rows = db
    .prepare("SELECT base, cites_id, filed FROM citations WHERE superseded_at = ''")
    .all();
  return rows.filter((r) => !(r.filed === 1 && filedBases.has(r.base) && scannedBases.has(r.base)))
    .length;
}

// After a write, prove the two invariants that matter: no row vanished, and no
// row_uid moved. A failure here rolls nothing back automatically, so it exits
// non-zero and says the snapshot to restore.
function verifyMerge(db, uidBefore, countBefore, snapshotPath) {
  const problems = [];
  const after = db.prepare("SELECT COUNT(*) AS n FROM citations").get().n;
  if (after < countBefore) problems.push(`row count fell ${countBefore} -> ${after}`);
  const now = db
    .prepare("SELECT row_uid, base, page, row_index FROM citations WHERE row_uid <> ''")
    .all();
  const nowByKey = new Map(now.map((r) => [r.row_uid, keyOf(r.base, r.page, r.row_index)]));
  for (const [uid, k] of uidBefore) {
    if (!nowByKey.has(uid)) problems.push(`row_uid ${uid} disappeared`);
    else if (nowByKey.get(uid) !== k) problems.push(`row_uid ${uid} now points at ${nowByKey.get(uid)}`);
  }
  if (problems.length) {
    throw new Error(
      `POST-WRITE VERIFICATION FAILED: ${problems.slice(0, 8).join("; ")}
` +
        `   Restore from ${snapshotPath ? path.relative(ROOT, snapshotPath) : "the last snapshot in Database/Backups"}
` +
        `   Then run: node tools/build-catalog.js --write`
    );
  }
  return after;
}

// ---------------------------------------------------------------------------
// Reconciliation
// ---------------------------------------------------------------------------

// Recompute the filed totals straight from the reports through tally.js -- the
// same call build-ledger makes -- and compare with the active rows in the store.
//
// Under the durable-store model this is the CHECK, not the source. The database
// holds the record; the report-derived figures are an independent recomputation
// of what the exhibits should add up to. A DIFF means one of the two is wrong and
// nobody yet knows which, so it is a defect to investigate and no figure may be
// quoted for the packet until it is resolved. Neither side wins by rule.
//
// Scoped to v_active (filed and not superseded), which is the current Scholar
// record -- the same set of pages the exhibits show and the ledger counts.
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
       FROM citations WHERE filed = 1 AND superseded_at = ''`
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
      origin_dir: path.relative(ROOT, page.dir).split(path.sep).join("/"),
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
    // MERGE this base's rows, never delete them. A capture that re-reads a page
    // updates that row in place and keeps its row_uid; a page that grew adds a
    // row; a row this capture no longer shows is retained and retired by
    // retireOrphans, not removed. Other bases sharing the cites id (an older
    // capture of the same publication) are untouched.
    const existingAll = loadExisting(db);
    const scoped = new Map(
      [...existingAll.entries()].filter(([k, r]) => r.base === base)
    );
    const plan = planMerge(scoped, rows, maxIdOf(db) + 1);
    const guard = guardMerge(db, plan);
    if (guard.reasons.length) {
      console.log(
        `[catalog] REFUSED to write ${base}: the merge is not provably non-destructive.\n` +
          guard.reasons.map((r) => `           - ${r}`).join("\n")
      );
      process.exitCode = 4;
      return;
    }
    db.exec("BEGIN");
    try {
      applyInsertsUpdates(db, plan);
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

// A brand-new store, created only when no database file exists. Rows are written
// through the same merge path, so a fresh build mints row_uid values exactly as
// an incremental one does and there is no second code path to drift.
function createFresh(data) {
  fs.mkdirSync(DB_DIR, { recursive: true });
  if (fs.existsSync(DB_PATH)) {
    throw new Error(
      `${DB_PATH} already exists. The builder never recreates it; run the merge instead.`
    );
  }
  const db = new DatabaseSync(DB_PATH);
  try {
    db.exec(DDL);
    const empty = new Map();
    const plan = planMerge(empty, data.citations, 1);
    applyMerge(db, plan, data.publications);
    writeMeta(db, data);
  } finally {
    db.close();
  }
  return DB_PATH;
}

// Report-only is the DEFAULT: running the builder with no argument prints the
// merge plan and touches nothing. --write is what saves.
function main() {
  const pub = argValue("pub");
  if (pub) return upsertPublication(pub);

  const write = process.argv.includes("--write");
  const data = collect();

  console.log(
    `[catalog] Read ${data.reportFileCount} report file(s) -> ` +
      `${data.citations.length} citation row(s) across ${data.publications.length} publication(s).`
  );
  // Captures the store has never seen, in a Pre-* backup subfolder. Reported, not
  // silently dropped -- see scanSubfolders.
  if (data.subfolderScan.unknown.length) {
    let hiddenRows = 0;
    console.log(
      `[catalog] NOTE: ${data.subfolderScan.unknown.length} capture(s) sit only in a backup ` +
        `subfolder and are NOT in the store:`
    );
    for (const list of data.subfolderScan.unknown) {
      const rows = list.reduce((n, f) => n + f.entries, 0);
      hiddenRows += rows;
      console.log(
        `           ${list[0].pubBase} (${list.length} page(s), ${rows} row(s)) in ${[...new Set(list.flatMap((f) => f.folders))].join("/ and ")} */`
      );
    }
    console.log(
      `[catalog]          Ingesting them is a deliberate decision, not a rebuild side effect.`
    );
  }

  if (!fs.existsSync(DB_PATH)) {
    console.log(`[catalog] No database at ${DB_PATH}.`);
    if (!write) {
      console.log(`[catalog] Plan: create it with ${data.citations.length} rows. Pass --write.`);
      return;
    }
    createFresh(data);
    console.log(`[catalog] Created ${path.relative(ROOT, DB_PATH)}.`);
    return report(DB_PATH, data, { write: true, created: true });
  }

  // Structural change? Take a verified snapshot BEFORE migrating, and refuse to
  // migrate without one. The test is structural, so a migration that died part
  // way through is finished rather than skipped because meta says v4.
  const probe = new DatabaseSync(DB_PATH, { readOnly: true });
  let migration;
  try {
    migration = needsMigration(probe);
  } finally {
    probe.close();
  }
  if (migration.needed) {
    const structural =
      migration.missingCols.length > 0 || migration.current !== String(SCHEMA_VERSION);
    const why = [
      migration.current !== String(SCHEMA_VERSION)
        ? `version v${migration.current || "?"} -> v${SCHEMA_VERSION}`
        : "",
      migration.missingCols.length ? `missing column(s): ${migration.missingCols.join(", ")}` : "",
      migration.missingViews.length ? `missing view(s): ${migration.missingViews.join(", ")}` : "",
      migration.staleViews.length
        ? `view(s) edited since they were created: ${migration.staleViews.join(", ")}`
        : "",
    ].filter(Boolean);
    console.log(
      `[catalog] Schema needs work in place (${why.join("; ")}). ` +
        (structural
          ? `No row is deleted and row_uid is backfilled from the id each row already has.`
          : `Only view definitions are recreated; no row is read or written.`)
    );
    if (!write) {
      console.log(`[catalog] Plan only. Pass --write to snapshot, migrate, then merge.`);
      return;
    }
    const snap = snapshot(`pre-v${SCHEMA_VERSION}-migration`);
    const db = new DatabaseSync(DB_PATH);
    try {
      migrateV3toV4(db, { write: true });
    } finally {
      db.close();
    }
    console.log(`[catalog] Migration committed. Snapshot: ${path.relative(ROOT, snap)}`);
  }

  return report(DB_PATH, data, { write });
}

// Merge (or plan the merge), then reconcile and print. Split out so a fresh
// create and a migrated store both end through the same reporting path.
function report(dbPath, data, opts) {
  const write = !!opts.write;
  const db = new DatabaseSync(dbPath);
  let snapshotPath = null;
  try {
    const existing = loadExisting(db);
    const plan = planMerge(existing, data.citations, maxIdOf(db) + 1);
    const guard = guardMerge(db, plan);

    console.log(
      `\n[catalog] Merge plan: ${plan.inserts.length} insert(s), ` +
        `${plan.updates.length} update(s), ${plan.unchanged} unchanged, ` +
        `${plan.retained.length} retained untouched.`
    );
    if (plan.minted.length) {
      console.log(
        `[catalog]           ${plan.minted.length} new row_uid(s), first ${plan.minted[0]}, ` +
          `last ${plan.minted[plan.minted.length - 1]}`
      );
    }
    if (plan.retained.length) {
      const bases = [...new Set(plan.retained.map((r) => r.base))];
      console.log(
        `[catalog]           ${plan.retained.length} row(s) have no report file this run; ` +
          `kept as history, ${bases.length} base(s), e.g. ${bases[0] || "-"}`
      );
    }

    // The guard decides whether anything is saved.
    if (guard.reasons.length) {
      console.log(
        `\n[catalog] REFUSED TO WRITE. The merge is not provably non-destructive:`
      );
      for (const r of guard.reasons.slice(0, 20)) console.log(`           - ${r}`);
      if (guard.reasons.length > 20) console.log(`           - …and ${guard.reasons.length - 20} more`);
      console.log(
        `\n[catalog] Nothing changed. Investigate before retrying; the existing file is\n` +
          `           the authoritative copy of the data.`
      );
      process.exitCode = 4;
      return;
    }
    if (!write && !opts.created) {
      console.log(
        `\n[catalog] Guard passed. Nothing written -- the builder is report-only unless\n` +
          `           you pass --write.`
      );
      return;
    }

    // Safe, and asked to write. Snapshot first so a surprise is recoverable. A
    // freshly created store has nothing to snapshot and no prior uid to compare,
    // and a run with nothing to do is not a structural change -- skipping it
    // keeps Database/Backups from filling with identical copies of the same file.
    const noWork =
      opts.created ||
      (plan.inserts.length === 0 &&
        plan.updates.length === 0 &&
        retireCount(db, new Set(data.groups.keys())) === 0);
    snapshotPath = noWork ? null : snapshot("pre-merge");
    const uidBefore = new Map(
      db
        .prepare("SELECT row_uid, base, page, row_index FROM citations WHERE row_uid <> ''")
        .all()
        .map((r) => [r.row_uid, keyOf(r.base, r.page, r.row_index)])
    );
    const countBefore = db.prepare("SELECT COUNT(*) AS n FROM citations").get().n;

    if (!opts.created) applyMerge(db, plan, data.publications);
    const scannedBases = new Set(data.groups.keys());
    const retireStamp = new Date().toISOString().slice(0, 10);
    const retired = retireOrphans(db, scannedBases, tally.filedBases(PDF_DIR), retireStamp);
    writeMeta(db, data);

    const total = verifyMerge(db, uidBefore, countBefore, snapshotPath);
    const active = db
      .prepare("SELECT COUNT(*) AS n FROM citations WHERE filed = 1 AND superseded_at = ''")
      .get().n;
    const superseded = db
      .prepare("SELECT COUNT(*) AS n FROM citations WHERE superseded_at <> ''")
      .get().n;
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

    console.log(`[catalog] Database: ${dbPath}`);
    console.log(`[catalog] Snapshot: ${data.listData.snapshot_date} from ${data.listFile}`);
    console.log(`[catalog] Publications: ${data.publications.length} row(s)`);
    console.log(
      `[catalog] Citation rows: ${total} total, ${active} active (the current Scholar record), ` +
        `${superseded} retired and kept as history` +
        (retired.exhibit || retired.report
          ? `  (${retired.exhibit} lost their exhibit, ${retired.report} lost their report file this run)`
          : "")
    );
    console.log(`\n[catalog] Reconciled against tally.js recomputed from the reports:`);
    for (const [label, db_, ledger] of checks) {
      const mark = db_ === ledger ? "ok  " : "DIFF";
      console.log(`           ${mark} ${label.padEnd(24)} db=${String(db_).padEnd(6)} reports=${ledger}`);
    }
    if (mismatches.length) {
      console.log(
        `\n[catalog] MISMATCH between the database and the report-derived figures.\n` +
          `           This is a defect to investigate. NO figure may be quoted for the\n` +
          `           packet until it is resolved -- neither side is right by rule.`
      );
      process.exitCode = 1;
    } else {
      console.log(
        `\n[catalog] Totals reconcile. The database is the store; the dated ledger at\n` +
          `           Exhibits/Supporting/citation-ledger-${data.listData.snapshot_date}.csv\n` +
          `           is a derived report of these rows. Quote row_uid, never id.`
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

module.exports = {
  DB_PATH,
  BACKUP_DIR,
  DDL,
  COLUMNS,
  MUTABLE_COLUMNS,
  SCHEMA_VERSION,
  collect,
  reconcile,
  loadExisting,
  planMerge,
  guardMerge,
  applyMerge,
  retireOrphans,
  verifyMerge,
  snapshot,
  keyOf,
  rowUidForId,
  needsMigration,
  ddlView,
  ddlViewNames,
  canonSql,
};

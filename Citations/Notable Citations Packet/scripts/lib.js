"use strict";
/**
 * Shared helpers for the notable-citations packet.
 *
 * Boundary (see notable-citations.instruction-draft.md §0): this folder reads the
 * Independent Citation Record and never writes to it. Every handle to the catalog
 * store opened from here is readOnly.
 */
const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");

const PKT = path.resolve(__dirname, "..");
const REPO = path.resolve(PKT, "..", "..");
const CATALOG = path.join(REPO, "Database", "citation-catalog.sqlite");
const SUMMARY_MD = path.join(REPO, "Citations", "Citation-summary.md");
const PDF_ROOT = path.join(REPO, "Citations");

const PACKET_DB = path.join(PKT, "notable-citations.sqlite");
// Three sibling folders hold the PDFs, and which one a work lives in is decided
// by the row's status (§5.1) — never remembered by a caller.
//
// `papers/` is counsel's evidence folder: everything the validator checks against
// packet.html, and everything printed with it. Before these folders existed, a
// PDF for a citation nobody had decided yet was filed in the same place, so the
// evidence folder quietly held files for works the lawyer's document never
// mentions — and nothing downstream could tell the two apart.
//
//   papers/           a work in the packet (`included`)
//   pending-papers/   a work awaiting a decision (`held`)
//   screened-papers/  a work decided against (`screened-out`), kept per §4.5
//
// The relative names are what the database stores and what an HTML href uses; the
// absolute constants are for the filesystem.
const ROOT_PAPERS = "papers";
const ROOT_PENDING = "pending-papers";
const ROOT_SCREENED = "screened-papers";
const PAPERS = path.join(PKT, ROOT_PAPERS);
const PENDING_PAPERS = path.join(PKT, ROOT_PENDING);
const SCREENED_PAPERS = path.join(PKT, ROOT_SCREENED);

/**
 * Every retrieval outcome the queue may record, in one place.
 *
 * SQLite cannot widen a `CHECK` list, so this array is both the validation list
 * and the thing `migrate()` rebuilds the table against; a status added here and
 * not there silently fails on write. `skipped-academia` was added on 2026-11-09
 * when the applicant directed that academia.edu citations be dropped.
 */
const DOWNLOAD_STATUSES = [
  "downloaded",
  "walled",
  "no-open-copy",
  "skipped-preprint",
  "skipped-thesis",
  "skipped-book",
  "skipped-academia",
  "failed",
];

/** Open the record's catalog store. Read-only by construction, with no way to opt out. */
function openCatalog() {
  return new DatabaseSync(CATALOG, { readOnly: true });
}

/** Open (or create) the packet's own database. */
function openPacket() {
  const db = new DatabaseSync(PACKET_DB);
  migrate(db);
  return db;
}

/**
 * Bring an existing database up to the current column set.
 *
 * `SCHEMA` uses CREATE TABLE IF NOT EXISTS, so a column added to it later never
 * reaches a database that already exists — the old table is simply kept. That
 * silent difference between the declared schema and the live one is worse than an
 * error, so any column added since the packet was created is added here instead.
 */
function migrate(db) {
  const have = new Set(db.prepare(`SELECT name FROM pragma_table_info('citation')`).all().map(r => r.name));
  // `page` means the page of the citing ARTICLE, per §4.6. Rows imported from the
  // citation summary carried the page of the Scholar EXHIBIT the row appears on,
  // which is a different document; that value moves here rather than being
  // deleted, and `page` is then free to hold what the label claims.
  if (!have.has("exhibit_page")) {
    db.exec(`ALTER TABLE citation ADD COLUMN exhibit_page TEXT`);
  }
  // Same mistake one column over. The citation summary's "Earliest date
  // (preprint, else journal received)" line is the EARLIEST PUBLIC DATE OF THE
  // CITING paper — it is what the Heras timeline set exists to prove against the
  // 25 Apr 2024 filing. It was imported into `cited_earliest_date`, which §4.6
  // defines as the date of MY cited paper, and the renderer printed it under the
  // Cited Paper heading: a row citing GLAD (2019) showed "29 Apr 2023 (preprint)".
  // These two columns hold the citing paper's dates; the cited paper's own date
  // stays in `cited_earliest_date`.
  if (!have.has("citing_earliest_date")) {
    db.exec(`ALTER TABLE citation ADD COLUMN citing_earliest_date TEXT`);
    db.exec(`ALTER TABLE citation ADD COLUMN citing_was_preprint INTEGER`);
  }
  // What the location scanner read, kept SEPARATE from the human fields.
  //
  // `tier`, `section` and `quote` are the applicant's reading of the article and
  // the scanner must never overwrite them (§1.3). But before this, the scanner's
  // opinion only ever existed on the console: a disagreement reported during a
  // run was gone by the next one, so PACKET-STATUS.md could not list it and a
  // person had to remember it. These three columns are the scanner's own
  // statement, always rewritten, never the basis of a claim in the packet.
  if (!have.has("scan_tier")) {
    db.exec(`ALTER TABLE citation ADD COLUMN scan_tier TEXT`);
    db.exec(`ALTER TABLE citation ADD COLUMN scan_note TEXT`);
    db.exec(`ALTER TABLE citation ADD COLUMN scanned_on TEXT`);
  }
  // `preparer_note` arrived after the narrative table had rows: the drafting advice
  // ("file this row at tier A", "do not use it as evidence of adoption") had been
  // written into `findings`, which render-packet.js prints into the lawyer's HTML.
  // Advice belongs in a column the renderer never reads.
  const nCols = new Set(db.prepare(`SELECT name FROM pragma_table_info('narrative')`).all().map(r => r.name));
  if (!nCols.has("preparer_note")) {
    db.exec(`ALTER TABLE narrative ADD COLUMN preparer_note TEXT`);
  }
  // A row's `tier` is the strongest tier that ONE citation earns. Two different
  // things can then make a folder and its rows look out of step, and neither is an
  // error the validator should keep raising:
  //   (a) a folder holds several citations of one article and only some are Methods
  //       uses (cit-000416: the oligomannose paper is a Discussion citation, but the
  //       same article uses GLAD, MAWE and the review in Methods). The WORK stands
  //       at its strongest tier; the weaker sibling row is still honestly C.
  //   (b) the applicant filed a PDF in one folder but, on re-reading, the tool is
  //       used in Methods (cit-000542, van der Wal: filed "In Acknowledgements" yet
  //       the Glycan Array Dashboard is run in Materials and Methods p.5).
  // `tier_decision` records the applicant's call so the folder-vs-tier check stops
  // warning and the decision is on the record rather than re-litigated each run.
  if (!have.has("tier_decision")) {
    db.exec(`ALTER TABLE citation ADD COLUMN tier_decision TEXT`);
    db.exec(`ALTER TABLE citation ADD COLUMN tier_decided_on TEXT`);
    db.exec(`ALTER TABLE citation ADD COLUMN tier_decided_note TEXT`);
  }
  // A book or a book chapter is out of scope for the packet (research articles
  // only), but until now the queue had no way to say so: `skipped-preprint` and
  // `skipped-thesis` are the only refusals, and neither is true of a chapter.
  // Twelve rows carry an ISBN in the DOI (10.1002/9781119865452.ch13,
  // 10.1201/9781003635901-6, 10.1021/bk-2019-1346.ch005) and the retrieval driver
  // kept fetching them, so the tab wasted a paywalled request on a chapter nobody
  // will file. SQLite cannot widen a CHECK list, so the table is rebuilt.
  //
  // The test is against the whole list, not one marker value: on 2026-11-09 the
  // applicant directed that academia.edu citations be dropped, and a check written
  // as `includes("skipped-book")` would have let a table that already had the book
  // status keep a CHECK that refused the new one.
  const want = DOWNLOAD_STATUSES.map((s) => `'${s}'`).join(",");
  const daSql = db.prepare(`SELECT sql FROM sqlite_master WHERE name = 'download_attempt'`).get()?.sql || "";
  if (daSql && !DOWNLOAD_STATUSES.every((s) => daSql.includes(`'${s}'`))) {
    db.exec(`
      BEGIN;
      CREATE TABLE download_attempt_new (
        row_uid      TEXT PRIMARY KEY,
        url          TEXT,
        host         TEXT,
        status       TEXT NOT NULL CHECK (status IN (${want})),
        note         TEXT,
        attempted_on TEXT NOT NULL
      );
      INSERT INTO download_attempt_new SELECT row_uid, url, host, status, note, attempted_on FROM download_attempt;
      DROP TABLE download_attempt;
      ALTER TABLE download_attempt_new RENAME TO download_attempt;
      COMMIT;
    `);
  }
}

/**
 * The tier a citing WORK (folder) is presented at: the strongest tier among the
 * citations filed in that folder, honouring any recorded applicant decision.
 *
 * Per the applicant's instruction on 2026-11-08, a paper that uses one of the
 * tools in Materials and Methods is a tier-A use of that tool even if the same
 * paper also cites another of the applicant's works only in passing. Ranking the
 * work at its weakest citation would hide the strongest evidence. The individual
 * rows keep their own tiers; this is only the headline the work is filed under.
 *
 * `rows` are citation rows sharing one folder_uid. Returns null when none carries
 * a tier (so a caller can fall back rather than print a blank).
 */
const TIER_RANK = { A: 0, B: 1, C: 2, D: 3, REF: 4 };
function headlineTier(rows) {
  let best = null;
  for (const r of rows || []) {
    const t = (r.tier_decision || r.tier || "").trim();
    if (!(t in TIER_RANK)) continue;
    if (best === null || TIER_RANK[t] < TIER_RANK[best]) best = t;
  }
  return best;
}

/**
 * The row_uids already used in the original application, read from the list the
 * record renders for that folder. §3 forbids re-submitting one as new evidence, so
 * every screen for a new candidate has to consult it. The file is a generated
 * markdown table; the uids in it are the answer, and restating them here would let
 * the two lists drift apart.
 *
 * Returns null when the file is missing — a caller must refuse rather than guess,
 * because "no exclusions" is the most expensive thing this list can silently become.
 */
function originalApplicationUids() {
  const f = path.join(PKT, "..", "Notable Citations in Original Application",
    "Original-Application-Citations.md");
  if (!fs.existsSync(f)) return null;
  return new Set([...fs.readFileSync(f, "utf8").matchAll(/cit-\d{6}/g)].map(m => m[0]));
}

/**
 * Independent citations of one cited work that are candidates for the packet but
 * are not in it — the screen behind potential_notable_citations.html.
 *
 * The catalog, not the packet's `candidate` snapshot, decides independence: the
 * snapshot is taken when the queue is seeded and goes stale when a byline is later
 * corroborated. A row must also be the copy that stands for its work, be listed in
 * English, not already be confirmed in the packet, and not already have been used
 * in the original application.
 *
 * Returns { rows, screen } where `screen` accounts for every row removed, so a
 * document can print arithmetic that adds up instead of a bare total.
 */
function potentialIndependent(cat, db, citesId) {
  const all = cat.prepare(`
    SELECT row_uid, title, authors, link, doi, work_type, status, confirm_state,
           is_countable_independent, is_non_english, is_primary_copy, superseded_at,
           external_source, external_url
    FROM citations WHERE cites_id = ? ORDER BY row_uid`).all(citesId);
  const included = new Set(db.prepare(
    "SELECT row_uid FROM citation WHERE status = 'included'").all().map(r => r.row_uid));
  // A row someone already decided against stays in the database (§4.5 keeps the
  // record of what was screened) but must not reappear on the review page —
  // otherwise the same article is reconsidered from scratch by the next reader.
  const decided = new Set(db.prepare(
    "SELECT row_uid FROM citation WHERE status = 'screened-out'").all().map(r => r.row_uid));
  const orig = originalApplicationUids();
  if (orig === null) {
    throw new Error("Original-Application-Citations.md is missing — cannot exclude citations already filed.");
  }
  const screen = { total: all.length, superseded: 0, dependent: 0, notStanding: 0, nonEnglish: 0, inPacket: 0, origApp: 0, decided: 0 };
  const rows = [];
  for (const r of all) {
    if (r.superseded_at) { screen.superseded++; continue; }
    if (r.status !== "INDEPENDENT") { screen.dependent++; continue; }
    if (r.is_countable_independent !== 1 || r.is_primary_copy === 0) { screen.notStanding++; continue; }
    if (r.is_non_english) { screen.nonEnglish++; continue; }
    if (included.has(r.row_uid)) { screen.inPacket++; continue; }
    if (orig.has(r.row_uid)) { screen.origApp++; continue; }
    if (decided.has(r.row_uid)) { screen.decided++; continue; }
    rows.push(r);
  }
  return { rows, screen, origAppUids: orig };
}

/**
 * Which root a citing work's PDFs live in, derived from the status of the
 * citation rows that name it.
 *
 * The rule is the packet's own: a work belongs in counsel's evidence folder only
 * while some row for it is confirmed. `papers/` therefore holds the PDFs of works
 * the lawyer's document cites and nothing else; a work awaiting a decision sits in
 * `pending-papers/`, and a work decided against sits in `screened-papers/` (§4.5
 * keeps the record of what was screened, so its PDF is retained, just not filed).
 *
 * Returns one of the three relative root names. An unknown folder is `papers` — a
 * brand-new row has no status yet and the importer creates the folder as it writes.
 */
const ROOT_FOR_STATUS = {
  included: ROOT_PAPERS,
  held: ROOT_PENDING,
  "screened-out": ROOT_SCREENED,
};

/** Map of folder_uid -> the root that folder's files belong under. */
function folderRoots(db) {
  const best = new Map();
  // `included` beats `held` beats `screened-out`: a folder is evidence if any row
  // in it is evidence, because one PDF can serve several rows of one citing work.
  const RANK = { included: 0, held: 1, "screened-out": 2 };
  for (const r of db.prepare(`SELECT folder_uid, status FROM citation`).all()) {
    const cur = best.get(r.folder_uid);
    if (cur === undefined || (RANK[r.status] ?? 9) < (RANK[cur] ?? 9)) best.set(r.folder_uid, r.status);
  }
  const out = new Map();
  for (const [folder, status] of best) out.set(folder, ROOT_FOR_STATUS[status] || ROOT_PAPERS);
  return out;
}

/** The relative directory a folder's PDFs live in, e.g. `pending-papers/cit-000510`. */
function storageDir(roots, folderUid) {
  return `${roots.get(folderUid) || ROOT_PAPERS}/${folderUid}`;
}

/** The three relative roots, in filing order. */
const STORAGE_ROOTS = [ROOT_PAPERS, ROOT_PENDING, ROOT_SCREENED];

/** Absolute path of a stored file, from its packet-relative path. */
function absFile(rel) {
  return path.join(PKT, rel);
}

/**
 * Build a test for "we already hold a PDF for this citing work".
 *
 * The retrieval queue once decided this by looking only at `citation.pdf_file`,
 * and re-fetched papers it already had. Three things were invisible to that test:
 *
 *   - a `file` row naming the folder, when `pdf_file` was never written back;
 *   - a group folder under `papers/`, `pending-papers/` or `screened-papers/`
 *     whose PDF belongs to a sibling row of the same citing work;
 *   - a staged file in `downloads/` named `<uid>-Surname.pdf` rather than
 *     `<uid>.pdf`, which an exact-path existence test cannot see.
 *
 * `cit-000182` was re-queued through all three routes on 2026-11-13 even though
 * `pending-papers/cit-000182/01-article-RP-2026.pdf` had been on file since
 * 2026-11-08. Measured then, 146 of the 412 rows the queue called untried were
 * already on disk.
 *
 * Returns a function of `(folderUid, row)` giving `{ held, why }`, where `why`
 * names the evidence so a caller can print it. Build it once per run: it reads
 * the database and three directory listings up front.
 */
function heldPdfIndex(db) {
  const filedFolders = new Set(
    db.prepare("SELECT DISTINCT folder_uid FROM file WHERE lower(file) LIKE '%.pdf'").all().map(r => r.folder_uid)
  );
  const staged = new Map();
  const dlDir = path.join(PKT, "downloads");
  if (fs.existsSync(dlDir)) {
    for (const f of fs.readdirSync(dlDir)) {
      const m = f.match(/^(cit-\d{6})/i);
      if (!m || !f.toLowerCase().endsWith(".pdf")) continue;
      if (!staged.has(m[1])) staged.set(m[1], []);
      staged.get(m[1]).push(f);
    }
  }
  const grouped = new Map();
  for (const root of STORAGE_ROOTS) {
    const base = path.join(PKT, root);
    if (!fs.existsSync(base)) continue;
    for (const d of fs.readdirSync(base)) {
      const m = d.match(/^(cit-\d{6})/i);
      if (!m) continue;
      let hasPdf = false;
      try {
        hasPdf = fs.readdirSync(path.join(base, d)).some(f => f.toLowerCase().endsWith(".pdf"));
      } catch {
        continue;
      }
      if (hasPdf && !grouped.has(m[1])) grouped.set(m[1], `${root}/${d}`);
    }
  }
  return function heldPdf(folderUid, row) {
    const uid = folderUid || (row && row.row_uid);
    const why = [];
    if (uid && filedFolders.has(uid)) why.push("`file` row");
    if (uid && staged.has(uid)) why.push(`downloads/${staged.get(uid).join(", ")}`);
    if (uid && grouped.has(uid)) why.push(grouped.get(uid));
    for (const rel of row ? [row.pdf_file, row.source_pdf] : []) {
      if (rel && /\.pdf$/i.test(rel) && fs.existsSync(absFile(rel))) why.push(`pdf_file ${rel}`);
    }
    return why.length ? { held: true, why: why.join(" + ") } : { held: false };
  };
}

/**
 * The packet schema, from §4.6 of the instructions. Column names match the CSV
 * headers exactly so an export is a plain SELECT.
 */
const SCHEMA = `
CREATE TABLE IF NOT EXISTS citation (
  row_uid              TEXT PRIMARY KEY,
  folder_uid           TEXT NOT NULL,
  n                    INTEGER,
  status               TEXT NOT NULL,
  screen_reason        TEXT,
  screen_date          TEXT,
  is_main              INTEGER NOT NULL DEFAULT 1,
  additional_row_uids  TEXT,
  cites_id             TEXT,
  cited_tool           TEXT,
  cited_paper          TEXT,
  cited_earliest_date  TEXT,
  cited_was_preprint   INTEGER,
  citing_earliest_date TEXT,
  citing_was_preprint  INTEGER,
  citing_title         TEXT NOT NULL,
  citing_authors       TEXT,
  citing_senior_author TEXT,
  citing_institutions  TEXT,
  citing_country       TEXT,
  citing_venue         TEXT,
  citing_year          TEXT,
  citing_published_date TEXT,
  citing_article_type  TEXT,
  citing_url           TEXT,
  patent_number        TEXT,
  project              TEXT,
  tier                 TEXT,
  section              TEXT,
  page                 TEXT,
  exhibit_page         TEXT,
  quote                TEXT,
  use_type             TEXT,
  in_original_petition INTEGER NOT NULL DEFAULT 0,
  negative             INTEGER NOT NULL DEFAULT 0,
  language             TEXT NOT NULL DEFAULT 'English',
  evidence_basis       TEXT,
  scan_tier            TEXT,
  scan_note            TEXT,
  scanned_on           TEXT,
  pdf_file             TEXT,
  source_pdf           TEXT,
  exhibit_pdf          TEXT,
  notes                TEXT,
  CHECK (status IN ('included', 'screened-out', 'held')),
  CHECK (status <> 'screened-out' OR COALESCE(screen_reason, '') <> ''),
  CHECK (status <> 'included' OR negative = 0),
  CHECK (status <> 'included' OR language = 'English'),
  CHECK (n IS NULL OR status = 'included')
);

CREATE TABLE IF NOT EXISTS file (
  folder_uid  TEXT NOT NULL,
  file        TEXT NOT NULL,
  source_pdf  TEXT NOT NULL,
  role        TEXT NOT NULL,
  shows_date  TEXT,
  date_basis  TEXT,
  cited       INTEGER NOT NULL DEFAULT 1,
  bytes       INTEGER,
  PRIMARY KEY (folder_uid, file)
);

CREATE TABLE IF NOT EXISTS candidate (
  row_uid      TEXT PRIMARY KEY,
  cites_id     TEXT,
  title        TEXT,
  authors      TEXT,
  doi          TEXT,
  link         TEXT,
  work_type    TEXT,
  venue        TEXT,
  page         INTEGER,
  exhibit_base TEXT,
  status       TEXT,
  is_highlighted INTEGER,
  is_non_english INTEGER,
  language_flag TEXT,
  confirm_state TEXT,
  has_pdf      INTEGER NOT NULL DEFAULT 0,
  packet_row_uid TEXT,
  discover_state TEXT NOT NULL DEFAULT 'untried',
  discover_note TEXT,
  pdf_url      TEXT,
  pdf_source   TEXT,
  pdf_file     TEXT,
  pdf_bytes    INTEGER,
  year         TEXT,
  senior_author TEXT,
  senior_basis  TEXT,
  institutions  TEXT,
  country       TEXT,
  section_found TEXT,
  quote         TEXT,
  quote_page    TEXT,
  screen_state TEXT NOT NULL DEFAULT 'unscreened',
  tried_at     TEXT,
  CHECK (discover_state IN ('untried','has-pdf','open-copy','no-open-copy','paywalled',
                            'not-in-indexes','lookup-failed','skipped')),
  CHECK (screen_state IN ('unscreened','included','screened-out','held'))
);

CREATE INDEX IF NOT EXISTS idx_citation_folder ON citation(folder_uid);

/**
 * Every place a tool appears in a citing article, one row per occurrence.
 *
 * A work can cite the applicant in the Methods *and* the Acknowledgements, or in
 * both a figure legend and Methods, and counsel needs all of them: the value of a
 * citation is where it sits, and a single citation.tier column can only carry
 * the strongest one. citation.tier stays the headline (the best-ranked
 * occurrence) so ordering and the exhibit rules are unchanged; this table is the
 * full list the index and the article entry print.
 *
 * Keyed on row_uid, not folder_uid, because independence and the cited paper are
 * per row: two rows in one folder cite two different papers of the applicant's.
 * verified distinguishes a quotation checked word-for-word against the PDF from
 * a scanner hit that has not been read by a person.
 */
CREATE TABLE IF NOT EXISTS mention (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  row_uid     TEXT NOT NULL,
  section     TEXT NOT NULL,
  tier        TEXT NOT NULL,
  page        TEXT NOT NULL,
  quote       TEXT,
  use_type    TEXT,
  basis       TEXT,
  verified    INTEGER NOT NULL DEFAULT 0,
  noted_on    TEXT,
  CHECK (tier IN ('A','B','C','D','REF')),
  CHECK (basis IN ('extracted text','docx note','reference-number resolution','human reading'))
);
CREATE INDEX IF NOT EXISTS idx_mention_row ON mention(row_uid);

/**
 * The Section II prose. written_by says who wrote it, so a passage drafted by
 * the preparer from the manuscript is never mistaken for the applicant's own
 * argument: a draft is labelled as one in the packet and still needs the
 * applicant's approval. narrative-intake.js is the only writer.
 * render-packet.js emits a marked blank for anything absent rather than
 * inventing a sentence.
 */
CREATE TABLE IF NOT EXISTS narrative (
  folder_uid   TEXT NOT NULL,
  objectives   TEXT,
  importance   TEXT,
  how_used     TEXT,
  findings     TEXT,
  -- Working advice to the applicant and counsel: which tier to file at, what a
  -- folder is good for, what NOT to claim from a row. Deliberately NOT one of the
  -- four rendered columns. render-packet.js prints only the four, so anything
  -- written here stays out of the lawyer's document by construction rather than by
  -- remembering to strip it. PACKET-STATUS.md lists these.
  preparer_note TEXT,
  written_by   TEXT,
  written_on   TEXT,
  PRIMARY KEY (folder_uid)
);
CREATE INDEX IF NOT EXISTS idx_citation_status ON citation(status);
CREATE UNIQUE INDEX IF NOT EXISTS uq_citation_one_main ON citation(folder_uid) WHERE is_main = 1;
CREATE INDEX IF NOT EXISTS idx_candidate_state ON candidate(discover_state);
`;

/** Transliterate and squeeze a surname so it survives a Windows file name. */
function surnameSlug(name) {
  if (!name) return "Unknown";
  const map = { á: "a", à: "a", â: "a", ä: "a", å: "a", é: "e", è: "e", ê: "e", ë: "e", í: "i", ì: "i", î: "i", ï: "i", ó: "o", ò: "o", ô: "o", ö: "o", ú: "u", ù: "u", û: "u", ü: "u", ý: "y", ñ: "n", ç: "c", ø: "o", đ: "d", ł: "l", ş: "s", ğ: "g", ı: "i" };
  let s = String(name).trim().replace(/[áàâäåéèêëíìîïóòôöúùûüýñçøđłşğı]/gi, ch => map[ch.toLowerCase()] || ch);
  s = s.normalize("NFKD").replace(/[\u0300-\u036f]/g, "");
  // Keep the words, join CamelCase: "van der Wal" reads better as VanDerWal than
  // vanderWal, and a hyphen or space would collide with the field separators in
  // the packet file name.
  const words = s.split(/[^\p{L}\p{N}]+/u).filter(Boolean);
  s = words.map(w => w.charAt(0).toUpperCase() + w.slice(1)).join("");
  return s || "Unknown";
}

/**
 * The senior author — the last name on the paper, which is what counsel recognises.
 *
 * The catalog's `authors` column is Scholar's rendered byline ("MY Pasquevich, MS
 * Dreon… - Journal of …, 2024 - journals.biologists.com"), so its last token is a
 * domain, not a person. Use `full_authors`, a JSON array in "Surname, Given" order,
 * then `authors_used` (the same order, comma-joined), then the docx rendering.
 *
 * Some rows hold natural order instead ("Nuschy L", "Wilson IBH"), so a bare token
 * falls back to its last word.
 */
const PARTICLES = new Set(["van", "von", "der", "den", "de", "del", "della", "di", "da", "dos", "du", "la", "le", "el", "al", "bin", "ibn", "ter", "ten"]);

/** From a natural-order name, take the surname run, keeping a multi-word surname. */
function naturalSurname(toks) {
  let start = toks.length - 1;
  while (start > 0 && PARTICLES.has(toks[start - 1].toLowerCase())) start--;
  return toks.slice(start).join(" ");
}

function surnameOf(entry) {
  if (!entry) return null;
  const s = String(entry).trim();
  if (!s) return null;
  if (s.includes(",")) {
    const head = s.split(",")[0].trim();
    // Inverted form: "van der Wal, Dianne" keeps the whole head.
    return head || null;
  }
  const toks = s.replace(/\{\\'\\i\}/g, "i").replace(/[{}\\]/g, "").split(/\s+/).filter(Boolean);
  if (!toks.length) return null;
  // "Wilson IBH" is surname-then-initials, so the surname is the FIRST token;
  // "IBH Wilson" is natural order, so it is the last. Initials are short and
  // uppercase, which tells the two apart. A roman numeral ("Matsen IV") reads as
  // an initial, which is correct here.
  const rest = toks.slice(1);
  if (rest.length && rest.every(t => t.length <= 4 && t === t.toUpperCase() && /[A-ZIV]/.test(t))) {
    return toks[0];
  }
  return naturalSurname(toks);
}

function seniorAuthor(...sources) {
  for (const src of sources) {
    if (!src) continue;
    let list = null;
    if (Array.isArray(src)) list = src;
    else if (typeof src === "string" && src.trim().startsWith("[")) {
      try { list = JSON.parse(src); } catch { list = null; }
    }
    if (list && list.length) {
      const s = surnameOf(list[list.length - 1]);
      if (s) return s;
      continue;
    }
    if (typeof src === "string" && src.trim()) {
      // Scholar's rendered byline carries a venue and year after a dash; drop that
      // before deciding. The docx renders "First ... Last", where the name after the
      // ellipsis is the senior author — exactly what we want.
      const noVenue = src.split(/\s+[-–]\s+(?=[A-Z.Journal]|20\d\d)/)[0].trim();
      if (noVenue.includes("…") || noVenue.includes("...")) {
        const tail = noVenue.split(/…|\.\.\./).pop().trim();
        const s = surnameOf(tail);
        if (s) return s;
        continue;
      }
      // A plain comma list. Two shapes reach here: the catalog's `authors_used`,
      // which is inverted names joined by commas ("Feng, Chiguang, ... , Vasta,
      // Gerardo R"), and a natural-order list ("Maria Pasquevich, Horacio Heras").
      //
      // The old test looked at whether the FIRST part contained a space, which
      // broke on `["Le Mercier, Philippe", ..., "Lisacek, Frédérique"]`: the
      // surname "Le Mercier" has a space, so the list read as natural order and
      // the senior author came out as the given name "Frédérique" (filed as
      // "FrEdErique" after the accent markup was stripped). A natural list of
      // full names has NO space-free parts at all, while an inverted list has
      // exactly half — the given names — so counting them is the discriminator.
      const parts = noVenue.split(",").map(x => x.trim()).filter(Boolean);
      const bare = parts.filter(p => !/\s/.test(p)).length;
      const invertedPairs = parts.length >= 2 && parts.length % 2 === 0 && bare >= parts.length / 2 - 1 && bare > 0;
      const s = surnameOf(invertedPairs ? parts[parts.length - 2] : parts[parts.length - 1]);
      if (s) return s;
    }
  }
  return null;
}

/**
 * Read the repository's .env into process.env and return the map.
 *
 * A variable already set in the real environment wins, so an explicit override
 * beats the file. Keys never appear on a command line, where they would land in
 * shell history or a recorded scrollback.
 */
function readEnv() {
  const out = {};
  const p = path.join(REPO, ".env");
  if (!fs.existsSync(p)) return out;
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    out[m[1]] = m[2].trim();
    if (process.env[m[1]] === undefined) process.env[m[1]] = out[m[1]];
  }
  return out;
}

function rel(from, to) {
  let r = path.relative(from, to).split(path.sep).join("/");
  return r;
}

/**
 * Surname+initial author keys from a byline, in either rendering.
 *
 * Scholar writes "AY Mehta"; PubMed writes "Mehta, AY"; the record's external
 * column writes "Mehta AY". All three have to be comparable, and per the project
 * rule a match needs surname PLUS initials — "Desai" and "Cummings" are common
 * surnames, so a surname alone is not evidence of anything.
 */
function authorKeys(byline) {
  const keys = new Set();
  for (const name of String(byline || "").split(/,?\s*;\s*|,(?=\s*[A-Z][A-Za-z'\-]*\s*[A-Z]{1,3}\b)|,(?=\s*[A-Z]{1,3}\b)/)) {
    const t = name.trim().replace(/[{}\\]/g, "");
    if (!t) continue;
    const m = t.match(/^([A-Za-z'\-]+)\s*,?\s*([A-Z]{1,3})\.?$/) || t.match(/^([A-Z]{1,3})\.?\s+([A-Za-z'\-]+)$/);
    if (!m) continue;
    const iniFirst = /^[A-Z]{1,3}\.?$/.test(m[1]);
    const sur = (iniFirst ? m[2] : m[1]).toLowerCase();
    const ini = (iniFirst ? m[1] : m[2]).replace(/\./g, "").toLowerCase();
    keys.add(`${sur}|${ini}`);
  }
  return keys;
}

/** True when the two bylines share an author on surname plus initials. */
function sharesAuthor(a, b) {
  const ka = authorKeys(a);
  if (!ka.size) return false;
  for (const k of authorKeys(b)) if (ka.has(k)) return true;
  return false;
}

/* ------------------------------------------------------------------ */
/* 3b. What a cited PI paper IS — tool name and project number          */
/* ------------------------------------------------------------------ */

/**
 * The tool a row's cited paper contributed, or null.
 *
 * §5: "Classification comes from each row's own `cites_id` … the fact that GLAD
 * appears in Methods says nothing about where GlycoGlyph appears." So every
 * consumer — the scanner, the correction script, the importer — resolves the
 * tool from the cited title here, in one place, rather than reading a value
 * some earlier run copied across a whole folder.
 *
 * A cited paper that is not one of the four tools (a review of the field, an
 * early glycan-binding study) returns null. That is a real answer and callers
 * must report it, not borrow another row's tool.
 */
function toolForCitedPaper(title) {
  const t = (title || "").toLowerCase();
  if (/^glad\b|glycan array dashboard/.test(t)) return "GLAD";
  if (/glycoglyph/.test(t)) return "GlycoGlyph";
  if (/glyco[- ]?spot/.test(t)) return "Glyco-SPOT";
  if (/wet-erase|\bmawe\b/.test(t)) return "MAWE";
  // "Insights into glycobiology … using glycan microarray technologies" and
  // "Tools for generating and analyzing glycan microarray data" describe the
  // microarray method rather than naming the acronym.
  if (/glycan microarray|glycomicroarray/.test(t)) return "MAWE";
  return null;
}

/**
 * Project number (§5.3) for a cited paper, by what the paper is.
 *
 * The four titles come verbatim from the Research Background Inquiry Form; the
 * repository holds no document mapping a PI paper to one of them, so this is an
 * inference from the wording of the project names and is recorded as an open
 * item in PACKET-STATUS.md for the applicant and counsel to confirm:
 *
 *   2 "…Bioinformatics Tools to Capture and Analyze Glycomics and Glycan
 *     Microarray Data" — GLAD (visual analytics) and GlycoGlyph (drawing/naming
 *     software) are both software for glycan microarray data.
 *   3 "Advancing Glycan Research with Microarray Innovations" — MAWE and the
 *     microarray-technology review are the array work itself.
 *   4 Glyco-SPOT.
 *
 * A cited paper with no tool (a study of oligomannose recognition, an
 * anticoagulant chapter) has no project here and returns null rather than
 * inheriting one from a sibling row on the same citing article.
 */
function projectForCitedPaper(title) {
  const tool = toolForCitedPaper(title);
  if (tool === "GLAD" || tool === "GlycoGlyph") return "2";
  if (tool === "MAWE") return "3";
  if (tool === "Glyco-SPOT") return "4";
  return null;
}

/**
 * Whether two quotations are the same printed sentence seen twice.
 *
 * Three tools quote the same line for different reasons: `scan-mentions.js` takes
 * the sentence around a named tool, `scan-refs.js` takes the sentence around a
 * resolved reference number, and `record-mentions.js` stores whichever was recorded
 * last. Their excerpts overlap without being equal, so an equality test reads one
 * sentence as two citations and a page ends up claiming a paper cited the work
 * twice. A shared run of thirty normalised characters is the same sentence.
 */
function sameSentence(a, b) {
  const flat = s => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
  const x = flat(a), y = flat(b);
  if (!x || !y) return false;
  if (x.includes(y) || y.includes(x)) return true;
  const short = x.length <= y.length ? x : y;
  const long = x.length <= y.length ? y : x;
  for (let i = 0; i + 30 <= short.length; i += 10) {
    if (long.includes(short.slice(i, i + 30))) return true;
  }
  return false;
}

/**
 * What a link we are about to fetch actually points at, so the queue can refuse
 * the kinds the packet does not take. `article` means "worth fetching".
 *
 * Book and chapter DOIs carry the book's ISBN (10.1002/9781119865452.ch13,
 * 10.1201/9781003635901-6, 10.1021/bk-2019-1346.ch005) and often a `.chN`,
 * `_00NN` or `/chapter/` suffix. A Springer `/protocol/` URL is the one exception
 * under an ISBN: it is the item-level PDF of a single Methods-in-Molecular-Biology
 * protocol, which the user asked for by name on 2026-11-13 — "only this protocol",
 * not the full book.
 */
function linkKind(u) {
  if (!u) return "unknown";
  const s = String(u).toLowerCase();
  // A academia.edu upload is not the published article and its byline is not the
  // article's: one co-author uploads the file and Scholar indexes only that name,
  // so the independence test sees a byline sharing nobody and calls a self-citation
  // independent. That is what happened to cit-000244 (record row INDEPENDENT, its
  // twin cit-000237 DEPENDENT, and the PDF's own page 1 naming Desai). No reading
  // of such a row can be trusted, so the host is refused outright.
  if (/academia\.edu/.test(s)) return "academia";
  if (/10\.1101\/|biorxiv|medrxiv|chemrxiv|arxiv|preprints\.org|osf\.io\/preprint/.test(s)) return "preprint";
  if (/scholarsportal|scholarsbank|vtechworks|etd|theses|dissert|proquest|vuir\.library|duepublico/.test(s)) return "thesis";
  const isbn = /97[89]\d{10,11}/.test(s.replace(/[-/]/g, ""));
  // A Wiley reference work (Burger's Medicinal Chemistry, Encyclopedia of…) is a
  // book whose chapters carry the 10-digit ISBN as the DOI stem:
  // 10.1002/0471266949.bmc182.pub2. Journal DOIs never look like this - they are
  // 10.1002/anie.202501234 - so a leading zero followed by nine digits is safe.
  const wileyRefWork = /10\.1002\/0\d{9}\./.test(s);
  const chapterish = /\.ch\d/i.test(s) || /\/chapter\//i.test(s) || /bk-\d{4}-\d+/.test(s);
  if ((isbn || chapterish || wileyRefWork) && !/springer\.com\/protocol\//.test(s)) return "book";
  return "article";
}

module.exports = { PKT, REPO, CATALOG, SUMMARY_MD, PDF_ROOT, PACKET_DB, PAPERS, PENDING_PAPERS, SCREENED_PAPERS, ROOT_PAPERS, ROOT_PENDING, ROOT_SCREENED, STORAGE_ROOTS, DOWNLOAD_STATUSES, openCatalog, openPacket, SCHEMA, surnameSlug, surnameOf, seniorAuthor, readEnv, rel, authorKeys, sharesAuthor, toolForCitedPaper, projectForCitedPaper, TIER_RANK, headlineTier, originalApplicationUids, potentialIndependent, ROOT_FOR_STATUS, folderRoots, storageDir, absFile, heldPdfIndex, linkKind, sameSentence };

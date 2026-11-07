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
const PAPERS = path.join(PKT, "papers");

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
 * `verified` distinguishes a quotation checked word-for-word against the PDF from
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
 * The Section II prose. `written_by` says who wrote it, so a passage drafted by
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

module.exports = { PKT, REPO, CATALOG, SUMMARY_MD, PDF_ROOT, PACKET_DB, PAPERS, openCatalog, openPacket, SCHEMA, surnameSlug, surnameOf, seniorAuthor, readEnv, rel, authorKeys, sharesAuthor, toolForCitedPaper, projectForCitedPaper };

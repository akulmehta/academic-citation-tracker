"use strict";
/*
 * Build the field-comparison dataset.
 *
 * WHAT THIS ANSWERS
 * -----------------
 * The RFE asks how the PI's citation counts compare with his field, and asks for
 * the comparison close to his exact field rather than a broad one. This writes
 * OpenAlex/field-comparison.json: for each publication, where it sits in the
 * citation distribution of the cohort that measures ITS OWN field, plus the
 * field-weighted impact OpenAlex already publishes for it.
 *
 * NOTHING IN dashboard/ IS WRITTEN
 * --------------------------------
 * The packet's figures (1,078 counted independent citations, 918 distinct
 * independent papers) are Google Scholar figures and are frozen. OpenAlex counts
 * the same body of work lower -- 1,170 against Scholar's 1,498 -- so every
 * percentile here is OpenAlex-against-OpenAlex and can never be read across to a
 * Scholar figure. This tool reads dashboard/data/citation-data.json for the
 * publication list and the packet's headline numbers, and writes only into
 * OpenAlex/. The separation is what makes it impossible for a field percentile to
 * move a packet number.
 *
 * FOUR RULES, EACH FROM THE USER
 * ------------------------------
 *  1. Anticoagulant work ranks against anticoagulant-like fields, not against
 *     glycoscience. A publication's field comes from tools/topics.js, which the
 *     user reviewed, and a cohort only ranks papers whose field it measures.
 *     Ranking a thrombosis paper in a glycan cohort is the category error the RFE
 *     is inviting, so the tool refuses to do it.
 *  2. Pandemic-related rows are NOT excluded. They are counted and reported once,
 *     so a reader who spots a coronavirus paper in a cohort can see how many there
 *     are and what share of citations they hold. An earlier version carried every
 *     distribution twice, with and without them; the user retired that on
 *     2026-11-06 because the contrast did not carry weight -- inside the exact-field
 *     cohorts these rows hold ~1% of citations, and a percentile that moves on a
 *     toggle is a percentile nobody can quote.
 *  3. Same-year matching uses the OpenAlex year on both sides, so a Scholar /
 *     OpenAlex disagreement cannot compare a paper to the wrong cohort's year.
 *  4. OpenAlex vs OpenAlex throughout. Scholar counts appear only in the scale
 *     warning and the packet's own frozen figures, never as a percentile input.
 *
 * COHORTS COME FROM THE USER'S OWN OQL EXPORTS
 * --------------------------------------------
 * OpenAlex/cohort-manifest.json names each CSV, the cohort it represents, and
 * which field it measures. The export carries no topic column, so the file *is*
 * the cohort and files are never merged. Adding a Tier 1 or Tier 2 export means
 * adding one manifest entry; no change is needed here.
 *
 * Read-only with respect to everything it consumes. Writes two files, both in
 * OpenAlex/.
 */

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const OPENALEX_DIR = path.join(ROOT, "OpenAlex");
const MANIFEST = path.join(OPENALEX_DIR, "cohort-manifest.json");
const DASH_JSON = path.join(ROOT, "dashboard", "data", "citation-data.json");
const OUT_JSON = path.join(OPENALEX_DIR, "field-comparison.json");
const OUT_JS = path.join(OPENALEX_DIR, "field-comparison.js");
// The NLM/PubMed journal abbreviations, cached so a rebuild does not re-ask NCBI
// for a mapping that changes only when a journal changes its title. Written only
// by `--fetch-abbrevs`; a normal build reads it and carries on without it.
const ABBR_JSON = path.join(OPENALEX_DIR, "journal-abbreviations.json");

// Confirmed by the user on 2026-11-05: https://openalex.org/A5083766160
const AUTHOR_ID = "A5083766160";

// Topics whose literature is the anticoagulation/thrombosis programme rather than
// glycoscience. Used only to label cohorts whose OQL query names a topic; a
// PUBLICATION's field comes from tools/topics.js, which the user reviewed.
const ANTI_TOPICS = new Set(["T10881", "T11917", "T11660", "T10620"]);
const GLYCO_TOPICS = new Set(["T10602", "T10835", "T11131", "T12387"]);

// Terms that mark a cohort row as pandemic-related. Used ONLY to count them, so the
// methods section can say the exclusion was considered and declined with the number
// behind it. Nothing is filtered on this: an earlier build carried every distribution
// twice so a reader could toggle it, and the user retired that on 2026-11-06 -- the
// rows hold ~1% of citations inside the exact cohorts, so the toggle moved a handful
// of percentiles by one rank and made every quoted figure conditional on a setting.
const PANDEMIC = /\b(sars[- ]?cov|sars|covid|coronavirus|spike protein|remdesivir|pandemic)\b/i;

// ---------------------------------------------------------------- CSV reading

// RFC 4180. Splitting on newlines is wrong in general (quoted fields may contain
// them) and splitting on commas is wrong here specifically (author lists contain
// them). The header is checked so a column rename is detectable rather than
// silently misparsed.
function parseCsv(text) {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c !== "\r") field += c;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

// The exports carry these five columns and no identifier: no DOI, no OpenAlex id,
// no topic. Title is therefore the only join key available, and it repeats, so
// nothing downstream may treat a title match as one-to-one.
//
// OQL can add a trailing FWCI column (the user enabled it on 2026-11-05). It is
// accepted and used when present -- a cohort's own FWCI distribution turns a raw
// citation percentile into an age- and field-normalised one -- and simply ignored
// when absent, so a five-column export still parses. The five base columns must
// still appear, in order, at the front.
const EXPECTED_COLUMNS = ["Title", "Author", "Year", "Citation count", "Open access"];

function checkHeader(name, header) {
  const base = header.slice(0, EXPECTED_COLUMNS.length);
  const extra = header.slice(EXPECTED_COLUMNS.length);
  const badBase = base.join(",") !== EXPECTED_COLUMNS.join(",");
  const badExtra = extra.some((c) => c !== "FWCI");
  if (badBase || badExtra) {
    throw new Error(
      `${name}: unexpected columns [${header.join(", ")}], expected [${EXPECTED_COLUMNS.join(", ")}]` +
      ` optionally followed by [FWCI]`
    );
  }
  return { hasFwci: header.length > EXPECTED_COLUMNS.length };
}

function readCohortCsv(file) {
  const rows = parseCsv(fs.readFileSync(file, "utf8"));
  const header = (rows.shift() || []).map((h) => h.trim());
  const { hasFwci } = checkHeader(path.basename(file), header);
  const out = [];
  let blankTitle = 0;
  let badCount = 0;
  for (const r of rows) {
    const title = (r[0] || "").trim();
    const year = parseInt(r[2], 10);
    const cites = parseInt(r[3], 10);
    if (!title) {
      blankTitle++;
      continue;
    }
    if (!Number.isFinite(cites) || cites < 0) {
      badCount++;
      continue;
    }
    // FWCI is optional. OpenAlex omits it for works it cannot model, so an empty
    // cell is expected, not an error; a non-numeric one is ignored the same way.
    let fwci = null;
    if (hasFwci) {
      const f = parseFloat(r[EXPECTED_COLUMNS.length]);
      if (Number.isFinite(f) && f >= 0) fwci = f;
    }
    out.push({
      title,
      author: (r[1] || "").trim(),
      year: Number.isFinite(year) ? year : null,
      cites,
      fwci,
      pandemic: PANDEMIC.test(title) || PANDEMIC.test(r[1] || ""),
    });
  }
  return { rows: out, blankTitle, badCount, rawRecords: rows.length, hasFwci };
}

// ------------------------------------------------------------- distributions

// Percentile rank of `value` in a sorted ascending array: the share of the cohort
// at or below it. Ties are shared, which is the conservative choice for a filing.
function pctRank(sorted, value) {
  if (!sorted || !sorted.length) return null;
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid] <= value) lo = mid + 1;
    else hi = mid;
  }
  return (100 * lo) / sorted.length;
}

function quantile(sorted, p) {
  if (!sorted.length) return null;
  return sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))];
}

function summarize(values) {
  const s = [...values].sort((a, b) => a - b);
  const n = s.length;
  if (!n) return { n: 0 };
  const sum = s.reduce((a, b) => a + b, 0);
  return {
    n,
    mean: +(sum / n).toFixed(2),
    median: quantile(s, 0.5),
    p75: quantile(s, 0.75),
    p90: quantile(s, 0.9),
    p95: quantile(s, 0.95),
    p99: quantile(s, 0.99),
    max: s[n - 1],
  };
}

// A cohort's distribution, plus each year's. Pandemic-related rows stay IN every
// bucket; they are counted so the count is auditable, never subtracted.
function buildDistribution(rows) {
  const byYear = {};
  for (const r of rows) {
    if (r.year == null) continue;
    (byYear[r.year] = byYear[r.year] || []).push(r.cites);
  }
  const srt = (v) => [...v].sort((a, b) => a - b);
  const citesAll = rows.reduce((a, b) => a + b.cites, 0);
  const citesPan = rows.reduce((a, b) => a + (b.pandemic ? b.cites : 0), 0);
  return {
    overall: summarize(rows.map((r) => r.cites)),
    // Descriptive only. No percentile anywhere in this artifact is computed on a
    // pandemic-filtered cohort -- see the note on PANDEMIC.
    pandemic_rows: rows.filter((r) => r.pandemic).length,
    pandemic_share_rows_pct: rows.length ? +((100 * rows.filter((r) => r.pandemic).length) / rows.length).toFixed(1) : 0,
    pandemic_share_citations_pct: citesAll ? +((100 * citesPan) / citesAll).toFixed(1) : 0,
    // Sorted arrays are what a percentile is computed against; published so a
    // reader can reproduce any figure in this file without re-reading the CSV.
    sorted: srt(rows.map((r) => r.cites)),
    by_year: Object.fromEntries(Object.entries(byYear).map(([y, v]) => [y, srt(v)])),
    yearly: Object.fromEntries(
      Object.entries(byYear)
        .sort((a, b) => a[0] - b[0])
        .map(([y, v]) => [y, summarize(v)])
    ),
    // FWCI, when the export carries it. A raw citation percentile answers "how
    // many works in this field and year attracted fewer citations"; an FWCI
    // percentile answers "how many comparable works were less cited relative to
    // their own age and field". The second is the one that survives a reviewer
    // asking why a 2011 paper is being compared to 2011's citation counts at all.
    ...buildFwciDistribution(rows),
  };
}

// Built only when at least one row carries an FWCI, so a five-column export (and
// every figure derived from it) is unchanged. Rows without a value are dropped
// from each bucket rather than treated as zero -- OpenAlex omits FWCI for works
// it cannot model, and a zero would drag the cohort's median down falsely.
function buildFwciDistribution(rows) {
  const withFwci = rows.filter((r) => r.fwci != null);
  if (!withFwci.length) return { fwci: null };
  const srt = (v) => [...v].sort((a, b) => a - b);
  const byYear = {};
  for (const r of withFwci) {
    if (r.year == null) continue;
    (byYear[r.year] = byYear[r.year] || []).push(r.fwci);
  }
  return {
    fwci: {
      rows_with_value: withFwci.length,
      rows_total: rows.length,
      overall: summarize(withFwci.map((r) => r.fwci)),
      sorted: srt(withFwci.map((r) => r.fwci)),
      by_year: Object.fromEntries(Object.entries(byYear).map(([y, v]) => [y, srt(v)])),
      yearly: Object.fromEntries(
        Object.entries(byYear)
          .sort((a, b) => a[0] - b[0])
          .map(([y, v]) => [y, summarize(v)])
      ),
    },
  };
}

// --------------------------------------------------------------------- fields

// A publication's field is taken from tools/topics.js -- the human-reviewed split
// the dashboard's network figures already use -- because the user's rule is that
// anticoagulant work ranks against anticoagulant-like fields. A paper absent from
// that table is "unassigned" and is ranked against nothing rather than guessed at.
function loadTopicTable() {
  try {
    return require("./topics.js").TOPICS || {};
  } catch {
    return {};
  }
}

// Which field a cohort measures. An explicit manifest `field` always wins;
// otherwise a topic id in the OQL string decides it.
function cohortField(def) {
  if (def.field) return def.field;
  const m = /T\d{5}/.exec(def.oql || "");
  if (m) {
    if (ANTI_TOPICS.has(m[0])) return "anti";
    if (GLYCO_TOPICS.has(m[0])) return "glyco";
  }
  return "broad";
}

// A cohort ranks a paper when the fields are compatible. "both" papers belong to
// either literature, so either programme cohort must rank them; "broad" cohorts
// (the keyword exports) rank everything but are labelled broad and are never
// presented as the exact-field answer.
function cohortRanks(cField, paperField) {
  if (cField === "broad") return paperField !== "unassigned";
  if (!paperField || paperField === "unassigned") return false;
  if (paperField === "both") return true;
  if (paperField === "other") return false;
  return cField === paperField;
}

// ------------------------------------------------------------- OpenAlex fetch

async function fetchAuthorWorks() {
  let key = "";
  try {
    require("./env.js");
    key = process.env.OPENALEX_API_KEY || "";
  } catch {
    key = process.env.OPENALEX_API_KEY || "";
  }
  const url =
    `https://api.openalex.org/works?filter=author.id:${AUTHOR_ID}` +
    `&per-page=200&select=id,display_name,publication_year,cited_by_count,fwci,type,primary_topic,doi`;
  const headers = { Accept: "application/json" };
  // Bearer header, never a query parameter: a failed request is recorded as
  // `${msg} :: ${url}` and that note can end up in a report JSON.
  if (key) headers.Authorization = `Bearer ${key}`;
  const r = await fetch(url, { headers });
  const text = await r.text();
  if (!r.ok) throw new Error(`OpenAlex author ${AUTHOR_ID} -> HTTP ${r.status}: ${text.slice(0, 200)}`);
  const j = JSON.parse(text);
  return (j.results || []).map((w) => ({
    openalex_id: w.id ? w.id.split("/").pop() : null,
    display_name: w.display_name || "",
    year: Number.isFinite(w.publication_year) ? w.publication_year : null,
    cites: Number.isFinite(w.cited_by_count) ? w.cited_by_count : null,
    fwci: typeof w.fwci === "number" ? +w.fwci.toFixed(3) : null,
    type: w.type || null,
    doi: w.doi || null,
    topic: w.primary_topic ? w.primary_topic.id.split("/").pop() : null,
    topic_name: w.primary_topic ? w.primary_topic.display_name : null,
  }));
}

// ------------------------------------------------- venue name and abbreviation

// Google Scholar renders a venue as "Name volume (issue), pages , year", and the
// packet's publication table now prints the journal on each row. The tail has to
// come off before the name can be looked up anywhere, and it comes off from the
// right, because the tail varies (a volume with an issue, an article number, an
// eLocator, a page range) while the name never does.
//
// The one shape that must survive untouched is a patent number, where commas sit
// inside a thousands group ("US Patent 20,160,115,280"). Those commas are never
// followed by a space, and every real page-separator comma is, so a space after the
// comma is what distinguishes "here the citation begins" from "still one number".
function venueName(v) {
  let s = String(v || "").trim();
  if (!s) return "";
  s = s.replace(/\s+[,;]\s*\d{4}[a-z]?\s*$/i, "");   // trailing ", 2020"
  // ", 72-73" | ", 24043" | ", eabf6834" | ", e01178-19" | ", 893-905. e7" | ", cwad091"
  s = s.replace(/,[ \t]+[A-Za-z0-9][\w./*-]*(?:\s*[-–—]\s*[\w./*-]+)?(?:\.\s*e\d+)?\s*$/i, "");
  s = s.replace(/\s+\(\s*\d+\s*\)\s*$/, "");          // " (12)" -- a numeric issue
  s = s.replace(/\s+\d{1,5}\s*$/, "");                // " 298" -- a bare volume
  return s.trim().replace(/[,;:.\s]+$/, "");
}

// Whether two journal names name the SAME journal. Strict by intent: an
// abbreviation printed in a filing is a factual claim about where a paper appeared,
// so nothing is abbreviated on a fuzzy match.
//
// Two variations are accepted, because Google Scholar prints a shorter name than the
// registry in exactly these ways:
//   * a leading "The" ("The Journal of biological chemistry" vs "Journal of
//     Biological Chemistry");
//   * the registry's longer official title, where Scholar drops the end ("Proceedings
//     of the National Academy of Sciences" for NLM's "...of Sciences of the United
//     States of America").
// The prefix must be at least three words and the dropped tail must begin with a
// connector, which is what stops "Science" being read as "Science Advances" -- the
// hazard that a bare prefix test would walk straight into.
//
// Rejected on purpose: "Peptide Libraries: Methods and Protocols", where Scholar
// printed the BOOK's title and the registry's journal is the series it sits in. Those
// are different names for different things and the row keeps what Scholar printed.
function sameJournal(a, b) {
  const clean = (s) => String(s || "").replace(/^the\s+/, "").trim();
  const x = clean(a);
  const y = clean(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  if (!long.startsWith(short + " ")) return false;
  if (short.split(/\s+/).length < 3) return false;
  return /^(of|the|and|for|in)\s/i.test(long.slice(short.length + 1));
}

// The key a venue abbreviation is looked up under. Lower-cased, with the
// parenthetical a disambiguation adds ("Bioinformatics (Oxford, England)") and the
// subtitle NLM appends after a colon ("Cellular and molecular life sciences : CMLS")
// removed, so Scholar's shorter form and NLM's fuller one land on the same key.
// Matching is deliberately strict: an abbreviation is a factual claim about a
// journal, so nothing is abbreviated on a fuzzy name match.
function normVenue(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/\([^)]*\)/g, " ")
    .split(/\s*:\s*/)[0]
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function loadAbbrevs() {
  try {
    const j = JSON.parse(fs.readFileSync(ABBR_JSON, "utf8"));
    return { file: true, retrieved_on: j.retrieved_on || null, entries: j.entries || {} };
  } catch {
    return { file: false, retrieved_on: null, entries: {} };
  }
}

// NCBI E-utilities. The `source` field of a PubMed esummary record IS the NLM
// (MEDLINE / PubMed-compliant) journal abbreviation -- "J Med Chem", "Mol Cell
// Proteomics" -- which is the form a reviewer recognises, so it is taken from the
// registry rather than derived by rule. NLM's own bulk endpoints (the FTP list and
// the ptool) were checked first and both sit behind a browser-verification
// challenge, so the lookup goes record by record the same way tools/crosscheck.js
// reaches PubMed.
//
// Credentials go in the POST body, never the query string: a failed request is
// recorded as `${msg} :: ${url}` and that note can end up in an artifact.
const NCBI_BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function ncbiForm(params) {
  const p = { tool: "eb1a-field-comparison", retmode: "json" };
  if (process.env.CROSSCHECK_EMAIL) p.email = process.env.CROSSCHECK_EMAIL;
  if (process.env.NCBI_API_KEY) p.api_key = process.env.NCBI_API_KEY;
  return Object.assign(p, params);
}

async function ncbiPost(method, params, errors) {
  for (let attempt = 0; attempt < 4; attempt++) {
    let res;
    try {
      res = await fetch(`${NCBI_BASE}/${method}`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
        body: new URLSearchParams(ncbiForm(params)),
      });
    } catch (e) {
      errors.push(`${method} fetch failed: ${e.message}`);
      await sleep(1500);
      continue;
    }
    const text = await res.text();
    if (res.status === 429 || res.status >= 500) {
      // Throttled or failing: back off and retry. A look-up that did not complete
      // is NOT a finding that a journal has no abbreviation, so the caller must be
      // able to tell an abandoned row from an answered one -- hence `unknown`.
      const hint = Number(res.headers.get("retry-after")) || 0;
      if (attempt === 3) {
        errors.push(`${method} abandoned after 4 attempts: HTTP ${res.status}`);
        return { unknown: true };
      }
      await sleep(Math.min(Math.max(hint * 1000, 1200), 60000));
      continue;
    }
    if (!res.ok) {
      errors.push(`${method} HTTP ${res.status}: ${text.slice(0, 120)}`);
      return { unknown: true };
    }
    try { return JSON.parse(text); } catch {
      errors.push(`${method} returned non-JSON`);
      return { unknown: true };
    }
  }
  return { unknown: true };
}

// One abbreviation per distinct venue name, reached through any DOI published for a
// work in it. Roughly 30 names for 48 publications, so the anonymous 3-request
// limit is respected by pacing rather than by needing a key.
async function fetchAbbrevs(want, existing) {
  const errors = [];
  const entries = { ...existing };
  const todo = Object.entries(want).filter(([k]) => !entries[k]);
  console.log(`  abbreviations: ${Object.keys(want).length} distinct venues, ${todo.length} to look up`);
  for (const [key, info] of todo) {
    if (!info.doi) {
      // Nothing to search on. The patents and (for now) any venue whose works carry
      // no DOI land here: the row prints Scholar's own venue text and the page says
      // no registry abbreviation was reachable.
      entries[key] = { venue_as_printed: info.printed, nlm_abbreviation: null, lookup: "none", doi: null, note: "no DOI on any work in this venue" };
      continue;
    }
    const s = await ncbiPost("esearch.fcgi", { db: "pubmed", term: `"${info.doi}"[doi]` }, errors);
    if (s.unknown) continue;
    const ids = (s.esearchresult && s.esearchresult.idlist) || [];
    if (!ids.length) {
      // A real answer: this work is not in PubMed, so PubMed holds no NLM
      // abbreviation reachable through it. Recorded so the next run does not ask
      // again and so the page can say "no registry abbreviation" rather than guess.
      entries[key] = { venue_as_printed: info.printed, nlm_abbreviation: null, lookup: "pubmed-doi", doi: info.doi, note: "no PubMed record for this DOI" };
      continue;
    }
    await sleep(400);
    const e = await ncbiPost("esummary.fcgi", { db: "pubmed", id: ids[0] }, errors);
    if (e.unknown) continue;
    const r = e.result && e.result[ids[0]];
    if (!r) continue;
    const nlmKey = normVenue(r.fulljournalname);
    entries[key] = {
      venue_as_printed: info.printed,
      nlm_abbreviation: r.source || null,
      nlm_full_journal_name: r.fulljournalname || null,
      nlm_unique_id: r.nlmuniqueid || null,
      lookup: "pubmed-doi",
      doi: info.doi,
      pmid: ids[0],
      // The abbreviation is only usable if NLM's journal and Scholar's venue are the
      // same journal. If the names disagree the row keeps its full name and a person
      // decides, rather than being labelled from a match nobody checked.
      name_matches: sameJournal(nlmKey, key),
    };
    await sleep(400);
  }
  return { entries, errors };
}

// The distinct venues that need an abbreviation, keyed by normVenue, one DOI each.
// A journal is looked up once however many of the PI's papers appeared in it.
//
// OpenAlex writes a DOI as a resolver URL ("https://doi.org/10.1021/..."), but
// PubMed's [doi] field holds the bare name, so the prefix has to come off or every
// search returns nothing and the run reports a registry that has no abbreviations.
//
// A venue with no DOI anywhere cannot be looked up and is recorded as such rather
// than searched on an empty term: searching `"null"[doi]` answers with an unrelated
// paper, which is exactly the kind of confident wrong label a filing cannot carry.
function wantedAbbrevs(articles) {
  const want = {};
  for (const a of articles) {
    const key = normVenue(a.venue_journal);
    if (!key) continue;
    if (!want[key]) want[key] = { printed: a.venue_journal, doi: null, titles: 0 };
    want[key].titles++;
    if (!want[key].doi && a.doi) {
      want[key].doi = String(a.doi).toLowerCase().replace(/^https?:\/\/(dx\.)?doi\.org\//, "");
    }
  }
  return want;
}

// Copy the cached abbreviation onto each row. Only a name NLM agrees with is used:
// an abbreviation is a factual claim about a journal, so a row whose venue name does
// not match the registry's journal keeps the name Scholar printed and the page says
// no registry abbreviation exists for it.
function applyAbbrevs(articles, cache) {
  const stats = { total: articles.length, abbreviated: 0, no_entry: 0, name_mismatch: 0, no_abbreviation: 0 };
  for (const a of articles) {
    const e = cache.entries[normVenue(a.venue_journal)];
    if (!e) { stats.no_entry++; continue; }
    if (!e.nlm_abbreviation) { stats.no_abbreviation++; continue; }
    if (e.name_matches === false) { stats.name_mismatch++; continue; }
    a.venue_abbr = e.nlm_abbreviation;
    a.venue_abbr_source = "NLM";
    stats.abbreviated++;
  }
  return stats;
}

// Title is the only key shared by the Scholar record, the CSV exports and the
// OpenAlex author record.
function normTitle(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Google Scholar truncates a long title with an ellipsis, so an exact normalised
// comparison cannot match it. Falling back to a leading-prefix match is safe only
// under both conditions below: a short prefix is satisfied by unrelated papers
// (the same reasoning that sets the title-match floor in tools/crosscheck.js), and
// a prefix that several works share settles nothing. When either fails the row
// stays unmatched rather than being guessed at.
const MIN_PREFIX_WORDS = 8;

function buildTitleMatcher(works) {
  const exact = new Map();
  for (const w of works) {
    const k = normTitle(w.display_name);
    if (k && !exact.has(k)) exact.set(k, w);
  }
  const keyed = works.map((w) => ({ w, k: normTitle(w.display_name) })).filter((e) => e.k);
  const claimed = new Set();

  return function match(title) {
    const k = normTitle(title);
    if (!k) return null;
    const hit = exact.get(k);
    if (hit && !claimed.has(hit.openalex_id)) {
      claimed.add(hit.openalex_id);
      return { work: hit, basis: "exact" };
    }
    const words = k.split(" ");
    for (let n = words.length; n >= MIN_PREFIX_WORDS; n--) {
      const p = words.slice(0, n).join(" ");
      const hits = keyed.filter((e) => e.w !== hit && e.k.startsWith(p + " "));
      if (hits.length === 1 && !claimed.has(hits[0].w.openalex_id)) {
        claimed.add(hits[0].w.openalex_id);
        return { work: hits[0].w, basis: `prefix:${n}w` };
      }
    }
    return null;
  };
}

// --------------------------------------------------------------------- report

function build(opts = {}) {
  require("./env.js");
  const dash = JSON.parse(fs.readFileSync(DASH_JSON, "utf8"));
  const topicTable = loadTopicTable();
  const manifest = fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, "utf8")) : { cohorts: [] };

  const cohorts = [];
  const skipped = [];
  for (const def of manifest.cohorts || []) {
    const file = path.join(OPENALEX_DIR, def.file);
    if (!fs.existsSync(file)) {
      skipped.push({ id: def.id, file: def.file, reason: "file not present" });
      continue;
    }
    const { rows, blankTitle, badCount, rawRecords, hasFwci } = readCohortCsv(file);
    cohorts.push({
      id: def.id,
      label: def.label,
      field: cohortField(def),
      exact: def.exact !== false,
      has_fwci: !!hasFwci,
      oql: def.oql || null,
      file: def.file,
      note: def.note || null,
      reported_works: def.reported_works ?? null,
      parsed_records: rawRecords,
      // OQL tells you how many works it found. Fewer rows in the file means a
      // page was dropped mid-export and the cohort is silently too thin, which
      // inflates every percentile computed against it. More rows means OpenAlex
      // indexed new works after the export, which is harmless. The two need
      // opposite responses, so the check is direction-aware.
      count_matches_report:
        def.reported_works == null ? null : rawRecords === def.reported_works,
      count_delta: def.reported_works == null ? null : rawRecords - def.reported_works,
      usable_rows: rows.length,
      blank_title_rows: blankTitle,
      unreadable_count_rows: badCount,
      year_min: rows.reduce((m, r) => (r.year != null && (m == null || r.year < m) ? r.year : m), null),
      year_max: rows.reduce((m, r) => (r.year != null && (m == null || r.year > m) ? r.year : m), null),
      distribution: buildDistribution(rows),
    });
  }

  // Two exact cohorts for the same field with overlapping years means the same
  // works sit in two denominators. That is how a 2020 file and a 2008 file for
  // one topic would double-count 2020-2026, so say it out loud rather than let
  // a percentile quietly move because a cohort was added instead of replaced.
  const overlapWarnings = [];
  for (let i = 0; i < cohorts.length; i++) {
    for (let j = i + 1; j < cohorts.length; j++) {
      const a = cohorts[i], b = cohorts[j];
      if (!a.exact || !b.exact || a.field !== b.field) continue;
      const lo = Math.max(a.year_min ?? -Infinity, b.year_min ?? -Infinity);
      const hi = Math.min(a.year_max ?? Infinity, b.year_max ?? Infinity);
      if (lo <= hi) {
        overlapWarnings.push(
          `${a.id} and ${b.id} are both exact "${a.field}" cohorts and both cover ` +
          `${lo}-${hi}. Keep one cohort per field: replace the older manifest ` +
          `entry rather than adding alongside it.`
        );
      }
    }
  }

  return fetchAuthorWorks().then(async (works) => {
    const matchTitle = buildTitleMatcher(works);

    const articles = (dash.articles || []).map((a) => {
      const m = matchTitle(a.title);
      const oa = m ? m.work : null;
      const field = topicTable[a.cites_id] || "unassigned";
      // Rule 3: the OpenAlex year governs same-year matching, on both sides.
      const matchYear = oa ? oa.year : null;
      const entry = {
        cites_id: a.cites_id,
        scholar_title: a.title,
        scholar_year: a.year ?? null,
        // The venue as Google Scholar prints it, plus the journal name parsed out of
        // it and the NLM abbreviation for that name when the registry has one. The
        // packet's publication table prints the abbreviation; a row whose venue is a
        // patent, a university or a book series has none and prints its name as-is.
        scholar_venue: a.venue || null,
        venue_journal: venueName(a.venue),
        venue_abbr: null,
        venue_abbr_source: null,
        scholar_cited_by: a.cited_by_at_snapshot ?? null,
        independent: a.independent ?? null,
        field,
        matched: !!oa,
        match_basis: m ? m.basis : null,
        openalex_id: oa ? oa.openalex_id : null,
        oa_title: oa ? oa.display_name : null,
        oa_year: oa ? oa.year : null,
        oa_cites: oa ? oa.cites : null,
        fwci: oa ? oa.fwci : null,
        oa_type: oa ? oa.type : null,
        doi: oa ? oa.doi : null,
        primary_topic: oa ? oa.topic : null,
        primary_topic_name: oa ? oa.topic_name : null,
        year_disagreement:
          oa && oa.year != null && a.year != null && oa.year !== a.year
            ? { scholar: a.year, openalex: oa.year }
            : null,
        ranks: {},
      };
      for (const c of cohorts) {
        if (!cohortRanks(c.field, field)) {
          entry.ranks[c.id] = { excluded: true, reason: `cohort measures "${c.field}", paper is "${field}"` };
          continue;
        }
        const rankOn = (tableKey, sortedKey) => {
          const same = matchYear != null ? c.distribution[tableKey][String(matchYear)] : null;
          return {
            same_year:
              same && same.length && entry.oa_cites != null
                ? { pct: +pctRank(same, entry.oa_cites).toFixed(1), cohort_n: same.length, year: matchYear }
                : null,
            pooled:
              entry.oa_cites != null && c.distribution[sortedKey].length
                ? {
                    pct: +pctRank(c.distribution[sortedKey], entry.oa_cites).toFixed(1),
                    cohort_n: c.distribution[sortedKey].length,
                  }
                : null,
          };
        };
        const both = rankOn("by_year", "sorted");
        // The same percentile computed on FWCI instead of raw citations, so a
        // paper's position is stated against works of its own age AND its own
        // field. Only available when the export carried an FWCI column.
        const rankFwci = (tableKey) => {
          const fd = c.distribution.fwci;
          if (!fd || entry.fwci == null) return null;
          const same = matchYear != null ? fd[tableKey][String(matchYear)] : null;
          return same && same.length
            ? { pct: +pctRank(same, entry.fwci).toFixed(1), cohort_n: same.length, year: matchYear }
            : null;
        };
        entry.ranks[c.id] = {
          same_year: both.same_year,
          pooled: both.pooled,
          fwci_same_year: rankFwci("by_year"),
        };
      }
      return entry;
    });

    // Fill in the abbreviation after the rows exist, so the lookup is keyed off the
    // same venue string the table will print. `--fetch-abbrevs` asks NCBI for any
    // journal the cache does not hold yet and writes the cache before applying it;
    // an ordinary build only ever reads what is already on disk.
    const want = wantedAbbrevs(articles);
    let cache = loadAbbrevs();
    if (opts.fetchAbbrevs) {
      const r = await fetchAbbrevs(want, cache.entries);
      cache = {
        file: true,
        retrieved_on: new Date().toISOString().slice(0, 10),
        note:
          `NLM (PubMed-compliant) journal abbreviations, read from the "source" field ` +
          `of a PubMed esummary record reached through each journal's own DOI. Keyed ` +
          `by the journal name as Google Scholar prints it.`,
        entries: r.entries,
      };
      fs.writeFileSync(ABBR_JSON, JSON.stringify(cache, null, 2) + "\n");
      console.log(`  wrote ${path.relative(ROOT, ABBR_JSON)} (${Object.keys(r.entries).length} venues)`);
      for (const e of r.errors) console.log(`  abbrev lookup: ${e}`);
    }
    const abbrStats = applyAbbrevs(articles, cache);

    const matched = articles.filter((a) => a.matched);
    const unmatched = articles.filter((a) => !a.matched);
    const totalIndependent = (dash.articles || []).reduce((s, a) => s + (a.independent || 0), 0);

    // A paper is rankable when at least one cohort measuring its own field
    // contains works from its own OpenAlex publication year.
    const exactCohorts = cohorts.filter((c) => c.exact);
    const rankable = articles.filter((a) =>
      exactCohorts.some((c) => {
        const r = a.ranks[c.id];
        return r && r.same_year;
      })
    );
    const rankableInd = rankable.reduce((s, a) => s + (a.independent || 0), 0);

    // Why each unrankable paper is unrankable, named rather than left as one
    // small coverage number. Asked and answered by hand on 2026-11-05, so the
    // artifact answers it too: the causes are entirely different fixes -- a
    // cohort that starts too late, a field no exported cohort measures, or a
    // field nobody has claimed for the paper.
    const unrankableReason = (a) => {
      if (!a.matched) return "not matched to an OpenAlex work";
      if (a.oa_year == null) return "no OpenAlex publication year";
      const anyForField = exactCohorts.some((c) => a.ranks[c.id] && !a.ranks[c.id].excluded);
      // Name the PAPER'S PROGRAMME, not its own primary topic. A cohort ranks by
      // the programme the user assigned the paper (tools/topics.js), so a paper
      // whose primary topic is T11917 is ranked by any 'anti' cohort including
      // T10881 -- naming T11917 here would suggest an export that is not needed.
      if (!anyForField) return `no exact cohort measures its programme (${a.field})`;
      return `cohort for its programme has no ${a.oa_year} works (starts ${a.oa_year < 2020 ? "2020" : "later"})`;
    };
    const unranked = articles.filter((a) => !rankable.includes(a) && (a.independent || 0) > 0);
    const unrankableBreakdown = {};
    for (const a of unranked) {
      const k = unrankableReason(a);
      unrankableBreakdown[k] = unrankableBreakdown[k] || { papers: 0, independent: 0, rows: [] };
      unrankableBreakdown[k].papers++;
      unrankableBreakdown[k].independent += a.independent || 0;
      unrankableBreakdown[k].rows.push({
        openalex_id: a.openalex_id,
        scholar_title: a.scholar_title,
        year: a.oa_year,
        field: a.field,
        independent: a.independent,
        topic: a.primary_topic,
        topic_name: a.primary_topic_name,
      });
    }

    const pre2020 = (dash.articles || []).reduce(
      (s, a) => s + (a.year != null && a.year < 2020 ? a.independent || 0 : 0),
      0
    );

    const fwciArticles = matched.filter((a) => a.fwci != null && a.oa_type === "article").map((a) => a.fwci);
    const articlesTotal = works.filter((w) => w.type === "article").length;
    // Counted two ways, and the difference matters. OpenAlex publishes an FWCI on
    // 48 of its 51 records for the author; the chart can only use the ones that
    // also matched a title in the packet, which is fewer. Saying "45 of 51 carry a
    // value" would read as though OpenAlex withheld three figures it in fact has.
    const fwciOnRecord = works.filter((w) => w.fwci != null);
    const noFwciOnRecord = works.filter((w) => w.fwci == null);

    const byTopic = {};
    for (const a of matched) {
      const t = a.primary_topic || "(none)";
      const b = (byTopic[t] = byTopic[t] || { name: a.primary_topic_name, works: 0, cites: 0, fwci: [], fields: new Set() });
      b.works++;
      b.cites += a.oa_cites || 0;
      b.fields.add(a.field);
      if (a.fwci != null) b.fwci.push(a.fwci);
    }
    const topics = Object.entries(byTopic)
      .map(([t, b]) => ({
        topic: t,
        name: b.name,
        fields: [...b.fields],
        works: b.works,
        cites: b.cites,
        mean_fwci: b.fwci.length ? +(b.fwci.reduce((s, x) => s + x, 0) / b.fwci.length).toFixed(2) : null,
      }))
      .sort((a, b) => b.works - a.works || b.cites - a.cites);

    // Per-programme figures: the number that shows the two literatures behave
    // differently and therefore must not be pooled.
    const byField = {};
    for (const f of ["glyco", "anti", "both", "other", "unassigned"]) {
      const list = matched.filter((a) => a.field === f);
      const fv = list.filter((a) => a.fwci != null).map((a) => a.fwci);
      byField[f] = {
        papers: list.length,
        scholar_cited_by: list.reduce((s, a) => s + (a.scholar_cited_by || 0), 0),
        independent: list.reduce((s, a) => s + (a.independent || 0), 0),
        openalex_cites: list.reduce((s, a) => s + (a.oa_cites || 0), 0),
        mean_fwci: fv.length ? +(fv.reduce((s, x) => s + x, 0) / fv.length).toFixed(2) : null,
        median_fwci: fv.length ? summarize(fv).median : null,
        max_fwci: fv.length ? Math.max(...fv) : null,
      };
    }

    const scholarTotal = (dash.articles || []).reduce((s, a) => s + (a.cited_by_at_snapshot || 0), 0);
    const oaTotal = matched.reduce((s, a) => s + (a.oa_cites || 0), 0);

    return {
      generated_at: new Date().toISOString().slice(0, 10),
      author_id: AUTHOR_ID,
      author_url: `https://openalex.org/authors/${AUTHOR_ID}`,
      packet_snapshot_date: dash.global.snapshot_date,
      basis: "openalex_vs_openalex",
      scale_warning:
        `Every percentile in this file compares OpenAlex counts with OpenAlex counts. ` +
        `Google Scholar, which the packet's citation record is built from, reports ` +
        `${scholarTotal.toLocaleString()} citations for the same body of work where ` +
        `OpenAlex reports ${oaTotal.toLocaleString()} -- about ` +
        `${(100 * (scholarTotal / oaTotal - 1)).toFixed(0)}% higher. A percentile here is ` +
        `not a percentile of the packet's figures, and the two must never be quoted together.`,
      scale: {
        scholar_citations_all_articles: scholarTotal,
        openalex_citations_matched: oaTotal,
        scholar_over_openalex_pct: oaTotal ? +(100 * (scholarTotal / oaTotal - 1)).toFixed(1) : null,
        packet_independent_countable: dash.global.independent_countable,
        packet_distinct_independent_papers: dash.global.distinct_independent_papers,
      },
      coverage: {
        scholar_articles: articles.length,
        openalex_works: works.length,
        matched_in_openalex: matched.length,
        unmatched_titles: unmatched.map((a) => ({
          cites_id: a.cites_id,
          title: a.scholar_title,
          year: a.scholar_year,
          independent: a.independent,
        })),
        independent_citations_total: totalIndependent,
        independent_rankable: rankableInd,
        rankable_pct: totalIndependent ? +((100 * rankableInd) / totalIndependent).toFixed(1) : 0,
        independent_before_2020: pre2020,
        before_2020_pct: totalIndependent ? +((100 * pre2020) / totalIndependent).toFixed(1) : 0,
        unrankable_by_cause: unrankableBreakdown,
        exact_cohort_year_span: (() => {
          const ys = exactCohorts.flatMap((c) => [c.year_min, c.year_max]).filter((y) => y != null);
          return ys.length ? [Math.min(...ys), Math.max(...ys)] : null;
        })(),
        note:
          `A paper is rankable only when a cohort measuring its own field contains works ` +
          `from its own OpenAlex publication year. A cohort that begins after a paper's ` +
          `year cannot rank it at all, so the reason every unrankable paper is unrankable ` +
          `is published in unrankable_by_cause rather than left for a reader to infer from ` +
          `one coverage percentage.`,
      },
      fwci: {
        explanation:
          `Field-weighted citation impact: citations received in a work's first four years ` +
          `(its publication year plus the three that follow) divided by the citations ` +
          `expected for a work of that publication year, of that work type, in that OpenAlex ` +
          `subfield. 1.00 means a work attracted exactly what a comparable work would; 2.00 ` +
          `means twice as many. OpenAlex assigns the subfield from the work's own text rather ` +
          `than from its journal, splits articles into journal and conference proceedings, and ` +
          `applies no adjustment for an author's position on the paper. Age-matched and ` +
          `field-matched by construction, so it answers a comparison across publication years ` +
          `with no cohort download. Published by OpenAlex; nothing here computes it.`,
        works_with_value: matched.filter((a) => a.fwci != null).length,
        works_total: works.length,
        // OpenAlex publishes an FWCI only for works it can model, and it omits it
        // for uncited works. State plainly whether anything with citations lacks a
        // figure, rather than asserting a reason the data has not been asked.
        works_without_value: works.length - matched.filter((a) => a.fwci != null).length,
        works_without_value_all_uncited: works
          .filter((w) => !matched.some((a) => a.openalex_id === w.openalex_id && a.fwci != null))
          .every((w) => (w.cites || 0) === 0),
        // Coverage on OpenAlex's own record, independent of title matching.
        record_fwci_count: fwciOnRecord.length,
        record_works_total: works.length,
        record_no_fwci: noFwciOnRecord.map((w) => ({
          openalex_id: w.openalex_id, title: w.display_name, type: w.type, cites: w.cites,
        })),
        record_no_fwci_all_uncited: noFwciOnRecord.every((w) => (w.cites || 0) === 0),
        // Distribution over every article on the OpenAlex record, matched or not.
        // It differs slightly from the chart's, which can only use works whose
        // title also appears in the packet, and the two must not be quoted as one.
        record_article_distribution: summarize(
          works.filter((w) => w.type === "article" && w.fwci != null).map((w) => w.fwci)
        ),
        articles_with_value: fwciArticles.length,
        articles_total: articlesTotal,
        every_article_has_value: fwciArticles.length === articlesTotal,
        distribution: summarize(fwciArticles),
        above_1: fwciArticles.filter((v) => v > 1).length,
        at_or_above_2: fwciArticles.filter((v) => v >= 2).length,
        at_or_above_3: fwciArticles.filter((v) => v >= 3).length,
      },
      programmes: byField,
      venues: {
        explanation:
          `The publication table prints each journal in the NLM (PubMed-compliant) ` +
          `abbreviation a reviewer recognises -- "J Med Chem", not "Journal of medicinal ` +
          `chemistry". That form is not derived by rule from the name; it is read from the ` +
          `"source" field of a PubMed esummary record, reached through a DOI published for a ` +
          `work in that journal, and cached in OpenAlex/journal-abbreviations.json. A venue ` +
          `the registry has no abbreviation for prints the name Google Scholar gave it, and a ` +
          `venue whose name does not match the registry's journal is never abbreviated.`,
        retrieved_on: cache.retrieved_on,
        distinct_venues: Object.keys(want).length,
        rows_abbreviated: abbrStats.abbreviated,
        rows_no_registry_entry: abbrStats.no_entry,
        rows_no_abbreviation: abbrStats.no_abbreviation,
        rows_name_mismatch: abbrStats.name_mismatch,
        rows_total: abbrStats.total,
      },
      programme_note:
        `The anticoagulation and glycoscience papers are two literatures and are reported ` +
        `apart, at the user's instruction. Pooling them would hide the difference between ` +
        `the two mean FWCI figures, which is itself evidence about where the citation impact ` +
        `sits.`,
      topics,
      cohorts: cohorts.map((c) => ({
        id: c.id,
        label: c.label,
        field: c.field,
        exact: c.exact,
        has_fwci: c.has_fwci,
        oql: c.oql,
        file: c.file,
        note: c.note,
        reported_works: c.reported_works,
        parsed_records: c.parsed_records,
        count_matches_report: c.count_matches_report,
        count_delta: c.count_delta,
        usable_rows: c.usable_rows,
        blank_title_rows: c.blank_title_rows,
        unreadable_count_rows: c.unreadable_count_rows,
        year_min: c.year_min,
        year_max: c.year_max,
        pandemic_rows: c.distribution.pandemic_rows,
        pandemic_share_rows_pct: c.distribution.pandemic_share_rows_pct,
        pandemic_share_citations_pct: c.distribution.pandemic_share_citations_pct,
        overall: c.distribution.overall,
        fwci: c.distribution.fwci
          ? {
              rows_with_value: c.distribution.fwci.rows_with_value,
              rows_total: c.distribution.fwci.rows_total,
              overall: c.distribution.fwci.overall,
              yearly: c.distribution.fwci.yearly,
              // Published so the same-year FWCI percentiles on each article row
              // can be reproduced without re-reading the CSV.
              by_year: c.distribution.fwci.by_year,
            }
          : null,
        yearly: c.distribution.yearly,
        sorted: c.distribution.sorted,
        by_year: c.distribution.by_year,
      })),
      cohorts_skipped: skipped,
      cohort_overlap_warnings: overlapWarnings,
      works_not_matched_to_scholar: works
        .filter((w) => !matched.some((a) => a.openalex_id === w.openalex_id))
        .map((w) => ({
          openalex_id: w.openalex_id,
          title: w.display_name,
          year: w.year,
          cites: w.cites,
          type: w.type,
          fwci: w.fwci,
        })),
      articles,
    };
  });
}

if (require.main === module) {
  const doFetch = process.argv.includes("--fetch-abbrevs");
  build({ fetchAbbrevs: doFetch })
    .then((data) => {
      fs.writeFileSync(OUT_JSON, JSON.stringify(data, null, 2));
      // A .js wrapper alongside the JSON so a page opened by double-clicking it
      // (file://) can read the data without a fetch. Same pattern the dashboard's
      // own data file uses.
      fs.writeFileSync(
        OUT_JS,
        `/* Generated by tools/build-field-comparison.js on ${data.generated_at}. Do not edit. */\n` +
          `window.FIELD_COMPARISON = ${JSON.stringify(data)};\n`
      );
      console.log(`wrote ${path.relative(ROOT, OUT_JSON)} and ${path.relative(ROOT, OUT_JS)}`);
      console.log(`  cohorts: ${data.cohorts.map((c) => `${c.id}[${c.field}]=${c.usable_rows}`).join(", ") || "(none)"}`);
      if (data.cohorts_skipped.length) console.log(`  skipped: ${data.cohorts_skipped.map((s) => s.id).join(", ")}`);
      for (const c of data.cohorts) {
        if (c.count_matches_report === false) {
          const short = c.count_delta < 0;
          console.log(
            `  ${short ? "WARNING" : "note"} ${c.id}: OQL reported ${c.reported_works} works, ` +
            `file holds ${c.parsed_records} (${c.count_delta > 0 ? "+" : ""}${c.count_delta}). ` +
            (short
              ? `Fewer rows than reported means a page was dropped -- re-export before ` +
                `trusting percentiles computed against it.`
              : `More rows than reported is harmless (OpenAlex indexed more works after ` +
                `the count was taken), but a cohort that grew is also a cohort whose ` +
                `figures moved, so re-check any percentile quoted from an older run.`)
          );
        }
      }
      for (const w of data.cohort_overlap_warnings) console.log(`  WARNING ${w}`);
      console.log(`  matched ${data.coverage.matched_in_openalex}/${data.coverage.scholar_articles} Scholar titles (${data.coverage.openalex_works} OpenAlex works)`);
      console.log(`  FWCI articles ${data.fwci.articles_with_value}/${data.fwci.articles_total}; median ${data.fwci.distribution.median}, max ${data.fwci.distribution.max}`);
      console.log(`  rankable independent citations: ${data.coverage.independent_rankable}/${data.coverage.independent_citations_total} (${data.coverage.rankable_pct}%)`);
      console.log(`  mean FWCI  glyco ${data.programmes.glyco.mean_fwci}  anti ${data.programmes.anti.mean_fwci}  both ${data.programmes.both.mean_fwci}`);
    })
    .catch((e) => {
      console.error("FAILED: " + e.message);
      process.exit(1);
    });
}

module.exports = {
  build, parseCsv, normTitle, pctRank, summarize, buildDistribution,
  cohortField, cohortRanks, EXPECTED_COLUMNS, AUTHOR_ID,
};

// Shared counting rules for the citation record.
//
// One definition of "what counts" lives here so the console summary, the
// ledger, and any future report cannot drift apart. The distinction that
// matters most: a record's classification (status) is not the same as whether
// it is counted in the filing totals (highlighted). A non-English entry can be
// classified INDEPENDENT and still be excluded, because the guide requires a
// certified human translation before it may be counted.

const fs = require("fs");
const path = require("path");

// An entry counts toward the independent total only when it is classified
// independent, corroborated or covered by a complete Scholar list, not held
// back as possibly non-English, and not a language edition of another row on
// the same citing list. Per the user's instruction on 2026-10-31 a language
// edition is never marked in an exhibit even if the language screen missed it:
// publisher translations carry the same author list and a near-identical DOI
// (10.1002/anie.7795967 vs 10.1002/ange.7795967), so markLanguageEditions sets
// duplicate_of on the copy that does not stand for the work and that alone is
// enough to withhold the mark.
function isHighlighted(e) {
  return (
    e.status === "INDEPENDENT" &&
    (e.confirm_state === "confirmed" || e.confirm_state === "unverified-coverage") &&
    !e.language_flag &&
    !e.duplicate_of
  );
}

// Whether a row would be marked on its own merits, ignoring the duplicate
// decision. Used to pick which copy of a language edition earns the mark.
function isHighlightCandidate(e) {
  return (
    e.status === "INDEPENDENT" &&
    (e.confirm_state === "confirmed" || e.confirm_state === "unverified-coverage") &&
    !e.language_flag
  );
}

// An entry the language screen alone is holding back: independent by
// classification, settled by corroboration or a complete Scholar list, and not a
// language edition of another row -- so a certified human translation of this
// one entry would make it countable. Reported so the packet can state honestly
// what was given up by not filing translations, and so the entries a translator
// would need are enumerable. Never included in a counted total.
function isWithheldForLanguage(e) {
  return (
    Boolean(e.language_flag) &&
    e.status === "INDEPENDENT" &&
    (e.confirm_state === "confirmed" || e.confirm_state === "unverified-coverage") &&
    !e.duplicate_of
  );
}

// Independent by classification but not yet countable: still open, never
// included in a filing total until corroboration or a certified translation
// settles it.
function isIndependentPending(e) {
  return (
    e.status === "INDEPENDENT" &&
    !isHighlighted(e)
  );
}

// Scholar's "cited by" list can show the SAME paper more than once: a publisher
// copy and a repository, thesis or preprint copy of it appear as separate rows
// with separate cids. The exhibit must keep both, because that is what the
// Scholar page shows, but a statistic that counts both claims more distinct
// papers cite the work than actually do. Six publications were found this way on
// 2026-10-30 (for example the CD137/cIAPs paper at science.org and the same
// paper at digital.csic.es).
//
// Identity is the title, normalised. Two genuinely different papers sharing a
// title is rare, and the review sheet lists every merge so a person can check.
function paperKey(e) {
  const t = String(e.title || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
  if (t.length >= 24) return `t:${t}`;
  // Too short to be safe as an identity (a bare "[CITATION]" or an
  // unparseable title): keep the row distinct rather than merging on a guess.
  return `row:${e.page || 1}:${e.cid !== undefined ? e.cid : e.index}`;
}

// Which copy of a duplicated paper carries the decision. The one with a
// complete author list wins, because that is the list independence was judged
// from; an external confirmation then breaks a tie. Weighting completeness
// above status matters: a copy whose list was truncated may say INDEPENDENT
// while the complete list reveals a shared author, and the complete list is
// the one that should decide.
function copyReliability(e) {
  let score = 0;
  if (!/truncated/.test(String(e.author_source || ""))) score += 8;
  if (e.confirm_state === "confirmed") score += 4;
  else if (e.confirm_state === "unverified-coverage") score += 2;
  if (isHighlighted(e)) score += 1;
  return score;
}

// Collapse duplicate copies of one paper. Returns the surviving entries, in the
// order their first copy appeared, plus the pairs that were merged so the
// review sheet can name them.
function uniquePapers(entries) {
  const groups = new Map();
  for (const e of entries) {
    const k = paperKey(e);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(e);
  }
  const kept = [];
  const merged = [];
  for (const list of groups.values()) {
    list.sort((a, b) => copyReliability(b) - copyReliability(a));
    kept.push(list[0]);
    if (list.length > 1) merged.push(list);
  }
  return { kept, merged };
}

// Language editions -------------------------------------------------------
//
// A publisher can serve the SAME article in two languages and Google Scholar
// lists both as separate citing papers, with separate cids and separate DOIs.
// Found on 2026-10-31 in this corpus: Angewandte Chemie publishes one article
// as 10.1002/anie.7795967 in English and 10.1002/ange.7795967 in German, and
// Scholar showed both rows. That is why one publication's citing list yielded
// 33 rows against the 32 citations Scholar counts -- the user checked the
// profile by hand and confirmed the paper itself did not gain a citation.
//
// This is deliberately NOT folded into paperKey above. Title-based identity
// cannot see the relationship (the titles differ by language) and folding it in
// would change what "distinct papers" means across every published figure
// without a decision from the user. So it is detected and recorded, and the
// counting rules are untouched: the non-English copy is already excluded from
// the independent total by language_flag, so no counted figure moves.
//
// The test is conservative on purpose, requiring BOTH a DOI and an identical
// author string. Two different papers can share a DOI suffix; two translations
// of the same article do not share an author list. A pair that cannot be proven
// this way is left alone rather than merged on a guess.
const DOI_RE = /10\.\d{4,9}\/[^\s"',)\]]+/i;

function doiOf(value) {
  const m = String(value || "").match(DOI_RE);
  return m ? m[0].toLowerCase().replace(/[.,;]+$/, "") : "";
}

// The numeric article id: the last dotted segment of the DOI. Wiley's journal
// code (anie vs ange) sits before it, so comparing this segment matches the two
// language editions while ignoring which edition a row came from.
function doiArticleId(doi) {
  const parts = String(doi || "").split("/");
  const last = (parts[parts.length - 1] || "").split(".").filter(Boolean);
  return last.length ? last[last.length - 1] : "";
}

// Author signature used to confirm two rows are the same work. Whitespace and
// punctuation are stripped, so a row whose list came from the Cite-popup BibTeX
// matches another copy resolved the same way. Deliberately an exact match, not
// a fuzzy one.
function authorSignature(e) {
  const s = String(e.authors_used || e.authors || "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
  // Too short to identify a work: a lone author initial, or nothing parsed.
  return s.length >= 8 ? s : "";
}

// Key for the work a row represents, when a DOI and author list together prove
// it. Empty means "cannot be established here" -- no claim is made.
function editionKey(e) {
  const doi = doiOf(e.link) || doiOf(e.external_url);
  if (!doi) return "";
  const id = doiArticleId(doi);
  // Below 5 digits this is a journal-level DOI, not an article-level one.
  if (id.length < 5 || !/\d/.test(id)) return "";
  const authors = authorSignature(e);
  if (!authors) return "";
  const prefix = doi.split("/")[0].toLowerCase();
  return `doi:${prefix}:${id}:${authors}`;
}

// Which copy of a language edition should stand for the work. Ranked on the
// row's own merits only (isHighlightCandidate), never on duplicate_of, so the
// choice cannot depend on the order pages were processed. The copy that would
// be marked wins -- in practice the English one, since a language-flagged row is
// never marked -- then the unflagged copy, then the more reliable author list on
// the same grounds as copyReliability.
function editionPreference(e) {
  let score = 0;
  if (isHighlightCandidate(e)) score += 16;
  if (!e.language_flag) score += 8;
  score += copyReliability(e);
  return score;
}

// Group rows that are provably language editions of one another and record the
// result on the rows themselves, so one definition governs the exhibit mark,
// the review sheet, the ledger and the catalog.
//
// Fields written on every entry:
//   edition_key   the proven work key, or "" when it cannot be established
//   duplicate_of  the cid of the copy that stands for this work; "" when this
//                 row is that copy. isHighlighted() refuses anything with a
//                 value here, so a language edition never gets a yellow mark
//                 even when the language screen failed to spot it.
//   edition_note  what a reviewer should know, carried into the review sheet
//
// `prior` holds the entries of earlier pages of the SAME citing list, keyed by
// edition key. The capture walks and saves one page at a time and Scholar's own
// "Next" link decides the order, so a pair can straddle any two pages -- the
// Angewandte case turned up on pages 2 and 3. Callers pass the same Map through
// the whole walk.
//
// Which copy stands for the work is editionPreference's choice over the prior
// rows and the current page together. Two cases matter:
//   - the winner is already printed on an earlier page: every row here defers to
//     it, so the same article is never marked twice across two exhibits;
//   - the winner is on this page (the earlier copy was, for example, the German
//     one and was correctly left unmarked): this page may mark it, because the
//     earlier PDF shows no mark for this work either.
function markLanguageEditions(entries, prior = new Map()) {
  const groups = new Map();
  for (const e of entries) {
    const k = editionKey(e);
    e.edition_key = k;
    if (e.duplicate_of === undefined) e.duplicate_of = "";
    if (!k) continue;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(e);
  }

  for (const [key, current] of groups) {
    const seen = prior.get(key) || [];
    const all = [...seen, ...current];

    // Two rows sharing one DOI exactly are the plain duplicate case already
    // handled by paperKey; a differing DOI is what makes this a language edition.
    const dois = new Set(all.map((x) => doiOf(x.link) || doiOf(x.external_url)));
    if (all.length < 2 || dois.size < 2) {
      prior.set(key, all);
      continue;
    }

    const winner = all.reduce((a, b) => (editionPreference(b) > editionPreference(a) ? b : a));
    // Rows already printed cannot be re-marked, so a printed copy that earns the
    // mark keeps it and this page defers to it.
    const printed = seen.some((e) => isHighlighted(e));

    for (const e of current) {
      if (e === winner && !printed) {
        e.duplicate_of = "";
        e.edition_note = `primary language edition (${[...dois].join(" vs ")})`;
      } else {
        const stands = printed ? seen.find((x) => isHighlighted(x)) || seen[0] : winner;
        e.duplicate_of = stands.cid || "";
        e.edition_note =
          `language edition of ${stands.cid || "an earlier row"}` +
          (stands.page ? ` on page ${stands.page}` : "") +
          `; also listed as ${doiOf(e.link) || doiOf(e.external_url) || "no DOI"}`;
      }
    }
    prior.set(key, all);
  }
  return entries;
}

function tallyEntries(entries) {
  const highlighted = entries.filter(isHighlighted);
  const { kept, merged } = uniquePapers(entries);
  const keptHighlighted = kept.filter(isHighlighted);
  // English-only figures, per the guide's second path: no certified
  // translations, so the record reports an adjusted total and percentage based
  // solely on English citations, dividing English independent citations by the
  // English citations on the list. The denominator is every row the language
  // screen did not flag -- decided or not -- because the guide asks for the
  // share of English citations, not the share of decided ones.
  const english = entries.filter((e) => !e.language_flag);
  const englishHighlighted = english.filter(isHighlighted);
  const englishKept = kept.filter((e) => !e.language_flag);
  return {
    records: entries.length,
    independent: highlighted.length,
    independent_confirmed: highlighted.filter((e) => e.confirm_state === "confirmed").length,
    independent_coverage: highlighted.filter(
      (e) => e.confirm_state === "unverified-coverage"
    ).length,
    independent_pending: entries.filter(isIndependentPending).length,
    dependent: entries.filter((e) => e.status === "DEPENDENT").length,
    self_pi: entries.filter((e) => e.status === "SELF (PI)").length,
    self_former_pi: entries.filter((e) => e.status === "SELF (FORMER PI)").length,
    review: entries.filter((e) => e.status === "REVIEW").length,
    non_english: entries.filter((e) => e.language_flag).length,
    // Non-English rows that would otherwise have been counted. This is the
    // number the filing gives up by not obtaining certified translations, and
    // it is deliberately reported rather than hidden.
    non_english_withheld: entries.filter(isWithheldForLanguage).length,
    english_records: english.length,
    english_independent: englishHighlighted.length,
    unique_english_records: englishKept.length,
    unique_english_independent: englishKept.filter(isHighlighted).length,
    // Distinct papers, after Scholar's duplicate versions collapse. Quote these
    // when a count is presented as the number of papers citing the work.
    unique_records: kept.length,
    unique_independent: keptHighlighted.length,
    unique_dependent: kept.filter((e) => e.status === "DEPENDENT").length,
    unique_self_pi: kept.filter((e) => e.status === "SELF (PI)").length,
    unique_self_former_pi: kept.filter((e) => e.status === "SELF (FORMER PI)").length,
    unique_review: kept.filter((e) => e.status === "REVIEW").length,
    duplicate_records: entries.length - kept.length,
    duplicate_groups: merged.length,
  };
}

// Empty tally with the same keys, so totals can be seeded and summed safely.
function emptyTally() {
  return tallyEntries([]);
}

function addTally(target, source) {
  for (const [k, v] of Object.entries(source)) {
    if (typeof v === "number") target[k] = (target[k] || 0) + v;
  }
  return target;
}

function citesId(url) {
  const m = String(url || "").match(/cites=(\d+)/);
  return m ? m[1] : "";
}

// Exhibit PDFs that exist right now, keyed by base name without the page
// suffix. Archive holds superseded exhibits and must not count as filed, or a
// discarded capture would keep inflating the totals.
function filedBases(pdfDir) {
  const out = new Set();
  const walk = (dir) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.isDirectory()) {
        walk(path.join(dir, entry.name));
        continue;
      }
      if (!entry.name.endsWith(".pdf")) continue;
      if (dir.includes(`${path.sep}Archive`)) continue;
      if (entry.name.startsWith("SUPERSEDED-")) continue;
      out.add(entry.name.replace(/\.pdf$/, "").replace(/-p\d+$/, ""));
    }
  };
  walk(pdfDir);
  return out;
}

// Group the per-page report JSON files by publication. A publication is one
// base name; pages 2+ are stored as "<base>-pN". Only publications with a PDF
// currently filed are returned, so an archived capture contributes nothing.
function groupReports(supportDir, pdfDir) {
  const filed = filedBases(pdfDir);
  const groups = new Map();
  for (const f of fs.readdirSync(supportDir)) {
    if (!f.endsWith(".report.json")) continue;
    const base = f.replace(/\.report\.json$/, "");
    const pub = base.replace(/-p\d+$/, "");
    if (!filed.has(pub)) continue;
    const data = JSON.parse(fs.readFileSync(path.join(supportDir, f), "utf8"));
    if (!groups.has(pub)) {
      groups.set(pub, { base: pub, pages: [], snapshots: new Set(), ids: new Set() });
    }
    const g = groups.get(pub);
    g.pages.push({
      base,
      page: data.page || 1,
      entries: data.entries || [],
      cites_url: data.cites_url || "",
      snapshot: data.snapshot || "",
      end_reason: data.end_reason || "",
    });
    if (data.snapshot) g.snapshots.add(String(data.snapshot).slice(0, 10));
    const id = citesId(data.cites_url);
    if (id) g.ids.add(id);
    g.title = data.cited_title || g.title || pub;
    g.cited_authors = data.cited_authors || g.cited_authors || "";
    g.cited_venue = data.cited_venue || g.cited_venue || "";
    g.paper_url = data.paper_url || g.paper_url || "";
  }
  for (const g of groups.values()) {
    g.pages.sort((a, b) => a.page - b.page);
    g.entries = g.pages.flatMap((p) => p.entries);
    g.cites_id = [...g.ids][0] || "";
    // Resolve language editions here rather than in each caller. Reports
    // captured before edition detection existed carry no duplicate_of at all,
    // so a consumer that trusts the stored value counts a publisher's second-
    // language copy as its own withheld citation while one that resolves it does
    // not -- which is exactly the 44-vs-46 disagreement build-catalog's
    // reconciliation caught on 2026-11-01. Walking the pages in order, with one
    // prior map carried across them, is what the capture did, so every reader
    // now agrees with the exhibit and with each other. No headline count moves:
    // the copy held back is non-English and was already excluded.
    const prior = new Map();
    for (const p of g.pages) markLanguageEditions(p.entries, prior);
  }
  return groups;
}

// Scholar shows ten citing records per page and there is no way to change it:
// a pagesize= parameter is ignored on the citing-articles endpoint, so the
// server always returns 10. Every page count in the project derives from this
// one constant rather than repeating the number, so a page-count check can
// never disagree with the capture about how many exhibits a publication needs.
// Used to tell a complete capture from a truncated one.
const CITATIONS_PER_PAGE = 10;

function expectedPages(citedBy) {
  const n = Number(citedBy);
  return Number.isFinite(n) && n > 0 ? Math.ceil(n / CITATIONS_PER_PAGE) : 1;
}

// Percentage helper kept here so every report rounds the same way and never
// divides by zero silently.
function pct(part, whole, digits = 1) {
  if (!whole) return null;
  return Number(((part / whole) * 100).toFixed(digits));
}

module.exports = {
  CITATIONS_PER_PAGE,
  isHighlighted,
  isHighlightCandidate,
  isWithheldForLanguage,
  isIndependentPending,
  paperKey,
  doiOf,
  doiArticleId,
  authorSignature,
  editionKey,
  markLanguageEditions,
  uniquePapers,
  tallyEntries,
  emptyTally,
  addTally,
  citesId,
  filedBases,
  groupReports,
  expectedPages,
  pct,
};

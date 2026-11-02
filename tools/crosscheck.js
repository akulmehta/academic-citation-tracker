// Independent corroboration of a citing paper's author list.
//
// Google Scholar is the primary source for this packet. This module adds a
// second, external look-up so a citation is not called independent on Scholar's
// word alone: the paper is searched in PubMed (NCBI E-utilities) and, if not
// found there, in OpenAlex. Both expose the complete author list, which is what
// the independence decision needs.
//
// CrossRef is deliberately NOT used. Per the project instructions, third-party
// databases must not become the basis for an independence call; here they are
// only a corroborating check layered on top of the Scholar record, and a
// contradiction is always reported rather than silently overriding Scholar.
//
// Credentials:
//   Neither service requires an account. NCBI's usage policy asks for an email
//   address as identification and offers an optional API key that raises the
//   rate limit from 3 to 10 requests/second. This tool makes only a handful of
//   sequential, paced requests, so both are optional. Supply them either way:
//     --email="you@example.org"        (also env CROSSCHECK_EMAIL)
//     --ncbi-key="...."                (also env NCBI_API_KEY)
//   The email is also passed to OpenAlex as `mailto` for the polite pool.
//
// Nothing here touches Google Scholar, so there is no additional Scholar load.

const pace = require("./human");

const NCBI_BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";
const OPENALEX_BASE = "https://api.openalex.org/works";

// Significant words that carry no identifying weight in a title.
const STOP = new Set([
  "a", "an", "and", "as", "at", "by", "for", "from", "in", "into", "of", "on",
  "or", "the", "to", "with", "via", "using", "based", "study", "novel", "new",
]);

function normalizeTitle(s) {
  return String(s || "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(s) {
  return normalizeTitle(s)
    .split(" ")
    .filter((w) => w && !STOP.has(w));
}

// A similarity score at or above this is taken to mean "the same work".
const TITLE_MATCH_THRESHOLD = 0.8;

// Fewest words on the shorter side for a pure-containment match to be believed.
const CONTAINED_MIN_TOKENS = 4;

// Fewest words for a leading-prefix match. One word is not enough: "Bakker" is
// a single surname and prefixing a letter titled "Bakker et al. concomitant
// ligament injuries..." would then look like an exact match while being a
// different paper by different authors.
const PREFIX_MIN_TOKENS = 2;

// True when the shorter title's words run off the FRONT of the longer one.
// Scholar truncates a long title with an ellipsis, so a short Scholar byline
// that is a verbatim leading fragment of the external title is the same work:
// "Carbohydrate Microarray Technology" for "Carbohydrate Microarray Technology
// Applied to High-Throughput Mapping of ...". Coincidental word matches are not
// usually in the leading position, which is what separates these from the
// rejects above.
function isLeadingPrefix(shortTokens, longTokens) {
  if (
    shortTokens.length < PREFIX_MIN_TOKENS ||
    longTokens.length <= shortTokens.length
  ) {
    return false;
  }
  return shortTokens.every((w, i) => longTokens[i] === w);
}

// Token overlap between two titles, 0..1.
//
// Rewritten on 2026-11-02. The original divided the shared words by the SHORTER
// title, "deliberately tolerant of publisher titles differing by a subtitle".
// That tolerance has a failure mode: when the Scholar side yields almost no
// Latin words, min() collapses to 1 or 2 and ANY external record containing
// that word scores a perfect 1.00. Measured over the filed set this produced 29
// "matches" at similarity 1.00 that were not the same paper at all - a Cyrillic
// title matched to a Gerodontology scientometric analysis (twice, against the
// same PMID), a row titled "Bakker" matched to a letter to the editor about
// ligament injuries, "Anticoagulants", "Structural Biology", "Future Medicinal
// Chemistry" (journal names Scholar took for titles) and others. Because a
// match sets confirm_state, that inflated "externally confirmed" and, where
// Scholar's own byline was truncated, made the row countable on thin air.
//
// The fix keeps the tolerance where it is safe and removes it where it is not:
// either the two titles are substantially the same text (80% of the LONGER
// title's words), or the shorter one is at least four words and is wholly
// contained in the longer, or the shorter one runs off the front of the longer
// (Scholar's truncation, see isLeadingPrefix). Four words is the containment
// line; it rejects a one- or two-word fragment, which cannot identify a paper.
function titleSimilarity(a, b) {
  const A = tokens(a);
  const B = tokens(b);
  if (!A.length || !B.length) return 0;
  const As = new Set(A);
  const Bs = new Set(B);
  if (!As.size || !Bs.size) return 0;
  let shared = 0;
  for (const w of As) if (Bs.has(w)) shared++;
  const containment = shared / Math.max(As.size, Bs.size);
  const shorter = Math.min(As.size, Bs.size);
  const contained = shorter >= CONTAINED_MIN_TOKENS && shared / shorter >= 0.8;
  const prefix =
    As.size <= Bs.size ? isLeadingPrefix(A, B) : isLeadingPrefix(B, A);
  // A credible containment or prefix is reported at the threshold itself: it
  // clears the bar, and no more, so a caller can never read either as an exact
  // match.
  const ok = contained || prefix;
  return Math.max(containment, ok ? TITLE_MATCH_THRESHOLD : 0);
}

// Whether a similarity score is enough to say "this external record describes
// the same work as the Scholar entry". Kept separate from the threshold so the
// offline re-check in tools/reapply-corroboration.js applies the same test as a
// live capture, and a stored match can be re-judged without a network request.
function titleMatchIsCredible(similarity) {
  return similarity >= TITLE_MATCH_THRESHOLD;
}

async function getJson(url, timeoutMs = 25000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "EB1A-citation-record/1.0" },
    });
    if (!res.ok) return { error: `HTTP ${res.status}` };
    return { json: await res.json() };
  } catch (e) {
    return { error: e.name === "AbortError" ? "timed out" : e.message };
  } finally {
    clearTimeout(timer);
  }
}

// ---- PubMed ---------------------------------------------------------------

function pubmedUrl(path, params) {
  const u = new URL(`${NCBI_BASE}/${path}`);
  for (const [k, v] of Object.entries(params)) if (v) u.searchParams.set(k, v);
  // NCBI asks clients to identify themselves; both are optional.
  if (CFG.tool) u.searchParams.set("tool", CFG.tool);
  if (CFG.email) u.searchParams.set("email", CFG.email);
  if (CFG.ncbiKey) u.searchParams.set("api_key", CFG.ncbiKey);
  u.searchParams.set("retmode", "json");
  return u.href;
}

// Config is set once from the CLI by configure().
const CFG = { tool: "eb1a-citation-record", email: "", ncbiKey: "" };

function configure({ email = "", ncbiKey = "" } = {}) {
  CFG.email = email || process.env.CROSSCHECK_EMAIL || "";
  CFG.ncbiKey = ncbiKey || process.env.NCBI_API_KEY || "";
  return CFG;
}

// Candidate search strings, most specific first.
function titleQueries(title) {
  const words = tokens(title);
  const full = normalizeTitle(title);
  const out = [];
  if (full) out.push(`"${full}"[Title]`);
  // Long titles are frequently reworded by the publisher, so also try a
  // leading and a distinctive subset of the significant words.
  if (words.length > 6) {
    out.push(`"${words.slice(0, 8).join(" ")}"[Title]`);
    out.push(words.slice(0, 6).map((w) => `${w}`).join(" AND "));
  } else if (words.length) {
    out.push(words.map((w) => `"${w}"`).join(" AND "));
  }
  return [...new Set(out)].slice(0, 3);
}

async function pubmedLookup(title) {
  for (const term of titleQueries(title)) {
    const found = await searchPubMed(term);
    if (found) return found;
    await pace.sleep(400);
  }
  return null;
}

async function searchPubMed(term) {
  const url = pubmedUrl("esearch.fcgi", { db: "pubmed", term, retmax: 5 });
  const { json, error } = await getJson(url);
  if (error) return null;
  const ids = json?.esearchresult?.idlist || [];
  if (!ids.length) return null;

  await pace.sleep(500);
  const sumUrl = pubmedUrl("esummary.fcgi", { db: "pubmed", id: ids.join(",") });
  const sum = await getJson(sumUrl);
  if (sum.error) return null;

  const result = sum.json?.result || {};
  for (const id of ids) {
    const rec = result[id];
    if (!rec) continue;
    const authors = (rec.authors || [])
      .map((a) => a.name)
      .filter(Boolean);
    // Consortium/collective entries carry no initials and can never collide
    // with a person's name, but a record with no authors is also useless here.
    if (!authors.length) continue;
    // Whether this record really is the same work is decided by the caller,
    // which compares titles against the Scholar entry.
    return { pmid: id, title: rec.title || "", authors };
  }
  return null;
}

// ---- OpenAlex -------------------------------------------------------------

async function openAlexLookup(title) {
  const u = new URL(OPENALEX_BASE);
  u.searchParams.set("filter", `title.search:${normalizeTitle(title)}`);
  u.searchParams.set("per-page", "5");
  if (CFG.email) u.searchParams.set("mailto", CFG.email);

  const { json, error } = await getJson(u.href);
  if (error) return null;
  for (const w of json?.results || []) {
    const names = (w.authorships || [])
      .map((a) => a.raw_author_name || a.author?.display_name)
      .filter(Boolean);
    if (!names.length) continue;
    return {
      openalex_id: w.id,
      doi: w.doi || "",
      title: w.title || w.display_name || "",
      authors: names,
      year: w.publication_year || "",
    };
  }
  return null;
}

// ---- Combined corroboration ----------------------------------------------

// Look the paper up externally and return its author list plus a verdict on
// whether the external record actually describes the same work.
//
// Returns { found, source, url, title, authors, similarity, reason }
async function corroborate(entry) {
  const title = entry.title;
  if (!title) {
    return { found: false, reason: "no title to search" };
  }

  await pace.pause("cross-check PubMed", 900, 1800);
  const pm = await pubmedLookup(title);
  if (pm) {
    const sim = titleSimilarity(pm.title, title);
    if (sim >= TITLE_MATCH_THRESHOLD) {
      return {
        found: true,
        source: "pubmed",
        url: `https://pubmed.ncbi.nlm.nih.gov/${pm.pmid}/`,
        title: pm.title,
        authors: pm.authors,
        similarity: Number(sim.toFixed(2)),
      };
    }
    // A hit that is not similar enough is not evidence about this paper.
    entry.pubmed_near_miss = { pmid: pm.pmid, title: pm.title, similarity: Number(sim.toFixed(2)) };
  }

  await pace.pause("cross-check OpenAlex", 900, 1800);
  const oa = await openAlexLookup(title);
  if (oa) {
    const sim = titleSimilarity(oa.title, title);
    if (sim >= TITLE_MATCH_THRESHOLD) {
      return {
        found: true,
        source: "openalex",
        url: oa.doi || oa.openalex_id,
        title: oa.title,
        authors: oa.authors,
        similarity: Number(sim.toFixed(2)),
        year: oa.year,
      };
    }
    entry.openalex_near_miss = { title: oa.title, similarity: Number(sim.toFixed(2)) };
  }

  return {
    found: false,
    reason: "no PubMed or OpenAlex record matched the title closely enough",
  };
}

module.exports = {
  configure,
  corroborate,
  titleSimilarity,
  titleMatchIsCredible,
  normalizeTitle,
  pubmedLookup,
  openAlexLookup,
  TITLE_MATCH_THRESHOLD,
  CONTAINED_MIN_TOKENS,
};

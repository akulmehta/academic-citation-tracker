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
//   rate limit from 3 to 10 requests/second. OpenAlex needs no key either, but
//   in practice one is necessary: measured 2026-11-03 the anonymous pool
//   answered HTTP 429 with Retry-After 44969s (about twelve and a half hours),
//   which stops a corroboration sweep entirely, while the same request with a
//   key returns 200 immediately.
//   Put them in the repository .env (git-ignored) and they are picked up
//   automatically by ./env -- see .env.example. A key can also be passed to
//   configure(), which is what the capture's CLI flags do. Prefer the file over
//   a command-line flag: a flag lands in shell history and terminal scrollback.
//     .env                     OPENALEX_API_KEY / NCBI_API_KEY / CROSSCHECK_EMAIL
//     --email="you@example.org"    (also env CROSSCHECK_EMAIL)
//     --ncbi-key="...."            (also env NCBI_API_KEY)
//     --openalex-key="...."        (also env OPENALEX_API_KEY)
//   The email is also passed to OpenAlex as `mailto` for the polite pool.
//
// An OpenAlex key is sent as an `Authorization: Bearer` header, never as an
// `api_key` query parameter, even though both work. The reason is specific to
// this packet: when a look-up fails, getJson() records the request URL in the
// failure note, and that note can be written into a report JSON that ends up in
// the evidence folder. A key in a query string would be filed alongside it.
//
// Nothing here touches Google Scholar, so there is no additional Scholar load.

require("./env"); // fills OPENALEX_API_KEY et al. from the git-ignored .env
const pace = require("./human");

const NCBI_BASE = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";
const OPENALEX_BASE = "https://api.openalex.org/works";

// Significant words that carry no identifying weight in a title.
const STOP = new Set([
  "a", "an", "and", "as", "at", "by", "for", "from", "in", "into", "of", "on",
  "or", "the", "to", "with", "via", "using", "based", "study", "novel", "new",
]);

// ---------------------------------------------------------------------------
// Scholar's link-type markers (bug fix, 2026-11-02)
//
// Scholar prefixes a record whose title it could not parse with a bracketed
// link type -- [CITATION], [BOOK], [TXT] (and [HTML]/[PDF] on the citation
// links). That marker is part of Scholar's rendering, NOT part of the title,
// and it was reaching the search string as the word "citation". A quoted
// PubMed title search for `"citation glycoinformatics resources integrated..."`
// can never match, and OpenAlex's title.search filter fails the same way, so
// the row was recorded as "not indexed in PubMed or OpenAlex" and left in the
// review queue.
//
// The papers ARE indexed. Verified 2026-11-02 by running this module's own
// look-up both ways on three queued rows: with the marker each returned no
// record; with the marker removed each returned its published article at
// similarity 1.00 -- cit-000567 (Comprehensive Glycoscience chapter,
// 10.1016/b978-0-12-819475-1.00107-3), cit-001230 (Antiviral Research,
// 10.1016/j.antiviral.2015.11.010) and cit-000220 (JACS Au, 10.1021/jacsau.2c00664).
//
// The marker list and the stripper live in ./scholar-marker so tally.js can use
// the same rule without pulling in Playwright through ./human.
const { stripScholarMarker, SCHOLAR_MARKERS } = require("./scholar-marker");

function normalizeTitle(s) {
  return stripScholarMarker(s)
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
//
// Raised from 2 to 3 on 2026-11-02. Two words is also not enough, and the rule
// as written in the project instructions has always said so — "never accept a
// match on a one- or two-word fragment, since a lone surname, an instrument
// acronym, or a journal name Scholar mistook for a title will match an
// unrelated paper". The code did not implement that: at 2 the re-look-up
// (tools/refetch-corroboration.js) paired Scholar's "[CITATION] Structural
// Biology" with "Structural biology of allergens" (J Allergy Clin Immunol
// 2000) at similarity 0.80, which is exactly the journal-name-shaped false
// match R1 exists to discard. Measured over the filed set before the change,
// only three settled rows rested on a prefix at all — "Carbohydrate Microarray
// Technology" (twice) and "Natural Excipients in Pharmaceutical", three words
// each, all three genuinely the same work truncated by Scholar — so the floor
// of 3 costs nothing real and removes the class of coincidence.
const PREFIX_MIN_TOKENS = 3;

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

// A request that fails is NOT a negative answer about the paper, so it must
// not be reported as one. Every failure is pushed onto `errors` (when the caller
// supplied one) and the caller decides what the unknown means.
//
// 429 and 5xx are retried, honouring Retry-After when the service sends it, up
// to RETRY_ATTEMPTS tries with a growing pause. Without this, a throttled run of
// tools/refetch-corroboration.js looked like a clean sweep of "still unindexed":
// measured 2026-11-03 the same 66 rows returned 38 records on the first pass and
// 0 on the next, with OpenAlex answering HTTP 429. That is not a result, and the
// row it lands on is worse than a wasted run -- a non-truncated INDEPENDENT row
// with no external record is filed as confirm_state 'unverified-coverage', which
// tally.js treats as SETTLED, so a rate limit would manufacture countable
// evidence out of a failed request.
const RETRY_ATTEMPTS = 3;
const RETRY_BASE_MS = 8000;

// Ceiling on a Retry-After we are willing to sit through. Honouring the hint
// literally is wrong when a service is throttling the anonymous pool: measured
// 2026-11-03 OpenAlex answered 429 with Retry-After 44969 (twelve and a half
// hours), and tools/refetch-corroboration.js sat in a single sleep and produced
// four lines of output in ten minutes, looking like a slow run rather than a
// blocked one. A wait longer than this is not a retry, it is a stop: give up on
// the row, report it as an incomplete look-up, and let the caller exit non-zero.
// With a key configured the hint disappears and this ceiling is never reached.
const RETRY_MAX_WAIT_MS = 60000;

// `opts.headers` carries credentials. Keep them there rather than in the URL:
// a failed request is recorded as `${msg} :: ${url}`, and that note can be
// written into a report JSON, so anything in a query string is persisted.
async function getJson(url, timeoutMs = 25000, errors = null, opts = {}) {
  const note = (msg) => {
    if (Array.isArray(errors)) errors.push(`${msg} :: ${url.slice(0, 120)}`);
  };
  let last = "failed";
  for (let attempt = 1; attempt <= RETRY_ATTEMPTS; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        headers: { "User-Agent": "EB1A-citation-record/1.0", ...(opts.headers || {}) },
      });
      if (res.status === 429 || res.status >= 500) {
        // Throttled or a service fault: retryable, and never a negative answer.
        const hint = Number(res.headers.get("retry-after")) || 0;
        last = `HTTP ${res.status}`;
        note(last);
        // A hint beyond the ceiling means the service is not going to answer
        // this run. Stop immediately rather than sleeping it off or burning the
        // remaining attempts -- the caller treats the unknown as "leave the row
        // alone", which is the honest outcome, and the run fails loudly.
        if (hint * 1000 > RETRY_MAX_WAIT_MS) {
          note(`retry-after ${hint}s exceeds the ${RETRY_MAX_WAIT_MS / 1000}s ceiling, giving up`);
          return { error: `${last} (throttled, retry-after ${hint}s)` };
        }
        if (attempt < RETRY_ATTEMPTS) {
          const wait = Math.max(hint * 1000, RETRY_BASE_MS * attempt);
          await pace.sleep(wait);
          continue;
        }
        return { error: last };
      }
      if (!res.ok) {
        // 4xx other than 429 is a settled answer about the request, so it is
        // not recorded as an infrastructure failure.
        return { error: `HTTP ${res.status}` };
      }
      return { json: await res.json() };
    } catch (e) {
      last = e.name === "AbortError" ? "timed out" : e.message;
      note(last);
      if (attempt < RETRY_ATTEMPTS) {
        await pace.sleep(RETRY_BASE_MS * attempt);
        continue;
      }
      return { error: last };
    } finally {
      clearTimeout(timer);
    }
  }
  return { error: last };
}

// ---- Author-name round trip ----------------------------------------------
//
// A record's author list is stored on the row as ONE string (`external_authors`)
// and read back later by corroboration.js, which splits it on commas. PubMed
// returns names in inverted order -- "Verespy, Stephen" -- so joining with ", "
// tore each such name into two entries: "Verespy" (a bare surname, no initials)
// and "Stephen". Measured 2026-11-03 over the filed set, 21 of the 692 rows
// carrying an external record were torn this way.
//
// That is not cosmetic. name-match.js compares surname plus initials, and a
// bare surname colliding with a real author returns UNKNOWN, which decides the
// row REVIEW rather than INDEPENDENT. It did exactly that: the lignin thesis
// (cit-000341, AY Mehta) citing the thrombin-patents review (authors Mehta, Jin,
// Desai) was pulled off DEPENDENT and into the review queue by the phantom
// "Mehta" fragment produced from OpenAlex's "Mehta, Akul".
//
// The fix is to normalise every name to natural order at lookup time, so the
// stored string contains no internal comma and the round trip is exact. It is
// done here, at the source, rather than by teaching every reader to guess where
// a comma belongs -- guessing at the shape of a name in a filed evidence packet
// is the wrong place for it.
function toDisplayName(raw) {
  const name = String(raw || "").trim();
  if (!name || !name.includes(",")) return name;
  // PubMed's "Surname, Given" (and "Surname, Given M"). Only invert when the
  // tail is a plausible given name or initials; anything else, such as
  // "Smith, Jr., M.D.", is left alone rather than mangled.
  const [surname, ...rest] = name.split(",");
  const given = rest.join(" ").trim();
  if (!surname || !given) return name;
  if (!/^[A-Za-z'’.-]+([ ].*)?$/.test(given)) return name;
  // A tail made only of suffixes and degrees ("Smith, Jr., M.D.") is not a
  // given name; inverting it would produce "Jr. M.D. Smith", a different
  // surname. Leave the original alone so the matcher sees no name at all
  // rather than a wrong one.
  const suffixes = new Set(["jr", "sr", "ii", "iii", "iv", "md", "phd", "do"]);
  const tokens = given.split(/\s+/).map((t) => t.replace(/[^A-Za-z]/g, "").toLowerCase());
  if (tokens.length && tokens.every((t) => suffixes.has(t))) return name;
  return `${given} ${surname.trim()}`.replace(/\s+/g, " ").trim();
}

function toDisplayNames(list) {
  return (list || []).map(toDisplayName).filter(Boolean);
}

// Whether a stored `external_authors` string still carries the torn shape --
// fragments with no whitespace at all cannot be a person's name. Used by
// tools/refetch-corroboration.js --repair-names to find rows stored before the
// fix above, so they can be re-read from the service rather than guessed at.
function tornAuthors(joined) {
  return String(joined || "")
    .split(",")
    .map((s) => s.trim())
    .filter((s) => s && !/\s/.test(s));
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

// Config is set once from the CLI by configure(). Every value falls back to the
// environment, so a run with no flags still uses the .env credentials.
const CFG = { tool: "eb1a-citation-record", email: "", ncbiKey: "", openalexKey: "" };

function configure({ email = "", ncbiKey = "", openalexKey = "" } = {}) {
  CFG.email = email || process.env.CROSSCHECK_EMAIL || "";
  CFG.ncbiKey = ncbiKey || process.env.NCBI_API_KEY || "";
  CFG.openalexKey = openalexKey || process.env.OPENALEX_API_KEY || "";
  return CFG;
}

// Which credentials are in play, by NAME only. For a run's opening log line so
// the operator can see a key was picked up -- a value must never be printed.
function credentialSummary() {
  const on = [];
  if (CFG.ncbiKey) on.push("NCBI key");
  if (CFG.openalexKey) on.push("OpenAlex key");
  if (CFG.email) on.push("identifying email");
  return on.length ? on.join(", ") : "none (anonymous pools)";
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

async function pubmedLookup(title, errors = null) {
  for (const term of titleQueries(title)) {
    const found = await searchPubMed(term, errors);
    if (found) return found;
    await pace.sleep(400);
  }
  return null;
}

async function searchPubMed(term, errors = null) {
  const url = pubmedUrl("esearch.fcgi", { db: "pubmed", term, retmax: 5 });
  const { json, error } = await getJson(url, 25000, errors);
  if (error) return null;
  const ids = json?.esearchresult?.idlist || [];
  if (!ids.length) return null;

  await pace.sleep(500);
  const sumUrl = pubmedUrl("esummary.fcgi", { db: "pubmed", id: ids.join(",") });
  const sum = await getJson(sumUrl, 25000, errors);
  if (sum.error) return null;

  const result = sum.json?.result || {};
  for (const id of ids) {
    const rec = result[id];
    if (!rec) continue;
    const authors = toDisplayNames(
      (rec.authors || []).map((a) => a.name).filter(Boolean),
    );
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

async function openAlexLookup(title, errors = null) {
  const u = new URL(OPENALEX_BASE);
  u.searchParams.set("filter", `title.search:${normalizeTitle(title)}`);
  u.searchParams.set("per-page", "5");
  if (CFG.email) u.searchParams.set("mailto", CFG.email);

  // The key goes in a header, not the query string -- see the note at the top
  // of this file. Both are accepted by OpenAlex; only one is safe to have the
  // URL of a failed request recorded with a credential in it.
  const headers = CFG.openalexKey
    ? { Authorization: `Bearer ${CFG.openalexKey}` }
    : undefined;

  const { json, error } = await getJson(u.href, 25000, errors, { headers });
  if (error) return null;
  for (const w of json?.results || []) {
    const names = toDisplayNames(
      (w.authorships || [])
        .map((a) => a.raw_author_name || a.author?.display_name)
        .filter(Boolean),
    );
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
// Returns { found, source, url, title, authors, similarity, reason, unknown,
//           failures }
//
// `unknown` is the distinction that matters. "I asked and nothing indexes this
// paper" and "I could not ask" are different statements, and collapsing them is
// not a harmless simplification: a caller that files the row as
// 'unverified-coverage' is recording a SETTLED state, so treating a rate limit
// as a negative finding makes the failure count as evidence. When any request
// failed and no record was found, found is false and unknown is true, and the
// caller must leave the row alone rather than settle it.
// ---- OpenAlex budget ------------------------------------------------------
//
// A key comes on the free plan with a 1 dollar/day budget and OpenAlex bills per
// request, so a sweep is not free in the way "no account required" suggests.
// Measured 2026-11-03 from the response headers and meta.cost_usd:
//
//   title.search:<ours>   10 credits   (it is a search, not a filter)
//   a plain filtered list  1 credit
//   one record by DOI/ID   0 credits   (free)
//
// So a 65-row queue sweep costs about 650 credits, roughly two thirds of a day,
// while the old --widen=unindexed set (802 rows) would spend about 8,000 and
// stop mid-run. Reading the balance before a wide run is therefore part of the
// plan, not a nicety. The endpoint itself is a single-record read, so asking is
// free.
//
// Returns null when there is no key or the call fails -- an unknown balance is
// reported as unknown, never guessed.
async function budget() {
  if (!CFG.openalexKey) return null;
  const res = await getJson(`${OPENALEX_BASE.replace("/works", "")}/rate-limit`, 15000, null, {
    headers: { Authorization: `Bearer ${CFG.openalexKey}` },
  });
  if (res.error || !res.json) return null;
  const rl = res.json.rate_limit || {};
  const costs = rl.endpoint_costs_usd || {};
  return {
    daily_usd: Number(rl.daily_budget_usd) || 0,
    used_usd: Number(rl.daily_used_usd) || 0,
    remaining_usd: Number(rl.daily_remaining_usd) || 0,
    // What one of our searches costs, straight from the service rather than a
    // constant that would go stale if their pricing changes.
    search_usd: Number(costs.search) || 0.001,
    resets_at: rl.resets_at || "",
  };
}

async function corroborate(entry) {
  const title = entry.title;
  if (!title) {
    return { found: false, reason: "no title to search" };
  }

  const failures = [];

  await pace.pause("cross-check PubMed", 900, 1800);
  const pm = await pubmedLookup(title, failures);
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
  const oa = await openAlexLookup(title, failures);
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

  if (failures.length) {
    return {
      found: false,
      unknown: true,
      failures: [...new Set(failures)],
      reason:
        `the look-up did not complete (${[...new Set(failures)].map((f) => f.split(" ::")[0]).join("; ")}) ` +
        `-- this is NOT a finding that the paper is unindexed`,
    };
  }
  return {
    found: false,
    reason: "no PubMed or OpenAlex record matched the title closely enough",
  };
}

module.exports = {
  configure,
  credentialSummary,
  budget,
  corroborate,
  titleSimilarity,
  titleMatchIsCredible,
  normalizeTitle,
  stripScholarMarker,
  SCHOLAR_MARKERS,
  pubmedLookup,
  openAlexLookup,
  toDisplayName,
  toDisplayNames,
  tornAuthors,
  TITLE_MATCH_THRESHOLD,
  CONTAINED_MIN_TOKENS,
};

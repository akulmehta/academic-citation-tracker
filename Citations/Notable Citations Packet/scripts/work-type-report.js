/**
 * Report what kind of work each candidate actually is.
 *
 * The research-articles-only screen (instructions §1.2) needs a work type, and
 * nothing stored carries one: `candidate.work_type` and
 * `citation.citing_article_type` read "article" for every row.
 *
 *      *** "review" means two different things in this repo ***
 * In the Independent Citation Record, REVIEW is a STATUS meaning "a person has
 * to look at this row" -- `candidate.status` can literally read REVIEW for an
 * ordinary research article. Nothing here reads that column, and no row is ever
 * classified from the word. What this file calls a "review article" is secondary
 * literature: a survey of other people's work, with no experimental Methods and
 * Results of its own. The labels below are written as `review-article (...)` to
 * keep the two apart.
 *
 * Three routes, consulted in this order, because no single one covers every row:
 *
 *   1. The PDF's own shape (article-shape.js) -- the strongest evidence, since
 *      it is the filed document: does it carry Methods and Results headings,
 *      does page 1 say REVIEW or ORIGINAL ARTICLE, is it a thesis. Available
 *      only for the ~59 rows with a file on disk.
 *   2. OpenAlex `type`, accepted only when the returned record is demonstrably
 *      the same work. Reliable where it exists; roughly a third of this corpus
 *      is not indexed at all, and the title-search fallback returns other
 *      articles.
 *   3. Where the link points and what the venue publishes -- dissertation
 *      repositories, ProQuest `&diss=y`, book-chapter hosts, review-only
 *      journals. Cheap, and often the only signal for an unfetched row.
 *
 * It writes nothing. Every route is evidence for a person to weigh; the reason
 * recorded on a row must name the evidence actually seen.
 *
 * Usage: node scripts/work-type-report.js [--cites=<id>] [--only=uid,uid]
 *        [--no-openalex] [--quiet-agree]
 */
"use strict";
const path = require("path");
const lib = require(path.join(__dirname, "lib"));
const { shape } = require(path.join(__dirname, "article-shape"));

const args = process.argv.slice(2);
const cites = (args.find((a) => a.startsWith("--cites=")) || "").slice(8);
const only = (args.find((a) => a.startsWith("--only=")) || "").slice(7).split(",").filter(Boolean);
const useOpenAlex = !args.includes("--no-openalex");

// Repositories and hosts that publish theses, and nothing else.
const THESIS_HOSTS = [
  "theses.hal.science",
  "scholaris.ca",
  "freidok.",
  "ediss.",
  "open.leidenuniv.nl",
  "universiteitleiden.nl",
  "jscholarship.",
  "vtechworks.",
  "digitalcommons.",
  "submit.yale.edu",
  "repository.cam.ac.uk",
  "ora.ox.ac.uk",
  "dspace.",
];
// ProQuest records Scholar links with &diss=y when they are dissertations.
const PROQUEST_DISS = /search\.proquest\.com\/.*diss=y/;

function linkSignal(link) {
  if (!link) return "no link";
  if (PROQUEST_DISS.test(link)) return "ProQuest dissertation";
  for (const h of THESIS_HOSTS) if (link.includes(h)) return "thesis/repository host";
  if (/api\.taylorfrancis\.com\/content\/chapters/.test(link)) return "book chapter host";
  if (/poster/i.test(link)) return "poster";
  return "";
}

// Venues that publish reviews rather than primary research. Matched on the
// venue string, not the title, because a review title rarely says so.
const REVIEW_VENUES = [
  "trends in biochemical sciences",
  "trends in biotechnology",
  "current opinion",
  "drug discovery today",
  "progress in lipid research",
  "mass spectrometry reviews",
  "accounts of chemical research",
  "chemical society reviews",
  "wiley interdisciplinary reviews",
  "biochimica et biophysica acta (bba) reviews",
];
function venueSignal(venue) {
  const v = (venue || "").toLowerCase();
  for (const r of REVIEW_VENUES) if (v.includes(r)) return "review venue";
  return "";
}

function titleSignal(title) {
  const t = (title || "").toLowerCase();
  // Only phrases that a primary research article does not use of itself.
  if (/\b(a |the )?(mini-?review|systematic review|scoping review)\b/.test(t)) return "title says review";
  if (/\b(?:a|an|the) (?:visual guide|practical guide|user guide|tutorial|overview|survey)$/.test(t))
    return "title says guide/overview";
  return "";
}

// An external record settles a row only when it is the same work, so the
// title-search fallback (used whenever a row has no DOI) is checked against the
// candidate title before its `type` is reported. Without this the fallback
// matched an unrelated *Communications Biology* paper to `Glycosylation changes
// in prostate cancer progression` and typed it `review` -- evidence about a
// different article. Mirrors the record's own credibility test; the packet has
// its own copy because it must not read or write the record's toolchain.
function sameWork(a, b) {
  const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim();
  const x = norm(a), y = norm(b);
  if (!x || !y) return false;
  if (x === y) return true;
  const xa = x.split(" "), ya = y.split(" ");
  const [long, short] = xa.length >= ya.length ? [xa, ya] : [ya, xa];
  if (short.length >= 4) {
    const hay = ` ${long.join(" ")} `;
    if (hay.includes(` ${short.join(" ")} `)) return true;
  }
  // Leading prefix: Scholar truncates a long title with an ellipsis, so a
  // candidate may be a strict prefix of the deposited title. Three words
  // minimum -- two is a surname or an acronym and matches anything.
  const n = Math.min(xa.length, ya.length);
  if (n >= 3) {
    let k = 0;
    while (k < n && xa[k] === ya[k]) k++;
    if (k >= 3 && k === n) return true;
  }
  const set = new Set(short);
  let hits = 0;
  for (const w of new Set(long)) if (set.has(w)) hits++;
  return hits / set.size >= 0.8;
}

async function openalex(doi, title) {
  const u = doi
    ? `https://api.openalex.org/works/doi:${encodeURIComponent(doi)}`
    : `https://api.openalex.org/works?filter=title.search:${encodeURIComponent((title || "").slice(0, 120))}&per-page=1`;
  try {
    const r = await fetch(u);
    if (!r.ok) return { err: `http ${r.status}` };
    const w = await r.json();
    const hit = doi ? w : (w.results || [])[0];
    if (!hit || !hit.id) return { err: "no record" };
    // A DOI is normally authoritative, but confirm the title anyway: a wrong
    // DOI would otherwise report another article's type as if it settled the row.
    const matched = sameWork(title, hit.display_name);
    return {
      type: matched ? hit.type : undefined,
      matched,
      venue: matched ? hit.primary_location?.source?.display_name || "" : "",
      title: (hit.display_name || "").slice(0, 60),
    };
  } catch (e) {
    return { err: e.message };
  }
}

// OpenAlex's own vocabulary for secondary literature, mapped to the wording
// used in this report so nobody reads it as the record's REVIEW status.
const OA_SECONDARY = {
  review: "review-article",
  editorial: "editorial",
  "book-chapter": "book chapter",
  dissertation: "thesis/dissertation",
  "conference-abstract": "conference abstract",
  "component:": "component",
  report: "report",
};

/**
 * Route 2b: PubMed's MeSH publication types, via NCBI E-utilities.
 *
 * This exists because OpenAlex does not index every citing work, and because a
 * second source is what turns a single database's guess into evidence. MeSH
 * tags "Review" is assigned by indexers from the article itself, so it settles
 * the question for the rows OpenAlex has no record of. Verified on 2026-11-08
 * against the nine GlycoGlyph rows OpenAlex typed `review`: PubMed agreed on
 * all nine, including the two published in ordinary research journals
 * (*Glycobiology*, *Biomacromolecules*) where the venue alone says nothing.
 *
 * Returns { review, types } or null when the DOI is absent or unindexed.
 */
async function pubmed(doi, title) {
  const base = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils";
  const term = doi ? `${doi}[doi]` : `${(title || "").slice(0, 120)}[title]`;
  try {
    const s = await (await fetch(`${base}/esearch.fcgi?db=pubmed&term=${encodeURIComponent(term)}&retmode=json`)).json();
    const pid = s.esearchresult?.idlist?.[0];
    if (!pid) return null;
    await new Promise((r) => setTimeout(r, 400));
    const xml = await (await fetch(`${base}/efetch.fcgi?db=pubmed&id=${pid}&rettype=xml&retmode=xml`)).text();
    const found = (xml.match(/<ArticleTitle>([\s\S]*?)<\/ArticleTitle>/) || [, ""])[1].replace(/<[^>]+>/g, "");
    // The same credibility rule OpenAlex needs. Found on 2026-11-08: a title
    // search for `FUT8 alpha-(1, 6)-fucosyltransferase in cancer` (MDPI IJMS)
    // returned a different article, `Advances in cancer research on FUT8
    // molecular mechanisms and clinical applications` (Int J Surg), which is a
    // review. Without this check that tag would have screened out a row on
    // evidence about somebody else's paper.
    if (!doi && !sameWork(title, found)) return { mismatch: true, found };
    const types = [...xml.matchAll(/<PublicationType[^>]*>([^<]+)<\/PublicationType>/g)].map((m) => m[1]);
    // A thesis indexed in PubMed appears as "Classical Article" or not at all;
    // "Review" is the tag that matters for this screen.
    return {
      review: types.some((t) => /^review$/i.test(t)),
      types,
      pmid: pid,
      found,
    };
  } catch (e) {
    return { err: e.message };
  }
}

async function main() {
  const db = lib.openPacket();
  const where = [];
  const params = [];
  if (cites) { where.push("cites_id = ?"); params.push(cites); }
  if (only.length) { where.push(`row_uid IN (${only.map(() => "?").join(",")})`); params.push(...only); }
  where.push("screen_state <> 'screened-out'");
  const rows = db
    .prepare(`SELECT row_uid, cites_id, title, venue, doi, link, screen_state, discover_state, pdf_file
              FROM candidate WHERE ${where.join(" AND ")} ORDER BY cites_id, row_uid`)
    .all(...params);
  console.log(
    `${rows.length} row(s) to classify. Nothing is written.\n` +
      `Routes: (1) the filed PDF's own shape, (2) OpenAlex type with the same-work check,\n` +
      `(2b) PubMed MeSH publication types, (3) link host and venue.\n` +
      `A row is reported SECONDARY only on a route that proves it, and the corroborating\n` +
      `sources are listed. NOTE: "review-article" here means secondary literature -- it has\n` +
      `nothing to do with the record's REVIEW status, which only means a person must look.\n`,
  );
  const byVerdict = {};
  for (const r of rows) {
    // Each route contributes a vote: 'secondary', 'primary', or null (silent).
    const votes = [];
    const detail = [];

    // Route 1: the filed PDF, if there is one.
    let pdf = null;
    if (r.pdf_file) {
      try {
        pdf = await shape(r.pdf_file);
      } catch (e) {
        pdf = { verdict: "EXTRACTION FAILED", selfId: [] };
      }
      if (pdf.verdict === "NOT a research article" || pdf.verdict === "review article (no Methods)") {
        votes.push("secondary");
        detail.push(`PDF: ${pdf.verdict}${pdf.selfId.length ? " (" + pdf.selfId.join("; ") + ")" : ""}`);
      } else if (pdf.verdict === "research article" || pdf.verdict === "labelled original article, headings not parsed") {
        votes.push("primary");
        detail.push(`PDF: ${pdf.verdict}`);
      } else {
        detail.push(`PDF: ${pdf.verdict}`);
      }
    }

    // Route 2: OpenAlex, only when the record is demonstrably the same work.
    let oa = { type: null, matched: null, venue: "", err: "skipped" };
    if (useOpenAlex) oa = await openalex(r.doi, r.title);
    const oaLabel = oa.type && OA_SECONDARY[oa.type] ? OA_SECONDARY[oa.type] : null;
    if (oaLabel) {
      votes.push("secondary");
      detail.push(`OpenAlex type: ${oaLabel}`);
    } else if (oa.type === "article") {
      detail.push("OpenAlex type: article");
    } else if (oa.err && !oa.type) {
      detail.push(`(OpenAlex ${oa.err})`);
    }

    // Route 2b: PubMed, consulted whenever OpenAlex said secondary (to confirm)
    // or said nothing at all (to cover the works OpenAlex does not index).
    let pmReview = false;
    if (useOpenAlex && (oaLabel || !oa.type)) {
      const pm = await pubmed(r.doi, r.title);
      if (pm && pm.mismatch) {
        detail.push(`(PubMed matched a different work: "${pm.found.slice(0, 60)}")`);
      } else if (pm && pm.review) {
        votes.push("secondary");
        detail.push('PubMed MeSH: "Review"');
        pmReview = true;
      } else if (pm && pm.types && pm.types.length) {
        detail.push(`PubMed: ${pm.types.slice(0, 3).join("/")}`);
      } else if (pm && pm.err) {
        detail.push(`(PubMed ${pm.err})`);
      } else {
        detail.push("(PubMed no record)");
      }
    }

    // Route 3: where the link points, and what the venue publishes. A host that
    // only ever carries theses or chapters is conclusive on its own.
    const host = linkSignal(r.link);
    if (host) {
      if (/thesis|chapter|poster|dissertation/.test(host)) {
        votes.push("secondary");
        detail.push(`link host: ${host}`);
      } else detail.push(`link: ${host}`);
    }
    const venue = venueSignal(r.venue) || (oa.matched ? venueSignal(oa.venue) : "");
    if (venue) {
      votes.push("secondary");
      detail.push(`review-only venue: ${venue === "review venue" ? oa.venue || r.venue : venue}`);
    }
    const ts = titleSignal(r.title);
    if (ts) detail.push(`title: ${ts}`);

    const sec = votes.filter((v) => v === "secondary").length;
    const pri = votes.filter((v) => v === "primary").length;
    let verdict;
    if (sec && pri) verdict = "CONFLICT";
    else if (sec >= 2) verdict = "SECONDARY (corroborated)";
    else if (sec === 1) verdict = "SECONDARY (one source -- verify before screening)";
    else if (pri) verdict = "research article";
    else verdict = "no signal";
    byVerdict[verdict] = (byVerdict[verdict] || 0) + 1;
    console.log(
      `${r.row_uid}  ${r.screen_state.padEnd(12)} ${r.pdf_file ? "PDF" : "   "}  ${verdict}` +
        `\n    ${r.title.slice(0, 100)}` +
        detail.map((d) => `\n      - ${d}`).join("") +
        (oa.matched === false ? `\n      - OpenAlex matched a different work: "${oa.title}"` : ""),
    );
    await new Promise((s) => setTimeout(s, 120));
  }
  console.log("\nSummary:");
  for (const [k, v] of Object.entries(byVerdict).sort((a, b) => b[1] - a[1])) console.log(`  ${String(v).padStart(3)}  ${k}`);
}

main();

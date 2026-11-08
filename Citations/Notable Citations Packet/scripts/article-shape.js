// Read-only: does a filed PDF read like a primary research article, or like
// secondary literature?
//
// Why this exists: the word "review" means two unrelated things in this repo.
// In the Independent Citation Record, REVIEW is a STATUS meaning "a person has
// to look at this row". Here, "review article" means a paper that surveys other
// people's work and reports no experiments of its own. Nothing in this file
// reads the record's status, and no row is classified from the word alone.
//
// The test is the article's own shape, from its extracted text:
//   - a Methods / Experimental / Materials and Methods heading, and
//   - a Results (or Results and Discussion) heading, and
//   - figure/table captions of its own
// A survey has neither of the first two. A thesis says so on its title page.
// A poster has no article structure at all. Where the headings are unusual
// (letterspaced "M E T H O D S", "Experimental procedures", "Methodology") the
// scan accepts them, because a classifier that stops at the first heading-like
// line mis-labels real papers.
//
// node scripts/article-shape.js --pdf=<file> [--pdf=<file> ...]
// node scripts/article-shape.js --rows=cit-000589,cit-000606
// node scripts/article-shape.js --all-flagged
//
// Prints a verdict and the evidence for it. Writes nothing.

const path = require("path");
const lib = require(path.join(__dirname, "lib"));
const { extractPages } = require(path.join(__dirname, "pdf-text"));

const packetDir = lib.PKT;

// Section headings, tolerant of letterspacing, numbering and publisher
// variants. Each alternative must consume the whole heading phrase so the
// leftover text afterwards can be checked: "Methods" is a heading and
// "methods differ by whether they can determine glycans" is a wrapped sentence
// that happens to start at the keyword.
const METHOD_RE =
  /^[\s#•·|>\-]*(\d+[.)]?\s*)?(materials?\s*(and|&|\u2013|-)\s*methods?|methodology|methods?\b|m\s*e\s*t\s*h\s*o\s*d\s*s|experimental\s*(section|procedures?|design|approach))\b/i;
const RESULT_RE =
  /^[\s#•·|>\-]*(\d+[.)]?\s*)?(results?\s*(and|&|\u2013|-)\s*discussion|results?\s*(and|&|\u2013|-)\s*conclusions?|results?\b|r\s*e\s*s\s*u\s*l\s*t\s*s?)\b/i;

// Words that only ever continue a sentence after "Methods"/"Results".
const CONTINUATION = /^(for|by|of|the|in|that|and|is|are|were|was|which|differ|used|based|to|as|from|we|our|this|these|here)\b/i;

function isAllCaps(t) {
  const letters = t.replace(/[^A-Za-z]/g, "");
  return letters.length > 2 && letters === letters.toUpperCase();
}

/**
 * True when a line is a section heading rather than a sentence that merely
 * begins with the keyword. Requires the keyword to be the whole line, or the
 * whole line apart from a short label ("Materials and Methods", "Results:
 * Glycan arrays"). Rejects anything carrying sentence punctuation or a
 * lowercase continuation.
 */
function headingMatch(line, re) {
  // Manuscripts with continuous line numbering print the number flush against
  // the heading ("Material and Methods120"), which defeats an anchored test.
  const t = line.trim().replace(/\s+/g, " ").replace(/\d+$/, "").trim();
  if (t.length < 4 || t.length > 60) return null;
  // Headings are Title Case or capitals; a wrapped body line that happens to
  // break after the word ("...tools and methods.") is lowercase and is not one.
  const body = t.replace(/^[#•·|>\-\s]+/, "");
  if (!body) return null;
  if (!isAllCaps(body) && body[0] !== body[0].toUpperCase()) return null;
  const m = t.match(re);
  if (!m) return null;
  let rest = t.slice(m[0].length).replace(/^[\s:.\u2013\u2014|—–]+/, "").trim();
  if (rest.length > 28) return null;
  if (/[;]$/.test(rest)) return null;
  // A full stop in the remainder means prose, unless the line is a heading set
  // in capitals with an abbreviation in it.
  if (/\.\s/.test(rest) && !isAllCaps(t)) return null;
  if (rest && CONTINUATION.test(rest) && !isAllCaps(t)) return null;
  if (rest && /^[a-z]/.test(rest) && !isAllCaps(t) && !/^(and|discussion|conclusions)\b/i.test(rest)) return null;
  return t;
}

async function shape(pdfRel) {
  const abs = path.isAbsolute(pdfRel) ? pdfRel : path.join(packetDir, pdfRel);
  const { text, numPages } = await extractPages(abs, null);
  // A page break can land mid-line, which buries the heading that opened the
  // next page ("...8:1591 10\fMethods"), so split on the form feed too.
  const lines = text.split(/\n|\f/);
  const methods = [];
  const results = [];
  for (const l of lines) {
    const mh = headingMatch(l, METHOD_RE);
    if (mh) {
      methods.push(mh);
      continue;
    }
    const rh = headingMatch(l, RESULT_RE);
    if (rh && !/resulting/i.test(rh)) results.push(rh);
  }
  const figures = new Set();
  for (const m of text.matchAll(/\b(?:Figure|Fig\.?)\s+(\d{1,2})\b/gi)) figures.add(m[1]);
  const tables = new Set();
  for (const m of text.matchAll(/\bTable\s+(\d{1,2})\b/gi)) tables.add(m[1]);
  const head = lines.slice(0, 60).join("\n");
  const firstPage = (text.split("\f")[0] || "").slice(0, 3000);
  const pages = numPages;
  // Title-page and abstract self-descriptions are decisive when present, and
  // they are the only signals some of these PDFs carry: a Springer review prints
  // the word REVIEW alone above the title and then has no Methods heading, which
  // is exactly the shape a heading-only test mistakes for "unclear".
  const selfId = [];
  // Publishers set the article type alone on the title page, sometimes with
  // letterspacing that splits every word ("O R I G I N A L  A R T I C L E"), so
  // each candidate line is compared with all whitespace removed -- that matches
  // both the plain and the letterspaced spelling without guessing where the
  // word breaks were.
  const squash = (s) => s.toLowerCase().replace(/[\s\u00a0]+/g, "");
  const SURVEY_LABELS = new Set([
    "review", "reviewarticle", "reviewpaper", "minireview", "minireview",
    "systematicreview", "narrativereview", "invitedreview", "invitedreviewarticle",
    "editorial", "commentary", "perspective", "bookreview", "lettertotheeditor",
    "positionpaper", "theoreticalpaper", "theoreticalarticle", "theoreticalreview",
    "viewpoint", "opinion", "tutorial", "overview",
  ]);
  const PRIMARY_LABELS = new Set(["originalarticle", "researcharticle", "primaryarticle", "originalresearch", "articlereasearch"]);
  const pageLabels = [];
  const positiveLabels = [];
  for (const l of firstPage.split("\n")) {
    const raw = l.trim();
    if (!raw || raw.length > 40 || !/^[A-Za-z \-]+$/.test(raw)) continue;
    // Access badges ride along with the type on some publishers ("Review Open
    // Access", found on cit-000625), so strip them before matching.
    const z = squash(raw).replace(/(openaccess|free to read|opentext|freeaccess|openarticle)$/, "");
    if (SURVEY_LABELS.has(z)) pageLabels.push(raw.toUpperCase());
    else if (PRIMARY_LABELS.has(z)) positiveLabels.push(raw.toUpperCase());
  }
  if (pageLabels.length) selfId.push(`page 1 label "${pageLabels[0]}"`);
  if (positiveLabels.length) selfId.push(`page 1 label "${positiveLabels[0]}"`);
  // Word boundaries matter: without them the test matched "hypothesis" and
  // "synthesis" and called eight ordinary research articles theses.
  if (/\b(?:thesis|dissertations?)\b/i.test(head)) selfId.push("title page says thesis/dissertation");
  if (/submitted (?:in|for)\s+(?:partial|the)\s+.*degree/i.test(head)) selfId.push("degree submission statement");
  // The abstract describing its own work as a survey. Some files (a Frontiers
  // PDF, for instance) print the abstract with no "Abstract" heading at all, so
  // the window is the abstract when labelled and the whole first page otherwise
  // -- still the abstract's own voice, and still nowhere near an introduction's
  // citation of somebody else's review.
  const abstract = (firstPage.match(/abstract\b([\s\S]{0,2500})/i) || [, firstPage.slice(0, 2500)])[1];
  if (/\b(?:this|the|our|in\s+this)\s+(?:short\s+|current\s+|brief\s+|narrative\s+)?review\b[,.]?\s*(?:here\s+)?(?:seeks|aims|summariz|discuss|highlight|provid|describ|outlin|present|survey|is\s+(?:intended|meant)|we\s)/i.test(abstract))
    selfId.push("abstract says 'this review ...'");
  if (/\bwe\s+(?:review|summarize|survey)\s+(?:here|the|recent|current|advances)\b/i.test(abstract))
    selfId.push("abstract says 'we review/summarize'");
  if (/poster\s+(?:presentation|abstract)/i.test(text.slice(0, 4000))) selfId.push("labelled a poster");
  if (/\b(?:In|in):\s*.{0,80}\(eds\.?\)/.test(head) || /methods\s+in\s+molecular\s+biology/i.test(head))
    selfId.push("reads as a book chapter");

  const hasMethods = methods.length > 0;
  const hasResults = results.length > 0;
  const surveyLabel = pageLabels.length > 0 || selfId.some((s) => /'this review|we review|poster|book chapter/.test(s));
  const notAnArticle = selfId.some((s) => /thesis|degree|poster|book chapter/.test(s));
  let verdict;
  if (notAnArticle) verdict = "NOT a research article";
  else if (surveyLabel && positiveLabels.length)
    verdict = "CONFLICT: page 1 says both '" + pageLabels[0] + "' and '" + positiveLabels[0] + "'";
  else if (surveyLabel && !hasMethods) verdict = "review article (no Methods)";
  else if (surveyLabel && hasMethods) verdict = "CONFLICT: survey label but has Methods";
  else if (positiveLabels.length && (hasResults || figures.size >= 2)) verdict = "research article";
  else if (hasMethods && (hasResults || figures.size >= 2)) verdict = "research article";
  else if (hasMethods) verdict = "has Methods, no Results heading";
  else if (positiveLabels.length) verdict = "labelled original article, headings not parsed";
  else if (!hasMethods && !hasResults && figures.size === 0) verdict = "no Methods/Results/figures";
  else verdict = "unclear";
  return {
    pdfRel,
    pages,
    methods: methods.slice(0, 4),
    results: results.slice(0, 4),
    figures: [...figures].sort((a, b) => a - b).slice(0, 10).join(","),
    tables: [...tables].sort((a, b) => a - b).slice(0, 8).join(","),
    selfId,
    verdict,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const pdfs = args.filter((a) => a.startsWith("--pdf=")).map((a) => a.slice(6));
  const db = lib.openPacket();
  let targets = pdfs.map((p) => ({ row_uid: "-", pdf_file: p, citing_title: "" }));
  const rowsArg = args.find((a) => a.startsWith("--rows="));
  if (rowsArg) {
    const ids = rowsArg.slice(7).split(",").map((s) => s.trim());
    targets = targets.concat(
      db
        .prepare(
          "SELECT row_uid, pdf_file, citing_title FROM citation WHERE row_uid IN (" +
            ids.map(() => "?").join(",") +
            ") ORDER BY row_uid",
        )
        .all(...ids),
    );
  }
  if (args.includes("--all-pdf")) {
    targets = db
      .prepare("SELECT row_uid, pdf_file, citing_title FROM citation WHERE pdf_file IS NOT NULL ORDER BY row_uid")
      .all();
  }
  for (const t of targets) {
    if (!t.pdf_file) {
      console.log(`${t.row_uid}\t(no pdf on disk)`);
      continue;
    }
    let s;
    try {
      s = await shape(t.pdf_file);
    } catch (e) {
      console.log(`\n${t.row_uid}  ${t.pdf_file}\n  EXTRACTION FAILED: ${String(e.message).slice(0, 90)}`);
      continue;
    }
    console.log(`\n${t.row_uid}  ${t.pdf_file}`);
    console.log(`  ${(t.citing_title || "").slice(0, 96)}`);
    console.log(`  verdict   : ${s.verdict}   (${s.pages} pages)`);
    console.log(`  methods   : ${s.methods.length ? s.methods.join(" | ") : "-"}`);
    console.log(`  results   : ${s.results.length ? s.results.join(" | ") : "-"}`);
    console.log(`  figures   : ${s.figures || "-"}    tables: ${s.tables || "-"}`);
    if (s.selfId.length) console.log(`  title page: ${s.selfId.join("; ")}`);
  }
  db.close();
}

module.exports = { shape };

if (require.main === module) main();

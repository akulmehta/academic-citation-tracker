// Offline tests for the capture helpers that decide what gets marked.
// Run: node tools/test-capture-helpers.js
//
// These cover the rules that must not regress: only confirmed independent,
// English entries are highlighted, and the review sheet flags everything else.

const {
  isConfirmedIndependent,
  isHighlightable,
  languageFlag,
  isCitingListUrl,
  classifyEndOfList,
  endOfListIsSuspicious,
  parseResultCount,
  pageUrl,
  flagAttention,
  computeCounts,
} = require("./capture-citations");

let pass = 0;
let fail = 0;

function check(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) {
    pass++;
    console.log(`  ok   ${name}`);
  } else {
    fail++;
    console.log(`  FAIL ${name}`);
    console.log(`         want: ${JSON.stringify(want)}`);
    console.log(`         got:  ${JSON.stringify(got)}`);
  }
}

// ---- Scholar result-count parsing ----------------------------------------

check("count: About form", parseResultCount("About 248 results"), 248);
check("count: thousands separator", parseResultCount("About 1,495 results"), 1495);
check("count: range form", parseResultCount("1-10 of 1,010 results"), 1010);
check("count: single result", parseResultCount("1 result"), 1);
check("count: missing", parseResultCount(""), null);
check("count: unrelated text", parseResultCount("Cited by"), null);

// ---- Language detection --------------------------------------------------

check("lang: English title", languageFlag({ title: "GlyGen: computational and informatics resources for glycomics", snippet: "" }), "");
check("lang: English with venue words", languageFlag({ title: "Design of glycan arrays on surfaces", snippet: "Glycobiology, 2020 - academic.oup.com" }), "");
check("lang: Japanese", languageFlag({ title: "糖鎖の解析", snippet: "" }), "non-latin script (title)");
check("lang: Chinese", languageFlag({ title: "糖链结合蛋白研究", snippet: "" }), "non-latin script (title)");
check("lang: Cyrillic", languageFlag({ title: "Исследование гликанов", snippet: "" }), "non-latin script (title)");
check("lang: Korean", languageFlag({ title: "글리칸 분석", snippet: "" }), "non-latin script (title)");
// Non-Latin script in the snippet alone is still decisive.
check("lang: non-Latin in snippet", languageFlag({ title: "A glycan study", snippet: "日本糖生物学" }), "non-latin script (snippet)");
check("lang: German function words", languageFlag({ title: "Und mit den Bindung fur", snippet: "" }).startsWith("possible non-English"), true);
// A single shared word must not flag an English paper.
check("lang: one shared word is not flagged", languageFlag({ title: "De novo design of glycan probes", snippet: "" }), "");
check("lang: empty", languageFlag({ title: "", snippet: "" }), "");

// Greek letters are scientific notation in English biochemistry titles. This
// exact entry was wrongly flagged on 2026-10-29, which suppressed a genuine
// independent citation from the exhibit.
check(
  "lang: greek symbol in English title is not flagged",
  languageFlag({
    title: "Trends in oligomannosylation and \u03b11, 2-mannosidase expression in human cancers",
    snippet: "",
  }),
  ""
);
check(
  "lang: beta-catenin style title is not flagged",
  languageFlag({ title: "Binding of \u03b2-catenin to \u03b1-catenin", snippet: "" }),
  ""
);
// A title genuinely written in Greek is mostly Greek letters and must flag.
check(
  "lang: Greek-language title is flagged",
  languageFlag({ title: "\u039c\u03b5\u03bb\u03ad\u03c4\u03b7 \u03b3\u03bb\u03c5\u03ba\u03b1\u03bd\u03b9\u03ba\u03ce\u03bd \u03c0\u03b9\u03bd\u03ac\u03ba\u03c9\u03bd", snippet: "" }),
  "non-latin script (title)"
);

// The notation exemption used to veto the whole script test, so this Chinese
// title escaped it purely because it names GPIba. Per the user's decision on
// 2026-11-01 the entry is not listed in English and must not be highlighted.
check(
  "lang: CJK title with a greek notation letter is flagged",
  languageFlag({
    title: "\u57fa\u4e8e\u8840\u5c0f\u677f\u7cd6\u86cb\u767d\u53d7\u4f53 GPIb\u03b1 \u7684\u8840\u6813\u5f62\u6210\u7814\u7a76\u8fdb\u5c55.",
    snippet: "\u9648\u76f8\uff0c \u9648\u79cb\u82b3 - Progress in Modern Biochemistry, 2024",
  }),
  "non-latin script (title)"
);

// A Portuguese entry was highlighted as independent on 2026-10-30 because the
// word list had no Portuguese forms. Accented letters catch it even though no
// two-letter word is trusted.
check(
  "lang: Portuguese title is flagged",
  languageFlag({
    title:
      "Impacto da inibi\u00e7\u00e3o da galectina-3 na revers\u00e3o da esteato-hepatite n\u00e3o alco\u00f3lica em modelo experimental",
    snippet: "",
  }).startsWith("possible non-English"),
  true
);
// "NO" is nitric oxide, the commonest abbreviation in this corpus. Lowercased
// it reads as a foreign word, and repeated mentions used to flag an English
// paper on its own.
check(
  "lang: nitric oxide abbreviation is not flagged",
  languageFlag({
    title: "Nitric oxide binding geometry in heme-proteins: relevance for signal transduction",
    snippet: "NO binds heme. NO also modulates galectin-3. NO levels rise in disease.",
  }),
  ""
);
// pi-hole and amyloid-beta are notation, and an em dash or ellipsis is
// punctuation, not a diacritic. None may flag an English title.
check(
  "lang: pi-hole title with punctuation is not flagged",
  languageFlag({
    title: "\u03c0-hole interactions involving nitro compounds: directionality of nitration\u2026",
    snippet: "Nature Communications, 2022 \u2013 nature.com",
  }),
  ""
);

// The accent range used to stop at U+00FF, so the letters that identify Polish
// were invisible and this title was highlighted as an independent citation.
// It is not listed in English, so per the guide it needs a certified
// translation and must stay unmarked. Real entry A2crVjMNOOkJ, SPGG page 11.
check(
  "lang: Polish title with Latin Extended-A letters is flagged",
  languageFlag({
    title:
      "Nowe perspektywy leczenia przeciwzakrzepowego\u2014\u015brodki hamuj\u0105ce czynnik krzepni\u0119cia XI",
    snippet: "J Treli\u0144ski - Hematologia, 2015 - publicum.umed.lodz.pl",
  }).startsWith("possible non-English"),
  true
);

// Option B, per the user on 2026-11-01: the guide asks whether the CITATION
// ENTRY (title, authors, venue) is listed in English, so a foreign-language
// abstract is not evidence about the entry. These two are English-titled
// German dissertations that the old snippet scan suppressed.
check(
  "lang: German abstract under English title is not flagged",
  languageFlag({
    title:
      "Evaluation of the Antiviral Effect of Polyglycerols Functionalized with Sialic Acid on Influenza Virus",
    snippet: "MN Stadtm\u00fcller - 2021 - edoc.hu-berlin.de Die antivirale Wirkung wird in dieser Arbeit untersucht",
  }),
  ""
);
// Greek letters in a snippet are notation, not a language. This English PLoS
// row was suppressed on \u03b1\u03b2\u03b3\u03b4\u03b5 alone.
check(
  "lang: greek notation in snippet is not flagged",
  languageFlag({
    title: "The tubulin database: Linking mutations, modifications, ligands and local interactions",
    snippet: "I Abbaali, D Truong, SD Day - PLoS Computational Biology, 2023 - journals.plos.org \u03b1\u03b2\u03b3\u03b4\u03b5 tubulin",
  }),
  ""
);

// ---- Pagination offsets (legacy helper) ----------------------------------
// Scholar shows 10 citing records per page and cannot be told otherwise, so
// paging follows Scholar's own "Next" link: a hand-built offset dropped
// Scholar's as_sdt/sciodt/scipsc parameters, and assuming 20 per page skipped
// records. Nothing in the capture path calls pageUrl; these only cover the
// parameter handling, stepped at Scholar's real 10.

const CITES = "https://scholar.google.com/scholar?oi=bibs&hl=en&cites=16263333014302844300";
check("page 1 adds no start param", pageUrl(CITES, 0), CITES);
check("page 2 starts at 10", pageUrl(CITES, 10).includes("start=10"), true);
check("page 25 starts at 240", pageUrl(CITES, 240).includes("start=240"), true);
check("offsets keep the cites id", pageUrl(CITES, 40).includes("cites=16263333014302844300"), true);
check(
  "an existing start is replaced, not duplicated",
  pageUrl(`${CITES}&start=0`, 10).match(/start=/g).length,
  1
);

// ---- Citing-list URL test -------------------------------------------------
// Regression: the guard tested for oi=bibs, but Scholar's own Next-page links
// omit it, so pages 2 and beyond were read, corroborated, then discarded.
const NEXT_PAGE =
  "https://scholar.google.com/scholar?start=10&hl=en&as_sdt=40000005&sciodt=0,22&cites=15061740354097007450&scipsc=";
check("first page url is a citing list", isCitingListUrl(CITES), true);
check("next page url without oi=bibs is still a citing list", isCitingListUrl(NEXT_PAGE), true);
check(
  "a bibtex record is not a citing list",
  isCitingListUrl("https://scholar.googleusercontent.com/scholar.bib?q=info:abc"),
  false
);
check(
  "a profile article page is not a citing list",
  isCitingListUrl(
    "https://scholar.google.com/citations?view_op=view_citation&hl=en&user=dNLaKGAAAAAJ&citation_for_view=dNLaKGAAAAAJ:9ZlFYXVOiuMC"
  ),
  false
);
check("empty url is not a citing list", isCitingListUrl(""), false);

// ---- Highlight decision --------------------------------------------------

const confirmed = { status: "INDEPENDENT", confirm_state: "confirmed" };
const coverage = { status: "INDEPENDENT", confirm_state: "unverified-coverage" };
const contradicted = { status: "REVIEW", confirm_state: "contradicted" };
const unresolved = { status: "REVIEW", confirm_state: "unresolved" };
const skipped = { status: "INDEPENDENT", confirm_state: "skipped" };
const dependent = { status: "DEPENDENT" };

check("highlight: confirmed", isHighlightable(confirmed), true);
check("highlight: unverified coverage still marked", isHighlightable(coverage), true);
// --no-crosscheck means no corroboration was attempted at all, so nothing here
// may be presented as a verified independent citation. The capture warns about
// this at startup: such a run is a working copy, not a filing exhibit.
check("highlight: cross-check skipped is not counted", isHighlightable(skipped), false);
check("highlight: contradicted", isHighlightable(contradicted), false);
check("highlight: unresolved", isHighlightable(unresolved), false);
check("highlight: dependent", isHighlightable(dependent), false);
// The rule that must never regress: non-English is never marked.
check(
  "highlight: confirmed but non-English",
  isHighlightable({ ...confirmed, language_flag: "non-latin script" }),
  false
);

// ---- Attention flags -----------------------------------------------------

const set = [
  { ...confirmed, title: "a" },
  { ...coverage, title: "b" },
  { ...contradicted, title: "c", external_matched: ["J Ma"] },
  { ...dependent, title: "d", matched_authors: ["J Ma"] },
  { ...confirmed, title: "e", language_flag: "non-latin script" },
];
flagAttention(set);
check(
  "attention: only open items flagged",
  set.filter((r) => r.needs_attention).map((r) => r.title),
  ["b", "c", "e"]
);
check(
  "attention: a decided DEPENDENT entry is not flagged",
  set.find((r) => r.title === "d").needs_attention,
  false
);
check(
  "attention: non-English reason mentions translation",
  /translation/.test(set.find((r) => r.title === "e").attention_reason),
  true
);

// ---- Counts --------------------------------------------------------------

const counts = computeCounts(set);
check("counts: highlighted excludes non-English", counts.HIGHLIGHTED, 2);
// The confirmation splits are taken among the highlighted entries, so they can
// never sum to more than HIGHLIGHTED. Counting the classification instead once
// reported '9 independent (10 externally confirmed)' on one review sheet, and
// the ledger disagreed with the PDF it described.
check("counts: confirmed never exceeds highlighted", counts.CONFIRMED, 1);
check("counts: coverage", counts.COVERAGE, 1);
check(
  "counts: splits stay within the highlighted total",
  counts.CONFIRMED + counts.COVERAGE <= counts.HIGHLIGHTED,
  true
);
check("counts: contradicted", counts.CONTRADICTED, 1);
check("counts: dependent", counts.DEPENDENT, 1);

// ---- End of citing list ---------------------------------------------------
// A page with no result rows is never "the end". That case is a block or a bad
// page, and calling it complete is how a 17-record list filed one page.

check(
  "end: no rows is never the end",
  classifyEndOfList({ container: true, rows: 0, hasNext: false }),
  "empty-results-list"
);
check(
  "end: verification interstitial has no results container",
  classifyEndOfList({ container: false, rows: 0, hasNext: false }),
  "not-a-results-page"
);
check(
  "end: rows with a Next link we failed to read",
  classifyEndOfList({ container: true, rows: 10, hasNext: true }),
  "next-link-present-but-unreadable"
);
check(
  "end: last page of results",
  classifyEndOfList({ container: true, rows: 7, hasNext: false }),
  "last-page-of-results (7 row(s) on page)"
);
check(
  "suspicious: a clean last page is not suspicious",
  endOfListIsSuspicious("last-page-of-results (10 row(s) on page)"),
  false
);
check("suspicious: no reason recorded stays quiet", endOfListIsSuspicious(""), false);
check("suspicious: empty list", endOfListIsSuspicious("empty-results-list"), true);
check(
  "suspicious: not a results page",
  endOfListIsSuspicious("not-a-results-page"),
  true
);
check(
  "suspicious: unreadable Next link",
  endOfListIsSuspicious("next-link-present-but-unreadable"),
  true
);
check("suspicious: unreadable page", endOfListIsSuspicious("page unreadable"), true);

console.log(
  fail === 0
    ? `\n${pass} passed, all good`
    : `\n${pass} passed, ${fail} FAILED`
);
process.exitCode = fail ? 1 : 0;

/**
 * Checks for reference-number resolution (`ref-cites.js`).
 *
 * Run: node scripts/test-ref-cites.js
 *
 * The cases below are not invented. Each positive is a marker that occurs in one
 * of the stored citing PDFs; each negative is a string from those same files that
 * looks like a citation and is not — a molar extinction coefficient, a wavelength,
 * a publication year, a page range, an ion concentration. A resolver that accepts
 * the negatives would credit a sentence to the applicant's paper that credits
 * nothing, and a tier is a claim about how the tool was used.
 */
"use strict";
const rc = require("./ref-cites");

let pass = 0, fail = 0;
function ok(cond, what) {
  if (cond) { pass++; return; }
  fail++;
  console.error(`FAIL  ${what}`);
}
function eq(got, want, what) {
  const a = JSON.stringify(got), b = JSON.stringify(want);
  if (a === b) { pass++; return; }
  fail++;
  console.error(`FAIL  ${what}\n        got  ${a}\n        want ${b}`);
}

/* ---- expandRun: what a bracketed run credits ---- */
eq(rc.expandRun("71"), [71], "single number");
eq(rc.expandRun(" 71 "), [71], "spaces inside the bracket");
eq(rc.expandRun("125 –127 "), [125, 126, 127], "en dash range with stray spaces (Vasta p.21)");
eq(rc.expandRun("125-127"), [125, 126, 127], "hyphen range");
eq(rc.expandRun("5, 9, 71"), [5, 9, 71], "comma list");
eq(rc.expandRun("5-7, 71"), [5, 6, 7, 71], "range mixed with a list");
eq(rc.expandRun("125 – 127; 130"), [125, 126, 127, 130], "range plus semicolon item");
eq(rc.expandRun("3H"), null, "isotope label is not a citation");
eq(rc.expandRun("Ca2+"), null, "ion is not a citation");
eq(rc.expandRun("CrossRef"), null, "link label is not a citation");
eq(rc.expandRun("S1"), null, "supplementary label is not a citation");
eq(rc.expandRun("10 mM HCl"), null, "reagent concentration is not a citation");
eq(rc.expandRun("2018-3-1-7"), null, "a DOI fragment with too many parts is refused");
eq(rc.expandRun("1-200"), null, "a 200-number span is a page range, not citations");
eq(rc.expandRun(""), null, "empty run");

/* ---- findTextMarkers: markers in a line of prose ---- */
function marks(t) { return rc.findTextMarkers(t).map(m => m.numbers); }
eq(marks("Glycan microarray analysis following established procedures [125 –127 ] was carried out"),
   [[125, 126, 127]], "Vasta p.21 Methods sentence credits 127 jointly");
eq(marks("present glycan array data [71]. Users input data"), [[71]], "Zou p.10 single bracketed marker");
eq(marks("the GLAD tool (59) representing the relative"), [[59]], "round-bracket marker");
eq(marks("protocol [3H] was added"), [], "isotope bracket yields nothing");
eq(marks("Glycobiology 2006, 16, 71–81. [CrossRef] [PubMed]"), [],
   "a bibliography line's year and page range yield nothing");
eq(marks("mItln2 had ε = 69,830 cm"), [],
   "an extinction coefficient is not reference 69 (Kiessling p.13)");
eq(rc.findTextMarkers("in 2018;47(1):179-191. DOI:").filter(m => m.numbers.includes(18)), [],
   "a publication year is not reference 18");

/* ---- a bare trailing number, ACS style after extraction ---- */
const bare = rc.findTextMarkers("following a previously reported method 45");
ok(bare.some(m => m.numbers.includes(45)), "bare trailing number accepted as a possible marker");
ok(rc.findTextMarkers("resuspended in PBS to 0.5 OD550").length === 0, "OD550 is not a marker");
ok(!rc.findTextMarkers("1569-050, 1:250). in HEPES").some(m => m.numbers.includes(69)),
   "part of a catalogue number is not reference 69");

/* ---- matchReference: identity needs two signals ---- */
const index = {
  byNumber: new Map([
    [69, "Mehta, A. Y. et al. Reusable glycan microarrays using a microwave assisted wet-erase process. Glycobiology 34, cwad091 (2024)."],
    [70, "Smith, J. Something about glycan microarrays entirely unrelated to the applicant. J. Glyco 12, 1-9 (2019)."],
    [71, "Zhang, L. Glycan arrays in infection. Nat. Rev. 8, 200-210 (2021)."],
  ]),
  refPages: new Set([19]),
};
const maws = { title: "Reusable glycan microarrays using a microwave assisted wet-erase (MAWE) process", year: "2024", surname: "Mehta" };
const hits = rc.matchReference(index, maws);
ok(hits.length >= 1, "MAWE paper resolves to an entry");
eq(hits[0].num, 69, "MAWE resolves to entry 69");
ok(hits[0].certain, "MAWE match is certain (title + year + author)");
ok(!hits.some(h => h.num === 70 && h.certain),
   "an entry merely sharing 'glycan microarrays' is not certain");
eq(rc.matchReference(index, { title: "A paper that is not in this bibliography at all whatsoever", year: "2030", surname: "Nobody" }),
   [], "an absent paper resolves to nothing");

/* ---- buildReferenceIndex: entries run across a page break ---- */
const refLines = [
  { text: "References" },
  { text: "68. Adler, K. Something. J. Biol. Chem. 300, 107869 (2024). https://doi.org/10.1016/j.jbc.2024.107869" },
  { text: "69. Mehta, A. Y. et al. Reusable glycan microarrays using a microwave assisted wet-erase process. Glycobiology 34, cwad091 (2024)." },
  { text: "70. Bravo, C. Else. Nature 9, 4-5 (2020). PMID: 31000000" },
  { text: "71. Chen, D. More. Science 10, 6-7 (2021). Crossref" },
  { text: "72. Dvorak, E. Again. Cell 11, 8-9 (2022). doi:10.1016/j.cell.2022.01.002" },
  // the list's last entry on the page runs short of a year: it finishes on the
  // next page, which is itself too short to pass the reference-page test.
  { text: "73. Evans, F. Once more. PNAS 12, 10-11" },
];
const pages = [
  [{ text: "Introduction" }, { text: "We used a method as described previously 12" }],
  // A real reference page announces itself with enough numbered entries.
  refLines,
  [{ text: "(2023). PMID: 33000000" },
   { text: "74. Fujita, G. Further. JACS 13, 12-13 (2024)." },
   { text: "75. Grant, H. Final. Glycobiology 14, 14-15 (2025)." },
   { text: "76. Hall, I. End. Nature Chem 15, 16-17 (2026)." }],
];
const built = rc.buildReferenceIndex(pages);
ok(built.refPages.size >= 1, `reference pages detected (${[...built.refPages].join(",")})`);
ok(/PMID: 33000000/.test(String(built.byNumber.get(73) || "")),
  "entry 73 continues onto the short page that follows the list");
ok(/wet-erase/.test(String(built.byNumber.get(69) || "")), "entry 69 read whole from the page");
ok(!built.byNumber.has(12), "a numbered list in prose is not a bibliography entry");

/* ---- findMarkers: end to end, bibliography excluded ---- */
// Only the reference pages, so an entry number cannot be read as an in-text mark.
const onlyRefs = [[{ text: "Glycan microarray analysis following established procedures [125 –127 ] was carried out" }], refLines];
const refIndex = { byNumber: built.byNumber, refPages: new Set([2]) };
const found = rc.findMarkers(onlyRefs, refIndex, 127, t => t);
eq(found.length, 1, "one in-text occurrence of 127, the entry line ignored");
eq(found[0] && found[0].jointWith, [125, 126], "127 is credited jointly with 125 and 126");
eq(found[0] && found[0].marker, "[125 –127 ]", "the marker is reported as printed");
eq(rc.findMarkers(onlyRefs, refIndex, 69, t => t), [],
   "a number appearing only in the reference list yields no occurrence");

/* ---- an orphan superscript on its own line, quoted from the prose above ---- */
const supPages = [
  [{ text: "…the core facility also changed protocols and began regenerating and reusing slides" }],
  [{ text: "69" }, { text: "Figure 1. Binding data." }],
];
const sup = rc.findMarkers(supPages, { byNumber: new Map(), refPages: new Set() }, 69, t => t);
eq(sup.length, 1, "an orphan line of digits is one occurrence");
ok(/regenerating and reusing slides/.test(sup[0].quote),
   "the quotation comes from the prose the superscript belongs to, not the digits");
eq(sup[0].orphan, true, "the occurrence is flagged as an orphan marker");
// The Knight 2026 false positive: a chart's y-axis labels reach the extractor as
// lines reading `0`, `10`, `20`, `30`, each of them an orphan number line, and the
// walk-back used to climb over them and quote the unrelated paragraph above the
// figure. A citation attaches to prose, so a digit line above kills the marker.
const axis = [
  [{ text: "GlycoGlyph was used to annotate the spectra reported below." }],
  [{ text: "0" }, { text: "10" }, { text: "20" }, { text: "30" }],
];
eq(rc.findMarkers(axis, { byNumber: new Map(), refPages: new Set() }, 30, t => t), [],
   "a chart axis tick is not a superscript citation (Knight p.14)");
// A marker whose sentence is a figure label resolves but must not be quoted as
// though it were prose.
eq(rc.findMarkers([
  [{ text: "GlycoGlyph was used to annotate the spectra and quantified the response." }],
  [{ text: "30" }],
], { byNumber: new Map(), refPages: new Set() }, 30, t => t)[0].context_is_prose, true,
   "a full sentence above the marker is quotable");
eq(rc.findMarkers([
  [{ text: "Fig. 5b" }],
  [{ text: "30" }],
], { byNumber: new Map(), refPages: new Set() }, 30, t => t)[0].context_is_prose, false,
   "a figure label above the marker is flagged as not quotable prose");
// Afanasiev p.10: the number sits in a table whose rows open with their index, and
// p.6 a superscript sits under a title-cased table column. Both resolve, neither is
// a sentence, and quoting either would hand counsel a table cell as a claim.
eq(rc.isProseLine("1 Antifreeze components >27 kD, pI 4–8"), false,
   "a table row opening with its index is not prose");
eq(rc.isProseLine("Oral Health by Using Probiotic Products"), false,
   "a title-cased table column is not prose");
eq(rc.isProseLine("Glycans were drawn using GlycoGlyph [30], and the names checked against the IUPAC conditions."), true,
   "an ordinary sentence with a bracketed number is prose");

/* ---- findRaisedMarkers: a true superscript, not a subscript ---- */
// Heights and baselines below are the measured values from the stored PDFs: the
// Kiessling superscript is 4.93 tall on baseline 428.26 against a body of 8.22 on
// 424.79, and a chemical subscript is drawn at the reduced height but NOT raised.
const raised = {
  text: "…regenerating and reusing slides 69",
  items: [
    { str: "regenerating and reusing slides", h: 8.22, base: 424.79, x: 10, w: 120 },
    { str: "69", h: 4.93, base: 428.26, x: 133, w: 6 },
  ],
};
ok(rc.findRaisedMarkers(raised).some(m => m.numbers.includes(69)),
   "raised smaller 69 after a space is a citation superscript");
// The real Kiessling case: the digits are typeset tight against the word, so a
// gap test alone could never see them and only the raised baseline can.
const glued = {
  text: "ing slides; the long-term effects on fluorescence intensity are unclear69.",
  items: [
    { str: "ing slides; the long-term effects on", h: 8.22, base: 424.79, x: 39.68, w: 124.61 },
    { str: " ", h: 8.22, base: 424.79, x: 164.29, w: 0.21 },
    { str: "fl", h: 8.22, base: 424.79, x: 166, w: 4.79 },
    { str: "uorescence intensity are unclear", h: 8.22, base: 424.79, x: 170.59, w: 116.63 },
    { str: "69", h: 4.93, base: 428.26, x: 287.04, w: 5.7 },
    { str: ".", h: 8.22, base: 424.8, x: 292.65, w: 2.14 },
  ],
};
const gluedMarks = rc.findRaisedMarkers(glued);
ok(gluedMarks.some(m => m.numbers.includes(69) && m.glued),
   "a superscript glued to the end of a word is a citation (Kiessling p.15)");
const sub = {
  text: "in 0.1 M Na2CO3 was adsorbed",
  items: [
    { str: "in 0.1 M Na", h: 8.2, base: 500, x: 10, w: 40 },
    { str: "2", h: 5.5, base: 499, x: 50, w: 4 },
    { str: "CO", h: 8.2, base: 500, x: 54, w: 12 },
    { str: "3", h: 5.5, base: 499, x: 66, w: 4 },
    { str: " was adsorbed", h: 8.2, base: 500, x: 70, w: 60 },
  ],
};
eq(rc.findRaisedMarkers(sub), [], "a chemical subscript abutting a word is not a citation");
const body = {
  text: "added 25 μL of buffer",
  items: [{ str: "added ", h: 8.2, base: 500, x: 10, w: 24 }, { str: "25", h: 8.2, base: 500, x: 34, w: 9 }, { str: " μL", h: 8.2, base: 500, x: 43, w: 12 }],
};
eq(rc.findRaisedMarkers(body), [], "a full-size number is not a superscript");
// Small and ON the baseline is a subscript or a rendering artifact, never a mark.
const smallFlat = {
  text: "CaCl2 was used",
  items: [{ str: "CaCl", h: 8.2, base: 500, x: 10, w: 20 }, { str: "2", h: 5.0, base: 500, x: 30, w: 4 }, { str: " was used", h: 8.2, base: 500, x: 34, w: 40 }],
};
eq(rc.findRaisedMarkers(smallFlat), [], "a small number on the body baseline is not raised");

/* ---- findAuthorYearMarkers: the style with no reference numbers ---- */
const GLAD = { title: "GLAD: GLycan Array Dashboard", year: "2019", surname: "mehta", coauthors: ["cummings"] };
const ay = t => rc.findAuthorYearMarkers(t, GLAD);
ok(ay("…enriched glycan motifs (Mehta and Cummings 2019).").length === 1,
  "narrative (Surname and Coauthor YEAR) found");
ok(ay("(Mehta & Cummings 2019)").length === 1, "ampersand form found");
ok(ay("(Mehta et al., 2019; York et al., 2020)").length === 1, "one marker among several found");
ok(ay("Mehta et al. (2019) showed").length === 1, "narrative form with the year bracketed");
ok(ay("(Gao et al. 2021)").length === 0, "a different first author is not the applicant's paper");
ok(ay("(Mehta et al. 2020)").length === 0, "the wrong year is not the paper");
ok(ay("[12]").length === 0, "a numbered marker is not an author-year citation");
ok(ay("(Mehta and Cummings 2019)")[0].coauthorHit === true,
  "naming a co-author is the stronger signal");
ok(ay("(Mehta et al. 2019)")[0].coauthorHit === false,
  "surname plus year alone is reported as the weaker signal");

/* ---- the reference list of an author-year paper is still excluded ---- */
{
 const ayPages = [
   [{ text: "We used the dashboard as described (Mehta and Cummings 2019)." }],
   [{ text: "Akkouh, O., Ng, T., Singh, S. 2015. Lectins with Anti-HIV Activity: A Review. Molecules. 20(1):648–668. https://doi.org/10.3390/molecules20010648" }],
   [{ text: "Mehta, A.Y., Cummings, R.D. 2019. GLAD: GLycan Array Dashboard. Bioinformatics. 35(18):3536–3537. https://doi.org/10.1093/bioinformatics/btz095" }],
 ];
 const block = rc.findReferenceBlockPages(ayPages);
 ok(block.has(2) && block.has(3), `author-year bibliography located (${[...block].join(",")})`);
 const found = rc.findAuthorYearCitations(ayPages, GLAD, { skipPages: block, sentenceAround: t => t });
 eq(found.length, 1, "the bibliography entry itself is not credited as a citation");
 eq(found[0].page, 1, "the one in-text author-year citation is the prose line");
}

// ── regressions found on the 2026-11 re-scan: each of these once hid a real citation ──
{
  ok(JSON.stringify(rc.expandRun("37e39")) === JSON.stringify([37, 38, 39]), "Elsevier's 'e' for the en dash reads as a range");
  ok(JSON.stringify(rc.expandRun("34−37")) === JSON.stringify([34, 35, 36, 37]), "ACS's U+2212 minus reads as a range");
  eq(rc.firstSurname("S Verespy III, AY Mehta"), "verespy", "a generational suffix is not the surname");
  const L = (t) => ({ text: t });
  // ACS-style "(37) Surname" list, with entry 38 missing from the extraction
  const bib = [[L("(36) Smith, A.; Jones, B. Paper one. J. 2014, 1, 1."), L("(37) Argade, M. D.; Mehta, A. Y. Allosteric inhibition of human factor XIa. J. Med. Chem. 2014, 57, 3559."),
    L("(39) Lee, C. Another. J. 2015, 2, 2."), L("(40) Kim, D. More. J. 2016, 3, 3."), L("(41) Roe, E. Last. J. 2017, 4, 4.")]];
  const idx = rc.buildReferenceIndex(bib);
  ok(idx.byNumber.has(37) && idx.byNumber.has(41), "a parenthesised numbered list is read even with a gap");
  const m = rc.matchReference(idx, { title: "Allosteric inhibition of human factor XIa", year: "2014", surname: "argade", coauthors: ["mehta"] });
  ok(m.length && m[0].num === 37 && m[0].certain, "the entry is matched to the paper");
  // an entry with no title at all is matched on first author + year + two more authors
  const noTitle = { byNumber: new Map([[11, "A. Y. Mehta, Y. Jin and U. R. Desai, Expert Opin. Ther. Pat., 2014, 24, 47."]]), refPages: new Set() };
  const nm = rc.matchReference(noTitle, { title: "An update on recent patents on thrombin inhibitors", year: "2014", surname: "mehta", coauthors: ["jin", "desai"] });
  ok(nm.length === 1 && nm[0].byAuthors && nm[0].certain, "a titleless entry is matched on authors and year");
  const other = rc.matchReference(noTitle, { title: "An update on recent patents on thrombin inhibitors", year: "2014", surname: "mehta", coauthors: ["smith", "jones"] });
  ok(other.length === 0, "a titleless entry sharing only the first author is not the paper");
}

// ── cit-001530: three things that were counted as citations of reference 3 and were not ──
{
  const L = t => ({ text: t });
  const hdr = "V.S. Pokrovsky et al. Analytical Biochemistry 701 (2025) 115806";
  const pg = (...lines) => lines.map(L);
  const pages = [
    pg(hdr, "The repertoire of circulating antibodies is unique and stable [3].", "Advantages include: (1) parallel screening; (2) low sample volume; (3) high sensitivity."),
    pg(hdr, "This is more proof that the variables are related in a", hdr.replace("701", "702"), "3"),
    pg(hdr, "Conclusions follow here."),
    pg("References", "[3] R. Luetscher, Unique repertoire, Sci. Rep. 2020."),
  ];
  const index = { byNumber: new Map([[3, "R. Luetscher, Unique repertoire, Sci. Rep. 2020."]]), refPages: new Set([4]), style: "bracket" };
  const h = rc.findMarkers(pages, index, 3, { sentenceAround: t => t });
  eq(h.length, 1, "only the real [3] counts: not the enumeration (3), not a page number under a running header");
  ok(h[0].marker === "[3]" && h[0].page === 1, "the surviving hit is the bracketed citation on page 1");
  // the same text in a paper that numbers its list "(3) Smith" keeps (3) as a citation
  const idxParen = { ...index, style: "paren" };
  const pagesP = [pg(hdr, "Methods followed the published protocol (3)."), pg(hdr, "More text."), pg(hdr, "More text.")];
  eq(rc.findMarkers(pagesP, { ...idxParen, refPages: new Set([4]) }, 3, { sentenceAround: t => t }).length, 1,
    "(3) is a citation where the bibliography is numbered (3)");
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;

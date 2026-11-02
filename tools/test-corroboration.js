// Offline tests for the corroboration rule (tools/corroboration.js) and the
// title-credibility test it depends on (tools/crosscheck.js).
// Run: node tools/test-corroboration.js
//
// These are the two rules that decide whether an external author list is
// believed at all, and what it does to a row. Both were wrong until 2026-11-02:
// similarity divided by the SHORTER title, so a one-word Scholar title scored a
// perfect 1.00 against any record containing that word, and a row Scholar
// truncated was never resolved even when a complete external list answered the
// question. The cases below are the actual corpus rows that caused each rule,
// so a regression here is a regression against real evidence, not a hypothesis.

const {
  titleSimilarity,
  titleMatchIsCredible,
  TITLE_MATCH_THRESHOLD,
} = require("./crosscheck");
const { applyExternalVerdict } = require("./corroboration.js");
const { toKeys } = require("./name-match.js");

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

// ---- R1: title credibility -----------------------------------------------

const LONG =
  "Comparative treatment effects of direct oral anticoagulants versus warfarin in patients with atrial fibrillation";

// The defect: Scholar showed only a fragment, min() collapsed to 1, and the old
// formula returned 1.00.
check("sim: one-word fragment rejected", titleMatchIsCredible(titleSimilarity("Anticoagulants", LONG)), false);
check("sim: single surname rejected", titleMatchIsCredible(titleSimilarity("Bakker", "Re: Bakker et al. concomitant ligament injuries can be left untreated")), false);
check("sim: instrument acronym rejected", titleMatchIsCredible(titleSimilarity("LC-ESI-MS/MS", "A practical and robust method for quantification of long-chain PFAS in food")), false);
check("sim: journal name taken for a title", titleMatchIsCredible(titleSimilarity("Future Medicinal Chemistry", "Our New Year's (re)solution welcome to the 15th volume of Future Medicinal Chemistry")), false);
// A surname-only Scholar row must not be rescued by the prefix rule either:
// "Bakker" is a verbatim leading word of that letter's title, so the guard is
// the word count, not the position.
check(
  "sim: prefix needs two words",
  titleMatchIsCredible(titleSimilarity("Bakker", "Bakker ligament injuries")),
  false,
);

// Scholar truncates a long title with an ellipsis, so the row's own byline is a
// leading fragment of the true title. That is the same work.
check(
  "sim: Scholar truncation is credible",
  titleMatchIsCredible(
    titleSimilarity(
      "Carbohydrate Microarray Technology",
      "Carbohydrate Microarray Technology Applied to High-Throughput Mapping of Polysaccharide Microarrays",
    ),
  ),
  true,
);
// Credible-but-not-identical is reported at the threshold itself, never higher.
check(
  "sim: credible non-exact caps at threshold",
  titleSimilarity(
    "Carbohydrate Microarray Technology",
    "Carbohydrate Microarray Technology Applied to High-Throughput Mapping of Polysaccharide Microarrays",
  ),
  TITLE_MATCH_THRESHOLD,
);

// A substring in the middle of both titles, long enough to identify the work.
// This is the shape Scholar truncation produces when the cut falls late.
const METHOD = "magnetic solid phase extraction";
const FULL_METHOD = `Rapid liquid chromatography tandem mass spectrometry with ${METHOD}`;
check("sim: four-word containment credible", titleMatchIsCredible(titleSimilarity(METHOD, FULL_METHOD)), true);
// Three words is not enough to identify a paper on its own.
check(
  "sim: three-word containment not credible",
  titleMatchIsCredible(titleSimilarity("magnetic solid phase", FULL_METHOD)),
  false,
);

check("sim: identical titles", titleSimilarity("GlyGen informatics resources for glycomics", "GlyGen informatics resources for glycomics") >= 0.99, true);
check("sim: empty title", titleSimilarity("", LONG), 0);
check("sim: no Latin words", titleSimilarity("????", LONG), 0);
check("sim: subscript C(60) still matches", titleMatchIsCredible(titleSimilarity("Inhibition of thrombin by functionalized C60 nanoparticles revealed via interaction studies", "Inhibition of thrombin by functionalized C(60) nanoparticles revealed via interaction studies")), true);

// ---- The shared rule ------------------------------------------------------

// Cited paper: the 2016 allosterism-based dual anticoagulant article.
const KEYS = {
  authorKeys: toKeys("AY Mehta,UR Desai").keys,
  piKeys: toKeys("RD Cummings").keys,
  formerKeys: toKeys("UR Desai").keys,
};

// A row as the capture would have written it before this rule existed.
function row(over) {
  return {
    index: 1,
    title: "Some citing paper of record",
    authors: "AB Other, CD Someone",
    full_authors: [],
    truncated: true,
    status: "REVIEW",
    confirm_state: "unresolved",
    external_source: "pubmed",
    external_title: "Some citing paper of record",
    external_authors: "AB Other, CD Someone",
    external_similarity: 1,
    ...over,
  };
}

// -- nothing external: this module has no opinion

{
  const e = row({ external_source: "", external_authors: "" });
  const r = applyExternalVerdict(e, KEYS);
  check("no external: unchanged", r.changed, false);
  check("no external: state kept", e.confirm_state, "unresolved");
}

// -- R1: an incredible match is discarded, not believed

{
  // cit-001476 - Scholar showed one word, "Glycoproteomics", and the row was
  // counted independent on a PubMed record for a different paper.
  const e = row({
    title: "Glycoproteomics",
    external_title: "Spatial transcriptomics and N-glycoproteomics reveal breed-dependent immune responses",
    external_similarity: 1,
    status: "INDEPENDENT",
    confirm_state: "confirmed",
    corroboration: "confirmed by pubmed",
    full_authors: ["Julia Nielek", "Anna Bakker"],
    author_source: "scholar+pubmed",
    authors_used: "Julia Nielek, Anna Bakker",
  });
  applyExternalVerdict(e, KEYS);
  check("R1: no longer externally confirmed", e.confirm_state, "unresolved");
  check("R1: truncated Scholar list cannot carry it", e.status, "REVIEW");
  check("R1: overwritten author list restored", e.author_source, "scholar-list (truncated)");
  check("R1: Scholar byline kept verbatim", e.authors_used, "AB Other, CD Someone");
  check("R1: full list dropped", e.full_authors, []);
  check("R1: similarity recomputed low", e.external_similarity < TITLE_MATCH_THRESHOLD, true);
  check("R1: marked not credible", e.external_match_credible, 0);
  check("R1: reason recorded", /rejected 2026-11-02/.test(e.corroboration_note), true);
}

{
  // Same discard, but Scholar's own list was complete. The row keeps counting on
  // Scholar alone and simply loses the external claim - it is not an open
  // question, it is a spot-check.
  const e = row({
    title: "Siglec ligands",
    external_title: "One-Step Glycoengineering of NK Cells With High-Affinity Siglec Ligands for Cancer Immunotherapy",
    status: "INDEPENDENT",
    confirm_state: "confirmed",
    truncated: false,
  });
  applyExternalVerdict(e, KEYS);
  check("R1 complete list: still independent", e.status, "INDEPENDENT");
  check("R1 complete list: unverified coverage", e.confirm_state, "unverified-coverage");
}

{
  // A row whose author list was never overwritten keeps its own source.
  const e = row({
    title: "Factor XI deficiency",
    external_title: "Real-Time Coagulation Monitoring via Thromboelastography and Platelet Mapping",
    status: "INDEPENDENT",
    confirm_state: "confirmed",
    truncated: false,
    author_source: "scholar-list",
  });
  applyExternalVerdict(e, KEYS);
  check("R1: untouched byline source", e.author_source, "scholar-list");
}

// -- R2: a credible complete list settles a truncated Scholar byline

{
  // Bucket 2 of the review sheet: Scholar truncated, external list is complete
  // and shares nobody. This is the promotion the user asked for on 2026-11-02.
  const e = row({ external_authors: "Y Seo, JE Park, B Lee" });
  const r = applyExternalVerdict(e, KEYS);
  check("R2: promoted to independent", e.status, "INDEPENDENT");
  check("R2: confirm_state confirmed", e.confirm_state, "confirmed");
  check("R2: external list adopted", e.full_authors, ["Y Seo", "JE Park", "B Lee"]);
  check("R2: author source records both", e.author_source, "scholar+pubmed");
  check("R2: reported as changed", r.changed, true);
  check("R2: credibility field absent", e.external_match_credible, undefined);
}

{
  // The user's condition, same day: check the language test first. A row the
  // language screen holds back cannot count either way, so it is not promoted -
  // that would only move it between two uncounted states.
  //
  // The fixture is a Latin-script non-English row on purpose. A Cyrillic or
  // CJK title yields no Latin tokens at all, so its similarity is 0 and R1
  // rejects the match before the language guard is ever reached - which is why
  // the two Cyrillic rows in the corpus fall to "unresolved" rather than being
  // promoted here. The two titles are held identical so this test exercises the
  // language guard alone and not the tokeniser's accent handling.
  const French = "Etude de la glycosylation des proteines seriques par spectrometrie de masse";
  const e = row({
    title: French,
    external_title: French,
    language_flag: "possible non-English (accented letters: é)",
    external_authors: "Y Seo, JE Park, B Lee",
  });
  const r = applyExternalVerdict(e, KEYS);
  check("R2 language: match was believed", e.external_match_credible, undefined);
  check("R2 language: NOT promoted", e.status, "REVIEW");
  check("R2 language: still excluded", /non-English/.test(e.corroboration), true);
  check("R2 language: reported as changed", r.changed, true);
  check("R2 language: note explains it", r.notes.includes("stays in review: non-English"), true);
}

{
  // A shared author is a decision, not an open contradiction (bucket 1).
  const e = row({
    status: "REVIEW",
    confirm_state: "contradicted",
    external_authors: "AY Mehta, PD Patel, S Smith",
  });
  applyExternalVerdict(e, KEYS);
  check("overlap: DEPENDENT", e.status, "DEPENDENT");
  check("overlap: settled not contradicted", e.confirm_state, "external-resolved");
  check("overlap: matched author recorded", e.matched_authors, ["AY Mehta"]);
  check("overlap: not marked", /resolved against pubmed/.test(e.corroboration), true);
}

{
  // cit-000106: the former PI on the citing paper. The cited paper lists
  // "UR Desai" too, so the shared-author test fires first and DEPENDENT wins -
  // evaluateEntry ranks DEPENDENT above SELF, which is how the filed rows read.
  const e = row({
    status: "REVIEW",
    confirm_state: "contradicted",
    external_authors: "Umesh R. Desai, KL Jones",
  });
  applyExternalVerdict(e, KEYS);
  check("former PI: DEPENDENT outranks SELF", e.status, "DEPENDENT");
  check("former PI: settled", e.confirm_state, "external-resolved");
  check("former PI: hit recorded", e.matched_former_pi, ["Umesh R. Desai"]);
}

{
  // A citing paper naming the current PI and nobody from the cited paper is a
  // self-citation rather than a dependent one.
  const e = row({
    status: "REVIEW",
    confirm_state: "contradicted",
    external_authors: "Richard D. Cummings, KL Jones",
  });
  applyExternalVerdict(e, KEYS);
  check("PI: SELF (PI)", e.status, "SELF (PI)");
  check("PI: settled", e.confirm_state, "external-resolved");
  check("PI: hit recorded", e.matched_pi, ["Richard D. Cummings"]);
}

{
  // A row Scholar already called independent is confirmed, not re-decided.
  const e = row({
    status: "INDEPENDENT",
    confirm_state: "unverified-coverage",
    truncated: false,
    external_authors: "Y Seo, JE Park, B Lee",
  });
  applyExternalVerdict(e, KEYS);
  check("no overlap: independent confirmed", [e.status, e.confirm_state], ["INDEPENDENT", "confirmed"]);
  check("no overlap: wording is confirmed by", /^confirmed by pubmed/.test(e.corroboration), true);
}

{
  // A stable row must report changed=false, or the dry run overstates the
  // damage. This exact bug once reported 683 entries changed on a run that
  // moved 12 marks.
  const e = row({
    status: "INDEPENDENT",
    confirm_state: "confirmed",
    truncated: false,
    corroboration: "confirmed by pubmed",
    external_authors: "Y Seo, JE Park, B Lee",
    full_authors: ["Y Seo", "JE Park", "B Lee"],
    author_source: "scholar+pubmed",
  });
  const r = applyExternalVerdict(e, KEYS);
  check("idempotent: no change reported", r.changed, false);
  const again = applyExternalVerdict(e, KEYS);
  check("idempotent: second pass too", again.changed, false);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exitCode = fail ? 1 : 0;

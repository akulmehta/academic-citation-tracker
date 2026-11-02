// Offline tests for the shared counting rules in tally.js.
// Run: node tools/test-tally.js
//
// These matter because the filing totals are quoted in the response packet.
// The rule that must never regress: a non-English entry, or an independent
// entry no source has settled, is never counted as independent.

const {
  isHighlighted,
  isHighlightCandidate,
  isIndependentPending,
  paperKey,
  doiArticleId,
  editionKey,
  markLanguageEditions,
  uniquePapers,
  tallyEntries,
  emptyTally,
  addTally,
  citesId,
  expectedPages,
  CITATIONS_PER_PAGE,
  pct,
} = require("./tally");

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

// ---- What counts as independent ------------------------------------------

const confirmed = { status: "INDEPENDENT", confirm_state: "confirmed" };
const coverage = { status: "INDEPENDENT", confirm_state: "unverified-coverage" };
const unresolved = { status: "REVIEW", confirm_state: "unresolved" };
const contradicted = { status: "REVIEW", confirm_state: "contradicted" };
const dependent = { status: "DEPENDENT" };
const selfPi = { status: "SELF (PI)" };
const selfFormer = { status: "SELF (FORMER PI)" };

check("count: externally confirmed", isHighlighted(confirmed), true);
check("count: Scholar complete list only", isHighlighted(coverage), true);
check("count: unresolved", isHighlighted(unresolved), false);
check("count: contradicted", isHighlighted(contradicted), false);
check("count: dependent", isHighlighted(dependent), false);
check("count: self PI", isHighlighted(selfPi), false);
check("count: self former PI", isHighlighted(selfFormer), false);
check(
  "count: confirmed but non-English is never counted",
  isHighlighted({ ...confirmed, language_flag: "non-latin script" }),
  false
);
check(
  "count: independent with no corroboration state",
  isHighlighted({ status: "INDEPENDENT" }),
  false
);

// An independent-looking entry that is not yet countable has to stay visible as
// open, otherwise a pending item silently disappears from the totals.
check("pending: unresolved corroboration is pending", isIndependentPending({ status: "INDEPENDENT", confirm_state: "unresolved" }), true);
check("pending: non-English independent is pending", isIndependentPending({ status: "INDEPENDENT", language_flag: "x" }), true);
check("pending: counted entry is not pending", isIndependentPending(confirmed), false);
check("pending: a DEPENDENT entry is decided, not pending", isIndependentPending(dependent), false);

// ---- Tally arithmetic ----------------------------------------------------

const set = [
  confirmed,
  coverage,
  { ...confirmed, language_flag: "non-latin script" },
  { status: "INDEPENDENT", confirm_state: "unresolved" },
  dependent,
  selfPi,
  selfFormer,
  unresolved,
];
const t = tallyEntries(set);
check("tally: records", t.records, 8);
check("tally: countable independent excludes non-English", t.independent, 2);
check("tally: confirmed split", t.independent_confirmed, 1);
check("tally: coverage split", t.independent_coverage, 1);
check("tally: pending independent", t.independent_pending, 2);
check("tally: dependent", t.dependent, 1);
check("tally: self PI", t.self_pi, 1);
check("tally: self former PI", t.self_former_pi, 1);
check("tally: review", t.review, 1);
check("tally: non-English", t.non_english, 1);

// Every record must land in exactly one bucket, or the ledger hides evidence.
check(
  "tally: countable plus pending plus non-independent equals all records",
  t.independent + t.independent_pending + t.dependent + t.self_pi + t.self_former_pi + t.review,
  t.records
);

check("tally: empty input", tallyEntries([]), emptyTally());
check("addTally: sums numeric keys", addTally({ a: 1, b: 2 }, { a: 3, b: 4, c: 5 }), {
  a: 4,
  b: 6,
  c: 5,
});
check("addTally: ignores non-numeric", addTally({ records: 1 }, { records: 2, title: "x" }), {
  records: 3,
});

// ---- Pagination and percentages -----------------------------------------

// Scholar returns 10 citing records per page and there is no way to change it,
// so this is a fact to pin, not a tunable. Every page count in the project
// derives from it: tally.expectedPages, run-batch's expected exhibit count, the
// ledger and the catalog.
check("page size is Scholar's fixed 10", CITATIONS_PER_PAGE, 10);
check("pages: 6 citations", expectedPages(6), 1);
check("pages: exactly 10", expectedPages(10), 1);
check("pages: 11 needs a second page", expectedPages(11), 2);
check("pages: 20 fills exactly two", expectedPages(20), 2);
check("pages: 248", expectedPages(248), 25);
check("pages: missing count is not a page", expectedPages(""), 1);
check("pages: non-numeric", expectedPages("n/a"), 1);

check("pct: rounds to one digit", pct(83, 99), 83.8);
check("pct: zero whole returns null, not Infinity", pct(0, 0), null);
check("pct: all of it", pct(12, 12), 100);
check("pct: custom digits", pct(1, 3), 33.3);
check("pct: two digits", pct(1, 3, 2), 33.33);

// ---- Duplicate versions of one paper -------------------------------------
// Scholar's citing list shows the same paper twice when a publisher copy and a
// repository/thesis/preprint copy both exist. The exhibit keeps both rows; the
// statistics must not claim two citing papers.

const pubCopy = {
  title: "CD137 (4-1BB) requires physically associated cIAPs for signal transduction",
  cid: "a1",
  page: 2,
  status: "INDEPENDENT",
  confirm_state: "confirmed",
  author_source: "scholar-cite-bibtex",
};
const repoCopy = {
  title: "CD137 (4-1BB) requires physically associated cIAPs for signal transduction",
  cid: "b2",
  page: 2,
  status: "INDEPENDENT",
  confirm_state: "confirmed",
  author_source: "scholar-cite-bibtex",
};

const dup = uniquePapers([pubCopy, repoCopy]);
check("duplicate: two rows collapse to one paper", dup.kept.length, 1);
check("duplicate: one group reported", dup.merged.length, 1);

// A genuinely different paper, used to prove distinct works never merge.
const other = {
  title: "Tools for generating and analyzing glycan microarray data",
  cid: "e5",
  page: 1,
  status: "DEPENDENT",
  author_source: "scholar-list",
};

const dupTally = tallyEntries([pubCopy, repoCopy]);
check("duplicate: rows still counted", dupTally.records, 2);
check("duplicate: distinct papers", dupTally.unique_records, 1);
check("duplicate: extra copies recorded", dupTally.duplicate_records, 1);
check("duplicate: independent on distinct basis", dupTally.unique_independent, 1);

// Case and punctuation must not defeat the match - Scholar capitalises the same
// title differently between copies.
check(
  "duplicate: identity ignores case and punctuation",
  paperKey({ title: "Design, Synthesis, and Antisickling Investigation of a Prodrug" }) ===
    paperKey({ title: "design synthesis and antisickling investigation of a prodrug" }),
  true
);

// The copy that decides must be the one with the complete author list, even
// when the truncated copy looks independent. Counting the truncated copy would
// promote a citation the complete list says is dependent.
const truncatedIndependent = {
  title: "Sialoglycan microarray encoding reveals differential sialoglycan binding of toxin subunits",
  cid: "c3",
  page: 3,
  status: "INDEPENDENT",
  author_source: "scholar-list (truncated)",
};
const completeDependent = {
  title: "Sialoglycan microarray encoding reveals differential sialoglycan binding of toxin subunits",
  cid: "d4",
  page: 3,
  status: "DEPENDENT",
  author_source: "scholar-cite-bibtex",
};
const pick = uniquePapers([truncatedIndependent, completeDependent]);
check(
  "duplicate: complete author list decides",
  pick.kept[0].status,
  "DEPENDENT"
);
check(
  "duplicate: a truncated copy never promotes a citation",
  tallyEntries([truncatedIndependent, completeDependent]).unique_independent,
  0
);

// A paper with no duplicate must report zero duplicates, so a reader can tell
// "collapsed" from "nothing to collapse".
check(
  "duplicate: no duplicates reported when there are none",
  tallyEntries([pubCopy, other]).duplicate_records,
  0
);

// Short or unparseable titles stay distinct rather than merging on a guess.
const bare1 = { title: "[CITATION]", cid: "x1", page: 1, status: "DEPENDENT" };
const bare2 = { title: "[CITATION]", cid: "x2", page: 2, status: "DEPENDENT" };
check(
  "duplicate: a bare title is not merged",
  uniquePapers([bare1, bare2]).kept.length,
  2
);

// Different papers must never merge.
check(
  "duplicate: distinct papers stay distinct",
  uniquePapers([pubCopy, other]).kept.length,
  2
);

// ---- Language editions ---------------------------------------------------
// Real data from 2026-10-31: Angewandte Chemie serves one article in English
// (10.1002/anie.7795967) and German (10.1002/ange.7795967) and Scholar lists
// both rows on a citing list, with different cids and different titles. Title
// matching cannot see this, so it needs its own rule.

const WILEY_AUTHORS =
  "Weber, Fabienne, Valenti, Aina, Ledvinka, Moscovitz, Oren, Seeberger, Peter H";
const editionEnglish = () => ({
  title: "Using Synthetic Glycans to Investigate Anti-Glycan Antibodies and Explore Their Medical Potential",
  cid: "_GJjgOnYMDMJ",
  page: 2,
  status: "INDEPENDENT",
  confirm_state: "confirmed",
  author_source: "scholar-cite-bibtex",
  authors_used: WILEY_AUTHORS,
  link: "https://onlinelibrary.wiley.com/doi/abs/10.1002/anie.7795967",
  language_flag: "",
});
const editionGerman = () => ({
  title: "Untersuchung von Anti-Glykan-Antikörpern und Erforschung ihres medizinischen Potenzials mithilfe synthetischer Glykane",
  cid: "GZHuXnSToewJ",
  page: 3,
  status: "INDEPENDENT",
  confirm_state: "unverified-coverage",
  author_source: "scholar-cite-bibtex",
  authors_used: WILEY_AUTHORS,
  link: "https://onlinelibrary.wiley.com/doi/abs/10.1002/ange.7795967",
  language_flag: "possible non-English (von, und, für, des)",
});

check("edition: article id ignores the journal code", doiArticleId("10.1002/ange.7795967"), "7795967");
check(
  "edition: both editions key to the same work",
  editionKey(editionEnglish()) === editionKey(editionGerman()) && editionKey(editionEnglish()) !== "",
  true
);

// Same page: the German copy is the edition, the English one stands for the work.
{
  const en = editionEnglish();
  const de = editionGerman();
  markLanguageEditions([en, de], new Map());
  check("edition: same page, English copy stands", en.duplicate_of, "");
  check("edition: same page, German copy defers", de.duplicate_of, "_GJjgOnYMDMJ");
  check("edition: note names the copy it duplicates", /_GJjgOnYMDMJ/.test(de.edition_note), true);
}

// The user's requirement: an edition must never be marked, even when the
// language screen missed it entirely -- a translation can carry an English title.
{
  const en = editionEnglish();
  const sneaky = editionGerman();
  sneaky.language_flag = "";
  sneaky.title = "Using Synthetic Glycans to Investigate Anti-Glycan Antibodies";
  check("edition: unflagged edition would be a candidate", isHighlightCandidate(sneaky), true);
  check("edition: candidate would be highlighted on its own", isHighlighted(sneaky), true);
  markLanguageEditions([en, sneaky], new Map());
  check("edition: after marking, the edition is not highlighted", isHighlighted(sneaky), false);
  check("edition: the English copy keeps its mark", isHighlighted(en), true);
}

// Cross-page, the order Scholar actually served: English on page 2, German on 3.
{
  const prior = new Map();
  const p2 = [editionEnglish()];
  markLanguageEditions(p2, prior);
  const p3 = [editionGerman()];
  markLanguageEditions(p3, prior);
  check("edition: cross-page English stays marked", p2[0].duplicate_of, "");
  check("edition: cross-page German defers", p3[0].duplicate_of, "_GJjgOnYMDMJ");
}

// Cross-page in the opposite order: the German copy is seen first and is
// correctly left unmarked, so the English copy on the later page must still be
// allowed its mark rather than being suppressed by an unmarked earlier row.
{
  const prior = new Map();
  const p1 = [editionGerman()];
  markLanguageEditions(p1, prior);
  const p2 = [editionEnglish()];
  markLanguageEditions(p2, prior);
  check("edition: earlier German is not marked", isHighlighted(p1[0]), false);
  check("edition: later English may still be marked", p2[0].duplicate_of, "");
  check("edition: later English is highlighted", isHighlighted(p2[0]), true);
}

// Counting: two rows, one marked independent.
{
  const en = editionEnglish();
  const de = editionGerman();
  markLanguageEditions([en, de], new Map());
  const t = tallyEntries([en, de]);
  check("edition: both rows still recorded", t.records, 2);
  check("edition: only one counted independent", t.independent, 1);
}

// An identical DOI is the ordinary duplicate-version case, not a language
// edition, so nothing is suppressed here.
{
  const a = { ...editionEnglish(), cid: "a1" };
  const b = { ...editionEnglish(), cid: "b2", page: 2 };
  markLanguageEditions([a, b], new Map());
  check("edition: identical DOI is not an edition", a.duplicate_of + b.duplicate_of, "");
}

// No DOI, or a journal-level DOI, or a different author list: no claim made.
check("edition: no DOI means no key", editionKey({ title: "x", link: "https://example.org/a" }), "");
check("edition: journal-level DOI is too coarse", editionKey({ ...editionEnglish(), link: "https://doi.org/10.1002/anie" }), "");
check(
  "edition: different authors are a different work",
  editionKey({ ...editionEnglish(), authors_used: "Someone Else, Another Person, Third Author" }) !==
    editionKey(editionEnglish()),
  true
);
{
  const lone = editionEnglish();
  markLanguageEditions([lone], new Map());
  check("edition: a lone row is never suppressed", lone.duplicate_of, "");
  check("edition: a lone row still records its key", lone.edition_key !== "", true);
}

console.log(
  fail === 0
    ? `\n${pass} passed, all good`
    : `\n${pass} passed, ${fail} FAILED`
);
process.exitCode = fail ? 1 : 0;

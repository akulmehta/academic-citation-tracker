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
  isNonEnglishIndependent,
  isReviewQueue,
  isWithheldForLanguage,
  isSettled,
  isUserDecided,
  USER_DECIDED,
  paperKey,
  doiArticleId,
  editionKey,
  markLanguageEditions,
  foldSameWork,
  markSecondaryCopies,
  recordInheritance,
  inheritedFrom,
  effectiveStatus,
  standingSet,
  bucketOf,
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

// A decision a person made by reading the published article is itself evidence,
// so it settles a row the way an external author list does. It has its own
// confirm_state rather than reusing "confirmed" so a filing figure can state how
// much of a total rests on a human reading. tools/apply-decision.js writes it.
const decided = { status: "INDEPENDENT", confirm_state: USER_DECIDED };
check("decided: a human decision settles the row", isHighlighted(decided), true);
check("decided: predicate recognises it", isUserDecided(decided), true);
check("decided: isSettled covers all three states", isSettled(decided), true);
check(
  "decided: a DEPENDENT decision is settled but not counted",
  isHighlighted({ status: "DEPENDENT", confirm_state: USER_DECIDED }),
  false,
);
// The language screen is not overridable by a decision. Per the 2026-11-01
// decision no certified translation exists, so classifying a non-English row as
// independent must not make it count.
check(
  "decided: a decision does NOT defeat the language screen",
  isHighlighted({ ...decided, language_flag: "non-latin script" }),
  false,
);
check(
  "decided: a withheld-for-language row can be a decided one",
  isWithheldForLanguage({ ...decided, language_flag: "cyrillic" }),
  true,
);
check(
  "decided: a decision on a truncated byline still counts",
  isHighlighted({ ...decided, author_source: "bibtex (truncated)" }),
  true,
);

// An independent-looking entry that is not yet countable has to stay visible as
// open, otherwise a pending item silently disappears from the totals.
check("pending: unresolved corroboration is pending", isIndependentPending({ status: "INDEPENDENT", confirm_state: "unresolved" }), true);
// Per the user's instruction on 2026-11-03 the language screen SUPERSEDES the
// independence classification: a non-English row is reported as non-English, not
// as unsettled independent work. With no certified translations being obtained no
// reading of its byline can change the packet, so it is a closed matter. Before
// this rule all 45 non-English independent rows appeared as 45 open questions.
check(
  "pending: non-English independent is NOT pending -- language supersedes",
  isIndependentPending({ status: "INDEPENDENT", language_flag: "x" }),
  false
);
check(
  "pending: a non-English row is reported as non-English independent instead",
  isNonEnglishIndependent({ status: "INDEPENDENT", language_flag: "x" }),
  true
);
check(
  "pending: an English row is not non-English independent",
  isNonEnglishIndependent(confirmed),
  false
);
check("pending: counted entry is not pending", isIndependentPending(confirmed), false);
check("pending: a DEPENDENT entry is decided, not pending", isIndependentPending(dependent), false);

// A look-up that never completed is NOT a settling state. Throttled OpenAlex
// requests used to be recorded as "nothing indexes it", which is
// unverified-coverage -- a basis for counting. capture-citations.js files that
// outcome as lookup-failed instead, so a rate limit cannot manufacture evidence.
check("lookup-failed: does not settle a row", isSettled({ status: "INDEPENDENT", confirm_state: "lookup-failed" }), false);
check(
  "lookup-failed: an independent row stays pending, not counted",
  [isHighlighted({ status: "INDEPENDENT", confirm_state: "lookup-failed" }),
   isIndependentPending({ status: "INDEPENDENT", confirm_state: "lookup-failed" })],
  [false, true]
);

// ---- The review queue ----------------------------------------------------
// The user's instruction of 2026-11-03: a non-English entry is not on the review
// queue, only on the Non-English page. The reasoning is that the queue is the
// list of rows where reading the published byline settles something, and with no
// certified translations being obtained no reading of a non-English row can
// change the packet -- apply-decision.js says so rather than recording a
// decision that moves nothing. The rule lives in one predicate; v_review,
// v_pub_stats, the ledger, the review sheet and the dashboard all mirror it, so
// pinning it here pins the queue length everywhere.
const langReview = { ...unresolved, language_flag: "cyrillic" };
check("queue: an open English row is queued", isReviewQueue(unresolved), true);
check("queue: a contradicted row is queued", isReviewQueue(contradicted), true);
check("queue: a non-English row is NOT queued", isReviewQueue(langReview), false);
check("queue: a counted row is not queued", isReviewQueue(confirmed), false);
check(
  "queue: a non-English row is not queued even once decided",
  isReviewQueue({ status: "REVIEW", confirm_state: USER_DECIDED, language_flag: "cyrillic" }),
  false
);

// The queue figures reported alongside the raw status count. Both are published
// because status is a partition that has to keep summing to records, while the
// queue is the number of rows a person opens.
const queueTally = tallyEntries([
  unresolved,
  contradicted,
  langReview,
  { ...confirmed, language_flag: "cyrillic" },
  dependent,
]);
check("queue tally: raw review counts every REVIEW row", queueTally.review, 3);
check("queue tally: queued excludes the non-English one", queueTally.review_queue, 2);
check("queue tally: the excluded rows are counted", queueTally.review_non_english, 1);
check(
  "queue tally: queued plus excluded equals raw review",
  queueTally.review_queue + queueTally.review_non_english,
  queueTally.review
);
check(
  "queue tally: status partition still sums to records",
  queueTally.independent +
    queueTally.independent_pending +
    queueTally.non_english_independent +
    queueTally.dependent +
    queueTally.self_pi +
    queueTally.self_former_pi +
    queueTally.review,
  queueTally.records
);

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
// The non-English row in this set is no longer counted as unsettled work, so the
// only pending row is the English one whose corroboration is unresolved.
check("tally: pending independent", t.independent_pending, 1);
check(
  "tally: the non-English independent row is named in its own bucket",
  t.non_english_independent,
  1
);
check("tally: dependent", t.dependent, 1);
check("tally: self PI", t.self_pi, 1);
check("tally: self former PI", t.self_former_pi, 1);
check("tally: review", t.review, 1);
check("tally: non-English", t.non_english, 1);

// The three bases must account for every counted row, or a figure in the packet
// has an unexplained origin. A decided row is reported separately rather than
// folded into "externally confirmed".
const decidedSet = tallyEntries([
  decided,
  { ...decided, status: "DEPENDENT" },
  confirmed,
  coverage,
]);
check("tally: decided rows counted", decidedSet.independent, 3);
check("tally: decided split", decidedSet.independent_user_decided, 1);
check(
  "tally: the three bases sum to the counted total",
  decidedSet.independent_confirmed +
    decidedSet.independent_coverage +
    decidedSet.independent_user_decided,
  decidedSet.independent,
);
check(
  "tally: no basis invented for an unsettled set",
  tallyEntries([unresolved]).independent_user_decided,
  0,
);

// Every record must land in exactly one bucket, or the ledger hides evidence.
// The non_english_independent term was added on 2026-11-03, when a non-English
// row stopped being reported as unsettled independent work: the status partition
// still has to sum to records, so the rows it moved out of need a named bucket.
check(
  "tally: countable plus pending plus non-English independent plus the rest equals all records",
  t.independent +
    t.independent_pending +
    t.non_english_independent +
    t.dependent +
    t.self_pi +
    t.self_former_pi +
    t.review,
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

// Scholar's bracketed link-type marker is part of its rendering, not the title,
// so a row labelled "[CITATION] Some Title" must merge with the same work listed
// plainly. Measured over the filed set on 2026-11-02 this merges exactly two
// same-list pairs and nothing else.
check(
  "marker: a [CITATION] copy keys to its plain twin",
  paperKey({ title: "[CITATION] Lignin composites with sustained oxygenation" }) ===
    paperKey({ title: "Lignin composites with sustained oxygenation" }),
  true
);
check(
  "marker: [BOOK] and [TXT] are stripped too",
  paperKey({ title: "[BOOK] Glycans in immunology" }) ===
    paperKey({ title: "Glycans in immunology" }) &&
    paperKey({ title: "[TXT] Glycans in immunology" }) ===
      paperKey({ title: "Glycans in immunology" }),
  true
);
// A chemistry title's own brackets are the compound name, not a Scholar marker,
// and must survive. Stripping them would corrupt a cited title in a filing.
check(
  "marker: a chemistry bracket in the title is preserved",
  paperKey({ title: "Synthesis of Benzopyrano[4,3-e][1,2,4]triazolo derivatives" }) !==
    paperKey({ title: "Synthesis of Benzopyrano derivatives" }),
  true
);
check(
  "marker: a bracket mid-title is not a marker",
  paperKey({ title: "Binding of [CITATION] tagged ligands to galectin-1" }) !==
    paperKey({ title: "Binding of tagged ligands to galectin-1" }),
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

// But a decision made by a person who read the published article outranks a
// machine reading, even a complete one. That is the whole point of the review
// queue: the rows there are the ones no author list could settle, so the human
// answer must be the one that stands for the paper. If this ever inverts, a
// decision applied through tools/apply-decision.js would silently do nothing
// whenever the same paper appears twice on a citing list.
const truncatedButDecided = {
  ...truncatedIndependent,
  cid: "e5",
  status: "INDEPENDENT",
  confirm_state: USER_DECIDED,
  author_source: "scholar-list (truncated)",
};
const decidedPick = uniquePapers([completeDependent, truncatedButDecided]);
check(
  "duplicate: a human decision stands for the paper",
  decidedPick.kept[0].confirm_state,
  USER_DECIDED
);
check(
  "duplicate: a decision does not count a paper the complete list rejects",
  tallyEntries(decidedPick.kept).unique_independent,
  1
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
  title: "Untersuchung von Anti-Glykan-AntikÃ¶rpern und Erforschung ihres medizinischen Potenzials mithilfe synthetischer Glykane",
  cid: "GZHuXnSToewJ",
  page: 3,
  status: "INDEPENDENT",
  confirm_state: "unverified-coverage",
  author_source: "scholar-cite-bibtex",
  authors_used: WILEY_AUTHORS,
  link: "https://onlinelibrary.wiley.com/doi/abs/10.1002/ange.7795967",
  language_flag: "possible non-English (von, und, fÃ¼r, des)",
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

// ---- Same-work folds recorded by a person --------------------------------
// The lignin case of 2026-11-02: a bioRxiv preprint and its published Acta
// Biomaterialia article have DIFFERENT titles, so paperKey never merges them,
// and the published paper was already on the list as its own row. A person
// proved the identity from the DOI chain plus the byline and recorded it with
// tools/apply-decision.js --same-work-as. foldSameWork is what turns that record
// into a row that does not count twice.
const swPreprint = {
  title: "Lignin Composites with Sustained Oxygenation and Reactive Oxygen Species-Scavenging",
  cid: "pre1",
  page: 2,
  status: "INDEPENDENT",
  confirm_state: "confirmed",
  same_work_key: "sw:actbio-2025",
};
const swCitation = {
  title: "[CITATION] Lignin Composites with Sustained Oxygenation",
  cid: "pre2",
  page: 3,
  status: "INDEPENDENT",
  confirm_state: "confirmed",
  same_work_key: "sw:actbio-2025",
};
const swPublished = {
  title: "Oxygen-releasing lignin composites for diabetic wound healing",
  cid: "pub9",
  page: 1,
  status: "INDEPENDENT",
  confirm_state: "confirmed",
  duplicate_of: "",
};
{
  const rows = [swPreprint, swCitation, swPublished];
  foldSameWork(rows);
  check("same-work: one copy of the folded pair stands", swPreprint.duplicate_of, "");
  check("same-work: the other defers to it", swCitation.duplicate_of, "pre1");
  check("same-work: the fold names its kind", swCitation.duplicate_kind, "same-work");
  check("same-work: a row outside the fold is untouched", swPublished.duplicate_of, "");
  check(
    "same-work: the folded copy is not counted",
    isHighlighted(swCitation),
    false
  );
  check("same-work: the standing copy still counts", isHighlighted(swPreprint), true);
}
// A fold needs at least two rows carrying the key. A single row with a key is a
// claim about one row and proves nothing, so nothing is folded and nothing is
// lost.
{
  const only = { ...swPreprint, duplicate_of: "" };
  foldSameWork([only]);
  check("same-work: a lone keyed row is not folded", only.duplicate_of, "");
}
// A row the language rule already folded stays folded by that rule: the language
// determination came from a DOI plus an author list and is the more specific
// claim, and duplicate_kind must not be rewritten to the weaker one. Uses the
// real Angewandte pair, whose two DOIs are what make it a language edition.
{
  const english = editionEnglish();
  const german = editionGerman();
  english.same_work_key = "sw:x";
  german.same_work_key = "sw:x";
  markLanguageEditions([english, german], new Map());
  const kindBefore = german.duplicate_kind;
  const standsBefore = german.duplicate_of;
  check("same-work: the language rule folded it first", kindBefore, "language-edition");
  foldSameWork([english, german]);
  check("same-work: the language rule keeps its kind", german.duplicate_kind, kindBefore);
  check("same-work: a language-folded row keeps its pointer", german.duplicate_of, standsBefore);
  check("same-work: the English copy still counts", isHighlighted(english), true);
}
// uniquePapers groups on same_work_key when there is one, so a differently-titled
// preprint and its published article count as one paper -- and when there is
// none, they count as two. Say which basis a figure is on rather than implying
// the packet proved they are one work.
{
  const a = { ...swPreprint, duplicate_of: "" };
  const b = { ...swCitation, duplicate_of: "" };
  check(
    "same-work: keyed rows collapse to one paper",
    tallyEntries([a, b]).unique_records,
    1
  );
  const unkeyedA = { ...a, same_work_key: "" };
  const unkeyedB = { ...b, same_work_key: "" };
  check(
    "same-work: without a key the two titles are two papers",
    tallyEntries([unkeyedA, unkeyedB]).unique_records,
    2
  );
}

// ---- Which copy of a duplicated paper carries the decision ----------------
// copyReliability is private, and it should stay that way -- its only effect on
// the packet is through uniquePapers, so that is what is tested here. The rule
// that must not regress: a DEMONSTRATED shared author outranks a clean but blind
// read, and a person's reading outranks both.
//
// The real case (2026-11-03): VCU dissertation 2956 appears on one citing list
// as "AM Abdel" (scholarscompass.vcu.edu) and as "[BOOK] ... MHA Aziz"
// (ProQuest). The VCU record's advisor is the former PI, so it is a Desai-group
// self-citation. Both Scholar bylines are untruncated, so completeness tied, and
// the copy that matched nobody was winning on its confirmation alone -- which
// was counting a self-citation.
console.log("\ncopyReliability: a demonstrated match beats a cleaner read");
{
  const title =
    "Kinetic and Thermodynamic Studies of Thrombin Inhibitors Using Immobilized Enzyme";
  // The ProQuest copy: untruncated, confirmed, and it matched nobody.
  const cleanRead = {
    title,
    page: 3,
    cid: "azizProquest",
    status: "DEPENDENT",
    confirm_state: "confirmed",
    author_source: "scholar-snippet",
    authors: "MHA Aziz, X Someone - ProQuest, 2013",
    truncated: false,
    matched_authors: [],
  };
  // The VCU copy: same completeness, no external confirmation, but its byline
  // names the former PI, which is the actual evidence.
  const showsOverlap = {
    title,
    page: 3,
    cid: "abdelVcu",
    status: "SELF (FORMER PI)",
    confirm_state: "unresolved",
    author_source: "scholar-snippet",
    authors: "AM Abdel - scholarscompass.vcu.edu, 2013",
    truncated: false,
    matched_former_pi: ["UR Desai"],
  };
  const { kept, merged } = uniquePapers([cleanRead, showsOverlap]);
  check("copy: the overlapping copy stands", kept.length, 1);
  check("copy: it is the one naming the former PI", kept[0].cid, "abdelVcu");
  check("copy: the pair is reported as merged", merged.length, 1);

  // The inverse must hold too: a match the row did NOT conclude on is not
  // evidence. matched_authors can survive a later re-apply that discarded the
  // external record it came from, so a row saying INDEPENDENT while carrying a
  // leftover match must not be scored as though it had proved an overlap.
  // Tested as a tie in both orders: if the field were worth anything, the row
  // carrying it would win whichever position it was passed in.
  const leftover = {
    ...showsOverlap,
    cid: "leftoverMatch",
    status: "INDEPENDENT",
    confirm_state: "confirmed",
  };
  const noMatch = { ...leftover, cid: "noMatch", matched_former_pi: [] };
  const forward = uniquePapers([noMatch, leftover]);
  const reverse = uniquePapers([leftover, noMatch]);
  check(
    "copy: a leftover match adds nothing (order 1)",
    forward.kept[0].cid,
    "noMatch"
  );
  check(
    "copy: a leftover match adds nothing (order 2)",
    reverse.kept[0].cid,
    "leftoverMatch"
  );

  // A person's reading of the published article outranks a machine match: the
  // instructions are explicit that it is its own basis.
  const decided = {
    ...cleanRead,
    cid: "humanRead",
    confirm_state: "user-decided",
  };
  const third = uniquePapers([decided, showsOverlap]);
  check("copy: a human reading outranks the machine match", third.kept[0].cid, "humanRead");
}

// ---- The five reviewer-facing categories ------------------------------------
// The dashboard draws exactly five buckets and a reviewer adds them up by eye,
// so the partition must be exhaustive and mutually exclusive for ANY row, not
// merely for the ones that happen to exist today. bucketOf is tested directly
// because the property that matters is "one row, one bucket" -- a row that fell
// through every branch would silently shrink a chart rather than fail a build.
console.log("\nbucketOf: five categories, exhaustive and exclusive");
{
  const ind = {
    title: "A genuinely independent citing paper",
    cid: "b1",
    status: "INDEPENDENT",
    confirm_state: "confirmed",
  };
  check("bucket: settled independent", bucketOf(ind), "independent");
  check(
    "bucket: dependent",
    bucketOf({ ...ind, cid: "b2", status: "DEPENDENT", confirm_state: "unresolved" }),
    "dependent"
  );
  // Self-citations collapse into dependent at the display layer (user,
  // 2026-11-03) but keep their own status underneath, so the split stays
  // recoverable from the store.
  check(
    "bucket: self (PI) folds into dependent",
    bucketOf({ ...ind, cid: "b3", status: "SELF (PI)" }),
    "dependent"
  );
  check(
    "bucket: self (former PI) folds into dependent",
    bucketOf({ ...ind, cid: "b4", status: "SELF (FORMER PI)" }),
    "dependent"
  );
  check(
    "bucket: on the queue",
    bucketOf({ ...ind, cid: "b5", status: "REVIEW", confirm_state: "unresolved" }),
    "review"
  );
  check(
    "bucket: a second copy of a counted work",
    bucketOf({ ...ind, cid: "b6", is_secondary_copy: true }),
    "preprint_copy"
  );
  // A language edition is a secondary copy too, but the language screen
  // supersedes it (2026-11-03) so it is reported once, as non-English.
  check(
    "bucket: language beats being a copy",
    bucketOf({ ...ind, cid: "b7", is_secondary_copy: true, language_flag: "possible non-English (und)" }),
    "non_english"
  );
  check(
    "bucket: language beats independent",
    bucketOf({ ...ind, cid: "b8", language_flag: "possible non-English (und)" }),
    "non_english"
  );
  // A queued row is reported on the queue even when it is also a copy, so the
  // bucket keeps matching the length of the sheet a reviewer works. Moving this
  // test below the copy rule would silently shorten that sheet.
  check(
    "bucket: review beats being a copy",
    bucketOf({
      ...ind,
      cid: "b9",
      status: "REVIEW",
      confirm_state: "unresolved",
      is_secondary_copy: true,
    }),
    "review"
  );
  // Independent-looking but unsettled: not countable, not a copy, not on the
  // queue. It gets its own bucket so the sum still closes, and the chart draws
  // it only when it is non-zero.
  check(
    "bucket: independent but unsettled",
    bucketOf({ ...ind, cid: "b10", confirm_state: "unresolved" }),
    "pending"
  );
  // A status nothing recognises must surface as `other`, not disappear.
  check(
    "bucket: an unrecognised status surfaces",
    bucketOf({ ...ind, cid: "b11", status: "SOMETHING NEW" }),
    "other"
  );
}

// The bucket counts published by tallyEntries must sum to the record count, and
// must agree with bucketOf row by row -- the ledger and the charts both read the
// counts, so a drift between the two is a packet with two totals for one bucket.
console.log("\nbucketOf: the published counts sum to the records");
{
  const rows = [
    { title: "One independent work on glycan arrays", cid: "s1", status: "INDEPENDENT", confirm_state: "confirmed" },
    { title: "One dependent work", cid: "s2", status: "DEPENDENT", confirm_state: "unresolved" },
    { title: "One self work", cid: "s3", status: "SELF (FORMER PI)", confirm_state: "unresolved" },
    { title: "One queued work", cid: "s4", status: "REVIEW", confirm_state: "unresolved" },
    { title: "One non-English work", cid: "s5", status: "INDEPENDENT", confirm_state: "confirmed", language_flag: "possible non-English (pl)" },
    { title: "A preprint of the first work", cid: "s6", status: "INDEPENDENT", confirm_state: "confirmed" },
  ];
  // The preprint shares the first row's title, so the machine rule makes it the
  // second copy -- which is what markSecondaryCopies has to record on the row.
  // The title has to clear paperKey's 24-character floor to be treated as an
  // identity at all, which is exactly why the short ones above stay distinct.
  rows[5].title = rows[0].title;
  markSecondaryCopies(rows);
  check("copies: the preprint is marked secondary", rows[5].is_secondary_copy, true);
  check("copies: the copy that stands is not", rows[0].is_secondary_copy, false);
  const t = tallyEntries(rows);
  const sum =
    t.bucket_independent +
    t.bucket_dependent +
    t.bucket_review +
    t.bucket_non_english +
    t.bucket_preprint_copy +
    t.bucket_pending +
    t.bucket_other;
  check("buckets: sum to the record count", sum, t.records);
  check("buckets: the preprint bucket holds the copy", t.bucket_preprint_copy, 1);
  check("buckets: the standing copy still counts", t.bucket_independent, 1);
  check("buckets: dependent includes self", t.bucket_dependent, 2);
  check("buckets: one row on the queue", t.bucket_review, 1);
  check("buckets: one non-English row", t.bucket_non_english, 1);
  check("buckets: nothing fell through", t.bucket_other, 0);
  // The whole point of the bucket: the exhibit marks both copies, because that is
  // the Scholar page that was printed, while the category claims the work once.
  // The gap between the two figures IS the copy count, and must be visible rather
  // than reconciled by silently dropping a mark.
  check("buckets: both copies are still marked on the exhibit", t.independent, 2);
  check("buckets: the exhibit marks exceed the counted works by the copies", t.independent - t.bucket_independent, t.bucket_preprint_copy);
}

// ---- Inheritance from the copy that stands -------------------------------
//
// The user's instruction of 2026-11-03: a duplicate reports the classification of
// the copy that stands for its work, and is shown as a copy rather than as open
// queue work. Two things must stay true while it does, and both are pinned here.
//
//   1. `status` is never overwritten. A report's status is what was concluded from
//      that row's own author list -- the provenance the packet is built on.
//   2. No exhibit mark moves. copyReliability ranks a human verdict above any
//      machine reading, so a verdict written onto a copy would make the copy stand
//      and relocate the highlight. Inheritance is a read-only view, so it cannot.
//
// Titles must clear paperKey's 24-character floor to count as an identity, or
// every fixture below would collapse into one work group.
{
  const PARENT = "Allosteric inhibition of coagulation factor XIa by a peptide"
    .slice(0, 40);
  const parent = {
    row_uid: "cit-000108",
    title: PARENT,
    cid: "p1",
    status: "INDEPENDENT",
    confirm_state: "confirmed",
  };
  const copy = {
    row_uid: "cit-000132",
    title: PARENT,
    cid: "p2",
    status: "REVIEW",
    confirm_state: "unresolved",
  };
  const set = standingSet([parent, copy]);

  check("inherit: a copy of a settled work inherits its verdict", inheritedFrom(copy, set).status, "INDEPENDENT");
  check("inherit: the basis is inherited too", inheritedFrom(copy, set).confirm_state, "confirmed");
  check("inherit: the parent row is named", inheritedFrom(copy, set).row_uid, "cit-000108");
  check("inherit: the standing copy inherits nothing", inheritedFrom(parent, set), null);
  check(
    "inherit: status is never rewritten by the view",
    [copy.status, copy.confirm_state],
    ["REVIEW", "unresolved"]
  );
  check("inherit: effective status reads through to the parent", effectiveStatus(copy, set), "INDEPENDENT");
  check("inherit: effective status of a standing row is its own", effectiveStatus(parent, set), "INDEPENDENT");

  // The consequence the user asked for: the copy leaves the queue, and it is
  // reported as a copy rather than as a fifth category of open work.
  check("inherit: the copy leaves the review queue", isReviewQueue(copy, set), false);
  check("inherit: the standing copy is still counted", bucketOf(parent, set), "independent");
  check("inherit: the copy is bucketed as a copy", bucketOf(copy, set), "preprint_copy");

  // A copy with nothing to inherit from stays queued. A patent family folds on
  // title under paperKey while the standing copy is itself unresolved, so reading
  // the byline is still the only way to settle it -- the queue must keep it.
  const PATER = "Dual anticoagulant and antiplatelet agent composition and method";
  const openParent = { row_uid: "cit-000467", title: PATER, cid: "q1", status: "REVIEW", confirm_state: "unresolved" };
  const openCopy = { row_uid: "cit-000473", title: PATER, cid: "q2", status: "REVIEW", confirm_state: "unresolved" };
  const openSet = standingSet([openParent, openCopy]);
  check("inherit: an unsettled parent offers nothing", inheritedFrom(openCopy, openSet), null);
  check("inherit: such a copy stays on the queue", isReviewQueue(openCopy, openSet), true);
  check("inherit: and is bucketed as review work", bucketOf(openCopy, openSet), "review");

  // A non-English parent settles nothing: its own classification is superseded by
  // the language screen and excluded from the packet, so an English copy of it
  // must not inherit its way off the queue from a citation nobody counts.
  const langParent = {
    row_uid: "cit-000990",
    title: PARENT,
    cid: "p0",
    status: "INDEPENDENT",
    confirm_state: "confirmed",
    language_flag: "german",
  };
  const langSet = standingSet([langParent, copy]);
  check("inherit: a non-English parent is not a basis", inheritedFrom(copy, langSet), null);
  check("inherit: so the English copy stays queued", isReviewQueue(copy, langSet), true);

  // A row answers from its own columns when there is no standing Set -- which is
  // how the store projects the same rule in SQL. Emptiness means "nothing to
  // inherit", so an absent column must not be read as a settled copy.
  check(
    "inherit: recorded columns answer without a set",
    [
      isReviewQueue({ ...copy, inherited_status: "INDEPENDENT" }),
      isReviewQueue({ ...copy, inherited_status: "" }),
      isReviewQueue({ ...copy }),
    ],
    [false, true, true]
  );
  check(
    "inherit: a language-flagged row never inherits",
    inheritedFrom({ ...copy, language_flag: "cyrillic", inherited_status: "INDEPENDENT" }),
    null
  );

  // recordInheritance is what build-catalog writes, so the columns the store
  // mirrors have to be exactly what the live rule concluded.
  const recorded = recordInheritance([parent, copy, openParent, openCopy]);
  check("record: the copy gains the parent's status", recorded[1].inherited_status, "INDEPENDENT");
  check("record: and names the parent row", recorded[1].inherited_from, "cit-000108");
  check("record: the standing row stays empty", recorded[0].inherited_status, "");
  check("record: an unsettled group stays empty", recorded[3].inherited_status, "");

  // The ledger footnote that explains the queue gap. Without review_inherited it
  // blamed every row that left the queue on the language screen, which is how two
  // inherited copies were reported as non-English on 2026-11-03.
  const gapTally = tallyEntries([parent, copy, openParent, openCopy, langReview]);
  // Two of the four REVIEW rows stay queued: the unsettled patent copy and its
  // own standing sibling. Only the copy of a settled work leaves.
  check("inherit tally: two rows stay queued", gapTally.review_queue, 2);
  check("inherit tally: one left as non-English", gapTally.review_non_english, 1);
  check("inherit tally: one left as an inherited copy", gapTally.review_inherited, 1);
  check(
    "inherit tally: the named reasons explain the whole gap",
    gapTally.review - gapTally.review_queue,
    gapTally.review_non_english + gapTally.review_inherited
  );
}

console.log(
  fail === 0
    ? `\n${pass} passed, all good`
    : `\n${pass} passed, ${fail} FAILED`
);
process.exitCode = fail ? 1 : 0;

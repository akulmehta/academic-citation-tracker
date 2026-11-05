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
const { stripScholarMarker } = require("./scholar-marker");

// The confirm_state a row carries when a person settled it rather than a rule.
// The whole point of the review queue is that some rows cannot be settled by
// Scholar plus PubMed plus OpenAlex, and the user's answer IS the evidence - so
// it needs a basis of its own, distinct from "confirmed" (an external record
// agrees) and "unverified-coverage" (nothing indexes it). Naming it separately
// keeps a human verdict traceable in every figure and lets it be reversed.
const USER_DECIDED = "user-decided";

// Whether this row's classification came from a person. The verdict itself lives
// in `status`; this says where the settle came from.
function isUserDecided(e) {
  return e.confirm_state === USER_DECIDED;
}

// A row is settled for counting when an external record agrees, when Scholar's
// own list is complete and nothing contradicts it, or when a person decided it.
function isSettled(e) {
  return (
    e.confirm_state === "confirmed" ||
    e.confirm_state === "unverified-coverage" ||
    e.confirm_state === USER_DECIDED
  );
}

// An entry counts toward the independent total only when it is classified
// independent, corroborated or covered by a complete Scholar list, not held
// back as possibly non-English, and not a language edition of another row on
// the same citing list. Per the user's instruction on 2026-10-31 a language
// edition is never marked in an exhibit even if the language screen missed it:
// publisher translations carry the same author list and a near-identical DOI
// (10.1002/anie.7795967 vs 10.1002/ange.7795967), so markLanguageEditions sets
// duplicate_of on the copy that does not stand for the work and that alone is
// enough to withhold the mark.
//
// A human decision is accepted as a basis but does NOT override the language
// screen: the 2026-11-01 decision is that no certified translations are being
// obtained, so a non-English row cannot count however it was classified. The
// guide's requirement is a translation, not an opinion about independence, and
// tools/apply-decision.js says so out loud rather than silently dropping it.
//
// A row that does not STAND for its work is not marked either (user decision,
// 2026-11-05: "I have decided to keep this new color but not to highlight these
// Preprint/copy entries in my pdfs. Please remove the highlights from these
// entries"). Until then the exhibit yellow and the packet total disagreed by
// design -- 1094 marks against 1077 counted citations -- and the difference was
// explained in prose. It is now zero: one row, one mark, and the mark means
// "this row is the listing we count".
//
// Standing-ness is read off the row rather than recomputed, for two reasons.
// Recomputing it needs the whole citing list, which the reprint and the audit do
// have but the store cannot re-derive in SQL; and `uniquePapers` consults
// copyReliability, which consults this function -- so a live call here would be
// circular. The row carries the answer instead:
//
//   is_primary_copy   written by build-catalog.applyPrimaryCopy, the store's
//                     spelling of "this row stands for its work"
//   is_secondary_copy written by markSecondaryCopies on the groupReports path
//
// Both are tested through `doesNotStand`, so a caller holding a bare report
// entry (no standing decision recorded at all) still gets the old, correct
// answer rather than an unmarked page. See that function for why an absent
// field must NOT be read as "does not stand".
function isHighlighted(e) {
  return (
    e.status === "INDEPENDENT" &&
    isSettled(e) &&
    !e.language_flag &&
    !e.duplicate_of &&
    !doesNotStand(e)
  );
}

// Whether a row is recorded as a copy that does not stand for its work.
//
// An ABSENT flag means no decision was recorded, which is not the same as a
// decision that the row does not stand. This distinction is load-bearing: the
// filed report JSON carries no `is_secondary_copy` at all (measured 2026-11-05
// across all 171 report files -- zero entries have the field), because
// markSecondaryCopies runs after a report is written and the capture's own
// per-page call cannot see the citing list. Treating `undefined` as falsy-in-the-
// other-direction would unmark every row on a report-driven path.
//
// So only an explicit true counts, and only for the field a caller in this
// position would have had set. A store row always carries is_primary_copy (0 or
// 1, never null); a report entry never carries is_secondary_copy unless a rebuild
// wrote one.
function doesNotStand(e) {
  if (e.is_secondary_copy === true) return true;
  if (e.is_primary_copy === undefined || e.is_primary_copy === null) return false;
  return Number(e.is_primary_copy) === 0;
}

// Whether a row would be marked on its own merits, ignoring the duplicate
// decision. Used to pick which copy of a language edition earns the mark.
function isHighlightCandidate(e) {
  return (
    e.status === "INDEPENDENT" &&
    isSettled(e) &&
    !e.language_flag
  );
}

// Whether a row belongs on the review queue -- the list a person works through
// to settle an author list. Per the user's instruction on 2026-11-03 a
// non-English row is NOT on it, even when its status is REVIEW.
//
// The queue exists because a reading of the published byline can settle a row.
// For a non-English entry no reading settles anything: the 2026-11-01 decision
// is that no certified translations are being obtained, so the row is excluded
// whatever it says, and apply-decision.js refuses to let a decision on one reach
// the totals. A row that cannot change a figure does not belong in a work queue;
// it belongs on the Non-English page, which states the closed decision.
//
// This is the single definition. v_review, v_pub_stats, the ledger's
// awaiting_review, the review sheet and the dashboard all read it from here (or
// mirror its one condition), so the queue length cannot mean different things in
// different places -- the class of disagreement the reconciliation gates exist to
// catch.
//
// The count this removes is not lost: tallyEntries reports it alongside as
// review_non_english, and those rows remain in v_non_english.
//
// A second copy of a work whose standing copy is already settled is NOT on it
// either (user instruction, 2026-11-03 -- see inheritedFrom). Its own byline may
// be unresolved, but the work has an answer, so the row is reported as a copy and
// not as open work. A copy with nothing to inherit from stays queued.
//
// `secondary` is optional and works exactly as in isSecondaryCopy: pass the
// standing set for a live group, or omit it and the answer comes from the
// inherited_* columns a rebuild recorded, so the store and the rule agree.
function isReviewQueue(e, secondary) {
  if (e.status !== "REVIEW" || e.language_flag) return false;
  return inheritedFrom(e, secondary) === null;
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
    isSettled(e) &&
    !e.duplicate_of
  );
}

// A row the language screen supersedes: classified INDEPENDENT but flagged
// non-English. Per the user's instruction on 2026-11-03 this is where such a row
// is reported, in place of independent_pending.
//
// It exists for two reasons. Substantively, it names what the packet is giving up:
// these are citations that look independent on the author comparison and are
// excluded purely because no certified translation exists. Mechanically, the
// status partition in tallyEntries and the ledger's arithmetic gate must still sum
// to `records`, so rows that leave the unsettled bucket need a bucket of their
// own. Note this is deliberately NOT the same set as `non_english_withheld`: that
// one additionally requires a settled basis and excludes second-language copies,
// because it answers "what would a translator reclaim".
function isNonEnglishIndependent(e) {
  return e.status === "INDEPENDENT" && Boolean(e.language_flag);
}

// Mark the copies that do not stand for their work.
//
// `uniquePapers` already answers "which copy of this work counts" -- it is what
// produces the distinct-paper figure -- but it answers it by returning a subset,
// so a reader holding ONE row cannot see that it is the second copy of a paper
// counted elsewhere. This writes that answer onto the rows.
//
// It matters because the exhibit and the count legitimately disagree: Google
// Scholar lists one paper twice (a journal record and its bioRxiv, repository,
// academia.edu, ProQuest or Ovid copy), the exhibit must show both rows because
// that is the page that was printed, and the counted figure must credit the work
// once. Without a flag on the row the gap between 1077 marks and 1059 distinct
// independent works is invisible, and a reviewer with the PDF in one hand and the
// summary in the other has no way to reconcile them.
//
// Only the machine rule is covered here. A row folded by the language rule or by
// a proven same-work claim already carries `duplicate_of`, set earlier in
// groupReports, and is a secondary copy too -- `isHighlighted` refuses both for
// the same reason.
function markSecondaryCopies(entries) {
  const { kept } = uniquePapers(entries);
  const stands = new Set(kept);
  for (const e of entries) {
    e.is_secondary_copy = !stands.has(e) ? true : e.is_secondary_copy || false;
  }
  return recordInheritance(entries, stands);
}

// Record the classification each row inherits from the copy that stands for its
// work, so a reader holding ONE row can see it (user instruction, 2026-11-03).
//
// Written as three plain fields rather than as a live lookup for one reason: the
// answer must survive being read out of the store, where there is no standing Set
// to consult. `inherited_status` being non-empty IS the fact -- a REVIEW row with
// a value there is a settled copy, not open work -- so isReviewQueue and bucketOf
// can answer from the row alone and the store's SQL can mirror them with one
// column test instead of re-deriving the standing set in SQL.
//
// `row_uid` is a store column, so a report entry has none and `inherited_from`
// stays empty on the report path. build-catalog.js resolves it to the parent's
// row_uid after the rows are written; it is provenance for a listing to display,
// never part of the rule.
function recordInheritance(entries, stands) {
  const set = stands instanceof Set ? stands : standingSet(entries);
  for (const e of entries) {
    const p = inheritedFrom(e, set);
    e.inherited_status = p ? p.status || "" : "";
    e.inherited_confirm_state = p ? p.confirm_state || "" : "";
    e.inherited_from = p ? p.row_uid || "" : "";
  }
  return entries;
}

// Which rows of a group STAND for their work, one per duplicate group.
//
// A Set rather than a filtered array, so a caller can ask "does this row stand?"
// by identity. uniquePapers returns the survivors but not in a form you can test
// membership against, and every consumer that needs the answer needs it per row.
function standingSet(entries) {
  return new Set(uniquePapers(entries).kept);
}

// Whether a row is Google Scholar's second listing of a work already counted.
//
// `secondary` is the standing set for the group the row belongs to, when the
// caller has one -- which is the only correct way to answer the question, because
// "is this a duplicate?" is a fact about the whole citing list, not about a row.
// Without a set it falls back to fields already on the row: `is_secondary_copy`
// where a caller (markSecondaryCopies, or a rebuild) recorded it, and
// `duplicate_of`, which the language rule and a proven same-work fold both set.
//
// A language edition is a secondary copy as well, but per the instruction of
// 2026-11-03 the language screen supersedes every other classification, so such a
// row is reported under non-English and NOT here -- `bucketOf` tests the language
// flag first for exactly that reason.
//
// A patent family is deliberately NOT treated as one work by this rule's author,
// but it is by `paperKey`, which groups on title alone. Measured 2026-11-03 that
// folds 5 patent rows (a WO filing with its US national phase, an application
// with its grant, two continuations). The user was shown the five and chose to
// keep counting a family once, so the behaviour stands -- but it is a title
// inference, not a demonstrated identity, and it is named here so a future reader
// does not mistake it for the proven-identity rule of 2026-11-02.
function isSecondaryCopy(e, secondary) {
  if (e.language_flag) return false;
  // Tested with instanceof rather than truthiness: a caller that forwards an
  // array callback's second argument would otherwise reach `.has` on a number.
  const set = secondary instanceof Set ? secondary : null;
  // duplicate_of is tested even when a set is supplied: a row a person proved is
  // the same work, or a publisher's second-language copy, is deferred by a rule
  // more specific than the title grouping, and uniquePapers can still let such a
  // row stand when its title is unlike its twin's.
  const isCopy = set
    ? !set.has(e) || Boolean(e.duplicate_of)
    : Boolean(e.is_secondary_copy) || Boolean(e.duplicate_of);
  return isCopy;
}

// The five categories a reviewer reads, in the order they are tested.
//
// The partition is exhaustive and mutually exclusive by construction: every
// active row lands in exactly one bucket, so a chart drawn from these sums to the
// record count with no remainder. `other` exists only so a future status that
// nothing recognises shows up as itself instead of vanishing from a chart.
//
// Why this order.
//   language first  -- the instruction of 2026-11-03: a non-English row is
//                      reported once, as non-English, whatever else it is.
//   review second   -- a row still on the reviewer's sheet, read through
//                      isReviewQueue, so this bucket always equals the length of
//                      the queue a person actually works. It is NOT the raw
//                      REVIEW count: a non-English row went to the bucket above,
//                      and a copy whose standing sibling settled its work goes to
//                      the copy bucket below, because that row is not open work.
//   copy third      -- this is what reconciles the exhibit with the count: the
//                      second copy of a counted work is shown as a copy rather
//                      than claimed as another independent citation.
//
// The copy test comes before the mark test, and that ordering is what reconciles
// the packet's two independent figures: 1077 rows are yellow on an exhibit while
// 1059 works are counted, because a second copy is a copy first.
//
// `review` reads isReviewQueue rather than the bare status, so the bucket and the
// reviewer's sheet cannot disagree about what is still work. A copy whose standing
// sibling settled its work is therefore a copy here, not an open row (see
// inheritedFrom); a copy with nothing to inherit from stays in `review`.
function bucketOf(e, secondary) {
  if (e.language_flag) return "non_english";
  if (isReviewQueue(e, secondary)) return "review";
  if (isSecondaryCopy(e, secondary)) return "preprint_copy";
  if (isHighlighted(e)) return "independent";
  if (isIndependentPending(e)) return "pending";
  if (
    e.status === "DEPENDENT" ||
    e.status === "SELF (PI)" ||
    e.status === "SELF (FORMER PI)"
  ) {
    return "dependent";
  }
  return "other";
}

// The classification a duplicate inherits from the copy that stands for its work.
//
// Per the user's instruction on 2026-11-03: "duplicates should inherit the
// dependent / independent tag from the parent (of which they are a duplicate) and
// also be marked as a copy/preprint."
//
// Independence is a property of the WORK, not of the row. Google Scholar lists
// one paper several times -- a publisher record, a repository copy, a preprint --
// and the row that stands for it carries the verdict that was reached from the
// best available byline. A second copy whose own byline Scholar truncated is
// therefore not an open question: the question was already answered on its twin.
// cit-000132 and cit-000144 are exactly this -- both REVIEW on their own lists,
// both copies of cit-000108, which is INDEPENDENT and confirmed.
//
// This is deliberately a READ-ONLY view and deliberately does not touch `status`:
//
//   - A report JSON's `status` records what was concluded from that row's own
//     author list, which is the provenance the packet is built on. Overwriting it
//     would make a row look decided by a reading nobody performed, and would
//     survive a rebuild as a claim the capture never made.
//   - A human verdict on a copy must not be written at all here. copyReliability
//     ranks a decided row (+64) above any machine reading, so marking a copy
//     decided would make IT the copy that stands for the work -- which
//     isHighlighted resolves through duplicate_of, and so would move the yellow
//     mark off the published record onto, say, an academia.edu upload. Measured
//     on this fold: deciding cit-000132 takes the mark off cit-000108 on exhibit
//     page 2 and puts it on page 5. Inheritance reports the same verdict without
//     moving a single mark, so no exhibit needs re-printing.
//   - It must also never feed copyReliability. The parent is chosen BY that
//     ranking, so letting the rank read an inherited status would make the score
//     depend on its own answer.
//
// `secondary` is optional and behaves as in isSecondaryCopy: given the standing
// set it answers for a live group; without one it falls back to the fields a
// rebuild recorded, so a store projection answers the same question.
function inheritedFrom(e, secondary) {
  if (e.language_flag) return null;
  const set = secondary instanceof Set ? secondary : null;
  if (set) {
    if (!isSecondaryCopy(e, set)) return null;
    // The standing copy of this row's work. uniquePapers groups on same_work_key
    // when a person proved one, else on paperKey, so the parent is found the same
    // way the copy was identified -- no separate identity rule.
    const key = e.same_work_key || paperKey(e);
    for (const o of set) {
      if (o === e) continue;
      if ((o.same_work_key || paperKey(o)) !== key) continue;
      // A non-English parent settles nothing. Its own classification is superseded
      // by the language screen (2026-11-03) and excluded from the packet, so a
      // copy of it has nothing usable to inherit and stays open work. Without
      // this test an English row could inherit its way off the queue from a
      // citation the packet does not count at all.
      if (o.language_flag) continue;
      if (!isSettled(o) || !o.status) continue;
      return o;
    }
    return null;
  }
  // Store fallback: build-catalog.js records the answer per row, resolved with the
  // standing-set logic above. Here the column IS the fact -- recordInheritance
  // writes it only for a copy with a settled parent, and clears it otherwise -- so
  // this branch deliberately does NOT re-test isSecondaryCopy. The store's SQL
  // mirrors (v_review, v_pub_stats, the bucket counts) test inherited_status alone,
  // and requiring a second condition here would make the rule and its mirror
  // disagree about the same row, which is the class of defect the reconciliation
  // gates exist to catch. A stale value on a row that stands for its work would be
  // caught by those gates rather than silently shortening the queue.
  if (!e.inherited_status) return null;
  return {
    row_uid: e.inherited_from || "",
    status: e.inherited_status,
    confirm_state: e.inherited_confirm_state || "",
  };
}

// The status a row is reported under: its own, or its parent's when it is a copy
// with a settled parent. A row that stands for its work is untouched, so every
// counted figure keeps reading `status` as before.
function effectiveStatus(e, secondary) {
  const p = inheritedFrom(e, secondary);
  return p ? p.status : e.status;
}

// Independent by classification but not yet countable for an AUTHOR reason: the
// row is English, classified INDEPENDENT, and not highlighted only because no
// source has settled its author list. Never included in a filing total until
// corroboration settles it.
//
// Per the user's instruction on 2026-11-03 a non-English row does NOT belong
// here: the language screen supersedes the independence classification, because
// no certified translation is being obtained (decision of 2026-11-01) so no
// amount of settling the byline can make such a row count. Those rows are
// reported once, under the non-English bucket (`non_english` /
// `non_english_withheld`), never as unsettled-independent work. Before this the
// bucket swept in all 45 non-English independent rows (42 withheld by the screen
// plus 3 second-language editions), which made a closed language decision look
// like 45 open author questions. With the screen applied the bucket is empty on
// this snapshot -- every genuinely-independent-but-unconfirmed row has already
// been settled -- and that is the honest result, not a broken query.
function isIndependentPending(e) {
  return (
    e.status === "INDEPENDENT" &&
    !isHighlighted(e) &&
    !e.language_flag &&
    !isSecondaryIndependent(e)
  );
}

// An INDEPENDENT row that is Google Scholar's second listing of a work counted
// once, or a row folded away by a proven same-work claim or a language edition.
//
// This term exists for the same reason `non_english_independent` does -- see the
// instruction of 2026-11-03, which is exactly the reasoning applied one bucket
// over. A row that cannot change a packet figure is not open work, and before
// 2026-11-05 these rows sat in `independent_pending`, which the dashboard draws
// as "Independent, unsettled" and the review sheet treats as a queue. For a
// second copy nothing is unsettled: the standing sibling carries the verdict
// (that is what inheritedFrom records), so calling it pending overstated the
// remaining work.
//
// It also keeps the status partition exhaustive after the mark rule began to
// refuse a non-standing row on 2026-11-05. Those 17 rows left `independent`;
// without a named term of their own the arithmetic gate in
// check-ledger-vs-snapshot.js would fall short by 17, which is the guard
// working -- the rows need naming, not the gate routing around.
//
// Note this is NOT the same set as `bucket_preprint_copy`: that one is a
// reviewer-facing bucket over every status (a DEPENDENT copy lands there too) and
// sends a non-English copy to the language bucket, because bucketOf tests the
// language flag first. This term is specifically the independent-classified,
// English rows the counted figure declines to mark twice.
// isSettled is required, and deliberately so. A second copy whose OWN byline was
// never settled (confirm_state unresolved or lookup-failed) is still open work:
// this predicate cannot see the standing sibling, so it must not assume the
// sibling settled anything. Leaving such a row to fall through keeps it in
// `independent_pending`, which is the conservative direction -- open work stays
// visible rather than disappearing into a bucket nobody has to act on. Measured
// 2026-11-05 every one of the 17 rows this term names is settled (8 confirmed,
// 9 Scholar-list-covered), so the guard changes no figure today; it is here so a
// future throttled capture cannot quietly reclassify its own failures.
function isSecondaryIndependent(e) {
  return (
    e.status === "INDEPENDENT" &&
    !e.language_flag &&
    isSettled(e) &&
    (doesNotStand(e) || Boolean(e.duplicate_of))
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
//
// Scholar's bracketed link-type marker is removed first, because it is part of
// Scholar's rendering and not part of the title. Without this a row Scholar
// labelled "[CITATION] Some Title" never merges with the same work listed
// plainly as "Some Title", so one citing paper is counted twice. Measured over
// the filed set on 2026-11-02, removing the marker merges exactly two same-list
// pairs and nothing else: the bioRxiv lignin preprint cit-000132 with its
// [CITATION] copy cit-000144, and the JACS Au influenza paper cit-000187 with
// its [CITATION] copy cit-000220. Only the markers Scholar is observed to emit
// are removed (see crosscheck.stripScholarMarker) -- a chemistry title's own
// brackets, as in "...Benzopyrano[4,3-e][1,2,4]triazolo...", are left alone.
function paperKey(e) {
  const t = stripScholarMarker(e.title)
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
//
// A demonstrated shared author outranks a clean read (2026-11-03), which is the
// same argument taken one step further. The guide defines an independent
// citation as one where the citing paper and the cited paper share NO author --
// a universal claim that a single counterexample refutes. So a copy that
// matched an author settles the paper even if another copy, whose byline was
// read differently, matched nobody.
//
// The case that prompted it: VCU dissertation 2956, "Kinetic and Thermodynamic
// Studies of Thrombin Inhibitors" (2013), appears on one citing list twice, as
// "AM Abdel" at scholarscompass.vcu.edu and as "[BOOK] ... MHA Aziz" at
// ProQuest. The VCU record names the author as Aziz May Abdel with Umesh Desai
// as first advisor, and the cited paper's own author list includes May H Abdel
// Aziz -- so it is a Desai-group self-citation. Scholar's two bylines are both
// untruncated, so completeness tied, and the copy that matched nobody scored
// higher only because it had been confirmed. Matching on surname plus initials
// is the standard this packet already applies everywhere else; it should not be
// the standard only when the alternative happens to look tidier.
//
// A person's decision stays above it (64): the instructions are explicit that a
// human reading of the published article is its own basis and outranks any
// machine reading, including this one.
function copyReliability(e) {
  let score = 0;
  // Only a match the row actually concluded on. matched_authors can survive a
  // later re-apply that discarded the external record it came from (see the
  // non-credible branch of corroboration.applyExternalVerdict, which restores
  // the Scholar byline but leaves the match fields), and a row that says
  // INDEPENDENT while carrying a match is internally inconsistent -- neither is
  // evidence of a shared author.
  const concludesOverlap =
    e.status === "DEPENDENT" ||
    e.status === "SELF (PI)" ||
    e.status === "SELF (FORMER PI)";
  const matched = concludesOverlap
    ? [
        ...(e.matched_authors || []),
        ...(e.matched_pi || []),
        ...(e.matched_former_pi || []),
      ]
    : [];
  if (matched.length) score += 12;
  // A person who read the published article outranks any machine reading, so a
  // decided copy stands for the paper even when its Scholar byline is truncated
  // - which is exactly the case the queue exists for.
  if (isUserDecided(e)) score += 64;
  if (!/truncated/.test(String(e.author_source || ""))) score += 8;
  if (e.confirm_state === "confirmed") score += 4;
  else if (e.confirm_state === "unverified-coverage") score += 2;
  // The tie-break on the row's OWN merits, deliberately not isHighlighted.
  //
  // This is the one call site where the choice is load-bearing rather than
  // cosmetic. copyReliability decides which copy of a duplicated work stands;
  // isHighlighted now consults standing-ness (doesNotStand), so scoring it here
  // would make the rule read its own output -- uniquePapers -> copyReliability ->
  // isHighlighted -> is_secondary_copy, which is the field uniquePapers exists to
  // write. On the groupReports path that read happens to land on an unset field
  // and so behaves like the old +1, but "happens to be unset when evaluated" is
  // not a design.
  //
  // isHighlightCandidate is the same predicate minus the duplicate decision,
  // which is what a tie-break between two copies of one work should be: neither
  // copy can earn the right to stand by already having been chosen. Measured
  // 2026-11-05 over all 1466 duplicate groups, swapping the two changes which
  // copy stands in ZERO groups, and dropping the term entirely also changes zero
  // -- so this is a correctness fix with no effect on any filed figure.
  if (isHighlightCandidate(e)) score += 1;
  return score;
}

// Collapse duplicate copies of one paper. Returns the surviving entries, in the
// order their first copy appeared, plus the pairs that were merged so the
// review sheet can name them.
//
// Two identity keys are applied, one level apart.
//
//   paperKey        the machine rule: a normalised title. It can only ever merge
//                   rows Scholar spelled the same way.
//   same_work_key   a key a person recorded after PROVING two differently-titled
//                   rows are one work. It exists because a title rule cannot see
//                   that relationship at all -- a preprint and the article it
//                   became usually have different titles, so they never share a
//                   paperKey and one work is counted twice.
//
// The 2026-11-02 rule governs what may set it: a preprint server is not the test
// and a similar title is not the test; a matching complete byline plus a
// matching venue/DOI chain, or the published paper's own statement of a prior
// version, is. Merging on suspicion would both hide a real citation and rest on
// an unproven identity claim in a filing, so this key is written only by
// tools/apply-decision.js, never inferred here.
//
// Every member of such a group carries the same key, including the copy that
// stands for the work, so the grouping states itself on each row rather than
// depending on which rows a caller happens to pass together. A row that is
// folded away also carries duplicate_of, which isHighlighted() already refuses,
// so the exhibit mark and this count cannot disagree.
function uniquePapers(entries) {
  const groups = new Map();
  for (const e of entries) {
    const k = e.same_work_key || paperKey(e);
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
  // isHighlightCandidate, NOT isHighlighted -- and the reason became load-bearing
  // on 2026-11-05, when the mark rule began to consult standing-ness.
  //
  // "Which copy of this work should stand" cannot depend on "which copy already
  // stands". It also has to answer identically on both code paths, and reading
  // the mark would break that: a store row carries is_primary_copy from
  // applyPrimaryCopy before build-catalog's edition walk runs, while a report
  // entry carries nothing until markSecondaryCopies runs afterwards. So the same
  // language-edition pair could resolve to different winners depending on which
  // projection asked -- precisely the store-vs-reports disagreement the
  // reconciliation gates exist to catch.
  //
  // isHighlightCandidate is the row's own merits minus every duplicate decision,
  // which is the only question that is well-defined before a winner is picked.
  // Measured 2026-11-05 across the filed set this changes no existing fold.
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
    //
    // isHighlightCandidate, not isHighlighted -- same reasoning as
    // editionPreference above, and the same load-bearing date. "Was this copy
    // going to be marked on its own merits" must not read a standing flag that
    // one code path has set and the other has not, or a pair straddling two
    // exhibits resolves differently in build-catalog than in groupReports and the
    // mark disappears from one of them. Measured 2026-11-05 over the filed set:
    // 3 edition groups resolve against an earlier page, all 3 already carry the
    // mark on that earlier copy, and the earlier copy is the standing copy in
    // every case -- so the two predicates agree today and the change is a
    // guard against divergence rather than a fix to a live figure.
    const printed = seen.some((e) => isHighlightCandidate(e));

    for (const e of current) {
      if (e === winner && !printed) {
        e.duplicate_of = "";
        e.duplicate_kind = "";
        e.edition_note = `primary language edition (${[...dois].join(" vs ")})`;
      } else {
        const stands =
          printed ? seen.find((x) => isHighlightCandidate(x)) || seen[0] : winner;
        e.duplicate_of = stands.cid || "";
        e.duplicate_kind = "language-edition";
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

// Apply the same-work folds recorded by a person.
//
// Called by every consumer that counts -- tally.groupReports and
// build-catalog.applyEditions -- so the exhibit mark, the ledger, the store and
// the audit all resolve a fold the same way. It is deliberately NOT folded into
// uniquePapers: grouping happens after this, and this function's job is to write
// the consequence onto the rows so a reader of a single row can see why it does
// or does not count.
//
// For each group of rows sharing a same_work_key, one copy stands for the work
// (editionPreference, the same ranking used for language editions -- the copy
// that would be marked wins, so a fold never deletes the citation the packet is
// claiming) and the rest carry duplicate_of pointing at it, which isHighlighted
// already refuses. duplicate_kind says which rule folded it, because
// "language edition" and "same work under two titles" are different claims and a
// filing must not blur them.
//
// A row already folded by the language rule is left folded -- that determination
// is more specific and was made from a DOI plus an author list.
function foldSameWork(entries) {
  const groups = new Map();
  for (const e of entries) {
    if (e.duplicate_kind === undefined) e.duplicate_kind = "";
    if (!e.same_work_key) continue;
    if (!groups.has(e.same_work_key)) groups.set(e.same_work_key, []);
    groups.get(e.same_work_key).push(e);
  }
  for (const list of groups.values()) {
    if (list.length < 2) continue;
    const winner = list.reduce((a, b) => (editionPreference(b) > editionPreference(a) ? b : a));
    for (const e of list) {
      if (e === winner) {
        // Initialised rather than left alone, exactly as duplicate_kind is above:
        // in the pipeline markLanguageEditions has already set this to "", but a
        // fold is a claim about which copy stands, and a caller reading one row
        // should see that answer here rather than infer it from an absent field.
        if (e.duplicate_of === undefined) e.duplicate_of = "";
        e.same_work_stands = true;
        if (!e.edition_note) e.edition_note = "copy that stands for this work";
        continue;
      }
      e.same_work_stands = false;
      if (e.duplicate_of) continue; // already folded, and by a better-proven rule
      e.duplicate_of = winner.cid || "";
      e.duplicate_kind = "same-work";
      e.same_work_note =
        `same work as the row on page ${winner.page || 1} ` +
        `("${String(winner.title || "").slice(0, 60)}"), counted once`;
    }
  }
  return entries;
}

function tallyEntries(entries) {
  const highlighted = entries.filter(isHighlighted);
  const { kept, merged } = uniquePapers(entries);
  const keptHighlighted = kept.filter(isHighlighted);
  // Which rows stand for their work, computed once and passed to bucketOf rather
  // than written onto the rows. Deliberately not a mutation: capture-citations.js
  // calls tallyEntries on the very objects it then serialises into the filed
  // report JSON, and a page-scoped answer baked into that file would outlive the
  // page it was true for -- the same class of bug as trusting a duplicate_of that
  // a different grouping would not have set.
  const secondary = new Set(kept);
  // The five reviewer-facing categories, counted from bucketOf so the partition
  // is derived, not restated. Counting them here rather than in each report is
  // what keeps the waffle, the per-publication bars and the ledger agreeing; a
  // CASE expression copied into three SQL queries is how a packet ends up with
  // two different totals for one bucket.
  const buckets = {
    independent: 0,
    dependent: 0,
    review: 0,
    non_english: 0,
    preprint_copy: 0,
    pending: 0,
    other: 0,
  };
  for (const e of entries) buckets[bucketOf(e, secondary)]++;
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
    // Counted on a person's reading of the published article rather than on
    // Scholar or an external index. Reported so the three bases always sum to
    // `independent`: a packet figure that reads "652 confirmed + 390 Scholar
    // list" while the total is higher would be untraceable, and a human-settled
    // row should be visible rather than hidden inside one of the other two.
    independent_user_decided: highlighted.filter(isUserDecided).length,
    independent_pending: entries.filter(isIndependentPending).length,
    // The independent-classified rows that are Scholar's second listing of a work
    // counted once (or a fold). They left `independent` on 2026-11-05 when the
    // mark rule began to refuse a row that does not stand for its work, and they
    // are NOT `independent_pending` -- the standing sibling already settled the
    // work, so nothing is unsettled. Named for the same reason
    // `non_english_independent` is: the status partition has to keep summing to
    // `records`, and rows that leave two buckets need a term of their own or the
    // arithmetic gate in check-ledger-vs-snapshot.js falls short. Never a counted
    // total -- these are citations the packet deliberately does not highlight.
    secondary_copy_independent: entries.filter(isSecondaryIndependent).length,
    // The rows the language screen supersedes (user instruction, 2026-11-03):
    // classified INDEPENDENT but flagged non-English, so they are reported here
    // rather than in independent_pending. They exist because the status partition
    // has to keep summing to `records`: a non-English row still carries an
    // INDEPENDENT classification, and once it leaves the unsettled bucket the
    // partition needs its own named term or the ledger's arithmetic gate fails.
    // Never a counted total -- it is the same set as `non_english_withheld` plus
    // the second-language copies of an article already on the list.
    non_english_independent: entries.filter(isNonEnglishIndependent).length,
    dependent: entries.filter((e) => e.status === "DEPENDENT").length,
    self_pi: entries.filter((e) => e.status === "SELF (PI)").length,
    self_former_pi: entries.filter((e) => e.status === "SELF (FORMER PI)").length,
    review: entries.filter((e) => e.status === "REVIEW").length,
    // The queue a person works, after the non-English rows are taken out of it.
    // Both figures are reported: `review` keeps the status partition summing to
    // `records` (independent + dependent + self + review), and `review_queue` is
    // the length of the sheet a reviewer opens. Their difference is exactly
    // `review_non_english`, which is still counted in `non_english` below and
    // listed in full on the Non-English page.
    // Wrapped rather than passed directly: Array#filter hands the callback an
    // index, and a bare `filter(isReviewQueue)` would arrive here with a number
    // where the standing Set belongs.
    review_queue: entries.filter((e) => isReviewQueue(e, secondary)).length,
    review_non_english: entries.filter(
      (e) => e.status === "REVIEW" && Boolean(e.language_flag)
    ).length,
    // The REVIEW rows that left the queue because the work already has an answer
    // on its standing copy (user instruction, 2026-11-03 -- see inheritedFrom).
    // This term exists for the same reason review_non_english does: without it,
    // `review - review_queue` has no explanation and a reader (or the ledger's
    // own footnote) is forced to guess, which is how a queue gap came to be
    // described as entirely non-English when two of the rows were copies. These
    // rows are counted again under preprint_copy, never as open work.
    review_inherited: entries.filter(
      (e) =>
        e.status === "REVIEW" &&
        !e.language_flag &&
        inheritedFrom(e, secondary) !== null
    ).length,
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
    // The five categories, plus `pending` and `other` so the seven always sum to
    // `records`. `bucket_review` is the raw REVIEW count, not the queue: the
    // queue excludes non-English rows, and those are already inside
    // `bucket_non_english`, so using the queue here would double-count them and
    // break the sum. The dashboard draws the queue and says so in the label.
    bucket_independent: buckets.independent,
    bucket_dependent: buckets.dependent,
    bucket_review: buckets.review,
    bucket_non_english: buckets.non_english,
    bucket_preprint_copy: buckets.preprint_copy,
    bucket_pending: buckets.pending,
    bucket_other: buckets.other,
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
    // Then the same-work folds a person recorded. Order matters: the language
    // rule is proven from a DOI plus an author list, so it claims a row first
    // and foldSameWork only folds what is left over.
    foldSameWork(g.entries);
    // Finally mark which rows are the second listing of a work already counted,
    // so a reader of one row can see it. After the folds, because a row a person
    // proved is the same work IS a secondary copy and must not be re-decided here.
    markSecondaryCopies(g.entries);
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
  USER_DECIDED,
  isUserDecided,
  isSettled,
  isHighlighted,
  isHighlightCandidate,
  doesNotStand,
  isReviewQueue,
  isWithheldForLanguage,
  isIndependentPending,
  isSecondaryIndependent,
  isNonEnglishIndependent,
  isSecondaryCopy,
  markSecondaryCopies,
  recordInheritance,
  inheritedFrom,
  effectiveStatus,
  standingSet,
  bucketOf,
  paperKey,
  stripScholarMarker,
  doiOf,
  doiArticleId,
  authorSignature,
  editionKey,
  markLanguageEditions,
  foldSameWork,
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

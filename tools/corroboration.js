// One definition of what an external record does to a citation's state.
//
// Both the live capture (tools/capture-citations.js, after a PubMed/OpenAlex
// look-up) and the offline re-apply (tools/reapply-corroboration.js, over
// reports already filed) call applyExternalVerdict(). Two private copies of
// this rule is exactly the failure this project has hit before — the ledger
// once read "9 independent (10 externally confirmed)" off one sheet because
// run-batch and capture each kept their own tally — so the state transition
// lives here once.
//
// ---------------------------------------------------------------------------
// R1 — a title match must be credible (bug fix, 2026-11-02)
//
// crosscheck.titleSimilarity() used to divide shared words by the SHORTER
// title, so a Scholar title yielding almost no Latin words scored a perfect
// 1.00 against any external record containing that word. Over the filed set
// that produced 29 records at similarity 1.00 that are not the same paper: a
// Cyrillic title matched to a Gerodontology scientometric analysis (twice,
// against the same PMID 42958950), a row titled "Bakker" matched to a letter
// about ligament injuries, and journal names Scholar mistook for titles
// ("Anticoagulants", "Structural Biology", "Future Medicinal Chemistry").
//
// Discarding such a match is not a policy change — it removes evidence that was
// never valid. The row falls back to exactly the state a row with no external
// record is in: countable on Scholar's own complete list, unresolved if that
// list was truncated.
//
// R2 — a credible external list may settle a truncated Scholar byline
//    (user decision, 2026-11-02)
//
// The rule until now: "not promoted because Scholar's own list is incomplete".
// The user asked for those rows to be resolved. The guide defines an
// independent citation as one where "the citing paper and cited paper share no
// authors" — a statement about the papers, not about Scholar's display. When
// Scholar truncates it shows nothing, so there is no Scholar finding to
// override, and a credible same-work record with a complete list answers the
// question the guide asks. Promotion requires ALL of:
//   - the external record is a credible same-work match (R1);
//   - its complete author list shares no author with the cited paper and lists
//     neither the PI nor the former PI;
//   - the row is not flagged non-English. Per the user's instruction the same
//     day, a row the language screen holds back is never promoted: no
//     translations are being obtained, so it cannot count either way and a
//     promotion would only move it between two uncounted states.
// A row Scholar already called independent is unaffected; a row the external
// list contradicts is decided, not left open.

const { titleSimilarity, titleMatchIsCredible } = require("./crosscheck");
const { evaluateEntry, fromVancouver } = require("./name-match.js");

// Scholar's own byline, as the row was read from the page. Used to restore a
// row whose author list was overwritten by a record that turned out not to be
// the same paper: an unrelated paper's authors sitting on the row look like
// evidence and are worse than no list at all.
function scholarByline(entry) {
  return {
    full_authors: [],
    authors_used: String(entry.authors || "").trim(),
    author_source: entry.truncated
      ? "scholar-list (truncated)"
      : "scholar-list",
  };
}

// Overlap of the external author list against the cited paper and the two PIs,
// using the same surname-plus-initials matcher as the Scholar-side decision.
// PubMed lists are "Surname XY"; OpenAlex lists were already put in natural
// order by toDisplayName. The source is recorded on the entry, so it decides the
// format -- the order is not guessed from the name.
function externalOverlap(entry, keys) {
  const fromPubMed = entry.external_source === "pubmed";
  const names = String(entry.external_authors || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => (fromPubMed ? fromVancouver(s) : s));
  return evaluateEntry(
    { authors: entry.external_authors, full_authors: names, truncated: false },
    keys,
  );
}

// Decide one entry's corroboration state from what is stored on it. Mutates and
// returns { changed, notes }. `entry` is a plain report entry.
function applyExternalVerdict(entry, keys) {
  const notes = [];
  // A row a person decided is that person's classification, and no external
  // record overrides it. Without this the R1 branch below could turn a row
  // decided from the published byline back into REVIEW and remove its mark
  // (found 2026-11-07 on cit-001476).
  if (entry.confirm_state === "user-decided") return { changed: false, notes };
  const before = JSON.stringify([
    entry.status,
    entry.confirm_state,
    entry.corroboration,
    entry.external_similarity,
    entry.external_match_credible,
    entry.author_source,
    entry.authors_used,
    entry.matched_authors,
    entry.matched_pi,
    entry.matched_former_pi,
  ]);

  if (!entry.external_source) {
    // Nothing external was ever found for this row. Its state was decided from
    // Scholar's own list and this module has nothing to say about it.
    return { changed: false, notes };
  }

  const storedSim = entry.external_similarity;
  const sim = titleSimilarity(entry.external_title || "", entry.title || "");
  const credible = titleMatchIsCredible(sim);
  entry.external_similarity = Number(sim.toFixed(2));
  // Recorded only when the match is NOT credible. The store's column defaults
  // to 1, so writing an explicit 1 onto all 683 rows would rewrite 150 report
  // files to add a field that changes no figure and hides the rows that
  // actually moved.
  if (credible) delete entry.external_match_credible;
  else entry.external_match_credible = 0;
  if (Number(storedSim) !== Number(sim.toFixed(2))) {
    notes.push(`similarity ${storedSim} -> ${Number(sim.toFixed(2))}`);
  }

  if (!credible) {
    notes.push(
      "external match discarded (title overlap too thin to be the same work)",
    );
    // Fall back to what Scholar's own list supports — the same branch a capture
    // takes when nothing indexes the paper.
    const complete = !entry.truncated;
    const state = complete ? "unverified-coverage" : "unresolved";
    entry.corroboration = complete
      ? "not indexed in PubMed or OpenAlex; Scholar list is complete"
      : "not indexed in PubMed or OpenAlex and the Scholar list is incomplete";
    entry.corroboration_note =
      `stored ${entry.external_source} match rejected 2026-11-02: the title ` +
      `overlap is too thin to be the same work (was similarity ${storedSim})`;
    entry.confirm_state = state;
    if (entry.status === "INDEPENDENT" && entry.truncated) {
      notes.push("status INDEPENDENT -> REVIEW (only the discarded match settled it)");
      entry.status = "REVIEW";
    }
    if (/scholar\+(pubmed|openalex)/.test(String(entry.author_source || ""))) {
      Object.assign(entry, scholarByline(entry));
      notes.push("author list restored to Scholar's own byline");
    }
    return finish(entry, before, notes);
  }

  const verdict = externalOverlap(entry, keys);

  if (verdict.status !== "INDEPENDENT") {
    // The external list shows a shared author, or a PI. That is a decision.
    // The status carries the direction; confirm_state says the external record
    // is what settled it, so the row is not reported as an open contradiction.
    entry.confirm_state = "external-resolved";
    entry.corroboration = `resolved against ${entry.external_source} (${verdict.status})`;
    entry.matched_authors = verdict.matched_authors;
    entry.matched_pi = verdict.matched_pi;
    entry.matched_former_pi = verdict.matched_former_pi;
    if (!entry.external_matched || !entry.external_matched.length) {
      entry.external_matched = [
        ...verdict.matched_authors,
        ...verdict.matched_pi,
        ...verdict.matched_former_pi,
      ];
    }
    if (entry.status !== verdict.status) {
      notes.push(`status ${entry.status} -> ${verdict.status}`);
      entry.status = verdict.status;
    }
    return finish(entry, before, notes);
  }

  // No overlap. Either confirm what Scholar already said, or settle a row
  // Scholar left open.
  if (entry.status === "REVIEW") {
    if (entry.language_flag) {
      entry.confirm_state = "confirmed";
      entry.corroboration =
        `external list shows no overlap (${entry.external_source}); not promoted, ` +
        `entry is non-English and excluded on language alone`;
      notes.push("stays in review: non-English");
      return finish(entry, before, notes);
    }
    entry.status = "INDEPENDENT";
    entry.confirm_state = "confirmed";
    entry.corroboration = `resolved against ${entry.external_source}`;
    // Prefer the external complete list, which is what the decision rests on.
    if (entry.external_authors) {
      entry.full_authors = String(entry.external_authors)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      entry.author_source = `scholar+${entry.external_source}`;
    }
    notes.push("status REVIEW -> INDEPENDENT (complete external list, no overlap)");
    return finish(entry, before, notes);
  }

  entry.confirm_state = "confirmed";
  entry.corroboration = `confirmed by ${entry.external_source}`;
  if ((!entry.full_authors || !entry.full_authors.length) && entry.external_authors) {
    entry.full_authors = String(entry.external_authors)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    entry.author_source = `scholar+${entry.external_source}`;
    notes.push("author list taken from the external record");
  }
  return finish(entry, before, notes);
}

// Report only real movement. Every entry with an external record passes through,
// and most come out with the state they went in with; counting those as changes
// once reported 683 entries "changed" on a run that moved 12 marks.
const WATCHED = [
  "status",
  "confirm_state",
  "corroboration",
  "external_similarity",
  "external_match_credible",
  "author_source",
  "authors_used",
  "matched_authors",
  "matched_pi",
  "matched_former_pi",
];

function finish(entry, before, notes) {
  const after = JSON.stringify([
    entry.status,
    entry.confirm_state,
    entry.corroboration,
    entry.external_similarity,
    entry.external_match_credible,
    entry.author_source,
    entry.authors_used,
    entry.matched_authors,
    entry.matched_pi,
    entry.matched_former_pi,
  ]);
  return { changed: before !== after, notes, fields: WATCHED };
}

module.exports = {
  applyExternalVerdict,
  externalOverlap,
  scholarByline,
};

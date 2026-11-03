// Scholar's bracketed link-type markers, in one dependency-free module.
//
// Scholar prefixes a record whose title it could not parse with a bracketed
// link type -- [CITATION], [BOOK], [TXT] (and [HTML]/[PDF] on the citation
// links). That marker is part of Scholar's rendering, NOT part of the title.
//
// Two rules need to remove it and they must agree, so the definition lives here
// rather than in each caller:
//
//   tools/crosscheck.js  -- a marker left in the search string becomes the word
//        "citation", so a quoted PubMed title search and OpenAlex's
//        title.search filter can never match. The row is then recorded as "not
//        indexed in PubMed or OpenAlex" and lands in the review queue even
//        though the paper is indexed. Verified 2026-11-02 by running the look-up
//        both ways on three queued rows: with the marker, no record; without it,
//        each returned its published article at similarity 1.00 --
//        cit-000567 (Comprehensive Glycoscience chapter,
//        10.1016/b978-0-12-819475-1.00107-3), cit-001230 (Antiviral Research,
//        10.1016/j.antiviral.2015.11.010), cit-000220 (JACS Au,
//        10.1021/jacsau.2c00664).
//
//   tools/tally.js paperKey() -- a row Scholar labelled "[CITATION] Some Title"
//        otherwise never merges with the same work listed plainly as "Some
//        Title", so one citing paper is counted as two distinct papers.
//
// This module deliberately requires nothing. crosscheck.js needs ./human, which
// needs Playwright, and tally.js is loaded by the offline ledger, catalog and
// audit -- none of which should have to start a browser to count a row.
//
// The allowlist is exact and measured over the filed set on 2026-11-02:
// [CITATION] on 43 rows, [BOOK] on 30, [TXT] on 1, and no marker anywhere but
// the front of a title. An arbitrary bracket is NOT stripped, because a
// chemistry title genuinely contains them -- the benzopyrano-triazolo paper at
// cit-000075 is written "...Benzopyrano[4,3-e][1,2,4]triazolo[5,1-c][1,2,4]
// triazin-6-ones" and removing its brackets would corrupt the words being
// searched for and the identity of the work.

const SCHOLAR_MARKERS = new Set(["CITATION", "BOOK", "TXT", "HTML", "PDF"]);
const MARKER_RE = /^\s*\[([^\]]+)\]\s*/;

// Remove a leading Scholar link-type marker. The title is returned unchanged
// when the bracket is not one of the markers above.
function stripScholarMarker(title) {
  const s = String(title == null ? "" : title);
  const m = s.match(MARKER_RE);
  if (!m) return s;
  if (!SCHOLAR_MARKERS.has(m[1].trim().toUpperCase())) return s;
  return s.slice(m[0].length).trim();
}

// True when the title carries one of Scholar's markers. Used to explain, in a
// review note, why a row looked unindexable.
function hasScholarMarker(title) {
  return stripScholarMarker(title) !== String(title == null ? "" : title).trim();
}

module.exports = { stripScholarMarker, hasScholarMarker, SCHOLAR_MARKERS };

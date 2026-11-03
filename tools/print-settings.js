// The one definition of how an exhibit is printed.
//
// Why this exists. The print settings were written out separately in
// capture.js, capture-citations.js, recapture-profile.js, reprint-exhibits.js
// and test-pdf-fit.js, with a comment in each saying "US Letter at 75% scale,
// which the user verified fits". When the scale had to change, five files had
// to change with it and nothing failed if one was missed -- the exhibits would
// simply stop agreeing with each other, which is invisible until someone
// notices two pages of the same packet print at different sizes.
//
// History of the scale, since it is a filing decision and not a formatting
// preference:
//   0.75  per the user on 2026-10-29, verified by hand to fit a citing-articles
//         page on one sheet. Held for every page until 2026-11-02, when three
//         tall pages were found printing to two sheets (allosteric-inhibition
//         p2, insights-into-glycobiology p3, n-glycosylation-of-CD206 p2).
//   0.73  measured, not guessed: printing all 170 filed citing pages and
//         counting real PDF pages, 0.74 still leaves the three tall pages on
//         two sheets and 0.73 puts every one of them on a single sheet. It is
//         therefore the highest scale that fits the whole packet, which keeps
//         the type as large as the tallest page allows.
//
// The header and footer are NOT here. They name the page they belong to --
// Chromium's class="url" at capture, the stored cites_url on a re-print, and a
// dated label on the profile exhibit -- so each caller still builds its own.
// The margin below is what they live inside, and that has to agree everywhere.

const PRINT_SCALE = 0.73;

const PRINT_OPTIONS = {
  format: "Letter",
  scale: PRINT_SCALE,
  printBackground: true,
  // The header and footer print inside the top and bottom margins, so shrinking
  // either clips them.
  margin: { top: "12mm", bottom: "16mm", left: "8mm", right: "8mm" },
  displayHeaderFooter: true,
};

// US Letter is 279.4mm tall; 12 + 16mm of margin leaves 251.4mm of paper.
// Chromium lays content out at pageWidth/scale and then shrinks it, so one
// sheet holds usableLayoutPx(SCALE) of layout pixels, not 251.4mm of them.
const SHEET_HEIGHT_MM = 279.4;
const SHEET_WIDTH_IN = 8.5;
const MARGIN_TOP_MM = 12;
const MARGIN_BOTTOM_MM = 16;
const MARGIN_SIDE_MM = 8;

function usableLayoutPx(scale = PRINT_SCALE) {
  const mm = SHEET_HEIGHT_MM - MARGIN_TOP_MM - MARGIN_BOTTOM_MM;
  return Math.floor(((mm * 96) / 25.4) / scale);
}

// The viewport width Chromium lays a page out at, in CSS pixels. Measure in
// print media at exactly this width or the numbers do not describe the PDF.
function layoutWidthPx(scale = PRINT_SCALE) {
  const contentMm = SHEET_WIDTH_IN * 25.4 - 2 * MARGIN_SIDE_MM;
  return Math.round(((contentMm / 25.4) * 96) / scale);
}

// Page count straight from the PDF object tree. Chromium writes uncompressed
// object headers, so "/Type /Page" that is not "/Type /Pages" counts pages
// without pulling in a PDF library. This is the only trustworthy fit check:
// the marks are baked into the HTML and a DOM measurement misses whatever
// hangs below the last result row, which is how a two-sheet page passed a
// row-bottom test for days.
function countPdfPages(buf) {
  return (buf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) || []).length;
}

module.exports = {
  PRINT_SCALE,
  PRINT_OPTIONS,
  usableLayoutPx,
  layoutWidthPx,
  countPdfPages,
};

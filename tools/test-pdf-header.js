// Checks the exhibit PDF header/footer layout WITHOUT any network access.
// Run: node tools/test-pdf-header.js
//
// Chromium fills class="url", "pageNumber" and "totalPages" inside a print
// header template by itself, and the text it draws is font-subset so it cannot
// be grepped out of the PDF bytes. What can genuinely go wrong is layout: a
// long Scholar URL with a start= offset on one 7px line next to a snapshot
// date. This renders the same markup at the exact printable width Chromium uses
// and reports whether anything overflows, plus writes a PNG to look at.

const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const PNG = path.join(__dirname, ".pdf-header-sample.png");

// Worst realistic case: cites id plus a deep pagination offset.
const URL_LONG =
  "https://scholar.google.com/scholar?oi=bibs&hl=en&cites=16263333014302844300&start=1240";
const SNAPSHOT = "2026-10-29 16:40:00";
const BASE = "unique-repertoire-anti-carbohydrate-antibody-response-citing-2026-10-29-p3";

// Mirrors the templates in capture-citations.js and capture.js.
const headerHtml =
  `<div id="hdr" style="font-size:7px;color:#444;width:100%;display:flex;` +
  `justify-content:space-between;padding:0 8mm;overflow:hidden;white-space:nowrap;">` +
  `<span id="u">${URL_LONG}</span><span>Snapshot ${SNAPSHOT}</span></div>`;

const footerHtml =
  `<div id="ftr" style="font-size:7px;color:#444;width:100%;text-align:center;` +
  `padding:0 8mm;">${BASE} - page 3 of 13</div>`;

async function main() {
  const browser = await chromium.launch();
  // A4 is 210mm wide; 8mm margins each side leave the width Chromium lays the
  // header out in. 96dpi => 1mm = 3.7795px.
  const printablePx = Math.round((210 - 16) * (96 / 25.4));
  const page = await browser.newPage({
    viewport: { width: printablePx, height: 140 },
  });

  await page.setContent(
    `<!doctype html><html><head><meta charset="utf-8"></head>` +
      `<body style="margin:0">${headerHtml}<hr style="margin:6px 0">${footerHtml}</body></html>`,
    { waitUntil: "load" }
  );

  const m = await page.evaluate(() => {
    const hdr = document.getElementById("hdr");
    const url = document.getElementById("u");
    const ftr = document.getElementById("ftr");
    const date = hdr.lastElementChild;
    return {
      headerBoxPx: Math.round(hdr.getBoundingClientRect().width),
      urlTextPx: Math.round(url.scrollWidth),
      dateTextPx: Math.round(date.scrollWidth),
      urlClipped: url.scrollWidth + date.scrollWidth > hdr.clientWidth,
      footerTextPx: Math.round(ftr.scrollWidth),
      footerClipped: ftr.scrollWidth > ftr.clientWidth,
      headerHeightPx: Math.round(hdr.getBoundingClientRect().height),
    };
  });

  await page.screenshot({ path: PNG, fullPage: true });
  await browser.close();

  const topMarginPx = Math.round(12 * (96 / 25.4)); // PDF top margin is 12mm

  console.log(`printable width : ${m.headerBoxPx}px`);
  console.log(`url text width  : ${m.urlTextPx}px`);
  console.log(`date text width : ${m.dateTextPx}px`);
  console.log(`header clipped  : ${m.urlClipped}`);
  console.log(`footer clipped  : ${m.footerClipped}`);
  console.log(
    `header height   : ${m.headerHeightPx}px (top margin allows ~${topMarginPx}px)`
  );
  console.log(`\nVisual sample: ${PNG}`);

  let fail = 0;
  if (m.urlClipped) {
    console.log(
      "\nFAIL: the URL and snapshot date do not share one line. Shorten the\n" +
        "date, drop the base name, or allow wrapping before a production run."
    );
    fail++;
  }
  if (m.footerClipped) {
    console.log("FAIL: the footer line is clipped at this width.");
    fail++;
  }
  if (m.headerHeightPx > topMarginPx) {
    console.log("FAIL: the header is taller than the 12mm top margin.");
    fail++;
  }
  if (!fail) {
    console.log(
      "\nOK: the full Scholar URL, snapshot date and page numbers all fit."
    );
  }
  process.exitCode = fail ? 1 : 0;
}

main().catch((e) => {
  console.error(`Fatal: ${e.stack || e.message}`);
  process.exitCode = 1;
});

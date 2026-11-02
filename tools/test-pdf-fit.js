// Offline check: does a citing-articles page fit on ONE US Letter sheet at the
// exhibit print settings? Uses a previously saved HTML copy, so no request is
// made to Google Scholar.
//
//   node tools/test-pdf-fit.js                       (uses the latest saved page)
//   node tools/test-pdf-fit.js "<path-to-saved.html>"
//
// The user asked for 75% scale on Letter after testing it by hand; this
// measures the result rather than trusting it. Page count is read from the PDF
// object tree, which is reliable because Chromium writes uncompressed object
// headers.
//
// Output: .pdf-fit-sample.pdf / .txt next to this script.

const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");

const SUPPORT_DIR = path.join(
  __dirname,
  "..",
  "Independent Citation Record",
  "Exhibits",
  "Supporting"
);

// Same box as the capture: A4/Letter margins are set in the print options, and
// the header/footer live inside the top/bottom margins.
const PDF_OPTIONS = {
  format: "Letter",
  scale: 0.75,
  printBackground: true,
  margin: { top: "12mm", bottom: "16mm", left: "8mm", right: "8mm" },
  displayHeaderFooter: true,
  headerTemplate:
    `<div style="font-size:7px;color:#444;width:100%;display:flex;` +
    `justify-content:space-between;padding:0 8mm;overflow:hidden;white-space:nowrap;">` +
    `<span class="url"></span><span>Snapshot 2026-10-29</span></div>`,
  footerTemplate:
    `<div style="font-size:7px;color:#444;width:100%;text-align:center;` +
    `padding:0 8mm;">fit-test - page <span class="pageNumber"></span> of ` +
    `<span class="totalPages"></span></div>`,
};

function latestSavedPage() {
  const files = fs
    .readdirSync(SUPPORT_DIR)
    .filter((f) => f.endsWith(".html") && f.includes("citing"))
    .map((f) => ({
      f,
      mtime: fs.statSync(path.join(SUPPORT_DIR, f)).mtimeMs,
    }))
    .sort((a, b) => b.mtime - a.mtime);
  if (!files.length) {
    throw new Error(`No saved citing HTML found in ${SUPPORT_DIR}`);
  }
  return path.join(SUPPORT_DIR, files[0].f);
}

// Chromium's page objects are written as "N 0 obj ... /Type /Page" and the
// /Pages tree node is "/Type /Pages", so counting the singular form that is
// not followed by "s" gives the page count without a PDF library.
function countPdfPages(buf) {
  const text = buf.toString("latin1");
  const all = (text.match(/\/Type\s*\/Page[^s]/g) || []).length;
  return all;
}

async function main() {
  const htmlPath = process.argv[2] || latestSavedPage();
  const html = fs.readFileSync(htmlPath, "utf8");
  const rows = (html.match(/gs_or\b/g) || []).length;

  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setContent(html, { waitUntil: "domcontentloaded" });

  const outPdf = path.join(__dirname, ".pdf-fit-sample.pdf");
  await page.pdf({ ...PDF_OPTIONS, path: outPdf });
  const pages = countPdfPages(fs.readFileSync(outPdf));

  // Chromium lays printed content out at pageWidth / scale, then shrinks it, so
  // a lower scale both compresses and reflows to a wider box. Measure in print
  // media at that width, or the numbers will not describe what was printed.
  await page.emulateMedia({ media: "print" });
  const layoutWidth = Math.round(((8.5 * 25.4 - 16) / 25.4) * 96 / PDF_OPTIONS.scale);
  await page.setViewportSize({ width: layoutWidth, height: 900 });
  const metrics = await page.evaluate(() => {
    const rows = [...document.querySelectorAll("#gs_res_ccl_mid .gs_or")];
    const last = rows[rows.length - 1];
    return {
      rowCount: rows.length,
      contentHeightPx: document.body.scrollHeight,
      lastRowBottomPx: last
        ? Math.round(last.getBoundingClientRect().bottom + window.scrollY)
        : 0,
    };
  });

  await browser.close();

  // Letter is 279.4mm tall; 12mm + 16mm margins leave 251.4mm. Content is laid
  // out at 1/scale, so that much paper holds 251.4mm / scale of layout pixels.
  const usableMm = 279.4 - 12 - 16;
  const pxPerSheet = Math.floor(((usableMm * 96) / 25.4) / PDF_OPTIONS.scale);
  const clipped = metrics.lastRowBottomPx > pxPerSheet;
  const lines = [
    `source html         : ${path.basename(htmlPath)}`,
    `citing rows on page : ${metrics.rowCount}`,
    `print settings      : Letter, scale ${PDF_OPTIONS.scale}`,
    `layout width used   : ${layoutWidth}px (page width / scale)`,
    `content height      : ${metrics.contentHeightPx}px`,
    `last row ends at    : ${metrics.lastRowBottomPx}px`,
    `usable per sheet    : ~${pxPerSheet}px`,
    `PDF pages produced  : ${pages}`,
    pages === 1 && !clipped
      ? "RESULT: all rows fit on one sheet"
      : `RESULT: does NOT fit on one sheet (${pages} sheets${
          clipped ? ", last row overflows" : ""
        })`,
  ];
  const outTxt = path.join(__dirname, ".pdf-fit-sample.txt");
  fs.writeFileSync(outTxt, lines.join("\r\n"), "utf8");
  console.log(lines.join("\n"));
  console.log(`\nPDF: ${outPdf}`);
}

main().catch((e) => {
  console.error(`[fit] Fatal: ${e.stack || e.message}`);
  process.exitCode = 1;
});

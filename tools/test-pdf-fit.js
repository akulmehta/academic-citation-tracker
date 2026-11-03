// Offline check: does a citing-articles page print on ONE US Letter sheet?
// Uses a previously saved HTML copy, so no request is made to Google Scholar.
//
//   node tools/test-pdf-fit.js                       (uses the latest saved page)
//   node tools/test-pdf-fit.js "<path-to-saved.html>"
//   node tools/test-pdf-fit.js --all                 every saved citing page
//
// --all walks the saved HTML in Supporting, which is a handful of workpapers
// wider than the filed set (early captures whose PDF was archived). That is
// deliberate -- an unfiled page that would not fit is worth knowing about --
// but it means the count printed is not the exhibit count. The audit is the
// check over exactly the filed set.
//
// What changed on 2026-11-02, and why it matters. This used to decide by
// measuring where the last result row ends and comparing that with a computed
// usable height. That number is not the thing being asked: a Scholar row carries
// snippets, links and a "Related" line that can extend past the last row's own
// box, so a page could pass the arithmetic and still print to two sheets. It did
// exactly that -- three exhibits printed to two sheets while this test reported
// every page fitting. The PDF page count is the ground truth, so the check now
// prints the page and counts its sheets. The layout measurement is still
// reported, because "the last row ends 40px past the limit" explains a failure
// better than "2 sheets" does.
//
// Print settings come from print-settings.js, the same module the capture and
// the re-printer use, so this cannot drift from what actually gets filed.
//
// Output: .pdf-fit-sample.pdf / .txt next to this script.

const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const {
  PRINT_SCALE,
  PRINT_OPTIONS,
  usableLayoutPx,
  layoutWidthPx,
  countPdfPages,
} = require("./print-settings");

const SUPPORT_DIR = path.join(
  __dirname,
  "..",
  "Independent Citation Record",
  "Exhibits",
  "Supporting"
);

// Same box as the capture, imported rather than restated -- see
// print-settings.js.

function savedPages() {
  return fs
    .readdirSync(SUPPORT_DIR)
    .filter((f) => f.endsWith(".html") && f.includes("citing"))
    .map((f) => ({
      f,
      mtime: fs.statSync(path.join(SUPPORT_DIR, f)).mtimeMs,
    }))
    .sort((a, b) => b.mtime - a.mtime);
}

function latestSavedPage() {
  const files = savedPages();
  if (!files.length) {
    throw new Error(`No saved citing HTML found in ${SUPPORT_DIR}`);
  }
  return path.join(SUPPORT_DIR, files[0].f);
}

// Chromium's page objects are written as "N 0 obj ... /Type /Page" and the
// /Pages tree node is "/Type /Pages", so counting the singular form that is
// not followed by "s" gives the page count without a PDF library. Lives in
// print-settings.js so the audit and this test count identically.

async function main() {
  const all = process.argv.includes("--all");
  const explicit =
    process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : "";
  const targets = all
    ? savedPages().map((f) => path.join(SUPPORT_DIR, f.f))
    : [explicit || latestSavedPage()];

  const browser = await chromium.launch();
  const page = await browser.newPage();

  const outPdf = path.join(__dirname, ".pdf-fit-sample.pdf");
  const lines = [];
  const failures = [];
  for (const target of targets) {
    await page.setContent(fs.readFileSync(target, "utf8"), {
      waitUntil: "domcontentloaded",
    });
    await page.pdf({
      ...PRINT_OPTIONS,
      path: outPdf,
      headerTemplate:
        `<div style="font-size:7px;color:#444;width:100%;display:flex;` +
        `justify-content:space-between;padding:0 8mm;overflow:hidden;white-space:nowrap;">` +
        `<span class="url"></span><span>Snapshot 2026-10-29</span></div>`,
      footerTemplate:
        `<div style="font-size:7px;color:#444;width:100%;text-align:center;` +
        `padding:0 8mm;">fit-test - page <span class="pageNumber"></span> of ` +
        `<span class="totalPages"></span></div>`,
    });
    // The sheet count is the verdict. Everything below only explains it.
    const pages = countPdfPages(fs.readFileSync(outPdf));
    if (pages !== 1) failures.push({ f: path.basename(target), pages });

    // Chromium lays printed content out at pageWidth / scale, then shrinks it, so
    // a lower scale both compresses and reflows to a wider box. Measure in print
    // media at that width, or the numbers will not describe what was printed.
    await page.emulateMedia({ media: "print" });
    await page.setViewportSize({ width: layoutWidthPx(), height: 900 });
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

    lines.push(
      ...[
        `source html         : ${path.basename(target)}`,
        `citing rows on page : ${metrics.rowCount}`,
        `print settings      : Letter, scale ${PRINT_SCALE}`,
        `layout width used   : ${layoutWidthPx()}px (page width / scale)`,
        `content height      : ${metrics.contentHeightPx}px`,
        `last row ends at    : ${metrics.lastRowBottomPx}px`,
        `usable per sheet    : ~${usableLayoutPx()}px`,
        `PDF sheets produced : ${pages}`,
        pages === 1
          ? "RESULT: fits on one sheet"
          : `RESULT: does NOT fit on one sheet (${pages} sheets)`,
      ]
    );
  }

  await browser.close();

  if (all) {
    lines.push(
      "",
      `Pages checked        : ${targets.length}`,
      `Not on one sheet     : ${failures.length}`
    );
    for (const f of failures) lines.push(`  ${f.pages} sheets  ${f.f}`);
  }

  const outTxt = path.join(__dirname, ".pdf-fit-sample.txt");
  fs.writeFileSync(outTxt, lines.join("\r\n"), "utf8");
  console.log(lines.join("\n"));
  console.log(`\nPDF: ${outPdf}`);
  // A page that spills onto a second sheet is a filing defect, not a note.
  if (failures.length) process.exitCode = 1;
}

main().catch((e) => {
  console.error(`[fit] Fatal: ${e.stack || e.message}`);
  process.exitCode = 1;
});

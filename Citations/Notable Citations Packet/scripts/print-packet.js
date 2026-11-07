#!/usr/bin/env node
/**
 * Print packet.html to print/packet.pdf.
 *
 * §7 of the instructions wants the packet printed before hand-off, so that what
 * counsel receives is a document rather than a screen. Printing is also the only
 * way to notice that an entry splits awkwardly across a sheet.
 *
 * This does NOT reuse the record's print settings. Those (US Letter at 0.73
 * scale, `tools/print-settings.js`) exist to force a Google Scholar results page
 * onto one sheet, which is a constraint of the EXHIBITS. This document is a
 * summary written for reading, so it prints at full scale with ordinary margins
 * and a page-numbered footer. The record is read here only to borrow the
 * playwright install; nothing in it is imported, and nothing outside this folder
 * is written (§0).
 *
 *   node scripts/print-packet.js            # writes print/packet.pdf
 */
const fs = require("fs");
const path = require("path");
const { PKT } = require("./lib.js");

const HTML = path.join(PKT, "packet.html");
const OUT_DIR = path.join(PKT, "print");
const OUT = path.join(OUT_DIR, "packet.pdf");

// Playwright is not a dependency of this folder — it is already installed for the
// capture tooling. Look here first, then in the record's tools/, so the packet
// keeps working if it ever grows its own install.
function resolvePlaywright() {
  const candidates = [
    path.join(PKT, "node_modules", "playwright"),
    path.join(PKT, "..", "..", "tools", "node_modules", "playwright"),
    path.join(PKT, "..", "..", "node_modules", "playwright"),
  ];
  for (const c of candidates) {
    try { return require(c); } catch { /* try the next location */ }
  }
  console.error("Could not find playwright. Looked in:\n  " + candidates.join("\n  "));
  console.error("Either `npm i playwright` in this folder, or restore the capture tooling's install.");
  process.exit(1);
}

(async () => {
  if (!fs.existsSync(HTML)) {
    console.error("packet.html does not exist — run scripts/render-packet.js --write first.");
    process.exit(1);
  }
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const { chromium } = resolvePlaywright();
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  // file:// so relative hrefs into papers/ resolve, exactly as they do when the
  // applicant opens the HTML locally.
  await page.goto("file:///" + HTML.replace(/\\/g, "/"), { waitUntil: "load" });
  // Emulate print media on the page that is already open, after navigation. A
  // freshly created page reports matchMedia('print') false even when emulated,
  // which makes a print-only rule look broken when it is not.
  await page.emulateMedia({ media: "print" });

  await page.pdf({
    path: OUT,
    format: "Letter",
    scale: 1,
    printBackground: true,
    margin: { top: "14mm", bottom: "16mm", left: "14mm", right: "14mm" },
    displayHeaderFooter: true,
    headerTemplate: "<div></div>",
    footerTemplate: `<div style="font-size:8pt; color:#666; width:100%; text-align:center; padding:0 14mm;">
      Notable citations — Akul Mehta &nbsp;·&nbsp; page <span class="pageNumber"></span> of <span class="totalPages"></span>
    </div>`,
  });

  await browser.close();

  const bytes = fs.statSync(OUT).size;
  if (!bytes) { console.error("wrote an empty PDF."); process.exit(1); }
  // Sheet count is the number a person notices, so report it. Counting the
  // "/Type /Page" occurrences is enough here; this file is Chromium's own output.
  const buf = fs.readFileSync(OUT);
  const sheets = (buf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) || []).length;
  console.log(`printed ${path.relative(PKT, OUT)} — ${sheets} sheet(s), ${(bytes / 1024).toFixed(0)} KB`);
})();

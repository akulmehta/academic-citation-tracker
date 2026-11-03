// Headed Playwright capture for Google Scholar evidence pages.
//
// Usage:
//   node capture.js                      -> opens the Scholar profile URL
//   node capture.js "<url>"              -> opens a specific URL
//   node capture.js "<url>" "<name>"     -> names the PDF/HTML/PNG files
//
// Behaviour:
//   1. Launches a HEADED Chromium window with a persistent profile
//      (tools/.playwright-profile) so cookies survive between runs.
//   2. Navigates to the URL.
//   3. If a Google CAPTCHA / unusual-traffic page appears, it does NOT try to
//      solve it. It waits for you to solve it in the visible window.
//   4. Waits for you to press Enter in the terminal before saving, so you can
//      scroll, expand, or navigate to the page you want captured.
//   5. Saves the PDF into Exhibits/PDFs and the HTML/PNG into Exhibits/Supporting,
//      then verifies the PDF exists and is non-empty.

const fs = require("fs");
const path = require("path");
const readline = require("readline");
const { chromium } = require("playwright");
const pace = require("./human");
const { PRINT_OPTIONS } = require("./print-settings");

const PROFILE_URL =
  "https://scholar.google.com/citations?hl=en&user=dNLaKGAAAAAJ";

const ROOT = path.resolve(__dirname, "..");
const EXHIBITS = path.join(ROOT, "Independent Citation Record", "Exhibits");
// Filed exhibits (PDFs) stay separate from supporting workpapers.
const PDF_DIR = path.join(EXHIBITS, "PDFs");
const SUPPORT_DIR = path.join(EXHIBITS, "Supporting");
const USER_DATA_DIR = path.join(__dirname, ".playwright-profile");

const CAPTCHA_MARKERS = [
  "unusual traffic",
  "not a robot",
  "recaptcha",
  "enable js and cookies",
  "our systems have detected",
];

function log(msg) {
  console.log(`[capture] ${msg}`);
}

function slugify(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function snapshotDate() {
  // Snapshot date per project instructions: YYYY-MM-DD.
  return new Date().toISOString().slice(0, 10);
}

function ask(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) =>
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    })
  );
}

async function pageState(page) {
  const url = page.url();
  let bodyText = "";
  try {
    bodyText = (await page.evaluate(() => document.body?.innerText || "")).toLowerCase();
  } catch {
    /* page may be mid-navigation */
  }
  const title = await page.title().catch(() => "");
  const blocked = CAPTCHA_MARKERS.some((m) => bodyText.includes(m));
  const empty = bodyText.replace(/\s/g, "").length < 40;
  return { url, title, blocked, empty, length: bodyText.length };
}

async function main() {
  const url = process.argv[2] || PROFILE_URL;
  const nameArg = process.argv[3];

  fs.mkdirSync(PDF_DIR, { recursive: true });
  fs.mkdirSync(SUPPORT_DIR, { recursive: true });
  fs.mkdirSync(USER_DATA_DIR, { recursive: true });

  log(`PDF output:     ${PDF_DIR}`);
  log(`Support output: ${SUPPORT_DIR}`);
  log(`Persistent profile: ${USER_DATA_DIR}`);
  log("Launching headed Chromium...");

  const context = await pace.launch(USER_DATA_DIR);

  const page = context.pages()[0] || (await context.newPage());

  await pace.goto(page, url);

  let state = await pageState(page);
  log(`Page title: ${state.title || "(none)"}`);
  log(`Page URL:   ${state.url}`);
  log(`Text length: ${state.length}`);
  log(`Snapshot date for this capture: ${snapshotDate()}`);

  if (state.blocked || state.empty) {
    log("--------------------------------------------------");
    log("Access wall detected (CAPTCHA / unusual traffic / blank page).");
    log("Per project instructions I will NOT attempt to solve it.");
    log("Please complete the verification in the browser window.");
    log("--------------------------------------------------");
  }

  const answer = await ask(
    "\n>>> When the page looks correct in the browser window, press ENTER here to capture. <<<\n" +
      "    (Type 'q' then ENTER to abort without saving.)\n"
  );

  if (answer.trim().toLowerCase() === "q") {
    log("Aborted by user. Nothing saved.");
    await context.close();
    return;
  }

  state = await pageState(page);
  if (state.blocked) {
    log("Page still appears to be a CAPTCHA / unusual-traffic screen.");
    log("Checkpoint recorded instead of an exhibit. Nothing saved.");
    await context.close();
    process.exitCode = 2;
    return;
  }

  const stamp = snapshotDate();
  const base = slugify(
    nameArg || `${state.title || "scholar-page"}-${stamp}`
  ) || `scholar-page-${stamp}`;

  const timestamp = `${stamp} ${new Date().toTimeString().slice(0, 8)}`;
  // Header names the Scholar URL this page was printed from; Chromium fills
  // class="url" with the live address.
  const headerTemplate =
    `<div style="font-size:7px;color:#444;width:100%;display:flex;` +
    `justify-content:space-between;padding:0 8mm;overflow:hidden;white-space:nowrap;">` +
    `<span class="url"></span><span>Snapshot ${timestamp}</span></div>`;
  const footerTemplate =
    `<div style="font-size:7px;color:#444;width:100%;text-align:center;` +
    `padding:0 8mm;">${base} - page <span class="pageNumber"></span> of ` +
    `<span class="totalPages"></span></div>`;

  const pdfPath = path.join(PDF_DIR, `${base}.pdf`);
  const htmlPath = path.join(SUPPORT_DIR, `${base}.html`);
  const pngPath = path.join(SUPPORT_DIR, `${base}.png`);

  // Reveal lazy-loaded content with an uneven, reading-paced scroll.
  await pace.humanScroll(page);
  await pace.pause("before capture", 1500, 3500);

  log("Saving PDF...");
  // Shared print settings -- see print-settings.js for why the scale is what
  // it is and why it must not be restated here.
  await page.pdf({
    path: pdfPath,
    ...PRINT_OPTIONS,
    headerTemplate,
    footerTemplate,
  });

  log("Saving HTML...");
  const html = await page.content();
  fs.writeFileSync(htmlPath, html, "utf8");

  log("Saving full-page screenshot...");
  await page.screenshot({ path: pngPath, fullPage: true }).catch((err) => {
    log(`Screenshot skipped (very long page): ${err.message}`);
  });

  // Verify the PDF really exists and is non-empty before reporting success.
  if (!fs.existsSync(pdfPath)) {
    log("VERIFICATION FAILED: PDF file was not created.");
    process.exitCode = 1;
  } else {
    const size = fs.statSync(pdfPath).size;
    if (size < 1024) {
      log(`VERIFICATION FAILED: PDF is suspiciously small (${size} bytes).`);
      process.exitCode = 1;
    } else {
      log(`VERIFIED PDF: ${pdfPath} (${(size / 1024).toFixed(1)} KB)`);
      log(`HTML copy:    ${htmlPath}`);
      if (fs.existsSync(pngPath)) {
        log(`PNG copy:     ${pngPath}`);
      }
    }
  }

  await ask("\nPress ENTER to close the browser window.\n");
  await context.close();
}

main().catch((err) => {
  console.error(`[capture] Fatal error: ${err.stack || err.message}`);
  process.exitCode = 1;
});

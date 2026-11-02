// Expand the full Google Scholar publication list and save it as JSON + TSV.
//
// Usage: node list-all-publications.js
//
// Headed Chromium with the persistent profile (tools/.playwright-profile).
// If a CAPTCHA / unusual-traffic screen appears it pauses for the user and
// never attempts to solve it.

const fs = require("fs");
const path = require("path");
const readline = require("readline");
const { chromium } = require("playwright");
const pace = require("./human");

const PROFILE_URL =
  "https://scholar.google.com/citations?hl=en&user=dNLaKGAAAAAJ";
const ROOT = path.resolve(__dirname, "..");
// The publication table is a workpaper used to drive captures, not a filed
// exhibit, so it is stored with the other supporting material.
const OUT_DIR = path.join(
  ROOT,
  "Independent Citation Record",
  "Exhibits",
  "Supporting"
);
const USER_DATA_DIR = path.join(__dirname, ".playwright-profile");

const CAPTCHA_MARKERS = [
  "unusual traffic",
  "not a robot",
  "recaptcha",
  "enable js and cookies",
  "our systems have detected",
];

function log(msg) {
  console.log(`[list] ${msg}`);
}

function ask(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) =>
    rl.question(question, (a) => {
      rl.close();
      resolve(a);
    })
  );
}

async function looksBlocked(page) {
  const text = await page
    .evaluate(() => document.body?.innerText || "")
    .catch(() => "");
  const low = text.toLowerCase();
  return CAPTCHA_MARKERS.some((m) => low.includes(m));
}

async function waitThroughWall(page) {
  if (!(await looksBlocked(page))) return true;
  log("--------------------------------------------------");
  log("Access wall detected. I will NOT solve it.");
  log("Please complete the verification in the browser window.");
  log("--------------------------------------------------");
  await ask(">>> Press ENTER once the Scholar profile is visible again. <<<\n");
  return !(await looksBlocked(page));
}

function parseRows(html) {
  const decode = (t) =>
    String(t)
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, " ")
      .replace(/[\u202a\u202c\u200e\u200f\u200b]/g, "")
      .replace(/\s+/g, " ")
      .trim();
  const strip = (h) => decode(h.replace(/<[^>]*>/g, " "));

  const rows = [...html.matchAll(/<tr class="gsc_a_tr">([\s\S]*?)<\/tr>/g)];
  const out = [];
  for (const r of rows) {
    const cell = r[1];
    const titleMatch = cell.match(
      /<a[^>]+class="gsc_a_at"[^>]*>([\s\S]*?)<\/a>/
    );
    if (!titleMatch) continue;
    const paperHref = cell.match(
      /<a[^>]+href="([^"]*view_citation[^"]*)"[^>]*class="gsc_a_at"/
    );
    const citeMatch = cell.match(
      /<td class="gsc_a_c"><a[^>]+href="([^"]+)"[^>]*>(\d+)<\/a>/
    );
    const gray = [
      ...cell.matchAll(/<div class="gs_gray">([\s\S]*?)<\/div>/g),
    ].map((g) => strip(g[1]).replace(/,\s*$/, ""));
    const yearMatch = cell.match(
      /class="gsc_a_h gsc_a_hc gs_ibl"[^>]*>(\d{4})</
    );
    out.push({
      title: strip(titleMatch[1]),
      authors: gray[0] || "",
      venue: gray[1] || "",
      year: yearMatch ? yearMatch[1] : "",
      citedBy: citeMatch ? parseInt(citeMatch[2], 10) : null,
      citesUrl: citeMatch
        ? decode(citeMatch[1]).replace(/^\/+/, "https://scholar.google.com/")
        : "",
      paperUrl: paperHref
        ? "https://scholar.google.com/" +
          decode(paperHref[1]).replace(/^\/+/, "")
        : "",
    });
  }
  return out;
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const context = await pace.launch(USER_DATA_DIR);
  const page = context.pages()[0] || (await context.newPage());

  log(`Navigating to profile: ${PROFILE_URL}`);
  await pace.goto(page, PROFILE_URL);

  if (!(await waitThroughWall(page))) {
    log("Still blocked. Nothing saved.");
    await context.close();
    process.exitCode = 2;
    return;
  }

  // Browse the table a little before touching any control.
  await pace.humanScroll(page, { toTop: false });
  await pace.humanMove(page, 5);

  // Expand the list until "Show more" disappears, goes disabled, or stops
  // growing the table. Waits are randomised so the polling rate varies.
  let prev = 0;
  let rounds = 0;
  while (rounds < 40) {
    rounds++;
    const html = await page.content();
    const count = parseRows(html).length;
    if (count === prev) break;
    prev = count;

    const btn = page.locator("#gsc_bpf_more");
    const visible = await btn.isVisible().catch(() => false);
    if (!visible) break;

    // Scholar disables the button while the next batch loads; wait it out
    // rather than retrying aggressively.
    const enabled = await btn.isEnabled().catch(() => false);
    if (!enabled) {
      log("Show more is busy - waiting before retrying once.");
      await pace.pause("button busy", 4000, 9000);
      const stillEnabled = await btn.isEnabled().catch(() => false);
      if (!stillEnabled) {
        log("Show more still disabled; treating the list as complete.");
        break;
      }
    }

    log(`Loaded ${count} rows so far - clicking Show more...`);
    await pace.humanMove(page, 3);
    await btn.click({ timeout: 15000 }).catch((e) => log(`Click failed: ${e.message}`));
    await pace.pause("after Show more", 3000, 7500);
  }

  const pubs = parseRows(await page.content());
  log(`Total publications captured: ${pubs.length}`);

  const stamp = new Date().toISOString().slice(0, 10);
  const jsonPath = path.join(
    OUT_DIR,
    `publications-list-${stamp}.json`
  );
  const tsvPath = path.join(OUT_DIR, `publications-list-${stamp}.tsv`);

  fs.writeFileSync(
    jsonPath,
    JSON.stringify(
      {
        source: PROFILE_URL,
        snapshot_date: stamp,
        total_publications: pubs.length,
        publications: pubs,
      },
      null,
      2
    ),
    "utf8"
  );

  const header =
    "cited_by\tyear\ttitle\tauthors\tvenue\tcites_url\tpaper_url";
  const lines = pubs
    .slice()
    .sort((a, b) => (a.citedBy ?? 0) - (b.citedBy ?? 0))
    .map((p) =>
      [
        p.citedBy,
        p.year,
        p.title,
        p.authors,
        p.venue,
        p.citesUrl,
        p.paperUrl,
      ].join("\t")
    );
  fs.writeFileSync(tsvPath, [header, ...lines].join("\r\n"), "utf8");

  log(`Saved: ${jsonPath}`);
  log(`Saved: ${tsvPath}`);

  log("\nLowest-cited publications:");
  for (const p of pubs
    .slice()
    .sort((a, b) => (a.citedBy ?? 0) - (b.citedBy ?? 0))
    .slice(0, 15)) {
    log(
      `${String(p.citedBy).padStart(4)} cites | ${p.year} | ${p.title} | ${p.venue}`
    );
  }

  await context.close();
}

main().catch((e) => {
  console.error(`[list] Fatal: ${e.stack || e.message}`);
  process.exitCode = 1;
});

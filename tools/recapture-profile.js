// Re-capture the Scholar profile page: the full publication list AND a filed
// exhibit PDF of that same expanded page, in one session.
//
//   node tools/recapture-profile.js            (asks before writing anything)
//   node tools/recapture-profile.js --write    (archive + save the new files)
//   node tools/recapture-profile.js --write --out=Production
//
// Why this exists: tools/capture.js prints whatever is on screen and
// tools/list-all-publications.js expands the table but saves only JSON/TSV. So
// the filed profile exhibit showed Scholar's default 20 rows while the working
// list held all 48. The user's requirement (2026-11-01) is that the profile
// exhibit show every article, cited or not. This script expands first, then
// prints, so the two cannot disagree.
//
// Behaviour:
//   - Reuses the persistent profile (tools/.playwright-profile) and the shared
//     pacing module. One navigation, then "Show more" clicks with randomised
//     waits. No request is parallelised and nothing is retried aggressively.
//   - On a CAPTCHA / unusual-traffic screen it does NOT solve it. It records a
//     BLOCKED-* PNG+HTML into Exhibits/Supporting and exits 2.
//   - With --write it archives any same-day publication list and profile exhibit
//     under Exhibits/Archive with a SUPERSEDED- prefix (the list also keeps a
//     dated copy in Supporting/Pre-profile-recapture-<date>/ so the old counts
//     stay readable for the changed-article diff). Nothing is deleted.
//   - Prints the citation-count change against the previous list, which is what
//     decides which citing lists need re-capturing.

const fs = require("fs");
const path = require("path");
const readline = require("readline");
const pace = require("./human");
const { PRINT_OPTIONS } = require("./print-settings");

const PROFILE_URL =
  "https://scholar.google.com/citations?hl=en&user=dNLaKGAAAAAJ";
const ROOT = path.resolve(__dirname, "..");
const EXHIBITS = path.join(ROOT, "Independent Citation Record", "Exhibits");
const PDF_DIR = path.join(EXHIBITS, "PDFs");
const SUPPORT_DIR = path.join(EXHIBITS, "Supporting");
const ARCHIVE_DIR = path.join(EXHIBITS, "Archive");
const USER_DATA_DIR = path.join(__dirname, ".playwright-profile");

const CAPTCHA_MARKERS = [
  "unusual traffic",
  "not a robot",
  "recaptcha",
  "enable js and cookies",
  "our systems have detected",
];

const WRITE = process.argv.includes("--write");

function log(msg) {
  console.log(`[profile] ${msg}`);
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

function slugify(text) {
  return String(text)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

async function looksBlocked(page) {
  const text = await page
    .evaluate(() => document.body?.innerText || "")
    .catch(() => "");
  const low = text.toLowerCase();
  return CAPTCHA_MARKERS.some((m) => low.includes(m));
}

// Parse the publication table out of the rendered page. Same selectors the
// list tool uses, kept here so this run is self-contained and its own parse can
// be checked against the printed page.
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

  const out = [];
  for (const r of html.matchAll(/<tr class="gsc_a_tr">([\s\S]*?)<\/tr>/g)) {
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
    // The cites id is the stable key across snapshots - the URL and the count
    // both move, this does not.
    const citesUrl = citeMatch
      ? decode(citeMatch[1]).replace(/^\/+/, "https://scholar.google.com/")
      : "";
    const citesIdMatch = citesUrl.match(/[?&]cites=(\d+)/);
    out.push({
      title: strip(titleMatch[1]),
      authors: gray[0] || "",
      venue: gray[1] || "",
      year: yearMatch ? yearMatch[1] : "",
      citedBy: citeMatch ? parseInt(citeMatch[2], 10) : null,
      cites_id: citesIdMatch ? citesIdMatch[1] : "",
      citesUrl,
      paperUrl: paperHref
        ? "https://scholar.google.com/" +
          decode(paperHref[1]).replace(/^\/+/, "")
        : "",
    });
  }
  return out;
}

// The metrics block (Cited by / h-index / i10-index, all and since-2021).
function parseMetrics(html) {
  const strip = (h) =>
    String(h)
      .replace(/<[^>]*>/g, " ")
      // Scholar sets the label with a NON-BREAKING space ("Cited\u00a0by"), so
      // normalise it or the "cited by" row silently never matches.
      .replace(/[\u00a0\u202a\u202c\u200e\u200f\u200b]/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  // gsc_rsb_st is a <table>, not a div. Match either so a layout change does
  // not silently return null metrics.
  const gsc = html.match(/<(?:table|div)[^>]*id="gsc_rsb_st"[^>]*>([\s\S]*?)<\/(?:table|div)>/);
  if (!gsc) return null;
  const rows = [
    ...gsc[1].matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g),
  ].map((r) => [...r[1].matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/g)].map((c) => strip(c[1])));
  const pick = (label) => {
    const row = rows.find((r) => r[0] && r[0].toLowerCase().includes(label));
    if (!row) return null;
    return {
      all: Number(String(row[1]).replace(/,/g, "")),
      since_2021: row[2] === undefined ? null : Number(String(row[2]).replace(/,/g, "")),
    };
  };
  const out = {
    // Scholar heads this row "Citations" on the profile page, not "Cited by" -
    // verified against the saved 2026-10-31 HTML, whose row labels are
    // Citations / h-index / i10-index. Both spellings are accepted.
    cited_by: pick("citations") || pick("cited by"),
    h_index: pick("h-index"),
    i10_index: pick("i10-index"),
  };
  // Fallback: the profile meta description reads "Affiliation - Cited by N".
  // Used only when the table row itself was unreadable, and labelled so.
  if (!out.cited_by) {
    const meta = html.match(/Cited by ([\d,]+)/);
    if (meta) {
      out.cited_by = { all: Number(meta[1].replace(/,/g, "")), since_2021: null };
      out.cited_by_source = "meta description";
    }
    out.labels = rows.map((r) => r[0]).filter(Boolean);
  }
  return out;
}

async function expandList(page) {
  let prev = 0;
  let rounds = 0;
  while (rounds < 40) {
    rounds++;
    const count = parseRows(await page.content()).length;
    if (count === prev) break;
    prev = count;

    const btn = page.locator("#gsc_bpf_more");
    const visible = await btn.isVisible().catch(() => false);
    if (!visible) break;

    // A disabled control means "busy": wait, retry once, then stop.
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
    await btn
      .click({ timeout: 15000 })
      .catch((e) => log(`Click failed: ${e.message}`));
    await pace.pause("after Show more", 3000, 7500);
  }
  return parseRows(await page.content());
}

function latestListFile() {
  if (!fs.existsSync(SUPPORT_DIR)) return null;
  const files = fs
    .readdirSync(SUPPORT_DIR)
    .filter((f) => /^publications-list-\d{4}-\d{2}-\d{2}\.json$/.test(f))
    .sort();
  return files.length ? path.join(SUPPORT_DIR, files[files.length - 1]) : null;
}

function move(from, to, label) {
  if (!fs.existsSync(from)) return;
  fs.mkdirSync(path.dirname(to), { recursive: true });
  fs.renameSync(from, to);
  log(`  ${label}: ${path.basename(from)} -> ${path.relative(ROOT, to)}`);
}

async function main() {
  const stamp = new Date().toISOString().slice(0, 10);
  const outName = (process.argv.find((a) => a.startsWith("--out=")) || "")
    .slice(6)
    .replace(/[\\/:*?"<>|]/g, "");
  const pdfOut = outName ? path.join(PDF_DIR, outName) : PDF_DIR;

  const prevPath = latestListFile();
  let prev = null;
  if (prevPath) {
    prev = JSON.parse(fs.readFileSync(prevPath, "utf8"));
    log(`Comparing against ${path.basename(prevPath)} (${prev.total_publications} publications)`);
  }

  // Offline mode: parse a saved profile HTML with the same selectors, so the
  // parse can be checked without contacting Scholar at all.
  const htmlArg = (process.argv.find((a) => a.startsWith("--html=")) || "").slice(7);
  if (htmlArg) {
    const html = fs.readFileSync(
      path.isAbsolute(htmlArg) ? htmlArg : path.join(ROOT, htmlArg),
      "utf8"
    );
    const pubs = parseRows(html);
    const metrics = parseMetrics(html);
    log(`Offline parse of ${path.basename(htmlArg)}`);
    log(`Rows: ${pubs.length}; with a count: ${pubs.filter((p) => p.citedBy).length}`);
    log(`Metrics: ${JSON.stringify(metrics)}`);
    log(`Sum: ${pubs.reduce((a, p) => a + (p.citedBy || 0), 0)}`);
    for (const p of pubs.slice(0, 3)) {
      log(`  sample: ${p.citedBy} | ${p.year} | ${p.cites_id} | ${p.title.slice(0, 40)}`);
    }
    const missing = pubs.filter((p) => !p.cites_id && p.citedBy);
    if (missing.length) log(`WARNING: ${missing.length} counted row(s) with no cites id.`);
    return;
  }

  fs.mkdirSync(pdfOut, { recursive: true });
  fs.mkdirSync(SUPPORT_DIR, { recursive: true });

  const context = await pace.launch(USER_DATA_DIR);
  const page = context.pages()[0] || (await context.newPage());

  log(`Navigating to profile: ${PROFILE_URL}`);
  await pace.goto(page, PROFILE_URL);

  if (await looksBlocked(page)) {
    const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    fs.mkdirSync(SUPPORT_DIR, { recursive: true });
    await page
      .screenshot({ path: path.join(SUPPORT_DIR, `BLOCKED-access-wall-${ts}.png`) })
      .catch(() => {});
    fs.writeFileSync(
      path.join(SUPPORT_DIR, `BLOCKED-access-wall-${ts}.html`),
      await page.content().catch(() => ""),
      "utf8"
    );
    log("Access wall detected. I will NOT solve it. Nothing saved.");
    log(`Checkpoint saved as BLOCKED-access-wall-${ts}.* in Exhibits/Supporting`);
    await context.close();
    process.exitCode = 2;
    return;
  }

  const metrics = parseMetrics(await page.content());
  if (metrics) {
    log(
      `Metrics: cited by ${metrics.cited_by?.all} (all) / ${metrics.cited_by?.since_2021} (since 2021); ` +
        `h-index ${metrics.h_index?.all} / ${metrics.h_index?.since_2021}; ` +
        `i10 ${metrics.i10_index?.all} / ${metrics.i10_index?.since_2021}`
    );
  } else {
    log("WARNING: metrics block not found on the page.");
  }

  await pace.humanScroll(page, { toTop: false });
  await pace.humanMove(page, 5);

  const pubs = await expandList(page);
  log(`Total publications on the expanded page: ${pubs.length}`);

  const withCount = pubs.filter((p) => p.citedBy && p.citedBy > 0);
  const noCount = pubs.filter((p) => !p.citedBy);
  log(`With a citation count: ${withCount.length}; showing none: ${noCount.length}`);
  const sum = withCount.reduce((a, p) => a + p.citedBy, 0);
  log(`Sum of per-article counts: ${sum}`);
  if (metrics?.cited_by?.all && metrics.cited_by.all !== sum) {
    log(
      `NOTE: profile header says ${metrics.cited_by.all}, per-article sum is ${sum}. ` +
        `Scholar's header counts duplicate versions, so a small gap is normal.`
    );
  }

  // ---- diff against the previous snapshot ----
  // Key on cites_id when both sides have one. Publication lists written before
  // 2026-11-02 stored no cites_id at all, so a cites_id-only key reported every
  // row as new. Fall back to a normalised title for those, and match id pairs
  // first so a title rename cannot masquerade as an add plus a remove.
  const normTitle = (t) =>
    String(t || "")
      .toLowerCase()
      .replace(/[\u2018\u2019]/g, "'")
      .replace(/\u2013|\u2014/g, "-")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  let changed = [];
  let added = [];
  let removed = [];
  if (prev) {
    const prevList = prev.publications || [];
    const usedPrev = new Set();
    const pairs = [];
    const prevById = new Map(
      prevList.filter((p) => p.cites_id).map((p) => [p.cites_id, p])
    );
    for (const p of pubs) {
      const byId = p.cites_id ? prevById.get(p.cites_id) : null;
      if (byId && !usedPrev.has(byId)) {
        usedPrev.add(byId);
        pairs.push([byId, p]);
        continue;
      }
      const byTitle = prevList.find(
        (q) => !usedPrev.has(q) && normTitle(q.title) === normTitle(p.title)
      );
      if (byTitle) {
        usedPrev.add(byTitle);
        pairs.push([byTitle, p]);
      } else {
        added.push(p);
      }
    }
    removed = prevList.filter((q) => !usedPrev.has(q));
    for (const [before, after] of pairs) {
      if ((before.citedBy ?? 0) !== (after.citedBy ?? 0)) {
        changed.push({
          cites_id: after.cites_id || before.cites_id || "",
          title: after.title,
          venue: after.venue,
          year: after.year,
          before: before.citedBy ?? 0,
          after: after.citedBy ?? 0,
          citesUrl: after.citesUrl || before.citesUrl || "",
          paperUrl: after.paperUrl || before.paperUrl || "",
        });
      }
    }
    if (prevList.some((p) => !p.cites_id)) {
      log(
        `NOTE: ${prevList.filter((p) => !p.cites_id).length} row(s) in ` +
          `${prev.snapshot_date} carry no cites id, so those were matched on title.`
      );
    }
  }

  if (added.length) {
    log(`New publications since ${prev.snapshot_date}: ${added.length}`);
    for (const p of added) log(`  + ${p.citedBy ?? "-"} cites | ${p.year} | ${p.title}`);
  }
  if (removed.length) {
    log(`No longer on the profile: ${removed.length}`);
    for (const p of removed) log(`  - ${p.citedBy ?? "-"} cites | ${p.year} | ${p.title}`);
  }
  changed.sort((a, b) => b.after - a.after);
  if (changed.length) {
    log(`Citation counts changed on ${changed.length} publication(s):`);
    for (const c of changed) {
      log(
        `  ${String(c.before).padStart(4)} -> ${String(c.after).padStart(4)} ` +
          `(${c.after - c.before >= 0 ? "+" : ""}${c.after - c.before}) | ${c.title.slice(0, 62)}`
      );
    }
  } else {
    log("No citation count changed since the previous snapshot.");
  }

  const jsonPath = path.join(SUPPORT_DIR, `publications-list-${stamp}.json`);
  const tsvPath = path.join(SUPPORT_DIR, `publications-list-${stamp}.tsv`);
  const diffPath = path.join(SUPPORT_DIR, `profile-changes-${prev?.snapshot_date || "prev"}-to-${stamp}.json`);
  const base = slugify(`akul-mehta-google-scholar-${stamp}`);
  const pdfPath = path.join(pdfOut, `${base}.pdf`);
  const htmlPath = path.join(SUPPORT_DIR, `${base}.html`);
  const pngPath = path.join(SUPPORT_DIR, `${base}.png`);

  log(`\nTargets:`);
  log(`  exhibit PDF : ${path.relative(ROOT, pdfPath)}`);
  log(`  list JSON   : ${path.relative(ROOT, jsonPath)}`);
  log(`  change diff : ${path.relative(ROOT, diffPath)}`);

  if (!WRITE) {
    log("\nDry run: nothing was written. Re-run with --write to archive any");
    log("same-day files and save these. No Scholar request is repeated.");
    await context.close();
    return;
  }

  // Archive, never delete. A same-day re-run would otherwise clobber the file
  // the ledger is currently quoting.
  const backupDir = path.join(SUPPORT_DIR, `Pre-profile-recapture-${stamp}`);
  for (const [f, label] of [
    [prevPath, "superseded list"],
    [path.join(SUPPORT_DIR, `publications-list-${stamp}.json`), "existing same-day list"],
    [path.join(SUPPORT_DIR, `publications-list-${stamp}.tsv`), "existing same-day tsv"],
  ]) {
    if (!f) continue;
    move(f, path.join(backupDir, path.basename(f)), label);
  }
  for (const f of [
    path.join(PDF_DIR, `${base}.pdf`),
    path.join(SUPPORT_DIR, `${base}.html`),
    path.join(SUPPORT_DIR, `${base}.png`),
  ]) {
    if (fs.existsSync(f)) move(f, path.join(ARCHIVE_DIR, `SUPERSEDED-${path.basename(f)}`), "superseded exhibit part");
  }
  if (outName) {
    const prodPdf = path.join(PDF_DIR, outName, `${base}.pdf`);
    if (fs.existsSync(prodPdf)) move(prodPdf, path.join(ARCHIVE_DIR, `SUPERSEDED-${base}.pdf`), "superseded exhibit part");
  }

  // Return to the top before printing, per the browsing convention.
  await page.evaluate(() => window.scrollTo(0, 0));
  await pace.pause("before capture", 1500, 3500);

  const timestamp = `${stamp} ${new Date().toTimeString().slice(0, 8)}`;
  const headerTemplate =
    `<div style="font-size:7px;color:#444;width:100%;display:flex;` +
    `justify-content:space-between;padding:0 8mm;overflow:hidden;white-space:nowrap;">` +
    `<span class="url"></span><span>Snapshot ${timestamp}</span></div>`;
  const footerTemplate =
    `<div style="font-size:7px;color:#444;width:100%;text-align:center;` +
    `padding:0 8mm;">${base} - page <span class="pageNumber"></span> of ` +
    `<span class="totalPages"></span></div>`;

  log("Saving PDF exhibit of the expanded profile...");
  await page.pdf({
    path: pdfPath,
    // Shared print settings -- see print-settings.js.
    ...PRINT_OPTIONS,
    headerTemplate,
    footerTemplate,
  });

  const html = await page.content();
  fs.writeFileSync(htmlPath, html, "utf8");
  await page
    .screenshot({ path: pngPath, fullPage: true })
    .catch((e) => log(`Screenshot skipped: ${e.message}`));

  fs.writeFileSync(
    jsonPath,
    JSON.stringify(
      {
        source: PROFILE_URL,
        snapshot_date: stamp,
        total_publications: pubs.length,
        metrics,
        publications: pubs,
      },
      null,
      2
    ) + "\n",
    "utf8"
  );
  const header =
    "cited_by\tyear\ttitle\tauthors\tvenue\tcites_id\tcites_url\tpaper_url";
  const lines = pubs
    .slice()
    .sort((a, b) => (a.citedBy ?? 0) - (b.citedBy ?? 0))
    .map((p) =>
      [p.citedBy, p.year, p.title, p.authors, p.venue, p.cites_id, p.citesUrl, p.paperUrl].join("\t")
    );
  fs.writeFileSync(tsvPath, [header, ...lines].join("\r\n"), "utf8");

  fs.writeFileSync(
    diffPath,
    JSON.stringify(
      {
        from: prev?.snapshot_date ?? null,
        to: stamp,
        source: PROFILE_URL,
        changed,
        added,
        removed,
      },
      null,
      2
    ) + "\n",
    "utf8"
  );

  if (!fs.existsSync(pdfPath) || fs.statSync(pdfPath).size < 1024) {
    log("VERIFICATION FAILED: profile exhibit PDF missing or tiny.");
    process.exitCode = 1;
  } else {
    log(`VERIFIED PDF: ${path.relative(ROOT, pdfPath)} (${(fs.statSync(pdfPath).size / 1024).toFixed(1)} KB)`);
    log(`Rows printed: ${pubs.length} (expect one exhibit sheet per ~20 rows at 75% scale)`);
  }

  await context.close();
}

main().catch((e) => {
  console.error(`[profile] Fatal: ${e.stack || e.message}`);
  process.exitCode = 1;
});

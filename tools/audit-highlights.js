// Offline audit: does every filed exhibit page still carry exactly the marks the
// current rules call for?
//
// Why this exists. The counting rule in tally.js has changed over the project
// (non-English exclusions, the corroboration split, and on 2026-10-31 language
// editions). A PDF printed under an older rule can therefore disagree with the
// ledger rebuilt today, and nothing else would notice: the ledger reads the
// report JSON, the PDF is a picture, and the two are only reconciled by hand.
//
// What it checks, per filed page:
//   1. the yellow marks actually present in the saved HTML, row by row, versus
//      what tally.isHighlighted says now - the same rule applyHighlights used;
//   2. that the exhibit PDF exists and is not empty;
//   3. that the page's entries carry no language edition that is marked;
//   4. that the exhibit PDF is ONE sheet -- one Scholar citing page is meant to
//      print to one Letter sheet, and a tall page silently spilling onto a
//      second is invisible to every other check here. Added 2026-11-02 after
//      three filed exhibits were found on two sheets while test-pdf-fit.js
//      reported them fitting, because that test judged by DOM height rather
//      than by the sheets the PDF actually has.
//
// Row matching replicates applyHighlights exactly: rows are read in document
// order and each is matched to the FIRST entry whose normalised rawTitle is
// equal. That detail matters for the duplicate rows Scholar shows of one paper,
// where two rows share a title and both take the first entry's decision.
//
// Read-only. Nothing here writes a file or contacts Google: the saved HTML is
// parsed by a headless browser with every network request aborted, so the DOM
// extraction is identical to the live capture without a single request.
//
// Run: node tools/audit-highlights.js          (all filed pages)
//      node tools/audit-highlights.js --csv    (one line per page)
//      node tools/audit-highlights.js --pub=<base>
//
// Exit code 1 if any page disagrees, so a batch can check itself afterwards.

const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const lib = require("./tally");
const { countPdfPages } = require("./print-settings");

const ROOT = path.resolve(__dirname, "..");
const EXHIBITS = path.join(ROOT, "Independent Citation Record", "Exhibits");
const SUPPORT_DIR = path.join(EXHIBITS, "Supporting");
const PDF_DIR = path.join(EXHIBITS, "PDFs");

// The mark the capture writes: applyHighlights sets
// style.backgroundColor = "#fff200", which Chromium serialises into the saved
// HTML as "background-color: rgb(255, 242, 0);". The page callback below tests
// that inline style per row, so the pattern lives there rather than at module
// scope - page.evaluate serialises the function and cannot close over it.

function arg(name, fallback = "") {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}

const asCsv = process.argv.includes("--csv");
const onlyPub = arg("pub");

const log = (...a) => {
  if (!asCsv) console.log(...a);
};

// Read the marked/unmarked state of every result row out of a saved page, in
// document order, using the same selectors the capture used. The regex is
// written out inside the evaluate callback rather than closed over: page.evaluate
// serialises the function, so an outer reference would be undefined in the page.
async function rowsFromSavedHtml(browser, htmlPath) {
  const html = fs.readFileSync(htmlPath, "utf8");
  const page = await browser.newPage();
  // Abort everything: the saved DOM is complete, and this keeps the audit from
  // ever reaching Scholar for a stylesheet or font.
  await page.route("**/*", (route) => route.abort());
  await page
    .setContent(html, { waitUntil: "domcontentloaded", timeout: 60000 })
    .catch(() => {});
  const rows = await page.evaluate(() => {
    const norm = (s) => s.toLowerCase().replace(/\s+/g, " ").trim();
    const re = /background-color:\s*rgb\(255,\s*242,\s*0\)|background-color:\s*#fff200/i;
    const out = [];
    for (const row of document.querySelectorAll("#gs_res_ccl_mid .gs_or")) {
      const titleEl = row.querySelector("h3.gs_rt") || row.querySelector(".gs_rt");
      if (!titleEl) continue;
      out.push({
        title: norm(titleEl.innerText),
        marked: re.test(titleEl.getAttribute("style") || ""),
      });
    }
    return out;
  });
  await page.close();
  return { rows, html };
}

// Replicate applyHighlights' matching: first entry with an equal normalised
// title decides the row, and a row with no matching entry is left alone.
function expectedMarks(entries, rows) {
  const norm = (s) => String(s || "").toLowerCase().replace(/\s+/g, " ").trim();
  const perRow = rows.map((r) => {
    const hit = entries.find((e) => norm(e.rawTitle) === r.title);
    return { row: r, entry: hit || null, want: hit ? lib.isHighlighted(hit) : false };
  });
  const markedRows = perRow.filter((x) => x.row.marked);
  const wantRows = perRow.filter((x) => x.want);
  const changes = perRow.filter((x) => x.want !== x.row.marked);
  // An entry no row matched means the saved page does not contain it at all.
  const unmatched = entries.filter(
    (e) => !rows.some((r) => norm(e.rawTitle) === norm(r.title))
  );
  return { perRow, marked: markedRows.length, want: wantRows.length, changes, unmatched };
}

async function main() {
  const groups = [...lib.groupReports(SUPPORT_DIR, PDF_DIR).values()];
  const targets = onlyPub
    ? groups.filter((g) => g.base === onlyPub)
    : groups;
  if (!targets.length) {
    console.error(onlyPub ? `No filed publication named ${onlyPub}.` : "No filed exhibits found.");
    process.exitCode = 1;
    return;
  }

  const browser = await chromium.launch({ headless: true, channel: "chrome" }).catch(async () => {
    log("[pace] Chrome channel unavailable, using bundled Chromium for parsing.");
    return chromium.launch({ headless: true });
  });

  const results = [];
  let badPages = 0;
  let badPubs = 0;

  for (const g of targets.sort((a, b) => a.base.localeCompare(b.base))) {
    // tally.groupReports already resolved language editions across this
    // publication's pages in order, so the entries here carry the same
    // duplicate_of the ledger and the catalog see.
    let pubOk = true;
    const lines = [];
    for (const p of g.pages) {
      const htmlPath = path.join(SUPPORT_DIR, `${p.base}.html`);
      const pdfPath = path.join(PDF_DIR, `${p.base}.pdf`);
      const pdfProd = path.join(PDF_DIR, "Production", `${p.base}.pdf`);
      const pdf = fs.existsSync(pdfPath) ? pdfPath : fs.existsSync(pdfProd) ? pdfProd : null;
      if (!fs.existsSync(htmlPath)) {
        lines.push({ base: p.base, page: p.page, problem: `saved HTML missing: ${htmlPath}` });
        pubOk = false;
        continue;
      }
      const { rows } = await rowsFromSavedHtml(browser, htmlPath);
      const cmp = expectedMarks(p.entries, rows);
      const editionMarked = p.entries.filter((e) => e.duplicate_of && lib.isHighlightCandidate(e));
      const problems = [];
      if (cmp.marked !== cmp.want) {
        problems.push(`marks ${cmp.marked} vs ${cmp.want} expected under current rules`);
      }
      if (cmp.unmatched.length) {
        problems.push(`${cmp.unmatched.length} report entry/entries not found on the saved page`);
      }
      if (editionMarked.length) {
        problems.push(
          `${editionMarked.length} language edition(s) would be marked: ` +
            editionMarked.map((e) => e.title.slice(0, 48)).join(" | ")
        );
      }
      if (!pdf) problems.push("no exhibit PDF on disk");
      else if (fs.statSync(pdf).size < 1024) problems.push(`exhibit PDF too small (${fs.statSync(pdf).size} B)`);
      else {
        // One saved Scholar page must be one sheet. Read the object tree rather
        // than trusting the print settings, since a page can overflow at any
        // scale and a rule change can add enough text to tip one over.
        const sheets = countPdfPages(fs.readFileSync(pdf));
        if (sheets !== 1) problems.push(`exhibit PDF prints to ${sheets} sheets, expected 1`);
      }

      if (problems.length) {
        pubOk = false;
        for (const c of cmp.changes) {
          problems.push(
            `${c.want ? "SHOULD BE MARKED" : "marked but should not be"}: ` +
              `${(c.entry ? c.entry.title : c.row.title).slice(0, 70)}` +
              (c.entry ? ` [${c.entry.status}/${c.entry.confirm_state || "-"}${c.entry.language_flag ? "/lang" : ""}${c.entry.duplicate_of ? "/edition" : ""}]` : "")
          );
        }
      }
      lines.push({
        base: p.base,
        page: p.page,
        entries: p.entries.length,
        rows: rows.length,
        marks: cmp.marked,
        want: cmp.want,
        pdf: pdf ? `${(fs.statSync(pdf).size / 1024).toFixed(1)} KB` : "MISSING",
        problems,
      });
    }
    if (!pubOk) badPubs++;
    badPages += lines.filter((l) => l.problems && l.problems.length).length;

    if (asCsv) {
      for (const l of lines) {
        results.push({
          publication: g.base,
          page: l.page,
          entries: l.entries ?? "",
          rows: l.rows ?? "",
          marks: l.marks ?? "",
          expected: l.want ?? "",
          pdf: l.pdf ?? "",
          problems: l.problems.join("; "),
        });
      }
    } else {
      log(`\n${g.base}  (${g.pages.length} page(s))`);
      for (const l of lines) {
        log(
          `  p${l.page}  ${l.entries} entries / ${l.rows} rows  marks ${l.marks} (want ${l.want})  PDF ${l.pdf}` +
            (l.problems.length ? "" : "  ok")
        );
        for (const pr of l.problems) log(`     ! ${pr}`);
      }
    }
  }

  await browser.close();

  if (asCsv) {
    const cols = Object.keys(results[0]);
    const esc = (v) => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
    console.log(cols.join(","));
    for (const r of results) console.log(cols.map((c) => esc(r[c])).join(","));
  }

  log(
    `\nAudited ${targets.length} filed publication(s), ` +
      `${targets.reduce((n, g) => n + g.pages.length, 0)} exhibit page(s).`
  );
  if (badPages) {
    log(
      `${badPages} page(s) across ${badPubs} publication(s) disagree with the current rules ` +
        `and need to be re-highlighted.`
    );
    process.exitCode = 1;
  } else {
    log("Every filed page matches the current rules. No exhibit needs re-highlighting.");
  }
}

main().catch((err) => {
  console.error(`Audit failed: ${err && err.stack ? err.stack : err}`);
  process.exitCode = 1;
});

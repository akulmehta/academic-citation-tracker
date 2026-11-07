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
//   3. that no row which does not stand for its work -- a language edition, a
//      same-work fold or a patent-family copy -- carries a mark;
//   4. that the exhibit PDF is ONE sheet -- one Scholar citing page is meant to
//      print to one Letter sheet, and a tall page silently spilling onto a
//      second is invisible to every other check here. Added 2026-11-02 after
//      three filed exhibits were found on two sheets while test-pdf-fit.js
//      reported them fitting, because that test judged by DOM height rather
//      than by the sheets the PDF actually has.
//
// Row matching pairs each row with its entry by Scholar's per-record id
// (data-cid), falling back to a title only where the title is unique on the
// page. tools/row-match.js holds that rule and explains why the capture's
// first-equal-title match cannot be used here: Scholar renders the same title
// twice on a page, and since 2026-11-05 exactly one of those two rows is marked,
// so a title rule gives both rows the same answer and cannot see the difference.
// The same module drives tools/reprint-exhibits.js, so the two cannot disagree.
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
const match = require("./row-match");
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
//
// Each row also carries Scholar's per-record id (data-cid), which is what
// row-match.js uses to pair a row with the entry that decides it. The capture
// reads the same attribute (capture-citations.js:324).
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
    let i = 0;
    for (const row of document.querySelectorAll("#gs_res_ccl_mid .gs_or")) {
      const titleEl = row.querySelector("h3.gs_rt") || row.querySelector(".gs_rt");
      if (!titleEl) continue;
      out.push({
        index: i++,
        cid: row.getAttribute("data-cid") || row.getAttribute("data-aid") || "",
        title: norm(titleEl.innerText),
        marked: re.test(titleEl.getAttribute("style") || ""),
      });
    }
    return out;
  });
  await page.close();
  return { rows, html };
}

// Decide every row of a saved page under the current rule. The matching itself
// lives in tools/row-match.js so this audit and tools/reprint-exhibits.js can
// never disagree about what a page should look like -- if they did, the audit
// would fail a page the re-printer had just corrected, or pass one it broke.
//
// It used to replicate applyHighlights' first-equal-title match here. That could
// not express the decision the rule now makes: Scholar prints the same title
// twice on a page, and since 2026-11-05 exactly one of those two rows is marked.
// A title rule hands both rows the same answer, so three copy marks were
// physically impossible to detect as wrong -- the audit reported those pages
// clean. row-match.js has the full account.
function expectedMarks(entries, rows) {
  const { perRow, basis } = match.planPage(rows, entries, (e) => lib.isHighlighted(e));
  const markedRows = perRow.filter((x) => x.row.marked);
  const wantRows = perRow.filter((x) => x.want);
  const changes = perRow.filter((x) => x.want !== x.row.marked);
  // An entry no row matched means the saved page does not contain it at all.
  const unmatched = entries.filter(
    (e) => !rows.some((r) => (r.cid && e.cid ? r.cid === e.cid : r.title === match.norm(e.rawTitle)))
  );
  // Rows the matcher could not decide: a title repeated on the page with no cid
  // to separate the copies. `want` echoes the current mark for those, so they do
  // not appear as changes -- they are reported as a separate problem instead,
  // because a page this tool cannot read is not a page this tool can certify.
  const ambiguous = perRow.filter((x) => x.basis === "ambiguous");
  return {
    perRow,
    basis,
    ambiguous,
    marked: markedRows.length,
    want: wantRows.length,
    changes,
    unmatched,
    // One mark per entry that earns one. Compared against the mark count so a
    // page missing a row entirely cannot agree with itself.
    wantFromEntries: match.expectedFromEntries(entries, (e) => lib.isHighlighted(e)),
  };
}

// A row that does not stand for its work, by either spelling: `duplicate_of` for
// a language edition or a proven same-work fold, and the standing flag
// (is_primary_copy / is_secondary_copy) for Scholar's second listing of one
// paper. tally.doesNotStand is the single definition -- the audit must not
// restate it here or the two can drift.
function tallyDoesNotStand(e) {
  return lib.doesNotStand(e);
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
      // No row that does not stand for its work may carry a mark. Because rows
      // are now paired by data-cid, `entry` is the row's OWN entry rather than
      // whichever entry happened to share its title, so this catches a marked
      // second listing of a duplicated work -- the class the title match was
      // blind to. It has to look at the PAGE, because that is the only thing it
      // can prove. It used to ask isHighlightCandidate instead -- "would this
      // copy be marked if it stood?" -- which is true of nearly every copy by
      // construction, since the only reason a copy does not stand is the duplicate
      // decision the candidate test deliberately ignores. So it reported
      // "language edition(s) would be marked" on pages whose marks were exactly
      // right, and could not have detected a copy that actually WAS marked. Found
      // 2026-11-04 as the last two "disagreements" after a genuine re-print: both
      // were correct exhibits flagged by a hypothetical.
      const copyRows = cmp.perRow.filter(
        (x) => x.entry && (x.entry.duplicate_of || tallyDoesNotStand(x.entry))
      );
      const copyMarked = copyRows.filter((x) => x.row.marked);
      const problems = [];
      if (cmp.marked !== cmp.want) {
        problems.push(`marks ${cmp.marked} vs ${cmp.want} expected under current rules`);
      }
      // A page that agrees with itself is not necessarily a page that is right:
      // if a row is missing from the saved HTML, the marks can match the rows and
      // still disagree with the entries. Compare against the entry count too.
      if (cmp.want !== cmp.wantFromEntries) {
        problems.push(
          `${cmp.want} rows marked but ${cmp.wantFromEntries} of ${p.entries.length} ` +
            `report entries earn a mark (rows on page: ${rows.length})`
        );
      }
      if (cmp.ambiguous.length) {
        problems.push(
          `${cmp.ambiguous.length} row(s) have a title repeated on the page with no ` +
            `data-cid to tell them apart, so their mark could not be verified: ` +
            cmp.ambiguous.map((x) => x.row.title.slice(0, 48)).join(" | ")
        );
      }
      if (cmp.unmatched.length) {
        problems.push(`${cmp.unmatched.length} report entry/entries not found on the saved page`);
      }
      if (copyMarked.length) {
        problems.push(
          `${copyMarked.length} non-standing cop${
            copyMarked.length === 1 ? "y is" : "ies are"
          } marked, and only the copy that stands may be: ` +
            copyMarked
              .map(
                (x) =>
                  `${x.entry.title.slice(0, 48)} [${
                    x.entry.duplicate_kind || "duplicate"
                  } -> ${x.entry.duplicate_of}]`
              )
              .join(" | ")
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

module.exports = { rowsFromSavedHtml };

if (require.main === module) {
  main().catch((err) => {
    console.error(`Audit failed: ${err && err.stack ? err.stack : err}`);
    process.exitCode = 1;
  });
}

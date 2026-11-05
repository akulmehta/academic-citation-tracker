// Re-print exhibit pages from the saved HTML, without touching Google Scholar.
//
// Why this exists. The yellow marks are applied to the live DOM at capture time
// and then serialised into the saved HTML, so a PDF is a picture of the rules as
// they stood on its capture date. When a counting rule changes, the report JSON
// can be recomputed but the exhibit cannot be brought into line by any existing
// tool: --report rebuilds only the review sheet, and capture would ask Scholar
// again for a page we already hold. This closes that gap offline.
//
// Per page it:
//   1. loads the saved HTML in a headless browser with every request aborted, so
//      nothing reaches the network and the DOM stays exactly as captured;
//   2. removes every existing title highlight, including a debug orange mark;
//   3. re-applies tally.isHighlighted over the publication's entries, matching
//      rows exactly as applyHighlights did (document order, first entry whose
//      normalised rawTitle is equal wins);
//   4. prints with the shared print settings (see print-settings.js) with the
//      same margins as the capture;
//   5. replaces the exhibit only after the new PDF is verified non-trivial, and
//      moves the old one to Exhibits/Archive with a SUPERSEDED- prefix so the
//      filing folder never holds two versions of one page.
//
// The print header is the one thing that cannot be reproduced verbatim. The
// capture relies on Chromium's class="url", which fills from the live address
// bar; over file:// that would print a local path. The stored cites_url is
// printed instead, which is what the header was always meant to show.
//
// Dry run by default. --write is required.
//
//   node tools/reprint-exhibits.js --page=<base>      one page
//   node tools/reprint-exhibits.js --changed          every page whose marks
//                                                     differ from the rules now
//   node tools/reprint-exhibits.js --changed --write  apply
//   node tools/reprint-exhibits.js --changed --check  report only, no printing

const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const lib = require("./tally");
const match = require("./row-match");
const { PRINT_OPTIONS } = require("./print-settings");

const ROOT = path.resolve(__dirname, "..");
const EXHIBITS = path.join(ROOT, "Independent Citation Record", "Exhibits");
const SUPPORT_DIR = path.join(EXHIBITS, "Supporting");
const PDF_DIR = path.join(EXHIBITS, "PDFs");
const ARCHIVE_DIR = path.join(EXHIBITS, "Archive");

const arg = (name, fallback = "") => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const write = process.argv.includes("--write");
const checkOnly = process.argv.includes("--check");
const changedOnly = process.argv.includes("--changed");
const onePage = arg("page");
const onePub = arg("pub");

// Identical to saveArtifacts, so a re-print is indistinguishable from a capture
// apart from the header source.
const PDF_OPTIONS = { ...PRINT_OPTIONS };

function findPdf(base) {
  for (const dir of [PDF_DIR, path.join(PDF_DIR, "Production")]) {
    const p = path.join(dir, `${base}.pdf`);
    if (fs.existsSync(p)) return p;
  }
  return null;
}

// Decide the marks for every page of one publication. tally.groupReports has
// already resolved language editions across the publication's pages in order,
// exactly as the capture did, so the entries here agree with the ledger.
//
// The cid is carried because it, not the title, is what maps an entry to a row.
// See row-match.js: Scholar prints the same title twice on a page often enough
// that a title rule cannot remove one copy's mark, and since 2026-11-05 exactly
// one copy of a duplicated work is marked.
function planPublication(group) {
  const byPage = new Map();
  for (const p of group.pages) {
    byPage.set(
      p.base,
      p.entries.map((e) => ({
        cid: e.cid,
        rawTitle: e.rawTitle,
        highlight: lib.isHighlighted(e),
      }))
    );
  }
  return byPage;
}

// Read every result row of a loaded page, in document order, with the per-record
// id Scholar rendered on it. No decisions happen here -- the row is data, and the
// rule is applied in Node by row-match.js so this tool and the audit share it.
async function readRows(pg) {
  return pg.evaluate(() => {
    const re = /background-color:\s*(rgb\(255,\s*242,\s*0\)|#fff200)/i;
    const out = [];
    let i = 0;
    for (const row of document.querySelectorAll("#gs_res_ccl_mid .gs_or")) {
      const el = row.querySelector("h3.gs_rt") || row.querySelector(".gs_rt");
      if (!el) continue;
      out.push({
        index: i++,
        cid: row.getAttribute("data-cid") || row.getAttribute("data-aid") || "",
        title: el.innerText,
        marked: re.test(el.getAttribute("style") || ""),
      });
    }
    return out;
  });
}

// Paint the rows from an explicit per-row decision list. Matching is already
// done, so this cannot disagree with the comparison that chose to re-print --
// and it can express a one-for-one swap, which a title rule physically cannot.
async function applyMarks(pg, wantByIndex) {
  return pg.evaluate((want) => {
    const rows = [...document.querySelectorAll("#gs_res_ccl_mid .gs_or")];
    let marked = 0;
    let cleared = 0;
    for (let i = 0; i < rows.length; i++) {
      const el = rows[i].querySelector("h3.gs_rt") || rows[i].querySelector(".gs_rt");
      if (!el) continue;
      // Clear first: a mark baked in by an earlier capture must not survive when
      // the rule no longer calls for it, and a debug orange mark must never
      // reach a filing exhibit.
      const had = el.style.backgroundColor !== "";
      el.style.backgroundColor = "";
      el.style.opacity = "";
      if (had) cleared++;
      if (want[i]) {
        el.style.backgroundColor = "#fff200";
        marked++;
      }
    }
    return { marked, cleared, rows: rows.length };
  }, wantByIndex);
}

async function main() {
  const groups = lib.groupReports(SUPPORT_DIR, PDF_DIR);
  const targets = [];
  for (const g of groups.values()) {
    if (onePub && g.base !== onePub) continue;
    const plan = planPublication(g);
    for (const p of g.pages) {
      if (onePage && p.base !== onePage) continue;
      const htmlPath = path.join(SUPPORT_DIR, `${p.base}.html`);
      if (!fs.existsSync(htmlPath)) {
        console.log(`SKIP ${p.base}: no saved HTML`);
        continue;
      }
      const marks = plan.get(p.base) || [];
      targets.push({ group: g, page: p, htmlPath, marks });
    }
  }
  if (!targets.length) {
    console.error("Nothing matched. Use --page=<base>, --pub=<base> or --changed.");
    process.exitCode = 1;
    return;
  }

  const browser = await chromium
    .launch({ headless: true, channel: "chrome" })
    .catch(async () => {
      console.log("[reprint] Chrome channel unavailable, using bundled Chromium.");
      return chromium.launch({ headless: true });
    });

  let reprint = 0;
  let written = 0;
  let failed = 0;

  for (const t of targets) {
    const { page: p, marks } = t;
    const html = fs.readFileSync(t.htmlPath, "utf8");
    const pg = await browser.newPage();
    // Abort everything: the saved DOM already contains its styles inline, and a
    // re-print must never contact a third party.
    await pg.route("**/*", (route) => route.abort());
    await pg.setContent(html, { waitUntil: "domcontentloaded", timeout: 60000 }).catch(() => {});

    // Compare the page row by row, not by counting marks. A one-for-one swap --
    // one row that should be marked and is not, another that should not be and
    // is -- leaves the total untouched, so a count comparison calls such a page
    // already correct and the exhibit ships with two wrong marks. This happened
    // 2026-11-04 on glad-...-p6, where a user decision marked one copy of a
    // folded paper while its duplicate stayed yellow: --changed skipped the page
    // for two days because 9 == 9.
    //
    // Rows are matched by Scholar's per-record id, not by title. Since 2026-11-05
    // only the copy that stands for a work is marked, and Scholar prints the same
    // title twice on a page often enough that a title rule cannot tell the two
    // rows apart -- it gives both the same answer, so three copy marks were
    // physically impossible to remove and --changed reported those pages as
    // already correct. row-match.js explains it in full. The comparison and the
    // apply step below both consume this one decision list, so the choice to
    // re-print and the marks painted cannot disagree.
    const rows = await readRows(pg);
    const { perRow, basis } = match.planPage(rows, marks, (m) => m.highlight);
    const wantByIndex = perRow.map((x) => x.want);
    const before = rows.filter((r) => r.marked).length;
    const want = wantByIndex.filter(Boolean).length;
    const wrong = perRow
      .filter((x) => x.want !== x.row.marked)
      .map(
        (x) =>
          `  ${x.want ? "unmarked-but-should-be" : "marked-but-should-not"}: ` +
          `${match.norm(x.row.title).slice(0, 56)}  [${x.basis}]`
      );
    // A page the matcher could not resolve row by row is a defect, not a pass.
    // Anything other than a clean cid join means a mark here is a guess.
    const unresolved = perRow.filter((x) => x.basis === "ambiguous");
    if (unresolved.length) {
      console.log(
        `  ERROR: ${unresolved.length} row(s) on ${p.base} have a title repeated ` +
          `on the page and no cid to tell them apart. Those rows are left exactly ` +
          `as they are and the page is NOT saved.`
      );
      for (const x of unresolved) console.log(`    ${match.norm(x.row.title).slice(0, 70)}`);
      await pg.close();
      failed++;
      continue;
    }
    // The count a correct page must reach: one mark per entry that earns one.
    // Compared against the entry count rather than the matched-row count so a
    // page that silently dropped a row is caught rather than agreed with.
    const wantFromEntries = match.expectedFromEntries(marks, (m) => m.highlight);
    if (want !== wantFromEntries) {
      console.log(
        `  ERROR: ${p.base} matched ${want} marks but ${wantFromEntries} of ` +
          `${marks.length} report entries earn one (rows on page: ${rows.length}; ` +
          `by cid ${basis.cid}, by title ${basis.title}, no entry ${basis["no-entry"]}). Not saving.`
      );
      await pg.close();
      failed++;
      continue;
    }

    if (changedOnly && wrong.length === 0) {
      await pg.close();
      continue;
    }
    reprint++;
    console.log(`${p.base}  marks ${before} -> ${want}`);
    for (const w of wrong) console.log(w);

    if (checkOnly) {
      await pg.close();
      continue;
    }

    // Strip every previous mark, then paint from the decision list above.
    const applied = await applyMarks(pg, wantByIndex);

    if (applied.marked !== want) {
      console.log(
        `  ERROR: applied ${applied.marked} marks but the rules call for ${want}. ` +
          `Rows on page: ${applied.rows}. Not saving.`
      );
      await pg.close();
      failed++;
      continue;
    }

    const finalHtml = await pg.content();

    if (write) {
      const tmpPdf = path.join(SUPPORT_DIR, `${p.base}.reprint.pdf`);
      const headerTemplate =
        `<div style="font-size:7px;color:#444;width:100%;display:flex;` +
        `justify-content:space-between;padding:0 8mm;overflow:hidden;white-space:nowrap;">` +
        `<span>${escapeHtml(p.cites_url || "")}</span>` +
        `<span>Snapshot ${p.snapshot}</span></div>`;
      const footerTemplate =
        `<div style="font-size:7px;color:#444;width:100%;text-align:center;` +
        `padding:0 8mm;">${escapeHtml(p.base)} - page <span class="pageNumber"></span> of ` +
        `<span class="totalPages"></span></div>`;
      await pg.pdf({ ...PDF_OPTIONS, path: tmpPdf, headerTemplate, footerTemplate });

      const size = fs.existsSync(tmpPdf) ? fs.statSync(tmpPdf).size : 0;
      if (size < 1024) {
        console.log(`  ERROR: re-printed PDF too small (${size} B). Old exhibit left in place.`);
        if (fs.existsSync(tmpPdf)) fs.unlinkSync(tmpPdf);
        await pg.close();
        failed++;
        continue;
      }

      // Archive the PDF it replaces, then install the new one in the same place.
      const old = findPdf(p.base);
      let dest;
      if (old) {
        fs.mkdirSync(ARCHIVE_DIR, { recursive: true });
        const archived = path.join(ARCHIVE_DIR, `SUPERSEDED-${p.base}.pdf`);
        fs.renameSync(old, archived);
        dest = old;
      } else {
        dest = path.join(PDF_DIR, "Production", `${p.base}.pdf`);
        fs.mkdirSync(path.dirname(dest), { recursive: true });
      }
      fs.renameSync(tmpPdf, dest);

      // The saved HTML is what the audit reads, so it has to carry the new marks.
      const bk = path.join(SUPPORT_DIR, `Pre-rule-reapply-${new Date().toISOString().slice(0, 10)}`);
      fs.mkdirSync(bk, { recursive: true });
      const htmlBackup = path.join(bk, `${p.base}.html`);
      if (!fs.existsSync(htmlBackup)) fs.copyFileSync(t.htmlPath, htmlBackup);
      fs.writeFileSync(t.htmlPath, finalHtml, "utf8");
      await pg
        .screenshot({ path: path.join(SUPPORT_DIR, `${p.base}.png`), fullPage: true })
        .catch(() => {});

      console.log(`  wrote ${(size / 1024).toFixed(1)} KB -> ${path.relative(ROOT, dest)}`);
      console.log(`  previous PDF archived as SUPERSEDED-${p.base}.pdf`);
      written++;
    }
    await pg.close();
  }

  await browser.close();
  console.log("");
  console.log(`Pages examined     : ${targets.length}`);
  console.log(`Pages to re-print  : ${reprint}`);
  if (checkOnly) console.log("Check only - nothing printed.");
  else if (!write) console.log("DRY RUN - nothing written. Re-run with --write.");
  else {
    console.log(`Pages re-printed   : ${written}`);
    if (failed) {
      console.log(`FAILED             : ${failed}`);
      process.exitCode = 1;
    }
  }
}

// The header is HTML, and a citing URL can carry characters that must not be
// read as markup.
function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

main();

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
    // for two days because 9 == 9. Matching below is the same first-equal-title
    // rule the apply step uses, so the decision to re-print and the marks applied
    // cannot disagree with each other.
    const state = await pg.evaluate(
      ({ items }) => {
        const norm = (s) => s.toLowerCase().replace(/\s+/g, " ").trim();
        const re = /background-color:\s*(rgb\(255,\s*242,\s*0\)|#fff200)/i;
        let before = 0;
        let want = 0;
        const wrong = [];
        for (const row of document.querySelectorAll("#gs_res_ccl_mid .gs_or")) {
          const el = row.querySelector("h3.gs_rt") || row.querySelector(".gs_rt");
          if (!el) continue;
          const isMarked = re.test(el.getAttribute("style") || "");
          const hit = items.find((i) => norm(i.rawTitle) === norm(el.innerText));
          const should = !!hit && !!hit.highlight;
          if (isMarked) before++;
          if (should) want++;
          if (isMarked !== should) {
            wrong.push(`${should ? "unmarked-but-should-be" : "marked-but-should-not"}: ${norm(el.innerText).slice(0, 56)}`);
          }
        }
        return { before, want, wrong };
      },
      { items: marks.map((m) => ({ rawTitle: m.rawTitle, highlight: m.highlight })) }
    );
    const { before, want } = state;

    if (changedOnly && state.wrong.length === 0) {
      await pg.close();
      continue;
    }
    reprint++;
    console.log(`${p.base}  marks ${before} -> ${want}`);
    for (const w of state.wrong) console.log(`  ${w}`);

    if (checkOnly) {
      await pg.close();
      continue;
    }

    // Strip every previous mark, then apply the current rule with the same row
    // matching applyHighlights uses.
    const applied = await pg.evaluate(
      ({ items }) => {
        const norm = (s) => s.toLowerCase().replace(/\s+/g, " ").trim();
        const rows = [...document.querySelectorAll("#gs_res_ccl_mid .gs_or")];
        let marked = 0;
        let unmatched = 0;
        for (const row of rows) {
          const titleEl = row.querySelector("h3.gs_rt") || row.querySelector(".gs_rt");
          if (!titleEl) continue;
          const t = norm(titleEl.innerText);
          const hit = items.find((i) => norm(i.rawTitle) === t);
          // Clear first: a mark baked in by an earlier capture must not survive
          // when the rule no longer calls for it, and a debug orange mark must
          // never reach a filing exhibit.
          titleEl.style.backgroundColor = "";
          titleEl.style.opacity = "";
          if (!hit) {
            unmatched++;
            continue;
          }
          if (hit.highlight) {
            titleEl.style.backgroundColor = "#fff200";
            marked++;
          }
        }
        return { marked, unmatched, rows: rows.length };
      },
      { items: marks.map((m) => ({ rawTitle: m.rawTitle, highlight: m.highlight })) }
    );

    if (applied.marked !== want) {
      console.log(
        `  ERROR: applied ${applied.marked} marks but the rules call for ${want}. ` +
          `Rows on page: ${applied.rows}, unmatched: ${applied.unmatched}. Not saving.`
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

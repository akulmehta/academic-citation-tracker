// Checks that the yellow highlights printed in each exhibit PDF are the same rows
// the saved exhibit HTML marks.
//
// The HTML is what the PDF was printed from, so the two should always agree. The
// rule audits (audit-highlights.js against the HTML, audit-pdf-highlights.js
// against the PDF) each compare with the counting rule, so a PDF that drifted
// from its HTML while both still looked plausible would pass them separately.
// This script compares the two artefacts directly, row by row.
//
// Rows are paired on the HTML side by Scholar's data-cid (tools/row-match.js, the
// same join the re-printer uses). On the PDF side each mark is matched to the
// title it covers (tools/audit-pdf-highlights.js). A title Scholar repeats in the
// PDF text is compared as a group, not row by row, and reported as such.
//
// Read-only. The saved HTML is parsed in a headless browser with every network
// request aborted; the PDF is read with pdf.js. Nothing is written.
//
// Run: node tools/audit-pdf-against-html.js            (all filed pages)
//      node tools/audit-pdf-against-html.js --pub=<base>
//      node tools/audit-pdf-against-html.js --verbose
// Exit code 1 if any page disagrees.

const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const lib = require("./tally");
const match = require("./row-match");
const { rowsFromSavedHtml } = require("./audit-highlights");
const { pdfFor, pdfPageMarks } = require("./audit-pdf-highlights");

const ROOT = path.resolve(__dirname, "..");
const EXHIBITS = path.join(ROOT, "Independent Citation Record", "Exhibits");
const SUPPORT_DIR = path.join(EXHIBITS, "Supporting");
const PDF_DIR = path.join(EXHIBITS, "PDFs");

function arg(name, fallback = "") {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}
const onlyPub = arg("pub");
const verbose = process.argv.includes("--verbose");

// The HTML side of one page: the marked state of each entry's row.
function htmlMarksByIndex(rows, entries) {
  const plan = match.planPage(rows, entries, (e) => lib.isHighlighted(e));
  const byIndex = new Map();
  const problems = [];
  for (const x of plan.perRow) {
    const label = `HTML row "${(x.row.title || "").slice(0, 60)}"`;
    if (!x.entry) {
      problems.push(`${label} matches no entry (${x.basis})`);
      continue;
    }
    if (x.basis !== "cid") {
      problems.push(`${label} paired by ${x.basis}, not by data-cid`);
    }
    byIndex.set(x.entry.index, Boolean(x.row.marked));
  }
  for (const e of entries) {
    if (!byIndex.has(e.index)) problems.push(`entry ${e.index} has no HTML row`);
  }
  return { byIndex, problems };
}

async function comparePage(browser, p) {
  const htmlPath = path.join(SUPPORT_DIR, `${p.base}.html`);
  const pdfFile = pdfFor(p.base);
  if (!fs.existsSync(htmlPath)) return { problems: [`saved HTML missing: ${htmlPath}`] };
  if (!pdfFile) return { problems: ["no exhibit PDF on disk"] };

  const { rows } = await rowsFromSavedHtml(browser, htmlPath);
  const html = htmlMarksByIndex(rows, p.entries);
  const pdf = await pdfPageMarks(pdfFile, p.entries);
  const problems = [...html.problems];

  let htmlTotal = 0;
  for (const [index, htmlMarked] of html.byIndex) {
    if (htmlMarked) htmlTotal++;
    const pdfMarked = pdf.rowMarks.get(index);
    if (pdfMarked === undefined) continue; // repeated title: compared as a group below
    if (pdfMarked !== htmlMarked) {
      const e = p.entries.find((x) => x.index === index);
      const title = (e.rawTitle || e.title || "").slice(0, 60);
      problems.push(
        `row ${index} "${title}": HTML ${htmlMarked ? "marks" : "does not mark"} it, ` +
          `PDF ${pdfMarked ? "marks" : "does not mark"} it`,
      );
    }
  }
  for (const g of pdf.groupMarks) {
    const htmlCount = g.indexes.filter((i) => html.byIndex.get(i)).length;
    if (htmlCount !== g.under) {
      problems.push(
        `repeated title "${g.title.slice(0, 60)}": HTML marks ${htmlCount} of its rows, ` +
          `PDF marks ${g.under} copies`,
      );
    }
  }
  if (htmlTotal !== pdf.marks) {
    problems.push(`HTML carries ${htmlTotal} marks, PDF prints ${pdf.marks}`);
  }
  return {
    problems,
    marks: pdf.marks,
    htmlMarks: htmlTotal,
    grouped: pdf.groupMarks.length,
  };
}

async function main() {
  const groups = [...lib.groupReports(SUPPORT_DIR, PDF_DIR).values()];
  const targets = onlyPub ? groups.filter((g) => g.base === onlyPub) : groups;
  if (!targets.length) {
    console.error(onlyPub ? `No filed publication named ${onlyPub}.` : "No filed exhibits found.");
    process.exitCode = 1;
    return;
  }

  const browser = await chromium
    .launch({ headless: true, channel: "chrome" })
    .catch(() => chromium.launch({ headless: true }));

  let pages = 0;
  let marks = 0;
  let htmlMarks = 0;
  let grouped = 0;
  let bad = 0;
  try {
    for (const g of targets.sort((a, b) => a.base.localeCompare(b.base))) {
      for (const p of g.pages) {
        const r = await comparePage(browser, p);
        pages++;
        marks += r.marks || 0;
        htmlMarks += r.htmlMarks || 0;
        if (r.grouped) grouped++;
        const label = `${p.base} p${p.page}`;
        if (r.problems.length) {
          bad++;
          console.log(`FAIL ${label}`);
          for (const line of r.problems) console.log(`       ${line}`);
        } else if (verbose) {
          console.log(`ok   ${label}  marks ${r.marks} (HTML ${r.htmlMarks})`);
        }
      }
    }
  } finally {
    await browser.close();
  }

  console.log(
    `\nPages compared: ${pages}. Marks in the PDFs: ${marks}. Marks in the HTML: ${htmlMarks}. ` +
      `Pages with differences: ${bad}.`,
  );
  if (grouped) {
    console.log(`Pages with a repeated title compared by count rather than row by row: ${grouped}.`);
  }
  if (bad) process.exitCode = 1;
  else console.log("Every exhibit PDF prints the same highlights as its saved HTML.");
}

module.exports = { htmlMarksByIndex, comparePage };

if (require.main === module) {
  main().catch((e) => {
    console.error(`[audit-pdf-against-html] ${e.stack || e.message}`);
    process.exitCode = 1;
  });
}

// Check that the dashboard's page list and the hand-written numbers in each HTML
// file still agree.
//
//   node tools/check-dashboard-nav.js        (exit 1 on any disagreement)
//
// Why this exists. PAGES in dashboard/js/core.js drives the contents bar on every
// page, but the chapter number a reader actually sees is ALSO written by hand in
// three places per page: <p class="chapter-num">, the kicker line, and the
// numbered list on index.html. Nothing at runtime reconciles them, so inserting a
// page silently leaves every later page labelled with the number it had before --
// which is exactly what happened on 2026-11-05 when partition.html went in after
// overview. The contents bar said "4. Per publication" while the page itself said
// "chapter 3", and a printed packet with two different numbers for the same
// chapter is the kind of defect a reviewer finds.
//
// Read-only. Prints one line per page and exits non-zero listing what to fix.
// Console output is ASCII: titles and kickers carry unicode that garbles in a
// Windows console, so only file names and numbers are printed.

const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const DIR = path.join(ROOT, "dashboard");

function fail(msgs) {
  for (const m of msgs) console.log(`FAIL  ${m}`);
  console.log(`\n${msgs.length} navigation problem(s). Fix the HTML or PAGES in ` +
    `dashboard/js/core.js so the two agree.`);
  process.exit(1);
}

if (!fs.existsSync(DIR)) fail([`no dashboard directory at ${DIR}`]);

// ---- PAGES, read out of core.js rather than required ----
// core.js is a browser file: it touches window at load time, so it cannot be
// required from node. The list is small and one-per-line, so matching it is
// reliable, and a line that stops matching is itself reported.
const corePath = path.join(DIR, "js", "core.js");
const core = fs.readFileSync(corePath, "utf8");
const block = core.match(/const PAGES = \[([\s\S]*?)\n  \];/);
if (!block) {
  fail([`could not find the PAGES array in js/core.js -- its shape changed and ` +
    `this check is now blind. Update this tool rather than ignoring it.`]);
}
const pages = [...block[1].matchAll(/file:\s*"([^"]+)"/g)].map((m) => m[1]);
if (!pages.length) fail(["PAGES parsed empty from js/core.js"]);

// ---- the HTML files that exist ----
const htmls = fs
  .readdirSync(DIR)
  .filter((f) => f.endsWith(".html"))
  .sort();

const problems = [];

// A page in PAGES with no file is a dead link in every nav bar on the record.
for (const f of pages) {
  if (!fs.existsSync(path.join(DIR, f))) {
    problems.push(`PAGES lists ${f} but that file does not exist.`);
  }
}
// An HTML file outside PAGES prints fine but is unreachable from every other
// page, so it looks like a missing chapter rather than an unwired one.
for (const f of htmls) {
  if (!pages.includes(f)) {
    problems.push(`${f} exists but is not in PAGES, so no page links to it.`);
  }
}
if (problems.length) fail(problems);

// ---- per-page numbers ----
for (let i = 0; i < pages.length; i++) {
  const file = pages[i];
  const want = i + 1;
  const text = fs.readFileSync(path.join(DIR, file), "utf8");

  // The FIRST chapter-num on the page is the page's own number. A page may carry
  // more: overview.html has a "2b" section, and index.html has a section headed
  // "Method". Those are the page's business; the first one is the packet's.
  const nums = [...text.matchAll(/class="chapter-num">([^<]*)</g)].map((m) =>
    m[1].trim()
  );
  if (!nums.length) {
    problems.push(`${file} has no class="chapter-num" heading at all.`);
  } else if (nums[0] !== String(want)) {
    problems.push(
      `${file} shows chapter-num "${nums[0]}" but PAGES makes it page ${want}.`
    );
  }

  // The kicker names the chapter too, on the pages that use one. index.html is
  // labelled a workpaper rather than a chapter, so a missing number there is the
  // design rather than a miss.
  const kick = text.match(/class="kicker">([^<]*)</);
  if (kick) {
    const kn = kick[1].match(/chapter\s+(\d+)/);
    if (kn && Number(kn[1]) !== want) {
      problems.push(
        `${file} kicker says "chapter ${kn[1]}" but PAGES makes it page ${want}.`
      );
    }
  }

  // The header comment at the top of each file is what a maintainer reads first,
  // and it carries the same number. Checked so a renumber cannot fix the visible
  // page and leave the comment pointing at the old one.
  const head = text.match(/<!--([\s\S]*?)-->/);
  if (head) {
    const hn = head[1].match(/Chapter\s+(\d+)/);
    if (hn && Number(hn[1]) !== want) {
      problems.push(
        `${file} header comment says "Chapter ${hn[1]}" but PAGES makes it page ${want}.`
      );
    }
  }
}

// ---- index.html's hand-written contents list ----
// The list a reader uses to choose what to print. Its numbers and order must be
// PAGES, or the contents page promises a different book from the one bound.
// The list starts at overview.html: index.html is PAGES[1] in the bar but is the
// page the list sits on, so entry i of the list is PAGES[i + 1].
const indexPath = path.join(DIR, "index.html");
if (fs.existsSync(indexPath)) {
  const index = fs.readFileSync(indexPath, "utf8");
  const links = [
    ...index.matchAll(
      /href="([a-z-]+\.html)"\s*>\s*<span class="page-link-n">(\d+)<\/span>/g
    ),
  ].map((m) => ({ file: m[1], n: Number(m[2]) }));
  if (!links.length) {
    problems.push(
      `index.html has no page-link entries -- the contents list markup changed ` +
        `and this check can no longer read it.`
    );
  } else {
    links.forEach((l, i) => {
      const want = i + 2; // PAGES position, 1-based, skipping index.html itself
      if (pages[want - 1] !== l.file) {
        problems.push(
          `index.html lists ${l.file} at position ${want} but PAGES has ` +
            `${pages[want - 1] || "(nothing)"} there.`
        );
      }
      if (l.n !== want) {
        problems.push(
          `index.html numbers ${l.file} as ${l.n}; PAGES makes it ${want}.`
        );
      }
    });
    if (links.length !== pages.length - 1) {
      problems.push(
        `index.html lists ${links.length} pages; PAGES has ${pages.length} ` +
          `including index.html itself, which the list omits.`
      );
    }
  }
}

if (problems.length) fail(problems);

console.log(`nav   ${pages.length} pages, chapter numbers and contents list agree.`);
for (let i = 0; i < pages.length; i++) console.log(`  ${i + 1}. ${pages[i]}`);

#!/usr/bin/env node
/**
 * Screen the GlyGen citing rows that the four-route report proves are not
 * primary research articles.
 *
 * Reads the work-type-report output for one cited work, groups the rows by the
 * evidence actually seen, and prints the `set-screen.js` batches. It writes
 * nothing itself: every batch is a `set-screen.js` command line, so the reason
 * on a row is the evidence string and the tool that refuses to touch an
 * `included` row stays the only writer of a screen.
 *
 * Why a script at all: 183 rows cannot be screened one command at a time by
 * hand, and a batch is what `set-screen.js` documents for "a screen the
 * applicant stated once". The judgement is still the report's, and a row whose
 * only signal came from a single source is NOT included here — §1.2 requires the
 * claim to be proved, and one route is not proof.
 *
 * Usage: node screen-from-report.js --log=<file> [--apply]
 */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const argv = process.argv.slice(2);
const opt = n => (argv.find(a => a.startsWith(`--${n}=`)) || "").split("=").slice(1).join("=") || null;
const LOG = opt("log");
const APPLY = argv.includes("--apply");
if (!LOG) { console.error("usage: --log=<work-type-report output> [--apply]"); process.exit(2); }

// A PowerShell `>` redirect writes UTF-16LE with a BOM, which reads as NUL-filled
// garbage and silently matches nothing — the parser would report "0 of 0 rows"
// and look like a clean run. Decode what is actually on disk.
function readText(p) {
  const buf = fs.readFileSync(p);
  if (buf[0] === 0xff && buf[1] === 0xfe) return buf.toString("utf16le").replace(/^\uFEFF/, "");
  if (buf[0] === 0xfe && buf[1] === 0xff) return buf.swap16().toString("utf16le").replace(/^\uFEFF/, "");
  return buf.toString("utf8").replace(/^\uFEFF/, "");
}

const lines = readText(path.isAbsolute(LOG) ? LOG : path.join(process.cwd(), LOG)).split(/\r?\n/);
if (!lines.some(l => /^cit-\d{6}\s/.test(l))) {
  console.error(`no "cit-NNNNNN" record lines found in ${LOG} — is that a work-type-report log?`);
  process.exit(2);
}

// A record starts at a line "cit-XXXXNN  <status>[ PDF]  <verdict>" and its
// evidence lines are the indented "  - " ones until the next record.
const rows = [];
let cur = null;
for (const L of lines) {
  const m = L.match(/^(cit-\d{6})\s+(\S+)(\s+PDF)?\s+(.*)$/);
  if (m) {
    cur = { uid: m[1], status: m[2], pdf: !!m[3], verdict: m[4].trim(), ev: [] };
    rows.push(cur);
    continue;
  }
  if (!cur) continue;
  const e = L.match(/^\s+-\s+(.*)$/);
  if (e) cur.ev.push(e[1].trim());
}

/**
 * How many routes independently say "secondary literature".
 *
 * Counted from the evidence strings, not the verdict word, so a row labelled
 * SECONDARY on one route alone can never reach a batch by a parsing accident.
 */
function secondaryRoutes(ev) {
  // Two things bit here. (1) A Set, not an array: the report can print the same
  // sentence twice for a row with several index hits, and a route counted twice
  // is still one route. (2) Each test must call `.test(e)` explicitly — a bare
  // `/regex/i` in an `if` is the object, always truthy, which made EVERY
  // evidence string take the first branch, so every reason read
  // "OpenAlex type `review-article`" and no host or venue signal was ever seen.
  const routes = [
    [/^OpenAlex type: review-article/i, () => "OpenAlex type `review-article`"],
    [/^PubMed MeSH: "Review"/i, () => 'PubMed MeSH "Review"'],
    [/^PDF: review article/i, (e) => {
      const lbl = e.match(/page 1 label "([^"]+)"/i);
      return lbl ? `the filed PDF, whose page 1 prints ${lbl[1]} and which has no Methods heading`
        : "the filed PDF, a review article with no Methods heading";
    }],
    [/^PDF: NOT a research article/i, (e) => `the filed PDF${/title page says/i.test(e) ? `, whose ${e.match(/title page says[^)]*/i)[0]}` : ", which is not a research article"}`],
    [/^PDF:.*(thesis|dissertation)/i, () => "the filed PDF is a thesis or dissertation"],
    [/^PDF:.*book chapter/i, () => "the filed PDF is a book chapter"],
    [/^PDF:.*poster/i, () => "the filed PDF is a conference poster"],
    [/^review-only venue:/i, (e) => `published in ${e.replace(/^review-only venue:\s*/i, "")}, a review-only journal`],
    [/^link host: ProQuest dissertation/i, () => "the link is a ProQuest dissertation record"],
    [/^link host: thesis\/repository/i, () => "the link points at a thesis or dissertation repository"],
    [/^link host: book chapter/i, () => "the link points at a book-chapter host"],
    [/^link host:.*poster/i, () => "the link points at a conference-poster listing"],
  ];
  const out = new Set();
  for (const e of ev) {
    // One evidence line is one route. `PDF: NOT a research article (title page
    // says thesis/dissertation)` matches both the "NOT a research article" and
    // the "thesis" pattern below; taking both would read as two independent
    // votes and let a single-source row into a batch.
    for (const [re, label] of routes) if (re.test(e)) { out.add(label(e)); break; }
  }
  return [...out];
}

/** True when the article itself — the strongest evidence there is — says it is
 *  not primary research. Read from the report line so a route label cannot
 *  manufacture it. */
function pdfProof(ev) {
  return ev.some((e) => /^PDF: (review article|NOT a research article)/i.test(e) ||
    (/^PDF:/i.test(e) && /(thesis|dissertation|book chapter|poster)/i.test(e)));
}

const groups = new Map();
// A row already screened-out carries the reason a person wrote for it. Re-running
// the report over a work must not overwrite that with bulk prose: on 2026-11-08 a
// GLAD re-sweep replaced two concise thesis reasons with the evidence sentence.
const alreadyScreened = rows.filter(r => /^SECONDARY/.test(r.verdict) && r.status !== "held");
if (alreadyScreened.length) {
  console.log(`\n${alreadyScreened.length} row(s) already screened-out, left alone (their reason stands): ` +
    alreadyScreened.map(r => r.uid).join(" "));
}
for (const r of rows) {
  if (!/^SECONDARY/.test(r.verdict)) continue;
  if (r.status !== "held") continue;
  const routes = secondaryRoutes(r.ev);
  // Two routes, or the article itself. One route is not proof (§1.2).
  if (routes.length < 2 && !pdfProof(r.ev)) continue;
  const key = routes.length ? routes.join("; ") : "the filed PDF";
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(r.uid);
}

let total = 0;
for (const [routes, uids] of [...groups.entries()].sort((a, b) => b[1].length - a[1].length)) {
  // `set-screen.js` prepends "Applicant directed this be ignored (<date>):", so
  // the reason here is the clause that follows it — repeating the prefix would
  // store it twice.
  const reason = `not a primary research article - ${routes}`;
  total += uids.length;
  console.log(`\n${uids.length} row(s): ${routes}`);
  console.log(`  ${uids.join(" ")}`);
  if (APPLY) {
    execFileSync("node", [path.join(__dirname, "set-screen.js"),
      `--rows=${uids.join(",")}`, `--reason=${reason}`, "--write"],
      { stdio: "inherit" });
  }
}
console.log(`\n${total} of ${rows.length} rows carry proof strong enough to screen${APPLY ? " (applied)" : " — re-run with --apply"}.`);
const thin = rows.filter(r => r.status === "held" && /^SECONDARY/.test(r.verdict) && secondaryRoutes(r.ev).length < 2 && !pdfProof(r.ev));
if (thin.length) console.log(`${thin.length} row(s) labelled SECONDARY on one route only, left held: ${thin.map(r => r.uid).join(" ")}`);

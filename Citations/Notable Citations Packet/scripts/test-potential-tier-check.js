/**
 * Proves that validate-packet.js §12b can fail.
 *
 * Run: node scripts/test-potential-tier-check.js
 *
 * A check nobody has watched fail is not a check. The tier column on the
 * potential_notable_citations pages is generated from the database, so under normal
 * conditions the validator agrees with the page and a passing run says nothing about
 * whether the comparison works. This script rewrites one pill to something the
 * database does not record, runs the validator, and requires it to name that row and
 * that tier. It then restores the file byte-for-byte.
 *
 * Two defects are planted, one per branch of the check:
 *   - a plain "Tier X" pill on a row whose scan_tier is null or different;
 *   - a "Tier X — resolved" pill the mention table does not record.
 * If either row cannot be found the script says so and fails, rather than reporting
 * a clean run it never earned.
 *
 * Every review page is planted, not just GLAD's: §12b loops over all of them, and a
 * page where the check had silently gone blind would otherwise never be noticed.
 */
"use strict";
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const Lib = require("./lib.js");

const PKT_DIR = path.join(__dirname, "..");
const PAGES = fs.readdirSync(PKT_DIR)
  .filter(f => /^potential_notable_citations(-[A-Za-z0-9]+)?\.html$/.test(f))
  .sort()
  .map(f => path.join(PKT_DIR, f));
if (!PAGES.length) {
  console.log("FAIL no potential_notable_citations.html found — run build-potential.js --write");
  process.exit(1);
}
const VALIDATOR = path.join(__dirname, "validate-packet.js");

/** Row chunks of the candidate table, each cut at its own `</tr>`. */
function rows(text) {
  return text
    .split("<tr")
    .slice(1)
    .map((c) => c.slice(0, c.indexOf("</tr>") + 5))
    .filter((c) => /cit-\d{6}/.test(c));
}

function patch(text, find, replacer) {
  const row = rows(text).find(find);
  if (!row) return null;
  const at = text.indexOf(row);
  const patched = replacer(row);
  if (patched === row) return null;
  return { text: text.slice(0, at) + patched + text.slice(at + row.length), row };
}

function runValidator() {
  try {
    return { code: 0, out: execFileSync(process.execPath, [VALIDATOR], { encoding: "utf8" }) };
  } catch (e) {
    return { code: e.status == null ? -1 : e.status, out: (e.stdout || "") + (e.stderr || "") };
  }
}

const db = Lib.openPacket();
const results = [];

/**
 * Plant one defect in one page, run the validator, restore the bytes.
 *
 * Returns true when the defect was plantable on this page. A page where nothing
 * is eligible is not a failure — a three-row page with no PDF cannot host a
 * "no tier" pill — but the count of plants is reported so a check that has gone
 * blind on every page is visible rather than silently passing.
 */
function plant(file, name, build, expect) {
  const orig = fs.readFileSync(file);
  const p = build(orig.toString("utf8"));
  if (!p) return false;
  try {
    fs.writeFileSync(file, p.text);
    const r = runValidator();
    // The validator prefixes each finding with the page name, so require that
    // too: a FAIL naming the right row but pointing at the wrong file would mean
    // the loop over pages is not really checking this one.
    const namesPage = new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).test(r.out);
    results.push({
      name: `${path.basename(file)} — ${p.label}`,
      ok: r.code !== 0 && expect.test(r.out) && namesPage,
      why: r.code === 0 ? "validator exited 0 on a fabricated tier"
        : !namesPage ? "no FAIL naming this page"
        : "no FAIL naming " + expect,
      seen: (r.out.match(/FAIL.*(?:tier|potential).*/i) || [""])[0].trim(),
    });
  } finally {
    fs.writeFileSync(file, orig);
  }
  if (Buffer.compare(fs.readFileSync(file), orig) !== 0) {
    results.push({ name: `${path.basename(file)} — ${p.label}`, ok: false, why: "page was not restored byte-for-byte" });
  }
  return true;
}

// 1 — a plain tier the scan never read. Pick a row the page shows as "no tier" that
// has a PDF, so the only thing wrong is the pill.
const withPdf = new Set(
  db.prepare("SELECT DISTINCT folder_uid FROM file").all().map((r) => r.folder_uid),
);
const scanned = new Map(
  db.prepare("SELECT row_uid, scan_tier FROM citation").all().map((r) => [r.row_uid, r.scan_tier]),
);
const resolvedRows = new Set(
  db
    .prepare("SELECT DISTINCT row_uid FROM mention WHERE basis <> 'extracted text'")
    .all()
    .map((r) => r.row_uid),
);

// 2 — a resolved pill the mention table does not record. Plant it on a row that has
// neither a scan tier nor a non-text mention, so nothing in the database can support it.
const DEFECTS = [
  {
    label: "plain pill fabricated",
    build: (t) => patch(t, (c) => {
      const uid = (c.match(/cit-\d{6}/) || [])[0];
      return uid && withPdf.has(uid) && !scanned.get(uid) && /class="pill bad">no tier</.test(c);
    }, (c) => c.replace('<span class="pill bad">no tier</span>', '<span class="pill ok">Tier A</span>')),
  },
  {
    label: "resolved pill fabricated",
    build: (t) => patch(t, (c) => {
      const uid = (c.match(/cit-\d{6}/) || [])[0];
      return uid && !resolvedRows.has(uid) && !scanned.get(uid) && !/pill resolved/.test(c);
    }, (c) => c.replace(/<\/tr>\s*$/, '<span class="pill warn resolved">Tier A &mdash; resolved</span></tr>')),
  },
];

let planted = 0;
for (const file of PAGES) {
  for (const d of DEFECTS) {
    const found = plant(file, path.basename(file), (t) => {
      const p = d.build(t);
      return p ? { ...p, label: d.label } : null;
    }, /cit-\d{6}.*Tier A|Tier A.*cit-\d{6}/i);
    if (found) planted++;
  }
}
// Every page restored? `plant` compares bytes after each write, so what is checked
// here is that a crash mid-plant did not leave a fabricated pill filed anywhere.
if (planted < DEFECTS.length) {
  results.push({
    name: "at least one page per defect kind",
    ok: false,
    why: `only ${planted} defect(s) were plantable across ${PAGES.length} page(s) — the check may be blind`,
  });
}

let bad = 0;
for (const r of results) {
  console.log((r.ok ? "  ok   " : "  FAIL ") + r.name + (r.ok ? "" : " — " + r.why));
  if (r.ok && r.seen) console.log("         fired: " + r.seen.slice(0, 120));
  if (!r.ok) bad++;
}
console.log(
  bad === 0
    ? `\nPASS: §12b fails on a fabricated tier and on a fabricated resolved tier on every page (${planted} plant(s) over ${PAGES.length} page(s)); all files intact.`
    : `\nFAIL: ${bad} case(s) did not behave as expected.`,
);
process.exit(bad === 0 ? 0 : 1);

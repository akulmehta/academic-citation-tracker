/**
 * Proves that validate-packet.js §12b can fail.
 *
 * Run: node scripts/test-potential-tier-check.js
 *
 * A check nobody has watched fail is not a check. The tier column on
 * potential_notable_citations.html is generated from the database, so under normal
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
 */
"use strict";
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const Lib = require("./lib.js");

const PAGE = path.join(__dirname, "..", "potential_notable_citations.html");
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

const orig = fs.readFileSync(PAGE);
const text = orig.toString("utf8");
const db = Lib.openPacket();
const results = [];

function plant(name, build, expect) {
  const p = build(text);
  if (!p) {
    results.push({ name, ok: false, why: "could not find a row to plant the defect in" });
    return;
  }
  fs.writeFileSync(PAGE, p.text);
  const r = runValidator();
  results.push({
    name,
    ok: r.code !== 0 && expect.test(r.out),
    why: r.code === 0 ? "validator exited 0 on a fabricated tier" : "no FAIL naming " + expect,
    seen: (r.out.match(/FAIL.*(?:tier|potential).*/i) || [""])[0].trim(),
  });
}

// 1 — a plain tier the scan never read. Pick a row the page shows as "no tier" that
// has a PDF, so the only thing wrong is the pill.
const withPdf = new Set(
  db.prepare("SELECT DISTINCT folder_uid FROM file").all().map((r) => r.folder_uid),
);
const scanned = new Map(
  db.prepare("SELECT row_uid, scan_tier FROM citation").all().map((r) => [r.row_uid, r.scan_tier]),
);
plant(
  "plain pill fabricated",
  (t) =>
    patch(
      t,
      (c) => {
        const uid = (c.match(/cit-\d{6}/) || [])[0];
        return (
          uid &&
          withPdf.has(uid) &&
          !scanned.get(uid) &&
          /class="pill bad">no tier</.test(c)
        );
      },
      (c) => c.replace('<span class="pill bad">no tier</span>', '<span class="pill ok">Tier A</span>'),
    ),
  /cit-\d{6}.*Tier A|Tier A.*cit-\d{6}/i,
);

// 2 — a resolved pill the mention table does not record. Plant it on a row that has
// neither a scan tier nor a non-text mention, so nothing in the database can support it.
const resolvedRows = new Set(
  db
    .prepare("SELECT DISTINCT row_uid FROM mention WHERE basis <> 'extracted text'")
    .all()
    .map((r) => r.row_uid),
);
plant(
  "resolved pill fabricated",
  (t) =>
    patch(
      t,
      (c) => {
        const uid = (c.match(/cit-\d{6}/) || [])[0];
        return uid && !resolvedRows.has(uid) && !scanned.get(uid) && !/pill resolved/.test(c);
      },
      (c) =>
        c.replace(
          /<\/tr>\s*$/,
          '<span class="pill warn resolved">Tier A &mdash; resolved</span></tr>',
        ),
    ),
  /cit-\d{6}.*Tier A|Tier A.*cit-\d{6}/i,
);

fs.writeFileSync(PAGE, orig);
const restored = Buffer.compare(fs.readFileSync(PAGE), orig) === 0;

let bad = 0;
for (const r of results) {
  console.log((r.ok ? "  ok   " : "  FAIL ") + r.name + (r.ok ? "" : " — " + r.why));
  if (r.ok && r.seen) console.log("         fired: " + r.seen.slice(0, 120));
  if (!r.ok) bad++;
}
if (!restored) {
  console.log("  FAIL the page was not restored byte-for-byte");
  bad++;
}
console.log(
  bad === 0
    ? "\nPASS: §12b fails on a fabricated tier and on a fabricated resolved tier; the page is intact."
    : `\nFAIL: ${bad} case(s) did not behave as expected.`,
);
process.exit(bad === 0 ? 0 : 1);

/**
 * Checks for `heldPdfIndex()` in lib.js.
 *
 * Run: node scripts/test-held-pdf.js
 *
 * Every case here is a row the retrieval queue got wrong on 2026-11-13. The queue
 * asked only whether `citation.pdf_file` named a file that existed, and offered
 * 146 papers we already held. `cit-000182` was the one the applicant noticed: its
 * PDF had been in `pending-papers/` for five days. A predicate that misses those
 * re-fetches paywalled articles a tab at a time and can overwrite nothing but
 * wastes an afternoon, so the point of this file is that each of the four routes
 * to "we have it" is actually consulted.
 */
"use strict";
const { openPacket, heldPdfIndex } = require("./lib.js");

let pass = 0, fail = 0;
function ok(cond, what) {
  if (cond) { pass++; return; }
  fail++;
  console.error(`FAIL  ${what}`);
}

const db = openPacket();
const held = heldPdfIndex(db);

/* ---- rows that must read as held, one per route ---- */
const cases = [
  ["cit-000182", "pending-papers group folder", /pending-papers\/cit-000182/],
  ["cit-000514", "downloads file named <uid>-Surname.pdf", /downloads\/cit-000514-Petralia\.pdf/],
  ["cit-001262", "screened-papers group folder", /screened-papers\/cit-001262/],
  ["cit-000560", "staged in downloads/ with no file row", /downloads\/cit-000560-Feizi\.pdf/],
];
for (const [uid, why, re] of cases) {
  const row = db.prepare("SELECT row_uid, folder_uid, pdf_file, source_pdf FROM citation WHERE row_uid = ?").get(uid);
  ok(!!row, `${uid} exists in the packet`);
  if (!row) continue;
  const h = held(row.folder_uid, row);
  ok(h.held, `${uid} held (${why})`);
  ok(re.test(h.why || ""), `${uid} names the ${why} in .why`);
}

/* ---- a row we do not have must read as not held ---- */
// Pick the first held/review row the index rejects, so the test cannot drift into
// asserting a specific uid forever.
const rows = db.prepare(`
  SELECT row_uid, folder_uid, pdf_file, source_pdf FROM citation
   WHERE status IN ('held','review') ORDER BY row_uid`).all();
const free = rows.filter(r => !held(r.folder_uid, r).held);
ok(free.length > 0, "some held/review rows are genuinely not on disk");
ok(free.length < rows.length, "and most are, so the index is doing real work");

/* ---- .why is only set when held, so a caller can print it ---- */
for (const r of free.slice(0, 5)) {
  const h = held(r.folder_uid, r);
  ok(h.held === false && h.why === undefined, `${r.row_uid} not held carries no .why`);
}

console.log(`\n${pass} passed, ${fail} failed`);
db.close();
process.exit(fail ? 1 : 0);

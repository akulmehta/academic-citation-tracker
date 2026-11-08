#!/usr/bin/env node
/**
 * Reconcile `candidate.discover_state` with what is actually on disk.
 *
 * The candidate queue is where the applicant decides what to chase. When it says
 * "Paywalled" or "Open copy found" beside a folder that already holds the article,
 * it sends someone off to fetch a paper that is on the shelf — and the state table
 * in PACKET-STATUS.md defines `open-copy` as "the row is only `has-pdf` once the
 * file is on disk", so a row with the file and the old state contradicts the
 * definition printed ten lines above it.
 *
 * It happens because two writers set the state and neither re-checks the other:
 * `discover-pdfs.js` marks a row when its own fetch succeeds, while a PDF filed by
 * `file-pdf.js` or placed by the applicant updates `citation` and `file` only.
 * `file-pdf.js` now moves its own rows; this catches the rest, including anything
 * written before that change.
 *
 * Only the state and a note change. `pdf_file` is left alone where it is already
 * correct, and set where the candidate has none but its folder holds one — the
 * applicant-placed folders legitimately have no fetch URL, so an empty `pdf_file`
 * beside a real file is normal and is not treated as a defect.
 *
 * Usage:
 *   node scripts/sync-candidate-state.js            # report
 *   node scripts/sync-candidate-state.js --write    # apply (backs up first)
 *   node scripts/sync-candidate-state.js --check    # exit 1 if any row is stale
 */
"use strict";
const fs = require("fs");
const path = require("path");
const { PACKET_DB, openPacket } = require("./lib.js");

const WRITE = process.argv.includes("--write");
const CHECK = process.argv.includes("--check");

const db = openPacket();

// A candidate is stale when its folder holds a file and its state still describes
// the search rather than the finding. `has-pdf` is the state that means "on hand".
const stale = db.prepare(`
  SELECT c.row_uid, c.discover_state, c.pdf_file AS cand_pdf,
         (SELECT f.file FROM file f WHERE f.folder_uid = c.row_uid
           ORDER BY f.role = 'article' DESC, f.file LIMIT 1) AS folder_pdf
    FROM candidate c
   WHERE c.discover_state <> 'has-pdf'
     AND EXISTS (SELECT 1 FROM file f WHERE f.folder_uid = c.row_uid)
   ORDER BY c.row_uid`).all();

if (!stale.length) {
  console.log("Every candidate whose folder holds a PDF is marked `has-pdf`. Nothing to do.");
  process.exit(0);
}

console.log(`${stale.length} candidate row(s) hold a PDF but carry a search-state:\n`);
for (const r of stale) {
  const setPdf = r.cand_pdf ? "" : `  (candidate.pdf_file empty -> ${r.folder_pdf})`;
  console.log(`  ${r.row_uid}  ${r.discover_state} -> has-pdf   [${r.folder_pdf}]${setPdf}`);
}

if (CHECK) {
  console.log("\n--check: stale rows found. Run without --check to see, or with --write to fix.");
  process.exit(1);
}
if (!WRITE) {
  console.log("\ndry run — nothing written. Re-run with --write.");
  process.exit(0);
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const bak = PACKET_DB.replace(/\.sqlite$/, `.pre-candidate-sync-${stamp}.bak`);
fs.copyFileSync(PACKET_DB, bak);
const iso = new Date().toISOString().slice(0, 19) + "Z";
const upd = db.prepare(`UPDATE candidate SET discover_state='has-pdf',
    discover_note = COALESCE(discover_note || '', ?), pdf_file = COALESCE(pdf_file, ?), tried_at=?
    WHERE row_uid=?`);
db.exec("BEGIN");
try {
  for (const r of stale) {
    upd.run(` | marked has-pdf on ${iso.slice(0, 10)} (was: ${r.discover_state}; file on disk: ${r.folder_pdf})`,
      r.cand_pdf || r.folder_pdf, iso, r.row_uid);
  }
  db.exec("COMMIT");
} catch (e) {
  db.exec("ROLLBACK");
  throw e;
}
console.log(`\nwrote ${stale.length} row(s). Backup: ${path.basename(bak)}`);
console.log("Next: node scripts/build-status.js --write && node scripts/build-potential.js --write");

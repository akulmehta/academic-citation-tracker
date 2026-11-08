/**
 * Set a screen decision on one row by hand.
 *
 * `screen-original-application.js` and `screen-dependents.js` both derive
 * their verdicts from data. This one records a verdict the applicant simply
 * gave, in their words, because a row the applicant told us to drop has to
 * stop appearing on the review page -- and if it stays `held` it will be
 * reconsidered from scratch by whoever reads the page next, which is exactly
 * the failure the instruction about keeping screened-out records exists to
 * prevent.
 *
 * It changes only `status`, `screen_reason` and `screen_date`. The PDF folder
 * is not moved here; `relocate-pdfs.js` owns all movement and derives the root
 * from the status, so running it after this is enough.
 *
 * Usage: node scripts/set-screen.js --row=cit-000553 --reason="..." [--restore] [--write]
 */
"use strict";
const fs = require("fs");
const path = require("path");
const lib = require(path.join(__dirname, "lib"));

const HERE = path.dirname(__dirname);
const PACKET_DB = lib.PACKET_DB;
const args = process.argv.slice(2);
const WRITE = args.includes("--write");
const RESTORE = args.includes("--restore");
const rowUid = (args.find((a) => a.startsWith("--row=")) || "").slice(6);
const reason = (args.find((a) => a.startsWith("--reason=")) || "").slice(9);

function main() {
  if (!rowUid) throw new Error("give --row=<uid>");
  if (!RESTORE && !reason) {
    throw new Error("give --reason=\"...\" -- what made this row drop out, in the applicant's words");
  }
  const db = lib.openPacket();
  const row = db
    .prepare(
      `SELECT row_uid, status, screen_reason, screen_date, citing_title FROM citation WHERE row_uid = ?`
    )
    .get(rowUid);
  if (!row) throw new Error(`${rowUid} is not a row in the packet database`);
  const target = RESTORE ? "held" : "screened-out";
  if (row.status === "included" && !RESTORE) {
    throw new Error(
      `${rowUid} is IN THE PACKET. Take it out with the packet tooling first; ` +
        `screening it here would hide a filed exhibit's row.`
    );
  }
  const today = new Date().toISOString().slice(0, 10);
  const newReason = RESTORE ? null : `Applicant directed this be ignored (${today}): ${reason}`;

  console.log(`${rowUid}  ${row.status} -> ${target}`);
  console.log(`  ${row.citing_title}`);
  console.log(`  reason was: ${row.screen_reason || "(none)"}`);
  console.log(`  reason now: ${newReason || "(cleared)"}`);
  const files = db
    .prepare(`SELECT file, role FROM file WHERE folder_uid = ?`)
    .all(rowUid);
  if (files.length) {
    console.log(`  ${files.length} PDF on file: ${files.map((f) => f.file).join(", ")}`);
    console.log(`  run scripts/relocate-pdfs.js --write to move the folder to the screened root`);
  }
  if (!WRITE) {
    console.log("\nDRY RUN -- nothing written. Re-run with --write.");
    return;
  }
  const backup = PACKET_DB.replace(/\.sqlite$/, `.pre-set-screen-${today}.bak`);
  fs.copyFileSync(PACKET_DB, backup);
  console.log(`\nBacked up: ${path.basename(backup)}`);
  db.prepare(
    `UPDATE citation SET status = ?, screen_reason = ?, screen_date = ? WHERE row_uid = ?`
  ).run(target, newReason, RESTORE ? null : today, rowUid);
  // The candidate table is the discovery queue; leaving it 'unscreened' would
  // hand the same row back to the next reader as open work.
  const cand = db
    .prepare(`UPDATE candidate SET screen_state = ? WHERE row_uid = ?`)
    .run(RESTORE ? "held" : "screened-out", rowUid);
  if (cand.changes) console.log(`Candidate row marked ${RESTORE ? "held" : "screened-out"}.`);
  const after = db
    .prepare(`SELECT status, screen_reason FROM citation WHERE row_uid = ?`)
    .get(rowUid);
  console.log(`Committed: ${after.status}${after.screen_reason ? " -- " + after.screen_reason : ""}`);
  const pool = lib.potentialIndependent(lib.openCatalog(), db, "5446863664671350528");
  console.log(
    `Potential pool now ${pool.rows.length}; this row ` +
      (pool.rows.some((r) => r.row_uid === rowUid) ? "is STILL on the page" : "is off the page")
  );
}

main()

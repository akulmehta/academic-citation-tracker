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
 *        node scripts/set-screen.js --rows=cit-000549,cit-000637 --reason="..." [--write]
 *
 * `--rows=` applies one reason to several rows in one transaction with one
 * backup, which is what a screen the applicant stated once needs; using
 * `--row=` repeatedly for a class of rows writes a backup per row and leaves
 * the batch half-applied if it is interrupted.
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
const rowList = (args.find((a) => a.startsWith("--rows=")) || "").slice(7);
const reason = (args.find((a) => a.startsWith("--reason=")) || "").slice(9);

function main() {
  const uids = (rowList ? rowList.split(",") : [rowUid]).map((s) => s.trim()).filter(Boolean);
  if (!uids.length) throw new Error("give --row=<uid> or --rows=<uid>,<uid>");
  if (!RESTORE && !reason) {
    throw new Error("give --reason=\"...\" -- what made this row drop out, in the applicant's words");
  }
  const db = lib.openPacket();
  const today = new Date().toISOString().slice(0, 10);
  const target = RESTORE ? "held" : "screened-out";
  const newReason = RESTORE ? null : `Applicant directed this be ignored (${today}): ${reason}`;

  // Validate the whole batch before touching anything: half a screen applied
  // is worse than none, and an included row must never be screened here.
  const getByUid = db.prepare(
    `SELECT row_uid, status, screen_reason, citing_title FROM citation WHERE row_uid = ?`
  );
  const seen = new Set();
  const targets = [];
  for (const uid of uids) {
    if (seen.has(uid)) continue;
    seen.add(uid);
    const row = getByUid.get(uid);
    if (!row) throw new Error(`${uid} is not a row in the packet database`);
    if (row.status === "included" && !RESTORE) {
      throw new Error(
        `${uid} IS IN THE PACKET. Take it out with the packet tooling first; ` +
          `screening it here would hide a filed exhibit's row.`
      );
    }
    targets.push(row);
  }

  const filesFor = db.prepare(`SELECT file, role FROM file WHERE folder_uid = ?`);
  for (const row of targets) {
    console.log(`${row.row_uid}  ${row.status} -> ${target}`);
    console.log(`  ${row.citing_title}`);
    console.log(`  reason was: ${row.screen_reason || "(none)"}`);
    console.log(`  reason now: ${newReason || "(cleared)"}`);
    const files = filesFor.all(row.row_uid);
    if (files.length) {
      console.log(`  ${files.length} PDF on file: ${files.map((f) => f.file).join(", ")}`);
    }
  }
  if (targets.length && filesFor.all(targets[0].row_uid).length) {
    console.log(`run scripts/relocate-pdfs.js --write to move the folders to the screened root`);
  }
  if (!WRITE) {
    console.log(`\nDRY RUN -- nothing written (${targets.length} row(s)). Re-run with --write.`);
    return;
  }
  const backup = PACKET_DB.replace(/\.sqlite$/, `.pre-set-screen-${today}.bak`);
  fs.copyFileSync(PACKET_DB, backup);
  console.log(`\nBacked up: ${path.basename(backup)}`);
  const updCitation = db.prepare(
    `UPDATE citation SET status = ?, screen_reason = ?, screen_date = ? WHERE row_uid = ?`
  );
  // The candidate table is the discovery queue; leaving it 'unscreened' would
  // hand the same row back to the next reader as open work.
  const updCandidate = db.prepare(`UPDATE candidate SET screen_state = ? WHERE row_uid = ?`);
  db.exec("BEGIN");
  try {
    for (const row of targets) {
      updCitation.run(target, newReason, RESTORE ? null : today, row.row_uid);
      updCandidate.run(RESTORE ? "held" : "screened-out", row.row_uid);
    }
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
  const after = db.prepare(`SELECT status, screen_reason FROM citation WHERE row_uid = ?`);
  for (const row of targets) {
    const a = after.get(row.row_uid);
    console.log(`${row.row_uid}: ${a.status}${a.screen_reason ? " -- " + a.screen_reason : ""}`);
  }
  const pool = lib.potentialIndependent(lib.openCatalog(), db, "5446863664671350528");
  const still = targets.filter((r) => pool.rows.some((p) => p.row_uid === r.row_uid));
  console.log(
    `Potential pool now ${pool.rows.length}; ${still.length} of ${targets.length} screened row(s) ` +
      (still.length ? "STILL on the page: " + still.map((r) => r.row_uid).join(", ") : "left the page")
  );
}

main()

"use strict";
/**
 * Move each citing work's PDF folder into the storage root its status implies.
 *
 * `papers/` is counsel's evidence folder. A work nobody has decided yet does not
 * belong in it, and until now it sat there anyway: six folders holding PDFs for
 * citations that are `held` were indistinguishable, on disk and in the database,
 * from the fourteen folders whose works are actually filed. This tool separates
 * them — no file content changes, only location and the paths that point at it.
 *
 *   papers/           works with at least one `included` row  (packet.html)
 *   pending-papers/   works awaiting a decision               (`held`)
 *   screened-papers/  works decided against, kept per §4.5    (`screened-out`)
 *
 * The root is derived from table `citation` through `lib.folderRoots`, so the
 * folders cannot disagree with the statuses; running this again after a decision
 * moves the folder to wherever that decision says it belongs.
 *
 * Dry run by default. Writes back up the database first, do everything in one
 * transaction, and `--revert` restores the last backup it took.
 *
 *   node scripts/relocate-pdfs.js                 # plan
 *   node scripts/relocate-pdfs.js --write         # apply
 *   node scripts/relocate-pdfs.js --revert        # undo the last --write
 */
const fs = require("fs");
const path = require("path");
const { PKT, PACKET_DB, openPacket, folderRoots, STORAGE_ROOTS } = require("./lib.js");

const argv = process.argv.slice(2);
const DRY = !argv.includes("--write") && !argv.includes("--revert");
const REVERT = argv.includes("--revert");

const ROOTS = STORAGE_ROOTS;

/**
 * The plan: for every folder that has files on disk, where it is now versus where
 * its status says it should be. Derived from three sources so a disagreement
 * between them is reported rather than silently resolved: the `file` table, the
 * `citation.pdf_file` column, and the directories actually present.
 */
function plan(db) {
  const roots = folderRoots(db);
  const moves = [];

  // 1. Where each folder's files live according to the database.
  const current = new Map();
  for (const f of db.prepare(`SELECT folder_uid, file FROM file`).all()) {
    const top = f.file.split("/")[0];
    if (!ROOTS.includes(top)) throw new Error(`${f.file} is not under a known storage root`);
    if (current.has(f.folder_uid) && current.get(f.folder_uid) !== top) {
      throw new Error(`folder ${f.folder_uid} has files in two storage roots (${current.get(f.folder_uid)} and ${top})`);
    }
    current.set(f.folder_uid, top);
  }

  // 2. Where the directories say they live. A directory with no database row is
  //    reported, not moved on its own — an untracked folder is a defect to name.
  const onDisk = new Map();
  for (const root of ROOTS) {
    const abs = path.join(PKT, root);
    if (!fs.existsSync(abs)) continue;
    for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
      if (!e.isDirectory()) continue;
      if (onDisk.has(e.name)) throw new Error(`${e.name} exists under both ${onDisk.get(e.name)} and ${root}`);
      onDisk.set(e.name, root);
    }
  }

  for (const [folder, want] of roots) {
    const have = current.get(folder) || onDisk.get(folder);
    if (!have) continue;                       // no files for this work anywhere
    if (current.get(folder) && onDisk.get(folder) && current.get(folder) !== onDisk.get(folder)) {
      throw new Error(`${folder}: \`file\` says ${current.get(folder)} but the directory is on disk under ${onDisk.get(folder)}`);
    }
    if (have === want) continue;
    moves.push({ folder, from: have, to: want });
  }

  // A directory on disk that no citation row claims is left exactly where it is
  // and shouted about; deleting evidence is never this tool's job.
  const orphans = [...onDisk.keys()].filter(f => !roots.has(f));
  return { moves, orphans, roots };
}

function apply(db, moves) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const bak = PACKET_DB.replace(/\.sqlite$/, `.pre-relocate-${stamp}.bak`);
  db.close();
  fs.copyFileSync(PACKET_DB, bak);
  const db2 = openPacket();

  db2.exec("BEGIN");
  try {
    for (const m of moves) {
      const src = path.join(PKT, m.from, m.folder);
      const dst = path.join(PKT, m.to, m.folder);
      if (fs.existsSync(dst)) throw new Error(`refusing to move ${m.folder}: ${dst} already exists`);
      fs.mkdirSync(path.dirname(dst), { recursive: true });
      fs.renameSync(src, dst);
      const fromP = `${m.from}/${m.folder}/`;
      const toP = `${m.to}/${m.folder}/`;
      // Rewrite every stored path by prefix. This also fixes a row that points at
      // another folder's copy of the same file (cit-000565 reads cit-000536's
      // download), because its path carries that folder's prefix.
      db2.prepare(`UPDATE file SET file = ? || substr(file, ?) WHERE file LIKE ?`)
        .run(toP, fromP.length + 1, fromP + "%");
      db2.prepare(`UPDATE citation SET pdf_file = ? || substr(pdf_file, ?) WHERE pdf_file LIKE ?`)
        .run(toP, fromP.length + 1, fromP + "%");
      db2.prepare(`UPDATE candidate SET pdf_file = ? || substr(pdf_file, ?) WHERE pdf_file LIKE ?`)
        .run(toP, fromP.length + 1, fromP + "%");
    }
    // An emptied evidence folder is removed so a later `papers/` listing is honest.
    for (const root of ROOTS) {
      const abs = path.join(PKT, root);
      if (fs.existsSync(abs) && fs.readdirSync(abs).length === 0) fs.rmdirSync(abs);
    }
    db2.exec("COMMIT");
  } catch (err) {
    db2.exec("ROLLBACK");
    throw err;
  }
  return { bak, db: db2 };
}

function main() {
  let db = openPacket();

  if (REVERT) {
    const backups = fs.readdirSync(PKT).filter(f => f.startsWith("notable-citations.pre-relocate-")).sort();
    if (!backups.length) { console.error("no pre-relocate backup to revert to"); process.exitCode = 1; return; }
    const src = path.join(PKT, backups[backups.length - 1]);
    // The paths in the backup name the folders as they were, so the directories
    // have to go back too. Re-read the backup to learn where each folder was.
    const { DatabaseSync } = require("node:sqlite");
    const probe = new DatabaseSync(src, { readOnly: true });
    const was = new Map(probe.prepare(`SELECT folder_uid, file FROM file`).all().map(f => [f.folder_uid, f.file.split("/")[0]]));
    probe.close();
    const now = new Map(db.prepare(`SELECT folder_uid, file FROM file`).all().map(f => [f.folder_uid, f.file.split("/")[0]]));
    const back = [];
    for (const [folder, from] of now) {
      const to = was.get(folder);
      if (to && to !== from) back.push({ folder, from, to });
    }
    db.close();
    fs.copyFileSync(src, PACKET_DB);
    db = openPacket();
    for (const m of back) {
      const s = path.join(PKT, m.from, m.folder), d = path.join(PKT, m.to, m.folder);
      if (fs.existsSync(s) && !fs.existsSync(d)) {
        fs.mkdirSync(path.dirname(d), { recursive: true });
        fs.renameSync(s, d);
      }
    }
    for (const root of ROOTS) {
      const abs = path.join(PKT, root);
      if (fs.existsSync(abs) && fs.readdirSync(abs).length === 0) fs.rmdirSync(abs);
    }
    console.log(`restored ${path.basename(src)} and moved ${back.length} folder(s) back.`);
    db.close();
    return;
  }

  const { moves, orphans } = plan(db);
  if (!moves.length) {
    console.log("Nothing to move — every folder is already under the root its status implies.");
    if (orphans.length) console.log(`\n${orphans.length} folder(s) on disk that no citation row claims: ${orphans.join(", ")}`);
    db.close();
    return;
  }
  const byRoot = new Map();
  for (const m of moves) {
    const k = `${m.from} -> ${m.to}`;
    if (!byRoot.has(k)) byRoot.set(k, []);
    byRoot.get(k).push(m.folder);
  }
  console.log(`${moves.length} folder(s) to move${DRY ? " (dry run — nothing written)" : ""}:`);
  for (const [k, list] of byRoot) console.log(`  ${k}  (${list.length})  ${list.join(", ")}`);
  if (orphans.length) console.log(`\nUntracked folder(s), left alone: ${orphans.join(", ")}`);

  if (DRY) {
    console.log("\nRe-run with --write. The database is backed up first and the move is one transaction.");
    db.close();
    return;
  }
  const { bak, db: db2 } = apply(db, moves);
  const after = plan(db2);
  console.log(`\nmoved ${moves.length} folder(s). Backup: ${path.basename(bak)}`);
  if (after.moves.length) {
    console.error(`post-check failed: ${after.moves.length} folder(s) still in the wrong root after the move.`);
    process.exitCode = 1;
  } else {
    console.log("post-check: every folder now sits under the root its status implies.");
  }
  db2.close();
}
main();

"use strict";
/**
 * Screen out a candidate the applicant already submitted with the original filing.
 *
 * Section 3 of the rules says the citations used in the original application must
 * not be repeated; they are documented in
 * `Citations/Notable Citations in Original Application/Original-Application-Citations.md`.
 * Until now that list only removed rows from the *discovery* pool, so a row that had
 * already been promoted — and had a PDF attached — stayed `held`, and a held row
 * reads as an open question. `cit-000534` is that case: entry 11 of the original
 * application, marked "yes — already counted", and the applicant asked for its PDF on
 * 2026-11-08 not knowing it had been filed. A Tier A reading does not make
 * already-submitted evidence into new evidence.
 *
 * Screening, not deleting: §4.5 keeps the row so the packet can show what was
 * considered and why it was set aside. The reason names the entry number in the
 * original application, so the decision is checkable against that document.
 *
 * This tool changes only `status`, `screen_reason` and `screen_date`. Moving the
 * folder out of `pending-papers/` is `relocate-pdfs.js`'s job — it derives each
 * folder's root from the statuses, so running it after this tool puts the files where
 * the new status says they belong and no move logic is duplicated here.
 *
 * A row already `included` is reported and never touched: removing evidence from
 * counsel's document is the applicant's decision, not a side effect of a sweep.
 *
 * Dry run by default; `--write` backs up the database first.
 *
 *   node scripts/screen-original-application.js            # report
 *   node scripts/screen-original-application.js --write    # apply
 */
const fs = require("fs");
const path = require("path");
const { PKT, REPO, PACKET_DB, openPacket, originalApplicationUids } = require("./lib.js");

const argv = process.argv.slice(2);
const DRY = !argv.includes("--write");
const TODAY = new Date().toISOString().slice(0, 10);

/**
 * row_uid -> entry number in `Original-Application-Citations.md`.
 * The table's second column carries the exhibit entry number, and it is filled in
 * only on a file's first row — continuation rows are blank — so the running number
 * has to carry down.
 */
function entryNumbers() {
  const prior = path.join(REPO, "Citations", "Notable Citations in Original Application", "Original-Application-Citations.md");
  const out = new Map();
  if (!fs.existsSync(prior)) return out;
  let current = null;
  for (const line of fs.readFileSync(prior, "utf8").split(/\r?\n/)) {
    const cells = line.split("|").map(s => s.trim());
    if (cells.length < 4) continue;
    if (/^\d+$/.test(cells[1])) current = Number(cells[1]);
    if (current === null || !/cit-\d{6}/.test(line)) continue;
    for (const uid of line.match(/cit-\d{6}/g) || []) {
      if (!out.has(uid)) out.set(uid, current);
    }
  }
  return out;
}

function main() {
  const uids = originalApplicationUids();
  if (!uids) {
    console.error("Original-Application-Citations.md is unreadable, so nothing can be screened.");
    process.exitCode = 1;
    return;
  }
  const entries = entryNumbers();
  const db = openPacket();

  const placeholders = [...uids].map(() => "?").join(",");
  const rows = db.prepare(`SELECT row_uid, folder_uid, status, citing_title, tier, pdf_file
                           FROM citation WHERE row_uid IN (${placeholders}) ORDER BY row_uid`).all(...uids);
  if (!rows.length) {
    console.log(`No packet row matches any of the ${uids.size} citations in the original application.`);
    db.close();
    return;
  }

  console.log(`The original application lists ${uids.size} catalog row(s); ${rows.length} of them are in the packet.\n`);
  const targets = [];
  for (const r of rows) {
    const reason = `already submitted with the original application (entry ${entries.get(r.row_uid) ?? "?"})`;
    const flag = r.status === "screened-out" ? "already screened out" : r.status === "included" ? "IN THE PACKET" : "held";
    console.log(`  ${r.row_uid}  ${flag.padEnd(20)} ${r.citing_title.slice(0, 54)}`);
    console.log(`      ${reason}${r.pdf_file ? `  pdf: ${r.pdf_file}` : ""}`);
    if (r.status === "included") {
      console.log("      NOT touched: an included row is counsel's evidence and only the applicant removes it");
    } else if (r.status !== "screened-out") {
      targets.push({ row: r, reason });
    }
  }
  if (!targets.length) {
    console.log("\nnothing to change.");
    db.close();
    return;
  }

  console.log(`\nWill screen out ${targets.length} row(s). Their folders move on the next \`relocate-pdfs.js --write\`.`);
  if (DRY) {
    console.log("Dry run. Re-run with --write to apply.");
    db.close();
    return;
  }

  const backup = path.join(PKT, `notable-citations.pre-screen-origapp-${TODAY}.bak`);
  fs.copyFileSync(PACKET_DB, backup);
  console.log(`Backup: ${path.relative(PKT, backup)}`);

  const setScreen = db.prepare(`UPDATE citation SET status='screened-out', screen_reason=?, screen_date=? WHERE row_uid=?`);
  db.exec("BEGIN");
  try {
    for (const { row, reason } of targets) setScreen.run(reason, TODAY, row.row_uid);
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    db.close();
    console.error(`write failed, nothing changed: ${err.message}`);
    console.error(`Restore point if needed: ${path.relative(PKT, backup)}`);
    process.exitCode = 1;
    return;
  }
  db.close();

  console.log(`\nScreened out ${targets.length} row(s).`);
  console.log("Next: node scripts/relocate-pdfs.js --write   (moves their PDFs to screened-papers/)");
  console.log("Then: build-potential.js --write, render-packet.js, build-status.js, export CSVs, validate-packet.js --deep");
}

main();

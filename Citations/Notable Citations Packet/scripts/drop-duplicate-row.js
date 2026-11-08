// Remove a packet row that is only a second catalog listing of a work another
// row already stands for.
//
// The applicant's instruction (2026-11-07) was that a duplicate should not be
// pointed at at all: "we should just refer to cit-000518. There is no need to
// point to the duplicate entry or have it in the table." The row being removed
// is not evidence of a second citation — Google Scholar lists the same citing
// article twice against the same cited paper (a journal record and its preprint,
// repository copy, or patent-family twin), so the packet naming both reads as
// two citations where there is one.
//
// What it does to the row being kept:
//   * `additional_row_uids` loses the duplicate, and `notes` records that the
//     duplicate was removed and why, so the trail survives the deletion;
//   * the duplicate's `mention` rows go with it — they describe the same
//     paragraph as the standing row's mention, so keeping both would double one
//     piece of evidence in mention.csv;
//   * the duplicate's `candidate` row goes too, otherwise the potential page
//     would offer for review a paper the packet already represents.
//
// Dry-run by default. `--write` backs the database up first and writes inside
// one transaction. `--revert` restores the last backup this tool took.
//
//   node scripts/drop-duplicate-row.js --dup=cit-000551 --keep=cit-000518
//   node scripts/drop-duplicate-row.js --dup=cit-000551 --keep=cit-000518 --write
//   node scripts/drop-duplicate-row.js --revert

const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");
const { PKT, PACKET_DB } = require("./lib");

const argv = process.argv.slice(2);
const WRITE = argv.includes("--write");
const REVERT = argv.includes("--revert");
const DUP = (argv.find(a => a.startsWith("--dup=")) || "").split("=")[1] || null;
const KEEP = (argv.find(a => a.startsWith("--keep=")) || "").split("=")[1] || null;
const PREFIX = "notable-citations.pre-drop-dup-";

function today() {
  return new Date().toISOString().slice(0, 10);
}
function stamp() {
  return new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
}
function fail(msg) {
  console.error("refusing: " + msg);
  process.exitCode = 1;
  return false;
}

if (REVERT) {
  const backups = fs.readdirSync(PKT).filter(f => f.startsWith(PREFIX)).sort();
  if (!backups.length) {
    console.error("no " + PREFIX + "* backup to revert to");
    process.exitCode = 1;
  } else {
    const src = path.join(PKT, backups[backups.length - 1]);
    fs.copyFileSync(src, PACKET_DB);
    console.log("reverted " + path.basename(PACKET_DB) + " from " + backups[backups.length - 1]);
    console.log("re-run the pipeline (§5.5) so the artifacts match the restored database.");
  }
  return;
}

if (!DUP || !KEEP) {
  console.error("usage: node scripts/drop-duplicate-row.js --dup=<uid> --keep=<uid> [--write]");
  process.exitCode = 1;
  return;
}
if (DUP === KEEP) {
  fail("--dup and --keep name the same row");
  return;
}

const db = new DatabaseSync(PACKET_DB);
try {
  const dup = db.prepare(`SELECT row_uid, folder_uid, is_main, cites_id, citing_title, tier, status
    FROM citation WHERE row_uid=?`).get(DUP);
  const keep = db.prepare(`SELECT row_uid, folder_uid, is_main, cites_id, citing_title, tier, status,
    additional_row_uids, notes FROM citation WHERE row_uid=?`).get(KEEP);
  if (!dup) fail(DUP + " is not a row in table citation");
  if (!keep) fail(KEEP + " is not a row in table citation");
  if (!dup || !keep) return;

  // The whole justification for deleting a row is that it is the same work as
  // the row being kept. Both must cite the same paper, or the two rows are two
  // citations of two different works and one of them is being thrown away.
  if (dup.cites_id !== keep.cites_id) {
    fail(`${DUP} cites ${dup.cites_id} but ${KEEP} cites ${keep.cites_id} — different cited papers, ` +
      "so these are two citations, not two listings of one citing work");
    return;
  }
  if (keep.is_main !== 1) {
    fail(`${KEEP} is not the main row of its folder; drop the duplicate only into the row that stands`);
    return;
  }
  if (dup.is_main === 1 && dup.folder_uid !== keep.folder_uid) {
    // Both rows stand on their own folder. Before deleting one, confirm they are
    // the same work rather than two works that cite the same paper.
    const a = (dup.citing_title || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    const b = (keep.citing_title || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    const same = a && b && (a.startsWith(b) || b.startsWith(a));
    if (!same) {
      fail(`${DUP} and ${KEEP} are both main rows whose titles do not contain one another:\n` +
        `    ${DUP}: ${dup.citing_title}\n    ${KEEP}: ${keep.citing_title}\n` +
        "  Two different titles may be two different works. Record the identity first " +
      "(tools/apply-decision.js --same-work-as) or pass --confirm-different-titles.");
      return;
    }
    if (!argv.includes("--confirm-different-titles")) {
      console.log("note: the two titles differ (one is truncated by Google Scholar); matched on a shared prefix.");
    }
  }

  const dupMentions = db.prepare(`SELECT id, section, tier, page, quote FROM mention WHERE row_uid=?`).all(DUP);
  const keepMentions = db.prepare(`SELECT id, section, tier, page, quote FROM mention WHERE row_uid=?`).all(KEEP);
  const dupCandidate = db.prepare(`SELECT row_uid, status, has_pdf, pdf_file, packet_row_uid
    FROM candidate WHERE row_uid=?`).get(DUP);
  const dupFiles = db.prepare(`SELECT folder_uid, file FROM file WHERE folder_uid=?`).all(DUP);
  // A narrative is keyed on the folder. When the duplicate shares the standing
  // row's folder the narrative belongs to that row too and stays valid; when it
  // owns a folder of its own, deleting the row would orphan the narrative.
  const dupNarrative = dup.folder_uid === keep.folder_uid ? []
    : db.prepare(`SELECT folder_uid FROM narrative WHERE folder_uid=?`).all(dup.folder_uid);

  console.log(`drop   ${DUP}  tier ${dup.tier || "—"}  status ${dup.status}`);
  console.log(`         ${dup.citing_title}`);
  console.log(`keep   ${KEEP}  tier ${keep.tier || "—"}  status ${keep.status}  folder ${keep.folder_uid}`);
  console.log(`         ${keep.citing_title}`);
  console.log(`\ndelete ${dupMentions.length} mention row(s) of ${DUP}` +
    (dupMentions.length ? ": " + dupMentions.map(m => `${m.id} (${m.tier} ${m.section} p.${m.page})`).join(", ") : ""));
  for (const m of keepMentions) {
    const dupe = dupMentions.find(d => d.section === m.section && d.page === m.page && d.quote === m.quote);
    console.log(`  ${dupe ? "covered" : "NOT COVERED"} by ${KEEP} mention ${m.id}: ${m.tier} ${m.section} p.${m.page}`);
  }
  const uncovered = dupMentions.filter(d => !keepMentions.some(m => m.section === d.section && m.page === d.page && m.quote === d.quote));
  if (uncovered.length) {
    console.log(`\n  ${uncovered.length} duplicate mention(s) have no equal on ${KEEP}. Deleting them loses nothing ` +
      "that the standing row does not already record ONLY if the two rows are one article; otherwise the " +
      "standing row is missing evidence. Check before writing.");
  }
  console.log(`delete candidate row ${DUP}: ` + (dupCandidate ? JSON.stringify(dupCandidate) : "(none)"));
  if (dupFiles.length) {
    console.log(`${DUP} owns ${dupFiles.length} file row(s) — those folders are NOT deleted, only the row:`);
    for (const f of dupFiles) console.log("    " + f.file);
  }
  if (dupNarrative.length) console.log(`${DUP} has ${dupNarrative.length} narrative row(s) — refusing to drop it silently`);

  const others = db.prepare(`SELECT row_uid, additional_row_uids FROM citation
    WHERE additional_row_uids IS NOT NULL AND additional_row_uids LIKE ?`).all("%" + DUP + "%");
  for (const o of others) console.log(`strip ${DUP} from ${o.row_uid}.additional_row_uids: ${o.additional_row_uids}`);

  if (dupNarrative.length) {
    fail(`${DUP} carries narrative rows; remove or re-point them first`);
    return;
  }

  if (!WRITE) {
    console.log("\ndry run — nothing written. Re-run with --write.");
    return;
  }

  const bak = path.join(PKT, `${PREFIX}${stamp()}.bak`);
  fs.copyFileSync(PACKET_DB, bak);
  console.log("\nbacked up to " + path.basename(bak));

  db.exec("BEGIN");
  try {
    db.prepare(`DELETE FROM mention WHERE row_uid=?`).run(DUP);
    db.prepare(`DELETE FROM candidate WHERE row_uid=?`).run(DUP);
    const note = `Duplicate catalog listing of the work ${KEEP} stands for; removed from the packet on ${today()} ` +
      `so the citation is listed once (scripts/drop-duplicate-row.js).`;
    db.prepare(`DELETE FROM citation WHERE row_uid=?`).run(DUP);
    for (const o of others) {
      const list = o.additional_row_uids.split(/[;,]\s*/).map(s => s.trim()).filter(s => s && s !== DUP);
      db.prepare(`UPDATE citation SET additional_row_uids=? WHERE row_uid=?`)
        .run(list.length ? list.join(", ") : null, o.row_uid);
    }
    const keptNote = (keep.notes || "").trim();
    const add = `${DUP} was a second catalog listing of this citing work and was removed on ${today()} ` +
      `at the applicant's instruction; this row is the one the packet cites.`;
    db.prepare(`UPDATE citation SET notes=? WHERE row_uid=?`)
      .run(keptNote ? keptNote + " " + add : add, KEEP);
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
  console.log(`dropped ${DUP}: 1 citation row, ${dupMentions.length} mention row(s), ` +
    (dupCandidate ? "1 candidate row, " : "") + `${others.length} additional_row_uids reference(s) removed`);
  console.log("re-run the pipeline (§5.5) and validate-packet.js --deep.");
} finally {
  db.close();
}

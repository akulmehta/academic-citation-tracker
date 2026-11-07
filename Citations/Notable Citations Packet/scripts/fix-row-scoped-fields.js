// Correct columns that were written once per FOLDER onto every row of a citing
// article, so each row carries what belongs to it.
//
// §5 of the instructions: "Identity comes from the main row group as a whole …
// Classification comes from each row's own `cites_id`: that row's `project`, and
// the tier, section, page and quote for the use of *that* tool."
//
// The importer read the folder's first catalog row and stamped four things onto
// every row of the group:
//
//   cited_paper  one PI paper's title on rows citing three others
//   cited_tool   "GLAD and GlycoGlyph" on a row that cites only MAWE
//   project      one project number for rows belonging to two
//   cited_earliest_date  the CITING paper's earliest public date, filed under a
//                        column §4.6 defines as the date of MY cited paper
//
// The last one is the one that would have reached counsel: the Guérardel group
// showed "Earliest date: Not shown in PDF" for GLAD, which the record dates 2019,
// and the Heras group showed "29 Apr 2023 (preprint)" — the citing article's
// preprint, which is the timeline evidence, not GLAD's date.
//
// Nothing here is invented. Every value comes from the citation record's own
// `publications` row for that row's own `cites_id`, read read-only, or from the
// docx note the importer already recorded. Where the cited paper is not one of
// the four tools there is no tool and no project, and the row is REPORTED rather
// than given a sibling's value.
//
// Dry-run by default. --write applies, after backing up the database.

const fs = require("fs");
const path = require("path");
const { openPacket, openCatalog, PACKET_DB, toolForCitedPaper, projectForCitedPaper } = require("./lib");

const WRITE = process.argv.includes("--write");

function main() {
  const db = openPacket();
  const cat = openCatalog();

  // migrate() in lib.js added the two citing-date columns when the handle opened.
  const pubs = new Map(
    cat.prepare(`SELECT cites_id, title, year FROM publications`).all().map(p => [p.cites_id, p])
  );

  const rows = db.prepare(`
    SELECT row_uid, folder_uid, status, cites_id, cited_tool, cited_paper, project,
           cited_earliest_date, cited_was_preprint, citing_published_date, evidence_basis
    FROM citation ORDER BY folder_uid, row_uid`).all();

  const changes = [];
  const noTool = [];
  const missingPub = [];

  for (const r of rows) {
    const pub = r.cites_id ? pubs.get(r.cites_id) : null;
    if (!pub) {
      // Without the record's own title there is nothing to derive from. Say so;
      // do not fall back to the folder's value, which is what caused this.
      missingPub.push(r.row_uid);
      continue;
    }
    const tool = toolForCitedPaper(pub.title);
    const project = projectForCitedPaper(pub.title);

    // The docx's "Earliest date (preprint, else journal received)" is the citing
    // paper's. Only a row the importer filled from the docx carries that value;
    // a row promoted from the discovery queue already holds the cited year.
    const fromDocx = r.evidence_basis === "docx note";
    const citingEarliest = fromDocx ? r.cited_earliest_date : null;
    const citingPreprint = fromDocx ? r.cited_was_preprint : null;
    const citedDate = String(pub.year || "");

    const next = {
      cited_paper: pub.title || null,
      cited_tool: tool,
      project,
      cited_earliest_date: citedDate || null,
      cited_was_preprint: fromDocx ? null : r.cited_was_preprint,
      citing_earliest_date: citingEarliest,
      citing_was_preprint: citingPreprint,
    };

    const diffs = Object.entries(next).filter(([k, v]) => (r[k] ?? null) !== (v ?? null));
    if (!diffs.length) continue;

    changes.push({ row: r, next, diffs, tool, pub });
    if (!tool) noTool.push({ uid: r.row_uid, folder: r.folder_uid, status: r.status, tier: r.project, title: pub.title });
  }

  console.log(`${rows.length} citation row(s) examined against the record.`);
  console.log(`${changes.length} row(s) carry a value that is not their own.`);
  if (missingPub.length) console.log(`\n${missingPub.length} row(s) have no publications row for their cites_id: ${missingPub.join(", ")}`);

  // Show the change grouped by folder, because the whole point is that rows in
  // one folder differ from each other.
  const byFolder = new Map();
  for (const c of changes) {
    if (!byFolder.has(c.row.folder_uid)) byFolder.set(c.row.folder_uid, []);
    byFolder.get(c.row.folder_uid).push(c);
  }
  for (const [folder, list] of byFolder) {
    console.log(`\n${folder}${list.length === rows.filter(r => r.folder_uid === folder).length ? "" : " (partial)"}`);
    for (const c of list) {
      const t = c.tool || "(no tool — cited paper is not one of the four)";
      console.log(`  ${c.row.row_uid}  ${t}${c.next.project ? ` · project ${c.next.project}` : " · project —"}`);
      for (const [k, v] of c.diffs) {
        const fmt = s => (s === null || s === undefined || s === "") ? "—" : String(s).slice(0, 58);
        console.log(`      ${k}: ${fmt(c.row[k])}  ->  ${fmt(v)}`);
      }
    }
  }

  if (noTool.length) {
    console.log(`\n${noTool.length} row(s) cite a PI paper that is not one of the four tools.`);
    console.log("Their `cited_tool` and `project` are left EMPTY rather than filled from a");
    console.log("sibling row. A tier recorded for one of these rows describes a different");
    console.log("work than the one the row cites, so it needs the applicant's eye:");
    for (const n of noTool) {
      const mine = rows.find(r => r.row_uid === n.uid);
      console.log(`  ${n.uid} (${n.status}) cites "${n.title}"`);
      if (mine) console.log(`      folder ${n.folder} — confirm what the docx note describes for THIS row`);
    }
  }

  if (!WRITE) {
    console.log(`\n[dry] nothing written. Re-run with --write.`);
    return;
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const bak = path.join(path.dirname(PACKET_DB), `notable-citations.pre-row-scope-${stamp}.bak`);
  fs.copyFileSync(PACKET_DB, bak);
  console.log(`\nbacked up to ${path.basename(bak)}`);

  const upd = db.prepare(`UPDATE citation SET cited_paper=?, cited_tool=?, project=?,
    cited_earliest_date=?, cited_was_preprint=?, citing_earliest_date=?, citing_was_preprint=?
    WHERE row_uid=?`);
  db.exec("BEGIN");
  try {
    for (const c of changes) {
      upd.run(c.next.cited_paper, c.next.cited_tool, c.next.project, c.next.cited_earliest_date,
        c.next.cited_was_preprint, c.next.citing_earliest_date, c.next.citing_was_preprint, c.row.row_uid);
    }
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
  console.log(`wrote ${changes.length} row(s).`);

  // Prove the invariant the fix exists for: within a folder, two rows citing two
  // different PI papers must not share one cited_paper value.
  const stillBad = db.prepare(`
    SELECT folder_uid FROM citation GROUP BY folder_uid
    HAVING COUNT(DISTINCT cites_id) > 1 AND COUNT(DISTINCT cited_paper) = 1`).all();
  if (stillBad.length) {
    console.log(`\nFAILED: ${stillBad.length} folder(s) still hold one cited_paper across differing cites_id: ${stillBad.map(r => r.folder_uid).join(", ")}`);
    process.exitCode = 1;
  } else {
    console.log("verified: every folder's rows now name the paper each row actually cites.");
  }
}

main();

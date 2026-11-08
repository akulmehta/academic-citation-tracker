"use strict";
/**
 * Record the citing senior author on rows the candidate queue left blank.
 *
 * `promote-candidates.js` copies `senior_author` from the queue, and for rows
 * Scholar truncated that value is null. A null is not itself a problem — the
 * packet page prints an em dash — but §5.1/§7 want the filed PDF named after the
 * citing senior author, and `file-pdf.js` falls back to the word "article" when
 * the field is empty, so the file name stops saying who wrote the paper.
 *
 * Each value below was read off the first page of the retrieved article, not
 * inferred from a database: the surname is the last author of the published work,
 * per §7. The basis is stored alongside so a later reader can see where it came
 * from, and `--check` reprints it without writing.
 *
 *   node scripts/set-senior-author.js [--write]
 */
const { openPacket, PACKET_DB } = require("./lib.js");
const fs = require("fs");

const WRITE = process.argv.includes("--write");

// row_uid -> [surname, basis]
const FIXES = {
  "cit-000525": ["Haab", "Last author on p.1 of the retrieved article: Zachary Klamer, Brian Haab"],
  "cit-001263": ["Soares", "Sole author on the title page: Blake Anthony Paiva Soares, Queen's University MSc thesis, August 2026"],
  "cit-000549": ["Swanson", "Sole author on the title page: Nicholas Joseph Chudeusz Swanson, JHU dissertation, May 2024"],
  "cit-000555": ["Petralia", "Sole author on the repository record: Petralia, L.M.C."],
  "cit-000564": ["Ng'ang'a", "Sole author on the title page: Peter Njenga Ng'ang'a, Freiburg dissertation, July 2020"],
  "cit-000566": ["Garín-Muga", "Last author on p.1: Aurora Sucre, Raquel Pazos, Niels-Christian Reichardt, Alba Garín-Muga"],
  "cit-000636": ["Baud", "Last and corresponding author on p.1 of the retrieved article: Rajas M. Rao, Manuel Dauchez, Stéphanie Baud (stephanie.baud@univ-reims.fr)"],
};

function main() {
  const db = openPacket();
  const get = db.prepare(`SELECT citing_senior_author, citing_authors, citing_title FROM citation WHERE row_uid=?`);
  const set = db.prepare(`UPDATE citation SET citing_senior_author=? WHERE row_uid=?`);
  const changed = [];
  for (const [uid, [surname]] of Object.entries(FIXES)) {
    const r = get.get(uid);
    if (!r) { console.log(`${uid}  NO SUCH ROW — skipped`); continue; }
    if (r.citing_senior_author) {
      console.log(`${uid}  already set to ${JSON.stringify(r.citing_senior_author)} — left alone`);
      continue;
    }
    console.log(`${uid}  null -> ${JSON.stringify(surname)}\n        ${FIXES[uid][1]}`);
    changed.push([uid, surname]);
  }
  if (!changed.length) { console.log("\nnothing to change."); db.close(); return; }
  if (!WRITE) {
    console.log(`\ndry run — would set ${changed.length} row(s). Re-run with --write.`);
    db.close();
    return;
  }
  const bak = PACKET_DB.replace(/\.sqlite$/, `.pre-senior-${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}.bak`);
  fs.copyFileSync(PACKET_DB, bak);
  db.exec("BEGIN");
  try {
    for (const [uid, surname] of changed) set.run(surname, uid);
    db.exec("COMMIT");
  } catch (e) { db.exec("ROLLBACK"); throw e; }
  console.log(`\nwrote ${changed.length} row(s). Backup: ${bak.split(/[\\/]/).pop()}`);
  db.close();
}
main();

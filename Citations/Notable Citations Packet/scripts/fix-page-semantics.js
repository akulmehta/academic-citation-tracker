"use strict";
/**
 * Put the exhibit page in `exhibit_page` and keep `page` for the article page.
 *
 * §4.6 defines `page` as the page where the citation appears — in the citing
 * ARTICLE. The importer filled it from the catalog's `citations.page`, which is
 * the row's position on a Scholar EXHIBIT sheet: a different document entirely.
 * Quoting "Methods, p.2" while meaning exhibit page 2 of a citing-2026-11-01
 * sheet would send counsel to the wrong paper.
 *
 * So: `exhibit_page` is taken from the record, read-only (§0), for every row that
 * has a catalog row; and `page` is cleared only where its value came from that
 * same catalog field — identified by `evidence_basis = 'docx note'`, the importer's
 * own mark. A `page` written by scan-mentions.js is an article page and stays.
 *
 * Dry-run by default. Writes the packet's database only.
 */
const { openPacket, openCatalog } = require("./lib");
const WRITE = process.argv.slice(2).includes("--write");

const db = openPacket();
const cat = openCatalog();

const catPage = new Map();
for (const r of cat.prepare(`SELECT row_uid, page FROM citations`).all()) {
  catPage.set(r.row_uid, r.page === null || r.page === undefined ? null : String(r.page));
}
cat.close();

const rows = db.prepare(`SELECT row_uid, page, exhibit_page, evidence_basis, status FROM citation ORDER BY row_uid`).all();

let setExhibit = 0, clearPage = 0, keep = 0, unknown = 0;
for (const r of rows) {
  const fromCat = catPage.has(r.row_uid) ? catPage.get(r.row_uid) : null;
  if (fromCat && r.exhibit_page !== fromCat) {
    setExhibit++;
    if (WRITE) db.prepare(`UPDATE citation SET exhibit_page=? WHERE row_uid=?`).run(fromCat, r.row_uid);
  }
  if (r.evidence_basis === "docx note" && r.page) {
    clearPage++;
    if (WRITE) db.prepare(`UPDATE citation SET page=NULL WHERE row_uid=?`).run(r.row_uid);
  } else if (r.page) keep++;
  if (!catPage.has(r.row_uid)) unknown++;
}

console.log(`${rows.length} row(s): ${setExhibit} exhibit_page to set from the record, ${clearPage} docx-sourced page value(s) to clear, ${keep} article page(s) to keep, ${unknown} without a catalog row`);

// Show a sample so a wrong move is visible rather than silent.
for (const r of rows.slice(0, 8)) {
  const fromCat = catPage.has(r.row_uid) ? catPage.get(r.row_uid) : "-";
  const newPage = r.evidence_basis === "docx note" ? "-" : (r.page || "-");
  console.log(`  ${r.row_uid} [${r.status}] basis=${String(r.evidence_basis || "-").padEnd(10)} page ${String(r.page || "-").padEnd(4)} -> ${newPage.padEnd(4)}  exhibit_page ${String(r.exhibit_page || "-")} -> ${fromCat}`);
}

if (!WRITE) { console.log("\nDRY RUN — re-run with --write to apply."); db.close(); process.exit(0); }
console.log(`\nwrote ${setExhibit} exhibit_page value(s), cleared ${clearPage} page value(s)`);
db.close();

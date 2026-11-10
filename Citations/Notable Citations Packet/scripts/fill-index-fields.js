#!/usr/bin/env node
"use strict";
/**
 * Give every included row in the packet database the same details in the index and in Section I:
 * the date the final article went online, the earliest public date (a preprint if one was found) in one format, the journal as printed,
 * and the citing authors' institutions. The values live in scripts/citing-meta.js (read from each PDF).
 *
 *   node scripts/fill-index-fields.js [--write]
 *
 * Without --write it only prints what would change. Touches only the packet database.
 */
const L = require("./lib");
const { META, showPre, publishedLabel, earliestLabel } = require("./citing-meta");
const write = process.argv.includes("--write");
const db = L.openPacket();
const rows = db.prepare("SELECT row_uid, folder_uid, citing_published_date, citing_earliest_date, citing_was_preprint, citing_venue, citing_institutions FROM citation WHERE status='included'").all();
const upd = db.prepare("UPDATE citation SET citing_published_date=?, citing_earliest_date=?, citing_was_preprint=?, citing_venue=?, citing_institutions=? WHERE row_uid=?");
let changed = 0;
for (const r of rows) {
  const m = META[r.folder_uid];
  if (!m) { console.log(`no metadata for ${r.folder_uid}`); continue; }
  const next = [publishedLabel(r.folder_uid), earliestLabel(r.folder_uid), showPre(r.folder_uid) ? 1 : 0, m.venue, m.inst];
  const prev = [r.citing_published_date, r.citing_earliest_date, r.citing_was_preprint, r.citing_venue, r.citing_institutions];
  if (next.every((v, i) => v === prev[i])) continue;
  changed++;
  console.log(`${r.row_uid}: ${prev[0] || "—"}  ->  ${next[0]}  |  earliest: ${next[1]}`);
  if (write) upd.run(...next, r.row_uid);
}
console.log(`${changed} row(s) ${write ? "updated" : "would change (run with --write)"}`);

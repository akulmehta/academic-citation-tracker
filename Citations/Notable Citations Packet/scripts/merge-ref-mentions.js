#!/usr/bin/env node
/**
 * Merge the reference-resolution spec into what the mention table already holds.
 *
 * `record-mentions.js --from=X` replaces the whole set for a row — that is the
 * right behaviour for the scanner that found every named appearance of a tool, but
 * the reference spec holds only the citations that name no tool. Applying it raw
 * would delete the named mentions beside it, so this reads the row's current rows
 * out of the database, keeps them, and adds only the resolved citations that are
 * not already there.
 *
 * "Not already there" is judged on the sentence, not the string. The scanner quotes
 * the printed line and the resolver quotes the sentence around the marker, so the
 * two overlap without being equal; a resolved citation is treated as new only when
 * its quote shares no run of thirty characters with anything recorded. Anything
 * closer is a second view of the same sentence and would read as two citations.
 *
 * Usage:
 *   node scripts/merge-ref-mentions.js --from=ref-mentions.json --out=ref-mentions-merged.json
 */
"use strict";
const fs = require("fs");
const path = require("path");
const { openPacket } = require("./lib.js");

const argv = process.argv.slice(2);
const opt = n => {
  const a = argv.find(x => x.startsWith(`--${n}=`));
  return a ? a.split("=").slice(1).join("=") : null;
};
const FROM = opt("from");
const OUT = opt("out");
if (!FROM || !OUT) {
  console.error("usage: node scripts/merge-ref-mentions.js --from=<spec> --out=<file>");
  process.exit(2);
}

const spec = JSON.parse(fs.readFileSync(path.isAbsolute(FROM) ? FROM : path.join(process.cwd(), FROM), "utf8"));
const db = openPacket();
const flat = s => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "");

/** Whether two quotes are the same sentence seen twice. */
function sameSentence(a, b) {
  const x = flat(a), y = flat(b);
  if (!x || !y) return false;
  if (x.includes(y) || y.includes(x)) return true;
  const short = x.length <= y.length ? x : y;
  // Any 30-character run in common is the same printed sentence, allowing for the
  // two tools cutting it at different points.
  for (let i = 0; i + 30 <= short.length; i += 10) {
    if ((x.length <= y.length ? y : x).includes(short.slice(i, i + 30))) return true;
  }
  return false;
}

const merged = [];
let added = 0;
let skipped = 0;
for (const entry of spec) {
  const cur = db.prepare("SELECT section, tier, page, quote, use_type, basis FROM mention WHERE row_uid=? ORDER BY id")
    .all(entry.row_uid);
  const keep = cur.map(m => ({
    section: m.section, tier: m.tier, page: m.page, quote: m.quote,
    use_type: m.use_type, basis: m.basis, verified: 1,
  }));
  const fresh = [];
  for (const m of entry.mentions) {
    if (keep.some(k => sameSentence(k.quote, m.quote))) { skipped++; continue; }
    fresh.push(m);
  }
  if (keep.length || fresh.length) merged.push({ row_uid: entry.row_uid, mentions: [...keep, ...fresh] });
  added += fresh.length;
}
db.close();

fs.writeFileSync(path.isAbsolute(OUT) ? OUT : path.join(process.cwd(), OUT), JSON.stringify(merged, null, 2));
console.log(`${merged.length} row(s), ${added} new resolved mention(s), ${skipped} already recorded.`);
console.log(`wrote ${OUT} — feed it to record-mentions.js --from=${OUT}`);

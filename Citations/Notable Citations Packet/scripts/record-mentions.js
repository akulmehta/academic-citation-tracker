#!/usr/bin/env node
/**
 * Record EVERY place a tool appears in a citing article.
 *
 * A citation's value is where it sits, and one article can place the applicant's
 * tool in the Methods and thank him in the Acknowledgements, or show it in a
 * figure legend and again in Methods. citation.tier can hold only the strongest
 * of those, so the rest were invisible to counsel. This writes the full list into
 * the mention table, which the index and the article entry both print.
 *
 * Like record-evidence.js, nothing is written that its own PDF check cannot
 * support. Every mention carries a quote, and the quote must appear in the PDF —
 * on the page claimed, not merely somewhere in the file. A mention with no quote
 * is refused rather than stored, because an unquoted "it is in the Discussion" is
 * the kind of claim nobody can check later.
 *
 * Usage:
 *   node scripts/record-mentions.js --from=mentions.json           # dry run
 *   node scripts/record-mentions.js --from=mentions.json --write   # apply
 *   node scripts/record-mentions.js --check                        # re-verify all
 *   node scripts/record-mentions.js --list [row_uid]
 */
const fs = require("fs");
const path = require("path");
const { openPacket, PACKET_DB, folderRoots, storageDir } = require("./lib.js");
const { verifyQuote, expandPages } = require("./pdfverify.js");

const DRY = !process.argv.includes("--write");
const has = (f) => process.argv.includes(`--${f}`);
const opt = (name) => {
  const a = process.argv.find((s) => s.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : null;
};
const TODAY = new Date().toISOString().slice(0, 10);

function backup(db) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const dest = path.join(path.dirname(PACKET_DB), `notable-citations.pre-mentions-${stamp}.bak`);
  db.close();
  fs.copyFileSync(PACKET_DB, dest);
  console.log(`backed up to ${path.basename(dest)}`);
  return openPacket();
}

/** The PDF to check a row against: its own file, else the folder's first PDF. */
function pdfForRow(db, rowUid) {
  const r = db.prepare("SELECT pdf_file, folder_uid FROM citation WHERE row_uid=?").get(rowUid);
  if (!r) return { err: `row ${rowUid} is not in the citation table` };
  if (r.pdf_file) return { rel: r.pdf_file, row: r };
  const f = db.prepare("SELECT folder_uid, file FROM file WHERE folder_uid=? ORDER BY file LIMIT 1").get(r.folder_uid);
  if (!f) return { err: `row ${rowUid} has no PDF in the packet` };
  // The stored path already carries its root, and a bare `file` value does not,
  // so ask `folderRoots` where the folder sits rather than assuming `papers/`.
  return { rel: `${storageDir(folderRoots(db), r.folder_uid)}/${f.file}`, row: r };
}

async function main() {
  let db = openPacket();

  if (has("list")) {
    const only = process.argv.find((a) => /^cit-\d+$/.test(a));
    const rows = only
      ? db.prepare("SELECT * FROM mention WHERE row_uid=? ORDER BY id").all(only)
      : db.prepare("SELECT * FROM mention ORDER BY row_uid, id").all();
    if (!rows.length) console.log("no mentions recorded");
    for (const m of rows) {
      console.log(`${m.row_uid}  tier ${m.tier}  ${m.section}, p.${m.page}  ${m.verified ? "[verified]" : "[unverified]"}  ${m.basis || ""}`);
      if (m.quote) console.log(`      "${m.quote}"`);
    }
    console.log(`\n${rows.length} mention(s).`);
    db.close();
    return;
  }

  if (has("check")) {
    const rows = db.prepare(`
      SELECT m.*, c.pdf_file AS pdf_file, c.folder_uid
      FROM mention m LEFT JOIN citation c ON c.row_uid = m.row_uid
      ORDER BY m.row_uid, m.id`).all();
    let bad = 0;
    for (const m of rows) {
      const pdf = pdfForRow(db, m.row_uid);
      if (pdf.err) { console.log(` FAIL  ${m.row_uid} — ${pdf.err}`); bad++; continue; }
      const res = await verifyQuote(m.quote, pdf.rel, m.page);
      const flag = res.ok ? "  ok  " : " FAIL ";
      if (!res.ok) bad++;
      console.log(`${flag} ${m.row_uid} tier ${m.tier} ${m.section} p.${m.page} — ${res.why}`);
    }
    console.log(`\n${rows.length} mention(s) checked, ${bad} failure(s).`);
    db.close();
    process.exit(bad ? 1 : 0);
  }

  const from = opt("from");
  if (!from) {
    console.error("usage: node scripts/record-mentions.js --from=<file.json> [--write] | --check | --list [row_uid]");
    process.exit(2);
  }
  const spec = JSON.parse(fs.readFileSync(path.isAbsolute(from) ? from : path.join(process.cwd(), from), "utf8"));
  if (!Array.isArray(spec)) { console.error("the JSON must be an array of { row_uid, mentions: [...] }"); process.exit(2); }

  console.log(DRY ? "DRY RUN — nothing is written. Re-run with --write to apply.\n" : "WRITING.\n");

  // Verify everything before touching anything, so a bad entry cannot leave a
  // half-written set of mentions for one article.
  const problems = [];
  for (const entry of spec) {
    const { row_uid, mentions } = entry;
    if (!row_uid || !Array.isArray(mentions) || !mentions.length) {
      problems.push(`${row_uid || "(entry)"}: needs row_uid and a non-empty mentions array`);
      continue;
    }
    const pdf = pdfForRow(db, row_uid);
    if (pdf.err) { problems.push(`${row_uid}: ${pdf.err}`); continue; }
    for (const [i, m] of mentions.entries()) {
      const where = `${row_uid} mention #${i + 1}`;
      if (!m.section) problems.push(`${where}: no section`);
      if (!m.tier) problems.push(`${where}: no tier`);
      if (!m.page) problems.push(`${where}: no page`);
      if (!m.basis) problems.push(`${where}: no basis`);
      if (!m.quote) { problems.push(`${where}: no quote — an unquoted location is not evidence`); continue; }
      const res = await verifyQuote(m.quote, pdf.rel, m.page);
      console.log(`  ${res.ok ? "ok  " : "FAIL"} ${row_uid} #${i + 1} ${m.section} p.${m.page} — ${res.why}`);
      if (!res.ok) problems.push(`${where}: ${res.why}`);
    }
    // The headline tier should be the best of what is recorded, or better: a row
    // filed at tier A with only tier C mentions recorded would read inconsistently.
    const row = db.prepare("SELECT tier FROM citation WHERE row_uid=?").get(row_uid);
    const ranks = mentions.map((m) => "ABCD".indexOf(m.tier)).filter((x) => x >= 0);
    if (row?.tier && ranks.length) {
      const best = Math.min(...ranks);
      const cur = "ABCD".indexOf(row.tier);
      if (cur >= 0 && best < cur) {
        problems.push(`${row_uid}: a tier ${"ABCD"[best]} mention is recorded but the row's headline tier is ${row.tier} — update citation.tier with record-evidence.js`);
      }
    }
  }

  if (problems.length) {
    console.log(`\n${problems.length} problem(s) — nothing written:`);
    for (const p of problems) console.log(`  - ${p}`);
    db.close();
    process.exit(1);
  }

  if (DRY) {
    console.log(`\nAll ${spec.reduce((n, e) => n + e.mentions.length, 0)} mention(s) verified. Re-run with --write.`);
    db.close();
    return;
  }

  db = backup(db);
  const del = db.prepare("DELETE FROM mention WHERE row_uid=?");
  const ins = db.prepare(`INSERT INTO mention (row_uid, section, tier, page, quote, use_type, basis, verified, noted_on)
    VALUES (?,?,?,?,?,?,?,?,?)`);
  let total = 0;
  for (const entry of spec) {
    const pdf = pdfForRow(db, entry.row_uid);
    del.run(entry.row_uid);
    for (const m of entry.mentions) {
      ins.run(entry.row_uid, m.section, m.tier, String(m.page), m.quote, m.use_type || null, m.basis, 1, TODAY);
      total++;
    }
    console.log(`  ${entry.row_uid}: ${entry.mentions.length} mention(s) written`);
  }
  console.log(`\n${total} mention(s) across ${spec.length} row(s).`);
  const n = db.prepare("SELECT COUNT(*) c FROM mention").get().c;
  console.log(`mention table now holds ${n} rows.`);
  db.close();
}

main().catch((e) => { console.error("FAIL:", e.message); process.exit(1); });

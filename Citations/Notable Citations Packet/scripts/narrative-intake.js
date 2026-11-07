#!/usr/bin/env node
/**
 * Write the Section II narrative prose, and check the page numbers it cites.
 *
 * lib.js names this file as the only writer of the narrative table, and the
 * renderer prints a marked blank for anything absent. That division matters: the
 * four subsections describe what the CITING authors did and concluded, so they can
 * be drafted from the manuscript, but they must never be invented. Every sentence
 * here therefore has to point at a page, and every page it points at has to exist
 * in a PDF that is actually filed for that folder.
 *
 * That is the check this tool runs. It cannot tell whether a sentence is a good
 * reading of page 11 — only a person can — so it verifies the weaker claim that
 * the packet can defend: the number a paragraph names is a page of the article.
 * A narrative that cites p.40 of a 15-page PDF is refused rather than printed.
 *
 * Attribution is mandatory. `written_by` is stored and printed above the prose by
 * render-packet.js, so a paragraph drafted here reads as a draft awaiting the
 * applicant's approval and never as the applicant's own argument.
 *
 * Usage:
 *   node scripts/narrative-intake.js --from=narratives.json          # dry run
 *   node scripts/narrative-intake.js --from=narratives.json --write  # apply
 *   node scripts/narrative-intake.js --check                          # re-verify stored prose
 *   node scripts/narrative-intake.js --list
 */
const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");
const { PKT, PACKET_DB, openPacket } = require("./lib.js");
const { pageTexts } = require("./pdfverify.js");

const DRY = !process.argv.includes("--write");
const has = (f) => process.argv.includes(`--${f}`);
const opt = (name) => {
  const a = process.argv.find((s) => s.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : null;
};
const TODAY = new Date().toISOString().slice(0, 10);

const COLS = ["objectives", "importance", "how_used", "findings"];
const HEADINGS = {
  objectives: "Objectives",
  importance: "Importance to Field",
  how_used: "How and Why Your Work Was Used",
  findings: "Findings / Conclusions / Recommendation",
};

function backup() {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const dest = path.join(PKT, `notable-citations.pre-narrative-${stamp}.bak`);
  fs.copyFileSync(PACKET_DB, dest);
  console.log(`backed up to ${path.basename(dest)}`);
}

/** Page counts of every PDF filed for a folder, keyed on the relative path. */
async function folderPages(folderUid) {
  const db = new DatabaseSync(PACKET_DB, { readOnly: true });
  let files = db.prepare("SELECT file FROM file WHERE folder_uid=? ORDER BY file").all(folderUid).map(f => `papers/${folderUid}/${f.file}`);
  db.close();
  if (!files.length) {
    const r = openPacket().prepare("SELECT pdf_file FROM citation WHERE folder_uid=? AND pdf_file IS NOT NULL LIMIT 1").get(folderUid);
    if (r) files = [r.pdf_file];
  }
  const out = [];
  for (const rel of files) {
    if (!/\.pdf$/i.test(rel)) continue;
    const abs = path.isAbsolute(rel) ? rel : path.join(PKT, rel);
    if (!fs.existsSync(abs)) continue;
    try {
      const pages = await pageTexts(rel);
      out.push({ rel, count: pages.length });
    } catch {
      /* a file that will not parse cannot vouch for a page number; skip it */
    }
  }
  return out;
}

/** Every page number a paragraph names: "p.5", "pp. 4-5", "page 12". */
function citedPages(text) {
  const s = String(text || "");
  const nums = new Set();
  for (const m of s.matchAll(/\bpp?\.\s*(\d+)(?:\s*[-\u2013]\s*(\d+))?/gi)) {
    nums.add(parseInt(m[1], 10));
    if (m[2]) nums.add(parseInt(m[2], 10));
  }
  return [...nums].sort((a, b) => a - b);
}

async function checkOne(entry) {
  const problems = [];
  if (!entry.folder_uid) { problems.push("entry with no folder_uid"); return problems; }
  const db = openPacket();
  const rows = db.prepare("SELECT row_uid, status FROM citation WHERE folder_uid=?").all(entry.folder_uid);
  db.close();
  if (!rows.length) problems.push(`${entry.folder_uid}: not a folder in the packet`);
  if (rows.length && !rows.some(r => r.status === "included")) {
    problems.push(`${entry.folder_uid}: no included citation, so a narrative would describe a work not in the packet`);
  }
  if (!entry.written_by) {
    problems.push(`${entry.folder_uid}: no written_by — unattributed prose about the applicant's work cannot be filed`);
  }

  const pdfs = await folderPages(entry.folder_uid);
  if (!pdfs.length) problems.push(`${entry.folder_uid}: no filed PDF, so no page number in the prose can be checked`);
  const maxPage = pdfs.reduce((m, p) => Math.max(m, p.count), 0);

  for (const col of COLS) {
    const body = entry[col];
    if (!body || !String(body).trim()) { problems.push(`${entry.folder_uid}: ${HEADINGS[col]} is empty`); continue; }
    const nums = citedPages(body);
    if (!nums.length) {
      problems.push(`${entry.folder_uid}.${col}: names no page number — every narrative sentence must be traceable to a page`);
    } else if (maxPage) {
      const bad = nums.filter(n => n < 1 || n > maxPage);
      if (bad.length) {
        problems.push(`${entry.folder_uid}.${col}: cites page ${bad.join(", ")} but the filed PDF has only ${maxPage} pages`);
      }
    }
  }
  return problems;
}

async function main() {
  if (has("list")) {
    const rows = openPacket().prepare("SELECT * FROM narrative ORDER BY folder_uid").all();
    if (!rows.length) console.log("no narratives recorded");
    for (const n of rows) {
      const filled = COLS.filter(c => n[c]);
      console.log(`${n.folder_uid}  ${filled.length}/4 sections  written_by=${n.written_by || "?"}  on ${n.written_on || "?"}`);
    }
    console.log(`\n${rows.length} narrative(s).`);
    return;
  }

  if (has("check")) {
    const rows = openPacket().prepare("SELECT * FROM narrative ORDER BY folder_uid").all();
    let bad = 0;
    for (const n of rows) {
      const problems = await checkOne(n);
      console.log(`${problems.length ? " FAIL " : "  ok  "}${n.folder_uid}` + (problems.length ? ` — ${problems.join("; ")}` : ""));
      if (problems.length) bad++;
    }
    console.log(`\n${rows.length} narrative(s) checked, ${bad} failure(s).`);
    process.exit(bad ? 1 : 0);
  }

  const from = opt("from");
  if (!from) {
    console.error("usage: node scripts/narrative-intake.js --from=<file.json> [--write] | --check | --list");
    process.exit(2);
  }
  const spec = JSON.parse(fs.readFileSync(path.isAbsolute(from) ? from : path.join(process.cwd(), from), "utf8"));
  if (!Array.isArray(spec)) { console.error("the JSON must be an array of { folder_uid, objectives, importance, how_used, findings, written_by }"); process.exit(2); }

  console.log(DRY ? "DRY RUN — nothing is written. Re-run with --write to apply.\n" : "WRITING.\n");

  const all = [];
  for (const entry of spec) {
    const problems = await checkOne(entry);
    console.log(`  ${problems.length ? "FAIL" : "ok  "} ${entry.folder_uid}` +
      (problems.length ? ` — ${problems.join("; ")}` : ` — pages ${[...new Set(COLS.flatMap(c => citedPages(entry[c])))].sort((a, b) => a - b).join(", ")}`));
    all.push(...problems);
  }
  if (all.length) {
    console.log(`\n${all.length} problem(s) — nothing written.`);
    process.exit(1);
  }

  if (DRY) {
    console.log(`\nAll ${spec.length} narrative(s) passed. Re-run with --write.`);
    return;
  }

  backup();
  const db = openPacket();
  const del = db.prepare("DELETE FROM narrative WHERE folder_uid=?");
  const ins = db.prepare(`INSERT INTO narrative (folder_uid, objectives, importance, how_used, findings, written_by, written_on)
    VALUES (?,?,?,?,?,?,?)`);
  for (const e of spec) {
    del.run(e.folder_uid);
    ins.run(e.folder_uid, e.objectives.trim(), e.importance.trim(), e.how_used.trim(), e.findings.trim(),
      e.written_by.trim(), e.written_on || TODAY);
  }
  db.close();
  const n = openPacket().prepare("SELECT COUNT(*) c FROM narrative").get().c;
  console.log(`\n${spec.length} narrative(s) written; narrative table now holds ${n} rows.`);
}

main().catch((e) => { console.error("FAIL:", e.message); process.exit(1); });

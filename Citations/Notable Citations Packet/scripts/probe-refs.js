/**
 * Read-only probe: how does a reference list look once pdf.js has extracted it,
 * and what do the in-text markers for a given number look like?
 *
 * Answers three questions the resolver depends on:
 *   1. Can a bibliography be split into numbered entries from the extracted text?
 *   2. Does the applicant's cited paper appear as one of those entries, and can
 *      it be matched on title/year/first author?
 *   3. In what rendered forms does that entry's number appear in prose —
 *      [127], [125-127], [125, 127], a bare superscript, "(127)"?
 *
 * Writes nothing.  node scripts/probe-refs.js --folder=cit-000976 --num=127
 */
"use strict";
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
const { PKT, openPacket } = require("./lib");

const argv = process.argv.slice(2);
const ONLY = (argv.find(a => a.startsWith("--folder=")) || "").split("=")[1] || "cit-000976";
const NUM = Number((argv.find(a => a.startsWith("--num=")) || "").split("=")[1] || 127);

let pdfMod = null, pdfDirs = null;
async function loadPdfjs() {
  if (!pdfMod) {
    const build = path.join(PKT, "node_modules", "pdfjs-dist");
    pdfMod = await import(pathToFileURL(path.join(build, "legacy", "build", "pdf.mjs")).href);
    // The module namespace object is frozen, so keep the asset dirs separately.
    pdfDirs = {
      standardFontDataUrl: pathToFileURL(path.join(build, "standard_fonts") + path.sep).href,
      cMapUrl: pathToFileURL(path.join(build, "cmaps") + path.sep).href,
    };
  }
  return { mod: pdfMod, dirs: pdfDirs };
}

/** Extract lines, but keep each item's height and baseline so superscripts survive. */
async function extract(abs) {
  const { mod: lib, dirs } = await loadPdfjs();
  const doc = await lib.getDocument({
    data: new Uint8Array(fs.readFileSync(abs)),
    ...dirs,
    useWorkerFetch: false,
    isEvalSupported: false,
    disableFontFace: true,
  }).promise;
  const pages = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    const lines = [];
    let cur = null;
    for (const it of tc.items) {
      const y = Math.round(it.transform[5] * 10) / 10;
      const h = Math.round(Math.abs(it.transform[3]) * 100) / 100;
      if (!cur || Math.abs(cur.y - y) > 3) { cur = { y, items: [] }; lines.push(cur); }
      if (it.str) cur.items.push({ str: it.str, h, y });
    }
    pages.push(lines
      .map(l => ({ y: l.y, text: l.items.map(i => i.str).join("").replace(/\s+/g, " ").trim(), items: l.items }))
      .filter(l => l.text.length));
  }
  await doc.destroy();
  return pages;
}

async function main() {
  const db = openPacket();
  const files = db.prepare(`SELECT file FROM file WHERE folder_uid=? AND cited=1`).all(ONLY);
  const rows = db.prepare(`SELECT row_uid, cited_paper, cited_tool, cites_id FROM citation WHERE folder_uid=?`).all(ONLY);
  console.log(`FOLDER ${ONLY}`);
  for (const r of rows) console.log(`  row ${r.row_uid} [${r.cited_tool || "?"}] cites: ${(r.cited_paper || "").slice(0, 90)}`);
  for (const f of files) {
    const abs = path.join(PKT, f.file);
    if (!fs.existsSync(abs)) { console.log(`  ! missing ${f.file}`); continue; }
    const pages = await extract(abs);
    console.log(`\nFILE ${f.file}  ${pages.length} pages`);

    // Where do lines that look like bibliography entries live?
    const BIB = /^(?:\[\s*\d+\s*\]|\d+\.\s+[A-Z][a-z]+\s*,?\s+[A-Z]\.?)/;
    for (let p = 0; p < pages.length; p++) {
      const n = pages[p].filter(l => BIB.test(l.text)).length;
      if (n >= 3) console.log(`  p.${p + 1}: ${n} entry-like lines of ${pages[p].length}`);
    }

    // Show the entry the number points at, and its neighbours.
    const re = new RegExp(`^\\[?\\s*${NUM}\\s*[\\].,]`);
    console.log(`\n  --- lines starting with ${NUM} ---`);
    for (let p = 0; p < pages.length; p++) {
      for (const l of pages[p]) {
        if (re.test(l.text)) console.log(`   p.${p + 1}: ${l.text.slice(0, 220)}`);
      }
    }

    // Every place the digits appear at all, with the marker shape.
    console.log(`\n  --- every occurrence of "${NUM}" in text (first 30) ---`);
    let shown = 0;
    for (let p = 0; p < pages.length; p++) {
      for (const l of pages[p]) {
        let i = -1;
        while ((i = l.text.indexOf(String(NUM), i + 1)) >= 0 && shown < 30) {
          const ctx = l.text.slice(Math.max(0, i - 45), i + 50).replace(/\n/g, " ");
          console.log(`   p.${p + 1} [${i}]: …${ctx}…`);
          shown++;
        }
      }
    }

    // Superscript shape: how do digit-only items' heights compare to their line?
    console.log(`\n  --- digit-only items whose height is under 80% of the line's tallest ---`);
    let sup = 0;
    for (let p = 0; p < pages.length && sup < 25; p++) {
      for (const l of pages[p]) {
        if (!l.items || l.items.length < 2) continue;
        const tall = Math.max(...l.items.map(i => i.h));
        for (const it of l.items) {
          if (!/^[\s\[\],\d\-.–—;\s]+$/.test(it.str)) continue;
          if (!/\d/.test(it.str)) continue;
          if (it.h < tall * 0.8 && sup < 25) {
            console.log(`   p.${p + 1} h=${it.h} vs ${tall}: "${it.str}" in "${l.text.slice(0, 90)}"`);
            sup++;
          }
        }
      }
    }
    if (!sup) console.log(`   (none — this PDF does not set citations as raised smaller text)`);
  }
  db.close();
}
main().catch(e => { console.error(e.message); process.exit(1); });

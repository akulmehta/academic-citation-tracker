#!/usr/bin/env node
"use strict";
/**
 * For each citing article whose preprint was public BEFORE the petition date while the final article came after it
 * (scripts/citing-meta.js `showPre`), save a highlighted copy of the preprint next to the article's copy in
 * `Citations/highlighted PDFs`, with the same index number, name and cit number, ending `_biorxiv.pdf`:
 *
 *   - yellow: the sentence(s) that cite my work, and my paper in the reference list (as in the article's copy);
 *   - green : the "this version posted <date>" line on page 1, the evidence that the preprint was public on that date.
 *
 * The preprint PDF is the one filed in papers/<folder>/ with role 'preprint'. Nothing outside the copies is changed.
 *
 *   node scripts/highlight-preprints.js
 */
const fs = require("fs");
const path = require("path");
const { PDFDocument } = require("pdf-lib");
const L = require("./lib");
const H = require("./highlight-pdfs");
const { META, showPre, fmt } = require("./citing-meta");

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const long = iso => { const [y, m, d] = iso.split("-"); return `${MONTHS[+m - 1]} ${+d}, ${y}`; };
// the sentence of the preprint that cites my work (the wording of the preprint, which can differ from the article)
const KEY = {
  "cit-000544": "PpaPV1 glycan microarray data were compared with PsSC (Ituarte et al., 2018) and PdPV1 (Brola et al., 2020) microarrays using the Glycan Array Dashboard (glycotoolkit.com/GLAD/) (Mehta & Cummings, 2019).",
  // line numbers in the margin of this preprint break the sentence finder, so the sentence is given by its first and last words
  "cit-000752": { start: "Among the possible glycan", end: "www.glygen.org/glycan-search)( 68 )" },
  "cit-000621": "The glycan structures were drawn using GlycoGlyph",
};
const GREEN = [0.45, 0.9, 0.45];

async function main() {
  const db = L.openPacket(), cat = L.openCatalog();
  const lib = await H.loadPdfjs();
  const outdir = H.OUTDIR;
  const made = [];
  for (const uid of Object.keys(META).filter(showPre)) {
    const f = db.prepare("SELECT file FROM file WHERE folder_uid=? AND role='preprint' AND cited=1 ORDER BY file").get(uid);
    const art = fs.readdirSync(outdir).find(n => n.endsWith(`_${uid}.pdf`));
    if (!art) { console.log(`${uid}: no highlighted article copy found in the folder`); continue; }
    if (!f) { console.log(`${uid}: NO PREPRINT PDF filed in papers/${uid}/ — not made`); continue; }
    const src = L.absFile(f.file);
    const data = fs.readFileSync(src);
    const doc = await lib.getDocument({ data: new Uint8Array(data), ...H.getDirs(), useWorkerFetch: false, isEvalSupported: false, disableFontFace: true }).promise;
    const pdf = await PDFDocument.load(data, { ignoreEncryption: true });
    const models = new Map();
    const model = async p => { if (!models.has(p)) models.set(p, await H.pageModel(doc, p)); return models.get(p); };
    const m = META[uid];
    const notes = [];
    const done = [];

    // 1. the sentence that cites my work
    let found = false;
    for (let p = 1; p <= doc.numPages && KEY[uid]; p++) {
      const mdl = await model(p);
      let a, b;
      if (typeof KEY[uid] === "object") {
        const h1 = H.locate(mdl, KEY[uid].start), h2 = H.locate(mdl, KEY[uid].end);
        if (!h1 || !h2 || h2[1] < h1[0]) continue;
        a = h1[0]; b = h2[1];
        while (b + 1 < mdl.S.length && /[\s).]/.test(mdl.S[b + 1]) && b - h2[1] < 4) b++;
      } else {
        const hit = H.locate(mdl, KEY[uid]);
        if (!hit) continue;
        [a, b] = H.sentenceRange(mdl.S, hit[0], hit[1]);
        [a, b] = H.trimHeadings(mdl, a, b, hit[1]);
      }
      H.addHighlight(pdf, p, H.rectsFor(mdl, a, b), "Cites my work");
      done.push({ page: p, kind: "text", text: mdl.S.slice(a, b + 1).replace(/\s+/g, " ") });
      found = true; break;
    }
    if (!found) notes.push("the citing sentence was not found in the preprint");

    // 2. my paper in the preprint's reference list
    const rows = db.prepare("SELECT * FROM citation WHERE folder_uid=? AND status='included'").all(uid);
    const seen = new Set();
    for (const r of rows) {
      const pub = H.myPub(cat, r);
      if (!pub || seen.has(pub.title)) continue;
      seen.add(pub.title);
      const surname = pub.authors.split(",")[0].trim().split(/\s+/).pop();
      for (let p = doc.numPages; p >= 1; p--) {
        const mdl = await model(p);
        const r2 = H.refByTitle(mdl, pub.title, surname);
        if (!r2) continue;
        H.addHighlight(pdf, p, H.rectsFor(mdl, r2[0], r2[1]), "My paper in the reference list");
        done.push({ page: p, kind: "reference", text: mdl.S.slice(r2[0], r2[1] + 1).replace(/\s+/g, " ") });
        break;
      }
    }

    // 3. the date evidence: bioRxiv prints "this version posted <date>" on every page; highlight it on page 1
    const phrase = `this version posted ${long(m.pre[1])}`;
    const m1 = await model(1);
    const dh = H.locate(m1, phrase);
    if (dh) {
      H.addHighlight(pdf, 1, H.rectsFor(m1, dh[0], dh[1]), `Evidence of public date: ${m.pre[0]} preprint posted ${fmt(m.pre[1])}, before the petition date (April 25, 2024). The final article was online ${fmt(m.on)}.`, GREEN);
      done.push({ page: 1, kind: "date", text: m1.S.slice(dh[0], dh[1] + 1).replace(/\s+/g, " ") });
    } else notes.push(`the line "${phrase}" was not found on page 1`);

    await doc.destroy();
    const name = art.replace(/\.pdf$/, "_biorxiv.pdf");
    fs.writeFileSync(path.join(outdir, name), await pdf.save());
    console.log(`${name}: ${done.map(d => `${d.kind} p.${d.page}`).join(", ")}${notes.length ? "  NOTES: " + notes.join("; ") : ""}`);
    made.push({ uid, name, highlights: done, notes });
  }
  fs.writeFileSync(path.join(L.REPO, "archived-logs", "highlights-preprints.json"), JSON.stringify(made, null, 1));
}
main().catch(e => { console.error(e); process.exit(1); });

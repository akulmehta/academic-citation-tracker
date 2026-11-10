#!/usr/bin/env node
"use strict";
/**
 * Fill `Citations/Notable Citations Template_08.27.26.docx` with every citation now in packet.html
 * (status = 'included'), one CITATION block per citing article, in packet order.
 *
 * The template's own paragraphs are reused (same fonts, headings, spacing, page breaks); only the instruction
 * line under each label is replaced by the answer. The prose is the narrative stored in the database, turned
 * into first person (the applicant is the author of this document), minus sentences that were drafting
 * notes. Per-citation institutions and the third "relation" sentence of Section II live in the tables below.
 *
 *   node scripts/build-docx.js [--out="path.docx"]
 *
 * Read-only on the database. Never touches the Independent Citation Record.
 */
const fs = require("fs");
const path = require("path");
const JSZip = require("jszip");
const L = require("./lib");

const TEMPLATE = path.join(L.REPO, "Citations", "Notable Citations Template_08.27.26.docx");
const outArg = process.argv.find(a => a.startsWith("--out="));
const OUT = outArg ? outArg.slice(6) : path.join(L.REPO, "Citations", "Notable Citations - Completed.docx");

const PROJECTS = {
  1: "Synthesizing Anticoagulants with Reduced Side Effects",
  2: "Developing Bioinformatics Tools to Capture and Analyze Glycomics and Glycan Microarray Data",
  3: "Advancing Glycan Research with Microarray Innovations",
  4: "Advancing Glycopeptide Synthesis with Glyco-SPOT",
};

const { META, PETITION_DATE, fmt, earliest, showPre, period, datesList } = require("./citing-meta");
const PETITION_LONG = "April 25, 2024";
// Full author list of the GlyGen paper as printed in its reference entries (the catalogue stops after five names).
const GLYGEN_AUTHORS = "WS York, R Mazumder, R Ranzinger, N Edwards, R Kahsay, KF Aoki-Kinoshita, MP Campbell, RD Cummings, T Feizi, M Martin, DA Natale, NH Packer, RJ Woods, G Agarwal, S Arpinar, S Bhat, J Blake, LJG Castro, B Fochtman, J Gildersleeve, R Goldman, X Holmes, V Jain, S Kulkarni, R Mahadik, AY Mehta, R Mousavi, S Nakarakommula, R Navelkar, N Pattabiraman, MJ Pierce, K Ross, P Vasudev, J Vora, T Williamson, W Zhang";
const TEXT = require("./docx-text");

// Order of the citations: see scripts/packet-order.js (oldest citing article first).

// Sentences the database holds only as a fragment, or with extraction debris in front.
const EXTRA_QUOTES = {
  "cit-000629": [{ q: "Diagrams of glycan structures were generated using GlycoGlyph (49). Glycan microarray protocol was followed using the microwave-assisted wet-erase process by Mehta et al. (50).", sec: "Results (figure legend)", pg: 6 }],
  "cit-000542": [{ q: "We also thank Akul Mehta (Harvard University) for valuable discussions and help with the glycan tool Glycan Array Dashboard and Consortium for Functional Glycomics (CFG) names", sec: "Acknowledgments", pg: 12 }],
  "cit-000602": [{ q: "We produced glycan schematics using GlycoGlyph then adjusted them on Inkscape", sec: "Materials and Methods", pg: 11 }],
};
const QUOTE_FIX = {
  "cit-000516": [["(accessed on 25 November 2025) ", ""], ["Glycan Microarray Analysis Glycan microarray analysis", "Glycan microarray analysis"]],
  "cit-000619": [["ing two N-acetylglucosamine (GlcNac) units", "A model of the N-linked glycan containing two N-acetylglucosamine (GlcNac) units"]],
  "cit-000602": [["3 and 4 and produced on GlycoGlyph with adjustments on Inkscape for Fig.", "Glycan schematics adapted from Z Biotech for Figs. 3 and 4 and produced on GlycoGlyph with adjustments on Inkscape for Fig. 5"]],
  "cit-000518": [["Finally, GLycan Array Dashboard (GLAD) 93", "Finally, GLycan Array Dashboard (GLAD) 93, version 3.1, from the glycotoolkit website (glycotoolkit.com/Tools/GLAD/) hosted by the National Center for Functional Glycomics, was used for data visualization, data mining, generation of heatmaps and boxplot graphs"]],
};
const SECTION_FIX = { "cit-000613:11": "Figure legend" };

// ---------- xml ----------
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const RPR = '<w:rPr><w:rFonts w:eastAsia="Times New Roman" w:cs="Times New Roman" w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr>';
const RPR_B = '<w:rPr><w:rFonts w:eastAsia="Times New Roman" w:cs="Times New Roman" w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:b/><w:bCs/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr>';
const RPR_I = '<w:rPr><w:rFonts w:eastAsia="Times New Roman" w:cs="Times New Roman" w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:i/><w:iCs/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr>';
function answer(text) {
  return '<w:p><w:pPr><w:pStyle w:val="Normal"/><w:widowControl w:val="false"/><w:spacing w:lineRule="auto" w:line="240" w:before="0" w:after="160"/><w:jc w:val="both"/><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="Times New Roman" w:cs="Times New Roman"/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr></w:pPr>'
    + `<w:r>${RPR}<w:t xml:space="preserve">${esc(text)}</w:t></w:r></w:p>`;
}
function answerRuns(parts) { // [{t, i}]
  return '<w:p><w:pPr><w:pStyle w:val="Normal"/><w:widowControl w:val="false"/><w:spacing w:lineRule="auto" w:line="240" w:before="0" w:after="160"/><w:jc w:val="both"/></w:pPr>'
    + parts.map(p => `<w:r>${p.b ? RPR_B : p.i ? RPR_I : RPR}<w:t xml:space="preserve">${esc(p.t)}</w:t></w:r>`).join("") + "</w:p>";
}
function setText(p, text) { return p.replace(/<w:t>[^<]*<\/w:t>/, `<w:t>${esc(text)}</w:t>`); }

// ---------- data ----------
function authorsOf(r) {
  let a = (r.citing_authors || "").trim();
  const n = a.split(/,\s*/).length;
  if (n >= 10 && !/et al/.test(a) && n <= 10) a += ", et al.";
  return a;
}
function citingFormal(r) {
  const m = META[r.folder_uid] || {};
  const venue = m.venue || r.citing_venue || "";
  const url = r.citing_url && r.citing_url !== "null" ? ` ${r.citing_url}` : "";
  return `${authorsOf(r)}. ${r.citing_title}. ${venue}${/\b(19|20)\d\d\b/.test(venue) ? "" : ` (${r.citing_year})`}.${url}`;
}
function yearOf(p) { return p.year; }

async function main() {
  const db = L.openPacket(), cat = L.openCatalog();
  const rowsAll = db.prepare("SELECT * FROM citation WHERE status='included' ORDER BY n, is_main DESC, row_uid").all();
  const folders = [];
  for (const r of rowsAll) {
    let f = folders.find(x => x.uid === r.folder_uid);
    if (!f) { f = { uid: r.folder_uid, rows: [] }; folders.push(f); }
    f.rows.push(r);
  }
  { const order = require("./packet-order").orderedFolders(folders.map(f => f.uid));
    folders.sort((a, b) => order.indexOf(a.uid) - order.indexOf(b.uid)); }

  const orig = L.originalApplicationUids();
  const zip = await JSZip.loadAsync(fs.readFileSync(TEMPLATE));
  let xml = await zip.file("word/document.xml").async("string");
  const bi = xml.indexOf("<w:body>") + 8;
  const head = xml.slice(0, bi);
  const sect = xml.slice(xml.lastIndexOf("<w:sectPr"));
  const ps = xml.slice(bi).match(/<w:p[ >][\s\S]*?<\/w:p>/g);
  const T = i => ps[i];
  const blocks = [];
  const problems = [];

  // Dates of one citing article, as runs: where it stands against the petition date, then every date found.
  const dateRuns = uid => {
    const m = META[uid], per = period(uid), runs = [];
    runs.push({ b: true, t: per === "before" ? "Public BEFORE the petition date (April 25, 2024). " : "Public AFTER the petition date (April 25, 2024). " });
    if (per === "before" && showPre(uid)) runs.push({ b: true, t: `The ${m.pre[0]} preprint was public on ${fmt(m.pre[1])}; the final journal article went online only on ${fmt(m.on)}. ` });
    runs.push({ t: "Dates: " + datesList(uid).map(([k, v]) => `${k} ${v}`).join("; ") + "." });
    return runs;
  };
  // Divider pages: citing articles that became public before / after the petition date (25 April 2024).
  const divider = (which) => {
    const before = which === "before";
    const list = folders.map((f, i) => ({ f, i })).filter(x => period(x.f.uid) === which);
    const first = list[0].i + 1, last = list[list.length - 1].i + 1;
    const out = [];
    out.push(setText(T(0), before ? "CITING ARTICLES PUBLIC BEFORE THE PETITION DATE" : "CITING ARTICLES PUBLIC AFTER THE PETITION DATE"));
    out.push(answer(`Petition date: ${PETITION_LONG}.`));
    out.push(answer(`The ${list.length} citing articles that follow (Citations #${first} to #${last}) first became public ${before ? "before" : "after"} the petition date. An article counts as public from the earliest of its preprint (if one was posted) and its final journal publication, and the articles are listed in that order, oldest first.`));
    for (const x of list) {
      const m = META[x.f.uid], r = x.f.rows.find(r => r.is_main) || x.f.rows[0];
      const parts = [{ t: `Citation #${x.i + 1}: ` }, { t: r.citing_title, i: true }, { t: `. ${m.venue}. ` }];
      if (showPre(x.f.uid)) parts.push({ b: true, t: `${m.pre[0]} preprint public ${fmt(m.pre[1])}; ` });
      parts.push({ t: `${showPre(x.f.uid) ? "final" : "Final"} article online ${fmt(m.on)}.` });
      out.push(answerRuns(parts));
    }
    if (before) {
      const late = list.filter(x => META[x.f.uid].on >= PETITION_DATE);
      if (late.length) out.push(answer("Placed in this section because of an earlier preprint: " + late.map(x => `Citation #${x.i + 1} (${META[x.f.uid].pre[0]} preprint ${fmt(META[x.f.uid].pre[1])}; final article online ${fmt(META[x.f.uid].on)})`).join("; ") + ". In each case the preprint was publicly available before the petition date and the final journal article appeared after it."));
    } else {
      out.push(answer("Every article in this group, including its earliest preprint where there was one, first became public after the petition date."));
    }
    out.push(answer("Dates were taken from the first pages of each PDF and checked against PubMed, Europe PMC (which indexes bioRxiv, medRxiv and Research Square preprints), Crossref and OpenAlex on November 10, 2026."));
    out.push(T(25));
    return out.join("");
  };

  folders.forEach((f, idx) => {
    if (idx === 0) blocks.push(divider(period(f.uid)));
    else if (period(f.uid) !== period(folders[idx - 1].uid)) blocks.push(divider(period(f.uid)));
    const main = f.rows.find(r => r.is_main) || f.rows[0];
    const txt = TEXT[f.uid];
    if (!txt) problems.push(`${f.uid}: no Section II text in scripts/docx-text-*.js`);
    if (orig && f.rows.some(r => orig.has(r.row_uid))) problems.push(`${f.uid}: in original application`);
    const meta = META[f.uid];
    if (!meta) problems.push(`${f.uid}: no META`);

    // cited papers (distinct), each with its project
    const cited = [];
    for (const r of f.rows) {
      if (cited.some(c => c.title === r.cited_paper)) continue;
      const p = cat.prepare("SELECT authors, title, venue, year FROM publications WHERE cites_id=?").get(r.cites_id)
        || cat.prepare("SELECT authors, title, venue, year FROM publications WHERE title=?").get(r.cited_paper);
      cited.push({ title: r.cited_paper, pub: p, project: r.project });
    }
    const projects = [...new Set(f.rows.map(r => r.project).filter(Boolean))].sort();

    // quotes: each row's verified quote, then any mention not already inside one of them
    const quotes = [];
    const seen = new Set();
    const strip = s => s.toLowerCase().replace(/[^a-z0-9]/g, "");
    const dup = (k, pg) => {
      const a = strip(k);
      return [...seen].some(([s, spg]) => {
        if (String(spg) !== String(pg)) return false;     // the same words on another page are another instance
        if (s.includes(a) || a.includes(s)) return true;
        for (let i = 0; i + 40 <= a.length; i += 10) if (s.includes(a.slice(i, i + 40))) return true;
        return false;
      });
    };
    const push = (q, sec, pg, whole) => {
      const k = q.replace(/\s+/g, " ").trim().replace(/^[.,;:\s]+/, "");
      if (!k) return;
      if (!whole && (k.length < 30 || !/^[A-Z(“"]/.test(k))) return;   // a snippet that starts mid-sentence is not quotable
      if (dup(k, pg)) return;
      seen.add([strip(k), pg]); quotes.push({ q: k, sec: (SECTION_FIX[f.uid + ":" + pg] || sec), pg });
    };
    for (const r of f.rows) if (r.quote) push(r.quote, r.section, r.page, true);
    for (const r of f.rows) {
      for (const m of db.prepare("SELECT * FROM mention WHERE row_uid=? ORDER BY page").all(r.row_uid)) push(m.quote || "", m.section, m.page, false);
    }
    for (const x of (EXTRA_QUOTES[f.uid] || [])) push(x.q, x.sec, x.pg, true);
    for (const x of quotes) for (const [a, b] of (QUOTE_FIX[f.uid] || [])) x.q = x.q.replace(a, b);
    quotes.sort((a, b) => parseInt(a.pg, 10) - parseInt(b.pg, 10));

    const out = [];
    out.push(setText(T(0), `CITATION #${idx + 1}`));
    out.push(T(1), T(2));
    const label = (i, ans) => { out.push(T(i)); for (const a of ans) out.push(a); };

    label(3, cited.map(c => {
      const p = c.pub;
      let authors = p ? p.authors.replace(/,?\s*\.\.\.+\s*$/, ", et al") : "";
      if (p && /^GlyGen:/i.test(p.title)) authors = GLYGEN_AUTHORS;   // the catalogue stops the list before my name
      const formal = p ? `${authors}. ${p.title}. ${p.venue}${/\b(19|20)\d\d\b/.test(p.venue) ? "" : ` (${p.year})`}.` : c.title;
      return answer(formal.replace(/\s+,/g, ","));
    }));
    label(5, [answer(citingFormal(main)), answerRuns(dateRuns(f.uid))]);
    label(7, [answer(projects.length ? projects.map(p => `Project ${p}: ${PROJECTS[p]}`).join("; ") : "Project not yet assigned")]);
    label(9, [answer(meta ? meta.inst : "")]);
    label(11, [answer("Original research article")]);
    out.push(T(13), T(14));

    label(15, quotes.map(q => answerRuns([{ t: `“${q.q}”`, i: true }, { t: ` (${String(q.sec || "").replace(/\s+/g, " ")}, p.${q.pg})` }])));

    label(17, [answer(txt.objectives)]);
    label(19, [answer(txt.importance)]);
    label(21, txt.how.map(answer));
    label(23, [answer(txt.findings)]);
    if (idx < folders.length - 1) out.push(T(25));
    blocks.push(out.join(""));
  });

  if (problems.length) console.log("NOTES:\n  " + problems.join("\n  "));
  const newXml = head + blocks.join("") + sect;
  zip.file("word/document.xml", newXml);
  const buf = await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" });
  fs.writeFileSync(OUT, buf);
  console.log(`wrote ${OUT} — ${folders.length} citations (${rowsAll.length} database rows)`);
  // leftovers a reader would trip on
  const text = newXml.replace(/<[^>]+>/g, " ");
  for (const w of ["applicant", "preparer", "folder", "counsel", "packet"]) {
    const m = text.match(new RegExp(".{40}\\b" + w + "\\b.{40}", "gi"));
    if (m) console.log(`LEFTOVER '${w}':`, m.slice(0, 5));
  }
}
main().catch(e => { console.error(e); process.exit(1); });

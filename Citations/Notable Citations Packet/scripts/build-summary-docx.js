#!/usr/bin/env node
"use strict";
/**
 * A one-table summary of Citations/Notable Citations - Completed.docx, as its own Word file:
 * Citations/Notable Citations - Summary Table.docx. One row per citing article, oldest first, in two groups
 * (published before / after the petition date of April 25, 2024), each row giving the citing article, its date,
 * which of my works it cites, the project, where it cites it, how my work was used and why that matters.
 *
 *   node scripts/build-summary-docx.js [--out="path.docx"]
 *
 * Reads the packet database, scripts/citing-meta.js (dates) and scripts/docx-summary-text.js (the one-line texts).
 * Read-only on the database. Never touches the Independent Citation Record.
 */
const fs = require("fs");
const path = require("path");
const JSZip = require("jszip");
const L = require("./lib");
const { META, PETITION_DATE, fmt, showPre, period, datesList } = require("./citing-meta");
const { orderedFolders } = require("./packet-order");
const SUM = require("./docx-summary-text");
const { buildQuotes } = require("./quotes");

const outArg = process.argv.find(a => a.startsWith("--out="));
const OUT = outArg ? outArg.slice(6) : path.join(L.REPO, "Citations", "Notable Citations - Summary Table.docx");
const PROJECTS = {
  1: "Synthesizing Anticoagulants with Reduced Side Effects",
  2: "Developing Bioinformatics Tools to Capture and Analyze Glycomics and Glycan Microarray Data",
  3: "Advancing Glycan Research with Microarray Innovations",
  4: "Advancing Glycopeptide Synthesis with Glyco-SPOT",
};
const WIDTHS = [400, 2300, 1900, 1350, 780, 3870, 2300, 1500];      // twips, 14,400 in all (landscape Letter, 0.5" margins)
const HEAD = ["#", "Citing article", "Dates (earliest public first)", "My work cited", "Project", "Exact quote(s) from the article, with page", "How my work was used", "Why it matters"];

const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const FONT = '<w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="Times New Roman" w:cs="Times New Roman"/>';
const run = (t, o = {}) => `<w:r><w:rPr>${FONT}${o.b ? "<w:b/>" : ""}${o.i ? "<w:i/>" : ""}${o.color ? `<w:color w:val="${o.color}"/>` : ""}<w:sz w:val="${o.sz || 17}"/><w:szCs w:val="${o.sz || 17}"/>${o.u ? '<w:u w:val="single"/>' : ""}</w:rPr><w:t xml:space="preserve">${esc(t)}</w:t></w:r>`;
const para = (runs, o = {}) => `<w:p><w:pPr>${o.keep ? "<w:keepNext/>" : ""}<w:spacing w:before="0" w:after="${o.after ?? 40}" w:line="240" w:lineRule="auto"/>${o.jc ? `<w:jc w:val="${o.jc}"/>` : ""}</w:pPr>${runs}</w:p>`;
function cell(w, paras, o = {}) {
  return `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/>${o.span ? `<w:gridSpan w:val="${o.span}"/>` : ""}${o.fill ? `<w:shd w:val="clear" w:color="auto" w:fill="${o.fill}"/>` : ""}</w:tcPr>${paras.join("")}</w:tc>`;
}
const row = (cells, o = {}) => `<w:tr><w:trPr><w:cantSplit/>${o.header ? "<w:tblHeader/>" : ""}</w:trPr>${cells.join("")}</w:tr>`;

function shortSection(s) { return String(s || "").replace(/\s*\(.*\)\s*$/, "").replace(/^Materials and Methods$/i, "Methods").trim(); }
// One short name per publication of mine, used both in the list above the table and in the "My work cited" column, so the two match.
const SHORT = { "GLAD:": "GLAD (Bioinformatics, 2019)", "GlycoGlyph:": "GlycoGlyph (Bioinformatics, 2020)", "Reusable": "MAWE (Glycobiology, 2024)", "Antigenic": "H3N2 receptor-binding paper (J Virol, 2019)", "Rational": "Thrombin inhibitor paper (J Med Chem, 2011)", "Insights": "Glycan microarray technologies review (Mol Cell Proteomics, 2024)", "Differential": "Oligomannose recognition paper (Sci Adv, 2021)", "GlyGen:": "GlyGen paper (Glycobiology, 2020)", "Allosteric partial": "Allosteric partial inhibition paper (Sci Rep, 2016)", "Allosteric inhibition": "Factor XIa allosteric inhibition paper (J Med Chem, 2014)" };
const shortName = p => SHORT[String(p.title).split(" ").slice(0, 2).join(" ")] || SHORT[String(p.title).split(" ")[0]] || p.tool || p.title.split(" ").slice(0, 5).join(" ");
function citedLabel(r) { return shortName({ title: r.cited_paper, tool: r.cited_tool }); }
function firstAuthor(r) {
  if (r.folder_uid === "cit-000613") return "Schüßler et al.";
  const raw = String(r.citing_authors || "");
  let sur;
  if (raw.includes(";")) sur = raw.split(";")[0].split(",")[0].trim();
  else {
    const first = raw.split(",")[0].trim(), tok = first.split(/\s+/);
    sur = /^[A-Z][A-Za-z'’-]+ [A-Z.-]{1,4}$/.test(first) ? tok[0] : tok[tok.length - 1];
  }
  return `${sur} et al.`;
}

async function main() {
  const db = L.openPacket(), cat = L.openCatalog();
  const rowsAll = db.prepare("SELECT * FROM citation WHERE status='included' ORDER BY n, is_main DESC, row_uid").all();
  const byFolder = new Map();
  for (const r of rowsAll) { if (!byFolder.has(r.folder_uid)) byFolder.set(r.folder_uid, []); byFolder.get(r.folder_uid).push(r); }
  const order = orderedFolders([...byFolder.keys()]);
  const problems = [];

  const pubs = new Map();   // cited paper title -> { rows: Set of table numbers }
  const bodyRows = [];
  let lastPeriod = null;
  order.forEach((uid, idx) => {
    const rows = byFolder.get(uid), main = rows.find(r => r.is_main) || rows[0], m = META[uid], s = SUM[uid];
    if (!s) problems.push(`${uid}: no summary text`);
    const per = period(uid);
    if (per !== lastPeriod) {
      lastPeriod = per;
      const n = order.filter(u => period(u) === per).length;
      bodyRows.push(row([cell(WIDTHS.reduce((a, b) => a + b, 0), [para(run(per === "before"
        ? `Citing articles public BEFORE the petition date (April 25, 2024) — ${n} articles`
        : `Citing articles public AFTER the petition date (April 25, 2024) — ${n} articles`, { b: true, sz: 20 }), { after: 60, keep: true })], { span: 8, fill: per === "before" ? "DCE6F2" : "E2EFDA" })]));
    }
    for (const r of rows) { const k = r.cites_id || r.cited_paper; if (!pubs.has(k)) pubs.set(k, { title: r.cited_paper, cites_id: r.cites_id, tool: r.cited_tool, nums: new Set() }); pubs.get(k).nums.add(idx + 1); }
    const cited = [...new Set(rows.map(citedLabel))];
    const projects = [...new Set(rows.map(r => r.project).filter(Boolean))].sort();
    const where = [];
    for (const r of rows) {
      const ms = db.prepare("SELECT section, page FROM mention WHERE row_uid=? ORDER BY CAST(page AS INTEGER)").all(r.row_uid);
      const places = (ms.length ? ms : [{ section: r.section, page: r.page }]).map(x => `${shortSection(x.section)}, p.${x.page}`);
      for (const p of places) if (!where.includes(p)) where.push(p);
    }
    bodyRows.push(row([
      cell(WIDTHS[0], [para(run(String(idx + 1), { b: true }), { jc: "center" })]),
      cell(WIDTHS[1], [
        para(run(main.citing_title, { b: true })),
        para(run(`${firstAuthor(main)} ${m.venue}.`, { i: true })),
        para(run(s ? s.topic : "")),
      ]),
      cell(WIDTHS[2], [
        ...(showPre(uid) ? [para(run(`${m.pre[0]} preprint (public): ${fmt(m.pre[1])}`, { b: true }))] : []),
        ...(showPre(uid) ? [para(run("Final article is after the petition date, but the preprint was public before it.", { i: true }))] : []),
        ...(showPre(uid) && m.preCites === false ? [para(run("The preprint does not itself cite my work; only the final article does.", { i: true }))] : []),
        ...datesList(uid).filter(([k]) => !/preprint/.test(k)).map(([k, v]) => para(run(`${k}: ${v}`))),
      ]),
      cell(WIDTHS[3], cited.map(c => para(run(c)))),
      cell(WIDTHS[4], [para(run(projects.length ? projects.map(p => `Project ${p}`).join(", ") : "—"))]),
      cell(WIDTHS[5], buildQuotes(db, uid, rows).flatMap(q => [para(run(`${String(q.sec || "").replace(/\s+/g, " ")}, p.${q.pg}`, { u: true }), { after: 20, keep: true }), para(run(`“${q.q}”`, { i: true }))])),
      cell(WIDTHS[6], [para(run(s ? s.use : ""))]),
      cell(WIDTHS[7], [para(run(s ? s.why : ""))]),
    ]));
  });
  if (problems.length) console.log("NOTES:\n  " + problems.join("\n  "));

  // ---- my publications that are cited, listed first
  const GLYGEN = "WS York, R Mazumder, R Ranzinger, N Edwards, R Kahsay, KF Aoki-Kinoshita, MP Campbell, RD Cummings, T Feizi, M Martin, DA Natale, NH Packer, RJ Woods, G Agarwal, S Arpinar, S Bhat, J Blake, LJG Castro, B Fochtman, J Gildersleeve, R Goldman, X Holmes, V Jain, S Kulkarni, R Mahadik, AY Mehta, R Mousavi, S Nakarakommula, R Navelkar, N Pattabiraman, MJ Pierce, K Ross, P Vasudev, J Vora, T Williamson, W Zhang";
  const formal = p => {
    const c = cat.prepare("SELECT authors, title, venue, year FROM publications WHERE cites_id=?").get(p.cites_id) || cat.prepare("SELECT authors, title, venue, year FROM publications WHERE title=?").get(p.title);
    if (!c) return p.title;
    const au = /^GlyGen:/i.test(c.title) ? GLYGEN : c.authors.replace(/,?\s*\.\.\.+\s*$/, ", et al");
    return `${au}. ${c.title}. ${c.venue}${/\b(19|20)\d\d\b/.test(c.venue) ? "" : ` (${c.year})`}.`;
  };
  const PW = [2300, 8300, 3800];
  const pubList = [...pubs.values()].sort((a, b) => b.nums.size - a.nums.size);
  const pubRows = pubList.map(p => row([
    cell(PW[0], [para(run(shortName(p), { b: true }))]),
    cell(PW[1], [para(run(formal(p)))]),
    cell(PW[2], [para(run(`${p.nums.size} citing article${p.nums.size > 1 ? "s" : ""}: No${p.nums.size > 1 ? "s" : ""}. ${[...p.nums].sort((a, b) => a - b).join(", ")}`))]),
  ]));
  const pubHead = row(["My publication", "Reference", "Cited by (numbers in the table below)"].map((h, i) => cell(PW[i], [para(run(h, { b: true, color: "FFFFFF" }))], { fill: "1F3864" })), { header: true });
  const pubTbl = `<w:tbl><w:tblPr><w:tblW w:w="${PW.reduce((a, b) => a + b, 0)}" w:type="dxa"/><w:tblLayout w:type="fixed"/>`
    + `<w:tblBorders>${["top", "left", "bottom", "right", "insideH", "insideV"].map(k => `<w:${k} w:val="single" w:sz="4" w:space="0" w:color="808080"/>`).join("")}</w:tblBorders>`
    + `<w:tblCellMar><w:top w:w="40" w:type="dxa"/><w:left w:w="70" w:type="dxa"/><w:bottom w:w="40" w:type="dxa"/><w:right w:w="70" w:type="dxa"/></w:tblCellMar></w:tblPr>`
    + `<w:tblGrid>${PW.map(w => `<w:gridCol w:w="${w}"/>`).join("")}</w:tblGrid>${pubHead}${pubRows.join("")}</w:tbl>`;
  const pubTitle = para(run("My publications cited in the table below", { b: true, sz: 24 }), { after: 60, keep: true });

  const head = row(HEAD.map((h, i) => cell(WIDTHS[i], [para(run(h, { b: true, color: "FFFFFF" }), { jc: i === 0 ? "center" : undefined })], { fill: "1F3864" })), { header: true });
  const tbl = `<w:tbl><w:tblPr><w:tblW w:w="${WIDTHS.reduce((a, b) => a + b, 0)}" w:type="dxa"/><w:tblLayout w:type="fixed"/>`
    + `<w:tblBorders>${["top", "left", "bottom", "right", "insideH", "insideV"].map(k => `<w:${k} w:val="single" w:sz="4" w:space="0" w:color="808080"/>`).join("")}</w:tblBorders>`
    + `<w:tblCellMar><w:top w:w="40" w:type="dxa"/><w:left w:w="70" w:type="dxa"/><w:bottom w:w="40" w:type="dxa"/><w:right w:w="70" w:type="dxa"/></w:tblCellMar></w:tblPr>`
    + `<w:tblGrid>${WIDTHS.map(w => `<w:gridCol w:w="${w}"/>`).join("")}</w:tblGrid>${head}${bodyRows.join("")}</w:tbl>`;

  const nBefore = order.filter(u => period(u) === "before").length;
  const title = para(run("Notable Citations — Summary Table", { b: true, sz: 32 }), { after: 80 });
  const sub = para(run(`${order.length} citing articles, ${rowsAll.length} citations of my work. ${nBefore} first became public before the petition date (April 25, 2024) and ${order.length - nBefore} after it. `
    + "An article counts as public from the earlier of its preprint (if one was posted) and its final journal publication; within each group the articles are in that order, oldest first. This table summarizes “Notable Citations - Completed.docx”, where the full description of each citation is given.", { sz: 20 }), { after: 120 });
  const notes = [
    para(run("Notes.", { b: true, sz: 18 }), { after: 40, keep: true }),
    para(run("Dates: every date found for each article is shown. Preprint dates are those of the first version posted. Articles are placed in the “before” group if a preprint or the final article was public before April 25, 2024, so an article whose final version appeared later is still shown as before the petition date when its preprint was public by then. ", { sz: 18 })
      + run("Sources: the first pages of each PDF, PubMed, Europe PMC (which indexes bioRxiv, medRxiv and Research Square), Crossref and OpenAlex, checked November 10, 2026. Where no preprint is listed, none was found in those sources.", { sz: 18 })),
    para(run("My works cited: GLAD = GLycan Array Dashboard, a tool for visualizing and analyzing glycan microarray data (2019); GlycoGlyph = an application for drawing and naming glycan structures (2020); MAWE = the microwave-assisted wet-erase method for reusing glycan microarrays (2024). A glycan is a chain of sugar molecules; a glycan microarray is a glass slide printed with many different glycans, used to test which of them a protein, antibody or virus binds.", { sz: 18 })),
    para(run("Evidence for No. 13 (Wang et al.): the GlyGen portal release notes (https://wiki.glygen.org/index.php/Portal_release_notes), Version 1.12, released April 28, 2022, state “Added GlycoGlyph tool support in structure and substructure search.” The structure search on GlyGen’s Glycan Search page has a “draw” function that opens GlycoGlyph. A print of that page (first page and the Version 1.12 page, each showing the URL, with the line highlighted in yellow) is filed beside the citing article as “13_Wang_2024_cit-000752_GlyGen-release-notes.pdf”.", { sz: 18 })),
    para(run("Projects: " + Object.entries(PROJECTS).map(([k, v]) => `${k} = ${v}`).join("; ") + ".", { sz: 18 })),
  ];
  const sect = `<w:sectPr><w:pgSz w:w="15840" w:h="12240" w:orient="landscape"/><w:pgMar w:top="720" w:right="720" w:bottom="720" w:left="720" w:header="360" w:footer="360" w:gutter="0"/></w:sectPr>`;
  const doc = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>${title}${sub}${pubTitle}${pubTbl}${para("", { after: 120 })}${tbl}${para("", { after: 60 })}${notes.join("")}${sect}</w:body></w:document>`;

  const zip = new JSZip();
  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>`);
  zip.file("_rels/.rels", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`);
  zip.file("word/document.xml", doc);
  fs.writeFileSync(OUT, await zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE" }));
  console.log(`wrote ${OUT} — ${order.length} articles`);
}
main().catch(e => { console.error(e); process.exit(1); });

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

// Facts the database does not hold (read from each PDF's first pages).
const META = {
  "cit-000544": { venue: "Journal of Experimental Biology 227(15): jeb247277", inst: "Universidad Nacional de La Plata and CONICET (INIBIOLP), La Plata, Argentina; Universidad Nacional Autónoma de México" },
  "cit-000621": { venue: "Journal of Biological Chemistry", inst: "University of California San Diego (Departments of Bioengineering and Pediatrics; Glycobiology Research and Training Center); Technical University of Denmark; Brigham Young University; Augusta University; Complex Carbohydrate Research Center" },
  "cit-000594": { venue: "Nucleic Acids Research 54(4): gkag080", inst: "The University of Manchester (Faculty of Biology, Medicine and Health); The Christie NHS Foundation Trust, Manchester; McGill University" },
  "cit-001253": { venue: "Nature Communications", inst: "Massachusetts Institute of Technology (Departments of Chemistry, Biology and Biological Engineering; Koch Institute); Broad Institute of MIT and Harvard; Massachusetts General Hospital and Harvard Medical School; University of California, Davis; University of Wisconsin-Madison" },
  "cit-000518": { venue: "Nature Communications 17: 4312", inst: "Leiden University Medical Center (Leiden University Center for Infectious Diseases; Center for Proteomics and Metabolomics); New England Biolabs; Centre de Recherches Médicales de Lambaréné, Gabon; Universitätsklinikum Tübingen and the German Center for Infection Research (DZIF)" },
  "cit-000521": { venue: "Journal of Biological Chemistry", inst: "Institut für Biochemie, Universität für Bodenkultur (BOKU), Vienna, Austria" },
  "cit-000629": { venue: "Journal of Virology (e01256-25)", inst: "Vanderbilt University Medical Center (corresponding author Ivelin S. Georgiev); the remaining collaborating institutions are listed in the article" },
  "cit-000619": { venue: "Protein Science", inst: "Ben-Gurion University of the Negev (Department of Life Sciences; Ilse Katz Institute for Nanoscale Science and Technology), Israel" },
  "cit-000542": { venue: "Research and Practice in Thrombosis and Haemostasis", inst: "University Medical Center of the Johannes Gutenberg University Mainz (Center for Thrombosis and Hemostasis; Research Center for Immunotherapy); ANZAC Research Institute, Concord Repatriation Hospital; University of Sydney" },
  "cit-000602": { venue: "Nature Communications 17: 9972", inst: "University of British Columbia (Departments of Biochemistry and Molecular Biology, and of Microbiology and Immunology)" },
  "cit-000516": { venue: "International Journal of Molecular Sciences 27(9): 3827", inst: "University of Maryland School of Medicine, Baltimore; University of Maryland, College Park; University of Maryland Baltimore County; Sun Yat-sen University; Northeastern University" },
  "cit-000613": { venue: "Scientific Reports", inst: "University of Potsdam; Yale University; Université de Lille and CNRS (UMR 8576 UGSF); German Federal Institute for Risk Assessment (BfR), a federal government agency; Technische Universität Berlin" },
  "cit-001257": { venue: "Scientific Reports", inst: "Fred Hutchinson Cancer Center, Seattle" },
  "cit-000416": { venue: "Glycobiology (cwag085)", inst: "Mahidol University; CNRS UMR 8576 UGSF (Université de Lille); Srinakharinwirot University; Gifu University (Institute for Glyco-core Research, iGCORE); Nagoya University (GlycoMIRAI, CNRS IRL 2045)" },
  "cit-000196": { venue: "Vaccine", inst: "Johns Hopkins University Bloomberg School of Public Health (W. Harry Feinstone Department of Molecular Microbiology and Immunology)" },
  "cit-000197": { venue: "Proceedings of the National Academy of Sciences 120(17): e2208718120", inst: "Emory University School of Medicine (corresponding author Anice C. Lowen); Emory-University of Georgia Center of Excellence for Influenza Research and Surveillance; the remaining collaborating institutions are listed in the article" },
  "cit-000510": { venue: "Scientific Reports 13: 10223", inst: "Johns Hopkins University Bloomberg School of Public Health (W. Harry Feinstone Department of Molecular Microbiology and Immunology); Johns Hopkins University School of Medicine (Department of Emergency Medicine)" },
  "cit-000532": { venue: "Frontiers in Immunology 14: 1102344", inst: "Leiden University Medical Center; New England Biolabs; National Institutes of Health, Bethesda (Laboratory of Parasitic Diseases), a US government institution; University Hospital Bonn and the German Center for Infection Research (DZIF); University of Buea, Cameroon" },
  "cit-001230": { venue: "Antiviral Research (2016 volume; available online 30 November 2015)", inst: "Kansas State University (College of Veterinary Medicine); Wichita State University (Department of Chemistry)" },
  "cit-000195": { venue: "Journal of Virology 97(10): e00906-23", inst: "University of Iowa (corresponding author Balaji Manicassamy); the remaining collaborating institutions are listed in the article" },
  "cit-000199": { venue: "Glycobiology 34(3): cwad098", inst: "University of Gothenburg and Sahlgrenska University Hospital; Uppsala University (Zoonosis Science Center); Max Planck Institute of Animal Behavior" },
};

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

// Third objectives sentence: how the citing article relates to my work generally.
const RELATION = {
  "cit-000544": "It relates to my work because the glycan-specificity comparison across related proteins is made with GLAD, the glycan array analysis tool that I developed.",
  "cit-000621": "It relates to my work because the glycan structures that present its profiling results are drawn with GlycoGlyph, the glycan drawing and naming application that I created.",
  "cit-000594": "It relates to my work because the glycan structures in its figures are drawn with GlycoGlyph, my glycan drawing and naming application.",
  "cit-001253": "It relates to my work through its glycan microarray experiments, where the authors cite my reusable glycan microarray method (MAWE).",
  "cit-000518": "It relates to my work because the glycan array results are visualised and mined with GLAD, my glycan array analysis tool.",
  "cit-000521": "It relates to my work because the heat maps that present its binding data are generated with GLAD, my glycan array analysis tool.",
  "cit-000629": "It relates to my work in two ways: its glycan array assay follows my MAWE protocol, and its glycan structure diagrams are drawn with my application GlycoGlyph.",
  "cit-000619": "It relates to my work because a glycan model used in the structural analysis was generated with GlycoGlyph, my glycan drawing application.",
  "cit-000542": "It relates to my work because the glycan array data are analysed and visualised with GLAD, my glycan array analysis tool.",
  "cit-000602": "It relates to my work because the glycan schematics in its figures were produced with GlycoGlyph, my glycan drawing application.",
  "cit-000516": "It relates to my work because its glycan microarray analysis follows my reusable-array procedure (MAWE), analyses the data with my tool GLAD and draws the glycan models with my application GlycoGlyph.",
  "cit-000613": "It relates to my work because the glycan structures in its figures are drawn with GlycoGlyph, my glycan drawing application.",
  "cit-001257": "It relates to my work because the authors analyse their glycan array data with my MAWE method.",
  "cit-000416": "It relates to my work because its glycan microarray data were processed with my MAWE workflow and analysed with my tool GLAD, and because its discussion cites my study of oligomannose recognition.",
  "cit-000196": "It relates to my work because the glycan array assay used to define each virus's receptor specificity is cited to my 2019 study of H3N2 receptor binding.",
  "cit-000197": "It relates to my work because the virus labelling and glycan array procedure used to measure receptor binding is cited to my 2019 study of H3N2 receptor binding.",
  "cit-000510": "It relates to my work because the glycan array data for the three clades were organised and compared with GLAD, my glycan array analysis tool.",
  "cit-000532": "It relates to my work because the glycan microarray data were visualised and mined with GLAD, my glycan array analysis tool.",
  "cit-001230": "It relates to my work because the thrombin component of its protease selectivity panel cites my 2011 paper on allosteric thrombin inhibitors.",
  "cit-000195": "It relates to my work because its experiments are motivated in part by my 2019 finding on the receptor specificity of circulating H3N2 viruses.",
  "cit-000199": "It relates to my work because it searches bird tissues for the phosphorylated glycan receptor candidates described in my 2019 study.",
};

// Text edits applied after the first-person conversion: [folder, find, replace]. Every find must match once.
const EDITS = [
  ["cit-000416", "and my personal name appears", "and my name appears"],
  ["cit-000518", "The named tool is my, cited", "The named tool is mine, cited"],
  ["cit-000542", "The article's use of my work is recorded twice, in two different registers.", "My work appears in this article twice, in two different forms."],
  ["cit-000542", "That second sentence is a courtesy and is not counted as a use of the tool; it is included because it shows the authors went to I for help with the tool by name.", "The authors thus consulted me directly about the tool, and credit the help they received from me by name."],
  ["cit-000542", " — an honest limitation stated in the paper's own words", ""],
  ["cit-000544", " This folder also holds the earlier version of the work, which matters because the date of the statement relative to my petition date is what the extra files were collected to establish.", ""],
  ["cit-000613", " The mentions sit in figure content rather than in the Materials and Methods text.", ""],
  ["cit-000621", "the argument my own tools were built to answer", "the need that my own tools were built to address"],
  ["cit-000629", "with the authors stating their deviations honestly,", "with the authors listing the modifications they made,"],
  ["cit-001257", " Where other citing articles name my work in a hedge or a figure legend, this one assigns the analysis of the array data to my method in a Methods sentence.", ""],
  ["cit-001257", ", which is a candid limit on what their screens can conclude", ""],
  ["cit-000195", "; they do not report using my methods", ""],
  ["cit-000199", "not of my.", "not of mine."],
  ["cit-001230", " The citation supports one assay in a panel and is shared with four other papers.", ""],
];
// Replaced wholesale (the stored paragraph is written as a drafting note).
const REWRITE = {
  "cit-001253": {
    how_used: "The Materials and Methods on p.15 describe how the microbial glycan arrays were probed and scanned and how replicate values were reduced. In the passage explaining why fluorescence intensities differ between experiments, the authors write that \"in 2024, the core facility also changed protocols and began regenerating and reusing slides\", and they cite my MAWE paper (reference 69, listed on p.19 as \"Mehta, A. Y. et al. Reusable glycan microarrays using a microwave assisted wet-erase (MAWE) process. Glycobiology 34, cwad091 (2024)\") at the end of that sentence. Regenerating and reusing slides is the practice my paper describes, so the authors point their readers to my work as the published method for it. The reference sits in the Methods description of the array experiments, which is where the other methods behind the study's microbial binding data are given.",
  },
};

// ---------- first-person conversion ----------
function fp(t) {
  return t
    .replace(/the applicant[’']s own/g, "my own")
    .replace(/\bThe applicant[’']s\b/g, "My").replace(/\bthe applicant[’']s\b/g, "my")
    .replace(/\bthe applicant\b/g, "I").replace(/\bThe applicant\b/g, "I");
}
function applyEdits(uid, text) {
  let t = text;
  for (const [f, a, b] of EDITS) {
    if (f !== uid) continue;
    if (!t.includes(a)) continue;      // the edit belongs to another field of the same folder
    t = t.replace(a, b);
  }
  return t;
}
function unmatchedEdits(narr) {
  const bad = [];
  for (const [f, a] of EDITS) {
    const n = narr[f];
    if (!n) { bad.push([f, a]); continue; }
    if (!["objectives", "importance", "how_used", "findings"].some(k => n[k] && fp(n[k]).includes(a))) bad.push([f, a]);
  }
  return bad;
}

// ---------- xml ----------
const esc = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const RPR = '<w:rPr><w:rFonts w:eastAsia="Times New Roman" w:cs="Times New Roman" w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr>';
const RPR_I = '<w:rPr><w:rFonts w:eastAsia="Times New Roman" w:cs="Times New Roman" w:ascii="Times New Roman" w:hAnsi="Times New Roman"/><w:i/><w:iCs/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr>';
function answer(text) {
  return '<w:p><w:pPr><w:pStyle w:val="Normal"/><w:widowControl w:val="false"/><w:spacing w:lineRule="auto" w:line="240" w:before="0" w:after="160"/><w:jc w:val="both"/><w:rPr><w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:eastAsia="Times New Roman" w:cs="Times New Roman"/><w:sz w:val="24"/><w:szCs w:val="24"/></w:rPr></w:pPr>'
    + `<w:r>${RPR}<w:t xml:space="preserve">${esc(text)}</w:t></w:r></w:p>`;
}
function answerRuns(parts) { // [{t, i}]
  return '<w:p><w:pPr><w:pStyle w:val="Normal"/><w:widowControl w:val="false"/><w:spacing w:lineRule="auto" w:line="240" w:before="0" w:after="160"/><w:jc w:val="both"/></w:pPr>'
    + parts.map(p => `<w:r>${p.i ? RPR_I : RPR}<w:t xml:space="preserve">${esc(p.t)}</w:t></w:r>`).join("") + "</w:p>";
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
  return `${authorsOf(r)}. ${r.citing_title}. ${venue} (${r.citing_year}).${url}`;
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
  const narr = {};
  for (const n of db.prepare("SELECT * FROM narrative").all()) narr[n.folder_uid] = n;
  const bad = unmatchedEdits(narr);
  if (bad.length) { console.error("edits that match nothing:", bad); process.exit(1); }

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

  folders.forEach((f, idx) => {
    const main = f.rows.find(r => r.is_main) || f.rows[0];
    const n = narr[f.uid];
    if (!n) problems.push(`${f.uid}: no narrative`);
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
      const authors = p ? p.authors.replace(/,?\s*\.\.\.+\s*$/, ", et al") : "";
      const formal = p ? `${authors}. ${p.title}. ${p.venue}${/\b(19|20)\d\d\b/.test(p.venue) ? "" : ` (${p.year})`}.` : c.title;
      return answer(formal.replace(/\s+,/g, ","));
    }));
    label(5, [answer(citingFormal(main))]);
    label(7, [answer(projects.length ? projects.map(p => `Project ${p}: ${PROJECTS[p]}`).join("; ") : "Project not yet assigned")]);
    label(9, [answer(meta ? meta.inst : "")]);
    label(11, [answer("Original research article")]);
    out.push(T(13), T(14));

    label(15, quotes.map(q => answerRuns([{ t: `“${q.q}”`, i: true }, { t: ` (${String(q.sec || "").replace(/\s+/g, " ")}, p.${q.pg})` }])));

    const sect2 = k => {
      let t = n ? n[k] : "";
      const rw = REWRITE[f.uid] && REWRITE[f.uid][k];
      t = rw ? rw : applyEdits(f.uid, fp(t));
      return t;
    };
    let obj = sect2("objectives");
    if (RELATION[f.uid]) obj += " " + RELATION[f.uid]; else problems.push(`${f.uid}: no relation sentence`);
    label(17, [answer(obj)]);
    label(19, [answer(sect2("importance"))]);
    label(21, [answer(sect2("how_used"))]);
    label(23, [answer(sect2("findings"))]);
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
  for (const w of ["applicant", "preparer", "folder", "petition", "counsel", "packet"]) {
    const m = text.match(new RegExp(".{40}\\b" + w + "\\b.{40}", "gi"));
    if (m) console.log(`LEFTOVER '${w}':`, m.slice(0, 5));
  }
}
main().catch(e => { console.error(e); process.exit(1); });

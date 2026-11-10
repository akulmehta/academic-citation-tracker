#!/usr/bin/env node
"use strict";
/**
 * Make highlighted COPIES of the PDFs of the citations in packet.html.
 *
 * For every included citation (one PDF per citing article) the original PDF under papers/ is copied to
 * `Citations/highlighted PDFs/NN_<firstauthor>_<year>_<cit-uid>.pdf` (NN = the order of the Word document,
 * oldest article first) and the copy gets real yellow Highlight annotations on
 *   1. every sentence in the body that cites my work, whole sentence including the reference number, and
 *   2. my paper's entry in the reference list.
 * Nothing else is highlighted. The originals are never opened for writing.
 *
 * Where each place comes from: the profile-first resolver (catalog-citations.js, run for every database row
 * of the folder, one per cited paper of mine) plus the sentences already filed in the database (row quote and
 * mention table). A place is highlighted once even if several sources name it.
 *
 *   node scripts/highlight-pdfs.js [--rows=cit-000516,...] [--out="dir"]
 *
 * Writes a log of every highlight to archived-logs/highlights.json so each can be checked by eye.
 */
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
const { PDFDocument, PDFString, PDFName } = require("pdf-lib");
const L = require("./lib");
const { catalogRow } = require("./catalog-citations");
const { orderedFolders } = require("./packet-order");

const argv = process.argv.slice(2);
const opt = n => { const a = argv.find(s => s.startsWith(`--${n}=`)); return a ? a.split("=").slice(1).join("=") : null; };
const OUTDIR = opt("out") || path.join(L.REPO, "Citations", "highlighted PDFs");
const LOG = path.join(L.REPO, "archived-logs", "highlights.json");
const ONLY = opt("rows") ? new Set(opt("rows").split(",")) : null;

let pdfjs, DIRS;
async function loadPdfjs() {
  if (!pdfjs) {
    const build = path.join(L.PKT, "node_modules", "pdfjs-dist");
    pdfjs = await import(pathToFileURL(path.join(build, "legacy", "build", "pdf.mjs")).href);
    DIRS = {
      standardFontDataUrl: pathToFileURL(path.join(build, "standard_fonts") + path.sep).href,
      cMapUrl: pathToFileURL(path.join(build, "cmaps") + path.sep).href,
    };
  }
  return pdfjs;
}

/** One page as a single string with, for every character, the text item and offset it came from. */
async function pageModel(doc, p) {
  const page = await doc.getPage(p);
  const tc = await page.getTextContent();
  const items = [];
  for (const it of tc.items) {
    if (typeof it.str !== "string") continue;
    const h = Math.abs(it.transform[3]) || it.height || 10;
    items.push({ str: it.str, x: it.transform[4], y: it.transform[5], w: it.width, h, eol: !!it.hasEOL, font: it.fontName });
  }
  let S = "";
  const map = [];   // raw index -> {i, c} ; c = -1 for a synthetic space
  items.forEach((it, i) => {
    for (let c = 0; c < it.str.length; c++) { S += it.str[c]; map.push({ i, c }); }
    const nxt = items[i + 1];
    if (!nxt) return;
    const sameLine = Math.abs(nxt.y - it.y) < it.h * 0.5;
    const gap = nxt.x - (it.x + it.w);
    const needSpace = it.eol || !sameLine || gap > it.h * 0.12;
    const hyphen = /[-‐]$/.test(it.str) && !sameLine;
    if (needSpace && !hyphen && !/\s$/.test(it.str) && !/^\s/.test(nxt.str)) { S += " "; map.push({ i, c: -1 }); }
  });
  return { items, S, map };
}

const keep = ch => /[\p{L}\p{N}]/u.test(ch);
function normalize(S) {
  let n = ""; const back = [];
  for (let i = 0; i < S.length; i++) if (keep(S[i])) { n += S[i].toLowerCase(); back.push(i); }
  return { n, back };
}

/** raw index range of a quote on a page, or null */
function locate(model, quote) {
  const q = normalize(quote).n;
  if (q.length < 12) return null;
  const N = model.norm || (model.norm = normalize(model.S));
  // The quote is the sentence that holds the marker, sometimes with the sentence before it. The marker sits at
  // the end, so the END of the quote is the anchor: only the sentence that contains it is highlighted.
  // The very last characters are often the reference number itself (a superscript that the page text stream
  // may place elsewhere), so also try windows that stop a little short of the end.
  const tries = [];
  for (const off of [0, 4, 8, 14, 20, 28, 40]) {
    const end = q.length - off;
    if (end < 20) break;
    tries.push(q.slice(Math.max(0, end - 28), end));   // short, so the window stays inside the sentence that holds the marker
  }
  for (const t of tries) {
    const at = N.n.indexOf(t);
    if (at >= 0) return [N.back[at], N.back[at + t.length - 1]];
  }
  return null;
}

const ABBR = new Set(["al", "fig", "figs", "eq", "eqs", "ref", "refs", "vs", "cf", "ca", "no", "nos", "dr", "approx", "sp", "spp", "st", "inc", "ltd", "co", "vol", "pp", "ed", "eds", "prof", "e.g", "i.e", "etc", "resp", "suppl", "ext", "tab"]);
function boundaryAt(S, j) {   // S[j] is . ? ! ; does a sentence end here?
  // a link's "(accessed on 15 November 2025)" closes a sentence that has no full stop of its own
  if (S[j] === ")") { if (!/accessed on \d{1,2} \p{L}+ \d{4}\)$/u.test(S.slice(Math.max(0, j - 40), j + 1))) return false; }
  else if (!".?!".includes(S[j])) return false;
  const next = S[j + 1];
  if (next !== undefined && !/[\s\d\[\]),;–\-"”’')]/.test(next)) return false;     // "3.5", "e.g.x"
  let k = j; while (k > 0 && /[A-Za-z.]/.test(S[k - 1])) k--;
  const word = S.slice(k, j).toLowerCase();
  if (S[j] === "." && (ABBR.has(word) || (word.length === 1 && /[A-Z]/.test(S[k])))) return false;   // initials
  if (S[j] === "." && /^[A-Z]$/.test(S.slice(k, j))) return false;
  // what follows must look like the start of a sentence (after any attached reference numbers)
  let m = attachedEnd(S, j) + 1;
  while (m < S.length && S[m] === " ") m++;
  if (m >= S.length) return true;
  return /[A-Z“"(\[]/.test(S[m]) || /\d/.test(S[m]);
}
function attachedEnd(S, j) {      // include reference numbers glued to the full stop: "…activities.12,13"
  let m = j + 1;
  while (m < S.length && /[\d,\[\]–\-]/.test(S[m])) m++;
  return m - 1 >= j ? m - 1 : j;
}
function sentenceRange(S, a, b) {
  let s = a;
  for (let j = a - 1; j >= 0 && a - j < 1400; j--) {
    if (boundaryAt(S, j)) { let m = attachedEnd(S, j) + 1; while (m < a && S[m] === " ") m++; s = Math.min(m, a); break; }
    s = j;
  }
  if (s > 0 && a - s >= 1400) s = a;
  let e = b;
  for (let j = b; j < S.length && j - b < 1400; j++) {
    if (boundaryAt(S, j)) { e = attachedEnd(S, j); break; }
    e = j;
  }
  return [s, Math.min(e, S.length - 1)];
}

/** the reference-list entry that starts at raw index `a` */
function entryRange(S, a) {
  let s = a;
  const before = S.slice(Math.max(0, a - 9), a);
  const m = /(\[?\d{1,3}[\].]?\s*)$/.exec(before);
  if (m) s = a - m[1].length;
  const rest = S.slice(a);
  const re = /[.\]\d)]\s+(?:\[?\d{1,3}[\].]?\s+[A-Z]|[A-Z][\p{L}'’\-]+,\s+(?:[A-Z]\.\s?){1,3}|[A-Z][\p{L}'’\-]+\s+[A-Z]{1,3}[,\s])/u;
  let e = Math.min(S.length - 1, a + 700);
  const mm = re.exec(rest.slice(70));
  if (mm) e = a + 70 + mm.index;                   // last char of this entry (before the whitespace that precedes the next)
  return [s, e];
}

const lineOf = (model, i) => {     // items sharing the baseline of item i
  const y = model.items[i].y, h = model.items[i].h;
  let s = i, e = i;
  while (s > 0 && Math.abs(model.items[s - 1].y - y) < h * 0.5) s--;
  while (e + 1 < model.items.length && Math.abs(model.items[e + 1].y - y) < h * 0.5) e++;
  return [s, e];
};
const wordCount = t => (t.trim().match(/\S+/g) || []).length;
const firstRaw = (model, item) => {      // raw index of the first character at or after this item (empty items have none)
  for (let it = item; it < model.items.length; it++) { const k = model.map.findIndex(m => m.i === it && m.c >= 0); if (k >= 0) return k; }
  return Infinity;
};
/**
 * A section heading that runs into the sentence ("Glycan array analysis Glycan Array Dashboard … was used …")
 * is not part of the sentence. A heading is a short line, without closing punctuation, in another font than
 * the line that follows it. Trim one from the start; trim a heading that follows the sentence from the end.
 */
function trimHeadings(model, a, b, anchorB) {
  const items = model.items;
  for (let guard = 0; guard < 3; guard++) {
    const i = model.map[a] && model.map[a].i;
    if (i == null) break;
    // the run of items in the heading's font, on its line
    let j = i;
    while (j + 1 < items.length && j - i < 40 && items[j + 1].font === items[i].font) j++;   // a heading may wrap over lines
    if (j + 1 >= items.length) break;
    const txt = items.slice(i, j + 1).map(x => x.str).join(" ");
    const [lsH] = lineOf(model, i);
    const headStartsLine = items.slice(lsH, i).every(x => !x.str.trim());
    const headEndsLine = Math.abs(items[j + 1].y - items[j].y) >= items[j].h * 0.5;   // a heading is a whole line, not a few words before an italic term
    if (headStartsLine && headEndsLine && wordCount(txt) <= 14 && txt.trim().length >= 6 && !/[.;:,)\]]\s*$/.test(txt) && items[j + 1].font !== items[i].font && firstRaw(model, j + 1) <= anchorB) { a = firstRaw(model, j + 1); continue; }
    // a numbered heading ("4.9.5. Glycan Microarray Analysis", "2.6 | Glycan array analysis") in the body font
    const [ls2, le] = lineOf(model, i);
    const lineTxt = items.slice(i, le + 1).map(x => x.str).join(" ");
    const startsLine = items.slice(ls2, i).every(x => !x.str.trim());
    if (startsLine && le + 1 < items.length && wordCount(lineTxt) <= 10 && !/[.;:,)\]]\s*$/.test(lineTxt) && firstRaw(model, le + 1) <= anchorB) {
      const pre = model.S.slice(Math.max(0, a - 12), a);
      if (/\d+(\.\d+)*[.|]?\s*\|?\s*$/.test(pre) || /^\d+(\.\d+)+/.test(lineTxt)) { a = firstRaw(model, le + 1); continue; }
    }
    break;
  }
  // a (last accessed …) note belongs to the link before it, not to this sentence
  const acc = /^\((?:last )?accessed[^)]*\)\s*/i.exec(model.S.slice(a, b + 1));
  if (acc) a += acc[0].length;
  // A heading can only start a line after the sentence's own text: scan the whole range, not just past the anchor.
  const iEnd = model.map[a] && model.map[a].i;
  if (iEnd != null) {
    for (let k = iEnd + 1; k < items.length; k++) {
      if (firstRaw(model, k) > b) break;
      const prev = items[k - 1];
      if (Math.abs(items[k].y - prev.y) < items[k].h * 0.5) continue;           // not the start of a line
      let j = k;
      while (j + 1 < items.length && items[j + 1].font === items[k].font && Math.abs(items[j + 1].y - items[k].y) < items[k].h * 0.5) j++;
      const txt = items.slice(k, j + 1).map(x => x.str).join(" ");
      if (wordCount(txt) <= 5 && !/[.;:,)\]]\s*$/.test(txt) && items[k].font !== prev.font && items[j + 1] && items[j + 1].font !== items[k].font && /[.)\]\d\/]\s*$/.test(prev.str.trim() || "x")) {
        const cut = firstRaw(model, k);
        if (cut > a) { b = cut - 1; while (b > a && /\s/.test(model.S[b])) b--; }
        break;
      }
    }
  }
  return [a, b];
}

/**
 * My paper's entry in the reference list, found by its title: from the first author's surname (and the number
 * or bracket in front of it) to the end of the page range / DOI / link tokens that close the entry.
 */
/** Extend a sentence range [a,b] over the citation number that follows its full stop ("efficacy. 13 To evaluate"): superscript digits, "[53]", "(13)", "13,14", "13-15". */
function withMarker(model, a, b) {
  const S = model.S;
  const rest = S.slice(b + 1, b + 40);
  const m = /^\s*(?:\(\s*\d{1,3}(?:\s*[,–-]\s*\d{1,3})*\s*\)|\[\s*\d{1,3}(?:\s*[,–-]\s*\d{1,3})*\s*\]|\d{1,3}(?:\s*[,–-]\s*\d{1,3})*)(?=\s+[A-Z“"(]|\s*$|\s*[.;])/.exec(rest);
  if (!m) return [a, b];
  let e = b + m[0].length;
  while (e > b && /\s/.test(S[e])) e--;
  // the number must sit right after the last word on the same line (a superscript), not be a margin line number
  let f = b + 1; while (f <= e && /\s/.test(S[f])) f++;
  const mk = model.map[f], lk = model.map[b];
  if (!mk || !lk || mk.c < 0 || lk.c < 0) return [a, b];
  const mi = model.items[mk.i], li = model.items[lk.i];
  const gap = mi.x - (li.x + li.w);
  if (mi !== li && !(Math.abs(mi.y - li.y) < li.h * 0.9 && gap > -li.h * 0.3 && gap < li.h * 1.6)) return [a, b];
  return [a, e];
}
/** Extend a reference-entry start backwards over its list label: "[53] ", "(13) ", "51. ", or a bare "19 ". */
function withLabel(S, a) {
  if (/^(\[\s*\d|\(\s*\d|\d{1,3}\.\s)/.test(S.slice(a, a + 8))) return a;   // the entry already starts at its label
  const before = S.slice(Math.max(0, a - 12), a);
  const m = /(\[\s*\d{1,3}\s*\]\s*|\(\s*\d{1,3}\s*\)\s*|\b\d{1,3}\.\s+)$/.exec(before);
  if (m) return a - m[1].length;
  const m2 = /(?<=[.\d])\s\d{1,3}\s+$/.exec(before);
  return m2 ? a - (m2[0].length - 1) : a;
}
function refByTitle(model, title, surname, from) {
  const hit = locate(model, title.slice(0, 70));
  if (!hit) return null;
  const S = model.S;
  const lo = Math.max(0, hit[0] - 1300);   // a 35-author entry (GlyGen) puts the first author far before the title
  const seg = S.slice(lo, hit[0]);
  const re = new RegExp(surname.replace(/[-]/g, "[-‐ ]"), "gi");
  let m, pos = -1;
  while ((m = re.exec(seg))) pos = m.index;
  if (pos < 0) return null;
  let a = lo + pos;
  const ini = /((?:\b[A-Z]\.\s?){1,3})$/.exec(S.slice(Math.max(0, a - 10), a));   // initials printed before the surname ("L. Byrd-Leotis")
  if (ini && /\b\d{1,3}\.\s+$|\[\d{1,3}\]\s*$/.test(S.slice(Math.max(0, a - 10 - 8), a - ini[1].length))) a -= ini[1].length;
  const pre = /(\[\d{1,3}\]\s*|\b\d{1,3}\.\s+)$/.exec(S.slice(Math.max(0, a - 9), a));   // "[44] " or "37. ", not a bare page number
  if (pre) a -= pre[1].length;
  // end: after the title, the first page range / article id, then the closing tokens
  const after = S.slice(hit[1] + 1, hit[1] + 1 + 320);
  const close = /(\d{1,6}\s*[–‐−-]\s*\d{1,6}|\d{1,6}e\d{1,6}\b|\b[a-z]{1,6}\d{3,6}\b[-\w]*|\b(?:19|20)\d\d,\s*\d+,\s*\d{3,6}(?:\s*[–‐−-]\s*\d{1,6})?|\b\d{4};\d+[:\d–-]*|\d+\(\d+\):\d+[–-]?\d*)/.exec(after);
  const doi = /https?:\/\/\s*d\s*oi\.?\s*org\/\S+|d\s*oi:\s*\S+/i.exec(after);
  let end = null;
  if (close) end = hit[1] + 1 + close.index + close[0].length;
  if (doi && (!close || doi.index <= close.index + close[0].length + 12)) {
    let e2 = hit[1] + 1 + doi.index + doi[0].length;
    if (/[./]$/.test(S.slice(e2 - 1, e2))) { const t2 = /^\s*\S+/.exec(S.slice(e2)); if (t2) e2 += t2[0].length; }   // a DOI broken across lines
    end = Math.max(end || 0, e2);
  }
  if (process.env.DBG) console.log("DBGREF", JSON.stringify(after.slice(0, 150)), close && close[0], doi && doi[0]);
  if (end == null) return null;
  for (let guard = 0; guard < 6; guard++) {
    const t = /^[\s.,;]*(\(\d{4}\)\.?|https?:\/\/\S+|d\s*oi\S*|\[(?:CrossRef|PubMed|PubMed Central)\])/i.exec(S.slice(end, end + 80));
    if (!t) break;
    end += t[0].length;
  }
  while (end > a && /[\s]/.test(S[end - 1])) end--;
  return [a, end - 1];
}

function rectsFor(model, a, b) {
  const per = new Map();
  for (let k = a; k <= b && k < model.map.length; k++) {
    const m = model.map[k];
    if (m.c < 0) continue;
    const r = per.get(m.i) || { c0: m.c, c1: m.c };
    r.c0 = Math.min(r.c0, m.c); r.c1 = Math.max(r.c1, m.c);
    per.set(m.i, r);
  }
  const rs = [];
  for (const [i, r] of [...per].sort((x, y) => x[0] - y[0])) {
    const it = model.items[i];
    if (!it.str.trim()) continue;
    // position inside the text item: weight characters by typical width (i, l, t, spaces are narrow; m, w, capitals wide)
    const cw = ch => /[iljtfI.,;:'!|()\[\] ]/.test(ch) ? 0.5 : /[mwMW]/.test(ch) ? 1.45 : /[A-Z0-9]/.test(ch) ? 1.1 : 1;
    const wts = [...it.str].map(cw);
    const tot = wts.reduce((s, v) => s + v, 0) || 1;
    const before = n => wts.slice(0, n).reduce((s, v) => s + v, 0) / tot;
    const x0 = it.x + it.w * before(r.c0), x1 = it.x + it.w * before(r.c1 + 1);
    rs.push({ x0, x1, y0: it.y - it.h * 0.22, y1: it.y + it.h * 0.86, base: it.y, h: it.h });
  }
  // join neighbours on one line
  const out = [];
  for (const r of rs) {
    const last = out[out.length - 1];
    if (last && Math.abs(last.base - r.base) < r.h * 0.4 && r.x0 - last.x1 < r.h * 1.2 && r.x0 >= last.x0 - 2) {
      last.x1 = Math.max(last.x1, r.x1); last.y0 = Math.min(last.y0, r.y0); last.y1 = Math.max(last.y1, r.y1);
    } else out.push({ ...r });
  }
  return out;
}

function addHighlight(pdf, pageNo, rects, note, color) {
  if (!rects.length) return false;
  const ctx = pdf.context;
  const page = pdf.getPage(pageNo - 1);
  const quad = [], rect = [Infinity, Infinity, -Infinity, -Infinity];
  const col = color || [1, 0.93, 0];
  let ap = `/GS0 gs ${col.join(" ")} rg\n`;
  for (const r of rects) {
    quad.push(r.x0, r.y1, r.x1, r.y1, r.x0, r.y0, r.x1, r.y0);
    rect[0] = Math.min(rect[0], r.x0); rect[1] = Math.min(rect[1], r.y0);
    rect[2] = Math.max(rect[2], r.x1); rect[3] = Math.max(rect[3], r.y1);
    ap += `${r.x0.toFixed(2)} ${r.y0.toFixed(2)} ${(r.x1 - r.x0).toFixed(2)} ${(r.y1 - r.y0).toFixed(2)} re f\n`;
  }
  const form = ctx.stream(ap, {
    Type: "XObject", Subtype: "Form", BBox: rect,
    Resources: { ExtGState: { GS0: { Type: "ExtGState", BM: "Multiply" } } },
  });
  const annot = ctx.obj({
    Type: "Annot", Subtype: "Highlight", Rect: rect, QuadPoints: quad, C: col, CA: 1, F: 4,
    Contents: PDFString.of(note || ""), T: PDFString.of("citation"),
    AP: { N: ctx.register(form) },
  });
  page.node.addAnnot(ctx.register(annot));
  return true;
}

function myPub(cat, r) {
  return cat.prepare("SELECT authors, title FROM publications WHERE cites_id=?").get(r.cites_id) || cat.prepare("SELECT authors, title FROM publications WHERE title=?").get(r.cited_paper) || null;
}

async function main() {
  const db = L.openPacket(), cat = L.openCatalog();
  const rows = db.prepare("SELECT * FROM citation WHERE status='included' ORDER BY n, is_main DESC, row_uid").all();
  const byFolder = new Map();
  for (const r of rows) { if (!byFolder.has(r.folder_uid)) byFolder.set(r.folder_uid, []); byFolder.get(r.folder_uid).push(r); }
  const order = orderedFolders([...byFolder.keys()]);
  fs.mkdirSync(OUTDIR, { recursive: true });
  const lib = await loadPdfjs();
  const log = [];

  for (let idx = 0; idx < order.length; idx++) {
    const uid = order[idx];
    if (ONLY && !ONLY.has(uid)) continue;
    const frows = byFolder.get(uid);
    const main = frows.find(r => r.is_main) || frows[0];
    const srcRel = main.pdf_file;
    const src = path.join(L.PKT, srcRel);
    const first = (main.citing_authors || "").split(/[,;]/)[0].trim();
    const inv = /^([\p{L}'’-]+)\s+[A-Z][A-Z-]{0,3}$/u.exec(first);          // "Powell H", "Liang C-Y": surname + initials
    const surname = L.surnameSlug((inv ? inv[1] : first.split(/\s+/).pop()).replace(/[^\p{L}-]/gu, ""));
    const name = `${String(idx + 1).padStart(2, "0")}_${surname}_${main.citing_year}_${uid}.pdf`;
    const dest = path.join(OUTDIR, name);

    const NO_RESOLVER = new Set(["cit-000749", "cit-000752", "cit-000044", "cit-000423"]);
    // where my work is cited: resolver for each cited paper of this folder, then the filed sentences
    const places = [];    // {page, quote, kind, why}
    const refs = [];      // {page, entry, why}
    for (const r of frows) {
      try {
        // The GlyGen rows are not in the catalogue's tool/marker model (the paper is cited by number, not by a tool
        // name), so its resolver guesses wrong sentences; their locations are the filed, human-read quotes only.
        if (NO_RESOLVER.has(uid)) { refs.push({ hint: null, pub: myPub(cat, r), why: r.cited_paper.slice(0, 40) }); throw null; }
        const c = await catalogRow(db, cat, { row_uid: r.row_uid, cites_id: r.cites_id, cited_paper: r.cited_paper, citing_title: r.citing_title, pdf_file: srcRel });
        for (const m of c.mentions) places.push({ page: m.page, quote: m.quote, kind: "text", marker: m.marker, why: `resolver ${m.marker} (${r.cited_paper.slice(0, 30)})` });
        refs.push({ hint: c.entryPage, pub: myPub(cat, r), why: r.cited_paper.slice(0, 40) });
      } catch (e) { if (e === null) { /* resolver skipped on purpose */ } else places.push({ error: `resolver failed for ${r.row_uid}: ${String(e.message).slice(0, 80)}` }); }
      if (r.quote && r.page) places.push({ page: Number(String(r.page).match(/\d+/)), quote: r.quote, kind: "text", why: `filed quote ${r.row_uid}` });
      for (const m of db.prepare("SELECT page, quote FROM mention WHERE row_uid=?").all(r.row_uid))
        if (m.quote && m.page) places.push({ page: Number(String(m.page).match(/\d+/)), quote: m.quote, kind: "text", why: `filed mention ${r.row_uid}` });
    }
    for (const x of EXTRA[uid] || []) places.push({ ...x, kind: x.ref ? "reference" : "text", why: "added by hand (acknowledgment, figure legend or reference entry)" });

    const data = fs.readFileSync(src);
    const doc = await lib.getDocument({ data: new Uint8Array(data), ...DIRS, useWorkerFetch: false, isEvalSupported: false, disableFontFace: true }).promise;
    const pdf = await PDFDocument.load(data, { ignoreEncryption: true });
    const models = new Map();
    const model = async p => { if (!models.has(p)) models.set(p, await pageModel(doc, p)); return models.get(p); };
    const done = [];     // {page, a, b}
    const entry = { uid, file: name, source: srcRel, highlights: [], notes: [] };

    const overlaps = (p, a, b) => done.some(d => d.page === p && a <= d.b && b >= d.a);
    for (const pl of places) {
      if (pl.error) { entry.notes.push(pl.error); continue; }
      if (!pl.page || pl.page < 1 || pl.page > doc.numPages) { entry.notes.push(`bad page for ${pl.why}`); continue; }
      const mdl = await model(pl.page);
      const hit = locate(mdl, pl.quote);
      if (!hit) { entry.notes.push(`not found on p.${pl.page}: ${pl.quote.slice(0, 70)} [${pl.why}]`); continue; }
      let [a, b] = sentenceRange(mdl.S, hit[0], hit[1]);
      [a, b] = trimHeadings(mdl, a, b, hit[1]);
      if (!pl.ref) [a, b] = withMarker(mdl, a, b);
      if (pl.ref) { const h0 = locate(mdl, pl.quote.slice(0, 40)), h1 = locate(mdl, pl.quote.slice(-40)); if (h0 && h1) { a = withLabel(mdl.S, h0[0]); b = h1[1]; } }
      if (pl.marker) {
        // The resolver's quote can be the sentence BEFORE the one that carries the marker. Highlight the sentence
        // that actually holds the marker: look at the next two sentences when this one does not.
        const flat = s => s.replace(/[\[\]()\s]/g, "");
        const has = (x, y) => flat(mdl.S.slice(x, y + 1)).includes(flat(pl.marker));
        if (!has(a, b)) {
          let cur = b;
          for (let t = 0; t < 2; t++) {
            let pos = cur + 1;
            while (pos < mdl.S.length && /[\s\d,\[\]–-]/.test(mdl.S[pos]) && pos < cur + 12 && !/[A-Z]/.test(mdl.S[pos])) pos++;
            if (pos >= mdl.S.length) break;
            let [a2, b2] = sentenceRange(mdl.S, pos, pos);
            [a2, b2] = trimHeadings(mdl, a2, b2, b2);
            if (has(a2, b2)) { a = a2; b = b2; break; }
            cur = b2;
          }
        }
      }
      if (process.env.DBG) console.log("DBG", pl.why, "p." + pl.page, "anchor", hit, "range", a, b, JSON.stringify(mdl.S.slice(hit[0], hit[1] + 1)), "->", JSON.stringify(mdl.S.slice(a, a + 40)), "...", JSON.stringify(mdl.S.slice(b - 30, b + 1)));
      if (overlaps(pl.page, a, b)) continue;
      done.push({ page: pl.page, a, b });
      const rects = rectsFor(mdl, a, b);
      addHighlight(pdf, pl.page, rects, pl.ref ? "My paper in the reference list" : "Cites my work");
      entry.highlights.push({ page: pl.page, kind: pl.ref ? "reference" : "text", why: pl.why, quote: pl.quote.slice(0, 120), text: mdl.S.slice(a, b + 1).replace(/\s+/g, " ") });
    }
    const seenRef = new Set();
    for (const rf of refs) {
      if (!rf.pub) { entry.notes.push(`no publication record for ${rf.why}`); continue; }
      const surname = rf.pub.authors.split(",")[0].trim().split(/\s+/).pop();
      const pages = [];
      if (rf.hint) pages.push(rf.hint);
      for (let p = doc.numPages; p >= 1; p--) if (p !== rf.hint) pages.push(p);
      let found = null;
      for (const p of pages) {
        const mdl = await model(p);
        const r2 = refByTitle(mdl, rf.pub.title, surname);
        if (r2) { found = { p, mdl, r: r2 }; break; }
      }
      if (!found) { entry.notes.push(`no reference-list entry found for "${rf.pub.title.slice(0, 50)}"`); continue; }
      const a = withLabel(found.mdl.S, found.r[0]), b = found.r[1];
      const key = found.p + ":" + a;
      if (seenRef.has(key) || overlaps(found.p, a, b)) continue;
      seenRef.add(key); done.push({ page: found.p, a, b });
      addHighlight(pdf, found.p, rectsFor(found.mdl, a, b), "My paper in the reference list");
      entry.highlights.push({ page: found.p, kind: "reference", text: found.mdl.S.slice(a, b + 1).replace(/\s+/g, " ") });
    }
    // Some downloaded articles already carry highlights. Where one sits on the same spot as mine it would double the
    // yellow (and show orange), so drop the original there; any other pre-existing highlight stays and is reported.
    for (let pi = 0; pi < pdf.getPageCount(); pi++) {
      const annots = pdf.getPage(pi).node.Annots();
      if (!annots) continue;
      const hl = [];
      for (let k = 0; k < annots.size(); k++) {
        const o = pdf.context.lookup(annots.get(k));
        const st = o && o.get && o.get(PDFName.of("Subtype"));
        if (!st || String(st) !== "/Highlight") continue;
        const rc = o.get(PDFName.of("Rect")).asArray().map(n => n.asNumber());
        hl.push({ k, rc, mine: o.has(PDFName.of("Contents")) });
      }
      const mine = hl.filter(h => h.mine), pre = hl.filter(h => !h.mine);
      const inter = (p, q) => Math.max(0, Math.min(p[2], q[2]) - Math.max(p[0], q[0])) * Math.max(0, Math.min(p[3], q[3]) - Math.max(p[1], q[1]));
      const area = p => (p[2] - p[0]) * (p[3] - p[1]);
      for (const p of pre.sort((x, y) => y.k - x.k)) {
        if (mine.some(m => inter(p.rc, m.rc) > 0.3 * Math.min(area(p.rc), area(m.rc)))) annots.remove(p.k);
        else entry.notes.push(`pre-existing highlight kept on p.${pi + 1} at ${p.rc.map(n => Math.round(n)).join(",")}`);
      }
    }
    await doc.destroy();
    fs.writeFileSync(dest, await pdf.save());
    entry.highlights.sort((x, y) => x.page - y.page);
    log.push(entry);
    console.log(`${name}: ${entry.highlights.filter(h => h.kind === "text").length} sentence(s), ${entry.highlights.filter(h => h.kind === "reference").length} reference entr(ies)${entry.notes.length ? `, ${entry.notes.length} note(s)` : ""}`);
  }
  fs.mkdirSync(path.dirname(LOG), { recursive: true });
  fs.writeFileSync(LOG, JSON.stringify(log, null, 1));
  console.log(`log: ${LOG}`);
}

// Places the resolver cannot see because they are not a numbered or author-year marker.
const EXTRA = {
  "cit-000044": [{ page: 7, quote: "Verespy, S., 3rd; Mehta, A. Y.; Afosah, D.; Al-Horani, R. A.; Desai, U. R. Allosteric partial inhibition of monomeric proteases. Sulfated coumarins induce regulation, not just inhibition, of thrombin. Sci. Rep. 2016, 6, 24043.", ref: true }],
  "cit-000396": [
    { page: 8, quote: "The slight changes in glycan structure, which nonetheless led to appreciable differences in their binding behavior," },
    { page: 8, quote: "made this a particularly challenging case study for our model." },
    { page: 15, quote: "C. Gao, K. Stavenhagen, B. Eckmair, T. R. McKitrick, A. Y. Mehta, Y. Matsumoto, A. M. McQuillan, M. S. Hanes, D. Eris, K. J. Baker, N. Jia, M. Wei, J. Heimburg-Molinaro, B. Ernst, R. D. Cummings, Sci. Adv. 2021, 7, eabf6834.", ref: true }],
  "cit-000542": [{ page: 12, quote: "We also thank Akul Mehta (Harvard University) for valuable discussions and help with the glycan tool Glycan Array Dashboard" }],
  "cit-000629": [{ page: 6, quote: "Diagrams of glycan structures were generated using GlycoGlyph (49). Glycan microarray protocol was followed using the microwave-assisted wet-erase process by Mehta et al. (50)." }],
};

if (require.main === module) main().catch(e => { console.error(e); process.exit(1); });
module.exports = { loadPdfjs, pageModel, locate, sentenceRange, trimHeadings, refByTitle, rectsFor, addHighlight, myPub, getDirs: () => DIRS, OUTDIR };

"use strict";
/**
 * Shared PDF text verification for the packet.
 *
 * Two tools must answer the same question — "does this exact sentence appear on
 * this page of this PDF?" — and if they each implement it their own way, one can
 * pass a claim the other would reject. record-evidence.js and record-mentions.js
 * both call here.
 *
 * canon() strips everything but alphanumerics because PDF extraction inserts
 * spaces inside words ("D ashboard", "glycan - binding") that a person copying a
 * sentence would not reproduce.
 */
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
const { PKT } = require("./lib.js");

function canon(s) {
  return String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * The page numbers a claim names. `page` is free text — counsel reads "4", "4, 5"
 * and "22-30" alike — so parse numbers and ranges rather than matching the string.
 * Returns [] when nothing in the text is a number, which callers treat as "no page
 * claimed".
 */
function expandPages(page) {
  const s = String(page || "");
  const out = new Set();
  for (const m of s.matchAll(/(\d+)\s*[-–]\s*(\d+)/g)) {
    const a = parseInt(m[1], 10), b = parseInt(m[2], 10);
    if (b >= a && b - a < 200) for (let n = a; n <= b; n++) out.add(n);
  }
  const withoutRanges = s.replace(/\d+\s*[-–]\s*\d+/g, " ");
  for (const m of withoutRanges.matchAll(/\d+/g)) out.add(parseInt(m[0], 10));
  return [...out].sort((x, y) => x - y);
}

let pdfjsCache = null;
async function loadPdfjs() {
  if (!pdfjsCache) {
    const build = path.join(PKT, "node_modules", "pdfjs-dist");
    const lib = await import(pathToFileURL(path.join(build, "legacy", "build", "pdf.mjs")).href);
    pdfjsCache = {
      lib,
      dirs: {
        standardFontDataUrl: pathToFileURL(path.join(build, "standard_fonts") + path.sep).href,
        cMapUrl: pathToFileURL(path.join(build, "cmaps") + path.sep).href,
      },
    };
  }
  return pdfjsCache;
}

const pageCache = new Map();

/** One string per page, whitespace-normalised, so a page number can be named. */
async function pageTexts(relOrAbs) {
  const abs = path.isAbsolute(relOrAbs) ? relOrAbs : path.join(PKT, relOrAbs);
  if (pageCache.has(abs)) return pageCache.get(abs);
  const { lib, dirs } = await loadPdfjs();
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
    pages.push(tc.items.map(i => i.str).join(" "));
  }
  await doc.destroy();
  pageCache.set(abs, pages);
  return pages;
}

/**
 * Verify a quotation against the PDF, and against the claimed page when one is
 * given. Returns { ok, why, foundPages }.
 *
 * A quote present in the file but absent from the claimed page FAILS. That is the
 * whole point: counsel turns to the page the packet names, and a true sentence
 * quoted from the wrong page misleads exactly as a false one does.
 */
async function verifyQuote(quote, pdfRel, page) {
  if (!quote) return { ok: false, why: "no quote given" };
  if (!pdfRel) return { ok: false, why: "row names no PDF" };
  const abs = path.isAbsolute(pdfRel) ? pdfRel : path.join(PKT, pdfRel);
  if (!fs.existsSync(abs)) return { ok: false, why: `PDF not found: ${pdfRel}` };

  const pages = await pageTexts(abs);
  const want = canon(quote);
  if (!want) return { ok: false, why: "quote has no letters to match" };

  const foundPages = [];
  pages.forEach((t, i) => { if (canon(t).includes(want)) foundPages.push(i + 1); });

  if (!foundPages.length) {
    return { ok: false, why: `quote not present anywhere in ${path.basename(pdfRel)}`, foundPages };
  }
  const claimed = expandPages(page);
  if (!claimed.length) {
    return { ok: true, why: `found on p.${foundPages.join(", ")}; no page claimed`, foundPages };
  }
  const hit = claimed.filter(c => foundPages.includes(c));
  if (hit.length) return { ok: true, why: `found on p.${hit.join(", ")} as claimed`, foundPages };
  return {
    ok: false,
    why: `quote is in the file but NOT on the claimed page ${page} — it is on p.${foundPages.join(", ")}`,
    foundPages,
  };
}

module.exports = { canon, expandPages, loadPdfjs, pageTexts, verifyQuote };

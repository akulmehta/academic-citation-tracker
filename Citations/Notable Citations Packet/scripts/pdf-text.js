#!/usr/bin/env node
/**
 * Dump the text of a packet PDF, page by page, for reading and quotation.
 *
 *   node scripts/pdf-text.js papers/cit-000542/01-article-VanDerWal-2026.pdf
 *   node scripts/pdf-text.js <file> --pages 5,12-13
 *   node scripts/pdf-text.js <file> --find mehta --find "glycan array dashboard"
 *   node scripts/pdf-text.js <file> --section Acknowledg
 *
 * --find prints only pages containing a term (case-insensitive).
 * --section prints from a term to the end of that page, for pulling out a
 *          named block such as ACKNOWLEDGMENTS.
 *
 * Read-only. Writes nothing.
 */
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");

const PKT = path.resolve(__dirname, "..");

async function loadPdfjs() {
  const build = path.join(PKT, "node_modules", "pdfjs-dist");
  const lib = await import(pathToFileURL(path.join(build, "legacy", "build", "pdf.mjs")).href);
  return { lib, dirs: { standardFontDataUrl: path.join(build, "standard_fonts") + path.sep, wasmUrl: path.join(build, "build", "wasm") + path.sep } };
}

/** Reassemble text lines from positioned items so headings survive. */
function toLines(items) {
  let last = null;
  const out = [];
  for (const it of items) {
    if (!it.str) continue;
    const y = Math.round(it.transform[5]);
    if (last !== null && Math.abs(y - last) > 3) out.push("\n");
    out.push(it.str);
    last = y;
  }
  return out.join("").replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();
}

function parseRanges(spec) {
  const set = new Set();
  for (const part of spec.split(",")) {
    const m = part.trim().match(/^(\d+)(?:-(\d+))?$/);
    if (!m) continue;
    const a = Number(m[1]), b = Number(m[2] || m[1]);
    for (let i = a; i <= b; i++) set.add(i);
  }
  return set;
}

(async () => {
  const argv = process.argv.slice(2);
  const file = argv.find((a) => !a.startsWith("--"));
  if (!file) {
    console.error("usage: node scripts/pdf-text.js <pdf> [--pages 1,3-5] [--find term] [--section term]");
    process.exit(2);
  }
  const flagVals = (name) => argv.reduce((acc, a, i) => (a === `--${name}` ? [...acc, argv[i + 1]] : acc), []);
  const pages = flagVals("pages").length ? parseRanges(flagVals("pages").join(",")) : null;
  const finds = flagVals("find").map((s) => s.toLowerCase());
  const sections = flagVals("section");

  const abs = path.isAbsolute(file) ? file : path.join(PKT, file);
  const { lib, dirs } = await loadPdfjs();
  const doc = await lib.getDocument({
    data: new Uint8Array(fs.readFileSync(abs)),
    useSystemFonts: true,
    isEvalSupported: false,
    standardFontDataUrl: dirs.standardFontDataUrl,
    wasmUrl: dirs.wasmUrl,
  }).promise;

  console.log(`FILE: ${file}`);
  console.log(`PAGES: ${doc.numPages}`);
  for (let i = 1; i <= doc.numPages; i++) {
    if (pages && !pages.has(i)) continue;
    const page = await doc.getPage(i);
    const tc = await page.getTextContent();
    const txt = toLines(tc.items);
    const low = txt.toLowerCase();
    if (finds.length && !finds.some((f) => low.includes(f))) continue;
    console.log(`\n===== p.${i} =====`);
    if (sections.length) {
      for (const s of sections) {
        const idx = low.indexOf(s.toLowerCase());
        if (idx !== -1) console.log(txt.slice(Math.max(0, idx - 100)));
      }
    } else {
      console.log(txt);
    }
  }
  await doc.destroy();
})().catch((e) => { console.error("FAIL:", e.message); process.exit(1); });

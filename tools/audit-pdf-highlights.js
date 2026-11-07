// Offline audit of the yellow highlights actually printed in the exhibit PDFs.
//
// tools/audit-highlights.js checks the marks baked into each saved HTML, which is
// what the PDF was printed from. This script reads the PDF itself. Every filled
// rectangle in the highlight colour rgb(255, 242, 0) is located on the page, the
// title text inside it is read back, and that title is matched to the entries the
// current rule says should be marked. It fails on a mark that sits on no expected
// row, an expected row with no mark, a PDF with more than one page, or a page
// with no PDF on disk.
//
// Read-only. The PDF is parsed with pdf.js (tools/node_modules/pdfjs-dist); nothing
// is rendered or sent anywhere.
//
// Run: node tools/audit-pdf-highlights.js            (all filed pages)
//      node tools/audit-pdf-highlights.js --pub=<base>
//      node tools/audit-pdf-highlights.js --verbose  (one line per page)
// Exit code 1 if any page disagrees.

const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
const lib = require("./tally");
const { stripScholarMarker } = require("./scholar-marker");

const ROOT = path.resolve(__dirname, "..");
const EXHIBITS = path.join(ROOT, "Independent Citation Record", "Exhibits");
const SUPPORT_DIR = path.join(EXHIBITS, "Supporting");
const PDF_DIR = path.join(EXHIBITS, "PDFs");

// The colour the exhibit marks are printed in (see applyHighlights).
const HIGHLIGHT_FILL = "255,242,0";
// A wrapped title prints as one fill per line. Lines of one title sit this close
// (pt) and are merged into one mark; the rows of a page are much further apart.
const MERGE_GAP = 3;
// Slack (pt) when deciding whether a text baseline lies inside a mark. Wide enough
// for subscripts (B(C6F5)3, AB5), which sit below the baseline; rows are about
// 57 pt apart, so it cannot reach a neighbouring row.
const TOLERANCE = 5;

function arg(name, fallback = "") {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}
const onlyPub = arg("pub");
const verbose = process.argv.includes("--verbose");

let pdfjsPromise = null;
function loadPdfjs() {
  if (!pdfjsPromise) {
    const file = path.join(__dirname, "node_modules", "pdfjs-dist", "legacy", "build", "pdf.mjs");
    pdfjsPromise = import(pathToFileURL(file).href);
  }
  return pdfjsPromise;
}

// PDF matrices are [a b c d e f]. `cm` puts the new matrix in front of the
// current one, so the result is multiply(new, current).
function multiply(m, n) {
  return [
    m[0] * n[0] + m[1] * n[2],
    m[0] * n[1] + m[1] * n[3],
    m[2] * n[0] + m[3] * n[2],
    m[2] * n[1] + m[3] * n[3],
    m[4] * n[0] + m[5] * n[2] + n[4],
    m[4] * n[1] + m[5] * n[3] + n[5],
  ];
}

function apply(m, x, y) {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
}

// Every point a path touches, in page space. Enough to bound a rectangle.
function pathPoints(OPS, [ops, coords], ctm) {
  const pts = [];
  let k = 0;
  for (const op of ops) {
    if (op === OPS.rectangle) {
      const [x, y, w, h] = coords.slice(k, k + 4);
      k += 4;
      pts.push(apply(ctm, x, y), apply(ctm, x + w, y + h), apply(ctm, x + w, y), apply(ctm, x, y + h));
    } else if (op === OPS.moveTo || op === OPS.lineTo) {
      pts.push(apply(ctm, coords[k], coords[k + 1]));
      k += 2;
    } else if (op === OPS.curveTo) {
      for (let j = 0; j < 3; j++) pts.push(apply(ctm, coords[k + 2 * j], coords[k + 2 * j + 1]));
      k += 6;
    } else if (op === OPS.curveTo2 || op === OPS.curveTo3) {
      for (let j = 0; j < 2; j++) pts.push(apply(ctm, coords[k + 2 * j], coords[k + 2 * j + 1]));
      k += 4;
    }
  }
  return pts;
}

function bounds(pts) {
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)];
}

// Read the highlight fills and the text of page 1 of one exhibit PDF.
async function readPdf(file) {
  const { getDocument, OPS } = await loadPdfjs();
  const doc = await getDocument({
    data: new Uint8Array(fs.readFileSync(file)),
    isEvalSupported: false,
    verbosity: 0,
  }).promise;
  try {
    const page = await doc.getPage(1);
    const list = await page.getOperatorList();
    const fillOps = new Set(
      ["fill", "eoFill", "fillStroke", "eoFillStroke", "closeFillStroke", "closeEOFillStroke"]
        .filter((n) => OPS[n] !== undefined)
        .map((n) => OPS[n]),
    );
    const clearOps = new Set(
      ["stroke", "closeStroke", "endPath"].filter((n) => OPS[n] !== undefined).map((n) => OPS[n]),
    );
    const identity = [1, 0, 0, 1, 0, 0];
    let ctm = identity;
    const saved = [];
    let fill = "";
    let pending = [];
    const fills = [];
    for (let i = 0; i < list.fnArray.length; i++) {
      const fn = list.fnArray[i];
      const args = list.argsArray[i];
      if (fn === OPS.save) saved.push(ctm);
      else if (fn === OPS.restore) ctm = saved.pop() || identity;
      else if (fn === OPS.transform) ctm = multiply(args, ctm);
      else if (fn === OPS.setFillRGBColor) fill = args.join(",");
      else if (fn === OPS.constructPath) pending.push(...pathPoints(OPS, args, ctm));
      else if (fillOps.has(fn)) {
        if (fill === HIGHLIGHT_FILL && pending.length) fills.push(bounds(pending));
        pending = [];
      } else if (clearOps.has(fn)) pending = [];
    }
    const tc = await page.getTextContent();
    const items = tc.items
      .filter((it) => it.str && it.str.trim())
      .map((it) => ({ text: it.str, x: it.transform[4], y: it.transform[5] }));
    return { numPages: doc.numPages, fills, items };
  } finally {
    await doc.destroy();
  }
}

// One mark per highlighted title: fills on consecutive lines of one wrapped title
// are joined. Sorted top-down so a wrapped title is seen in reading order.
function mergeLines(rects) {
  const sorted = rects.map((r) => r.slice()).sort((a, b) => b[3] - a[3]);
  const out = [];
  for (const r of sorted) {
    const last = out[out.length - 1];
    const sameTitle =
      last &&
      r[3] >= last[1] - MERGE_GAP &&
      r[0] <= last[2] + MERGE_GAP &&
      r[2] >= last[0] - MERGE_GAP;
    if (sameTitle) {
      last[0] = Math.min(last[0], r[0]);
      last[1] = Math.min(last[1], r[1]);
      last[2] = Math.max(last[2], r[2]);
      last[3] = Math.max(last[3], r[3]);
    } else out.push(r);
  }
  return out;
}

// Letters and digits only, so line breaks, hyphenation and punctuation in the
// printed text cannot cause a miss.
function key(s) {
  return String(s).normalize("NFKC").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
}

// Locate each row's title in the PDF's text. A title can also appear inside a
// snippet (Scholar quotes it), so every occurrence is collected. An occurrence that
// is a whole text item is the title line itself and is preferred. When a title
// occurs once per row, its occurrences are paired with those rows top-down, since
// rows print top to bottom in index order. Anything still ambiguous is reported
// rather than guessed. Returns one entry per row: an item, null (not found), or
// the string 'ambiguous'.
function locateTitles(items, rows) {
  const keys = items.map((it) => key(it.text));
  const starts = [];
  let all = "";
  for (const k of keys) {
    starts.push(all.length);
    all += k;
  }
  const itemAt = (pos) => {
    let idx = 0;
    for (let i = 0; i < items.length; i++) {
      if (keys[i].length && starts[i] <= pos) idx = i;
    }
    return idx;
  };
  const byTitle = new Map();
  rows.forEach((r, i) => {
    const k = key(r.title);
    if (!byTitle.has(k)) byTitle.set(k, []);
    byTitle.get(k).push(i);
  });
  const result = rows.map(() => null);
  const groups = [];
  for (const [needle, rowIdx] of byTitle) {
    if (!needle) continue;
    const occ = [];
    for (let pos = all.indexOf(needle); pos !== -1; pos = all.indexOf(needle, pos + 1)) {
      const idx = itemAt(pos);
      occ.push({ item: items[idx], exact: keys[idx] === needle });
    }
    const n = rowIdx.length;
    const exact = occ.filter((o) => o.exact);
    let chosen = null;
    if (occ.length === n) chosen = occ;
    else if (exact.length === n) chosen = exact;
    if (!chosen) {
      groups.push({ title: rows[rowIdx[0]].title, rowIdx, occ: occ.map((o) => o.item) });
      rowIdx.forEach((i) => (result[i] = occ.length ? "ambiguous" : null));
      continue;
    }
    chosen.sort((a, b) => b.item.y - a.item.y || a.item.x - b.item.x);
    const ordered = rowIdx.slice().sort((a, b) => (rows[a].index ?? a) - (rows[b].index ?? b));
    ordered.forEach((rowI, j) => (result[rowI] = chosen[j].item));
  }
  return { located: result, groups };
}

function within(box, item) {
  return (
    item.x >= box[0] - TOLERANCE &&
    item.x <= box[2] + TOLERANCE &&
    item.y >= box[1] - TOLERANCE &&
    item.y <= box[3] + TOLERANCE
  );
}

// Every row on the page, in row order: is the mark the rule calls for the mark the
// PDF draws? `entries` is one item per row: { index, title, marked }.
function checkPage(entries, rects, items) {
  const marks = mergeLines(rects).map((box) => ({ box, used: false }));
  const rows = entries.slice().sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  const { located, groups } = locateTitles(items, rows);
  const problems = [];
  const notes = [];
  const rowMarks = new Map();
  const groupMarks = [];
  let expected = 0;
  rows.forEach((row, i) => {
    if (row.marked) expected++;
    const first = located[i];
    if (!first || first === "ambiguous") return;
    const label = `row ${row.index ?? i} "${row.title.slice(0, 60)}"`;
    const mark = marks.find((m) => within(m.box, first));
    if (mark) mark.used = true;
    rowMarks.set(row.index ?? i, Boolean(mark));
    if (!!mark !== row.marked) {
      problems.push(
        mark
          ? `${label}: marked in the PDF, but the rule does not mark it`
          : `${label}: the rule marks it, but the PDF does not`,
      );
    }
  });
  // A title that repeats in the PDF text (Scholar also quotes it in a snippet)
  // cannot be paired with its rows by position. Those rows are checked as a group:
  // the copies printed under a mark must number the rule-marked rows.
  for (const g of groups) {
    const label = `"${g.title.slice(0, 60)}" (${g.rowIdx.length} row${g.rowIdx.length > 1 ? "s" : ""})`;
    if (!g.occ.length) {
      problems.push(`${label}: title not found in the PDF text`);
      continue;
    }
    const under = g.occ.filter((item) => {
      const mark = marks.find((m) => within(m.box, item));
      if (mark) mark.used = true;
      return Boolean(mark);
    }).length;
    const want = g.rowIdx.filter((i) => rows[i].marked).length;
    groupMarks.push({
      title: g.title,
      indexes: g.rowIdx.map((i) => rows[i].index ?? i),
      under,
    });
    if (under !== want) {
      problems.push(`${label}: ${want} row(s) the rule marks, but ${under} printed mark(s) cover its title`);
    } else {
      notes.push(`${label}: repeated title, checked by count (${want} marked), not row by row`);
    }
  }
  for (const m of marks) {
    if (!m.used) problems.push(`mark on no row title at y=${m.box[1].toFixed(1)}`);
  }
  return { marks: marks.length, expected, problems, notes, rowMarks, groupMarks };
}

// Same PDF lookup as tools/audit-highlights.js.
function pdfFor(base) {
  const root = path.join(PDF_DIR, `${base}.pdf`);
  const prod = path.join(PDF_DIR, "Production", `${base}.pdf`);
  return fs.existsSync(root) ? root : fs.existsSync(prod) ? prod : null;
}

async function pdfPageMarks(file, entries) {
const pdf = await readPdf(file);
const rows = entries.map((e) => ({
  index: e.index,
  title: stripScholarMarker(e.rawTitle || e.title || ""),
  marked: lib.isHighlighted(e),
}));
return { numPages: pdf.numPages, ...checkPage(rows, pdf.fills, pdf.items) };
}

async function auditPage(p) {
  const file = pdfFor(p.base);
  if (!file) return { base: p.base, page: p.page, problems: ["no exhibit PDF on disk"] };
  const result = await pdfPageMarks(file, p.entries);
  const problems = [...result.problems];
  if (result.numPages !== 1) problems.push(`PDF has ${result.numPages} pages, expected 1`);
  return { base: p.base, page: p.page, file, ...result, problems };
}

async function main() {
  const groups = [...lib.groupReports(SUPPORT_DIR, PDF_DIR).values()];
  const targets = onlyPub ? groups.filter((g) => g.base === onlyPub) : groups;
  if (!targets.length) {
    console.error(onlyPub ? `No filed publication named ${onlyPub}.` : "No filed exhibits found.");
    process.exitCode = 1;
    return;
  }

  let pages = 0;
  let marks = 0;
  let expected = 0;
  let bad = 0;
  let noted = 0;
  for (const g of targets.sort((a, b) => a.base.localeCompare(b.base))) {
    for (const p of g.pages) {
      const r = await auditPage(p);
      pages++;
      marks += r.marks || 0;
      expected += r.expected || 0;
      const label = `${p.base} p${p.page}`;
      if (r.notes && r.notes.length) noted++;
      if (r.problems.length) {
        bad++;
        console.log(`FAIL ${label}  marks ${r.marks ?? "-"} (expected ${r.expected ?? "-"})`);
        for (const line of r.problems) console.log(`       ${line}`);
      } else if (verbose) {
        console.log(`ok   ${label}  marks ${r.marks} (expected ${r.expected})`);
      }
      if (r.notes && r.notes.length && (verbose || r.problems.length)) {
        for (const line of r.notes) console.log(`       note: ${line}`);
      }
    }
  }
  console.log(
    `\nPages audited: ${pages}. Yellow marks printed in the PDFs: ${marks}. ` +
      `Expected under the current rule: ${expected}. Pages with problems: ${bad}.`,
  );
  if (noted) {
    console.log(
      `Pages with a repeated title checked by count rather than row by row: ${noted} ` +
        `(run with --verbose to list them).`,
    );
  }
  if (bad) process.exitCode = 1;
  else console.log("Every filed PDF carries exactly the marks the current rule calls for.");
}

module.exports = { readPdf, checkPage, mergeLines, key, pdfFor, pdfPageMarks };

if (require.main === module) {
  main().catch((e) => {
    console.error(`[audit-pdf] ${e.stack || e.message}`);
    process.exitCode = 1;
  });
}


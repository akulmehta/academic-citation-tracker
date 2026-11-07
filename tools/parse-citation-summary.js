// Parse Citations/Citation-summary.docx into Citations/Citation-summary.md.
//
//   node tools/parse-citation-summary.js            (writes the .md)
//   node tools/parse-citation-summary.js --check    (drift check, writes nothing)
//   node tools/parse-citation-summary.js --no-store (skip the row_uid column)
//
// Why a generated .md next to the .docx: the docx is the document the user
// maintains by hand, and it is the only place the reading of each PDF is written
// down -- which section cites the tool, what the sentence actually says, and how
// the preprint and journal dates sit against the April 25 2024 filing date. A
// grep-able plain-text twin makes that readable from a terminal and lets the
// catalog's row_uid be attached to each paper without re-listing it by hand.
//
// The .docx is the source of truth and this file is a rendering of it. Nothing
// here edits the docx and nothing here adds a fact: every sentence in the table
// is quoted from a cell. The columns that ARE computed are labelled *(derived)*
// wherever they appear -- the row_uid (matched by title, basis printed) and the
// PDF inventory (matched by senior-author surname, near misses reported as
// questions rather than silently folded in).
//
// Word's own formatting carries structure that flattened text would lose, so
// runs are read with their bold/italic flags: in the "Paper" column the author
// writes the title bold, the authors plain, and the journal italic. That is how
// the title is recovered for the catalog match without guessing at a comma.
//
// No dependency. A .docx is a ZIP and Node's built-in zlib inflates the one
// entry that matters, consistent with tools/env.js and tools/scholar-marker.js
// staying dependency-free.

const fs = require("fs");
const path = require("path");
const zlib = require("zlib");
const { DatabaseSync } = require("node:sqlite");
const { stripScholarMarker } = require("./scholar-marker");
const { DB_PATH } = require("./build-catalog");

const ROOT = path.resolve(__dirname, "..");
const DOCX = path.join(ROOT, "Citations", "Citation-summary.docx");
const OUT = path.join(ROOT, "Citations", "Citation-summary.md");
const PDF_ROOT = path.join(ROOT, "Citations");

// Folders the author keeps PDFs in. The last entry is the set of citations used
// in the original application; those are deliberately not part of this docx's
// table, so they are listed in the inventory but never counted as "unmatched".
const ORIGINAL_APP_FOLDER = "Notable Citations in Original Application";
const ORIGINAL_APP_DOC = "Original-Application-Citations.md";

const CHECK = process.argv.includes("--check");
const USE_STORE = !process.argv.includes("--no-store");

// ---------------------------------------------------------------- ZIP reading

// Minimal read-only ZIP reader: find the end-of-central-directory record, walk
// the central directory, inflate the one entry asked for. Handles what a .docx
// actually contains (deflate and stored) and nothing else.
function readZipEntry(buf, wanted) {
  const EOCD = 0x06054b50;
  let eocd = -1;
  // The trailing comment may be up to 65535 bytes, so scan backwards for it.
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === EOCD) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("not a ZIP file (no end-of-central-directory record)");
  const count = buf.readUInt16LE(eocd + 10);
  let p = buf.readUInt32LE(eocd + 16);
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error("corrupt central directory");
    const method = buf.readUInt16LE(p + 10);
    const compSize = buf.readUInt32LE(p + 20);
    const nameLen = buf.readUInt16LE(p + 28);
    const extraLen = buf.readUInt16LE(p + 30);
    const commentLen = buf.readUInt16LE(p + 32);
    const localOff = buf.readUInt32LE(p + 42);
    const name = buf.slice(p + 46, p + 46 + nameLen).toString("utf8");
    if (name === wanted) {
      // The local header repeats the name with its own, possibly different,
      // extra-field length -- so the data offset must come from the local header.
      if (buf.readUInt32LE(localOff) !== 0x04034b50) throw new Error("corrupt local header");
      const lNameLen = buf.readUInt16LE(localOff + 26);
      const lExtraLen = buf.readUInt16LE(localOff + 28);
      const start = localOff + 30 + lNameLen + lExtraLen;
      const raw = buf.slice(start, start + compSize);
      if (method === 0) return raw.toString("utf8");
      if (method === 8) return zlib.inflateRawSync(raw).toString("utf8");
      throw new Error(`unsupported ZIP compression method ${method} for ${wanted}`);
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  throw new Error(`${wanted} not found in the archive`);
}

// ------------------------------------------------------------- OOXML reading

function decodeEntities(s) {
  return String(s)
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&amp;/g, "&");
}

// The top-level siblings of a tag within a fragment. Word never nests w:tr
// inside w:tr or w:tc inside w:tc, so a flat scan is exact here.
function topLevel(fragment, tag) {
  const out = [];
  const open = `<${tag}`;
  const close = `</${tag}>`;
  let i = 0;
  for (;;) {
    const s = fragment.indexOf(open, i);
    if (s < 0) break;
    const e = fragment.indexOf(close, s);
    if (e < 0) break;
    out.push(fragment.slice(s, e + close.length));
    i = e + close.length;
  }
  return out;
}

// Runs of a cell, merged on formatting, so **bold** and *italic* survive into
// markdown without splitting one phrase across adjacent runs.
function runsOf(cellXml) {
  const runs = [];
  const re = /<w:r\b[^>]*>([\s\S]*?)<\/w:r>/g;
  let m;
  while ((m = re.exec(cellXml))) {
    const inner = m[1];
    const t = (inner.match(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/) || [])[1];
    if (t === undefined) continue;
    const rPr = (inner.match(/<w:rPr>([\s\S]*?)<\/w:rPr>/) || [])[1] || "";
    runs.push({
      text: decodeEntities(t),
      bold: /<w:b\s*\/>/.test(rPr),
      italic: /<w:i\s*\/>/.test(rPr),
    });
  }
  const merged = [];
  for (const r of runs) {
    const prev = merged[merged.length - 1];
    if (prev && prev.bold === r.bold && prev.italic === r.italic) prev.text += r.text;
    else merged.push({ ...r });
  }
  return merged;
}

// Collapse to one line and escape the pipe: a markdown table cell can hold
// neither a newline nor an unescaped delimiter.
function inline(text) {
  return String(text == null ? "" : text).replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();
}

// Wrap a run in emphasis markers without letting the markers swallow the space
// around it: "Heras, " + "*Journal*" must not render as "Heras,*Journal*".
function wrap(text, bold, italic) {
  if (!bold && !italic) return text;
  const lead = (text.match(/^\s*/) || [""])[0];
  const trail = (text.match(/\s*$/) || [""])[0];
  const core = text.slice(lead.length, text.length - trail.length);
  if (!core) return text;
  const mark = bold && italic ? "***" : bold ? "**" : "*";
  return `${lead}${mark}${core}${mark}${trail}`;
}

function cellMarkdown(cellXml) {
  const parts = runsOf(cellXml || "").map((r) => {
    const t = r.text.replace(/\s+/g, " ");
    if (!t.trim()) return t;
    return wrap(t, r.bold, r.italic);
  });
  return parts.join("").replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();
}

function cellPlain(cellXml) {
  return inline(runsOf(cellXml || "").map((r) => r.text).join(""));
}

// The "Paper" column is bold title, plain authors, italic journal.
function splitPaper(cellXml) {
  const runs = runsOf(cellXml || "");
  return {
    title: runs.filter((r) => r.bold && !r.italic).map((r) => r.text).join("").trim(),
    journal: runs.filter((r) => r.italic).map((r) => r.text).join("").trim(),
    rest: runs.filter((r) => !r.bold && !r.italic).map((r) => r.text).join("").trim(),
  };
}

function parseDocx(docxPath) {
  const buf = fs.readFileSync(docxPath);
  const xml = readZipEntry(buf, "word/document.xml");
  const bodyStart = xml.indexOf("<w:body>");
  if (bodyStart < 0) throw new Error("word/document.xml has no <w:body>");
  const body = xml.slice(bodyStart + 8, xml.lastIndexOf("</w:body>"));
  const tables = topLevel(body, "w:tbl");
  if (tables.length !== 1) {
    throw new Error(`expected exactly one table in the summary, found ${tables.length}`);
  }
  const rows = topLevel(tables[0], "w:tr").map((r) => topLevel(r, "w:tc"));

  // docProps/core.xml holds the author and the last-modified instant, which is
  // what tells a reader how stale this rendering is against the document.
  let meta = {};
  try {
    const core = readZipEntry(buf, "docProps/core.xml");
    const grab = (tag) => {
      const m = core.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`));
      return m ? decodeEntities(m[1]).trim() : "";
    };
    meta = {
      creator: grab("dc:creator"),
      modifiedBy: grab("cp:lastModifiedBy"),
      modified: grab("dcterms:modified"),
    };
  } catch {
    /* docProps is optional; the rendering does not depend on it */
  }
  return { rows, meta };
}

// -------------------------------------------------------------- catalog link

const norm = (t) =>
  stripScholarMarker(String(t || ""))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
const tokens = (t) => norm(t).split(" ").filter((w) => w.length > 2);

// Title matching is a lookup, not a claim about identity, so the basis is
// printed beside every uid. Same reasoning as tools/tally.js paperKey, which
// merges on a normalised title and is documented as a guess a person can undo.
function linkRows(catalog, wanted) {
  if (!catalog) return { rows: [], basis: null, error: "catalog unavailable" };
  const exact = catalog.filter((r) => norm(r.title) === norm(wanted));
  if (exact.length) return { rows: exact, basis: "exact normalised title" };

  // Fall back to containment: the docx names the journal article while Scholar
  // sometimes lists the same work under its earlier preprint title, and the
  // other way round. Requiring every word of the shorter side is what keeps a
  // short fragment from matching an unrelated paper, the rule
  // titleMatchIsCredible in tools/crosscheck.js applies to external look-ups.
  const wt = tokens(wanted);
  if (wt.length < 6) return { rows: [], basis: null };
  const hits = [];
  for (const r of catalog) {
    const rt = tokens(r.title);
    if (rt.length < 6) continue;
    const [shorter, longer] = wt.length <= rt.length ? [wt, rt] : [rt, wt];
    const set = new Set(longer);
    if (shorter.every((w) => set.has(w))) hits.push(r);
  }
  return hits.length ? { rows: hits, basis: "one title wholly contained in the other" } : { rows: [], basis: null };
}

// Titles to look up for one "Paper" cell: the bold title, plus any alias the
// author wrote in parentheses. Row 1 does this -- the docx names the journal
// article and quotes the bioRxiv title, and Scholar lists BOTH as separate rows
// against GLAD (cit-000544 and cit-000558), so searching only the bold title
// would report half the exhibit rows that exist for that paper.
function titleCandidates(paper) {
  const out = [paper.title];
  const re = /(?:preprint|earlier)\s+title\s*:\s*"([^"]{15,})"/gi;
  let m;
  while ((m = re.exec(String(paper.rest || "")))) out.push(m[1].trim());
  return [...new Set(out.filter(Boolean))];
}

// All catalog rows for any candidate title, deduplicated, each tagged with the
// candidate that found it.
function linkAll(catalog, candidates) {
  const seen = new Map();
  const bases = [];
  for (const c of candidates) {
    const r = linkRows(catalog, c);
    if (!r.rows.length) continue;
    bases.push(`"${c.length > 48 ? `${c.slice(0, 48)}…` : c}" → ${r.basis}`);
    for (const row of r.rows) if (!seen.has(row.row_uid)) seen.set(row.row_uid, row);
  }
  return { rows: [...seen.values()], bases, error: bases.length ? null : "no title match among the active catalog rows" };
}

// ------------------------------------------------------------- PDF inventory

function fold(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function editDistance(a, b) {
  if (a === b) return 0;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}

// The author cell reads ", First ... Last, " with a volume or folder note
// trailing. Both ends are returned, [first, senior]: the senior author is what
// the PDF files are named after, and the first author sometimes is too. A
// particle stays attached ("van der Wal"), and so does a hyphenate
// ("Grossman-Haham"), because dropping it would leave "Wal" to be found inside
// any longer name.
function surnamesOf(rest) {
  const s = String(rest || "").trim();
  const NAME = "[A-Za-z\\u00c0-\\u024f'’.-]+";
  const ell = s.match(new RegExp(`^\\s*,\\s*(${NAME})\\s*\\.\\.\\.\\s*((?:${NAME}\\s+)*${NAME})`));
  if (ell) return [...new Set([ell[1], ell[2].trim().replace(/\s+/g, " ")])];
  // "Nuschy & Wilson" -- two authors named in full, no ellipsis.
  const pair = s.match(/^\s*,\s*([^,]+?)\s*,/);
  if (pair) {
    const names = [];
    for (const w of pair[1].split(/\s*(?:&|;)\s*/)) {
      const m = w.trim().match(new RegExp(`(${NAME})$`));
      if (m) names.push(m[1]);
    }
    if (names.length) return [...new Set(names)];
  }
  return [];
}

// Forms a surname can appear in inside a file name: as written, and compacted
// across the separators a file name uses instead of spaces and hyphens.
function surnameKeys(phrase) {
  const f = fold(phrase);
  const keys = [f, f.replace(/[^a-z0-9]+/g, "")];
  const last = f.split(/[^a-z0-9]+/).filter(Boolean).pop();
  if (last && last.length >= 5) keys.push(last);
  return [...new Set(keys.filter(Boolean))];
}

function listPdfs(dir, rel) {
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isFile() && d.name.toLowerCase().endsWith(".pdf"))
    .map((d) => ({
      name: d.name,
      bytes: fs.statSync(path.join(dir, d.name)).size,
      rel: path.posix.join(rel, d.name),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

// A PDF belongs to a row when a surname from the author cell appears in the file
// name. A short surname counts only as a whole token, or "Wal" from "van der
// Wal" would be found inside any longer name. A near miss (one or two characters
// out, which is what a filename typo looks like) is reported as a question,
// never folded in.
function matchPdfs(surnames, files) {
  const direct = [];
  const near = [];
  // Candidates for a near miss: each whole surname with separators removed, and
  // each word of it, so "van der Wal" can still be recognised against a file
  // spelling it "Waal". A long candidate tolerates two edits, a short one only
  // one -- two edits on a five-letter name reaches unrelated words.
  const candidates = [];
  for (const s of surnames) {
    const compact = fold(s).replace(/[^a-z0-9]/g, "");
    if (compact.length >= 5) candidates.push({ key: compact, max: compact.length >= 7 ? 2 : 1 });
    for (const w of fold(s).split(/[^a-z0-9]+/).filter((x) => x.length >= 3)) {
      // A three-letter surname is compared only against a word of nearly the
      // same length and only one edit out, which is what "Wal" against a file
      // written "Waal" needs and what keeps it from reaching unrelated words.
      candidates.push({ key: w, max: w.length >= 7 ? 2 : 1 });
    }
  }
  const keys = surnames.flatMap(surnameKeys);
  for (const f of files) {
    const fn = fold(f.name);
    const words = fn.split(/[^a-z0-9]+/).filter(Boolean);
    const compact = fn.replace(/[^a-z0-9]/g, "");
    let hit = false;
    for (const k of keys) {
      if (k.length >= 5 ? fn.includes(k) || compact.includes(k) : words.includes(k)) { hit = true; break; }
    }
    if (hit) { direct.push(f); continue; }
    // A near miss must be an actual spelling difference: zero edits is either a
    // partial name the direct rule deliberately refused to accept (a bare particle
    // such as "van") or an exact hit. Prefer the longest candidate that differs, so
    // the note reads "`wal` vs `waal`" rather than naming a particle that agrees.
    let flagged = null;
    for (const c of candidates) {
      for (const w of words) {
        if (w.length < 3) continue;
        if (Math.abs(w.length - c.key.length) > c.max) continue;
        const d = editDistance(w, c.key);
        if (d < 1 || d > c.max) continue;
        if (!flagged || c.key.length > flagged.surname.length) {
          flagged = { file: f, surname: c.key, token: w };
        }
      }
    }
    if (flagged) near.push(flagged);
  }
  return { direct, near };
}

// ------------------------------------------------------------------- rendering

function render(rows, meta, pdfGroups, catalog) {
  const data = rows.slice(1);
  const out = [];
  const now = new Date().toISOString().slice(0, 10);
  const allFiles = pdfGroups.flatMap((g) => g.files);

  const parsed = data.map((cells, n) => {
    const paper = splitPaper(cells[3]);
    const surnames = surnamesOf(paper.rest);
    const used = cellPlain(cells[5]);
    const link = USE_STORE
      ? linkAll(catalog, titleCandidates(paper))
      : { rows: [], bases: [], error: "store look-up skipped (--no-store)" };
    return {
      n: cellPlain(cells[1]) || String(n + 1),
      earliest: cellPlain(cells[0]),
      published: cellPlain(cells[2]),
      paperMarkdown: cellMarkdown(cells[3]),
      tool: cellPlain(cells[4]),
      used,
      usedMarkdown: cellMarkdown(cells[5]),
      title: paper.title,
      journal: paper.journal,
      surnames,
      link,
      pdfs: matchPdfs(surnames, allFiles),
    };
  });

  out.push("# Citation summary — articles citing the PI's tools");
  out.push("");
  out.push(
    "> **Generated file — do not edit.** Rendered from [`Citation-summary.docx`](./Citation-summary.docx) by " +
      "[`tools/parse-citation-summary.js`](../tools/parse-citation-summary.js). Edit the docx, then re-run " +
      "`node tools/parse-citation-summary.js`; a re-run overwrites this file."
  );
  out.push(">");
  out.push(
    `> Source: docx created by ${meta.creator || "unknown"}, last modified ${meta.modified || "unknown"} ` +
      `by ${meta.modifiedBy || "unknown"}. Rendered ${now}. Every sentence in the tables below is quoted from a ` +
      "cell of that document. Columns marked *(derived)* are computed, not written by the author, and say how."
  );
  out.push("");
  out.push(
    "What this collection is for: finding the papers that use **GLAD**, **GlycoGlyph**, or the **MAWE** " +
      "glycan-microarray method, and recording *where* in each paper the tool appears. A Methods-section use is " +
      "stronger evidence of adoption than a passing reference. The \"Where\" column below is the first word of " +
      "the author's own note, so it is that reading of the PDF, not an inference."
  );
  out.push("");

  // --- index ---------------------------------------------------------------
  out.push("## Index");
  out.push("");
  out.push("| # | Earliest | Published / accepted | Tool | Where | Senior author | row_uid *(derived)* | PDFs *(derived)* |");
  out.push("|---|---|---|---|---|---|---|---|");

  const whereWord = (p) => {
    const m = p.used.match(/^(Methods|Results|Figures|Acknowledgments)\b/i);
    if (m) return m[1][0].toUpperCase() + m[1].slice(1);
    if (/^The paper reports/.test(p.used)) return "unresolved";
    return "—";
  };

  for (const p of parsed) {
    const uid = p.link.rows.length ? p.link.rows.map((r) => `\`${r.row_uid}\``).join("<br>") : "—";
    const pdfCell = p.pdfs.direct.length
      ? `${p.pdfs.direct.length} file(s)`
      : p.pdfs.near.length
        ? "? spelling"
        : "—";
    out.push(
      `| ${p.n} | ${inline(p.earliest)} | ${inline(p.published)} | ${inline(p.tool)} | ${whereWord(p)} | ` +
        `${inline(p.surnames[p.surnames.length - 1] || "")} | ${uid} | ${pdfCell} |`
    );
  }
  out.push("");

  // --- counts --------------------------------------------------------------
  const count = (pred) => parsed.filter(pred).length;
  out.push("## Counts");
  out.push("");
  out.push(`- Papers summarised: **${parsed.length}**`);
  out.push(`- Tool named in **Methods**: **${count((p) => /^Methods\b/.test(p.used))}**`);
  out.push(`- Tool named in **Results / Figures** only: **${count((p) => /^(Results|Figures)\b/.test(p.used))}**`);
  out.push(
    `- Mentioning **GLAD**: **${count((p) => /GLAD/i.test(p.tool))}** · ` +
      `**GlycoGlyph**: **${count((p) => /GlycoGlyph/i.test(p.tool))}** · ` +
      `**MAWE or microarrays**: **${count((p) => /MAWE|Microarray/i.test(p.tool))}**`
  );
  out.push(
    `- Matched to a catalog row: **${count((p) => p.link.rows.length)} of ${parsed.length}**, of which ` +
      `**${count((p) => p.link.rows.some((r) => r.status === "INDEPENDENT" && r.is_highlighted))}** already carry ` +
      "a highlighted independent row in a filed exhibit."
  );
  out.push("");
  out.push(
    "These count rows of this table, and one row is one citing paper. The same paper appears on the \"cited by\" " +
      "page of every PI work it cites, so one row can map to several `row_uid` values. The packet's counted " +
      "figure is the ledger's, not this table's — quote `Exhibits/Supporting/citation-ledger-<snapshot>.csv`."
  );
  out.push("");

  // --- detail --------------------------------------------------------------
  out.push("## Detail");
  out.push("");
  for (const p of parsed) {
    out.push(`### ${p.n}. ${inline(p.title)}`);
    out.push("");
    // The paper line exactly as the author formatted it (bold title, plain
    // authors, italic journal) — emitted verbatim rather than reassembled.
    out.push(p.paperMarkdown || "_no paper line_");
    out.push("");
    out.push(`- **Tool:** ${p.tool || "—"}`);
    out.push(`- **Earliest date (preprint, else journal received):** ${p.earliest || "—"}`);
    out.push(`- **Published / accepted:** ${p.published || "—"}`);
    out.push("");
    out.push(p.usedMarkdown || "_No note in the source document._");
    out.push("");
    if (p.link.rows.length) {
      out.push(
        `**Catalog rows** *(derived — ${p.link.bases.join("; ")}; one row per exhibit page the paper appears on)*:`
      );
      out.push("");
      out.push("| row_uid | Status | Highlighted | Title as Scholar lists it | PI work cited | Exhibit page |");
      out.push("|---|---|---|---|---|---|");
      for (const r of p.link.rows) {
        // Truncate on code points, not code units: a title can hold a Greek
        // letter or a math symbol, and slicing one in half writes a lone
        // surrogate into the report.
        const t = inline(r.title);
        const cp = Array.from(t);
        const shown = cp.length > 70 ? `${cp.slice(0, 70).join("")}…` : t;
        out.push(
          `| \`${r.row_uid}\` | ${r.status} | ${r.is_highlighted ? "yes" : "no"} | ` +
            `${shown} | ${inline(r.cited_title || "—")} | ${inline(r.base)} p.${r.page} |`
        );
      }
    } else {
      out.push(`**Catalog rows** *(derived)*: ${p.link.error || "no title match among the active catalog rows"}.`);
    }
    out.push("");
    if (p.pdfs.direct.length) {
      out.push("**PDF** *(derived — a surname from the author cell appears in the file name)*:");
      for (const f of p.pdfs.direct) {
        out.push(`- [${f.name}](./${encodeURI(f.rel)}) — ${(f.bytes / 1048576).toFixed(1)} MB`);
      }
    } else if (p.pdfs.near.length) {
      out.push("**PDF** *(derived)*: no exact surname match. The file below differs by spelling only — confirm it yourself:");
      for (const x of p.pdfs.near) {
        out.push(
          `- [${x.file.name}](./${encodeURI(x.file.rel)}) — \`${x.token}\` in the name vs \`${x.surname}\` in the document`
        );
      }
    } else {
      out.push("**PDF** *(derived)*: none matched on surname.");
    }
    out.push("");
  }

  // --- open items ----------------------------------------------------------
  // Extracted, not judged: the sentences in the source that say something is
  // unverified, pulled by keyword, so they are not lost inside the prose.
  const FLAG = /Check |does not show|does not attribute|not shown|not in the PDF|file name says|does not name/i;
  out.push("## Open items recorded in the source");
  out.push("");
  out.push(
    "Sentences in the document that flag something as unverified or contradictory, pulled by keyword. The " +
      "wording is the author's; nothing here has been resolved."
  );
  out.push("");
  let any = false;
  for (const p of parsed) {
    const hits = p.used.split(/(?<=[.!?])\s+/).filter((s) => FLAG.test(s));
    if (/not shown/i.test(p.earliest)) hits.push(`Earliest date column reads: ${p.earliest}`);
    if (!hits.length) continue;
    any = true;
    for (const s of hits) out.push(`- **${p.n}. ${inline(p.title)}** — ${inline(s)}`);
  }
  if (!any) out.push("- none");
  out.push("");

  // --- inventory -----------------------------------------------------------
  out.push("## PDF inventory");
  out.push("");
  const nearFiles = new Set(parsed.flatMap((p) => p.pdfs.near.map((x) => x.file)));
  for (const g of pdfGroups) {
    out.push(`### ${g.label}${g.rel === "." ? " (top level)" : ""} — ${g.files.length} file(s)`);
    out.push("");
    if (g.rel === ORIGINAL_APP_FOLDER) {
      out.push(
        `These ${g.files.length} articles were cited in the original application. They are listed here so no file in ` +
          "`Citations/` goes unaccounted for, but they are **not** part of the docx table above and are documented in " +
          `[${ORIGINAL_APP_DOC}](./${encodeURI(ORIGINAL_APP_FOLDER)}/${encodeURI(ORIGINAL_APP_DOC)}). ` +
          "Do not submit them again as new evidence."
      );
      out.push("");
    }
    if (!g.files.length) {
      out.push("_empty_");
      out.push("");
      continue;
    }
    out.push("| File | Size | Row *(derived)* |");
    out.push("|---|---|---|");
    for (const f of g.files) {
      const owner = parsed.find((p) => p.pdfs.direct.includes(f));
      const nearOwner = parsed.find((p) => p.pdfs.near.some((x) => x.file === f));
      const cell = owner ? `#${owner.n}` : nearOwner ? `? #${nearOwner.n} (spelling)` : "— unmatched";
      out.push(`| [${inline(f.name)}](./${encodeURI(f.rel)}) | ${(f.bytes / 1048576).toFixed(1)} MB | ${cell} |`);
    }
    out.push("");
  }
  const excluded = new Set(pdfGroups.filter((g) => g.rel === ORIGINAL_APP_FOLDER).flatMap((g) => g.files));
  const inScope = allFiles.filter((f) => !excluded.has(f));
  const unmatched = inScope.filter(
    (f) => !parsed.some((p) => p.pdfs.direct.includes(f)) && !nearFiles.has(f)
  );
  if (unmatched.length) {
    out.push(
      `**${unmatched.length} of ${inScope.length} PDFs match no row** on surname, and no near spelling was ` +
        "found either. That is a naming difference, not evidence that a paper is missing from the table: several " +
        "files are named for the *first* author or after a DOI, and the `low-value` folder is deliberately not " +
        "summarised in the docx. Check the file before concluding anything about it."
    );
    out.push("");
  }

  out.push("---");
  out.push("");
  out.push(
    "Filing dates, independence and counts for the packet come from the ledger and the catalog, not from this " +
      "table. What this table records that no automated capture can read is what each citing paper *says about " +
      "the tool*."
  );
  out.push("");
  return out.join("\n");
}

// ------------------------------------------------------------------------ main

function loadCatalog() {
  if (!USE_STORE) return null;
  if (!fs.existsSync(DB_PATH)) {
    console.error(`No catalog at ${DB_PATH} -- the row_uid column will be empty. Build it with:`);
    console.error("  node tools/build-catalog.js --write");
    return null;
  }
  const db = new DatabaseSync(DB_PATH, { readOnly: true });
  try {
    return db
      .prepare(
        `SELECT c.row_uid, c.title, c.status, c.is_highlighted, c.base, c.page, p.title AS cited_title
           FROM v_active c
           LEFT JOIN publications p ON p.cites_id = c.cites_id`
      )
      .all()
      .map((r) => ({ ...r }));
  } finally {
    db.close();
  }
}

function main() {
  if (!fs.existsSync(DOCX)) {
    console.error(`No docx at ${DOCX}`);
    process.exit(1);
  }
  const { rows, meta } = parseDocx(DOCX);
  if (rows.length < 2) {
    console.error(`The summary table has ${rows.length - 1} data row(s); refusing to render an empty report.`);
    process.exit(1);
  }
  const present = fs.readdirSync(PDF_ROOT, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name);
  const ORDER = [
    "In Methods",
    "In Acknowledgements",
    "In Results and Figures",
    "In high reputation Publication",
    "low-value",
    // Cited in the original application, not in this table; kept in the inventory
    // so no file goes unlisted, but documented in its own .md alongside them.
    ORIGINAL_APP_FOLDER,
  ];
  const groups = [
    { label: "Unclassified", rel: ".", files: listPdfs(PDF_ROOT, ".") },
    ...ORDER.filter((s) => present.includes(s)).map((s) => ({
      label: s,
      rel: s,
      files: listPdfs(path.join(PDF_ROOT, s), s),
    })),
    ...present
      .filter((s) => !ORDER.includes(s))
      .map((s) => ({ label: s, rel: s, files: listPdfs(path.join(PDF_ROOT, s), s) })),
  ];
  const md = render(rows, meta, groups, loadCatalog());

  if (CHECK) {
    let existing = null;
    try {
      existing = fs.readFileSync(OUT, "utf8");
    } catch {
      existing = null;
    }
    // The render date changes daily, so ignore the one line it appears on;
    // otherwise --check would report drift every morning.
    const strip = (s) => (s || "").replace(/^> Source:.*$/m, "");
    if (existing === null) {
      console.error("DRIFT: Citation-summary.md does not exist. Run: node tools/parse-citation-summary.js");
      process.exit(1);
    }
    if (strip(existing) !== strip(md)) {
      console.error(
        "DRIFT: Citation-summary.md does not match Citation-summary.docx. " +
          "Run: node tools/parse-citation-summary.js"
      );
      process.exit(1);
    }
    console.log(`Citation-summary.md is current against the docx (${rows.length - 1} rows).`);
    return;
  }

  const tmp = `${OUT}.tmp`;
  fs.writeFileSync(tmp, md, "utf8");
  fs.renameSync(tmp, OUT);
  console.log(`Wrote ${path.relative(ROOT, OUT)} from ${path.relative(ROOT, DOCX)} (${rows.length - 1} rows).`);
}

if (require.main === module) main();

module.exports = { parseDocx, readZipEntry, runsOf, splitPaper, surnamesOf, matchPdfs, norm, linkRows };

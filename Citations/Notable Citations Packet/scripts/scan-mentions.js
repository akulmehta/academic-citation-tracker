// Find where the applicant's tool is mentioned in each PDF in the packet, and
// what the surrounding text says.
//
// This is the tool that decides a tier. Tier A means the tool is the method the
// citing authors performed, which is a claim about a specific paragraph, so the
// scanner reports the section it found the mention in and the sentence around it
// and lets the packet carry that evidence rather than an assertion.
//
// It never writes a verdict it cannot support: a mention found in a reference
// list, a keyword line, or a Data Availability statement is reported as such and
// the row stays `held`. Only a mention inside Materials and Methods — under a
// heading the paper itself used — is offered as Tier A, and even then the quote
// is recorded verbatim so a person can check it.

const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
const { PKT, openPacket, toolForCitedPaper: toolForCitedPaperFromLib } = require("./lib");

const argv = process.argv.slice(2);
const DRY = argv.includes("--dry");
const DEBUG = argv.includes("--explain");
const ONLY = (argv.find(a => a.startsWith("--folder=")) || "").split("=")[1] || null;

let pdfjs = null;
async function loadPdfjs() {
  if (!pdfjs) {
    // Windows paths are not valid ESM specifiers; hand import() a file:// URL.
    // The legacy build is the one pdf.js supports under Node.
    const build = path.join(PKT, "node_modules", "pdfjs-dist");
    pdfjs = await import(pathToFileURL(path.join(build, "legacy", "build", "pdf.mjs")).href);
    pdfjs._assetDirs = {
      standardFontDataUrl: pathToFileURL(path.join(build, "standard_fonts") + path.sep).href,
      cMapUrl: pathToFileURL(path.join(build, "cmaps") + path.sep).href,
    };
  }
  return pdfjs;
}

/** The applicant's own work, as a citing paper might name it. */
// `wet-erase` is listed for MAWE because that is what the method is called in
// prose: the cited paper is "Microwave-assisted wet-erase (MAWE) protocol…", and
// a citing author who used it often writes the name without the acronym. Without
// this, cit-001261 read "MAWE appears only in the reference list" while its own
// filed quotation — "following a previously reported microwave-assisted wet-erase
// protocol" — sits in the Methods. A scanner that cannot see the name will
// understate a real use, which is the opposite error to the one to be guarded
// against but an error nonetheless.
const TOOLS = [
  { key: "GLAD", label: "GLAD", pats: [/\bGLAD\b/, /glycan array dashboard/i] },
  { key: "GlycoGlyph", label: "GlycoGlyph", pats: [/glyco\s*glyph/i, /glycoglyph/i] },
  { key: "MAWE", label: "MAWE", pats: [/\bMAWE\b/, /microarray[- ]based (?:glycan )?array/i, /wet[- ]?erase/i] },
  { key: "Glyco-SPOT", label: "Glyco-SPOT", pats: [/glyco[- ]?spot/i] },
];

// A heading is a line that NAMES a section and nothing else. Journals vary
// wildly in wording, so the list is by family of phrasing, and the first heading
// in reading order sets the boundary — which is what "which section is this
// mention in" means.
//
// Each pattern is anchored at BOTH ends on purpose. A prefix test read the
// wrapped sentence fragment "Methods Section). The majority of previously
// reported" as the Materials and Methods heading, and put a Tier A mark on a
// citation a person had recorded as Results. That is the exact error this packet
// cannot afford: a tier is a claim about how the tool was used.
const SECTIONS = [
  { id: "Methods", rank: "A", re: /materials\s+and\s+methods?|methods?\s*(?:and|&)\s*materials|experimental(?:\s+section|\s+procedures?)|methods?|computational\s+(?:methods?|details)|star.{0,6}\s?methods?|author[s']?\s+methods?/i },
  { id: "Results", rank: "B", re: /results?(?:\s*(?:and|&)\s*discussion)?|findings?/i },
  { id: "Introduction", rank: "C", re: /introduction|background|significance/i },
  { id: "Discussion", rank: "C", re: /discussion|conclusions?|outlook|perspectives?|concluding\s+remarks?/i },
  { id: "Acknowledgements", rank: "D", re: /acknowledge?ments?|funding/i },
  { id: "References", rank: "REF", re: /references?|bibliography|literature\s+cited|works\s+cited/i },
];

// Optional numbering ("2.", "2.1", "III)") plus the bar separator some journals
// print between the number and the name ("2 | METHODS"). A heading carrying more
// words than the phrase is prose, not a heading.
const SEP = "\\s*(?:[.)–-]\\s*)?\\|?\\s*";
const NUM = "^(?:\\d+(?:\\.\\d+)*" + SEP + "|[IVXLC]+" + SEP + ")?";

/** Standalone heading: the whole line is the section name. */
const STANDALONE = SECTIONS.map(s => ({ ...s, test: new RegExp(NUM + "(?:" + s.re.source + ")\\s*[.:]?$", "i") }));

/**
 * Inline heading: "Methods. We coated the array…" — the name, a stop, then prose.
 * Requires the punctuation immediately after the phrase, so "Methods of glycan
 * analysis…" and "Results are still…" stay prose and set nothing.
 */
const INLINE = SECTIONS.map(s => ({ ...s, test: new RegExp(NUM + "(?:" + s.re.source + ")[.:]\\s+\\S", "i") }));

/**
 * Undo tracked capitals: "2 | M E T H O D S" and "I N T R O D U C T I O N".
 *
 * Some publishers set a heading by spacing every letter, and pdf.js extracts
 * exactly what is drawn — so the heading is invisible to any word pattern. Only
 * collapse a run of single letters separated by single spaces, which is what
 * tracked text looks like; ordinary words are left alone.
 */
function untrack(line) {
  if (!/(?:^\|\s*|[\s|])(?:\p{L} ){2,}\p{L}(?=\s|$)/u.test(line)) return line;
  return line.replace(/(?<=^|[\s|])(\p{L} )+(\p{L})(?=[\s|.:]|$)/gu, m => m.replace(/ /g, ""));
}

/**
 * Decide whether a numbered line is a subsection heading rather than prose that
 * happens to start with a figure ("2.5 mL of buffer was added to each well.").
 * The bar alone settles it. Without one, require the shape of a title: no
 * comma, no terminal period, at most six words, first word capitalized.
 */
function subsectionTitle(rest, hasBar) {
  const t = rest.trim();
  if (!t || t.length > 55) return false;
  if (hasBar) return true;
  if (/[.,;]$/.test(t) || t.includes(",")) return false;
  const words = t.split(/\s+/);
  return words.length <= 6 && /^[A-Z]/.test(words[0]);
}

/** The section a line opens, if any. */
function headingOf(line) {
  if (line.length > 60) return null;
  const text = untrack(line);
  const alone = STANDALONE.find(s => s.test.test(text));
  if (alone) return { section: alone, number: leadingNumber(text) };
  const inl = INLINE.find(s => s.test.test(text));
  if (inl) return { section: inl, number: leadingNumber(text) };
  return null;
}

/** The "2" of "2 | METHODS" or "2.6 | Materials", for the parent map. */
function leadingNumber(line) {
  const m = line.match(/^\d+(?:\.\d+)*/);
  if (!m) return null;
  return { top: m[0].split(".")[0], hasSub: m[0].includes(".") };
}

// A table or figure block. A caption opens one and the next section heading
// closes it.
//
// This matters because a tool named inside a comparison table is a row in a
// survey, not a method the authors performed. cit-000513 lists GLAD in
// "Table 1. Cont." among glycan-data resources; the table happened to sit under
// a Methods heading, so a section test alone would have offered it as Tier A —
// precisely the overstatement §1.3 forbids.
// Require the number to be followed by a stop and then a capital or "Cont." —
// what a caption looks like. Without that, a wrapped line beginning "Fig. 3)."
// mid-sentence would open a bogus table block and hide real mentions.
const CAPTION = /^(?:supplementary\s+|supp\.?\s+|extended\s+|online\s+)?(?:table|fig(?:ure)?\.?|box|scheme)\s+[A-Za-z]?\d+(?:\.\d+)?\s*[.:]\s*(?:cont\b|[A-Z(]|$)/i;

/**
 * Reference-list detector built from the applicant's own titles.
 *
 * A citing paper's bibliography contains the full title of the work it cites,
 * which no sentence of prose repeats. "GLAD: GLycan Array Dashboard, a Visual
 * Analytics Tool for Glycan Microarrays." appearing in a Discussion section is
 * therefore a reference entry that ran past the References heading, not a
 * mention — which is how cit-000536 read as a Tier C usage.
 *
 * The signature is the distinctive middle of the title: what follows the colon
 * where a title has one ("GLAD: GLycan Array Dashboard, …"), else its first six
 * words. Compared case- and punctuation-insensitively.
 */
function titleSignatures(titles) {
  const norm = s => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const out = [];
  for (const t of titles) {
    if (!t) continue;
    const colon = t.indexOf(":");
    let words = (colon > 0 && colon < 40 ? t.slice(colon + 1) : t).split(/\s+/).filter(Boolean);
    // Drop a leading article so "a visual analytics tool" matches either way.
    while (words.length && /^(a|an|the)$/.test(words[0])) words = words.slice(1);
    words = words.slice(0, 6);
    if (words.length < 4) continue;
    const sig = norm(words.join(" "));
    if (sig.length >= 20) out.push(sig);
  }
  return out;
}

function isReferenceEntry(text, signatures) {
  const norm = s => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const t = norm(text);
  if (signatures.some(sig => t.includes(sig))) return true;
  // A numbered bibliography line, or a line carrying a locator.
  return /^\[?\d+\]?[\s.]*[A-Z]/.test(text) || /doi|pmid|pmcid/i.test(text);
}

async function extractPages(file) {
  const lib = await loadPdfjs();
  // Hand pdf.js the bytes, not a path: a Windows path handed to `url:` is read
  // as a relative URL and resolves against the process cwd.
  const data = new Uint8Array(fs.readFileSync(file));
  const doc = await lib.getDocument({
    data,
    ...lib._assetDirs,
    useWorkerFetch: false,
    isEvalSupported: false,
    disableFontFace: true,
  }).promise;
  const pages = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    // Rebuild lines by y position so headings survive as short standalone lines.
    const lines = [];
    let cur = null;
    for (const it of tc.items) {
      const y = Math.round(it.transform[5]);
      if (!cur || Math.abs(cur.y - y) > 3) {
        cur = { y, text: "" };
        lines.push(cur);
      }
      cur.text += it.str;
    }
    pages.push(lines
      .map(l => ({ y: l.y, text: l.text.replace(/\s+/g, " ").trim() }))
      .filter(l => l.text.length));
  }
  await doc.destroy();
  return pages;
}

/**
 * Whether a line is a row of a table or figure rather than prose.
 *
 * The layout route was tried and abandoned: pdf.js hands back one item per
 * CELL, so a table row's fragments abut exactly like prose words and the
 * horizontal-gap test measured 0 on the resource tables while prose measured
 * 2–5. Measured over all 19 stored papers before choosing this rule.
 *
 * What does separate them is the page plus the shape of the line. A table page
 * announces itself with a caption in its first lines, and a row inside it reads
 * like a cell: a URL, or a bracketed reference number, or the item name alone at
 * the left margin. Prose that merely cites "[12]" or names a URL mid-sentence is
 * left alone unless it sits on such a page.
 *
 * Getting this wrong is not cosmetic. A tool listed in a comparison table is a
 * row in somebody's survey, not a method the citing authors performed, and
 * offering that as Tier A is the overstatement §1.3 forbids.
 */
function isTableLine(L, ctx) {
  if (!ctx.earlyCaption) return false;
  return URLISH.test(L.text) || BRACKET_REF.test(L.text) || ctx.toolAtLeft(L.text);
}

// A caption in the first lines of a page means the page is built around a table
// or figure. Bounded to the page on purpose: an unbounded "caption opens a
// block" rule once hid genuine Methods prose further down the document.
function earlyCaption(pageLines) {
  for (let i = 0; i < Math.min(pageLines.length, 5); i++) {
    if (CAPTION.test(pageLines[i].text)) return true;
  }
  return false;
}

const URLISH = /(?:https?:\/\/|\bwww\.[a-z0-9.-]+\.[a-z]{2,}|[\w.-]+\.(?:org|com|edu|gov|asia|io|net)\/)/i;
const BRACKET_REF = /\[\s*\d+\s*\]/;

/**
 * Whether a page is a reference list, judged from the page itself rather than
 * from a heading.
 *
 * Journals put the word "References" anywhere — sometimes on the page before the
 * list starts, sometimes in a running head that never gets extracted — so a
 * mention deep in a bibliography was being filed under whatever section heading
 * appeared last, which made a reference entry read like a Discussion citation.
 * A list of numbered entries is unambiguous, so count them instead of trusting
 * the heading. Requires several entries AND a large share of the page, so a
 * Methods section with a short numbered list of reagents is not mistaken for one.
 */
const BIB_ENTRY = /^(?:\[\s*\d+\s*\]|\d+\.\s+[A-Z][a-z]+\s*,?\s+[A-Z]\.?)/;
const BIB_LOCATOR = /\bdoi\b|\bcrossref\b|\bpmid\b|\bpmcid\b|\bhttps?:\/\//i;
const BIB_VOLUME = /\d{4}\s*[;,]\s*\d{1,3}\s*\(|\bvol\.?\s*\d/i;

function isReferencePage(pageLines) {
  let entries = 0, locators = 0;
  for (const l of pageLines) {
    if (BIB_ENTRY.test(l.text)) entries++;
    if (BIB_LOCATOR.test(l.text) || BIB_VOLUME.test(l.text)) locators++;
  }
  // Thresholds sit in the measured gap, not at either end: across the stored
  // papers, reference pages read 7–39 entries at density 0.14–0.46 with locators,
  // while prose pages — including Methods pages that cite "[128]" or print a DOI
  // in a sentence — never exceeded 1 entry at density 0.03.
  return entries >= 5 && entries >= pageLines.length * 0.08 && locators >= 2;
}

/**
 * Which section each line falls in.
 *
 * Two passes, because a numbered subsection heading does not name its section:
 * "2.6 | Glycan array analysis" sits inside Methods only because "2 | METHODS"
 * appeared earlier. The first pass records which section each top-level number
 * belongs to; the second assigns every line the section of the last heading,
 * resolving a subsection through that map.
 */
function sectionMap(pages) {
  const flat = [];
  for (let p = 0; p < pages.length; p++) {
    for (let i = 0; i < pages[p].length; i++) {
      flat.push({ page: p + 1, line: i, text: pages[p][i].text, y: pages[p][i].y });
    }
  }

  // Per-page character of the page: a reference list, or a table built around an
  // early caption. Computed once per page, from the whole page.
  const ctx = pages.map(ls => {
    const refPage = isReferencePage(ls);
    const cap = earlyCaption(ls);
    return { refPage, earlyCaption: cap, toolAtLeft: toolAtLeftFor(ls) };
  });

  // Pass 1 — number -> section, from headings that name both. Also collect the
  // numbers that have subsections beneath them, used below to tell a genuine
  // top-level heading from a table row that happens to start with a digit.
  const numToSection = new Map();
  const hasSubsections = new Set();
  for (const L of flat) {
    const h = headingOf(L.text);
    if (h && h.number && !h.number.hasSub) numToSection.set(h.number.top, { id: h.section.id, rank: h.section.rank });
    const sub = untrack(L.text).match(/^(\d+)\.\d/);
    if (sub) hasSubsections.add(sub[1]);
  }

  // A top-level numbered heading the section list does not know, e.g. a review
  // article's "5. Glycan-Protein Interaction Databases". Recognising it matters:
  // carrying on with the last known heading would claim a section the paper never
  // printed, and a section the paper never printed is a claim nobody can check.
  //
  // Restricted to numbers that have subsections beneath them, because a short
  // line beginning with a digit is also what a table row looks like — "5
  // Galb1-3GalNAca1-3(Fuca1-2)Galb1-4GlcNAc-Sp0 239 ± 28" (cit-000544 p.25) and
  // "1 Status of proteins" (cit-000536 p.7) both match the shape and neither is
  // a heading. A number with "N.M" lines under it is a section; a bare number in
  // a results table is not.
  const genericHeads = new Map();
  for (const L of flat) {
    if (L.text.length > 60 || headingOf(L.text)) continue;
    const t = untrack(L.text);
    const m = t.match(/^(\d+)\.?(?:\s*\|\s*|\s+)([A-Z][^.]*)$/);
    if (!m || !hasSubsections.has(m[1])) continue;
    if (!subsectionTitle(m[2], /\|/.test(m[0]))) continue;
    if (numToSection.has(m[1])) continue;   // a real section name wins
    genericHeads.set(`${L.page}:${L.line}`, { id: `Section ${m[1]}: ${m[2].trim()}`, rank: "?" });
  }

  // Pass 2 — the last heading seen governs until the next one.
  let cur = { id: "front matter", rank: "?" };
  const out = [];
  for (const L of flat) {
    const c = ctx[L.page - 1];
    const h = headingOf(L.text);
    if (h) cur = { id: h.section.id, rank: h.section.rank };
    else {
      const g = genericHeads.get(`${L.page}:${L.line}`);
      if (g) cur = g;
      else if (L.text.length <= 60) {
        // A numbered subsection inherits its parent's section.
        const t = untrack(L.text);
        const m = t.match(/^(\d+)((?:\.\d+)+)(\s*\|\s*|\s+)(.+)$/);
        if (m && numToSection.has(m[1]) && subsectionTitle(m[4], /\|/.test(m[3]))) {
          cur = numToSection.get(m[1]);
        }
      }
    }
    // A page that is a reference list settles the section regardless of what
    // heading was last seen, and outranks it: the heading may be pages away.
    const section = c.refPage ? "References" : cur.id;
    const rank = c.refPage ? "REF" : cur.rank;
    out.push({ ...L, section, rank, inTable: isTableLine(L, c) });
  }
  return out;
}

/**
 * The tool names that appear at the left margin of a page, i.e. in the first
 * ~30 characters of several lines. That is where a name column lives.
 *
 * Built per page because "at the left" is only meaningful against the page's own
 * lines: a prose sentence that happens to open with the tool name is one
 * occurrence, whereas a table's name column repeats the position across rows.
 */
function toolAtLeftFor(pageLines) {
  const atLeft = new Set();
  for (const tool of TOOLS) {
    const hits = pageLines.filter(l => {
      const head = l.text.slice(0, 30);
      return tool.pats.some(p => p.test(head));
    });
    if (hits.length >= 2) atLeft.add(tool.key);
  }
  return text => {
    const head = text.slice(0, 30);
    for (const tool of TOOLS) {
      if (atLeft.has(tool.key) && tool.pats.some(p => p.test(head))) return true;
    }
    return false;
  };
}

function sentenceAround(text) {
  const i = text.search(/\bGLAD\b|glyco\s*glyph|glycoglyph|\bMAWE\b|glyco[- ]?spot/i);
  if (i < 0) return text.slice(0, 300);
  const start = Math.max(0, text.lastIndexOf(". ", Math.max(0, i - 2)));
  const endRel = text.slice(i).search(/\.\s|\.$/);
  const end = endRel < 0 ? text.length : i + endRel + 1;
  return text.slice(start, end).trim();
}

/**
 * The applicant's paper a row cites, as a tool the scanner can look for.
 *
 * §5 requires a row's classification to come from its own `cites_id`: "the fact
 * that GLAD appears in Methods says nothing about where GlycoGlyph appears".
 * Rows imported from the citation summary all carried the folder's single reading,
 * so the Vasta folder put "Methods p.2" on a row citing GlycoGlyph. Resolving each
 * row's tool here lets each row be located where its own tool actually sits.
 *
 * A cited paper that is not one of the four tools — a review, or an earlier
 * methods chapter — has no tool to look for, and the caller says so rather than
 * borrowing another tool's location. The rule itself lives in lib.js so the
 * importer, the promotion script and this scanner cannot drift apart.
 */
const toolForCitedPaper = toolForCitedPaperFromLib;

async function scanFile(abs, signatures) {
  const pages = await extractPages(abs);
  const lines = sectionMap(pages);
  const found = [];
  for (let i = 0; i < lines.length; i++) {
    const L = lines[i];
    // Every tool the line names, not the first: "results were analyzed by GLAD
    // and glycans drawn using GlycoGlyph" is one line and two locations.
    const tools = TOOLS.filter(t => t.pats.some(p => p.test(L.text)));
    if (!tools.length) continue;
    // Gather the paragraph: this line plus neighbours on the same page, so the
    // quote is a readable sentence rather than a wrapped fragment. Neighbours on
    // a different page are excluded — a page break is not a paragraph join.
    const samePage = n => lines[n] && lines[n].page === L.page;
    const para = [samePage(i - 1) && lines[i - 1].text, L.text, samePage(i + 1) && lines[i + 1].text].filter(Boolean).join(" ");
    found.push({
      tools: tools.map(t => t.label), page: L.page, section: L.section, rank: L.rank,
      quote: sentenceAround(para).slice(0, 600),
      looksLikeReference: L.rank === "REF" || isReferenceEntry(L.text, signatures),
      inTable: !!L.inTable,
    });
  }
  return { pageCount: pages.length, found };
}

async function main() {
  const db = openPacket();
  const folders = (ONLY ? [ONLY] : db.prepare(`SELECT DISTINCT folder_uid FROM file`).all().map(r => r.folder_uid));
  console.log(`scanning ${folders.length} folder(s)`);

  // The applicant's own titles, so a bibliography entry that restates one can be
  // recognised as a citation and not as a use of the tool.
  const signatures = titleSignatures(
    db.prepare(`SELECT DISTINCT cited_paper FROM citation WHERE COALESCE(cited_paper,'') <> ''`).all().map(r => r.cited_paper)
      // Also the tool names themselves, which appear in every reference entry.
      .concat(["a glycan visualizing and drawing tool", "glycan array dashboard", "microwave assisted wet-erase", "glycan microarray"])
  );

  // The scanner records WHERE a mention sits. It does not decide inclusion: a
  // tier is a claim about how the tool was used, and the packet's `included`
  // rows already carry tiers the applicant read out of the papers themselves.
  // Those are never overwritten — the scanner only reports a disagreement, so a
  // person can look at the page and decide which reading stands. Two statements,
  // because a single UPDATE keyed on status would quietly no-op the other case.
  const upd = db.prepare(`UPDATE citation SET tier=?, section=?, page=?, quote=?, evidence_basis=?
    WHERE row_uid=? AND status='held'`);
  // For a row whose recorded tier the scan agrees with, fill the location and the
  // verbatim sentence the packet must quote. Never touches tier, section or the
  // evidence basis, and never replaces a quote that is already there.
  const backfill = db.prepare(`UPDATE citation SET page=COALESCE(page,?), quote=COALESCE(quote,?)
    WHERE row_uid=? AND status='included'`);
  const candUpd = db.prepare(`UPDATE candidate SET section_found=?, quote=?, quote_page=?, screen_state=? WHERE row_uid=?`);
  // The scanner's own reading, written on EVERY row it can read, whatever its
  // status. It never touches `tier`/`section`/`quote` (the applicant's fields),
  // and it is always rewritten so a stale verdict from an earlier rule cannot
  // outlive the run. This is what lets PACKET-STATUS.md report a disagreement
  // after the console has scrolled past.
  const scanUpd = db.prepare(`UPDATE citation SET scan_tier=?, scan_note=?, scanned_on=? WHERE row_uid=?`);
  const TODAY = new Date().toISOString().slice(0, 10);

  // Three distinct findings, counted apart. They used to share one counter, which
  // made the summary line say "6 disagreement(s) with a recorded tier" when only
  // one row was a disagreement in the sense a person would understand: the scan
  // found the tool in a ranked section and read a DIFFERENT tier. The other two
  // are "the text does not support the recorded tier" (nothing usable found), and
  // that also fires on `held` rows, which carry no tier claim for counsel. A
  // number that conflates them cannot be compared against a query of the database.
  let scanned = 0, located = 0, notFound = 0;
  let tierDiffers = 0, unsupported = 0;
  for (const folder of folders) {
    const files = db.prepare(`SELECT * FROM file WHERE folder_uid=? AND cited=1 ORDER BY file`).all(folder);
    const hits = [];
    let unread = 0;
    for (const f of files) {
      const abs = path.join(PKT, f.file);
      if (!fs.existsSync(abs)) { console.log(`  ! missing ${f.file}`); unread++; continue; }
      try {
        const r = await scanFile(abs, signatures);
        for (const h of r.found) hits.push({ ...h, file: f.file });
      } catch (err) {
        console.log(`  ! ${f.file}: ${err.message}`);
        unread++;
      }
    }
    if (unread === files.length && files.length) continue;   // nothing was readable
    scanned++;

    // One verdict per ROW, not per folder. §5: a row's tier, section, page and
    // quote describe the use of *that row's* tool, so the Vasta paper citing
    // GlycoGlyph must not inherit the location of the GLAD mention.
    const rows = db.prepare(`SELECT row_uid, status, is_main, tier, evidence_basis, cited_paper, quote
      FROM citation WHERE folder_uid=? ORDER BY is_main DESC, row_uid`).all(folder);

    if (!hits.length) {
      notFound++;
      // "Not in the text" is a finding only when the extract worked. A file that
      // failed to open says nothing, so this branch means the extract succeeded
      // and the tools genuinely do not appear.
      console.log(`${folder}: no mention of the applicant's tools found in the extracted text`);
      for (const r of rows) {
        if (r.tier) {
          unsupported++;
          console.log(`    ${r.row_uid}: recorded tier ${r.tier} (basis: ${r.evidence_basis || "unstated"}) is not in the extracted text at all — confirm the PDF is the full article`);
        }
        if (!DRY && r.status === "held") {
          upd.run(null, null, null, null,
            "Scanner: no mention of GLAD / GlycoGlyph / MAWE / Glyco-SPOT in the extracted text — check the PDF is the full article", r.row_uid);
        }
      }
      if (!DRY) candUpd.run(null, null, null, "held", folder);
      continue;
    }
    located++;

    if (DEBUG) {
      for (const h of hits) {
        const why = h.looksLikeReference ? "reference entry"
          : h.inTable ? "table/figure block"
          : (h.rank === "?" ? "no section heading seen" : h.rank === "REF" ? "References section" : "usable");
        console.log(`      [${why}] ${h.tools.join("+")} ${h.file.split("/").pop()} p.${h.page} ${h.quote.slice(0, 90)}`);
      }
    }

    const parts = [];
    for (const r of rows) {
      const want = toolForCitedPaper(r.cited_paper);
      // Tier from the strongest place that tool's mention actually sits in PROSE:
      // not a reference entry, not a table cell, and under a heading the paper
      // itself printed.
      const mine = want ? hits.filter(h => h.tools.includes(want)) : [];
      const usable = mine.filter(h => !h.looksLikeReference && !h.inTable && h.rank !== "?" && h.rank !== "REF");
      const best = usable.sort((a, b) => "ABCD".indexOf(a.rank) - "ABCD".indexOf(b.rank))[0] || null;
      const tier = best ? best.rank : null;
      const where = mine.map(h => `${h.section} p.${h.page}`).join(", ");
      parts.push(`${want || "no tool"}: ${mine.length} mention(s)${mine.length ? ` (${where})` : ""}${best ? ` -> tier ${tier} ${best.section} p.${best.page}` : " -> unresolved"}`);

      // Record what the scan read, on every row, before any branch decides what
      // to do about it.
      if (!DRY) {
        scanUpd.run(tier,
          best ? `${best.section} p.${best.page}: ${best.quote}`
            : mine.length
              ? `${mine.length} appearance(s) of ${want}, none in a section the paper ranked: ${where}`
              : want
                ? `${want} does not appear in the extracted text`
                : `this row cites "${r.cited_paper}", which is not one of the four tools`,
          TODAY, r.row_uid);
      }

      if (!best) {
        if (r.tier) {
          unsupported++;
          console.log(`    ${r.row_uid}: recorded tier ${r.tier} (basis: ${r.evidence_basis || "unstated"}) is not supported by the extracted text — every mention of ${want || "its cited paper"} is a reference entry, a table, or under a heading the paper did not rank`
            + (r.status === "included" ? "; the row is `included`, so a person should re-read the page" : ""));
        }
        // Write unconditionally for a held row. A row whose only mentions are
        // reference entries must have any earlier verdict CLEARED, not left
        // behind: before reference pages were recognised this tool filed
        // "tier A, Methods p.20" for cit-000513 from a row of a comparison table,
        // and writing only on a positive verdict would keep that overstatement.
        if (!DRY && r.status === "held") {
          upd.run(null, null, null, mine.length ? mine[0].quote : null,
            want
              ? `Scanner: ${want} appears only in the reference list${mine.some(h => h.inTable) ? ", a table, or" : "or"} an unranked section — no section of the citing paper uses it as a method${mine.length ? ` (appearance: ${mine[0].section} p.${mine[0].page})` : ""}`
              : `Scanner: this row cites "${r.cited_paper}", which is not one of the four tools, so the text scan has nothing to locate`,
            r.row_uid);
        }
        continue;
      }

      if (r.status === "included") {
        // Never overwrite a tier the applicant read out of the paper. Report a
        // disagreement instead, so a person can look at the page and decide.
        if (r.tier && r.tier !== tier) {
          tierDiffers++;
          console.log(`    ${r.row_uid}: recorded tier ${r.tier} (basis: ${r.evidence_basis || "unstated"}) but ${want} reads tier ${tier} (${best.section} p.${best.page}) in ${best.file} — check the page`);
        } else {
          // The tier agrees, so the location the scan found is safe to record
          // beside it. Fills only what is missing: a page or quote the applicant
          // wrote stands, and the recorded section is never replaced.
          if (!DRY) backfill.run(String(best.page), best.quote, r.row_uid);
        }
        continue;
      }

      if (!DRY && r.status === "held") {
        upd.run(tier, best.section, String(best.page), best.quote,
          `Scanner: mention found in the ${best.section} section of ${best.file}, page ${best.page}`, r.row_uid);
      }
    }
    console.log(`${folder}: ${parts.join(" | ")}`);
    if (!DRY) candUpd.run(parts.join(" | "), null, null, "held", folder);
  }
  console.log(`\nscanned ${scanned} folder(s): ${located} with a mention, ${notFound} without.`);
  console.log(`${tierDiffers} tier disagreement(s): the scan found the tool in a ranked section and read a different tier than the row records.`);
  console.log(`${unsupported} row(s) with a recorded tier the text does not support (no usable mention, or no mention at all).`);
  console.log("  Note: `unsupported` includes `held` rows, whose tier may be one this scanner wrote itself; it is not a count of claims in the packet.");
  db.close();
}
main();

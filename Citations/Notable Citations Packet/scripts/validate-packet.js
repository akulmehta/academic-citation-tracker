"use strict";
/**
 * Mechanical checks from §7 of notable-citations.instruction-draft.md.
 *
 * Read-only: this script never writes to the packet, the database, or the record.
 * It exits non-zero if any check fails, so it can gate a hand-off.
 *
 *   node scripts/validate-packet.js          # all checks
 *   node scripts/validate-packet.js --quiet  # failures only
 *   node scripts/validate-packet.js --deep   # also re-read every PDF and confirm
 *                                            # each filed quote is really in it
 */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { PKT, REPO, openPacket, openCatalog, headlineTier, originalApplicationUids, folderRoots, STORAGE_ROOTS, ROOT_PENDING, ROOT_SCREENED, toolForCitedPaper, surnameSlug, potentialIndependent } = require("./lib.js");

const QUIET = process.argv.includes("--quiet");
const DEEP = process.argv.includes("--deep");
const failures = [];
const warnings = [];
const notes = [];

function fail(check, detail) { failures.push([check, detail]); }
function warn(check, detail) { warnings.push([check, detail]); }
function note(check, detail) { notes.push([check, detail]); }

const db = openPacket();
const cits = db.prepare(`SELECT * FROM citation`).all();
const files = db.prepare(`SELECT * FROM file`).all();
const byUid = new Map(cits.map(r => [r.row_uid, r]));
const included = cits.filter(r => r.status === "included");
const held = cits.filter(r => r.status === "held");

/* ------------------------------------------------------------------ */
/* 1. The read-only boundary (§0)                                       */
/* ------------------------------------------------------------------ */
// The Independent Citation Record must show no change attributable to this work.
// Anything dirty in the repo that is NOT under the packet folder is reported.
{
  let dirty = [];
  try {
    const out = execFileSync("git", ["-C", REPO, "status", "--porcelain"], { encoding: "utf8" });
    dirty = out.split(/\r?\n/).filter(Boolean);
  } catch (err) {
    warn("boundary", `git status failed (${err.message}) — could not verify the read-only boundary`);
  }
  const PKT_REL = path.relative(REPO, PKT).split(path.sep).join("/");
  const outside = dirty.filter(l => {
    const p = l.slice(3).replace(/^.*-> /, "").split("/").slice(0, 2).join("/");
    return !p.startsWith(PKT_REL) && !l.includes("Notable Citations Packet");
  });
  const record = outside.filter(l => /tools\/|Database\/|dashboard\/|Independent Citation Record\//.test(l));
  if (record.length) {
    fail("boundary", `${record.length} change(s) outside the packet in the Independent Citation Record:`);
    for (const l of record.slice(0, 12)) fail("boundary", `    ${l}`);
  } else if (!QUIET) {
    note("boundary", "no changes to tools/, Database/, dashboard/ or Independent Citation Record/");
  }
}

/* ------------------------------------------------------------------ */
/* 2. CSVs are exports and account for every row                        */
/* ------------------------------------------------------------------ */
{
  const need = ["packet.csv", "screened-out.csv", "packet-files.csv", "packet.html"];
  for (const n of need) {
    const p = path.join(PKT, n);
    if (!fs.existsSync(p)) fail("csv", `${n} does not exist — run scripts/render-packet.js --write`);
  }
  // RFC 4180 parsing, NOT a split on newlines. The `notes` column legitimately
  // holds multi-paragraph text, which a compliant writer puts inside double
  // quotes with the newlines intact. Splitting the file on line breaks turns one
  // record into several and invents rows that are really the tail of a note —
  // which is exactly what it did, reporting a note fragment as a row_uid.
  function parseCsv(txt) {
    const rows = [];
    let row = [], field = "", quoted = false;
    for (let i = 0; i < txt.length; i++) {
      const ch = txt[i];
      if (quoted) {
        if (ch === '"') {
          if (txt[i + 1] === '"') { field += '"'; i++; } else quoted = false;
        } else field += ch;
        continue;
      }
      if (ch === '"') { quoted = true; continue; }
      if (ch === ",") { row.push(field); field = ""; continue; }
      if (ch === "\r") { if (txt[i + 1] === "\n") i++; row.push(field); field = ""; if (row.length > 1 || row[0] !== "") rows.push(row); row = []; continue; }
      if (ch === "\n") { row.push(field); field = ""; if (row.length > 1 || row[0] !== "") rows.push(row); row = []; continue; }
      field += ch;
    }
    if (field !== "" || row.length) { row.push(field); if (row.length > 1 || row[0] !== "") rows.push(row); }
    return rows;
  }
  const read = n => {
    const p = path.join(PKT, n);
    if (!fs.existsSync(p)) return null;
    const rows = parseCsv(fs.readFileSync(p, "utf8"));
    return { header: rows[0] || [], rows: rows.slice(1) };
  };
  const p1 = read("packet.csv"), p2 = read("screened-out.csv");
  if (p1 && p2) {
    const n = p1.rows.length + p2.rows.length;
    if (n !== cits.length) fail("csv", `packet.csv (${p1.rows.length}) + screened-out.csv (${p2.rows.length}) = ${n}, but table citation has ${cits.length} rows`);
    const uids = [...p1.rows, ...p2.rows].map(r => r[0]).filter(Boolean);
    for (const u of uids) if (!byUid.has(u)) fail("csv", `${u} appears in a CSV but not in table citation`);
    if (!QUIET) note("csv", `${n} citation rows exported across the two CSVs`);
  }
  const pf = read("packet-files.csv");
  if (pf) {
    if (pf.rows.length !== files.length) fail("csv", `packet-files.csv has ${pf.rows.length} rows but table file has ${files.length}`);
    // §4.4: the export is table `file`, whose own columns are the point — a file
    // row without its path cannot say which storage root the PDF lives in.
    const want = ["folder_uid","file","source_pdf","role","shows_date","date_basis","cited","bytes"];
    if (pf.header.join(",") !== want.join(",")) {
      fail("csv", `packet-files.csv has the wrong header: expected ${want.join(", ")} (table file's own columns, §4.4), got ${pf.header.join(", ")}`);
    } else {
      const csvPaths = new Set(pf.rows.map(r => r[1]));
      const missing = files.filter(f => !csvPaths.has(f.file));
      if (missing.length) fail("csv", `${missing.length} file row(s) not in packet-files.csv by path: ${missing.slice(0, 4).map(f => f.file).join(", ")}`);
    }
  }
}

/* ------------------------------------------------------------------ */
/* 3. Screen reasons and held rows                                      */
/* ------------------------------------------------------------------ */
for (const r of cits.filter(x => x.status === "screened-out")) {
  if (!r.screen_reason) fail("screen", `${r.row_uid} is screened-out with no screen_reason`);
}
if (held.length) {
  const status = path.join(PKT, "PACKET-STATUS.md");
  if (!fs.existsSync(status)) {
    fail("screen", `${held.length} row(s) are held but PACKET-STATUS.md does not exist`);
  } else {
    const txt = fs.readFileSync(status, "utf8");
    const missing = held.filter(r => !txt.includes(r.row_uid));
    if (missing.length) fail("screen", `${missing.length} held row(s) not listed as open items in PACKET-STATUS.md: ${missing.map(r => r.row_uid).join(", ")}`);
  }
}

/* ------------------------------------------------------------------ */
/* 4. PDF naming, presence, magic bytes, byte counts                    */
/* ------------------------------------------------------------------ */
// §5.1: NN-role-Surname[-date].pdf, the citing senior author's surname in the
// name, and the folder sitting in the root its status implies — `papers/` for a
// citation in the packet, `pending-papers/` for one awaiting the applicant's
// decision, `screened-papers/` for one decided against.
const NAME_RE = /^\d{2}-[a-z][a-z-]+-.+\.pdf$/;
const ROOTS = STORAGE_ROOTS;
{
  const roots = folderRoots(db);
  const listed = new Set(files.map(f => f.file));
  for (const f of files) {
    const base = path.basename(f.file);
    if (!NAME_RE.test(base)) fail("pdf-name", `${f.file} does not look like NN-role-Surname[-date].pdf`);
    const root = f.file.split("/")[0];
    if (!ROOTS.includes(root)) fail("pdf-name", `${f.file} is not under ${ROOTS.join(", ")}`);
    else if (roots.has(f.folder_uid) && root !== roots.get(f.folder_uid)) {
      fail("pdf-root", `${f.file} sits in ${root}/ but its rows put the folder in ${roots.get(f.folder_uid)}/ — run node scripts/relocate-pdfs.js --write`);
    }
    const abs = path.join(PKT, f.file);
    if (!fs.existsSync(abs)) { fail("pdf-file", `${f.file} is listed but does not exist on disk`); continue; }
    const buf = fs.readFileSync(abs);
    if (buf.subarray(0, 4).toString("latin1") !== "%PDF") fail("pdf-file", `${f.file} does not start with %PDF`);
    if (f.bytes !== buf.length) fail("pdf-file", `${f.file}: bytes=${f.bytes} but the file on disk is ${buf.length}`);
    // The surname must be the senior author of a citation row in this folder.
    const rows = cits.filter(c => c.folder_uid === f.folder_uid);
    const names = rows.map(c => c.citing_senior_author).filter(Boolean);
    if (names.length) {
      // Fold the surname the same way the file name was built. `lib.surnameSlug`
      // is what named the file, and NFD alone is not enough: `ł` (U+0142) has no
      // decomposition, so stripping combining marks deleted it and turned
      // "Zasłona" into "Zasona", which no file name can contain. That reported a
      // correctly named PDF as a defect.
      const flat = s => surnameSlug(s).replace(/[^A-Za-z]/g, "").toLowerCase();
      const hit = names.some(n => base.toLowerCase().includes(flat(n)));
      if (!hit) fail("pdf-name", `${f.file} does not contain the citing senior author's surname (${names.join(" / ")})`);
    }
  }
  // Nothing loose in a storage root, and every folder on disk is a folder_uid.
  for (const root of ROOTS) {
    const abs = path.join(PKT, root);
    if (!fs.existsSync(abs)) continue;
    for (const e of fs.readdirSync(abs, { withFileTypes: true })) {
      if (e.isFile()) fail("pdf-loose", `${e.name} sits loose in ${root}/ — §5.1 wants one sub-folder per citing work`);
      else if (!cits.some(c => c.folder_uid === e.name)) fail("pdf-folder", `${root}/${e.name}/ is not the folder_uid of any citation row`);
      else if (roots.get(e.name) !== root) fail("pdf-root", `${root}/${e.name}/ is in the wrong root; its rows say ${roots.get(e.name)}/`);
    }
  }
  for (const f of files) if (!byUid.has(f.folder_uid)) fail("pdf-folder", `file ${f.file} names folder_uid ${f.folder_uid}, which is not a citation row`);
  for (const r of included) {
    if (!r.pdf_file) continue;
    if (!files.some(f => f.folder_uid === r.folder_uid)) fail("pdf-folder", `included row ${r.row_uid} records a pdf_file but its folder has no file row`);
  }
  // §5.1: a citation in the packet has its PDF in the folder. A row counsel is
  // told to read but cannot open is worse than a row that is simply absent, so
  // this fails even when the row's own pdf_file column is empty. Only `papers/`
  // counts: a held work's PDF is filed under `pending-papers/` until the
  // applicant confirms it, and it is listed in PACKET-STATUS.md instead.
  for (const folder of new Set(included.map(r => r.folder_uid))) {
    if (!files.some(f => f.folder_uid === folder)) {
      fail("pdf-missing", `folder ${folder} is in the packet but holds no PDF — counsel cannot check what the packet asserts about it`);
    }
  }
  if (!failures.some(f => f[0].startsWith("pdf-")) && !QUIET) note("pdf", `${files.length} file(s) checked: name, root, presence, %PDF magic, byte count, surname`);
}

/* ------------------------------------------------------------------ */
/* 5. folder_uid is a MAIN row; additional uids are the same article    */
/* ------------------------------------------------------------------ */
for (const r of cits) {
  const folder = byUid.get(r.folder_uid);
  if (!folder) fail("folder", `${r.row_uid} points at folder_uid ${r.folder_uid}, which is not a row`);
  else if (!folder.is_main) fail("folder", `${r.row_uid}'s folder_uid ${r.folder_uid} is not a main row (§5.1)`);
  if (r.is_main && r.folder_uid !== r.row_uid) fail("folder", `main row ${r.row_uid} is filed under ${r.folder_uid} instead of its own uid`);
}
{
  // Rows sharing a folder must be the same citing work. A shared normalised
  // title is the easy case. The Heras folder is the deliberate exception: one
  // work listed twice by Scholar under its preprint title and its journal
  // title, which is exactly why that folder exists (25 Apr 2024 filing date).
  // So a title difference is allowed only when the folder actually carries the
  // preprint/article pair that proves it, and the senior author and the cited
  // paper still have to agree — those are what make it one citation.
  const norm = s => (s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const filesByFolder = new Map();
  for (const f of files) {
    if (!filesByFolder.has(f.folder_uid)) filesByFolder.set(f.folder_uid, []);
    filesByFolder.get(f.folder_uid).push(f);
  }
  const groups = new Map();
  for (const r of cits) {
    if (!groups.has(r.folder_uid)) groups.set(r.folder_uid, []);
    groups.get(r.folder_uid).push(r);
  }
  for (const [folder, rows] of groups) {
    if (rows.length < 2) continue;
    const authors = new Set(rows.map(r => (r.citing_senior_author || "").toLowerCase()));
    if (authors.size > 1) fail("folder", `${folder} holds rows with different citing senior authors: ${[...authors].join(" / ")}`);
    // A folder legitimately spans SEVERAL cited papers: one citing article appears
    // on the "cited by" page of every paper it cites, so the same work can be four
    // separate citations. Independence is relative to the cited paper, which is why
    // each row resolves its own `cited_tool` and `cited_paper` (§5). That spread is
    // reported, not rejected — but it means the folder's tier, section and quote are
    // per-row claims, so a row that borrows another row's tool is a defect.
    const cites = new Set(rows.map(r => r.cites_id || ""));
    if (cites.size > 1) {
      const tools = [...new Set(rows.map(r => r.cited_tool || "(none)"))].join(", ");
      note("folder", `${folder} is one citing work filing ${cites.size} separate citations (${tools}). Each row's tier, section and quote describe its own cited paper.`);
      for (const r of rows) {
        if (r.cited_tool && r.tier && !r.section && !r.quote) {
          warn("folder", `${r.row_uid} carries tier ${r.tier} for ${r.cited_tool} with no section and no quote — confirm it is this row's tool, not a sibling's`);
        }
      }
    }
    const titles = new Set(rows.map(r => norm(r.citing_title)));
    if (titles.size > 1) {
      const set = filesByFolder.get(folder) || [];
      const hasPreprint = set.some(f => f.role === "preprint");
      const hasArticle = set.some(f => f.role === "article");
      if (!(hasPreprint && hasArticle)) {
        fail("folder", `${folder} holds ${rows.length} rows whose citing titles differ and the folder has no preprint+article pair to justify it: ${[...titles].map(t => `"${t.slice(0, 50)}"`).join(" vs ")}`);
      } else {
        note("folder", `${folder} is one work under two titles (preprint and journal) — the identity rests on the applicant's note and the DOI chain, not on the title`);
      }
    }
  }
}

/* ------------------------------------------------------------------ */
/* 6. packet.html links                                                 */
/* ------------------------------------------------------------------ */
{
  const p = path.join(PKT, "packet.html");
  if (fs.existsSync(p)) {
    const html = fs.readFileSync(p, "utf8");
    const hrefs = [...html.matchAll(/href="([^"]+)"/g)].map(m => m[1]);
    const listed = new Set(files.map(f => f.file.split("/").join("/")));
    let bad = 0;
    for (const h of hrefs) {
      if (/^file:\/\//i.test(h)) { fail("link", `absolute file:/// href in packet.html: ${h}`); bad++; continue; }
      if (path.isAbsolute(h)) { fail("link", `absolute path href in packet.html: ${h}`); bad++; continue; }
      if (/^https?:/i.test(h)) continue;                       // external, fine
      if (h.startsWith("#")) continue;                          // in-page anchor
      const clean = decodeURIComponent(h.split("#")[0]);
      if (!clean) continue;
      const abs = path.join(PKT, clean);
      // Nothing may resolve outside the packet folder.
      if (!abs.startsWith(PKT + path.sep)) { fail("link", `href escapes the packet folder: ${h}`); bad++; continue; }
      if (!fs.existsSync(abs)) { fail("link", `href target missing: ${h}`); bad++; continue; }
      if (ROOTS.includes(clean.split("/")[0]) && !listed.has(clean)) { fail("link", `${h} is linked but not listed in packet-files.csv`); bad++; }
      // Only confirmed evidence may be linked from the lawyer's packet. A PDF
      // still awaiting a decision lives under `pending-papers/` and belongs on
      // the review page; a screened-out one must not be linked anywhere.
      if (clean.startsWith(ROOT_PENDING + "/") || clean.startsWith(ROOT_SCREENED + "/")) {
        fail("link", `packet.html links ${h}, which is not in the packet — pending work belongs on potential_notable_citations.html and screened-out work nowhere`);
        bad++;
      }
    }
    // Every INCLUDED work's folder must appear in the HTML. A held folder is an
    // open item for the applicant, not evidence for counsel, so it is listed in
    // PACKET-STATUS.md instead (checked above) and deliberately absent here.
    const folders = new Set(included.map(c => c.folder_uid));
    const absent = [...folders].filter(f => !html.includes(f));
    if (absent.length) fail("link", `${absent.length} included folder(s) never appear in packet.html: ${absent.slice(0, 8).join(", ")}`);
    const otherWithFiles = new Map();
    for (const f of files) {
      if (folders.has(f.folder_uid)) continue;
      otherWithFiles.set(f.folder_uid, f.file.split("/")[0]);
    }
    if (otherWithFiles.size && !QUIET) {
      const byRoot = new Map();
      for (const [folder, root] of otherWithFiles) {
        if (!byRoot.has(root)) byRoot.set(root, []);
        byRoot.get(root).push(folder);
      }
      note("link", [...byRoot.entries()].map(([root, list]) =>
        `${list.length} folder(s) hold a PDF but no included row, so they live under ${root}/ and not in the lawyer HTML: ${list.join(", ")}`).join("; "));
    }
    if (!bad && !QUIET) note("link", `${hrefs.length} href(s) checked; all resolve inside the packet folder`);
  }
}

/* ------------------------------------------------------------------ */
/* 7. Quotes are verbatim claims with a page, from a cited file         */
/* ------------------------------------------------------------------ */
// A `quote` is a claim that the citing article wrote these words. Two things can
// break that claim cheaply, and both happened: a folder-wide sentence copied onto
// rows that cite a different paper (caught by record-evidence.js, which re-reads
// the PDF), and the work's own TITLE filed as though it were a sentence. The
// importer took the docx's bold heading, so both Heras rows quoted a string found
// nowhere in the paper. Titles are cheap to detect, so that is checked here; the
// PDF-level check is `node scripts/record-evidence.js --check`, and `--deep` below
// runs it so one command can gate a hand-off.
const normTitle = s => (s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
for (const r of included) {
  if (!r.quote) { warn("quote", `${r.row_uid} is included with no verbatim quote — counsel cannot check it`); continue; }
  if (!r.page) warn("quote", `${r.row_uid} quotes text but records no page of the citing article`);
  const q = normTitle(r.quote);
  if (q && q === normTitle(r.citing_title)) {
    fail("quote", `${r.row_uid}'s "quote" is the citing work's own title — a title is not a sentence from the paper and cannot evidence use of anything`);
  }
  // §1.2 screens out a citation "noting a limitation or drawback", and §1.3 names
  // a hedge as the example of what must not be read as use. Whether a sentence is
  // hedged is a human judgement, so this cannot decide anything — but a quote
  // whose own words say the effect is unclear, or that the authors surpassed the
  // work, should never reach counsel unlabelled.
  const hedge = r.quote.match(/\b(unclear|unknown|remain(?:s)? (?:to be|unclear)|limitation|drawback|caveat|surpass(?:ed)?|outperform(?:ed)?|fail(?:ed)? to|did not (?:improve|increase|match)|cannot (?:be )?(?:determin|conclud))/i);
  if (hedge) {
    warn("quote", `${r.row_uid} quotes hedged or negative language ("${hedge[0]}") while included at tier ${r.tier}${r.use_type ? "" : " with no use_type"} — §1.2/§1.3 ask counsel's call, not silence`);
  }
}
for (const f of files) if (f.folder_uid && f.cited === 0) note("quote", `${f.file} is marked cited=0 (${f.role})`);

/* ------------------------------------------------------------------ */
/* 8. Included rows: not negative, English, not already filed           */
/* ------------------------------------------------------------------ */
for (const r of included) {
  if (r.negative) fail("screen", `${r.row_uid} is included but marked negative`);
  if ((r.language || "English") !== "English") fail("screen", `${r.row_uid} is included but language=${r.language}`);
  if (r.in_original_petition) fail("screen", `${r.row_uid} is included but flagged as already used in the original petition (§3)`);
}
{
  const prior = path.join(REPO, "Citations", "Notable Citations in Original Application", "Original-Application-Citations.md");
  if (!fs.existsSync(prior)) {
    warn("petition", `${prior} not found — cannot check §3 overlap`);
  } else {
    const txt = fs.readFileSync(prior, "utf8").toLowerCase();
    const norm = s => (s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    for (const r of included) {
      const t = norm(r.citing_title);
      if (t.length > 20 && txt.includes(t)) fail("petition", `${r.row_uid} ("${r.citing_title.slice(0, 60)}") appears in the original application's citations — §3 says screen it out`);
    }
  }
}

/* ------------------------------------------------------------------ */
/* 8b. Where the applicant filed the PDF vs the tier recorded           */
/* ------------------------------------------------------------------ */
// The importer takes the tier from the applicant's note and treats the folder as
// a secondary signal. That precedence is deliberate — but when the two disagree
// it is worth a look, because §1.1 says an Acknowledgements mention is not a use
// of the tool at all, and a folder placement is the applicant's own filing act.
// This reports the disagreement; it does not decide it.
{
  const folderTier = p => {
    const s = String(p || "");
    if (/In Acknowledgements/i.test(s)) return "D";
    if (/In Results and Figures/i.test(s)) return "B";
    if (/In high reputation/i.test(s)) return "C";
    if (/In Methods/i.test(s)) return "A";
    return null;
  };
  // A folder is one citing WORK, and a work is filed at the strongest tier any of
  // its citations earns (lib.headlineTier). Comparing the folder against a single
  // row therefore raises a mismatch that is not one: the Guérardel article sits in
  // "In Methods" because it runs GLAD, MAWE and the review there, while its
  // separate citation of the oligomannose-isomer paper is honestly a Discussion use.
  const byFolder = new Map();
  for (const r of cits) {
    if (r.status !== "included") continue;
    if (!byFolder.has(r.folder_uid)) byFolder.set(r.folder_uid, []);
    byFolder.get(r.folder_uid).push(r);
  }
  for (const r of cits) {
    const f = folderTier(r.source_pdf);
    if (!f || !r.tier) continue;
    if (f === r.tier) continue;
    const from = folderLabel(r.source_pdf);
    // The applicant's own decision settles the disagreement, and it is a decision
    // of record (tier_decided_on / tier_decided_note), not a silence.
    if (r.tier_decision) continue;
    // Same for a folder whose label matches the tier the WORK stands at: the row's
    // own weaker tier is a fact about one citation, not a filing error.
    const head = headlineTier(byFolder.get(r.folder_uid));
    if (head && f === head) continue;
    // §1.1 says an Acknowledgements mention is not a use of the tool at all, and
    // the applicant filed this PDF there. But the same applicant's note can also
    // record a Methods sentence — van der Wal does exactly that. Where the row's
    // OWN record carries the support for its tier, the disagreement is reported
    // and left to a person; where it does not, the packet would be asserting a
    // use it cannot show, which is a failure.
    const supports = /^materials and methods$/i.test(String(r.section || "").trim()) && !!String(r.quote || "").trim();
    const msg = `${r.row_uid}: filed from "${from}" (folder implies tier ${f}) but the row carries tier ${r.tier}`;
    if (f === "D" && !supports) {
      fail("tier-folder", msg + ` — §1.1: an Acknowledgements mention is not a use, and the row holds no Methods section or quotation to say otherwise`);
    } else if (f === "D") {
      warn("tier-folder", msg + ` — the applicant filed it as Acknowledgements, yet the row's own note records a Methods sentence; record the call with scripts/record-tier-decision.js`);
    } else {
      warn("tier-folder", msg);
    }
  }
}
function folderLabel(p) {
  const m = String(p || "").match(/Citations\/([^/]+)\//);
  return m ? m[1] : "?";
}

/* ------------------------------------------------------------------ */
/* 9. Every row_uid resolves in the citation record (read-only)         */
/* ------------------------------------------------------------------ */
{
  const cat = openCatalog();
  const have = new Set(cat.prepare(`SELECT row_uid FROM citations`).all().map(r => r.row_uid));
  cat.close();
  const missing = cits.filter(r => !have.has(r.row_uid));
  if (missing.length) fail("catalog", `${missing.length} row_uid(s) do not resolve in Database/citation-catalog.sqlite: ${missing.map(r => r.row_uid).join(", ")}`);
  else if (!QUIET) note("catalog", `all ${cits.length} row_uid(s) resolve in the record (opened read-only)`);}

/* ------------------------------------------------------------------ */
/* 10. Index/section pairing, projects, timeline sets                   */
/* ------------------------------------------------------------------ */
{
  const p = path.join(PKT, "packet.html");
  if (fs.existsSync(p)) {
    const html = fs.readFileSync(p, "utf8");
    for (const r of included) {
      const anchor = `id="c-${r.folder_uid}"`;
      if (!html.includes(anchor)) fail("index", `included citation ${r.folder_uid} has no section anchor (${anchor})`);
    }
  }
}
for (const r of cits) {
  if (r.project == null || r.project === "") {
    if (r.cited_tool) fail("project", `${r.row_uid} cites ${r.cited_tool} but has no project number`);
    else note("project", `${r.row_uid} cites "${(r.cited_paper || "").slice(0, 50)}", which is not one of the four tools — project left blank by design`);
  } else if (!/^[1-4]$/.test(String(r.project))) {
    fail("project", `${r.row_uid} has project="${r.project}", which is not 1–4`);
  }
}
for (const r of cits) {
  if (r.tier && !/^[ABCD]$/.test(String(r.tier))) fail("tier", `${r.row_uid} has tier="${r.tier}", which is not A–D`);
}
{
  // §5.2: a folder with more than one PDF is a timeline set and needs a basis
  // for every date it is being used to prove.
  const counts = new Map();
  for (const f of files) counts.set(f.folder_uid, (counts.get(f.folder_uid) || 0) + 1);
  for (const [folder, n] of counts) {
    if (n < 2) continue;
    const set = files.filter(f => f.folder_uid === folder);
    const noBasis = set.filter(f => !f.date_basis);
    if (noBasis.length) warn("timeline", `${folder} is a ${n}-file timeline set but ${noBasis.length} file(s) carry no date_basis: ${noBasis.map(f => path.basename(f.file)).join(", ")}`);
  }
}

/* ------------------------------------------------------------------ */
/* 11. print/packet.pdf                                                 */
/* ------------------------------------------------------------------ */
{
  const p = path.join(PKT, "print", "packet.pdf");
  if (!fs.existsSync(p)) warn("print", "print/packet.pdf does not exist — §7 wants the packet printed before hand-off");
  else if (fs.statSync(p).size === 0) fail("print", "print/packet.pdf exists but is empty");
}

/* ------------------------------------------------------------------ */
/* 12. prose hygiene: nothing but the article's own account is printed  */
/* ------------------------------------------------------------------ */
// §4.6 splits a narrative row into three kinds of sentence and prints only the
// first. narrative-intake.js refuses advice on the way in, but that guard protects
// writes — it says nothing about the renderer. If someone later points a template
// at preparer_note, or reintroduces an attribution banner, the packet would ship
// drafting bookkeeping to counsel and every other check here would still pass.
// This is the check that can actually fail on that file state.
{
  const p = path.join(PKT, "packet.html");
  if (fs.existsSync(p)) {
    const html = fs.readFileSync(p, "utf8");
    const flat = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

    for (const banner of ["Draft prepared by", "Not the applicant\u2019s own wording", "to be reviewed, corrected and approved"]) {
      if (flat.includes(banner)) fail("prose", `packet.html prints a draft banner ("${banner}") — provenance belongs in PACKET-STATUS.md §3.7 (user instruction 2026-11-07)`);
    }

    const narr = db.prepare(`SELECT * FROM narrative`).all();
    let leaked = 0;
    for (const r of narr) {
      const noteTxt = String(r.preparer_note || "").replace(/\s+/g, " ").trim();
      if (noteTxt && flat.includes(noteTxt.slice(0, 50))) {
        leaked++;
        fail("prose", `${r.folder_uid}'s preparer_note text appears in packet.html — the renderer must never read that column (§4.6)`);
      }
    }

    // The META test is defined once, in the writer; read it rather than restating it.
    const intakeSrc = fs.readFileSync(path.join(__dirname, "narrative-intake.js"), "utf8");
    const metaSrc = intakeSrc.match(/const META = \/(.*?)\/i;/s);
    if (!metaSrc) {
      fail("prose", "could not read the META guard out of narrative-intake.js — this check is blind");
    } else {
      const META = new RegExp(metaSrc[1], "i");
      const HEADINGS = ["Objectives", "Importance to Field", "How and Why Your Work Was Used", "Findings / Conclusions / Recommendation"];
      const dec = s => s.replace(/<[^>]+>/g, " ").replace(/&ldquo;|&rdquo;/g, '"').replace(/&lsquo;|&rsquo;/g, "\u2019")
        .replace(/&amp;/g, "&").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
      const re = /<h5>([^<]*)<\/h5>([\s\S]*?)(?=<h4|<h5|<\/article)/g;
      let m, blocks = 0, hits = 0;
      while ((m = re.exec(html))) {
        if (!HEADINGS.includes(m[1].trim())) continue;
        blocks++;
        for (const s of dec(m[2]).split(/(?<=[.!?])\s+/)) {
          if (META.test(s)) {
            hits++;
            fail("prose", `a narrative block in packet.html argues about the packet rather than the article: "${s.slice(0, 90)}\u2026" — move it to preparer_note (§4.6)`);
          }
        }
      }
      const want = narr.length * HEADINGS.length;
      if (blocks !== want) fail("prose", `found ${blocks} narrative blocks in packet.html but ${narr.length} narrative row(s) x 4 sections = ${want} — prose is missing or the markup changed shape`);
      if (!hits && !leaked && !QUIET) note("prose", `${blocks} narrative block(s) scanned for drafting advice; ${narr.length} preparer_note(s) confirmed absent from the document`);
    }
  }
}

/* ------------------------------------------------------------------ */
/* 12b. The potential pages stay separate from the packet (§5.6)        */
/* ------------------------------------------------------------------ */
// packet.html is what counsel receives and holds only confirmed citations. The
// review pages hold candidates — one page per cited work, since the screen table
// each work prints its own arithmetic; ONE page lists every queued work, and the
// "My work" column says which paper a citation is for. A citing article that cites
// two of the applicant's works is one row carrying two citations, so a row is not a
// citation and the checks below count uids, not rows. The failure worth guarding
// against is the quiet one: a candidate leaking into the packet, or a packet row
// being re-offered as though nobody had decided it. Both are checked against the
// database and the record, not against prose on the page.
{
  const failAny = fail;
  const packetHtml = fs.existsSync(path.join(PKT, "packet.html"))
    ? fs.readFileSync(path.join(PKT, "packet.html"), "utf8") : "";
  const includedUids = new Set(included.map(r => r.row_uid));
  const pageNames = fs.readdirSync(PKT)
    .filter(f => /^potential_notable_citations(-[A-Za-z0-9]+)?\.html$/.test(f))
    .sort();
  if (!pageNames.length) {
    warn("potential", "no potential_notable_citations*.html exists — run scripts/build-potential.js --write so unfiled independent citations are not simply invisible");
  }
  // The page is generalised, so a per-work page left in the folder is not an extra
  // convenience but a second document claiming to be the review list — and whoever
  // read it would be working from a list the pipeline no longer maintains.
  const strays = pageNames.filter(n => n !== "potential_notable_citations.html");
  if (strays.length) {
    failAny("potential", `${strays.length} superseded per-work review page(s) still in the folder — `
      + `the single generalized page covers every queued work: ${strays.join(", ")}`);
  }
  // Every citation the screen would offer must actually be LISTED on the page. A
  // work whose citations were dropped would leave them invisible rather than
  // failing. This is checked row by row, not per work: on 2026-11-08 the last held
  // MAWE row was screened out, MAWE legitimately had nothing left to offer, and a
  // per-work requirement read that as a page defect. A work with no candidates is
  // a finished work, not a missing one -- what must never happen is a row the
  // screen returned and the page omitted.
  {
    const queued = db.prepare(`SELECT DISTINCT cites_id FROM candidate
      WHERE cites_id IS NOT NULL AND cites_id <> ''`).all().map(r => String(r.cites_id));
    if (pageNames.includes("potential_notable_citations.html") && queued.length) {
      const potText = fs.readFileSync(path.join(PKT, "potential_notable_citations.html"), "utf8");
      const onPage = new Set([...potText.matchAll(/cit-\d{6}/g)].map(m => m[0]));
      const catQ = openCatalog();
      const dropped = [];
      let offered = 0;
      for (const id of queued) {
        let res;
        try {
          res = potentialIndependent(catQ, db, id);
        } catch (e) {
          failAny("potential", `${id}: the independence screen could not run — ${e.message}`);
          continue;
        }
        offered += res.rows.length;
        for (const r of res.rows) if (!onPage.has(r.row_uid)) dropped.push(r.row_uid);
      }
      catQ.close();
      if (dropped.length) {
        failAny("potential", `${dropped.length} citation(s) the screen offers are missing from `
          + `potential_notable_citations.html — run build-potential.js --write: ${dropped.slice(0, 5).join("; ")}`);
      } else if (offered === 0) {
        failAny("potential", `the screen offers 0 citations for all ${queued.length} queued work(s) — `
          + `an empty review page is not a page, it is a pipeline that stopped working`);
      }
    }
  }
  // The per-citation reports live on one page, opened by uid. Every link from the
  // candidate list must reach a report, and every PDF a report links must be on disk
  // and not screened out. The list checks neither, so a broken link would otherwise
  // show as an empty page rather than as a failure.
  const REPORT = "citation-report.html";
  if (pageNames.includes("potential_notable_citations.html") && fs.existsSync(path.join(PKT, REPORT))) {
    const list = fs.readFileSync(path.join(PKT, "potential_notable_citations.html"), "utf8");
    const rep = fs.readFileSync(path.join(PKT, REPORT), "utf8");
    const linked = new Set([...list.matchAll(/href="citation-report\.html\?uid=(cit-\d{6})"/g)].map(m => m[1]));
    const reported = new Set([...rep.matchAll(/<section class="cite-of" data-uid="(cit-\d{6})"/g)].map(m => m[1]));
    const noReport = [...linked].filter(u => !reported.has(u));
    const noLink = [...reported].filter(u => !linked.has(u));
    if (noReport.length) failAny("potential", `${noReport.length} row link(s) on potential_notable_citations.html have no report in ${REPORT}: ${noReport.slice(0, 6).join(", ")}`);
    if (noLink.length) failAny("potential", `${noLink.length} report(s) in ${REPORT} are not linked from the candidate list: ${noLink.slice(0, 6).join(", ")}`);
    const reportPdfs = [...rep.matchAll(/href="((?:papers|pending-papers|screened-papers)\/[^"]+)"/g)].map(m => m[1]);
    const badReportPdf = reportPdfs.filter(h => !fs.existsSync(path.join(PKT, decodeURIComponent(h))));
    if (badReportPdf.length) failAny("potential", `PDF link(s) in ${REPORT} do not resolve: ${badReportPdf.slice(0, 4).join(", ")}`);
    const screenedReportPdf = reportPdfs.filter(h => h.startsWith(ROOT_SCREENED + "/"));
    if (screenedReportPdf.length) failAny("potential", `${REPORT} links ${screenedReportPdf.length} screened-out PDF(s) (§4.5): ${screenedReportPdf.slice(0, 4).join(", ")}`);
    if (!QUIET) note("potential", `${REPORT}: ${reported.size} citation report(s), every one reached from the candidate list`);
  }
  for (const name of pageNames) {
    const POT = path.join(PKT, name);
    // Prefix every finding with the page it came from, so a finding names the file
    // to fix. Shadowing `fail` keeps the body below unchanged; `failAny` above is
    // the unprefixed original.
    const fail = (c, d) => failAny(c, `${name}: ${d}`);
    {
      const pot = fs.readFileSync(POT, "utf8");
      // Uids come from the uid CELL of each candidate row, which is the only place
      // a uid is asserted as a listing. The cell holds the row's first uid and a
      // `uid2` div per further citation folded onto the same article, so all of
      // them are read out of it. Matching the whole document instead would pick up
      // the uids in the per-citation reports below the table and in the notes.
      const tbody = pot.match(/<tbody id="cand-body">([\s\S]*?)<\/tbody>/);
      const rowChunks = tbody ? tbody[1].split(/<tr\b/).slice(1) : [];
      const potUidSet = [];
      for (const raw of rowChunks) {
        const close = raw.indexOf("</tr>");
        const tr = close >= 0 ? raw.slice(0, close) : raw;
        const cell = tr.match(/<td class="uid">([\s\S]*?)<\/td>/);
        if (!cell) continue;
        for (const m of cell[1].matchAll(/cit-\d{6}/g)) {
          if (!potUidSet.includes(m[0])) potUidSet.push(m[0]);
        }
      }
      const potUids = potUidSet;
      if (!potUids.length) {
        fail("potential", "no candidate rows parsed — the markup changed shape and this check has gone blind");
      } else {
      // 1. Separation. Neither document may reference the other.
      if (/potential_notable/i.test(packetHtml)) fail("potential", "packet.html links or mentions potential_notable_citations.html — candidates must not appear in the document counsel receives");
      if (/<a[^>]+packet\.html/i.test(pot)) fail("potential", "the potential page links packet.html — keep the two documents unlinked so a candidate cannot borrow the packet's authority");

      // 2. Nothing already decided appears as a candidate.
      const leaked = potUids.filter(u => includedUids.has(u));
      if (leaked.length) fail("potential", `${leaked.length} confirmed packet row(s) listed as candidates: ${leaked.slice(0, 6).join(", ")}`);
      const orig = originalApplicationUids();
      if (orig === null) fail("potential", "Original-Application-Citations.md is unreadable, so already-filed articles cannot be excluded from the potential page");
      else {
        const repeat = potUids.filter(u => orig.has(u));
        if (repeat.length) fail("potential", `${repeat.length} article(s) already used in the original application listed as candidates (§3): ${repeat.slice(0, 6).join(", ")}`);
      }

      // 3. Independence comes from the record, not the queued snapshot. This is the
      //    screen's whole purpose, so a stale candidate on the page is a defect.
      const cat = openCatalog();
      const catRows = new Map(cat.prepare(
        "SELECT row_uid, status, is_countable_independent, is_non_english, is_primary_copy, superseded_at FROM citations WHERE row_uid IN (" + potUids.map(() => "?").join(",") + ")")
        .all(...potUids).map(r => [r.row_uid, r]));
      cat.close();
      const missing = potUids.filter(u => !catRows.has(u));
      if (missing.length) fail("potential", `${missing.length} candidate uid(s) do not resolve in the citation record: ${missing.slice(0, 6).join(", ")}`);
      const notIndep = potUids.filter(u => { const c = catRows.get(u); return c && (c.status !== "INDEPENDENT" || c.is_countable_independent !== 1); });
      if (notIndep.length) fail("potential", `${notIndep.length} candidate(s) are not independent on the record — a shared author or a PI on the citing paper disqualifies them (§1.2): ${notIndep.slice(0, 6).join(", ")}`);
      const flagged = potUids.filter(u => { const c = catRows.get(u); return c && (c.is_non_english || c.is_primary_copy === 0 || c.superseded_at); });
      if (flagged.length) fail("potential", `${flagged.length} candidate(s) are non-English, a copy that does not stand, or superseded: ${flagged.slice(0, 6).join(", ")}`);

      // 4. A tier on this page is a scan result, so it must be traceable to one.
      //    The page used to forbid tier language outright because nothing had been
      //    read; now the candidates with a PDF on file have been read by
      //    scan-mentions.js, and suppressing that would hide the very information
      //    the applicant needs to choose. What must hold instead is that every tier
      //    shown is the database's own scan_tier for that row, on a row that has a
      //    PDF — a tier invented in the template, or one left behind after a rescan
      //    cleared it, is the failure this guards.
      //    Read one table row at a time. A single expression over the whole page
      //    pairs a row with the NEXT row's pill, so a candidate with no tier inherits
      //    its neighbour's and the check reports claims the page never made.
      const rowsWithScan = new Map(db.prepare(
        `SELECT row_uid, scan_tier, scanned_on, scan_note FROM citation WHERE row_uid IN (`
        + potUids.map(() => "?").join(",") + ")").all(...potUids).map(r => [r.row_uid, r]));
      const rowsWithPdf = new Set(db.prepare(
        `SELECT c.row_uid FROM citation c JOIN file f ON f.folder_uid = c.folder_uid AND f.cited = 1
         WHERE c.row_uid IN (` + potUids.map(() => "?").join(",") + ")").all(...potUids).map(r => r.row_uid));
      const mentionsBy = new Map();
      for (const m of db.prepare("SELECT row_uid, tier, basis FROM mention").all()) {
        if (!mentionsBy.has(m.row_uid)) mentionsBy.set(m.row_uid, []);
        mentionsBy.get(m.row_uid).push(m);
      }
      const uidOf = t => (t.match(/cit-\d{6}/) || [])[0];
      const invented = [];
      let shownTiers = 0;
      // Pills live in the Tier and Citation cells, once per cited work, so the same
      // uid legitimately carries the same pill twice in one row. Deduplicate.
      const seenPill = new Set();
      const claimPill = (uid, tier, resolved) => {
        const key = `${uid}|${tier}|${resolved ? 1 : 0}`;
        if (seenPill.has(key)) return;
        seenPill.add(key);
        shownTiers++;
        if (!resolved) {
          const r = rowsWithScan.get(uid);
          if (!r || !r.scan_tier || !rowsWithPdf.has(uid)) invented.push(`${uid} Tier ${tier}`);
          else if (r.scan_tier !== tier) invented.push(`${uid} shows Tier ${tier} but the scan read ${r.scan_tier}`);
          return;
        }
        // A resolved tier comes from the mention table, not from scan_tier, and it
        // is only honest if a mention with that tier and a non-text basis is really
        // recorded for the row. Otherwise the page invented it.
        const m = (mentionsBy.get(uid) || []).find(x => x.tier === tier && x.basis !== "extracted text");
        if (!m) invented.push(`${uid} Tier ${tier} resolved with no such recorded mention`);
      };
      /**
       * Slice a row into its `workcell` blocks, each paired with the uid it names.
       *
       * Boundaries are found by position, not by a lookahead for the closing tag:
       * a workcell's own `</div>` is followed by `</td>` for the LAST block in a
       * cell, and a regex that only stops at the next workcell lets that block run
       * into the next cell — which attributed one citation's tier to its row-mate.
       * Each block therefore ends at whichever comes first: the next workcell, or
       * the `</td>` that closes the cell it sits in.
       */
      function workcells(tr) {
        const opens = [...tr.matchAll(/<div class="workcell" data-uid="(cit-\d{6})"[^>]*>/g)];
        return opens.map((m, i) => {
          const next = i + 1 < opens.length ? opens[i + 1].index : tr.length;
          const tdEnd = tr.indexOf("</td>", m.index);
          const end = tdEnd >= 0 && tdEnd < next ? tdEnd : next;
          return { uid: m[1], body: tr.slice(m.index + m[0].length, end), start: m.index, end };
        });
      }
      for (const raw of pot.split(/<tr\b/).slice(1)) {
        // Cut at the row's own close. Without it the LAST row's chunk runs to the
        // end of the document and picks up a pill from the per-article reports
        // below the table, which would pair a candidate with a claim it never made.
        const close = raw.indexOf("</tr>");
        const tr = close >= 0 ? raw.slice(0, close) : raw;
        if (!/<td class="uid">/.test(tr)) continue;    // header row, or a table that is not the list
        // Attributed pills: each `workcell` names the uid it speaks for.
        const cells = workcells(tr);
        for (const { uid, body } of cells) {
          const res = body.match(/<span class="pill [^"]*">Tier ([ABCD]) &mdash; resolved<\/span>/);
          if (res) { claimPill(uid, res[1], true); continue; }
          const plain = body.match(/<span class="pill [^"]*">Tier ([ABCD])<\/span>/);
          if (plain) claimPill(uid, plain[1], false);
        }
        // A pill that is NOT inside a uid-bearing workcell belongs to no citation.
        // Without this branch a pill appended anywhere in the row — or a future
        // markup change that drops the attribute — would pass unattributed.
        let attributed = "";
        let at = 0;
        for (const c of cells) { attributed += tr.slice(at, c.start); at = c.end; }
        attributed += tr.slice(at);
        const orphan = attributed.match(/<span class="pill [^"]*">Tier ([ABCD])( &mdash; resolved)?<\/span>/);
        if (orphan) {
          const uid = uidOf(tr);
          shownTiers++;
          invented.push(`${uid || "a row"} Tier ${orphan[1]}${orphan[2] ? " resolved" : ""} with no workcell naming the citation it describes`);
        }
      }
      if (invented.length) {
        fail("potential", `${invented.length} tier claim(s) on the review page are not the scan's reading of a PDF on file (§5.6): ${invented.slice(0, 6).join("; ")}`);
      }
      // Prose must not claim a tier for a row the scan could not place.
      const stray = (pot.replace(/<span class="pill [^"]*">Tier [ABCD]<\/span>/g, "")
        .match(/\bTier\s+[ABCD]\b[^<]*?(?=<\/(?:p|div|li)>)/g) || [])
        .filter(s => !/Tier [ABCD] —|means|a tier|Tier A means/i.test(s));
      if (stray.length) fail("potential", `the review page asserts a tier in prose (${stray.slice(0, 2).join(" / ").slice(0, 120)}) outside a scanned pill`);

      // 4b. Every external link opens in a new tab. The page is read beside the
      //     packet, and a candidate link that replaces it loses the list — and the
      //     applicant's place in it.
      const ext = [...pot.matchAll(/<a\b[^>]*href="(https?:\/\/[^"]*)"[^>]*>/g)];
      const noTarget = ext.filter(m => !/target=/.test(m[0])).map(m => m[1]);
      if (noTarget.length) fail("potential", `${noTarget.length} external link(s) open in the same tab: ${noTarget.slice(0, 4).join(", ")}`);
      const noRel = ext.filter(m => /target=/.test(m[0]) && !/rel="[^"]*noopener/.test(m[0])).map(m => m[1]);
      if (noRel.length) fail("potential", `${noRel.length} external link(s) omit rel="noopener", letting the opened page reach back at this one: ${noRel.slice(0, 4).join(", ")}`);

      // 5. The printed screens must add up, or the page misrepresents the corpus.
      //    One table per cited work now, so each closes on its own AND the sum of
      //    the per-work "listed" figures equals the citations in the table. It does
      //    NOT equal the row count: a folded row carries one citation per work, so
      //    the page deliberately prints 92 citations and 91 rows.
      const screenBlocks = [...pot.matchAll(/<table class="screen">([\s\S]*?)<\/table>/g)];
      if (!screenBlocks.length) {
        fail("potential", "no screen table on potential_notable_citations.html — the page no longer shows how the list was derived");
      } else {
        let sumListed = 0;
        for (const [i, block] of screenBlocks.entries()) {
          const terms = [...block[1].matchAll(/class="n">(?:<strong>)?(&minus;)?(-?\d+)/g)]
            .map(m => (m[1] ? -1 : 1) * Number(m[2]));
          if (terms.length < 2) { fail("potential", `screen table ${i + 1} has no numbers to add up`); continue; }
          const listed = terms.pop();
          const running = terms.reduce((a, b) => a + b, 0);
          if (running !== listed) fail("potential", `screen table ${i + 1} does not close: ${running} != ${listed} listed`);
          sumListed += listed;
        }
        if (sumListed !== potUids.length) {
          fail("potential", `the screen tables total ${sumListed} listed citations but the table lists ${potUids.length}`);
        }
      }

      // 6. PDF links on the page must resolve, like every other link in the
      // folder, and a page awaiting a decision may only point at
      // `pending-papers/` — a screened-out PDF must not be linked from anywhere.
      const potPdf = [...pot.matchAll(/href="((?:papers|pending-papers|screened-papers)\/[^"]+)"/g)].map(m => m[1]);
      const badPdf = potPdf.filter(h => !fs.existsSync(path.join(PKT, decodeURIComponent(h))));
      if (badPdf.length) fail("potential", `candidate PDF link(s) do not resolve: ${badPdf.slice(0, 4).join(", ")}`);
      const screened = potPdf.filter(h => h.startsWith(ROOT_SCREENED + "/"));
      if (screened.length) fail("potential", `the review page links ${screened.length} screened-out PDF(s) (§4.5): ${screened.slice(0, 4).join(", ")}`);

      if (!QUIET) note("potential", `${name}: ${potUids.length} candidate citation(s); all independent on the record, none in the packet or the original application; ${shownTiers} tier(s) shown, each backed by a scan of a PDF on file or a resolved mention`);
    }
    }
  }
}

/* ------------------------------------------------------------------ */
/* 12b. The candidate queue agrees with the shelf                       */
/* ------------------------------------------------------------------ */
// `candidate.discover_state` is what tells the applicant what still needs chasing.
// PACKET-STATUS.md defines `open-copy` as "the row is only `has-pdf` once the file
// is on disk", so a row carrying that state beside a folder that already holds the
// article contradicts the document a reader uses to decide where to spend effort —
// and sends someone to fetch a paper that is already filed. Two writers set the
// state and neither re-checked the other, so this is the check that closes it.
{
  const stale = db.prepare(`
    SELECT c.row_uid, c.discover_state FROM candidate c
     WHERE c.discover_state NOT IN ('has-pdf','skipped')
       AND EXISTS (SELECT 1 FROM file f WHERE f.folder_uid = c.row_uid)
     ORDER BY c.row_uid`).all();
  if (stale.length) {
    fail("candidate-state", `${stale.length} candidate row(s) hold a PDF but still read `
      + `${[...new Set(stale.map(r => r.discover_state))].join("/")} — run `
      + `node scripts/sync-candidate-state.js --write: ${stale.slice(0, 6).map(r => r.row_uid).join(", ")}`);
  } else if (!QUIET) {
    const n = db.prepare(`SELECT COUNT(*) n FROM candidate WHERE discover_state='has-pdf'`).get().n;
    note("candidate-state", `all ${n} candidate row(s) with a PDF on disk are marked 'has-pdf'`);
  }
}

/* ------------------------------------------------------------------ */
/* 13. --deep: re-read the PDFs and confirm every filed quote is in one */
/* ------------------------------------------------------------------ */
// §7 says a quotation must be verbatim text from the citing article. Everything
// else in this file checks the record against itself; only reading the PDFs can
// show that a fluent, confident sentence was never written. That check lives in
// record-evidence.js because the same guard has to run before a write too, and it
// is slow (every PDF is parsed), so it is opt-in rather than always on.
if (DEEP) {
  console.log("\n--deep: verifying every filed quote against its PDF ...");
  try {
    const out = execFileSync(process.execPath, [path.join(__dirname, "record-evidence.js"), "--check"], { encoding: "utf8" });
    const line = out.split(/\r?\n/).find(l => l.startsWith("checked ")) || "";
    if (line) note("deep", line.trim());
    for (const l of out.split(/\r?\n/)) if (l.trim().startsWith("FAIL ")) fail("deep", l.trim().slice(5));
  } catch (err) {
    const out = String(err.stdout || "");
    for (const l of out.split(/\r?\n/)) if (l.trim().startsWith("FAIL ")) fail("deep", l.trim().slice(5));
    if (!out.includes("FAIL ")) fail("deep", `record-evidence.js --check could not run: ${err.message}`);
  }
}

/* ------------------------------------------------------------------ */
/* Report                                                               */
/* ------------------------------------------------------------------ */
db.close();
if (!QUIET) {
  for (const [c, d] of notes) console.log(`  ok   [${c}] ${d}`);
}
for (const [c, d] of warnings) console.log(`  warn [${c}] ${d}`);
for (const [c, d] of failures) console.log(`  FAIL [${c}] ${d}`);
console.log(`\n${failures.length} failure(s), ${warnings.length} warning(s).`);
if (failures.length) {
  console.log("The packet is not ready to hand over. Fix the FAIL lines and re-run.");
  process.exit(1);
}
console.log("All mechanical §7 checks pass.");

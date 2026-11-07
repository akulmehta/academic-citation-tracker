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
const { PKT, REPO, PAPERS, openPacket, openCatalog } = require("./lib.js");

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
// §5.1: NN-role-Surname[-date].pdf, the citing senior author's surname in the name.
const NAME_RE = /^\d{2}-[a-z][a-z-]+-.+\.pdf$/;
{
  const listed = new Set(files.map(f => f.file));
  for (const f of files) {
    const base = path.basename(f.file);
    if (!NAME_RE.test(base)) fail("pdf-name", `${f.file} does not look like NN-role-Surname[-date].pdf`);
    if (!f.file.startsWith("papers/")) fail("pdf-name", `${f.file} is not under papers/`);
    const abs = path.join(PKT, f.file);
    if (!fs.existsSync(abs)) { fail("pdf-file", `${f.file} is listed but does not exist on disk`); continue; }
    const buf = fs.readFileSync(abs);
    if (buf.subarray(0, 4).toString("latin1") !== "%PDF") fail("pdf-file", `${f.file} does not start with %PDF`);
    if (f.bytes !== buf.length) fail("pdf-file", `${f.file}: bytes=${f.bytes} but the file on disk is ${buf.length}`);
    // The surname must be the senior author of a citation row in this folder.
    const rows = cits.filter(c => c.folder_uid === f.folder_uid);
    const names = rows.map(c => c.citing_senior_author).filter(Boolean);
    if (names.length) {
      const flat = s => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z]/g, "").toLowerCase();
      const hit = names.some(n => base.toLowerCase().includes(flat(n)));
      if (!hit) fail("pdf-name", `${f.file} does not contain the citing senior author's surname (${names.join(" / ")})`);
    }
  }
  // Nothing loose in papers/, and every folder on disk is a folder_uid.
  if (fs.existsSync(PAPERS)) {
    for (const e of fs.readdirSync(PAPERS, { withFileTypes: true })) {
      if (e.isFile()) fail("pdf-loose", `${e.name} sits loose in papers/ — §5.1 wants one sub-folder per citing work`);
      else if (!cits.some(c => c.folder_uid === e.name)) fail("pdf-folder", `papers/${e.name}/ is not the folder_uid of any citation row`);
    }
  }
  for (const f of files) if (!byUid.has(f.folder_uid)) fail("pdf-folder", `file ${f.file} names folder_uid ${f.folder_uid}, which is not a citation row`);
  for (const r of included) {
    if (!r.pdf_file) continue;
    if (!files.some(f => f.folder_uid === r.folder_uid)) fail("pdf-folder", `included row ${r.row_uid} records a pdf_file but its folder has no file row`);
  }
  // §5.1: a citation in the packet has its PDF in the folder. A row counsel is
  // told to read but cannot open is worse than a row that is simply absent, so
  // this fails even when the row's own pdf_file column is empty.
  for (const folder of new Set(included.map(r => r.folder_uid))) {
    if (!files.some(f => f.folder_uid === folder)) {
      fail("pdf-missing", `folder ${folder} is in the packet but holds no PDF — counsel cannot check what the packet asserts about it`);
    }
  }
  if (!failures.some(f => f[0].startsWith("pdf-")) && !QUIET) note("pdf", `${files.length} file(s) checked: name, presence, %PDF magic, byte count, surname`);
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
      if (clean.startsWith("papers/") && !listed.has(clean)) { fail("link", `${h} is linked but not listed in packet-files.csv`); bad++; }
    }
    // Every INCLUDED work's folder must appear in the HTML. A held folder is an
    // open item for the applicant, not evidence for counsel, so it is listed in
    // PACKET-STATUS.md instead (checked above) and deliberately absent here.
    const folders = new Set(included.map(c => c.folder_uid));
    const absent = [...folders].filter(f => !html.includes(f));
    if (absent.length) fail("link", `${absent.length} included folder(s) never appear in packet.html: ${absent.slice(0, 8).join(", ")}`);
    const heldWithFiles = new Set(files.filter(f => !folders.has(f.folder_uid)).map(f => f.folder_uid));
    if (heldWithFiles.size && !QUIET) {
      note("link", `${heldWithFiles.size} folder(s) hold a PDF but no included row, so they are open items in PACKET-STATUS.md rather than in the lawyer HTML: ${[...heldWithFiles].join(", ")}`);
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
  for (const r of cits) {
    const f = folderTier(r.source_pdf);
    if (!f || !r.tier) continue;
    if (f === r.tier) continue;
    const from = folderLabel(r.source_pdf);
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
      warn("tier-folder", msg + ` — the applicant filed it as Acknowledgements, yet the row's own note records a Methods sentence; §3.2 of PACKET-STATUS.md asks for a decision`);
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
  else if (!QUIET) note("catalog", `all ${cits.length} row_uid(s) resolve in the record (opened read-only)`);
}

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

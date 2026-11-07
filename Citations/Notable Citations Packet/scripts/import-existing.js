"use strict";
/**
 * Import the existing evidence into the packet database.
 *
 * Sources, in order of authority for each field:
 *   - Citations/Citation-summary.md  (rendered from the user's hand-maintained docx)
 *       -> tool, where-the-citation-sits, dates, the note text, the timeline
 *   - Database/citation-catalog.sqlite (READ ONLY)
 *       -> citing title/authors/venue/link/doi, PI work cited, exhibit reference
 *   - the PDF files on disk
 *       -> the bytes that get copied into papers/
 *
 * Writes only inside Citations/Notable Citations Packet/.
 */
const fs = require("fs");
const path = require("path");
const { openCatalog, openPacket, SUMMARY_MD, PDF_ROOT, PAPERS, PKT, surnameSlug, seniorAuthor, toolForCitedPaper, projectForCitedPaper } = require("./lib");

const DRY = process.argv.includes("--dry");

/* ------------------------------------------------------------------ */
/* 1. Parse the docx-derived summary                                    */
/* ------------------------------------------------------------------ */

/**
 * The Index table's "Senior author" column, keyed by entry number.
 *
 * This is the authoritative senior author. The catalog's `full_authors` is
 * Scholar's rendering and is TRUNCATED at ten names for 357 of the 1498 active
 * rows, so its last name is often the tenth author rather than the senior one
 * (it named Dhennezel for the Kiessling paper and Qureshi for Knight).
 */
function parseIndex(md) {
  const out = new Map();
  const table = md.match(/## Index\n([\s\S]*?)\n## /);
  if (!table) return out;
  for (const line of table[1].split("\n")) {
    const m = line.match(/^\|\s*(\d+)\s*\|(.+)\|$/);
    if (!m) continue;
    // Columns: #, Earliest, Published, Tool, Where, Senior author, row_uid, PDFs
    const cells = m[2].split("|").map(c => c.trim());
    const senior = (cells[4] || "").replace(/\*\*/g, "").trim();
    const uids = [...m[0].matchAll(/cit-\d+/g)].map(x => x[0]).sort();
    if (senior && senior !== "Senior author") out.set(Number(m[1]), { senior, main: uids[0] || null });
  }
  return out;
}

function parseSummary(md) {
  const index = parseIndex(md);
  const text = md.replace(/\r\n/g, "\n");
  // Detail runs until the next top-level section; a later "## PDF inventory" also
  // uses ### headings per folder, and swallowing it invented 7 phantom entries.
  const from = text.indexOf("\n## Detail");
  const rest = text.slice(from + 1);
  const next = rest.slice(3).search(/^## /m);
  const detail = next === -1 ? rest : rest.slice(0, next + 3);
  const blocks = detail.split(/\n### /).slice(1);
  const entries = [];
  for (const b of blocks) {
    const lines = b.split("\n");
    const e = { n: Number(lines[0].match(/^(\d+)\./)?.[1]) , row_uids: [], pdfs: [] };
    const ix = index.get(e.n);
    e.senior = ix?.senior || null;
    e.main_uid = ix?.main || null;
    const head = lines.find(l => l.startsWith("**") && l.includes("**,"));
    if (head) {
      const m = head.match(/^\*\*(.+?)\*\*,\s*(.+?),\s*\*(.+?)\*$/);
      if (m) { e.doc_title = m[1].trim(); e.doc_authors = m[2].trim(); e.doc_venue = m[3].trim(); }
    }
    const grab = label => {
      const m = b.match(new RegExp(`- \\*\\*${label}:\\*\\*\\s*(.+)`));
      return m ? m[1].trim() : null;
    };
    e.tool = grab("Tool");
    e.earliest = grab("Earliest date \\(preprint, else journal received\\)");
    e.published = grab("Published / accepted");

    // The author's note: the paragraph after the bullets, before **Catalog rows**.
    const noteM = b.match(/\n\n([^\n][\s\S]*?)\n\n\*\*Catalog rows/);
    e.note = noteM ? noteM[1].replace(/\n/g, " ").trim() : null;

    for (const r of b.matchAll(/^\|\s*`(cit-\d+)`\s*\|/gm)) e.row_uids.push(r[1]);

    const pdfSec = b.split(/\*\*PDF\*\*/)[1] || "";
    for (const p of pdfSec.matchAll(/\[([^\]]+)\]\((\.\/[^)]+)\)/g)) {
      const relPath = decodeURIComponent(p[2]).replace(/^\.\//, "");
      e.pdfs.push({ name: p[1], abs: path.join(PDF_ROOT, relPath) });
    }
    entries.push(e);
  }
  return entries;
}

/* ------------------------------------------------------------------ */
/* 2. Decide the fields that need judgement                             */
/* ------------------------------------------------------------------ */

/**
 * Tier from the docx note. The note is the user's own reading of the PDF, which is
 * the authority; the folder is a secondary signal used only when the note is silent.
 */
function tierFrom(note, folder) {
  const n = (note || "").toLowerCase();
  if (/^\s*methods\b/.test(n) || /\bmethods:/.test(n)) return "A";
  if (/\bresults\b|\bfigures\b/.test(n)) return "B";
  if (/\bintroduction\b|\bdiscussion\b/.test(n)) return "C";
  if (/\backnowledg/.test(n)) return "D";
  if (/unresolved/.test(n)) return null;
  if (folder === "In Methods") return "A";
  if (folder === "In Results and Figures") return "B";
  if (folder === "In high reputation Publication") return "C";
  if (folder === "In Acknowledgements") return "D";
  return null;
}

/** Pull a verbatim quoted sentence, if the note contains one. */
function quoteFrom(note) {
  if (!note) return null;
  const m = note.match(/"([^"]{25,600})"/);
  return m ? m[1].trim() : null;
}

/** A file name is a label: NN-role-Surname[-date].pdf */
function packetFileName(idx, role, surname, dateIso) {
  const nn = String(idx + 1).padStart(2, "0");
  const parts = [nn, role, surnameSlug(surname)];
  if (dateIso) parts.push(dateIso);
  return parts.join("-") + ".pdf";
}

/**
 * The senior author — the name counsel recognises the paper by.
 *
 * Order of preference:
 *   1. The docx "Senior author" column. It is the user's own reading and names the
 *      PI, which is what a reader of the packet looks for.
 *   2. The catalog's last author, but ONLY when the list is not truncated. Scholar
 *      cuts an author list at ten names, and the record marks that with `truncated`;
 *      the tenth name on such a list is not the senior author. Measured on the 14
 *      imported works: 5 of them are truncated, and taking their last name produced
 *      Dhennezel for the Kiessling paper and Qureshi for the Knight paper.
 *   3. Nothing — left empty rather than guessed.
 */
function seniorFrom(docxSenior, catRow) {
  if (docxSenior) return docxSenior;
  if (!catRow) return null;
  if (catRow.truncated) return null;
  return seniorAuthor(catRow.full_authors, catRow.authors_used);
}
function parseAuthors(json) {
  let list;
  try { list = JSON.parse(json); } catch { return null; }
  if (!Array.isArray(list) || !list.length) return null;
  const clean = s => String(s).replace(/\{\\'\\i\}/g, "i").replace(/\{\\'e\}/g, "e").replace(/[{}\\]/g, "").trim();
  return list.map(a => {
    if (!a.includes(",")) return clean(a);
    const [sur, ...rest] = a.split(",");
    return `${clean(rest.join(", "))} ${clean(sur)}`.trim();
  }).join(", ");
}

/** Read order inside a folder: oldest evidence first, so a timeline lists itself. */
const ROLE_RANK = { preprint: 0, webpage: 1, article: 2, supplement: 3 };
function roleFor(name) {
  const n = name.toLowerCase();
  if (n.includes("webpage") || n.includes("web page")) return "webpage";
  if (n.includes("preprint") || n.includes("bioarchive") || n.includes("biorxiv")) return "preprint";
  return "article";
}

/** Dates we only assert when the docx actually says them. */
function dateFor(entry, role) {
  if (role === "preprint" && entry.earliest && /preprint/i.test(entry.earliest)) {
    const m = entry.earliest.match(/(\d{1,2})\s+([A-Za-z]{3})\s+(\d{4})/);
    if (m) return isoFrom(m[1], m[2], m[3]);
  }
  return null;
}

/**
 * The year that belongs in a filename for a given role.
 *
 * The summary's "Published / accepted" line holds several dated events for the
 * timeline entries, and taking the FIRST year in it misdated Heras's journal
 * article as 2023 — that is the preprint's date; the article is 2024. So a role
 * reads its own segment of the line, and an article with no matching segment
 * takes the LAST year rather than the first.
 */
function yearTagFor(role, published, earliest) {
  const src = published || "";
  const keyword =
    role === "article" ? /journal|published|issue|accepted|article/i
    : role === "preprint" ? /preprint|biorxiv|medrxiv|chemrxiv/i
    : role === "webpage" ? /submitted|ssrn|deposited/i
    : null;
  for (const seg of src.split(/;/)) {
    if (keyword && keyword.test(seg)) {
      const m = seg.match(/20\d\d/);
      if (m) return m[0];
    }
  }
  if (role === "article") {
    const all = [...src.matchAll(/20\d\d/g)].map(x => x[0]);
    if (all.length) return all[all.length - 1];
  }
  return (/\b(20\d\d)\b/.exec(earliest || src) || [])[1] || null;
}
const MON = { Jan: "01", Feb: "02", Mar: "03", Apr: "04", May: "05", Jun: "06", Jul: "07", Aug: "08", Sep: "09", Oct: "10", Nov: "11", Dec: "12" };
function isoFrom(d, mon, y) {
  const mm = MON[mon.slice(0, 3)];
  return mm ? `${y}-${mm}-${String(d).padStart(2, "0")}` : null;
}

/* ------------------------------------------------------------------ */
/* 3. Import                                                            */
/* ------------------------------------------------------------------ */
function main() {
  const cat = openCatalog();
  const db = openPacket();

  const entries = parseSummary(fs.readFileSync(SUMMARY_MD, "utf8"));
  console.log(`parsed ${entries.length} entries from Citation-summary.md`);

  const pubByCites = new Map(
    cat.prepare(`SELECT cites_id, title, year, exhibit_base, snapshot_date FROM publications`).all()
      .map(p => [p.cites_id, p])
  );
  const rowByUid = new Map(
    cat.prepare(`SELECT * FROM citations WHERE superseded_at = ''`).all().map(r => [r.row_uid, r])
  );

  // Group entries' rows so a work's folder is named by its lowest uid (§4.2).
  const rows = [];
  for (const e of entries) {
    for (const uid of e.row_uids) {
      const c = rowByUid.get(uid);
      if (!c) { console.log(`  ! ${uid} not present in the catalog (active rows) — recorded with what the docx says`); }
      rows.push({ e, uid, c });
    }
  }
  const byFolder = new Map();
  for (const r of rows) {
    const key = r.uid;
    const lowest = rows.filter(x => x.e === r.e).map(x => x.uid).sort()[0];
    r.folder = lowest;
    if (!byFolder.has(lowest)) byFolder.set(lowest, []);
    byFolder.get(lowest).push(r);
  }

  const origUids = originalApplicationUids();
  console.log(`${origUids.size} row_uids recorded as already filed in the original petition`);

  const C_COLS = ["row_uid","folder_uid","n","status","screen_reason","screen_date","is_main","additional_row_uids","cites_id","cited_tool","cited_paper","cited_earliest_date","cited_was_preprint","citing_title","citing_authors","citing_senior_author","citing_institutions","citing_country","citing_venue","citing_year","citing_earliest_date","citing_was_preprint","citing_published_date","citing_article_type","citing_url","patent_number","project","tier","section","page","exhibit_page","quote","use_type","in_original_petition","negative","language","evidence_basis","pdf_file","source_pdf","exhibit_pdf","notes"];
  const UPDATABLE = C_COLS.filter(c => !["row_uid"].includes(c));
  const insC = db.prepare(`INSERT INTO citation (${C_COLS.join(", ")})
    VALUES (${C_COLS.map(() => "?").join(", ")})
    ON CONFLICT(row_uid) DO UPDATE SET
      ${UPDATABLE.map(c => `${c}=excluded.${c}`).join(", ")}`);
  const insF = db.prepare(`INSERT INTO file (folder_uid, file, source_pdf, role, shows_date, date_basis, cited, bytes)
    VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(folder_uid, file) DO UPDATE SET
      source_pdf=excluded.source_pdf, role=excluded.role, shows_date=excluded.shows_date,
      date_basis=excluded.date_basis, cited=excluded.cited, bytes=excluded.bytes`);

  let copied = 0;
  const report = { included: 0, screened: 0, files: 0, missingPdf: [] };

  for (const e of entries) {
    const group = byFolder.get(rows.find(r => r.e === e).folder);
    const folderUid = group[0].folder;
    const catRow = group.map(r => r.c).find(Boolean) || null;
    // The docx Index column is the applicant's own reading and names the PI; the
    // catalog's byline is Scholar's and is cut off at ten names on many rows.
    const senior = seniorFrom(e.senior, catRow);
    const pub = catRow ? pubByCites.get(catRow.cites_id) : null;
    const tier = tierFrom(e.note, path.basename(path.dirname(e.pdfs[0]?.abs || "")));
    const wasPreprint = /preprint/i.test(e.earliest || "") ? 1 : 0;

    // Files for this work, ordered so the folder lists a timeline oldest-first.
    const pdfs = e.pdfs.map(p => ({ ...p, role: roleFor(p.name) }))
      .sort((a, b) => (ROLE_RANK[a.role] ?? 9) - (ROLE_RANK[b.role] ?? 9) || a.name.localeCompare(b.name));
    const articleYear = yearTagFor("article", e.published, e.earliest);
    const preprintYear = yearTagFor("preprint", e.published, e.earliest);
    const files = [];
    for (let i = 0; i < pdfs.length; i++) {
      const p = pdfs[i];
      const role = p.role;
      const d = dateFor(e, role);
      // A preprint and the page evidencing it carry the preprint's date; the
      // article carries its own. Naming them by the wrong year would misdate the
      // very timeline the folder exists to show.
      const yearTag = role === "article" ? articleYear : (preprintYear || articleYear);
      const fname = packetFileName(i, role, senior, d || yearTag);
      const relOut = `papers/${folderUid}/${fname}`;
      const absOut = path.join(PKT, relOut);
      let bytes = null;
      const exists = fs.existsSync(p.abs);
      if (!exists) report.missingPdf.push(p.abs);
      if (exists && !DRY) {
        fs.mkdirSync(path.dirname(absOut), { recursive: true });
        fs.copyFileSync(p.abs, absOut);
        bytes = fs.statSync(absOut).size;
        copied++;
      } else if (exists) {
        bytes = fs.statSync(p.abs).size;
      }
      files.push({ relOut, abs: p.abs, role, bytes, shows: d, cited: role === "webpage" ? 0 : 1 });
      if (!DRY) insF.run(folderUid, relOut, `Citations/${path.relative(PDF_ROOT, p.abs).split(path.sep).join("/")}`, role, d, d ? "Citation-summary.docx (earliest-date line)" : null, role === "webpage" ? 0 : 1, bytes);
      report.files++;
    }
    // The PDF counsel turns to is the published article when one exists; a
    // preprint or repository page is the timeline evidence, not the citation.
    const primary = files.find(f => f.role === "article") || files.find(f => f.cited) || files[0] || null;

    const alreadyFiled = group.some(r => origUids.has(r.uid)) ? 1 : 0;
    const notes = [];
    if (group.length > 1) notes.push(`${group.length} catalog rows for this citing work (${group.map(r => r.uid).join(", ")}).`);
    if (!catRow) notes.push("No active catalog row matched; bibliographic fields come from the docx only.");
    if (e.note) notes.push(`Docx note: ${e.note}`);

    const status = alreadyFiled ? "screened-out" : (tier ? "included" : "held");
    const screenReason = alreadyFiled ? "already filed" : (tier ? null : "passing mention");

    for (const r of group) {
      const isMain = r.uid === folderUid ? 1 : 0;
      // §5: identity is the folder's, classification is the ROW's. `e.tool` and
      // `pub` describe whichever catalog row the folder happened to read first,
      // so using them here stamped one tool, one title and one project onto every
      // row of a citing article — which put "GLAD, Methods" on a row citing
      // GlycoGlyph. Resolve each from this row's own cites_id.
      const rowPub = (r.c && pubByCites.get(r.c.cites_id)) || pub;
      // `cited_tool` (§4.6) is which of MY works this row cites, so it is the
      // cited paper's own tool. Where the cited paper is not one of the four
      // tools the answer is empty, not the folder's tool list: the docx names
      // every tool the applicant saw in the paper, which says nothing about
      // which row that observation belongs to. The docx value survives only on
      // a row with no catalog match at all, where it is the only information.
      const rowTool = rowPub ? toolForCitedPaper(rowPub.title) : (e.tool || null);
      const rowProject = projectForCitedPaper(rowPub?.title);
      insC.run(
        r.uid, folderUid, e.n ?? null, status, screenReason, null, isMain,
        group.filter(x => x.uid !== r.uid).map(x => x.uid).join(";") || null,
        r.c?.cites_id || pub?.cites_id || null,
        rowTool,
        rowPub?.title || null,
        // §4.6: `cited_earliest_date` is the date of MY cited paper. The docx's
        // "Earliest date (preprint, else journal received)" line is the earliest
        // public date of the CITING paper — it is what the Heras timeline set
        // exists to prove against the 25 Apr 2024 filing — so it goes to the
        // citing columns. Scholar's year for the cited publication is what the
        // record actually holds for the cited side.
        rowPub ? String(rowPub.year || "") : null, null,
        (r.c?.title || e.doc_title || "").replace(/…$/, "").trim(),
        (r.c?.full_authors ? parseAuthors(r.c.full_authors) : null) || r.c?.authors_used || e.doc_authors || null,
        senior, null, null,
        r.c?.venue || e.doc_venue || null,
        articleYear || pub?.year || null,
        e.earliest || null, wasPreprint,
        e.published || null,
        (r.c?.work_type || "article"),
        r.c?.link || null,
        r.c?.patent_number || null,
        rowProject, tier,
        tier === "A" ? "Materials and Methods" : (tier === "B" ? "Results / Figures" : null),
        // §4.6: `page` is where the tool appears in the citing ARTICLE, which the
        // docx does not record — it says "Methods", not "p.14". Leaving it NULL
        // keeps the column honest; scan-mentions.js fills it from the PDF. The
        // catalog's page is the row's position on a Scholar exhibit sheet, a
        // different document, so it goes to exhibit_page.
        null,
        r.c?.page != null ? String(r.c.page) : null,
        quoteFrom(e.note),
        tier === "A" ? "Implemented" : (tier === "B" ? "Verified" : null),
        alreadyFiled, 0,
        r.c?.is_non_english ? "Non-English" : "English",
        e.note ? "docx note" : "no note",
        primary?.relOut || null,
        primary ? `Citations/${path.relative(PDF_ROOT, primary.abs).split(path.sep).join("/")}` : null,
        r.c?.base ? `${r.c.base}.pdf` : null,
        notes.join(" ") || null
      );
      if (status === "included") report.included++; else report.screened++;
    }
  }

  console.log(DRY ? "[dry run]" : "");
  console.log(`included rows: ${report.included} | screened/held: ${report.screened} | file rows: ${report.files} | PDFs copied: ${copied}`);
  if (report.missingPdf.length) { console.log("MISSING SOURCE PDFS:"); report.missingPdf.forEach(p => console.log("  ", p)); }

  db.close();
  cat.close();
}

/**
 * The already-filed set, read from Original-Application-Citations.md — a document
 * generated by the record's own tooling from the 19 PDFs in that folder. Its table
 * carries the row_uid for each match, so there is no need to guess by surname.
 *
 * Only uids inside "## The 19 files" count. The "## Rows needing confirmation"
 * section is deliberately excluded: that match is weaker evidence and the document
 * itself says a person must confirm it before treating it as the same paper.
 */
function originalApplicationUids() {
  const set = new Set();
  const p = path.join(PDF_ROOT, "Notable Citations in Original Application", "Original-Application-Citations.md");
  if (!fs.existsSync(p)) return set;
  const md = fs.readFileSync(p, "utf8").replace(/\r\n/g, "\n");
  const start = md.indexOf("## The 19 files");
  const end = md.indexOf("## Rows needing confirmation");
  const body = start === -1 ? "" : md.slice(start, end === -1 ? md.length : end);
  for (const m of body.matchAll(/`(cit-\d+)`/g)) set.add(m[1]);
  return set;
}

main();

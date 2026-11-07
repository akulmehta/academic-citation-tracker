"use strict";
/**
 * Generate PACKET-STATUS.md — the open-items document for the applicant.
 *
 * The lawyer's document is packet.html. This is the other one: what is NOT in
 * the packet and why, so nothing looks simply forgotten. §7 requires every
 * `held` row to appear here as an open item.
 *
 * Everything below is read out of the packet database and the record. Nothing is
 * typed by hand, so the document cannot drift from the data. It states findings
 * and asks questions; it does not argue the case, and it never states a legal
 * conclusion (§1.3).
 *
 * Literal markdown is written as single-quoted strings throughout: a backtick in
 * prose inside a template literal silently terminates it. Interpolated lines
 * concatenate instead.
 *
 *   node scripts/build-status.js          # dry run to stdout
 *   node scripts/build-status.js --write  # write PACKET-STATUS.md
 */
const fs = require("fs");
const path = require("path");
const { PKT, openPacket, openCatalog } = require("./lib.js");

const DRY = !process.argv.includes("--write");
const OUT = path.join(PKT, "PACKET-STATUS.md");
const TODAY = new Date().toISOString().slice(0, 10);

const esc = s => String(s == null ? "" : s).replace(/\|/g, "\\|").replace(/\s+/g, " ").trim();
const short = (s, n) => {
  const t = esc(s);
  return t.length > n ? t.slice(0, n - 1) + "\u2026" : t;
};

const db = openPacket();
const cits = db.prepare(`SELECT * FROM citation`).all();
const files = db.prepare(`SELECT * FROM file`).all();
const cands = db.prepare(`SELECT * FROM candidate`).all();
const candBy = new Map(cands.map(c => [c.row_uid, c]));
const included = cits.filter(r => r.status === "included");
const held = cits.filter(r => r.status === "held");
const screened = cits.filter(r => r.status === "screened-out");
const foldersIncluded = [...new Set(included.map(r => r.folder_uid))];

const L = [];
const push = (s) => L.push(s === undefined ? "" : s);

push("# Packet status \u2014 open items");
push();
push("Generated " + TODAY + " by `scripts/build-status.js`. **Do not hand-edit it** \u2014 re-run the");
push("script. Every count and every row below is read from `notable-citations.sqlite` at run time,");
push("so this document cannot quietly fall behind the data.");
push();
push("This document is for the applicant, not for counsel. [`packet.html`](./packet.html) is the");
push("lawyer's document and contains only the citations that are ready to present. The rows listed");
push("here are deliberately **not** in it: they are unobtainable, unverified, or waiting on a");
push("decision that only a person can make.");
push();

/* ---------------------------------------------------------------- */
push("## 1. Where the packet stands");
push();
push("| | count |");
push("|---|---:|");
push("| Citations in the packet (in `packet.html`) | " + included.length + " |");
push("| Works those citations are filed as (\u00a75.1 folders) | " + foldersIncluded.length + " |");
push("| PDFs filed under `papers/` | " + files.length + " |");
push("| Held \u2014 open items, listed below | " + held.length + " |");
push("| Screened out \u2014 decided, kept for the record (\u00a74.5) | " + screened.length + " |");
push("| **Rows in table `citation`** | **" + cits.length + "** |");
push();
push("`packet.csv` holds the " + included.length + " included rows. `screened-out.csv` holds the other "
  + (held.length + screened.length) + ",");
push("because \u00a74.5 exports `screened-out` and `held` together \u2014 counsel is entitled to see that the");
push("work was screened and on what grounds. A screened-out row is not missing work: it is the");
push("record of what was looked at and rejected, with the reason beside it. A held row is open, and");
push("every held row appears in \u00a72 below.");
push();

/* ---------------------------------------------------------------- */
push("## 2. Held rows \u2014 " + held.length + " open items");
push();

// Group by what is actually stopping the row, derived from the row and its
// candidate record rather than from any hand-maintained label.
function reason(r) {
  if (r.pdf_file) {
    if (r.scan_tier) return "read";
    if (r.scan_note) return "unsupported";
    return "unread";
  }
  const c = candBy.get(r.row_uid);
  return c ? c.discover_state : "unknown";
}
const groups = new Map();
for (const r of held) {
  const k = reason(r);
  if (!groups.has(k)) groups.set(k, []);
  groups.get(k).push(r);
}
const order = ["read", "unread", "unsupported", "paywalled", "no-open-copy", "not-in-indexes", "unknown", "untried"];
const blurb = {
  read: "The PDF is filed and the applicant's tool appears in a section of the paper. What is missing is the applicant's reading: a location on its own is not a claim about how the tool was used (\u00a71.1).",
  unread: "The PDF is filed. Nobody has read it yet.",
  unsupported: "The PDF is filed, but the extracted text does not support a use in any section \u2014 the mentions sit in the reference list, in a table, or under a heading the paper did not print. Either re-read the page and record what it says, or screen the row out.",
  paywalled: "A copy exists behind a paywall. If the applicant can obtain the PDF through an institution, drop it in the folder and the row can be read.",
  "no-open-copy": "No openly accessible copy was found. The publisher's landing page is given so the applicant can check institutional access.",
  "not-in-indexes": "Neither PubMed nor OpenAlex returned the work, so there was nothing to fetch. These tend to be theses, book chapters, or commercial pages.",
  unknown: "No candidate record explains this row.",
  untried: "No attempt was made to find a copy.",
};
for (const k of order) {
  const rows = groups.get(k);
  if (!rows || !rows.length) continue;
  push();
  push("### 2." + (order.indexOf(k) + 1) + " `" + k + "` \u2014 " + rows.length + " row(s)");
  push();
  push(blurb[k]);
  push();
  push("| row_uid | tool | year | senior author | citing title | link |");
  push("|---|---|---|---|---|---|");
  const sorted = rows.slice().sort((a, b) => String(a.citing_year || "9999").localeCompare(String(b.citing_year || "9999")) || a.row_uid.localeCompare(b.row_uid));
  for (const r of sorted) {
    const url = r.citing_url || (candBy.get(r.row_uid) ? candBy.get(r.row_uid).link : null);
    const link = url ? "[open](" + url + ")" : "\u2014";
    push("| `" + r.row_uid + "` | " + (esc(r.cited_tool) || "\u2014") + " | " + (esc(r.citing_year) || "\u2014")
      + " | " + (esc(r.citing_senior_author) || "\u2014") + " | " + short(r.citing_title, 76) + " | " + link + " |");
  }
}

/* ---------------------------------------------------------------- */
push();
push("## 3. Decisions the packet is waiting on");
push();
push("These are not defects. Each is a question whose answer changes what the packet says, so it is");
push("recorded here rather than resolved by a script.");
push();

// 3.1 — the project mapping.
const projCounts = {};
for (const r of cits) {
  const k = r.project || "(blank)";
  projCounts[k] = (projCounts[k] || 0) + 1;
}
push("### 3.1 The paper \u2192 project number mapping is an inference, not a decision");
push();
push("\u00a75.3 of the instructions names the four projects, copied verbatim from the Research Background");
push("Inquiry Form. **Nothing in the repository, and nothing in the applicant's own notes, maps a");
push("specific PI paper to a project number.** The assignment below is the assistant's reading of");
push("those titles. It drives the section headings in `packet.html`, so it should be confirmed before");
push("counsel relies on them:");
push();
push("| cited paper | project as filed |");
push("|---|---|");
const toolProj = new Map();
for (const r of cits) if (r.cited_tool) toolProj.set(r.cited_tool, r.project);
for (const [t, p] of [...toolProj.entries()].sort()) push("| " + esc(t) + " | " + (esc(p) || "*(blank)*") + " |");
push();
push("Distribution over all " + cits.length + " rows: "
  + Object.entries(projCounts).map(([k, v]) => "`" + k + "` = " + v).join(", ") + ".");
push();
push("If a number is wrong, the single place to change it is `toolForCitedPaper` /");
push("`projectForCitedPaper` in [`scripts/lib.js`](./scripts/lib.js), then re-run the importer and");
push("`scripts/render-packet.js --write`.");
push();

// 3.2 — where the applicant filed the PDF vs the tier on the row.
const folderTier = p => {
  const s = String(p || "");
  if (/In Acknowledgements/i.test(s)) return "D";
  if (/In Results and Figures/i.test(s)) return "B";
  if (/In high reputation/i.test(s)) return "C";
  if (/In Methods/i.test(s)) return "A";
  return null;
};
const misplaced = cits.filter(r => r.tier && folderTier(r.source_pdf) && folderTier(r.source_pdf) !== r.tier);
push("### 3.2 Rows whose tier disagrees with the folder the applicant filed them in");
push();
if (!misplaced.length) {
  push("None. Every filed PDF sits in the folder that matches its tier.");
} else {
  push("\u00a71.1 ranks a citation by where the citing paper mentions the tool, and the applicant's own");
  push("folders record that reading \u2014 `In Methods`, `In Results and Figures`, `In Acknowledgements`.");
  push("These rows carry a tier that does not match the folder they came from. The importer takes the");
  push("applicant's note as the authority and the folder as a secondary signal, which is usually right");
  push("\u2014 but where the gap could matter to counsel, it is here:");
  push();
  push("| row_uid | filed from | folder implies | row carries |");
  push("|---|---|---|---|");
  for (const r of misplaced) {
    push("| `" + r.row_uid + "` | `" + esc(r.source_pdf) + "` | tier " + folderTier(r.source_pdf)
      + " | tier " + esc(r.tier) + " |");
  }
  push();
  push("`cit-000521` is the ordinary case: the applicant filed it under `In Methods` but recorded the");
  push("use as tier B (Results). The scanner finds GLAD in a Results figure caption *and* in Methods");
  push("on p.10, so both readings have something behind them and \u00a73.3 lists it again.");
  push();
  push("`cit-000542` is the case worth a decision. The applicant's note records **both** a Methods");
  push("sentence \u2014 *\"Glycan Array Dashboard (version 3.1) was used to analyze and visualize the");
  push("glycan array data.\"* \u2014 **and** an Acknowledgments line thanking the applicant by name, which");
  push("is presumably why the PDF was filed under `In Acknowledgements`. The same note records that");
  push("the analysis used a **lectin array, not a glycan microarray**. The row sits in the packet at");
  push("tier A on the strength of the Methods sentence. That is a defensible reading, but it is a");
  push("reading, and counsel should know the paper also thanks the applicant personally. Decide");
  push("whether to keep it, demote it, or hand it over with both quotations and let counsel weigh it.");
}
push();

// 3.3 — the scanner and the applicant disagree, on rows that are IN the packet.
const disagreements = included.filter(r => r.tier && r.scan_tier && r.tier !== r.scan_tier);
const unsupportedIncluded = included.filter(r => r.tier && !r.scan_tier && r.scan_note);
// A row can be in the second group for two quite different reasons, and saying
// "no support in the text at all" about both would be wrong. If the row carries a
// quotation, `record-evidence.js --check` has already proved those words are on
// that page of that PDF; what the scanner failed to do is recognise the TOOL in
// them, because the citation is made by reference number (`…procedures [125–127]`,
// `…are unclear⁶⁹`) rather than by name. That is a limit of the scanner, not a gap
// in the evidence, and the two cases must not read the same to counsel.
const quoteChecked = r => String(r.quote || "").trim().length > 0;
const nameNotFound = unsupportedIncluded.filter(quoteChecked);
const noQuoteAtAll = unsupportedIncluded.filter(r => !quoteChecked(r));
push("### 3.3 Included rows where the article text reads differently than the note");
push();
if (!disagreements.length && !unsupportedIncluded.length) {
  push("None. On every included row with a readable PDF, the section the scanner located agrees with");
  push("the tier the applicant recorded.");
} else {
  push("The scanner reports what it read in a separate column (`scan_tier`) and never overwrites the");
  push("applicant's `tier`. It cannot see a figure or judge prose the way a reader can, so a");
  push("disagreement is a prompt to re-read the page, not a correction. These rows stay in the");
  push("packet until a person says otherwise:");
  push();
  if (disagreements.length) {
    push("**The tool is in a section, but a different one than recorded:**");
    push();
    push("| row_uid | recorded | scanner read | where the scanner looked |");
    push("|---|---|---|---|");
    for (const r of disagreements) {
      push("| `" + r.row_uid + "` | tier " + esc(r.tier) + ", " + esc(r.section) + " p." + esc(r.page)
        + " | tier " + esc(r.scan_tier) + " | " + short(r.scan_note, 110) + " |");
    }
    push();
  }
  if (nameNotFound.length) {
    push("**The row's quotation is verified in the PDF, but the scanner could not find the tool's NAME:**");
    push();
    push("These are cited by reference number, not by name, so no text scan can place them; the");
    push("quotation was checked against the filed PDF by `record-evidence.js --check`, and the");
    push("`evidence_basis` column says how the reference number was resolved.");
    push();
    push("| row_uid | recorded | how the citation appears | basis |");
    push("|---|---|---|---|");
    for (const r of nameNotFound) {
      push("| `" + r.row_uid + "` | tier " + esc(r.tier) + ", " + esc(r.section) + " p." + esc(r.page)
        + " | " + short(r.scan_note, 90) + " | " + esc(r.evidence_basis || "unstated") + " |");
    }
    push();
  }
  if (noQuoteAtAll.length) {
    push("**The recorded tier has no support in the extracted text, and no quotation is filed:**");
    push();
    push("| row_uid | recorded | what the text shows |");
    push("|---|---|---|");
    for (const r of noQuoteAtAll) {
      push("| `" + r.row_uid + "` | tier " + esc(r.tier) + ", " + esc(r.section) + " p." + esc(r.page)
        + " | " + short(r.scan_note, 130) + " |");
    }
  }
}
push();

// 3.4 — the independence finding.
//
// Three columns can carry a citing paper's byline, and checking only Scholar's short
// `authors` string misses the case that matters: `cit-000511` shows "TR McKitrick,
// CK Goth, CS Rosenberg… - Communications …, 2020 - nature.com" (ellipsis, no PI),
// its `full_authors` JSON is the 10-name list Scholar rendered, and it is the
// corroborating PubMed record in `external_authors` that ends "…, Cooper MD,
// Cummings RD". A check that reads only the first two says "None found" about the one
// row that proves why corroboration exists.
push("### 3.4 A citing paper whose byline names one of the two PIs");
push();
const PI = /\b(cummings|desai)\b/i;
const flagged = [];
const stale = [];
let catErr = null;
try {
  const cat = openCatalog();
  const get = cat.prepare(`SELECT row_uid, status, authors, full_authors, external_authors,
                                  corroboration, confirm_state, external_source
                           FROM citations WHERE row_uid = ?`);
  for (const r of cits) {
    const c = get.get(r.row_uid);
    if (!c) continue;
    const where = [];
    if (PI.test(c.authors || "")) where.push("Scholar's short byline");
    if (PI.test(c.full_authors || "")) where.push("Scholar's full byline");
    if (PI.test(c.external_authors || "")) where.push("the corroborating " + (c.external_source || "external") + " record");
    if (!where.length) continue;
    const dependent = /^dependent$/i.test(c.status || "");
    if (r.status === "included" && dependent) stale.push({ row: r, cat: c, where });
    flagged.push({ row: r, cat: c, where, dependent });
  }
  cat.close();
} catch (err) {
  catErr = err.message;
}
if (catErr) {
  push("*(The record could not be read for this check: " + esc(catErr) + ".)*");
} else if (flagged.length) {
  push("A surname in one of the byline sources for the rows below matches the applicant's PI or the");
  push("former PI. Where the record has settled the row as dependent, \u00a71.2 keeps it out of the packet");
  push("altogether \u2014 a citation sharing an author is not independent evidence of anyone else's work.");
  push();
  push("| row_uid | packet status | record status | byline source naming the PI | where the name appears |");
  push("|---|---|---|---|---|");
  for (const f of flagged) {
    push("| `" + f.row.row_uid + "` | " + esc(f.row.status) + " | " + esc(f.cat.status)
      + " | " + (f.dependent ? "already DEPENDENT" : "**still called independent**")
      + " | " + f.where.join("; ") + " |");
  }
  if (flagged.some(f => !f.dependent)) {
    push("Where a row is still called independent, the name may belong to a different person with the");
    push("same surname \u2014 Cummings and Desai are common \u2014 but independence is not judged on a maybe,");
    push("so the row stays out until the applicant and counsel say otherwise.");
  }
  if (stale.length) {
    push();
    push("**Rows the packet still calls included while the record calls them dependent:**");
    push(stale.map(s => "`" + s.row.row_uid + "`").join(", ")
      + ". These must be removed from `packet.html` before the packet goes out.");
  }
} else {
  push("None found: no row in the packet has a byline naming Cummings or Desai, in Scholar's rendering");
  push("or in the corroborating external record.");
}
push();

// 3.4b — the candidate snapshot is a copy, and copies go stale.
// The snapshot was taken when the seed ran; the record keeps re-classifying rows as
// corroboration arrives. A row whose snapshot still reads INDEPENDENT while the record
// has settled it DEPENDENT is not a live finding, and must never be promoted to
// included on the strength of the snapshot.
{
  let snapStale = [];
  let snapErr = null;
  try {
    const cat = openCatalog();
    const rows = db.prepare(`SELECT row_uid, status, is_highlighted FROM candidate`).all();
    const get = cat.prepare(`SELECT status FROM citations WHERE row_uid = ?`);
    for (const r of rows) {
      const c = get.get(r.row_uid);
      if (!c) continue;
      const snapSaysInd = /^independent$/i.test(r.status || "") || r.is_highlighted === 1;
      if (snapSaysInd && /^dependent$/i.test(c.status)) snapStale.push({ row: r, rec: c });
    }
    cat.close();
  } catch (err) { snapErr = err.message }
  if (snapErr) {
    push("### 3.4b Candidate rows whose snapshot disagrees with the record");
    push();
    push("*(The record could not be read for this check: " + esc(snapErr) + ".)*");
    push();
  } else if (snapStale.length) {
    push("### 3.4b Candidate rows whose snapshot disagrees with the record");
    push();
    push("Table `candidate` is a **snapshot** taken when the seed ran, and the record keeps working.");
    push("These rows were seeded as independent and the record has since settled them as dependent:");
    push();
    push("| row_uid | snapshot | record now | packet status |");
    push("|---|---|---|---|");
    for (const s of snapStale) {
      const inPkt = cits.find(x => x.row_uid === s.row.row_uid);
      push("| `" + s.row.row_uid + "` | INDEPENDENT, highlighted | " + esc(s.rec.status) + " | "
        + (inPkt ? esc(inPkt.status) : "not in table `citation`") + " |");
    }
    push();
    push("Do not file one of these, and do not fix the snapshot to make the two agree: the record is");
    push("right and the snapshot is merely old. Re-check independence from the record immediately");
    push("before downloading a PDF or drafting prose about any candidate (\u00a71.2).");
    push();
  }
}

// 3.5 — missing quotations.
const noQuote = included.filter(r => !r.quote);
push("### 3.5 Included citations with no verbatim quotation");
push();
if (!noQuote.length) {
  push("None. Every included row quotes a sentence from the citing paper.");
} else {
  push("\u00a77 asks that each quotation be verbatim and carry a page, so counsel can check a claim");
  push("against the PDF without hunting for it. These rows carry a tier and a section but no sentence");
  push("\u2014 usually because the tool is named only in a figure caption or a table, where there is no");
  push("sentence to lift. That is a legitimate finding, but it should be written down rather than");
  push("left blank:");
  push();
  push("| row_uid | tool | tier | section | page of the citing article |");
  push("|---|---|---|---|---|");
  for (const r of noQuote) {
    push("| `" + r.row_uid + "` | " + (esc(r.cited_tool) || "\u2014") + " | " + (esc(r.tier) || "\u2014") + " | "
      + (esc(r.section) || "\u2014") + " | " + (r.page ? esc(r.page) : "**missing**") + " |");
  }
}
push();

// 3.6 — an included citation whose folder holds no PDF.
const noPdf = foldersIncluded.filter(f => !files.some(x => x.folder_uid === f));
push("### 3.6 An included citation with no PDF in the packet");
push();
if (!noPdf.length) {
  push("None. Every citation in `packet.html` has the article filed beside it.");
} else {
  push("These works are in the lawyer's document, but the folder named after them is empty, so");
  push("counsel is asked to accept a claim they cannot check against the article. Either obtain the");
  push("PDF or move the row to `held` until one exists:");
  push();
  push("| row_uid | tool | tier | citing work | link |");
  push("|---|---|---|---|---|");
  for (const f of noPdf) {
    const r = cits.find(x => x.folder_uid === f);
    push("| `" + f + "` | " + (esc(r.cited_tool) || "\u2014") + " | " + (esc(r.tier) || "\u2014") + " | "
      + short(r.citing_title, 70) + " | " + (r.citing_url ? "[open](" + r.citing_url + ")" : "\u2014") + " |");
  }
}
push();

// 3.7 — narrative.
const narrRows = db.prepare(`SELECT * FROM narrative`).all();
const narr = narrRows.map(r => r.folder_uid);
const needNarr = foldersIncluded.filter(f => !narr.includes(f));
// Attribution lives here, once, rather than beside every paragraph in the HTML.
const byValues = [...new Set(narrRows.map(r => r.written_by).filter(Boolean))];
const onValues = [...new Set(narrRows.map(r => r.written_on).filter(Boolean))].sort();
const applicantOnly = byValues.length > 0 && byValues.every(b => /applicant/i.test(b) && !/draft|preparer|assistant/i.test(b));

push(applicantOnly
  ? "### 3.7 The narrative fields"
  : "### 3.7 The narrative fields are a preparer's draft awaiting the applicant's approval");
push();
if (needNarr.length) {
  push(`\u00a75.3 asks for a short written account per citation \u2014 objectives, importance, how the work was`);
  push(`used, findings. ${needNarr.length} of ${foldersIncluded.length} works still have none:`);
  push();
  push("| folder | citing work |");
  push("|---|---|");
  for (const f of needNarr) {
    const r = cits.find(x => x.folder_uid === f);
    push("| `" + f + "` | " + short(r ? r.citing_title : "", 80) + " |");
  }
  push();
}
if (narrRows.length) {
  push(`The ${narrRows.length} narrative(s) on file are written into the \`narrative\` table by`);
  push("`scripts/narrative-intake.js`, which refuses a paragraph that names no page number or a");
  push("page beyond the length of the filed PDF. Who wrote each one is recorded in that table's");
  push("`written_by` and `written_on` columns; it is deliberately **not** printed in `packet.html`,");
  push("which would repeat the same sentence 56 times.");
  push();
  push(`Recorded authorship: ${byValues.map(b => `\`${esc(b)}\``).join(", ") || "(none recorded)"}.`);
  push(`Written on: ${onValues.join(", ") || "(no date recorded)"}.`);
  push();
  if (!applicantOnly) {
    push("**These paragraphs are not the applicant's own wording.** Every sentence is drawn from the");
    push("cited article and carries the page it rests on, so each claim can be checked, but a");
    push("statement about why the citing authors did what they did should read as the applicant's");
    push("judgement before counsel relies on it. Review, correct and approve them, then have");
    push("`narrative-intake.js` record `written_by` as the applicant so the provenance changes with");
    push("the words. An invented sentence in this section is worse than a blank one.");
    push();
  }
}

// 3.8 — the working advice that the renderer never prints.
const withNote = narrRows.filter(r => r.preparer_note).sort((a, b) => a.folder_uid.localeCompare(b.folder_uid));
if (withNote.length) {
  push("### 3.8 Working advice held out of the document (`preparer_note`)");
  push();
  push("Each narrative row also carries a `preparer_note`: recommendations about **the packet** —");
  push("which tier to file a folder at, what it is good for, what not to claim from it. Those are");
  push("not observations about the citing article, so `render-packet.js` never reads the column and");
  push("they appear nowhere in `packet.html` or the printed PDF. `narrative-intake.js` rejects a");
  push("sentence of that kind in the four rendered columns, which is what keeps the split from");
  push("quietly re-merging. This is the only place the advice is written down.");
  push();
  for (const r of withNote) {
    const c = cits.find(x => x.folder_uid === r.folder_uid);
    push("**`" + r.folder_uid + "`** — " + short(c ? c.citing_title : "", 70));
    push(": " + esc(String(r.preparer_note).trim()));
    push();
  }
}

/* ---------------------------------------------------------------- */
push("## 4. Data notes a reader of the CSVs would otherwise trip over");
push();
let nn = 0;
const note = (title, body) => { nn++; push("### 4." + nn + " " + title); push(); push(body); push(); };

const noTool = cits.filter(r => !r.cited_tool);
if (noTool.length) {
  note("A row whose cited paper is not one of the four tools",
    "| row_uid | cited paper |\n|---|---|\n"
    + noTool.map(r => "| `" + r.row_uid + "` | " + short(r.cited_paper, 110) + " |").join("\n")
    + "\n\nThe tier and project columns are **blank** on this row on purpose. Its `cited_paper` is a\n"
    + "different work, so a tier recorded for GLAD or MAWE would describe a paper this row does not\n"
    + "cite. Borrowing the value from a sibling row in the same folder is what \u00a75 forbids.");
}

const perFolder = new Map();
for (const r of cits) perFolder.set(r.folder_uid, (perFolder.get(r.folder_uid) || 0) + 1);
const twoTitle = [...perFolder.entries()].filter(([f, k]) => k > 1
  && new Set(cits.filter(r => r.folder_uid === f).map(r => r.citing_title)).size > 1);
if (twoTitle.length) {
  note("One work, two titles",
    twoTitle.map(([f]) => "`" + f + "`").join(" and ") + " hold two rows with **different citing\n"
    + "titles**. That is not an error: Google Scholar lists the work twice, once under its preprint\n"
    + "title and once under its journal title, and the folder exists precisely to show the dates.\n"
    + "The identity rests on the applicant's note and the DOI chain, not on the title, and\n"
    + "`validate-packet.js` accepts it only because the folder files both a preprint and an article.");
}

const dupPdf = new Map();
for (const f of files) {
  if (!dupPdf.has(f.file)) dupPdf.set(f.file, []);
  dupPdf.get(f.file).push(f.folder_uid);
}
const shared = [...dupPdf.entries()].filter(([, v]) => v.length > 1);
if (shared.length) {
  note("One PDF serving two folders",
    shared.map(([f, v]) => "`" + path.basename(f) + "` is filed under both " + v.map(x => "`" + x + "`").join(" and ")).join("; ")
    + ".\nThose are two catalog rows for the same citing article, so one copy of the file does the\n"
    + "work. `packet-files.csv` records the byte count once per row and both entries match the file\n"
    + "on disk.");
}

note("Two different dates, in two different columns",
  "- `cited_earliest_date` is the date of **the applicant's cited paper** (\u00a74.6).\n"
  + "- `citing_earliest_date` is the earliest public date of **the citing paper** \u2014 the timeline\n"
  + "  figure the Heras set exists to establish against the 25 Apr 2024 filing.\n\n"
  + "The citation summary's \"Earliest date (preprint, else journal received)\" line is the second of\n"
  + "these. It was imported into the first column, which meant a row citing GLAD (2019) printed\n"
  + "\"29 Apr 2023\" under *Cited Paper(s)*. `scripts/fix-row-scoped-fields.js` separated them; it is\n"
  + "re-runnable, dry-run by default, and refuses to write if the invariant fails.");

note("A byline year is not a publication date",
  "`cited_earliest_date` comes from the record's `publications.year`, which is what Google Scholar\n"
  + "prints beside the applicant's paper. It is not a verified date, and for a chapter or a reference\n"
  + "work it can be the date of the parent volume. Where a precise date matters, use the `file`\n"
  + "table's `shows_date` and `date_basis`, which record what a filed PDF itself prints.");

note("The scanner's reading lives in its own columns",
  "`scan_tier`, `scan_note` and `scanned_on` record what the location scanner read on its last run.\n"
  + "They are rewritten every run and are never the basis of a claim in the packet: `tier`, `section`\n"
  + "and `quote` remain the applicant's fields, and \u00a71.3 forbids a script overwriting them. If\n"
  + "`scanned_on` is older than the newest PDF, re-run `node scripts/scan-mentions.js --write`.");

// 4.x — how each PDF got here. Written because "the PDFs were downloaded" is a claim that
// has to survive being asked "by what, and from where, and what is still missing?".
{
  const cands = db.prepare(`SELECT * FROM candidate`).all();
  const bySource = new Map();
  for (const c of cands) {
    if (!c.pdf_file) continue;
    const s = c.pdf_source || "(no source recorded)";
    if (!bySource.has(s)) bySource.set(s, []);
    bySource.get(s).push(c);
  }
  const dl = [...bySource.entries()].sort((a, b) => b[1].length - a[1].length);
  const dlRows = dl.reduce((n, [, v]) => n + v.length, 0);
  const dlFiles = new Set();
  for (const [, v] of dl) for (const c of v) dlFiles.add(c.pdf_file);
  const imported = files.filter(f => !cands.some(c => c.pdf_file === f.file));
  const importedFolders = [...new Set(imported.map(f => f.folder_uid))];
  const openUnfetched = db.prepare(`SELECT COUNT(*) n FROM candidate
    WHERE discover_state='open-copy' AND (pdf_file IS NULL OR pdf_file='')`).get().n;
  const stateCounts = db.prepare(`SELECT discover_state, COUNT(*) n FROM candidate GROUP BY 1 ORDER BY n DESC`).all();

  let body = "Every PDF in `papers/` arrived one of two ways, and the distinction matters because\n"
    + "only the first is reproducible from a script.\n\n"
    + "**Fetched by `discover-pdfs.js`** — " + dlRows + " candidate row(s) across " + dlFiles.size
    + " distinct file(s), each recorded with the host it came from:\n\n"
    + "| host | rows | row_uid(s) |\n|---|---:|---|\n"
    + dl.map(([s, v]) => "| " + s + " | " + v.length + " | " + v.map(c => "`" + c.row_uid + "`").join(", ") + " |").join("\n")
    + "\n\nAll of them are open-access copies resolved through OpenAlex and taken from the publisher.\n\n"
    + "**Placed in the folder by the applicant** — " + importedFolders.length + " folder(s) hold a file that\n"
    + "no candidate row claims as its fetch: " + importedFolders.map(x => "`" + x + "`").join(", ") + ".\n"
    + "These came from the `In Methods` / `In Acknowledgements` imports and were registered into table\n"
    + "`file`; nothing downloaded them.\n\n"
    + "**No PDF was ever retrieved from NCBI.** `discover-pdfs.js` has no E-utilities download path at\n"
    + "all, so the NCBI key in `.env` is used for author corroboration, not for fetching. Any statement\n"
    + "that these papers came from PubMed Central would be wrong.\n\n"
    + "Discovery state of all " + cands.length + " GLAD candidates, from `candidate.discover_state`:\n\n"
    + "| state | rows | meaning |\n|---|---:|---|\n";
  const MEANING = {
    "has-pdf": "a PDF was already filed when the candidate list was seeded",
    "open-copy": "an open-access copy was located; the row is only `has-pdf` once the file is on disk",
    "paywalled": "located behind a paywall — the applicant may be able to obtain these",
    "no-open-copy": "looked, nothing retrievable found",
    "not-in-indexes": "not found in the open-access indexes consulted",
  };
  body += stateCounts.map(s => "| `" + s.discover_state + "` | " + s.n + " | " + (MEANING[s.discover_state] || "\u2014") + " |").join("\n");
  body += "\n\n**Still open:** " + openUnfetched + " row(s) sit at `open-copy` with no file on disk \u2014 a copy was\n"
    + "located and never fetched. Chasing them is a decision, not a defect: a row must be independent\n"
    + "(\u00a71.2) before it is worth a download, and " + db.prepare(`SELECT COUNT(*) n FROM candidate WHERE screen_state='held'`).get().n
    + " candidate(s) are already held \u2014 check why before spending effort on a PDF for a row that\n"
    + "cannot be filed.";
  note("How each PDF got here, and what is still missing", body);
}

/* ---------------------------------------------------------------- */
push("## 5. Before handing the packet over");
push();
push("`node scripts/validate-packet.js` checks the mechanical items in \u00a77 and exits non-zero on any");
push("failure. Run it after every change. What it cannot check:");
push();
push("- **Nothing outside this folder was written.** The validator reports what `git status` shows in");
push("  the Independent Citation Record. The record is opened read-only by `openCatalog()`, which has");
push("  no write path, so this is a belt-and-braces check rather than the control itself.");
push("- **The narrative fields and the missing quotations** (\u00a73.5, \u00a73.7) need the applicant's");
push("  approval. The drafted narratives are drawn from the articles and every sentence names its");
push("  page, but they are a preparer's wording until the applicant adopts them; a packet with a");
push("  blank narrative is still usable, one with an unapproved narrative is not.");
push("- **The open decisions written up in \u00a73.8.** Recommendations about the packet are kept out of");
push("  the document itself, so they are listed there instead \u2014 including whether `cit-000542` is");
push("  filed as a Methods use or as an acknowledgment, which would take it out of the packet.");
push("  Read that section before the document is handed over.");
push("- **`print/packet.pdf`** must be produced from the browser's print dialog once the content is");
push("  final (\u00a75.4).");
push("- **The project mapping** (\u00a73.1) and the **tier-vs-folder question** (\u00a73.2) need the");
push("  applicant's decision.");
push("- **Whether a held row is worth chasing at all.** \u00a72 lists what is missing, not what it would");
push("  prove. That judgement is the applicant's.");
push();

const text = L.join("\n") + "\n";
if (DRY) {
  process.stdout.write(text);
  console.log("\n--- dry run: " + text.split("\n").length + " lines, " + text.length + " bytes. Re-run with --write. ---");
} else {
  fs.writeFileSync(OUT, text, "utf8");
  console.log("PACKET-STATUS.md: " + text.split("\n").length + " lines, " + (text.length / 1024).toFixed(1) + " KB");
}
db.close();

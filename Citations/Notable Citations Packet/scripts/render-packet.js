// Render the lawyer-facing packet from the packet database, and export the CSVs.
//
// Everything on the page comes from `notable-citations.sqlite`. Nothing is read
// from the Independent Citation Record here, and nothing outside this folder is
// written: the packet is a projection of its own table, which is what lets the
// summary counts and the citation list agree by construction.
//
// Narrative subsections (Objectives, Importance to Field, How and Why Your Work
// Was Used, Findings) are counsel's argument, not a fact we may infer. Where the
// database has no text for one, the section is emitted as a marked blank and the
// row is listed in PACKET-STATUS.md as an open item. A generated sentence about
// what a paper did would be an unsupported claim in a filing.

const fs = require("fs");
const path = require("path");
const { PKT, openPacket } = require("./lib");

const argv = process.argv.slice(2);
const DRY = argv.includes("--dry");

const PROJECTS = {
  "1": "Synthesizing Anticoagulants with Reduced Side Effects",
  "2": "Developing Bioinformatics Tools to Capture and Analyze Glycomics and Glycan Microarray Data",
  "3": "Advancing Glycan Research with Microarray Innovations",
  "4": "Advancing Glycopeptide Synthesis with Glyco-SPOT",
};

const TIER_LABEL = {
  A: "Tier A — the tool is used in the Methods as the method performed",
  B: "Tier B — the tool is used in the Results or Figures",
  C: "Tier C — cited in a high-reputation publication",
  D: "Tier D — acknowledged",
};

function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Quote an HTML attribute value for a path that may contain spaces. */
function href(p) {
  return esc(String(p).split("/").map(seg => encodeURIComponent(seg)).join("/"));
}

/* ------------------------------------------------------------------ */
/* read                                                               */
/* ------------------------------------------------------------------ */
function read(db) {
  const citations = db.prepare(`SELECT * FROM citation ORDER BY COALESCE(n, 999), folder_uid, row_uid`).all();
  const files = db.prepare(`SELECT * FROM file ORDER BY folder_uid, file`).all();
  const byFolder = new Map();
  for (const f of files) {
    if (!byFolder.has(f.folder_uid)) byFolder.set(f.folder_uid, []);
    byFolder.get(f.folder_uid).push(f);
  }
  // Every recorded appearance, strongest tier first, so a Methods use and an
  // Acknowledgements thanks both reach counsel instead of only the best one.
  const mentions = db.prepare(`SELECT * FROM mention ORDER BY row_uid, INSTR('ABCD', tier), CAST(page AS INTEGER)`).all();
  const byRow = new Map();
  for (const m of mentions) {
    if (!byRow.has(m.row_uid)) byRow.set(m.row_uid, []);
    byRow.get(m.row_uid).push(m);
  }
  const narratives = new Map(db.prepare("SELECT * FROM narrative").all().map(n => [n.folder_uid, n]));
  const included = citations.filter(c => c.status === "included");
  const screened = citations.filter(c => c.status !== "included");

  // One section per citing WORK (folder), not per citation row: Vasta and
  // Guérardel each produce four citations to one article, and a reader must see
  // four citations of one paper rather than four papers.
  const works = new Map();
  for (const c of included) {
    if (!works.has(c.folder_uid)) works.set(c.folder_uid, { folder: c.folder_uid, main: null, rows: [] });
    const w = works.get(c.folder_uid);
    w.rows.push(c);
    if (c.is_main) w.main = c;
  }
  for (const w of works.values()) {
    if (!w.main) w.main = w.rows[0];
    w.files = byFolder.get(w.folder) || [];
  }
  return { citations, files, byFolder, included, screened, works: [...works.values()], byRow, narratives };
}

/**
 * Every place one row's tool appears, as "Methods p.5; Acknowledgments p.12".
 *
 * Falls back to the row's own single section/page when no mention rows exist, so
 * a row nobody has re-read still prints what the database holds rather than
 * nothing. The fallback is marked with a dagger so the two are not confused.
 */
/** "Materials and Methods (3.2 CFG glycan array)" -> "Methods": one short, uniform label for the index. */
function shortSection(s) {
  return String(s || "—").replace(/\s*\(.*\)\s*$/, "").replace(/^Materials and Methods$/i, "Methods").trim();
}
function whereList(c, byRow) {
  const ms = byRow.get(c.row_uid) || [];
  if (!ms.length) {
    return { text: `${shortSection(c.section)}${c.page ? ` p.${c.page}` : ""} †`, many: false, mentions: [] };
  }
  const seen = new Set(), parts = [];
  for (const m of ms) {
    const k = `${shortSection(m.section)} p.${m.page}`;
    if (!seen.has(k)) { seen.add(k); parts.push(k); }
  }
  return { text: parts.join("; "), many: parts.length > 1, mentions: ms };
}
/** The cited work as the index shows it: the tool's name, or the first words of the paper's title. */
function citedLabel(c) {
  if (c.cited_tool) return c.cited_tool;
  const w = String(c.cited_paper || "").split(/\s+/).filter(Boolean);
  if (!w.length) return "—";
  return w.slice(0, 6).join(" ") + (w.length > 6 ? "…" : "") + (c.cited_earliest_date ? ` (${c.cited_earliest_date})` : "");
}

/* ------------------------------------------------------------------ */
/* summary                                                            */
/* ------------------------------------------------------------------ */
function countBy(rows, key) {
  const m = new Map();
  for (const r of rows) {
    const k = r[key] || "(unset)";
    m.set(k, (m.get(k) || 0) + 1);
  }
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

function summarySection(data) {
  const tiers = countBy(data.included, "tier");
  const tools = countBy(data.included, "cited_tool");
  const projects = countBy(data.included.map(c => ({ ...c, project: PROJECTS[c.project] || c.project || "(unset)" })), "project");
  const reasons = countBy(data.screened, "screen_reason");

  // Distinct works vs citation rows: the distinction is the whole point of the
  // index, so the summary states both rather than letting a reader assume they
  // are the same number.
  const worksCovered = new Set(data.included.map(c => c.folder_uid)).size;
  const withPdf = data.included.filter(c => c.pdf_file);

  const bar = (entries, unit) => `
    <div class="bars">${entries.map(([k, v]) => `
      <div class="bar-row"><span class="bar-label">${esc(k)}</span>
        <span class="bar-track"><span class="bar-fill" style="width:${Math.max(2, Math.round(v / entries[0][1] * 100))}%"></span></span>
        <span class="bar-num">${v}</span></div>`).join("")}
    </div>
    <p class="unit">${esc(unit)}</p>`;

  return `
<section id="summary">
  <h2>Summary</h2>
  <p class="lede">${data.included.length} citations to the applicant's own publications, from
     ${worksCovered} distinct citing articles, are documented in this packet. Each is placed at the
     section of the citing paper where the reference actually appears.</p>
  <div class="grid3">
    <div><h3>By tier</h3>${bar(tiers, "Tier A: the tool is the method performed, in Materials and Methods.")}</div>
    <div><h3>By applicant tool</h3>${bar(tools, "One citing article may use more than one of the applicant's tools.")}</div>
    <div><h3>By research project</h3>${bar(projects, "Project titles are quoted verbatim from the Research Background Inquiry Form. Which project a given paper belongs to was proposed by the preparer and is not taken from the Form — see the note at each project heading.")}</div>
  </div>
  <h3>Screened out</h3>
  <p>${data.screened.length} candidate citations were examined and are <em>not</em> argued in this
     packet. They are listed in the appendix with the reason, so the screening is on the record:</p>
  <ul>${reasons.map(([k, v]) => `<li>${esc(k)} — ${v}</li>`).join("") || "<li>none</li>"}</ul>
  <h3>PDFs</h3>
  <p>${withPdf.length} of the ${data.included.length} included citations have a PDF of the citing
     paper in this packet. Open items, including any citation still awaiting a PDF, are listed in
     <code>PACKET-STATUS.md</code>.</p>
</section>`;
}

/* ------------------------------------------------------------------ */
/* index                                                              */
/* ------------------------------------------------------------------ */
function indexSection(data) {
  const rows = [];
  for (const c of data.included) {
    const w = data.works.find(x => x.folder === c.folder_uid);
    const lead = c.is_main;
    const pdfs = w.files;
    const links = pdfs.length
      ? pdfs.map(f => `<a href="${href(f.file)}">${esc(f.role)}</a>`).join(" · ")
      : `<span class="missing">PDF pending</span>`;
    rows.push(`
      <tr class="${lead ? "lead" : "sub"}" data-search="${esc(`${c.row_uid} ${c.citing_title} ${c.citing_senior_author} ${c.cited_tool}`)}">
        <td class="num">${lead ? esc(c.n) : ""}</td>
        <td class="uid">${esc(c.row_uid)}</td>
        <td class="title">${lead
          ? `<a href="#c-${esc(c.folder_uid)}">${esc(c.citing_title)}</a>${w.rows.length > 1 ? ` <span class="tag">${w.rows.length} citations</span>` : ""}`
          : `<span class="same">as above</span>`}</td>
        <td>${esc(c.cited_earliest_date || "—")}${c.cited_was_preprint ? ' <span class="tag">preprint</span>' : ""}</td>
        <td>${esc(c.citing_published_date || c.citing_year || "—")}${c.citing_earliest_date ? `<br><span class="sub">earliest public: ${esc(c.citing_earliest_date)}</span>` : ""}</td>
        <td>${esc(citedLabel(c))}</td>
        <td>${esc(whereList(c, data.byRow).text)}</td>
        <td>${esc(c.citing_senior_author || "—")}</td>
        <td>${esc(c.citing_article_type || "—")}</td>
        <td class="files">${links}</td>
      </tr>`);
  }
  return `
<section id="index">
  <h2>Index of citations</h2>
  <p><input id="filter" type="search" placeholder="Filter by row_uid, title, senior author or tool" aria-label="Filter index"></p>
  <table class="index" id="index-table">
    <thead><tr>
      <th>#</th><th>row_uid</th><th>Citing paper</th><th>Earliest date of cited paper</th>
      <th>Citing paper published</th><th>My work cited</th><th>Section &amp; page</th>
      <th>Senior author</th><th>Article type</th><th>PDF in packet</th>
    </tr></thead>
    <tbody>${rows.join("")}</tbody>
  </table>
  <p class="note">The number is the citing article's number in this packet, given once per article.
     Where a citing article cites more than one of the applicant's papers, the additional citations
     are listed beneath it as “as above”, each with its own <code>row_uid</code>. The date shown
     for each citing paper is when its final article went online; an earlier preprint is shown
     (“earliest public”) only where it bears on the petition date.</p>
  <p class="note">A citation that appears in more than one place in the article lists every place,
     strongest first. A dagger (&dagger;) marks a row whose locations have not yet been re-read
     page by page, so only the single best-known location is shown.</p>
</section>`;
}

/* ------------------------------------------------------------------ */
/* per-citation sections                                              */
/* ------------------------------------------------------------------ */
const NARRATIVE = [
  ["Objectives", "3–4 sentences on what the citing authors set out to do."],
  ["Importance to Field", "2–3 sentences on why that mattered."],
  ["How and Why Your Work Was Used", "4–5 sentences on the role the applicant's tool played."],
  ["Findings / Conclusions / Recommendation", "4–5 sentences on what they concluded."],
];

/** Which narrative column answers which heading. */
const NARR_COL = {
  "Objectives": "objectives",
  "Importance to Field": "importance",
  "How and Why Your Work Was Used": "how_used",
  "Findings / Conclusions / Recommendation": "findings",
};

/**
 * One narrative subsection.
 *
 * Who wrote the paragraph is recorded in the `narrative` table (`written_by`,
 * `written_on`) and stated once in `PACKET-STATUS.md`; it is not printed beside
 * every paragraph. The page number each statement rests on is in the prose itself,
 * which is what a reader actually needs on the page.
 */
function narrativeText(c, data, heading, hint) {
  const col = NARR_COL[heading];
  const n = data.narratives.get(c.folder_uid);
  const body = n && n[col];
  if (!body) return `<p class="blank">To be written by the applicant. ${esc(hint)}</p>`;
  return String(body).split(/\n{2,}/).map(p => `<p>${esc(p)}</p>`).join("");
}

/**
 * The "Where the citation appears" cell: every location, each labelled with the
 * tier it earns, so a Methods use and an Acknowledgements thanks are not blurred
 * into whichever one is strongest.
 */
function whereDetail(c, byRow) {
  const ms = byRow.get(c.row_uid) || [];
  if (!ms.length) {
    return `${esc(c.section || "—")}${c.page ? `, page ${esc(c.page)}` : ""} — ${esc(TIER_LABEL[c.tier] || c.tier || "")}` +
      ` <span class="sub">(single recorded location; not yet re-read page by page)</span>`;
  }
  return ms.map(m =>
    `<strong>${esc(m.section)}</strong>, page ${esc(m.page)} — ${esc(TIER_LABEL[m.tier] || m.tier)}` +
    `${m.use_type ? ` · ${esc(m.use_type)}` : ""}`
  ).join("<br>");
}

/**
 * Section II. Every recorded appearance gets its own blockquote, because the
 * quotation is what makes the location believable and counsel may want the
 * Acknowledgements thanks as well as the Methods sentence.
 */
function quotesBlock(c, byRow) {
  const ms = (byRow.get(c.row_uid) || []).filter(m => m.quote);
  if (!ms.length) {
    // Nothing recorded per-occurrence: fall back to the single quote the row holds.
    return c.quote
      ? `<div class="quote"><blockquote>&ldquo;${esc(c.quote)}&rdquo;</blockquote>` +
        `<p class="cite-page">${esc(c.section || "")}${c.page ? `, p. ${esc(c.page)}` : ""}</p></div>`
      : `<div class="quote"><p class="blank">No verbatim quote recorded. A quotation has to be taken from the PDF and
          checked word for word before it goes to counsel — see <code>PACKET-STATUS.md</code>.</p></div>`;
  }
  return ms.map(m => `
  <div class="quote">
    <blockquote>&ldquo;${esc(m.quote)}&rdquo;</blockquote>
    <p class="cite-page">${esc(m.section)}, p.&nbsp;${esc(m.page)} — ${esc(TIER_LABEL[m.tier] || m.tier)}</p>
  </div>`).join("");
}

/**
 * A citing article often cites more than one of the applicant's papers, and each
 * of those is its own row with its own location and quotation. The main row's
 * quotes are Section II above; without this block the additional rows would show
 * up in the index but their evidence would never reach counsel in the entry.
 */
function secondaryQuotesBlock(others, byRow) {
  return others.map(r => {
    const ms = (byRow.get(r.row_uid) || []).filter(m => m.quote);
    const head = `<p class="subhead"><code>${esc(r.row_uid)}</code> — additional citation of
                  ${esc(r.cited_paper || r.cited_tool || "another of the applicant's papers")}</p>`;
    if (ms.length) return head + quotesBlock(r, byRow);
    return head + (r.quote
      ? `<div class="quote"><blockquote>&ldquo;${esc(r.quote)}&rdquo;</blockquote>` +
        `<p class="cite-page">${esc(r.section || "")}${r.page ? `, p. ${esc(r.page)}` : ""}</p></div>`
      : `<div class="quote"><p class="blank">No verbatim quote recorded for this row.</p></div>`);
  }).join("");
}

function citationSection(c, w, files, data) {
  const others = w.rows.filter(r => r.row_uid !== c.row_uid);
  const fileList = files.length
    ? `<ul class="files-list">${files.map(f => `<li><a href="${href(f.file)}">${esc(f.file.split("/").pop())}</a>` +
        ` <span class="role">${esc(f.role)}</span>` +
        (f.shows_date ? ` — dated ${esc(f.shows_date)} (${esc(f.date_basis || "date shown in the file")})` : "") +
        `</li>`).join("")}</ul>`
    : `<p class="blank">No PDF yet for this citation. See <code>PACKET-STATUS.md</code>.</p>`;

  return `
<article class="citation" id="c-${esc(c.folder_uid)}">
  <h3>${esc(c.citing_title)}</h3>
  <p class="byline">${esc(c.citing_authors || "")}<br>
     <span class="venue">${esc(c.citing_venue || "")}${c.citing_year ? `, ${esc(c.citing_year)}` : ""}</span>
     ${c.citing_url ? ` · <a href="${esc(c.citing_url)}">${esc(new URL(c.citing_url).host)}</a>` : ""}</p>

  <h4>Section I — Background</h4>
  <dl>
    <dt>Cited Paper(s)</dt>
    <dd>${esc(c.cited_paper || "—")}
        ${c.cited_earliest_date ? `<br><span class="sub">${esc(c.cited_earliest_date)}${c.cited_was_preprint ? " (preprint)" : ""}</span>` : ""}</dd>
    <dt>Additional citations from this citing paper</dt>
    <dd>${others.length ? others.map(r => {
      const wl = whereList(r, data.byRow);
      return `<code>${esc(r.row_uid)}</code> — ${esc(r.cited_paper || r.cited_tool || "")}
              <span class="sub">(${esc(wl.text)})</span>`;
    }).join("<br>") : "none"}</dd>
    <dt>Citing Paper</dt>
    <dd>${esc(c.citing_title)} <span class="sub">(${esc(c.citing_article_type || "article")})</span>
        ${c.citing_earliest_date ? `<br><span class="sub">Earliest public date: ${esc(c.citing_earliest_date)}${c.citing_was_preprint ? " (preprint)" : ""}</span>` : ""}</dd>
    <dt>Project Number</dt>
    <dd>${c.project ? `${esc(c.project)} — ${esc(PROJECTS[c.project] || "")}` : `<span class="blank">Not assigned — this row cites a paper other than the four tools, so no project applies. Confirm with the applicant.</span>`}</dd>
    <dt>Citing Authors' Institutions</dt>
    <dd>${c.citing_institutions ? esc(c.citing_institutions) : `<span class="blank">Not recorded — confirm from the PDF's affiliation block.</span>`}</dd>
    <dt>Citing Article Type</dt>
    <dd>${esc(c.citing_article_type || "—")}</dd>
    <dt>Where the citation appears</dt>
    <dd>${whereDetail(c, data.byRow)}</dd>
  </dl>

  <h4>Section II — Overview of use</h4>
  ${quotesBlock(c, data.byRow)}
  ${secondaryQuotesBlock(others, data.byRow)}

  ${NARRATIVE.map(([h, hint]) => `
  <h5>${esc(h)}</h5>
  ${narrativeText(c, data, h, hint)}`).join("")}

  <h4>Files</h4>
  ${fileList}
  <p class="trace"><code>${esc(c.row_uid)}</code>${c.additional_row_uids ? ` · additional rows ${esc(c.additional_row_uids)}` : ""}
     ${c.exhibit_pdf ? ` · Scholar exhibit <em>${esc(c.exhibit_pdf)}</em> (Independent Citation Record, not enclosed here)` : ""}</p>
</article>`;
}

function sectionsBlock(data) {
  const out = [];
  // The four project TITLES are quoted from the Research Background Inquiry Form, but
  // nothing in the applicant's notes or the citation record maps a particular paper to a
  // particular number — that grouping was proposed by the preparer. Counsel should not
  // read a section heading as the applicant's own statement, so the packet says so where
  // the headings are used, not only in a status file counsel never opens.
  out.push(`
<p class="blank" id="project-note">The project titles below are quoted verbatim from the Research
Background Inquiry Form. <strong>The grouping of individual papers under those titles was proposed
by the preparer</strong> — the Form does not list which publication belongs to which project — and
should be confirmed or corrected by the applicant before the packet is relied on.</p>`);
  for (const proj of ["1", "2", "3", "4"]) {
    const mains = data.works.filter(w => w.main.project === proj).sort((a, b) => (a.main.n ?? 999) - (b.main.n ?? 999));
    if (!mains.length) continue;
    out.push(`
<section class="project" id="project-${proj}">
  <h2>Project ${proj} — ${esc(PROJECTS[proj])}</h2>
  <p class="projcount">${mains.length} citing article(s), ${mains.reduce((s, w) => s + w.rows.length, 0)} citation(s).</p>
  ${mains.map(w => citationSection(w.main, w, w.files, data)).join("")}
</section>`);
  }
  const orphans = data.works.filter(w => !PROJECTS[w.main.project]);
  if (orphans.length) {
    out.push(`<section class="project"><h2>Project not assigned</h2>
      ${orphans.map(w => citationSection(w.main, w, w.files, data)).join("")}</section>`);
  }
  return out.join("\n");
}

/* ------------------------------------------------------------------ */
/* screened-out appendix                                              */
/* ------------------------------------------------------------------ */
function appendixSection(data) {
  const groups = countBy(data.screened, "screen_reason");
  return `
<section id="screened">
  <h2>Appendix — candidates screened out</h2>
  <p>These citations were examined and are not argued in the packet. They are listed so the
     screening is on the record.</p>
  ${groups.map(([reason]) => {
    const rows = data.screened.filter(c => c.screen_reason === reason);
    return `<h3>${esc(reason)} (${rows.length})</h3>
    <table class="small"><thead><tr><th>row_uid</th><th>Title</th><th>Senior author</th><th>Venue</th><th>Year</th></tr></thead>
    <tbody>${rows.map(c => `<tr><td class="uid">${esc(c.row_uid)}</td><td>${esc(c.citing_title)}</td>
      <td>${esc(c.citing_senior_author || "—")}</td><td>${esc(c.citing_venue || "—")}</td><td>${esc(c.citing_year || "—")}</td></tr>`).join("")}</tbody></table>`;
  }).join("")}
</section>`;
}

/* ------------------------------------------------------------------ */
/* document                                                           */
/* ------------------------------------------------------------------ */
function render(db) {
  const data = read(db);
  const today = new Date().toISOString().slice(0, 10);
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Notable Citations — Akul Mehta</title>
<script src="vendor/d3.min.js"></script>
<style>
  :root { --ink:#1b1b1b; --muted:#666; --rule:#d8d8d8; --accent:#7a1f1f; --paper:#fff; }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--paper); color:var(--ink);
         font:16px/1.55 "Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif; }
  main { max-width: 60rem; margin: 0 auto; padding: 2.5rem 1.5rem 6rem; }
  h1 { font-size:2.1rem; line-height:1.2; margin:.2rem 0 .4rem; }
  h2 { font-size:1.4rem; margin:2.6rem 0 .6rem; padding-bottom:.3rem; border-bottom:2px solid var(--accent); }
  h3 { font-size:1.08rem; margin:1.8rem 0 .3rem; }
  h4 { font-size:.78rem; letter-spacing:.09em; text-transform:uppercase; color:var(--accent); margin:1.4rem 0 .4rem; }
  h5 { font-size:.95rem; margin:1.1rem 0 .2rem; }
  p { margin:.4rem 0; }
  a { color:var(--accent); }
  code { font-family:"SFMono-Regular",Consolas,monospace; font-size:.85em; background:#f3f3f3; padding:.05em .3em; border-radius:3px; }
  .title-page { border-bottom:1px solid var(--rule); padding-bottom:1.4rem; }
  .kicker { font-size:.75rem; letter-spacing:.14em; text-transform:uppercase; color:var(--muted); }
  .lede { font-size:1.05rem; }
  .grid3 { display:grid; grid-template-columns:repeat(auto-fit,minmax(15rem,1fr)); gap:1.2rem; margin-top:1rem; }
  .bar-row { display:grid; grid-template-columns:1fr 5rem 2rem; align-items:center; gap:.4rem; font-size:.82rem; }
  .bar-track { background:#eee; height:.7rem; border-radius:2px; overflow:hidden; }
  .bar-fill { display:block; height:100%; background:var(--accent); opacity:.75; }
  .bar-num { text-align:right; font-variant-numeric:tabular-nums; }
  .unit { font-size:.75rem; color:var(--muted); }
  table { border-collapse:collapse; width:100%; font-size:.82rem; }
  .index th, .index td { border-bottom:1px solid var(--rule); padding:.4rem .35rem; vertical-align:top; text-align:left; }
  .index thead th { border-bottom:2px solid var(--ink); font-size:.72rem; text-transform:uppercase; letter-spacing:.04em; }
  .index tr.sub td { background:#fbf9f7; }
  .index tr.lead td.title { font-weight:600; }
  .small th, .small td { border-bottom:1px solid var(--rule); padding:.3rem; text-align:left; vertical-align:top; font-size:.8rem; }
  .uid, .num { font-family:"SFMono-Regular",Consolas,monospace; font-size:.76rem; white-space:nowrap; color:var(--muted); }
  .tag { font-size:.66rem; text-transform:uppercase; letter-spacing:.05em; background:#efe7e2; color:#5a3a2a; border-radius:3px; padding:.05em .35em; }
  .same { color:var(--muted); font-style:italic; }
  .missing { color:#9a6b00; font-size:.78rem; }
  .note, .trace, .sub { font-size:.78rem; color:var(--muted); }
  .subhead { font-size:.82rem; color:var(--muted); margin:.9rem 0 .1rem; font-weight:600; }
  article.citation.subquote .subhead + .quote { margin-top:.1rem; }
  article.citation { border-top:1px solid var(--rule); padding-top:1rem; margin-top:1.6rem; }
  article.citation:first-of-type { border-top:none; }
  dl { display:grid; grid-template-columns:13rem 1fr; gap:.2rem .8rem; font-size:.9rem; margin:.3rem 0; }
  dt { font-weight:600; } dd { margin:0; }
  blockquote { margin:.4rem 0 .2rem; padding:.5rem .9rem; border-left:3px solid var(--accent);
               background:#faf7f5; font-style:italic; }
  .blank { font-size:.85rem; color:#9a6b00; background:#fffaf0; border:1px dashed #e0c98a; padding:.45rem .6rem; border-radius:4px; }
  .files-list { font-size:.85rem; } .role { color:var(--muted); font-size:.75rem; text-transform:uppercase; letter-spacing:.05em; }
  #filter { width:100%; padding:.5rem .7rem; font-size:.9rem; border:1px solid var(--rule); border-radius:5px; }
  @media print {
    body { font-size:11pt; } main { max-width:none; padding:0; }
    #filter { display:none; } a { color:inherit; text-decoration:none; }
    h2 { break-after:avoid; }
    /*
     * "break-inside:avoid" on article.citation looked right and printed badly:
     * most entries are taller than a sheet once the quotation and file list are
     * included, and when a block cannot fit, Chromium breaks it anyway — after
     * whatever happens to fit, leaving the remainder alone on a fresh sheet.
     * Fourteen of the first thirty-five pages held nothing but a file list.
     *
     * So avoid breaks on the small things that must not be split (a quotation, a
     * definition row, a heading and what follows it) and let the entry itself flow.
     */
    article.citation { orphans:3; widows:3; }
    article.citation > h3 { break-after:avoid; }
    blockquote, .blank, .files-list { break-inside:avoid; }
    .subhead { break-after:avoid; }
    dt, dd { break-inside:avoid; }
    .title-page { break-after:page; }
    /* The index is a table; let it repeat its header on every sheet it spans. */
    thead { display:table-header-group; }
    tr { break-inside:avoid; }
  }
</style>
</head>
<body>
<main>
<div class="title-page">
  <p class="kicker">Evidence packet — notable citations</p>
  <h1>Citations to the applicant's publications</h1>
  <p class="lede"><strong>Akul Mehta</strong> — prepared for counsel in connection with the
     response to the Request for Evidence.</p>
  <p class="note">Generated ${today} from <code>notable-citations.sqlite</code> in this folder.
     ${data.included.length} citations · ${data.works.length} citing articles ·
     ${data.files.length} PDFs. Independence of each citing paper was established in the
     Independent Citation Record; this packet does not restate that analysis.</p>
</div>
${summarySection(data)}
${indexSection(data)}
${sectionsBlock(data)}
${appendixSection(data)}
</main>
<script>
(function () {
  var input = document.getElementById("filter");
  if (!input) return;
  input.addEventListener("input", function () {
    var q = input.value.trim().toLowerCase();
    document.querySelectorAll("#index-table tbody tr").forEach(function (tr) {
      tr.style.display = !q || (tr.dataset.search || "").toLowerCase().indexOf(q) !== -1 ? "" : "none";
    });
  });
})();
</script>
</body>
</html>`;

  const out = path.join(PKT, "packet.html");
  if (!DRY) fs.writeFileSync(out, html, "utf8");
  console.log(`packet.html: ${(html.length / 1024).toFixed(0)} KB | ${data.included.length} citations, ${data.works.length} works, ${data.files.length} files`);
  return data;
}

/* ------------------------------------------------------------------ */
/* CSV exports — projections of the same table the HTML reads          */
/* ------------------------------------------------------------------ */
function csvCell(v) {
  if (v == null) return "";
  const s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function toCsv(cols, rows) {
  return [cols.join(","), ...rows.map(r => cols.map(c => csvCell(r[c])).join(","))].join("\r\n") + "\r\n";
}

function exportCsv(db) {
  const cCols = ["row_uid","folder_uid","n","status","screen_reason","is_main","additional_row_uids","cited_tool",
    "cited_paper","cited_earliest_date","cited_was_preprint","citing_title","citing_authors","citing_senior_author",
    "citing_venue","citing_year","citing_earliest_date","citing_was_preprint","citing_published_date","citing_article_type","citing_url","project","tier",
    "section","page","exhibit_page","quote","use_type","in_original_petition","negative","language","evidence_basis",
    "pdf_file","source_pdf","exhibit_pdf","notes"];
  // Table `file` has its own columns (§4.4). Writing it with the citation header
  // produced a CSV where every cell but `folder_uid` and `source_pdf` was blank
  // and the `file` path — the one thing the export exists to carry, and the thing
  // that says which storage root a PDF lives in — was missing entirely.
  const fCols = ["folder_uid","file","source_pdf","role","shows_date","date_basis","cited","bytes"];
  const all = db.prepare(`SELECT * FROM citation ORDER BY COALESCE(n,999), folder_uid`).all();
  const written = [];
  const write = (name, rows, cols) => {
    if (!DRY) fs.writeFileSync(path.join(PKT, name), toCsv(cols, rows), "utf8");
    written.push([name, rows.length]);
  };
  write("packet.csv", all.filter(r => r.status === "included"), cCols);
  write("screened-out.csv", all.filter(r => r.status !== "included"), cCols);
  write("packet-files.csv", db.prepare(`SELECT * FROM file ORDER BY folder_uid, file`).all(), fCols);
  const total = written.reduce((s, [, n]) => s + n, 0);
  console.log(`CSV: ${written.map(([n, k]) => `${n} (${k})`).join(", ")} | ${total} rows vs ${all.length + db.prepare("SELECT COUNT(*) c FROM file").get().c} table rows`);
}

function main() {
  const db = openPacket();
  const data = render(db);
  exportCsv(db);
  const blanks = data.included.filter(c => !c.quote);
  if (blanks.length) console.log(`\n${blanks.length} included citations still need a verbatim quote (marked in the HTML, listed in PACKET-STATUS.md).`);
  db.close();
}
main();

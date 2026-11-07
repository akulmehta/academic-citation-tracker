#!/usr/bin/env node
/**
 * potential_notable_citations.html — a REVIEW page, deliberately separate from packet.html.
 *
 * packet.html is the document counsel receives and contains only the citations the
 * applicant has confirmed. This page is the opposite: independent citations of one of
 * the applicant's works that are NOT in the packet, shown so the applicant can read
 * them and decide whether any should be transferred in. Nothing here is evidence yet,
 * and nothing here is printed into the packet.
 *
 * The screen, in the order it is applied, so the arithmetic on the page adds up:
 *
 *   1. Independent only. The catalog is the authority for independence, not the
 *      packet's `candidate` snapshot, which is taken at seed time and goes stale.
 *      A citing paper that shares an author with the cited work, or that names
 *      either PI, is a self-citation and is never a candidate (§2).
 *   2. Not already in the packet as a confirmed (`included`) citation.
 *   3. Not already used in the original application. Those are listed in
 *      `Citations/Notable Citations in Original Application/Original-Application-Citations.md`
 *      and re-submitting one would be a duplicate, not new evidence (§3).
 *   4. English, and the copy that stands for its work.
 *
 * A row is listed with the row_uid first, because that is the permanent handle:
 *   node scripts/record-tier-decision.js ...      (once it is in the packet)
 * and, to bring one in, the applicant names the uid and the pipeline runs
 * discover-pdfs -> file-pdf -> scan-mentions -> record-evidence for it.
 *
 * Read-only against everything. This script writes exactly one file, inside the
 * packet folder, and never opens the Independent Citation Record for writing (§0).
 *
 *   node scripts/build-potential.js                    # GLAD (the work with uncaptured citations)
 *   node scripts/build-potential.js --cited=GLAD
 *   node scripts/build-potential.js --write            # write the HTML
 */
const fs = require("fs");
const path = require("path");
const { PKT, openCatalog, openPacket, potentialIndependent } = require("./lib.js");

const argv = process.argv.slice(2);
const WRITE = argv.includes("--write");
const OUT = path.join(PKT, "potential_notable_citations.html");

function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Resolve the cited work by a name fragment so a re-capture cannot point at the wrong paper. */
function resolveCited(cat, frag) {
  const pubs = cat.prepare("SELECT cites_id, title, year, authors FROM publications").all();
  const re = new RegExp(frag.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
  const hits = pubs.filter(p => re.test(p.title));
  if (hits.length === 1) return hits[0];
  if (!hits.length) {
    console.error(`No publication title matches "${frag}".`);
    process.exit(1);
  }
  console.error(`"${frag}" matches ${hits.length} publications — be more specific:`);
  for (const h of hits) console.error(`  ${h.cites_id}  ${h.title} (${h.year})`);
  process.exit(1);
}

/** Titles Scholar renders with a link-type marker are still that work's title; keep it visible. */
function stripTrailingEllipsis(t) {
  return String(t || "").replace(/\s*…\s*$/, "").trim();
}

function hostOf(u) {
  try { return new URL(u).host; } catch { return ""; }
}

function main() {
  const cat = openCatalog();
  const db = openPacket();

  const cited = resolveCited(cat, argv.find(a => a.startsWith("--cited="))?.slice(8) || "GLAD");

  const packetRows = new Map(db.prepare("SELECT * FROM citation").all().map(r => [r.row_uid, r]));
  const cand = new Map(db.prepare("SELECT * FROM candidate").all().map(r => [r.row_uid, r]));
  const files = db.prepare("SELECT * FROM file ORDER BY folder_uid, file").all();
  const fileByFolder = new Map();
  for (const f of files) {
    if (!fileByFolder.has(f.folder_uid)) fileByFolder.set(f.folder_uid, []);
    fileByFolder.get(f.folder_uid).push(f);
  }

  // The screen itself lives in lib.potentialIndependent so the status report and
  // this page cannot disagree about what "potential" means.
  let screened;
  try {
    screened = potentialIndependent(cat, db, cited.cites_id);
  } catch (e) {
    console.error(e.message + " Refusing to guess which citations were already filed.");
    process.exit(1);
  }
  const { rows: pool, screen } = screened;

  const rows = pool.map(r => {
    const c = cand.get(r.row_uid) || {};
    const pkt = packetRows.get(r.row_uid);
    const pdfs = fileByFolder.get(r.row_uid) || [];
    // A candidate that shares a downloaded copy with another row points at the same file.
    const sharedPdf = !pdfs.length && c.pdf_file ? c.pdf_file : null;
    return {
      uid: r.row_uid,
      title: stripTrailingEllipsis(r.title),
      rawTitle: r.title,
      authors: r.authors || "",
      senior: c.senior_author || "",
      year: c.year || "",
      venue: (c.venue || "").replace(/\s*…\s*$/, ""),
      link: r.link || c.link || "",
      doi: r.doi || c.doi || "",
      workType: r.work_type || "",
      confirm: r.confirm_state || "",
      discover: c.discover_state || "not-queued",
      discoverNote: c.discover_note || "",
      pdfSource: c.pdf_source || "",
      pdfs, sharedPdf,
      inPacket: pkt ? pkt.status : "",
    };
  });

  const withPdf = rows.filter(r => r.pdfs.length || r.sharedPdf);
  const today = new Date().toISOString().slice(0, 10);

  const DISCOVER_LABEL = {
    "open-copy": "Open copy found",
    "paywalled": "Paywalled",
    "no-open-copy": "No open copy",
    "not-in-indexes": "Not in OpenAlex",
    "lookup-failed": "Look-up failed",
    "not-queued": "Not yet looked up",
  };
  const DISCOVER_CLASS = {
    "open-copy": "ok", "paywalled": "warn", "no-open-copy": "warn",
    "not-in-indexes": "warn", "lookup-failed": "bad", "not-queued": "warn",
  };

  const body = rows.map((r, i) => {
    const pdfCell = r.pdfs.length
      ? r.pdfs.map(f => `<a href="${esc(f.file)}">PDF</a>`).join(" ")
      : r.sharedPdf
        ? `<a href="${esc(r.sharedPdf)}">PDF</a> <span class="sub">(same work as another row)</span>`
        : `<span class="none">not retrieved</span>`;
    return `    <tr>
      <td class="uid">${esc(r.uid)}</td>
      <td class="title">${esc(r.title)}${r.rawTitle !== r.title ? ' <span class="sub">[title as Scholar shows it continues]</span>' : ""}
        ${r.authors ? `<div class="byline">${esc(r.authors)}</div>` : ""}</td>
      <td>${esc(r.senior || "—")}</td>
      <td>${esc(r.year || "—")}</td>
      <td>${esc(r.venue || "—")}</td>
      <td class="src">${r.link ? `<a href="${esc(r.link)}">${esc(hostOf(r.link) || "Scholar link")}</a>` : "—"}${r.doi ? `<div class="sub">${esc(r.doi)}</div>` : ""}</td>
      <td class="disc"><span class="pill ${DISCOVER_CLASS[r.discover] || "warn"}">${esc(DISCOVER_LABEL[r.discover] || r.discover)}</span>${r.discoverNote ? `<div class="sub">${esc(r.discoverNote)}</div>` : ""}</td>
      <td class="pdf">${pdfCell}</td>
      <td class="pick"><label><input type="checkbox"> include</label></td>
    </tr>`;
  }).join("\n");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Potential notable citations — ${esc(cited.title)}</title>
<style>
  :root { --ink:#1b1b1b; --muted:#666; --rule:#d8d8d8; --accent:#7a1f1f; }
  * { box-sizing: border-box; }
  body { margin:0; background:#fff; color:var(--ink);
         font:16px/1.55 "Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif; }
  main { max-width: 64rem; margin:0 auto; padding:2.5rem 1.5rem 5rem; }
  h1 { font-size:1.9rem; line-height:1.2; margin:.2rem 0 .4rem; }
  h2 { font-size:1.2rem; margin:2.2rem 0 .5rem; padding-bottom:.3rem; border-bottom:2px solid var(--accent); }
  p { margin:.5rem 0; }
  a { color:var(--accent); }
  code { font-family:"SFMono-Regular",Consolas,monospace; font-size:.85em; background:#f3f3f3; padding:.05em .3em; border-radius:3px; }
  .kicker { font-size:.75rem; letter-spacing:.14em; text-transform:uppercase; color:var(--muted); }
  .notice { border:1px solid #c9a227; background:#fdf7e3; padding:.9rem 1.1rem; margin:1.2rem 0; }
  .notice strong { color:#7a5c00; }
  .cited { background:#f6f1ec; border-left:3px solid #b08968; padding:.7rem 1rem; margin:1.2rem 0; font-size:.92rem; }
  table { border-collapse:collapse; width:100%; font-size:.8rem; margin-top:.8rem; }
  th, td { border-bottom:1px solid var(--rule); padding:.4rem .35rem; vertical-align:top; text-align:left; }
  thead th { border-bottom:2px solid var(--ink); font-size:.7rem; text-transform:uppercase; letter-spacing:.04em; }
  .uid { font-family:"SFMono-Regular",Consolas,monospace; font-size:.74rem; white-space:nowrap; }
  .title { min-width:16rem; }
  .byline { color:var(--muted); font-size:.74rem; margin-top:.15rem; }
  .sub { color:var(--muted); font-size:.7rem; }
  .src, .disc { font-size:.74rem; }
  .pdf { white-space:nowrap; }
  .none { color:var(--muted); font-style:italic; font-size:.72rem; }
  .pick { white-space:nowrap; font-size:.72rem; color:var(--muted); }
  .pill { display:inline-block; padding:.05rem .4rem; border-radius:9px; font-size:.68rem; white-space:nowrap; }
  .pill.ok { background:#e3f0e4; color:#26562a; }
  .pill.warn { background:#f6ecd9; color:#7a5c00; }
  .pill.bad { background:#f7e0e0; color:#7a1f1f; }
  .screen { font-size:.8rem; color:var(--muted); }
  .screen td { border:none; padding:.12rem .35rem; }
  .screen td.n { font-variant-numeric:tabular-nums; color:var(--ink); }
  .foot { margin-top:2rem; font-size:.75rem; color:var(--muted); border-top:1px solid var(--rule); padding-top:.8rem; }
  @media print {
    .pick, thead th.pick { display:none; }
    main { padding:0; }
    a { color:inherit; text-decoration:none; }
  }
</style>
</head>
<body>
<main>
<header>
  <p class="kicker">Review page — not part of the packet</p>
  <h1>Potential notable citations</h1>
  <div class="notice">
    <strong>This page is for the applicant&rsquo;s review, not for counsel.</strong>
    <code>packet.html</code> holds only the citations confirmed for the filing; nothing on this
    page is in it. Tick a row, or send the <code>row_uid</code>s, and the pipeline
    (<code>discover-pdfs.js</code> &rarr; <code>file-pdf.js</code> &rarr; <code>scan-mentions.js</code>
    &rarr; <code>record-evidence.js</code>) reads the full text, finds the section and page, and
    files it at the tier the text supports. Until that reading exists, no tier is claimed here.
  </div>
  <div class="cited">
    <strong>Cited work:</strong> ${esc(cited.title)} (${esc(cited.year || "—")})<br>
    <span class="sub">${esc(cited.authors || "")}</span>
  </div>
  <p>${rows.length} independent citations of this work are not in the packet and were not used in
     the original application. Each is a real, independently authored citation of the applicant&rsquo;s
     tool; what is not yet known is where in each article the citation sits, which is what decides
     its tier.</p>
  <table class="screen">
    <tr><td>Citing works the record lists for this paper</td><td class="n">${screen.total}</td></tr>
${screen.superseded ? `    <tr><td>less rows retired by a re-capture</td><td class="n">&minus;${screen.superseded}</td></tr>\n` : ""}    <tr><td>less not independent (shares an author with the cited work, or names a PI)</td><td class="n">&minus;${screen.dependent}</td></tr>
    <tr><td>less copies that do not stand for their work (preprint / repository twin)</td><td class="n">&minus;${screen.notStanding}</td></tr>
    <tr><td>less not listed in English</td><td class="n">&minus;${screen.nonEnglish}</td></tr>
    <tr><td>less already confirmed in the packet</td><td class="n">&minus;${screen.inPacket}</td></tr>
    <tr><td>less already used in the original application</td><td class="n">&minus;${screen.origApp}</td></tr>
    <tr><td><strong>listed here for review</strong></td><td class="n"><strong>${rows.length}</strong></td></tr>
  </table>
</header>

<h2>The ${rows.length} candidates</h2>
<table>
  <thead><tr>
    <th>row_uid</th><th>Citing paper</th><th>Senior author</th><th>Year</th><th>Venue</th>
    <th>Where it is</th><th>Open copy</th><th>PDF on file</th><th class="pick">Decision</th>
  </tr></thead>
  <tbody>
${body}
  </tbody>
</table>

<h2>Notes on the list</h2>
<p><strong>&ldquo;Open copy&rdquo; is a statement about access, not about the paper.</strong>
   <em>Open copy found</em> means a downloadable version exists and, where the PDF column has a
   link, it is already in this folder. <em>Paywalled</em> means the article is real and the
   publisher gates the file &mdash; an access the applicant&rsquo;s own subscription or an
   interlibrary loan can settle. <em>No open copy</em> and <em>Not in OpenAlex</em> mean the
   look-up completed and found nothing downloadable; they are not findings that the paper does
   not exist, and a publisher page or a library copy can still supply the text.</p>
<p><strong>Independence was re-checked against the citation record, not the queued snapshot.</strong>
   The record reads the complete author list of both papers. A citing paper that shares an author
   with the cited work, or that names Richard D. Cummings or the former PI Umesh R. Desai, is a
   self-citation and was removed at the first screen above.</p>
<p><strong>Tiers are deliberately absent.</strong> A tier is a claim about where a sentence sits in
   an article, and no article on this page has been read page by page. Filing one here would put a
   number behind a guess.</p>

<p class="foot">Generated ${today} by <code>scripts/build-potential.js</code> from
   <code>Database/citation-catalog.sqlite</code> (read-only) and
   <code>notable-citations.sqlite</code>. Not linked from <code>packet.html</code> and not printed
   with it. Independence screen: <code>status = INDEPENDENT</code> and
   <code>is_countable_independent = 1</code> on the active, standing, English row.</p>
</main>
</body>
</html>`;

  if (!WRITE) {
    console.log(`dry run — ${rows.length} candidate row(s), ${withPdf.length} with a PDF on file. Add --write.`);
    return;
  }
  fs.writeFileSync(OUT, html, "utf8");
  console.log(`wrote ${path.relative(PKT, OUT)} — ${(html.length / 1024).toFixed(0)} KB | ${rows.length} candidates, ${withPdf.length} with a PDF on file`);
}

main();

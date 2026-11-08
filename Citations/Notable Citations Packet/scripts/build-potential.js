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
 *   5. Not already decided against. A `screened-out` row keeps its record (§4.5)
 *      but must not be offered again — a row that stays on the page gets
 *      reconsidered from scratch by whoever reads it next.
 *
 * A row is listed with the row_uid first, because that is the permanent handle:
 *   node scripts/record-tier-decision.js ...      (once it is in the packet)
 * and, to bring one in, the applicant names the uid and the pipeline runs
 * discover-pdfs -> file-pdf -> scan-mentions -> record-evidence for it.
 *
 * The Tier and Citation columns carry a SCAN result, not a guess: they are filled
 * only for a candidate whose PDF is on file and was read by `scan-mentions.js`,
 * and an article that has not been read says so. A tier is a claim about where a
 * sentence sits in an article, so the claim travels with the sentence it came from
 * and with the section and page — see the per-article reports at the foot of the
 * page, which use the same structure as `packet.html`.
 *
 * Read-only against everything. This script writes only files inside the packet
 * folder, and never opens the Independent Citation Record for writing (§0).
 *
 *   node scripts/build-potential.js --all              # every queued cited work
 *   node scripts/build-potential.js --cited=GLAD
 *   node scripts/build-potential.js --cited=GlycoGlyph --write
 *
 * One page per cited work, because the screen printed at the top of a page is
 * arithmetic about ONE cited paper (its record total, less its dependents, less
 * its copies), and mixing two works in that table would misrepresent both. GLAD
 * keeps the original filename — the applicant, `PACKET-STATUS.md` §4 and
 * `validate-packet.js` all know it by that name — and any other work gets the
 * name suffixed with its tool. See `outFileFor`.
 */
const fs = require("fs");
const path = require("path");
const { PKT, openCatalog, openPacket, potentialIndependent, sameSentence, toolForCitedPaper } = require("./lib.js");

const argv = process.argv.slice(2);
const WRITE = argv.includes("--write");

/**
 * The review page for one cited work.
 *
 * GLAD keeps `potential_notable_citations.html` unchanged: renaming it would
 * break the applicant's own reference, `PACKET-STATUS.md` §4, and the link check
 * in `validate-packet.js`, for no gain. Every other work gets a suffixed page.
 */
function outFileFor(cited) {
  const tool = toolForCitedPaper(cited.title);
  if (!tool || tool === "GLAD") return path.join(PKT, "potential_notable_citations.html");
  return path.join(PKT, `potential_notable_citations-${tool.replace(/[^A-Za-z0-9]/g, "")}.html`);
}

/**
 * Same wording as `render-packet.js`, deliberately: a tier shown on the review
 * page has to mean exactly what it means in the packet, or a candidate looks
 * stronger or weaker here than it will once it is filed.
 */
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

/** Encode each path segment but keep the slashes, so a relative link still resolves. */
function href(p) {
  return esc(String(p).split("/").map(seg => encodeURIComponent(seg)).join("/"));
}

/**
 * Every external link opens in a new tab (§5.6): the page is a worklist someone
 * works down, and clicking a publisher link must not destroy the row they were
 * reading. Relative links — the PDFs inside this folder — stay in the tab.
 * `rel=noopener` so the opened page cannot reach back at this one through
 * `window.opener`.
 */
function extLink(url, label) {
  return `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>`;
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

function renderOne(cat, db, cited) {
  const OUT = outFileFor(cited);
  const packetRows = new Map(db.prepare("SELECT * FROM citation").all().map(r => [r.row_uid, r]));
  const cand = new Map(db.prepare("SELECT * FROM candidate").all().map(r => [r.row_uid, r]));
  const files = db.prepare("SELECT * FROM file ORDER BY folder_uid, file").all();
  // Every recorded place the work appears, including the citations that name no
  // tool. `scan-mentions.js` can only find a mention that spells GLAD out, so a
  // paper crediting the work as `[5–9]` or `(Mehta and Cummings 2019)` reads "no
  // tier" to it — and `scan-refs.js` resolves those into the mention table. Showing
  // only the scan would hide a real citation on a page whose whole purpose is to
  // help the applicant choose.
  const mentionsBy = new Map();
  for (const m of db.prepare(`SELECT * FROM mention
      ORDER BY row_uid, INSTR('ABCD', tier), CAST(page AS INTEGER)`).all()) {
    if (!mentionsBy.has(m.row_uid)) mentionsBy.set(m.row_uid, []);
    mentionsBy.get(m.row_uid).push(m);
  }
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
    const hasPdf = !!(pdfs.length || sharedPdf);
    // What a scan of that PDF concluded. `scan_tier` is set only when the tool's
    // mention sat under a heading the article itself printed and in prose (not a
    // reference entry or a table cell); `scan_note` then says why it did not.
    const scannedOn = pkt ? pkt.scanned_on : null;
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
      pdfs, sharedPdf, hasPdf,
      mentions: mentionsBy.get(r.row_uid) || [],
      inPacket: pkt ? pkt.status : "",
      scanTier: pkt ? pkt.scan_tier : null,
      scanNote: pkt ? pkt.scan_note : null,
      scannedOn: pkt ? pkt.scanned_on : null,
      section: pkt ? pkt.section : null,
      page: pkt ? pkt.page : null,
      quote: pkt ? pkt.quote : null,
      citesTool: pkt ? pkt.cited_tool : null,
      citedPaper: pkt ? pkt.cited_paper : null,
      citesId: pkt ? pkt.cites_id : null,
      url: pkt ? pkt.citing_url : null,
      venueFull: pkt ? pkt.citing_venue : null,
      authorsFull: pkt ? pkt.citing_authors : null,
      articleType: pkt ? pkt.citing_article_type : null,
      institutions: pkt ? pkt.citing_institutions : null,
      screening: pkt ? pkt.screen_reason : null,
    };
  });

  const scanned = rows.filter(r => r.hasPdf);
  const withPdf = scanned;
  const withTier = rows.filter(r => r.scanTier);
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

  const TIER_PILL = { A: "ok", B: "ok", C: "warn", D: "warn" };

  /** How a citation was found, in words a reader can weigh. */
  const BASIS_LABEL = {
    "reference-number resolution": "its reference number or author-year citation",
    "human reading": "a person reading the page",
  };

  /**
   * Tier cell — a scan result, never an inference from the title or venue.
   *
   * Two kinds of pill, and they mean different things:
   *   - `Tier A` — the named-tool scan found "GLAD" in prose under a heading the
   *     citing paper printed.
   *   - `Tier A — resolved` — the paper credits the work without naming it, and
   *     `scan-refs.js` identified the reference number or the author-year citation
   *     and recorded the sentence. Same tier bar, different route to it, so the
   *     page says which.
   */
  function tierCell(r) {
    if (r.scanTier) {
      return `<span class="pill ${TIER_PILL[r.scanTier] || "warn"}">Tier ${esc(r.scanTier)}</span>` +
        `<div class="sub">${esc(r.section || "")}${r.page ? `, p.\u00a0${esc(r.page)}` : ""}</div>`;
    }
    const res = bestResolved(r);
    if (res) {
      return `<span class="pill ${TIER_PILL[res.tier] || "warn"} resolved">Tier ${esc(res.tier)} &mdash; resolved</span>` +
        `<div class="sub">${esc(res.section)}${res.page ? `, p.\u00a0${esc(res.page)}` : ""}, named by ${esc(BASIS_LABEL[res.basis] || res.basis)}</div>`;
    }
    if (r.hasPdf) {
      return `<span class="pill bad">no tier</span>` +
        `<div class="sub">read ${esc(r.scannedOn || "\u2014")}, but no mention in a section that earns one</div>`;
    }
    return `<span class="none">not read</span>`;
  }

  /**
   * The strongest recorded mention that the named-tool scan did NOT already show.
   *
   * The scan's own verdict is printed from `citation.section`/`quote`, so a mention
   * recording the same sentence would be printed twice; `sameSentence` keeps the
   * two tools' two views of one line to one row.
   */
  function bestResolved(r) {
    for (const m of r.mentions) {
      if (m.basis === "extracted text") continue;
      if (r.scanTier && sameSentence(m.quote, r.quote)) continue;
      return m;
    }
    return null;
  }

  /**
   * Citation cell — the words the tier came from, so the judgement in the column
   * beside it can be checked without opening the PDF. The full sentence is at the
   * foot of the page; this is a working excerpt.
   */
  function citationCell(r) {
    if (r.scanTier && r.quote) {
      return quoteCell(r.quote, `${esc(r.section || "")}${r.page ? `, p.\u00a0${esc(r.page)}` : ""} \u00b7 `
        + `scanned ${esc(r.scannedOn || "\u2014")}`, r);
    }
    const res = bestResolved(r);
    if (res) {
      return quoteCell(res.quote, `${esc(res.section)}${res.page ? `, p.\u00a0${esc(res.page)}` : ""} \u00b7 `
        + `resolved ${esc(res.noted_on || "\u2014")}`, r);
    }
    if (r.hasPdf) {
      return `<span class="sub">${esc(shortNote(r.scanNote))}</span>` +
        `<div class="sub"><a href="#rep-${esc(r.uid)}">full report</a></div>`;
    }
    return `<span class="none">no PDF, so nothing has been quoted</span>`;
  }

  function quoteCell(text, where, r) {
    const q = text.length > 260 ? text.slice(0, 260).replace(/\s+\S*$/, "") + "\u2026" : text;
    return `<span class="q">&ldquo;${esc(q)}&rdquo;</span>` +
      `<div class="sub">${where} \u00b7 <a href="#rep-${esc(r.uid)}">full report</a></div>`;
  }

  /** The scan note names the section and page; the table shows that, not the whole sentence. */
  function shortNote(note) {
    const s = String(note || "").trim();
    if (!s) return "no usable mention of the cited tool was found in the text";
    return s.length > 200 ? s.slice(0, 200).replace(/\s+\S*$/, "") + "\u2026" : s;
  }

  /**
   * One report block per candidate, at the foot of the page, in the same shape as
   * an entry in `packet.html`: the citing paper, the work it cites, where the
   * citation sits, the quotation, and the files. Kept deliberately shorter than a
   * packet entry — there is no narrative here, because a narrative is written for
   * a citation somebody has decided to file, not for one under review.
   */
  function reportBlock(r) {
    const files = r.pdfs.length
      ? `<ul class="files-list">${r.pdfs.map(f => `<li><a href="${href(f.file)}">${esc(f.file.split("/").pop())}</a>` +
          ` <span class="sub">${esc(f.role || "")}</span></li>`).join("")}</ul>`
      : r.sharedPdf
        ? `<ul class="files-list"><li><a href="${href(r.sharedPdf)}">${esc(r.sharedPdf.split("/").pop())}</a>` +
          ` <span class="sub">same work as another row</span></li></ul>`
        : `<p class="none">No PDF on file. ${esc(DISCOVER_LABEL[r.discover] || r.discover)}${r.discoverNote ? ` — ${esc(r.discoverNote)}` : ""}.</p>`;

    const res = bestResolved(r);
    const where = r.scanTier
      ? `<strong>${esc(r.section || "")}</strong>${r.page ? `, page ${esc(r.page)}` : ""} — ${esc(TIER_LABEL[r.scanTier] || r.scanTier)}`
      : res
        ? `<span class="pill ${TIER_PILL[res.tier] || "warn"} resolved">Tier ${esc(res.tier)} &mdash; resolved</span> `
          + `<strong>${esc(res.section)}</strong>${res.page ? `, page ${esc(res.page)}` : ""} — `
          + `${esc(TIER_LABEL[res.tier] || res.tier)}, and the citing paper names no tool there: the citation was found by ${esc(BASIS_LABEL[res.basis] || res.basis)}.`
        : r.hasPdf
          ? `<span class="pill bad">no tier</span> ${esc(shortNote(r.scanNote))}`
          : `<span class="none">not read — no PDF on file, so no claim about where the citation sits</span>`;

    const quote = r.quote
      ? `<blockquote>&ldquo;${esc(r.quote)}&rdquo;</blockquote>` +
        `<p class="cite-page">${esc(r.section || "")}${r.page ? `, p.&nbsp;${esc(r.page)}` : ""}` +
        `${r.scannedOn ? ` &middot; scanned ${esc(r.scannedOn)}` : ""}</p>`
      : res
        ? `<blockquote>&ldquo;${esc(res.quote)}&rdquo;</blockquote>` +
          `<p class="cite-page">${esc(res.section)}${res.page ? `, p.&nbsp;${esc(res.page)}` : ""}` +
          `${res.noted_on ? ` &middot; resolved ${esc(res.noted_on)}` : ""}` +
          ` &middot; the marker as printed: ${esc(res.use_type || "reference number or author-year citation")}</p>`
        : `<p class="none">No verbatim sentence recorded.</p>`;

    return `
<article class="report" id="rep-${esc(r.uid)}">
  <h3>${esc(r.title)}</h3>
  <p class="byline">${esc(r.authorsFull || r.authors || "")}<br>
     <span class="venue">${esc(r.venueFull || r.venue || "")}${r.year ? `, ${esc(r.year)}` : ""}</span>` +
     `${r.link ? ` &middot; ${extLink(r.link, hostOf(r.link))}` : ""}` +
     `${r.doi ? ` &middot; ${extLink(`https://doi.org/${r.doi}`, r.doi)}` : ""}</p>
  <dl>
    <dt>Cited work</dt>
    <dd>${esc(r.citedPaper || r.citesTool || "—")}${r.citesTool ? ` <span class="sub">(${esc(r.citesTool)})</span>` : ""}</dd>
    <dt>Where the citation appears</dt>
    <dd>${where}</dd>
    <dt>Citing authors&rsquo; institutions</dt>
    <dd>${r.institutions ? esc(r.institutions) : `<span class="none">Not recorded — confirm from the PDF&rsquo;s affiliation block.</span>`}</dd>
    <dt>Article type</dt>
    <dd>${esc(r.articleType || "—")}</dd>
    <dt>Independence</dt>
    <dd>Re-checked against the citation record: complete author lists of both papers, no shared
        author, neither PI named on the citing paper${r.confirm ? `; basis on the record: ${esc(r.confirm)}` : ""}.</dd>
  </dl>
  <h4>What the text says</h4>
  ${quote}
  <h4>Files</h4>
  ${files}
  <p class="trace"><code>${esc(r.uid)}</code> &middot; review note only — not part of
     <code>packet.html</code> and not evidence until the row is confirmed and the packet re-rendered</p>
</article>`;
  }

  // Read articles first: the point of the reports is to help decide the ones with
  // a PDF, and an unread row's block would only repeat the table.
  const reports = [...rows].sort((a, b) => (b.hasPdf - a.hasPdf) || a.uid.localeCompare(b.uid))
    .map(reportBlock).join("\n");

  const body = rows.map((r, i) => {
    const pdfCell = r.pdfs.length
      ? r.pdfs.map(f => `<a href="${href(f.file)}">PDF</a>`).join(" ")
      : r.sharedPdf
        ? `<a href="${href(r.sharedPdf)}">PDF</a> <span class="sub">(same work as another row)</span>`
        : `<span class="none">not retrieved</span>`;
    // `data-*` carries what a filter needs in a form that does not depend on
    // parsing the rendered prose. Reading the pill text back would tie the filter
    // to the label wording, and a label reworded for a reader would silently
    // change what a filter matches.
    const res = bestResolved(r);
    const tierKey = r.scanTier ? r.scanTier : res ? `${res.tier}-resolved` : "none";
    return `    <tr data-uid="${esc(r.uid)}" data-tier="${esc(tierKey)}" data-disc="${esc(r.discover)}" ` +
      `data-pdf="${r.hasPdf ? 1 : 0}" data-year="${esc(r.year || "")}" ` +
      `data-text="${esc([r.uid, r.title, r.authors, r.senior, r.venue, r.quote || "", r.doi].join(" \u00b7 ").toLowerCase())}">
      <td class="uid">${esc(r.uid)}</td>
      <td class="title">${esc(r.title)}${r.rawTitle !== r.title ? ' <span class="sub">[title as Scholar shows it continues]</span>' : ""}
        ${r.authors ? `<div class="byline">${esc(r.authors)}</div>` : ""}</td>
      <td>${esc(r.senior || "\u2014")}</td>
      <td>${esc(r.year || "\u2014")}</td>
      <td>${esc(r.venue || "\u2014")}</td>
      <td class="src">${r.link ? extLink(r.link, hostOf(r.link) || "Scholar link") : "\u2014"}${r.doi ? `<div class="sub">${extLink(`https://doi.org/${r.doi}`, r.doi)}</div>` : ""}</td>
      <td class="disc"><span class="pill ${DISCOVER_CLASS[r.discover] || "warn"}">${esc(DISCOVER_LABEL[r.discover] || r.discover)}</span>${r.discoverNote ? `<div class="sub">${esc(r.discoverNote)}</div>` : ""}</td>
      <td class="pdf">${pdfCell}</td>
      <td class="tier">${tierCell(r)}</td>
      <td class="cite">${citationCell(r)}</td>
      <td class="pick"><label><input type="checkbox"> include</label></td>
    </tr>`;
  }).join("\n");

  // Filter options are built from what this page actually holds, so a select can
  // never offer a choice that matches nothing. Tier is grouped rather than listed
  // per letter: a reviewer sorting the pile wants "anything in Methods", whether
  // the paper named the tool or the reference resolver found it.
  const opt = (v, label) => `<option value="${esc(v)}">${esc(label)}</option>`;
  const tierOpts = [opt("", "any"), opt("A", "Tier A"), opt("B", "Tier B"), opt("C", "Tier C"),
    opt("D", "Tier D"), opt("resolved", "any tier, found by reference"),
    opt("untiered", "read, no tier"), opt("unread", "not read")]
    .join("");
  const discSeen = new Set(rows.map(r => r.discover));
  const discOpts = ["", ...Object.keys(DISCOVER_LABEL).filter(k => discSeen.has(k))]
    .map(k => k === "" ? opt("", "any") : opt(k, DISCOVER_LABEL[k])).join("");
  const yearSeen = [...new Set(rows.map(r => String(r.year || "").trim()).filter(Boolean))]
    .sort((a, b) => b.localeCompare(a));
  const yearOpts = [opt("", "any"), ...yearSeen.map(y => opt(y, y))].join("");

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
  main { max-width: 78rem; margin:0 auto; padding:2.5rem 1.5rem 5rem; }
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
  .pill.resolved { background:#e2ecf6; color:#1f3f6e; }
  .screen { font-size:.8rem; color:var(--muted); }
  .screen td { border:none; padding:.12rem .35rem; }
  .screen td.n { font-variant-numeric:tabular-nums; color:var(--ink); }
  .tier { font-size:.74rem; white-space:nowrap; }
  .cite { font-size:.74rem; min-width:14rem; }
  .cite .q { display:block; margin-bottom:.15rem; }
  .report { border:1px solid var(--rule); border-left:3px solid var(--accent); padding:.9rem 1.1rem; margin:1.4rem 0; }
  .report h3 { font-size:1.02rem; margin:.1rem 0 .2rem; }
  .report h4 { font-size:.78rem; text-transform:uppercase; letter-spacing:.06em; margin:1.1rem 0 .3rem; color:var(--muted); }
  .report dl { display:grid; grid-template-columns:minmax(9rem,max-content) 1fr; gap:.15rem .8rem; margin:.5rem 0; font-size:.82rem; }
  .report dt { color:var(--muted); font-size:.74rem; text-transform:uppercase; letter-spacing:.03em; padding-top:.15rem; }
  .report dd { margin:0; }
  .report blockquote { margin:.4rem 0 .2rem; padding:.4rem .9rem; border-left:3px solid var(--rule);
                       background:#faf8f5; font-size:.86rem; }
  .report .cite-page { font-size:.72rem; color:var(--muted); margin:.1rem 0 0; }
  .report .files-list { margin:.3rem 0; padding-left:1.2rem; font-size:.82rem; }
  .report .trace { font-size:.72rem; color:var(--muted); border-top:1px solid var(--rule); padding-top:.4rem; margin:.9rem 0 0; }
  .foot { margin-top:2rem; font-size:.75rem; color:var(--muted); border-top:1px solid var(--rule); padding-top:.8rem; }

  /* Filter bar over the candidate table. Screen only. */
  .filters { display:flex; flex-wrap:wrap; gap:.6rem .9rem; align-items:flex-end;
             margin:1rem 0 .2rem; padding:.7rem .9rem;
             background:#faf8f5; border:1px solid var(--rule); border-left:3px solid var(--accent); }
  .filters .fld { display:flex; flex-direction:column; gap:.2rem; }
  .filters label { font-size:.66rem; text-transform:uppercase; letter-spacing:.06em; color:var(--muted); }
  .filters input, .filters select { font:inherit; font-size:.78rem; padding:.25rem .35rem;
             border:1px solid #bbb; background:#fff; color:var(--ink); }
  .filters input[type=search] { min-width:18rem; }
  .filters .spacer { flex:1 1 auto; }
  .filters button { font:inherit; font-size:.76rem; padding:.3rem .7rem; background:#fff;
             border:1px solid #bbb; cursor:pointer; }
  .filters button:hover { background:#f1ede7; }
  #shown { font-size:.78rem; color:var(--muted); white-space:nowrap; }
  #no-hits { display:none; margin:.6rem 0; padding:.5rem .8rem; background:#fdf7e3;
             border-left:3px solid #c9a227; font-size:.8rem; }
  tr.excluded { display:none; }

  @media print {
    .pick, thead th.pick { display:none; }
    main { padding:0; max-width:none; }
    a { color:inherit; text-decoration:none; }
    /* A printed exhibit is the whole screen, whatever was filtered on screen. */
    .filters, #no-hits { display:none !important; }
    tr.excluded { display:table-row !important; }
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
    files it at the tier the text supports. Where a PDF is already on file, the Tier and
    Citation columns carry what that reading found; where it is not, they say so and claim nothing.
  </div>
  <div class="cited">
    <strong>Cited work:</strong> ${esc(cited.title)} (${esc(cited.year || "—")})<br>
    <span class="sub">${esc(cited.authors || "")}</span>
  </div>
  <p>${rows.length} independent citations of this work are not in the packet and were not used in
     the original application. Each is a real, independently authored citation of the applicant&rsquo;s
     tool. ${withTier.length} of them have been read and the sentence that cites the tool is recorded;
     ${withPdf.length - withTier.length} have been read and the tool does not appear anywhere the
     article ranks as a section; ${rows.length - withPdf.length} have no PDF yet, so where the
     citation sits is still unknown &mdash; and that is what decides a tier.</p>
  <table class="screen">
    <tr><td>Citing works the record lists for this paper</td><td class="n">${screen.total}</td></tr>
${screen.superseded ? `    <tr><td>less rows retired by a re-capture</td><td class="n">&minus;${screen.superseded}</td></tr>\n` : ""}    <tr><td>less not independent (shares an author with the cited work, or names a PI)</td><td class="n">&minus;${screen.dependent}</td></tr>
    <tr><td>less copies that do not stand for their work (preprint / repository twin)</td><td class="n">&minus;${screen.notStanding}</td></tr>
    <tr><td>less not listed in English</td><td class="n">&minus;${screen.nonEnglish}</td></tr>
    <tr><td>less already confirmed in the packet</td><td class="n">&minus;${screen.inPacket}</td></tr>
    <tr><td>less already used in the original application</td><td class="n">&minus;${screen.origApp}</td></tr>
${screen.decided ? `    <tr><td>less already decided against on review (kept in <code>screened-out.csv</code>)</td><td class="n">&minus;${screen.decided}</td></tr>\n` : ""}    <tr><td><strong>listed here for review</strong></td><td class="n"><strong>${rows.length}</strong></td></tr>
  </table>
</header>

<h2>The ${rows.length} candidates</h2>
<p>${withPdf.length} of them have a PDF on file and have been read by the scanner; those carry a
   tier and the sentence it rests on. The rest have no tier because nothing has been read, which is
   a statement about the file, not about the paper.</p>

<div class="filters">
  <div class="fld">
    <label for="f-q">Search (title, author, venue, quote, uid, doi)</label>
    <input type="search" id="f-q" placeholder="e.g. glycan array, Heras, cit-000544" autocomplete="off">
  </div>
  <div class="fld"><label for="f-tier">Tier</label><select id="f-tier">${tierOpts}</select></div>
  <div class="fld"><label for="f-disc">Open copy</label><select id="f-disc">${discOpts}</select></div>
  <div class="fld"><label for="f-pdf">PDF on file</label><select id="f-pdf">${opt("", "any")}${opt("1", "yes")}${opt("0", "no")}</select></div>
  <div class="fld"><label for="f-year">Year</label><select id="f-year">${yearOpts}</select></div>
  <div class="spacer"></div>
  <div class="fld"><label>&nbsp;</label><button type="button" id="f-reset">Reset</button></div>
  <div class="fld"><label>&nbsp;</label><span id="shown"></span></div>
</div>
<p id="no-hits">No row matches those filters. Reset to see all ${rows.length}.</p>

<table id="cand">
  <thead><tr>
    <th>row_uid</th><th>Citing paper</th><th>Senior author</th><th>Year</th><th>Venue</th>
    <th>Where it is</th><th>Open copy</th><th>PDF on file</th><th>Tier</th><th>Citation</th>
    <th class="pick">Decision</th>
  </tr></thead>
  <tbody id="cand-body">
${body}
  </tbody>
</table>
<p class="sub">Filtering is screen only: a printed or PDF copy of this page always shows every
   candidate, so what is on screen cannot silently decide what gets filed.</p>

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
<p><strong>A tier is a scan result, and only for an article that has actually been read.</strong>
   The Tier and Citation columns are filled from the PDF on file: <code>scan-mentions.js</code> extracts the
   text, finds every appearance of the tool, and reads the heading the article itself printed above
   it. Tier A means the mention sits in the Methods as the method performed; B in the Results or
   Figures; C in a high-reputation publication; D an acknowledgement. Where the column says
   <em>no tier</em>, the article was read and the tool appears only in a reference list, a table, or
   a section that earns no tier &mdash; the note says which. Where it says <em>not read</em>, no
   PDF exists yet, so no claim is made. A scan is a machine reading of prose: it is good at telling
   a Methods sentence from a bibliography entry, and it cannot tell whether the use was substantial.
   A person&rsquo;s reading of the page decides, and filing a candidate runs the same scanner again
   into the packet.</p>
<p><strong>A blue &ldquo;Tier&nbsp;X &mdash; resolved&rdquo; pill means the citing paper never names the tool.</strong>
   A citing author who used the work often credits it only as a reference number (&ldquo;following
   established procedures [125&ndash;127]&rdquo;, a superscript <sup>69</sup>) or, in author&ndash;year
   journals, only as &ldquo;(Mehta et al. 2024)&rdquo;. <code>scan-refs.js</code> identifies which
   bibliography entry is the applicant&rsquo;s paper &mdash; two signals required, title plus year plus
   first author, never a guess &mdash; and then reports every place that number or that citation is
   credited, with the section and the sentence. The tier bar is identical to a named mention&rsquo;s:
   under a heading the citing paper printed, in prose, not a table cell and not the reference list.
   The colour only says how the citation was found, not that it is weaker.</p>

<h2>Report on each candidate</h2>
<p>The same structure as <code>packet.html</code>, one block per candidate, so a row above can be
   judged on its background and its quotation together. A block is a review note, not evidence:
   nothing here reaches counsel unless the row is confirmed and the packet is re-rendered.</p>
${reports}

<p class="foot">Generated ${today} by <code>scripts/build-potential.js</code> from
   <code>Database/citation-catalog.sqlite</code> (read-only) and
   <code>notable-citations.sqlite</code>. Not linked from <code>packet.html</code> and not printed
   with it. Independence screen: <code>status = INDEPENDENT</code> and
   <code>is_countable_independent = 1</code> on the active, standing, English row.
   ${withPdf.length} of ${rows.length} read by <code>scan-mentions.js</code> on or before ${esc(today)}.</p>
</main>
<script>
/* Filter the candidate table. Reads the data-* attributes the row was written
   with, never the rendered prose: a label reworded for a reader must not change
   what a filter matches. */
(function () {
  var tbody = document.getElementById("cand-body");
  if (!tbody) return;
  var rows = Array.prototype.slice.call(tbody.rows);
  var q = document.getElementById("f-q"), tier = document.getElementById("f-tier"),
      disc = document.getElementById("f-disc"), pdf = document.getElementById("f-pdf"),
      year = document.getElementById("f-year"), shown = document.getElementById("shown"),
      none = document.getElementById("no-hits");

  function keep(r) {
    var d = r.dataset, t = tier.value;
    if (t === "A" || t === "B" || t === "C" || t === "D") {
      if (d.tier !== t) return false;
    } else if (t === "resolved") {
      if (d.tier.indexOf("-resolved") < 0) return false;
    } else if (t === "untiered" || t === "unread") {
      if (d.tier !== "none") return false;
      if (t === "untiered" && d.pdf !== "1") return false;
      if (t === "unread" && d.pdf !== "0") return false;
    }
    if (disc.value && d.disc !== disc.value) return false;
    if (pdf.value && d.pdf !== pdf.value) return false;
    if (year.value && d.year !== year.value) return false;
    var needle = q.value.trim().toLowerCase();
    if (needle) {
      // Every whitespace-separated term must appear; order does not matter.
      var hit = needle.split(/\s+/).every(function (w) { return d.text.indexOf(w) >= 0; });
      if (!hit) return false;
    }
    return true;
  }

  function apply() {
    var n = 0;
    rows.forEach(function (r) {
      var ok = keep(r);
      r.classList.toggle("excluded", !ok);
      if (ok) n++;
    });
    shown.textContent = "showing " + n + " of " + rows.length;
    none.style.display = n ? "none" : "block";
  }

  [q, tier, disc, pdf, year].forEach(function (el) {
    el.addEventListener("input", apply);
    el.addEventListener("change", apply);
  });
  document.getElementById("f-reset").addEventListener("click", function () {
    q.value = ""; tier.value = ""; disc.value = ""; pdf.value = ""; year.value = "";
    apply();
  });
  apply();
})();
</script>
</body>
</html>`;

  if (!WRITE) {
    console.log(`dry run [${path.basename(OUT)}] — ${rows.length} candidate row(s), ${withPdf.length} with a PDF on file. Add --write.`);
    return { out: OUT, rows: rows.length, withPdf: withPdf.length };
  }
  fs.writeFileSync(OUT, html, "utf8");
  console.log(`wrote ${path.relative(PKT, OUT)} — ${(html.length / 1024).toFixed(0)} KB | ${rows.length} candidates, ${withPdf.length} with a PDF on file`);
  return { out: OUT, rows: rows.length, withPdf: withPdf.length };
}

/**
 * Which cited works get a page.
 *
 * The candidate queue is the authority: a work is being worked on when its
 * citing rows were seeded, and `--seed` is the first step of the pipeline (§5.5).
 * Deriving the list from `citation` instead would quietly drop a work whose
 * candidates have not been promoted yet, which is exactly the state a fresh
 * `--seed` leaves you in — and the page would then not exist for the work the
 * applicant most needs to see.
 */
function citedWorks(db, cat) {
  const ids = [...new Set(db.prepare(
    "SELECT cites_id FROM candidate WHERE cites_id IS NOT NULL AND cites_id <> ''").all().map(r => r.cites_id))];
  const pubs = cat.prepare("SELECT cites_id, title, year, authors FROM publications").all();
  const byId = new Map(pubs.map(p => [p.cites_id, p]));
  const out = ids.map(id => byId.get(id)).filter(Boolean);
  out.sort((a, b) => {
    // GLAD first (the page counsel-side documents), then GlycoGlyph, then MAWE,
    // then anything else alphabetically by title.
    const rank = t => (/^GLAD$/i.test(t) ? 0 : /^GlycoGlyph$/i.test(t) ? 1 : /^MAWE$/i.test(t) ? 2 : 3);
    const ra = rank(toolForCitedPaper(a.title) || ""), rb = rank(toolForCitedPaper(b.title) || "");
    return ra - rb || String(a.title).localeCompare(String(b.title));
  });
  return out;
}

function main() {
  const cat = openCatalog();
  const db = openPacket();
  const frag = argv.find(a => a.startsWith("--cited="))?.slice(8);
  const works = argv.includes("--all") || (frag && frag === "all")
    ? citedWorks(db, cat)
    : [resolveCited(cat, frag || "GLAD")];
  if (!works.length) {
    console.error("No cited work to render — the candidate queue is empty. Run discover-pdfs.js --seed first.");
    process.exit(1);
  }
  const results = works.map(w => renderOne(cat, db, w));
  if (results.length > 1) {
    const tot = results.reduce((a, r) => a + r.rows, 0);
    const pdf = results.reduce((a, r) => a + r.withPdf, 0);
    console.log(`\n${results.length} review page(s), ${tot} candidate row(s), ${pdf} with a PDF on file.`);
  }
}

main();

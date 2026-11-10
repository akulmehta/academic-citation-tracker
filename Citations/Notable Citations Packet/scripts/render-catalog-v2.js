"use strict";
/**
 * Render the profile-first catalog (archived-logs/catalog-v2.json, from catalog-citations.js) as two pages:
 *
 *   citation-catalog-v2.html          the list: search, tier, citing style, "vs database", year range,
 *                                     My work, with the reference number of the applicant's paper in each row
 *   citation-catalog-v2-report.html   one details section per citation, opened as ?uid=cit-000062
 *
 * Both are review pages. Neither is linked from, nor read by, packet.html or the candidate list, and
 * neither writes to the database.
 */
const fs = require("fs");
const path = require("path");
const { openPacket, PKT, REPO } = require("./lib");

const JSON_IN = path.join(REPO, "archived-logs", "catalog-v2.json");
const LIST_OUT = path.join(PKT, "citation-catalog-v2.html");
const REPORT_OUT = path.join(PKT, "citation-catalog-v2-report.html");
const REPORT_NAME = "citation-catalog-v2-report.html";

const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const NEW_TAB = 'target="_blank" rel="noopener noreferrer"';
const pdfHref = (file, page) => encodeURI(String(file).replace(/\\/g, "/")) + (page ? `#page=${page}` : "");

const STYLE = { bracket: "[n] brackets", paren: "(n) parentheses", superscript: "superscript n", authorYear: "author-year", mixed: "mixed styles", unclear: "unclear", error: "error" };
const STATUS = {
  "same-tier": "same tier as the database", "catalog-higher": "catalog finds a higher tier", "catalog-lower": "catalog finds a lower tier",
  "catalog-only": "catalog only", "db-only": "database only", neither: "no mention found either way", error: "error",
};

/** The labels the candidate list uses in its My work filter, so both pages name a work the same way. */
const CANDIDATE_LABELS = (() => {
  try {
    const h = fs.readFileSync(path.join(PKT, "potential_notable_citations.html"), "utf8");
    const i = h.indexOf('id="f-work"');
    const sel = h.slice(i, h.indexOf("</select>", i));
    return [...sel.matchAll(/<option value="([^"]+)"/g)].map(m => m[1].replace(/&amp;/g, "&").replace(/&quot;/g, '"')).filter(Boolean);
  } catch { return []; }
})();

/** "Unique repertoire of…": the label the candidate list uses for a cited work. */
function workLabel(row) {
  const t = String(row.cited || "").trim();
  const norm = x => String(x).toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const hit = CANDIDATE_LABELS.find(l => { const core = norm(l.replace(/…$/, "")); return core.length >= 3 && norm(t).startsWith(core); });
  if (hit) return hit;
  const tool = /^GLAD\b|glycan array dashboard/i.test(t) ? "GLAD" : /glycoglyph/i.test(t) ? "GlycoGlyph" : /glyco[- ]?spot/i.test(t) ? "Glyco-SPOT" : null;
  if (tool) return tool;
  const words = t.split(/\s+/);
  return words.slice(0, 4).join(" ") + (words.length > 4 ? "…" : "");
}

/** How the applicant's paper is numbered in this PDF, in words a reader can use with the PDF open. */
function whereInPdf(x) {
  const markers = [...new Set(x.mentions.map(m => m.marker))].slice(0, 6);
  const page = x.entryPage ? `reference list, p.${x.entryPage}` : "reference list page not located";
  if (x.profile.style === "authorYear" || (x.entryNumber == null && x.mentions.some(m => m.style === "authorYear"))) {
    const sur = x.citedSurname ? x.citedSurname.replace(/\b\w/g, c => c.toUpperCase()) : "first author";
    return { badge: `${sur} et al. ${x.citedYear || ""}`.trim(), detail: `cited by author and year · ${page}`, printed: markers };
  }
  if (x.entryNumber != null) {
    return { badge: `ref. ${x.entryNumber}`, detail: `${page}${markers.length ? " · printed as " + markers.join(", ") : ""}`, printed: markers };
  }
  return { badge: "not located", detail: "no matching entry in the reference list", printed: markers };
}

function main() {
  const db = openPacket();
  // A citation already in packet.html is decided, so it does not belong on a page for choosing. Read the status
  // from the database now, not from the cataloguer's last run, so a promotion drops its row from both pages
  // the next time they are rendered.
  const included = new Set(db.prepare("SELECT row_uid FROM citation WHERE status='included'").all().map(r => r.row_uid));
  const allRows = JSON.parse(fs.readFileSync(JSON_IN, "utf8"));
  const data = allRows.filter(x => !included.has(x.uid));
  if (allRows.length !== data.length) console.log(`left out ${allRows.length - data.length} citation(s) already in packet.html`);
  const meta = db.prepare("SELECT row_uid, citing_authors, citing_venue, citing_year, citing_url, citing_title FROM citation WHERE row_uid=?");
  for (const x of data) {
    const m = meta.get(x.uid) || {};
    x.citingAuthors = m.citing_authors || ""; x.venue = m.citing_venue || ""; x.year = String(m.citing_year || "").slice(0, 4);
    x.url = m.citing_url || ""; x.fullTitle = m.citing_title || x.citing || "";
    x.work = workLabel(x); x.where = whereInPdf(x);
  }
  const works = [...new Set(data.map(x => x.work))].sort((a, b) => a.localeCompare(b));
  const count = f => data.reduce((a, x) => { const v = f(x); a[v] = (a[v] || 0) + 1; return a; }, {});
  const years = data.map(x => Number(x.year)).filter(Boolean);

  /* ───────── list page ───────── */
  const tierOf = x => x.headline || "none";
  const rowHtml = x => {
    const top = x.mentions[0];
    const c = x.profile.counts || {};
    const pill = x.headline ? `<span class="pill t${x.headline}">Tier ${x.headline}</span>` : `<span class="pill none">no tier</span>`;
    // Every place the paper cites the applicant's work, each with its own PDF link, so a decision can be made from the row.
    const first = x.mentions.length
      ? `<div class="count">${x.mentions.length} place${x.mentions.length === 1 ? "" : "s"} cited</div><ul class="ml">${x.mentions.map(m => `<li class="m"><span class="pill t${esc(m.tier || "")}">${esc(m.tier || "?")}</span> <span class="sub">${esc(m.section)} · p.${esc(m.page)} · <b>${esc(m.marker)}</b></span> <a class="pdflink" href="${pdfHref(x.pdf, m.page)}" ${NEW_TAB}>open PDF p.${esc(m.page)}</a>${m.inferred ? ' <span class="warn">tier inferred</span>' : ""}${m.lowConfidence ? ' <span class="warn">check number</span>' : ""}<div class="q">${esc(m.quote.length > 320 ? m.quote.slice(0, 320) + "…" : m.quote)}</div></li>`).join("")}</ul>`
      : `<div class="none">${esc(x.reason || "")}</div>`;
    return `<tr data-uid="${esc(x.uid)}" data-tier="${esc(tierOf(x))}" data-style="${esc(x.profile.style)}" data-status="${esc(x.status)}" data-year="${esc(x.year)}" data-work="${esc(x.work)}" data-text="${esc((x.uid + " " + x.fullTitle + " " + x.citingAuthors + " " + x.venue + " " + x.cited + " " + x.where.badge + " " + x.mentions.map(m => m.quote).join(" ")).toLowerCase())}">
<td class="uid"><a href="${REPORT_NAME}?uid=${esc(x.uid)}" ${NEW_TAB}>${esc(x.uid)}</a></td>
<td><div class="t1">${esc(x.fullTitle)}</div><div class="sub">${esc(x.citingAuthors.slice(0, 90))}${x.venue ? " · " + esc(x.venue) : ""}${x.year ? " · " + esc(x.year) : ""}</div><div class="sub"><a href="${pdfHref(x.pdf)}" ${NEW_TAB}>PDF</a> · <a href="${REPORT_NAME}?uid=${esc(x.uid)}" ${NEW_TAB}>full details</a></div></td>
<td><div>${esc(x.work)}</div><div class="sub">${esc(x.citedYear || "")}</div></td>
<td><div class="refno">${esc(x.where.badge)}</div><div class="sub">${esc(x.where.detail)}</div></td>
<td>${pill}<div class="sub">${esc(STYLE[x.profile.style] || x.profile.style)}</div><div class="sub">[n] ${c.bracket || 0} · (n) ${c.paren || 0} · sup ${c.superscript || 0} · a-y ${c.authorYear || 0}</div></td>
<td>${first}</td>
<td><span class="stat s-${esc(x.status)}">${esc(STATUS[x.status] || x.status)}</span></td></tr>`;
  };
  const opts = (obj, labels) => Object.entries(obj).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<option value="${esc(k)}">${esc(labels[k] || k)} (${v})</option>`).join("");
  const css = `
:root{--bg:#fff;--fg:#1d2330;--mut:#5b6475;--line:#dfe3ea;--card:#f6f7fa;--a:#1a7f4b;--b:#2563c9;--c:#8a6d1a;--bad:#b3261e;--hi:#fff4c2}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#14171d;--fg:#e6e9ef;--mut:#9aa3b2;--line:#2b303b;--card:#1b1f27;--a:#4cc38a;--b:#7aa7ff;--c:#d9b85a;--bad:#ff8a80;--hi:#4a3f12}}
:root[data-theme="dark"]{--bg:#14171d;--fg:#e6e9ef;--mut:#9aa3b2;--line:#2b303b;--card:#1b1f27;--a:#4cc38a;--b:#7aa7ff;--c:#d9b85a;--bad:#ff8a80;--hi:#4a3f12}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.45 system-ui,sans-serif}main{max-width:1380px;margin:0 auto;padding:0 16px 40px}
h1{font-size:22px;margin:14px 0 2px}h2{font-size:17px;margin:18px 0 6px}a{color:var(--b)}.sub{color:var(--mut);font-size:13px}code{font-family:ui-monospace,monospace}
.note{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:10px 14px;margin:10px 0}
.pill{display:inline-block;border-radius:6px;padding:0 8px;font-weight:700;font-size:13px;background:var(--card);border:1px solid var(--line)}.pill.tA{color:var(--a)}.pill.tB{color:var(--b)}.pill.tC{color:var(--c)}.pill.none{color:var(--mut);font-weight:400}
.q{padding-left:8px;border-left:3px solid var(--line);margin:2px 0}.none{color:var(--mut);font-style:italic}.refno{display:inline-block;background:var(--hi);border-radius:6px;padding:1px 8px;font-weight:700}
.ml{list-style:none;margin:0;padding:0}.m{margin:0 0 10px}.count{font-weight:600;font-size:13px;margin-bottom:4px}.warn{color:var(--bad);font-size:12px}.pdflink{font-size:13px;white-space:nowrap}
.stat{font-size:13px;padding:1px 8px;border-radius:6px;background:var(--card);border:1px solid var(--line);display:inline-block}.s-catalog-higher{color:var(--a)}.s-catalog-lower,.s-db-only{color:var(--bad)}
`;
  const listHtml = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Citation Catalog v2</title><style>${css}
.bar{position:sticky;top:0;z-index:3;background:var(--bg);border-bottom:1px solid var(--line);padding:8px 0;display:flex;flex-wrap:wrap;gap:8px;align-items:end}
.bar label{display:flex;flex-direction:column;font-size:12px;color:var(--mut)}.bar input,.bar select{padding:5px 8px;border:1px solid var(--line);border-radius:8px;background:var(--bg);color:var(--fg);font:inherit;min-width:110px}.bar #f-q{min-width:260px}
button{padding:6px 12px;border:1px solid var(--line);border-radius:8px;background:var(--card);color:var(--fg);cursor:pointer;font:inherit}
table{border-collapse:collapse;width:100%}th{position:sticky;top:0;text-align:left;font-size:12px;color:var(--mut);border-bottom:1px solid var(--line);padding:6px 8px}td{border-top:1px solid var(--line);padding:8px;vertical-align:top}.uid{font-family:ui-monospace,monospace;white-space:nowrap}.t1{font-weight:600}
#no-hits{padding:20px;color:var(--mut)}@media (max-width:820px){thead{display:none}td{display:block;border-top:0;padding:3px 0}tr{display:block;border-top:1px solid var(--line);padding:8px 0}}
</style></head><body><main>
<h1>Citation Catalog v2 <span class="sub">— profile-first</span></h1>
<div class="sub">Review page, separate from the packet and the candidate list. Generated ${new Date().toISOString().slice(0, 10)} · ${data.length} held citations with a PDF on file.</div>
<div class="note"><b>How it reads a paper.</b> It first works out how the paper cites (bibliography format and the in-text style actually used: [n], (n), superscript, author-year), then looks for your publication's marker <i>only in that style</i>, so a list item "(3)" or a residue range "(38–60)" in a [n] paper is never mistaken for a citation. Page headers and page numbers are removed first. <b>Reference column:</b> the number your publication carries in that paper's reference list, how it is printed in the text, and the page of the list, so it can be found with the PDF open. Click a citation ID for the full details.</div>
<div class="bar" id="bar">
<label>Search<input id="f-q" type="search" placeholder="id, title, author, venue, a phrase from the sentence…"></label>
<label>Tier<select id="f-tier"><option value="">all</option><option value="A">Tier A</option><option value="B">Tier B</option><option value="C">Tier C</option><option value="none">no tier found</option></select></label>
<label>My work<select id="f-work"><option value="">all</option>${works.map(w => `<option value="${esc(w)}">${esc(w)}</option>`).join("")}</select></label>
<label>Paper cites by<select id="f-style"><option value="">all</option>${opts(count(x => x.profile.style), STYLE)}</select></label>
<label>Against the database<select id="f-status"><option value="">all</option>${opts(count(x => x.status), STATUS)}</select></label>
<label>Year from<input id="f-year-min" type="number" min="${Math.min(...years)}" max="${Math.max(...years)}" placeholder="${Math.min(...years)}" style="min-width:80px;width:90px"></label>
<label>to<input id="f-year-max" type="number" min="${Math.min(...years)}" max="${Math.max(...years)}" placeholder="${Math.max(...years)}" style="min-width:80px;width:90px"></label>
<button id="reset" type="button">Reset</button><span class="sub" id="shown"></span></div>
<table><thead><tr><th>ID</th><th>Citing paper</th><th>My work</th><th>Reference in the PDF</th><th>Tier · how it cites</th><th>Where it is cited</th><th>Vs database</th></tr></thead><tbody id="body">
${data.map(rowHtml).join("\n")}
</tbody></table><div id="no-hits" hidden>No citation matches these filters.</div>
<script>(function(){var rows=[].slice.call(document.querySelectorAll("#body tr")),g=function(i){return document.getElementById(i)},q=g("f-q"),tier=g("f-tier"),work=g("f-work"),style=g("f-style"),status=g("f-status"),lo=g("f-year-min"),hi=g("f-year-max"),shown=g("shown"),none=g("no-hits");
function keep(r){var d=r.dataset;if(tier.value&&d.tier!==tier.value)return false;if(work.value&&d.work!==work.value)return false;if(style.value&&d.style!==style.value)return false;if(status.value&&d.status!==status.value)return false;
if(lo.value||hi.value){var y=parseInt(d.year,10);if(isNaN(y))return false;if(lo.value&&y<Number(lo.value))return false;if(hi.value&&y>Number(hi.value))return false}
var t=q.value.trim().toLowerCase();if(t&&d.text.indexOf(t)<0)return false;return true}
function apply(){var n=0;rows.forEach(function(r){var k=keep(r);r.hidden=!k;if(k)n++});shown.textContent="showing "+n+" of "+rows.length;none.hidden=n>0}
[q,tier,work,style,status,lo,hi].forEach(function(e){e.addEventListener("input",apply);e.addEventListener("change",apply)});
g("reset").addEventListener("click",function(){[q,lo,hi].forEach(function(e){e.value=""});[tier,work,style,status].forEach(function(e){e.value=""});apply()});apply()})();</script>
</main></body></html>`;
  fs.writeFileSync(LIST_OUT, listHtml);

  /* ───────── details page ───────── */
  const detail = x => {
    const c = x.profile.counts || {};
    const mentions = x.mentions.length ? x.mentions.map(m => `<li class="m"><span class="pill t${esc(m.tier || "")}">${esc(m.tier ? "Tier " + m.tier : "tier ?")}</span> <b>${esc(m.section)}</b>, page ${esc(m.page)} · printed as <code>${esc(m.marker)}</code> (${esc(m.style)}) · <a href="${pdfHref(x.pdf, m.page)}" ${NEW_TAB}>open the PDF at p.${esc(m.page)}</a>${m.inferred ? ' <span class="warn">tier inferred (no section heading)</span>' : ""}${m.lowConfidence ? ' <span class="warn">small reference number: check it in the PDF</span>' : ""}<div class="q">${esc(m.quote)}</div></li>`).join("") : `<li class="none">${esc(x.reason || "No mention found.")}</li>`;
    const old = x.old.length ? `<table class="mini"><thead><tr><th>Tier</th><th>Section</th><th>Page</th><th>Basis</th><th>Sentence recorded</th></tr></thead><tbody>${x.old.map(o => `<tr><td>${esc(o.tier)}</td><td>${esc(o.section)}</td><td>${esc(o.page)}</td><td>${esc(o.basis)}</td><td>${esc(o.q)}</td></tr>`).join("")}</tbody></table>` : `<p class="none">The database holds no mention for this citation.</p>`;
    return `<template data-uids="${esc(x.uid)}"><article class="rep" data-uid="${esc(x.uid)}">
<h2>${esc(x.fullTitle)}</h2>
<div class="sub">${esc(x.citingAuthors)}${x.venue ? " · " + esc(x.venue) : ""}${x.year ? " · " + esc(x.year) : ""}</div>
<p><a href="${pdfHref(x.pdf)}" ${NEW_TAB}>Open the PDF</a>${x.url ? ` · <a href="${esc(x.url)}" ${NEW_TAB}>citing paper online</a>` : ""} · <code>${esc(x.pdf)}</code></p>
<section class="box"><h3>Find your publication in this PDF</h3>
<dl><dt>Your publication</dt><dd>${esc(x.cited)} (${esc(x.citedYear || "")}) <span class="sub">[${esc(x.work)}]</span></dd>
<dt>Reference</dt><dd><span class="refno">${esc(x.where.badge)}</span> <span class="sub">${esc(x.where.detail)}</span>${x.entryPage ? ` · <a href="${pdfHref(x.pdf, x.entryPage)}" ${NEW_TAB}>open the reference list at p.${esc(x.entryPage)}</a>` : ""}</dd>
${x.entry ? `<dt>The entry as printed</dt><dd class="entry">${esc(x.entry)}</dd>` : ""}
<dt>In the text it appears as</dt><dd>${x.where.printed.length ? x.where.printed.map(p => `<code>${esc(p)}</code>`).join(" ") : "<span class='none'>no marker located</span>"}</dd>
<dt>On pages</dt><dd>${[...new Set(x.mentions.map(m => m.page))].sort((a, b) => a - b).map(p => `<a href="${pdfHref(x.pdf, p)}" ${NEW_TAB}>p.${esc(p)}</a>`).join(", ") || "—"}</dd></dl></section>
<h3>Where the text cites it <span class="sub">(${x.mentions.length} place${x.mentions.length === 1 ? "" : "s"}; headline ${esc(x.headline ? "Tier " + x.headline : "none")})</span></h3><ul class="ml">${mentions}</ul>
<h3>How this paper cites</h3>
<p><b>${esc(STYLE[x.profile.style] || x.profile.style)}</b> — ${esc(x.profile.why || "")}.</p>
<p class="sub">Markers counted in the body: [n] ${c.bracket || 0} · (n) ${c.paren || 0} · superscript ${c.superscript || 0} · author-year ${c.authorYear || 0}. Bibliography format: ${esc(x.profile.bibliography || "")}. Only this style (and a minor secondary one where it applies) was searched for your publication's marker; page headers and page numbers were removed first.</p>
<h3>Against the database <span class="stat s-${esc(x.status)}">${esc(STATUS[x.status] || x.status)}</span></h3>${old}
<p class="trace"><code>${esc(x.uid)}</code> · review note only — not part of <code>packet.html</code> and not evidence until the row is confirmed and the packet re-rendered</p>
</article></template>`;
  };
  const reportHtml = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Citation details (catalog v2)</title><style>${css}
.rep{max-width:980px;margin:0 auto}.box{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:4px 14px 10px;margin:12px 0}dl{display:grid;grid-template-columns:170px 1fr;gap:6px 14px}dt{color:var(--mut)}dd{margin:0}.entry{font-size:13px}
.ml{list-style:none;margin:0;padding:0}.m{margin:0 0 12px}.warn{color:var(--bad);font-size:12px}table.mini{border-collapse:collapse;width:100%;font-size:13px}.mini th,.mini td{border-top:1px solid var(--line);padding:4px 6px;text-align:left;vertical-align:top}.trace{color:var(--mut);font-size:12px;margin-top:20px}.focus{outline:0}
#missing{padding:20px}@media (max-width:700px){dl{grid-template-columns:1fr}}
</style></head><body><main><p><a href="citation-catalog-v2.html">← back to the catalog</a></p><div id="report"></div><div id="missing" hidden></div>
${data.map(detail).join("\n")}
<script>(function(){var uid=new URLSearchParams(location.search).get("uid")||"";var tpl=/^cit-\\d{6}$/.test(uid)?document.querySelector('template[data-uids~="'+uid+'"]'):null;var miss=document.getElementById("missing");
if(!tpl){miss.hidden=false;miss.textContent=uid?"No citation with row_uid "+uid+" is in this catalog.":"Open a citation from the catalog list. This page needs a row_uid in its address, for example ?uid=cit-000062.";return}
document.getElementById("report").appendChild(tpl.content.cloneNode(true));document.title=uid+" — citation details (catalog v2)"})();</script>
</main></body></html>`;
  fs.writeFileSync(REPORT_OUT, reportHtml);

  const tiers = count(tierOf), st = count(x => x.status), pr = count(x => x.profile.style);
  console.log("wrote", path.basename(LIST_OUT), Math.round(listHtml.length / 1024) + " KB;", path.basename(REPORT_OUT), Math.round(reportHtml.length / 1024) + " KB");
  console.log("rows:", data.length, "| tiers:", JSON.stringify(tiers));
  console.log("profiles:", JSON.stringify(pr));
  console.log("vs database:", JSON.stringify(st));
  console.log("reference located:", data.filter(x => x.entryNumber != null || x.entryPage != null).length, "of", data.length);
}
main();

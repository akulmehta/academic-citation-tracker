"use strict";
/**
 * Profile-first citation cataloguer (an alternative to scan-refs.js + classify-citations.js).
 * READ-ONLY: writes only a JSON file and a separate HTML page. Never the database, never `tier`.
 *
 * The older readers look for the applicant's reference number everywhere and then try to throw away the
 * false hits (an enumeration "(3)", a page number under a running header, an NMR peak). Every fix made the
 * next paper's false positive different. This works the other way round:
 *
 *   1. PROFILE   how does THIS paper cite?  Read its bibliography format and count which in-text style
 *                it really uses: [n] brackets, (n) parentheses, raised superscript numbers, author-year,
 *                or a mixture. Page furniture (running headers, page numbers) is removed first.
 *   2. RULES     only that profile's marker is searched for. In a "[3] Smith ..." paper a "(3)" is a list
 *                item and is never looked at; in a superscript paper a bracket is never looked at.
 *   3. SENTENCE  the marker's whole sentence, with page, section, and the table caption when it sits in
 *                a table ("Listed in Table 2 ...").
 *   4. EVIDENCE  every row says which profile it was read under and why, so a wrong answer can be traced
 *                to a wrong profile rather than to a pile of heuristics.
 *
 *   node scripts/catalog-citations.js [--from=0 --to=500] [--rows=cit-001530,cit-000514]
 *   node scripts/catalog-citations.js --html          # render citation-catalog-v2.html from the JSON
 */
const fs = require("fs");
const path = require("path");
const { openPacket, openCatalog, PKT, REPO } = require("./lib");
const rc = require("./ref-cites");
const sm = require("./scan-mentions");

const argv = process.argv.slice(2);
const opt = n => (argv.find(a => a.startsWith(`--${n}=`)) || "").split("=").slice(1).join("=") || null;
const OUTDIR = path.join(REPO, "archived-logs");
const JSON_OUT = path.join(OUTDIR, "catalog-v2.json");
const HTML_OUT = path.join(PKT, "citation-catalog-v2.html");

/* ───────────── page furniture ───────────── */
function furnitureSet(pages) {
  const key = t => String(t).replace(/\d+/g, "#").replace(/\s+/g, " ").trim().toLowerCase();
  const seen = new Map();
  pages.forEach((ls, pi) => ls.forEach(L => {
    if (L.text.length > 110) return;
    const k = key(L.text);
    if (!k) return;
    if (!seen.has(k)) seen.set(k, new Set());
    seen.get(k).add(pi);
  }));
  return text => text.length <= 110 && (seen.get(key(text)) || new Set()).size >= 3;
}

/* ───────────── 1. PROFILE ───────────── */
// Experimental data and chemistry that bare numbers collide with (NMR peaks, yields, compound labels).
const DATA_NOISE = /\b(?:\d+(?:\.\d+)?\s*(?:Hz|MHz|mmol|mg|mL|µL|μL|µM|μM|nM|kDa|ppm|°C)|J\s*=|δ|HRMS|m\/z|NMR|ESI|calcd|yield|white (?:amorphous )?solid|\bdd\b|\bt, J)/i;
const ORPHAN = /^\d{1,4}(?:\s*[,\s–—−-]\s*\d{1,4})*$/;

/**
 * Superscript markers that survive text extraction as plain characters: a number glued to the end of a
 * lowercase-led word ("Glygen database23,") or standing alone at the end of a line ("… as described 45").
 * A word with a capital after its first letter ("CD206", "H2O", "IL6") is a name, not a marker.
 */
function gluedMarkers(text) {
  const out = [];
  for (const m of text.matchAll(/([\p{L}]{3,})(\d{1,3}(?:[,–−-]\d{1,3})*)(?=[\s.,;:)\]]|$)/gu)) {
    if (/\p{Lu}/u.test(m[1].slice(1))) continue;
    const nums = rc.expandRun(m[2]);
    if (nums && nums.length <= 12 && nums[0] <= 400) out.push({ numbers: nums, raw: m[2], at: m.index + m[1].length });
  }
  for (const mk of rc.findTextMarkers(text)) if (mk.bare) out.push({ numbers: mk.numbers, raw: mk.raw, at: mk.start });
  return out;
}

function isEnumeration(near, n) {
  // list items are small numbers; (37) ... (43), (44) in a parenthesis-numbered paper is a run of citations
  if (n > 9) return false;
  const seen = [...near.matchAll(/\((\d{1,2})\)/g)].map(m => Number(m[1]));
  return seen.includes(n - 1) || seen.includes(n + 1);
}

/**
 * Count each in-text style over the body of the paper. `body` is the list of {page, li, text, items}
 * lines outside the reference list and outside furniture.
 */
function profileOf(body, index) {
  let bracket = 0, paren = 0, sup = 0, authorYear = 0;
  const AY = /\(\s*[A-Z][\p{L}'’-]+(?:\s+(?:et\s+al\.?|and|&)\s*[A-Z]?[\p{L}'’-]*)?,?\s+(?:19|20)\d\d[a-z]?\s*[;)]|[A-Z][\p{L}'’-]+\s+et\s+al\.?\s*\(\s*(?:19|20)\d\d/gu;
  body.forEach((L, i) => {
    for (const m of L.text.matchAll(/\[([\de\s,;–—−-]{1,40})\]/g)) if (rc.expandRun(m[1])) bracket++;
    for (const m of L.text.matchAll(/\(([\d\s,;–—−-]{1,30})\)/g)) {
      const nums = rc.expandRun(m[1]);
      if (!nums || nums.length > 1 || nums[0] > 400) { if (nums && nums.length > 1) paren++; continue; }
      const near = [body[i - 2], body[i - 1], L, body[i + 1], body[i + 2]].filter(x => x && x.page === L.page).map(x => x.text).join(" ");
      if (!isEnumeration(near, nums[0])) paren++;
    }
    sup += rc.findRaisedMarkers(L).length;
    if (ORPHAN.test(L.text.trim()) && i > 0 && body[i - 1].page === L.page && /[A-Za-z]{3}/.test(body[i - 1].text) && body[i - 1].text.length > 25) sup++;
    for (const _ of L.text.matchAll(AY)) authorYear++;
  });
  const counts = { bracket, paren, superscript: sup, authorYear };
  const ranked = Object.entries(counts).sort((a, b) => b[1] - a[1]);
  const [top, second] = ranked;
  let style, why;
  if (top[1] < 3) { style = "unclear"; why = `fewer than 3 in-text markers of any style (${JSON.stringify(counts)})`; }
  else if (second[1] >= top[1] * 0.6) { style = "mixed"; why = `${top[0]} (${top[1]}) and ${second[0]} (${second[1]}) are both frequent`; }
  else { style = top[0]; why = `${top[0]} markers dominate (${top[1]} vs next ${second[1]})`; }
  // The bibliography's own numbering settles a tie between [n] and (n) and rules out the other.
  if (index.style === "bracket" && (style === "paren" || style === "mixed") && bracket >= 1) { style = "bracket"; why += "; bibliography is numbered [n]"; }
  if (index.style === "paren" && (style === "bracket" || style === "mixed") && paren >= 1) { style = "paren"; why += "; bibliography is numbered (n)"; }
  return { style, counts, why, bibliography: index.style || (index.byNumber.size ? "numbered" : "none") };
}

/* ───────────── 2. RULES per profile ───────────── */
function findHits(profile, body, num, want, pages, furn, index) {
  const hits = [];
  const styles = profile.style === "mixed" ? ["bracket", "paren", "superscript", "authorYear"].filter(s => profile.counts[s] >= 3) : [profile.style];
  if (profile.style === "unclear") styles.push("bracket", "paren", "superscript", "authorYear");
  body.forEach((L, i) => {
    if (num != null) {
      if (styles.includes("bracket")) {
        for (const m of L.text.matchAll(/\[([\de\s,;–—−-]{1,60})\]/g)) {
          const nums = rc.expandRun(m[1]);
          if (nums && nums.includes(num)) hits.push({ L, i, marker: m[0], style: "bracket", at: m.index });
        }
      }
      if (styles.includes("paren")) {
        for (const m of L.text.matchAll(/\(([\d\s,;–—−-]{1,40})\)/g)) {
          const nums = rc.expandRun(m[1]);
          if (!nums || !nums.includes(num)) continue;
          if (nums.length === 1) {
            const near = [body[i - 2], body[i - 1], L, body[i + 1], body[i + 2]].filter(x => x && x.page === L.page).map(x => x.text).join(" ");
            if (isEnumeration(near, num)) continue;
          }
          hits.push({ L, i, marker: m[0], style: "paren", at: m.index });
        }
      }
      if (styles.includes("superscript")) {
        for (const mk of rc.findRaisedMarkers(L)) if (mk.numbers.includes(num)) hits.push({ L, i, marker: mk.raw, style: "superscript", at: L.text.indexOf(mk.raw) });
        if (profile.style === "superscript" || profile.style === "unclear") for (const gm of gluedMarkers(L.text)) if (gm.numbers.includes(num)) hits.push({ L, i, marker: gm.raw, style: "superscript", at: gm.at });
        if (ORPHAN.test(L.text.trim()) && i > 0) {
          const prev = body[i - 1];
          const nums = rc.expandRun(L.text.trim());
          if (nums && nums.includes(num) && prev.page === L.page && prev.text.length > 25 && /[A-Za-z]{3}/.test(prev.text) && !ORPHAN.test(prev.text.trim())) {
            hits.push({ L, i, marker: L.text.trim(), style: "superscript", at: -1, orphan: true });
          }
        }
      }
    }
  });
  if (styles.includes("authorYear") && want.surname && want.year) {
    const lines = pages.map((ls, pi) => ls.map((L, li) => ({ page: pi + 1, li, text: L.text })));
    for (const h of rc.findAuthorYearCitations(pages, want, { skipPages: index.refPages, sentenceAround: t => t })) {
      const pg = lines[h.page - 1] || [];
      const li = pg.findIndex(x => x.text === h.text);
      if (li >= 0 && !furn(h.text)) hits.push({ L: { ...pg[li], items: null }, i: -1, marker: h.marker, style: "authorYear", at: -1, ay: true, li });
    }
  }
  return hits;
}

/* ───────────── 3. SENTENCE ───────────── */
const endsSentence = t => /[.?!]["”')\]]*\s*$/.test(t) && !/\b(?:et al|Fig|Figs|vs|ca|no|approx)\.\s*$/i.test(t);

function sentenceFor(pageLines, li, orphan, furn, forward = 3) {
  const ls = pageLines;
  let a = orphan ? li - 1 : li;
  while (a > li - 6 && a > 0 && !endsSentence(ls[a - 1].text) && !furn(ls[a - 1].text)) a--;
  let b = li;
  while (b < li + forward && b < ls.length - 1 && !endsSentence(ls[b].text) && !furn(ls[b + 1].text) && !ORPHAN.test(ls[b + 1].text.trim())) b++;
  const pieces = ls.slice(a, b + 1).map(l => l.text.replace(/\s+/g, " ").trim()).filter(t => !furn(t));
  const joined = pieces.join(" ");
  let off = 0;
  for (let k = 0; k < li - a && k < pieces.length; k++) off += pieces[k].length + 1;
  if (orphan) off = Math.max(0, off - 2);
  const cuts = [0, ...[...joined.matchAll(/(?<=[.?!])\s+(?=[A-Z(\[])/g)].map(m => m.index + m[0].length), joined.length];
  let lo = 0, hi = joined.length;
  for (let k = 0; k < cuts.length - 1; k++) if (cuts[k] <= off + 1 && off < cuts[k + 1]) { lo = cuts[k]; hi = cuts[k + 1]; }
  return joined.slice(lo, hi).trim();
}

function tableCaption(pages, page, needle) {
  const flatNeedle = String(needle || "").replace(/\s+/g, " ").trim().slice(0, 25).toLowerCase();
  const CAP = /^(?:supplementary\s+)?table\s*(?:s?\d+|[ivx]+)\b/i;
  for (const pg of [page, page - 1]) {
    const lines = pages[pg - 1];
    if (!lines) continue;
    let at = pg === page ? lines.findIndex(l => l.text.toLowerCase().includes(flatNeedle)) : lines.length;
    if (at < 0) at = lines.length;
    for (let i = Math.min(at, lines.length - 1); i >= 0; i--) if (CAP.test(lines[i].text.trim())) {
      const nxt = lines[i + 1] && !CAP.test(lines[i + 1].text) && lines[i].text.length < 70 ? " " + lines[i + 1].text : "";
      return (lines[i].text + nxt).replace(/\s+/g, " ").trim().slice(0, 140);
    }
  }
  return null;
}

/* ───────────── driver ───────────── */
async function catalogRow(db, cat, r) {
  const abs = path.join(PKT, r.pdf_file);
  const pub = cat.prepare("SELECT title, authors, year FROM publications WHERE cites_id=?").get(r.cites_id) || {};
  const want = { title: pub.title || r.cited_paper, year: String(pub.year || "").slice(0, 4) || null, surname: rc.firstSurname(pub.authors), coauthors: rc.coauthorSurnames(pub.authors).slice(1) };
  const pages = await sm.extractPages(abs);
  const map = new Map();
  for (const L of sm.sectionMap(pages)) map.set(`${L.page}:${L.line}`, L);
  const index = rc.buildReferenceIndex(pages);
  const furn = furnitureSet(pages);
  const inRef = (pg, li) => index.refPages.has(pg) && !(index.refLineStart && pg === index.refLineStart.page && li < index.refLineStart.li);
  const body = [];
  pages.forEach((ls, pi) => ls.forEach((L, li) => {
    if (inRef(pi + 1, li) || furn(L.text)) return;
    body.push({ page: pi + 1, li, text: L.text, items: L.items });
  }));
  const profile = profileOf(body, index);

  // which bibliography entry is the applicant's paper
  let num = null, entry = null;
  const cands = rc.matchReference(index, want).filter(c => c.certain);
  if (cands.length) {
    const lead = cands.filter(c => rc.norm(c.entry).slice(0, 70).includes(rc.norm(want.surname || "~")));
    const pick = (lead.length ? lead : cands)[0];
    num = pick.num; entry = pick.entry.slice(0, 200);
  }
  const hits = findHits(profile, body, num, want, pages, furn, index);

  const mentions = [];
  const seen = new Set();
  for (const h of hits) {
    const pageLines = pages[h.L.page - 1];
    const li = h.ay ? h.li : h.L.li;
    const q = sentenceFor(pageLines, li, !!h.orphan, furn);
    if (q.length < 20) continue;
    if (DATA_NOISE.test(q)) continue;
    const key = h.L.page + ":" + q.slice(0, 60);
    if (seen.has(key)) continue;
    seen.add(key);
    const m = map.get(`${h.L.page}:${li}`) || {};
    // Affiliation and author-block superscripts ("Department of Chemistry, University of ...", "* Corresponding")
    // are not citations. An abstract or an introduction on page 1 is front matter too, and its markers are.
    if (h.style === "superscript" && /front matter/i.test(m.section || "") && /\b(?:University|Department|Institute|School of|Hospital|Laborator|Faculty|College|Corresponding|Received|Accepted)\b|@/i.test(q + " " + h.L.text)) continue;
    const rank = ["A", "B", "C", "D"].includes(m.rank) ? m.rank : null;
    const mention = { page: h.L.page, marker: h.marker, style: h.style, quote: q, section: m.section || "?", tier: rank || (/front matter/i.test(m.section || "") ? "C" : null), inferred: !rank };
    if (m.inTable) {
      const cap = tableCaption(pages, h.L.page, h.L.text);
      mention.table = cap || "a table (caption not found)";
      mention.section = `Listed in ${mention.table}${m.section && m.section !== "?" ? ` (${m.section})` : ""}`;
      if (!mention.tier) mention.tier = "C";
    }
    // a small reference number in a paper that is not [n]-numbered collides with compound and panel labels
    if (num != null && num <= 3 && profile.style !== "bracket" && profile.style !== "authorYear") mention.lowConfidence = true;
    mentions.push(mention);
  }
  const order = { A: 0, B: 1, C: 2, D: 3 };
  mentions.sort((a, b) => (order[a.tier] ?? 9) - (order[b.tier] ?? 9) || a.page - b.page);

  // what the current database holds for the same row, to compare
  const old = db.prepare("SELECT tier, section, page, substr(quote,1,160) q, basis FROM mention WHERE row_uid=?").all(r.row_uid);
  const best = list => list.reduce((b, x) => (b == null || (order[x.tier] ?? 9) < (order[b] ?? 9)) ? x.tier : b, null);
  let status;
  const nb = best(mentions), ob = best(old);
  if (!mentions.length && !old.length) status = "neither";
  else if (!mentions.length) status = "db-only";
  else if (!old.length) status = "catalog-only";
  else if (nb === ob) status = "same-tier";
  else status = (order[nb] ?? 9) < (order[ob] ?? 9) ? "catalog-higher" : "catalog-lower";

  return {
    uid: r.row_uid, citing: (r.citing_title || "").slice(0, 120), pdf: r.pdf_file,
    cited: (want.title || "").slice(0, 100), citedYear: want.year, citedSurname: want.surname,
    profile, entryNumber: num, entry,
    reason: mentions.length ? null : (num == null && profile.style !== "authorYear" && profile.style !== "mixed" && profile.style !== "unclear" ? "no bibliography entry matched the cited paper" : "the paper's own citation style was searched and no marker for it was found"),
    mentions, old, status, headline: nb,
  };
}

async function runAll() {
  const db = openPacket(), cat = openCatalog();
  let rows = db.prepare(`SELECT row_uid, cites_id, cited_paper, citing_title, pdf_file FROM citation WHERE status='held' AND is_main=1 AND pdf_file IS NOT NULL ORDER BY row_uid`).all();
  const only = opt("rows");
  if (only) { const s = new Set(only.split(",")); rows = rows.filter(r => s.has(r.row_uid)); }
  const from = Number(opt("from") || 0), to = Number(opt("to") || rows.length);
  rows = rows.slice(from, to);
  const prev = fs.existsSync(JSON_OUT) && !only ? JSON.parse(fs.readFileSync(JSON_OUT, "utf8")) : (fs.existsSync(JSON_OUT) ? JSON.parse(fs.readFileSync(JSON_OUT, "utf8")) : []);
  const byUid = new Map(prev.map(x => [x.uid, x]));
  let n = 0;
  for (const r of rows) {
    try { byUid.set(r.row_uid, await catalogRow(db, cat, r)); }
    catch (e) { byUid.set(r.row_uid, { uid: r.row_uid, error: String(e.message).slice(0, 120), mentions: [], old: [], status: "error", profile: { style: "error", counts: {} } }); }
    if (++n % 25 === 0) console.log(`  ${n}/${rows.length}`);
  }
  fs.mkdirSync(OUTDIR, { recursive: true });
  fs.writeFileSync(JSON_OUT, JSON.stringify([...byUid.values()].sort((a, b) => a.uid.localeCompare(b.uid)), null, 1));
  console.log(`catalogued ${rows.length} row(s) -> ${JSON_OUT}`);
}

/* ───────────── HTML ───────────── */
const esc = s => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function renderHtml() {
  const data = JSON.parse(fs.readFileSync(JSON_OUT, "utf8"));
  const count = (k, f) => data.reduce((a, x) => { const v = f(x); a[v] = (a[v] || 0) + 1; return a; }, {});
  const prof = count("p", x => x.profile.style);
  const stat = count("s", x => x.status);
  const tiers = count("t", x => x.headline || "none");
  const STY = { bracket: "[n] brackets", paren: "(n) parentheses", superscript: "superscript n", authorYear: "author-year", mixed: "mixed", unclear: "unclear", error: "error" };
  const STAT = { "same-tier": "same tier as the database", "catalog-higher": "catalog finds a higher tier", "catalog-lower": "catalog finds a lower tier", "catalog-only": "catalog only (database has nothing)", "db-only": "database only (catalog finds nothing)", neither: "neither finds a mention", error: "error" };
  const chips = (obj, labels) => Object.entries(obj).sort((a, b) => b[1] - a[1]).map(([k, v]) => `<span class="chip" data-k="${esc(k)}">${esc(labels[k] || k)} <b>${v}</b></span>`).join("");
  const rowHtml = x => {
    const ms = x.mentions.map(m => `<li class="m t${esc(m.tier || "x")}"><span class="pill">${esc(m.tier || "?")}</span> <span class="sec">${esc(m.section)} · p.${esc(m.page)} · ${esc(m.style)} ${esc(m.marker)}</span>${m.inferred ? ' <span class="inf">tier inferred</span>' : ""}${m.lowConfidence ? ' <span class="inf">small reference number: check it</span>' : ""}<div class="q">${esc(m.quote)}</div></li>`).join("");
    const old = x.old.length ? `<details><summary>database holds ${x.old.length} mention(s), best ${esc(x.status === "db-only" || x.status.startsWith("same") || x.status.startsWith("catalog-") ? (x.old.map(o => o.tier).sort()[0] || "?") : "?")}</summary><ul>${x.old.map(o => `<li><span class="pill">${esc(o.tier)}</span> ${esc(o.section)} p.${esc(o.page)} <span class="sub">(${esc(o.basis)})</span><div class="q">${esc(o.q)}</div></li>`).join("")}</ul></details>` : "";
    const c = x.profile.counts || {};
    return `<tr data-status="${esc(x.status)}" data-style="${esc(x.profile.style)}" data-tier="${esc(x.headline || "none")}" data-text="${esc((x.uid + " " + x.citing + " " + x.cited).toLowerCase())}">
<td class="uid">${esc(x.uid)}</td>
<td><div class="t1">${esc(x.citing)}</div><div class="sub">cites: ${esc(x.cited)} (${esc(x.citedYear)})</div></td>
<td><div><b>${esc(STY[x.profile.style] || x.profile.style)}</b></div><div class="sub">${esc(x.profile.why || x.error || "")}</div><div class="sub">markers seen: [n] ${c.bracket || 0} · (n) ${c.paren || 0} · sup ${c.superscript || 0} · author-year ${c.authorYear || 0}</div><div class="sub">bibliography: ${esc(x.profile.bibliography || "")}${x.entryNumber != null ? ` · entry ${x.entryNumber}` : ""}</div></td>
<td><span class="stat s-${esc(x.status)}">${esc(STAT[x.status] || x.status)}</span></td>
<td>${x.mentions.length ? `<ul class="ml">${ms}</ul>` : `<div class="none">${esc(x.reason || "")}</div>`}${old}</td></tr>`;
  };
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Citation Catalog v2</title><style>
:root{--bg:#fff;--fg:#1d2330;--mut:#5b6475;--line:#dfe3ea;--card:#f6f7fa;--a:#1a7f4b;--b:#2563c9;--c:#8a6d1a;--bad:#b3261e}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--bg:#14171d;--fg:#e6e9ef;--mut:#9aa3b2;--line:#2b303b;--card:#1b1f27;--a:#4cc38a;--b:#7aa7ff;--c:#d9b85a;--bad:#ff8a80}}
:root[data-theme="dark"]{--bg:#14171d;--fg:#e6e9ef;--mut:#9aa3b2;--line:#2b303b;--card:#1b1f27;--a:#4cc38a;--b:#7aa7ff;--c:#d9b85a;--bad:#ff8a80}
body{margin:0;background:var(--bg);color:var(--fg);font:15px/1.45 system-ui,sans-serif}main{max-width:1280px;margin:0 auto;padding:16px}
h1{font-size:22px;margin:.2em 0}.sub{color:var(--mut);font-size:13px}.chip{display:inline-block;background:var(--card);border:1px solid var(--line);border-radius:99px;padding:2px 10px;margin:2px;font-size:13px;cursor:pointer}.chip.on{outline:2px solid var(--b)}
.bar{display:flex;flex-wrap:wrap;gap:8px;margin:12px 0;position:sticky;top:0;background:var(--bg);padding:8px 0;z-index:2}input{padding:6px 10px;border:1px solid var(--line);border-radius:8px;background:var(--bg);color:var(--fg);min-width:240px}
table{border-collapse:collapse;width:100%}td{border-top:1px solid var(--line);padding:8px;vertical-align:top}.uid{font-family:ui-monospace,monospace;white-space:nowrap}.t1{font-weight:600}
.pill{display:inline-block;min-width:1.4em;text-align:center;border-radius:6px;padding:0 6px;font-weight:700;background:var(--card);border:1px solid var(--line)}.tA .pill{color:var(--a)}.tB .pill{color:var(--b)}.tC .pill{color:var(--c)}
.ml{list-style:none;margin:0;padding:0}.m{margin:0 0 8px}.q{margin:2px 0 0 0;padding-left:8px;border-left:3px solid var(--line);color:var(--fg)}.sec{color:var(--mut);font-size:13px}.inf{color:var(--bad);font-size:12px}.none{color:var(--mut);font-style:italic}
.stat{font-size:13px;padding:1px 8px;border-radius:6px;background:var(--card);border:1px solid var(--line)}.s-catalog-higher{color:var(--a)}.s-catalog-lower,.s-db-only{color:var(--bad)}details{margin-top:6px;color:var(--mut)}
.note{background:var(--card);border:1px solid var(--line);border-radius:10px;padding:10px 14px;margin:10px 0}@media (max-width:760px){td{display:block;border-top:0}tr{display:block;border-top:1px solid var(--line);padding:6px 0}}
</style></head><body><main>
<h1>Citation Catalog v2 — profile-first</h1>
<div class="sub">A separate review page: it is not linked from, and does not feed, the packet or the candidate list. Generated ${new Date().toISOString().slice(0, 10)} from ${data.length} held citations that have a PDF on file.</div>
<div class="note"><b>How it reads a paper.</b> 1) Work out how the paper cites: its bibliography format and which in-text style it actually uses ([n], (n), superscript, author-year). 2) Search for your publication's marker <i>only in that style</i> — in a "[3] Smith…" paper a "(3)" is a list item and is never read as a citation. 3) Quote the whole sentence with page and section; text in a table is tied to its caption ("Listed in Table N"). 4) Compare with what the database holds. Page headers and page numbers are removed before anything is counted.</div>
<div><b>How papers cite</b> ${chips(prof, STY)}</div>
<div><b>Against the database</b> ${chips(stat, STAT)}</div>
<div><b>Headline tier found</b> ${chips(tiers, {})}</div>
<div class="bar"><input id="q" placeholder="search uid, title…"><span class="sub" id="shown"></span></div>
<table><tbody id="body">${data.map(rowHtml).join("\n")}</tbody></table>
<script>(function(){var rows=[].slice.call(document.querySelectorAll("#body tr")),q=document.getElementById("q"),shown=document.getElementById("shown"),f={};
function apply(){var t=q.value.toLowerCase(),n=0;rows.forEach(function(r){var ok=(!t||r.dataset.text.indexOf(t)>=0)&&(!f.status||r.dataset.status===f.status)&&(!f.style||r.dataset.style===f.style)&&(!f.tier||r.dataset.tier===f.tier);r.style.display=ok?"":"none";if(ok)n++});shown.textContent="showing "+n+" of "+rows.length}
[].forEach.call(document.querySelectorAll(".chip"),function(c){c.addEventListener("click",function(){var grp=c.parentNode.firstChild.textContent.trim(),key=grp.indexOf("cite")>=0?"style":grp.indexOf("database")>=0?"status":"tier";var on=c.classList.contains("on");[].forEach.call(c.parentNode.querySelectorAll(".chip"),function(x){x.classList.remove("on")});if(on){delete f[key]}else{c.classList.add("on");f[key]=c.dataset.k}apply()})});
q.addEventListener("input",apply);apply()})();</script>
</main></body></html>`;
  fs.writeFileSync(HTML_OUT, html);
  console.log("wrote", HTML_OUT, `(${Math.round(html.length / 1024)} KB)`);
  console.log("profiles:", JSON.stringify(prof));
  console.log("vs database:", JSON.stringify(stat));
  console.log("headline tiers:", JSON.stringify(tiers));
}

if (argv.includes("--html")) renderHtml();
else runAll().then(() => { if (argv.includes("--and-html")) renderHtml(); }).catch(e => { console.error(e); process.exit(1); });

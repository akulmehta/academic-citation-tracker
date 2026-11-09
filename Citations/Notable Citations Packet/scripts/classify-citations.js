"use strict";
/**
 * Propose a classification for every held citation that has a PDF on file.
 * READ-ONLY: writes only the report files named below, never the database and never `tier`.
 *
 * Why this exists. `scan-mentions.js` finds where a tool is NAMED and `scan-refs.js` finds where a
 * paper is cited by number or author-year, but neither answers the questions in
 * `Citations/Citation Example Instructions.pdf`:
 *   - HOW was the work used (Implemented / Compared / Built upon / Verified / Background)?
 *   - Is the framing NEGATIVE (limitation, weakness, "ours is better")?
 *   - How often and at what length is it discussed?
 *   - Is the citing document a primary article, a review, a thesis?
 * and `scan-refs.js` over-reports: a reference number such as `1` or `12` also matches an NMR
 * superscript, a compound label "(12)", a peak list or a table cell. On cit-001535 (a synthetic
 * chemistry paper) it produced 28 "Methods" mentions of which none cited the applicant.
 *
 * So this script (1) rejects resolver mentions that are data, not citations; (2) classifies what
 * survives from the sentence the citing authors wrote; (3) assigns a CONFIDENCE, so only the
 * rows a person must read are sent to a person.
 *
 *   node scripts/classify-citations.js [--refs=<ref-mentions.json>] [--out=<dir>]
 *
 * Outputs (in --out, default archived-logs/): classification.json, filtered-mentions.json
 * (a `record-mentions.js` spec of only the surviving resolver mentions) and
 * CLASSIFICATION-REPORT.md in the packet folder.
 */
const fs = require("fs");
const path = require("path");
const { openPacket, PKT, REPO, toolForCitedPaper } = require("./lib");
const { scanFile } = require("./scan-mentions");
const { extractPages: extractText } = require("./pdf-text");
const { shape } = require("./article-shape");

const argv = process.argv.slice(2);
const opt = n => (argv.find(a => a.startsWith(`--${n}=`)) || "").split("=").slice(1).join("=") || null;
const OUT = opt("out") || path.join(REPO, "archived-logs");
const REFS = opt("refs") || path.join(OUT, "ref-mentions.json");
const REPORT = opt("report") || path.join(OUT, "ref-report.json");

/* ---------- 1. is the "mention" really a citation? ---------- */
// Data that a bare reference number collides with.
const DATA_NOISE = /\b(?:\d+(?:\.\d+)?\s*(?:Hz|MHz|mmol|mg|mL|µL|μL|µM|μM|nM|kDa|ppm|°C)|J\s*=|δ|HRMS|m\/z|NMR|ESI|calcd|yield|white (?:amorphous )?solid|\bbs\b|\bdd\b|\bt, J)/i;
// A numeric parenthetical like "(12)" is a compound or equation label, not a citation.
function isCompoundLabel(m) {
  return /cited as bracketed: \(\d+\)$/.test(m.note || "") || /cited as orphan superscript line/.test(m.note || "") && DATA_NOISE.test(m.quote || "");
}
function isNoise(m) {
  if (m.basis !== "reference-number resolution") return false; // author-year and named-tool hits are specific
  if (DATA_NOISE.test(m.quote || "")) return true;
  if (isCompoundLabel(m)) return true;
  // a "citation" that is just a figure / table caption fragment
  if (/^\s*(?:fig(?:ure)?|table|scheme)\b/i.test(m.quote || "") && /superscript/.test(m.note || "")) return true;
  return false;
}

/* ---------- 2. how was it used? ---------- */
const USE = [
  ["Verified", /\b(?:consistent with|in agreement with|in line with|corroborat\w+|confirm\w*|reproduc\w+|validat\w+|replicat\w+|similar to (?:those|the results)|as (?:previously )?reported by)\b/i],
  ["Compared", /\b(?:compared (?:with|to)|in comparison (?:with|to)|outperform\w*|superior|better than|versus|benchmark\w*)\b/i],
  ["Built upon", /\b(?:based on|builds? (?:up)?on|extend\w*|adapted from|modified from|improv\w+ (?:on|upon)|inspired by|developed (?:from|based))\b/i],
  ["Implemented", /\b(?:using|used|use of|performed|processed|analy[sz]ed (?:with|using|by)|according to|as described|following|were (?:generated|prepared|obtained)|software|pipeline|workflow|applied|employed|utili[sz]ed|implemented)\b/i],
];
// Hedging or negative framing — §1.3 and the PDF ("limitations, drawbacks or weaknesses").
const NEG = /\b(?:limitation\w*|drawback\w*|weakness\w*|unclear|uncertain|however|although|unfortunately|cannot|can not|could not|not (?:able|suitable|sufficient)|fail\w*|lack\w*|poor\w*|inferior|insufficient|challenge[sd]?|unlike|in contrast|while .{0,40} (?:only|limited))\b/i;

function useOf(m) {
  const q = m.quote || "";
  // Methods/Results location is evidence of use only when the sentence also reads like use.
  for (const [label, re] of USE) if (re.test(q)) {
    if (label === "Implemented" && !(m.tier === "A" || m.tier === "B")) continue;
    return label;
  }
  return null;
}

const TIERS = ["A", "B", "C", "D"];
const rank = t => TIERS.indexOf(t) < 0 ? 9 : TIERS.indexOf(t);

async function main() {
  const db = openPacket();
  const rows = db.prepare(`SELECT row_uid, folder_uid, status, tier, scan_tier, citing_title, cited_paper, pdf_file, citing_senior_author, citing_year
    FROM citation WHERE pdf_file IS NOT NULL AND status='held' AND is_main=1 ORDER BY row_uid`).all();
  const refSpec = fs.existsSync(REFS) ? JSON.parse(fs.readFileSync(REFS, "utf8")) : [];
  const refBy = new Map(refSpec.map(e => [e.row_uid, e.mentions]));
  // Everything the resolver saw, usable or not: a hit in an unranked section is still a citation.
  const repBy = new Map(((fs.existsSync(REPORT) ? JSON.parse(fs.readFileSync(REPORT, "utf8")).results : [])).map(e => [e.row_uid, e.files || []]));

  const out = [];
  const filtered = [];
  let rejected = 0;
  for (const r of rows) {
    const abs = path.join(PKT, r.pdf_file);
    const mentions = [];
    // named-tool hits, only for the tool this row's cited paper is
    const tool = toolForCitedPaper(r.cited_paper);
    let pageCount = null, scanErr = null;
    try {
      const s = await scanFile(abs, []);
      pageCount = s.pageCount;
      for (const h of s.found) {
        if (h.looksLikeReference || h.inTable) continue;
        if (tool && !h.tools.includes(tool)) continue;
        if (!TIERS.includes(h.rank)) continue;
        const q = (h.quotes && tool && h.quotes[tool]) || h.quote;
        mentions.push({ section: h.section && h.section.id || h.section || "", tier: h.rank, page: String(h.page), quote: q, basis: "extracted text", source: "named" });
      }
    } catch (e) { scanErr = String(e.message).slice(0, 80); }
    const refs = refBy.get(r.row_uid) || [];
    const kept = [];
    for (const m of refs) { if (isNoise(m)) rejected++; else { kept.push(m); mentions.push({ ...m, source: "ref" }); } }
    if (kept.length) filtered.push({ row_uid: r.row_uid, mentions: kept });

    let shp = null;
    try { shp = await shape(r.pdf_file); } catch { /* extraction failure says nothing about the paper */ }

    // dedupe by quote
    const seen = new Set();
    const uniq = mentions.filter(m => { const k = (m.quote || "").slice(0, 80); if (seen.has(k)) return false; seen.add(k); return true; });
    uniq.forEach(m => { m.use = useOf(m); m.negative = NEG.test(m.quote || ""); });
    uniq.sort((a, b) => rank(a.tier) - rank(b.tier));
    const best = uniq[0] || null;
    const headline = best ? best.tier : null;
    const sections = [...new Set(uniq.map(m => m.section))];
    const named = uniq.filter(m => m.source === "named");
    const verdict = shp ? shp.verdict : null;
    const isReview = !!verdict && /review|secondary/i.test(verdict);
    const isThesis = !!verdict && /thesis|dissertation/i.test(verdict);
    const anyNeg = uniq.some(m => m.negative);
    const bestUse = (uniq.find(m => m.tier === headline && m.use) || uniq.find(m => m.use) || {}).use || null;

    // confidence: what a person still has to do
    let confidence, why, unranked = null;
    if (!uniq.length) {
      // No in-text marker was resolved. That is not the same as "does not cite": the resolver
      // misses ranges, odd numbering and split lines. Look for the cited paper in the text at all.
      let inList = false;
      try {
        const flat = s => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
        const T = flat((await extractText(abs, null)).text);
        inList = flat(r.cited_paper).length >= 20 && T.includes(flat(r.cited_paper).slice(0, 40));
      } catch { /* leave false */ }
      const seen = (repBy.get(r.row_uid) || []).filter(f => f.outcome === "found" && f.hit);
      const entryOnly = (repBy.get(r.row_uid) || []).find(f => f.outcome === "entry-not-cited-in-text");
      if (scanErr) { confidence = "none"; why = `scan failed: ${scanErr}`; }
      else if (seen.length) {
        const h = seen[0].hit;
        confidence = "cited-unranked";
        why = `cited in text (${seen.length} place(s)) but the section could not be ranked (${h.section || "no heading"}; ${h.inTable ? "inside a table" : h.contextIsProse === false ? "no full sentence" : "unranked"}) — read p.${h.page}`;
        unranked = { page: String(h.page), section: h.section || "", quote: String(h.quote || h.line || "").slice(0, 300), count: seen.length };
      }
      else if (entryOnly) { confidence = "entry-no-marker"; why = `reference ${entryOnly.num} is the applicant's paper but no in-text marker for it was readable — read the PDF`; }
      else if (inList) { confidence = "listed-only"; why = "the applicant's paper is in the reference list but no in-text marker was resolved — read the PDF to place it"; }
      else { confidence = "none"; why = "the applicant's paper was not found in the text"; }
    }
    else if (uniq.length && named.length && (headline === "A" || headline === "B") && bestUse === "Implemented" && !anyNeg) { confidence = "high"; why = "tool named in a ranked section in a sentence that reads as use"; }
    else if (uniq.length && named.length) { confidence = "medium"; why = anyNeg ? "tool named, but a sentence carries hedging/negative wording — read it" : "tool named; use type not clear from the sentence"; }
    else if (uniq.length) { confidence = headline === "C" ? "low" : "medium-low"; why = "cited by reference number/author-year only; sentence must be read to confirm it is the applicant's work"; }

    out.push({
      row_uid: r.row_uid, title: (r.citing_title || "").slice(0, 110), year: r.citing_year, pdf: r.pdf_file,
      cited_paper: r.cited_paper, tool, work_type: verdict, review: isReview, thesis: isThesis,
      headline_tier: headline, use_type: bestUse, negative: anyNeg,
      mentions: uniq.length, named: named.length, sections, confidence, why,
      unranked,
      best: best ? { tier: best.tier, section: best.section, page: best.page, use: best.use, quote: (best.quote || "").slice(0, 400) } : null,
    });
  }

  fs.mkdirSync(OUT, { recursive: true });
  fs.writeFileSync(path.join(OUT, "classification.json"), JSON.stringify(out, null, 1));
  fs.writeFileSync(path.join(OUT, "filtered-mentions.json"), JSON.stringify(filtered, null, 1));

  const by = (k) => out.reduce((a, o) => (a[o[k] ?? "—"] = (a[o[k] ?? "—"] || 0) + 1, a), {});
  const md = [];
  md.push("# Classification proposal — held citations with a PDF on file", "");
  md.push("Generated by `scripts/classify-citations.js` (read-only; never writes `tier`). A proposal, not a judgement: counsel's guidance (`Citations/Citation Example Instructions.pdf`) is *how* the work was used, so each row carries a use type, a negative-framing flag and a confidence. The applicant decides what goes into `packet.html`.", "");
  md.push(`Rows classified: **${out.length}**. Resolver mentions rejected as data, not citations (NMR peaks, compound labels): **${rejected}**.`, "");
  md.push("| Headline tier | Rows |", "|---|---:|", ...Object.entries(by("headline_tier")).sort().map(([k, v]) => `| ${k} | ${v} |`), "");
  md.push("| Confidence | Rows |", "|---|---:|", ...Object.entries(by("confidence")).map(([k, v]) => `| ${k} | ${v} |`), "");
  md.push("| Use type | Rows |", "|---|---:|", ...Object.entries(by("use_type")).map(([k, v]) => `| ${k} | ${v} |`), "");
  md.push(`Flagged negative: **${out.filter(o => o.negative).length}**. Review-article shape: **${out.filter(o => o.review).length}**. Thesis shape: **${out.filter(o => o.thesis).length}**.`, "");
  const strong = out.filter(o => o.confidence === "high" || o.confidence === "medium").sort((a, b) => (a.headline_tier || "Z").localeCompare(b.headline_tier || "Z"));
  md.push("## Strongest candidates (named tool, or A/B location)", "", "| uid | tier | use | conf | neg | citing work | quote |", "|---|---|---|---|---|---|---|");
  for (const o of strong.slice(0, 120)) md.push(`| ${o.row_uid} | ${o.headline_tier || ""} ${o.best ? o.best.section + " p." + o.best.page : ""} | ${o.use_type || ""} | ${o.confidence} | ${o.negative ? "yes" : ""} | ${o.title.replace(/\|/g, "/")} | ${(o.best ? o.best.quote : "").replace(/\|/g, "/").slice(0, 160)} |`);
  fs.writeFileSync(path.join(PKT, "CLASSIFICATION-REPORT.md"), md.join("\n") + "\n");
  console.log(md.slice(2, 16).join("\n"));
  console.log("wrote", path.join(OUT, "classification.json"), "and CLASSIFICATION-REPORT.md");
  db.close();
}
main().catch(e => { console.error(e); process.exit(1); });

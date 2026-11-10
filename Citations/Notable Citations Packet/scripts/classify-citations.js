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
const { scanFile, extractPages: extractLines } = require("./scan-mentions");
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
  // "(43)" is how many journals print an ordinary citation. It is a compound label only when the sentence
  // around it is experimental data (NMR, yield, mg, solid ...), which DATA_NOISE tests; the shape alone says nothing.
  return (/cited as (?:bracketed: \(\d+\)|orphan superscript line)/.test(m.note || "")) && DATA_NOISE.test(m.quote || "");
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

/** "Table 2. Glycan-binding proteins ..." for the table a line sits in, looked up on its page then the one before. */
function tableCaption(pagesArr, page, needle) {
  const flatNeedle = String(needle || "").replace(/\s+/g, " ").trim().slice(0, 40).toLowerCase();
  const CAP = /^(?:supplementary\s+)?table\s*(?:s?\d+|[ivx]+)\b/i;
  for (const pg of [page, page - 1]) {
    const lines = pagesArr[pg - 1];
    if (!lines) continue;
    let at = pg === page ? lines.findIndex(l => l.text.toLowerCase().includes(flatNeedle.slice(0, 25))) : lines.length;
    if (at < 0) at = lines.length;
    for (let i = Math.min(at, lines.length - 1); i >= 0; i--) {
      if (CAP.test(lines[i].text.trim())) {
        const nxt = lines[i + 1] && !CAP.test(lines[i + 1].text) && lines[i].text.length < 70 ? " " + lines[i + 1].text : "";
        return (lines[i].text + nxt).replace(/\s+/g, " ").trim().slice(0, 140);
      }
    }
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
    const tableHits = [];
    const namedKept = [];
    // named-tool hits, only for the tool this row's cited paper is
    const tool = toolForCitedPaper(r.cited_paper);
    let pageCount = null, scanErr = null;
    try {
      const s = await scanFile(abs, []);
      pageCount = s.pageCount;
      for (const h of s.found) {
        if (h.looksLikeReference) continue;
        if (h.inTable) {
          if (tool && !h.tools.includes(tool)) continue;
          tableHits.push({ page: String(h.page), quote: (h.quotes && tool && h.quotes[tool]) || h.quote, rank: h.rank, section: h.section && h.section.id || h.section || "", basis: "extracted text", source: "named-table" });
          continue;
        }
        if (tool && !h.tools.includes(tool)) continue;
        if (!TIERS.includes(h.rank)) continue;
        const q = (h.quotes && tool && h.quotes[tool]) || h.quote;
        mentions.push({ section: h.section && h.section.id || h.section || "", tier: h.rank, page: String(h.page), quote: q, basis: "extracted text", source: "named" });
        namedKept.push(mentions[mentions.length - 1]);
      }
    } catch (e) { scanErr = String(e.message).slice(0, 80); }
    const refs = refBy.get(r.row_uid) || [];
    const kept = [];
    for (const m of refs) { if (isNoise(m)) rejected++; else { kept.push(m); mentions.push({ ...m, source: "ref" }); } }
    // (the spec is assembled after table mentions are added, below)
    // Citations the resolver saw but would not record: a fragment instead of a sentence, or a section
    // the paper never headed (front matter). The citation is real; only its quote is weak. Rank it by the
    // section it sits in — front matter is the abstract/introduction, so Tier C — and mark it inferred so
    // a person reads it before relying on it. Never in a table.
    for (const f of repBy.get(r.row_uid) || []) {
      const h = f.outcome === "found" && f.hit;
      if (h && h.inTable && h.rank !== "REF") {
        tableHits.push({ page: String(h.page), quote: String(h.line || h.quote || "").trim(), rank: h.rank, section: h.section || "", basis: "reference-number resolution", source: "ref-table" });
        continue;
      }
      if (!h || h.inTable) continue;
      const usable = ["A", "B", "C"].includes(h.rank) && h.contextIsProse !== false;
      // Skip only what was already counted above (same page, same marker). "Usable" by rank is not the
      // same as "recorded": scan-refs applies further tests, and a hit it dropped must not vanish here.
      if (usable && kept.some(m => String(m.page) === String(h.page) && (m.note || "").includes(String(h.marker)))) continue;
      if (usable && isNoise({ basis: "reference-number resolution", quote: h.quote || h.line, note: `cited as ${h.style || ""}: ${h.marker || ""}` })) continue;
      const tier = ["A", "B", "C"].includes(h.rank) ? h.rank : (/front matter/i.test(h.section || "") ? "C" : null);
      if (!tier) continue;
      const q = String(h.quote || h.line || "").trim();
      if (q.length < 8) continue;
      mentions.push({ section: h.section || "front matter", tier, page: String(h.page), quote: q, basis: "reference-number resolution", source: "ref-inferred", inferred: true });
    }

    let shp = null;
    try { shp = await shape(r.pdf_file); } catch { /* extraction failure says nothing about the paper */ }

    // Text inside a table is evidence too (a tools table that lists the applicant's paper). Tie it to the
    // table's caption and say so in the section, so a reader sees "Listed in Table 2 …" and not a loose row.
    if (tableHits.length) {
      let pg = null;
      try { pg = await extractLines(abs); } catch { /* no caption then */ }
      for (const t of tableHits) {
        if (!t.quote || t.quote.length < 6) continue;
        const cap = pg ? tableCaption(pg, Number(t.page), t.quote) : null;
        const tier = ["A", "B", "C"].includes(t.rank) ? t.rank : "C";
        const where = t.section && t.section !== "?" ? ` (${t.section})` : "";
        const m = { section: `Listed in ${cap || "a table (caption not found on this page)"}${where}`.slice(0, 220), tier, page: t.page, quote: t.quote.slice(0, 500), basis: t.basis, source: t.source, table: true };
        mentions.push(m);
        if (!cap) m.inferred = true;
      }
    }

    // dedupe by quote
    const seen = new Set();
    const uniq = mentions.filter(m => { const k = (m.quote || "").slice(0, 80); if (seen.has(k)) return false; seen.add(k); return true; });
    uniq.forEach(m => { m.use = useOf(m); m.negative = NEG.test(m.quote || ""); });
    // Record every occurrence whose quote is real text on its page. A fragment quote or a front-matter
    // tier is flagged `inferred` in the report, but it is still a verifiable sentence, and leaving it out
    // hid real citations (cit-000108 "anticoagulation properties (43)").
    const rec = uniq.filter(m => ["named", "ref", "named-table", "ref-table", "ref-inferred"].includes(m.source) && String(m.quote || "").length >= 20);
    if (rec.length) filtered.push({ row_uid: r.row_uid, mentions: rec.map(m => ({ section: m.section, tier: m.tier, page: m.page, quote: m.quote, use_type: null, basis: m.basis, verified: 0 })) });
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
    else if (uniq.length) { confidence = headline === "C" ? "low" : "medium-low"; why = uniq.every(m => m.inferred) ? "cited in text, but the quote is a fragment or sits in front matter, so the tier is inferred — read it" : "cited by reference number/author-year only; sentence must be read to confirm it is the applicant's work"; }

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

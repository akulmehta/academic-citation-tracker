/**
 * Find where the applicant's paper is cited WITHOUT the tool's name.
 *
 * Why this exists: a citing author who used GLAD or MAWE often does not write the
 * tool's name in the body at all. Two shapes cause that, and both were found in
 * the stored PDFs rather than imagined:
 *
 *   1. NUMBERED style — "following established procedures [125–127]", where the
 *      tool appears only in entry 126 of the bibliography. In the Kiessling
 *      article the ONLY in-text mark for MAWE is a superscript `69` typeset tight
 *      against the word "unclear", and the string "MAWE" appears nowhere outside
 *      the reference list.
 *   2. AUTHOR-YEAR style — "(Mehta et al. 2024)" and "(Mehta and Cummings 2019)",
 *      where there is no number to resolve at all. Guérardel 2026 cites the work
 *      twice this way and one of the two names the GLAD dashboard; a scanner that
 *      only understands numbering reports "no mention" on it.
 *
 * So this resolves the citation first and then reads the sentence around it:
 *
 *   - the applicant's paper for the row, from the catalog (title, year, first
 *     author's surname, co-author surnames);
 *   - which bibliography entry it is, from the PDF's own reference list — never
 *     assumed, and two signals required before a number is accepted;
 *   - every place that number, or that surname-plus-year, is credited in the body,
 *     with the section the citing paper printed and the sentence it sits in.
 *
 * The deliverable is the sentence, not the marker: counsel needs to read what the
 * citing authors said. `--mentions` therefore emits a `record-mentions.js` spec,
 * and that tool re-verifies every quote against the PDF on the page claimed before
 * anything is written. This script writes nothing to the packet database.
 *
 * Usage:
 *   node scripts/scan-refs.js                    # every folder with a cited PDF
 *   node scripts/scan-refs.js --folder=cit-000516
 *   node scripts/scan-refs.js --row=cit-000513
 *   node scripts/scan-refs.js --json=ref-report.json
 *   node scripts/scan-refs.js --mentions=ref-mentions.json   # feeds record-mentions.js
 *   node scripts/scan-refs.js --verbose          # also print the whole line
 */
"use strict";
const fs = require("fs");
const path = require("path");
const { openPacket, openCatalog, PKT } = require("./lib");
const rc = require("./ref-cites");
const { extractPages, sectionMap } = require("./scan-mentions");

const argv = process.argv.slice(2);
const opt = name => {
  const a = argv.find(x => x.startsWith(`--${name}=`));
  return a ? a.split("=").slice(1).join("=") : null;
};
const ONLY_FOLDER = opt("folder");
const ONLY_ROW = opt("row");
// Scope a sweep to one cited work. Without it, working a newly-seeded publication
// meant re-resolving every other work's folders, and a run that touches 200 folders
// to answer a question about 40 of them hides its own result in noise.
const ONLY_CITES = opt("cites");
const JSON_OUT = opt("json");
const MENTIONS_OUT = opt("mentions");
const VERBOSE = argv.includes("--verbose");

/**
 * The end of the sentence starting at or after `from`.
 *
 * A period is not always a sentence end: "et al." ends with one, and so do the
 * abbreviations a methods section is full of. Cutting at "al." is what made a
 * quote read "(Mehta et al." — the fragment of a sentence, which is worse than no
 * quote because it looks like one. Candidate ends are stepped over while the word
 * before the period is a known abbreviation.
 */
const ABBREV = /(?:\bet|\bal|cf|eg|ie|fig|figs|suppl|supp|dr|prof|vs|etc|no|nos|vol|vols|ed|eds|trans|app|approx|mol|equiv)\.$/i;

function endOfSentence(text, from) {
  const re = /[.?!](?=\s|$)/g;
  re.lastIndex = from;
  let m;
  while ((m = re.exec(text))) {
    if (ABBREV.test(text.slice(0, m.index + 1))) continue;
    return m.index + 1;
  }
  return text.length;
}

/**
 * The sentence containing the marker.
 *
 * `sentenceAround()` in the scanner keys on tool names, which by definition are
 * absent here, so the sentence is located from the marker itself. Walking back to
 * a sentence boundary rejects an abbreviation-initial ("Wang X. et al.") so a
 * quote does not begin mid-byline.
 */
function sentenceAt(text, marker) {
  if (!marker) return text.trim().slice(0, 600);
  const i = text.indexOf(marker);
  if (i < 0) return text.trim().slice(0, 600);
  let start = 0;
  const boundaries = [...text.slice(0, i).matchAll(/[.?!]\s+(?=[A-Z(\[])/g)];
  if (boundaries.length) {
    const last = boundaries[boundaries.length - 1];
    const candidate = last.index + last[0].length;
    // Only a real sentence end may start the quote, so "et al." cannot.
    if (!ABBREV.test(text.slice(0, last.index + 1))) start = candidate;
  }
  const end = endOfSentence(text, i);
  return text.slice(start, end).trim().slice(0, 600);
}

/**
 * Which section a line of the article is in, keyed on page and text.
 *
 * Going through the scanner's own `sectionMap` is what keeps this tool and
 * `scan-mentions.js` agreeing about a section boundary — two readers of one PDF
 * disagreeing about whether a page is Methods would be a defect nobody could see.
 */
function lineIndex(pages) {
  const map = new Map();
  for (const L of sectionMap(pages)) {
    const k = `${L.page}\u0000${L.text}`;
    if (!map.has(k)) map.set(k, { section: L.section, rank: L.rank, inTable: !!L.inTable });
  }
  return map;
}

/**
 * The applicant's paper a row cites, as something to look for in a PDF.
 *
 * Read from the catalog, which is the record's own projection of the Scholar
 * byline, so the surname and year are the ones already filed — not a guess read
 * back out of the citing paper.
 */
function citedWork(cat, citesId) {
  if (!citesId) return null;
  const p = cat.prepare("SELECT title, authors, year FROM publications WHERE cites_id=?").get(citesId);
  if (!p) return null;
  const surname = rc.firstSurname(p.authors);
  return {
    title: p.title,
    year: String(p.year || "").slice(0, 4) || null,
    surname,
    // The other bylined authors, so "(Mehta and Cummings 2019)" can be told apart
    // from a bare "(Mehta et al. 2019)".
    coauthors: rc.coauthorSurnames(p.authors).filter(s => rc.norm(s) !== rc.norm(surname || "")),
  };
}

/** Turn a resolver hit into a located occurrence, using the scanner's section map. */
function locate(art, h) {
  const loc = art.lines.get(`${h.context_page}\u0000${h.context}`)
    || art.lines.get(`${h.page}\u0000${h.text}`)
    || { section: "?", rank: "?", inTable: false };
  return {
    // The page the QUOTE is on. For an orphan superscript that is the previous
    // page, and `record-mentions.js --check` verifies the quote where it claims it.
    page: h.context_page,
    marker_page: h.page,
    section: loc.section,
    rank: loc.rank,
    inTable: loc.inTable,
    marker: h.marker,
    style: h.style || (h.superscript ? (h.glued ? "superscript (glued to word)" : "superscript")
      : h.orphan ? "orphan superscript line" : h.bare ? "bare number" : "bracketed"),
    jointWith: h.jointWith || [],
    certain: h.certain,
    contextIsProse: h.context_is_prose !== false,
    quote: h.orphan
      // The digits sit alone on their line, so the quote is the prose line the
      // sentence ended on. Its first sentence would often cut a sentence that
      // began on the line before; the whole printed line is what counsel finds.
      ? h.context.trim().slice(0, 600)
      : sentenceAt(h.context, h.marker),
    line: h.text.slice(0, 400),
  };
}

async function scanFolder(db, cat, folder) {
  const files = db.prepare(`SELECT * FROM file WHERE folder_uid=? AND cited=1 ORDER BY file`).all(folder);
  const rows = db.prepare(`SELECT row_uid, cites_id, cited_paper, citing_title, status, tier
    FROM citation WHERE folder_uid=? ORDER BY is_main DESC, row_uid`).all(folder);
  if (!files.length || !rows.length) return [];

  // Read each PDF once. Several rows of one folder share one article, and each
  // row still resolves its own cited paper to its own entry number.
  const parsed = new Map();
  for (const f of files) {
    const abs = path.join(PKT, f.file);
    if (!fs.existsSync(abs)) continue;
    try {
      const pages = await extractPages(abs);
      const index = rc.buildReferenceIndex(pages);
      // A numbered list and an author-year list are detected differently; take the
      // union so neither style's bibliography leaks into the other's results.
      const refPages = new Set([...index.refPages, ...rc.findReferenceBlockPages(pages)]);
      parsed.set(f.file, { file: f.file, pages, index, refPages, lines: lineIndex(pages) });
    } catch (e) {
      console.log(`  ! ${f.file}: ${e.message}`);
    }
  }
  if (!parsed.size) return [];

  const out = [];
  for (const r of rows) {
    const want = citedWork(cat, r.cites_id);
    if (!want) {
      out.push({ row_uid: r.row_uid, status: r.status, outcome: "no-cited-work",
        detail: "the row carries no cites_id the catalog knows" });
      continue;
    }
    const perFile = [];
    for (const art of parsed.values()) {
      const tablePages = new Set();
      for (const [k, v] of art.lines) if (v.inTable) tablePages.add(Number(k.split("\u0000")[0]));
      const before = perFile.length;

      // ── style 1: the paper has a reference NUMBER ──
      const cands = rc.matchReference(art.index, want);
      const certain = cands.filter(c => c.certain);
      let nums = [...new Set(certain.map(c => c.num))];
      // Two entries can both match when a bibliography lists one paper twice, or two papers share a
      // title. Prefer the entry whose author list opens with the cited paper's first author; if that
      // does not single one out, they are the same paper for our purposes and all are followed.
      if (nums.length > 1 && want.surname) {
        const lead = certain.filter(c => rc.norm(c.entry).slice(0, 60).includes(rc.norm(want.surname)));
        const leadNums = [...new Set(lead.map(c => c.num))];
        if (leadNums.length >= 1 && leadNums.length < nums.length) nums = leadNums;
      }
      if (nums.length > 1 && certain.every(c => c.titleScore >= 0.95)) {
        // same title, followed together: markers for any of them credit the paper
        const seenHits = [];
        for (const num of nums) {
          for (const h of rc.findMarkers(art.pages, art.index, num, { sentenceAround: t => t, tablePages })) {
            if (seenHits.some(x => x.page === h.page && x.marker === h.marker)) continue;
            seenHits.push(h);
            perFile.push({ file: art.file, style: "numbered", outcome: "found", num,
              entry: certain.find(c => c.num === num).entry.slice(0, 300), titleScore: certain[0].titleScore, hit: locate(art, h) });
          }
        }
        if (!seenHits.length) perFile.push({ file: art.file, style: "numbered", outcome: "entry-not-cited-in-text", num: nums[0], entry: certain[0].entry.slice(0, 300) });
        nums = [];
      }
      if (nums.length > 1) {
        // Two entries could both be the paper. Picking one would attach a sentence
        // to the wrong work, so the row is reported as ambiguous.
        perFile.push({ file: art.file, style: "numbered", outcome: "ambiguous", nums, candidates: certain });
      } else if (nums.length === 1) {
        const num = nums[0];
        const hits = rc.findMarkers(art.pages, art.index, num, { sentenceAround: t => t, tablePages });
        for (const h of hits) {
          perFile.push({ file: art.file, style: "numbered", outcome: "found",
            num, entry: certain[0].entry.slice(0, 300), titleScore: certain[0].titleScore, hit: locate(art, h) });
        }
        if (!hits.length) {
          perFile.push({ file: art.file, style: "numbered", outcome: "entry-not-cited-in-text",
            num, entry: certain[0].entry.slice(0, 300) });
        }
      }

      // ── style 2: the paper is cited by AUTHOR AND YEAR ──
      const ay = rc.findAuthorYearCitations(art.pages, want, { sentenceAround: t => t, skipPages: art.refPages })
        .filter(h => !tablePages.has(h.page));
      for (const h of ay) {
        perFile.push({ file: art.file, style: "author-year", outcome: "found", hit: locate(art, h) });
      }

      if (perFile.length === before) {
        perFile.push({ file: art.file, style: "either", outcome: "entry-not-found",
          best: cands[0] || null, entries: art.index.byNumber.size,
          detail: "no bibliography entry matched title + year + author, and no surname+year marker was found" });
      }
    }
    out.push({
      row_uid: r.row_uid,
      status: r.status,
      recorded_tier: r.tier || null,
      cited_paper: want.title,
      cited_year: want.year,
      cited_surname: want.surname,
      coauthors: want.coauthors,
      files: perFile,
    });
  }
  return out;
}

/* ── reporting ───────────────────────────────────────────────────────────── */

const WHY = {
  "entry-not-found": "no bibliography entry and no author-year marker",
  "entry-not-cited-in-text": "the entry exists but the number is never credited in the body",
  ambiguous: "two entries could be the paper — needs a person",
};

/**
 * Whether a hit can carry a tier.
 *
 * Same bar the named-tool scanner uses: under a heading the citing paper itself
 * printed, in prose, not a table cell and not the reference list.
 *
 * `contextIsProse` is the third condition and it exists because a resolved marker
 * is not itself evidence of a sentence. A chart's y-axis tick and a superscript
 * reference number reach the extractor as the same thing — a bare number on a line
 * of its own — and the resolver now refuses an orphan sitting under a run of
 * digits. Where a marker survives but the text behind it is a figure label or a
 * table cell, quoting it would offer counsel a fragment instead of a sentence, so
 * it is reported and not recorded.
 */
function usableHit(e) {
  return e.outcome === "found" && e.hit && e.hit.rank !== "?" && e.hit.rank !== "REF"
    && !e.hit.inTable && e.hit.contextIsProse;
}

function report(results) {
  for (const r of results) {
    console.log(`\n${r.row_uid}  [${r.status}]${r.recorded_tier ? ` tier ${r.recorded_tier}` : ""}`);
    console.log(`  cites: ${r.cited_paper} (${r.cited_year}, ${r.cited_surname}${r.coauthors && r.coauthors.length ? " + " + r.coauthors.join(", ") : ""})`);
    // One file can credit the same reference four times. Repeating the file name
    // and the entry for each makes a single article read as four findings, so the
    // heading is printed once per file and the occurrences are listed under it.
    let heading = null;
    for (const f of r.files || []) {
      const base = path.basename(f.file);
      if (f.outcome !== "found") {
        console.log(`  ${base} [${f.style}]: ${WHY[f.outcome] || f.outcome.replace(/-/g, " ")}`
          + (f.outcome === "entry-not-found" && f.best
            ? ` (closest entry ${f.best.num} at title score ${f.best.titleScore}${f.best.yearHit ? ", year" : ""}${f.best.authorHit ? ", author" : ""})`
            : "")
          + (f.outcome === "ambiguous" ? ` (entries ${f.nums.join(" and ")})` : ""));
        heading = null;
        continue;
      }
      const key = `${base}|${f.style}|${f.num}`;
      if (key !== heading) {
        const pre = f.style === "numbered" ? `reference ${f.num}` : `author-year "${f.hit.marker}"`;
        const strength = f.style === "author-year" ? (f.hit.certain ? " [co-author named]" : " [surname + year only]") : "";
        console.log(`  ${base}: ${pre}${f.titleScore !== undefined ? ` (title score ${f.titleScore})` : ""}${strength}`);
        if (f.entry) console.log(`      entry: ${f.entry}`);
        heading = key;
      }
      const h = f.hit;
      const tag = usableHit(f) ? "USABLE" : h.inTable ? "table" : h.rank === "REF" ? "reflist"
        : !h.contextIsProse ? "no sentence" : "unranked";
      console.log(`      [${tag}] ${h.section} p.${h.page}${h.marker_page !== h.page ? ` (mark printed on p.${h.marker_page})` : ""} as ${h.style}${h.jointWith.length ? ` with ${h.jointWith.join(", ")}` : ""}`);
      console.log(`         "${h.quote}"`);
      if (VERBOSE) console.log(`         line: ${h.line}`);
    }
  }
}

/**
 * The `record-mentions.js` spec for the usable hits.
 *
 * An author-year hit whose only evidence is surname + year is emitted too, but
 * the note says so, because a different first author named Mehta publishing in
 * the same year would match the same string. `record-mentions.js` verifies the
 * quote is on the page claimed; a person still reads it before it becomes a tier.
 */
function mentionsSpec(results) {
  const spec = [];
  for (const r of results) {
    const seen = new Set();
    const mentions = [];
    for (const f of r.files || []) {
      if (!usableHit(f)) continue;
      const h = f.hit;
      const k = `${h.section}|${h.page}|${h.quote}`;
      if (seen.has(k)) continue;   // one row cites one paper; the same sentence twice is one mention
      seen.add(k);
      mentions.push({
        section: h.section,
        tier: h.rank,
        page: String(h.page),
        quote: h.quote,
        use_type: null,
        basis: "reference-number resolution",
        verified: 0,
        note: f.style === "author-year"
          ? (h.certain ? `author-year citation naming a co-author: ${h.marker}` : `author-year citation on surname + year alone: ${h.marker} — read it before relying on it`)
          : `cited as ${h.style}${h.jointWith.length ? ` jointly with ${h.jointWith.join(", ")}` : ""}: ${h.marker}`,
      });
    }
    if (mentions.length) spec.push({ row_uid: r.row_uid, mentions });
  }
  return spec;
}

async function main() {
  const db = openPacket();
  const cat = openCatalog();
  const folders = ONLY_FOLDER
    ? [ONLY_FOLDER]
    : db.prepare(`SELECT DISTINCT folder_uid FROM file WHERE cited=1 ORDER BY folder_uid`).all().map(r => r.folder_uid);
  const scoped = ONLY_CITES
    ? folders.filter(f => db.prepare("SELECT 1 FROM citation WHERE folder_uid=? AND cites_id=? LIMIT 1").get(f, ONLY_CITES))
    : folders;
  if (ONLY_CITES) console.log(`scoped to cited work ${ONLY_CITES}: ${scoped.length} of ${folders.length} folder(s).`);
  const picked = [];
  for (const f of scoped) {
    if (ONLY_ROW && !db.prepare("SELECT 1 FROM citation WHERE folder_uid=? AND row_uid=?").get(f, ONLY_ROW)) continue;
    picked.push(f);
  }
  console.log(`resolving citations that name no tool, over ${picked.length} folder(s)`
    + (ONLY_ROW ? ` for row ${ONLY_ROW}` : "") + ".");
  const results = [];
  for (const f of picked) {
    try { results.push(...await scanFolder(db, cat, f)); }
    catch (e) { console.log(`  ! ${f}: ${e.message}`); }
  }
  report(results);

  const entries = [];
  for (const r of results) for (const f of r.files || []) entries.push(f);
  const counts = {};
  for (const e of entries) counts[`${e.style}:${e.outcome}`] = (counts[`${e.style}:${e.outcome}`] || 0) + 1;
  const rowsWithHits = results.filter(r => (r.files || []).some(usableHit)).length;
  const usable = entries.filter(usableHit).length;
  console.log(`\n${results.length} row(s) over ${picked.length} folder(s).`);
  for (const [k, v] of Object.entries(counts).sort()) console.log(`  ${v} ${k.replace(":", " ")} outcome(s)`);
  console.log(`  ${usable} occurrence(s) in a section the citing paper ranked, across ${rowsWithHits} row(s).`);
  console.log(`  A tier from a resolved citation is a claim about a sentence: run the spec through`);
  console.log(`  record-mentions.js --check, read the quote, then record it. Nothing here wrote to the database.`);

  if (JSON_OUT) {
    const p = path.isAbsolute(JSON_OUT) ? JSON_OUT : path.join(process.cwd(), JSON_OUT);
    fs.writeFileSync(p, JSON.stringify({ generated: new Date().toISOString().slice(0, 10), results }, null, 2));
    console.log(`\nwrote ${path.relative(PKT, p)}`);
  }
  if (MENTIONS_OUT) {
    const spec = mentionsSpec(results);
    const p = path.isAbsolute(MENTIONS_OUT) ? MENTIONS_OUT : path.join(process.cwd(), MENTIONS_OUT);
    fs.writeFileSync(p, JSON.stringify(spec, null, 2));
    console.log(`wrote ${path.relative(PKT, p)} — ${spec.length} row(s), ${spec.reduce((n, e) => n + e.mentions.length, 0)} mention(s).`);
  }
  db.close();
  cat.close();
}

if (require.main === module) main();

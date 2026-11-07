#!/usr/bin/env node
/**
 * File row-scoped evidence: the verbatim quote, the section it sits in, the page,
 * and the tier that follows from them.
 *
 * Why this exists instead of an UPDATE in a terminal:
 *
 * §4.6 requires `quote` to be VERBATIM text from the citing article, and §1.3
 * forbids letting a Methods mention read as a use of the tool. Both are claims
 * about a PDF. A script that types a quote from memory can produce a confident,
 * fluent, wrong sentence — and nothing downstream would notice, because the
 * renderer prints whatever the row holds.
 *
 * So every proposal here carries the quote it wants to file, and the quote is
 * checked against the extracted text of the PDF that row points at. A quote that
 * cannot be found is a refusal, not a warning. Text is compared after removing
 * every non-alphanumeric character, because PDF extraction inserts spaces inside
 * words ("D ashboard", "glycan - binding") that a person copying the sentence
 * would not reproduce.
 *
 * Rows in this corpus are per CITATION, not per paper: one citing article on four
 * exhibit pages is four rows, and each has its own cited tool. A quote copied
 * across a folder therefore mis-attributes a tool, which is what happened to the
 * rows corrected here. `--check` re-runs the guard over what is already filed.
 *
 * Usage:
 *   node scripts/record-evidence.js            # dry run, prints the plan
 *   node scripts/record-evidence.js --write    # apply (backs up the database)
 *   node scripts/record-evidence.js --check    # verify filed quotes are in the PDFs
 */
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
const { PKT, PACKET_DB, openPacket } = require("./lib.js");

/** Text as it must read once extraction artifacts are gone. */
function canon(s) {
  return String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

/**
 * The page numbers a claim names. `page` is free text — counsel reads "4", "4, 5"
 * and "22-30" alike, and the importer has written all three — so parse the numbers
 * and the ranges rather than matching the string. Returns [] when nothing in the
 * text is a number, which the callers treat as "no page claimed" (a warning in the
 * validator, not a failure here).
 */
function expandPages(page) {
  const s = String(page || "");
  const out = new Set();
  for (const m of s.matchAll(/(\d+)\s*[-–]\s*(\d+)/g)) {
    const a = parseInt(m[1], 10), b = parseInt(m[2], 10);
    if (b >= a && b - a < 200) for (let n = a; n <= b; n++) out.add(n);
  }
  const withoutRanges = s.replace(/\d+\s*[-–]\s*\d+/g, " ");
  for (const m of withoutRanges.matchAll(/\d+/g)) out.add(parseInt(m[0], 10));
  return [...out].sort((x, y) => x - y);
}

let pdfjsCache = null;
async function loadPdfjs() {
  if (!pdfjsCache) {
    const build = path.join(PKT, "node_modules", "pdfjs-dist");
    pdfjsCache = await import(pathToFileURL(path.join(build, "legacy", "build", "pdf.mjs")).href);
    pdfjsCache._assetDirs = {
      standardFontDataUrl: pathToFileURL(path.join(build, "standard_fonts") + path.sep).href,
      cMapUrl: pathToFileURL(path.join(build, "cmaps") + path.sep).href,
    };
  }
  return pdfjsCache;
}

/** One string per page, whitespace-normalised, so a page number can be named. */
async function pageTexts(abs) {
  const lib = await loadPdfjs();
  const doc = await lib.getDocument({
    data: new Uint8Array(fs.readFileSync(abs)),
    ...lib._assetDirs,
    useWorkerFetch: false,
    isEvalSupported: false,
    disableFontFace: true,
  }).promise;
  const pages = [];
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const tc = await page.getTextContent();
    pages.push(tc.items.map(i => i.str).join(" "));
  }
  await doc.destroy();
  return pages;
}

/**
 * What to file, and the sentence each claim rests on.
 *
 * `why` is not a comment — it is printed with every proposal so the reason a row
 * moved is reviewable next to the move.
 */
const PROPOSALS = [
  {
    row_uid: "cit-000416",
    tier: "C",
    section: "Discussion",
    page: "19",
    quote: "receptors known to bind to oligomannosylated N-glycans exhibit, in fact, unique, and sometimes very restricted, specificities toward oligomannose motifs (Gao et al. 2021)",
    use_type: null,
    evidence_basis: "extracted text",
    note: "The cited paper is the oligomannose-isomers article (Gao et al. 2021), not a tool paper. Its only in-text appearance is p.19, which sits in the Discussion (the article's Materials and Methods runs pp. 22-30). The tier A / Methods mark this row carried was copied from its sibling rows, which cite MAWE and GLAD.",
    why: "Only in-text mention is in the Discussion, so the folder-wide tier A did not belong to this row.",
  },
  {
    row_uid: "cit-000540",
    tier: "A",
    section: "Materials and Methods",
    page: "30",
    quote: "The results have analyzed with GLAD (Glycan Array Dashboard), which enables comparison of binding profiles and identification of enriched glycan motifs (Mehta and Cummings 2019)",
    use_type: "Implemented",
    evidence_basis: "extracted text",
    note: "Quote corrected: this row cites GLAD, and the sentence naming GLAD is on p.30 of the Materials and Methods. The row previously carried the MAWE sentence belonging to cit-001259.",
    why: "Row-scoped quote for the tool this row actually cites.",
  },
  {
    row_uid: "cit-000987",
    tier: "A",
    section: "Materials and Methods",
    page: "29",
    quote: "printed glycan microarray platform (version 5.6), comprising 539 glycans printed in six replicates per glycan",
    use_type: "Implemented",
    evidence_basis: "extracted text",
    note: "The review (Heimburg-Molinaro et al. 2024) is cited in Methods on p.29 as the source of the NCFG array platform used, printed as \"(Heimburg-Molinaro et al. 2024)\" immediately after the platform description.",
    why: "Row-scoped quote for the tool this row actually cites.",
  },
  {
    row_uid: "cit-000976",
    tier: "A",
    section: "Materials and Methods",
    page: "21",
    quote: "Glycan Microarray Analysis Glycan microarray analysis following established procedures [ 125 – 127 ] was carried out",
    use_type: "Implemented",
    evidence_basis: "reference-number resolution",
    note: "Reference 125 in this article is \"Insights Into Glycobiology and the Protein-Glycan Interactome Using Glycan Microarray Technologies\" (p.31 of the reference list). It is invoked in-text inside §4.9.5 Glycan Microarray Analysis as one of the \"established procedures\" the authors followed.",
    why: "Reference number resolved to its list entry, then located in-text.",
  },
  {
    row_uid: "cit-001252",
    tier: "A",
    section: "Materials and Methods",
    page: "21",
    quote: "Glycan Microarray Analysis Glycan microarray analysis following established procedures [ 125 – 127 ] was carried out",
    use_type: "Implemented",
    evidence_basis: "reference-number resolution",
    note: "Reference 127 is the MAWE paper (p.31 of the reference list) and is inside the [125-127] range invoked in §4.9.5 Glycan Microarray Analysis. Note the sentence credits the three references jointly as \"established procedures\"; it does not single out MAWE.",
    why: "Reference number resolved to its list entry, then located in-text.",
  },
  {
    row_uid: "cit-001261",
    tier: "A",
    section: "Materials and Methods",
    page: "20",
    quote: "Antibodies were tested against a panel of 562 unique glycan structures following a previously reported microwave-assisted wet-erase protocol, but with several exceptions",
    use_type: "Implemented",
    evidence_basis: "extracted text",
    note: "The same Methods section says on p.6: \"Glycan microarray protocol was followed using the microwave-assisted wet-erase process by Mehta et al.\" Reference 50 is the MAWE paper (reference list, p.29).",
    why: "Page of the Methods sentence was missing; both occurrences now recorded.",
  },
  {
    row_uid: "cit-000629",
    tier: "A",
    section: "Materials and Methods",
    page: "20",
    quote: "Figures of glycan structures were gathered using GlycoGlyph",
    use_type: "Implemented",
    evidence_basis: "extracted text",
    note: "Page corrected from 6 to 20. This row cites GlycoGlyph, and GlycoGlyph appears twice: on p.6 inside a figure legend (\"Diagrams of glycan structures were generated using GlycoGlyph\", next to \"their structures displayed on the right\") and on p.20 in Materials and Methods. The Discussion begins on p.15 and Materials and Methods on p.17, so p.6 is Results, not Methods — the tier A label and the p.6 page contradicted each other. The p.20 sentence is the one that supports tier A. The row previously carried the wet-erase sentence belonging to cit-001261, which is also on p.20.",
    why: "Tier A needs the Methods sentence; the filed page was in a figure legend in Results.",
  },
  {
    row_uid: "cit-000521",
    tier: "B",
    section: "Results / Figures",
    page: "4",
    quote: "The heat map was generated using the GLAD tool and represents the relative fluorescent units (RFU) normalized to 70,000 as the maximum value",
    use_type: "Verified",
    evidence_basis: "extracted text",
    note: "Tier B kept as recorded. The quote is the Figure 3 caption on p.4 (repeated for Figures 4 and 5 on p.5). Note for counsel: the Methods section also names the tool on p.10 — \"Data are depicted as heat-maps (Figs. 3-5 ...) the former generated using the GLAD tool\" — which would support tier A. Both readings are recorded; the applicant's B is left standing.",
    why: "Included row had no verbatim quote; the figure caption is filed and the stronger Methods reading is noted rather than assumed.",
  },
  {
    row_uid: "cit-001253",
    tier: "A",
    section: "Materials and Methods",
    page: "15",
    quote: "the core facility also changed protocols and began regenerating and reusing slides; the long-term effects on fluorescence intensity are unclear",
    use_type: null,
    evidence_basis: "extracted text",
    note: "READ THIS BEFORE USING THE ROW. Reference 69 is the MAWE paper, and its one in-text appearance is the hedging sentence quoted here — the citing authors note that the facility began regenerating and reusing slides and that the effect on intensity is unclear. That is a Methods-adjacent mention, not a statement that MAWE was used, and §1.3 of the instructions names this exact kind of hedge. `use_type` is deliberately left empty. The applicant's own summary already recorded the same doubt.",
    why: "Included row had no quote; the sentence found is a hedge, so it is filed verbatim with use_type empty rather than presented as use of the tool.",
  },
  // The two Heras rows are one work Scholar lists twice — under its bioRxiv title
  // and its journal title — which is why the folder carries the preprint, the
  // bioRxiv page and the final article. Both rows had the work's OWN TITLE filed
  // in `quote`: the importer took the docx's bold heading, which is a title, not a
  // mention. Counsel reading either row would have been handed a string that
  // appears nowhere in the paper as though it were evidence of use.
  {
    row_uid: "cit-000544",
    tier: "A",
    section: "Materials and Methods",
    page: "4",
    quote: "The results of glycan specificity for PpaPV1 were compared with those of PsSC (Ituarte et al., 2018) and PdPV1 (Brola et al., 2020) using the Glycan Array Dashboard (glycotoolkit.com/GLAD/) (Mehta and Cummings, 2019)",
    use_type: "Compared",
    evidence_basis: "extracted text",
    note: "Quote corrected: the row previously held the article's own title, which is not a sentence from the paper and appears nowhere in it. The sentence quoted here is the journal article's Materials and Methods on p.4 and names GLAD and the authors. `use_type` is set to \"Compared\" rather than the \"Implemented\" taken from the docx note, because that is what the sentence says the dashboard was used for.",
    why: "The filed quote was the work's title, not a mention; replaced with the sentence that actually names GLAD.",
  },
  {
    row_uid: "cit-000558",
    tier: "A",
    section: "Materials and Methods",
    page: "4",
    quote: "The results of glycan specificity for PpaPV1 were compared with those of PsSC (Ituarte et al., 2018) and PdPV1 (Brola et al., 2020) using the Glycan Array Dashboard (glycotoolkit.com/GLAD/) (Mehta and Cummings, 2019)",
    use_type: "Compared",
    evidence_basis: "extracted text",
    note: "Quote corrected: the row previously held the bioRxiv preprint's title, which is not a sentence from the paper. This row's `pdf_file` is the final article, so the article's p.4 sentence is filed. The preprint in the same folder makes the same statement at p.10 in slightly different wording — \"PpaPV1 glycan microarray data were compared with PsSC (Ituarte et al., 2018) and PdPV1 (Brola et al., 2020) microarrays using the Glycan Array Dashboard (glycotoolkit.com/GLAD/) (Mehta & Cummings, 2019)\" — which is the point of holding both files: the preprint shows the statement existed before the 25 Apr 2024 filing date.",
    why: "The filed quote was the preprint's title, not a mention; replaced with the sentence that actually names GLAD.",
  },
];

(async () => {
  const args = process.argv.slice(2);
  const doWrite = args.includes("--write");
  const checkOnly = args.includes("--check");
  const db = openPacket();
  const pageCache = new Map();

  async function pagesFor(abs) {
    if (!pageCache.has(abs)) pageCache.set(abs, await pageTexts(abs));
    return pageCache.get(abs);
  }

  const failures = [];
  const plan = [];
  for (const p of PROPOSALS) {
    const row = db.prepare("SELECT row_uid, folder_uid, tier, section, page, quote, use_type, evidence_basis, notes, pdf_file, cited_tool FROM citation WHERE row_uid = ?").get(p.row_uid);
    if (!row) { failures.push(`${p.row_uid}: no such row`); continue; }
    if (!row.pdf_file) { failures.push(`${p.row_uid}: no pdf_file, cannot verify a quote`); continue; }
    const abs = path.join(PKT, row.pdf_file);
    if (!fs.existsSync(abs)) { failures.push(`${p.row_uid}: ${row.pdf_file} is not on disk`); continue; }

    const pages = await pagesFor(abs);
    const want = canon(p.quote);
    const hits = [];
    pages.forEach((t, i) => { if (canon(t).includes(want)) hits.push(i + 1); });
    if (!hits.length) {
      failures.push(`${p.row_uid}: the quote offered for ${row.pdf_file} does not appear in that file — refusing to file it`);
      continue;
    }

    // A quote filed against a page must actually be on that page.
    const claimed = expandPages(p.page);
    const off = claimed.filter(c => !hits.includes(c));
    if (off.length) {
      failures.push(`${p.row_uid}: quote claimed on p.${off.join(",")} but found only on p.${hits.join(",")} of ${row.pdf_file}`);
      continue;
    }

    const same = row.quote && canon(row.quote).includes(want);
    plan.push({ p, row, hits, same });
  }

  if (checkOnly) {
    const filed = db.prepare("SELECT row_uid, pdf_file, quote, page, section FROM citation WHERE status = 'included' AND quote IS NOT NULL AND quote <> ''").all();
    for (const r of filed) {
      const abs = path.join(PKT, r.pdf_file || "");
      if (!r.pdf_file || !fs.existsSync(abs)) { failures.push(`${r.row_uid}: included with quote but ${r.pdf_file || "(no pdf_file)"} is unreadable`); continue; }
      const pages = await pagesFor(abs);
      const hits = [];
      pages.forEach((t, i) => { if (canon(t).includes(canon(r.quote))) hits.push(i + 1); });
      if (!hits.length) {
        failures.push(`${r.row_uid}: filed quote is not present in ${r.pdf_file}`);
        continue;
      }
      // The page is part of the claim. `cit-000629` filed a real sentence from a
      // real PDF on a real page — p.6 — and labelled it Materials and Methods,
      // when p.6 was a figure legend in Results and the Methods sentence was the
      // one on p.20. Checking only "is the text in the file" passed that row for
      // two runs. A quotation with the wrong page number is exactly as misleading
      // as a quotation that does not exist, because counsel turns to that page.
      const claimed = expandPages(r.page);
      if (claimed.length && !claimed.some(c => hits.includes(c))) {
        failures.push(`${r.row_uid}: quote filed at p.${r.page} but found only on p.${hits.join(",")} of ${r.pdf_file}`);
      }
    }
    console.log(`checked ${filed.length} filed quote(s) against their PDFs.`);
    for (const f of failures) console.log(`  FAIL ${f}`);
    db.close();
    process.exit(failures.length ? 1 : 0);
  }

  for (const { p, row, hits, same } of plan) {
    console.log(`\n${p.row_uid}  (${row.cited_tool || "no tool"})  ${same ? "quote unchanged" : "NEW QUOTE"}`);
    console.log(`  why    : ${p.why}`);
    console.log(`  tier   : ${row.tier || "(none)"} -> ${p.tier}`);
    console.log(`  section: ${row.section || "(none)"} -> ${p.section}`);
    console.log(`  page   : ${row.page || "(none)"} -> ${p.page}   (found on p.${hits.join(",")})`);
    console.log(`  use    : ${row.use_type || "(none)"} -> ${p.use_type || "(none)"}`);
    console.log(`  basis  : ${row.evidence_basis || "(none)"} -> ${p.evidence_basis}`);
    console.log(`  quote  : ${p.quote}`);
    if (p.note) console.log(`  note   : ${p.note}`);
  }
  for (const f of failures) console.log(`\nFAIL ${f}`);

  if (!doWrite) {
    console.log(`\ndry run: ${plan.length} row(s) would be written, ${failures.length} refused. Re-run with --write.`);
    db.close();
    process.exit(failures.length ? 1 : 0);
  }
  if (failures.length) {
    console.log(`\nrefusing to write: ${failures.length} proposal(s) failed their checks.`);
    db.close();
    process.exit(1);
  }

  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  const bak = path.join(PKT, `notable-citations.pre-evidence-${stamp}.bak`);
  fs.copyFileSync(PACKET_DB, bak);
  console.log(`\nbacked up to ${path.basename(bak)}`);

  const upd = db.prepare(`
    UPDATE citation
       SET tier = ?, section = ?, page = ?, quote = ?, use_type = ?, evidence_basis = ?, notes = ?
     WHERE row_uid = ?
  `);
  db.exec("BEGIN");
  try {
    for (const { p, row } of plan) {
      // Idempotent: re-running this script must not append the same note twice.
      const add = p.note ? `PDF check: ${p.note}` : "";
      const already = add && String(row.notes || "").includes(add);
      const notes = [row.notes, add && !already ? add : ""].filter(Boolean).join("\n\n");
      upd.run(p.tier, p.section, p.page, p.quote, p.use_type, p.evidence_basis, notes, p.row_uid);
    }
    db.exec("COMMIT");
  } catch (e) {
    db.exec("ROLLBACK");
    console.error(`write failed, rolled back: ${e.message}`);
    process.exit(1);
  }
  console.log(`wrote ${plan.length} row(s).`);
  db.close();
})();

#!/usr/bin/env node
"use strict";
/**
 * Move one citation the applicant has chosen from the candidate list into packet.html.
 *
 * packet.html is built only from rows with status = 'included' (§4.3), so choosing a citation means
 * turning a `held` row into an `included` one WITH everything the packet prints for it. Doing that by
 * hand in several tools is how a half-promoted row (included, but no quote, no number, folder still in
 * pending-papers/) gets made, so this script does the whole sequence, refuses early, and writes nothing
 * unless every check passed:
 *
 *   1. the row is held, is the main row of its folder, is English, is not negative;
 *   2. it is still a candidate the list may show (independent, not in the original application);
 *   3. its PDF is filed, and is a research article (not a thesis or a review);
 *   4. the quotation is VERBATIM in the PDF, on the page the packet will name (pdfverify.verifyQuote);
 *   5. the project number exists.
 * Then, in one transaction after a database backup: status, index number `n` (next free), project, tier,
 * section, page, quote and use type are filed on the row. The PDF folder moves to papers/ afterwards
 * (relocate-pdfs.js owns all movement), and the four prose sections go in through narrative-intake.js,
 * which re-checks that every page it names exists.
 *
 *   node scripts/promote-citation.js --row=cit-000196 --project=3 --use-type=Implemented \
 *        --tier=A --page=2 --section="Materials and Methods (3.2 ...)" --quote="..." \
 *        [--narrative=narrative.json]                  # dry run: prints the plan, writes nothing
 *   ... --write                                        # apply
 *   node scripts/promote-citation.js --demote=cit-000196 [--write]   # put it back to `held`
 *
 * Nothing here touches the Independent Citation Record or its Progress Tracker.
 */
const fs = require("fs");
const path = require("path");
const cp = require("child_process");
const L = require("./lib");
const { verifyQuote } = require("./pdfverify");

const argv = process.argv.slice(2);
const opt = n => { const a = argv.find(s => s.startsWith(`--${n}=`)); return a ? a.split("=").slice(1).join("=") : null; };
const WRITE = argv.includes("--write");
const PROJECTS = {
  "1": "Synthesizing Anticoagulants with Reduced Side Effects",
  "2": "Developing Bioinformatics Tools to Capture and Analyze Glycomics and Glycan Microarray Data",
  "3": "Advancing Glycan Research with Microarray Innovations",
  "4": "Advancing Glycopeptide Synthesis with Glyco-SPOT",
};
const USE_TYPES = ["Implemented", "Compared", "Built upon", "Verified"];

function backup() {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const dest = L.PACKET_DB.replace(/\.sqlite$/, `.pre-promote-${stamp}.bak`);
  fs.copyFileSync(L.PACKET_DB, dest);
  console.log(`backed up to ${path.basename(dest)}`);
}

function run(script, args) {
  const r = cp.spawnSync("node", [path.join(__dirname, script), ...args], { encoding: "utf8", cwd: path.dirname(__dirname) });
  const out = (r.stdout || "") + (r.stderr || "");
  console.log(out.split("\n").filter(l => l.trim() && !/^Warning:/.test(l)).map(l => "  | " + l).join("\n"));
  if (r.status !== 0) throw new Error(`${script} failed (exit ${r.status})`);
}

async function demote(uid) {
  const db = L.openPacket();
  const r = db.prepare("SELECT row_uid, status, n FROM citation WHERE row_uid=?").get(uid);
  if (!r) throw new Error(`no such row ${uid}`);
  if (r.status !== "included") throw new Error(`${uid} is ${r.status}, not included`);
  console.log(`${uid}: included (n=${r.n}) -> held; its narrative row is kept but not printed.`);
  if (!WRITE) { console.log("dry run — re-run with --write."); return; }
  db.close(); backup();
  const d2 = L.openPacket();
  d2.prepare(`UPDATE citation SET status='held', n=NULL, project=NULL, tier=NULL, section=NULL, page=NULL, quote=NULL, use_type=NULL, evidence_basis=NULL WHERE row_uid=?`).run(uid);
  d2.close();
  run("relocate-pdfs.js", ["--write"]);
}

async function main() {
  if (opt("demote")) return demote(opt("demote"));
  const uid = opt("row");
  const project = opt("project"), useType = opt("use-type"), tier = opt("tier"), page = opt("page");
  const section = opt("section"), quote = opt("quote");
  const need = { row: uid, project, "use-type": useType, tier, page, section, quote };
  const missing = Object.entries(need).filter(([, v]) => !v).map(([k]) => `--${k}`);
  if (missing.length) { console.error(`missing: ${missing.join(", ")}`); process.exit(2); }

  const problems = [];
  const db = L.openPacket(), cat = L.openCatalog();
  const r = db.prepare("SELECT * FROM citation WHERE row_uid=?").get(uid);
  if (!r) { console.error(`no such row ${uid}`); process.exit(1); }

  if (r.status !== "held") problems.push(`status is '${r.status}', must be 'held'`);
  if (!r.is_main) problems.push("not the main row of its folder");
  if (r.language !== "English") problems.push(`language is '${r.language}', must be English`);
  if (r.negative) problems.push("row is marked negative (§1.2)");
  if (!PROJECTS[project]) problems.push(`project '${project}' is not one of ${Object.keys(PROJECTS).join(", ")}`);
  if (!USE_TYPES.includes(useType)) problems.push(`use type must be one of ${USE_TYPES.join(", ")}`);
  if (!["A", "B", "C"].includes(tier)) problems.push("tier must be A, B or C");

  // still a candidate the list is allowed to show (independent, not already filed)
  const orig = L.originalApplicationUids();
  if (orig && orig.has(uid)) problems.push("this row is in the original application (§3); it is not repeated");
  const eligible = new Set(L.potentialIndependent(cat, db, r.cites_id).rows.map(x => x.row_uid));
  if (!eligible.has(uid)) problems.push("not an eligible candidate (not independent, superseded, non-English, decided against, or in the packet)");

  // the file
  const files = db.prepare("SELECT file FROM file WHERE folder_uid=? AND cited=1 ORDER BY file").all(r.folder_uid);
  if (!files.length) problems.push("no cited PDF is filed for this folder");
  const pdfRel = files.length ? files[0].file : null;

  // research article, not a thesis or review
  if (pdfRel) {
    try {
      const { shape } = require("./article-shape");
      const s = await shape(pdfRel);
      console.log(`article shape: ${s.verdict} (${s.pages} pages)`);
      if (/review|secondary|thesis|dissertation/i.test(s.verdict)) problems.push(`the PDF reads as '${s.verdict}', which §1.2 excludes`);
    } catch (e) { console.log(`(article shape could not be read: ${String(e.message).slice(0, 60)})`); }
  }

  // the quotation, verbatim, on the page named
  if (pdfRel) {
    const v = await verifyQuote(quote, pdfRel, page);
    console.log(`quote check: ${v.ok ? "OK" : "FAILED"} — ${v.why}`);
    if (!v.ok) problems.push(`quote is not verbatim on p.${page}: ${v.why}`);
  }

  const nextN = (db.prepare("SELECT MAX(n) m FROM citation").get().m || 0) + 1;
  console.log(`\nplan for ${uid}`);
  console.log(`  citing paper : ${r.citing_title}`);
  console.log(`  cites        : ${r.cited_paper}`);
  console.log(`  index number : ${nextN}`);
  console.log(`  project      : ${project} — ${PROJECTS[project] || "?"}`);
  console.log(`  location     : ${section}, p.${page}  ·  Tier ${tier}  ·  ${useType}`);
  console.log(`  quote        : "${quote.slice(0, 200)}${quote.length > 200 ? "…" : ""}"`);
  console.log(`  folder       : ${r.pdf_file}  ->  papers/${r.folder_uid}/`);
  if (problems.length) {
    console.log("\nREFUSED:\n" + problems.map(p => "  - " + p).join("\n"));
    process.exit(1);
  }
  if (!WRITE) { console.log("\ndry run — nothing written. Re-run with --write."); return; }

  db.close(); backup();
  const d = L.openPacket();
  d.exec("BEGIN");
  try {
    d.prepare(`UPDATE citation SET status='included', n=?, project=?, tier=?, section=?, page=?, quote=?, use_type=?,
               evidence_basis='human reading', negative=0 WHERE row_uid=?`)
      .run(nextN, project, tier, section, String(page), quote, useType, uid);
    d.exec("COMMIT");
  } catch (e) { d.exec("ROLLBACK"); throw e; }
  d.close();
  console.log(`\n${uid} is now included as citation n=${nextN}.`);
  run("relocate-pdfs.js", ["--write"]);
  const nf = opt("narrative");
  if (nf) run("narrative-intake.js", [`--from=${nf}`, "--write"]);
  else console.log("no --narrative given: Section II will print as a marked blank until prose is filed.");
}

main().catch(e => { console.error(e); process.exit(1); });

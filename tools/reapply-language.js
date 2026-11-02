// Re-apply the non-English screen to reports that were captured earlier.
//
// Why this is needed. The language screen lives in capture-citations.js and is
// evaluated once, at capture time, and stored on each entry as language_flag.
// The report JSON is the source of truth for the ledger, the catalog, the audit
// and the review sheets, so when the rule changes the stored flags are the ones
// every figure is built from. Two consequences were found on 2026-11-01:
//
//   1. a rule fix does not reach exhibits already captured; and
//   2. the stored flags therefore disagreed with the code that produced the
//      next capture (the Portuguese entry galectin-3 p2 was highlighted because
//      it was captured before the accent test existed).
//
// What it does, per entry of every report:
//   language_flag_captured  set once, from the value the capture stored, so the
//                           original is never lost;
//   language_flag           recomputed with the current rule.
//
// Nothing else on the entry is touched. Language editions in particular stay
// exactly as the capture decided them; tally.markLanguageEditions is applied
// per-read by every consumer and re-running it here would double-apply.
//
// Dry run by default. --write is required to change any file, and every file
// written is first copied to Exhibits/Supporting/Pre-rule-reapply-<date>/.
//
//   node tools/reapply-language.js              show what would change
//   node tools/reapply-language.js --write      apply it
//   node tools/reapply-language.js --all        include archived/unfiled reports

const fs = require("fs");
const path = require("path");
const lib = require("./tally");
const { languageFlag } = require("./capture-citations.js");

const ROOT = path.resolve(__dirname, "..");
const EXHIBITS = path.join(ROOT, "Independent Citation Record", "Exhibits");
const SUPPORT_DIR = path.join(EXHIBITS, "Supporting");
const PDF_DIR = path.join(EXHIBITS, "PDFs");
const ARCHIVE_DIR = path.join(EXHIBITS, "Archive");

const write = process.argv.includes("--write");
const includeAll = process.argv.includes("--all");
const TODAY = new Date().toISOString().slice(0, 10);
const BACKUP_DIR = path.join(SUPPORT_DIR, `Pre-rule-reapply-${TODAY}`);

// Reports to consider. Default is the filed set, which is what the ledger
// counts; --all adds archived captures and reports whose PDF is gone.
function targetReports() {
  const dirs = includeAll ? [SUPPORT_DIR, ARCHIVE_DIR] : [SUPPORT_DIR];
  const filed = lib.filedBases(PDF_DIR);
  const out = [];
  for (const dir of dirs) {
    let names;
    try {
      names = fs.readdirSync(dir);
    } catch {
      continue;
    }
    for (const name of names) {
      if (!name.endsWith(".report.json")) continue;
      if (name.startsWith("SUPERSEDED-")) continue;
      const pub = name.replace(/\.report\.json$/, "").replace(/-p\d+$/, "");
      if (!filed.has(pub)) continue;
      out.push({ dir, name, full: path.join(dir, name), pub });
    }
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

function main() {
  const reports = targetReports();
  if (!reports.length) {
    console.error("No filed reports found.");
    process.exitCode = 1;
    return;
  }

  const changes = [];
  const touched = new Map();

  for (const r of reports) {
    const data = JSON.parse(fs.readFileSync(r.full, "utf8"));
    let dirty = false;
    for (const e of data.entries || []) {
      if (e.language_flag_captured === undefined) {
        e.language_flag_captured = e.language_flag || "";
        // Recording the baseline is itself a change to the file, but it adds no
        // information any figure depends on.
        dirty = true;
      }
      const fresh = languageFlag(e);
      if ((e.language_flag || "") !== fresh) {
        const nowMarked = lib.isHighlighted({ ...e, language_flag: fresh });
        changes.push({
          base: r.name.replace(/\.report\.json$/, ""),
          cid: e.cid,
          from: e.language_flag || "",
          to: fresh,
          status: e.status,
          confirm_state: e.confirm_state,
          wasMarked: lib.isHighlighted(e),
          nowMarked,
          flips: lib.isHighlighted(e) !== nowMarked,
          title: String(e.title || "").slice(0, 78),
        });
        e.language_flag = fresh;
        dirty = true;
      }
    }
    if (dirty) touched.set(r.full, data);
  }

  // Counting effect, on the same basis the ledger uses: rows, and distinct
  // papers per publication after Scholar's duplicate versions collapse. The
  // dedupe has to run over a whole publication, not one page, or a paper
  // duplicated across two pages is counted twice.
  const groups = lib.groupReports(SUPPORT_DIR, PDF_DIR);
  const before = { rows: 0, papers: 0 };
  const after = { rows: 0, papers: 0 };
  const affectedPages = new Set();
  for (const g of groups.values()) {
    const all = g.pages.flatMap((p) => p.entries);
    const a = all.map((e) => ({ ...e, language_flag: e.language_flag || "" }));
    const b = all.map((e) => ({ ...e, language_flag: languageFlag(e) }));
    before.rows += a.filter((e) => lib.isHighlighted(e)).length;
    after.rows += b.filter((e) => lib.isHighlighted(e)).length;
    before.papers += lib.uniquePapers(a).kept.filter((e) => lib.isHighlighted(e)).length;
    after.papers += lib.uniquePapers(b).kept.filter((e) => lib.isHighlighted(e)).length;
    // A page must be re-printed when the marks on its own rows differ.
    for (let i = 0, n = g.pages.length; i < n; i++) {
      const p = g.pages[i];
      const offset = g.pages.slice(0, i).reduce((s, q) => s + q.entries.length, 0);
      const same = p.entries.every(
        (_, j) => lib.isHighlighted(a[offset + j]) === lib.isHighlighted(b[offset + j])
      );
      if (!same) affectedPages.add(p.base);
    }
  }

  const flips = changes.filter((c) => c.flips);
  console.log(`Reports scanned : ${reports.length}`);
  console.log(`Entries re-flagged : ${changes.length} (${flips.length} change a mark)`);
  for (const c of flips) {
    console.log(
      `  ${c.nowMarked ? "ADD  " : "DROP "} ${c.cid}  ${c.base}` +
        `\n         "${c.title}"` +
        `\n         flag: ${c.from ? `"${c.from}"` : "(none)"} -> ${c.to ? `"${c.to}"` : "(none)"}` +
        `   [${c.status}/${c.confirm_state || "-"}]`
    );
  }
  console.log("");
  console.log("Filed totals under the new rule (vs as filed):");
  console.log(`  marked rows            ${before.rows} -> ${after.rows}`);
  console.log(`  distinct indep papers  ${before.papers} -> ${after.papers}`);
  console.log(`  exhibit pages to re-print: ${affectedPages.size}`);
  for (const b of [...affectedPages].sort()) console.log(`    ${b}`);

  if (!write) {
    console.log("\nDRY RUN - nothing written. Re-run with --write to apply.");
    return;
  }
  if (!touched.size) {
    console.log("\nNothing to write.");
    return;
  }
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  for (const [full, data] of touched) {
    const name = path.basename(full);
    const backup = path.join(BACKUP_DIR, name);
    if (!fs.existsSync(backup)) fs.copyFileSync(full, backup);
    fs.writeFileSync(full, JSON.stringify(data, null, 2), "utf8");
  }
  console.log(`\nWrote ${touched.size} report file(s). Originals backed up to:`);
  console.log(`  ${path.relative(ROOT, BACKUP_DIR)}`);
}

main();

// Re-apply the corroboration rules to reports that were captured earlier.
//
// Companion to tools/reapply-language.js, which does the same for the language
// flag. Both exist for the same reason: confirm_state, status and the language
// flag are written ONCE, at capture, into the report JSON, and the report JSON
// is the source of truth for the ledger, the catalog, the audit and the review
// sheets. A fix to the matching logic therefore reaches nothing already filed
// until it is re-applied here.
//
// The rule itself lives in tools/corroboration.js, shared with the live capture,
// so the two can never disagree about what an external record means:
//
//   R1  a title match must be credible. The old similarity divided shared words
//       by the SHORTER title, so a Scholar title with almost no Latin words
//       scored 1.00 against anything containing that word. 29 filed records were
//       "confirmed" against papers they are not. Discarding one is not a policy
//       change; it removes evidence that was never valid, and the row falls back
//       to whatever Scholar's own list supports.
//   R2  a credible complete external list settles a truncated Scholar byline
//       (user decision 2026-11-02), unless the row is flagged non-English.
//
// What is written per affected entry: status, confirm_state, corroboration,
// corroboration_note, external_similarity, external_match_credible,
// matched_authors/pi/former_pi, and the author list when it had been overwritten
// by a record that turned out not to be the same paper. status_captured and
// confirm_state_captured keep the original values once, and attention_reason /
// needs_attention are re-derived for the rows that moved by the capture's own
// flagAttention().
//
// Nothing else is touched: not the title, not the byline as Scholar showed it
// (the `authors` field), not the link, not the language flag.
//
// Dry run by default; --write is required, and every file written is first
// copied to Exhibits/Supporting/Pre-corroboration-reapply-<date>/.
//
//   node tools/reapply-corroboration.js               show what would change
//   node tools/reapply-corroboration.js --write       apply it
//   node tools/reapply-corroboration.js --all         include archived reports

const fs = require("fs");
const os = require("os");
const path = require("path");
const tally = require("./tally");
const { applyExternalVerdict } = require("./corroboration.js");
const { toKeys } = require("./name-match.js");
const { flagAttention } = require("./capture-citations.js");

const ROOT = path.resolve(__dirname, "..");
const EXHIBITS = path.join(ROOT, "Independent Citation Record", "Exhibits");
const SUPPORT_DIR = path.join(EXHIBITS, "Supporting");
const PDF_DIR = path.join(EXHIBITS, "PDFs");
const ARCHIVE_DIR = path.join(EXHIBITS, "Archive");

const write = process.argv.includes("--write");
const includeAll = process.argv.includes("--all");
const TODAY = new Date().toISOString().slice(0, 10);
const BACKUP_DIR = path.join(SUPPORT_DIR, `Pre-corroboration-reapply-${TODAY}`);

// Used only if a report predates the keys being stored on it. Both match the
// capture's own defaults.
const PI_DEFAULT = "RD Cummings";
const FORMER_PI_DEFAULT = "UR Desai";

function targetReports() {
  const dirs = includeAll ? [SUPPORT_DIR, ARCHIVE_DIR] : [SUPPORT_DIR];
  const filed = tally.filedBases(PDF_DIR);
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

function sum(groups) {
  let rows = 0;
  let papers = 0;
  for (const g of groups.values()) {
    rows += g.entries.filter((e) => tally.isHighlighted(e)).length;
    papers += tally
      .uniquePapers(g.entries)
      .kept.filter((e) => tally.isHighlighted(e)).length;
  }
  return { rows, papers };
}

// Figures as they would be if `touched` were written. tally.groupReports() reads
// a directory and resolves language editions during its own page walk, so
// neither is reimplemented here: the changed reports are staged into a scratch
// directory over a copy of the untouched ones and the real walk runs there. The
// exhibits are not modified and the scratch directory is removed afterwards.
// This is what lets the dry run state the numbers the ledger will report after
// --write, rather than an approximation of the rule.
function figuresWith(touched) {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "eb1a-corrob-"));
  try {
    for (const f of fs.readdirSync(SUPPORT_DIR)) {
      if (!f.endsWith(".report.json")) continue;
      const src = path.join(SUPPORT_DIR, f);
      if (touched.has(src)) continue;
      fs.copyFileSync(src, path.join(scratch, f));
    }
    for (const [full, data] of touched) {
      fs.writeFileSync(
        path.join(scratch, path.basename(full)),
        `${JSON.stringify(data, null, 2)}\n`,
      );
    }
    return sum(tally.groupReports(scratch, PDF_DIR));
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
}

function main() {
  const reports = targetReports();
  if (!reports.length) {
    console.error("No filed reports found.");
    process.exitCode = 1;
    return;
  }

  const flips = [];
  const touched = new Map();
  // Each transition tallied by name, so a headline like "98 entries changed" can
  // be read as a rule summary here rather than reconstructed from 98 lines.
  const transitions = new Map();
  let noKeys = 0;

  for (const r of reports) {
    const data = JSON.parse(fs.readFileSync(r.full, "utf8"));
    const authorKeys = toKeys(data.cited_authors || "").keys;
    if (!authorKeys.length) {
      noKeys += 1;
      console.warn(
        `WARNING: ${r.name} stores no cited-paper author keys, so overlap cannot ` +
          `be re-derived. Its external rows are left exactly as they are.`,
      );
      continue;
    }
    const keys = {
      authorKeys,
      piKeys: toKeys((data.pi_keys || [PI_DEFAULT]).join(",")).keys,
      formerKeys: toKeys((data.former_keys || [FORMER_PI_DEFAULT]).join(",")).keys,
    };

    let dirty = false;
    for (const e of data.entries || []) {
      if (!e.external_source) continue;
      if (e.status_captured === undefined) e.status_captured = e.status;
      if (e.confirm_state_captured === undefined) {
        e.confirm_state_captured = e.confirm_state;
      }
      // "Was it marked" is answered by the same rule that answers "is it
      // marked", so a flip cannot be reported for a row that was never marked.
      const markedBefore = tally.isHighlighted(e);
      const res = applyExternalVerdict(e, keys);
      if (!res.changed) continue;
      // Re-derive the review reason for this row only. attention_reason is what
      // v_review buckets on and what every listing prints, so a row whose state
      // moved must not keep describing the state it had at capture.
      flagAttention([e]);
      const markedAfter = tally.isHighlighted(e);
      const step = `${e.status_captured}/${e.confirm_state_captured} -> ${e.status}/${e.confirm_state}`;
      transitions.set(step, (transitions.get(step) || 0) + 1);
      flips.push({
        base: r.name.replace(/\.report\.json$/, ""),
        page: e.page || data.page || 1,
        row: e.index,
        title: String(e.title || "").slice(0, 66),
        from: `${e.status_captured}/${e.confirm_state_captured}`,
        to: `${e.status}/${e.confirm_state}`,
        markFlip: markedBefore !== markedAfter,
        markedAfter,
        notes: res.notes,
      });
      dirty = true;
    }
    if (dirty) touched.set(r.full, data);
  }

  const before = sum(tally.groupReports(SUPPORT_DIR, PDF_DIR));
  const after = touched.size ? figuresWith(touched) : before;
  const moved = flips.filter((f) => f.markFlip);
  const delta = (a, b) => `${b - a >= 0 ? "+" : ""}${b - a}`;

  console.log(
    `Reports examined : ${reports.length}${noKeys ? ` (${noKeys} without author keys)` : ""}`,
  );
  console.log(`Entries changed  : ${flips.length}`);
  for (const [step, n] of [...transitions].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(4)}  ${step}`);
  }
  console.log(`Mark flips       : ${moved.length}`);
  for (const f of flips) {
    console.log(
      `  ${f.base} [p${f.page} row ${f.row}] ${f.from} -> ${f.to}` +
        (f.markFlip ? (f.markedAfter ? "  MARK +" : "  MARK -") : ""),
    );
    console.log(`      ${f.title}`);
    for (const n of f.notes) console.log(`        - ${n}`);
  }
  console.log(
    `\nHighlighted rows           : ${before.rows} -> ${after.rows} (${delta(before.rows, after.rows)})`,
  );
  console.log(
    `Highlighted distinct papers: ${before.papers} -> ${after.papers} (${delta(before.papers, after.papers)})`,
  );

  if (!write) {
    console.log(
      `\nDry run. ${touched.size} report file(s) would change. Re-run with --write.`,
    );
    return;
  }

  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  for (const [full, data] of touched) {
    const name = path.basename(full);
    fs.copyFileSync(full, path.join(BACKUP_DIR, name));
    fs.writeFileSync(full, `${JSON.stringify(data, null, 2)}\n`);
  }
  console.log(
    `\nWrote ${touched.size} report file(s). Originals backed up to ` +
      `${path.relative(ROOT, BACKUP_DIR)}/`,
  );
  console.log(
    "Next: tools/reprint-exhibits.js --changed --write, then build-catalog.js " +
      "--write, then build-ledger.js, then audit-highlights.js and test-pdf-fit.js.",
  );
}

main();

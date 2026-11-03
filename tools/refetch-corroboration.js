// Re-run the external look-up for rows that were recorded as having no external
// record at all, and re-decide them.
//
//   node tools/refetch-corroboration.js                    dry run, review queue
//   node tools/refetch-corroboration.js --write            apply it
//   node tools/refetch-corroboration.js --limit=20         cap the run
//   node tools/refetch-corroboration.js --widen=marker     every marker row, any status
//   node tools/refetch-corroboration.js --widen=unindexed  every row with no record
//   node tools/refetch-corroboration.js --repair-names     queued rows whose stored
//         external author string was torn by the old "Surname, Given" join
//
// SCOPE: THE REVIEW QUEUE, AND ONLY THE REVIEW QUEUE
//
// Per the user's instruction on 2026-11-03, a re-look-up targets the entries
// awaiting review and nothing else. That is the right set on the merits, not
// merely a smaller one: a queued row is undecided, so new evidence can only
// resolve it, while a row already counted independent is settled evidence whose
// classification a fresh query might silently change.
//
// Measured over the filed reports on 2026-11-03, before the scope was narrowed:
//
//   the review queue, no external record ....  65 rows   (0 currently counted)
//   old default -- marker rows, any status ...  58 rows   (34 currently counted)
//   old --all-unindexed .....................  802 rows  (376 currently counted)
//
// So the old default spent most of its requests on rows that were already// settled, and about two thirds of the ones it touched were highlighted. It did
// exactly what a scope like that must: an early run moved the packet total from
// 1047 to 1049 independent. A sweep that can move a filed figure is not a
// cleanup, and it cannot be reviewed row by row afterwards.
//
// Widening is still possible, deliberately, because the marker bug did affect
// counted rows and a claim of "no external record" on one of them is a finding
// worth correcting. Both --widen modes print a warning naming how many counted
// rows are in scope and require the same --write to apply. Use them knowingly;
// the default is the queue.
//
// WHY THIS EXISTS
//
// tools/reapply-corroboration.js re-decides rows from the external record
// already stored on them. It cannot help the largest group of unresolved rows,
// because they have no stored record to re-decide: at capture the look-up found
// nothing, so `external_source` is empty and the row was filed as "not indexed
// in PubMed or OpenAlex".
//
// For a large part of that group the premise was false. Scholar prefixes a
// record whose title it could not parse with a bracketed link type --
// [CITATION], [BOOK], [TXT] -- and that marker reached the search string as the
// word "citation", so the query could never match. The marker is now removed
// before searching (tools/scholar-marker.js), which is what makes a re-look-up
// worth doing. Measured 2026-11-02 on three queued rows: with the marker each
// returned no record; without it each returned its published article at
// similarity 1.00.
//
// WHAT IT DOES NOT DO
//
// It never re-fetches a row that already has an external record -- that evidence
// stands, and re-querying could replace a good match with a worse one. It never
// touches a row a person settled (confirm_state 'user-decided'): a human reading
// of the published article outranks a database hit. It never re-fetches a row
// from a --no-crosscheck run (confirm_state 'skipped'). And by default it never
// touches a row outside the review queue.
//
// The state transition is NOT implemented here. crosscheck.corroborate() finds
// the record and corroboration.applyExternalVerdict() decides the row, the same
// two calls a live capture makes, so this tool cannot drift from the capture or
// from the offline re-apply.
//
// The title, the byline as Scholar printed it, the link and the language flag
// are never modified. The exhibit HTML and PDF are not touched -- a row that
// starts counting is re-printed afterwards by tools/reprint-exhibits.js.
//
// Google Scholar is NOT contacted. Only PubMed and OpenAlex, sequentially and
// paced, one request pair per row. Credentials come from the git-ignored .env
// (tools/env.js); an OpenAlex key is effectively required, since the anonymous
// pool throttles a sweep into a twelve-hour wait.
//
// Dry run by default. --write copies every file it changes to
// Exhibits/Supporting/Pre-refetch-<date>/ first.

const fs = require("fs");
const os = require("os");
const path = require("path");
const tally = require("./tally");
const crosscheck = require("./crosscheck");
const { applyExternalVerdict, scholarByline } = require("./corroboration.js");
const { toKeys } = require("./name-match.js");
const { flagAttention } = require("./capture-citations.js");
const { hasScholarMarker } = require("./scholar-marker");
const { tornAuthors } = require("./crosscheck");
const pace = require("./human");

const ROOT = path.resolve(__dirname, "..");
const EXHIBITS = path.join(ROOT, "Independent Citation Record", "Exhibits");
const SUPPORT_DIR = path.join(EXHIBITS, "Supporting");
const PDF_DIR = path.join(EXHIBITS, "PDFs");

const write = process.argv.includes("--write");
const repairNames = process.argv.includes("--repair-names");
const includeAll = process.argv.includes("--all");
const TODAY = new Date().toISOString().slice(0, 10);
const BACKUP_DIR = path.join(SUPPORT_DIR, `Pre-refetch-${TODAY}`);

function arg(name, dflt = "") {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : dflt;
}
const ONLY_STATUS = arg("status");
const LIMIT = Number(arg("limit", "0")) || 0;

// How far beyond the review queue to reach. Empty -- the normal case -- means
// the queue and nothing else. See the SCOPE note at the top of this file.
//   marker    every row with no external record whose title carries a Scholar
//             link-type marker, regardless of status (the pre-2026-11-03 default)
//   unindexed every row with no external record at all
const WIDEN = arg("widen");
// --all-unindexed is the old spelling of --widen=unindexed. Kept working, since
// it appears in run logs, rather than silently doing nothing.
const widen = WIDEN || (process.argv.includes("--all-unindexed") ? "unindexed" : "");
if (WIDEN && !["marker", "unindexed"].includes(WIDEN)) {
  console.error(`Unknown --widen=${WIDEN}. Use marker or unindexed, or omit it.`);
  process.exit(2);
}

// A row is worth looking up again when nothing external was ever found for it,
// nothing human settled it, and it is on the review queue. Rows captured before
// corroboration ran at all (confirm_state 'skipped') are left alone: they are
// working copies, not evidence.
function refetchable(e) {
  if (e.confirm_state === "user-decided") return false;
  if (e.confirm_state === "skipped") return false;
  if (ONLY_STATUS && e.status !== ONLY_STATUS) return false;

  // The queue is the scope. tally.isReviewQueue is the single definition -- the
  // same one the review sheet, the dashboard and the ledger use -- so this tool
  // cannot re-ask about a row the packet has already stopped treating as work.
  // Note that excludes non-English rows: with no translations being obtained,
  // no external record changes what the packet does with them.
  if (!widen && !tally.isReviewQueue(e)) return false;

  // --repair-names targets the opposite set: rows that DO have a record, but
  // one whose stored author string was torn by the old "Surname, Given" join
  // (crosscheck.toDisplayName). Their verdict was computed from fragments, so
  // the record is re-read from the service rather than re-interpreted locally.
  // Still queue-scoped by default, for the same reason as above -- repairing a
  // torn byline on a counted row can demote it.
  if (repairNames) {
    if (!e.external_source) return false;
    return tornAuthors(e.external_authors).length > 0;
  }

  if (e.external_source) return false;
  // Widened to the marker set only: the bug this tool exists to undo.
  if (widen === "marker" && !hasScholarMarker(e.title)) return false;
  return true;
}

const ARCHIVE_DIR = path.join(EXHIBITS, "Archive");

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
  let review = 0;
  for (const g of groups.values()) {
    rows += g.entries.filter((e) => tally.isHighlighted(e)).length;
    papers += tally.uniquePapers(g.entries).kept.filter((e) => tally.isHighlighted(e)).length;
    review += g.entries.filter((e) => e.status === "REVIEW").length;
  }
  return { rows, papers, review };
}

// Figures as they would be if `touched` were written. Staged into a scratch
// directory over copies of the untouched reports and measured with the real
// tally.groupReports() walk, so a dry run states the numbers the ledger will
// report rather than an approximation. Same technique as reapply-corroboration.
function figuresWith(touched) {
  const scratch = fs.mkdtempSync(path.join(os.tmpdir(), "eb1a-refetch-"));
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
        `${JSON.stringify(data, null, 2)}\n`
      );
    }
    return sum(tally.groupReports(scratch, PDF_DIR));
  } finally {
    fs.rmSync(scratch, { recursive: true, force: true });
  }
}

async function main() {
  crosscheck.configure();
  console.log(`[refetch] credentials: ${crosscheck.credentialSummary()}`);
  if (!crosscheck.credentialSummary().includes("OpenAlex")) {
    console.warn(
      "WARNING: no OpenAlex key. The anonymous pool throttles a sweep of this " +
        "size into a multi-hour wait (measured Retry-After 44969s on 2026-11-03) " +
        "and every OpenAlex look-up will come back as an incomplete look-up, "
    );
    console.warn(
      "         which is NOT a finding that the paper is unindexed. Put " +
        "OPENALEX_API_KEY in .env (git-ignored) and re-run."
    );
  }
  if (widen) {
    // Widening reaches rows the packet already settled, so it is announced with
    // the number of counted rows in scope rather than as a quiet flag. A sweep
    // that can move a filed figure should look like one while it is running.
    console.warn(
      `WARNING: --widen=${widen} reaches BEYOND the review queue. Rows already ` +
        "classified INDEPENDENT are in scope and a fresh look-up can change them, "
    );
    console.warn(
      "         including the highlighted marks on a filed exhibit. The default " +
        "scope is the queue; see the SCOPE note at the top of this file."
    );
  }
  const reports = targetReports();
  if (!reports.length) {
    console.error("No filed reports found.");
    process.exitCode = 1;
    return;
  }

  // OpenAlex bills per request and a key's free plan carries a 1 dollar/day
  // budget, so a sweep spends something real: our title look-up is a SEARCH at
  // 10 credits, measured 2026-11-03. Count the rows before asking anything, and
  // say what the run will cost against what is left. A sweep that dies halfway
  // because the budget ran out is worse than one that never started -- the rows
  // it reached are decided and the rest are not, and only the log says which.
  let planned = 0;
  if (!LIMIT) {
    for (const r of reports) {
      try {
        const d = JSON.parse(fs.readFileSync(r.full, "utf8"));
        planned += (d.entries || []).filter(refetchable).length;
      } catch {
        /* an unreadable report is reported by the main loop */
      }
    }
  }
  const purse = await crosscheck.budget();
  if (purse) {
    // One search per row, and only rows that miss PubMed reach OpenAlex, so this
    // is the ceiling rather than a guess.
    const est = planned * purse.search_usd;
    console.log(
      `[refetch] OpenAlex budget: $${purse.remaining_usd.toFixed(4)} of ` +
        `$${purse.daily_usd.toFixed(2)} left today (resets ${purse.resets_at}). ` +
        `Up to ${planned} search${planned === 1 ? "" : "es"} at ` +
        `$${purse.search_usd} each = about $${est.toFixed(4)}.`
    );
    if (!LIMIT && est > purse.remaining_usd) {
      console.error(
        `ABORTING: this run needs about $${est.toFixed(4)} and only ` +
          `$${purse.remaining_usd.toFixed(4)} is left on today's budget. A sweep ` +
          "that stops mid-way decides some rows and not others, with only the log " +
          "to say which. Wait for the reset, use --limit= to fit, or top up the " +
          "prepaid balance."
      );
      process.exitCode = 1;
      return;
    }
  } else if (!repairNames) {
    console.log(
      "[refetch] OpenAlex budget unknown (no key). A search costs credits and the " +
        "anonymous pool will throttle this run anyway."
    );
  }

  const flips = [];
  const touched = new Map();
  const transitions = new Map();
  const found = [];
  const missed = [];
  const failed = [];
  const lost = [];
  let candidates = 0;
  let noKeys = 0;

  for (const r of reports) {
    const data = JSON.parse(fs.readFileSync(r.full, "utf8"));
    const todo = (data.entries || []).filter(refetchable);
    if (!todo.length) continue;

    const authorKeys = toKeys(data.cited_authors || "").keys;
    if (!authorKeys.length) {
      noKeys += 1;
      console.warn(
        `WARNING: ${r.name} stores no cited-paper author keys, so overlap cannot ` +
          `be derived. Skipping its rows rather than guessing.`
      );
      continue;
    }
    const keys = {
      authorKeys,
      piKeys: toKeys((data.pi_keys || ["RD Cummings"]).join(",")).keys,
      formerKeys: toKeys((data.former_keys || ["UR Desai"]).join(",")).keys,
    };

    let dirty = false;
    for (const e of todo) {
      if (LIMIT && candidates >= LIMIT) break;
      candidates += 1;

      const before = { status: e.status, confirm_state: e.confirm_state };
      const markedBefore = tally.isHighlighted(e);

      // The look-up itself, then the shared decision rule. Both are the
      // capture's, so the outcome is identical to re-capturing this row.
      const ext = await crosscheck.corroborate(e);
      if (!ext.found) {
        // Two different nothings. An incomplete look-up proves nothing about the
        // paper, and recording it as "still unindexed" would be a false finding
        // -- see crosscheck.corroborate(). Such a row is left exactly as it is
        // and the run exits non-zero so a throttled sweep cannot be mistaken
        // for a completed one.
        if (ext.unknown) {
          failed.push({
            base: r.name.replace(/\.report\.json$/, ""),
            page: e.page || data.page || 1,
            row: e.index,
            title: String(e.title || "").slice(0, 70),
            reason: ext.reason || "",
          });
          continue;
        }
        if (repairNames) {
          // The row already carries a record. Not re-finding it says nothing
          // about the paper and must not erase the evidence it has, so the row
          // is left exactly as it is and reported.
          lost.push({
            base: r.name.replace(/\.report\.json$/, ""),
            page: e.page || data.page || 1,
            row: e.index,
            title: String(e.title || "").slice(0, 70),
            had: String(e.external_source || ""),
          });
          continue;
        }
        missed.push({
          base: r.name.replace(/\.report\.json$/, ""),
          page: e.page || data.page || 1,
          row: e.index,
          title: String(e.title || "").slice(0, 70),
          reason: ext.reason || "",
        });
        continue;
      }

      if (e.status_captured === undefined) e.status_captured = e.status;
      if (e.confirm_state_captured === undefined) {
        e.confirm_state_captured = e.confirm_state;
      }
      if (repairNames) {
        // A previous pass may have copied the torn list onto the row as its
        // byline. Clear back to Scholar's own reading first, using the same
        // helper corroboration.js uses to restore a row whose list was
        // overwritten, so the re-decision starts from the page and the fresh
        // record rather than from a byline assembled out of fragments.
        Object.assign(e, scholarByline(e));
        e.external_matched = [];
      }
      e.external_source = ext.source;
      e.external_url = ext.url;
      e.external_title = ext.title;
      e.external_authors = ext.authors.join(", ");
      e.external_similarity = ext.similarity;

      const res = applyExternalVerdict(e, keys);
      flagAttention([e]);

      found.push({
        base: r.name.replace(/\.report\.json$/, ""),
        page: e.page || data.page || 1,
        row: e.index,
        title: String(e.title || "").slice(0, 70),
        source: ext.source,
        url: ext.url,
        extTitle: String(ext.title || "").slice(0, 90),
        sim: ext.similarity,
        from: `${before.status}/${before.confirm_state || "-"}`,
        to: `${e.status}/${e.confirm_state || "-"}`,
      });

      if (before.status !== e.status || before.confirm_state !== e.confirm_state) {
        const step = `${before.status}/${before.confirm_state || "-"} -> ${e.status}/${e.confirm_state || "-"}`;
        transitions.set(step, (transitions.get(step) || 0) + 1);
        flips.push({
          base: r.name.replace(/\.report\.json$/, ""),
          page: e.page || data.page || 1,
          row: e.index,
          title: String(e.title || "").slice(0, 70),
          from: `${before.status}/${before.confirm_state || "-"}`,
          to: `${e.status}/${e.confirm_state || "-"}`,
          markFlip: markedBefore !== tally.isHighlighted(e),
          markedAfter: tally.isHighlighted(e),
          notes: res.notes,
        });
        dirty = true;
      }
      await pace.pause("next row", 700, 1500);
    }
    if (dirty) touched.set(r.full, data);
    if (LIMIT && candidates >= LIMIT) break;
  }

  const before = sum(tally.groupReports(SUPPORT_DIR, PDF_DIR));
  const after = touched.size ? figuresWith(touched) : before;
  const delta = (a, b) => `${b - a >= 0 ? "+" : ""}${b - a}`;

  console.log(
    `\nRows re-looked-up : ${candidates}` +
      (widen === "unindexed"
        ? "  [WIDENED: every row with no external record]"
        : widen === "marker"
          ? "  [WIDENED: every marker row, any status]"
          : "  (the review queue only)") +
      (ONLY_STATUS ? `  [status=${ONLY_STATUS}]` : "") +
      (LIMIT ? `  [limit=${LIMIT}]` : "")
  );
  console.log(`  record found    : ${found.length}`);
  console.log(`  still unindexed : ${missed.length}`);
  console.log(`  look-up FAILED  : ${failed.length}`);
  if (repairNames) console.log(`  not re-found    : ${lost.length}  (row left untouched)`);
  if (noKeys) console.log(`  reports skipped for no cited-author keys: ${noKeys}`);

  console.log(`\n--- records found (PubMed / OpenAlex, the sanctioned services) ---`);
  for (const f of found) {
    console.log(
      `  ${f.base} [p${f.page} row ${f.row}] ${f.from} -> ${f.to}`
    );
    console.log(`      ${f.title}`);
    console.log(`      ${f.source} sim=${f.sim}  ${f.extTitle}`);
    console.log(`      ${f.url}`);
  }

  console.log(`\n--- state transitions ---`);
  if (!transitions.size) console.log("  (none)");
  for (const [step, n] of [...transitions].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${String(n).padStart(4)}  ${step}`);
  }

  console.log(`\n--- still unindexed after the re-look-up ---`);
  for (const m of missed) {
    console.log(`  ${m.base} [p${m.page} row ${m.row}] ${m.title}`);
  }

  if (failed.length) {
    console.log(`\n--- look-up did not complete (NOT a finding) ---`);
    for (const m of failed) {
      console.log(`  ${m.base} [p${m.page} row ${m.row}] ${m.title}`);
      console.log(`      ${m.reason}`);
    }
  }

  if (lost.length) {
    console.log(`\n--- stored record not re-found (row left as filed) ---`);
    for (const m of lost) {
      console.log(`  ${m.base} [p${m.page} row ${m.row}] (${m.had}) ${m.title}`);
    }
  }

  console.log(
    `\nHighlighted rows           : ${before.rows} -> ${after.rows} (${delta(before.rows, after.rows)})`
  );
  console.log(
    `Highlighted distinct papers: ${before.papers} -> ${after.papers} (${delta(before.papers, after.papers)})`
  );
  console.log(
    `Awaiting review            : ${before.review} -> ${after.review} (${delta(before.review, after.review)})`
  );

  if (!write) {
    console.log(
      `\nDry run. ${touched.size} report file(s) would change. Re-run with --write.`
    );
    if (failed.length) {
      console.error(
        `\nINCOMPLETE: ${failed.length} row(s) could not be looked up. The look-up ` +
          `is rate-limited or down; wait and re-run rather than acting on these numbers.`,
      );
      process.exitCode = 1;
    }
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
      `${path.relative(ROOT, BACKUP_DIR)}/`
  );
  console.log(
    "Next: tools/reprint-exhibits.js --changed --write, then audit-highlights.js, " +
      "then build-catalog.js --write, then build-ledger.js, then " +
      "build-review-sheet.js --md and build-dashboard-data.js."
  );

  if (failed.length) {
    // The writes above are valid -- every one rests on a record that was really
    // retrieved. But the sweep is unfinished, and a partial sweep reported as a
    // clean one is how rows get quietly left behind.
    console.error(
      `\nINCOMPLETE: ${failed.length} row(s) could not be looked up. Re-run to ` +
        `pick them up. The figures above do not include them.`,
    );
    process.exitCode = 1;
  }
}

main().catch((e) => {
  console.error(`[refetch] ${e.stack || e.message}`);
  process.exitCode = 1;
});

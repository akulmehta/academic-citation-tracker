// Runs capture-citations.js across a batch of publications, sequentially.
//
// Usage:
//   node run-batch.js --list="<publications-list.json>" [selection] [options]
//
// Selection (all optional, combined with AND):
//   --min-citations=N     lowest citedBy to include (default 1)
//   --max-citations=N     highest citedBy to include (default 20)
//   --count=N             stop after N publications (default 5)
//   --pick="text;text"    only titles containing one of these substrings
//   --skip-done           skip publications whose exhibits are still filed
//   --all                 ignore min/max and take everything with citations
//   --smallest            take the fewest-citation publications first
//
// --smallest matters because the publication list is in Scholar's profile order,
// which is descending by citations, and --count truncates from the front. So
// --all --count=3 selects the THREE LARGEST publications, which is the opposite
// of what a session that wants to avoid the 248-citation GlyGen list needs.
// Combine --smallest with --count to work up from the bottom instead.
//
// Options:
//   --auto                save each page without waiting for ENTER
//   --dry-run             print the selection and commands, contact nothing
//   --email= / --ncbi-key=   passed through to the capture
//   --debug               working-copy annotations
//
// Behaviour:
//   - One publication at a time, never in parallel, with a randomized gap
//     between publications so Scholar is not probed in bursts.
//   - If a publication exits with code 2 (access wall), the whole batch stops
//     immediately and says where it stopped. It does not retry.
//   - Progress is appended to Exhibits/Supporting/batch-runs.json after every
//     publication, so an interrupted batch can be resumed with --skip-done.
//   - Nothing here contacts Scholar directly; it only drives the capture script.

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const pace = require("./human");
const lib = require("./tally");

const ROOT = path.resolve(__dirname, "..");
const EXHIBITS = path.join(ROOT, "Independent Citation Record", "Exhibits");
const SUPPORT_DIR = path.join(EXHIBITS, "Supporting");
const RUN_LOG = path.join(SUPPORT_DIR, "batch-runs.json");
const CAPTURE = path.join(__dirname, "capture-citations.js");
const CATALOG = path.join(__dirname, "build-catalog.js");

function arg(name, fallback = "") {
  const hit = process.argv
    .slice(2)
    .find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}

// Same rule as capture-citations.js: --out=NAME files PDFs under
// Exhibits/PDFs/NAME. The tally below has to look where the capture writes.
const OUT = arg("out").replace(/[\\/:*?"<>|]/g, "");
const PDF_DIR = OUT ? path.join(EXHIBITS, "PDFs", OUT) : path.join(EXHIBITS, "PDFs");
const has = (name) => process.argv.includes(`--${name}`);

function log(msg) {
  console.log(`[batch] ${msg}`);
}

function slug(title) {
  return (
    String(title || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) || "publication"
  );
}

// Scholar shows no result count on a citing-articles page, so the captured
// totals are compared against the publication list's citedBy afterwards.
// The independent figure comes from tally.js, not a local rule: an entry the
// ledger will not count (non-English awaiting a certified translation, or an
// unsettled author list) must not be reported as a win here either, or the
// batch line and the ledger disagree about the same PDF.
function tallyFor(base) {
  let pdfs = 0;
  let entries = 0;
  let independent = 0;
  let pending = 0;
  let nonEnglish = 0;
  try {
    pdfs = fs.readdirSync(PDF_DIR).filter((f) => f.startsWith(base) && f.endsWith(".pdf")).length;
  } catch {
    return { pdfs: 0, entries: 0, independent: 0, pending: 0, nonEnglish: 0 };
  }
  try {
    for (const f of fs.readdirSync(SUPPORT_DIR)) {
      if (!f.startsWith(base) || !f.endsWith(".report.json")) continue;
      // Only whole-page reports for this base, not a longer name sharing it.
      const stem = f.replace(/\.report\.json$/, "");
      if (stem !== base && !new RegExp(`^${base}-p\\d+$`).test(stem)) continue;
      const data = JSON.parse(fs.readFileSync(path.join(SUPPORT_DIR, f), "utf8"));
      const t = lib.tallyEntries(data.entries || []);
      entries += t.records;
      independent += t.independent;
      pending += t.independent_pending;
      // Reported apart from `pending` since 2026-11-03: a non-English row is a
      // closed exclusion, not an unsettled author list.
      nonEnglish += t.non_english_independent;
    }
  } catch {
    /* partial capture, report what was read */
  }
  return { pdfs, entries, independent, pending, nonEnglish };
}

function readRunLog() {
  try {
    const data = JSON.parse(fs.readFileSync(RUN_LOG, "utf8"));
    return Array.isArray(data.captures) ? data : { captures: [] };
  } catch {
    return { captures: [] };
  }
}

function writeRunLog(data) {
  fs.mkdirSync(SUPPORT_DIR, { recursive: true });
  fs.writeFileSync(RUN_LOG, JSON.stringify(data, null, 2), "utf8");
}

// Keep the lookup catalog in step with each capture.
//
// The catalog (tools/build-catalog.js -> citation-catalog.sqlite) is a LOOKUP
// AID only. The ledger CSV from build-ledger.js stays the authoritative record,
// so a failure here is reported and the batch continues -- it must never look
// like the capture itself failed, and it must never edit evidence.
//
// A blocked attempt cannot corrupt the database: the upsert keys off the report
// files for this base, and a run stopped at a verification wall wrote none, so
// it declines to write anything and leaves the previous publication intact.
function updateCatalog(base) {
  const res = spawnSync(process.execPath, [CATALOG, `--pub=${base}`], {
    encoding: "utf8",
    timeout: 60 * 1000,
  });
  const out = `${res.stdout || ""}${res.stderr || ""}`.trim();
  for (const line of out.split(/\r?\n/)) {
    if (line.trim()) log(`  ${line.trim()}`);
  }
  if (res.error) {
    log(`  catalog update did not run (${res.error.message}); the ledger is unaffected`);
    return;
  }
  if (res.status !== 0) {
    log(
      `  catalog update exited ${res.status}. The capture and the ledger are unaffected; ` +
        `rebuild with: node tools/build-catalog.js`
    );
  }
}

// A publication counts as done when a capture was recorded for its cites id.
function citesId(url) {
  const m = String(url || "").match(/cites=(\d+)/);
  return m ? m[1] : "";
}

// What --skip-done means, precisely. A publication is finished only when both
// hold:
//   1. its exhibit PDFs are still filed -- groupReports() drops a publication
//      whose PDFs were archived, so superseding a capture puts it back in the
//      selection automatically; and
//   2. the latest capture attempt recorded for it was clean and complete, which
//      catches a run interrupted after saving page 1 of several -- the PDF for
//      page 1 is filed, but the publication is not finished.
// A publication filed by a direct capture-citations.js run has no log entry at
// all and is treated as finished on condition 1 alone.
function unfinishedIds(runLog) {
  const latest = new Map();
  for (const c of runLog.captures) {
    if (c.cites_id) latest.set(c.cites_id, c);
  }
  return new Set(
    [...latest.entries()]
      .filter(([, c]) => !(c.ok && c.complete))
      .map(([id]) => id)
  );
}

// What --skip-done means, precisely: a publication is finished only while its
// exhibit PDFs are actually filed. groupReports() drops a publication whose PDFs
// have been archived, so superseding a capture automatically puts it back in the
// selection. The run log is the backstop for a capture that was interrupted
// before any report was written, and it only consults the latest attempt per
// cites id so an old success cannot outrank a newer failure.
function filedIds() {
  try {
    const groups = lib.groupReports(SUPPORT_DIR, path.join(EXHIBITS, "PDFs"));
    return new Set([...groups.values()].map((g) => g.cites_id).filter(Boolean));
  } catch (e) {
    // Filing status is unknown here, so the safe reading is that nothing is
    // finished: re-capturing an exhibit is cheap, silently skipping one is not.
    log(`Could not read filed exhibits for --skip-done (${e.message}). Treating every publication as not yet filed.`);
    return new Set();
  }
}

function select(publications) {
  const picks = arg("pick")
    .split(";")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  let list = publications.filter((p) => p.citesUrl);

  if (!has("all")) {
    const min = parseInt(arg("min-citations", "1"), 10);
    const max = parseInt(arg("max-citations", "20"), 10);
    list = list.filter((p) => Number(p.citedBy) >= min && Number(p.citedBy) <= max);
  } else {
    list = list.filter((p) => Number(p.citedBy) >= 1);
  }

  if (picks.length) {
    list = list.filter((p) =>
      picks.some((s) => String(p.title || "").toLowerCase().includes(s))
    );
  }

  if (has("skip-done")) {
    const filed = filedIds();
    const unfinished = unfinishedIds(readRunLog());
    const before = list.length;
    list = list.filter((p) => {
      const id = citesId(p.citesUrl);
      // Keep the publication unless it is finished: filed and last attempt clean.
      return !filed.has(id) || unfinished.has(id);
    });
    log(`--skip-done excluded ${before - list.length} already-captured publication(s).`);
  }

  // Profile order is descending by citation count, so without this the count
  // truncation below always keeps the biggest lists first.
  if (has("smallest")) {
    list = [...list].sort((a, b) => Number(a.citedBy) - Number(b.citedBy));
    log("--smallest: ordering by citation count ascending, fewest first.");
  }

  const count = parseInt(arg("count", "5"), 10);
  return list.slice(0, count);
}
// The newest dated publication list, which is the same rule build-ledger.js and
// build-catalog.js use so the batch, the ledger and the catalog always describe
// one Scholar snapshot. Hard-coding a date here would quietly keep selecting and
// sizing work against an old count once the profile is refetched.
function newestListPath() {
  try {
    const dated = fs
      .readdirSync(SUPPORT_DIR)
      .filter((f) => /^publications-list-\d{4}-\d{2}-\d{2}\.json$/.test(f))
      .sort();
    if (dated.length) return path.join(SUPPORT_DIR, dated[dated.length - 1]);
  } catch {
    /* fall through to the dated default below */
  }
  return path.join(SUPPORT_DIR, "publications-list-2026-10-29.json");
}

async function main() {
  const listPath = path.resolve(arg("list", newestListPath()));
  if (!fs.existsSync(listPath)) {
    log(`Publication list not found: ${listPath}`);
    process.exitCode = 1;
    return;
  }
  const all = JSON.parse(fs.readFileSync(listPath, "utf8"));
  log(
    `Publication snapshot: ${all.snapshot_date || "unknown"} ` +
      `(${path.basename(listPath)})`
  );
  const batch = select(all.publications || []);

  if (!batch.length) {
    log("No publications match the selection. Nothing to do.");
    // The default --min/--max-citations band is the small-citation test range,
    // and the publications still to capture are all above it. Without this the
    // empty result reads as "everything is done" and a session is wasted.
    // Count only publications that are genuinely outstanding, so the number
    // agrees with the ledger's remaining count rather than the whole profile.
    const filed = filedIds();
    const unfinished = unfinishedIds(readRunLog());
    const above = (all.publications || []).filter((p) => {
      if (!p.citesUrl || Number(p.citedBy) <= parseInt(arg("max-citations", "20"), 10)) {
        return false;
      }
      const id = citesId(p.citesUrl);
      return !filed.has(id) || unfinished.has(id);
    }).length;
    if (!has("all") && above) {
      log(
        `  ${above} not-yet-captured publication(s) sit above the ` +
          `--max-citations band (default ${parseInt(arg("max-citations", "20"), 10)}). ` +
          `Add --all, or raise --max-citations, to include them.`
      );
    }
    return;
  }

  log(`Batch of ${batch.length} publication(s) from ${path.basename(listPath)}`);
  batch.forEach((p, i) =>
    log(`  ${i + 1}. [${p.citedBy}] ${String(p.title).slice(0, 70)}`)
  );

  // Scholar shows ten citing articles per page and cannot be told otherwise, so
  // this is the exhibit count to expect. The capture follows Scholar's own
  // "Next" link rather than assuming an offset, so this figure is an estimate to
  // reconcile against. The rule lives in tally.js so the batch line, the ledger
  // and the catalog can never disagree about how many pages a publication needs.
  const pagesFor = (p) => lib.expectedPages(p.citedBy);
  const plannedPages = batch.reduce((n, p) => n + pagesFor(p), 0);
  log(`Expected citation pages in this batch: ~${plannedPages}`);

  if (has("dry-run")) {
    log("");
    log("--dry-run: nothing launched, no requests made.");
    batch.forEach((p) => {
      const base = `${slug(p.title)}-citing-${new Date().toISOString().slice(0, 10)}`;
      log(`  node capture-citations.js --cites="${p.citesUrl}"`);
      log(`      --paper="${p.paperUrl}" --name="${base}"`);
      log(
        `      (${pagesFor(p)} page(s) expected, ` +
          `${p.citedBy} citations at the list snapshot)`
      );
    });
    return;
  }

  const stamp = new Date().toISOString().slice(0, 10);
  const runLog = readRunLog();
  let stopped = null;

  for (let i = 0; i < batch.length; i++) {
    const p = batch[i];
    const base = `${slug(p.title)}-citing-${stamp}`;
    log("");
    log(`(${i + 1}/${batch.length}) ${p.title}`);
    log(`  citations on snapshot: ${p.citedBy}`);

    const args = [CAPTURE, `--cites=${p.citesUrl}`, `--paper=${p.paperUrl}`, `--name=${base}`];
    const email = arg("email");
    const key = arg("ncbi-key");
    if (email) args.push(`--email=${email}`);
    if (key) args.push(`--ncbi-key=${key}`);
    if (OUT) args.push(`--out=${OUT}`);
    if (has("auto")) args.push("--auto");
    if (has("debug")) args.push("--debug");

    const res = spawnSync(process.execPath, args, {
      stdio: "inherit",
      // A hung capture used to block the whole batch forever, because the child
      // only exits once its browser is closed. Allow a generous per-page budget
      // and kill the child past it, so one bad publication costs one slot
      // instead of the session. Re-run with --skip-done to retry it.
      timeout: Math.max(10 * 60 * 1000, pagesFor(p) * 6 * 60 * 1000),
    });
    if (res.error) log(`  capture error: ${res.error.message}`);
    if (res.signal) {
      log(
        `  capture was killed after exceeding its time budget ` +
          `(${res.signal}). Treating this publication as incomplete.`
      );
    }

    const tally = tallyFor(base);
    const expectedPages = pagesFor(p);
    log(
      `  captured ${tally.pdfs} page(s) (expected ~${expectedPages}), ` +
        `${tally.entries} record(s) vs ${p.citedBy} citations at the snapshot, ` +
        `${tally.independent} independent` +
        (tally.pending
          ? ` (+${tally.pending} independent but unsettled, not counted)`
          : "") +
        (tally.nonEnglish
          ? ` (+${tally.nonEnglish} non-English, excluded by the language screen)`
          : "") +
        (tally.pdfs < expectedPages ? "  <-- INCOMPLETE, re-run this one" : "")
    );

    const record = {
      date: new Date().toISOString(),
      title: p.title,
      cited_by_at_snapshot: p.citedBy,
      cites_id: citesId(p.citesUrl),
      cites_url: p.citesUrl,
      paper_url: p.paperUrl,
      base_name: base,
      pages_captured: tally.pdfs,
      pages_expected: expectedPages,
      records_captured: tally.entries,
      independent_captured: tally.independent,
      complete: tally.pdfs >= expectedPages,
      exit_code: res.status,
      ok: res.status === 0,
      blocked: res.status === 2,
    };
    runLog.captures.push(record);
    writeRunLog(runLog);

    // Refresh the lookup catalog for this publication now that its reports and
    // run-log entry are on disk. Skipped for a blocked run, which wrote no
    // report: the upsert would decline anyway, and skipping it keeps the log
    // free of a misleading line after a wall.
    if (res.status !== 2) updateCatalog(base);

    if (res.status === 2) {
      stopped =
        "An access wall (CAPTCHA / unusual traffic) was reported. Per project " +
        "instructions the batch stopped and did not retry.";
      break;
    }
    if (res.status !== 0) {
      log(`Capture exited with code ${res.status}; continuing to the next publication.`);
    }

    if (i < batch.length - 1) {
      await gap();
    }
  }

  log("");
  log(`Recorded ${runLog.captures.length} capture attempt(s) in ${RUN_LOG}`);
  if (stopped) {
    log(`STOPPED: ${stopped}`);
    log("Clear the verification in the browser, then re-run with --skip-done.");
    process.exitCode = 2;
  } else {
    log("Batch finished.");
  }
}

// gap is defined separately so the async pause reads clearly above.
async function gap() {
  await pace.pageGap("next publication");
}

main().catch((e) => {
  console.error(`[batch] Fatal: ${e.stack || e.message}`);
  process.exitCode = 1;
});

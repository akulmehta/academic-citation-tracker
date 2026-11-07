// Runs every audit of the Independent Citation Record and reports one summary.
//
//   node tools/audit-everything.js           full run (browser audits included, several minutes)
//   node tools/audit-everything.js --quick   skip the browser-based checks
//
// Read-only. Nothing here writes to the store, the ledger, the reports, the
// dashboard data or the exhibits. Each check is run as its own process so a
// failure in one cannot leave another half-run.
//
// Deliberately NOT run here, because each writes something:
//   build-ledger.js           writes the dated ledger and appends to its history
//   build-catalog.js --write  writes the store
//   build-dashboard-data.js   writes the dashboard data
//   reprint-exhibits.js       rewrites exhibit HTML and PDF
//   test-catalog-merge.js     writes to the REAL store (see the guide)
//
// Exit code 1 if any check FAILs. WARN lines are reported but do not fail the run.

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");
const { DatabaseSync } = require("node:sqlite");
const { DB_PATH } = require("./build-catalog");

const ROOT = path.resolve(__dirname, "..");
const EXHIBITS = path.join(ROOT, "Independent Citation Record", "Exhibits");
const SUPPORT_DIR = path.join(EXHIBITS, "Supporting");
const DASHBOARD_DATA = path.join(ROOT, "dashboard", "data", "citation-data.json");

const quick = process.argv.includes("--quick");

// Read-only unit tests of the counting rules and their helpers.
const UNIT_TESTS = [
  "test-tally.js",
  "test-name-match.js",
  "test-corroboration.js",
  "test-work-type.js",
  "test-capture-helpers.js",
  "test-apply-decision.js",
  "test-pdf-header.js",
  "test-next-link.js",
];

function run(script, args = [], timeoutMs = 30 * 60 * 1000) {
  const r = spawnSync(process.execPath, [path.join(__dirname, script), ...args], {
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
    timeout: timeoutMs,
  });
  const out = `${r.stdout || ""}${r.stderr || ""}`;
  return { code: r.status, out, timedOut: Boolean(r.error && r.error.code === "ETIMEDOUT") };
}

const results = [];
function record(status, name, detail) {
  results.push({ status, name, detail });
  const tag = { ok: "ok  ", FAIL: "FAIL", WARN: "WARN", skip: "skip" }[status];
  console.log(`[${tag}] ${name}${detail ? `  -- ${detail}` : ""}`);
}

function lastLine(text) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  return lines.length ? lines[lines.length - 1].trim() : "";
}

function mtime(file) {
  return fs.existsSync(file) ? fs.statSync(file).mtime : null;
}

function newestLedgerJson() {
  const names = fs
    .readdirSync(SUPPORT_DIR)
    .filter((n) => /^citation-ledger-\d{4}-\d{2}-\d{2}\.json$/.test(n))
    .sort();
  return names.length ? path.join(SUPPORT_DIR, names[names.length - 1]) : null;
}

// Each block below records exactly one result per check so the summary can be
// read top to bottom.

console.log(`Independent Citation Record audit${quick ? " (quick: browser checks skipped)" : ""}\n`);

console.log("Unit tests");
for (const t of UNIT_TESTS) {
  const r = run(t);
  if (r.code === 0) record("ok", t);
  else record("FAIL", t, `exit ${r.code}: ${lastLine(r.out)}`);
}

console.log("\nStore against reports");
{
  const r = run("build-catalog.js");
  const m = r.out.match(/Merge plan: (\d+) insert\(s\), (\d+) update\(s\)/);
  if (r.code !== 0) record("FAIL", "catalog matches reports", `build-catalog exit ${r.code}: ${lastLine(r.out)}`);
  else if (!m) record("FAIL", "catalog matches reports", "merge plan not found in output");
  else if (m[1] !== "0" || m[2] !== "0")
    record("FAIL", "catalog matches reports", `${m[1]} insert(s), ${m[2]} update(s) pending: run build-catalog.js --write after review`);
  else record("ok", "catalog matches reports", "0 inserts, 0 updates");
}

console.log("\nLedger and dashboard");
{
  const r = run("check-ledger-vs-snapshot.js");
  if (r.code === 0) record("ok", "ledger arithmetic", "check-ledger-vs-snapshot.js");
  else record("FAIL", "ledger arithmetic", `exit ${r.code}: ${lastLine(r.out)}`);
}
{
  const r = run("check-dashboard-nav.js");
  if (r.code === 0) record("ok", "dashboard chapter numbers");
  else record("FAIL", "dashboard chapter numbers", `exit ${r.code}: ${lastLine(r.out)}`);
}
const store = mtime(DB_PATH);
const ledgerFile = newestLedgerJson();
const ledgerTime = ledgerFile ? mtime(ledgerFile) : null;
if (!ledgerFile) record("FAIL", "ledger is current", "no dated ledger JSON found");
else if (store && ledgerTime < store)
  record("FAIL", "ledger is current", `${path.basename(ledgerFile)} predates the store: run build-ledger.js`);
else record("ok", "ledger is current", path.basename(ledgerFile));
{
  const dash = mtime(DASHBOARD_DATA);
  if (!dash) record("WARN", "dashboard data is current", "no dashboard data file");
  else if (store && dash < store) record("WARN", "dashboard data is current", "older than the store: run build-dashboard-data.js");
  else record("ok", "dashboard data is current");
}

console.log("\nCorroboration re-apply");
{
  const r = run("reapply-corroboration.js");
  const total = (r.out.match(/Entries changed\s*:\s*(\d+)/) || [])[1];
  const marks = (r.out.match(/Mark flips\s*:\s*(\d+)/) || [])[1];
  const moves = [...r.out.matchAll(/^\s+(\d+)\s+(\S+) -> (\S+)\s*$/gm)]
    .filter((m) => m[2] !== m[3])
    .reduce((n, m) => n + Number(m[1]), 0);
  if (total === undefined || marks === undefined) {
    record("FAIL", "corroboration re-apply", `no summary in output: ${lastLine(r.out)}`);
  } else if (moves === 0 && marks === "0") {
    record("ok", "corroboration re-apply", `no status, confirmation or highlight changes (${total} wording-only refresh(es))`);
  } else {
    record(
      "WARN",
      "corroboration re-apply",
      `${moves} status/confirmation change(s) and ${marks} highlight change(s) pending; not written (see reapply-corroboration.js)`,
    );
  }
}

let pdfMarks = null;
if (quick) {
  console.log("\nBrowser and print checks");
  record("skip", "highlights against the rule (HTML)", "--quick");
  record("skip", "highlights as printed (PDF)", "--quick");
  record("skip", "PDF against HTML", "--quick");
  record("skip", "exhibits fit one sheet", "--quick");
} else {
  console.log("\nBrowser and print checks");
  {
    const r = run("audit-highlights.js");
    if (r.code === 0) record("ok", "highlights against the rule (HTML)");
    else record("FAIL", "highlights against the rule (HTML)", `exit ${r.code}: ${lastLine(r.out)}`);
  }
  {
    const r = run("audit-pdf-highlights.js");
    const m = r.out.match(/Yellow marks printed in the PDFs: (\d+)/);
    if (m) pdfMarks = Number(m[1]);
    if (r.code === 0) record("ok", "highlights as printed (PDF)", `${pdfMarks} marks`);
    else record("FAIL", "highlights as printed (PDF)", `exit ${r.code}: ${lastLine(r.out)}`);
  }
  {
    const r = run("audit-pdf-against-html.js");
    if (r.code === 0) record("ok", "PDF against HTML");
    else record("FAIL", "PDF against HTML", `exit ${r.code}: ${lastLine(r.out)}`);
  }
  {
    const r = run("test-pdf-fit.js", ["--all"]);
    if (r.code === 0) record("ok", "exhibits fit one sheet", "--all");
    else record("FAIL", "exhibits fit one sheet", `exit ${r.code}: ${lastLine(r.out)}`);
  }
}

console.log("\nFigures agree across sources");
{
  const db = new DatabaseSync(DB_PATH, { readOnly: true });
  let storeCounted;
  let storeHighlighted;
  let storeDependent;
  try {
    const active = "filed = 1 AND superseded_at = ''";
    storeCounted = db.prepare("SELECT COUNT(*) n FROM v_independent_counted").get().n;
    storeHighlighted = db.prepare(`SELECT COUNT(*) n FROM citations WHERE ${active} AND is_highlighted = 1`).get().n;
    storeDependent = db.prepare(`SELECT COUNT(*) n FROM citations WHERE ${active} AND status = 'DEPENDENT'`).get().n;
  } finally {
    db.close();
  }
  const ledger = ledgerFile ? JSON.parse(fs.readFileSync(ledgerFile, "utf8")) : null;
  const ledgerIndependent = ledger && ledger.global ? ledger.global.independent_countable : null;
  const ledgerDependent = ledger && ledger.global ? ledger.global.dependent : null;

  if (storeCounted !== storeHighlighted)
    record("FAIL", "store: counted = highlighted", `counted ${storeCounted}, highlighted ${storeHighlighted}`);
  else record("ok", "store: counted = highlighted", String(storeCounted));

  if (ledgerIndependent === null) record("FAIL", "ledger = store (independent)", "ledger has no global figures");
  else if (ledgerIndependent !== storeCounted)
    record("FAIL", "ledger = store (independent)", `ledger ${ledgerIndependent}, store ${storeCounted}`);
  else record("ok", "ledger = store (independent)", String(storeCounted));

  if (ledgerDependent === null) record("FAIL", "ledger = store (dependent)", "ledger has no global figures");
  else if (ledgerDependent !== storeDependent)
    record("FAIL", "ledger = store (dependent)", `ledger ${ledgerDependent}, store ${storeDependent}`);
  else record("ok", "ledger = store (dependent)", String(storeDependent));

  if (quick || pdfMarks === null) record("skip", "PDF marks = store", quick ? "--quick" : "PDF audit gave no count");
  else if (pdfMarks !== storeHighlighted)
    record("FAIL", "PDF marks = store", `PDFs print ${pdfMarks}, store highlights ${storeHighlighted}`);
  else record("ok", "PDF marks = store", String(pdfMarks));
}

const fails = results.filter((r) => r.status === "FAIL");
const warns = results.filter((r) => r.status === "WARN");
const oks = results.filter((r) => r.status === "ok");
console.log(
  `\n${oks.length} ok, ${warns.length} warning(s), ${fails.length} failed` +
    (quick ? " (browser checks skipped)" : ""),
);
if (fails.length) {
  console.log("Failed:");
  for (const f of fails) console.log(`  - ${f.name}${f.detail ? `: ${f.detail}` : ""}`);
  process.exitCode = 1;
} else {
  console.log("Everything agrees.");
}

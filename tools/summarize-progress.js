// Roll the per-page report JSON files up into per-publication totals.
//
//   node tools/summarize-progress.js            summary of every publication
//   node tools/summarize-progress.js --json     machine-readable output
//
// Reading rules, so the numbers mean what they claim:
//   - A publication is one base name; pages 2+ are stored as "<base>-pN".
//   - Only publications with a PDF currently in the exhibit folder are counted,
//     so a superseded capture whose PDF was archived does not inflate totals.
//   - Counts are tied to the snapshot date recorded in each report.
//   - "independent" means highlighted: status INDEPENDENT, corroborated or
//     covered by a complete Scholar list, and not flagged as non-English.

const fs = require("fs");
const path = require("path");
const tally = require("./tally");

const ROOT = path.resolve(__dirname, "..");
const EXHIBITS = path.join(ROOT, "Independent Citation Record", "Exhibits");
const PDF_DIR = path.join(EXHIBITS, "PDFs");
const SUPPORT_DIR = path.join(EXHIBITS, "Supporting");

const asJson = process.argv.includes("--json");

// Grouping and counting live in tally.js, shared with build-ledger.js. Keeping
// one implementation is what stops the console summary and the written ledger
// from reporting different numbers for the same evidence.
function reportsByPublication() {
  return tally.groupReports(SUPPORT_DIR, PDF_DIR);
}

function tallyEntries(entries) {
  const t = tally.tallyEntries(entries);
  // The table below keeps its historical key names.
  return {
    records: t.records,
    independent: t.independent,
    confirmed: t.independent_confirmed,
    coverage: t.independent_coverage,
    decided: t.independent_user_decided,
    dependent: t.dependent,
    self_pi: t.self_pi,
    self_former: t.self_former_pi,
    review: t.review,
    review_queue: t.review_queue,
    non_english: t.non_english,
  };
}

function main() {
  const groups = reportsByPublication();
  const rows = [];
  const total = tallyEntries([]);
  total.publications = 0;
  total.pdf_pages = 0;

  for (const [pub, g] of [...groups.entries()].sort((a, b) =>
    a[0].localeCompare(b[0])
  )) {
    const entries = g.pages.flatMap((p) => p.entries);
    const t = tallyEntries(entries);
    t.publication = pub;
    t.title = g.title;
    t.pages = g.pages.length;
    t.snapshot = [...g.snapshots].join(", ");
    rows.push(t);
    total.publications += 1;
    total.pdf_pages += g.pages.length;
    for (const k of Object.keys(t)) {
      if (typeof t[k] === "number") total[k] += t[k];
    }
  }

  if (asJson) {
    console.log(JSON.stringify({ total, publications: rows }, null, 2));
    return;
  }

  const pad = (s, n) => String(s).padEnd(n);
  console.log(
    `${pad("publication", 52)} ${pad("pgs", 4)} ${pad("recs", 5)} ${pad("indep", 6)} ${pad("conf", 5)} ${pad("cov", 4)} ${pad("dep", 4)} rev`
  );
  for (const r of rows) {
    console.log(
      `${pad(r.publication.slice(0, 50), 52)} ${pad(r.pages, 4)} ${pad(
        r.records,
        5
      )} ${pad(r.independent, 6)} ${pad(r.confirmed, 5)} ${pad(
        r.coverage,
        4
      )} ${pad(r.dependent, 4)} ${r.review}`
    );
  }
  console.log("");
  console.log(
    `Publications with a filed exhibit: ${total.publications} of 48`
  );
  console.log(`Exhibit PDF pages:              ${total.pdf_pages}`);
  console.log(`Citation records reviewed:      ${total.records}`);
  // The three bases must sum to the independent total. They are printed together
  // for that reason: a line reading "685 externally confirmed + 387 Scholar list"
  // beside a total of 1077 leaves 5 rows unexplained, and those 5 rest on a
  // person's reading rather than on a machine, which the record is required to
  // report separately rather than fold into "externally confirmed".
  const bases = total.confirmed + total.coverage + total.decided;
  console.log(
    `Independent and highlighted:    ${total.independent} ` +
      `(${total.confirmed} externally confirmed, ${total.coverage} not indexed externally so marked on Scholar's complete list` +
      (total.decided ? `, ${total.decided} settled by you` : "") +
      `)`
  );
  if (bases !== total.independent) {
    console.log(
      `  WARNING: the bases sum to ${bases}, not ${total.independent}. ` +
        `A confirm_state outside confirmed/unverified-coverage/user-decided is ` +
        `being highlighted - investigate rather than quoting this figure.`
    );
  }
  console.log(`Dependent (shares an author):   ${total.dependent}`);
  console.log(
    `Self-citations (PI/former):     ${total.self_pi} / ${total.self_former}`
  );
  console.log(
    `Review queue:                   ${total.review_queue}` +
      (total.review > total.review_queue
        ? `  (${total.review} classified REVIEW, ${total.review - total.review_queue}` +
          ` of them non-English and reported under Flagged non-English)`
        : "")
  );
  console.log(`Flagged non-English:            ${total.non_english}`);
  console.log(
    "\nCounts are tied to the snapshot date in each report and include only" +
      "\npublications whose exhibit PDF is currently in Exhibits/PDFs."
  );
}

main();

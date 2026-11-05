// Offline cross-check: per-article exhibit totals versus the Scholar snapshot
// count for the same publication, plus highlight/flag accounting per article.
//
//   node tools/check-ledger-vs-snapshot.js
//
// Contacts nothing. Reads the dated ledger CSV written by build-ledger.js and
// the dated publication list, and reports:
//   1. every captured publication whose exhibit row count differs from the
//      cited-by count shown on the profile at the snapshot (Scholar's profile
//      count includes "duplicate versions" that the citing list itself folds
//      away, so a gap is expected - the point is to see its size and sign);
//   2. per-article arithmetic: does independent + dependent + self + review +
//      pending account for every record, and does the highlighted mark count
//      equal the countable independent count;
//   3. global totals recomputed from the CSV rows versus the CSV global block.
//
// Read-only. Exits 1 only on an internal arithmetic inconsistency, not on a
// duplicate-version gap, which is normal Scholar behaviour.

const fs = require("fs");
const path = require("path");
// Minimal CSV reader: the ledger writer quotes every field that needs it, so a
// quoted-aware split on newlines and commas is enough. Kept local so this check
// depends on nothing but the published CSV, not on the code that wrote it.
function readCsv(file) {
  const text = fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "");
  const records = [];
  let row = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
      continue;
    }
    if (c === '"') quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      records.push(row);
      row = [];
      field = "";
    } else if (c !== "\r") field += c;
  }
  if (field !== "" || row.length) {
    row.push(field);
    records.push(row);
  }
  const header = records.shift();
  return records
    .filter((r) => r.length > 1 || (r.length === 1 && r[0].trim() !== ""))
    .map((r) => {
      const o = {};
      header.forEach((h, i) => (o[h.trim()] = r[i] === undefined ? "" : r[i]));
      return o;
    });
}

const ROOT = path.resolve(__dirname, "..");
const SUPPORT = path.join(
  ROOT,
  "Independent Citation Record",
  "Exhibits",
  "Supporting"
);

function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

const files = fs
  .readdirSync(SUPPORT)
  .filter((f) => /^citation-ledger-\d{4}-\d{2}-\d{2}\.csv$/.test(f))
  .sort();
if (!files.length) {
  console.error("[check] No citation ledger CSV found. Run build-ledger.js.");
  process.exitCode = 1;
  return;
}
const ledgerFile = files[files.length - 1];
const rows = readCsv(path.join(SUPPORT, ledgerFile));
console.log(`[check] Ledger: ${ledgerFile} (${rows.length} publication rows)`);

let problems = 0;
const gaps = [];

for (const r of rows) {
  if (r.status !== "captured") continue;
  const citedBy = num(r.cited_by_at_snapshot);
  const records = num(r.records_captured);
  const unique = num(r.unique_records);
  const dupes = num(r.duplicate_records);

  // 1. exhibit rows vs profile count.
  if (unique !== citedBy) {
    gaps.push({
      title: r.title,
      citedBy,
      records,
      unique,
      dupes,
      delta: unique - citedBy,
      pages: `${r.pages_captured}/${r.pages_expected}`,
    });
  }

  // 2. per-article arithmetic. Decided + review + pending + the non-English
  // independent rows + the second-copy independent rows should cover every record.
  //
  // The last term was added on 2026-11-03 when the language screen began to
  // supersede the independence classification: a non-English row classified
  // INDEPENDENT no longer sits in independent_pending, so without naming it here
  // the sum fell short by exactly those rows. They are not open work -- no
  // certified translation is being obtained -- so they must be reported, not
  // counted as something a reviewer still has to settle.
  //
  // The term after it was added on 2026-11-05 for the same reason one bucket
  // over. The mark rule began to refuse a row that does not stand for its work
  // (user decision -- no preprint/copy row is highlighted in a PDF), so 17 rows
  // left `independent` while the same change took them out of
  // `independent_pending`, since the standing sibling already settled their
  // verdict. Four terms now partition the INDEPENDENT rows: highlighted,
  // unsettled, non-English, and second-copy.
  const decided =
    num(r.independent) +
    num(r.dependent) +
    num(r.self_pi) +
    num(r.self_former_pi);
  const covered = decided + num(r.review);
  const neIndependent = num(r.non_english_independent);
  const copyIndependent = num(r.secondary_copy_independent);
  const summed =
    covered + num(r.independent_pending) + neIndependent + copyIndependent;
  if (summed !== records) {
    console.log(
      `[check] ARITHMETIC ${r.title.slice(0, 48)}: ${records} records but ` +
        `independent ${r.independent} + dependent ${r.dependent} + self ${num(
          r.self_pi
        )}/${num(r.self_former_pi)} + review ${r.review} + pending ${
          r.independent_pending
        } + non-English independent ${neIndependent} + second-copy independent ` +
        `${copyIndependent} = ${summed}`
    );
    problems++;
  }
  // The queue is a subset of the REVIEW rows, and the rows it leaves out are
  // either non-English or copies whose standing sibling already settled the work
  // (tally.isReviewQueue). Checking the containment rather than an exact formula
  // keeps this valid for a ledger written before those terms existed, where
  // review_queue is simply absent and reads 0. When the named parts ARE present
  // they must add up to the gap exactly -- a gap explained by the wrong reason is
  // the defect that let two inherited copies be reported as non-English rows.
  const queue = num(r.review_queue);
  const gap = num(r.review) - queue;
  if (queue > num(r.review)) {
    console.log(
      `[check] QUEUE ${r.title.slice(0, 48)}: review_queue ${queue} exceeds the ` +
        `${r.review} rows classified REVIEW`
    );
    problems++;
  } else if (r.review_non_english !== undefined || r.review_inherited !== undefined) {
    const parts = num(r.review_non_english) + num(r.review_inherited);
    if (parts !== gap) {
      console.log(
        `[check] QUEUE ${r.title.slice(0, 48)}: ${gap} rows left the queue but the ` +
          `named reasons (${num(r.review_non_english)} non-English + ` +
          `${num(r.review_inherited)} inherited) account for ${parts}`
      );
      problems++;
    }
  } else if (gap > 0 && gap > num(r.non_english)) {
    console.log(
      `[check] QUEUE ${r.title.slice(0, 48)}: ${gap} rows left the ` +
        `queue but only ${r.non_english} is/are flagged non-English`
    );
    problems++;
  }
  // Duplicate bookkeeping must be self-consistent.
  if (records - dupes !== unique) {
    console.log(
      `[check] DUPES ${r.title.slice(0, 48)}: ${records} records - ${dupes} ` +
        `duplicate copies != ${unique} distinct papers`
    );
    problems++;
  }
  // A countable independent can never exceed the non-English-adjusted pool.
  if (num(r.independent) > num(r.records_captured)) {
    console.log(`[check] OVERCOUNT ${r.title.slice(0, 48)}`);
    problems++;
  }
}

// 3. global totals versus the sum of the per-article rows.
const sum = (k) => rows.reduce((a, r) => a + num(r[k]), 0);
const ledgerJson = JSON.parse(
  fs.readFileSync(
    path.join(SUPPORT, ledgerFile.replace(/\.csv$/, ".json")),
    "utf8"
  )
);
const g = ledgerJson.global;
// The global block uses its own published key names; map them to the per-row
// columns so the comparison is honest rather than silently reading 0.
const checks = [
  ["citation_records_reviewed", "records_captured", sum("records_captured")],
  ["unique_papers_citing", "unique_records", sum("unique_records")],
  ["duplicate_records", "duplicate_records", sum("duplicate_records")],
  ["independent_countable", "independent", sum("independent")],
  ["independent_unique_papers", "unique_independent", sum("unique_independent")],
  [
    "independent_externally_confirmed",
    "independent_confirmed",
    sum("independent_confirmed"),
  ],
  [
    "independent_scholar_list_only",
    "independent_coverage",
    sum("independent_coverage"),
  ],
  [
    "independent_user_decided",
    "independent_user_decided",
    sum("independent_user_decided"),
  ],
  ["independent_pending", "independent_pending", sum("independent_pending")],
  // Added 2026-11-03: the non-English rows that carry an INDEPENDENT
  // classification. They left independent_pending when the language screen began
  // to supersede it, so the partition needs them under their own name.
  [
    "non_english_independent",
    "non_english_independent",
    sum("non_english_independent"),
  ],
  // Added 2026-11-05: the independent rows that are Scholar's second listing of
  // a work counted once. They left independent_countable when the mark rule
  // began to refuse a non-standing row, so the partition needs them named.
  [
    "secondary_copy_independent",
    "secondary_copy_independent",
    sum("secondary_copy_independent"),
  ],
  ["dependent", "dependent", sum("dependent")],
  ["self_pi", "self_pi", sum("self_pi")],
  ["self_former_pi", "self_former_pi", sum("self_former_pi")],
  ["awaiting_review", "review", sum("review")],
  // The actionable queue, checked the same way. It is a different figure from
  // awaiting_review -- the non-English REVIEW rows are on the Non-English page
  // rather than in a queue -- so both are verified independently rather than one
  // being derived from the other here.
  ["review_queue", "review_queue", sum("review_queue")],
  ["flagged_non_english", "non_english", sum("non_english")],
  [
    "non_english_withheld",
    "non_english_withheld",
    sum("non_english_withheld"),
  ],
  [
    "english_citation_records",
    "english_records",
    sum("english_records"),
  ],
  [
    "english_independent_records",
    "english_independent",
    sum("english_independent"),
  ],
];
for (const [globalKey, rowKey, rowSum] of checks) {
  const jsonVal = num(g[globalKey]);
  const flag = jsonVal === rowSum ? "ok  " : "DIFF";
  if (jsonVal !== rowSum) problems++;
  console.log(
    `[check] ${flag} ${globalKey.padEnd(30)} rows=${rowSum} global=${jsonVal}`
  );
}

if (gaps.length) {
  console.log(
    `\n[check] Distinct-paper count vs profile cited-by for ${gaps.length} publication(s):`
  );
  for (const x of gaps
    .slice()
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))) {
    console.log(
      `        ${String(x.delta).padStart(4)} | profile ${String(
        x.citedBy
      ).padStart(4)} vs ${String(x.unique).padStart(4)} distinct (${
        x.records
      } rows, ${x.dupes} copies) | pages ${x.pages} | ${x.title.slice(0, 52)}`
    );
  }
  console.log(
    "[check] Scholar's profile count includes duplicate versions the citing\n" +
      "        list folds together, so a negative delta is expected. A POSITIVE\n" +
      "        delta means the exhibit shows more distinct papers than the\n" +
      "        profile claims - investigate those first."
  );
} else {
  console.log("[check] Every captured publication matches its profile count.");
}

console.log(
  problems
    ? `\n[check] ${problems} internal inconsistency(ies). Investigate before quoting.`
    : "\n[check] Internal arithmetic is consistent across every row."
);
process.exitCode = problems ? 1 : 0;

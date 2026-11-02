// Build the review sheet: the citations whose independence is still unresolved.
//
//   node tools/build-review-sheet.js          (writes Drafts/review-queue-<date>.csv)
//   node tools/build-review-sheet.js --md     (also writes a readable .md table)
//
// Why a file and not just a query: the user is working through these 94 rows by
// hand, and needs to quote a row back and record a decision against it. The
// identifier has to be the durable one, so every row leads with row_uid -- it
// still means the same row after a re-capture or a rebuild.
//
// Read from v_review, the same view tools/query-catalog.js prints, so the sheet,
// the query tool and the dashboard's review section name the same rows in the
// same three buckets. Nothing is inferred here: the "your decision" column is
// empty on purpose, because a decision on one of these rows changes the totals
// and must come from the user, not from a rule.
//
// Read-only against the store. Writes into Drafts/, which is review workspace,
// not the evidence packet.

const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");
const { DB_PATH } = require("./build-catalog");

const ROOT = path.resolve(__dirname, "..");
const OUT_DIR = path.join(ROOT, "Drafts");
const AS_MD = process.argv.includes("--md");

const BUCKET_LABELS = {
  "1 contradicted":
    "An external record publishes a complete author list that OVERLAPS the PI's, so the Scholar byline this row was judged from is incomplete or wrong.",
  "2 external-no-overlap":
    "An external record has a complete author list with NO overlap, but Scholar's own byline is truncated, so the row is not promoted to independent on an external record alone. These are the likeliest to resolve as independent.",
  "3 unresolvable":
    "Neither PubMed nor OpenAlex indexes the paper and Scholar's byline is truncated, so there is nothing to compare. Resolving one needs a human look at the published article.",
};

function log(m) {
  console.log(`[review] ${m}`);
}

if (!fs.existsSync(DB_PATH)) {
  throw new Error(`No catalog at ${DB_PATH}. Run: node tools/build-catalog.js --write`);
}

const db = new DatabaseSync(DB_PATH, { readOnly: true });
const meta = Object.fromEntries(
  db.prepare("SELECT key, value FROM meta").all().map((r) => [r.key, r.value])
);
const rows = db
  .prepare(
    `SELECT
       row_uid, bucket, cites_id, cited_work, cited_venue, cited_year, cid,
       title, scholar_byline, truncated, confirm_state, why,
       external_source, external_url, external_authors, external_matched,
       matched_authors, language_flag, link, base, page, row_index
     FROM v_review`
  )
  .all();
const totals = db
  .prepare(
    `SELECT COUNT(*) AS active,
            SUM(CASE WHEN status = 'REVIEW' THEN 1 ELSE 0 END) AS review
     FROM v_active`
  )
  .get();
db.close();

if (rows.length !== totals.review) {
  throw new Error(
    `v_review holds ${rows.length} rows but the active set has ${totals.review} with ` +
      `status REVIEW. Rebuild the store; do not publish a sheet over a disagreement.`
  );
}

// The external author list arrives as a JSON array of names. Rendered flat so a
// spreadsheet cell reads it, and left blank rather than guessed when the record
// published no list -- an empty cell here is meaningful, it is not a missed value.
function parseNames(v) {
  if (!v) return "";
  try {
    const p = JSON.parse(v);
    return Array.isArray(p) ? p.join("; ") : String(v);
  } catch {
    return String(v);
  }
}

// The names an external record matched against the PI's, which is the whole
// reason a contradicted row is in the queue. Two columns hold that idea and only
// one of them is populated: external_matched is written by the corroboration
// step, matched_authors is the older Scholar-side field. Read whichever has
// names rather than the first one, so the sheet never shows "no overlap" beside
// a row whose attention_reason says it was contradicted by a specific person.
function overlapNames(r) {
  for (const v of [r.external_matched, r.matched_authors]) {
    const s = parseNames(v);
    // The capture stores matched_authors + matched_pi + matched_former_pi
    // concatenated, so the same person appears once from the citing paper's list
    // and once from the PI list. A reviewer reading "Umesh R. Desai; Umesh R.
    // Desai" would think two people were involved, so collapse repeats while
    // keeping first-seen order. The overlap itself is what matters here.
    if (s) return [...new Set(s.split("; ").map((x) => x.trim()).filter(Boolean))].join("; ");
  }
  return "";
}

const out = rows.map((r) => ({
  "row_uid": r.row_uid,
  "bucket": r.bucket,
  "citing_title": r.title,
  "scholar_byline": r.scholar_byline,
  "byline_truncated": r.truncated === 1 ? "yes" : "no",
  "cites_this_PI_work": r.cited_work,
  "cited_venue_year": [r.cited_venue, r.cited_year].filter(Boolean).join(", "),
  "exhibit_page": r.page,
  "exhibit_row": r.row_index,
  "exhibit_base": r.base,
  "why_unresolved": r.why,
  "external_record": r.external_source || "",
  "external_authors": parseNames(r.external_authors),
  "external_overlap_names": overlapNames(r),
  "external_link": r.external_url || "",
  "citing_paper_link": r.link || "",
  "scholar_cid": r.cid,
  "language_flag": r.language_flag || "",
  "your_decision": "",
  "your_notes": "",
}));

const ORDER = Object.keys(out[0]);

function csvCell(v) {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const csv =
  [ORDER.join(",")]
    .concat(out.map((r) => ORDER.map((c) => csvCell(r[c])).join(",")))
    .join("\r\n") + "\r\n";

const stamp = meta.snapshot_date || new Date().toISOString().slice(0, 10);
fs.mkdirSync(OUT_DIR, { recursive: true });
const csvPath = path.join(OUT_DIR, `review-queue-${stamp}.csv`);
fs.writeFileSync(csvPath, csv, "utf8");

const buckets = out.reduce((a, r) => {
  a[r.bucket] = (a[r.bucket] || 0) + 1;
  return a;
}, {});

log(`${rows.length} unresolved citation(s) across ${totals.active} active rows.`);
for (const [b, n] of Object.entries(buckets).sort()) log(`  ${b}: ${n}`);
log(`Wrote ${path.relative(ROOT, csvPath)}`);

if (AS_MD) {
  // A markdown table for reading rather than deciding: the CSV is the working
  // file, this is the one to skim. Long titles are left whole since a wrapped
  // cell that hides a title is useless for a judgement call.
  const md = [];
  md.push(`# Unresolved citations — review queue`);
  md.push(``);
  md.push(
    `Scholar snapshot **${stamp}**, store built ${meta.built_at}. ` +
      `**${rows.length}** of ${totals.active} active citation rows are still classified ` +
      `REVIEW, so none of them is counted as independent and none is counted as ` +
      `dependent either.`
  );
  md.push(``);
  md.push(
    `Quote the **row_uid** when answering — it is permanent, so it still means the same ` +
      `row after a re-capture or a rebuild. The integer id is a frozen legacy alias and ` +
      `should not be used.`
  );
  md.push(``);
  md.push(`| Bucket | Rows | What it means |`);
  md.push(`|---|---:|---|`);
  for (const [b, n] of Object.entries(buckets).sort()) {
    md.push(`| ${b} | ${n} | ${BUCKET_LABELS[b] || ""} |`);
  }
  md.push(``);
  for (const [b, n] of Object.entries(buckets).sort()) {
    md.push(``);
    md.push(`## ${b} — ${n} row(s)`);
    md.push(``);
    md.push(BUCKET_LABELS[b] || "");
    md.push(``);
    md.push(`| row_uid | Citing title | Scholar byline | Cites (PI work) | Pg | Row | Why unresolved | External record | Your decision |`);
    md.push(`|---|---|---|---|---:|---:|---|---|---|`);
    for (const r of out.filter((x) => x.bucket === b)) {
      const ext = r.external_record
        ? r.external_link
          ? `[${r.external_record}](${r.external_link})` +
            (r.external_overlap_names
              ? ` — overlap: ${r.external_overlap_names}`
              : ` — no overlap`)
          : r.external_record
        : "*(none indexed)*";
      const cell = (s) => String(s || "").replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
      md.push(
        `| \`${r.row_uid}\` | ${cell(r.citing_title)} | ${cell(r.scholar_byline)} | ` +
          `${cell(r.cites_this_PI_work)} | ${r.exhibit_page} | ${r.exhibit_row} | ` +
          `${cell(r.why_unresolved)} | ${cell(ext)} |  |`
      );
    }
  }
  md.push(``);
  md.push(
    `---`
  );
  md.push(``);
  md.push(
    `The working file is \`Drafts/review-queue-${stamp}.csv\`, which carries the same ` +
      `rows plus \`external_authors\`, \`citing_paper_link\`, \`scholar_cid\`, \`language_flag\` ` +
      `and a \`your_notes\` column. Nothing in either file is a decision, and no figure in ` +
      `the packet changes until one is recorded.`
  );
  const mdPath = path.join(OUT_DIR, `review-queue-${stamp}.md`);
  fs.writeFileSync(mdPath, md.join("\n") + "\n", "utf8");
  log(`Wrote ${path.relative(ROOT, mdPath)}`);
}

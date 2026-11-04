// Build the review sheet: the citations whose independence is still unresolved.
//
//   node tools/build-review-sheet.js          (writes Drafts/review-queue-<date>.csv)
//   node tools/build-review-sheet.js --md     (also writes a readable .md table)
//
// Why a file and not just a query: the user works through these rows by hand,
// and needs to quote a row back and record a decision against it. The
// identifier has to be the durable one, so every row leads with row_uid -- it
// still means the same row after a re-capture or a rebuild.
//
// Read from v_review, the same view tools/query-catalog.js prints, so the sheet,
// the query tool and the dashboard's review section name the same rows in the
// same three buckets. Nothing is inferred here: the "your_decision" column is
// empty on purpose, because a decision on one of these rows changes the totals
// and must come from the user, not from a rule.
//
// A row that is also non-English is not on this sheet (user instruction,
// 2026-11-03). The queue is the list where reading the published byline settles
// something; with no certified translations being obtained a decision on a
// non-English row changes no figure, so those rows are reported with the other
// non-English entries instead -- `node tools/query-catalog.js nonenglish`. The
// language_flag column is kept so a row that ever reappears here with a flag is
// visible rather than silently worked.
//
// Filling your_decision is machine-readable. Writing INDEPENDENT, DEPENDENT,
// SELF (PI), SELF (FORMER PI) or REVIEW in it (any case) and running
//   node tools/apply-decision.js --from-csv --write --reprint --rebuild
// applies every filled row through the pipeline. The tool is dry-run by default,
// backs up what it touches, and refuses the batch if any row cannot be matched
// to its citation by title. Do not edit the store or the report JSON by hand to
// record a decision -- the next build would silently revert it.
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

// The three buckets as v_review defines them. Buckets 1 and 2 have been empty
// since the 2026-11-02 corroboration rule, which lets a credible external list
// settle a row rather than leaving it open; they are kept so a sheet built from
// an older store still reads correctly, and so the reason those rows left is
// recorded rather than lost.
const BUCKET_LABELS = {
  "1 contradicted":
    "An external record publishes a complete author list that OVERLAPS the PI's. Since 2026-11-02 such a row is classified from that list and leaves the queue, so this bucket should be empty; a row here means the external match needs a person.",
  "2 external-no-overlap":
    "An external record has a complete author list with NO overlap while Scholar's own byline is truncated. Since 2026-11-02 the external list settles these as independent, so this bucket should be empty; a row here needs a person.",
  "3 unresolvable":
    "Neither PubMed nor OpenAlex indexes the paper and Scholar's byline is truncated, so there is nothing to compare. Resolving one needs a human look at the published article — put the answer in your_decision, or run tools/apply-decision.js.",
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
       matched_authors, external_match_credible, language_flag, link, base, page, row_index
     FROM v_review`
  )
  .all();
const totals = db
  .prepare(
    `SELECT COUNT(*) AS active,
            SUM(CASE WHEN status = 'REVIEW' THEN 1 ELSE 0 END) AS review,
            -- Mirrors tally.isReviewQueue: excludes non-English rows and, since
            -- schema v10, copies whose standing sibling already settled the work.
            SUM(CASE WHEN status = 'REVIEW' AND is_non_english = 0
                      AND inherited_status = '' THEN 1 ELSE 0 END)
              AS review_queue,
            SUM(CASE WHEN status = 'REVIEW' AND is_non_english = 1 THEN 1 ELSE 0 END)
              AS review_non_english,
            -- The third reason a REVIEW row is not on this sheet: it is a copy of
            -- a work whose standing copy is already settled (tally.inheritedFrom).
            -- Named separately because a header that blamed the whole gap on
            -- language was wrong, and this sheet is what the user reads.
            SUM(CASE WHEN status = 'REVIEW' AND is_non_english = 0
                      AND inherited_status <> '' THEN 1 ELSE 0 END)
              AS review_inherited
     FROM v_active`
  )
  .get();
db.close();

// The queue is the actionable subset: a REVIEW row that is also non-English is
// not here, because no reading of its byline can change the packet (see
// tally.isReviewQueue). Guarding against review_queue rather than review is what
// keeps that true -- if the view and the store ever disagree about which rows
// are actionable, the sheet refuses to publish rather than quietly dropping rows
// a person is waiting on.
if (rows.length !== totals.review_queue) {
  throw new Error(
    `v_review holds ${rows.length} rows but the active set has ${totals.review_queue} ` +
      `that are REVIEW and English. Rebuild the store; do not publish a sheet over a ` +
      `disagreement.`
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
  // A record whose title overlap was too thin to be the same work is stored on
  // the row as the audit trail of the rejection, NOT as evidence about the
  // paper. Label it, or a reviewer sees "pubmed" beside a why_unresolved that
  // says nothing indexes it and follows the link to an unrelated article --
  // cit-001476 points at a swine-lung paper for exactly this reason.
  "external_record": r.external_match_credible === 0
    ? `${r.external_source || ""} (match rejected: not the same work)`
    : r.external_source || "",
  "external_authors": parseNames(r.external_authors),
  "external_overlap_names": overlapNames(r),
  // No link when the match was rejected: there is nothing here to check, and a
  // URL that implies a usable external source is worse than a blank cell.
  "external_link": r.external_match_credible === 0 ? "" : r.external_url || "",
  "citing_paper_link": r.link || "",
  "scholar_cid": r.cid,
  "language_flag": r.language_flag || "",
  "your_decision": "",
  "your_notes": "",
}));

// The column order is stated rather than read off the first row. The queue can
// legitimately be empty -- it closed on 2026-11-04 -- and taking the header from
// out[0] crashed on exactly that. It also matters that an empty sheet still gets
// a full header: apply-decision.js --from-csv reads this file and refuses one
// with no row_uid / your_decision column, so a closed queue must remain a sheet
// it can read, not a blank file.
const ORDER = [
  "row_uid",
  "bucket",
  "citing_title",
  "scholar_byline",
  "byline_truncated",
  "cites_this_PI_work",
  "cited_venue_year",
  "exhibit_page",
  "exhibit_row",
  "exhibit_base",
  "why_unresolved",
  "external_record",
  "external_authors",
  "external_overlap_names",
  "external_link",
  "citing_paper_link",
  "scholar_cid",
  "language_flag",
  "your_decision",
  "your_notes",
];

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
      `**${rows.length}** of ${totals.active} active citation rows are on this queue, ` +
      `so none of them is counted as independent and none is counted as dependent either.`
  );
  md.push(``);
  if (totals.review > totals.review_queue) {
    // Every row missing from this sheet gets its reason named. The two reasons
    // are different in kind -- one is a closed decision, one is an answer the
    // work already has -- and lumping them together previously told the reader
    // that 7 rows were non-English when only 5 were.
    const why = [];
    if (totals.review_non_english) {
      why.push(
        `${totals.review_non_english} are flagged non-English, where no certified ` +
          `translation is being obtained (decision of 2026-11-01) so no reading of the ` +
          `byline can change the packet -- see \`node tools/query-catalog.js nonenglish\``
      );
    }
    if (totals.review_inherited) {
      why.push(
        `${totals.review_inherited} are a second copy of a work whose published record ` +
          `is already settled, so they take that verdict by inheritance and are listed ` +
          `under Preprint / copy on the dashboard instead`
      );
    }
    const gap = totals.review - totals.review_queue;
    const explained = totals.review_non_english + totals.review_inherited;
    const unexplained =
      explained === gap
        ? ""
        : `; ${gap - explained} UNEXPLAINED, so the sheet's totals query and the ` +
          `queue rule disagree -- rebuild the store`;
    md.push(
      `${totals.review} rows are classified REVIEW in total. ` +
        `${gap} not listed here: ${why.join("; ")}${unexplained}.`
    );
    md.push(``);
  }
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
  if (!out.length) {
    // An empty queue is a result, not a missing build. Say so, and say what the
    // remaining REVIEW rows are, so a reader never mistakes a blank table for a
    // sheet that failed to generate.
    md.push(``);
    md.push(
      `**The queue is empty.** Every citation on a filed exhibit page is classified, so ` +
        `nothing is left where reading the published byline would change a figure. A new ` +
        `row can still appear here after a re-capture or a change to what counts.`
    );
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
      `and a \`your_notes\` column. Nothing in either file is a decision yet, and no figure ` +
      `in the packet changes until one is recorded.`
  );
  md.push(``);
  md.push(
    `**To resolve a row:** write \`INDEPENDENT\`, \`DEPENDENT\`, \`SELF (PI)\`, ` +
      `\`SELF (FORMER PI)\` or \`REVIEW\` into the \`your_decision\` column of the CSV ` +
      `(optionally a reason in \`your_notes\`), then run`
  );
  md.push(``);
  md.push("```");
  md.push("node tools/apply-decision.js --from-csv --write --reprint --rebuild");
  md.push("```");
  md.push(``);
  md.push(
    `Drop \`--write\` first to see the plan. A single row can be decided without the CSV: ` +
      `\`node tools/apply-decision.js --row=${"`"}cit-000019${"`"} --verdict=dependent --write --reprint --rebuild\`. ` +
      `A decided row is reported separately as "settled by you" and can be taken back with \`--revert\`.`
  );
  const mdPath = path.join(OUT_DIR, `review-queue-${stamp}.md`);
  fs.writeFileSync(mdPath, md.join("\n") + "\n", "utf8");
  log(`Wrote ${path.relative(ROOT, mdPath)}`);
}

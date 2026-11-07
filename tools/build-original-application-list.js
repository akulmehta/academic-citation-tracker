// Build Citations/Notable Citations in Original Application/Original-Application-Citations.md
//
// The 19 PDFs in that folder are citations that were already used in the original
// EB1A application. They must not be submitted again as new evidence, so they need
// their own record: which paper each file is, which of the PI's works it cites, and
// whether that citation is already counted in the current packet.
//
// Everything below is DERIVED. A file name carries the year, the journal and the
// first author; the catalog supplies the rest. The matching basis is printed for
// every row, and anything the name alone cannot settle is flagged for a person
// rather than folded in silently. The PDF itself remains the authority on content.
//
//   node tools/build-original-application-list.js          write the .md
//   node tools/build-original-application-list.js --check  report drift, write nothing
//
// No dependency, consistent with tools/env.js and tools/parse-citation-summary.js.

const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");
const { DB_PATH } = require("./build-catalog");

const ROOT = path.resolve(__dirname, "..");
const FOLDER = path.join(ROOT, "Citations", "Notable Citations in Original Application");
const OUT = path.join(FOLDER, "Original-Application-Citations.md");
const CHECK = process.argv.includes("--check");

// 01_2019_Biochemistry R Billur.pdf  /  03_2021_J Med Chem_M N Stadtmueller.pdf
// The boundary between journal and author is inconsistent: some names use a "_"
// before the author, some only a space. Both spellings are handled, and whatever
// the parser decided is reported so a mis-split is visible instead of silent.
function parseName(name) {
  const base = name.replace(/\.pdf$/i, "");
  const m = base.match(/^(\d{2})_(\d{4})_(.*)$/);
  if (!m) return null;
  const [, num, year, rest] = m;
  let journal = "";
  let author = rest;
  const us = rest.lastIndexOf("_");
  if (us > 0) {
    journal = rest.slice(0, us).replace(/_/g, " ").trim();
    author = rest.slice(us + 1).trim();
  } else {
    const t = rest.split(/\s+/);
    if (t.length > 2) {
      journal = t.slice(0, t.length - 2).join(" ");
      author = t.slice(t.length - 2).join(" ");
    }
  }
  return { num, year, journal, author, split: us > 0 ? "underscore" : "two trailing tokens" };
}

// Fold accents, drop punctuation the Scholar byline renders differently from a file
// name (apostrophes, hyphens, periods), and lower-case. Needed because the file for
// PN Ng'ang'a is written "Ng ang a" and Ripoll‐Rozada uses a non-ASCII hyphen.
function fold(s) {
  return String(s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/['’`.\-\s\u2010\u2011\u2012\u2013]/g, "");
}

// Scholar truncates the byline with an ellipsis after ~3 names, so the first author
// is always fully rendered. Compare against that only; a later position would need
// the full list and is not what a file name claims.
function firstAuthorTokens(byline) {
  const s = String(byline || "").replace(/\[[^\]]*\]/g, "").trim().split(",")[0].trim();
  return s.split(/\s+/).filter(Boolean);
}

function loadRows() {
  const db = new DatabaseSync(DB_PATH, { readOnly: true });
  try {
    return db
      .prepare(
        `SELECT c.row_uid, c.title, c.authors, c.status, c.confirm_state, c.is_highlighted, c.doi,
                c.page, c.report_file, c.cites_id, p.title AS cited_title
         FROM citations c
         LEFT JOIN publications p ON p.cites_id = c.cites_id
         WHERE c.superseded_at = '' AND c.filed = 1`
      )
      .all();
  } finally {
    db.close();
  }
}

function match(file, rows) {
  const p = parseName(file);
  if (!p) return { parsed: null, strong: [], weak: [] };
  const at = p.author.split(/\s+/).filter(Boolean);
  // A surname may be several tokens ("Ng'ang'a" folds to one, "van der Wal" to three),
  // so try the trailing 1, 2 and 3 tokens as candidates.
  const surnames = [at.slice(-1), at.slice(-2), at.slice(-3)].map((t) => fold(t.join("")));
  const wantInit = fold(at.slice(0, -1).join(""));
  const strong = [];
  const weak = [];
  for (const r of rows) {
    const toks = firstAuthorTokens(r.authors);
    if (!toks.length) continue;
    const cand = [toks.slice(-1), toks.slice(-2), toks.slice(-3)].map((t) => fold(t.join("")));
    if (!surnames.some((s) => s && cand.includes(s))) continue;
    const have = fold(toks.slice(0, -1).join(""));
    const initOk = !wantInit || have === wantInit || have.startsWith(wantInit) || wantInit.startsWith(have);
    const yearOk = String(r.authors || "").includes(p.year);
    const hit = { row: r, initOk, yearOk };
    if (initOk && yearOk) strong.push(hit);
    else weak.push(hit);
  }
  return { parsed: p, strong, weak };
}

function inline(s) {
  return String(s || "").replace(/\|/g, "\\|");
}

function render(entries) {
  const now = new Date().toISOString().slice(0, 10);
  const out = [];
  out.push("# Citations used in the original application");
  out.push("");
  out.push(
    "> **Generated file — do not edit.** Rendered by " +
      "[`tools/build-original-application-list.js`](../../tools/build-original-application-list.js) " +
      `from the ${entries.length} PDFs in this folder cross-referenced against the citation catalog. Re-run ` +
      "`node tools/build-original-application-list.js` after adding a file or rebuilding the catalog. Rendered " +
      `${now}.`
  );
  out.push("");
  out.push(
    "**Purpose.** These articles were cited in the original EB1A application. They are recorded here so the " +
      "current evidence packet does **not** re-submit them as new citations, and so the overlap between the two " +
      "submissions is visible. Nothing in this file is a legal conclusion; the filing decision stays with the " +
      "user and counsel."
  );
  out.push("");
  out.push(
    "**How each row was derived.** A file name carries only `NN_YEAR_JOURNAL_<first author>`, so the first-author " +
      "surname, initials and year were matched against the byline Scholar lists on each active catalog row. The " +
      "basis is printed per row. A file name cannot prove a paper's identity on its own — where the match rests on "
      + "anything weaker than surname + initials + year, the row says so and needs a person to confirm against the PDF."
  );
  out.push("");

  const counts = { strong: 0, ambiguous: 0, none: 0 };
  for (const e of entries) {
    if (e.strong.length) counts.strong++;
    else if (e.weak.length) counts.ambiguous++;
    else counts.none++;
  }
  const alreadyCounted = entries.filter((e) => e.strong.some((h) => h.row.is_highlighted === 1));
  out.push("## Summary *(derived)*");
  out.push("");
  out.push("| | |");
  out.push("|---|---|");
  out.push(`| PDFs in this folder | ${entries.length} |`);
  out.push(
    `| Matched on surname + initials + year | ${counts.strong} — of these, ${alreadyCounted.length} already appear as a highlighted independent citation in the current packet |`
  );
  out.push(`| Need a person to confirm (weaker evidence) | ${counts.ambiguous} |`);
  out.push(`| No catalog row matched the first author | ${counts.none} |`);
  out.push("");

  out.push(`## The ${entries.length} files`);
  out.push("");
  out.push(
    "One row per catalog match, so a paper Scholar lists against two of the PI's works appears twice. " +
      "`Highlighted` means the row carries a yellow mark on its exhibit and is therefore **already counted** — " +
      "do not count it again."
  );
  out.push("");
  out.push("| # | File | Year | Journal (from name) | First author (from name) | row_uid | Status | Highlighted | Cited PI work | Exhibit | Basis |");
  out.push("|---|---|---|---|---|---|---|---|---|---|---|");
  for (const e of entries) {
    const p = e.parsed;
    const fileCell = `[${inline(e.name)}](./${encodeURI(e.name)})`;
    const head = () =>
      `| ${p ? p.num : "—"} | ${fileCell} | ${p ? p.year : "—"} | ${inline(p ? p.journal : "—")} | ${inline(
        p ? p.author : "—"
      )} |`;
    if (!e.strong.length && !e.weak.length) {
      out.push(`${head("")} | *none* | — | — | — | — | no first-author surname match |`);
      continue;
    }
    const list = e.strong.length ? e.strong : e.weak;
    const basis = e.strong.length
      ? `surname + initials + year (${p.split})`
      : `surname only — ${list.every((h) => !h.yearOk) ? "year not in byline" : "initials differ"}; confirm against the PDF`;
    list.forEach((h, i) => {
      const r = h.row;
      const exhibit = r.report_file ? `${r.report_file.replace(/\.report\.json$/, "")} p.${r.page}` : `p.${r.page}`;
      out.push(
        `${i === 0 ? head("") : "| | | | | |"} \`${r.row_uid}\` | ${r.status} | ${
          r.is_highlighted === 1 ? "**yes — already counted**" : "no"
        } | ${inline(r.cited_title || r.cites_id)} | ${inline(exhibit)} | ${i === 0 ? basis : ""} |`
      );
    });
  }
  out.push("");

  const flagged = entries.filter((e) => !e.strong.length);
  if (flagged.length) {
    out.push("## Rows needing confirmation");
    out.push("");
    for (const e of flagged) {
      out.push(`- **[${inline(e.name)}](./${encodeURI(e.name)})**`);
      if (!e.parsed) {
        out.push("  - The file name does not follow `NN_YEAR_JOURNAL_author`, so nothing could be parsed from it.");
        continue;
      }
      if (!e.weak.length) {
        out.push(
          `  - No active catalog row lists \`${e.parsed.author}\` as first author. Either the paper is not in the ` +
            "captured cite lists, or the file is named for an author who is not first on the Scholar byline."
        );
        continue;
      }
      out.push(
        `  - Candidate rows: ${e.weak.map((h) => `\`${h.row.row_uid}\` (${h.row.status}, ${h.row.title})`).join("; ")}. ` +
          "Open the PDF and confirm the author and year before treating any of these as the same paper."
      );
    }
    out.push("");
  }

  const byWork = new Map();
  for (const e of entries) for (const h of e.strong) {
    const k = h.row.title;
    if (!byWork.has(k)) byWork.set(k, []);
    byWork.get(k).push(h.row);
  }
  out.push("## Overlap with the current packet *(derived)*");
  out.push("");
  const highlightedWorks = [...byWork].filter(([, rs]) => rs.some((r) => r.is_highlighted === 1));
  out.push(
    `Of the ${byWork.size} distinct works matched above, ${highlightedWorks.length} carry at least one highlighted ` +
      "independent row in the current packet. Those citations are **already counted** in the packet total, so the " +
      "same citing paper appearing here is not additional evidence — it is the same evidence submitted twice. " +
      "If a paper from this folder is to be used again, it should be referenced as part of the original filing, not " +
      "as a new independent citation."
  );
  out.push("");

  out.push("---");
  out.push("");
  out.push(
    "Independence, counts and exhibit marks come from the catalog and the ledger, not from this file. This file only " +
      "answers \"which papers are in this folder, and does the packet already count them?\""
  );
  out.push("");
  return out.join("\n");
}

function main() {
  if (!fs.existsSync(FOLDER)) {
    console.error(`No folder at ${FOLDER}`);
    process.exit(1);
  }
  const names = fs
    .readdirSync(FOLDER, { withFileTypes: true })
    .filter((d) => d.isFile() && d.name.toLowerCase().endsWith(".pdf"))
    .map((d) => d.name)
    .sort();
  if (!names.length) {
    console.error("No PDFs found; refusing to write an empty record.");
    process.exit(1);
  }
  const rows = loadRows();
  const entries = names.map((name) => ({ name, ...match(name, rows) }));
  const md = render(entries);

  if (CHECK) {
    let existing = null;
    try {
      existing = fs.readFileSync(OUT, "utf8");
    } catch {
      existing = null;
    }
    const strip = (s) => (s || "").replace(/^> \*\*Generated file.*$/m, "");
    if (existing === null) {
      console.error(`DRIFT: ${path.basename(OUT)} does not exist. Run: node tools/build-original-application-list.js`);
      process.exit(1);
    }
    if (strip(existing) !== strip(md)) {
      console.error(`DRIFT: ${path.basename(OUT)} no longer matches the folder. Run the tool without --check.`);
      process.exit(1);
    }
    console.log(`${path.basename(OUT)} is current against the folder (${entries.length} PDFs).`);
    return;
  }

  const tmp = `${OUT}.tmp`;
  fs.writeFileSync(tmp, md, "utf8");
  fs.renameSync(tmp, OUT);
  const matched = entries.filter((e) => e.strong.length).length;
  console.log(
    `Wrote ${path.relative(ROOT, OUT)}: ${entries.length} PDFs, ${matched} matched on surname+initials+year, ` +
      `${entries.length - matched} flagged for confirmation.`
  );
}

main();

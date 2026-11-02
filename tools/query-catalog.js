// Read-only queries over the citation catalog built by tools/build-catalog.js.
//
//   node tools/query-catalog.js patents             citing patents
//   node tools/query-catalog.js stats               totals, overall and per pub
//   node tools/query-catalog.js search <terms>      full-text over title/authors/snippet
//   node tools/query-catalog.js pub <text|cites_id> everything citing one publication
//   node tools/query-catalog.js review              rows needing attention
//   node tools/query-catalog.js sql "SELECT ..."    ad-hoc SELECT only
//
// Add --csv to any subcommand for spreadsheet output, --all to include rows
// whose exhibit PDF is no longer filed, and --limit=N to widen a truncated list.
//
// THIS IS A LOOKUP AID, NOT THE LEDGER. Per the project instructions, any
// figure quoted in the packet comes from citation-ledger-<snapshot>.csv written
// by tools/build-ledger.js. The numbers printed here are read back from the
// database, which build-catalog.js reconciles against tools/tally.js on every
// build; if they ever disagree with the CSV, the CSV is authoritative and this
// tool has a bug.
//
// Nothing here writes. The database is opened read-only and every statement is
// a SELECT; the `sql` subcommand rejects anything else outright.

const path = require("path");
const fs = require("fs");
const { DatabaseSync } = require("node:sqlite");
const { DB_PATH } = require("./build-catalog");

const argv = process.argv.slice(2);
const flags = new Set(argv.filter((a) => a.startsWith("--") && !a.includes("=")));
const opt = (name, fallback = "") => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const positional = argv.filter((a) => !a.startsWith("--"));
const cmd = positional[0] || "stats";
const rest = positional.slice(1);

const AS_CSV = flags.has("--csv");
const ALL = flags.has("--all");
const LIMIT = Math.max(1, parseInt(opt("limit", "0"), 10) || (AS_CSV ? 100000 : 40));

// Filed-only unless --all is given, so the default view matches the ledger.
const FILED = ALL ? "" : "AND c.filed = 1";

function open() {
  if (!fs.existsSync(DB_PATH)) {
    throw new Error(
      `No catalog at ${DB_PATH}. Run: node tools/build-catalog.js`
    );
  }
  return new DatabaseSync(DB_PATH, { readOnly: true });
}

function meta(db, key, fallback = "") {
  const row = db.prepare("SELECT value FROM meta WHERE key = ?").get(key);
  return row ? row.value : fallback;
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

function csvCell(v) {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function printCsv(rows, columns) {
  const cols = columns || (rows.length ? Object.keys(rows[0]) : []);
  const lines = [cols.join(",")];
  for (const r of rows) lines.push(cols.map((c) => csvCell(r[c])).join(","));
  console.log(lines.join("\r\n"));
}

// Fixed-width table with wrapping only on the last column, which keeps a long
// title from pushing everything else off the screen.
function printTable(rows, columns) {
  if (!rows.length) {
    console.log("(no rows)");
    return;
  }
  const cols = columns || Object.keys(rows[0]);
  const widths = cols.map((c) =>
    Math.max(String(c).length, ...rows.map((r) => String(r[c] ?? "").length))
  );
  // Cap the width of everything but the final column.
  for (let i = 0; i < widths.length - 1; i++) widths[i] = Math.min(widths[i], 46);
  const header = cols.map((c, i) => String(c).padEnd(widths[i])).join("  ");
  console.log(header);
  console.log("-".repeat(header.length));
  for (const r of rows) {
    console.log(
      cols
        .map((c, i) => {
          const s = String(r[c] ?? "");
          return i === cols.length - 1 ? s : s.slice(0, widths[i]).padEnd(widths[i]);
        })
        .join("  ")
    );
  }
}

function printRows(rows, columns) {
  if (AS_CSV) return printCsv(rows, columns);
  return printTable(rows, columns);
}

function note(msg) {
  if (!AS_CSV) console.log(msg);
}

function footer(db) {
  note(
    `\nSource: citation-catalog.sqlite (built ${meta(db, "built_at", "?")}, ` +
      `Scholar snapshot ${meta(db, "snapshot_date", "?")})` +
      (ALL ? "  [--all: includes unfiled and archived captures]" : "")
  );
  note(
    "This is a lookup aid. Quote figures from citation-ledger-<snapshot>.csv " +
      "(tools/build-ledger.js), which stays authoritative."
  );
}

// ---------------------------------------------------------------------------
// patents
// ---------------------------------------------------------------------------

function patents(db) {
  // v_patents covers both granted patents and published applications and
  // excludes a venue that merely mentions patents (work_type 'unknown'), which
  // is reported by `review` instead. Patents are never folded into the article
  // count: they are a separate view over the same rows.
  const rows = db
    .prepare(
      `SELECT
         patent_number,
         kind,
         title,
         authors,
         cited_title,
         status,
         CASE is_highlighted WHEN 1 THEN 'counted' ELSE 'not counted' END AS counted,
         confirm_state,
         link
       FROM v_patents
       WHERE 1=1 ${ALL ? "" : "AND filed = 1"}
       ORDER BY cited_title, patent_number
       LIMIT ?`
    )
    .all(LIMIT);

  const counts = db
    .prepare(
      `SELECT COUNT(*) AS n,
              SUM(CASE WHEN is_highlighted = 1 THEN 1 ELSE 0 END) AS hl,
              COUNT(DISTINCT cited_title) AS pubs
       FROM v_patents WHERE 1=1 ${ALL ? "" : "AND filed = 1"}`
    )
    .get();

  printRows(rows, [
    "patent_number",
    "kind",
    "title",
    "authors",
    "cited_title",
    "status",
    "counted",
    "link",
  ]);
  note(
    `\nPatents citing the PI's work: ${counts.n} row(s) across ${counts.pubs} publication(s), ` +
      `${counts.hl} counted as independent.`
  );
  note(
    "Patent citations are kept separate from article citations and are never\n" +
      "added into the article total. A 'kind' of application means a published\n" +
      "application (A1/A2), not a granted patent."
  );
}

// ---------------------------------------------------------------------------
// stats
// ---------------------------------------------------------------------------

function stats(db) {
  const g = db
    .prepare(
      `SELECT
         COUNT(*) AS records,
         SUM(is_highlighted) AS independent,
         SUM(CASE WHEN is_highlighted = 1 AND confirm_state = 'confirmed' THEN 1 ELSE 0 END) AS confirmed,
         SUM(CASE WHEN is_highlighted = 1 AND confirm_state = 'unverified-coverage' THEN 1 ELSE 0 END) AS coverage,
         SUM(CASE WHEN status = 'DEPENDENT' THEN 1 ELSE 0 END) AS dependent,
         SUM(CASE WHEN status = 'SELF (PI)' THEN 1 ELSE 0 END) AS self_pi,
         SUM(CASE WHEN status = 'SELF (FORMER PI)' THEN 1 ELSE 0 END) AS self_former_pi,
         SUM(CASE WHEN status = 'REVIEW' THEN 1 ELSE 0 END) AS review,
         SUM(CASE WHEN language_flag <> '' THEN 1 ELSE 0 END) AS non_english,
         SUM(CASE WHEN withheld_for_language = 1 THEN 1 ELSE 0 END) AS non_english_withheld,
         SUM(CASE WHEN is_non_english = 0 THEN 1 ELSE 0 END) AS english_records,
         SUM(CASE WHEN is_non_english = 0 AND is_highlighted = 1 THEN 1 ELSE 0 END) AS english_independent,
         SUM(CASE WHEN is_primary_copy = 1 THEN 1 ELSE 0 END) AS unique_records,
         SUM(CASE WHEN is_primary_copy = 1 AND is_highlighted = 1 THEN 1 ELSE 0 END) AS unique_independent,
         SUM(CASE WHEN work_type = 'patent' THEN 1 ELSE 0 END) AS patents_granted,
         SUM(CASE WHEN work_type = 'patent-application' THEN 1 ELSE 0 END) AS patent_apps,
         SUM(CASE WHEN work_type = 'unknown' THEN 1 ELSE 0 END) AS work_type_unknown,
         SUM(CASE WHEN needs_attention = 1 OR status = 'REVIEW' THEN 1 ELSE 0 END) AS needs_attention
       FROM citations c WHERE 1=1 ${FILED}`
    )
    .get();

  const pubsFiled = db
    .prepare("SELECT COUNT(*) AS n FROM publications WHERE filed = 1")
    .get().n;
  const pages = Number(
    db
      .prepare(
        `SELECT COALESCE(SUM(pages_captured),0) AS n FROM publications ${ALL ? "WHERE filed = 1" : ""}`
      )
      .get().n
  );

  if (AS_CSV) {
    printCsv([{ scope: "overall", key: "publications", value: pubsFiled },
      ...Object.entries(g).map(([k, v]) => ({ scope: "overall", key: k, value: v }))]);
  } else {
    console.log(`Filed publications:            ${pubsFiled}`);
    console.log(`Exhibit PDF pages:             ${pages}`);
    console.log(`Citation records reviewed:     ${g.records}`);
    console.log(
      `Independent and highlighted:   ${g.independent}  ` +
        `(${g.confirmed} externally confirmed, ${g.coverage} on Scholar's complete list)`
    );
    console.log(`Dependent (shares an author):  ${g.dependent}`);
    console.log(`Self-citations (PI / former):  ${g.self_pi} / ${g.self_former_pi}`);
    console.log(`Awaiting manual review:        ${g.review}`);
    console.log(`Flagged non-English:           ${g.non_english}`);
    console.log(
      `English only (adjusted):       ${g.english_independent} independent of ` +
        `${g.english_records} English records = ` +
        `${g.english_records ? ((g.english_independent / g.english_records) * 100).toFixed(1) : "0"}%` +
        `  (${g.non_english_withheld} withheld for language)`
    );
    console.log(`Distinct papers citing:        ${g.unique_records}  (independent: ${g.unique_independent})`);
    console.log(
      `Patents among these rows:      ${g.patents_granted + g.patent_apps} ` +
        `(${g.patents_granted} granted, ${g.patent_apps} application) -- reported separately, not added to the article total`
    );
    if (g.work_type_unknown) {
      console.log(`Work type undecided:           ${g.work_type_unknown} (venue mentions patents, no patent document -- see: review)`);
    }
    if (g.needs_attention) {
      console.log(`Rows flagged for attention:    ${g.needs_attention}`);
    }

    console.log("\nBy status:");
    printRows(
      db
        .prepare(
          `SELECT status, COUNT(*) AS rows_ FROM citations c WHERE 1=1 ${FILED} GROUP BY status ORDER BY COUNT(*) DESC`
        )
        .all()
    );
    console.log("");
    printRows(
      db
        .prepare(
          `SELECT work_type, COUNT(*) AS rows_ FROM citations c WHERE 1=1 ${FILED} GROUP BY work_type ORDER BY COUNT(*) DESC`
        )
        .all()
    );
    console.log("");
    printRows(
      db
        .prepare(
          `SELECT confirm_state, COUNT(*) AS rows_ FROM citations c WHERE 1=1 ${FILED} GROUP BY confirm_state ORDER BY COUNT(*) DESC`
        )
        .all()
    );

    console.log("\nPer publication (filed exhibits):");
    printRows(
      db
        .prepare(
          `SELECT
             substr(exhibit_base, 1, 46) AS exhibit_base,
             pages_captured AS pgs,
             records,
             independent,
             independent_confirmed AS conf,
             independent_coverage AS cov,
             dependent AS dep,
             review,
             non_english AS noneng,
             patents,
             needs_attention AS attn
           FROM v_pub_stats
           WHERE filed = 1
           ORDER BY exhibit_base`
        )
        .all()
    );
  }
  footer(db);
}

// ---------------------------------------------------------------------------
// search
// ---------------------------------------------------------------------------

function search(db) {
  const terms = rest;
  if (!terms.length) {
    throw new Error('Usage: node tools/query-catalog.js search <terms>   (e.g. search heparin mimetic)');
  }
  const raw = terms.join(" ").trim();
  // Quote each word so an apostrophe or a stray FTS operator in a title cannot
  // turn the search into a syntax error, and prefix-match the last word, which
  // is what a person typing a partial term expects.
  const words = raw.split(/\s+/).filter(Boolean);
  const match = words
    .map((w, i) => `"${w.replace(/"/g, '""')}"${i === words.length - 1 ? "*" : ""}`)
    .join(" ");

  const rows = db
    .prepare(
      `SELECT
         substr(c.title, 1, 70) AS title,
         substr(c.authors_used, 1, 40) AS authors,
         c.status,
         CASE c.is_highlighted WHEN 1 THEN 'counted' ELSE '' END AS counted,
         c.work_type,
         c.patent_number,
         substr(p.title, 1, 34) AS cited,
         c.base,
         c.page
       FROM citations_fts
       JOIN citations c ON c.id = citations_fts.rowid
       LEFT JOIN publications p ON p.cites_id = c.cites_id
       WHERE citations_fts MATCH ? ${FILED}
       ORDER BY bm25(citations_fts, 3.0, 1.0, 0.4)
       LIMIT ?`
    )
    .all(match, LIMIT);

  printRows(rows);
  note(`\n${rows.length} row(s) matching: ${raw}`);
  note("Full-text covers the title, the author list used, and the snippet.");
  footer(db);
}

// ---------------------------------------------------------------------------
// pub
// ---------------------------------------------------------------------------

function pub(db) {
  const q = rest.join(" ").trim();
  if (!q) {
    throw new Error("Usage: node tools/query-catalog.js pub <title text or cites_id>");
  }

  const found = db
    .prepare(
      `SELECT cites_id, title, venue, year, cited_by_at_snapshot, exhibit_base,
              filed, status, pages_expected, pages_captured
       FROM publications
       WHERE cites_id = ?
          OR lower(title) LIKE '%' || lower(?) || '%'
          OR lower(exhibit_base) LIKE '%' || lower(?) || '%'
       ORDER BY filed DESC, cited_by_at_snapshot DESC
       LIMIT 1`
    )
    .get(q, q, q);

  if (!found) {
    console.log(`No publication matches: ${q}`);
    const near = db
      .prepare("SELECT cites_id, title FROM publications ORDER BY cited_by_at_snapshot DESC LIMIT 10")
      .all();
    console.log("\nMost-cited publications in the snapshot, for reference:");
    printRows(near);
    process.exitCode = 1;
    return;
  }

  console.log(`Cited publication : ${found.title}`);
  console.log(`Venue / year      : ${[found.venue, found.year].filter(Boolean).join(", ")}`);
  console.log(`cites_id          : ${found.cites_id}`);
  console.log(
    `Citations at snapshot: ${found.cited_by_at_snapshot}   exhibit: ${found.exhibit_base || "(none)"}   ` +
      `pages ${found.pages_captured}/${found.pages_expected}   ${found.filed ? "FILED" : "not filed"}`
  );

  // A publication with no filed exhibit has no rows to show under the default
  // filed-only filter. Showing nothing there would look like the work was never
  // captured, so widen to its archived/unfiled rows and say so on the line
  // above -- the exhibit still is not fileable, which the header already states.
  const scope = found.filed && !ALL ? "AND c.filed = 1" : "";
  if (!found.filed && !ALL) {
    console.log(
      "\nShowing its archived / unfiled capture rows, since nothing is filed for it."
    );
  }

  const rows = db
    .prepare(
      `SELECT
         c.page, c.row_index, substr(c.title, 1, 66) AS title,
         substr(c.authors_used, 1, 38) AS authors, c.status,
         CASE c.is_highlighted WHEN 1 THEN 'counted' ELSE '' END AS counted,
         c.confirm_state, c.work_type, c.patent_number,
         c.needs_attention AS attn, c.language_flag AS lang
       FROM citations c
       WHERE c.cites_id = ? ${scope}
       ORDER BY c.page, c.row_index`
    )
    .all(found.cites_id);

  console.log("");
  printRows(rows);

  const t = db
    .prepare(
      `SELECT COUNT(*) AS records,
              COALESCE(SUM(is_highlighted), 0) AS independent,
              COALESCE(SUM(CASE WHEN status = 'DEPENDENT' THEN 1 ELSE 0 END), 0) AS dependent,
              COALESCE(SUM(CASE WHEN status LIKE 'SELF%' THEN 1 ELSE 0 END), 0) AS self_cites,
              COALESCE(SUM(CASE WHEN status = 'REVIEW' THEN 1 ELSE 0 END), 0) AS review,
              COALESCE(SUM(CASE WHEN work_type IN ('patent','patent-application') THEN 1 ELSE 0 END), 0) AS patents
       FROM citations WHERE cites_id = ? ${scope}`
    )
    .get(found.cites_id);
  note(
    `\n${t.records} row(s): ${t.independent} independent, ${t.dependent} dependent, ` +
      `${t.self_cites} self, ${t.review} review, ${t.patents} patent(s).`
  );
  footer(db);
}

// ---------------------------------------------------------------------------
// review
// ---------------------------------------------------------------------------

function review(db) {
  // Anything a person still has to settle: an open status, a flag, or a work
  // type the classifier could not decide.
  const rows = db
    .prepare(
      `SELECT
         CASE WHEN c.status = 'REVIEW' THEN 'status'
              WHEN c.work_type = 'unknown' THEN 'work-type'
              ELSE 'flag' END AS why,
         c.status,
         c.confirm_state,
         substr(COALESCE(NULLIF(c.attention_reason,''), NULLIF(c.resolution,''),
                         NULLIF(c.corroboration_note,''),
                         NULLIF(c.work_type_evidence,'')), 1, 60) AS reason,
         substr(c.title, 1, 52) AS title,
         substr(p.title, 1, 26) AS cited,
         c.base, c.page, c.row_index
       FROM citations c
       LEFT JOIN publications p ON p.cites_id = c.cites_id
       WHERE (c.needs_attention = 1 OR c.status = 'REVIEW' OR c.work_type = 'unknown')
         ${ALL ? "" : "AND c.filed = 1"}
       ORDER BY why, c.base, c.page, c.row_index
       LIMIT ?`
    )
    .all(LIMIT);

  printRows(rows);

  const n = db
    .prepare(
      `SELECT COUNT(*) AS n FROM citations
       WHERE (needs_attention = 1 OR status = 'REVIEW' OR work_type = 'unknown')
         ${ALL ? "" : "AND filed = 1"}`
    )
    .get().n;
  note(`\n${n} row(s) awaiting attention. Widen with --limit=N, or include unfiled captures with --all.`);
  footer(db);
}

// Language editions within a citing list.
// Entries the language screen holds back, so the packet's adjusted English-only
// figures are reproducible and the entries a certified translation would have to
// cover are enumerable. would_count = 1 rows are the ones that look independent
// and corroborated and are withheld for language alone.
function nonEnglish(db) {
  const rows = db
    .prepare(
      `SELECT
         would_count,
         language_edition,
         reason,
         substr(title, 1, 56) AS title,
         status,
         confirm_state,
         substr(cited_work, 1, 24) AS cited,
         cid,
         base
       FROM v_non_english
       ${ALL ? "" : "WHERE filed = 1"}
       ORDER BY would_count DESC, cites_id, page, row_index
       LIMIT ?`
    )
    .all(LIMIT);

  if (!rows.length) {
    note("No non-English entries among filed citations.");
    footer(db);
    return;
  }
  printRows(rows);

  const g = db
    .prepare(
      `SELECT COUNT(*) AS total,
              SUM(would_count) AS withheld,
              SUM(language_edition) AS editions,
              COUNT(DISTINCT reason) AS reasons
       FROM v_non_english ${ALL ? "" : "WHERE filed = 1"}`
    )
    .get();
  note(
    `\n${g.total} non-English row(s) among these citations; ${g.withheld} would count but for ` +
      `language, ${g.editions} are a second-language copy of another row.`
  );
  note(
    "Per the guide these need a certified human translation plus affidavit before they " +
      "may be highlighted or counted; the user elected on 2026-11-01 not to obtain them."
  );
  footer(db);
}

function editions(db) {
  const rows = db
    .prepare(
      `SELECT
         substr(c.title, 1, 58) AS title,
         c.doi,
         c.is_language_edition,
         c.cid,
         c.duplicate_of,
         c.page,
         c.status,
         c.is_highlighted,
         c.language_flag,
         substr(c.cited_work, 1, 26) AS cited,
         substr(c.edition_note, 1, 48) AS note,
         c.base
       FROM v_language_editions c
       ${ALL ? "" : "WHERE c.filed = 1"}
       ORDER BY c.cites_id, c.edition_key, c.is_language_edition DESC, c.page
       LIMIT ?`
    )
    .all(LIMIT);

  if (!rows.length) {
    note(
      "No language editions among filed citations. Scholar lists one language " +
        "per citing paper here, or the duplicate shares its title and was " +
        "already merged as an ordinary duplicate version."
    );
    footer(db);
    return;
  }
  printRows(rows);

  const g = db
    .prepare(
      `SELECT COUNT(DISTINCT cites_id || edition_key) AS pairs,
              SUM(is_language_edition) AS suppressed
       FROM v_language_editions ${ALL ? "" : "WHERE filed = 1"}`
    )
    .get();
  note(
    `\n${g.pairs} citing list(s) show one article in two languages; ` +
      `${g.suppressed} row(s) held back as a language edition of another row.`
  );
  note("Documented only: no counted figure changes. The exhibit marks the article once.");
  footer(db);
}

// ---------------------------------------------------------------------------
// sql
// ---------------------------------------------------------------------------

// SELECT only. The database is also opened read-only, so this is defence in
// depth: a stray semicolon or a CTE that writes gets rejected here rather than
// reaching the engine.
function assertSelect(sql) {
  const trimmed = String(sql || "").trim().replace(/;\s*$/, "");
  if (!trimmed) throw new Error("Empty statement.");
  if (trimmed.includes(";")) {
    throw new Error("Only one statement at a time (semicolons are not accepted).");
  }
  if (!/^(select|with)\b/i.test(trimmed)) {
    throw new Error(
      'Only SELECT statements are allowed. This tool never modifies the catalog; ' +
        'rebuild it with: node tools/build-catalog.js'
    );
  }
  if (/\b(insert|update|delete|drop|alter|create|attach|detach|pragma|vacuum|reindex|replace)\b/i.test(trimmed)) {
    throw new Error("Statement contains a write or schema keyword and was refused.");
  }
  return trimmed;
}

function sql(db) {
  const statement = assertSelect(rest.join(" "));
  const rows = db.prepare(statement).all();
  printRows(rows.slice(0, LIMIT));
  if (rows.length > LIMIT) note(`\n(${rows.length} row(s) total, showing ${LIMIT}. Use --limit=N for more.)`);
}

// ---------------------------------------------------------------------------

function main() {
  const db = open();
  try {
    switch (cmd) {
      case "patents":
        return patents(db);
      case "editions":
        return editions(db);
      case "stats":
        return stats(db);
      case "search":
        return search(db);
      case "pub":
        return pub(db);
      case "review":
        return review(db);
      case "nonenglish":
        return nonEnglish(db);
      case "sql":
        return sql(db);
      case "tables":
        printRows(
          db
            .prepare(
              "SELECT type, name FROM sqlite_master WHERE name NOT LIKE 'sqlite_%' AND name NOT LIKE '%_data' AND name NOT LIKE '%_idx' AND name NOT LIKE '%_content' AND name NOT LIKE '%_docsize' AND name NOT LIKE '%_config' ORDER BY type, name"
            )
            .all()
        );
        return;
      default:
        throw new Error(
          `Unknown subcommand "${cmd}". Use: patents | editions | nonenglish | stats | search | pub | review | sql | tables`
        );
    }
  } finally {
    db.close();
  }
}

try {
  main();
} catch (e) {
  console.error(`[query] ${e.message}`);
  process.exitCode = 1;
}

#!/usr/bin/env node
/**
 * Record what a retrieval attempt found, for rows the script route could not fetch.
 *
 * `discover-pdfs.js` records its own outcomes. The browser stage and the plain-HTTP
 * helper (`fetch-downloads.js`) did not — they wrote files, and the queue kept the
 * state from the last automated look-up. That left two kinds of lie on the review
 * page: a row whose copy was retrieved still reading "Paywalled", and a row that was
 * tried through a logged-in session still reading "Not in OpenAlex" as though nobody
 * had gone further.
 *
 * What this writes, and what it refuses:
 *   - `discover_note` always, so the attempt and its result are on the record.
 *   - `discover_state` only when the note is about access (`paywalled`,
 *     `no-open-copy`, `not-in-indexes`, `lookup-failed`, `open-copy` — exactly the
 *     states `STATES` below allows). A Cloudflare wall, a proof-of-work page or a
 *     link to the wrong paper is recorded in the note while the state stays what it
 *     was. `has-pdf` is NOT settable here — that state means a file is on disk, and
 *     `sync-candidate-state.js` derives it from the `file` table rather than from a
 *     claim.
 *   - `pdf_file` only when told explicitly, and only to a path that exists.
 *
 * Usage:
 *   node scripts/record-retrieval.js --spec=outcomes.json            # dry run
 *   node scripts/record-retrieval.js --spec=outcomes.json --write
 *
 * The spec is a JSON array:
 *   [{ "row_uid": "cit-000562",
 *      "state": "no-open-copy",
 *      "note": "retrieved through the applicant's Chrome; the deposited file is the
 *               cwac018 article, filed under cit-000543 whose title it matches",
 *      "pdf_file": "pending-papers/cit-000543/01-article-Feizi-2022.pdf"  // optional
 *   }]
 */
"use strict";
const fs = require("fs");
const path = require("path");
const { PKT, PACKET_DB, openPacket } = require("./lib.js");

const argv = process.argv.slice(2);
const DRY = !argv.includes("--write");
const SPEC = (argv.find(a => a.startsWith("--spec=")) || "").slice(7);
if (!SPEC) {
  console.error('usage: node scripts/record-retrieval.js --spec=<file.json> [--write]');
  process.exit(2);
}

// Access outcomes a person can honestly assert after trying. These are exactly the
// states `lib.js` allows in its CHECK constraint, minus `has-pdf`, which is absent on
// purpose: that is a fact about the disk, and `sync-candidate-state.js` derives it
// from the `file` table rather than from a claim. Whatever happened goes in the note,
// so a Cloudflare wall is recorded as one in prose while the state stays `paywalled`.
const STATES = new Set(["paywalled", "no-open-copy", "not-in-indexes", "lookup-failed", "open-copy"]);

const spec = JSON.parse(fs.readFileSync(path.isAbsolute(SPEC) ? SPEC : path.join(process.cwd(), SPEC), "utf8"));
const db = openPacket();

const problems = [];
for (const e of spec) {
  if (!e.row_uid) problems.push("an entry has no row_uid");
  if (!e.note) problems.push(`${e.row_uid}: a retrieval outcome without a note is not evidence`);
  if (e.state && !STATES.has(e.state)) problems.push(`${e.row_uid}: '${e.state}' is not an access state`);
  if (e.pdf_file && !fs.existsSync(path.join(PKT, e.pdf_file))) {
    problems.push(`${e.row_uid}: pdf_file '${e.pdf_file}' does not exist under the packet folder`);
  }
  if (!db.prepare(`SELECT 1 FROM candidate WHERE row_uid=?`).get(e.row_uid)) {
    problems.push(`${e.row_uid}: not a candidate row`);
  }
}
if (problems.length) {
  for (const p of problems) console.error("  refusing: " + p);
  process.exit(1);
}

const iso = new Date().toISOString().slice(0, 19) + "Z";
console.log(`${spec.length} retrieval outcome(s)${DRY ? " (dry run)" : ""}:\n`);
for (const e of spec) {
  const cur = db.prepare(`SELECT discover_state s, discover_note n FROM candidate WHERE row_uid=?`).get(e.row_uid);
  const state = e.state || cur.s;
  const tail = ` | ${iso.slice(0, 10)}: ${e.note}`;
  const note = String(cur.n || "") + tail;
  const flag = cur.s === state ? "" : `   [state ${cur.s} -> ${state}]`;
  console.log(`  ${e.row_uid}${flag}\n      ${e.note}`);
}

if (DRY) {
  console.log("\ndry run — nothing written. Re-run with --write.");
  process.exit(0);
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const bak = PACKET_DB.replace(/\.sqlite$/, `.pre-retrieval-${stamp}.bak`);
fs.copyFileSync(PACKET_DB, bak);
const upd = db.prepare(`UPDATE candidate SET discover_state=?, discover_note=?,
    pdf_file=COALESCE(?, pdf_file), tried_at=? WHERE row_uid=?`);
db.exec("BEGIN");
try {
  for (const e of spec) {
    // `s` is needed here too: an entry that records only a note keeps its current
    // state, and reading just the note made `e.state || cur.s` undefined, which the
    // NOT NULL constraint on discover_state rejected.
    const cur = db.prepare(`SELECT discover_state s, discover_note n FROM candidate WHERE row_uid=?`).get(e.row_uid);
    upd.run(e.state || cur.s, String(cur.n || "") + ` | ${iso.slice(0, 10)}: ${e.note}`,
      e.pdf_file || null, iso, e.row_uid);
  }
  db.exec("COMMIT");
} catch (err) {
  db.exec("ROLLBACK");
  throw err;
}
console.log(`\nwrote ${spec.length} row(s). Backup: ${path.basename(bak)}`);
console.log("Next: node scripts/sync-candidate-state.js --write, then build-potential.js and build-status.js.");

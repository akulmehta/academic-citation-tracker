"use strict";
/**
 * Screen out a citation the record says is not independent.
 *
 * Until now a row like `cit-000511` was HELD: Scholar truncates its byline at ten
 * names, the packet's queued snapshot therefore read INDEPENDENT, and the record's
 * corroborating PubMed byline — "… Cooper MD, Cummings RD" — said otherwise. A
 * shared author is not a question waiting for a person; the applicant's instruction
 * on 2026-11-03 is that a dependent citation is screened out and not kept for
 * consideration at all.
 *
 * The Independent Citation Record decides independence and is never written to here
 * (§0). This tool only changes the packet's own `status`, `screen_reason` and
 * `screen_date`, and §4.5 keeps the row so the screening is on the record.
 *
 * Two things make a row not independent, and both are checked:
 *   1. the record's own `status` for that row_uid is not INDEPENDENT;
 *   2. the fullest byline either side names an author of the cited paper — the
 *      author-overlap test `promote-candidates.js` applies at intake, re-applied
 *      here because the record's byline may have been corroborated since.
 *
 * Dry run by default; `--write` backs up the database first and writes in one
 * transaction. A row already `included` is never touched — that would remove
 * evidence from counsel's document, which is the applicant's decision to make
 * through the packet, not a side effect of a sweep.
 *
 *   node scripts/screen-dependents.js            # report
 *   node scripts/screen-dependents.js --write    # apply
 *   node scripts/screen-dependents.js --list     # just the verdicts, no plan prose
 */
const fs = require("fs");
const path = require("path");
const { PACKET_DB, openCatalog, openPacket, sharesAuthor } = require("./lib.js");

const argv = process.argv.slice(2);
const DRY = !argv.includes("--write");
const BRIEF = argv.includes("--list");
const TODAY = new Date().toISOString().slice(0, 10);

/** `screen_reason` value for a row that is not independent. */
const REASON = "not independent";

function main() {
  const db = openPacket();
  const cat = openCatalog();

  const pubs = new Map(cat.prepare("SELECT cites_id, title, authors FROM publications").all().map(p => [p.cites_id, p]));
  // Only rows whose independence can be checked. A row with no catalog row is
  // reported, not screened: absence of a record is not a finding of dependence.
  const rows = db.prepare(`SELECT row_uid, folder_uid, status, cites_id, citing_title, citing_authors, pdf_file, screen_reason
                           FROM citation WHERE status <> 'included' ORDER BY row_uid`).all();
  if (!rows.length) {
    console.log("no held or screened-out rows to check.");
    db.close(); cat.close();
    return;
  }
  const uids = rows.map(r => r.row_uid);
  const catRows = new Map(cat.prepare(
    `SELECT row_uid, status, confirm_state, is_countable_independent, is_primary_copy,
            authors, full_authors, authors_used, external_authors, matched_pi, matched_former_pi, superseded_at
     FROM citations WHERE row_uid IN (${uids.map(() => "?").join(",")})`)
    .all(...uids).map(r => [r.row_uid, r]));
  cat.close();

  const verdicts = [];
  for (const r of rows) {
    const c = catRows.get(r.row_uid);
    if (!c) { verdicts.push({ ...r, verdict: "unresolved", why: "no active row in the citation record" }); continue; }
    const pub = pubs.get(r.cites_id);
    // The fullest byline either side. `full_authors` is the record's JSON array,
    // `authors_used` the same list comma-joined, `external_authors` the corroborating
    // PubMed/OpenAlex list that settled the row, then Scholar's rendered line.
    const byline = [c.full_authors, c.authors_used, c.external_authors, c.authors]
      .map(s => (s || "").replace(/^\[|\]$/g, "").replace(/","/g, ", "))
      .filter(Boolean)
      .sort((a, b) => b.length - a.length)[0] || "";
    const recordSays = c.status !== "INDEPENDENT";
    const shares = !!(pub && sharesAuthor(pub.authors, byline));
    if (recordSays || shares) {
      const bits = [];
      if (recordSays) bits.push(`record status ${c.status}${c.confirm_state ? ` (${c.confirm_state})` : ""}`);
      if (shares) bits.push(`byline shares an author with "${(pub.title || "").slice(0, 46)}"`);
      const pi = [...new Set([].concat(safe(c.matched_pi), safe(c.matched_former_pi)))].filter(Boolean);
      verdicts.push({
        ...r, verdict: "screen-out",
        why: bits.join("; "),
        detail: pi.length ? `names ${pi.join(", ")}` : "",
        confirm: c.confirm_state || "",
      });
      continue;
    }
    // A row the record calls independent but which is not the copy that stands, or
    // is superseded, is not a candidate either. It is reported rather than screened:
    // "does not stand" is about which listing represents the work, not about whether
    // the citation is independent, and the potential page already excludes it.
    const flags = [];
    if (c.is_countable_independent !== 1) flags.push("not countable on the record");
    if (c.is_primary_copy === 0) flags.push("a copy that does not stand for its work");
    if (c.superseded_at) flags.push(`superseded ${c.superseded_at}`);
    verdicts.push({ ...r, verdict: flags.length ? "review" : "keep", why: flags.join("; "), confirm: c.confirm_state || "" });
  }

  const out = verdicts.filter(v => v.verdict === "screen-out");
  // A row already screened out for this same reason is not work owed — report it
  // once as settled so re-running the tool says "nothing to screen out" instead of
  // listing the same row forever and making `--write` rewrite a note again.
  const already = out.filter(v => v.status === "screened-out" && v.screen_reason === REASON);
  const todo = out.filter(v => !(v.status === "screened-out" && v.screen_reason === REASON));
  if (BRIEF) {
    for (const v of verdicts) console.log(`${v.row_uid}  ${v.verdict.padEnd(11)} ${v.why}`);
    db.close();
    return;
  }
  console.log(`${rows.length} non-included row(s) re-read against the citation record.`);
  console.log(`${todo.length} to screen out as not independent${DRY ? " (dry run — nothing written)" : ""}:`);
  for (const v of todo) {
    console.log(`  ${v.row_uid}  ${(v.citing_title || "").slice(0, 62)}`);
    console.log(`            ${v.why}${v.detail ? " — " + v.detail : ""}`);
    if (v.pdf_file) console.log(`            PDF on file: ${v.pdf_file}`);
  }
  for (const v of already) {
    console.log(`  = ${v.row_uid} — already screened out "${REASON}" (${v.why}); nothing to do`);
  }
  for (const v of verdicts.filter(x => x.verdict === "unresolved")) {
    console.log(`  ! ${v.row_uid} — ${v.why}; left as ${v.status}`);
  }
  for (const v of verdicts.filter(x => x.verdict === "review")) {
    console.log(`  ? ${v.row_uid} — independent but ${v.why}; left as ${v.status}`);
  }

  if (!todo.length) { console.log("\nNothing to screen out."); db.close(); return; }
  if (DRY) {
    console.log("\nRe-run with --write. The database is backed up first.");
    console.log("Then run node scripts/relocate-pdfs.js --write to move any PDF out of papers/,");
    console.log("and re-render the packet and the status report.");
    db.close();
    return;
  }

  const bak = PACKET_DB.replace(/\.sqlite$/, `.pre-screen-dependents-${TODAY}.bak`);
  fs.copyFileSync(PACKET_DB, bak);
  const upd = db.prepare(`UPDATE citation SET status='screened-out', screen_reason=?, screen_date=?,
                            notes = COALESCE(notes,'') || ? WHERE row_uid=?`);
  const updCand = db.prepare(`UPDATE candidate SET screen_state='screened-out' WHERE row_uid=?`);
  db.exec("BEGIN");
  try {
    for (const v of todo) {
      upd.run(REASON, TODAY,
        ` Screened out ${TODAY} as not independent: ${v.why}. The Independent Citation Record was read, not changed.`,
        v.row_uid);
      updCand.run(v.row_uid);
    }
    db.exec("COMMIT");
  } catch (err) {
    db.exec("ROLLBACK");
    throw err;
  }
  console.log(`\nscreened out ${todo.length} row(s). Backup: ${path.basename(bak)}`);
  const still = db.prepare(`SELECT COUNT(*) c FROM citation WHERE status='held'`).get().c;
  console.log(`held rows now: ${still}.`);
  db.close();
}

/** Parse a JSON array column without letting a malformed value throw. */
function safe(v) {
  if (!v) return [];
  try { const p = JSON.parse(v); return Array.isArray(p) ? p : [String(v)]; } catch { return []; }
}
main();

#!/usr/bin/env node
/**
 * Record the applicant's decision on the tier a citation is FILED at.
 *
 * Why this is a tool and not an UPDATE in a terminal: a tier is a claim about
 * where the applicant's tool sits in someone else's paper, and the packet prints
 * it to counsel as fact. The value has to be traceable to a person and a date,
 * and it has to leave the row's own `tier`, `section` and `quote` intact — the
 * decision changes how the work is HEADLINED, it does not rewrite the evidence.
 *
 * Two situations call for it:
 *   - A folder holds several citations of one article and only some are Methods
 *     uses. The work stands at its strongest tier (lib.headlineTier); a recorded
 *     decision on the weaker sibling says the mismatch was seen and chosen.
 *   - A PDF was filed in one folder but, on re-reading, the tool is run in
 *     Materials and Methods (cit-000542, van der Wal). The decision overrides the
 *     folder's implied tier.
 *
 * Nothing here re-reads a PDF or the citation catalog. The applicant's reading of
 * the published article is the evidence; this records who decided, when, and why.
 *
 * Usage:
 *   node scripts/record-tier-decision.js --row=cit-000542 --tier=A --note="..."
 *   node scripts/record-tier-decision.js --row=cit-000542 --tier=A --note="..." --write
 *   node scripts/record-tier-decision.js --list
 *   node scripts/record-tier-decision.js --revert --row=cit-000542 --write
 */
const fs = require("fs");
const path = require("path");
const { openPacket, PACKET_DB } = require("./lib.js");

const DRY = !process.argv.includes("--write");
const opt = (name) => {
  const a = process.argv.find((s) => s.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : null;
};
const TODAY = new Date().toISOString().slice(0, 10);
const TIERS = new Set(["A", "B", "C", "D"]);

function backup(db) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
  const dest = path.join(path.dirname(PACKET_DB), `notable-citations.pre-tier-decision-${stamp}.bak`);
  db.close();
  fs.copyFileSync(PACKET_DB, dest);
  console.log(`backed up to ${path.basename(dest)}`);
  return openPacket();
}

function list(db) {
  const rows = db.prepare(
    `SELECT row_uid, tier, tier_decision, tier_decided_on, tier_decided_note
       FROM citation WHERE tier_decision IS NOT NULL ORDER BY row_uid`
  ).all();
  if (!rows.length) return console.log("No tier decisions recorded.");
  console.log("row_uid      filed_tier  decision  on          note");
  for (const r of rows) {
    console.log(
      `${r.row_uid}  ${String(r.tier || "-").padEnd(10)} ${String(r.tier_decision).padEnd(9)} ` +
      `${String(r.tier_decided_on || "-").padEnd(11)} ${r.tier_decided_note || ""}`
    );
  }
}

function main() {
  let db = openPacket();
  if (process.argv.includes("--list")) return list(db);

  const row = opt("row");
  if (!row) {
    console.error("Specify --row=cit-NNNNNN (repeat the command per row).");
    process.exitCode = 1;
    return;
  }
  const r = db.prepare("SELECT row_uid, folder_uid, tier, section FROM citation WHERE row_uid=?").get(row);
  if (!r) {
    console.error(`Row ${row} is not in the citation table.`);
    process.exitCode = 1;
    return;
  }

  if (process.argv.includes("--revert")) {
    console.log(`${DRY ? "[dry] " : ""}Clear tier decision on ${row} (was ${r.tier_decision || "none"}).`);
    if (DRY) return;
    db.prepare(`UPDATE citation SET tier_decision=NULL, tier_decided_on=NULL, tier_decided_note=NULL WHERE row_uid=?`).run(row);
    console.log(`cleared ${row}`);
    return;
  }

  const tier = (opt("tier") || "").trim().toUpperCase();
  const note = (opt("note") || "").trim();
  if (!TIERS.has(tier)) {
    console.error(`--tier must be one of A, B, C, D (got "${tier}").`);
    process.exitCode = 1;
    return;
  }
  if (!note) {
    console.error("A decision needs --note=\"...\" — an undated, unexplained tier override is exactly what a filing should not contain.");
    process.exitCode = 1;
    return;
  }

  console.log(`${row} (folder ${r.folder_uid}): row tier ${r.tier || "-"} -> filed at tier ${tier}`);
  console.log(`  section on file: ${r.section || "—"}`);
  console.log(`  note: ${note}`);
  if (DRY) {
    console.log(`\n[dry run] nothing written. Re-run with --write.`);
    return;
  }
  db = backup(db);
  db.prepare(
    `UPDATE citation SET tier_decision=?, tier_decided_on=?, tier_decided_note=? WHERE row_uid=?`
  ).run(tier, TODAY, note, row);
  console.log(`\nwrote tier_decision=${tier} on ${row}`);
}

main();

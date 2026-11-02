// Offline proof that the catalog merge is non-destructive and idempotent.
// Run: node tools/test-catalog-merge.js
//
// Why this exists: row_uid values are quoted in review sheets, and the whole
// point of schema v4 is that a quoted identifier still means the same row next
// month. Two properties have to hold every time the builder runs, and neither
// is visible in a summary line:
//
//   1. NOTHING IS DELETED. Every row present before a run is present after it,
//      and every row_uid still points at the same (base, page, row_index).
//   2. A SECOND RUN IS A NO-OP. The merge plan finds nothing to insert, update,
//      or retire, so rebuilding cannot quietly churn the store.
//
// The first section asserts both against the real Database/citation-catalog.sqlite
// by running the builder twice for real. The second section exercises the guard
// against fabricated plans, because the case that matters -- a plan that would
// lose a row or re-point an identifier -- cannot be produced from the current
// data without deleting evidence first.
//
// Read-only except for the two builder runs, which are the operation under test.
// A verified snapshot is taken by the builder itself before it writes anything,
// and lands in Database/Backups.

const { execFileSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");
const {
  DB_PATH,
  collect,
  loadExisting,
  planMerge,
  guardMerge,
  rowUidForId,
  keyOf,
} = require("./build-catalog");

let pass = 0;
let fail = 0;

function check(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) {
    pass++;
    console.log(`  ok   ${name}`);
  } else {
    fail++;
    console.log(`  FAIL ${name}`);
    console.log(`         want: ${JSON.stringify(want)}`);
    console.log(`         got:  ${JSON.stringify(got)}`);
  }
}

function runBuilder(args) {
  // stdio is captured rather than inherited so the plan lines can be asserted
  // on; the run is printed only when something in it needs to be seen.
  return execFileSync(process.execPath, [path.join(__dirname, "build-catalog.js"), ...args], {
    encoding: "utf8",
    cwd: path.resolve(__dirname, ".."),
  });
}

function readState() {
  const db = new DatabaseSync(DB_PATH, { readOnly: true });
  try {
    return {
      total: db.prepare("SELECT COUNT(*) AS n FROM citations").get().n,
      active: db
        .prepare("SELECT COUNT(*) AS n FROM citations WHERE filed = 1 AND superseded_at = ''")
        .get().n,
      // Every row, not a sample. The claim being tested is "not a single row
      // moved", and a sample cannot prove that -- it can only fail to notice.
      byUid: new Map(
        db
          .prepare("SELECT row_uid, base, page, row_index FROM citations WHERE row_uid <> ''")
          .all()
          .map((r) => [r.row_uid, keyOf(r.base, r.page, r.row_index)])
      ),
      dupUids: db
        .prepare(
          "SELECT COUNT(*) AS n FROM (SELECT row_uid FROM citations WHERE row_uid <> '' GROUP BY row_uid HAVING COUNT(*) > 1)"
        )
        .get().n,
      blankUids: db.prepare("SELECT COUNT(*) AS n FROM citations WHERE row_uid = ''").get().n,
    };
  } finally {
    db.close();
  }
}

if (!fs.existsSync(DB_PATH)) {
  console.error(`No catalog at ${DB_PATH}. Run: node tools/build-catalog.js --write`);
  process.exitCode = 1;
} else {
  console.log("Real store: two consecutive builder runs");

  const before = readState();
  check("row_uid present on every row", before.blankUids, 0);
  check("row_uid unique across the table", before.dupUids, 0);

  const first = runBuilder(["--write"]);
  const afterFirst = readState();
  const lost = [...before.byUid.entries()].filter(([uid, k]) => afterFirst.byUid.get(uid) !== k);
  check("run 1: no row deleted", afterFirst.total >= before.total, true);
  check("run 1: no row_uid lost or re-pointed", lost.length, 0);

  // A settled store must not ask for work. This pins a real defect found on
  // 2026-11-02: v_pub_stats was missing from the migration's view list while
  // needsMigration() checks every view in the DDL, so every run reported the same
  // view as stale, took a fresh multi-megabyte snapshot to fix it, and stayed
  // stale. Two runs inside one second then collided on the snapshot filename and
  // the builder died outright. A run that reports pending schema work twice is
  // either not fixing it or not checking it correctly.
  const wantsWork = (out) => /Schema needs work in place/.test(out);
  check("run 1: schema reported settled", wantsWork(first), false);

  const second = runBuilder(["--write"]);
  const afterSecond = readState();
  const moved = [...afterFirst.byUid.entries()].filter(
    ([uid, k]) => afterSecond.byUid.get(uid) !== k
  );
  check("run 2: row count unchanged", afterSecond.total, afterFirst.total);
  check("run 2: active count unchanged", afterSecond.active, afterFirst.active);
  check("run 2: no row_uid re-pointed", moved.length, 0);
  check("run 2: schema reported settled", wantsWork(second), false);

  // The no-op claim, read off the builder's own plan line rather than inferred
  // from counts -- a run could leave the count alone while rewriting rows.
  const planLine = (out) => (out.match(/Merge plan: ([^\n]+?)\.\n/) || [])[1] || "";
  const noop = new RegExp(
    `^0 insert\\(s\\), 0 update\\(s\\), ${afterSecond.total} unchanged, 0 retained untouched$`
  );
  check("run 2: plan is a no-op", noop.test(planLine(second)), true);
  if (!noop.test(planLine(second))) {
    console.log(`         actual plan: ${planLine(second)}`);
    console.log(`         run 1 plan : ${planLine(first)}`);
  }
  check("run 2: reconciliation reports no DIFF", /DIFF/.test(second), false);
  check("run 2: totals reconcile", /Totals reconcile/.test(second), true);
}

// ---------------------------------------------------------------------------
// Fabricated plans: the cases the guard exists for
// ---------------------------------------------------------------------------
//
// A throwaway database built from DDL is not needed to test the decision, only
// to count rows in it. planMerge and guardMerge are pure apart from that count,
// so the scenarios run against the real file read-only and never write.

console.log("\nGuard: refuses a plan that would lose a row or re-point an identifier");

const data = collect();
const rows = data.citations;
const sample = rows.slice(0, 5);

// Baseline: the real rows, merged over an empty table, are safe and mint a
// fresh identifier each.
{
  const plan = planMerge(new Map(), sample, 1);
  check("fresh insert: every row planned as an insert", plan.inserts.length, sample.length);
  check("fresh insert: nothing retained", plan.retained.length, 0);
  check(
    "fresh insert: identifiers minted from the id sequence",
    plan.inserts.map((i) => i.row_uid),
    sample.map((_, i) => rowUidForId(i + 1))
  );
}

// A row the reports no longer mention is KEPT. This is the property that makes
// an archive move or a stray rebuild non-destructive.
{
  const existing = new Map();
  for (const r of sample) existing.set(keyOf(r.base, r.page, r.row_index), { ...r, row_uid: rowUidForId(1) });
  const ghost = { base: "a-capture-that-went-away", page: 1, row_index: 0, row_uid: rowUidForId(999) };
  existing.set(keyOf(ghost.base, 1, 0), ghost);
  const plan = planMerge(existing, sample, 100);
  check("vanishing report: the row is retained, not deleted", plan.retained.length, 1);
  check("vanishing report: retained row keeps its uid", plan.retained[0].row_uid, rowUidForId(999));
  check("vanishing report: no insert collides with it", plan.inserts.length, 0);
}

// The guard itself, against the live table.
{
  const db = new DatabaseSync(DB_PATH, { readOnly: true });
  try {
    const live = db
      .prepare("SELECT row_uid, base, page, row_index FROM citations WHERE row_uid <> '' LIMIT 3")
      .all();

    // 1. A plan that would re-use an existing identifier for a different row.
    const hijack = planMerge(
      new Map(),
      [{ ...sample[0], base: "brand-new-base", page: 1, row_index: 0 }],
      Number(live[0].row_uid.replace("cit-", ""))
    );
    const g1 = guardMerge(db, hijack);
    check("guard: refuses to re-use a quoted row_uid", g1.reasons.length > 0, true);
    check("guard: names the identifier at risk", /row_uid/.test(g1.reasons.join(" ")), true);

    // 2. Two report entries claiming one page position. Silent overwrite would
    //    mean one of them owns a quoted identifier.
    const dupe = planMerge(
      new Map(),
      [sample[0], { ...sample[1], base: sample[0].base, page: sample[0].page, row_index: sample[0].row_index }],
      5000
    );
    const g2 = guardMerge(db, dupe);
    check("guard: refuses a natural-key collision", g2.reasons.join(" ").includes("natural key"), true);

    // 3. An update that would move a row to a different position.
    const target = db
      .prepare(
        `SELECT * FROM citations WHERE row_uid <> '' AND row_index IS NOT NULL
         ORDER BY id LIMIT 1`
      )
      .get();
    const movedPlan = {
      inserts: [],
      collisions: [],
      retained: [],
      updates: [
        {
          existing: target,
          row: { ...target, base: "some-other-capture", page: 9, row_index: 9 },
        },
      ],
    };
    const g3 = guardMerge(db, movedPlan);
    check("guard: refuses an update that moves a row", g3.reasons.join(" ").includes("different position"), true);

    // 4. A row with no identifier at all cannot be merged over, because the
    //    merge would have nothing durable to preserve.
    const blankPlan = {
      inserts: [],
      collisions: [],
      retained: [],
      updates: [{ existing: { ...target, row_uid: "" }, row: target }],
    };
    const g4 = guardMerge(db, blankPlan);
    check("guard: refuses a row with no row_uid", g4.reasons.join(" ").includes("no row_uid"), true);

    // 5. The honest plan over the real reports must pass, or the guard is just
    //    a refusal to ever write.
    const honest = planMerge(loadExisting(db), rows, db.prepare("SELECT COALESCE(MAX(id),0) AS m FROM citations").get().m + 1);
    const g5 = guardMerge(db, honest);
    check("guard: the real merge is allowed", g5.reasons, []);
    check("guard: the real merge keeps every row", g5.projected >= g5.before, true);
  } finally {
    db.close();
  }
}

// ---------------------------------------------------------------------------
// The ledger's disagreement gate
// ---------------------------------------------------------------------------
//
// Under the durable-store model a mismatch between the store and the report-
// derived figures is a defect, not a choice of source. build-ledger.js must
// therefore refuse to write. The real ledger passes, which is asserted by
// running it; the refusal is asserted with a fabricated mismatch.

console.log("\nLedger gate: a store/report disagreement stops the report");

{
  const { build, findDefects } = require("./build-ledger");
  const ledger = build();
  check("ledger: the real figures agree", findDefects(ledger), []);

  const fabricated = {
    rows: ledger.rows,
    orphanCitesIds: [],
    diffs: [
      {
        cites_id: "abc123",
        publication: "A paper whose rows moved",
        figure: "independent",
        store: 41,
        reports: 40,
      },
    ],
  };
  const lines = findDefects(fabricated);
  check("ledger: a per-figure mismatch is reported", lines.length, 1);
  check(
    "ledger: the message names both sides",
    /store 41 vs reports 40/.test(lines[0]),
    true
  );

  const orphanOnly = { rows: [], orphanCitesIds: ["zzz999"], diffs: [] };
  check(
    "ledger: store rows outside the snapshot list are reported",
    /cites=zzz999/.test(findDefects(orphanOnly).join(" ")),
    true
  );
}

// ---------------------------------------------------------------------------
// Fresh schema: DDL versus the columns the merge writes
// ---------------------------------------------------------------------------
//
// The merge builds its INSERT from COLUMNS, so DDL and COLUMNS must describe the
// same table exactly. They are maintained separately and a mismatch is invisible
// on a migrated file, which already has every column -- it only bites when a
// store is created from scratch, which is precisely when nobody is watching. On
// 2026-11-02 a line-continuation slip had swallowed origin_dir into a SQL
// comment: the migrated database was fine, and a fresh build would have failed.

console.log("\nFresh schema: DDL declares every column the merge writes");

{
  const os = require("os");
  const { DDL, COLUMNS, ddlViewNames } = require("./build-catalog");
  const tmp = path.join(
    os.tmpdir(),
    `eb1a-ddl-check-${process.pid}-${Date.now()}.sqlite`
  );
  const tdb = new DatabaseSync(tmp);
  try {
    tdb.exec(DDL);
    const declared = tdb.prepare("SELECT name FROM pragma_table_info('citations')").all().map((r) => r.name);
    const missing = COLUMNS.filter((c) => !declared.includes(c));
    const extra = declared.filter((c) => !COLUMNS.includes(c));
    check("DDL declares every COLUMNS entry", missing, []);
    check("COLUMNS holds nothing DDL lacks", extra, []);
    check("citations has a row_uid that is UNIQUE NOT NULL",
      /\brow_uid\s+TEXT\s+UNIQUE\s+NOT NULL/i.test(
        tdb.prepare("SELECT sql FROM sqlite_master WHERE name='citations'").get().sql
      ),
      true
    );
    // The natural key must be a UNIQUE index, not merely present: SQLite treats
    // each NULL as distinct, so a plain index would let two rows claim one slot.
    const idx = tdb
      .prepare(
        `SELECT i.name, m.sql
           FROM pragma_index_list('citations') i
           JOIN sqlite_master m ON m.name = i.name
          WHERE i."unique" = 1`
      )
      .all();
    const natural = idx.find((i) => /base/.test(i.sql || "") && /row_index/.test(i.sql || ""));
    check("natural key (base, page, row_index) is UNIQUE", Boolean(natural), true);

    const views = new Set(
      tdb.prepare("SELECT name FROM sqlite_master WHERE type = 'view'").all().map((r) => r.name)
    );
    check("every view DDL defines exists", ddlViewNames().filter((v) => !views.has(v)), []);
    // A view that fails to parse is not detected until something queries it, so
    // query each one here with LIMIT 1.
    for (const name of ddlViewNames()) {
      let err = "";
      try {
        tdb.prepare(`SELECT * FROM ${name} LIMIT 1`).all();
      } catch (e) {
        err = e.message;
      }
      check(`view ${name} is queryable`, err, "");
    }
  } finally {
    tdb.close();
    for (const suffix of ["", "-wal", "-shm"]) {
      try {
        fs.rmSync(tmp + suffix, { force: true });
      } catch {
        /* a locked sidecar is not worth failing the run over */
      }
    }
  }
}

console.log(
  fail === 0
    ? `\n${pass} passed, all good`
    : `\n${pass} passed, ${fail} FAILED`
);
process.exitCode = fail ? 1 : 0;

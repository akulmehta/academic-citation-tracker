// throwaway probe - delete after use
// Resolve, against the store's OWN identity columns (not dashboard titles,
// which have Scholar markers stripped), what each basis actually counts.
const { DatabaseSync } = require("node:sqlite");
const { DB_PATH } = require("./build-catalog");
const db = new DatabaseSync(DB_PATH, { readOnly: true });
const ACTIVE = `c.filed = 1 AND (c.superseded_at = '' OR c.superseded_at IS NULL)`;
const one = (sql) => db.prepare(sql).get();

const marked = one(`SELECT COUNT(*) n FROM citations c WHERE ${ACTIVE} AND c.is_highlighted = 1`).n;
const markedPrimary = one(`SELECT COUNT(*) n FROM citations c WHERE ${ACTIVE} AND c.is_highlighted = 1 AND c.is_primary_copy = 1 AND (c.duplicate_of = '' OR c.duplicate_of IS NULL)`).n;
const distinctIdent = one(`SELECT COUNT(*) n FROM (SELECT DISTINCT COALESCE(NULLIF(c.same_work_key,''), c.work_key) k FROM citations c WHERE ${ACTIVE} AND c.is_highlighted = 1 AND c.is_primary_copy = 1 AND (c.duplicate_of = '' OR c.duplicate_of IS NULL))`).n;
const distinctCiteIdent = one(`SELECT COUNT(*) n FROM (SELECT DISTINCT c.cites_id, COALESCE(NULLIF(c.same_work_key,''), c.work_key) k FROM citations c WHERE ${ACTIVE} AND c.is_highlighted = 1)`).n;

console.log("DB:", DB_PATH);
console.log("marked rows (exhibit marks)          :", marked);
console.log("marked AND primary copy              :", markedPrimary);
console.log("distinct (cites_id, ident) of marked :", distinctCiteIdent);
console.log("distinct ident among marked primary  :", distinctIdent);

const dupGroups = db.prepare(`
  SELECT c.cites_id, COALESCE(NULLIF(c.same_work_key,''), c.work_key) AS k,
         COUNT(*) AS n, GROUP_CONCAT(c.row_uid) AS uids,
         SUM(c.is_primary_copy) AS primaries, MAX(c.title) AS title
    FROM citations c
   WHERE ${ACTIVE} AND c.is_highlighted = 1
   GROUP BY c.cites_id, k HAVING COUNT(*) > 1`).all();
console.log("\nmarked groups with >1 row            :", dupGroups.length);
console.log("extra rows those groups contribute   :", dupGroups.reduce((s, r) => s + r.n - 1, 0));
for (const r of dupGroups)
  console.log(`  ${r.n}x prim=${r.primaries}  ${r.uids}  ${String(r.title).slice(0, 55)}`);

const perPaperAcrossWorks = db.prepare(`
  SELECT COALESCE(NULLIF(c.same_work_key,''), c.work_key) AS k,
         COUNT(DISTINCT c.cites_id) AS works, COUNT(*) AS primaries
    FROM citations c
   WHERE ${ACTIVE} AND c.is_highlighted = 1 AND c.is_primary_copy = 1
     AND (c.duplicate_of = '' OR c.duplicate_of IS NULL)
   GROUP BY k`).all();
const papers = perPaperAcrossWorks.length;
const extras = perPaperAcrossWorks.reduce((s, r) => s + r.primaries - 1, 0);
console.log("\n--- the decisive numbers ---");
console.log("distinct independent citing PAPERS   :", papers);
console.log("  of which have >1 primary row       :", perPaperAcrossWorks.filter((r) => r.primaries > 1).length);
console.log("  extra primary rows from those      :", extras);
console.log("papers + extras                      :", papers + extras);

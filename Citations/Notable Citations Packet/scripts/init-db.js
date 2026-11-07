"use strict";
/**
 * Creates/updates the packet's own SQLite database. Idempotent.
 *
 * `CREATE TABLE IF NOT EXISTS` never adds a column to a table that already
 * exists, so columns added after the first release are ALTERed in here. A packet
 * database the user already has must gain them without losing rows.
 */
const { openPacket, SCHEMA, PACKET_DB } = require("./lib");

/** Columns added after the first release, keyed by table. */
const ADDITIONS = {
  candidate: [
    ["pdf_file", "TEXT"],
    ["pdf_bytes", "INTEGER"],
    ["year", "TEXT"],
    ["senior_author", "TEXT"],
    ["senior_basis", "TEXT"],
    ["institutions", "TEXT"],
    ["country", "TEXT"],
    ["section_found", "TEXT"],
    ["quote", "TEXT"],
    ["quote_page", "TEXT"],
    ["screen_state", "TEXT NOT NULL DEFAULT 'unscreened'"],
  ],
};

const db = openPacket();

// The candidate table gained CHECK constraints after the first release, and
// SQLite cannot add a constraint to an existing table. Rebuilding it is safe
// only while it holds no rows, so that is the condition; a populated queue is
// left exactly as it is.
const candRows = db.prepare(`SELECT COUNT(*) c FROM candidate`).get().c;
const candSql = db.prepare(`SELECT sql FROM sqlite_master WHERE type='table' AND name='candidate'`).get()?.sql || "";
if (!candRows && !/CHECK/.test(candSql)) {
  db.exec("DROP TABLE candidate");
  console.log("rebuilt empty candidate table with its CHECK constraints");
}

db.exec(SCHEMA);

for (const [table, cols] of Object.entries(ADDITIONS)) {
  const have = new Set(db.prepare(`SELECT name FROM pragma_table_info(?)`).all(table).map(r => r.name));
  for (const [name, decl] of cols) {
    if (have.has(name)) continue;
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${decl}`);
    console.log(`added ${table}.${name}`);
  }
}

const have = db.prepare(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`).all().map(r => r.name);
console.log("packet database:", PACKET_DB);
console.log("tables:", have.join(", "));
for (const t of ["citation", "file", "candidate"]) {
  const n = db.prepare(`SELECT COUNT(*) c FROM ${t}`).get().c;
  console.log(`  ${t}: ${n} rows`);
}
db.close();

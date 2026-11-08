const L = require("./lib.js");
const db = L.openPacket();
console.log(
  "TABLES:",
  db
    .prepare("SELECT name FROM sqlite_master WHERE type='table'")
    .all()
    .map((r) => r.name)
    .join(" "),
);
console.log(
  "\ncitation cols:",
  db
    .prepare("PRAGMA table_info(citation)")
    .all()
    .map((c) => c.name)
    .join(" "),
);
const hasCandidate = db
  .prepare("SELECT name FROM sqlite_master WHERE name='candidate'")
  .get();
if (hasCandidate)
  console.log(
    "\ncandidate cols:",
    db
      .prepare("PRAGMA table_info(candidate)")
      .all()
      .map((c) => c.name)
      .join(" "),
  );

const rows = db
  .prepare(
    `SELECT c.row_uid, c.status, c.access, c.folder_uid, c.title, c.doi, c.oa_url,
            (SELECT COUNT(*) FROM file f WHERE f.folder_uid = c.folder_uid) nfiles
       FROM citation c
      ORDER BY c.status, c.row_uid`,
  )
  .all();
console.log("\nstatus  access         files uid        title");
for (const r of rows)
  console.log(
    `${String(r.status).padEnd(12)} ${String(r.access || "-").padEnd(15)} ${String(r.nfiles)}  ${r.row_uid}  ${String(r.title || "").slice(0, 60)}`,
  );

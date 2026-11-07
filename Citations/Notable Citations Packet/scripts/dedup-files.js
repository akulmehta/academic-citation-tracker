// Collapse byte-identical PDFs to one stored copy.
//
// Scholar lists one work more than once against a cited paper — a journal record
// beside its repository copy or preprint. When both are downloaded, the packet
// would hold two folders and two PDFs for one paper, which reads as two citations
// to two articles. The bytes settle the question outright: identical files are
// the same document, no inference required.
//
// The copy under the lowest row_uid is kept, because that is the row the importer
// would have chosen as the folder anyway. The others keep their citation row — the
// citation is real, it is simply evidenced by the file that stands — and point at
// it, so nothing is deleted and the trail stays.
//
// This is NOT the same as the record's same-work fold, and does not replace it:
// that decides whether two differently-presented rows are one work, which needs
// evidence. Byte equality is only ever a fact about files already in this packet.

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { PKT, openPacket } = require("./lib");

const argv = process.argv.slice(2);
const DRY = argv.includes("--dry");

function sha(abs) {
  return crypto.createHash("sha256").update(fs.readFileSync(abs)).digest("hex");
}

function main() {
  const db = openPacket();
  const files = db.prepare(`SELECT * FROM file ORDER BY folder_uid, file`).all()
    .map(f => ({ ...f, abs: path.join(PKT, f.file) }))
    .filter(f => fs.existsSync(f.abs));

  const byHash = new Map();
  for (const f of files) {
    const h = sha(f.abs);
    if (!byHash.has(h)) byHash.set(h, []);
    byHash.get(h).push(f);
  }

  const groups = [...byHash.values()].filter(g => g.length > 1);
  console.log(`${files.length} file(s) in ${new Set(files.map(f => f.folder_uid)).size} folder(s); ${groups.length} identical group(s)`);

  for (const g of groups.sort((a, b) => a[0].folder_uid.localeCompare(b[0].folder_uid))) {
    const [keep, ...rest] = g.sort((a, b) => a.folder_uid.localeCompare(b.folder_uid));
    console.log(`\n  keep ${keep.file} (${(fs.statSync(keep.abs).size / 1024).toFixed(0)} KB)`);
    for (const dup of rest) {
      console.log(`  fold ${dup.file}  [${dup.folder_uid}]`);
      if (DRY) continue;
      // The duplicate's citation row survives and points at the standing file.
      db.prepare(`UPDATE citation SET pdf_file=?, notes = COALESCE(notes,'') || ? WHERE folder_uid=?`)
        .run(keep.file, ` File is byte-identical to ${keep.file}; stored once under ${keep.folder_uid}.`, dup.folder_uid);
      db.prepare(`UPDATE candidate SET pdf_file=?, discover_note = COALESCE(discover_note,'') || ? WHERE row_uid=?`)
        .run(keep.file, ` Stored once under ${keep.folder_uid}.`, dup.folder_uid);
      db.prepare(`DELETE FROM file WHERE folder_uid=? AND file=?`).run(dup.folder_uid, dup.file);
      fs.rmSync(dup.abs);
      const dir = path.dirname(dup.abs);
      if (fs.existsSync(dir) && fs.readdirSync(dir).length === 0) fs.rmdirSync(dir);
    }
  }
  if (DRY) console.log("\n[dry run] nothing changed");
  db.close();
}
main();

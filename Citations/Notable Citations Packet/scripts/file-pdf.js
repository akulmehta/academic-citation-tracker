"use strict";
/**
 * File a PDF the applicant already has into a citation's folder.
 *
 * The importer picks up whatever sits under `Citations/In Methods/` and friends.
 * This covers the other case: one work, one PDF, named after the folder that is
 * already in the database — which is what happens when a row turns out to be in
 * the packet with nothing beside it, or when the applicant supplies a copy after
 * the bulk import.
 *
 * Nothing is decided here. The tool copies the file, checks it really is a PDF,
 * checks the article's title actually appears in the extracted text, and records
 * the row. It refuses to file a PDF whose text does not contain the title it is
 * being filed against — a wrong paper in an evidence folder is the one mistake
 * that cannot be caught later.
 *
 *   node scripts/file-pdf.js --folder=cit-000621 --src="Citations/In Methods/x.pdf"
 *   … --write                              (also: --role=preprint --date=2023-04-29)
 */
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
const { PKT, REPO, PACKET_DB, PDF_ROOT, openPacket, folderRoots, storageDir } = require("./lib.js");

const argv = process.argv.slice(2);
const DRY = !argv.includes("--write");
const opt = n => (argv.find(a => a.startsWith(`--${n}=`)) || "").split("=").slice(1).join("=") || null;

const FOLDER = opt("folder");
const SRC = opt("src");
const ROLE = opt("role") || "article";
const SHOWS = opt("date");
const BASIS = opt("basis") || (SHOWS ? "Applicant-supplied copy; date recorded by hand" : null);
const CITED = ROLE === "webpage" ? 0 : 1;

const PDF_MAGIC = Buffer.from("%PDF");

/** Extract the whole text of a PDF. */
async function fileText(abs) {
  const build = path.join(PKT, "node_modules", "pdfjs-dist");
  const lib = await import(pathToFileURL(path.join(build, "legacy", "build", "pdf.mjs")).href);
  const doc = await lib.getDocument({
    data: new Uint8Array(fs.readFileSync(abs)),
    verbosity: 0,
    standardFontDataUrl: pathToFileURL(path.join(build, "standard_fonts") + path.sep).href,
    cMapUrl: pathToFileURL(path.join(build, "cmaps") + path.sep).href,
  }).promise;
  let all = "";
  for (let p = 1; p <= doc.numPages; p++) {
    const tc = await (await doc.getPage(p)).getTextContent();
    all += tc.items.map(it => ("str" in it ? it.str : "")).join(" ") + "\n";
  }
  await doc.destroy();
  return all;
}

// §5.1: NN-role-Surname[-date].pdf. The sequence number is the next free one in
// the folder, so a timeline set stays in the order it was filed.
function targetName(rows, surname, year) {
  const used = new Set(rows
    .map(r => String(r.file).match(/^(\d+)-/))
    .filter(Boolean)
    .map(m => Number(m[1])));
  let n = 1;
  while (used.has(n)) n++;
  const slug = String(surname || "article").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^A-Za-z]/g, "");
  const date = SHOWS || year;
  const tail = date ? `-${String(date).replace(/[^0-9-]/g, "").replace(/-+$/, "")}` : "";
  return `${String(n).padStart(2, "0")}-${ROLE}-${slug}${tail}.pdf`;
}

async function main() {
  if (!FOLDER || !SRC) {
    console.error("usage: node scripts/file-pdf.js --folder=<folder_uid> --src=<path under Citations/> [--role=article] [--date=YYYY-MM-DD] [--write]");
    process.exitCode = 2;
    return;
  }
  const db = openPacket();
  const rows = db.prepare(`SELECT * FROM citation WHERE folder_uid=? ORDER BY is_main DESC, row_uid`).all(FOLDER);
  if (!rows.length) { console.error(`no citation row has folder_uid ${FOLDER}`); process.exitCode = 1; return; }
  const main = rows.find(r => r.is_main) || rows[0];

  const abs = path.isAbsolute(SRC) ? SRC : path.join(PDF_ROOT, SRC);
  if (!fs.existsSync(abs)) { console.error(`source not found: ${abs}`); process.exitCode = 1; return; }
  const buf = fs.readFileSync(abs);
  if (!buf.subarray(0, 4).equals(PDF_MAGIC)) { console.error(`refusing: ${abs} does not start with %PDF`); process.exitCode = 1; return; }

  const name = targetName(rows, main.citing_senior_author, main.citing_year);
  // The folder's status decides which storage root it goes into (§5.1): a work
  // nobody has confirmed yet is not counsel's evidence and does not belong in
  // `papers/`. `lib.folderRoots` holds that rule; this only applies it.
  const relOut = `${storageDir(folderRoots(db), FOLDER)}/${name}`;
  console.log(`folder  ${FOLDER}  (${rows.length} row(s), main ${main.row_uid})`);
  console.log(`source  ${path.relative(PDF_ROOT, abs)}  ${(buf.length / 1024 / 1024).toFixed(1)} MB`);
  console.log(`target  ${relOut}`);

  // Identity check. Match on the leading words of the title rather than the
  // whole thing: a typeset page breaks a long title across lines and hyphenates,
  // so an exact full-title search fails on the right document.
  const text = (await fileText(abs)).toLowerCase().replace(/[^a-z0-9]+/g, " ");
  const words = String(main.citing_title || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(" ");
  const probe = words.slice(0, Math.min(6, words.length)).join(" ");
  const ok = probe.length > 0 && text.includes(probe);
  console.log(`title check  "${probe}" ${ok ? "found in the extracted text" : "NOT FOUND"}`);
  if (!ok) {
    console.error(`\nrefusing to file: the extracted text does not contain the opening of\n  "${main.citing_title}"\nso this PDF is not the article the folder stands for.`);
    process.exitCode = 1;
    return;
  }

  const insF = db.prepare(`INSERT INTO file (folder_uid, file, source_pdf, role, shows_date, date_basis, cited, bytes)
    VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(folder_uid, file) DO UPDATE SET
      source_pdf=excluded.source_pdf, role=excluded.role, shows_date=excluded.shows_date,
      date_basis=excluded.date_basis, cited=excluded.cited, bytes=excluded.bytes`);
  const updC = db.prepare(`UPDATE citation SET pdf_file=?, source_pdf=? WHERE row_uid=?`);

  if (DRY) {
    console.log(`\ndry run — would write ${relOut}, add a \`file\` row, and set pdf_file on ${rows.length} row(s).`);
    console.log("Re-run with --write.");
  } else {
    const bak = PACKET_DB.replace(/\.sqlite$/, `.pre-file-pdf-${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}.bak`);
    fs.copyFileSync(PACKET_DB, bak);
    db.exec("BEGIN");
    try {
      const outAbs = path.join(PKT, relOut);
      fs.mkdirSync(path.dirname(outAbs), { recursive: true });
      fs.writeFileSync(outAbs, buf);
      insF.run(FOLDER, relOut, path.relative(PDF_ROOT, abs).split(path.sep).join("/"), ROLE, SHOWS, BASIS, CITED, buf.length);
      for (const r of rows) updC.run(relOut, path.relative(PDF_ROOT, abs).split(path.sep).join("/"), r.row_uid);
      db.exec("COMMIT");
    } catch (err) {
      db.exec("ROLLBACK");
      throw err;
    }
    console.log(`\nfiled ${relOut}; ${rows.length} row(s) updated. Backup: ${path.basename(bak)}`);
    console.log("Next: node scripts/scan-mentions.js --folder=" + FOLDER + " --write, then render and validate.");
  }
  db.close();
}
main();

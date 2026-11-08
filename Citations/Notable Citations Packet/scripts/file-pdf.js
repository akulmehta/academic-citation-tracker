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
  const dir = storageDir(folderRoots(db), FOLDER);
  // Re-filing the same bytes is a re-record, not a second copy. Without this, running
  // the tool twice on one folder allocates `02-article-…` beside the `01-article-…` it
  // already wrote, and the packet then claims two files for one article. The earlier
  // path is reused only while the folder still sits in the same root: if a promotion
  // moved it from `pending-papers/` to `papers/`, the stored path is stale and writing
  // a fresh file under the new root is the right thing to do.
  const rawSame = db.prepare(`SELECT file, bytes FROM file WHERE folder_uid=? AND source_pdf=?`)
    .all(FOLDER, path.relative(PDF_ROOT, abs).split(path.sep).join("/"))
    .find(f => Number(f.bytes) === buf.length);
  const same = (rawSame && rawSame.file.split("/")[0] === dir) ? rawSame : null;
  if (same && same.file !== name) {
    console.log(`note     ${same.file} was filed from this source and its byte count matches — re-recording it rather than writing a second copy.`);
  }
  const relOut = same ? same.file : `${dir}/${name}`;
  console.log(`folder  ${FOLDER}  (${rows.length} row(s), main ${main.row_uid})`);
  console.log(`source  ${path.relative(PDF_ROOT, abs)}  ${(buf.length / 1024 / 1024).toFixed(1)} MB`);
  console.log(`target  ${relOut}`);

  // Identity check. Match on the leading words of the title rather than the
  // whole thing: a typeset page breaks a long title across lines and hyphenates,
  // so an exact full-title search fails on the right document.
  const text = (await fileText(abs)).toLowerCase().replace(/[^a-z0-9]+/g, " ");
  const words = String(main.citing_title || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim().split(" ");
  const probe = words.slice(0, Math.min(6, words.length)).join(" ");
  // Some typeset PDFs split an `fi`/`fl` ligature into its letters with a gap
  // ("filarial" extracts as "fi larial"), which breaks the spaced comparison on
  // the correct paper. Comparing with the spaces removed cannot make a wrong
  // paper pass — the probe is still six words long — so it is a widening of the
  // match, not a weakening of it.
  const ok = probe.length > 0 && (text.includes(probe) || text.replace(/ /g, "").includes(probe.replace(/ /g, "")));
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
  // The candidate queue is where the applicant decides what to chase, and it kept
  // reading "Paywalled" or "Not in OpenAlex" beside a folder that now held the PDF —
  // a queue that disagrees with the shelf sends someone off to fetch a paper already
  // on disk. `has-pdf` is the state `discover-pdfs.js` itself uses for a row with a
  // file, so this is the same mark, reached from the other direction.
  const updCand = db.prepare(`UPDATE candidate SET discover_state='has-pdf',
      discover_note = COALESCE(discover_note || '', ?), pdf_file=?, pdf_bytes=?, tried_at=?
      WHERE row_uid=?`);
  const candSeen = db.prepare(`SELECT 1 FROM candidate WHERE row_uid=?`);
  const stamp = new Date().toISOString().slice(0, 19) + "Z";

  if (DRY) {
    const stale = rows.filter(r => {
      const c = candSeen.get(r.row_uid);
      return c && db.prepare(`SELECT discover_state s FROM candidate WHERE row_uid=?`).get(r.row_uid).s !== "has-pdf";
    });
    console.log(`\ndry run — would write ${relOut}, add a \`file\` row, and set pdf_file on ${rows.length} row(s).`
      + (stale.length ? `\nAlso would move ${stale.length} candidate row(s) to 'has-pdf': ${stale.map(r => r.row_uid).join(", ")}.` : ""));
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
      let moved = 0;
      for (const r of rows) {
        if (!candSeen.get(r.row_uid)) continue;
        const cur = db.prepare(`SELECT discover_state s FROM candidate WHERE row_uid=?`).get(r.row_uid).s;
        if (cur === "has-pdf") continue;
        updCand.run(` | filed as ${relOut} on ${stamp.slice(0, 10)} (was: ${cur})`, relOut, buf.length, stamp, r.row_uid);
        moved++;
      }
      db.exec("COMMIT");
      if (moved) console.log(`moved ${moved} candidate row(s) to 'has-pdf'.`);
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

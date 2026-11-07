"use strict";
/**
 * Record the date a timeline file itself prints.
 *
 * §5.2 requires a `date_basis` for every date a multi-file folder is being used
 * to prove, and says to state where each date comes from. The importer filled
 * `shows_date` only for the file the citation summary's earliest-date line named
 * and left the rest null, so the Heras folder — the one set whose whole purpose
 * is a date — carried a basis for one of its three files.
 *
 * This tool does not decide any date. Each proposal below quotes a line, and the
 * line must be present in the extracted text of the file it is being filed
 * against, or the proposal is refused. A date nobody can point at in the PDF is
 * not a date.
 *
 *   node scripts/set-file-dates.js          # dry run: show what would change
 *   node scripts/set-file-dates.js --write  # back up, then apply
 */
const fs = require("fs");
const path = require("path");
const { pathToFileURL } = require("url");
const { PKT, PACKET_DB, openPacket } = require("./lib.js");

const DRY = !process.argv.includes("--write");

/** Extract the whole text of a PDF as one whitespace-normalised string. */
async function fileText(rel) {
  const build = path.join(PKT, "node_modules", "pdfjs-dist");
  const lib = await import(pathToFileURL(path.join(build, "legacy", "build", "pdf.mjs")).href);
  const doc = await lib.getDocument({
    data: new Uint8Array(fs.readFileSync(path.join(PKT, rel))),
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

/**
 * folder | file | shows_date | quote that must appear in the file | basis text
 * The `shows_date` is the ISO form of what the quote says, not an inference.
 */
const PROPOSALS = [
  {
    folder: "cit-000544",
    file: "papers/cit-000544/02-webpage-Heras-2023.pdf",
    shows_date: "2023-04-29",
    quote: "Posted April 29, 2023",
    date_basis: "bioRxiv page printed in this PDF: \"Posted April 29, 2023.\"",
  },
  {
    folder: "cit-000544",
    file: "papers/cit-000544/03-article-Heras-2024.pdf",
    shows_date: "2024-01-18",
    quote: "Received 18 January 2024",
    date_basis: "Article page 1 printed in this PDF: \"Received 18 January 2024; Accepted 8 July 2024\" (the submission date, which is the earliest journal-side date; publication followed the 25 Apr 2024 filing)",
  },
];

const norm = s => s.replace(/\s+/g, " ").trim();

async function main() {
  const db = openPacket();
  const get = db.prepare(`SELECT * FROM file WHERE folder_uid=? AND file=?`);
  const set = db.prepare(`UPDATE file SET shows_date=?, date_basis=? WHERE folder_uid=? AND file=?`);
  let changed = 0, refused = 0;

  for (const p of PROPOSALS) {
    const row = get.get(p.folder, p.file);
    if (!row) { console.log(`  ! ${p.file}: no such file row`); refused++; continue; }
    const abs = path.join(PKT, p.file);
    if (!fs.existsSync(abs)) { console.log(`  ! ${p.file}: not on disk`); refused++; continue; }
    const text = norm(await fileText(p.file));
    const found = text.includes(norm(p.quote));
    const label = found ? "quote confirmed in file" : "QUOTE NOT IN FILE";
    if (row.date_basis === p.date_basis && row.shows_date === p.shows_date) {
      console.log(`  = ${p.file}\n      already ${p.shows_date} (${label})`);
      continue;
    }
    console.log(`  ~ ${p.file}\n      was : shows_date=${row.shows_date || "(none)"}  date_basis=${row.date_basis || "(none)"}`);
    console.log(`      now : shows_date=${p.shows_date}  date_basis=${p.date_basis}\n      [${label}]`);
    if (!found) {
      console.log(`      refused — the quoted line is not in the extracted text, so this date has no source in the file`);
      refused++;
      continue;
    }
    changed++;
    if (!DRY) set.run(p.shows_date, p.date_basis, p.folder, p.file);
  }

  if (DRY) {
    console.log(`\ndry run: ${changed} file row(s) would change, ${refused} refused. Re-run with --write.`);
  } else if (changed) {
    const bak = PACKET_DB.replace(/\.sqlite$/, `.pre-file-dates-${new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)}.bak`);
    fs.copyFileSync(PACKET_DB, bak);
    console.log(`\napplied ${changed} change(s); ${refused} refused. Backup: ${path.basename(bak)}`);
  } else {
    console.log(`\nnothing to change (${refused} refused).`);
  }
  if (refused) process.exitCode = 1;
  db.close();
}
main();

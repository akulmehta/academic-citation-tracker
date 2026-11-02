// Archive one publication's filed exhibit set, so a fresh capture of the same
// citing list replaces it instead of sitting beside it.
//
//   node tools/archive-exhibits.js --cites=<cites id>            (dry run)
//   node tools/archive-exhibits.js --cites=<cites id> --write
//   node tools/archive-exhibits.js --cites=<cites id> --keep=<base> --write
//   node tools/archive-exhibits.js --title="<substring>" --write
//
// Why this is needed: an exhibit page is named "<slug>-citing-<date>[-pN]", so
// re-capturing on a later date writes a SECOND complete set for the same cites
// id. build-ledger.js warns about exactly that, and the totals would double.
// Archiving first is what makes a re-capture a replacement.
//
// What it does:
//   - PDFs move to Exhibits/Archive/ with a SUPERSEDED- prefix (tally.filedBases
//     skips Archive and SUPERSEDED- names, so the publication stops counting as
//     filed and run-batch --skip-done will offer it again).
//   - The page HTML, PNG, report JSON and review Markdown move to
//     Exhibits/Supporting/Pre-recapture-<date>/. readReports() uses a
//     NON-recursive readdir on Supporting, so a subfolder is invisible to the
//     ledger, catalog and audit - which is what keeps the swap clean.
//   - Nothing is deleted. Every file keeps its name inside the archive.
//
// It prints every move and archives nothing in a dry run.
//
// --keep=<substring> (comma-separated) spares matching bases. This matters
// because a cites id resolves to EVERY dated set that shares it, so running
// this tool after a re-capture would otherwise archive the capture just made
// along with the one it replaces, leaving the publication with no filed exhibit
// at all. Pass the new base -- the batch log prints it -- or archive before
// capturing.

const fs = require("fs");
const path = require("path");
const lib = require("./tally");

const ROOT = path.resolve(__dirname, "..");
const EXHIBITS = path.join(ROOT, "Independent Citation Record", "Exhibits");
const PDF_DIR = path.join(EXHIBITS, "PDFs");
const SUPPORT_DIR = path.join(EXHIBITS, "Supporting");
const ARCHIVE_DIR = path.join(EXHIBITS, "Archive");

const WRITE = process.argv.includes("--write");

function arg(name, fallback = "") {
  const hit = process.argv.slice(2).find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}

function log(m) {
  console.log(`[archive] ${m}`);
}

// Locate filed bases whose report names the given cites id.
function basesForCitesId(citesId) {
  const out = [];
  for (const f of fs.readdirSync(SUPPORT_DIR)) {
    if (!f.endsWith(".report.json")) continue;
    let data;
    try {
      data = JSON.parse(fs.readFileSync(path.join(SUPPORT_DIR, f), "utf8"));
    } catch {
      continue;
    }
    if (lib.citesId(data.cites_url) !== citesId) continue;
    const base = f.replace(/\.report\.json$/, "").replace(/-p\d+$/, "");
    if (!out.includes(base)) out.push(base);
  }
  return out;
}

function move(from, to, label) {
  if (!WRITE) {
    log(`  would move ${label}: ${path.basename(from)}`);
    return;
  }
  fs.mkdirSync(path.dirname(to), { recursive: true });
  // Never overwrite: an existing target gets a numeric suffix.
  let dest = to;
  let n = 1;
  while (fs.existsSync(dest)) {
    dest = `${to}.${n++}`;
  }
  fs.renameSync(from, dest);
  log(`  ${label}: ${path.basename(from)} -> ${path.relative(ROOT, dest)}`);
}

function archiveBase(base, backupDir) {
  // PDFs anywhere under PDFs (including the Production sub-folder).
  const pdfs = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) {
        if (e.name === "Archive") continue;
        walk(p);
        continue;
      }
      if (!e.name.endsWith(".pdf")) continue;
      if (e.name.startsWith("SUPERSEDED-")) continue;
      const stem = e.name.replace(/\.pdf$/, "").replace(/-p\d+$/, "");
      if (stem === base) pdfs.push(p);
    }
  };
  if (fs.existsSync(PDF_DIR)) walk(PDF_DIR);

  const support = fs.readdirSync(SUPPORT_DIR).filter((f) => {
    const stem = f
      .replace(/\.report\.json$/, "")
      .replace(/\.review\.md$/, "")
      .replace(/\.html$/, "")
      .replace(/\.png$/, "");
    if (stem !== base && !new RegExp(`^${base}-p\\d+$`).test(stem)) return false;
    return (
      f.endsWith(".report.json") ||
      f.endsWith(".review.md") ||
      f.endsWith(".html") ||
      f.endsWith(".png")
    );
  });

  if (!pdfs.length) {
    log(`  WARNING: no filed PDF for ${base} - reports only.`);
  }
  for (const p of pdfs) {
    move(p, path.join(ARCHIVE_DIR, `SUPERSEDED-${path.basename(p)}`), "exhibit PDF");
  }
  for (const f of support) {
    move(path.join(SUPPORT_DIR, f), path.join(backupDir, f), "workpaper");
  }
  return { pdfs: pdfs.length, support: support.length };
}

function main() {
  const citesId = arg("cites");
  const titleSub = arg("title").toLowerCase();
  if (!citesId && !titleSub) {
    log("Give --cites=<id> or --title=<substring>.");
    process.exitCode = 1;
    return;
  }

  const stamp = new Date().toISOString().slice(0, 10);
  const backupDir = path.join(SUPPORT_DIR, `Pre-recapture-${stamp}`);

  let bases = [];
  if (citesId) {
    bases = basesForCitesId(citesId);
    log(`cites=${citesId} -> ${bases.length} base(s) in Supporting`);
  }
  if (titleSub) {
    // Resolve from the newest publication list, then confirm a filed set exists.
    const dated = fs
      .readdirSync(SUPPORT_DIR)
      .filter((f) => /^publications-list-\d{4}-\d{2}-\d{2}\.json$/.test(f))
      .sort();
    const list = JSON.parse(
      fs.readFileSync(path.join(SUPPORT_DIR, dated[dated.length - 1]), "utf8")
    );
    const hit = (list.publications || []).find((p) =>
      String(p.title).toLowerCase().includes(titleSub)
    );
    if (!hit) {
      log(`No publication in ${dated[dated.length - 1]} matching "${titleSub}".`);
      process.exitCode = 1;
      return;
    }
    log(`Matched: [${hit.citedBy}] ${hit.title}`);
    const id = lib.citesId(hit.citesUrl);
    const fromId = id ? basesForCitesId(id) : [];
    for (const b of fromId) if (!bases.includes(b)) bases.push(b);
  }

  // A base only counts as filed if a PDF still exists for it.
  const filed = lib.filedBases(PDF_DIR);
  let live = bases.filter((b) => filed.has(b));
  const alreadyGone = bases.filter((b) => !filed.has(b));
  if (alreadyGone.length) {
    log(`Already unfiled (no PDF): ${alreadyGone.join(", ") || "none"}`);
  }

  // Spare the freshly captured set. Matched bases are reported so a typo in
  // --keep cannot silently spare the set that was meant to go.
  const keep = arg("keep")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (keep.length) {
    const spared = live.filter((b) => keep.some((k) => b.includes(k)));
    const missing = keep.filter((k) => !spared.some((b) => b.includes(k)));
    live = live.filter((b) => !spared.includes(b));
    log(
      `Kept in place by --keep: ${spared.join(", ") || "nothing matched"}` +
        (missing.length ? `  (no filed base matched: ${missing.join(", ")})` : "")
    );
  }

  if (!live.length) {
    log("Nothing filed to archive.");
    return;
  }

  log(`${WRITE ? "Archiving" : "Would archive"} ${live.length} publication set(s):`);
  let pdfs = 0;
  let support = 0;
  for (const b of live) {
    log(` ${b}`);
    const r = archiveBase(b, backupDir);
    pdfs += r.pdfs;
    support += r.support;
  }
  log(
    `${WRITE ? "Archived" : "Would archive"} ${pdfs} exhibit PDF(s) and ` +
      `${support} workpaper file(s).`
  );
  if (!WRITE) {
    log("\nDry run. Add --write to move the files.");
    return;
  }
  const stillFiled = lib.filedBases(PDF_DIR);
  const leaked = live.filter((b) => stillFiled.has(b));
  if (leaked.length) {
    log(`ERROR: still filed after archiving: ${leaked.join(", ")}`);
    process.exitCode = 1;
  } else {
    log("Verified: none of those bases is filed any more.");
  }
}

main();

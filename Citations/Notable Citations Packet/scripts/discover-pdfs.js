// Populate the candidate queue from the record, resolve open-access copies, and
// download the ones that are genuinely open.
//
// Read-only against the Independent Citation Record: the catalog is opened with
// openCatalog(), which has no write path. Everything this tool writes lands in
// the packet folder.
//
// Stages (run in order, each is resumable):
//   --seed               copy the cited-by rows into `candidate`
//   --resolve            ask OpenAlex for a DOI / open-access link
//   --fetch              download the open copies into papers/<row_uid>/
//   --status             print the queue
//
// A row that cannot be resolved is recorded as `no-open-copy` or
// `lookup-failed`, never silently dropped. The distinction matters: the first is
// a finding about the paper, the second is a finding about our network, and
// treating a throttled request as "not open" would manufacture evidence.

const fs = require("fs");
const path = require("path");
const { PKT, PAPERS, openCatalog, openPacket, readEnv, surnameOf, seniorAuthor, surnameSlug } = require("./lib");
const { get, getJson, sleep } = require("./http");

const stripMarker = require(path.join(PKT, "..", "..", "tools", "scholar-marker.js")).stripScholarMarker;

const argv = process.argv.slice(2);
const has = f => argv.includes(`--${f}`);
const opt = (name, dflt) => {
  const a = argv.find(s => s.startsWith(`--${name}=`));
  return a ? a.slice(name.length + 3) : dflt;
};
const DRY = has("dry");
const LIMIT = Number(opt("limit", "0"));

// GLAD's cites_id in the catalog. Resolved from the publications table rather
// than hardcoded, so a re-capture that mints a new id cannot silently seed the
// wrong paper's citations. `publications` is keyed by cites_id — it has no id.
function resolveCitesId(cat, needle) {
  const pubs = cat.prepare("SELECT cites_id, title, year FROM publications").all();
  if (/^\d+$/.test(needle)) return needle;
  const want = needle.toLowerCase();
  const hits = pubs.filter(p => (p.title || "").toLowerCase().includes(want));
  if (hits.length === 1) return hits[0].cites_id;
  if (!hits.length) throw new Error(`no publication title contains "${needle}"`);
  throw new Error(`"${needle}" matches ${hits.length} publications: ${hits.map(h => `${h.cites_id} (${h.title})`).join("; ")}`);
}

/**
 * Reduce a scraped DOI to the DOI.
 *
 * The record's `doi` column comes from Scholar's link, so it often arrives with
 * the publisher's view suffix attached: `10.3389/fcimb.2025.1572734/full`,
 * `10.1101/2024.05.18.594815.abstract`, and even
 * `10.1016/j.rpth.2026.103414/attachment/…/mmc1.pdf`, which is a supplementary
 * file, not the article. Sent to OpenAlex as-is those resolve to nothing, and
 * "nothing" would then be recorded as a finding about the paper.
 *
 * Deliberately narrow: only known view suffixes are removed, because a real DOI
 * suffix may contain slashes (`10.1007/978-1-0716-0430-4_1`) and a legacy one may
 * contain more than one (`10.1093/glycob/cwag085`). Anything left over is tried
 * as-is and the caller falls back to a title search when it does not resolve.
 */
function cleanDoi(raw) {
  if (!raw) return null;
  let d = String(raw).trim().replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "");
  d = d.split(/[?#]/)[0];
  d = d.replace(/\/(?:attachment|supplementary|figures?)\/.*$/i, "");
  d = d.replace(/\/(?:full\/html|full|short|summary|epdf|metrics|references)$/i, "");
  d = d.replace(/\.(?:abstract|pdf|ris|nbib|bib|epub|xml)$/i, "");
  d = d.replace(/(\d)v\d+$/i, "$1");
  d = d.replace(/[.,;:]+$/, "");
  return /^10\.\d{4,9}\/.+/.test(d) ? d : null;
}

/* ------------------------------------------------------------------ */
/* seed                                                               */
/* ------------------------------------------------------------------ */
function seed(cat, db) {
  const citesId = resolveCitesId(cat, opt("cites", "glycan array dashboard"));
  const pub = cat.prepare("SELECT title, year, exhibit_base FROM publications WHERE cites_id = ?").get(citesId);
  if (!pub) throw new Error(`publication ${citesId} not found`);
  const onlyHighlighted = !has("include-dependent");

  const sql = `SELECT * FROM citations WHERE cites_id = ? AND superseded_at = '' AND filed = 1
               ${onlyHighlighted ? "AND is_highlighted = 1" : ""}
               ORDER BY page, row_index`;
  const rows = cat.prepare(sql).all(citesId);
  console.log(`${pub.title} (${pub.year}) — ${rows.length} citing rows${onlyHighlighted ? " (highlighted independent only)" : ""}`);

  // A row already represented in the packet is not new work. Match on the row
  // itself or on the folder another packet row filed under.
  const inPacket = new Map(db.prepare("SELECT row_uid, folder_uid, pdf_file FROM citation").all()
    .map(r => [r.row_uid, r]));
  const foldersWithPdf = new Set(db.prepare("SELECT DISTINCT folder_uid FROM file").all().map(r => r.folder_uid));

  const ins = db.prepare(`INSERT INTO candidate
    (row_uid, cites_id, title, authors, doi, link, work_type, venue, page, exhibit_base,
     status, is_highlighted, is_non_english, language_flag, confirm_state,
     has_pdf, packet_row_uid, year, senior_author, senior_basis)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
    ON CONFLICT(row_uid) DO UPDATE SET
      title=excluded.title, authors=excluded.authors, doi=excluded.doi, link=excluded.link,
      work_type=excluded.work_type, venue=excluded.venue, page=excluded.page,
      exhibit_base=excluded.exhibit_base, status=excluded.status,
      is_highlighted=excluded.is_highlighted, is_non_english=excluded.is_non_english,
      language_flag=excluded.language_flag, confirm_state=excluded.confirm_state,
      has_pdf=excluded.has_pdf, packet_row_uid=excluded.packet_row_uid,
      year=excluded.year, senior_author=excluded.senior_author, senior_basis=excluded.senior_basis,
      -- A row that gained a PDF since the last seed stops being a target; one
      -- that lost one goes back in the queue. A resolved state is never reset.
      discover_state = CASE
        WHEN excluded.has_pdf = 1 THEN 'has-pdf'
        WHEN candidate.discover_state = 'has-pdf' THEN 'untried'
        ELSE candidate.discover_state END,
      discover_note = CASE
        WHEN excluded.has_pdf = 1 THEN 'already filed in the packet'
        WHEN candidate.discover_state = 'has-pdf' THEN NULL
        ELSE candidate.discover_note END`);

  let seeded = 0, already = 0;
  for (const r of rows) {
    const pkt = inPacket.get(r.row_uid);
    const covered = pkt ? foldersWithPdf.has(pkt.folder_uid) : false;
    if (covered) already++;
    const senior = seniorFromCatalog(r);
    const line = parseLine(r.authors);
    if (DRY) continue;
    ins.run(
      r.row_uid, r.cites_id, stripMarker(r.title || ""), senior.text, cleanDoi(r.doi), r.link || null,
      r.work_type || "article", line.venue, r.page, r.base, r.status, r.is_highlighted,
      r.is_non_english, r.language_flag || null, r.confirm_state || null,
      covered ? 1 : 0, pkt?.folder_uid || null,
      line.year, senior.surname, senior.basis
    );
    seeded++;
  }
  // A fresh INSERT takes the column default, so the covered rows are marked
  // after the loop rather than in the ON CONFLICT clause.
  if (!DRY) db.prepare(`UPDATE candidate SET discover_state='has-pdf',
    discover_note='already filed in the packet' WHERE has_pdf = 1`).run();

  console.log(`candidate rows written: ${seeded} | already have a PDF in the packet: ${already}`);
}

/**
 * Scholar's rendered line carries the venue and year inside
 * "…- Current opinion in …, 2020 - Elsevier". The catalog stores neither as its
 * own column, so the packet parses them out here for display only. A venue
 * ending in the ellipsis Scholar prints is abbreviated and is dropped rather
 * than filed as a journal name.
 */
function parseLine(authors) {
  const m = String(authors || "").match(/-\s*(.+?),\s*(20\d\d)\s*-\s*(\S+)$/);
  if (!m) return { venue: null, year: null };
  const venue = m[1].trim();
  return { venue: /[…\.]{2,}$/.test(venue) ? null : venue, year: m[2] };
}

/**
 * Senior author from the catalog, refusing a truncated list.
 *
 * Scholar cuts a byline at ten names and the record marks that with `truncated`.
 * On such a row the last name is merely the tenth author, which produced the
 * wrong senior author for five of the fourteen imported works. A truncated list
 * still yields a surname when the external corroboration record carries a
 * complete byline; otherwise the surname is left for the download stage, where
 * the PDF itself settles it.
 */
function seniorFromCatalog(r) {
  if (r.external_authors) {
    // Corroborated bylines are stored in natural order, one comma-joined string.
    const list = String(r.external_authors).split(/,\s+/).filter(Boolean);
    const last = list[list.length - 1];
    if (last) return { surname: surnameOf(last), text: String(r.external_authors), basis: "external record" };
  }
  if (!r.truncated && r.full_authors) {
    try {
      const arr = JSON.parse(r.full_authors);
      if (Array.isArray(arr) && arr.length) {
        return { surname: seniorAuthor(arr.join(", ")), text: arr.join("; "), basis: "Scholar, complete list" };
      }
    } catch { /* fall through */ }
  }
  return { surname: null, text: r.authors_used || null, basis: r.truncated ? "Scholar list truncated at ten names" : "no byline" };
}

/* ------------------------------------------------------------------ */
/* resolve                                                            */
/* ------------------------------------------------------------------ */

/** Prefer a PDF location; a repository copy is as good as the publisher's. */
function pickOa(work) {
  const locs = [work.best_oa_location, ...(work.oa_locations || [])].filter(Boolean);
  const seen = new Set();
  for (const l of locs) {
    const url = l.pdf_url || (/pdf/.test(l.url || "") ? l.url : null);
    if (!url || seen.has(url)) continue;
    seen.add(url);
    return { url, source: l.source_display_name || new URL(url).host, landing: l.landing_page_url || null };
  }
  return null;
}

function workTitle(work) {
  const t = work.title || work.display_name || "";
  return t.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

// Same guard the record applies to a title match: never accept a fragment.
// Scholar truncates long titles with an ellipsis, so a prefix is allowed, but a
// two-word prefix matches unrelated papers.
function sameWork(a, b) {
  const x = (a || "").replace(/\.\.\.$|[…]/g, "").trim();
  const y = (b || "").trim();
  if (!x || !y) return false;
  const [long, short] = x.length >= y.length ? [x, y] : [y, x];
  const words = s => s.split(/\W+/).filter(w => w.length > 1);
  const lw = words(long), sw = words(short);
  if (!lw.length || !sw.length) return false;
  const lset = new Set(lw.map(w => w.toLowerCase()));
  const overlap = sw.filter(w => lset.has(w.toLowerCase())).length / sw.length;
  if (overlap >= 0.8) return true;
  if (sw.length >= 4 && long.toLowerCase().includes(short.toLowerCase())) return true;
  if (sw.length >= 3) {
    const head = lw.slice(0, sw.length).join(" ").toLowerCase();
    if (head === sw.join(" ").toLowerCase()) return true;
  }
  return false;
}

async function resolve(db) {
  readEnv();
  const key = process.env.OPENALEX_API_KEY || "";
  console.log(key ? "OpenAlex: key present" : "OpenAlex: NO KEY — the anonymous pool throttles a sweep; expecting lookup-failed rows");
  const headers = key ? { Authorization: `Bearer ${key}` } : {};

  const rows = db.prepare(`SELECT * FROM candidate WHERE discover_state = 'untried' ORDER BY page, row_uid`).all();
  const todo = LIMIT > 0 ? rows.slice(0, LIMIT) : rows;
  console.log(`resolving ${todo.length} candidate rows`);

  const upd = db.prepare(`UPDATE candidate SET discover_state=?, discover_note=?, pdf_url=?, pdf_source=?, doi=?, year=?, tried_at=? WHERE row_uid=?`);
  const tally = {};
  for (let i = 0; i < todo.length; i++) {
    const r = todo[i];
    const stamp = new Date().toISOString().slice(0, 19) + "Z";
    let state = "no-open-copy", note = "", url = null, source = null;
    let year = r.year;
    const doi = cleanDoi(r.doi);

    // Try the DOI first (a direct hit, and cheap), then the title. A DOI that
    // does not resolve is not evidence about the paper — it usually means the
    // scraped value carried a publisher suffix — so the title search still runs.
    const attempts = [];
    if (doi) attempts.push({ url: `https://api.openalex.org/works/doi:${encodeURIComponent(doi)}`, how: "doi" });
    attempts.push({ url: `https://api.openalex.org/works?per-page=5&filter=title.search:${encodeURIComponent(r.title)}`, how: "title" });

    let work = null, unknown = null;
    for (const a of attempts) {
      const res = await getJson({ url: a.url, headers });
      if (res.unknown) { unknown = res.note; continue; }
      if (!res.ok) { note = `OpenAlex ${res.status}`; continue; }
      const found = (a.how === "doi" ? [res.json] : res.json.results || []).find(w => sameWork(r.title, w.title || w.display_name));
      if (found) { work = found; break; }
      await sleep(700 + Math.random() * 700);
    }

    if (work) {
      const found = (work.doi || "").replace(/^https?:\/\/doi\.org\//i, "") || doi;
      year = year || String(work.publication_year || "");
      const oa = pickOa(work);
      if (oa) { state = "open-copy"; url = oa.url; source = oa.source; note = `OpenAlex OA: ${work.open_access?.oa_status || "?"}`; }
      else { state = "no-open-copy"; note = `OpenAlex has the work (${found || "no DOI"}), no open-access PDF location`; }
      doi && (r.doi = found);
    } else if (unknown) {
      // The look-up did not complete. Leave the row for a re-run; do not settle it.
      state = "lookup-failed"; note = unknown;
    } else {
      state = "not-in-indexes";
      note = doi ? `no OpenAlex record by DOI (${doi}) or by title` : "no OpenAlex record by title";
    }
    const doiOut = work ? ((work.doi || "").replace(/^https?:\/\/doi\.org\//i, "") || doi) : doi;

    tally[state] = (tally[state] || 0) + 1;
    if (!DRY) upd.run(state, note.slice(0, 400), url, source, doiOut, year, stamp, r.row_uid);
    console.log(`  ${r.row_uid} ${state.padEnd(15)} ${(r.title || "").slice(0, 58)}${url ? `\n      ${url}` : ""}`);
    await sleep(1200 + Math.random() * 1400);
  }
  console.log("\nresolve tally:", JSON.stringify(tally));
  if (tally["lookup-failed"]) {
    console.log("NOTE: look-up failures are not findings. Re-run --resolve until none remain.");
    process.exitCode = 1;
  }
}

/* ------------------------------------------------------------------ */
/* fetch                                                              */
/* ------------------------------------------------------------------ */
const PDF_MAGIC = Buffer.from("%PDF");

function fetchable(db) {
  return db.prepare(`SELECT * FROM candidate WHERE discover_state = 'open-copy' AND has_pdf = 0 ORDER BY page, row_uid`).all();
}

async function fetchPdfs(db) {
  const rows = LIMIT > 0 ? fetchable(db).slice(0, LIMIT) : fetchable(db);
  console.log(`fetching ${rows.length} open-access PDFs`);
  const upd = db.prepare(`UPDATE candidate SET discover_state=?, discover_note=?, pdf_file=?, pdf_bytes=?, senior_author=?, senior_basis=?, tried_at=? WHERE row_uid=?`);
  const insF = db.prepare(`INSERT INTO file (folder_uid, file, source_pdf, role, shows_date, date_basis, cited, bytes)
    VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(folder_uid, file) DO UPDATE SET
      source_pdf=excluded.source_pdf, role=excluded.role, bytes=excluded.bytes`);

  let got = 0, blocked = 0;
  for (const r of rows) {
    const stamp = new Date().toISOString().slice(0, 19) + "Z";
    const res = await get(r.pdf_url, { accept: "application/pdf,*/*" });
    if (res.unknown) {
      upd.run("lookup-failed", res.note, null, null, r.senior_author, r.senior_basis, stamp, r.row_uid);
      console.log(`  ${r.row_uid} lookup-failed  ${res.note}`);
      blocked++;
    } else if (!res.ok) {
      // 403/401 is an access wall, not an absent file. Record it and move on;
      // the browser stage or the applicant handles these.
      const state = res.status === 401 || res.status === 403 ? "paywalled" : "no-open-copy";
      upd.run(state, `OpenAlex offered a PDF but the host answered ${res.status}`, null, null, r.senior_author, r.senior_basis, stamp, r.row_uid);
      console.log(`  ${r.row_uid} ${state} (${res.status})  ${r.pdf_url}`);
      blocked++;
    } else if (!res.body.subarray(0, 4).equals(PDF_MAGIC)) {
      upd.run("paywalled", `host returned ${res.contentType || "not a PDF"}, not a PDF body`, null, null, r.senior_author, r.senior_basis, stamp, r.row_uid);
      console.log(`  ${r.row_uid} paywalled (not a PDF: ${res.contentType})`);
      blocked++;
    } else {
      const senior = r.senior_author || seniorFromPdfName(r);
      // Two Scholar rows can be two listings of one work (a journal record with
      // its repository copy). Same bytes, same paper: the packet stores the file
      // once, under the row that stands, and points the other at it. Storing a
      // second copy would make the packet claim two papers where there is one.
      const twin = db.prepare(`SELECT folder_uid, pdf_file FROM candidate
        WHERE pdf_url = ? AND pdf_file IS NOT NULL AND row_uid <> ? LIMIT 1`).get(r.pdf_url, r.row_uid);
      if (twin) {
        upd.run("open-copy", `same file as ${twin.row_uid} (${r.pdf_source}); filed once under ${twin.folder_uid}`,
          twin.pdf_file, null, senior, r.senior_author ? "catalog byline" : "publisher page (unverified)", stamp, r.row_uid);
        console.log(`  ${r.row_uid} duplicate of ${twin.row_uid} -> ${twin.pdf_file} (not stored twice)`);
        blocked++;
      } else {
        const fname = `01-article-${surnameSlug(senior)}${r.year ? `-${r.year}` : ""}.pdf`;
        const rel = `papers/${r.row_uid}/${fname}`;
        const abs = path.join(PKT, rel);
        if (!DRY) {
          fs.mkdirSync(path.dirname(abs), { recursive: true });
          fs.writeFileSync(abs, res.body);
          insF.run(r.row_uid, rel, `downloaded from ${r.pdf_source}`, "article", null, null, 1, res.body.length);
          upd.run("open-copy", `downloaded from ${r.pdf_source}`, rel, res.body.length, senior,
            r.senior_author ? "catalog byline" : "publisher page (unverified)", stamp, r.row_uid);
        }
        got++;
        console.log(`  ${r.row_uid} saved ${(res.body.length / 1024 / 1024).toFixed(1)} MB -> ${rel}`);
      }
    }
    await sleep(2500 + Math.random() * 3000);
  }
  console.log(`\ndownloaded: ${got} | blocked: ${blocked}`);
  if (got) console.log("Next: node scripts/scan-mentions.js, then node scripts/render-packet.js");
}

/** Fallback label so a file is still nameable when the byline was truncated. */
function seniorFromPdfName(r) {
  const s = surnameOf((r.authors || "").split(";").pop() || "");
  return s || "Unknown";
}

/* ------------------------------------------------------------------ */
function status(db) {
  const g = db.prepare(`SELECT discover_state, COUNT(*) c FROM candidate GROUP BY discover_state ORDER BY c DESC`).all();
  const total = g.reduce((s, r) => s + r.c, 0);
  console.log(`candidate queue: ${total} rows`);
  for (const r of g) console.log(`  ${r.discover_state.padEnd(16)} ${r.c}`);
  if (has("list")) {
    for (const r of db.prepare(`SELECT row_uid, discover_state, senior_author, year, venue, title, doi, pdf_url, pdf_file, discover_note
                                FROM candidate ORDER BY discover_state, page, row_uid`).all()) {
      console.log(`${r.row_uid}  ${r.discover_state.padEnd(15)} ${r.year || "    "}  ${(r.senior_author || "?").padEnd(16)} ${(r.title || "").slice(0, 60)}`);
      console.log(`        doi=${r.doi || "-"}  file=${r.pdf_file || r.pdf_url || "-"}`);
      if (r.discover_note) console.log(`        note: ${r.discover_note}`);
    }
  }
  const need = db.prepare(`SELECT row_uid, title, link, discover_note FROM candidate WHERE discover_state IN ('paywalled','no-open-copy','not-in-indexes') ORDER BY row_uid`).all();
  if (need.length) {
    console.log(`\n${need.length} rows with no open copy — the applicant can supply these:`);
    for (const r of need) console.log(`  ${r.row_uid}  ${(r.title || "").slice(0, 72)}\n      ${r.link || ""}`);
  }
  const failed = db.prepare(`SELECT row_uid, discover_note FROM candidate WHERE discover_state = 'lookup-failed'`).all();
  if (failed.length) {
    console.log(`\n${failed.length} look-ups DID NOT COMPLETE (re-run --resolve; these are not findings):`);
    for (const r of failed) console.log(`  ${r.row_uid}  ${r.discover_note}`);
    process.exitCode = 1;
  }
}

/**
 * Put incomplete look-ups back in the queue.
 *
 * A `lookup-failed` row is a finding about our network, not about the paper, so
 * re-running is the correct response. This is deliberately a flag rather than an
 * automatic retry inside --resolve: it keeps the count of what was requeued on
 * the record.
 */
function retryFailed(db) {
  const rows = db.prepare(`SELECT row_uid FROM candidate WHERE discover_state = 'lookup-failed'`).all();
  console.log(`requeueing ${rows.length} incomplete look-up(s): ${rows.map(r => r.row_uid).join(", ")}`);
  if (!DRY && rows.length) {
    db.prepare(`UPDATE candidate SET discover_state='untried', discover_note=NULL WHERE discover_state='lookup-failed'`).run();
  }
}

/**
 * Put rows back in the queue by state.
 *
 * Needed after a rule change that invalidates earlier answers: cleaning the
 * scraped DOIs, for instance, means rows previously reported as "not in the
 * indexes" were asked about with a malformed identifier, so their answer was
 * never a finding about the paper.
 */
function requeue(db) {
  const states = opt("requeue", "").split(",").map(s => s.trim()).filter(Boolean);
  if (!states.length) { console.log("--requeue=<state[,state…]> required"); process.exitCode = 1; return; }
  const marks = states.map(() => "?").join(",");
  const rows = db.prepare(`SELECT row_uid, discover_state FROM candidate WHERE discover_state IN (${marks})`).all(...states);
  console.log(`requeueing ${rows.length} row(s) from: ${states.join(", ")}`);
  if (!DRY && rows.length) {
    db.prepare(`UPDATE candidate SET discover_state='untried', discover_note=NULL WHERE discover_state IN (${marks})`).run(...states);
  }
}

/**
 * Re-derive every candidate's senior author and rename its file.
 *
 * The senior name came out of `seniorAuthor`, which read a comma-joined inverted
 * byline as natural order whenever a surname contained a space — so
 * "Le Mercier, Philippe, … , Lisacek, Frédérique" yielded the GIVEN name
 * "Frédérique", filed as `01-article-FrEdErique-2019.pdf`. The fix lives in lib.js;
 * this applies it to rows already downloaded, so the packet does not carry a file
 * named after somebody's first name.
 */
function repairNames(db) {
  const cat = openCatalog();
  const byUid = new Map(cat.prepare("SELECT * FROM citations WHERE superseded_at = ''").all().map(r => [r.row_uid, r]));
  const rows = db.prepare(`SELECT * FROM candidate WHERE pdf_file IS NOT NULL`).all();
  console.log(`re-deriving senior author for ${rows.length} downloaded row(s)`);
  for (const r of rows) {
    const c = byUid.get(r.row_uid);
    if (!c) { console.log(`  ! ${r.row_uid} not in the catalog`); continue; }
    const senior = seniorFromCatalog(c);
    if (!senior.surname) continue;
    // Compare against the NAME ON DISK, not the stored senior_author: --seed
    // already refreshes that column with the fixed rule, so comparing the two
    // would find them equal and leave the misnamed file in place.
    const dir = path.posix.dirname(r.pdf_file);
    const base = path.basename(r.pdf_file);
    const want = `${surnameSlug(senior.surname)}`;
    const fname = base.replace(/^(01-article-)[^.]+?(?=-\d{4}|\.pdf)/, `$1${want}`);
    if (fname === base) continue;
    const absOld = path.join(PKT, r.pdf_file);
    const absNew = path.join(PKT, dir, fname);
    console.log(`  ${r.row_uid}: ${r.senior_author} -> ${senior.surname}`);
    if (!DRY) {
      if (fs.existsSync(absOld) && !fs.existsSync(absNew)) fs.renameSync(absOld, absNew);
      db.prepare(`UPDATE candidate SET senior_author=?, senior_basis=?, pdf_file=? WHERE row_uid=?`)
        .run(senior.surname, senior.basis, `${dir}/${fname}`, r.row_uid);
      db.prepare(`UPDATE file SET file=? WHERE folder_uid=? AND file=?`).run(`${dir}/${fname}`, r.row_uid, r.pdf_file);
      db.prepare(`UPDATE citation SET citing_senior_author=?, pdf_file=? WHERE row_uid=?`)
        .run(senior.surname, `${dir}/${fname}`, r.row_uid);
    }
  }
  cat.close();
}

function main() {
  const db = openPacket();
  if (has("status")) return status(db);
  if (has("repair-names")) { repairNames(db); db.close(); return; }
  if (has("retry-failed")) { retryFailed(db); db.close(); return; }
  if (argv.some(a => a.startsWith("--requeue"))) { requeue(db); db.close(); return; }
  if (has("seed")) {
    const cat = openCatalog();
    seed(cat, db);
    cat.close();
    return;
  }
  if (has("resolve")) return resolve(db).then(() => db.close());
  if (has("fetch")) return fetchPdfs(db).then(() => db.close());
  console.log("usage: node scripts/discover-pdfs.js --seed [--cites=<title fragment|id>] [--include-dependent]\n" +
             "       node scripts/discover-pdfs.js --resolve [--limit=N]\n" +
             "       node scripts/discover-pdfs.js --fetch [--limit=N]\n" +
             "       node scripts/discover-pdfs.js --status\n" +
             "Add --dry to plan without writing.");
}
main();

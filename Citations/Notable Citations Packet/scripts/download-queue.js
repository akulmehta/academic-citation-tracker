#!/usr/bin/env node
/**
 * download-queue.js — track PDF retrieval separately from classification.
 *
 * Per the applicant's instruction on 2026-11-08 the pipeline now runs in two
 * passes: get the PDFs first, classify and catalogue afterwards. Retrieval
 * outcomes are therefore their own record, and a row's `discover_state` keeps
 * its older, narrower meaning.
 *
 * Preprints and theses are skipped, not downloaded: the scope is published
 * research articles (see the rules in .github/copilot-instructions.md). The
 * guess is made here, once, and is visible in the export so a person can
 * overrule it — a row is only skipped because its LINK says preprint or thesis,
 * never because a title sounds like one.
 *
 * Usage:
 *   node scripts/download-queue.js                 # queue summary by host
 *   node scripts/download-queue.js --list          # every pending row
 *   node scripts/download-queue.js --host=oup      # one host's rows
 *   node scripts/download-queue.js --mark=cit-000123=downloaded --note="..."
 *   node scripts/download-queue.js --export        # write download-queue.csv
 */
const path = require("path");
const fs = require("fs");
const { PKT, openPacket } = require("./lib.js");
const flag = (n) => {
  const a = process.argv.find((x) => x.startsWith(`--${n}=`));
  return a ? a.slice(n.length + 3) : "";
};
const has = (n) => process.argv.includes(`--${n}`);

const STATUS = ["downloaded", "walled", "no-open-copy", "skipped-preprint", "skipped-thesis", "failed"];

const db = openPacket();
db.exec(`
CREATE TABLE IF NOT EXISTS download_attempt (
  row_uid      TEXT PRIMARY KEY,
  url          TEXT,
  host         TEXT,
  status       TEXT NOT NULL CHECK (status IN ('downloaded','walled','no-open-copy','skipped-preprint','skipped-thesis','failed')),
  note         TEXT,
  attempted_on TEXT NOT NULL
);`);

function hostOf(u) {
  if (!u) return "(no link)";
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return u.split("/")[2] || "(unparsed)";
  }
}

/**
 * A link that points at a preprint server or a thesis repository. Only the URL
 * is consulted: the same article often has both a journal DOI and a server copy,
 * and it is the copy we are about to fetch that decides whether it is worth
 * fetching.
 */
function kindOfLink(u) {
  if (!u) return "unknown";
  const s = String(u).toLowerCase();
  if (/10\.1101\/|biorxiv|medrxiv|chemrxiv|arxiv|preprints\.org|osf\.io\/preprint/.test(s)) return "preprint";
  if (/scholarsportal|scholarsbank|vtechworks|etd|theses|dissert|proquest|vuir\.library/.test(s)) return "thesis";
  return "article";
}

const rows = db
  .prepare(
    `SELECT c.row_uid, c.cited_tool, c.cited_paper, c.citing_title, c.citing_authors, c.citing_url,
            c.citing_year, c.citing_article_type, c.status, c.pdf_file,
            d.discover_state, d.discover_note, d.pdf_url, d.doi
       FROM citation c
       LEFT JOIN candidate d ON d.row_uid = c.row_uid
      WHERE c.status IN ('held','review') AND lower(c.citing_title) NOT LIKE '%correction%'
      ORDER BY c.row_uid`
  )
  .all();

const attempts = new Map(db.prepare("SELECT * FROM download_attempt").all().map((a) => [a.row_uid, a]));

/** The link we would actually fetch: the article page, or the direct PDF if that is all we have. */
function linkOf(r) {
  return r.citing_url || r.pdf_url || "";
}

function classify(r) {
  const a = attempts.get(r.row_uid);
  if (a) return a.status;
  if (r.pdf_file && fs.existsSync(path.join(PKT, r.pdf_file))) return "downloaded";
  const k = kindOfLink(linkOf(r));
  if (k === "preprint") return "skipped-preprint";
  if (k === "thesis") return "skipped-thesis";
  if (r.discover_state === "no-open-copy" || r.discover_state === "not-in-indexes") return "no-open-copy";
  return "pending";
}

const info = rows.map((r) => ({ ...r, kind: kindOfLink(linkOf(r)), state: classify(r), attempt: attempts.get(r.row_uid) }));

const mark = flag("mark");
if (mark) {
  const [uid, st] = mark.split("=");
  if (!STATUS.includes(st)) {
    console.log(`FAIL: status must be one of ${STATUS.join(", ")}`);
    process.exit(1);
  }
  const row = info.find((i) => i.row_uid === uid);
  if (!row) {
    console.log(`FAIL: ${uid} is not in the queue`);
    process.exit(1);
  }
  db.prepare(
    `INSERT INTO download_attempt (row_uid, url, host, status, note, attempted_on)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(row_uid) DO UPDATE SET status = excluded.status, note = excluded.note,
       attempted_on = excluded.attempted_on, url = excluded.url, host = excluded.host`
  ).run(uid, linkOf(row), hostOf(linkOf(row)), st, flag("note") || "", new Date().toISOString().slice(0, 10));
  console.log(`${uid} -> ${st}${flag("note") ? ` (${flag("note")})` : ""}`);
  process.exit(0);
}

const counts = {};
for (const r of info) counts[r.state] = (counts[r.state] || 0) + 1;
console.log(`Queue: ${info.length} held/review rows.`);
for (const [k, v] of Object.entries(counts).sort((a, b) => b[1] - a[1])) console.log(`  ${k.padEnd(18)} ${v}`);

const pending = info.filter((r) => r.state === "pending" || r.state === "walled" || r.state === "failed");
const byHost = {};
for (const r of pending) (byHost[hostOf(linkOf(r))] ||= []).push(r);

if (has("list") || flag("host")) {
  const want = flag("host").toLowerCase();
  for (const [h, list] of Object.entries(byHost).sort((a, b) => b[1].length - a[1].length)) {
    if (want && !h.includes(want)) continue;
    console.log(`\n--- ${h} (${list.length})`);
    for (const r of list) {
      console.log(
        `  ${r.row_uid} ${r.state.padEnd(8)} ${r.citing_year || "????"} [${r.cited_tool || (r.cited_paper || "").slice(0, 26)}] ${(r.citing_authors || "").split(",")[0]} — ${(r.citing_title || "").slice(0, 56)}`
      );
    }
  }
} else {
  console.log(`\nFetchable now (pending/walled/failed): ${pending.length} rows across ${Object.keys(byHost).length} hosts.`);
  for (const [h, list] of Object.entries(byHost).sort((a, b) => b[1].length - a[1].length)) {
    console.log(`  ${String(list.length).padStart(3)}  ${h}`);
  }
  console.log("\nUse --list, --host=<substr>, or --export.");
}

if (has("export")) {
  const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const cols = ["row_uid", "state", "kind", "host", "cited_tool", "citing_year", "citing_authors", "citing_title", "url", "note"];
  const lines = [cols.join(",")];
  for (const r of info) {
    lines.push([r.row_uid, r.state, r.kind, hostOf(linkOf(r)), r.cited_tool, r.citing_year, r.citing_authors, r.citing_title, linkOf(r), r.attempt?.note || ""].map(esc).join(","));
  }
  const out = path.join(PKT, "download-queue.csv");
  fs.writeFileSync(out, "\uFEFF" + lines.join("\r\n") + "\r\n", "utf8");
  console.log(`\nwrote download-queue.csv (${info.length} rows)`);
}

/**
 * Recover citing-article PDFs the browser saved into the OS Downloads folder.
 *
 * ASM (and PNAS) answer a PDF request with `Content-Disposition: attachment`, so
 * Chrome writes a file into ~/Downloads and the in-page fetch never sees a body.
 * A driver that re-navigated on each capture retry produced another copy each
 * time - the same article four times over. Those files ARE the captures.
 *
 * A file name is only a hint (MDPI saves as `ijms-27-06134.pdf`), so identity is
 * taken from the PRINTED title: the largest font band on page 1, which is the
 * article title on ASM / MDPI / Frontiers layouts. Matching on body text instead
 * lets an unrelated row score well, because a 22-page article mentions everything.
 *
 * Rows sharing a `citing_url` are duplicate listings of ONE citation, so a single
 * PDF is filed for the group and the siblings record a pointer rather than a
 * second multi-megabyte copy. A row whose only prior verdict was failed / walled /
 * no-open-copy is open again - this file supersedes it. A skipped-preprint /
 * -thesis / -book verdict is a screening decision and is left alone.
 *
 *   node scripts/recover-downloads.js            dry run
 *   node scripts/recover-downloads.js --write    file + mark
 */
const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const { PKT, heldPdfIndex } = require("./lib.js");
const OUT = path.join(PKT, "downloads");
const DL = path.join(process.env.USERPROFILE || process.env.HOME, "Downloads");
const pdfjs = require(path.join(PKT, "node_modules/pdfjs-dist"));
const write = process.argv.includes("--write");

const STOP = new Set(("a an and as at but by for in into it of on or the to with from " +
  "using use used study studies analysis based via onto upon their its this that these those " +
  "which who whom whose than then when while where across during before after between both").split(/\s+/));
const norm = s => String(s || "").toLowerCase().replace(/[^a-z0-9\u00c0-\u024f ]+/g, " ").split(/\s+/).filter(w => w.length > 2 && !STOP.has(w));
const hostOf = u => { try { return new URL(u).hostname; } catch (e) { return "downloads"; } };

const db = new DatabaseSync(PKT + "/notable-citations.sqlite", { readOnly: true });
const rows = db.prepare(`SELECT row_uid AS uid, folder_uid AS fuid, citing_title AS title, citing_url AS url,
  cites_id, status, citing_venue AS venue, citing_year AS yr, pdf_file, source_pdf FROM citation
  WHERE citing_title IS NOT NULL AND citing_title != ''`).all();
const held = heldPdfIndex(db);
const att = new Map(db.prepare("SELECT row_uid, status FROM download_attempt").all().map(r => [r.row_uid, r.status]));
db.close();
const pre = rows.map(r => ({ ...r, toks: [...new Set(norm(r.title))] })).filter(r => r.toks.length >= 3);
// Rows sharing one citing_url are duplicate listings of the SAME citation, so a
// single PDF legitimately stands for all of them.
const byUrl = new Map();
for (const r of rows) { if (r.url) { if (!byUrl.has(r.url)) byUrl.set(r.url, []); byUrl.get(r.url).push(r.row_uid || r.uid); } }

const files = fs.readdirSync(DL).filter(f => f.toLowerCase().endsWith(".pdf")).map(f => {
  const st = fs.statSync(path.join(DL, f));
  return { name: f, path: path.join(DL, f), size: st.size, mtime: st.mtimeMs, base: f.replace(/\s*\(\d+\)\.pdf$/i, ".pdf") };
});
const byBase = new Map();
for (const f of files) { const c = byBase.get(f.base); if (!c || f.size > c.size) byBase.set(f.base, f); }
const uniq = Array.from(byBase.values()).sort((a, b) => b.mtime - a.mtime);

// Biggest glyph height on page 1 = the title's font size; collect that band.
async function printedTitle(f) {
  try {
    const doc = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(f)), useSystemFonts: true, isEvalSupported: false }).promise;
    const pages = doc.numPages;
    const page = await doc.getPage(1);
    const tc = await page.getTextContent();
    let max = 0;
    const items = [];
    for (const it of tc.items) {
      const h = Math.abs(it.transform[3]) || it.height || 0;
      const s = String(it.str || "").trim();
      if (!s || h <= 0) continue;
      items.push({ s, h, y: it.transform[5] });
      if (s.replace(/[^A-Za-z]/g, "").length >= 3 && h > max) max = h;
    }
    // Ignore a masthead/journal banner taller than the title by requiring the band
    // to carry at least 25 letters; walk down the page collecting same-size runs.
    const bands = new Map();
    for (const it of items) {
      const k = Math.round(it.h * 2) / 2;
      if (!bands.has(k)) bands.set(k, []);
      bands.get(k).push(it);
    }
    let best = "";
    const sizes = Array.from(bands.keys()).sort((a, b) => b - a);
    for (const k of sizes.slice(0, 6)) {
      const run = bands.get(k).sort((a, b) => b.y - a.y).map(x => x.s).join(" ").replace(/\s+/g, " ").trim();
      const letters = run.replace(/[^A-Za-z]/g, "").length;
      if (letters < 25) continue;
      if (/copyright|licensee|open access|academic editor|creative commons|doi|issn/.test(run)) continue;
      best = run; break;
    }
    await doc.destroy();
    return { pages, title: best };
  } catch (e) { return { pages: -1, title: "", err: String(e).slice(0, 40) }; }
}

(async () => {
  const out = [];
  for (const f of uniq) {
    // A file already named cit-NNNNNN has its own identity; trust it and verify.
    const named = (f.base.match(/^cit-\d{6}/i) || [null])[0];
    const t = await printedTitle(f.path);
    const pt = new Set(norm(t.title));
    // pdfjs splits ligatured words ("fi larial"); a space-free haystack lets a
    // catalog word match across such a break without inventing a new word.
    const flat = norm(t.title).join("");
    let cands = [];
    if (named) {
      const r = rows.find(x => (x.row_uid || x.uid) === named);
      if (r) cands = [{ r, sc: 1 }];
    } else {
      cands = pre.map(r => { let h = 0; for (const w of r.toks) if (pt.has(w) || flat.includes(w)) h++; return { r, sc: h / r.toks.length }; })
        .sort((a, b) => b.sc - a.sc).slice(0, 3);
    }
    const top = cands[0];
    // Rows sharing a citing_url are duplicate listings of ONE citation, so a tie
    // inside that group is not ambiguity - the same PDF stands for all of them.
    const group = top ? [...new Set([top.r.row_uid || top.r.uid, ...(byUrl.get(top.r.url) || [])])] : [];
    const rivals = cands.slice(1).filter(c => !group.includes(c.r.row_uid || c.r.uid));
    const gap = rivals.length ? top.sc - rivals[0].sc : 1;
    let v = "no-match";
    if (!top) v = "no-catalog-row";
    else if (top.sc < 0.7) v = "weak(" + top.sc.toFixed(2) + ")";
    else if (top.sc >= 0.7 && gap < 0.05 && !named) v = "ambiguous(" + top.sc.toFixed(2) + ")";
    else if (t.pages < 2) v = "short-pdf";
    else if (/not certified by peer review|granted (bioRxiv|medRxiv|chemRxiv) a license/i.test(t.title)) v = "preprint";
    else v = "MATCH";
    out.push({ f, uid: top && (top.r.row_uid || top.r.uid), sc: top && +top.sc.toFixed(2), v, group,
      printed: t.title.slice(0, 95), row: top && top.r, pages: t.pages });
  }
  const seen = new Set();
  const copied = new Map();
  let filed = 0;
  const marks = [];
  // Filed PDFs are named <uid>.pdf or <uid>-Surname.pdf, so match on the prefix.
  const stagedNames = fs.readdirSync(OUT).filter(f => f.toLowerCase().endsWith(".pdf"));
  const fileFor = uid => stagedNames.find(f => f.toLowerCase().startsWith(uid.toLowerCase())) || null;
  // Another catalog row may already hold this article on disk (two Scholar
  // listings of one work under different urls). Returns the path if so.
  function heldElsewhere(o, uid) {
    const want = new Set(norm(o.printed));
    if (want.size < 3) return null;
    for (const r of pre) {
      const rid = r.row_uid || r.uid;
      if (rid === uid || o.group.includes(rid)) continue;
      if (r.toks.length !== want.size) continue;
      let h = 0; for (const w of r.toks) if (want.has(w)) h++;
      if (h / r.toks.length < 0.9) continue;
      const hh = held(r.fuid, r);
      if (hh.held) return hh.why;
    }
    return null;
  }
  for (const o of out) {
    console.log(`${o.v.padEnd(16)} ${(o.uid || "-").padEnd(11)} ${(o.sc ?? "-").toString().padEnd(5)} p=${String(o.pages).padEnd(3)} ${(o.f.size / 1048576).toFixed(1).padStart(5)}MB  ${o.f.name.slice(0, 60)}`);
    console.log(`     printed: ${o.printed}`);
    if (o.v !== "MATCH") continue;
    // A row nobody touched, or one whose only verdict was "couldn't get it"
    // (failed / walled / no-open-copy), is open: this file supersedes that.
    // skipped-preprint / -thesis / -book are screening decisions and stay put.
    const fresh = o.group.filter(u => !att.has(u) || ["failed", "walled", "no-open-copy"].includes(att.get(u)));
    if (o.group.length > 1) console.log(`     group (one article, ${o.group.length} citations): ${o.group.join(", ")}`);
    // One PDF can stand for the whole group: give the bytes to the first row that
    // needs them and point the rest at that file instead of storing duplicates.
    let rep = null;
    for (const u of fresh) {
      if (seen.has(u)) continue;
      seen.add(u);
      const mark = { uid: u, src: o.row.url, host: hostOf(o.row.url) };
      const dest = path.join(OUT, u + ".pdf");
      if (fs.existsSync(dest) || copied.has(u)) { rep = rep || u; console.log(`     ${u}: already filed`); continue; }
      const kin = o.group.filter(x => x !== u).find(x => fileFor(x) || copied.has(x));
      if (kin) {
        const kf = fileFor(kin) || `downloads/${kin}.pdf`;
        console.log(`     ${u}: same work already filed as ${kf} (pointer only)`);
        marks.push({ ...mark, note: `same work held as ${kf}; no duplicate copy filed` });
        continue;
      }
      // A different catalog row may already hold this exact article (two Scholar
      // listings of one work under different urls); don't store 26MB twice.
      const elsewhere = heldElsewhere(o, u);
      if (elsewhere) {
        console.log(`     ${u}: same article already on file as ${elsewhere} (pointer only)`);
        marks.push({ ...mark, note: `same article already on file at ${elsewhere}; no duplicate copy filed` });
        continue;
      }
      const rr = rows.find(x => (x.row_uid || x.uid) === u);
      const h = held(rr && rr.fuid, rr);
      if (h.held) {
        console.log(`     ${u}: already held (${h.why.slice(0, 70)})`);
        marks.push({ ...mark, note: "recovered from ~/Downloads; copy already on file at " + h.why });
        continue;
      }
      if (rep) {
        console.log(`     ${u}: pointer -> downloads/${rep}.pdf (same article, ${o.group.length} citations)`);
        marks.push({ ...mark, note: `same article filed as downloads/${rep}.pdf; one PDF for ${o.group.length} citations` });
        continue;
      }
      rep = u;
      marks.push({ ...mark, note: "recovered from ~/Downloads: " + o.f.name.slice(0, 90) });
      if (!write) { copied.set(u, o.f.path); continue; }
      fs.copyFileSync(o.f.path, dest); copied.set(u, dest); filed++;
      console.log(`     ${u}: filed -> downloads/${u}.pdf`);
    }
  }
  console.log(`\n${uniq.length} distinct Downloads PDFs; ${out.filter(x => x.v === "MATCH").length} matched; ${filed} filed; ${marks.length} rows to mark.${write ? "" : " (dry run)"}`);
  for (const m of marks) console.log(`   mark ${m.uid}  ${m.note.slice(0, 100)}`);

  if (write && marks.length) {
    const w = new DatabaseSync(PKT + "/notable-citations.sqlite");
    const st = w.prepare(`INSERT INTO download_attempt (row_uid, url, host, status, note, attempted_on)
      VALUES (?, ?, ?, 'downloaded', ?, datetime('now'))
      ON CONFLICT(row_uid) DO UPDATE SET status='downloaded', note=excluded.note, attempted_on=excluded.attempted_on`);
    w.exec("BEGIN");
    for (const m of marks) st.run(m.uid, m.src || "browser download (~/Downloads)", m.host, m.note);
    w.exec("COMMIT"); w.close();
    console.log("attempts recorded: " + marks.length);
  }
})();

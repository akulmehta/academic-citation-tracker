"use strict";
/**
 * Download candidate PDFs into `downloads/` for filing.
 *
 * This is the plain-HTTP stage: it asks a URL directly and keeps only bytes that
 * really are a PDF. It never solves or retries a challenge, and it never records
 * an access result as a finding about the paper — a throttled or failed request
 * comes back `unknown` and the row is left alone, per `http.js`.
 *
 * A URL may point at an article *page* rather than a file. In that case the page
 * is searched for the PDF it offers (`citation_pdf_url`, then an explicit `.pdf`
 * href), which is how a repository or a PMC record is reached without guessing at
 * a path.
 *
 * Nothing here touches the database or a citation folder. Filing is
 * `file-pdf.js`, which checks the title before a file may sit in an evidence
 * folder — so a wrong paper cannot be filed by this tool even if it downloads one.
 *
 *   node scripts/fetch-downloads.js --list=downloads/_fetchlist.json
 *   … --only=cit-000531        (one row)
 */
const fs = require("fs");
const path = require("path");
const { PKT, openPacket } = require("./lib.js");
const { get, sleep } = require("./http.js");

const argv = process.argv.slice(2);
const opt = (n) =>
  (argv.find((a) => a.startsWith(`--${n}=`)) || "").split("=").slice(1).join("=") || null;

const LIST = opt("list") || path.join("downloads", "_fetchlist.json");
const ONLY = opt("only");
const OUT = path.join(PKT, "downloads");
const PDF_MAGIC = Buffer.from("%PDF");

/** Absolute or relative -> absolute, against the packet folder. */
function abs(p) {
  return path.isAbsolute(p) ? p : path.join(PKT, p);
}

/** Pull PDF candidates out of an article page. */
function pdfLinks(html, baseUrl) {
  const out = [];
  const push = (u) => {
    if (!u) return;
    try {
      out.push(new URL(u.replace(/&amp;/g, "&"), baseUrl).href);
    } catch {
      /* a relative path with no usable base is not a link we can follow */
    }
  };
  for (const m of html.matchAll(
    /<meta[^>]+name=["']citation_pdf_url["'][^>]+content=["']([^"']+)["']/gi,
  ))
    push(m[1]);
  for (const m of html.matchAll(/<a[^>]+href=["']([^"'?]*\.pdf(?:\?[^"']*)?)["']/gi)) push(m[1]);
  // Repositories often route a "download" through a bitstream/service URL.
  for (const m of html.matchAll(/href=["']([^"']*(bitstream|download|services\/file)[^"']*)["']/gi))
    push(m[1]);
  const seen = new Set();
  return out.filter((u) => (seen.has(u) ? false : (seen.add(u), true)));
}

async function main() {
  const list = JSON.parse(fs.readFileSync(abs(LIST), "utf8"));
  fs.mkdirSync(OUT, { recursive: true });
  const db = openPacket();
  const titleOf = db.prepare(`SELECT citing_title, citing_senior_author FROM citation WHERE row_uid=?`);

  const results = [];
  for (const item of list) {
    if (ONLY && item.row_uid !== ONLY) continue;
    const c = titleOf.get(item.row_uid) || {};
    let res = await get(item.url, {
      accept: item.html ? "text/html,*/*" : "application/pdf,*/*",
      timeoutMs: 90_000,
    });
    let via = item.url;

    if (res.ok && !res.body.subarray(0, 4).equals(PDF_MAGIC)) {
      const html = res.body.toString("utf8");
      const links = pdfLinks(html, res.url || item.url);
      let found = null;
      for (const l of links.slice(0, 4)) {
        const r2 = await get(l, { accept: "application/pdf,*/*", timeoutMs: 90_000 });
        if (r2.ok && r2.body.subarray(0, 4).equals(PDF_MAGIC)) {
          found = { r2, l };
          break;
        }
        await sleep(1200 + Math.random() * 1500);
      }
      if (found) {
        res = found.r2;
        via = found.l;
      } else {
        results.push({
          row_uid: item.row_uid,
          outcome: links.length ? "page-had-no-pdf" : "not-a-pdf",
          detail: `${res.contentType || "?"}, ${links.length} candidate link(s)`,
          url: item.url,
        });
        continue;
      }
    }

    if (!res.ok) {
      results.push({
        row_uid: item.row_uid,
        outcome: res.unknown ? "lookup-failed" : `http-${res.status}`,
        detail: (res.note || "").slice(0, 160),
        url: item.url,
      });
      continue;
    }

    const slug = String(c.citing_senior_author || "article")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^A-Za-z]/g, "");
    const file = `${item.row_uid}-${slug || "article"}.pdf`;
    const outAbs = path.join(OUT, file);
    fs.writeFileSync(outAbs, res.body);
    results.push({
      row_uid: item.row_uid,
      outcome: "saved",
      detail: `${(res.body.length / 1048576).toFixed(2)} MB via ${via.slice(0, 90)}`,
      file: `downloads/${file}`,
    });
    console.log(`  ${item.row_uid} saved ${(res.body.length / 1048576).toFixed(2)} MB -> downloads/${file}`);
    await sleep(3500 + Math.random() * 3500);
  }

  console.log("\n-- outcome --");
  for (const r of results)
    console.log(`${r.row_uid.padEnd(11)} ${r.outcome.padEnd(16)} ${r.detail}`);
  const bad = results.filter((r) => r.outcome !== "saved").length;
  console.log(`\n${results.filter((r) => r.outcome === "saved").length} saved, ${bad} not.`);
  db.close();
}
main();

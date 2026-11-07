"use strict";
/**
 * Fetch one citing-article PDF through a real browser, for the case where the
 * publisher blocks a plain HTTP request (Wiley answers `curl` with 403) but the
 * article itself is open access.
 *
 * This does NOT solve, bypass, or retry any challenge. If a CAPTCHA or an
 * unusual-traffic screen appears, the script says so, keeps the window open, and
 * waits for the applicant to clear it by hand — the same conduct the Independent
 * Citation Record follows. Request volume is one page plus one file.
 *
 * It reuses the record's own pacing module (`tools/human.js`) and its persistent
 * profile (`tools/.playwright-profile`, git-ignored) so an access grant the
 * applicant already obtained carries over and fewer challenges appear. Both are
 * READS: nothing in the record is written, and the downloaded file lands in the
 * packet folder.
 *
 *   node scripts/fetch-browser-pdf.js --row=cit-000563 \
 *        --url=https://onlinelibrary.wiley.com/doi/10.1111/cmi.13326
 *
 * The output is only bytes on disk. Registering them — the title check, the
 * `file` row, `citation.pdf_file` — is `file-pdf.js`, so this tool cannot file a
 * PDF that is not the article the folder stands for.
 */
const fs = require("fs");
const path = require("path");
const { PKT, REPO, PDF_ROOT, openPacket } = require("./lib.js");

// Playwright lives in the record's tools folder; the packet has no copy and does
// not need one. Resolving it from there is a read.
const pace = require(path.join(REPO, "tools", "human.js"));
const PROFILE = path.join(REPO, "tools", ".playwright-profile");

const argv = process.argv.slice(2);
const opt = n => (argv.find(a => a.startsWith(`--${n}=`)) || "").split("=").slice(1).join("=") || null;
const ROW = opt("row");
const URL_IN = opt("url");
const WAIT_MS = Number(opt("wait") || "420000"); // 7 min for a human to clear a wall

/** Text that means we are looking at a wall, not an article. */
const WALL = /just a moment|attention required|verify you are human|unusual traffic|access denied|enable javascript|checking your browser|are you a robot|request blocked|perimeterx|incapsula|please verify|captcha/i;

/** Where a publisher puts the article PDF. Ordered by how direct the hit is. */
const PDF_HREF = /(\/doi\/epdf|\/doi\/pdf|\.pdf(?:\?|$|#)|epdf)/i;

/**
 * Words in the article's own title that should appear once the real page is up.
 * Stopwords and short words are skipped so a title like "Involvement of
 * N-glycans in binding of Photorhabdus luminiscentus" is judged on its content
 * words, and a challenge page that shares only "of" cannot pass.
 */
const STOP = new Set("a an and as at by for from in into of on or the to with without within".split(" "));

function titleWords(t) {
  return String(t || "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/[\s-]+/)
    .filter(w => w.length >= 5 && !STOP.has(w));
}

async function pageState(page) {
  const [title, url, text, meta] = await Promise.all([
    page.title().catch(() => ""),
    Promise.resolve(page.url()),
    page.evaluate(() => document.body?.innerText || "").catch(() => ""),
    page
      .evaluate(() =>
        [...document.querySelectorAll('meta[name="citation_title"],meta[property="og:title"],meta[name="title"]')]
          .map(m => m.getAttribute("content") || "")
          .join(" | ")
      )
      .catch(() => ""),
  ]);
  const head = `${title} ${text.slice(0, 1500)}`;
  return {
    title,
    url,
    text,
    meta,
    wall: WALL.test(head),
    // A challenge interstitial often has almost no text at all. An empty body is
    // not "the wall went away"; it is the page not having arrived.
    thin: text.trim().length < 250,
  };
}

/**
 * Positive readiness: the article itself, not merely the absence of wall words.
 * Requires most of the title's content words to appear in the page title, the
 * citation metadata, or the top of the body. Without this check a Cloudflare
 * interstitial that had just swapped its own wording counted as "cleared", and
 * the run reported zero PDF links on a page that was never the article.
 */
function isReady(st, expectWords) {
  if (st.wall || st.thin) return false;
  if (!expectWords.length) return true;
  const hay = `${st.title} ${st.meta} ${st.text.slice(0, 4000)}`.toLowerCase();
  const hit = expectWords.filter(w => hay.includes(w)).length;
  return hit / expectWords.length >= 0.7;
}

/**
 * Wait for the article to be on screen. Polls rather than blocking on a terminal
 * prompt, because the applicant interacts with the browser window, not with this
 * console. Gives up loudly — a timeout is reported, never treated as "no copy
 * available".
 */
async function waitForHuman(page, expectWords) {
  const deadline = Date.now() + WAIT_MS;
  let said = "";
  while (Date.now() < deadline) {
    const st = await pageState(page);
    if (isReady(st, expectWords)) return st;
    const msg = st.wall
      ? `Access wall in the browser window (${st.title.slice(0, 60) || "untitled"}).\nNot attempting to solve it. Clear it in the window, then the fetch continues on its own.`
      : st.thin
        ? `Page is nearly empty (${st.title.slice(0, 60) || "untitled"}) — the article has not arrived.\nWaiting. If a check is needed, do it in the window.`
        : `The article title is not on this page yet (${st.title.slice(0, 60) || "untitled"}).\nWaiting. Sign in or open the full text in the window if asked.`;
    if (msg !== said) {
      said = msg;
      console.log("\n--------------------------------------------------------------");
      console.log(msg);
      console.log("--------------------------------------------------------------");
    }
    await pace.sleep(3000);
  }
  return { ...await pageState(page), timedOut: true };
}

/** Every plausible PDF link on the page, absolute. */
async function pdfLinks(page) {
  const hrefs = await page.evaluate(() =>
    [...document.querySelectorAll("a[href]")].map(a => ({
      href: a.href,
      text: (a.innerText || a.getAttribute("title") || "").trim().slice(0, 60),
    }))
  ).catch(() => []);
  const seen = new Set();
  return hrefs.filter(h => {
    if (!PDF_HREF.test(h.href) || seen.has(h.href)) return false;
    // An external DOI resolver or a cited-reference PDF is not this article.
    seen.add(h.href);
    return true;
  });
}

async function main() {
  if (!ROW || !/^cit-\d+$/.test(ROW) || !URL_IN) {
    console.error("usage: node scripts/fetch-browser-pdf.js --row=cit-000563 --url=https://… [--wait=ms]");
    process.exitCode = 2;
    return;
  }
  const db = openPacket();
  const row = db.prepare(`SELECT row_uid, citing_title, citing_senior_author, citing_year, cites_id
                          FROM citation WHERE row_uid=?`).get(ROW);
  if (!row) {
    console.error(`row ${ROW} is not in table citation — promote it first (promote-candidates.js)`);
    process.exitCode = 1; db.close(); return;
  }
  const cand = db.prepare(`SELECT discover_state, pdf_file FROM candidate WHERE row_uid=?`).get(ROW);
  if (cand?.pdf_file) {
    console.log(`candidate already has a file on disk: ${cand.pdf_file} — nothing to fetch.`);
    db.close(); return;
  }
  db.close();

  console.log(`row     ${row.row_uid}  ${row.citing_title?.slice(0, 70)}`);
  console.log(`senior  ${row.citing_senior_author || "?"}  year ${row.citing_year || "?"}`);
  console.log(`target  ${URL_IN}`);
  console.log(`profile ${PROFILE}  (persistent, git-ignored)`);

  fs.mkdirSync(PROFILE, { recursive: true });
  const context = await pace.launch(PROFILE);
  const page = context.pages()[0] || (await context.newPage());

  // A download Wiley serves inline never fires a `download` event, so keep the
  // response bodies whose content type says PDF: whichever route delivers the
  // bytes, the first real PDF response is the article.
  const pdfResponses = [];
  page.on("response", res => {
    const ct = (res.headers()["content-type"] || "").toLowerCase();
    if (ct.includes("application/pdf")) pdfResponses.push(res);
  });

  await pace.goto(page, URL_IN, { settle: [4000, 7000] });
  const expectWords = titleWords(row.citing_title);
  console.log(`waiting for the article title on screen, keyed on: ${expectWords.slice(0, 6).join(", ")}`);
  let st = await waitForHuman(page, expectWords);
  if (st.timedOut) {
    console.log(`\nGave up after ${Math.round(WAIT_MS / 60000)} min — the page still reads as a wall.`);
    console.log("Nothing was downloaded, and this is NOT a finding that no open copy exists.");
    await context.close();
    process.exitCode = 1;
    return;
  }
  console.log(`page    ${st.title.slice(0, 80)}`);

  // Prefer a link that is unambiguously "the PDF of this article".
  const links = await pdfLinks(page);
  console.log(`${links.length} PDF-looking link(s) on the page`);
  for (const l of links.slice(0, 8)) console.log(`   ${l.href.slice(0, 110)}  ${l.text ? "«" + l.text + "»" : ""}`);

  const outDir = path.join(PKT, "downloads");
  fs.mkdirSync(outDir, { recursive: true });
  const out = path.join(outDir, `${ROW}.pdf`);

  const save = async (buf, how) => {
    if (!buf || buf.subarray(0, 4).toString("latin1") !== "%PDF") {
      console.log(`   rejected: ${how} did not return PDF bytes`);
      return false;
    }
    fs.writeFileSync(out, buf);
    // `file-pdf.js` resolves a relative --src against `Citations/`, so print the
    // path in exactly that form.
    const relSrc = path.relative(PDF_ROOT, out).split(path.sep).join("/");
    console.log(`\nsaved ${(buf.length / 1024 / 1024).toFixed(1)} MB via ${how}`);
    console.log(`-> ${path.relative(PKT, out)}`);
    console.log(`\nNext: node scripts/file-pdf.js --folder=${ROW} --src="${relSrc}" --write`);
    return true;
  };

  // Route 1: click and catch a download.
  const clickable = links.find(l => /epdf|pdf/i.test(l.text)) || links[0];
  if (clickable) {
    try {
      console.log(`\ntrying download event from ${clickable.href.slice(0, 90)}`);
      const [dl] = await Promise.all([
        page.waitForEvent("download", { timeout: 30000 }).catch(() => null),
        page.click(`a[href="${clickable.href}"]`).catch(e => console.log(`   click failed: ${e.message.split("\n")[0]}`)),
      ]);
      if (dl) {
        const tmp = await dl.path();
        if (tmp && fs.existsSync(tmp) && await save(fs.readFileSync(tmp), "download event")) {
          await context.close(); return;
        }
      }
    } catch (e) {
      console.log(`   download route: ${e.message.split("\n")[0]}`);
    }
  }

  // Route 2: a PDF response the browser already received (inline reader).
  if (pdfResponses.length) {
    console.log(`\n${pdfResponses.length} PDF response(s) received; taking the largest`);
    const bodies = [];
    for (const res of pdfResponses) {
      try { bodies.push({ url: res.url(), buf: await res.body() }); } catch { /* stale body */ }
    }
    bodies.sort((a, b) => (b.buf?.length || 0) - (a.buf?.length || 0));
    for (const b of bodies) {
      if (await save(b.buf, `response ${b.url.slice(0, 70)}`)) { await context.close(); return; }
    }
  }

  // Route 3: ask the browser for it, in its own session, so the cookies that
  // cleared the wall come along.
  for (const l of links.slice(0, 4)) {
    try {
      const res = await context.request.get(l.href, { timeout: 60000, headers: { referer: st.url } });
      console.log(`   GET ${l.href.slice(0, 80)} -> ${res.status()}`);
      if (res.ok() && await save(await res.body(), "context request")) { await context.close(); return; }
    } catch (e) {
      console.log(`   request route ${l.href.slice(0, 60)}: ${e.message.split("\n")[0]}`);
    }
  }

  console.log("\nNo PDF bytes obtained. The page was reached; the file was not.");
  console.log("This is a finding about access, not about whether the article exists.");
  await context.close();
  process.exitCode = 1;
}
main();

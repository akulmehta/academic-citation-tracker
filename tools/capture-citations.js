// Capture a Google Scholar "citing articles" page and classify independence.
//
// Usage:
//   node capture-citations.js --cites="<cites url>" --name="<file name>" \
//        --paper="<view_citation url>" --me="Mehta"
//
// What it does:
//   1. Opens the user's own article page (view_op=view_citation) and reads the
//      FULL author list. Scholar truncates author strings on list pages, so the
//      detail page is read instead of guessing.
//   2. Opens the citing-articles page for that work.
//   3. Extracts every citing entry: title, author string, venue/year, and
//      whether the author string was truncated with "...".
//   4. Classifies each entry:
//        DEPENDENT   - a profile author surname appears in the citing authors
//        INDEPENDENT - no surname match AND the author list is complete
//        REVIEW      - no surname match but the author list is truncated, so
//                      independence is NOT yet verified
//   5. Highlights INDEPENDENT titles in yellow and REVIEW titles in orange in
//      the live page, then pauses so the user can inspect/adjust.
//   6. Saves PDF + HTML + PNG + a JSON report + a Markdown review sheet.
//   7. Never solves a CAPTCHA; pauses for the user and aborts if still blocked.

const fs = require("fs");
const path = require("path");
const readline = require("readline");
const { chromium } = require("playwright");
const pace = require("./human");
const lib = require("./tally");
const { PRINT_OPTIONS } = require("./print-settings");

const ROOT = path.resolve(__dirname, "..");
const EXHIBITS = path.join(ROOT, "Independent Citation Record", "Exhibits");
// Exhibit PDFs are what get filed, so they live on their own for easy review.
// Everything else - saved HTML, screenshots, report JSON, review notes - is
// supporting workpaper and is kept out of the way.
//
// --out=NAME sends this run's PDFs into Exhibits/PDFs/NAME so a production
// batch stays apart from earlier samples instead of mixing with them. Only a
// plain folder name is accepted, so a stray path cannot write outside the
// Exhibits tree.
function pdfDir() {
  const hit = process.argv
    .slice(2)
    .find((a) => a.startsWith("--out="))
    ?.slice("--out=".length);
  const name = String(hit || "").trim().replace(/[\\/:*?"<>|]/g, "");
  return name ? path.join(EXHIBITS, "PDFs", name) : path.join(EXHIBITS, "PDFs");
}

const PDF_DIR = pdfDir();
const SUPPORT_DIR = path.join(EXHIBITS, "Supporting");
const USER_DATA_DIR = path.join(__dirname, ".playwright-profile");

const CAPTCHA_MARKERS = [
  "unusual traffic",
  "not a robot",
  "recaptcha",
  "enable js and cookies",
  "our systems have detected",
];

function log(msg) {
  console.log(`[cites] ${msg}`);
}

function arg(name, fallback = "") {
  const hit = process.argv
    .slice(2)
    .find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}

function ask(question) {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  return new Promise((resolve) =>
    rl.question(question, (a) => {
      rl.close();
      resolve(a);
    })
  );
}

// A citing-articles list is identified by its cites= parameter. Do not test
// for oi=bibs: Scholar's own "Next" page links omit it, so doing so made every
// page after the first look like the wrong page. That discarded valid captures
// and, inside the Cite-popup loop, re-navigated the list after each resolution.
function isCitingListUrl(url) {
  return /[?&]cites=\d+/.test(String(url || ""));
}

async function blocked(page) {
  const text = await page
    .evaluate(() => document.body?.innerText || "")
    .catch(() => "");
  const low = text.toLowerCase();
  return CAPTCHA_MARKERS.some((m) => low.includes(m));
}

// Pure decision behind endOfListReason, so the cases can be tested offline.
// A page with no result rows is never "the end" - that is a block or a bad
// page. A page with rows and a readable Next link never reaches here. The
// container itself is missing on a verification interstitial, which is how a
// wall is told apart from a results list that genuinely has nothing to show.
function classifyEndOfList({ container, rows, hasNext }) {
  if (!container) return "not-a-results-page";
  if (!rows) return "empty-results-list";
  if (hasNext) return "next-link-present-but-unreadable";
  return `last-page-of-results (${rows} row(s) on page)`;
}

// Only a genuine last page may end the walk cleanly. Anything else is treated
// as a truncated list, which keeps a soft block from filing a one-page exhibit
// for a multi-page publication that --skip-done would then never revisit.
function endOfListIsSuspicious(reason) {
  return reason !== "" && !reason.startsWith("last-page-of-results");
}

// Why a citing page showed no "Next" link. A run that stops at page 1 of a
// 17-record list is truncated, and the run used to end with exit 0 and no
// explanation. This distinguishes the three real cases: the wall (a
// consent/robot interstitial renders a page with no results at all), a
// results page that genuinely has no further pages, and a page that is not a
// results page (URL redirected, empty shell, or a soft block that shows none
// of the CAPTCHA wording above). Silent truncation is the worst outcome
// because --skip-done would then treat the publication as finished.
async function endOfListReason(page) {
  return page
    .evaluate(() => {
      const container = !!document.querySelector("#gs_res_ccl_mid");
      const rows = document.querySelectorAll("#gs_res_ccl_mid .gs_or").length;
      const bar = document.querySelector("#gs_n") || document.querySelector("#gs_nm");
      // Match only a forward control: an enabled "Previous" button must not be
      // read as a Next link, or a genuine last page would look truncated.
      const hasNext =
        !!bar?.querySelector("a:has(.gs_ico_nav_next)") ||
        [...(bar?.querySelectorAll("a,button") || [])].some(
          (x) =>
            !x.disabled &&
            /\bnext\b/i.test(x.innerText || x.getAttribute("aria-label") || "")
        );
      return { container, rows, hasNext };
    })
    .then(classifyEndOfList)
    .catch(() => "page unreadable");
}

// Saved once per run into Exhibits/Supporting, never into the PDFs folder.
// The point is a dated record of the screen that stopped the run, so the
// checkpoint described in the tracker can be verified rather than taken on
// trust. Failure to save it must never mask the block itself.
let wallSaved = false;
let activeContext = null;
async function saveWallEvidence(page) {
  if (wallSaved) return;
  wallSaved = true;
  try {
    fs.mkdirSync(SUPPORT_DIR, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const name = `BLOCKED-access-wall-${stamp}`;
    await page
      .screenshot({ path: path.join(SUPPORT_DIR, `${name}.png`), fullPage: true })
      .catch(() => {});
    fs.writeFileSync(path.join(SUPPORT_DIR, `${name}.html`), await page.content(), "utf8");
    log(`Evidence of the access wall saved to Exhibits/Supporting as ${name}`);
  } catch (e) {
    log(`Could not save evidence of the access wall: ${e.message}`);
  }
}

async function passWall(page) {
  if (!(await blocked(page))) return true;
  log("--------------------------------------------------");
  log("Access wall detected. I will NOT solve it.");
  log("Please complete the verification in the browser window.");
  log("--------------------------------------------------");
  // Keep a copy of what was actually shown. It is not an exhibit and must not
  // be filed with them; it is the record of where work stopped, which the
  // project instructions ask for when an access wall ends a session.
  await saveWallEvidence(page);
  // In --auto mode nobody may be at the keyboard, and an interactive prompt
  // would then hang the run indefinitely with the browser left open. Re-read
  // the page instead, which asks Scholar for nothing new, and give up after a
  // few minutes so the batch can record a checkpoint and stop cleanly.
  if (process.argv.includes("--auto")) {
    const deadline = Date.now() + 3 * 60 * 1000;
    while (Date.now() < deadline) {
      await pace.pause("waiting for the wall to clear", 20000, 25000);
      if (!(await blocked(page))) {
        log("The verification screen is gone. Continuing.");
        return true;
      }
    }
    log("Still blocked after 3 minutes. Stopping without retrying, as instructed.");
    return false;
  }
  await ask(">>> Press ENTER once Scholar is visible again. <<<\n");
  return !(await blocked(page));
}

// ---- Author name matching -------------------------------------------------
// Implemented in name-match.js so it can be unit tested offline.

const {
  parseAuthorList,
  toKeys: toNameKeys,
  evaluateEntry,
} = require("./name-match");

// External corroboration of author lists (PubMed, then OpenAlex).
const crosscheck = require("./crosscheck");

// What an external record does to a citation's state. Shared with
// tools/reapply-corroboration.js, which re-derives the same states over reports
// already filed, so a fresh capture and an offline re-apply cannot drift apart.
const { applyExternalVerdict } = require("./corroboration.js");

// The profile "view article" page exposes the complete author list in the
// citation detail table (#gsc_oci_table). Author strings on list pages are
// truncated with "...", so this page is the authoritative source.
async function readProfilePaper(page, url) {
  log(`Reading the user's own article page for the full author list...`);
  await pace.goto(page, url);
  if (!(await passWall(page))) return null;

  const data = await page.evaluate(() => {
    const table = document.querySelector("#gsc_oci_table");
    const fields = {};
    if (table) {
      const rows = [...table.querySelectorAll("tr")];
      for (const r of rows) {
        const k = r.querySelector("th")?.innerText?.trim() || "";
        const v = r.querySelector(".gsc_oci_value")?.innerText?.trim() || "";
        if (k) fields[k] = v;
      }
    }
    // Not every layout uses th/td pairs, so also read the plain text of the
    // detail table: a label line ("Authors") followed by its value line.
    const lines = (table?.innerText || "")
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    const after = (label) => {
      const i = lines.findIndex((l) => l.toLowerCase() === label.toLowerCase());
      return i >= 0 && i + 1 < lines.length ? lines[i + 1] : "";
    };
    return {
      title:
        document.querySelector("#gsc_oci_title")?.innerText?.trim() || "",
      authors: fields["Authors"] || after("Authors"),
      venue: fields["Journal"] || after("Journal") || after("Publication date"),
      fields,
    };
  });

  if (!data.authors) {
    log("WARNING: could not read a full author list from the article page.");
  }
  return data;
}

async function readCitingEntries(page, url) {
  log(`Opening the citing-articles page...`);
  await pace.goto(page, url);
  if (!(await blocked(page))) {
    // nothing
  } else {
    if (!(await passWall(page))) return null;
    // Clearing a verification does not reliably land the tab back on the
    // results page it was challenged on - it can leave a blank or a redirect.
    // That is what made a page reached by a "Next" link read as empty and let
    // a 17-record list file a one-page exhibit. Ask for the URL again.
    if (!isCitingListUrl(page.url())) {
      log(`Wall cleared but the tab left the citing list. Reopening it.`);
      await pace.pageGap("reopen after wall");
      await pace.goto(page, url);
      if (!(await passWall(page))) return null;
    }
  }

  // Read the page the way a person would: scroll through the results, then
  // come back to the top before extracting.
  await pace.humanScroll(page);
  await pace.pause("before extract", 1200, 3000);

  const header = await page.evaluate(() => {
    const h = document.querySelector("#gs_ab_md2, .gs_ab_md");
    return h?.innerText?.trim() || "";
  });

  // Scholar's own pagination links carry the offsets and the extra parameters
  // (as_sdt, sciodt, scipsc) that a hand-built start= URL drops. Reading the
  // "Next" href is what makes paging reliable; the desktop bar is #gs_n and
  // the touch layout uses #gs_nm.
  const nextPage = await page.evaluate(() => {
    for (const sel of ["#gs_n", "#gs_nm"]) {
      const bar = document.querySelector(sel);
      if (!bar) continue;
      const a =
        bar.querySelector("a:has(.gs_ico_nav_next)") ||
        [...bar.querySelectorAll("a")].find((x) =>
          /\bnext\b/i.test(x.innerText || x.getAttribute("aria-label") || "")
        );
      if (a?.href) return a.href;
    }
    return "";
  });

  // One block per result under #gs_res_ccl_mid; data-cid identifies the record.
  const entries = await page.evaluate(() => {
    const rows = [...document.querySelectorAll("#gs_res_ccl_mid .gs_or")];
    return rows.map((r, index) => {
      const titleEl = r.querySelector("h3.gs_rt") || r.querySelector(".gs_rt");
      const authorsEl = r.querySelector(".gs_a");
      const snippetEl = r.querySelector(".gs_rs");
      const anchor = titleEl?.querySelector("a");
      const rawTitle = titleEl ? titleEl.innerText.trim() : "";
      const authorText = authorsEl ? authorsEl.innerText.trim() : "";
      return {
        index,
        cid: r.getAttribute("data-cid") || r.getAttribute("data-aid") || "",
        title: rawTitle.replace(/^\[(?:PDF|HTML|DOC|摘要)\]\s*/i, ""),
        rawTitle,
        authors: authorText,
        snippet: snippetEl ? snippetEl.innerText.trim() : "",
        truncated: authorText.includes("…") || authorText.includes("..."),
        link: anchor ? anchor.href : "",
      };
    });
  });

  // Scholar can render the same record twice; keep the first per data-cid.
  const seen = new Set();
  const unique = [];
  for (const e of entries) {
    const key = e.cid || `t:${e.rawTitle.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(e);
  }
  if (unique.length !== entries.length) {
    log(`Deduplicated ${entries.length - unique.length} repeated result block(s).`);
  }

  // Recorded whenever the walk will stop here, so a truncated publication says
  // why in its own report rather than leaving only a short page count behind.
  const endReason = nextPage ? "" : await endOfListReason(page);

  return { header, entries: unique, nextPage, endReason };
}

// Read one citation record from Scholar's Cite popup without disturbing the
// results page.
//
// The "BibTeX" / "Reference Manager" controls are real links. Clicking one in
// place navigates this tab away from the results list, which previously left
// the saved exhibit showing a BibTeX record instead of the citing articles.
// So when the control exposes an href, the record is fetched in a separate tab
// that is closed afterwards.
//
// That href carries a short-lived signature (scisig/scisdr) and cd=-1, and
// Scholar serves a 404 for it fairly often - observed on roughly a third of the
// fetches for one publication. A 404 is NOT the verification screen: the
// results page keeps loading fine. It used to be logged as "could not parse
// authors", which hid the cause and left the author list truncated, so an entry
// that could have been decided was pushed to manual review. Two changes: report
// the actual status, and fall back to reading the record in place, after which
// the caller restores the results page before the exhibit is captured.
async function fetchCitationInTab(context, url) {
  const scratch = await context.newPage();
  try {
    await pace.pause("open citation record", 2000, 4500);
    let reason = "no citation record in the response";
    const res = await scratch
      .goto(url, { waitUntil: "domcontentloaded" })
      .catch((e) => {
        // Some controls serve a file rather than a page, which makes goto
        // reject with "Download is starting" rather than returning a response.
        reason = e.message.split("\n")[0];
        return null;
      });
    if (res && !res.ok()) {
      // No point polling a page Scholar has already refused.
      return { text: "", reason: `HTTP ${res.status()}` };
    }
    for (let attempt = 0; attempt < 10; attempt++) {
      const text = await scratch
        .evaluate(() => document.body?.innerText || "")
        .catch(() => "");
      if (/@\w+\s*\{|^\s*TY\s+-/m.test(text)) return { text };
      await pace.sleep(700);
    }
    return { text: "", reason };
  } finally {
    await scratch.close({ runBeforeUnload: false }).catch(() => {});
  }
}

async function readCitationText(page, tab, labelRe, opts = {}) {
  const href = await tab.getAttribute("href").catch(() => null);
  if (href && /^https?:\/\//.test(href)) {
    const url = new URL(href, page.url()).href;
    let outcome = await fetchCitationInTab(page.context(), url);
    if (outcome.text) {
      if (opts.readVia) opts.readVia.value = "tab";
      return outcome.text;
    }
    // A 404 here is often transient - the signed link is regenerated whenever
    // the popup opens, so one more attempt is worth the few seconds. The
    // caller then tries the other citation format, which is a different link
    // (scholar.ris / scholar.enw rather than scholar.bib) and does not always
    // fail the same way.
    await pace.sleep(1500);
    outcome = await fetchCitationInTab(page.context(), url);
    if (outcome.text) {
      if (opts.readVia) opts.readVia.value = "tab-retry";
      return outcome.text;
    }
    // Deliberately no click-in-place fallback here: the control is a real
    // link to the address that just failed, so clicking it only navigates this
    // tab to the same 404 and costs the results page. The caller restores the
    // list and the entry is judged on the evidence that does exist.
    log(`  citation record not readable (${outcome.reason})`);
    return "";
  }

  // No usable href, so the only way to read the record is to click it.
  await tab.click({ timeout: 5000 }).catch(() => {});
  if (opts.readVia) opts.readVia.value = "in-place";
  await tab.click({ timeout: 5000 }).catch(() => {});
  let text = "";
  for (let attempt = 0; attempt < 12; attempt++) {
    text = await page
      .evaluate(() => {
        const scoped = [
          document.querySelector("#gs_citi_bib"),
          document.querySelector("#gs_md_cita-b"),
          document.querySelector("#gs_citi"),
        ]
          .filter((e) => e && e.offsetParent !== null)
          .map((e) => e.innerText || e.value || "");
        const body = document.body?.innerText || "";
        return (
          [...scoped, body].find((t) => /@|^\s*TY\s+-/m.test(t)) || ""
        );
      })
      .catch(() => "");
    if (/@|^\s*TY\s+-/m.test(text)) break;
    await pace.sleep(700);
  }
  return text;
}

// Popup and read the BibTeX author field. This keeps verification inside
// Google Scholar, the project's primary source, instead of a third-party DB.
async function resolveAuthorsViaCitePopup(page, entries, listUrl) {
  const need = entries.filter((e) => e.truncated && e.status !== "DEPENDENT");
  if (need.length === 0) return entries;

  log(`Resolving ${need.length} truncated author list(s) via Scholar's Cite popup...`);
  const rows = page.locator("#gs_res_ccl_mid .gs_or");

  for (const entry of need) {
    // Match the row by title rather than by position: dedupe can shift the
    // index of the result blocks relative to the rendered list.
    const row = entry.rawTitle
      ? rows.filter({
          has: page.locator("h3.gs_rt", { hasText: entry.rawTitle.slice(0, 60) }),
        })
      : rows.nth(entry.index);
    const citeControl = row.locator("a.gs_or_cit").first();
    if (!(await citeControl.isVisible().catch(() => false))) {
      entry.resolution = "no cite control found for this entry";
      log(`  no cite control found for: ${entry.title}`);
      continue;
    }

    await pace.pause("open cite popup", 2500, 6000);
    await citeControl
      .click({ timeout: 10000 })
      .catch((e) => log(`  cite click failed: ${e.message}`));

    // The citation text is fetched asynchronously, so poll for real content
    // instead of trusting a fixed wait.
    const dialog = page.locator("#gs_citi").first();
    let shown = false;
    for (let attempt = 0; attempt < 12 && !shown; attempt++) {
      shown = await dialog
        .isVisible()
        .catch(() => false);
      if (!shown) await pace.sleep(700);
    }
    if (!shown) {
      entry.resolution = "cite popup never appeared";
      log("  cite popup did not open");
      continue;
    }

    // Read the citation text. The popup markup varies, so scan the rendered
    // page text for a BibTeX or RIS record rather than relying on one id.
    // Prefer BibTeX, then RIS/EndNote, which carries AU lines.
    const tabLabels = [/bibtex/i, /reference manager|endnote|ris/i];
    let parsed = null;
    let usedFormat = "";
    let sawOthers = false;
    // Records how the citation text arrived, so a report can show whether a
    // 404 on Scholar's signed BibTeX link was recovered on the retry.
    const readVia = { value: "" };
    let sawAnyText = false;

    for (const labelRe of tabLabels) {
      const tab = page
        .locator("#gs_citi button, #gs_citi a", { hasText: labelRe })
        .first();
      if (!(await tab.isVisible().catch(() => false))) continue;

      const text = await readCitationText(page, tab, labelRe, { readVia });
      if (text) {
        sawAnyText = true;
        entry.popup_sample = text.slice(0, 400);
      }

      const bib = text.match(/author\s*=\s*\{([\s\S]*?)\}\s*,/i);
      if (bib) {
        // BibTeX joins authors with " and ". Scholar abbreviates very long
        // lists with "and others", which is still an incomplete list.
        const list = bib[1].replace(/\s+/g, " ");
        sawOthers = /\band others\b/i.test(list);
        parsed = list
          .split(/\s+and\s+/i)
          .map((a) => a.trim())
          .filter((a) => a && !/^others$/i.test(a));
        usedFormat = "bibtex";
        break;
      }

      const ris = [...text.matchAll(/^AU\s+-\s*(.+)$/gim)].map((g) =>
        g[1].trim()
      );
      if (ris.length) {
        parsed = ris;
        usedFormat = "ris";
        break;
      }

      // Keep whatever sample an earlier format produced: an unreadable second
      // format returns "" and must not erase the first format's evidence.
      if (!parsed && text) entry.popup_sample = text.slice(0, 400);
    }

    if (parsed && parsed.length) {
      entry.full_authors = parsed;
      entry.author_source = `scholar-cite-${usedFormat}`;
      if (readVia.value) entry.citation_read_via = readVia.value;
      if (sawOthers) {
        // Scholar itself abbreviated the list, so a PI could still be hidden.
        entry.truncated = true;
        entry.resolution = "resolved but Scholar shows 'and others'";
        log(`  got ${parsed.length} authors but Scholar truncated with "and others"`);
      } else {
        entry.truncated = false;
        entry.resolution = "resolved";
        log(`  resolved via ${usedFormat}: ${parsed.length} authors`);
      }
    } else {
      entry.resolution = sawAnyText
        ? "citation record read but contained no author field"
        : "citation record could not be read";
      log(
        `  could not parse authors from the Cite popup` +
          (sawAnyText ? "" : " (no readable citation record)")
      );
      if (entry.popup_sample) {
        log(`  popup sample: ${entry.popup_sample.replace(/\s+/g, " ").slice(0, 200)}`);
      }
    }

    // The popup must be fully dismissed before highlighting and PDF capture,
    // otherwise the saved exhibit shows the citation text instead of the list.
    await page.keyboard.press("Escape").catch(() => {});
    await pace.sleep(600);
    for (let attempt = 0; attempt < 6; attempt++) {
      const stillOpen = await dialog
        .isVisible()
        .catch(() => false);
      if (!stillOpen) break;
      await page
        .locator(
          '#gs_md_cita-b .gs_md_cls, #gs_md_cita-b .gs_md_clo, [id^="gs_md_cita"] .gs_md_cls'
        )
        .first()
        .click({ timeout: 3000 })
        .catch(() => {});
      if (await dialog.isVisible().catch(() => false)) {
        await page.mouse.click(5, 5).catch(() => {});
      }
      await pace.sleep(600);
    }
    if (await dialog.isVisible().catch(() => false)) {
      entry.popup_left_open = true;
      log("  WARNING: cite popup would not close; stopping before capture");
      return entries;
    }

    // Safety net for the click-in-place fallback: if this tab ended up on a
    // citation record rather than the results list, put it back before the
    // exhibit is captured.
    if (listUrl && !isCitingListUrl(page.url())) {
      log("  results page was navigated away; restoring it");
      await pace.goto(page, listUrl);
      await pace.pause("after restoring list", 1500, 3000);
    }
  }
  return entries;
}

// Scholar's header looks like "About 248 results" or "1-10 of 248 results".
// Returns null when it cannot tell. On this profile's citing-articles pages the
// header renders empty, so it is usually null here; every report records it in
// page_header and it is a cross-check only, never the thing that ends a walk.
function parseResultCount(header) {
  const s = String(header || "").replace(/,/g, "");
  const m = s.match(/(\d+)\s*results?/i) || s.match(/of\s+(\d+)/i);
  return m ? parseInt(m[1], 10) : null;
}

// The guide is explicit: a non-English citation must not be highlighted unless
// a certified human translation exists. Machine translation does not count.
// Non-Latin scripts are decisive. Latin-script languages are caught with a
// short list of function words that English does not use, deliberately
// conservative so English titles are not falsely flagged; anything ambiguous is
// flagged for a human rather than decided here.
//
// Greek is deliberately NOT listed here. See isScientificNotation below: in
// this corpus a Greek letter is almost always a scientific symbol, and folding
// Greek into this set made the notation exemption a veto over the entire test,
// which let a Chinese title containing the alpha in GPIba through untouched.
// Greek-language titles are handled separately, from the title alone.
const NON_LATIN =
  /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\u0400-\u04ff\u0590-\u05ff\u0600-\u06ff\u0900-\u097f\u0e00-\u0e7f\u1100-\u11ff\uac00-\ud7af]/;

// Greek letters are scientific notation in English biochemistry titles, not a
// language signal: "Trends in oligomannosylation and \u03b11,2-mannosidase
// expression in human cancers" is English, and flagging it would wrongly
// suppress a genuine independent citation. A title actually written in Greek
// has Greek letters as the bulk of its text, so only a minority occurrence
// alongside substantial Latin text is treated as notation.
//
// The test is a SHARE, not a count. It used to be `greek <= 4`, which is
// arbitrary and wrong in the direction that costs a citation: "Molecular
// mapping of \u03b1-thrombin (\u03b1T)/\u03b22-glycoprotein I (\u03b22GpI) interaction
// reveals how \u03b22GpI affects \u03b1T functions" carries six Greek letters among 84
// Latin ones and was suppressed as non-English. Measured over all 48 filed
// titles containing Greek, the notation cases top out at 6.7% of the title's
// letters and the one Greek-language title is 89.2%, so a 25% threshold sits
// in a very wide gap and does not depend on where the line is drawn.
const GREEK = /[\u0370-\u03ff]/;
const GREEK_NOTATION_MAX = 0.25;
function isScientificNotation(text) {
  const letters = text.match(/\p{L}/gu) || [];
  if (!letters.length) return false;
  const greek = letters.filter((c) => GREEK.test(c)).length;
  if (!greek) return false;
  const latin = letters.filter((c) => /[a-zA-Z]/.test(c)).length;
  // Notation stays a small share of the letters; a Greek-language title does not.
  return greek / letters.length <= GREEK_NOTATION_MAX && latin > greek * 3;
}

// Function words that do not appear in English. Words shared with English
// ("de", "van", "for") are excluded because they cause false positives.
// Romance and Germanic forms were added on 2026-10-30 when a Portuguese title
// was highlighted as independent, so the list is wider than it was. This is a
// conservative screen, not a language detector: anything it is unsure about is
// listed in the review sheet for a human, and it is deliberately left alone
// rather than tuned further.
const FOREIGN_WORDS = new Set([
  // German
  "und", "nicht", "mit", "von", "aus", "bei", "auf", "für", "über", "nach",
  "zwischen", "ist", "sind", "werden", "kann", "diese", "solche",
  // French
  "des", "aux", "avec", "pour", "dans", "sur", "les", "une", "est", "sont",
  "cette", "nous",
  // Added 2026-11-01 when the word scan was narrowed to the title. Two French
  // titles were being highlighted as independent citations because a title is
  // shorter than an abstract and carried only one of the older French forms:
  // "Caractérisation structurale et production enzymatique de biomarqueurs des
  // mucopolysaccharidoses de type III" and "Physiopathologie de l'export de
  // surface des récepteurs et transporteurs". Checked against all 1033 then-
  // marked titles: none of these words combines with a second foreign word in
  // an English title, so they add no false positives.
  "et", "du", "au", "par", "sans",
  // Spanish / Portuguese / Italian
  "del", "una", "los", "las", "por", "para", "con", "della", "delle",
  "degli", "dello", "gli", "sono", "anche", "nella", "dalla",
  // Dutch / Scandinavian
  "med", "der", "den", "het", "een", "att", "och", "det", "voor", "met",
  "door",
  // Slavic / Turkish / other
  "się", "nie", "jest", "jak", "dla", "oraz", "ale", "ali", "için",
  "bir", "dengan", "dari", "untuk",
]);

// Two-letter forms are deliberately absent: "no", "na", "da", "do", "um",
// "es", "av", "van" and the like collide with scientific abbreviations and
// with names. "Nitric oxide binding geometry in heme-proteins" was flagged on
// 2026-10-30 because its snippet uses NO repeatedly, and NO is the commonest
// abbreviation in this corpus. A language that shows through on two-letter
// words alone will also show through on the accented letters below.

// Distinct letters carrying a diacritic. English scientific vocabulary is
// essentially unaccented, so two or more different accented letters in one
// title is a language signal. One is not: that is usually a proper noun.
//
// Widened on 2026-11-01 from Latin-1 Supplement only to Latin Extended-A/B.
// The old range stopped at U+00FF, so the letters that actually identify
// Polish, Czech, Croatian, Slovene, Romanian, Latvian and Vietnamese were
// invisible to it and a Polish title was highlighted as an independent
// citation: "Nowe perspektywy leczenia przeciwzakrzepowego" carries l, a and e
// (U+0142, U+0105, U+0119), all above U+00FF.
const ACCENTED = /[\u00c0-\u00d6\u00d8-\u00f6\u00f8-\u02ff\u1e00-\u1eff]/g;
function accentedLetters(text) {
  return new Set(text.match(ACCENTED) || []);
}

// The guide's test is whether a citation is "listed in English", and what it
// lists is the title, the authors and the venue -- not the article body. So
// the TITLE decides, and a foreign-language abstract in the snippet is not
// evidence about the entry. Two German-dissertation rows and one row flagged
// on the Greek letters abgde alone were being suppressed that way while
// Scholar listed them in English.
//
// A non-Latin SCRIPT is the exception and is still read from the whole entry,
// because a title can be transliterated or truncated while the snippet shows
// CJK or Cyrillic plainly. Scripts in NON_LATIN cannot be scientific notation,
// so this costs no false positives. Greek is deliberately NOT in NON_LATIN:
// see isScientificNotation above.
//
// The snippet test is a SHARE too, because a snippet is typesetting as much as
// language. "1H-1,2,4-Triazolo-5-diazonium Salts in the Synthesis of New
// 6H-Benzopyrano[4,3-e][1,2,4]triazolo[5,1-c][1,2,4]triazin-6-ones..." is an
// English title whose abstract renders one ring-bond descriptor as a Cyrillic
// small epsilon: 1 foreign letter in 93, and it was enough to suppress the
// citation. A genuinely foreign abstract is a different thing -- the Chinese
// "Effect of Hb conformational changes on oxygen transport physiology" is 39%
// foreign letters in its snippet. Measured over the filed set the two sit at
// 1.1% and 39%, so 25% separates them with room on both sides.
// The Greek-notation exemption is scoped to the title as well. It previously
// vetoed the whole script test, so a Chinese title containing the alpha in
// GPIba skipped it entirely and was highlighted as an independent citation.
const NON_LATIN_G = new RegExp(NON_LATIN.source, "g");
const SNIPPET_FOREIGN_MIN = 0.25;
function snippetIsForeign(snippet) {
  if (!NON_LATIN.test(snippet)) return false;
  const letters = snippet.match(/\p{L}/gu) || [];
  if (!letters.length) return false;
  const foreign = letters.filter((c) => NON_LATIN_G.test(c)).length;
  return foreign / letters.length >= SNIPPET_FOREIGN_MIN;
}

function languageFlag(entry) {
  const title = String(entry.title || "");
  const snippet = String(entry.snippet || "");
  const text = `${title} ${snippet}`.trim();
  if (!text) return "";

  if (NON_LATIN.test(title)) return "non-latin script (title)";
  if (snippetIsForeign(snippet)) return "non-latin script (snippet)";
  // A title written in Greek has Greek letters as the bulk of its text, so it
  // is a language rather than notation. Only a title that is mostly Greek is
  // flagged here; a handful of letters alongside real words stays notation.
  if (GREEK.test(title) && !isScientificNotation(title)) {
    return "non-latin script (title)";
  }

  const words = new Set(
    (title.toLowerCase().match(/[a-z\u00e0-\u02ff]+/g) || []).filter((w) => w.length > 1)
  );
  const foreign = [...words].filter((w) => FOREIGN_WORDS.has(w));
  // Two distinct such words is a strong signal; one is more likely part of a
  // name or journal title, so it is not flagged.
  if (foreign.length >= 2) {
    return `possible non-English (${foreign.join(", ")})`;
  }

  const accented = [...accentedLetters(title)];
  if (accented.length >= 2) {
    return `possible non-English (accented letters: ${accented.join(" ")})`;
  }
  return "";
}

function classify(entries, keys, profileTitle) {
  const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  return entries
    .filter((e) => e.title && !e.title.startsWith("Cited by"))
    .map((e) => evaluateEntry(e, keys))
    // Drop the user's own article if Scholar echoes it at the top.
    .filter((e) => norm(e.title) !== norm(profileTitle || ""));
}

// Confirm the entries Scholar considers independent against an external
// record (PubMed first, then OpenAlex). Both publish the complete author list,
// so this catches an author Scholar omitted or truncated.
//
// Google Scholar remains the primary source, so the external look-up is
// best-effort corroboration and each candidate gets a confirm_state:
//   confirmed            - a credible external record agrees there is no overlap.
//                          Where Scholar's own byline was truncated, this settles
//                          the row and it becomes independent (user decision
//                          2026-11-02); see corroboration.js rule R2.
//   unverified-coverage  - no credible external record (preprint, patent, book,
//                          or a look-up whose title overlap was too thin) and
//                          Scholar's own list was complete, so it is still
//                          marked, and recorded for a manual spot-check
//   unresolved           - no credible external record and Scholar's list was
//                          truncated, so neither source settles it
//   external-resolved    - a credible external list shows a shared author or a
//                          PI, which DECIDES the row as DEPENDENT or a
//                          self-citation rather than leaving it open
//   contradicted         - retained for rows captured before 2026-11-02. The
//                          old rule pulled such a row back to REVIEW on the
//                          ground that Scholar and the external record disagreed;
//                          a credible match now settles it instead, so a fresh
//                          capture no longer produces this state.
async function corroborateIndependence(results, keys, skip) {
  const need = results.filter(
    (r) => r.status === "INDEPENDENT" || r.status === "REVIEW"
  );
  if (skip) {
    for (const r of need) {
      r.corroboration = "skipped (--no-crosscheck)";
      r.confirm_state = "skipped";
    }
    return;
  }
  if (!need.length) return;

  log(`Corroborating ${need.length} candidate(s) against PubMed, then OpenAlex...`);
  for (const r of need) {
    const ext = await crosscheck.corroborate(r);
    if (!ext.found) {
      // A Scholar snippet that was not cut short is a complete author list, so
      // a missing external record is a gap in the external index, not in the
      // evidence. A truncated list with no external record proves nothing.
      //
      // But an incomplete look-up is neither of those. When a request failed
      // (rate limit, timeout, service fault) nothing was actually established,
      // so the row must not land on 'unverified-coverage' -- tally.js counts a
      // non-truncated row in that state as settled, which would turn a failed
      // request into countable evidence. 'lookup-failed' is deliberately not a
      // settling state, so the row stays open and a later run can ask again.
      if (ext.unknown) {
        r.confirm_state = "lookup-failed";
        r.corroboration = "external look-up incomplete (network or rate limit)";
        r.corroboration_note = ext.reason;
        if (r.status === "INDEPENDENT") r.status = "REVIEW";
        log(`  LOOKUP FAILED, left open: ${r.title}`);
        continue;
      }
      const scholarListComplete = !r.truncated;
      r.confirm_state = scholarListComplete ? "unverified-coverage" : "unresolved";
      r.corroboration = scholarListComplete
        ? "not indexed in PubMed or OpenAlex; Scholar list is complete"
        : "not indexed in PubMed or OpenAlex and the Scholar list is incomplete";
      r.corroboration_note = ext.reason;
      if (!scholarListComplete && r.status === "INDEPENDENT") {
        r.status = "REVIEW";
      }
      log(`  ${r.confirm_state}: ${r.title}`);
      continue;
    }

    r.external_source = ext.source;
    r.external_url = ext.url;
    r.external_title = ext.title;
    r.external_authors = ext.authors.join(", ");
    r.external_similarity = ext.similarity;

    // The state transition itself lives in corroboration.js so the offline
    // re-apply over already-filed reports cannot drift from a fresh capture.
    const res = applyExternalVerdict(r, keys);
    if (r.confirm_state === "external-resolved" && r.status !== "INDEPENDENT") {
      log(
        `  RESOLVED via ${ext.source}: ${r.status} on ` +
          `${(r.external_matched || []).join(", ")} -> ${r.title}`
      );
    } else {
      log(`  ${r.confirm_state}: ${r.title}`);
    }
    for (const n of res.notes) log(`      - ${n}`);
    await pace.pause("next cross-check", 1200, 2600);
  }
}

// An independent citation is marked in the exhibit when it is classified
// independent and no external record contradicts it. External confirmation is
// best-effort: a paper PubMed and OpenAlex simply do not index is still marked,
// on Scholar's complete list, and is recorded for a manual spot-check.
function isConfirmedIndependent(r) {
  if (r.status !== "INDEPENDENT") return false;
  return ["confirmed", "unverified-coverage", "skipped"].includes(
    r.confirm_state
  );
}

// What actually gets marked in the exhibit. The rule lives in tally.js so the
// exhibit, the review sheet and the statistics ledger can never disagree: an
// entry is marked only when it is classified independent, corroborated or
// covered by a complete Scholar list, and not held back as possibly
// non-English. tally.js works on a plain entry object, which is what r is.
function isHighlightable(r) {
  return lib.isHighlighted(r);
}

// Anything not settled by the rules above, plus anything the exhibit marked on
// thin external evidence, is collected in the review file. A DEPENDENT or SELF
// call is a decision, not an open question, so those stay out.
function flagAttention(results) {
  for (const r of results) {
    if (r.status === "REVIEW") {
      r.attention_reason =
        r.corroboration && r.corroboration !== "confirmed"
          ? r.corroboration
          : "author list could not be completed, so overlap is unverified";
      r.needs_attention = true;
    } else if (r.confirm_state === "contradicted") {
      r.attention_reason = `external record disagrees with Scholar: ${(r.external_matched || []).join(", ")}`;
      r.needs_attention = true;
    } else if (r.duplicate_of) {
      // A second language of a paper already on this list. Not an open question
      // about independence, but a reviewer should know the exhibit shows the
      // same article twice and marks it once. Checked before the
      // unverified-coverage branch below, which is written for rows the exhibit
      // actually marked.
      r.attention_reason = `${r.edition_note || "language edition"} - not marked, counted once`;
      r.needs_attention = true;
    } else if (r.confirm_state === "unverified-coverage") {
      r.attention_reason =
        "highlighted on Scholar's list alone - not indexed in PubMed or OpenAlex, worth a spot-check";
      r.needs_attention = true;
    } else if (r.language_flag) {
      r.attention_reason = `${r.language_flag} - not highlighted; a certified human translation is required before it can count`;
      r.needs_attention = true;
    } else {
      r.needs_attention = false;
      r.attention_reason = "";
    }
  }
}

// Apply highlights to the live page.
//
// PRODUCTION (default): the saved page must look like an untouched Google
// Scholar results page with only the independent citations highlighted.
// Nothing else is marked - no legend box, no orange "review" marks, no faded
// rows. Entries needing human review are left completely alone and tracked in
// the separate review Markdown file instead.
//
// DEBUG (--debug): adds the legend, orange review marks, faded non-independent
// rows and a dated print header, for use while verifying the tooling.
async function applyHighlights(page, results, debug) {
  const payload = results.map((r) => ({
    rawTitle: r.rawTitle,
    status: r.status,
    // Only confirmed independent citations are marked. An entry Scholar alone
    // suggested, which no external record backs up, stays unmarked. A
    // possibly non-English entry is never marked without a certified human
    // translation, which this tool cannot produce.
    highlight: isHighlightable(r),
  }));
  await page.evaluate(
    ({ items, debug }) => {
      const norm = (s) => s.toLowerCase().replace(/\s+/g, " ").trim();
      const rows = [
        ...document.querySelectorAll("#gs_res_ccl_mid .gs_or"),
      ];
      for (const row of rows) {
        const titleEl = row.querySelector("h3.gs_rt") || row.querySelector(".gs_rt");
        if (!titleEl) continue;
        const t = norm(titleEl.innerText);
        const hit = items.find((i) => norm(i.rawTitle) === t);
        if (!hit) continue;
        if (hit.highlight) {
          // The one mark production ever makes.
          titleEl.style.backgroundColor = "#fff200";
          continue;
        }
        if (!debug) continue;
        if (hit.status === "REVIEW") {
          titleEl.style.backgroundColor = "#ffcf99";
        } else {
          titleEl.style.opacity = "0.55";
        }
      }
      if (!debug) return;
      // Banner so a debug capture is self-describing.
      const note = document.createElement("div");
      note.style.cssText =
        "border:2px solid #333;padding:10px;margin:10px 0;font:13px Arial;background:#f6f6f6";
      note.innerHTML =
        "<strong>Highlight key (working copy):</strong> " +
        '<span style="background:#fff200;padding:1px 6px;">Yellow</span> = ' +
        "independent citation. " +
        '<span style="background:#ffcf99;padding:1px 6px;">Orange</span> = ' +
        "needs manual review. Faded = not independent.";
      const anchor = document.querySelector("#gs_res_ccl_mid") || document.body;
      anchor.insertBefore(note, anchor.firstChild);
    },
    { items: payload, debug }
  );
}

// Tallies reported in the review sheet. Shared by the live capture and the
// offline --report mode so both agree.
//
// The confirmation splits are taken among the highlighted entries only. They
// used to count every entry carrying that confirm_state, which included rows
// held back by the non-English screen, so a sheet could state more confirmed
// citations than it highlighted and contradict the ledger for the same PDF.
function computeCounts(results) {
  const t = lib.tallyEntries(results);
  const highlighted = results.filter((r) => isHighlightable(r));
  return {
    HIGHLIGHTED: t.independent,
    CONFIRMED: highlighted.filter((r) => r.confirm_state === "confirmed").length,
    COVERAGE: highlighted.filter(
      (r) => r.confirm_state === "unverified-coverage"
    ).length,
    CONTRADICTED: results.filter(
      (r) =>
        r.confirm_state === "contradicted" ||
        r.confirm_state === "external-resolved"
    ).length,
    REVIEW: results.filter((r) => r.status === "REVIEW").length,
    DEPENDENT: results.filter((r) => r.status === "DEPENDENT").length,
    SELF_PI: results.filter((r) => r.status === "SELF (PI)").length,
    SELF_FORMER: results.filter(
      (r) => r.status === "SELF (FORMER PI)"
    ).length,
  };
}

async function saveArtifacts(base, page, results, meta, debug) {
  fs.mkdirSync(PDF_DIR, { recursive: true });
  fs.mkdirSync(SUPPORT_DIR, { recursive: true });
  const pdfPath = path.join(PDF_DIR, `${base}.pdf`);
  const htmlPath = path.join(SUPPORT_DIR, `${base}.html`);
  const pngPath = path.join(SUPPORT_DIR, `${base}.png`);
  const jsonPath = path.join(SUPPORT_DIR, `${base}.report.json`);

  // Every exhibit page carries a header naming the Google Scholar URL it was
  // printed from, so each page is traceable to its source. Chromium fills
  // class="url" with the live page address, so page 2 shows its own start=10
  // offset rather than a hand-written label. Scholar returns 10 citing records
  // per page and ignores any pagesize= parameter, so the offsets are always
  // multiples of 10.
  const headerTemplate =
    `<div style="font-size:7px;color:#444;width:100%;display:flex;` +
    `justify-content:space-between;padding:0 8mm;overflow:hidden;white-space:nowrap;">` +
    `<span class="url"></span><span>Snapshot ${meta.snapshot}</span></div>`;
  const footerTemplate =
    `<div style="font-size:7px;color:#444;width:100%;text-align:center;` +
    `padding:0 8mm;">${base} - page <span class="pageNumber"></span> of ` +
    `<span class="totalPages"></span></div>`;

  await page.pdf({
    path: pdfPath,
    // Shared print settings -- see print-settings.js for the scale's history
    // and why it must agree with the re-printer and the fit test. The print
    // header and footer are drawn by Chromium outside this scale.
    ...PRINT_OPTIONS,
    headerTemplate,
    footerTemplate,
  });
  fs.writeFileSync(htmlPath, await page.content(), "utf8");
  await page
    .screenshot({ path: pngPath, fullPage: true })
    .catch((e) => log(`Screenshot skipped: ${e.message}`));

  // Flagged before the JSON is written so the report carries the same
  // attention reasons the review sheet shows. The review sheet itself is
  // written once per publication by main(), not per page.
  flagAttention(results);

  fs.writeFileSync(
    jsonPath,
    JSON.stringify({ ...meta, entries: results }, null, 2),
    "utf8"
  );

  if (!fs.existsSync(pdfPath) || fs.statSync(pdfPath).size < 1024) {
    log("VERIFICATION FAILED: PDF missing or too small.");
    process.exitCode = 1;
    return;
  }
  // Guard the failure mode where the browser tab had navigated to a citation
  // record: the saved page must still be the citing-articles list.
  const savedHtml = fs.readFileSync(htmlPath, "utf8");
  if (!savedHtml.includes("gs_res_ccl_mid")) {
    log(
      "VERIFICATION FAILED: the saved page is not a citing-articles list. " +
        "Do not use this exhibit."
    );
    process.exitCode = 1;
    return;
  }
  const marks = (
    savedHtml.match(/background-color:\s*rgb\(255,\s*242,\s*0\)|#fff200/gi) || []
  ).length;
  const expected = results.filter((r) => isHighlightable(r)).length;
  log(
    `VERIFIED PDF: ${pdfPath} (${(fs.statSync(pdfPath).size / 1024).toFixed(1)} KB)`
  );
  log(
    `VERIFIED LIST PAGE: ${htmlPath} (${marks} yellow highlight(s) found, ${expected} expected)`
  );
  if (marks !== expected) {
    log(
      `WARNING: highlight count (${marks}) does not match the ${expected} ` +
        `entries marked independent. Inspect the PDF before using it.`
    );
  }
  log(`Report JSON:  ${jsonPath}`);
}

// Build the review sheet. Kept separate from saveArtifacts so it can be
// rebuilt from a saved report JSON without requesting anything from Scholar.
function buildReviewMarkdown(base, results, meta, counts) {
  // Page 1 of a publication keeps the unsuffixed file name; later pages are
  // -p2, -p3, matching processCitingPage.
  const pdfName = (r) =>
    r.page && r.page > 1 ? `${base}-p${r.page}.pdf` : `${base}.pdf`;
  const row = (r, i) =>
    `| ${i + 1} | ${pdfName(r)} | ${isHighlightable(r) ? "**YES**" : "no"} | ${r.status} | ${r.title.replace(/\|/g, "/")} | ${r.authors_used.replace(/\|/g, "/")} | ${r.author_source} | ${r.corroboration || "-"} | ${r.external_url || "-"} | ${[...r.matched_authors, ...r.matched_pi, ...r.matched_former_pi].join(", ") || "-"} |`;

  // The PDF carries only yellow highlights, so this file is the sole place
  // anything unresolved is recorded. Lead with those items.
  flagAttention(results);
  const reviewItems = results.filter((r) => r.needs_attention);
  // Scholar shows some papers twice (a publisher copy plus a repository, thesis
  // or preprint copy). Both rows stay in the exhibit because that is what the
  // Scholar page shows, but the statistics count one paper. Listing the merges
  // here lets a reviewer confirm each pair really is the same work.
  const { merged: duplicateGroups } = lib.uniquePapers(results);
  const pages = [...new Set(results.map((r) => r.page || 1))].sort((a, b) => a - b);
  const nonEnglish = results.filter((r) => r.language_flag);
  const md = [
    `# Citation review notes - ${meta.cited_title}`,
    ``,
    `- Exhibit PDFs: ${pages.length === 1 ? `${base}.pdf` : pages.map((p) => (p > 1 ? `${base}-p${p}.pdf` : `${base}.pdf`)).join(", ")} (independent citations highlighted in yellow only)`,
    `- Source (citing list): ${meta.cites_url}`,
    `- Source (cited article): ${meta.paper_url}`,
    `- Snapshot date: ${meta.snapshot}`,
    `- Cited article authors (full list from Scholar detail page): ${meta.cited_authors}`,
    `- Authors matched (surname + initials): ${meta.author_keys.join("; ")}`,
    `- Current PI (user instruction - always a self-citation): ${(meta.pi_keys || []).join("; ") || "(none)"}`,
    `- Former PI (user instruction - always a self-citation): ${(meta.former_keys || []).join("; ") || "(none)"}`,
    `- External corroboration: ${meta.crosscheck || "not run"}`,
    ``,
    `Counts: ${counts.HIGHLIGHTED} independent and highlighted (${counts.CONFIRMED} externally confirmed, ${counts.COVERAGE} not indexed externally so marked on Scholar's complete list), ${counts.REVIEW} awaiting your review, ${counts.DEPENDENT} share an author with the cited paper, ${counts.SELF_PI} by the PI, ${counts.SELF_FORMER} by the former PI. ${counts.CONTRADICTED} entry(s) had their classification settled by a complete external author list.${nonEnglish.length ? ` ${nonEnglish.length} entry(ies) look non-English and are excluded from the highlighted total pending a certified human translation.` : ""}`,
    ``,
    `## Needs your review (${reviewItems.length})`,
    ``,
    reviewItems.length
      ? `Entries with status REVIEW are NOT highlighted and NOT counted. Entries noted as not indexed externally ARE highlighted, on Google Scholar's complete list, and are repeated here so you can spot-check them.`
      : `Nothing outstanding.`,
    ``,
    ...(reviewItems.length
      ? [
          `| # | PDF | Status | Citing title | Authors shown by Scholar | Why it needs review | Scholar link | External record |`,
          `|---|-----|--------|--------------|------------------------|---------------------|--------------|-----------------|`,
          ...reviewItems.map(
            (r) =>
              `| ${results.indexOf(r) + 1} | ${pdfName(r)} | ${r.status} | ${r.title.replace(/\|/g, "/")} | ${r.authors_used.replace(/\|/g, "/")} | ${r.attention_reason || r.corroboration || "unresolved"} | ${r.link || "-"} | ${r.external_url || "-"} |`
          ),
        ]
      : []),
    ``,
    ...(duplicateGroups.length
      ? [
          `## Duplicate versions of the same paper (${duplicateGroups.length})`,
          ``,
          `Scholar lists these more than once, so the exhibit shows each copy but they`,
          `count as one citing paper. The row whose author list was most complete is`,
          `the one the decision is taken from. Confirm each pair is the same work.`,
          ``,
          `| # | Copies | Titles and links |`,
          `|---|--------|------------------|`,
          ...duplicateGroups.map((list, i) => {
            const cells = list.map((e) => {
              const title = String(e.title || "").replace(/\|/g, "/");
              const where = e.link
                ? `[${title}](${String(e.link).replace(/\)/g, "%29")})`
                : title;
              return `${pdfName(e)}: ${where}`;
            });
            return `| ${i + 1} | ${list.length} | ${cells.join(" <br> ")} |`;
          }),
          ``,
        ]
      : []),
    ``,
    `## All entries`,
    ``,
    `| # | PDF | Highlighted | Status | Citing title | Citing authors used for the decision | Scholar author source | Corroboration | External record | Matched |`,
    `|---|-----|-------------|--------|--------------|--------------------------------------|-----------------------|---------------|-----------------|---------|`,
    ...results.map(row),
    ``,
    `> Independence rule applied: a citing paper is independent only when it shares`,
    `> no author with the cited paper AND lists neither the PI nor the former PI.`,
    `> Because "Desai" and "Cummings" are common surnames, authors are compared on`,
    `> surname plus initials; a surname collision without comparable initials is`,
    `> flagged REVIEW rather than counted either way.`,
    `> Author lists come from Google Scholar itself - the result snippet and, where`,
    `> Scholar truncated it, the BibTeX record shown by that result's "Cite" button.`,
    ``,
    `> Every entry Scholar left looking independent is then re-checked against an`,
    `> external record (PubMed first, then OpenAlex) that publishes the complete`,
    `> author list. Google Scholar remains the primary source, so the external`,
    `> look-up corroborates rather than decides: agreement confirms an entry, a`,
    `> paper neither service indexes is still marked on Scholar's complete list and`,
    `> recorded here for a spot-check, and any disagreement pulls the entry back to`,
    `> REVIEW with the conflicting names shown above. An entry is never promoted`,
    `> to independent on an external record alone.`,
    ``,
    `> CrossRef is intentionally not used as a basis for any independence call.`,
    ``,
  ].join("\r\n");
  return md;
}

// Scholar shows exactly 10 citing records per page and there is no way to
// change it: a pagesize= parameter is ignored on the citing-articles endpoint.
// Paging therefore follows Scholar's own "Next" link, which carries the real
// step size of 10 together with the as_sdt/sciodt/scipsc parameters that a
// hand-built offset drops -- which is how records got silently skipped when a
// fixed 20-per-page size was assumed. Nothing in the capture path calls this
// helper; it is kept only so the tests can prove an offset replaces rather than
// duplicates a start parameter, and must not be used to build page URLs.
function pageUrl(citesUrl, start) {
  const u = new URL(citesUrl);
  if (start > 0) u.searchParams.set("start", String(start));
  else u.searchParams.delete("start");
  return u.href;
}

// Classify, corroborate, highlight and save a single page of citing articles.
// Returns the classified entries so the caller can build one combined review.
async function processCitingPage(page, citing, opts) {
  const { keys, paper, skipCrosscheck, debug, base, pageNo, meta, auto } = opts;

  // First pass from the list text, then resolve truncated lists through
  // Scholar's own Cite popup, then classify on the best available data.
  let results = classify(citing.entries, keys, paper?.title);
  await resolveAuthorsViaCitePopup(page, results, meta.cites_url);
  results = classify(results, keys, paper?.title);

  // Flag language before corroboration: a non-English entry is never marked or
  // counted without a certified human translation.
  for (const r of results) {
    r.language_flag = languageFlag(r);
    // Record which page of the citing list this came from, so a multi-page
    // publication's review sheet points at the right PDF.
    r.page = pageNo;
  }

  // Confirm each candidate against an external author list before anything is
  // highlighted, so the exhibit marks only corroborated independent citations.
  await corroborateIndependence(results, keys, skipCrosscheck);

  // Language editions must not be marked either. A publisher can serve one
  // article in two languages and Scholar lists both rows, each with its own cid
  // and its own DOI (10.1002/anie.7795967 in English, 10.1002/ange.7795967 in
  // German), so the language screen alone is not enough -- a translation can
  // carry an English title and still be the same citing paper. tally marks the
  // copy that does not stand for the work, and isHighlighted() refuses it.
  //
  // The walk saves one page at a time, so earlier pages are handed in and this
  // publication's later pages can defer to a copy already printed.
  lib.markLanguageEditions(results, opts.editionPrior);

  flagAttention(results);

  // The exhibit must be the citing-articles list. Refuse to save anything else.
  if (!isCitingListUrl(page.url())) {
    log(
      `ERROR: not on the citing-articles page (at ${page.url()}); this page not saved.`
    );
    process.exitCode = 1;
    return results;
  }

  for (const r of results) {
    log(`${r.status.padEnd(11)} | ${r.title}`);
    log(`${" ".repeat(13)}| ${r.authors_used}`);
    log(`${" ".repeat(13)}| source=${r.author_source}`);
    if (r.corroboration) {
      log(`${" ".repeat(13)}| cross-check=${r.corroboration}`);
    }
    if (r.language_flag) {
      log(`${" ".repeat(13)}| language=${r.language_flag}`);
    }
  }

  await applyHighlights(page, results, debug);

  // With more than one page, suffix every artifact so pages do not overwrite
  // each other. A single-page publication keeps the plain name.
  const pageBase = pageNo > 1 ? `${base}-p${pageNo}` : base;

  if (!auto) {
    const answer = await ask(
      `\n>>> Page ${pageNo}: highlights applied in the browser window. Inspect them, then press ENTER to save. <<<\n` +
        "    (Type 'q' then ENTER to abort without saving.)\n"
    );
    if (answer.trim().toLowerCase() === "q") {
      log("Aborted by user. This page not saved.");
      return results;
    }
  }

  await saveArtifacts(pageBase, page, results, meta, debug);
  return results;
}

async function main() {
  // Offline mode: rebuild a review sheet from a saved report JSON. Touches no
  // network and launches no browser, so it can be re-run freely after the
  // rules change without asking Scholar again.
  const reportPath = arg("report");
  if (reportPath) {
    const full = path.resolve(reportPath);
    const saved = JSON.parse(fs.readFileSync(full, "utf8"));
    const base = path
      .basename(full)
      .replace(/\.report\.json$/i, "")
      .replace(/\.json$/i, "");
    // A publication's combined sheet is named after page 1, which is also the
    // name of page 1's own report. Rebuilding from that one file used to
    // overwrite the combined sheet with a single page, losing the other pages'
    // entries. Reassemble the sibling page reports instead.
    const pubBase = base.replace(/-p\d+$/, "");
    const isPageOfThisPub = (f) =>
      f === `${pubBase}.report.json` ||
      new RegExp(`^${pubBase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}-p\\d+\\.report\\.json$`).test(f);
    const siblings = fs
      .readdirSync(SUPPORT_DIR)
      .filter((f) => isPageOfThisPub(f) && path.resolve(SUPPORT_DIR, f) !== full)
      .map((f) => JSON.parse(fs.readFileSync(path.join(SUPPORT_DIR, f), "utf8")));
    const { entries: ownEntries, ...meta } = saved;
    const pages = [{ page: saved.page || 1, entries: ownEntries, meta }].concat(
      siblings.map((s) => {
        const { entries: se, ...sm } = s;
        return { page: s.page || 1, entries: se, meta: sm };
      })
    );
    pages.sort((a, b) => a.page - b.page);
    const entries = pages.flatMap((p) => p.entries);
    // Page 1's metadata describes the publication, so prefer it when present.
    const metaAll = pages.find((p) => p.page === 1)?.meta || meta;
    flagAttention(entries);
    const mdPath = path.join(SUPPORT_DIR, `${pubBase}.review.md`);
    fs.mkdirSync(SUPPORT_DIR, { recursive: true });
    fs.writeFileSync(
      mdPath,
      buildReviewMarkdown(pubBase, entries, metaAll, computeCounts(entries)),
      "utf8"
    );
    log(`Review sheet rebuilt offline from ${pages.length} page report(s)`);
    log(`Review sheet: ${mdPath}`);
    return;
  }

  const citesUrl = arg("cites");
  const paperUrl = arg("paper");
  const name = arg("name");
  // Working/debug capture: legend, orange review marks, faded rows, print
  // header. Off by default so exhibits stay clean.
  const debug = process.argv.includes("--debug");
  // PubMed/OpenAlex need no account. NCBI's policy asks for an identifying
  // email and offers an optional API key for a higher rate limit; both are
  // optional here because requests are few and sequential.
  const skipCrosscheck = process.argv.includes("--no-crosscheck");
  if (skipCrosscheck) {
    // Without corroboration nothing here is a verified independent citation, so
    // the exhibit would show marks the statistics ledger refuses to count.
    log(
      "WARNING: --no-crosscheck disables PubMed/OpenAlex corroboration. This is " +
        "a working copy; the ledger will not count its independent citations."
    );
  }
  // Save each page without waiting for a keypress. Useful for a long run, but
  // the browser window is still visible so a verification screen can be seen.
  const auto = process.argv.includes("--auto");
  const xcCfg = crosscheck.configure({
    email: arg("email"),
    ncbiKey: arg("ncbi-key"),
  });
  // Initials matter: "Desai" and "Cummings" are common surnames.
  const meArg = arg("me", "AY Mehta");

  if (!citesUrl) {
    console.error(
      'Usage: node capture-citations.js --cites="<url>" --paper="<view_citation url>" ' +
        '[--name="<file name>"] [--me="AY Mehta"] [--pi="RD Cummings"] [--former="UR Desai"] ' +
        '[--email="you@example.org"] [--ncbi-key="..."] [--no-crosscheck] [--auto] [--debug]' +
        "\n\nEvery page of a citing list is captured, one PDF per page, into " +
        "Exhibits/PDFs;\nHTML, screenshots and report JSON go to Exhibits/Supporting, " +
        "with one review\nsheet per publication. --auto saves each page without a " +
        "keypress.\n\nPubMed/OpenAlex corroboration needs no account. NCBI asks for an identifying\n" +
        "email and offers an optional API key (3 -> 10 req/s); both are optional here.\n" +
        "They can also come from CROSSCHECK_EMAIL and NCBI_API_KEY."
    );
    process.exitCode = 1;
    return;
  }

  const context = await pace.launch(USER_DATA_DIR);
  // Held so the fatal handler at the bottom of this file can close the browser.
  // Without that, an unexpected error leaves Chromium open, the process never
  // exits, and the batch driver waits on it indefinitely.
  activeContext = context;
  const page = context.pages()[0] || (await context.newPage());

  let paper = null;
  if (paperUrl) {
    paper = await readProfilePaper(page, paperUrl);
    if (paper === null) {
      log("Blocked while reading the article page. Nothing saved.");
      await context.close();
      process.exitCode = 2;
      return;
    }
    log(`Cited article : ${paper.title}`);
    log(`Full authors  : ${paper.authors}`);
    log(`Venue         : ${paper.venue}`);
  } else {
    log("No --paper URL supplied; author overlap cannot be verified reliably.");
  }

  const { keys: piKeys, missingInitials: piMissing } = toNameKeys(
    arg("pi", "RD Cummings")
  );
  const { keys: formerKeys, missingInitials: formerMissing } = toNameKeys(
    arg("former", "UR Desai")
  );
  const { keys: authorKeys, missingInitials: authorMissing } = paper?.authors
    ? toNameKeys(paper.authors)
    : toNameKeys(meArg);

  for (const [label, missing] of [
    ["PI", piMissing],
    ["former-PI", formerMissing],
    ["cited-author", authorMissing],
  ]) {
    for (const k of missing) {
      log(
        `WARNING: ${label} key "${k.display}" has no initials, so it matches ` +
          `every author with that surname. Add initials to avoid over-counting.`
      );
    }
  }

  const keys = { authorKeys, piKeys, formerKeys };

  const show = (list) =>
    list.map((k) => `${k.display}[${k.inits.join("") || "?"}]`).join(", ");
  log(`Author keys   : ${show(authorKeys)}`);
  log(`PI keys       : ${show(piKeys)}  (always self-citations)`);
  log(`Former PI keys: ${show(formerKeys)}  (always self-citations)`);

  // Distinct page transition: pause before requesting the citing list.
  if (paperUrl) await pace.pageGap("before citing-articles page");

  const citing = await readCitingEntries(page, citesUrl);
  if (!citing) {
    log("Blocked on the citing page. Nothing saved.");
    await context.close();
    process.exitCode = 2;
    return;
  }
  log(`Scholar header: ${citing.header || "(none)"}`);
  log(`Result blocks after dedupe: ${citing.entries.length}`);

  const stamp = new Date().toISOString().slice(0, 10);
  const base =
    name ||
    (paper?.title || "citing-list")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60) +
    `-citing-${stamp}`;

  const meta0 = {
    cited_title: paper?.title || "(not supplied)",
    cited_authors: paper?.authors || "(not supplied)",
    cited_venue: paper?.venue || "",
    paper_url: paperUrl,
    cites_url: citesUrl,
    author_keys: authorKeys.map((k) => k.display),
    pi_keys: piKeys.map((k) => k.display),
    former_keys: formerKeys.map((k) => k.display),
    crosscheck: skipCrosscheck
      ? "skipped (--no-crosscheck)"
      : `PubMed then OpenAlex${xcCfg.email ? `, identified as ${xcCfg.email}` : ", no identifying email supplied"}${xcCfg.ncbiKey ? " with API key" : ", no API key"}`,
    snapshot: `${stamp} ${new Date().toTimeString().slice(0, 8)}`,
  };

  // Scholar shows ten citing articles per page for this profile, and the guide
  // asks for a PDF of every page. Rather than assume an offset, follow the
  // page's own "Next" link, which carries Scholar's real step size and query
  // parameters. A page with no "Next" link is the last one. (A 248-citation
  // publication is therefore about 25 pages, not 13.)
  const expectedTotal = parseResultCount(citing.header);
  const pages = [];
  let blockedDuringRun = false;
  let pageNo = 1;
  let current = citing;

  // Language editions seen so far in this walk, keyed by tally.editionKey. A
  // pair can straddle any two pages because Scholar's own "Next" link decides
  // the order, so the state has to live outside the per-page loop.
  const editionPrior = new Map();

  while (true) {
    const pageMeta = {
      ...meta0,
      cites_url: page.url(),
      page_header: current.header,
      end_reason: current.endReason || "",
      page: pageNo,
    };
    const results = await processCitingPage(page, current, {
      keys,
      paper,
      skipCrosscheck,
      debug,
      base,
      pageNo,
      meta: pageMeta,
      auto,
      editionPrior,
    });
    pages.push(results);

    const seenSoFar = pages.reduce((n, p) => n + p.length, 0);
    // The header count is a cross-check only: Scholar counts duplicate versions
    // of a paper, which the per-record dedupe removes, so it can exceed the
    // number of records captured. It is never used to stop early, because a
    // count inflated that way would end the walk before the last page.
    if (expectedTotal !== null && pageNo === 1 && seenSoFar >= expectedTotal) {
      break;
    }
    if (!current.nextPage) {
      // Say why the walk ended. "no-results" or an unreadable Next link on a
      // publication that Scholar says has citations means the list was cut
      // short, most often by a soft block that shows none of the CAPTCHA
      // wording. Treat that as blocked so the batch stops here instead of
      // filing a one-page exhibit for a multi-page list.
      const reason = current.endReason || "unknown";
      const suspicious = endOfListIsSuspicious(reason);
      log(`No usable 'Next' link (${reason}).`);
      if (suspicious) {
        log(
          `This does not look like the end of the list. Treating ${base} as ` +
            `incomplete and blocked, so it is re-run rather than filed as is.`
        );
        blockedDuringRun = true;
      } else {
        log("The citing list is complete.");
      }
      break;
    }

    await pace.pageGap(`citing page ${pageNo + 1}`);
    const next = await readCitingEntries(page, current.nextPage);
    if (!next) {
      log(`Blocked before citing page ${pageNo + 1}. Saving what was captured.`);
      // Pages already saved are still valid, but the publication is unfinished
      // and Scholar is challenging us. Report it as blocked (exit 2) rather
      // than a clean exit, so the batch stops instead of walking into the same
      // wall with the next publication.
      blockedDuringRun = true;
      break;
    }
    if (!next.entries.length) {
      // We only fetch a page because the previous one offered a "Next" link, so
      // coming back with no result rows is not the end of the list. Scholar
      // does this when it serves a soft block that carries none of the CAPTCHA
      // wording. Ending quietly here is what let a 17-record list file a
      // one-page exhibit, so report it as blocked instead.
      log(
        `Citing page ${pageNo + 1} was reached by a 'Next' link but held no ` +
          `result rows (${next.endReason || "unknown"}). Treating the list as ` +
          `unfinished and blocked rather than complete.`
      );
      blockedDuringRun = true;
      break;
    }
    pageNo += 1;
    current = next;
    log(`Citing page ${pageNo}: ${next.entries.length} result(s)`);
  }

  const all = pages.flat();
  flagAttention(all);
  const mdPath = path.join(SUPPORT_DIR, `${base}.review.md`);
  fs.mkdirSync(SUPPORT_DIR, { recursive: true });
  fs.writeFileSync(
    mdPath,
    buildReviewMarkdown(base, all, meta0, computeCounts(all))
  );
  log(`Combined review sheet (${pages.length} page(s)): ${mdPath}`);

  if (expectedTotal !== null) {
    const got = all.length;
    log(`Coverage: ${got} unique record(s) captured; Scholar's header reported ${expectedTotal}.`);
    if (got > expectedTotal) {
      log(
        `WARNING: more records than the header reported. Check for a repeated page.`
      );
    }
  }

  if (!auto) await ask("\nPress ENTER to close the browser window.\n");

  // Set the exit status before closing the browser. A run whose browser was
  // already gone made context.close() throw, which skipped the assignment
  // below and let a truncated publication report a clean exit - exactly the
  // silent failure that let a 17-record list file a one-page exhibit.
  if (blockedDuringRun) {
    process.exitCode = 2;
    log("Exiting as blocked (code 2): this publication is incomplete and needs a re-run.");
  }
  try {
    await context.close();
  } catch (e) {
    log(`Browser was already closed: ${e.message.split("\n")[0]}`);
  }
}

// Only run when executed directly, so the pure helpers above can be required
// by tests and by the offline --report path without launching a browser.
if (require.main === module) {
  main()
    .catch((e) => {
      console.error(`[cites] Fatal: ${e.stack || e.message}`);
      process.exitCode = 1;
    })
    .finally(async () => {
      // Always release the profile lock, including on the error path, so the
      // next publication can launch and the driver is never left waiting.
      if (activeContext) {
        await activeContext.close().catch(() => {});
        activeContext = null;
      }
    });
}

module.exports = {
  isConfirmedIndependent,
  isHighlightable,
  languageFlag,
  isCitingListUrl,
  classifyEndOfList,
  endOfListIsSuspicious,
  parseResultCount,
  pageUrl,
  flagAttention,
  computeCounts,
  buildReviewMarkdown,
};

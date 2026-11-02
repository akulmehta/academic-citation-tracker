// Debug: dump citing-page markup and the "Cite" popup contents.
// Usage: node debug-cite-popup.js "<cites url>"
// Writes UTF-8 to tools/debug-cite-popup.out.txt

const fs = require("fs");
const path = require("path");
const pace = require("./human");

const USER_DATA_DIR = path.join(__dirname, ".playwright-profile");
const OUT = path.join(__dirname, "debug-cite-popup.out.txt");

async function main() {
  const citesUrl = process.argv[2];
  if (!citesUrl) {
    console.error("Usage: node debug-cite-popup.js \"<cites url>\"");
    process.exitCode = 1;
    return;
  }
  const lines = [];
  const say = (s) => {
    lines.push(s);
    console.log(s);
  };

  const context = await pace.launch(USER_DATA_DIR);
  const page = context.pages()[0] || (await context.newPage());
  await pace.goto(page, citesUrl);

  const overview = await page.evaluate(() => {
    const blocks = [...document.querySelectorAll("#gs_res_ccl_mid .gs_or")];
    const first = blocks[0];
    return {
      header: document.querySelector("#gs_ab_md")?.innerText?.trim() || "",
      gs_or: blocks.length,
      gs_ri: document.querySelectorAll(".gs_ri").length,
      scl: document.querySelectorAll(".gs_scl").length,
      buttons: first
        ? [...first.querySelectorAll("button, a")].map((b) => ({
            tag: b.tagName,
            cls: String(b.className),
            txt: (b.innerText || "").trim().slice(0, 40),
          }))
        : [],
      firstHtml: first ? first.outerHTML.slice(0, 2600) : "",
    };
  });
  say("=== OVERVIEW ===");
  say(JSON.stringify(overview, null, 2));

  // Click the "Cite" control on the first result and read the popup.
  // Scholar renders it as <a class="gs_or_cit">, not a <button>.
  const citeBtns = page.locator("#gs_res_ccl_mid .gs_or a.gs_or_cit");
  const n = await citeBtns.count();
  say(`\n=== CITE LINK COUNT: ${n} ===`);

  // Also collect the data-cid ids, which drive Scholar's own bib endpoint.
  const cids = await page.evaluate(() =>
    [...document.querySelectorAll("#gs_res_ccl_mid .gs_or")].map((el) => ({
      cid: el.getAttribute("data-cid") || el.getAttribute("data-aid") || "",
      title:
        el.querySelector("h3.gs_rt a")?.innerText?.trim().slice(0, 70) || "",
      link: el.querySelector("h3.gs_rt a")?.href || "",
    }))
  );
  say("\n=== CIDS ===\n" + JSON.stringify(cids, null, 2));

  for (let i = 0; i < Math.min(n, 1); i++) {
    const b = citeBtns.nth(i);
    const label = await b.innerText().catch(() => "");
    say(`\n--- cite[${i}] label="${label.trim()}" ---`);
    await b.click({ timeout: 8000 }).catch((e) => say(`click failed: ${e.message}`));
    await pace.sleep(2000);
    const popup = await page.evaluate(() => {
      const box = document.querySelector("#gs_citi");
      if (!box) return { found: false };
      return {
        found: true,
        text: (box.innerText || "").slice(0, 1200),
        tabs: [...box.querySelectorAll("button")].map((x) =>
          (x.innerText || "").trim()
        ),
      };
    });
    say(JSON.stringify(popup, null, 2));

    // Try the BibTeX tab, which usually carries the full author list.
    const bib = page.locator("#gs_citi button", { hasText: /bibtex/i }).first();
    if (await bib.isVisible().catch(() => false)) {
      await bib.click().catch(() => {});
      await pace.sleep(1500);
      const bibText = await page
        .evaluate(() => {
          const el =
            document.querySelector("#gs_citi_bib") ||
            document.querySelector("#gs_citi pre") ||
            document.querySelector("#gs_citi textarea");
          return el ? el.innerText || el.value : "(not readable)";
        })
        .catch((e) => `(unreadable: ${e.message})`);
      say("--- BIBTEX POPUP ---\n" + bibText);
    } else {
      say("(no BibTeX tab visible)");
    }
    await page.keyboard.press("Escape").catch(() => {});
    await pace.sleep(800);
  }

  // Compare with Scholar's own bib endpoint for the first record.
  if (cids.length) {
    const bibUrl = `https://scholar.google.com/scholar.bib?q=info:${cids[0].cid}:scholar.google.com/&output=citation&format=bibtex`;
    say(`\n=== BIB ENDPOINT ===\n${bibUrl}`);
    await pace.pageGap("results page -> bib endpoint");
    const text = await page
      .goto(bibUrl, { waitUntil: "domcontentloaded", timeout: 60000 })
      .then(() => page.evaluate(() => document.body.innerText))
      .catch((e) => `(failed: ${e.message})`);
    say(text.slice(0, 1500));
  }

  fs.writeFileSync(OUT, lines.join("\r\n"), "utf8");
  console.log(`\nSaved: ${OUT}`);
  await context.close();
}

main().catch((e) => {
  console.error(`Fatal: ${e.stack || e.message}`);
  process.exitCode = 1;
});

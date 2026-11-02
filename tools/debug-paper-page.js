// Debug: dump the structure Google Scholar uses for a single-article page.
// Usage: node debug-paper-page.js "<view_citation url>"

const path = require("path");
const { chromium } = require("playwright");
const pace = require("./human");

const USER_DATA_DIR = path.join(__dirname, ".playwright-profile");

async function main() {
  const url = process.argv[2];
  if (!url) {
    console.error("Usage: node debug-paper-page.js \"<view_citation url>\"");
    process.exitCode = 1;
    return;
  }
  const context = await pace.launch(USER_DATA_DIR);
  const page = context.pages()[0] || (await context.newPage());
  await pace.goto(page, url);

  const dump = await page.evaluate(() => {
    const ids = [...document.querySelectorAll('[id^="gsc_a"]')].map((el) => ({
      id: el.id,
      cls: el.className,
      tag: el.tagName,
      text: (el.innerText || "").trim().slice(0, 200),
    }));
    const visibleDialogs = [...document.querySelectorAll(".gs_md_c, [role=dialog]")]
      .filter((d) => d.classList.contains("gs_vis"))
      .map((d) => ({ id: d.id, text: (d.innerText || "").slice(0, 400) }));
    return {
      title: document.title,
      ids,
      visibleDialogs,
      bodyStart: (document.body.innerText || "").slice(0, 600),
    };
  });

  console.log(JSON.stringify(dump, null, 2));
  await context.close();
}

main().catch((e) => {
  console.error(`Fatal: ${e.stack || e.message}`);
  process.exitCode = 1;
});

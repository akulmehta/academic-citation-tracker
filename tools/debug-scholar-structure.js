// Debug: dump the structure Google Scholar uses for an article page and a
// citing-articles page, so extraction targets real markup.
// Usage: node debug-scholar-structure.js "<paper url>" "<cites url>"

const path = require("path");
const pace = require("./human");

const USER_DATA_DIR = path.join(__dirname, ".playwright-profile");

async function main() {
  const paperUrl = process.argv[2];
  const citesUrl = process.argv[3];
  const context = await pace.launch(USER_DATA_DIR);
  const page = context.pages()[0] || (await context.newPage());

  if (paperUrl) {
    await pace.goto(page, paperUrl);
    const dump = await page.evaluate(() => {
      const ids = [...document.querySelectorAll('[id^="gsc"]')]
        .filter((el) => (el.innerText || "").trim())
        .map((el) => ({
          id: el.id,
          cls: String(el.className).slice(0, 60),
          tag: el.tagName,
          text: (el.innerText || "").trim().slice(0, 220),
        }));
      return { title: document.title, ids };
    });
    console.log("=== PAPER PAGE ===");
    console.log(JSON.stringify(dump, null, 2).slice(0, 4000));
  }

  if (citesUrl) {
    await pace.pageGap("paper page -> citing page");
    await pace.goto(page, citesUrl);
    const dump = await page.evaluate(() => {
      const blocks = [...document.querySelectorAll(".gs_or")];
      const first = blocks.slice(0, 3).map((b) => ({
        cls: String(b.className),
        text: (b.innerText || "").trim().slice(0, 400),
        anchors: [...b.querySelectorAll("a")].map((a) => ({
          cls: String(a.className),
          href: (a.getAttribute("href") || "").slice(0, 140),
          txt: (a.innerText || "").trim().slice(0, 60),
        })),
      }));
      return {
        header: document.querySelector("#gs_ab_md")?.innerText?.trim() || "",
        gs_or_count: blocks.length,
        gs_ri_count: document.querySelectorAll(".gs_ri").length,
        gs_scl_count: document.querySelectorAll(".gs_scl").length,
        first,
      };
    });
    console.log("\n=== CITING PAGE ===");
    console.log(JSON.stringify(dump, null, 2).slice(0, 6000));
  }

  await context.close();
}

main().catch((e) => {
  console.error(`Fatal: ${e.stack || e.message}`);
  process.exitCode = 1;
});

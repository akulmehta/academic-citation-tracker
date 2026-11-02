// Offline diagnosis: why did a citing page that clearly has a page 2 stop the
// walk? Loads a saved citing-page HTML copy in the same browser engine as the
// capture and runs the exact extraction the capture uses, reporting each step.
//
//   node test-next-link.js ["<saved-page.html]"]
//
// Contacts nothing. Use it whenever a publication files fewer pages than
// Scholar's citation count implies, before blaming the network.

const fs = require("fs");
const path = require("path");
const { chromium } = require("playwright");
const { classifyEndOfList } = require("./capture-citations");

const ROOT = path.resolve(__dirname, "..");
const SUPPORT = path.join(ROOT, "Independent Citation Record", "Exhibits", "Supporting");

function target() {
  const hit = process.argv.slice(2).find((a) => !a.startsWith("--"));
  if (hit) return path.resolve(hit);
  const cands = fs
    .readdirSync(SUPPORT)
    .filter((f) => f.endsWith(".html") && /citing-/.test(f))
    .map((f) => path.join(SUPPORT, f))
    .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  if (!cands.length) {
    console.error("No saved citing-page HTML found in Exhibits/Supporting.");
    process.exitCode = 1;
    return "";
  }
  return cands[0];
}

async function main() {
  const file = target();
  if (!file) return;
  console.log(`[next] Testing extraction against ${path.basename(file)}`);
  const html = fs.readFileSync(file, "utf8");
  console.log(`[next] HTML size: ${html.length} bytes`);
  console.log(`[next] next-icon occurrences: ${(html.match(/gs_ico_nav_next/g) || []).length}`);
  console.log(`[next] #gs_n present: ${/id="gs_n"/.test(html)}`);
  console.log(`[next] #gs_nm present: ${/id="gs_nm"/.test(html)}`);
  console.log(`[next] CAPTCHA wording: ${/unusual traffic|not a robot|recaptcha/i.test(html)}`);

  // Offline diagnosis only: no request leaves this machine, so a headless
  // browser is used rather than the persistent Scholar profile.
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  // Load as a file so relative hrefs resolve the way they do on a live Scholar
  // page, which is what the capture depends on.
  await page.goto(`file:///${file.replace(/\\/g, "/")}`, { waitUntil: "domcontentloaded" });

  const probe = await page.evaluate(() => {
    const out = {};
    out.container = !!document.querySelector("#gs_res_ccl_mid");
    out.rows = document.querySelectorAll("#gs_res_ccl_mid .gs_or").length;
    out.header = document
      .querySelector("#gs_ab_md2, .gs_ab_md")
      ?.innerText?.trim()
      ?.slice(0, 80);
    for (const sel of ["#gs_n", "#gs_nm"]) {
      const bar = document.querySelector(sel);
      if (!bar) {
        out[sel] = "absent";
        continue;
      }
      const viaHas = bar.querySelector("a:has(.gs_ico_nav_next)")?.href || "";
      const viaText =
        [...bar.querySelectorAll("a")]
          .find((x) => /\bnext\b/i.test(x.innerText || x.getAttribute("aria-label") || ""))
          ?.href || "";
      const anyControl = [...bar.querySelectorAll("a,button")]
        .filter((x) => !x.disabled)
        .map((x) => `${x.tagName}[${x.getAttribute("aria-label") || x.innerText.trim()}]`)
        .join(" ");
      out[sel] = { viaHas, viaText, enabledControls: anyControl };
    }
    return out;
  });
  console.log(JSON.stringify(probe, null, 2));
  console.log(
    `[next] End-of-list verdict if the walk stopped here: ${classifyEndOfList(probe)}`
  );

  const empty = await page.evaluate(() => document.body.innerText.trim().length);
  console.log(`[next] Visible body text length: ${empty}`);
  await browser.close();
}

main().catch((e) => {
  console.error(`[next] Fatal: ${e.stack || e.message}`);
  process.exitCode = 1;
});

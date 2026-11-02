// Offline check: which browser does the capture pipeline actually launch?
//
//   node tools/check-browser.js
//
// Launches through the same pace.launch() the capture uses, reads back the
// browser's own version and executable path, then closes it. No network
// request is made, so this is safe to run while Scholar is challenging us.
// Run it at the start of a session: a silent fallback to bundled Chromium is
// worth knowing about before a long batch, per the project's browser conduct
// rule.

const path = require("path");
const pace = require("./human");

const USER_DATA_DIR = path.join(__dirname, ".playwright-profile");

async function main() {
  console.log("[check] Launching through pace.launch() (the capture's own launcher)...");
  const context = await pace.launch(USER_DATA_DIR);
  const browser = context.browser();
  try {
    console.log(`[check] Browser version : ${browser.version()}`);
  } catch {
    console.log(`[check] Browser version : ${browser.version}`);
  }
  try {
    console.log(`[check] Executable      : ${browser.browserType().executablePath()}`);
  } catch (e) {
    console.log(`[check] Executable      : not reported (${e.message.split("\n")[0]})`);
  }

  const page = context.pages()[0] || (await context.newPage());
  // about:blank asks nothing of the network but still exposes the real UA.
  await page.goto("about:blank");
  const ua = await page.evaluate(() => navigator.userAgent);
  const platform = await page.evaluate(() => navigator.platform);
  const headless = /Headless/.test(ua);
  console.log(`[check] User-Agent      : ${ua}`);
  console.log(`[check] Platform        : ${platform}`);
  console.log(`[check] Headed (visible) : ${!headless}`);

  const chromeVersion = (ua.match(/Chrome\/([\d.]+)/) || [])[1] || "?";
  const isRealChrome = !/HeadlessChrome/.test(ua);
  console.log("");
  console.log(
    isRealChrome
      ? `[check] Real Chrome channel in use (Chrome ${chromeVersion}).`
      : `[check] WARNING: not the real Chrome channel. Fix before a batch.`
  );

  await context.close();
}

main().catch((e) => {
  console.error(`[check] Fatal: ${e.stack || e.message}`);
  process.exitCode = 1;
});

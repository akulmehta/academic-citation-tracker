// Open Scholar in the pipeline's own browser profile and wait for the user to
// clear a verification screen, with no deadline.
//
//   node tools/unblock.js
//   node tools/unblock.js --check-only      report access, close immediately
//   node tools/unblock.js --target="<url>"  page to open (defaults to the profile)
//
// Why this exists: the capture polls a wall for three minutes and then stops,
// which is correct for an unattended batch but means a browser that was open
// with a verification screen is gone seconds after you come back to it. Here
// the window stays open until you say so, at whatever pace you need.
//
// This never attempts to solve, bypass, or auto-retry a challenge. It opens one
// page, reports what it sees, and waits for you.

const path = require("path");
const readline = require("readline");
const pace = require("./human");

const USER_DATA_DIR = path.join(__dirname, ".playwright-profile");
const PROFILE_URL = "https://scholar.google.com/citations?hl=en&user=dNLaKGAAAAAJ";

// Same wording the capture looks for, so both agree on what a wall is.
const CAPTCHA_MARKERS = [
  "unusual traffic",
  "not a robot",
  "recaptcha",
  "enable js and cookies",
  "our systems have detected",
];

function arg(name, fallback = "") {
  const hit = process.argv
    .slice(2)
    .find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}

const has = (name) => process.argv.includes(`--${name}`);

function log(msg) {
  console.log(`[unblock] ${msg}`);
}

// Held so the finally block can release the profile lock on every exit path.
let heldContext = null;

// One ENTER, no timeout. A batch run cannot wait this long, which is exactly
// why this separate tool exists.
function pauseForEnter() {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question("", () => (rl.close(), resolve())));
}

async function describe(page) {
  const state = await page
    .evaluate(() => {
      const text = document.body?.innerText || "";
      const low = text.toLowerCase();
      return {
        title: document.title || "",
        url: location.href,
        rows: document.querySelectorAll("#gs_res_ccl_mid .gs_or").length,
        hasResultsContainer: !!document.querySelector("#gs_res_ccl_mid"),
        hasProfile: !!document.querySelector("#gsc_rsb_a, .gsc_rsb_std"),
        textLength: text.trim().length,
      };
    })
    .catch((e) => ({ error: e.message.split("\n")[0] }));

  const body = await page
    .evaluate(() => document.body?.innerText || "")
    .catch(() => "");
  const wall = CAPTCHA_MARKERS.some((m) => body.toLowerCase().includes(m));
  return { ...state, wall };
}

function report(state) {
  if (state.error) {
    log(`Page could not be read: ${state.error}`);
    return;
  }
  log(`URL    : ${state.url}`);
  log(`Title  : ${state.title}`);
  log(`Visible text: ${state.textLength} chars, result rows: ${state.rows}`);
  if (state.wall) log("Status : VERIFICATION SCREEN PRESENT");
  else if (state.hasResultsContainer) log("Status : citing-articles list is loading normally");
  else if (state.hasProfile) log("Status : profile page is loading normally");
  else log("Status : no verification wording found, but the page is not a recognisable Scholar page");
}

async function main() {
  const target = arg("target", PROFILE_URL);
  log("Launching the pipeline's own browser profile (the one the capture uses)...");
  const context = await pace.launch(USER_DATA_DIR);
  heldContext = context;
  const page = context.pages()[0] || (await context.newPage());

  await pace.goto(page, target);
  let state = await describe(page);
  report(state);

  if (!state.wall) {
    log("No verification screen on this page, so nothing to clear here.");
    log(
      "Note: this profile's wall appears on citing-articles pages, so a clear\n" +
        "profile page does not prove those will load. Run a capture to find out."
    );
    if (!has("check-only")) {
      log("Keeping the window open. Press ENTER to close it.");
      await pauseForEnter();
    }
    await context.close();
    return;
  }

  if (has("check-only")) {
    log("--check-only: not waiting. Close this and clear it in a normal run, or");
    log("run tools/unblock.js without --check-only to take your time.");
    await context.close();
    process.exitCode = 2;
    return;
  }

  log("");
  log("--------------------------------------------------------------");
  log("Complete the verification in the browser window, at your own pace.");
  log("I will not touch it. Press ENTER here when you are finished.");
  log("--------------------------------------------------------------");
  await pauseForEnter();

  // Re-read what is already loaded first: that asks Scholar for nothing.
  state = await describe(page);
  report(state);

  if (!state.wall) {
    log("The verification screen is gone from this page.");
    log(
      "\nThe persistent profile in tools/.playwright-profile keeps the grant, so\n" +
        "the next capture starts from this state. Resume with:\n" +
        "  node tools/run-batch.js --out=Production --auto --skip-done"
    );
    return;
  }

  log("Still showing a verification screen on this page.");
  log("If you believe you cleared it, the wall may only appear on the citing");
  log("endpoint. Open that page here and try again, or re-run and solve it when");
  log("it appears during a capture.");
  process.exitCode = 2;
}

main()
  .catch((e) => {
    console.error(`[unblock] Fatal: ${e.stack || e.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    // The profile directory can only be opened by one browser at a time. If
    // this script leaves its window open, the next capture cannot launch and
    // fails on the profile lock, so the window is always released here.
    if (heldContext) {
      console.log("[unblock] Closing the browser to release the profile lock.");
      await heldContext.close().catch(() => {});
      heldContext = null;
    }
  });

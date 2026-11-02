// Shared human-like pacing helpers for Scholar capture scripts.
//
// Purpose: keep the request rate and interaction pattern gentle so Google
// Scholar is not provoked into rate-limiting. This deliberately slows work
// down; it does not attempt to defeat or bypass any challenge. If a CAPTCHA
// or unusual-traffic screen still appears, the scripts stop and ask the user.

const { chromium } = require("playwright");

function rand(min, max) {
  return min + Math.random() * (max - min);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

// Wait a random interval, logging roughly what it did.
async function pause(label = "", min = 2500, max = 6000) {
  const ms = Math.round(rand(min, max));
  if (label) console.log(`[pace] ${label}: waiting ${(ms / 1000).toFixed(1)}s`);
  await sleep(ms);
  return ms;
}

// Longer wait between distinct pages, with occasional extra-long pauses so the
// cadence never looks metronomic.
async function pageGap(label = "next page") {
  let ms = rand(6000, 14000);
  if (Math.random() < 0.2) ms += rand(8000, 20000);
  ms = Math.round(ms);
  console.log(`[pace] ${label}: pausing ${(ms / 1000).toFixed(1)}s`);
  await sleep(ms);
  return ms;
}

// Move the mouse along a few interpolated points rather than teleporting.
async function humanMove(page, steps = 6) {
  try {
    const viewport = page.viewportSize() || { width: 1280, height: 900 };
    let x = rand(0, viewport.width);
    let y = rand(0, viewport.height);
    await page.mouse.move(x, y);
    for (let i = 0; i < steps; i++) {
      const tx = rand(0, viewport.width);
      const ty = rand(0, viewport.height);
      const sub = 3 + Math.floor(Math.random() * 3);
      for (let s = 1; s <= sub; s++) {
        await page.mouse.move(
          x + ((tx - x) * s) / sub,
          y + ((ty - y) * s) / sub
        );
        await sleep(rand(8, 30));
      }
      x = tx;
      y = ty;
    }
  } catch {
    /* mouse moves are best-effort */
  }
}

// Scroll down in uneven increments, pausing as if reading, then return to top.
async function humanScroll(page, { toTop = true, reading = true } = {}) {
  try {
    await page.evaluate(
      async ({ toTop, reading }) => {
        const step = () => Math.round(120 + Math.random() * 420);
        const wait = (ms) => new Promise((r) => setTimeout(r, ms));
        const max = document.body.scrollHeight;
        let y = 0;
        while (y < max) {
          window.scrollBy(0, step());
          y += 500;
          await wait(reading ? 180 + Math.random() * 700 : 120);
          if (Math.random() < 0.12) await wait(900 + Math.random() * 1600);
        }
        if (toTop) {
          await wait(300 + Math.random() * 500);
          window.scrollTo(0, 0);
        }
      },
      { toTop, reading }
    );
  } catch (e) {
    console.log(`[pace] scroll skipped: ${e.message}`);
  }
}

// Launch headed with a persistent profile, per the project's browser conduct
// rules: real Chrome via channel:'chrome' when available, falling back to the
// bundled Chromium so a machine without Chrome still runs. Pacing only: this
// does not attempt to solve, bypass, or retry any challenge.
async function launch(userDataDir) {
  const opts = {
    headless: false,
    viewport: null,
    args: ["--start-maximized"],
  };
  try {
    return await chromium.launchPersistentContext(userDataDir, {
      ...opts,
      channel: "chrome",
    });
  } catch (e) {
    console.log(
      `[pace] Chrome channel unavailable (${e.message.split("\n")[0]}); ` +
        "falling back to bundled Chromium"
    );
    return chromium.launchPersistentContext(userDataDir, opts);
  }
}

// Navigate with a settle period and a little activity before/after.
async function goto(page, url, { settle = [3000, 6500] } = {}) {
  console.log(`[pace] navigating to ${url}`);
  await page
    .goto(url, { waitUntil: "domcontentloaded", timeout: 90000 })
    .catch((e) => console.log(`[pace] navigation issue: ${e.message}`));
  await pause("page settle", settle[0], settle[1]);
  await humanMove(page, 4);
}

module.exports = {
  rand,
  sleep,
  pause,
  pageGap,
  humanMove,
  humanScroll,
  launch,
  goto,
};

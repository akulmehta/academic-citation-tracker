// One-time split of dashboard.js into loadable modules. Delete after use.
//
// Each output file keeps the moved lines byte-for-byte and wraps them in an IIFE
// that pulls its dependencies out of the shared DASH namespace and publishes its
// own functions back into it. Script tags are used rather than ES modules
// because file:// refuses to fetch a module.
const fs = require("fs");
const path = require("path");

const SRC = path.resolve(__dirname, "../dashboard/dashboard.js");
const OUT = path.resolve(__dirname, "../dashboard/js");
const L = fs.readFileSync(SRC, "utf8").split(/\r?\n/);
const slice = (a, b) => L.slice(a - 1, b).join("\n");

const HEADER = `/* Part of the dashboard, split from the single dashboard.js on 2026-11-04 so
 * each figure can live on its own printable page. Load order matters and is set
 * by the script tags in each HTML file: core, charts, networks, story, tables,
 * review, boot. Plain script tags rather than ES modules because file:// refuses
 * to fetch a module, and the pages are opened by double-clicking them.
 *
 * Every file pulls what it needs out of the shared DASH namespace and publishes
 * its own functions back into it, so a function body here reads exactly as it
 * did in dashboard.js.
 */
window.DASH = window.DASH || {};
`;

// The names every later file may need from core. `wrapToWidth` is NOT here: it
// lives in charts.js with the one chart that wraps labels.
const CORE = `COLORS, fmt, pct1, pctOf, esc, ext, el, loadData, initTip, showTip, hideTip,
    PAGES, currentFile, renderToc, renderMasthead, renderColophon, statBand, svgFor,
    measureTextWidths, containerWidth, legend, table, enableSort, REVIEW_BUCKET,
    dropAwaitingReview, unsettledSub, endLabel, shorten, firstApplicant, decisionTag,
    corrobTag, workTitle, copyNote, exhibitRef, methodHtml`;

const files = [
  {
    name: "core.js",
    body: slice(15, 415) + "\n\n" + slice(1644, 1732) + "\n\n" + slice(1734, 1849),
    pull: null,
    push: `COLORS, fmt, pct1, pctOf, esc, ext, el, loadData, initTip, showTip, hideTip,
      PAGES, currentFile, renderToc, renderMasthead, renderColophon, statBand, svgFor,
      measureTextWidths, containerWidth, legend, table, enableSort, REVIEW_BUCKET,
      dropAwaitingReview, unsettledSub, endLabel, shorten, firstApplicant, decisionTag,
      corrobTag, workTitle, copyNote, exhibitRef, methodHtml`,
  },
  {
    name: "charts.js",
    body: slice(1854, 2814),
    pull: CORE,
    push: `drawHistory, drawWaffle, drawSplit, wrapToWidth, drawLollipop,
      drawConcentration, drawYears, drawPatentPubs, drawCorroboration`,
  },
  {
    name: "story.js",
    body: slice(419, 918) + "\n\n" + slice(1640, 1642),
    pull: CORE + `, drawHistory, drawWaffle, drawSplit, drawLollipop, drawConcentration,
      drawYears, drawPatentPubs, drawCorroboration`,
    push: `renderStory, renderMethod`,
  },
  {
    name: "tables.js",
    body: slice(923, 1080),
    pull: CORE,
    push: `renderArticles, renderWorks`,
  },
  {
    name: "review.js",
    body: slice(1082, 1635),
    pull: CORE,
    push: `BUCKET_META, renderReview, renderLanguage`,
  },
];

fs.mkdirSync(OUT, { recursive: true });
for (const f of files) {
  const parts = [HEADER, "(function () {\n  \"use strict\";\n"];
  if (f.pull) parts.push(`  const {\n    ${f.pull}\n  } = window.DASH;\n`);
  parts.push(f.body);
  parts.push(`  Object.assign(window.DASH, {\n    ${f.push},\n  });\n})();\n`);
  fs.writeFileSync(path.join(OUT, f.name), parts.join("\n"), "utf8");
  console.log("wrote js/" + f.name);
}

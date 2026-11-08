#!/usr/bin/env node
/**
 * The scan-and-screen half of the pipeline for one cited work, with the
 * evidence printed before anything is decided.
 *
 * Pairs with run-publication.js (seed/resolve/fetch/sync/promote). Split in two
 * because this half writes claims: a resolved mention is a sentence quoted from
 * a PDF, and a screen is a statement that an article is not primary research.
 * Both are worth reading, so this prints what it found and what it is about to
 * do, and only then applies it.
 *
 * Two guards are load-bearing and are the reason this is a script rather than a
 * typed sequence:
 *
 *   - record-mentions.js is run in dry-run FIRST and the script stops if any
 *     quote fails to appear on the page claimed. A quote that cannot be found in
 *     the filed PDF must never reach the packet.
 *   - screen-from-report.js is run in dry-run FIRST, so the reason strings are on
 *     screen before set-screen.js writes them. A row labelled SECONDARY on a
 *     single route is left held by that tool's own rule, not by this one.
 *
 * Usage:
 *   node scripts/finish-publication.js --cites=<id> --label=<name>
 */
"use strict";
const fs = require("fs");
const path = require("path");
const os = require("os");
const { execFileSync } = require("child_process");

const argv = process.argv.slice(2);
const opt = (n) => {
  const a = argv.find((x) => x.startsWith(`--${n}=`));
  return a ? a.split("=").slice(1).join("=") : null;
};
const CITES = opt("cites");
const LABEL = opt("label");
if (!CITES || !LABEL) {
  console.error("usage: --cites=<id> --label=<short-name>");
  process.exit(2);
}
const S = (script, args) =>
  execFileSync("node", [path.join(__dirname, script), ...args], { encoding: "utf8" });
const step = (name, script, args) => {
  console.log(`\n=== ${name} ===`);
  try {
    process.stdout.write(S(script, args));
  } catch (e) {
    console.error(`\n${name} failed — stopping. Re-run after fixing; steps are re-runnable.`);
    process.exit(1);
  }
};

step("scan-mentions", "scan-mentions.js", ["--write"]);

const spec = `downloads/_ref-mentions-${LABEL}.json`;
const merged = `downloads/_ref-mentions-${LABEL}-merged.json`;
console.log("\n=== scan-refs (resolve citations that name no tool) ===");
try {
  execFileSync("node", [path.join(__dirname, "scan-refs.js"), `--cites=${CITES}`, `--mentions=${spec}`],
    { stdio: "inherit" });
} catch (e) {
  console.error("scan-refs failed — stopping.");
  process.exit(1);
}
const nMentions = fs.existsSync(spec)
  ? JSON.parse(fs.readFileSync(spec, "utf8")).reduce((n, r) => n + (r.mentions || []).length, 0)
  : 0;

if (nMentions > 0) {
  step("merge-ref-mentions", "merge-ref-mentions.js", [`--from=${spec}`, `--out=${merged}`]);
  // Dry run first: every quote must be found on the page it claims.
  const chk = S("record-mentions.js", [`--from=${merged}`]);
  console.log("\n=== record-mentions dry run ===");
  console.log(chk.split(/\r?\n/).filter((l) => /ok |FAIL|verified|Error/i.test(l)).join("\n"));
  if (!/All \d+ mention\(s\) verified/.test(chk)) {
    console.error("\nA quote did not verify. Nothing was recorded — read the spec and fix it by hand.");
    process.exit(1);
  }
  step("record-mentions", "record-mentions.js", [`--from=${merged}`, "--write"]);
} else {
  console.log("no resolved mentions for this work — nothing to record");
}

const log = path.join(os.tmpdir(), `${LABEL}-wt.log`);
console.log("\n=== work-type-report (four routes, writes nothing) ===");
execFileSync("node", [path.join(__dirname, "work-type-report.js"), `--cites=${CITES}`],
  { stdio: ["ignore", fs.openSync(log, "w"), "inherit"] });

console.log("\n=== screen dry run — these are the reasons that will be written ===");
const dry = S("screen-from-report.js", [`--log=${log}`]);
console.log(dry);
if (/^0 of \d+ rows/m.test(dry)) {
  console.log("nothing to screen");
} else {
  step("screen (apply)", "screen-from-report.js", [`--log=${log}`, "--apply"]);
  step("relocate-pdfs", "relocate-pdfs.js", ["--write"]);
}

step("build-potential", "build-potential.js", ["--write"]);
step("render-packet", "render-packet.js", ["--write"]);
step("build-status", "build-status.js", ["--write"]);
console.log("\n=== validate-packet ===");
try {
  process.stdout.write(S("validate-packet.js", []));
} catch (e) {
  console.error("\nvalidate-packet reported a failure — do not commit until it is understood.");
  process.exit(1);
}
console.log(`\n${LABEL}: done. Commit it.`);

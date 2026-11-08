#!/usr/bin/env node
/**
 * Run the no-judgement half of the pipeline for one cited work.
 *
 * Seed -> resolve -> fetch -> sync candidate state -> promote. Nothing in that
 * list decides anything about an article: it finds open copies, files what it
 * can download, and puts the rows in the packet as `held`. Every step that DOES
 * decide something — a screen, a tier, an inclusion — is left alone here and
 * printed at the end as the command to run after reading the output.
 *
 * Why this exists: the same five commands now run per publication, and typing
 * them in the wrong order is how a row ends up `open-copy` with a PDF on disk,
 * which validate-packet.js fails on. `sync-candidate-state.js` in particular is
 * easy to forget because nothing complains until much later.
 *
 * The scripts it calls are dry-run by default, so this passes --write to each
 * deliberately; each one takes its own backup first. It stops at the first step
 * that fails rather than running the rest against a half-applied state.
 *
 * Usage:
 *   node scripts/run-publication.js --cites=<cites_id> [--label=<short name>]
 *   node scripts/run-publication.js --cites=<cites_id> --skip-fetch
 */
"use strict";
const path = require("path");
const { execFileSync } = require("child_process");

const argv = process.argv.slice(2);
const opt = (n) => {
  const a = argv.find((x) => x.startsWith(`--${n}=`));
  return a ? a.split("=").slice(1).join("=") : null;
};
const CITES = opt("cites");
const LABEL = opt("label") || CITES;
if (!CITES) {
  console.error("usage: --cites=<cites_id> [--label=<name>] [--skip-fetch]");
  process.exit(2);
}
const SKIP_FETCH = argv.includes("--skip-fetch");

function step(name, script, args) {
  console.log(`\n=== ${name} ===`);
  try {
    execFileSync("node", [path.join(__dirname, script), ...args], { stdio: "inherit" });
  } catch (e) {
    console.error(`\n${name} failed (${e.status === undefined ? "signal" : `exit ${e.status}`}) — stopping here.`);
    console.error("Fix that step, then re-run this script; every step is idempotent and re-runnable.");
    process.exit(1);
  }
}

step("seed", "discover-pdfs.js", ["--seed", `--cites=${CITES}`, "--write"]);
step("resolve", "discover-pdfs.js", ["--resolve", `--cites=${CITES}`, "--write"]);
if (!SKIP_FETCH) step("fetch", "discover-pdfs.js", ["--fetch", `--cites=${CITES}`, "--write"]);
step("sync candidate state", "sync-candidate-state.js", ["--write"]);
step("promote", "promote-candidates.js", [`--cites=${CITES}`, "--write"]);

console.log(`
=== ${LABEL}: mechanical steps done. Read the output above, then run ===
  node scripts/scan-mentions.js --write
  node scripts/scan-refs.js --cites=${CITES} --mentions=downloads/_ref-mentions-${LABEL}.json
  node scripts/merge-ref-mentions.js --from=downloads/_ref-mentions-${LABEL}.json --out=downloads/_ref-mentions-${LABEL}-merged.json
  node scripts/record-mentions.js --from=downloads/_ref-mentions-${LABEL}-merged.json      # read the quotes first
  node scripts/record-mentions.js --from=downloads/_ref-mentions-${LABEL}-merged.json --write
  node scripts/work-type-report.js --cites=${CITES} > $env:TEMP\\${LABEL}-wt.log 2>&1
  node scripts/screen-from-report.js --log=$env:TEMP\\${LABEL}-wt.log                      # dry run, read it
  node scripts/screen-from-report.js --log=$env:TEMP\\${LABEL}-wt.log --apply
  node scripts/relocate-pdfs.js --write
  node scripts/build-potential.js --write
  node scripts/render-packet.js --write
  node scripts/build-status.js --write
  node scripts/validate-packet.js
Then commit ${LABEL}. The screen step is the one that decides anything: a row
labelled SECONDARY on a single route is left held on purpose, and a row the
report cannot settle stays open rather than being screened on a guess.
`);

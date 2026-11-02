// Offline tests for tools/apply-decision.js — the helpers, not the CLI.
// Run: node tools/test-apply-decision.js
//
// These matter because the tool edits the report JSON that every figure is
// derived from. The guard that must never regress is the title cross-check: a
// row_uid resolved to the wrong entry would rewrite a citation nobody asked
// about, and nothing downstream would notice.

const path = require("path");
const { VERDICTS, reportFileFor, findEntry, splitCsvLine } = require("./apply-decision");

let pass = 0;
let fail = 0;

function check(name, got, want) {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (ok) {
    pass++;
    console.log(`  ok   ${name}`);
  } else {
    fail++;
    console.log(`  FAIL ${name}`);
    console.log(`         want: ${JSON.stringify(want)}`);
    console.log(`         got:  ${JSON.stringify(got)}`);
  }
}

// ---- Verdict words -------------------------------------------------------

check("verdict: dependent", VERDICTS.dependent, "DEPENDENT");
check("verdict: independent", VERDICTS.independent, "INDEPENDENT");
check("verdict: self-former-pi", VERDICTS["self-former-pi"], "SELF (FORMER PI)");
check("verdict: former", VERDICTS.former, "SELF (FORMER PI)");
check("verdict: self", VERDICTS.self, "SELF (PI)");
check("verdict: open means review", VERDICTS.open, "REVIEW");
check("verdict: a typo is not a verdict", VERDICTS.depndent, undefined);
check("verdict: 'true' is not a verdict", VERDICTS.true, undefined);
check("verdict: 'yes' is not a verdict", VERDICTS.yes, undefined);

// ---- Report file naming --------------------------------------------------

// Page 1 keeps the bare stem; later pages carry the -pN suffix. Getting this
// wrong would either miss the file or, worse, edit page 1 when the row lives on
// page 5.
// The naming rule is checked against a base that genuinely has both a bare
// page-1 report and a -p3 report on disk. Exhibits get archived, so the fixture
// is probed first and the pair skipped, not failed, if it ever moves.
const support = path.join("Independent Citation Record", "Exhibits", "Supporting");
const BASE = "allosteric-inhibition-of-human-factor-xia-discovery-of-monos-citing-2026-10-31";
const p1 = reportFileFor(BASE, 1);
const p3 = reportFileFor(BASE, 3);
if (p1 && p3) {
  check("file: page 1 has no suffix", p1, path.resolve(support, `${BASE}.report.json`));
  check("file: page 3 takes the -p3 suffix", p3, path.resolve(support, `${BASE}-p3.report.json`));
} else {
  console.log("  --   file naming: fixture exhibit archived, skipped");
}
check("file: a base that does not exist returns null", reportFileFor("no-such-exhibit-base", 1), null);

// ---- Locating the entry inside the report --------------------------------

const TITLE = "Allosteric partial inhibition of monomeric serine proteases by antithrombin";
const data = {
  entries: [
    { index: 0, page: 1, title: "An unrelated paper" },
    { index: 1, page: 1, title: TITLE },
    { index: 0, page: 2, title: "First entry on page two" },
  ],
};

check(
  "entry: found on index and page",
  findEntry(data, { row_index: 1, page: 1, title: TITLE }).entry?.title,
  TITLE,
);
check(
  "entry: page defaults to 1 when the store says nothing",
  findEntry(data, { row_index: 1, title: TITLE }).entry?.title,
  TITLE,
);
check(
  "entry: same index on another page is a different row",
  findEntry(data, { row_index: 0, page: 2, title: "First entry on page two" }).entry?.title,
  "First entry on page two",
);
check("entry: an out-of-range index is an error, not a guess", Boolean(findEntry(data, { row_index: 9, page: 1, title: TITLE }).error), true);
const mismatch = findEntry(data, { row_index: 1, page: 1, title: "A completely different work" });
check("entry: a title mismatch refuses the edit", Boolean(mismatch.error), true);
check(
  "entry: mismatch names both titles so a human can see the swap",
  /store:.*report:/.test(mismatch.error || ""),
  true,
);
check(
  "entry: punctuation and case in a title are ignored",
  findEntry(data, { row_index: 1, page: 1, title: "ALLOSTERIC  partial inhibition!! of monomeric serine proteases by antithrombin" }).entry?.title,
  TITLE,
);
// The comparison is deliberately strict. A store title shortened to a prefix of
// the real one is refused rather than accepted, because the only way to loosen
// it is to compare prefixes, and a prefix match is how an edit would land on a
// different citation that happens to start the same way. Titles are stored in
// full, so a prefix reaching here means something is wrong.
check(
  "entry: a shortened store title is refused, not prefix-matched",
  Boolean(findEntry(data, { row_index: 1, page: 1, title: TITLE.slice(0, 30) }).error),
  true,
);
check(
  "entry: duplicate index/page is an error",
  Boolean(
    findEntry({ entries: [{ index: 0, page: 1, title: "x" }, { index: 0, page: 1, title: "x" }] }, { row_index: 0, page: 1, title: "x" })
      .error,
  ),
  true,
);

// ---- The sheet's CSV -----------------------------------------------------

check("csv: plain cells", splitCsvLine("a,b,c"), ["a", "b", "c"]);
check("csv: quoted comma", splitCsvLine('row,"a, b",c'), ["row", "a, b", "c"]);
check("csv: escaped quote", splitCsvLine('row,"say ""hi""",c'), ["row", 'say "hi"', "c"]);
check("csv: empty trailing cell", splitCsvLine("a,b,"), ["a", "b", ""]);
check(
  "csv: the columns the tool reads survive a quoted title",
  splitCsvLine('cit-000082,"Title, with comma",,dependent,note here')[4],
  "note here",
);

console.log(
  fail === 0
    ? `\n${pass} passed, all good`
    : `\n${pass} passed, ${fail} FAILED`,
);
if (fail) process.exitCode = 1;

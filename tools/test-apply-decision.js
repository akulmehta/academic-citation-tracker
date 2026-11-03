// Offline tests for tools/apply-decision.js — the helpers, not the CLI.
// Run: node tools/test-apply-decision.js
//
// These matter because the tool edits the report JSON that every figure is
// derived from. The guard that must never regress is the title cross-check: a
// row_uid resolved to the wrong entry would rewrite a citation nobody asked
// about, and nothing downstream would notice.

const path = require("path");
const {
  VERDICTS,
  reportFileFor,
  findEntry,
  splitCsvLine,
  foldProblem,
} = require("./apply-decision");

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

// ---- A fold must stay within one cited paper -----------------------------
//
// tally.foldSameWork groups on same_work_key alone and never compares cites_id,
// then marks the losing copies duplicate_of -- which isHighlighted() refuses. A
// fold across two cited papers would therefore remove a highlight from one
// exhibit. The confusion is easy to make because one citing article appears on
// the "cited by" page of every paper it cites, so two rows can be the same WORK
// while being two separate CITATIONS. Measured 2026-11-03, 178 title-keyed groups
// in this corpus span more than one cited paper.

const A = { cites_id: "111", title: "A paper" };
const A2 = { cites_id: "111", title: "Another row on the same page" };
const B = { cites_id: "222", title: "A row citing a different paper" };

check("fold: same cited paper is allowed", foldProblem("cit-1", "cit-2", A, A2), "");
check(
  "fold: a different cited paper is refused",
  Boolean(foldProblem("cit-1", "cit-2", A, B)),
  true,
);
// The refusal must name both rows, or a batch of them cannot be untangled.
check(
  "fold: the message names the row and the anchor",
  (() => {
    const m = foldProblem("cit-000967", "cit-000487", A, B);
    return m.includes("cit-000967") && m.includes("cit-000487");
  })(),
  true
);

// A missing cites_id is NOT treated as a match. It means the store could not say
// which paper the row belongs to, and silently allowing the fold would let the
// very case this guard exists for through on a falsy comparison. cites_id is
// NOT NULL in the schema, so a refusal here points at a broken row to rebuild.
check(
  "fold: an unknown cites_id is refused, not assumed safe",
  Boolean(foldProblem("cit-1", "cit-2", A, { cites_id: "" })),
  true,
);
check(
  "fold: an unknown cites_id on the subject is refused too",
  Boolean(foldProblem("cit-1", "cit-2", { cites_id: "" }, A)),
  true,
);
check(
  "fold: the refusal says what to do about a missing cites_id",
  foldProblem("cit-1", "cit-2", A, { cites_id: "" }).includes("build-catalog"),
  true,
);
check("fold: a missing anchor row is not this guard's problem", foldProblem("cit-1", "cit-2", A, null), "");
check("fold: a missing subject row is not this guard's problem", foldProblem("cit-1", "cit-2", null, A), "");

// The fold the packet actually uses today: three copies of one preprint on the
// exhibit of a single cited paper. Within one paper, so it must stay allowed.
check(
  "fold: the existing sw:cit-000108 group is within one cited paper",
  foldProblem(
    "cit-000132",
    "cit-000108",
    { cites_id: "4631471255166879252" },
    { cites_id: "4631471255166879252" },
  ),
  "",
);

console.log(
  fail === 0
    ? `\n${pass} passed, all good`
    : `\n${pass} passed, ${fail} FAILED`,
);
if (fail) process.exitCode = 1;

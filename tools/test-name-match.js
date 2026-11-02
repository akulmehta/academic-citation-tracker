// Offline tests for author-name matching. Run: node test-name-match.js
// No network access - these guard the independence rule, especially the common
// surnames "Desai" and "Cummings".

const assert = require("assert");
const {
  parseOne,
  parseAuthorList,
  toKeys,
  evaluateEntry,
} = require("./name-match");

let passed = 0;
function check(label, actual, expected) {
  try {
    assert.deepStrictEqual(actual, expected);
    passed++;
    console.log(`  ok   ${label}`);
  } catch (e) {
    console.log(`  FAIL ${label}\n         got: ${JSON.stringify(actual)}\n         want: ${JSON.stringify(expected)}`);
    process.exitCode = 1;
  }
}

console.log("parseOne");
check("initials before surname", parseOne("AY Mehta"), {
  display: "AY Mehta",
  surname: "mehta",
  inits: ["a", "y"],
});
check("written-out given names", parseOne("Akul Y Mehta"), {
  display: "Akul Y Mehta",
  surname: "mehta",
  inits: ["a", "y"],
});
check("BibTeX surname-first", parseOne("Mehta, Akul Y"), {
  display: "Mehta, Akul Y",
  surname: "mehta",
  inits: ["a", "y"],
});
check("bare surname has no initials", parseOne("Cummings"), {
  display: "Cummings",
  surname: "cummings",
  inits: [],
});
check("honorific ignored", parseOne("RD Cummings Jr"), {
  display: "RD Cummings Jr",
  surname: "cummings",
  inits: ["r", "d"],
});

console.log("\nparseAuthorList (Scholar snippet form)");
check(
  "venue suffix stripped",
  parseAuthorList("Y Seo, JE Park, JY Yu, B Lee - Experimental & Molecular ..., 2025 - nature.com").map(
    (p) => p.display
  ),
  ["Y Seo", "JE Park", "JY Yu", "B Lee"]
);
// Regression: Scholar uses a NON-BREAKING space around the venue dash. If it is
// not normalised the last author merges with the journal name and a genuine
// author match disappears. This exact string caused a real misclassification.
check(
  "non-breaking-space venue separator stripped",
  parseAuthorList(
    "C Hou, W Li, Y Li, J Ma\u00a0- Analytical and Bioanalytical Chemistry, 2025 - Springer"
  ).map((p) => p.display),
  ["C Hou", "W Li", "Y Li", "J Ma"]
);
check(
  "last author before nbsp venue is still matched",
  evaluateEntry(
    {
      authors: "C Hou, W Li, Y Li, J Ma\u00a0- Analytical and Bioanalytical Chemistry, 2025 - Springer",
      truncated: false,
    },
    {
      authorKeys: toKeys("Junfeng Ma").keys,
      piKeys: [],
      formerKeys: [],
    }
  ).status,
  "DEPENDENT"
);
check(
  "ellipsis token dropped",
  parseAuthorList("WS York, R Mazumder, ...").map((p) => p.display),
  ["WS York", "R Mazumder"]
);

console.log("\nindependence decisions");
const keys = {
  authorKeys: toKeys("AY Mehta").keys,
  piKeys: toKeys("RD Cummings").keys,
  formerKeys: toKeys("UR Desai").keys,
};

const decide = (entry) => evaluateEntry(entry, keys).status;

// No overlap at all.
check(
  "unrelated authors -> INDEPENDENT",
  decide({ authors: "K Stavenhagen, L Laan - J Biol Chem, 2022", truncated: false }),
  "INDEPENDENT"
);

// Shares an author with the cited paper.
check(
  "user is an author -> DEPENDENT",
  decide({ authors: "M Noel, AY Mehta, C Tilton - ACS Chem, 2024", truncated: false }),
  "DEPENDENT"
);

// PI is an author but the user is not.
check(
  "PI author only -> SELF (PI)",
  decide({ authors: "J Heimburg-Molinaro, RD Cummings - MCP, 2024", truncated: false }),
  "SELF (PI)"
);

// Former PI is an author but the user is not.
check(
  "former PI author only -> SELF (FORMER PI)",
  decide({ authors: "RA Al-Horani, UR Desai - J Med Chem, 2013", truncated: false }),
  "SELF (FORMER PI)"
);

// The whole point of initial matching: a different Cummings must NOT match.
check(
  "different initials, same surname -> INDEPENDENT",
  decide({ authors: "MJ Cummings, P Smith - Glycobiology, 2023", truncated: false }),
  "INDEPENDENT"
);
check(
  "different Desai -> INDEPENDENT",
  decide({ authors: "A Desai, R Patel - Blood, 2021", truncated: false }),
  "INDEPENDENT"
);

// Same person written a different way must still match.
check(
  "Richard D Cummings matches RD Cummings",
  decide({ authors: "Richard D Cummings, M Noel - Glycobiology, 2025", truncated: false }),
  "SELF (PI)"
);
check(
  "U.R. Desai matches UR Desai",
  decide({ authors: "U.R. Desai, S Rao - Thromb Res, 2020", truncated: false }),
  "SELF (FORMER PI)"
);

// Surname collision with nothing to compare -> review, not a silent guess.
check(
  "bare Cummings, truncated list -> REVIEW",
  decide({ authors: "M Noel, Cummings - Glycobiology, 2025", truncated: true }),
  "REVIEW"
);
check(
  "bare Desai, full list from Cite popup -> REVIEW",
  decide({
    authors: "X Lee, Desai",
    full_authors: ["X Lee", "Desai"],
    truncated: true,
  }),
  "REVIEW"
);

// Resolved via the Cite popup, so independence is actually verified.
check(
  "resolved full authors, no overlap -> INDEPENDENT",
  decide({
    authors: "Y Seo, JE Park, JY Yu... - Experimental & Molecular, 2025",
    full_authors: ["Y Seo", "JE Park", "JY Yu", "B Lee", "JH Yoon"],
    truncated: true,
    author_source: "scholar-cite-bibtex",
  }),
  "INDEPENDENT"
);
check(
  "resolved full authors reveal the PI -> SELF (PI)",
  decide({
    authors: "M Noel, S Suttapitugsakul... - ACS Chem, 2024",
    full_authors: ["M Noel", "S Suttapitugsakul", "RD Cummings"],
    truncated: true,
    author_source: "scholar-cite-bibtex",
  }),
  "SELF (PI)"
);
check(
  "resolved full authors reveal the user -> DEPENDENT",
  decide({
    authors: "M Noel, S Suttapitugsakul... - ACS Chem, 2024",
    full_authors: ["M Noel", "AY Mehta", "RD Cummings"],
    truncated: true,
    author_source: "scholar-cite-bibtex",
  }),
  "DEPENDENT"
);

console.log(
  `\n${passed} passed${process.exitCode ? ", some FAILED" : ", all good"}`
);

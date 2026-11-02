// Offline tests for work-type classification. Run: node tools/test-work-type.js
//
// Why these matter: patents have to stay separable from article citations, and
// the failure mode that matters is the FALSE positive -- a journal article whose
// title merely talks about patents being filed as a patent. The corpus contains
// exactly such a paper ("An update on recent patents on thrombin inhibitors"),
// so it is used here as a regression case. The four real patent records below
// are transcribed from the captured report JSON on disk (2026-10-30); they are
// the acceptance set for the `patents` query.
//
// No network access, no files read -- the classifier is pure.

const assert = require("assert");
const { classifyWork, patentNumber, cleanNumber, CARRIER_FIELDS } = require("./work-type");

let passed = 0;
function check(label, actual, expected) {
  try {
    assert.deepStrictEqual(actual, expected);
    passed++;
    console.log(`  ok   ${label}`);
  } catch (e) {
    console.log(
      `  FAIL ${label}\n         got: ${JSON.stringify(actual)}\n         want: ${JSON.stringify(expected)}`
    );
    process.exitCode = 1;
  }
}

// Compare only the fields that decide a case, so an unexpected extra never
// hides and a missing one never passes by accident.
function shape(entry) {
  const r = classifyWork(entry);
  return {
    work_type: r.work_type,
    patent_number: r.patent_number,
    patent_kind: r.patent_kind,
  };
}

console.log("Regression: an article ABOUT patents is not a patent");
// The title mentions patents and the venue is the journal "Expert Opinion on
// Therapeutic Patents". That is a JOURNAL name, not a patent document: there is
// no patent number and no patent-server link. The old text scan filed this as a
// patent. The classifier now declines to guess and returns "unknown", which
// keeps it out of the patent count without hiding the doubt.
{
  const r = classifyWork({
    title: "An update on recent patents on thrombin inhibitors (2010-2013)",
    rawTitle: "An update on recent patents on thrombin inhibitors (2010-2013)",
    authors:
      "AY Mehta, RD Cummings - Expert Opinion on Therapeutic Patents, 2014 - Taylor & Francis",
    snippet: "We review recent patents on thrombin inhibitors granted between 2010 and 2013.",
    link: "https://www.tandfonline.com/doi/abs/10.1517/13543776.2014.870881",
  });
  check("journal review is not counted as a patent", r.work_type, "unknown");
  check("no patent number is invented for it", r.patent_number, "");
  check("the evidence says why it is undecided", /no patent document/.test(r.evidence), true);
}
check(
  "article whose title AND snippet mention patents, journal venue",
  shape({
    title: "Patent landscapes of glycan microarray technology",
    rawTitle: "Patent landscapes of glycan microarray technology",
    snippet:
      "Several patents claim the method; we compare the granted claims with the literature. Patent US10993914B2 is one example.",
    authors: "AK Mehta, JP Kersey - Glycobiology, 2023 - academic.oup.com",
    link: "https://academic.oup.com/glycob/article/33/5/401/7012345",
  }),
  { work_type: "article", patent_number: "", patent_kind: "" }
);
check(
  "snippet quoting a patent number is still an article",
  shape({
    title: "Heparin mimetics in clinical development",
    authors: "L Fan, R Dhar - Drug Discovery Today, 2025 - cell.com",
    snippet:
      "A cited patent, US 2025/0084,117 A1, describes spaced heparinoids. Patent applications in this space are listed.",
    link: "https://www.sciencedirect.com/science/article/pii/S1359644625000112",
  }),
  { work_type: "article", patent_number: "", patent_kind: "" }
);

console.log("\nThe four captured patent records (acceptance set)");
// Transcribed verbatim from heparan-sulfate-glycomimetics-...-p2.report.json.
check(
  "US20250084117A1 - Google Patents link plus 'US Patent App.' venue",
  shape({
    title: "Spaced heparinoids: a new class of heparin-like molcules",
    authors:
      "S Nadji, REN Yingjie, L Fan, R Dhar\u00a0- US Patent App. 18/632,623, 2025 - Google Patents",
    authors_used: "S Nadji, REN Yingjie, L Fan, R Dhar",
    link: "https://patents.google.com/patent/US20250084117A1/en",
  }),
  { work_type: "patent-application", patent_number: "US20250084117A1", patent_kind: "A1" }
);
check(
  "US11052079B2 - granted, venue says 'US Patent'",
  shape({
    title: "Liposomes useful for drug delivery",
    authors:
      "K Hong, DC Drummond, D Kirpotin\u00a0- US Patent 11,052,079, 2021 - Google Patents",
    authors_used: "K Hong, DC Drummond, D Kirpotin",
    link: "https://patents.google.com/patent/US11052079B2/en",
  }),
  { work_type: "patent", patent_number: "US11052079B2", patent_kind: "B2" }
);
check(
  "US10993914B2 - venue ellipsised by Scholar, link carries the number",
  shape({
    title: "Stabilizing camptothecin pharmaceutical compositions",
    authors:
      "DC Drummond, DB Kirpotin, ME Hayes\u2026\u00a0- US Patent\u00a0\u2026, 2021 - Google Patents",
    authors_used: "DC Drummond, DB Kirpotin, ME Hayes",
    link: "https://patents.google.com/patent/US10993914B2/en",
  }),
  { work_type: "patent", patent_number: "US10993914B2", patent_kind: "B2" }
);
check(
  "US12059497B2 - same title, later year, different number",
  shape({
    title: "Stabilizing camptothecin pharmaceutical compositions",
    authors:
      "DC Drummond, DB Kirpotin, ME Hayes\u2026\u00a0- US Patent\u00a0\u2026, 2024 - Google Patents",
    authors_used: "DC Drummond, DB Kirpotin, ME Hayes",
    link: "https://patents.google.com/patent/US12059497B2/en",
  }),
  { work_type: "patent", patent_number: "US12059497B2", patent_kind: "B2" }
);

console.log("\nPositive evidence sources");
check(
  "USPTO full-text link alone is enough",
  shape({
    title: "Some invention",
    authors: "J Doe - 2019 - patft.uspto.gov",
    link: "https://patft.uspto.gov/netacgi/nph-Parser?Sect1=PTO2&Term=1",
  }),
  { work_type: "patent", patent_number: "", patent_kind: "" }
);
check(
  "Espacenet link alone is enough",
  shape({
    title: "A European filing",
    authors: "A Inventor - 2020",
    link: "https://worldwide.espacenet.com/patent/search?q=pn%3DEP3122637B1",
  }),
  { work_type: "patent", patent_number: "", patent_kind: "" }
);
check(
  "venue text only, no patent link",
  shape({
    title: "Compositions and methods",
    authors: "AB Smith, CD Jones\u00a0- US Patent 9,123,456, 2015 - Google Patents",
    link: "",
  }),
  { work_type: "patent", patent_number: "US9123456", patent_kind: "" }
);
check(
  "external corroboration record naming a patent is a carrier field",
  shape({
    title: "Compositions and methods",
    authors: "AB Smith - 2015",
    external_authors: "AB Smith - US Patent 9,123,456",
    link: "",
  }),
  { work_type: "patent", patent_number: "US9123456", patent_kind: "" }
);
check(
  "PCT national-phase entry in the venue",
  shape({
    authors: "K Sato\u00a0- PCT Application US2018/023456, 2018 - Google Patents",
    link: "",
  }),
  { work_type: "patent-application", patent_number: "", patent_kind: "" }
);

console.log("\nOrdinary articles stay articles");
check(
  "plain journal article",
  shape({
    title: "Galectin-3 decreases 4-1BBL bioactivity",
    authors: "C Hou, W Li - Analytical and Bioanalytical Chemistry, 2025 - Springer",
    link: "https://link.springer.com/article/10.1007/s00216-025-01234-5",
  }),
  { work_type: "article", patent_number: "", patent_kind: "" }
);
check(
  "empty entry",
  shape({}),
  { work_type: "article", patent_number: "", patent_kind: "" }
);
check(
  "a word containing 'patent' as a substring does not trigger",
  shape({
    authors: "A Patente, R Parente - Organic Process Research, 2021 - pubs.acs.org",
    link: "",
  }),
  { work_type: "article", patent_number: "", patent_kind: "" }
);
check(
  "'patentability' is a word, not a venue",
  shape({
    title: "Patentability of naturally occurring sequences",
    authors: "D Cutter - Nature Biotechnology, 2019 - nature.com",
    link: "",
  }),
  { work_type: "article", patent_number: "", patent_kind: "" }
);

console.log("\nNumber extraction");
check("number from a Google Patents URL", patentNumber("https://patents.google.com/patent/US11052079B2/en"), "US11052079B2");
check("commas and spaces stripped", patentNumber("US Patent 11,052,079"), "US11052079");
check("application serial form", patentNumber("US Patent App. 18/632,623"), "US18632623");
check("nothing patent-like yields empty", patentNumber("Glycobiology, 2023"), "");
check("cleanNumber removes separators", cleanNumber("us-2025/0084,117 a1"), "US20250084117A1");
check(
  "URL number wins over a truncated venue",
  patentNumber("https://patents.google.com/patent/US10993914B2/en", "US Patent\u00a0\u2026, 2021"),
  "US10993914B2"
);

console.log("\nField scoping guard");
// If someone widens the scanned fields again this list has to change, which is
// the point: the title and snippet must never appear here.
check("carrier fields are exactly the venue-bearing ones", CARRIER_FIELDS, [
  "authors",
  "authors_used",
  "external_title",
  "external_authors",
]);

console.log("\nEvidence string is recorded, not invented");
{
  const r = classifyWork({
    title: "Liposomes useful for drug delivery",
    authors: "K Hong - US Patent 11,052,079, 2021 - Google Patents",
    link: "https://patents.google.com/patent/US11052079B2/en",
  });
  check("link host named in evidence", /patents\.google\.com/.test(r.evidence), true);
  check("venue wording named in evidence", /venue text/i.test(r.evidence), true);
  const a = classifyWork({ title: "x", authors: "Y - Journal, 2020", link: "https://example.org" });
  check("article carries no evidence", a.evidence, "");
}

console.log(`\n${passed} check(s) passed${process.exitCode ? "  (FAILURES above)" : ""}`);

/**
 * tools/title-duplicates.js
 *
 * Offline check: how many distinct papers would collapse if two records with
 * the SAME normalized title but different Scholar citation ids were treated as
 * one paper?
 *
 * Why this exists. A citing list is keyed by Scholar's own citation id, so when
 * Scholar stores two copies of one paper it gives each a different id and
 * paperKey() keeps them apart. That is correct for reproducing the printed
 * page, which shows both rows, but it inflates the "distinct works citing this
 * article" figure and, worse, it can put a garbled title on an exhibit. The
 * CD206 page 3 case is exactly that: rows 3 and 11 are the same Steuten et al.
 * bioRxiv preprint, and rows 11/12 also differ only by truncation ("Bakker",
 * "DW, T").
 *
 * This script does not change anything. It groups every stored record by
 * normalized title, and for each group whose members have more than one cites
 * id it reports what the ledger would look like if those members were one
 * paper. Use it to decide whether a rule is worth adding; it deliberately
 * prints evidence rather than a verdict, because a shared title is also
 * legitimate for two genuinely different papers (editorials quoting the same
 * headline, translations, "Correction:" notices).
 *
 * Read-only. No network. Run: node tools/title-duplicates.js
 */

"use strict";

const fs = require("fs");
const path = require("path");
const tally = require("./tally.js");

const REPORT_DIR = path.resolve(
  __dirname,
  "..",
  "Independent Citation Record",
  "Exhibits",
  "Supporting"
);
const PDF_DIR = path.resolve(
  __dirname,
  "..",
  "Independent Citation Record",
  "Exhibits",
  "PDFs"
);

/**
 * A deliberately aggressive title key for grouping: letters and digits only,
 * in their original order, so it survives the Unicode minus sign and Greek
 * letters that normalizeText() turns into a space (a naive
 * replace(/\s+/g,"") would glue "AllosterismΓ dual" onto an unrelated title).
 * Lowercased, and with a leading "correction:" / "re:" style prefix removed.
 */
function titleKey(raw) {
  if (!raw) return "";
  let s = String(raw).toLowerCase();
  s = s.replace(/^(correction|re|reply|response to)\s*[:\-]\s*/, "");
  // Greek letters used as scientific notation carry no meaning for matching.
  s = s.replace(/[α-ωΑ-Ω]+/g, "");
  return s.replace(/[^a-z0-9]/g, "");
}

/**
 * A report entry stores the Scholar byline in `authors` ("RA Al-Horani, UR Desai
 * - Journal of Medicinal Chemistry, 2014 - pmc.ncbi.nlm.nih.gov") and has no
 * separate venue or year field, so both are read out of that string. Used only
 * as evidence for whether two same-titled records look like the same work.
 */
function venueOf(authors) {
  const s = String(authors || "");
  const i = s.indexOf(" - ");
  if (i < 0) return "";
  return s
    .slice(i + 3)
    .split(",")[0]
    .replace(/\s*\d{4}.*$/, "")
    .trim()
    .toLowerCase();
}

function yearOf(authors) {
  const m = String(authors || "").match(/,\s*(\d{4})/);
  return m ? m[1] : "";
}

const groups0 = tally.groupReports(REPORT_DIR, PDF_DIR);
let totalRecords = 0;
// Two different questions, and only the first one is safe to act on.
//
//   within: two records on the SAME citing list share a title. That is almost
//           always Scholar storing one paper twice (the CD206 "Bakker" case),
//           because the same work cannot cite an article twice.
//   across: the same title appears on two DIFFERENT citing lists. That is
//           usually one real paper citing two of the user's articles, which is
//           legitimate and must not be merged.
const withinPub = new Map(); // base -> Map(titleKey -> Map(cid -> member))
const acrossPub = new Map(); // titleKey -> Map(cid -> member)

for (const g of groups0.values()) {
  if (!withinPub.has(g.base)) withinPub.set(g.base, new Map());
  const byTitle = withinPub.get(g.base);
  for (const e of g.entries || []) {
    if (e.duplicate_of) continue; // language editions are already excluded
    totalRecords++;
    const key = titleKey(e.rawTitle);
    if (!key) continue;
    for (const [map, label] of [
      [byTitle, ""],
      [acrossPub, ""],
    ]) {
      if (!map.has(key)) map.set(key, new Map());
      const byCid = map.get(key);
      const id = e.cid || e.link || "(no id)";
      if (!byCid.has(id)) {
        byCid.set(id, {
          title: e.rawTitle,
          venue: venueOf(e.authors),
          year: yearOf(e.authors),
          independent: tally.isHighlighted(e),
          review: e.status === "REVIEW",
          pubs: new Set(),
          copies: 0,
        });
      }
      const m = byCid.get(id);
      m.copies++;
      m.pubs.add(g.base);
    }
  }
}

const collisionsOf = (map) =>
  [...map.entries()].filter(([, byCid]) => byCid.size > 1);

const withinCollisions = [];
for (const [base, byTitle] of withinPub) {
  for (const [key, byCid] of collisionsOf(byTitle)) {
    withinCollisions.push({ base, key, byCid });
  }
}
const acrossCollisions = collisionsOf(acrossPub).sort(
  (a, b) => b[1].size - a[1].size
);

console.log(`Records in scope : ${totalRecords}`);
console.log(`Filed publications: ${withinPub.size}`);
console.log(
  `SAME LIST, same title on 2+ records : ${withinCollisions.length}  <- duplicates`
);
console.log(
  `DIFFERENT LISTS, same title         : ${acrossCollisions.length}  <- usually one paper citing two articles`
);
console.log();

let extraIfMerged = 0;
let extraIfMergedIndep = 0;
let suspicious = 0;
let printed = 0;
const verbose = process.argv.includes("--verbose");

for (const { base, byCid } of withinCollisions) {
  const members = [...byCid.values()];
  // The cheap evidence: do the members look like the same work, or like two
  // works that happen to share a headline? Same venue is strong evidence,
  // different year is strong evidence against.
  const venues = new Set(members.map((m) => m.venue));
  const years = new Set(members.map((m) => String(m.year || "")));
  const sameVenue = venues.size === 1;
  const sameYear = years.size <= 1;
  const likely = sameVenue && sameYear;
  if (!likely) suspicious++;
  // Counting one paper per title removes (members - 1) distinct papers, but
  // only where the member actually contributed a counted independent.
  const indepMembers = members.filter((m) => m.independent);
  extraIfMerged += members.length - 1;
  if (indepMembers.length > 1) extraIfMergedIndep += indepMembers.length - 1;
  if (verbose || likely) {
    printed++;
    console.log(
      `${likely ? "SAME VENUE+YEAR" : "differs      "}  [${base}]`.slice(0, 70)
    );
    console.log(`      ${members[0].title}`.slice(0, 100));
    for (const m of members) {
      console.log(
        `    ${String(m.copies).padStart(2)}x  ` +
          `${m.independent ? "INDEP " : "      "}${m.venue} ${m.year}`
      );
    }
  }
}

console.log();
console.log(
  `Merging same-list title duplicates: ${extraIfMerged} fewer distinct works, ` +
    `${extraIfMergedIndep} fewer counted independent citations.`
);
console.log(
  `Of the ${withinCollisions.length} same-list collisions, ${suspicious} have ` +
    `members that do NOT share venue and year, so a blanket rule would merge ` +
    `genuinely different works.`
);
console.log(
  `Printed ${printed} of them; pass --verbose to print all, including the ` +
    `suspicious ones.`
);

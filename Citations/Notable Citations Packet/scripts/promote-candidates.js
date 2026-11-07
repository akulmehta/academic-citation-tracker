// Turn examined candidates into rows of the packet's `citation` table.
//
// The instructions require a record of everything screened, not only of what was
// selected (§4.5), so a candidate that has been looked at stops being queue state
// and becomes a citation row. It arrives as `held` — undecided — because a tier
// needs the PDF text, which scan-mentions.js supplies.
//
// Read-only against the Independent Citation Record. The candidate table already
// carries the bibliographic fields the record published; this copies them across.

const { openCatalog, openPacket, sharesAuthor } = require("./lib");

const argv = process.argv.slice(2);
const DRY = argv.includes("--dry");

function main() {
  const db = openPacket();
  const cat = openCatalog();

  // The cited work's title and byline, so `cited_paper` is the record's own
  // wording rather than a paraphrase, and so independence can be re-checked.
  const pubs = new Map(cat.prepare("SELECT cites_id, title, year, authors FROM publications").all().map(p => [p.cites_id, p]));

  const cands = db.prepare(`SELECT * FROM candidate
    WHERE packet_row_uid IS NULL OR packet_row_uid = '' ORDER BY page, row_uid`).all();
  console.log(`${cands.length} candidate row(s) not yet in table citation`);

  const C_COLS = ["row_uid","folder_uid","n","status","screen_reason","screen_date","is_main","additional_row_uids",
    "cites_id","cited_tool","cited_paper","cited_earliest_date","cited_was_preprint","citing_title","citing_authors",
    "citing_senior_author","citing_institutions","citing_country","citing_venue","citing_year","citing_published_date",
    "citing_article_type","citing_url","patent_number","project","tier","section","page","quote","use_type",
    "in_original_petition","negative","language","evidence_basis","pdf_file","source_pdf","exhibit_pdf","notes"];
  const UPDATABLE = C_COLS.filter(c => c !== "row_uid");
  const ins = db.prepare(`INSERT INTO citation (${C_COLS.join(", ")})
    VALUES (${C_COLS.map(() => "?").join(", ")})
    ON CONFLICT(row_uid) DO UPDATE SET ${UPDATABLE.map(c => `${c}=excluded.${c}`).join(", ")}`);

  // A candidate is one citing WORK: its folder is its own uid. If the same paper
  // later turns out to cite two of the applicant's publications, apply-decision
  // folds the second row under this one the same way the importer did.
  let promoted = 0;
  const overlaps = [];
  for (const c of cands) {
    const pub = pubs.get(c.cites_id);
    const nonEnglish = c.is_non_english || /non-?english/i.test(c.language_flag || "");

    // The record decides independence and this packet does not overrule it. But a
    // citation whose byline names an author of the cited work is not something the
    // packet can hand to counsel as a notable independent citation either, so it is
    // HELD for the applicant's decision rather than included. The record is not
    // touched. Found on cit-000511: Scholar's list is truncated at ten names and
    // hides the eleventh, but the record's own corroborating PubMed byline for that
    // paper reads "… Cooper MD, Cummings RD", and Cummings co-authored the cited
    // GLAD paper.
    // candidate.authors holds the fullest byline the record published: the
    // corroborating external list when there is one, else Scholar's list.
    if (!nonEnglish && pub && sharesAuthor(pub.authors, c.authors)) {
      overlaps.push(`${c.row_uid} — byline shares an author with "${(pub.title || "").slice(0, 48)}"`);
    }
    const status = nonEnglish ? "screened-out" : "held";
    const reason = nonEnglish ? "non-English" : null;
    if (!DRY) {
      ins.run(
        c.row_uid, c.row_uid, null, status, reason, null, 1, null,
        c.cites_id,
        // The tool the citation is to, from the record's own cited publication.
        pub ? toolLabel(pub.title) : null,
        pub ? pub.title : null,
        pub ? String(pub.year || "") : null, 0,
        c.title, c.authors, c.senior_author, c.institutions, c.country,
        c.venue, c.year, null, c.work_type || "article", c.link, null,
        projectForTool(pub ? pub.title : ""), null, c.section_found, null, null,
        null, 0, 0, nonEnglish ? "Non-English" : "English",
        "Google Scholar snapshot via candidate queue",
        c.pdf_file, c.pdf_url ? `downloaded from ${c.pdf_source}` : null,
        c.exhibit_base ? `${c.exhibit_base}.pdf` : null,
        `Promoted from the discovery queue on ${new Date().toISOString().slice(0, 10)}; discover_state=${c.discover_state}.`
      );
    }
    if (!DRY) db.prepare(`UPDATE candidate SET packet_row_uid=? WHERE row_uid=?`).run(c.row_uid, c.row_uid);
    promoted++;
  }
  console.log(`${DRY ? "[dry] would promote" : "promoted"}: ${promoted} | ${promoted - cands.filter(c => c.is_non_english).length} awaiting a scan`);
  if (overlaps.length) {
    console.log(`\n${overlaps.length} candidate(s) name an author of the cited paper. The record classifies these as`);
    console.log("independent, and this packet does not overrule that, but neither does it present them as");
    console.log("notable independent citations. They are HELD for the applicant's decision:");
    for (const o of overlaps) console.log("  ", o);
    console.log("   The Independent Citation Record was not modified. Record the decision there through");
    console.log("   that record's own tooling if the classification should change.");
  }
  if (promoted) console.log("\nNext: node scripts/scan-mentions.js");
  db.close();
  cat.close();
}

/**
 * The applicant's tool named by a cited publication, in the short form the packet
 * uses. Derived from the cited title so it cannot drift when a different paper is
 * queued; matched on distinctive phrases, not the word "glycan" alone.
 */
/* Tool and project come from lib.js, the single definition. The copies that
 * lived here mapped GLAD to project 3 while the importer's mapped it to 2, and
 * `toolLabel` matched the substring "glyph" — which is inside "glycan" in no
 * title today but would match any future title that merely contains it. */
const { toolForCitedPaper, projectForCitedPaper } = require("./lib");
const toolLabel = toolForCitedPaper;
const projectForTool = projectForCitedPaper;

main();

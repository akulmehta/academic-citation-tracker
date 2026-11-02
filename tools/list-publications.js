// Parse a saved Google Scholar profile HTML snapshot into a publication table.
// Usage: node list-publications.js ["path/to/snapshot.html"]

const fs = require("fs");
const path = require("path");

const DEFAULT_HTML = path.join(
  __dirname,
  "..",
  "Independent Citation Record",
  "Exhibits",
  "Supporting",
  "akul-mehta-google-scholar-2026-10-29.html"
);

function decode(text) {
  return String(text)
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/[\u202a\u202c\u200e\u200f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function stripTags(html) {
  return decode(html.replace(/<[^>]*>/g, ""));
}

function main() {
  const file = process.argv[2] || DEFAULT_HTML;
  const html = fs.readFileSync(file, "utf8");

  // Each publication occupies a data row plus a following detail row.
  const rowRe =
    /<tr[^>]*class="[^"]*gsc_a_tr[^"]*"[^>]*>([\s\S]*?)<\/tr>/g;
  const rows = [];
  let m;
  while ((m = rowRe.exec(html)) !== null) {
    rows.push(m[1]);
  }

  const pubs = [];
  for (let i = 0; i < rows.length; i++) {
    const cell = rows[i];
    const linkMatch = cell.match(
      /<a[^>]+href="([^"]*view_citation[^"]*)"[^>]*>([\s\S]*?)<\/a>/
    );
    if (!linkMatch) continue;

    const title = stripTags(linkMatch[2]);
    const href = decode(linkMatch[1]);

    // Citing-list URL and count live in the gsc_a_c cell of the same row.
    const citeMatch = cell.match(
      /<td class="gsc_a_c"><a[^>]+href="([^"]+)"[^>]*>(\d+)<\/a>/
    );
    const citedBy = citeMatch ? parseInt(citeMatch[2], 10) : null;
    const citesUrl = citeMatch
        ? decode(citeMatch[1]).replace(/^\/+/, "https://scholar.google.com/")
        : "";

    // Authors and venue are the gs_gray divs inside the same cell.
    const gray = [...cell.matchAll(/<div class="gs_gray">([\s\S]*?)<\/div>/g)]
      .map((g) => stripTags(g[1]).replace(/,\s*$/, ""));

    pubs.push({
      title,
      citedBy,
      authors: gray[0] || "",
      venue: gray[1] || "",
      url: href,
      citesUrl,
    });
  }

  // Fallback: some layouts put the count in the same row as the title link only.
  if (pubs.length === 0) {
    console.error("No gsc_a_tr rows parsed - inspect HTML structure.");
    return;
  }

  pubs.sort((a, b) => (a.citedBy ?? 0) - (b.citedBy ?? 0));

  console.log(`Parsed ${pubs.length} publications from ${path.basename(file)}\n`);
  for (const p of pubs) {
    console.log(`[${String(p.citedBy).padStart(5)} cites] ${p.title}`);
    console.log(`    Authors: ${p.authors}`);
    console.log(`    Venue:   ${p.venue}`);
    console.log(`    Cites:   ${p.citesUrl}\n`);
  }
}

main();

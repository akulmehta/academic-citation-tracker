"use strict";
/**
 * `linkKind` decides what the retrieval queue refuses. A book or chapter is out of
 * scope (research articles only), but a Springer item-level protocol is in scope,
 * and a repository thesis must not be mistaken for a chapter because its file name
 * contains an underscore-and-digits sequence.
 *
 * Run: node scripts/test-link-kind.js
 */
const { linkKind } = require("./lib.js");
let pass = 0;
let fail = 0;
function is(url, want) {
  const got = linkKind(url);
  if (got === want) {
    pass++;
  } else {
    fail++;
    console.log(`FAIL: linkKind(${JSON.stringify(url)}) = ${got}, want ${want}`);
  }
}

// Book chapters: the ISBN in the DOI is the tell.
is("https://onlinelibrary.wiley.com/doi/abs/10.1002/9781119865452.ch13", "book");
is("https://www.taylorfrancis.com/chapters/edit/10.1201/9781003158486-2/lignin-platform", "book");
is("https://api.taylorfrancis.com/content/chapters/edit/download?identifierValue=10.1201/9781003635901-6", "book");
is("https://pubs.acs.org/doi/abs/10.1021/bk-2019-1346.ch005", "book");
is("https://link.springer.com/chapter/10.1007/978-3-030-71187-0_35", "book");
is("https://www.worldscientific.com/doi/abs/10.1142/9781783269242_0003", "book");
is("https://www.sciencedirect.com/science/chapter/edited-volume/pii/B9780128203033000011", "book");
is("https://books.rsc.org/books/edited-volume/2232/chapter/8161746", "book");
is("10.1016/b978-0-12-819475-1.00107-3", "book");

// The one exception the user asked for: a single protocol, not the whole book.
is("https://link.springer.com/protocol/10.1007/978-1-0716-1398-6_10", "article");

// Still refused for their own reasons.
is("https://www.biorxiv.org/content/10.1101/2023.05.01.539123v1", "preprint");
is("http://duepublico2.uni-due.de/servlets/MCRFileNodeServlet/duepublico_derivate_00045482/Diss_Schoeneweiss.pdf", "thesis");
is("https://vtechworks.lib.vt.edu/handle/10919/123456", "thesis");

// Ordinary journal articles must never be screened out by these patterns.
is("https://pmc.ncbi.nlm.nih.gov/articles/PMC12345678/", "article");
is("https://pubs.acs.org/doi/10.1021/jacs.5c01234", "article");
is("https://www.sciencedirect.com/science/article/pii/S0021925820301234", "article");
is("https://onlinelibrary.wiley.com/doi/10.1002/anie.202501234", "article");
is("https://www.mdpi.com/1422-0067/27/3/1234/pdf", "article");

console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

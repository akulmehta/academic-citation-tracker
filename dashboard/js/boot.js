/* Boot. Split out of dashboard.js on 2026-11-04 so each page loads only the
 * renderers it uses: a chart page does not need the review queue's column set,
 * and loading it would mean a syntax error on an unrelated page stops a figure
 * from drawing.
 *
 * Every figure on every page is computed from data/citation-data.js, which
 * tools/build-dashboard-data.js writes from the ledger and the catalog. Nothing
 * here hard-codes a figure.
 */
(function () {
  "use strict";

  const {
    fmt, esc, el, loadData, initTip, currentFile, renderToc, renderMasthead,
    renderColophon,
  } = window.DASH;

  const PAGE_RENDERERS = {
    "index.html": (D) => {
      window.DASH.renderContents(D);
      window.DASH.renderMethod(D);
    },
    "overview.html": (D) => {
      const g = D.global;
      renderMasthead(
        D,
        `The headline figures, how the cited-by total has moved across dated ` +
          `snapshots, and what the record deliberately does not count. This is the ` +
          `page to print first, and the page the other figures expand on. ` +
          `${fmt(g.independent_countable)} of the ${fmt(
            g.citation_records_reviewed
          )} citing records share no author with the paper they cite.`
      );
      window.DASH.renderOverview(D);
    },
    "partition.html": (D) => {
      const g = D.global;
      renderMasthead(
        D,
        `Every citing record on the exhibit pages as one square, in exactly one ` +
          `category, and the independent share on each basis the ledger publishes. ` +
          `The squares add up to the ${fmt(g.citation_records_reviewed)} rows on the ` +
          `pages, so the partition and the count can be reconciled on one sheet.`
      );
      window.DASH.renderPartition(D);
    },
    "per-publication.html": (D) => {
      const g = D.global;
      renderMasthead(
        D,
        `Where the citations land. ${fmt(g.publications_captured)} publications ` +
          `have a filed exhibit, and each one's citing records are drawn as a bar ` +
          `split by what was decided about them, followed by how concentrated the ` +
          `independent citations are across the profile.`
      );
      window.DASH.renderPerPublication(D);
    },
    "timeline.html": (D) => {
      renderMasthead(
        D,
        `When the citing work appeared. The year is read from each citing ` +
          `record's own Scholar byline, so the shape shows ongoing use of the work ` +
          `rather than when the work was published.`
      );
      window.DASH.renderTimeline(D);
    },
    "patents.html": (D) => {
      const p = D.patents;
      renderMasthead(
        D,
        `${p.length} patent documents cite the work on a filed exhibit page, ` +
          `${p.filter((x) => x.counted).length} of them independent by the same ` +
          `author test used everywhere else. Which publications they cite, and the ` +
          `full list with patent numbers and inventors.`
      );
      window.DASH.renderPatents(D);
    },
    "verification.html": (D) => {
      const g = D.global;
      renderMasthead(
        D,
        `How each highlighted citation was verified, and what each highlight rests ` +
          `on: an external author list, Google Scholar's own complete list, or a ` +
          `person reading the published article. ${fmt(
            g.independent_countable
          )} counted independent citations on this snapshot.`
      );
      window.DASH.renderVerification(D);
    },
    "cocitation.html": (D) => {
      const G = D.graph;
      renderMasthead(
        D,
        `The PI's publications as nodes, joined where one independent citing paper ` +
          `cites two of them. ${fmt(G.publications)} publications, ` +
          `${fmt(G.edges.length)} co-citation links, coloured by research ` +
          `programme: red for the anticoagulant work, blue for glycoscience, purple ` +
          `where a paper belongs to both. The key below names every node.`
      );
      window.DASH.renderCoCitationPage(D);
    },
    "citation-wheel.html": (D) => {
      const G = D.graph;
      renderMasthead(
        D,
        `Every counted independent citation as a dot, arranged in the sector of the ` +
          `publication it cites. ${fmt(G.citations)} citations from ` +
          `${fmt(G.distinct_works)} distinct citing papers; a paper that cites more ` +
          `than one of the PI's publications is drawn once with a line to each of the ` +
          `others, which is where the two research programmes are shown to overlap.`
      );
      window.DASH.renderWheelPage(D);
    },
    "articles.html": (D) => {
      const g = D.global;
      renderMasthead(
        D,
        `One row per publication on the Google Scholar profile, with the figures ` +
          `the packet quotes. This is the table view of the record: each figure has ` +
          `a page of its own, listed on the contents page. ` +
          `${fmt(g.publications_captured)} of the ${g.publications_total} ` +
          `publications have a filed exhibit; the rest show no citation count.`
      );
      window.DASH.renderArticles(D);
    },
    "works.html": (D) => {
      const works = D.works;
      renderMasthead(
        D,
        `Every citing row that appears on a filed exhibit page — ` +
          `${fmt(works.length)} in all, of which ${fmt(
            works.filter((w) => w.marked).length
          )} are highlighted as independent. Some rows are a second listing of the ` +
          `same work — a preprint, a repository copy, another document in a patent family, or ` +
          `a translation — and each is shown next to the row the packet credits it ` +
          `through. Search by <code>row_uid</code>, or sort by any column, to find a ` +
          `row and see which exhibit page carries it.`
      );
      window.DASH.renderWorks(D);
    },
    "review.html": (D) => {
      const q = D.review_queue || [];
      const buckets = D.review_buckets || {};
      renderMasthead(
        D,
        q.length
          ? `The ${fmt(q.length)} citations the rules cannot settle, grouped by what ` +
              `would settle them: ${fmt(buckets["1 contradicted"] || 0)} an external ` +
              `record contradicts, ${fmt(
                buckets["2 external-no-overlap"] || 0
              )} an external record clears but Scholar truncates, and ${fmt(
                buckets["3 unresolvable"] || 0)
              } nothing indexes. Quote the row_uid. The ` +
              `${fmt(D.global.flagged_non_english)} non-English rows are on their own ` +
              `page and are not offered for review.`
          : `Every citation on the exhibit pages now carries a classification. The ` +
              `rows that no rule could settle were read from the published article ` +
              `and decided one at a time, the last on 2026-11-04, so the buckets below ` +
              `are empty and this chapter is the record of how each row was settled ` +
              `rather than a list of work left to do. ` +
              `${fmt(
                D.global.review_queue ?? D.global.awaiting_review
              )} rows remain open on this snapshot. The ` +
              `${fmt(
                D.global.flagged_non_english
              )} non-English rows are on their own page, where no decision is sought.`
      );
      window.DASH.renderReview(D);
    },
    "language.html": (D) => {
      const rows = D.language_held || [];
      renderMasthead(
        D,
        `${fmt(rows.length)} citations are flagged as possibly not listed in ` +
          `English. They are excluded from the exhibits and from the counted ` +
          `total, and no translations are being obtained, so this page records ` +
          `what was given up rather than work left to do.`
      );
      window.DASH.renderLanguage(D);
    },
  };

  // The script tags sit in <head>, ahead of the markup they fill in, so nothing
  // here may touch the DOM until the document is parsed. A stylesheet ahead of a
  // script blocks its execution, so by this point the CSS is applied too and a
  // container measured for a chart has its real width.
  function start() {
    initTip();
    loadData()
      .then((D) => {
        renderToc();
        const fn = PAGE_RENDERERS[currentFile()] || PAGE_RENDERERS["index.html"];
        fn(D);
        renderColophon(D);
      })
      .catch((err) => {
        document.body.insertAdjacentHTML(
          "afterbegin",
          `<div style="padding:1.5rem;max-width:44rem;margin:2rem auto;border:2px solid #b3452f;
            border-radius:4px;font-family:ui-sans-serif,system-ui,sans-serif;font-size:.9rem">
           <b>The data file could not be loaded.</b>
           <p>Run <code>node tools/build-dashboard-data.js</code> from the project root, then
           reload. Error: ${esc(err.message)}</p></div>`
        );
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();

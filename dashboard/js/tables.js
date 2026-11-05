/* Part of the dashboard, split from the single dashboard.js on 2026-11-04 so
 * each figure can live on its own printable page. Load order matters and is set
 * by the script tags in each HTML file: core, charts, networks, story, tables,
 * review, boot. Plain script tags rather than ES modules because file:// refuses
 * to fetch a module, and the pages are opened by double-clicking them.
 *
 * Every file pulls what it needs out of the shared DASH namespace and publishes
 * its own functions back into it, so a function body here reads exactly as it
 * did in dashboard.js.
 */

(function () {
  "use strict";

  const {
    COLORS, fmt, pct1, pctOf, esc, ext, el, loadData, initTip, showTip, hideTip,
    PAGES, currentFile, renderToc, renderMasthead, renderColophon, statBand, svgFor,
    measureTextWidths, containerWidth, legend, table, enableSort, REVIEW_BUCKET,
    dropAwaitingReview, unsettledSub, endLabel, shorten, firstApplicant, decisionTag,
    corrobTag, workTitle, copyNote, exhibitRef, methodHtml
  } = window.DASH;

  function renderArticles(D) {
    const g = D.global;
    const arts = D.articles;

    el(
      "table-lede"
    ).innerHTML =
      `One row per publication on the profile, including the ` +
      `${g.publications_no_count} that show no citation count and so need no exhibit. ` +
      `These are the same figures as <code>${esc(
        D.sources.ledger
      )}</code>, which is the file the packet quotes.`;

    const artCols = [
      { key: "title", label: "Publication", render: (r) => esc(r.title) },
      { key: "year", label: "Year", num: true },
      { key: "venue", label: "Venue", printHide: true, render: (r) => `<span class="hint">${esc(r.venue)}</span>` },
      { key: "cited_by_at_snapshot", label: "Scholar cited-by", num: true, render: (r) => fmt(r.cited_by_at_snapshot) },
      { key: "records", label: "Records", num: true, render: (r) => fmt(r.records) },
      { key: "unique_records", label: "Distinct", num: true, render: (r) => fmt(r.unique_records) },
      { key: "independent", label: "Indep.", num: true, render: (r) => (r.independent ? `<span class="mark">${fmt(r.independent)}</span>` : "0") },
      { key: "independent_confirmed", label: "Confirmed", num: true, render: (r) => fmt(r.independent_confirmed) },
      { key: "dependent", label: "Depend.", num: true, render: (r) => fmt(r.dependent) },
      { key: "self_former_pi", label: "Self", num: true, render: (r) => fmt(r.self_pi + r.self_former_pi) },
      { key: "review_queue", label: "Review", num: true, render: (r) => fmt(r.review_queue) },
      // Unsettled is English open author work only; the non-English rows are the
      // next column and are no longer counted here (2026-11-03). A row that is a
      // second listing of a work counted once is likewise no longer counted here
      // -- since 2026-11-05 it has its own ledger term, so this column is open
      // author work and nothing else. It reads 0 on this snapshot; the heading
      // stays "Not marked" rather than "Unsettled" so a reader never infers an
      // open question from a column that could hold a settled copy.
      { key: "independent_pending", label: "Not marked", num: true, render: (r) => fmt(r.independent_pending) },
      { key: "non_english", label: "Non-Eng.", num: true, render: (r) => fmt(r.non_english) },
      { key: "patent_independent", label: "Patents", num: true, render: (r) => (r.patent_rows ? `${fmt(r.patent_independent)}/${fmt(r.patent_rows)}` : "—") },
      { key: "pages_captured", label: "Pages", num: true, render: (r) => (r.pages_expected ? `${fmt(r.pages_captured)}/${fmt(r.pages_expected)}` : "—") },
      { key: "independent_share_pct", label: "Indep. %", num: true, render: (r) => pct1(r.independent_share_pct) },
      { key: "status", label: "Status", printHide: true },
    ];

    const renderArticles = (rows) => {
      table("articles-table", artCols, rows, {
        caption: `${rows.length} publications. Sorted by Scholar cited-by, descending.`,
        sortable: true,
      });
      // Seventeen columns cannot share a Letter sheet at their natural widths:
      // the text columns would push the table past the page edge and Chrome
      // clips what hangs off. Fixed layout divides the sheet evenly, which
      // costs nothing because every column but title and venue holds a number.
      el("articles-table").querySelector("table").classList.add("fixed-print");
    };
    const artRows = () =>
      arts
        .filter((a) => el("toggle-unfiled").checked || a.status === "captured")
        .map((a) => ({ ...a, _cls: a.status === "captured" ? "" : "unfiled" }))
        .sort((a, b) => b.cited_by_at_snapshot - a.cited_by_at_snapshot);
    renderArticles(artRows());
    enableSort("articles-table", artCols, arts, () => renderArticles(artRows()));
    el("toggle-unfiled").addEventListener("change", () => renderArticles(artRows()));

  }

  // =====================================================================
  // Every citing work page: works.html
  // =====================================================================
  function renderWorks(D) {
    const works = D.works;
    const copies = works.filter((w) => w.is_copy);
    // The list is every row on a filed exhibit page, so its length is the record
    // count, not the distinct-paper count. Saying only "distinct papers" is what
    // made a copy invisible to someone searching for it: the page claimed to hold
    // papers and silently left the second listing of one out.
    el(
      "works-lede"
    ).innerHTML =
      `${fmt(works.length)} citing rows appear on the exhibit pages, of which ` +
      `${fmt(works.filter((w) => w.marked).length)} are highlighted and ` +
      `${fmt(copies.length)} are a second listing of a work already in the list — ` +
      `a preprint, a repository copy, another document in a patent family, or a ` +
      `translation. They are shown here because the exhibit prints them; the packet ` +
      `credits each work once against the paper it cites, so this table is longer ` +
      `than the ${fmt(D.global.unique_papers_citing)} counted citations the ledger ` +
      `keeps — and longer still than the ${fmt(D.global.distinct_citing_papers)} ` +
      `distinct papers behind them, since a work that cites two of the PI's ` +
      `publications is two citations. The ` +
      `first column is each row's permanent <code>row_uid</code>, the same identifier ` +
      `the open-rows chapter, the non-English listing and the decision CSV use, so a ` +
      `row named here can be looked up anywhere else in the packet.`;
    el("works-csv-name").textContent = D.sources.ledger;

    const workCols = [
      // The uid leads here as it does on the queue, unsettled and non-English
      // tables, because it is the handle a row is quoted back by. Added
      // 2026-11-03 at the user's request: this is the longest listing and the
      // one most likely to prompt a question about a specific record, and
      // without it the only way to name a row was its title plus exhibit page.
      {
        key: "row_uid",
        label: "row_uid",
        render: (r) => `<span class="uid">${esc(r.row_uid)}</span>`,
      },
      { key: "title", label: "Citing work", render: (r) => workTitle(r) + copyNote(r) },
      // Dropped on paper only, exactly as the review tables drop it: the byline
      // is printed on the exhibit page the next column names, and this table is
      // the widest thing in the packet. Keeping it alongside a new uid column
      // would push the sheet further past its edge.
      { key: "byline", label: "Authors / venue (Scholar byline)", printHide: true, render: (r) => `<span class="hint">${esc(r.byline)}</span>` },
      { key: "cited_title", label: "Cites", render: (r) => esc(shorten(r.cited_title, 58)) },
      { key: "status", label: "Decision", render: (r) => decisionTag(r) },
      { key: "confirm_state", label: "Corroboration", render: (r) => corrobTag(r) },
      {
        key: "exhibit_page",
        label: "Exhibit",
        render: (r) => exhibitRef(r),
        // The cell shows "<base>-pN", so group by the base and then the page
        // rather than by the bare page number, which would interleave every
        // publication's page 1 together.
        sortValue: (r) => `${r.exhibit_base || ""} ${String(r.exhibit_page ?? 0).padStart(4, "0")}`,
      },
    ];

    const workRows = () => {
      const q = el("works-search").value.trim().toLowerCase();
      const markedOnly = el("works-marked-only").checked;
      const out = works.filter((w) => {
        if (markedOnly && !w.marked) return false;
        if (!q) return true;
        return (
          String(w.title).toLowerCase().includes(q) ||
          String(w.byline).toLowerCase().includes(q) ||
          String(w.cited_title).toLowerCase().includes(q) ||
          // Typing a uid should find its row, as it does on every other table.
          String(w.row_uid).toLowerCase().includes(q)
        );
      });
      return out;
    };

    const renderWorks = (rows) => {
      // Printing the whole list would run to dozens of sheets, so rows past the
      // first 250 are hidden on paper only and the CSV is named instead.
      const printed = Math.min(rows.length, 250);
      table("works-table", workCols, rows.map((r, i) => ({ ...r, _trim: i >= 250 })), {
        caption:
          `${fmt(rows.length)} citing ${rows.length === 1 ? "work" : "works"} shown` +
          (rows.length > 250 ? `; the first ${fmt(printed)} print.` : "."),
        sortable: true,
      });
      el("works-count").textContent =
        `${fmt(rows.length)} of ${fmt(works.length)} works` +
        (rows.length > 250 ? ` (first ${fmt(printed)} print)` : "");
      // Same reason as the per-article table: with the uid column added this is
      // wider than a Letter sheet at natural widths, and Chrome clips what
      // hangs off the page edge without warning. Fixed layout plus the widths in
      // styles.css keeps every column on the sheet.
      el("works-table").querySelector("table").classList.add("fixed-print");
    };
    renderWorks(workRows());
    enableSort("works-table", workCols, works, () => renderWorks(workRows()));
    el("works-search").addEventListener("input", () => renderWorks(workRows()));
    el("works-marked-only").addEventListener("change", () => renderWorks(workRows()));

  }
  Object.assign(window.DASH, {
    renderArticles, renderWorks,
  });
})();

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

  // Set by renderReview: which queue columns to draw. See the note there for why
  // the decision column disappears when there is nothing to decide.
  let showDecision = () => true;

  // =====================================================================
  // Review queue page: review.html
  //
  // This is the one page in the dashboard meant to be worked through rather
  // read. It is deliberately editable nowhere: a decision changes the packet's
  // totals, so it is recorded in the CSV against the row_uid, and no figure on
  // any page moves until that decision is rebuilt through the tools. The
  // non-English rows are NOT here -- they are on language.html, because the
  // 2026-11-01 decision means a decision on one of them cannot change a number.
  // =====================================================================
  const BUCKET_META = {
    "1 contradicted": {
      anchor: "table-contradicted",
      head: "bucket-1-head",
      why: "bucket-1-why",
      label: "An external record contradicts the Scholar byline",
      text:
        `An external record publishes a complete author list that OVERLAPS the ` +
        `PI's, so the Scholar byline this row was judged from is incomplete or ` +
        `wrong. The names it matched are printed. These are the most likely to be ` +
        `DEPENDENT or a self-citation, and the least likely to resolve as ` +
        `independent.`,
    },
    "2 external-no-overlap": {
      anchor: "table-external",
      head: "bucket-2-head",
      why: "bucket-2-why",
      label: "An external record clears it, Scholar truncates",
      text:
        `An external record has a complete author list with NO overlap, but ` +
        `Scholar's own byline is truncated, so the row is not promoted to ` +
        `independent on an external record alone. These are the likeliest to ` +
        `resolve as independent, and the cheapest to settle: open the citing ` +
        `paper, read its author list, and compare.`,
    },
    "3 unresolvable": {
      anchor: "table-unresolvable",
      head: "bucket-3-head",
      why: "bucket-3-why",
      label: "Nothing indexes it",
      text:
        `Neither PubMed nor OpenAlex indexes the paper and Scholar's byline is ` +
        `truncated, so there is nothing to compare it against. Resolving one ` +
        `needs a human look at the published article. Typical of theses, ` +
        `preprints, conference abstracts and non-indexed journals.`,
    },
  };

  // One row of the queue. The uid leads because it is what gets quoted back; the
  // exhibit link goes straight to the PDF page so a spot-check does not need a
  // folder hunt.
  const queueCols = [
    {
      key: "row_uid",
      label: "row_uid",
      render: (r) => `<span class="uid">${esc(r.row_uid)}</span>`,
    },
    {
      key: "title",
      label: "Citing paper",
      render: (r) =>
        r.link
          ? ext(r.link, esc(shorten(r.title, 90)))
          : esc(shorten(r.title, 90)),
    },
    {
      key: "scholar_byline",
      label: "Scholar byline",
      printHide: true,
      render: (r) =>
        `<span class="hint">${esc(shorten(r.scholar_byline, 80))}</span>` +
        (r.byline_truncated ? ` <span class="tag review">truncated</span>` : ""),
    },
    {
      key: "cited_work",
      label: "Cites (this profile's paper)",
      render: (r) => esc(shorten(r.cited_work, 52)),
    },
    {
      key: "why",
      label: "Why unresolved",
      render: (r) => {
        const overlap = (r.external_overlap || []).length
          ? ` <span class="overlap">overlap: ${esc(
              [...new Set(r.external_overlap)].join(", ")
            )}</span>`
          : "";
        return `<span class="hint">${esc(r.why)}</span>${overlap}`;
      },
    },
    {
      key: "external_source",
      label: "External",
      render: (r) => {
        // A record the rules discarded because its title overlap was too thin to
        // be the same work is still stored on the row, as the audit trail of the
        // rejection. It is not a source to check, so it gets no link: sending a
        // reviewer to a paper this row is not (cit-001476, a swine-lung article)
        // wastes their time and implies evidence that does not exist.
        if (r.external_match_credible === false) {
          return `<span class="hint">${esc(r.external_source || "external")} match rejected</span>`;
        }
        return r.external_url
          ? ext(r.external_url, esc(r.external_source))
          : `<span class="hint">none indexed</span>`;
      },
    },
    {
      key: "exhibit_page",
      label: "Exhibit",
      sortValue: (r) =>
        `${r.exhibit_base || ""} ${String(r.exhibit_page ?? 0).padStart(4, "0")} ${String(
          r.exhibit_row ?? 0
        ).padStart(3, "0")}`,
      render: (r) => {
        const where = `p${r.exhibit_page} · row ${r.exhibit_row}`;
        return r.exhibit_pdf
          ? ext(r.exhibit_pdf, where, r.exhibit_base)
          : `<span class="hint">${where}</span>`;
      },
    },
    // No "also non-English" column. v_review has excluded those rows since
    // 2026-11-03, so the column would be a dash on every row; a flagged row that
    // ever appears anyway is still rendered muted, with the caption below
    // explaining it.
    {
      key: "decision",
      label: "Your decision",
      render: () => `<span class="decided" title="Record this in the CSV"></span>`,
    },
  ];

  function renderReview(D) {
    const g = D.global;
    const queue = D.review_queue || [];
    const buckets = D.review_buckets || {};
    // The whole page reads differently once there is nothing to decide, and this
    // flag is what switches between the two. It is derived, never hard-coded, so a
    // future capture that produces an open row brings the working wording back on
    // its own.
    const closed = queue.length === 0;
    // v_review has excluded non-English rows since 2026-11-03 (user instruction:
    // such a row belongs on the Non-English page, not in a queue of decisions).
    // Nothing here filters on the flag any more, but a row that still carries one
    // is rendered muted with an explanatory caption below, so a stale build reads
    // as a defect rather than as an unexplained row in a work queue.

    const sheet = el("review-sheet");
    if (sheet) sheet.textContent = D.sources.review_sheet || "";

    // The callout on review.html is written here rather than in the HTML so it can
    // tell the truth about the queue's state. Addressing the reader as someone with
    // rows to decide, when there are none, is exactly the kind of stale workpaper
    // instruction that misleads whoever reads the packet next.
    const howTitle = el("review-how-title");
    const how = el("review-how");
    if (howTitle && how) {
      howTitle.textContent = closed
        ? "What this chapter records"
        : "How to use this page";
      how.innerHTML = closed
        ? `<p>
             Each row that once appeared here was settled by reading the published
             article, and the verdict was written into
             <code>${esc(D.sources.review_sheet || "the dated review sheet")}</code>
             against its <code>row_uid</code> before the record was rebuilt. Those
             decisions carry the name of the person who made them, the date, and the
             reason, and are reported on the verification page separately from the machine
             readings &mdash; so a reader can see how much of the total rests on a
             human check of the byline.
           </p>
           <p>
             Nothing on this page is editable, and nothing here changes a count.
             A row that is also non-English never appears on this list: with no
             certified translations being obtained, no reading of such a row can
             change the packet, so it belongs with the other non-English entries on
             <a href="language.html">the Non-English page</a>.
           </p>`
        : `<p>
             Write the decision into
             <code>${esc(D.sources.review_sheet || "the dated review sheet")}</code>
             in the <code>your_decision</code> column. Nothing on this page is
             editable and nothing here changes a count: none of these rows is
             currently counted as independent <i>or</i> as dependent, so a decision
             moves the totals either way.
           </p>
           <p>
             A row that is also non-English is not on this queue. With no certified
             translations being obtained, no reading of such a row can change the
             packet, so it belongs with the other non-English entries on
             <a href="language.html">the Non-English page</a> rather than in a list
             of decisions to make.
           </p>`;
    }

    // The "Your decision" column exists to point a reader at the CSV column to
    // fill in. With nothing queued it is an invitation to decide a row nobody asked
    // about, printed on an empty table, so it is dropped while the queue is closed
    // and comes back on its own the day a row appears.
    showDecision = (c) => c.key !== "decision" || !closed;

    el("review-lede").innerHTML = closed
      ? `This chapter is the record of decisions that have been made, not a list of ` +
        `decisions left to make. Every one of the ` +
        `${fmt(g.citation_records_reviewed)} citation rows on the exhibit pages now ` +
        `carries a classification: ${fmt(g.bucket_independent)} independent, ` +
        `${fmt(g.bucket_dependent)} not independent, ` +
        `${fmt(g.bucket_preprint_copy)} a second listing of a work already counted, ` +
        `and ${fmt(g.bucket_non_english)} withheld for language &mdash; which is the ` +
        `whole ${fmt(g.citation_records_reviewed)}. ` +
        `${fmt(g.review_queue ?? g.awaiting_review)} rows remain open on this ` +
        `snapshot. Citations no source could settle were read from the published ` +
        `article one at a time, and each verdict is recorded against its row_uid with ` +
        `the date and the reason &mdash; the last closed on 2026-11-04. The buckets ` +
        `below are therefore empty, and are kept so a reader can see the shape of ` +
        `what was checked and confirm that nothing was left in them.`
      : `${fmt(queue.length)} of the ${fmt(g.citation_records_reviewed)} citation rows ` +
        `on the exhibit pages cannot be settled by the rules, so they are counted ` +
        `neither as independent nor as dependent. Each one is a row you can settle: ` +
        `a decision either way changes a figure. Rows that are also non-English are ` +
        `not listed here &mdash; with no translations being obtained no decision on ` +
        `one can change the packet, so they appear with the other non-English ` +
        `entries on <a href="language.html">the Non-English page</a>. Every row here ` +
        `links to the exhibit PDF page it came from.`;

    statBand(el("review-band"), [
      {
        label: "Awaiting a decision",
        value: fmt(queue.length),
        sub: closed ? "queue closed 2026-11-04" : "counted neither way",
      },
      { label: "Contradicted", value: fmt(buckets["1 contradicted"] || 0), sub: "external list overlaps" },
      { label: "External, no overlap", value: fmt(buckets["2 external-no-overlap"] || 0), sub: "likeliest to be independent" },
      { label: "Unresolvable", value: fmt(buckets["3 unresolvable"] || 0), sub: "needs the published article" },
      {
        label: "Independent, not marked",
        value: fmt((D.unsettled_rows || []).length),
        sub: unsettledSub(D),
      },
      {
        label: "Non-English",
        value: fmt(g.flagged_non_english),
        sub: "on its own page, not work",
      },
    ]);

    const filter = (rows) => {
      const query = el("review-search").value.trim().toLowerCase();
      return rows.filter((r) => {
        if (!query) return true;
        return (
          String(r.title).toLowerCase().includes(query) ||
          String(r.scholar_byline).toLowerCase().includes(query) ||
          String(r.cited_work).toLowerCase().includes(query) ||
          String(r.row_uid).toLowerCase().includes(query)
        );
      });
    };

    const drawBucket = (name) => {
      const meta = BUCKET_META[name];
      const rows = filter(queue.filter((r) => r.bucket === name));
      el(meta.head).textContent =
        `${name.charAt(0)} · ${meta.label} — ${fmt(rows.length)} row${rows.length === 1 ? "" : "s"}`;
      // With the queue closed the bucket text is kept — it is what the categories
      // meant — and the reader is told plainly that none remains, rather than left
      // to wonder whether an empty table is a filter or a fault.
      el(meta.why).innerHTML = closed
        ? `${meta.text} <i>No row is in this bucket on this snapshot.</i>`
        : meta.text;
      table(meta.anchor, queueCols.filter(showDecision), rows.map((r) => ({ ...r, _cls: r.language_flag ? "held" : "" })), {
        caption:
          `${fmt(rows.length)} row${rows.length === 1 ? "" : "s"} in this bucket.` +
          (rows.some((r) => r.language_flag)
            ? ` Rows marked non-English are shown muted: a decision on one cannot change a count.`
            : ``),
        sortable: true,
      });
      return rows.length;
    };

    const redraw = () => {
      const shown = Object.keys(BUCKET_META).reduce((n, name) => n + drawBucket(name), 0);
      drawUnsettled(D);
      el("review-count").textContent = closed
        ? `Queue closed — nothing left to decide`
        : `${fmt(shown)} of ${fmt(queue.length)} queued rows shown`;
    };
    redraw();
    for (const meta of Object.values(BUCKET_META)) {
      enableSort(meta.anchor, queueCols, queue, redraw);
    }
    el("review-search").addEventListener("input", redraw);
  }

  // The second list: classified independent, not highlighted, and NOT held back by
  // the language screen. Since 2026-11-05 a row that is the second listing of a
  // work counted through another row is named in its own ledger term instead of
  // landing here, so this table is normally empty -- but the heading and the
  // explanation are still derived from the copy listing rather than from the
  // rule's label, so they stay honest if a future snapshot has both kinds at once.
  // See unsettledSub() for why the counting rule's label misleads.
  function drawUnsettled(D) {
    const rows = D.unsettled_rows || [];
    const head = el("unsettled-head");
    const why = el("unsettled-why");
    if (!head || !why) return;
    const copies = new Set((D.preprint_copies || []).map((r) => r.row_uid));
    const asCopies = rows.filter((r) => copies.has(r.row_uid)).length;
    head.textContent =
      `Independent but not marked — ${fmt(rows.length)} row${rows.length === 1 ? "" : "s"}`;
    if (!rows.length) {
      why.innerHTML =
        `None. Every row classified independent and not highlighted is flagged ` +
        `non-English, and since 2026-11-03 the language screen supersedes that ` +
        `classification &mdash; with no certified translations being obtained, no ` +
        `reading of such a byline can change the packet, so it is not open work. ` +
        `Those ${fmt(D.global.flagged_non_english)} rows are on ` +
        `<a href="language.html">their own page</a> and are not offered for review. ` +
        `There is nothing in the buckets above either: the queue closed on 2026-11-04. ` +
        `If a future capture produces an English row that is genuinely open, it ` +
        `appears in this table &mdash; ` +
        `<code>tools/build-dashboard-data.js</code> fails the build rather than let ` +
        `one go unlisted.`;
      table("table-unsettled", queueCols.filter(showDecision).map((c) => ({ ...c })), [], {
        caption: "No rows.",
      });
      return;
    }
    why.innerHTML =
      asCopies === rows.length
        ? `Classified independent by the author comparison and English, but not ` +
          `highlighted because each of these rows is the <b>second listing of a work ` +
          `the packet already counts once</b> through the row named in the ` +
          `<a href="overview.html#not-counted">preprint / copy table</a> on the `
          + `overview page. The work ` +
          `itself is counted; the duplicate is not marked on the exhibit, and nothing ` +
          `here is awaiting a decision.`
        : `Classified independent by the author comparison, English, and not ` +
          `highlighted only because no source has settled the list. These need settling.`;
    table("table-unsettled", unsettledCols.filter(showDecision), rows, {
      caption:
        `${fmt(rows.length)} independent-but-unhighlighted row(s)` +
        (asCopies === rows.length
          ? ` — every one a second listing of a counted work, not open work.`
          : `.`),
      sortable: true,
    });
    enableSort("table-unsettled", unsettledCols, rows, () => {});
  }

  // The unsettled rows come from a different query and carry different field
  // names than the queue (byline rather than scholar_byline, cited_title rather
  // than cited_work, reason rather than why), so they get their own column set.
  // Sharing queueCols would render blank cells the day a row appears -- which is
  // exactly the day someone needs the table to work.
  const unsettledCols = [
    {
      key: "row_uid",
      label: "row_uid",
      render: (r) => `<span class="uid">${esc(r.row_uid)}</span>`,
    },
    {
      key: "title",
      label: "Citing paper",
      render: (r) =>
        r.link
          ? ext(r.link, esc(shorten(r.title, 90)))
          : esc(shorten(r.title, 90)),
    },
    {
      key: "byline",
      label: "Scholar byline",
      printHide: true,
      render: (r) => `<span class="hint">${esc(shorten(r.byline, 80))}</span>`,
    },
    {
      key: "cited_title",
      label: "Cites (this profile's paper)",
      render: (r) => esc(shorten(r.cited_title, 52)),
    },
    {
      key: "reason",
      label: "Why not highlighted",
      render: (r) => `<span class="hint">${esc(r.reason)}</span>`,
    },
    {
      key: "confirm_state",
      label: "Corroboration",
      render: (r) => corrobTag(r),
    },
    {
      key: "exhibit_page",
      label: "Exhibit",
      sortValue: (r) =>
        `${r.exhibit_base || ""} ${String(r.exhibit_page ?? 0).padStart(4, "0")}`,
      render: (r) => {
        const where = `p${r.exhibit_page} · row ${r.exhibit_row}`;
        return r.exhibit_pdf
          ? ext(r.exhibit_pdf, where, r.exhibit_base)
          : `<span class="hint">${where}</span>`;
      },
    },
    {
      key: "decision",
      label: "Your decision",
      render: () => `<span class="decided" title="Record this in the CSV"></span>`,
    },
  ];

  // =====================================================================
  // Non-English page: language.html
  //
  // Disclosure, not a to-do list. Kept on its own page, with its own colour and
  // no decision column, so it cannot be mistaken for work left undone.
  // =====================================================================
  const langCols = [
    {
      key: "row_uid",
      label: "row_uid",
      render: (r) => `<span class="uid">${esc(r.row_uid)}</span>`,
    },
    {
      key: "title",
      label: "Citing paper",
      render: (r) =>
        r.link
          ? ext(r.link, esc(shorten(r.title, 88)))
          : esc(shorten(r.title, 88)),
    },
    {
      key: "byline",
      label: "Scholar byline",
      printHide: true,
      render: (r) => `<span class="hint">${esc(shorten(r.byline, 70))}</span>`,
    },
    {
      key: "cited_title",
      label: "Cites (this profile's paper)",
      render: (r) => esc(shorten(r.cited_title, 48)),
    },
    {
      key: "reason",
      label: "Why flagged",
      render: (r) => `<span class="hint">${esc(r.reason)}</span>`,
    },
    {
      key: "would_count",
      label: "Would count",
      render: (r) =>
        r.would_count
          ? `<span class="tag lang">yes</span>`
          : `<span class="hint">no</span>`,
    },
    {
      key: "language_edition",
      label: "Edition",
      render: (r) =>
        r.language_edition
          ? `<span class="tag lang">2nd language</span>`
          : `<span class="hint">—</span>`,
    },
    {
      key: "exhibit_page",
      label: "Exhibit",
      sortValue: (r) =>
        `${r.exhibit_base || ""} ${String(r.exhibit_page ?? 0).padStart(4, "0")}`,
      render: (r) => {
        const where = `p${r.exhibit_page} · row ${r.exhibit_row}`;
        return r.exhibit_pdf
          ? ext(r.exhibit_pdf, where, r.exhibit_base)
          : `<span class="hint">${where}</span>`;
      },
    },
  ];

  function renderLanguage(D) {
    const g = D.global;
    const rows = D.language_held || [];
    const would = rows.filter((r) => r.would_count).length;

    el("lang-lede").innerHTML =
      `${fmt(rows.length)} citation rows are flagged as possibly not listed in ` +
      `English, of which ${fmt(would)} look independent and corroborated and are ` +
      `withheld from the count by the language screen alone. They are excluded ` +
      `from the highlighted exhibits, and the packet reports the adjusted ` +
      `English-only figure instead: ${fmt(g.unique_english_independent)} ` +
      `independent of ${fmt(g.unique_english_papers)} distinct English citing ` +
      `papers, ${g.unique_english_independent_share_pct}%.`;

    statBand(el("lang-band"), [
      { label: "Flagged non-English", value: fmt(rows.length), sub: "a screen, not a ruling" },
      {
        label: "Classified independent",
        value: fmt(g.non_english_independent),
        sub: "superseded by this screen",
      },
      { label: "Withheld from the count", value: fmt(g.non_english_withheld), sub: "look independent otherwise" },
      { label: "Translations obtained", value: "none", sub: "decided 2026-11-01" },
      { label: "Adjusted English-only", value: pct1(g.unique_english_independent_share_pct), sub: "independent share" },
    ]);

    const draw = () => {
      const query = el("lang-search").value.trim().toLowerCase();
      const wouldOnly = el("lang-would-only").checked;
      const out = rows.filter((r) => {
        if (wouldOnly && !r.would_count) return false;
        if (!query) return true;
        return (
          String(r.title).toLowerCase().includes(query) ||
          String(r.byline).toLowerCase().includes(query) ||
          String(r.cited_title).toLowerCase().includes(query) ||
          String(r.row_uid).toLowerCase().includes(query)
        );
      });
      table("lang-table", langCols, out, {
        caption:
          `${fmt(out.length)} of ${fmt(rows.length)} flagged rows. ` +
          `No decision column: these are not queued.`,
        sortable: true,
      });
      el("lang-count").textContent = `${fmt(out.length)} of ${fmt(rows.length)} rows`;
    };
    draw();
    enableSort("lang-table", langCols, rows, draw);
    el("lang-search").addEventListener("input", draw);
    el("lang-would-only").addEventListener("change", draw);

    // Grouped reasons, so the shape of what was given up is visible without
    // reading 52 rows: a translator would need to cover exactly these.
    const byReason = d3.groups(rows, (r) => r.reason || "unspecified").sort(
      (a, b) => b[1].length - a[1].length
    );
    table(
      "lang-reasons",
      [
        { key: "reason", label: "Reason recorded at capture" },
        { key: "n", label: "Rows", num: true, render: (r) => fmt(r.n) },
        {
          key: "would",
          label: "Would count",
          num: true,
          render: (r) => fmt(r.would),
        },
      ],
      byReason.map(([reason, list]) => ({
        reason,
        n: list.length,
        would: list.filter((r) => r.would_count).length,
      })),
      { caption: `${byReason.length} distinct reasons across ${fmt(rows.length)} rows.` }
    );
  }
  Object.assign(window.DASH, {
    BUCKET_META, renderReview, renderLanguage,
  });
})();

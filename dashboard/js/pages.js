/* One renderer per page, each drawing that page's figures and nothing else.
 *
 * These were one function, renderStory(), until 2026-11-04. The prose moved with
 * its own figure rather than being rewritten, so a caption says the same thing it
 * said when everything shared a sheet; what changed is only which page it is on,
 * plus the sentences needed to introduce a figure to a reader who did not just
 * read the chapter before it.
 *
 * The figures themselves live in charts.js and networks.js. Nothing here computes
 * a number: every figure comes off D.global, D.articles, D.patents or D.graph,
 * which tools/build-dashboard-data.js wrote from the ledger and the catalog.
 */
(function () {
  "use strict";

  const {
    fmt, pct1, esc, ext, el, statBand, table, enableSort, shorten,
    renderMasthead, unsettledSub,
    drawHistory, drawWaffle, drawSplit, drawLollipop, drawConcentration,
    drawYears, drawPatentPubs, drawCorroboration,
    drawCoCitation, drawCitationWheel,
    firstApplicant, decisionTag, methodHtml,
  } = window.DASH;

  // =====================================================================
  // index.html — contents, not a chart page
  // =====================================================================
  function renderContents(D) {
    const g = D.global;
    renderMasthead(
      D,
      `Google Scholar credits ${fmt(g.publications_captured)} of the ` +
        `${g.publications_total} publications on the profile with ${fmt(
          g.citation_records_reviewed
        )} citing records. After checking every author list, ${fmt(
          g.independent_countable
        )} of those records — ${fmt(g.independent_unique_papers)} counted ` +
        `independent citations from ${fmt(g.distinct_independent_papers)} distinct ` +
        `papers — share no author with the paper they cite. ` +
        `Each one is highlighted in yellow on an exhibit page, and every figure here ` +
        `traces to the ${g.snapshot_date} snapshot.`
    );

    statBand(el("headline-band"), [
      {
        label: "Citing records",
        value: fmt(g.citation_records_reviewed),
        // Both bases, spelled out. A citation is counted once against each of the
        // PI's works it cites, so a paper citing two of them is two citations on
        // two exhibit pages; the distinct-paper figure collapses it to one.
        sub: `${fmt(g.unique_papers_citing)} counted citations · ${fmt(
          g.distinct_citing_papers
        )} distinct papers`,
      },
      {
        label: "Independent",
        value: fmt(g.independent_countable),
        sub: `${fmt(g.independent_unique_papers)} counted citations · ${fmt(
          g.distinct_independent_papers
        )} distinct papers`,
      },
      {
        label: "Share of decided",
        value: pct1(g.independent_share_of_decided_pct),
        sub: `${fmt(g.decided_records)} decided records`,
      },
      {
        label: "English-only (adjusted)",
        value: pct1(g.english_independent_share_pct),
        sub: `${fmt(g.english_independent_records)} of ${fmt(
          g.english_citation_records
        )}`,
      },
      {
        label: "Exhibit pages",
        value: fmt(g.exhibit_pages),
        sub: `${g.publications_captured} publications captured`,
      },
    ]);

    // The ledger's own note, quoted verbatim so the page cannot drift from the file
    // it is quoting. It speaks in column names, which this page never prints, so it
    // is introduced as what it is rather than left to read as a stray comment.
    el("record-note").innerHTML =
      `<b>How these figures are defined.</b> ` + esc(g.note);

    el(
      "contents-lede"
    ).innerHTML =
      `Each figure below is on a page of its own, so it can be read at full width ` +
      `and printed to PDF on its own sheet count rather than running over a dozen ` +
      `pages of a single long document. Every page is generated from the same data ` +
      `file, so no figure differs between them, and each prints at the vector ` +
      `resolution of the browser rather than as a screenshot.`;
  }

  // =====================================================================
  // partition.html — the waffle and the independent-share chart
  // =====================================================================
  //
  // Split out of renderOverview on 2026-11-05 at the user's request so both
  // figures print on their own sheet count. The lede below is the legend for the
  // squares, so it travels with them; the prose explaining what the partition
  // deliberately leaves out stays on overview.html with the tables that itemise it.
  function renderPartition(D) {
    const g = D.global;

    el(
      "breakdown-lede"
    ).innerHTML =
      `Every row on every exhibit page falls into exactly one of the categories ` +
      `below, and the squares add up to the ${fmt(g.citation_records_reviewed)} rows ` +
      `on the pages. ` +
      `<b>Independent</b> means the citing work shares no author with the paper it ` +
      `cites, and lists neither the PI (Richard D. Cummings) nor the former PI ` +
      `(Umesh R. Desai). It is the only thing an exhibit PDF marks. <b>Not ` +
      `independent</b> covers every row that does share an author, including the ` +
      `${fmt(g.self_pi + g.self_former_pi)} self-citations by the PI or former PI, ` +
      `which are broken out on the <a href="overview.html">overview page</a>. <b>Preprint / copy</b> is a citing work ` +
      `Google Scholar lists twice on one page &mdash; a preprint, repository, author ` +
      `or database copy of a paper already counted &mdash; so the work is credited ` +
      `once, and those ${fmt(g.bucket_preprint_copy)} rows are itemised on the page ` +
      `for the citations that are not counted. <b>Non-English</b> rows are excluded ` +
      `from the counted total, so the share quoted for the packet is never padded; ` +
      `that bucket is its own since 2026-11-03, when the language screen came to ` +
      `supersede a row's independence classification, because no certified ` +
      `translation is being obtained &mdash; those ${fmt(g.flagged_non_english)} ` +
      `rows are a closed matter reported once rather than unsettled work. ` +
      `<b>Nothing awaits a decision:</b> the category for rows no rule could settle ` +
      `holds ${fmt(g.bucket_review)} rows on this snapshot, so it is no longer drawn ` +
      `on the charts.`;

    drawWaffle(D);
    drawSplit(D);
  }

  // =====================================================================
  // overview.html — the snapshot trend and what the partition leaves out
  // =====================================================================
  function renderOverview(D) {
    const g = D.global;
    drawHistory(D);

    // What the partition leaves out. The partition itself moved to
    // partition.html on 2026-11-05; the two pages stay linked because a reader
    // asking "why is the yellow not the whole independent total?" is asking about
    // both, and the tables that itemise each category stay here.
    el(
      "notcounted-lede"
    ).innerHTML =
      `Two of the categories in the <a href="partition.html">partition</a> are not counted as independent, for reasons that ` +
      `are the opposite of one another.` +
      `<br><br>` +
      `<b>Preprint / copy &mdash; ${fmt(g.bucket_preprint_copy)} rows.</b> Google ` +
      `Scholar lists some papers twice on one citing page: the journal record and a ` +
      `bioRxiv preprint, institutional repository, author upload, thesis or database ` +
      `copy of the same work. The packet counts the work <b>once</b>. Each row in the ` +
      `table below names the row that stands in its place, so the exhibit and the ` +
      `count can be reconciled by hand. A copy also <b>takes the verdict of that ` +
      `standing row</b>: where the published record was settled, the duplicate is ` +
      `reported under the same classification and is not left as an open question, ` +
      `since its own byline cannot change an answer the work already has. Only a copy ` +
      `whose standing row is itself unresolved would stay open. ` +
      `${fmt((D.preprint_copies || []).filter((r) => r.marked).length)} of them still ` +
      `carry a yellow mark on the exhibit, because the exhibit is a picture of ` +
      `Scholar's page and both rows are printed on it &mdash; that is the gap between ` +
      `${fmt(g.independent_countable)} marks and ` +
      `${fmt(g.independent_unique_papers)} counted independent citations.` +
      `<br><br>` +
      `<b>The counted-citation basis, stated plainly.</b> A citation is credited ` +
      `against the work it cites, so a paper that cites two of the PI's publications ` +
      `is <b>two</b> independent citations and is marked once on each of the two ` +
      `exhibit pages. Nothing here collapses it to one: of the ` +
      `${fmt(g.independent_unique_papers)} counted citations, ` +
      `${fmt(g.distinct_independent_papers)} are distinct papers, and the difference ` +
      `is genuine double-citing rather than a duplicate listing. A second listing of ` +
      `the same paper against the <b>same</b> cited work is the opposite case &mdash; ` +
      `one citation printed twice &mdash; and that is the only thing the counted basis ` +
      `drops.` +
      `<br><br>` +
      `<b>Non-English, a closed matter &mdash; ${fmt(g.flagged_non_english)} rows.</b> ` +
      `Of these, ${fmt(g.non_english_independent)} also carry an independent ` +
      `classification. Since 2026-11-03 the language screen <i>supersedes</i> that ` +
      `classification: per the guide a non-English citation needs a certified human ` +
      `translation and affidavit, and the project decided on 2026-11-01 not to obtain ` +
      `any, so no reading of one of these bylines can change the packet. They are ` +
      `reported once, as non-English &mdash; ${fmt(g.non_english_withheld)} of them ` +
      `would otherwise have counted, which is what the packet gives up. They are ` +
      `<a href="language.html">kept apart</a> and not offered for decision.` +
      `<br><br>` +
      `<b>Nothing awaits a decision &mdash; ${fmt(
        g.review_queue ?? g.awaiting_review
      )} rows open.</b> Every citation whose author list no source could settle was ` +
      `read from the published article and its verdict recorded against the row_uid; ` +
      `the last of them closed on 2026-11-04, so no figure on this page is ` +
      `provisional. The <a href="review.html">open-rows chapter</a> stays in the ` +
      `packet as the record of how each row was settled &mdash; what was checked, what ` +
      `it turned on, and who decided it &mdash; rather than as a list of work left to ` +
      `do.`;

    statBand(el("open-band"), [
      {
        label: "Preprint / copy",
        value: fmt(g.bucket_preprint_copy),
        sub: "same work, counted once",
      },
      {
        label: "Non-English",
        value: fmt(g.flagged_non_english),
        sub: `${fmt(g.non_english_independent)} classified independent, superseded`,
      },
      {
        label: "Withheld from the count",
        value: fmt(g.non_english_withheld),
        sub: "would count with a translation",
      },
      {
        label: "Awaiting a decision",
        value: fmt(g.review_queue ?? g.awaiting_review),
        sub: "queue closed 2026-11-04",
      },
      {
        label: "Independent, not marked",
        value: fmt(g.independent_pending),
        sub: unsettledSub(D),
      },
      {
        label: "Of which self-citations",
        value: fmt(g.self_pi + g.self_former_pi),
        sub: `${fmt(g.self_pi)} current PI · ${fmt(g.self_former_pi)} former PI`,
      },
    ]);

    renderCopyTable(D);
    renderOpenItems(D, g);
  }

  // The fifth bucket, row by row. A reviewer comparing a two-sheet exhibit to the
  // count needs to see which row stands for the work, not merely that some rows
  // were dropped.
  function renderCopyTable(D) {
    const copies = (D.preprint_copies || []).slice();
    if (!el("copy-table")) return;
    const copyCols = [
      { key: "row_uid", label: "row_uid", render: (r) => `<code>${esc(r.row_uid)}</code>` },
      {
        key: "title",
        label: "Citing work, listed twice",
        render: (r) =>
          r.link
            ? ext(r.link, esc(shorten(r.title, 90)), "Open the second listing")
            : esc(shorten(r.title, 90)),
      },
      { key: "reason", label: "Why it is a second listing", render: (r) => `<span class="hint">${esc(r.reason)}</span>` },
      {
        key: "inherited_status",
        label: "Reported as",
        render: (r) => {
          const word = (s) =>
            s === "INDEPENDENT"
              ? "independent"
              : s === "DEPENDENT"
                ? "dependent"
                : s === "SELF (PI)"
                  ? "self · PI"
                  : s === "SELF (FORMER PI)"
                    ? "self · former PI"
                    : esc(s);
          if (r.inherited_status)
            return `<span class="tag confirmed">${word(r.inherited_status)} · inherited</span>`;
          if (r.status === "REVIEW")
            return `<span class="tag review">review · own row</span>`;
          return `<span class="tag">${word(r.status)} · own row</span>`;
        },
      },
      {
        key: "stands_for_row_uid",
        label: "Counted once as",
        render: (r) =>
          r.stands_for_row_uid
            ? `<code>${esc(r.stands_for_row_uid)}</code>` +
              (r.stands_for_link
                ? " " + ext(r.stands_for_link, "↗", "Open the counted version")
                : "")
            : `<span class="hint">—</span>`,
      },
      {
        key: "marked",
        label: "On exhibit",
        num: true,
        render: (r) =>
          r.marked ? `<span class="mark">marked</span>` : `<span class="hint">unmarked</span>`,
      },
      {
        key: "cited_title",
        label: "Cites (PI work)",
        render: (r) => `<span class="hint">${esc(shorten(r.cited_title, 46))}</span>`,
      },
      {
        key: "exhibit_page",
        label: "Pg · Row",
        num: true,
        render: (r) =>
          r.exhibit_pdf
            ? ext(r.exhibit_pdf, `${r.exhibit_page} · ${r.exhibit_row}`, "Open the exhibit page")
            : `${r.exhibit_page} · ${r.exhibit_row}`,
      },
    ];
    const drawCopies = () => {
      const query = (el("copy-search")?.value || "").trim().toLowerCase();
      const out = copies.filter(
        (r) =>
          !query ||
          String(r.title).toLowerCase().includes(query) ||
          String(r.byline).toLowerCase().includes(query) ||
          String(r.cited_title).toLowerCase().includes(query) ||
          String(r.stands_for_row_uid).toLowerCase().includes(query) ||
          String(r.row_uid).toLowerCase().includes(query)
      );
      table("copy-table", copyCols, out, {
        caption:
          `${fmt(out.length)} of ${fmt(copies.length)} second listings. Each is ` +
          `one citing work Google Scholar shows twice; the packet counts it once, ` +
          `under the row_uid in "Counted once as".`,
        sortable: true,
      });
    };
    drawCopies();
    enableSort("copy-table", copyCols, copies, drawCopies);
    el("copy-search")?.addEventListener("input", drawCopies);
  }

  function renderOpenItems(D, g) {
    if (!el("open-table")) return;
    const openRows = D.open_items.map((o) => ({
      status: o.status,
      reason: o.reason || "(no reason recorded)",
      count: o.count,
    }));
    table(
      "open-table",
      [
        { key: "status", label: "Classification of the row" },
        { key: "reason", label: "Note recorded when the page was captured" },
        { key: "count", label: "Records", num: true, render: (r) => fmt(r.count) },
      ],
      openRows,
      {
        caption:
          `Capture-time notes, grouped. A note is what the capture observed about ` +
          `a row's author list at the time, not a request: the row's own ` +
          `classification is the first column, and ` +
          `${fmt(g.review_queue ?? g.awaiting_review)} rows are open on this ` +
          `snapshot. A row classified REVIEW here is one whose verdict came from ` +
          `the copy standing for its work, or which the language screen holds — ` +
          `both are listed above, and neither is on the open list.`,
      }
    );
  }

  // =====================================================================
  // per-publication.html
  // =====================================================================
  function renderPerPublication(D) {
    const captured = D.articles.filter((a) => a.status === "captured");
    const top = captured[0];
    const medianInd = d3.median(captured, (a) => a.independent) || 0;
    el(
      "perwork-lede"
    ).innerHTML =
      `Citations are not spread evenly. ${esc(top.title)} alone accounts for ` +
      `${fmt(top.independent)} independent citations, against a median of ` +
      `${fmt(medianInd)} across the ${captured.length} captured publications. ` +
      `Bars are the records on that publication's exhibit pages, split by decision.`;

    drawLollipop(D);
    drawConcentration(D);
  }

  // =====================================================================
  // timeline.html
  // =====================================================================
  function renderTimeline(D) {
    const peak = D.years.slice().sort((a, b) => b.independent - a.independent)[0];
    el(
      "time-lede"
    ).innerHTML =
      `The citing work itself is recent: the busiest year is ` +
      `<b>${peak ? peak.year : "—"}</b> with ${peak ? fmt(peak.independent) : "0"} ` +
      `independent citations. This is the year of the <i>citing</i> paper, not of the ` +
      `paper being cited, so the shape shows ongoing use of the work rather than when ` +
      `it was published.`;

    drawYears(D);
  }

  // =====================================================================
  // patents.html
  // =====================================================================
  function renderPatents(D) {
    const pats = D.patents;
    const countedPats = pats.filter((p) => p.counted);
    const granted = pats.filter((p) => p.granted);
    const families = new Set(
      pats.map((p) => `${p.title.toLowerCase().trim()}|${firstApplicant(p.applicants)}`)
    ).size;

    el(
      "patents-lede"
    ).innerHTML =
      `${pats.length} patent documents — ${granted.length} granted and ` +
      `${pats.length - granted.length} published applications — cite the work on a ` +
      `filed exhibit page. ${countedPats.length} of them are independent by the same ` +
      `author test used everywhere else on this page and are highlighted in the ` +
      `exhibits. A patent is classified as a patent only from its venue or link ` +
      `(Google Patents, USPTO, Espacenet) — never from its title, so a journal article ` +
      `<i>about</i> patents is not misfiled as one.`;

    statBand(el("patent-band"), [
      { label: "Patent documents", value: fmt(pats.length) },
      { label: "Granted", value: fmt(granted.length) },
      { label: "Applications", value: fmt(pats.length - granted.length) },
      {
        label: "Independent",
        value: fmt(countedPats.length),
        sub: "highlighted in exhibits",
      },
      {
        label: "Publications cited",
        value: fmt(new Set(pats.map((p) => p.cites_id)).size),
      },
    ]);

    drawPatentPubs(D);

    table(
      "patents-table",
      [
        {
          key: "row_uid",
          label: "row_uid",
          render: (r) => `<span class="uid">${esc(r.row_uid)}</span>`,
        },
        {
          key: "patent_number",
          label: "Publication no.",
          render: (r) =>
            r.link
              ? ext(r.link, esc(r.patent_number), "Open the patent record")
              : esc(r.patent_number),
        },
        {
          key: "kind",
          label: "Status",
          render: (r) =>
            `<span class="tag patent">${r.granted ? "granted" : "application"}</span>`,
        },
        { key: "title", label: "Title" },
        { key: "applicants", label: "Inventors / applicants" },
        { key: "cited_title", label: "Cites (this profile's paper)" },
        { key: "status", label: "Decision", render: (r) => decisionTag(r) },
        {
          key: "counted",
          label: "In exhibit",
          render: (r) => (r.counted ? `<span class="mark">yes</span>` : `<span class="hint">no</span>`),
        },
      ],
      pats.map((p) => ({ ...p, _cls: p.counted ? "" : "unfiled" })),
      { caption: `${pats.length} citing patent documents, independent first.` }
    );
    el("patents-table").querySelector("table").classList.add("fixed-print");

    el(
      "patents-method"
    ).innerHTML =
      `Each row is one Google Scholar result on a citing-articles page whose venue or ` +
      `link identifies it as patent literature. ${families} distinct title/applicant ` +
      `combinations appear. Note how these are counted: where a family shares one ` +
      `title &mdash; an application with its grant, a WO filing with its US national ` +
      `phase &mdash; the distinct-paper figure treats the family as <b>one</b> citing ` +
      `work, while this table and the exhibit still show each published document. So ` +
      `the rows below can exceed the distinct-papers contribution. Spot-check each one ` +
      `before filing: patents are indexed unevenly by PubMed and OpenAlex, so most of ` +
      `them carry the <span class="tag coverage">not indexed</span> state and rest on ` +
      `Scholar's own complete author list.`;
  }

  // =====================================================================
  // verification.html
  // =====================================================================
  function renderVerification(D) {
    const g = D.global;
    el(
      "verify-lede"
    ).innerHTML =
      `Independence is decided from Google Scholar alone — the cited paper's profile ` +
      `page for its authors, and for a citing entry the result's byline plus, where ` +
      `Scholar truncates it, the BibTeX record behind that result's Cite control. ` +
      `Every entry that looks independent is then <b>corroborated</b> against PubMed ` +
      `(NCBI E-utilities) and, failing that, OpenAlex, both of which publish a complete ` +
      `author list. Since 2026-11-02 a complete external list settles a row rather than ` +
      `merely shadowing it: an overlap makes the entry dependent, and a list that shares ` +
      `nobody clears a byline Scholar had truncated. Where neither Scholar nor either ` +
      `database could settle an author list, the entry was left uncounted rather than ` +
      `guessed at and read from the published article by hand. That work is ` +
      `<b>complete</b>: ${fmt(g.review_queue ?? g.awaiting_review)} citations remain ` +
      `undecided on this snapshot. Of the ${fmt(g.independent_countable)} counted ` +
      `independent citations, ${fmt(g.independent_externally_confirmed)} are backed by ` +
      `an external author list, ${fmt(g.independent_user_decided || 0)} were settled by ` +
      `a person reading the published article, and ${fmt(
        g.independent_scholar_list_only
      )} rest on Scholar's own complete list.`;

    drawCorroboration(D);
  }

  // =====================================================================
  // cocitation.html and citation-wheel.html
  // =====================================================================
  function renderCoCitationPage(D) {
    drawCoCitation(D);
  }

  function renderWheelPage(D) {
    drawCitationWheel(D);
  }

  // =====================================================================
  // method — printed at the foot of the contents page
  // =====================================================================
  function renderMethod(D) {
    el("method-body").innerHTML = methodHtml(D);
  }

  Object.assign(window.DASH, {
    renderContents,
    renderOverview,
    renderPartition,
    renderPerPublication,
    renderTimeline,
    renderPatents,
    renderVerification,
    renderCoCitationPage,
    renderWheelPage,
    renderMethod,
  });
})();

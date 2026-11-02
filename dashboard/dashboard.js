/* Akul Mehta — independent citation record dashboard.
 *
 * Reads dashboard/data/citation-data.js (file://) or citation-data.json (http).
 * Every number on the page is computed from that file, which is itself generated
 * from the dated ledger CSV/JSON and the citation catalog. Nothing here hard-codes
 * a figure, so re-running tools/build-dashboard-data.js is the only step needed
 * to refresh the page.
 *
 * Charts are drawn once at load and are not interactive-dependent: everything a
 * reader needs is printed as a label, because a printed PDF has no hover.
 */

(function () {
  "use strict";

  const COLORS = {
    independent: "#fff200",
    independentEdge: "#a89c00",
    dependent: "#9aa4af",
    self_pi: "#3f4750",
    self_former_pi: "#6a7480",
    review: "#e0a24a",
    pending: "#f0d9a8",
    language: "#9b7fc0",
    patent: "#14776b",
    patentApp: "#7fbdb2",
    accent: "#0b5cad",
    ink: "#14181d",
    inkSoft: "#4a5560",
    inkFaint: "#7c8894",
    rule: "#d8dee4",
    ruleSoft: "#eceff2",
  };

  const fmt = d3.format(",");
  const pct1 = (n) => (n === null || n === undefined ? "—" : `${n}%`);
  const esc = (s) =>
    String(s === null || s === undefined ? "" : s).replace(
      /[&<>"]/g,
      (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])
    );

  // Every link that LEAVES this page view goes in a new tab: a third-party site
  // (Scholar, a publisher, PubMed, OpenAlex) or an exhibit PDF. These pages are
  // worked through rather than skimmed, and a navigation away loses the reader's
  // search text, sort order and scroll position -- which is exactly the state you
  // are in when you click an exhibit to spot-check a row. Every outbound link
  // goes through this one helper instead of each call site remembering target and
  // rel, which is how a link would end up missed. rel=noopener because the
  // destination may be another origin. `label` is pre-escaped HTML, matching how
  // the rest of this file composes markup. Links between the dashboard's own
  // chapters stay plain so the browser scrolls and the contents bar works.
  const ext = (href, label, title) =>
    `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer"${
      title ? ` title="${esc(title)}"` : ""
    }>${label}</a>`;

  // ---------- data ----------
  function loadData() {
    if (window.CITATION_DATA) return Promise.resolve(window.CITATION_DATA);
    return fetch("data/citation-data.json").then((r) => {
      if (!r.ok) throw new Error(`data/citation-data.json -> HTTP ${r.status}`);
      return r.json();
    });
  }

  // ---------- tooltip (screen only) ----------
  let tip;
  function initTip() {
    tip = document.createElement("div");
    tip.id = "tooltip";
    document.body.appendChild(tip);
  }
  function showTip(event, html) {
    if (!tip || window.matchMedia("print").matches) return;
    tip.innerHTML = html;
    tip.style.display = "block";
    const pad = 14;
    const w = tip.offsetWidth;
    const h = tip.offsetHeight;
    let x = event.clientX + pad;
    let y = event.clientY + pad;
    if (x + w > window.innerWidth - 8) x = event.clientX - w - pad;
    if (y + h > window.innerHeight - 8) y = event.clientY - h - pad;
    tip.style.left = `${x}px`;
    tip.style.top = `${y}px`;
  }
  function hideTip() {
    if (tip) tip.style.display = "none";
  }

  // ---------- small helpers ----------
  const el = (id) => document.getElementById(id);

  // The record is told across three files. This list is the single source for
  // the contents bar, so a chapter can never be missing from one page's nav,
  // and the chapter numbers stay the same wherever the reader is.
  const PAGES = [
    { id: "record", file: "index.html", label: "The record" },
    { id: "breakdown", file: "index.html", label: "How it breaks down" },
    { id: "per-work", file: "index.html", label: "Per publication" },
    { id: "time", file: "index.html", label: "Over time" },
    { id: "patents", file: "index.html", label: "Patents citing the work" },
    { id: "verification", file: "index.html", label: "Verification" },
    { id: "open", file: "index.html", label: "Not counted" },
    { id: "review", file: "review.html", label: "Review queue" },
    { id: "language", file: "language.html", label: "Non-English (not queued)" },
    { id: "articles", file: "articles.html", label: "Per-article table" },
    { id: "works", file: "works.html", label: "Every citing work" },
    { id: "method", file: "index.html", label: "Sources and method" },
  ];

  function currentFile() {
    const name = location.pathname.split("/").pop();
    return name && name.endsWith(".html") ? name : "index.html";
  }

  // A link to the page you are already on stays a bare fragment so the browser
  // scrolls instead of reloading, and is marked so it reads as "you are here".
  function renderToc() {
    const node = el("toc");
    if (!node) return;
    const inner = node.querySelector(".toc-inner");
    if (!inner) return;
    inner.innerHTML = "";
    const here = currentFile();
    PAGES.forEach((p, i) => {
      const a = document.createElement("a");
      a.href = p.file === here ? `#${p.id}` : `${p.file}#${p.id}`;
      if (p.file === here) a.className = "here";
      a.innerHTML = `<span class="toc-n">${i + 1}</span>${esc(p.label)}`;
      inner.appendChild(a);
    });
  }

  function renderMasthead(D, standfirst) {
    const g = D.global;
    const sf = el("standfirst");
    if (sf) sf.textContent = standfirst;
    const ms = el("masthead-sourcing");
    if (ms) {
      ms.innerHTML =
        `Source: ${ext(g.profile_url, esc(g.profile_url))} · snapshot ${esc(
          g.snapshot_date
        )} · generated ${esc(
          new Date(D.generated_at).toISOString().slice(0, 16).replace("T", " ")
        )} UTC · figures quoted from <code>${esc(D.sources.ledger)}</code>`;
    }
  }

  function renderColophon(D) {
    const c = el("colophon-line");
    if (!c) return;
    const g = D.global;
    c.textContent =
      `Generated ${new Date(D.generated_at).toISOString().slice(0, 10)} from ` +
      `${D.sources.ledger} (Scholar snapshot ${g.snapshot_date}) and ` +
      `${D.sources.catalog}, built ${D.sources.catalog_built_at || "in this session"}.`;
  }

  function statBand(target, items) {
    // The container already carries .figure-band, which is the grid. Plain
    // spans rather than dt/dd, because each cell is a sibling div, not a dl.
    target.innerHTML = "";
    for (const it of items) {
      const div = document.createElement("div");
      div.className = "stat";
      const label = document.createElement("span");
      label.className = "stat-label";
      label.textContent = it.label;
      const value = document.createElement("span");
      value.className = "stat-value";
      value.textContent = it.value;
      div.appendChild(label);
      div.appendChild(value);
      if (it.sub) {
        const sub = document.createElement("span");
        sub.className = "sub";
        sub.textContent = it.sub;
        div.appendChild(sub);
      }
      target.appendChild(div);
    }
  }

  function svgFor(container, width, height, margin) {
    const node = el(container);
    node.innerHTML = "";
    const svg = d3
      .select(node)
      .append("svg")
      .attr("viewBox", `0 0 ${width} ${height}`)
      .attr("width", width)
      .attr("height", height)
      .attr("role", "img");
    return svg
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);
  }

  function legend(target, entries) {
    const node = el(target);
    node.innerHTML = "";
    for (const e of entries) {
      const span = document.createElement("span");
      span.className = "key";
      span.innerHTML =
        `<span class="swatch" style="background:${e.color};` +
        `border-color:${e.edge || "rgba(0,0,0,.25)"}"></span>${esc(e.label)}`;
      node.appendChild(span);
    }
  }

  function table(target, columns, rows, opts = {}) {
    const wrap = el(target);
    wrap.innerHTML = "";
    const t = wrap.appendChild(document.createElement("table"));
    if (opts.caption) {
      t.createCaption().textContent = opts.caption;
    }
    const thead = t.appendChild(document.createElement("thead"));
    const hr = thead.appendChild(document.createElement("tr"));
    for (const c of columns) {
      const th = hr.appendChild(document.createElement("th"));
      th.textContent = c.label;
      if (c.num) th.className = "num";
      if (c.printHide) th.classList.add("hide-print");
      if (opts.sortable) {
        th.classList.add("sortable");
        th.dataset.key = c.key;
      }
    }
    const tbody = t.appendChild(document.createElement("tbody"));
    for (const row of rows) {
      const tr = tbody.appendChild(document.createElement("tr"));
      if (row._cls) tr.className = row._cls;
      if (row._trim) tr.classList.add("print-trim");
      for (const c of columns) {
        const td = tr.appendChild(document.createElement("td"));
        if (c.num) td.className = "num";
        if (c.printHide) td.classList.add("hide-print");
        td.innerHTML = c.render ? c.render(row) : esc(row[c.key]);
      }
    }
    return t;
  }

  function enableSort(target, columns, rows, redraw) {
    const wrap = el(target);
    let key = null;
    let asc = false;
    wrap.addEventListener("click", (ev) => {
      const th = ev.target.closest("th.sortable");
      if (!th) return;
      const k = th.dataset.key;
      if (!k) return;
      asc = key === k ? !asc : false;
      key = k;
      const col = columns.find((c) => c.key === k);
      const val = col && col.sortValue ? col.sortValue : (r) => r[k];
      rows.sort((a, b) => {
        const av = val(a);
        const bv = val(b);
        if (typeof av === "number" && typeof bv === "number") {
          return asc ? av - bv : bv - av;
        }
        const as = String(av ?? "");
        const bs = String(bv ?? "");
        return asc ? as.localeCompare(bs) : bs.localeCompare(as);
      });
      redraw(rows);
      const again = el(target).querySelector(`th[data-key="${k}"]`);
      if (again) {
        const s = document.createElement("span");
        s.className = "dir";
        s.textContent = asc ? " ▲" : " ▼";
        again.appendChild(s);
      }
    });
  }

  // =====================================================================
  // Story page: index.html
  // =====================================================================
  function renderStory(D) {
    const g = D.global;
    const arts = D.articles;
    const captured = arts.filter((a) => a.status === "captured");

    // ---------- masthead ----------
    renderMasthead(
      D,
      `Google Scholar credits ${fmt(g.publications_captured)} of the ` +
        `${g.publications_total} publications on the profile with ${fmt(
          g.citation_records_reviewed
        )} citing records. After checking every author list, ${fmt(
          g.independent_countable
        )} of those records — ${fmt(
          g.independent_unique_papers
        )} distinct papers — share no author with the paper they cite. ` +
        `Each one is highlighted in yellow on an exhibit page, and every figure here ` +
        `traces to the ${g.snapshot_date} snapshot.`
    );

    // =================================================================
    // 1. headline
    // =================================================================
    statBand(el("headline-band"), [
      {
        label: "Citing records",
        value: fmt(g.citation_records_reviewed),
        sub: `${fmt(g.unique_papers_citing)} distinct papers`,
      },
      {
        label: "Independent",
        value: fmt(g.independent_countable),
        sub: `${fmt(g.independent_unique_papers)} distinct papers`,
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

    el("record-note").innerHTML = esc(g.note);

    // history of the Scholar cited-by total
    drawHistory(D);

    // =================================================================
    // 2. breakdown
    // =================================================================
    el(
      "breakdown-lede"
    ).innerHTML =
      `Every row on every exhibit page falls into exactly one of these buckets, ` +
      `and the squares below add up to the ${fmt(g.citation_records_reviewed)} rows ` +
      `on the pages. ` +
      `<b>Independent</b> means the citing work shares no author with the paper it ` +
      `cites, and lists neither the PI (Richard D. Cummings) nor the former PI ` +
      `(Umesh R. Desai). It is the only thing an exhibit PDF marks. <b>Awaiting ` +
      `review</b> and <b>unsettled</b> rows are left unmarked and are excluded from ` +
      `the counted total, so the share quoted for the packet is never padded. The ` +
      `language screen sits inside <b>unsettled</b> rather than beside it, so no row ` +
      `is counted twice.`;

    drawWaffle(D);
    drawSplit(D);

    // =================================================================
    // 3. per publication
    // =================================================================
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

    // =================================================================
    // 4. time
    // =================================================================
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

    // =================================================================
    // 5. patents
    // =================================================================
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
        {
          key: "status",
          label: "Decision",
          render: (r) => decisionTag(r),
        },
        {
          key: "counted",
          label: "In exhibit",
          render: (r) =>
            r.counted
              ? `<span class="mark">yes</span>`
              : `<span class="hint">no</span>`,
        },
      ],
      pats.map((p) => ({ ...p, _cls: p.counted ? "" : "unfiled" })),
      { caption: `${pats.length} citing patent documents, independent first.` }
    );

    el(
      "patents-method"
    ).innerHTML =
      `Each row is one Google Scholar result on a citing-articles page whose venue or ` +
      `link identifies it as patent literature. ${families} distinct title/applicant ` +
      `combinations appear, so a family such as the Factor XI antibody documents counts ` +
      `once per published document, which is how Scholar presents them. Spot-check each ` +
      `one before filing: patents are indexed unevenly by PubMed and OpenAlex, so most ` +
      `of them carry the <span class="tag coverage">not indexed</span> state and rest on ` +
      `Scholar's own complete author list.`;

    // =================================================================
    // 6. verification
    // =================================================================
    el(
      "verify-lede"
    ).innerHTML =
      `Independence is decided from Google Scholar alone — the cited paper's profile ` +
      `page for its authors, and for a citing entry the result's byline plus, where ` +
      `Scholar truncates it, the BibTeX record behind that result's Cite control. ` +
      `Every entry that looks independent is then <b>corroborated</b> against PubMed ` +
      `(NCBI E-utilities) and, failing that, OpenAlex, both of which publish a complete ` +
      `author list. An external record can confirm an entry or pull it back to review; ` +
      `it never promotes one.`;

    drawCorroboration(D);

    // =================================================================
    // 7. not counted
    // =================================================================
    el(
      "open-lede"
    ).innerHTML =
      `A citation that cannot be settled is not counted, and is not marked. ` +
      `${fmt(g.awaiting_review)} records await a settled author list and ` +
      `${fmt(g.independent_pending)} look independent but no source has confirmed them. ` +
      `${fmt(g.flagged_non_english)} are flagged non-English, of which ` +
      `${fmt(g.non_english_withheld)} would otherwise have counted; those ` +
      `${fmt(g.non_english_withheld)} are inside the ${fmt(g.independent_pending)} ` +
      `unsettled figure, not additional to it. Per the guide a ` +
      `non-English citation needs a certified human translation and affidavit, which the ` +
      `project has decided not to obtain, so those entries stay unhighlighted and the ` +
      `packet reports the adjusted English-only total instead. The rows a person can ` +
      `still decide are on <a href="review.html">the review queue</a>; the language rows ` +
      `are <a href="language.html">kept apart</a> and are not offered for decision.`;

    // "Unsettled" and "held for language" overlap, and the overlap is all of it
    // on this snapshot. Saying the residual out loud stops the 47 reading as 47
    // decisions still outstanding. A bare "0 apart from language" reads as a
    // glitch, so the wording states the conclusion when the residual is zero.
    const unsettledApart = (D.unsettled_rows || []).length;
    statBand(el("open-band"), [
      { label: "Awaiting review", value: fmt(g.awaiting_review), sub: "on the review queue" },
      {
        label: "Independent, unsettled",
        value: fmt(g.independent_pending),
        sub: unsettledApart
          ? `${fmt(unsettledApart)} not language-related`
          : "all of it language",
      },
      { label: "Flagged non-English", value: fmt(g.flagged_non_english) },
      {
        label: "Withheld for language",
        value: fmt(g.non_english_withheld),
        sub: "counted within unsettled",
      },
      { label: "Self (PI)", value: fmt(g.self_pi) },
      { label: "Self (former PI)", value: fmt(g.self_former_pi) },
    ]);

    const openRows = D.open_items.map((o) => ({
      status: o.status,
      reason: o.reason || "(no reason recorded)",
      count: o.count,
    }));
    table(
      "open-table",
      [
        { key: "status", label: "Record status" },
        { key: "reason", label: "Why it needs attention" },
        { key: "count", label: "Records", num: true, render: (r) => fmt(r.count) },
      ],
      openRows,
      { caption: "Attention flags recorded at capture time, grouped." }
    );

  }

  // =====================================================================
  // Per-article statistics page: articles.html
  // =====================================================================
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
      { key: "review", label: "Review", num: true, render: (r) => fmt(r.review) },
      { key: "independent_pending", label: "Unsettled", num: true, render: (r) => fmt(r.independent_pending) },
      { key: "non_english_withheld", label: "Lang.", num: true, render: (r) => fmt(r.non_english_withheld) },
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
    el(
      "works-lede"
    ).innerHTML =
      `${fmt(works.length)} distinct citing papers appear on the exhibit pages, of which ` +
      `${fmt(works.filter((w) => w.marked).length)} are highlighted. The list is ordered ` +
      `by the cited publication's size, then by title — the same order the exhibit pages ` +
      `were reviewed in.`;
    el("works-csv-name").textContent = D.sources.ledger;

    const workCols = [
      { key: "title", label: "Citing work", render: (r) => workTitle(r) },
      { key: "byline", label: "Authors / venue (Scholar byline)", render: (r) => `<span class="hint">${esc(r.byline)}</span>` },
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
          String(w.cited_title).toLowerCase().includes(q)
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
    };
    renderWorks(workRows());
    enableSort("works-table", workCols, works, () => renderWorks(workRows()));
    el("works-search").addEventListener("input", () => renderWorks(workRows()));
    el("works-marked-only").addEventListener("change", () => renderWorks(workRows()));

  }

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
      render: (r) =>
        r.external_url
          ? ext(r.external_url, esc(r.external_source))
          : `<span class="hint">none indexed</span>`,
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
    {
      key: "language_flag",
      label: "Also",
      render: (r) =>
        r.language_flag
          ? `<span class="tag lang">non-English</span>`
          : `<span class="hint">—</span>`,
    },
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
    const actionable = D.review_actionable ?? queue.length;

    // Both of these live in the page's markup as generic text and are filled in
    // here, so a count or a dated filename can never go stale in the HTML.
    const label = el("review-hide-lang-label");
    if (label) {
      const alsoLang = queue.length - actionable;
      label.textContent =
        `Hide the ${fmt(alsoLang)} that ${alsoLang === 1 ? "is" : "are"} also ` +
        `non-English`;
    }
    const sheet = el("review-sheet");
    if (sheet) sheet.textContent = D.sources.review_sheet || "";

    el("review-lede").innerHTML =
      `${fmt(queue.length)} of the ${fmt(g.citation_records_reviewed)} citation rows ` +
      `on the exhibit pages cannot be settled by the rules, so they are counted ` +
      `neither as independent nor as dependent. ${fmt(actionable)} of them can ` +
      `change a figure if you decide them; the other ${fmt(
        queue.length - actionable
      )} are also flagged non-English, and with no translations being obtained a ` +
      `decision on one changes nothing. Every row links to the exhibit PDF page ` +
      `it came from.`;

    statBand(el("review-band"), [
      { label: "Awaiting review", value: fmt(queue.length), sub: "counted neither way" },
      { label: "Contradicted", value: fmt(buckets["1 contradicted"] || 0), sub: "external list overlaps" },
      { label: "External, no overlap", value: fmt(buckets["2 external-no-overlap"] || 0), sub: "likeliest to be independent" },
      { label: "Unresolvable", value: fmt(buckets["3 unresolvable"] || 0), sub: "needs the published article" },
      { label: "Independent, unsettled", value: fmt((D.unsettled_rows || []).length), sub: "excluding language" },
    ]);

    const filter = (rows) => {
      const query = el("review-search").value.trim().toLowerCase();
      const hideLang = el("review-hide-lang").checked;
      return rows.filter((r) => {
        if (hideLang && r.language_flag) return false;
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
      el(meta.why).innerHTML = meta.text;
      table(meta.anchor, queueCols, rows.map((r) => ({ ...r, _cls: r.language_flag ? "held" : "" })), {
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
      el("review-count").textContent =
        `${fmt(shown)} of ${fmt(queue.length)} queued rows shown`;
    };
    redraw();
    for (const meta of Object.values(BUCKET_META)) {
      enableSort(meta.anchor, queueCols, queue, redraw);
    }
    el("review-search").addEventListener("input", redraw);
    el("review-hide-lang").addEventListener("change", redraw);
  }

  // The second list the user asked for: classified independent, not highlighted,
  // and NOT held back by the language screen. On the 2026-11-02 store this is
  // empty, and the empty state says so explicitly rather than showing a blank
  // box that looks like a broken page.
  function drawUnsettled(D) {
    const rows = D.unsettled_rows || [];
    const head = el("unsettled-head");
    const why = el("unsettled-why");
    if (!head || !why) return;
    head.textContent = `Independent but unsettled — ${fmt(rows.length)} row${rows.length === 1 ? "" : "s"}`;
    if (!rows.length) {
      why.innerHTML =
        `None. Every row classified independent and not highlighted is held back ` +
        `by the language screen or is a second-language copy of an article ` +
        `already on the same citing list, so there is nothing author-related left ` +
        `to settle here. The ` +
        `${fmt(D.global.flagged_non_english)} flagged rows are on ` +
        `<a href="language.html">their own page</a>, and are not offered for ` +
        `review. If a future capture produces a row that is genuinely open, it ` +
        `appears in this table &mdash; <code>tools/build-dashboard-data.js</code> ` +
        `fails the build rather than let one go unlisted.`;
      table("table-unsettled", queueCols.map((c) => ({ ...c })), [], {
        caption: "No rows.",
      });
      return;
    }
    why.innerHTML =
      `Classified independent by the author comparison, but not highlighted, and ` +
      `not for a language reason. These need settling.`;
    table("table-unsettled", unsettledCols, rows, {
      caption: `${fmt(rows.length)} independent-but-unhighlighted row(s).`,
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

  // =====================================================================
  // Method section, printed at the foot of the story page
  // =====================================================================
  function renderMethod(D) {
    el("method-body").innerHTML = methodHtml(D);
  }

  // ---------- cell renderers ----------
  function shorten(s, n) {
    const t = String(s || "");
    return t.length > n ? `${t.slice(0, n - 1)}…` : t;
  }
  function firstApplicant(s) {
    return String(s || "").split(",")[0].trim().toLowerCase();
  }
  function decisionTag(r) {
    // `marked` (the citing-work rows) and `counted` (the patent rows) are the
    // same column read by two different queries -- is_countable_independent --
    // so accept either. Reading only `marked` made every counted patent fall
    // through to the label below, which printed "independent, uncounted" on a
    // row the very next column said was in the exhibit.
    if (r.marked || r.counted) return `<span class="mark">IND</span>`;
    // A row classified independent but not counted is held back for one of two
    // reasons and they are not interchangeable: the language screen is holding
    // it (deliberate, closed decision, nothing to resolve), or its author list
    // is genuinely unsettled (an open question). Saying "uncounted" for both
    // invites a review of rows the user has already decided to leave alone.
    if (r.status === "INDEPENDENT" && r.language_flag)
      return `<span class="tag lang">independent · held for language</span>`;
    const map = {
      INDEPENDENT: `<span class="tag review">independent · unsettled</span>`,
      DEPENDENT: `<span class="tag">dependent</span>`,
      REVIEW: `<span class="tag review">review</span>`,
      "SELF (PI)": `<span class="tag">self · PI</span>`,
      "SELF (FORMER PI)": `<span class="tag">self · former PI</span>`,
    };
    return map[r.status] || `<span class="tag">${esc(r.status)}</span>`;
  }
  function corrobTag(r) {
    // A person read the published byline. That is a stronger basis than a
    // machine match, and it is shown separately rather than folded into
    // "confirmed" so a packet figure can say how much rests on a decision.
    if (r.confirm_state === "user-decided")
      return `<span class="tag decided">your decision</span>`;
    if (r.confirm_state === "confirmed")
      return `<span class="tag confirmed">confirmed</span>`;
    if (r.confirm_state === "unverified-coverage")
      return `<span class="tag coverage">not indexed</span>`;
    // A credible external list that shows a shared author settles the row
    // rather than leaving it open, so it is not shown as a contradiction.
    if (r.confirm_state === "external-resolved")
      return `<span class="tag">resolved externally</span>`;
    if (r.confirm_state === "contradicted")
      return `<span class="tag review">contradicted</span>`;
    if (!r.confirm_state) return `<span class="hint">—</span>`;
    return `<span class="tag">${esc(r.confirm_state)}</span>`;
  }
  function workTitle(r) {
    const base = r.link
      ? ext(r.link, esc(r.title), "Open on Google Scholar")
      : esc(r.title);
    const extra = [];
    if (r.work_type === "patent" || r.work_type === "patent-application")
      extra.push(`<span class="tag patent">patent</span>`);
    if (r.language_flag)
      extra.push(`<span class="tag lang">non-English</span>`);
    return base + (extra.length ? ` ${extra.join(" ")}` : "");
  }
  function exhibitRef(r) {
    if (!r.exhibit_base) return "—";
    const page =
      r.exhibit_page && r.exhibit_page > 1 ? `-p${r.exhibit_page}` : "";
    return `<span class="hint">${esc(r.exhibit_base)}${page}</span>`;
  }

  function methodHtml(D) {
    const g = D.global;
    const row = (dt, dd) => `<dt>${esc(dt)}</dt><dd>${dd}</dd>`;
    return `<dl>
      ${row(
        "Primary source",
        `Google Scholar profile ${ext(
          g.profile_url,
          esc(g.profile_url)
        )}, snapshot ${esc(
          g.snapshot_date
        )}. Per the project guide Scholar is the primary basis for every citation figure; third-party databases are never used to decide independence.`
      )}
      ${row(
        "Authoritative figures",
        `Every headline number on this page is copied from <code>${esc(
          D.sources.ledger
        )}</code>, written by <code>tools/build-ledger.js</code>. The detail that file does not carry — patent rows, per-work corroboration, the marked list — comes from <code>${esc(
          D.sources.catalog
        )}</code>, written by <code>tools/build-catalog.js</code>, which re-derives its own totals through <code>tools/tally.js</code> on every build. <code>tools/build-dashboard-data.js</code> refuses to write this page's data if the two disagree on records, independent, distinct papers, or distinct independent.`
      )}
      ${row(
        "What counts as independent",
        `A citing work shares no author with the paper it cites, and lists neither the PI (Richard D. Cummings) nor the former PI (Umesh R. Desai), both of whose papers are self-citations. Authors are matched on surname plus initials, never surname alone, because both surnames are common. A surname collision with no comparable initials becomes <i>review</i>, and is counted neither way.`
      )}
      ${row(
        "Corroboration",
        `PubMed (NCBI E-utilities) first, then OpenAlex. <i>Confirmed</i> means the external author list also shows no overlap. <i>Not indexed</i> means no external record covers the work — typical of theses, preprints and patents — so the entry rests on Scholar's own complete list and is flagged for a spot-check. An external record never promotes an entry; a disagreement pulls it back to review.`
      )}
      ${row(
        "Language",
        `${fmt(g.flagged_non_english)} records are flagged non-English and are never highlighted. The guide's test is whether an entry is <i>listed</i> in English — its title, author list and venue, not its body — so the screen keys on the title, while a non-Latin script elsewhere flags it only where that script is the bulk of the text. A Greek letter is read as scientific notation while it stays a clear minority of the title's letters; a title written in Greek is flagged. Two English rows were recovered on 2026-11-02 when these became share tests rather than absolute counts. No certified translations are being obtained, so the packet reports the adjusted English-only total: ${fmt(
          g.english_independent_records
        )} independent of ${fmt(
          g.english_citation_records
        )} English records, ${pct1(g.english_independent_share_pct)}. The ${fmt(
          g.non_english_withheld
        )} of those that are otherwise settled and would have counted are shown as <i>withheld for language</i>, and are a subset of the ${fmt(
          g.independent_pending
        )} unsettled rows rather than a bucket beside them.`
      )}
      ${row(
        "Duplicate versions",
        `Scholar's profile count includes duplicate versions of the same paper that its own citing list folds together, so a publication's exhibit can show fewer distinct papers than the profile number. Both bases are reported everywhere: ${fmt(
          g.citation_records_reviewed
        )} rows on the exhibit pages, ${fmt(
          g.unique_papers_citing
        )} distinct papers, ${fmt(g.duplicate_records)} extra copies.`
      )}
      ${row(
        "Completeness",
        `${fmt(g.exhibit_pages)} exhibit pages are filed, one per citing-list page of ten records. <code>tools/audit-highlights.js</code> replays the counting rule over the saved HTML of every filed page and compares it with the yellow marks actually printed; it is clean on all ${fmt(
          g.exhibit_pages
        )} pages. <code>tools/check-ledger-vs-snapshot.js</code> sums the per-article rows and confirms they equal the global block.`
      )}
      ${row(
        "Refresh",
        `<code>node tools/build-dashboard-data.js</code> then reload this page. Nothing here is hand-edited, so a stale figure means the data file is stale, not the page.`
      )}
    </dl>`;
  }

  // =====================================================================
  // charts
  // =====================================================================
  function drawHistory(D) {
    const hist = (D.metric_history || []).filter((h) => h.cited_by_all);
    if (hist.length < 2) {
      el("chart-history").innerHTML =
        '<p class="hint">Only one dated snapshot exists, so no trend is shown.</p>';
      el("cap-history").textContent =
        "The cited-by total is recorded once per Scholar snapshot.";
      return;
    }
    const W = 620;
    const H = 200;
    const m = { top: 22, right: 54, bottom: 28, left: 52 };
    const g = svgFor("chart-history", W, H, m);
    const x = d3
      .scalePoint()
      .domain(hist.map((h) => h.snapshot_date))
      .range([0, W - m.left - m.right])
      .padding(0.25);
    const y = d3
      .scaleLinear()
      .domain([d3.min(hist, (h) => h.cited_by_all) - 5, d3.max(hist, (h) => h.cited_by_all) + 5])
      .range([H - m.top - m.bottom, 0])
      .nice();

    g.append("g")
      .attr("class", "grid")
      .call(d3.axisLeft(y).ticks(4).tickSize(-(W - m.left - m.right)).tickFormat(""));
    g.append("g")
      .attr("class", "axis")
      .attr("transform", `translate(0,${H - m.top - m.bottom})`)
      .call(d3.axisBottom(x).tickFormat((d) => d.slice(5)));
    g.append("g")
      .attr("class", "axis")
      .call(d3.axisLeft(y).ticks(4).tickFormat(d3.format(",")));

    g.append("path")
      .datum(hist)
      .attr("fill", "none")
      .attr("stroke", COLORS.accent)
      .attr("stroke-width", 2)
      .attr(
        "d",
        d3
          .line()
          .x((d) => x(d.snapshot_date))
          .y((d) => y(d.cited_by_all))
      );

    const pt = g.selectAll(".pt").data(hist).enter().append("g");
    pt.append("circle")
      .attr("cx", (d) => x(d.snapshot_date))
      .attr("cy", (d) => y(d.cited_by_all))
      .attr("r", 4)
      .attr("fill", "#fff")
      .attr("stroke", COLORS.accent)
      .attr("stroke-width", 2);
    pt.append("text")
      .attr("class", "bar-value")
      .attr("x", (d) => x(d.snapshot_date))
      .attr("y", (d) => y(d.cited_by_all) - 10)
      .attr("text-anchor", "middle")
      .text((d) => fmt(d.cited_by_all));

    el(
      "cap-history"
    ).textContent =
      `Scholar's own "Citations" figure for the whole profile, one point per dated ` +
      `snapshot. ${hist.length} snapshots; the ${
        hist[hist.length - 1].snapshot_date
      } value is the one this page's other figures describe.`;
  }

  function drawWaffle(D) {
    const g = D.global;
    // The withheld-for-language rows are a subset of independent_pending, not a
    // bucket beside it: tools/tally.js defines isIndependentPending as
    // status INDEPENDENT and not isHighlighted, and isHighlighted fails on the
    // language flag. Splitting them out would double-count, so the count is
    // named in the label instead.
    const withheld = Number(g.non_english_withheld) || 0;
    const pendingLabel =
      withheld > 0
        ? `Independent but unsettled (includes ${fmt(withheld)} withheld for language)`
        : "Independent but unsettled";
    const parts = [
      { key: "independent", label: "Independent (highlighted)", value: g.independent_countable, color: COLORS.independent, edge: COLORS.independentEdge },
      { key: "dependent", label: "Dependent (shares an author)", value: g.dependent, color: COLORS.dependent },
      { key: "review", label: "Awaiting review", value: g.awaiting_review, color: COLORS.review },
      { key: "pending", label: pendingLabel, value: g.independent_pending, color: COLORS.pending },
      { key: "self_former_pi", label: "Self, former PI", value: g.self_former_pi, color: COLORS.self_former_pi },
      { key: "self_pi", label: "Self, PI", value: g.self_pi, color: COLORS.self_pi },
    ];
    // Safety net: if the rule ever changes so these buckets no longer cover
    // every record, show the remainder rather than silently shrinking the grid.
    const covered = d3.sum(parts, (p) => p.value);
    const rest = Math.max(0, g.citation_records_reviewed - covered);
    if (rest > 0) {
      parts.push({
        key: "other",
        label: "Other records not classified here",
        value: rest,
        color: COLORS.language,
      });
    }
    const total = covered + rest;

    const side = Math.ceil(Math.sqrt(g.citation_records_reviewed));
    const cell = 11;
    const gap = 1.6;
    const W = side * (cell + gap) + gap;
    const H = side * (cell + gap) + gap;
    const node = el("chart-waffle");
    node.innerHTML = "";
    const svg = d3
      .select(node)
      .append("svg")
      .attr("viewBox", `0 0 ${W} ${H}`)
      .attr("width", W)
      .attr("height", H)
      .attr("role", "img")
      .attr("aria-label", `${fmt(g.citation_records_reviewed)} citing records, one square each`);

    // Build one flat array of bucket keys so squares fill in order.
    const squares = [];
    for (const p of parts) {
      for (let i = 0; i < p.value; i++) squares.push(p);
    }
    svg.selectAll("rect")
      .data(squares)
      .enter()
      .append("rect")
      .attr("x", (d, i) => gap + (i % side) * (cell + gap))
      .attr("y", (d, i) => gap + Math.floor(i / side) * (cell + gap))
      .attr("width", cell)
      .attr("height", cell)
      .attr("fill", (d) => d.color)
      .attr("stroke", (d) => d.edge || "rgba(0,0,0,.18)")
      .attr("stroke-width", (d) => (d.edge ? 1 : 0.5))
      .on("mousemove", (ev, d) =>
        showTip(
          ev,
          `<b>${esc(d.label)}</b><br>${fmt(d.value)} records · ` +
            `${((d.value / g.citation_records_reviewed) * 100).toFixed(1)}% of ` +
            `${fmt(g.citation_records_reviewed)}`
        )
      )
      .on("mouseleave", hideTip);

    legend(
      "legend-waffle",
      parts.map((p) => ({
        label: `${p.label} — ${fmt(p.value)}`,
        color: p.color,
        edge: p.edge,
      }))
    );
    el("waffle-distinct").textContent =
      `${fmt(g.unique_papers_citing)} papers, of which ${fmt(
        g.independent_unique_papers
      )} are independent`;
  }

  function drawSplit(D) {
    const g = D.global;
    const rows = [
      {
        label: "Of records on the exhibit pages",
        part: g.independent_countable,
        whole: g.citation_records_reviewed,
      },
      {
        label: "Of decided records only",
        part: g.independent_countable,
        whole: g.decided_records,
      },
      {
        label: "Of distinct citing papers",
        part: g.independent_unique_papers,
        whole: g.unique_papers_citing,
      },
      {
        label: "English records only (adjusted)",
        part: g.english_independent_records,
        whole: g.english_citation_records,
      },
      {
        label: "English distinct papers",
        part: g.unique_english_independent,
        whole: g.unique_english_papers,
      },
    ];
    const W = 620;
    const rowH = 30;
    const m = { top: 8, right: 92, bottom: 26, left: 214 };
    const H = rows.length * rowH + m.top + m.bottom;
    const gsvg = svgFor("chart-split", W, H, m);
    const iw = W - m.left - m.right;
    const y = d3.scaleBand().domain(rows.map((r) => r.label)).range([0, rows.length * rowH]).padding(0.35);

    gsvg
      .selectAll(".track")
      .data(rows)
      .enter()
      .append("rect")
      .attr("class", "track")
      .attr("x", 0)
      .attr("y", (d) => y(d.label))
      .attr("width", iw)
      .attr("height", y.bandwidth())
      .attr("fill", COLORS.ruleSoft)
      .attr("stroke", COLORS.rule)
      .attr("stroke-width", 0.5);

    gsvg
      .selectAll(".fill")
      .data(rows)
      .enter()
      .append("rect")
      .attr("x", 0)
      .attr("y", (d) => y(d.label))
      .attr("width", (d) => (d.part / d.whole) * iw)
      .attr("height", y.bandwidth())
      .attr("fill", COLORS.independent)
      .attr("stroke", COLORS.independentEdge);

    gsvg
      .selectAll(".lab")
      .data(rows)
      .enter()
      .append("text")
      .attr("class", "row-label")
      .attr("x", -8)
      .attr("y", (d) => y(d.label) + y.bandwidth() / 2)
      .attr("text-anchor", "end")
      .attr("dominant-baseline", "middle")
      .text((d) => d.label);

    gsvg
      .selectAll(".val")
      .data(rows)
      .enter()
      .append("text")
      .attr("class", "bar-value")
      .attr("x", iw + 6)
      .attr("y", (d) => y(d.label) + y.bandwidth() / 2)
      .attr("dominant-baseline", "middle")
      .text((d) => `${((d.part / d.whole) * 100).toFixed(1)}%`);

    gsvg
      .selectAll(".sub")
      .data(rows)
      .enter()
      .append("text")
      .attr("class", "annot")
      .attr("x", 4)
      .attr("y", (d) => y(d.label) + y.bandwidth() / 2)
      .attr("dominant-baseline", "middle")
      .text((d) => `${fmt(d.part)} / ${fmt(d.whole)}`);

    el(
      "cap-split"
    ).textContent =
      `The same evidence on five denominators, because the packet needs to be explicit ` +
      `about which one it is quoting. The ledger publishes all of them; "decided records" ` +
      `excludes anything still open, so that share is the strictest of the group.`;
  }

  function drawLollipop(D) {
    const arts = D.articles
      .filter((a) => a.status === "captured")
      .slice()
      .sort((a, b) => b.independent - a.independent);
    const stacks = [
      ["independent", "Independent", COLORS.independent, COLORS.independentEdge],
      ["dependent", "Dependent", COLORS.dependent],
      ["review", "Awaiting review", COLORS.review],
      ["independent_pending", "Unsettled", COLORS.pending],
      ["self_former_pi", "Self, former PI", COLORS.self_former_pi],
      ["self_pi", "Self, PI", COLORS.self_pi],
    ];
    const W = 620;
    const rowH = 17;
    const m = { top: 22, right: 58, bottom: 26, left: 210 };
    const H = arts.length * rowH + m.top + m.bottom;
    const g = svgFor("chart-lollipop", W, H, m);
    const iw = W - m.left - m.right;
    const maxTotal = d3.max(arts, (a) => a.records) || 1;
    const x = d3.scaleLinear().domain([0, maxTotal]).range([0, iw]);
    const y = d3
      .scaleBand()
      .domain(arts.map((a) => a.title))
      .range([0, arts.length * rowH])
      .padding(0.24);

    g.append("g")
      .attr("class", "grid")
      .call(d3.axisLeft(x).ticks(5).tickSize(-arts.length * rowH).tickFormat(""));
    g.append("g")
      .attr("class", "axis")
      .attr("transform", `translate(0,${arts.length * rowH})`)
      .call(d3.axisBottom(x).ticks(5).tickFormat(d3.format(",")));

    // Segments sit side by side, so each stack starts where the previous one
    // ended. One running offset per row, advanced after every stack.
    const offset = new Map(arts.map((a) => [a.title, 0]));
    for (const [key, label, color, edge] of stacks) {
      g.selectAll(null)
        .data(arts)
        .enter()
        .append("rect")
        .attr("x", (d) => x(offset.get(d.title)))
        .attr("y", (d) => y(d.title))
        .attr("width", (d) => x(d[key] || 0))
        .attr("height", y.bandwidth())
        .attr("fill", color)
        .attr("stroke", edge || "rgba(0,0,0,.15)")
        .attr("stroke-width", edge ? 0.8 : 0.4)
        .on("mousemove", (ev, d) =>
          showTip(
            ev,
            `<b>${esc(shorten(d.title, 70))}</b><br>${esc(label)}: ${fmt(
              d[key] || 0
            )}<br>${fmt(d.records)} records on ${fmt(d.pages_captured)} exhibit page(s)`
          )
        )
        .on("mouseleave", hideTip);
      for (const a of arts) offset.set(a.title, offset.get(a.title) + (a[key] || 0));
    }

    g.selectAll(".t")
      .data(arts)
      .enter()
      .append("text")
      .attr("class", (d) => `row-label${d.independent ? "" : " dim"}`)
      .attr("x", -8)
      .attr("y", (d) => y(d.title) + y.bandwidth() / 2)
      .attr("text-anchor", "end")
      .attr("dominant-baseline", "middle")
      .text((d) => shorten(d.title, 42));

    g.selectAll(".v")
      .data(arts)
      .enter()
      .append("text")
      .attr("class", "bar-value")
      .attr("x", (d) => x(d.records) + 5)
      .attr("y", (d) => y(d.title) + y.bandwidth() / 2)
      .attr("dominant-baseline", "middle")
      .text((d) => fmt(d.independent));

    el(
      "cap-lollipop"
    ).textContent =
      `Right-hand numbers are independent citations; the bar behind them is every record ` +
      `on that publication's exhibit pages, so the unmarked remainder is visible too. ` +
      `Bars are ordered by independent citations, descending.`;
    legend(
      "legend-lollipop",
      stacks.map(([, label, color, edge]) => ({
        label,
        color,
        edge: edge || "rgba(0,0,0,.25)",
      }))
    );
  }

  function drawConcentration(D) {
    const arts = D.articles
      .filter((a) => a.status === "captured" && a.independent > 0)
      .slice()
      .sort((a, b) => b.independent - a.independent);
    const total = d3.sum(arts, (a) => a.independent);
    let run = 0;
    const pts = arts.map((a, i) => {
      run += a.independent;
      return { n: i + 1, cum: run, share: (run / total) * 100, title: a.title };
    });
    const W = 620;
    const H = 230;
    const m = { top: 18, right: 26, bottom: 36, left: 46 };
    const g = svgFor("chart-concentration", W, H, m);
    const x = d3
      .scaleLinear()
      .domain([1, arts.length])
      .range([0, W - m.left - m.right]);
    const y = d3.scaleLinear().domain([0, 100]).range([H - m.top - m.bottom, 0]);

    g.append("g")
      .attr("class", "grid")
      .call(d3.axisLeft(y).ticks(5).tickSize(-(W - m.left - m.right)).tickFormat(""));
    g.append("g")
      .attr("class", "axis")
      .attr("transform", `translate(0,${H - m.top - m.bottom})`)
      .call(d3.axisBottom(x).ticks(6).tickFormat(d3.format("d")));
    g.append("g")
      .attr("class", "axis")
      .call(d3.axisLeft(y).ticks(5).tickFormat((d) => `${d}%`));

    g.append("path")
      .datum(pts)
      .attr("fill", "none")
      .attr("stroke", COLORS.accent)
      .attr("stroke-width", 2)
      .attr("d", d3.line().x((d) => x(d.n)).y((d) => y(d.share)));

    // mark where half the independent citations are reached
    const half = pts.find((p) => p.share >= 50);
    if (half) {
      g.append("line")
        .attr("x1", x(half.n))
        .attr("x2", x(half.n))
        .attr("y1", y(half.share))
        .attr("y2", H - m.top - m.bottom)
        .attr("stroke", COLORS.inkFaint)
        .attr("stroke-dasharray", "3 3");
      g.append("text")
        .attr("class", "annot")
        .attr("x", x(half.n) + 4)
        .attr("y", H - m.top - m.bottom - 4)
        .text(`${half.n} of ${arts.length} publications reach 50%`);
    }

    g.append("text")
      .attr("class", "annot")
      .attr("x", 0)
      .attr("y", -6)
      .text("Cumulative share of independent citations");

    el(
      "cap-concentration"
    ).textContent =
      `Publications ranked by independent citations, plotting what share of the total ` +
      `${fmt(total)} independent citations the top few account for. A steep early rise ` +
      `means a handful of papers carry most of the citations.`;
  }

  function drawYears(D) {
    const years = D.years;
    const W = 620;
    const H = 250;
    const m = { top: 18, right: 20, bottom: 34, left: 46 };
    const g = svgFor("chart-years", W, H, m);
    const x = d3
      .scaleBand()
      .domain(years.map((d) => d.year))
      .range([0, W - m.left - m.right])
      .padding(0.22);
    const y = d3
      .scaleLinear()
      .domain([0, d3.max(years, (d) => d.records) || 1])
      .range([H - m.top - m.bottom, 0])
      .nice();

    g.append("g")
      .attr("class", "grid")
      .call(d3.axisLeft(y).ticks(5).tickSize(-(W - m.left - m.right)).tickFormat(""));
    g.append("g")
      .attr("class", "axis")
      .attr("transform", `translate(0,${H - m.top - m.bottom})`)
      .call(d3.axisBottom(x).tickFormat(d3.format("d")));
    g.append("g")
      .attr("class", "axis")
      .call(d3.axisLeft(y).ticks(5).tickFormat(d3.format(",")));

    g.selectAll(".all")
      .data(years)
      .enter()
      .append("rect")
      .attr("x", (d) => x(d.year))
      .attr("y", (d) => y(d.records))
      .attr("width", x.bandwidth())
      .attr("height", (d) => y(0) - y(d.records))
      .attr("fill", COLORS.ruleSoft)
      .attr("stroke", COLORS.rule)
      .attr("stroke-width", 0.5);

    g.selectAll(".ind")
      .data(years)
      .enter()
      .append("rect")
      .attr("x", (d) => x(d.year))
      .attr("y", (d) => y(d.independent))
      .attr("width", x.bandwidth())
      .attr("height", (d) => y(0) - y(d.independent))
      .attr("fill", COLORS.independent)
      .attr("stroke", COLORS.independentEdge)
      .attr("stroke-width", 0.8)
      .on("mousemove", (ev, d) =>
        showTip(
          ev,
          `<b>${d.year}</b><br>${fmt(d.independent)} independent of ${fmt(
            d.records
          )} records`
        )
      )
      .on("mouseleave", hideTip);

    g.selectAll(".v")
      .data(years)
      .enter()
      .append("text")
      .attr("class", "bar-value")
      .attr("x", (d) => x(d.year) + x.bandwidth() / 2)
      .attr("y", (d) => y(d.records) - 4)
      .attr("text-anchor", "middle")
      .text((d) => fmt(d.independent));

    el("years-undated").textContent = fmt(D.undated.records);
  }

  function drawPatentPubs(D) {
    const byPub = d3
      .groups(D.patents, (p) => p.cited_title)
      .map(([title, rows]) => ({
        title,
        counted: rows.filter((r) => r.counted).length,
        total: rows.length,
        cited_year: rows[0].cited_year,
      }))
      .sort((a, b) => b.total - a.total || b.counted - a.counted);

    const W = 620;
    const rowH = 26;
    const m = { top: 16, right: 74, bottom: 24, left: 210 };
    const H = byPub.length * rowH + m.top + m.bottom;
    const g = svgFor("chart-patent-pubs", W, H, m);
    const iw = W - m.left - m.right;
    const x = d3.scaleLinear().domain([0, d3.max(byPub, (d) => d.total) || 1]).range([0, iw]);
    const y = d3.scaleBand().domain(byPub.map((d) => d.title)).range([0, byPub.length * rowH]).padding(0.32);

    g.append("g")
      .attr("class", "grid")
      .call(d3.axisBottom(x).ticks(4).tickSize(-byPub.length * rowH).tickFormat(""))
      .attr("transform", "translate(0,0)");

    g.selectAll(".all")
      .data(byPub)
      .enter()
      .append("rect")
      .attr("x", 0)
      .attr("y", (d) => y(d.title))
      .attr("width", (d) => x(d.total))
      .attr("height", y.bandwidth())
      .attr("fill", COLORS.patentApp)
      .attr("stroke", COLORS.patent)
      .attr("stroke-width", 0.6);

    g.selectAll(".c")
      .data(byPub)
      .enter()
      .append("rect")
      .attr("x", 0)
      .attr("y", (d) => y(d.title))
      .attr("width", (d) => x(d.counted))
      .attr("height", y.bandwidth())
      .attr("fill", COLORS.independent)
      .attr("stroke", COLORS.independentEdge)
      .attr("stroke-width", 0.8)
      .on("mousemove", (ev, d) =>
        showTip(ev, `<b>${esc(shorten(d.title, 70))}</b><br>${fmt(d.counted)} independent of ${fmt(d.total)} patent documents`)
      )
      .on("mouseleave", hideTip);

    g.selectAll(".t")
      .data(byPub)
      .enter()
      .append("text")
      .attr("class", "row-label")
      .attr("x", -8)
      .attr("y", (d) => y(d.title) + y.bandwidth() / 2)
      .attr("text-anchor", "end")
      .attr("dominant-baseline", "middle")
      .text((d) => shorten(d.title, 44));

    g.selectAll(".v")
      .data(byPub)
      .enter()
      .append("text")
      .attr("class", "bar-value")
      .attr("x", (d) => x(d.total) + 6)
      .attr("y", (d) => y(d.title) + y.bandwidth() / 2)
      .attr("dominant-baseline", "middle")
      .text((d) => `${fmt(d.counted)} / ${fmt(d.total)}`);

    el(
      "cap-patent-pubs"
    ).textContent =
      `Yellow is the portion judged independent; teal is the rest. The full list with ` +
      `patent numbers, inventors and links is the table below.`;
  }

  function drawCorroboration(D) {
    const rows = (D.corroboration_distinct || []).slice().sort((a, b) => b.count - a.count);
    const labelFor = {
      confirmed: "External author list agrees (PubMed or OpenAlex)",
      "unverified-coverage": "No external record covers it — Scholar's own list only",
      unresolved: "Not indexed and Scholar truncated the list",
      "external-resolved": "External list settles it — shared author or PI",
      "user-decided": "Settled by you — read from the published article",
      contradicted: "External list disagreed — pulled back to review",
      skipped: "Corroboration skipped for this capture",
    };
    const colorFor = {
      confirmed: "#2f7d4f",
      "unverified-coverage": COLORS.independent,
      unresolved: COLORS.review,
      "external-resolved": "#b3452f",
      "user-decided": "#6b4fa0",
      contradicted: "#b3452f",
      skipped: COLORS.dependent,
    };
    const total = d3.sum(rows, (r) => r.count);
    const W = 620;
    const rowH = 30;
    const m = { top: 14, right: 78, bottom: 22, left: 250 };
    const H = rows.length * rowH + m.top + m.bottom;
    const g = svgFor("chart-corroboration", W, H, m);
    const iw = W - m.left - m.right;
    const x = d3.scaleLinear().domain([0, total]).range([0, iw]);
    const y = d3.scaleBand().domain(rows.map((r) => r.confirm_state)).range([0, rows.length * rowH]).padding(0.36);

    g.selectAll(".t")
      .data(rows)
      .enter()
      .append("rect")
      .attr("x", 0)
      .attr("y", (d) => y(d.confirm_state))
      .attr("width", (d) => x(d.count))
      .attr("height", y.bandwidth())
      .attr("fill", (d) => colorFor[d.confirm_state] || COLORS.dependent)
      .attr("stroke", "rgba(0,0,0,.28)")
      .attr("stroke-width", 0.6);

    g.selectAll(".l")
      .data(rows)
      .enter()
      .append("text")
      .attr("class", "row-label")
      .attr("x", -8)
      .attr("y", (d) => y(d.confirm_state) + y.bandwidth() / 2)
      .attr("text-anchor", "end")
      .attr("dominant-baseline", "middle")
      .text((d) => shorten(labelFor[d.confirm_state] || d.confirm_state, 50));

    g.selectAll(".v")
      .data(rows)
      .enter()
      .append("text")
      .attr("class", "bar-value")
      .attr("x", (d) => x(d.count) + 6)
      .attr("y", (d) => y(d.confirm_state) + y.bandwidth() / 2)
      .attr("dominant-baseline", "middle")
      .text((d) => `${fmt(d.count)} · ${((d.count / total) * 100).toFixed(0)}%`);

    el(
      "cap-corroboration"
    ).textContent =
      `Distinct citing papers only (${fmt(
        total
      )}), so a paper Scholar lists twice is counted once. ` +
      `"No external record covers it" is expected for theses, preprints and patents: those ` +
      `are highlighted on the strength of Scholar's own complete author list and flagged for ` +
      `a manual spot-check, which is the honest state of that evidence.`;
  }

  // =====================================================================
  // =====================================================================
  // Boot. One script serves all three pages so a figure, a colour or a rule
  // can never read differently on the story page than it does on a table page.
  // =====================================================================
  const PAGE_RENDERERS = {
    "index.html": (D) => {
      renderStory(D);
      renderMethod(D);
    },
    "articles.html": (D) => {
      const g = D.global;
      renderMasthead(
        D,
        `One row per publication on the Google Scholar profile, with the figures ` +
          `the packet quotes. This is the table view of the story: the charts, the ` +
          `patents citing the work, and the sources and method are on the main page. ` +
          `${fmt(g.publications_captured)} of the ${g.publications_total} ` +
          `publications have a filed exhibit; the rest show no citation count.`
      );
      renderArticles(D);
    },
    "works.html": (D) => {
      const works = D.works;
      renderMasthead(
        D,
        `Every distinct citing paper that appears on a filed exhibit page — ` +
          `${fmt(works.length)} in all, of which ${fmt(
            works.filter((w) => w.marked).length
          )} are highlighted as independent. Search, or sort by any column, to ` +
          `find a work and see which exhibit page carries it.`
      );
      renderWorks(D);
    },
    "review.html": (D) => {
      const q = D.review_queue || [];
      const buckets = D.review_buckets || {};
      renderMasthead(
        D,
        `The ${fmt(q.length)} citations the rules cannot settle, grouped by what ` +
          `would settle them: ${fmt(buckets["1 contradicted"] || 0)} an external ` +
          `record contradicts, ${fmt(
            buckets["2 external-no-overlap"] || 0
          )} an external record clears but Scholar truncates, and ${fmt(
            buckets["3 unresolvable"] || 0)
          } nothing indexes. Quote the row_uid. The ` +
          `${fmt(D.global.flagged_non_english)} non-English rows are on their own ` +
          `page and are not offered for review.`
      );
      renderReview(D);
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
      renderLanguage(D);
    },
  };

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
})();

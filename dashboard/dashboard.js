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
    // The fifth bucket: a citing work Scholar lists twice on one page, so the
    // row does not stand for a counted paper. Deliberately a hollow square with a
    // teal edge — it is not a decision about a citation, it is a note about the
    // listing, and it should not read as a fourth shade of grey verdict.
    copy: "#eef6f4",
    copyEdge: "#14776b",
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
  // One decimal, always, so a share reads the same in a bar label as it does in
  // the ledger's percentage columns. A zero denominator yields an em dash rather
  // than NaN%. The charts and the tables both go through this so a share cannot
  // read 77.8% in one place and 78% in another.
  const pctOf = (part, whole) =>
    whole > 0 ? `${((part / whole) * 100).toFixed(1)}%` : "—";
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
    { id: "review", file: "review.html", label: "Open rows, settled" },
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

  // Measure how wide strings render in a given css class. The probe has to be
  // in the document to lay out, so it is parked off to the side rather than
  // display:none, which reports zero. Used where a column width must fit real
  // text — a character-count estimate is wrong enough to clip titles whose
  // words are dense with gene and enzyme names.
  function measureTextWidths(strings, cls) {
    const NS = "http://www.w3.org/2000/svg";
    const svg = document.createElementNS(NS, "svg");
    svg.setAttribute("aria-hidden", "true");
    svg.style.position = "absolute";
    svg.style.left = "-10000px";
    svg.style.top = "0";
    svg.style.width = "1px";
    svg.style.height = "1px";
    svg.style.overflow = "hidden";
    const g = document.createElementNS(NS, "g");
    g.setAttribute("class", cls);
    svg.appendChild(g);
    document.body.appendChild(svg);
    let widest = 0;
    try {
      for (const s of strings) {
        const t = document.createElementNS(NS, "text");
        t.setAttribute("class", cls);
        t.textContent = String(s == null ? "" : s);
        g.appendChild(t);
        const w = typeof t.getComputedTextLength === "function"
          ? t.getComputedTextLength()
          : String(s || "").length * 6;
        if (w > widest) widest = w;
        g.removeChild(t);
      }
    } finally {
      svg.remove();
    }
    return widest;
  }

  // How wide the chart's own container currently is. The other charts draw to a
  // fixed 620 and are fine, but this one has a wide label column, and a fixed
  // width either wastes the right-hand side of the page or squeezes the bars.
  // Measured rather than guessed so the figure also holds up when the window is
  // narrower than the page's max width.
  function containerWidth(id, fallback) {
    const node = el(id);
    const w = node ? node.clientWidth : 0;
    return w > 320 ? Math.floor(w) : fallback;
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

  // The categories a chart draws, in the order a bar stacks. The bucket_* figures
  // come from tools/tally.js through the ledger, so the squares here, the
  // per-publication bars, the ledger CSV and the store's own SQL are four
  // readings of ONE rule rather than four rules.
  //
  // "Awaiting review" is deliberately absent (user instruction of 2026-11-04).
  // The review queue was worked down to nothing on that date, so the bucket held
  // zero rows everywhere, and a category that is always empty asks a reader to
  // hold a definition for a state the record no longer has. The bucket still
  // exists in the data -- tools/tally.js and the ledger still compute it, and the
  // ledger's partition still sums to the record count with it — it is just not a
  // heading on a chart an officer reads. dropAwaitingReview() is the guard that
  // makes that safe rather than a silent omission: it fails loudly if awaiting
  // review ever holds a row again, because at that point the row is real work and
  // the page has to say so instead of dropping it.
  const REVIEW_BUCKET = "bucket_review";
  // `keyOf` reads the bucket key out of a part, because the waffle builds objects
  // and the stacked bars build tuples.
  function dropAwaitingReview(parts, g, keyOf) {
    const held = Number((g && g[REVIEW_BUCKET]) || 0);
    if (held > 0) {
      throw new Error(
        `bucket_review holds ${fmt(held)} record(s), but the charts no longer draw ` +
          `that category (user instruction of 2026-11-04, when the review queue ` +
          `closed). A row awaiting a decision must be visible, not omitted: restore ` +
          `the category in dashboard.js before publishing this data.`
      );
    }
    return parts.filter((p) => keyOf(p) !== REVIEW_BUCKET);
  }

  // Is an "unsettled" row actually open work? The ledger's independent_pending
  // figure counts every English row classified INDEPENDENT yet not highlighted,
  // which is right as a counting rule but can outlive its meaning: a row that is
  // the second listing of a work already counted through another row (a same-work
  // fold recorded by hand) is not awaiting anything, because its standing row
  // carries the verdict. Both rows on this snapshot are of that kind. So the
  // figure is described from the copy listing rather than from the rule's label --
  // an officer must not be told an open question exists where the packet already
  // has an answer. The rule and the number are untouched; this is wording only.
  function unsettledSub(D) {
    const rows = D.unsettled_rows || [];
    if (!rows.length) return "none";
    const copies = new Set((D.preprint_copies || []).map((r) => r.row_uid));
    const asCopies = rows.filter((r) => copies.has(r.row_uid)).length;
    if (asCopies === rows.length) {
      return `all ${fmt(rows.length)} a second listing of a work counted once`;
    }
    if (asCopies) {
      return `${fmt(rows.length - asCopies)} open, ${fmt(asCopies)} a second listing`;
    }
    return `${fmt(rows.length)} English row(s) awaiting corroboration`;
  }

  // Where a value label belongs when it describes ONE segment of a bar rather than
  // the whole bar: just past that segment's end, so the number sits where the
  // colour stops and cannot be read as the bar's total. Two cases are handled
  // rather than one. A label that would hang past the end of the track is printed
  // inside the segment instead, right-aligned against its end, since Chrome clips
  // whatever crosses the sheet edge without warning -- and yellow is dark enough
  // ink on. A segment too short to hold the text keeps the label outside, where it
  // overlaps the following segment rather than disappearing; that case needs a very
  // narrow container, and a clipped number is the worse failure.
  function endLabel(endPx, textW, trackW, gap = 5) {
    if (endPx + textW + gap + 4 <= trackW) {
      return { x: endPx + gap, anchor: "start" };
    }
    if (endPx >= textW + gap * 2) {
      return { x: endPx - gap, anchor: "end" };
    }
    return { x: endPx + gap, anchor: "start" };
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

    // The ledger's own note, quoted verbatim so the page cannot drift from the file
    // it is quoting. It speaks in column names, which the story page itself never
    // prints, so it is introduced as what it is -- a note on how the figures are
    // defined -- rather than left to read as a stray internal comment.
    el("record-note").innerHTML =
      `<b>How these figures are defined.</b> ` + esc(g.note);

    // history of the Scholar cited-by total
    drawHistory(D);

    // =================================================================
    // 2. breakdown
    // =================================================================
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
      `which are broken out in chapter 7. <b>Preprint / copy</b> is a citing work ` +
      `Google Scholar lists twice on one page &mdash; a preprint, repository, author ` +
      `or database copy of a paper already counted &mdash; so the work is credited ` +
      `once, and those ${fmt(g.bucket_preprint_copy)} rows are itemised in chapter 7. ` +
      `<b>Non-English</b> rows are excluded from the counted total, so the share ` +
      `quoted for the packet is never padded; that bucket is its own since 2026-11-03, ` +
      `when the language screen came to supersede a row's independence classification, ` +
      `because no certified translation is being obtained &mdash; those ` +
      `${fmt(g.flagged_non_english)} rows are a closed matter reported once rather ` +
      `than unsettled work. <b>Nothing awaits a decision:</b> the category for rows ` +
      `no rule could settle holds ${fmt(g.bucket_review)} rows on this snapshot, so ` +
      `it is no longer drawn on the charts; chapter 7 records how those rows were ` +
      `settled.`;

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
        // Same handle as every other citing-work listing (2026-11-03). A patent
        // row is a citation like any other and is quoted by its uid when a
        // verdict on it is questioned.
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
    // Same sheet-fit fix as the works and per-article tables. This table was
    // already wider than a Letter page before the uid column went in, so Chrome
    // had been clipping its last column silently; fixed layout divides the sheet
    // instead. Widths live in styles.css next to the other two.
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

    // =================================================================
    // 7. not counted
    // =================================================================
    el(
      "open-lede"
    ).innerHTML =
      `Every citing record falls into exactly one of the categories on the waffle in ` +
      `chapter 2. Two of them are not counted as independent, for reasons that are the ` +
      `opposite of one another.` +
      `<br><br>` +
      `<b>Preprint / copy &mdash; ${fmt(g.bucket_preprint_copy)} rows.</b> Google ` +
      `Scholar lists some papers twice on one citing page: the journal record and a ` +
      `bioRxiv preprint, institutional repository, author upload, thesis or database ` +
      `copy of the same work. The packet counts the work <b>once</b>. Each row here ` +
      `names the row that stands in its place, so the exhibit and the count can be ` +
      `reconciled by hand. A copy also <b>takes the verdict of that standing row</b>: ` +
      `where the published record was settled, the duplicate is reported under the same ` +
      `classification and is not left as an open question, since its own byline cannot ` +
      `change an answer the work already has. Only a copy whose standing row is itself ` +
      `unresolved would stay open. ${fmt((D.preprint_copies || []).filter((r) => r.marked).length)} ` +
      `of them still carry a yellow mark on the exhibit, because the exhibit is a ` +
      `picture of Scholar's page and both rows are printed on it &mdash; that is the ` +
      `gap between ${fmt(g.independent_countable)} marks and ` +
      `${fmt(g.independent_unique_papers)} counted independent works.` +
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
      `provisional. The <a href="review.html">open-rows chapter</a> stays in the packet ` +
      `as the record of how each row was settled &mdash; what was checked, what it ` +
      `turned on, and who decided it &mdash; rather than as a list of work left to do.`;

    // Is an "unsettled" row actually open work? On this snapshot the two rows the
    // pending figure counts are the second listing of a work that is already
    // counted through another row (a same-work fold recorded by hand), so their
    // standing row carries the verdict and neither one is awaiting anything.
    // Saying "awaiting corroboration" over them would tell a reader an open
    // question exists where the packet has an answer, so the figure is described
    // from the copy listing rather than from the counting rule's label. The rule
    // itself is untouched -- this is presentation, and the number still comes from
    // the ledger.
    const copyUids = new Set((D.preprint_copies || []).map((r) => r.row_uid));
    const unsettledApart = (D.unsettled_rows || []).length;
    const unsettledCopies = (D.unsettled_rows || []).filter(
      (r) => copyUids.has(r.row_uid)
    ).length;
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
      // The queue, not the raw REVIEW count: the non-English REVIEW rows sit on
      // the language page, so pointing this at awaiting_review would promise more
      // rows than review.html lists.
      {
        label: "Awaiting a decision",
        value: fmt(g.review_queue ?? g.awaiting_review),
        sub: "queue closed 2026-11-04",
      },
      {
        label: "Independent, not marked",
        value: fmt(g.independent_pending),
        sub:
          unsettledApart === 0
            ? "none"
            : unsettledCopies === unsettledApart
            ? `all ${fmt(unsettledApart)} a second listing of a work counted once`
            : `${fmt(unsettledApart)} English row(s) awaiting corroboration`,
      },
      // The self-citation split, kept visible here per the user's instruction of
      // 2026-11-03: the charts fold these into "not independent", so this is where
      // a reviewer asking "how many are your own, or your former PI's?" is answered.
      {
        label: "Of which self-citations",
        value: fmt(g.self_pi + g.self_former_pi),
        sub: `${fmt(g.self_pi)} current PI · ${fmt(g.self_former_pi)} former PI`,
      },
    ]);

    // The fifth bucket, row by row. A reviewer comparing a two-sheet exhibit to
    // the count needs to see which row stands for the work, not merely that some
    // rows were dropped.
    {
      const copies = (D.preprint_copies || []).slice();
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
          // The classification this copy is reported under. Per the user's
          // instruction of 2026-11-03 a duplicate takes the verdict of the copy
          // that stands for its work, so a REVIEW row here is shown as its
          // parent's INDEPENDENT/DEPENDENT rather than as open queue work. The
          // tag names the parent so the reader can see the verdict is inherited,
          // not concluded from this row's own byline.
          //
          // When nothing was inherited the row's OWN status is shown, not
          // "review": a copy can already be settled on its own reading (a
          // DEPENDENT duplicate, or an INDEPENDENT one covered by a complete
          // Scholar list), and labelling those as open work would be false.
          // A copy with an unsettled parent is the case that really is queued.
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
            r.marked
              ? `<span class="mark">marked</span>`
              : `<span class="hint">unmarked</span>`,
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
      if (el("copy-table")) {
        drawCopies();
        enableSort("copy-table", copyCols, copies, drawCopies);
        el("copy-search")?.addEventListener("input", drawCopies);
      }
    }

    const openRows = D.open_items.map((o) => ({
      status: o.status,
      reason: o.reason || "(no reason recorded)",
      count: o.count,
    }));
    // These notes are written onto a row when its page is captured, and they are
    // never rewritten afterwards -- which is right for an audit trail but reads
    // badly to someone arriving at the end of the project. A row that took its
    // verdict from the copy standing for it, or that the language screen holds,
    // still carries a note saying its author list was incomplete. So the heading
    // says what the table is (a capture-time note, grouped) rather than implying
    // the row still needs something, and the caption points at the figure that
    // actually answers "is anything undecided?".
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
      { key: "review_queue", label: "Review", num: true, render: (r) => fmt(r.review_queue) },
      // Unsettled is English open author work only; the non-English rows are the
      // next column and are no longer counted here (2026-11-03). The heading is
      // "Not marked" rather than "Unsettled" because on this packet every row in
      // the column is a second listing of a work counted once, not an open
      // question -- see the note under the table.
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
      `credits each work once, so this table is longer than the ` +
      `${fmt(D.global.unique_papers_citing)} distinct papers the ledger counts. The ` +
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
             reason, and are reported in chapter&nbsp;6 separately from the machine
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
  // the language screen. On this snapshot the two rows it holds are the second
  // listing of a work already counted through another row, so the heading and the
  // explanation say what they are rather than calling them open work -- see
  // unsettledSub() for why the counting rule's label misleads here.
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
          `<a href="index.html#open">preprint / copy table</a> of chapter 7. The work ` +
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
      return `<span class="tag decided">decided by a person</span>`;
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
  // Which row this one duplicates, in the same words the preprint/copy appendix
  // uses, so a copy reads as a copy wherever it is listed instead of looking
  // like a second citation the packet counted twice. Naming the standing row's
  // uid is the point: a reviewer can jump from one to the other and see that the
  // exhibit marks both while the ledger credits one.
  function copyNote(r) {
    if (!r.is_copy) return "";
    const kind =
      r.duplicate_kind === "same-work"
        ? "same work, different title"
        : r.duplicate_kind === "language-edition"
        ? "language edition"
        : r.duplicate_kind === "patent-family"
        ? "patent family"
        : "second listing of a work above";
    // The uid is emitted as its own span so it picks up the same styling it has
    // in the first column, and the tag text is built from escaped pieces only.
    const stands = r.stands_for_row_uid
      ? ` · counted once through <span class="uid">${esc(r.stands_for_row_uid)}</span>`
      : "";
    return ` <span class="tag coverage">${esc(kind)}</span>${stands}`;
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
        `A citing work shares no author with the paper it cites, and lists neither the PI (Richard D. Cummings) nor the former PI (Umesh R. Desai), both of whose papers are self-citations. Authors are matched on surname plus initials, never surname alone, because both surnames are common. A surname collision with no comparable initials became <i>review</i>, counted neither way until the published article was read.`
      )}
      ${row(
        "Corroboration",
        `PubMed (NCBI E-utilities) first, then OpenAlex; Scholar stays the primary
        source and a third-party database is never believed unless its title matches
        the Scholar entry closely enough to be the same work. <i>Confirmed</i> means
        the external author list also shows no overlap. <i>Not indexed</i> means no
        external record covers the work &mdash; typical of theses, preprints and
        patents &mdash; so the entry rests on Scholar&rsquo;s own complete list and is
        flagged for a spot-check. Since 2026-11-02 a complete external list
        <i>settles</i> a row rather than merely shadowing it: where it shares an
        author with the cited paper, or names either PI, the row is dependent
        (<i>resolved externally</i>); where it shares nobody, it clears a byline
        Scholar had truncated. A row that no source could settle went to the review
        chapter rather than being guessed at, and a decision there is recorded as
        <i>decided by a person</i> — reported separately from the machine readings, so a
        reader can see how much of the total rests on a person reading the published
        byline. That queue closed on 2026-11-04: ${fmt(
          g.review_queue ?? g.awaiting_review
        )} rows remain undecided.`
      )}
      ${row(
        "Language",
        `${fmt(g.flagged_non_english)} records are flagged non-English and are never highlighted. The guide's test is whether an entry is <i>listed</i> in English — its title, author list and venue, not its body — so the screen keys on the title, while a non-Latin script elsewhere flags it only where that script is the bulk of the text. A Greek letter is read as scientific notation while it stays a clear minority of the title's letters; a title written in Greek is flagged. Two English rows were recovered on 2026-11-02 when these became share tests rather than absolute counts. Per the user's instruction on 2026-11-03 the language screen <i>supersedes</i> a row's other classifications: ${fmt(
          g.non_english_independent
        )} of these also carry an independent classification, and they are reported as non-English rather than as unsettled work, because no certified translation is being obtained so nothing a person could read changes the outcome. No certified translations are being obtained, so the packet reports the adjusted English-only total: ${fmt(
          g.english_independent_records
        )} independent of ${fmt(
          g.english_citation_records
        )} English records, ${pct1(g.english_independent_share_pct)}. The ${fmt(
          g.non_english_withheld
        )} that are otherwise settled and would have counted are listed as <i>withheld for language</i>, which is what the packet gives up by not filing translations.`
      )}
      ${row(
        "The categories",
        `Every citing record on an exhibit page is placed in exactly one category,
        defined once in <code>tools/tally.js</code> and read from there by the charts,
        the ledger and the database&rsquo;s own reconciliation checks:
        <b>independent</b> ${fmt(g.bucket_independent)}, <b>not independent</b>
        ${fmt(g.bucket_dependent)}, <b>non-English</b> ${fmt(g.bucket_non_english)},
        and <b>preprint / copy</b> ${fmt(g.bucket_preprint_copy)} &mdash; which sum to
        the ${fmt(g.citation_records_reviewed)} records. A fifth category, <b>awaiting
        review</b>, holds the rows no rule could settle; it holds
        ${fmt(g.bucket_review)} on this snapshot and so is not drawn on the charts
        (user instruction of 2026-11-04, when the queue closed). It is still computed
        in the ledger and the store, and the figures above still leave room for it, so
        the partition closes on the record count either way. Self-citations are folded
        into <i>not independent</i>, since a paper by the PI or former PI shares an
        author with the paper it cites; the split is ${fmt(
          g.self_pi
        )} by the current PI and ${fmt(g.self_former_pi)} by the former PI.`
      )}
      ${row(
        "Duplicate versions",
        `Google Scholar lists some papers twice on one citing page: the journal
        record and a bioRxiv preprint, institutional repository, author upload,
        thesis, database or language copy of the same work. The packet counts such a
        work <b>once</b>, and the ${fmt(
          g.bucket_preprint_copy
        )} rows that do not stand for theirs are itemised in chapter 7 with the row
        that does. ${fmt(
          g.duplicate_records
        )} extra copies exist in all; the difference is copies that are also
        non-English, reported once under that heading instead. Both bases are
        reported everywhere: ${fmt(
          g.citation_records_reviewed
        )} rows on the exhibit pages against ${fmt(
          g.unique_papers_citing
        )} distinct papers. Where the exhibit shows a yellow mark on a
        <i>preprint / copy</i> row, that is not a second claim &mdash; the exhibit
        reproduces Scholar&rsquo;s page as printed, and the count credits the work
        once. A copy is also reported under the standing row&rsquo;s classification
        rather than as an open question: a row awaiting review that is a copy of a
        settled work leaves the queue, because reading its byline cannot change an
        answer the work already has. Two consequences are stated rather than hidden: a patent family sharing
        one title (an application with its grant, a WO filing with its US national
        phase) is counted once, and a work whose two listings differ in title is not
        merged automatically but only where the identity was demonstrated and
        recorded by hand.`
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
    // The categories drawn here, per the user's instruction of 2026-11-03, came
    // from the ledger's bucket_* figures, which tools/tally.js defines, so the
    // squares here, the per-publication bars, the ledger CSV and the store's own
    // SQL are four readings of ONE rule rather than four rules.
    //
    // What changed from the six buckets drawn before:
    //   - Self (PI) and Self (former PI) fold into "not independent". They were
    //     always dependent in substance -- the citing paper shares an author with
    //     the cited one -- and a reviewer asking "how many are your own?" is
    //     answered in chapter 7 and the method notes, where the split is stated.
    //   - The second copies of works Scholar lists twice became their own bucket.
    //     Before they sat inside "independent", which is why the yellow squares
    //     did not equal the counted independent works with nothing on the page to
    //     explain the gap. Now the gap is a named category.
    //
    // And on 2026-11-04, once the review queue had been worked down to nothing,
    // the user asked for "Awaiting review" to come off the waffle and every other
    // plot. It held 0 rows, so the squares still fill the grid exactly -- the
    // figure dropped is zero, not evidence. dropAwaitingReview() refuses to let
    // this page draw over a queue that has rows in it again.
    //
    // The bucket values sum to the record count by construction, so the squares
    // always fill the grid exactly.
    let parts = [
      { key: "independent", label: "Independent", value: g.bucket_independent, color: COLORS.independent, edge: COLORS.independentEdge },
      { key: "dependent", label: "Not independent (shares an author)", value: g.bucket_dependent, color: COLORS.dependent },
      { key: "review", label: "Awaiting review", value: g.bucket_review, color: COLORS.review },
      { key: "non_english", label: "Non-English (not counted)", value: g.bucket_non_english, color: COLORS.language },
      { key: "preprint_copy", label: "Preprint / copy", value: g.bucket_preprint_copy, color: COLORS.copy, edge: COLORS.copyEdge },
    ];
    parts = dropAwaitingReview(parts, g, (p) => `bucket_${p.key}`);
    // Open author work, English rows awaiting corroboration. Normally empty now;
    // drawn only when there is some, so a zero adds no empty colour to the legend.
    if (g.bucket_pending > 0) {
      parts.splice(2, 0, {
        key: "pending",
        label: "Independent, unsettled",
        value: g.bucket_pending,
        color: COLORS.pending,
      });
    }
    // A row that fell through every bucket. Should be impossible -- bucketOf is
    // exhaustive and tested -- but showing it beats silently shrinking the grid.
    if (g.bucket_other > 0) {
      parts.push({
        key: "other",
        label: "Other records not classified here",
        value: g.bucket_other,
        color: COLORS.inkFaint,
      });
    }
    const covered = d3.sum(parts, (p) => p.value);
    const rest = Math.max(0, g.citation_records_reviewed - covered);
    if (rest > 0) {
      parts.push({
        key: "unclassified",
        label: "Records the ledger does not bucket",
        value: rest,
        color: COLORS.inkFaint,
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

    // The count and its percentage sit where the yellow ends (user instruction of
    // 2026-11-04), so a reader's eye goes from the colour to the number that
    // describes it. The denominator moves to the right margin, muted, which is
    // where a total belongs -- it is the length of the track, not the number the
    // row is quoted by.
    const splitText = (d) => `${fmt(d.part)} · ${pctOf(d.part, d.whole)}`;
    const splitTextW = measureTextWidths(rows.map(splitText), "bar-value");
    const splitPlace = (d) =>
      endLabel((d.part / d.whole) * iw, splitTextW, iw, 6);
    gsvg
      .selectAll(".val")
      .data(rows)
      .enter()
      .append("text")
      .attr("class", "bar-value")
      .attr("x", (d) => splitPlace(d).x)
      .attr("y", (d) => y(d.label) + y.bandwidth() / 2)
      .attr("text-anchor", (d) => splitPlace(d).anchor)
      .attr("dominant-baseline", "middle")
      .text(splitText);

    gsvg
      .selectAll(".sub")
      .data(rows)
      .enter()
      .append("text")
      .attr("class", "annot")
      .attr("x", iw + 8)
      .attr("y", (d) => y(d.label) + y.bandwidth() / 2)
      .attr("dominant-baseline", "middle")
      .text((d) => `of ${fmt(d.whole)}`);

    el(
      "cap-split"
    ).textContent =
      `The same evidence on five denominators, because the packet needs to be explicit ` +
      `about which one it is quoting. Beside each bar is the independent count and the ` +
      `share of that row's own denominator, printed where the yellow ends; the muted ` +
      `figure at the right is the denominator. The ledger publishes all of them; ` +
      `"decided records" excludes anything still open, so that share is the strictest ` +
      `of the group.`;
  }

  // Word-wrap a title into at most `maxLines` lines that each fit inside
  // `maxPx`, measured in the real font rather than counted in characters —
  // these titles are dense with gene and enzyme names, so a character count is
  // wrong by enough to clip. Returns the lines and whether anything was cut.
  // Cut text is folded into the last line with an ellipsis: dropping a tail
  // silently would hide part of a source title, while an ellipsis says plainly
  // that there is more. A single word longer than the column overflows rather
  // than being hyphenated, since inventing a hyphenation would alter the title
  // too. `truncated` is reported rather than detected by looking for the
  // ellipsis, because Scholar's own titles are already truncated at source and
  // can end with one this wrapper never added.
  function wrapToWidth(s, maxPx, maxLines, cls) {
    const t = String(s || "").trim();
    const fits = (str) => measureTextWidths([str], cls) <= maxPx;
    if (fits(t)) return { lines: [t], truncated: false };
    const words = t.split(/\s+/);
    const lines = [];
    let cur = "";
    for (const w of words) {
      const next = cur ? `${cur} ${w}` : w;
      if (cur && !fits(next)) {
        lines.push(cur);
        cur = w;
      } else {
        cur = next;
      }
    }
    if (cur) lines.push(cur);
    if (lines.length <= maxLines) return { lines, truncated: false };
    const kept = lines.slice(0, maxLines - 1);
    let rest = lines.slice(maxLines - 1).join(" ");
    while (rest.length > 1 && !fits(`${rest}…`)) rest = rest.slice(0, -1);
    kept.push(`${rest.trim()}…`);
    return { lines: kept, truncated: true };
  }

  function drawLollipop(D) {
    const arts = D.articles
      .filter((a) => a.status === "captured")
      .slice()
      .sort((a, b) => b.independent - a.independent);
    // The same buckets the waffle draws, read from the same bucket_* figures, so a
    // bar here is the whole publication and its segments add up to its record
    // count. Self-citations are inside "Not independent" and a second copy of a
    // counted work is "Preprint / copy", which is why a bar's yellow segment can be
    // shorter than that publication's independent count: the exhibit still marks
    // both rows, the bar counts the work once.
    //
    // "Awaiting review" is dropped here too (user instruction of 2026-11-04, the
    // same one that took it off the waffle). Because the queue is empty the bar
    // still adds up to the publication's record count exactly -- removing a
    // zero-length segment changes no geometry -- and dropAwaitingReview() throws
    // rather than let a real open row disappear from a bar.
    let stacks = [
      ["bucket_independent", "Independent", COLORS.independent, COLORS.independentEdge],
      ["bucket_dependent", "Not independent", COLORS.dependent],
      ["bucket_review", "Awaiting review", COLORS.review],
      ["bucket_non_english", "Non-English", COLORS.language],
      ["bucket_preprint_copy", "Preprint / copy", COLORS.copy, COLORS.copyEdge],
    ];
    stacks = dropAwaitingReview(stacks, D.global, (s) => s[0]);
    if (d3.sum(arts, (a) => a.bucket_pending) > 0) {
      stacks.splice(2, 0, [
        "bucket_pending",
        "Independent, unsettled",
        COLORS.pending,
      ]);
    }
    if (d3.sum(arts, (a) => a.bucket_other) > 0) {
      stacks.push(["bucket_other", "Not classified", COLORS.inkFaint]);
    }
    // Labels are the full publication title over up to three lines rather than a
    // 42-character fragment, which the user asked for — a truncated title is not
    // enough to tell one paper from the next. Three is the budget; the one title
    // in this packet that will not fit in three (180 characters) is allowed a
    // fourth rather than be cut, since it is source text and every other row
    // stays at three or fewer.
    const MAXLINES = 3;
    const wrapTitle = (t, px) => {
      const first = wrapToWidth(t, px, MAXLINES, "row-label");
      return first.truncated
        ? wrapToWidth(t, px, MAXLINES + 1, "row-label").lines
        : first.lines;
    };
    // Draw at exactly the container width. The page caps its column at 60rem and
    // the other charts fit inside that at a fixed 620, but this one has a wide
    // label column: a fixed width either left the right of the page empty or,
    // when the window is narrow, shrank the whole figure below 100% and made the
    // labels smaller than every other chart's. One to one avoids both.
    const W = containerWidth("chart-lollipop", 620);
    // Wrap against the widest column the layout will allow, then tighten the
    // column to the widest line that actually came out. Wrapping first and
    // shrinking after means every line still fits by construction, and the bars
    // get the space back when the titles are short.
    const maxLabelW = Math.max(150, Math.min(Math.round(W * 0.58), 430));
    const labels = arts.map((a) => wrapTitle(a.title, maxLabelW - 20));
    const labelW = Math.min(
      maxLabelW,
      Math.ceil(measureTextWidths(labels.flat(), "row-label")) + 20
    );
    // A row is as tall as its own label. A uniform height sized for a three-line
    // title would leave most rows empty, since the median title needs two. The
    // bar itself keeps one thickness and sits centred in the row — a bar that
    // grew with its label would read as a second, meaningless quantity.
    const LINE_H = 13;
    const PAD = 10;
    const BAR_H = 15;
    const rowMid = new Map();
    let stack = 0;
    arts.forEach((a, i) => {
      const h = labels[i].length * LINE_H + PAD;
      rowMid.set(a.title, stack + h / 2);
      stack += h;
    });
    const innerH = stack;
    // The right margin has to hold the muted total ("1,498 rows") that now sits at
    // the end of the track instead of the count that used to be there.
    const m = { top: 22, right: 74, bottom: 26, left: labelW };
    const H = innerH + m.top + m.bottom;
    const g = svgFor("chart-lollipop", W, H, m);
    const iw = W - m.left - m.right;
    const maxTotal = d3.max(arts, (a) => a.records) || 1;
    const x = d3.scaleLinear().domain([0, maxTotal]).range([0, iw]);

    g.append("g")
      .attr("class", "grid")
      .call(d3.axisLeft(x).ticks(5).tickSize(-innerH).tickFormat(""));
    g.append("g")
      .attr("class", "axis")
      .attr("transform", `translate(0,${innerH})`)
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
        .attr("y", (d) => rowMid.get(d.title) - BAR_H / 2)
        .attr("width", (d) => x(d[key] || 0))
        .attr("height", BAR_H)
        .attr("fill", color)
        .attr("stroke", edge || "rgba(0,0,0,.15)")
        .attr("stroke-width", edge ? 0.8 : 0.4)
        .on("mousemove", (ev, d) =>
          showTip(
            ev,
            `<b>${esc(d.title)}</b><br>${esc(label)}: ${fmt(
              d[key] || 0
            )}<br>${fmt(d.records)} records on ${fmt(d.pages_captured)} exhibit page(s)`
          )
        )
        .on("mouseleave", hideTip);
      for (const a of arts) offset.set(a.title, offset.get(a.title) + (a[key] || 0));
    }

    const linesByTitle = new Map(arts.map((a, i) => [a.title, labels[i]]));
    g.selectAll(".t")
      .data(arts)
      .enter()
      .append("text")
      .attr("class", (d) => `row-label${d.independent ? "" : " dim"}`)
      .attr("x", -8)
      .attr("y", (d) => rowMid.get(d.title))
      .attr("text-anchor", "end")
      .each(function (d) {
        // One to three lines, centred vertically on the bar. The dy lives on the
        // first tspan rather than the text element, so a one-line title sits on
        // the bar's middle while a taller stack straddles it.
        const lines = linesByTitle.get(d.title) || [d.title];
        const t = d3.select(this);
        t.append("tspan")
          .attr("x", -8)
          .attr("dy", lines.length > 1 ? `${0.32 - (lines.length - 1) * 0.575}em` : "0.32em")
          .text(lines[0]);
        for (let i = 1; i < lines.length; i++) {
          t.append("tspan").attr("x", -8).attr("dy", "1.15em").text(lines[i]);
        }
      });

    // The independent count sits where the yellow segment ends, not at the right
    // edge of the bar (user instruction of 2026-11-04). At the total end the number
    // read as the length of the whole bar, which is that publication's record count,
    // not its independent count -- the one figure a reader is here to take away.
    // The share of the publication's own records is printed with it, so the count
    // cannot be read against the wrong denominator, and the whole bar's length is
    // still on the axis below plus the muted total at the right.
    const indText = (d) =>
      `${fmt(d.bucket_independent)} · ${pctOf(d.bucket_independent, d.records)}`;
    const indLabelW = measureTextWidths(arts.map(indText), "bar-value");
    const indPlace = (d) => endLabel(x(d.bucket_independent || 0), indLabelW, iw);
    g.selectAll(".v")
      .data(arts)
      .enter()
      .append("text")
      .attr("class", "bar-value")
      .attr("x", (d) => indPlace(d).x)
      .attr("y", (d) => rowMid.get(d.title))
      .attr("dominant-baseline", "middle")
      .attr("text-anchor", (d) => indPlace(d).anchor)
      // The COUNTED independent figure, matching the yellow segment. Before the
      // buckets existed this printed d.independent, the rows marked on the page,
      // which sits above the segment by the number of second copies -- a bar
      // whose label disagreed with its own colour.
      .text(indText);

    // The bar's own total, so that dropping it from the number at the yellow's end
    // does not lose the denominator: "190 · 76.6%" then a muted "248 rows".
    g.selectAll(".tot")
      .data(arts)
      .enter()
      .append("text")
      .attr("class", "annot")
      .attr("x", iw + 8)
      .attr("y", (d) => rowMid.get(d.title))
      .attr("dominant-baseline", "middle")
      .text((d) => `${fmt(d.records)} row${d.records === 1 ? "" : "s"}`);

    el(
      "cap-lollipop"
    ).textContent =
      `Each bar is every record on that publication's exhibit pages, split into the same ` +
      `categories as the grid above, so the segments add up to the publication's ` +
      `record count. The number beside each bar is the independent citations counted for ` +
      `that publication, printed where the yellow segment ends, with the share of that ` +
      `publication's own records after the dot; the muted figure at the right is the ` +
      `publication's total records. A publication whose exhibit marks more rows than this ` +
      `number is one where Google Scholar listed a paper twice: both rows are printed and ` +
      `marked, and the work is counted once. Non-English rows sit in their own bucket because the ` +
      `language screen supersedes their classification. Titles wrap over up to three ` +
      `lines and rows are ordered by independent citations, descending.`;
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

    // The count sits at the height the YELLOW bar reaches, not above the pale
    // total bar (user instruction of 2026-11-04): the number describes the
    // independent citations, so it belongs where that colour stops. The share of
    // that year's records follows it, since a bare count over a bar whose total is
    // not named invites the wrong denominator. The two lines stack vertically
    // because a horizontal "162 · 82.2%" would collide with the neighbouring year
    // in a band only ~27px wide.
    const yearBottom = H - m.top - m.bottom;
    g.selectAll(".v")
      .data(years)
      .enter()
      .append("text")
      .attr("class", "bar-value")
      .attr("text-anchor", "middle")
      .each(function (d) {
        const cx = x(d.year) + x.bandwidth() / 2;
        const yInd = y(d.independent);
        // Inside the yellow when it is tall enough to hold both lines; otherwise
        // just above its top edge. Dark ink on yellow, so an in-bar label reads.
        const inside = yearBottom - yInd >= 26;
        const countY = inside ? yInd + 12 : yInd - 5;
        const shareY = inside ? yInd + 23 : yInd - 16;
        const t = d3.select(this);
        t.append("tspan")
          .attr("x", cx)
          .attr("y", countY)
          .text(fmt(d.independent));
        t.append("tspan")
          .attr("class", "annot")
          .attr("x", cx)
          .attr("y", shareY)
          .text(pctOf(d.independent, d.records));
      });

    el("years-undated").textContent = fmt(D.undated.records);
    // Say what was taken out and why, and name it, rather than letting a year
    // simply not appear. See the year block in tools/build-dashboard-data.js.
    const anom = D.year_anomalies || [];
    const anomNode = el("years-anomalies");
    if (anom.length) {
      anomNode.innerHTML =
        `${fmt(anom.length)} record${anom.length === 1 ? "" : "s"} dated earlier than ` +
        `the paper it cites, which cannot be right, so the date is unusable rather ` +
        `than merely absent: ` +
        anom
          .map(
            (a) =>
              `<code>${esc(a.row_uid)}</code> &ldquo;${esc(
                shorten(a.title, 60)
              )}&rdquo; dated ${a.citing_year} against a ${a.cited_year} paper ` +
              `(exhibit <code>${esc(a.exhibit_base)}-p${esc(
                String(a.exhibit_page || 1)
              )}</code>)`
          )
          .join("; ") +
        `. The citation itself is unaffected: it stays on its exhibit and in the ` +
        `totals. Only the date is dropped here.`;
    } else {
      anomNode.textContent = "none";
    }
    legend("legend-years", [
      { label: "All citing records", color: COLORS.ruleSoft, edge: COLORS.rule },
      {
        label: "Of which independent",
        color: COLORS.independent,
        edge: COLORS.independentEdge,
      },
    ]);
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

    // The title column is right-anchored into the left margin, so a title wider
    // than that margin is clipped by the edge of the svg and prints starting
    // mid-letter. Chrome warns about nothing. Measured here rather than guessed:
    // 210 units held five of these titles by up to 7 units too little.
    const W = 620;
    const rowH = 26;
    const labelFor = (d) => shorten(d.title, 44);
    const labelW = measureTextWidths(byPub.map(labelFor), "row-label");
    const m = {
      top: 16,
      right: 96,
      bottom: 24,
      left: Math.min(320, Math.max(210, Math.ceil(labelW) + 14)),
    };
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
      .text(labelFor);

    // Same rule as the other bars (user instruction of 2026-11-04): the number
    // describing the independent portion sits where the yellow ends, with its
    // share, and the total number of documents moves to the right margin.
    const patText = (d) => `${fmt(d.counted)} · ${pctOf(d.counted, d.total)}`;
    const patTextW = measureTextWidths(byPub.map(patText), "bar-value");
    const patPlace = (d) => endLabel(x(d.counted), patTextW, iw, 6);
    g.selectAll(".v")
      .data(byPub)
      .enter()
      .append("text")
      .attr("class", "bar-value")
      .attr("x", (d) => patPlace(d).x)
      .attr("y", (d) => y(d.title) + y.bandwidth() / 2)
      .attr("text-anchor", (d) => patPlace(d).anchor)
      .attr("dominant-baseline", "middle")
      .text(patText);

    g.selectAll(".tot")
      .data(byPub)
      .enter()
      .append("text")
      .attr("class", "annot")
      .attr("x", iw + 8)
      .attr("y", (d) => y(d.title) + y.bandwidth() / 2)
      .attr("dominant-baseline", "middle")
      .text((d) => `${fmt(d.total)} document${d.total === 1 ? "" : "s"}`);

    el(
      "cap-patent-pubs"
    ).textContent =
      `Yellow is the portion judged independent; teal is the rest. The number beside ` +
      `each bar is that independent count with its share of the publication's patent ` +
      `documents, printed where the yellow ends; the muted figure at the right is the ` +
      `number of documents. The full list with patent numbers, inventors and links is ` +
      `the table below.`;
  }

  function drawCorroboration(D) {
    const rows = (D.corroboration_distinct || []).slice().sort((a, b) => b.count - a.count);
    const labelFor = {
      confirmed: "External author list agrees (PubMed or OpenAlex)",
      "unverified-coverage": "No external record covers it — Scholar's own list only",
      unresolved: "Not indexed and Scholar truncated the list",
      "external-resolved": "External list settles it — shared author or PI",
      "user-decided": "Settled by a person — read the published article",
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
    // The category names are right-anchored into the left margin, so a name
    // longer than that margin gets clipped by the edge of the svg -- and the
    // shorten() ellipsis was hiding the fact, printing "Scholar's own list…"
    // where the caption below quotes the full phrase. Measured across every
    // label the map can produce, not just the ones present today, so a category
    // reappearing later cannot clip.
    const W = 620;
    const rowH = 30;
    const labelW = measureTextWidths(Object.values(labelFor), "row-label");
    if (labelW + 14 > 340) {
      throw new Error(
        `The corroboration chart's category labels need ${Math.ceil(labelW)} units ` +
          `of left margin, more than the 340 this layout allows. Shorten a label in ` +
          `labelFor above rather than letting the svg clip it -- a clipped label ` +
          `prints mid-word and nothing downstream notices.`
      );
    }
    const m = {
      top: 14,
      right: 78,
      bottom: 22,
      left: Math.max(250, Math.ceil(labelW) + 14),
    };
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
      .text((d) => labelFor[d.confirm_state] || d.confirm_state);

    g.selectAll(".v")
      .data(rows)
      .enter()
      .append("text")
      .attr("class", "bar-value")
      .attr("x", (d) => x(d.count) + 6)
      .attr("y", (d) => y(d.confirm_state) + y.bandwidth() / 2)
      .attr("dominant-baseline", "middle")
      .text((d) => `${fmt(d.count)} · ${pctOf(d.count, total)}`);

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
        `Every citing row that appears on a filed exhibit page — ` +
          `${fmt(works.length)} in all, of which ${fmt(
            works.filter((w) => w.marked).length
          )} are highlighted as independent. Some rows are a second listing of the ` +
          `same work — a preprint, a repository copy, another patent in a family, or ` +
          `a translation — and each is shown next to the row the packet credits it ` +
          `through. Search by <code>row_uid</code>, or sort by any column, to find a ` +
          `row and see which exhibit page carries it.`
      );
      renderWorks(D);
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

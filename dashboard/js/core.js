/* Part of the dashboard, split from the single dashboard.js on 2026-11-04 so
 * each figure can live on its own printable page. Load order matters and is set
 * by the script tags in each HTML file: core, charts, networks, pages, tables,
 * review, boot. Plain script tags rather than ES modules because file:// refuses
 * to fetch a module, and the pages are opened by double-clicking them.
 *
 * Every file pulls what it needs out of the shared DASH namespace and publishes
 * its own functions back into it, so a function body here reads exactly as it
 * did in dashboard.js.
 */

(function () {
  "use strict";

  // The shared namespace every module below reads from and publishes into. Created
  // here, in the first file to load, rather than in each module -- and it must be
  // `|| {}` and not a plain assignment, so a reload that runs a module twice does
  // not wipe what an earlier one published.
  window.DASH = window.DASH || {};

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

  // The record is told across thirteen files, one figure or table per page, so
  // each can be printed to PDF on its own sheet count. This list is the single
  // source for the contents bar, so a page can never be missing from another
  // page's nav, and the numbers stay the same wherever the reader is. The number
  // is ALSO hardcoded as <p class="chapter-num"> in each HTML file -- change both
  // together, since nothing at runtime reconciles them.
  const PAGES = [
    { id: "contents", file: "index.html", label: "Contents & method" },
    { id: "overview", file: "overview.html", label: "Overview & partition" },
    { id: "per-work", file: "per-publication.html", label: "Per publication" },
    { id: "time", file: "timeline.html", label: "Over time" },
    { id: "patents", file: "patents.html", label: "Patents citing the work" },
    { id: "verification", file: "verification.html", label: "Verification" },
    { id: "cocitation", file: "cocitation.html", label: "Co-citation network" },
    { id: "wheel", file: "citation-wheel.html", label: "Citation wheel" },
    { id: "review", file: "review.html", label: "Open rows, settled" },
    { id: "language", file: "language.html", label: "Non-English (not queued)" },
    { id: "articles", file: "articles.html", label: "Per-article table" },
    { id: "works", file: "works.html", label: "Every citing work" },
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
        )} rows that do not stand for theirs are itemised under <i>What is not
        counted</i> on the <a href="overview.html#not-counted">overview page</a>
        with the row that does. ${fmt(
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
  Object.assign(window.DASH, {
    COLORS, fmt, pct1, pctOf, esc, ext, el, loadData, initTip, showTip, hideTip,
      PAGES, currentFile, renderToc, renderMasthead, renderColophon, statBand, svgFor,
      measureTextWidths, containerWidth, legend, table, enableSort, REVIEW_BUCKET,
      dropAwaitingReview, unsettledSub, endLabel, shorten, firstApplicant, decisionTag,
      corrobTag, workTitle, copyNote, exhibitRef, methodHtml,
  });
})();

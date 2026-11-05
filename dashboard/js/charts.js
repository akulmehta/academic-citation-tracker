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
    //     answered on overview.html and the method notes, where the split is stated.
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
      `${fmt(g.distinct_citing_papers)} distinct papers, of which ${fmt(
        g.distinct_independent_papers
      )} are independent`;
  }

  function drawSplit(D) {
    const g = D.global;
    const rows = [
      // The first two rows are per-record: every row printed on an exhibit page,
      // including a second listing of a work counted once elsewhere. The third is
      // per-CITATION -- the packet's own basis -- which drops those second listings
      // but keeps a paper cited by two of the PI's works twice, once per work. The
      // fourth collapses that paper to one, which is the only true paper count.
      // The last three apply the English-only screen to each basis in turn.
      //
      // Every label here names its own basis, and no label says "papers" unless
      // the numerator is a distinct-paper figure. The underlying ledger columns are
      // named unique_* while counting citations, so a row labelled "distinct
      // papers" reading 1,077 against a real paper count of 917 is a discrepancy a
      // reviewer should never be left to reconcile.
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
        label: "Counted citations (packet basis)",
        part: g.independent_unique_papers,
        whole: g.unique_papers_citing,
      },
      {
        label: "Distinct papers only",
        part: g.distinct_independent_papers,
        whole: g.distinct_citing_papers,
      },
      {
        label: "English records only (adjusted)",
        part: g.english_independent_records,
        whole: g.english_citation_records,
      },
      {
        label: "English counted citations",
        part: g.unique_english_independent,
        whole: g.unique_english_papers,
      },
      {
        label: "English distinct papers",
        part: g.distinct_independent_papers_english,
        whole: g.distinct_citing_papers_english,
      },
    ];
    const W = 620;
    const rowH = 30;
    // The row labels are right-anchored into the left margin, so a label longer
    // than that margin is clipped by the edge of the svg and prints as a truncated
    // phrase. Measured from the labels actually in `rows`, rather than assumed from
    // whichever set was longest when this was written — the basis labels changed on
    // 2026-11-05 and would have been cut.
    const labelW = measureTextWidths(rows.map((r) => r.label), "row-label");
    const m = { top: 8, right: 92, bottom: 26, left: Math.max(214, labelW + 14) };
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
      `The same evidence on ${rows.length} denominators, because the packet needs to be explicit ` +
      `about which one it is quoting. Beside each bar is the independent count and the ` +
      `share of that row's own denominator, printed where the yellow ends; the muted ` +
      `figure at the right is the denominator. The ledger publishes all of them; ` +
      `"decided records" excludes anything still open, so that share is the strictest ` +
      `of the group.` +
      `<br><br>` +
      `Two of these are easy to confuse and are deliberately named apart. ` +
      `<i>Counted citations</i> is the packet's basis: a paper that cites two of the ` +
      `PI's publications is two citations, credited once against each, and is marked ` +
      `on two exhibit pages. <i>Distinct papers</i> collapses that paper to one. The ` +
      `gap between them is real double-citing, not a duplicate listing, and the ` +
      `packet counts it. What the counted-citation basis does drop is a paper Google ` +
      `Scholar lists twice against the <b>same</b> cited work &mdash; a preprint beside ` +
      `its journal record &mdash; since that is one citation printed twice, not two.`;
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
    // counted work is "Preprint / copy".
    //
    // Since 2026-11-05 the yellow segment equals the publication's independent
    // count exactly: the exhibit marks only the rows that stand for their work, so
    // a second listing is a copy in the bar and unmarked on the page. Before that
    // decision the two differed by the number of second copies, and this comment
    // recorded why.
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
      `publication's total records. The yellow segment and the number beside the bar are ` +
      `now the same figure: since 2026-11-05 an exhibit marks only the rows that stand for ` +
      `their work, so a paper Google Scholar lists twice against the same cited work is ` +
      `printed on the page but marked once. Non-English rows sit in their own bucket because the ` +
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

    // FULL titles (user instruction of 2026-11-04). This chart used to print
    // shorten(title, 44), which turned "Allosteric inhibition of human factor XIa:
    // discovery of monosulfated benzofurans as a class of promising inhibitors"
    // into a fragment no reader could identify -- and seven publications is few
    // enough that the whole title costs nothing but sheet height. Wrapping rather
    // than one long line is what makes it fit: the label column is measured in the
    // real font, the column is then tightened to the widest line that actually came
    // out, and each row is as tall as its own label needs. The same approach the
    // per-publication bars use, for the same reason -- a character count clips
    // titles dense with enzyme and gene names.
    const W = containerWidth("chart-patent-pubs", 620);
    const MAXLINES = 4;
    const wrapTitle = (t, px) => {
      const first = wrapToWidth(t, px, MAXLINES, "row-label");
      return first.truncated
        ? wrapToWidth(t, px, MAXLINES + 2, "row-label").lines
        : first.lines;
    };
    const maxLabelW = Math.max(180, Math.min(Math.round(W * 0.6), 460));
    const labels = byPub.map((d) => wrapTitle(d.title, maxLabelW - 20));
    const labelW = Math.min(
      maxLabelW,
      Math.ceil(measureTextWidths(labels.flat(), "row-label")) + 20
    );
    const LINE_H = 13;
    const PAD = 9;
    const BAR_H = 15;
    const rowMid = new Map();
    let stack = 0;
    byPub.forEach((d, i) => {
      const h = labels[i].length * LINE_H + PAD;
      rowMid.set(d.title, stack + h / 2);
      stack += h;
    });
    const innerH = stack;
    const m = { top: 20, right: 84, bottom: 26, left: labelW };
    const H = innerH + m.top + m.bottom;
    const g = svgFor("chart-patent-pubs", W, H, m);
    const iw = W - m.left - m.right;
    const x = d3.scaleLinear().domain([0, d3.max(byPub, (d) => d.total) || 1]).range([0, iw]);

    g.append("g")
      .attr("class", "grid")
      .call(d3.axisBottom(x).ticks(4).tickSize(-innerH).tickFormat(""))
      .attr("transform", "translate(0,0)");
    g.append("g")
      .attr("class", "axis")
      .attr("transform", `translate(0,${innerH})`)
      .call(d3.axisBottom(x).ticks(4).tickFormat(d3.format("d")));

    g.selectAll(".all")
      .data(byPub)
      .enter()
      .append("rect")
      .attr("x", 0)
      .attr("y", (d) => rowMid.get(d.title) - BAR_H / 2)
      .attr("width", (d) => x(d.total))
      .attr("height", BAR_H)
      .attr("fill", COLORS.patentApp)
      .attr("stroke", COLORS.patent)
      .attr("stroke-width", 0.6);

    g.selectAll(".c")
      .data(byPub)
      .enter()
      .append("rect")
      .attr("x", 0)
      .attr("y", (d) => rowMid.get(d.title) - BAR_H / 2)
      .attr("width", (d) => x(d.counted))
      .attr("height", BAR_H)
      .attr("fill", COLORS.independent)
      .attr("stroke", COLORS.independentEdge)
      .attr("stroke-width", 0.8)
      .on("mousemove", (ev, d) =>
        showTip(ev, `<b>${esc(d.title)}</b><br>${fmt(d.counted)} independent of ${fmt(d.total)} patent documents`)
      )
      .on("mouseleave", hideTip);

    const linesByTitle = new Map(byPub.map((d, i) => [d.title, labels[i]]));
    g.selectAll(".t")
      .data(byPub)
      .enter()
      .append("text")
      .attr("class", "row-label")
      .attr("x", -8)
      .attr("y", (d) => rowMid.get(d.title))
      .attr("text-anchor", "end")
      .each(function (d) {
        // One to four lines, centred vertically on the bar. The dy lives on the
        // first tspan so a one-line title sits on the bar's middle while a taller
        // stack straddles it.
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
      .attr("y", (d) => rowMid.get(d.title))
      .attr("text-anchor", (d) => patPlace(d).anchor)
      .attr("dominant-baseline", "middle")
      .text(patText);

    g.selectAll(".tot")
      .data(byPub)
      .enter()
      .append("text")
      .attr("class", "annot")
      .attr("x", iw + 8)
      .attr("y", (d) => rowMid.get(d.title))
      .attr("dominant-baseline", "middle")
      .text((d) => `${fmt(d.total)} doc${d.total === 1 ? "" : "s"}`);

    el(
      "cap-patent-pubs"
    ).textContent =
      `Yellow is the portion judged independent; teal is the rest. The number beside ` +
      `each bar is that independent count with its share of the publication's patent ` +
      `documents, printed where the yellow ends; the muted figure at the right is the ` +
      `number of documents, and the axis below is the total count. Titles are printed ` +
      `in full and wrap over up to four lines. The list with patent numbers, inventors ` +
      `and links is the table below.`;
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
      `Counted citations only (${fmt(total)}), so a paper Scholar lists twice against ` +
      `the same cited work appears once here. A work cited by two of the PI's ` +
      `publications does appear twice, once per citation, since each was checked ` +
      `against the paper it cites. ` +
      `"No external record covers it" is expected for theses, preprints and patents: those ` +
      `are highlighted on the strength of Scholar's own complete author list and flagged for ` +
      `a manual spot-check, which is the honest state of that evidence.`;
  }
  Object.assign(window.DASH, {
    drawHistory, drawWaffle, drawSplit, wrapToWidth, drawLollipop,
      drawConcentration, drawYears, drawPatentPubs, drawCorroboration,
  });
})();

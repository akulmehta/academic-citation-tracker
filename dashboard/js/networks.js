/* The two network figures.
 *
 *   drawCoCitation  — the PI's publications as nodes, an edge where one
 *                     independent citing work cites both. A force layout.
 *   drawCitationWheel — the publications as a hub and every independent citing
 *                     work as a dot on the rim. Deterministic, because a
 *                     printed figure has to be reproducible.
 *
 * Both read D.graph, which tools/build-dashboard-data.js builds from exactly the
 * counted independent set and guards against the ledger's own bucket figure. A
 * dot here therefore means the same thing as a yellow square in the waffle.
 *
 * WHAT THE COLOURS MEAN
 * --------------------
 * A node's colour is the publication's research programme, from tools/topics.js:
 * red for the anticoagulant work, blue for the glycoscience work, purple where a
 * paper genuinely belongs to both, green for the medicinal-chemistry papers that
 * belong to neither. Within a programme the shade deepens with the earlier
 * publication, so "older" is readable as well as "which family" — the one
 * exception being that shade carries no claim at all across families, where only
 * the hue means anything.
 *
 * WHY THE WHEEL INSTEAD OF A SECOND FORCE GRAPH
 * --------------------------------------------
 * 917 nodes and 1,077 links laid out freely by a force simulation collapse into
 * one grey disc at Letter size: the links, not the nodes, are the bulk, and
 * nothing about the shape survives the print. The wheel gives each publication a
 * sector whose angular width IS its share of the independent citations, so the
 * density a free layout would have had to earn is stated directly, and a citing
 * work that bridges two of the PI's papers is drawn as a coloured chord that
 * cannot be missed.
 *
 * The dots inside those sectors are still positioned by d3-force -- collision
 * only, projected back into the owning wedge after every tick (see spreadDots).
 * A fixed polar grid cannot know how wide a dot is and printed 190 citations of
 * one paper as a single grey rope. Force settles the crowding; the wedge keeps
 * the claim, because a dot never drifts into another publication's sector.
 */
(function () {
  "use strict";

  const {
    COLORS, fmt, esc, ext, el, showTip, hideTip, containerWidth, legend, table,
    shorten,
  } = window.DASH;

  // The family colours live in tools/topics.js and travel in the generated data
  // file, so there is one reviewed list rather than a second copy here. Destructured
  // at draw time, not at load: this module is parsed before the data exists.
  let FAMILY = {};
  function setFamilies(D) {
    FAMILY = (D.topics && D.topics.family) || FAMILY;
    if (!FAMILY.glyco) {
      throw new Error(
        "The topic colours are missing from the data file. Regenerate it with " +
          "node tools/build-dashboard-data.js."
      );
    }
  }

  // Order matters: it drives the numbering, the legend, and the wheel's sectors,
  // and every one of them has to agree.
  const ORDER = ["anti", "glyco", "both", "other", "unknown"];

  // Node numbers are assigned once, identically on both pages, so "node 7" means
  // the same publication wherever a reader meets it. Sorted by programme, then by
  // citation count, then by title so a tie cannot shuffle between builds.
  function numbered(graph) {
    const rank = new Map(ORDER.map((k, i) => [k, i]));
    return graph.nodes
      .slice()
      .sort(
        (a, b) =>
          rank.get(a.topic) - rank.get(b.topic) ||
          b.n - a.n ||
          String(a.title).localeCompare(String(b.title))
      )
      .map((d, i) => Object.assign({}, d, { num: i + 1 }));
  }

  // A family's colour, with the shade carrying the publication year. Interpolating
  // in HSL and only ever LIGHTENING from the family base keeps every fill dark
  // enough for the white node number to hold its contrast — lightening toward
  // white in RGB does not, and a pale node with white text is exactly the failure
  // a printed figure cannot afford.
  function shadeFor(d) {
    if (d.shade) return d.shade;
    const fam = FAMILY[d.topic] || FAMILY.unknown;
    return fam.base;
  }

  // Assign a shade to every node once, against the family's own year range. Done
  // here rather than in the colour helper so the scale is fixed for the whole
  // figure and two nodes of the same year cannot come out different colours
  // depending on draw order.
  function applyShades(nodes) {
    // Driven by the topics on the nodes, not by a list here, so a family added to
    // tools/topics.js is shaded the moment it appears in the data.
    const keys = ORDER.filter((k) => nodes.some((d) => d.topic === k));
    for (const key of keys) {
      const fam = FAMILY[key];
      if (!fam) continue;
      const group = nodes.filter((d) => d.topic === key);
      const years = group.map((d) => d.year).filter((y) => y);
      const lo = years.length ? Math.min(...years) : 0;
      const hi = years.length ? Math.max(...years) : 1;
      group.forEach((d) => {
        // Older work at the deep end. A node with no year is not sorted into the
        // gradient, since inventing a position for an unknown would be a claim.
        const t = d.year && hi > lo ? (hi - d.year) / (hi - lo) : 0.35;
        const base = d3.hsl(fam.base);
        // Lightness only ever between the base and 18% above it: enough to read
        // as a gradient, not enough to wash out the number inside.
        base.l = Math.min(0.52, base.l + (1 - t) * 0.18);
        d.shade = base.formatHex();
        d.shade_edge = fam.edge;
      });
    }
    return nodes;
  }

  function newSvg(id, w, h) {
    const node = el(id);
    node.innerHTML = "";
    return d3
      .select(node)
      .append("svg")
      .attr("viewBox", `0 0 ${w} ${h}`)
      .attr("width", w)
      .attr("height", h)
      .attr("role", "img");
  }

  // =====================================================================
  // Figure 1 — co-citation network
  // =====================================================================
  function drawCoCitation(D) {
    setFamilies(D);
    const G = D.graph;
    const nodes = applyShades(numbered(G));
    const byId = new Map(nodes.map((d) => [d.cites_id, d]));
    const edges = G.edges.map((e) => ({ ...e }));

    const W = containerWidth("chart-cocitation", 700);
    const H = Math.round(W * 0.92);
    const svg = newSvg("chart-cocitation", W, H);
    const g = svg.append("g").attr("transform", `translate(${W / 2},${H / 2})`);

    const r = d3.scaleSqrt().domain([0, d3.max(nodes, (d) => d.n) || 1]).range([0, 34]);
    nodes.forEach((d) => (d.r = Math.max(11, r(d.n))));

    // Family anchors. The two programmes sit opposite one another so the hue and
    // the position say the same thing, the papers that span both sit between them,
    // and the unaffiliated work sits below where it cannot be mistaken for either.
    const k = Math.min(W, H) / 2 - 46;
    const anchors = {
      anti: { x: -k * 0.72, y: -k * 0.06 },
      glyco: { x: k * 0.72, y: -k * 0.06 },
      both: { x: 0, y: -k * 0.5 },
      other: { x: 0, y: k * 0.78 },
      unknown: { x: 0, y: k * 0.35 },
    };
    // Seed positions deterministically. A simulation started from d3's default
    // random phyllotaxis gives a different figure on every reload, which is fine
    // on a screen and not acceptable in a printed exhibit that two people have to
    // compare.
    nodes.forEach((d, i) => {
      const a = anchors[d.topic] || anchors.unknown;
      const th = (i / nodes.length) * 2 * Math.PI;
      d.x = a.x + Math.cos(th) * 40;
      d.y = a.y + Math.sin(th) * 40;
    });

    const maxW = d3.max(edges, (e) => e.weight) || 1;
    const sim = d3
      .forceSimulation(nodes)
      .force(
        "link",
        d3
          .forceLink(edges)
          .id((d) => d.cites_id)
          // Heavily co-cited pairs sit closer, so the strength of the literature's
          // link is a distance rather than only a line thickness.
          .distance((e) => 150 - 70 * (e.weight / maxW))
          .strength((e) => 0.06 + 0.24 * (e.weight / maxW))
      )
      .force("charge", d3.forceManyBody().strength(-140))
      .force("x", d3.forceX((d) => (anchors[d.topic] || anchors.unknown).x).strength(0.11))
      .force("y", d3.forceY((d) => (anchors[d.topic] || anchors.unknown).y).strength(0.11))
      .force("collide", d3.forceCollide((d) => d.r + 3).iterations(3))
      .stop();
    // Run to a settled state synchronously and draw the result once. An animated
    // graph cannot be read off a page, and a reader who prints mid-animation gets
    // whatever half-finished tangle the browser happened to be on.
    for (let i = 0; i < 420; i++) sim.tick();

    g.append("g")
      .selectAll("line")
      .data(edges)
      .enter()
      .append("line")
      .attr("x1", (d) => d.source.x)
      .attr("y1", (d) => d.source.y)
      .attr("x2", (d) => d.target.x)
      .attr("y2", (d) => d.target.y)
      .attr("stroke", (d) =>
        d.source.topic === d.target.topic
          ? shadeFor(d.source)
          : COLORS.inkFaint
      )
      .attr("stroke-opacity", (d) => 0.16 + 0.5 * (d.weight / maxW))
      .attr("stroke-width", (d) => 0.5 + 4.2 * Math.pow(d.weight / maxW, 0.75));

    const node = g.append("g").selectAll("g").data(nodes).enter().append("g");

    node
      .append("circle")
      .attr("cx", (d) => d.x)
      .attr("cy", (d) => d.y)
      .attr("r", (d) => d.r)
      .attr("fill", (d) => shadeFor(d))
      .attr("stroke", (d) => d.shade_edge || (FAMILY[d.topic] || FAMILY.unknown).edge)
      .attr("stroke-width", 1.1)
      .on("mousemove", (ev, d) =>
        showTip(
          ev,
          `<b>${d.num}. ${esc(d.title)}</b><br>${esc(d.venue || "")}` +
            `${d.year ? " · " + d.year : ""}<br>${fmt(d.n)} independent citations` +
            `<br><span class="hint">${esc((FAMILY[d.topic] || FAMILY.unknown).note)}</span>`
        )
      )
      .on("mouseleave", hideTip);

    node
      .append("text")
      .attr("x", (d) => d.x)
      .attr("y", (d) => d.y)
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "central")
      .attr("class", "node-num")
      .attr("font-size", (d) => Math.max(8.5, Math.min(14, d.r * 0.82)))
      .text((d) => d.num);

    // The citation count under each node rather than inside it: the number a
    // reader takes away is how many independent papers cite the work, and it
    // should not compete with the legend number for the same few pixels.
    node
      .append("text")
      .attr("x", (d) => d.x)
      .attr("y", (d) => d.y + d.r + 9)
      .attr("text-anchor", "middle")
      .attr("class", "annot")
      .text((d) => fmt(d.n));

    // Programme labels at each anchor, so the figure reads without the legend.
    // Clamped inside the drawing box: the viewBox clips nothing but the sheet
    // does, and Chrome warns about a label that hangs past the page edge about
    // as loudly as it warns about nothing at all.
    for (const key of ORDER) {
      if (!nodes.some((d) => d.topic === key)) continue;
      const a = anchors[key];
      const dy = key === "other" ? 66 : key === "both" ? -100 : -114;
      const lim = Math.min(W, H) / 2 - 12;
      g.append("text")
        .attr("x", a.x)
        .attr("y", Math.max(-lim, Math.min(lim, a.y + dy)))
        .attr("text-anchor", "middle")
        .attr("class", "cluster-label")
        .attr("fill", FAMILY[key].base)
        .text(FAMILY[key].label);
    }

    el(
      "cap-cocitation"
    ).textContent =
      `An edge joins two publications that the same independent citing work cites, ` +
      `and its thickness is the number of works that cite both — the strongest pair ` +
      `here is cited together ${fmt(edges.length ? edges[0].weight : 0)} times. ` +
      `${fmt(nodes.length)} publications carry at least one counted independent ` +
      `citation; the ${fmt(D.global.publications_captured - nodes.length)} captured ` +
      `publications with none are absent rather than drawn as isolated dots, as are ` +
      `the ${fmt(D.global.publications_total - D.global.publications_captured)} with ` +
      `no citation count on the profile. Node area is the publication's independent ` +
      `count, printed beneath it; colour is its research programme and, within a ` +
      `programme, the shade deepens for the earlier paper. The layout is computed to ` +
      `a settled state before drawing, so this figure is reproducible rather than ` +
      `one sample from a random start.`;

    legend(
      "legend-cocitation",
      ORDER.filter((k) => nodes.some((d) => d.topic === k)).map((k) => ({
        label: `${FAMILY[k].label} — ${nodes.filter((d) => d.topic === k).length}`,
        color: FAMILY[k].base,
        edge: FAMILY[k].edge,
      }))
    );

    renderNodeKey("key-cocitation", nodes, edges);
  }

  // The legend the user asked for: which number is which publication, in full.
  // A key that truncates a title is not a key, so the titles are not shortened
  // here — the column wraps instead. `edges` adds each publication's strongest
  // link, which is the sentence a reader most often wants next to a node.
  function renderNodeKey(target, nodes, edges) {
    const best = new Map();
    for (const e of edges) {
      const a = typeof e.source === "object" ? e.source.cites_id : e.source;
      const b = typeof e.target === "object" ? e.target.cites_id : e.target;
      for (const [self, other] of [[a, b], [b, a]]) {
        const cur = best.get(self);
        if (!cur || e.weight > cur.weight) best.set(self, { other, weight: e.weight });
      }
    }
    const byId = new Map(nodes.map((d) => [d.cites_id, d]));
    table(
      target,
      [
        {
          key: "num",
          label: "No.",
          num: true,
          render: (r) =>
            `<span class="node-badge" style="background:${shadeFor(r)};` +
            `border-color:${r.shade_edge || (FAMILY[r.topic] || FAMILY.unknown).edge}">${r.num}</span>`,
        },
        {
          key: "topic",
          label: "Area",
          render: (r) => `<span class="hint">${esc((FAMILY[r.topic] || FAMILY.unknown).label)}</span>`,
        },
        {
          key: "title",
          label: "Publication",
          render: (r) =>
            r.cites_url
              ? ext(r.cites_url, esc(r.title), "Open this publication's cited-by list on Google Scholar")
              : esc(r.title),
        },
        { key: "year", label: "Year", num: true, render: (r) => r.year || "—" },
        { key: "n", label: "Indep.", num: true, render: (r) => `<span class="mark">${fmt(r.n)}</span>` },
        {
          key: "co",
          label: "Most co-cited with",
          render: (r) => {
            const b = best.get(r.cites_id);
            if (!b) return `<span class="hint">—</span>`;
            const o = byId.get(b.other);
            return `${fmt(b.weight)}× <span class="hint">${esc(shorten(o ? o.title : b.other, 64))}</span>` +
              (o ? ` <span class="uid">node ${o.num}</span>` : "");
          },
        },
      ],
      nodes.slice().sort((a, b) => a.num - b.num),
      {
        caption:
          `${fmt(nodes.length)} publications, numbered as on the figure and grouped by ` +
          `research programme. Every count is a counted independent citation, the same ` +
          `figure the waffle and the ledger report.`,
        sortable: true,
      }
    );
  }

  // =====================================================================
  // Figure 2 — the citation wheel
  // =====================================================================

  // How far apart two dots settle, and how hard the simulation is run.
  const DOT_PAD = 3.7; // collision radius; a dot itself is 2.1, so ~1.6px of air
  const DOT_TICKS = 260;

  // Spread the dots inside their own sector with a d3-force simulation.
  //
  // WHY A FORCE AND NOT A GRID. A rectangular polar grid (angle x ring) is cheap
  // and deterministic but blind to dot size: a busy publication's 190 citations
  // come out as 38 dots per ring, and at the inner edge of the band the arc
  // between two columns is narrower than a dot. Measured on the 2026-11-04 build
  // before this existed: 445 pairs of dots overlapped and the closest pair sat
  // 0.43 px apart, which is what "too cluttered" actually was.
  //
  // WHAT IS CONSTRAINED. Collision resolution is the only thing that moves a
  // dot; after every tick each dot is projected back into the wedge of the
  // publication it cites -- radially into [rin, rout], angularly onto the nearer
  // bounding ray. That projection is what keeps the figure honest: a dot can
  // never drift into a neighbour's sector, so "which sector am I in" still
  // answers "which paper does this cite", which is the only claim the rim makes.
  // A narrow sector therefore fills along its own ray rather than spilling over,
  // and a wide one fills its whole slice.
  //
  // DETERMINISM. d3-force only reaches for Math.random when a node arrives with
  // no x or y, and every dot here arrives with both, seeded from its sector. The
  // quadtree inside forceCollide is not random either. Same data, same figure,
  // every reload and every machine -- which is why this runs to rest synchronously
  // instead of animating: nobody can print a half-settled tangle.
  function spreadDots(dots, TAU) {
    const clamp = (d) => {
      let x = d.x;
      let y = d.y;
      let r = Math.hypot(x, y);
      if (!(r > 1e-6)) {
        // A dot that has drifted exactly onto the centre has no angle to keep,
        // so give it the middle of its own wedge at the inner edge.
        x = Math.cos(d.aMid) * d.rin;
        y = Math.sin(d.aMid) * d.rin;
        r = d.rin;
      }
      if (r < d.rin) {
        x *= d.rin / r;
        y *= d.rin / r;
      } else if (r > d.rout) {
        x *= d.rout / r;
        y *= d.rout / r;
      }
      // Angular projection. Relative to the wedge middle, wrapped to [-PI, PI],
      // so a wedge that straddles the atan2 discontinuity still compares correctly.
      let rel = Math.atan2(y, x) - d.aMid;
      while (rel > Math.PI) rel -= TAU;
      while (rel < -Math.PI) rel += TAU;
      if (rel > d.aHalf) {
        x = Math.cos(d.aMid + d.aHalf) * r;
        y = Math.sin(d.aMid + d.aHalf) * r;
      } else if (rel < -d.aHalf) {
        x = Math.cos(d.aMid - d.aHalf) * r;
        y = Math.sin(d.aMid - d.aHalf) * r;
      }
      d.x = x;
      d.y = y;
    };

    const sim = d3
      .forceSimulation(dots)
      .force(
        "collide",
        d3.forceCollide(() => DOT_PAD).strength(1).iterations(3)
      )
      .velocityDecay(0.42)
      .stop();
    for (let i = 0; i < DOT_TICKS; i++) {
      sim.tick();
      for (const d of dots) clamp(d);
    }
    return dots;
  }

  function drawCitationWheel(D) {
    setFamilies(D);
    const G = D.graph;
    const nodes = applyShades(numbered(G));
    const total = G.links.length;

    const W = containerWidth("chart-wheel", 700);
    const H = W;
    const svg = newSvg("chart-wheel", W, H);
    const labelKeys = ORDER.filter((k) => nodes.some((d) => d.topic === k));
    // Only the programme rail sits outside the dot band now, so the circle gets
    // nearly the whole box. The programme names used to be drawn out here at the
    // end of a leader, which cost half the radius: measured on the 2026-11-04
    // build the longest label reserved 100 px, leaving an 89 px band for 1,077
    // dots -- the crowding the force pass then had to fight. The rail below costs
    // 12 and the names go in the legend, which the reader is already consulting.
    const RAIL = 12;
    const R = Math.min(W, H) / 2 - RAIL;
    const cx = W / 2;
    const g = svg.append("g").attr("transform", `translate(${cx},${H / 2})`);

    // Sectors, in the same order as the numbering, so a reader can walk the rim
    // and the key together.
    const rank = new Map(ORDER.map((kk, i) => [kk, i]));
    const ordered = nodes
      .slice()
      .sort(
        (a, b) =>
          rank.get(a.topic) - rank.get(b.topic) ||
          b.n - a.n ||
          String(a.title).localeCompare(String(b.title))
      );

    // Node radii, then the ring they sit on -- sized from the nodes rather than
    // from a fraction of R. Forty circles whose radii range from 10 to 17 need a
    // circumference of at least their summed diameters plus air; at the previous
    // 0.44 R the ring was 106 px in radius, which is 666 px of circumference
    // against a required ~1,050, and forty pairs of hub circles printed on top of
    // one another. Deriving the radius from the actual radii makes that
    // unrepresentable, and it also means a future profile with more publications
    // widens the ring instead of overlapping.
    const rScale = d3
      .scaleSqrt()
      .domain([0, d3.max(nodes, (d) => d.n) || 1])
      .range([0, 17]);
    ordered.forEach((d) => (d.hubR = Math.max(10, rScale(d.n))));
    const HUB_GAP = 6;
    // Neighbours on a ring are separated by a chord, not by the arc between them,
    // and a chord is shorter: 2 R sin(PI/N) against 2 PI R / N. Sizing the ring by
    // the arc budget -- the obvious arithmetic -- is short by that factor, and with
    // forty nodes on one ring it left two hub circles overlapping by 0.7 px. The
    // exact requirement is that the *tightest* adjacent pair clears, so take the
    // maximum over pairs rather than an average.
    const N = ordered.length;
    const halfStepSin = Math.sin(Math.PI / N);
    const ringFor = () =>
      ordered.reduce(
        (m, d, i) =>
          Math.max(m, (d.hubR + ordered[(i + 1) % N].hubR + HUB_GAP) / (2 * halfStepSin)),
        0
      );
    // If the ring alone would eat more than half the drawing, shrink every node
    // until it fits -- legibility of the number inside wins over node area, and
    // the count is printed in the key either way. The ring is re-derived from the
    // shrunken radii each pass: capping Rnode without doing that is how a clamp
    // meant to protect the layout would quietly put the overlaps back.
    const RnodeMax = R * 0.55;
    for (let pass = 0; pass < 8; pass++) {
      const want = ringFor();
      if (want <= RnodeMax) break;
      const k = RnodeMax / want;
      ordered.forEach((d) => (d.hubR = Math.max(6, d.hubR * k)));
    }
    let Rnode = ringFor();
    // The band starts clear of the largest hub circle so the leader lines and the
    // cross-links have a clean gap to run through.
    const hubMax = Math.max(...ordered.map((d) => d.hubR));
    const Rband = [Rnode + hubMax + 16, R - 2];
    // A profile large enough that the numbered ring and the dot band cannot both
    // have room is a layout decision, not something to absorb by drawing dots on
    // top of nodes. Fail loudly rather than ship an unreadable exhibit.
    if (Rband[1] - Rband[0] < 60) {
      throw new Error(
        `The wheel has ${N} publications: the numbered ring needs radius ` +
          `${Math.round(Rnode)} and only ${Math.round(
            Rband[1] - Rband[0]
          )} px remain for the citation band. Give the figure a wider container ` +
          `or reduce the number of publications drawn.`
      );
    }

    // Works grouped by publication. A work is placed in EVERY sector of a
    // publication it cites, so a dot means exactly one counted independent
    // citation — the same unit as a yellow square in the waffle and a row in the
    // ledger. Collapsing a multi-citing paper to one dot instead would have made
    // the figure say "1,077" while drawing 917, which is the kind of gap an officer
    // finds. The copies of one paper are tied together by the chords below.
    const worksByPub = new Map(ordered.map((d) => [d.cites_id, []]));
    const nodeById = new Map(ordered.map((d) => [d.cites_id, d]));
    for (const w of G.works) {
      // Primary = the publication with the most counted citations, ties broken by
      // node number, so the chord anchor does not depend on row order.
      let pick = w.cites[0];
      for (const c of w.cites) {
        const a = nodeById.get(c);
        const b = nodeById.get(pick);
        if (!b || (a && a.n > b.n) || (a && a.n === b.n && a.num < b.num)) pick = c;
      }
      for (const c of w.cites) {
        if (worksByPub.has(c)) worksByPub.get(c).push({ w, primary: c === pick });
      }
    }

    // Sector angles are RADIANS throughout, and that has to stay true in one
    // place: `start` accumulates to TAU, d3.arc()'s startAngle/endAngle take
    // radians, and ang() only rotates the frame so the first sector starts at the
    // top. An earlier version of this function treated `start` as a fraction in
    // some places and radians in others, multiplying by TAU a second time -- and
    // because an angle is modulo a turn, that silently folded all 40 sectors into
    // one 46-degree slice piled on top of itself. The figure still drew every dot
    // and every count still reconciled, so nothing downstream noticed; it just
    // looked like a blob. If a sector ever stops filling the circle, suspect these
    // units before suspecting the layout.
    const TAU = 2 * Math.PI;
    let acc = 0;
    const sectors = new Map();
    for (const d of ordered) {
      const span = (d.n / total) * TAU;
      sectors.set(d.cites_id, { start: acc, span });
      acc += span;
    }
    const TOP = -Math.PI / 2;
    const ang = (rad) => rad + TOP;

    // The tinted band behind each publication's dots. Without it the mapping from
    // a dot to a node is a guess; with it the sector owns its dots outright.
    const arc = d3
      .arc()
      .innerRadius(Rband[0] - 7)
      .outerRadius(Rband[1] + 7)
      .startAngle((d) => d.start + TOP)
      .endAngle((d) => d.start + d.span + TOP);
    g.append("g")
      .selectAll("path")
      .data(ordered.map((d) => ({ ...sectors.get(d.cites_id), d })))
      .enter()
      .append("path")
      .attr("d", arc)
      .attr("fill", (d) => shadeFor(d.d))
      .attr("fill-opacity", 0.09);

    // Node positions: evenly spaced, not at sector midpoints. A sector for a
    // two-citation paper is a fraction of a degree wide, so a node placed at its
    // middle would sit on top of its neighbours and the number inside it would be
    // unreadable. Even spacing keeps every number legible, and the leader line
    // from node to sector states the pairing that the position no longer does.
    const pos = new Map();
    ordered.forEach((d, i) => {
      const th = (i / ordered.length) * TAU - Math.PI / 2;
      pos.set(d.cites_id, { x: Math.cos(th) * Rnode, y: Math.sin(th) * Rnode, th });
    });

    // Dots: one per counted citation, seeded evenly inside its own sector and
    // then spread by force. The seed uses a rectangular grid in (angle, area)
    // rather than (angle, radius) so the rows are equal-area -- equal spacing in
    // radius would cram the outer rows, which cover more ground -- and it sizes
    // the row count to what the band can actually hold, so a two-citation sector
    // seeds as a short stack instead of a wide flat pair the collision pass would
    // have to untangle.
    const dots = [];
    const bandDepth = Rband[1] - Rband[0];
    const maxRows = Math.max(1, Math.floor(bandDepth / (DOT_PAD * 2)));
    for (const d of ordered) {
      const s = sectors.get(d.cites_id);
      const list = worksByPub.get(d.cites_id) || [];
      if (!list.length) continue;
      const aMid = ang(s.start + s.span / 2);
      const aHalf = s.span / 2;
      // Rows the wedge can hold at its narrowest (inner) edge, then columns.
      // Arc length is angle-in-radians times radius -- no TAU.
      const arcInner = s.span * Rband[0];
      const colsFit = Math.max(1, Math.floor(arcInner / (DOT_PAD * 2)));
      const cols = Math.max(1, Math.min(list.length, colsFit));
      const rows = Math.max(1, Math.min(maxRows, Math.ceil(list.length / cols)));
      list.forEach((entry, j) => {
        const col = j % cols;
        const row = Math.floor(j / cols);
        const u = (col + 0.5) / cols;
        const v = rows === 1 ? 0.5 : (row + 0.5) / rows;
        const a = ang(s.start + u * s.span);
        // sqrt: equal steps in area, not in radius.
        const rr = Math.sqrt(
          Rband[0] * Rband[0] + v * (Rband[1] * Rband[1] - Rband[0] * Rband[0])
        );
        dots.push({
          entry,
          pub: d,
          x: Math.cos(a) * rr,
          y: Math.sin(a) * rr,
          aMid,
          aHalf,
          rin: Rband[0] + DOT_PAD,
          rout: Rband[1] - DOT_PAD,
        });
      });
    }
    // Nothing in this figure may claim to be the total without being it. A dot is
    // a counted citation, so the count has to equal the number the page prints in
    // the middle; if the two ever part, the projection changed and the caption
    // would be lying.
    if (dots.length !== total) {
      throw new Error(
        `The wheel drew ${dots.length} dots for ${total} counted citations.`
      );
    }

    // Resolve the crowding before anything is drawn, so the chords and the
    // leader lines start from where a dot actually ended up rather than from its
    // seed position.
    spreadDots(dots, TAU);

    // Links first, under the dots. A citing work with one counted citation draws
    // nothing across the wheel. One with several draws its chords from the dot in
    // its own primary sector only, so each cross-link is drawn once rather than
    // once from each end.
    const chords = [];
    for (const dot of dots) {
      if (!dot.entry.primary) continue;
      for (const c of dot.entry.w.cites) {
        if (c === dot.pub.cites_id) continue;
        const target = nodeById.get(c);
        if (!target) continue;
        chords.push({ from: dot, to: target });
      }
    }
    g.append("g")
      .selectAll("line")
      .data(chords)
      .enter()
      .append("line")
      .attr("x1", (d) => d.from.x)
      .attr("y1", (d) => d.from.y)
      .attr("x2", (d) => pos.get(d.to.cites_id).x)
      .attr("y2", (d) => pos.get(d.to.cites_id).y)
      .attr("stroke", (d) => shadeFor(d.to))
      .attr("stroke-opacity", 0.5)
      .attr("stroke-width", 0.8);

    g.append("g")
      .selectAll("circle")
      .data(dots)
      .enter()
      .append("circle")
      .attr("cx", (d) => d.x)
      .attr("cy", (d) => d.y)
      .attr("r", (d) => (d.entry.w.cites.length > 1 ? 2.9 : 2.1))
      .attr("fill", (d) => (d.entry.w.cites.length > 1 ? COLORS.accent : "#9aa4af"))
      .attr("fill-opacity", (d) => (d.entry.w.cites.length > 1 ? 0.95 : 0.72))
      .on("mousemove", (ev, d) =>
        showTip(
          ev,
          `<b>${esc(d.entry.w.title)}</b><br>${esc(shorten(d.entry.w.byline || "", 110))}` +
            `${d.entry.w.year ? " · " + d.entry.w.year : ""}<br>` +
            `Counts as ${d.entry.w.cites.length} independent citation` +
            (d.entry.w.cites.length === 1 ? "" : "s") +
            ` · shown on ${d.entry.w.cites.length} page` +
            (d.entry.w.cites.length === 1 ? "" : "s") +
            (d.entry.w.link ? `<br>${ext(d.entry.w.link, "Open the citing work", "Google Scholar")}` : "")
        )
      )
      .on("mouseleave", hideTip);

    // Leader lines from each node to its own sector.
    g.append("g")
      .selectAll("line")
      .data(ordered)
      .enter()
      .append("line")
      .attr("x1", (d) => pos.get(d.cites_id).x)
      .attr("y1", (d) => pos.get(d.cites_id).y)
      .attr("x2", (d) => {
        const s = sectors.get(d.cites_id);
        return Math.cos(ang(s.start + s.span / 2)) * (Rband[0] - 8);
      })
      .attr("y2", (d) => {
        const s = sectors.get(d.cites_id);
        return Math.sin(ang(s.start + s.span / 2)) * (Rband[0] - 8);
      })
      .attr("stroke", (d) => shadeFor(d))
      .attr("stroke-opacity", 0.45)
      .attr("stroke-width", 0.8)
      .attr("stroke-dasharray", "2 2");

    const hub = g.append("g").selectAll("g").data(ordered).enter().append("g");
    hub
      .append("circle")
      .attr("cx", (d) => pos.get(d.cites_id).x)
      .attr("cy", (d) => pos.get(d.cites_id).y)
      .attr("r", (d) => d.hubR)
      .attr("fill", (d) => shadeFor(d))
      .attr("stroke", (d) => (FAMILY[d.topic] || FAMILY.unknown).edge)
      .attr("stroke-width", 1.1)
      .on("mousemove", (ev, d) =>
        showTip(
          ev,
          `<b>${d.num}. ${esc(d.title)}</b><br>${fmt(d.n)} independent citations` +
            ` · ${esc((FAMILY[d.topic] || FAMILY.unknown).label)}`
        )
      )
      .on("mouseleave", hideTip);
    hub
      .append("text")
      .attr("x", (d) => pos.get(d.cites_id).x)
      .attr("y", (d) => pos.get(d.cites_id).y)
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "central")
      .attr("class", "node-num")
      .attr("font-size", (d) => Math.max(8, Math.min(13, d.hubR * 0.8)))
      .text((d) => d.num);

    // The programme names cannot be drawn as text at the rim: measured on the
    // 2026-11-04 build the longest is 177 px wide and it landed on top of the
    // dots it was labelling, which is the clutter the force pass cannot undo.
    // What does belong on the circle is the *extent* of each programme, so each
    // family gets a solid colour rail just outside its own sectors -- a bar whose
    // length is that programme's share of the citations -- and the names live in
    // the legend under the figure, in the same colours. The rail is drawn from
    // the same sector angles as the wedges, so it cannot disagree with them.
    const railArc = d3
      .arc()
      .innerRadius(Rband[1] + 2.5)
      .outerRadius(R + RAIL - 1);
    const spans = [];
    for (const key of labelKeys) {
      const group = ordered.filter((d) => d.topic === key);
      if (!group.length) continue;
      const s0 = sectors.get(group[0].cites_id).start;
      const last = group[group.length - 1];
      const s1 = sectors.get(last.cites_id).start + sectors.get(last.cites_id).span;
      spans.push({ key, start: s0 + TOP, end: s1 + TOP });
    }
    g.append("g")
      .selectAll("path")
      .data(spans)
      .enter()
      .append("path")
      .attr("d", railArc)
      .attr("fill", (d) => FAMILY[d.key].base)
      .attr("fill-opacity", 0.85)
      .attr("stroke", (d) => FAMILY[d.key].edge)
      .attr("stroke-width", 0.5);

    // Centre: the two figures the whole page is about, so the printed sheet needs
    // nothing else to be interpretable.
    g.append("text")
      .attr("class", "wheel-total")
      .attr("text-anchor", "middle")
      .attr("y", -10)
      .text(fmt(total));
    g.append("text")
      .attr("class", "annot")
      .attr("text-anchor", "middle")
      .attr("y", 10)
      .text("independent citations");
    g.append("text")
      .attr("class", "annot")
      .attr("text-anchor", "middle")
      .attr("y", 26)
      .text(`${fmt(G.distinct_works)} citing papers · ${fmt(nodes.length)} publications`);

    el(
      "cap-wheel"
    ).textContent =
      `Every dot is one of the ${fmt(total)} counted independent citations — the same ` +
      `unit as a yellow square on an exhibit page — placed in the sector of the ` +
      `publication it cites. A sector's angular width is that publication's share of ` +
      `the total, so the rim is a second reading of the per-publication bars, and the ` +
      `solid colour band outside it marks where each research programme's sectors ` +
      `begin and end; the programme names are in the key below. Within a sector the ` +
      `dots are spread by a collision simulation rather than a fixed grid, so no dot ` +
      `covers another, but each is held inside its own sector and never drifts into a ` +
      `neighbour's. Those ${fmt(total)} citations come from ${fmt(
        G.distinct_works
      )} distinct papers, ` +
      `because ${fmt(G.multi_cited_works)} of them appear on the cited-by page of more ` +
      `than one of the PI's papers and are counted once on each. Such a paper is ` +
      `therefore drawn once in each of those sectors, in blue and slightly larger, ` +
      `with a coloured line from its largest sector to each of the others it cites — ` +
      `those lines are the cross-links between the two research programmes, and they ` +
      `are drawn once per paper rather than once per citation. A dashed leader joins ` +
      `each node to its own sector, since the nodes are spaced evenly to stay legible ` +
      `rather than sitting at the middle of a sector that may be a fraction of a ` +
      `degree wide.`;

    // The legend counts dots, since a dot is what the reader is counting. Grey is
    // a citation by a paper that cites one publication; blue is a citation by one
    // of the multi-paper works, so the two add to the total rather than to the
    // number of papers.
    const blueDots = dots.filter((d) => d.entry.w.cites.length > 1).length;
    legend("legend-wheel", [
      {
        label: `Independent citation (${fmt(total - blueDots)})`,
        color: "#9aa4af",
      },
      {
        label: `One from each of several papers cited by the same work (${fmt(
          blueDots
        )})`,
        color: COLORS.accent,
      },
      ...ORDER.filter((k) => nodes.some((d) => d.topic === k)).map((k) => ({
        label: FAMILY[k].label,
        color: FAMILY[k].base,
        edge: FAMILY[k].edge,
      })),
    ]);

    renderNodeKey("key-wheel", nodes, G.edges);
  }

  Object.assign(window.DASH, {
    drawCoCitation,
    drawCitationWheel,
    renderNodeKey,
    TOPIC_ORDER: ORDER,
  });
})();

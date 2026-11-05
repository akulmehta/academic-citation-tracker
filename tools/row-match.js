// Match a rendered exhibit row to the report entry that decides its mark.
//
// Why this is a separate module. Both tools/reprint-exhibits.js and
// tools/audit-highlights.js have to answer "what should this row on this saved
// page look like", and they must answer it IDENTICALLY -- otherwise the audit
// passes a page the re-printer got wrong, or fails a page that is right. That
// shared answer lives here, in one place, per the same rule that keeps
// tally.js the single definition of what counts.
//
// Why not match on the title, as the capture does.
//
// capture-citations.js marks the LIVE Scholar page by normalised title, and for
// that job title matching was fine: at capture time no copy decision exists yet
// (markSecondaryCopies runs later, over the whole citing list), so two rows
// Scholar rendered with the same title legitimately get the same treatment.
//
// The rule changed on 2026-11-05. A row that does not stand for its work is no
// longer highlighted (user decision -- no preprint/copy row is marked in a PDF),
// and Google Scholar sometimes prints the SAME title twice on ONE page: the
// journal record and its repository or [PDF] copy, side by side. Measured that
// day over all 168 filed citing exhibits, 5 pages have a repeated title, and on
// 3 of them exactly one of the two rows must lose its mark:
//
//   allosteric-inhibition-...-p3   "Factor XI antibodies and methods of use"
//   galectin-3-decreases-...-p2    "CD137 (4-1BB) requires physically associated cIAPs..."
//   interaction-of-thrombin-...-p3 "Stabilizing camptothecin pharmaceutical compositions"
//
// Title matching gives both rows the same answer, so those three marks are
// physically impossible to remove by a title rule -- the re-printer silently
// reports those pages as already correct. That is the "compare row by row, never
// by count" failure in this file's own instructions, reached from the other side:
// not a count that hides a swap, but a matcher that cannot express the swap.
//
// So the row is matched by Scholar's own per-record id. Every result row carries
// data-cid (the capture already reads it, capture-citations.js:324), it is unique
// within a page on all 168 filed exhibits, and it joins 1:1 to the report
// entries' `cid` on all 168. That is a stable per-row key the title is not.
//
// The title path is kept as a fallback for a page saved without data-cid, but it
// is only used where the title is unambiguous. When it cannot decide, the row is
// left exactly as it is and the ambiguity is reported -- never guessed at. A
// silently-wrong mark on filed evidence is worse than a page the tool says it
// could not resolve.

const norm = (s) => String(s || "").toLowerCase().replace(/\s+/g, " ").trim();

// Build the lookup for one page's entries.
//
// `highlight` is the caller's decision for that entry -- this module deliberately
// knows nothing about the mark rule, so the audit and the re-printer cannot drift
// by reading it differently. Pass tally.isHighlighted(e).
function planRows(entries, highlightOf) {
  const byCid = new Map();
  const titleCount = new Map();
  const byTitle = new Map();
  const dupCid = new Set();
  for (const e of entries) {
    const highlight = Boolean(highlightOf(e));
    const cid = e.cid === undefined || e.cid === null ? "" : String(e.cid);
    if (cid) {
      // Two entries claiming one cid on one page: the key stops being unique, so
      // it cannot decide either row. Record it and let those rows fall through to
      // the title path (or to unresolved) rather than pick one.
      if (byCid.has(cid)) dupCid.add(cid);
      else byCid.set(cid, { entry: e, highlight });
    }
    const t = norm(e.rawTitle || e.title);
    titleCount.set(t, (titleCount.get(t) || 0) + 1);
    // First entry wins, matching applyHighlights, which used items.find().
    if (!byTitle.has(t)) byTitle.set(t, { entry: e, highlight });
  }
  return { byCid, byTitle, titleCount, dupCid, entries };
}

// Decide one rendered row. Returns { want, basis, entry }.
//
//   basis "cid"        matched on Scholar's per-record id -- the reliable path
//   basis "title"      no cid available, matched a title unique to one entry
//   basis "no-entry"   the page shows a row the report has no entry for
//   basis "ambiguous"  nothing could decide it; the row must be left alone
//
// For "no-entry" and "ambiguous", `want` echoes `currentlyMarked` so a caller
// that only ever writes `want` cannot change a row it does not understand.
function decideRow(row, plan) {
  const cid = row && row.cid ? String(row.cid) : "";
  if (cid && plan.byCid.has(cid) && !plan.dupCid.has(cid)) {
    const hit = plan.byCid.get(cid);
    return { want: hit.highlight, basis: "cid", entry: hit.entry };
  }
  const t = norm(row && row.title);
  const count = plan.titleCount.get(t) || 0;
  if (count === 1 && plan.byTitle.has(t)) {
    const hit = plan.byTitle.get(t);
    return { want: hit.highlight, basis: "title", entry: hit.entry };
  }
  if (count === 0) {
    return { want: Boolean(row && row.marked), basis: "no-entry", entry: null };
  }
  return { want: Boolean(row && row.marked), basis: "ambiguous", entry: null };
}

// Every row of a page, decided. Also reports how each was decided so a caller can
// fail loudly if the reliable path ever stops covering the page.
function planPage(rows, entries, highlightOf) {
  const plan = planRows(entries, highlightOf);
  const perRow = rows.map((r) => ({ row: r, ...decideRow(r, plan) }));
  const basis = { cid: 0, title: 0, "no-entry": 0, ambiguous: 0 };
  for (const x of perRow) basis[x.basis]++;
  return { perRow, basis, plan };
}

// The marks a page should carry: one per entry, since every entry is one citation
// and a correct join maps each to exactly one row. Used to assert that a page's
// mark count is the entry count rather than a count that can hide a swap.
function expectedFromEntries(entries, highlightOf) {
  return entries.filter((e) => Boolean(highlightOf(e))).length;
}

module.exports = { norm, planRows, decideRow, planPage, expectedFromEntries };

#!/usr/bin/env node
/**
 * potential_notable_citations.html — a REVIEW page, deliberately separate from packet.html.
 *
 * packet.html is the document counsel receives and contains only the citations the
 * applicant has confirmed. This page is the opposite: independent citations of the
 * applicant's works that are NOT in the packet, shown so the applicant can read them
 * and decide whether any should be transferred in. Nothing here is evidence yet, and
 * nothing here is printed into the packet.
 *
 * ONE page covers every cited work the candidate queue holds, and the "My work"
 * column names which of the applicant's papers each citation is for. There is
 * deliberately no `--cited=` filter: a page written for one work would quietly omit
 * every other queued work, and `validate-packet.js` §12b fails on a queued work with
 * no listing, so a filtered write could only ever produce a page that fails.
 *
 *   node scripts/build-potential.js            # dry run, prints the counts
 *   node scripts/build-potential.js --write    # writes the page
 *
 * The screen, in the order it is applied, so the arithmetic on the page adds up. It
 * runs once per cited work, because it is arithmetic about ONE cited paper (its
 * record total, less its dependents, less its copies) and mixing two works in one
 * subtraction would misrepresent both. Each work therefore prints its own
 * `<table class="screen">`, and the page states the citation total beneath them:
 *
 *   1. Independent only. The catalog is the authority for independence, not the
 *      packet's `candidate` snapshot, which is taken at seed time and goes stale.
 *      A citing paper that shares an author with the cited work, or that names
 *      either PI, is a self-citation and is never a candidate (§2).
 *   2. Not already in the packet as a confirmed (`included`) citation.
 *   3. Not already used in the original application. Those are listed in
 *      `Citations/Notable Citations in Original Application/Original-Application-Citations.md`
 *      and re-submitting one would be a duplicate, not new evidence (§3).
 *   4. English, and the copy that stands for its work.
 *   5. Not already decided against. A `screened-out` row keeps its record (§4.5)
 *      but must not be offered again — a row that stays on the page gets
 *      reconsidered from scratch by whoever reads it next.
 *
 * Citations, not papers, are what the screen counts. One citing article can cite two
 * of the applicant's works, and those are two citations with two independent
 * judgements to make; a screen that merged them would hide one decision. The TABLE
 * then folds them onto one row, because a person working down a list should see one
 * article once. Both figures are printed and named — "citations screened" and "rows
 * below" — because the two numbers differ by design and a reader who cannot see the
 * difference cannot check the arithmetic. The fold is by work identity
 * (`COALESCE(NULLIF(same_work_key,''), work_key)` on the record), never by title.
 *
 * A row is listed with its row_uid(s) first, because that is the permanent handle:
 *   node scripts/record-tier-decision.js ...      (once it is in the packet)
 * and, to bring one in, the applicant names the uid and the pipeline runs
 * discover-pdfs -> file-pdf -> scan-mentions -> record-evidence for it.
 *
 * The Tier and Citation columns carry a SCAN result, not a guess, and they carry it
 * PER CITED WORK: a tier is a claim about where a sentence sits in an article, and
 * the fact that GLAD appears in one paper's Methods says nothing about where
 * GlycoGlyph appears in it. An article that has not been read says so.
 *
 * Read-only against everything. This script writes only files inside the packet
 * folder, and never opens the Independent Citation Record for writing (§0).
 */
const fs = require("fs");
const path = require("path");
const { PKT, openCatalog, openPacket, potentialIndependent, sameSentence, toolForCitedPaper } = require("./lib.js");

const argv = process.argv.slice(2);
const WRITE = argv.includes("--write");

/**
 * The one review page.
 *
 * GLAD's original filename is kept, because the applicant, `PACKET-STATUS.md` §4 and
 * `validate-packet.js` all know the page by that name. The per-work pages
 * (`potential_notable_citations-GlycoGlyph.html`, `-MAWE.html`) are retired: their
 * content is now the "My work" column of this page, and leaving stale copies behind
 * would put two documents in the folder claiming to be the review list.
 */
const OUT = path.join(PKT, "potential_notable_citations.html");

/**
 * The per-citation reports, all on one page. It is opened as
 * `citation-report.html?uid=cit-000544` and shows that citation's block. The blocks
 * are embedded as inert <template>s rather than fetched, because a browser refuses
 * fetch() from a file:// page and this folder is opened that way.
 */
const REPORT_PAGE = "citation-report.html";
const REPORT_OUT = path.join(PKT, REPORT_PAGE);

/**
 * Same wording as `render-packet.js`, deliberately: a tier shown on the review
 * page has to mean exactly what it means in the packet, or a candidate looks
 * stronger or weaker here than it will once it is filed.
 */
const TIER_LABEL = {
  A: "Tier A — the tool is used in the Methods as the method performed",
  B: "Tier B — the tool is used in the Results or Figures",
  C: "Tier C — cited in a high-reputation publication",
  D: "Tier D — acknowledged",
};

const DISCOVER_LABEL = {
  // `has-pdf` is the state a row carries once the file is on disk, and it is the
  // most common state on the page. It was missing from this map, which printed the
  // raw snake_case token to the reader AND left it out of the "Open copy" filter —
  // a select built from these keys could not offer the one choice 16 rows held.
  "has-pdf": "PDF on file",
  "open-copy": "Open copy found",
  "paywalled": "Paywalled",
  "no-open-copy": "No open copy",
  "not-in-indexes": "Not in OpenAlex",
  "lookup-failed": "Look-up failed",
  "not-queued": "Not yet looked up",
};
const DISCOVER_CLASS = {
  "has-pdf": "ok",
  "open-copy": "ok", "paywalled": "warn", "no-open-copy": "warn",
  "not-in-indexes": "warn", "lookup-failed": "bad", "not-queued": "warn",
};
const TIER_PILL = { A: "ok", B: "ok", C: "warn", D: "warn" };

/** How a citation was found, in words a reader can weigh. */
const BASIS_LABEL = {
  "reference-number resolution": "its reference number or author-year citation",
  "human reading": "a person reading the page",
};

function esc(s) {
  return String(s == null ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Encode each path segment but keep the slashes, so a relative link still resolves. */
function href(p) {
  return esc(String(p).split("/").map(seg => encodeURIComponent(seg)).join("/"));
}

/** The link from the candidate list to one citation's report. */
function reportHref(uid) {
  return esc(`${REPORT_PAGE}?uid=${encodeURIComponent(uid)}`);
}

/**
 * Every external link opens in a new tab (§5.6): the page is a worklist someone
 * works down, and clicking a publisher link must not destroy the row they were
 * reading. Relative links — the PDFs inside this folder — stay in the tab.
 * `rel=noopener` so the opened page cannot reach back at this one through
 * `window.opener`.
 */
function extLink(url, label) {
  return `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>`;
}

/** Titles Scholar renders with a trailing ellipsis are still that work's title. */
function stripTrailingEllipsis(t) {
  return String(t || "").replace(/\s*…\s*$/, "").trim();
}

function hostOf(u) {
  try { return new URL(u).host; } catch { return ""; }
}

/**
 * The cited works the page covers: everything the candidate queue holds.
 *
 * The queue is the authority, not `citation`: a work is being worked on when its
 * citing rows were seeded, and deriving the list from promoted rows would quietly
 * drop a work whose candidates have not been promoted yet — exactly the state a
 * fresh `--seed` leaves you in, and the state in which the page is most needed.
 */
function citedWorks(db, cat) {
  const ids = [...new Set(db.prepare(
    "SELECT cites_id FROM candidate WHERE cites_id IS NOT NULL AND cites_id <> ''").all().map(r => r.cites_id))];
  const byId = new Map(cat.prepare("SELECT cites_id, title, year, authors FROM publications").all().map(p => [p.cites_id, p]));
  const out = ids.map(id => byId.get(id)).filter(Boolean);
  out.sort((a, b) => {
    // GLAD first (the work the packet-side documents), then GlycoGlyph, then MAWE,
    // then anything else alphabetically by title.
    const rank = t => (/^GLAD$/i.test(t) ? 0 : /^GlycoGlyph$/i.test(t) ? 1 : /^MAWE$/i.test(t) ? 2 : 3);
    const ra = rank(toolForCitedPaper(a.title) || ""), rb = rank(toolForCitedPaper(b.title) || "");
    return ra - rb || String(a.title).localeCompare(String(b.title));
  });
  return out;
}

/**
 * Labels for cited works whose title names no tool, or names one that
 * `toolForCitedPaper` reads more broadly than the title does. Each label is the
 * crux of the work, so the three glycan-microarray papers are not all "MAWE".
 */
const WORK_LABEL_OVERRIDES = [
  [/^GlyMDB\b/i, "GlyMDB: microarray database"],
  [/wet-erase|\bMAWE\b/i, "MAWE: reusable microarrays"],
  [/^Tools for generating and analyzing glycan microarray data/i, "Microarray data tools"],
];

/**
 * Short label for a cited work, for the "My work" column.
 *
 * A tool is named only when the title itself names it. `toolForCitedPaper` also maps
 * any "glycan microarray" title to MAWE, so the tool is checked against the title
 * before it is used. A work that names no tool is labelled by the override above or,
 * failing that, by the first words of its own title, which is what identifies it.
 */
function workLabel(pub) {
  const title = stripTrailingEllipsis(pub.title);
  for (const [re, label] of WORK_LABEL_OVERRIDES) if (re.test(title)) return label;
  const tool = toolForCitedPaper(pub.title);
  if (tool && new RegExp(tool.replace("-", "[- ]?"), "i").test(title)) return tool;
  return title.length > 34 ? title.slice(0, 34).replace(/\s+\S*$/, "") + "\u2026" : title;
}

/**
 * Every candidate citation across all queued works, with the screen printed per work.
 *
 * Returns { cites, pubById }. `cites` is one entry per (citing row, cited work)
 * pair — a citation, not a paper — because independence and tier are both relative
 * to the cited paper. The table fold happens later, in `foldRows`.
 */
function loadCitations(cat, db, works) {
  const packetRows = new Map(db.prepare("SELECT * FROM citation").all().map(r => [r.row_uid, r]));
  const cand = new Map(db.prepare("SELECT * FROM candidate").all().map(r => [r.row_uid, r]));
  const files = db.prepare("SELECT * FROM file ORDER BY folder_uid, file").all();
  // Every recorded place the work appears, including the citations that name no
  // tool. `scan-mentions.js` can only find a mention that spells GLAD out, so a
  // paper crediting the work as `[5–9]` or `(Mehta and Cummings 2019)` reads "no
  // tier" to it — and `scan-refs.js` resolves those into the mention table. Showing
  // only the scan would hide a real citation on a page whose whole purpose is to
  // help the applicant choose.
  const mentionsBy = new Map();
  for (const m of db.prepare(`SELECT * FROM mention
      ORDER BY row_uid, INSTR('ABCD', tier), CAST(page AS INTEGER)`).all()) {
    if (!mentionsBy.has(m.row_uid)) mentionsBy.set(m.row_uid, []);
    mentionsBy.get(m.row_uid).push(m);
  }
  const fileByFolder = new Map();
  for (const f of files) {
    if (!fileByFolder.has(f.folder_uid)) fileByFolder.set(f.folder_uid, []);
    fileByFolder.get(f.folder_uid).push(f);
  }

  const cites = [];
  const screens = [];
  for (const pub of works) {
    // The screen itself lives in lib.potentialIndependent so the status report and
    // this page cannot disagree about what "potential" means.
    let screened;
    try {
      screened = potentialIndependent(cat, db, pub.cites_id);
    } catch (e) {
      console.error(e.message + " Refusing to guess which citations were already filed.");
      process.exit(1);
    }
    const before = cites.length;
    for (const r of screened.rows) {
      const c = cand.get(r.row_uid) || {};
      const pkt = packetRows.get(r.row_uid);
      const pdfs = fileByFolder.get(r.row_uid) || [];
      // A candidate that shares a downloaded copy with another row points at the same file.
      const sharedPdf = !pdfs.length && c.pdf_file ? c.pdf_file : null;
      cites.push({
        uid: r.row_uid,
        citesId: pub.cites_id,
        workName: workLabel(pub),
        workTitle: stripTrailingEllipsis(pub.title),
        workYear: pub.year || "",
        title: stripTrailingEllipsis(r.title),
        rawTitle: r.title,
        authors: r.authors || "",
        senior: c.senior_author || "",
        year: c.year || "",
        venue: (c.venue || "").replace(/\s*…\s*$/, ""),
        link: r.link || c.link || "",
        doi: r.doi || c.doi || "",
        workType: r.work_type || "",
        confirm: r.confirm_state || "",
        discover: c.discover_state || "not-queued",
        discoverNote: c.discover_note || "",
        pdfs, sharedPdf,
        hasPdf: !!(pdfs.length || sharedPdf),
        mentions: mentionsBy.get(r.row_uid) || [],
        scanTier: pkt ? pkt.scan_tier : null,
        scanNote: pkt ? pkt.scan_note : null,
        scannedOn: pkt ? pkt.scanned_on : null,
        section: pkt ? pkt.section : null,
        page: pkt ? pkt.page : null,
        quote: pkt ? pkt.quote : null,
        url: pkt ? pkt.citing_url : null,
        venueFull: pkt ? pkt.citing_venue : null,
        authorsFull: pkt ? pkt.citing_authors : null,
        articleType: pkt ? pkt.citing_article_type : null,
        institutions: pkt ? pkt.citing_institutions : null,
      });
    }
    // `screened.rows.length` is the work's own listed count and must equal what the
    // loop pushed; if a future edit filters inside the loop the screen would stop
    // matching the table, so assert it here rather than print arithmetic that lies.
    const listed = cites.length - before;
    if (listed !== screened.rows.length) {
      console.error(`Internal error: screen listed ${screened.rows.length} citations for `
        + `"${pub.title.slice(0, 50)}" but ${listed} were built.`);
      process.exit(1);
    }
    screens.push({ pub, screen: screened.screen, listed });
  }
  return { cites, screens };
}

/**
 * Fold citations onto one table row per citing WORK.
 *
 * The key is the record's own work identity — `same_work_key` when a person
 * recorded one, `work_key` otherwise — read out of the catalog, never inferred
 * from a title here. Two rows of one work are one article to a reader, so they
 * share a row; the per-citation judgements stay separate inside it, one tier and
 * one quotation per cited work.
 *
 * A row with no work key at all is left on its own rather than grouped with the
 * other keyless rows: an absent key means "unknown", and treating unknown as equal
 * would merge unrelated papers onto one row.
 */
function foldRows(cat, cites) {
  const keyOf = new Map();
  const uids = [...new Set(cites.map(c => c.uid))];
  if (uids.length) {
    const rows = cat.prepare(`SELECT row_uid, COALESCE(NULLIF(same_work_key,''), work_key) AS k
      FROM citations WHERE row_uid IN (${uids.map(() => "?").join(",")})`).all(...uids);
    for (const r of rows) keyOf.set(r.row_uid, r.k || "");
  }
  const groups = new Map();
  for (const c of cites) {
    const k = keyOf.get(c.uid) || `NO-KEY:${c.uid}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(c);
  }
  // Work display order for the cells inside a row: GLAD, GlycoGlyph, MAWE, rest.
  const order = new Map();
  for (const c of cites) if (!order.has(c.workName)) order.set(c.workName, order.size);
  const out = [];
  for (const entries of groups.values()) {
    entries.sort((a, b) => order.get(a.workName) - order.get(b.workName) || a.uid.localeCompare(b.uid));
    // The article's own facts (title, authors, venue, links) are the same work in
    // every entry; take them from the entry with the most recorded, then the lowest
    // uid, so the choice is deterministic and does not depend on query order.
    const rank = c => (c.authorsFull ? 4 : 0) + (c.venueFull ? 2 : 0) + (c.institutions ? 1 : 0);
    const lead = [...entries].sort((a, b) => rank(b) - rank(a) || a.uid.localeCompare(b.uid))[0];
    out.push({
      key: keyOf.get(entries[0].uid) || "",
      uids: [...entries].map(e => e.uid).sort(),
      entries,
      lead,
      works: [...new Set(entries.map(e => e.workName))],
      hasPdf: entries.some(e => e.hasPdf),
      pdfs: [...new Map(entries.flatMap(e => e.pdfs).map(f => [f.file, f])).values()],
      sharedPdf: !entries.some(e => e.pdfs.length) ? (entries.find(e => e.sharedPdf) || {}).sharedPdf || null : null,
      discover: preferredDiscover(entries),
      discoverNote: entries.map(e => e.discoverNote).filter(Boolean)[0] || "",
      year: lead.year, senior: lead.senior, venue: lead.venue,
      title: lead.title, rawTitle: lead.rawTitle, authors: lead.authors,
      link: lead.link, doi: lead.doi,
    });
  }
  out.sort((a, b) => a.uids[0].localeCompare(b.uids[0]));
  return out;
}

/**
 * One "Open copy" pill per row, from the most advanced entry.
 *
 * A row that reports `open-copy` while another of its copies is `has-pdf` would
 * send someone to fetch a file that is already on the shelf, so a retrieved copy
 * wins; a look-up that failed is reported ahead of a quiet `no-open-copy` because
 * it is the one state that means the answer is not yet known.
 */
function preferredDiscover(entries) {
  const PREF = ["has-pdf", "open-copy", "paywalled", "no-open-copy", "not-in-indexes", "lookup-failed", "not-queued"];
  const seen = new Set(entries.map(e => e.discover));
  return PREF.find(p => seen.has(p)) || [...seen][0] || "not-queued";
}

/**
 * The strongest recorded mention for ONE citation that the named-tool scan did not
 * already show.
 *
 * The scan's own verdict is printed from `citation.section`/`quote`, so a mention
 * recording the same sentence would be printed twice; `sameSentence` keeps the two
 * tools' two views of one line to one entry.
 */
function bestResolved(c) {
  for (const m of c.mentions) {
    if (m.basis === "extracted text") continue;
    if (c.scanTier && sameSentence(m.quote, c.quote)) continue;
    return m;
  }
  return null;
}

/** The scan note names the section and page; the table shows that, not the whole sentence. */
function shortNote(note) {
  const s = String(note || "").trim();
  if (!s) return "no usable mention of the cited tool was found in the text";
  return s.length > 200 ? s.slice(0, 200).replace(/\s+\S*$/, "") + "\u2026" : s;
}

/**
 * Cells that hold one entry PER CITED WORK, stacked in the same order in every
 * column so a folded row reads as a small table rather than as a pile.
 *
 * Each block carries `data-uid` and `data-work`. That is not decoration:
 * `validate-packet.js` §12b reads the tier pills back out of this markup and
 * compares each one with the scan's verdict for THAT uid. Without the attribute a
 * row citing two works would have two pills and one uid, and the check could not
 * tell which claim it was testing — it would either go blind or accuse a correct
 * row of inventing a tier.
 */
function workCell(c, inner, showTag) {
  return `<div class="workcell" data-uid="${esc(c.uid)}" data-work="${esc(c.workName)}">`
    + (showTag ? `<div class="wt">${esc(c.workName)}</div>` : "") + inner + `</div>`;
}

/**
 * Tier for ONE citation — a scan result, never an inference from title or venue.
 *
 * Two kinds of pill, and they mean different things:
 *   - `Tier A` — the named-tool scan found "GLAD" in prose under a heading the
 *     citing paper printed.
 *   - `Tier A — resolved` — the paper credits the work without naming it, and
 *     `scan-refs.js` identified the reference number or the author-year citation
 *     and recorded the sentence. Same tier bar, different route to it, so the
 *     page says which.
 */
function tierCell(c) {
  if (c.scanTier) {
    return `<span class="pill ${TIER_PILL[c.scanTier] || "warn"}">Tier ${esc(c.scanTier)}</span>`
      + `<div class="sub">${esc(c.section || "")}${c.page ? `, p.\u00a0${esc(c.page)}` : ""}</div>`;
  }
  const res = bestResolved(c);
  if (res) {
    return `<span class="pill ${TIER_PILL[res.tier] || "warn"} resolved">Tier ${esc(res.tier)} &mdash; resolved</span>`
      + `<div class="sub">${esc(res.section)}${res.page ? `, p.\u00a0${esc(res.page)}` : ""}, named by ${esc(BASIS_LABEL[res.basis] || res.basis)}</div>`;
  }
  if (c.hasPdf) {
    return `<span class="pill bad">no tier</span>`
      + `<div class="sub">read ${esc(c.scannedOn || "\u2014")}, but no mention in a section that earns one</div>`;
  }
  return `<span class="none">not read</span>`;
}

/**
 * Citation for ONE citation — the words the tier came from, so the judgement in the
 * column beside it can be checked without opening the PDF. The full report is on its
 * own page; this is a working excerpt.
 */
function citationCell(c) {
  if (c.scanTier && c.quote) {
    return quoteCell(c.quote, `${esc(c.section || "")}${c.page ? `, p.\u00a0${esc(c.page)}` : ""} \u00b7 `
      + `scanned ${esc(c.scannedOn || "\u2014")}`, c);
  }
  const res = bestResolved(c);
  if (res) {
    return quoteCell(res.quote, `${esc(res.section)}${res.page ? `, p.\u00a0${esc(res.page)}` : ""} \u00b7 `
      + `resolved ${esc(res.noted_on || "\u2014")}`, c);
  }
  if (c.hasPdf) {
    return `<span class="sub">${esc(shortNote(c.scanNote))}</span>`
      + `<div class="sub"><a href="${reportHref(c.uid)}">full report</a></div>`;
  }
  return `<span class="none">no PDF, so nothing has been quoted</span>`;
}

function quoteCell(text, where, c) {
  const q = text.length > 260 ? text.slice(0, 260).replace(/\s+\S*$/, "") + "\u2026" : text;
  return `<span class="q">&ldquo;${esc(q)}&rdquo;</span>`
    + `<div class="sub">${where} \u00b7 <a href="${reportHref(c.uid)}">full report</a></div>`;
}

/**
 * One table row: one citing WORK, with one block per cited work inside the three
 * judgement columns.
 *
 * `data-*` carries what a filter needs in a form that does not depend on parsing
 * the rendered prose. Reading the pill text back would tie the filter to the label
 * wording, and a label reworded for a reader would silently change what a filter
 * matches. `data-work` is a space-joined list because a folded row can hold several
 * works and the "My work" filter must match a row that includes the chosen work.
 */
function rowHtml(r) {
  const multi = r.entries.length > 1;
  const pdfCell = r.pdfs.length
    ? r.pdfs.map(f => `<a href="${href(f.file)}">PDF</a>`).join(" ")
    : r.sharedPdf
      ? `<a href="${href(r.sharedPdf)}">PDF</a> <span class="sub">(same work as another row)</span>`
      : `<span class="none">not retrieved</span>`;
  // A row is "read" if any of its citations was read; the tier filter then behaves
  // per row, which is what someone narrowing the pile expects.
  const tierKeys = r.entries.map(c => {
    if (c.scanTier) return c.scanTier;
    const res = bestResolved(c);
    return res ? `${res.tier}-resolved` : "none";
  });
  const anyPdf = r.hasPdf ? 1 : 0;
  const works = r.works.join(" ");
  const text = [r.uids.join(" "), r.title, r.authors, r.senior, r.venue, works,
    ...r.entries.map(e => e.quote || ""), r.doi].join(" \u00b7 ").toLowerCase();
  return `    <tr data-uid="${esc(r.uids[0])}" data-uids="${esc(r.uids.join(" "))}" `
    + `data-tier="${esc(tierKeys.join(" ")).trim()}" data-disc="${esc(r.discover)}" `
    + `data-pdf="${anyPdf}" data-year="${esc(r.year || "")}" data-work="${esc(works)}" `
    + `data-works="${r.entries.length}" data-text="${esc(text)}">
      <td class="uid">${r.uids.map((u, i) => {
        const a = `<a href="${reportHref(u)}">${esc(u)}</a>`;
        return i === 0 ? a : `<div class="uid2">${a}</div>`;
      }).join("")}</td>
      <td class="work">${r.entries.map(c => workCell(c,
          `<span class="wname">${esc(c.workName)}</span><div class="sub">${esc(c.workYear || "\u2014")}</div>`, false)).join("")}</td>
      <td class="title"><a href="${reportHref(r.uids[0])}">${esc(r.title)}</a>${r.rawTitle !== r.title ? ' <span class="sub">[title as Scholar shows it continues]</span>' : ""}
        ${r.authors ? `<div class="byline">${esc(r.authors)}</div>` : ""}${multi ? `<div class="sub">${r.entries.length} citations of my work in this one article</div>` : ""}</td>
      <td>${esc(r.senior || "\u2014")}</td>
      <td>${esc(r.year || "\u2014")}</td>
      <td>${esc(r.venue || "\u2014")}</td>
      <td class="src">${r.link ? extLink(r.link, hostOf(r.link) || "Scholar link") : "\u2014"}${r.doi ? `<div class="sub">${extLink(`https://doi.org/${r.doi}`, r.doi)}</div>` : ""}</td>
      <td class="disc"><span class="pill ${DISCOVER_CLASS[r.discover] || "warn"}">${esc(DISCOVER_LABEL[r.discover] || r.discover)}</span>${r.discoverNote ? `<div class="sub">${esc(r.discoverNote)}</div>` : ""}</td>
      <td class="pdf">${pdfCell}</td>
      <td class="tier">${r.entries.map(c => workCell(c, tierCell(c), multi)).join("")}</td>
      <td class="cite">${r.entries.map(c => workCell(c, citationCell(c), multi)).join("")}</td>
    </tr>`;
}

/**
 * The report for ONE ARTICLE (one table row), in the shape of an entry in `packet.html`.
 *
 * The article is shown once, with the facts that belong to the paper: its authors,
 * venue, senior author, open-copy state and files. Each citation of my work that the
 * article holds follows as its own section, because "where the citation sits" and the
 * quotation are judgements about one cited work. A row folds several citations, and a
 * report that showed only one of them would hide the evidence the row exists for.
 *
 * The template carries every uid the row holds, so any of them opens this report, and
 * each section carries its own `data-uid` so the page can bring the opened one into view.
 */
function rowReport(r) {
  return `
<template data-uids="${esc(r.uids.join(" "))}"><article class="report">
  <h3>${esc(r.title)}</h3>
  ${articleHead(r)}
  ${r.entries.map(citationSection).join("\n")}
  <p class="trace">${r.uids.map(u => `<code>${esc(u)}</code>`).join(" ")} &middot; review note only — not part of
     <code>packet.html</code> and not evidence until the row is confirmed and the packet re-rendered</p>
</article></template>`;
}

/** The article-level facts: who wrote it, where it appears, what open copy exists, and its files. */
function articleHead(r) {
  const L = r.lead;
  const files = r.pdfs.length
    ? `<ul class="files-list">${r.pdfs.map(f => `<li><a href="${href(f.file)}">${esc(f.file.split("/").pop())}</a>`
        + ` <span class="sub">${esc(f.role || "")}</span></li>`).join("")}</ul>`
    : r.sharedPdf
      ? `<ul class="files-list"><li><a href="${href(r.sharedPdf)}">PDF</a>`
        + ` <span class="sub">same work as another row</span></li></ul>`
      : `<p class="none">No PDF on file.</p>`;
  return `
  <p class="byline">${esc(L.authorsFull || r.authors || "")}<br>
     <span class="venue">${esc(L.venueFull || r.venue || "")}${r.year ? `, ${esc(r.year)}` : ""}</span>`
     + `${r.link ? ` &middot; ${extLink(r.link, hostOf(r.link))}` : ""}`
     + `${r.doi ? ` &middot; ${extLink(`https://doi.org/${r.doi}`, r.doi)}` : ""}</p>
  <dl>
    <dt>Senior author</dt>
    <dd>${esc(r.senior || "\u2014")}</dd>
    <dt>Citing authors&rsquo; institutions</dt>
    <dd>${L.institutions ? esc(L.institutions) : `<span class="none">Not recorded — confirm from the PDF&rsquo;s affiliation block.</span>`}</dd>
    <dt>Article type</dt>
    <dd>${esc(L.articleType || "\u2014")}</dd>
    <dt>Open copy</dt>
    <dd><span class="pill ${DISCOVER_CLASS[r.discover] || "warn"}">${esc(DISCOVER_LABEL[r.discover] || r.discover)}</span>${r.discoverNote ? ` <span class="sub">${esc(r.discoverNote)}</span>` : ""}</dd>
  </dl>
  <h4>Files</h4>
  ${files}`;
}

/**
 * One citation of my work inside the article: the work it cites, where the citation
 * sits, the quotation, and the independence basis. Every value comes from this
 * citation's own row, never from a sibling in the same article.
 */
function citationSection(c) {
  const res = bestResolved(c);
  const where = c.scanTier
    ? `<strong>${esc(c.section || "")}</strong>${c.page ? `, page ${esc(c.page)}` : ""} — ${esc(TIER_LABEL[c.scanTier] || c.scanTier)}`
    : res
      ? `<span class="pill ${TIER_PILL[res.tier] || "warn"} resolved">Tier ${esc(res.tier)} &mdash; resolved</span> `
        + `<strong>${esc(res.section)}</strong>${res.page ? `, page ${esc(res.page)}` : ""} — `
        + `${esc(TIER_LABEL[res.tier] || res.tier)}, and the citing paper names no tool there: the citation was found by ${esc(BASIS_LABEL[res.basis] || res.basis)}.`
      : c.hasPdf
        ? `<span class="pill bad">no tier</span> ${esc(shortNote(c.scanNote))}`
        : `<span class="none">not read — no PDF on file, so no claim about where the citation sits</span>`;

  const quote = c.quote
    ? `<blockquote>&ldquo;${esc(c.quote)}&rdquo;</blockquote>`
      + `<p class="cite-page">${esc(c.section || "")}${c.page ? `, p.&nbsp;${esc(c.page)}` : ""}`
      + `${c.scannedOn ? ` &middot; scanned ${esc(c.scannedOn)}` : ""}</p>`
    : res
      ? `<blockquote>&ldquo;${esc(res.quote)}&rdquo;</blockquote>`
        + `<p class="cite-page">${esc(res.section)}${res.page ? `, p.&nbsp;${esc(res.page)}` : ""}`
        + `${res.noted_on ? ` &middot; resolved ${esc(res.noted_on)}` : ""}`
        + ` &middot; the marker as printed: ${esc(res.use_type || "reference number or author-year citation")}</p>`
      : `<p class="none">No verbatim sentence recorded.</p>`;

  return `
<section class="cite-of" data-uid="${esc(c.uid)}">
  <h4>Citation of ${esc(c.workName)}</h4>
  <dl>
    <dt>My work cited</dt>
    <dd>${esc(c.workTitle)}${c.workYear ? ` (${esc(c.workYear)})` : ""} <span class="sub">[${esc(c.workName)}]</span></dd>
    <dt>row_uid</dt>
    <dd><code>${esc(c.uid)}</code></dd>
    <dt>Where the citation appears</dt>
    <dd>${where}</dd>
    <dt>Independence</dt>
    <dd>Re-checked against the citation record: complete author lists of both papers, no shared
        author, neither PI named on the citing paper${c.confirm ? `; basis on the record: ${esc(c.confirm)}` : ""}.</dd>
  </dl>
  <h4>What the text says</h4>
  ${quote}
</section>`;
}

const CSS = `
  :root { --ink:#1b1b1b; --muted:#666; --rule:#d8d8d8; --accent:#7a1f1f; }
  * { box-sizing: border-box; }
  body { margin:0; background:#fff; color:var(--ink);
         font:16px/1.55 "Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif; }
  main { max-width: 82rem; margin:0 auto; padding:2.5rem 1.5rem 5rem; }
  h1 { font-size:1.9rem; line-height:1.2; margin:.2rem 0 .4rem; }
  h2 { font-size:1.2rem; margin:2.2rem 0 .5rem; padding-bottom:.3rem; border-bottom:2px solid var(--accent); }
  p { margin:.5rem 0; }
  a { color:var(--accent); }
  code { font-family:"SFMono-Regular",Consolas,monospace; font-size:.85em; background:#f3f3f3; padding:.05em .3em; border-radius:3px; }
  .kicker { font-size:.75rem; letter-spacing:.14em; text-transform:uppercase; color:var(--muted); }
  .notice { border:1px solid #c9a227; background:#fdf7e3; padding:.9rem 1.1rem; margin:1.2rem 0; }
  .notice strong { color:#7a5c00; }
  .cited { background:#f6f1ec; border-left:3px solid #b08968; padding:.7rem 1rem; margin:1.2rem 0; font-size:.92rem; }
  .cited ol { margin:.4rem 0 0; padding-left:1.3rem; }
  .cited li { margin:.25rem 0; }
  table { border-collapse:collapse; width:100%; font-size:.8rem; margin-top:.8rem; }
  th, td { border-bottom:1px solid var(--rule); padding:.4rem .35rem; vertical-align:top; text-align:left; }
  thead th { border-bottom:2px solid var(--ink); font-size:.7rem; text-transform:uppercase;
             letter-spacing:.05em; color:var(--muted); position:sticky; top:0; background:#fff; }
  .uid { font-family:"SFMono-Regular",Consolas,monospace; font-size:.74rem; overflow-wrap:anywhere; }
  .uid2 { font-family:"SFMono-Regular",Consolas,monospace; font-size:.74rem; overflow-wrap:anywhere; color:var(--muted); }
  /* The table is laid out to the width of the screen, never wider: columns take their
     share from the colgroup and long words (uids, DOIs, URLs) wrap inside their cell.
     Without fixed layout the browser sizes the table to its content and it overflows. */
  #cand { table-layout:fixed; width:100%; }
  #cand th, #cand td { overflow-wrap:anywhere; }
  #cand thead th { cursor:pointer; user-select:none; }
  #cand thead th:focus-visible { outline:2px solid var(--accent); outline-offset:-2px; }
  #cand thead th[aria-sort="ascending"]::after { content:" \\25B2"; }
  #cand thead th[aria-sort="descending"]::after { content:" \\25BC"; }
  .byline { color:var(--muted); font-size:.74rem; margin-top:.15rem; }
  .sub { color:var(--muted); font-size:.7rem; }
  .src, .disc { font-size:.74rem; }
  .pdf { white-space:nowrap; }
  .none { color:var(--muted); font-style:italic; font-size:.72rem; }
  /* A folded row holds one block per cited work in the "My work", Tier and Citation
     columns. The rule between blocks is what makes the three columns read as
     aligned pairs rather than as a list of unrelated notes. */
  .workcell { border-top:1px dotted var(--rule); padding-top:.3rem; margin-top:.3rem; }
  .workcell:first-child { border-top:none; padding-top:0; margin-top:0; }
  .workcell .wt { font-size:.66rem; text-transform:uppercase; letter-spacing:.05em; color:var(--accent); }
  .work { font-size:.74rem; }
  .wname { font-weight:600; }
  .pill { display:inline-block; padding:.05rem .4rem; border-radius:9px; font-size:.68rem; }
  .pill.ok { background:#e3f0e4; color:#26562a; }
  .pill.warn { background:#f6ecd9; color:#7a5c00; }
  .pill.bad { background:#f7e0e0; color:#7a1f1f; }
  .pill.resolved { background:#e2ecf6; color:#1f3f6e; }
  .screen { font-size:.8rem; color:var(--muted); width:auto; }
  .screen td { border:none; padding:.12rem .35rem; }
  .screen td.n { font-variant-numeric:tabular-nums; color:var(--ink); }
  .tier { font-size:.74rem; }
  .cite { font-size:.74rem; }
  .cite .q { display:block; margin-bottom:.15rem; }
  .report { border:1px solid var(--rule); border-left:3px solid var(--accent); padding:.9rem 1.1rem; margin:1.4rem 0; }
  .report h3 { font-size:1.02rem; margin:.1rem 0 .2rem; }
  .report h4 { font-size:.78rem; text-transform:uppercase; letter-spacing:.06em; margin:1.1rem 0 .3rem; color:var(--muted); }
  .report dl { display:grid; grid-template-columns:minmax(9rem,max-content) 1fr; gap:.15rem .8rem; margin:.5rem 0; font-size:.82rem; }
  .report dt { color:var(--muted); font-size:.74rem; text-transform:uppercase; letter-spacing:.03em; padding-top:.15rem; }
  .report dd { margin:0; }
  .report blockquote { margin:.4rem 0 .2rem; padding:.4rem .9rem; border-left:3px solid var(--rule);
                       background:#faf8f5; font-size:.86rem; }
  .report .cite-page { font-size:.72rem; color:var(--muted); margin:.1rem 0 0; }
  .report .files-list { margin:.3rem 0; padding-left:1.2rem; font-size:.82rem; }
  .report .trace { font-size:.72rem; color:var(--muted); border-top:1px solid var(--rule); padding-top:.4rem; margin:.9rem 0 0; }
  .report .cite-of { border-top:1px dotted var(--rule); margin-top:1rem; padding:.5rem .6rem 0; }
  .report .cite-of.focus { background:#fdf7e3; border-left:3px solid #c9a227; }
  .foot { margin-top:2rem; font-size:.75rem; color:var(--muted); border-top:1px solid var(--rule); padding-top:.8rem; }

  /* Filter bar over the candidate table. Screen only. */
  .filters { display:flex; flex-wrap:wrap; gap:.6rem .9rem; align-items:flex-end;
             margin:1rem 0 .2rem; padding:.7rem .9rem;
             background:#faf8f5; border:1px solid var(--rule); border-left:3px solid var(--accent); }
  .filters .fld { display:flex; flex-direction:column; gap:.2rem; }
  .filters label { font-size:.66rem; text-transform:uppercase; letter-spacing:.06em; color:var(--muted); }
  .filters input, .filters select { font:inherit; font-size:.78rem; padding:.25rem .35rem;
             border:1px solid #bbb; background:#fff; color:var(--ink); }
  .filters input[type=search] { min-width:18rem; }
  .filters .spacer { flex:1 1 auto; }
  .filters button { font:inherit; font-size:.76rem; padding:.3rem .7rem; background:#fff;
             border:1px solid #bbb; cursor:pointer; }
  .filters button:hover { background:#f1ede7; }
  #shown { font-size:.78rem; color:var(--muted); white-space:nowrap; }
  #no-hits { display:none; margin:.6rem 0; padding:.5rem .8rem; background:#fdf7e3;
             border-left:3px solid #c9a227; font-size:.8rem; }
  tr.excluded { display:none; }

  @media print {
    main { padding:0; max-width:none; }
    a { color:inherit; text-decoration:none; }
    /* A printed exhibit is the whole screen, whatever was filtered on screen. */
    .filters, #no-hits { display:none !important; }
    tr.excluded { display:table-row !important; }
    thead th { position:static; }
  }
`;

/**
 * The screen tables, one per cited work.
 *
 * `validate-packet.js` §12b requires each table's arithmetic to close and its
 * listed figure to equal the citations it contributed. It cannot require listed ==
 * the number of rows, because a folded row can carry citations from two works: the
 * page prints both figures and names them, and the validator checks the citation
 * count against the uid cells rather than against the row count.
 */
function screenTables(screens) {
  return screens.map(({ pub, screen, listed }) => `
  <h3 class="scrk">${esc(stripTrailingEllipsis(pub.title))} (${esc(pub.year || "\u2014")})</h3>
  <table class="screen">
    <tr><td>Citing works the record lists for this paper</td><td class="n">${screen.total}</td></tr>
${screen.superseded ? `    <tr><td>less rows retired by a re-capture</td><td class="n">&minus;${screen.superseded}</td></tr>\n` : ""}    <tr><td>less not independent (shares an author with the cited work, or names a PI)</td><td class="n">&minus;${screen.dependent}</td></tr>
    <tr><td>less copies that do not stand for their work (preprint / repository twin)</td><td class="n">&minus;${screen.notStanding}</td></tr>
    <tr><td>less not listed in English</td><td class="n">&minus;${screen.nonEnglish}</td></tr>
    <tr><td>less already confirmed in the packet</td><td class="n">&minus;${screen.inPacket}</td></tr>
    <tr><td>less already used in the original application</td><td class="n">&minus;${screen.origApp}</td></tr>
${screen.decided ? `    <tr><td>less already decided against on review (kept in <code>screened-out.csv</code>)</td><td class="n">&minus;${screen.decided}</td></tr>\n` : ""}    <tr><td><strong>listed here for review</strong></td><td class="n"><strong>${listed}</strong></td></tr>
  </table>`).join("\n");
}

function headerHtml(screens, cites, rows, today) {
  const nCit = cites.length;
  const nRows = rows.length;
  const nMulti = rows.filter(r => r.entries.length > 1).length;
  const withPdf = cites.filter(c => c.hasPdf).length;
  const withTier = cites.filter(c => c.scanTier || bestResolved(c)).length;
  const works = screens.map(s => ({
    label: workLabel(s.pub),
    title: stripTrailingEllipsis(s.pub.title),
    year: s.pub.year || "\u2014",
    listed: s.listed,
  }));
  return `
<header>
  <p class="kicker">Review page — not part of the packet</p>
  <h1>Potential notable citations</h1>
  <div class="notice">
    <strong>This page is for the applicant&rsquo;s review, not for counsel.</strong>
    <code>packet.html</code> holds only the citations confirmed for the filing; nothing on this
    page is in it. Tick a row, or send the <code>row_uid</code>s, and the pipeline
    (<code>discover-pdfs.js</code> &rarr; <code>file-pdf.js</code> &rarr; <code>scan-mentions.js</code>
    &rarr; <code>record-evidence.js</code>) reads the full text, finds the section and page, and
    files it at the tier the text supports. Where a PDF is already on file, the Tier and
    Citation columns carry what that reading found; where it is not, they say so and claim nothing.
  </div>
  <div class="cited">
    <strong>My works covered — ${works.length}</strong>
    <ol>
${works.map(w => `      <li><strong>${esc(w.label)}</strong> — ${esc(w.title)} (${esc(w.year)}):
        ${w.listed} citation${w.listed === 1 ? "" : "s"} listed</li>`).join("\n")}
    </ol>
  </div>
  <p>${nCit} independent citations of these works are not in the packet and were not used in the
     original application. Each is a real, independently authored citation. They appear as
     <strong>${nRows} rows</strong> below, because ${nMulti} article${nMulti === 1 ? "" : "s"} cite${nMulti === 1 ? "s" : ""}
     more than one of my works and is shown once, with a separate tier and quotation for each work it
     cites. ${withTier} citation${withTier === 1 ? "" : "s"} have been read and the sentence that cites the
     tool is recorded; ${withPdf - withTier} have been read and the tool does not appear anywhere the
     article ranks as a section; ${nCit - withPdf} have no PDF yet, so where the citation sits is still
     unknown &mdash; and that is what decides a tier.</p>
  <p class="sub">The screen below counts <em>citations</em>, not articles: independence and tier are
     both judgements about one citing paper against one cited work, so a paper that cites two of my
     works is screened twice and decides twice. The table then folds those onto one row.</p>
${screenTables(screens)}
</header>`;
}

/** Filter options are built from what the page actually holds, so a select can
 *  never offer a choice that matches nothing. Tier is grouped rather than listed
 *  per letter: a reviewer sorting the pile wants "anything in Methods", whether the
 *  paper named the tool or the reference resolver found it. */
function filterHtml(rows, cites) {
  const opt = (v, label) => `<option value="${esc(v)}">${esc(label)}</option>`;
  const tierOpts = [opt("", "any"), opt("A", "Tier A"), opt("B", "Tier B"), opt("C", "Tier C"),
    opt("D", "Tier D"), opt("resolved", "any tier, found by reference"),
    opt("untiered", "read, no tier"), opt("unread", "not read")].join("");
  const discSeen = new Set(rows.map(r => r.discover));
  const discOpts = ["", ...Object.keys(DISCOVER_LABEL).filter(k => discSeen.has(k))]
    .map(k => k === "" ? opt("", "any") : opt(k, DISCOVER_LABEL[k])).join("");
  const yearSeen = [...new Set(rows.map(r => String(r.year || "").trim()).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
  const yearOpts = [opt("", "any"), ...yearSeen.map(y => opt(y, y))].join("");
  // "My work" options come from the citations, in the order the works were screened.
  const workSeen = [];
  for (const c of cites) if (!workSeen.includes(c.workName)) workSeen.push(c.workName);
  const workOpts = [opt("", "any"), ...workSeen.map(w => opt(w, w))].join("");
  const multiOpts = [opt("", "any"), opt("1", "one work only"), opt("2", "two or more works")].join("");
  return `
<div class="filters">
  <div class="fld">
    <label for="f-q">Search (title, author, venue, quote, uid, doi, my work)</label>
    <input type="search" id="f-q" placeholder="e.g. glycan array, Heras, cit-000544, MAWE" autocomplete="off">
  </div>
  <div class="fld"><label for="f-work">My work</label><select id="f-work">${workOpts}</select></div>
  <div class="fld"><label for="f-works">Works cited by it</label><select id="f-works">${multiOpts}</select></div>
  <div class="fld"><label for="f-tier">Tier</label><select id="f-tier">${tierOpts}</select></div>
  <div class="fld"><label for="f-disc">Open copy</label><select id="f-disc">${discOpts}</select></div>
  <div class="fld"><label for="f-pdf">PDF on file</label><select id="f-pdf">${opt("", "any")}${opt("1", "yes")}${opt("0", "no")}</select></div>
  <div class="fld"><label for="f-year-min">Year from</label><select id="f-year-min">${yearOpts}</select></div>
  <div class="fld"><label for="f-year-max">Year to</label><select id="f-year-max">${yearOpts}</select></div>
  <div class="spacer"></div>
  <div class="fld"><label>&nbsp;</label><button type="button" id="f-reset">Reset</button></div>
  <div class="fld"><label>&nbsp;</label><span id="shown"></span></div>
</div>`;
}

function notesHtml(rows, cites) {
  const nRows = rows.length, nCit = cites.length;
  return `
<p class="sub">Filtering is screen only: a printed or PDF copy of this page always shows every
   candidate, so what is on screen cannot silently decide what gets filed.</p>

<h2>Notes on the list</h2>
<p><strong>One row is one citing article; the &ldquo;My work&rdquo; column says which of my papers it
   cites.</strong> ${nCit} citations appear as ${nRows} rows. An article that cites two of my works is
   one row with two blocks in the &ldquo;My work&rdquo;, Tier and Citation columns, and each block is
   judged on its own: a tier for GLAD in that article says nothing about where GlycoGlyph sits in it,
   and one work can be filed while the other is not. The row leads with every
   <code>row_uid</code> it carries, because the uid &mdash; not the title &mdash; is the handle the
   pipeline takes.</p>
<p><strong>&ldquo;Open copy&rdquo; is a statement about access, not about the paper.</strong>
   <em>Open copy found</em> means a downloadable version exists and, where the PDF column has a
   link, it is already in this folder. <em>Paywalled</em> means the article is real and the
   publisher gates the file &mdash; an access the applicant&rsquo;s own subscription or an
   interlibrary loan can settle. <em>No open copy</em> and <em>Not in OpenAlex</em> mean the
   look-up completed and found nothing downloadable; they are not findings that the paper does
   not exist, and a publisher page or a library copy can still supply the text.</p>
<p><strong>Independence was re-checked against the citation record, not the queued snapshot.</strong>
   The record reads the complete author list of both papers. A citing paper that shares an author
   with the cited work, or that names Richard D. Cummings or the former PI Umesh R. Desai, is a
   self-citation and was removed at the first screen above.</p>
<p><strong>A tier is a scan result, and only for an article that has actually been read.</strong>
   The Tier and Citation columns are filled from the PDF on file: <code>scan-mentions.js</code> extracts the
   text, finds every appearance of the tool, and reads the heading the article itself printed above
   it. Tier A means the mention sits in the Methods as the method performed; B in the Results or
   Figures; C in a high-reputation publication; D an acknowledgement. Where the column says
   <em>no tier</em>, the article was read and the tool appears only in a reference list, a table, or
   a section that earns no tier &mdash; the note says which. Where it says <em>not read</em>, no
   PDF exists yet, so no claim is made. A scan is a machine reading of prose: it is good at telling
   a Methods sentence from a bibliography entry, and it cannot tell whether the use was substantial.
   A person&rsquo;s reading of the page decides, and filing a candidate runs the same scanner again
   into the packet.</p>
<p><strong>A blue &ldquo;Tier&nbsp;X &mdash; resolved&rdquo; pill means the citing paper never names the tool.</strong>
   A citing author who used the work often credits it only as a reference number (&ldquo;following
   established procedures [125&ndash;127]&rdquo;, a superscript <sup>69</sup>) or, in author&ndash;year
   journals, only as &ldquo;(Mehta et al. 2024)&rdquo;. <code>scan-refs.js</code> identifies which
   bibliography entry is the applicant&rsquo;s paper &mdash; two signals required, title plus year plus
   first author, never a guess &mdash; and then reports every place that number or that citation is
   credited, with the section and the sentence. The tier bar is identical to a named mention&rsquo;s:
   under a heading the citing paper printed, in prose, not a table cell and not the reference list.
   The colour only says how the citation was found, not that it is weaker.</p>

<h2>How a candidate becomes part of the packet</h2>
<p><strong>This page is read-only, deliberately.</strong> There is no checkbox and no button, because a
   tick on a screen belongs to nobody: it is lost on reload, it cannot be inspected by anyone else, and
   nothing downstream could tell whether you meant it. A decision is recorded in
   <code>notable-citations.sqlite</code> instead, and the way to make one is to tell the assistant the
   <code>row_uid</code> you want filed. It then runs
   <code>scripts/record-evidence.js</code>, which <strong>refuses</strong> unless you give it a sentence
   quoted verbatim from the citing article and it can find that exact sentence in the PDF on file &mdash;
   so a filed quotation is checked against the document rather than written from memory. The row&rsquo;s
   <code>status</code> becomes <code>included</code>, its folder moves into <code>papers/</code>, and
   <code>packet.html</code> is re-rendered so the entry and its detail section appear together. A row
   decided against is <code>screened-out</code> with the reason recorded, and stays in
   <code>screened-out.csv</code> so it is not reconsidered from scratch later.</p>
<p>What the page is for, then, is the reading: filter to a work or a tier, open the PDF from the
   &ldquo;PDF on file&rdquo; column, judge the sentence, and quote it back.</p>

<h2>Citation reports</h2>
<p>Each <code>row_uid</code> and each citing-paper title links to that article&rsquo;s report in
   <code>citation-report.html</code>, which opens on the uid (<code>?uid=cit-000544</code>). The report shows
   the article once, with its authors, senior author, open copy and files, and then every citation of my work
   the article holds, with the one you opened highlighted. Each citation section gives the work it cites,
   where the citation sits, and the quotation. A report is a review note, not evidence: nothing in it reaches
   counsel unless the row is confirmed and the packet is re-rendered.</p>`;}
function footHtml(today, cites, rows) {
  const read = cites.filter(c => c.hasPdf).length;
  return `
<p class="foot">Generated ${today} by <code>scripts/build-potential.js</code> from
   <code>Database/citation-catalog.sqlite</code> (read-only) and
   <code>notable-citations.sqlite</code>. Not linked from <code>packet.html</code> and not printed
   with it. Independence screen: <code>status = INDEPENDENT</code> and
   <code>is_countable_independent = 1</code> on the active, standing, English row.
   ${cites.length} citations of ${new Set(cites.map(c => c.citesId)).size} of my works, shown as
   ${rows.length} rows; ${read} of the ${cites.length} read by <code>scan-mentions.js</code> on or
   before ${esc(today)}.</p>`;
}

/**
 * Client-side filter.
 *
 * Reads the data-* attributes the row was written with, never the rendered prose: a
 * label reworded for a reader must not change what a filter matches.
 *
 * Tier and "My work" are per-row LISTS on a folded row. The semantics are "any": a
 * row showing Tier A for GlycoGlyph and no tier for GLAD is a Tier A row, because
 * someone narrowing to Tier A wants to see it. "Works cited by it" is the opposite
 * and narrows on the count.
 */
const FILTER_JS = `
(function () {
  var tbody = document.getElementById("cand-body");
  if (!tbody) return;
  var rows = Array.prototype.slice.call(tbody.rows);
  var q = document.getElementById("f-q"), tier = document.getElementById("f-tier"),
      disc = document.getElementById("f-disc"), pdf = document.getElementById("f-pdf"),
      yearMin = document.getElementById("f-year-min"), yearMax = document.getElementById("f-year-max"),
      work = document.getElementById("f-work"),
      works = document.getElementById("f-works"), shown = document.getElementById("shown"),
      none = document.getElementById("no-hits");

  function keep(r) {
    var d = r.dataset, t = tier.value;
    var tiers = (d.tier || "").split(" ");
    if (t === "A" || t === "B" || t === "C" || t === "D") {
      if (tiers.indexOf(t) < 0) return false;
    } else if (t === "resolved") {
      if (!tiers.some(function (x) { return x.indexOf("-resolved") > 0; })) return false;
    } else if (t === "untiered" || t === "unread") {
      if (tiers.indexOf("none") < 0) return false;
      if (t === "untiered" && d.pdf !== "1") return false;
      if (t === "unread" && d.pdf !== "0") return false;
    }
    if (work.value && (d.work || "").split(" ").indexOf(work.value) < 0) return false;
    if (works.value === "2" && !(Number(d.works) >= 2)) return false;
    if (works.value === "1" && Number(d.works) !== 1) return false;
    if (disc.value && d.disc !== disc.value) return false;
    if (pdf.value && d.pdf !== pdf.value) return false;
    // A year range needs a year: a row with no parseable year cannot fall inside one.
    var lo = yearMin.value, hi = yearMax.value;
    if (lo || hi) {
      var y = parseInt(d.year, 10);
      if (isNaN(y)) return false;
      if (lo && y < Number(lo)) return false;
      if (hi && y > Number(hi)) return false;
    }
    var needle = q.value.trim().toLowerCase();
    if (needle) {
      // Every whitespace-separated term must appear; order does not matter.
      var text = d.text || "";
      if (!needle.split(/\\s+/).every(function (w) { return text.indexOf(w) >= 0; })) return false;
    }
    return true;
  }

  function apply() {
    var n = 0;
    rows.forEach(function (r) {
      var ok = keep(r);
      r.classList.toggle("excluded", !ok);
      if (ok) n++;
    });
    shown.textContent = "showing " + n + " of " + rows.length + " rows";
    none.style.display = n ? "none" : "block";
  }

  [q, tier, disc, pdf, yearMin, yearMax, work, works].forEach(function (el) {
    el.addEventListener("input", apply);
    el.addEventListener("change", apply);
  });
  document.getElementById("f-reset").addEventListener("click", function () {
    q.value = ""; tier.value = ""; disc.value = ""; pdf.value = ""; yearMin.value = ""; yearMax.value = "";
    work.value = ""; works.value = "";
    apply();
  });

  // Column sort. Rows are reordered in place and the filter only toggles a class, so
  // the two compose. A row with no year sorts last whichever way the year column runs.
  var table = document.getElementById("cand");
  var heads = table ? Array.prototype.slice.call(table.tHead.rows[0].cells) : [];
  var sortCol = -1, sortDir = 1;
  function sortKey(r, col) {
    if (col === 0) return (r.dataset.uids || "").split(" ")[0];
    if (col === 2) { var a = r.cells[2].querySelector("a"); return (a || r.cells[2]).textContent.trim(); }
    if (col === 4) { var n = parseInt(r.dataset.year, 10); return isNaN(n) ? null : n; }
    return r.cells[col].textContent.replace(/\\s+/g, " ").trim();
  }
  function compare(a, b) {
    if (a === null || b === null) return a === b ? 0 : (a === null ? 1 : -1);
    if (typeof a === "number") return a - b;
    return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
  }
  heads.forEach(function (th, col) {
    th.tabIndex = 0;
    th.title = "Click to sort; click again to reverse";
    var go = function () {
      sortDir = sortCol === col ? -sortDir : 1;
      sortCol = col;
      heads.forEach(function (h, i) {
        h.setAttribute("aria-sort", i !== col ? "none" : (sortDir > 0 ? "ascending" : "descending"));
      });
      rows.sort(function (a, b) {
        var ka = sortKey(a, col), kb = sortKey(b, col);
        var c = (ka === null || kb === null) ? compare(ka, kb) : compare(ka, kb) * sortDir;
        return c || compare(sortKey(a, 0), sortKey(b, 0));
      });
      rows.forEach(function (r) { tbody.appendChild(r); });
    };
    th.addEventListener("click", go);
    th.addEventListener("keydown", function (e) {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); }
    });
  });
  apply();
})();
`;

function buildHtml(screens, cites, rows, today) {
  const body = rows.map(rowHtml).join("\n");
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Potential notable citations — all cited works</title>
<style>${CSS}</style>
</head>
<body>
<main>
${headerHtml(screens, cites, rows, today)}

<h2>The ${rows.length} candidates</h2>
<p>${cites.filter(c => c.hasPdf).length} of the ${cites.length} citations have a PDF on file and have
   been read by the scanner; those carry a tier and the sentence it rests on. The rest have no tier
   because nothing has been read, which is a statement about the file, not about the paper.</p>
<p class="sub">Click a column heading to sort the table; click it again to reverse the order. The year
   filters take a range: set one or both of &ldquo;Year from&rdquo; and &ldquo;Year to&rdquo;.</p>
${filterHtml(rows, cites)}
<p id="no-hits">No row matches those filters. Reset to see all ${rows.length}.</p>

<table id="cand">
  <colgroup>
    <col style="width:7.5%"><col style="width:9%"><col style="width:17%"><col style="width:7%">
    <col style="width:4.5%"><col style="width:10%"><col style="width:8%"><col style="width:9%">
    <col style="width:5%"><col style="width:10%"><col style="width:13%">
  </colgroup>
  <thead><tr>
    <th>row_uid</th><th>My work</th><th>Citing paper</th><th>Senior author</th><th>Year</th><th>Venue</th>
    <th>Where it is</th><th>Open copy</th><th>PDF on file</th><th>Tier</th><th>Citation</th>
  </tr></thead>
  <tbody id="cand-body">
${body}
  </tbody>
</table>
${notesHtml(rows, cites)}
${footHtml(today, cites, rows)}
</main>
<script>${FILTER_JS}</script>
</body>
</html>`;
}

/**
 * The single report page. It shows one citation's block, chosen by the `uid` query
 * parameter. Every block is in the page as a <template>, so nothing is fetched and
 * the page works when opened straight from the folder.
 *
 * The uid is checked against the row_uid shape before it is used as an id, and the
 * text of a missing uid is written with textContent, so a crafted address cannot
 * inject markup into the page.
 */
const REPORT_JS = `
(function () {
  var uid = new URLSearchParams(window.location.search).get("uid") || "";
  var tpl = /^cit-\\d{6}$/.test(uid) ? document.querySelector('template[data-uids~="' + uid + '"]') : null;
  var miss = document.getElementById("missing");
  if (!tpl) {
    miss.hidden = false;
    miss.textContent = uid
      ? "No citation with row_uid " + uid + " is on this page."
      : "Open a citation from the candidate list. This page needs a row_uid in its address, for example ?uid=cit-000544.";
    return;
  }
  var holder = document.getElementById("report");
  holder.appendChild(tpl.content.cloneNode(true));
  var opened = holder.querySelector('[data-uid="' + uid + '"]');
  if (opened) { opened.classList.add("focus"); opened.scrollIntoView(); }
  document.title = uid + " \\u2014 citation report";
})();
`;

/**
 * One template per table row, so the page holds one entry for each article and the
 * uids it folds. `rows` is the table's own grouping, which keeps a report and its row
 * in step: the page cannot show a citation the list does not.
 */
function buildReportHtml(rows, cites, today) {
  const seen = new Set();
  for (const c of cites) {
    if (seen.has(c.uid)) throw new Error(`${c.uid} is in two rows; a uid must name one citation`);
    seen.add(c.uid);
  }
  const templates = rows.map(rowReport).join("\n");
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Citation report</title>
<style>${CSS}</style>
</head>
<body>
<main>
<header>
  <p class="kicker">Review page — not part of the packet</p>
  <h1>Citation report</h1>
  <p><a href="potential_notable_citations.html">&larr; Back to the candidate list</a></p>
  <p class="sub">One article from the candidate list, opened by a row_uid. It shows every citation of my work
     that the article holds; the one you opened is highlighted. A review note, not evidence: nothing here
     reaches counsel unless the row is confirmed and the packet re-rendered.</p>
</header>
<noscript><p>This page needs JavaScript to choose which article to show.</p></noscript>
<p id="missing" hidden></p>
<div id="report"></div>
<p class="foot">Generated ${esc(today)} by <code>scripts/build-potential.js</code> from
   <code>Database/citation-catalog.sqlite</code> (read-only) and <code>notable-citations.sqlite</code>.
   ${rows.length} articles holding ${cites.length} citation reports, one per row_uid.</p>
</main>
${templates}
<script>${REPORT_JS}</script>
</body>
</html>`;
}

function main() {
  const cat = openCatalog();
  const db = openPacket();
  const works = citedWorks(db, cat);
  if (!works.length) {
    console.error("No cited work to render — the candidate queue is empty. Run discover-pdfs.js --seed first.");
    process.exit(1);
  }
  const { cites, screens } = loadCitations(cat, db, works);
  const rows = foldRows(cat, cites);
  const today = new Date().toISOString().slice(0, 10);
  const html = buildHtml(screens, cites, rows, today);
  const reportHtml = buildReportHtml(rows, cites, today);
  const withPdf = cites.filter(c => c.hasPdf).length;
  const merged = rows.filter(r => r.entries.length > 1).length;
  if (!WRITE) {
    console.log(`dry run [${path.basename(OUT)}, ${REPORT_PAGE}] — ${cites.length} citations of ${works.length} works, `
      + `${rows.length} rows (${merged} citing more than one work), ${withPdf} citations with a PDF on file. Add --write.`);
    return;
  }
  // Retire the per-work pages this page replaces. Leaving them behind would put two
  // documents in the folder claiming to be the review list, and validate-packet.js
  // would keep checking the stale one.
  const stale = fs.readdirSync(PKT)
    .filter(f => /^potential_notable_citations-.+\.html$/.test(f));
  fs.writeFileSync(OUT, html, "utf8");
  fs.writeFileSync(REPORT_OUT, reportHtml, "utf8");
  for (const f of stale) fs.unlinkSync(path.join(PKT, f));
  console.log(`wrote ${path.relative(PKT, OUT)} — ${(html.length / 1024).toFixed(0)} KB | `
    + `${cites.length} citations of ${works.length} works, ${rows.length} rows (${merged} merged), `
    + `${withPdf} with a PDF on file`);
  console.log(`wrote ${REPORT_PAGE} — ${(reportHtml.length / 1024).toFixed(0)} KB | ${cites.length} citation reports`);
  if (stale.length) console.log(`removed ${stale.length} superseded per-work page(s): ${stale.join(", ")}`);
}

main();

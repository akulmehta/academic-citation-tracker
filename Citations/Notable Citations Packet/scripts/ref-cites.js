/**
 * Reference-number resolution.
 *
 * A citing article usually does not name the applicant's tool. It numbers the
 * paper in its bibliography and puts that number in the text — and the number is
 * often one of several credited together, so "[125-127]" is how a Methods
 * sentence ends after "following established procedures". Searching the text for
 * the word "GLAD" cannot see any of that: in the Kiessling article the only
 * in-text mark for the MAWE paper is a bare superscript `69`, and the word MAWE
 * appears nowhere outside the reference list.
 *
 * So resolve the number first, then find the number:
 *
 *   1. Split the bibliography into numbered entries (`buildReferenceIndex`).
 *   2. Find which entry is the applicant's paper, from its title, year and first
 *      author (`matchReference`). Two independent signals are required — a title
 *      alone is not an identity, and neither is a number that merely looks right.
 *   3. Find every in-text marker that includes that number (`findMarkers`),
 *      including ranges and lists, and report the sentence it sits in.
 *
 * The failure this guards against is a false positive, not a miss: a tier is a
 * claim about how the tool was used, and crediting a sentence to the applicant's
 * paper because the digits `69` appear in it — `ε = 69,830`, `2018`, page range
 * `71–81`, `107869`, `OD550` — would put a fabricated quotation in front of
 * counsel. Hence markers are parsed as WHOLE bracketed runs and expanded, never
 * found by searching for a digit string; and a bare number counts only when it is
 * set raised and smaller than the text around it, which is what a superscript is.
 */
"use strict";

/* ------------------------------------------------------------------ */
/* 1. the bibliography                                                 */
/* ------------------------------------------------------------------ */

/**
 * Split the extracted pages into numbered bibliography entries.
 *
 * An entry begins at a line whose text opens with `12.` or `[12]` and runs to the
 * next such line, possibly across a page break — a reference list wraps, so an
 * entry can start on p.30 and finish on p.31. A line is only allowed to OPEN an
 * entry on a page the list has already started on, which is why `refPages` is
 * decided first: it stops a numbered Methods list from being read as a
 * bibliography and handing back a bogus number.
 *
 * Returns { byNumber: Map<number,string>, refPages: Set<number> }.
 */
function buildReferenceIndexV1(pages) {
  const refPages = new Set();
  pages.forEach((lines, i) => {
    if (isReferencePage(lines)) refPages.add(i + 1);
  });

  const byNumber = new Map();
  let cur = null;
  // The last page of a reference list is often only a few lines long and fails
  // the page test, which would silently drop the tail of a wrapped entry. Keep
  // reading a page past the detected block while the numbering still climbs or
  // an entry is still unfinished, and stop the moment it does neither.
  let lastRefPage = 0;
  let continuing = false;
  for (let p = 1; p <= pages.length; p++) {
    const lines = pages[p - 1] || [];
    if (!refPages.has(p)) {
      if (!(continuing && p === lastRefPage + 1)) continue;
      const nextNum = lines.reduce((mx, L) => {
        const m = L.text.match(/^\[?\s*(\d{1,4})\s*(?:\]|\.\s|\.$)/);
        return m ? Math.max(mx, Number(m[1])) : mx;
      }, 0);
      continuing = cur != null && (!/\d{4}/.test(cur.parts.join(" ")) || nextNum > cur.num);
      if (!continuing) continue;
      refPages.add(p);
    }
    for (const L of lines) {
      const m = L.text.match(/^\[?\s*(\d{1,4})\s*(?:\]|\.\s|\.$)/);
      if (m) {
        const num = Number(m[1]);
        // A duplicate number means the shape matched something that is not an
        // entry (a table of contents, a running figure numbering). Drop it rather
        // than let either reading win.
        if (byNumber.has(num)) byNumber.set(num, null);
        else {
          cur = { num, parts: [L.text.replace(m[0], "").trim()] };
          byNumber.set(num, cur.parts.join(" "));
        }
        continuing = true;
        continue;
      }
      if (!cur) continue;
      cur.parts.push(L.text);
      byNumber.set(cur.num, cur.parts.join(" "));
    }
    if (refPages.has(p)) lastRefPage = p;
  }
  for (const [k, v] of byNumber) if (v === null) byNumber.delete(k);
  return { byNumber, refPages };
}


/**
 * Second bibliography reader: find the numbered list by its SEQUENCE, not by one entry shape.
 *
 * v1 only opens an entry at `12.` or `[12]`. ACS journals print `(12) Surname...`, some print
 * `12) Surname`, and Springer prints `12 Surname AB`. v1 returned no entries for those, so every
 * citation in them looked uncited. Here every line that could open an entry in any of those shapes is
 * a candidate, and the bibliography is the LONGEST run of candidates numbered 1, 2, 3, ... in document
 * order. A numbered Methods list or a figure legend makes a short run; a bibliography makes a long one,
 * so the sequence is what says which list is the references — the shape of one line cannot.
 */
const ENTRY_OPENERS = [
  /^\[\s*(\d{1,4})\s*\]\s*(.*)$/,
  /^\(?(\d{1,4})[.)]\.?\s+(.*)$/,
  /^(\d{1,4})\s+([A-Z][\p{L}'’-]+,?\s+(?:[A-Z]|et al).*)$/u,
  // RSC grouped references: "1 (a) Y. H. Liu, ...; (b) M. H. Sun, ..." — one number, several papers
  /^(\d{1,4})\s+(\(a\)\s.*)$/,
  // the number alone on its line, entry text on the next: "28." / "Gao C, Stavenhagen, ..."
  /^(\d{1,4})\.\s*()$/,
  // RSC style prints initials first: "11 A. Y. Mehta, Y. Jin and U. R. Desai, Expert Opin..."
  /^(\d{1,4})\s+((?:[A-Z]\.\s?){1,3}[A-Z][\p{L}'’-]+.*)$/u,
];
function buildReferenceIndexV2(pages) {
  const starts = [];
  pages.forEach((lines, pi) => lines.forEach((L, li) => {
    const t = String(L.text || "").trim();
    for (const re of ENTRY_OPENERS) {
      const m = t.match(re);
      if (m) { starts.push({ n: Number(m[1]), page: pi + 1, li, rest: (m[2] || "").trim(), open: t[0] }); break; }
    }
  }));
  // longest chain n, n+1, n+2, ... in order; best[i] = length of the chain ending at starts[i]
  const best = new Array(starts.length).fill(1), prev = new Array(starts.length).fill(-1);
  const lastOf = new Map(); // number -> index of the latest start carrying it
  starts.forEach((st, i) => {
    // Allow up to two missing numbers: an entry whose number prints on its own line, or in a column
    // the extractor reads out of order, is not a reason to throw away the rest of the list.
    for (let d = 1; d <= 3; d++) {
      const j = lastOf.get(st.n - d);
      if (j !== undefined && best[j] + 1 > best[i]) { best[i] = best[j] + 1; prev[i] = j; }
    }
    lastOf.set(st.n, i);
  });
  let end = -1;
  best.forEach((b, i) => { if (end < 0 || b >= best[end]) end = i; });
  const byNumber = new Map(), refPages = new Set();
  if (end < 0 || best[end] < 5) return { byNumber, refPages };
  const chain = [];
  for (let i = end; i >= 0; i = prev[i]) chain.unshift(starts[i]);
  chain.forEach((st, k) => {
    const nxt = chain[k + 1];
    const parts = [st.rest];
    // run to the next entry, across a page break, capped so the last entry cannot swallow a footer
    let p = st.page, li = st.li + 1, taken = 0;
    while (taken < 14) {
      if (nxt && p === nxt.page && li >= nxt.li) break;
      if (nxt && p > nxt.page) break;
      const lines = pages[p - 1] || [];
      if (li >= lines.length) { p++; li = 0; if (p > pages.length) break; continue; }
      parts.push(lines[li].text);
      li++; taken++;
    }
    byNumber.set(st.n, parts.join(" ").replace(/\s+/g, " ").trim());
  });
  const firstP = chain[0].page, lastP = chain[chain.length - 1].page;
  // A bibliography packs several entries onto each page. A "chain" of seven numbers spread over fourteen
  // pages is a numbered list in the body (steps, headings, figure panels), and treating it as the reference
  // list marked every page between as bibliography, so the body text was never searched (cit-000094).
  if (chain.length / (lastP - firstP + 1) < 3) return { byNumber: new Map(), refPages: new Set() };
  for (let p = firstP; p <= lastP; p++) refPages.add(p);
  if (lastP < pages.length && (pages[lastP] || []).length < 30) refPages.add(lastP + 1);
  // How the paper prints its citation numbers follows from how it prints the list: "[3] Smith" means
  // in-text [3]; "(3) Smith" means (3). A marker in the other style is something else (an enumeration).
  const openers = chain.map(c => c.open);
  const nb = openers.filter(o => o === "[").length, np = openers.filter(o => o === "(").length;
  const style = nb > chain.length / 2 ? "bracket" : np > chain.length / 2 ? "paren" : "other";
  return { byNumber, refPages, style, refLineStart: { page: firstP, li: chain[0].li } };
}

/** v1 and v2 side by side; whichever finds more entries leads and the other fills any gap. */
function buildReferenceIndex(pages) {
  const a = buildReferenceIndexV1(pages), b = buildReferenceIndexV2(pages);
  const [lead, other] = b.byNumber.size > a.byNumber.size ? [b, a] : [a, b];
  const byNumber = new Map(lead.byNumber);
  for (const [k, v] of other.byNumber) if (!byNumber.has(k)) byNumber.set(k, v);
  const refPages = new Set([...lead.refPages, ...other.refPages]);
  const rs = b.refLineStart;
  // the line-level start only holds while no other reader called an earlier page part of the list
  return { byNumber, refPages, style: lead === b ? b.style : undefined, refLineStart: rs && Math.min(...refPages) === rs.page ? rs : undefined };
}

const BIB_ENTRY = /^(?:\[\s*\d+\s*\]|\d+\.\s+[A-Z][a-z]+\s*,?\s+[A-Z]\.?)/;
const BIB_LOCATOR = /\bdoi\b|\bcrossref\b|\bpmid\b|\bpmcid\b|\bhttps?:\/\//i;
const BIB_VOLUME = /\d{4}\s*[;,]\s*\d{1,3}\s*\(|\bvol\.?\s*\d/i;

/** Same test `scan-mentions.js` uses, kept here so the two cannot drift. */
function isReferencePage(pageLines) {
  let entries = 0, locators = 0;
  for (const l of pageLines) {
    if (BIB_ENTRY.test(l.text)) entries++;
    if (BIB_LOCATOR.test(l.text) || BIB_VOLUME.test(l.text)) locators++;
  }
  return entries >= 5 && entries >= pageLines.length * 0.08 && locators >= 2;
}

/* ------------------------------------------------------------------ */
/* 2. which entry is the applicant's paper                             */
/* ------------------------------------------------------------------ */

const norm = s => String(s == null ? "" : s)
  .toLowerCase()
  .normalize("NFKD")
  .replace(/[\u0300-\u036f]/g, "")
  .replace(/[^a-z0-9]+/g, " ")
  .trim();

/**
 * The distinctive middle of a title, as `scan-mentions.js` builds it for its
 * reference-entry detector: what follows the colon where a title has one, else
 * its first six words, minus a leading article.
 */
function titleCore(t) {
  const colon = String(t || "").indexOf(":");
  let words = (colon > 0 && colon < 40 ? String(t).slice(colon + 1) : String(t || ""))
    .split(/\s+/).filter(Boolean);
  while (words.length && /^(a|an|the)$/.test(words[0])) words = words.slice(1);
  return words.slice(0, 6);
}

/** What share of `want`'s core words appear in `entry`, in order-free set terms. */
function titleScore(entry, title) {
  const want = titleCore(title).map(w => norm(w)).filter(w => w.length > 2);
  if (want.length < 3) return 0;
  const have = new Set(norm(entry).split(" "));
  const hits = want.filter(w => have.has(w)).length;
  return hits / want.length;
}

/**
 * Every bibliography entry that could be the applicant's paper.
 *
 * Returns candidates ranked, each with the signals that put it there, so the
 * caller can refuse rather than guess. `year` and `author` are worth having: a
 * review that quotes a phrase from a title can reach a high title score on an
 * unrelated entry, and a second signal is what separates them.
 */
function matchReference(index, want) {
  const out = [];
  const wantYear = want.year ? String(want.year).slice(0, 4) : null;
  const surname = want.surname ? norm(want.surname) : null;
  for (const [num, entry] of index.byNumber) {
    const e = norm(entry);
    // A wrapped title arrives as "resour- ces"; score the entry as printed and with the
    // line-break hyphens removed, and take the better.
    const ts = Math.max(titleScore(entry, want.title),
      titleScore(String(entry).replace(/(\p{L})-\s+(?=\p{Ll})/gu, "$1"), want.title));
    // Online-first and print years differ by one (GlyGen: 2019 in the entry, 2020 in the catalog).
    const yearHit = !!wantYear && [0, 1, -1].some(d => new RegExp(`\\b${Number(wantYear) + d}\\b`).test(entry));
    const authorHit = !!surname && e.includes(surname);
    if (ts < 0.6) {
      // RSC, Nature-family and many chemistry journals print NO title: "M. D. Argade, A. Y. Mehta, A.
      // Sarkar and U. R. Desai, J. Med. Chem., 2014, 57, 6." With no title to compare, the entry is the
      // paper only when the first author, the year and at least two more of its authors all appear.
      const others = (want.coauthors || []).map(c => norm(c)).filter(c => c.length > 2);
      const hits = others.filter(c => new RegExp(`\\b${c.replace(/ +/g, "[ -]?")}\\b`).test(e)).length;
      if (authorHit && yearHit && others.length >= 2 && hits >= Math.min(3, others.length)) {
        out.push({ num, entry: String(entry).replace(/\s+/g, " ").trim(), titleScore: 0, yearHit, authorHit,
          byAuthors: true, certain: true });
      }
      continue;
    }
    out.push({
      num,
      entry: String(entry).replace(/\s+/g, " ").trim(),
      titleScore: Math.round(ts * 100) / 100,
      yearHit,
      authorHit,
      // Two signals besides the title, or a near-complete title plus one, settle it.
      certain: (ts >= 0.85 && (yearHit || authorHit)) || (ts >= 0.6 && yearHit && authorHit)
        // a near-complete title of six words needs no second signal: it is inside a reference list
        || (ts >= 0.95 && titleCore(want.title).length >= 6),
    });
  }
  return out.sort((a, b) => (b.certain - a.certain) || (b.titleScore - a.titleScore) || (a.num - b.num));
}

/* ------------------------------------------------------------------ */
/* 3. in-text markers                                                  */
/* ------------------------------------------------------------------ */

/**
 * Expand the inside of a bracketed run into the numbers it credits.
 *
 * Handles `[71]`, `[ 71 ]`, `5, 9, 71`, `125–127`, `125 - 127`, and mixtures such
 * as `5-7, 71`. Returns null for anything that is not purely a citation list, so
 * `[3H]`, `[Ca2+]`, `[CrossRef]`, `[PubMed]`, `[S1]` and `[10 mM HCl]` settle
 * nothing. A run spanning more than 40 numbers is a page or line range, not a
 * citation list, and is refused for the same reason.
 */
function expandRun(inner) {
  // Some Elsevier fonts typeset the en dash of a range as the letter e, so "[37–39]" extracts as
  // "[37e39]". Digit-e-digit inside a bracketed list is a range, not an exponent.
  const t = inner.trim().replace(/(\d)e(?=\d)/g, "$1–");
  if (!t || t.length > 60) return null;
  if (!/^[\d\s,;.–—−-]+$/.test(t)) return null;
  if (!/\d/.test(t)) return null;
  const nums = new Set();
  // Split on comma / semicolon, then read each piece as one number or a range.
  for (const piece of t.split(/[,;]/)) {
    const p = piece.trim();
    if (!p) continue;
    const rng = p.match(/^(\d{1,4})\s*[–—−-]\s*(\d{1,4})$/);
    if (rng) {
      const a = Number(rng[1]), b = Number(rng[2]);
      if (b < a || b - a > 40) return null;
      for (let n = a; n <= b; n++) nums.add(n);
      continue;
    }
    const one = p.match(/^(\d{1,4})$/);
    if (!one) return null;
    nums.add(Number(one[1]));
  }
  return nums.size ? [...nums].sort((x, y) => x - y) : null;
}

/**
 * Every bracketed or parenthesised citation marker in a line of text.
 *
 * Returned as { numbers, raw } where `raw` is what the page actually printed, so
 * a report can show "[125 – 127]" rather than assert a single reference.
 *
 * A number with NO brackets is accepted only where it stands at the end of the
 * line, which is what an extracted superscript looks like. Elsewhere a bare
 * number is genuinely ambiguous — `ε = 69,830`, `OD550`, `2018`, a page range —
 * and reading it as a citation would credit a sentence to the applicant's paper
 * that credits nothing. The cost of the restriction is a missed marker mid-
 * sentence; the cost of dropping it is a fabricated quotation in front of counsel.
 */
function findTextMarkers(text) {
  const out = [];
  const re = /([\[(])\s*([\de\s,;.–—−-]{1,60}?)\s*([\])])/g;
  let m;
  while ((m = re.exec(text))) {
    const nums = expandRun(m[2]);
    if (!nums) continue;
    out.push({ numbers: nums, raw: m[0], start: m.index });
  }
  // A trailing run of numbers, no brackets: "…as described previously 45".
  const tail = text.match(/(\d{1,4}(?:\s*[,\s–—−-]\s*\d{1,4})*)\s*[.,;]?$/);
  if (tail) {
    const before = text.slice(0, tail.index);
    // Require a real space before it, which is what excludes `OD550`, `CaCl2`,
    // `1569-050`, and a hyphenated catalogue number. Then exclude a value: a
    // number after `=`, `~`, `<`, `>` or `±` is a measurement, not a citation.
    const spaced = before === "" || /\s$/.test(before);
    const measured = /[=~<>±×]$/.test(before.replace(/\s+$/, ""));
    if (spaced && !measured) {
      const nums = expandRun(tail[1]);
      if (nums) out.push({ numbers: nums, raw: tail[1].trim(), start: tail.index, bare: true });
    }
  }
  return out;
}

/** The line holds nothing but numbers — an extracted superscript orphan. */
function isOrphanNumberLine(text) {
  return /^\d{1,4}(?:\s*[,\s–—−-]\s*\d{1,4})*$/.test(String(text).trim());
}

/**
 * Whether a line is prose a citation could attach to.
 *
 * An extracted superscript is only a mark if it follows a sentence. Without this,
 * a chart's y-axis labels — which pdf.js extracts as lines reading `0`, `10`,
 * `20`, `30` — are indistinguishable from a superscript `30`, and the search for
 * context walks back over them and quotes whatever prose happens to lie above the
 * figure. Measured on Knight 2026 p.14, where the axis tick `30` was credited to
 * GlycoGlyph as a Results-tier citation.
 *
 * Two tests, because they answer different questions:
 *   - `followsProse` asks whether the line ABOVE is a sentence rather than another
 *     digit. A citation attaches to prose; a run of digits is an axis, a table
 *     column, or page furniture, and no amount of looking further back makes it a
 *     citation.
 *   - `isProseLine` asks whether a line is substantial enough to QUOTE. A quote
 *     that reads "Inkscape for Fig. 5" is a fragment, and a fragment presented as
 *     evidence is worse than nothing because it looks like something.
 */
function followsProse(prevText) {
  const t = String(prevText || "").trim();
  if (!t) return false;
  if (isOrphanNumberLine(t)) return false;
  return /[A-Za-z]/.test(t) && !looksLikeTableOrCaption(t);
}

/**
 * Whether a line is a table row, a caption, or a heading rather than a sentence.
 *
 * Two shapes recur in the filed PDFs, both found by reading the page rather than
 * guessed: a row that opens with its index (`1 Antifreeze components >27 kD, pI
 * 4–8`, Afanasiev p.10) and a column of title-cased words (`Oral Health by Using
 * Probiotic Products`, Afanasiev p.6) that sits under a superscript. Either one
 * resolves a reference number and neither says anything about how the work was
 * used, so a marker attached to either is reported but never quoted as evidence.
 */
function looksLikeTableOrCaption(t) {
  if (/^\d{1,3}[\s\u00a0]/.test(t)) return true;
  const words = t.split(/\s+/).filter(w => /[A-Za-z]/.test(w));
  if (words.length < 4) return false;
  const caps = words.filter(w => /^[A-Z\u00C0-\u024F]/.test(w.replace(/^[^\w]+/, ""))).length;
  return caps / words.length >= 0.75;
}

function isProseLine(text) {
  const t = String(text || "").trim();
  if (!t || isOrphanNumberLine(t)) return false;
  const letters = (t.match(/[A-Za-z]/g) || []).length;
  if (letters < 20) return false;
  return !looksLikeTableOrCaption(t);
}

/**
 * Markers carried by a raised smaller number — a true superscript.
 *
 * This is how the Kiessling case is seen at all: the only in-text mark for the
 * MAWE paper is `unclear69.` where the `69` is drawn at 4.93 against a body of
 * 8.22 and lifted from baseline 424.79 to 428.26, glued to the word with no gap
 * at all. Height alone finds it but cannot tell it from a subscript, and a
 * chemical subscript (`CaCl2`, `Na2CO3`) is drawn at the same reduced size — so
 * the baseline is what separates them: a superscript sits ABOVE the body's
 * baseline, a subscript sits on or below it.
 *
 * Two shapes are accepted:
 *   - a run standing away from the preceding word (`…reusing slides 69`), and
 *   - a run glued to the end of a word (`…are unclear69`), which is what most
 *     journals actually typeset and what a word search can never see.
 * A glued run in the MIDDLE of a word is a subscript or part of a chemical name
 * and is refused, which the baseline test also catches.
 *
 * `line.items` must carry { str, h, base, x, w } as `extractPages` builds them.
 */
function findRaisedMarkers(rawLine) {
  if (!rawLine.items || rawLine.items.length < 2) return [];
  // A raised range is often extracted as three items ("19", "–", "23"). Join neighbours that share a
  // size and baseline and hold only digits and separators, so the run reads as one marker.
  const DIGITS_ONLY = /^[\d,;\s–—−-]+$/;
  const merged = [];
  for (const it of rawLine.items) {
    const last = merged[merged.length - 1];
    if (last && it.h > 0 && last.h > 0 && Math.abs(it.h - last.h) < 0.3 && Math.abs((it.base || 0) - (last.base || 0)) < 0.6
      && DIGITS_ONLY.test(it.str) && DIGITS_ONLY.test(last.str) && /\d/.test(it.str + last.str)) {
      last.str += it.str;
      last.w = (last.w || 0) + (it.w || 0);
    } else merged.push({ ...it });
  }
  const line = { ...rawLine, items: merged };
  if (!line.items || line.items.length < 2) return [];
  const heights = line.items.map(i => i.h).filter(h => h > 0);
  if (!heights.length) return [];
  // Body size = the height most items share, largest wins a tie. A median would
  // take the superscript's own height as the body on a two-item line and then
  // find nothing raised.
  const tally = new Map();
  for (const h of heights) tally.set(h, (tally.get(h) || 0) + 1);
  let body = 0, best = 0;
  for (const [h, n] of tally) {
    if (n > best || (n === best && h > body)) { body = h; best = n; }
  }
  // The line's own baseline: the baseline most body-size items share.
  const bases = new Map();
  for (const it of line.items) {
    if (Math.abs(it.h - body) > body * 0.08) continue;
    const k = Math.round(it.base || 0);
    bases.set(k, (bases.get(k) || 0) + 1);
  }
  let bodyBase = 0;
  let baseCount = 0;
  for (const [b, n] of bases) {
    if (n > baseCount || (n === baseCount && b < bodyBase)) { bodyBase = b; baseCount = n; }
  }
  const out = [];
  for (let i = 0; i < line.items.length; i++) {
    const it = line.items[i];
    if (!/^\s*\d{1,4}(?:\s*[,\s–—−-]\s*\d{1,4})*\s*$/.test(it.str)) continue;
    if (!(it.h > 0 && it.h < body * 0.85)) continue;
    // Must sit clearly above the body's baseline. 0.15 of the body height is far
    // below the 0.42 measured on the Kiessling superscript and far above the
    // jitter of items drawn on one baseline.
    const raised = bodyBase && (it.base || 0) > bodyBase + body * 0.15;
    if (!raised) continue;
    const prev = line.items[i - 1];
    const prevWord = !!prev && /[A-Za-z0-9]$/.test(prev.str);
    const gap = prev ? it.x - (prev.x + (prev.w || 0)) : Infinity;
    const separated = !prevWord || gap >= body * 0.25;
    if (!separated) {
      // Glued. Accept it only at the END of the line's text — `unclear69.` — so a
      // subscript inside a formula (`Na2CO3`) cannot be read as a citation.
      const next = line.items[i + 1];
      const endsLine = !next || !/[A-Za-z0-9]$/.test(String(next.str).replace(/^\s+/, ""));
      if (!endsLine) continue;
    }
    const nums = expandRun(it.str);
    if (!nums) continue;
    out.push({ numbers: nums, raw: it.str.trim(), superscript: true, glued: !separated });
  }
  return out;
}

/**
 * Every place `num` is credited in the article, bibliography excluded.
 *
 * Reference pages are skipped: the entry itself is not a use of the work, and a
 * number recurs constantly in a bibliography (publication years, volume and page
 * ranges) — that is where a false positive would come from.
 *
 * When the marker is an orphan line of digits, the sentence it belongs to ended
 * earlier — often on the previous page — so the quotation is taken from the
 * preceding prose line. That is the whole point of the exercise: counsel needs to
 * read what the citing authors said, not the number.
 *
 * Returns occurrences with `marker` as printed, `jointWith` naming the other
 * numbers credited with it, and `superscript`/`bare` saying how the mark was read.
 */
function findMarkers(pages, index, num, opts = {}) {
  const sentenceAround = typeof opts === "function" ? opts : (opts.sentenceAround || (t => t));
  const tablePages = (typeof opts === "function" ? null : opts.tablePages) || new Set();
  const flat = [];
  for (let p = 1; p <= pages.length; p++) {
    pages[p - 1].forEach((L, li) => flat.push({ page: p, li, ...L }));
  }
  // The reference list often starts part-way down a page that still carries body text above it.
  const inRefs = L => index.refPages.has(L.page)
    && !(index.refLineStart && L.page === index.refLineStart.page && L.li < index.refLineStart.li);
  // Running headers and footers ("V.S. Pokrovsky et al. Analytical Biochemistry 701 (2025) 115806", a
  // page number) repeat on every page. They are not prose: a number beside one is a page or volume
  // number, and quoting one as a sentence put a header in front of counsel as "Tier A, Methods".
  const furnKey = t => String(t).replace(/\d+/g, "#").replace(/\s+/g, " ").trim().toLowerCase();
  const furnPages = new Map();
  for (const L of flat) {
    if (L.text.length > 110) continue;
    const k = furnKey(L.text);
    if (!k) continue;
    if (!furnPages.has(k)) furnPages.set(k, new Set());
    furnPages.get(k).add(L.page);
  }
  const isFurniture = L => L.text.length <= 110 && (furnPages.get(furnKey(L.text)) || new Set()).size >= 3;
  const hits = [];
  flat.forEach((L, i) => {
    if (inRefs(L)) return;
    const orphan = isOrphanNumberLine(L.text);
    // An orphan digit line is matched once, as an orphan; findTextMarkers would
    // also see it as a trailing bare number and report the same mark twice.
    const marks = orphan && !tablePages.has(L.page)
      ? (expandRun(L.text) ? [{ numbers: expandRun(L.text), raw: L.text.trim(), start: 0, bare: true, orphan: true }] : [])
      : [...findTextMarkers(L.text), ...findRaisedMarkers(L)];
    for (const mk of marks) {
      if (!mk.numbers.includes(num)) continue;
      // Furniture is never a citation, and a lone number under furniture is a page number.
      if (isFurniture(L)) continue;
      if (mk.orphan && i > 0 && isFurniture(flat[i - 1])) continue;
      // The paper's own numbering style decides which brackets can be citations. In a "[3] Smith ..."
      // bibliography an in-text "(3)" is an enumeration, "(1) ... (2) ... (3)", never reference 3.
      const open = String(mk.raw || "").trim()[0];
      if (index.style === "bracket" && open === "(") continue;
      if (index.style === "paren" && open === "[") continue;
      // "(n)" with its neighbour "(n-1)" or "(n+1)" in the same stretch of text is a numbered list.
      if (open === "(" && mk.numbers.length === 1) {
        const near = [flat[i - 2], flat[i - 1], L, flat[i + 1], flat[i + 2]].filter(x => x && x.page === L.page).map(x => x.text).join(" ");
        const seen = [...near.matchAll(/\((\d{1,2})\)/g)].map(m => Number(m[1]));
        if (seen.includes(num - 1) || seen.includes(num + 1)) continue;
      }
      // The bibliography entry itself, when it lands on a non-reference page.
      if (!mk.bare && !mk.superscript && new RegExp(`^\\[?\\s*${num}\\s*(?:\\]|\\.)`).test(L.text)) return;
      let context = L.text;
      let contextPage = L.page;
      if (!mk.orphan) {
        // A sentence wraps over several printed lines, and the marker often sits on the last, short one
        // ("platelet aggregation [21]."). Quote the whole sentence: walk back over prose lines on the same
        // page until one ends a sentence, at most four, never into the reference list or a heading.
        const parts = [L.text];
        for (let j = i - 1, k = 0; j >= 0 && k < 4; j--, k++) {
          const q = flat[j];
          if (q.page !== L.page || inRefs(q)) break;
          if (/[.?!:]\s*$/.test(q.text) && !/\bet al\.$/.test(q.text)) break;
          if (isFurniture(q) || !followsProse(q.text) || isOrphanNumberLine(q.text)) break;
          parts.unshift(q.text);
        }
        // ...and forward: a marker mid-sentence ("properties (43), enhanced") leaves the sentence open at
        // the end of the line, so read on, up to three lines, until a sentence end.
        const markIdx = L.text.indexOf(mk.raw);
        const tail = markIdx >= 0 ? L.text.slice(markIdx + mk.raw.length) : "";
        if (!/[.?!]["”')\]]*\s*$/.test(L.text) && !/[.?!](?:\s|$)/.test(tail)) {
          for (let j = i + 1, k = 0; j < flat.length && k < 3; j++, k++) {
            const q = flat[j];
            if (q.page !== L.page || inRefs(q) || isFurniture(q) || isOrphanNumberLine(q.text) || !followsProse(q.text)) break;
            parts.push(q.text);
            if (/[.?!]["”')\]]*\s*$/.test(q.text) && !/\bet al\.\s*$/.test(q.text)) break;
          }
        }
        if (parts.length > 1) context = parts.join(" ");
      }
      if (mk.orphan) {
        // The digits sit alone, so the sentence is in the line above — but only if
        // the line above is prose. A digit line above means this is a chart axis or
        // a table column, and walking further back over it would quote a sentence
        // that has nothing to do with the number.
        const prev = i > 0 ? flat[i - 1] : null;
        if (!prev || inRefs(prev) || isFurniture(prev) || !followsProse(prev.text)) {
          mk.rejected = "no prose above";
          return;
        }
        // Take up to three prose lines above, so a sentence wrapped across them is
        // quoted whole rather than as a fragment. Stops at a page break, the
        // reference list, or another digit line.
        const parts = [];
        for (let j = i - 1; j >= 0 && parts.length < 3; j--) {
          const q = flat[j];
          if (q.page !== prev.page) break;
          if (inRefs(q)) break;
          if (isFurniture(q) || !followsProse(q.text)) break;
          parts.unshift(q.text);
        }
        context = parts.join(" ");
        contextPage = prev.page;
      }
      hits.push({
        page: L.page,
        marker: mk.raw,
        superscript: !!mk.superscript,
        glued: !!mk.glued,
        bare: !!mk.bare,
        orphan: !!orphan,
        numbers: mk.numbers,
        joint: mk.numbers.length > 1,
        jointWith: mk.numbers.filter(n => n !== num),
        text: L.text,
        // The prose the marker belongs to. For an orphan superscript line this is
        // the preceding prose line, not the digits, and a caller building a quote
        // must use it — the digits are not a sentence. `context_page` is where
        // that prose actually sits, which for an orphan is often the page before.
        context,
        context_page: contextPage,
        // Whether that prose is substantial enough to quote. A chart's axis labels
        // arrive as bare digit lines; the check above rejects an orphan sitting
        // under one, and this flags the weaker cases (a table cell, a figure label)
        // so a caller does not present a three-word fragment as evidence.
        context_is_prose: isProseLine(context),
        quote: sentenceAround(context).slice(0, 600),
      });
    }
  });
  return hits;
}

/* ------------------------------------------------------------------ */
/* 3b. author-year markers, for papers with no reference numbers       */
/* ------------------------------------------------------------------ */

/**
 * In-text citations of the form "(Mehta et al. 2024)".
 *
 * Not every journal numbers its references. Guérardel 2026 and both Heras files
 * use author-year throughout, so there is NO number to resolve and the whole
 * numbered path returns nothing — yet the paper is cited, twice, in prose, and
 * one of those citations names the GLAD dashboard. A scanner that only knows
 * numbered styles reports "no mention" on a citing article that cites the work
 * by name.
 *
 * The convention makes this precise rather than fuzzy: an author-year marker
 * always names the FIRST author, so first-author surname plus year is the key,
 * and it is the same pair the bibliography entry is filed under. Shapes covered:
 * `(Mehta et al. 2024)`, `(Mehta and Cummings 2019)`, `(Mehta & Cummings 2019)`,
 * `(Mehta et al., 2024)`, `Mehta et al. (2024)`, and a marker carrying several
 * years for one author.
 *
 * `coauthorHit` says whether a second surname of the cited work appears in the
 * marker. "Mehta and Cummings 2019" is as close to certain as prose gets;
 * "Mehta et al. 2024" rests on surname plus year alone, which a different
 * first author named Mehta publishing that same year could also satisfy. Both
 * are reported with the sentence so a person reads it, and the caller labels
 * which is which rather than presenting them as the same strength.
 */
function findAuthorYearMarkers(text, want) {
  const surname = norm(want.surname || "");
  const year = want.year ? String(want.year).slice(0, 4) : null;
  if (!surname || !year) return [];
  // A hyphenated surname is stored normalised ("heimburg molinaro") but printed
  // with the hyphen, so the separator has to be optional in the pattern. Without
  // this an author whose name carries a hyphen is never found, which silently
  // undercounts rather than overcounts — still wrong.
  const surnameRe = s => new RegExp(`\\b${String(s).replace(/ +/g, "[-\\s']?")}\\b`, "i");
  const others = (want.coauthors || []).map(c => norm(c)).filter(Boolean);
  const out = [];
  // Anything bracketed, or a bare "Surname ... (year)" in narrative position.
  const re = /[[(][^\]()[\]]{0,260}?[)\]]|\b[A-Z][A-Za-z'’-]+(?:\s+(?:et\s+al\.|and|&)\s+[A-Za-z'’&.\s-]{0,40})?\s*\(\d{4}[a-z]?\)/g;
  let m;
  while ((m = re.exec(text))) {
    const raw = m[0];
    if (!new RegExp(`\\b${year}[a-z]?\\b`).test(raw)) continue;
    if (!surnameRe(surname).test(raw)) continue;
    // A run of digits that is not the year (a volume, a page range) is fine, but
    // a marker whose only content is numbers is a numbered citation, not this.
    if (!/[A-Za-z]/.test(raw)) continue;
    const coauthorHit = others.some(c => surnameRe(c).test(raw));
    out.push({ raw: raw.trim(), surname, year, coauthorHit, index: m.index });
  }
  return out;
}

/**
 * Co-author surnames of the applicant's paper, for the corroboration above.
 *
 * The catalog renders Scholar's byline as "AY Mehta, RD Cummings", so a comma
 * split gives one entry per author and the last word of each is the surname.
 */
/** Generational suffixes Scholar leaves in a byline ("S Verespy III", "Doe Jr"): never a surname. */
const NAME_SUFFIX = /^(?:i{1,3}|iv|v|jr|sr|2nd|3rd|4th|phd|md)\.?$/i;
function surnameWord(chunk) {
  const words = String(chunk || "").trim().split(/\s+/).filter(Boolean);
  while (words.length > 1 && NAME_SUFFIX.test(words[words.length - 1])) words.pop();
  return words.pop();
}

function coauthorSurnames(authors) {
  return String(authors || "")
    .split(/,(?=\s*[A-Z])/)
    .map(s => surnameWord(s))
    .filter(Boolean)
    .slice(0, 8);
}

/**
 * Which pages are the reference list, by locator density rather than numbering.
 *
 * `isReferencePage` counts numbered entries, which an author-year list does not
 * have: Guérardel's reads "Akkouh, O., Ng, T., … 2015. Lectins with Anti-HIV
 * Activity: A Review. Molecules. 20(1):648–668. https://doi.org/…" and never
 * matched, so every "(Mehta et al. 2024)" inside the bibliography would have been
 * credited as an in-text citation.
 *
 * A reference list is still unmistakable from its contents — DOI URLs, PMID
 * labels, volume-and-page shapes — it just needs counting those instead of
 * numbers. A page that is one third bibliographic lines is the list; a prose page
 * that mentions a DOI in a Data Availability statement is not. The caller takes
 * the contiguous run starting at the first such page, which stops a figure legend
 * page or a table of URLs later in the paper being swept in.
 */
const LOCATOR = /(?:https?:\/\/\S|\bdoi\b|\bpmid\b|\bpmcid\b|\bISBN\b)|\b\d{1,4}\(\d{1,4}\)[:,-]\s*\d{1,5}|\bvol\.?\s*\d{1,4}\b|\b(?:pp?\.|no\.)\s*\d/i;
// "Surname, A. B., … 2015." — an author list opening a line and a year inside it.
const ENTRY_LIKE = /^[A-Z][A-Za-z'’-]+[,.][^\n]{0,120}?\b(?:19|20)\d{2}[a-z]?\b/;

function locatorDensity(lines) {
  if (!lines.length) return 0;
  let n = 0;
  for (const L of lines) if (LOCATOR.test(L.text) || ENTRY_LIKE.test(L.text)) n++;
  return n / lines.length;
}

function findReferenceBlockPages(pages, minDensity = 0.3) {
  const first = pages.findIndex(lines => locatorDensity(lines) >= minDensity);
  if (first < 0) return new Set();
  const set = new Set();
  for (let i = first; i < pages.length; i++) {
    // Allow a thin page inside the list (a short final page) but stop at a page
    // that clearly returns to prose, so an appendix of URLs is not swept in.
    if (i > first && locatorDensity(pages[i]) < 0.12) break;
    set.add(i + 1);
  }
  return set;
}

/**
 * Every author-year citation of the applicant's paper, bibliography excluded.
 *
 * Mirrors `findMarkers` so a caller handles both styles with the same code: same
 * `page` / `context` / `context_page` / `quote` fields, same rule that the quote
 * is the prose the marker sits in. `certain` here means a co-author's surname
 * also appears in the marker, which is the strongest evidence prose can give.
 */
function findAuthorYearCitations(pages, want, opts = {}) {
  const sentenceAround = typeof opts === "function" ? opts : (opts.sentenceAround || (t => t));
  const skipPages = (typeof opts === "function" ? null : opts.skipPages) || new Set();
  const hits = [];
  for (let p = 1; p <= pages.length; p++) {
    if (skipPages.has(p)) continue;
    const lines = pages[p - 1];
    lines.forEach((L, i) => {
      // A marker can break across a printed line: "(Mehta" / "et al. 2016)". Search this line joined
      // to the next, and keep only markers that START on this line so none is counted twice.
      const next = [1, 2, 3].map(d => (lines[i + d] ? lines[i + d].text : "")).filter(Boolean).join(" ");
      const joined = next ? `${L.text} ${next}` : L.text;
      for (const mk of findAuthorYearMarkers(joined, want)) {
        if (mk.index >= L.text.length) continue;
        // The sentence wraps over lines too: take prose lines above until one ends a sentence.
        const parts = [joined];
        for (let j = i - 1, k = 0; j >= 0 && k < 4; j--, k++) {
          const q = lines[j].text;
          if (/[.?!:]\s*$/.test(q) && !/\bet al\.$/.test(q)) break;
          if (!followsProse(q) || isOrphanNumberLine(q)) break;
          parts.unshift(q);
        }
        const context = parts.join(" ");
        hits.push({
          page: p,
          marker: mk.raw,
          certain: mk.coauthorHit,
          style: "author-year",
          text: L.text,
          context,
          context_page: p,
          context_is_prose: isProseLine(context),
          quote: sentenceAround(context).slice(0, 600),
        });
      }
    });
  }
  return hits;
}

/* ------------------------------------------------------------------ */
/* 4. the identity of the applicant's paper, per cited work            */
/* ------------------------------------------------------------------ */

/**
 * First author's surname of the applicant's paper, from the record's byline.
 *
 * "AY Mehta, RD Cummings" -> "mehta". The record stores the surname last, which
 * is what a bibliography repeats, so this is the form worth matching against.
 * Returns null when the byline is missing or unparseable, and the caller then
 * relies on title plus year alone and says so.
 */
function firstSurname(authors) {
  const first = String(authors || "").split(",")[0];
  if (!first) return null;
  const words = first.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return null;
  // "Mehta, A.Y." is already surname-first; "AY Mehta" is not. Take the last word
  // unless a comma already did the work.
  const last = surnameWord(first);
  return /[A-Za-z]/.test(last) ? norm(last) : null;
}

module.exports = {
  buildReferenceIndex,
  isReferencePage,
  locatorDensity,
  findReferenceBlockPages,
  matchReference,
  titleScore,
  titleCore,
  expandRun,
  findTextMarkers,
  findRaisedMarkers,
  findMarkers,
  findAuthorYearMarkers,
  findAuthorYearCitations,
  coauthorSurnames,
  firstSurname,
  isProseLine,
  followsProse,
  norm,
};

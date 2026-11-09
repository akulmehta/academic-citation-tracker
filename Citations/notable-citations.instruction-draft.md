# Notable Citations — Instructions for Building the Lawyer Packet

**Purpose.** Package the strongest citations to Akul Mehta's work into a single, self-contained
folder that can be zipped and handed to counsel, with a printable HTML summary and a direct link
from every entry to the PDF of the citing article.

**Scope of this file.** These are instructions, not the deliverable. They define the source of
truth, the screening rules, the field list, and the shape of the output so that the packet can be
built and re-built reproducibly. Nothing here should be filed as evidence; the packet is a
presentation of evidence that lives elsewhere in the repository.

---

## 0. Separate from the Independent Citation Record

**This effort is separate from the Independent Citation Record. Read from it freely; write to it
not at all.**

The record is the filing evidence: `Independent Citation Record/` (the guide, `Exhibits/`,
`Progress Tracker.json`), `Database/citation-catalog.sqlite`, and the `dashboard/` it feeds. It has
its own rules, its own audit chain, and a reconciliation gate that fails loudly when two of its
projections disagree. This packet is a presentation for counsel built on top of it. Nothing in this
effort may change what the record says, and nothing in this packet may be presented as if it had
settled something in the record.

**Write only inside:**

```
Citations/Notable Citations Packet/     ← the packet, its database and its CSVs
Citations/                              ← packet working files, if needed
```

**Never run from this effort** — each of these writes into the record:

| Tool | What it would change |
|---|---|
| `tools/apply-decision.js` | Verdicts, report JSON, exhibit re-print, store rebuild |
| `tools/build-catalog.js --write` | `citation-catalog.sqlite` |
| `tools/build-ledger.js` | The dated ledger CSV/JSON and its history |
| `tools/reprint-exhibits.js --write` | Filed exhibit HTML and PDFs |
| `tools/reapply-language.js`, `tools/reapply-corroboration.js` | Saved per-page report data |
| `tools/refetch-corroboration.js` | Corroboration state on queued rows |
| `tools/build-dashboard-data.js`, `tools/build-review-sheet.js` | Dashboard data, review sheet |
| `tools/capture*.js`, `tools/list-all-publications.js` | Contacts Scholar and writes captures |
| `tools/test-catalog-merge.js` | **Writes to the real store even with no `--write` flag** |

**Safe to read:** `tools/query-catalog.js`, `tools/tally.js`, the dated ledger CSV, the exhibit
PDFs, and `tools/parse-citation-summary.js` (it opens the store `readOnly: true` and writes only
`Citations/Citation-summary.md`).

**Where this effort's own state goes.** Do not log packet work in
`Independent Citation Record/Progress Tracker.json` — that is the record's checkpoint, and a
progress line is a write. Keep packet status in
`Citations/Notable Citations Packet/PACKET-STATUS.md`.

**If the packet reveals a problem in the record** — a duplicate listing that should be folded, a
row misclassified, a highlight that disagrees with the rule — **do not fix it here.** Record it in
`PACKET-STATUS.md` under *Open items for the citation record* and raise it separately, where the
record's own tools and audit chain can be run in the correct order. A fix applied from this side
would bypass the audit and leave the packet's figures and the filed exhibits disagreeing.

---

## 1. Why these citations were selected

USCIS values **how** a paper cites over **who** wrote it. A citation is notable because of what
the citing authors *did* with the work, not because it appears in a well-known journal.

Rank the evidence in this order:

1. **Implemented** — the citing paper used one of my methods, techniques, processes, or models.
2. **Compared** — the citing paper compared my work against an alternative and showed mine
   superior.
3. **Built upon** — the citing paper used my work to develop an improved technology, treatment,
   or method.
4. **Verified** — the citing paper independently verified, reproduced, or confirmed my results.

Other significant forms of citation also count: patents, government and technical reports,
clinical trials, and field guidelines. Citations from government institutions or private industry
carry extra weight.

Frequency and length matter. One sentence naming several papers is low value. Several of my
studies discussed at length is high value.

Full instructions are available as a PDF at `Citations\Citation Example Instructions.pdf`

### 1.1 Where the citation appears decides its value

**A Methods-section use is the ideal evidence.** A tool named in Methods means the citing authors
actually used it. A Results or Figures use is next best. A passing mention in an Introduction or
Discussion is weak and is included only when it says something substantive about the work. A
mention in Acknowledgements is not a use of the tool at all; those articles sit in
`Citations/In Acknowledgements/` and are not packet material.

So the ranking, from strongest to weakest:

| Tier | Location in the citing paper | Folder | Meaning |
|---|---|---|---|
| A | Materials and Methods | `Citations/In Methods/` | The tool was used. |
| B | Results / Figures | `Citations/In Results and Figures/` | The tool produced the reported data. |
| C | Introduction / Discussion | `Citations/In high reputation Publication/` | The work is acknowledged as relevant; included when the venue or the substance justifies it. |
| D | Acknowledgements | `Citations/In Acknowledgements/` | A courtesy, not a use. Not packet material. |
| — | screened out | `screened-papers/` (packet root, §5.1) | Passing mentions and other weak rows. Not packet material. |

The folder a PDF sits in records where its citation was found, so the tier can start from the
folder — but confirm it against the article text before relying on it (§2).

**A citing work is filed at the strongest tier any of its citations earns** (applicant instruction,
2026-11-08: *always choose the higher tier*). One article often cites several of the applicant's
works, and the tiers can differ: it may use GLAD in Materials and Methods while mentioning a paper
only in its Discussion. Ranking the work at its weakest citation would hide the strongest evidence.
Each row keeps its own tier and its own location; the higher tier is the headline the work is filed
under.

Where that reading disagrees with the folder the PDF was filed in, record the decision rather than
editing the tier and leaving the gap unexplained:

```
node scripts/record-tier-decision.js --row=cit-000542 --tier=A \
  --note="the citing article runs the tool in Materials and Methods p.5" --write --reprint
```

`tier_decision` is a separate column so the applicant's reading stays visible next to the value the
importer inferred, and `--revert` takes it off again. `headlineTier()` in `scripts/lib.js` is the one
place the rule is computed; `validate-packet.js` skips its tier-vs-folder check on any row carrying a
recorded decision. Never overwrite `tier` to match a decision, and never move a PDF between folders to
make the two agree — the folder records where the file was found.

Journals head the Methods section in many different ways — `Methods`, `Materials and methods`,
`Material and Methods` (singular), `4 | MATERIALS AND METHODS`, `Experimental procedures`, and
letterspaced forms such as `2 | M E T H O D S`. Do not conclude a paper has no Methods section
because a simple text match failed.

A tier only ranks a work that is already eligible. Before a candidate earns any tier, it must pass
the screens in §1.2, the first of which is that the citing work is a primary research article.

### 1.2 Screen these out

Screening decides what the packet *contains*. It does not decide what the record *keeps*: every
candidate below still gets a row with its reason (§4.5).

- **Citing works that are not primary research articles.** Applicant instruction, 2026-11-08:
  *when collecting notable citations, avoid non-research articles like theses and review articles —
  narrow the scope to research articles, i.e. those having experimental methods and results.* So the
  packet collects only original research reports. Excluded: theses and dissertations, review
  articles, and by the same logic conference-abstract supplements, editorials, commentaries, and
  book chapters. A preprint is judged on what it contains, not on being a preprint — a research
  article posted to bioRxiv stays in scope, a review-style preprint does not.
  - **The work type decides eligibility; the tier does not.** A dissertation that runs the tool in
    its Materials and Methods earns a tier A location and is still screened out. A strong tier is
    never an argument for keeping an ineligible work type.
  - **Nothing stored tells you the type.** `candidate.work_type` and `citation.citing_article_type`
    read `article` for every row in the packet database and neither column is validated, so a
    dissertation is indistinguishable from a journal article in the data. Judge the type from the
    source and the file, not from those fields.
  - **The word "review" means two unrelated things here. Never conflate them.** In the Independent
    Citation Record, `REVIEW` is a *status* meaning "a person has to look at this row" —
    `candidate.status` can literally read `REVIEW` for an ordinary research article, and it says
    nothing about article type. What this screen excludes is a **review article**: secondary
    literature that surveys other people's work and reports no experimental Methods and Results of
    its own. Applicant instruction, 2026-11-08. Write the reason as `review article`, never as a
    bare `review`, and never classify a row from the word appearing anywhere in the record's data.
  - **How to tell, with three routes — no single one covers every row.** Use
    `node scripts/work-type-report.js [--cites=<id>] [--only=…]`, which is read-only, consults all
    three, and prints the evidence per row.
    1. **The filed PDF's own shape** (`scripts/article-shape.js`) — strongest, since it is the
       document being filed: does it carry Methods *and* Results headings, does page 1 carry a
       type label, is it a thesis. Only available for rows with a file on disk.
    2. **OpenAlex `type`**, accepted only when the returned record is demonstrably the same work.
       Measured 2026-11-08 on the GlycoGlyph queue: OpenAlex typed `review` on ten rows and was
       right on all ten, including two published in ordinary research journals (*Glycobiology*,
       *Biomacromolecules*) where the venue alone says nothing. It is reliable — but it indexes
       only part of this corpus, so it cannot be the only route.
    3. **PubMed MeSH publication types** (E-utilities `esearch` + `efetch`) — the alternative for
       rows OpenAlex lacks, and the corroborating source for rows it has. Indexers assign `Review`
       from the article itself. `esummary` returns no publication types; use `efetch` XML.
       **A title search needs the same credibility guard OpenAlex needs**: searching
       `FUT8 alpha-(1,6)-fucosyltransferase in cancer` returned a *different* article in *Int J
       Surg* which is a review, and would have screened out the wrong paper.
    4. **Where the link points and what the venue publishes** — dissertation repositories
       (`theses.hal.science`, `repository.cam.ac.uk`, `ora.ox.ac.uk`, `*.scholaris.ca`, `freidok.`,
       `ediss.*`), ProQuest `&diss=y`, `api.taylorfrancis.com/content/chapters`, a poster on a
       vendor hub, and review-only journals (*Trends in…*, *Current Opinion…*, *…Research Reviews*).
       Verify a repository host by reading its abstract page — "This thesis describes…" settles it,
       and a repository can also hold an accepted manuscript of a real article.
  - **What the PDF route can get wrong, and why it needs the checks it has.** A page-1 type label is
    often the only signal (`REVIEW`, `INVITED REVIEW`, `Review Open Access`), and publishers set it
    with letterspacing (`O R I G I N A L  A R T I C L E`) or an access badge appended, so labels are
    matched with all whitespace removed and badges stripped. Manuscripts with continuous line
    numbering print the number flush to the heading (`Material and Methods120`), and a page break can
    land mid-line and bury it. Match `\bthesis\b` with word boundaries — without them the test
    matched "hypo**thesis**" and "syn**thesis**" and called eight ordinary research articles theses,
    six of them already in the packet. A heading is Title Case or capitals and short; a wrapped body
    line that happens to break after the word ("…tools and methods.") is not one.
  - **A heading called "Methods" is not proof of a research article.** `cit-000625` ("Computational
    tools for drawing, building and displaying carbohydrates: a visual guide") has a `Methods`
    heading, and OpenAlex, PubMed and the page-1 label all say review. Reading it settled it: the
    heading sits under a *Review* section banner and describes how the authors searched for existing
    tools. Where routes disagree, read the page; do not let a keyword decide.
  - Found this way on the MAWE queue: `cit-001263` is a Queen's University MSc thesis whose §2.6
    cites MAWE under "Materials and Methods" (tier A), and `cit-001262` is a *Human Immunology*
    review with no Methods section. Both are screened out on work type.
  - **The download identity gate cannot catch a thesis, and never will.** A thesis and the journal
    article it came from share a title, so the 45-char verbatim prefix test in
    `archived-scripts/title-gate.cjs` passes a dissertation `VERBATIM` — which is exactly what it did
    for all eight theses retrieved on 2026-11-09, every one of which Scholar had typed `article`.
    Only **page 1** of the file reveals *"Dissertation zur Erlangung…"*, *"A thesis submitted"*, or
    *"PhD thesis"*. Read page 1 before marking a row `downloaded`; `scripts/article-shape.js` does
    this and is the tool to call.
  - Screening is not deleting. The row keeps its `status = 'screened-out'` and this reason, and
    `node scripts/relocate-pdfs.js --write` moves its PDF to the packet's `screened-papers/` root
    (§5.1) — **not** to `Citations/low-value/`. Those are two different places doing two different
    jobs: `Citations/low-value/` is a folder in the manually filed `Citations/` tree and holds three
    PDFs nobody cataloged into the packet, while `screened-papers/` is one of the packet's three
    storage roots and is where `relocate-pdfs.js` and the `pdf-root` validator check put a
    screened-out folder. Nothing in `scripts/` writes to `low-value/`.
- **Citations from academia.edu are screened out and never downloaded** (applicant instruction,
  2026-11-09). A single author uploads an academia.edu page naming only themselves, Google Scholar
  indexes the citation with that one name, and the row therefore reads as independent when the real
  paper shares an author with the cited work. `cit-000244` / PMC5248960 is the case that found it.
  The status `skipped-academia` exists in `download_attempt` for exactly this; mark such a row and do
  not spend a browser session on it.
- **Citations that are not independent.** This is the first screen, before any reading of the
  article. A citation counts only when the citing paper and the cited paper share no author, and
  per the applicant's standing instruction any paper naming Richard D. Cummings or Umesh R. Desai
  is a self-citation and never independent — even a paper the applicant did not co-author.
  **Only independent citations may be pursued for this packet.** The candidate list is seeded from
  the record's highlighted rows (`is_highlighted = 1`), which is the record's own statement of
  independence.
  - **The seed is a snapshot and can go stale.** The record re-classifies rows as corroboration
    arrives, so re-check before filing rather than trusting the snapshot. Found on `cit-000511`
    ("Development of smart anti-glycan reagents using immunized lampreys"): the packet's candidate
    row still read `INDEPENDENT`/highlighted, while the record had since resolved it `DEPENDENT`
    with `confirm_state = 'external-resolved'` — its full byline ends **Cummings RD**, an author of
    the cited GLAD paper. It was never filed, because `screen_state = 'held'` kept it out of
    `packet.html`, but the row in `candidate` is stale and must not be promoted on its face.
  - Judge independence from the **complete** byline, surname plus initials, and resolve an
    abbreviated list ("… and others") from an external record that publishes the full list. A
    truncated list is not evidence that nobody is on the paper.
  - Reading the article is expensive. Check independence *before* downloading a PDF and before
    drafting any prose about it, or the work is wasted on a row that can never be filed.
- **Negative citations.** Anything noting a limitation or drawback of my work, and anything where
  the authors claim to surpass it. These weaken the petition. Flag them; do not include them.
- **Citations already used in the original petition.** See §3.
- **Non-English entries.** No certified translations have been obtained, so a non-English citing
  article cannot be filed. Exclude them and say so in the packet rather than presenting an
  untranslated quote.
- **Passing mentions** with nothing substantive to quote.

### 1.3 Do not overstate

A reference to a tool in a Methods section proves the tool was referenced there; it does not by
itself prove it was used to produce the paper's results. Read the sentence. A hedge such as
"the facility began regenerating slides; the long-term effects remain unclear" is not the same
evidence as "we performed MAWE as previously described." Where the strength of the use is
ambiguous, record what the sentence actually says and let counsel decide.

---

## 2. Locate and read the PDFs

For each candidate, parse the PDF and use your judgement to determine the **exact location and
context** of every citation. Record the section and the page.

Text extraction from these files works and the library **is** installed: `pdfjs-dist` is a
dependency of the packet's own `package.json` (4.10.38 as of 2026-11-09) and `node_modules/` sits in
the packet folder. **Keep it there, not under `tools/`** — adding a dependency to
`tools/package.json` would change the toolchain the Independent Citation Record runs on (§0).
`node_modules/` is already git-ignored repo-wide (`.gitignore`), so the install stays out of the
commit. Use `scripts/pdf-text.js`, which wraps
`pdfjs-dist/legacy/build/pdf.mjs`, `getDocument({ data, useSystemFonts: true, isEvalSupported:
false })`, and groups each page's items by their y-ordinate into lines; call it rather than
re-implementing the grouping. The raw `zlib.inflateSync`
shortcut does not work, because the journals embed subset fonts and it returns glyph indices instead
of characters. `Required "glyf" table is not found` and `TT: undefined function` warnings during
extraction are cosmetic.

Two traps, both encountered on files already in this folder:

- **A tool can be cited by reference number alone.** A Methods paragraph may end in a bare
  superscript pointing at the tool rather than naming it. Searching the text for "MAWE" or "GLAD"
  will then find only the reference list and wrongly suggest the tool was never used in Methods.
  See §2.1 — this is the common case, not an edge case.
- **A heading may be letterspaced or numbered**, so a naive `^Methods$` match fails. See §1.1.

Do not classify a folder from a filename. The folder a PDF sits in is a claim about the article,
and it must be checked against the article.

### 2.1 A citation that never names the tool

(Applicant instruction, 2026-11-09: find the citation by its **reference number** in the PDF, then
read the text where that number appears, including ranges such as `[5-9]`.)

A citing author who used GLAD or MAWE often writes neither name in the body. Two shapes cause it,
and both were found in the stored PDFs rather than imagined:

- **Numbered** — `following established procedures [125–127]`, `(49)`, or a bare superscript
  typeset tight against a word. In the Kiessling article the *only* in-text mark for MAWE is a
  superscript `69` after the word "unclear"; the string "MAWE" appears nowhere outside the
  reference list, so a text search for the tool name reports nothing.
- **Author–year** — `(Mehta et al. 2024)`, `(Mehta & Cummings, 2019)`. There is no number to
  resolve at all, and **six filed PDFs have no numbered bibliography whatsoever**, so a
  number-only resolver would find nothing in a quarter of the corpus.

`scripts/scan-refs.js` resolves both. It first decides *which* bibliography entry is the
applicant's paper — matching on title, year and first author, **two signals required, never a
guess** — and only then reports every place that number, or that surname-and-year, is credited,
with the section the citing paper printed and the sentence the marker sits in.
`scripts/ref-cites.js` is the single resolver; no caller may re-implement marker parsing, and
`parseNumbered` is not exported precisely so a caller cannot skip the author–year style and
silently under-report.

**A resolved citation is held to exactly the same bar as one that names the tool.** It must sit in
prose, under a heading the citing paper itself printed, and *not* in the bibliography entry that
names the applicant's paper — a reference list proves only that the author cited the work, not
where or how, and quoting the reference list would manufacture a Methods use out of a citation.
Ranges are resolved, not guessed: `[125–127]` credits three works, and each of the three is
checked separately rather than the range being credited to whichever one is being looked for.

A marker is reported but **never quoted** when it is not attached to a sentence. Three tests, each
derived from a real false positive rather than invented:

| Test | Question it answers | What it kills |
|---|---|---|
| `followsProse` | is the line *above* a sentence at all? | a chart axis — `0 10 20 30`, where the tick `30` looked like a reference |
| `looksLikeTableOrCaption` | is this line a table row or caption? | `1 Antifreeze components >27 kD, pI 4–8` (a row opening with its index); a title-cased column heading |
| `isProseLine` | is this line substantial enough to *quote*? | short fragments, `Inkscape for Fig. 5` |

Replacing a weaker test with a stronger one changed nothing about which citations are real — it
only removed two sentences that were never sentences. **Do not conclude a citation is weak from a
fragment**; check whether the marked text is prose at all.

Recording the result has a destructive trap in it. **`record-mentions.js --from=X` replaces every
mention already filed for a row**, and the resolution spec covers only citations that name no
tool. Feeding it that spec directly would silently delete the named-tool mentions beside it. Use
`scripts/merge-ref-mentions.js`, which reads each row's existing mentions, keeps them, and appends
only a resolved citation whose quote shares no normalised sentence with anything already recorded.
`sameSentence()` lives in `scripts/lib.js` as the single definition of "the same sentence" — do not
re-implement it in a caller.

`scan-mentions.js` cannot see any of this, because it scans for literal tool names. It now reports
a row whose tier rests on a resolved or human mention as *backed by evidence this scan cannot see*,
instead of calling it unsupported, and it leaves that row's tier alone. **A scanner's silence is
not evidence against a citation it was never built to find** — and clearing a `held` row's tier
because its own scan came back empty was a real bug this fixed.

`node scripts/test-ref-cites.js` is the check (64 assertions, every one drawn from a string in a
stored PDF: each positive is a marker that really occurs, each negative is a molar extinction
coefficient, a wavelength, a publication year, a page range, or an ion concentration).

### 2.2 How a PDF gets fetched

Order of preference, cheapest and least intrusive first:

1. **`scripts/discover-pdfs.js --fetch`** for a genuinely open copy (publisher OA, PMC, a
   repository). This is reproducible from a script and needs nothing from the applicant.
2. **The Playwright MCP attached to the applicant's desktop Chrome** (`--extension`, the
   [Playwright Extension](https://chromewebstore.google.com/detail/playwright-extension/mmlmfjhmonkocbjadbfplnigmagldckm)).
   This reuses their logged-in sessions and installed extensions, which is what makes a
   subscription-only article reachable. It is *their* browser: navigate deliberately, download
   only the file asked for, and leave the session as found. `channel: chrome` alone launches a
   clean profile and is **not** logged in — that distinction cost a session's worth of confusion
   when a paywalled page looked like a broken proxy.
3. **The Harvard libraries proxy**, for a paper the applicant's institution subscribes to. In the
   Playwright Chrome window, the bookmark to use is:

   ```
   javascript:void(location.href="https://go.openathens.net/redirector/library.harvard.edu?url="+location.href)
   ```

   Navigate to the article page first, then run it with the article URL as the target. Measured on
   2026-11-09: it works on ScienceDirect, where the direct article page is otherwise blocked, and
   returns **403 on Oxford University Press** — a failed proxy is a finding about access, not about
   the paper.
4. **Ask the applicant.** Cloudflare interstitials on Chrome are cleared by a human, not by a
   retry loop. Stop, say what appeared and on which URL, and wait. Downloads land in the Windows
   `Downloads` folder; move them into the packet's storage root and record the host they came from.

A throttled or failed look-up must never be recorded as "not indexed" (§5.6). Access outcomes are
about access.

**Getting the bytes out of the browser.** The MCP's Playwright context runs with
`acceptDownloads: false`, so `download.saveAs()` and `download.path()` both throw *"canceled"* no
matter what the applicant sets in Chrome's own download settings, and no `downloadsPath`,
safe-browsing flag, or "ask where to save" change fixes it. Two routes work, in this order:

1. **Let Chrome write the file itself, over CDP.** On the page's CDP session send
   `Browser.setDownloadBehavior` with `{behavior: 'allow', downloadPath: '<absolute folder>',
   eventsEnabled: true}`, then navigate. Chrome saves to that folder on its own and Playwright
   never intercepts, so there is nothing to cancel. Re-assert it on each new CDP session. This is
   how the JHU and RUN UNL dissertation bitstreams and the ScienceDirect article came through.
2. **Fetch inside the page and return base64.** `browser_evaluate` with a `filename` writing
   `STATUS=… SIZE=… B64=…`, then `scripts/decode-capture.js`, which refuses unless the status is
   200, the bytes start `%PDF`, the length matches `SIZE=`, and `%%EOF` is present. Use
   `fetch(url, {credentials: 'include'})` **inside** the page — `page.request.get` does not share
   the browser's cookies, so a gated host answers 403 to it and 200 to the page. This is how
   PMC7214107 (`cit-000541`) came through.

PMC guards a PDF with a proof-of-work plus reCAPTCHA that the page's own JavaScript passes; drive
the click through the browser rather than fetching the URL. As of 2026-11-09 these hosts sit behind
a Cloudflare interstitial (page title *"Just a moment…"*, HTTP 403) and need the applicant:
`pubs.acs.org`, `academic.oup.com`, `mcponline.org`, `journals.sagepub.com`, `rpthjournal.org`,
`science.org`, `jbc.org`, `cell.com`, `ahajournals.org`, `ard.eular.org`, `thrombosisresearch.com`,
`ingentaconnect`, `benthamdirect` (which reports *"restricted by your organization"*), and `ovid`
(OpenAthens 400).

**Every retrieval outcome goes into `scripts/download-queue.js` — it is the only writer of queue
state.** The table is `download_attempt` (one row per `row_uid`: `url`, `host`, `status`, `note`,
`attempted_on`), and its `CHECK` allows exactly `downloaded`, `walled`, `no-open-copy`,
`skipped-preprint`, `skipped-thesis`, `skipped-book`, `skipped-academia`, `failed`. Mark with
`node scripts/download-queue.js --mark=<uid>=<status> --note="…"` and re-export with `--export`.
An attempt that is left unmarked is an attempt that did not happen: the next session repeats it.

- **Check the shelf before fetching anything.** `heldPdfIndex(db)` in `scripts/lib.js` takes the
  *open database handle* and returns a predicate; `held(uid, row)` answers whether a PDF for that row
  is already filed somewhere. It is not enough to consult `download_attempt`, because a row can hold
  a PDF and carry no mark at all — three papers were re-fetched on 2026-11-09 that way and were
  caught only by comparing MD5s.
- **Never delete a downloaded PDF — move it.** A thesis or preprint that gets screened out on work
  type still goes to `pending-papers/<uid>/`, because the alternative is that a future wave downloads
  it again. By the same logic `cit-000380` keeps a byte-identical copy of `cit-001220` **on
  purpose**: delete it and `heldPdfIndex()` reports that row unheld, so the next session re-fetches
  it and calls the duplicate a new find.
- **`citation_pdf_url` is the canonical route to the file** — it is what a reader's "Download PDF"
  follows. Guessing paths is what produced the false `no-pdf-bytes` results. Wiley is the trap: its
  real endpoint is `/doi/pdfdirect/<doi>`, while `/doi/pdf/` and `/doi/epdf/` return `text/html`
  shells, and Wiley rejects a bare DOI in the URL entirely — use `/doi/abs/<doi>`.
- **OpenAthens status codes mean different things.** A **404** means the host is absent from its
  knowledge base: fall back to the direct route. A **403 "The redirector is not enabled for the
  specified customer domain"** and a **400** are genuine refusals — `nature.com` and `jove.com` are
  the former and `ovid` the latter, so no amount of retrying or re-authenticating reaches them.
  Record the reason verbatim in the `note` so nobody re-tries the same wall.
- **A 403 names the host, not the platform.** `figshare.mq.edu.au` and RMIT's `ndownloader` refuse a
  plain node GET while other hosts on the same platform serve the file. Probe the specific URL.
- **A URL-fragment tab marker is destroyed by the first navigation.** Tags like `#sdrwork` added to
  a tab's URL to label it are gone as soon as the page navigates, so a driver that re-filters tabs on
  the marker silently finds zero tabs and reports success having done nothing. Select tabs by
  exclusion, and use one worker per tab.
- **`btoa(String.fromCharCode(...b))` stack-overflows on multi-MB arrays.** Chunk at `0x8000`.
- **A look-up that did not complete is not a finding that no copy exists.** Never mark
  `no-open-copy` after a throttled or failed request.

The scratch helpers built for the 2026-11-08/09 wave live in `archived-scripts/` (git-ignored;
`archived-scripts/README.md` is the tracked index of what is there and what is defective):
`repofetch.cjs` fetches node-side the rows whose `citing_url` is already a direct file endpoint, and
`title-gate.cjs` is the identity check to run after every download and before marking — a verbatim
45-char prefix, else ≥80% distinctive-word overlap, reading `r.text` rather than `r.pages`.
`residual-buckets.cjs` categorises the rows still sitting at `no-open-copy` **from
`download-queue.csv`**; do not use `never-tried.cjs` or `residual-report.cjs`, which re-derive
`classify()` instead of reading the queue and report the pool as 360 when it is 123. The full state
of that stage, including which 319 rows gained a PDF and by what route, is in
[`HANDOVER-PDF-RETRIEVAL.md`](./Notable%20Citations%20Packet/HANDOVER-PDF-RETRIEVAL.md).

**A repository deposit is not the row's title.** A bitstream's own `<meta citation_title>` decides
what the file is; the landing-page title may name a different article. `cit-000560`'s record reads
*"CarbArrayART – An update…"* while its deposited file is `cwac018`, which is `cit-000543`'s paper —
and `cit-000562` holds the same bytes under a third title. Always run the identity check in
`file-pdf.js` before filing, and file the copy under the row whose title it actually matches.

**A typeset PDF can break a title probe.** Ligatures extract with a space inserted, so *filarial*
arrives as `fi larial` and a spaced six-word title probe rejects the correct paper. `file-pdf.js`
therefore compares twice, once with all spaces removed; that widens the match without weakening it,
since the probe is still six words of the title.

---

## 3. Do not repeat what was already filed

`Citations/Notable Citations in Original Application/` holds the articles used in the original
petition. Those are documented in
[`Notable Citations in Original Application/Original-Application-Citations.md`](./Notable%20Citations%20in%20Original%20Application/Original-Application-Citations.md).

**Do not re-submit them.** The packet must mark each entry with whether it was already used, and
must not include an already-used article as new evidence. Read that file before assembling the
index; it lists every article, its row UID, and its classification.

---

## 4. Source of truth: one database, derived reports

Store the structured record in a SQLite database **belonging to this packet**, and export CSV
reports from it:

```
Citations/Notable Citations Packet/notable-citations.sqlite   ← the data
Citations/Notable Citations Packet/packet.csv                 ← included citations (§4.3)
Citations/Notable Citations Packet/screened-out.csv           ← excluded + held (§4.5)
Citations/Notable Citations Packet/packet-files.csv           ← one row per PDF (§4.4)
```

Everything downstream — the index, the per-citation pages, the print output — is **generated from
the database**. Never hand-edit the generated HTML or the exported CSVs. If a field is wrong, fix
the database and regenerate.

**Do not put this data in `Database/citation-catalog.sqlite`.** That file is the Independent
Citation Record's own durable store, and §0 forbids writing to it. The reasons are practical, not
just procedural:

- `tools/build-catalog.js` **merges into** that file and treats it as the record's projection of
  the per-page reports. Packet tables sitting beside the `citations` table would be swept into
  every future rebuild and every backup of the evidence, and would make the record's reconciliation
  gate responsible for data it knows nothing about.
- The record is filed evidence. Packet commentary — tier judgements, screening opinions, prose for
  counsel — must never be recoverable as though it were part of that evidence.
- A separate file can be deleted, rebuilt, or zipped to counsel without touching the record at all.

Open `Database/citation-catalog.sqlite` **`readOnly: true`** when reading uids, titles and
`cites_id` into the packet. The packet's own database is opened read-write.

Why a database rather than CSV as the source of truth: the paths in `source_pdf` contain commas,
spaces and non-ASCII characters, the `quote` column holds multi-sentence verbatim text, and the
whole packet is generated by queries. A database also makes the joins in §4.2 and the checks in §7
enforceable rather than advisory. The CSVs are kept as the portable, Excel-readable, diff-friendly
report — counsel should never need a database tool to read what is being claimed.

Because `notes` legitimately holds multi-paragraph text, the exported CSVs are only correct when
read as RFC 4180: a quoted field may contain newlines, and splitting the file on line breaks turns
one record into several and invents rows that are really the tail of a note. Parse them with a real
CSV reader (`validate-packet.js` has a small one); never with `split("\n")`.

The packet's database is **not** under the record's audit chain: nothing in `tools/` reads it, and
`tools/audit-highlights.js` and `tools/build-ledger.js` must never be pointed at it.

### 4.1 What one row means

**A row is one citation: one citing work citing one of my papers.** Not one PDF, and not one
Scholar row.

That distinction matters because the two rarely match. Measured against the citation record on
2026-11-06, five of the works filed in `In Methods/` carry more than one `row_uid`:

| Citing work | Rows | Distinct citing works | Distinct of my papers cited |
|---|---|---|---|
| Heras et al. | `cit-000544`, `cit-000558` | 1, on the human record — see the caveat below | 1 (GLAD) |
| Hokke et al. | `cit-000518`, `cit-000551` | 1 | 1 |
| Georgiev / Jamieson et al. | `cit-000629`, `cit-001261` | 1 | 2 |
| Gerardo Vasta et al. | 4 rows | 1 | **4** |
| Guérardel et al. | 4 rows | 1 | **4** |

The four groups below Heras are one article each in the store as well as on the human record: the
rows share a `paper_key`, or share a title and differ only in which of my papers they cite.

So Gerardo Vasta is **one article and four citations**, and Heras is **one article, one citation,
two rows and three PDFs**. A folder must be per citing article (§5.1), not per row.

**Heras is the exception, and the basis matters.** The store holds its two rows under *different*
`paper_key`s — one for the journal title, one for the bioRxiv title — so the database does not
assert they are one work. What says so is `Citation-summary.md` entry 1, which records the same
authors under both titles and documents the preprint-to-article timeline. That is a human reading,
a plausible one, but not something the packet can present as proven. Both rows are highlighted, on
two different exhibit pages.

So file the three PDFs in one folder, because they tell one timeline, and present the entry as one
citing work with two supporting rows. But if a reviewer asks whether the preprint and the article
are the same paper, the answer comes from the documents, not from the citation record.

Do not treat that presentation as a correction to the ledger. The ledger counts both Heras rows,
because they are two highlighted rows on two exhibit pages and its basis is counted citations, not
distinct articles. The packet's "one work" and the ledger's "two citations" are different bases and
must not be reconciled against each other. If the duplication should be folded in the record, that
is a separate piece of work under §0 — raise it, do not action it from here.

### 4.2 Classify from the main row

**First group the rows by citing article.** Start from the store's `paper_key`: rows sharing one
`paper_key` are the same work. Then check the leftovers against the human record — Heras is exactly
the case where `paper_key` splits one article in two, because Scholar lists the preprint and the
journal version under different titles. Record the grouping; do not let it be implicit.

Each citing work has one **main row**, which names its folder. Choose it deterministically: the
**lowest `row_uid`** in the group. Record it in `folder_uid` on every row of the group, and set
`is_main = yes` on that row.

Do not pick the main row by `project`. An article like Gerardo Vasta has four citations spanning
four different projects, so a project-based rule would name a different folder depending on which
row you started from — the same article would get two folder names on two runs. The lowest uid is
stable and says nothing about merit, which is the right property for a filename. Merit lives in
`project` and `tier` on each row.

Then:

- **Identity comes from the main row group as a whole**: citing title, authors, venue, year,
  institutions, article type. Every row in the group describes the same article, so take these from
  the published version and do not let a duplicate listing's variant title (Heras's preprint title)
  leak into the index.
- **Classification comes from each row's own `cites_id`**: that row's `project`, and the `tier`,
  `section`, `page` and `quote` for the use of *that* tool. A second row citing a different one of
  my papers is a different citation with its own location — the fact that GLAD appears in Methods
  says nothing about where GlycoGlyph appears.
- **The other rows are recorded, not dropped.** List them in `additional_row_uids` so the packet
  shows every Scholar row this article stands behind, and so a duplicate listing is visibly a
  duplicate rather than an unexplained omission.

`folder_uid` is not the same idea as the store's `is_primary_copy`. That flag says which copy of a
duplicated listing carries the exhibit highlight (Hokke's `cit-000518` has it, `cit-000551` does
not); `folder_uid` says which uid names the folder. They often agree and need not.

### 4.3 Table `citation` — required columns

Exported as `packet.csv`, one row per citation (§4.1).

| Column | Contents |
|---|---|
| `n` | Citation number in the packet, 1-based. The index uses it. Assigned only to `status = included` rows; empty for a row that was screened out, since it has no place in the index. |
| `folder_uid` | The **main** row's uid, which is also the folder name (§5.1). |
| `row_uid` | This citation's own row in the citation record (`cit-000106`). Never substitute the integer id. |
| `is_main` | `yes` / `no` (§4.2). |
| `additional_row_uids` | Other rows for the same citing article, semicolon-separated. Empty when the article has one row. |
| `status` | `included` / `screened-out` / `held`. Every candidate considered gets a row, including the ones that do not make the packet (§1.2). `held` is a candidate awaiting something — a full text, a translation, a question for counsel. |
| `screen_reason` | Required when `status = screened-out`: `already filed` / `negative citation` / `non-English` / `not independent` / `passing mention` / `acknowledgement only` / `out of scope`. Empty otherwise. `not independent` is §1.2 applied at intake: the byline of the citing paper shares an author with the cited paper, or names a PI. That is a finding, not a question, so such a row is screened out and never held (§4.5). |
| `screen_date` | Date the row was screened, so a decision can be revisited on its own terms rather than by memory. |
| `cites_id` | The Scholar id of *my cited paper* for this row. |
| `cited_tool` | Which of my works is cited: `GLAD`, `GlycoGlyph`, `MAWE`, or more than one, semicolon-separated. |
| `cited_paper` | Title of my cited paper. |
| `cited_earliest_date` | Earliest date of the cited paper (preprint or publication). |
| `cited_was_preprint` | `yes` / `no` — whether that earliest date is a preprint. |
| `citing_title` | Title of the citing article, exactly as published — from the main row (§4.2). |
| `citing_authors` | Full author list. |
| `citing_senior_author` | Last author, for the index. |
| `citing_institutions` | Institution(s) of the senior author. |
| `citing_country` | Country of the senior author's institution. |
| `citing_venue` | Journal or other venue. |
| `citing_year` | Publication year. |
| `citing_published_date` | Publication or acceptance date. |
| `citing_article_type` | `Article`, `Patent`, `Thesis`, `Review`, `Preprint`, `Book chapter`, `Government report`, `Clinical trial`, `Guideline`. |
| `citing_url` | Publisher or DOI link. |
| `patent_number` | For patents only; otherwise empty. |
| `project` | One of `1`–`4` (§5.3). |
| `tier` | `A` Methods, `B` Results/Figures, `C` Introduction/Discussion (§1.1). `D` for an acknowledgement-only mention and `—` for a screened-out row that was never located in the article. |
| `section` | The section heading exactly as printed in the article. |
| `page` | Page number(s) where the citation appears. |
| `quote` | **Verbatim** sentence(s) naming or invoking the tool, with `p.` page numbers. |
| `use_type` | `Implemented` / `Compared` / `Built upon` / `Verified`. |
| `in_original_petition` | `yes` / `no` (§3). |
| `negative` | `yes` / `no` (§1.2). A `yes` row is excluded from the packet. |
| `language` | `English` or the language. Non-English rows are excluded (§1.2). |
| `evidence_basis` | How the location was established: `extracted text` / `docx note` / `reference-number resolution`. See §6. |
| `pdf_file` | Packet-local path to the PDF carrying this citation, e.g. `papers/cit-000544/03-article-Heras-2024.pdf`. Where a citing work has several PDFs they are all listed in `packet-files.csv` (§4.4); this names the one to open from the index. |
| `source_pdf` | Where the master copy lives, e.g. `Citations/In Methods/Laura_Kiessling-MAWE-s41467-025-67099-4.pdf`. |
| `exhibit_pdf` | The Scholar exhibit showing the highlighted row, if one exists. |
| `notes` | Anything counsel should know — hedged language, a duplicate listing, an open question. |

Leave a cell empty rather than filling it with a guess, and put the reason in `notes`.

### 4.4 Table `file` — one row per PDF

Exported as `packet-files.csv`.

A citing work can have several PDFs, and the paths contain commas, spaces and non-ASCII
characters, so do not pack several paths into one cell of `citation`. Give each file its own row:

| Column | Contents |
|---|---|
| `folder_uid` | Joins to `packet.csv`. |
| `file` | Packet-local path including its storage root, e.g. `papers/cit-000544/01-preprint-2023-04-29.pdf` or `pending-papers/cit-000510/01-article-Kiesling-2025.pdf`. The root is not decoration: it says whether the work is in the packet (§5.1). |
| `source_pdf` | The master copy it was copied from. |
| `role` | `article` / `preprint` / `webpage` / `cover-page` / `patent-front` / `supplement` / `thesis-front` — what the file is. |
| `shows_date` | The date this file exists to evidence, if any. |
| `date_basis` | Where that date comes from, e.g. `PDF p.1 masthead`, `bioRxiv version history`. Empty when the file carries no date. |
| `cited` | `yes` / `no` — whether the citation text is actually in this file. A webpage printout that only supports the timeline is `no`. |
| `bytes` | Size, so the validator can confirm the copy is complete. |

### 4.5 Keep the screened-out rows

**Screening is a decision, and a decision is worth recording.** Every candidate that was considered
gets a row in table `citation`, whether or not it reaches the packet. Deleting a screened-out row
destroys the only record of why the packet is the size it is, and guarantees the same article gets
reconsidered from scratch at the next session.

Export them separately, so the packet that goes to counsel stays clean while the reasoning survives
beside it:

```
packet.csv         ← status = included
screened-out.csv   ← status = screened-out or held, with screen_reason
```

- `screened-out.csv` carries the same columns as `packet.csv`. Do not trim it: the value of the row
  is in seeing a `negative` citation's quote next to the reason it was dropped.
- **The screened-out list is packet material too**, as a short appendix: counsel is entitled to see
  that the work was screened and on what grounds, and it is far better for them to learn about a
  negative citation from the packet than from a reviewer. Present it factually — the article, the
  reason — with no argument.
- A row that was screened out and is later reinstated keeps its `row_uid` and gains a `notes` line
  saying it was reconsidered and when. Do not mint a new row for the second opinion.
- **A `held` row is open work; a `screened-out` row is decided.** Copy anything unresolved into
  `PACKET-STATUS.md` under open items as well, so nothing waits quietly in a database nobody opens.

### 4.6 Schema

Sketch of the tables, for the file's own database. Keep the column names identical to the CSV
headers in §4.3 and §4.4 so an export is a plain `SELECT` and the two artifacts cannot drift apart.

```sql
CREATE TABLE citation (
  row_uid              TEXT PRIMARY KEY,   -- cit-000544; the record's permanent id
  folder_uid           TEXT NOT NULL,      -- main row of the group (§4.2)
  n                    INTEGER,            -- index number; NULL unless included
  status               TEXT NOT NULL,      -- included | screened-out | held
  screen_reason        TEXT,
  screen_date          TEXT,
  is_main              INTEGER NOT NULL,   -- 0/1
  additional_row_uids  TEXT,               -- semicolon-separated
  cites_id             TEXT,
  cited_tool           TEXT,
  cited_paper          TEXT,
  cited_earliest_date  TEXT,
  cited_was_preprint   INTEGER,
  citing_title         TEXT NOT NULL,
  citing_authors       TEXT,
  citing_senior_author TEXT,
  citing_institutions  TEXT,
  citing_country       TEXT,
  citing_venue         TEXT,
  citing_year          TEXT,
  citing_published_date TEXT,
  citing_article_type  TEXT,
  citing_url           TEXT,
  patent_number        TEXT,
  project              TEXT,               -- 1..4 (§5.3)
  tier                 TEXT,               -- A | B | C | D | —
  section              TEXT,
  page                 TEXT,
  quote                TEXT,
  use_type             TEXT,
  in_original_petition INTEGER NOT NULL DEFAULT 0,
  negative             INTEGER NOT NULL DEFAULT 0,
  language             TEXT NOT NULL DEFAULT 'English',
  evidence_basis       TEXT,
  pdf_file             TEXT,               -- which file the index opens (§4.4)
  source_pdf           TEXT,               -- master copy for that file
  exhibit_pdf          TEXT,               -- Scholar exhibit, outside the packet
  notes                TEXT,
  CHECK (status IN ('included', 'screened-out', 'held')),
  -- A screened-out row that does not say why is worse than no record at all.
  CHECK (status <> 'screened-out' OR COALESCE(screen_reason, '') <> ''),
  -- An included row that is negative or untranslated contradicts §1.2.
  CHECK (status <> 'included' OR negative = 0),
  CHECK (status <> 'included' OR language = 'English'),
  -- Only an included citation has a place, and so a number, in the index.
  CHECK (n IS NULL OR status = 'included')
);

CREATE TABLE file (
  folder_uid  TEXT NOT NULL,               -- no FK: not unique in citation (§4.6 note)
  file        TEXT NOT NULL,               -- papers/cit-000544/03-article-Heras-2024.pdf
  source_pdf  TEXT NOT NULL,               -- the master copy
  role        TEXT NOT NULL,
  shows_date  TEXT,
  date_basis  TEXT,
  cited       INTEGER NOT NULL DEFAULT 1,
  bytes       INTEGER,
  PRIMARY KEY (folder_uid, file)
);

CREATE INDEX idx_citation_folder ON citation(folder_uid);
CREATE INDEX idx_citation_status ON citation(status);

-- Exactly one row per folder may claim to be the main row (§4.2). A second
-- is_main would name two folders for one citing work.
CREATE UNIQUE INDEX uq_citation_one_main ON citation(folder_uid) WHERE is_main = 1;

-- One row per OCCURRENCE of a tool in a citing article (§5.3). Keyed on row_uid,
-- not folder_uid: two rows in one folder cite two different applicant papers, and
-- independence and tier are relative to the cited paper.
CREATE TABLE mention (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  row_uid   TEXT NOT NULL,
  section   TEXT NOT NULL,
  tier      TEXT NOT NULL,
  page      TEXT NOT NULL,               -- Scholar prints "4", "S4", "11"; keep it verbatim
  quote     TEXT,
  use_type  TEXT,                        -- Implemented | Compared | Built upon | Verified;
                                         -- empty when the sentence is hedged (§1.3)
  basis     TEXT,
  verified  INTEGER NOT NULL DEFAULT 0,
  noted_on  TEXT,
  CHECK (tier IN ('A','B','C','D','REF')),
  CHECK (basis IN ('extracted text','docx note',
                   'reference-number resolution','human reading'))
);

-- The four prose sections, one row per WORK (folder), not per citation.
CREATE TABLE narrative (
  folder_uid     TEXT NOT NULL,
  objectives     TEXT,
  importance     TEXT,
  how_used       TEXT,
  findings       TEXT,
  -- Working advice about the PACKET (which tier to file at, what not to claim).
  -- render-packet.js never reads this column; PACKET-STATUS.md §3.8 lists it.
  -- It exists because advice is useful and the filed prose is not where it belongs.
  preparer_note  TEXT,
  written_by     TEXT,
  written_on     TEXT,
  PRIMARY KEY (folder_uid)
);

-- The retrieval queue (§2.2). One row per row_uid, and `note` carries why a row
-- could not be fetched, so a wall is documented rather than re-attempted.
CREATE TABLE download_attempt (
  row_uid      TEXT PRIMARY KEY,
  url          TEXT,
  host         TEXT,
  status       TEXT NOT NULL CHECK (status IN ('downloaded','walled','no-open-copy',
                  'skipped-preprint','skipped-thesis','skipped-book','skipped-academia','failed')),
  note         TEXT,
  attempted_on TEXT NOT NULL
);
```

A fifth table, `candidate`, is the discovery queue that `discover-pdfs.js` seeds from the record and
`promote-candidates.js` moves into `citation`. It holds the per-row fetch state (`discover_state`,
`pdf_url`, `pdf_source`, `pdf_file`, `has_pdf`) and the screening state (`screen_state`), each with
its own `CHECK`. It is the queue a person works from; `citation` is what the packet reports on.

Two tables carry the same idea at different grains, and mixing them up is the trap:

- **`mention`** answers *where does the tool appear* — many rows per citation, each with its own
  tier, page and quotation. `record-mentions.js` is its only writer and refuses a mention with no
  quote, or a headline tier weaker than any recorded mention.
- **`narrative`** answers *what should counsel read about this work* — one row per folder, four
  prose columns. `narrative-intake.js` is its only writer.

**Read the two schemas above carefully: they are not equally strict, and that is deliberate.**
`mention` declares its `CHECK` constraints, so a bad tier or basis cannot be written by anything.
`narrative` declares nothing nullable-or-not, because the guarantees live in `narrative-intake.js`
instead — `written_by` mandatory, all four columns non-empty, every paragraph naming at least one
page, and every named page within the length of a PDF actually filed for that folder. A `CHECK`
cannot express "this page exists in the filed PDF", so putting the rule in the one writer is the
only place it can be enforced at all. The consequence to remember: **writing a narrative through
any path other than `narrative-intake.js` bypasses every one of those rules silently.** The same
applies to `mention` and `record-mentions.js` for the quote-verification rule, which no constraint
could express either.

**Three kinds of sentence live on a narrative row, and only one of them is printed.** Keep them
apart, because a lawyer-facing document reads badly if the other two leak in:

| kind | example | where it lives |
|---|---|---|
| what the **citing article** did, said, concluded | "the same paragraph on p.30 continues that the results were analyzed with GLAD" | the four columns → `packet.html` |
| what the **preparer recommends about the packet** | "file this row at tier A"; "do not present this as adoption" | `preparer_note` → `PACKET-STATUS.md` §3.8 only |
| **who wrote the prose and when** | `written_by = the preparer (draft)` | `written_by` / `written_on` → §3.7 only |

The middle row is the one that was got wrong first. Drafting advice is genuinely useful, so it must
be written down somewhere; but a sentence like "which is why the packet records this row at tier B"
inside `how_used` reads as the applicant editorialising about his own evidence, and it argues the
position counsel was asked to form. `render-packet.js` cannot tell the two apart, so
`narrative-intake.js` refuses the mixture: a sentence matching its `META` test in any of the four
columns fails the dry run and `--check` alike, with the message *move drafting advice to
preparer_note*. The test is deliberately broad and will occasionally catch an observation worth
keeping ("so counsel can see the authors worked with a released build") — when it does, rewrite the
sentence to state the fact without the advice rather than relaxing the regex.

That guard protects the **write**. It says nothing about the **render**: if a template later pointed
at `preparer_note`, or an attribution banner came back, intake would still pass and the document
would ship bookkeeping to counsel. `validate-packet.js` therefore has a matching `[prose]` check that
reads the finished `packet.html` — the same `META` expression, read out of `narrative-intake.js` so
the two cannot drift — plus the banner strings and a block-count equality. Both sides are covered
because they fail on different file states.

The same reasoning removed the per-paragraph attribution banner (user instruction 2026-11-07):
provenance is true, belongs in the status report, and repeating it 56 times in the document made the
document read like a work-in-progress. **A narrative is still a draft until the applicant adopts it**
— that fact is now carried by `written_by` and §3.7, not by the prose. Note that a citing paper's
*own* recommendation (its call for more accessible tools, say) belongs under *Findings / Conclusions
/ Recommendation* and is not preparer advice; the heading refers to the article.

Notes on the choices:

- Dates are `TEXT` in ISO form (`2024-07-08`). Some dates are imprecise or are ranges taken off a
  printed page, and a SQLite `DATE` would force a false precision the source does not support.
- Booleans are `INTEGER` 0/1, exported as `yes`/`no`, which reads better in Excel than `1`/`0`.
- Nothing here has a foreign key into `Database/citation-catalog.sqlite`. SQLite cannot enforce one
  across files anyway, and §0 means the packet must not depend on the record's internal shape.
  Validate `row_uid` values by querying the record read-only (§7).
- Table `file` has no foreign key on `folder_uid` either, and that is not an oversight. A foreign
  key needs the parent column to be covered by a plain `UNIQUE` index, and `folder_uid` repeats
  once per citation of the same work — that is the whole point of §4.2. The partial unique index
  (`WHERE is_main = 1`) cannot serve, because SQLite will not use a partial index as an FK target.
  Verified against `node:sqlite`: declaring the reference builds the table happily and then fails on
  the first insert with `foreign key mismatch`, so the constraint would look enforced and never
  actually be. Enforce the join in the validator instead (§7).

---

## 5. Output: a folder counsel can open

Generate:

```
Citations/Notable Citations Packet/
  packet.html           ← the summary document; prints to PDF
  packet.csv            ← included citations only (§4.3)
  screened-out.csv      ← candidates excluded or held, with the reason (§4.5)
  packet-files.csv      ← one row per PDF (§4.4)
  notable-citations.sqlite  ← the source of truth (§4)
  PACKET-STATUS.md      ← this effort's own progress log and open items (§0)
  package.json          ← the packet's own dependency list (§2)
  papers/               ← PDFs of works IN the packet (counsel's evidence folder)
    cit-000544/         ← one folder per citing work, named by its main row_uid
      01-preprint-Heras-2023-04-29.pdf
      02-biorxiv-page-Heras-2023-04-29.pdf
      03-article-Heras-2024.pdf
    cit-000106/
      01-article-Wilson-2026.pdf
  pending-papers/       ← PDFs of works awaiting a decision (`held`) — same layout
  screened-papers/      ← PDFs of works decided against — kept, never filed
  vendor/d3.min.js      ← copied from dashboard/vendor/d3.min.js
  print/packet.pdf      ← the printed form
  node_modules/         ← pdfjs-dist; git-ignored repo-wide by .gitignore
```

`potential_notable_citations.html` (§5.6) also lives in this folder, because it links into
`papers/` and `pending-papers/` by relative path, but it is **not** part of what counsel receives. Say
so when the folder is handed over, or copy the packet's own files out first.

### 5.1 One folder per citing work, named by its main `row_uid`

**Store the papers.** Copy every PDF into the packet — do not link back to `Citations/In …/`. The
packet must survive being zipped and opened on another machine; a relative link that escapes the
folder breaks the moment the folder travels alone, and a `file:///` absolute link breaks for anyone
but me.

**Three storage roots, chosen by the row's status.** A folder lives under one of `papers/`,
`pending-papers/` or `screened-papers/`, and which one is derived from `citation.status` for the rows
that name the folder — never remembered per caller:

| `status` of the folder's strongest row | root | why |
|---|---|---|
| `included` | `papers/` | counsel's evidence folder: everything printed with `packet.html` |
| `held` | `pending-papers/` | awaiting a decision that only a person can make |
| `screened-out` | `screened-papers/` | decided against; §4.5 keeps the record, nothing files it |

`included` beats `held` beats `screened-out`, because one PDF can serve several rows of one citing
work and the folder is evidence if any row in it is evidence. The rule lives in `ROOT_FOR_STATUS` /
`folderRoots()` / `storageDir()` in `scripts/lib.js`; `node scripts/relocate-pdfs.js` is the only
thing that moves a folder between roots (dry-run by default, DB backup, `--revert`).

Why the separation: a PDF for a citation nobody had decided used to sit beside the evidence, so the
evidence folder quietly held files for works the lawyer's document never mentions, and nothing
downstream could tell the two apart. So `packet.html` may link only `papers/`; the review page may
link `papers/` and `pending-papers/` but never `screened-papers/`. A validator check enforces both,
and one check fails if a folder sits in a root its status does not imply.

- **One folder per citing article, not per row and not per PDF.** Name it after the main row and put
  it in the root its status implies: `papers/cit-000544/`, or `pending-papers/cit-000544/` while a row
  is `held`. The uid is permanent, survives a re-capture, and is unique, whereas a
  senior-author surname is not (two 2026 papers can share one) and a filename is not stable.
- **A citing work with several PDFs keeps them together in that one folder.** Heras is the case
  that forces this: three files — the April 2023 preprint, its bioRxiv page, and the 2024 journal
  article — exist to show the timeline against the 25 April 2024 petition filing date. Splitting
  them across folders would scatter one argument across three places.
- **Order the files with a numeric prefix** so the folder lists them in the order counsel should
  read them, oldest first for a timeline: `01-preprint-…`, `02-biorxiv-page-…`, `03-article-…`.
  A plain alphabetical listing puts `article` before `preprint` and hides the point.
- **Put the citing senior author's surname in every file name**, after the prefix and before the
  role: `01-preprint-Heras-2023-04-29.pdf`, `03-article-Heras-2024.pdf`. Counsel opens the folder
  in Explorer, not in the database, and a surname is the one thing they can recognise without
  opening the file — a bare `cit-000544` tells them nothing, and the uid stays on the folder for
  the machine-readable join.
  - Use the **last author** of the published article, which is the senior/corresponding author in
    these journals, not the first author. Where the paper marks a co-senior author, use the one
    who is the corresponding author; where it marks several and names none, join two surnames with
    an underscore rather than picking one.
  - Write it the way the article prints it, ASCII-folded (`Guerardel`, not `Guérardel`), no spaces,
    no initials. Non-ASCII names are transliterated, never dropped, and the exact printed form
    lives in `citing_senior_author`.
  - **A file name is a label, not an identifier.** It must not be the only thing tying a file to a
    row: `folder_uid` and `source_pdf` in table `file` (§4.4) are the join, and a surname can
    collide across works. If two works share a senior author, the uid keeps the folders apart and
    the names stay as they are.
- **Keep the uid in the folder name even for single-PDF works.** Uniformity is worth more here than
  brevity, and a folder that renames itself when a second file appears breaks every link written
  against it.
- Record each file in `packet-files.csv` (§4.4), including what date it evidences and where that
  date comes from. For a timeline set, that column is the argument; for the rest it is usually
  empty and `role` alone says what the file is.
- Link with **relative** hrefs from inside the folder:
  `<a href="papers/cit-000544/03-article-Heras-2024.pdf">`.
- Keep the original in its `Citations/In …/` folder as the master; the packet copy is a derivative.
- **Copy the bytes; do not re-encode, re-save, or otherwise alter a PDF.** The master in
  `Citations/In …/` keeps its own filename and is never renamed from this effort. The packet copy
  *is* named by the numeric-prefix rule above — that is a display name on a copy, and `source_pdf`
  in `packet-files.csv` is what ties it back to the master, so renaming the copy loses nothing.
  Re-saving is the part to avoid: it can change the bytes a reviewer would otherwise match against
  the published file.

Also link, where they exist:

- the publisher page or DOI (`citing_url`),
- the Google Scholar record for the citing work,
- the Scholar exhibit PDF showing the highlighted row, as
  `../../Independent Citation Record/Exhibits/PDFs/<file>.pdf` (packet folder → `Citations` →
  repository root). Note this one *does* escape the folder, so present it as a reference for
  internal use, not as something counsel needs.

### 5.2 Presenting a timeline set

Where a folder holds more than one file, the per-citation section must say why, in one line, and
link the files in order. For Heras the line is factual and dated:

> Three files. The preprint posted 29 Apr 2023 and the journal submission of Jan 2024 both predate
> the 25 Apr 2024 filing; the peer-reviewed article was accepted 8 Jul 2024, after filing. The
> preprint is not peer-reviewed.

State only what the files show and where each date comes from. Whether a preprint is acceptable
evidence, and how the after-filing publication should be characterised, is counsel's call — do not
argue it in the packet.

### 5.3 Structure of the HTML

Use `d3.min.js` for any chart. It is already vendored at `dashboard/vendor/d3.min.js`; copy it
into the packet rather than loading it from a CDN, so the packet opens with no network access.

**Front matter**

- Title page: whose petition, what the packet contains, the date it was generated.
- A one-page summary: count of notable citations by tier, by tool, and by project, and a note
  stating how many candidates were screened out and why (already filed, negative, non-English).
  Count these from table `citation` by `status` and `screen_reason` — the numbers must come from the
  same table that holds the included rows, so the two cannot disagree.

**Index** — one row per citation, columns in this order:

`#` · `row_uid` · Title of citing paper (linked to the packet-local PDF) · Earliest date of the
cited paper, marked if a preprint · Publication/acceptance date of the citing paper · Tool used ·
Section and page of the citation · Senior author · Article type

When one citing work produces several citations (Gerardo Vasta and Guérardel each produce four),
print the article's bibliographic details once and give each citation its own row beneath it, so
the reader sees four citations to one article rather than four articles. Where the work has more
than one PDF, link the folder's files in order and label each with its `role`.

**List every place a citation occurs, not only the strongest one.** A tool can be named in Methods
on p.10 *and* in the Results on p.4, or in Methods on p.5 *and* in the Acknowledgments on p.12.
Counsel needs to see both, and needs to see that they are different kinds of evidence, so:

- the index's *Section and page* cell lists all of them, strongest tier first
  (`Materials and Methods, p.10; Results / Figures, p.4`);
- the per-citation *Where the citation appears* row names each one with its tier label;
- Section II prints **one blockquote per occurrence**, each with its own section, page and tier.

The rows behind this are table `mention` (§4.6), keyed on `row_uid` — not `folder_uid`, because two
rows in one folder cite two different applicant papers and each has its own locations.

**Every row's mentions must render, not just the main row's.** A citing work is presented once,
under its main row, so a naive renderer prints only the main row's quotations and silently drops
the evidence for the additional rows in that folder. Ten of twenty-eight mentions were invisible
this way before `secondaryQuotesBlock()` was added to `render-packet.js`: an entry for a work that
files four citations must show the quotation for each of the four, each introduced by its own
`row_uid`. Count the `class="quote"` blocks in the rendered HTML against
`SELECT COUNT(*) FROM mention` — they must agree, and a count of *articles* is not the check.

**Per-citation section**

> **SECTION I — BACKGROUND**
> - Cited Paper(s)
> - Citing Paper
> - Project Number
> - Citing Authors' Institutions
> - Citing Article Type
>
> **SECTION II — OVERVIEW OF USE**
> - Verbatim quote(s) with page numbers
> - **Objectives** — 3–4 sentences
> - **Importance to Field** — 2–3 sentences
> - **How and Why Your Work Was Used** — 4–5 sentences
> - **Findings / Conclusions / Recommendation** — 4–5 sentences

**Do not print a "draft" banner on each narrative paragraph.** An earlier version stamped every one
of the 56 narrative blocks (14 works × 4 sections) with *"Draft prepared by the preparer (draft) …
Not the applicant's own wording — to be reviewed, corrected and approved."* The instruction to be
honest about provenance was right; the way it was implemented was wrong — the same sentence 56
times is noise, and noise teaches a reader to skip the paragraph it is attached to. Provenance now
lives in two places that are actually read:

- table `narrative`'s `written_by` / `written_on` columns, which `narrative-intake.js` requires on
  every write and which `--list` prints;
- one paragraph in `PACKET-STATUS.md` §3.7, naming the authorship, the date, and what the applicant
  must do to adopt the text.

What replaces the banner *inside* the prose is the page number on each sentence — the thing that
actually lets counsel check a claim. A narrative sentence must name the page it rests on, and
`narrative-intake.js` refuses the paragraph otherwise, so the traceability is in the text rather
than in a disclaimer about it.

Removing the banner exposed the same problem in a second form: drafting advice that had been written
into the prose itself ("Recommendation for the packet: file this row at tier A", "Note for the
applicant: …", "Counsel should not be handed this citation as an instance of the tool being
adopted"). Those moved to `narrative.preparer_note`, and the `META` guard in §4.6 is what stops them
creeping back. `PACKET-STATUS.md` §3.8 is the only place that advice is written out, and it is read
before the packet is handed over (§5).

**Screened-out appendix** — after the citation sections, list the candidates that were excluded,
grouped by `screen_reason`, with title, senior author, venue, year and the reason. No prose
argument; the list is there to show the screening happened, not to persuade.

Group the per-citation sections under the project they belong to:

1. Synthesizing Anticoagulants with Reduced Side Effects
2. Developing Bioinformatics Tools to Capture and Analyze Glycomics and Glycan Microarray Data
3. Advancing Glycan Research with Microarray Innovations
4. Advancing Glycopeptide Synthesis with Glyco-SPOT

Use these titles verbatim from the Research Background Inquiry Form; do not paraphrase a project
name in the packet.

A citation may serve more than one project; index it under its primary project and cross-reference
it from the others rather than duplicating the section.

### 5.4 Printing

The packet is **not** a Google Scholar exhibit. The 0.73 scale in `tools/print-settings.js` exists
only to reproduce a Scholar results page on a single US Letter sheet, and must not be inherited
here — a prose document printed at that scale is unreadable.

Use ordinary document print settings instead: US Letter, ~19mm margins, 10–11pt body text, no
page-count target. Print to `print/packet.pdf` with `node scripts/print-packet.js`, and verify the
PDF was actually produced and is non-empty before reporting success. The script borrows the
playwright install from the record's `tools/` and writes nothing outside this folder (§0).

**Do not put `break-inside: avoid` on a whole citation.** It reads as the obvious rule and prints
badly: most entries are taller than a sheet once the quotation and file list are included, and when
a block cannot fit, Chromium breaks it wherever it must — after whatever did fit, leaving the
remainder alone on a fresh sheet. Fourteen of thirty-five sheets held nothing but a file list.
Avoid breaks on the small units that genuinely must stay together (a quotation, a definition row, a
heading and what follows it, a table row) and let the entry itself flow. Then read the page-by-page
text of the PDF: a page with a couple of hundred characters is the symptom.

### 5.5 Order of the pipeline

The scripts have a dependency order, and running them out of order produces reports that disagree
with the database without any of them failing.

```
node scripts/discover-pdfs.js --seed      # queue candidates from the record (§5.6)
node scripts/discover-pdfs.js --resolve   # OpenAlex: DOI + open-access link
node scripts/discover-pdfs.js --fetch     # download open copies -> pending-papers/
node scripts/fetch-downloads.js           # plain-HTTP try for the rest (§2.2) -> downloads/
node scripts/recover-downloads.js         # pull what Chrome saved to Windows Downloads (§2.2)
node scripts/download-queue.js --mark=…   # the only writer of `download_attempt` (§2.2)
node scripts/download-queue.js --export   # download-queue.csv, the readable form
node scripts/record-retrieval.js --spec=… # what a browser attempt found, per row (§2.2)
node scripts/file-pdf.js --folder=… --src=… --write   # the only sanctioned way into a folder
node scripts/sync-candidate-state.js --write  # queue states must match the shelf
node scripts/promote-candidates.js --write # queue -> table citation (screened if not independent)
node scripts/screen-dependents.js         # re-read every non-included row against the record
node scripts/relocate-pdfs.js --write     # move each folder to the root its status implies (§5.1)
node scripts/scan-mentions.js --write     # where the tools appear (scan_tier only; never tier)
node scripts/scan-refs.js --mentions=f.json # where the work is credited without naming it (§2.1)
node scripts/merge-ref-mentions.js --from=f.json --out=g.json  # only if the spec would overwrite
node scripts/record-mentions.js --from=g.json --write  # occurrences, one row each (`mention`)
node scripts/classify-citations.js        # read-only proposal: use type, negative flag, confidence per row (CLASSIFICATION-REPORT.md)
node scripts/record-evidence.js --write   # file tier/section/page/quote, each verified in the PDF
node scripts/narrative-intake.js --write  # the four prose sections (table `narrative`)
node scripts/build-status.js --write      # PACKET-STATUS.md — open items, disagreements
node scripts/render-packet.js --write     # packet.html + the three CSVs
node scripts/print-packet.js              # print/packet.pdf
node scripts/build-potential.js --write   # potential_notable_citations.html (§5.6), separate page
node scripts/validate-packet.js --deep    # every mechanical §7 check, plus re-read the PDFs
```

`merge-ref-mentions.js` writes a merged **spec file**, not the database — it has no `--write`. It is
needed only when the spec being applied would replace mentions the row already holds: `record-mentions.js
--from=X` replaces the whole set for a row, which is right for the named-tool scanner and wrong for the
§2.1 resolver, whose spec carries only the citations that name no tool. When the rows a spec touches hold
no mentions yet, applying it directly loses nothing — check with `record-mentions.js --list <uid>` before
skipping the merge, rather than assuming either way.

`sync-candidate-state.js` exists because the queue is where the applicant decides what to chase, and a
row reading "Paywalled" beside a folder that already holds the PDF sends someone to fetch a paper that is
on the shelf. `file-pdf.js` now moves its own rows to `has-pdf`; the sync tool catches the states written
before that, and `validate-packet.js` fails if any row drifts again.

`download-queue.js` sits beside that pair and answers a different question. `candidate` tracks whether a
row *could* be fetched; `download_attempt` records what was actually tried and how it ended, which is the
only thing that stops the next session re-attempting a wall. Keep both current: a row marked
`no-open-copy` with no `download_attempt` row was never probed, and a `download_attempt` row with no PDF
behind it is a claim, not a result.

`screen-dependents.js` and `relocate-pdfs.js` run as a pair whenever a status changes: the first
removes a row the record shows is not independent (§1.2), the second moves whatever PDF it left behind
out of counsel's `papers/` folder. Screening first matters — relocating first would move a folder to a
root the screen was about to change again.

Every writer above is **dry-run by default**, backs up the database before writing, and prints what
it would change; `--write` is the opt-in. `--check` re-verifies what is already filed against the
PDFs, which is the command to run when a PDF has been replaced on disk.

Three of these are load-bearing. `scan-mentions.js` writes only its own `scan_tier`/`scan_note`
columns; §1.3 forbids a script overwriting the applicant's `tier`. `record-evidence.js` is the
only sanctioned way to file a headline quotation, and `record-mentions.js` the only way to file an
occurrence, because both read the PDF (§6). `narrative-intake.js` is the only writer of prose and
carries the page-existence rule that no SQL constraint can express (§4.6). `build-status.js` and
`render-packet.js` are pure projections — if either is regenerated after a manual change, it will
silently revert the *report*, not the database, which is how a stale claim survives.

Printing comes before the final validation because the validator is what proves the PDF exists and
is non-empty — validating first and printing second leaves the last step unchecked.

### 5.6 Potential citations go on their one page, never in `packet.html`

`packet.html` is the document counsel receives, and it contains **only the citations the applicant
has confirmed**. Independent citations that are not in the packet belong on
`potential_notable_citations.html`, generated separately:

```
node scripts/build-potential.js --write   # potential_notable_citations.html
```

**One page lists every queued work** (applicant instruction, 2026-11-08). It used to be one page per
cited work — `potential_notable_citations-GlycoGlyph.html`, `-MAWE.html` — which made the applicant
open a file per paper to see the whole pile. The page now carries a **My work** column naming which of
the applicant's works each citation is for, and a citing article that cites **more than one** of them
occupies **one row** holding one judgement block per work, so the row says where GLAD sits and where
GlycoGlyph sits without duplicating the article. `validate-packet.js` fails if a per-work page is left
in the folder: a second document claiming to be the review list is not a convenience.

That fold means **a row is not a citation**, and the page prints both figures and names them — 92
citations appearing as 91 rows. Every downstream check counts uids, not rows: the uid cell holds the
row's first uid plus a `.uid2` line per further citation, and each tier pill sits in a
`<div class="workcell" data-uid="…">` so §12b can still say *which* citation a pill describes. A pill
in a row that no workcell claims is a failure, not an orphan to ignore. The screen tables stay **one
per cited work** — the arithmetic belongs to a single paper — and the sum of their `listed` figures
must equal the citations in the table.

The table is searchable and filterable by column: free-text search, Tier, Open copy, PDF on file,
Year, **My work**, and **Works cited by it** (how many of the applicant's works one article cites),
with a `showing N of M` count and a reset. Filters read the row's `data-*` attributes rather than the
rendered prose, so rewording a label for a reader cannot silently change what a filter matches. The
filter bar is hidden by `@media print` — a printed exhibit is the whole screen, whatever was filtered
on screen.

The two documents answer different questions and must never be merged, cross-linked, or printed
together. A reviewer who opens the packet should not find rows in it that nobody decided on, and a
page of candidates should not acquire the authority of filed evidence.

**Only independent citations may be fetched or listed** (applicant instruction, 2026-11-07). A citing
paper that shares an author with the cited work, or that names Richard D. Cummings or the former PI
Umesh R. Desai, is a self-citation; spending a download on one wastes the request and, worse, puts a
non-independent paper in front of counsel as a candidate. Independence is read from the citation
record's `status` and `is_countable_independent` on the active, standing row — **not** from the
packet's `candidate` snapshot, which is taken when the queue is seeded and goes stale when a byline is
later corroborated. `cit-000511` is the worked example: its snapshot says INDEPENDENT, the record says
DEPENDENT because the citing paper's full byline ends with `Cummings RD`.

The screen itself is `potentialIndependent()` in `scripts/lib.js`, shared with
`PACKET-STATUS.md` §4, so the page and the status report cannot disagree about what "potential" means.
It excludes, in order: superseded rows, non-independent rows, copies that do not stand for their work,
rows not listed in English, rows already confirmed in the packet, and rows already used in the original
application (§3). Every row removed is counted, so the page prints arithmetic that adds up.

**Tiers on that page are scan results, never judgements.** A tier is a claim about where a sentence
sits in an article, so a candidate that has not been read shows none. Once a PDF is on file,
`scan-mentions.js` reads it and the page shows what it found: a plain `Tier X` pill is that scan's
`scan_tier`, and a blue `Tier X — resolved` pill is a citation the §2.1 resolver found for a row
whose paper never names the tool. Both must be traceable to the database — `validate-packet.js`
§12b fails on a pill the scan did not read or a resolved tier no mention records, and
`test-potential-tier-check.js` proves that check can fail by planting each defect and restoring the
file. What the page may not do is invent a tier in prose, or imply that an unread candidate has been
assessed. Access is still recorded alongside — `open-copy`, `paywalled`, `no-open-copy`,
`not-in-indexes` — and those are findings about *access*, not about whether the paper exists: a
throttled or failed look-up must never read as "not indexed". Transferring a candidate means
running the pipeline on its `row_uid`, not copying a row across.

Each **citation** carries its own report block at the foot of the page — not each row — because a
report answers a question about one citation, and the `full report` links in a folded row point at
different blocks. The shape is the one the packet uses, so the applicant can read the citation and its
location without opening the PDF. Every
external link on that page opens in a new tab with `rel="noopener"` — the page is read *beside* the
packet, and a link that replaces it loses the list; §12b check 4b enforces it.

---

## 6. Accuracy rules

These are non-negotiable because the packet is read as a representation of the evidence.

- **Every quote is verbatim from the PDF, with a page number.** Never paraphrase inside quotation
  marks, never reconstruct a sentence from memory, and never quote from a summary of the article.
- **A quote is a sentence from the citing article, never its title.** An importer that copies the
  bold heading out of `Citation-summary.md` will file the work's own title as though it were a
  mention, and counsel would be handed a string that appears nowhere in the paper. The validator
  fails a row whose `quote` equals its `citing_title`.
- **A quote belongs to the row, not the folder.** One citing article appears on the "cited by" page
  of every paper it cites, so a single folder can hold four rows citing four different applicant
  works. A sentence copied folder-wide therefore credits tool X to a row that cites tool Y.
- **The sentence must name the row's own tool, not merely the sentence the scanner hit first.**
  When one line names two tools — the Vasta paper prints *"Results were analyzed by GLAD (Mehta and
  Cummings, 2019). Glycan models were constructed using GlycoGlyph (Mehta and Cummings, 2020)."* —
  a `sentenceAround()` that searches for *any* tool returns the GLAD sentence to both rows, and the
  GlycoGlyph row is filed with evidence about GLAD. `scan-mentions.js` now builds one quote per
  tool on the line (`h.quotes[label]`) and each row reads its own via `qFor()`. Found 2026-11-08 on
  `cit-000607`.
- **A quote is filed by `scripts/record-evidence.js`, never by an `UPDATE` in a terminal.** That tool
  re-reads the PDF that row points at and refuses any sentence it cannot find there, on the page
  claimed. It caught four wrong proposals (including two swapped page numbers) on its first run; a
  fluent, confident, wrong sentence is otherwise undetectable, because the renderer prints whatever
  the row holds. Re-run `node scripts/record-evidence.js --check` before hand-off, or
  `node scripts/validate-packet.js --deep` to run everything at once.
- **Compare PDF text with non-alphanumerics stripped.** Extraction inserts spaces inside words
  (`D ashboard`, `glycan - binding`, `wet - erase`), so a human-accurate transcription will not
  substring-match the raw page.
- **A hedge is a screening question, not a formatting problem.** §1.3 names "the long-term effects
  remain unclear" as a mention that is *not* use. File such a sentence verbatim, leave `use_type`
  empty, and say so in `notes`; do not smooth it into a use claim and do not quietly drop the row.
- **Record how each claim was established** in `evidence_basis`. A note carried over from
  `Citation-summary.md` is weaker than text read out of the PDF itself, and the two should not look
  identical in the output. Where a citation appears only as a reference number (`[125–127]`, `⁶⁹`)
  or as an author–year pair (`(Mehta et al. 2024)`), resolve it as §2.1 and record
  `reference-number resolution`; a human reading of the article records `human reading`. Neither is
  ever reported as if the scanner had found it, and neither is ever overwritten by a rescan.
- **Do not invent facts, dates, citation counts, or quotations.** If a field cannot be
  established, leave it empty and say why in `notes`.
- **Dates.** State which date is which. A preprint date and a journal publication date are
  different claims; label them.
- **Citation counts**, if shown anywhere, must be tied to a dated Google Scholar snapshot, with
  the snapshot date printed next to the figure.
- **Do not describe the packet as legal advice and do not guarantee an outcome.** The legal
  conclusions and the filing decisions are counsel's.
- **Never edit `Citation-summary.md`** — it is generated from
  `Citations/Citation-summary.docx`. If it is out of date, refresh it by re-running
  `tools/parse-citation-summary.js`, and treat that as its own deliberate step rather than part of
  building the packet: the tool reads the store `readOnly: true`, but it *writes* the `.md`, which
  sits outside the packet folder (§0).

---

## 7. Before the packet is handed over

Run through this list and record the result. A packet with a broken link or an unsupported quote is
worse than no packet.

- [ ] Nothing outside `Citations/Notable Citations Packet/` was written while building it. Check
      with `git status`: the Independent Citation Record, `Database/`, `dashboard/`, and `tools/`
      must show no changes attributable to this effort.
- [ ] `notable-citations.sqlite` is the file's own, and no table was created in
      `Database/citation-catalog.sqlite`.
- [ ] `packet.csv`, `screened-out.csv` and `packet-files.csv` were exported from the database, not
      written by hand, and the three CSVs together account for every row in table `citation`.
- [ ] Every screened-out row has a `screen_reason`, and every `held` row appears as an open item in
      `PACKET-STATUS.md`. A row the record shows shares an author with the cited work is screened out
      with `not independent` (§4.3), not held — `node scripts/screen-dependents.js` re-checks this.
- [ ] Every row the retrieval stage touched has a `download_attempt` row naming the URL, the host,
      the status and the reason (§2.2). A row with no mark was never probed, and a `no-open-copy`
      recorded after a throttled request is a claim about access that the evidence does not support.
- [ ] Every PDF in the three storage roots is named `NN-role-Surname[-date].pdf` with the citing
      senior author's surname in it (§5.1), and every such file is listed in `packet-files.csv`.
- [ ] Every `file` in `packet-files.csv` exists at the path it records, starts with `%PDF`, and its
      `bytes` matches the file on disk.
- [ ] Every `folder_uid` in table `file` exists in table `citation`, and every `citation` row with
      `status = included` and a PDF has at least one `file` row.
- [ ] Every `folder_uid` is a main row's uid, every folder contains at least one PDF, no PDF sits
      loose in a storage root, and every folder sits in the root its status implies (§5.1) —
      `node scripts/relocate-pdfs.js` prints the moves still owed.
- [ ] Every `row_uid` in `additional_row_uids` belongs to the same citing article as its
      `folder_uid` — never to a different work.
- [ ] Every folder appears in `packet.html`, and every link in `packet.html` points at a file
      listed in `packet-files.csv`.
- [ ] Every href resolves from inside the packet folder — no `file:///`, no absolute paths,
      nothing pointing outside the folder except the Scholar exhibits, which are labelled as
      internal references.
- [ ] Every `quote` is verbatim and carries a page number, and comes from the file marked
      `cited = yes`. Checked by `node scripts/record-evidence.js --check`, which re-reads each filed
      PDF; `node scripts/validate-packet.js --deep` runs it with the rest.
- [ ] **`packet.html` prints only the article's own account** (§4.6): no draft banner, no
      `preparer_note` text, and no sentence in a narrative block that argues about the packet.
      Checked by the `[prose]` test in `validate-packet.js`, which scans every narrative block with
      the same `META` expression the writer uses (read out of `narrative-intake.js`, not restated)
      and confirms the block count equals `narrative` rows × 4. Proven to fire: injecting a banner,
      a leaked note, and an advice sentence each produced a distinct `FAIL` on 2026-11-07.
- [ ] No `quote` is the citing work's own title (§6).
- [ ] Every multi-file folder has a one-line explanation (§5.2) and each date in it has a
      `date_basis`.
- [ ] No **included** row has `negative = yes` or `language` other than English. Screened-out rows
      may carry either, and should — that is what the reason refers to.
- [ ] No included row duplicates an article listed in
      [`Original-Application-Citations.md`](./Notable%20Citations%20in%20Original%20Application/Original-Application-Citations.md).
      An already-filed article belongs in `screened-out.csv` with `in_original_petition = yes`.
- [ ] Every `row_uid` in the database resolves in the citation record (query it read-only).
- [ ] Each index row links to a per-citation section, and each section appears in the index.
- [ ] Every tier that differs from the folder it came from has a `tier_decision` recorded by
      `record-tier-decision.js` (§1.1), rather than a silently edited `tier`.
- [ ] `potential_notable_citations.html` (§5.6) is **not** linked from `packet.html`, is not printed
      with it, lists no row that is in the packet or in the original application, and shows no tier
      the database cannot support. Every row on it is independent on the record, not merely on the
      queued snapshot. Every tier pill — plain or `&mdash; resolved` — matches `scan_tier` or a
      recorded mention, and every external link carries `target` and `rel="noopener"`. Checked by
      `validate-packet.js` §12b; `node scripts/test-potential-tier-check.js` proves that check can
      still fail by planting each defect and restoring the page byte-for-byte.
- [ ] `node scripts/test-ref-cites.js` passes (§2.1). Its negatives are the point: a resolver that
      accepts a wavelength, an extinction coefficient, or a chart axis tick as a citation credits a
      sentence to the applicant's paper that credits nothing.
- [ ] Every `project` value is 1–4 and every section sits under the right project.
- [ ] `print/packet.pdf` exists, is non-empty, and opens.
- [ ] The generated HTML was not hand-edited after generation.

Ideally a small validator enforces the mechanical items above rather than relying on a person to
check them, and exits non-zero on any failure.

---

## 8. What already exists in this repository

Reuse these; do not rebuild them.

| Thing | Where | Notes |
|---|---|---|
| Citing-article PDFs, filed by where the citation appears | `Citations/In Methods/`, `Citations/In Results and Figures/`, `Citations/In high reputation Publication/`, `Citations/In Acknowledgements/`, `Citations/low-value/` | Placement of the Methods and Acknowledgements sets was verified against extracted text on 2026-11-06. |
| Master list of PDFs outside those folders | `Citations/` | Includes patents, theses, reviews, and the GLAD preprint landing page. |
| Already-filed citations | `Citations/Notable Citations in Original Application/` | Do not repeat. |
| Hand-maintained citation notes | `Citations/Citation-summary.docx` | The authoritative human record. Generated `.md` is a derivative; read it with `node tools/parse-citation-summary.js --check`. |
| Query the citation record | `tools/query-catalog.js` | Every listing it prints leads with `row_uid`. Prefer this over ad-hoc SQL. |
| Citation record | `Database/citation-catalog.sqlite`, table `citations` | One row per Scholar row. Useful columns: `row_uid`, `title`, `authors`, `link`, `doi`, `status`, `confirm_state`, `is_non_english`, `work_type`, `patent_number`, `is_highlighted`, `base` (exhibit base name), `page`, `row_index`, `cites_id`. Active rows are `superseded_at = '' AND filed = 1` — empty string, not NULL. |
| Cited papers | same database, table `publications` | Joins on `cites_id`. Has `title`, `authors`, `venue`, `year`, `paper_url`, `cites_url`, `exhibit_base`, `snapshot_date`. There is no `year` column on `citations` — take the cited paper's date from here, and the citing paper's year from the PDF. |
| Ledger | `Independent Citation Record/Exhibits/Supporting/citation-ledger-<snapshot>.csv` | Quote figures from the dated CSV; never recompute by hand. Read-only here (§0). |
| Scholar exhibits | `Independent Citation Record/Exhibits/PDFs/` | The highlighted-row proof. Read-only here (§0). |
| d3 | `dashboard/vendor/d3.min.js` | Already vendored; copy into the packet rather than loading from a CDN. |
| Print conventions for exhibits | `tools/print-settings.js` | For Scholar exhibits only — see §5.4. |
| Retrieval-stage handover | `Citations/Notable Citations Packet/HANDOVER-PDF-RETRIEVAL.md` | State of the download stage as of 2026-11-09: which 319 rows gained a PDF and by what route, what is walled and why, and the rules that were paid for in wasted attempts. |
| Retrieval helpers | `archived-scripts/` (git-ignored; `README.md` tracked) | `repofetch.cjs`, `title-gate.cjs`, `residual-buckets.cjs` are worth keeping. `never-tried.cjs` and `residual-report.cjs` are **known defective** — they re-derive `classify()` instead of reading `download-queue.csv`. |
| Retrieved-uid list | `archived-logs/retrieved-uids.txt` | 319 `row_uid`s, one per line, that gained a PDF on 2026-11-08/09. |

The packet's own scripts and `package.json` live in the packet folder, not in `tools/` (§0, §2), so
nothing here changes the toolchain the citation record runs on.

The durable rules for the PDF folders — how they are filed, how text is extracted, what the heading
detection gotchas are — live in
[`.github/copilot-instructions.md`](../.github/copilot-instructions.md) under
"Citing-Article PDFs (Citations/)" and "Notable-Citations Packet Is Separate From the Record".

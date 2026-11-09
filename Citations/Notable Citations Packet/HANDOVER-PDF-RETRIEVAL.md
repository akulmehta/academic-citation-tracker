## 0. Read this first

You are continuing the **PDF-retrieval stage** of the notable-citations packet.

The goal of this stage, in the applicant's own words:

> Our first step is download any PDFs we can of publications which have cited my
> work. Once we have downloaded these PDFs we will add it to the
> `potential_notable_citations.html` list after parsing and cataloging them for my
> citations. You stop at this stage and then I will choose what
> reaches `packet.html` one by one and let you know and you can add them to the packet.html

So the pipeline is: **retrieve PDF → parse and catalog → potential list, then report
to me; I pick what goes into `packet.html`.** Retrieval is done. **Parsing and
cataloging the retrieved PDFs has NOT started and is the next stage.** Do not start it
without the applicant saying go.

Two hard rules from the project instructions that govern everything here:

- **This packet is separate from the Independent Citation Record.** Read the record
  freely; write to it not at all. Never log anything into
  `Independent Citation Record/Progress Tracker.json`. Packet output goes inside
  `Citations/Notable Citations Packet/`.
- **If a CAPTCHA, Cloudflare challenge, or sign-in wall appears, stop browsing and
  tell the applicant.** Do not solve or repeatedly retry it. The applicant can clear
  these and prefers to.

Working directory: `C:\Projects\EB1A`
Repo: `akulmehta/academic-citation-tracker`, branch `main`.
Packet folder: `C:\Projects\EB1A\Citations\Notable Citations Packet\`

**Read §7.1 before acting.** It lists the three instruction files with absolute paths:
`C:\Projects\EB1A\.github\copilot-instructions.md` (auto-loaded workspace rules),
`C:\Projects\EB1A\Citations\notable-citations.instruction-draft.md` (the packet's playbook),
and `C:\Projects\EB1A\Independent Citation Record\Independent Citation Record Guide.md`
(read-only). Two of the rules quoted below come from the first file; if this document and
that file disagree, that file wins and you should say so.

---

## 1. Where things stand (verified 2026-11-09)

`node scripts/validate-packet.js` → **0 failures, 1 warning**.
The one warning is pre-existing and is counsel's call, not a defect:
`cit-001253` quotes hedged language ("unclear") while included at tier A.

Queue from `node scripts/download-queue.js` — 722 rows the applicant could still use:

| state | count | meaning |
|---|---:|---|
| `downloaded` | **457** | a PDF is on disk |
| `no-open-copy` | **123** | nothing obtainable was found |
| `skipped-thesis` | 94 | dissertation — wrong document type |
| `skipped-book` | 24 | book or chapter |
| `skipped-preprint` | 22 | preprint, screened out |
| `walled` | 2 | entitlement cannot reach the publisher |

PDFs on disk: `papers/` 16 · `pending-papers/` 138 · `screened-papers/` 62 ·
`downloads/` 331.

`citation` table: 22 `included`, 722 `held`, 254 `screened-out` (998 rows).

**Retrieval is essentially drained.** Bucket the 123 residual rows with
`node archived-scripts/residual-buckets.cjs` and you get:

| bucket | count | verdict |
|---|---:|---|
| Publisher, no Harvard subscription | 42 | dead end — sciencedirect 25, bentham 5, springer 5, tandfonline 3, ovid 2, annualreviews 1, ingenta 1 |
| Institutional repository, mostly theses | 28 | mostly the wrong document type |
| Other / needs a look | 18 | the only bucket worth re-probing |
| No link in the catalog at all | 16 | nothing to fetch |
| Patent documents | 8 | `patents.google.com` |
| ResearchGate (login wall) | 6 | applicant excluded these |
| Book or chapter | 4 | screened type |
| Preprint server | 1 | screened type |
| **Open-access host** | **0** | **nothing open access remains untried** |

That last zero is the evidence that the pool is drained. The applicant has said
missing some is acceptable.

---

## 2. What the previous session achieved

Commits, oldest first:

| commit | what |
|---|---|
| `dd0d06c` | 18 PDFs from Europe PMC; academia.edu citations screened out |
| `c358a95`, `68afd6f`, `7acbee4` | individual recoveries, 9-PDF batch |
| `010596b` | 10 PDFs through Harvard OpenAthens entitlement (8 Wiley, 2 Portland Press) |
| `a891890` | 3 PDFs via `citation_pdf_url`; Nature and JoVE closed as `walled` |
| `730d12c` | (parallel agent) repository wave landed under a wip message |
| `371c8c0` | named the retrieved theses properly; stopped re-fetching work already on file |
| `575f6d9` | git-ignored the other agent's exhibit zip |

**319 distinct `row_uid`s gained a PDF on 2026-11-08/09.** Full list:
`archived-logs/retrieved-uids.txt`.

### PDFs recovered in the last stretch (all title-gated before marking)

In `downloads/`:

| uid | size | source / route |
|---|---|---|
| cit-000309 | 1.80 MB | Thieme, entitled via Harvard OpenAthens |
| cit-000918 | 3.33 MB | journal.hep.com.cn `/EN/PDF/`, direct |
| cit-001389 | 186 KB | Viamedica OJS, open access |
| cit-000654 | 1.75 MB | escholarship.org (LBNL published copy) |
| cit-000942 | 2.07 MB | article.accscience.com direct |
| cit-001220 | 448 KB | scholar.archive.org wayback copy |
| cit-000380 | 448 KB | same bytes as 001220 — kept deliberately, see §4 |
| cit-001473 | 91 KB | research-management.mq.edu.au author manuscript |

Kept but screened, in `pending-papers/<uid>/` — retrieved successfully, then
identified as the wrong document type from page 1:

`cit-000174` Thakur (Tezpur) · `cit-000865` Rubailo (Konstanz) · `cit-000872` Kumar
(LMU Munich) · `cit-000895` Wilkinson (UCD) · `cit-000945` Nguyen (Melbourne) ·
`cit-001069` Xie (Barcelona) · `cit-001508` Rodrigues (Porto) · `cit-001557`
Hendriks (Utrecht) — all theses. `cit-001027` is a 1-page Cayman Chemical data
sheet, which is genuinely the document Google Scholar indexed for that row.

### Two rows closed as `walled`, with a documented reason

- **cit-001476** — *Glycoproteomics*, Nature Reviews Methods Primers. The landing
  page publishes a `citation_pdf_url`, but both `fetch()` and a real navigation get
  the 925 KB `text/html` landing shell. Harvard's OpenAthens redirector returns
  **403 "The redirector is not enabled for the specified customer domain"** for
  `nature.com`.
- **cit-000888** — JoVE video article. `/pdf/<id>` returns a 42 KB `text/html` shell
  with an empty body. Same OpenAthens 403 for `jove.com`.

These are not oversights; they are the two rows entitlement provably cannot reach.

---

## 3. Tools you should use

### Packet pipeline (`Citations\Notable Citations Packet\scripts\`)

| script | what it does |
|---|---|
| `download-queue.js` | the retrieval tracker. `--mark=<uid>=<status> --note="…"` is the **only** writer; `--export` rewrites `download-queue.csv`. `classify()` is the definition of whether a row is still work. |
| `validate-packet.js` | all mechanical §7 checks of the draft instructions (§7.1). Run after every batch. |
| `build-status.js --write` | regenerates `PACKET-STATUS.md`. **Never hand-edit that file.** |
| `lib.js` | `DOWNLOAD_STATUSES`, `heldPdfIndex()`, `linkKind()`, `STORAGE_ROOTS`, `ROOT_FOR_STATUS` |
| `pdf-text.js` | `extractPages(file, pages)` → `{ text, numPages, pages }`. **Use `r.text`**, not `r.pages` (that is an array of objects). |
| `sync-candidate-state.js`, `screen-from-report.js`, `promote-candidates.js` | the parse-and-catalog stage you are inheriting |
| `test-held-pdf.js`, `test-link-kind.js`, `test-potential-tier-check.js` | unit tests, all passing |

Valid statuses: `downloaded`, `walled`, `no-open-copy`, `skipped-preprint`,
`skipped-thesis`, `skipped-book`, `skipped-academia`, `failed`.

### Retrieval helpers (`C:\Projects\EB1A\archived-scripts\`, git-ignored but on disk)

| script | why it matters |
|---|---|
| **`title-gate.cjs`** | **Run after every download, before marking.** Verifies the PDF is the catalogued article: verbatim 45-char title prefix, else ≥80% distinctive-word overlap. `node archived-scripts\title-gate.cjs cit-XXXXXX …` |
| **`repofetch.cjs`** | Node-side fetch for rows whose `citing_url` is already a direct file endpoint. Now calls `heldPdfIndex()` first and prints `already on file: <where>` instead of re-fetching. |
| `directurls.cjs` | Lists rows whose `citing_url` is a direct file endpoint and not yet settled. |
| `residual-buckets.cjs` | Categorises the residual `no-open-copy` rows exactly as `download-queue.js` reports them. `--list` prints the open-access and "other" rows. |
| `_post.cjs` | gates a captured PDF and files it as `downloads/<uid>.pdf` |
| `_flat.cjs` | flattens a driver dump into `{uid: base64}` |
| `recover-temp.cjs` | decodes base64 out of an MCP temp-output file into `downloads/` |
| `never-tried.cjs`, `residual-report.cjs` | ⚠️ **defective — do not use.** They re-derive `classify()` instead of reading the CSV and overstate the pool as 360. Kept only so the mistake is not repeated. |

Browser drivers, also in `archived-scripts/`: `_efetch3.cjs` (queue-per-tab +
`oa404`→direct), `_wileypd.cjs` (Wiley `/doi/pdfdirect/`), `_metapdf.cjs`
(reads `citation_pdf_url`), `_sameorig.cjs`, `_oa3.cjs`.

### Scratch probes

`archived-scripts/_q1.cjs` … `_q9.cjs`, `_pg1.cjs`, `_pg2.cjs`, `_schema.cjs` are
read-only DB and PDF-first-page probes. Useful patterns to copy.

`archived-scripts/README.md` (the one tracked file in that folder) lists the same
helpers and marks the two defective probes. Read it before writing a new driver.

---

## 4. Hard-won rules — do not relearn these

**Retrieval**

1. **Check `heldPdfIndex()` before fetching anything.** It takes an open DB handle
   (`heldPdfIndex(db)` returns a function). A row can hold a PDF and still carry no
   `download_attempt` mark, so consulting that table alone is not enough. Three rows
   were re-fetched this session for exactly this reason; the duplicates were
   deleted, verified by MD5.
2. **Never delete a downloaded PDF — move it.** Theses and preprints go to
   `pending-papers/<uid>/` so nobody downloads them again. `cit-000380` keeps a
   byte-identical copy of `cit-001220` **on purpose**: without it `heldPdfIndex()`
   reports that row unheld and every future wave re-fetches it.
3. **A `403` names the host, not the class.** `figshare.mq` and RMIT `ndownloader`
   refuse a plain GET while other hosts on the same platform serve the file.
4. **`citation_pdf_url` is the canonical PDF route** — it is what a reader's
   "Download PDF" button follows. Guessing publisher paths is what produced the
   false `no-pdf-bytes` results.
5. **Wiley's endpoint is `/doi/pdfdirect/<doi>`.** `/doi/pdf/` and `/doi/epdf/`
   return `text/html` viewer shells. And Wiley does **not** accept a bare DOI in the
   URL — use `/doi/abs/<doi>`.
6. **OpenAthens `404` ≠ denied.** It means the host is absent from OpenAthens'
   knowledge base; several such publishers are open access and need no entitlement.
   Fall back to the direct URL. `403` ("not enabled for the specified customer
   domain") and `400` are genuine refusals.
7. **In-page `fetch()` must run on the target's own origin.** Cross-origin returns
   `TypeError: Failed to fetch`, indistinguishable from a refusal unless you
   navigate first.
8. **The `#sdrwork` / `#sdrstash` URL-fragment tab markers are destroyed by the
   first navigation.** A driver that re-filters on them mid-session silently finds
   zero tabs and reports success having done nothing. Select tabs by exclusion.
9. **One worker per tab pulling a shared queue.** `works[wi++ % n]` inside
   `Promise.all` stacks jobs on one tab and they navigate over each other.
10. **`btoa(String.fromCharCode(...b))` overflows the stack on multi-MB arrays.**
    Convert in `0x8000` chunks.

**Classification**

11. **A repository landing page's `citing_article_type` is useless for thesis
    detection.** Scholar said `article` for all eight theses above, and the title
    gate passed them VERBATIM because the thesis and the paper share a title. **Read
    page 1.**
12. **academia.edu citations are excluded by the applicant.** Scholar indexed some
    of them with a single uploader's name, which made a dependent citation look
    independent (`cit-000244`).
13. **One citing article can carry several `row_uid`s.** Group on `paper_key` before
    counting articles.
14. **Folder placement follows the row's `status`** via `ROOT_FOR_STATUS`
    (`included`→`papers`, `held`→`pending-papers`, `screened-out`→`screened-papers`).
    `validate-packet.js` `pdf-root` enforces it. Retrieval lands in
    `pending-papers/`; moving to `screened-papers/` is the cataloging stage's job.
15. **File names must be `NN-role-Surname[-date].pdf`.** When `citing_senior_author`
    is null (Scholar truncated the byline), the name comes from page 1 of the PDF.

**Environment**

16. **PowerShell has no `&&`, `||`, `??`.** Use `;` and `if ($?) { … }`.
17. **Never rewrite a repo file with `Get-Content` + `Set-Content`** — it mangles
    UTF-8 into `â€”`. Use the edit tool, or `node -e` with `fs.readFileSync(p,'utf8')`.
18. **`Set-Content -Encoding utf8` writes a BOM**, which will poison a commit
    message's first line. Strip it.
19. Use `node:sqlite` (`DatabaseSync`). There is **no** `better-sqlite3` and no
    Python.
20. **PDF text extraction works**: `pdfjs-dist` via
    `scripts/pdf-text.js`. A `Required "glyf" table is not found` or
    `TT: undefined function` warning is cosmetic — those files still extracted.
    Never conclude anything about a paper from a *failed* extraction.

---

## 5. What is pending

In order:

1. **Parse and catalog the retrieved PDFs into `potential_notable_citations.html`.**
   457 rows are marked `downloaded`. This is the stage the applicant asked for next,
   but **wait for them to say go**. Start by reading
   `Citations\Citation-summary.docx` — it is **hand-maintained by the user and is
   the source of truth; never write to it**. `tools/parse-citation-summary.js` (in
   the repo-root `tools/`, not the packet's `scripts/`) renders it to
   `Citation-summary.md`; edit the docx and re-run, never the markdown. Pass
   `--check` to report drift.
2. **The 18-row "other" bucket** is the only retrieval work worth revisiting if the
   applicant asks for more: `node archived-scripts/residual-buckets.cjs --list`.
   It includes `science.org`, `cell.com`, `jbc.org`, `ahajournals.org`,
   `sagepub`, `ard.eular.org`, `thrombosisresearch.com` — all Cloudflare-gated. The
   applicant **can** clear those walls; ask rather than retrying.
3. **A reCAPTCHA was left showing** on the browser tab at
   `pmc.ncbi.nlm.nih.gov/articles/PMC9467456/`. It was not solved or retried, per
   project rules. The applicant can clear it.
4. **The applicant chooses what reaches `packet.html`.** 22 citations are in it now.
   Do not promote anything without them.

---

## 6. Before you hand back

```powershell
cd C:\Projects\EB1A\Citations\Notable Citations Packet
node scripts\validate-packet.js          # must be 0 failures
node scripts\build-status.js --write     # regenerate PACKET-STATUS.md
node scripts\download-queue.js --export  # regenerate download-queue.csv
node scripts\test-held-pdf.js
node scripts\test-link-kind.js
node scripts\test-potential-tier-check.js
```

Then commit. Keep scratch in `archived-scripts/` and `archived-logs/` (both are
git-ignored — that is deliberate, they are ~150 MB of base64 captures). Never leave
`_*.cjs` or `_*.json` at the repository root.

Commit messages carry this trailer:

```
Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>
```

---

## 7. Instruction and reference documents

Repo root is `C:\Projects\EB1A\`. The paths below are absolute for the instruction
files, because getting the wrong one means working from rules that no longer apply.
**Everything you write goes inside the packet folder**, `Citations\Notable Citations
Packet\` — the record and everything above it are read-only (§0). The one exception is
scratch: `archived-scripts\` and `archived-logs\` at the repo root are git-ignored
holding areas for throwaway drivers and dumps (§3), and writing there is allowed
precisely because nothing in them is evidence and nothing reads them.

### 7.1 Instruction files — read before doing anything

| File | Governs | Read/write |
|---|---|---|
| `C:\Projects\EB1A\.github\copilot-instructions.md` | The workspace rules auto-loaded into every agent's context: evidence accuracy, the record's citation rules, the packet/record separation, the `Citations/` PDF folders, access walls, browser conduct. 200 dense lines. The two sections that bind this stage are **"Notable-Citations Packet Is Separate From the Record"** (line 90) and **"Citing-Article PDFs (`Citations/`)"** (line 141). | Read. Propose changes to the applicant; discuss before editing an existing rule. |
| `C:\Projects\EB1A\Citations\notable-citations.instruction-draft.md` | The packet's own playbook, 1 428 lines. §0 the separation, §1 selection and screening, §2 locate and read PDFs (**§2.2 "How a PDF gets fetched" is the retrieval layer this stage built** — the queue, `heldPdfIndex()`, `citation_pdf_url`, the OpenAthens status codes, the Wiley endpoint), §4 the database, §5 output and the pipeline order (§5.5), §7 the pre-handover checklist, §8 what exists. Updated 2026-11-09. | Read. Editable, but §0 forbids anything that writes to the record. |
| `C:\Projects\EB1A\Independent Citation Record\Independent Citation Record Guide.md` | The *record's* guide — independence, translation, exhibit standards. | **Read-only from this side** (§0). Do not write to it or to `Independent Citation Record/Progress Tracker.json`. |

When the two packet-facing files disagree, `.github\copilot-instructions.md` wins: it is what every
agent loads automatically, so a rule stated only in the draft is a rule nobody follows. Say so rather
than silently picking one.

### 7.2 Reference documents

- `Citations\Notable Citations Packet\PACKET-STATUS.md` — generated, 2 056 lines.
  §2 lists what is missing; §4 lists independent citations not in the packet.
  Regenerate with `node scripts/build-status.js --write`; never hand-edit, or the
  next build reverts the change and the stale claim survives.
- `Citations\Notable Citations Packet\potential_notable_citations.html` — **699 candidate
  citations** shown as **619 table rows** (one citing article that cites several of the applicant's
  works occupies one row, §5.6 of the draft instructions), searchable and filterable, with **86 tier
  claims** each backed by a scan of a PDF on file or a resolved mention. All three figures are what
  `node scripts/validate-packet.js` reports; the page's own `<h2>` reads "The 619 candidates" because
  it counts rows, not citations — that is not a discrepancy. Generated by
  `node scripts/build-potential.js --write`.
- `Citations\Notable Citations Packet\download-queue.csv` — the readable export of
  `download_attempt`. Read this, not `candidate.discover_state`, for what was actually tried.
- `archived-scripts\README.md` — the tracked index of the git-ignored scratch folder:
  which helpers are worth keeping and which two are known defective.
- Session checkpoints: `c:/Users/mehta/.copilot/session-state/a737903d-b676-433a-b642-38275839ef57/checkpoints/index.md`
  — 39 checkpoints, most recent first. Read `039-*`, `038-*`, `037-*`, `036-*`.

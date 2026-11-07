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
| — | screened out | `Citations/low-value/` | Passing mentions and other weak rows. Not packet material. |

The folder a PDF sits in records where its citation was found, so the tier can start from the
folder — but confirm it against the article text before relying on it (§2).

Journals head the Methods section in many different ways — `Methods`, `Materials and methods`,
`Material and Methods` (singular), `4 | MATERIALS AND METHODS`, `Experimental procedures`, and
letterspaced forms such as `2 | M E T H O D S`. Do not conclude a paper has no Methods section
because a simple text match failed.

### 1.2 Screen these out

Screening decides what the packet *contains*. It does not decide what the record *keeps*: every
candidate below still gets a row with its reason (§4.5).

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

Text extraction from these files works, but the library is not installed in the repository yet.
**Install it under the packet folder, not under `tools/`** — adding a dependency to
`tools/package.json` would change the toolchain the Independent Citation Record runs on (§0). Give
the packet its own `package.json` in `Citations/Notable Citations Packet/`, run `npm install
pdfjs-dist` there, and keep the packet's scripts beside it. `node_modules/` is already git-ignored
repo-wide (`.gitignore`), so the install stays out of the commit. Use
`pdfjs-dist/legacy/build/pdf.mjs`, `getDocument({ data, useSystemFonts: true, isEvalSupported:
false })`, and group each page's items by their y-ordinate into lines. The raw `zlib.inflateSync`
shortcut does not work, because the journals embed subset fonts and it returns glyph indices instead
of characters. `Required "glyf" table is not found` and `TT: undefined function` warnings during
extraction are cosmetic.

Two traps, both encountered on files already in this folder:

- **A tool can be cited by reference number alone.** A Methods paragraph may end in a bare
  superscript pointing at the tool rather than naming it. Searching the text for "MAWE" or "GLAD"
  will then find only the reference list and wrongly suggest the tool was never used in Methods.
- **A heading may be letterspaced or numbered**, so a naive `^Methods$` match fails. See §1.1.

Do not classify a folder from a filename. The folder a PDF sits in is a claim about the article,
and it must be checked against the article.

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
| `screen_reason` | Required when `status = screened-out`: `already filed` / `negative citation` / `non-English` / `passing mention` / `acknowledgement only` / `out of scope`. Empty otherwise. |
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
| `file` | Packet-local path, e.g. `papers/cit-000544/01-preprint-2023-04-29.pdf`. |
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

Sketch of the two tables, for the file's own database. Keep the column names identical to the CSV
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
```

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
  papers/
    cit-000544/         ← one folder per citing work, named by its main row_uid
      01-preprint-Heras-2023-04-29.pdf
      02-biorxiv-page-Heras-2023-04-29.pdf
      03-article-Heras-2024.pdf
    cit-000106/
      01-article-Wilson-2026.pdf
  vendor/d3.min.js      ← copied from dashboard/vendor/d3.min.js
  print/packet.pdf      ← the printed form
  node_modules/         ← pdfjs-dist; git-ignored repo-wide by .gitignore
```

### 5.1 One folder per citing work, named by its main `row_uid`

**Store the papers.** Copy every PDF into the packet — do not link back to `Citations/In …/`. The
packet must survive being zipped and opened on another machine; a relative link that escapes the
folder breaks the moment the folder travels alone, and a `file:///` absolute link breaks for anyone
but me.

- **One folder per citing article, not per row and not per PDF.** Name it after the main row:
  `papers/cit-000544/`. The uid is permanent, survives a re-capture, and is unique, whereas a
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
page-count target. Page breaks should fall at citation boundaries. Print to `print/packet.pdf` and
verify the PDF was actually produced and is non-empty before reporting success.

---

## 6. Accuracy rules

These are non-negotiable because the packet is read as a representation of the evidence.

- **Every quote is verbatim from the PDF, with a page number.** Never paraphrase inside quotation
  marks, never reconstruct a sentence from memory, and never quote from a summary of the article.
- **Record how each claim was established** in `evidence_basis`. A note carried over from
  `Citation-summary.md` is weaker than text read out of the PDF itself, and the two should not look
  identical in the output.
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
      `PACKET-STATUS.md`.
- [ ] Every PDF under `papers/` is named `NN-role-Surname[-date].pdf` with the citing senior
      author's surname in it (§5.1), and every such file is listed in `packet-files.csv`.
- [ ] Every `file` in `packet-files.csv` exists under `papers/`, starts with `%PDF`, and its
      `bytes` matches the file on disk.
- [ ] Every `folder_uid` in table `file` exists in table `citation`, and every `citation` row with
      `status = included` and a PDF has at least one `file` row.
- [ ] Every `folder_uid` is a main row's uid, every folder contains at least one PDF, and no PDF
      sits loose in `papers/`.
- [ ] Every `row_uid` in `additional_row_uids` belongs to the same citing article as its
      `folder_uid` — never to a different work.
- [ ] Every folder appears in `packet.html`, and every link in `packet.html` points at a file
      listed in `packet-files.csv`.
- [ ] Every href resolves from inside the packet folder — no `file:///`, no absolute paths,
      nothing pointing outside the folder except the Scholar exhibits, which are labelled as
      internal references.
- [ ] Every `quote` is verbatim and carries a page number, and comes from the file marked
      `cited = yes`.
- [ ] Every multi-file folder has a one-line explanation (§5.2) and each date in it has a
      `date_basis`.
- [ ] No **included** row has `negative = yes` or `language` other than English. Screened-out rows
      may carry either, and should — that is what the reason refers to.
- [ ] No included row duplicates an article listed in
      [`Original-Application-Citations.md`](./Notable%20Citations%20in%20Original%20Application/Original-Application-Citations.md).
      An already-filed article belongs in `screened-out.csv` with `in_original_petition = yes`.
- [ ] Every `row_uid` in the database resolves in the citation record (query it read-only).
- [ ] Each index row links to a per-citation section, and each section appears in the index.
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

The packet's own scripts and `package.json` live in the packet folder, not in `tools/` (§0, §2), so
nothing here changes the toolchain the citation record runs on.

The durable rules for the PDF folders — how they are filed, how text is extracted, what the heading
detection gotchas are — live in
[`.github/copilot-instructions.md`](../.github/copilot-instructions.md) under
"Citing-Article PDFs (Citations/)" and "Notable-Citations Packet Is Separate From the Record".

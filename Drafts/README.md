# Drafts — read before using these files

Generated from `Database/citation-catalog.sqlite` for the user's own review.
**These are not the ledger and are not filing figures.** Any number quoted in the
packet comes from
`../Independent Citation Record/Exhibits/Supporting/citation-ledger-<snapshot>.csv`
written by `tools/build-ledger.js`. Since 2026-11-02 that CSV is a *derived
report* of the rows in the database rather than a separate source: the builder
reads the active rows out of the store, recomputes the same figures independently
from the report JSON, and refuses to write when the two disagree. So a draft
should never disagree with either — if one does, that is a defect to investigate,
and no figure should be quoted until it is resolved.

## Currently open

| File | Rows | What it lists |
|---|---:|---|
| `review-queue-2026-11-02.csv` | 78 | **The citations whose independence is still unresolved**, one row each, leading with the permanent `row_uid`. This is the file to record decisions in. `your_decision` and `your_notes` are empty on purpose. |
| `review-queue-2026-11-02.md` | 78 | The same rows as a readable table. All 78 sit in bucket 3 (nothing indexes them and Scholar truncated the byline). Read this one; answer in the CSV. |

Rebuild either with `node tools/build-review-sheet.js --md`; reproduce the list
with `node tools/query-catalog.js review`. None of the 78 is counted as
independent or as dependent, so a decision changes the totals.

### Recording a decision

Write `INDEPENDENT`, `DEPENDENT`, `SELF (PI)`, `SELF (FORMER PI)` or `REVIEW`
into the `your_decision` column of the CSV (a reason can go in `your_notes`), then:

```
node tools/apply-decision.js --from-csv --write --reprint --rebuild
```

Drop `--write` first to see the plan. A single row can be decided without the
CSV, with `--row=cit-000019 --verdict=dependent`. The tool resolves the
`row_uid` against the store, finds the citation in its report file and **refuses
the batch unless the title at that position matches**, so it cannot edit a
citation nobody asked about. It backs up every report it touches to
`Exhibits/Supporting/Pre-decision-<date>/` and writes atomically.

A decision is written into the report JSON and the store is **rebuilt** from it.
Never `UPDATE` the database to record one: the next `tools/build-catalog.js`
would silently revert it, and the store disagreeing with the reports is the one
state the ledger exits non-zero on.

A decided row carries `confirm_state = "user-decided"`, so it is reported
separately as *"settled by you"* rather than folded into "externally confirmed",
and `--revert` takes it back. Two things a decision cannot do: it does not defeat
the language screen (per 2026-11-01 no certified translation exists, so a
non-English row stays uncounted), and it does not double-count a paper that
appears twice on one citing list. The tool says so up front when either applies.

The same rows are also readable at
`file:///C:/Projects/EB1A/dashboard/review.html`, which groups them the same way
and links each row to the exhibit PDF page it came from. Regenerate that page
with `node tools/build-dashboard-data.js` after rebuilding this sheet, so the two
name the same rows.

## Older drafts (2026-10-31 snapshot)

The three files below were generated at the 2026-10-31 snapshot and are kept for
reference. Their figures are that snapshot's, not the current one — the 2026-11-02
ledger reports 1042 countable independent over 1029 distinct papers.

Both files were checked against the ledger's `global` block on 2026-10-31 and
match it: 301 countable independent, 296 distinct papers, 237 externally
confirmed, 64 counted on Scholar's list alone.

## Files

| File | Rows | What it lists |
|---|---:|---|
| `citation-decisions-all-filed-2026-10-31.csv` | 423 | **Every filed citation with its verdict.** `verdict` is INDEPENDENT / DEPENDENT / SELF (FORMER PI) / REVIEW, `counted` says whether the ledger counts it, `shared_authors` names the overlapping authors, `reason` explains the outcome. The file to read when checking decisions. |
| `citing-work-list-draft-2026-10-31.csv` | 296 | Counted independent works only, one row per distinct citing work — Scholar's duplicate versions collapsed. Quote this shape when saying *how many papers cite the work*. |
| `citing-work-list-all-copies-2026-10-31.csv` | 301 | The same counted rows with duplicates kept and marked in `dup_note`. Matches what the exhibit pages actually show. |

The two `citing-work-list-*` files hold only counted independent rows, so a
verdict column there would read INDEPENDENT on every line — use
`citation-decisions-all-filed-2026-10-31.csv` for the dependent side.

Columns in the decisions file: `cited_year`, `my_work`, `citing_work`,
`citing_authors`, `verdict`, `counted`, `shared_authors`, `reason`,
`confirm_state`, `author_source`, `work_type`, `patent_number`, `dup_note`,
`external_url`, `exhibit_base`, `page`, `row_index`.

Columns in the list files: `cited_year`, `my_work`, `citing_work`,
`citing_authors`, `author_source`, `work_type`, `patent_number`,
`confirm_state`, `dup_note`, `external_url`, `exhibit_base`, `page`, `row_index`.

`exhibit_base` + `page` + `row_index` point at the exact spot on the exhibit PDF,
which is what makes a spot-check fast.

## Verdict distribution (decisions file, 2026-10-31)

| `verdict` | rows | `counted` | What `reason` says |
|---|---:|---|---|
| INDEPENDENT | 314 | 301 | *no shared author with the cited paper* |
| DEPENDENT | 91 | 0 | *shares an author with the cited paper*, names in `shared_authors` |
| REVIEW | 14 | 0 | unsettled — 9 not indexed and Scholar's list incomplete, 3 contradicted, 2 externally clean but Scholar's list incomplete |
| SELF (FORMER PI) | 4 | 0 | *lists the former PI* |

The 13 INDEPENDENT rows not counted all read *looks non-English - a certified
human translation is needed before it can be counted*, matching the ledger's
`flagged_non_english` figure. A `verdict` of INDEPENDENT therefore does not mean
counted — the 13 are classified independent and deliberately left unhighlighted.

## Three things to look at while reviewing

1. **Two patent numbers collapsed into one row.** `US10993914B2` and
   `US12059497B2` are both titled *Stabilizing camptothecin pharmaceutical
   compositions* (Drummond, Kirpotin, Hayes et al.), both citing the sucrose
   octasulfate paper. Distinct-paper identity is title-based, so the dedupe treats
   them as one work and only the first appears in the 296-row draft. They are two
   separate granted patents, each with its own number, so a patent list should
   probably show both. This is a rule question for the user and the attorney, not
   a data error — `tools/tally.js` is the single definition and has not been
   changed. `node tools/query-catalog.js patents` shows all four patent rows.

2. **296 is per cited paper, not globally unique.** The 296 rows hold 279
   distinct titles: 15 papers cite more than one of the PI's works, adding 17
   rows because each is listed once under each work it cites. A single global
   claim of "cited by N distinct papers" should use 279, not the sum of the
   per-publication figures.

3. **64 rows counted on Scholar's list alone** (`confirm_state` =
   `unverified-coverage`) — not indexed by PubMed or OpenAlex, so no external
   record confirms the author list. Typical of patents, theses and preprints.
   These need the spot-check listed in the Progress Tracker before they are
   leaned on.

## Reproducing

```
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
node tools/query-catalog.js sql "<SELECT ...>" --csv | Out-File -Encoding utf8 Drafts\<name>.csv
```

Setting the console encoding first matters: without it PowerShell decodes node's
UTF-8 output with the OEM codepage and en-dashes in titles arrive mangled.

Two limits in the read-only guard are worth knowing when writing an ad-hoc query:
it rejects the word `REPLACE` anywhere in the statement, including the SQL string
function, and it rejects semicolons including those inside quoted text. Use
`json_each` to unpack `matched_authors`, and a slash or dash as a separator
instead of a semicolon.

Two limits in the read-only guard are worth knowing when writing an ad-hoc query:
it rejects the word `REPLACE` anywhere in the statement, including the SQL string
function, and it rejects semicolons including those inside quoted text. Use
`json_each` to unpack `matched_authors`, and use a slash or dash as a separator
instead of a semicolon.

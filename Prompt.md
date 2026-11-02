# Task: build a SQLite catalog of captured Google Scholar citations (EB1A RFE project)

Workspace: `c:\Projects\EB1A` (Windows, PowerShell 5.1, no git).

**Read `.github\copilot-instructions.md` first and follow it.** This is a real immigration evidence packet, so the accuracy rules there are binding.

## CRITICAL working constraints — ignoring these is what astalled previous sessions

- **Never use `node -e "..."` in the terminal.** Nested quotes, `$` and `&` break PowerShell 5.1 parsing and wedge the terminal waiting for input. Instead write a throwaway script under `tools/` (e.g. `tools/.tmp-foo.js`), run `node tools/.tmp-foo.js`, then delete it. `tools/.tmp-keys.js` already exists as an example.
- Prefer one command at a time and wait for its output. Do not re-run a command that merely looked slow.
- **Do not browse Google Scholar in this session.** Capture work is gated on the user clearing a verification wall. This is offline work over files already on disk.
- Make no changes to existing exhibit PDFs, report JSON, or the ledger. New files only.

## Project context

We are building an EB1A RFE "Independent Citation Record" from Google Scholar profile `dNLaKGAAAAAJ`. Snapshot **2026-10-29**: 1,495 citations, h-index 23, i10-index 34, 48 publications. The pipeline captures each publication's "cited by" pages as PDF exhibits with only confirmed independent citations highlighted in yellow.

Independence rule: a citing paper is independent only if it shares no author with the cited paper. Papers by the current PI (RD Cummings) or the former PI (UR Desai) are always self-citations. "Desai" and "Cummings" are common surnames, so matching is surname plus initials.

Current filed state (from `node tools/summarize-progress.js`):

```
Publications with a filed exhibit: 23 of 48
Exhibit PDF pages:                 48
Citation records reviewed:         388
Independent and highlighted:       274  (217 externally confirmed, 57 on Scholar's complete list)
Dependent:                         90
Self-citations (former PI):        4
Awaiting manual review:            12
Flagged non-English:               8
```

## What to build

1. **`tools/build-catalog.js`** — idempotent full rebuild of
   `Independent Citation Record\Exhibits\Supporting\citation-catalog.sqlite`
   from all `*.report.json` files plus the publication snapshot. Prints a summary.
   Also support `--pub=<base>` to upsert a single publication (used by the batch hook).
2. **`tools/query-catalog.js`** — read-only CLI, subcommands:
   - `patents` — citing patents: publication number, kind, title, authors, link, which PI paper it cites, independence status
   - `stats` — counts by status / work_type / confirm_state, overall and per publication
   - `search <terms>` — full-text search over title + authors + snippet
   - `pub <text|cites_id>` — everything citing one publication
   - `review` — rows with `needs_attention` or `status = 'REVIEW'`
   - `sql "SELECT ..."` — SELECT only, reject anything else
   - `--csv` on any subcommand
3. **`tools/test-work-type.js`** — offline tests for the classifier (see below).
4. **Hook into `tools/run-batch.js`** so each capture updates the DB automatically (call the catalog upsert right after `writeRunLog(runLog)` near line 312, and make sure a blocked attempt cannot corrupt the DB).
5. Run the backfill and **print the patent list**.
6. Update `Independent Citation Record\Progress Tracker.json` with the new artifacts.

## Binding rules

- **`tools/tally.js` is the single definition of what counts.** Import and use `isHighlighted`, `isIndependentPending`, `paperKey`, `uniquePapers`, `tallyEntries`, `emptyTally`, `addTally`, `citesId`, `filedBases`, `groupReports`, `expectedPages`, `pct`. Do not reimplement any counting logic.
- **The DB is a lookup layer, never a second ledger.** Per project instructions, any figure quoted in the packet comes from `citation-ledger-<snapshot>.csv` written by `tools/build-ledger.js`. State this in the file header and in the `stats` output.
- Count only publications whose exhibit PDF is currently filed; `tally.groupReports(SUPPORT_DIR, PDF_DIR)` already does that filtering (it skips `Exhibits/Archive` and `SUPERSEDED-` names). Store a `filed` flag on rows so queries can widen, but default totals to filed-only.
- Patents must stay separable from article citations, never folded into the article count.
- Keep `node tools/build-ledger.js` output reconciling with the DB totals; report any mismatch rather than silently "fixing" one side.

## Verified data shapes (confirmed today — do not re-investigate)

`Exhibits/Supporting/publications-list-2026-10-29.json`:

```
{ source, snapshot_date, total_publications,
  publications: [{ title, authors, venue, year, citedBy, citesUrl, paperUrl }] }  // 48 entries
```

`Exhibits/Supporting/<base>-pN.report.json` — 51 files, 413 entries total.
Top-level keys: `cited_title, cited_authors, cited_venue, paper_url, cites_url, author_keys[], pi_keys[], former_keys[], crosscheck, snapshot, page_header, end_reason, page, entries[]`.

Entry keys (type in parens): `index(number)`, `cid`, `title`, `rawTitle`, `authors`, `snippet`, `truncated(bool)`, `link`, `status`, `confirm_state`, `corroboration`, `corroboration_note`, `matched_authors[]`, `matched_pi[]`, `matched_former_pi[]`, `authors_used`, `author_source`, `full_authors[]`, `popup_sample`, `resolution`, `language_flag`, `page`, `needs_attention(bool)`, `attention_reason`, `external_source`, `external_url`, `external_title`, `external_authors`, `external_matched[]`, `external_similarity(number)`, `pubmed_near_miss(object)`, `openalex_near_miss(object)`.

Many optional keys are absent on a given entry — treat missing as empty.
`status` values: `INDEPENDENT`, `DEPENDENT`, `SELF (PI)`, `SELF (FORMER PI)`, `REVIEW`.
`confirm_state` values: `confirmed`, `unverified-coverage`, `unresolved`, `contradicted`.

**413 entries exist in reports but only 388 are counted** — 25 belong to the archived (superseded) patents capture. Do not let the DB count those as filed.

Existing helper modules:

- `tools/name-match.js` exports `parseOne, parseAuthorList, compareInits, matchKey, toKeys, checkGroup, evaluateEntry`. `parseAuthorList("A, B - Venue, 2020 - site")` returns `[{display, surname, inits}]`.
- `tools/work-type.js` exists but is **untested and has a known flaw to fix**: it scans `title` / `rawTitle` / `snippet` for the word "Patent", which would misfile a journal article *about* patents as a patent. Restrict text matching to the venue carrier fields (`authors`, `authors_used`, `external_title`, `external_authors`) plus the link host, and keep the signature `classifyWork(entry) -> {work_type, patent_number, patent_kind, evidence}`.

## Environment facts already verified

- Node `v26.13.0`; `require("node:sqlite")` → `DatabaseSync` works. SQLite 3.54.0. **FTS5 and JSON1 are both available.**
- Playwright 1.64.1 resolves only from inside `tools/`, so all scripts live there.
- PowerShell `>` redirects are UTF-16; read logs with `Get-Content -Encoding Unicode`.
- Test file style: see `tools/test-name-match.js` — plain `assert`, a `check(label, actual, expected)` helper, sets `process.exitCode = 1` on failure. Existing suites: `node tools/test-tally.js` (50 pass), `tools/test-capture-helpers.js` (58 pass), `tools/test-name-match.js` (22 cases). Run them before and after.

## Suggested schema (adjust freely)

- `meta(key, value)` — schema_version, snapshot_date, built_at, report_file_count.
- `publications` — `cites_id` PK, title, authors, venue, year, `cited_by_at_snapshot`, paper_url, cites_url, exhibit_base, `filed` 0/1, pages_expected, pages_captured, pages_complete.
- `citations` — one row per observed Scholar row: cites_id, base, page, row_index, cid, title, raw_title, authors, authors_used, author_source, truncated, link, snippet, status, confirm_state, corroboration, corroboration_note, language_flag, needs_attention, attention_reason, resolution, external_source, external_url, external_title, external_authors, external_similarity, matched_authors, matched_pi, matched_former_pi, full_authors, plus derived columns: `is_highlighted`, `paper_key`, `is_primary_copy`, `work_type`, `patent_number`, `patent_kind`, `work_type_evidence`, `report_file`.
- FTS5 table over title + authors_used + snippet, kept in sync by the builder.
- Views: `v_patents`, `v_independent_counted`, `v_pub_stats`.
- Indexes on `cites_id`, `status`, `work_type`, `confirm_state`.

## Acceptance criteria

1. `node tools/test-work-type.js` passes.
2. `node tools/build-catalog.js` builds the DB and prints totals that reconcile with `node tools/build-ledger.js` (388 filed records / 274 independent, not 413).
3. `node tools/query-catalog.js stats` reproduces the filed numbers above.
4. `node tools/query-catalog.js patents` finds at least these four known records — this is the key acceptance check:
   - `US20250084117A1` — "Spaced heparinoids: a new class of heparin-like molcules", S Nadji, REN Yingjie, L Fan, R Dhar — cites *Heparan sulfate glycomimetics via iterative assembly of CLIC…*
   - `US11052079B2` — "Liposomes useful for drug delivery", K Hong, DC Drummond, D Kirpotin — cites *Interaction of thrombin with sucrose octasulfate*
   - `US10993914B2` — "Stabilizing camptothecin pharmaceutical compositions", DC Drummond, DB Kirpotin, ME Hayes et al., 2021 — same cited paper
   - `US12059497B2` — same title, 2024 — same cited paper
5. `node tools/query-catalog.js sql "SELECT ..."` works and refuses non-SELECT statements.
6. Progress Tracker records the two new tools, the DB path, and that the DB is a lookup aid while the ledger CSV stays authoritative.

When done, report the patent list and note that capture work is still paused on the verification wall (last blocked attempt 2026-10-30 21:28, evidence at `Exhibits/Supporting/BLOCKED-access-wall-2026-10-30T21-28-42.png`), with the patents publication `cites=7585410930116882242` still needing a re-capture.

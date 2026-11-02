# Prompt: make the SQLite catalog the primary source of information

Paste everything below the line into a new agent session.

---

## Objective

Make `Database/citation-catalog.sqlite` the **primary, durable store** for the
independent-citation record, with **stable row identifiers that never change**.
Today it is a disposable rebuild of the report JSONs and its row `id`s are
reassigned on every build, so no number in it can be quoted or referenced
safely. Change that, without losing a single row that exists now.

The immediate reason for the change: the user is reviewing the citations that
are still unresolved (94 rows with `status = 'REVIEW'` among filed exhibits)
and needs a short identifier per row to quote back. That identifier must be the
database id, and it must still mean the same row next month.

## Read these first

- `.github/copilot-instructions.md` — project rules (accuracy, evidence, browser conduct).
- `Database/citation-catalog-schema.md` — full schema v3 with mermaid diagrams.
- `tools/tally.js` — the single definition of what counts. Never reimplement a rule.
- `tools/build-catalog.js`, `tools/build-ledger.js`, `tools/query-catalog.js`,
  `tools/build-dashboard-data.js`, `tools/audit-highlights.js`.
- `Independent Citation Record/Progress Tracker.json` — current checkpoint.

## Verified facts about the current state (2026-11-02)

These were measured, not assumed. Re-verify each one before acting on it.

- `citations.id` is `INTEGER PRIMARY KEY` with **no `AUTOINCREMENT`**
  (`tools/build-catalog.js` line ~249).
- A full rebuild does `DELETE FROM citations; DELETE FROM publications;`
  (line ~871) and re-inserts **without** supplying `id`, so every id is
  reassigned in build order.
- Worse, the builder `fs.rmSync`s the database file **and its `-wal`/`-shm`
  sidecars** before rebuilding (line ~1122). The header comment states "Deleting
  `Database/citation-catalog.sqlite` is always safe". Under the new model that
  sentence is false and must be rewritten.
- Current contents: **1558 citation rows** (1498 filed, 60 with `filed = 0`),
  48 publications, ids contiguous `1..1558`, zero gaps.
- `node tools/build-catalog.js --check` reports exactly **1558 rows** from 175
  report files, so a rebuild today is count-neutral. That is fragile, and the
  builder's promise to keep "rows for EVERY report observed, including
  superseded captures" is **already broken**:
  - the builder scans `Supporting/` and `Archive/` with a **non-recursive**
    `readdirSync`, while `archive-exhibits.js` moves workpapers into
    `Supporting/Pre-recapture-<date>/` and `reapply-language.js` into
    `Supporting/Pre-rule-reapply-<date>/`;
  - **170** `.report.json` files sit in those subfolders and are invisible to it;
  - **130** of those page-sets have **no rows in the database at all** — verified
    example: `recognition-of-highly-branched-n-glycans-of-the-porcine-whip-citing-2026-10-30`
    returns zero rows, because `archive-exhibits.js` moved its workpapers into
    `Pre-recapture-2026-11-02/` after the 2026-11-02 re-capture and the next
    rebuild silently forgot that capture existed.
  So capture history is already being lost on rebuild, and with reassigned ids
  the loss is invisible. A rebuild must never again be the thing that decides
  what history exists.
- `(base, page, row_index)` is **unique across all 1558 rows** today and is the
  natural durable natural key. `row_index` is the Scholar row position (0-9)
  within the exhibit page.
- `cites_id` is shared by multiple capture sets (4 publications have two dated
  `base` names under one `cites_id`), so it is not a row key.
- The DB **is** git-tracked; `.gitignore` excludes only `*.sqlite-shm`,
  `*.sqlite-wal`, `*.sqlite-journal`.
- `VACUUM INTO '<path>'` works from a `readOnly` `node:sqlite` connection and
  produces a consistent snapshot (verified: 1558 rows).
- The DB has **no** `external_matched` column, although the report JSON carries
  it (it names the authors an external record contradicted). Any lookup that
  needs it must come from the reports or a new column.

## Non-negotiables

1. **Never delete or recreate the database file.** No `rmSync`, no
   `DELETE FROM citations` over the whole table, no drop-and-recreate. The
   existing file is the authoritative copy of the data.
2. **Back up before every structural change**, using `VACUUM INTO` to
   `Database/Backups/citation-catalog-<utc-timestamp>.sqlite`, and verify the
   copy opens and its row counts match before continuing. Also confirm the
   current file is committed to git before migrating.
3. **Ids must be permanent.** Stop assigning `id` implicitly. Introduce a
   `row_uid` that is minted once and never reused, and make it the identifier
   quoted in every table, review sheet and dashboard. Keep the legacy `id`
   column as a frozen alias so ids already quoted by the user still resolve.
4. **A rebuild must be provably non-destructive.** Before writing, compare the
   rows the rebuild would produce against the live table. Refuse to write, with
   a non-zero exit, if any existing row would disappear or any `row_uid` would
   be re-pointed. Report-only mode must exist and be the default.
5. Do not touch anything under `Independent Citation Record/Exhibits/` — that
   is the evidence folder. No bulk deletes anywhere.
6. Keep every counting rule imported from `tools/tally.js`.
7. Do not contact Google Scholar for this work. It is entirely offline.
8. If a CAPTCHA or unusual-traffic screen appears in any browser work, stop
   immediately, save `BLOCKED-*` evidence to `Exhibits/Supporting`, and report
   where you stopped. Never solve it.

## Work to do

### 1. Freeze the current database first
- Confirm `git status` is clean and `Database/citation-catalog.sqlite` is committed.
- Take a `VACUUM INTO` snapshot under `Database/Backups/` and record its row
  counts. Decide and state whether `Backups/` should be gitignored (large
  binaries) or tracked (durability) — the user's priority is that the data
  survives, so if in doubt keep at least the newest snapshot tracked and say so.

### 2. Make identity durable (schema v4)
- Add `row_uid` (a short opaque token, not a bare integer, so it reads as an
  identifier when quoted — something like `cit-000123`) as `UNIQUE NOT NULL`,
  backfilled once from the **current** `id` so the user can quote either.
- Add an explicit `origin` / `source_file` provenance column if one is missing,
  so every row states which report file it came from.
- Add a `superseded_at` / `replaced_by_row_uid` pair if you need to record that
  a re-capture retired a row, rather than deleting it.
- Update `Database/citation-catalog-schema.md` to match, including what happens
  to a row when its exhibit is archived or re-captured.

### 3. Convert the builder from replace to merge
In `tools/build-catalog.js`:
- Stop `rmSync`ing the file and stop `DELETE FROM citations` across the table.
- Upsert by the natural key `(base, page, row_index)`: insert new rows, update
  rows whose content changed, and mint `row_uid` only on insert.
- A row whose report file has gone away is **kept and flagged**, not deleted.
  A re-capture under a new dated `base` creates new rows; the old rows stay as
  history.
- Make the builder read the `Supporting/Pre-*` subfolders too, so the 170
  currently invisible report files (130 page-sets with no rows in the DB) are
  ingested as historical rows rather than staying forgotten. Ingest them with
  `filed = 0` so no headline figure moves — this must be additive only, and
  prove it by showing the filed totals are unchanged afterwards.
- Make the pre-write guard described in non-negotiable 4 the thing that decides
  whether anything is saved.
- Fix the header comment that says deleting the DB is safe.

### 4. Invert the reconciliation direction
Today `build-catalog.js` recomputes from the reports through `tally.js` and
prints ok/DIFF, and the project instructions say the CSV wins on any
disagreement. Under the new model the DB is the store and the report-derived
figures are the check.
- Keep all 15 reconciliation checks running and keep failing loudly on a DIFF.
- Decide explicitly, then write down, what happens when the DB and the
  report-derived figures disagree now that the DB is primary: the disagreement
  is a defect to investigate, and **no figure may be quoted for the packet
  until it is resolved**.
- Update `.github/copilot-instructions.md`, the `build-catalog.js` header, the
  `meta.role` string stored inside the database, and
  `Database/citation-catalog-schema.md`, all of which currently say the CSV is
  authoritative and the DB is disposable. **Do not silently change a rule the
  user relies on** — summarise the wording change and ask the user to confirm
  it before you commit it.
- `tools/build-ledger.js` may keep producing the dated CSV, but it should read
  from the DB and be described as a derived report rather than the source.

### 5. Surface the identifier everywhere it is needed
- `tools/build-dashboard-data.js`: carry `row_uid` on the per-work rows and add
  a review-queue section for the 94 filed `status = 'REVIEW'` rows.
- `tools/query-catalog.js`: print `row_uid` as the first column in every
  listing, and add a `review` view scoped to the unresolved rows with a
  `--decision` path later.
- `tools/audit-highlights.js` and `tools/check-ledger-vs-snapshot.js` must keep
  passing; run them after the change.

### 6. Prove it
- Write an offline test in the existing style (`tools/test-*.js`) that:
  snapshots the row count and a sample of `row_uid` → `(base, page, row_index)`
  mappings, runs the new builder twice, and asserts nothing was deleted, no
  `row_uid` changed, and the second run is a no-op.
- Run the full pipeline and report the figures before and after:
  `build-catalog.js`, `build-ledger.js`, `check-ledger-vs-snapshot.js`,
  `audit-highlights.js`, `build-dashboard-data.js`, plus every `test-*.js`.
- Headline figures that must not move (ledger `2026-11-02`): 1498 filed records,
  1480 distinct papers, 1030 countable independent, 1017 distinct independent,
  94 awaiting review, 47 independent-but-unsettled, 44 withheld for language,
  168 exhibit pages.

## Deliverable the user is waiting on

Once ids are stable, produce the review table the user asked for: the 94 filed
`REVIEW` rows with their `row_uid`, the citing title, the byline Scholar
showed, which of the user's own works it cites, the exhibit page it sits on,
why it is unresolved, any external record that exists, and an empty
"your decision" column. Group them by what the user actually has to do:

- **6 contradicted** — an external record shows a shared or PI author. These are
  candidates to confirm as *not independent*. Two name the former PI
  (Umesh R. Desai), one names the PI (Richard D. Cummings), one names five of
  the user's own co-authors, two name other repeated collaborators.
- **13 external record shows no overlap** — held back only because Scholar's
  own list is incomplete and the rule never promotes on external evidence.
  These are the cheapest wins: a yes from the user makes them countable.
- **75 unresolvable** — Scholar truncated the list with "and others" (49), had
  no Cite control (17), or its BibTeX record had no author field or 404'd (9).
  Five of these also carry a non-Latin-script title flag and would need a
  certified human translation even if the author list were completed.

The user will reply with identifiers and a decision per row, so the
identifiers must be stable by the time that table is handed over.

## Housekeeping

- Update `Independent Citation Record/Progress Tracker.json` when the model
  changes, and record any blocker rather than guessing past it.
- Scratch scripts: put throwaways in `tools/` (Playwright and the local modules
  only resolve there) and delete them before finishing.
- PowerShell 5.1: `&` and nested quotes inside `node -e` break parsing — write a
  throwaway `.js` file instead.

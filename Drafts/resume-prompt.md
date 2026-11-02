# Resume prompt — EB1A Independent Citation Record

Paste everything below the line into a new chat. Written 2026-10-31.

---

Resuming the EB1A Independent Citation Record capture in c:\Projects\EB1A.

Read these first, in order:
1. .github/copilot-instructions.md  (binding project rules)
2. Independent Citation Record/Progress Tracker.json  (working checkpoint)

Then confirm the state below against the tracker before doing anything, and tell
me if they disagree.

## State as of 2026-10-31

- Scholar snapshot 2026-10-29, profile user=dNLaKGAAAAAJ. 48 publications:
  24 captured, 7 show no citation count (no exhibit needed), 17 not started.
- Remaining work: ~116 exhibit pages / ~1,072 citing records.
- Current filed totals: 52 exhibit pages, 423 records over 417 distinct papers,
  301 countable independent (237 externally confirmed + 64 on Scholar's list
  alone), 296 distinct independent papers, 91 dependent, 4 self (former PI),
  14 awaiting review, 13 independent-but-unsettled, 14 flagged non-English.
- Last capture succeeded: "An update on recent patents on thrombin inhibitors
  (2010-2013)", 4 pages / 35 records, 27 independent.

## What to do

Run the next batch of pending publications:

    node tools/run-batch.js --out=Production --auto --skip-done --count=3

Then refresh the ledger (always, after every batch):

    node tools/build-ledger.js

The catalog hook fires automatically inside run-batch; do not hand-edit the DB.
Report figures only from Exhibits/Supporting/citation-ledger-<snapshot>.csv.

## Go slowly on purpose

Google Scholar throws a verification wall on the scholar?cites= endpoint roughly
every 10-20 citing requests. If it appears: stop, save a dated BLOCKED-
screenshot and HTML into Exhibits/Supporting, tell me where you stopped, and wait
for me to clear it. Never try to solve or retry past it. When I say it is
cleared, re-run.

If you need the clearing window proactively, launch it async with:

    node tools/unblock.js --target="<a citing-articles url>"

(the default profile page always loads fine and proves nothing), wait for me to
confirm, then close it before starting a batch so the profile lock frees up.

## Rules that matter most

- `tools/tally.js` is the single definition of what counts. Import it, never
  reimplement a counting rule. The database is a lookup aid, never a second
  ledger.
- Do not modify existing exhibit PDFs, report JSON, or the ledger.
- Highlights stay conservative: only `tally.isHighlighted` rows get yellow.
  REVIEW, DEPENDENT, SELF and any language-flagged row are never marked.
- PowerShell 5.1: chain with ';' not '&&', and never use `node -e "..."` (it
  wedges). Write a throwaway `tools/.tmp-*.js` and delete it instead. For CSV
  output set `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8` first and
  pipe to `Out-File -Encoding utf8`, or titles arrive with mangled dashes.
- Update `Progress Tracker.json` when capture progress, exhibits, or blockers
  change. Validate that it parses as JSON after editing.

## One publication at a time if it is big

GlyGen has 248 citations (~25 pages) and needs its own session. Do not fold it
into a batch. The three smallest pending are Parallel Glyco-SPOT Synthesis of
Glycopeptide (22), Targeting the GPIba Binding Site of Thrombin (31), and
Insights into glycobiology and the protein-glycan interactions (32).

Also worth knowing: 64 highlighted rows still need a manual spot-check, 14 rows
await review and 13 are unsettled (`node tools/query-catalog.js review`), and
there is one open decision about a Portuguese citing paper and one about two
patents sharing a title. Details are in the tracker's open_items.

Start by telling me what you found in the tracker, then wait for my go-ahead
before requesting anything from Scholar.

## Reference material written 2026-10-31

- `Database/citation-catalog-schema.md` — full schema of the lookup database,
  with diagrams of what is stored versus what is counted.
- `Drafts/README.md` — the three review CSVs, their columns, and the open
  questions they raised.
- Verified on 2026-10-31: all 52 filed exhibit pages match the record row by row
  (no yellow mark on a non-independent row, no counted row left unmarked). That
  check was ad-hoc and is not yet a saved tool; re-deriving it means walking the
  `<h3>` title rows of each saved `.html` copy and joining on Scholar's `cid`.

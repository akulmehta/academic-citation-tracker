# Unresolved citations — review queue

Scholar snapshot **2026-11-02**, store built 2026-11-04T18:33:23.143Z. **0** of 1498 active citation rows are on this queue, so none of them is counted as independent and none is counted as dependent either.

17 rows are classified REVIEW in total. 17 not listed here: 5 are flagged non-English, where no certified translation is being obtained (decision of 2026-11-01) so no reading of the byline can change the packet -- see `node tools/query-catalog.js nonenglish`; 12 are a second copy of a work whose published record is already settled, so they take that verdict by inheritance and are listed under Preprint / copy on the dashboard instead.

Quote the **row_uid** when answering — it is permanent, so it still means the same row after a re-capture or a rebuild. The integer id is a frozen legacy alias and should not be used.

| Bucket | Rows | What it means |
|---|---:|---|

**The queue is empty.** Every citation on a filed exhibit page is classified, so nothing is left where reading the published byline would change a figure. A new row can still appear here after a re-capture or a change to what counts.


---

The working file is `Drafts/review-queue-2026-11-02.csv`, which carries the same rows plus `external_authors`, `citing_paper_link`, `scholar_cid`, `language_flag` and a `your_notes` column. Nothing in either file is a decision yet, and no figure in the packet changes until one is recorded.

**To resolve a row:** write `INDEPENDENT`, `DEPENDENT`, `SELF (PI)`, `SELF (FORMER PI)` or `REVIEW` into the `your_decision` column of the CSV (optionally a reason in `your_notes`), then run

```
node tools/apply-decision.js --from-csv --write --reprint --rebuild
```

Drop `--write` first to see the plan. A single row can be decided without the CSV: `node tools/apply-decision.js --row=`cit-000019` --verdict=dependent --write --reprint --rebuild`. A decided row is reported separately as "settled by you" and can be taken back with `--revert`.

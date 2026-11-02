# Project Instructions

This workspace supports preparation of an EB1A RFE response, including organizing evidence and drafting supporting materials. Follow these instructions for all work in the project.

## Accuracy and Evidence

- Treat user-provided documents and primary sources as authoritative. Do not invent facts, dates, citation counts, credentials, quotations, or legal requirements.
- Keep factual statements traceable to a source. Flag missing, conflicting, or unverified information instead of filling gaps with assumptions.
- Preserve the meaning of source documents when summarizing or editing. Clearly distinguish source facts from proposed wording, analysis, and open questions.
- Do not describe assistance as legal advice or make guarantees about USCIS outcomes. Keep legal conclusions and filing decisions with the user's attorney.

## Independent Citation Record

- Follow `Independent Citation Record/Independent Citation Record Guide.md` when preparing citation-record materials.
- Use the user's Google Scholar profile as the primary source for citation totals and citing-paper lists, consistent with the guide. Record the source URL and dated snapshot for any figures reported.
- A citation is independent only when the citing paper and cited paper share no authors. Verify author lists before classifying a citation; do not infer independence from title or institution alone.
- Per the user's instruction, papers authored by the PI (Richard D. Cummings) or the former PI (Umesh R. Desai) are self-citations and are never counted as independent, even on papers that the user did not co-author.
- "Desai" and "Cummings" are common surnames. Match authors on surname plus initials, never surname alone. When surnames collide but initials are unavailable for comparison, flag the entry for manual review instead of counting or excluding it.
- Google Scholar truncates author lists with an ellipsis. Resolve the full list from Google Scholar itself: the cited paper's profile article page (`#gsc_oci_table`) and, for citing entries, the BibTeX record behind that result's "Cite" control. Do not substitute CrossRef or another third-party database as the primary basis for independence.
- Per the user's instruction, corroborate each candidate independent citation against an external record that publishes the complete author list (PubMed via NCBI E-utilities, then OpenAlex) before highlighting it. Google Scholar stays primary: external agreement confirms an entry, an external disagreement downgrades it to manual review, and an entry is never promoted to independent on an external record alone. Record the external source and link. A paper indexed in neither service may still be highlighted when Scholar's own list is complete, but flag it for a spot-check.
- Keep citation counts and percentages tied to a dated Google Scholar snapshot. Identify the source and snapshot date whenever reporting totals.
- Per the user's instruction on 2026-10-30, independent and dependent counts must be kept in a log usable for both per-article and global statistics. Run `tools/build-ledger.js` after every batch and quote figures from `Exhibits/Supporting/citation-ledger-<snapshot>.csv` (and its `.json`) rather than recomputing them; each run also appends a line to `citation-ledger-history.csv`. Do not maintain a parallel tally: `tools/tally.js` holds the single definition of what counts, and a publication contributes only while its exhibit PDF is filed.
- PENDING USER CONFIRMATION (2026-11-02 — a wording change to the bullet above, flagged rather than quietly applied): the bullet still stands, quote from the dated CSV and never recompute by hand. What changed is which artifact holds the rows. What changed is which artifact holds the rows. `Database/citation-catalog.sqlite` is the primary durable store of the citation rows and must not be deleted; `tools/build-ledger.js` reads the active rows out of it and its CSV is a **derived report** of those rows, while still recomputing the same figures independently from the report JSON as a cross-check. A disagreement between the two is a defect to investigate, is resolved in neither side's favour, and both tools exit non-zero and write nothing — so do not quote any figure from a run that failed, and do not "fix" it by picking the number you prefer.
- Refer to a citation row by its `row_uid` (`cit-000106`), never by the integer `id`. The uid is minted once, never reused, and still means the same row after a re-capture or a rebuild; `id` is a frozen legacy alias. Every listing from `tools/query-catalog.js` leads with it. A row whose exhibit is archived or re-captured is retired with `superseded_at` and a reason, never deleted, and `tools/build-catalog.js` merges into the store rather than replacing it — run it without `--write` first to see the plan.
- `Database/Backups/` holds the verified pre-write snapshots the builder takes. Keep them on disk as the recovery path; do not commit them (they are several megabytes each and a new one appears on nearly every run) and do not delete them to save space. The tracked durable copy is `Database/citation-catalog.sqlite` itself.
- For non-English citations, do not treat machine translation as certified. Follow the guide's requirement for a human translator fluent in both languages and an accompanying certification/affidavit; otherwise exclude those entries from highlighted and adjusted English-only totals.
- Per the user's decision on 2026-11-01, no translations will be obtained. Non-English entries stay unhighlighted and the packet reports an adjusted independent total and percentage based solely on English citations, which is the guide's second path. The guide's test is whether an entry is "listed in English", meaning its title, author list and venue, not its body — so a foreign-language abstract under an English title is not evidence of a non-English entry.
- A change to a counting rule does not reach exhibits already captured, because each report's flags were written at capture time. Applying one is an offline sequence: `tools/reapply-language.js --write`, then `tools/reprint-exhibits.js --changed --write`, then rebuild the ledger and catalog and re-run `tools/audit-highlights.js` and `tools/test-pdf-fit.js`. Both tools back up what they touch and the re-printer refuses to save unless its applied mark count matches the rule.
- Preserve the user's existing files and organization. Make narrowly scoped changes and do not silently discard or overwrite user-authored material.
- Exhibit PDFs must look like a Google Scholar results page where only confirmed independent citations are highlighted in yellow. Do not add legends, review marks, or faded rows to an exhibit; keep such annotations in the separate review notes or behind a debug flag.
- Per the user's instruction on 2026-10-29, every exhibit PDF page must print a header showing the Google Scholar URL it was captured from (plus the snapshot date) and a footer with page numbers. This is the one permitted annotation; it overrides the earlier no-print-header rule.
- Per the user's instruction on 2026-10-29, exhibit PDFs print on US Letter at 75% scale, which the user verified fits a citing-articles page onto a single sheet. `tools/test-pdf-fit.js` checks this offline against a saved page; run it after changing any print setting rather than assuming the fit holds.
- Google Scholar shows 10 citing articles per page for this profile, and a `pagesize=20` parameter does not change that. Page through a citing list by following the page's own "Next" link, which carries Scholar's real step size and query parameters; hand-built `start=` offsets drop parameters such as `as_sdt`, `sciodt`, and `scipsc` and silently skip records. Expect roughly one page per 10 citations.
- Greek letters in a title are scientific notation, not evidence of a non-English paper (for example an alpha-1,2-mannosidase or beta-catenin title is English). Treat a small number of Greek letters alongside substantial Latin text as notation and do not suppress the citation; only flag it when Greek letters make up the body of the text. Per the user's instruction on 2026-11-02 this is implemented as a **share** test, not a count: `tools/capture-citations.js` flags Greek only above 25% of the letters, and a stray non-Latin character in a snippet flags only above the same share (one Cyrillic epsilon in a chemical-name abstract is a rendering artifact, not a foreign-language entry).

## Access and Progress Tracking

- If a CAPTCHA, unusual-traffic screen, sign-in challenge, or other access wall appears, stop browsing and data collection immediately. Do not solve, bypass, or repeatedly retry the challenge. Tell the user what appeared and where work stopped, then wait for the user to clear it before resuming.
- Maintain `Independent Citation Record/Progress Tracker.json` as the working checkpoint. Update it when access, review progress, generated exhibits, or blockers change; keep the last verified step, next step, source/date, and unresolved items accurate. Do not record guesses as facts.
- Before stopping at an access wall, record the checkpoint in the tracker so the work can resume from that point.
- Do not claim a browser page was saved or printed to PDF unless an actual PDF file was produced and verified.

## Browser Automation Conduct

- Prefer the existing capture tooling in `tools/` (`capture.js`, `capture-citations.js`, `list-all-publications.js`) and its shared pacing module `tools/human.js`. Reuse these helpers rather than writing new fixed-delay navigation.
- Browse politely to reduce rate-limiting: use randomized waits, not fixed ones. Approximate guidance: 3-6s to let a page settle, 6-14s between distinct pages with occasional longer pauses, and 3-7s after actions such as "Show more". Slow is acceptable; the packet is not time-critical.
- Interact the way a person does: move the cursor in steps rather than teleporting, scroll in uneven increments with brief reading pauses, and return to the top before extracting or printing.
- Keep the request volume minimal. Fetch only the pages needed for the current step, batch related reads in one session, and never parallelize requests to the same host.
- Treat a disabled control as "busy": wait and retry at most once, then treat the list as complete. Do not hammer a button or URL in a tight retry loop.
- Reuse the persistent browser profile (`tools/.playwright-profile`) so an access grant the user already obtained carries over, reducing repeat challenges.
- Slowing down is courtesy only. 
- Use `channel:chrome` to ensure the browser automation runs with the Chrome channel, which may help maintain consistent behavior and reduce detection issues. Chrome was installed on 2026-10-29 at `C:\Program Files\Google\Chrome\Application\chrome.exe` and the channel resolves; `tools/human.js` still falls back to the bundled Chromium with a logged notice if it ever stops resolving, so check for that line at the start of a run rather than assuming Chrome is in use.
- When an access wall stops a run, save a dated screenshot and HTML copy of the screen into `Exhibits/Supporting` with a `BLOCKED-` prefix. These are the record of where work stopped and must never be filed alongside the exhibits in `Exhibits/PDFs`.

## Drafting and File Changes

- Use clear, professional language suitable for an immigration evidence packet. Avoid overstating the strength or significance of evidence.
- Retain source titles, author names, venues, and dates accurately. Mark uncertain details for review rather than silently normalizing them.
- Before making material changes to evidence or claims, explain the factual basis and flag any needed user or attorney confirmation.

## Improving These Instructions

- As work progresses, refine this file with durable project-specific preferences and lessons learned; keep it concise, avoid one-off details, and discuss with the user before changing or removing an existing rule.
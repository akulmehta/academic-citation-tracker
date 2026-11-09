# Session scratch moved out of the repo root

`archived-scripts/` and `archived-logs/` are where the PDF-retrieval sessions put
their working files so the repository root stays clean. Nothing in here is
evidence, and both folders are git-ignored.

- `archived-scripts/` — one-off `.cjs` drivers, probes and checkers.
- `archived-logs/` — the dumps, maps and notes those scripts wrote, plus
  `screenshots/` of the access walls that were hit.

Two of these are still part of the pipeline and are reached from here on purpose:

- `_post.cjs` — gates a captured PDF (magic bytes, preprint stamp, page-1 title
  overlap against the record's title) and files it as `downloads/<uid>.pdf`.
- `_flat.cjs` — flattens a driver dump into `{uid: base64}` and merges every
  `_map_*.json` into `_mapall.json`.

Run them with `node archived-scripts\_post.cjs …` from the repo root. The gate
never overwrites an existing `downloads/<uid>.pdf`.

## Retrieval helpers worth keeping

These are the ones a later wave should reach for, in the order the work goes:

- `title-gate.cjs` — **run after every download, before marking a row.** Verifies
  the PDF really is the catalogued article: verbatim 45-char title prefix, else
  ≥80% distinctive-word overlap. Never mark a row without it.
- `repofetch.cjs` — node-side fetch for rows whose `citing_url` is already a direct
  file endpoint. Asks `heldPdfIndex()` first and prints `already on file: <where>`,
  which is what stops a wave re-fetching a paper the packet filed months ago.
- `directurls.cjs` — lists the rows that `repofetch.cjs` can act on.
- `residual-buckets.cjs` — categorises the residual `no-open-copy` rows **from
  `download-queue.csv`**, i.e. from `classify()` itself. `--list` prints the
  open-access and "other" rows.
- `recover-temp.cjs` — decodes base64 out of an MCP temp-output file into
  `downloads/<uid>.pdf`.
- `check-md.cjs` — read-only markdown sanity check for the documentation this effort
  writes: unbalanced code fences, a UTF-8 BOM, and mojibake outside inline code.
  `node archived-scripts\check-md.cjs <file> …`, exits 1 on any problem. It exists
  because `Set-Content -Encoding utf8` writes a BOM that silently poisons the first
  character of a commit subject, and because a `Get-Content` + `Set-Content`
  round-trip turns every em dash into `â€”`.
- `potential-count.cjs` — recounts what `potential_notable_citations.html` asserts
  (candidate rows, tier claims) so a figure quoted in prose can be checked against
  the generated page rather than trusted.
- `_efetch3.cjs`, `_wileypd.cjs`, `_metapdf.cjs`, `_sameorig.cjs`, `_oa3.cjs` —
  Playwright drivers. `_metapdf.cjs` reads the site's own `citation_pdf_url`, which
  is the canonical PDF route; guessing publisher paths is what produced the false
  `no-pdf-bytes` results.

## Known-defective — kept so the mistake is not repeated

- `never-tried.cjs` and `residual-report.cjs` **re-derive `classify()` instead of
  reading the CSV**, so they pull in rows already routed to `skipped-thesis`,
  `-book` and `-preprint` and report the pool as 360 when `download-queue.js`
  reports 123. Do not size a wave from either. Use `residual-buckets.cjs`.

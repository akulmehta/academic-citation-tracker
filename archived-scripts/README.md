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

# Staged PDFs — retrieval working copies

These are the bytes retrieved from publishers and repositories, kept as the master
copies the filed PDFs were copied from. `file.source_pdf` in `notable-citations.sqlite`
points here, so deleting a file leaves a filed row whose provenance cannot be opened.
Filed copies are byte-identical (`file-pdf.js` copies, never re-saves).

Retrieved 2026-11-09. See §2.2 of `../notable-citations.instruction-draft.md` for how.

## Filed

| staged file | filed as | note |
|---|---|---|
| `cit-000507-Campbell.pdf` | `pending-papers/cit-000507/` | ScienceDirect, access already granted |
| `cit-000523-Kimber.pdf` | `screened-papers/cit-000523/` | title probe needed the ligature fix |
| `cit-000525-Yamashita.pdf` | `pending-papers/cit-000525/01-article-Haab-2021.pdf` | staged name is wrong — senior author is Haab |
| `cit-000531-Pekosz.pdf` | `pending-papers/cit-000531/` | bioRxiv |
| `cit-000532-Hokke.pdf` | `pending-papers/cit-000532/` | |
| `cit-000534-wiley.pdf` | `screened-papers/cit-000534/` | |
| `cit-000538-Kiessling.pdf` | `pending-papers/cit-000538/` | PMC |
| `cit-000541-Cha.pdf` | `pending-papers/cit-000541/` | PMC, via base64 capture past a proof-of-work + reCAPTCHA |
| `cit-000549-Swanson.pdf` | `pending-papers/cit-000549/` | JHU Scholarship bitstream |
| `cit-000554-Sukhija.pdf` | `pending-papers/cit-000554/` | |
| `cit-000562-Feizi.pdf` | `pending-papers/cit-000543/01-article-Feizi-2022.pdf` | **filed under a different row** — see below |
| `cit-000564-article.pdf` | `pending-papers/cit-000564/` | Freiburg dissertation |
| `cit-000566-article.pdf` | `pending-papers/cit-000566/` | SciTePress |

## Deliberately not filed

**`cit-000555-article.pdf`** — Leiden's download link serves a 2-page cover sheet, not
the thesis body. `file-pdf.js` refused it on the identity check, correctly. The thesis
needs a different URL. Separately, **Google Scholar itself renders this title with
dropped letters** (`"Ad ancing helminth gl comics … immunogenicit … gl cans"`); the
damage is in the filed exhibit HTML and in Scholar's own BibTeX, so the packet
reproduces a defective byline rather than introducing one. Worth telling counsel
before that title appears in a filing.

**`cit-000560-Feizi.pdf`** (596,143 b) — the same article as `cit-000562-Feizi.pdf`
(595,628 b; the sizes differ because one is the advance-access pagination and the other
the issue pagination). Not filed a second time.

## The three CarbArrayART rows are one article

`cit-000543`, `cit-000560` and `cit-000562` carry three different Scholar titles
(`…a new software tool…`, `CarbArrayART-An update…`, and bare `CarbArrayART`) for what
Europe PMC (PMID 35352122 / PMC9191619) and Crossref both return as exactly one
article, `cwac018`. Both repositories deposit that same file. It is filed once, under
`cit-000543`, the row whose title the deposited PDF actually matches — filing it twice
would present one citing paper as two.

Whether the record should fold the other two rows is the applicant's call through the
record's own `tools/apply-decision.js --same-work-as`, not something to change from the
packet side.

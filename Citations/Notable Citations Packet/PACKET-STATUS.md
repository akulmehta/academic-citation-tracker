# Packet status — open items

Generated 2026-11-07 by `scripts/build-status.js`. **Do not hand-edit it** — re-run the
script. Every count and every row below is read from `notable-citations.sqlite` at run time,
so this document cannot quietly fall behind the data.

This document is for the applicant, not for counsel. [`packet.html`](./packet.html) is the
lawyer's document and contains only the citations that are ready to present. The rows listed
here are deliberately **not** in it: they are unobtainable, unverified, or waiting on a
decision that only a person can make.

## 1. Where the packet stands

| | count |
|---|---:|
| Citations in the packet (in `packet.html`) | 23 |
| Works those citations are filed as (§5.1 folders) | 14 |
| PDFs filed under `papers/` | 22 |
| Held — open items, listed below | 38 |
| Screened out — decided, kept for the record (§4.5) | 0 |
| **Rows in table `citation`** | **61** |

`packet.csv` holds the 23 included rows. `screened-out.csv` holds the other 38,
because §4.5 exports `screened-out` and `held` together — counsel is entitled to see that the
work was screened and on what grounds. A screened-out row is not missing work: it is the
record of what was looked at and rejected, with the reason beside it. A held row is open, and
every held row appears in §2 below.

## 2. Held rows — 38 open items


### 2.1 `read` — 2 row(s)

The PDF is filed and the applicant's tool appears in a section of the paper. What is missing is the applicant's reading: a location on its own is not a claim about how the tool was used (§1.1).

| row_uid | tool | year | senior author | citing title | link |
|---|---|---|---|---|---|
| `cit-000510` | GLAD | 2023 | Pekosz | 2019–2020 H1N1 clade A5a. 1 viruses have better in vitro fitness compared w… | [open](https://www.nature.com/articles/s41598-023-37122-z) |
| `cit-000520` | GLAD | 2025 | Vasta | A “proto” type galectin expressed in striped bass (Morone saxatilis) tissue… | [open](https://www.frontiersin.org/journals/cellular-and-infection-microbiology/articles/10.3389/fcimb.2025.1572734/full) |

### 2.2 `unread` — 1 row(s)

The PDF is filed. Nobody has read it yet.

| row_uid | tool | year | senior author | citing title | link |
|---|---|---|---|---|---|
| `cit-000565` | GLAD | 2019 | Afanasiev | Metabolite Multiprobiotic | [open](https://books.google.com/books?hl=en&lr=&id=jGiTEQAAQBAJ&oi=fnd&pg=PA71&ots=uH3IOUCcDj&sig=BfNqav-_QtYA6fpWtFBSSGOSDf0) |

### 2.3 `unsupported` — 4 row(s)

The PDF is filed, but the extracted text does not support a use in any section — the mentions sit in the reference list, in a table, or under a heading the paper did not print. Either re-read the page and record what it says, or screen the row out.

| row_uid | tool | year | senior author | citing title | link |
|---|---|---|---|---|---|
| `cit-000536` | GLAD | 2019 | Afanasiev | Metabolite multiprobiotic formulas for microbial health | [open](https://www.intechopen.com/chapters/67420) |
| `cit-000550` | GLAD | 2019 | Lisacek | A bioinformatics view of glycan–virus interactions | [open](https://www.mdpi.com/1999-4915/11/4/374) |
| `cit-000511` | GLAD | 2020 | Cummings | Development of smart anti-glycan reagents using immunized lampreys | [open](https://www.nature.com/articles/s42003-020-0819-2) |
| `cit-000513` | GLAD | 2020 | Zou | Databases and bioinformatic tools for glycobiology and glycoproteomics | [open](https://www.mdpi.com/1422-0067/21/18/6727) |

### 2.4 `paywalled` — 9 row(s)

A copy exists behind a paywall. If the applicant can obtain the PDF through an institution, drop it in the folder and the row can be read.

| row_uid | tool | year | senior author | citing title | link |
|---|---|---|---|---|---|
| `cit-000541` | GLAD | 2020 | Cha | An automated fast healthcare interoperability resources-based 12-lead elect… | [open](https://pmc.ncbi.nlm.nih.gov/articles/PMC7214107/) |
| `cit-000508` | GLAD | 2021 | Lewis | Big-data glycomics: tools to connect glycan biosynthesis to extracellular c… | [open](https://www.cell.com/trends/biochemical-sciences/abstract/S0968-0004(20)30266-8) |
| `cit-000514` | GLAD | 2022 | Hokke | Mass spectrometric and glycan microarray–based characterization of the fila… | [open](https://www.mcponline.org/article/S1535-9476(22)00009-3/fulltext) |
| `cit-000543` | GLAD | 2022 | Feizi | CarbArrayART: a new software tool for carbohydrate microarray data storage,… | [open](https://academic.oup.com/glycob/article-abstract/32/7/552/6555547) |
| `cit-000553` | GLAD | 2022 | Bunyakiat | A Visual Dashboard of Thai Weaving Pattern Image Gallery | [open](https://www.sciencedirect.com/science/article/pii/S1877050922005026) |
| `cit-000538` | GLAD | 2023 | Kiessling | Lectin fingerprinting distinguishes antibody neutralization in SARS-CoV-2 | [open](https://pmc.ncbi.nlm.nih.gov/articles/PMC10214521/) |
| `cit-000512` | GLAD | — | Aoki-Kinoshita | Worldwide glycoscience informatics infrastructure: the GlySpace Alliance | [open](https://pubs.acs.org/jaaucr/article-abstract/3/1/4/1253251) |
| `cit-000548` | GLAD | — | Perez | CBMcarb-DB: interface of the three-dimensional landscape of carbohydrate-bi… | [open](https://books.rsc.org/books/edited-volume/2205/chapter/8051227) |
| `cit-000562` | GLAD | — | Feizi | CarbArrayART | [open](https://run.unl.pt/entities/publication/48e256d4-d5a1-4fde-a8a0-ec184408ff34) |

### 2.5 `no-open-copy` — 14 row(s)

No openly accessible copy was found. The publisher's landing page is given so the applicant can check institutional access.

| row_uid | tool | year | senior author | citing title | link |
|---|---|---|---|---|---|
| `cit-000526` | GLAD | 2019 | Kunej | Rise of systems glycobiology and personalized glycomedicine: why and how to… | [open](https://journals.sagepub.com/doi/abs/10.1089/omi.2019.0149) |
| `cit-000507` | GLAD | 2020 | Campbell | Recent advances in glycoinformatic platforms for glycomics and glycoproteom… | [open](https://www.sciencedirect.com/science/article/pii/S0959440X19301356) |
| `cit-000524` | GLAD | 2020 | Imberty | Structural database for lectins and the UniLectin web platform | [open](https://link.springer.com/protocol/10.1007/978-1-0716-0430-4_1) |
| `cit-000546` | GLAD | 2020 | — | Decoding glycans: deciphering the sugary secrets to be coherent on the impl… | [open](https://pubs.rsc.org/ra/article-abstract/10/56/34099/702166) |
| `cit-000547` | GLAD | 2020 | Aruleba | Visual data mining: A comparative analysis of selected datasets | [open](https://link.springer.com/chapter/10.1007/978-3-030-71187-0_35) |
| `cit-000566` | GLAD | 2020 | — | SugarArray: A User-centred-designed Platform for the Analysis of Lectin and… | [open](https://www.scitepress.org/PublishedPapers/2020/89601/89601.pdf) |
| `cit-000525` | GLAD | 2021 | — | Combined analysis of multiple glycan-array datasets: new explorations of pr… | [open](https://pmc.ncbi.nlm.nih.gov/articles/PMC8862541/) |
| `cit-000561` | GLAD | 2021 | Willats | Carbohydrate Microarray Technology | [open](https://link.springer.com/chapter/10.1007/978-3-030-77791-3_10) |
| `cit-000523` | GLAD | 2022 | Kimber | Secreted filarial nematode galectins modulate host immune cells | [open](https://www.frontiersin.org/journals/immunology/articles/10.3389/fimmu.2022.952104/full) |
| `cit-000532` | GLAD | 2023 | Hokke | Unraveling cross-reactivity of anti-glycan IgG responses in filarial nemato… | [open](https://www.frontiersin.org/journals/immunology/articles/10.3389/fimmu.2023.1102344/full) |
| `cit-000531` | GLAD | 2024 | Pekosz | Clade-defining mutations in human H1N1 hemagglutinin protein from 2021-2023… | [open](https://www.biorxiv.org/content/10.1101/2024.05.18.594815.abstract) |
| `cit-000534` | GLAD | — | Schmidt | Involvement of N‐glycans in binding of Photorhabdus luminescens Tc toxin | [open](https://onlinelibrary.wiley.com/doi/abs/10.1111/cmi.13326) |
| `cit-000563` | GLAD | — | Schmidt | Involvement of N-glycans in binding of Photorhabdus | [open](https://www.academia.edu/download/106476898/cmi.pdf) |
| `cit-000567` | GLAD | — | Tiemeyer | Glycoinformatics resources integrated through the GlySpace Alliance | — |

### 2.6 `not-in-indexes` — 8 row(s)

Neither PubMed nor OpenAlex returned the work, so there was nothing to fetch. These tend to be theses, book chapters, or commercial pages.

| row_uid | tool | year | senior author | citing title | link |
|---|---|---|---|---|---|
| `cit-000554` | GLAD | 2021 | Sukhija | Glycobioinformatics in deciphering the mammalian glycocode: Recent advances | [open](https://www.dattaconsultinggroup.com/akdsite/assets/publications/glycocodearticle.pdf) |
| `cit-000549` | GLAD | — | — | CHARACTERIZATION OF IN VITRO FITNESS AND ANTIGENIC DRIFT DIFFERENCES BETWEE… | [open](https://jscholarship.library.jhu.edu/items/0dbcacaf-9e37-49c3-8a95-a3f55b8ae645) |
| `cit-000552` | GLAD | — | — | METABOLITE MULTIPRO/SYNBIOTICS: APPROACHES FOR CONSTRUCTING | — |
| `cit-000555` | GLAD | — | — | Ad ancing helminth gl comics: structural specificit and immunogenicit of sc… | [open](https://scholarlypublications.universiteitleiden.nl/access/item%3A4212215/download) |
| `cit-000556` | GLAD | — | — | Phenotyping murine and human platelet-derived extracellular vesicles gives … | [open](https://www.rpthjournal.org/cms/10.1016/j.rpth.2026.103414/attachment/5e1ef181-290b-47ad-a0b6-2820746565cf/mmc1.pdf) |
| `cit-000559` | GLAD | — | — | Glycan Microarray Data Analysis: From Raw Data to Public Database Integrati… | [open](https://www.creative-proteomics.com/resource/glycan-microarray-analysis-and-database-integration.htm) |
| `cit-000560` | GLAD | — | Feizi | CarbArrayART-An update on the software tool for carbohydrate microarray dat… | [open](https://spiral.imperial.ac.uk/entities/publication/6ebd01fb-2687-4761-a614-c85c1a192b24) |
| `cit-000564` | GLAD | — | — | Structure-function analysis of the photorhabdus Tc toxin complex | [open](https://freidok.uni-freiburg.de/files/166648/Qf-K5JUjPFmyT68-/Peter+NjengaThesis.pdf) |

## 3. Decisions the packet is waiting on

These are not defects. Each is a question whose answer changes what the packet says, so it is
recorded here rather than resolved by a script.

### 3.1 The paper → project number mapping is an inference, not a decision

§5.3 of the instructions names the four projects, copied verbatim from the Research Background
Inquiry Form. **Nothing in the repository, and nothing in the applicant's own notes, maps a
specific PI paper to a project number.** The assignment below is the assistant's reading of
those titles. It drives the section headings in `packet.html`, so it should be confirmed before
counsel relies on them:

| cited paper | project as filed |
|---|---|
| GLAD | 2 |
| GlycoGlyph | 2 |
| MAWE | 3 |

Distribution over all 61 rows: `2` = 53, `3` = 7, `(blank)` = 1.

If a number is wrong, the single place to change it is `toolForCitedPaper` /
`projectForCitedPaper` in [`scripts/lib.js`](./scripts/lib.js), then re-run the importer and
`scripts/render-packet.js --write`.

### 3.2 Rows whose tier disagrees with the folder the applicant filed them in

§1.1 ranks a citation by where the citing paper mentions the tool, and the applicant's own
folders record that reading — `In Methods`, `In Results and Figures`, `In Acknowledgements`.
These rows carry a tier that does not match the folder they came from. The importer takes the
applicant's note as the authority and the folder as a secondary signal, which is usually right
— but where the gap could matter to counsel, it is here:

| row_uid | filed from | folder implies | row carries |
|---|---|---|---|
| `cit-000521` | `Citations/In Methods/GLAD-Wilson-2026.pdf` | tier A | tier B |
| `cit-000542` | `Citations/In Acknowledgements/Dianne-van-der-Wal_GLAD.pdf` | tier D | tier A |
| `cit-000416` | `Citations/In Methods/Yann-Guerardel-MAWE-cwag085.pdf` | tier A | tier C |

`cit-000521` is the ordinary case: the applicant filed it under `In Methods` but recorded the
use as tier B (Results). The scanner finds GLAD in a Results figure caption *and* in Methods
on p.10, so both readings have something behind them and §3.3 lists it again.

`cit-000542` is the case worth a decision. The applicant's note records **both** a Methods
sentence — *"Glycan Array Dashboard (version 3.1) was used to analyze and visualize the
glycan array data."* — **and** an Acknowledgments line thanking the applicant by name, which
is presumably why the PDF was filed under `In Acknowledgements`. The same note records that
the analysis used a **lectin array, not a glycan microarray**. The row sits in the packet at
tier A on the strength of the Methods sentence. That is a defensible reading, but it is a
reading, and counsel should know the paper also thanks the applicant personally. Decide
whether to keep it, demote it, or hand it over with both quotations and let counsel weigh it.

### 3.3 Included rows where the article text reads differently than the note

The scanner reports what it read in a separate column (`scan_tier`) and never overwrites the
applicant's `tier`. It cannot see a figure or judge prose the way a reader can, so a
disagreement is a prompt to re-read the page, not a correction. These rows stay in the
packet until a person says otherwise:

**The tool is in a section, but a different one than recorded:**

| row_uid | recorded | scanner read | where the scanner looked |
|---|---|---|---|
| `cit-000521` | tier B, Results / Figures p.4 | tier A | Methods p.10: . S7– S9); the former generated using the GLAD tool (59) repre- senting the relative fluorescen… |

**The row's quotation is verified in the PDF, but the scanner could not find the tool's NAME:**

These are cited by reference number, not by name, so no text scan can place them; the
quotation was checked against the filed PDF by `record-evidence.js --check`, and the
`evidence_basis` column says how the reference number was resolved.

| row_uid | recorded | how the citation appears | basis |
|---|---|---|---|
| `cit-001253` | tier A, Materials and Methods p.15 | 1 appearance(s) of MAWE, none in a section the paper ranked: References p.19 | extracted text |
| `cit-000976` | tier A, Materials and Methods p.21 | 1 appearance(s) of MAWE, none in a section the paper ranked: References p.31 | reference-number resolution |
| `cit-001252` | tier A, Materials and Methods p.21 | 1 appearance(s) of MAWE, none in a section the paper ranked: References p.31 | reference-number resolution |
| `cit-000416` | tier C, Discussion p.19 | this row cites "Differential recognition of oligomannose isomers by glycan-binding protei… | extracted text |


### 3.4 A citing paper whose byline names one of the two PIs

None found: no row in the packet has a byline naming Cummings or Desai.

### 3.5 Included citations with no verbatim quotation

None. Every included row quotes a sentence from the citing paper.

### 3.6 An included citation with no PDF in the packet

None. Every citation in `packet.html` has the article filed beside it.

### 3.7 The four narrative fields are empty for every citation

§5.3 asks for a short written account per citation — objectives, importance, how the work was
used, findings. That is the applicant's prose, not something a script should write: it is the
part counsel reads first, and an invented sentence there is worse than a blank one.
14 of 14 works still need it.

Write them into the `narrative` table, then re-run `scripts/render-packet.js --write`. The
table in `packet.html` states what each field should contain.

## 4. Data notes a reader of the CSVs would otherwise trip over

### 4.1 A row whose cited paper is not one of the four tools

| row_uid | cited paper |
|---|---|
| `cit-000416` | Differential recognition of oligomannose isomers by glycan-binding proteins involved in innate and adaptive i… |

The tier and project columns are **blank** on this row on purpose. Its `cited_paper` is a
different work, so a tier recorded for GLAD or MAWE would describe a paper this row does not
cite. Borrowing the value from a sibling row in the same folder is what §5 forbids.

### 4.2 One work, two titles

`cit-000544` and `cit-000518` hold two rows with **different citing
titles**. That is not an error: Google Scholar lists the work twice, once under its preprint
title and once under its journal title, and the folder exists precisely to show the dates.
The identity rests on the applicant's note and the DOI chain, not on the title, and
`validate-packet.js` accepts it only because the folder files both a preprint and an article.

### 4.3 Two different dates, in two different columns

- `cited_earliest_date` is the date of **the applicant's cited paper** (§4.6).
- `citing_earliest_date` is the earliest public date of **the citing paper** — the timeline
  figure the Heras set exists to establish against the 25 Apr 2024 filing.

The citation summary's "Earliest date (preprint, else journal received)" line is the second of
these. It was imported into the first column, which meant a row citing GLAD (2019) printed
"29 Apr 2023" under *Cited Paper(s)*. `scripts/fix-row-scoped-fields.js` separated them; it is
re-runnable, dry-run by default, and refuses to write if the invariant fails.

### 4.4 A byline year is not a publication date

`cited_earliest_date` comes from the record's `publications.year`, which is what Google Scholar
prints beside the applicant's paper. It is not a verified date, and for a chapter or a reference
work it can be the date of the parent volume. Where a precise date matters, use the `file`
table's `shows_date` and `date_basis`, which record what a filed PDF itself prints.

### 4.5 The scanner's reading lives in its own columns

`scan_tier`, `scan_note` and `scanned_on` record what the location scanner read on its last run.
They are rewritten every run and are never the basis of a claim in the packet: `tier`, `section`
and `quote` remain the applicant's fields, and §1.3 forbids a script overwriting them. If
`scanned_on` is older than the newest PDF, re-run `node scripts/scan-mentions.js --write`.

## 5. Before handing the packet over

`node scripts/validate-packet.js` checks the mechanical items in §7 and exits non-zero on any
failure. Run it after every change. What it cannot check:

- **Nothing outside this folder was written.** The validator reports what `git status` shows in
  the Independent Citation Record. The record is opened read-only by `openCatalog()`, which has
  no write path, so this is a belt-and-braces check rather than the control itself.
- **The narrative fields and the missing quotations** (§3.5, §3.7) need the applicant's
  writing. A packet with a blank narrative is still usable; one with an invented narrative is
  not.
- **`print/packet.pdf`** must be produced from the browser's print dialog once the content is
  final (§5.4).
- **The project mapping** (§3.1) and the **tier-vs-folder question** (§3.2) need the
  applicant's decision.
- **Whether a held row is worth chasing at all.** §2 lists what is missing, not what it would
  prove. That judgement is the applicant's.


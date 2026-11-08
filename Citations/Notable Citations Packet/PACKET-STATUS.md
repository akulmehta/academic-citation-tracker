# Packet status — open items

Generated 2026-11-08 by `scripts/build-status.js`. **Do not hand-edit it** — re-run the
script. Every count and every row below is read from `notable-citations.sqlite` at run time,
so this document cannot quietly fall behind the data.

This document is for the applicant, not for counsel. [`packet.html`](./packet.html) is the
lawyer's document and contains only the citations that are ready to present. The rows listed
here are deliberately **not** in it: they are unobtainable, unverified, or waiting on a
decision that only a person can make.

## 1. Where the packet stands

| | count |
|---|---:|
| Citations in the packet (in `packet.html`) | 22 |
| Works those citations are filed as (§5.1 folders) | 14 |
| PDFs filed under `papers/` (in the packet) | 16 |
| PDFs under `pending-papers/` (awaiting a decision) | 29 |
| PDFs under `screened-papers/` (kept, not filed) | 3 |
| Held — open items, listed below | 93 |
| Screened out — decided, kept for the record (§4.5) | 4 |
| **Rows in table `citation`** | **119** |

`packet.csv` holds the 22 included rows. `screened-out.csv` holds the other 97,
because §4.5 exports `screened-out` and `held` together — counsel is entitled to see that the
work was screened and on what grounds. A screened-out row is not missing work: it is the
record of what was looked at and rejected, with the reason beside it. A held row is open, and
every held row appears in §2 below.

## 2. Held rows — 93 open items


### 2.1 `read` — 17 row(s)

The PDF is filed and the applicant's tool appears in a section of the paper. What is missing is the applicant's reading: a location on its own is not a claim about how the tool was used (§1.1).

| row_uid | tool | year | senior author | citing title | link |
|---|---|---|---|---|---|
| `cit-000507` | GLAD | 2020 | Campbell | Recent advances in glycoinformatic platforms for glycomics and glycoproteom… | [open](https://www.sciencedirect.com/science/article/pii/S0959440X19301356) |
| `cit-000566` | GLAD | 2020 | Garín-Muga | SugarArray: A User-centred-designed Platform for the Analysis of Lectin and… | [open](https://www.scitepress.org/PublishedPapers/2020/89601/89601.pdf) |
| `cit-000606` | GlycoGlyph | 2020 | SI Scherbinina | Three-dimensional structures of carbohydrates and where to find them | [open](https://www.mdpi.com/1422-0067/21/20/7702) |
| `cit-000625` | GlycoGlyph | 2020 | Perez | Computational tools for drawing, building and displaying carbohydrates: a v… | [open](https://www.beilstein-journals.org/bjoc/articles/16/199?utm_source=researcher_app&utm_medium=referral&utm_campaign=RESR_MRKT_Researcher_inbound) |
| `cit-000525` | GLAD | 2021 | Haab | Combined analysis of multiple glycan-array datasets: new explorations of pr… | [open](https://pmc.ncbi.nlm.nih.gov/articles/PMC8862541/) |
| `cit-000626` | GlycoGlyph | 2021 | Yamada | SugarDrawer: a web-based database search tool with editing glycan structures | [open](https://www.mdpi.com/1420-3049/26/23/7149) |
| `cit-000543` | GLAD | 2022 | Feizi | CarbArrayART: a new software tool for carbohydrate microarray data storage,… | [open](https://academic.oup.com/glycob/article-abstract/32/7/552/6555547) |
| `cit-000600` | GlycoGlyph | 2022 | Prasad | Novel fold of rotavirus glycan-binding domain predicted by AlphaFold2 and d… | [open](https://www.nature.com/articles/s42003-022-03357-1) |
| `cit-000510` | GLAD | 2023 | Pekosz | 2019–2020 H1N1 clade A5a. 1 viruses have better in vitro fitness compared w… | [open](https://www.nature.com/articles/s41598-023-37122-z) |
| `cit-000532` | GLAD | 2023 | Hokke | Unraveling cross-reactivity of anti-glycan IgG responses in filarial nemato… | [open](https://www.frontiersin.org/journals/immunology/articles/10.3389/fimmu.2023.1102344/full) |
| `cit-000538` | GLAD | 2023 | Kiessling | Lectin fingerprinting distinguishes antibody neutralization in SARS-CoV-2 | [open](https://pmc.ncbi.nlm.nih.gov/articles/PMC10214521/) |
| `cit-000589` | GlycoGlyph | 2024 | Oliveira-Ferrer | Glycan diversity in ovarian cancer: Unraveling the immune interplay and the… | [open](https://link.springer.com/article/10.1007/s00281-024-01025-6) |
| `cit-000520` | GLAD | 2025 | Vasta | A “proto” type galectin expressed in striped bass (Morone saxatilis) tissue… | [open](https://www.frontiersin.org/journals/cellular-and-infection-microbiology/articles/10.3389/fcimb.2025.1572734/full) |
| `cit-000596` | GlycoGlyph | 2025 | Eichler | Identification of the D-glucuronyl C5-epimerase that introduces iduronic ac… | [open](https://www.nature.com/articles/s42003-025-08987-9) |
| `cit-000633` | GlycoGlyph | 2026 | Schäfer | Engineering Functional CLA-Targeting CAR Approaches for Pancreatic Ductal A… | [open](https://www.biorxiv.org/content/10.64898/2026.07.03.736395.abstract) |
| `cit-000549` | GLAD | — | Swanson | CHARACTERIZATION OF IN VITRO FITNESS AND ANTIGENIC DRIFT DIFFERENCES BETWEE… | [open](https://jscholarship.library.jhu.edu/items/0dbcacaf-9e37-49c3-8a95-a3f55b8ae645) |
| `cit-000564` | GLAD | — | Ng'ang'a | Structure-function analysis of the photorhabdus Tc toxin complex | [open](https://freidok.uni-freiburg.de/files/166648/Qf-K5JUjPFmyT68-/Peter+NjengaThesis.pdf) |

### 2.2 `unread` — 2 row(s)

The PDF is filed. Nobody has read it yet.

| row_uid | tool | year | senior author | citing title | link |
|---|---|---|---|---|---|
| `cit-000654` | GlycoGlyph | 2022 | Prasad | Novel fold of rotavirus glycan-binding domain predicted by AlphaFold2 and d… | [open](https://escholarship.org/content/qt77j1n0fs/qt77j1n0fs.pdf?v=lg) |
| `cit-000607` | GlycoGlyph | 2025 | Vasta | A “proto” type galectin expressed in striped bass (Morone saxatilis) tissue… | [open](https://www.frontiersin.org/journals/cellular-and-infection-microbiology/articles/10.3389/fcimb.2025.1572734/full) |

### 2.3 `unsupported` — 12 row(s)

The PDF is filed, but the extracted text does not support a use in any section — the mentions sit in the reference list, in a table, or under a heading the paper did not print. Either re-read the page and record what it says, or screen the row out.

| row_uid | tool | year | senior author | citing title | link |
|---|---|---|---|---|---|
| `cit-000536` | GLAD | 2019 | Afanasiev | Metabolite multiprobiotic formulas for microbial health | [open](https://www.intechopen.com/chapters/67420) |
| `cit-000550` | GLAD | 2019 | Lisacek | A bioinformatics view of glycan–virus interactions | [open](https://www.mdpi.com/1999-4915/11/4/374) |
| `cit-000513` | GLAD | 2020 | Zou | Databases and bioinformatic tools for glycobiology and glycoproteomics | [open](https://www.mdpi.com/1422-0067/21/18/6727) |
| `cit-000541` | GLAD | 2020 | Cha | An automated fast healthcare interoperability resources-based 12-lead elect… | [open](https://pmc.ncbi.nlm.nih.gov/articles/PMC7214107/) |
| `cit-000656` | GlycoGlyph | 2020 | Ravinder | Synthesis of (cyclo) maltooligosaccharide-based glycosaminoglycan mimetics … | [open](https://theses.hal.science/tel-03192820/) |
| `cit-000554` | GLAD | 2021 | Sukhija | Glycobioinformatics in deciphering the mammalian glycocode: Recent advances | [open](https://www.dattaconsultinggroup.com/akdsite/assets/publications/glycocodearticle.pdf) |
| `cit-000593` | GlycoGlyph | 2021 | W Butler | Glycosylation changes in prostate cancer progression | [open](https://www.frontiersin.org/journals/oncology/articles/10.3389/fonc.2021.809170/full) |
| `cit-000622` | GlycoGlyph | 2021 | Gundry | Importance of evaluating protein glycosylation in pluripotent stem cell-der… | [open](https://link.springer.com/article/10.1007/s00424-021-02554-x) |
| `cit-000531` | GLAD | 2024 | Pekosz | Clade-defining mutations in human H1N1 hemagglutinin protein from 2021-2023… | [open](https://www.biorxiv.org/content/10.1101/2024.05.18.594815.abstract) |
| `cit-000592` | GlycoGlyph | 2024 | Siebels | Hypoxia-induced adaptations of N-glycomes and proteomes in breast cancer ce… | [open](https://www.mdpi.com/1422-0067/25/18/10216) |
| `cit-000605` | GlycoGlyph | 2025 | Kontoravdi | GlyCompute: towards the automated analysis of protein N-linked glycosylatio… | [open](https://link.springer.com/article/10.1007/s00216-024-05522-3) |
| `cit-000631` | GlycoGlyph | 2025 | Karstens | Complex carbohydrates catabolism capacity of bladder microbiota inhabiting … | [open](https://europepmc.org/article/med/40236069) |

### 2.4 `paywalled` — 15 row(s)

A copy exists behind a paywall. If the applicant can obtain the PDF through an institution, drop it in the folder and the row can be read.

| row_uid | tool | year | senior author | citing title | link |
|---|---|---|---|---|---|
| `cit-000526` | GLAD | 2019 | Kunej | Rise of systems glycobiology and personalized glycomedicine: why and how to… | [open](https://journals.sagepub.com/doi/abs/10.1089/omi.2019.0149) |
| `cit-000508` | GLAD | 2021 | Lewis | Big-data glycomics: tools to connect glycan biosynthesis to extracellular c… | [open](https://www.cell.com/trends/biochemical-sciences/abstract/S0968-0004(20)30266-8) |
| `cit-000514` | GLAD | 2022 | Hokke | Mass spectrometric and glycan microarray–based characterization of the fila… | [open](https://www.mcponline.org/article/S1535-9476(22)00009-3/fulltext) |
| `cit-000617` | GlycoGlyph | 2022 | Gildersleeve | Abnormal antibodies to self-carbohydrates in SARS-CoV-2-infected patients | [open](https://academic.oup.com/pnasnexus/article-abstract/1/3/pgac062/6609787) |
| `cit-000627` | GlycoGlyph | 2022 | Owonikoko | Serum glycomic profile as a predictive biomarker of recurrence in patients … | [open](https://onlinelibrary.wiley.com/doi/abs/10.1002/cam4.5465) |
| `cit-000634` | GlycoGlyph | 2022 | — | How molecular modelling can better broaden the understanding of glycosylati… | [open](https://www.sciencedirect.com/science/article/pii/S0959440X22000720) |
| `cit-000595` | GlycoGlyph | 2023 | Bojar | GlycoDraw: a python implementation for generating high-quality glycan figur… | [open](https://academic.oup.com/glycob/article-abstract/33/11/927/7232175) |
| `cit-000586` | GlycoGlyph | 2024 | Mandal | Small lectin ligands as a basis for applications in glycoscience and glycom… | [open](https://pubs.rsc.org/cs/article-abstract/53/19/9428/845064) |
| `cit-000636` | GlycoGlyph | 2024 | — | Towards a Better Understanding of the Influence of Carbohydrates on the Str… | [open](https://onlinelibrary.wiley.com/doi/abs/10.1002/pgr2.70013) |
| `cit-000616` | GlycoGlyph | 2025 | Wozniak-Knopp | Trispecific SEED antibodies engineered for neutrophil-mediated cell killing | [open](https://www.tandfonline.com/doi/abs/10.1080/19420862.2025.2532851) |
| `cit-000640` | GlycoGlyph | 2025 | Bode | Comprehensive synthesis of K48/K63 ubiquitin pentamers by graph-empowered a… | [open](https://chemrxiv.org/doi/abs/10.26434/chemrxiv-2025-943j7) |
| `cit-001254` | MAWE | 2026 | Seeberger | Using Synthetic Glycans to Investigate Anti‐Glycan Antibodies and Explore T… | [open](https://onlinelibrary.wiley.com/doi/abs/10.1002/anie.7795967) |
| `cit-001262` | MAWE | 2026 | Lane | Establishing “Glycoantigens” as a cross-field concept in Glycobiology, tran… | [open](https://www.sciencedirect.com/science/article/pii/S0198885926001588) |
| `cit-000512` | GLAD | — | Aoki-Kinoshita | Worldwide glycoscience informatics infrastructure: the GlySpace Alliance | [open](https://pubs.acs.org/jaaucr/article-abstract/3/1/4/1253251) |
| `cit-000556` | GLAD | — | — | Phenotyping murine and human platelet-derived extracellular vesicles gives … | [open](https://www.rpthjournal.org/cms/10.1016/j.rpth.2026.103414/attachment/5e1ef181-290b-47ad-a0b6-2820746565cf/mmc1.pdf) |

### 2.5 `no-open-copy` — 30 row(s)

No openly accessible copy was found. The publisher's landing page is given so the applicant can check institutional access.

| row_uid | tool | year | senior author | citing title | link |
|---|---|---|---|---|---|
| `cit-000524` | GLAD | 2020 | Imberty | Structural database for lectins and the UniLectin web platform | [open](https://link.springer.com/protocol/10.1007/978-1-0716-0430-4_1) |
| `cit-000546` | GLAD | 2020 | — | Decoding glycans: deciphering the sugary secrets to be coherent on the impl… | [open](https://pubs.rsc.org/ra/article-abstract/10/56/34099/702166) |
| `cit-000547` | GLAD | 2020 | Aruleba | Visual data mining: A comparative analysis of selected datasets | [open](https://link.springer.com/chapter/10.1007/978-3-030-71187-0_35) |
| `cit-000561` | GLAD | 2021 | Willats | Carbohydrate Microarray Technology | [open](https://link.springer.com/chapter/10.1007/978-3-030-77791-3_10) |
| `cit-000599` | GlycoGlyph | 2021 | — | Anti-glycan antibodies: roles in human disease | [open](https://portlandpress.com/biochemj/article-abstract/478/8/1485/228430) |
| `cit-000620` | GlycoGlyph | 2021 | Toukach | CSDB/SNFG structure editor: An online glycan builder with 2D and 3D structu… | [open](https://pubs.acs.org/doi/abs/10.1021/acs.jcim.1c00917) |
| `cit-000637` | GlycoGlyph | 2021 | — | Bioinformatics study of lectins: new classification and prediction in genom… | [open](https://theses.hal.science/tel-03331649/) |
| `cit-000587` | GlycoGlyph | 2022 | — | Artificial intelligence in the analysis of glycosylation data | [open](https://www.sciencedirect.com/science/article/pii/S0734975022001045) |
| `cit-000588` | GlycoGlyph | 2022 | Clarke | The SGNH hydrolase family: a template for carbohydrate diversity | [open](https://academic.oup.com/glycob/article-abstract/32/10/826/6649114) |
| `cit-000601` | GlycoGlyph | 2022 | Brooks | Crystal structure of a human MUC16 SEA domain reveals insight into the natu… | [open](https://onlinelibrary.wiley.com/doi/abs/10.1002/prot.26303) |
| `cit-000609` | GlycoGlyph | 2022 | Kimber | Secreted filarial nematode galectins modulate host immune cells | [open](https://www.frontiersin.org/journals/immunology/articles/10.3389/fimmu.2022.952104/full) |
| `cit-000590` | GlycoGlyph | 2023 | Gildersleeve | Anti-glycan monoclonal antibodies: Basic research and clinical applications | [open](https://www.sciencedirect.com/science/article/pii/S1367593123000194) |
| `cit-000597` | GlycoGlyph | 2023 | — | Protein glycosylation and glycoinformatics for novel biomarker discovery in… | [open](https://www.sciencedirect.com/science/article/pii/S1568163723001502) |
| `cit-000610` | GlycoGlyph | 2023 | McCammon | Glycosylation and crowded membrane effects on influenza neuraminidase stabi… | [open](https://pmc.ncbi.nlm.nih.gov/articles/PMC10515755/) |
| `cit-000612` | GlycoGlyph | 2023 | Joshi | Recent progress in high-throughput and automated characterization of N-glyc… | [open](https://www.sciencedirect.com/science/article/pii/S0165993623004843) |
| `cit-000635` | GlycoGlyph | 2023 | Closs | Highlighting the hygroscopic capacities of apiogalacturonans | [open](https://www.sciencedirect.com/science/article/pii/S1093326323001250) |
| `cit-000649` | GlycoGlyph | 2023 | — | Molecular and evolutionary bases of the biosynthesis of polysialylation: st… | [open](https://theses.hal.science/tel-04691831/) |
| `cit-000608` | GlycoGlyph | 2024 | Nagar | Structural analysis of mammalian sialic acid esterase | [open](https://www.sciencedirect.com/science/article/pii/S0022283624004236) |
| `cit-000611` | GlycoGlyph | 2024 | Hu | Enrichment methods of N-linked glycopeptides from human serum or plasma: a … | [open](https://www.sciencedirect.com/science/article/pii/S0008621524000739) |
| `cit-000632` | GlycoGlyph | 2024 | Gildersleeve | Insights into biofilm architecture and maturation enable improved clinical … | [open](https://www.cell.com/cell-chemical-biology/fulltext/S2451-9456(24)00483-5) |
| `cit-000604` | GlycoGlyph | 2025 | Muddiman | A Strategy to Achieve Sub‐Parts‐per‐Million Mass Measurement Accuracy of N‐… | [open](https://analyticalsciencejournals.onlinelibrary.wiley.com/doi/abs/10.1002/jms.5184) |
| `cit-000615` | GlycoGlyph | 2025 | Cobb | Ablation of CD22 induces a pro-inflammatory transcriptome shift and endocyt… | [open](https://academic.oup.com/glycob/article-abstract/35/11/cwaf076/8317966) |
| `cit-000598` | GlycoGlyph | 2026 | — | Are They Connected? Liquid-State NMR Spectroscopy of Chitinous Materials | [open](https://pubs.acs.org/bomaf6/article-abstract/27/3/1766/5080021) |
| `cit-000630` | GlycoGlyph | 2026 | Thattai | Pareto-optimal synthesis of multiple glycans in Golgi compartments | [open](https://www.cell.com/biophysj/abstract/S0006-3495(26)00445-5) |
| `cit-000641` | GlycoGlyph | 2026 | — | Breast cancer subclass analytics from glycoenzyme gene expression using mac… | — |
| `cit-000548` | GLAD | — | Perez | CBMcarb-DB: interface of the three-dimensional landscape of carbohydrate-bi… | [open](https://books.rsc.org/books/edited-volume/2205/chapter/8051227) |
| `cit-000555` | GLAD | — | Petralia | Ad ancing helminth gl comics: structural specificit and immunogenicit of sc… | [open](https://scholarlypublications.universiteitleiden.nl/access/item%3A4212215/download) |
| `cit-000559` | GLAD | — | — | Glycan Microarray Data Analysis: From Raw Data to Public Database Integrati… | [open](https://www.creative-proteomics.com/resource/glycan-microarray-analysis-and-database-integration.htm) |
| `cit-000560` | GLAD | — | Feizi | CarbArrayART-An update on the software tool for carbohydrate microarray dat… | [open](https://spiral.imperial.ac.uk/entities/publication/6ebd01fb-2687-4761-a614-c85c1a192b24) |
| `cit-000562` | GLAD | — | Feizi | CarbArrayART | [open](https://run.unl.pt/entities/publication/48e256d4-d5a1-4fde-a8a0-ec184408ff34) |

### 2.6 `not-in-indexes` — 17 row(s)

Neither PubMed nor OpenAlex returned the work, so there was nothing to fetch. These tend to be theses, book chapters, or commercial pages.

| row_uid | tool | year | senior author | citing title | link |
|---|---|---|---|---|---|
| `cit-000623` | GlycoGlyph | 2020 | Lewis | A consensus-based and readable extension of Linear Code for Reaction Rules … | [open](https://www.beilstein-journals.org/bjoc/articles/16/215) |
| `cit-000581` | GlycoGlyph | 2021 | Munkley | FUT8 alpha-(1, 6)-fucosyltransferase in cancer | [open](https://www.mdpi.com/1422-0067/22/1/455) |
| `cit-000614` | GlycoGlyph | 2026 | Subramaniam | Loss of α2, 3-linked sialoside in the receptor-binding site of a H5N1 influ… | [open](https://www.biorxiv.org/content/10.64898/2026.01.19.700419.abstract) |
| `cit-000638` | GlycoGlyph | 2026 | Panneerselvam | Glycomics and Infection Progress: Exploring the Role of Mucuna pruriens (L.… | [open](https://api.taylorfrancis.com/content/chapters/edit/download?identifierName=doi&identifierValue=10.1201/9781003635901-6&type=chapterpdf) |
| `cit-000639` | GlycoGlyph | 2026 | Aoki-Kinoshita | Glycoinformatics: Advances in Glycan Data Integration and Analysis | [open](https://api.taylorfrancis.com/content/chapters/edit/download?identifierName=doi&identifierValue=10.1201/9781003635901-9&type=chapterpdf) |
| `cit-000552` | GLAD | — | — | METABOLITE MULTIPRO/SYNBIOTICS: APPROACHES FOR CONSTRUCTING | — |
| `cit-000567` | GLAD | — | Tiemeyer | Glycoinformatics resources integrated through the GlySpace Alliance | — |
| `cit-000642` | GlycoGlyph | — | — | Enzymatic blood group conversion of human kidneys for transplantation | [open](https://www.repository.cam.ac.uk/items/e10e257a-d8af-4b26-a1bf-423a51207910) |
| `cit-000643` | GlycoGlyph | — | — | Towards Precision Glycotherapeutics Through Genome Editing and Next-Generat… | [open](https://search.proquest.com/openview/d4b84dd05e86300c2fd5c2b721b924fa/1?pq-origsite=gscholar&cbl=18750&diss=y) |
| `cit-000645` | GlycoGlyph | — | — | Scalable Extraction and Curation of Glycan Biomarker Data From Biomedical L… | [open](https://search.proquest.com/openview/5ccff5ba3574d8afeba5491d01d5ee90/1?pq-origsite=gscholar&cbl=18750&diss=y) |
| `cit-000646` | GlycoGlyph | — | — | Development of HDX-MS methods to further investigate complex protein samples | [open](https://ora.ox.ac.uk/objects/uuid:c9b50c98-6f0d-4458-b7cd-07faeafbc4a7) |
| `cit-000647` | GlycoGlyph | — | — | N-glycan profiling of medulloblastoma in patients at different proteome sub… | [open](https://ediss.sub.uni-hamburg.de/handle/ediss/10786) |
| `cit-000648` | GlycoGlyph | — | — | Deciphering Receptor Binding Landscapes: AI-Enabled Insights Into Influenza… | [open](https://search.proquest.com/openview/80aa496f003511e11b714c348e89f9be/1?pq-origsite=gscholar&cbl=18750&diss=y) |
| `cit-000650` | GlycoGlyph | — | — | Probing and elucidating the dynamics of virus-membrane interaction via plas… | — |
| `cit-000652` | GlycoGlyph | — | — | Automated Spectrum Annotation and Structure Disambiguation of Released N-Gl… | [open](https://go.proteinmetrics.com/hubfs/Posters/poster-automated-spectrum-annotation-n-linked-glycans.pdf) |
| `cit-000657` | GlycoGlyph | — | — | Functional Significance of Fructan Biosynthesis in Halophilic Archaea and E… | [open](https://search.proquest.com/openview/f5331e71c0ad5a3b8f4b0fec3978da23/1?pq-origsite=gscholar&cbl=2026366&diss=y) |
| `cit-001263` | MAWE | — | — | STRUCTURE-FUNCTION STUDIES OF AN RTX-ADHESIN FROM VIBRIO VULNIFICUS AND ITS… | [open](https://queensu.scholaris.ca/server/api/core/bitstreams/5594e40f-e0d9-4469-9a8f-016e81f60463/content) |

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

Distribution over all 119 rows: `2` = 108, `3` = 10, `(blank)` = 1.

If a number is wrong, the single place to change it is `toolForCitedPaper` /
`projectForCitedPaper` in [`scripts/lib.js`](./scripts/lib.js), then re-run the importer and
`scripts/render-packet.js --write`.

### 3.2 Rows whose tier disagrees with the folder the applicant filed them in

None outstanding. The gaps between a row's tier and the folder it came from are closed by a
recorded applicant decision, listed below.
**Closed by a recorded applicant decision.** On 2026-11-08 the applicant set the rule that a
citing work is filed at the **strongest** tier any of its citations earns, so a paper whose
PDF was filed in a lower-tier folder can still stand at tier A. These rows are the gaps that
rule closed; each was written by `scripts/record-tier-decision.js`, which is the only tool
that records one, and `--revert` takes it off again:

| row_uid | filed from | folder implies | filed at | decided |
|---|---|---|---|---|
| `cit-000542` | `Citations/In Acknowledgements/Dianne-van-der-Wal_GLAD.pdf` | tier D | **tier A** | 2026-11-07 |

`cit-000542` is the one counsel should see both sides of. The applicant's note records **both**
a Methods sentence — *"Glycan Array Dashboard (version 3.1) was used to analyze and
visualize the glycan array data."* — **and** an Acknowledgments line thanking the applicant
by name, which is why the PDF was filed under `In Acknowledgements`. The applicant read the
article and confirmed the Methods use, so the row is filed at tier A; the acknowledgment is
still printed in the entry so nothing is hidden from counsel.

### 3.3 Included rows where the article text reads differently than the note

The scanner reports what it read in a separate column (`scan_tier`) and never overwrites the
applicant's `tier`. It cannot see a figure or judge prose the way a reader can, so a
disagreement is a prompt to re-read the page, not a correction. These rows stay in the
packet until a person says otherwise:

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

A surname in one of the byline sources for the rows below matches the applicant's PI or the
former PI. Where the record has settled the row as dependent, §1.2 keeps it out of the packet
altogether — a citation sharing an author is not independent evidence of anyone else's work.

| row_uid | packet status | record status | byline source naming the PI | where the name appears |
|---|---|---|---|---|
| `cit-000511` | screened-out | DEPENDENT | already DEPENDENT | the corroborating pubmed record |

### 3.4b Candidate rows whose snapshot disagrees with the record

Table `candidate` is a **snapshot** taken when the seed ran, and the record keeps working.
These rows were seeded as independent and the record has since settled them as dependent:

| row_uid | snapshot | record now | packet status |
|---|---|---|---|
| `cit-000511` | INDEPENDENT, highlighted | DEPENDENT | screened-out |

Do not file one of these, and do not fix the snapshot to make the two agree: the record is
right and the snapshot is merely old. Re-check independence from the record immediately
before downloading a PDF or drafting prose about any candidate (§1.2).

### 3.4c An included citation the record does not count

None. Every row in `packet.html` is an independent, countable, standing citation on the record.

### 3.5 Included citations with no verbatim quotation

None. Every included row quotes a sentence from the citing paper.

### 3.6 An included citation with no PDF in the packet

None. Every citation in `packet.html` has the article filed beside it.

### 3.7 The narrative fields are a preparer's draft awaiting the applicant's approval

The 14 narrative(s) on file are written into the `narrative` table by
`scripts/narrative-intake.js`, which refuses a paragraph that names no page number or a
page beyond the length of the filed PDF. Who wrote each one is recorded in that table's
`written_by` and `written_on` columns; it is deliberately **not** printed in `packet.html`,
which would repeat the same sentence 56 times.

Recorded authorship: `the preparer (draft)`.
Written on: 2026-11-07.

**These paragraphs are not the applicant's own wording.** Every sentence is drawn from the
cited article and carries the page it rests on, so each claim can be checked, but a
statement about why the citing authors did what they did should read as the applicant's
judgement before counsel relies on it. Review, correct and approve them, then have
`narrative-intake.js` record `written_by` as the applicant so the provenance changes with
the words. An invented sentence in this section is worse than a blank one.

### 3.8 Working advice held out of the document (`preparer_note`)

Each narrative row also carries a `preparer_note`: recommendations about **the packet** —
which tier to file a folder at, what it is good for, what not to claim from it. Those are
not observations about the citing article, so `render-packet.js` never reads the column and
they appear nowhere in `packet.html` or the printed PDF. `narrative-intake.js` rejects a
sentence of that kind in the four rendered columns, which is what keeps the split from
quietly re-merging. This is the only place the advice is written down.

**`cit-000416`** — Glycan-mediated interactions of infectious hypodermal and hematopoiet…
: This folder is strong on the point that matters: both the MAWE data-processing rules and GLAD are named in the Methods paragraph that generated the binding data, and the cited review is named as the source of the array platform itself.

**`cit-000516`** — A Zebrafish Galectin-1 Isoform Is Expressed in Skin and Gills and Bin…
: Cite this folder for the density of use rather than any single sentence - MAWE as an established procedure, GLAD for analysis and GlycoGlyph for the glycan models, all inside section 4.9.5 on p.21.

**`cit-000518`** — Major human schistosome species express different glycans with immuno…
: The p.16 sentence is a clean Methods use - the tool is named, versioned, and given the analytical role - from a Nature Communications article on a species with clinical relevance. Because the version is stated, counsel can see the authors worked with a released build rather than a private script.

**`cit-000521`** — Enzymatic tailoring of anionic glycans for characterizing lectin and …
: File this row at tier A.

**`cit-000542`** — Comparative phenotyping of surface markers and glycans in murine and …
: Keep the Methods p.5 sentence as the evidence and treat the p.12 acknowledgment as corroboration of the applicant’s role, not as a second use; both statements are recorded so they can be read side by side. OPEN DECISION FOR THE APPLICANT: the headline tier for this row is Methods (tier A) on the strength of the p.5 sentence. If you consider the Acknowledgments thanks to be the more accurate characterisation of the relationship, say so, because tier D would place this article outside the packet entirely.

**`cit-000544`** — Phylogenetic variations in a novel family of hyperstable apple snail …
: The p.4 sentence is a Methods use for comparison, and the folder’s multiple dated files exist precisely to place that statement in time; point counsel at the file list rather than asking them to take the date on trust.

**`cit-000594`** — AquIRE reveals the mechanisms of clinically induced RNA damage and th…
: This is a single-sentence Methods use in a high-visibility journal, and it is best presented as evidence of routine adoption for a standard task rather than as a load-bearing methodological dependence.

**`cit-000602`** — Diminished sialoside binding in novel H5N1 influenza hemagglutinin va…
: A Methods use in a Nature Communications article on a matter of public-health urgency; present it as the applicant’s tool being used to render the glycan structures in a high-profile receptor-binding study.

**`cit-000613`** — Transcriptome, glycome, and mucinome analysis reveal zinc is essentia…
: A tier B use: the applicant’s tool is the source of the glycan structures in the figures, twice named, but not described in the Methods prose. The mentions sit in figure content rather than in the Materials and Methods text, which is why the row is recorded at tier B rather than tier A.

**`cit-000619`** — Structural basis of secreted acid phosphatase polymerization in the L…
: A Methods use in a Journal of Biological Chemistry structural study; the GlycoGlyph sentence is specific about which structure was generated, which makes it verifiable at a glance.

**`cit-000621`** — LeGenD: High-throughput N-glycan profiling using explainable AI and l…
: A tier A use in a Journal of Biological Chemistry methods paper by a group that includes a co-author of the applicant’s field; useful as evidence that tool developers in glycomics use GlycoGlyph for structure representation.

**`cit-000629`** — Glycan-reactive antibodies isolated from human HIV-1 vaccine trial pa…
: One of the strongest folders in the packet: the applicant’s MAWE protocol is the assay method behind a Nature-family-tier HIV vaccine immunology study, and GlycoGlyph supplied the structure diagrams, both named in Methods and in a figure legend.

**`cit-001253`** — Intelectin-2 is a broad-spectrum antimicrobial lectin
: Do not present this citation as an instance of the tool being adopted. Keep the row, and keep the hedge quoted. The applicant’s own earlier summary of this paper recorded the same doubt. If the applicant knows from the authors or the NCFG that the array work was in fact run on reusable arrays made by MAWE, that fact should be recorded through the decision tool with its basis, not inferred from this sentence.

**`cit-001257`** — Evaluating the role of non-HIV antigens in the initiation of QA013. 2…
: A tier A Methods use of MAWE in a Scientific Reports article from a well-known HIV vaccine laboratory, presented as the analysis method for the array data. Where other folders name the applicant’s work in a hedge or a figure legend, this one assigns the analysis to the method in a Methods sentence, which is the form of use this packet is built to collect.

## 4. Potential citations not in the packet

### 4.1 GLAD — “GLAD: GLycan Array Dashboard, a visual analytics tool for glycan micr…” (2019)

[`potential_notable_citations.html`](./potential_notable_citations.html) lists **34** independent citations of that work that are
**not** in `packet.html`. It is a review page for the applicant: it is not linked from the
packet, not printed with it, and nothing on it is evidence until a person has read the
article and filed it.

| | count |
|---|---:|
| Citing works the record lists for that paper | 64 |
| less rows retired by a later re-capture | 0 |
| less not independent (shared author, or a PI on the citing paper) | 18 |
| less copies that do not stand for their work | 2 |
| less not listed in English | 0 |
| less already confirmed in the packet | 7 |
| less already used in the original application (§3) | 2 |
| less decided against by the applicant | 1 |
| **listed for review** | **34** |

16 of them already have a PDF on file, held under `pending-papers/` until a
decision is made. The rest sit at
`no-open-copy`, `paywalled`, or `not-in-indexes` — findings about access, not about
whether the paper exists. **A tier appears only for an article that has actually been read:**
a plain tier is a named mention under a heading the citing paper printed, and a tier marked
“resolved” is a citation the paper credited by reference number or by author–year
without naming the tool. The rest claim nothing, because a tier is a claim about where a
sentence sits and their articles have not been read page by page.
To bring one in, name its `row_uid` and run `discover-pdfs.js` → `file-pdf.js` →
`scan-mentions.js` → `record-evidence.js`, then re-render the packet.

### 4.2 GlycoGlyph — “GlycoGlyph: a glycan visualizing, drawing and naming application” (2020)

[`potential_notable_citations-GlycoGlyph.html`](./potential_notable_citations-GlycoGlyph.html) lists **55** independent citations of that work that are
**not** in `packet.html`. It is a review page for the applicant: it is not linked from the
packet, not printed with it, and nothing on it is evidence until a person has read the
article and filed it.

| | count |
|---|---:|
| Citing works the record lists for that paper | 78 |
| less rows retired by a later re-capture | 0 |
| less not independent (shared author, or a PI on the citing paper) | 9 |
| less copies that do not stand for their work | 4 |
| less not listed in English | 0 |
| less already confirmed in the packet | 7 |
| less already used in the original application (§3) | 3 |
| less decided against by the applicant | 0 |
| **listed for review** | **55** |

15 of them already have a PDF on file, held under `pending-papers/` until a
decision is made. The rest sit at
`no-open-copy`, `paywalled`, or `not-in-indexes` — findings about access, not about
whether the paper exists. **A tier appears only for an article that has actually been read:**
a plain tier is a named mention under a heading the citing paper printed, and a tier marked
“resolved” is a citation the paper credited by reference number or by author–year
without naming the tool. The rest claim nothing, because a tier is a claim about where a
sentence sits and their articles have not been read page by page.
To bring one in, name its `row_uid` and run `discover-pdfs.js` → `file-pdf.js` →
`scan-mentions.js` → `record-evidence.js`, then re-render the packet.

### 4.3 MAWE — “Reusable glycan microarrays using a microwave assisted wet-erase (MAW…” (2024)

[`potential_notable_citations-MAWE.html`](./potential_notable_citations-MAWE.html) lists **3** independent citations of that work that are
**not** in `packet.html`. It is a review page for the applicant: it is not linked from the
packet, not printed with it, and nothing on it is evidence until a person has read the
article and filed it.

| | count |
|---|---:|
| Citing works the record lists for that paper | 15 |
| less rows retired by a later re-capture | 0 |
| less not independent (shared author, or a PI on the citing paper) | 6 |
| less copies that do not stand for their work | 1 |
| less not listed in English | 0 |
| less already confirmed in the packet | 5 |
| less already used in the original application (§3) | 0 |
| less decided against by the applicant | 0 |
| **listed for review** | **3** |

0 of them already have a PDF on file, held under `pending-papers/` until a
decision is made. The rest sit at
`no-open-copy`, `paywalled`, or `not-in-indexes` — findings about access, not about
whether the paper exists. **A tier appears only for an article that has actually been read:**
a plain tier is a named mention under a heading the citing paper printed, and a tier marked
“resolved” is a citation the paper credited by reference number or by author–year
without naming the tool. The rest claim nothing, because a tier is a claim about where a
sentence sits and their articles have not been read page by page.
To bring one in, name its `row_uid` and run `discover-pdfs.js` → `file-pdf.js` →
`scan-mentions.js` → `record-evidence.js`, then re-render the packet.


## 5. Data notes a reader of the CSVs would otherwise trip over

### 5.1 A row whose cited paper is not one of the four tools

| row_uid | cited paper |
|---|---|
| `cit-000416` | Differential recognition of oligomannose isomers by glycan-binding proteins involved in innate and adaptive i… |

The tier and project columns are **blank** on this row on purpose. Its `cited_paper` is a
different work, so a tier recorded for GLAD or MAWE would describe a paper this row does not
cite. Borrowing the value from a sibling row in the same folder is what §5 forbids.

### 5.2 One work, two titles

`cit-000544` hold two rows with **different citing
titles**. That is not an error: Google Scholar lists the work twice, once under its preprint
title and once under its journal title, and the folder exists precisely to show the dates.
The identity rests on the applicant's note and the DOI chain, not on the title, and
`validate-packet.js` accepts it only because the folder files both a preprint and an article.

### 5.3 Two different dates, in two different columns

- `cited_earliest_date` is the date of **the applicant's cited paper** (§4.6).
- `citing_earliest_date` is the earliest public date of **the citing paper** — the timeline
  figure the Heras set exists to establish against the 25 Apr 2024 filing.

The citation summary's "Earliest date (preprint, else journal received)" line is the second of
these. It was imported into the first column, which meant a row citing GLAD (2019) printed
"29 Apr 2023" under *Cited Paper(s)*. `scripts/fix-row-scoped-fields.js` separated them; it is
re-runnable, dry-run by default, and refuses to write if the invariant fails.

### 5.4 A byline year is not a publication date

`cited_earliest_date` comes from the record's `publications.year`, which is what Google Scholar
prints beside the applicant's paper. It is not a verified date, and for a chapter or a reference
work it can be the date of the parent volume. Where a precise date matters, use the `file`
table's `shows_date` and `date_basis`, which record what a filed PDF itself prints.

### 5.5 The scanner's reading lives in its own columns

`scan_tier`, `scan_note` and `scanned_on` record what the location scanner read on its last run.
They are rewritten every run and are never the basis of a claim in the packet: `tier`, `section`
and `quote` remain the applicant's fields, and §1.3 forbids a script overwriting them. If
`scanned_on` is older than the newest PDF, re-run `node scripts/scan-mentions.js --write`.

### How a citation that never names the tool is found

A citing author who used GLAD or MAWE often writes neither name in the body. Two shapes cause
that, and both were found in the stored PDFs rather than imagined:

- **Numbered** — “following established procedures [125–127]”, or a bare superscript
  typeset tight against a word. In the Kiessling article the *only* in-text mark for MAWE is a
  superscript `69` after the word “unclear”, and the string “MAWE” appears nowhere
  outside the reference list.
- **Author–year** — “(Mehta et al. 2024)”, where there is no number to resolve at all.
  Six filed PDFs have no numbered bibliography whatsoever.

`scripts/scan-refs.js` resolves both. It identifies which bibliography entry is the
applicant’s paper — title plus year plus first author, two signals required, never a guess
— and then reports every place that number, or that surname-and-year, is credited, with the
section the citing paper printed and the sentence it sits in. A marker attached to a chart
axis, a table row, or a caption is reported but never quoted, because a fragment offered as
evidence looks like something and is not.

| basis of a recorded mention | mentions | rows |
|---|---:|---:|
| reference-number resolution | 34 | 30 |
| extracted text | 4 | 3 |

A resolved citation is held to the same bar as one that names the tool: it must sit in
prose, under a heading the citing paper itself printed, and not in the bibliography entry
that names the applicant's paper — a reference list proves only that the author cited the
work, not where or how. Where a row's tier rests on such a citation, that is said in the
report rather than left for a reader to infer from a section heading alone.

34 mentions across 30 citing works rest on resolution or on a person’s
reading, not on a named-tool scan. `scan-mentions.js` reports those rows separately and
leaves their tier alone — it is not built to find them, so its silence is not evidence
against them.

Resolution also reached 4 citation(s) on rows the packet has already screened
out. Those rows stay out: each was screened for a reason the citation does not answer
— one is not independent, the other was already submitted with the original application
— and a stronger citation cannot undo either. They are recorded rather than dropped so
the decision can be re-examined if the reason for it changes.

### 5.6 How each PDF got here, and what is still missing

Every PDF in the storage roots (`papers/`, `pending-papers/`, `screened-papers/`) arrived
one of three ways, and the distinction matters because only the first two are reproducible
from a script.

**Fetched by `discover-pdfs.js`** — 35 candidate row(s) across 33 distinct file(s), each recorded with the host it came from:

| host | rows | row_uid(s) |
|---|---:|---|
| (no source recorded) | 11 | `cit-000507`, `cit-000523`, `cit-000525`, `cit-000531`, `cit-000532`, `cit-000534`, `cit-000549`, `cit-000554`, `cit-000564`, `cit-000566`, `cit-000621` |
| www.nature.com | 5 | `cit-000510`, `cit-000511`, `cit-000596`, `cit-000600`, `cit-000654` |
| www.mdpi.com | 5 | `cit-000513`, `cit-000550`, `cit-000592`, `cit-000606`, `cit-000626` |
| www.frontiersin.org | 3 | `cit-000520`, `cit-000593`, `cit-000607` |
| link.springer.com | 3 | `cit-000589`, `cit-000605`, `cit-000622` |
| www.biorxiv.org | 2 | `cit-000631`, `cit-000633` |
| www.intechopen.com | 1 | `cit-000536` |
| pubs.acs.org | 1 | `cit-000538` |
| eymj.org | 1 | `cit-000541` |
| academic.oup.com | 1 | `cit-000543` |
| www.beilstein-journals.org | 1 | `cit-000625` |
| theses.hal.science | 1 | `cit-000656` |

All of them are open-access copies resolved through OpenAlex and taken from the publisher.

**Retrieved through the applicant's logged-in browser** — 0 file(s) in 0 folder(s), staged in `downloads/` by `fetch-downloads.js` (plain HTTP)
or by the Playwright Chrome session and filed with `file-pdf.js`, which checked the article's
title against the row before writing: .
These are subscription or repository copies the script route could not reach; the mechanics,
including the CDP download route and the hosts still behind Cloudflare, are in §2.2 of the
packet instructions.

**Placed in the folder by the applicant** — 13 folder(s) hold a file that
no candidate row claims as its fetch: `cit-000544`, `cit-000594`, `cit-001253`, `cit-000518`, `cit-000521`, `cit-000629`, `cit-000619`, `cit-000542`, `cit-000602`, `cit-000516`, `cit-000613`, `cit-001257`, `cit-000416`.
These came from the `In Methods` / `In Acknowledgements` imports and were registered into table
`file`; nothing downloaded them.

**No PDF was ever retrieved from NCBI.** `discover-pdfs.js` has no E-utilities download path at
all, so the NCBI key in `.env` is used for author corroboration, not for fetching. Any statement
that these papers came from PubMed Central would be wrong.

Discovery state of all 116 GLAD candidates, from `candidate.discover_state`:

| state | rows | meaning |
|---|---:|---|
| `has-pdf` | 51 | a PDF is on file for the row — seeded that way, fetched by a script, or filed with `file-pdf.js` |
| `no-open-copy` | 30 | looked, nothing retrievable found |
| `not-in-indexes` | 17 | not found in the open-access indexes consulted |
| `paywalled` | 16 | located behind a paywall — the applicant may be able to obtain these |
| `open-copy` | 2 | an open-access copy was located; the row is only `has-pdf` once the file is on disk |

**Still open:** 0 row(s) sit at `open-copy` with no file on disk — a copy was
located and never fetched. Chasing them is a decision, not a defect: a row must be independent
(§1.2) before it is worth a download, and 45 candidate(s) are already held — check why before spending effort on a PDF for a row that
cannot be filed.

## 6. Before handing the packet over

`node scripts/validate-packet.js` checks the mechanical items in §7 and exits non-zero on any
failure. Run it after every change. What it cannot check:

- **Nothing outside this folder was written.** The validator reports what `git status` shows in
  the Independent Citation Record. The record is opened read-only by `openCatalog()`, which has
  no write path, so this is a belt-and-braces check rather than the control itself.
- **The narrative fields and the missing quotations** (§3.5, §3.7) need the applicant's
  approval. The drafted narratives are drawn from the articles and every sentence names its
  page, but they are a preparer's wording until the applicant adopts them; a packet with a
  blank narrative is still usable, one with an unapproved narrative is not.
- **The working advice written up in §3.8.** Recommendations about the packet are kept out of
  the document itself, so they are listed there instead. Read that section before the document
  is handed over.
- **`print/packet.pdf`** must be produced from the browser's print dialog once the content is
  final (§5.4).
- **The project mapping** (§3.1) needs the applicant's decision. The **tier-vs-folder**
  question (§3.2) is closed: a citing work is filed at the strongest tier any of its
  citations earns, and the two rows where that differs from the folder carry a recorded
  `tier_decision`.
- **Whether a held row is worth chasing at all.** §2 lists what is missing, not what it would
  prove. That judgement is the applicant's. §4 lists the independent citations that are not
  in the packet at all; picking from that list is the applicant's too.


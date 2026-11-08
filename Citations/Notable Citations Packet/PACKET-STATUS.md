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
| PDFs under `pending-papers/` (awaiting a decision) | 59 |
| PDFs under `screened-papers/` (kept, not filed) | 26 |
| Held — open items, listed below | 274 |
| Screened out — decided, kept for the record (§4.5) | 102 |
| **Rows in table `citation`** | **398** |

`packet.csv` holds the 22 included rows. `screened-out.csv` holds the other 376,
because §4.5 exports `screened-out` and `held` together — counsel is entitled to see that the
work was screened and on what grounds. A screened-out row is not missing work: it is the
record of what was looked at and rejected, with the reason beside it. A held row is open, and
every held row appears in §2 below.

## 2. Held rows — 274 open items


### 2.1 `read` — 17 row(s)

The PDF is filed and the applicant's tool appears in a section of the paper. What is missing is the applicant's reading: a location on its own is not a claim about how the tool was used (§1.1).

| row_uid | tool | year | senior author | citing title | link |
|---|---|---|---|---|---|
| `cit-000507` | GLAD | 2020 | Campbell | Recent advances in glycoinformatic platforms for glycomics and glycoproteom… | [open](https://www.sciencedirect.com/science/article/pii/S0959440X19301356) |
| `cit-000566` | GLAD | 2020 | Garín-Muga | SugarArray: A User-centred-designed Platform for the Analysis of Lectin and… | [open](https://www.scitepress.org/PublishedPapers/2020/89601/89601.pdf) |
| `cit-000525` | GLAD | 2021 | Haab | Combined analysis of multiple glycan-array datasets: new explorations of pr… | [open](https://pmc.ncbi.nlm.nih.gov/articles/PMC8862541/) |
| `cit-000626` | GlycoGlyph | 2021 | Yamada | SugarDrawer: a web-based database search tool with editing glycan structures | [open](https://www.mdpi.com/1420-3049/26/23/7149) |
| `cit-000514` | GLAD | 2022 | Hokke | Mass spectrometric and glycan microarray–based characterization of the fila… | [open](https://www.mcponline.org/article/S1535-9476(22)00009-3/fulltext) |
| `cit-000543` | GLAD | 2022 | Feizi | CarbArrayART: a new software tool for carbohydrate microarray data storage,… | [open](https://academic.oup.com/glycob/article-abstract/32/7/552/6555547) |
| `cit-000600` | GlycoGlyph | 2022 | Prasad | Novel fold of rotavirus glycan-binding domain predicted by AlphaFold2 and d… | [open](https://www.nature.com/articles/s42003-022-03357-1) |
| `cit-000510` | GLAD | 2023 | Pekosz | 2019–2020 H1N1 clade A5a. 1 viruses have better in vitro fitness compared w… | [open](https://www.nature.com/articles/s41598-023-37122-z) |
| `cit-000532` | GLAD | 2023 | Hokke | Unraveling cross-reactivity of anti-glycan IgG responses in filarial nemato… | [open](https://www.frontiersin.org/journals/immunology/articles/10.3389/fimmu.2023.1102344/full) |
| `cit-000538` | GLAD | 2023 | Kiessling | Lectin fingerprinting distinguishes antibody neutralization in SARS-CoV-2 | [open](https://pmc.ncbi.nlm.nih.gov/articles/PMC10214521/) |
| `cit-000531` | GLAD | 2024 | Pekosz | Clade-defining mutations in human H1N1 hemagglutinin protein from 2021-2023… | [open](https://www.biorxiv.org/content/10.1101/2024.05.18.594815.abstract) |
| `cit-000520` | GLAD | 2025 | Vasta | A “proto” type galectin expressed in striped bass (Morone saxatilis) tissue… | [open](https://www.frontiersin.org/journals/cellular-and-infection-microbiology/articles/10.3389/fcimb.2025.1572734/full) |
| `cit-000596` | GlycoGlyph | 2025 | Eichler | Identification of the D-glucuronyl C5-epimerase that introduces iduronic ac… | [open](https://www.nature.com/articles/s42003-025-08987-9) |
| `cit-000607` | GlycoGlyph | 2025 | Vasta | A “proto” type galectin expressed in striped bass (Morone saxatilis) tissue… | [open](https://www.frontiersin.org/journals/cellular-and-infection-microbiology/articles/10.3389/fcimb.2025.1572734/full) |
| `cit-000631` | GlycoGlyph | 2025 | Karstens | Complex carbohydrates catabolism capacity of bladder microbiota inhabiting … | [open](https://europepmc.org/article/med/40236069) |
| `cit-000614` | GlycoGlyph | 2026 | Subramaniam | Loss of α2, 3-linked sialoside in the receptor-binding site of a H5N1 influ… | [open](https://www.biorxiv.org/content/10.64898/2026.01.19.700419.abstract) |
| `cit-000633` | GlycoGlyph | 2026 | Schäfer | Engineering Functional CLA-Targeting CAR Approaches for Pancreatic Ductal A… | [open](https://www.biorxiv.org/content/10.64898/2026.07.03.736395.abstract) |

### 2.2 `unread` — 39 row(s)

The PDF is filed. Nobody has read it yet.

| row_uid | tool | year | senior author | citing title | link |
|---|---|---|---|---|---|
| `cit-000623` | GlycoGlyph | 2020 | Lewis | A consensus-based and readable extension of Linear Code for Reaction Rules … | [open](https://www.beilstein-journals.org/bjoc/articles/16/215) |
| `cit-000683` | — | 2021 | J Ma | O-GlcNAcAtlas: A database of experimentally identified O-GlcNAc sites and p… | [open](https://academic.oup.com/glycob/article-abstract/31/7/719/6090059) |
| `cit-000695` | — | 2021 | Lewis | Correcting for sparsity and interdependence in glycomics by accounting for … | [open](https://www.nature.com/articles/s41467-021-25183-5) |
| `cit-000731` | — | 2021 | Heck | Glycoproteoform profiles of individual patients' plasma alpha-1-antichymotr… | [open](https://www.frontiersin.org/journals/immunology/articles/10.3389/fimmu.2020.608466/full) |
| `cit-000795` | — | 2021 | Lisacek | Dealing with the ambiguity of glycan substructure search | [open](https://www.mdpi.com/1420-3049/27/1/65) |
| `cit-000654` | GlycoGlyph | 2022 | Prasad | Novel fold of rotavirus glycan-binding domain predicted by AlphaFold2 and d… | [open](https://escholarship.org/content/qt77j1n0fs/qt77j1n0fs.pdf?v=lg) |
| `cit-000666` | — | 2022 | Klassen | Sialic acid-containing glycolipids mediate binding and viral entry of SARS-… | [open](https://www.nature.com/articles/s41589-021-00924-1) |
| `cit-000693` | — | 2022 | Schumann | Cell-specific bioorthogonal tagging of glycoproteins | [open](https://www.nature.com/articles/s41467-022-33854-0) |
| `cit-000800` | — | 2022 | Zgoda | Construction of 2DE patterns of plasma proteins: aspect of potential tumor … | [open](https://www.mdpi.com/1422-0067/23/19/11113) |
| `cit-000845` | — | 2022 | Ronald | Sensitive spatiotemporal tracking of spontaneous metastasis in deep tissues… | [open](https://www.biorxiv.org/content/10.1101/2022.02.09.479610.abstract) |
| `cit-001303` | — | 2022 | Liu | Physicochemical Properties and Anticoagulant Activity of Purified Heteropol… | [open](https://www.mdpi.com/1420-3049/27/9/3027) |
| `cit-000741` | — | 2023 | Morrissette | The tubulin database: Linking mutations, modifications, ligands and local i… | [open](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0295279) |
| `cit-000742` | — | 2023 | Ronald | A genetically encoded magnetic resonance imaging reporter enables sensitive… | [open](https://aacrjournals.org/cancerres/article-abstract/83/5/673/716684) |
| `cit-000744` | — | 2023 | Nesvizhskii | Unraveling the glycosylated immunopeptidome with HLA-Glyco | [open](https://www.nature.com/articles/s41467-023-39270-2) |
| `cit-000750` | — | 2023 | Kalinina | GlyLES: Grammar-based Parsing of Glycans from IUPAC-condensed to SMILES | [open](https://link.springer.com/article/10.1186/s13321-023-00704-0) |
| `cit-000757` | — | 2023 | Wessels | The GlycoPaSER prototype as a real-time N-glycopeptide identification tool … | [open](https://www.mdpi.com/1422-0067/24/9/7869) |
| `cit-000770` | — | 2023 | Butterick | RNAseq analysis of FABP4 knockout mouse hippocampal transcriptome suggests … | [open](https://www.mdpi.com/1422-0067/24/4/3381) |
| `cit-000844` | — | 2023 | Heisterkamp | Glycosylation as regulator of human B-cell leukaemias in bone marrow | [open](https://www.frontiersin.org/journals/hematology/articles/10.3389/frhem.2023.1279863/full) |
| `cit-000696` | — | 2024 | Taylor | Petagraph: A large-scale unifying knowledge graph framework for integrating… | [open](https://www.nature.com/articles/s41597-024-04070-w) |
| `cit-000722` | — | 2024 | Banerjee | Combatting cellular immortality in cancers by targeting the shelterin prote… | [open](https://link.springer.com/article/10.1186/s13062-024-00552-4) |
| `cit-000727` | — | 2024 | R Li | Multivalent interactions between fully glycosylated influenza virus hemaggl… | [open](https://www.nature.com/articles/s44298-024-00059-9) |
| `cit-000767` | — | 2024 | Poon | CHHM: a manually curated catalogue of human histone modifications revealing… | [open](https://pmc.ncbi.nlm.nih.gov/articles/PMC11302869/) |
| `cit-000831` | — | 2024 | Vafaee | Multifaceted representation of genes via deep learning of gene expression n… | [open](https://www.biorxiv.org/content/10.1101/2024.03.07.583777.abstract) |
| `cit-000689` | — | 2025 | Pandolfini | METTL9 sustains vertebrate neural development primarily via non-catalytic f… | [open](https://www.nature.com/articles/s41467-025-62414-5) |
| `cit-000704` | — | 2025 | Vafaee | GeneRAIN: multifaceted representation of genes via deep learning of gene ex… | [open](https://link.springer.com/article/10.1186/s13059-025-03749-6) |
| `cit-000705` | — | 2025 | X Ni | ToolFactory: Automating tool generation by leveraging LLM to understand res… | [open](https://arxiv.org/abs/2501.16945) |
| `cit-000707` | — | 2025 | Bolton | Glycoscience data content in the NCBI Glycans and PubChem | [open](https://link.springer.com/article/10.1007/s00216-024-05459-7) |
| `cit-000713` | — | 2025 | Kelleher | Next-generation protein sequencing and individual ion mass spectrometry ena… | [open](https://link.springer.com/article/10.1007/s00216-025-06120-7) |
| `cit-000715` | — | 2025 | van den Heuvel | Glycoproteomics analysis of complement factor H and its complement-regulato… | [open](https://www.frontiersin.org/journals/immunology/articles/10.3389/fimmu.2025.1645196/full) |
| `cit-000726` | — | 2025 | X Ni | Doc2agent: Scalable generation of tool-using agents from api documentation | [open](https://arxiv.org/abs/2506.19998) |
| `cit-000737` | — | 2025 | Kontoravdi | GlyCompute: towards the automated analysis of protein N-linked glycosylatio… | [open](https://link.springer.com/article/10.1007/s00216-024-05522-3) |
| `cit-000804` | — | 2025 | Mihăilescu | Mapping O-and N-glycosylation in transmembrane and interface regions of pro… | [open](https://www.mdpi.com/1422-0067/26/1/327) |
| `cit-000824` | — | 2025 | Karstens | Complex carbohydrates catabolism capacity of bladder microbiota inhabiting … | [open](https://europepmc.org/article/med/40236069) |
| `cit-000780` | — | 2026 | Brand | Diagnosis of Congenital Disorders of Glycosylation Type II Subtypes Through… | [open](https://www.mdpi.com/1422-0067/27/14/6309) |
| `cit-000799` | — | 2026 | Lipinski | Rubicon modulates neuroimmune responses following traumatic brain injury | [open](https://pmc.ncbi.nlm.nih.gov/articles/PMC13001424/) |
| `cit-000802` | — | 2026 | Kuno | A hierarchical lectin-based multimodal workflow for spatial mapping of extr… | [open](https://link.springer.com/article/10.1007/s00216-026-06501-6) |
| `cit-000832` | — | 2026 | L'opez | Multi-timescale PTM architecture in human RNA polymerase II | [open](https://www.biorxiv.org/content/10.64898/2026.06.27.734958.abstract) |
| `cit-000833` | — | 2026 | A Kitani | GlycoMeSH: linking glycan structures to biomedical context for systematic e… | [open](https://www.biorxiv.org/content/10.64898/2026.08.18.745318.abstract) |
| `cit-000843` | — | 2026 | K Himori | GlyEnzEA: reaction-informed enrichment of enzyme-centered glycan sets from … | [open](https://www.biorxiv.org/content/10.64898/2026.10.14.759156.abstract) |

### 2.3 `unsupported` — 8 row(s)

The PDF is filed, but the extracted text does not support a use in any section — the mentions sit in the reference list, in a table, or under a heading the paper did not print. Either re-read the page and record what it says, or screen the row out.

| row_uid | tool | year | senior author | citing title | link |
|---|---|---|---|---|---|
| `cit-000536` | GLAD | 2019 | Afanasiev | Metabolite multiprobiotic formulas for microbial health | [open](https://www.intechopen.com/chapters/67420) |
| `cit-000550` | GLAD | 2019 | Lisacek | A bioinformatics view of glycan–virus interactions | [open](https://www.mdpi.com/1999-4915/11/4/374) |
| `cit-000513` | GLAD | 2020 | Zou | Databases and bioinformatic tools for glycobiology and glycoproteomics | [open](https://www.mdpi.com/1422-0067/21/18/6727) |
| `cit-000541` | GLAD | 2020 | Cha | An automated fast healthcare interoperability resources-based 12-lead elect… | [open](https://pmc.ncbi.nlm.nih.gov/articles/PMC7214107/) |
| `cit-000554` | GLAD | 2021 | Sukhija | Glycobioinformatics in deciphering the mammalian glycocode: Recent advances | [open](https://www.dattaconsultinggroup.com/akdsite/assets/publications/glycocodearticle.pdf) |
| `cit-000581` | GlycoGlyph | 2021 | Munkley | FUT8 alpha-(1, 6)-fucosyltransferase in cancer | [open](https://www.mdpi.com/1422-0067/22/1/455) |
| `cit-000592` | GlycoGlyph | 2024 | Siebels | Hypoxia-induced adaptations of N-glycomes and proteomes in breast cancer ce… | [open](https://www.mdpi.com/1422-0067/25/18/10216) |
| `cit-000605` | GlycoGlyph | 2025 | Kontoravdi | GlyCompute: towards the automated analysis of protein N-linked glycosylatio… | [open](https://link.springer.com/article/10.1007/s00216-024-05522-3) |

### 2.4 `paywalled` — 50 row(s)

A copy exists behind a paywall. If the applicant can obtain the PDF through an institution, drop it in the folder and the row can be read.

| row_uid | tool | year | senior author | citing title | link |
|---|---|---|---|---|---|
| `cit-000875` | — | 2010 | Inoue | LC-ESI-MS/MS | [open](https://www.researchgate.net/profile/Daniel-Bojar-2/publication/373192999_Breast_Milk_Oligosaccharides_Contain_Immunomodulatory_Glucuronic_Acid_and_LacdiNAc/links/64deec6ecaf5ff5cd0c399e5/Breast-Milk-Oligosaccharides-Contain-Immunomodulatory-Glucuronic-Acid-and-LacdiNAc.pdf) |
| `cit-001203` | — | 2012 | Lima | Allosteric activation of human α-thrombin through exosite 2 by suramin anal… | [open](https://www.sciencedirect.com/science/article/pii/S0003986112000434) |
| `cit-001208` | — | 2012 | — | Discovery and Biophysical Characterization of Allosteric Inhibitors of Fact… | [open](https://scholarscompass.vcu.edu/etd/418/) |
| `cit-001224` | — | 2012 | — | Designing direct and indirect factor Xa inhibitors | [open](https://search.proquest.com/openview/69367e48ed50250dfb2bc51b5e13c73e/1?pq-origsite=gscholar&cbl=18750) |
| `cit-001209` | — | 2013 | — | Reverse-phase Ion-Pairing Ultra Performance Liquid Chromatography-Mass Spec… | [open](https://scholarscompass.vcu.edu/etd/3031/?show=full) |
| `cit-001216` | — | 2014 | — | Design, synthesis, and biochemical evaluation of novel inhibitors of Norwal… | — |
| `cit-001221` | — | 2014 | — | Structure-based design and optimization of dipeptidyl inhibitors of norovir… | — |
| `cit-001305` | — | 2014 | Kang | Fasxiator, a novel factor XI a inhibitor from snake venom, and its site‐spe… | [open](https://onlinelibrary.wiley.com/doi/abs/10.1111/jth.12797) |
| `cit-001370` | — | 2014 | Melnyk | Thiocarbamate-Linked Polysulfonate–Peptide Conjugates As Selective Hepatocy… | [open](https://pmc.ncbi.nlm.nih.gov/articles/PMC4064695/) |
| `cit-001192` | — | 2015 | Yurttacs | Synthesis and biological evaluation of some dibenzofuran-piperazine derivat… | [open](https://www.tandfonline.com/doi/abs/10.3109/14756366.2015.1108971) |
| `cit-001211` | — | 2018 | — | Biophysical exploration of conformational environments in zymogen prothromb… | [open](https://ir.library.louisville.edu/etd/2904/) |
| `cit-000526` | GLAD | 2019 | Kunej | Rise of systems glycobiology and personalized glycomedicine: why and how to… | [open](https://journals.sagepub.com/doi/abs/10.1089/omi.2019.0149) |
| `cit-001291` | — | 2019 | Wilmen | Allosteric inhibition as a new mode of action for BAY 1213790, a neutralizi… | [open](https://www.sciencedirect.com/science/article/pii/S0022283619305625) |
| `cit-000801` | — | 2020 | — | Glycomics-informed glycoproteomic analysis of site-specific glycosylation f… | [open](https://www.cell.com/star-protocols/fulltext/S2666-1667(20)30201-X) |
| `cit-000675` | — | 2021 | Azadi | Comprehensive characterization of N-and O-glycosylation of SARS-CoV-2 human… | [open](https://academic.oup.com/glycob/article-abstract/31/4/410/5943025) |
| `cit-000678` | — | 2021 | Zardecki | RCSB Protein Data Bank: Celebrating 50 years of the PDB with new tools for … | [open](https://onlinelibrary.wiley.com/doi/abs/10.1002/pro.4213) |
| `cit-000807` | — | 2021 | Tusnády | PolarProtDb: a database of transmembrane and secreted proteins showing apic… | [open](https://www.sciencedirect.com/science/article/pii/S0022283620306239) |
| `cit-000617` | GlycoGlyph | 2022 | Gildersleeve | Abnormal antibodies to self-carbohydrates in SARS-CoV-2-infected patients | [open](https://academic.oup.com/pnasnexus/article-abstract/1/3/pgac062/6609787) |
| `cit-000627` | GlycoGlyph | 2022 | Owonikoko | Serum glycomic profile as a predictive biomarker of recurrence in patients … | [open](https://onlinelibrary.wiley.com/doi/abs/10.1002/cam4.5465) |
| `cit-000719` | — | 2022 | Kohler | A photo-cross-linking GlcNAc analog enables covalent capture of N-linked gl… | [open](https://www.cell.com/cell-chemical-biology/fulltext/S2451-9456(21)00347-0) |
| `cit-000733` | — | 2022 | Neelamegham | GlycoEnzOnto: a GlycoEnzyme pathway and molecular function ontology | [open](https://academic.oup.com/bioinformatics/article-abstract/38/24/5413/6772808) |
| `cit-000743` | — | 2022 | Haab | CarboGrove: a resource of glycan-binding specificities through analyzed gly… | [open](https://academic.oup.com/glycob/article-abstract/32/8/679/6555550) |
| `cit-000749` | — | 2022 | Mahal | Prevaccination glycan markers of response to an influenza vaccine implicate… | [open](https://pmc.ncbi.nlm.nih.gov/articles/PMC9361353/) |
| `cit-000776` | — | 2022 | — | RCSB Protein Data Bank resources for structure-facilitated design of mRNA v… | [open](https://www.cell.com/structure/fulltext/S0969-2126(21)00376-2) |
| `cit-001312` | — | 2022 | Huang | Expedient Synthesis of a Library of Heparan Sulfate‐Like “Head‐to‐Tail” Lin… | [open](https://onlinelibrary.wiley.com/doi/abs/10.1002/ange.202209730) |
| `cit-000595` | GlycoGlyph | 2023 | Bojar | GlycoDraw: a python implementation for generating high-quality glycan figur… | [open](https://academic.oup.com/glycob/article-abstract/33/11/927/7232175) |
| `cit-000710` | — | 2023 | Bojar | Breast milk oligosaccharides contain immunomodulatory glucuronic acid and L… | [open](https://www.mcponline.org/article/S1535-9476(23)00146-9/fulltext) |
| `cit-000724` | — | 2023 | Gerken | Polypeptide N-acetylgalactosaminyltransferase (GalNAc-T) isozyme surface ch… | [open](https://academic.oup.com/glycob/article-abstract/33/10/817/7239863) |
| `cit-000765` | — | 2023 | Ramaiah | Elucidating the molecular role of MUC5B in progressive lung adenocarcinoma:… | [open](https://onlinelibrary.wiley.com/doi/abs/10.1002/jmr.3064) |
| `cit-000813` | — | 2023 | Yang | Quantitative analysis of fucosylated glycoproteins by immobilized lectin-af… | [open](https://pubs.rsc.org/ra/article-abstract/13/10/6676/823077) |
| `cit-000636` | GlycoGlyph | 2024 | — | Towards a Better Understanding of the Influence of Carbohydrates on the Str… | [open](https://onlinelibrary.wiley.com/doi/abs/10.1002/pgr2.70013) |
| `cit-000677` | — | 2024 | — | Defining the mechanism of galectin-3–mediated TGF-β1 activation and its rol… | [open](https://www.jbc.org/article/S0021-9258(24)01801-5/fulltext) |
| `cit-000703` | — | 2024 | Tusnády | UniTmp: unified resources for transmembrane proteins | [open](https://academic.oup.com/nar/article-abstract/52/D1/D572/7327069) |
| `cit-000745` | — | 2024 | S | Studying the O-GlcNAcome of human placentas using banked tissue samples | [open](https://academic.oup.com/glycob/article-abstract/34/4/cwae005/7585290) |
| `cit-000825` | — | 2024 | Perez | CBMcarb-DB: interface of the three-dimensional landscape of carbohydrate-bi… | [open](https://books.rsc.org/books/edited-volume/2205/chapter/8051227) |
| `cit-001365` | — | 2024 | Demir | Enantiomeric separation of thiourea derivatives of naringenin on amylose an… | [open](https://onlinelibrary.wiley.com/doi/abs/10.1002/chir.23659) |
| `cit-000616` | GlycoGlyph | 2025 | Wozniak-Knopp | Trispecific SEED antibodies engineered for neutrophil-mediated cell killing | [open](https://www.tandfonline.com/doi/abs/10.1080/19420862.2025.2532851) |
| `cit-000640` | GlycoGlyph | 2025 | Bode | Comprehensive synthesis of K48/K63 ubiquitin pentamers by graph-empowered a… | [open](https://chemrxiv.org/doi/abs/10.26434/chemrxiv-2025-943j7) |
| `cit-000688` | — | 2025 | Snijder | A universal spectrum annotator for complex peptidoforms in mass spectrometr… | [open](https://pmc.ncbi.nlm.nih.gov/articles/PMC12573231/) |
| `cit-000701` | — | 2025 | Ma'ayan | GeneSetCart: assembling, augmenting, combining, visualizing, and analyzing … | [open](https://academic.oup.com/gigascience/article-abstract/doi/10.1093/gigascience/giaf025/8110163) |
| `cit-000729` | — | 2025 | Gundry | Integrated multiomics reveals alterations in paucimannose and complex type … | [open](https://www.mcponline.org/article/S1535-9476(25)00027-1/fulltext) |
| `cit-000794` | — | 2025 | Neelamegham | Editor's Choice GlycoEnzDB: a database of enzymes involved in human glycosy… | [open](https://academic.oup.com/glycob/article-abstract/35/12/cwaf074/8315827) |
| `cit-000848` | — | 2025 | — | Implication of N-glycosylation in the maintenance and degeneration of photo… | [open](https://archiv.ub.uni-heidelberg.de/volltextserver/37789/) |
| `cit-001310` | — | 2025 | Tata | The discovery of a novel anticoagulant mechanism: factor XI activation inhi… | [open](https://pubs.acs.org/aptsfn/article-abstract/8/9/3090/3761803) |
| `cit-000756` | — | 2026 | Moremen | Editor's Choice JAAG: a JSON input file assembler for AlphaFold 3 with glyc… | [open](https://academic.oup.com/glycob/article-abstract/36/1/cwaf083/8373854) |
| `cit-000775` | — | 2026 | Pitteri | Deep Intact Glycoproteomic Analysis Reveals Multi-Level Glycosylation Heter… | [open](https://www.sciencedirect.com/science/article/pii/S1535947626001817) |
| `cit-000783` | — | 2026 | Wu | A Chemoenzymatic Method To Systematically Quantify Core Fucosylation Stoich… | [open](https://pmc.ncbi.nlm.nih.gov/articles/PMC12874205/) |
| `cit-001254` | MAWE | 2026 | Seeberger | Using Synthetic Glycans to Investigate Anti‐Glycan Antibodies and Explore T… | [open](https://onlinelibrary.wiley.com/doi/abs/10.1002/anie.7795967) |
| `cit-000512` | GLAD | — | Aoki-Kinoshita | Worldwide glycoscience informatics infrastructure: the GlySpace Alliance | [open](https://pubs.acs.org/jaaucr/article-abstract/3/1/4/1253251) |
| `cit-000556` | GLAD | — | — | Phenotyping murine and human platelet-derived extracellular vesicles gives … | [open](https://www.rpthjournal.org/cms/10.1016/j.rpth.2026.103414/attachment/5e1ef181-290b-47ad-a0b6-2820746565cf/mmc1.pdf) |

### 2.5 `no-open-copy` — 118 row(s)

No openly accessible copy was found. The publisher's landing page is given so the applicant can check institutional access.

| row_uid | tool | year | senior author | citing title | link |
|---|---|---|---|---|---|
| `cit-001200` | — | 2011 | Mosberg | Conformationally restricted analogs of the direct thrombin inhibitor FM 19 | [open](https://www.sciencedirect.com/science/article/pii/S0968089611008546) |
| `cit-001225` | — | 2012 | — | Design, synthesis, and biological evaluation of novel MCAK and 14-3-3 prote… | [open](https://search.proquest.com/openview/626099758e4991c2edd32359acff072a/1?pq-origsite=gscholar&cbl=18750) |
| `cit-001171` | — | 2013 | — | Ligand binding to anion-binding exosites regulates conformational propertie… | [open](https://www.jbc.org/article/S0021-9258(19)33516-1/fulltext) |
| `cit-001175` | — | 2013 | Marinelli | Palladium-Catalyzed Cascade Reactions of 1‑(3-Arylprop-2-ynyloxy)-2-bromo B… | [open](https://pubs.acs.org/joceah/article-abstract/78/9/4490/1339822) |
| `cit-001181` | — | 2013 | Groutas | Potent inhibition of norovirus by dipeptidyl α-hydroxyphosphonate transitio… | [open](https://www.sciencedirect.com/science/article/pii/S0960894X13010135) |
| `cit-001187` | — | 2013 | Marinelli | Multisubstituted benzo [b] furans through a copper-and/or palladium-catalyz… | [open](https://www.sciencedirect.com/science/article/pii/S004040201201914X) |
| `cit-001220` | — | 2013 | — | In-silico drug design approach to discover novel anti-coagulants | [open](https://scholar.archive.org/work/bwxyho4sf5bddevjoax57rcehq/access/wayback/http://www.postdocjournal.com/file_journal/655_58122119.pdf) |
| `cit-001227` | — | 2013 | — | Interazioni tra acidi nucleici, proteine e potenziali farmaci antitumorali:… | [open](https://tesidottorato.depositolegale.it/handle/20.500.14242/338305) |
| `cit-001386` | — | 2013 | Sankar | Newer Oral Anticoagulants | [open](https://link.springer.com/chapter/10.1007/978-1-4614-9560-4_16) |
| `cit-001217` | — | 2014 | — | Studies on rationally designed, allosteric, coagulation inhibitors | [open](https://search.proquest.com/openview/1e39143b98382b38c71074a9313f8722/1?pq-origsite=gscholar&cbl=18750) |
| `cit-001338` | — | 2014 | Quan | Phenylimidazoles as potent and selective inhibitors of coagulation factor X… | [open](https://pubs.acs.org/doi/abs/10.1021/jm5010607) |
| `cit-001384` | — | 2014 | — | Studies on rationally designed, allosteric, coagulation inhibitors | [open](https://search.proquest.com/openview/1e39143b98382b38c71074a9313f8722/1?pq-origsite=gscholar&cbl=18750) |
| `cit-001164` | — | 2015 | Groutas | Structure-Guided Design and Optimization of Dipeptidyl Inhibitors of Norovi… | [open](https://pubs.acs.org/jmcmar/article-abstract/58/7/3144/1300753) |
| `cit-001230` | — | 2015 | Chang | Potent inhibition of enterovirus D68 and human rhinoviruses by dipeptidyl a… | — |
| `cit-001290` | — | 2015 | Zhao | Discovery of an intrinsic tenase complex inhibitor: Pure nonasaccharide fro… | [open](https://www.pnas.org/doi/abs/10.1073/pnas.1504229112) |
| `cit-001373` | — | 2015 | Schmaier | Medically-induced hemophilia C to treat thrombosis | [open](https://www.thrombosisresearch.com/article/S0049-3848(15)00240-6/abstract) |
| `cit-001169` | — | 2016 | Chang | Potent inhibition of enterovirus D68 and human rhinoviruses by dipeptidyl a… | [open](https://www.sciencedirect.com/science/article/pii/S0166354215300322) |
| `cit-001191` | — | 2016 | Ayres | Blood compatibility of heparin-inspired, lactose containing, polyureas depe… | [open](https://pubs.rsc.org/py/article-abstract/7/23/3897/532089) |
| `cit-001213` | — | 2016 | — | Probing allosteric, partial inhibition of thrombin using novel anticoagulan… | [open](https://search.proquest.com/openview/197f86fac0d2accd9f82fc809da0fdaa/1?pq-origsite=gscholar&cbl=18750&diss=y) |
| `cit-001366` | — | 2016 | Li | Efforts to total synthesis of philinopside E: convergent synthesis of the s… | [open](https://pubs.rsc.org/ra/article-abstract/6/7/5442/501613) |
| `cit-001383` | — | 2016 | — | Probing allosteric, partial inhibition of thrombin using novel anticoagulan… | [open](https://search.proquest.com/openview/197f86fac0d2accd9f82fc809da0fdaa/1?pq-origsite=gscholar&cbl=18750&diss=y) |
| `cit-001391` | — | 2016 | — | Advances in Anticoagulants | — |
| `cit-001198` | — | 2017 | Maurer | Deciphering conformational changes associated with the maturation of thromb… | [open](https://pmc.ncbi.nlm.nih.gov/articles/PMC6076386/) |
| `cit-001212` | — | 2017 | — | Study of Molecular Interactions of Glycosaminoglycans and Glycosaminoglycan… | [open](https://scholarscompass.vcu.edu/etd/4968/) |
| `cit-001381` | — | 2017 | — | Study of Molecular Interactions of Glycosaminoglycans and Glycosaminoglycan… | [open](https://scholarscompass.vcu.edu/etd/4968/) |
| `cit-001311` | — | 2018 | Zhao | Precise structures of fucosylated glycosaminoglycan and its oligosaccharide… | [open](https://www.sciencedirect.com/science/article/pii/S0223523418301776) |
| `cit-001336` | — | 2018 | Zhao | Modulating the degree of fucosylation of fucosylated chondroitin sulfate en… | [open](https://www.sciencedirect.com/science/article/pii/S0223523418304288) |
| `cit-001369` | — | 2018 | — | Identifying new clotting factor XIa inhibitors in virtual high‐throughput s… | [open](https://aiche.onlinelibrary.wiley.com/doi/abs/10.1002/btpr.2693) |
| `cit-001382` | — | 2018 | — | ATVB Named Lecture Review | [open](https://www.academia.edu/download/93444176/ATVBAHA.117.pdf) |
| `cit-001189` | — | 2019 | Liu | De novo synthesis of benzofurans via trifluoroacetic acid catalyzed cycliza… | [open](https://pubs.rsc.org/ob/article-abstract/17/32/7547/654942) |
| `cit-001195` | — | 2019 | Maurer | Thrombin Exosite Maturation and Ligand Binding at ABE II Help Stabilize PAR… | [open](https://pmc.ncbi.nlm.nih.gov/articles/PMC6716794/) |
| `cit-001204` | — | 2019 | Karale | Synthesis, characterization and antibacterial screening of fluorinated benz… | [open](https://www.academia.edu/download/101958191/IJCB_2058B4_20504-510.pdf) |
| `cit-001296` | — | 2019 | Chan | Advances in antithrombotic therapy | [open](https://www.ahajournals.org/doi/abs/10.1161/ATVBAHA.118.310960) |
| `cit-001315` | — | 2019 | Zhao | Precise structures and anti-intrinsic tenase complex activity of three fuco… | [open](https://www.sciencedirect.com/science/article/pii/S0144861719308136) |
| `cit-000524` | GLAD | 2020 | Imberty | Structural database for lectins and the UniLectin web platform | [open](https://link.springer.com/protocol/10.1007/978-1-0716-0430-4_1) |
| `cit-000546` | GLAD | 2020 | — | Decoding glycans: deciphering the sugary secrets to be coherent on the impl… | [open](https://pubs.rsc.org/ra/article-abstract/10/56/34099/702166) |
| `cit-000547` | GLAD | 2020 | Aruleba | Visual data mining: A comparative analysis of selected datasets | [open](https://link.springer.com/chapter/10.1007/978-3-030-71187-0_35) |
| `cit-000897` | — | 2020 | — | Reducing Theory to Practice: Designing Training Modules and Bco Tools for A… | [open](https://search.proquest.com/openview/b2c6fc62d67a193f57060a4151f22645/1?pq-origsite=gscholar&cbl=18750&diss=y) |
| `cit-001178` | — | 2020 | Gupta | Allosteric inhibition and kinetic characterization of Klebsiella pneumoniae… | [open](https://www.sciencedirect.com/science/article/pii/S0141813019365778) |
| `cit-001368` | — | 2020 | Lam | Orally bioavailable amine-linked macrocyclic inhibitors of factor XIa | [open](https://www.sciencedirect.com/science/article/pii/S0960894X20300020) |
| `cit-001375` | — | 2020 | — | CHARACTERIZING GLYCOSAMINOGLYCAN AND GLYCOSAMINOGLYCAN-OLIGO INTERACTIONS W… | [open](https://scholarscompass.vcu.edu/etd/6185/) |
| `cit-000561` | GLAD | 2021 | Willats | Carbohydrate Microarray Technology | [open](https://link.springer.com/chapter/10.1007/978-3-030-77791-3_10) |
| `cit-000620` | GlycoGlyph | 2021 | Toukach | CSDB/SNFG structure editor: An online glycan builder with 2D and 3D structu… | [open](https://pubs.acs.org/doi/abs/10.1021/acs.jcim.1c00917) |
| `cit-000747` | — | 2021 | Young | Modernized uniform representation of carbohydrate molecules in the Protein … | [open](https://academic.oup.com/glycob/article-abstract/31/9/1204/6272446) |
| `cit-000748` | — | 2021 | Varki | Evolutionary conservation of human ketodeoxynonulosonic acid production is … | [open](https://www.jci.org/articles/view/137681) |
| `cit-000815` | — | 2021 | Lisacek | Glycan compositions with Glyconnect Compozitor to enhance glycopeptide iden… | [open](https://link.springer.com/protocol/10.1007/978-1-0716-1641-3_7) |
| `cit-000834` | — | 2021 | — | Sampling and sample preparation in bioanalysis | [open](https://link.springer.com/chapter/10.1007/978-3-030-82381-8_3) |
| `cit-000837` | — | 2021 | — | Bioinformatics study of lectins: new classification and prediction in genom… | [open](https://theses.hal.science/tel-03331649/) |
| `cit-000859` | — | 2021 | Kannan | GTXplorer: A portal to navigate and visualize the evolutionary information … | [open](https://academic.oup.com/glycob/article-abstract/31/11/1472/6330892) |
| `cit-000882` | — | 2021 | de Haan | Bioinformatics in Immunoglobulin Glycosylation Analysis | [open](https://link.springer.com/chapter/10.1007/978-3-030-76912-3_6) |
| `cit-001284` | — | 2021 | Raffán-Sanabria | Factor XI deficiency | [open](https://www.sciencedirect.com/science/article/pii/S0889858821000915) |
| `cit-001309` | — | 2021 | Zhao | Five distinct fucan sulfates from sea cucumber Pattalus mollis: Purificatio… | [open](https://www.sciencedirect.com/science/article/pii/S0141813021014847) |
| `cit-001360` | — | 2021 | Napolitano | Sulfated Oligomers of Tyrosol: Toward a New Class of Bioinspired Nonsacchar… | [open](https://pmc.ncbi.nlm.nih.gov/articles/PMC8023584/) |
| `cit-000609` | GlycoGlyph | 2022 | Kimber | Secreted filarial nematode galectins modulate host immune cells | [open](https://www.frontiersin.org/journals/immunology/articles/10.3389/fimmu.2022.952104/full) |
| `cit-000679` | — | 2022 | Zardecki | RCSB Protein Data bank: Tools for visualizing and understanding biological … | [open](https://onlinelibrary.wiley.com/doi/abs/10.1002/pro.4482) |
| `cit-000711` | — | 2022 | Leney | FAIMS enhances the detection of PTM crosstalk sites | [open](https://pmc.ncbi.nlm.nih.gov/articles/PMC8981314/) |
| `cit-000769` | — | 2022 | Lammi | Identification of proteins and N-glycosylation sites of knee cartilage in K… | [open](https://www.sciencedirect.com/science/article/pii/S0141813022009692) |
| `cit-000778` | — | 2022 | Neelamegham | Forward genetic screens of human glycosylation pathways using the GlycoGene… | [open](https://currentprotocols.onlinelibrary.wiley.com/doi/abs/10.1002/cpz1.402) |
| `cit-000786` | — | 2022 | Butler | Construction of an InstantPC-derivatized glycan glucose unit database: a fo… | [open](https://academic.oup.com/glycob/article-abstract/32/4/289/6478835) |
| `cit-000812` | — | 2022 | Dominguez | Computational study of the conformational ensemble of CX3C chemokine recept… | [open](https://www.sciencedirect.com/science/article/pii/S1093326322001577) |
| `cit-000817` | — | 2022 | Ribbat-Idel | Deglycosylation of pathological specimens alters performance of diagnostic … | [open](https://link.springer.com/article/10.1007/s00428-022-03369-6) |
| `cit-000818` | — | 2022 | — | Carbohydrate structure database and other glycan databases as an important … | [open](https://link.springer.com/article/10.1134/S1068162022030190) |
| `cit-000878` | — | 2022 | — | Prediction and Analysis of Drug-Glycoprotein | [open](https://www.researchgate.net/profile/Masayasu-Atsumi/publication/366889417_Prediction_and_Analysis_of_Drug-Glycoprotein_Interactions_with_Mutual_Attention_Neural_Networks/links/643e8f0939aa471a524887cb/Prediction-and-Analysis-of-Drug-Glycoprotein-Interactions-with-Mutual-Attention-Neural-Networks.pdf) |
| `cit-000884` | — | 2022 | Neelamegham | GlycoGene CRISPR library for forward genetic screens of human glycosylation… | [open](https://pmc.ncbi.nlm.nih.gov/articles/PMC9467456/) |
| `cit-000888` | — | 2022 | — | Bioinformatics Resources for the Study of Glycan-Mediated Protein Interacti… | [open](https://www.jove.com/t/63356/bioinformatics-resources-for-study-glycan-mediated-protein) |
| `cit-000610` | GlycoGlyph | 2023 | McCammon | Glycosylation and crowded membrane effects on influenza neuraminidase stabi… | [open](https://pmc.ncbi.nlm.nih.gov/articles/PMC10515755/) |
| `cit-000612` | GlycoGlyph | 2023 | Joshi | Recent progress in high-throughput and automated characterization of N-glyc… | [open](https://www.sciencedirect.com/science/article/pii/S0165993623004843) |
| `cit-000635` | GlycoGlyph | 2023 | Closs | Highlighting the hygroscopic capacities of apiogalacturonans | [open](https://www.sciencedirect.com/science/article/pii/S1093326323001250) |
| `cit-000667` | — | 2023 | Oprea | Pharos 2023: an integrated resource for the understudied human proteome | [open](https://academic.oup.com/nar/article-abstract/51/D1/D1405/6851109) |
| `cit-000700` | — | 2023 | Tabak | Quantitative mapping of the in vivo O-GalNAc glycoproteome in mouse tissues… | [open](https://www.pnas.org/doi/abs/10.1073/pnas.2303703120) |
| `cit-000759` | — | 2023 | Joshi | Recent progress in high-throughput and automated characterization of N-glyc… | [open](https://www.sciencedirect.com/science/article/pii/S0165993623004843) |
| `cit-000823` | — | 2023 | Lewis | Preparing glycomics data for robust statistical analysis with GlyCompareCT | [open](https://www.cell.com/star-protocols/fulltext/S2666-1667(23)00120-X) |
| `cit-000864` | — | 2023 | Wessels | Maximizing glycoproteomics results through an integrated PASEF workflow | [open](https://www.biorxiv.org/content/10.1101/2023.12.21.570555.abstract) |
| `cit-000865` | — | 2023 | — | Spin labelling via metabolic glycoengineering for studying post-translation… | [open](https://kops.uni-konstanz.de/bitstreams/163864b1-50d4-4b78-b18b-0d8a6a39b419/download) |
| `cit-001196` | — | 2023 | Guo | An Overview of Thrombin Inhibitors in the Perspective of Structureactivity … | [open](https://www.benthamdirect.com/content/journals/cmc/10.2174/0929867329666220906105200) |
| `cit-000608` | GlycoGlyph | 2024 | Nagar | Structural analysis of mammalian sialic acid esterase | [open](https://www.sciencedirect.com/science/article/pii/S0022283624004236) |
| `cit-000632` | GlycoGlyph | 2024 | Gildersleeve | Insights into biofilm architecture and maturation enable improved clinical … | [open](https://www.cell.com/cell-chemical-biology/fulltext/S2451-9456(24)00483-5) |
| `cit-000664` | — | 2024 | Fadda | Restoring protein glycosylation with GlycoShape | [open](https://www.nature.com/articles/s41592-024-02464-7) |
| `cit-000670` | — | 2024 | Cheng | Highly accurate carbohydrate-binding site prediction with DeepGlycanSite | [open](https://www.nature.com/articles/s41467-024-49516-2) |
| `cit-000736` | — | 2024 | Wessels | Maximizing glycoproteomics results through an integrated parallel accumulat… | [open](https://pmc.ncbi.nlm.nih.gov/articles/PMC11154686/) |
| `cit-000739` | — | 2024 | Pandey | Global O-glycoproteome enrichment and analysis enabled by a combinatorial e… | [open](https://www.cell.com/cell-reports-methods/fulltext/S2667-2375(24)00069-9) |
| `cit-000752` | — | 2024 | Gumbart | Enhanced surface accessibility of SARS-CoV-2 Omicron spike protein due to a… | [open](https://pmc.ncbi.nlm.nih.gov/articles/PMC11184558/) |
| `cit-000755` | — | 2024 | Postlerova | The correlation between human seminal plasma sialoproteins and ejaculate pa… | [open](https://www.sciencedirect.com/science/article/pii/S0141813024021469) |
| `cit-000772` | — | 2024 | Lewis | Decoding glycosylation potential from protein structure across human glycop… | [open](https://pmc.ncbi.nlm.nih.gov/articles/PMC11118808/) |
| `cit-000819` | — | 2024 | Gromiha | CarbDisMut: database on neutral and disease-causing mutations in human carb… | [open](https://academic.oup.com/glycob/article-abstract/34/4/cwae011/7604449) |
| `cit-000828` | — | 2024 | Bojar | Protocol for constructing glycan biosynthetic networks using glycowork | [open](https://www.cell.com/star-protocols/fulltext/S2666-1667(24)00102-3) |
| `cit-001286` | — | 2024 | Zhang | Identification and anticoagulant mechanisms of novel factor XIa inhibitory … | [open](https://www.sciencedirect.com/science/article/pii/S0963996924013784) |
| `cit-000604` | GlycoGlyph | 2025 | Muddiman | A Strategy to Achieve Sub‐Parts‐per‐Million Mass Measurement Accuracy of N‐… | [open](https://analyticalsciencejournals.onlinelibrary.wiley.com/doi/abs/10.1002/jms.5184) |
| `cit-000615` | GlycoGlyph | 2025 | Cobb | Ablation of CD22 induces a pro-inflammatory transcriptome shift and endocyt… | [open](https://academic.oup.com/glycob/article-abstract/35/11/cwaf076/8317966) |
| `cit-000663` | — | 2025 | Savitski | Uncovering protein glycosylation dynamics and heterogeneity using deep quan… | [open](https://www.nature.com/articles/s41594-025-01485-w) |
| `cit-000712` | — | 2025 | Galochkina | DIONYSUS: a database of protein–carbohydrate interfaces | [open](https://academic.oup.com/nar/article-abstract/53/D1/D387/7831082) |
| `cit-000717` | — | 2025 | Kurokawa | Aberrant oxidative modifications of neutrophil myeloperoxidase in anti-neut… | [open](https://www.sciencedirect.com/science/article/pii/S1874391925000399) |
| `cit-000720` | — | 2025 | Liu | O-GlcNAcylation of DJ-1 suppresses ferroptosis in renal cell carcinoma by a… | [open](https://www.sciencedirect.com/science/article/pii/S1567576925000876) |
| `cit-000728` | — | 2025 | Hu | Glycoprotein-Notebook: A Pan-Cancer Glycoproteomic Database and Toolkit for… | [open](https://www.mcponline.org/article/S1535-9476(25)00188-4/fulltext) |
| `cit-000734` | — | 2025 | Muddiman | A Strategy to Achieve Sub‐Parts‐per‐Million Mass Measurement Accuracy of N‐… | [open](https://analyticalsciencejournals.onlinelibrary.wiley.com/doi/abs/10.1002/jms.5184) |
| `cit-000746` | — | 2025 | Ma'ayan | LncRNAlyzr: enrichment analysis for lncRNA sets | [open](https://www.sciencedirect.com/science/article/pii/S002228362500004X) |
| `cit-000785` | — | 2025 | — | Unraveling the diversity of protein-carbohydrate interfaces: Insights from … | [open](https://www.sciencedirect.com/science/article/pii/S0008621525000035) |
| `cit-000793` | — | 2025 | Przybyło | MGAT3 and MGAT5 overexpression alters the protein cargo of extracellular ve… | [open](https://www.sciencedirect.com/science/article/pii/S0006291X25004632) |
| `cit-000814` | — | 2025 | Battaglia | A computational analysis of the glycoprotein LRP1 structure and the role of… | [open](https://www.biorxiv.org/content/10.1101/2025.06.10.658798.abstract) |
| `cit-000630` | GlycoGlyph | 2026 | Thattai | Pareto-optimal synthesis of multiple glycans in Golgi compartments | [open](https://www.cell.com/biophysj/abstract/S0006-3495(26)00445-5) |
| `cit-000718` | — | 2026 | O'Boyle | ChEBI: re-engineered for a sustainable future | [open](https://academic.oup.com/nar/article-abstract/54/D1/D1768/8349173) |
| `cit-000738` | — | 2026 | Ma'ayan | The CFDE Workbench: integrating metadata and processed data from Common Fun… | [open](https://www.sciencedirect.com/science/article/pii/S0022283626000045) |
| `cit-000753` | — | 2026 | Mahal | Glycosylation in Cancer: From Functional Roles to Therapeutic Implications | [open](https://www.annualreviews.org/content/journals/10.1146/annurev-cancerbio-060625-123845) |
| `cit-000773` | — | 2026 | Doering | Two closely related β-1, 2-xylosyltransferases differentially impact crypto… | [open](https://journals.asm.org/doi/abs/10.1128/mbio.00806-26) |
| `cit-000790` | — | 2026 | Palmblad | Semantic annotation of Glycomics and Glycoproteomics methods | [open](https://academic.oup.com/glycob/article-abstract/36/5/cwaf072/8307420) |
| `cit-000798` | — | 2026 | — | Integrating plasma protein-centric multi-omics to evaluate the causal effec… | [open](https://link.springer.com/article/10.1007/s10719-025-10207-9) |
| `cit-000803` | — | 2026 | Ashwood | GlyComboCLI enables command line-based FAIR workflows for glycan compositio… | [open](https://www.biorxiv.org/content/10.64898/2026.05.13.725058.abstract) |
| `cit-000809` | — | 2026 | Narad | Systems biology-driven analysis of obesity-associated genes with transcript… | [open](https://www.sciencedirect.com/science/article/pii/S0006291X26007060) |
| `cit-000820` | — | 2026 | Riley | GlycoDiveR: a modular R framework to analyze and visualize highly dimension… | [open](https://pmc.ncbi.nlm.nih.gov/articles/PMC13041813/) |
| `cit-000822` | — | 2026 | Avci | Molecular mechanisms of immune evasion by host protein glycosylation of a b… | [open](https://www.jbc.org/article/S0021-9258(26)00293-0/fulltext) |
| `cit-000868` | — | 2026 | — | Glycomics and Maternity | [open](https://api.taylorfrancis.com/content/chapters/edit/download?identifierName=doi&identifierValue=10.1201/9781003635901-7&type=chapterpdf) |
| `cit-001323` | — | 2026 | Zhang | AlphaFold3 assisted screening strategy identifying novel coagulation factor… | [open](https://www.sciencedirect.com/science/article/pii/S0960852426015798) |
| `cit-001325` | — | 2026 | Yue | Discovery of Novel FXIa Inhibitory Peptides from Deep-Sea Gigantidas platif… | [open](https://pubs.acs.org/jafcau/article/74/25/19936/5165424) |
| `cit-001332` | — | 2026 | Zhang | Peptidomic characterization and evaluation of in vitro and in vivo anticoag… | [open](https://www.sciencedirect.com/science/article/pii/S2212429226007790) |
| `cit-000548` | GLAD | — | Perez | CBMcarb-DB: interface of the three-dimensional landscape of carbohydrate-bi… | [open](https://books.rsc.org/books/edited-volume/2205/chapter/8051227) |
| `cit-000559` | GLAD | — | — | Glycan Microarray Data Analysis: From Raw Data to Public Database Integrati… | [open](https://www.creative-proteomics.com/resource/glycan-microarray-analysis-and-database-integration.htm) |
| `cit-000560` | GLAD | — | Feizi | CarbArrayART-An update on the software tool for carbohydrate microarray dat… | [open](https://spiral.imperial.ac.uk/entities/publication/6ebd01fb-2687-4761-a614-c85c1a192b24) |
| `cit-000562` | GLAD | — | Feizi | CarbArrayART | [open](https://run.unl.pt/entities/publication/48e256d4-d5a1-4fde-a8a0-ec184408ff34) |

### 2.6 `not-in-indexes` — 42 row(s)

Neither PubMed nor OpenAlex returned the work, so there was nothing to fetch. These tend to be theses, book chapters, or commercial pages.

| row_uid | tool | year | senior author | citing title | link |
|---|---|---|---|---|---|
| `cit-001231` | — | 2015 | — | 5.2. 18.8 Imidoylstannanes, Diazoalkylstannanes, Tin Isocyanates, and Tin I… | — |
| `cit-001389` | — | 2015 | — | New perspectives for antithrombotic therapy—coagulation factor XI as a targ… | [open](https://journals.viamedica.pl/hematology_in_clinical_practice/article/view/44302) |
| `cit-001197` | — | 2018 | Zhang | Inhibition of thrombin by functionalized C60 nanoparticles revealed via in … | [open](https://www.sciencedirect.com/science/article/pii/S1001074217311762) |
| `cit-000905` | — | 2020 | — | Factors modulating the interaction of prions withheparan sulfate and their … | [open](https://www.ovid.com/journals/glyco/abstract/00002513-202012000-00028~factors-modulating-the-interaction-of-prions-withheparan) |
| `cit-000906` | — | 2020 | — | N-glycans on EGF domain-specificO-GlcNAc transferase (EOGT) facilitate EOGT… | [open](https://www.ovid.com/journals/glyco/abstract/00002513-202012000-00030~n-glycans-on-egf-domain-specifico-glcnac-transferase-eogt) |
| `cit-000869` | — | 2021 | Sukhija | Glycobioinformatics in deciphering the mammalian glycocode: Recent advances | [open](https://www.dattaconsultinggroup.com/akdsite/assets/publications/glycocodearticle.pdf) |
| `cit-000853` | — | 2022 | Nesvizhskii | HLA-Glyco: A large-scale interrogation of the glycosylated immunopeptidome | [open](https://www.biorxiv.org/content/10.1101/2022.12.05.519200.abstract) |
| `cit-000881` | — | 2022 | Mahal | Glycomic Analysis Identifies Pre-Vaccination Markers of Response to Influen… | [open](https://www.medrxiv.org/content/10.1101/2022.02.09.22270754.abstract) |
| `cit-000661` | — | 2023 | — | RCSB Protein Data Bank (RCSB. org): delivery of experimentally-determined P… | [open](https://academic.oup.com/nar/article-abstract/51/D1/D488/6845439) |
| `cit-000779` | — | 2024 | — | Protein structure, a genetic encoding for glycosylation | [open](https://www.biorxiv.org/content/10.1101/2024.05.15.594261.abstract) |
| `cit-000829` | — | 2026 | Doering | Two closely related β-1, 2-xylosyltransferases differentially impact fungal… | [open](https://pmc.ncbi.nlm.nih.gov/articles/PMC13131615/) |
| `cit-000839` | — | 2026 | Panneerselvam | Glycomics and Infection Progress: Exploring the Role of Mucuna pruriens (L.… | [open](https://api.taylorfrancis.com/content/chapters/edit/download?identifierName=doi&identifierValue=10.1201/9781003635901-6&type=chapterpdf) |
| `cit-000552` | GLAD | — | — | METABOLITE MULTIPRO/SYNBIOTICS: APPROACHES FOR CONSTRUCTING | — |
| `cit-000567` | GLAD | — | Tiemeyer | Glycoinformatics resources integrated through the GlySpace Alliance | — |
| `cit-000650` | GlycoGlyph | — | — | Probing and elucidating the dynamics of virus-membrane interaction via plas… | — |
| `cit-000849` | — | — | — | From Omics to Multi-Omics: Now What? | [open](https://www.preprints.org/frontend/manuscript/f983136ed1551aa3bf0fcb7e1c714351/download_pub) |
| `cit-000850` | — | — | — | Charge Matters: How flanking substrate charge and silicates modulate O-glyc… | [open](https://search.proquest.com/openview/4440878005eed9956ea24784bb1a782d/1?pq-origsite=gscholar&cbl=18750&diss=y) |
| `cit-000852` | — | — | — | Mechanisms of sodium homeostasis in 3 species of freshwater fish exposed to… | [open](https://ualberta.scholaris.ca/items/dbf10173-cb8c-445a-a027-3958e813e249) |
| `cit-000855` | — | — | — | Scalable Extraction and Curation of Glycan Biomarker Data From Biomedical L… | [open](https://search.proquest.com/openview/5ccff5ba3574d8afeba5491d01d5ee90/1?pq-origsite=gscholar&cbl=18750&diss=y) |
| `cit-000858` | — | — | — | Predicting Risk in Type 2 Diabetes and Clear Cell Renal Cell Carcinoma With… | [open](https://search.proquest.com/openview/17321052af4585b2a384aad7fec6b023/1?pq-origsite=gscholar&cbl=18750&diss=y) |
| `cit-000861` | — | — | — | The Nutrient Sensing O-GlcNAc Modification in Development and Neuroendocrin… | [open](https://search.proquest.com/openview/8d9b313b4db561c734bdd26d5753910b/1?pq-origsite=gscholar&cbl=18750&diss=y) |
| `cit-000863` | — | — | — | Adhesion and invasion dynamics of fusobacterium nucleatum in colorectal can… | [open](https://etheses.bham.ac.uk/id/eprint/15244/) |
| `cit-000866` | — | — | — | Structure-Based Studies of RNA Virus Entry and Assembly in the Native Conte… | [open](https://search.proquest.com/openview/1e7eacb77be0fdd15edafdd5bb2d42cd/1?pq-origsite=gscholar&cbl=18750&diss=y) |
| `cit-000867` | — | — | — | Evaluating Roles of Sialic Acid in Host-Pathogen Interactions | [open](https://ualberta.scholaris.ca/items/44d2fffa-696f-4875-a4f2-4939332eb33e) |
| `cit-000871` | — | — | — | Systems methods for the discovery of coordinated host proteome and glycopro… | [open](https://search.proquest.com/openview/e439166b65e8c7b6b294712bbd13b4a3/1?pq-origsite=gscholar&cbl=18750&diss=y) |
| `cit-000872` | — | — | — | Characterization of novel human centromeric interactors and their role in h… | [open](https://edoc.ub.uni-muenchen.de/31547/1/Kumar_Chandni_Natalia.pdf) |
| `cit-000873` | — | — | — | Mass spectrometry approaches towards the characterisation of protein post-t… | [open](https://etheses.bham.ac.uk/id/eprint/13661/) |
| `cit-000874` | — | — | — | The Host Glycome in Health and Immunity | [open](https://ualberta.scholaris.ca/items/d866371d-d6e7-44e8-b3dd-53c15fefeef6) |
| `cit-000879` | — | — | — | Glycan Image Recognition Using Deep Learning | [open](https://search.proquest.com/openview/c0ef44c794a800cd01196940ce6f2d72/1?pq-origsite=gscholar&cbl=18750&diss=y) |
| `cit-000886` | — | — | — | Using Omics to Understand Cancer Glycobiology at a Systems-Level | [open](https://search.proquest.com/openview/0b696ad71c37101dfda1ba7266f0dfd8/1?pq-origsite=gscholar&cbl=18750&diss=y) |
| `cit-000887` | — | — | — | Designing, Visualizing, and Evaluating Interpretable Machine Learning Appli… | [open](https://search.proquest.com/openview/c9494eb3c7e5e0ee47de4898d04e3982/1?pq-origsite=gscholar&cbl=18750&diss=y) |
| `cit-000893` | — | — | — | Comprehensive Analysis of Glycosyltransferases in Cancer Identified from a … | [open](https://search.proquest.com/openview/5482674d8a9a4644ca15ac411277706a/1?pq-origsite=gscholar&cbl=18750&diss=y) |
| `cit-000894` | — | — | — | Developing New Informatics Approaches for Investigating Sequence-Structure-… | [open](https://search.proquest.com/openview/b8f980898ab0e04568e7f98978fc4d4d/1?pq-origsite=gscholar&cbl=18750&diss=y) |
| `cit-000895` | — | — | — | Method Development for O-glycan Analysis and its Application to Parkinson's… | [open](https://researchrepository.ucd.ie/server/api/core/bitstreams/1bd49382-5e9d-4e1e-9336-0020d5145fef/content) |
| `cit-000896` | — | — | — | Integration and Functional Evaluation of Text-Mining and Manually Curated D… | [open](https://search.proquest.com/openview/a5ba1e35ded3967118bbef0231dc3621/1?pq-origsite=gscholar&cbl=18750&diss=y) |
| `cit-001207` | — | — | — | ASSESSING DRUG DEVELOPMENT PROPORTIES OF ANTITHROMBOTIC AND ANTI-CANCER AGE… | [open](https://scholarscompass.vcu.edu/etd/7203/?gathStatIcon=true/) |
| `cit-001215` | — | — | — | This article has been accepted for publication and undergone full peer revi… | [open](https://boris-portal.unibe.ch/bitstreams/b2d903ec-cab8-40a8-b807-ce8129002e65/download) |
| `cit-001229` | — | — | — | Arimidex clotting trt prevent thrombosis Endocrine Abstracts | — |
| `cit-001342` | — | — | — | Macrocycles with aromatic P2′ groups as factor xia inhibitors | [open](https://patents.google.com/patent/US9777001B2/en) |
| `cit-001371` | — | — | — | ASSESSING DRUG DEVELOPMENT PROPORTIES OF ANTITHROMBOTIC AND ANTI-CANCER AGE… | [open](https://scholarscompass.vcu.edu/etd/7203/?gathStatIcon=true/) |
| `cit-001372` | — | — | — | Polycationic inhibitors to target prothrombotic nucleic acids in vitro and … | [open](https://open.library.ubc.ca/soa/cIRcle/collections/ubctheses/24/items/1.0423028) |
| `cit-001379` | — | — | — | Data Mining/Machine Learning Techniques for Drug Discovery: Computational a… | [open](https://rave.ohiolink.edu/etdc/view?acc_num=akron1524661027035591) |

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

Distribution over all 398 rows: `2` = 108, `3` = 10, `(blank)` = 280.

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
| `cit-000868` | held | INDEPENDENT | **still called independent** | Scholar's short byline |
Where a row is still called independent, the name may belong to a different person with the
same surname — Cummings and Desai are common — but independence is not judged on a maybe,
so the row stays out until the applicant and counsel say otherwise.

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

[`potential_notable_citations.html`](./potential_notable_citations.html) lists **270**
independent citations of the works in the candidate queue that are **not** in `packet.html`.
They appear as **259 rows**
because 11 citations sit on a row already held by
another of my works. One article that cites two of them is one row with two judgements
in it, one per work, so the row says where GLAD sits and where GlycoGlyph sits separately.

It is a review page for the applicant: it is not linked from the packet, not printed
with it, and nothing on it is evidence until a person has read the article and filed it.

| my work | citing works the record lists | less retired | less not independent | less copies | less not English | less in packet | less in original app. | less decided | listed | PDF on file |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| **GLAD** — GLAD: GLycan Array Dashboard, a visual analyt… (2019) | 64 | 0 | 18 | 2 | 0 | 7 | 2 | 5 | **30** | 15 |
| **GlycoGlyph** — GlycoGlyph: a glycan visualizing, drawing and… (2020) | 78 | 0 | 9 | 4 | 0 | 7 | 3 | 28 | **27** | 12 |
| **MAWE** — Reusable glycan microarrays using a microwave… (2024) | 15 | 0 | 6 | 1 | 0 | 5 | 0 | 2 | **1** | 0 |
| **Other** — GlyGen: computational and informatics resourc… (2020) | 248 | 0 | 51 | 14 | 0 | 0 | 0 | 37 | **146** | 36 |
| **Other** — Rational design of potent, small, synthetic a… (2011) | 74 | 0 | 28 | 2 | 0 | 0 | 2 | 10 | **32** | 0 |
| **Other** — Sulfated pentagalloylglucoside is a potent, a… (2013) | 110 | 0 | 54 | 4 | 0 | 0 | 2 | 16 | **34** | 1 |
| **all works** | | | | | | | | | **270** | 64 |

Each work's own arithmetic is printed on the review page beside its name; the row above
is the same screen, not a second tally.

64 citations already have a PDF on file, held under `pending-papers/` until a
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
| `cit-000659` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000660` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000661` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000663` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000664` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000665` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000666` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000667` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000668` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000670` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000672` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000673` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000674` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000675` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000677` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000678` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000679` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000680` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000681` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000683` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000684` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000685` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000686` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000688` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000689` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000691` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000693` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000695` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000696` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000697` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000698` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000699` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000700` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000701` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000702` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000703` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000704` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000705` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000706` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000707` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000708` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000709` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000710` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000711` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000712` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000713` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000715` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000717` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000718` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000719` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000720` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000721` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000722` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000724` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000726` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000727` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000728` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000729` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000730` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000731` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000732` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000733` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000734` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000736` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000737` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000738` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000739` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000741` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000742` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000743` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000744` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000745` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000746` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000747` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000748` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000749` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000750` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000751` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000752` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000753` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000754` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000755` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000756` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000757` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000759` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000763` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000765` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000767` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000768` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000769` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000770` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000771` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000772` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000773` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000775` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000776` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000778` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000779` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000780` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000782` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000783` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000784` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000785` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000786` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000788` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000790` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000793` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000794` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000795` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000798` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000799` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000800` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000801` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000802` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000803` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000804` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000807` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000809` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000811` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000812` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000813` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000814` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000815` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000816` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000817` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000818` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000819` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000820` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000821` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000822` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000823` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000824` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000825` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000828` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000829` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000831` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000832` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000833` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000834` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000837` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000839` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000843` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000844` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000845` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000846` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000847` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000848` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000849` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000850` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000852` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000853` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000855` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000858` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000859` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000861` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000863` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000864` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000865` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000866` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000867` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000868` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000869` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000871` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000872` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000873` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000874` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000875` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000878` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000879` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000881` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000882` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000884` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000886` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000887` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000888` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000893` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000894` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000895` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000896` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000897` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000904` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000905` | GlyGen: computational and informatics resources for glycoscience |
| `cit-000906` | GlyGen: computational and informatics resources for glycoscience |
| `cit-001282` | Sulfated pentagalloylglucoside is a potent, allosteric, and selective inhibitor of factor XIa |
| `cit-001283` | Sulfated pentagalloylglucoside is a potent, allosteric, and selective inhibitor of factor XIa |
| `cit-001284` | Sulfated pentagalloylglucoside is a potent, allosteric, and selective inhibitor of factor XIa |
| `cit-001285` | Sulfated pentagalloylglucoside is a potent, allosteric, and selective inhibitor of factor XIa |
| `cit-001286` | Sulfated pentagalloylglucoside is a potent, allosteric, and selective inhibitor of factor XIa |
| `cit-001287` | Sulfated pentagalloylglucoside is a potent, allosteric, and selective inhibitor of factor XIa |
| `cit-001288` | Sulfated pentagalloylglucoside is a potent, allosteric, and selective inhibitor of factor XIa |
| `cit-001290` | Sulfated pentagalloylglucoside is a potent, allosteric, and selective inhibitor of factor XIa |
| `cit-001291` | Sulfated pentagalloylglucoside is a potent, allosteric, and selective inhibitor of factor XIa |
| `cit-001292` | Sulfated pentagalloylglucoside is a potent, allosteric, and selective inhibitor of factor XIa |
| `cit-001293` | Sulfated pentagalloylglucoside is a potent, allosteric, and selective inhibitor of factor XIa |
| `cit-001294` | Sulfated pentagalloylglucoside is a potent, allosteric, and selective inhibitor of factor XIa |
| `cit-001296` | Sulfated pentagalloylglucoside is a potent, allosteric, and selective inhibitor of factor XIa |
| `cit-001299` | Sulfated pentagalloylglucoside is a potent, allosteric, and selective inhibitor of factor XIa |
| `cit-001302` | Sulfated pentagalloylglucoside is a potent, allosteric, and selective inhibitor of factor XIa |
| `cit-001303` | Sulfated pentagalloylglucoside is a potent, allosteric, and selective inhibitor of factor XIa |
| `cit-001304` | Sulfated pentagalloylglucoside is a potent, allosteric, and selective inhibitor of factor XIa |
| `cit-001305` | Sulfated pentagalloylglucoside is a potent, allosteric, and selective inhibitor of factor XIa |
| `cit-001306` | Sulfated pentagalloylglucoside is a potent, allosteric, and selective inhibitor of factor XIa |
| `cit-001307` | Sulfated pentagalloylglucoside is a potent, allosteric, and selective inhibitor of factor XIa |
| `cit-001309` | Sulfated pentagalloylglucoside is a potent, allosteric, and selective inhibitor of factor XIa |
| `cit-001310` | Sulfated pentagalloylglucoside is a potent, allosteric, and selective inhibitor of factor XIa |
| `cit-001311` | Sulfated pentagalloylglucoside is a potent, allosteric, and selective inhibitor of factor XIa |
| `cit-001312` | Sulfated pentagalloylglucoside is a potent, allosteric, and selective inhibitor of factor XIa |
| `cit-001315` | Sulfated pentagalloylglucoside is a potent, allosteric, and selective inhibitor of factor XIa |
| `cit-001323` | Sulfated pentagalloylglucoside is a potent, allosteric, and selective inhibitor of factor XIa |
| `cit-001325` | Sulfated pentagalloylglucoside is a potent, allosteric, and selective inhibitor of factor XIa |
| `cit-001332` | Sulfated pentagalloylglucoside is a potent, allosteric, and selective inhibitor of factor XIa |
| `cit-001336` | Sulfated pentagalloylglucoside is a potent, allosteric, and selective inhibitor of factor XIa |
| `cit-001338` | Sulfated pentagalloylglucoside is a potent, allosteric, and selective inhibitor of factor XIa |
| `cit-001342` | Sulfated pentagalloylglucoside is a potent, allosteric, and selective inhibitor of factor XIa |
| `cit-001345` | Sulfated pentagalloylglucoside is a potent, allosteric, and selective inhibitor of factor XIa |
| `cit-001352` | Sulfated pentagalloylglucoside is a potent, allosteric, and selective inhibitor of factor XIa |
| `cit-001360` | Sulfated pentagalloylglucoside is a potent, allosteric, and selective inhibitor of factor XIa |
| `cit-001365` | Sulfated pentagalloylglucoside is a potent, allosteric, and selective inhibitor of factor XIa |
| `cit-001366` | Sulfated pentagalloylglucoside is a potent, allosteric, and selective inhibitor of factor XIa |
| `cit-001368` | Sulfated pentagalloylglucoside is a potent, allosteric, and selective inhibitor of factor XIa |
| `cit-001369` | Sulfated pentagalloylglucoside is a potent, allosteric, and selective inhibitor of factor XIa |
| `cit-001370` | Sulfated pentagalloylglucoside is a potent, allosteric, and selective inhibitor of factor XIa |
| `cit-001371` | Sulfated pentagalloylglucoside is a potent, allosteric, and selective inhibitor of factor XIa |
| `cit-001372` | Sulfated pentagalloylglucoside is a potent, allosteric, and selective inhibitor of factor XIa |
| `cit-001373` | Sulfated pentagalloylglucoside is a potent, allosteric, and selective inhibitor of factor XIa |
| `cit-001375` | Sulfated pentagalloylglucoside is a potent, allosteric, and selective inhibitor of factor XIa |
| `cit-001378` | Sulfated pentagalloylglucoside is a potent, allosteric, and selective inhibitor of factor XIa |
| `cit-001379` | Sulfated pentagalloylglucoside is a potent, allosteric, and selective inhibitor of factor XIa |
| `cit-001381` | Sulfated pentagalloylglucoside is a potent, allosteric, and selective inhibitor of factor XIa |
| `cit-001382` | Sulfated pentagalloylglucoside is a potent, allosteric, and selective inhibitor of factor XIa |
| `cit-001383` | Sulfated pentagalloylglucoside is a potent, allosteric, and selective inhibitor of factor XIa |
| `cit-001384` | Sulfated pentagalloylglucoside is a potent, allosteric, and selective inhibitor of factor XIa |
| `cit-001386` | Sulfated pentagalloylglucoside is a potent, allosteric, and selective inhibitor of factor XIa |
| `cit-001389` | Sulfated pentagalloylglucoside is a potent, allosteric, and selective inhibitor of factor XIa |
| `cit-001391` | Sulfated pentagalloylglucoside is a potent, allosteric, and selective inhibitor of factor XIa |
| `cit-001159` | Rational design of potent, small, synthetic allosteric inhibitors of thrombin |
| `cit-001160` | Rational design of potent, small, synthetic allosteric inhibitors of thrombin |
| `cit-001162` | Rational design of potent, small, synthetic allosteric inhibitors of thrombin |
| `cit-001164` | Rational design of potent, small, synthetic allosteric inhibitors of thrombin |
| `cit-001169` | Rational design of potent, small, synthetic allosteric inhibitors of thrombin |
| `cit-001171` | Rational design of potent, small, synthetic allosteric inhibitors of thrombin |
| `cit-001173` | Rational design of potent, small, synthetic allosteric inhibitors of thrombin |
| `cit-001175` | Rational design of potent, small, synthetic allosteric inhibitors of thrombin |
| `cit-001176` | Rational design of potent, small, synthetic allosteric inhibitors of thrombin |
| `cit-001178` | Rational design of potent, small, synthetic allosteric inhibitors of thrombin |
| `cit-001179` | Rational design of potent, small, synthetic allosteric inhibitors of thrombin |
| `cit-001180` | Rational design of potent, small, synthetic allosteric inhibitors of thrombin |
| `cit-001181` | Rational design of potent, small, synthetic allosteric inhibitors of thrombin |
| `cit-001182` | Rational design of potent, small, synthetic allosteric inhibitors of thrombin |
| `cit-001186` | Rational design of potent, small, synthetic allosteric inhibitors of thrombin |
| `cit-001187` | Rational design of potent, small, synthetic allosteric inhibitors of thrombin |
| `cit-001189` | Rational design of potent, small, synthetic allosteric inhibitors of thrombin |
| `cit-001191` | Rational design of potent, small, synthetic allosteric inhibitors of thrombin |
| `cit-001192` | Rational design of potent, small, synthetic allosteric inhibitors of thrombin |
| `cit-001195` | Rational design of potent, small, synthetic allosteric inhibitors of thrombin |
| `cit-001196` | Rational design of potent, small, synthetic allosteric inhibitors of thrombin |
| `cit-001197` | Rational design of potent, small, synthetic allosteric inhibitors of thrombin |
| `cit-001198` | Rational design of potent, small, synthetic allosteric inhibitors of thrombin |
| `cit-001200` | Rational design of potent, small, synthetic allosteric inhibitors of thrombin |
| `cit-001203` | Rational design of potent, small, synthetic allosteric inhibitors of thrombin |
| `cit-001204` | Rational design of potent, small, synthetic allosteric inhibitors of thrombin |
| `cit-001205` | Rational design of potent, small, synthetic allosteric inhibitors of thrombin |
| `cit-001207` | Rational design of potent, small, synthetic allosteric inhibitors of thrombin |
| `cit-001208` | Rational design of potent, small, synthetic allosteric inhibitors of thrombin |
| `cit-001209` | Rational design of potent, small, synthetic allosteric inhibitors of thrombin |
| `cit-001211` | Rational design of potent, small, synthetic allosteric inhibitors of thrombin |
| `cit-001212` | Rational design of potent, small, synthetic allosteric inhibitors of thrombin |
| `cit-001213` | Rational design of potent, small, synthetic allosteric inhibitors of thrombin |
| `cit-001215` | Rational design of potent, small, synthetic allosteric inhibitors of thrombin |
| `cit-001216` | Rational design of potent, small, synthetic allosteric inhibitors of thrombin |
| `cit-001217` | Rational design of potent, small, synthetic allosteric inhibitors of thrombin |
| `cit-001220` | Rational design of potent, small, synthetic allosteric inhibitors of thrombin |
| `cit-001221` | Rational design of potent, small, synthetic allosteric inhibitors of thrombin |
| `cit-001224` | Rational design of potent, small, synthetic allosteric inhibitors of thrombin |
| `cit-001225` | Rational design of potent, small, synthetic allosteric inhibitors of thrombin |
| `cit-001227` | Rational design of potent, small, synthetic allosteric inhibitors of thrombin |
| `cit-001229` | Rational design of potent, small, synthetic allosteric inhibitors of thrombin |
| `cit-001230` | Rational design of potent, small, synthetic allosteric inhibitors of thrombin |
| `cit-001231` | Rational design of potent, small, synthetic allosteric inhibitors of thrombin |

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
| reference-number resolution | 74 | 56 |
| extracted text | 4 | 3 |

A resolved citation is held to the same bar as one that names the tool: it must sit in
prose, under a heading the citing paper itself printed, and not in the bibliography entry
that names the applicant's paper — a reference list proves only that the author cited the
work, not where or how. Where a row's tier rests on such a citation, that is said in the
report rather than left for a reader to infer from a section heading alone.

74 mentions across 56 citing works rest on resolution or on a person’s
reading, not on a named-tool scan. `scan-mentions.js` reports those rows separately and
leaves their tier alone — it is not built to find them, so its silence is not evidence
against them.

Resolution also reached 11 citation(s) on rows the packet has already screened
out. Those rows stay out: each was screened for a reason the citation does not answer
— one is not independent, the other was already submitted with the original application
— and a stronger citation cannot undo either. They are recorded rather than dropped so
the decision can be re-examined if the reason for it changes.

### 5.6 How each PDF got here, and what is still missing

Every PDF in the storage roots (`papers/`, `pending-papers/`, `screened-papers/`) arrived
one of three ways, and the distinction matters because only the first two are reproducible
from a script.

**Fetched by `discover-pdfs.js`** — 93 candidate row(s) across 86 distinct file(s), each recorded with the host it came from:

| host | rows | row_uid(s) |
|---|---:|---|
| www.mdpi.com | 17 | `cit-000513`, `cit-000550`, `cit-000592`, `cit-000606`, `cit-000626`, `cit-000660`, `cit-000706`, `cit-000721`, `cit-000757`, `cit-000770`, `cit-000780`, `cit-000795`, `cit-000800`, `cit-000804`, `cit-000821`, `cit-001303`, `cit-001186` |
| (no source recorded) | 15 | `cit-000507`, `cit-000523`, `cit-000525`, `cit-000531`, `cit-000532`, `cit-000534`, `cit-000549`, `cit-000554`, `cit-000564`, `cit-000566`, `cit-000581`, `cit-000614`, `cit-000621`, `cit-000623`, `cit-001263` |
| www.nature.com | 14 | `cit-000510`, `cit-000511`, `cit-000596`, `cit-000600`, `cit-000654`, `cit-000665`, `cit-000666`, `cit-000689`, `cit-000693`, `cit-000695`, `cit-000696`, `cit-000727`, `cit-000744`, `cit-000799` |
| link.springer.com | 9 | `cit-000589`, `cit-000605`, `cit-000622`, `cit-000707`, `cit-000713`, `cit-000737`, `cit-000782`, `cit-000802`, `cit-001302` |
| www.biorxiv.org | 9 | `cit-000631`, `cit-000633`, `cit-000683`, `cit-000742`, `cit-000824`, `cit-000832`, `cit-000833`, `cit-000843`, `cit-000845` |
| www.frontiersin.org | 8 | `cit-000520`, `cit-000593`, `cit-000607`, `cit-000715`, `cit-000730`, `cit-000731`, `cit-000844`, `cit-001287` |
| genomebiology.biomedcentral.com | 2 | `cit-000704`, `cit-000831` |
| arxiv.org | 2 | `cit-000705`, `cit-000726` |
| www.mcponline.org | 1 | `cit-000514` |
| www.intechopen.com | 1 | `cit-000536` |
| pubs.acs.org | 1 | `cit-000538` |
| eymj.org | 1 | `cit-000541` |
| academic.oup.com | 1 | `cit-000543` |
| www.beilstein-journals.org | 1 | `cit-000625` |
| theses.hal.science | 1 | `cit-000656` |
| pmc.ncbi.nlm.nih.gov | 1 | `cit-001262` |
| biologydirect.biomedcentral.com | 1 | `cit-000722` |
| journals.plos.org | 1 | `cit-000741` |
| jcheminf.biomedcentral.com | 1 | `cit-000750` |
| www.ijbs.com | 1 | `cit-000767` |
| www.preprints.org | 1 | `cit-000784` |
| www.tdx.cat | 1 | `cit-000846` |
| publikationen.ub.uni-frankfurt.de | 1 | `cit-000847` |
| www.aginganddisease.org | 1 | `cit-001307` |
| repository.nottingham.ac.uk | 1 | `cit-001378` |

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

Discovery state of all 395 GLAD candidates, from `candidate.discover_state`:

| state | rows | meaning |
|---|---:|---|
| `no-open-copy` | 170 | looked, nothing retrievable found |
| `has-pdf` | 104 | a PDF is on file for the row — seeded that way, fetched by a script, or filed with `file-pdf.js` |
| `paywalled` | 62 | located behind a paywall — the applicant may be able to obtain these |
| `not-in-indexes` | 52 | not found in the open-access indexes consulted |
| `open-copy` | 7 | an open-access copy was located; the row is only `has-pdf` once the file is on disk |

**Still open:** 0 row(s) sit at `open-copy` with no file on disk — a copy was
located and never fetched. Chasing them is a decision, not a defect: a row must be independent
(§1.2) before it is worth a download, and 97 candidate(s) are already held — check why before spending effort on a PDF for a row that
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


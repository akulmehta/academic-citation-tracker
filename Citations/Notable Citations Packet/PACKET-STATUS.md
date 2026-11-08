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
| PDFs under `pending-papers/` (awaiting a decision) | 124 |
| PDFs under `screened-papers/` (kept, not filed) | 56 |
| Held — open items, listed below | 725 |
| Screened out — decided, kept for the record (§4.5) | 233 |
| **Rows in table `citation`** | **980** |

`packet.csv` holds the 22 included rows. `screened-out.csv` holds the other 958,
because §4.5 exports `screened-out` and `held` together — counsel is entitled to see that the
work was screened and on what grounds. A screened-out row is not missing work: it is the
record of what was looked at and rejected, with the reason beside it. A held row is open, and
every held row appears in §2 below.

## 2. Held rows — 725 open items


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

### 2.2 `unread` — 108 row(s)

The PDF is filed. Nobody has read it yet.

| row_uid | tool | year | senior author | citing title | link |
|---|---|---|---|---|---|
| `cit-000171` | — | 2015 | Clement | Structure-Based Design, Synthesis and Evaluation of Novel Peptidic Inhibito… | [open](https://www.researchgate.net/profile/Anna-Babinska-2/publication/299917863_Structure-Based_Design_Synthesis_and_Evaluation_of_Novel_Peptidic_Inhibitors_of_Thrombin-Induced_Activation_of_Platelets_Aggregation/links/572a174908ae057b0a0788b5/Structure-Based-Design-Synthesis-and-Evaluation-of-Novel-Peptidic-Inhibitors-of-Thrombin-Induced-Activation-of-Platelets-Aggregation.pdf) |
| `cit-001011` | — | 2015 | Wang | Soluble expression, purification, and characterization of active recombinan… | [open](https://link.springer.com/article/10.1186/s12896-015-0127-y) |
| `cit-000129` | — | 2016 | Tiuca | Biochemistry and Stereochemistry of Anticoagulants | [open](https://www.intechopen.com/chapters/51710) |
| `cit-000330` | — | 2016 | Minond | Discovery of an enzyme and substrate selective inhibitor of ADAM10 using an… | [open](https://www.nature.com/articles/s41598-016-0013-4) |
| `cit-001139` | — | 2016 | Huang | Novel anthranilamide-based FXa inhibitors: Drug design, synthesis and biolo… | [open](https://www.mdpi.com/1420-3049/21/4/491) |
| `cit-000006` | — | 2017 | Sheffield | Selection and characterization of a DNA aptamer inhibiting coagulation fact… | [open](https://www.nature.com/articles/s41598-017-02055-x) |
| `cit-001151` | — | 2017 | Moritomo | A Novel Fragment Recommendation Workflow using Direct and Indirect Transfer… | [open](https://www.jstage.jst.go.jp/article/cbij/17/0/17_1/_article/-char/ja/) |
| `cit-000053` | — | 2018 | Stuppner | Phytochemical and Analytical Characterization of Novel Sulfated Coumarins i… | [open](https://www.mdpi.com/1420-3049/23/11/2735) |
| `cit-000151` | — | 2018 | González-Olivares | Antithrombotic activity of milk protein hydrolysates by lactic acid bacteri… | [open](https://www.scielo.br/j/babt/a/x8bJyKsjdnXvKXPLHSHRtJj/?lang=en) |
| `cit-000050` | — | 2020 | Srinivasan | Explicit treatment of non‐Michaelis‐Menten and atypical kinetics in early d… | [open](https://chemistry-europe.onlinelibrary.wiley.com/doi/abs/10.1002/cmdc.202000791) |
| `cit-000217` | — | 2020 | Ellström | Revealing interspecies transmission barriers of avian influenza A viruses | [open](https://www.biorxiv.org/content/10.1101/2020.11.17.386755.abstract) |
| `cit-000623` | GlycoGlyph | 2020 | Lewis | A consensus-based and readable extension of Linear Code for Reaction Rules … | [open](https://www.beilstein-journals.org/bjoc/articles/16/215) |
| `cit-001129` | — | 2020 | Zacconi | Innovative Three-Step Microwave-Promoted Synthesis of N-Propargyltetrahydro… | [open](https://www.mdpi.com/1420-3049/25/3/491) |
| `cit-000185` | — | 2021 | Boons | Glycan remodeled erythrocytes facilitate antigenic characterization of rece… | [open](https://www.nature.com/articles/s41467-021-25713-1) |
| `cit-000414` | — | 2021 | Bailey-Kellogg | Attention please: modeling global and local context in glycan structure-fun… | [open](https://www.biorxiv.org/content/10.1101/2021.10.15.464532.abstract) |
| `cit-000423` | — | 2021 | Yu | Glycan epitopes and potential glycoside antagonists of DC-SIGN Involved in … | [open](https://www.mdpi.com/2218-273X/11/11/1586) |
| `cit-000683` | — | 2021 | J Ma | O-GlcNAcAtlas: A database of experimentally identified O-GlcNAc sites and p… | [open](https://academic.oup.com/glycob/article-abstract/31/7/719/6090059) |
| `cit-000695` | — | 2021 | Lewis | Correcting for sparsity and interdependence in glycomics by accounting for … | [open](https://www.nature.com/articles/s41467-021-25183-5) |
| `cit-000731` | — | 2021 | Heck | Glycoproteoform profiles of individual patients' plasma alpha-1-antichymotr… | [open](https://www.frontiersin.org/journals/immunology/articles/10.3389/fimmu.2020.608466/full) |
| `cit-000795` | — | 2021 | Lisacek | Dealing with the ambiguity of glycan substructure search | [open](https://www.mdpi.com/1420-3049/27/1/65) |
| `cit-001496` | — | 2021 | Kumeiko | A Novel C1q Domain-Containing Protein Isolated from the Mollusk Modiolus ku… | [open](https://www.mdpi.com/1660-3397/19/12/668) |
| `cit-001525` | — | 2021 | J | Low Levels of Natural Anti-α-N-Acetylgalactosamine (Tn) Antibodies Are Asso… | [open](https://www.frontiersin.org/journals/microbiology/articles/10.3389/fmicb.2021.641460/full) |
| `cit-001548` | — | 2021 | Teneberg | Characterization of human medullary thyroid carcinoma glycosphingolipids id… | [open](https://www.mdpi.com/1422-0067/22/19/10463) |
| `cit-001553` | — | 2021 | TG Konstantinidis | The usefulness of rare blood group systems in the risk determination for se… | [open](https://www.mdpi.com/1873-149X/28/4/32) |
| `cit-000116` | — | 2022 | Kuznetsov | An Efficient Method of Birch Ethanol Lignin Sulfation with a Sulfaic Acid-U… | [open](https://www.mdpi.com/1420-3049/27/19/6356) |
| `cit-000421` | — | 2022 | Zong | Self-assembled TLR7/8 agonist-mannose conjugate as an effective vaccine adj… | [open](https://www.mdpi.com/2073-4360/14/24/5466) |
| `cit-000455` | — | 2022 | D’Antona | A potential antibody repertoire diversification mechanism through tyrosine … | [open](https://www.frontiersin.org/journals/immunology/articles/10.3389/fimmu.2022.1072702/full) |
| `cit-000459` | — | 2022 | Foka | Targeting the YXXΦ motifs of the SARS coronaviruses 1 and 2 ORF3a peptides … | [open](https://www.mdpi.com/2218-273X/12/8/1052) |
| `cit-000654` | GlycoGlyph | 2022 | Prasad | Novel fold of rotavirus glycan-binding domain predicted by AlphaFold2 and d… | [open](https://escholarship.org/content/qt77j1n0fs/qt77j1n0fs.pdf?v=lg) |
| `cit-000666` | — | 2022 | Klassen | Sialic acid-containing glycolipids mediate binding and viral entry of SARS-… | [open](https://www.nature.com/articles/s41589-021-00924-1) |
| `cit-000693` | — | 2022 | Schumann | Cell-specific bioorthogonal tagging of glycoproteins | [open](https://www.nature.com/articles/s41467-022-33854-0) |
| `cit-000800` | — | 2022 | Zgoda | Construction of 2DE patterns of plasma proteins: aspect of potential tumor … | [open](https://www.mdpi.com/1422-0067/23/19/11113) |
| `cit-000845` | — | 2022 | Ronald | Sensitive spatiotemporal tracking of spontaneous metastasis in deep tissues… | [open](https://www.biorxiv.org/content/10.1101/2022.02.09.479610.abstract) |
| `cit-000924` | MAWE | 2022 | Varki | Simple and practical sialoglycan encoding system reveals vast diversity in … | [open](https://academic.oup.com/glycob/article-abstract/32/12/1101/6682810) |
| `cit-001303` | — | 2022 | Liu | Physicochemical Properties and Anticoagulant Activity of Purified Heteropol… | [open](https://www.mdpi.com/1420-3049/27/9/3027) |
| `cit-001471` | MAWE | 2022 | Varki | Simple and practical sialoglycan encoding system reveals vast diversity in … | [open](https://academic.oup.com/glycob/article-abstract/32/12/1101/6682810) |
| `cit-001532` | — | 2022 | Á | Intravenous immunoglobulins promote an expansion of monocytic myeloid-deriv… | [open](https://link.springer.com/article/10.1007/s10875-022-01277-7) |
| `cit-000188` | — | 2023 | Pekosz | 2019–2020 H1N1 clade A5a. 1 viruses have better in vitro fitness compared w… | [open](https://www.nature.com/articles/s41598-023-37122-z) |
| `cit-000191` | — | 2023 | Paulson | Glyco-engineered MDCK cells display preferred receptors of H3N2 influenza a… | [open](https://www.nature.com/articles/s41467-023-41908-0) |
| `cit-000409` | — | 2023 | Coelho | Feasibility of Brewer's spent yeast microcapsules as targeted oral carriers | [open](https://www.mdpi.com/2304-8158/12/2/246) |
| `cit-000424` | — | 2023 | Liu | Novel multifunctional glycan probes to elucidate specificities of diverse g… | [open](https://www.biorxiv.org/content/10.1101/2023.07.09.548266.abstract) |
| `cit-000741` | — | 2023 | Morrissette | The tubulin database: Linking mutations, modifications, ligands and local i… | [open](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0295279) |
| `cit-000742` | — | 2023 | Ronald | A genetically encoded magnetic resonance imaging reporter enables sensitive… | [open](https://aacrjournals.org/cancerres/article-abstract/83/5/673/716684) |
| `cit-000744` | — | 2023 | Nesvizhskii | Unraveling the glycosylated immunopeptidome with HLA-Glyco | [open](https://www.nature.com/articles/s41467-023-39270-2) |
| `cit-000750` | — | 2023 | Kalinina | GlyLES: Grammar-based Parsing of Glycans from IUPAC-condensed to SMILES | [open](https://link.springer.com/article/10.1186/s13321-023-00704-0) |
| `cit-000757` | — | 2023 | Wessels | The GlycoPaSER prototype as a real-time N-glycopeptide identification tool … | [open](https://www.mdpi.com/1422-0067/24/9/7869) |
| `cit-000770` | — | 2023 | Butterick | RNAseq analysis of FABP4 knockout mouse hippocampal transcriptome suggests … | [open](https://www.mdpi.com/1422-0067/24/4/3381) |
| `cit-000844` | — | 2023 | Heisterkamp | Glycosylation as regulator of human B-cell leukaemias in bone marrow | [open](https://www.frontiersin.org/journals/hematology/articles/10.3389/frhem.2023.1279863/full) |
| `cit-001050` | — | 2023 | Li | A Mannose Receptor from Litopenaeus vannamei Involved in Innate Immunity by… | [open](https://www.mdpi.com/1422-0067/24/13/10665) |
| `cit-001098` | — | 2023 | Liu | Novel multifunctional glycan probes to elucidate specificities of diverse g… | [open](https://www.biorxiv.org/content/10.1101/2023.07.09.548266.abstract) |
| `cit-001498` | — | 2023 | Schwalbe | Limited N-glycan processing impacts chaperone expression patterns, cell gro… | [open](https://www.mdpi.com/2079-7737/12/2/293) |
| `cit-000202` | — | 2024 | de Vries | Complex N-glycans are important for interspecies transmission of H7 influen… | [open](https://journals.asm.org/doi/abs/10.1128/jvi.01941-23) |
| `cit-000248` | — | 2024 | Freire | Truncated O-glycosylation in metastatic triple-negative breast cancer revea… | [open](https://www.nature.com/articles/s41598-024-52204-2) |
| `cit-000270` | — | 2024 | LW Guo | GALNT4 promotes the endothelial cell inflammatory response via the NF-κB si… | [open](https://assets-eu.researchsquare.com/files/rs-3998175/v1/1aea954f-41d8-4131-a569-68ce64bc9d4b.pdf) |
| `cit-000442` | — | 2024 | Wolters-Eisfeld | GalNT2-mediated O-glycosylation affects pancreas development and function i… | [open](https://www.nature.com/articles/s41598-024-80276-7) |
| `cit-000454` | — | 2024 | Zhong | Tyrosine sulfation at antibody light chain CDR-1 increases binding affinity… | [open](https://www.mdpi.com/1422-0067/25/3/1931) |
| `cit-000460` | — | 2024 | Hartley | Arylsulfatases and neuraminidases modulate engagement of CCR5 by chemokines… | [open](https://www.nature.com/articles/s41598-023-50944-1) |
| `cit-000696` | — | 2024 | Taylor | Petagraph: A large-scale unifying knowledge graph framework for integrating… | [open](https://www.nature.com/articles/s41597-024-04070-w) |
| `cit-000722` | — | 2024 | Banerjee | Combatting cellular immortality in cancers by targeting the shelterin prote… | [open](https://link.springer.com/article/10.1186/s13062-024-00552-4) |
| `cit-000727` | — | 2024 | R Li | Multivalent interactions between fully glycosylated influenza virus hemaggl… | [open](https://www.nature.com/articles/s44298-024-00059-9) |
| `cit-000767` | — | 2024 | Poon | CHHM: a manually curated catalogue of human histone modifications revealing… | [open](https://pmc.ncbi.nlm.nih.gov/articles/PMC11302869/) |
| `cit-000831` | — | 2024 | Vafaee | Multifaceted representation of genes via deep learning of gene expression n… | [open](https://www.biorxiv.org/content/10.1101/2024.03.07.583777.abstract) |
| `cit-000961` | — | 2024 | Liou | Predictors of remission or combined remission and low disease activity in r… | [open](https://www.mdpi.com/2077-0383/13/9/2521) |
| `cit-001044` | — | 2024 | Escobedo | Neu1 deficiency and fibrotic lymph node microenvironment lead to imbalance … | [open](https://www.frontiersin.org/journals/immunology/articles/10.3389/fimmu.2024.1462853/full) |
| `cit-001108` | Glyco-SPOT | 2024 | Narimatsu | Mammalian cell-based production of glycans, glycopeptides and glycomodules | [open](https://www.nature.com/articles/s41467-024-53738-9) |
| `cit-001483` | — | 2024 | Itano | Tolerable glycometabolic stress boosts cancer cell resilience through alter… | [open](https://www.nature.com/articles/s41419-024-06432-z) |
| `cit-001535` | — | 2024 | Chen | Broad-Spectrum Legionaminic Acid-Specific Antibodies in Pooled Human IgGs R… | [open](https://www.mdpi.com/1420-3049/29/16/3980) |
| `cit-001537` | — | 2024 | Bovin | Some Human Anti-Glycan Antibodies Lack the Ability to Activate the Compleme… | [open](https://www.mdpi.com/2073-4468/13/4/105) |
| `cit-000108` | — | 2025 | Balaji | Sustained ROS scavenging and pericellular oxygenation by lignin composites … | [open](https://www.sciencedirect.com/science/article/pii/S1742706125003009) |
| `cit-000405` | — | 2025 | Ferreira | Glycomics and glycoproteomics reveal distinct oligomannose carriers across … | [open](https://www.mdpi.com/1422-0067/26/10/4891) |
| `cit-000449` | — | 2025 | Wolters-Eisfeld | Overexpression of Tn antigen induces chronic pancreatitis in mice | [open](https://www.nature.com/articles/s41598-025-96060-0) |
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
| `cit-000951` | — | 2025 | Triguero-Martínez | Differential expression of galectin-1 and galectin-9 in immune-mediated inf… | [open](https://www.mdpi.com/1422-0067/26/18/9087) |
| `cit-000957` | — | 2025 | Pizzimenti | Methanol Extract from Ranunculus repens L. Down-Regulated Galectins 4 and 9… | [open](https://www.mdpi.com/2076-3921/14/12/1436) |
| `cit-000960` | — | 2025 | Fancourt | Plasma proteomic signatures of social support and their association with ca… | [open](https://pmc.ncbi.nlm.nih.gov/articles/PMC12363696/) |
| `cit-001041` | — | 2025 | SI | Subcellular glycan-mannose receptor binding kinetics correlate with myeloid… | [open](https://www.nature.com/articles/s41467-025-67602-x) |
| `cit-001048` | — | 2025 | He | The role of ladderlectin in spermatogenesis and ovarian sperm storage in th… | [open](https://www.nature.com/articles/s42003-025-08055-2) |
| `cit-001057` | — | 2025 | Asteggiano | In vitro cell model to dilucidate the underlying molecular mechanism associ… | [open](https://www.frontiersin.org/journals/genetics/articles/10.3389/fgene.2025.1678103/full) |
| `cit-001070` | — | 2025 | He | spermatogenesis and ovarian sperm storage in the black rockfish (Sebastes | [open](https://www.researchgate.net/profile/Yan-He-32/publication/390893517_The_role_of_ladderlectin_in_spermatogenesis_and_ovarian_sperm_storage_in_the_black_rockfish_Sebastes_schlegelii/links/6802efd2d1054b0207d524c1/The-role-of-ladderlectin-in-spermatogenesis-and-ovarian-sperm-storage-in-the-black-rockfish-Sebastes-schlegelii.pdf) |
| `cit-001460` | MAWE | 2025 | MacIntyre | Identification and characterisation of vaginal bacteria-glycan interactions… | [open](https://www.nature.com/articles/s41467-025-60404-1) |
| `cit-001490` | — | 2025 | Ferreira | Trimmed n-glycans define aggressive gastric cancer and predict clinical out… | [open](https://pmc.ncbi.nlm.nih.gov/articles/PMC12486017/) |
| `cit-001491` | — | 2025 | Ferreira | Glycomics and glycoproteomics reveal distinct oligomannose carriers across … | [open](https://www.mdpi.com/1422-0067/26/10/4891) |
| `cit-000182` | — | 2026 | RP | The receptor binding properties of H5Ny influenza A viruses have evolved to… | [open](https://journals.plos.org/plospathogens/article?id=10.1371/journal.ppat.1013812) |
| `cit-000250` | — | 2026 | Naidoo | An in vitro approach for simulating divergent Golgi O-glycosylation of tumo… | [open](https://www.nature.com/articles/s41467-026-72151-y) |
| `cit-000263` | — | 2026 | Sampathkumar | Inhibition of mucin-type O-glycosylation impairs melanogenesis, melanoma gr… | [open](https://www.biorxiv.org/content/10.64898/2026.02.25.707981.abstract) |
| `cit-000420` | — | 2026 | King | Programming N-linked glycan composition through de novo protein design | [open](https://www.biorxiv.org/content/10.64898/2026.10.07.757460.abstract) |
| `cit-000465` | — | 2026 | Benesch | An integrated mass spectrometry strategy for quantifying the proteoform div… | [open](https://www.biorxiv.org/content/10.64898/2026.09.07.749945.abstract) |
| `cit-000780` | — | 2026 | Brand | Diagnosis of Congenital Disorders of Glycosylation Type II Subtypes Through… | [open](https://www.mdpi.com/1422-0067/27/14/6309) |
| `cit-000799` | — | 2026 | Lipinski | Rubicon modulates neuroimmune responses following traumatic brain injury | [open](https://pmc.ncbi.nlm.nih.gov/articles/PMC13001424/) |
| `cit-000802` | — | 2026 | Kuno | A hierarchical lectin-based multimodal workflow for spatial mapping of extr… | [open](https://link.springer.com/article/10.1007/s00216-026-06501-6) |
| `cit-000832` | — | 2026 | L'opez | Multi-timescale PTM architecture in human RNA polymerase II | [open](https://www.biorxiv.org/content/10.64898/2026.06.27.734958.abstract) |
| `cit-000833` | — | 2026 | A Kitani | GlycoMeSH: linking glycan structures to biomedical context for systematic e… | [open](https://www.biorxiv.org/content/10.64898/2026.08.18.745318.abstract) |
| `cit-000843` | — | 2026 | K Himori | GlyEnzEA: reaction-informed enrichment of enzyme-centered glycan sets from … | [open](https://www.biorxiv.org/content/10.64898/2026.10.14.759156.abstract) |
| `cit-000959` | — | 2026 | Fancourt | Plasma proteomic signatures of social support and their association with ca… | [open](https://link.springer.com/article/10.1007/s11357-025-02031-8) |
| `cit-000962` | — | 2026 | .Inancc | Salivary Galectin-9 Levels in Primary Sjögren's Disease: An Observational C… | [open](https://www.mdpi.com/2077-0383/15/10/3684) |
| `cit-001051` | — | 2026 | Asciutto | Deglycosylation induces a novel distal conformation in the mannose receptor… | [open](https://www.nature.com/articles/s41598-026-35240-y) |
| `cit-001055` | — | 2026 | Li | Associations of polymorphisms in the myeloid immunoregulatory receptor gene… | [open](https://www.frontiersin.org/journals/immunology/articles/10.3389/fimmu.2026.1949691/full) |
| `cit-001071` | — | 2026 | S Alkami | Pengembangan Tablet Isap Imunostimulan yang Mengandung Kombinasi Ekstrak Bu… | [open](https://medicinus.co/journal/article/view/medicinus-vol39-no9-27-41) |
| `cit-001497` | — | 2026 | AP Burch | Neuroblastoma cell growth and invasiveness is modulated by the activity of … | [open](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0350822) |

### 2.3 `unsupported` — 11 row(s)

The PDF is filed, but the extracted text does not support a use in any section — the mentions sit in the reference list, in a table, or under a heading the paper did not print. Either re-read the page and record what it says, or screen the row out.

| row_uid | tool | year | senior author | citing title | link |
|---|---|---|---|---|---|
| `cit-000536` | GLAD | 2019 | Afanasiev | Metabolite multiprobiotic formulas for microbial health | [open](https://www.intechopen.com/chapters/67420) |
| `cit-000550` | GLAD | 2019 | Lisacek | A bioinformatics view of glycan–virus interactions | [open](https://www.mdpi.com/1999-4915/11/4/374) |
| `cit-000513` | GLAD | 2020 | Zou | Databases and bioinformatic tools for glycobiology and glycoproteomics | [open](https://www.mdpi.com/1422-0067/21/18/6727) |
| `cit-000541` | GLAD | 2020 | Cha | An automated fast healthcare interoperability resources-based 12-lead elect… | [open](https://pmc.ncbi.nlm.nih.gov/articles/PMC7214107/) |
| `cit-001121` | Glyco-SPOT | 2020 | Ferenbach | CRISPR-Cas9-mediated depletion of O-GlcNAc hydrolase and transferase for fu… | [open](https://www.biorxiv.org/content/10.1101/2020.08.19.258079.abstract) |
| `cit-000554` | GLAD | 2021 | Sukhija | Glycobioinformatics in deciphering the mammalian glycocode: Recent advances | [open](https://www.dattaconsultinggroup.com/akdsite/assets/publications/glycocodearticle.pdf) |
| `cit-000581` | GlycoGlyph | 2021 | Munkley | FUT8 alpha-(1, 6)-fucosyltransferase in cancer | [open](https://www.mdpi.com/1422-0067/22/1/455) |
| `cit-000592` | GlycoGlyph | 2024 | Siebels | Hypoxia-induced adaptations of N-glycomes and proteomes in breast cancer ce… | [open](https://www.mdpi.com/1422-0067/25/18/10216) |
| `cit-001517` | — | 2024 | Narimatsu | Mammalian cell-based production of glycans, glycopeptides and glycomodules | [open](https://www.nature.com/articles/s41467-024-53738-9) |
| `cit-000605` | GlycoGlyph | 2025 | Kontoravdi | GlyCompute: towards the automated analysis of protein N-linked glycosylatio… | [open](https://link.springer.com/article/10.1007/s00216-024-05522-3) |
| `cit-001116` | Glyco-SPOT | 2026 | Hurevich | Stirring glycopeptides away from the constraints of solid-phase synthesis m… | [open](https://www.frontiersin.org/journals/molecular-biosciences/articles/10.3389/fmolb.2026.1863326/full) |

### 2.4 `paywalled` — 122 row(s)

A copy exists behind a paywall. If the applicant can obtain the PDF through an institution, drop it in the folder and the row can be read.

| row_uid | tool | year | senior author | citing title | link |
|---|---|---|---|---|---|
| `cit-000875` | — | 2010 | Inoue | LC-ESI-MS/MS | [open](https://www.researchgate.net/profile/Daniel-Bojar-2/publication/373192999_Breast_Milk_Oligosaccharides_Contain_Immunomodulatory_Glucuronic_Acid_and_LacdiNAc/links/64deec6ecaf5ff5cd0c399e5/Breast-Milk-Oligosaccharides-Contain-Immunomodulatory-Glucuronic-Acid-and-LacdiNAc.pdf) |
| `cit-001154` | — | 2012 | Malaika | Discovery and Biophysical Characterization of Allosteric Inhibitors of Fact… | [open](https://scholarscompass.vcu.edu/etd/418/) |
| `cit-001203` | — | 2012 | Lima | Allosteric activation of human α-thrombin through exosite 2 by suramin anal… | [open](https://www.sciencedirect.com/science/article/pii/S0003986112000434) |
| `cit-001208` | — | 2012 | — | Discovery and Biophysical Characterization of Allosteric Inhibitors of Fact… | [open](https://scholarscompass.vcu.edu/etd/418/) |
| `cit-001224` | — | 2012 | — | Designing direct and indirect factor Xa inhibitors | [open](https://search.proquest.com/openview/69367e48ed50250dfb2bc51b5e13c73e/1?pq-origsite=gscholar&cbl=18750) |
| `cit-001026` | — | 2013 | — | Reverse-phase Ion-Pairing Ultra Performance Liquid Chromatography-Mass Spec… | [open](https://scholarscompass.vcu.edu/etd/3031/?show=full) |
| `cit-001034` | — | 2013 | — | Kinetic and Thermodynamic Studies of Thrombin Inhibitors | [open](https://scholarscompass.vcu.edu/etd/2956/?show=full) |
| `cit-001155` | — | 2013 | Pooja | Reverse-phase Ion-Pairing Ultra Performance Liquid Chromatography-Mass Spec… | [open](https://scholarscompass.vcu.edu/etd/3031/?show=full) |
| `cit-001209` | — | 2013 | — | Reverse-phase Ion-Pairing Ultra Performance Liquid Chromatography-Mass Spec… | [open](https://scholarscompass.vcu.edu/etd/3031/?show=full) |
| `cit-000029` | — | 2014 | Melnyk | Thiocarbamate-Linked Polysulfonate–Peptide Conjugates As Selective Hepatocy… | [open](https://pmc.ncbi.nlm.nih.gov/articles/PMC4064695/) |
| `cit-000369` | — | 2014 | Melnyk | Thiocarbamate-Linked Polysulfonate–Peptide Conjugates As Selective Hepatocy… | [open](https://pmc.ncbi.nlm.nih.gov/articles/PMC4064695/) |
| `cit-001216` | — | 2014 | — | Design, synthesis, and biochemical evaluation of novel inhibitors of Norwal… | — |
| `cit-001221` | — | 2014 | — | Structure-based design and optimization of dipeptidyl inhibitors of norovir… | — |
| `cit-001305` | — | 2014 | Kang | Fasxiator, a novel factor XI a inhibitor from snake venom, and its site‐spe… | [open](https://onlinelibrary.wiley.com/doi/abs/10.1111/jth.12797) |
| `cit-001370` | — | 2014 | Melnyk | Thiocarbamate-Linked Polysulfonate–Peptide Conjugates As Selective Hepatocy… | [open](https://pmc.ncbi.nlm.nih.gov/articles/PMC4064695/) |
| `cit-000357` | — | 2015 | Yurttacs | Synthesis and biological evaluation of some dibenzofuran-piperazine derivat… | [open](https://www.tandfonline.com/doi/abs/10.3109/14756366.2015.1108971) |
| `cit-001019` | — | 2015 | Jairajpuri | Polysulfated trehalose as a novel anticoagulant agent with dual mode of act… | [open](https://onlinelibrary.wiley.com/doi/abs/10.1155/2015/630482) |
| `cit-001192` | — | 2015 | Yurttacs | Synthesis and biological evaluation of some dibenzofuran-piperazine derivat… | [open](https://www.tandfonline.com/doi/abs/10.3109/14756366.2015.1108971) |
| `cit-000147` | — | 2016 | Scilingo | Amaranth peptides with antithrombotic activity released by simulated gastro… | [open](https://www.sciencedirect.com/science/article/pii/S1756464615005125) |
| `cit-001030` | — | 2017 | — | Engineering Macrophages for Cell-Based Therapies | [open](https://search.proquest.com/openview/533c3bb7aa81e4a5473741f68ff87200/1?pq-origsite=gscholar&cbl=18750) |
| `cit-000085` | — | 2018 | Schöneweiß | Reconfigurable DNA-nanochambers as dynamic compartmentalization systems | [open](https://duepublico2.uni-due.de/servlets/MCRFileNodeServlet/duepublico_derivate_00045482/Diss_Schoeneweiss.pdf) |
| `cit-000139` | — | 2018 | Billur | Biophysical exploration of conformational environments in zymogen prothromb… | [open](https://ir.library.louisville.edu/etd/2904/) |
| `cit-000160` | — | 2018 | Barberis | Enzymatic and chemical synthesis of new anticoagulant peptides | [open](https://aiche.onlinelibrary.wiley.com/doi/abs/10.1002/btpr.2658) |
| `cit-001211` | — | 2018 | — | Biophysical exploration of conformational environments in zymogen prothromb… | [open](https://ir.library.louisville.edu/etd/2904/) |
| `cit-001451` | — | 2018 | Billur | Biophysical exploration of conformational environments in zymogen prothromb… | [open](https://ir.library.louisville.edu/etd/2904/) |
| `cit-000003` | — | 2019 | Wilmen | Allosteric inhibition as a new mode of action for BAY 1213790, a neutralizi… | [open](https://www.sciencedirect.com/science/article/pii/S0022283619305625) |
| `cit-000051` | — | 2019 | Sousa | Allosteric inhibition of α-thrombin enzymatic activity with ultrasmall gold… | [open](https://pubs.rsc.org/na/article-abstract/1/1/378/607990) |
| `cit-000329` | — | 2019 | Sousa | Allosteric inhibition of α-thrombin enzymatic activity with ultrasmall gold… | [open](https://pubs.rsc.org/na/article-abstract/1/1/378/607990) |
| `cit-000526` | GLAD | 2019 | Kunej | Rise of systems glycobiology and personalized glycomedicine: why and how to… | [open](https://journals.sagepub.com/doi/abs/10.1089/omi.2019.0149) |
| `cit-001291` | — | 2019 | Wilmen | Allosteric inhibition as a new mode of action for BAY 1213790, a neutralizi… | [open](https://www.sciencedirect.com/science/article/pii/S0022283619305625) |
| `cit-000044` | — | 2020 | Biller | Vorasidenib (AG-881): a first-in-class, brain-penetrant dual inhibitor of m… | [open](https://pmc.ncbi.nlm.nih.gov/articles/PMC7025383/) |
| `cit-000063` | — | 2020 | Beyaert | Long-term MALT1 inhibition in adult mice without severe systemic autoimmuni… | [open](https://www.cell.com/iscience/fulltext/S2589-0042(20)30749-5) |
| `cit-000130` | — | 2020 | Alfonso | Incorporation of lignin in natural and synthetic biomaterials to alter mech… | [open](https://repository.lsu.edu/gradschool_dissertations/5412/) |
| `cit-000801` | — | 2020 | — | Glycomics-informed glycoproteomic analysis of site-specific glycosylation f… | [open](https://www.cell.com/star-protocols/fulltext/S2666-1667(20)30201-X) |
| `cit-001433` | — | 2020 | Payne | Potent trivalent inhibitors of thrombin through hybridization of salivary s… | [open](https://onlinelibrary.wiley.com/doi/abs/10.1002/anie.202015127) |
| `cit-001434` | — | 2020 | Sica | Molecular dynamics simulations of human α-thrombin in different structural … | [open](https://www.tandfonline.com/doi/abs/10.1080/07391102.2020.1746693) |
| `cit-000224` | — | 2021 | Nastassja | Evaluation of the Antiviral Effect of Polyglycerols Functionalized with Sia… | [open](https://edoc.hu-berlin.de/items/33a1aa62-52b5-4a55-aa6f-e44bb32b3bdc) |
| `cit-000225` | — | 2021 | Frederik | N-Glycans as Receptors for Influenza A Viruses | [open](https://research-portal.uu.nl/en/publications/n-glycans-as-receptors-for-influenza-a-viruses/) |
| `cit-000232` | — | 2021 | Padler-Karavani | Discovery of rare sulfated N-unsubstituted glucosamine based heparan sulfat… | [open](https://pubs.rsc.org/sc/article-abstract/12/10/3674/706387) |
| `cit-000316` | — | 2021 | Machado | Electrochemical evidence of nitrate release from the nitrooxy compound 4-((… | [open](https://www.sciencedirect.com/science/article/pii/S0753332220311057) |
| `cit-000428` | — | 2021 | Haab | CarboGrove: a resource of glycan-binding specificities through analyzed gly… | [open](https://www.biorxiv.org/content/10.1101/2021.11.12.468378.abstract) |
| `cit-000443` | — | 2021 | — | Development and biological applications of sulfur–triazole exchange (SuTEx)… | [open](https://pubs.rsc.org/cb/article-abstract/2/2/322/674401) |
| `cit-000469` | — | 2021 | — | Sulfotyrosine, an interaction specificity determinant for extracellular pro… | [open](https://www.biorxiv.org/content/10.1101/2021.10.29.466493.abstract) |
| `cit-000675` | — | 2021 | Azadi | Comprehensive characterization of N-and O-glycosylation of SARS-CoV-2 human… | [open](https://academic.oup.com/glycob/article-abstract/31/4/410/5943025) |
| `cit-000678` | — | 2021 | Zardecki | RCSB Protein Data Bank: Celebrating 50 years of the PDB with new tools for … | [open](https://onlinelibrary.wiley.com/doi/abs/10.1002/pro.4213) |
| `cit-000807` | — | 2021 | Tusnády | PolarProtDb: a database of transmembrane and secreted proteins showing apic… | [open](https://www.sciencedirect.com/science/article/pii/S0022283620306239) |
| `cit-000462` | — | 2022 | Laganà | The key role of metal adducts in the differentiation of phosphopeptide from… | [open](https://pubs.acs.org/ancham/article-abstract/94/26/9234/835076) |
| `cit-000617` | GlycoGlyph | 2022 | Gildersleeve | Abnormal antibodies to self-carbohydrates in SARS-CoV-2-infected patients | [open](https://academic.oup.com/pnasnexus/article-abstract/1/3/pgac062/6609787) |
| `cit-000627` | GlycoGlyph | 2022 | Owonikoko | Serum glycomic profile as a predictive biomarker of recurrence in patients … | [open](https://onlinelibrary.wiley.com/doi/abs/10.1002/cam4.5465) |
| `cit-000719` | — | 2022 | Kohler | A photo-cross-linking GlcNAc analog enables covalent capture of N-linked gl… | [open](https://www.cell.com/cell-chemical-biology/fulltext/S2451-9456(21)00347-0) |
| `cit-000733` | — | 2022 | Neelamegham | GlycoEnzOnto: a GlycoEnzyme pathway and molecular function ontology | [open](https://academic.oup.com/bioinformatics/article-abstract/38/24/5413/6772808) |
| `cit-000743` | — | 2022 | Haab | CarboGrove: a resource of glycan-binding specificities through analyzed gly… | [open](https://academic.oup.com/glycob/article-abstract/32/8/679/6555550) |
| `cit-000749` | — | 2022 | Mahal | Prevaccination glycan markers of response to an influenza vaccine implicate… | [open](https://pmc.ncbi.nlm.nih.gov/articles/PMC9361353/) |
| `cit-000776` | — | 2022 | — | RCSB Protein Data Bank resources for structure-facilitated design of mRNA v… | [open](https://www.cell.com/structure/fulltext/S0969-2126(21)00376-2) |
| `cit-000910` | MAWE | 2022 | Derda | GlyNet: a multi-task neural network for predicting protein–glycan interacti… | [open](https://pubs.rsc.org/sc/article-abstract/13/22/6669/746899) |
| `cit-000914` | MAWE | 2022 | Haab | CarboGrove: a resource of glycan-binding specificities through analyzed gly… | [open](https://academic.oup.com/glycob/article-abstract/32/8/679/6555550) |
| `cit-000920` | MAWE | 2022 | Feizi | CarbArrayART: a new software tool for carbohydrate microarray data storage,… | [open](https://academic.oup.com/glycob/article-abstract/32/7/552/6555547) |
| `cit-001095` | — | 2022 | Liu | A universal strategy of glyconanoparticle preparation using a bifunctional … | [open](https://link.springer.com/article/10.1007/s00604-022-05220-w) |
| `cit-001117` | Glyco-SPOT | 2022 | Hurevich | Expeditious synthesis of a glycopeptide library | [open](https://chemistry-europe.onlinelibrary.wiley.com/doi/abs/10.1002/ejoc.202200623) |
| `cit-001142` | — | 2022 | Peng | (1R, 3S)-THCCA-Asn: To show the discovery of selective inhibitor of thrombi… | [open](https://www.sciencedirect.com/science/article/pii/S0223523422005839) |
| `cit-001312` | — | 2022 | Huang | Expedient Synthesis of a Library of Heparan Sulfate‐Like “Head‐to‐Tail” Lin… | [open](https://onlinelibrary.wiley.com/doi/abs/10.1002/ange.202209730) |
| `cit-001462` | MAWE | 2022 | Haab | CarboGrove: a resource of glycan-binding specificities through analyzed gly… | [open](https://academic.oup.com/glycob/article-abstract/32/8/679/6555550) |
| `cit-001526` | — | 2022 | Gildersleeve | Microarray-guided evaluation of the frequency, B-cell origins, and selectiv… | [open](https://www.jbc.org/article/S0021-9258(22)00911-5/fulltext) |
| `cit-000187` | — | 2023 | de Vries | Revealing the specificity of human H1 influenza A viruses to complex N-Glyc… | [open](https://pmc.ncbi.nlm.nih.gov/articles/PMC10052259/) |
| `cit-000200` | — | 2023 | de Vries | Contemporary human H3N2 influenza a viruses require a low threshold of suit… | [open](https://academic.oup.com/glycob/article-abstract/33/10/784/7227110) |
| `cit-000400` | — | 2023 | Klassen | Absolute affinities from quantitative shotgun glycomics using concentration… | [open](https://pmc.ncbi.nlm.nih.gov/articles/PMC10303200/) |
| `cit-000447` | — | 2023 | Niu | Fluorosulfate as a latent sulfate in peptides and proteins | [open](https://pubs.acs.org/jacsat/article-abstract/145/37/20189/431527) |
| `cit-000497` | — | 2023 | Melero | CD137 (4-1BB) requires physically associated cIAPs for signal transduction … | [open](https://www.science.org/doi/abs/10.1126/sciadv.adf6692) |
| `cit-000595` | GlycoGlyph | 2023 | Bojar | GlycoDraw: a python implementation for generating high-quality glycan figur… | [open](https://academic.oup.com/glycob/article-abstract/33/11/927/7232175) |
| `cit-000710` | — | 2023 | Bojar | Breast milk oligosaccharides contain immunomodulatory glucuronic acid and L… | [open](https://www.mcponline.org/article/S1535-9476(23)00146-9/fulltext) |
| `cit-000724` | — | 2023 | Gerken | Polypeptide N-acetylgalactosaminyltransferase (GalNAc-T) isozyme surface ch… | [open](https://academic.oup.com/glycob/article-abstract/33/10/817/7239863) |
| `cit-000765` | — | 2023 | Ramaiah | Elucidating the molecular role of MUC5B in progressive lung adenocarcinoma:… | [open](https://onlinelibrary.wiley.com/doi/abs/10.1002/jmr.3064) |
| `cit-000813` | — | 2023 | Yang | Quantitative analysis of fucosylated glycoproteins by immobilized lectin-af… | [open](https://pubs.rsc.org/ra/article-abstract/13/10/6676/823077) |
| `cit-000935` | — | 2023 | Nguyen | Rational design and expedient synthesis of heparan sulfate mimetics from na… | [open](https://onlinelibrary.wiley.com/doi/abs/10.1002/anie.202304325) |
| `cit-000941` | — | 2023 | Nieto | Synthesis and interaction with growth factors of sulfated oligosaccharides … | [open](https://www.sciencedirect.com/science/article/pii/S0045206823005904) |
| `cit-000946` | — | 2023 | — | Synthesis of the Key Saccharide Fragments of the Glucuronic Acid-Containing… | [open](https://www.thieme-connect.com/products/ejournals/html/10.1055/a-2126-0346) |
| `cit-001096` | — | 2023 | Reichardt | A Versatile Urea Type Linker for Functionalizing Natural Glycans and Its Va… | [open](https://chemistry-europe.onlinelibrary.wiley.com/doi/abs/10.1002/chem.202301494) |
| `cit-001119` | Glyco-SPOT | 2023 | Reichardt | A Versatile Urea Type Linker for Functionalizing Natural Glycans and Its Va… | [open](https://chemistry-europe.onlinelibrary.wiley.com/doi/abs/10.1002/chem.202301494) |
| `cit-001523` | — | 2023 | Rullo | Offsetting low-affinity carbohydrate binding with covalency to engage sugar… | [open](https://pmc.ncbi.nlm.nih.gov/articles/PMC10683482/) |
| `cit-000008` | — | 2024 | He | One‐Pot Transformation Strategy of o‐Hydroxyphenyl Propargylamines for Modu… | [open](https://advanced.onlinelibrary.wiley.com/doi/abs/10.1002/adsc.202400893) |
| `cit-000015` | — | 2024 | Shu | Development of an ultrasensitive competitive double-enzyme cascade fluoresc… | [open](https://pmc.ncbi.nlm.nih.gov/articles/PMC11466218/) |
| `cit-000199` | — | 2024 | Ellström | Expression of influenza A virus glycan receptor candidates in mallard, chic… | [open](https://academic.oup.com/glycob/article-abstract/34/3/cwad098/7486526) |
| `cit-000204` | — | 2024 | Runstadler | Examining the Influenza A Virus Sialic Acid Binding Preference Predictions … | [open](https://onlinelibrary.wiley.com/doi/abs/10.1111/irv.70044) |
| `cit-000450` | — | 2024 | Hakansson | Electron capture vs transfer dissociation for site determination of tryptic… | [open](https://pubs.acs.org/jprobs/article/23/7/2386/145853) |
| `cit-000636` | GlycoGlyph | 2024 | — | Towards a Better Understanding of the Influence of Carbohydrates on the Str… | [open](https://onlinelibrary.wiley.com/doi/abs/10.1002/pgr2.70013) |
| `cit-000677` | — | 2024 | — | Defining the mechanism of galectin-3–mediated TGF-β1 activation and its rol… | [open](https://www.jbc.org/article/S0021-9258(24)01801-5/fulltext) |
| `cit-000703` | — | 2024 | Tusnády | UniTmp: unified resources for transmembrane proteins | [open](https://academic.oup.com/nar/article-abstract/52/D1/D572/7327069) |
| `cit-000745` | — | 2024 | S | Studying the O-GlcNAcome of human placentas using banked tissue samples | [open](https://academic.oup.com/glycob/article-abstract/34/4/cwae005/7585290) |
| `cit-000825` | — | 2024 | Perez | CBMcarb-DB: interface of the three-dimensional landscape of carbohydrate-bi… | [open](https://books.rsc.org/books/edited-volume/2205/chapter/8051227) |
| `cit-000922` | MAWE | 2024 | Perez | CBMcarb-DB: interface of the three-dimensional landscape of carbohydrate-bi… | [open](https://books.rsc.org/books/edited-volume/2205/chapter/8051227) |
| `cit-000923` | MAWE | 2024 | Imperiali | Glycan analysis probes inspired by human lectins for investigating host-mic… | [open](https://pmc.ncbi.nlm.nih.gov/articles/PMC11703188/) |
| `cit-001112` | Glyco-SPOT | 2024 | Demchenko | HPLC‐Based Automated Synthesis and Purification of Carbohydrates | [open](https://chemistry-europe.onlinelibrary.wiley.com/doi/abs/10.1002/chem.202401214) |
| `cit-001365` | — | 2024 | Demir | Enantiomeric separation of thiourea derivatives of naringenin on amylose an… | [open](https://onlinelibrary.wiley.com/doi/abs/10.1002/chir.23659) |
| `cit-001501` | — | 2024 | Jia | Plasma ofCS‐modified CD44 predicts the survival of patients with lung cancer | [open](https://onlinelibrary.wiley.com/doi/abs/10.1111/cas.16319) |
| `cit-001533` | — | 2024 | King | Glycan-reactive innate-like B cells and developmental checkpoints | [open](https://academic.oup.com/jimmunol/article-abstract/212/12/1913/7926025) |
| `cit-000010` | — | 2025 | Tata | The discovery of a novel anticoagulant mechanism: factor XI activation inhi… | [open](https://pubs.acs.org/aptsfn/article-abstract/8/9/3090/3761803) |
| `cit-000098` | — | 2025 | González | pH-Responsive Amphiphilic Chitosan–Lignin System Loaded with Samarium Oxide… | [open](https://pubs.acs.org/acsodf/article/10/16/16138/3653708) |
| `cit-000251` | — | 2025 | Gerken | Charge matters: how flanking substrate charge modulates O-glycan Core elong… | [open](https://academic.oup.com/glycob/article-abstract/35/5/cwaf014/8068942) |
| `cit-000407` | — | 2025 | Kulik | CH− π interactions confer orientational flexibility in protein–carbohydrate… | [open](https://www.jbc.org/article/S0021-9258(25)02229-X/fulltext) |
| `cit-000415` | — | 2025 | Struwe | An evolutionary distinct Nipah G glycosylation site provides stability for … | [open](https://www.biorxiv.org/content/10.1101/2025.03.31.646399.abstract) |
| `cit-000457` | — | 2025 | Jones | Searching for Sulfotyrosines (sY) in a HA (pY) STACK | [open](https://pmc.ncbi.nlm.nih.gov/articles/PMC11894665/) |
| `cit-000616` | GlycoGlyph | 2025 | Wozniak-Knopp | Trispecific SEED antibodies engineered for neutrophil-mediated cell killing | [open](https://www.tandfonline.com/doi/abs/10.1080/19420862.2025.2532851) |
| `cit-000640` | GlycoGlyph | 2025 | Bode | Comprehensive synthesis of K48/K63 ubiquitin pentamers by graph-empowered a… | [open](https://chemrxiv.org/doi/abs/10.26434/chemrxiv-2025-943j7) |
| `cit-000688` | — | 2025 | Snijder | A universal spectrum annotator for complex peptidoforms in mass spectrometr… | [open](https://pmc.ncbi.nlm.nih.gov/articles/PMC12573231/) |
| `cit-000701` | — | 2025 | Ma'ayan | GeneSetCart: assembling, augmenting, combining, visualizing, and analyzing … | [open](https://academic.oup.com/gigascience/article-abstract/doi/10.1093/gigascience/giaf025/8110163) |
| `cit-000729` | — | 2025 | Gundry | Integrated multiomics reveals alterations in paucimannose and complex type … | [open](https://www.mcponline.org/article/S1535-9476(25)00027-1/fulltext) |
| `cit-000794` | — | 2025 | Neelamegham | Editor's Choice GlycoEnzDB: a database of enzymes involved in human glycosy… | [open](https://academic.oup.com/glycob/article-abstract/35/12/cwaf074/8315827) |
| `cit-000848` | — | 2025 | — | Implication of N-glycosylation in the maintenance and degeneration of photo… | [open](https://archiv.ub.uni-heidelberg.de/volltextserver/37789/) |
| `cit-000915` | MAWE | 2025 | Imperiali | Tools for investigating host-microbe crosstalk using glycan analysis probes… | [open](https://academic.oup.com/glycob/article-abstract/35/7/cwaf031/8151373) |
| `cit-000933` | — | 2025 | Stellacci | Unraveling the Potential of Small Molecule Heparin Glycomimetics in Neurore… | [open](https://pubs.acs.org/jacsat/article-abstract/147/50/46023/3739264) |
| `cit-001018` | — | 2025 | Lai | Heparinized Dendritic Mesoporous Silica Nanoparticles for the Selective Ads… | [open](https://pmc.ncbi.nlm.nih.gov/articles/PMC12658825/) |
| `cit-001089` | — | 2025 | Cecioni | A trifunctional probe for generation of fluorogenic glycan-photocrosslinker… | [open](https://pubs.rsc.org/cb/article-abstract/6/11/1779/312283) |
| `cit-001114` | Glyco-SPOT | 2025 | McAllister | Efficient synthesis of O-glycosylated amino acids | [open](https://pubs.rsc.org/cb/article-abstract/6/6/851/881650) |
| `cit-001310` | — | 2025 | Tata | The discovery of a novel anticoagulant mechanism: factor XI activation inhi… | [open](https://pubs.acs.org/aptsfn/article-abstract/8/9/3090/3761803) |
| `cit-001505` | — | 2025 | Pinho | N-Glycans as fundamental immune-checkpoints at the frontiers of inflammatio… | [open](https://books.rsc.org/books/edited-volume/2487/chapter/8761831) |
| `cit-000406` | — | 2026 | Struwe | An Evolutionary Distinct Nipah Virus N-Glycosylation Site Provides Stabilit… | [open](https://www.mcponline.org/article/S1535-9476(26)00027-7/fulltext) |
| `cit-000756` | — | 2026 | Moremen | Editor's Choice JAAG: a JSON input file assembler for AlphaFold 3 with glyc… | [open](https://academic.oup.com/glycob/article-abstract/36/1/cwaf083/8373854) |
| `cit-000775` | — | 2026 | Pitteri | Deep Intact Glycoproteomic Analysis Reveals Multi-Level Glycosylation Heter… | [open](https://www.sciencedirect.com/science/article/pii/S1535947626001817) |
| `cit-000783` | — | 2026 | Wu | A Chemoenzymatic Method To Systematically Quantify Core Fucosylation Stoich… | [open](https://pmc.ncbi.nlm.nih.gov/articles/PMC12874205/) |
| `cit-001254` | MAWE | 2026 | Seeberger | Using Synthetic Glycans to Investigate Anti‐Glycan Antibodies and Explore T… | [open](https://onlinelibrary.wiley.com/doi/abs/10.1002/anie.7795967) |
| `cit-000512` | GLAD | — | Aoki-Kinoshita | Worldwide glycoscience informatics infrastructure: the GlySpace Alliance | [open](https://pubs.acs.org/jaaucr/article-abstract/3/1/4/1253251) |
| `cit-000556` | GLAD | — | — | Phenotyping murine and human platelet-derived extracellular vesicles gives … | [open](https://www.rpthjournal.org/cms/10.1016/j.rpth.2026.103414/attachment/5e1ef181-290b-47ad-a0b6-2820746565cf/mmc1.pdf) |

### 2.5 `no-open-copy` — 344 row(s)

No openly accessible copy was found. The publisher's landing page is given so the applicant can check institutional access.

| row_uid | tool | year | senior author | citing title | link |
|---|---|---|---|---|---|
| `cit-001021` | — | 2003 | — | Liposomes useful for drug delivery | [open](https://patents.google.com/patent/US11052079B2/en) |
| `cit-001065` | — | 2005 | Schep | Bakker | [open](https://scholarlypublications.universiteitleiden.nl/access/item%3A4282475/download) |
| `cit-000138` | — | 2009 | Bell | Future Medicinal Chemistry | [open](https://www.researchgate.net/profile/Marta-Correia-Da-Silva/publication/310424258_Structure-activity_relationship_studies_for_multitarget_antithrombotic_drugs/links/5c44de49299bf12be3d79095/Structure-Activity-Relationship-Studies-for-Multitarget-Antithrombotic-Drugs.pdf) |
| `cit-001450` | — | 2009 | Bell | Future Medicinal Chemistry | [open](https://www.researchgate.net/profile/Marta-Correia-Da-Silva/publication/310424258_Structure-activity_relationship_studies_for_multitarget_antithrombotic_drugs/links/5c44de49299bf12be3d79095/Structure-Activity-Relationship-Studies-for-Multitarget-Antithrombotic-Drugs.pdf) |
| `cit-001025` | — | 2011 | — | Designing allosteric inhibitors of thrombin | [open](https://search.proquest.com/openview/55a43d6ac653666f0a46d2643d2e8768/1?pq-origsite=gscholar&cbl=18750) |
| `cit-001200` | — | 2011 | Mosberg | Conformationally restricted analogs of the direct thrombin inhibitor FM 19 | [open](https://www.sciencedirect.com/science/article/pii/S0968089611008546) |
| `cit-001023` | — | 2012 | Verhamme | Fluorescent reporters of thrombin, heparin cofactor II, and heparin binding… | [open](https://www.sciencedirect.com/science/article/pii/S0003269711007536) |
| `cit-001147` | — | 2012 | Alander | Indexed bibliography of genetic algorithms in medicine | [open](https://www.researchgate.net/profile/Jarmo-Alander/publication/266473369_An_Indexed_Bibliography_of_Genetic_Algorithms_in_Medicine_compiled_by/links/54d27b810cf25017917e517b/An-Indexed-Bibliography-of-Genetic-Algorithms-in-Medicine-compiled-by.pdf) |
| `cit-001225` | — | 2012 | — | Design, synthesis, and biological evaluation of novel MCAK and 14-3-3 prote… | [open](https://search.proquest.com/openview/626099758e4991c2edd32359acff072a/1?pq-origsite=gscholar&cbl=18750) |
| `cit-000380` | — | 2013 | — | In-silico drug design approach to discover novel anti-coagulants | [open](https://scholar.archive.org/work/bwxyho4sf5bddevjoax57rcehq/access/wayback/http://www.postdocjournal.com/file_journal/655_58122119.pdf) |
| `cit-001171` | — | 2013 | — | Ligand binding to anion-binding exosites regulates conformational propertie… | [open](https://www.jbc.org/article/S0021-9258(19)33516-1/fulltext) |
| `cit-001175` | — | 2013 | Marinelli | Palladium-Catalyzed Cascade Reactions of 1‑(3-Arylprop-2-ynyloxy)-2-bromo B… | [open](https://pubs.acs.org/joceah/article-abstract/78/9/4490/1339822) |
| `cit-001181` | — | 2013 | Groutas | Potent inhibition of norovirus by dipeptidyl α-hydroxyphosphonate transitio… | [open](https://www.sciencedirect.com/science/article/pii/S0960894X13010135) |
| `cit-001187` | — | 2013 | Marinelli | Multisubstituted benzo [b] furans through a copper-and/or palladium-catalyz… | [open](https://www.sciencedirect.com/science/article/pii/S004040201201914X) |
| `cit-001220` | — | 2013 | — | In-silico drug design approach to discover novel anti-coagulants | [open](https://scholar.archive.org/work/bwxyho4sf5bddevjoax57rcehq/access/wayback/http://www.postdocjournal.com/file_journal/655_58122119.pdf) |
| `cit-001227` | — | 2013 | — | Interazioni tra acidi nucleici, proteine e potenziali farmaci antitumorali:… | [open](https://tesidottorato.depositolegale.it/handle/20.500.14242/338305) |
| `cit-001386` | — | 2013 | Sankar | Newer Oral Anticoagulants | [open](https://link.springer.com/chapter/10.1007/978-1-4614-9560-4_16) |
| `cit-000019` | — | 2014 | — | Phenylimidazoles as potent and selective inhibitors of coagulation factor X… | [open](https://pubs.acs.org/doi/abs/10.1021/jm5010607) |
| `cit-000148` | — | 2014 | Mukherjee | A new peptide (Ruviprase) purified from the venom of Daboia russelii russel… | [open](https://www.sciencedirect.com/science/article/pii/S0300908414001849) |
| `cit-000157` | — | 2014 | Huang | Graphene oxide modified with aptamer-conjugated gold nanoparticles and hepa… | [open](https://pubs.rsc.org/bm/article-abstract/2/10/1332/425767) |
| `cit-000359` | — | 2014 | — | Polyglycine hydrolases secreted by Pleosporineae fungi that target the link… | [open](https://portlandpress.com/biochemj/article-abstract/460/2/187/46671) |
| `cit-000378` | — | 2014 | — | Studies on rationally designed, allosteric, coagulation inhibitors | [open](https://search.proquest.com/openview/1e39143b98382b38c71074a9313f8722/1?pq-origsite=gscholar&cbl=18750) |
| `cit-001013` | — | 2014 | Zalevsky | Raman spectroscopy of disulfide bridges in thrombin | [open](https://journals.sagepub.com/doi/abs/10.3233/BSI-140081) |
| `cit-001135` | — | 2014 | Li | Discovery of glycyrrhetinic acid as an orally active, direct inhibitor of b… | [open](https://www.sciencedirect.com/science/article/pii/S0049384813006117) |
| `cit-001217` | — | 2014 | — | Studies on rationally designed, allosteric, coagulation inhibitors | [open](https://search.proquest.com/openview/1e39143b98382b38c71074a9313f8722/1?pq-origsite=gscholar&cbl=18750) |
| `cit-001338` | — | 2014 | Quan | Phenylimidazoles as potent and selective inhibitors of coagulation factor X… | [open](https://pubs.acs.org/doi/abs/10.1021/jm5010607) |
| `cit-001384` | — | 2014 | — | Studies on rationally designed, allosteric, coagulation inhibitors | [open](https://search.proquest.com/openview/1e39143b98382b38c71074a9313f8722/1?pq-origsite=gscholar&cbl=18750) |
| `cit-000013` | — | 2015 | — | One-pot synthesis of 2,3-disubstituted dihydrobenzofurans and benzofurans v… | [open](https://pubs.rsc.org/cc/article-abstract/51/31/6862/466693) |
| `cit-000334` | — | 2015 | Finberg | Heparin octasaccharide decoy liposomes inhibit replication of multiple viru… | [open](https://www.sciencedirect.com/science/article/pii/S0166354215000091) |
| `cit-001146` | — | 2015 | Ma | Advances in inhibitors of FXa | [open](https://www.ingentaconnect.com/content/ben/cdt/2015/00000016/00000011/art00009) |
| `cit-001164` | — | 2015 | Groutas | Structure-Guided Design and Optimization of Dipeptidyl Inhibitors of Norovi… | [open](https://pubs.acs.org/jmcmar/article-abstract/58/7/3144/1300753) |
| `cit-001230` | — | 2015 | Chang | Potent inhibition of enterovirus D68 and human rhinoviruses by dipeptidyl a… | — |
| `cit-001290` | — | 2015 | Zhao | Discovery of an intrinsic tenase complex inhibitor: Pure nonasaccharide fro… | [open](https://www.pnas.org/doi/abs/10.1073/pnas.1504229112) |
| `cit-001373` | — | 2015 | Schmaier | Medically-induced hemophilia C to treat thrombosis | [open](https://www.thrombosisresearch.com/article/S0049-3848(15)00240-6/abstract) |
| `cit-001475` | MAWE | 2015 | Glazowska | An Accessible R-Based Exploratory Toolbox to Analyse Plant Glycomic Microar… | [open](https://papers.ssrn.com/sol3/papers.cfm?abstract_id=4359639) |
| `cit-000034` | — | 2016 | — | Microwave Assisted Intramolecular Dehydrogenative Dehydro-Diels Alder Appro… | [open](https://d-scholarship.pitt.edu/concern/etds/669352a6-e36a-4aa5-8d89-9f480b34ec1d) |
| `cit-000035` | — | 2016 | Stephen | Probing allosteric, partial inhibition of thrombin using novel anticoagulan… | [open](https://search.proquest.com/openview/197f86fac0d2accd9f82fc809da0fdaa/1?pq-origsite=gscholar&cbl=18750&diss=y) |
| `cit-000039` | — | 2016 | Smallheer | Advances in Anticoagulants | — |
| `cit-000041` | — | 2016 | — | Rh-Catalyzed Five-Membered Heterocycle Synthesis | [open](https://www.worldscientific.com/doi/abs/10.1142/9781783269242_0003) |
| `cit-000062` | — | 2016 | De Filippis | Molecular mapping of α-thrombin (αT)/β2-glycoprotein I (β2GpI) interaction … | [open](https://portlandpress.com/biochemj/article-abstract/473/24/4629/49339) |
| `cit-000072` | — | 2016 | Konermann | Evidence of allosteric enzyme regulation via changes in conformational dyna… | [open](https://pubs.acs.org/doi/abs/10.1021/acs.biochem.6b00764) |
| `cit-000141` | — | 2016 | Stephen | Probing allosteric, partial inhibition of thrombin using novel anticoagulan… | [open](https://search.proquest.com/openview/197f86fac0d2accd9f82fc809da0fdaa/1?pq-origsite=gscholar&cbl=18750&diss=y) |
| `cit-000158` | — | 2016 | Cai | Rapid magnetic solid-phase extraction combined with ultra-high performance … | [open](https://pubs.rsc.org/ra/article-abstract/6/41/34782/535194) |
| `cit-000306` | — | 2016 | Mooibroek | π-hole interactions involving nitro compounds: directionality of nitrate es… | [open](https://pubs.acs.org/doi/abs/10.1021/acs.cgd.6b00989) |
| `cit-000311` | — | 2016 | Li | Application of nanodiamonds in Cu(ii)-based rhodamine B probes for NO detec… | [open](https://pubs.rsc.org/tb/article-abstract/4/19/3358/550296) |
| `cit-000363` | — | 2016 | — | A glassy carbon electrode modified with in-situ generated chromium-loaded C… | [open](https://link.springer.com/article/10.1007/s00604-015-1611-8) |
| `cit-000376` | — | 2016 | — | Probing allosteric, partial inhibition of thrombin using novel anticoagulan… | [open](https://search.proquest.com/openview/197f86fac0d2accd9f82fc809da0fdaa/1?pq-origsite=gscholar&cbl=18750&diss=y) |
| `cit-001153` | — | 2016 | Natalie | Development of chemical probes for non-BET bromodomains | [open](https://stax.strath.ac.uk/concern/theses/m900nt91x) |
| `cit-001169` | — | 2016 | Chang | Potent inhibition of enterovirus D68 and human rhinoviruses by dipeptidyl a… | [open](https://www.sciencedirect.com/science/article/pii/S0166354215300322) |
| `cit-001191` | — | 2016 | Ayres | Blood compatibility of heparin-inspired, lactose containing, polyureas depe… | [open](https://pubs.rsc.org/py/article-abstract/7/23/3897/532089) |
| `cit-001213` | — | 2016 | — | Probing allosteric, partial inhibition of thrombin using novel anticoagulan… | [open](https://search.proquest.com/openview/197f86fac0d2accd9f82fc809da0fdaa/1?pq-origsite=gscholar&cbl=18750&diss=y) |
| `cit-001366` | — | 2016 | Li | Efforts to total synthesis of philinopside E: convergent synthesis of the s… | [open](https://pubs.rsc.org/ra/article-abstract/6/7/5442/501613) |
| `cit-001383` | — | 2016 | — | Probing allosteric, partial inhibition of thrombin using novel anticoagulan… | [open](https://search.proquest.com/openview/197f86fac0d2accd9f82fc809da0fdaa/1?pq-origsite=gscholar&cbl=18750&diss=y) |
| `cit-001391` | — | 2016 | — | Advances in Anticoagulants | — |
| `cit-001454` | — | 2016 | — | Probing allosteric, partial inhibition of thrombin using novel anticoagulan… | [open](https://search.proquest.com/openview/197f86fac0d2accd9f82fc809da0fdaa/1?pq-origsite=gscholar&cbl=18750&diss=y) |
| `cit-000033` | — | 2017 | — | Study of Molecular Interactions of Glycosaminoglycans and Glycosaminoglycan… | [open](https://scholarscompass.vcu.edu/etd/4968/) |
| `cit-000110` | — | 2017 | Weitz | Exosite 2-directed ligands attenuate protein C activation by the thrombin–t… | [open](https://pubs.acs.org/doi/abs/10.1021/acs.biochem.7b00250) |
| `cit-000128` | — | 2017 | Maurer | Deciphering conformational changes associated with the maturation of thromb… | [open](https://pmc.ncbi.nlm.nih.gov/articles/PMC6076386/) |
| `cit-000140` | — | 2017 | Daniel | Study of Molecular Interactions of Glycosaminoglycans and Glycosaminoglycan… | [open](https://scholarscompass.vcu.edu/etd/4968/) |
| `cit-000156` | — | 2017 | Hangauer | Modulating hydrogen-bond basicity within the context of protein-ligand bind… | [open](https://www.sciencedirect.com/science/article/pii/S0223523416307681) |
| `cit-000168` | — | 2017 | Elsamani | Investigation of Anticoagulation Properties of Sulfated Glycosaminoglycan M… | [open](https://scholarscompass.vcu.edu/etd/5054/) |
| `cit-000169` | — | 2017 | Othman | Identification of extracellular matrix-based targets for the prevention of … | [open](https://research-repository.rmit.edu.au/ndownloader/files/50760633) |
| `cit-000229` | — | 2017 | Boons | Heparan sulfate microarray reveals that heparan sulfate–protein binding exh… | [open](https://pmc.ncbi.nlm.nih.gov/articles/PMC5588662/) |
| `cit-000375` | — | 2017 | — | Study of Molecular Interactions of Glycosaminoglycans and Glycosaminoglycan… | [open](https://scholarscompass.vcu.edu/etd/4968/) |
| `cit-001007` | — | 2017 | Kruzhilin | Raman study of the cleavage of disulphide bonds in albumin, chymotrypsin, a… | [open](https://www.sciencedirect.com/science/article/pii/S0924203116301448) |
| `cit-001009` | — | 2017 | He | Highly sensitive chemiluminescence biosensor for protein detection based on… | [open](https://www.sciencedirect.com/science/article/pii/S0956566316308235) |
| `cit-001031` | — | 2017 | — | Identification of extracellular matrix-based targets for the prevention of … | [open](https://research-repository.rmit.edu.au/ndownloader/files/50760633) |
| `cit-001198` | — | 2017 | Maurer | Deciphering conformational changes associated with the maturation of thromb… | [open](https://pmc.ncbi.nlm.nih.gov/articles/PMC6076386/) |
| `cit-001212` | — | 2017 | — | Study of Molecular Interactions of Glycosaminoglycans and Glycosaminoglycan… | [open](https://scholarscompass.vcu.edu/etd/4968/) |
| `cit-001381` | — | 2017 | — | Study of Molecular Interactions of Glycosaminoglycans and Glycosaminoglycan… | [open](https://scholarscompass.vcu.edu/etd/4968/) |
| `cit-001436` | — | 2017 | Weitz | Exosite 2-directed ligands attenuate protein C activation by the thrombin–t… | [open](https://pubs.acs.org/doi/abs/10.1021/acs.biochem.7b00250) |
| `cit-001445` | — | 2017 | Maurer | Deciphering conformational changes associated with the maturation of thromb… | [open](https://pmc.ncbi.nlm.nih.gov/articles/PMC6076386/) |
| `cit-001452` | — | 2017 | Mouapi | Characterizing reactive glutamines in fibrinogen and elucidating factor XII… | [open](https://ir.library.louisville.edu/etd/2770/) |
| `cit-001453` | — | 2017 | Daniel | Study of Molecular Interactions of Glycosaminoglycans and Glycosaminoglycan… | [open](https://scholarscompass.vcu.edu/etd/4968/) |
| `cit-000136` | — | 2018 | Shin | Lignin as Bio-industrial Materials: Focused on Cosmetic Ingredients | [open](https://www.academia.edu/download/80691983/18011.pdf) |
| `cit-000150` | — | 2018 | Huang | Self-assembled, bivalent aptamers on graphene oxide as an efficient anticoa… | [open](https://pubs.rsc.org/bm/article-abstract/6/7/1882/592699) |
| `cit-000154` | — | 2018 | Yadav | Advances in the development of novel factor Xa inhibitors: a patent review | [open](https://www.benthamdirect.com/content/journals/mrmc/10.2174/1389557518666180424120726) |
| `cit-000241` | — | 2018 | Nieto | Fluorous-tag assisted synthesis of a glycosaminoglycan mimetic tetrasacchar… | [open](https://www.sciencedirect.com/science/article/pii/S0968089617324434) |
| `cit-001311` | — | 2018 | Zhao | Precise structures of fucosylated glycosaminoglycan and its oligosaccharide… | [open](https://www.sciencedirect.com/science/article/pii/S0223523418301776) |
| `cit-001336` | — | 2018 | Zhao | Modulating the degree of fucosylation of fucosylated chondroitin sulfate en… | [open](https://www.sciencedirect.com/science/article/pii/S0223523418304288) |
| `cit-001369` | — | 2018 | — | Identifying new clotting factor XIa inhibitors in virtual high‐throughput s… | [open](https://aiche.onlinelibrary.wiley.com/doi/abs/10.1002/btpr.2693) |
| `cit-001382` | — | 2018 | — | ATVB Named Lecture Review | [open](https://www.academia.edu/download/93444176/ATVBAHA.117.pdf) |
| `cit-001437` | — | 2018 | Dou | Evaluating prodrug characteristics of a novel anticoagulant fusion protein … | [open](https://www.sciencedirect.com/science/article/pii/S0928098718302501) |
| `cit-000054` | — | 2019 | Zhang | Characteristics of allosteric proteins, sites, and modulators | [open](https://link.springer.com/chapter/10.1007/978-981-13-8719-7_6) |
| `cit-000059` | — | 2019 | Sousa | Mechanistic insights into ultrasmall gold nanoparticle–protein interactions… | [open](https://pubs.acs.org/doi/abs/10.1021/acs.jpcc.9b08308) |
| `cit-000084` | — | 2019 | Shravan | Glycosaminoglycan Mimetics for the Treatment of Cancer and Lung Inflammation | [open](https://scholarscompass.vcu.edu/etd/5948/) |
| `cit-000122` | — | 2019 | Maurer | Thrombin Exosite Maturation and Ligand Binding at ABE II Help Stabilize PAR… | [open](https://pmc.ncbi.nlm.nih.gov/articles/PMC6716794/) |
| `cit-000354` | — | 2019 | Liu | De novo synthesis of benzofurans via trifluoroacetic acid catalyzed cycliza… | [open](https://pubs.rsc.org/ob/article-abstract/17/32/7547/654942) |
| `cit-001014` | — | 2019 | Crowley | Crystal structure of a protein–aromatic foldamer composite: macromolecular … | [open](https://pubs.rsc.org/cc/article-abstract/55/74/11087/635232) |
| `cit-001128` | — | 2019 | Hailes | Acceptance and kinetic resolution of α-methyl-substituted aldehydes by norc… | [open](https://pubs.acs.org/doi/abs/10.1021/acscatal.9b02699) |
| `cit-001149` | — | 2019 | — | Design and synthesis of novel 3, 4-diaminobenzoyl derivatives as antithromb… | [open](https://link.springer.com/article/10.1007/s11696-018-0645-x) |
| `cit-001189` | — | 2019 | Liu | De novo synthesis of benzofurans via trifluoroacetic acid catalyzed cycliza… | [open](https://pubs.rsc.org/ob/article-abstract/17/32/7547/654942) |
| `cit-001195` | — | 2019 | Maurer | Thrombin Exosite Maturation and Ligand Binding at ABE II Help Stabilize PAR… | [open](https://pmc.ncbi.nlm.nih.gov/articles/PMC6716794/) |
| `cit-001204` | — | 2019 | Karale | Synthesis, characterization and antibacterial screening of fluorinated benz… | [open](https://www.academia.edu/download/101958191/IJCB_2058B4_20504-510.pdf) |
| `cit-001296` | — | 2019 | Chan | Advances in antithrombotic therapy | [open](https://www.ahajournals.org/doi/abs/10.1161/ATVBAHA.118.310960) |
| `cit-001315` | — | 2019 | Zhao | Precise structures and anti-intrinsic tenase complex activity of three fuco… | [open](https://www.sciencedirect.com/science/article/pii/S0144861719308136) |
| `cit-001443` | — | 2019 | Maurer | Thrombin Exosite Maturation and Ligand Binding at ABE II Help Stabilize PAR… | [open](https://pmc.ncbi.nlm.nih.gov/articles/PMC6716794/) |
| `cit-000025` | — | 2020 | Lam | Orally bioavailable amine-linked macrocyclic inhibitors of factor XIa | [open](https://www.sciencedirect.com/science/article/pii/S0960894X20300020) |
| `cit-000056` | — | 2020 | Jiang | Thermodynamics, kinetics and mechanisms of noncompetitive allosteric inhibi… | [open](https://pubs.acs.org/doi/abs/10.1021/acs.langmuir.0c00699) |
| `cit-000069` | — | 2020 | Sousa | Regulation of thrombin activity with ultrasmall nanoparticles: effects of s… | [open](https://pubs.acs.org/doi/abs/10.1021/acs.langmuir.0c01352) |
| `cit-000083` | — | 2020 | Enrique | Computational strategies for selective inhibition of falcipain-2 | [open](https://repositorio.unesp.br/entities/publication/99c36cae-b47d-46f6-9d17-ed406144cb47) |
| `cit-000087` | — | 2020 | Ganzera | Phytochemical and Analytical Characterization of | — |
| `cit-000089` | — | 2020 | Varma | Greener synthesis of lignin nanoparticles and their applications | [open](https://pubs.rsc.org/gc/article-abstract/22/3/612/646654) |
| `cit-000094` | — | 2020 | Spiridon | Extraction of lignin and therapeutic applications of lignin-derived compoun… | [open](https://link.springer.com/article/10.1007/s10311-020-00981-3) |
| `cit-000111` | — | 2020 | Iravani | Biomedical applications of lignin-based nanoparticles | [open](https://link.springer.com/chapter/10.1007/978-981-15-0391-7_8) |
| `cit-000117` | — | 2020 | Jõudu | Applications of lignin in the agri-food industry | [open](https://link.springer.com/chapter/10.1007/978-3-030-40663-9_10) |
| `cit-000153` | — | 2020 | Marcussi | Enzymatic Modulators from Induratia spp. AP da Silva Pomposo Bastos et al. | [open](https://link.springer.com/article/10.1007/s00284-020-02170-5) |
| `cit-000165` | — | 2020 | Marcussi | Enzymatic Modulators from Induratia spp. | [open](https://search.proquest.com/openview/a8b867ffe835d28cc431527ef630bd1b/1?pq-origsite=gscholar&cbl=54062) |
| `cit-000226` | — | 2020 | Powell | Influenza A Virus Fitness Is Linked with Antigenic Changes in the Hemagglut… | [open](https://search.proquest.com/openview/f5d01cc9288fe71db2854ad9f1ba85c5/1?pq-origsite=gscholar&cbl=44156) |
| `cit-000240` | — | 2020 | Kikkeri | Continuous-flow accelerated sulfation of heparan sulfate intermediates | [open](https://pubs.acs.org/doi/abs/10.1021/acs.orglett.0c00878) |
| `cit-000309` | — | 2020 | Mooibroek | π-Hole interactions with various nitro compounds relevant for medicine: DFT… | [open](https://www.thieme-connect.com/products/ejournals/html/10.1055/s-0039-1690209) |
| `cit-000373` | — | 2020 | — | CHARACTERIZING GLYCOSAMINOGLYCAN AND GLYCOSAMINOGLYCAN-OLIGO INTERACTIONS W… | [open](https://scholarscompass.vcu.edu/etd/6185/) |
| `cit-000524` | GLAD | 2020 | Imberty | Structural database for lectins and the UniLectin web platform | [open](https://link.springer.com/protocol/10.1007/978-1-0716-0430-4_1) |
| `cit-000546` | GLAD | 2020 | — | Decoding glycans: deciphering the sugary secrets to be coherent on the impl… | [open](https://pubs.rsc.org/ra/article-abstract/10/56/34099/702166) |
| `cit-000547` | GLAD | 2020 | Aruleba | Visual data mining: A comparative analysis of selected datasets | [open](https://link.springer.com/chapter/10.1007/978-3-030-71187-0_35) |
| `cit-000897` | — | 2020 | — | Reducing Theory to Practice: Designing Training Modules and Bco Tools for A… | [open](https://search.proquest.com/openview/b2c6fc62d67a193f57060a4151f22645/1?pq-origsite=gscholar&cbl=18750&diss=y) |
| `cit-000926` | MAWE | 2020 | Haab | Automated identification of lectin fine specificities from glycan-array data | [open](https://pubs.acs.org/doi/abs/10.1021/bk-2019-1346.ch005) |
| `cit-001015` | — | 2020 | Li | A fluorometric assay of thrombin using magnetic nanoparticles and enzyme-fr… | [open](https://link.springer.com/article/10.1007/s00604-020-04279-7) |
| `cit-001140` | — | 2020 | Chu | Facile Preparation of 4-(4-Nitrophenyl) morpholin-3-one via the Acid-Cataly… | [open](https://pubs.acs.org/doi/abs/10.1021/acs.oprd.0c00299) |
| `cit-001148` | — | 2020 | Mohammadi-Khanaposhtani | Molecular docking, linear and nonlinear QSAR studies on factor Xa inhibitors | [open](https://link.springer.com/article/10.1007/s11224-020-01535-7) |
| `cit-001178` | — | 2020 | Gupta | Allosteric inhibition and kinetic characterization of Klebsiella pneumoniae… | [open](https://www.sciencedirect.com/science/article/pii/S0141813019365778) |
| `cit-001368` | — | 2020 | Lam | Orally bioavailable amine-linked macrocyclic inhibitors of factor XIa | [open](https://www.sciencedirect.com/science/article/pii/S0960894X20300020) |
| `cit-001375` | — | 2020 | — | CHARACTERIZING GLYCOSAMINOGLYCAN AND GLYCOSAMINOGLYCAN-OLIGO INTERACTIONS W… | [open](https://scholarscompass.vcu.edu/etd/6185/) |
| `cit-000036` | — | 2021 | Bots | Anticoagulants | [open](https://onlinelibrary.wiley.com/doi/abs/10.1002/0471266949.bmc182.pub2) |
| `cit-000061` | — | 2021 | Shikhaliev | Synthesis and study of new 2H-pyranoquinolin-2-one-based inhibitors of bloo… | [open](https://link.springer.com/article/10.1007/s11172-021-3114-6) |
| `cit-000099` | — | 2021 | Dinda | Natural excipients in pharmaceutical formulations | [open](https://link.springer.com/chapter/10.1007/978-981-15-8127-4_40) |
| `cit-000105` | — | 2021 | Schulze | Types of lignin, properties, and structural characterization techniques | [open](https://www.sciencedirect.com/science/chapter/edited-volume/pii/B9780128203033000011) |
| `cit-000124` | — | 2021 | Fatehi | Present and future prospective of lignin-based materials in biomedical fiel… | [open](https://www.sciencedirect.com/science/chapter/edited-volume/pii/B9780128203033000072) |
| `cit-000131` | — | 2021 | Mishra | Electrospinning of Lignin Nanofibers for Drug Delivery | [open](https://link.springer.com/chapter/10.1007/978-3-030-79979-3_7) |
| `cit-000133` | — | 2021 | Zhang | Structural basis of different surface-modified fullerene derivatives as nov… | [open](https://www.tandfonline.com/doi/abs/10.1080/00268976.2021.1943028) |
| `cit-000137` | — | 2021 | Dinda | Natural Excipients in Pharmaceutical | [open](https://www.researchgate.net/profile/Subas-Dinda/publication/358733642_Natural_Excipients-SCDpdf/data/6211ac374be28e145ca3acaf/Natural-Excipients-SCD.pdf) |
| `cit-000190` | — | 2021 | Wolff | Evaluation of multivalent sialylated polyglycerols for resistance induction… | [open](https://pubs.acs.org/doi/abs/10.1021/acs.jmedchem.1c00794) |
| `cit-000196` | — | 2021 | Pekosz | Changes in sialic acid binding associated with egg adaptation decrease live… | [open](https://www.sciencedirect.com/science/article/pii/S0264410X21005351) |
| `cit-000214` | — | 2021 | Scull | Membrane-Tethered Mucin 1 is stimulated by interferon in multiple cell type… | [open](https://www.biorxiv.org/content/10.1101/2021.03.11.434997.abstract) |
| `cit-000235` | — | 2021 | Kikkeri | Rational designing of glyco-nanovehicles to target cellular heterogeneity | [open](https://pubs.rsc.org/sc/article-abstract/12/11/4021/745774) |
| `cit-000365` | — | 2021 | — | Competition between the Hiyama and Suzuki–Miyaura Pd-catalyzed cross-coupli… | [open](https://www.sciencedirect.com/science/article/pii/S016773222037416X) |
| `cit-000396` | — | 2021 | Bojar | LectinOracle: a generalizable deep learning model for lectin–glycan binding… | [open](https://advanced.onlinelibrary.wiley.com/doi/abs/10.1002/advs.202103807) |
| `cit-000561` | GLAD | 2021 | Willats | Carbohydrate Microarray Technology | [open](https://link.springer.com/chapter/10.1007/978-3-030-77791-3_10) |
| `cit-000620` | GlycoGlyph | 2021 | Toukach | CSDB/SNFG structure editor: An online glycan builder with 2D and 3D structu… | [open](https://pubs.acs.org/doi/abs/10.1021/acs.jcim.1c00917) |
| `cit-000747` | — | 2021 | Young | Modernized uniform representation of carbohydrate molecules in the Protein … | [open](https://academic.oup.com/glycob/article-abstract/31/9/1204/6272446) |
| `cit-000748` | — | 2021 | Varki | Evolutionary conservation of human ketodeoxynonulosonic acid production is … | [open](https://www.jci.org/articles/view/137681) |
| `cit-000815` | — | 2021 | Lisacek | Glycan compositions with Glyconnect Compozitor to enhance glycopeptide iden… | [open](https://link.springer.com/protocol/10.1007/978-1-0716-1641-3_7) |
| `cit-000834` | — | 2021 | — | Sampling and sample preparation in bioanalysis | [open](https://link.springer.com/chapter/10.1007/978-3-030-82381-8_3) |
| `cit-000837` | — | 2021 | — | Bioinformatics study of lectins: new classification and prediction in genom… | [open](https://theses.hal.science/tel-03331649/) |
| `cit-000859` | — | 2021 | Kannan | GTXplorer: A portal to navigate and visualize the evolutionary information … | [open](https://academic.oup.com/glycob/article-abstract/31/11/1472/6330892) |
| `cit-000882` | — | 2021 | de Haan | Bioinformatics in Immunoglobulin Glycosylation Analysis | [open](https://link.springer.com/chapter/10.1007/978-3-030-76912-3_6) |
| `cit-000916` | MAWE | 2021 | Haab | Combined analysis of multiple glycan-array datasets: new explorations of pr… | [open](https://pmc.ncbi.nlm.nih.gov/articles/PMC8862541/) |
| `cit-000925` | MAWE | 2021 | Bonnardel | Bioinformatics study of lectins: new classification and prediction in genom… | [open](https://theses.hal.science/tel-03331649/) |
| `cit-000929` | MAWE | 2021 | Willats | Carbohydrate Microarray Technology | [open](https://link.springer.com/chapter/10.1007/978-3-030-77791-3_10) |
| `cit-001087` | — | 2021 | Yu | Sulfo-Fluorous Tagging Strategy for Site-Selective Enzymatic Glycosylation … | [open](https://pubs.acs.org/doi/abs/10.1021/acscatal.0c04934) |
| `cit-001099` | — | 2021 | Casadevall | Polysaccharides of Fungal Origin: Focus on the Capsule of the Pathogen Cryp… | [open](https://link.springer.com/content/pdf/10.1007/978-3-030-35734-4_29-1.pdf) |
| `cit-001100` | — | 2021 | Brichacek | Development of a multifunctional neoglycoside auxiliary for applications in… | [open](https://pubs.rsc.org/ob/article-abstract/19/30/6613/738188) |
| `cit-001284` | — | 2021 | Raffán-Sanabria | Factor XI deficiency | [open](https://www.sciencedirect.com/science/article/pii/S0889858821000915) |
| `cit-001309` | — | 2021 | Zhao | Five distinct fucan sulfates from sea cucumber Pattalus mollis: Purificatio… | [open](https://www.sciencedirect.com/science/article/pii/S0141813021014847) |
| `cit-001360` | — | 2021 | Napolitano | Sulfated Oligomers of Tyrosol: Toward a New Class of Bioinspired Nonsacchar… | [open](https://pmc.ncbi.nlm.nih.gov/articles/PMC8023584/) |
| `cit-001444` | — | 2021 | Fatehi | Present and future prospective of lignin-based materials in biomedical fiel… | [open](https://www.sciencedirect.com/science/chapter/edited-volume/pii/B9780128203033000072) |
| `cit-001470` | MAWE | 2021 | Packer | GlycoBioinformatics | [open](https://www.beilstein-journals.org/bjoc/articles/17/184) |
| `cit-001549` | — | 2021 | Kato | Identification of genes for variable regions of immunoglobulins that recogn… | [open](https://www.sciencedirect.com/science/article/pii/S0006291X21009608) |
| `cit-000009` | — | 2022 | Boxnick | First randomized evaluation of safety, pharmacodynamics, and pharmacokineti… | [open](https://onlinelibrary.wiley.com/doi/abs/10.1111/jth.15744) |
| `cit-000057` | — | 2022 | — | Quantitative proteomics analysis reveals core and variable tick salivary pr… | [open](https://onlinelibrary.wiley.com/doi/abs/10.1111/mec.16561) |
| `cit-000118` | — | 2022 | Neal | Effect of irrigation fluid composition on hemostasis in mouse bleeding mode… | [open](https://pmc.ncbi.nlm.nih.gov/articles/PMC9789188/) |
| `cit-000194` | — | 2022 | Scull | Membrane-tethered mucin 1 is stimulated by interferon and virus infection i… | [open](https://journals.asm.org/doi/abs/10.1128/mbio.01055-22) |
| `cit-000236` | — | 2022 | Kikkeri | Sulfation of Heparan and Chondroitin Sulfate Ligands Enables Cell‐Specific … | [open](https://chemistry-europe.onlinelibrary.wiley.com/doi/abs/10.1002/chem.202202622) |
| `cit-000368` | — | 2022 | Gong | Dual‐target synergistic antithrombotic mechanism of a dabigatran etexilate … | [open](https://onlinelibrary.wiley.com/doi/abs/10.1111/1440-1681.13634) |
| `cit-000372` | — | 2022 | — | The Chemical Biology of Thrombin | [open](https://books.google.com/books?hl=en&lr=&id=_GRnEAAAQBAJ&oi=fnd&pg=PT8&ots=KV1Rbi0HcG&sig=71WQUcF7LyZgZENk92o7-hfBDAU) |
| `cit-000451` | — | 2022 | Alharbi | Comprehensive computational analysis reveals YXXΦ [I/L/M/F/V] motif and YXX… | [open](https://www.frontiersin.org/journals/immunology/articles/10.3389/fimmu.2022.1031608/full) |
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
| `cit-001028` | — | 2022 | — | The Chemical Biology of Thrombin | [open](https://books.google.com/books?hl=en&lr=&id=_GRnEAAAQBAJ&oi=fnd&pg=PT8&ots=KV1Rah7PbG&sig=U-Nhn8jYNMOGpUcL3HwLMjEgmy8) |
| `cit-001097` | — | 2022 | Song | Regeneration of free reducing glycans from reductive amination-tagged glyca… | [open](https://pmc.ncbi.nlm.nih.gov/articles/PMC9228866/) |
| `cit-001101` | — | 2022 | Patrick | Chemical biology tools for the study of health and disease | [open](https://search.proquest.com/openview/b39437642deecacbc426f5b8cd8fb798/1?pq-origsite=gscholar&cbl=18750&diss=y) |
| `cit-001111` | Glyco-SPOT | 2022 | Li | Integrated chemoenzymatic approach to streamline the assembly of complex gl… | [open](https://pmc.ncbi.nlm.nih.gov/articles/PMC9590255/) |
| `cit-001118` | Glyco-SPOT | 2022 | Loeffler | VaporSPOT: Parallel synthesis of oligosaccharides on membranes | [open](https://pubs.acs.org/jacsat/article-abstract/144/43/19832/458100) |
| `cit-001134` | — | 2022 | Dashkin | Review on synthetic approaches toward rivaroxaban (Xarelto), an anticoagula… | [open](https://pubs.acs.org/doi/abs/10.1021/acs.oprd.2c00188) |
| `cit-001143` | — | 2022 | Yadav | Design, synthesis and biological evaluation of Piperazinylanthranilamides a… | [open](https://www.sciencedirect.com/science/article/pii/S002228602201626X) |
| `cit-001449` | — | 2022 | Lundblad | The Chemical Biology of Thrombin | [open](https://books.google.com/books?hl=en&lr=&id=_GRnEAAAQBAJ&oi=fnd&pg=PT8&ots=KV1Rbg7HbF&sig=OtdOBk96Rodp6AcAGeZ4SOlbW6Y) |
| `cit-001469` | MAWE | 2022 | Chen | Structural insight into terminal galactose recognition by two non-HBGA bind… | [open](https://journals.asm.org/doi/abs/10.1128/jvi.00420-22) |
| `cit-001476` | — | 2022 | Tang | Glycoproteomics | [open](https://www.nature.com/articles/s43586-022-00128-4) |
| `cit-001546` | — | 2022 | Chen | Structural insight into terminal galactose recognition by two non-HBGA bind… | [open](https://journals.asm.org/doi/abs/10.1128/jvi.00420-22) |
| `cit-001551` | — | 2022 | — | Measurement of low avidity, polyreactive immunoglobulin G antibodies with i… | [open](https://www.academia.edu/download/85845801/measurement_of_low_avidity_polyreactive_immunoglobulin_g_antibodies.pdf) |
| `cit-000066` | — | 2023 | Kita | Discovery of novel N-acylpyrazoles as potent and selective thrombin inhibit… | [open](https://www.sciencedirect.com/science/article/pii/S0223523422007577) |
| `cit-000073` | — | 2023 | Guo | An Overview of Thrombin Inhibitors in the Perspective of Structureactivity … | [open](https://www.benthamdirect.com/content/journals/cmc/10.2174/0929867329666220906105200) |
| `cit-000081` | — | 2023 | — | Expanding the Scope of mRNA display by Chemical Approaches | [open](https://ses.library.usyd.edu.au/handle/2123/32220) |
| `cit-000159` | — | 2023 | Guo | An Overview of Thrombin Inhibitors in the Perspective of Structureactivity … | [open](https://www.benthamdirect.com/content/journals/cmc/10.2174/0929867329666220906105200) |
| `cit-000161` | — | 2023 | Chakraborty | Conformation based in silico studies of cyclic tetrapeptides with βγ fused … | [open](https://chemistry-europe.onlinelibrary.wiley.com/doi/abs/10.1002/slct.202204761) |
| `cit-000195` | — | 2023 | Manicassamy | Avian influenza A viruses exhibit plasticity in sialylglycoconjugate recept… | [open](https://journals.asm.org/doi/abs/10.1128/jvi.00906-23) |
| `cit-000197` | — | 2023 | Lowen | Epistasis reduces fitness costs of influenza A virus escape from stem-bindi… | [open](https://www.pnas.org/doi/abs/10.1073/pnas.2208718120) |
| `cit-000264` | — | 2023 | Veldkamp | NMR indicates the N-termini of PSGL1 and CCR7 bind competitively to the che… | [open](https://www.sciencedirect.com/science/article/pii/S240558082300105X) |
| `cit-000310` | — | 2023 | Deng | A novel role of acellular hemoglobin in hemolytic thrombosis | [open](https://www.sciencedirect.com/science/article/pii/S0049384823001561) |
| `cit-000347` | — | 2023 | Kita | Discovery of novel N-acylpyrazoles as potent and selective thrombin inhibit… | [open](https://www.sciencedirect.com/science/article/pii/S0223523422007577) |
| `cit-000360` | — | 2023 | Guo | An Overview of Thrombin Inhibitors in the Perspective of Structureactivity … | [open](https://www.benthamdirect.com/content/journals/cmc/10.2174/0929867329666220906105200) |
| `cit-000403` | — | 2023 | Dong | Facile Preparation of Carbohydrate‐Containing Adjuvants Based on Self‐Assem… | [open](https://onlinelibrary.wiley.com/doi/abs/10.1002/anie.202309140) |
| `cit-000419` | — | 2023 | Sun | Application of StrucGP in medical immunology: site-specific N-glycoproteomi… | [open](https://link.springer.com/article/10.1007/s11684-022-0964-8) |
| `cit-000500` | — | 2023 | Nagar | Protein–protein interactions in immune disorders and inflammation | [open](https://link.springer.com/chapter/10.1007/978-981-99-2423-3_4) |
| `cit-000610` | GlycoGlyph | 2023 | McCammon | Glycosylation and crowded membrane effects on influenza neuraminidase stabi… | [open](https://pmc.ncbi.nlm.nih.gov/articles/PMC10515755/) |
| `cit-000612` | GlycoGlyph | 2023 | Joshi | Recent progress in high-throughput and automated characterization of N-glyc… | [open](https://www.sciencedirect.com/science/article/pii/S0165993623004843) |
| `cit-000635` | GlycoGlyph | 2023 | Closs | Highlighting the hygroscopic capacities of apiogalacturonans | [open](https://www.sciencedirect.com/science/article/pii/S1093326323001250) |
| `cit-000667` | — | 2023 | Oprea | Pharos 2023: an integrated resource for the understudied human proteome | [open](https://academic.oup.com/nar/article-abstract/51/D1/D1405/6851109) |
| `cit-000700` | — | 2023 | Tabak | Quantitative mapping of the in vivo O-GalNAc glycoproteome in mouse tissues… | [open](https://www.pnas.org/doi/abs/10.1073/pnas.2303703120) |
| `cit-000759` | — | 2023 | Joshi | Recent progress in high-throughput and automated characterization of N-glyc… | [open](https://www.sciencedirect.com/science/article/pii/S0165993623004843) |
| `cit-000823` | — | 2023 | Lewis | Preparing glycomics data for robust statistical analysis with GlyCompareCT | [open](https://www.cell.com/star-protocols/fulltext/S2666-1667(23)00120-X) |
| `cit-000864` | — | 2023 | Wessels | Maximizing glycoproteomics results through an integrated PASEF workflow | [open](https://www.biorxiv.org/content/10.1101/2023.12.21.570555.abstract) |
| `cit-000865` | — | 2023 | — | Spin labelling via metabolic glycoengineering for studying post-translation… | [open](https://kops.uni-konstanz.de/bitstreams/163864b1-50d4-4b78-b18b-0d8a6a39b419/download) |
| `cit-001063` | — | 2023 | Chemtob | Disentangling the nonmetabolic roles of metabolites: lactate as a case study | [open](https://www.cell.com/trends/endocrinology-metabolism/abstract/S1043-2760(23)00169-8) |
| `cit-001196` | — | 2023 | Guo | An Overview of Thrombin Inhibitors in the Perspective of Structureactivity … | [open](https://www.benthamdirect.com/content/journals/cmc/10.2174/0929867329666220906105200) |
| `cit-001480` | — | 2023 | Yamasaki | Direct activation of microglia by β-glucosylceramide causes phagocytosis of… | [open](https://www.cell.com/immunity/fulltext/S1074-7613(23)00018-3) |
| `cit-001484` | — | 2023 | Thaysen-Andersen | Glycoproteome remodeling and organelle-specific N-glycosylation accompany n… | [open](https://www.pnas.org/doi/abs/10.1073/pnas.2303867120) |
| `cit-001499` | — | 2023 | Zhao | Functionalized N-hydroxypropyl trimethylammonium chloride chitosan as an IC… | [open](https://www.sciencedirect.com/science/article/pii/S1773224723007724) |
| `cit-001503` | — | 2023 | — | Role of C-type lectins in the tumor microenvironment | [open](https://link.springer.com/content/pdf/10.1007/978-3-030-80962-1_94-1.pdf) |
| `cit-001538` | — | 2023 | Wei | Effect of duck interferon-α and an anti-cap protein polyclonal antibody aga… | [open](https://www.sciencedirect.com/science/article/pii/S0882401023002681) |
| `cit-000040` | — | 2024 | — | Double-Enzyme Cascade Fluorescence Signal Amplification Method for Screenin… | — |
| `cit-000075` | — | 2024 | Shikhaliev | 1H-1,2,4-Triazolo-5-diazonium Salts in the Synthesis of New 6H-Benzopyrano[… | [open](https://link.springer.com/article/10.1134/S1070428024020088) |
| `cit-000091` | — | 2024 | Ullah | Lignin-derived bionanocomposites as functional food packaging materials | [open](https://pubs.rsc.org/fb/article-abstract/2/4/945/850400) |
| `cit-000100` | — | 2024 | Kocheva | Structure and biomedical properties of lignins (a review) | [open](https://link.springer.com/article/10.1134/S106816202407001X) |
| `cit-000107` | — | 2024 | Debroy | Biomedical Applications of Lignin Derived from Bio‐Waste Materials | [open](https://onlinelibrary.wiley.com/doi/abs/10.1002/9781119865452.ch13) |
| `cit-000184` | — | 2024 | Boons | Asymmetrical biantennary glycans prepared by a stop-and-go strategy reveal … | [open](https://pubs.acs.org/jaaucr/article-abstract/4/2/607/1270298) |
| `cit-000198` | — | 2024 | Pekosz | Clade-defining mutations in human H1N1 hemagglutinin protein from 2021-2023… | [open](https://www.biorxiv.org/content/10.1101/2024.05.18.594815.abstract) |
| `cit-000213` | — | 2024 | de Vries | Viral envelope proteins fused to multiple distinct fluorescent reporters to… | [open](https://onlinelibrary.wiley.com/doi/abs/10.1002/pro.4974) |
| `cit-000269` | — | 2024 | Naidoo | An in vitro one-pot synthetic biology approach to simulating diverging Golg… | [open](https://chemrxiv.org/doi/abs/10.26434/chemrxiv-2024-bq9ct) |
| `cit-000322` | — | 2024 | Bin Ismail | Chitosan-and heparin-based advanced hydrogels: Their chemistry, structure a… | [open](https://link.springer.com/article/10.1007/s11696-024-03785-9) |
| `cit-000410` | — | 2024 | Yang | Advancements and future perspectives in the study of oligosaccharides deriv… | [open](https://www.sciencedirect.com/science/article/pii/S221242922401304X) |
| `cit-000438` | — | 2024 | Chaikof | Total Synthesis of a PSGL‑1 Glycopeptide Analogue for Targeted Inhibition o… | [open](https://pubs.acs.org/jacsat/article-abstract/146/25/17414/158377) |
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
| `cit-000942` | — | 2024 | Smith | Heparan sulfate proteoglycans in pathological protein aggregation and brain… | [open](https://article.accscience.com/journal/AN/3/3/an_3812/an_3812.pdf) |
| `cit-000945` | — | 2024 | Long | Effect of Structural Changes in Marine Derived Sulphated Polysaccharides on… | [open](https://rest.mars-prod.its.unimelb.edu.au/server/api/core/bitstreams/7b30e834-9ca1-4a17-9811-127187891a6b/content) |
| `cit-000952` | — | 2024 | Liu | Galectin-9 as an indicator of functional limitations and radiographic joint… | [open](https://www.frontiersin.org/journals/immunology/articles/10.3389/fimmu.2024.1419676/full) |
| `cit-000953` | — | 2024 | Shu | Knockdown of Galectin-9 alleviates rheumatoid arthritis through suppressing… | [open](https://www.sciencedirect.com/science/article/pii/S0006295223005877) |
| `cit-000966` | — | 2024 | Toegel | AB0735 ALTERED GALECTIN EXPRESSION CORRELATE WITH TNF-MEDIATED INFLAMMATORY… | [open](https://ard.eular.org/article/S0003-4967(24)17410-9/abstract) |
| `cit-001002` | — | 2024 | Kalaska | Synthesis, biological evaluation and reversal of sulfonated di‐and triblock… | [open](https://advanced.onlinelibrary.wiley.com/doi/abs/10.1002/adhm.202402191) |
| `cit-001286` | — | 2024 | Zhang | Identification and anticoagulant mechanisms of novel factor XIa inhibitory … | [open](https://www.sciencedirect.com/science/article/pii/S0963996924013784) |
| `cit-001439` | — | 2024 | Kim | Detection of α-thrombin with platelet glycoprotein ibα (GP1bα) for the deve… | [open](https://pmc.ncbi.nlm.nih.gov/articles/PMC10956406/) |
| `cit-001502` | — | 2024 | — | Cracking the glycome with the sweet tooth of nature: overview and outlook o… | [open](https://books.rsc.org/books/edited-volume/2232/chapter/8161746) |
| `cit-001504` | — | 2024 | Miller | Methods and Materials for Studying Proteoglycans and Glycosaminoglycans | [open](https://books.rsc.org/books/edited-volume/2232/chapter/8161983) |
| `cit-001541` | — | 2024 | Laudański | The Use of the Neoglycolipid-Based Oligosaccharide Microarray System in the… | [open](https://www.tandfonline.com/doi/abs/10.2147/JIR.S439709) |
| `cit-000021` | — | 2025 | — | B(C6F5)3-Catalyzed Decarboxylative Formation of Benzofurans via Intermolecu… | [open](https://pubs.acs.org/doi/abs/10.1021/acs.orglett.5c02208) |
| `cit-000101` | — | 2025 | Yuan | Discovery of a Thrombin‐Targeting Anticoagulant Peptide From Whitmania pigr… | [open](https://onlinelibrary.wiley.com/doi/abs/10.1002/psc.70056) |
| `cit-000183` | — | 2025 | — | The Q226L mutation can convert a highly pathogenic H5 2.3. 4.4 e virus to b… | [open](https://www.pnas.org/doi/abs/10.1073/pnas.2419800122) |
| `cit-000257` | — | 2025 | Guo | Targeting GALNT4 suppresses atherosclerosis via TNFR1/NF-κB mediated attenu… | [open](https://www.sciencedirect.com/science/article/pii/S0898656825006242) |
| `cit-000261` | — | 2025 | Kobayashi | Expression of functionally glycosylated PSGL-1 in ALK-positive anaplastic l… | [open](https://www.sciencedirect.com/science/article/pii/S0344033825001803) |
| `cit-000262` | — | 2025 | Nikiforova | PSGL-1: A Universal Selectin Ligand or a Signaling Molecule?(Review of the … | [open](https://link.springer.com/article/10.1134/S0026893324700699) |
| `cit-000313` | — | 2025 | Sun | The semi-synthesis, characterization, and antiviral properties of alginate-… | [open](https://www.sciencedirect.com/science/article/pii/S0141813025065572) |
| `cit-000326` | — | 2025 | El-Faham | Design and synthesis of s-triazine-Isatin hybrids with potent anticancer ac… | [open](https://www.sciencedirect.com/science/article/pii/S0040402024006057) |
| `cit-000395` | — | 2025 | — | Serum N‑Glycan Profiling Identifies Candidate Glycan Biomarkers for Early D… | [open](https://pubs.acs.org/jprobs/article-abstract/24/9/4417/3761569) |
| `cit-000418` | — | 2025 | Huang | Glycome-Proteome Interactome Cartography via Proximity Tagging | [open](https://pubs.acs.org/doi/abs/10.1021/acs.accounts.5c00314) |
| `cit-000433` | — | 2025 | Long | Direct mapping of tyrosine sulfation states in native peptides by nanopore | [open](https://www.nature.com/articles/s41589-024-01734-x) |
| `cit-000461` | — | 2025 | Chaikof | Synthesis of sulfonated peptides using a trifluoromethyltoluene-protected a… | [open](https://pubs.acs.org/doi/abs/10.1021/acs.joc.4c02529) |
| `cit-000463` | — | 2025 | Ashfaq | Identification and computational analysis of conserved YXXΦ motifs in the p… | [open](https://www.tandfonline.com/doi/abs/10.1080/07391102.2025.2475224) |
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
| `cit-000943` | — | 2025 | Cai | Synthesis and biomedical applications of glycopolymers | [open](https://books.google.com/books?hl=en&lr=&id=kFVbEQAAQBAJ&oi=fnd&pg=PA43&ots=8fBLxpNFmf&sig=7pXb2LDgRRuQzVLzjwzAOj1AooQ) |
| `cit-000944` | — | 2025 | Phipps | Amide Couplings of Sugar Amino Acids and their Sulfates: Toward Heparan Sul… | [open](https://openaccess.wgtn.ac.nz/articles/thesis/Amide_Couplings_of_Sugar_Amino_Acids_and_their_Sulfates_Toward_Heparan_Sulfate_Mimetics/30185800) |
| `cit-000954` | — | 2025 | Du | Gastrodin targets the system Xc-/GPX4 axis to inhibit abnormal proliferatio… | [open](https://www.sciencedirect.com/science/article/pii/S0944711325001345) |
| `cit-000963` | — | 2025 | Yassin | The Role of Serum MCP-1 in the Diagnosis and Assessment of Rheumatoid Arthr… | [open](https://journals.uokerbala.edu.iq/index.php/kj/article/view/4920) |
| `cit-001045` | — | 2025 | Li | Activation of mannose receptor C type 1 in macrophages improves renal fibro… | [open](https://www.sciencedirect.com/science/article/pii/S0024320525002279) |
| `cit-001060` | — | 2025 | Lee | Inactivated rabies vaccine activates inflammasome signaling in raccoon dog … | [open](https://vetsci.org/DOIx.php?id=10.4142/jvs.26130) |
| `cit-001064` | — | 2025 | — | A multiscale study on multivalence targeting | [open](https://www.tdx.cat/handle/10803/696315) |
| `cit-001068` | — | 2025 | — | Metabolic and glycomic insights into macrophages in innate immunity | [open](https://figshare.mq.edu.au/articles/thesis/Metabolic_and_glycomic_insights_into_macrophages_in_innate_immunity/29251238) |
| `cit-001094` | — | 2025 | Cairo | A mild protecting-group free strategy for neoglycoconjugate synthesis | [open](https://pubs.acs.org/doi/abs/10.1021/acs.bioconjchem.5c00138) |
| `cit-001130` | — | 2025 | Venkatesan | Peptide-Tetrahydroisoquinoline (THIQ) Conjugated Derivatives as Dual-Target… | [open](https://link.springer.com/article/10.1007/s10989-025-10765-4) |
| `cit-001492` | — | 2025 | de Aquino | Rapid prediction of cervical cancer and high-grade precursor lesions: An in… | [open](https://www.sciencedirect.com/science/article/pii/S0009898125002256) |
| `cit-001506` | — | 2025 | — | Mycobacterial pathways from simple glycosides to fatty acid-sheltering poly… | [open](https://books.rsc.org/books/edited-volume/2487/chapter/8762169) |
| `cit-001507` | — | 2025 | Calleri | GCI‐Based Affinity Screening of Synthetic Oligomannosides toward Concanaval… | [open](https://chemistry-europe.onlinelibrary.wiley.com/doi/abs/10.1002/chem.202502137) |
| `cit-001530` | — | 2025 | Kushlinskii | Multiplex analysis of ovarian cancer patients using glycan microarray | [open](https://www.sciencedirect.com/science/article/pii/S0003269725000442) |
| `cit-001531` | — | 2025 | Wu | Chemoenzymatic Synthesis of Rhamnolipid-Modified Exendin-4: A Dual Approach… | [open](https://pubs.acs.org/doi/abs/10.1021/acs.jmedchem.5c02146) |
| `cit-001540` | — | 2025 | Bovin | Polysaccharide epitopes recognized by human α-l-Rha antibodies | [open](https://www.sciencedirect.com/science/article/pii/S000862152500343X) |
| `cit-001552` | — | 2025 | Bovin | Profiling of Anti-glycan IgA and IgG in Oral Fluid Using a Glycan Microarray | [open](https://link.springer.com/protocol/10.1007/978-1-0716-4627-4_5) |
| `cit-000146` | — | 2026 | He | From In Silico De Novo Generation to In Vitro Functional Validation: Discov… | [open](https://pubs.acs.org/jafcau/article-abstract/doi/10.1021/acs.jafc.6c07894/5250387) |
| `cit-000205` | — | 2026 | Pu | Dominant HA motif 131/132-NT shapes the phenotype of avian H9N2 influenza v… | [open](https://www.sciencedirect.com/science/article/pii/S1995820X26000969) |
| `cit-000208` | — | 2026 | Bovin | Antibody-free detection of influenza viruses on a microarray to study their… | [open](https://link.springer.com/article/10.1007/s00705-026-06578-5) |
| `cit-000411` | — | 2026 | Klassen | Defining Glycan Recognition by DC-SIGN Using Native Mass Spectrometry | [open](https://pubs.acs.org/acbcct/article-abstract/21/8/1980/5232352) |
| `cit-000412` | — | 2026 | Mechref | Advanced Glycomics Approach for Characterization of IgG Glycan Alterations … | [open](https://www.sciencedirect.com/science/article/pii/S0003267026008329) |
| `cit-000413` | — | 2026 | Gamulin | Glycan Fingerprint of Malignant Pleural Mesothelioma | [open](https://www.mdpi.com/1422-0067/27/14/6134) |
| `cit-000429` | — | 2026 | Gautam | Glycoproteomics and Immunity | [open](https://api.taylorfrancis.com/content/chapters/edit/download?identifierName=doi&identifierValue=10.1201/9781003635901-8&type=chapterpdf) |
| `cit-000492` | — | 2026 | Dou | Disrupting galectin-3 and NET-mediated microglia-neutrophil cross-talk supp… | [open](https://www.science.org/doi/abs/10.1126/scitranslmed.aea5661) |
| `cit-000496` | — | 2026 | Chang | Genetic variation at rs11574891 and rs3125003 in NOTCH1 is associated with … | [open](https://www.sciencedirect.com/science/article/pii/S1567576925018132) |
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
| `cit-000918` | MAWE | 2026 | Luo | Artificial intelligence empowering polysaccharide research in drug developm… | [open](https://journal.hep.com.cn/targetome/EN/10.48130/targetome-0026-0026) |
| `cit-000934` | — | 2026 | Oliveira | Natural and Semisynthetic Hydrocolloids as Functional Polymeric Materials: … | [open](https://www.mdpi.com/2076-3417/16/10/5105) |
| `cit-000936` | — | 2026 | Nguyen | Synthetic Heparan Sulfate-like Oligosaccharides as Tools to Decipher Growth… | [open](https://pubs.acs.org/jmcmar/article-abstract/doi/10.1021/acs.jmedchem.6c00760/5278503) |
| `cit-000939` | — | 2026 | Ausili | How pH and Sulfation Shape human Heparanase Structure, Stability, and Subst… | [open](https://www.sciencedirect.com/science/article/pii/S0003986126001505) |
| `cit-000940` | — | 2026 | Nieto | Synthesis of Sulfated Glycomimetics with Micromolar Affinity for Midkine | [open](https://pmc.ncbi.nlm.nih.gov/articles/PMC13077691/) |
| `cit-000958` | — | 2026 | Xu | Gentiopicroside attenuates lupus arthritis by targeting galectin-mediated m… | [open](https://www.sciencedirect.com/science/article/pii/S0944711326000838) |
| `cit-001046` | — | 2026 | Li | Fluorescent probes for intraoperative navigation in glioma resection: recen… | [open](https://www.sciencedirect.com/science/article/pii/S001085452600857X) |
| `cit-001047` | — | 2026 | Qi | Microbial Rhamnolipid‐Stabilized mRNA Nanovaccines Enhance Adaptive Immunit… | [open](https://advanced.onlinelibrary.wiley.com/doi/abs/10.1002/adfm.202531454) |
| `cit-001049` | — | 2026 | Kim | Spatiotemporal targeting of miR-125b-5p regulatory hub via dual-ligand nano… | [open](https://www.sciencedirect.com/science/article/pii/S1385894726043901) |
| `cit-001053` | — | 2026 | Wang | A macrophage mannose receptor 1 with dual CTLDs played a crucial role in de… | [open](https://www.sciencedirect.com/science/article/pii/S1050464826002500) |
| `cit-001054` | — | 2026 | Reusch | Mannose receptor contributes to preferential oligomannosidic glycoform clea… | [open](https://www.tandfonline.com/doi/abs/10.1080/19420862.2026.2652119) |
| `cit-001058` | — | 2026 | Kondo | Development and In Vitro Evaluation of Near-Infrared Dye-Conjugated Pullula… | [open](https://www.mdpi.com/2624-845x/7/3/20) |
| `cit-001061` | — | 2026 | Werling | Analysis of genetic variation in the bovine Mannose Receptor gene (MRC1), i… | [open](https://www.biorxiv.org/content/10.64898/2026.06.27.734952.abstract) |
| `cit-001113` | Glyco-SPOT | 2026 | Li | Chemoenzymatic synthesis of sulfated O-glycopeptides from human CD34 | [open](https://pubs.rsc.org/cc/article-abstract/62/16/4843/919937) |
| `cit-001323` | — | 2026 | Zhang | AlphaFold3 assisted screening strategy identifying novel coagulation factor… | [open](https://www.sciencedirect.com/science/article/pii/S0960852426015798) |
| `cit-001325` | — | 2026 | Yue | Discovery of Novel FXIa Inhibitory Peptides from Deep-Sea Gigantidas platif… | [open](https://pubs.acs.org/jafcau/article/74/25/19936/5165424) |
| `cit-001332` | — | 2026 | Zhang | Peptidomic characterization and evaluation of in vitro and in vivo anticoag… | [open](https://www.sciencedirect.com/science/article/pii/S2212429226007790) |
| `cit-001468` | MAWE | 2026 | Arthur | Defining the Specificity of Blood-Group-Binding Lectins Through Microarray … | [open](https://link.springer.com/protocol/10.1007/978-1-0716-5376-0_34) |
| `cit-001493` | — | 2026 | — | Fluorescent probes for intraoperative navigation in glioma resection: recen… | [open](https://www.sciencedirect.com/science/article/pii/S001085452600857X) |
| `cit-001495` | — | 2026 | Casettari | One‐Step Microfluidic Manufactured Fucose‐Decorated Sweetosomes Choose the … | [open](https://advanced.onlinelibrary.wiley.com/doi/abs/10.1002/adhm.202505617) |
| `cit-001500` | — | 2026 | At | N-glycan signatures of immunoglobulins-depleted serum proteins in colorecta… | [open](https://link.springer.com/article/10.1007/s10719-026-10216-2) |
| `cit-001519` | — | 2026 | King | Human anti-glycan reactivity emerges from B cells utilizing private gene re… | [open](https://www.cell.com/immunity/fulltext/S1074-7613(26)00053-1) |
| `cit-001545` | — | 2026 | Jan | Use of Microbial Microarrays to Define Antibody Specificity | [open](https://link.springer.com/protocol/10.1007/978-1-0716-5376-0_30) |
| `cit-000548` | GLAD | — | Perez | CBMcarb-DB: interface of the three-dimensional landscape of carbohydrate-bi… | [open](https://books.rsc.org/books/edited-volume/2205/chapter/8051227) |
| `cit-000559` | GLAD | — | — | Glycan Microarray Data Analysis: From Raw Data to Public Database Integrati… | [open](https://www.creative-proteomics.com/resource/glycan-microarray-analysis-and-database-integration.htm) |
| `cit-000560` | GLAD | — | Feizi | CarbArrayART-An update on the software tool for carbohydrate microarray dat… | [open](https://spiral.imperial.ac.uk/entities/publication/6ebd01fb-2687-4761-a614-c85c1a192b24) |
| `cit-000562` | GLAD | — | Feizi | CarbArrayART | [open](https://run.unl.pt/entities/publication/48e256d4-d5a1-4fde-a8a0-ec184408ff34) |

### 2.6 `not-in-indexes` — 122 row(s)

Neither PubMed nor OpenAlex returned the work, so there was nothing to fetch. These tend to be theses, book chapters, or commercial pages.

| row_uid | tool | year | senior author | citing title | link |
|---|---|---|---|---|---|
| `cit-001036` | — | 2012 | — | www. rsc. org/molecularbiosystems | [open](https://drive.google.com/file/d/1ntEuLf584tvrK1lLhwu92_6VrrnrzC4M/view) |
| `cit-000383` | — | 2015 | — | 5.2. 18.8 Imidoylstannanes, Diazoalkylstannanes, Tin Isocyanates, and Tin I… | — |
| `cit-001231` | — | 2015 | — | 5.2. 18.8 Imidoylstannanes, Diazoalkylstannanes, Tin Isocyanates, and Tin I… | — |
| `cit-001389` | — | 2015 | — | New perspectives for antithrombotic therapy—coagulation factor XI as a targ… | [open](https://journals.viamedica.pl/hematology_in_clinical_practice/article/view/44302) |
| `cit-001133` | — | 2017 | Zhang | Design, synthesis and biological evaluation of novel 2, 3-dihydroquinazolin… | [open](https://www.sciencedirect.com/science/article/pii/S0223523416307917) |
| `cit-000024` | — | 2018 | Zhang | Inhibition of thrombin by functionalized C60 nanoparticles revealed via in … | [open](https://www.sciencedirect.com/science/article/pii/S1001074217311762) |
| `cit-000126` | — | 2018 | Zhang | Inhibition of thrombin by functionalized C60 nanoparticles revealed via in … | [open](https://www.sciencedirect.com/science/article/pii/S1001074217311762) |
| `cit-000362` | — | 2018 | Zhang | Inhibition of thrombin by functionalized C60 nanoparticles revealed via in … | [open](https://www.sciencedirect.com/science/article/pii/S1001074217311762) |
| `cit-001197` | — | 2018 | Zhang | Inhibition of thrombin by functionalized C60 nanoparticles revealed via in … | [open](https://www.sciencedirect.com/science/article/pii/S1001074217311762) |
| `cit-000114` | — | 2019 | Hu | Migfilin supports hemostasis and thrombosis through regulating platelet aII… | [open](https://pmc.ncbi.nlm.nih.gov/articles/PMC7604612/) |
| `cit-001145` | — | 2019 | Mousa | Chemical Characteristics of Direct FXa Inhibitors Registered for Atrial Fib… | [open](https://www.academia.edu/download/131814672/chemical-characteristics-of-direct-fxa-inhibitors-registered-for-atrial-fibrillation-5306.pdf) |
| `cit-000905` | — | 2020 | — | Factors modulating the interaction of prions withheparan sulfate and their … | [open](https://www.ovid.com/journals/glyco/abstract/00002513-202012000-00028~factors-modulating-the-interaction-of-prions-withheparan) |
| `cit-000906` | — | 2020 | — | N-glycans on EGF domain-specificO-GlcNAc transferase (EOGT) facilitate EOGT… | [open](https://www.ovid.com/journals/glyco/abstract/00002513-202012000-00030~n-glycans-on-egf-domain-specifico-glcnac-transferase-eogt) |
| `cit-000123` | — | 2021 | Bhaumik | Lignin to platform chemicals and biomaterials: chemical and biological pers… | [open](https://www.taylorfrancis.com/chapters/edit/10.1201/9781003158486-2/lignin-platform-chemicals-biomaterials-yeddula-nikhileshwar-reddy-kunal-gogde-shatabdi-paul-jayeeta-bhaumik) |
| `cit-000401` | — | 2021 | Thaysen-Andersen | Trends in oligomannosylation and α1, 2-mannosidase expression in human canc… | [open](https://pmc.ncbi.nlm.nih.gov/articles/PMC8522845/) |
| `cit-000869` | — | 2021 | Sukhija | Glycobioinformatics in deciphering the mammalian glycocode: Recent advances | [open](https://www.dattaconsultinggroup.com/akdsite/assets/publications/glycocodearticle.pdf) |
| `cit-001473` | MAWE | 2021 | — | Kiyoko F. Aoki-Kinoshita1, Frédérique Lisacek2, Niclas Karlsson3, 4, Daniel… | [open](https://research-management.mq.edu.au/ws/portalfiles/portal/180735915/180733549.pdf) |
| `cit-001488` | — | 2021 | Thaysen-Andersen | Trends in oligomannosylation and α1, 2-mannosidase expression in human canc… | [open](https://pmc.ncbi.nlm.nih.gov/articles/PMC8522845/) |
| `cit-000464` | — | 2022 | Su | Efficient TurboID-based proximity labelling method for identifying terminal… | [open](https://pmc.ncbi.nlm.nih.gov/articles/PMC10157534/) |
| `cit-000853` | — | 2022 | Nesvizhskii | HLA-Glyco: A large-scale interrogation of the glycosylated immunopeptidome | [open](https://www.biorxiv.org/content/10.1101/2022.12.05.519200.abstract) |
| `cit-000881` | — | 2022 | Mahal | Glycomic Analysis Identifies Pre-Vaccination Markers of Response to Influen… | [open](https://www.medrxiv.org/content/10.1101/2022.02.09.22270754.abstract) |
| `cit-001144` | — | 2022 | — | Indexed bibliography of genetic algorithms in physical sciences | [open](https://www.researchgate.net/profile/Jarmo-Alander/publication/267222583_An_Indexed_Bibliography_of_Genetic_Algorithms_in_Physical_Sciences_compiled_by/links/545c7f960cf2f1dbcbcb3eb3/An-Indexed-Bibliography-of-Genetic-Algorithms-in-Physical-Sciences-compiled-by.pdf) |
| `cit-001557` | — | 2022 | — | Mapping the antibody repertoire to Staphylococcus aureus wall teichoic acid… | [open](https://dspace.library.uu.nl/server/api/core/bitstreams/1493575a-a5a9-468e-9017-e6aa057e2cf6/content#page=80) |
| `cit-000661` | — | 2023 | — | RCSB Protein Data Bank (RCSB. org): delivery of experimentally-determined P… | [open](https://academic.oup.com/nar/article-abstract/51/D1/D488/6845439) |
| `cit-001554` | — | 2023 | — | A review of glycoconjugate vaccines: The current state of the technology, c… | [open](https://search.proquest.com/openview/feb4f47b2ff4a4c0cbdb693c47f2a410/1?pq-origsite=gscholar&cbl=2026366&diss=y) |
| `cit-000466` | — | 2024 | Lucchini | Metabolomic and Lipidomic Analysis of Manganese-Associated Parkinsonism: a … | [open](https://pmc.ncbi.nlm.nih.gov/articles/PMC11398432/) |
| `cit-000779` | — | 2024 | — | Protein structure, a genetic encoding for glycosylation | [open](https://www.biorxiv.org/content/10.1101/2024.05.15.594261.abstract) |
| `cit-000965` | — | 2024 | — | AB0734 PEPTIDYLARGININE DEIMINASE 4 (PAD4) INHIBITOR 4, 6-BIS (2, 2, 2-TRIF… | [open](https://www.sciencedirect.com/science/article/pii/S0003496724174092) |
| `cit-001542` | — | 2024 | King | Human Anti-Glycan Reactivity is Driven by the Selection of B cells Utilizin… | [open](https://pmc.ncbi.nlm.nih.gov/articles/PMC11507706/) |
| `cit-001059` | — | 2025 | van Kasteren | Quantification of single molecule glycan-mannose receptor binding kinetics … | [open](https://www.biorxiv.org/content/10.1101/2025.01.24.634682.abstract) |
| `cit-000149` | — | 2026 | Yadav | Novel furo [2, 3-d] pyrimidinones as direct thrombin inhibitors: Design, sy… | [open](https://www.sciencedirect.com/science/article/pii/S0968089626002208) |
| `cit-000211` | — | 2026 | — | Biological Characteristics of the Epidemic Influenza A/Singapore/GP20238/20… | [open](https://iimmun.ru/iimm/article/view/18211) |
| `cit-000338` | — | 2026 | Yadav | Novel furo [2, 3-d] pyrimidinones as direct thrombin inhibitors: Design, sy… | [open](https://www.sciencedirect.com/science/article/pii/S0968089626002208) |
| `cit-000829` | — | 2026 | Doering | Two closely related β-1, 2-xylosyltransferases differentially impact fungal… | [open](https://pmc.ncbi.nlm.nih.gov/articles/PMC13131615/) |
| `cit-000839` | — | 2026 | Panneerselvam | Glycomics and Infection Progress: Exploring the Role of Mucuna pruriens (L.… | [open](https://api.taylorfrancis.com/content/chapters/edit/download?identifierName=doi&identifierValue=10.1201/9781003635901-6&type=chapterpdf) |
| `cit-001056` | — | 2026 | Yu | Pinellia ternata lectin induces mitochondrial damage and inflammation in RA… | [open](https://www.sciencedirect.com/science/article/pii/S0041008X26002668) |
| `cit-000026` | — | — | — | Allosteric Regulatory Mechanisms of Human DNA Methyltransferase 3A (DNMT3A) | [open](https://search.proquest.com/openview/8d9082f914c9ad4ca942fc23c7585af7/1?pq-origsite=gscholar&cbl=18750&diss=y) |
| `cit-000027` | — | — | Schiering | Factor xi antibodies and methods of use | [open](https://patents.google.com/patent/US20170022292A1/en) |
| `cit-000028` | — | — | — | Reversal binding agents for anti-factor XI/XIa antibodies and uses thereof | [open](https://patents.google.com/patent/US10647780B2/en) |
| `cit-000030` | — | — | — | Factor XI antibodies and methods of use | [open](https://patents.google.com/patent/US11168147B2/en) |
| `cit-000031` | — | — | — | ASSESSING DRUG DEVELOPMENT PROPORTIES OF ANTITHROMBOTIC AND ANTI-CANCER AGE… | [open](https://scholarscompass.vcu.edu/etd/7203/?gathStatIcon=true/) |
| `cit-000079` | — | — | — | 1 H-1, 2, 4-Triazolo-5-diazonium salts in the synthesis of new 6 H-benzopyr… | — |
| `cit-000080` | — | — | — | ASSESSING DRUG DEVELOPMENT PROPORTIES OF ANTITHROMBOTIC AND ANTI-CANCER AGE… | [open](https://scholarscompass.vcu.edu/etd/7203/?gathStatIcon=true/) |
| `cit-000088` | — | — | — | Targeting Allosteric Site of Enzyme: New Approach to Overcoming Drug Resist… | — |
| `cit-000135` | — | — | — | ASSESSING DRUG DEVELOPMENT PROPORTIES OF ANTITHROMBOTIC AND ANTI-CANCER AGE… | [open](https://scholarscompass.vcu.edu/etd/7203/?gathStatIcon=true/) |
| `cit-000163` | — | — | — | Small Molecule Modulators of Protease-Activated Receptor-I | [open](https://search.proquest.com/openview/fe01386a09c4bde24958e157427df8c7/1?pq-origsite=gscholar&cbl=18750&diss=y) |
| `cit-000166` | — | — | — | A phosphatase and protease library screen to elucidate aminoglycoside-media… | [open](https://search.proquest.com/openview/0827b4b273be551474326cd5485e8e1c/1?pq-origsite=gscholar&cbl=18750&diss=y) |
| `cit-000170` | — | — | — | Bioinspired Self-Assembly of Microscale Surface-Tension Based Systems | [open](https://search.proquest.com/openview/a7cea68192d7857f857bd3f76f8d0e18/1?pq-origsite=gscholar&cbl=18750&diss=y) |
| `cit-000174` | — | — | — | Characterization of some procoagulant and anticoagulant protein (s) and pep… | [open](http://agnee.tezu.ernet.in:8082/jspui/bitstream/1994/295/1/T-348.pdf) |
| `cit-000177` | — | — | — | THROMBOPHILIAS IN PREGNANCY | — |
| `cit-000209` | — | — | — | CHARACTERIZATION OF IN VITRO FITNESS AND ANTIGENIC DRIFT DIFFERENCES BETWEE… | [open](https://jscholarship.library.jhu.edu/items/0dbcacaf-9e37-49c3-8a95-a3f55b8ae645) |
| `cit-000218` | — | — | — | Identifying Host Genetic Targets for Limiting Susceptibility to Respiratory… | [open](https://search.proquest.com/openview/2292ead2556a4b653c9bd29643bc58b8/1?pq-origsite=gscholar&cbl=18750&diss=y) |
| `cit-000219` | — | — | — | Deciphering Receptor Binding Landscapes: AI-Enabled Insights Into Influenza… | [open](https://search.proquest.com/openview/80aa496f003511e11b714c348e89f9be/1?pq-origsite=gscholar&cbl=18750&diss=y) |
| `cit-000223` | — | — | — | Mucin-Mediated and Interferon-Driven Defense Mechanisms against Influenza V… | [open](https://search.proquest.com/openview/f23cc61230fac4137894c8a4244e2372/1?pq-origsite=gscholar&cbl=18750&diss=y) |
| `cit-000244` | — | — | — | ORIGINAL RESEARCH 2-O, 3-O Desulfated Heparin Blocks High Mobility Group Bo… | [open](https://www.academia.edu/download/63163721/Zheng_AJRCMB_2016_ODSH_block_p300_and_HMGB1_release20200501-105723-18j80u0.pdf) |
| `cit-000266` | — | — | — | Charge Matters: How flanking substrate charge and silicates modulate O-glyc… | [open](https://search.proquest.com/openview/4440878005eed9956ea24784bb1a782d/1?pq-origsite=gscholar&cbl=18750&diss=y) |
| `cit-000268` | — | — | — | CCR5 Sulfopeptide Library and O-Glycosylated Amino Acids as Chemical Tools … | [open](https://search.proquest.com/openview/4373ac3b6e207b46364e5709279215fe/1?pq-origsite=gscholar&cbl=18750&diss=y) |
| `cit-000271` | — | — | — | Abdullateef Nashed 1, 2 Kyllen Dilsook 1, 2 Tharindu Senapathi 1, 3 AA | [open](https://assets-eu.researchsquare.com/files/rs-5783651/v1/689448a2d54485d1fc521266.html) |
| `cit-000319` | — | — | — | Hemoglobin i alosterija | [open](https://repozitorij.unios.hr/object/kemos:560) |
| `cit-000370` | — | — | — | ASSESSING DRUG DEVELOPMENT PROPORTIES OF ANTITHROMBOTIC AND ANTI-CANCER AGE… | [open](https://scholarscompass.vcu.edu/etd/7203/?gathStatIcon=true/) |
| `cit-000377` | — | — | — | This article has been accepted for publication and undergone full peer revi… | [open](https://boris-portal.unibe.ch/bitstreams/b2d903ec-cab8-40a8-b807-ce8129002e65/download) |
| `cit-000382` | — | — | — | Arimidex clotting trt prevent thrombosis Endocrine Abstracts | — |
| `cit-000425` | — | — | — | Advancing LC-MS/MS Bioanalytical Techniques to Investigate Glycomic, Glycop… | [open](https://ttu-ir.tdl.org/bitstreams/9431f614-6d26-4afe-91b3-e063acd0e6fe/download) |
| `cit-000426` | — | — | — | Structural Characterisation of Low Affinity Protein-Ligand Complexes of Bio… | [open](https://idus.us.es/bitstreams/7631fd13-2b98-460e-9153-b40f76cebf04/download) |
| `cit-000427` | — | — | — | Advances in Native Mass Spectrometry Tools to Quantify Immune Lectin-Glycan… | [open](https://ualberta.scholaris.ca/items/ef5a1a0c-7eea-4248-832f-9fe6715f68d5) |
| `cit-000430` | — | — | — | Protein Nanoparticles for Applications in Chemical Biology and Immunology | [open](https://search.proquest.com/openview/b92b1bfbf86c1d825196526f27439ef4/1?pq-origsite=gscholar&cbl=18750&diss=y) |
| `cit-000467` | — | — | — | Anti-ccr8 antibodies for treating cancer | [open](https://patents.google.com/patent/US20230119066A1/en) |
| `cit-000468` | — | — | — | Synthesis of cyclic glycopeptide inhibitors of P-selectin and glycans from … | [open](https://ses.library.usyd.edu.au/handle/2123/33575) |
| `cit-000470` | — | — | — | Characterization of protein post-translational modifications using 193 nm u… | [open](https://repositories.lib.utexas.edu/items/c023df8e-38d8-4aee-b77f-cb5146807d38) |
| `cit-000471` | — | — | — | General Approaches to Caging Sulfation in Biomolecules | [open](https://search.proquest.com/openview/736eb343149792d32352515eb3f13df1/1?pq-origsite=gscholar&cbl=18750&diss=y) |
| `cit-000476` | — | — | — | Coat of Many Colors-Specificity of GalNAc Transferase Family of Isoenzymes | [open](https://search.proquest.com/openview/aa50d316853ba35b17ec1cccd3426911/1?pq-origsite=gscholar&cbl=18750&diss=y) |
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
| `cit-000928` | MAWE | — | — | Glycan Microarray Data Analysis: From Raw Data to Public Database Integrati… | [open](https://www.creative-proteomics.com/resource/glycan-microarray-analysis-and-database-integration.htm) |
| `cit-000947` | — | — | — | Spaced heparinoids: a new class of heparin-like molcules | [open](https://patents.google.com/patent/US20250084117A1/en) |
| `cit-001022` | — | — | O'brien | Stabilizing camptothecin pharmaceutical compositions | [open](https://patents.google.com/patent/US10993914B2/en) |
| `cit-001027` | — | — | — | Sucrose octasulfate (potassium salt) | [open](https://content.labscoop.com/products/d1c8b7d8-0dac-47c1-aa44-5fa18691d5b5/Hxhsw16382.pdf) |
| `cit-001029` | — | — | — | Methods for the Production of Heparan Sulfate Structure Libraries and Their… | [open](https://search.proquest.com/openview/6e5a0d4ba4265c8f07546f8d36e84c8b/1?pq-origsite=gscholar&cbl=18750&diss=y) |
| `cit-001032` | — | — | Jairajpuri | Research Article Polysulfated Trehalose as a Novel Anticoagulant Agent with… | [open](https://www.academia.edu/download/125145505/630482.pdf) |
| `cit-001067` | — | — | van Kasteren | Correlating mannose binding to myeloid cell function | [open](https://scholarlypublications.universiteitleiden.nl/access/item%3A4307278/download) |
| `cit-001069` | — | — | — | Un estudio multiescala sobre la focalización multivalencia | [open](https://diposit.ub.edu/bitstreams/b7d5aa9b-05f0-4e84-8895-688efb06481f/download) |
| `cit-001122` | Glyco-SPOT | — | — | Electrochemical Desulfurization and its Application to Native Chemical Liga… | [open](https://discovery.ucl.ac.uk/id/eprint/10187319/) |
| `cit-001124` | Glyco-SPOT | — | — | Peptide microarray fabrication by laser-based in situ synthesis and utiliza… | [open](https://search.proquest.com/openview/56fd66797dbe429288a67ce929dd7332/1?pq-origsite=gscholar&cbl=2026366&diss=y) |
| `cit-001125` | Glyco-SPOT | — | — | Development of Novel Technologies for Parallel Synthesis of Glycans and Gly… | [open](https://refubium.fu-berlin.de/handle/fub188/39300) |
| `cit-001126` | Glyco-SPOT | — | — | N-acetylgalactosamine mimetics and derivatives as potential protein-protein… | — |
| `cit-001152` | — | — | — | Nucleophilic aromatic substitution of fluoroarenes to synthesise drug compo… | [open](https://repository.lboro.ac.uk/articles/thesis/Nucleophilic_aromatic_substitution_of_fluoroarenes_to_synthesise_drug_compounds_for_combatting_neglected_tropical_diseases/23561271) |
| `cit-001207` | — | — | — | ASSESSING DRUG DEVELOPMENT PROPORTIES OF ANTITHROMBOTIC AND ANTI-CANCER AGE… | [open](https://scholarscompass.vcu.edu/etd/7203/?gathStatIcon=true/) |
| `cit-001215` | — | — | — | This article has been accepted for publication and undergone full peer revi… | [open](https://boris-portal.unibe.ch/bitstreams/b2d903ec-cab8-40a8-b807-ce8129002e65/download) |
| `cit-001229` | — | — | — | Arimidex clotting trt prevent thrombosis Endocrine Abstracts | — |
| `cit-001342` | — | — | — | Macrocycles with aromatic P2′ groups as factor xia inhibitors | [open](https://patents.google.com/patent/US9777001B2/en) |
| `cit-001371` | — | — | — | ASSESSING DRUG DEVELOPMENT PROPORTIES OF ANTITHROMBOTIC AND ANTI-CANCER AGE… | [open](https://scholarscompass.vcu.edu/etd/7203/?gathStatIcon=true/) |
| `cit-001372` | — | — | — | Polycationic inhibitors to target prothrombotic nucleic acids in vitro and … | [open](https://open.library.ubc.ca/soa/cIRcle/collections/ubctheses/24/items/1.0423028) |
| `cit-001379` | — | — | — | Data Mining/Machine Learning Techniques for Drug Discovery: Computational a… | [open](https://rave.ohiolink.edu/etdc/view?acc_num=akron1524661027035591) |
| `cit-001448` | — | — | — | ASSESSING DRUG DEVELOPMENT PROPORTIES OF ANTITHROMBOTIC AND ANTI-CANCER AGE… | [open](https://scholarscompass.vcu.edu/etd/7203/?gathStatIcon=true/) |
| `cit-001455` | — | — | — | This article has been accepted for publication and undergone full peer revi… | [open](https://boris-portal.unibe.ch/bitstreams/b2d903ec-cab8-40a8-b807-ce8129002e65/download) |
| `cit-001457` | — | — | — | Arimidex clotting trt prevent thrombosis Endocrine Abstracts | — |
| `cit-001472` | MAWE | — | — | Glycan Microarray Data Analysis: From Raw Data to Public Database Integrati… | [open](https://www.creative-proteomics.com/resource/glycan-microarray-analysis-and-database-integration.htm) |
| `cit-001474` | MAWE | — | — | Received 19 Oct 2021, Accepted 27 Oct 2021, Published 09 Nov 2021 | [open](https://www.beilstein-journals.org/bjoc/content/html/1860-5397-17-184.html) |
| `cit-001508` | — | — | — | Glycans as dual orchestrators of microbiome and immune response dynamics in… | [open](https://repositorio-aberto.up.pt/bitstream/10216/165524/2/711641.pdf) |
| `cit-001509` | — | — | — | Decoding the glycobiology of the paucimannose-rich neutrophil N-glycoproteo… | [open](https://figshare.mq.edu.au/ndownloader/files/42902449) |
| `cit-001550` | — | — | — | STRUCTURE-FUNCTION STUDIES OF AN RTX-ADHESIN FROM VIBRIO VULNIFICUS AND ITS… | [open](https://queensu.scholaris.ca/server/api/core/bitstreams/5594e40f-e0d9-4469-9a8f-016e81f60463/content) |

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
| Glyco-SPOT | 4 |
| GlycoGlyph | 2 |
| MAWE | 3 |

Distribution over all 980 rows: `2` = 108, `3` = 44, `4` = 18, `(blank)` = 810.

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

[`potential_notable_citations.html`](./potential_notable_citations.html) lists **704**
independent citations of the works in the candidate queue that are **not** in `packet.html`.
They appear as **626 rows**
because 78 citations sit on a row already held by
another of my works. One article that cites two of them is one row with two judgements
in it, one per work, so the row says where GLAD sits and where GlycoGlyph sits separately.

It is a review page for the applicant: it is not linked from the packet, not printed
with it, and nothing on it is evidence until a person has read the article and filed it.

| my work | citing works the record lists | less retired | less not independent | less copies | less not English | less in packet | less in original app. | less decided | listed | PDF on file |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| **GLAD** — GLAD: GLycan Array Dashboard, a visual analyt… (2019) | 64 | 0 | 18 | 2 | 0 | 7 | 2 | 5 | **30** | 15 |
| **GlycoGlyph** — GlycoGlyph: a glycan visualizing, drawing and… (2020) | 78 | 0 | 9 | 4 | 0 | 7 | 3 | 28 | **27** | 12 |
| **MAWE** — GlyMDB: Glycan Microarray Database and analys… (2020) | 24 | 0 | 4 | 1 | 0 | 0 | 0 | 6 | **13** | 1 |
| **MAWE** — Reusable glycan microarrays using a microwave… (2024) | 15 | 0 | 6 | 1 | 0 | 5 | 0 | 2 | **1** | 0 |
| **MAWE** — Tools for generating and analyzing glycan mic… (2020) | 18 | 0 | 3 | 0 | 0 | 0 | 1 | 5 | **9** | 2 |
| **Other** — Allosteric inhibition of human factor XIa: di… (2014) | 41 | 0 | 8 | 3 | 0 | 0 | 2 | 6 | **22** | 0 |
| **Other** — Allosteric partial inhibition of monomeric pr… (2016) | 47 | 0 | 15 | 1 | 0 | 0 | 0 | 7 | **24** | 2 |
| **Other** — Allosterism‐based simultaneous, dual anticoag… (2016) | 56 | 0 | 12 | 3 | 0 | 0 | 2 | 9 | **30** | 3 |
| **Other** — An update on recent patents on thrombin inhib… (2014) | 70 | 35 | 2 | 5 | 0 | 0 | 0 | 5 | **23** | 2 |
| **Other** — Antigenic pressure on H3N2 influenza virus dr… (2019) | 48 | 0 | 10 | 2 | 0 | 0 | 2 | 6 | **28** | 5 |
| **Other** — Chemoenzymatically Prepared Heparan Sulfate C… (2015) | 17 | 0 | 9 | 0 | 0 | 0 | 0 | 1 | **7** | 0 |
| **Other** — Chemokine binding to PSGL-1 is controlled by … (2023) | 28 | 0 | 5 | 2 | 0 | 0 | 1 | 8 | **12** | 4 |
| **Other** — Design, Synthesis, and Investigation of Novel… (2015) | 16 | 0 | 5 | 2 | 0 | 0 | 0 | 2 | **7** | 0 |
| **Other** — Designing allosteric regulators of thrombin. … (2013) | 65 | 0 | 29 | 1 | 0 | 0 | 0 | 9 | **26** | 1 |
| **Other** — Differential recognition of oligomannose isom… (2021) | 39 | 0 | 5 | 0 | 0 | 1 | 1 | 6 | **26** | 7 |
| **Other** — Emerging patterns of tyrosine sulfation and O… (2020) | 46 | 0 | 8 | 2 | 0 | 0 | 0 | 11 | **25** | 7 |
| **Other** — Galectin-3 Decreases 4-1BBL Bioactivity by Cr… (2022) | 27 | 10 | 6 | 2 | 0 | 0 | 0 | 5 | **4** | 0 |
| **Other** — GlyGen: computational and informatics resourc… (2020) | 248 | 0 | 51 | 14 | 0 | 0 | 0 | 37 | **146** | 34 |
| **Other** — Heparan sulfate glycomimetics via iterative a… (2023) | 18 | 0 | 3 | 0 | 0 | 0 | 0 | 2 | **13** | 0 |
| **Other** — Increased Galectin-9 Levels Correlate with Di… (2023) | 18 | 0 | 0 | 1 | 0 | 0 | 0 | 4 | **13** | 6 |
| **Other** — Interaction of thrombin with sucrose octasulf… (2011) | 37 | 0 | 11 | 2 | 0 | 0 | 0 | 2 | **22** | 1 |
| **Other** — N-glycosylation of mannose receptor (CD206) r… (2022) | 35 | 0 | 1 | 0 | 0 | 0 | 0 | 7 | **27** | 9 |
| **Other** — Novel reversible fluorescent glycan linker fo… (2019) | 24 | 0 | 8 | 1 | 0 | 0 | 0 | 5 | **10** | 1 |
| **Glyco-SPOT** — Parallel Glyco-SPOT Synthesis of Glycopeptide… (2020) | 22 | 0 | 3 | 1 | 0 | 0 | 2 | 4 | **12** | 3 |
| **Other** — Potent direct inhibitors of factor Xa based o… (2012) | 32 | 0 | 8 | 1 | 0 | 0 | 0 | 2 | **21** | 3 |
| **Other** — Rational design of potent, small, synthetic a… (2011) | 74 | 0 | 28 | 2 | 0 | 0 | 2 | 10 | **32** | 0 |
| **Other** — Sulfated pentagalloylglucoside is a potent, a… (2013) | 110 | 0 | 54 | 4 | 0 | 0 | 2 | 16 | **34** | 1 |
| **Other** — Targeting the GPIbα Binding Site of Thrombin … (2014) | 31 | 0 | 6 | 1 | 0 | 0 | 3 | 7 | **14** | 0 |
| **Other** — Tumor cells express pauci-and oligomannosidic… (2021) | 35 | 0 | 4 | 1 | 0 | 0 | 2 | 6 | **22** | 5 |
| **Other** — Unique repertoire of anti-carbohydrate antibo… (2020) | 44 | 0 | 12 | 1 | 0 | 0 | 1 | 6 | **24** | 7 |
| **all works** | | | | | | | | | **704** | 131 |

Each work's own arithmetic is printed on the review page beside its name; the row above
is the same screen, not a second tally.

131 citations already have a PDF on file, held under `pending-papers/` until a
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
| `cit-000089` | Allosterism‐based simultaneous, dual anticoagulant and antiplatelet action: allosteric inhibitor targeting th… |
| `cit-000090` | Allosterism‐based simultaneous, dual anticoagulant and antiplatelet action: allosteric inhibitor targeting th… |
| `cit-000091` | Allosterism‐based simultaneous, dual anticoagulant and antiplatelet action: allosteric inhibitor targeting th… |
| `cit-000092` | Allosterism‐based simultaneous, dual anticoagulant and antiplatelet action: allosteric inhibitor targeting th… |
| `cit-000093` | Allosterism‐based simultaneous, dual anticoagulant and antiplatelet action: allosteric inhibitor targeting th… |
| `cit-000094` | Allosterism‐based simultaneous, dual anticoagulant and antiplatelet action: allosteric inhibitor targeting th… |
| `cit-000095` | Allosterism‐based simultaneous, dual anticoagulant and antiplatelet action: allosteric inhibitor targeting th… |
| `cit-000096` | Allosterism‐based simultaneous, dual anticoagulant and antiplatelet action: allosteric inhibitor targeting th… |
| `cit-000098` | Allosterism‐based simultaneous, dual anticoagulant and antiplatelet action: allosteric inhibitor targeting th… |
| `cit-000099` | Allosterism‐based simultaneous, dual anticoagulant and antiplatelet action: allosteric inhibitor targeting th… |
| `cit-000100` | Allosterism‐based simultaneous, dual anticoagulant and antiplatelet action: allosteric inhibitor targeting th… |
| `cit-000101` | Allosterism‐based simultaneous, dual anticoagulant and antiplatelet action: allosteric inhibitor targeting th… |
| `cit-000105` | Allosterism‐based simultaneous, dual anticoagulant and antiplatelet action: allosteric inhibitor targeting th… |
| `cit-000107` | Allosterism‐based simultaneous, dual anticoagulant and antiplatelet action: allosteric inhibitor targeting th… |
| `cit-000108` | Allosterism‐based simultaneous, dual anticoagulant and antiplatelet action: allosteric inhibitor targeting th… |
| `cit-000109` | Allosterism‐based simultaneous, dual anticoagulant and antiplatelet action: allosteric inhibitor targeting th… |
| `cit-000110` | Allosterism‐based simultaneous, dual anticoagulant and antiplatelet action: allosteric inhibitor targeting th… |
| `cit-000111` | Allosterism‐based simultaneous, dual anticoagulant and antiplatelet action: allosteric inhibitor targeting th… |
| `cit-000112` | Allosterism‐based simultaneous, dual anticoagulant and antiplatelet action: allosteric inhibitor targeting th… |
| `cit-000114` | Allosterism‐based simultaneous, dual anticoagulant and antiplatelet action: allosteric inhibitor targeting th… |
| `cit-000115` | Allosterism‐based simultaneous, dual anticoagulant and antiplatelet action: allosteric inhibitor targeting th… |
| `cit-000116` | Allosterism‐based simultaneous, dual anticoagulant and antiplatelet action: allosteric inhibitor targeting th… |
| `cit-000117` | Allosterism‐based simultaneous, dual anticoagulant and antiplatelet action: allosteric inhibitor targeting th… |
| `cit-000118` | Allosterism‐based simultaneous, dual anticoagulant and antiplatelet action: allosteric inhibitor targeting th… |
| `cit-000120` | Allosterism‐based simultaneous, dual anticoagulant and antiplatelet action: allosteric inhibitor targeting th… |
| `cit-000122` | Allosterism‐based simultaneous, dual anticoagulant and antiplatelet action: allosteric inhibitor targeting th… |
| `cit-000123` | Allosterism‐based simultaneous, dual anticoagulant and antiplatelet action: allosteric inhibitor targeting th… |
| `cit-000124` | Allosterism‐based simultaneous, dual anticoagulant and antiplatelet action: allosteric inhibitor targeting th… |
| `cit-000126` | Allosterism‐based simultaneous, dual anticoagulant and antiplatelet action: allosteric inhibitor targeting th… |
| `cit-000128` | Allosterism‐based simultaneous, dual anticoagulant and antiplatelet action: allosteric inhibitor targeting th… |
| `cit-000129` | Allosterism‐based simultaneous, dual anticoagulant and antiplatelet action: allosteric inhibitor targeting th… |
| `cit-000130` | Allosterism‐based simultaneous, dual anticoagulant and antiplatelet action: allosteric inhibitor targeting th… |
| `cit-000131` | Allosterism‐based simultaneous, dual anticoagulant and antiplatelet action: allosteric inhibitor targeting th… |
| `cit-000133` | Allosterism‐based simultaneous, dual anticoagulant and antiplatelet action: allosteric inhibitor targeting th… |
| `cit-000135` | Allosterism‐based simultaneous, dual anticoagulant and antiplatelet action: allosteric inhibitor targeting th… |
| `cit-000136` | Allosterism‐based simultaneous, dual anticoagulant and antiplatelet action: allosteric inhibitor targeting th… |
| `cit-000137` | Allosterism‐based simultaneous, dual anticoagulant and antiplatelet action: allosteric inhibitor targeting th… |
| `cit-000138` | Allosterism‐based simultaneous, dual anticoagulant and antiplatelet action: allosteric inhibitor targeting th… |
| `cit-000139` | Allosterism‐based simultaneous, dual anticoagulant and antiplatelet action: allosteric inhibitor targeting th… |
| `cit-000140` | Allosterism‐based simultaneous, dual anticoagulant and antiplatelet action: allosteric inhibitor targeting th… |
| `cit-000141` | Allosterism‐based simultaneous, dual anticoagulant and antiplatelet action: allosteric inhibitor targeting th… |
| `cit-000180` | Antigenic pressure on H3N2 influenza virus drift strains imposes constraints on binding to sialylated recepto… |
| `cit-000182` | Antigenic pressure on H3N2 influenza virus drift strains imposes constraints on binding to sialylated recepto… |
| `cit-000183` | Antigenic pressure on H3N2 influenza virus drift strains imposes constraints on binding to sialylated recepto… |
| `cit-000184` | Antigenic pressure on H3N2 influenza virus drift strains imposes constraints on binding to sialylated recepto… |
| `cit-000185` | Antigenic pressure on H3N2 influenza virus drift strains imposes constraints on binding to sialylated recepto… |
| `cit-000186` | Antigenic pressure on H3N2 influenza virus drift strains imposes constraints on binding to sialylated recepto… |
| `cit-000187` | Antigenic pressure on H3N2 influenza virus drift strains imposes constraints on binding to sialylated recepto… |
| `cit-000188` | Antigenic pressure on H3N2 influenza virus drift strains imposes constraints on binding to sialylated recepto… |
| `cit-000189` | Antigenic pressure on H3N2 influenza virus drift strains imposes constraints on binding to sialylated recepto… |
| `cit-000190` | Antigenic pressure on H3N2 influenza virus drift strains imposes constraints on binding to sialylated recepto… |
| `cit-000191` | Antigenic pressure on H3N2 influenza virus drift strains imposes constraints on binding to sialylated recepto… |
| `cit-000193` | Antigenic pressure on H3N2 influenza virus drift strains imposes constraints on binding to sialylated recepto… |
| `cit-000194` | Antigenic pressure on H3N2 influenza virus drift strains imposes constraints on binding to sialylated recepto… |
| `cit-000195` | Antigenic pressure on H3N2 influenza virus drift strains imposes constraints on binding to sialylated recepto… |
| `cit-000196` | Antigenic pressure on H3N2 influenza virus drift strains imposes constraints on binding to sialylated recepto… |
| `cit-000197` | Antigenic pressure on H3N2 influenza virus drift strains imposes constraints on binding to sialylated recepto… |
| `cit-000198` | Antigenic pressure on H3N2 influenza virus drift strains imposes constraints on binding to sialylated recepto… |
| `cit-000199` | Antigenic pressure on H3N2 influenza virus drift strains imposes constraints on binding to sialylated recepto… |
| `cit-000200` | Antigenic pressure on H3N2 influenza virus drift strains imposes constraints on binding to sialylated recepto… |
| `cit-000202` | Antigenic pressure on H3N2 influenza virus drift strains imposes constraints on binding to sialylated recepto… |
| `cit-000204` | Antigenic pressure on H3N2 influenza virus drift strains imposes constraints on binding to sialylated recepto… |
| `cit-000205` | Antigenic pressure on H3N2 influenza virus drift strains imposes constraints on binding to sialylated recepto… |
| `cit-000206` | Antigenic pressure on H3N2 influenza virus drift strains imposes constraints on binding to sialylated recepto… |
| `cit-000208` | Antigenic pressure on H3N2 influenza virus drift strains imposes constraints on binding to sialylated recepto… |
| `cit-000209` | Antigenic pressure on H3N2 influenza virus drift strains imposes constraints on binding to sialylated recepto… |
| `cit-000210` | Antigenic pressure on H3N2 influenza virus drift strains imposes constraints on binding to sialylated recepto… |
| `cit-000211` | Antigenic pressure on H3N2 influenza virus drift strains imposes constraints on binding to sialylated recepto… |
| `cit-000213` | Antigenic pressure on H3N2 influenza virus drift strains imposes constraints on binding to sialylated recepto… |
| `cit-000214` | Antigenic pressure on H3N2 influenza virus drift strains imposes constraints on binding to sialylated recepto… |
| `cit-000217` | Antigenic pressure on H3N2 influenza virus drift strains imposes constraints on binding to sialylated recepto… |
| `cit-000218` | Antigenic pressure on H3N2 influenza virus drift strains imposes constraints on binding to sialylated recepto… |
| `cit-000219` | Antigenic pressure on H3N2 influenza virus drift strains imposes constraints on binding to sialylated recepto… |
| `cit-000223` | Antigenic pressure on H3N2 influenza virus drift strains imposes constraints on binding to sialylated recepto… |
| `cit-000224` | Antigenic pressure on H3N2 influenza virus drift strains imposes constraints on binding to sialylated recepto… |
| `cit-000225` | Antigenic pressure on H3N2 influenza virus drift strains imposes constraints on binding to sialylated recepto… |
| `cit-000226` | Antigenic pressure on H3N2 influenza virus drift strains imposes constraints on binding to sialylated recepto… |
| `cit-000431` | Emerging patterns of tyrosine sulfation and O-glycosylation cross-talk and co-localization |
| `cit-000432` | Emerging patterns of tyrosine sulfation and O-glycosylation cross-talk and co-localization |
| `cit-000433` | Emerging patterns of tyrosine sulfation and O-glycosylation cross-talk and co-localization |
| `cit-000434` | Emerging patterns of tyrosine sulfation and O-glycosylation cross-talk and co-localization |
| `cit-000435` | Emerging patterns of tyrosine sulfation and O-glycosylation cross-talk and co-localization |
| `cit-000438` | Emerging patterns of tyrosine sulfation and O-glycosylation cross-talk and co-localization |
| `cit-000439` | Emerging patterns of tyrosine sulfation and O-glycosylation cross-talk and co-localization |
| `cit-000440` | Emerging patterns of tyrosine sulfation and O-glycosylation cross-talk and co-localization |
| `cit-000441` | Emerging patterns of tyrosine sulfation and O-glycosylation cross-talk and co-localization |
| `cit-000442` | Emerging patterns of tyrosine sulfation and O-glycosylation cross-talk and co-localization |
| `cit-000443` | Emerging patterns of tyrosine sulfation and O-glycosylation cross-talk and co-localization |
| `cit-000444` | Emerging patterns of tyrosine sulfation and O-glycosylation cross-talk and co-localization |
| `cit-000447` | Emerging patterns of tyrosine sulfation and O-glycosylation cross-talk and co-localization |
| `cit-000449` | Emerging patterns of tyrosine sulfation and O-glycosylation cross-talk and co-localization |
| `cit-000450` | Emerging patterns of tyrosine sulfation and O-glycosylation cross-talk and co-localization |
| `cit-000451` | Emerging patterns of tyrosine sulfation and O-glycosylation cross-talk and co-localization |
| `cit-000452` | Emerging patterns of tyrosine sulfation and O-glycosylation cross-talk and co-localization |
| `cit-000454` | Emerging patterns of tyrosine sulfation and O-glycosylation cross-talk and co-localization |
| `cit-000455` | Emerging patterns of tyrosine sulfation and O-glycosylation cross-talk and co-localization |
| `cit-000456` | Emerging patterns of tyrosine sulfation and O-glycosylation cross-talk and co-localization |
| `cit-000457` | Emerging patterns of tyrosine sulfation and O-glycosylation cross-talk and co-localization |
| `cit-000458` | Emerging patterns of tyrosine sulfation and O-glycosylation cross-talk and co-localization |
| `cit-000459` | Emerging patterns of tyrosine sulfation and O-glycosylation cross-talk and co-localization |
| `cit-000460` | Emerging patterns of tyrosine sulfation and O-glycosylation cross-talk and co-localization |
| `cit-000461` | Emerging patterns of tyrosine sulfation and O-glycosylation cross-talk and co-localization |
| `cit-000462` | Emerging patterns of tyrosine sulfation and O-glycosylation cross-talk and co-localization |
| `cit-000463` | Emerging patterns of tyrosine sulfation and O-glycosylation cross-talk and co-localization |
| `cit-000464` | Emerging patterns of tyrosine sulfation and O-glycosylation cross-talk and co-localization |
| `cit-000465` | Emerging patterns of tyrosine sulfation and O-glycosylation cross-talk and co-localization |
| `cit-000466` | Emerging patterns of tyrosine sulfation and O-glycosylation cross-talk and co-localization |
| `cit-000467` | Emerging patterns of tyrosine sulfation and O-glycosylation cross-talk and co-localization |
| `cit-000468` | Emerging patterns of tyrosine sulfation and O-glycosylation cross-talk and co-localization |
| `cit-000469` | Emerging patterns of tyrosine sulfation and O-glycosylation cross-talk and co-localization |
| `cit-000470` | Emerging patterns of tyrosine sulfation and O-glycosylation cross-talk and co-localization |
| `cit-000471` | Emerging patterns of tyrosine sulfation and O-glycosylation cross-talk and co-localization |
| `cit-000476` | Emerging patterns of tyrosine sulfation and O-glycosylation cross-talk and co-localization |
| `cit-000320` | Designing allosteric regulators of thrombin. Exosite 2 features multiple subsites that can be targeted by sul… |
| `cit-000321` | Designing allosteric regulators of thrombin. Exosite 2 features multiple subsites that can be targeted by sul… |
| `cit-000322` | Designing allosteric regulators of thrombin. Exosite 2 features multiple subsites that can be targeted by sul… |
| `cit-000323` | Designing allosteric regulators of thrombin. Exosite 2 features multiple subsites that can be targeted by sul… |
| `cit-000326` | Designing allosteric regulators of thrombin. Exosite 2 features multiple subsites that can be targeted by sul… |
| `cit-000327` | Designing allosteric regulators of thrombin. Exosite 2 features multiple subsites that can be targeted by sul… |
| `cit-000329` | Designing allosteric regulators of thrombin. Exosite 2 features multiple subsites that can be targeted by sul… |
| `cit-000330` | Designing allosteric regulators of thrombin. Exosite 2 features multiple subsites that can be targeted by sul… |
| `cit-000334` | Designing allosteric regulators of thrombin. Exosite 2 features multiple subsites that can be targeted by sul… |
| `cit-000338` | Designing allosteric regulators of thrombin. Exosite 2 features multiple subsites that can be targeted by sul… |
| `cit-000339` | Designing allosteric regulators of thrombin. Exosite 2 features multiple subsites that can be targeted by sul… |
| `cit-000340` | Designing allosteric regulators of thrombin. Exosite 2 features multiple subsites that can be targeted by sul… |
| `cit-000345` | Designing allosteric regulators of thrombin. Exosite 2 features multiple subsites that can be targeted by sul… |
| `cit-000346` | Designing allosteric regulators of thrombin. Exosite 2 features multiple subsites that can be targeted by sul… |
| `cit-000347` | Designing allosteric regulators of thrombin. Exosite 2 features multiple subsites that can be targeted by sul… |
| `cit-000352` | Designing allosteric regulators of thrombin. Exosite 2 features multiple subsites that can be targeted by sul… |
| `cit-000354` | Designing allosteric regulators of thrombin. Exosite 2 features multiple subsites that can be targeted by sul… |
| `cit-000357` | Designing allosteric regulators of thrombin. Exosite 2 features multiple subsites that can be targeted by sul… |
| `cit-000359` | Designing allosteric regulators of thrombin. Exosite 2 features multiple subsites that can be targeted by sul… |
| `cit-000360` | Designing allosteric regulators of thrombin. Exosite 2 features multiple subsites that can be targeted by sul… |
| `cit-000362` | Designing allosteric regulators of thrombin. Exosite 2 features multiple subsites that can be targeted by sul… |
| `cit-000363` | Designing allosteric regulators of thrombin. Exosite 2 features multiple subsites that can be targeted by sul… |
| `cit-000365` | Designing allosteric regulators of thrombin. Exosite 2 features multiple subsites that can be targeted by sul… |
| `cit-000368` | Designing allosteric regulators of thrombin. Exosite 2 features multiple subsites that can be targeted by sul… |
| `cit-000369` | Designing allosteric regulators of thrombin. Exosite 2 features multiple subsites that can be targeted by sul… |
| `cit-000370` | Designing allosteric regulators of thrombin. Exosite 2 features multiple subsites that can be targeted by sul… |
| `cit-000372` | Designing allosteric regulators of thrombin. Exosite 2 features multiple subsites that can be targeted by sul… |
| `cit-000373` | Designing allosteric regulators of thrombin. Exosite 2 features multiple subsites that can be targeted by sul… |
| `cit-000375` | Designing allosteric regulators of thrombin. Exosite 2 features multiple subsites that can be targeted by sul… |
| `cit-000376` | Designing allosteric regulators of thrombin. Exosite 2 features multiple subsites that can be targeted by sul… |
| `cit-000377` | Designing allosteric regulators of thrombin. Exosite 2 features multiple subsites that can be targeted by sul… |
| `cit-000378` | Designing allosteric regulators of thrombin. Exosite 2 features multiple subsites that can be targeted by sul… |
| `cit-000380` | Designing allosteric regulators of thrombin. Exosite 2 features multiple subsites that can be targeted by sul… |
| `cit-000382` | Designing allosteric regulators of thrombin. Exosite 2 features multiple subsites that can be targeted by sul… |
| `cit-000383` | Designing allosteric regulators of thrombin. Exosite 2 features multiple subsites that can be targeted by sul… |
| `cit-001037` | N-glycosylation of mannose receptor (CD206) regulates glycan binding by C-type lectin domains |
| `cit-001039` | N-glycosylation of mannose receptor (CD206) regulates glycan binding by C-type lectin domains |
| `cit-001040` | N-glycosylation of mannose receptor (CD206) regulates glycan binding by C-type lectin domains |
| `cit-001041` | N-glycosylation of mannose receptor (CD206) regulates glycan binding by C-type lectin domains |
| `cit-001042` | N-glycosylation of mannose receptor (CD206) regulates glycan binding by C-type lectin domains |
| `cit-001043` | N-glycosylation of mannose receptor (CD206) regulates glycan binding by C-type lectin domains |
| `cit-001044` | N-glycosylation of mannose receptor (CD206) regulates glycan binding by C-type lectin domains |
| `cit-001045` | N-glycosylation of mannose receptor (CD206) regulates glycan binding by C-type lectin domains |
| `cit-001046` | N-glycosylation of mannose receptor (CD206) regulates glycan binding by C-type lectin domains |
| `cit-001047` | N-glycosylation of mannose receptor (CD206) regulates glycan binding by C-type lectin domains |
| `cit-001048` | N-glycosylation of mannose receptor (CD206) regulates glycan binding by C-type lectin domains |
| `cit-001049` | N-glycosylation of mannose receptor (CD206) regulates glycan binding by C-type lectin domains |
| `cit-001050` | N-glycosylation of mannose receptor (CD206) regulates glycan binding by C-type lectin domains |
| `cit-001051` | N-glycosylation of mannose receptor (CD206) regulates glycan binding by C-type lectin domains |
| `cit-001052` | N-glycosylation of mannose receptor (CD206) regulates glycan binding by C-type lectin domains |
| `cit-001053` | N-glycosylation of mannose receptor (CD206) regulates glycan binding by C-type lectin domains |
| `cit-001054` | N-glycosylation of mannose receptor (CD206) regulates glycan binding by C-type lectin domains |
| `cit-001055` | N-glycosylation of mannose receptor (CD206) regulates glycan binding by C-type lectin domains |
| `cit-001056` | N-glycosylation of mannose receptor (CD206) regulates glycan binding by C-type lectin domains |
| `cit-001057` | N-glycosylation of mannose receptor (CD206) regulates glycan binding by C-type lectin domains |
| `cit-001058` | N-glycosylation of mannose receptor (CD206) regulates glycan binding by C-type lectin domains |
| `cit-001059` | N-glycosylation of mannose receptor (CD206) regulates glycan binding by C-type lectin domains |
| `cit-001060` | N-glycosylation of mannose receptor (CD206) regulates glycan binding by C-type lectin domains |
| `cit-001061` | N-glycosylation of mannose receptor (CD206) regulates glycan binding by C-type lectin domains |
| `cit-001062` | N-glycosylation of mannose receptor (CD206) regulates glycan binding by C-type lectin domains |
| `cit-001063` | N-glycosylation of mannose receptor (CD206) regulates glycan binding by C-type lectin domains |
| `cit-001064` | N-glycosylation of mannose receptor (CD206) regulates glycan binding by C-type lectin domains |
| `cit-001065` | N-glycosylation of mannose receptor (CD206) regulates glycan binding by C-type lectin domains |
| `cit-001066` | N-glycosylation of mannose receptor (CD206) regulates glycan binding by C-type lectin domains |
| `cit-001067` | N-glycosylation of mannose receptor (CD206) regulates glycan binding by C-type lectin domains |
| `cit-001068` | N-glycosylation of mannose receptor (CD206) regulates glycan binding by C-type lectin domains |
| `cit-001069` | N-glycosylation of mannose receptor (CD206) regulates glycan binding by C-type lectin domains |
| `cit-001070` | N-glycosylation of mannose receptor (CD206) regulates glycan binding by C-type lectin domains |
| `cit-001071` | N-glycosylation of mannose receptor (CD206) regulates glycan binding by C-type lectin domains |
| `cit-000394` | Differential recognition of oligomannose isomers by glycan-binding proteins involved in innate and adaptive i… |
| `cit-000395` | Differential recognition of oligomannose isomers by glycan-binding proteins involved in innate and adaptive i… |
| `cit-000396` | Differential recognition of oligomannose isomers by glycan-binding proteins involved in innate and adaptive i… |
| `cit-000397` | Differential recognition of oligomannose isomers by glycan-binding proteins involved in innate and adaptive i… |
| `cit-000398` | Differential recognition of oligomannose isomers by glycan-binding proteins involved in innate and adaptive i… |
| `cit-000400` | Differential recognition of oligomannose isomers by glycan-binding proteins involved in innate and adaptive i… |
| `cit-000401` | Differential recognition of oligomannose isomers by glycan-binding proteins involved in innate and adaptive i… |
| `cit-000402` | Differential recognition of oligomannose isomers by glycan-binding proteins involved in innate and adaptive i… |
| `cit-000403` | Differential recognition of oligomannose isomers by glycan-binding proteins involved in innate and adaptive i… |
| `cit-000404` | Differential recognition of oligomannose isomers by glycan-binding proteins involved in innate and adaptive i… |
| `cit-000405` | Differential recognition of oligomannose isomers by glycan-binding proteins involved in innate and adaptive i… |
| `cit-000406` | Differential recognition of oligomannose isomers by glycan-binding proteins involved in innate and adaptive i… |
| `cit-000407` | Differential recognition of oligomannose isomers by glycan-binding proteins involved in innate and adaptive i… |
| `cit-000409` | Differential recognition of oligomannose isomers by glycan-binding proteins involved in innate and adaptive i… |
| `cit-000410` | Differential recognition of oligomannose isomers by glycan-binding proteins involved in innate and adaptive i… |
| `cit-000411` | Differential recognition of oligomannose isomers by glycan-binding proteins involved in innate and adaptive i… |
| `cit-000412` | Differential recognition of oligomannose isomers by glycan-binding proteins involved in innate and adaptive i… |
| `cit-000413` | Differential recognition of oligomannose isomers by glycan-binding proteins involved in innate and adaptive i… |
| `cit-000414` | Differential recognition of oligomannose isomers by glycan-binding proteins involved in innate and adaptive i… |
| `cit-000415` | Differential recognition of oligomannose isomers by glycan-binding proteins involved in innate and adaptive i… |
| `cit-000417` | Differential recognition of oligomannose isomers by glycan-binding proteins involved in innate and adaptive i… |
| `cit-000418` | Differential recognition of oligomannose isomers by glycan-binding proteins involved in innate and adaptive i… |
| `cit-000419` | Differential recognition of oligomannose isomers by glycan-binding proteins involved in innate and adaptive i… |
| `cit-000420` | Differential recognition of oligomannose isomers by glycan-binding proteins involved in innate and adaptive i… |
| `cit-000421` | Differential recognition of oligomannose isomers by glycan-binding proteins involved in innate and adaptive i… |
| `cit-000423` | Differential recognition of oligomannose isomers by glycan-binding proteins involved in innate and adaptive i… |
| `cit-000424` | Differential recognition of oligomannose isomers by glycan-binding proteins involved in innate and adaptive i… |
| `cit-000425` | Differential recognition of oligomannose isomers by glycan-binding proteins involved in innate and adaptive i… |
| `cit-000426` | Differential recognition of oligomannose isomers by glycan-binding proteins involved in innate and adaptive i… |
| `cit-000427` | Differential recognition of oligomannose isomers by glycan-binding proteins involved in innate and adaptive i… |
| `cit-000428` | Differential recognition of oligomannose isomers by glycan-binding proteins involved in innate and adaptive i… |
| `cit-000429` | Differential recognition of oligomannose isomers by glycan-binding proteins involved in innate and adaptive i… |
| `cit-000430` | Differential recognition of oligomannose isomers by glycan-binding proteins involved in innate and adaptive i… |
| `cit-001515` | Unique repertoire of anti-carbohydrate antibodies in individual human serum |
| `cit-001517` | Unique repertoire of anti-carbohydrate antibodies in individual human serum |
| `cit-001519` | Unique repertoire of anti-carbohydrate antibodies in individual human serum |
| `cit-001521` | Unique repertoire of anti-carbohydrate antibodies in individual human serum |
| `cit-001523` | Unique repertoire of anti-carbohydrate antibodies in individual human serum |
| `cit-001525` | Unique repertoire of anti-carbohydrate antibodies in individual human serum |
| `cit-001526` | Unique repertoire of anti-carbohydrate antibodies in individual human serum |
| `cit-001527` | Unique repertoire of anti-carbohydrate antibodies in individual human serum |
| `cit-001530` | Unique repertoire of anti-carbohydrate antibodies in individual human serum |
| `cit-001531` | Unique repertoire of anti-carbohydrate antibodies in individual human serum |
| `cit-001532` | Unique repertoire of anti-carbohydrate antibodies in individual human serum |
| `cit-001533` | Unique repertoire of anti-carbohydrate antibodies in individual human serum |
| `cit-001534` | Unique repertoire of anti-carbohydrate antibodies in individual human serum |
| `cit-001535` | Unique repertoire of anti-carbohydrate antibodies in individual human serum |
| `cit-001536` | Unique repertoire of anti-carbohydrate antibodies in individual human serum |
| `cit-001537` | Unique repertoire of anti-carbohydrate antibodies in individual human serum |
| `cit-001538` | Unique repertoire of anti-carbohydrate antibodies in individual human serum |
| `cit-001540` | Unique repertoire of anti-carbohydrate antibodies in individual human serum |
| `cit-001541` | Unique repertoire of anti-carbohydrate antibodies in individual human serum |
| `cit-001542` | Unique repertoire of anti-carbohydrate antibodies in individual human serum |
| `cit-001545` | Unique repertoire of anti-carbohydrate antibodies in individual human serum |
| `cit-001546` | Unique repertoire of anti-carbohydrate antibodies in individual human serum |
| `cit-001547` | Unique repertoire of anti-carbohydrate antibodies in individual human serum |
| `cit-001548` | Unique repertoire of anti-carbohydrate antibodies in individual human serum |
| `cit-001549` | Unique repertoire of anti-carbohydrate antibodies in individual human serum |
| `cit-001550` | Unique repertoire of anti-carbohydrate antibodies in individual human serum |
| `cit-001551` | Unique repertoire of anti-carbohydrate antibodies in individual human serum |
| `cit-001552` | Unique repertoire of anti-carbohydrate antibodies in individual human serum |
| `cit-001553` | Unique repertoire of anti-carbohydrate antibodies in individual human serum |
| `cit-001554` | Unique repertoire of anti-carbohydrate antibodies in individual human serum |
| `cit-001557` | Unique repertoire of anti-carbohydrate antibodies in individual human serum |
| `cit-000042` | Allosteric partial inhibition of monomeric proteases. Sulfated coumarins induce regulation, not just inhibiti… |
| `cit-000043` | Allosteric partial inhibition of monomeric proteases. Sulfated coumarins induce regulation, not just inhibiti… |
| `cit-000044` | Allosteric partial inhibition of monomeric proteases. Sulfated coumarins induce regulation, not just inhibiti… |
| `cit-000045` | Allosteric partial inhibition of monomeric proteases. Sulfated coumarins induce regulation, not just inhibiti… |
| `cit-000046` | Allosteric partial inhibition of monomeric proteases. Sulfated coumarins induce regulation, not just inhibiti… |
| `cit-000047` | Allosteric partial inhibition of monomeric proteases. Sulfated coumarins induce regulation, not just inhibiti… |
| `cit-000050` | Allosteric partial inhibition of monomeric proteases. Sulfated coumarins induce regulation, not just inhibiti… |
| `cit-000051` | Allosteric partial inhibition of monomeric proteases. Sulfated coumarins induce regulation, not just inhibiti… |
| `cit-000053` | Allosteric partial inhibition of monomeric proteases. Sulfated coumarins induce regulation, not just inhibiti… |
| `cit-000054` | Allosteric partial inhibition of monomeric proteases. Sulfated coumarins induce regulation, not just inhibiti… |
| `cit-000056` | Allosteric partial inhibition of monomeric proteases. Sulfated coumarins induce regulation, not just inhibiti… |
| `cit-000057` | Allosteric partial inhibition of monomeric proteases. Sulfated coumarins induce regulation, not just inhibiti… |
| `cit-000059` | Allosteric partial inhibition of monomeric proteases. Sulfated coumarins induce regulation, not just inhibiti… |
| `cit-000061` | Allosteric partial inhibition of monomeric proteases. Sulfated coumarins induce regulation, not just inhibiti… |
| `cit-000062` | Allosteric partial inhibition of monomeric proteases. Sulfated coumarins induce regulation, not just inhibiti… |
| `cit-000063` | Allosteric partial inhibition of monomeric proteases. Sulfated coumarins induce regulation, not just inhibiti… |
| `cit-000064` | Allosteric partial inhibition of monomeric proteases. Sulfated coumarins induce regulation, not just inhibiti… |
| `cit-000065` | Allosteric partial inhibition of monomeric proteases. Sulfated coumarins induce regulation, not just inhibiti… |
| `cit-000066` | Allosteric partial inhibition of monomeric proteases. Sulfated coumarins induce regulation, not just inhibiti… |
| `cit-000069` | Allosteric partial inhibition of monomeric proteases. Sulfated coumarins induce regulation, not just inhibiti… |
| `cit-000072` | Allosteric partial inhibition of monomeric proteases. Sulfated coumarins induce regulation, not just inhibiti… |
| `cit-000073` | Allosteric partial inhibition of monomeric proteases. Sulfated coumarins induce regulation, not just inhibiti… |
| `cit-000075` | Allosteric partial inhibition of monomeric proteases. Sulfated coumarins induce regulation, not just inhibiti… |
| `cit-000079` | Allosteric partial inhibition of monomeric proteases. Sulfated coumarins induce regulation, not just inhibiti… |
| `cit-000080` | Allosteric partial inhibition of monomeric proteases. Sulfated coumarins induce regulation, not just inhibiti… |
| `cit-000081` | Allosteric partial inhibition of monomeric proteases. Sulfated coumarins induce regulation, not just inhibiti… |
| `cit-000083` | Allosteric partial inhibition of monomeric proteases. Sulfated coumarins induce regulation, not just inhibiti… |
| `cit-000084` | Allosteric partial inhibition of monomeric proteases. Sulfated coumarins induce regulation, not just inhibiti… |
| `cit-000085` | Allosteric partial inhibition of monomeric proteases. Sulfated coumarins induce regulation, not just inhibiti… |
| `cit-000087` | Allosteric partial inhibition of monomeric proteases. Sulfated coumarins induce regulation, not just inhibiti… |
| `cit-000088` | Allosteric partial inhibition of monomeric proteases. Sulfated coumarins induce regulation, not just inhibiti… |
| `cit-000001` | Allosteric inhibition of human factor XIa: discovery of monosulfated benzofurans as a class of promising inhi… |
| `cit-000002` | Allosteric inhibition of human factor XIa: discovery of monosulfated benzofurans as a class of promising inhi… |
| `cit-000003` | Allosteric inhibition of human factor XIa: discovery of monosulfated benzofurans as a class of promising inhi… |
| `cit-000004` | Allosteric inhibition of human factor XIa: discovery of monosulfated benzofurans as a class of promising inhi… |
| `cit-000006` | Allosteric inhibition of human factor XIa: discovery of monosulfated benzofurans as a class of promising inhi… |
| `cit-000007` | Allosteric inhibition of human factor XIa: discovery of monosulfated benzofurans as a class of promising inhi… |
| `cit-000008` | Allosteric inhibition of human factor XIa: discovery of monosulfated benzofurans as a class of promising inhi… |
| `cit-000009` | Allosteric inhibition of human factor XIa: discovery of monosulfated benzofurans as a class of promising inhi… |
| `cit-000010` | Allosteric inhibition of human factor XIa: discovery of monosulfated benzofurans as a class of promising inhi… |
| `cit-000013` | Allosteric inhibition of human factor XIa: discovery of monosulfated benzofurans as a class of promising inhi… |
| `cit-000015` | Allosteric inhibition of human factor XIa: discovery of monosulfated benzofurans as a class of promising inhi… |
| `cit-000016` | Allosteric inhibition of human factor XIa: discovery of monosulfated benzofurans as a class of promising inhi… |
| `cit-000017` | Allosteric inhibition of human factor XIa: discovery of monosulfated benzofurans as a class of promising inhi… |
| `cit-000019` | Allosteric inhibition of human factor XIa: discovery of monosulfated benzofurans as a class of promising inhi… |
| `cit-000021` | Allosteric inhibition of human factor XIa: discovery of monosulfated benzofurans as a class of promising inhi… |
| `cit-000024` | Allosteric inhibition of human factor XIa: discovery of monosulfated benzofurans as a class of promising inhi… |
| `cit-000025` | Allosteric inhibition of human factor XIa: discovery of monosulfated benzofurans as a class of promising inhi… |
| `cit-000026` | Allosteric inhibition of human factor XIa: discovery of monosulfated benzofurans as a class of promising inhi… |
| `cit-000027` | Allosteric inhibition of human factor XIa: discovery of monosulfated benzofurans as a class of promising inhi… |
| `cit-000028` | Allosteric inhibition of human factor XIa: discovery of monosulfated benzofurans as a class of promising inhi… |
| `cit-000029` | Allosteric inhibition of human factor XIa: discovery of monosulfated benzofurans as a class of promising inhi… |
| `cit-000030` | Allosteric inhibition of human factor XIa: discovery of monosulfated benzofurans as a class of promising inhi… |
| `cit-000031` | Allosteric inhibition of human factor XIa: discovery of monosulfated benzofurans as a class of promising inhi… |
| `cit-000033` | Allosteric inhibition of human factor XIa: discovery of monosulfated benzofurans as a class of promising inhi… |
| `cit-000034` | Allosteric inhibition of human factor XIa: discovery of monosulfated benzofurans as a class of promising inhi… |
| `cit-000035` | Allosteric inhibition of human factor XIa: discovery of monosulfated benzofurans as a class of promising inhi… |
| `cit-000036` | Allosteric inhibition of human factor XIa: discovery of monosulfated benzofurans as a class of promising inhi… |
| `cit-000039` | Allosteric inhibition of human factor XIa: discovery of monosulfated benzofurans as a class of promising inhi… |
| `cit-000040` | Allosteric inhibition of human factor XIa: discovery of monosulfated benzofurans as a class of promising inhi… |
| `cit-000041` | Allosteric inhibition of human factor XIa: discovery of monosulfated benzofurans as a class of promising inhi… |
| `cit-001476` | Tumor cells express pauci-and oligomannosidic N-glycans in glycoproteins recognized by the mannose receptor (… |
| `cit-001478` | Tumor cells express pauci-and oligomannosidic N-glycans in glycoproteins recognized by the mannose receptor (… |
| `cit-001479` | Tumor cells express pauci-and oligomannosidic N-glycans in glycoproteins recognized by the mannose receptor (… |
| `cit-001480` | Tumor cells express pauci-and oligomannosidic N-glycans in glycoproteins recognized by the mannose receptor (… |
| `cit-001482` | Tumor cells express pauci-and oligomannosidic N-glycans in glycoproteins recognized by the mannose receptor (… |
| `cit-001483` | Tumor cells express pauci-and oligomannosidic N-glycans in glycoproteins recognized by the mannose receptor (… |
| `cit-001484` | Tumor cells express pauci-and oligomannosidic N-glycans in glycoproteins recognized by the mannose receptor (… |
| `cit-001485` | Tumor cells express pauci-and oligomannosidic N-glycans in glycoproteins recognized by the mannose receptor (… |
| `cit-001486` | Tumor cells express pauci-and oligomannosidic N-glycans in glycoproteins recognized by the mannose receptor (… |
| `cit-001488` | Tumor cells express pauci-and oligomannosidic N-glycans in glycoproteins recognized by the mannose receptor (… |
| `cit-001489` | Tumor cells express pauci-and oligomannosidic N-glycans in glycoproteins recognized by the mannose receptor (… |
| `cit-001490` | Tumor cells express pauci-and oligomannosidic N-glycans in glycoproteins recognized by the mannose receptor (… |
| `cit-001491` | Tumor cells express pauci-and oligomannosidic N-glycans in glycoproteins recognized by the mannose receptor (… |
| `cit-001492` | Tumor cells express pauci-and oligomannosidic N-glycans in glycoproteins recognized by the mannose receptor (… |
| `cit-001493` | Tumor cells express pauci-and oligomannosidic N-glycans in glycoproteins recognized by the mannose receptor (… |
| `cit-001495` | Tumor cells express pauci-and oligomannosidic N-glycans in glycoproteins recognized by the mannose receptor (… |
| `cit-001496` | Tumor cells express pauci-and oligomannosidic N-glycans in glycoproteins recognized by the mannose receptor (… |
| `cit-001497` | Tumor cells express pauci-and oligomannosidic N-glycans in glycoproteins recognized by the mannose receptor (… |
| `cit-001498` | Tumor cells express pauci-and oligomannosidic N-glycans in glycoproteins recognized by the mannose receptor (… |
| `cit-001499` | Tumor cells express pauci-and oligomannosidic N-glycans in glycoproteins recognized by the mannose receptor (… |
| `cit-001500` | Tumor cells express pauci-and oligomannosidic N-glycans in glycoproteins recognized by the mannose receptor (… |
| `cit-001501` | Tumor cells express pauci-and oligomannosidic N-glycans in glycoproteins recognized by the mannose receptor (… |
| `cit-001502` | Tumor cells express pauci-and oligomannosidic N-glycans in glycoproteins recognized by the mannose receptor (… |
| `cit-001503` | Tumor cells express pauci-and oligomannosidic N-glycans in glycoproteins recognized by the mannose receptor (… |
| `cit-001504` | Tumor cells express pauci-and oligomannosidic N-glycans in glycoproteins recognized by the mannose receptor (… |
| `cit-001505` | Tumor cells express pauci-and oligomannosidic N-glycans in glycoproteins recognized by the mannose receptor (… |
| `cit-001506` | Tumor cells express pauci-and oligomannosidic N-glycans in glycoproteins recognized by the mannose receptor (… |
| `cit-001507` | Tumor cells express pauci-and oligomannosidic N-glycans in glycoproteins recognized by the mannose receptor (… |
| `cit-001508` | Tumor cells express pauci-and oligomannosidic N-glycans in glycoproteins recognized by the mannose receptor (… |
| `cit-001509` | Tumor cells express pauci-and oligomannosidic N-glycans in glycoproteins recognized by the mannose receptor (… |
| `cit-000145` | An update on recent patents on thrombin inhibitors (2010-2013) |
| `cit-000146` | An update on recent patents on thrombin inhibitors (2010-2013) |
| `cit-000147` | An update on recent patents on thrombin inhibitors (2010-2013) |
| `cit-000148` | An update on recent patents on thrombin inhibitors (2010-2013) |
| `cit-000149` | An update on recent patents on thrombin inhibitors (2010-2013) |
| `cit-000150` | An update on recent patents on thrombin inhibitors (2010-2013) |
| `cit-000151` | An update on recent patents on thrombin inhibitors (2010-2013) |
| `cit-000152` | An update on recent patents on thrombin inhibitors (2010-2013) |
| `cit-000153` | An update on recent patents on thrombin inhibitors (2010-2013) |
| `cit-000154` | An update on recent patents on thrombin inhibitors (2010-2013) |
| `cit-000155` | An update on recent patents on thrombin inhibitors (2010-2013) |
| `cit-000156` | An update on recent patents on thrombin inhibitors (2010-2013) |
| `cit-000157` | An update on recent patents on thrombin inhibitors (2010-2013) |
| `cit-000158` | An update on recent patents on thrombin inhibitors (2010-2013) |
| `cit-000159` | An update on recent patents on thrombin inhibitors (2010-2013) |
| `cit-000160` | An update on recent patents on thrombin inhibitors (2010-2013) |
| `cit-000161` | An update on recent patents on thrombin inhibitors (2010-2013) |
| `cit-000162` | An update on recent patents on thrombin inhibitors (2010-2013) |
| `cit-000163` | An update on recent patents on thrombin inhibitors (2010-2013) |
| `cit-000165` | An update on recent patents on thrombin inhibitors (2010-2013) |
| `cit-000166` | An update on recent patents on thrombin inhibitors (2010-2013) |
| `cit-000167` | An update on recent patents on thrombin inhibitors (2010-2013) |
| `cit-000168` | An update on recent patents on thrombin inhibitors (2010-2013) |
| `cit-000169` | An update on recent patents on thrombin inhibitors (2010-2013) |
| `cit-000170` | An update on recent patents on thrombin inhibitors (2010-2013) |
| `cit-000171` | An update on recent patents on thrombin inhibitors (2010-2013) |
| `cit-000174` | An update on recent patents on thrombin inhibitors (2010-2013) |
| `cit-000177` | An update on recent patents on thrombin inhibitors (2010-2013) |
| `cit-001000` | Interaction of thrombin with sucrose octasulfate |
| `cit-001001` | Interaction of thrombin with sucrose octasulfate |
| `cit-001002` | Interaction of thrombin with sucrose octasulfate |
| `cit-001007` | Interaction of thrombin with sucrose octasulfate |
| `cit-001009` | Interaction of thrombin with sucrose octasulfate |
| `cit-001011` | Interaction of thrombin with sucrose octasulfate |
| `cit-001013` | Interaction of thrombin with sucrose octasulfate |
| `cit-001014` | Interaction of thrombin with sucrose octasulfate |
| `cit-001015` | Interaction of thrombin with sucrose octasulfate |
| `cit-001018` | Interaction of thrombin with sucrose octasulfate |
| `cit-001019` | Interaction of thrombin with sucrose octasulfate |
| `cit-001021` | Interaction of thrombin with sucrose octasulfate |
| `cit-001022` | Interaction of thrombin with sucrose octasulfate |
| `cit-001023` | Interaction of thrombin with sucrose octasulfate |
| `cit-001025` | Interaction of thrombin with sucrose octasulfate |
| `cit-001026` | Interaction of thrombin with sucrose octasulfate |
| `cit-001027` | Interaction of thrombin with sucrose octasulfate |
| `cit-001028` | Interaction of thrombin with sucrose octasulfate |
| `cit-001029` | Interaction of thrombin with sucrose octasulfate |
| `cit-001030` | Interaction of thrombin with sucrose octasulfate |
| `cit-001031` | Interaction of thrombin with sucrose octasulfate |
| `cit-001032` | Interaction of thrombin with sucrose octasulfate |
| `cit-001034` | Interaction of thrombin with sucrose octasulfate |
| `cit-001036` | Interaction of thrombin with sucrose octasulfate |
| `cit-001427` | Targeting the GPIbα Binding Site of Thrombin To Simultaneously Induce Dual Anticoagulant and Antiplatelet Eff… |
| `cit-001429` | Targeting the GPIbα Binding Site of Thrombin To Simultaneously Induce Dual Anticoagulant and Antiplatelet Eff… |
| `cit-001432` | Targeting the GPIbα Binding Site of Thrombin To Simultaneously Induce Dual Anticoagulant and Antiplatelet Eff… |
| `cit-001433` | Targeting the GPIbα Binding Site of Thrombin To Simultaneously Induce Dual Anticoagulant and Antiplatelet Eff… |
| `cit-001434` | Targeting the GPIbα Binding Site of Thrombin To Simultaneously Induce Dual Anticoagulant and Antiplatelet Eff… |
| `cit-001436` | Targeting the GPIbα Binding Site of Thrombin To Simultaneously Induce Dual Anticoagulant and Antiplatelet Eff… |
| `cit-001437` | Targeting the GPIbα Binding Site of Thrombin To Simultaneously Induce Dual Anticoagulant and Antiplatelet Eff… |
| `cit-001438` | Targeting the GPIbα Binding Site of Thrombin To Simultaneously Induce Dual Anticoagulant and Antiplatelet Eff… |
| `cit-001439` | Targeting the GPIbα Binding Site of Thrombin To Simultaneously Induce Dual Anticoagulant and Antiplatelet Eff… |
| `cit-001440` | Targeting the GPIbα Binding Site of Thrombin To Simultaneously Induce Dual Anticoagulant and Antiplatelet Eff… |
| `cit-001442` | Targeting the GPIbα Binding Site of Thrombin To Simultaneously Induce Dual Anticoagulant and Antiplatelet Eff… |
| `cit-001443` | Targeting the GPIbα Binding Site of Thrombin To Simultaneously Induce Dual Anticoagulant and Antiplatelet Eff… |
| `cit-001444` | Targeting the GPIbα Binding Site of Thrombin To Simultaneously Induce Dual Anticoagulant and Antiplatelet Eff… |
| `cit-001445` | Targeting the GPIbα Binding Site of Thrombin To Simultaneously Induce Dual Anticoagulant and Antiplatelet Eff… |
| `cit-001447` | Targeting the GPIbα Binding Site of Thrombin To Simultaneously Induce Dual Anticoagulant and Antiplatelet Eff… |
| `cit-001448` | Targeting the GPIbα Binding Site of Thrombin To Simultaneously Induce Dual Anticoagulant and Antiplatelet Eff… |
| `cit-001449` | Targeting the GPIbα Binding Site of Thrombin To Simultaneously Induce Dual Anticoagulant and Antiplatelet Eff… |
| `cit-001450` | Targeting the GPIbα Binding Site of Thrombin To Simultaneously Induce Dual Anticoagulant and Antiplatelet Eff… |
| `cit-001451` | Targeting the GPIbα Binding Site of Thrombin To Simultaneously Induce Dual Anticoagulant and Antiplatelet Eff… |
| `cit-001452` | Targeting the GPIbα Binding Site of Thrombin To Simultaneously Induce Dual Anticoagulant and Antiplatelet Eff… |
| `cit-001453` | Targeting the GPIbα Binding Site of Thrombin To Simultaneously Induce Dual Anticoagulant and Antiplatelet Eff… |
| `cit-001454` | Targeting the GPIbα Binding Site of Thrombin To Simultaneously Induce Dual Anticoagulant and Antiplatelet Eff… |
| `cit-001455` | Targeting the GPIbα Binding Site of Thrombin To Simultaneously Induce Dual Anticoagulant and Antiplatelet Eff… |
| `cit-001457` | Targeting the GPIbα Binding Site of Thrombin To Simultaneously Induce Dual Anticoagulant and Antiplatelet Eff… |
| `cit-001127` | Potent direct inhibitors of factor Xa based on the tetrahydroisoquinoline scaffold |
| `cit-001128` | Potent direct inhibitors of factor Xa based on the tetrahydroisoquinoline scaffold |
| `cit-001129` | Potent direct inhibitors of factor Xa based on the tetrahydroisoquinoline scaffold |
| `cit-001130` | Potent direct inhibitors of factor Xa based on the tetrahydroisoquinoline scaffold |
| `cit-001133` | Potent direct inhibitors of factor Xa based on the tetrahydroisoquinoline scaffold |
| `cit-001134` | Potent direct inhibitors of factor Xa based on the tetrahydroisoquinoline scaffold |
| `cit-001135` | Potent direct inhibitors of factor Xa based on the tetrahydroisoquinoline scaffold |
| `cit-001139` | Potent direct inhibitors of factor Xa based on the tetrahydroisoquinoline scaffold |
| `cit-001140` | Potent direct inhibitors of factor Xa based on the tetrahydroisoquinoline scaffold |
| `cit-001142` | Potent direct inhibitors of factor Xa based on the tetrahydroisoquinoline scaffold |
| `cit-001143` | Potent direct inhibitors of factor Xa based on the tetrahydroisoquinoline scaffold |
| `cit-001144` | Potent direct inhibitors of factor Xa based on the tetrahydroisoquinoline scaffold |
| `cit-001145` | Potent direct inhibitors of factor Xa based on the tetrahydroisoquinoline scaffold |
| `cit-001146` | Potent direct inhibitors of factor Xa based on the tetrahydroisoquinoline scaffold |
| `cit-001147` | Potent direct inhibitors of factor Xa based on the tetrahydroisoquinoline scaffold |
| `cit-001148` | Potent direct inhibitors of factor Xa based on the tetrahydroisoquinoline scaffold |
| `cit-001149` | Potent direct inhibitors of factor Xa based on the tetrahydroisoquinoline scaffold |
| `cit-001151` | Potent direct inhibitors of factor Xa based on the tetrahydroisoquinoline scaffold |
| `cit-001152` | Potent direct inhibitors of factor Xa based on the tetrahydroisoquinoline scaffold |
| `cit-001153` | Potent direct inhibitors of factor Xa based on the tetrahydroisoquinoline scaffold |
| `cit-001154` | Potent direct inhibitors of factor Xa based on the tetrahydroisoquinoline scaffold |
| `cit-001155` | Potent direct inhibitors of factor Xa based on the tetrahydroisoquinoline scaffold |
| `cit-001157` | Potent direct inhibitors of factor Xa based on the tetrahydroisoquinoline scaffold |
| `cit-000246` | Chemokine binding to PSGL-1 is controlled by O-glycosylation and tyrosine sulfation |
| `cit-000248` | Chemokine binding to PSGL-1 is controlled by O-glycosylation and tyrosine sulfation |
| `cit-000249` | Chemokine binding to PSGL-1 is controlled by O-glycosylation and tyrosine sulfation |
| `cit-000250` | Chemokine binding to PSGL-1 is controlled by O-glycosylation and tyrosine sulfation |
| `cit-000251` | Chemokine binding to PSGL-1 is controlled by O-glycosylation and tyrosine sulfation |
| `cit-000253` | Chemokine binding to PSGL-1 is controlled by O-glycosylation and tyrosine sulfation |
| `cit-000254` | Chemokine binding to PSGL-1 is controlled by O-glycosylation and tyrosine sulfation |
| `cit-000255` | Chemokine binding to PSGL-1 is controlled by O-glycosylation and tyrosine sulfation |
| `cit-000256` | Chemokine binding to PSGL-1 is controlled by O-glycosylation and tyrosine sulfation |
| `cit-000257` | Chemokine binding to PSGL-1 is controlled by O-glycosylation and tyrosine sulfation |
| `cit-000258` | Chemokine binding to PSGL-1 is controlled by O-glycosylation and tyrosine sulfation |
| `cit-000260` | Chemokine binding to PSGL-1 is controlled by O-glycosylation and tyrosine sulfation |
| `cit-000261` | Chemokine binding to PSGL-1 is controlled by O-glycosylation and tyrosine sulfation |
| `cit-000262` | Chemokine binding to PSGL-1 is controlled by O-glycosylation and tyrosine sulfation |
| `cit-000263` | Chemokine binding to PSGL-1 is controlled by O-glycosylation and tyrosine sulfation |
| `cit-000264` | Chemokine binding to PSGL-1 is controlled by O-glycosylation and tyrosine sulfation |
| `cit-000266` | Chemokine binding to PSGL-1 is controlled by O-glycosylation and tyrosine sulfation |
| `cit-000268` | Chemokine binding to PSGL-1 is controlled by O-glycosylation and tyrosine sulfation |
| `cit-000269` | Chemokine binding to PSGL-1 is controlled by O-glycosylation and tyrosine sulfation |
| `cit-000270` | Chemokine binding to PSGL-1 is controlled by O-glycosylation and tyrosine sulfation |
| `cit-000271` | Chemokine binding to PSGL-1 is controlled by O-glycosylation and tyrosine sulfation |
| `cit-000949` | Increased Galectin-9 Levels Correlate with Disease Activity in Patients with DMARD-Naïve Rheumatoid Arthritis… |
| `cit-000950` | Increased Galectin-9 Levels Correlate with Disease Activity in Patients with DMARD-Naïve Rheumatoid Arthritis… |
| `cit-000951` | Increased Galectin-9 Levels Correlate with Disease Activity in Patients with DMARD-Naïve Rheumatoid Arthritis… |
| `cit-000952` | Increased Galectin-9 Levels Correlate with Disease Activity in Patients with DMARD-Naïve Rheumatoid Arthritis… |
| `cit-000953` | Increased Galectin-9 Levels Correlate with Disease Activity in Patients with DMARD-Naïve Rheumatoid Arthritis… |
| `cit-000954` | Increased Galectin-9 Levels Correlate with Disease Activity in Patients with DMARD-Naïve Rheumatoid Arthritis… |
| `cit-000955` | Increased Galectin-9 Levels Correlate with Disease Activity in Patients with DMARD-Naïve Rheumatoid Arthritis… |
| `cit-000956` | Increased Galectin-9 Levels Correlate with Disease Activity in Patients with DMARD-Naïve Rheumatoid Arthritis… |
| `cit-000957` | Increased Galectin-9 Levels Correlate with Disease Activity in Patients with DMARD-Naïve Rheumatoid Arthritis… |
| `cit-000958` | Increased Galectin-9 Levels Correlate with Disease Activity in Patients with DMARD-Naïve Rheumatoid Arthritis… |
| `cit-000959` | Increased Galectin-9 Levels Correlate with Disease Activity in Patients with DMARD-Naïve Rheumatoid Arthritis… |
| `cit-000960` | Increased Galectin-9 Levels Correlate with Disease Activity in Patients with DMARD-Naïve Rheumatoid Arthritis… |
| `cit-000961` | Increased Galectin-9 Levels Correlate with Disease Activity in Patients with DMARD-Naïve Rheumatoid Arthritis… |
| `cit-000962` | Increased Galectin-9 Levels Correlate with Disease Activity in Patients with DMARD-Naïve Rheumatoid Arthritis… |
| `cit-000963` | Increased Galectin-9 Levels Correlate with Disease Activity in Patients with DMARD-Naïve Rheumatoid Arthritis… |
| `cit-000965` | Increased Galectin-9 Levels Correlate with Disease Activity in Patients with DMARD-Naïve Rheumatoid Arthritis… |
| `cit-000966` | Increased Galectin-9 Levels Correlate with Disease Activity in Patients with DMARD-Naïve Rheumatoid Arthritis… |
| `cit-001082` | Novel reversible fluorescent glycan linker for functional glycomics |
| `cit-001087` | Novel reversible fluorescent glycan linker for functional glycomics |
| `cit-001089` | Novel reversible fluorescent glycan linker for functional glycomics |
| `cit-001090` | Novel reversible fluorescent glycan linker for functional glycomics |
| `cit-001091` | Novel reversible fluorescent glycan linker for functional glycomics |
| `cit-001092` | Novel reversible fluorescent glycan linker for functional glycomics |
| `cit-001094` | Novel reversible fluorescent glycan linker for functional glycomics |
| `cit-001095` | Novel reversible fluorescent glycan linker for functional glycomics |
| `cit-001096` | Novel reversible fluorescent glycan linker for functional glycomics |
| `cit-001097` | Novel reversible fluorescent glycan linker for functional glycomics |
| `cit-001098` | Novel reversible fluorescent glycan linker for functional glycomics |
| `cit-001099` | Novel reversible fluorescent glycan linker for functional glycomics |
| `cit-001100` | Novel reversible fluorescent glycan linker for functional glycomics |
| `cit-001101` | Novel reversible fluorescent glycan linker for functional glycomics |
| `cit-001102` | Novel reversible fluorescent glycan linker for functional glycomics |
| `cit-000933` | Heparan sulfate glycomimetics via iterative assembly of “clickable” disaccharides |
| `cit-000934` | Heparan sulfate glycomimetics via iterative assembly of “clickable” disaccharides |
| `cit-000935` | Heparan sulfate glycomimetics via iterative assembly of “clickable” disaccharides |
| `cit-000936` | Heparan sulfate glycomimetics via iterative assembly of “clickable” disaccharides |
| `cit-000938` | Heparan sulfate glycomimetics via iterative assembly of “clickable” disaccharides |
| `cit-000939` | Heparan sulfate glycomimetics via iterative assembly of “clickable” disaccharides |
| `cit-000940` | Heparan sulfate glycomimetics via iterative assembly of “clickable” disaccharides |
| `cit-000941` | Heparan sulfate glycomimetics via iterative assembly of “clickable” disaccharides |
| `cit-000942` | Heparan sulfate glycomimetics via iterative assembly of “clickable” disaccharides |
| `cit-000943` | Heparan sulfate glycomimetics via iterative assembly of “clickable” disaccharides |
| `cit-000944` | Heparan sulfate glycomimetics via iterative assembly of “clickable” disaccharides |
| `cit-000945` | Heparan sulfate glycomimetics via iterative assembly of “clickable” disaccharides |
| `cit-000946` | Heparan sulfate glycomimetics via iterative assembly of “clickable” disaccharides |
| `cit-000947` | Heparan sulfate glycomimetics via iterative assembly of “clickable” disaccharides |
| `cit-000948` | Heparan sulfate glycomimetics via iterative assembly of “clickable” disaccharides |
| `cit-000305` | Design, Synthesis, and Investigation of Novel Nitric Oxide (NO)-Releasing Prodrugs as Drug Candidates for the… |
| `cit-000306` | Design, Synthesis, and Investigation of Novel Nitric Oxide (NO)-Releasing Prodrugs as Drug Candidates for the… |
| `cit-000307` | Design, Synthesis, and Investigation of Novel Nitric Oxide (NO)-Releasing Prodrugs as Drug Candidates for the… |
| `cit-000309` | Design, Synthesis, and Investigation of Novel Nitric Oxide (NO)-Releasing Prodrugs as Drug Candidates for the… |
| `cit-000310` | Design, Synthesis, and Investigation of Novel Nitric Oxide (NO)-Releasing Prodrugs as Drug Candidates for the… |
| `cit-000311` | Design, Synthesis, and Investigation of Novel Nitric Oxide (NO)-Releasing Prodrugs as Drug Candidates for the… |
| `cit-000313` | Design, Synthesis, and Investigation of Novel Nitric Oxide (NO)-Releasing Prodrugs as Drug Candidates for the… |
| `cit-000316` | Design, Synthesis, and Investigation of Novel Nitric Oxide (NO)-Releasing Prodrugs as Drug Candidates for the… |
| `cit-000319` | Design, Synthesis, and Investigation of Novel Nitric Oxide (NO)-Releasing Prodrugs as Drug Candidates for the… |
| `cit-000487` | Galectin-3 Decreases 4-1BBL Bioactivity by Crosslinking Soluble and Membrane Expressed 4-1BB |
| `cit-000488` | Galectin-3 Decreases 4-1BBL Bioactivity by Crosslinking Soluble and Membrane Expressed 4-1BB |
| `cit-000491` | Galectin-3 Decreases 4-1BBL Bioactivity by Crosslinking Soluble and Membrane Expressed 4-1BB |
| `cit-000492` | Galectin-3 Decreases 4-1BBL Bioactivity by Crosslinking Soluble and Membrane Expressed 4-1BB |
| `cit-000493` | Galectin-3 Decreases 4-1BBL Bioactivity by Crosslinking Soluble and Membrane Expressed 4-1BB |
| `cit-000496` | Galectin-3 Decreases 4-1BBL Bioactivity by Crosslinking Soluble and Membrane Expressed 4-1BB |
| `cit-000497` | Galectin-3 Decreases 4-1BBL Bioactivity by Crosslinking Soluble and Membrane Expressed 4-1BB |
| `cit-000498` | Galectin-3 Decreases 4-1BBL Bioactivity by Crosslinking Soluble and Membrane Expressed 4-1BB |
| `cit-000500` | Galectin-3 Decreases 4-1BBL Bioactivity by Crosslinking Soluble and Membrane Expressed 4-1BB |
| `cit-000229` | Chemoenzymatically Prepared Heparan Sulfate Containing Rare 2-O-Sulfonated Glucuronic Acid Residues |
| `cit-000230` | Chemoenzymatically Prepared Heparan Sulfate Containing Rare 2-O-Sulfonated Glucuronic Acid Residues |
| `cit-000232` | Chemoenzymatically Prepared Heparan Sulfate Containing Rare 2-O-Sulfonated Glucuronic Acid Residues |
| `cit-000235` | Chemoenzymatically Prepared Heparan Sulfate Containing Rare 2-O-Sulfonated Glucuronic Acid Residues |
| `cit-000236` | Chemoenzymatically Prepared Heparan Sulfate Containing Rare 2-O-Sulfonated Glucuronic Acid Residues |
| `cit-000240` | Chemoenzymatically Prepared Heparan Sulfate Containing Rare 2-O-Sulfonated Glucuronic Acid Residues |
| `cit-000241` | Chemoenzymatically Prepared Heparan Sulfate Containing Rare 2-O-Sulfonated Glucuronic Acid Residues |
| `cit-000244` | Chemoenzymatically Prepared Heparan Sulfate Containing Rare 2-O-Sulfonated Glucuronic Acid Residues |

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
| reference-number resolution | 179 | 104 |
| extracted text | 4 | 3 |

A resolved citation is held to the same bar as one that names the tool: it must sit in
prose, under a heading the citing paper itself printed, and not in the bibliography entry
that names the applicant's paper — a reference list proves only that the author cited the
work, not where or how. Where a row's tier rests on such a citation, that is said in the
report rather than left for a reader to infer from a section heading alone.

179 mentions across 104 citing works rest on resolution or on a person’s
reading, not on a named-tool scan. `scan-mentions.js` reports those rows separately and
leaves their tier alone — it is not built to find them, so its silence is not evidence
against them.

Resolution also reached 22 citation(s) on rows the packet has already screened
out. Those rows stay out: each was screened for a reason the citation does not answer
— one is not independent, the other was already submitted with the original application
— and a stronger citation cannot undo either. They are recorded rather than dropped so
the decision can be re-examined if the reason for it changes.

### 5.6 How each PDF got here, and what is still missing

Every PDF in the storage roots (`papers/`, `pending-papers/`, `screened-papers/`) arrived
one of three ways, and the distinction matters because only the first two are reproducible
from a script.

**Fetched by `discover-pdfs.js`** — 200 candidate row(s) across 181 distinct file(s), each recorded with the host it came from:

| host | rows | row_uid(s) |
|---|---:|---|
| www.mdpi.com | 60 | `cit-000513`, `cit-000550`, `cit-000592`, `cit-000606`, `cit-000626`, `cit-000660`, `cit-000706`, `cit-000721`, `cit-000757`, `cit-000770`, `cit-000780`, `cit-000795`, `cit-000800`, `cit-000804`, `cit-000821`, `cit-001303`, `cit-001186`, `cit-000092`, `cit-000093`, `cit-000112`, `cit-000116`, `cit-000193`, `cit-000206`, `cit-000432`, `cit-000454`, `cit-000459`, `cit-000352`, `cit-001050`, `cit-000405`, `cit-000409`, `cit-000417`, `cit-000421`, `cit-000423`, `cit-001535`, `cit-001536`, `cit-001537`, `cit-001547`, `cit-001548`, `cit-001553`, `cit-000042`, `cit-000045`, `cit-000053`, `cit-001491`, `cit-001496`, `cit-001498`, `cit-000152`, `cit-001438`, `cit-001129`, `cit-001139`, `cit-000911`, `cit-000913`, `cit-000951`, `cit-000957`, `cit-000961`, `cit-000962`, `cit-001463`, `cit-001466`, `cit-000307`, `cit-000493`, `cit-000498` |
| www.nature.com | 33 | `cit-000510`, `cit-000511`, `cit-000596`, `cit-000600`, `cit-000654`, `cit-000665`, `cit-000666`, `cit-000689`, `cit-000693`, `cit-000695`, `cit-000696`, `cit-000727`, `cit-000744`, `cit-000799`, `cit-000185`, `cit-000188`, `cit-000191`, `cit-000442`, `cit-000449`, `cit-000460`, `cit-000330`, `cit-001041`, `cit-001048`, `cit-001051`, `cit-001070`, `cit-001517`, `cit-000006`, `cit-001483`, `cit-000248`, `cit-000250`, `cit-001108`, `cit-001460`, `cit-000487` |
| www.frontiersin.org | 20 | `cit-000520`, `cit-000593`, `cit-000607`, `cit-000715`, `cit-000730`, `cit-000731`, `cit-000844`, `cit-001287`, `cit-000455`, `cit-001042`, `cit-001055`, `cit-001057`, `cit-001515`, `cit-001525`, `cit-001534`, `cit-001116`, `cit-000955`, `cit-001090`, `cit-001467`, `cit-000305` |
| www.biorxiv.org | 19 | `cit-000631`, `cit-000633`, `cit-000683`, `cit-000742`, `cit-000832`, `cit-000833`, `cit-000843`, `cit-000108`, `cit-000202`, `cit-000217`, `cit-000465`, `cit-000414`, `cit-000420`, `cit-000424`, `cit-000263`, `cit-000924`, `cit-001121`, `cit-001098`, `cit-001471` |
| (no source recorded) | 15 | `cit-000507`, `cit-000523`, `cit-000525`, `cit-000531`, `cit-000532`, `cit-000534`, `cit-000549`, `cit-000554`, `cit-000564`, `cit-000566`, `cit-000581`, `cit-000614`, `cit-000621`, `cit-000623`, `cit-001263` |
| link.springer.com | 13 | `cit-000589`, `cit-000605`, `cit-000622`, `cit-000707`, `cit-000713`, `cit-000737`, `cit-000782`, `cit-000802`, `cit-001302`, `cit-001532`, `cit-000246`, `cit-000959`, `cit-000960` |
| journals.plos.org | 3 | `cit-000741`, `cit-000182`, `cit-001497` |
| www.intechopen.com | 2 | `cit-000536`, `cit-000129` |
| genomebiology.biomedcentral.com | 2 | `cit-000704`, `cit-000831` |
| arxiv.org | 2 | `cit-000705`, `cit-000726` |
| www.preprints.org | 2 | `cit-000784`, `cit-000050` |
| www.aginganddisease.org | 2 | `cit-001307`, `cit-000258` |
| repository.nottingham.ac.uk | 2 | `cit-001378`, `cit-000167` |
| www.jstage.jst.go.jp | 2 | `cit-000458`, `cit-001151` |
| public-pages-files-2025.frontiersin.org | 2 | `cit-001044`, `cit-001062` |
| www.thno.org | 2 | `cit-001490`, `cit-001105` |
| www.mcponline.org | 1 | `cit-000514` |
| pubs.acs.org | 1 | `cit-000538` |
| eymj.org | 1 | `cit-000541` |
| academic.oup.com | 1 | `cit-000543` |
| www.beilstein-journals.org | 1 | `cit-000625` |
| theses.hal.science | 1 | `cit-000656` |
| pmc.ncbi.nlm.nih.gov | 1 | `cit-001262` |
| biologydirect.biomedcentral.com | 1 | `cit-000722` |
| jcheminf.biomedcentral.com | 1 | `cit-000750` |
| www.ijbs.com | 1 | `cit-000767` |
| www.tdx.cat | 1 | `cit-000846` |
| publikationen.ub.uni-frankfurt.de | 1 | `cit-000847` |
| medicinus.co | 1 | `cit-001071` |
| www.scielo.br | 1 | `cit-000151` |
| doi.org | 1 | `cit-000171` |
| bmcbiotechnol.biomedcentral.com | 1 | `cit-001011` |
| publikationen.bibliothek.kit.edu | 1 | `cit-001157` |
| www.researchsquare.com | 1 | `cit-000270` |
| udspace.udel.edu | 1 | `cit-001102` |

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

Discovery state of all 978 GLAD candidates, from `candidate.discover_state`:

| state | rows | meaning |
|---|---:|---|
| `no-open-copy` | 468 | looked, nothing retrievable found |
| `has-pdf` | 200 | a PDF is on file for the row — seeded that way, fetched by a script, or filed with `file-pdf.js` |
| `paywalled` | 156 | located behind a paywall — the applicant may be able to obtain these |
| `not-in-indexes` | 132 | not found in the open-access indexes consulted |
| `open-copy` | 19 | an open-access copy was located; the row is only `has-pdf` once the file is on disk |
| `lookup-failed` | 3 | — |

**Still open:** 0 row(s) sit at `open-copy` with no file on disk — a copy was
located and never fetched. Chasing them is a decision, not a defect: a row must be independent
(§1.2) before it is worth a download, and 194 candidate(s) are already held — check why before spending effort on a PDF for a row that
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


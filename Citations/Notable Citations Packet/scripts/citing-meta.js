"use strict";
/**
 * Facts about each citing article that the harvested database does not hold: journal as printed, the citing authors'
 * institutions, and every date found for the article — preprint, received, accepted, final article online, issue.
 * Sources: the first pages of each PDF, PubMed, Europe PMC (which indexes bioRxiv, medRxiv, Research Square,
 * SSRN and Preprints.org), Crossref (including its has-preprint relation) and OpenAlex; checked November 10, 2026.
 *
 *   preCites false when the preprint does NOT contain the citation of my work (only the final article does)
 *   pre     [server, date, note?]  an earlier public preprint, if one was found (shown only where it bears on the petition date)
 *   rec/acc received / accepted dates printed by the journal
 *   on      date the final article first appeared online
 *   issue   issue / print date, where there is one
 *
 * The article counts as public on the EARLIEST of the preprint and the final article; that date decides whether it
 * falls before or after the petition date (April 25, 2024) and sets the order of the citations.
 */
const PETITION_DATE = "2024-04-25";
const MON = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const fmt = iso => { const [y, m, d] = iso.split("-"); return `${MON[+m - 1]} ${+d}, ${y}`; };

const META = {
 "cit-000544": {
  "venue": "Journal of Experimental Biology 227(15): jeb247277",
  "inst": "Universidad Nacional de La Plata and CONICET (INIBIOLP), La Plata, Argentina; Universidad Nacional Autónoma de México",
  "pre": [
   "bioRxiv",
   "2023-04-29",
   "version 1; version 2 posted November 10, 2023"
  ],
  "rec": "2024-01-18",
  "acc": "2024-07-08",
  "on": "2024-08-13",
  "issue": "August 2024 (volume 227, issue 15)"
 },
 "cit-000621": {
  "venue": "Journal of Biological Chemistry 302(7): 113234",
  "inst": "University of California San Diego (Departments of Bioengineering and Pediatrics; Glycobiology Research and Training Center); Technical University of Denmark; Brigham Young University; Augusta University; Complex Carbohydrate Research Center",
  "pre": [
   "bioRxiv",
   "2024-03-30",
   "posted under the earlier title “LeGenD: determining N-glycoprofiles using an explainable AI-leveraged model with lectin profiling”"
  ],
  "rec": "2025-08-25",
  "acc": "2026-05-28",
  "preCites": false, "on": "2026-06-04",
  "issue": "July 2026 (volume 302, issue 7)"
 },
 "cit-000594": {
  "venue": "Nucleic Acids Research 54(4): gkag080",
  "inst": "The University of Manchester (Faculty of Biology, Medicine and Health); The Christie NHS Foundation Trust, Manchester; McGill University",
  "pre": [
   "bioRxiv",
   "2025-04-02",
   "posted under the earlier title “AquIRE reveals multiple mechanisms of clinically induced RNA damage…”"
  ],
  "rec": "2025-06-27",
  "acc": "2026-01-18",
  "on": "2026-01-23",
  "issue": "February 5, 2026 (volume 54, issue 4)"
 },
 "cit-001253": {
  "venue": "Nature Communications 17: 231",
  "inst": "Massachusetts Institute of Technology (Departments of Chemistry, Biology and Biological Engineering; Koch Institute); Broad Institute of MIT and Harvard; Massachusetts General Hospital and Harvard Medical School; University of California, Davis; University of Wisconsin-Madison",
  "pre": [
   "bioRxiv",
   "2025-06-10"
  ],
  "rec": "2025-04-26",
  "acc": "2025-11-20",
  "on": "2026-01-13",
  "issue": null
 },
 "cit-000518": {
  "venue": "Nature Communications 17: 4312",
  "inst": "Leiden University Medical Center (Leiden University Center for Infectious Diseases; Center for Proteomics and Metabolomics); New England Biolabs; Centre de Recherches Médicales de Lambaréné, Gabon; Universitätsklinikum Tübingen and the German Center for Infection Research (DZIF)",
  "pre": [
   "Research Square",
   "2025-07-30"
  ],
  "rec": "2025-07-11",
  "acc": "2026-03-03",
  "on": "2026-03-23",
  "issue": null
 },
 "cit-000521": {
  "venue": "Journal of Biological Chemistry 301(12): 110915",
  "inst": "Institut für Biochemie, Universität für Bodenkultur (BOKU), Vienna, Austria",
  "pre": null,
  "rec": "2025-07-25",
  "acc": null,
  "on": "2025-11-05",
  "issue": "December 2025 (volume 301, issue 12)"
 },
 "cit-000629": {
  "venue": "Journal of Virology 99(12): e01256-25",
  "inst": "Vanderbilt University Medical Center (corresponding author Ivelin S. Georgiev); the remaining collaborating institutions are listed in the article",
  "pre": [
   "bioRxiv",
   "2025-01-20"
  ],
  "rec": "2025-07-31",
  "acc": "2025-10-13",
  "on": "2025-11-10",
  "issue": "December 23, 2025 (volume 99, issue 12)"
 },
 "cit-000619": {
  "venue": "Protein Science",
  "inst": "Ben-Gurion University of the Negev (Department of Life Sciences; Ilse Katz Institute for Nanoscale Science and Technology), Israel",
  "pre": null,
  "rec": "2025-11-23",
  "acc": "2026-04-13",
  "on": "2026-04-20",
  "issue": "May 2026"
 },
 "cit-000542": {
  "venue": "Research and Practice in Thrombosis and Haemostasis",
  "inst": "University Medical Center of the Johannes Gutenberg University Mainz (Center for Thrombosis and Hemostasis; Research Center for Immunotherapy); ANZAC Research Institute, Concord Repatriation Hospital; University of Sydney",
  "pre": null,
  "rec": "2025-12-03",
  "acc": "2026-02-13",
  "on": "2026-03-20",
  "issue": "March 2026"
 },
 "cit-000602": {
  "venue": "Nature Communications 17: 9972",
  "inst": "University of British Columbia (Departments of Biochemistry and Molecular Biology, and of Microbiology and Immunology)",
  "pre": null,
  "rec": "2026-01-19",
  "acc": "2026-09-01",
  "on": "2026-09-28",
  "issue": null
 },
 "cit-000516": {
  "venue": "International Journal of Molecular Sciences 27(9): 3827",
  "inst": "University of Maryland School of Medicine, Baltimore; University of Maryland, College Park; University of Maryland Baltimore County; Sun Yat-sen University; Northeastern University",
  "pre": null,
  "rec": "2026-01-31",
  "acc": "2026-03-31",
  "on": "2026-04-25",
  "issue": null
 },
 "cit-000613": {
  "venue": "Scientific Reports 16: 24822",
  "inst": "University of Potsdam; Yale University; Université de Lille and CNRS (UMR 8576 UGSF); German Federal Institute for Risk Assessment (BfR), a federal government agency; Technische Universität Berlin",
  "pre": null,
  "rec": "2026-04-30",
  "acc": "2026-08-06",
  "on": "2026-08-11",
  "issue": null
 },
 "cit-001257": {
  "venue": "Scientific Reports",
  "inst": "Fred Hutchinson Cancer Center, Seattle",
  "pre": null,
  "rec": "2026-05-19",
  "acc": "2026-10-05",
  "on": "2026-10-15",
  "issue": null
 },
 "cit-000416": {
  "venue": "Glycobiology (cwag085)",
  "inst": "Mahidol University; CNRS UMR 8576 UGSF (Université de Lille); Srinakharinwirot University; Gifu University (Institute for Glyco-core Research, iGCORE); Nagoya University (GlycoMIRAI, CNRS IRL 2045)",
  "pre": null,
  "rec": "2025-12-08",
  "acc": "2026-09-09",
  "on": "2026-09-29",
  "issue": "November 5, 2026"
 },
 "cit-000196": {
  "venue": "Vaccine 39: 3225–3235",
  "inst": "Johns Hopkins University Bloomberg School of Public Health (W. Harry Feinstone Department of Molecular Microbiology and Immunology)",
  "pre": null,
  "rec": "2020-07-13",
  "acc": "2021-04-28",
  "on": "2021-05-11",
  "issue": "June 2021 (volume 39)"
 },
 "cit-000197": {
  "venue": "Proceedings of the National Academy of Sciences 120(17): e2208718120",
  "inst": "Emory University School of Medicine (corresponding author Anice C. Lowen); Emory-University of Georgia Center of Excellence for Influenza Research and Surveillance; the remaining collaborating institutions are listed in the article",
  "pre": [
   "bioRxiv",
   "2022-07-14"
  ],
  "rec": "2022-05-20",
  "acc": "2023-02-15",
  "on": "2023-04-17",
  "issue": "April 25, 2023 (volume 120, issue 17)"
 },
 "cit-000510": {
  "venue": "Scientific Reports 13: 10223",
  "inst": "Johns Hopkins University Bloomberg School of Public Health (W. Harry Feinstone Department of Molecular Microbiology and Immunology); Johns Hopkins University School of Medicine (Department of Emergency Medicine)",
  "pre": null,
  "rec": "2023-03-09",
  "acc": "2023-06-15",
  "on": "2023-06-23",
  "issue": null
 },
 "cit-000532": {
  "venue": "Frontiers in Immunology 14: 1102344",
  "inst": "Leiden University Medical Center; New England Biolabs; National Institutes of Health, Bethesda (Laboratory of Parasitic Diseases), a US government institution; University Hospital Bonn and the German Center for Infection Research (DZIF); University of Buea, Cameroon",
  "pre": null,
  "rec": "2022-11-18",
  "acc": "2023-02-02",
  "on": "2023-03-06",
  "issue": null
 },
 "cit-001230": {
  "venue": "Antiviral Research 125: 84–91 (2016; available online November 30, 2015)",
  "inst": "Kansas State University (College of Veterinary Medicine); Wichita State University (Department of Chemistry)",
  "pre": null,
  "rec": "2015-09-04",
  "acc": "2015-11-23",
  "on": "2015-11-30",
  "issue": "January 2016 (volume 125)"
 },
 "cit-000195": {
  "venue": "Journal of Virology 97(11): e00906-23",
  "inst": "University of Iowa (corresponding author Balaji Manicassamy); the remaining collaborating institutions are listed in the article",
  "pre": [
   "bioRxiv",
   "2022-06-30"
  ],
  "rec": "2023-06-30",
  "acc": "2023-09-14",
  "on": "2023-10-16",
  "issue": "November 2023 (volume 97, issue 11)"
 },
 "cit-000199": {
  "venue": "Glycobiology 34(3): cwad098",
  "inst": "University of Gothenburg and Sahlgrenska University Hospital; Uppsala University (Zoonosis Science Center); Max Planck Institute of Animal Behavior",
  "pre": null,
  "rec": "2023-06-14",
  "acc": "2023-11-28",
  "on": "2023-12-22",
  "issue": "April 1, 2024 (volume 34, issue 3)"
 },
  "cit-000514": { "venue": "Molecular & Cellular Proteomics 21(5): 100201", "inst": "Leiden University Medical Center (Department of Parasitology, Leiden University Center of Infectious Diseases); New England Biolabs, Ipswich, Massachusetts; University of Illinois College of Medicine at Rockford (Department of Biomedical Sciences)", "pre": null, "rec": "2021-10-29", "rev": "2022-01-03", "acc": null, "on": "2022-01-20", "issue": "May 2022 (volume 21, issue 5)" },
  "cit-000749": { "venue": "Journal of Proteome Research 21(8): 1974–1985", "inst": "University of Alberta (Department of Chemistry; corresponding author Lara K. Mahal); New York University (Center for Genomics and Systems Biology, Department of Biology); University of Georgia (Center for Vaccines and Immunology)", "pre": null, "rec": "2022-05-03", "acc": null, "on": "2022-06-27", "issue": "August 5, 2022 (volume 21, issue 8)" },
  "cit-000752": { "venue": "ACS Infectious Diseases 10(6): 2032–2046", "inst": "Centers for Disease Control and Prevention, Atlanta (National Center for Environmental Health; National Center for Immunization and Respiratory Diseases); Georgia Institute of Technology (School of Physics)", "pre": ["bioRxiv", "2023-11-23"], "rec": "2024-01-08", "rev": "2024-04-27", "acc": "2024-04-30", "on": "2024-05-10", "issue": "June 14, 2024 (volume 10, issue 6)" },
  "cit-000600": { "venue": "Communications Biology 5: 419", "inst": "Baylor College of Medicine, Houston (Verna and Marrs McLean Department of Biochemistry and Molecular Biology; Department of Molecular Virology and Microbiology; Department of Medicine); Berkeley Center for Structural Biology, Lawrence Berkeley Laboratory; Emory University School of Medicine (Emory Glycomics and Molecular Interactions Core)", "pre": null, "rec": "2021-09-07", "acc": "2022-04-12", "on": "2022-05-05", "issue": "May 2022 (volume 5, article 419)" },
  "cit-000044": { "venue": "ACS Medicinal Chemistry Letters 11(2): 101–107", "inst": "Agios Pharmaceuticals, Cambridge, Massachusetts; Memorial Sloan Kettering Cancer Center, New York; Viva Biotech, Wuxi Biortus Biosciences, PharmaResources and ChemPartner (contract research companies, China)", "pre": null, "rec": "2019-11-05", "acc": "2020-01-22", "on": "2020-01-22", "issue": "February 13, 2020 (volume 11, issue 2)" },
  "cit-000396": { "venue": "Advanced Science 9(1): 2103807", "inst": "University of Gothenburg (Department of Chemistry and Molecular Biology; Wallenberg Centre for Molecular and Translational Medicine); Swiss Institute of Bioinformatics and University of Geneva", "pre": null, "rec": "2021-08-30", "acc": null, "on": "2021-12-04", "issue": "January 2022 (volume 9, issue 1)" },
  "cit-000423": { "venue": "Biomolecules 11(11): 1586", "inst": "Nanjing University of Chinese Medicine; Shanghai Institute of Materia Medica, Chinese Academy of Sciences; University of Chinese Academy of Sciences; ShanghaiTech University; Shantou University", "pre": null, "rec": "2021-09-10", "acc": "2021-10-19", "on": "2021-10-27", "issue": "November 2021 (volume 11, issue 11)" }
};

/** the date the article first became public: the preprint if there is one, otherwise the final article */
/** a preprint is shown only where it bears on the petition date: posted before it, with the final article after it */
const showPre = uid => { const m = META[uid]; return !!(m.pre && m.pre[1] < PETITION_DATE && m.on >= PETITION_DATE); };
const earliest = uid => { const m = META[uid]; return showPre(uid) ? m.pre[1] : m.on; };
/** "before" or "after" the petition date, by the earliest public date */
function period(uid) {
  if (!META[uid]) throw new Error(`no citing-article metadata for ${uid} (add it to scripts/citing-meta.js)`);
  return earliest(uid) < PETITION_DATE ? "before" : "after";
}
/** the dates as [label, text] pairs, oldest first, for the Word documents */
function datesList(uid) {
  const m = META[uid], L = [];
  if (showPre(uid)) L.push([`${m.pre[0]} preprint (public)`, fmt(m.pre[1]) + (m.pre[2] ? ` (${m.pre[2]})` : "")]);
  if (m.rec) L.push(["Received", fmt(m.rec)]);
  if (m.rev) L.push(["Revised", fmt(m.rev)]);
  if (m.acc) L.push(["Accepted", fmt(m.acc)]);
  L.push(["Final article online", fmt(m.on)]);
  if (m.issue) L.push(["Issue date", m.issue]);
  return L;
}
/** one-line version for the index table of packet.html */
const publishedLabel = uid => `${fmt(META[uid].on)} (final article online)`;
/** only for an article whose preprint bears on the petition date; otherwise null (the final date is the date) */
const earliestLabel = uid => { const m = META[uid]; return showPre(uid) ? `${fmt(m.pre[1])} (${m.pre[0]} preprint, before the petition date)` : null; };
module.exports = { META, PETITION_DATE, fmt, earliest, showPre, period, datesList, publishedLabel, earliestLabel };

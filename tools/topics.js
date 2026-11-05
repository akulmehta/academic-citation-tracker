// Topic classification for the publications on the Scholar profile.
//
// The dashboard's network figures colour each publication by the research area it
// belongs to, so an officer can see at a glance that the anticoagulant work and
// the glycoscience work are two bodies of literature rather than one. The area is
// a property of the publication, not of a citing work, so it is stated here rather
// than inferred on every page load.
//
// WHY A TABLE AND NOT A KEYWORD RULE IN THE BROWSER
// -------------------------------------------------
// A keyword test cannot be reviewed. The rule that produced this draft was:
//
//   glyco  title matches glycan / glyco / glycos / lectin / heparan / heparin /
//          sialyl / mannos / saccharid / carbohydr / blood group / oligosaccharid
//   anti   title matches thrombin / factor XI / factor X / coagul / anticoag /
//          platelet / fibrin / thromb / hemostasis / clot
//   both   both patterns match
//   other  neither matches
//
// Every row was then read against its own title. The three rows the keywords left
// unassigned are medicinal-chemistry papers that belong to neither programme, and
// one paper matched both because it is genuinely a dual anticoagulant and
// antiplatelet paper — it is drawn half red and half blue rather than being forced
// into one family.
//
// STATUS: DRAFT, awaiting the user's review of `Exhibits/Supporting/
// publication-topics-<snapshot>.csv`. Nothing in the packet's counts depends on
// this file: it colours a diagram. A publication absent from the table is drawn
// grey and named in the figure's caption, never guessed at.
//
// Keyed by cites_id, which is the profile's own stable id for a publication and is
// what every citing row already carries. The eight publications with no captured
// citing list have no cites_id here because they have no node to colour; they are
// listed at the foot of the CSV so the table still covers all 48.

"use strict";

// topic: "glyco" | "anti" | "both" | "other"
const TOPICS = {
  // ---- glycoscience -------------------------------------------------------
  "11657216136002863473": "glyco", // GlyGen: computational and informatics resources for glycoscience
  "11088885855065116690": "glyco", // GlycoGlyph: a glycan visualizing, drawing and naming application
  "5446863664671350528": "glyco", // GLAD: GLycan Array Dashboard
  "16936816916736738985": "glyco", // Antigenic pressure on H3N2 ... sialylated receptor
  "14910939819377951228": "both", // Emerging patterns of tyrosine sulfation and O-glycosylation cross-talk
  "6229834546150686384": "glyco", // Unique repertoire of anti-carbohydrate antibodies in individual human serum
  "15061740354097007450": "glyco", // Differential recognition of oligomannose isomers by glycan-binding proteins
  "4020068634317483083": "glyco", // N-glycosylation of mannose receptor (CD206) ...
  "13747992322397191586": "glyco", // Tumor cells express pauci- and oligomannosidic N-glycans ...
  "1097725010100349237": "glyco", // Insights into glycobiology and the protein-glycan interactome ...
  "7766194793257344353": "both", // Chemokine binding to PSGL-1 is controlled by O-glycosylation and tyrosine sulfation
  "3056590047335474894": "glyco", // GlyMDB: Glycan Microarray Database and analysis toolset
  "12821833616671474197": "glyco", // Novel reversible fluorescent glycan linker for functional glycomics
  "5067819667796015751": "glyco", // Parallel Glyco-SPOT Synthesis of Glycopeptide Libraries
  "15815601915071679165": "glyco", // Increased Galectin-9 Levels ... Rheumatoid Arthritis
  "1265544686654036535": "glyco", // Heparan sulfate glycomimetics via iterative assembly of "clickable" disaccharides
  "12579475046233103853": "glyco", // Tools for generating and analyzing glycan microarray data
  "10448952677968226961": "glyco", // Galectin-3 Decreases 4-1BBL Bioactivity ...
  "5245048765174084502": "glyco", // Chemoenzymatically Prepared Heparan Sulfate ...
  "4082711194076959494": "glyco", // Recognition of highly branched N-glycans of the porcine whipworm ...
  "6832916466426077559": "glyco", // Reusable glycan microarrays using a microwave assisted wet-erase process
  "13271249835639697821": "glyco", // Comparative analysis of INLIGHT-labeled ... depolymerized heparin
  "3693488939388521505": "glyco", // Novel click coupling chemistry to explore glycan recognition
  "6351996940034106218": "glyco", // Development of lamprey-derived antibodies against human blood group antigens
  "16263333014302844300": "glyco", // Functional implications of glycans and their curation
  "1956444758555575516": "glyco", // Unique Glycans in Synaptic Glycoproteins in Mouse Brain

  // ---- anticoagulants / thrombosis ---------------------------------------
  "14331029933979420569": "anti", // Sulfated pentagalloylglucoside ... inhibitor of factor XIa
  "6309677444540434342": "anti", // Rational design of potent, small, synthetic allosteric inhibitors of thrombin
  "5872921749676588753": "anti", // Designing allosteric regulators of thrombin. Exosite 2 ...
  "4631471255166879252": "both", // Allosterism-based simultaneous, dual anticoagulant and antiplatelet action
  "11728333386143173456": "anti", // Allosteric partial inhibition of monomeric proteases. Sulfated coumarins ...
  "17765626390546429538": "anti", // Allosteric inhibition of human factor XIa: monosulfated benzofurans
  "3236459071058389818": "anti", // Interaction of thrombin with sucrose octasulfate
  "7585410930116882242": "anti", // An update on recent patents on thrombin inhibitors (2010-2013)
  "5710710517199553350": "anti", // Potent direct inhibitors of factor Xa based on the tetrahydroisoquinoline scaffold
  "13760283595664836508": "anti", // Targeting the GPIb alpha Binding Site of Thrombin ... Anticoagulant and Antiplatelet
  "13268313723721620254": "anti", // Substantial non-electrostatic forces ... allosteric disruption of thrombin's active site

  // ---- neither programme --------------------------------------------------
  "11511020813745171966": "other", // Nitric Oxide-Releasing Prodrugs as Drug Candidates
  "1616266261715634004": "other", // Cholesterol-dependent enzyme activity of human TSPO1
  "1509533735482566662": "other", // Structural modification of azolylacryloyl derivatives ... covalent modifiers of hemoglobin
};

// Display metadata for each family. `hue` is the base colour; the figure varies
// its lightness across the family by publication year, so "shades of blue" is a
// real gradient carrying information rather than a decorative one.
const FAMILY = {
  glyco: {
    label: "Glycoscience",
    base: "#1d5fa8",
    edge: "#123f70",
    note: "glycans, lectins, glycoengineering and glycoinformatics",
  },
  anti: {
    label: "Anticoagulants and thrombosis",
    base: "#c0392b",
    edge: "#8a2317",
    note: "thrombin, factor XIa and factor Xa inhibition",
  },
  both: {
    label: "Spans both programmes",
    base: "#6b4fa0",
    edge: "#4a3573",
    note: "tyrosine sulfation and dual anticoagulant / antiplatelet work",
  },
  other: {
    label: "Other medicinal chemistry",
    base: "#2f7d4f",
    edge: "#1f5735",
    note: "nitric-oxide prodrugs, TSPO1, hemoglobin modifiers",
  },
  unknown: {
    label: "Not classified",
    base: "#8b95a1",
    edge: "#66707b",
    note: "no topic recorded in tools/topics.js",
  },
};

const ORDER = ["glyco", "anti", "both", "other", "unknown"];

module.exports = { TOPICS, FAMILY, ORDER };

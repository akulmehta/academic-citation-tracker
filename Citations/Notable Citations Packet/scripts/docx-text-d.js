"use strict";
/**
 * Section II prose of the Word document, part 3 (see docx-text.js): the four citations added on 2026-11-10 from the
 * additional-candidates review (Additional-Notable-Citation-Candidates.md). Same style as docx-text-a.js: first person,
 * past tense, plain words. Every statement was checked against the citing article.
 */
module.exports = {
  // ------------------------------------------------------------ cit-000044
  "cit-000044": {
    objectives:
      "The authors, a team at the pharmaceutical company Agios, were developing a drug for glioma, a type of brain cancer. Certain cancers carry a mutated form of an enzyme (isocitrate dehydrogenase, or IDH) that makes a harmful by-product, and the team needed a pill-form drug that could reach the brain and block the mutated enzyme. They described the discovery of vorasidenib (AG-881), which blocks both mutated forms of the enzyme, and showed that it enters the brain. This was complementary to my research: my work on allosteric inhibitors (compounds that bind away from an enzyme’s working site and change its shape) had shown that such compounds can reduce an enzyme’s activity partially rather than completely.",
    importance:
      "Glioma is a hard-to-treat brain cancer, and most drugs cannot get past the barrier that protects the brain. Vorasidenib was described as being in clinical development for low-grade glioma. Understanding why some compounds in the series only partly block the enzyme helps chemists choose which compounds to develop further, so it matters to the success of the drug program.",
    how: [
      "The authors observed that two of their compounds, enasidenib and AGI-12026, only partly blocked one form of the mutated enzyme. To explain this, they wrote that allosteric modulators “have been known to induce both full and intermediate structural changes in the active site of enzymes resulting in varying degrees of efficacy,” and they cited my 2016 paper “Allosteric partial inhibition of monomeric proteases,” in which I and my colleagues showed this effect with compounds acting on the clotting enzyme thrombin.",
      "In other words, a drug discovery team in industry, working on a different enzyme and a different disease, relied on my published finding to interpret its own results before choosing which compounds to take forward.",
    ],
    findings:
      "The authors found that their compound series could block both mutated forms of the enzyme, that vorasidenib reached the brain in several animal species, and that it reduced the harmful by-product in glioma tissue by more than 97% in a mouse model of the disease. Their explanation of the partial blocking seen with some compounds rested on my finding that allosteric binding can produce partial inhibition.",
  },
  // ------------------------------------------------------------ cit-000396
  "cit-000396": {
    objectives:
      "The authors developed LectinOracle, a computer model that uses artificial intelligence to predict which sugars (glycans) a given lectin will bind. Lectins are proteins that recognize sugars, and they are involved in everything from bacterial infection to immune defense, but testing each lectin against each sugar in the laboratory is slow. The authors wanted a model that could make such predictions for lectins and sugars it had not seen before. This was complementary to my research on glycan microarrays (slides printed with many different sugars, used to test which sugars a protein binds).",
    importance:
      "A tool that predicts lectin–sugar binding could speed up the study of infection, immunity and the design of new lectins. But such a model is only useful if it is shown to work on real laboratory measurements it was not trained on. This is why independent experimental data sets that are difficult to predict are important to the field.",
    how: [
      "Firstly, to test their model on real laboratory results that were not part of its training data, the authors turned to published glycan arrays. They wrote: “First, we used the recently published oligomannose array for this purpose,” and cited my 2021 paper in Science Advances, in which we measured how a panel of proteins bind to closely related oligomannose sugars (sugar structures rich in the sugar mannose).",
      "In addition, the authors explained why they chose it: the slight changes in sugar structure in my array “nonetheless led to appreciable differences in their binding behavior,” which “made this a particularly challenging case study for our model.” My array data were therefore used as a stringent independent test of their tool, and the results are shown in Figure 3 of their paper.",
    ],
    findings:
      "On my oligomannose array data, the model predicted whether a sugar was bound or not with about 70–90% accuracy for plant and bacterial lectins, and the authors concluded that its predictions agreed with experimental data on new sugars and lectins.",
  },
  // ------------------------------------------------------------ cit-000423
  "cit-000423": {
    objectives:
      "The authors used computer simulations of molecules in motion (molecular dynamics) to study how DC-SIGN, a protein on immune cells that recognizes sugars, grabs onto the sugar structures on the spike protein of the virus that causes COVID-19. They asked which sugar structures DC-SIGN recognizes, and where on DC-SIGN they bind, in order to find plant-derived sugar-containing compounds that could block this interaction. This was complementary to my research: the sugar structures they examined include the oligomannose sugars whose recognition by sugar-binding proteins, including DC-SIGN, I measured on glycan microarrays.",
    importance:
      "DC-SIGN is thought to help the virus spread through the body and contribute to the harmful immune over-reaction seen in severe COVID-19, so blocking it could lead to new treatments. Simulations are only reliable, however, if they are checked against real laboratory measurements, which is the role my array data played here.",
    how: [
      "The authors’ simulations predicted that some sugar structures bind DC-SIGN more stably than others. They then compared this prediction with laboratory data: “The findings were consistent with those from a recent glycan assay study (Figure 6C),” and cited my 2021 Science Advances paper on the differential recognition of oligomannose sugars by sugar-binding proteins. In that paper, DC-SIGN was found to prefer a particular arm of the branched oligomannose structure, the same Manα1,2Manα1,3Man arrangement that the simulations found to be bound more stably.",
      "In other words, the authors used the results of my oligomannose glycan microarray, in which DC-SIGN was tested against a panel of closely related oligomannose sugars, to validate their molecular simulations. Figure 6C of their paper shows the simulation results that they said agreed with these laboratory findings.",
    ],
    findings:
      "The authors found that the simulated binding preferences of DC-SIGN agreed with the laboratory findings from my glycan microarray study, which gave them confidence in their model. On that basis they predicted the sugar structures on the virus spike that DC-SIGN could recognize and identified two plant compounds, saikosaponin A and liquiritin, as promising blockers in the computer model.",
  },
  // ------------------------------------------------------------ cit-000600
  "cit-000600": {
    objectives:
      "The authors studied rotaviruses, viruses that cause severe diarrhea (gastroenteritis) in children and, in the case of group B rotavirus, in adults. The part of the group B virus that attaches to cells (a domain called VP8*B) looks nothing like the corresponding part of the other rotavirus groups, so nobody knew its shape or which sugars it recognizes. They used AlphaFold2, an artificial-intelligence program that predicts the three-dimensional shape of a protein, to predict the shape, confirmed it by determining the crystal structure at very high resolution, and tested which sugars the domain binds on a glycan array (a glass slide printed with many different sugar structures). This was complementary to my research on glycan arrays and on tools for presenting their results.",
    importance:
      "Rotaviruses enter cells by attaching to sugars on the cell surface, so the shape of the part that recognizes the sugar, and the sugars it prefers, are the starting point for understanding how the virus infects and how infection might be blocked. The authors showed that group B rotavirus uses a new protein fold (a new three-dimensional shape) to recognize sugars, unlike the fold used by groups A and C, which shows that evolution can reach the same function with a very different shape.",
    how: [
      "The authors tested the protein on a glycan array of 600 sugar structures and showed the results in Figure 4, together with the sugar structures that bound most strongly. The legend of that figure states: “The glycan structures with the highest binding signals were drawn using GlycoGlyph,” and the authors cited my 2020 GlycoGlyph paper in their reference list.",
      "The sugar structures in that figure, which show the reader exactly which sugars the new protein fold recognizes, were therefore drawn with my application. These results led the authors to their conclusion that the domain binds sugars containing N-acetyllactosamine, the sugar they went on to place on the protein by computer docking.",
    ],
    findings:
      "The predicted shape agreed with the crystal structure, showing that the group B domain has a new fold, a β-sheet clasping an α-helix, which is different from the fold in groups A and C. The glycan array showed that the domain recognizes sugars containing N-acetyllactosamine, and docking placed this sugar on the protein.",
  },
};

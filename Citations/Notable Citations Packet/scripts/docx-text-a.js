"use strict";
/**
 * Section II prose of the Word document, part 1 of 2 (see docx-text.js).
 *
 * Written in the style of counsel's example ("Example of Section II in Notable Citation Descriptions Document"):
 * first person, past tense, plain words, one idea per paragraph; "Firstly ... In addition ..." when the work was
 * used in more than one way. A lay reader is told what a glycan, an array or my tool is the first time it matters.
 * Page numbers are left to the "Citation to Your Work" quotations; every statement below was checked against the
 * citing article.
 *
 * Fields: objectives, importance (strings); how (array of paragraphs); findings (string).
 */
module.exports = {
  // ---------------------------------------------------------------- 1
  "cit-001230": {
    objectives:
      "The authors were developing new antiviral drugs against enterovirus D68 and human rhinoviruses (the family of viruses that causes common colds). They tested a series of small compounds designed to block a protein-cutting enzyme (a protease) that these viruses need in order to multiply, and went on to show that the most promising compound, compound 10, stopped the viruses from growing in cells and was absorbed when given by mouth to rats. This was complementary to my research on anticoagulants (drugs that stop blood from clotting): the enzyme thrombin, which controls clotting, was one of the human enzymes they used to check that their antiviral compound did not act on the body’s own proteins. My 2011 paper on thrombin inhibitors was one of the papers they cited for those tests.",
    importance:
      "Enterovirus D68 is an emerging virus that causes respiratory illness, from mild to severe, mostly in infants, children and teenagers, and there was no approved vaccine or drug against it or against the related rhinoviruses. A drug that blocks a viral enzyme is only useful if it leaves similar human enzymes alone, because blocking those would cause side effects. A selectivity test against a panel of human enzymes, including thrombin, is therefore a necessary step before such a compound can be developed further.",
    how: [
      "The authors tested compound 10 against a panel of human enzymes that resemble the viral one: neutrophil elastase, chymotrypsin, trypsin, thrombin and carboxypeptidase A. They described this panel as an assay “as previously reported” and listed five earlier papers behind it. My 2011 paper, “Rational design of potent, small, synthetic allosteric inhibitors of thrombin”, was one of those five, and it is the one that deals with thrombin. The authors therefore relied on published thrombin work, including mine, as the basis for the thrombin part of their selectivity testing.",
    ],
    findings:
      "Compound 10 was a very weak inhibitor of neutrophil elastase and had no effect on the other human enzymes at the concentrations tested; for thrombin it gave 0% inhibition at the highest inhibitor-to-enzyme ratio used. The authors concluded that compound 10 had good selectivity for the viral enzymes, in addition to its strong antiviral activity against enterovirus D68 and rhinoviruses.",
  },
  // ---------------------------------------------------------------- 2
  "cit-000196": {
    objectives:
      "The authors studied the nasal-spray flu vaccine, which contains a weakened live virus that is grown in chicken eggs. They asked whether three small changes in the virus’s surface protein, which appeared when the 2012–2013 H3N2 vaccine strain was adapted to eggs, change the sugar receptors the virus attaches to and, as a result, how well the vaccine virus grows in human nasal cells. To measure which receptors each virus preferred, they used a glycan array, a glass slide printed with many different sugar structures, and they cited my 2019 study of how H3N2 flu viruses bind to sugar receptors as one of the sources for that method. This was complementary to my research, which used the same type of array to study flu receptor binding.",
    importance:
      "Flu vaccine viruses are grown in eggs, and mutations that help the virus grow there can alter the part of the virus that attaches to human cells, which may make the vaccine less effective. The 2012–2013 flu season, when the H3N2 vaccine component did not match the circulating viruses, is one example the authors give. Whether these egg-adaptation changes also reduce how well the weakened-virus vaccine grows in the human nose, where it is actually given, had been little studied, and the answer matters for how vaccine strains are chosen and produced.",
    how: [
      "Firstly, to find out which sugar receptors each vaccine virus preferred, the authors labeled the virus particles with a fluorescent dye and let them bind to a glycan array. They described this procedure as “previously described” and cited four earlier papers for it; my 2019 paper on H3N2 receptor binding was one of them.",
      "In addition, the authors cited the same four papers, including mine, for how the array was scanned and the data analyzed. The array results were central to the study, because they showed that the egg-adapted virus and a second, more extreme variant bound to a different type of sugar receptor than the original virus, and this difference was the basis for the rest of their experiments.",
    ],
    findings:
      "On the array, the original virus bound mainly to the receptor type that human flu viruses use, while the egg-adapted virus and the second variant bound more to the receptor type typical of bird viruses. The egg-adapted virus also grew less well than the original in human nasal cells, and the second variant grew poorly. The authors concluded that egg-adaptation changes that shift receptor preference may harm the live vaccine’s growth and so may help explain its reduced effectiveness.",
  },
  // ---------------------------------------------------------------- 3
  "cit-000532": {
    objectives:
      "The authors studied infections caused by parasitic worms (filarial nematodes). They asked how specific the antibody response to sugar structures of one of these worms, Brugia malayi, is: when a person is infected with a different filarial worm, do the antibodies also recognize the Brugia sugars? To test this they used a glycan microarray, a glass slide printed with many different sugar structures, and they analyzed and displayed the results with GLAD, the glycan array analysis tool that I developed. This was complementary to my research on tools for analyzing glycan array data, and the authors relied on my tool for turning the raw measurements into results.",
    importance:
      "Blood tests that detect antibodies to parasite molecules are a convenient way to diagnose these infections, but the tests available are compromised because antibodies to one worm can react with another, and because antibodies remain in the blood for years after a patient is cured. Better tests are needed to reach the global targets for eliminating these diseases, and knowing which antibodies are specific to one worm is the first step to designing them.",
    how: [
      "After the array slides were scanned and the data cleaned up, the authors wrote that my GLAD tool, “hosted by the National Center for Functional Glycomics”, was used for “data visualization, data mining, generation of heatmaps and boxplot graphs”, and they cited my 2019 paper that describes it.",
      "The main figures of the study are exactly these outputs: a heat map showing how strongly each patient’s antibodies bound each sugar fraction, and box plots and a heat map comparing antibody subtypes. GLAD therefore produced the figures on which the study’s conclusions rest.",
    ],
    findings:
      "The authors found that antibodies to a small set of cross-reactive sugar structures were present in people infected with every worm species tested, while infections with two of the species (Onchocerca volvulus and Mansonella perstans) produced antibodies to many more of the sugars, giving responses similar to infection with Brugia malayi itself. They also found that in Brugia infection one antibody subtype (IgG2) against the worm’s sugars fell markedly after treatment, which they said suggests a promising potential for use in diagnostic tests.",
  },
  // ---------------------------------------------------------------- 4
  "cit-000197": {
    objectives:
      "The authors studied how the flu virus can escape a class of antibodies that attach to the stem of its surface protein, hemagglutinin. The stem hardly changes from one flu strain to the next, so it is the target of efforts to make a “universal” flu vaccine. The authors asked whether the virus can mutate to escape these antibodies without losing fitness, and found that a second mutation in the head of the protein makes the escape possible; they then asked how that second mutation acts, and found that it changes how tightly the virus binds to its receptor. They measured this on a glycan array, a glass slide printed with many sugar structures, using a procedure for labeling the virus and running the array that they cited to my 2019 study of H3N2 flu receptor binding. This was complementary to my research, which used the same kind of experiment.",
    importance:
      "A universal flu vaccine would protect against many flu strains at once, which is why antibodies to the stem are so attractive. Before such a vaccine is used widely, it is important to know whether the flu virus can evolve to escape it. The authors’ work shows that escape is costly for the virus but possible, and so points to the need to monitor how the virus evolves when candidate universal vaccines are tested.",
    how: [
      "The authors needed to measure the sugar receptors that their viruses bound to. They purified the viruses, labeled them with a fluorescent dye, and ran them on a glycan array “using the buffers and conditions described previously”, citing two papers for each of these steps. One of the two was my 2019 paper on H3N2 receptor binding.",
      "The array experiment showed that both the original virus and the mutated virus bound mainly to the receptor type found in the human airway, with small differences between them. This result was the first step toward the finding that the mutation changes receptor binding, so the method described in my paper produced a key observation in the study.",
    ],
    findings:
      "The array showed that the original and the mutated viruses preferred largely the same receptors, with subtle differences, and a further binding assay showed that the mutation increased how tightly the virus held on to its receptor. The authors proposed that stronger receptor binding relaxes a constraint on the stem and so allows the virus to escape the stem antibodies. They concluded that escape from these antibodies is costly for the virus but that interactions between mutations can allow it, which has to be considered in the development of stem-targeting vaccines.",
  },
  // ---------------------------------------------------------------- 5
  "cit-000510": {
    objectives:
      "The authors compared two closely related H1N1 flu virus groups (clades) that circulated in the 2019–2020 flu season, A5a.1 and A5a.2, to understand why A5a.1 became the dominant one. They compared how well each was neutralized by antibodies in the blood of vaccinated healthcare workers, how large its plaques were, how fast it grew in cells, and which sugar receptors it bound. For the receptor measurements they used a glycan array, a glass slide printed with many different sugar structures, and they analyzed the results with GLAD, the glycan array analysis tool that I developed. This was complementary to my research on tools for glycan array data: GLAD was how the authors worked out which sugar structures each virus group bound.",
    importance:
      "Public health agencies track new flu virus groups as they appear, because a new group may spread faster than others or may escape the antibodies produced by the current vaccine. These are two different properties and they do not always change together. Glycan arrays are useful here because they show which receptors a virus prefers and how varied its binding is, and this gives a clue to how well the virus can spread among people.",
    how: [
      "The authors scanned the arrays and first selected the 139 sugar structures that end in sialic acid, the receptor type used by flu viruses. They then wrote that these data were “organized by structure using the Glycan Array Dashboard (GLAD)”, citing my 2019 paper, and that “Structures of glycans uniquely bound by one clade were identified using GLAD”.",
      "In other words, GLAD was the tool that sorted the array results by sugar structure and showed which structures were bound by one virus group and not the others. The comparison of the virus groups’ receptor binding in the Results, including the share of total binding held by the top three structures, was built on that analysis.",
    ],
    findings:
      "All the virus groups bound mainly the receptor type preferred by human flu viruses, but the A5a.2 group bound a smaller number of different sugar structures, with more than a third of its binding concentrated on just three of them. A5a.2 also formed smaller plaques and grew to lower levels in both cell cultures. The authors concluded that A5a.2 had reduced viral fitness, including reduced receptor binding, which may explain why it remained uncommon after it appeared.",
  },
  // ---------------------------------------------------------------- 6
  "cit-000195": {
    objectives:
      "The authors asked which types of sugar-based molecules on the surface of human lung cells flu viruses need in order to infect them. They used gene editing (CRISPR) to remove each of the three main kinds of sugar-bearing molecule from a human lung cell line, singly or together, and then tested human and bird flu viruses on these cells; they confirmed the key results in cells from human airways. This was complementary to my research on which sugar structures H3N2 flu viruses bind: the authors cited my 2019 paper as part of the evidence that human H3N2 viruses prefer long, branched sugar chains, which motivated their experiments.",
    importance:
      "Whether a flu virus can infect humans depends on the sugar molecules it can attach to, and much of what was known came from glycan arrays, glass slides printed with sugar structures. The authors point out that on such slides the sugars are attached in artificial ways at high density, so results can be biased by which sugars were printed. Testing real human cells with their sugars removed, as these authors did, shows what the virus actually needs, and it matters for judging which bird flu viruses could infect people.",
    how: [
      "Firstly, in the Introduction the authors cited my 2019 paper, with two other papers, for the statement that circulating human H3N2 viruses have evolved to use extended, branched sugar chains while the original pandemic H3N2 strain bound to shorter ones.",
      "In addition, in the Results they cited my paper, with three others, for the observation that human lung tissue carries tall, extensively branched sugar chains which were not found in the lung cell line they were using. This was the stated reason for repeating their experiments in cells taken from human airways. Finally, in the Discussion they cited it with other papers for the point that much of what is known about flu receptors comes from array experiments.",
    ],
    findings:
      "The authors found that neither human nor bird flu viruses depended strictly on one type of sugar-bearing molecule in the lung cell line, but that removing all three types sharply reduced the growth of human flu viruses, while bird flu viruses still grew by using shorter sugar chains. They concluded that bird flu viruses can use a wider range of sugar molecules for infection than human flu viruses.",
  },
  // ---------------------------------------------------------------- 7
  "cit-000199": {
    objectives:
      "The authors used mass spectrometry to catalog the sugar structures that are attached to proteins in the mallard, the chicken and the tufted duck, with a focus on structures that flu viruses might use as receptors. They asked whether differences in these receptors between bird species could explain why flu viruses do not move freely between wild birds, poultry and people. This was complementary to my research: one of the structures they looked for was the phosphorylated sugar (mannose-6-phosphate) that my 2019 paper showed flu viruses can bind.",
    importance:
      "Flu pandemics begin when a virus jumps from one species to another, and one explanation for why this does not happen more often is that the sugar receptors differ from species to species. Knowing exactly which candidate receptors each species makes is needed to judge how likely such a jump is. The authors’ finding of sugar structures in birds that had been thought to occur only in mammals may have major implications for understanding this.",
    how: [
      "Firstly, the authors described the phosphorylated sugars as “the recently identified putative IAV receptor structures” and cited my 2019 paper, together with a second 2019 paper by the same research group, as the source of that finding. They then searched for these structures in all the bird tissues and found them in every tissue of all three species.",
      "In addition, when their mass spectrometry data showed signals that were characteristic of these phosphorylated sugars, they cited my paper again to explain why the structures were of interest, and they went on to search for and count them. My paper is the one listed as Byrd-Leotis et al. 2019a in their reference list; the 2019b paper is a separate publication.",
    ],
    findings:
      "The authors found the phosphorylated sugars in all the bird tissues examined, with 469 distinct sugar-bearing protein fragments in total. They also found that all three bird species make complex sugar structures with sialic acid, the receptor type used by flu viruses, in both of its common linkages, and that the receptors present in the three bird species were similar to each other and to published data from pigs and humans. They noted that finding sialylated structures in all three bird species, structures that had been expected to occur only in mammals, may have major implications for understanding how differences in receptors limit the spread of flu viruses between species.",
  },
  // ---------------------------------------------------------------- 8
  "cit-000544": {
    objectives:
      "The authors studied a family of very stable proteins that apple snails put into their eggs to protect them from predators. They asked how a protein’s stability is related to the evolution of new functions, and studied the version of the protein from the oldest snail lineage, which they found to be among the most stable proteins known. Part of the work was to measure which sugar structures this protein binds, since it acts as a lectin (a sugar-binding protein), and to compare this with the same protein from two related snail groups. They did the comparison with GLAD, the glycan array analysis tool that I developed. This was complementary to my research on tools for analyzing glycan array data.",
    importance:
      "Most of what is known about why some proteins are very stable comes from engineered proteins in the laboratory, and very little from proteins that nature has produced and evolved. The snail egg proteins offer a rare natural example. Understanding how stability and new functions develop together helps to explain how proteins evolve, and how defensive molecules such as these egg proteins protect the eggs.",
    how: [
      "The authors measured the sugar-binding of the protein on a glycan array, a glass slide printed with many sugar structures. They wrote that the results of the glycan specificity analysis for their protein “were compared with those of PsSC (Ituarte et al., 2018) and PdPV1 (Brola et al., 2020) using the Glycan Array Dashboard (glycotoolkit.com/GLAD/) (Mehta and Cummings, 2019)”. They therefore used my tool, named in full and cited to my 2019 paper, to put the results for their protein next to the earlier results for the two related proteins.",
      "This comparison supported one of the main findings in the abstract: that the protein from the oldest lineage binds sugars less strongly and with a narrower range than the one from the closely related group.",
    ],
    findings:
      "The authors found that the protein from the oldest snail lineage was extremely stable, and that its sugar-binding was milder and narrower than that of the related proteins. Stability fell from lineage to lineage, while the proteins’ defensive roles changed. They concluded that the work gives one of the first examples from natural evolution of a link between a protein’s structure, its stability, and the evolution of new functions.",
  },
  // ---------------------------------------------------------------- 9
  "cit-000521": {
    objectives:
      "The authors built glycan arrays that contain sugar structures carrying sialic acids and sulfate groups, (which carry a negative charge), made with enzymes. They used the arrays to find out exactly which structures commonly used lectins (sugar-binding proteins) and antibodies recognize, and to compare simple chains with the larger branched structures typical of proteins in the body. They presented the results as heat maps generated with GLAD, the glycan array analysis tool that I developed. This was complementary to my research on tools for analyzing glycan array data.",
    importance:
      "Lectins and antibodies that recognize particular sugars are used every day to screen for patterns of sugars on cells and for diagnostic tests on tissue samples. If a reagent recognizes a narrower range of structures than was assumed, a result obtained with it can be misread. The authors point out that unexpected recognition patterns are still being found for such widely used reagents, so measurements of this kind are needed.",
    how: [
      "The authors’ main results are shown as heat maps, which use color to show how strongly each protein bound to each sugar structure. In the legends of the figures they stated that “The heat map was generated using the GLAD tool”, and in the Methods they wrote that the data were shown as heat maps “generated using the GLAD tool (59)”, citing my 2019 paper.",
      "My tool therefore produced the figures that carry the study’s results, and it did so using one common color scale in which the signals were normalized to 70,000 as the maximum, so that the results of the different experiments are shown on the same scale.",
    ],
    findings:
      "The authors found that for most of the lectins and sugar-binding proteins they tested, there were no severe differences between the larger branched structures and the simple chains. They also found that the presence of sulfate was not needed for efficient antibody binding; what mattered was the way a neighboring sugar was linked. They concluded that the new arrays allow the specificity of these widely used reagents to be re-examined.",
  },
  // ---------------------------------------------------------------- 10
  "cit-000629": {
    objectives:
      "The authors isolated antibodies from people who had taken part in HIV vaccine trials, concentrating on antibodies that recognize the sugars covering HIV, and tested whether those antibodies also react with other disease-causing organisms. HIV hides from the immune system under a dense coat of sugars (the “glycan shield”), and their idea was that antibodies to these sugars could be turned into a way of defeating this shield. This was complementary to my research in two ways: they used my reusable glycan array method (MAWE) to test the antibodies, and they drew the sugar structures in their figures with my application GlycoGlyph.",
    importance:
      "An HIV vaccine has to teach the body to make antibodies that bind the virus. The sugar coat of HIV has long been an obstacle to the design of antibody-based vaccines. The authors proposed that antibodies to the sugar coat could be used as a strategy to turn the shield into a “Trojan horse”, and showed that the antibodies they found were safe enough to pursue, because although they react with some of the body’s own molecules, the overall reactivity was limited.",
    how: [
      "Firstly, the antibodies were tested on a glycan array containing 562 different sugar structures. The authors wrote that this was done “following a previously reported microwave-assisted wet-erase protocol, but with several exceptions” and cited my 2024 MAWE paper, and the legend of the main binding figure repeats that the protocol was followed “by Mehta et al.”. In other words, the experiment that identified which sugars each antibody bound followed the method I developed, with the authors listing the changes they made.",
      "In addition, the authors stated that the figures of sugar structures “were gathered using GlycoGlyph” and cited my 2020 GlycoGlyph paper, both in the Methods and in the legend of the same figure. The sugar diagrams that show what each antibody recognizes were therefore drawn with my application.",
    ],
    findings:
      "The authors found that the sugar-reactive antibodies from the vaccine trial participants showed broad cross-reactivity with other pathogens, and proposed that such a shared type of antibody response could be used as the target for vaccine candidates that act against many forms of HIV. They concluded that the antibodies they studied were favorable and safe to pursue in future HIV vaccine trials.",
  },
  // ---------------------------------------------------------------- 11
  "cit-001253": {
    objectives:
      "The authors studied intelectin-2, a protein found at the mucus-lined surfaces of mammals, such as the gut and airways, whose function was not well understood. They found that it attaches to the sugars of mucus and of bacteria, that it causes bacteria it binds to lose viability, and that it does not harm human cells, so it acts as a natural antimicrobial protein. Part of the work used glycan microarrays, glass slides printed with many sugar structures, to see which microbial sugars the protein binds. This was complementary to my research: in describing these microarray experiments the authors cited my 2024 paper on reusing glycan microarrays (MAWE).",
    importance:
      "Mucus-lined surfaces such as the gut and airways are home to huge numbers of microbes, and the body has to keep them in balance, tolerating helpful ones and holding back harmful ones. The proteins that do this are still poorly understood. Showing that intelectin-2 recognizes microbes and weakens them is a step toward understanding how the body defends these surfaces.",
    how: [
      "In the Methods, when explaining why the signal strengths of the microarrays differed from one experiment to another, the authors noted that the core facility that supplies the arrays had started to regenerate and reuse slides. They cited my 2024 MAWE paper at the end of that sentence. Regenerating and reusing a slide is the procedure my paper describes, so the authors referred their readers to my paper as the published method for it.",
    ],
    findings:
      "The authors concluded that intelectin-2 is a broad-spectrum antimicrobial protein: it binds mucus and the surfaces of microbes through calcium-dependent sugar recognition, and the microbes it binds lose viability while human cells do not. They also suggested that a particular chemical group (an amine) on the microbe’s sugars may be an additional target for the human version of the protein.",
  },
};

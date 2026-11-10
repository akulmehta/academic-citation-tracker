"use strict";
/** Section II prose of the Word document, part 2 of 2 (see docx-text-a.js for the style notes). */
module.exports = {
  // ---------------------------------------------------------------- cit-000518
  "cit-000518": {
    objectives:
      "The authors studied the sugar structures (glycans) of Schistosoma haematobium, a parasitic worm that causes schistosomiasis and is responsible for most human schistosome infections, but which had been studied far less than its relative Schistosoma mansoni. They asked whether the two species make different sugars, and whether those differences matter for the immune response and for diagnosis. To test this they printed the worms’ sugars on a glycan microarray, a glass slide, and measured which of them antibodies from infected people recognized. They visualized and analyzed these results with GLAD, the glycan array analysis tool that I developed. This was complementary to my research on tools for analyzing glycan array data.",
    importance:
      "Schistosomiasis is a disease caused by parasitic worms, and S. haematobium causes the majority of infections, yet most of the detailed work on the sugars of these worms had been done on the other species. If the sugars of the two species differ, then findings or tests developed for one cannot simply be assumed to work for the other. The authors found substantial differences from S. mansoni, which means that assumptions carried over from that species cannot be relied on.",
    how: [
      "In the Methods the authors wrote that “GLycan Array Dashboard (GLAD)”, “from the glycotoolkit website (glycotoolkit.com/Tools/GLAD/) hosted by the National Center for Functional Glycomics, was used for data visualization, data mining, generation of heatmaps and boxplot graphs”, and cited my 2019 paper. They therefore named my tool as the means by which the microarray results were visualized and mined.",
      "The same outputs, heat maps and box plots of how strongly antibodies bound each sugar, are how the results of the study are presented, so my tool produced the figures that show which of the worm’s sugars the antibodies of infected people recognize.",
    ],
    findings:
      "The authors found that the two worm species are glycosylated differently, with differences in the core structure, the pattern of fucose and the glucuronic acid groups on their sugar-lipid molecules, and that antibodies from people infected with S. haematobium bound the acidic sugar-lipids more than antibodies from people infected with S. mansoni. They concluded that S. haematobium sugars are involved in the interaction between the parasite and the host’s immune system, and they identified specific sugars of this species that the immune system recognizes, which could be used for diagnosis.",
  },
  // ---------------------------------------------------------------- 12
  "cit-000594": {
    objectives:
      "The authors introduced AquIRE, a new laboratory method for detecting damage to RNA caused by cancer drugs, and used it to study glycoRNAs, which are RNA molecules that carry sugar chains (glycans) on them. The method was designed to be sensitive enough to detect RNA changes that earlier methods missed. This was complementary to my research on tools for working with glycans: the authors drew the glycan structures in their figures with GlycoGlyph, the application I developed for drawing and naming glycan structures.",
    importance:
      "Several widely used cancer drugs, including 5-fluorouracil, cisplatin and oxaliplatin, are known to damage RNA, and a sensitive way of detecting that damage helps to show how they act. GlycoRNAs are a recently reported and still debated type of molecule, so a method that can detect them reliably, and show that they behave in the way earlier studies described, is a useful addition to the field.",
    how: [
      "The authors needed to show the sugar structures that were attached to the RNA, and in the Methods section on how the figures were made they wrote simply that “Glycans were drawn using GlycoGlyph” and cited my 2020 paper that describes the application.",
      "GlycoGlyph is meant for exactly this task, drawing glycan structures in the standard notation and giving them standard names, so the authors used it for the glycan drawings in their paper in Nucleic Acids Research.",
    ],
    findings:
      "The authors showed that AquIRE could detect the RNA damage caused by clinically used drugs and that, combined with lectins (proteins that recognize particular sugars), it could detect glycoRNAs. They concluded that the glycoRNAs detected this way behaved similarly, at the molecular level, to those described in earlier studies.",
  },
  // ---------------------------------------------------------------- 13
  "cit-000542": {
    objectives:
      "The authors compared the tiny packets (extracellular vesicles) that human and mouse blood platelets release when they are activated. These packets carry signaling molecules between cells and are being explored as a way to deliver drugs. Because mice are widely used to study them, the authors asked whether the proteins and sugars on the surface of the mouse packets resemble those of human ones. One part of the study used an array of sugar-binding proteins (lectins) to profile the sugars present, and the authors analyzed those data with GLAD, the glycan array analysis tool that I developed. This was complementary to my research on tools for analyzing glycan array data.",
    importance:
      "If a drug-delivery packet from mouse platelets behaves differently from a human one, results obtained in mice cannot be transferred to patients without care. The sugars on the surface of the packets decide which cells they interact with, so a systematic comparison of the surface sugars of mouse and human packets was needed before mouse studies could be interpreted for human use. The authors found that there are differences between the species which should be considered when designing future studies.",
    how: [
      "Firstly, in the section of the Methods on glycan array analysis, the authors wrote that “Glycan Array Dashboard (version 3.1) was used to analyze and visualize the glycan array data” and cited my 2019 paper on GLAD. My tool was therefore used to analyze and display the sugar profiles of the mouse and human packets.",
      "In addition, in the Acknowledgments the authors thanked me by name, “Akul Mehta (Harvard University)”, “for valuable discussions and help with the glycan tool Glycan Array Dashboard” and with the standard glycan names used by the Consortium for Functional Glycomics. They therefore consulted me directly about the use of my tool and credited the help they received.",
    ],
    findings:
      "The authors found that the packets from mouse platelets showed a clearly different pattern of proteins and surface sugars from those of human platelets: for example, less galactose and fucose on the mouse packets and more mannose on the human ones. They concluded that these species-specific differences could change how the packets are recognized by cells and tissues, and that they should be taken into account in future studies that use mice to study platelet packets.",
  },
  // ---------------------------------------------------------------- 14
  "cit-000619": {
    objectives:
      "The authors determined the three-dimensional structure of the secreted acid phosphatase of Leishmania, a parasite that causes leishmaniasis, a neglected tropical disease. This enzyme is released by the parasite in large amounts and helps it to cause disease. They asked how it assembles into very stable filaments, a way of building protein structures that is unusual. The enzyme carries a sugar chain, and to build a model of that sugar chain in the structure they used GlycoGlyph, the glycan drawing application that I developed. This was complementary to my research on tools for working with glycans.",
    importance:
      "Leishmaniasis is a neglected tropical disease, and the parasite’s secreted enzyme is regarded as a major factor in its ability to cause disease. Most proteins that form filaments can switch between single molecules and filaments depending on conditions, whereas this one does not, which is unusual and needs to be explained. Knowing how the filaments are held together is a first step toward understanding how the parasite works and how it might be stopped.",
    how: [
      "In the Methods the authors wrote that “A model of the N-linked glycan containing two N-acetylglucosamine (GlcNac) units and a mannose (Man) was generated in GlycoGlyph (Mehta & Cummings, 2020)”. They used my application to generate the structure of the sugar chain that was attached to the protein, and this model was fitted into the three-dimensional structure that they had determined.",
      "The authors cited my paper directly in the text, naming the application, and so showed that my tool supplied a specific part of the structure on which their analysis was built.",
    ],
    findings:
      "The authors concluded that the filaments form through a combination of specific interactions inside a small hairpin-shaped part of the protein, not just by the presence of that part, and that these interactions create a large contact surface which explains why the filaments are so stable under many chemical conditions. They also found that the sugar chain they examined is not crucial for the enzyme to assemble, to stay in solution or to work.",
  },
  // ---------------------------------------------------------------- 15
  "cit-000516": {
    objectives:
      "The authors studied a protein from zebrafish, a galectin (a sugar-binding protein), that is made in the skin and gills. They asked where it is made, which sugars and bacteria it binds, and whether, because it is present in the mucus that covers the skin, it could influence how bacteria attach. This was complementary to my research: the sugar-binding measurements used a glycan microarray, a glass slide printed with many sugar structures, which the authors performed following procedures that included my reusable-array method (MAWE), analyzed with my analysis tool GLAD and illustrated with my drawing application GlycoGlyph.",
    importance:
      "The skin and gills of a fish are covered by mucus and are in constant contact with the microbes in the water. A sugar-binding protein in that mucus could either give bacteria something to attach to or bridge bacteria to one another and so help to clump them. Knowing which of the two it does is important for understanding how the mucus of a fish, an important model organism, deals with bacteria.",
    how: [
      "Firstly, the authors described their glycan microarray analysis as “following established procedures” and cited three papers, two of which are mine: my 2024 paper on reusable glycan microarrays (MAWE), and a 2024 review of glycan microarray technologies that I co-authored. The experiments that showed which sugars the zebrafish protein binds were therefore done following methods I had published.",
      "In addition, they wrote that “The results were analyzed by the GLycan Array Dashboard (GLAD) platform [128], and the glycan models were constructed using GlycoGlyph [129]”, citing my 2019 GLAD paper and my 2020 GlycoGlyph paper. The binding results for the protein were therefore analyzed in my tool and the sugar structures shown beside them were drawn with my application, so the Methods section of this paper uses four of my publications.",
    ],
    findings:
      "The authors found that the protein is made in the skin and gills, binds to bacteria and to the bacterial surface molecules that attach to the host, and prefers a particular type of galactose-containing sugar, which the microarray confirmed. They concluded that the protein in the mucus is more likely to bridge bacteria to each other, helping to clump them, than to act as a docking point for them.",
  },
  // ---------------------------------------------------------------- 16
  "cit-000621": {
    objectives:
      "The authors developed LeGenD, a method that uses artificial intelligence together with measurements of how a panel of sugar-binding proteins (lectins) react to a sample, in order to work out which sugar chains are attached to a protein. They wanted a method that could profile these sugar chains faster and with results that can be explained. They drew the sugar structures that present their results with GlycoGlyph, the glycan drawing application that I developed. This was complementary to my research on tools for working with glycans.",
    importance:
      "As the authors put it, “as awareness of the importance of glycosylation increases, new technologies are needed to increase the accessibility and throughput of glycan research tools”. Their method is meant to make the profiling of sugar chains faster and easier to carry out, and its explanation step lets a reader see which measurements led to each prediction, which answers a common worry that artificial intelligence methods act as a black box.",
    how: [
      "In the Methods the authors wrote that “the glycan structures were drawn using GlycoGlyph (112)” and gave the web address of the tool, citing my 2020 paper. In a paper that presents a new computer method for glycan analysis, my application was the means by which the sugar structures, which are how the method’s results are communicated, were represented.",
    ],
    findings:
      "The authors showed that LeGenD can profile the sugar chains of proteins at high throughput, and that an additional analysis (SHAP) can show which lectin measurements led to each prediction, which gives a better understanding than the model’s internal numbers alone. They concluded that new technologies are needed to make glycan research tools more accessible and higher in throughput, which is the aim that my own tools were built to meet.",
  },
  // ---------------------------------------------------------------- 17
  "cit-000613": {
    objectives:
      "The authors studied how a lack of zinc changes the mucus that is made by the goblet cells lining the gut. Lack of zinc affects about one billion people worldwide and is linked to infections, inflammation and diarrhea, but how it changes the mucus barrier was poorly understood. They measured gene activity, the sugar structures on mucus proteins and the mucus proteins themselves in a human goblet-cell model. In the figures that show these sugar structures, they used GlycoGlyph, the glycan drawing application that I developed. This was complementary to my research on tools for working with glycans.",
    importance:
      "The mucus layer is part of the gut’s defense barrier, and when zinc is lacking this barrier is compromised and the mucus is altered. How this happens had not been explained. The authors’ results point to specific changes in how the mucus proteins are made and decorated with sugars, which could help to explain the effects of zinc deficiency on health.",
    how: [
      "The authors used my application in two figures. In the first (Figure 1), a diagram of how the sugar chains of mucus proteins are built, the legend states that the “Glycan structures were drawn with GlycoGlyph” and cites my 2020 paper.",
      "In addition, the legend of the figure that shows the sugar structures measured by mass spectrometry (Figure 6) states “Glycans were drawn with GlycoGlyph” with the same citation. The sugar structures in both the overview diagram and in the figure of the measured results were therefore drawn with my application.",
    ],
    findings:
      "The authors found that a lack of zinc changed the activity of many genes in the cells, including genes for zinc transport, mucus production and sugar attachment, and that the mucus proteins MUC2 and MUC17 increased. The sugar attachment to the mucus changed too, with more sialic acid and far fewer complex sugar chains of one type (N-glycans). They concluded that zinc is essential for the normal composition of mucus.",
  },
  // ---------------------------------------------------------------- 18
  "cit-000602": {
    objectives:
      "The authors studied the surface protein (hemagglutinin) of a bird flu virus (H5N1) that infected a teenage patient in British Columbia in 2024. They asked whether this virus could bind to the sugar receptors that flu viruses use to enter cells. They found that a sugar chain that sits in the receptor-binding pocket of earlier H5 proteins was missing from this one, and that the protein bound very weakly to the receptors tested. In the figures that show the sugar structures they used GlycoGlyph, the glycan drawing application that I developed. This was complementary to my research on tools for working with glycans.",
    importance:
      "Bird flu viruses become a pandemic risk when they gain the ability to bind to the receptors of human cells. A human case is therefore an important opportunity to study how such a virus behaves. The authors found that the changes in this patient’s virus made receptor binding weaker, not stronger. They also found that the virus remained susceptible to antiviral drugs and that the patient’s blood, after infection, bound the protein strongly, which helps to assess the pandemic risk.",
    how: [
      "In the Methods the authors stated that “We produced glycan schematics using GlycoGlyph then adjusted them on Inkscape”, and that the sugar schematics for Figure 5 were “produced on GlycoGlyph with adjustments on Inkscape” (those for Figures 3 and 4 were adapted from the supplier of the arrays), citing my 2020 paper. They used my application to draw the sugar structures in that figure, and then made small cosmetic changes in a general drawing program.",
      "Figure 5 is the figure showing how each individual mutation reduced binding to the two types of sialic acid receptor, which is one of the core results of the study. My application therefore supplied the receptor structures that are drawn in this figure.",
    ],
    findings:
      "The authors found that the patient’s virus protein bound very weakly or not at all to the two main types of flu receptor, but that the full-length protein could still cause cells to fuse, at a lower level than earlier H5 proteins, and that the patient’s blood, after infection, bound the protein strongly. They concluded that the virus consisted of several mixed populations, because each of the two mutations they studied reduced binding on its own and together.",
  },
  // ---------------------------------------------------------------- 19
  "cit-001257": {
    objectives:
      "The authors studied how a particular type of broadly protective HIV antibody (the QA013.2 lineage) first started to develop in a person. The usual idea is that such antibodies mature as the body fights HIV, but the earliest form of this antibody did not bind the part of HIV that the mature one targets. They therefore tested whether other, non-HIV molecules might have triggered the first steps, using screens of many different antigens. This was complementary to my research: part of the screening used glycan arrays, and the authors analyzed their glycan array data with my MAWE method.",
    importance:
      "An effective HIV vaccine has to start the same chain of changes in antibodies which led to broadly protective antibodies in some infected people. One of the biggest obstacles is that it is not known what started the process, because the earliest forms of the antibodies often do not bind HIV. If the trigger is something other than HIV, a vaccine may need to include more than HIV-derived molecules, which is the conclusion that the authors drew.",
    how: [
      "In the Methods, in the part describing the glycan arrays, the authors wrote that “Data were analyzed using the MAWE method as described previously” and cited my 2024 paper that describes MAWE. The authors therefore used my published method for the processing and analysis of the glycan array data, which was one of the screens they used to look for possible triggers.",
    ],
    findings:
      "The authors found that the antibody lineage had acquired mutations before the patient was infected with HIV, which is consistent with the idea that something other than HIV started the process. They noted that the trigger, if it was a non-HIV one, may involve weak binding or complex shapes or sugar patterns that are difficult to detect in standard screens. They concluded that eliciting the best HIV antibodies may require molecules in addition to those derived from HIV.",
  },
  // ---------------------------------------------------------------- 20
  "cit-000416": {
    objectives:
      "The authors studied how a virus called IHHNV, which damages farmed Pacific whiteleg shrimp, attaches to the shrimp’s tissues. They asked whether the virus uses sugar chains on the surface of the shrimp’s cells as its attachment points, and tested the binding of virus-like particles to a glycan microarray, a glass slide printed with hundreds of different sugar structures. They concluded that the virus uses high-mannose N-glycans and certain fucose-containing sugars. This was complementary to my research: they processed the array data with my MAWE workflow, analyzed them with my GLAD tool and cited my work on how proteins recognize mannose-rich sugars.",
    importance:
      "The virus damages farmed shrimp, and how it gets into the shrimp’s tissues was not understood. Finding that the virus attaches through particular sugars points to a way of interfering with infection, for example by blocking the attachment, and helps to explain which tissues the virus can infect.",
    how: [
      "Firstly, the authors described the array measurements and, for the way the numbers were processed, wrote that the signals “were processed using the MAWE workflow, which excludes the highest and lowest replicate values before calculating the mean” and cited my 2024 MAWE paper. The procedure I published was therefore used to calculate every value in their binding results.",
      "In addition, they wrote that the results were analyzed with GLAD (Glycan Array Dashboard), which “enables comparison of binding profiles and identification of enriched glycan motifs”, and cited my 2019 GLAD paper. My tool was thus how the binding profiles were compared and the sugar patterns that the virus favored were identified. They also cited a 2024 review of glycan microarray technologies that I co-authored for the array platform they used.",
      "Finally, in the Discussion they cited a 2021 study that I co-authored on how immune proteins recognize different forms of mannose-rich sugars, for the point that such proteins recognize these sugars much more specifically than was thought. This was used to explain why their array, which lacked some of those sugars, may not have shown all of the virus’s targets.",
    ],
    findings:
      "The authors found that the virus particles bound the types of sugar that would be expected for an attachment step, and their results strongly supported the presence of complex sugars with terminal mannose, GlcNAc or GalNAc, and fucose on the shrimp’s side. They concluded that high-mannose N-glycans and fucose-containing O-glycans act as the main attachment factors for the virus.",
  },
};

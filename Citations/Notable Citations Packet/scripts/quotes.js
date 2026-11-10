"use strict";
/**
 * The quotations of one citing article, as the Word documents show them: every filed quote and every verified
 * mention, each once (per page), with the extraction debris cleaned up, oldest page first.
 */
// Sentences the database holds only as a fragment, or with extraction debris in front.
const EXTRA_QUOTES = {
  "cit-000199": [{ q: "This would be in line with Man-6P N-glycopeptides (Čaval et al. 2019) and is of particular interest as such structures recently were proposed to serve as receptors for IAVs (Byrd-Leotis et al. 2019a; Byrd-Leotis et al. 2019b).", sec: "Results (Identification of oligomannose 6-phosphorylated (Man-6P) N-glycopeptides)", pg: 8 }],
  "cit-000396": [{ q: "The slight changes in glycan structure, which nonetheless led to appreciable differences in their binding behavior, made this a particularly challenging case study for our model.", sec: "Results (validation on customized glycan arrays)", pg: 8 }],
  "cit-000629": [{ q: "Diagrams of glycan structures were generated using GlycoGlyph (49). Glycan microarray protocol was followed using the microwave-assisted wet-erase process by Mehta et al. (50).", sec: "Results (figure legend)", pg: 6 }],
  "cit-000542": [{ q: "We also thank Akul Mehta (Harvard University) for valuable discussions and help with the glycan tool Glycan Array Dashboard and Consortium for Functional Glycomics (CFG) names", sec: "Acknowledgments", pg: 12 }],
  "cit-000602": [{ q: "We produced glycan schematics using GlycoGlyph then adjusted them on Inkscape", sec: "Materials and Methods", pg: 11 }],
};
const QUOTE_FIX = {
  "cit-000516": [["(accessed on 25 November 2025) ", ""], ["Glycan Microarray Analysis Glycan microarray analysis", "Glycan microarray analysis"]],
  "cit-000619": [["ing two N-acetylglucosamine (GlcNac) units", "A model of the N-linked glycan containing two N-acetylglucosamine (GlcNac) units"]],
  "cit-000602": [["3 and 4 and produced on GlycoGlyph with adjustments on Inkscape for Fig.", "Glycan schematics adapted from Z Biotech for Figs. 3 and 4 and produced on GlycoGlyph with adjustments on Inkscape for Fig. 5"]],
  "cit-000518": [["Finally, GLycan Array Dashboard (GLAD) 93", "Finally, GLycan Array Dashboard (GLAD) 93, version 3.1, from the glycotoolkit website (glycotoolkit.com/Tools/GLAD/) hosted by the National Center for Functional Glycomics, was used for data visualization, data mining, generation of heatmaps and boxplot graphs"]],
};
const SECTION_FIX = { "cit-000613:11": "Figure legend" };


function buildQuotes(db, uid, rows) {
    // quotes: each row's verified quote, then any mention not already inside one of them
    const quotes = [];
    const seen = new Set();
    const strip = s => s.toLowerCase().replace(/[^a-z0-9]/g, "");
    const dup = (k, pg) => {
      const a = strip(k);
      return [...seen].some(([s, spg]) => {
        if (String(spg) !== String(pg)) return false;     // the same words on another page are another instance
        if (s.includes(a) || a.includes(s)) return true;
        for (let i = 0; i + 40 <= a.length; i += 10) if (s.includes(a.slice(i, i + 40))) return true;
        return false;
      });
    };
    const push = (q, sec, pg, whole) => {
      const k = q.replace(/\s+/g, " ").trim().replace(/^[.,;:\s]+/, "");
      if (!k) return;
      if (!whole && (k.length < 30 || !/^[A-Z(“"]/.test(k))) return;   // a snippet that starts mid-sentence is not quotable
      if (dup(k, pg)) return;
      seen.add([strip(k), pg]); quotes.push({ q: k, sec: (SECTION_FIX[uid + ":" + pg] || sec), pg });
    };
    for (const r of rows) if (r.quote) push(r.quote, r.section, r.page, true);
    for (const r of rows) {
      for (const m of db.prepare("SELECT * FROM mention WHERE row_uid=? ORDER BY page").all(r.row_uid)) push(m.quote || "", m.section, m.page, false);
    }
    for (const x of (EXTRA_QUOTES[uid] || [])) push(x.q, x.sec, x.pg, true);
    for (const x of quotes) for (const [a, b] of (QUOTE_FIX[uid] || [])) x.q = x.q.replace(a, b);
    quotes.sort((a, b) => parseInt(a.pg, 10) - parseInt(b.pg, 10));

    return quotes;
}
module.exports = { buildQuotes };

# Key rules to keep in mind
The following rules should be kept in mind when finding citations:

In most cases, how your work was used is more important than who used your work.
USCIS is likely to value citations from other experts in the field who have:
1. Implemented your work in their own research by directly adopting your methods,
techniques, processes, or models;
2. Compared your work to their own or that of others in a way that reveals that yours is
superior in some way;
3. Utilized your work to develop an improved technology, treatment, or method in the field;
or
4. Verified the results of your work by successfully applying it to their own research topic.

Other significant citations can come in the form of patents, government or technical
reports, clinical trials, field guidelines or recommendations, or any other similar
implementation of your work. USCIS may also place greater weight on citations from
government institutions and industry, particularly if researchers at those institutions have
significantly implemented and benefited from your work in some way.

It can also be helpful to consider the frequency and length of the citations to your work. It
is unlikely that one sentence that cites not only your work, but also several other papers, is going
to be of significant value. However, if a paper cites several of your studies and discusses your
work at length, this is more likely to be seen as having significant value to the reviewing officer.
This is not necessarily a definitive rule, and it may be the case that a one sentence citation can
still be valuable in context, but more thorough discussions of your work can often help indicate
which citations are more significant.

Therefore it is most important to find citations in the methods sections of publications is ideal 
with those in results section as.

Citations that only briefly mention your work in passing are unlikely to be considered
particularly significant by USCIS. These types of citations frequently occur in the introduction
or discussion sections of a paper to provide background information on the topic, but don’t 
necessarily show that those researchers actually used, benefited from, or were substantially influenced by your work. As such, these types of citations are not usually the best types of evidence to submit to
show the impact of your work. We should also avoid highlighting citations that could be
interpreted as discussing your work in a negative way. Citations that outline limitations,
drawbacks or weaknesses of your work, or where the authors show that their work surpasses
your own in some way, are more likely to hurt your case than help.

To establish the location of the citation you should parse the pdf or the retrieved publication and
then retrieve snippets and use your AI judgement to determine the exact location and context of the citation within the paper.

Citations which were already used in the original petition (workspace folder `Citations\Notable Citations in Original Application`) if found again should be marked clearly in the summary.

# Citation Summary

The citation summary should have an index at the beginning, listing all citations with their corresponding numbers for easy reference.

The index should include the citation number, the title of the citation, the earliest date of the cited paper (this can be the preprint date and if so it should be marked), the publication or acceptance date, the tool used, the location of the citation in the paper, the senior author, the row UID, and the PDFs associated with the citation.

# Template of what we need to document

For each citation we need the following. Let's store this information in a structured format, such as csv 
file which we can then use to generate summaries using d3js in html to print to pdf.

``` md
## Citation Number

### SECTION 1: BACKGROUND INFORMATION

#### Cited Paper(s):
(Please indicate which of your papers was cited.)

#### Citing Paper:
(Please provide the formal citation of the paper that cited your work.)

#### Project Number:
(Please indicate which project from your Research Background Inquiry Form or Summary of Contributions section relates to this citation.)

My projects are as follows:
1.	Synthesizing Anticoagulants with Reduced Side Effects
2.	Developing Bioinformatics Tools to Capture and Analyze Glycomics and Glycan Microarray Data
3.	Advancing Glycan Research with Microarray Innovations
4.	Advancing Glycopeptide Synthesis with Glyco-SPOT

#### Citing Authors’ Institutions:
(If the citing authors’ institution(s) have any particular significance for your field – for instance, World Health Organization – please provide that information.)

#### Citing Article Type:
(Please indicate whether the citing article is original research, a review article, a clinical study, a patent, a funding application, conference material, clinical guidelines, etc.)

### SECTION II: OVERVIEW OF THE USE OF YOUR WORK

#### Citation to Your Work:
(Please provide the quote of any text that directly cites to your work in the citing article.)

#### Citing Article’s Objectives:
(Please describe in 3-4 sentences what the objective or goals of the citing authors were for their research and how it relates to your work generally.)

#### Citing Article’s Importance to the Field:
(Please describe in 2-3 sentences why the citing article is important – for instance, how such research fits into the larger discussion or goals in your field.)

#### How and Why Your Work Was Used:
(Please describe in 4-5 sentences how and why the authors used your work, why it benefited them, and/or how it facilitated their argument or discussion. What was the function of your work in relation to the citing authors’ research? Please be as specific and detailed as possible.)

#### Citing Article’s Findings, Conclusions, & Recommendation:
(Please describe in 4-5 sentences the results of the authors’ research. You can discuss not only their specific findings, but also the broader implications of their findings such as any policy considerations or areas for future research. Please also indicate how your work relates to and/or helped lead to these findings and conclusions.)
```
 
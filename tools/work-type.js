// Work-type classification for citing records.
//
// Why this exists: Google Scholar's "cited by" list mixes journal articles with
// patents, and the two are different kinds of evidence. A patent that cites the
// PI's work shows the work reached inventors and industry, which is a distinct
// claim from a scholarly citation, so it has to be separable from the article
// count rather than buried inside it.
//
// Classification is deliberately conservative. A record is only called a patent
// on positive evidence -- a patents.google.com link, a USPTO or Espacenet link,
// or a venue/author string that says "Patent". Everything else stays "article"
// or "unknown"; nothing is guessed.
//
// Which text may decide (fixed 2026-10-30). Scholar prints the carrier of a
// document -- "US Patent App. 18/632,623, 2025 - Google Patents" -- into the
// author line, so venue evidence lives in `authors` / `authors_used`, and in
// `external_title` / `external_authors` when corroboration resolved an external
// record. The TITLE and SNIPPET are deliberately NOT scanned: a journal article
// about patent landscapes ("An update on recent patents on thrombin
// inhibitors") was previously misfiled as a patent because its title said so.
// Text matching is therefore limited to the carrier fields listed at the
// bottom of this file.

// Links that mean the citing document is a patent, whatever the text says.
const PATENT_HOSTS = [
  "patents.google.com",
  "patft.uspto.gov",
  "appft.uspto.gov",
  "patentimages.princeton.edu",
  "worldwide.espacenet.com",
  "espacenet.com",
  "lens.org/patents",
];

// Scholar renders the venue into the author string, so a patent reads like
// "DC Drummond, DB Kirpotin - US Patent 11,052,079, 2021". Only ever tested
// against the carrier fields, never against a title or snippet.
//
// Two strengths, because the carrier field also holds JOURNAL names, and one of
// them is "Expert Opinion on Therapeutic Patents". A document form is required
// to call a record a patent: an office code, the words "Patent App", a "PCT"
// filing, the word Patent followed by a number, or Scholar's own "Google
// Patents" host suffix. A carrier that merely contains the word "patents" is
// reported as "unknown" for a human to settle -- not as a patent, and not as an
// article either, because guessing either way would corrupt a count.
const PATENT_DOC_TEXT =
  /\b(?:us|ep|wo|jp|cn|kr|ca)\s*pat(?:ent)?\b|\bpat(?:ent)?\.?\s*app\b|\bpct\b|\bpatent\s+[A-Z]{0,2}\s*\d|\bgoogle\s+patents\b/i;

// Any mention of patents in a carrier field, weak on its own.
const PATENT_MENTION = /\bpatents?\b|\bpct\b/i;

// Kind codes seen at the end of a publication number. A1/A2 is an application
// publication, B1/B2 is a granted patent.
const KIND_CODE = /([AB][12])\b/;

// Publication numbers. US grants read 7-8 digits, applications 11, WO reads
// year/serial, EP and others are spaced digits.
const NUMBER_IN_URL =
  /\/patent\/([A-Z]{2}[\s,-]?\d[\d,.-]{4,}[A-Z]?\d?)/i;
const NUMBER_IN_TEXT =
  /\b([A-Z]{2})[\s,-]?(\d[\d,.-]{4,}[\d])([A-Z]\d?)?\b/;
// Scholar's venue form: "US Patent 11,052,079" or "US Patent App. 18/632,623".
// NUMBER_IN_TEXT needs the office code to sit against the digits, which it does
// not here, so the word is matched separately. Whitespace is excluded from the
// digit class on purpose: "US Patent 11,052,079, 2021" must stop at the grant
// number and not swallow the year.
const NUMBER_AFTER_WORD =
  /\bpatent\s*(?:app(?:lication)?)?\.?\s*(?:no\.?|num\.?)?\s*([A-Z]{2})?\s*([0-9][0-9,./-]{4,}[0-9])/i;

function cleanNumber(raw) {
  return String(raw || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

// Pull a publication number out of a link or a line of text. Returns "" when
// there is nothing that looks like a number, which is a legitimate answer for a
// patent page whose URL Scholar truncated.
function patentNumber(...parts) {
  for (const part of parts) {
    const s = String(part || "");
    if (!s) continue;
    const viaUrl = s.match(NUMBER_IN_URL);
    if (viaUrl) return cleanNumber(viaUrl[1]);
    if (/patent/i.test(s)) {
      const viaWord = s.match(NUMBER_AFTER_WORD);
      if (viaWord) {
        // Scholar puts the office code before the word "Patent"; take it from
        // there when the number itself carries none.
        const office =
          viaWord[1] || (s.match(/\b(US|EP|WO|JP|CN|KR|CA|AU|CA)\b/) || [])[1] || "";
        return cleanNumber(`${office}${viaWord[2]}`);
      }
      const viaText = s.match(NUMBER_IN_TEXT);
      if (viaText) return cleanNumber(`${viaText[1]}${viaText[2]}${viaText[3] || ""}`);
    }
  }
  return "";
}

// The fields that carry the venue Scholar printed for the citing document.
// Exported so a test can prove the title and snippet are not part of it.
const CARRIER_FIELDS = ["authors", "authors_used", "external_title", "external_authors"];

function carrierText(entry) {
  return CARRIER_FIELDS.map((k) => entry[k])
    .filter(Boolean)
    .join(" ");
}

// Classify one citing record. Accepts the pieces the capture saved so callers
// do not have to know which field Scholar happened to put the venue in.
// Returns { work_type, patent_number, patent_kind, evidence } where work_type
// is "patent", "patent-application", "article", or "unknown" (the venue hints
// at patents without proving the document is one).
function classifyWork(entry = {}) {
  const link = String(entry.link || "");
  const externalUrl = String(entry.external_url || "");
  // Deliberately NOT the title or snippet -- see the note at the top.
  const carrier = carrierText(entry);

  const hostHit = PATENT_HOSTS.find(
    (h) => link.toLowerCase().includes(h) || externalUrl.toLowerCase().includes(h)
  );
  const docHit = PATENT_DOC_TEXT.test(carrier);
  const mentionHit = PATENT_MENTION.test(carrier);

  // Nothing positive at all: an ordinary article.
  if (!hostHit && !docHit && !mentionHit) {
    return { work_type: "article", patent_number: "", patent_kind: "", evidence: "" };
  }

  const number = patentNumber(link, externalUrl, carrier);
  // An application is only claimed on explicit wording or an A-kind code. A
  // missing kind code on a granted-looking number stays "patent" rather than
  // being guessed either way.
  const application =
    /patent\s*app|pat\.?\s*app|pct\s*(?:app|application)|\bA1\b|\bA2\b/i.test(carrier) ||
    /^[A-Z]{2}\d{7,}A[12]?$/.test(number);
  const kindMatch = number.match(KIND_CODE);
  const kind = (kindMatch && kindMatch[1]) || "";

  // A carrier that only names patents -- a journal called
  // "...Therapeutic Patents" with no patent number and no patent server link --
  // is left undecided on purpose. Folding it into the patents would overstate
  // industry uptake; folding it into the articles would hide the doubt.
  if (!hostHit && !docHit) {
    return {
      work_type: "unknown",
      patent_number: "",
      patent_kind: "",
      evidence: 'venue text mentions "patents" but shows no patent document',
    };
  }

  const evidence = [
    hostHit ? `link host ${hostHit}` : "",
    docHit ? 'Scholar venue text names a patent document' : "",
  ]
    .filter(Boolean)
    .join("; ");

  return {
    work_type: application ? "patent-application" : "patent",
    patent_number: number,
    patent_kind: kind,
    evidence,
  };
}

module.exports = {
  classifyWork,
  patentNumber,
  cleanNumber,
  PATENT_HOSTS,
  CARRIER_FIELDS,
};

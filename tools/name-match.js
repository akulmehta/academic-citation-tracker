// Author-name matching shared by the citation tools.
//
// "Desai" and "Cummings" are common surnames, so a surname match alone is not
// evidence of a shared author. Names are compared on surname plus initials. If
// the surnames collide but one side has no initials to compare, the outcome is
// UNKNOWN (needs review) rather than a match or a clean miss.

const HONORIFICS = new Set(["jr", "sr", "ii", "iii", "iv"]);

// Google Scholar separates the author list from the venue with a dash wrapped
// in NON-BREAKING spaces ("J Ma\u00a0- Journal, 2025 - site"). Without
// normalising those, the venue is not stripped and the final author is merged
// with the journal name, which silently hides a real author match.
function normalizeSpace(text) {
  return String(text || "")
    .replace(/[\u00a0\u2007\u202f\ufeff]/g, " ")
    .replace(/\s+/g, " ");
}

// A token of all-caps letters ("AY", "JD") is a run of initials and
// contributes each letter. A written-out name ("Akul") contributes only its
// first letter, so "Akul Y Mehta" and "AY Mehta" compare equal.
function initialsOf(tokens) {
  const out = [];
  for (const t of tokens) {
    const stripped = t.replace(/[^A-Za-z]/g, "");
    if (!stripped) continue;
    if (HONORIFICS.has(stripped.toLowerCase())) continue;
    const isInitialRun =
      stripped.length > 1 && stripped === stripped.toUpperCase();
    if (isInitialRun) {
      for (const ch of stripped.toLowerCase()) out.push(ch);
    } else {
      out.push(stripped[0].toLowerCase());
    }
  }
  return out;
}

// Accepts "AY Mehta", "Akul Y Mehta", and BibTeX "Mehta, Akul Y".
function parseOne(raw) {
  const name = normalizeSpace(raw)
    .replace(/\u2026|\.{2,}/g, "")
    .trim();
  if (!name) return null;
  let surname;
  let given;
  if (name.includes(",")) {
    const [a, b] = name.split(",");
    surname = a;
    given = b || "";
  } else {
    let parts = name.split(/\s+/).filter(Boolean);
    // Trailing generational suffixes are not the surname.
    while (
      parts.length > 1 &&
      HONORIFICS.has(parts[parts.length - 1].replace(/[^A-Za-z]/g, "").toLowerCase())
    ) {
      parts = parts.slice(0, -1);
    }
    surname = parts[parts.length - 1] || "";
    given = parts.slice(0, -1).join(" ");
  }
  const surnameKey = surname.toLowerCase().replace(/[^a-z-]/g, "");
  if (!surnameKey) return null;
  return {
    display: name,
    surname: surnameKey,
    inits: initialsOf(given.split(/\s+/).filter(Boolean)),
  };
}

// Scholar snippets look like "Y Seo, JE Park, B Lee - Venue, 2025 - domain".
// A trailing ellipsis means the list was cut short.
function parseAuthorList(text) {
  let s = normalizeSpace(text);
  // Drop the venue tail first, then any trailing ellipsis left behind.
  const dash = s.indexOf(" - ");
  if (dash !== -1) s = s.slice(0, dash);
  return s
    .split(",")
    .map(parseOne)
    .filter((p) => p && p.surname);
}

function compareInits(a, b) {
  if (!a.length || !b.length) return "UNKNOWN";
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) {
    if (a[i] !== b[i]) return "CONFLICT";
  }
  return "MATCH";
}

function matchKey(target, people) {
  let status = "NONE";
  const hits = [];
  for (const p of people) {
    if (p.surname !== target.surname) continue;
    const r = compareInits(target.inits, p.inits);
    if (r === "MATCH") {
      status = "MATCH";
      hits.push(p.display);
    } else if (r === "UNKNOWN" && status !== "MATCH") {
      status = "UNKNOWN";
      hits.push(p.display);
    }
  }
  return { status, hits };
}

// Keys are given as "AY Mehta,RD Cummings". Returns { keys, missingInitials }.
function toKeys(value) {
  const keys = String(value || "")
    .split(",")
    .map((s) => parseOne(s))
    .filter((p) => p && p.surname);
  return { keys, missingInitials: keys.filter((k) => !k.inits.length) };
}

// PubMed writes each author as "Surname Initials" with no comma ("Cummings RD").
// parseOne reads a comma-less name as "Given Surname", so it would take "RD" as
// the surname and never match the PI. Only the source knows which order it
// uses, so a caller holding a PubMed list converts it here before matching.
function fromVancouver(name) {
  const s = normalizeSpace(name).trim();
  const m = s.match(/^(.*\S)\s+([A-Z]{1,3})$/);
  if (!m) return s;
  return `${m[2].split("").join(" ")} ${m[1]}`;
}

// Check one target group against the parsed citing authors.
function checkGroup(targets, people) {
  let status = "NONE";
  const hits = [];
  for (const t of targets || []) {
    const r = matchKey(t, people);
    if (r.status === "MATCH") {
      status = "MATCH";
      hits.push(...r.hits);
    } else if (r.status === "UNKNOWN" && status !== "MATCH") {
      status = "UNKNOWN";
      hits.push(...r.hits);
    }
  }
  return { status, hits };
}

// Decide one citing entry.
//   keys.authorKeys  authors of the cited paper
//   keys.piKeys      current PI   - always a self-citation
//   keys.formerKeys  former PI    - always a self-citation
// A citing paper is INDEPENDENT only when it shares no author with the cited
// paper and lists neither PI nor former PI.
function evaluateEntry(entry, keys) {
  const people =
    entry.full_authors && entry.full_authors.length
      ? entry.full_authors.map(parseOne).filter(Boolean)
      : parseAuthorList(entry.authors);

  const pool = people.length
    ? people.map((p) => p.display).join(", ")
    : entry.authors;

  const a = checkGroup(keys.authorKeys, people);
  const pi = checkGroup(keys.piKeys, people);
  const former = checkGroup(keys.formerKeys, people);

  let status;
  if (a.status === "MATCH") status = "DEPENDENT";
  else if (pi.status === "MATCH") status = "SELF (PI)";
  else if (former.status === "MATCH") status = "SELF (FORMER PI)";
  else if (
    a.status === "UNKNOWN" ||
    pi.status === "UNKNOWN" ||
    former.status === "UNKNOWN"
  )
    // A common surname collided and initials were unavailable, so overlap is
    // neither confirmed nor ruled out.
    status = "REVIEW";
  else if (entry.full_authors && entry.full_authors.length)
    status = "INDEPENDENT";
  else if (entry.truncated) status = "REVIEW";
  else status = "INDEPENDENT";

  return {
    ...entry,
    status,
    matched_authors: a.hits,
    matched_pi: pi.hits,
    matched_former_pi: former.hits,
    authors_used: pool,
    author_source:
      entry.author_source ||
      (entry.truncated ? "scholar-list (truncated)" : "scholar-list"),
  };
}

module.exports = {
  parseOne,
  parseAuthorList,
  compareInits,
  matchKey,
  toKeys,
  fromVancouver,
  checkGroup,
  evaluateEntry,
};

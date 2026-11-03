// Apply a human decision to a citation the rules could not settle.
//
//   node tools/apply-decision.js --row=cit-000082 --verdict=dependent
//   node tools/apply-decision.js --row=cit-000082,cit-000179 --verdict=dependent
//   node tools/apply-decision.js --row=cit-000113 --verdict=independent \
//        --note="checked the published byline on the journal site"
//   node tools/apply-decision.js --from-csv            apply every decision in the sheet
//   node tools/apply-decision.js ... --write           actually change anything
//   node tools/apply-decision.js ... --write --reprint --rebuild
//
// Why this exists. Rows in the review queue cannot be settled by Scholar plus
// PubMed plus OpenAlex -- that is what puts them there. A person who reads the
// published article IS the evidence, so the answer has to be writable back into
// the packet, not just noted in a spreadsheet. Until now the review sheet's
// your_decision column was written and read by nothing, so a decision meant
// re-explaining the whole pipeline every time.
//
// ---------------------------------------------------------------------------
// Where a decision is stored, and why not in the database
//
// The per-page report JSON under Exhibits/Supporting is what the whole pipeline
// reads: tally.groupReports -> the ledger, the audit, the re-printer, and
// build-catalog.js, which copies it into Database/citation-catalog.sqlite. So a
// decision is written into the report and the store is REBUILT from it. Nothing
// here UPDATEs the store directly: a hand-edited row would be silently reverted
// by the next build and would make the store disagree with the reports, which is
// the one state the ledger exits 4 on.
//
// The store is still consulted first, to turn row_uid into (base, page,
// row_index) and to read the title back. The title is then compared with the
// entry actually found at that position, and the run aborts if they differ --
// editing a citation the user did not mean is far worse than refusing to edit.
//
// ---------------------------------------------------------------------------
// What one decision sets
//
//   status            the verdict: INDEPENDENT / DEPENDENT / SELF (PI) /
//                     SELF (FORMER PI) / REVIEW
//   confirm_state     "user-decided" -- its own basis, so a counted row states
//                     whether it rests on a person or on a machine reading
//   decided_by        who decided (default: the user)
//   decided_on        date
//   decided_note      why, in the user's words
//   status_before_decision / confirm_state_before_decision /
//   corroboration_before_decision
//                     the state immediately before this decision, kept once, so
//                     --revert puts back exactly what it replaced. NOT the same
//                     thing as status_captured, which reapply-corroboration.js
//                     already owns to mean the values the capture originally
//                     stored. Reusing those names here would have a revert undo
//                     a rule fix as well as the decision.
//   needs_attention / attention_reason         cleared, because the row is no
//                     longer open; v_review selects on status so it leaves the
//                     queue by itself
//
// What is NEVER touched: the title, the byline as Scholar printed it, the link,
// the language flag, or the exhibit HTML. An exhibit is a picture of a Scholar
// page and only the re-printer redraws it, from the rules, after this tool is
// done. A non-English row decided INDEPENDENT still does not count -- the
// 2026-11-01 decision is that no certified translation exists -- and this tool
// says so rather than letting the user discover it from a total that did not move.
//
// Dry run by default. --write backs up every report file it touches to
// Exhibits/Supporting/Pre-decision-<date>/ before writing.

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { DatabaseSync } = require("node:sqlite");
const tally = require("./tally");
const { flagAttention } = require("./capture-citations.js");
const { DB_PATH } = require("./build-catalog");

const ROOT = path.resolve(__dirname, "..");
const EXHIBITS = path.join(ROOT, "Independent Citation Record", "Exhibits");
const SUPPORT_DIR = path.join(EXHIBITS, "Supporting");
const TODAY = new Date().toISOString().slice(0, 10);

const arg = (name, fallback = "") => {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
};
const has = (name) => process.argv.includes(`--${name}`);

const write = has("write");
const doReprint = has("reprint");
const doRebuild = has("rebuild");
const fromCsv = has("from-csv");
const doRevert = has("revert");
const DECIDED_BY = arg("by", "Akul Mehta");

const BACKUP_DIR = path.join(SUPPORT_DIR, `Pre-decision-${TODAY}`);

// Accepted verdicts, normalised to the status strings the pipeline uses. Spelled
// out rather than pattern-matched, so a typo is refused instead of silently
// becoming a status nothing else understands.
const VERDICTS = {
  independent: "INDEPENDENT",
  dependent: "DEPENDENT",
  self: "SELF (PI)",
  "self-pi": "SELF (PI)",
  "self_pi": "SELF (PI)",
  "self-former-pi": "SELF (FORMER PI)",
  "self_former_pi": "SELF (FORMER PI)",
  former: "SELF (FORMER PI)",
  review: "REVIEW",
  open: "REVIEW",
};

function log(m) {
  console.log(`[decide] ${m}`);
}

function fail(m) {
  console.error(`[decide] ${m}`);
  process.exitCode = 1;
  throw new Error(m);
}

// ---------------------------------------------------------------------------
// Locate a row
// ---------------------------------------------------------------------------

function reportFileFor(base, page) {
  // Page 1 keeps the bare name; later pages take the -pN suffix, matching the
  // capture and tally.groupReports.
  const stem = page > 1 ? `${base}-p${page}` : base;
  const p = path.join(SUPPORT_DIR, `${stem}.report.json`);
  return fs.existsSync(p) ? p : null;
}

// Everything needed about the requested rows, read from the store. Only ACTIVE
// rows are addressable: a superseded row belongs to an archived exhibit and
// editing it would change nothing that is filed.
function lookup(db, uids) {
  const out = [];
  for (const uid of uids) {
    const r = db
      .prepare(
        `SELECT row_uid, base, page, row_index, cid, cites_id, title, status, confirm_state,
                language_flag, duplicate_of, is_highlighted, needs_attention,
                attention_reason, corroboration, external_source, external_url,
                external_authors, external_matched, scholar_note
           FROM (
             SELECT c.*, COALESCE(NULLIF(c.authors_used,''), c.authors) AS scholar_note
               FROM citations c
           )
          WHERE row_uid = ?`
      )
      .get(uid);
    if (!r) {
      const any = db
        .prepare("SELECT COUNT(*) AS n FROM citations WHERE row_uid = ?")
        .get(uid).n;
      out.push({ uid, error: any ? "row is retired or unfiled" : "no such row_uid" });
      continue;
    }
    out.push({ ...r, uid });
  }
  return out;
}

// A fold is only ever safe inside ONE cited paper.
//
// tally.foldSameWork groups purely on same_work_key and never compares cites_id,
// then makes one copy stand and marks the rest duplicate_of -- which
// isHighlighted() refuses. So folding a row that cites a different PI paper would
// remove a highlight from that paper's exhibit.
//
// This is a live risk, not a theoretical one: two rows can look like the same
// work because they ARE the same citing article, which appears on the "cited by"
// page of every paper it cites. Measured 2026-11-03, 178 title-keyed groups in
// this corpus span more than one cited paper. Those are one distinct work and
// genuinely that many separate citations -- independence is relative to the cited
// paper, so collapsing them is wrong twice over. Returns a message when the fold
// would cross a cited paper, or "" when it is provably within one. A side with no
// cites_id is refused too rather than waved through: an empty value here means the
// store cannot say which paper the row belongs to, and treating "unknown" as
// "same" is the exact inference this guard exists to prevent. cites_id is NOT NULL
// in the schema, so a refusal on the floor is a sign of a broken row, not a
// workflow to accommodate.
function foldProblem(uid, sameWorkAs, mine, anchor) {
  if (!mine || !anchor) return "";
  if (!mine.cites_id || !anchor.cites_id) {
    return (
      `${uid}: cannot check that ${sameWorkAs} cites the same paper, because ` +
      `${!mine.cites_id ? uid : sameWorkAs} has no cites_id in the store. ` +
      `A fold across two cited papers would drop a highlight from one exhibit, so ` +
      `this is refused rather than assumed safe. Rebuild the catalog ` +
      `(node tools/build-catalog.js --write) and try again.`
    );
  }
  if (mine.cites_id === anchor.cites_id) return "";
  return (
    `${uid}: cites a different paper (${sameWorkAs} belongs to ` +
    `${anchor.cites_id}, this row to ${mine.cites_id}), so it is not a ` +
    `duplicate of it. Two rows of one citing article appear once per paper ` +
    `it cites and are separate citations; folding them would drop a ` +
    `highlight from one exhibit. A fold must stay within one cited paper.`
  );
}

// The entry inside the report that the store row refers to. Matched on index and
// confirmed on title, because index alone is a position and a position can move
// between a capture and a rebuild.
function findEntry(data, want) {
  const entries = data.entries || [];
  const page = Number(want.page || 1);
  const byIndex = entries.filter(
    (e) =>
      Number(e.index) === Number(want.row_index) && Number(e.page || 1) === page,
  );
  if (!byIndex.length) return { error: `no entry at page ${page} row ${want.row_index}` };
  if (byIndex.length > 1) {
    return { error: `${byIndex.length} entries share page ${page} row ${want.row_index}` };
  }
  const e = byIndex[0];
  // Titles are copied verbatim into the store, so the two should be identical.
  // They are compared loosely for case, punctuation and whitespace only, never
  // by prefix: two citing papers can begin with the same words, and accepting a
  // prefix is exactly how an edit would land on a citation nobody asked about.
  // A genuinely truncated title (Scholar ends it with an ellipsis) is the one
  // case where a prefix comparison is honest, so it is allowed only then.
  const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  const a = norm(e.title);
  const b = norm(want.title);
  const truncated = /[…]$/.test(String(want.title || "").trim()) ||
    /\.\.\.$/.test(String(want.title || "").trim());
  const ok = a === b || (truncated && a.startsWith(b) && b.length >= 24);
  if (!ok) {
    return {
      error:
        `title at that position is not the row asked for ` +
        `(store: "${String(want.title).slice(0, 48)}" / report: "${String(e.title).slice(0, 48)}")`,
    };
  }
  return { entry: e, file: null };
}

// ---------------------------------------------------------------------------
// The decisions to apply
// ---------------------------------------------------------------------------

// Read decisions the user filled into the review sheet. Only a row with a
// non-empty your_decision is touched, and an unrecognisable verdict is reported
// rather than guessed -- a half-filled spreadsheet must not silently decide
// anything.
function decisionsFromCsv() {
  const dir = path.join(ROOT, "Drafts");
  const files = fs
    .readdirSync(dir)
    .filter((f) => /^review-queue-\d{4}-\d{2}-\d{2}\.csv$/.test(f))
    .sort();
  if (!files.length) fail("no review-queue-<date>.csv in Drafts/ to read decisions from");
  const file = path.join(dir, files[files.length - 1]);
  // Strip a UTF-8 BOM. The sheet this project writes has none, but a file saved
  // from Excel or PowerShell gains one, and it lands in front of the first
  // header name -- so a BOM would make row_uid "not found" in a sheet that
  // plainly has that column.
  const text = fs.readFileSync(file, "utf8").replace(/^\uFEFF/, "");
  const header = splitCsvLine(text.split(/\r?\n/)[0]);
  const uidCol = header.indexOf("row_uid");
  const decCol = header.indexOf("your_decision");
  const noteCol = header.indexOf("your_notes");
  if (uidCol < 0 || decCol < 0) {
    fail(`${path.basename(file)} has no row_uid / your_decision column`);
  }
  const out = [];
  for (const line of text.split(/\r?\n/).slice(1)) {
    if (!line.trim()) continue;
    const cells = splitCsvLine(line);
    const uid = (cells[uidCol] || "").trim();
    const raw = (cells[decCol] || "").trim();
    if (!uid || !raw) continue;
    const verdict = VERDICTS[raw.toLowerCase()];
    if (!verdict) {
      out.push({ uid, raw, error: `unrecognised decision "${raw}"` });
      continue;
    }
    out.push({ uid, verdict, note: noteCol >= 0 ? (cells[noteCol] || "").trim() : "" });
  }
  const usable = out.filter((d) => !d.error);
  const bad = out.length - usable.length;
  log(
    `read ${usable.length} decision(s) from ${path.relative(ROOT, file)}` +
      (bad ? `; ${bad} unrecognised and refused` : ""),
  );
  return out;
}

// Minimal CSV reader: enough for the sheet this project writes, which quotes a
// field only when it contains a comma, quote or newline.
function splitCsvLine(line) {
  const out = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else quoted = false;
      } else cur += ch;
      continue;
    }
    if (ch === '"') quoted = true;
    else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

function decisionsFromArgs() {
  const uids = arg("row")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const sameWorkAs = arg("same-work-as").trim();
  if (!uids.length) {
    fail(
      "nothing to do. Give --row=cit-000123 [--verdict=independent] or --from-csv.\n" +
        "        Verdicts: independent | dependent | self | self-former-pi | review\n" +
        "        --row=cit-000123 --revert   take a decision back off the row\n" +
        "        --row=cit-000123,cit-000124 --same-work-as=cit-000101 --note=\"...\"\n" +
        "        (record that the listed rows are the same published work as another row)",
    );
  }
  // A same-work fold is a different claim from a verdict: it says two rows are
  // one published work, not that a row is independent or dependent. It changes
  // no classification, so it takes no verdict -- and it requires a note, because
  // the 2026-11-02 rule is that a merge must rest on demonstrated identity, and
  // an unproven identity claim written into a filing is the failure that rule
  // exists to prevent. An undocumented fold is unauditable.
  if (sameWorkAs) {
    if (arg("verdict")) {
      fail(
        "--same-work-as records identity, not a verdict. Run the fold on its own, " +
          "then decide a classification separately if one is still open.",
      );
    }
    if (!arg("note").trim()) {
      fail(
        "--same-work-as requires --note= explaining the evidence that these are one " +
          "work (a matching complete byline plus a venue/DOI chain, or the published " +
          "paper's own statement of a prior version). A preprint server alone, or a " +
          "similar title, is not that evidence.",
      );
    }
    if (!uids.includes(sameWorkAs)) uids.push(sameWorkAs);
    return uids.map((uid) => ({
      uid,
      verdict: sameWorkAs === uid ? "SAME-WORK-ANCHOR" : "SAME-WORK",
      note: arg("note"),
      sameWorkAs,
    }));
  }
  // A revert restores the rule's own answer, so it takes no verdict.
  if (doRevert) return uids.map((uid) => ({ uid, verdict: "REVERT", note: arg("note") }));
  const rawVerdict = arg("verdict");
  const verdict = VERDICTS[rawVerdict.toLowerCase()];
  if (rawVerdict && !verdict) {
    fail(
      `unrecognised verdict "${rawVerdict}". ` +
        `Use one of: ${[...new Set(Object.keys(VERDICTS))].join(" | ")}`,
    );
  }
  const note = arg("note");
  return uids.map((uid) => ({ uid, verdict, note }));
}

// ---------------------------------------------------------------------------
// Apply
// ---------------------------------------------------------------------------

function describe(row) {
  const flags = [];
  if (row.language_flag) flags.push(`non-English (${row.language_flag})`);
  if (row.duplicate_of) flags.push("language edition of another row");
  return (
    `${row.uid}  ${row.status}/${row.confirm_state}` +
    (flags.length ? `  [${flags.join("; ")}]` : "") +
    `\n         ${String(row.title).slice(0, 92)}` +
    `\n         exhibit ${row.base} p${row.page} row ${row.row_index}`
  );
}

function main() {
  if (!fs.existsSync(DB_PATH)) {
    fail(`no catalog at ${DB_PATH}. Run: node tools/build-catalog.js --write`);
  }

  const requested = fromCsv ? decisionsFromCsv() : decisionsFromArgs();
  if (!requested.length) {
    // Reaching here means the sheet is simply unfilled, which is not an error --
    // a fresh review sheet has no decisions in it by design.
    console.log(
      fromCsv
        ? "\nNo decisions to apply: every your_decision cell in the review sheet is empty."
        : "\nNothing to do.",
    );
    return;
  }

  const db = new DatabaseSync(DB_PATH, { readOnly: true });
  const rows = lookup(db, requested.map((r) => r.uid));
  db.close();
  const byUid = new Map(rows.map((r) => [r.uid, r]));

  // Merge the request with what the store says, and refuse the whole run if any
  // row cannot be resolved. Partial application of a decision set is worse than
  // none: the user would have to work out which ones landed.
  const plan = [];
  const problems = [];
  for (const req of requested) {
    const row = byUid.get(req.uid);
    if (row?.error) {
      problems.push(`${req.uid}: ${row.error}`);
      continue;
    }
    const verdict = req.verdict;
    if (!verdict) {
      // A csv row can arrive with an error already attached (an unrecognised
      // verdict word), which is more useful than "no verdict given".
      problems.push(`${req.uid}: ${req.error || "no verdict given (add --verdict=...)"}`);
      continue;
    }
    // A fold must name a row that exists and is addressable. Folding onto a uid
    // that resolves to nothing would leave the group with no copy standing for
    // the work, silently dropping the citation rather than counting it once.
    if (req.sameWorkAs && !byUid.get(req.sameWorkAs)) {
      problems.push(`${req.uid}: --same-work-as=${req.sameWorkAs} is not a known row`);
      continue;
    }
    // A fold is only ever safe inside ONE cited paper -- see foldProblem().
    if (req.sameWorkAs) {
      const bad = foldProblem(
        req.uid,
        req.sameWorkAs,
        byUid.get(req.uid),
        byUid.get(req.sameWorkAs),
      );
      if (bad) {
        problems.push(bad);
        continue;
      }
    }
    plan.push({ ...row, verdict, note: req.note || "", sameWorkAs: req.sameWorkAs || "" });
  }
  if (problems.length) {
    for (const p of problems) console.error(`  ! ${p}`);
    fail(`${problems.length} decision(s) could not be resolved. Nothing was changed.`);
  }

  console.log(`\nDecisions requested: ${plan.length}`);
  for (const p of plan) {
    console.log(`\n${describe(p)}`);
    console.log(`   verdict      : ${p.verdict}`);
    if (p.note) console.log(`   note         : ${p.note}`);
    if (p.external_url) console.log(`   external     : ${p.external_url}`);
  }

  // Tell the user up front when a decision will NOT move a number, so a total
  // that stays put is never mistaken for the tool failing.
  const caveats = [];
  for (const p of plan) {
    if (p.verdict === "REVERT") continue;
    if (p.verdict === "SAME-WORK" || p.verdict === "SAME-WORK-ANCHOR") {
      const anchor = byUid.get(p.sameWorkAs);
      if (p.verdict === "SAME-WORK-ANCHOR") {
        caveats.push(
          `${p.uid} is the copy that stands for the work. It keeps whatever the rules ` +
            `already decided; the other rows fold into it and stop counting as separate papers.`,
        );
      } else {
        caveats.push(
          `${p.uid} stops standing for its own work. Its classification is unchanged and the ` +
            `exhibit still prints it, but it is counted once through ${p.sameWorkAs}` +
            `${anchor ? ` (${anchor.status}/${anchor.confirm_state})` : ""}.`,
        );
      }
      if (anchor && anchor.error) {
        problems.push(`${p.sameWorkAs}: ${anchor.error} - cannot fold rows onto it`);
      }
      continue;
    }
    // Re-basing a row that already rests on evidence would quietly rewrite how a
    // counted figure was established, so it is surfaced rather than applied
    // silently. tally.copyReliability ranks a decided copy above an evidenced
    // one, so such a change would really take effect.
    const wasEvidenced =
      p.status !== "REVIEW" &&
      ["confirmed", "external-resolved", "unverified-coverage"].includes(
        p.confirm_state,
      );
    if (wasEvidenced && p.verdict !== p.status) {
      caveats.push(
        `${p.uid} is already ${p.status} on ${p.confirm_state} evidence and ${p.verdict} ` +
          `would change the classification. Its recorded basis also becomes your reading ` +
          `of the published byline rather than the author lists we captured.`,
      );
    } else if (wasEvidenced) {
      caveats.push(
        `${p.uid} is already ${p.status} on ${p.confirm_state} evidence, so this moves no ` +
          `count. It relabels the basis from ${p.confirm_state} to your decision only.`,
      );
    }
    if (p.verdict === "INDEPENDENT" && p.language_flag) {
      caveats.push(
        `${p.uid} is flagged ${p.language_flag}. Per the 2026-11-01 decision no certified ` +
          `translation exists, so it stays unhighlighted and out of the totals even though ` +
          `it is now classified independent. Say the word if that decision is changing.`,
      );
    }
    if (p.verdict === "INDEPENDENT" && p.duplicate_of) {
      caveats.push(
        `${p.uid} is recorded as a language edition of another row on the same citing list, ` +
          `so it is counted once through that other row and will not add to the total.`,
      );
    }
    if (p.verdict === "REVIEW") {
      caveats.push(
        `${p.uid} is being left open, so it stays in the queue and is counted neither way.`,
      );
    }
  }
  if (caveats.length) {
    console.log("\nNote - read these before writing:");
    for (const c of caveats) console.log(`  - ${c}`);
  }

  // Group by report file so each file is parsed, edited and written once.
  const byFile = new Map();
  for (const p of plan) {
    const file = reportFileFor(p.base, Number(p.page || 1));
    if (!file) {
      problems.push(`${p.uid}: no report file for ${p.base} page ${p.page}`);
      continue;
    }
    if (!byFile.has(file)) byFile.set(file, []);
    byFile.get(file).push(p);
  }
  if (problems.length) {
    for (const q of problems) console.error(`  ! ${q}`);
    fail("some rows have no report file on disk. Nothing was changed.");
  }

  const touched = [];
  let changedCount = 0;
  let skipped = 0;
  const entryErrors = [];
  for (const [file, group] of byFile) {
    const data = JSON.parse(fs.readFileSync(file, "utf8"));
    let dirty = false;
    for (const p of group) {
      const found = findEntry(data, p);
      if (found.error) {
        // Collected, not fatal here: the whole plan is edited in memory first and
        // nothing is written until every row has been located, so a row whose
        // title does not match stops the batch rather than silently deciding the
        // rest of it.
        entryErrors.push(`${p.uid}: ${found.error}`);
        continue;
      }
      const e = found.entry;
      const before = {
        status: e.status,
        confirm_state: e.confirm_state,
        needs_attention: e.needs_attention,
        attention_reason: e.attention_reason,
      };
      // Snapshot the state immediately before this decision, once, so a re-run
      // over an already-decided row cannot overwrite the undo point. These are
      // deliberately NOT status_captured/confirm_state_captured: those belong to
      // reapply-corroboration.js and hold the original capture values, which a
      // later rule fix may have moved on from.
      if (e.status_before_decision === undefined) {
        e.status_before_decision = e.status;
      }
      if (e.confirm_state_before_decision === undefined) {
        e.confirm_state_before_decision = e.confirm_state;
      }
      if (e.corroboration_before_decision === undefined) {
        e.corroboration_before_decision = e.corroboration || "";
      }
      if (p.verdict === "REVERT") {
        // Take the decision back off the row. A row that was never decided has
        // nothing to undo, and saying so beats writing a blank over a state that
        // was set by the rules. A recorded same-work fold counts as a recorded
        // decision even though it left confirm_state alone -- identity is a
        // decision too, and it is the one thing on such a row to undo.
        if (!tally.isUserDecided(e) && !e.same_work_key) {
          console.log(`\n  ${p.uid}: no decision recorded, nothing to revert`);
          skipped++;
          continue;
        }
        e.status = e.status_before_decision;
        e.confirm_state = e.confirm_state_before_decision;
        e.corroboration = e.corroboration_before_decision;
        // The decision fields are removed, not blanked. A row nobody decided has
        // no such keys at all, and leaving empty strings behind would make a
        // reverted row look different from an undecided one in every diff and
        // every export from then on.
        delete e.decided_by;
        delete e.decided_on;
        delete e.decided_note;
        // So are the undo fields: they have done their job, and a stale one
        // could be mistaken for a live undo point by a later run.
        delete e.status_before_decision;
        delete e.confirm_state_before_decision;
        delete e.corroboration_before_decision;
        // A recorded same-work fold comes off too. The row goes back to standing
        // for its own work, which is what it did before anyone proved otherwise.
        delete e.same_work_key;
        delete e.same_work_note;
      } else if (p.verdict === "SAME-WORK" || p.verdict === "SAME-WORK-ANCHOR") {
        // An identity claim, not a classification. The title, the byline, the
        // status and the confirm_state are all left exactly as they are -- the
        // exhibit still shows the row as Scholar printed it, and the row is
        // still whatever it was. What changes is that it no longer stands as a
        // separate WORK: tally.foldSameWork gives the mark to one copy of the
        // group and the ledger counts the group once.
        e.same_work_key = `sw:${p.sameWorkAs}`;
        e.same_work_note = p.note;
        e.decided_by = DECIDED_BY;
        e.decided_on = TODAY;
        e.decided_note =
          `recorded as the same published work as ${p.sameWorkAs}` +
          (p.note ? `: ${p.note}` : "");
      } else {
        e.status = p.verdict;
        e.confirm_state = tally.USER_DECIDED;
        e.decided_by = DECIDED_BY;
        e.decided_on = TODAY;
        e.decided_note = p.note;
        // The summary keeps what the machine had said, so the row records both
        // readings. corroboration_note is never touched: it belongs to the
        // external-record history, not to this decision.
        e.corroboration =
          `decided by ${DECIDED_BY} on ${TODAY}` +
          (p.note ? `: ${p.note}` : "") +
          ` (rule had ${before.status}/${before.confirm_state})` +
          (e.corroboration_before_decision ? ` | ${e.corroboration_before_decision}` : "");
      }
      // Re-derive attention with the capture's own function so a decided row
      // cannot keep describing the state it was in when it was queued.
      flagAttention([e]);
      const moved =
        before.status !== e.status ||
        before.confirm_state !== e.confirm_state ||
        before.attention_reason !== e.attention_reason ||
        (p.verdict === "SAME-WORK" || p.verdict === "SAME-WORK-ANCHOR") ||
        (p.verdict === "REVERT" && e.same_work_key !== undefined);
      if (moved) changedCount++;
      // Two different lists. The review queue is v_review, which selects on
      // status = 'REVIEW', so any verdict other than REVIEW leaves it. The wider
      // attention list also carries non-English rows and spot-checks, which stay
      // after a decision and should not look like a failure to clear.
      const leavesQueue = e.status !== "REVIEW";
      console.log(
        `\n  ${p.uid}: ${before.status}/${before.confirm_state} -> ${e.status}/${e.confirm_state}` +
          (leavesQueue ? "  (leaves the review queue)" : "  (stays in the review queue)"),
      );
      if (e.needs_attention) {
        console.log(`      still on the attention list: ${e.attention_reason}`);
      }
      console.log(
        `      now counts as independent: ${tally.isHighlighted(e) ? "YES" : "no"}`,
      );
      dirty = true;
    }
    if (dirty) touched.push({ file, data });
  }
  if (entryErrors.length) {
    for (const q of entryErrors) console.error(`  ! ${q}`);
    fail(
      `${entryErrors.length} row(s) could not be matched to an entry in the report. ` +
        `Nothing was changed — the store and the reports disagree about those rows ` +
        `and a rebuild is the likely fix: node tools/build-catalog.js --write`,
    );
  }

  if (!touched.length) {
    // A revert of a row nobody decided is not a failure to find the entry, and
    // saying so matters -- the two need different responses from the user.
    if (skipped) {
      console.log(`\nNothing to do: ${skipped} row(s) carry no recorded decision.`);
      process.exitCode = 0;
      return;
    }
    fail("no entry could be located. Nothing was changed.");
  }

  if (!write) {
    console.log(
      `\nDry run. ${touched.length} report file(s) would change ` +
        `(${changedCount} row(s) moved). Re-run with --write.\n` +
        `  --write --reprint --rebuild   also redraw the exhibits and refresh every figure`,
    );
    return;
  }

  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  for (const { file, data } of touched) {
    const dest = path.join(BACKUP_DIR, path.basename(file));
    if (!fs.existsSync(dest)) fs.copyFileSync(file, dest);
    // Write to a temporary file in the same directory and rename over the
    // original. A report is the source every figure is derived from, so a
    // half-written one is worse than an old one -- and it is easy to truncate
    // one by accident, since anything that ends the process mid-write (a piped
    // command closing early, a Ctrl-C, a power loss) leaves a partial file
    // behind. rename() within a filesystem is atomic, so a reader sees either
    // the old report or the new one.
    const tmp = `${file}.writing-${process.pid}`;
    fs.writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`);
    // Parse it back before committing. If the bytes on disk are not the JSON we
    // meant, the original stays where it is.
    JSON.parse(fs.readFileSync(tmp, "utf8"));
    fs.renameSync(tmp, file);
  }
  log(`wrote ${touched.length} report file(s); originals in ${path.relative(ROOT, BACKUP_DIR)}`);

  // The exhibit pages that actually contain a decided row. reprint-exhibits
  // --changed works this out itself; naming them here only tells the user which
  // sheets are about to be redrawn.
  const pages = [...new Set(plan.map((p) => (Number(p.page || 1) > 1 ? `${p.base}-p${p.page}` : p.base)))];
  console.log(`\nExhibit pages holding a decided row: ${pages.length}`);
  for (const b of pages) console.log(`  ${b}`);
  // reprint-exhibits compares the marks it would draw with the marks already on
  // the saved page and skips a page that matches. A DEPENDENT or SELF verdict
  // changes nothing visible on a page that was never highlighted, so a reprint
  // of it is a no-op rather than a wasted sheet; only a verdict that moves a row
  // into or out of the highlighted set redraws anything.
  console.log(
    "  (a page only redraws if the verdict changes a highlight; --reprint skips the rest)",
  );

  if (!doReprint && !doRebuild) {
    console.log(
      `\nReports updated. The exhibits and every figure still show the old state. Next:\n` +
        `  node tools/reprint-exhibits.js --changed --write\n` +
        `  node tools/build-catalog.js --write\n` +
        `  node tools/build-ledger.js\n` +
        `  node tools/build-review-sheet.js --md\n` +
        `  node tools/build-dashboard-data.js\n` +
        `Or re-run this command with --reprint --rebuild to do all of it.`,
    );
    return;
  }

  // One step per child process, so each tool's own guards and reconciliation run
  // exactly as they do by hand. A non-zero exit stops the chain rather than
  // carrying on over a defect.
  //
  // --rebuild implies --reprint. audit-highlights.js compares the marks on each
  // exhibit with what the rules now say and exits 1 on a difference, so a
  // decision that makes a row countable fails the rebuild unless the sheet is
  // redrawn first. Making it implicit avoids a failure that looks like a defect
  // but is only a missing flag; the re-printer skips pages whose marks are
  // unchanged, so an unnecessary reprint costs nothing but time.
  const steps = [];
  if (doReprint || doRebuild) {
    steps.push(["reprint-exhibits.js", ["--changed", "--write"]]);
  }
  if (doRebuild) {
    // The audit reads only the reports and the saved HTML, never the store, so
    // it goes first: if an exhibit disagrees with the rule, the chain stops here
    // and the store, ledger, review sheet and dashboard are all left showing the
    // last state that was known to be consistent. Auditing after the store write
    // would leave a packet whose figures had moved while its exhibits had not.
    steps.push(["audit-highlights.js", []]);
    // Then the store, and only then the ledger, which reads its rows out of the
    // store and would otherwise raise a defect against a stale one.
    steps.push(["build-catalog.js", ["--write"]]);
    steps.push(["build-ledger.js", []]);
    steps.push(["build-review-sheet.js", ["--md"]]);
    steps.push(["build-dashboard-data.js", []]);
  }
  for (const [script, args] of steps) {
    console.log(`\n--- node tools/${script} ${args.join(" ")} ---`);
    try {
      execFileSync(process.execPath, [path.join(ROOT, "tools", script), ...args], {
        cwd: ROOT,
        stdio: "inherit",
      });
    } catch (e) {
      fail(
        `${script} exited ${e.status}. The decision is written to the reports but the ` +
          `figures are not rebuilt. Investigate before quoting any number; the originals ` +
          `are in ${path.relative(ROOT, BACKUP_DIR)}.`,
      );
    }
  }
  // Counted from the store after the rebuild, not from this run: a second
  // command over already-decided rows moves nothing but the packet still rests
  // on those decisions, and quoting this run's count would understate it.
  let decidedTotal = null;
  if (doRebuild && fs.existsSync(DB_PATH)) {
    try {
      const check = new DatabaseSync(DB_PATH, { readOnly: true });
      decidedTotal = check
        .prepare(
          `SELECT COUNT(*) AS n FROM citations
            WHERE is_highlighted = 1 AND confirm_state = 'user-decided'
              AND filed = 1 AND superseded_at = ''`,
        )
        .get().n;
      check.close();
    } catch {
      decidedTotal = null;
    }
  }
  console.log(
    `\nDone. Reload the dashboard. Quote figures from the dated ledger CSV.` +
      (decidedTotal === null
        ? ` This run moved ${changedCount} row(s).`
        : ` ${decidedTotal} counted row(s) now rest on a human reading rather than on `
          + `Scholar or an external index, and the ledger prints that split separately.`),
  );
}

// Running on load is what a CLI wants, but it must not happen when a test (or
// another tool) requires the helpers below.
if (require.main === module) {
  main();
}

module.exports = {
  VERDICTS,
  reportFileFor,
  findEntry,
  splitCsvLine,
  foldProblem,
};

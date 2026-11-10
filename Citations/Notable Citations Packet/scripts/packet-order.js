"use strict";
/**
 * The order in which the citing articles of the packet are presented in the Word document and in the
 * `highlighted PDFs` folder: oldest publication first. Full dates where the PDF or the database gives one;
 * otherwise the accepted date, or the month the article number points to (so those months are approximate).
 */
const PUBLISHED = {
  "cit-001230": "2015-11-30", "cit-000196": "2021-05-11", "cit-000532": "2023-02", "cit-000197": "2023-04-17",
  "cit-000510": "2023-06", "cit-000195": "2023-10-16", "cit-000199": "2023-12-22", "cit-000544": "2024-08",
  "cit-000521": "2025-11-05", "cit-000629": "2025-11-10", "cit-001253": "2025-12", "cit-000594": "2026-02",
  "cit-000542": "2026-03", "cit-000518": "2026-04", "cit-000516": "2026-04-25", "cit-000619": "2026-05",
  "cit-000621": "2026-06-04", "cit-000613": "2026-08", "cit-000602": "2026-09", "cit-001257": "2026-10",
  "cit-000416": "2026-11",
};
/** folder uids, oldest first (ties keep database order) */
function orderedFolders(uids) {
  return [...uids].sort((a, b) => {
    const pa = PUBLISHED[a], pb = PUBLISHED[b];
    if (!pa || !pb) throw new Error(`no publication date for ${!pa ? a : b} (add it to scripts/packet-order.js)`);
    return pa < pb ? -1 : pa > pb ? 1 : 0;
  });
}
module.exports = { PUBLISHED, orderedFolders };

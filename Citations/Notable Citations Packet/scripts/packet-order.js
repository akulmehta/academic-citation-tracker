"use strict";
/**
 * The order in which the citing articles are presented in the Word documents and in the `highlighted PDFs`
 * folder: by the date each became public, oldest first. That is the date of the earlier preprint where one was posted,
 * otherwise the date the final article went online (see scripts/citing-meta.js).
 */
const { META, PETITION_DATE, earliest, period } = require("./citing-meta");

const PUBLISHED = Object.fromEntries(Object.keys(META).map(uid => [uid, earliest(uid)]));

/** folder uids, oldest first (ties keep database order) */
function orderedFolders(uids) {
  return [...uids].sort((a, b) => {
    const pa = PUBLISHED[a], pb = PUBLISHED[b];
    if (!pa || !pb) throw new Error(`no publication date for ${!pa ? a : b} (add it to scripts/citing-meta.js)`);
    return pa < pb ? -1 : pa > pb ? 1 : 0;
  });
}
module.exports = { PUBLISHED, orderedFolders, PETITION_DATE, period };

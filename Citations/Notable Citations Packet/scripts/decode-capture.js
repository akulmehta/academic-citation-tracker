/**
 * Decode a base64 capture written by the browser into a PDF in `Downloaded PDFs/`.
 *
 * The Playwright MCP context does not accept downloads, so a gated PDF cannot be
 * pushed through Chrome's download manager. Instead the browser fetches the file
 * from inside the article page — which carries whatever clearance the applicant
 * granted — and returns it base64-encoded into a file. This turns that back into
 * bytes and refuses anything that is not really a PDF.
 *
 *   node scripts/decode-capture.js --in=_tmp_b64.txt --name=cit-000538-Wang.pdf
 */
const fs = require("fs");
const path = require("path");
const { PKT } = require("./lib.js");

const argv = process.argv.slice(2);
const opt = (n) =>
  (argv.find((a) => a.startsWith(`--${n}=`)) || "").split("=").slice(1).join("=") || null;

const IN = opt("in");
const NAME = opt("name");
if (!IN || !NAME) {
  console.error("usage: node scripts/decode-capture.js --in=<capture file> --name=<file.pdf>");
  process.exit(2);
}

const absIn = path.isAbsolute(IN) ? IN : path.join(PKT, IN);
const text = fs.readFileSync(absIn, "utf8");
const at = text.indexOf("B64=");
if (at < 0) {
  console.error(`no B64= marker in ${absIn} — the capture did not complete`);
  process.exit(1);
}
// The header line the capture script writes, so the size the browser saw can be
// compared against the size decoded. A mismatch means the file was truncated.
const header = text.slice(0, at).trim();
const m = header.match(/SIZE=(\d+)/);
const want = m ? Number(m[1]) : null;
const status = (header.match(/STATUS=(\d+)/) || [])[1];

const buf = Buffer.from(text.slice(at + 4).replace(/\s+/g, ""), "base64");
if (status && status !== "200") {
  console.error(`refusing: the browser reported HTTP ${status}`);
  process.exit(1);
}
if (buf.subarray(0, 4).toString("latin1") !== "%PDF") {
  console.error(`refusing: decoded bytes do not start with %PDF (${buf.subarray(0, 8).toString("latin1")})`);
  process.exit(1);
}
if (want !== null && buf.length !== want) {
  console.error(`refusing: browser saw ${want} bytes, decoded ${buf.length} — the capture was truncated`);
  process.exit(1);
}
if (!buf.subarray(-1024).toString("latin1").includes("%%EOF")) {
  console.error("refusing: no %%EOF near the end — the file is incomplete");
  process.exit(1);
}

const outDir = path.join(PKT, "downloads");
fs.mkdirSync(outDir, { recursive: true });
const out = path.join(outDir, NAME);
fs.writeFileSync(out, buf);
console.log(`${out}  ${buf.length} bytes (${(buf.length / 1048576).toFixed(2)} MB)  magic+EOF verified`);

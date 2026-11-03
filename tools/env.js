// Loads the repository .env into process.env at require time.
//
// Why this exists: the corroboration look-ups take credentials (an OpenAlex key
// and an optional NCBI key). Passing them as --openalex-key=... on a command
// line puts a live secret into shell history, into the terminal scrollback of a
// recorded session, and into any log line that echoes the command. A file that
// git ignores is the ordinary place for it.
//
// Rules, deliberately narrow:
//   * A variable already set in the real environment WINS. .env only fills gaps,
//     so CI or a one-off override still works.
//   * Values are never logged, by this module or by any tool that reads them.
//     Nothing here prints a value, including on a parse problem.
//   * No dependency: this is a handful of lines rather than dotenv.
//
// Supported syntax: KEY=value, blank lines, `#` comments, optional `export `
// prefix, and values wrapped in single or double quotes. `KEY=` means unset.
// There is no variable expansion and no multiline values -- that is the whole
// feature set, and anything more elaborate would need a real parser.

const fs = require("fs");
const path = require("path");

// The .env lives at the repository root, next to .gitignore. Resolved from this
// file rather than process.cwd() so a tool works from any directory.
const ENV_FILE = path.resolve(__dirname, "..", ".env");

function parse(text) {
  const out = {};
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 1) continue;
    let key = line.slice(0, eq).trim();
    if (key.startsWith("export ")) key = key.slice(7).trim();
    if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(key)) continue;
    let value = line.slice(eq + 1).trim();
    // Strip one matching pair of surrounding quotes, and nothing else. An
    // unquoted value keeps any inline # -- a key or URL could contain one, and
    // trimming at it would silently corrupt the credential.
    const q = value[0];
    if ((q === '"' || q === "'") && value.length > 1 && value.endsWith(q)) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

// Returns the keys this call filled in, by name only -- never their values.
// Callers log the names so a run shows which credentials are in play without
// any of them reaching the console.
function load(envFile = ENV_FILE, target = process.env) {
  let text;
  try {
    text = fs.readFileSync(envFile, "utf8");
  } catch {
    // No .env is a normal state, not an error: the tools run anonymously.
    return { keys: [], file: envFile, missing: true };
  }
  const parsed = parse(text);
  const filled = [];
  for (const [key, value] of Object.entries(parsed)) {
    if (!value) continue; // KEY= means unset.
    if (target[key]) continue; // the real environment wins.
    target[key] = value;
    filled.push(key);
  }
  return { keys: filled, file: envFile, missing: false };
}

// Loaded on require so importing any tool is enough. Idempotent: a second
// require is a no-op because the values are already in process.env.
const RESULT = load();

module.exports = { load, parse, ENV_FILE, result: RESULT };

// Minimal HTTP helper for the packet's own look-ups.
//
// Three rules the record already learned the hard way, kept here so every caller
// gets them:
//
//   * A throttled or failed look-up is NOT a finding. Callers receive
//     { unknown: true } and must leave the row alone rather than concluding the
//     paper is unindexed or paywalled.
//   * Honour Retry-After, but only up to a ceiling. An anonymous pool once
//     answered Retry-After: 44969 (~12.5h); waiting literally on that is not a
//     retry, it is a hang that looks like a slow run.
//   * Never put a credential in a URL. A failed request is reported as
//     `${status} ${url}`, and that note is written into the packet's database,
//     so a key in the query string would be filed with the deliverable. Keys go
//     in an Authorization header.

const RETRY_MAX_WAIT_MS = 60_000;
const MAX_ATTEMPTS = 3;

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

function retryAfterMs(res) {
  const h = res.headers.get("retry-after");
  if (!h) return null;
  const secs = Number(h);
  if (Number.isFinite(secs)) return secs * 1000;
  const date = Date.parse(h);
  return Number.isNaN(date) ? null : date - Date.now();
}

/**
 * Fetch with retries on 429/5xx.
 * Returns { ok, status, body } where body is a Buffer, or
 *         { unknown: true, note } when the look-up did not complete.
 */
async function get(url, { headers = {}, accept = "*/*", timeoutMs = 45_000 } = {}) {
  let last = "no attempt";
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        signal: ctl.signal,
        redirect: "follow",
        headers: { "User-Agent": "notable-citations-packet/1.0 (evidence packet; contact via applicant)", Accept: accept, ...headers },
      });
      if (res.ok) {
        const buf = Buffer.from(await res.arrayBuffer());
        return { ok: true, status: res.status, body: buf, contentType: res.headers.get("content-type") || "" };
      }
      last = `${res.status} ${res.statusText || ""} :: ${url}`.replace(/\s+::/, " ::");
      if (res.status === 429 || res.status >= 500) {
        const wait = retryAfterMs(res);
        if (wait != null && wait > RETRY_MAX_WAIT_MS) {
          return { unknown: true, note: `${last} :: Retry-After ${Math.round(wait / 1000)}s exceeds ${RETRY_MAX_WAIT_MS / 1000}s ceiling` };
        }
        if (attempt < MAX_ATTEMPTS) {
          await sleep(wait != null && wait > 0 ? wait : 1500 * attempt * attempt);
          continue;
        }
        return { unknown: true, note: last };
      }
      return { ok: false, status: res.status, note: last };
    } catch (err) {
      last = `${err.name || "Error"}: ${err.message} :: ${url}`;
      if (attempt < MAX_ATTEMPTS) await sleep(1500 * attempt * attempt);
    } finally {
      clearTimeout(timer);
    }
  }
  return { unknown: true, note: last };
}

async function getJson(opts) {
  const r = await get(opts.url, { ...opts, accept: "application/json" });
  if (!r.ok) return r;
  try {
    return { ...r, json: JSON.parse(r.body.toString("utf8")) };
  } catch (err) {
    return { unknown: true, note: `unparseable JSON: ${err.message} :: ${opts.url}` };
  }
}

module.exports = { get, getJson, sleep, RETRY_MAX_WAIT_MS };

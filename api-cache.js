// api-cache.js  (RISK-001 resilience)
// A network-first response cache with stale fallback. The dashboard depends on a
// single unauthenticated public API (statsapi.mlb.com); a transient blip would
// otherwise blank the page. This layer always tries the network first, caches
// successes (sessionStorage), and — only when a fetch fails — serves the last
// good response (if recent enough) instead of throwing. A health signal lets the
// UI show a quiet "showing cached data" notice and clear it on recovery.
//
// Everything is injectable (storage, clock) so it unit-tests in Node without a
// browser. The default instance uses sessionStorage + Date.now.

const NS = "mlb:cache:";
const DEFAULT_MAX_AGE_MS = 6 * 60 * 60 * 1000; // don't serve fallback older than 6h

// ---- health signal (shared across all clients) ----
const healthListeners = new Set();
export function onApiHealth(cb) {
  healthListeners.add(cb);
  return () => healthListeners.delete(cb);
}
function emitHealth(state) {
  for (const cb of [...healthListeners]) {
    try { cb(state); } catch (_) { /* listener errors never break a fetch */ }
  }
}

// ---- pure helper (unit-tested) ----
export function withinMaxAge(ts, maxAgeMs, now) {
  return typeof ts === "number" && (now - ts) >= 0 && (now - ts) <= maxAgeMs;
}

export function createApiCache({
  storage,
  now = () => Date.now(),
  maxAgeMs = DEFAULT_MAX_AGE_MS
} = {}) {
  function read(url) {
    if (!storage) return null;
    try {
      const raw = storage.getItem(NS + url);
      if (!raw) return null;
      const entry = JSON.parse(raw);
      return entry && typeof entry.ts === "number" ? entry : null;
    } catch (_) {
      return null;
    }
  }

  function write(url, data) {
    if (!storage) return;
    try {
      storage.setItem(NS + url, JSON.stringify({ ts: now(), data }));
    } catch (_) {
      // quota exceeded or non-serializable — caching is best-effort, never fatal
    }
  }

  // Network-first. Returns { data, fromCache, cachedAt }. Falls back to a recent
  // cached value on failure; rethrows the original error if there's nothing usable.
  async function getJSON(url, fetchFn) {
    try {
      const data = await fetchFn(url);
      write(url, data);
      emitHealth("healthy");
      return { data, fromCache: false, cachedAt: null };
    } catch (err) {
      const entry = read(url);
      if (entry && withinMaxAge(entry.ts, maxAgeMs, now())) {
        emitHealth("degraded");
        return { data: entry.data, fromCache: true, cachedAt: entry.ts };
      }
      throw err;
    }
  }

  return { read, write, getJSON };
}

function defaultStorage() {
  try {
    return typeof sessionStorage !== "undefined" ? sessionStorage : null;
  } catch (_) {
    return null; // e.g. storage blocked by privacy settings
  }
}

// Default shared instance used by the data clients.
export const apiCache = createApiCache({ storage: defaultStorage() });

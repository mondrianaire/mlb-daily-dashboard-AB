// telemetry.js  (GAP-003 — privacy-light, default-off instrumentation)
// On a static, backend-less site there's nowhere to *aggregate* analytics by
// default, and we don't want to add cookies/PII/fingerprinting. So this layer:
//   1. ALWAYS keeps local per-event counts in localStorage — the owner can read
//      them with window.__telemetry() to see which features get used.
//   2. OPTIONALLY beacons each event to a collector IF one is configured via
//      <meta name="telemetry-endpoint">. Empty/absent = OFF (no network).
// Events are plain names (e.g. "tab:trends") + a timestamp. No user id, no URL,
// no personal data. Fully injectable so it unit-tests in Node.

const LS_KEY = "mlb-telemetry-v1";
const MAX_EVENT_TYPES = 50; // bound storage: ignore brand-new event names past this

export function createTelemetry({ storage, beacon = null, now = () => Date.now(), endpoint = "" } = {}) {
  function load() {
    if (!storage) return {};
    try { return JSON.parse(storage.getItem(LS_KEY)) || {}; } catch (_) { return {}; }
  }
  function save(counts) {
    if (!storage) return;
    try { storage.setItem(LS_KEY, JSON.stringify(counts)); } catch (_) { /* best-effort */ }
  }

  function track(event, meta) {
    if (typeof event !== "string" || !event) return undefined;
    const counts = load();
    const known = Object.prototype.hasOwnProperty.call(counts, event);
    if (!known && Object.keys(counts).length >= MAX_EVENT_TYPES) return undefined;
    counts[event] = (counts[event] || 0) + 1;
    save(counts);

    if (endpoint && beacon) {
      try {
        const payload = { e: event, t: now() };
        if (meta != null) payload.m = meta;
        beacon(endpoint, JSON.stringify(payload));
      } catch (_) { /* beacons are fire-and-forget */ }
    }
    return counts[event];
  }

  return {
    track,
    snapshot: () => load(),
    reset: () => save({}),
    isBeaconing: () => Boolean(endpoint && beacon)
  };
}

// Read the optional collector endpoint from the page (meta tag). "" = OFF.
export function getTelemetryEndpoint(doc = (typeof document !== "undefined" ? document : null)) {
  const meta = doc?.querySelector?.('meta[name="telemetry-endpoint"]');
  const v = meta?.getAttribute?.("content")?.trim();
  return v || "";
}

function defaultStorage() {
  try { return typeof localStorage !== "undefined" ? localStorage : null; } catch (_) { return null; }
}
function defaultBeacon() {
  try {
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      return (url, data) => navigator.sendBeacon(url, data);
    }
  } catch (_) { /* ignore */ }
  return null;
}

// Default shared instance: local counts always on; network beacon only if a
// telemetry-endpoint meta tag is set.
export const telemetry = createTelemetry({
  storage: defaultStorage(),
  beacon: defaultBeacon(),
  endpoint: getTelemetryEndpoint()
});

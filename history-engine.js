// history-engine.js  (GAP-002 — day-over-day memory, client-side)
// The dashboard owns no server and accumulates nothing — so it has never had any
// memory of "what changed since yesterday." This adds a small client-side memory:
// each day's division standings are snapshotted to localStorage, and today's live
// standings are diffed against the most recent prior day to surface rank movement
// (▲/▼ within the division). No backend, no PII; per-browser, rolling window.
//
// Pure functions (buildSnapshot, diffRanks, mostRecentBefore) unit-test in Node;
// the store wraps them with an injectable storage so it's testable too.

const HKEY = "mlb-history-v1";
const DEFAULT_MAX_DAYS = 30;

// Compact snapshot of division standings for one date.
//   { date, ranks: { [teamId]: { rank, div, w, l } } }  (rank = 1-based within div)
export function buildSnapshot(divisionStandings, dateISO) {
  const ranks = {};
  for (const [div, list] of Object.entries(divisionStandings || {})) {
    (Array.isArray(list) ? list : []).forEach((t, i) => {
      if (t && t.teamId != null) {
        ranks[t.teamId] = { rank: i + 1, div, w: Number(t.wins) || 0, l: Number(t.losses) || 0 };
      }
    });
  }
  return { date: dateISO, ranks };
}

// Per-team movement of `current` vs `previous`. rankDelta > 0 means moved UP
// (toward 1st). Teams that are new or changed divisions are flagged, not deltaed.
export function diffRanks(current, previous) {
  const out = {};
  const cur = current?.ranks || {};
  const prev = previous?.ranks || {};
  for (const [id, c] of Object.entries(cur)) {
    const p = prev[id];
    if (!p || p.div !== c.div) {
      out[id] = { rankDelta: 0, wDelta: 0, lDelta: 0, isNew: true };
    } else {
      out[id] = { rankDelta: p.rank - c.rank, wDelta: c.w - p.w, lDelta: c.l - p.l, isNew: false };
    }
  }
  return out;
}

// Most recent snapshot strictly before dateISO, or null. Assumes ISO dates sort
// lexically (they do for YYYY-MM-DD).
export function mostRecentBefore(history, dateISO) {
  let best = null;
  for (const s of (Array.isArray(history) ? history : [])) {
    if (s && typeof s.date === "string" && s.date < dateISO) {
      if (!best || s.date > best.date) best = s;
    }
  }
  return best;
}

export function createHistoryStore({ storage, maxDays = DEFAULT_MAX_DAYS } = {}) {
  function load() {
    if (!storage) return [];
    try {
      const arr = JSON.parse(storage.getItem(HKEY));
      return Array.isArray(arr) ? arr : [];
    } catch (_) {
      return [];
    }
  }
  function persist(arr) {
    if (!storage) return;
    try { storage.setItem(HKEY, JSON.stringify(arr)); } catch (_) { /* best-effort */ }
  }
  // Upsert today's snapshot (replace same-date), keep a rolling window.
  function save(snap) {
    if (!snap || !snap.date) return;
    const arr = load().filter((s) => s && s.date !== snap.date);
    arr.push(snap);
    arr.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    persist(arr.slice(-maxDays));
  }
  function previousBefore(dateISO) {
    return mostRecentBefore(load(), dateISO);
  }
  return { load, save, previousBefore };
}

function defaultStorage() {
  try { return typeof localStorage !== "undefined" ? localStorage : null; } catch (_) { return null; }
}

export const historyStore = createHistoryStore({ storage: defaultStorage() });

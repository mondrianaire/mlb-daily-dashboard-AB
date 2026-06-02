// favorites.js  (Favorites / "My Team")
// A fan follows their team — let them mark favorites (localStorage) so those clubs
// are highlighted across standings, the scoreboard, and upcoming games. Pure store
// + ordering helpers (injectable storage) so it unit-tests in Node.

const LS_KEY = "mlb-favorites-v1";

export function createFavorites({ storage } = {}) {
  function load() {
    if (!storage) return [];
    try {
      const arr = JSON.parse(storage.getItem(LS_KEY));
      return Array.isArray(arr) ? arr.map(Number).filter(Number.isFinite) : [];
    } catch (_) { return []; }
  }
  function persist(ids) {
    if (!storage) return;
    try { storage.setItem(LS_KEY, JSON.stringify(ids)); } catch (_) { /* best-effort */ }
  }
  function toggle(teamId) {
    const id = Number(teamId);
    if (!storage || !Number.isFinite(id)) return load(); // no-op without storage
    const ids = load();
    const i = ids.indexOf(id);
    if (i >= 0) ids.splice(i, 1); else ids.push(id);
    persist(ids);
    return ids;
  }
  return {
    list: () => load(),
    has: (teamId) => load().includes(Number(teamId)),
    toggle
  };
}

// Pure: is `teamId` in the favorites array.
export function isFavorite(favs, teamId) {
  return Array.isArray(favs) && favs.includes(Number(teamId));
}

// Pure, stable: move favorites to the front while preserving relative order
// within each group. `getId(item)` extracts the team id.
export function sortFavoritesFirst(items, getId, favs) {
  const fav = new Set((favs || []).map(Number));
  const arr = (Array.isArray(items) ? items : []).map((it, i) => ({ it, i }));
  arr.sort((a, b) => {
    const fa = fav.has(Number(getId(a.it))) ? 0 : 1;
    const fb = fav.has(Number(getId(b.it))) ? 0 : 1;
    return fa - fb || a.i - b.i; // group, then stable by original index
  });
  return arr.map((x) => x.it);
}

function defaultStorage() {
  try { return typeof localStorage !== "undefined" ? localStorage : null; } catch (_) { return null; }
}

export const favorites = createFavorites({ storage: defaultStorage() });

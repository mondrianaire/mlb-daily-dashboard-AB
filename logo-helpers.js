// logo-helpers.js  (rev-2)
// Small utility module for the MLB CDN team-logo integration.
// External runtime dependency: https://www.mlbstatic.com/team-logos/...
//   - CORS Allow-Origin: * (verified rev-2)
//   - Cache-Control: 14-day TTL on edge
//   - Average payload: 1–2 KB per SVG
//
// Public exports:
//   preloadLogos(teamIds, variant)  -> Promise<Map<id, HTMLImageElement>>
//   getLogoImg(teamId, variant)     -> HTMLImageElement | null (synchronous,
//                                       valid after preload resolves)
//   logoElement(teamId, variant, sizePx) -> <img> element ready to drop into DOM
//
// Caching strategy: one HTMLImageElement per (teamId, variant). Once the image
// has loaded the .complete property is true and the element can be used as a
// Chart.js point-style without flicker. logoElement() returns *new* <img>
// nodes (since a single DOM node cannot live in two places at once), but the
// browser's HTTP cache + the 14-day CDN TTL keeps the network cost negligible.

import { getLogoUrl, ALL_TEAM_IDS } from "./teams.js";

const cache = new Map(); // key: `${variant}:${id}` -> HTMLImageElement
const pending = new Map(); // key: `${variant}:${id}` -> Promise<HTMLImageElement>

function cacheKey(teamId, variant) {
  return `${variant || "cap"}:${teamId}`;
}

/**
 * Load a single team's logo and return a cached HTMLImageElement.
 * Resolves once the image has finished decoding (or failed to load — in which
 * case it still resolves with the element but its .complete may be false).
 */
function loadOne(teamId, variant = "cap") {
  const key = cacheKey(teamId, variant);
  if (cache.has(key)) return Promise.resolve(cache.get(key));
  if (pending.has(key)) return pending.get(key);

  const url = getLogoUrl(teamId, variant);
  if (!url) return Promise.resolve(null);

  const img = new Image();
  img.decoding = "async";
  img.crossOrigin = "anonymous";
  img.alt = ""; // decorative when used as Chart.js point marker

  const p = new Promise((resolve) => {
    img.onload = () => { cache.set(key, img); pending.delete(key); resolve(img); };
    img.onerror = () => {
      // Still cache the (broken) element so we don't refetch indefinitely.
      cache.set(key, img); pending.delete(key); resolve(img);
    };
    // Kick off the request after wiring handlers.
    img.src = url;
  });
  pending.set(key, p);
  return p;
}

/**
 * Preload an array of team logos in parallel. Returns a Map<teamId, HTMLImageElement>
 * once every load has settled (success or error). Safe to call multiple times —
 * already-loaded entries resolve immediately from the cache.
 *
 * Typical usage from app.js after fetchTeams():
 *   preloadLogos(teams.map(t => t.id), "cap");  // fire-and-forget OK
 */
export async function preloadLogos(teamIds = ALL_TEAM_IDS, variant = "cap") {
  const ids = Array.isArray(teamIds) ? teamIds : [];
  const settled = await Promise.all(ids.map((id) => loadOne(id, variant)));
  const out = new Map();
  for (let i = 0; i < ids.length; i++) {
    if (settled[i]) out.set(ids[i], settled[i]);
  }
  return out;
}

/**
 * Synchronously return the cached HTMLImageElement for a team logo, or null
 * if preloadLogos() has not yet completed for that team. Useful when handing
 * an Image to Chart.js's pointStyle (which expects a ready-to-paint image).
 */
export function getLogoImg(teamId, variant = "cap") {
  return cache.get(cacheKey(teamId, variant)) || null;
}

/**
 * Build an <img> element for inline DOM use. Returns a *new* node each call.
 *   sizePx is applied to both width and height.
 */
export function logoElement(teamId, variant = "cap", sizePx = 24) {
  const img = document.createElement("img");
  img.src = getLogoUrl(teamId, variant);
  img.alt = ""; // teams are decoded by adjacent text labels; mark decorative
  img.width = sizePx;
  img.height = sizePx;
  img.loading = "lazy";
  img.decoding = "async";
  img.className = "logo-img";
  return img;
}

// Convenience: HTML string version of logoElement(), useful when the consumer
// is building an innerHTML string and doesn't want to switch to DOM nodes.
export function logoImgHtml(teamId, variant = "cap", sizePx = 24, extraClass = "") {
  const url = getLogoUrl(teamId, variant);
  const cls = ("logo-img " + (extraClass || "")).trim();
  return `<img src="${url}" alt="" width="${sizePx}" height="${sizePx}" loading="lazy" decoding="async" class="${cls}">`;
}

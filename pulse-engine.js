// pulse-engine.js  (audit P3 — trend pulse)
// Pure selection of the week's hottest and coldest club from the already-computed
// weekly trends, so the Daily view can show "who's rising / who's cooling" in zero
// clicks — the product's namesake capability, visible on first contact.
// Deterministic, no DOM, no HTTP. Same idiom as the other *-engine modules.
//
// Public API:
//   computePulse(trends) -> { hottest: Trend|null, coldest: Trend|null }
//
// Input: the Trend[] from trends-engine.js (each has teamId, last7W, last7L,
// runDiff7, streak, sparklinePoints). Teams with no games in the window are
// ignored. `coldest` is null when there isn't a distinct second club to contrast.

function played(t) {
  return (Number(t.last7W) || 0) + (Number(t.last7L) || 0) > 0;
}

export function computePulse(trends) {
  const rows = (Array.isArray(trends) ? trends : []).filter(played);
  if (rows.length === 0) return { hottest: null, coldest: null };

  const byHot = rows.slice().sort((a, b) =>
    (b.runDiff7 - a.runDiff7) || (b.last7W - a.last7W) || (a.teamId - b.teamId));
  const byCold = rows.slice().sort((a, b) =>
    (a.runDiff7 - b.runDiff7) || (b.last7L - a.last7L) || (a.teamId - b.teamId));

  const hottest = byHot[0];
  // Only surface a coldest if it's a different club than the hottest — showing the
  // same team as both rising and cooling would be nonsense.
  const coldest = (byCold[0] && byCold[0].teamId !== hottest.teamId) ? byCold[0] : null;
  return { hottest, coldest };
}

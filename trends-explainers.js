// trends-explainers.js  (OPP-003)
// Pure helpers that turn the Trends-tab merged team rows into a one-line,
// data-driven "Today:" caption per chart — naming who's actually at the
// extremes right now, so the user doesn't have to hover every bubble.
// Deterministic, no DOM, no HTTP. Each function returns "" when the data
// can't support a caption (e.g. a filtered set with no stats yet).
//
// Input rows are the objects produced by trends-charts.js buildMergedData():
//   { abbr, rs, ra, diff, ops, era, hr, kp9, bbp9, homeW, awayW, id, ... }

function signed(n) {
  const v = Math.round(Number(n) || 0);
  return v >= 0 ? `+${v}` : `${v}`;
}
function ops3(n) {
  return Number(n || 0).toFixed(3).replace(/^0/, "");
}
function kbb(t) {
  return (Number(t.kp9 || 0) / Math.max(Number(t.bbp9 || 0), 0.1));
}
// Deterministic argmax/argmin with teamId tiebreak.
function pick(rows, score, dir = "max") {
  let best = null, bestV = null;
  for (const t of rows) {
    const v = score(t);
    if (best === null ||
        (dir === "max" && (v > bestV || (v === bestV && t.id < best.id))) ||
        (dir === "min" && (v < bestV || (v === bestV && t.id < best.id)))) {
      best = t; bestV = v;
    }
  }
  return best;
}

// RS vs RA — who's outscoring opponents, who's getting outscored.
export function explainRSRA(teams) {
  const rows = (teams || []).filter((t) => (Number(t.rs) || 0) + (Number(t.ra) || 0) > 0);
  if (rows.length === 0) return "";
  const best = pick(rows, (t) => t.diff, "max");
  const worst = pick(rows, (t) => t.diff, "min");
  if (best.id === worst.id) {
    return `Today: ${best.abbr} at ${signed(best.diff)} run differential.`;
  }
  return `Today: ${best.abbr} leads run differential (${signed(best.diff)}); ${worst.abbr} most outscored (${signed(worst.diff)}).`;
}

// OPS vs ERA — top-right quadrant (high OPS, low ERA) is elite on both sides.
export function explainOpsEra(teams) {
  const rows = teams || [];
  const opsRows = rows.filter((t) => Number(t.ops) > 0);
  const eraRows = rows.filter((t) => Number(t.era) > 0);
  if (opsRows.length === 0 && eraRows.length === 0) return "";
  const bestOps = opsRows.length ? pick(opsRows, (t) => t.ops, "max") : null;
  const bestEra = eraRows.length ? pick(eraRows, (t) => t.era, "min") : null;
  if (bestOps && bestEra && bestOps.id === bestEra.id) {
    return `Today: ${bestOps.abbr} is elite on both sides — OPS ${ops3(bestOps.ops)}, ERA ${bestEra.era.toFixed(2)}.`;
  }
  const parts = [];
  if (bestOps) parts.push(`${bestOps.abbr} tops the bats (OPS ${ops3(bestOps.ops)})`);
  if (bestEra) parts.push(`${bestEra.abbr} owns the best ERA (${bestEra.era.toFixed(2)})`);
  return `Today: ${parts.join("; ")}.`;
}

// Home vs Road — biggest home advantage (or road edge if no one is home-strong).
export function explainHomeRoad(teams) {
  const rows = (teams || []).filter((t) => (Number(t.homeW) || 0) + (Number(t.awayW) || 0) > 0);
  if (rows.length === 0) return "";
  const homeEdge = pick(rows, (t) => (Number(t.homeW) || 0) - (Number(t.awayW) || 0), "max");
  const edge = (Number(homeEdge.homeW) || 0) - (Number(homeEdge.awayW) || 0);
  if (edge > 0) {
    return `Today: ${homeEdge.abbr} has the biggest home edge (${homeEdge.homeW} home vs ${homeEdge.awayW} road wins, last 14).`;
  }
  const roadEdge = pick(rows, (t) => (Number(t.awayW) || 0) - (Number(t.homeW) || 0), "max");
  return `Today: ${roadEdge.abbr} are road warriors (${roadEdge.awayW} road vs ${roadEdge.homeW} home wins, last 14).`;
}

// Power vs Discipline — most HR (power) and best staff K/BB (command).
export function explainPowerDisc(teams) {
  const rows = teams || [];
  const hrRows = rows.filter((t) => Number(t.hr) > 0);
  const cmdRows = rows.filter((t) => Number(t.kp9) > 0);
  if (hrRows.length === 0 && cmdRows.length === 0) return "";
  const topHR = hrRows.length ? pick(hrRows, (t) => t.hr, "max") : null;
  const topCmd = cmdRows.length ? pick(cmdRows, (t) => kbb(t), "max") : null;
  if (topHR && topCmd && topHR.id === topCmd.id) {
    return `Today: ${topHR.abbr} leads in both power (${topHR.hr} HR) and command (${kbb(topCmd).toFixed(2)} K/BB).`;
  }
  const parts = [];
  if (topHR) parts.push(`${topHR.abbr} leads in power (${topHR.hr} HR)`);
  if (topCmd) parts.push(`${topCmd.abbr} has the sharpest command (${kbb(topCmd).toFixed(2)} K/BB)`);
  return `Today: ${parts.join("; ")}.`;
}

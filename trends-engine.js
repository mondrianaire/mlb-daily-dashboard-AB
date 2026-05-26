// trends-engine.js
// Pure computation module: takes a Map<teamId, GameResult[]> (per
// data-client--trends-engine contract) and returns an Array<Trend> (per
// trends-engine--ui-render contract).
//
// Deterministic. No HTTP, no DOM, no globals.

/**
 * @typedef {Object} GameResult
 * @property {number} teamId
 * @property {string} gameDate     ISO YYYY-MM-DD
 * @property {boolean} isWin
 * @property {number} runsScored
 * @property {number} runsAllowed
 *
 * @typedef {Object} Trend
 * @property {number} teamId
 * @property {number} last7W
 * @property {number} last7L
 * @property {number} runDiff7
 * @property {string|null} streak
 * @property {number[]} sparklinePoints   cumulative run differential per game
 */

/**
 * @param {Map<number, GameResult[]>} perTeamResultMap
 * @returns {Trend[]}
 */
export function computeWeeklyTrends(perTeamResultMap) {
  if (!(perTeamResultMap instanceof Map)) {
    throw new TypeError(
      "computeWeeklyTrends expected a Map<teamId, GameResult[]>"
    );
  }

  const out = [];
  for (const [teamId, games] of perTeamResultMap.entries()) {
    if (!Array.isArray(games)) {
      throw new TypeError(
        `Value for teamId ${teamId} must be an Array of GameResult`
      );
    }
    out.push(trendFor(teamId, games));
  }

  // Deterministic ordering: sort by teamId ascending.
  out.sort((a, b) => a.teamId - b.teamId);
  return out;
}

function trendFor(teamId, games) {
  if (games.length === 0) {
    return {
      teamId,
      last7W: 0,
      last7L: 0,
      runDiff7: 0,
      streak: null,
      sparklinePoints: []
    };
  }

  // Assume input is sorted ascending by gameDate (contract invariant).
  // Defensive sort in case the producer breaks the invariant.
  const sorted = games
    .slice()
    .sort((a, b) =>
      a.gameDate < b.gameDate ? -1 : a.gameDate > b.gameDate ? 1 : 0
    );

  let wins = 0;
  let losses = 0;
  let runDiffSum = 0;
  const sparklinePoints = [];
  let cumulative = 0;

  for (const g of sorted) {
    if (g.isWin) wins++; else losses++;
    const diff = Number(g.runsScored) - Number(g.runsAllowed);
    runDiffSum += diff;
    cumulative += diff;
    sparklinePoints.push(cumulative);
  }

  // Streak: walk backwards from the most recent game, counting consecutive
  // results of the same kind.
  const last = sorted[sorted.length - 1];
  const streakKind = last.isWin ? "W" : "L";
  let streakLen = 0;
  for (let i = sorted.length - 1; i >= 0; i--) {
    const g = sorted[i];
    if ((g.isWin && streakKind === "W") || (!g.isWin && streakKind === "L")) {
      streakLen++;
    } else {
      break;
    }
  }

  return {
    teamId,
    last7W: wins,
    last7L: losses,
    runDiff7: runDiffSum,
    streak: `${streakKind}${streakLen}`,
    sparklinePoints
  };
}

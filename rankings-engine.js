// rankings-engine.js
// Pure computation module: takes the standings array produced by data-client
// (data-client--rankings-engine contract) and projects three views:
//
//   divisionStandings : { AL_East, AL_Central, AL_West, NL_East, NL_Central, NL_West }
//   leagueStandings   : { AL, NL }
//   wildCard          : { AL, NL }  (top 3 non-division-leaders per league)
//
// No HTTP, no DOM. Deterministic.

/**
 * @typedef {Object} StandingEntry
 * @property {number} teamId
 * @property {string} teamName
 * @property {string} teamAbbreviation
 * @property {"AL"|"NL"} league
 * @property {"East"|"Central"|"West"} division
 * @property {number} wins
 * @property {number} losses
 * @property {number} pct
 * @property {number|"-"} gb
 *
 * @typedef {{divisionStandings:Object, leagueStandings:Object, wildCard:Object}} Rankings
 */

const DIVISION_KEYS = [
  "AL_East", "AL_Central", "AL_West",
  "NL_East", "NL_Central", "NL_West"
];

/**
 * @param {StandingEntry[]} standings
 * @returns {Rankings}
 */
export function computeRankings(standings) {
  if (!Array.isArray(standings)) {
    throw new TypeError("computeRankings expected an Array<StandingEntry>");
  }

  // Initialize all six division buckets so the output shape is stable even
  // when the input is partial (contract invariant: always exactly 6 keys).
  /** @type {Record<string, StandingEntry[]>} */
  const divisionStandings = Object.fromEntries(DIVISION_KEYS.map((k) => [k, []]));

  for (const t of standings) {
    if (!t || typeof t !== "object") {
      throw new TypeError("Each standings entry must be an object");
    }
    const key = `${t.league}_${t.division}`;
    if (divisionStandings[key]) {
      divisionStandings[key].push(t);
    }
  }

  // Sort each division by pct descending (ties broken by wins desc).
  for (const key of DIVISION_KEYS) {
    divisionStandings[key].sort(sortByPctDesc);
  }

  // League standings: all 15 teams per league sorted by pct desc.
  const leagueStandings = {
    AL: standings.filter((t) => t.league === "AL").slice().sort(sortByPctDesc),
    NL: standings.filter((t) => t.league === "NL").slice().sort(sortByPctDesc)
  };

  // Wild card: top 3 non-division-leaders per league, by pct desc.
  const wildCard = {
    AL: wildCardFor(divisionStandings, ["AL_East", "AL_Central", "AL_West"]),
    NL: wildCardFor(divisionStandings, ["NL_East", "NL_Central", "NL_West"])
  };

  return { divisionStandings, leagueStandings, wildCard };
}

// Magic number for a division/race leader to clinch over the runner-up:
//   M = (season games + 1) − leaderWins − runnerUpLosses, floored at 0.
// When M hits 0 the leader has clinched. Pure; season length defaults to 162.
export function magicNumber(leaderWins, runnerUpLosses, seasonGames = 162) {
  const m = (Number(seasonGames) || 162) + 1 - (Number(leaderWins) || 0) - (Number(runnerUpLosses) || 0);
  return Math.max(0, m);
}

// Leader's magic number for a division list (already sorted by pct desc).
// null when the division has fewer than two teams.
export function divisionMagic(entries, seasonGames = 162) {
  if (!Array.isArray(entries) || entries.length < 2) return null;
  return magicNumber(entries[0].wins, entries[1].losses, seasonGames);
}

function sortByPctDesc(a, b) {
  if (b.pct !== a.pct) return b.pct - a.pct;
  // Tiebreaker: more wins ranks higher.
  if (b.wins !== a.wins) return b.wins - a.wins;
  return a.teamId - b.teamId;
}

function wildCardFor(divisionStandings, divisionKeys) {
  const leaderIds = new Set();
  const candidates = [];
  for (const key of divisionKeys) {
    const division = divisionStandings[key];
    if (division.length > 0) leaderIds.add(division[0].teamId);
    for (let i = 1; i < division.length; i++) candidates.push(division[i]);
  }
  // Filter defensively in case the same team appears via odd input shapes.
  return candidates
    .filter((t) => !leaderIds.has(t.teamId))
    .sort(sortByPctDesc)
    .slice(0, 3);
}

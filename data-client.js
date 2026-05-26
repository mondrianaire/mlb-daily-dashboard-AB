// data-client.js
// Owns every outbound HTTP request to the MLB Stats API.
// No DOM. No business-logic computation beyond response normalization.
// All URLs target https://statsapi.mlb.com/api/v1/.
//
// Contracts implemented:
//   data-client--rankings-engine  : fetchStandings(season)
//   data-client--trends-engine    : fetchTeamGameResults(teamId, startDate, endDate)
//   data-client--ui-render        : fetchSchedule(startDate, endDate)
// Additional exports:
//   fetchTeams()                  : team metadata + color fallback
//   fetchRecentResults(days)      : convenience wrapper used by ui-render
//   DataClientError               : named error class for non-200 / network failures

import { TEAM_META, ALL_TEAM_IDS, teamMeta } from "./teams.js";

const API_BASE = "https://statsapi.mlb.com/api/v1";

// Use current season dynamically so the dashboard does not rot on Jan 1.
function currentSeason() {
  return new Date().getFullYear();
}

// ---------- Error type ----------
export class DataClientError extends Error {
  constructor(message, { cause, status, url } = {}) {
    super(message);
    this.name = "DataClientError";
    this.status = status ?? null;
    this.url = url ?? null;
    if (cause) this.cause = cause;
  }
}

// ---------- Internal helper ----------
async function getJSON(url) {
  let res;
  try {
    res = await fetch(url, { headers: { Accept: "application/json" } });
  } catch (networkErr) {
    throw new DataClientError(
      `Network failure contacting ${url}: ${networkErr.message}`,
      { cause: networkErr, url }
    );
  }
  if (!res.ok) {
    throw new DataClientError(
      `Non-200 response from ${url}: ${res.status} ${res.statusText}`,
      { status: res.status, url }
    );
  }
  try {
    return await res.json();
  } catch (parseErr) {
    throw new DataClientError(
      `Malformed JSON from ${url}: ${parseErr.message}`,
      { cause: parseErr, url }
    );
  }
}

// ---------- Date helpers (UTC-safe ISO YYYY-MM-DD) ----------
function isoDate(d) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}
function todayISO() {
  return isoDate(new Date());
}
function daysAgoISO(n) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return isoDate(d);
}
function daysAheadISO(n) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + n);
  return isoDate(d);
}

// ---------- fetchTeams ----------
// GET /api/v1/teams?sportId=1&season=<year>
// Augments each MLB-returned team with our hardcoded color fallback.
export async function fetchTeams(season = currentSeason()) {
  const url = `${API_BASE}/teams?sportId=1&season=${season}`;
  const json = await getJSON(url);
  const raw = Array.isArray(json.teams) ? json.teams : [];

  // Build a quick lookup of the API response by id.
  const byId = new Map(raw.map((t) => [t.id, t]));

  // Always return one entry per known team id, merged with the API result
  // when available. This guarantees 30 entries even if the API omits one.
  return ALL_TEAM_IDS.map((id) => {
    const meta = TEAM_META[id];
    const t = byId.get(id);
    return {
      id,
      name: t?.name ?? meta.name,
      abbreviation: t?.abbreviation ?? meta.abbr,
      teamName: t?.teamName ?? meta.name.split(" ").slice(-1)[0],
      locationName: t?.locationName ?? meta.name.split(" ").slice(0, -1).join(" "),
      league: meta.league,
      division: meta.division,
      primaryColor: meta.primaryColor,
      secondaryColor: meta.secondaryColor
    };
  });
}

// ---------- fetchStandings ----------
// GET /api/v1/standings?leagueId=103,104&season=<year>&standingsTypes=regularSeason
// Returns Array<StandingEntry> per data-client--rankings-engine contract.
const DIVISION_BY_ID = {
  // AL
  201: { league: "AL", division: "East"    },
  202: { league: "AL", division: "Central" },
  200: { league: "AL", division: "West"    },
  // NL
  204: { league: "NL", division: "East"    },
  205: { league: "NL", division: "Central" },
  203: { league: "NL", division: "West"    }
};

export async function fetchStandings(season = currentSeason()) {
  const url = `${API_BASE}/standings?leagueId=103,104&season=${season}&standingsTypes=regularSeason`;
  const json = await getJSON(url);
  const records = Array.isArray(json.records) ? json.records : [];

  const out = [];
  for (const div of records) {
    const divInfo = DIVISION_BY_ID[div.division?.id] || null;
    const league = divInfo?.league
      || (div.league?.id === 103 ? "AL" : div.league?.id === 104 ? "NL" : "AL");
    const division = divInfo?.division || "East";

    for (const entry of (div.teamRecords || [])) {
      const teamId = entry.team?.id;
      const meta = teamMeta(teamId);
      const wins = Number(entry.wins ?? 0);
      const losses = Number(entry.losses ?? 0);
      const games = wins + losses;
      const pct = games > 0 ? Number((wins / games).toFixed(3)) : 0;

      // gb: API returns "-" for leader or a numeric string like "4.0"
      let gb = entry.gamesBack;
      if (gb === "-" || gb === undefined || gb === null) {
        gb = "-";
      } else {
        const n = Number(gb);
        gb = Number.isFinite(n) ? n : "-";
      }

      out.push({
        teamId,
        teamName: entry.team?.name ?? meta?.name ?? `Team ${teamId}`,
        teamAbbreviation: meta?.abbr ?? "",
        league,
        division,
        wins,
        losses,
        pct,
        gb,
        // Bonus fields used internally (not part of contract surface)
        runsScored: Number(entry.runsScored ?? 0),
        runsAllowed: Number(entry.runsAllowed ?? 0),
        streak: entry.streak?.streakCode ?? null
      });
    }
  }
  return out;
}

// ---------- fetchSchedule ----------
// GET /api/v1/schedule?sportId=1&startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
// Returns Array<ScheduleEntry> per data-client--ui-render contract.
export async function fetchSchedule(
  startDate = todayISO(),
  endDate = daysAheadISO(7)
) {
  const url = `${API_BASE}/schedule?sportId=1&startDate=${startDate}&endDate=${endDate}`;
  const json = await getJSON(url);
  const dates = Array.isArray(json.dates) ? json.dates : [];

  const out = [];
  for (const dayBucket of dates) {
    for (const game of (dayBucket.games || [])) {
      const away = game.teams?.away?.team ?? {};
      const home = game.teams?.home?.team ?? {};
      const awayMeta = teamMeta(away.id);
      const homeMeta = teamMeta(home.id);
      out.push({
        gameId: game.gamePk,
        gameDate: game.gameDate,
        awayTeam: {
          teamId: away.id,
          teamAbbreviation: awayMeta?.abbr ?? "",
          teamName: away.name ?? awayMeta?.name ?? ""
        },
        homeTeam: {
          teamId: home.id,
          teamAbbreviation: homeMeta?.abbr ?? "",
          teamName: home.name ?? homeMeta?.name ?? ""
        },
        status: game.status?.detailedState ?? game.status?.abstractGameState ?? "Scheduled",
        // Internal fields useful to consumers but not in contract surface:
        awayScore: game.teams?.away?.score ?? null,
        homeScore: game.teams?.home?.score ?? null
      });
    }
  }
  out.sort((a, b) => (a.gameDate < b.gameDate ? -1 : a.gameDate > b.gameDate ? 1 : 0));
  return out;
}

// ---------- fetchTeamGameResults ----------
// Returns the team's completed games in the inclusive window.
// Uses the same schedule endpoint scoped by teamId for efficiency.
export async function fetchTeamGameResults(teamId, startDate, endDate) {
  const url = `${API_BASE}/schedule?sportId=1&teamId=${teamId}&startDate=${startDate}&endDate=${endDate}`;
  const json = await getJSON(url);
  const dates = Array.isArray(json.dates) ? json.dates : [];

  const out = [];
  for (const dayBucket of dates) {
    for (const game of (dayBucket.games || [])) {
      const state = game.status?.abstractGameState;
      if (state !== "Final") continue; // only completed games

      const isHome = game.teams?.home?.team?.id === teamId;
      const teamSide = isHome ? game.teams.home : game.teams.away;
      const oppSide = isHome ? game.teams.away : game.teams.home;
      const runsScored = Number(teamSide?.score ?? 0);
      const runsAllowed = Number(oppSide?.score ?? 0);

      out.push({
        teamId,
        gameDate: (game.officialDate || game.gameDate || "").slice(0, 10),
        isWin: runsScored > runsAllowed,
        runsScored,
        runsAllowed
      });
    }
  }
  out.sort((a, b) => (a.gameDate < b.gameDate ? -1 : a.gameDate > b.gameDate ? 1 : 0));
  return out;
}

// ---------- fetchRecentResults ----------
// Returns a Map<teamId, GameResult[]> covering all 30 teams for the last N days.
// Uses one schedule call (all teams) and partitions client-side to avoid N+1.
export async function fetchRecentResults(days = 7) {
  const start = daysAgoISO(days - 1); // inclusive 7-day window ending today
  const end = todayISO();
  const url = `${API_BASE}/schedule?sportId=1&startDate=${start}&endDate=${end}`;
  const json = await getJSON(url);
  const dates = Array.isArray(json.dates) ? json.dates : [];

  // Initialize empty arrays for every known team.
  const byTeam = new Map();
  for (const id of ALL_TEAM_IDS) byTeam.set(id, []);

  for (const dayBucket of dates) {
    for (const game of (dayBucket.games || [])) {
      const state = game.status?.abstractGameState;
      if (state !== "Final") continue;
      const homeId = game.teams?.home?.team?.id;
      const awayId = game.teams?.away?.team?.id;
      const homeScore = Number(game.teams?.home?.score ?? 0);
      const awayScore = Number(game.teams?.away?.score ?? 0);
      const date = (game.officialDate || game.gameDate || "").slice(0, 10);

      if (byTeam.has(homeId)) {
        byTeam.get(homeId).push({
          teamId: homeId,
          gameDate: date,
          isWin: homeScore > awayScore,
          runsScored: homeScore,
          runsAllowed: awayScore
        });
      }
      if (byTeam.has(awayId)) {
        byTeam.get(awayId).push({
          teamId: awayId,
          gameDate: date,
          isWin: awayScore > homeScore,
          runsScored: awayScore,
          runsAllowed: homeScore
        });
      }
    }
  }

  // Sort each team's array by date ascending per contract invariant.
  for (const arr of byTeam.values()) {
    arr.sort((a, b) => (a.gameDate < b.gameDate ? -1 : a.gameDate > b.gameDate ? 1 : 0));
  }
  return byTeam;
}

// ---------- Date utility re-exports (used by ui-render) ----------
export const DateUtil = { todayISO, daysAgoISO, daysAheadISO, isoDate };

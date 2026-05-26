// stats-client.js
// Additional fetchers for the Trends tab. Returns typed JS shapes that
// trends-charts.js consumes (per-team hitting/pitching stats + 14-day game log).
// Mirrors the DataClientError pattern used by data-client.js.
//
// Exports:
//   fetchTeamHittingStats(season)   -> Map<teamId, HittingStats>
//   fetchTeamPitchingStats(season)  -> Map<teamId, PitchingStats>
//   fetchCompletedGames14d()        -> { dates: string[], byTeam: Map<teamId, {date,isWin}[]> }
//   StatsClientError                -> named error class

import { ALL_TEAM_IDS, teamMeta } from "./teams.js";

const API_BASE = "https://statsapi.mlb.com/api/v1";

function currentSeason() {
  return new Date().getFullYear();
}

// ---------- Error type ----------
export class StatsClientError extends Error {
  constructor(message, { cause, status, url } = {}) {
    super(message);
    this.name = "StatsClientError";
    this.status = status ?? null;
    this.url = url ?? null;
    if (cause) this.cause = cause;
  }
}

async function getJSON(url) {
  let res;
  try {
    res = await fetch(url, { headers: { Accept: "application/json" } });
  } catch (networkErr) {
    throw new StatsClientError(
      `Network failure contacting ${url}: ${networkErr.message}`,
      { cause: networkErr, url }
    );
  }
  if (!res.ok) {
    throw new StatsClientError(
      `Non-200 response from ${url}: ${res.status} ${res.statusText}`,
      { status: res.status, url }
    );
  }
  try {
    return await res.json();
  } catch (parseErr) {
    throw new StatsClientError(
      `Malformed JSON from ${url}: ${parseErr.message}`,
      { cause: parseErr, url }
    );
  }
}

// ---------- Date helpers (UTC) ----------
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

// ---------- Internal extractor: pulls a stat-group block out of the
// /teams/stats response and indexes by teamId. ----------
function indexStatsByTeam(json) {
  // The /teams/stats endpoint returns:
  //   { stats: [ { splits: [ { team: {id}, stat: {...} }, ... ] } ] }
  const byTeam = new Map();
  const statsArr = Array.isArray(json.stats) ? json.stats : [];
  for (const block of statsArr) {
    const splits = Array.isArray(block.splits) ? block.splits : [];
    for (const s of splits) {
      const id = s.team?.id;
      if (!id) continue;
      byTeam.set(id, s.stat || {});
    }
  }
  return byTeam;
}

function num(v, fallback = 0) {
  if (v === null || v === undefined || v === "") return fallback;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

// ---------- fetchTeamHittingStats ----------
// GET /api/v1/teams/stats?stats=season&group=hitting&season=<year>&sportIds=1
// Returns Map<teamId, { avg, obp, slg, ops, hr, bb, k, sb, runsScored }>.
export async function fetchTeamHittingStats(season = currentSeason()) {
  const url = `${API_BASE}/teams/stats?stats=season&group=hitting&season=${season}&sportIds=1`;
  const json = await getJSON(url);
  const raw = indexStatsByTeam(json);

  const out = new Map();
  for (const id of ALL_TEAM_IDS) {
    const s = raw.get(id) || {};
    out.set(id, {
      avg: num(s.avg),
      obp: num(s.obp),
      slg: num(s.slg),
      ops: num(s.ops),
      hr: num(s.homeRuns),
      bb: num(s.baseOnBalls),
      k: num(s.strikeOuts),
      sb: num(s.stolenBases),
      runsScored: num(s.runs),
      hits: num(s.hits),
      atBats: num(s.atBats)
    });
  }
  return out;
}

// ---------- fetchTeamPitchingStats ----------
// GET /api/v1/teams/stats?stats=season&group=pitching&season=<year>&sportIds=1
// Returns Map<teamId, { era, whip, kp9, bbp9, hrp9, saves, runsAllowed }>.
export async function fetchTeamPitchingStats(season = currentSeason()) {
  const url = `${API_BASE}/teams/stats?stats=season&group=pitching&season=${season}&sportIds=1`;
  const json = await getJSON(url);
  const raw = indexStatsByTeam(json);

  const out = new Map();
  for (const id of ALL_TEAM_IDS) {
    const s = raw.get(id) || {};
    out.set(id, {
      era: num(s.era),
      whip: num(s.whip),
      kp9: num(s.strikeoutsPer9Inn),
      bbp9: num(s.walksPer9Inn),
      hrp9: num(s.homeRunsPer9),
      saves: num(s.saves),
      runsAllowed: num(s.runs),
      strikeOuts: num(s.strikeOuts),
      walks: num(s.baseOnBalls)
    });
  }
  return out;
}

// ---------- fetchCompletedGames14d ----------
// GET /api/v1/schedule?sportId=1&startDate=...&endDate=...
// Returns { dates, byTeam } where:
//   dates  : ISO strings ascending (the 14-day window)
//   byTeam : Map<teamId, Array<{ date, isWin, opponentId, isHome }>>
export async function fetchCompletedGames14d(endDate = todayISO(), windowDays = 14) {
  const start = (() => {
    const d = new Date(endDate + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() - (windowDays - 1));
    return isoDate(d);
  })();
  const url = `${API_BASE}/schedule?sportId=1&startDate=${start}&endDate=${endDate}`;
  const json = await getJSON(url);
  const days = Array.isArray(json.dates) ? json.dates : [];

  const byTeam = new Map();
  for (const id of ALL_TEAM_IDS) byTeam.set(id, []);

  // Build inclusive list of date strings spanning the window.
  const dates = [];
  {
    const s = new Date(start + "T00:00:00Z");
    const e = new Date(endDate + "T00:00:00Z");
    for (let cur = new Date(s); cur <= e; cur.setUTCDate(cur.getUTCDate() + 1)) {
      dates.push(isoDate(cur));
    }
  }

  for (const dayBucket of days) {
    for (const game of (dayBucket.games || [])) {
      const state = game.status?.abstractGameState;
      if (state !== "Final") continue;
      const date = (game.officialDate || game.gameDate || "").slice(0, 10);
      const homeId = game.teams?.home?.team?.id;
      const awayId = game.teams?.away?.team?.id;
      const homeScore = num(game.teams?.home?.score);
      const awayScore = num(game.teams?.away?.score);

      if (byTeam.has(homeId)) {
        byTeam.get(homeId).push({
          date, isWin: homeScore > awayScore,
          opponentId: awayId, isHome: true
        });
      }
      if (byTeam.has(awayId)) {
        byTeam.get(awayId).push({
          date, isWin: awayScore > homeScore,
          opponentId: homeId, isHome: false
        });
      }
    }
  }
  for (const arr of byTeam.values()) {
    arr.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  }

  return { dates, byTeam };
}

// ---------- Date util re-exports (so trends-charts.js can use them) ----------
export const StatsDateUtil = { todayISO, daysAgoISO, isoDate };

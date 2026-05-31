// watchability-engine.js  (OPP-001)
// Pure computation module: ranks tonight's games by how worth-watching they are,
// using ONLY data the app already has in memory (schedule + weekly trends +
// computed standings). No HTTP, no DOM, deterministic — same idiom as
// rankings-engine.js / trends-engine.js.
//
// Public API:
//   computeWatchability({ schedule, trends, rankings, today }) -> {
//     date,                         // the ISO date scored
//     scored: Array<ScoredGame>,    // tonight's games, score desc
//     topIds: number[],             // up to TOP_N gameIds (the badged ones)
//     byGameId: Map<number, { score, reasons, rank }>
//   }
//
// ScoredGame: { gameId, score (0-100 int), reasons: string[], awayAbbr, homeAbbr }
//
// The model is intentionally transparent: four weighted 0-100 signals plus a
// small divisional-rivalry bonus. Weights are documented constants so the
// ranking is explainable (every badge carries a human-readable reason).

const TOP_N = 3;

// Signal weights (sum to 1.0, excluding the flat divisional bonus).
const W = {
  form: 0.30,    // are both teams playing well *right now* (last 7)
  quality: 0.30, // are both teams good (season win pct / standings)
  stakes: 0.25,  // is at least one team a contender in a tight race
  streak: 0.15   // is a team riding a hot win streak
};
const DIVISION_BONUS = 8; // flat add (then clamp to 100) for in-division games

// Reason thresholds.
const HOT_STREAK_MIN = 4;   // win-streak length to call a team "hot"
const HOT_FORM_MIN = 60;    // per-team form score to call them hot
const ELITE_QUALITY_MIN = 60; // avg quality to call it a marquee
const TIGHT_RACE_GB_MAX = 4;  // games-back to call a race "tight"

// ---------- helpers ----------
function clamp01(x) {
  return x < 0 ? 0 : x > 1 ? 1 : x;
}
function gbNumber(gb) {
  if (gb === "-" || gb === undefined || gb === null) return 0; // leader
  const n = Number(gb);
  return Number.isFinite(n) ? n : 0;
}
function winStreakLen(streak) {
  // streak is a string like "W3" / "L2" or null (from trends-engine).
  if (typeof streak !== "string" || streak[0] !== "W") return 0;
  const n = parseInt(streak.slice(1), 10);
  return Number.isFinite(n) ? n : 0;
}

// Per-team form 0-100 from weekly trend (neutral 50 when no recent games).
function formScore(trend) {
  if (!trend) return 50;
  const games = (trend.last7W || 0) + (trend.last7L || 0);
  const winPct = games > 0 ? trend.last7W / games : 0.5;
  // runDiff7 typically lands within +/-15 over a week; normalize to 0..1.
  const runDiffNorm = clamp01((Number(trend.runDiff7 || 0) + 15) / 30);
  return 100 * (0.6 * winPct + 0.4 * runDiffNorm);
}

// Per-team season quality 0-100 from standings pct (neutral 50 when missing).
function qualityScore(standing) {
  if (!standing) return 50;
  return 100 * clamp01(Number(standing.pct || 0));
}

// Per-team contention 0..1: a *good* team sitting close to first place.
function contention(standing) {
  if (!standing) return 0;
  const closeness = clamp01(1 - gbNumber(standing.gb) / 8);
  return closeness * clamp01(Number(standing.pct || 0));
}

/**
 * @param {{schedule:Array, trends:Array, rankings:Object, today:string}} input
 * @returns {{date:string, scored:Array, topIds:number[], byGameId:Map}}
 */
export function computeWatchability({ schedule, trends, rankings, today }) {
  if (!Array.isArray(schedule)) {
    throw new TypeError("computeWatchability expected schedule to be an Array");
  }

  // Index trends + standings by teamId for O(1) lookups.
  const trendByTeam = new Map();
  for (const t of (Array.isArray(trends) ? trends : [])) {
    if (t && t.teamId != null) trendByTeam.set(t.teamId, t);
  }
  const standingByTeam = new Map();
  const league = rankings?.leagueStandings || {};
  for (const list of [league.AL, league.NL]) {
    for (const s of (Array.isArray(list) ? list : [])) {
      if (s && s.teamId != null) standingByTeam.set(s.teamId, s);
    }
  }

  // Only score games on the target date (UTC date part), and only those not
  // already completed — "tonight's" slate.
  const tonight = schedule.filter((g) => {
    const d = (g.gameDate || "").slice(0, 10);
    if (today && d !== today) return false;
    const st = g.status || "";
    return st !== "Final" && st !== "Game Over" && st !== "Completed Early";
  });

  const scored = tonight.map((g) => scoreGame(g, trendByTeam, standingByTeam));

  // Sort by score desc; tiebreak by gameId asc for determinism.
  scored.sort((a, b) => (b.score - a.score) || (a.gameId - b.gameId));

  const top = scored.slice(0, TOP_N);
  const topIds = top.map((s) => s.gameId);
  const byGameId = new Map();
  scored.forEach((s, i) => {
    byGameId.set(s.gameId, { score: s.score, reasons: s.reasons, rank: i });
  });

  return { date: today || null, scored, topIds, byGameId };
}

function scoreGame(game, trendByTeam, standingByTeam) {
  const awayId = game.awayTeam?.teamId;
  const homeId = game.homeTeam?.teamId;
  const ta = trendByTeam.get(awayId);
  const th = trendByTeam.get(homeId);
  const sa = standingByTeam.get(awayId);
  const sh = standingByTeam.get(homeId);

  const formA = formScore(ta);
  const formH = formScore(th);
  const avgForm = (formA + formH) / 2;

  const avgQuality = (qualityScore(sa) + qualityScore(sh)) / 2;

  const stakes = 100 * Math.max(contention(sa), contention(sh));

  const streakA = winStreakLen(ta?.streak);
  const streakH = winStreakLen(th?.streak);
  const maxStreak = Math.max(streakA, streakH);
  const streakHeat = 100 * clamp01(maxStreak / 8);

  const sameDivision =
    sa && sh && sa.league === sh.league && sa.division === sh.division;

  let score =
    W.form * avgForm +
    W.quality * avgQuality +
    W.stakes * stakes +
    W.streak * streakHeat +
    (sameDivision ? DIVISION_BONUS : 0);

  score = Math.round(Math.max(0, Math.min(100, score)));

  const reasons = buildReasons({
    game, sa, sh, formA, formH, avgQuality,
    streakA, streakH, sameDivision
  });

  return {
    gameId: game.gameId,
    score,
    reasons,
    awayAbbr: game.awayTeam?.teamAbbreviation || "",
    homeAbbr: game.homeTeam?.teamAbbreviation || ""
  };
}

// Produce up to two human-readable reasons, most compelling first.
function buildReasons({ game, sa, sh, formA, formH, avgQuality, streakA, streakH, sameDivision }) {
  const out = [];
  const awayAbbr = game.awayTeam?.teamAbbreviation || "Away";
  const homeAbbr = game.homeTeam?.teamAbbreviation || "Home";

  // 1) Hot win streak (specific + exciting).
  if (Math.max(streakA, streakH) >= HOT_STREAK_MIN) {
    const hotAbbr = streakA >= streakH ? awayAbbr : homeAbbr;
    const n = Math.max(streakA, streakH);
    out.push(`${hotAbbr} on a ${n}-game win streak`);
  }

  // 2) Tight divisional/standings race.
  const contenders = [sa, sh].filter(Boolean)
    .filter((s) => gbNumber(s.gb) <= TIGHT_RACE_GB_MAX && Number(s.pct || 0) >= 0.5);
  if (contenders.length > 0) {
    const s = contenders[0];
    out.push(`Tight ${s.league} ${s.division} race`);
  }

  // 3) Division rivalry.
  if (sameDivision && sa) {
    out.push(`Division rivalry (${sa.league} ${sa.division})`);
  }

  // 4) Both teams hot over the last 7.
  if (formA >= HOT_FORM_MIN && formH >= HOT_FORM_MIN) {
    out.push("Both teams hot over the last 7");
  }

  // 5) Two strong clubs.
  if (avgQuality >= ELITE_QUALITY_MIN) {
    const sameLeague = sa && sh && sa.league === sh.league;
    out.push(sameLeague ? `Two of the ${sa.league}'s best` : "Two of MLB's best");
  }

  if (out.length === 0) out.push("Top matchup on tonight's slate");

  // De-dup and cap at two.
  return [...new Set(out)].slice(0, 2);
}

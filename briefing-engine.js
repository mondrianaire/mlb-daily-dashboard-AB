// briefing-engine.js  (OPP-002, template version)
// Pure computation module: produces a short, plain-language "today around the
// league" briefing from data the app already has (computed standings + weekly
// trends + today's schedule). Deterministic, rule-based — NO LLM, no HTTP, no
// DOM. Every sentence is traceable to a real number on the page; the engine
// never invents a stat (the cardinal rule for a stats product).
//
// Public API:
//   computeBriefing({ rankings, trends, schedule, today }) -> {
//     highlights: Array<{ text: string, kind: string }>   // 0-5, most interesting first
//   }
//
// An LLM phrasing upgrade (Phase 4) would consume these already-grounded
// highlights for nicer wording — it would never generate the numbers.

const MAX_HIGHLIGHTS = 5;

// Noteworthiness thresholds (keep the briefing signal, not noise).
const WIN_STREAK_MIN = 3;
const LOSS_STREAK_MIN = 5;
const RUNDIFF_MIN = 8;
const BIG_LEAD_MIN = 3;     // games
const TIGHT_RACE_MAX = 2;   // games

// ---------- helpers ----------
function gbNumber(gb) {
  if (gb === "-" || gb === undefined || gb === null) return 0;
  const n = Number(gb);
  return Number.isFinite(n) ? n : 0;
}
function winStreakLen(streak) {
  if (typeof streak !== "string" || streak[0] !== "W") return 0;
  const n = parseInt(streak.slice(1), 10);
  return Number.isFinite(n) ? n : 0;
}
function lossStreakLen(streak) {
  if (typeof streak !== "string" || streak[0] !== "L") return 0;
  const n = parseInt(streak.slice(1), 10);
  return Number.isFinite(n) ? n : 0;
}
function plural(n, word) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

const DIVISION_KEYS = [
  "AL_East", "AL_Central", "AL_West",
  "NL_East", "NL_Central", "NL_West"
];
function divLabel(key) {
  return key.replace("_", " ");
}

/**
 * @param {{rankings:Object, trends:Array, schedule:Array, today:string}} input
 * @returns {{highlights: Array<{text:string, kind:string}>}}
 */
export function computeBriefing({ rankings, trends, schedule, today } = {}) {
  const league = rankings?.leagueStandings || {};
  const al = Array.isArray(league.AL) ? league.AL : [];
  const nl = Array.isArray(league.NL) ? league.NL : [];
  const allStandings = al.concat(nl);

  // teamId -> { name, abbr } from standings (the only place we have names).
  const nameById = new Map();
  for (const s of allStandings) {
    if (s && s.teamId != null) {
      nameById.set(s.teamId, {
        name: s.teamName || `Team ${s.teamId}`,
        abbr: s.teamAbbreviation || ""
      });
    }
  }
  const nameOf = (id) => nameById.get(id)?.name || `Team ${id}`;

  const trendList = Array.isArray(trends) ? trends : [];
  const divisions = rankings?.divisionStandings || {};

  // Candidate highlights, each with a priority (higher = more prominent).
  const candidates = [];
  const usedTeams = new Set(); // avoid two headline highlights about one club

  // 1) Best record in baseball (anchor).
  if (allStandings.length) {
    const best = allStandings.slice().sort(
      (a, b) => (b.pct - a.pct) || (b.wins - a.wins) || (a.teamId - b.teamId)
    )[0];
    candidates.push({
      priority: 100,
      team: best.teamId,
      kind: "record",
      text: `The ${nameOf(best.teamId)} own MLB's best record at ${best.wins}-${best.losses}.`
    });
  }

  // 2) Longest active win streak.
  const hotStreak = trendList
    .map((t) => ({ id: t.teamId, n: winStreakLen(t.streak) }))
    .filter((x) => x.n >= WIN_STREAK_MIN)
    .sort((a, b) => (b.n - a.n) || (a.id - b.id))[0];
  if (hotStreak) {
    candidates.push({
      priority: 90,
      team: hotStreak.id,
      kind: "streak",
      text: `The ${nameOf(hotStreak.id)} have won ${plural(hotStreak.n, "game")} in a row.`
    });
  }

  // 3) Best run differential over the last 7.
  const topRunDiff = trendList
    .slice()
    .filter((t) => Number(t.runDiff7) >= RUNDIFF_MIN)
    .sort((a, b) => (b.runDiff7 - a.runDiff7) || (a.teamId - b.teamId))[0];
  if (topRunDiff) {
    candidates.push({
      priority: 70,
      team: topRunDiff.teamId,
      kind: "rundiff",
      text: `The ${nameOf(topRunDiff.teamId)} have the week's best run differential at +${topRunDiff.runDiff7} over their last 7.`
    });
  }

  // 4) Biggest division lead + 5) tightest division race.
  let biggest = null;  // {gb, key, leaderId}
  let tightest = null; // {gb, key}
  for (const key of DIVISION_KEYS) {
    const d = divisions[key];
    if (!Array.isArray(d) || d.length < 2) continue;
    const lead = gbNumber(d[1].gb); // games back of 2nd place = leader's cushion
    if (lead >= BIG_LEAD_MIN && (!biggest || lead > biggest.gb)) {
      biggest = { gb: lead, key, leaderId: d[0].teamId };
    }
    if (lead > 0 && lead <= TIGHT_RACE_MAX && (!tightest || lead < tightest.gb)) {
      tightest = { gb: lead, key };
    }
  }
  if (biggest) {
    candidates.push({
      priority: 60,
      team: biggest.leaderId,
      kind: "lead",
      text: `The ${nameOf(biggest.leaderId)} hold the biggest cushion, up ${plural(biggest.gb, "game")} in the ${divLabel(biggest.key)}.`
    });
  }
  if (tightest) {
    candidates.push({
      priority: 80,
      team: null,
      kind: "race",
      text: `Just ${plural(tightest.gb, "game")} separates first place in the ${divLabel(tightest.key)}.`
    });
  }

  // 6) Longest active skid (drama, lower priority).
  const coldStreak = trendList
    .map((t) => ({ id: t.teamId, n: lossStreakLen(t.streak) }))
    .filter((x) => x.n >= LOSS_STREAK_MIN)
    .sort((a, b) => (b.n - a.n) || (a.id - b.id))[0];
  if (coldStreak) {
    candidates.push({
      priority: 40,
      team: coldStreak.id,
      kind: "skid",
      text: `The ${nameOf(coldStreak.id)} have lost ${plural(coldStreak.n, "game")} in a row.`
    });
  }

  // 7) Today's slate size.
  if (Array.isArray(schedule) && today) {
    const games = schedule.filter((g) => (g.gameDate || "").slice(0, 10) === today);
    if (games.length > 0) {
      candidates.push({
        priority: 50,
        team: null,
        kind: "slate",
        text: `${plural(games.length, "game")} on today's slate.`
      });
    }
  }

  // Order by priority; drop a candidate if its headline team already appeared
  // in a higher-priority highlight (keeps the briefing varied).
  candidates.sort((a, b) => (b.priority - a.priority));
  const highlights = [];
  for (const c of candidates) {
    if (highlights.length >= MAX_HIGHLIGHTS) break;
    if (c.team != null && usedTeams.has(c.team)) continue;
    if (c.team != null) usedTeams.add(c.team);
    // teamId is exposed so the renderer can show a team-color chip; the engine
    // stays free of any color/DOM concern (it only knows which team a line is about).
    highlights.push({ text: c.text, kind: c.kind, teamId: c.team ?? null });
  }

  return { highlights };
}

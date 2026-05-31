// tests/watchability-engine.test.js
// Unit tests for the watchability ranker (OPP-001).
// Run: npm test   (or: node --test)

import { test } from "node:test";
import assert from "node:assert/strict";
import { computeWatchability } from "../watchability-engine.js";

const TODAY = "2026-06-15";

function standing(teamId, league, division, pct, gb) {
  return { teamId, league, division, wins: Math.round(pct * 100), losses: Math.round((1 - pct) * 100), pct, gb };
}
function trend(teamId, w, l, runDiff7, streak) {
  return { teamId, last7W: w, last7L: l, runDiff7, streak, sparklinePoints: [] };
}
function game(gameId, awayId, awayAbbr, homeId, homeAbbr, { date = TODAY, status = "Scheduled" } = {}) {
  return {
    gameId,
    gameDate: `${date}T23:05:00Z`,
    awayTeam: { teamId: awayId, teamAbbreviation: awayAbbr },
    homeTeam: { teamId: homeId, teamAbbreviation: homeAbbr },
    status
  };
}

// Two strong AL East contenders (one on a hot streak) + two weak AL Central clubs.
const NYY = 147, BOS = 111, CWS = 145, KC = 118;
const rankings = {
  leagueStandings: {
    AL: [
      standing(NYY, "AL", "East", 0.700, "-"),
      standing(BOS, "AL", "East", 0.650, 2),
      standing(CWS, "AL", "Central", 0.300, 20),
      standing(KC, "AL", "Central", 0.320, 18)
    ],
    NL: []
  }
};
const trends = [
  trend(NYY, 5, 0, 20, "W5"),
  trend(BOS, 4, 3, 3, "W1"),
  trend(CWS, 1, 6, -18, "L4"),
  trend(KC, 2, 5, -10, "L2")
];

test("throws when schedule is not an array", () => {
  assert.throws(() => computeWatchability({ schedule: null, trends, rankings, today: TODAY }), TypeError);
});

test("scores only tonight's non-final games", () => {
  const schedule = [
    game(1, NYY, "NYY", BOS, "BOS"),                       // tonight
    game(2, CWS, "CWS", KC, "KC"),                          // tonight
    game(3, NYY, "NYY", BOS, "BOS", { date: "2026-06-16" }),// tomorrow -> excluded
    game(4, NYY, "NYY", BOS, "BOS", { status: "Final" })    // completed -> excluded
  ];
  const r = computeWatchability({ schedule, trends, rankings, today: TODAY });
  assert.deepEqual(r.scored.map((s) => s.gameId).sort(), [1, 2]);
});

test("ranks the marquee matchup above the dud, with score desc", () => {
  const schedule = [game(2, CWS, "CWS", KC, "KC"), game(1, NYY, "NYY", BOS, "BOS")];
  const r = computeWatchability({ schedule, trends, rankings, today: TODAY });
  assert.equal(r.topIds[0], 1, "NYY@BOS should be the top game");
  assert.ok(r.scored[0].score > r.scored[1].score);
  assert.equal(r.byGameId.get(1).rank, 0);
  assert.equal(r.byGameId.get(2).rank, 1);
});

test("reasons name the hot streak and the tight race", () => {
  const schedule = [game(1, NYY, "NYY", BOS, "BOS")];
  const r = computeWatchability({ schedule, trends, rankings, today: TODAY });
  const reasons = r.byGameId.get(1).reasons;
  assert.ok(reasons.length >= 1 && reasons.length <= 2, "at most two reasons");
  assert.ok(reasons.some((x) => x.includes("NYY") && x.includes("5-game")), `got: ${reasons}`);
  assert.ok(reasons.some((x) => x.includes("AL East")), `got: ${reasons}`);
});

test("a divisional dud still gets a non-empty fallback reason set", () => {
  const schedule = [game(2, CWS, "CWS", KC, "KC")];
  const r = computeWatchability({ schedule, trends, rankings, today: TODAY });
  const reasons = r.byGameId.get(2).reasons;
  assert.ok(reasons.length >= 1, "always at least one reason");
});

test("caps the top set at three games", () => {
  const schedule = [
    game(1, NYY, "NYY", BOS, "BOS"),
    game(2, CWS, "CWS", KC, "KC"),
    game(3, NYY, "NYY", KC, "KC"),
    game(4, BOS, "BOS", CWS, "CWS"),
    game(5, KC, "KC", NYY, "NYY")
  ];
  const r = computeWatchability({ schedule, trends, rankings, today: TODAY });
  assert.equal(r.topIds.length, 3);
  assert.equal(r.scored.length, 5);
});

test("empty tonight slate yields empty results, not an error", () => {
  const schedule = [game(3, NYY, "NYY", BOS, "BOS", { date: "2026-06-16" })];
  const r = computeWatchability({ schedule, trends, rankings, today: TODAY });
  assert.deepEqual(r.scored, []);
  assert.deepEqual(r.topIds, []);
});

test("missing trends/standings degrade to neutral, never throw", () => {
  const schedule = [game(1, 999, "ZZZ", 998, "YYY")];
  const r = computeWatchability({ schedule, trends: [], rankings: {}, today: TODAY });
  assert.equal(r.scored.length, 1);
  assert.ok(Number.isFinite(r.scored[0].score));
});

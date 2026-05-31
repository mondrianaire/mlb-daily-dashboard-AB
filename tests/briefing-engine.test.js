// tests/briefing-engine.test.js
// Unit tests for the daily briefing engine (OPP-002, template version).
// Run: npm test   (or: node --test)

import { test } from "node:test";
import assert from "node:assert/strict";
import { computeBriefing } from "../briefing-engine.js";

const TODAY = "2026-06-15";

function s(teamId, name, abbr, league, division, wins, losses, gb) {
  const g = wins + losses;
  return {
    teamId, teamName: name, teamAbbreviation: abbr,
    league, division, wins, losses,
    pct: g ? Number((wins / g).toFixed(3)) : 0, gb
  };
}
function tr(teamId, runDiff7, streak) {
  return { teamId, last7W: 0, last7L: 0, runDiff7, streak, sparklinePoints: [] };
}

// Coherent league snapshot designed to exercise every rule.
const NYY = s(147, "New York Yankees", "NYY", "AL", "East", 70, 30, "-");
const BOS = s(111, "Boston Red Sox", "BOS", "AL", "East", 66, 34, "4.0");
const CLE = s(114, "Cleveland Guardians", "CLE", "AL", "Central", 55, 45, "-");
const MIN = s(142, "Minnesota Twins", "MIN", "AL", "Central", 54, 46, "1.0");
const LAD = s(119, "Los Angeles Dodgers", "LAD", "NL", "West", 68, 32, "-");
const SD = s(135, "San Diego Padres", "SD", "NL", "West", 61, 39, "7.0");
const ATL = s(144, "Atlanta Braves", "ATL", "NL", "East", 60, 40, "-");
const NYM = s(121, "New York Mets", "NYM", "NL", "East", 50, 50, "10.0");

const rankings = {
  leagueStandings: { AL: [NYY, BOS, CLE, MIN], NL: [LAD, SD, ATL, NYM] },
  divisionStandings: {
    AL_East: [NYY, BOS], AL_Central: [CLE, MIN], AL_West: [],
    NL_East: [ATL, NYM], NL_Central: [], NL_West: [LAD, SD]
  }
};
const trends = [
  tr(147, 5, "W2"),    // NYY mild
  tr(111, 8, "W6"),    // BOS hot streak
  tr(119, 20, "W3"),   // LAD best run diff
  tr(142, -12, "L5")   // MIN skid
];
const schedule = [
  { gameId: 1, gameDate: `${TODAY}T23:05:00Z`, awayTeam: { teamId: 147 }, homeTeam: { teamId: 111 } },
  { gameId: 2, gameDate: `${TODAY}T20:00:00Z`, awayTeam: { teamId: 119 }, homeTeam: { teamId: 135 } }
];

test("returns an object with a highlights array", () => {
  const r = computeBriefing({ rankings, trends, schedule, today: TODAY });
  assert.ok(Array.isArray(r.highlights));
});

test("leads with MLB's best record", () => {
  const { highlights } = computeBriefing({ rankings, trends, schedule, today: TODAY });
  assert.equal(highlights[0].kind, "record");
  assert.match(highlights[0].text, /New York Yankees/);
  assert.match(highlights[0].text, /70-30/);
});

test("caps at five highlights", () => {
  const { highlights } = computeBriefing({ rankings, trends, schedule, today: TODAY });
  assert.ok(highlights.length <= 5);
  assert.equal(highlights.length, 5);
});

test("surfaces the hottest win streak (a different team than the record)", () => {
  const { highlights } = computeBriefing({ rankings, trends, schedule, today: TODAY });
  const streak = highlights.find((h) => h.kind === "streak");
  assert.ok(streak, "expected a streak highlight");
  assert.match(streak.text, /Boston Red Sox/);
  assert.match(streak.text, /6 games in a row/);
});

test("surfaces the best run differential", () => {
  const { highlights } = computeBriefing({ rankings, trends, schedule, today: TODAY });
  const rd = highlights.find((h) => h.kind === "rundiff");
  assert.ok(rd, "expected a rundiff highlight");
  assert.match(rd.text, /\+20/);
});

test("names the tightest race with correct singular/plural", () => {
  const { highlights } = computeBriefing({ rankings, trends, schedule, today: TODAY });
  const race = highlights.find((h) => h.kind === "race");
  assert.ok(race, "expected a race highlight");
  assert.match(race.text, /Just 1 game separates/);
  assert.match(race.text, /AL Central/);
});

test("no two highlights headline the same team", () => {
  const { highlights } = computeBriefing({ rankings, trends, schedule, today: TODAY });
  const teamMentions = ["New York Yankees", "Boston Red Sox", "Los Angeles Dodgers", "Atlanta Braves"];
  for (const name of teamMentions) {
    const count = highlights.filter((h) => h.text.includes(name)).length;
    assert.ok(count <= 1, `${name} appears in ${count} highlights`);
  }
});

test("never fabricates: empty trends => no streak/rundiff/skid highlights", () => {
  const { highlights } = computeBriefing({ rankings, trends: [], schedule, today: TODAY });
  assert.ok(!highlights.some((h) => ["streak", "rundiff", "skid"].includes(h.kind)));
  // standings-derived highlights still present
  assert.ok(highlights.some((h) => h.kind === "record"));
});

test("empty inputs yield an empty briefing, not an error", () => {
  const r = computeBriefing({});
  assert.deepEqual(r.highlights, []);
});

test("off-season-ish (standings only) still produces grounded highlights", () => {
  const r = computeBriefing({ rankings, trends: [], schedule: [], today: TODAY });
  assert.ok(r.highlights.length >= 1);
  assert.ok(!r.highlights.some((h) => h.kind === "slate")); // no games -> no slate line
});

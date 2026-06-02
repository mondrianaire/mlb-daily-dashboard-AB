// tests/probable-pitchers.test.js
// Verifies fetchSchedule normalizes the hydrated probable starters.
import { test } from "node:test";
import assert from "node:assert/strict";
import { fetchSchedule } from "../data-client.js";

test("fetchSchedule extracts probable pitchers and requests the hydrate", async () => {
  let calledUrl = "";
  global.fetch = async (url) => {
    calledUrl = String(url);
    return {
      ok: true,
      json: async () => ({
        dates: [{ games: [{
          gamePk: 1,
          gameDate: "2026-06-02T23:05:00Z",
          teams: {
            away: { team: { id: 147 }, probablePitcher: { fullName: "Gerrit Cole" } },
            home: { team: { id: 111 }, probablePitcher: { fullName: "Chris Sale" } }
          },
          status: { detailedState: "Scheduled", abstractGameState: "Preview" }
        }] }]
      })
    };
  };
  const out = await fetchSchedule("2026-06-02", "2026-06-09");
  assert.match(calledUrl, /hydrate=probablePitcher/);
  assert.equal(out[0].awayProbable, "Gerrit Cole");
  assert.equal(out[0].homeProbable, "Chris Sale");
});

test("fetchSchedule tolerates missing probables (null)", async () => {
  global.fetch = async () => ({
    ok: true,
    json: async () => ({
      dates: [{ games: [{
        gamePk: 2, gameDate: "2026-06-02T20:00:00Z",
        teams: { away: { team: { id: 114 } }, home: { team: { id: 142 } } },
        status: { detailedState: "Scheduled", abstractGameState: "Preview" }
      }] }]
    })
  });
  const out = await fetchSchedule("2026-06-02", "2026-06-09");
  assert.equal(out[0].awayProbable, null);
  assert.equal(out[0].homeProbable, null);
});

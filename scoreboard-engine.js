// scoreboard-engine.js  (live scores)
// Pure classification + state-description for today's games. No DOM, no HTTP.
// Consumes the normalized scoreboard entries produced by data-client.fetchScoreboard
// and decides, for each game, whether it's live / final / scheduled / warmup / other,
// plus the human badge text for live and final games.
//
// Public API:
//   classifyGame(entry)  -> "live" | "final" | "scheduled" | "warmup" | "other"
//   describeState(entry) -> string label, or "" for scheduled (caller shows start time)
//   summarize(entries)   -> { games: entry[] (with .cls), liveCount, finalCount, total }
//
// Entry shape (from data-client.fetchScoreboard):
//   { gameId, gameDate, away:{teamId,abbr,score}, home:{teamId,abbr,score},
//     detailedState, abstractState, inning, inningState, outs }

export function classifyGame(g) {
  const abstract = String(g?.abstractState || "").toLowerCase();
  if (abstract === "live") return "live";
  if (abstract === "final") return "final";

  const detailed = String(g?.detailedState || "").toLowerCase();
  if (detailed.includes("warmup")) return "warmup";
  if (
    detailed.includes("delayed") ||
    detailed.includes("postponed") ||
    detailed.includes("suspended") ||
    detailed.includes("cancel")
  ) {
    return "other";
  }
  return "scheduled";
}

function shortInning(state) {
  switch (String(state || "")) {
    case "Top": return "Top";
    case "Bottom": return "Bot";
    case "Middle": return "Mid";
    case "End": return "End";
    default: return "";
  }
}

// Human badge text. Returns "" for scheduled games so the renderer can show the
// locale-formatted start time (a DOM/locale concern, kept out of the pure engine).
export function describeState(g) {
  const cls = classifyGame(g);
  if (cls === "live") {
    const half = shortInning(g.inningState);
    const inn = g.inning ? `${half ? half + " " : ""}${g.inning}` : "Live";
    const inPlay = g.inningState === "Top" || g.inningState === "Bottom";
    const outs = inPlay && g.outs != null ? ` · ${g.outs} out${g.outs === 1 ? "" : "s"}` : "";
    return `${inn}${outs}`.trim();
  }
  if (cls === "final") {
    // Note extra innings (e.g. "Final/10").
    return g.inning && Number(g.inning) !== 9 ? `Final/${g.inning}` : "Final";
  }
  if (cls === "warmup") return "Warmup";
  if (cls === "other") return g.detailedState || "TBD";
  return ""; // scheduled — caller renders the start time
}

// True when the away team is currently (or finally) ahead — used to bold the
// leading score. Null when tied or scores are absent.
export function leader(g) {
  const a = Number(g?.away?.score);
  const h = Number(g?.home?.score);
  if (!Number.isFinite(a) || !Number.isFinite(h) || a === h) return null;
  return a > h ? "away" : "home";
}

export function summarize(entries) {
  const games = (Array.isArray(entries) ? entries : []).map((g) => ({ ...g, cls: classifyGame(g) }));
  return {
    games,
    liveCount: games.filter((g) => g.cls === "live").length,
    finalCount: games.filter((g) => g.cls === "final").length,
    total: games.length
  };
}

// Display order: live first, then warmup, then scheduled (by start time), then
// final, then other. Stable within a bucket by start time then gameId.
const ORDER = { live: 0, warmup: 1, scheduled: 2, final: 3, other: 4 };
export function sortForDisplay(entries) {
  return (Array.isArray(entries) ? entries.slice() : []).sort((a, b) => {
    const ca = ORDER[classifyGame(a)] ?? 9;
    const cb = ORDER[classifyGame(b)] ?? 9;
    if (ca !== cb) return ca - cb;
    const ta = String(a.gameDate || "");
    const tb = String(b.gameDate || "");
    if (ta !== tb) return ta < tb ? -1 : 1;
    return (a.gameId || 0) - (b.gameId || 0);
  });
}

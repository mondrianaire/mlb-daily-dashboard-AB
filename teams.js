// teams.js
// Hardcoded fallback map of the 30 MLB teams keyed by MLB Stats API teamId.
// The MLB Stats API does NOT expose primary brand colors, so a small static
// map carries the canonical primary color + 3-letter abbreviation + division
// for each team. Division assignments are mirrored from the standings response
// at runtime; the values here are seed defaults that match the 2026 alignment.
//
// Colors are the canonical primary brand color for each franchise per public
// brand-color references, cross-checked rev-2 against the MLB CDN logo SVGs
// at https://www.mlbstatic.com/team-logos/{id}.svg. Where the logo's
// pixel-extracted fill diverged from the prior teams.js value, the logo wins
// (it is what the user actually sees on the site).

export const TEAM_META = {
  108: { abbr: "LAA", name: "Los Angeles Angels",       league: "AL", division: "West",    primaryColor: "#BA0021", secondaryColor: "#003263" },
  109: { abbr: "ARI", name: "Arizona Diamondbacks",     league: "NL", division: "West",    primaryColor: "#AA182C", secondaryColor: "#3EC1CC" }, // source: rev-2 logo extract (id 109) — Sedona Red AA182C + Sonoran Teal 3EC1CC
  110: { abbr: "BAL", name: "Baltimore Orioles",        league: "AL", division: "East",    primaryColor: "#DF4601", secondaryColor: "#000000" },
  111: { abbr: "BOS", name: "Boston Red Sox",           league: "AL", division: "East",    primaryColor: "#BD3039", secondaryColor: "#0D2B56" }, // source: rev-2 logo extract (id 111) — cap navy 0D2B56
  112: { abbr: "CHC", name: "Chicago Cubs",             league: "NL", division: "Central", primaryColor: "#0E3386", secondaryColor: "#CC3433" },
  113: { abbr: "CIN", name: "Cincinnati Reds",          league: "NL", division: "Central", primaryColor: "#C6011F", secondaryColor: "#000000" },
  114: { abbr: "CLE", name: "Cleveland Guardians",      league: "AL", division: "Central", primaryColor: "#00385D", secondaryColor: "#E31937" }, // source: rev-2 logo extract (id 114) — red E31937
  115: { abbr: "COL", name: "Colorado Rockies",         league: "NL", division: "West",    primaryColor: "#333366", secondaryColor: "#C4CED4" },
  116: { abbr: "DET", name: "Detroit Tigers",           league: "AL", division: "Central", primaryColor: "#0C2C56", secondaryColor: "#FA4616" }, // source: rev-2 logo extract (id 116) — true Tigers navy 0C2C56
  117: { abbr: "HOU", name: "Houston Astros",           league: "AL", division: "West",    primaryColor: "#002D62", secondaryColor: "#EB6E1F" },
  118: { abbr: "KC",  name: "Kansas City Royals",       league: "AL", division: "Central", primaryColor: "#004687", secondaryColor: "#BD9B60" },
  119: { abbr: "LAD", name: "Los Angeles Dodgers",      league: "NL", division: "West",    primaryColor: "#005A9C", secondaryColor: "#EF3E42" },
  120: { abbr: "WSH", name: "Washington Nationals",     league: "NL", division: "East",    primaryColor: "#AB0003", secondaryColor: "#14225A" },
  121: { abbr: "NYM", name: "New York Mets",            league: "NL", division: "East",    primaryColor: "#002D72", secondaryColor: "#FF5910" },
  133: { abbr: "ATH", name: "Athletics",                league: "AL", division: "West",    primaryColor: "#003831", secondaryColor: "#EFB21E" },
  134: { abbr: "PIT", name: "Pittsburgh Pirates",       league: "NL", division: "Central", primaryColor: "#FDB827", secondaryColor: "#27251F" },
  135: { abbr: "SD",  name: "San Diego Padres",         league: "NL", division: "West",    primaryColor: "#2F241D", secondaryColor: "#FFC425" },
  136: { abbr: "SEA", name: "Seattle Mariners",         league: "AL", division: "West",    primaryColor: "#0C2C56", secondaryColor: "#005C5C" },
  137: { abbr: "SF",  name: "San Francisco Giants",     league: "NL", division: "West",    primaryColor: "#FD5A1E", secondaryColor: "#27251F" },
  138: { abbr: "STL", name: "St. Louis Cardinals",      league: "NL", division: "Central", primaryColor: "#C41E3A", secondaryColor: "#0C2340" },
  139: { abbr: "TB",  name: "Tampa Bay Rays",           league: "AL", division: "East",    primaryColor: "#092C5C", secondaryColor: "#8FBCE6" },
  140: { abbr: "TEX", name: "Texas Rangers",            league: "AL", division: "West",    primaryColor: "#003278", secondaryColor: "#C0111F" },
  141: { abbr: "TOR", name: "Toronto Blue Jays",        league: "AL", division: "East",    primaryColor: "#134A8E", secondaryColor: "#1D2D5C" },
  142: { abbr: "MIN", name: "Minnesota Twins",          league: "AL", division: "Central", primaryColor: "#002B5C", secondaryColor: "#D31145" },
  143: { abbr: "PHI", name: "Philadelphia Phillies",    league: "NL", division: "East",    primaryColor: "#E81828", secondaryColor: "#002D72" },
  144: { abbr: "ATL", name: "Atlanta Braves",           league: "NL", division: "East",    primaryColor: "#CE1141", secondaryColor: "#13274F" },
  145: { abbr: "CWS", name: "Chicago White Sox",        league: "AL", division: "Central", primaryColor: "#27251F", secondaryColor: "#C4CED4" },
  146: { abbr: "MIA", name: "Miami Marlins",            league: "NL", division: "East",    primaryColor: "#00A3E0", secondaryColor: "#EF3340" },
  147: { abbr: "NYY", name: "New York Yankees",         league: "AL", division: "East",    primaryColor: "#132448", secondaryColor: "#C4CED4" }, // source: rev-2 logo extract (id 147) — true Yankees navy 132448
  158: { abbr: "MIL", name: "Milwaukee Brewers",        league: "NL", division: "Central", primaryColor: "#12284B", secondaryColor: "#FFC52F" }
};

// Convenience: lookup helper that tolerates either a numeric id or string id.
export function teamMeta(teamId) {
  const key = typeof teamId === "string" ? Number(teamId) : teamId;
  return TEAM_META[key] || null;
}

// All 30 team ids — used by ui-render to ensure 30 teams render even if
// standings come back partial or out-of-order.
export const ALL_TEAM_IDS = Object.keys(TEAM_META).map(Number);

// ----------------------------------------------------------------
// Logo URL helper (rev-2)
// ----------------------------------------------------------------
// Returns the MLB CDN URL for a team's SVG logo.
//   variant "cap"     -> small square cap-on-light SVG (best for inline UI bits)
//   variant "primary" -> full primary SVG (best for KPI hero / point markers)
// CORS: Allow-Origin: * (verified rev-2). Cache-Control: 14-day TTL.
const LOGO_BASE = "https://www.mlbstatic.com/team-logos";
export function getLogoUrl(teamId, variant = "cap") {
  const id = typeof teamId === "string" ? Number(teamId) : teamId;
  if (!Number.isFinite(id)) return "";
  return variant === "primary"
    ? `${LOGO_BASE}/${id}.svg`
    : `${LOGO_BASE}/team-cap-on-light/${id}.svg`;
}

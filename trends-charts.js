// trends-charts.js
// Renders the 7 trend widgets in the Trends tab using LIVE data fetched
// via data-client.js + stats-client.js. Chart.js is expected to be loaded
// onto window.Chart by the caller (app.js lazy-loads it).
//
// Public API:
//   initTrendsView({ teams, standings, hitting, pitching, recentGames })
//
// Internally builds a per-team merged record matching the shape the
// standalone mlb-trends-dashboard.html used (so the widget code is a
// near-verbatim lift).

import { teamMeta, TEAM_META } from "./teams.js";

// MLB Stats API division.id → "AL East" / "NL Central" / ...
const DIVISION_BY_ID = {
  201: { league: "AL", div: "AL East" },
  202: { league: "AL", div: "AL Central" },
  200: { league: "AL", div: "AL West" },
  204: { league: "NL", div: "NL East" },
  205: { league: "NL", div: "NL Central" },
  203: { league: "NL", div: "NL West" }
};

// Fallback divisions from teams.js for teams whose standings entry lacks
// a divisionId (defensive — shouldn't happen against live API).
function teamDivision(teamId) {
  const m = teamMeta(teamId);
  if (!m) return { league: "AL", div: "AL East" };
  const div = m.division; // "East" | "Central" | "West"
  return { league: m.league, div: `${m.league} ${div}` };
}

// ============================================================
//                    PUBLIC ENTRY POINT
// ============================================================
let MLB_DATA = null;
let currentFilter = "all";
const charts = {};
let initialized = false;

export function initTrendsView({ teams, standings, hitting, pitching, recentGames }) {
  MLB_DATA = buildMergedData({ teams, standings, hitting, pitching, recentGames });
  wireFilterChips();
  renderAll();
  initialized = true;
}

export function isTrendsInitialized() {
  return initialized;
}

// ============================================================
//                    DATA MERGE
// ============================================================
function buildMergedData({ teams, standings, hitting, pitching, recentGames }) {
  // Build standings lookup by teamId.
  const standingsById = new Map();
  for (const s of standings || []) standingsById.set(s.teamId, s);

  // Merge per-team rows.
  const merged = [];
  for (const t of teams) {
    const id = t.id;
    const s = standingsById.get(id) || {};
    const h = (hitting && hitting.get && hitting.get(id)) || {};
    const p = (pitching && pitching.get && pitching.get(id)) || {};
    const meta = teamMeta(id) || {};

    const w = Number(s.wins ?? 0);
    const l = Number(s.losses ?? 0);
    const pct = (w + l) > 0 ? +(w / (w + l)).toFixed(3) : 0;

    // Pull division from standings entry first (live, authoritative).
    // standings entry has league + division as ("AL", "East") strings.
    let league = s.league || meta.league || "AL";
    let div = s.division
      ? `${league} ${s.division}`
      : `${league} ${meta.division || "East"}`;

    // Recent 14-day games for this team. Window comes from recentGames.dates.
    const games = (recentGames.byTeam.get(id) || []);
    const wlPattern = {};
    let last10W = 0, last10L = 0;
    let homeW = 0, homeL = 0, awayW = 0, awayL = 0;
    for (const g of games) {
      wlPattern[g.date] = g.isWin ? "W" : "L";
      if (g.isHome) { if (g.isWin) homeW++; else homeL++; }
      else          { if (g.isWin) awayW++; else awayL++; }
    }
    // last-10 = last 10 chronological games in this window (best signal we
    // can reconstruct from the schedule call without a separate fetch).
    const last10 = games.slice(-10);
    for (const g of last10) { if (g.isWin) last10W++; else last10L++; }

    // Run differential — prefer authoritative standings totals when available.
    const rs = Number(s.runsScored ?? h.runsScored ?? 0);
    const ra = Number(s.runsAllowed ?? p.runsAllowed ?? 0);
    const diff = rs - ra;

    // gb as printable string (matches standalone)
    const gb = s.gb === "-" || s.gb == null
      ? "-"
      : (typeof s.gb === "number" ? s.gb.toFixed(1) : String(s.gb));

    merged.push({
      id,
      name: meta.name?.split(" ").slice(-1)[0] || t.teamName || meta.name || `Team ${id}`,
      abbr: meta.abbr || t.abbreviation || "—",
      color: meta.primaryColor || "#888",
      color2: meta.secondaryColor || "#444",
      league,
      div,
      w, l, pct, gb,
      rs, ra, diff,
      streak: s.streak || "—",
      last10W, last10L,
      homeW, homeL, awayW, awayL,
      avg: h.avg ?? 0,
      obp: h.obp ?? 0,
      slg: h.slg ?? 0,
      ops: h.ops ?? 0,
      hr: h.hr ?? 0,
      bb: h.bb ?? 0,
      k: h.k ?? 0,
      sb: h.sb ?? 0,
      era: p.era ?? 0,
      whip: p.whip ?? 0,
      kp9: p.kp9 ?? 0,
      bbp9: p.bbp9 ?? 0,
      hrp9: p.hrp9 ?? 0,
      saves: p.saves ?? 0,
      wlPattern
    });
  }

  return {
    asOf: new Date().toISOString().slice(0, 10),
    teams: merged,
    dates14d: recentGames.dates || []
  };
}

// ============================================================
//                    FILTERING
// ============================================================
function filterTeams() {
  if (currentFilter === "all") return MLB_DATA.teams;
  if (currentFilter === "AL" || currentFilter === "NL") {
    return MLB_DATA.teams.filter((t) => t.league === currentFilter);
  }
  return MLB_DATA.teams.filter((t) => t.div === currentFilter);
}

function wireFilterChips() {
  const chips = document.querySelectorAll("#trends-filterbar .trends-chip[data-filter]");
  chips.forEach((chip) => {
    chip.addEventListener("click", () => {
      chips.forEach((c) => c.classList.remove("on"));
      chip.classList.add("on");
      currentFilter = chip.dataset.filter;
      renderAll();
    });
  });
}

// ============================================================
//                    KPI STRIP
// ============================================================
function renderKpis() {
  const teams = filterTeams();
  if (teams.length === 0) {
    document.getElementById("kpis").innerHTML = "";
    return;
  }
  const bestDiff = [...teams].sort((a, b) => b.diff - a.diff)[0];
  const worstDiff = [...teams].sort((a, b) => a.diff - b.diff)[0];
  const bestEra = [...teams].filter((t) => t.era > 0).sort((a, b) => a.era - b.era)[0] || bestDiff;
  const bestOps = [...teams].sort((a, b) => b.ops - a.ops)[0];
  const bestPct = [...teams].sort((a, b) => b.pct - a.pct)[0];
  const kpis = [
    { label: "Best Record", val: `${bestPct.abbr} ${bestPct.w}-${bestPct.l}`, meta: `.${(bestPct.pct * 1000).toFixed(0)} win pct` },
    { label: "Top Run Diff", val: `${bestDiff.abbr} ${bestDiff.diff >= 0 ? "+" : ""}${bestDiff.diff}`, meta: `${bestDiff.rs} RS / ${bestDiff.ra} RA` },
    { label: "Worst Run Diff", val: `${worstDiff.abbr} ${worstDiff.diff}`, meta: `${worstDiff.rs} RS / ${worstDiff.ra} RA` },
    { label: "Best ERA", val: `${bestEra.abbr} ${bestEra.era.toFixed(2)}`, meta: `WHIP ${bestEra.whip.toFixed(2)}` },
    { label: "Top OPS", val: `${bestOps.abbr} ${bestOps.ops.toFixed(3)}`, meta: `${bestOps.hr} HR` }
  ];
  const html = kpis.map((k) => `
    <div class="trends-kpi">
      <div class="label">${k.label}</div>
      <div class="val">${k.val}</div>
      <div class="meta">${k.meta}</div>
    </div>
  `).join("");
  document.getElementById("kpis").innerHTML = html;
}

// ============================================================
//                    STANDINGS TABLE
// ============================================================
let sortKey = "pct";
let sortAsc = false;
const COLS = [
  { key: "team",   label: "Team",     numeric: false, get: (t) => t },
  { key: "w",      label: "W",        numeric: true,  get: (t) => t.w },
  { key: "l",      label: "L",        numeric: true,  get: (t) => t.l },
  { key: "pct",    label: "PCT",      numeric: true,  get: (t) => t.pct, fmt: (v) => "." + (v * 1000).toFixed(0) },
  { key: "gb",     label: "GB",       numeric: true,  get: (t) => t.gb === "-" ? 0 : parseFloat(t.gb), fmt: (v, t) => t.gb },
  { key: "diff",   label: "Diff",     numeric: true,  get: (t) => t.diff, fmt: (v) => v >= 0 ? `+${v}` : `${v}`, classify: (v) => v > 0 ? "pos" : v < 0 ? "neg" : "" },
  { key: "rs",     label: "RS",       numeric: true,  get: (t) => t.rs },
  { key: "ra",     label: "RA",       numeric: true,  get: (t) => t.ra },
  { key: "streak", label: "Streak",   numeric: true,  get: (t) => t.streak, fmt: (v) => v, classify: (v) => v && String(v).startsWith("W") ? "streak-w" : v && String(v).startsWith("L") ? "streak-l" : "" },
  { key: "last10", label: "Last 10",  numeric: true,  get: (t) => (t.last10W ?? 0) - (t.last10L ?? 0), fmt: (v, t) => `${t.last10W ?? "-"}-${t.last10L ?? "-"}` },
  { key: "ops",    label: "OPS",      numeric: true,  get: (t) => t.ops, fmt: (v) => v.toFixed(3).replace(/^0/, "") },
  { key: "era",    label: "ERA",      numeric: true,  get: (t) => t.era, fmt: (v) => v.toFixed(2) }
];

function renderStandings() {
  const teams = filterTeams();
  const sorted = [...teams].sort((a, b) => {
    const col = COLS.find((c) => c.key === sortKey);
    const va = col.get(a);
    const vb = col.get(b);
    if (sortKey === "team") return (sortAsc ? 1 : -1) * a.name.localeCompare(b.name);
    return (sortAsc ? 1 : -1) * (va > vb ? 1 : va < vb ? -1 : 0);
  });

  const head = `<thead><tr>${COLS.map((c) => {
    const cls = (c.numeric ? "numeric " : "") + (sortKey === c.key ? "sorted " + (sortAsc ? "asc" : "") : "");
    return `<th class="${cls.trim()}" data-key="${c.key}">${c.label}</th>`;
  }).join("")}</tr></thead>`;

  const rows = sorted.map((t) => {
    const cells = COLS.map((c) => {
      if (c.key === "team") {
        return `<td class="team-cell-wrap"><div class="trends-team-cell"><div class="trends-swatch" style="background:${t.color}"></div><span class="trends-abbr">${t.abbr}</span><span class="trends-name">${t.name}</span></div></td>`;
      }
      const v = c.get(t);
      const cls = (c.numeric ? "numeric " : "") + (c.classify ? c.classify(t[c.key] ?? v, t) : "");
      const display = c.fmt ? c.fmt(v, t) : v;
      return `<td class="${cls.trim()}">${display}</td>`;
    }).join("");
    return `<tr>${cells}</tr>`;
  }).join("");

  document.getElementById("standings-table").innerHTML = head + "<tbody>" + rows + "</tbody>";

  document.querySelectorAll("#standings-table thead th").forEach((th) => {
    th.addEventListener("click", () => {
      const k = th.dataset.key;
      if (sortKey === k) sortAsc = !sortAsc;
      else { sortKey = k; sortAsc = false; }
      renderStandings();
    });
  });
}

// ============================================================
//                    LAST 10 LEADERBOARD
// ============================================================
function renderLast10() {
  const teams = filterTeams().filter((t) => t.last10W != null);
  const sorted = [...teams].sort((a, b) => b.last10W - a.last10W || a.last10L - b.last10L);
  const max = 10;
  const html = sorted.map((t, i) => {
    const pct = (t.last10W / max) * 100;
    return `
      <div class="trends-lb-row">
        <div class="trends-lb-rank">${i + 1}.</div>
        <div class="trends-lb-abbr" style="color:${t.color}">${t.abbr}</div>
        <div class="trends-lb-bar"><div class="trends-lb-bar-fill" style="width:${pct}%;background:${t.color}"></div></div>
        <div class="trends-lb-val">${t.last10W}-${t.last10L} <span style="color:var(--trends-text-3)">(${t.streak})</span></div>
      </div>`;
  }).join("");
  document.getElementById("last10-board").innerHTML = html;
}

// ============================================================
//                    CHART HELPERS
// ============================================================
const chartFont = { family: "-apple-system, BlinkMacSystemFont, Inter, sans-serif", size: 11 };
const chartColors = { grid: "#1f2a44", text: "#93a4c1", label: "#e6edf7" };

function configureChartDefaults() {
  if (typeof window === "undefined" || !window.Chart) return;
  window.Chart.defaults.color = chartColors.text;
  window.Chart.defaults.font = chartFont;
  window.Chart.defaults.plugins.legend.display = false;
}

function destroyChart(id) {
  if (charts[id]) { charts[id].destroy(); delete charts[id]; }
}

// ============================================================
//                    RS vs RA SCATTER
// ============================================================
function renderRSRA() {
  destroyChart("rsra");
  const teams = filterTeams();
  if (teams.length === 0) return;
  const max = Math.max(...teams.map((t) => Math.max(t.rs, t.ra))) + 10;
  const min = Math.min(...teams.map((t) => Math.min(t.rs, t.ra))) - 10;
  const datasets = teams.map((t) => ({
    label: t.abbr,
    data: [{ x: t.ra, y: t.rs, r: Math.max(6, t.w * 0.35) }],
    backgroundColor: t.color + "cc",
    borderColor: t.color,
    borderWidth: 1.5
  }));
  datasets.push({
    type: "line", label: "Even",
    data: [{ x: min, y: min }, { x: max, y: max }],
    borderColor: "#3a4a6e", borderWidth: 1, borderDash: [4, 4], pointRadius: 0, fill: false
  });
  charts.rsra = new window.Chart(document.getElementById("rsra-chart"), {
    type: "bubble",
    data: { datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: {
        x: { title: { display: true, text: "Runs Allowed", color: chartColors.label }, grid: { color: chartColors.grid }, min, max },
        y: { title: { display: true, text: "Runs Scored", color: chartColors.label }, grid: { color: chartColors.grid }, min, max }
      },
      plugins: {
        tooltip: { callbacks: { label: (ctx) => {
          const t = teams[ctx.datasetIndex]; if (!t) return "";
          return `${t.abbr} - ${t.w}-${t.l} - ${t.rs} RS / ${t.ra} RA (diff ${t.diff >= 0 ? "+" : ""}${t.diff})`;
        }}}
      }
    },
    plugins: [{
      id: "labels",
      afterDatasetsDraw(chart) {
        const ctx = chart.ctx;
        ctx.save();
        ctx.font = "700 10px " + chartFont.family;
        teams.forEach((t, i) => {
          const ds = chart.getDatasetMeta(i);
          if (!ds || !ds.data[0]) return;
          const p = ds.data[0];
          ctx.fillStyle = "#e6edf7";
          ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.fillText(t.abbr, p.x, p.y);
        });
        ctx.restore();
      }
    }]
  });
}

// ============================================================
//                    OPS vs ERA SCATTER
// ============================================================
function renderOpsEra() {
  destroyChart("opsera");
  const teams = filterTeams();
  if (teams.length === 0) return;
  const datasets = teams.map((t) => ({
    label: t.abbr,
    data: [{ x: t.era, y: t.ops, r: 7 }],
    backgroundColor: t.color + "cc",
    borderColor: t.color,
    borderWidth: 1.5
  }));
  charts.opsera = new window.Chart(document.getElementById("ops-era-chart"), {
    type: "bubble",
    data: { datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: {
        x: { reverse: true, title: { display: true, text: "ERA (lower is better →)", color: chartColors.label }, grid: { color: chartColors.grid } },
        y: { title: { display: true, text: "OPS (higher is better ↑)", color: chartColors.label }, grid: { color: chartColors.grid } }
      },
      plugins: { tooltip: { callbacks: { label: (ctx) => {
        const t = teams[ctx.datasetIndex]; if (!t) return "";
        return `${t.abbr} - OPS ${t.ops.toFixed(3)} - ERA ${t.era.toFixed(2)}`;
      }}}}
    },
    plugins: [{
      id: "labels",
      afterDatasetsDraw(chart) {
        const ctx = chart.ctx; ctx.save(); ctx.font = "700 10px " + chartFont.family;
        teams.forEach((t, i) => {
          const ds = chart.getDatasetMeta(i); if (!ds || !ds.data[0]) return;
          const p = ds.data[0];
          ctx.fillStyle = "#e6edf7";
          ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.fillText(t.abbr, p.x, p.y);
        });
        ctx.restore();
      }
    }]
  });
}

// ============================================================
//                    HOME vs ROAD BAR
// ============================================================
function renderHomeRoad() {
  destroyChart("homeroad");
  const teams = [...filterTeams()].sort((a, b) => (b.homeW + b.awayW) - (a.homeW + a.awayW));
  if (teams.length === 0) return;
  const labels = teams.map((t) => t.abbr);
  const homeData = teams.map((t) => t.homeW ?? 0);
  const roadData = teams.map((t) => t.awayW ?? 0);
  charts.homeroad = new window.Chart(document.getElementById("home-road-chart"), {
    type: "bar",
    data: {
      labels,
      datasets: [
        { label: "Home wins", data: homeData, backgroundColor: "#4f9cf9" },
        { label: "Road wins", data: roadData, backgroundColor: "#f1c40f" }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: {
        x: { grid: { display: false }, ticks: { autoSkip: false, font: { size: 10 } } },
        y: { stacked: true, grid: { color: chartColors.grid }, title: { display: true, text: "Wins (14-day window)", color: chartColors.label } }
      },
      plugins: { legend: { display: true, position: "top", labels: { color: chartColors.text, boxWidth: 12, font: { size: 11 } } } }
    }
  });
}

// ============================================================
//                    POWER vs DISCIPLINE SCATTER
// ============================================================
function renderPowerDisc() {
  destroyChart("powerdisc");
  const teams = filterTeams();
  if (teams.length === 0) return;
  const datasets = teams.map((t) => ({
    label: t.abbr,
    data: [{ x: t.kp9 / Math.max(t.bbp9, 0.1), y: t.hr, r: 7 }],
    backgroundColor: t.color + "cc",
    borderColor: t.color, borderWidth: 1.5
  }));
  charts.powerdisc = new window.Chart(document.getElementById("power-disc-chart"), {
    type: "bubble",
    data: { datasets },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: {
        x: { title: { display: true, text: "Staff K/BB ratio (higher = better command)", color: chartColors.label }, grid: { color: chartColors.grid } },
        y: { title: { display: true, text: "Team HR", color: chartColors.label }, grid: { color: chartColors.grid } }
      },
      plugins: { tooltip: { callbacks: { label: (ctx) => {
        const t = teams[ctx.datasetIndex]; if (!t) return "";
        return `${t.abbr} - ${t.hr} HR - K/BB ${(t.kp9 / Math.max(t.bbp9, 0.1)).toFixed(2)}`;
      }}}}
    },
    plugins: [{
      id: "labels",
      afterDatasetsDraw(chart) {
        const ctx = chart.ctx; ctx.save(); ctx.font = "700 10px " + chartFont.family;
        teams.forEach((t, i) => {
          const ds = chart.getDatasetMeta(i); if (!ds || !ds.data[0]) return;
          const p = ds.data[0];
          ctx.fillStyle = "#e6edf7"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
          ctx.fillText(t.abbr, p.x, p.y);
        });
        ctx.restore();
      }
    }]
  });
}

// ============================================================
//                    14-DAY HEATMAP
// ============================================================
function renderHeatmap() {
  const teams = [...filterTeams()].sort((a, b) => b.pct - a.pct);
  const dates = MLB_DATA.dates14d || [];
  const dateHeaders = dates.map((d) => {
    const dt = new Date(d + "T00:00:00Z");
    return `<th title="${d}">${dt.getUTCMonth() + 1}/${dt.getUTCDate()}</th>`;
  }).join("");
  const rows = teams.map((t) => {
    const cells = dates.map((d) => {
      const v = t.wlPattern && t.wlPattern[d];
      const cls = v === "W" ? "W" : v === "L" ? "L" : "off";
      const label = v === "W" ? "W" : v === "L" ? "L" : "·";
      return `<td><div class="trends-heatmap-cell ${cls}" title="${t.abbr} ${d}: ${v || "off day"}">${label}</div></td>`;
    }).join("");
    const w = Object.values(t.wlPattern || {}).filter((v) => v === "W").length;
    const l = Object.values(t.wlPattern || {}).filter((v) => v === "L").length;
    return `<tr>
      <td class="team">
        <div class="trends-heatmap-team-cell">
          <div class="trends-swatch" style="background:${t.color}"></div>
          <span class="trends-abbr">${t.abbr}</span>
        </div>
      </td>
      ${cells}
      <td style="padding-left:8px;font-size:11px;color:var(--trends-text-2);font-variant-numeric:tabular-nums;">${w}-${l}</td>
    </tr>`;
  }).join("");
  const head = `<thead><tr><th class="team">Team</th>${dateHeaders}<th>14d</th></tr></thead>`;
  document.getElementById("heatmap-body").innerHTML = `<table class="trends-heatmap-table">${head}<tbody>${rows}</tbody></table>`;
}

// ============================================================
//                    RENDER ALL
// ============================================================
function renderAll() {
  configureChartDefaults();
  renderKpis();
  renderStandings();
  renderLast10();
  renderRSRA();
  renderOpsEra();
  renderHomeRoad();
  renderPowerDisc();
  renderHeatmap();
}

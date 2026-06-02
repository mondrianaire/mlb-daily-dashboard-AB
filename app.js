// app.js  (ui-render)
// Glue module: bootstraps the dashboard. Imports data-client + engines and
// writes view-models into the ui-shell DOM containers. Owns loading, error,
// and empty states. The only module that touches the DOM.

import {
  fetchTeams,
  fetchStandings,
  fetchSchedule,
  fetchRecentResults,
  DataClientError,
  DateUtil
} from "./data-client.js";
import {
  fetchTeamHittingStats,
  fetchTeamPitchingStats,
  fetchCompletedGames14d,
  StatsClientError
} from "./stats-client.js";
import { computeWeeklyTrends } from "./trends-engine.js";
import { computeRankings } from "./rankings-engine.js";
import { computeWatchability } from "./watchability-engine.js";
import { computeBriefing } from "./briefing-engine.js";
import { maybeEnhanceBriefing } from "./briefing-llm.js";
import { computePulse } from "./pulse-engine.js";
import { TEAM_META, ALL_TEAM_IDS, teamMeta, getLogoUrl } from "./teams.js";
import { preloadLogos, logoImgHtml } from "./logo-helpers.js";

// ----- Required DOM IDs (per ui-shell--ui-render contract) -----
const ID = {
  rankings: "rankings-panel",
  trends: "trends-panel",
  upcoming: "upcoming-panel",
  briefing: "briefing",
  pulse: "trend-pulse",
  lastUpdated: "last-updated",
  errorBanner: "error-banner",
  errorRetry: "error-banner-retry"
};

// Daily-tab fetch cache: reused by the Trends tab so it doesn't refetch teams/standings.
let dailyFetchCache = null;

// Trends-tab lazy-load state.
const TRENDS = {
  loaded: false,
  loading: null,            // Promise<void> in flight
  chartJsLoaded: false,
  chartJsLoading: null      // Promise<void> in flight
};

const DIVISION_LABELS = {
  AL_East: "AL East",
  AL_Central: "AL Central",
  AL_West: "AL West",
  NL_East: "NL East",
  NL_Central: "NL Central",
  NL_West: "NL West"
};

// ============================================================
//                       PUBLIC API
// ============================================================
export async function init() {
  hideError();
  setPanelLoading(ID.rankings, "Loading standings…");
  setPanelLoading(ID.trends, "Loading trends…");
  setPanelLoading(ID.upcoming, "Loading schedule…");

  const today = DateUtil.todayISO();
  const weekAhead = DateUtil.daysAheadISO(7);

  try {
    const [teams, standings, schedule, recentResults] = await Promise.all([
      fetchTeams(),
      fetchStandings(),
      fetchSchedule(today, weekAhead),
      fetchRecentResults(7)
    ]);

    const rankings = computeRankings(standings);
    const trends = computeWeeklyTrends(recentResults);

    // Watchability ranking (OPP-001): score tonight's games from data we already
    // have in memory. Pure + deterministic; never throws fatally — guard anyway
    // so a ranking hiccup can't blank the schedule panel.
    let watch = null;
    try {
      watch = computeWatchability({ schedule, trends, rankings, today });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn("[MLB Daily Dashboard] watchability scoring skipped:", e);
    }

    // Daily briefing (OPP-002): deterministic plain-language highlights from the
    // same in-memory data. Guarded so a briefing hiccup can't blank the page.
    let briefing = null;
    try {
      briefing = computeBriefing({ rankings, trends, schedule, today });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn("[MLB Daily Dashboard] briefing skipped:", e);
    }

    // Cache the heavy responses so the Trends tab doesn't have to refetch.
    dailyFetchCache = { teams, standings, schedule, recentResults };

    // Fire-and-forget logo preload (rev-2) — keeps the MLB CDN responses in
    // the browser HTTP cache so Chart.js custom point markers and inline imgs
    // paint without a flash on first use. We don't await: rendering the Daily
    // tab is the critical path; logos load over the network in parallel and
    // the <img> tags below also work fine if the preload is still in flight.
    try {
      preloadLogos(ALL_TEAM_IDS, "cap");
      preloadLogos(ALL_TEAM_IDS, "primary");
    } catch (_) { /* logos are decorative; never block on them */ }

    renderBriefing(briefing);
    renderPulse(computePulse(trends), teams);
    // Optional LLM phrasing (Phase 4): default-OFF. If an endpoint is configured,
    // this fire-and-forget call rephrases the highlights in place; on anything
    // less than success the deterministic briefing above simply stands.
    if (briefing?.highlights?.length) {
      maybeEnhanceBriefing(
        briefing.highlights,
        (enhanced) => renderBriefing({ highlights: enhanced })
      );
    }
    // Team W–L lookup for the featured matchup card.
    const teamRecords = new Map(
      (standings || []).map((s) => [s.teamId, `${s.wins}-${s.losses}`])
    );

    renderRankings(rankings, teams);
    renderTrends(trends, teams);
    renderUpcoming(schedule, watch, teamRecords);
    updateTimestamp(new Date());
  } catch (err) {
    const msg = err instanceof DataClientError
      ? `Unable to load live MLB data: ${err.message}`
      : `Unexpected error: ${err?.message || String(err)}`;
    showError(msg);
    // Clear any remaining loading-state copy so the user does not see
    // the panels stuck in "Loading...".
    renderBriefing(null); // hide the briefing on a failed load
    renderPulse(null);    // hide the trend pulse too
    setPanelEmpty(ID.rankings, "Standings unavailable.");
    setPanelEmpty(ID.trends, "Trends unavailable.");
    setPanelEmpty(ID.upcoming, "Schedule unavailable.");
    // eslint-disable-next-line no-console
    console.error("[MLB Daily Dashboard] init failed:", err);
  }
}

// ============================================================
//                  RENDER FUNCTIONS
// ============================================================
function renderBriefing(briefing) {
  const section = document.getElementById(ID.briefing);
  if (!section) return;
  const body = section.querySelector(".briefing-body");
  if (!body) return;
  body.innerHTML = "";

  const highlights = briefing?.highlights || [];
  if (highlights.length === 0) {
    section.hidden = true; // nothing noteworthy (e.g. off-season) — stay quiet
    return;
  }

  // Dateline (human-readable, local).
  const dateEl = document.getElementById("briefing-dateline");
  if (dateEl) dateEl.textContent = formatDateline(new Date());

  // Lead story = the top-priority highlight, enlarged with a team-color rule.
  const [lead, ...rest] = highlights;
  const leadEl = document.createElement("div");
  leadEl.className = "briefing-lead";
  const leadColor = chipColor(lead.teamId);
  if (leadColor) leadEl.style.borderLeftColor = leadColor;

  const eyebrow = document.createElement("span");
  eyebrow.className = "briefing-lead-eyebrow";
  eyebrow.textContent = "Lead";
  const head = document.createElement("p");
  head.className = "briefing-lead-head";
  head.textContent = lead.text;
  leadEl.appendChild(eyebrow);
  leadEl.appendChild(head);
  body.appendChild(leadEl);

  // Rundown = the remaining highlights, each tagged with a team-color chip.
  if (rest.length) {
    const rundown = document.createElement("ul");
    rundown.className = "briefing-rundown";
    for (const h of rest) {
      const li = document.createElement("li");
      li.className = h.kind ? `briefing-rundown-item briefing-${h.kind}` : "briefing-rundown-item";
      const chip = document.createElement("span");
      chip.className = "briefing-chip";
      chip.style.background = chipColor(h.teamId) || "var(--fg-muted)";
      const txt = document.createElement("span");
      txt.className = "briefing-rundown-text";
      txt.textContent = h.text;
      li.appendChild(chip);
      li.appendChild(txt);
      rundown.appendChild(li);
    }
    body.appendChild(rundown);
  }

  section.hidden = false;
}

function chipColor(teamId) {
  if (teamId == null) return "";
  const meta = teamMeta(teamId);
  return meta?.primaryColor || "";
}

// Trend pulse (audit P3): the week's hottest + coldest club, visible on the
// Daily view in zero clicks. Reuses the sparkline renderer.
function renderPulse(pulse, teams) {
  const el = document.getElementById(ID.pulse);
  if (!el) return;
  el.innerHTML = "";
  const items = [];
  if (pulse?.hottest) items.push({ trend: pulse.hottest, kind: "rising" });
  if (pulse?.coldest) items.push({ trend: pulse.coldest, kind: "cooling" });
  if (items.length === 0) { el.hidden = true; return; }

  const teamById = new Map((teams || []).map((t) => [t.id, t]));
  for (const { trend, kind } of items) {
    el.appendChild(renderPulseCard(trend, kind, teamById));
  }
  el.hidden = false;
}

function renderPulseCard(trend, kind, teamById) {
  const info = teamById.get(trend.teamId) || teamMeta(trend.teamId) || {};
  const abbr = info.abbreviation || info.abbr || String(trend.teamId);
  const color = info.primaryColor || teamMeta(trend.teamId)?.primaryColor || "var(--accent)";

  const card = document.createElement("div");
  card.className = `pulse-card pulse-${kind}`;

  const label = document.createElement("span");
  label.className = "pulse-label";
  label.textContent = kind === "rising" ? "Rising · last 7" : "Cooling · last 7";

  const team = document.createElement("div");
  team.className = "pulse-team";
  team.innerHTML = logoImgHtml(trend.teamId, "cap", 22, "pulse-logo");
  const abbrEl = document.createElement("span");
  abbrEl.className = "pulse-abbr";
  abbrEl.style.color = "var(--fg)";
  abbrEl.textContent = abbr;
  team.appendChild(abbrEl);
  const rec = document.createElement("span");
  rec.className = "pulse-record";
  rec.textContent = `${trend.last7W}-${trend.last7L}`;
  team.appendChild(rec);

  const spark = renderSparkline(trend.sparklinePoints, color);
  spark.classList.add("pulse-spark");

  const rd = document.createElement("span");
  const v = trend.runDiff7;
  rd.className = `pulse-rundiff ${v > 0 ? "positive" : v < 0 ? "negative" : ""}`;
  rd.textContent = `${v > 0 ? "+" : ""}${v}`;

  card.appendChild(label);
  card.appendChild(team);
  card.appendChild(spark);
  card.appendChild(rd);
  return card;
}

function formatDateline(d) {
  const day = d.toLocaleDateString(undefined, { weekday: "short" });
  const mon = d.toLocaleDateString(undefined, { month: "short" });
  return `${day} · ${mon} ${d.getDate()} · around the league`;
}

function renderRankings(rankings, teams) {
  const teamById = new Map(teams.map((t) => [t.id, t]));
  const container = document.getElementById(ID.rankings);
  if (!container) return;
  const body = container.querySelector(".panel-body") || container;
  body.innerHTML = "";

  for (const key of [
    "AL_East", "AL_Central", "AL_West",
    "NL_East", "NL_Central", "NL_West"
  ]) {
    const division = rankings.divisionStandings[key] || [];
    body.appendChild(renderDivisionBlock(DIVISION_LABELS[key], division, teamById));
  }

  // Wild card race
  const wcBlock = document.createElement("div");
  wcBlock.className = "wildcard-block";
  for (const lg of ["AL", "NL"]) {
    const entries = rankings.wildCard[lg] || [];
    const title = `${lg} Wild Card`;
    wcBlock.appendChild(renderDivisionBlock(title, entries, teamById, /*compact*/ true));
  }
  body.appendChild(wcBlock);
}

function renderDivisionBlock(title, entries, teamById, compact = false) {
  const wrap = document.createElement("div");
  wrap.className = "division-block";

  const h = document.createElement("h3");
  h.className = "division-title";
  h.textContent = title;
  wrap.appendChild(h);

  if (entries.length === 0) {
    const empty = document.createElement("div");
    empty.className = "panel-empty-state";
    empty.textContent = "No standings data.";
    wrap.appendChild(empty);
    return wrap;
  }

  const table = document.createElement("table");
  table.className = "division-table";
  table.innerHTML = `
    <thead>
      <tr>
        <th>Team</th>
        <th>W</th>
        <th>L</th>
        <th>PCT</th>
        <th>GB</th>
        <th>Diff</th>
      </tr>
    </thead>
  `;
  const tbody = document.createElement("tbody");
  for (const t of entries) {
    const tr = document.createElement("tr");
    const teamInfo = teamById.get(t.teamId) || teamMeta(t.teamId);
    const abbr = teamInfo?.abbreviation || teamInfo?.abbr || t.teamAbbreviation || "—";
    const color = teamInfo?.primaryColor || `var(--team-${abbr})`;
    const logo = logoImgHtml(t.teamId, "cap", 24, "team-logo-sm");
    tr.innerHTML = `
      <td>
        <span class="team-cell" style="color: ${color}">
          ${logo}
          <span class="team-abbr" style="color: var(--fg)">${escapeHtml(abbr)}</span>
        </span>
      </td>
      <td class="numeric">${t.wins}</td>
      <td class="numeric">${t.losses}</td>
      <td class="numeric">${formatPct(t.pct)}</td>
      <td class="numeric">${formatGB(t.gb)}</td>
      <td class="numeric diff-cell">${runDiffCellHtml(t.runsScored, t.runsAllowed)}</td>
    `;
    tbody.appendChild(tr);
  }
  table.appendChild(tbody);
  wrap.appendChild(table);
  return wrap;
}

function renderTrends(trends, teams) {
  const teamById = new Map(teams.map((t) => [t.id, t]));
  const container = document.getElementById(ID.trends);
  if (!container) return;
  const body = container.querySelector(".panel-body") || container;
  body.innerHTML = "";

  if (!trends || trends.length === 0) {
    setPanelEmpty(ID.trends, "No trend data available.");
    return;
  }

  // Sort by run differential descending so the strongest weeks float to top.
  const sorted = trends.slice().sort((a, b) => b.runDiff7 - a.runDiff7);

  for (const trend of sorted) {
    const teamInfo = teamById.get(trend.teamId) || teamMeta(trend.teamId);
    const abbr = teamInfo?.abbreviation || teamInfo?.abbr || String(trend.teamId);
    const color = teamInfo?.primaryColor || `var(--team-${abbr})`;

    const row = document.createElement("div");
    row.className = "trend-row";

    const logo = document.createElement("img");
    logo.src = getLogoUrl(trend.teamId, "cap");
    logo.alt = "";
    logo.width = 20;
    logo.height = 20;
    logo.loading = "lazy";
    logo.decoding = "async";
    logo.className = "logo-img team-logo-xs";

    const abbrEl = document.createElement("span");
    abbrEl.className = "trend-abbr";
    abbrEl.textContent = abbr;

    const sparkSvg = renderSparkline(trend.sparklinePoints, color);

    const record = document.createElement("span");
    record.className = "trend-record";
    record.textContent = `${trend.last7W}-${trend.last7L}`;

    const rundiff = document.createElement("span");
    const rd = trend.runDiff7;
    rundiff.className = `trend-rundiff ${rd > 0 ? "positive" : rd < 0 ? "negative" : ""}`;
    rundiff.textContent = `${rd > 0 ? "+" : ""}${rd}`;

    row.appendChild(logo);
    row.appendChild(abbrEl);
    row.appendChild(sparkSvg);
    row.appendChild(record);
    row.appendChild(rundiff);
    // streak shown after row body in a sub-line if non-null
    if (trend.streak) {
      const streakEl = document.createElement("span");
      streakEl.className = `trend-streak streak-${trend.streak[0]}`;
      streakEl.textContent = trend.streak;
      streakEl.style.gridColumn = "5 / 6";
      row.appendChild(streakEl);
    }
    body.appendChild(row);
  }
}

function renderSparkline(points, color) {
  const NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("class", "sparkline");
  svg.setAttribute("viewBox", "0 0 100 24");
  svg.setAttribute("preserveAspectRatio", "none");
  svg.setAttribute("aria-hidden", "true");

  // Baseline at y=12.
  const baseline = document.createElementNS(NS, "line");
  baseline.setAttribute("class", "sparkline-baseline");
  baseline.setAttribute("x1", "0");
  baseline.setAttribute("y1", "12");
  baseline.setAttribute("x2", "100");
  baseline.setAttribute("y2", "12");
  svg.appendChild(baseline);

  if (!points || points.length === 0) {
    return svg;
  }

  const max = Math.max(1, ...points.map((p) => Math.abs(p)));
  const stepX = points.length > 1 ? 100 / (points.length - 1) : 100;
  const polyPoints = points
    .map((p, i) => {
      const x = points.length === 1 ? 50 : i * stepX;
      // y-axis is inverted (0 top); higher = up
      const y = 12 - (p / max) * 10;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");

  const line = document.createElementNS(NS, "polyline");
  line.setAttribute("class", "sparkline-line");
  line.setAttribute("points", polyPoints);
  line.setAttribute("stroke", color);
  svg.appendChild(line);

  // End-of-line dot
  if (points.length > 0) {
    const last = points[points.length - 1];
    const cx = points.length === 1 ? 50 : (points.length - 1) * stepX;
    const cy = 12 - (last / max) * 10;
    const dot = document.createElementNS(NS, "circle");
    dot.setAttribute("cx", cx.toFixed(2));
    dot.setAttribute("cy", cy.toFixed(2));
    dot.setAttribute("r", "1.8");
    dot.setAttribute("fill", color);
    svg.appendChild(dot);
  }

  return svg;
}

function renderUpcoming(schedule, watch = null, teamRecords = null) {
  const container = document.getElementById(ID.upcoming);
  if (!container) return;
  const body = container.querySelector(".panel-body") || container;
  body.innerHTML = "";

  if (!schedule || schedule.length === 0) {
    setPanelEmpty(ID.upcoming, "No games scheduled in the next 7 days.");
    return;
  }

  const byGameId = watch?.byGameId || null;
  const topIds = new Set(watch?.topIds || []);

  // Featured matchup (audit P6): promote tonight's single most-watchable game to
  // a hero card above the list. It is then excluded from the day groups so it
  // isn't shown twice.
  let featuredId = null;
  const topScored = watch?.scored?.[0];
  if (topScored) {
    const game = schedule.find((g) => g.gameId === topScored.gameId);
    if (game) {
      const info = byGameId ? byGameId.get(game.gameId) : null;
      const hero = renderFeaturedMatchup(game, info, teamRecords);
      if (hero) { body.appendChild(hero); featuredId = game.gameId; }
    }
  }

  // Group by ISO date (UTC date for stability).
  const groups = new Map();
  for (const g of schedule) {
    if (featuredId != null && g.gameId === featuredId) continue; // shown as the hero
    const key = (g.gameDate || "").slice(0, 10);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(g);
  }
  const dateKeys = [...groups.keys()].sort();

  for (const dateKey of dateKeys) {
    const group = document.createElement("div");
    group.className = "upcoming-day-group";

    const title = document.createElement("h3");
    title.className = "upcoming-day-title";
    title.textContent = formatHumanDate(dateKey);
    group.appendChild(title);

    // Lead with badged "top games" (by their watchability rank), keeping all
    // other games in their existing chronological order.
    const games = groups.get(dateKey).slice();
    if (byGameId) {
      games.sort((a, b) => {
        const ra = topIds.has(a.gameId) ? byGameId.get(a.gameId).rank : Infinity;
        const rb = topIds.has(b.gameId) ? byGameId.get(b.gameId).rank : Infinity;
        return ra - rb; // stable for equal (non-top) entries
      });
    }

    for (const game of games) {
      const watchInfo = topIds.has(game.gameId) ? byGameId.get(game.gameId) : null;
      group.appendChild(renderGameRow(game, watchInfo));
    }
    body.appendChild(group);
  }
}

function renderGameRow(game, watchInfo = null) {
  const row = document.createElement("div");
  row.className = watchInfo ? "upcoming-game upcoming-game--top" : "upcoming-game";

  const matchup = document.createElement("div");
  matchup.className = "upcoming-matchup";

  const away = game.awayTeam || {};
  const home = game.homeTeam || {};
  matchup.appendChild(teamChip(away.teamAbbreviation, away.teamId));
  const at = document.createElement("span");
  at.className = "upcoming-at";
  at.textContent = "@";
  matchup.appendChild(at);
  matchup.appendChild(teamChip(home.teamAbbreviation, home.teamId));

  const right = document.createElement("div");
  right.className = "upcoming-right";

  if (watchInfo) {
    const badge = document.createElement("span");
    badge.className = "watch-badge";
    badge.textContent = "★ Top game";
    badge.title = "Highlighted by the watchability ranker";
    right.appendChild(badge);
  }

  if (game.status && game.status !== "Scheduled" && game.status !== "Pre-Game") {
    const st = document.createElement("span");
    st.className = "upcoming-status";
    st.textContent = game.status;
    right.appendChild(st);
  } else {
    const t = document.createElement("span");
    t.className = "upcoming-time";
    t.textContent = formatGameTime(game.gameDate);
    right.appendChild(t);
  }

  row.appendChild(matchup);
  row.appendChild(right);

  // Reason line spans the full row width (grid-column 1 / -1).
  if (watchInfo && Array.isArray(watchInfo.reasons) && watchInfo.reasons.length) {
    const reason = document.createElement("div");
    reason.className = "upcoming-reason";
    reason.textContent = watchInfo.reasons.join(" · ");
    row.appendChild(reason);
  }

  return row;
}

// Featured matchup hero (audit P6) — tonight's #1 watchable game, enlarged.
function renderFeaturedMatchup(game, watchInfo, teamRecords) {
  const away = game.awayTeam || {};
  const home = game.homeTeam || {};
  if (!away.teamId && !home.teamId) return null;

  const card = document.createElement("div");
  card.className = "featured-matchup";

  const label = document.createElement("div");
  label.className = "featured-label";
  label.textContent = "★ Tonight's top game";
  card.appendChild(label);

  const teamsRow = document.createElement("div");
  teamsRow.className = "featured-teams";
  teamsRow.appendChild(featuredTeam(away, teamRecords));
  const at = document.createElement("span");
  at.className = "featured-at";
  at.textContent = "@";
  teamsRow.appendChild(at);
  teamsRow.appendChild(featuredTeam(home, teamRecords));
  card.appendChild(teamsRow);

  const meta = document.createElement("div");
  meta.className = "featured-meta";
  const reason = document.createElement("span");
  reason.className = "featured-reason";
  reason.textContent =
    (watchInfo?.reasons && watchInfo.reasons.join(" · ")) || "Top matchup on tonight's slate";
  meta.appendChild(reason);
  const time = document.createElement("span");
  time.className = "featured-time";
  if (game.status && game.status !== "Scheduled" && game.status !== "Pre-Game") {
    time.textContent = game.status;
  } else {
    time.textContent = formatGameTime(game.gameDate);
  }
  meta.appendChild(time);
  card.appendChild(meta);

  return card;
}

function featuredTeam(team, teamRecords) {
  const wrap = document.createElement("div");
  wrap.className = "featured-team";
  const abbr = team.teamAbbreviation || (team.teamId ? teamMeta(team.teamId)?.abbr : "") || "—";
  if (team.teamId) wrap.innerHTML = logoImgHtml(team.teamId, "cap", 40, "featured-logo");
  const ab = document.createElement("span");
  ab.className = "featured-abbr";
  ab.textContent = abbr;
  wrap.appendChild(ab);
  const rec = teamRecords && teamRecords.get && teamRecords.get(team.teamId);
  if (rec) {
    const r = document.createElement("span");
    r.className = "featured-record";
    r.textContent = rec;
    wrap.appendChild(r);
  }
  return wrap;
}

function teamChip(abbr, teamId) {
  const span = document.createElement("span");
  span.className = "team-cell";
  const safeAbbr = abbr || "—";
  const color = `var(--team-${safeAbbr.toUpperCase()})`;
  span.style.color = color;
  const logo = teamId
    ? logoImgHtml(teamId, "cap", 18, "team-logo-xs")
    : `<span class="team-swatch" style="background: ${color}"></span>`;
  span.innerHTML = `
    ${logo}
    <span class="team-abbr" style="color: var(--fg)">${escapeHtml(safeAbbr)}</span>
  `;
  return span;
}

function updateTimestamp(date) {
  const el = document.getElementById(ID.lastUpdated);
  if (!el) return;
  const iso = date.toISOString();
  const hh = String(date.getHours()).padStart(2, "0");
  const mm = String(date.getMinutes()).padStart(2, "0");
  const y = date.getFullYear();
  const mo = String(date.getMonth() + 1).padStart(2, "0");
  const da = String(date.getDate()).padStart(2, "0");
  el.setAttribute("datetime", iso);
  el.textContent = `${y}-${mo}-${da} ${hh}:${mm}`;
}

// ============================================================
//                STATE HELPERS
// ============================================================
function setPanelLoading(panelId, message) {
  const container = document.getElementById(panelId);
  if (!container) return;
  const body = container.querySelector(".panel-body") || container;
  body.innerHTML = `<p class="panel-loading">${escapeHtml(message)}</p>`;
}

function setPanelEmpty(panelId, message) {
  const container = document.getElementById(panelId);
  if (!container) return;
  const body = container.querySelector(".panel-body") || container;
  body.innerHTML = `<p class="panel-empty-state">${escapeHtml(message)}</p>`;
}

function showError(message) {
  const banner = document.getElementById(ID.errorBanner);
  if (!banner) return;
  banner.hidden = false;
  const textEl = banner.querySelector(".error-banner-text");
  if (textEl) textEl.textContent = message;
  const retry = document.getElementById(ID.errorRetry);
  if (retry && !retry.__wired) {
    retry.addEventListener("click", () => {
      hideError();
      init();
    });
    retry.__wired = true;
  }
}

function hideError() {
  const banner = document.getElementById(ID.errorBanner);
  if (!banner) return;
  banner.hidden = true;
}

// ============================================================
//                FORMAT HELPERS
// ============================================================
// Run-differential cell (audit P4): a colored, tabular value with a small
// diverging bar encoding magnitude — the standings' form spine at a glance.
function runDiffCellHtml(runsScored, runsAllowed) {
  const diff = (Number(runsScored) || 0) - (Number(runsAllowed) || 0);
  const w = Math.min(26, Math.round((Math.abs(diff) / 80) * 26));
  const cls = diff > 0 ? "positive" : diff < 0 ? "negative" : "";
  const sign = diff > 0 ? "+" : "";
  const bar = w > 0 ? `<span class="rd-bar ${cls}" style="width:${w}px"></span>` : "";
  return `<span class="rd">${bar}<span class="rd-num ${cls}">${sign}${diff}</span></span>`;
}
function formatPct(p) {
  if (p === undefined || p === null || Number.isNaN(p)) return ".000";
  // Drop leading zero: 0.615 -> .615
  const s = p.toFixed(3);
  return s.startsWith("0") ? s.slice(1) : s;
}
function formatGB(gb) {
  if (gb === "-" || gb === 0) return "—";
  if (typeof gb === "number") {
    return gb % 1 === 0 ? gb.toFixed(1) : String(gb);
  }
  return String(gb);
}
function formatHumanDate(iso) {
  if (!iso || iso.length < 10) return iso || "";
  const [y, m, d] = iso.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const day = date.toLocaleDateString(undefined, { weekday: "short", timeZone: "UTC" });
  const mon = date.toLocaleDateString(undefined, { month: "short", timeZone: "UTC" });
  return `${day}, ${mon} ${d}`;
}
function formatGameTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}
function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// ============================================================
//                TABS  (Daily / Trends)
// ============================================================
const CHART_JS_URL = "https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js";

function loadChartJs() {
  if (TRENDS.chartJsLoaded) return Promise.resolve();
  if (TRENDS.chartJsLoading) return TRENDS.chartJsLoading;
  TRENDS.chartJsLoading = new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = CHART_JS_URL;
    s.async = true;
    s.onload = () => { TRENDS.chartJsLoaded = true; resolve(); };
    s.onerror = () => reject(new Error(`Failed to load Chart.js from ${CHART_JS_URL}`));
    document.head.appendChild(s);
  });
  return TRENDS.chartJsLoading;
}

async function ensureTrendsView() {
  if (TRENDS.loaded) return;
  if (TRENDS.loading) return TRENDS.loading;
  const loadingEl = document.getElementById("trends-loading");
  TRENDS.loading = (async () => {
    if (loadingEl) loadingEl.textContent = "Loading trend widgets…";
    try {
      // 1) lazy-load Chart.js
      await loadChartJs();

      // 2) reuse cached teams/standings; fetch the extra stats in parallel
      let teams, standings;
      if (dailyFetchCache) {
        teams = dailyFetchCache.teams;
        standings = dailyFetchCache.standings;
      } else {
        [teams, standings] = await Promise.all([fetchTeams(), fetchStandings()]);
      }
      const [hitting, pitching, recentGames] = await Promise.all([
        fetchTeamHittingStats(),
        fetchTeamPitchingStats(),
        fetchCompletedGames14d()
      ]);

      // 3) hand off to the trends-charts renderer
      const { initTrendsView } = await import("./trends-charts.js");
      initTrendsView({ teams, standings, hitting, pitching, recentGames });

      // 4) reveal the widgets
      if (loadingEl) loadingEl.hidden = true;
      const kpis = document.getElementById("kpis");
      const grid = document.getElementById("trends-grid");
      if (kpis) kpis.hidden = false;
      if (grid) grid.hidden = false;
      TRENDS.loaded = true;
    } catch (err) {
      const isNet = err instanceof DataClientError || err instanceof StatsClientError;
      const msg = isNet
        ? `Trends unavailable: ${err.message}`
        : `Trends unavailable: ${err?.message || String(err)}`;
      if (loadingEl) {
        loadingEl.textContent = msg;
        loadingEl.classList.add("trends-loading-error");
      }
      // eslint-disable-next-line no-console
      console.error("[MLB Daily Dashboard] Trends init failed:", err);
      // Allow retry on next tab activation.
      TRENDS.loading = null;
    }
  })();
  return TRENDS.loading;
}

function activateTab(targetId) {
  const tabs = document.querySelectorAll(".tab-button");
  const panels = document.querySelectorAll(".tab-panel");
  tabs.forEach((t) => {
    const on = t.dataset.tabTarget === targetId;
    t.classList.toggle("is-active", on);
    t.setAttribute("aria-selected", on ? "true" : "false");
  });
  panels.forEach((p) => {
    const on = p.id === targetId;
    p.hidden = !on;
  });
  if (targetId === "tab-trends") {
    // Fire-and-forget; ensureTrendsView is idempotent.
    ensureTrendsView();
  }
}

function wireTabs() {
  document.querySelectorAll(".tab-button").forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.tabTarget;
      if (target) activateTab(target);
    });
  });
}

// ============================================================
//                BOOTSTRAP
// ============================================================
// Expose the deployed build version for programmatic test verification.
// Single source of truth is the #app-version marker in index.html; we read it
// from the DOM rather than hardcoding a second copy here (avoids drift).
function publishVersion() {
  const el = document.getElementById("app-version");
  const v = el?.dataset?.version || el?.textContent?.trim() || null;
  if (v) window.__APP_VERSION__ = v;
}

function bootstrap() {
  publishVersion();
  wireTabs();
  init();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootstrap);
} else {
  // Document is already parsed; run on next microtask so module imports settle.
  Promise.resolve().then(bootstrap);
}

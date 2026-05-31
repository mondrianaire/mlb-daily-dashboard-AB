You are picking up mlb-daily-dashboard — a repo that was auto-built by AutoBuilder
(https://github.com/mondrianaire/auto-builder), ratified on 2026-05-31,
and promoted here for product life.

The current state of the deployed application is at: https://mondrianaire.github.io/mlb-daily-dashboard-AB/

WHERE THIS CAME FROM (informational, not regulatory)

The original AutoBuilder prompt was:

Make me a web based Daily dashboard for all mlb teams and statistics focusing on weekly trends, upcoming games and schedules and overall rankings. Use github pages for hosting.

AutoBuilder's Discovery role interpreted that as:

Build a static web page that displays a daily-updated snapshot of all 30 MLB teams: overall standings/rankings, weekly performance trends (last-7-days W-L and run differential), and upcoming game schedules.

Major choices AutoBuilder made on the user's behalf (the inflection
points it surfaced and defaulted):

- Data source for MLB schedule, standings, and team statistics: MLB Stats API (statsapi.mlb.com)
- How 'daily' freshness is delivered on a static host: Client-side fetch on every page load
- Stats granularity: team-level vs player-level: Team-level only
- Definition of 'weekly trends': Rolling last-7-days W-L + run differential delta per team
- Scope of 'upcoming games and schedules': Today + next 7 days
- Shape of 'overall rankings': Six division standings tables + wild-card race
- Behavior on off-days or when API returns no games: Show empty-state copy
- Team identity visualization (logos, colors): Team abbreviations + color swatches

Verification verdict was pass.

One notable build-time self-correction (see run-report.md for full detail):

- **Arizona abbreviation inconsistency.** Renders as "AZ" in rankings/trends panels (API value) but "ARI" in upcoming-games panel (teams.js fallback). CV flagged it as cosmetic, not a Sev 0 trivial fix. A normalize-on-the-way-in would have caught this — the data-client could pin the abbreviation to a single source. Pattern worth surfacing: when the same logical field is sourced from two places, normalize at ingest, not at render. Candidate for an architecture amendment on normalization discipline in data-client roles.
- **GitHub Pages live URL is unverified at delivery.** CV confirmed the URL pattern and that the artifact is well-formed; the actual deploy happens via `commit-build.bat`. FC.6 "Public URL delivered" was marked PASS pending deploy. The first-contact gate could be tightened to actually probe the live URL after C5 commit pushes — but that requires Orchestrator to wait on Pages's build pipeline (typically ~60s), and the architecture currently doesn't have a post-C5 verification step. Worth thinking about for v1.11+ amendments.
- **No Researcher actually dispatched.** TD collapsed the CORS probe into "quick reasoning" with a stub probe file. This is technically permitted (canonical evidence cited in TD's IP1/IP2 resolutions), but if the CORS assumption had been wrong, the build would have shipped broken and only the live deploy would have caught it. CV's Option-A live-fetch exercise did empirically confirm CORS works, which is what saved this case. The architecture's defense here is that CV would catch the failure pre-delivery — and that's what happened.

WHERE TO LOOK NEXT

Read .claude/CLAUDE.md in this repo — it's auto-generated and contains
the full orientation: build provenance, "you are here" framing, repo
structure, visual iteration paths (Chrome MCP or puppeteer), product-
life mode guidance, and links into the AutoBuilder corpus for deeper
"why was this built this way" forensics.

The build is your STARTING POINT, not a specification. The user's actual
goals may have shifted since the build ran, and the AutoBuilder choices
above were defensible defaults — not commitments. Treat them as context
for understanding what's currently there, not as a frame the product
must stay within.

FIRST ACTION

Read .claude/CLAUDE.md, take a look at https://mondrianaire.github.io/mlb-daily-dashboard-AB/
(via Chrome MCP or puppeteer per the CLAUDE.md guidance), and tell me
what you see — what seems solid, what looks broken or unfinished, what
you'd want to know before making changes. Don't touch any files yet.

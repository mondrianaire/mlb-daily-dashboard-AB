# mlb-daily-dashboard

> A web-based daily dashboard that, when opened in a browser, shows current Major League Baseball team standings, weekly performance trends, and upcoming game schedules for all teams.

**▶ Live: https://mondrianaire.github.io/mlb-daily-dashboard-AB/**

This standalone repository is the production deliverable from AutoBuilder run **`mlb-daily-dashboard`**, forked here on 2026-05-31T03:30:41Z for ongoing product development.

## What's here (product life)

A static, zero-build site (vanilla ES modules + Chart.js via CDN) that reads live from the public MLB Stats API. Beyond the original standings/trends/schedule, product-life development has added: a **live scoreboard** (auto-refreshing in-game scores), a **daily briefing**, a **watchability ranker** with a featured-matchup hero, a **trend pulse**, **self-explaining quadrant charts**, a **light/dark theme** (default dark), and a **network-first cache** so transient API hiccups don't blank the page. See `CHANGELOG.md` for the full history and `docs/intelligence/` for the product-intelligence ledger and design audit.

## Original prompt

```
Make me a web based Daily dashboard for all mlb teams and statistics focusing on weekly trends, upcoming games and schedules and overall rankings. Use github pages for hosting.
```

## Build provenance

| Field | Value |
|---|---|
| AutoBuilder verdict | `pass` |
| First-delivery outcome | `failed_user_reprompted` |
| Ratified | 2026-05-31T00:10:40.035Z by **Jett** |
| Architecture version | `v1.10.1` |
| Build wall-clock | unknown minutes |

## What's here

This repository contains the production deliverable as built by AutoBuilder — the contents of `runs/mlb-daily-dashboard/output/final/` at the time of ratification. The build substrate (design decisions, audit logs, run report, state, etc.) lives in the AutoBuilder corpus and is not duplicated here.

The entry point is typically `index.html` (for web apps) or the main script file for other deliverable kinds. See the build context link below for the run-report's full description of what this artifact is and how it was built.

## Build context

Full build provenance — design decisions, audit logs, run report, root-cause analysis if any — lives in the AutoBuilder corpus at:

  https://github.com/mondrianaire/auto-builder/tree/main/runs/mlb-daily-dashboard

That corpus entry is **frozen at the ratification commit** and will not change going forward. The build factory is done with this build; what you're looking at here is the product, free to evolve.

## Continuing development

This repository is yours to evolve. Future commits, refactors, features, bug fixes — all land here, not in the AutoBuilder repo. The AutoBuilder corpus measurement of this build does not change retroactively based on what happens here.

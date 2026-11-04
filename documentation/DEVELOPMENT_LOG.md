# Development log

## Stage 1 — brand and architecture
- Diagnosed original repo (missing assets, JS syntax error); preserved site in `legacy/static-site/`.
- Monorepo skeleton, design tokens for three app themes, logo (light/dark/mark), shared components.
- 10-screen visual prototype (desktop/tablet/mobile) — approved by the owner.

## Stage 2 — public website
- Next.js 16 App Router site in `apps/public-website`, using `@dr/design-system`.
- Content: 18 technology pages (theory, equations, workflow, inputs, methods, applications, figure, references, Lab links),
  8 application pages, 4 original articles, resources, publications catalogue, Lab and Twin landing pages, about, contact, legal.
- References limited to well-established works; DOIs only where widely reproduced; editorial verification note shown.
- Verification: production build; Playwright crawl of 43 pages (0 broken links, 0 runtime errors); axe-core WCAG 2.2 AA
  on 6 pages (0 violations after fixing one contrast issue and focusable scroll regions); no horizontal overflow at
  390/834/1440 px after fixing grid min-width issues and moving access buttons to a utility bar at desktop widths.

## Stage 3 — Engineering Lab
- `services/analytics-engine` (`dr_analytics`): io, quality, signal_proc, stats, hst, ml, anomaly, dhi. Every function returns
  method, parameters, assumptions, warnings and results; series are LTTB-downsampled for display only.
- Finding during testing: global MAD outlier screening missed a +4.5 mm spike on a displacement series with larger seasonal
  swings. Switched time-series screening to a local Hampel filter (global MAD kept as an option).
- Finding: a naive regression test failed because seepage depends on season, which is correlated with reservoir level
  (omitted-variable bias) — the engine was right; the test now uses data with a known answer.
- `services/api`: FastAPI with identity, Lab and admin routers; SQLAlchemy 2 models; Alembic migration 0001 verified on PostgreSQL 16.
- `apps/engineering-lab`: Next.js app with auth pages, dashboard, projects, datasets/processing, signal, statistics, HST, ML,
  damage detection, DHI, saved runs, account/MFA, documentation; Plotly charts with data-table alternatives.
- E2E finding: default Butterworth cut-off of 1 Hz is above Nyquist for daily data; the engine rejected it correctly. The UI now
  takes cut-offs in cycles/day or Hz.

## Stage 4 — Digital Twin
- API: Twin models + migration 0002 (up/down verified), project-scoped authorisation (`app/twin/access.py`), rules/condition
  engine, event bus, ingestion, WebSocket stream, demonstration simulator with watchdog, `seed-demo` command.
- Finding: communications status was first computed from ingestion time; imported/backfilled history looked "online".
  Fixed to use the latest measurement timestamp (ingestion time still reported).
- Finding: a dropped sensor's seeded history ended only 3 h ago, inside its 6-interval "late" window, so no alert fired;
  the seed now ends it beyond the offline window.
- Finding: a fixed-offset demonstration anomaly never crossed the criterion in low-reservoir seasons; anomalies now target a level.
- Frontend `apps/digital-twin`: project access page, shell with live status, overview, Three.js 3D model, ECharts monitoring,
  sensor registry/gateways/import, alerts & criteria, members/invitations/requests/audit.
- Mobile fixes: header status wrapping, unwrapped tables, KPI truncation.

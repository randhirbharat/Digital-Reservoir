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

## Stage 5 — Integration
- `app/routers/integration.py`: model publication, evaluation, export-to-Lab; deviation alerts in the ingestion path.
- `app/rls.py` + migration 0003: forced RLS policies; context applied per transaction via a Session `after_begin` hook.
  Important deployment rule: the application database role must not be a superuser (superusers bypass RLS).
- Lab: "Publish to Digital Twin" on HST results. Twin: published-model panels, model-vs-observation evaluation, "Analyse in Lab".
- Test-isolation fixes after adding shared-state tests (sources/gateways); the product behaviour was correct.

## Stage 6 — Advanced engineering
- Engine modules `hybrid`, `fragility`, `modal`, `vision`; Lab API kinds `hybrid`, `fragility`, `modal`; vision upload/review/compare endpoints;
  Lab pages for each; browser E2E of all four.
- Findings fixed during testing: crack detector produced false positives on crack-free texture (Otsu always finds a threshold) →
  added local-contrast test; crack length overestimated 4× by summing a branchy skeleton → main geodesic path;
  fragility test now validates against the sampled capacities rather than the population median; `to_jsonable` handles pandas
  objects; fragility dispatcher passed `None` instead of engine defaults.

## Stage 7 — Testing and deployment
- Docker: `api`, `web` (one Dockerfile, `APP` build-arg, Next.js standalone) and `bridge` images; non-root users; optional BuildKit
  secret `extra_ca` for builds behind TLS-intercepting proxies; `BASE_REGISTRY` / `DR_IMAGE_*` for registry mirrors.
- Compose: TimescaleDB (PostgreSQL 16), Redis, API, three apps, optional Mosquitto + bridge (`mqtt` profile). The DB init script creates
  the restricted `dr_app` role; the API entrypoint migrates as the owner, then serves as `dr_app`.
- Findings fixed while building the images:
  - no `.dockerignore` → host `node_modules`/`.next` leaked into the build context → added;
  - `pnpm --filter "./apps/X..."` did not select workspace dependencies → filter by package name `@dr/X...`;
  - Mosquitto password file would have been lost (written inside a throwaway container) → dedicated `mqtt-auth` volume.
- Smoke test of the built stack (2026-11-04): migrations 0001–0003 applied, `observation` became a hypertable, `dr_app` is NOSUPERUSER
  NOBYPASSRLS and sees 0 observation rows without a user context, admin created via prompt/env (no stored password), demo seeded,
  login through the Twin proxy, same session accepted by the Lab, PRJ-D refused without MFA (403), login without CSRF header refused (403).
- Tests: engine 16, bridge 2, API 28 on PostgreSQL as `dr_app` (27 + 1 skipped on SQLite), utilities 3; `pnpm audit --prod` and
  `pip-audit` clean. CI workflow added.
- Core Web Vitals measured locally on development builds with 4× CPU throttling: LCP 0.6–1.1 s, CLS 0, but slow interactions
  (368–552 ms) — recorded as a limitation, optimisation on the roadmap.
- Documentation: README (complete setup), ARCHITECTURE (Mermaid diagrams), DEPLOYMENT, TESTING, USER_GUIDE, ROADMAP, LIMITATIONS,
  OpenAPI spec; `.env.example` completed.

## Stage 7 follow-up — GitHub Pages preview and CI fixes
- Public website can be built as a static export (`NEXT_PUBLIC_STATIC_PREVIEW=1`, `NEXT_PUBLIC_BASE_PATH`); Lab/Twin links point
  to a "run locally" page and the contact form explains it is unavailable; download links respect the base path.
  Verified by serving the export under `/Digital-Reservoir/` and crawling all 44 pages (no 4xx, no JS errors, no localhost links).
- `.github/workflows/pages.yml` deploys the preview on pushes to `main` (requires Pages source = GitHub Actions).
- First CI run on GitHub failed and exposed two real defects, both fixed:
  - `pip install -r services/api/requirements.txt` from the repository root fails (the editable `../analytics-engine` path is relative to
    the working directory) — CI and README now install from `services/api`;
  - `shared-utilities` used `process` without Node type definitions, and read `NEXT_PUBLIC_*` through an aliased object, which
    Next.js does not inline into browser bundles (client code would have fallen back to localhost URLs) — now literal
    `process.env.NEXT_PUBLIC_*` references, with `@types/node` declared in the packages.

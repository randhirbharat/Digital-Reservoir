# Digital Reservoir — architecture (Stage 1)

Status: **proposed — awaiting prototype approval before Stage 2+ implementation.**

## Applications

| App | Path | Default local URL | Access | Theme |
|---|---|---|---|---|
| 01 Public website | `apps/public-website` | http://localhost:3000 | Open, SEO-indexed | Ivory / navy / teal |
| 02 Engineering Lab | `apps/engineering-lab` | http://localhost:3001 | Registered + email-verified; permissions by membership category | Light analytical workspace |
| 03 Digital Twin | `apps/digital-twin` | http://localhost:3002 | Invitation / approval per project; MFA | Dark technical |

Domains (`www.` / `lab.` / `secure.digitalreservoir.in`) are configuration only (`NEXT_PUBLIC_*_URL`); nothing assumes they are registered.

## Monorepo

```
apps/            public-website · engineering-lab · digital-twin   (Next.js 16 App Router, React 19, TypeScript 5.9, Tailwind 4)
services/        api (FastAPI: identity, Lab, Twin, ingestion endpoints)
                 analytics-engine (Python package: QC, signal, statistics, HST, ML, anomaly, DHI, modal, fragility)
                 data-ingestion (simulator + MQTT/REST connectors → API)
                 realtime-service (WebSocket fan-out; initially inside the API process)
packages/        design-system · shared-types · authentication · shared-utilities
infrastructure/  docker · database · deployment
documentation/   architecture, API, status table, dev log, prototype source
datasets/        synthetic example datasets (labelled)
tests/           cross-service tests (security / permissions)
legacy/          the original static site, kept for reference
```

## Data flow (Digital Twin)

```
Sensors / logger / gateway
  → MQTT broker or HTTPS ingestion gateway (per-gateway key)
  → validation & preprocessing (units, timestamps, quality flags)
  → PostgreSQL + TimescaleDB hypertable `observation`
  → event processing (alert rules, comms watchdog)
  → REST + WebSocket (project-scoped)
  → dashboards / 3D twin
```

Every observation carries: timestamp (UTC, tz-aware), sensor_id, project_id, asset_id, value, unit, source
(`live | historical | simulated | imported`), quality flag, ingestion timestamp.

## Identity and authorisation

* One identity service (FastAPI). Passwords hashed with Argon2id. Sessions are opaque random tokens stored hashed
  server-side (revocable), sent as `HttpOnly; Secure; SameSite=Lax` cookies scoped to the parent domain in
  production → single sign-on across the three apps. (Short-lived JWT access tokens per the FastAPI OAuth2 guide
  remain an option for machine clients; human sessions stay revocable.)
* CSRF: state-changing requests require a custom header + strict CORS allow-list.
* TOTP MFA; mandatory for Digital Twin and administrator roles (configurable).
* Lab permissions from membership category; Twin permissions from per-project membership role
  (Project Administrator, Project Engineer, Researcher, Monitoring Operator, Read-only Viewer) plus Institutional
  Administrator and Platform Super Administrator.
* Enforcement: every project-scoped endpoint resolves membership server-side; PostgreSQL row-level security
  policies on project tables keyed by a per-request `app.user_id` setting as a second line of defence.
* Audit log for logins, failures, access denials, exports, role changes.

## Design system

`packages/design-system` holds the tokens (`styles.css`), the logo (light/dark SVG + React), buttons, cards,
provenance badges and condition chips. Condition chips always pair colour with a shape and a text label.
Prototype: `documentation/prototype/*.dc.html` (published canvas: see README).

# Testing

## 1. Automated suites

| Suite | Command | Count (Stage 7) | What it covers |
|---|---|---|---|
| Analytics engine | `python -m pytest -q services/analytics-engine/tests` | 16 | See the list below this table. |
| Ingestion bridge | `python -m pytest -q services/data-ingestion/tests` | 2 | Forwarding, spooling while the API is down, replay of the spool |
| API on SQLite | `cd services/api && python -m pytest -q tests` | 27 passed, 1 skipped | Auth, Lab, Twin and integration flows. The RLS test is skipped because SQLite has no RLS. |
| API on PostgreSQL with RLS | see below | 28 passed | Same suite, run as a non-superuser role, with forced row-level security active |
| Shared utilities (TypeScript) | `pnpm --filter @dr/shared-utilities test` | 3 | Formatting, app URLs, provenance labels |
| Type checks | `pnpm -r typecheck` | — | All apps and packages |
| Production builds | `pnpm build` | — | All three Next.js apps |

The analytics engine tests cover:

- recovery of the synthetic HST generator's coefficients;
- leakage-free chronological splits;
- conformal interval coverage;
- Hampel outlier detection;
- Butterworth filters, FFT and CWT;
- DHI with AHP and its consistency ratio;
- recovery of the synthetic modal frequencies (3.2 and 7.9 Hz);
- fragility (MLE and IDA) checked against the sampled capacities;
- the crack detector, including the false-positive and length cases;
- hybrid modelling.

### API tests against PostgreSQL

These tests need an empty database owned by a role that is **not** a superuser. Otherwise RLS is bypassed and the isolation tests prove nothing.

```bash
psql -U postgres -c "create role dr_app login password 'dr_app_test' nosuperuser nobypassrls" -c "create database dr_test owner dr_app"
```

```bash
cd services/api && DR_TWIN_ENFORCE_MFA=true DR_DATABASE_URL=postgresql+psycopg://dr_app:dr_app_test@localhost:5432/dr_test python -m pytest -q tests
```

The `conftest.py` fixtures create the schema and apply the RLS policies from migration 0003.

`.github/workflows/ci.yml` runs on every push and pull request. It runs:

- all of the suites above;
- an Alembic `upgrade → downgrade → upgrade` cycle on PostgreSQL;
- a `docker compose config` validation.

### Security tests in the API suite

The suite checks that:

- an unverified user cannot sign in, and is locked out after repeated failures;
- login is rate-limited;
- a state-changing request without the CSRF header or with a foreign `Origin` is rejected;
- the MFA flow works, and a session without MFA is refused on an MFA project (REST and WebSocket);
- a non-member gets 404 on another project's data, sensors, alerts and stream;
- each role is limited to its permissions (for example, a viewer cannot acknowledge alerts and an operator cannot export);
- revoking membership ends access immediately;
- gateway keys are scoped to one project, and ingestion rejects future timestamps, naive timestamps and unknown sensors;
- a Lab user cannot read another user's datasets or runs;
- the Lab category permissions are enforced;
- model publication requires both owning the run and having `models_publish`;
- with RLS on PostgreSQL, a forged insert into another project's table is refused by the database itself.

## 2. Browser end-to-end checks

The browser checks were run with Playwright (Chromium) against the development servers. The scripts were kept outside the repository during development and are summarised here. Turning them into a committed Playwright suite is on the [roadmap](ROADMAP.md).

| Flow | Steps checked |
|---|---|
| Public site | Crawled every route in `sitemap.xml`: HTTP 200, no console errors, no horizontal overflow at 375 px, 768 px and 1440 px. axe-core WCAG 2.2 AA on the key pages: 0 violations. |
| Lab | Register, read the verification link from the outbox, verify, sign in, import a sample, quality checks, filter (new version), HST calibration and validation, ML with rolling-origin validation, report, CSV export, category restrictions in the UI and the API |
| Twin | Admin signs in; MFA enrolment is required; overview KPIs; live WebSocket updates; 3D scene (select a sensor, pick a component, keyboard sensor list); monitoring (windows, comparison, criteria lines, CSV); alert acknowledgement; invitation; non-member URL manipulation gives 404; mobile and tablet layouts |
| Integration (with RLS) | Twin export to Lab dataset (provenance kept) → HST → publish to Twin → evaluation and deviation panel |
| Advanced | Hybrid, modal (FDD), fragility (MLE and IDA), crack detection with engineer review and before/after comparison |

## 3. Security checks (Stage 7)

| Check | Result |
|---|---|
| `pnpm audit --prod` | No known vulnerabilities |
| `pip-audit` (API environment) | No known vulnerabilities. The local editable `dr-analytics` package is not on PyPI, so it was not audited. |
| Secret scan of the repository | No real secrets committed. The example env files contain placeholders only, and the CI database passwords are throwaway values for the CI service container. |
| Docker | All images run as non-root users. Secrets come from the environment only. Migrations use a separate owner role. |

## 4. Performance (local measurement)

Measured on 2026-11-04 with Playwright against the **development** server on the same machine, with a phone profile, 4× CPU throttling and roughly 150 ms latency.

| Page | LCP | CLS | Slowest interaction |
|---|---|---|---|
| `/` | 1.1 s | 0 | 552 ms (opening the mobile menu) |
| `/technologies/hst-modelling` | 0.6 s | 0 | 368 ms |
| `/research` | 0.7 s | 0 | 512 ms |

These are lab measurements, not field data, and they were taken on development builds. The interaction times are above the 200 ms "good" INP threshold under 4× throttling, so the mobile menu and figure hydration need optimising (see the roadmap). Re-measure on the production build and with real-user monitoring after deployment.

## 5. Docker

The four images build from a clean context: `api`, `public-website`, `engineering-lab` and `digital-twin`, plus the `bridge` image. See [DEPLOYMENT.md](DEPLOYMENT.md). The compose file is validated in CI.

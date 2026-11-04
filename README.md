# Digital Reservoir

**Intelligence for Infrastructure.** From monitoring data to engineering decisions.

Digital Reservoir is made of three connected applications. They share one identity, one API and one design system:

| # | Application | Folder | Local URL | Who can use it |
|---|---|---|---|---|
| 01 | Public website | `apps/public-website` | http://localhost:3000 | Everyone |
| 02 | Engineering Lab | `apps/engineering-lab` | http://localhost:3001 | Registered users with a verified email. Permissions depend on the membership category. |
| 03 | Digital Twin | `apps/digital-twin` | http://localhost:3002 | Project members admitted by invitation or approval. MFA is required. |
| — | API (FastAPI) | `services/api` | http://localhost:8000/api/docs | Used by the three apps and by monitoring gateways |

> **About the data.** Every dataset, sensor and stream in this repository is **synthetic or simulated**, and is labelled that way wherever it appears (`source=simulated`, the "DEMONSTRATION DATA" banner, `provenance=synthetic`). The demonstration dam does not exist. The demonstration alert criteria are illustrative and were not approved by any project. See [documentation/LIMITATIONS.md](documentation/LIMITATIONS.md).

## Documentation

| Document | Contents |
|---|---|
| [ARCHITECTURE.md](documentation/ARCHITECTURE.md) | Components, data flow, entity relationships and security model (Mermaid diagrams) |
| [DEPLOYMENT.md](documentation/DEPLOYMENT.md) | Docker Compose, production subdomains, TLS, cookies, database roles, backups |
| [TESTING.md](documentation/TESTING.md) | Automated test suites, browser end-to-end checks and security checks |
| [USER_GUIDE.md](documentation/USER_GUIDE.md) | Using the public site, the Lab and the Twin |
| [api/](documentation/api/README.md) | OpenAPI 3.1 specification (`openapi.json`) and API conventions |
| [IMPLEMENTATION_STATUS.md](documentation/IMPLEMENTATION_STATUS.md) | What is complete, partial, simulated or pending |
| [LIMITATIONS.md](documentation/LIMITATIONS.md) | Known limitations, stated plainly |
| [ROADMAP.md](documentation/ROADMAP.md) | Planned work |
| [DEVELOPMENT_LOG.md](documentation/DEVELOPMENT_LOG.md) | Decisions and findings for each stage |

## Option A: run everything with Docker

Requirements: Docker 24 or later with Compose v2.

1. Create your own environment file from the template:

   ```bash
   cp .env.docker.example .env.docker
   ```

2. Edit `.env.docker` and set real values for `DR_SECRET_KEY`, `POSTGRES_PASSWORD` and `DR_APP_DB_PASSWORD`. You can generate a value like this:

   ```bash
   openssl rand -hex 32
   ```

3. Build and start the stack:

   ```bash
   docker compose --env-file .env.docker up --build -d
   ```

4. Create the platform administrator. The command prompts for the password, so it is never written down:

   ```bash
   docker compose --env-file .env.docker exec api python -m app.cli create-admin --email you@example.org
   ```

5. Optional: load the demonstration Digital Twin project with simulated data:

   ```bash
   docker compose --env-file .env.docker exec api python -m app.cli seed-demo --admin-email you@example.org
   ```

The API container applies the database migrations at start-up, using the owner role. It then serves requests as the restricted `dr_app` role, so row-level security applies. See [DEPLOYMENT.md](documentation/DEPLOYMENT.md) for MQTT, mirrors and production settings.

## Option B: local development

Requirements:

- Node.js 20.9 or later, with pnpm 10 (`corepack enable`);
- Python 3.12 or 3.13;
- PostgreSQL 16 (recommended; TimescaleDB is optional). SQLite works for a quick look, but it has **no row-level security**.
- Redis is optional. Rate limiting falls back to an in-memory store.

### 1. Install

```bash
pnpm install
```

```bash
python -m venv .venv && . .venv/bin/activate
```

```bash
pip install -r services/api/requirements.txt scikit-image
```

`requirements.txt` installs the analytics engine (`services/analytics-engine`) in editable mode.

### 2. Configure

```bash
cp .env.example .env
```

Every setting is described in `.env.example`. The API reads `DR_*` variables from the environment or from `services/api/.env`. The apps read `NEXT_PUBLIC_*` (browser-visible, so never put a secret there) and `DR_API_INTERNAL_URL`.

### 3. Initialise the database

Create a database owner role and a separate **non-superuser** application role. PostgreSQL superusers bypass row-level security, so the application must not connect as one.

```bash
psql -U postgres -c "create role dr_owner login password '<owner password>'" -c "create database digital_reservoir owner dr_owner"
```

```bash
psql -U postgres -c "create role dr_app login password '<app password>' nosuperuser nobypassrls"
```

Then apply the migrations as the owner:

```bash
cd services/api
```

```bash
DR_DATABASE_URL=postgresql+psycopg://dr_owner:<owner password>@localhost:5432/digital_reservoir alembic upgrade head
```

Finally, grant the application role access to the tables:

```bash
psql -U dr_owner -d digital_reservoir -c "grant usage on schema public to dr_app; grant select, insert, update, delete on all tables in schema public to dr_app; grant usage, select on all sequences in schema public to dr_app"
```

`infrastructure/database/01-app-role.sh` does the same thing for Docker. It also sets default privileges, so tables created later are covered too.

### 4. Create the administrator (securely)

```bash
cd services/api && python -m app.cli create-admin --email you@example.org
```

The password is read from an interactive prompt. For automation, pass it in the `DR_ADMIN_PASSWORD` environment variable, for example from a secret store. It is never hard-coded and never logged. The command checks the password policy before creating the account. Turn on MFA (TOTP) at the first sign-in.

### 5. Start the backend

```bash
cd services/api && uvicorn app.main:app --port 8000
```

The demonstration telemetry simulator runs inside the API process when `DR_SIMULATOR_ENABLED=true`. It writes `source=simulated` observations every `DR_SIMULATOR_INTERVAL_SECONDS` to projects whose data mode is `simulated`.

### 6. Start the three apps

Run each command in its own terminal:

```bash
pnpm dev:public
```

```bash
pnpm dev:lab
```

```bash
pnpm dev:twin
```

Each app forwards `/api/*` to `DR_API_INTERNAL_URL`. The browser therefore talks to one origin per app, and the session cookie stays first-party.

## Loading the sample data

- **Lab:**
  - Go to *Datasets → Import sample*, or call `POST /api/v1/lab/datasets/samples/{gravity_dam_daily|ambient_vibration|fragility_stripes}`.
  - The samples are in `datasets/` and are produced by `datasets/generate_synthetic.py`. Run it again to reproduce them; the generator seed is fixed.
- **Twin:**
  - Run `python -m app.cli seed-demo --admin-email you@example.org [--history-days 120]`.
  - It creates the project **PRJ-D, "Demonstration gravity dam"**: 12 simulated sensors, 120 days of simulated history, and demonstration criteria.
  - It also creates the empty projects PRJ-A, PRJ-B and PRJ-C, which you can use to test project isolation.
- **Replay a CSV through the ingestion API:**

  ```bash
  python services/data-ingestion/csv_replay.py --help
  ```

## Testing registration and permissions locally

1. Open http://localhost:3001/register and create an account. Pick a membership category: *general*, *student*, *researcher* or *professional*.
2. While `DR_EMAIL_BACKEND=console`, the verification email is not sent anywhere. It is printed to the API log and stored in the `email_outbox` table. Open the link it contains to verify the address.
3. Sign in. The Lab shows only the analyses your category allows; the API enforces the same rule and returns 403 otherwise. The category-to-permission table is `LAB_PERMISSIONS` in `services/api/app/config.py`. An administrator can change a user's category or grant extra permissions through the API, with `PATCH /api/v1/admin/users/{id}`. There is no admin screen for this yet; see the API docs at http://localhost:8000/api/docs.
4. To test Twin access:
   - As the administrator, open http://localhost:3002, choose **PRJ-D → Access**, and invite the new account with a role (*viewer*, *monitoring_operator*, *researcher*, *project_engineer* or *project_admin*).
   - The invitation email appears in the outbox, in the same way as the verification email.
   - Projects you are not a member of return **404**, even if you type their URL directly.
5. Demonstration telemetry: once PRJ-D exists and the API is running, the overview, monitoring and 3D views update live over a WebSocket. Piezometer PZ-03 periodically crosses its demonstration *attention* criterion, which shows the alert workflow. Thermometer TM-12 deliberately stops reporting, which shows the communications watchdog.

## Tests

```bash
python -m pytest -q services/analytics-engine/tests services/data-ingestion/tests
```

```bash
cd services/api && python -m pytest -q tests
```

```bash
pnpm -r typecheck && pnpm --filter @dr/shared-utilities test
```

To run the API tests against PostgreSQL with row-level security, see [TESTING.md](documentation/TESTING.md). CI is defined in `.github/workflows/ci.yml`.

## Repository layout

```
apps/            public-website · engineering-lab · digital-twin   (Next.js 16 App Router, React 19, TypeScript, Tailwind 4)
packages/        design-system · shared-types · authentication · shared-utilities
services/        api (FastAPI) · analytics-engine (dr_analytics) · data-ingestion (MQTT bridge, CSV replay)
infrastructure/  docker/ (Dockerfiles, entrypoint, Mosquitto) · database/ (role initialisation)
datasets/        synthetic example datasets and their generator
documentation/   architecture, deployment, testing, user guide, API spec, status, log, prototype
legacy/          the original static site (repaired), kept for reference
```

The approved visual prototype is in `documentation/prototype/`.

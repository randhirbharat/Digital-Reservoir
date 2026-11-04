# Deployment

This page covers a single-host deployment with Docker Compose and the settings needed for production. No hosting provider or domain is assumed; the URLs are configuration.

## 1. Containers

| Service | Image / Dockerfile | Port | Notes |
|---|---|---|---|
| `db` | `timescale/timescaledb:2.17.2-pg16` | internal | PostgreSQL 16 with TimescaleDB. On first start, `infrastructure/database/01-app-role.sh` creates the restricted role `dr_app`. |
| `redis` | `redis:7.4-alpine` | internal | Rate-limit store |
| `api` | `infrastructure/docker/api.Dockerfile` | 8000 | Runs `alembic upgrade head` as the owner role at start-up, then serves requests as `dr_app`. Non-root user. Has a health check. |
| `public`, `lab`, `twin` | `infrastructure/docker/web.Dockerfile` (`APP` build argument) | 3000 / 3001 / 3002 | Next.js standalone servers. Non-root user. |
| `mosquitto`, `mqtt-bridge` | `eclipse-mosquitto:2.0.20`, `bridge.Dockerfile` | 1883 | Optional; start them with `--profile mqtt` |

Start the stack:

```bash
cp .env.docker.example .env.docker
```

```bash
docker compose --env-file .env.docker up --build -d
```

```bash
docker compose --env-file .env.docker exec api python -m app.cli create-admin --email you@example.org
```

To validate the configuration without starting anything (CI does this too):

```bash
docker compose --env-file .env.docker.example config --quiet
```

**Build notes**

- `NEXT_PUBLIC_*` values are compiled into the browser bundles. Rebuild the web images after you change them.
- If Docker Hub rate-limits base-image pulls, set `DR_IMAGE_REGISTRY=mirror.gcr.io/library` and `DR_IMAGE_HUB=mirror.gcr.io`.
- If you build behind a TLS-intercepting proxy, pass its CA bundle as an optional BuildKit secret. Builds without it are unchanged.

  ```bash
  docker build --secret id=extra_ca,src=/path/to/ca-bundle.pem -f infrastructure/docker/api.Dockerfile -t digital-reservoir-api .
  ```

- Compose's bake builder may refuse `DR_BUILD_NETWORK=host`. In that case, build the images with plain `docker build` as shown above, tag them, and start the stack with `docker compose up --no-build`.

## 2. Production checklist

### Secrets

- `DR_SECRET_KEY`: at least 32 random bytes, for example from `openssl rand -hex 32`. The API **refuses to start** in production with a short or development key.
- Changing `DR_SECRET_KEY` makes stored MFA secrets unreadable, because they are encrypted with a key derived from it. Plan to re-enrol users if you rotate it.
- Keep `.env.docker` out of version control (it is in `.gitignore`), or better, inject the secrets from a secret manager.
- Do not put a secret in a `NEXT_PUBLIC_*` variable: those are visible to every browser.
- Database passwords are inserted into SQL by the init script, so avoid single quotes in them.

### Domains, cookies and HTTPS

| Setting | Example | Why |
|---|---|---|
| `DR_ENV` | `production` | Turns on the production start-up checks |
| `DR_COOKIE_SECURE` | `true` | Required in production; the API refuses to start without it |
| `DR_COOKIE_DOMAIN` | `.example.org` | Shares the session across `www.`, `lab.` and `secure.`, which gives single sign-on |
| `NEXT_PUBLIC_PUBLIC_URL` / `_LAB_URL` / `_TWIN_URL` | `https://www.example.org`, … | Links between the apps, and the URLs in emails |
| `DR_CORS_ORIGINS` | the three app origins | The CSRF origin check and CORS allow-list. Compose derives it from the URLs above. |

Put a reverse proxy in front of the stack (nginx, Caddy, Traefik or a cloud load balancer). It should:

- terminate TLS and redirect HTTP to HTTPS;
- send HSTS;
- forward `X-Forwarded-For` and `X-Forwarded-Proto`. The API container trusts forwarded headers; restrict `--forwarded-allow-ips` to the proxy's address if the API can be reached in any other way;
- pass WebSocket upgrades for `/api/v1/twin/projects/*/stream`;
- limit request body size in line with the Lab upload limits (`UPLOAD_LIMIT_MB` in `config.py`, at most 200 MB).

### Database

- At runtime the API **must** connect as a non-superuser role without `BYPASSRLS` (`dr_app`). PostgreSQL silently skips row-level security for superusers and for table owners that do not force it. All seven project tables use `FORCE ROW LEVEL SECURITY`, but a superuser still bypasses it.
- Run migrations as the owner role. `DR_MIGRATION_DATABASE_URL` is used by the API entrypoint.
- With TimescaleDB present, migration 0002 turns `observation` into a hypertable. Without it, a plain table is used.
- **Backups:**
  - Take scheduled `pg_dump -Fc` backups, or use continuous archiving (WAL) for point-in-time recovery.
  - Back up the `object-store` volume too: it holds the uploaded originals, which are written once.
  - Test restores.

### Email

Set `DR_EMAIL_BACKEND=smtp` and the `DR_SMTP_*` settings. The SMTP backend is implemented but has **not been tested against a real mail server**. Send a password-reset email to yourself as an acceptance test before going live.

### MFA

`DR_TWIN_ENFORCE_MFA=true` (the default) makes projects with `require_mfa` demand an MFA-verified session. Also set `DR_REQUIRE_MFA_FOR_ADMINS=true` in production.

### Scaling

- The live event bus runs **in memory inside one API process**. Run a single API worker until the Redis pub/sub bus in the roadmap is implemented. Several workers would each see only their own events.
- The demonstration simulator and the watchdog also run in that process. Set `DR_SIMULATOR_ENABLED=false` on deployments without demonstration projects.
- Analyses run synchronously within the request. Very large datasets can hit proxy timeouts, so a job queue is on the roadmap.

### Monitoring

- Health endpoint: `GET /api/v1/public/health`, which the API container's `HEALTHCHECK` uses.
- The API logs to stdout. The audit log is stored in the `audit_log` table.

## 3. Field data (MQTT)

1. In the Twin, a project administrator registers the sensors, then creates a gateway under *Sensors → Gateways*. The key is shown **once**.
2. Create a broker user. The password file is kept in the `mqtt-auth` volume:

   ```bash
   docker compose --env-file .env.docker --profile mqtt run --rm mosquitto mosquitto_passwd -c /mosquitto/auth/passwd bridge
   ```

   Then set `DR_MQTT_USER` and `DR_MQTT_PASSWORD` to that user's credentials.
3. Set `DR_INGEST_GATEWAY_KEY` and `DR_BRIDGE_PROJECT`, then start the broker and bridge:

   ```bash
   docker compose --env-file .env.docker --profile mqtt up -d
   ```

4. Publish JSON to `dr/<project>/<sensor>`. The bridge forwards the messages to `/api/v1/ingest/observations` and keeps them on disk while the API is unreachable.

Before connecting real field devices:

- `mosquitto.conf` disables anonymous access.
- Add TLS on port 8883.
- The bridge has been tested with simulated messages only. It has not been tested with real loggers or hardware.

See `services/data-ingestion/README.md` for details.

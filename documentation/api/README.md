# API reference

Generated from the FastAPI OpenAPI schema (`documentation/api/openapi.json`). Interactive docs: `http://localhost:8000/api/docs`.

## Conventions

* Base path `/api/v1`. JSON request/response bodies. Timestamps are ISO-8601 with time zone (UTC).
* Browser clients authenticate with the HttpOnly session cookie set by `POST /auth/login`; every state-changing request must send `X-Requested-With: DigitalReservoir` (CSRF protection) from an allowed origin.
* Gateways authenticate ingestion with `X-DR-Gateway-Key` (issued per project; shown once).
* Project-scoped endpoints return **404** to non-members (existence is not disclosed) and **403** when the role lacks a permission or an MFA-verified session is required.
* Errors: `{"detail": "message"}` with 400/401/403/404/409/413/415/422/423/429.

## public

| Method | Path | Operation |
|---|---|---|
| POST | `/api/v1/public/contact` | Contact |
| GET | `/api/v1/public/health` | Health |

## auth

| Method | Path | Operation |
|---|---|---|
| POST | `/api/v1/auth/login` | Login |
| POST | `/api/v1/auth/login/mfa` | Login Mfa |
| POST | `/api/v1/auth/logout` | Logout |
| GET | `/api/v1/auth/me` | Me |
| POST | `/api/v1/auth/mfa/disable` | Mfa Disable |
| POST | `/api/v1/auth/mfa/enable` | Mfa Enable |
| POST | `/api/v1/auth/mfa/setup` | Mfa Setup |
| POST | `/api/v1/auth/password/change` | Change Password |
| POST | `/api/v1/auth/password/forgot` | Forgot |
| POST | `/api/v1/auth/password/reset` | Reset |
| POST | `/api/v1/auth/register` | Register |
| POST | `/api/v1/auth/resend-verification` | Resend Verification |
| GET | `/api/v1/auth/sessions` | Sessions |
| DELETE | `/api/v1/auth/sessions/{session_id}` | Revoke Session |
| POST | `/api/v1/auth/verify-email` | Verify Email |

## engineering-lab

| Method | Path | Operation |
|---|---|---|
| GET | `/api/v1/lab/analyses` | List Runs |
| GET | `/api/v1/lab/analyses/catalogue` | Catalogue |
| POST | `/api/v1/lab/analyses/{kind}` | Run Analysis |
| DELETE | `/api/v1/lab/analyses/{rid}` | Delete Run |
| GET | `/api/v1/lab/analyses/{rid}` | Get Run |
| GET | `/api/v1/lab/analyses/{rid}/export.csv` | Export Series |
| GET | `/api/v1/lab/analyses/{rid}/report` | Report |
| POST | `/api/v1/lab/analyses/{rid}/review` | Review Detection |
| GET | `/api/v1/lab/dashboard` | Dashboard |
| GET | `/api/v1/lab/datasets` | List Datasets |
| POST | `/api/v1/lab/datasets` | Upload Dataset |
| POST | `/api/v1/lab/datasets/samples/{sample}` | Import Sample |
| DELETE | `/api/v1/lab/datasets/{did}` | Delete Dataset |
| GET | `/api/v1/lab/datasets/{did}` | Get Dataset |
| PATCH | `/api/v1/lab/datasets/{did}` | Patch Dataset |
| GET | `/api/v1/lab/projects` | List Projects |
| POST | `/api/v1/lab/projects` | Create Project |
| DELETE | `/api/v1/lab/projects/{pid}` | Delete Project |
| PATCH | `/api/v1/lab/projects/{pid}` | Update Project |
| GET | `/api/v1/lab/versions/{vid}/download` | Download Version |
| GET | `/api/v1/lab/versions/{vid}/preview` | Preview Version |
| POST | `/api/v1/lab/versions/{vid}/process` | Process Version |
| POST | `/api/v1/lab/vision/compare` | Vision Compare |
| POST | `/api/v1/lab/vision/cracks` | Crack Detection |
| GET | `/api/v1/lab/vision/{rid}/image` | Vision Image |

## digital-twin

| Method | Path | Operation |
|---|---|---|
| POST | `/api/v1/twin/invitations/accept` | Accept Invitation |
| GET | `/api/v1/twin/projects` | My Projects |
| POST | `/api/v1/twin/projects` | Create Project |
| GET | `/api/v1/twin/projects/{project_id}` | Project Detail |
| GET | `/api/v1/twin/projects/{project_id}/access-requests` | List Requests |
| POST | `/api/v1/twin/projects/{project_id}/access-requests` | Request Access |
| POST | `/api/v1/twin/projects/{project_id}/access-requests/{rid}/decide` | Decide |
| GET | `/api/v1/twin/projects/{project_id}/alerts` | List Alerts |
| POST | `/api/v1/twin/projects/{project_id}/alerts/{alert_id}/acknowledge` | Acknowledge |
| POST | `/api/v1/twin/projects/{project_id}/alerts/{alert_id}/close` | Close Alert |
| GET | `/api/v1/twin/projects/{project_id}/audit` | Project Audit |
| GET | `/api/v1/twin/projects/{project_id}/gateways` | List Gateways |
| POST | `/api/v1/twin/projects/{project_id}/gateways` | Create Gateway |
| DELETE | `/api/v1/twin/projects/{project_id}/gateways/{gateway_id}` | Revoke Gateway |
| GET | `/api/v1/twin/projects/{project_id}/invitations` | List Invitations |
| POST | `/api/v1/twin/projects/{project_id}/invitations` | Invite |
| GET | `/api/v1/twin/projects/{project_id}/latest` | Latest Readings |
| GET | `/api/v1/twin/projects/{project_id}/members` | Members |
| DELETE | `/api/v1/twin/projects/{project_id}/members/{user_id}` | Revoke Member |
| PATCH | `/api/v1/twin/projects/{project_id}/members/{user_id}` | Change Role |
| GET | `/api/v1/twin/projects/{project_id}/rules` | List Rules |
| POST | `/api/v1/twin/projects/{project_id}/rules` | Create Rule |
| PATCH | `/api/v1/twin/projects/{project_id}/rules/{rule_id}` | Update Rule |
| GET | `/api/v1/twin/projects/{project_id}/sensors` | List Sensors |
| POST | `/api/v1/twin/projects/{project_id}/sensors` | Create Sensor |
| PATCH | `/api/v1/twin/projects/{project_id}/sensors/{sensor_id}` | Update Sensor |
| POST | `/api/v1/twin/projects/{project_id}/sensors/{sensor_id}/import` | Import History |
| GET | `/api/v1/twin/projects/{project_id}/sensors/{sensor_id}/observations` | Observations |
| GET | `/api/v1/twin/projects/{project_id}/sensors/{sensor_id}/observations.csv` | Export Observations |

## integration

| Method | Path | Operation |
|---|---|---|
| POST | `/api/v1/twin/projects/{project_id}/export-to-lab` | Export To Lab |
| GET | `/api/v1/twin/projects/{project_id}/models` | List Models |
| POST | `/api/v1/twin/projects/{project_id}/models` | Publish Model |
| GET | `/api/v1/twin/projects/{project_id}/models/{model_id}/evaluation` | Model Evaluation |

## ingestion

| Method | Path | Operation |
|---|---|---|
| POST | `/api/v1/ingest/observations` | Ingest |

## admin

| Method | Path | Operation |
|---|---|---|
| GET | `/api/v1/admin/audit` | Audit Log |
| GET | `/api/v1/admin/users` | Users |
| PATCH | `/api/v1/admin/users/{user_id}` | Patch User |

## WebSocket

`GET /api/v1/twin/projects/{project_id}/stream` — authenticated by session cookie; origin-checked; membership (and MFA) re-validated every 30 s.
Messages: `hello`, `heartbeat`, `observation` `{sensor_id, code, t, v, q, unit, source, ingested_at}`, `alert` `{alert}`.

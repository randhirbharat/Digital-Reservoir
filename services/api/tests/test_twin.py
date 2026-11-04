import pyotp
from datetime import datetime, timedelta, timezone

from app.db import SessionLocal
from app.models import User
from app.models_twin import Alert, Observation, Project, ProjectMember, Sensor
from conftest import H, PASSWORD, fastapi_app, last_token, make_user, new_client, system_db
from fastapi.testclient import TestClient


def mfa_user(email: str, superadmin: bool = False) -> TestClient:
    """User with MFA enabled and an MFA-verified session (projects require MFA)."""
    c = make_user(email, superadmin=superadmin)
    secret = c.post("/api/v1/auth/mfa/setup", headers=H).json()["secret"]
    assert c.post("/api/v1/auth/mfa/enable", json={"code": pyotp.TOTP(secret).now()}, headers=H).status_code == 200
    c.secret = secret  # type: ignore[attr-defined]
    return c


def uid(c) -> str:
    return c.get("/api/v1/auth/me").json()["id"]


def seed():
    from app.cli import seed_demo
    with SessionLocal() as db:
        if db.query(Project).filter(Project.code == "PRJ-D").first():
            return
    seed_demo(None, history_days=3)


def pid(code: str) -> str:
    with SessionLocal() as db:
        return db.query(Project).filter(Project.code == code).one().id


def add_member(project_code: str, c, role: str):
    with SessionLocal() as db:
        db.add(ProjectMember(project_id=pid(project_code), user_id=uid(c), role=role))
        db.commit()


def test_project_isolation_and_mfa_requirement():
    seed()
    d, b = pid("PRJ-D"), pid("PRJ-B")
    eng = mfa_user("eng@twin.org")
    add_member("PRJ-D", eng, "project_engineer")
    assert eng.get(f"/api/v1/twin/projects/{d}").status_code == 200
    assert eng.get(f"/api/v1/twin/projects/{b}").status_code == 404          # other project: not disclosed
    assert eng.get(f"/api/v1/twin/projects/{b}/sensors").status_code == 404
    sid = eng.get(f"/api/v1/twin/projects/{d}/sensors").json()[0]["id"]
    assert eng.get(f"/api/v1/twin/projects/{b}/sensors/{sid}/observations").status_code == 404  # URL manipulation
    nomfa = make_user("nomfa@twin.org")
    add_member("PRJ-D", nomfa, "viewer")
    r = nomfa.get(f"/api/v1/twin/projects/{d}")
    assert r.status_code == 403 and "multi-factor" in r.json()["detail"]
    listing = eng.get("/api/v1/twin/projects").json()
    assert [p["code"] for p in listing["projects"]] == ["PRJ-D"] and {x["code"] for x in listing["directory"]} == {"PRJ-A", "PRJ-B", "PRJ-C"}


def test_role_escalation_blocked():
    seed()
    d = pid("PRJ-D")
    viewer = mfa_user("viewer@twin.org")
    add_member("PRJ-D", viewer, "viewer")
    sid = viewer.get(f"/api/v1/twin/projects/{d}/sensors").json()[0]["id"]
    assert viewer.post(f"/api/v1/twin/projects/{d}/sensors", json={"code": "X-1", "name": "x", "sensor_type": "t", "variable": "v", "unit": "mm"}, headers=H).status_code == 403
    assert viewer.patch(f"/api/v1/twin/projects/{d}/members/{uid(viewer)}", json={"role": "project_admin"}, headers=H).status_code == 403
    assert viewer.get(f"/api/v1/twin/projects/{d}/sensors/{sid}/observations.csv").status_code == 403   # export permission
    assert viewer.post(f"/api/v1/twin/projects/{d}/rules", json={"sensor_id": sid, "level": "attention", "comparator": "gt", "threshold": 1, "criteria_reference": "attempt"}, headers=H).status_code == 403
    assert viewer.post("/api/v1/twin/projects", json={"code": "HACK", "name": "Escalation attempt"}, headers=H).status_code == 403
    eng = mfa_user("eng2@twin.org")
    add_member("PRJ-D", eng, "project_engineer")
    assert eng.post(f"/api/v1/twin/projects/{d}/invitations", json={"email": "x@y.org", "role": "viewer"}, headers=H).status_code == 403
    assert eng.get(f"/api/v1/twin/projects/{d}/sensors/{sid}/observations.csv").status_code == 200


def test_revocation_and_invitation_flow():
    seed()
    d = pid("PRJ-D")
    admin = mfa_user("padmin@twin.org")
    add_member("PRJ-D", admin, "project_admin")
    inv = admin.post(f"/api/v1/twin/projects/{d}/invitations", json={"email": "invitee@twin.org", "role": "researcher"}, headers=H)
    assert inv.status_code == 201
    tok = last_token("invitee@twin.org", "invite")
    wrong = mfa_user("other@twin.org")
    assert wrong.post("/api/v1/twin/invitations/accept", json={"token": tok}, headers=H).status_code == 403
    invitee = mfa_user("invitee@twin.org")
    assert invitee.post("/api/v1/twin/invitations/accept", json={"token": tok}, headers=H).json()["role"] == "researcher"
    assert invitee.post("/api/v1/twin/invitations/accept", json={"token": tok}, headers=H).status_code == 400  # single use
    assert invitee.get(f"/api/v1/twin/projects/{d}").status_code == 200
    assert admin.delete(f"/api/v1/twin/projects/{d}/members/{uid(invitee)}", headers=H).status_code == 200
    assert invitee.get(f"/api/v1/twin/projects/{d}").status_code == 401   # sessions terminated
    re = new_client()
    r = re.post("/api/v1/auth/login", json={"email": "invitee@twin.org", "password": PASSWORD}, headers=H).json()
    re.post("/api/v1/auth/login/mfa", json={"mfa_token": r["mfa_token"], "code": pyotp.TOTP(invitee.secret).now()}, headers=H)
    assert re.get(f"/api/v1/twin/projects/{d}").status_code == 404       # access revoked


def test_access_request_workflow():
    seed()
    b = pid("PRJ-B")
    requester = mfa_user("req@twin.org")
    assert requester.post(f"/api/v1/twin/projects/{b}/access-requests", json={"role": "viewer", "justification": "Need read access for QA review."}, headers=H).status_code == 201
    root = mfa_user("root@twin.org", superadmin=True)
    reqs = root.get(f"/api/v1/twin/projects/{b}/access-requests").json()
    rid = next(r["id"] for r in reqs if r["email"] == "req@twin.org")
    assert root.post(f"/api/v1/twin/projects/{b}/access-requests/{rid}/decide", json={"approve": True}, headers=H).status_code == 200
    assert requester.get(f"/api/v1/twin/projects/{b}").json()["role"] == "viewer"


def test_gateway_ingestion_rules_alerts_and_ack():
    seed()
    d = pid("PRJ-D")
    eng = mfa_user("ingest@twin.org")
    add_member("PRJ-D", eng, "project_engineer")
    key = eng.post(f"/api/v1/twin/projects/{d}/gateways", json={"name": "GW-01", "data_source": "live"}, headers=H).json()["key"]
    c = new_client()
    now = datetime.now(timezone.utc)
    assert c.post("/api/v1/ingest/observations", json={"observations": [{"sensor_code": "PZ-03", "ts": now.isoformat(), "value": 40}]}, headers={"X-DR-Gateway-Key": "wrong"}).status_code == 401
    r = c.post("/api/v1/ingest/observations", headers={"X-DR-Gateway-Key": key}, json={"observations": [
        {"sensor_code": "PZ-03", "ts": (now - timedelta(seconds=10)).isoformat(), "value": 42.0, "quality": "good"},
        {"sensor_code": "NOPE", "ts": now.isoformat(), "value": 1},
        {"sensor_code": "PZ-03", "ts": "2030-01-01T00:00:00Z", "value": 1}]})
    body = r.json()
    assert r.status_code == 202 and body["accepted"] == 1 and len(body["rejected"]) == 2
    alerts = eng.get(f"/api/v1/twin/projects/{d}/alerts?status=open").json()
    pz = [a for a in alerts if "PZ-03" in a["message"] and a["source"] == "live"]
    assert {a["severity"] for a in pz} == {"attention", "warning"} and "Demonstration criterion" in pz[0]["message"]
    latest = {x["code"]: x for x in eng.get(f"/api/v1/twin/projects/{d}/latest").json()["readings"]}
    assert latest["PZ-03"]["condition"] == "warning" and latest["PZ-03"]["source"] == "live" and latest["PZ-03"]["unit"] == "m"
    assert latest["RL-01"]["condition"] in ("not_assessed", "unavailable")  # no criteria → never shown as "normal"
    aid = pz[0]["id"]
    assert eng.post(f"/api/v1/twin/projects/{d}/alerts/{aid}/acknowledge", headers=H).json()["status"] == "acknowledged"
    assert eng.post(f"/api/v1/twin/projects/{d}/alerts/{aid}/close", json={"note": ""}, headers=H).status_code == 422
    assert eng.post(f"/api/v1/twin/projects/{d}/alerts/{aid}/close", json={"note": "Checked against PZ-01/05; sensor drift suspected."}, headers=H).json()["status"] == "closed"
    gws = eng.get(f"/api/v1/twin/projects/{d}/gateways").json()
    gw = next(g for g in gws if g["name"] == "GW-01" and not g["revoked_at"])
    eng.delete(f"/api/v1/twin/projects/{d}/gateways/{gw['id']}", headers=H)
    assert c.post("/api/v1/ingest/observations", json={"observations": [{"sensor_code": "PZ-03", "ts": now.isoformat(), "value": 40}]}, headers={"X-DR-Gateway-Key": key}).status_code == 401


def test_observations_downsampling_and_simulator_watchdog():
    seed()
    d = pid("PRJ-D")
    eng = mfa_user("obs@twin.org")
    add_member("PRJ-D", eng, "project_engineer")
    sensors = {s["code"]: s for s in eng.get(f"/api/v1/twin/projects/{d}/sensors").json()}
    end = datetime.now(timezone.utc)
    r = eng.get(f"/api/v1/twin/projects/{d}/sensors/{sensors['PL-01']['id']}/observations", params={"start": (end - timedelta(days=3)).isoformat(), "end": end.isoformat(), "max_points": 20}).json()
    assert r["downsampled"] and len(r["points"]) <= 25 and r["n_total"] > 60 and "simulated" in r["sources"]
    from app.twin.simulator import tick
    assert tick() > 0
    with system_db() as db:
        tm = db.query(Sensor).filter(Sensor.project_id == d, Sensor.code == "TM-12").one()
        assert db.query(Alert).filter(Alert.sensor_id == tm.id, Alert.kind == "communication").count() == 1
        assert db.query(Observation).filter(Observation.project_id == d, Observation.source == "simulated").count() > 0
    latest = {x["code"]: x for x in eng.get(f"/api/v1/twin/projects/{d}/latest").json()["readings"]}
    assert latest["TM-12"]["condition"] == "unavailable" and latest["PL-01"]["comms"] == "online"


def test_websocket_stream_requires_membership():
    seed()
    d = pid("PRJ-D")
    with TestClient(fastapi_app) as outsider_client:
        outsider_client.cookies = new_client().cookies
        try:
            with outsider_client.websocket_connect(f"/api/v1/twin/projects/{d}/stream") as ws:
                ws.receive_json()
            assert False, "unauthenticated websocket should be closed"
        except Exception:
            pass
    member = mfa_user("ws@twin.org")
    add_member("PRJ-D", member, "viewer")
    with TestClient(fastapi_app) as live:
        live.cookies = member.cookies
        with live.websocket_connect(f"/api/v1/twin/projects/{d}/stream") as ws:
            assert ws.receive_json()["type"] == "hello"
            from app.twin.simulator import tick
            live.portal.call(lambda: None)
            tick()
            ev = ws.receive_json()
            assert ev["type"] in ("observation", "alert") and ev.get("source", ev.get("alert", {}).get("source")) == "simulated"

from datetime import datetime, timedelta, timezone

from sqlalchemy import text

from app.db import engine
from app.models_twin import Alert, ModelPublication
from conftest import H, make_user, new_client, system_db
from test_twin import add_member, mfa_user, pid, seed, uid


def _export_and_fit(c, d):
    sensors = {s["code"]: s["id"] for s in c.get(f"/api/v1/twin/projects/{d}/sensors").json()}
    end = datetime.now(timezone.utc)
    r = c.post(f"/api/v1/twin/projects/{d}/export-to-lab", json={"sensor_ids": [sensors["PL-01"], sensors["RL-01"]], "start": (end - timedelta(days=3)).isoformat(), "end": end.isoformat()}, headers=H)
    assert r.status_code == 201, r.text
    ex = r.json()
    assert ex["provenance"] == "simulated" and ex["rows"] > 60
    ds = c.get(f"/api/v1/lab/datasets/{ex['dataset_id']}").json()
    assert ds["units"]["PL-01"] == "mm" and ds["provenance"] == "simulated"
    run = c.post("/api/v1/lab/analyses/hst", json={"dataset_version_id": ds["versions"][0]["id"], "params": {
        "time_col": "timestamp", "response_col": "PL-01", "level_col": "RL-01", "degree": 1, "harmonics": 0, "time_terms": [], "calibration_fraction": 0.8, "unit": "mm"}}, headers=H)
    assert run.status_code == 201, run.text
    return sensors, run.json()


def test_lab_to_twin_round_trip_and_deviation_alert():
    seed()
    d = pid("PRJ-D")
    eng = mfa_user("integ@twin.org")
    add_member("PRJ-D", eng, "project_engineer")
    sensors, run = _export_and_fit(eng, d)
    body = {"run_id": run["id"], "sensor_id": sensors["PL-01"], "level_sensor_id": sensors["RL-01"], "deviation_threshold": 4}
    assert eng.post(f"/api/v1/twin/projects/{d}/models", json={**body, "level_sensor_id": sensors["PZ-03"]}, headers=H).status_code == 422  # not a level sensor
    assert eng.post(f"/api/v1/twin/projects/{d}/models", json={**body, "sensor_id": sensors["PZ-03"]}, headers=H).status_code == 422      # unit mismatch m vs mm
    pub = eng.post(f"/api/v1/twin/projects/{d}/models", json=body, headers=H)
    assert pub.status_code == 201, pub.text
    m = pub.json()
    assert m["version"] == 1 and m["calibration_data_provenance"] == "simulated"
    ev = eng.get(f"/api/v1/twin/projects/{d}/models/{m['id']}/evaluation").json()
    assert ev["n"] > 10 and any("simulated data" in w for w in ev["warnings"])
    # republish → version 2, previous deactivated
    m2 = eng.post(f"/api/v1/twin/projects/{d}/models", json=body, headers=H).json()
    assert m2["version"] == 2 and [x["active"] for x in eng.get(f"/api/v1/twin/projects/{d}/models").json()] == [True, False]
    # live readings far from the model raise one model-deviation alert
    key = eng.post(f"/api/v1/twin/projects/{d}/gateways", json={"name": "GW-int"}, headers=H).json()["key"]
    now = datetime.now(timezone.utc)
    r = new_client().post("/api/v1/ingest/observations", headers={"X-DR-Gateway-Key": key}, json={"observations": [
        {"sensor_code": "RL-01", "ts": (now - timedelta(seconds=5)).isoformat(), "value": 605.0, "quality": "good"},
        {"sensor_code": "PL-01", "ts": now.isoformat(), "value": 60.0, "quality": "good"}]})
    assert r.json()["accepted"] == 2
    with system_db() as db:
        dev = db.query(Alert).filter(Alert.kind == "model_deviation").all()
        assert len(dev) == 1 and "HST v2" in dev[0].message


def test_publication_requires_ownership_and_role():
    seed()
    d = pid("PRJ-D")
    owner = mfa_user("owner@int.org")
    add_member("PRJ-D", owner, "project_engineer")
    sensors, run = _export_and_fit(owner, d)
    other = mfa_user("other-eng@int.org")
    add_member("PRJ-D", other, "project_engineer")
    body = {"run_id": run["id"], "sensor_id": sensors["PL-01"], "level_sensor_id": sensors["RL-01"]}
    assert other.post(f"/api/v1/twin/projects/{d}/models", json=body, headers=H).status_code == 404   # not their run
    researcher = mfa_user("res@int.org")
    add_member("PRJ-D", researcher, "researcher")
    assert researcher.post(f"/api/v1/twin/projects/{d}/models", json=body, headers=H).status_code == 403
    viewer = mfa_user("view@int.org")
    add_member("PRJ-D", viewer, "viewer")
    end = datetime.now(timezone.utc)
    assert viewer.post(f"/api/v1/twin/projects/{d}/export-to-lab", json={"sensor_ids": [sensors["PL-01"]], "start": (end - timedelta(days=1)).isoformat(), "end": end.isoformat()}, headers=H).status_code == 403
    outsider = mfa_user("outsider@int.org")
    assert outsider.get(f"/api/v1/twin/projects/{d}/models").status_code == 404


def test_database_row_level_security():
    if engine.dialect.name != "postgresql":
        import pytest
        pytest.skip("RLS is PostgreSQL-only")
    seed()
    d = pid("PRJ-D")
    member = mfa_user("rls-member@int.org")
    add_member("PRJ-D", member, "viewer")
    stranger = make_user("rls-stranger@int.org")

    def count(**ctx):
        with engine.begin() as conn:
            for k, v in ctx.items():
                conn.execute(text("select set_config(:k, :v, true)"), {"k": f"app.{k}", "v": v})
            return conn.execute(text("select count(*) from sensor where project_id = :p"), {"p": d}).scalar()

    assert count() == 0                                    # no context → nothing visible
    assert count(user_id=uid(stranger)) == 0               # authenticated non-member → nothing
    assert count(user_id=uid(member)) == 12                # member → project rows
    assert count(gateway_project="some-other-project") == 0
    assert count(bypass="on") == 12
    with engine.begin() as conn:                           # writes are checked too
        conn.execute(text("select set_config('app.user_id', :u, true)"), {"u": uid(stranger)})
        try:
            conn.execute(text("insert into alert (id, project_id, kind, severity, message, source, status, created_at) values ('x', :p, 'threshold', 'attention', 'forged', 'live', 'open', now())"), {"p": d})
            raise AssertionError("insert should be refused by RLS")
        except Exception as exc:  # noqa: BLE001
            assert "row-level security" in str(exc)

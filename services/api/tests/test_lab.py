from pathlib import Path

from conftest import H, make_user

DATA = Path(__file__).resolve().parents[3] / "datasets" / "demo_gravity_dam_daily.csv"


def upload(c, name="dam.csv", content=None):
    return c.post("/api/v1/lab/datasets", files={"file": (name, content if content is not None else DATA.read_bytes(), "text/csv")},
                  data={"provenance": "synthetic"}, headers=H)


def test_upload_preview_process_versioning_and_download():
    c = make_user("lab1@example.org")
    pid = c.post("/api/v1/lab/projects", json={"name": "Dam study"}, headers=H).json()["id"]
    r = upload(c)
    assert r.status_code == 201, r.text
    ds = r.json()
    v1 = ds["versions"][0]
    assert v1["is_original"] and v1["rows"] == 1098 and ds["time_column"] == "timestamp"
    prev = c.get(f"/api/v1/lab/versions/{v1['id']}/preview?rows=5").json()
    assert len(prev["rows"]) == 5 and prev["columns"][0] == "timestamp"
    r = c.post(f"/api/v1/lab/versions/{v1['id']}/process", json={"label": "Cleaned", "operations": [
        {"operation": "drop_duplicates"}, {"operation": "flag_outliers_to_missing", "params": {"column": "PL01_disp_mm"}}]}, headers=H)
    assert r.status_code == 201, r.text
    v2 = r.json()
    assert v2["version"] == 2 and v2["parent_version_id"] == v1["id"] and v2["rows"] == 1095 and len(v2["processing"]) == 3
    again = c.get(f"/api/v1/lab/datasets/{ds['id']}").json()
    assert again["versions"][0]["sha256"] == v1["sha256"]  # original untouched
    dl = c.get(f"/api/v1/lab/versions/{v1['id']}/download")
    assert dl.status_code == 200 and dl.content == DATA.read_bytes()
    c.patch(f"/api/v1/lab/datasets/{ds['id']}", json={"project_id": pid}, headers=H)
    assert c.get("/api/v1/lab/projects").json()[0]["dataset_count"] == 1


def test_invalid_uploads_rejected():
    c = make_user("lab2@example.org")
    assert upload(c, "evil.exe", b"MZ\x90\x00").status_code == 415
    assert upload(c, "bin.csv", b"\x00\x01\x02\x03binary").status_code == 415
    assert upload(c, "fake.xlsx", b"not a zip").status_code == 415
    assert upload(c, "empty.csv", b"# comment only\n").status_code == 422


def test_cross_user_isolation():
    a = make_user("owner@example.org")
    b = make_user("intruder@example.org")
    ds = upload(a).json()
    vid = ds["versions"][0]["id"]
    assert b.get(f"/api/v1/lab/datasets/{ds['id']}").status_code == 404
    assert b.get(f"/api/v1/lab/versions/{vid}/download").status_code == 404
    assert b.post(f"/api/v1/lab/versions/{vid}/process", json={"operations": [{"operation": "drop_duplicates"}]}, headers=H).status_code == 404
    assert b.post("/api/v1/lab/analyses/quality", json={"dataset_version_id": vid, "params": {}}, headers=H).status_code == 404
    run = a.post("/api/v1/lab/analyses/descriptive", json={"dataset_version_id": vid, "params": {"columns": ["PL01_disp_mm"]}}, headers=H).json()
    assert b.get(f"/api/v1/lab/analyses/{run['id']}").status_code == 404
    assert b.get(f"/api/v1/lab/analyses/{run['id']}/report").status_code == 404
    assert b.delete(f"/api/v1/lab/datasets/{ds['id']}", headers=H).status_code == 404


def test_hst_run_report_export_and_reopen():
    c = make_user("hst@example.org")
    vid = upload(c).json()["versions"][0]["id"]
    r = c.post("/api/v1/lab/analyses/hst", json={"dataset_version_id": vid, "params": {"time_col": "timestamp", "response_col": "PL01_disp_mm", "level_col": "reservoir_level_m",
                                                                                        "degree": 2, "harmonics": 1, "time_terms": ["log"], "calibration_fraction": 0.75, "unit": "mm"}}, headers=H)
    assert r.status_code == 201, r.text
    run = r.json()
    res = run["result"]
    assert res["metrics"]["validation"]["n"] > 0 and res["data_provenance"] == "synthetic"
    assert c.get("/api/v1/lab/analyses").json()[0]["id"] == run["id"]
    reopened = c.get(f"/api/v1/lab/analyses/{run['id']}").json()
    assert reopened["result"]["formula"] == res["formula"]
    html = c.get(f"/api/v1/lab/analyses/{run['id']}/report")
    assert html.status_code == 200 and "Engineering interpretation" in html.text and "synthetic" in html.text
    csv = c.get(f"/api/v1/lab/analyses/{run['id']}/export.csv")
    assert csv.status_code == 200 and "observed" in csv.text.splitlines()[1]


def test_membership_permissions_enforced():
    g = make_user("general@example.org", category="general")
    vid = upload(g).json()["versions"][0]["id"]
    r = g.post("/api/v1/lab/analyses/ml", json={"dataset_version_id": vid, "params": {"target": "PL01_disp_mm", "features": ["reservoir_level_m"], "models": [{"model": "linear"}]}}, headers=H)
    assert r.status_code == 403
    cat = g.get("/api/v1/lab/analyses/catalogue").json()
    assert {a["kind"]: a["allowed"] for a in cat["analyses"]}["ml"] is False


def test_ml_and_failed_analysis_messages():
    c = make_user("ml@example.org", category="researcher")
    vid = upload(c).json()["versions"][0]["id"]
    r = c.post("/api/v1/lab/analyses/ml", json={"dataset_version_id": vid, "params": {"time_col": "timestamp", "target": "PL01_disp_mm", "features": ["reservoir_level_m", "air_temp_C"],
                                                                                       "models": [{"model": "ridge"}, {"model": "gradient_boosting", "params": {"n_estimators": 60}}], "seasonal_features": True}}, headers=H)
    assert r.status_code == 201, r.text
    assert len(r.json()["result"]["ranking"]) == 2
    bad = c.post("/api/v1/lab/analyses/regression", json={"dataset_version_id": vid, "params": {"target": "nope", "features": ["reservoir_level_m"]}}, headers=H)
    assert bad.status_code == 422 and "not found" in bad.json()["detail"]


def test_advanced_modules_and_vision_review():
    import io as _io
    import numpy as np
    from PIL import Image
    DATASETS = Path(__file__).resolve().parents[3] / "datasets"
    c = make_user("adv@example.org", category="researcher")
    vib = c.post("/api/v1/lab/datasets", files={"file": ("vib.csv", (DATASETS / "demo_ambient_vibration_100Hz.csv").read_bytes(), "text/csv")}, data={"provenance": "synthetic"}, headers=H).json()
    r = c.post("/api/v1/lab/analyses/modal", json={"dataset_version_id": vib["versions"][0]["id"], "params": {"channels": ["ACC1_mg", "ACC2_mg"], "time_col": "time_s", "f_max": 20, "n_modes": 2}}, headers=H)
    assert r.status_code == 201, r.text
    assert sorted(round(m["frequency_hz"]) for m in r.json()["result"]["modes"]) == [3, 8]
    frag = c.post("/api/v1/lab/datasets", files={"file": ("f.csv", (DATASETS / "demo_fragility_stripes.csv").read_bytes(), "text/csv")}, data={"provenance": "synthetic"}, headers=H).json()
    r = c.post("/api/v1/lab/analyses/fragility", json={"dataset_version_id": frag["versions"][0]["id"], "params": {"method": "mle", "n_boot": 50}}, headers=H)
    assert r.status_code == 201 and r.json()["result"]["beta"] > 0
    rng = np.random.default_rng(3)
    img = 0.62 + 0.04 * rng.normal(size=(300, 400))
    xs = np.arange(40, 360); ys = (150 + 40 * np.sin(xs / 60)).astype(int)
    for x, y in zip(xs, ys):
        img[y - 1:y + 2, x] -= 0.4
    buf = _io.BytesIO(); Image.fromarray((np.clip(img, 0, 1) * 255).astype(np.uint8)).save(buf, format="PNG")
    r = c.post("/api/v1/lab/vision/cracks", files={"file": ("wall.png", buf.getvalue(), "image/png")}, data={"mm_per_pixel": "0.5", "component": "Downstream face"}, headers=H)
    assert r.status_code == 201, r.text
    run = r.json()
    assert run["result"]["status"] == "model_output_unverified" and run["result"]["n_candidates"] >= 1
    assert c.get(f"/api/v1/lab/vision/{run['id']}/image").content == buf.getvalue()
    assert c.post("/api/v1/lab/vision/cracks", files={"file": ("x.png", b"GIF89a....", "image/png")}, headers=H).status_code == 415
    rv = c.post(f"/api/v1/lab/analyses/{run['id']}/review", json={"verdict": "confirmed", "note": "Confirmed on site 2026-11-04.", "confirmed_ids": [1]}, headers=H).json()
    assert rv["result"]["status"] == "engineer_reviewed_confirmed" and rv["result"]["review"]["reviewer"]
    g = make_user("gen-adv@example.org", category="general")
    assert g.post("/api/v1/lab/vision/cracks", files={"file": ("wall.png", buf.getvalue(), "image/png")}, headers=H).status_code == 403

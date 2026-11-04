"""Engineering Lab API: projects, datasets (immutable originals + processed versions), analyses, exports, reports.

Ownership is enforced in every query: a user can only see and modify their own Lab objects.
"""
from __future__ import annotations

import io
import time
from collections import OrderedDict
from pathlib import Path
from typing import Any

import pandas as pd
from fastapi import APIRouter, Depends, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import HTMLResponse, Response
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session

from dr_analytics import ENGINE_VERSION, anomaly, dhi, fragility, hst, hybrid, io as dio, ml, modal, quality, signal_proc, stats, vision
from dr_analytics.common import AnalysisError

from ..audit import audit
from ..db import get_db
from ..deps import Principal, require_lab, upload_limit_bytes
from ..models import AnalysisRun, Dataset, DatasetVersion, LabProject, uid
from ..report import render
from ..storage import get_storage, sha256

router = APIRouter(prefix="/lab", tags=["engineering-lab"])
SAMPLES_DIR = Path(__file__).resolve().parents[4] / "datasets"
SAMPLES = {
    "gravity_dam_daily": ("demo_gravity_dam_daily.csv", "Synthetic gravity dam — daily monitoring", "timestamp",
                          {"PL01_disp_mm": "mm", "reservoir_level_m": "m a.s.l.", "air_temp_C": "°C", "PZ03_head_m": "m", "V02_seepage_Ls": "L/s"}),
    "ambient_vibration": ("demo_ambient_vibration_100Hz.csv", "Synthetic ambient vibration — 100 Hz", None, {"ACC1_mg": "mg", "ACC2_mg": "mg", "time_s": "s"}),
    "fragility_stripes": ("demo_fragility_stripes.csv", "Synthetic multiple-stripe analysis results", None, {"pga_g": "g"}),
}

# ------------------------------------------------------------------ helpers

_cache: OrderedDict[str, pd.DataFrame] = OrderedDict()


def load_version(v: DatasetVersion) -> pd.DataFrame:
    if v.id in _cache:
        _cache.move_to_end(v.id)
        return _cache[v.id].copy()
    data = get_storage().get(v.storage_key)
    df, _ = dio.read_table(data, "data.xlsx" if v.file_format == "xlsx" else "data.csv")
    _cache[v.id] = df
    if len(_cache) > 16:
        _cache.popitem(last=False)
    return df.copy()


def _own_project(db: Session, user_id: str, pid: str | None) -> LabProject | None:
    if not pid:
        return None
    p = db.query(LabProject).filter(LabProject.id == pid, LabProject.owner_id == user_id).one_or_none()
    if not p:
        raise HTTPException(404, "Project not found.")
    return p


def _own_dataset(db: Session, user_id: str, did: str) -> Dataset:
    d = db.query(Dataset).filter(Dataset.id == did, Dataset.owner_id == user_id).one_or_none()
    if not d:
        raise HTTPException(404, "Dataset not found.")
    return d


def _own_version(db: Session, user_id: str, vid: str) -> tuple[DatasetVersion, Dataset]:
    row = db.query(DatasetVersion, Dataset).join(Dataset).filter(DatasetVersion.id == vid, Dataset.owner_id == user_id).one_or_none()
    if not row:
        raise HTTPException(404, "Dataset version not found.")
    return row


def version_json(v: DatasetVersion) -> dict:
    return {"id": v.id, "version": v.version, "label": v.label, "is_original": v.is_original, "rows": v.rows, "columns": v.columns, "sha256": v.sha256,
            "size_bytes": v.size_bytes, "created_at": v.created_at.isoformat(), "processing": v.processing, "parent_version_id": v.parent_id, "validation": v.validation}


def dataset_json(d: Dataset) -> dict:
    return {"id": d.id, "name": d.name, "filename": d.filename, "provenance": d.provenance, "description": d.description, "project_id": d.lab_project_id,
            "time_column": d.time_column, "units": d.units, "created_at": d.created_at.isoformat(), "versions": [version_json(v) for v in d.versions]}


def run_json(r: AnalysisRun, full: bool = True) -> dict:
    out = {"id": r.id, "kind": r.kind, "title": r.title, "dataset_version_id": r.dataset_version_id, "project_id": r.lab_project_id, "params": r.params,
           "status": r.status, "error": r.error, "created_at": r.created_at.isoformat(), "duration_ms": r.duration_ms, "engine_version": r.engine_version}
    if full:
        out["result"] = r.result
    return out


def _store_version(db: Session, ds: Dataset, data: bytes, fmt: str, label: str, is_original: bool, parent: str | None, processing: list, validation: dict, df: pd.DataFrame) -> DatasetVersion:
    n = (db.query(func.max(DatasetVersion.version)).filter(DatasetVersion.dataset_id == ds.id).scalar() or 0) + 1
    key = f"datasets/{ds.owner_id}/{ds.id}/v{n}-{uid()[:8]}.{fmt}"
    get_storage().put(key, data)
    v = DatasetVersion(dataset_id=ds.id, version=n, parent_id=parent, label=label, is_original=is_original, storage_key=key, file_format=fmt, sha256=sha256(data),
                       size_bytes=len(data), rows=int(len(df)), columns=dio.profile_columns(df), processing=processing, validation=validation)
    db.add(v)
    db.commit()
    db.refresh(ds)
    return v

# ------------------------------------------------------------------ projects


class ProjectIn(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    description: str = Field(default="", max_length=5000)


@router.get("/projects")
def list_projects(p: Principal = Depends(require_lab("lab.datasets")), db: Session = Depends(get_db)):
    rows = db.query(LabProject).filter(LabProject.owner_id == p.user.id).order_by(LabProject.updated_at.desc()).all()
    counts_d = dict(db.query(Dataset.lab_project_id, func.count()).filter(Dataset.owner_id == p.user.id).group_by(Dataset.lab_project_id).all())
    counts_a = dict(db.query(AnalysisRun.lab_project_id, func.count()).filter(AnalysisRun.owner_id == p.user.id).group_by(AnalysisRun.lab_project_id).all())
    return [{"id": r.id, "name": r.name, "description": r.description, "created_at": r.created_at.isoformat(), "updated_at": r.updated_at.isoformat(),
             "dataset_count": counts_d.get(r.id, 0), "analysis_count": counts_a.get(r.id, 0)} for r in rows]


@router.post("/projects", status_code=201)
def create_project(body: ProjectIn, request: Request, p: Principal = Depends(require_lab("lab.datasets")), db: Session = Depends(get_db)):
    pr = LabProject(owner_id=p.user.id, name=body.name.strip(), description=body.description)
    db.add(pr)
    db.commit()
    audit(db, "lab.project_created", user_id=p.user.id, target=pr.id, request=request)
    return {"id": pr.id, "name": pr.name}


@router.patch("/projects/{pid}")
def update_project(pid: str, body: ProjectIn, p: Principal = Depends(require_lab("lab.datasets")), db: Session = Depends(get_db)):
    pr = _own_project(db, p.user.id, pid)
    pr.name, pr.description = body.name.strip(), body.description
    db.commit()
    return {"id": pr.id, "name": pr.name}


@router.delete("/projects/{pid}")
def delete_project(pid: str, request: Request, p: Principal = Depends(require_lab("lab.datasets")), db: Session = Depends(get_db)):
    pr = _own_project(db, p.user.id, pid)
    db.delete(pr)  # datasets and runs are kept and become unassigned (ON DELETE SET NULL)
    db.commit()
    audit(db, "lab.project_deleted", user_id=p.user.id, target=pid, request=request)
    return {"message": "Project deleted; its datasets and analyses are kept as unassigned."}

# ------------------------------------------------------------------ datasets


@router.post("/datasets", status_code=201)
async def upload_dataset(request: Request, file: UploadFile = File(...), name: str = Form(""), project_id: str = Form(""), provenance: str = Form("historical"),
                         description: str = Form(""), p: Principal = Depends(require_lab("lab.datasets")), db: Session = Depends(get_db)):
    if provenance not in {"historical", "imported", "synthetic"}:
        raise HTTPException(422, "Provenance must be historical (measured), imported (third-party) or synthetic.")
    fname = Path(file.filename or "upload.csv").name[:300]
    ext = fname.lower().rsplit(".", 1)[-1]
    if ext not in {"csv", "txt", "xlsx"}:
        raise HTTPException(415, "Only .csv, .txt and .xlsx files are accepted.")
    limit = upload_limit_bytes(p.user)
    data = await file.read(limit + 1)
    if len(data) > limit:
        raise HTTPException(413, f"File exceeds your upload limit of {limit // (1024 * 1024)} MB.")
    if ext == "xlsx" and not data.startswith(b"PK"):
        raise HTTPException(415, "File content does not match the .xlsx format.")
    if ext in {"csv", "txt"} and b"\x00" in data[:4096]:
        raise HTTPException(415, "File appears to be binary, not text CSV.")
    # Malware-scanning integration point: pass `data` to a scanner (e.g. ClamAV via clamd) before storing.
    try:
        df, report = dio.read_table(data, fname)
    except AnalysisError as exc:
        audit(db, "lab.upload_rejected", user_id=p.user.id, outcome="failure", request=request, filename=fname, reason=str(exc))
        raise HTTPException(422, str(exc)) from exc
    _own_project(db, p.user.id, project_id or None)
    cols = dio.profile_columns(df)
    ds = Dataset(owner_id=p.user.id, lab_project_id=project_id or None, name=(name or fname).strip()[:200], filename=fname, provenance=provenance,
                 description=description[:5000], time_column=dio.guess_time_column(cols))
    db.add(ds)
    db.commit()
    v = _store_version(db, ds, data, "xlsx" if ext == "xlsx" else "csv", "Original upload", True, None,
                       [{"operation": "upload", "params": {"filename": fname}, "summary": f"Uploaded {report['rows']} rows × {report['columns']} columns ({report['format']}).", "at": v_now()}], report, df)
    audit(db, "lab.dataset_uploaded", user_id=p.user.id, target=ds.id, request=request, rows=report["rows"], sha256=v.sha256)
    return dataset_json(ds)


def v_now() -> str:
    from ..security import utcnow
    return utcnow().isoformat()


@router.post("/datasets/samples/{sample}", status_code=201)
def import_sample(sample: str, request: Request, project_id: str = "", p: Principal = Depends(require_lab("lab.datasets")), db: Session = Depends(get_db)):
    if sample not in SAMPLES:
        raise HTTPException(404, "Unknown sample dataset.")
    fname, title, tcol, units = SAMPLES[sample]
    data = (SAMPLES_DIR / fname).read_bytes()
    df, report = dio.read_table(data, fname)
    _own_project(db, p.user.id, project_id or None)
    ds = Dataset(owner_id=p.user.id, lab_project_id=project_id or None, name=title, filename=fname, provenance="synthetic",
                 description="Synthetic example generated by datasets/generate_synthetic.py. Not a real structure.", time_column=tcol, units=units)
    db.add(ds)
    db.commit()
    _store_version(db, ds, data, "csv", "Original (synthetic sample)", True, None, [{"operation": "import_sample", "params": {"sample": sample}, "summary": "Imported synthetic sample dataset.", "at": v_now()}], report, df)
    audit(db, "lab.sample_imported", user_id=p.user.id, target=ds.id, request=request, sample=sample)
    return dataset_json(ds)


@router.get("/datasets")
def list_datasets(project_id: str | None = None, p: Principal = Depends(require_lab("lab.datasets")), db: Session = Depends(get_db)):
    q = db.query(Dataset).filter(Dataset.owner_id == p.user.id)
    if project_id:
        q = q.filter(Dataset.lab_project_id == project_id)
    return [dataset_json(d) for d in q.order_by(Dataset.created_at.desc())]


class DatasetPatch(BaseModel):
    name: str | None = Field(default=None, max_length=200)
    description: str | None = Field(default=None, max_length=5000)
    project_id: str | None = None
    time_column: str | None = None
    units: dict[str, str] | None = None
    sensors: dict[str, str] | None = None


@router.patch("/datasets/{did}")
def patch_dataset(did: str, body: DatasetPatch, p: Principal = Depends(require_lab("lab.datasets")), db: Session = Depends(get_db)):
    d = _own_dataset(db, p.user.id, did)
    if body.project_id is not None:
        _own_project(db, p.user.id, body.project_id or None)
        d.lab_project_id = body.project_id or None
    for f in ("name", "description", "time_column", "units", "sensors"):
        v = getattr(body, f)
        if v is not None:
            setattr(d, f, v)
    db.commit()
    return dataset_json(d)


@router.get("/datasets/{did}")
def get_dataset(did: str, p: Principal = Depends(require_lab("lab.datasets")), db: Session = Depends(get_db)):
    return dataset_json(_own_dataset(db, p.user.id, did))


@router.delete("/datasets/{did}")
def delete_dataset(did: str, request: Request, p: Principal = Depends(require_lab("lab.datasets")), db: Session = Depends(get_db)):
    d = _own_dataset(db, p.user.id, did)
    keys = [v.storage_key for v in d.versions]
    db.delete(d)
    db.commit()
    for k in keys:
        get_storage().delete(k)
    audit(db, "lab.dataset_deleted", user_id=p.user.id, target=did, request=request)
    return {"message": "Dataset and all versions deleted."}


@router.get("/versions/{vid}/preview")
def preview_version(vid: str, rows: int = 50, p: Principal = Depends(require_lab("lab.datasets")), db: Session = Depends(get_db)):
    v, _ = _own_version(db, p.user.id, vid)
    return dio.preview(load_version(v), min(max(rows, 1), 500))


@router.get("/versions/{vid}/download")
def download_version(vid: str, request: Request, p: Principal = Depends(require_lab("lab.datasets")), db: Session = Depends(get_db)):
    v, d = _own_version(db, p.user.id, vid)
    audit(db, "lab.export_dataset", user_id=p.user.id, target=vid, request=request)
    media = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" if v.file_format == "xlsx" else "text/csv"
    name = f"{Path(d.filename).stem}_v{v.version}.{v.file_format}"
    return Response(get_storage().get(v.storage_key), media_type=media, headers={"Content-Disposition": f'attachment; filename="{name}"', "X-Content-SHA256": v.sha256})


class ProcessIn(BaseModel):
    operations: list[dict[str, Any]] = Field(min_length=1, max_length=20)
    label: str = Field(default="Processed", max_length=200)


@router.post("/versions/{vid}/process", status_code=201)
def process_version(vid: str, body: ProcessIn, request: Request, p: Principal = Depends(require_lab("lab.quality")), db: Session = Depends(get_db)):
    """Apply documented operations to a version and store the result as a NEW version. The source is unchanged."""
    v, d = _own_version(db, p.user.id, vid)
    df = load_version(v)
    try:
        out, history = quality.apply_operations(df, body.operations)
    except AnalysisError as exc:
        raise HTTPException(422, str(exc)) from exc
    now = v_now()
    history = [{**h, "at": now} for h in history]
    buf = io.StringIO()
    buf.write(f"# Digital Reservoir processed version derived from {d.filename} v{v.version} (sha256 {v.sha256[:12]}); provenance: {d.provenance}\n")
    out.to_csv(buf, index=False, date_format="%Y-%m-%dT%H:%M:%SZ")
    data = buf.getvalue().encode()
    nv = _store_version(db, d, data, "csv", body.label, False, v.id, list(v.processing) + history, {"rows": int(len(out)), "derived_from": v.id}, out)
    audit(db, "lab.dataset_processed", user_id=p.user.id, target=nv.id, request=request, operations=[o.get("operation") for o in body.operations])
    return version_json(nv)

# ------------------------------------------------------------------ analyses

ANALYSES: dict[str, tuple[str, str]] = {
    # kind: (permission, title)
    "quality": ("lab.quality", "Data-quality assessment"),
    "signal": ("lab.signal", "Signal processing"),
    "descriptive": ("lab.statistics", "Descriptive statistics"),
    "correlation": ("lab.statistics", "Correlation analysis"),
    "regression": ("lab.statistics", "Regression analysis"),
    "pca": ("lab.statistics", "Principal component analysis"),
    "factor": ("lab.statistics", "Factor analysis"),
    "timeseries": ("lab.statistics", "Time-series diagnostics"),
    "hypothesis": ("lab.statistics", "Hypothesis test"),
    "hst": ("lab.hst", "HST analysis"),
    "ml": ("lab.ml", "ML model comparison"),
    "anomaly_zscore": ("lab.anomaly", "Residual z-score screening"),
    "anomaly_cusum": ("lab.anomaly", "CUSUM change detection"),
    "anomaly_changepoint": ("lab.anomaly", "Change-point detection"),
    "anomaly_multivariate": ("lab.anomaly", "Multivariate novelty detection"),
    "dhi": ("lab.dhi", "Dam Health Index"),
    "hybrid": ("lab.advanced", "Hybrid physics–ML model"),
    "fragility": ("lab.advanced", "Fragility analysis"),
    "modal": ("lab.advanced", "Operational modal analysis"),
}


def _dispatch(kind: str, df: pd.DataFrame | None, prm: dict) -> dict:
    tc = prm.get("time_col") or None
    if kind == "quality":
        return quality.assess(df, tc, float(prm.get("mad_threshold", 5.0)), float(prm.get("gap_factor", 3.0)), prm.get("outlier_method"), int(prm.get("window", 11)))
    if kind == "signal":
        return signal_proc.run(df, prm["column"], time_col=tc, x_col=prm.get("x_col"), operations=prm.get("operations", []), fs_hz=prm.get("fs_hz"),
                               spectra=prm.get("spectra", True), wavelet=prm.get("wavelet", False), stl_period=prm.get("stl_period"))
    if kind == "descriptive":
        return stats.descriptive(df, prm["columns"])
    if kind == "correlation":
        return stats.correlation(df, prm["columns"], prm.get("method", "pearson"))
    if kind == "regression":
        return stats.regression(df, prm["target"], prm["features"], int(prm.get("polynomial_degree", 1)), tc, float(prm.get("alpha", 0.05)))
    if kind == "pca":
        return stats.pca(df, prm["columns"], bool(prm.get("standardize", True)), prm.get("n_components"), tc)
    if kind == "factor":
        return stats.factor_analysis(df, prm["columns"], int(prm.get("n_factors", 2)))
    if kind == "timeseries":
        return stats.timeseries(df, prm["column"], tc, int(prm.get("nlags", 40)))
    if kind == "hypothesis":
        return stats.hypothesis_test(df, prm["test"], prm["a"], prm.get("b"), float(prm.get("mu", 0)))
    if kind == "hst":
        return hst.fit(df, prm["time_col"], prm["response_col"], prm["level_col"], temperature_col=prm.get("temperature_col") or None,
                       degree=int(prm.get("degree", 4)), harmonics=int(prm.get("harmonics", 2)), time_terms=prm.get("time_terms"),
                       temp_lags=prm.get("temp_lags"), calibration_fraction=float(prm.get("calibration_fraction", 0.8)), calibration_end=prm.get("calibration_end") or None,
                       H_max=prm.get("H_max"), H_min=prm.get("H_min"), alpha=float(prm.get("alpha", 0.05)), residual_threshold=float(prm.get("residual_threshold", 2.5)),
                       response_unit=prm.get("unit", ""))
    if kind == "ml":
        return ml.compare(df, prm["target"], prm.get("features", []), prm["models"], time_col=tc, scheme=prm.get("scheme", "holdout"),
                          calibration_fraction=float(prm.get("calibration_fraction", 0.8)), n_folds=int(prm.get("n_folds", 5)), test_fraction=float(prm.get("test_fraction", 0.2)),
                          lags=prm.get("lags"), seasonal_features=bool(prm.get("seasonal_features", False)), trend_feature=bool(prm.get("trend_feature", False)),
                          interval_alpha=float(prm.get("interval_alpha", 0.1)))
    if kind == "anomaly_zscore":
        return anomaly.residual_zscore(df, prm["column"], tc, float(prm.get("threshold", 3.0)), float(prm.get("baseline_fraction", 0.5)))
    if kind == "anomaly_cusum":
        return anomaly.cusum(df, prm["column"], tc, float(prm.get("k", 0.5)), float(prm.get("h", 5.0)), float(prm.get("baseline_fraction", 0.5)))
    if kind == "anomaly_changepoint":
        return anomaly.change_points(df, prm["column"], tc, int(prm.get("max_changes", 5)), int(prm.get("min_size", 10)))
    if kind == "anomaly_multivariate":
        return anomaly.multivariate(df, prm["columns"], tc, prm.get("method", "mahalanobis"), float(prm.get("baseline_fraction", 0.5)), float(prm.get("alpha", 0.001)), float(prm.get("contamination", 0.01)))
    if kind == "dhi":
        return dhi.compute(prm["indicators"], weights=prm.get("weights"), ahp_matrix=prm.get("ahp_matrix"), aggregation=prm.get("aggregation", "arithmetic"),
                           classes=prm.get("classes"), weight_justification=prm.get("weight_justification", ""), df=df, time_col=tc, periods=prm.get("periods"))
    if kind == "hybrid":
        return hybrid.fit(df, prm["time_col"], prm["response_col"], prm["level_col"], prm.get("residual_features", []), physics_col=prm.get("physics_col") or None,
                          degree=int(prm.get("degree", 3)), harmonics=int(prm.get("harmonics", 2)), time_terms=prm.get("time_terms"),
                          calibration_fraction=float(prm.get("calibration_fraction", 0.8)), n_estimators=int(prm.get("n_estimators", 300)),
                          learning_rate=float(prm.get("learning_rate", 0.05)), max_depth=int(prm.get("max_depth", 3)), unit=prm.get("unit", ""))
    if kind == "fragility":
        return fragility.fit(df, method=prm.get("method", "mle"), im_col=prm.get("im_col", "pga_g"), outcome_col=prm.get("outcome_col", "exceeds_ds2") or None, capacity_col=prm.get("capacity_col") or None,
                             record_col=prm.get("record_col", "record_id") or None, edp_col=prm.get("edp_col") or None, edp_threshold=prm.get("edp_threshold"),
                             n_boot=min(int(prm.get("n_boot", 300)), 2000), damage_state=prm.get("damage_state", "DS"), im_label=prm.get("im_label", "IM"))
    if kind == "modal":
        return modal.identify(df, prm["channels"], fs_hz=prm.get("fs_hz"), time_col=prm.get("time_col") or None, f_max=prm.get("f_max"), n_modes=int(prm.get("n_modes", 4)))
    raise AnalysisError(f"Unknown analysis '{kind}'.")


class RunIn(BaseModel):
    dataset_version_id: str | None = None
    project_id: str | None = None
    title: str | None = Field(default=None, max_length=300)
    params: dict[str, Any] = Field(default_factory=dict)
    save: bool = True


@router.get("/analyses/catalogue")
def catalogue(p: Principal = Depends(require_lab("lab.datasets"))):
    perms = p.lab_permissions
    return {"analyses": [{"kind": k, "title": t, "permission": perm, "allowed": perm in perms} for k, (perm, t) in ANALYSES.items()],
            "ml_library": ml.library(), "processing_operations": sorted(quality.OPERATIONS), "engine_version": ENGINE_VERSION}


@router.post("/analyses/{kind}", status_code=201)
def run_analysis(kind: str, body: RunIn, request: Request, p: Principal = Depends(require_lab("lab.datasets")), db: Session = Depends(get_db)):
    if kind not in ANALYSES:
        raise HTTPException(404, "Unknown analysis type.")
    perm, title = ANALYSES[kind]
    if perm not in p.lab_permissions:
        audit(db, "lab.permission_denied", user_id=p.user.id, outcome="denied", target=perm, request=request)
        raise HTTPException(403, f"Your membership category does not include '{perm}'.")
    df, dataset = None, None
    if body.dataset_version_id:
        v, dataset = _own_version(db, p.user.id, body.dataset_version_id)
        df = load_version(v)
    elif kind != "dhi":
        raise HTTPException(422, "Select a dataset version.")
    _own_project(db, p.user.id, body.project_id)
    t0 = time.perf_counter()
    status, err, result = "completed", None, None
    try:
        result = _dispatch(kind, df, body.params)
    except AnalysisError as exc:
        status, err = "failed", str(exc)
    except KeyError as exc:
        status, err = "failed", f"Missing parameter: {exc}"
    except (ValueError, TypeError, ArithmeticError) as exc:
        status, err = "failed", f"Analysis could not be completed: {exc}"
    dur = (time.perf_counter() - t0) * 1000
    if result is not None and dataset is not None:
        result["data_provenance"] = dataset.provenance
    run = AnalysisRun(owner_id=p.user.id, lab_project_id=body.project_id or (dataset.lab_project_id if dataset else None), dataset_version_id=body.dataset_version_id,
                      kind=kind, title=body.title or f"{title}{' · ' + dataset.name if dataset else ''}", params=body.params, result=result, status=status, error=err,
                      engine_version=ENGINE_VERSION, duration_ms=dur)
    if body.save or status == "failed":
        db.add(run)
        db.commit()
    audit(db, "lab.analysis_run", user_id=p.user.id, target=run.id, request=request, kind=kind, status=status, ms=round(dur))
    if status == "failed":
        raise HTTPException(422, err)
    return run_json(run)


@router.get("/analyses")
def list_runs(project_id: str | None = None, kind: str | None = None, limit: int = 100, p: Principal = Depends(require_lab("lab.datasets")), db: Session = Depends(get_db)):
    q = db.query(AnalysisRun).filter(AnalysisRun.owner_id == p.user.id)
    if project_id:
        q = q.filter(AnalysisRun.lab_project_id == project_id)
    if kind:
        q = q.filter(AnalysisRun.kind == kind)
    return [run_json(r, full=False) for r in q.order_by(AnalysisRun.created_at.desc()).limit(min(limit, 500))]


def _own_run(db: Session, uid_: str, rid: str) -> AnalysisRun:
    r = db.query(AnalysisRun).filter(AnalysisRun.id == rid, AnalysisRun.owner_id == uid_).one_or_none()
    if not r:
        raise HTTPException(404, "Analysis not found.")
    return r


@router.get("/analyses/{rid}")
def get_run(rid: str, p: Principal = Depends(require_lab("lab.datasets")), db: Session = Depends(get_db)):
    return run_json(_own_run(db, p.user.id, rid))


@router.delete("/analyses/{rid}")
def delete_run(rid: str, p: Principal = Depends(require_lab("lab.datasets")), db: Session = Depends(get_db)):
    db.delete(_own_run(db, p.user.id, rid))
    db.commit()
    return {"message": "Analysis deleted."}


@router.get("/analyses/{rid}/report", response_class=HTMLResponse)
def report(rid: str, request: Request, p: Principal = Depends(require_lab("lab.datasets")), db: Session = Depends(get_db)):
    r = _own_run(db, p.user.id, rid)
    v = db.get(DatasetVersion, r.dataset_version_id) if r.dataset_version_id else None
    d = db.get(Dataset, v.dataset_id) if v else None
    audit(db, "lab.report_generated", user_id=p.user.id, target=rid, request=request)
    return HTMLResponse(render(r, p.user, v, d), headers={"Content-Disposition": f'inline; filename="report-{rid[:8]}.html"', "X-Robots-Tag": "noindex"})


@router.get("/analyses/{rid}/export.csv")
def export_series(rid: str, request: Request, p: Principal = Depends(require_lab("lab.datasets")), db: Session = Depends(get_db)):
    """Export the chart series of a run as CSV (displayed series; may be downsampled — flagged in the header)."""
    r = _own_run(db, p.user.id, rid)
    series = (r.result or {}).get("series") or {}
    cols, frames, down = {}, [], False
    for name, s in series.items() if isinstance(series, dict) else []:
        if isinstance(s, dict) and "x" in s and "y" in s:
            frames.append(pd.Series(s["y"], index=s["x"], name=name))
            down = down or s.get("downsampled", False)
    if not frames:
        raise HTTPException(404, "This analysis has no tabular series to export.")
    out = pd.concat(frames, axis=1)
    buf = io.StringIO()
    buf.write(f"# Digital Reservoir analysis {r.id} ({r.kind}); engine {r.engine_version}; {'DOWNSAMPLED for display' if down else 'full resolution'}\n")
    out.to_csv(buf, index_label="x")
    audit(db, "lab.export_results", user_id=p.user.id, target=rid, request=request)
    return Response(buf.getvalue(), media_type="text/csv", headers={"Content-Disposition": f'attachment; filename="analysis-{rid[:8]}.csv"'})


@router.get("/dashboard")
def dashboard(p: Principal = Depends(require_lab("lab.datasets")), db: Session = Depends(get_db)):
    uid_ = p.user.id
    n_runs = db.query(func.count(AnalysisRun.id)).filter(AnalysisRun.owner_id == uid_).scalar()
    compute_ms = db.query(func.coalesce(func.sum(AnalysisRun.duration_ms), 0)).filter(AnalysisRun.owner_id == uid_).scalar()
    storage = db.query(func.coalesce(func.sum(DatasetVersion.size_bytes), 0)).join(Dataset).filter(Dataset.owner_id == uid_).scalar()
    from ..models import AuditLog
    notes = db.query(AuditLog).filter(AuditLog.user_id == uid_, AuditLog.action.in_(["lab.analysis_run", "lab.dataset_processed", "lab.dataset_uploaded", "lab.upload_rejected", "lab.report_generated"])).order_by(AuditLog.at.desc()).limit(8).all()
    return {"counts": {"projects": db.query(func.count(LabProject.id)).filter(LabProject.owner_id == uid_).scalar(),
                       "datasets": db.query(func.count(Dataset.id)).filter(Dataset.owner_id == uid_).scalar(),
                       "versions": db.query(func.count(DatasetVersion.id)).join(Dataset).filter(Dataset.owner_id == uid_).scalar(),
                       "analyses": n_runs},
            "usage": {"compute_seconds": round(float(compute_ms) / 1000, 2), "storage_bytes": int(storage)},
            "recent_runs": [run_json(r, False) for r in db.query(AnalysisRun).filter(AnalysisRun.owner_id == uid_).order_by(AnalysisRun.created_at.desc()).limit(6)],
            "notifications": [{"at": n.at.isoformat(), "action": n.action, "outcome": n.outcome, "detail": n.detail} for n in notes]}


# ------------------------------------------------------------------ inspection images (computer vision)


@router.post("/vision/cracks", status_code=201)
async def crack_detection(request: Request, file: UploadFile = File(...), mm_per_pixel: float | None = Form(None), sensitivity: float = Form(1.0),
                          min_length_px: int = Form(40), min_contrast: float = Form(0.08), location: str = Form(""), component: str = Form(""), captured_at: str = Form(""),
                          project_id: str = Form(""), p: Principal = Depends(require_lab("lab.advanced")), db: Session = Depends(get_db)):
    data = await file.read(15 * 1024 * 1024 + 1)
    if len(data) > 15 * 1024 * 1024:
        raise HTTPException(413, "Image larger than 15 MB.")
    if not (data[:8] == b"\x89PNG\r\n\x1a\n" or data[:3] == b"\xff\xd8\xff"):
        raise HTTPException(415, "Only PNG and JPEG images are accepted.")
    _own_project(db, p.user.id, project_id or None)
    t0 = time.perf_counter()
    try:
        res = vision.detect_cracks(data, mm_per_pixel=mm_per_pixel, sensitivity=sensitivity, min_length_px=min_length_px, min_contrast=min_contrast)
    except AnalysisError as exc:
        raise HTTPException(422, str(exc)) from exc
    key = f"images/{p.user.id}/{uid()}{'.png' if data[:4] == b'\x89PNG' else '.jpg'}"
    get_storage().put(key, data)
    res.update({"image": {"storage_key": key, "sha256": sha256(data), "filename": Path(file.filename or "image").name[:200], "location": location, "component": component, "captured_at": captured_at or None},
                "review": None})
    run = AnalysisRun(owner_id=p.user.id, lab_project_id=project_id or None, kind="crack_detection", title=f"Crack detection · {Path(file.filename or 'image').name[:80]}",
                      params={"mm_per_pixel": mm_per_pixel, "sensitivity": sensitivity, "min_length_px": min_length_px, "min_contrast": min_contrast, "location": location, "component": component},
                      result=res, engine_version=ENGINE_VERSION, duration_ms=(time.perf_counter() - t0) * 1000)
    db.add(run)
    db.commit()
    audit(db, "lab.vision_run", user_id=p.user.id, target=run.id, request=request, candidates=res["n_candidates"])
    return run_json(run)


@router.get("/vision/{rid}/image")
def vision_image(rid: str, p: Principal = Depends(require_lab("lab.advanced")), db: Session = Depends(get_db)):
    r = _own_run(db, p.user.id, rid)
    key = ((r.result or {}).get("image") or {}).get("storage_key")
    if r.kind != "crack_detection" or not key:
        raise HTTPException(404, "Image not found.")
    return Response(get_storage().get(key), media_type="image/png" if key.endswith(".png") else "image/jpeg")


class ReviewIn(BaseModel):
    verdict: str = Field(pattern="^(confirmed|partially_confirmed|rejected)$")
    note: str = Field(min_length=5, max_length=2000)
    component: str = Field(default="", max_length=200)
    location: str = Field(default="", max_length=500)
    confirmed_ids: list[int] = Field(default_factory=list)


@router.post("/analyses/{rid}/review")
def review_detection(rid: str, body: ReviewIn, request: Request, p: Principal = Depends(require_lab("lab.advanced")), db: Session = Depends(get_db)):
    """Engineer review of algorithmic detections. Only reviewed detections may be described as findings."""
    r = _own_run(db, p.user.id, rid)
    if r.kind != "crack_detection":
        raise HTTPException(400, "Only image detections can be reviewed.")
    res = dict(r.result)
    from ..security import utcnow
    res["review"] = {**body.model_dump(), "reviewer": p.user.full_name, "reviewer_id": p.user.id, "reviewed_at": utcnow().isoformat()}
    res["status"] = "engineer_reviewed_" + body.verdict
    r.result = res
    db.commit()
    audit(db, "lab.vision_reviewed", user_id=p.user.id, target=rid, request=request, verdict=body.verdict)
    return run_json(r)


class CompareIn(BaseModel):
    before_run_id: str
    after_run_id: str


@router.post("/vision/compare")
def vision_compare(body: CompareIn, p: Principal = Depends(require_lab("lab.advanced")), db: Session = Depends(get_db)):
    a, b = _own_run(db, p.user.id, body.before_run_id), _own_run(db, p.user.id, body.after_run_id)
    if a.kind != "crack_detection" or b.kind != "crack_detection":
        raise HTTPException(400, "Select two image detections.")
    return vision.compare(a.result, b.result)

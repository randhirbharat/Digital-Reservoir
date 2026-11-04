"""Integration between the Engineering Lab and the Digital Twin.

* Lab → Twin: publish an HST model (owned Lab run) to a project sensor. Requires Lab ownership of the run AND the
  project permission `models_publish`. The Twin evaluates the model on project data and can raise model-deviation alerts.
* Twin → Lab: export project sensor data into a Lab dataset. Requires project permission `export` AND Lab access.
Neither direction bypasses project permissions.
"""
from __future__ import annotations

import io
from datetime import datetime, timedelta

import numpy as np
import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field
from sqlalchemy import func
from sqlalchemy.orm import Session

from dr_analytics import hst
from dr_analytics.common import series_payload

from ..audit import audit
from ..db import get_db
from ..deps import lab_permissions
from ..models import AnalysisRun, Dataset, DatasetVersion
from ..models_twin import ModelPublication, Observation, Sensor
from ..security import utcnow
from ..twin.access import ProjectContext, require_project

router = APIRouter(prefix="/twin", tags=["integration"])


def pub_json(m: ModelPublication, codes: dict[str, str] | None = None) -> dict:
    codes = codes or {}
    return {"id": m.id, "sensor_id": m.sensor_id, "sensor_code": codes.get(m.sensor_id), "level_sensor_id": m.level_sensor_id, "level_sensor_code": codes.get(m.level_sensor_id),
            "kind": m.kind, "version": m.version, "source_run_id": m.source_run_id, "formula": m.formula, "calibration_period": m.calibration_period,
            "validation_period": m.validation_period, "validation_metrics": m.validation_metrics, "calibration_data_provenance": m.calibration_data_provenance,
            "deviation_threshold": m.deviation_threshold, "notes": m.notes, "active": m.active, "published_by": m.published_by, "published_at": m.published_at.isoformat(),
            "H_range": [m.model_state.get("H_min"), m.model_state.get("H_max")], "sigma": m.model_state.get("sigma")}


class PublishIn(BaseModel):
    run_id: str
    sensor_id: str
    level_sensor_id: str
    deviation_threshold: float | None = Field(default=None, gt=0, le=20)
    notes: str = Field(default="", max_length=2000)


@router.post("/projects/{project_id}/models", status_code=201)
def publish_model(body: PublishIn, request: Request, ctx: ProjectContext = Depends(require_project("models_publish")), db: Session = Depends(get_db)):
    run = db.query(AnalysisRun).filter(AnalysisRun.id == body.run_id, AnalysisRun.owner_id == ctx.principal.user.id).one_or_none()
    if not run or run.kind != "hst" or run.status != "completed" or not (run.result or {}).get("model_state"):
        raise HTTPException(404, "Completed HST analysis not found in your Engineering Lab runs.")
    sensors = {s.id: s for s in db.query(Sensor).filter(Sensor.project_id == ctx.project.id, Sensor.id.in_([body.sensor_id, body.level_sensor_id]))}
    if body.sensor_id not in sensors or body.level_sensor_id not in sensors:
        raise HTTPException(422, "Sensors must belong to this project.")
    target, level = sensors[body.sensor_id], sensors[body.level_sensor_id]
    if level.variable != "reservoir_level":
        raise HTTPException(422, "The hydrostatic input must be a reservoir-level sensor.")
    res = run.result
    unit = (res.get("unit") or "").strip()
    if unit and unit != target.unit:
        raise HTTPException(422, f"Unit mismatch: model response is in '{unit}' but {target.code} reports '{target.unit}'.")
    if res["model_state"].get("temperature"):
        raise HTTPException(422, "HTT models (measured temperature inputs) cannot yet be published; use the seasonal-harmonic HST variant.")
    version = (db.query(func.max(ModelPublication.version)).filter(ModelPublication.sensor_id == target.id).scalar() or 0) + 1
    db.query(ModelPublication).filter(ModelPublication.sensor_id == target.id, ModelPublication.active.is_(True)).update({"active": False})
    m = ModelPublication(project_id=ctx.project.id, sensor_id=target.id, level_sensor_id=level.id, version=version, source_run_id=run.id, model_state=res["model_state"],
                         formula=res["formula"], calibration_period=res["periods"]["calibration"], validation_period=res["periods"].get("validation"),
                         validation_metrics=res["metrics"].get("validation"), calibration_data_provenance=res.get("data_provenance", "unknown"),
                         deviation_threshold=body.deviation_threshold, notes=body.notes, published_by=ctx.principal.user.id)
    db.add(m)
    db.commit()
    audit(db, "twin.model_published", user_id=ctx.principal.user.id, project_id=ctx.project.id, target=m.id, request=request, run=run.id, sensor=target.code, version=version)
    return pub_json(m, {target.id: target.code, level.id: level.code})


@router.get("/projects/{project_id}/models")
def list_models(ctx: ProjectContext = Depends(require_project("view")), db: Session = Depends(get_db)):
    codes = dict(db.query(Sensor.id, Sensor.code).filter(Sensor.project_id == ctx.project.id).all())
    return [pub_json(m, codes) for m in db.query(ModelPublication).filter(ModelPublication.project_id == ctx.project.id).order_by(ModelPublication.published_at.desc())]


def _obs_frame(db: Session, sensor_id: str, start: datetime, end: datetime) -> pd.Series:
    rows = db.query(Observation.ts, Observation.value).filter(Observation.sensor_id == sensor_id, Observation.ts >= start, Observation.ts <= end,
                                                                  Observation.value.isnot(None)).order_by(Observation.ts).all()
    if not rows:
        return pd.Series(dtype=float)
    return pd.Series([r[1] for r in rows], index=pd.DatetimeIndex([r[0] for r in rows]).tz_convert("UTC"))


def evaluate(db: Session, m: ModelPublication, start: datetime, end: datetime) -> dict:
    y = _obs_frame(db, m.sensor_id, start, end)
    H = _obs_frame(db, m.level_sensor_id, start - timedelta(days=1), end)
    level = db.get(Sensor, m.level_sensor_id)
    if y.empty or H.empty:
        return {"n": 0, "note": "No overlapping observations in this window."}
    tol = pd.Timedelta(seconds=3 * level.frequency_s)
    aligned = pd.merge_asof(y.rename("y").to_frame().sort_index(), H.rename("H").to_frame().sort_index(), left_index=True, right_index=True, direction="backward", tolerance=tol).dropna()
    if aligned.empty:
        return {"n": 0, "note": "Reservoir level not available within tolerance of the response timestamps."}
    pred = hst.predict(m.model_state, aligned.index, aligned["H"].to_numpy())
    resid = aligned["y"].to_numpy() - pred
    sigma = m.model_state.get("sigma") or float(np.std(resid))
    z = resid / sigma
    extrap = (aligned["H"] > m.model_state["H_max"]) | (aligned["H"] < m.model_state["H_min"])
    return {"n": int(len(aligned)), "rmse": float(np.sqrt(np.mean(resid**2))), "mean_residual": float(np.mean(resid)), "max_abs_std_residual": float(np.max(np.abs(z))),
            "extrapolated_fraction": float(extrap.mean()), "sigma_calibration": sigma, "level_alignment": f"latest level reading at or before each response time, within {int(tol.total_seconds())} s",
            "series": {"observed": series_payload(aligned.index, aligned["y"]), "predicted": series_payload(aligned.index, pred), "residual": series_payload(aligned.index, resid), "std_residual": series_payload(aligned.index, z)}}


@router.get("/projects/{project_id}/models/{model_id}/evaluation")
def model_evaluation(model_id: str, start: datetime | None = None, end: datetime | None = None, ctx: ProjectContext = Depends(require_project("view")), db: Session = Depends(get_db)):
    m = db.query(ModelPublication).filter(ModelPublication.id == model_id, ModelPublication.project_id == ctx.project.id).one_or_none()
    if not m:
        raise HTTPException(404, "Model not found.")
    end = end or utcnow()
    start = start or end - timedelta(days=7)
    out = evaluate(db, m, start, end)
    out.update({"model": pub_json(m), "start": start.isoformat(), "end": end.isoformat(),
                "warnings": (["Part of this window lies outside the calibrated reservoir range; predictions there are extrapolations."] if out.get("extrapolated_fraction") else [])
                + ([f"Model was calibrated on {m.calibration_data_provenance} data, not on measurements from this project."] if m.calibration_data_provenance in ("synthetic", "simulated") else [])})
    return out


class ExportIn(BaseModel):
    sensor_ids: list[str] = Field(min_length=1, max_length=20)
    start: datetime
    end: datetime
    name: str = Field(default="", max_length=200)


@router.post("/projects/{project_id}/export-to-lab", status_code=201)
def export_to_lab(body: ExportIn, request: Request, ctx: ProjectContext = Depends(require_project("export")), db: Session = Depends(get_db)):
    if "lab.datasets" not in lab_permissions(ctx.principal.user):
        raise HTTPException(403, "Engineering Lab access (verified email) is required to receive exported data.")
    if body.start.tzinfo is None or body.end.tzinfo is None or body.end <= body.start:
        raise HTTPException(422, "Provide a time-zone-aware start before end.")
    sensors = db.query(Sensor).filter(Sensor.project_id == ctx.project.id, Sensor.id.in_(body.sensor_ids)).all()
    if len(sensors) != len(set(body.sensor_ids)):
        raise HTTPException(404, "Sensor not found in this project.")
    cols, sources = {}, set()
    for s in sensors:
        rows = db.query(Observation.ts, Observation.value, Observation.source).filter(Observation.sensor_id == s.id, Observation.ts >= body.start, Observation.ts <= body.end).order_by(Observation.ts).all()
        sources |= {r[2] for r in rows}
        cols[s.code] = pd.Series([r[1] for r in rows], index=pd.DatetimeIndex([r[0] for r in rows], name="timestamp"))
    df = pd.concat(cols, axis=1).sort_index() if cols else pd.DataFrame()
    if df.empty:
        raise HTTPException(422, "No observations in this window.")
    if len(df) > 500_000:
        raise HTTPException(413, "Too many rows; shorten the window.")
    provenance = "simulated" if "simulated" in sources else "imported" if sources == {"imported"} else "historical"
    buf = io.StringIO()
    buf.write(f"# Exported from Digital Twin project {ctx.project.code} ({utcnow().isoformat()}) by {ctx.principal.user.email}; sources: {', '.join(sorted(sources))}; outer-joined on timestamps\n")
    df.index = df.index.tz_convert("UTC")
    df.to_csv(buf, date_format="%Y-%m-%dT%H:%M:%SZ")
    data = buf.getvalue().encode()
    from dr_analytics import io as dio

    from .lab import _store_version, v_now
    parsed, report = dio.read_table(data, "export.csv")
    ds = Dataset(owner_id=ctx.principal.user.id, name=body.name or f"{ctx.project.code} export {body.start:%Y-%m-%d}–{body.end:%Y-%m-%d}", filename=f"{ctx.project.code}_export.csv",
                 provenance=provenance, time_column="timestamp", units={s.code: s.unit for s in sensors},
                 description=f"Exported from Digital Twin project {ctx.project.code} ({ctx.project.name}). Sources: {', '.join(sorted(sources))}.")
    db.add(ds)
    db.commit()
    _store_version(db, ds, data, "csv", "Original (Digital Twin export)", True, None,
                   [{"operation": "twin_export", "params": {"project": ctx.project.code, "sensors": [s.code for s in sensors], "start": body.start.isoformat(), "end": body.end.isoformat()},
                     "summary": f"Exported {len(df)} timestamps × {len(sensors)} sensors from {ctx.project.code}.", "at": v_now()}], report, parsed)
    audit(db, "twin.export_to_lab", user_id=ctx.principal.user.id, project_id=ctx.project.id, target=ds.id, request=request, sensors=[s.code for s in sensors], rows=len(df))
    return {"dataset_id": ds.id, "rows": int(len(df)), "provenance": provenance}

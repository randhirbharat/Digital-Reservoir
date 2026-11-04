"""Observation storage, rule evaluation, condition assessment and communications status."""
from __future__ import annotations

from datetime import datetime, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ..models_twin import Alert, AlertRule, Observation, Sensor
from ..security import utcnow
from .bus import bus

LEVEL_ORDER = {"normal": 0, "attention": 1, "warning": 2, "critical": 3}


def _breach(rule: AlertRule, v: float) -> bool:
    if rule.comparator == "gt":
        return v > rule.threshold
    if rule.comparator == "lt":
        return v < rule.threshold
    return abs(v) > rule.threshold


def evaluate_rules(db: Session, sensor: Sensor, value: float | None, ts: datetime, source: str) -> list[Alert]:
    """Raise one open alert per (rule) breach; no duplicate while an alert for that rule is open or acknowledged."""
    if value is None:
        return []
    created = []
    rules = db.query(AlertRule).filter(AlertRule.sensor_id == sensor.id, AlertRule.enabled.is_(True)).all()
    for r in rules:
        if not _breach(r, value):
            continue
        exists = db.query(Alert.id).filter(Alert.rule_id == r.id, Alert.status != "closed").first()
        if exists:
            continue
        cmp = {"gt": ">", "lt": "<", "abs_gt": "|x| >"}[r.comparator]
        a = Alert(project_id=sensor.project_id, sensor_id=sensor.id, rule_id=r.id, kind="threshold", severity=r.level, value=value, observed_at=ts, source=source,
                  message=f"{sensor.code} {value:.4g} {sensor.unit} {cmp} {r.threshold:g} ({r.criteria_reference}{'; demonstration criterion' if r.is_demonstration else ''})")
        db.add(a)
        created.append(a)
    return created


def store_observations(db: Session, sensor: Sensor, rows: list[tuple[datetime, float | None, str]], source: str, publish: bool = True) -> int:
    """rows: (timestamp, value, quality). Units always come from the sensor registry."""
    alerts: list[Alert] = []
    objs = []
    now = utcnow()
    for ts, v, q in rows:
        objs.append(Observation(project_id=sensor.project_id, asset_id=sensor.asset_id, sensor_id=sensor.id, ts=ts, value=v, unit=sensor.unit, quality=q, source=source, ingested_at=now))
    db.add_all(objs)
    if rows:
        ts, v, _ = rows[-1]
        alerts = evaluate_rules(db, sensor, v, ts, source)
        alerts += evaluate_model_deviation(db, sensor, v, ts, source)
        if sensor.status == "offline":
            sensor.status = "active"
    db.commit()
    if publish and rows:
        ts, v, q = rows[-1]
        bus.publish(sensor.project_id, {"type": "observation", "sensor_id": sensor.id, "code": sensor.code, "t": ts.isoformat(), "v": v, "q": q, "unit": sensor.unit,
                                        "source": source, "ingested_at": now.isoformat()})
        for a in alerts:
            bus.publish(sensor.project_id, {"type": "alert", "alert": alert_json(a)})
    return len(objs)


def alert_json(a: Alert) -> dict:
    return {"id": a.id, "sensor_id": a.sensor_id, "rule_id": a.rule_id, "kind": a.kind, "severity": a.severity, "message": a.message, "value": a.value,
            "observed_at": a.observed_at.isoformat() if a.observed_at else None, "source": a.source, "status": a.status, "created_at": a.created_at.isoformat() if a.created_at else None,
            "acknowledged_by": a.acknowledged_by, "acknowledged_at": a.acknowledged_at.isoformat() if a.acknowledged_at else None,
            "closed_by": a.closed_by, "closed_at": a.closed_at.isoformat() if a.closed_at else None, "closure_note": a.closure_note}


def comms_status(sensor: Sensor, last_measurement: datetime | None, now: datetime | None = None) -> str:
    """Data freshness from the timestamp of the latest measurement (not upload time: imported history is not live data)."""
    if last_measurement is None:
        return "never"
    now = now or utcnow()
    age = (now - last_measurement).total_seconds()
    if age <= 2 * sensor.frequency_s:
        return "online"
    if age <= 6 * sensor.frequency_s:
        return "late"
    return "offline"


def latest(db: Session, project_id: str) -> list[dict]:
    sensors = db.query(Sensor).filter(Sensor.project_id == project_id).order_by(Sensor.code).all()
    if not sensors:
        return []
    sub = select(Observation.sensor_id, func.max(Observation.ts).label("mts")).where(Observation.project_id == project_id).group_by(Observation.sensor_id).subquery()
    rows = db.execute(select(Observation).join(sub, (Observation.sensor_id == sub.c.sensor_id) & (Observation.ts == sub.c.mts))).scalars().all()
    by_sensor = {o.sensor_id: o for o in rows}
    rules = db.query(AlertRule).filter(AlertRule.project_id == project_id, AlertRule.enabled.is_(True)).all()
    rules_by = {}
    for r in rules:
        rules_by.setdefault(r.sensor_id, []).append(r)
    now = utcnow()
    out = []
    for s in sensors:
        o = by_sensor.get(s.id)
        comm = comms_status(s, o.ts if o else None, now)
        cond, basis = "not_assessed", "No documented project criterion configured for this sensor."
        if s.status in ("offline", "fault") or comm in ("offline", "never") or (o is not None and (o.value is None or o.quality in ("bad", "missing"))):
            cond, basis = "unavailable", f"Data unavailable (sensor status {s.status}, communications {comm})."
        elif rules_by.get(s.id):
            cond = "normal"
            hits = [r for r in rules_by[s.id] if _breach(r, o.value)]
            if hits:
                worst = max(hits, key=lambda r: LEVEL_ORDER[r.level])
                cond, basis = worst.level, f"{worst.criteria_reference}: threshold {worst.threshold:g} {s.unit}" + (" (demonstration criterion)" if worst.is_demonstration else "")
            else:
                refs = "; ".join(sorted({r.criteria_reference for r in rules_by[s.id]}))
                basis = f"Within configured criteria ({refs})" + (" — demonstration criteria" if any(r.is_demonstration for r in rules_by[s.id]) else "")
        out.append({"sensor_id": s.id, "code": s.code, "name": s.name, "variable": s.variable, "value": o.value if o else None, "unit": s.unit,
                    "timestamp": o.ts.isoformat() if o else None, "ingested_at": o.ingested_at.isoformat() if o else None, "quality": o.quality if o else None,
                    "source": o.source if o else s.source, "comms": comm, "status": s.status, "condition": cond, "condition_basis": basis})
    return out


def watchdog(db: Session, project_id: str) -> int:
    """Raise communication alerts for sensors whose data stopped; mark them offline."""
    n = 0
    for row in latest(db, project_id):
        if row["comms"] == "offline" and row["status"] == "active":
            s = db.get(Sensor, row["sensor_id"])
            s.status = "offline"
            if not db.query(Alert.id).filter(Alert.sensor_id == s.id, Alert.kind == "communication", Alert.status != "closed").first():
                a = Alert(project_id=project_id, sensor_id=s.id, kind="communication", severity="attention", source=row["source"],
                          message=f"{s.code}: no data since {row['timestamp']} (expected every {s.frequency_s} s). Check logger/communications.")
                db.add(a)
                db.flush()
                bus.publish(project_id, {"type": "alert", "alert": alert_json(a)})
                n += 1
    db.commit()
    return n


def evaluate_model_deviation(db: Session, sensor: Sensor, value: float | None, ts: datetime, source: str) -> list[Alert]:
    """Compare a new reading with the active published model for this sensor (if it has a deviation threshold)."""
    from dr_analytics import hst

    from ..models_twin import ModelPublication
    if value is None:
        return []
    m = db.query(ModelPublication).filter(ModelPublication.sensor_id == sensor.id, ModelPublication.active.is_(True), ModelPublication.deviation_threshold.isnot(None)).first()
    if not m:
        return []
    level_sensor = db.get(Sensor, m.level_sensor_id)
    lv = db.query(Observation).filter(Observation.sensor_id == m.level_sensor_id, Observation.ts <= ts, Observation.value.isnot(None),
                                      Observation.ts >= ts - timedelta(seconds=3 * level_sensor.frequency_s)).order_by(Observation.ts.desc()).first()
    if not lv:
        return []
    pred = float(hst.predict(m.model_state, [ts], [lv.value])[0])
    z = (value - pred) / (m.model_state.get("sigma") or 1.0)
    if abs(z) <= m.deviation_threshold or db.query(Alert.id).filter(Alert.sensor_id == sensor.id, Alert.kind == "model_deviation", Alert.status != "closed").first():
        return []
    a = Alert(project_id=sensor.project_id, sensor_id=sensor.id, kind="model_deviation", severity="attention", value=value, observed_at=ts, source=source,
              message=f"{sensor.code} {value:.4g} {sensor.unit} vs HST v{m.version} prediction {pred:.4g} (standardised residual {z:+.2f}, screening threshold ±{m.deviation_threshold:g} set at publication)")
    db.add(a)
    return [a]

"""Digital Twin API: projects, access workflow, structure, sensors, observations, alerts, criteria, gateways, live stream."""
from __future__ import annotations

import asyncio
import csv
import io
from datetime import datetime, timedelta
from typing import Literal

import numpy as np
import pandas as pd
from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, UploadFile, WebSocket, WebSocketDisconnect
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy import func
from sqlalchemy.orm import Session

from dr_analytics.common import lttb

from ..audit import audit
from ..config import get_settings
from ..db import SessionLocal, get_db
from ..deps import Principal, optional_principal, require_user
from ..emailer import send_email
from ..models import AuditLog, OrgMember, User, UserSession
from ..models_twin import (PROJECT_ROLES, ROLE_PERMISSIONS, AccessRequest, Alert, AlertRule, Asset, Component, Gateway, Invitation, Observation, Project,
                           ProjectMember, Sensor)
from ..security import limiter, new_token, token_hash, utcnow
from ..twin.access import ProjectContext, project_context, require_project, resolve_role
from ..twin.bus import bus
from ..twin.engine import alert_json, latest, store_observations

router = APIRouter(prefix="/twin", tags=["digital-twin"])
ingest_router = APIRouter(prefix="/ingest", tags=["ingestion"])
Role = Literal["project_admin", "project_engineer", "researcher", "monitoring_operator", "viewer"]


def _project_json(p: Project, role: str | None) -> dict:
    return {"id": p.id, "code": p.code, "name": p.name, "description": p.description, "data_mode": p.data_mode, "require_mfa": p.require_mfa,
            "role": role, "permissions": sorted(ROLE_PERMISSIONS.get(role, set())) if role else []}


def _sensor_json(s: Sensor) -> dict:
    return {"id": s.id, "code": s.code, "name": s.name, "sensor_type": s.sensor_type, "variable": s.variable, "unit": s.unit, "component_id": s.component_id,
            "asset_id": s.asset_id, "x": s.x, "y": s.y, "z": s.z, "frequency_s": s.frequency_s, "source": s.source, "calibration": s.calibration, "status": s.status,
            "installed_at": s.installed_at.isoformat() if s.installed_at else None, "notes": s.notes}

# ------------------------------------------------------------------ projects & directory


@router.get("/projects")
def my_projects(p: Principal = Depends(require_user), db: Session = Depends(get_db)):
    out = []
    for pr in db.query(Project).order_by(Project.code):
        role = resolve_role(db, p, pr)
        if role:
            out.append(_project_json(pr, role))
    pending_inv = db.query(Invitation, Project).join(Project).filter(Invitation.email == p.user.email, Invitation.accepted_at.is_(None), Invitation.revoked_at.is_(None), Invitation.expires_at > utcnow()).all()
    reqs = {r.project_id: r.status for r in db.query(AccessRequest).filter(AccessRequest.user_id == p.user.id)}
    directory = [{"id": pr.id, "code": pr.code, "name": pr.name, "request_status": reqs.get(pr.id)} for pr in db.query(Project).order_by(Project.code)
                 if (pr.settings or {}).get("discoverable") and not any(o["id"] == pr.id for o in out)]
    return {"projects": out, "invitations": [{"project_code": pr.code, "project_name": pr.name, "role": i.role, "expires_at": i.expires_at.isoformat()} for i, pr in pending_inv],
            "directory": directory, "session_mfa_passed": p.session.mfa_passed, "mfa_enabled": p.user.mfa_enabled}


class ProjectIn(BaseModel):
    code: str = Field(pattern=r"^[A-Z0-9-]{2,32}$")
    name: str = Field(min_length=2, max_length=200)
    description: str = ""
    organisation_id: str | None = None
    data_mode: Literal["simulated", "live", "historical", "mixed"] = "live"
    require_mfa: bool = True
    discoverable: bool = False


@router.post("/projects", status_code=201)
def create_project(body: ProjectIn, request: Request, p: Principal = Depends(require_user), db: Session = Depends(get_db)):
    allowed = p.user.is_superadmin or (body.organisation_id and db.query(OrgMember).filter(OrgMember.organisation_id == body.organisation_id, OrgMember.user_id == p.user.id, OrgMember.role == "institutional_admin").count())
    if not allowed:
        audit(db, "twin.project_create_denied", user_id=p.user.id, outcome="denied", request=request)
        raise HTTPException(403, "Only platform or institutional administrators can create projects.")
    pr = Project(code=body.code, name=body.name, description=body.description, organisation_id=body.organisation_id, data_mode=body.data_mode, require_mfa=body.require_mfa, settings={"discoverable": body.discoverable})
    db.add(pr)
    db.commit()
    audit(db, "twin.project_created", user_id=p.user.id, project_id=pr.id, request=request)
    return _project_json(pr, "project_admin")


@router.get("/projects/{project_id}")
def project_detail(ctx: ProjectContext = Depends(require_project("view")), db: Session = Depends(get_db)):
    pr = ctx.project
    assets = db.query(Asset).filter(Asset.project_id == pr.id).all()
    comps = db.query(Component).filter(Component.project_id == pr.id).all()
    out = _project_json(pr, ctx.role)
    out["assets"] = [{"id": a.id, "name": a.name, "asset_type": a.asset_type, "description": a.description, "is_illustrative": a.is_illustrative, "model_ref": a.model_ref, "geometry": a.geometry} for a in assets]
    out["components"] = [{"id": c.id, "asset_id": c.asset_id, "code": c.code, "name": c.name, "kind": c.kind} for c in comps]
    out["sensor_count"] = db.query(func.count(Sensor.id)).filter(Sensor.project_id == pr.id).scalar()
    return out

# ------------------------------------------------------------------ members, invitations, requests


@router.get("/projects/{project_id}/members")
def members(ctx: ProjectContext = Depends(require_project("view")), db: Session = Depends(get_db)):
    rows = db.query(ProjectMember, User).join(User, User.id == ProjectMember.user_id).filter(ProjectMember.project_id == ctx.project.id).order_by(ProjectMember.granted_at).all()
    last = dict(db.query(UserSession.user_id, func.max(UserSession.last_seen_at)).group_by(UserSession.user_id).all())
    return [{"user_id": u.id, "name": u.full_name, "email": u.email if "members_manage" in ctx.permissions else None, "organisation": u.organisation_name, "role": m.role,
             "mfa_enabled": u.mfa_enabled, "granted_at": m.granted_at.isoformat(), "revoked_at": m.revoked_at.isoformat() if m.revoked_at else None,
             "last_seen_at": last.get(u.id).isoformat() if last.get(u.id) else None, "is_you": u.id == ctx.principal.user.id} for m, u in rows]


class RoleIn(BaseModel):
    role: Role


def _revoke_sessions(db: Session, user_id: str):
    db.query(UserSession).filter(UserSession.user_id == user_id, UserSession.revoked_at.is_(None)).update({"revoked_at": utcnow()})


@router.patch("/projects/{project_id}/members/{user_id}")
def change_role(user_id: str, body: RoleIn, request: Request, ctx: ProjectContext = Depends(require_project("members_manage")), db: Session = Depends(get_db)):
    m = db.query(ProjectMember).filter(ProjectMember.project_id == ctx.project.id, ProjectMember.user_id == user_id, ProjectMember.revoked_at.is_(None)).one_or_none()
    if not m:
        raise HTTPException(404, "Member not found.")
    if user_id == ctx.principal.user.id:
        raise HTTPException(400, "You cannot change your own role.")
    old, m.role = m.role, body.role
    _revoke_sessions(db, user_id)  # role changes take effect immediately
    db.commit()
    audit(db, "twin.role_changed", user_id=ctx.principal.user.id, project_id=ctx.project.id, target=user_id, request=request, old=old, new=body.role)
    return {"message": "Role updated; the member's sessions were ended."}


@router.delete("/projects/{project_id}/members/{user_id}")
def revoke_member(user_id: str, request: Request, ctx: ProjectContext = Depends(require_project("members_manage")), db: Session = Depends(get_db)):
    m = db.query(ProjectMember).filter(ProjectMember.project_id == ctx.project.id, ProjectMember.user_id == user_id, ProjectMember.revoked_at.is_(None)).one_or_none()
    if not m:
        raise HTTPException(404, "Member not found.")
    if user_id == ctx.principal.user.id:
        raise HTTPException(400, "You cannot revoke your own access.")
    m.revoked_at = utcnow()
    _revoke_sessions(db, user_id)
    db.commit()
    audit(db, "twin.access_revoked", user_id=ctx.principal.user.id, project_id=ctx.project.id, target=user_id, request=request)
    return {"message": "Access revoked; active sessions terminated."}


class InviteIn(BaseModel):
    email: EmailStr
    role: Role


@router.post("/projects/{project_id}/invitations", status_code=201)
def invite(body: InviteIn, request: Request, ctx: ProjectContext = Depends(require_project("members_manage")), db: Session = Depends(get_db)):
    tok = new_token()
    inv = Invitation(project_id=ctx.project.id, email=body.email.lower(), role=body.role, token_hash=token_hash(tok), invited_by=ctx.principal.user.id, expires_at=utcnow() + timedelta(days=7))
    db.add(inv)
    db.commit()
    send_email(db, inv.email, f"Invitation to Digital Reservoir project {ctx.project.code}",
               f"You have been invited to '{ctx.project.name}' as {body.role.replace('_', ' ')}.\n\nAccept within 7 days (sign in first; MFA may be required):\n{get_settings().twin_url}/invite?token={tok}\n")
    audit(db, "twin.invitation_sent", user_id=ctx.principal.user.id, project_id=ctx.project.id, target=inv.email, request=request, role=body.role)
    return {"id": inv.id, "email": inv.email, "role": inv.role, "expires_at": inv.expires_at.isoformat()}


@router.get("/projects/{project_id}/invitations")
def list_invitations(ctx: ProjectContext = Depends(require_project("members_manage")), db: Session = Depends(get_db)):
    rows = db.query(Invitation).filter(Invitation.project_id == ctx.project.id).order_by(Invitation.created_at.desc()).limit(100)
    return [{"id": i.id, "email": i.email, "role": i.role, "created_at": i.created_at.isoformat(), "expires_at": i.expires_at.isoformat(),
             "status": "accepted" if i.accepted_at else "revoked" if i.revoked_at else "expired" if i.expires_at <= utcnow() else "pending"} for i in rows]


class TokenIn(BaseModel):
    token: str


@router.post("/invitations/accept")
def accept_invitation(body: TokenIn, request: Request, p: Principal = Depends(require_user), db: Session = Depends(get_db)):
    inv = db.query(Invitation).filter(Invitation.token_hash == token_hash(body.token)).one_or_none()
    if not inv or inv.accepted_at or inv.revoked_at or inv.expires_at <= utcnow():
        raise HTTPException(400, "Invitation is invalid or has expired.")
    if inv.email != p.user.email:
        audit(db, "twin.invitation_wrong_user", user_id=p.user.id, outcome="denied", project_id=inv.project_id, request=request)
        raise HTTPException(403, "This invitation was issued to a different email address.")
    project = db.get(Project, inv.project_id)
    if project.require_mfa and get_settings().twin_enforce_mfa and not p.session.mfa_passed:
        raise HTTPException(403, "Enable multi-factor authentication and sign in with it before accepting this invitation.")
    m = db.query(ProjectMember).filter(ProjectMember.project_id == inv.project_id, ProjectMember.user_id == p.user.id).one_or_none()
    if m:
        m.role, m.revoked_at, m.granted_at, m.granted_by = inv.role, None, utcnow(), inv.invited_by
    else:
        db.add(ProjectMember(project_id=inv.project_id, user_id=p.user.id, role=inv.role, granted_by=inv.invited_by))
    inv.accepted_at = utcnow()
    db.commit()
    audit(db, "twin.invitation_accepted", user_id=p.user.id, project_id=inv.project_id, request=request, role=inv.role)
    return {"project_id": inv.project_id, "role": inv.role}


class AccessRequestIn(BaseModel):
    role: Role = "viewer"
    justification: str = Field(min_length=10, max_length=2000)


@router.post("/projects/{project_id}/access-requests", status_code=201)
def request_access(project_id: str, body: AccessRequestIn, request: Request, p: Principal = Depends(require_user), db: Session = Depends(get_db)):
    pr = db.get(Project, project_id)
    if not pr or not (pr.settings or {}).get("discoverable"):
        raise HTTPException(404, "Project not found.")
    if resolve_role(db, p, pr):
        raise HTTPException(400, "You already have access to this project.")
    if db.query(AccessRequest).filter(AccessRequest.project_id == project_id, AccessRequest.user_id == p.user.id, AccessRequest.status == "pending").count():
        raise HTTPException(400, "A request is already pending.")
    db.add(AccessRequest(project_id=project_id, user_id=p.user.id, role=body.role, justification=body.justification))
    db.commit()
    audit(db, "twin.access_requested", user_id=p.user.id, project_id=project_id, request=request, role=body.role)
    return {"message": "Request sent to the project administrators."}


@router.get("/projects/{project_id}/access-requests")
def list_requests(ctx: ProjectContext = Depends(require_project("members_manage")), db: Session = Depends(get_db)):
    rows = db.query(AccessRequest, User).join(User, User.id == AccessRequest.user_id).filter(AccessRequest.project_id == ctx.project.id).order_by(AccessRequest.created_at.desc()).all()
    return [{"id": r.id, "user_id": u.id, "name": u.full_name, "email": u.email, "organisation": u.organisation_name, "role": r.role, "justification": r.justification,
             "status": r.status, "created_at": r.created_at.isoformat()} for r, u in rows]


class DecisionIn(BaseModel):
    approve: bool
    role: Role | None = None


@router.post("/projects/{project_id}/access-requests/{rid}/decide")
def decide(rid: str, body: DecisionIn, request: Request, ctx: ProjectContext = Depends(require_project("members_manage")), db: Session = Depends(get_db)):
    r = db.query(AccessRequest).filter(AccessRequest.id == rid, AccessRequest.project_id == ctx.project.id, AccessRequest.status == "pending").one_or_none()
    if not r:
        raise HTTPException(404, "Request not found.")
    r.status, r.decided_by, r.decided_at = ("approved" if body.approve else "rejected"), ctx.principal.user.id, utcnow()
    if body.approve:
        role = body.role or r.role
        m = db.query(ProjectMember).filter(ProjectMember.project_id == ctx.project.id, ProjectMember.user_id == r.user_id).one_or_none()
        if m:
            m.role, m.revoked_at = role, None
        else:
            db.add(ProjectMember(project_id=ctx.project.id, user_id=r.user_id, role=role, granted_by=ctx.principal.user.id))
    db.commit()
    audit(db, "twin.access_request_decided", user_id=ctx.principal.user.id, project_id=ctx.project.id, target=r.user_id, request=request, approved=body.approve)
    return {"message": "Decision recorded."}


@router.get("/projects/{project_id}/audit")
def project_audit(limit: int = 100, ctx: ProjectContext = Depends(require_project("members_manage")), db: Session = Depends(get_db)):
    rows = db.query(AuditLog).filter(AuditLog.project_id == ctx.project.id).order_by(AuditLog.at.desc()).limit(min(limit, 500)).all()
    names = dict(db.query(User.id, User.full_name).filter(User.id.in_({a.user_id for a in rows if a.user_id})).all())
    return [{"at": a.at.isoformat(), "user": names.get(a.user_id, "—"), "action": a.action, "outcome": a.outcome, "target": a.target, "ip": a.ip, "detail": a.detail} for a in rows]

# ------------------------------------------------------------------ sensors


class SensorIn(BaseModel):
    code: str = Field(pattern=r"^[A-Za-z0-9_.-]{1,64}$")
    name: str = Field(min_length=1, max_length=200)
    sensor_type: str = Field(min_length=1, max_length=64)
    variable: str = Field(min_length=1, max_length=64)
    unit: str = Field(min_length=1, max_length=32)
    component_id: str | None = None
    asset_id: str | None = None
    x: float = 0
    y: float = 0
    z: float = 0
    frequency_s: int = Field(default=600, ge=1, le=7 * 86400)
    source: Literal["live", "historical", "imported", "simulated"] = "live"
    calibration: dict = Field(default_factory=dict)
    status: Literal["active", "offline", "fault", "maintenance", "decommissioned"] = "active"
    installed_at: datetime | None = None
    notes: str = ""


@router.get("/projects/{project_id}/sensors")
def list_sensors(ctx: ProjectContext = Depends(require_project("view")), db: Session = Depends(get_db)):
    return [_sensor_json(s) for s in db.query(Sensor).filter(Sensor.project_id == ctx.project.id).order_by(Sensor.code)]


def _check_refs(db: Session, project_id: str, body: SensorIn):
    if body.component_id and not db.query(Component).filter(Component.id == body.component_id, Component.project_id == project_id).count():
        raise HTTPException(422, "Component does not belong to this project.")
    if body.asset_id and not db.query(Asset).filter(Asset.id == body.asset_id, Asset.project_id == project_id).count():
        raise HTTPException(422, "Asset does not belong to this project.")


@router.post("/projects/{project_id}/sensors", status_code=201)
def create_sensor(body: SensorIn, request: Request, ctx: ProjectContext = Depends(require_project("sensors_manage")), db: Session = Depends(get_db)):
    _check_refs(db, ctx.project.id, body)
    if body.source == "simulated" and ctx.project.data_mode != "simulated":
        raise HTTPException(422, "Simulated sensors are only allowed in demonstration projects.")
    if db.query(Sensor).filter(Sensor.project_id == ctx.project.id, Sensor.code == body.code).count():
        raise HTTPException(409, "A sensor with this code already exists.")
    s = Sensor(project_id=ctx.project.id, **body.model_dump())
    db.add(s)
    db.commit()
    audit(db, "twin.sensor_registered", user_id=ctx.principal.user.id, project_id=ctx.project.id, target=s.code, request=request)
    return _sensor_json(s)


@router.patch("/projects/{project_id}/sensors/{sensor_id}")
def update_sensor(sensor_id: str, body: SensorIn, request: Request, ctx: ProjectContext = Depends(require_project("sensors_manage")), db: Session = Depends(get_db)):
    s = db.query(Sensor).filter(Sensor.id == sensor_id, Sensor.project_id == ctx.project.id).one_or_none()
    if not s:
        raise HTTPException(404, "Sensor not found.")
    _check_refs(db, ctx.project.id, body)
    before = _sensor_json(s)
    for k, v in body.model_dump().items():
        setattr(s, k, v)
    db.commit()
    audit(db, "twin.sensor_updated", user_id=ctx.principal.user.id, project_id=ctx.project.id, target=s.code, request=request,
          changed={k: [before[k], v] for k, v in _sensor_json(s).items() if before.get(k) != v})
    return _sensor_json(s)

# ------------------------------------------------------------------ data


@router.get("/projects/{project_id}/latest")
def latest_readings(ctx: ProjectContext = Depends(require_project("view")), db: Session = Depends(get_db)):
    return {"server_time": utcnow().isoformat(), "data_mode": ctx.project.data_mode, "readings": latest(db, ctx.project.id)}


@router.get("/projects/{project_id}/sensors/{sensor_id}/observations")
def observations(sensor_id: str, start: datetime | None = None, end: datetime | None = None, max_points: int = Query(1500, ge=10, le=20000),
                 ctx: ProjectContext = Depends(require_project("view")), db: Session = Depends(get_db)):
    s = db.query(Sensor).filter(Sensor.id == sensor_id, Sensor.project_id == ctx.project.id).one_or_none()
    if not s:
        raise HTTPException(404, "Sensor not found.")
    end = end or utcnow()
    start = start or end - timedelta(days=7)
    if start.tzinfo is None or end.tzinfo is None:
        raise HTTPException(422, "start and end must include a time zone (e.g. ...Z).")
    q = db.query(Observation.ts, Observation.value, Observation.quality, Observation.source).filter(Observation.sensor_id == s.id, Observation.ts >= start, Observation.ts <= end).order_by(Observation.ts)
    rows = q.all()
    n = len(rows)
    idx = np.arange(n)
    if n > max_points:
        x = np.array([r[0].timestamp() for r in rows]); y = np.array([np.nan if r[1] is None else r[1] for r in rows], float)
        idx = lttb(x, y, max_points)
        # keep every flagged (non-good) observation visible even when downsampling
        flagged = [i for i, r in enumerate(rows) if r[2] not in ("good", "unchecked")]
        idx = np.unique(np.concatenate([idx, np.array(flagged, int)])) if flagged else idx
    pts = [{"t": rows[i][0].isoformat(), "v": rows[i][1], "q": rows[i][2]} for i in idx]
    sources = sorted({r[3] for r in rows})
    return {"sensor": _sensor_json(s), "start": start.isoformat(), "end": end.isoformat(), "n_total": n, "downsampled": n > max_points, "method": "LTTB (display only; stored data unchanged)" if n > max_points else None,
            "sources": sources, "points": pts}


@router.get("/projects/{project_id}/sensors/{sensor_id}/observations.csv")
def export_observations(sensor_id: str, request: Request, start: datetime | None = None, end: datetime | None = None, ctx: ProjectContext = Depends(require_project("export")), db: Session = Depends(get_db)):
    s = db.query(Sensor).filter(Sensor.id == sensor_id, Sensor.project_id == ctx.project.id).one_or_none()
    if not s:
        raise HTTPException(404, "Sensor not found.")
    end = end or utcnow()
    start = start or end - timedelta(days=30)
    buf = io.StringIO()
    buf.write(f"# Digital Reservoir export — project {ctx.project.code}, sensor {s.code} ({s.variable}, {s.unit}); exported {utcnow().isoformat()} by {ctx.principal.user.email}\n")
    w = csv.writer(buf)
    w.writerow(["timestamp_utc", "value", "unit", "quality", "source", "ingested_at_utc"])
    for o in db.query(Observation).filter(Observation.sensor_id == s.id, Observation.ts >= start, Observation.ts <= end).order_by(Observation.ts).yield_per(5000):
        w.writerow([o.ts.isoformat(), "" if o.value is None else o.value, o.unit, o.quality, o.source, o.ingested_at.isoformat()])
    audit(db, "twin.export", user_id=ctx.principal.user.id, project_id=ctx.project.id, target=s.code, request=request, start=start.isoformat(), end=end.isoformat())
    from fastapi.responses import Response
    return Response(buf.getvalue(), media_type="text/csv", headers={"Content-Disposition": f'attachment; filename="{ctx.project.code}_{s.code}.csv"'})


@router.post("/projects/{project_id}/sensors/{sensor_id}/import", status_code=201)
async def import_history(sensor_id: str, request: Request, file: UploadFile = File(...), source: str = Form("historical"),
                         ctx: ProjectContext = Depends(require_project("sensors_manage")), db: Session = Depends(get_db)):
    """Historical CSV upload (columns: timestamp, value[, quality]). Stored with the declared provenance."""
    if source not in ("historical", "imported"):
        raise HTTPException(422, "source must be historical or imported.")
    s = db.query(Sensor).filter(Sensor.id == sensor_id, Sensor.project_id == ctx.project.id).one_or_none()
    if not s:
        raise HTTPException(404, "Sensor not found.")
    data = await file.read(50 * 1024 * 1024 + 1)
    if len(data) > 50 * 1024 * 1024:
        raise HTTPException(413, "File too large (50 MB).")
    try:
        df = pd.read_csv(io.BytesIO(data), comment="#")
        ts = pd.to_datetime(df.iloc[:, 0], utc=True, errors="coerce")
        vals = pd.to_numeric(df.iloc[:, 1], errors="coerce")
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(422, f"Could not parse CSV: {exc}") from exc
    q = df.iloc[:, 2].astype(str) if df.shape[1] > 2 else pd.Series("unchecked", index=df.index)
    rows = [(t.to_pydatetime(), None if pd.isna(v) else float(v), "missing" if pd.isna(v) else (qq if qq in ("good", "suspect", "bad") else "unchecked"))
            for t, v, qq in zip(ts, vals, q) if not pd.isna(t)]
    if not rows:
        raise HTTPException(422, "No valid rows (expected timestamp,value).")
    n = store_observations(db, s, rows, source, publish=False)
    audit(db, "twin.history_imported", user_id=ctx.principal.user.id, project_id=ctx.project.id, target=s.code, request=request, rows=n, source=source)
    return {"rows": n, "skipped": int(len(df) - n)}

# ------------------------------------------------------------------ alerts & criteria


@router.get("/projects/{project_id}/alerts")
def list_alerts(status: str | None = None, limit: int = 200, ctx: ProjectContext = Depends(require_project("view")), db: Session = Depends(get_db)):
    q = db.query(Alert).filter(Alert.project_id == ctx.project.id)
    if status:
        q = q.filter(Alert.status == status)
    return [alert_json(a) for a in q.order_by(Alert.created_at.desc()).limit(min(limit, 1000))]


class AlertActionIn(BaseModel):
    note: str = Field(default="", max_length=1000)


@router.post("/projects/{project_id}/alerts/{alert_id}/acknowledge")
def acknowledge(alert_id: str, request: Request, ctx: ProjectContext = Depends(require_project("alert_ack")), db: Session = Depends(get_db)):
    a = db.query(Alert).filter(Alert.id == alert_id, Alert.project_id == ctx.project.id).one_or_none()
    if not a or a.status != "open":
        raise HTTPException(404, "Open alert not found.")
    a.status, a.acknowledged_by, a.acknowledged_at = "acknowledged", ctx.principal.user.id, utcnow()
    db.commit()
    audit(db, "twin.alert_acknowledged", user_id=ctx.principal.user.id, project_id=ctx.project.id, target=alert_id, request=request)
    bus.publish(ctx.project.id, {"type": "alert", "alert": alert_json(a)})
    return alert_json(a)


@router.post("/projects/{project_id}/alerts/{alert_id}/close")
def close_alert(alert_id: str, body: AlertActionIn, request: Request, ctx: ProjectContext = Depends(require_project("alert_ack")), db: Session = Depends(get_db)):
    a = db.query(Alert).filter(Alert.id == alert_id, Alert.project_id == ctx.project.id).one_or_none()
    if not a or a.status == "closed":
        raise HTTPException(404, "Alert not found or already closed.")
    if len(body.note.strip()) < 5:
        raise HTTPException(422, "A closure note describing the review is required.")
    a.status, a.closed_by, a.closed_at, a.closure_note = "closed", ctx.principal.user.id, utcnow(), body.note.strip()
    if not a.acknowledged_at:
        a.acknowledged_by, a.acknowledged_at = ctx.principal.user.id, a.closed_at
    db.commit()
    audit(db, "twin.alert_closed", user_id=ctx.principal.user.id, project_id=ctx.project.id, target=alert_id, request=request)
    bus.publish(ctx.project.id, {"type": "alert", "alert": alert_json(a)})
    return alert_json(a)


class RuleIn(BaseModel):
    sensor_id: str
    level: Literal["attention", "warning", "critical"]
    comparator: Literal["gt", "lt", "abs_gt"]
    threshold: float
    criteria_reference: str = Field(min_length=5, max_length=500)
    enabled: bool = True


def _rule_json(r: AlertRule) -> dict:
    return {"id": r.id, "sensor_id": r.sensor_id, "level": r.level, "comparator": r.comparator, "threshold": r.threshold, "criteria_reference": r.criteria_reference,
            "is_demonstration": r.is_demonstration, "enabled": r.enabled, "created_by": r.created_by, "created_at": r.created_at.isoformat()}


@router.get("/projects/{project_id}/rules")
def list_rules(ctx: ProjectContext = Depends(require_project("view")), db: Session = Depends(get_db)):
    return [_rule_json(r) for r in db.query(AlertRule).filter(AlertRule.project_id == ctx.project.id).order_by(AlertRule.created_at)]


@router.post("/projects/{project_id}/rules", status_code=201)
def create_rule(body: RuleIn, request: Request, ctx: ProjectContext = Depends(require_project("criteria_edit")), db: Session = Depends(get_db)):
    if not db.query(Sensor).filter(Sensor.id == body.sensor_id, Sensor.project_id == ctx.project.id).count():
        raise HTTPException(422, "Sensor does not belong to this project.")
    r = AlertRule(project_id=ctx.project.id, created_by=ctx.principal.user.id, **body.model_dump())
    db.add(r)
    db.commit()
    audit(db, "twin.criterion_created", user_id=ctx.principal.user.id, project_id=ctx.project.id, target=r.id, request=request, rule=_rule_json(r))
    return _rule_json(r)


@router.patch("/projects/{project_id}/rules/{rule_id}")
def update_rule(rule_id: str, body: RuleIn, request: Request, ctx: ProjectContext = Depends(require_project("criteria_edit")), db: Session = Depends(get_db)):
    r = db.query(AlertRule).filter(AlertRule.id == rule_id, AlertRule.project_id == ctx.project.id).one_or_none()
    if not r:
        raise HTTPException(404, "Rule not found.")
    before = _rule_json(r)
    for k, v in body.model_dump().items():
        setattr(r, k, v)
    r.is_demonstration = False if before["threshold"] != r.threshold or before["criteria_reference"] != r.criteria_reference else r.is_demonstration
    db.commit()
    audit(db, "twin.criterion_changed", user_id=ctx.principal.user.id, project_id=ctx.project.id, target=r.id, request=request, before=before, after=_rule_json(r))
    return _rule_json(r)

# ------------------------------------------------------------------ gateways & ingestion


class GatewayIn(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    data_source: Literal["live", "historical", "imported"] = "live"


@router.get("/projects/{project_id}/gateways")
def list_gateways(ctx: ProjectContext = Depends(require_project("sensors_manage")), db: Session = Depends(get_db)):
    return [{"id": g.id, "name": g.name, "data_source": g.data_source, "created_at": g.created_at.isoformat(), "revoked_at": g.revoked_at.isoformat() if g.revoked_at else None,
             "last_seen_at": g.last_seen_at.isoformat() if g.last_seen_at else None} for g in db.query(Gateway).filter(Gateway.project_id == ctx.project.id)]


@router.post("/projects/{project_id}/gateways", status_code=201)
def create_gateway(body: GatewayIn, request: Request, ctx: ProjectContext = Depends(require_project("sensors_manage")), db: Session = Depends(get_db)):
    key = "drg_" + new_token()
    g = Gateway(project_id=ctx.project.id, name=body.name, key_hash=token_hash(key), data_source=body.data_source, created_by=ctx.principal.user.id)
    db.add(g)
    db.commit()
    audit(db, "twin.gateway_created", user_id=ctx.principal.user.id, project_id=ctx.project.id, target=g.id, request=request)
    return {"id": g.id, "name": g.name, "key": key, "note": "Store this key securely; it is shown only once."}


@router.delete("/projects/{project_id}/gateways/{gateway_id}")
def revoke_gateway(gateway_id: str, request: Request, ctx: ProjectContext = Depends(require_project("sensors_manage")), db: Session = Depends(get_db)):
    g = db.query(Gateway).filter(Gateway.id == gateway_id, Gateway.project_id == ctx.project.id).one_or_none()
    if not g:
        raise HTTPException(404, "Gateway not found.")
    g.revoked_at = utcnow()
    db.commit()
    audit(db, "twin.gateway_revoked", user_id=ctx.principal.user.id, project_id=ctx.project.id, target=g.id, request=request)
    return {"message": "Gateway key revoked."}


class ObsIn(BaseModel):
    sensor_code: str
    ts: datetime
    value: float | None
    quality: Literal["good", "suspect", "bad", "missing", "unchecked"] = "unchecked"


class IngestIn(BaseModel):
    observations: list[ObsIn] = Field(min_length=1, max_length=5000)


@ingest_router.post("/observations", status_code=202)
def ingest(body: IngestIn, request: Request, db: Session = Depends(get_db)):
    """Gateway ingestion (REST; the MQTT bridge in services/data-ingestion forwards here). Auth: X-DR-Gateway-Key."""
    key = request.headers.get("x-dr-gateway-key", "")
    g = db.query(Gateway).filter(Gateway.key_hash == token_hash(key), Gateway.revoked_at.is_(None)).one_or_none() if key else None
    if not g:
        audit(db, "ingest.rejected", outcome="denied", request=request, reason="invalid gateway key")
        raise HTTPException(401, "Invalid or revoked gateway key.")
    from ..rls import set_context
    set_context(db, gateway_project=g.project_id)  # RLS: this request may only touch the gateway's own project
    if not limiter.hit(f"ingest:{g.id}", get_settings().ingest_rate_per_minute):
        raise HTTPException(429, "Ingestion rate limit exceeded.")
    sensors = {s.code: s for s in db.query(Sensor).filter(Sensor.project_id == g.project_id)}
    now = utcnow()
    accepted, rejected = 0, []
    grouped: dict[str, list] = {}
    for o in body.observations:
        s = sensors.get(o.sensor_code)
        if not s:
            rejected.append({"sensor_code": o.sensor_code, "reason": "unknown sensor for this gateway's project"}); continue
        if o.ts.tzinfo is None:
            rejected.append({"sensor_code": o.sensor_code, "reason": "timestamp without time zone"}); continue
        if o.ts > now + timedelta(minutes=5):
            rejected.append({"sensor_code": o.sensor_code, "reason": "timestamp in the future"}); continue
        q = "missing" if o.value is None else o.quality
        grouped.setdefault(s.code, []).append((o.ts, o.value, q))
    for code, rows in grouped.items():
        rows.sort(key=lambda r: r[0])
        accepted += store_observations(db, sensors[code], rows, g.data_source)
    g.last_seen_at = now
    db.commit()
    return {"accepted": accepted, "rejected": rejected}

# ------------------------------------------------------------------ live stream


@router.websocket("/projects/{project_id}/stream")
async def stream(ws: WebSocket, project_id: str):
    origin = ws.headers.get("origin")
    settings = get_settings()
    if origin and origin not in settings.origins:
        await ws.close(code=4403)
        return
    with SessionLocal() as db:
        class _Req:  # minimal shim so cookie-based auth can be reused
            cookies = ws.cookies
        p = optional_principal(_Req(), db)  # type: ignore[arg-type]
        if p is None:
            await ws.close(code=4401)
            return
        try:
            project_context(db, p, project_id)
        except HTTPException:
            await ws.close(code=4404)
            return
        session_id = p.session.id
    await ws.accept()
    q = bus.subscribe(project_id)
    try:
        await ws.send_json({"type": "hello", "project_id": project_id, "server_time": utcnow().isoformat()})
        last_check = utcnow()
        while True:
            try:
                ev = await asyncio.wait_for(q.get(), timeout=15)
                await ws.send_json(ev)
            except asyncio.TimeoutError:
                await ws.send_json({"type": "heartbeat", "server_time": utcnow().isoformat()})
            if (utcnow() - last_check).total_seconds() > 30:  # re-validate session & membership periodically
                last_check = utcnow()
                with SessionLocal() as db:
                    s = db.get(UserSession, session_id)
                    if not s or s.revoked_at or s.expires_at <= utcnow():
                        await ws.close(code=4401); return
                    pr = db.get(Project, project_id)
                    from ..deps import Principal as _P
                    if not resolve_role(db, _P(user=s.user, session=s), pr):
                        await ws.close(code=4403); return
    except WebSocketDisconnect:
        pass
    finally:
        bus.unsubscribe(project_id, q)

"""Digital Twin entities: projects, memberships and access workflow (Stage 3 identity scope);
assets, sensors, observations, alerts are added in Stage 4."""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import Boolean, ForeignKey, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from .db import Base
from .models import JSONType, TZDateTime, now, uid

PROJECT_ROLES = ("project_admin", "project_engineer", "researcher", "monitoring_operator", "viewer")


class Project(Base):
    __tablename__ = "project"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    organisation_id: Mapped[str | None] = mapped_column(ForeignKey("organisation.id", ondelete="SET NULL"), nullable=True, index=True)
    code: Mapped[str] = mapped_column(String(32), unique=True)
    name: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text, default="")
    data_mode: Mapped[str] = mapped_column(String(32), default="simulated")  # simulated | live | historical | mixed
    require_mfa: Mapped[bool] = mapped_column(Boolean, default=True)
    settings: Mapped[dict] = mapped_column(JSONType, default=dict)
    created_at: Mapped[datetime] = mapped_column(TZDateTime(), default=now)


class ProjectMember(Base):
    __tablename__ = "project_member"
    __table_args__ = (UniqueConstraint("project_id", "user_id"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    project_id: Mapped[str] = mapped_column(ForeignKey("project.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("app_user.id", ondelete="CASCADE"), index=True)
    role: Mapped[str] = mapped_column(String(32))
    granted_by: Mapped[str | None] = mapped_column(String(36), nullable=True)
    granted_at: Mapped[datetime] = mapped_column(TZDateTime(), default=now)
    revoked_at: Mapped[datetime | None] = mapped_column(TZDateTime(), nullable=True)


# ------------------------------------------------------------------ Stage 4: structure, sensors, data, alerts, access workflow
from sqlalchemy import BigInteger, Float, Index, Integer  # noqa: E402

ROLE_PERMISSIONS: dict[str, set[str]] = {
    "project_admin": {"view", "export", "alert_ack", "sensors_manage", "criteria_edit", "members_manage", "models_publish"},
    "project_engineer": {"view", "export", "alert_ack", "sensors_manage", "criteria_edit", "models_publish"},
    "researcher": {"view", "export"},
    "monitoring_operator": {"view", "alert_ack"},
    "viewer": {"view"},
}


class Asset(Base):
    __tablename__ = "asset"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    project_id: Mapped[str] = mapped_column(ForeignKey("project.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(200))
    asset_type: Mapped[str] = mapped_column(String(64), default="concrete_gravity_dam")
    description: Mapped[str] = mapped_column(Text, default="")
    is_illustrative: Mapped[bool] = mapped_column(Boolean, default=False)
    model_ref: Mapped[str | None] = mapped_column(String(400), nullable=True)  # GLB/glTF object key, if supplied
    geometry: Mapped[dict] = mapped_column(JSONType, default=dict)  # parametric geometry for the built-in demonstration model
    created_at: Mapped[datetime] = mapped_column(TZDateTime(), default=now)


class Component(Base):
    __tablename__ = "structural_component"
    __table_args__ = (UniqueConstraint("asset_id", "code"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    project_id: Mapped[str] = mapped_column(ForeignKey("project.id", ondelete="CASCADE"), index=True)
    asset_id: Mapped[str] = mapped_column(ForeignKey("asset.id", ondelete="CASCADE"), index=True)
    code: Mapped[str] = mapped_column(String(64))
    name: Mapped[str] = mapped_column(String(200))
    kind: Mapped[str] = mapped_column(String(64))  # crest, upstream_face, downstream_face, heel, toe, foundation, gallery, spillway, block, joint


class Sensor(Base):
    __tablename__ = "sensor"
    __table_args__ = (UniqueConstraint("project_id", "code"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    project_id: Mapped[str] = mapped_column(ForeignKey("project.id", ondelete="CASCADE"), index=True)
    asset_id: Mapped[str | None] = mapped_column(ForeignKey("asset.id", ondelete="SET NULL"), nullable=True)
    component_id: Mapped[str | None] = mapped_column(ForeignKey("structural_component.id", ondelete="SET NULL"), nullable=True)
    code: Mapped[str] = mapped_column(String(64))
    name: Mapped[str] = mapped_column(String(200))
    sensor_type: Mapped[str] = mapped_column(String(64))
    variable: Mapped[str] = mapped_column(String(64))
    unit: Mapped[str] = mapped_column(String(32))
    x: Mapped[float] = mapped_column(Float, default=0.0)
    y: Mapped[float] = mapped_column(Float, default=0.0)
    z: Mapped[float] = mapped_column(Float, default=0.0)
    frequency_s: Mapped[int] = mapped_column(Integer, default=600)
    source: Mapped[str] = mapped_column(String(16), default="simulated")  # live | historical | simulated | imported
    calibration: Mapped[dict] = mapped_column(JSONType, default=dict)
    status: Mapped[str] = mapped_column(String(16), default="active")  # active | offline | fault | maintenance | decommissioned
    installed_at: Mapped[datetime | None] = mapped_column(TZDateTime(), nullable=True)
    notes: Mapped[str] = mapped_column(Text, default="")
    sim: Mapped[dict] = mapped_column(JSONType, default=dict)  # demonstration simulator parameters (only for source=simulated)
    created_at: Mapped[datetime] = mapped_column(TZDateTime(), default=now)


class Observation(Base):
    __tablename__ = "observation"
    __table_args__ = (Index("ix_observation_sensor_ts", "sensor_id", "ts"),)
    id: Mapped[int] = mapped_column(BigInteger().with_variant(Integer, "sqlite"), primary_key=True, autoincrement=True)
    project_id: Mapped[str] = mapped_column(String(36), index=True)
    asset_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    sensor_id: Mapped[str] = mapped_column(ForeignKey("sensor.id", ondelete="CASCADE"))
    ts: Mapped[datetime] = mapped_column(TZDateTime())
    value: Mapped[float | None] = mapped_column(Float, nullable=True)
    unit: Mapped[str] = mapped_column(String(32))
    quality: Mapped[str] = mapped_column(String(16), default="unchecked")  # good | suspect | bad | missing | unchecked
    source: Mapped[str] = mapped_column(String(16))
    ingested_at: Mapped[datetime] = mapped_column(TZDateTime(), default=now)


class AlertRule(Base):
    __tablename__ = "alert_rule"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    project_id: Mapped[str] = mapped_column(ForeignKey("project.id", ondelete="CASCADE"), index=True)
    sensor_id: Mapped[str] = mapped_column(ForeignKey("sensor.id", ondelete="CASCADE"), index=True)
    level: Mapped[str] = mapped_column(String(16))  # attention | warning | critical
    comparator: Mapped[str] = mapped_column(String(8))  # gt | lt | abs_gt
    threshold: Mapped[float] = mapped_column(Float)
    criteria_reference: Mapped[str] = mapped_column(String(500))  # documented basis, mandatory
    is_demonstration: Mapped[bool] = mapped_column(Boolean, default=False)
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)
    created_by: Mapped[str | None] = mapped_column(String(36), nullable=True)
    created_at: Mapped[datetime] = mapped_column(TZDateTime(), default=now)


class Alert(Base):
    __tablename__ = "alert"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    project_id: Mapped[str] = mapped_column(ForeignKey("project.id", ondelete="CASCADE"), index=True)
    sensor_id: Mapped[str | None] = mapped_column(ForeignKey("sensor.id", ondelete="SET NULL"), nullable=True)
    rule_id: Mapped[str | None] = mapped_column(ForeignKey("alert_rule.id", ondelete="SET NULL"), nullable=True)
    kind: Mapped[str] = mapped_column(String(32))  # threshold | missing_data | communication | sensor_fault | model_deviation | anomaly
    severity: Mapped[str] = mapped_column(String(16))
    message: Mapped[str] = mapped_column(String(500))
    value: Mapped[float | None] = mapped_column(Float, nullable=True)
    observed_at: Mapped[datetime | None] = mapped_column(TZDateTime(), nullable=True)
    source: Mapped[str] = mapped_column(String(16), default="simulated")
    status: Mapped[str] = mapped_column(String(16), default="open")  # open | acknowledged | closed
    created_at: Mapped[datetime] = mapped_column(TZDateTime(), default=now, index=True)
    acknowledged_by: Mapped[str | None] = mapped_column(String(36), nullable=True)
    acknowledged_at: Mapped[datetime | None] = mapped_column(TZDateTime(), nullable=True)
    closed_by: Mapped[str | None] = mapped_column(String(36), nullable=True)
    closed_at: Mapped[datetime | None] = mapped_column(TZDateTime(), nullable=True)
    closure_note: Mapped[str | None] = mapped_column(String(1000), nullable=True)


class Gateway(Base):
    __tablename__ = "gateway"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    project_id: Mapped[str] = mapped_column(ForeignKey("project.id", ondelete="CASCADE"), index=True)
    name: Mapped[str] = mapped_column(String(200))
    key_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    data_source: Mapped[str] = mapped_column(String(16), default="live")  # live | historical | imported
    created_by: Mapped[str | None] = mapped_column(String(36), nullable=True)
    created_at: Mapped[datetime] = mapped_column(TZDateTime(), default=now)
    revoked_at: Mapped[datetime | None] = mapped_column(TZDateTime(), nullable=True)
    last_seen_at: Mapped[datetime | None] = mapped_column(TZDateTime(), nullable=True)


class Invitation(Base):
    __tablename__ = "invitation"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    project_id: Mapped[str] = mapped_column(ForeignKey("project.id", ondelete="CASCADE"), index=True)
    email: Mapped[str] = mapped_column(String(320), index=True)
    role: Mapped[str] = mapped_column(String(32))
    token_hash: Mapped[str] = mapped_column(String(64), unique=True)
    invited_by: Mapped[str] = mapped_column(String(36))
    created_at: Mapped[datetime] = mapped_column(TZDateTime(), default=now)
    expires_at: Mapped[datetime] = mapped_column(TZDateTime())
    accepted_at: Mapped[datetime | None] = mapped_column(TZDateTime(), nullable=True)
    revoked_at: Mapped[datetime | None] = mapped_column(TZDateTime(), nullable=True)


class AccessRequest(Base):
    __tablename__ = "access_request"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=uid)
    project_id: Mapped[str] = mapped_column(ForeignKey("project.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("app_user.id", ondelete="CASCADE"), index=True)
    role: Mapped[str] = mapped_column(String(32))
    justification: Mapped[str] = mapped_column(Text, default="")
    status: Mapped[str] = mapped_column(String(16), default="pending")
    created_at: Mapped[datetime] = mapped_column(TZDateTime(), default=now)
    decided_by: Mapped[str | None] = mapped_column(String(36), nullable=True)
    decided_at: Mapped[datetime | None] = mapped_column(TZDateTime(), nullable=True)

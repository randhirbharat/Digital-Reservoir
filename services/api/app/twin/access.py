"""Project-level authorisation for the Digital Twin. Every project-scoped request resolves membership server-side;
non-members receive 404 (not 403) so project existence is not disclosed."""
from __future__ import annotations

from dataclasses import dataclass

from fastapi import Depends, HTTPException, Request
from sqlalchemy.orm import Session

from ..audit import audit
from ..config import get_settings
from ..db import get_db
from ..deps import Principal, require_user
from ..models import OrgMember
from ..models_twin import ROLE_PERMISSIONS, Project, ProjectMember


@dataclass
class ProjectContext:
    principal: Principal
    project: Project
    role: str
    permissions: set[str]


def resolve_role(db: Session, p: Principal, project: Project) -> str | None:
    if p.user.is_superadmin:
        return "project_admin"
    m = db.query(ProjectMember).filter(ProjectMember.project_id == project.id, ProjectMember.user_id == p.user.id, ProjectMember.revoked_at.is_(None)).one_or_none()
    if m:
        return m.role
    if project.organisation_id and db.query(OrgMember).filter(OrgMember.organisation_id == project.organisation_id, OrgMember.user_id == p.user.id, OrgMember.role == "institutional_admin").count():
        return "project_admin"
    return None


def project_context(db: Session, p: Principal, project_id: str, request: Request | None = None) -> ProjectContext:
    project = db.get(Project, project_id)
    role = resolve_role(db, p, project) if project else None
    if not project or not role:
        audit(db, "twin.access_denied", user_id=p.user.id, outcome="denied", project_id=project_id, request=request, reason="not a member")
        raise HTTPException(404, "Project not found.")
    from ..rls import set_context
    set_context(db, user_id=p.user.id, superadmin="on" if p.user.is_superadmin else "off")
    if project.require_mfa and get_settings().twin_enforce_mfa and not p.session.mfa_passed:
        audit(db, "twin.access_denied", user_id=p.user.id, outcome="denied", project_id=project_id, request=request, reason="mfa required")
        raise HTTPException(403, "This project requires multi-factor authentication. Sign in with MFA (enable it under Account & security).")
    return ProjectContext(p, project, role, ROLE_PERMISSIONS[role])


def require_project(permission: str = "view"):
    def dep(project_id: str, request: Request, p: Principal = Depends(require_user), db: Session = Depends(get_db)) -> ProjectContext:
        ctx = project_context(db, p, project_id, request)
        if permission not in ctx.permissions:
            audit(db, "twin.permission_denied", user_id=p.user.id, outcome="denied", project_id=project_id, target=permission, request=request, role=ctx.role)
            raise HTTPException(403, f"Your project role ({ctx.role.replace('_', ' ')}) does not permit '{permission}'.")
        return ctx
    return dep

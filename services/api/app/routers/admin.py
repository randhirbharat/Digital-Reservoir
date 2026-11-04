from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.orm import Session

from ..audit import audit
from ..db import get_db
from ..deps import Principal, require_superadmin
from ..models import AuditLog, User, UserSession
from ..security import utcnow

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/users")
def users(q: str = "", p: Principal = Depends(require_superadmin), db: Session = Depends(get_db)):
    query = db.query(User)
    if q:
        query = query.filter(User.email.ilike(f"%{q}%") | User.full_name.ilike(f"%{q}%"))
    return [{"id": u.id, "email": u.email, "full_name": u.full_name, "membership_category": u.membership_category, "is_active": u.is_active,
             "email_verified": bool(u.email_verified_at), "mfa_enabled": u.mfa_enabled, "is_superadmin": u.is_superadmin,
             "last_login_at": u.last_login_at, "created_at": u.created_at} for u in query.order_by(User.created_at.desc()).limit(500)]


class UserPatch(BaseModel):
    membership_category: Literal["general", "student", "researcher", "professional", "administrator"] | None = None
    is_active: bool | None = None
    suspended_reason: str | None = None
    extra_permissions: list[str] | None = None


@router.patch("/users/{user_id}")
def patch_user(user_id: str, body: UserPatch, request: Request, p: Principal = Depends(require_superadmin), db: Session = Depends(get_db)):
    u = db.get(User, user_id)
    if not u:
        raise HTTPException(404, "User not found.")
    if u.id == p.user.id and body.is_active is False:
        raise HTTPException(400, "You cannot suspend your own account.")
    changes = body.model_dump(exclude_none=True)
    for k, v in changes.items():
        setattr(u, k, v)
    if body.is_active is False:  # suspension revokes every active session immediately
        db.query(UserSession).filter(UserSession.user_id == u.id, UserSession.revoked_at.is_(None)).update({"revoked_at": utcnow()})
    db.commit()
    audit(db, "admin.user_updated", user_id=p.user.id, target=u.id, request=request, changes=changes)
    return {"message": "Updated."}


@router.get("/audit")
def audit_log(action: str = "", user_id: str = "", outcome: str = "", limit: int = 200, p: Principal = Depends(require_superadmin), db: Session = Depends(get_db)):
    q = db.query(AuditLog)
    if action:
        q = q.filter(AuditLog.action.like(f"{action}%"))
    if user_id:
        q = q.filter(AuditLog.user_id == user_id)
    if outcome:
        q = q.filter(AuditLog.outcome == outcome)
    return [{"at": a.at, "user_id": a.user_id, "action": a.action, "outcome": a.outcome, "project_id": a.project_id, "target": a.target, "ip": a.ip, "detail": a.detail}
            for a in q.order_by(AuditLog.at.desc()).limit(min(limit, 2000))]

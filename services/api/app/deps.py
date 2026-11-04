"""Authentication and authorisation dependencies. Every protected endpoint resolves the user and their
permissions server-side; the frontends only reflect these decisions."""
from __future__ import annotations

from dataclasses import dataclass
from datetime import timedelta

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from .audit import audit
from .config import LAB_PERMISSIONS, UPLOAD_LIMIT_MB, get_settings
from .db import get_db
from .models import User, UserSession
from .security import token_hash, utcnow


@dataclass
class Principal:
    user: User
    session: UserSession

    @property
    def lab_permissions(self) -> set[str]:
        return lab_permissions(self.user)


def lab_permissions(user: User) -> set[str]:
    if not user.email_verified_at or not user.is_active:
        return set()
    if user.is_superadmin:
        return set().union(*LAB_PERMISSIONS.values())
    return set(LAB_PERMISSIONS.get(user.membership_category, set())) | set(user.extra_permissions or [])


def upload_limit_bytes(user: User) -> int:
    mb = UPLOAD_LIMIT_MB["administrator"] if user.is_superadmin else UPLOAD_LIMIT_MB.get(user.membership_category, 10)
    return mb * 1024 * 1024


def optional_principal(request: Request, db: Session = Depends(get_db)) -> Principal | None:
    s = get_settings()
    token = request.cookies.get(s.cookie_name)
    if not token:
        return None
    sess = db.query(UserSession).filter(UserSession.token_hash == token_hash(token)).one_or_none()
    now = utcnow()
    if not sess or sess.revoked_at or sess.expires_at <= now:
        return None
    if now - sess.last_seen_at > timedelta(minutes=s.session_idle_minutes):
        sess.revoked_at = now
        db.commit()
        return None
    user = sess.user
    if not user.is_active:
        return None
    if now - sess.last_seen_at > timedelta(seconds=60):
        sess.last_seen_at = now
        db.commit()
    return Principal(user=user, session=sess)


def require_user(p: Principal | None = Depends(optional_principal)) -> Principal:
    if p is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Authentication required.")
    return p


def require_verified(p: Principal = Depends(require_user)) -> Principal:
    if not p.user.email_verified_at:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Verify your email address to use the Engineering Lab.")
    return p


def require_lab(permission: str):
    def dep(request: Request, p: Principal = Depends(require_verified), db: Session = Depends(get_db)) -> Principal:
        if permission not in p.lab_permissions:
            audit(db, "lab.permission_denied", user_id=p.user.id, outcome="denied", target=permission, request=request)
            raise HTTPException(status.HTTP_403_FORBIDDEN, f"Your membership category does not include '{permission}'.")
        return p
    return dep


def require_superadmin(request: Request, p: Principal = Depends(require_user), db: Session = Depends(get_db)) -> Principal:
    if not p.user.is_superadmin:
        audit(db, "admin.denied", user_id=p.user.id, outcome="denied", request=request, path=str(request.url.path))
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Administrator privileges required.")
    if get_settings().require_mfa_for_admins and not p.session.mfa_passed:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Multi-factor authentication is required for administrator actions.")
    return p

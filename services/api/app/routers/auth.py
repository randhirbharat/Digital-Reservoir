from __future__ import annotations

from datetime import timedelta
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from pydantic import BaseModel, EmailStr, Field
from sqlalchemy.orm import Session

from ..audit import audit, client_ip
from ..config import get_settings
from ..db import get_db
from ..deps import Principal, lab_permissions, require_user
from ..emailer import send_email
from ..models import OneTimeToken, User, UserSession
from ..security import (decrypt_secret, encrypt_secret, hash_password, limiter, new_token, new_totp_secret, password_problems,
                        session_expiry, token_hash, totp_uri, utcnow, verify_password, verify_totp)

router = APIRouter(prefix="/auth", tags=["auth"])

SELF_SERVICE_CATEGORIES = ("general", "student", "researcher", "professional")


class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=256)
    full_name: str = Field(min_length=1, max_length=200)
    organisation: str = Field(default="", max_length=200)
    membership_category: Literal["general", "student", "researcher", "professional"] = "general"
    accept_terms: bool


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(max_length=256)


class MfaLoginIn(BaseModel):
    mfa_token: str
    code: str


class TokenIn(BaseModel):
    token: str


class EmailIn(BaseModel):
    email: EmailStr


class ResetIn(BaseModel):
    token: str
    password: str = Field(max_length=256)


class CodeIn(BaseModel):
    code: str


class PasswordChangeIn(BaseModel):
    current_password: str
    new_password: str


def _rate(request: Request, scope: str, limit: int | None = None):
    if not limiter.hit(f"{scope}:{client_ip(request)}", limit or get_settings().login_rate_per_minute):
        raise HTTPException(status.HTTP_429_TOO_MANY_REQUESTS, "Too many attempts. Please wait a minute and try again.")


def _issue_token(db: Session, user: User, purpose: str, minutes: int) -> str:
    tok = new_token()
    db.add(OneTimeToken(user_id=user.id, purpose=purpose, token_hash=token_hash(tok), expires_at=utcnow() + timedelta(minutes=minutes)))
    db.commit()
    return tok


def _consume_token(db: Session, raw: str, purpose: str) -> OneTimeToken:
    t = db.query(OneTimeToken).filter(OneTimeToken.token_hash == token_hash(raw), OneTimeToken.purpose == purpose).one_or_none()
    if not t or t.used_at or t.expires_at <= utcnow():
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "This link or code is invalid or has expired.")
    t.used_at = utcnow()
    return t


def _set_cookie(response: Response, token: str):
    s = get_settings()
    response.set_cookie(s.cookie_name, token, max_age=s.session_hours * 3600, httponly=True, secure=s.cookie_secure,
                        samesite="lax", domain=s.cookie_domain, path="/")


def _start_session(db: Session, user: User, request: Request, response: Response, mfa_passed: bool) -> None:
    tok = new_token()
    db.add(UserSession(user_id=user.id, token_hash=token_hash(tok), expires_at=session_expiry(), mfa_passed=mfa_passed,
                       ip=client_ip(request), user_agent=(request.headers.get("user-agent") or "")[:300]))
    user.last_login_at = utcnow()
    user.failed_logins = 0
    user.locked_until = None
    db.commit()
    _set_cookie(response, tok)


def me_payload(db: Session, p: Principal) -> dict:
    from ..models_twin import Project, ProjectMember

    u = p.user
    if u.is_superadmin:
        projects = [{"project_id": pr.id, "project_name": pr.name, "role": "project_admin"} for pr in db.query(Project).order_by(Project.name)]
    else:
        rows = db.query(ProjectMember, Project).join(Project, Project.id == ProjectMember.project_id).filter(
            ProjectMember.user_id == u.id, ProjectMember.revoked_at.is_(None)).order_by(Project.name).all()
        projects = [{"project_id": pr.id, "project_name": pr.name, "role": m.role} for m, pr in rows]
    perms = sorted(lab_permissions(u))
    return {"id": u.id, "email": u.email, "full_name": u.full_name, "organisation": u.organisation_name, "membership_category": u.membership_category,
            "is_superadmin": u.is_superadmin, "email_verified": u.email_verified_at is not None, "mfa_enabled": u.mfa_enabled,
            "session_mfa_passed": p.session.mfa_passed, "lab_access": bool(perms), "lab_permissions": perms, "twin_projects": projects,
            "created_at": u.created_at.isoformat(), "session_expires_at": p.session.expires_at.isoformat()}


@router.post("/register", status_code=201)
def register(body: RegisterIn, request: Request, db: Session = Depends(get_db)):
    _rate(request, "register", 5)
    if not body.accept_terms:
        raise HTTPException(422, "You must accept the terms of use.")
    problems = password_problems(body.password, body.email)
    if problems:
        raise HTTPException(422, "Password must have: " + ", ".join(problems) + ".")
    email = body.email.lower()
    generic = {"message": "If the address can be registered, a verification email has been sent."}
    existing = db.query(User).filter(User.email == email).one_or_none()
    if existing:
        # Do not reveal whether the address is registered; notify the owner instead.
        send_email(db, email, "Digital Reservoir — registration attempt", "Someone tried to register with this address. If it was you, sign in or reset your password.")
        audit(db, "auth.register_existing", user_id=existing.id, request=request)
        return generic
    user = User(email=email, full_name=body.full_name.strip(), organisation_name=body.organisation.strip(), password_hash=hash_password(body.password),
                membership_category=body.membership_category)
    db.add(user)
    db.commit()
    tok = _issue_token(db, user, "verify_email", 24 * 60)
    s = get_settings()
    send_email(db, email, "Verify your Digital Reservoir account",
               f"Welcome to the Digital Reservoir Engineering Lab.\n\nVerify your email within 24 hours:\n{s.lab_url}/verify-email?token={tok}\n\nIf you did not register, ignore this message.")
    audit(db, "auth.register", user_id=user.id, request=request, category=body.membership_category)
    return generic


@router.post("/verify-email")
def verify_email(body: TokenIn, request: Request, db: Session = Depends(get_db)):
    _rate(request, "verify", 20)
    t = _consume_token(db, body.token, "verify_email")
    user = db.get(User, t.user_id)
    if user.email_verified_at is None:
        user.email_verified_at = utcnow()
    db.commit()
    audit(db, "auth.email_verified", user_id=user.id, request=request)
    return {"message": "Email verified. You can now sign in."}


@router.post("/resend-verification")
def resend_verification(body: EmailIn, request: Request, db: Session = Depends(get_db)):
    _rate(request, "resend", 3)
    user = db.query(User).filter(User.email == body.email.lower()).one_or_none()
    if user and not user.email_verified_at:
        tok = _issue_token(db, user, "verify_email", 24 * 60)
        send_email(db, user.email, "Verify your Digital Reservoir account", f"Verify your email:\n{get_settings().lab_url}/verify-email?token={tok}")
    return {"message": "If the account exists and is unverified, a new link has been sent."}


@router.post("/login")
def login(body: LoginIn, request: Request, response: Response, db: Session = Depends(get_db)):
    _rate(request, "login")
    s = get_settings()
    user = db.query(User).filter(User.email == body.email.lower()).one_or_none()
    now = utcnow()
    fail = HTTPException(status.HTTP_401_UNAUTHORIZED, "Incorrect email or password.")
    if user is None:
        verify_password(body.password, hash_password("timing-equaliser"))  # comparable timing for unknown accounts
        audit(db, "auth.login", outcome="failure", request=request, target=body.email.lower()[:200], reason="unknown")
        raise fail
    if user.locked_until and user.locked_until > now:
        audit(db, "auth.login", user_id=user.id, outcome="denied", request=request, reason="locked")
        raise HTTPException(status.HTTP_423_LOCKED, "Account temporarily locked after repeated failed sign-ins. Try again later or reset your password.")
    if not verify_password(body.password, user.password_hash):
        user.failed_logins += 1
        if user.failed_logins >= s.max_failed_logins:
            user.locked_until = now + timedelta(minutes=s.lockout_minutes)
            user.failed_logins = 0
        db.commit()
        audit(db, "auth.login", user_id=user.id, outcome="failure", request=request, reason="password")
        raise fail
    if not user.is_active:
        audit(db, "auth.login", user_id=user.id, outcome="denied", request=request, reason="suspended")
        raise HTTPException(status.HTTP_403_FORBIDDEN, "This account is suspended. Contact the platform administrator.")
    if user.mfa_enabled:
        tok = _issue_token(db, user, "mfa_login", 5)
        audit(db, "auth.login_password_ok", user_id=user.id, request=request)
        return {"mfa_required": True, "mfa_token": tok}
    _start_session(db, user, request, response, mfa_passed=False)
    audit(db, "auth.login", user_id=user.id, request=request, mfa=False)
    return {"mfa_required": False, "email_verified": user.email_verified_at is not None}


@router.post("/login/mfa")
def login_mfa(body: MfaLoginIn, request: Request, response: Response, db: Session = Depends(get_db)):
    _rate(request, "mfa")
    t = db.query(OneTimeToken).filter(OneTimeToken.token_hash == token_hash(body.mfa_token), OneTimeToken.purpose == "mfa_login").one_or_none()
    if not t or t.used_at or t.expires_at <= utcnow():
        raise HTTPException(401, "The sign-in step has expired. Start again.")
    user = db.get(User, t.user_id)
    if not user or not user.mfa_secret_enc or not verify_totp(decrypt_secret(user.mfa_secret_enc), body.code):
        audit(db, "auth.mfa", user_id=t.user_id, outcome="failure", request=request)
        raise HTTPException(401, "Invalid authentication code.")
    t.used_at = utcnow()
    _start_session(db, user, request, response, mfa_passed=True)
    audit(db, "auth.login", user_id=user.id, request=request, mfa=True)
    return {"mfa_required": False, "email_verified": user.email_verified_at is not None}


@router.post("/logout")
def logout(request: Request, response: Response, p: Principal = Depends(require_user), db: Session = Depends(get_db)):
    p.session.revoked_at = utcnow()
    db.commit()
    s = get_settings()
    response.delete_cookie(s.cookie_name, domain=s.cookie_domain, path="/")
    audit(db, "auth.logout", user_id=p.user.id, request=request)
    return {"message": "Signed out."}


@router.get("/me")
def me(p: Principal = Depends(require_user), db: Session = Depends(get_db)):
    return me_payload(db, p)


@router.post("/password/forgot")
def forgot(body: EmailIn, request: Request, db: Session = Depends(get_db)):
    _rate(request, "forgot", 5)
    user = db.query(User).filter(User.email == body.email.lower()).one_or_none()
    if user and user.is_active:
        tok = _issue_token(db, user, "reset_password", 30)
        send_email(db, user.email, "Reset your Digital Reservoir password",
                   f"Reset your password within 30 minutes:\n{get_settings().lab_url}/reset-password?token={tok}\n\nIf you did not request this, ignore this message.")
        audit(db, "auth.password_reset_requested", user_id=user.id, request=request)
    return {"message": "If the account exists, a reset link has been sent."}


@router.post("/password/reset")
def reset(body: ResetIn, request: Request, db: Session = Depends(get_db)):
    _rate(request, "reset", 10)
    t = _consume_token(db, body.token, "reset_password")
    user = db.get(User, t.user_id)
    problems = password_problems(body.password, user.email)
    if problems:
        raise HTTPException(422, "Password must have: " + ", ".join(problems) + ".")
    user.password_hash = hash_password(body.password)
    # Revoke every existing session after a password reset.
    db.query(UserSession).filter(UserSession.user_id == user.id, UserSession.revoked_at.is_(None)).update({"revoked_at": utcnow()})
    db.commit()
    audit(db, "auth.password_reset", user_id=user.id, request=request)
    return {"message": "Password updated. Sign in with your new password."}


@router.post("/password/change")
def change_password(body: PasswordChangeIn, request: Request, response: Response, p: Principal = Depends(require_user), db: Session = Depends(get_db)):
    if not verify_password(body.current_password, p.user.password_hash):
        raise HTTPException(400, "Current password is incorrect.")
    problems = password_problems(body.new_password, p.user.email)
    if problems:
        raise HTTPException(422, "Password must have: " + ", ".join(problems) + ".")
    p.user.password_hash = hash_password(body.new_password)
    db.query(UserSession).filter(UserSession.user_id == p.user.id, UserSession.id != p.session.id, UserSession.revoked_at.is_(None)).update({"revoked_at": utcnow()})
    db.commit()
    audit(db, "auth.password_changed", user_id=p.user.id, request=request)
    return {"message": "Password changed; other sessions were signed out."}


@router.get("/sessions")
def sessions(p: Principal = Depends(require_user), db: Session = Depends(get_db)):
    rows = db.query(UserSession).filter(UserSession.user_id == p.user.id, UserSession.revoked_at.is_(None), UserSession.expires_at > utcnow()).order_by(UserSession.created_at.desc())
    return [{"id": s.id, "created_at": s.created_at, "last_seen_at": s.last_seen_at, "ip": s.ip, "user_agent": s.user_agent, "current": s.id == p.session.id, "mfa_passed": s.mfa_passed} for s in rows]


@router.delete("/sessions/{session_id}")
def revoke_session(session_id: str, request: Request, p: Principal = Depends(require_user), db: Session = Depends(get_db)):
    s = db.query(UserSession).filter(UserSession.id == session_id, UserSession.user_id == p.user.id).one_or_none()
    if not s:
        raise HTTPException(404, "Session not found.")
    s.revoked_at = utcnow()
    db.commit()
    audit(db, "auth.session_revoked", user_id=p.user.id, request=request, target=session_id)
    return {"message": "Session revoked."}


@router.post("/mfa/setup")
def mfa_setup(p: Principal = Depends(require_user), db: Session = Depends(get_db)):
    if p.user.mfa_enabled:
        raise HTTPException(400, "MFA is already enabled.")
    secret = new_totp_secret()
    p.user.mfa_secret_enc = encrypt_secret(secret)
    db.commit()
    return {"secret": secret, "otpauth_uri": totp_uri(secret, p.user.email), "note": "Add this to an authenticator app, then confirm with a code."}


@router.post("/mfa/enable")
def mfa_enable(body: CodeIn, request: Request, p: Principal = Depends(require_user), db: Session = Depends(get_db)):
    if not p.user.mfa_secret_enc or not verify_totp(decrypt_secret(p.user.mfa_secret_enc), body.code):
        raise HTTPException(400, "Invalid code. Check your authenticator app's time and try again.")
    p.user.mfa_enabled = True
    p.session.mfa_passed = True
    db.commit()
    audit(db, "auth.mfa_enabled", user_id=p.user.id, request=request)
    return {"message": "Multi-factor authentication enabled."}


@router.post("/mfa/disable")
def mfa_disable(body: CodeIn, request: Request, p: Principal = Depends(require_user), db: Session = Depends(get_db)):
    if not p.user.mfa_enabled or not verify_totp(decrypt_secret(p.user.mfa_secret_enc), body.code):
        raise HTTPException(400, "Invalid code.")
    p.user.mfa_enabled = False
    p.user.mfa_secret_enc = None
    p.session.mfa_passed = False
    db.commit()
    audit(db, "auth.mfa_disabled", user_id=p.user.id, request=request)
    return {"message": "Multi-factor authentication disabled."}

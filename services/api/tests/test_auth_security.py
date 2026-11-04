from datetime import timedelta

import pyotp

from app.db import SessionLocal
from app.models import AuditLog, User, UserSession
from app.security import utcnow
from conftest import H, PASSWORD, last_token, make_user, new_client


def test_register_verify_login_me():
    c = make_user("alice@example.org")
    me = c.get("/api/v1/auth/me").json()
    assert me["email"] == "alice@example.org" and me["email_verified"] and "lab.hst" in me["lab_permissions"]
    assert me["twin_projects"] == []


def test_unauthenticated_requests_are_rejected():
    c = new_client()
    for path in ("/api/v1/auth/me", "/api/v1/lab/datasets", "/api/v1/lab/projects", "/api/v1/admin/users"):
        assert c.get(path).status_code == 401, path


def test_csrf_header_required_for_state_changes():
    c = make_user("csrf@example.org")
    assert c.post("/api/v1/lab/projects", json={"name": "x"}).status_code == 403
    assert c.post("/api/v1/lab/projects", json={"name": "x"}, headers={**H, "Origin": "https://evil.example"}).status_code == 403
    assert c.post("/api/v1/lab/projects", json={"name": "x"}, headers=H).status_code == 201


def test_password_policy_and_duplicate_registration_is_not_disclosed():
    c = new_client()
    r = c.post("/api/v1/auth/register", json={"email": "weak@example.org", "password": "password123", "full_name": "W", "accept_terms": True}, headers=H)
    assert r.status_code == 422
    make_user("dup@example.org")
    r = c.post("/api/v1/auth/register", json={"email": "dup@example.org", "password": PASSWORD, "full_name": "D", "accept_terms": True}, headers=H)
    assert r.status_code == 201 and "If the address" in r.json()["message"]


def test_self_registration_cannot_choose_administrator():
    c = new_client()
    r = c.post("/api/v1/auth/register", json={"email": "esc@example.org", "password": PASSWORD, "full_name": "E", "membership_category": "administrator", "accept_terms": True}, headers=H)
    assert r.status_code == 422


def test_unverified_user_has_no_lab_access():
    c = make_user("unverified@example.org", verify=False)
    assert c.get("/api/v1/auth/me").json()["lab_access"] is False
    assert c.get("/api/v1/lab/datasets").status_code == 403


def test_lockout_after_failed_logins():
    make_user("lock@example.org")
    c = new_client()
    for _ in range(8):
        assert c.post("/api/v1/auth/login", json={"email": "lock@example.org", "password": "wrong-Password-1"}, headers=H).status_code == 401
    assert c.post("/api/v1/auth/login", json={"email": "lock@example.org", "password": PASSWORD}, headers=H).status_code == 423


def test_expired_and_revoked_sessions():
    c = make_user("sess@example.org")
    with SessionLocal() as db:
        u = db.query(User).filter(User.email == "sess@example.org").one()
        db.query(UserSession).filter(UserSession.user_id == u.id).update({"expires_at": utcnow() - timedelta(minutes=1)})
        db.commit()
    assert c.get("/api/v1/auth/me").status_code == 401
    c2 = make_user("sess2@example.org")
    assert c2.post("/api/v1/auth/logout", headers=H).status_code == 200
    assert c2.get("/api/v1/auth/me").status_code == 401


def test_admin_suspension_revokes_sessions_and_non_admin_denied():
    admin = make_user("root@example.org", superadmin=True)
    victim = make_user("victim@example.org")
    assert victim.get("/api/v1/admin/users").status_code == 403
    uid = victim.get("/api/v1/auth/me").json()["id"]
    assert admin.patch(f"/api/v1/admin/users/{uid}", json={"is_active": False, "suspended_reason": "test"}, headers=H).status_code == 200
    assert victim.get("/api/v1/auth/me").status_code == 401
    r = new_client().post("/api/v1/auth/login", json={"email": "victim@example.org", "password": PASSWORD}, headers=H)
    assert r.status_code == 403
    with SessionLocal() as db:
        assert db.query(AuditLog).filter(AuditLog.action == "admin.denied").count() >= 1


def test_mfa_flow():
    c = make_user("mfa@example.org")
    secret = c.post("/api/v1/auth/mfa/setup", headers=H).json()["secret"]
    assert c.post("/api/v1/auth/mfa/enable", json={"code": "000000"}, headers=H).status_code == 400
    assert c.post("/api/v1/auth/mfa/enable", json={"code": pyotp.TOTP(secret).now()}, headers=H).status_code == 200
    c.post("/api/v1/auth/logout", headers=H)
    n = new_client()
    r = n.post("/api/v1/auth/login", json={"email": "mfa@example.org", "password": PASSWORD}, headers=H).json()
    assert r["mfa_required"] and n.get("/api/v1/auth/me").status_code == 401
    assert n.post("/api/v1/auth/login/mfa", json={"mfa_token": r["mfa_token"], "code": "123456"}, headers=H).status_code == 401
    assert n.post("/api/v1/auth/login/mfa", json={"mfa_token": r["mfa_token"], "code": pyotp.TOTP(secret).now()}, headers=H).status_code == 200
    assert n.get("/api/v1/auth/me").json()["session_mfa_passed"] is True


def test_password_reset_revokes_sessions():
    c = make_user("reset@example.org")
    new_client().post("/api/v1/auth/password/forgot", json={"email": "reset@example.org"}, headers=H)
    tok = last_token("reset@example.org", "reset-password")
    assert new_client().post("/api/v1/auth/password/reset", json={"token": tok, "password": "Another-Strong-99"}, headers=H).status_code == 200
    assert c.get("/api/v1/auth/me").status_code == 401
    assert new_client().post("/api/v1/auth/password/reset", json={"token": tok, "password": "Another-Strong-98"}, headers=H).status_code == 400

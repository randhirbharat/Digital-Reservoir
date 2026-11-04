import os
import re
import tempfile

_tmp = tempfile.mkdtemp(prefix="dr_api_test_")
os.environ.setdefault("DR_DATABASE_URL", f"sqlite:///{_tmp}/test.db")
os.environ["DR_STORAGE_DIR"] = f"{_tmp}/storage"
os.environ["DR_SIMULATOR_ENABLED"] = "false"
os.environ["DR_LOGIN_RATE_PER_MINUTE"] = "1000"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.db import Base, SessionLocal, engine  # noqa: E402
from app.main import app as fastapi_app  # noqa: E402
import app.models as _m  # noqa: E402,F401
import app.models_twin as _mt  # noqa: E402,F401
from app.models import EmailOutbox, User  # noqa: E402
from app.security import limiter  # noqa: E402

H = {"X-Requested-With": "DigitalReservoir"}
PASSWORD = "Reservoir-Test-2026"


@pytest.fixture(autouse=True, scope="session")
def _schema():
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    yield


@pytest.fixture(autouse=True)
def _reset_limits():
    limiter.reset()


def new_client() -> TestClient:
    return TestClient(fastapi_app)


def last_token(email: str, kind: str = "verify-email") -> str:  # kinds: verify-email, reset-password, invite
    with SessionLocal() as db:
        msg = db.query(EmailOutbox).filter(EmailOutbox.to_address == email).order_by(EmailOutbox.created_at.desc()).first()
        return re.search(rf"{kind}\?token=([\w-]+)", msg.body).group(1)


def make_user(email: str, category: str = "researcher", verify: bool = True, superadmin: bool = False) -> TestClient:
    c = new_client()
    r = c.post("/api/v1/auth/register", json={"email": email, "password": PASSWORD, "full_name": email.split("@")[0], "membership_category": category, "accept_terms": True}, headers=H)
    assert r.status_code == 201, r.text
    if verify:
        assert c.post("/api/v1/auth/verify-email", json={"token": last_token(email)}, headers=H).status_code == 200
    if superadmin:
        with SessionLocal() as db:
            db.query(User).filter(User.email == email).update({"is_superadmin": True})
            db.commit()
    r = c.post("/api/v1/auth/login", json={"email": email, "password": PASSWORD}, headers=H)
    assert r.status_code == 200, r.text
    return c

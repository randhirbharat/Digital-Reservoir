"""Password hashing, opaque session tokens, MFA (TOTP), one-time tokens and rate limiting."""
from __future__ import annotations

import base64
import hashlib
import hmac
import secrets
import threading
import time
from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone

import pyotp
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError, VerifyMismatchError
from cryptography.fernet import Fernet

from .config import get_settings

_ph = PasswordHasher()  # Argon2id with library defaults (memory-hard)
COMMON_PASSWORDS = {"password", "password1", "123456", "12345678", "123456789", "qwerty", "qwerty123", "letmein", "welcome", "admin", "iloveyou", "monkey", "dragon", "passw0rd", "abc123"}


def hash_password(pw: str) -> str:
    return _ph.hash(pw)


def verify_password(pw: str, hashed: str) -> bool:
    try:
        return _ph.verify(hashed, pw)
    except (VerifyMismatchError, VerificationError, InvalidHashError):
        return False


def password_problems(pw: str, email: str = "") -> list[str]:
    problems = []
    if len(pw) < 12:
        problems.append("at least 12 characters")
    if not any(c.islower() for c in pw) or not any(c.isupper() for c in pw):
        problems.append("upper- and lower-case letters")
    if not any(c.isdigit() for c in pw):
        problems.append("at least one number")
    low = pw.lower()
    if low in COMMON_PASSWORDS or any(low.startswith(c) for c in COMMON_PASSWORDS if len(c) >= 6):
        problems.append("not a common password")
    if email and email.split("@")[0].lower() in low and len(email.split("@")[0]) >= 4:
        problems.append("must not contain your email name")
    return problems


def new_token() -> str:
    return secrets.token_urlsafe(32)


def token_hash(token: str) -> str:
    """Tokens are stored only as keyed hashes, so a database leak does not reveal usable tokens."""
    return hmac.new(get_settings().secret_key.encode(), token.encode(), hashlib.sha256).hexdigest()


def utcnow() -> datetime:
    return datetime.now(timezone.utc)


def session_expiry() -> datetime:
    return utcnow() + timedelta(hours=get_settings().session_hours)


# ------------------------------------------------------------- MFA secrets are encrypted at rest

def _fernet() -> Fernet:
    key = hashlib.sha256(("mfa:" + get_settings().secret_key).encode()).digest()
    return Fernet(base64.urlsafe_b64encode(key))


def encrypt_secret(secret: str) -> str:
    return _fernet().encrypt(secret.encode()).decode()


def decrypt_secret(enc: str) -> str:
    return _fernet().decrypt(enc.encode()).decode()


def new_totp_secret() -> str:
    return pyotp.random_base32()


def verify_totp(secret: str, code: str) -> bool:
    code = (code or "").strip().replace(" ", "")
    return code.isdigit() and len(code) == 6 and pyotp.TOTP(secret).verify(code, valid_window=1)


def totp_uri(secret: str, email: str) -> str:
    return pyotp.TOTP(secret).provisioning_uri(name=email, issuer_name="Digital Reservoir")


# ------------------------------------------------------------- rate limiting (in-memory; Redis when configured)

class RateLimiter:
    def __init__(self):
        self._hits: dict[str, deque] = defaultdict(deque)
        self._lock = threading.Lock()
        self._redis = None
        url = get_settings().redis_url
        if url:
            try:
                import redis

                self._redis = redis.Redis.from_url(url, socket_timeout=0.5)
                self._redis.ping()
            except Exception:  # noqa: BLE001 — fall back to in-memory
                self._redis = None

    def hit(self, key: str, limit: int, window_s: int = 60) -> bool:
        """Record a hit; return True if the request is allowed."""
        if self._redis is not None:
            try:
                k = f"rl:{key}:{int(time.time() // window_s)}"
                n = self._redis.incr(k)
                if n == 1:
                    self._redis.expire(k, window_s)
                return n <= limit
            except Exception:  # noqa: BLE001
                pass
        now = time.monotonic()
        with self._lock:
            q = self._hits[key]
            while q and now - q[0] > window_s:
                q.popleft()
            if len(q) >= limit:
                return False
            q.append(now)
            return True

    def reset(self):
        with self._lock:
            self._hits.clear()


limiter = RateLimiter()

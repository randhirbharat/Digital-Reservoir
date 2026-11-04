from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# Engineering Lab permissions per membership category. Configurable here (and overridable per user by an
# administrator via `extra_permissions`). Upload limits in MB.
LAB_PERMISSIONS: dict[str, set[str]] = {
    "general": {"lab.datasets", "lab.quality", "lab.signal", "lab.statistics", "lab.hst"},
    "student": {"lab.datasets", "lab.quality", "lab.signal", "lab.statistics", "lab.hst", "lab.ml", "lab.anomaly"},
    "researcher": {"lab.datasets", "lab.quality", "lab.signal", "lab.statistics", "lab.hst", "lab.ml", "lab.anomaly", "lab.dhi", "lab.advanced", "lab.reports"},
    "professional": {"lab.datasets", "lab.quality", "lab.signal", "lab.statistics", "lab.hst", "lab.ml", "lab.anomaly", "lab.dhi", "lab.advanced", "lab.reports"},
    "administrator": {"lab.datasets", "lab.quality", "lab.signal", "lab.statistics", "lab.hst", "lab.ml", "lab.anomaly", "lab.dhi", "lab.advanced", "lab.reports", "admin.users"},
}
UPLOAD_LIMIT_MB = {"general": 10, "student": 25, "researcher": 100, "professional": 100, "administrator": 200}


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_prefix="DR_", env_file=".env", extra="ignore")

    env: str = "development"
    secret_key: str = "dev-only-insecure-key-change-me"
    database_url: str = "sqlite:///./dr_dev.db"
    redis_url: str | None = None
    storage_dir: str = "./storage"
    cookie_name: str = "dr_session"
    cookie_domain: str | None = None
    cookie_secure: bool = False
    cors_origins: str = "http://localhost:3000,http://localhost:3001,http://localhost:3002"
    session_hours: int = 12
    session_idle_minutes: int = 120
    require_mfa_for_admins: bool = False
    email_backend: str = "console"
    smtp_host: str | None = None
    smtp_port: int = 587
    smtp_user: str | None = None
    smtp_password: str | None = None
    smtp_from: str = "no-reply@example.org"
    lab_url: str = "http://localhost:3001"
    twin_url: str = "http://localhost:3002"
    simulator_enabled: bool = True
    simulator_interval_seconds: float = 5.0
    login_rate_per_minute: int = 10
    max_failed_logins: int = 8
    lockout_minutes: int = 15

    @field_validator("cookie_domain", "redis_url", mode="before")
    @classmethod
    def _empty_none(cls, v):
        return v or None

    @property
    def origins(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def is_production(self) -> bool:
        return self.env == "production"


@lru_cache
def get_settings() -> Settings:
    s = Settings()
    if s.is_production and (s.secret_key.startswith("dev-only") or len(s.secret_key) < 32):
        raise RuntimeError("DR_SECRET_KEY must be set to a strong random value in production.")
    if s.is_production and not s.cookie_secure:
        raise RuntimeError("DR_COOKIE_SECURE must be true in production.")
    return s

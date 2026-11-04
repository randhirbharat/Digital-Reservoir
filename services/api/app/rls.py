"""PostgreSQL row-level security for project-scoped Digital Twin tables (defence in depth).

The API authorises every request itself; RLS additionally guarantees at the database level that a request
running for user U can only read or write rows of projects U belongs to, even if an endpoint had a bug.

Context variables are applied transaction-locally (SET LOCAL via set_config(..., true)) at the start of every
transaction from `session.info["rls"]`, so they survive commits within a request and never leak between pooled
connections. The application role must NOT be a PostgreSQL superuser (superusers bypass RLS); FORCE ROW LEVEL
SECURITY makes the policies apply to the table owner as well.
"""
from __future__ import annotations

from sqlalchemy import event, text
from sqlalchemy.orm import Session

RLS_TABLES = ("asset", "structural_component", "sensor", "observation", "alert_rule", "alert", "model_publication")

POLICY = """
  current_setting('app.bypass', true) = 'on'
  OR current_setting('app.superadmin', true) = 'on'
  OR project_id = current_setting('app.gateway_project', true)
  OR project_id IN (SELECT pm.project_id FROM project_member pm
                    WHERE pm.user_id = current_setting('app.user_id', true) AND pm.revoked_at IS NULL)
  OR project_id IN (SELECT p.id FROM project p JOIN org_member o ON o.organisation_id = p.organisation_id
                    WHERE o.user_id = current_setting('app.user_id', true) AND o.role = 'institutional_admin')
"""


def apply_rls_sql(conn) -> None:
    for t in RLS_TABLES:
        conn.execute(text(f"ALTER TABLE {t} ENABLE ROW LEVEL SECURITY"))
        conn.execute(text(f"ALTER TABLE {t} FORCE ROW LEVEL SECURITY"))
        conn.execute(text(f"DROP POLICY IF EXISTS project_isolation ON {t}"))
        conn.execute(text(f"CREATE POLICY project_isolation ON {t} USING ({POLICY}) WITH CHECK ({POLICY})"))


def drop_rls_sql(conn) -> None:
    for t in RLS_TABLES:
        conn.execute(text(f"DROP POLICY IF EXISTS project_isolation ON {t}"))
        conn.execute(text(f"ALTER TABLE {t} NO FORCE ROW LEVEL SECURITY"))
        conn.execute(text(f"ALTER TABLE {t} DISABLE ROW LEVEL SECURITY"))


def set_context(db: Session, **values: str) -> None:
    """Record RLS context for this session and apply it to the current transaction (if any)."""
    ctx = db.info.setdefault("rls", {})
    ctx.update({f"app.{k}": v for k, v in values.items()})
    if db.get_bind().dialect.name == "postgresql" and db.in_transaction():
        for k, v in ctx.items():
            db.execute(text("SELECT set_config(:k, :v, true)"), {"k": k, "v": v})


def system_session(db: Session) -> Session:
    """Mark a session as a trusted system context (simulator, seed, watchdog)."""
    set_context(db, bypass="on")
    return db


@event.listens_for(Session, "after_begin")
def _apply_on_begin(session: Session, transaction, connection) -> None:
    ctx = session.info.get("rls")
    if ctx and connection.dialect.name == "postgresql":
        for k, v in ctx.items():
            connection.execute(text("SELECT set_config(:k, :v, true)"), {"k": k, "v": v})

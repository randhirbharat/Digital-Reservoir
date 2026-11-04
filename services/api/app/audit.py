from fastapi import Request
from sqlalchemy.orm import Session

from .models import AuditLog


def client_ip(request: Request | None) -> str:
    if request is None:
        return ""
    fwd = request.headers.get("x-forwarded-for")
    return (fwd.split(",")[0].strip() if fwd else (request.client.host if request.client else ""))[:64]


def audit(db: Session, action: str, *, user_id: str | None = None, outcome: str = "success", project_id: str | None = None,
          target: str | None = None, request: Request | None = None, commit: bool = True, **detail) -> None:
    db.add(AuditLog(action=action, user_id=user_id, outcome=outcome, project_id=project_id, target=target, ip=client_ip(request), detail=detail))
    if commit:
        db.commit()

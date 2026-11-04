"""Operational commands.

    python -m app.cli create-admin --email admin@example.org --name "Platform Admin"
        Password is read interactively (or from DR_ADMIN_PASSWORD for automation). Never hard-code it.
"""
import argparse
import getpass
import os
import sys

from .db import SessionLocal
from .models import User
from .security import hash_password, password_problems, utcnow


def create_admin(email: str, name: str) -> None:
    pw = os.environ.get("DR_ADMIN_PASSWORD") or getpass.getpass("Admin password: ")
    problems = password_problems(pw, email)
    if problems:
        sys.exit("Password must have: " + ", ".join(problems))
    with SessionLocal() as db:
        u = db.query(User).filter(User.email == email.lower()).one_or_none()
        if u:
            u.is_superadmin, u.membership_category, u.password_hash = True, "administrator", hash_password(pw)
        else:
            u = User(email=email.lower(), full_name=name, password_hash=hash_password(pw), membership_category="administrator", is_superadmin=True, email_verified_at=utcnow())
            db.add(u)
        db.commit()
        print(f"Administrator ready: {u.email} (enable MFA at first sign-in)")


def main() -> None:
    ap = argparse.ArgumentParser(prog="python -m app.cli")
    sub = ap.add_subparsers(dest="cmd", required=True)
    a = sub.add_parser("create-admin")
    a.add_argument("--email", required=True)
    a.add_argument("--name", default="Platform Administrator")
    args = ap.parse_args()
    if args.cmd == "create-admin":
        create_admin(args.email, args.name)


if __name__ == "__main__":
    main()

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



def seed_demo(admin_email: str | None, history_days: int) -> None:
    """Create the illustrative demonstration project (simulated data) plus empty projects A–C to demonstrate isolation."""
    from .models_twin import AlertRule, Asset, Component, Project, ProjectMember, Sensor
    from .twin.simulator import backfill

    from .rls import system_session
    with SessionLocal() as db:
        system_session(db)
        if db.query(Project).filter(Project.code == "PRJ-D").first():
            print("Demonstration project already exists.")
            return
        for code, name, desc in [("PRJ-A", "Instrumentation monitoring", "Sensor network commissioning and data-quality review."),
                                 ("PRJ-B", "Dam health assessment", "Dam Health Index and periodic assessment reports."),
                                 ("PRJ-C", "Seismic performance", "Ground motions, IDA results and fragility analysis.")]:
            db.add(Project(code=code, name=name, description=desc, data_mode="live", require_mfa=True, settings={"discoverable": True}))
        pr = Project(code="PRJ-D", name="Demonstration gravity dam", data_mode="simulated", require_mfa=True, settings={"discoverable": True},
                     description="Illustrative structure with a simulated data stream for demonstrating the Digital Twin. Not an existing dam.")
        db.add(pr)
        db.flush()
        geom = {"kind": "gravity_dam", "length_m": 140, "height_m": 60, "crest_width_m": 8, "base_width_m": 52, "downstream_break_m": 50, "blocks": 7,
                "spillway": {"x_from": -14, "x_to": 14, "crest_level_m": 52}, "galleries": [{"y": 6, "z": 9}, {"y": 26, "z": 8}], "foundation_depth_m": 12, "reservoir_level_m_ref": 605,
                "level_datum_m": 553, "coordinate_system": "local: x along crest (m), y downstream from upstream face (m), z above foundation (m)"}
        a = Asset(project_id=pr.id, name="DGD-01 (illustrative gravity dam)", asset_type="concrete_gravity_dam", is_illustrative=True, geometry=geom,
                  description="Parametric demonstration model. Replace with a GLB/glTF model (IFC via conversion) for a real asset.")
        db.add(a)
        db.flush()
        comps = {}
        for code, name, kind in [("CREST", "Crest", "crest"), ("US-FACE", "Upstream face", "upstream_face"), ("DS-FACE", "Downstream face", "downstream_face"),
                                 ("HEEL", "Heel", "heel"), ("TOE", "Toe", "toe"), ("FOUND", "Foundation", "foundation"), ("GAL-1", "Inspection gallery 1", "gallery"),
                                 ("GAL-2", "Drainage gallery 2", "gallery"), ("SPILL", "Spillway", "spillway"), ("JOINT-3-4", "Contraction joint 3–4", "joint"), ("BODY", "Dam body", "block")]:
            c = Component(project_id=pr.id, asset_id=a.id, code=code, name=name, kind=kind)
            db.add(c)
            comps[code] = c
        db.flush()
        S = [
            ("RL-01", "Reservoir level gauge", "Radar level gauge", "reservoir_level", "m a.s.l.", "US-FACE", (40, -3, 54), 600, {"model": "level"}, {}),
            ("PL-01", "Direct pendulum, block 4 crest", "Pendulum (coordinometer)", "radial_displacement", "mm", "CREST", (-4, 4, 60), 600, {"base": 3.0, "a_h": 0.55, "a_s": -1.1, "lag": 20, "drift": 0.25, "noise": 0.06}, {}),
            ("PL-02", "Direct pendulum, block 6 crest", "Pendulum (coordinometer)", "radial_displacement", "mm", "CREST", (36, 4, 60), 600, {"base": 2.4, "a_h": 0.45, "a_s": -0.9, "lag": 25, "drift": 0.2, "noise": 0.06}, {}),
            ("PZ-01", "Foundation piezometer, block 2", "Vibrating-wire piezometer", "piezometric_head", "m", "FOUND", (-46, 14, -6), 600, {"base": 37.5, "a_h": 0.35, "noise": 0.03}, {}),
            ("PZ-03", "Foundation piezometer, block 4", "Vibrating-wire piezometer", "piezometric_head", "m", "FOUND", (-6, 14, -6), 600,
             {"base": 39.6, "a_h": 0.42, "noise": 0.03, "anomaly": {"period_s": 1800, "duration_s": 240, "target": 41.3}}, {"gauge_factor": "0.0386 kPa/digit", "date": "2025-11-03"}),
            ("PZ-05", "Foundation piezometer, block 6", "Vibrating-wire piezometer", "piezometric_head", "m", "FOUND", (34, 14, -6), 600, {"base": 36.8, "a_h": 0.33, "noise": 0.03}, {}),
            ("UP-05", "Uplift cell, heel", "Pressure cell", "uplift_pressure", "kPa", "HEEL", (24, 3, 0.5), 600, {"base": 148, "a_h": 4.2, "noise": 0.8}, {"zero_reading": "2.1 kPa"}),
            ("V-02", "Seepage weir, gallery 2", "V-notch weir with level sensor", "seepage_flow", "L/s", "GAL-2", (36, 26, 8), 900, {"base": 12.0, "a_h": 0.45, "a_s": 0.6, "noise": 0.15}, {"equation": "Q = 1.38 h^2.5"}),
            ("TM-11", "Concrete thermometer, upstream face", "Resistance thermometer", "concrete_temperature", "°C", "US-FACE", (-30, 2, 40), 3600, {"base": 13.5, "a_s": -6.0, "lag": 200, "noise": 0.1}, {}),
            ("TM-12", "Concrete thermometer, core", "Resistance thermometer", "concrete_temperature", "°C", "BODY", (-48, 22, 30), 3600, {"base": 14.2, "a_s": -1.5, "lag": 260, "noise": 0.05, "drop": True}, {}),
            ("JM-04", "Joint meter, blocks 3–4", "Vibrating-wire jointmeter", "joint_opening", "mm", "JOINT-3-4", (-14, 2, 40), 3600, {"base": 0.42, "a_s": 0.12, "lag": 30, "noise": 0.01}, {}),
            ("IN-01", "In-place inclinometer, toe", "In-place inclinometer", "tilt", "mm/m", "TOE", (10, 48, 4), 21600, {"base": 0.08, "a_h": 0.004, "noise": 0.004}, {}),
        ]
        sensors = {}
        for code, name, typ, var, unit, comp, (x, y, z), freq, sim, cal in S:
            s = Sensor(project_id=pr.id, asset_id=a.id, component_id=comps[comp].id, code=code, name=name, sensor_type=typ, variable=var, unit=unit, x=x, y=y, z=z,
                       frequency_s=freq, source="simulated", sim=sim, calibration=cal, status="active", notes="Demonstration sensor (simulated).")
            db.add(s)
            sensors[code] = s
        db.flush()
        for code, level, cmp, thr in [("PZ-03", "attention", "gt", 41.0), ("PZ-03", "warning", "gt", 41.6), ("PL-01", "attention", "abs_gt", 7.5), ("V-02", "attention", "gt", 14.5), ("UP-05", "attention", "gt", 175.0)]:
            db.add(AlertRule(project_id=pr.id, sensor_id=sensors[code].id, level=level, comparator=cmp, threshold=thr, is_demonstration=True,
                             criteria_reference="Demonstration criterion DC-" + code + " — illustrative only, not a project-approved threshold"))
        if admin_email:
            u = db.query(User).filter(User.email == admin_email.lower()).one_or_none()
            if not u:
                sys.exit(f"No user {admin_email}; create the account first.")
            db.add(ProjectMember(project_id=pr.id, user_id=u.id, role="project_admin"))
        db.commit()
        n = backfill(db, pr, days=history_days)
        print(f"Demonstration project PRJ-D created with {len(S)} simulated sensors and {n} historical simulated observations.")


def _main_ext():
    ap = argparse.ArgumentParser(prog="python -m app.cli")
    sub = ap.add_subparsers(dest="cmd", required=True)
    a = sub.add_parser("create-admin"); a.add_argument("--email", required=True); a.add_argument("--name", default="Platform Administrator")
    s = sub.add_parser("seed-demo"); s.add_argument("--admin-email"); s.add_argument("--history-days", type=int, default=120)
    args = ap.parse_args()
    if args.cmd == "create-admin":
        create_admin(args.email, args.name)
    elif args.cmd == "seed-demo":
        seed_demo(args.admin_email, args.history_days)


main = _main_ext  # noqa: F811


if __name__ == "__main__":
    main()

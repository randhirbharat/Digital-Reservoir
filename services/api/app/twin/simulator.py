"""DEMONSTRATION data-stream adapter.

Generates physically structured but entirely simulated readings for sensors whose `source` is "simulated".
Every stored observation carries source="simulated" and every screen labels it DEMONSTRATION DATA.
It exists to exercise the real ingestion, alerting and streaming paths; it is not a model of any real structure.

Model (t = UTC time):
    level   H = base + 6 sin(2π(doy−60)/365.25) + 0.04 sin(2π s/900) + ε
    response y = base + a_h·(H − 605) + a_s·cos(2π(doy − lag)/365.25) + drift·years + ε
    scheduled demonstration excursions: y → target level (or + offset) for `duration_s` every `period_s`
"""
from __future__ import annotations

import asyncio
import logging
import math
import random
from datetime import datetime, timedelta

from ..config import get_settings
from ..db import SessionLocal
from ..models_twin import Project, Sensor
from ..security import utcnow
from .engine import store_observations, watchdog

log = logging.getLogger("dr.simulator")
EPOCH = datetime(2025, 1, 1, tzinfo=utcnow().tzinfo)


def level(t: datetime, rnd: random.Random | None = None) -> float:
    doy = t.timetuple().tm_yday + t.hour / 24
    noise = (rnd or random).gauss(0, 0.01)
    return 605 + 6 * math.sin(2 * math.pi * (doy - 60) / 365.25) + 0.04 * math.sin(2 * math.pi * t.timestamp() / 900) + noise


def value(sensor: Sensor, t: datetime, rnd: random.Random | None = None, include_anomaly: bool = True, ignore_drop: bool = False) -> float | None:
    sim = sensor.sim or {}
    r = rnd or random
    if sim.get("drop") and not ignore_drop:
        return None
    H = level(t, r)
    if sim.get("model") == "level":
        return H
    doy = t.timetuple().tm_yday + t.hour / 24
    years = (t - EPOCH).total_seconds() / (365.25 * 86400)
    y = (sim.get("base", 0.0) + sim.get("a_h", 0.0) * (H - 605) + sim.get("a_s", 0.0) * math.cos(2 * math.pi * (doy - sim.get("lag", 0)) / 365.25)
         + sim.get("drift", 0.0) * years + 0.15 * sim.get("noise", 0.05) * math.sin(2 * math.pi * t.timestamp() / sim.get("wave_s", 1200)) + r.gauss(0, sim.get("noise", 0.05)))
    an = sim.get("anomaly")
    if include_anomaly and an and (t.timestamp() % an["period_s"]) < an["duration_s"]:
        # scheduled demonstration excursion: either a fixed offset, or a target level (season-independent)
        y = an["target"] + r.gauss(0, sim.get("noise", 0.05)) if "target" in an else y + an["offset"]
    return y


def backfill(db, project: Project, days: int = 120, step_s: int = 3600, seed: int = 7) -> int:
    """Simulated history (hourly). Injected anomalies are not replayed; a 'dropped' sensor's history ends beyond its offline window."""
    rnd = random.Random(seed)
    end = utcnow().replace(minute=0, second=0, microsecond=0)
    start = end - timedelta(days=days)
    n = 0
    for s in db.query(Sensor).filter(Sensor.project_id == project.id, Sensor.source == "simulated").all():
        stop = end - timedelta(seconds=max(3 * 3600, 7 * s.frequency_s)) if (s.sim or {}).get("drop") else end  # beyond the offline window
        rows, t = [], start
        while t < stop:
            rows.append((t, value(s, t, rnd, include_anomaly=False, ignore_drop=True), "good"))
            t += timedelta(seconds=step_s)
        n += store_observations(db, s, rows, "simulated", publish=False)
    return n


def tick(now: datetime | None = None) -> int:
    now = now or utcnow()
    n = 0
    from ..rls import system_session
    with SessionLocal() as db:
        system_session(db)
        projects = db.query(Project).filter(Project.data_mode == "simulated").all()
        for p in projects:
            for s in db.query(Sensor).filter(Sensor.project_id == p.id, Sensor.source == "simulated", Sensor.status.in_(["active", "offline"])).all():
                v = value(s, now)
                if v is None:
                    continue  # simulated communication loss — watchdog will raise an alert
                q = "suspect" if (s.sim or {}).get("anomaly") and (now.timestamp() % s.sim["anomaly"]["period_s"]) < s.sim["anomaly"]["duration_s"] else "good"
                n += store_observations(db, s, [(now, v, q)], "simulated")
            watchdog(db, p.id)
    return n


async def run_forever() -> None:
    interval = get_settings().simulator_interval_seconds
    log.warning("DEMONSTRATION simulator running every %.1f s (source=simulated)", interval)
    while True:
        try:
            await asyncio.to_thread(tick)
        except Exception:  # noqa: BLE001 — never let the simulator crash the API
            log.exception("simulator tick failed")
        await asyncio.sleep(interval)

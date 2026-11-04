"""MQTT → Digital Reservoir ingestion bridge with batching, retry/backoff and on-disk store-and-forward."""
from __future__ import annotations

import argparse
import json
import logging
import os
import threading
import time
from datetime import datetime
from pathlib import Path

import httpx

log = logging.getLogger("dr.bridge")


class Forwarder:
    def __init__(self, api_url: str, key: str, spool: Path, batch_size: int = 500, flush_s: float = 2.0, client: httpx.Client | None = None):
        self.url = api_url.rstrip("/") + "/api/v1/ingest/observations"
        self.key = key
        self.spool = spool
        self.spool.mkdir(parents=True, exist_ok=True)
        self.batch_size, self.flush_s = batch_size, flush_s
        self.buf: list[dict] = []
        self.lock = threading.Lock()
        self.client = client or httpx.Client(timeout=10)
        self.stats = {"received": 0, "sent": 0, "rejected": 0, "spooled": 0, "invalid": 0}

    def handle(self, topic: str, payload: bytes) -> bool:
        """Validate one MQTT message; returns False (and counts it) when invalid."""
        parts = topic.split("/")
        if len(parts) != 3 or parts[0] != "dr":
            self.stats["invalid"] += 1
            return False
        try:
            msg = json.loads(payload)
            ts = datetime.fromisoformat(str(msg["ts"]).replace("Z", "+00:00"))
            if ts.tzinfo is None:
                raise ValueError("timestamp without time zone")
            value = None if msg.get("value") is None else float(msg["value"])
        except (ValueError, KeyError, TypeError, json.JSONDecodeError) as exc:
            log.warning("invalid message on %s: %s", topic, exc)
            self.stats["invalid"] += 1
            return False
        with self.lock:
            self.buf.append({"sensor_code": parts[2], "ts": ts.isoformat(), "value": value, "quality": msg.get("quality", "unchecked")})
            self.stats["received"] += 1
        if len(self.buf) >= self.batch_size:
            self.flush()
        return True

    def _post(self, batch: list[dict]) -> bool:
        try:
            r = self.client.post(self.url, json={"observations": batch}, headers={"X-DR-Gateway-Key": self.key})
        except httpx.HTTPError as exc:
            log.error("API unreachable: %s", exc)
            return False
        if r.status_code == 202:
            body = r.json()
            self.stats["sent"] += body["accepted"]
            self.stats["rejected"] += len(body["rejected"])
            for rej in body["rejected"][:5]:
                log.warning("rejected: %s", rej)
            return True
        if r.status_code in (401, 403):
            log.critical("Gateway key rejected (HTTP %s); stopping is safer than spooling indefinitely.", r.status_code)
            raise SystemExit(2)
        log.error("ingest failed HTTP %s: %s", r.status_code, r.text[:200])
        return False

    def flush(self) -> None:
        with self.lock:
            batch, self.buf = self.buf, []
        if batch and not self._post(batch):
            f = self.spool / f"{time.time_ns()}.json"
            f.write_text(json.dumps(batch))
            self.stats["spooled"] += len(batch)
        self.replay_spool()

    def replay_spool(self) -> None:
        for f in sorted(self.spool.glob("*.json")):
            if not self._post(json.loads(f.read_text())):
                break
            f.unlink()


def main() -> None:
    import paho.mqtt.client as mqtt

    ap = argparse.ArgumentParser()
    ap.add_argument("--host", default=os.environ.get("DR_MQTT_HOST", "localhost"))
    ap.add_argument("--port", type=int, default=int(os.environ.get("DR_MQTT_PORT", 1883)))
    ap.add_argument("--project", required=True, help="Project code used in topics dr/<PROJECT>/<SENSOR>")
    ap.add_argument("--tls", action="store_true")
    ap.add_argument("--spool", default="./spool")
    args = ap.parse_args()
    logging.basicConfig(level=logging.INFO)
    fw = Forwarder(os.environ["DR_INGEST_API_URL"], os.environ["DR_INGEST_GATEWAY_KEY"], Path(args.spool))
    client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
    if args.tls:
        client.tls_set()
    if os.environ.get("DR_MQTT_USER"):
        client.username_pw_set(os.environ["DR_MQTT_USER"], os.environ.get("DR_MQTT_PASSWORD"))
    client.on_connect = lambda c, u, f, rc, p=None: c.subscribe(f"dr/{args.project}/+", qos=1)
    client.on_message = lambda c, u, m: fw.handle(m.topic, m.payload)
    client.connect(args.host, args.port, keepalive=60)
    client.loop_start()
    try:
        while True:
            time.sleep(fw.flush_s)
            fw.flush()
            log.info("stats %s", fw.stats)
    finally:
        client.loop_stop()
        fw.flush()


if __name__ == "__main__":
    main()

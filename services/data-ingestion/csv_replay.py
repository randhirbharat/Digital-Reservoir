"""Send a historical CSV (timestamp,value[,quality]) for one sensor through a gateway whose data source is 'historical' or 'imported'."""
import argparse
import csv
import os

import httpx


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--file", required=True)
    ap.add_argument("--sensor", required=True)
    ap.add_argument("--batch", type=int, default=1000)
    a = ap.parse_args()
    url = os.environ["DR_INGEST_API_URL"].rstrip("/") + "/api/v1/ingest/observations"
    key = os.environ["DR_INGEST_GATEWAY_KEY"]
    sent = 0
    with open(a.file, newline="") as f, httpx.Client(timeout=30) as c:
        rows = [r for r in csv.reader(line for line in f if not line.startswith("#"))][1:]
        for i in range(0, len(rows), a.batch):
            obs = [{"sensor_code": a.sensor, "ts": r[0], "value": float(r[1]) if r[1] else None, "quality": r[2] if len(r) > 2 and r[2] else "unchecked"} for r in rows[i:i + a.batch]]
            res = c.post(url, json={"observations": obs}, headers={"X-DR-Gateway-Key": key})
            res.raise_for_status()
            sent += res.json()["accepted"]
    print(f"accepted {sent} observations")


if __name__ == "__main__":
    main()

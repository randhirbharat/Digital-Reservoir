# Data ingestion service

Connectors that deliver measurements from field systems to the Digital Reservoir ingestion API
(`POST /api/v1/ingest/observations`, authenticated with a per-gateway key issued by a project administrator).

| Connector | File | Status |
|---|---|---|
| MQTT → REST bridge (store-and-forward) | `mqtt_bridge.py` | Implemented; unit-tested with simulated MQTT messages; **not yet tested against a production broker or hardware** |
| CSV historical replay | `csv_replay.py` | Implemented and tested against the API |
| OPC UA | — | Interface pending (requires site-specific server details) |

The demonstration data stream runs inside the API (`app/twin/simulator.py`) and is always stored with
`source = simulated`. These connectors never fabricate data: everything they send is labelled with the
gateway's configured provenance (`live`, `historical` or `imported`).

## MQTT topic and payload contract
Topic: `dr/<PROJECT_CODE>/<SENSOR_CODE>` — payload (JSON):
```json
{"ts": "2026-11-04T10:42:07Z", "value": 41.03, "quality": "good"}
```
Timestamps must include a time zone. Units are taken from the sensor registry, not from the payload.

## Run
```bash
export DR_INGEST_API_URL=http://localhost:8000 DR_INGEST_GATEWAY_KEY=drg_...   # key from the Digital Twin › Sensors page
python mqtt_bridge.py --host localhost --port 1883 --project PRJ-A
python csv_replay.py --file history.csv --sensor PZ-03          # columns: timestamp,value[,quality]
```

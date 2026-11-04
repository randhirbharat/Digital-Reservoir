# MQTT -> REST ingestion bridge. Build context: repository root.
ARG BASE_REGISTRY=docker.io/library
FROM ${BASE_REGISTRY}/python:3.13-slim
RUN --mount=type=secret,id=extra_ca,required=false \
    if [ -s /run/secrets/extra_ca ]; then export PIP_CERT=/run/secrets/extra_ca; fi; \
    pip install --no-cache-dir "paho-mqtt>=2,<3" httpx
WORKDIR /srv
COPY services/data-ingestion/mqtt_bridge.py services/data-ingestion/csv_replay.py ./
RUN useradd --uid 10001 bridge && mkdir /srv/spool && chown bridge /srv/spool
USER bridge
CMD ["sh", "-c", "python mqtt_bridge.py --host ${DR_MQTT_HOST:-mosquitto} --project ${DR_BRIDGE_PROJECT} --spool /srv/spool"]

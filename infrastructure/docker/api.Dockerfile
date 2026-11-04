# Digital Reservoir API (FastAPI + analytics engine). Build context: repository root.
ARG BASE_REGISTRY=docker.io/library
FROM ${BASE_REGISTRY}/python:3.13-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
WORKDIR /srv
COPY services/analytics-engine /srv/services/analytics-engine
COPY services/api/requirements.txt /srv/services/api/requirements.txt
# Optional build secret "extra_ca" (PEM bundle) for builds behind a TLS-intercepting proxy; unused otherwise.
RUN --mount=type=secret,id=extra_ca,required=false \
    if [ -s /run/secrets/extra_ca ]; then export PIP_CERT=/run/secrets/extra_ca; fi; \
    pip install --upgrade pip && cd /srv/services/api && pip install -r requirements.txt && pip install scikit-image
COPY services/api /srv/services/api
COPY datasets /srv/datasets
COPY infrastructure/docker/api-entrypoint.sh /usr/local/bin/api-entrypoint.sh
RUN chmod +x /usr/local/bin/api-entrypoint.sh && useradd --create-home --uid 10001 app && mkdir -p /data/storage && chown -R app /data /srv
USER app
WORKDIR /srv/services/api
ENV DR_STORAGE_DIR=/data/storage
EXPOSE 8000
HEALTHCHECK --interval=30s --timeout=5s CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/api/v1/public/health')"
ENTRYPOINT ["api-entrypoint.sh"]
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--proxy-headers", "--forwarded-allow-ips", "*"]

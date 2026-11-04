"""Digital Reservoir API — identity, Engineering Lab, Digital Twin and ingestion services."""
import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import get_settings
from .routers import admin, auth, lab, public, twin
from .twin.bus import bus

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
settings = get_settings()



@asynccontextmanager
async def lifespan(_app: FastAPI):
    bus.bind_loop(asyncio.get_running_loop())
    task = None
    if settings.simulator_enabled:
        from .twin.simulator import run_forever
        task = asyncio.create_task(run_forever())
    yield
    if task:
        task.cancel()


app = FastAPI(title="Digital Reservoir API", version="0.4.0", lifespan=lifespan,
              description="Identity, Engineering Lab analytics and Digital Twin services. All project data endpoints require authentication and are authorised server-side.",
              docs_url="/api/docs", redoc_url=None, openapi_url="/api/openapi.json")

SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}
CSRF_EXEMPT_PREFIXES = ("/api/v1/ingest/",)  # machine clients authenticated by gateway key, never by cookie


@app.middleware("http")
async def csrf_and_headers(request: Request, call_next):
    path = request.url.path
    if request.method not in SAFE_METHODS and path.startswith("/api/") and not path.startswith(CSRF_EXEMPT_PREFIXES):
        # Custom header cannot be set cross-site without a CORS preflight, which only allowed origins pass.
        if request.headers.get("x-requested-with") != "DigitalReservoir":
            return JSONResponse({"detail": "Missing anti-CSRF header."}, status_code=403)
        origin = request.headers.get("origin")
        if origin and origin not in settings.origins and not origin.endswith("://" + (request.headers.get("host") or "")):
            return JSONResponse({"detail": "Origin not allowed."}, status_code=403)
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("Referrer-Policy", "strict-origin-when-cross-origin")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("X-Robots-Tag", "noindex, nofollow")
    response.headers.setdefault("Cache-Control", "no-store")
    if settings.is_production:
        response.headers.setdefault("Strict-Transport-Security", "max-age=63072000; includeSubDomains")
    return response


app.add_middleware(CORSMiddleware, allow_origins=settings.origins, allow_credentials=True,
                   allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE"], allow_headers=["Content-Type", "X-Requested-With"])

for r in (public.router, auth.router, lab.router, admin.router, twin.router, twin.ingest_router):
    app.include_router(r, prefix="/api/v1")

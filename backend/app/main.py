"""Nixel Business OS — Starter Edition API."""

import logging
from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import get_settings
from .db import init_db
from .engine.scheduler import start_scheduler, stop_scheduler
from .routers import auth, automations, campaigns, dashboard, engine, inbound, leads, pipeline, settings as settings_router, templates
from .security import require_auth

logging.basicConfig(level=logging.INFO)

DISCLAIMER = (
    "Nixel Business OS — Starter Edition is provided as a customisable starter system for "
    "demonstration, development and educational use. It should not be treated as automatically "
    "production-ready. Before storing real customer information, sending campaigns or connecting "
    "business systems, users are responsible for completing appropriate security, privacy, "
    "compliance, deliverability and infrastructure reviews. Nixel is not responsible for data "
    "loss, misuse, unauthorised access, spam activity, configuration errors or issues resulting "
    "from an improperly secured deployment."
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    start_scheduler()
    yield
    stop_scheduler()


app = FastAPI(title="Nixel Business OS — Starter Edition", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_origin_list,
    # Vite bumps to 5174/5175/... when 5173 is taken; accept any localhost port.
    allow_origin_regex=r"http://(localhost|127\.0\.0\.1):\d+",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    # Return JSON (not a bare 500) so CORS headers survive and the frontend
    # can show the real error instead of "Failed to fetch".
    logging.getLogger("nixel").exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(status_code=500, content={"detail": f"{type(exc).__name__}: {exc}"})


# Open endpoints: health, auth, and the inbound webhook (which enforces its
# own X-API-Key). Everything else requires a signed-in session.
app.include_router(auth.router)
app.include_router(inbound.router)

for router in (
    dashboard.router,
    engine.router,
    leads.router,
    templates.router,
    campaigns.router,
    automations.router,
    pipeline.router,
    settings_router.router,
):
    app.include_router(router, dependencies=[Depends(require_auth)])


@app.get("/api/health")
def health():
    return {"ok": True, "disclaimer": DISCLAIMER}

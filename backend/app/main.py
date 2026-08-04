"""Nixel Business OS — Starter Edition API."""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from .config import get_settings
from .db import init_db, session_scope
from .engine.scheduler import start_scheduler, stop_scheduler
from .routers import automations, campaigns, dashboard, engine, inbound, leads, pipeline, settings as settings_router, templates
from .seed import seed_if_empty

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
    db = session_scope()
    try:
        seed_if_empty(db)
    finally:
        db.close()
    start_scheduler()
    yield
    stop_scheduler()


app = FastAPI(title="Nixel Business OS — Starter Edition", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_origin_list,
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


for router in (
    dashboard.router,
    engine.router,
    leads.router,
    inbound.router,
    templates.router,
    campaigns.router,
    automations.router,
    pipeline.router,
    settings_router.router,
):
    app.include_router(router)


@app.get("/api/health")
def health():
    s = get_settings()
    return {"ok": True, "demo_mode": s.demo_mode, "disclaimer": DISCLAIMER}

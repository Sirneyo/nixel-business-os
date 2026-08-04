"""Lead Generation Engine endpoints (start runs, watch live progress)."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..db import get_db
from ..engine.leadgen import STAGES, start_run
from ..models import EngineRun, Lead, RunEvent
from ..schemas import EngineRunCreate
from ..serializers import event_out, lead_out, run_out

router = APIRouter(prefix="/api/engine", tags=["engine"])


@router.get("/stages")
def list_stages():
    return [{"key": key, "label": label} for key, label in STAGES]


@router.post("/runs")
def create_run(payload: EngineRunCreate, db: Session = Depends(get_db)):
    active = db.query(EngineRun).filter(EngineRun.status.in_(["queued", "running"])).count()
    if active > 0:
        raise HTTPException(409, "Another run is already in progress. Wait for it to finish or cancel it.")
    run = EngineRun(**payload.model_dump())
    db.add(run)
    db.commit()
    start_run(run.id)
    return run_out(run)


@router.get("/runs")
def list_runs(limit: int = 20, db: Session = Depends(get_db)):
    runs = db.query(EngineRun).order_by(EngineRun.id.desc()).limit(limit).all()
    return [run_out(r) for r in runs]


@router.get("/runs/{run_id}")
def get_run(run_id: int, after_event_id: int = 0, db: Session = Depends(get_db)):
    run = db.get(EngineRun, run_id)
    if run is None:
        raise HTTPException(404, "Run not found")
    events = (
        db.query(RunEvent)
        .filter(RunEvent.run_id == run_id, RunEvent.id > after_event_id)
        .order_by(RunEvent.id)
        .limit(500)
        .all()
    )
    leads = (
        db.query(Lead).filter(Lead.engine_run_id == run_id).order_by(Lead.id.desc()).limit(200).all()
    )
    return {"run": run_out(run), "events": [event_out(e) for e in events], "leads": [lead_out(l) for l in leads]}


@router.post("/runs/{run_id}/cancel")
def cancel_run(run_id: int, db: Session = Depends(get_db)):
    run = db.get(EngineRun, run_id)
    if run is None:
        raise HTTPException(404, "Run not found")
    if run.status in ("queued", "running"):
        run.status = "cancelled"
        db.commit()
    return run_out(run)

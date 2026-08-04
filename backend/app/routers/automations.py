"""Automation Engine endpoints."""

import json

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..db import get_db
from ..engine.automations import STEP_KINDS, TRIGGERS, enroll, process_enrollments
from ..models import ActivityLog, Automation, AutomationEnrollment, AutomationLog, AutomationStep, Lead
from ..schemas import AutomationUpsert, LeadIdList
from ..serializers import automation_log_out, automation_out

router = APIRouter(prefix="/api/automations", tags=["automations"])


def _stats(db: Session, automation: Automation) -> dict:
    enrollments = db.query(AutomationEnrollment).filter(AutomationEnrollment.automation_id == automation.id)
    return {
        "active": enrollments.filter(AutomationEnrollment.status == "active").count(),
        "completed": enrollments.filter(AutomationEnrollment.status == "completed").count(),
        "stopped": enrollments.filter(AutomationEnrollment.status == "stopped").count(),
    }


@router.get("/options")
def automation_options():
    return {
        "triggers": [{"key": k, "label": v} for k, v in TRIGGERS.items()],
        "step_kinds": [{"key": k, "label": v} for k, v in STEP_KINDS.items()],
    }


@router.get("")
def list_automations(db: Session = Depends(get_db)):
    automations = db.query(Automation).order_by(Automation.id.desc()).all()
    return [automation_out(a, stats=_stats(db, a)) for a in automations]


@router.post("")
def create_automation(payload: AutomationUpsert, db: Session = Depends(get_db)):
    if payload.trigger not in TRIGGERS:
        raise HTTPException(400, f"Unknown trigger '{payload.trigger}'.")
    automation = Automation(name=payload.name, trigger=payload.trigger, simulation_mode=payload.simulation_mode)
    db.add(automation)
    db.flush()
    _apply_steps(db, automation, payload.steps)
    db.commit()
    return automation_out(automation)


def _apply_steps(db: Session, automation: Automation, steps: list) -> None:
    db.query(AutomationStep).filter(AutomationStep.automation_id == automation.id).delete()
    for position, step in enumerate(steps):
        if step.kind not in STEP_KINDS:
            raise HTTPException(400, f"Unknown step kind '{step.kind}'.")
        db.add(AutomationStep(automation_id=automation.id, position=position, kind=step.kind, config=json.dumps(step.config)))


@router.get("/{automation_id}")
def get_automation(automation_id: int, db: Session = Depends(get_db)):
    automation = db.get(Automation, automation_id)
    if automation is None:
        raise HTTPException(404, "Automation not found")
    return automation_out(automation, stats=_stats(db, automation))


@router.put("/{automation_id}")
def update_automation(automation_id: int, payload: AutomationUpsert, db: Session = Depends(get_db)):
    automation = db.get(Automation, automation_id)
    if automation is None:
        raise HTTPException(404, "Automation not found")
    if payload.trigger not in TRIGGERS:
        raise HTTPException(400, f"Unknown trigger '{payload.trigger}'.")
    automation.name = payload.name
    automation.trigger = payload.trigger
    automation.simulation_mode = payload.simulation_mode
    automation.is_sample = False
    _apply_steps(db, automation, payload.steps)
    db.commit()
    db.refresh(automation)
    return automation_out(automation, stats=_stats(db, automation))


@router.delete("/{automation_id}")
def delete_automation(automation_id: int, db: Session = Depends(get_db)):
    automation = db.get(Automation, automation_id)
    if automation is None:
        raise HTTPException(404, "Automation not found")
    db.query(AutomationLog).filter(AutomationLog.automation_id == automation_id).delete()
    db.delete(automation)
    db.commit()
    return {"deleted": automation_id}


@router.post("/{automation_id}/activate")
def activate(automation_id: int, db: Session = Depends(get_db)):
    automation = db.get(Automation, automation_id)
    if automation is None:
        raise HTTPException(404, "Automation not found")
    if not automation.steps:
        raise HTTPException(400, "Add at least one step before activating.")
    automation.status = "active"
    db.add(ActivityLog(entity_type="automation", entity_id=automation.id, message=f"Automation '{automation.name}' activated."))
    db.commit()
    return automation_out(automation)


@router.post("/{automation_id}/pause")
def pause(automation_id: int, db: Session = Depends(get_db)):
    automation = db.get(Automation, automation_id)
    if automation is None:
        raise HTTPException(404, "Automation not found")
    automation.status = "paused"
    db.commit()
    return automation_out(automation)


@router.post("/{automation_id}/enroll")
def enroll_leads(automation_id: int, payload: LeadIdList, db: Session = Depends(get_db)):
    automation = db.get(Automation, automation_id)
    if automation is None:
        raise HTTPException(404, "Automation not found")
    enrolled = 0
    for lead in db.query(Lead).filter(Lead.id.in_(payload.lead_ids)).all():
        if enroll(db, automation, lead):
            enrolled += 1
    return {"enrolled": enrolled}


@router.post("/{automation_id}/test-run")
def test_run(automation_id: int, db: Session = Depends(get_db)):
    """Enroll the most recent lead in simulation mode and process immediately."""
    automation = db.get(Automation, automation_id)
    if automation is None:
        raise HTTPException(404, "Automation not found")
    lead = db.query(Lead).order_by(Lead.id.desc()).first()
    if lead is None:
        raise HTTPException(400, "No leads exist yet — generate or add a lead first.")
    was_status, was_sim = automation.status, automation.simulation_mode
    automation.status = "active"
    automation.simulation_mode = True
    db.query(AutomationEnrollment).filter_by(automation_id=automation.id, lead_id=lead.id).delete()
    db.commit()
    enroll(db, automation, lead)
    # Run several passes so consecutive non-wait steps all execute.
    for _ in range(len(automation.steps) + 1):
        process_enrollments(db)
    automation.status = was_status
    automation.simulation_mode = was_sim
    db.commit()
    return {"tested_with": lead.company_name}


@router.get("/{automation_id}/logs")
def automation_logs(automation_id: int, limit: int = 100, db: Session = Depends(get_db)):
    logs = (
        db.query(AutomationLog)
        .filter(AutomationLog.automation_id == automation_id)
        .order_by(AutomationLog.id.desc())
        .limit(min(limit, 500))
        .all()
    )
    return [automation_log_out(l) for l in logs]

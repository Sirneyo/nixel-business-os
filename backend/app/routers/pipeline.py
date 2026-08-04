"""Opportunity pipeline endpoints (Kanban board)."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import PIPELINE_STAGES, ActivityLog, EmailSend, Opportunity
from ..schemas import OpportunityUpdate
from ..serializers import iso, opportunity_out, send_out

router = APIRouter(prefix="/api/pipeline", tags=["pipeline"])

STAGE_LABELS = {
    "new_lead": "New Lead",
    "contacted": "Contacted",
    "replied": "Replied",
    "qualified": "Qualified",
    "meeting_booked": "Meeting Booked",
    "proposal_sent": "Proposal Sent",
    "negotiation": "Negotiation",
    "won": "Won",
    "lost": "Lost",
}


@router.get("/board")
def board(db: Session = Depends(get_db)):
    opportunities = db.query(Opportunity).order_by(Opportunity.updated_at.desc()).all()
    columns = [
        {
            "stage": stage,
            "label": STAGE_LABELS[stage],
            "opportunities": [opportunity_out(o) for o in opportunities if o.stage == stage],
        }
        for stage in PIPELINE_STAGES
    ]
    return {"stages": columns}


@router.get("/{opportunity_id}")
def get_opportunity(opportunity_id: int, db: Session = Depends(get_db)):
    opp = db.get(Opportunity, opportunity_id)
    if opp is None:
        raise HTTPException(404, "Opportunity not found")
    sends = db.query(EmailSend).filter(EmailSend.lead_id == opp.lead_id).order_by(EmailSend.id.desc()).limit(50).all()
    history = (
        db.query(ActivityLog)
        .filter(ActivityLog.lead_id == opp.lead_id)
        .order_by(ActivityLog.id.desc())
        .limit(50)
        .all()
    )
    return {
        "opportunity": opportunity_out(opp),
        "lead": {
            "id": opp.lead.id,
            "company_name": opp.lead.company_name,
            "website": opp.lead.website,
            "contact_name": opp.lead.contact_name,
            "email": opp.lead.email,
            "qualification_note": opp.lead.qualification_note,
            "research_summary": opp.lead.research_summary,
            "notes": opp.lead.notes,
        },
        "emails": [send_out(s) for s in sends],
        "history": [{"id": h.id, "message": h.message, "created_at": iso(h.created_at)} for h in history],
    }


@router.patch("/{opportunity_id}")
def update_opportunity(opportunity_id: int, payload: OpportunityUpdate, db: Session = Depends(get_db)):
    opp = db.get(Opportunity, opportunity_id)
    if opp is None:
        raise HTTPException(404, "Opportunity not found")
    data = payload.model_dump(exclude_none=True)
    if "stage" in data:
        if data["stage"] not in PIPELINE_STAGES:
            raise HTTPException(400, f"Unknown stage '{data['stage']}'.")
        if data["stage"] != opp.stage:
            db.add(
                ActivityLog(
                    entity_type="opportunity",
                    entity_id=opp.id,
                    lead_id=opp.lead_id,
                    message=f"{opp.lead.company_name} moved from {STAGE_LABELS[opp.stage]} to {STAGE_LABELS[data['stage']]}.",
                )
            )
    for field, value in data.items():
        setattr(opp, field, value)
    opp.is_sample = False
    db.commit()
    return opportunity_out(opp)


@router.delete("/{opportunity_id}")
def delete_opportunity(opportunity_id: int, db: Session = Depends(get_db)):
    opp = db.get(Opportunity, opportunity_id)
    if opp is None:
        raise HTTPException(404, "Opportunity not found")
    db.delete(opp)
    db.commit()
    return {"deleted": opportunity_id}

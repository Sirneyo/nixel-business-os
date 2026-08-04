"""Dashboard KPIs and recent activity."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..db import get_db
from ..models import ActivityLog, Automation, Campaign, EmailSend, EngineRun, Lead, Opportunity
from ..serializers import iso

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("")
def dashboard(db: Session = Depends(get_db)):
    leads = db.query(Lead)
    sends = db.query(EmailSend)
    won = db.query(Opportunity).filter(Opportunity.stage == "won").count()
    open_opps = db.query(Opportunity).filter(Opportunity.stage.notin_(["won", "lost"])).count()
    activity = db.query(ActivityLog).order_by(ActivityLog.id.desc()).limit(15).all()
    last_run = db.query(EngineRun).order_by(EngineRun.id.desc()).first()

    return {
        "kpis": {
            "total_leads": leads.count(),
            "qualified_leads": leads.filter(Lead.qualification_status == "qualified").count(),
            "verified_emails": leads.filter(Lead.email_status == "valid").count(),
            "inbound_leads": leads.filter(Lead.source == "inbound").count(),
            "emails_sent": sends.count(),
            "replies": sends.filter(EmailSend.replied.is_(True)).count(),
            "running_campaigns": db.query(Campaign).filter(Campaign.status == "running").count(),
            "active_automations": db.query(Automation).filter(Automation.status == "active").count(),
            "open_opportunities": open_opps,
            "won_deals": won,
        },
        "last_run": {
            "id": last_run.id,
            "status": last_run.status,
            "saved": last_run.saved,
            "created_at": iso(last_run.created_at),
        }
        if last_run
        else None,
        "activity": [
            {"id": a.id, "entity_type": a.entity_type, "message": a.message, "created_at": iso(a.created_at)}
            for a in activity
        ],
    }

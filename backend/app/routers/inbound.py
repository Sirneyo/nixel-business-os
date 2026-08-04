"""Inbound lead capture: webhook (API-key protected), API and example form.

Inbound leads land in the same workspace as engine leads, flagged
`source="inbound"` so they are clearly identified.
"""

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.orm import Session

from ..config import get_settings
from ..db import get_db
from ..engine.automations import fire_trigger
from ..models import ActivityLog, Lead, Setting
from ..schemas import InboundLeadCreate
from ..serializers import lead_out

router = APIRouter(prefix="/api/inbound", tags=["inbound"])


def _webhook_key(db: Session) -> str:
    """Environment variable wins; a Settings row can override for convenience."""
    row = db.query(Setting).filter(Setting.key == "inbound_webhook_key").first()
    return get_settings().inbound_webhook_key or (row.value if row else "")


def _require_key(db: Session, provided: str | None) -> None:
    expected = _webhook_key(db)
    if not expected:
        raise HTTPException(503, "Inbound webhook is not configured. Set INBOUND_WEBHOOK_KEY first.")
    if provided != expected:
        raise HTTPException(403, "Invalid or missing X-API-Key header.")


def _create_inbound_lead(db: Session, payload: InboundLeadCreate, detail: str) -> Lead:
    lead = Lead(
        company_name=payload.company_name,
        contact_name=payload.contact_name,
        email=str(payload.email) if payload.email else "",
        website=payload.website,
        industry=payload.industry,
        location=payload.location,
        notes=payload.message,
        source="inbound",
        source_detail=payload.source_detail or detail,
        qualification_status="pending",
        email_status="unverified",
    )
    db.add(lead)
    db.add(ActivityLog(entity_type="lead", message=f"Inbound lead received: {lead.company_name} ({lead.source_detail})."))
    db.commit()
    fire_trigger(db, "inbound_lead", lead)
    return lead


@router.post("/lead")
def inbound_webhook(
    payload: InboundLeadCreate,
    x_api_key: str | None = Header(default=None),
    db: Session = Depends(get_db),
):
    """Webhook for website forms, landing pages and external systems."""
    _require_key(db, x_api_key)
    lead = _create_inbound_lead(db, payload, "Webhook")
    return {"ok": True, "lead_id": lead.id}


@router.get("/status")
def inbound_status(db: Session = Depends(get_db)):
    settings = get_settings()
    return {
        "configured": bool(_webhook_key(db)),
        "endpoint": f"{settings.public_base_url}/api/inbound/lead",
        "header": "X-API-Key",
    }


@router.get("/recent")
def recent_inbound(limit: int = 25, offset: int = 0, search: str = "", db: Session = Depends(get_db)):
    query = db.query(Lead).filter(Lead.source == "inbound")
    if search:
        query = query.filter(Lead.company_name.ilike(f"%{search}%"))
    total = query.count()
    leads = query.order_by(Lead.id.desc()).offset(offset).limit(min(limit, 100)).all()
    return {"total": total, "leads": [lead_out(l) for l in leads]}

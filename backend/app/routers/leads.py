"""Verified Lead Workspace: review, search, edit, approve, export, route."""

import csv
import io

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import or_
from sqlalchemy.orm import Session

from ..db import get_db
from ..engine.automations import fire_trigger
from ..models import ActivityLog, Campaign, CampaignLead, Lead, Opportunity, utcnow
from ..schemas import LeadIdList, LeadUpdate, ManualLeadCreate
from ..serializers import lead_out

router = APIRouter(prefix="/api/leads", tags=["leads"])


def _filtered_query(
    db: Session,
    search: str = "",
    source: str = "",
    qualification: str = "",
    review: str = "",
    email_status: str = "",
):
    query = db.query(Lead)
    if search:
        like = f"%{search}%"
        query = query.filter(
            or_(
                Lead.company_name.ilike(like),
                Lead.email.ilike(like),
                Lead.contact_name.ilike(like),
                Lead.location.ilike(like),
                Lead.industry.ilike(like),
            )
        )
    if source:
        query = query.filter(Lead.source == source)
    if qualification:
        query = query.filter(Lead.qualification_status == qualification)
    if review:
        query = query.filter(Lead.review_status == review)
    if email_status:
        query = query.filter(Lead.email_status == email_status)
    return query


@router.get("")
def list_leads(
    search: str = "",
    source: str = "",
    qualification: str = "",
    review: str = "",
    email_status: str = "",
    limit: int = 25,
    offset: int = 0,
    db: Session = Depends(get_db),
):
    query = _filtered_query(db, search, source, qualification, review, email_status)
    total = query.count()
    leads = query.order_by(Lead.id.desc()).offset(offset).limit(min(limit, 100)).all()
    return {"total": total, "leads": [lead_out(l) for l in leads]}


@router.post("")
def create_manual_lead(payload: ManualLeadCreate, db: Session = Depends(get_db)):
    lead = Lead(
        company_name=payload.company_name,
        contact_name=payload.contact_name,
        email=str(payload.email) if payload.email else "",
        website=payload.website,
        industry=payload.industry,
        location=payload.location,
        notes=payload.message,
        source="manual",
        source_detail=payload.source_detail or "Manual entry",
        qualification_status="pending",
    )
    db.add(lead)
    db.add(ActivityLog(entity_type="lead", message=f"Lead {lead.company_name} added manually."))
    db.commit()
    return lead_out(lead, full=True)


@router.get("/export")
def export_leads(
    search: str = "",
    source: str = "",
    qualification: str = "",
    review: str = "",
    email_status: str = "",
    ids: str = "",
    db: Session = Depends(get_db),
):
    query = _filtered_query(db, search, source, qualification, review, email_status)
    if ids:
        id_list = [int(i) for i in ids.split(",") if i.strip().isdigit()]
        query = db.query(Lead).filter(Lead.id.in_(id_list))
    leads = query.order_by(Lead.id).limit(10_000).all()

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(
        ["company_name", "website", "industry", "location", "contact_name", "contact_role", "email",
         "email_status", "qualification_status", "relevance_score", "qualification_note",
         "review_status", "source", "discovered_at", "notes"]
    )
    for l in leads:
        writer.writerow(
            [l.company_name, l.website, l.industry, l.location, l.contact_name, l.contact_role, l.email,
             l.email_status, l.qualification_status, f"{l.relevance_score:.0f}", l.qualification_note,
             l.review_status, l.source, l.discovered_at.isoformat() if l.discovered_at else "", l.notes]
        )
    buffer.seek(0)
    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=leads-export.csv"},
    )


@router.get("/{lead_id}")
def get_lead(lead_id: int, db: Session = Depends(get_db)):
    lead = db.get(Lead, lead_id)
    if lead is None:
        raise HTTPException(404, "Lead not found")
    return lead_out(lead, full=True)


@router.patch("/{lead_id}")
def update_lead(lead_id: int, payload: LeadUpdate, db: Session = Depends(get_db)):
    lead = db.get(Lead, lead_id)
    if lead is None:
        raise HTTPException(404, "Lead not found")
    for field, value in payload.model_dump(exclude_none=True).items():
        setattr(lead, field, value)
    db.commit()
    return lead_out(lead, full=True)


@router.delete("/{lead_id}")
def delete_lead(lead_id: int, db: Session = Depends(get_db)):
    lead = db.get(Lead, lead_id)
    if lead is None:
        raise HTTPException(404, "Lead not found")
    db.query(CampaignLead).filter(CampaignLead.lead_id == lead_id).delete()
    if lead.opportunity:
        db.delete(lead.opportunity)
    db.delete(lead)
    db.commit()
    return {"deleted": lead_id}


@router.post("/approve")
def approve_leads(payload: LeadIdList, db: Session = Depends(get_db)):
    updated = 0
    for lead in db.query(Lead).filter(Lead.id.in_(payload.lead_ids)).all():
        lead.review_status = "approved"
        fire_trigger(db, "lead_approved", lead)
        updated += 1
    db.commit()
    return {"approved": updated}


@router.post("/reject")
def reject_leads(payload: LeadIdList, db: Session = Depends(get_db)):
    updated = (
        db.query(Lead).filter(Lead.id.in_(payload.lead_ids)).update({"review_status": "rejected"}, synchronize_session=False)
    )
    db.commit()
    return {"rejected": updated}


@router.post("/add-to-campaign/{campaign_id}")
def add_to_campaign(campaign_id: int, payload: LeadIdList, db: Session = Depends(get_db)):
    campaign = db.get(Campaign, campaign_id)
    if campaign is None:
        raise HTTPException(404, "Campaign not found")
    added = 0
    for lead_id in payload.lead_ids:
        exists = db.query(CampaignLead).filter_by(campaign_id=campaign_id, lead_id=lead_id).first()
        if exists is None and db.get(Lead, lead_id) is not None:
            db.add(CampaignLead(campaign_id=campaign_id, lead_id=lead_id, next_send_at=utcnow()))
            added += 1
    db.commit()
    return {"added": added, "campaign": campaign.name}


@router.post("/send-to-pipeline")
def send_to_pipeline(payload: LeadIdList, db: Session = Depends(get_db)):
    created = 0
    for lead in db.query(Lead).filter(Lead.id.in_(payload.lead_ids)).all():
        if lead.opportunity is None:
            db.add(Opportunity(lead_id=lead.id, title=f"{lead.company_name} opportunity"))
            db.add(ActivityLog(entity_type="opportunity", lead_id=lead.id, message=f"{lead.company_name} sent to the pipeline."))
            created += 1
    db.commit()
    return {"created": created}

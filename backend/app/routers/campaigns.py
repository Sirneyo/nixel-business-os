"""Campaign Engine endpoints."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..db import get_db
from ..engine.campaigns import process_campaigns
from ..models import ActivityLog, Campaign, CampaignLead, CampaignStep, EmailSend, EmailTemplate
from ..schemas import CampaignUpsert
from ..serializers import campaign_out, member_out, send_out

router = APIRouter(prefix="/api/campaigns", tags=["campaigns"])


def _stats(db: Session, campaign: Campaign) -> dict:
    sends = db.query(EmailSend).filter(EmailSend.campaign_id == campaign.id)
    total = sends.count()
    return {
        "emails_sent": total,
        "opened": sends.filter(EmailSend.opened.is_(True)).count(),
        "replied": sends.filter(EmailSend.replied.is_(True)).count(),
        "failed": sends.filter(EmailSend.status == "failed").count(),
    }


def _apply_steps(db: Session, campaign: Campaign, steps: list) -> None:
    db.query(CampaignStep).filter(CampaignStep.campaign_id == campaign.id).delete()
    for position, step in enumerate(steps):
        if db.get(EmailTemplate, step.template_id) is None:
            raise HTTPException(400, f"Template {step.template_id} does not exist.")
        db.add(
            CampaignStep(
                campaign_id=campaign.id,
                position=position,
                template_id=step.template_id,
                delay_days=step.delay_days,
            )
        )


@router.get("")
def list_campaigns(db: Session = Depends(get_db)):
    campaigns = db.query(Campaign).order_by(Campaign.id.desc()).all()
    return [campaign_out(c, stats=_stats(db, c)) for c in campaigns]


@router.post("")
def create_campaign(payload: CampaignUpsert, db: Session = Depends(get_db)):
    campaign = Campaign(**payload.model_dump(exclude={"steps"}))
    db.add(campaign)
    db.flush()
    _apply_steps(db, campaign, payload.steps)
    db.add(ActivityLog(entity_type="campaign", entity_id=campaign.id, message=f"Campaign '{campaign.name}' created."))
    db.commit()
    return campaign_out(campaign)


@router.get("/{campaign_id}")
def get_campaign(campaign_id: int, db: Session = Depends(get_db)):
    campaign = db.get(Campaign, campaign_id)
    if campaign is None:
        raise HTTPException(404, "Campaign not found")
    return campaign_out(campaign, stats=_stats(db, campaign))


@router.put("/{campaign_id}")
def update_campaign(campaign_id: int, payload: CampaignUpsert, db: Session = Depends(get_db)):
    campaign = db.get(Campaign, campaign_id)
    if campaign is None:
        raise HTTPException(404, "Campaign not found")
    for field, value in payload.model_dump(exclude={"steps"}).items():
        setattr(campaign, field, value)
    _apply_steps(db, campaign, payload.steps)
    campaign.is_sample = False
    db.commit()
    db.refresh(campaign)
    return campaign_out(campaign, stats=_stats(db, campaign))


@router.delete("/{campaign_id}")
def delete_campaign(campaign_id: int, db: Session = Depends(get_db)):
    campaign = db.get(Campaign, campaign_id)
    if campaign is None:
        raise HTTPException(404, "Campaign not found")
    db.query(EmailSend).filter(EmailSend.campaign_id == campaign_id).update({"campaign_id": None})
    db.delete(campaign)
    db.commit()
    return {"deleted": campaign_id}


@router.post("/{campaign_id}/start")
def start_campaign(campaign_id: int, db: Session = Depends(get_db)):
    campaign = db.get(Campaign, campaign_id)
    if campaign is None:
        raise HTTPException(404, "Campaign not found")
    if not campaign.steps:
        raise HTTPException(400, "Add at least one email step before starting the campaign.")
    campaign.status = "running"
    db.add(ActivityLog(entity_type="campaign", entity_id=campaign.id, message=f"Campaign '{campaign.name}' started."))
    db.commit()
    return campaign_out(campaign)


@router.post("/{campaign_id}/pause")
def pause_campaign(campaign_id: int, db: Session = Depends(get_db)):
    campaign = db.get(Campaign, campaign_id)
    if campaign is None:
        raise HTTPException(404, "Campaign not found")
    campaign.status = "paused"
    db.add(ActivityLog(entity_type="campaign", entity_id=campaign.id, message=f"Campaign '{campaign.name}' paused."))
    db.commit()
    return campaign_out(campaign)


@router.get("/{campaign_id}/members")
def campaign_members(campaign_id: int, db: Session = Depends(get_db)):
    campaign = db.get(Campaign, campaign_id)
    if campaign is None:
        raise HTTPException(404, "Campaign not found")
    members = (
        db.query(CampaignLead).filter(CampaignLead.campaign_id == campaign_id).order_by(CampaignLead.id.desc()).all()
    )
    return [member_out(m) for m in members]


@router.delete("/{campaign_id}/members/{member_id}")
def remove_member(campaign_id: int, member_id: int, db: Session = Depends(get_db)):
    member = db.get(CampaignLead, member_id)
    if member is None or member.campaign_id != campaign_id:
        raise HTTPException(404, "Campaign member not found")
    db.delete(member)
    db.commit()
    return {"removed": member_id}


@router.get("/{campaign_id}/sends")
def campaign_sends(campaign_id: int, limit: int = 100, db: Session = Depends(get_db)):
    sends = (
        db.query(EmailSend)
        .filter(EmailSend.campaign_id == campaign_id)
        .order_by(EmailSend.id.desc())
        .limit(min(limit, 500))
        .all()
    )
    return [send_out(s) for s in sends]


@router.post("/run-tick")
def run_tick(db: Session = Depends(get_db)):
    """Process due campaign sends immediately instead of waiting for the scheduler."""
    sent = process_campaigns(db)
    return {"emails_processed": sent}

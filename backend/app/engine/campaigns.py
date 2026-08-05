"""Campaign send processing (invoked by the background scheduler)."""

from datetime import datetime, timedelta

from sqlalchemy.orm import Session

from ..models import Campaign, CampaignLead, EmailSend, utcnow
from .sending import send_templated_email


def _within_window(campaign: Campaign, now: datetime) -> bool:
    day_ok = str(now.isoweekday()) in {d.strip() for d in campaign.send_days.split(",") if d.strip()}
    time_str = now.strftime("%H:%M")
    return day_ok and campaign.send_window_start <= time_str <= campaign.send_window_end


def _sends_today(db: Session, campaign: Campaign, now: datetime) -> int:
    day_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    return (
        db.query(EmailSend)
        .filter(EmailSend.campaign_id == campaign.id, EmailSend.sent_at >= day_start)
        .count()
    )


def process_campaigns(db: Session) -> int:
    """Send every due campaign email inside its window and daily limit."""
    now = utcnow()
    sent = 0
    campaigns = db.query(Campaign).filter(Campaign.status == "running").all()
    for campaign in campaigns:
        if not campaign.steps or not _within_window(campaign, now):
            continue
        budget = max(0, campaign.daily_limit - _sends_today(db, campaign, now))
        if budget == 0:
            continue

        due = (
            db.query(CampaignLead)
            .filter(
                CampaignLead.campaign_id == campaign.id,
                CampaignLead.status.in_(["queued", "in_sequence"]),
                CampaignLead.next_send_at <= now,
            )
            .limit(budget)
            .all()
        )
        for member in due:
            step_index = member.current_step
            if step_index >= len(campaign.steps):
                member.status = "completed"
                db.commit()
                continue
            step = campaign.steps[step_index]
            send = send_templated_email(
                db,
                lead=member.lead,
                template=step.template,
                campaign_id=campaign.id,
                step_position=step.position,
                sender_name=campaign.sender_name,
            )
            if send.replied:
                member.status = "replied"
                member.next_send_at = None
            else:
                member.current_step = step_index + 1
                member.status = "in_sequence"
                if member.current_step >= len(campaign.steps):
                    member.status = "completed"
                    member.next_send_at = None
                else:
                    next_step = campaign.steps[member.current_step]
                    member.next_send_at = now + timedelta(days=max(next_step.delay_days, 0))
            db.commit()
            sent += 1
    return sent

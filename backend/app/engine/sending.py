"""Single choke point for every outbound email (campaigns, automations, tests)."""

from sqlalchemy.orm import Session

from ..emailing import render_template
from ..models import ActivityLog, EmailSend, EmailTemplate, Lead
from ..providers import get_email_sender


def send_templated_email(
    db: Session,
    *,
    lead: Lead,
    template: EmailTemplate,
    campaign_id: int | None = None,
    automation_id: int | None = None,
    step_position: int = 0,
    sender_name: str = "",
) -> EmailSend:
    subject, html, text = render_template(db, template, lead, sender_name)
    sender = get_email_sender()

    send = EmailSend(
        lead_id=lead.id,
        campaign_id=campaign_id,
        automation_id=automation_id,
        template_id=template.id,
        step_position=step_position,
        subject=subject,
    )

    if not lead.email:
        send.status = "failed"
        send.error_message = "Lead has no email address."
    else:
        result = sender.send(to_email=lead.email, subject=subject, html=html, text=text)
        send.status = result.status
        send.error_message = "" if result.status == "sent" else result.detail

    db.add(send)
    db.add(
        ActivityLog(
            entity_type="campaign" if campaign_id else "automation",
            entity_id=campaign_id or automation_id,
            lead_id=lead.id,
            message=f"Email '{subject}' to {lead.email or '(no email)'}: {send.status}.",
        )
    )
    db.commit()
    return send

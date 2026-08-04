"""Automation engine: triggers, sequential steps, delays and simulation mode.

Automations are deliberately linear and readable for non-technical users:
trigger → step → step → … Each step is one of a small set of actions. In
simulation mode every action is logged but nothing external happens.
"""

import json
from datetime import timedelta

from sqlalchemy.orm import Session

from ..models import (
    ActivityLog,
    Automation,
    AutomationEnrollment,
    AutomationLog,
    Campaign,
    CampaignLead,
    EmailSend,
    EmailTemplate,
    Lead,
    Opportunity,
    utcnow,
)

TRIGGERS = {
    "lead_qualified": "Lead verified & qualified by the engine",
    "lead_approved": "Lead approved in the workspace",
    "inbound_lead": "New inbound lead received",
    "manual": "Manually enrolled only",
}

STEP_KINDS = {
    "send_email": "Send an email template",
    "add_to_campaign": "Add the lead to a campaign",
    "wait": "Wait a number of days",
    "check_replied": "Check response status (stop if replied)",
    "create_opportunity": "Create a pipeline opportunity",
    "add_note": "Add a note to the lead",
}


def _log(db: Session, automation: Automation, lead: Lead | None, message: str, level: str = "info") -> None:
    db.add(AutomationLog(automation_id=automation.id, lead_id=lead.id if lead else None, level=level, message=message))


def fire_trigger(db: Session, trigger: str, lead: Lead) -> int:
    """Enroll `lead` into every active automation listening for `trigger`."""
    enrolled = 0
    automations = db.query(Automation).filter(Automation.trigger == trigger, Automation.status == "active").all()
    for automation in automations:
        if enroll(db, automation, lead):
            enrolled += 1
    return enrolled


def enroll(db: Session, automation: Automation, lead: Lead) -> bool:
    exists = (
        db.query(AutomationEnrollment)
        .filter(AutomationEnrollment.automation_id == automation.id, AutomationEnrollment.lead_id == lead.id)
        .first()
    )
    if exists:
        return False
    db.add(AutomationEnrollment(automation_id=automation.id, lead_id=lead.id, next_eligible_at=utcnow()))
    _log(db, automation, lead, f"{lead.company_name} enrolled (trigger: {TRIGGERS.get(automation.trigger, automation.trigger)}).", "info")
    db.commit()
    return True


def process_enrollments(db: Session) -> int:
    """Advance every due enrollment by executing steps until a wait or the end."""
    now = utcnow()
    due = (
        db.query(AutomationEnrollment)
        .join(Automation)
        .filter(
            AutomationEnrollment.status == "active",
            Automation.status == "active",
            AutomationEnrollment.next_eligible_at <= now,
        )
        .all()
    )
    advanced = 0
    for enrollment in due:
        automation = enrollment.automation
        lead = enrollment.lead
        steps = automation.steps
        # Execute consecutive steps until we hit a wait, a stop, or the end.
        while enrollment.status == "active":
            if enrollment.current_step >= len(steps):
                enrollment.status = "completed"
                _log(db, automation, lead, f"{lead.company_name} completed the automation.", "success")
                break
            step = steps[enrollment.current_step]
            config = json.loads(step.config or "{}")
            should_continue = _execute_step(db, automation, enrollment, lead, step.kind, config)
            enrollment.current_step += 1
            advanced += 1
            if not should_continue:
                break
        db.commit()
    return advanced


def _execute_step(db, automation: Automation, enrollment: AutomationEnrollment, lead: Lead, kind: str, config: dict) -> bool:
    """Run one step. Returns True to continue to the next step immediately."""
    simulated = automation.simulation_mode

    if kind == "wait":
        days = int(config.get("days", 1))
        hours = int(config.get("hours", 0))
        enrollment.next_eligible_at = utcnow() + timedelta(days=days, hours=hours)
        _log(db, automation, lead, f"Waiting {days}d {hours}h before the next step for {lead.company_name}.", "info")
        return False

    if kind == "send_email":
        template = db.get(EmailTemplate, int(config.get("template_id", 0)))
        if template is None:
            _log(db, automation, lead, "Step skipped: the selected email template no longer exists.", "warning")
            return True
        if simulated or not lead.email:
            reason = "simulation mode" if simulated else "lead has no email address"
            _log(db, automation, lead, f"[Simulated] Would send '{template.name}' to {lead.email or '(no email)'} ({reason}).", "simulated")
            return True
        from .sending import send_templated_email

        send = send_templated_email(db, lead=lead, template=template, automation_id=automation.id)
        level = "success" if send.status in ("sent", "simulated") else "error"
        _log(db, automation, lead, f"Email '{template.name}' to {lead.email}: {send.status}.", level)
        return True

    if kind == "add_to_campaign":
        campaign = db.get(Campaign, int(config.get("campaign_id", 0)))
        if campaign is None:
            _log(db, automation, lead, "Step skipped: the selected campaign no longer exists.", "warning")
            return True
        if simulated:
            _log(db, automation, lead, f"[Simulated] Would add {lead.company_name} to campaign '{campaign.name}'.", "simulated")
            return True
        exists = db.query(CampaignLead).filter_by(campaign_id=campaign.id, lead_id=lead.id).first()
        if exists:
            _log(db, automation, lead, f"{lead.company_name} is already in campaign '{campaign.name}'.", "info")
        else:
            db.add(CampaignLead(campaign_id=campaign.id, lead_id=lead.id, next_send_at=utcnow()))
            _log(db, automation, lead, f"Added {lead.company_name} to campaign '{campaign.name}'.", "success")
        return True

    if kind == "check_replied":
        replied = (
            db.query(EmailSend).filter(EmailSend.lead_id == lead.id, EmailSend.replied.is_(True)).first() is not None
        )
        if replied:
            enrollment.status = "stopped"
            _log(db, automation, lead, f"{lead.company_name} has replied — stopping the automation.", "success")
            return False
        _log(db, automation, lead, f"No reply from {lead.company_name} yet — continuing.", "info")
        return True

    if kind == "create_opportunity":
        if simulated:
            _log(db, automation, lead, f"[Simulated] Would create a pipeline opportunity for {lead.company_name}.", "simulated")
            return True
        if lead.opportunity is None:
            stage = config.get("stage", "new_lead")
            db.add(Opportunity(lead_id=lead.id, title=f"{lead.company_name} opportunity", stage=stage))
            db.add(ActivityLog(entity_type="opportunity", lead_id=lead.id, message=f"Opportunity created for {lead.company_name} by automation '{automation.name}'."))
            _log(db, automation, lead, f"Created a pipeline opportunity for {lead.company_name}.", "success")
        else:
            _log(db, automation, lead, f"{lead.company_name} already has a pipeline opportunity.", "info")
        return True

    if kind == "add_note":
        text = config.get("text", "")
        if text:
            lead.notes = (lead.notes + "\n" if lead.notes else "") + f"[Automation] {text}"
            _log(db, automation, lead, f"Note added to {lead.company_name}.", "success")
        return True

    _log(db, automation, lead, f"Unknown step kind '{kind}' skipped.", "warning")
    return True

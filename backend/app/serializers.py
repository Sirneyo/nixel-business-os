"""Plain-dict serializers shared by the routers."""

from .models import (
    Automation,
    AutomationLog,
    Campaign,
    CampaignLead,
    EmailSend,
    EmailTemplate,
    EngineRun,
    Lead,
    Opportunity,
    RunEvent,
)
import json


def iso(dt) -> str | None:
    return dt.isoformat() + "Z" if dt else None


def lead_out(lead: Lead, *, full: bool = False) -> dict:
    data = {
        "id": lead.id,
        "company_name": lead.company_name,
        "website": lead.website,
        "industry": lead.industry,
        "location": lead.location,
        "contact_name": lead.contact_name,
        "contact_role": lead.contact_role,
        "email": lead.email,
        "email_status": lead.email_status,
        "qualification_status": lead.qualification_status,
        "relevance_score": lead.relevance_score,
        "qualification_note": lead.qualification_note,
        "review_status": lead.review_status,
        "source": lead.source,
        "source_detail": lead.source_detail,
        "is_sample": lead.is_sample,
        "discovered_at": iso(lead.discovered_at),
        "campaign_count": len(lead.campaign_members),
        "in_pipeline": lead.opportunity is not None,
    }
    if full:
        data.update(
            {
                "description": lead.description,
                "email_check_detail": lead.email_check_detail,
                "research_summary": lead.research_summary,
                "notes": lead.notes,
                "campaigns": [
                    {"campaign_id": m.campaign_id, "campaign_name": m.campaign.name, "status": m.status}
                    for m in lead.campaign_members
                ],
                "opportunity_id": lead.opportunity.id if lead.opportunity else None,
                "pipeline_stage": lead.opportunity.stage if lead.opportunity else None,
            }
        )
    return data


def run_out(run: EngineRun) -> dict:
    return {
        "id": run.id,
        "industry": run.industry,
        "target_customer": run.target_customer,
        "keywords": run.keywords,
        "location": run.location,
        "business_type": run.business_type,
        "criteria": run.criteria,
        "leads_requested": run.leads_requested,
        "status": run.status,
        "current_stage": run.current_stage,
        "counters": {
            "discovered": run.discovered,
            "researched": run.researched,
            "contacts_found": run.contacts_found,
            "emails_verified": run.emails_verified,
            "qualified": run.qualified,
            "rejected": run.rejected,
            "saved": run.saved,
        },
        "error_message": run.error_message,
        "is_sample": run.is_sample,
        "created_at": iso(run.created_at),
        "finished_at": iso(run.finished_at),
    }


def event_out(event: RunEvent) -> dict:
    return {
        "id": event.id,
        "stage": event.stage,
        "agent": event.agent,
        "level": event.level,
        "message": event.message,
        "company_name": event.company_name,
        "created_at": iso(event.created_at),
    }


def template_out(template: EmailTemplate) -> dict:
    return {
        "id": template.id,
        "name": template.name,
        "subject": template.subject,
        "blocks": json.loads(template.blocks or "[]"),
        "is_sample": template.is_sample,
        "updated_at": iso(template.updated_at),
    }


def campaign_out(campaign: Campaign, *, stats: dict | None = None) -> dict:
    return {
        "id": campaign.id,
        "name": campaign.name,
        "status": campaign.status,
        "sender_name": campaign.sender_name,
        "sender_email": campaign.sender_email,
        "daily_limit": campaign.daily_limit,
        "send_window_start": campaign.send_window_start,
        "send_window_end": campaign.send_window_end,
        "send_days": campaign.send_days,
        "is_sample": campaign.is_sample,
        "created_at": iso(campaign.created_at),
        "steps": [
            {
                "id": s.id,
                "position": s.position,
                "template_id": s.template_id,
                "template_name": s.template.name if s.template else "",
                "delay_days": s.delay_days,
            }
            for s in campaign.steps
        ],
        "member_count": len(campaign.members),
        "stats": stats or {},
    }


def member_out(member: CampaignLead) -> dict:
    return {
        "id": member.id,
        "lead_id": member.lead_id,
        "company_name": member.lead.company_name,
        "email": member.lead.email,
        "status": member.status,
        "current_step": member.current_step,
        "next_send_at": iso(member.next_send_at),
    }


def send_out(send: EmailSend) -> dict:
    return {
        "id": send.id,
        "lead_id": send.lead_id,
        "company_name": send.lead.company_name if send.lead else "",
        "to_email": send.lead.email if send.lead else "",
        "subject": send.subject,
        "step_position": send.step_position,
        "status": send.status,
        "error_message": send.error_message,
        "opened": send.opened,
        "replied": send.replied,
        "sent_at": iso(send.sent_at),
    }


def automation_out(automation: Automation, *, stats: dict | None = None) -> dict:
    return {
        "id": automation.id,
        "name": automation.name,
        "trigger": automation.trigger,
        "status": automation.status,
        "simulation_mode": automation.simulation_mode,
        "is_sample": automation.is_sample,
        "created_at": iso(automation.created_at),
        "steps": [
            {"id": s.id, "position": s.position, "kind": s.kind, "config": json.loads(s.config or "{}")}
            for s in automation.steps
        ],
        "stats": stats or {},
    }


def automation_log_out(log: AutomationLog) -> dict:
    return {
        "id": log.id,
        "lead_id": log.lead_id,
        "level": log.level,
        "message": log.message,
        "created_at": iso(log.created_at),
    }


def opportunity_out(opp: Opportunity) -> dict:
    return {
        "id": opp.id,
        "lead_id": opp.lead_id,
        "company_name": opp.lead.company_name if opp.lead else "",
        "contact_name": opp.lead.contact_name if opp.lead else "",
        "email": opp.lead.email if opp.lead else "",
        "title": opp.title,
        "stage": opp.stage,
        "value": opp.value,
        "notes": opp.notes,
        "is_sample": opp.is_sample,
        "created_at": iso(opp.created_at),
        "updated_at": iso(opp.updated_at),
    }

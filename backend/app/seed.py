"""Optional sample-data seeding utility.

NOT used automatically — the app starts with a clean, empty workspace.
Developers can call `reseed_samples()` manually (e.g. from a Python shell)
to create a labelled sample workspace for testing. Everything created here is
flagged `is_sample=True`.
"""

import json
import random
from datetime import timedelta

from sqlalchemy.orm import Session

from .models import (
    ActivityLog,
    Automation,
    AutomationStep,
    Campaign,
    CampaignLead,
    CampaignStep,
    EmailSend,
    EmailTemplate,
    EngineRun,
    Lead,
    Opportunity,
    RunEvent,
    utcnow,
)

SAMPLE_TEMPLATES = [
    {
        "name": "Sample — Introduction",
        "subject": "Quick question about {{company_name}}",
        "blocks": [
            {"type": "heading", "text": "Hi {{first_name}},", "level": 2},
            {"type": "text", "html": "I came across {{company_name}} while researching {{industry}} businesses in {{location}} and wanted to reach out directly."},
            {"type": "text", "html": "We help businesses like yours with {{primary_offer}}. Would you be open to a short call this week to see if it's a fit?"},
            {"type": "button", "text": "Book a 15-minute call", "url": "https://example.com/book"},
            {"type": "divider"},
            {"type": "footer", "text": "Sent by {{sender_name}} at {{business_name}}. Reply STOP to opt out."},
        ],
    },
    {
        "name": "Sample — Follow-up",
        "subject": "Following up, {{first_name}}",
        "blocks": [
            {"type": "heading", "text": "Hi {{first_name}},", "level": 2},
            {"type": "text", "html": "Just floating my last note back to the top of your inbox — I know things get busy at {{company_name}}."},
            {"type": "text", "html": "If it's easier, reply with a good time and I'll send a calendar invite."},
            {"type": "divider"},
            {"type": "footer", "text": "Sent by {{sender_name}} at {{business_name}}. Reply STOP to opt out."},
        ],
    },
    {
        "name": "Sample — Break-up",
        "subject": "Should I close your file, {{first_name}}?",
        "blocks": [
            {"type": "heading", "text": "Hi {{first_name}},", "level": 2},
            {"type": "text", "html": "I haven't heard back, so I'll assume the timing isn't right for {{company_name}} and stop reaching out."},
            {"type": "text", "html": "If anything changes, this inbox is always open."},
            {"type": "divider"},
            {"type": "footer", "text": "Sent by {{sender_name}} at {{business_name}}. Reply STOP to opt out."},
        ],
    },
]

_COMPANIES = [
    ("Harborline {industry} Co", "Sarah Whitfield", "Owner", "valid", "qualified", 84),
    ("Northgate {industry} Group", "James Okafor", "Managing Director", "valid", "qualified", 78),
    ("Bluepeak {industry} Ltd", "Priya Kaur", "Founder", "risky", "qualified", 66),
    ("Oakfield {industry} Services", "", "", "not_found", "rejected", 34),
    ("Silverline {industry} Partners", "Elena Marsh", "Director", "valid", "qualified", 88),
    ("Crestwood {industry} Studio", "Tom Bennett", "General Manager", "invalid", "rejected", 41),
    ("Meridian {industry} Solutions", "Grace Delgado", "Operations Manager", "valid", "qualified", 72),
    ("Fairview {industry} Trading", "Owen Hughes", "Owner", "risky", "qualified", 61),
]


def _slug(name: str) -> str:
    return "".join(c for c in name.lower() if c.isalnum())[:24]


def reseed_samples(db: Session, *, industry: str = "", location: str = "", audience: str = "") -> None:
    """Delete existing sample rows and build a fresh labelled sample workspace."""
    industry = (industry or "Consulting").strip().title()
    location = (location or "Manchester").strip()

    # Remove previous sample data (children first).
    sample_lead_ids = [l.id for l in db.query(Lead.id).filter(Lead.is_sample.is_(True)).all()]
    if sample_lead_ids:
        db.query(EmailSend).filter(EmailSend.lead_id.in_(sample_lead_ids)).delete(synchronize_session=False)
        db.query(CampaignLead).filter(CampaignLead.lead_id.in_(sample_lead_ids)).delete(synchronize_session=False)
        db.query(Opportunity).filter(Opportunity.lead_id.in_(sample_lead_ids)).delete(synchronize_session=False)
        db.query(ActivityLog).filter(ActivityLog.lead_id.in_(sample_lead_ids)).delete(synchronize_session=False)
    for model in (Campaign, Automation, EngineRun):
        for row in db.query(model).filter(model.is_sample.is_(True)).all():
            db.delete(row)
    db.query(Lead).filter(Lead.is_sample.is_(True)).delete(synchronize_session=False)
    db.query(EmailTemplate).filter(EmailTemplate.is_sample.is_(True)).delete(synchronize_session=False)
    db.commit()

    now = utcnow()
    rng = random.Random(industry + location)

    # ── Sample engine run (completed) with a realistic event trail ────────
    run = EngineRun(
        industry=industry,
        target_customer=audience or f"Independent {industry.lower()} businesses",
        keywords=industry.lower(),
        location=location,
        business_type=industry.lower(),
        leads_requested=8,
        status="completed",
        current_stage="done",
        is_sample=True,
        created_at=now - timedelta(days=2, hours=3),
        finished_at=now - timedelta(days=2, hours=2, minutes=48),
    )
    db.add(run)
    db.flush()

    leads: list[Lead] = []
    for name_tpl, contact, role, email_status, qual, score in _COMPANIES:
        name = name_tpl.format(industry=industry)
        domain = f"{_slug(name)}.example.com"
        email = f"{contact.split(' ')[0].lower()}@{domain}" if contact else ""
        qualified = qual == "qualified"
        note = (
            f"Qualified at {score}/100: verified email, active website and a good match with your target market in {location}."
            if qualified
            else f"Rejected at {score}/100: " + ("no usable email address was found." if email_status == "not_found" else "the email address failed verification.")
        )
        lead = Lead(
            company_name=name,
            website=f"https://www.{domain}",
            industry=industry,
            location=location,
            description=f"{name} is a {industry.lower()} business operating around {location}.",
            contact_name=contact,
            contact_role=role,
            email=email,
            email_status=email_status,
            email_check_detail="Sample verification result.",
            research_summary=f"Reviewed 3 pages. Established {industry.lower()} business with clear services and a named owner on the about page.",
            qualification_status=qual,
            relevance_score=score,
            qualification_note=note,
            review_status="new",
            source="engine",
            source_detail="Sample data",
            engine_run_id=run.id,
            is_sample=True,
            discovered_at=now - timedelta(days=2, hours=3),
        )
        db.add(lead)
        leads.append(lead)
    db.flush()

    run.discovered = len(leads)
    run.researched = len(leads)
    run.contacts_found = sum(1 for l in leads if l.email)
    run.emails_verified = sum(1 for l in leads if l.email_status not in ("not_found",))
    run.qualified = sum(1 for l in leads if l.qualification_status == "qualified")
    run.rejected = len(leads) - run.qualified
    run.saved = run.qualified

    event_time = run.created_at
    for lead in leads[:4]:
        for stage, agent, message in [
            ("discovery", "Lead Scout", f"Discovered {lead.company_name} — {lead.website}."),
            ("research", "Website Researcher", f"Reviewed {lead.website}/about."),
            ("verification", "Email Validator", f"{lead.email or '(no email)'}: {lead.email_status}."),
            ("assessment", "Qualification Analyst", lead.qualification_note),
        ]:
            event_time += timedelta(seconds=rng.randint(8, 30))
            db.add(RunEvent(run_id=run.id, stage=stage, agent=agent, level="info", message=message, company_name=lead.company_name, created_at=event_time))
    db.add(RunEvent(run_id=run.id, stage="system", agent="Engine", level="success", message=f"Run complete: {run.qualified} qualified leads saved.", created_at=run.finished_at))

    # ── Sample inbound lead ───────────────────────────────────────────────
    inbound = Lead(
        company_name=f"Brightway {industry} Ltd",
        contact_name="Nadia Carter",
        email=f"nadia@brightway{_slug(industry)}.example.com",
        website=f"https://www.brightway{_slug(industry)}.example.com",
        industry=industry,
        location=location,
        notes="Submitted the website contact form asking about pricing.",
        source="inbound",
        source_detail="Sample website form",
        qualification_status="pending",
        is_sample=True,
        discovered_at=now - timedelta(days=1, hours=4),
    )
    db.add(inbound)
    db.flush()

    # ── Sample templates ──────────────────────────────────────────────────
    templates: list[EmailTemplate] = []
    for spec in SAMPLE_TEMPLATES:
        template = EmailTemplate(name=spec["name"], subject=spec["subject"], blocks=json.dumps(spec["blocks"]), is_sample=True)
        db.add(template)
        templates.append(template)
    db.flush()

    # ── Sample campaign with results ──────────────────────────────────────
    campaign = Campaign(name=f"Sample — {location} {industry} outreach", status="paused", sender_name="Alex", is_sample=True)
    db.add(campaign)
    db.flush()
    for position, (template, delay) in enumerate(zip(templates, [0, 3, 4])):
        db.add(CampaignStep(campaign_id=campaign.id, position=position, template_id=template.id, delay_days=delay))
    qualified_leads = [l for l in leads if l.qualification_status == "qualified"]
    for i, lead in enumerate(qualified_leads):
        replied = i == 1
        db.add(CampaignLead(campaign_id=campaign.id, lead_id=lead.id, status="replied" if replied else "in_sequence", current_step=1 if replied else 1))
        send = EmailSend(
            lead_id=lead.id,
            campaign_id=campaign.id,
            template_id=templates[0].id,
            subject=f"Quick question about {lead.company_name}",
            status="simulated",
            opened=i % 2 == 0,
            replied=replied,
            sent_at=now - timedelta(days=1, hours=i),
        )
        db.add(send)

    # ── Sample automation ─────────────────────────────────────────────────
    automation = Automation(name="Sample — New qualified lead follow-up", trigger="lead_qualified", status="paused", simulation_mode=True, is_sample=True)
    db.add(automation)
    db.flush()
    steps = [
        ("add_to_campaign", {"campaign_id": campaign.id}),
        ("wait", {"days": 3}),
        ("check_replied", {}),
        ("send_email", {"template_id": templates[1].id}),
        ("wait", {"days": 4}),
        ("create_opportunity", {"stage": "contacted"}),
    ]
    for position, (kind, config) in enumerate(steps):
        db.add(AutomationStep(automation_id=automation.id, position=position, kind=kind, config=json.dumps(config)))

    # ── Sample pipeline ───────────────────────────────────────────────────
    stages = ["contacted", "replied", "meeting_booked", "proposal_sent", "won"]
    for lead, stage in zip(qualified_leads, stages):
        db.add(Opportunity(lead_id=lead.id, title=f"{lead.company_name} opportunity", stage=stage, value=rng.choice([1500, 2500, 4000, 6000]), is_sample=True))

    db.add(ActivityLog(entity_type="system", message="Sample workspace created. Everything labelled 'Sample' is demo data — replace it with your own as you go."))
    db.commit()

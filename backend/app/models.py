"""Domain models for Nixel Business OS — Starter Edition.

Every table is generic and reusable: no company-specific data lives in code.
Sample rows created by the seeder are flagged with `is_sample=True` so the UI
can label them clearly.
"""

from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


def utcnow() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class Setting(Base):
    """Key/value app settings (onboarding profile, webhook key overrides, etc.)."""

    __tablename__ = "settings"

    id: Mapped[int] = mapped_column(primary_key=True)
    key: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    value: Mapped[str] = mapped_column(Text, default="")


# ── Account & sessions ──────────────────────────────────────────────────────


class User(Base):
    """The workspace owner. Passwords and recovery keys are stored as salted
    PBKDF2 hashes — never in plain text."""

    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String(500))
    # Hash of the one-time recovery key shown at signup (used when the
    # password is forgotten and no email sending is configured).
    recovery_hash: Mapped[str] = mapped_column(String(500), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


class AuthSession(Base):
    """A login session; the token is sent as a Bearer header by the frontend."""

    __tablename__ = "auth_sessions"

    id: Mapped[int] = mapped_column(primary_key=True)
    token: Mapped[str] = mapped_column(String(128), unique=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    expires_at: Mapped[datetime] = mapped_column(DateTime)


# ── Leads ───────────────────────────────────────────────────────────────────


class Lead(Base):
    __tablename__ = "leads"

    id: Mapped[int] = mapped_column(primary_key=True)
    company_name: Mapped[str] = mapped_column(String(255), index=True)
    website: Mapped[str] = mapped_column(String(500), default="")
    industry: Mapped[str] = mapped_column(String(255), default="")
    location: Mapped[str] = mapped_column(String(255), default="")
    description: Mapped[str] = mapped_column(Text, default="")

    contact_name: Mapped[str] = mapped_column(String(255), default="")
    contact_role: Mapped[str] = mapped_column(String(255), default="")
    email: Mapped[str] = mapped_column(String(320), default="", index=True)
    # unverified | valid | risky | invalid | not_found
    email_status: Mapped[str] = mapped_column(String(30), default="unverified")
    email_check_detail: Mapped[str] = mapped_column(String(500), default="")

    research_summary: Mapped[str] = mapped_column(Text, default="")
    # pending | qualified | rejected
    qualification_status: Mapped[str] = mapped_column(String(30), default="pending", index=True)
    relevance_score: Mapped[float] = mapped_column(Float, default=0.0)
    qualification_note: Mapped[str] = mapped_column(Text, default="")

    # new | approved | rejected  (user review decision in the workspace)
    review_status: Mapped[str] = mapped_column(String(30), default="new", index=True)

    # engine | inbound | manual | api
    source: Mapped[str] = mapped_column(String(30), default="engine", index=True)
    source_detail: Mapped[str] = mapped_column(String(255), default="")
    engine_run_id: Mapped[int | None] = mapped_column(ForeignKey("engine_runs.id"), nullable=True)

    notes: Mapped[str] = mapped_column(Text, default="")
    is_sample: Mapped[bool] = mapped_column(Boolean, default=False)
    discovered_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)

    campaign_members: Mapped[list["CampaignLead"]] = relationship(back_populates="lead")
    opportunity: Mapped["Opportunity | None"] = relationship(back_populates="lead", uselist=False)


# ── Lead Generation Engine runs ─────────────────────────────────────────────


class EngineRun(Base):
    """One end-to-end lead generation run with live, observable stages."""

    __tablename__ = "engine_runs"

    id: Mapped[int] = mapped_column(primary_key=True)
    # Search brief entered by the user.
    industry: Mapped[str] = mapped_column(String(255), default="")
    target_customer: Mapped[str] = mapped_column(String(500), default="")
    keywords: Mapped[str] = mapped_column(String(500), default="")
    location: Mapped[str] = mapped_column(String(255), default="")
    business_type: Mapped[str] = mapped_column(String(255), default="")
    criteria: Mapped[str] = mapped_column(Text, default="")
    leads_requested: Mapped[int] = mapped_column(Integer, default=10)

    # queued | running | completed | failed | cancelled
    status: Mapped[str] = mapped_column(String(30), default="queued", index=True)
    current_stage: Mapped[str] = mapped_column(String(50), default="")
    # Counters kept up to date while the run progresses.
    discovered: Mapped[int] = mapped_column(Integer, default=0)
    researched: Mapped[int] = mapped_column(Integer, default=0)
    contacts_found: Mapped[int] = mapped_column(Integer, default=0)
    emails_verified: Mapped[int] = mapped_column(Integer, default=0)
    qualified: Mapped[int] = mapped_column(Integer, default=0)
    rejected: Mapped[int] = mapped_column(Integer, default=0)
    saved: Mapped[int] = mapped_column(Integer, default=0)

    error_message: Mapped[str] = mapped_column(Text, default="")
    is_sample: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    events: Mapped[list["RunEvent"]] = relationship(back_populates="run", cascade="all, delete-orphan")


class RunEvent(Base):
    """A single line in the live activity feed of an engine run."""

    __tablename__ = "run_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    run_id: Mapped[int] = mapped_column(ForeignKey("engine_runs.id"), index=True)
    # search | discovery | research | contacts | verification | assessment | saving | system
    stage: Mapped[str] = mapped_column(String(50), default="system")
    agent: Mapped[str] = mapped_column(String(100), default="Engine")
    # info | success | warning | error
    level: Mapped[str] = mapped_column(String(20), default="info")
    message: Mapped[str] = mapped_column(Text, default="")
    company_name: Mapped[str] = mapped_column(String(255), default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    run: Mapped[EngineRun] = relationship(back_populates="events")


# ── Email templates ─────────────────────────────────────────────────────────


class EmailTemplate(Base):
    __tablename__ = "email_templates"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255))
    subject: Mapped[str] = mapped_column(String(500), default="")
    # JSON list of content blocks (see email_render.py for the vocabulary).
    blocks: Mapped[str] = mapped_column(Text, default="[]")
    is_sample: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)


# ── Campaigns ───────────────────────────────────────────────────────────────


class Campaign(Base):
    __tablename__ = "campaigns"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255))
    # draft | running | paused | completed
    status: Mapped[str] = mapped_column(String(30), default="draft", index=True)
    sender_name: Mapped[str] = mapped_column(String(255), default="")
    sender_email: Mapped[str] = mapped_column(String(320), default="")
    daily_limit: Mapped[int] = mapped_column(Integer, default=50)
    send_window_start: Mapped[str] = mapped_column(String(5), default="09:00")
    send_window_end: Mapped[str] = mapped_column(String(5), default="17:00")
    # Comma-separated ISO weekday numbers (1=Mon … 7=Sun).
    send_days: Mapped[str] = mapped_column(String(30), default="1,2,3,4,5")
    is_sample: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    steps: Mapped[list["CampaignStep"]] = relationship(
        back_populates="campaign", cascade="all, delete-orphan", order_by="CampaignStep.position"
    )
    members: Mapped[list["CampaignLead"]] = relationship(back_populates="campaign", cascade="all, delete-orphan")


class CampaignStep(Base):
    __tablename__ = "campaign_steps"

    id: Mapped[int] = mapped_column(primary_key=True)
    campaign_id: Mapped[int] = mapped_column(ForeignKey("campaigns.id"), index=True)
    position: Mapped[int] = mapped_column(Integer, default=0)
    template_id: Mapped[int] = mapped_column(ForeignKey("email_templates.id"))
    # Days to wait after the previous step (0 for the first step = immediate).
    delay_days: Mapped[int] = mapped_column(Integer, default=0)

    campaign: Mapped[Campaign] = relationship(back_populates="steps")
    template: Mapped[EmailTemplate] = relationship()


class CampaignLead(Base):
    __tablename__ = "campaign_leads"
    __table_args__ = (UniqueConstraint("campaign_id", "lead_id", name="uq_campaign_lead"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    campaign_id: Mapped[int] = mapped_column(ForeignKey("campaigns.id"), index=True)
    lead_id: Mapped[int] = mapped_column(ForeignKey("leads.id"), index=True)
    # queued | in_sequence | replied | completed | stopped
    status: Mapped[str] = mapped_column(String(30), default="queued")
    current_step: Mapped[int] = mapped_column(Integer, default=0)
    next_send_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, index=True)
    added_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    campaign: Mapped[Campaign] = relationship(back_populates="members")
    lead: Mapped[Lead] = relationship(back_populates="campaign_members")


class EmailSend(Base):
    """Log of every email the system sends (or simulates in demo mode)."""

    __tablename__ = "email_sends"

    id: Mapped[int] = mapped_column(primary_key=True)
    lead_id: Mapped[int] = mapped_column(ForeignKey("leads.id"), index=True)
    campaign_id: Mapped[int | None] = mapped_column(ForeignKey("campaigns.id"), nullable=True, index=True)
    automation_id: Mapped[int | None] = mapped_column(ForeignKey("automations.id"), nullable=True)
    template_id: Mapped[int | None] = mapped_column(ForeignKey("email_templates.id"), nullable=True)
    step_position: Mapped[int] = mapped_column(Integer, default=0)
    subject: Mapped[str] = mapped_column(String(500), default="")
    # simulated | sent | failed
    status: Mapped[str] = mapped_column(String(30), default="simulated")
    error_message: Mapped[str] = mapped_column(Text, default="")
    opened: Mapped[bool] = mapped_column(Boolean, default=False)
    replied: Mapped[bool] = mapped_column(Boolean, default=False)
    sent_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    lead: Mapped[Lead] = relationship()


# ── Automations ─────────────────────────────────────────────────────────────


class Automation(Base):
    __tablename__ = "automations"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255))
    # Trigger: lead_qualified | lead_approved | inbound_lead | manual
    trigger: Mapped[str] = mapped_column(String(50), default="manual")
    # active | paused
    status: Mapped[str] = mapped_column(String(30), default="paused", index=True)
    # When true, actions are logged but nothing external happens.
    simulation_mode: Mapped[bool] = mapped_column(Boolean, default=True)
    is_sample: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    steps: Mapped[list["AutomationStep"]] = relationship(
        back_populates="automation", cascade="all, delete-orphan", order_by="AutomationStep.position"
    )
    enrollments: Mapped[list["AutomationEnrollment"]] = relationship(
        back_populates="automation", cascade="all, delete-orphan"
    )


class AutomationStep(Base):
    __tablename__ = "automation_steps"

    id: Mapped[int] = mapped_column(primary_key=True)
    automation_id: Mapped[int] = mapped_column(ForeignKey("automations.id"), index=True)
    position: Mapped[int] = mapped_column(Integer, default=0)
    # send_email | add_to_campaign | wait | check_replied | create_opportunity | add_note
    kind: Mapped[str] = mapped_column(String(50))
    # JSON config: {"template_id": 1} / {"campaign_id": 2} / {"days": 3}
    # / {"on_replied": "stop"} / {"stage": "qualified"} / {"text": "..."}
    config: Mapped[str] = mapped_column(Text, default="{}")

    automation: Mapped[Automation] = relationship(back_populates="steps")


class AutomationEnrollment(Base):
    __tablename__ = "automation_enrollments"
    __table_args__ = (UniqueConstraint("automation_id", "lead_id", name="uq_automation_lead"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    automation_id: Mapped[int] = mapped_column(ForeignKey("automations.id"), index=True)
    lead_id: Mapped[int] = mapped_column(ForeignKey("leads.id"), index=True)
    # active | completed | stopped
    status: Mapped[str] = mapped_column(String(30), default="active", index=True)
    current_step: Mapped[int] = mapped_column(Integer, default=0)
    next_eligible_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True, index=True)
    enrolled_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    automation: Mapped[Automation] = relationship(back_populates="enrollments")
    lead: Mapped[Lead] = relationship()


class AutomationLog(Base):
    __tablename__ = "automation_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    automation_id: Mapped[int] = mapped_column(ForeignKey("automations.id"), index=True)
    lead_id: Mapped[int | None] = mapped_column(ForeignKey("leads.id"), nullable=True)
    # info | success | warning | error | simulated
    level: Mapped[str] = mapped_column(String(20), default="info")
    message: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)


# ── Opportunity pipeline ────────────────────────────────────────────────────

PIPELINE_STAGES = [
    "new_lead",
    "contacted",
    "replied",
    "qualified",
    "meeting_booked",
    "proposal_sent",
    "negotiation",
    "won",
    "lost",
]


class Opportunity(Base):
    __tablename__ = "opportunities"

    id: Mapped[int] = mapped_column(primary_key=True)
    lead_id: Mapped[int] = mapped_column(ForeignKey("leads.id"), unique=True, index=True)
    title: Mapped[str] = mapped_column(String(255), default="")
    stage: Mapped[str] = mapped_column(String(30), default="new_lead", index=True)
    value: Mapped[float] = mapped_column(Float, default=0.0)
    notes: Mapped[str] = mapped_column(Text, default="")
    is_sample: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, onupdate=utcnow)

    lead: Mapped[Lead] = relationship(back_populates="opportunity")


class ActivityLog(Base):
    """Cross-module activity history (shown on dashboard and opportunity detail)."""

    __tablename__ = "activity_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    # lead | campaign | automation | opportunity | engine | system
    entity_type: Mapped[str] = mapped_column(String(30), index=True)
    entity_id: Mapped[int | None] = mapped_column(Integer, nullable=True, index=True)
    lead_id: Mapped[int | None] = mapped_column(ForeignKey("leads.id"), nullable=True, index=True)
    message: Mapped[str] = mapped_column(Text, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

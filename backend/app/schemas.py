"""Pydantic request schemas (responses are serialized with plain dicts)."""

from pydantic import BaseModel, EmailStr, Field


# ── Engine ──────────────────────────────────────────────────────────────────


class EngineRunCreate(BaseModel):
    industry: str = ""
    target_customer: str = ""
    keywords: str = ""
    location: str = ""
    business_type: str = ""
    criteria: str = ""
    leads_requested: int = Field(default=10, ge=1, le=100)


# ── Leads ───────────────────────────────────────────────────────────────────


class LeadUpdate(BaseModel):
    company_name: str | None = None
    website: str | None = None
    industry: str | None = None
    location: str | None = None
    description: str | None = None
    contact_name: str | None = None
    contact_role: str | None = None
    email: str | None = None
    notes: str | None = None
    qualification_status: str | None = None
    review_status: str | None = None


class LeadIdList(BaseModel):
    lead_ids: list[int]


class InboundLeadCreate(BaseModel):
    company_name: str
    contact_name: str = ""
    email: EmailStr | None = None
    website: str = ""
    industry: str = ""
    location: str = ""
    message: str = ""
    source_detail: str = ""


class ManualLeadCreate(InboundLeadCreate):
    pass


# ── Templates ───────────────────────────────────────────────────────────────


class TemplateUpsert(BaseModel):
    name: str
    subject: str = ""
    blocks: list[dict] = []


class SendTestRequest(BaseModel):
    to_email: EmailStr


# ── Campaigns ───────────────────────────────────────────────────────────────


class CampaignStepInput(BaseModel):
    template_id: int
    delay_days: int = Field(default=0, ge=0, le=90)


class CampaignUpsert(BaseModel):
    name: str
    sender_name: str = ""
    sender_email: str = ""
    daily_limit: int = Field(default=50, ge=1, le=2000)
    send_window_start: str = "09:00"
    send_window_end: str = "17:00"
    send_days: str = "1,2,3,4,5"
    steps: list[CampaignStepInput] = []


# ── Automations ─────────────────────────────────────────────────────────────


class AutomationStepInput(BaseModel):
    kind: str
    config: dict = {}


class AutomationUpsert(BaseModel):
    name: str
    trigger: str = "manual"
    simulation_mode: bool = True
    steps: list[AutomationStepInput] = []


# ── Pipeline ────────────────────────────────────────────────────────────────


class OpportunityUpdate(BaseModel):
    title: str | None = None
    stage: str | None = None
    value: float | None = None
    notes: str | None = None


# ── Settings / onboarding ───────────────────────────────────────────────────


class SettingsUpdate(BaseModel):
    values: dict[str, str] = {}
    # Provider credentials entered in Settings → Connections; only keys present
    # in the payload are written, so untouched credentials stay as they are.
    secrets: dict[str, str] = {}


class OnboardingComplete(BaseModel):
    business_name: str
    industry: str = ""
    target_audience: str = ""
    target_location: str = ""
    primary_offer: str = ""

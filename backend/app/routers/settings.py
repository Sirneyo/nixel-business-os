"""Settings + onboarding endpoints.

Secrets (API keys, SMTP credentials) live ONLY in environment variables and
are reported here as configured/not-configured — never echoed back.
App-level preferences (business profile, webhook key override) are stored in
the settings table.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..config import get_settings
from ..db import get_db
from ..models import Setting
from ..schemas import OnboardingComplete, SettingsUpdate

router = APIRouter(prefix="/api/settings", tags=["settings"])

PROFILE_KEYS = [
    "profile.business_name",
    "profile.industry",
    "profile.target_audience",
    "profile.target_location",
    "profile.primary_offer",
    "profile.email_provider",
    "profile.ai_provider",
]

EDITABLE_KEYS = PROFILE_KEYS + ["inbound_webhook_key", "onboarding_completed"]


def get_value(db: Session, key: str, default: str = "") -> str:
    row = db.query(Setting).filter(Setting.key == key).first()
    return row.value if row else default


def set_value(db: Session, key: str, value: str) -> None:
    row = db.query(Setting).filter(Setting.key == key).first()
    if row is None:
        db.add(Setting(key=key, value=value))
    else:
        row.value = value


@router.get("")
def read_settings(db: Session = Depends(get_db)):
    s = get_settings()
    return {
        "values": {key: get_value(db, key) for key in EDITABLE_KEYS},
        "providers": {
            "demo_mode": s.demo_mode,
            "ai": {"configured": s.ai_configured, "name": "Anthropic (Claude)" if s.ai_configured else "Built-in heuristic scorer"},
            "lead_search": {"configured": s.search_configured, "name": "Google Places" if s.search_configured else "Demo search"},
            "email_verify": {"configured": s.email_verify_mode == "builtin", "name": "Built-in (syntax + MX)" if s.email_verify_mode == "builtin" else "Demo"},
            "email_sender": {"configured": s.smtp_configured, "name": f"SMTP ({s.smtp_host})" if s.smtp_configured else "Demo sender (simulated)"},
            "inbound_webhook": {"configured": bool(s.inbound_webhook_key or get_value(db, "inbound_webhook_key"))},
        },
        "public_base_url": s.public_base_url,
    }


@router.put("")
def update_settings(payload: SettingsUpdate, db: Session = Depends(get_db)):
    for key, value in payload.values.items():
        if key in EDITABLE_KEYS:
            set_value(db, key, value)
    db.commit()
    return {"ok": True}


@router.get("/onboarding")
def onboarding_status(db: Session = Depends(get_db)):
    return {"completed": get_value(db, "onboarding_completed") == "true"}


@router.post("/onboarding")
def complete_onboarding(payload: OnboardingComplete, db: Session = Depends(get_db)):
    set_value(db, "profile.business_name", payload.business_name)
    set_value(db, "profile.industry", payload.industry)
    set_value(db, "profile.target_audience", payload.target_audience)
    set_value(db, "profile.target_location", payload.target_location)
    set_value(db, "profile.primary_offer", payload.primary_offer)
    set_value(db, "profile.email_provider", payload.email_provider)
    set_value(db, "profile.ai_provider", payload.ai_provider)
    set_value(db, "onboarding_completed", "true")
    db.commit()

    # Rebuild the sample workspace around the user's own market.
    from ..seed import reseed_samples

    reseed_samples(db, industry=payload.industry, location=payload.target_location, audience=payload.target_audience)
    return {"ok": True}

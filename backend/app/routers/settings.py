"""Settings + onboarding endpoints.

Provider credentials (API keys, SMTP) can be entered in Settings →
Connections. They are stored in the local database under `secret.*` keys and
are never echoed back to the browser — the API only reports whether each one
is configured. Environment variables remain a supported fallback.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ..config import get_settings
from ..db import get_db
from ..models import Setting
from ..providers import CREDENTIAL_KEYS, ai_configured, credential, search_configured, smtp_configured
from ..schemas import OnboardingComplete, SettingsUpdate

router = APIRouter(prefix="/api/settings", tags=["settings"])

PROFILE_KEYS = [
    "profile.business_name",
    "profile.industry",
    "profile.target_audience",
    "profile.target_location",
    "profile.primary_offer",
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
    smtp_ok = smtp_configured(db)
    return {
        "values": {key: get_value(db, key) for key in EDITABLE_KEYS},
        "providers": {
            "ai": {
                "configured": ai_configured(db),
                "name": "Claude (Anthropic)" if ai_configured(db) else "Built-in scorer — add a Claude API key for AI scoring",
            },
            "lead_search": {
                "configured": search_configured(db),
                "name": "Google Places" if search_configured(db) else "Built-in (OpenStreetMap) — connect Google Places for stronger results",
            },
            "email_verify": {"configured": True, "name": "Built-in (syntax + MX)"},
            "email_sender": {
                "configured": smtp_ok,
                "name": f"SMTP ({credential('smtp_host', db)})" if smtp_ok else "Not connected",
            },
            "inbound_webhook": {"configured": bool(s.inbound_webhook_key or get_value(db, "inbound_webhook_key"))},
        },
        # Which credentials have a value (from Settings or .env) — values themselves are never returned.
        "secrets_configured": {name: bool(credential(name, db)) for name in CREDENTIAL_KEYS},
        "public_base_url": s.public_base_url,
    }


@router.put("")
def update_settings(payload: SettingsUpdate, db: Session = Depends(get_db)):
    for key, value in payload.values.items():
        if key in EDITABLE_KEYS:
            set_value(db, key, value)
    for name, value in payload.secrets.items():
        if name in CREDENTIAL_KEYS:
            set_value(db, f"secret.{name}", value.strip())
    db.commit()
    return {"ok": True}


@router.get("/onboarding")
def onboarding_status(db: Session = Depends(get_db)):
    return {"completed": get_value(db, "onboarding_completed") == "true"}


@router.post("/onboarding")
def complete_onboarding(payload: OnboardingComplete, db: Session = Depends(get_db)):
    set_value(db, "profile.business_name", payload.business_name)
    set_value(db, "profile.industry", payload.industry)
    set_value(db, "profile.primary_offer", payload.primary_offer)
    if payload.target_audience:
        set_value(db, "profile.target_audience", payload.target_audience)
    if payload.target_location:
        set_value(db, "profile.target_location", payload.target_location)
    set_value(db, "onboarding_completed", "true")
    db.commit()
    return {"ok": True}

"""Provider factories.

Every capability uses its real implementation. Credentials are entered in
Settings → Connections (stored in the local database) or via environment
variables — the Settings value wins. Capabilities that need a credential
(lead search, email sending) raise/return clear guidance when it is missing,
instead of silently simulating results.
"""

from sqlalchemy.orm import Session

from ..config import get_settings
from ..db import session_scope
from ..models import Setting
from .ai import AnthropicScorer, HeuristicScorer, LeadScorer
from .email_sender import EmailSender, SendResult, SmtpEmailSender
from .email_verify import BuiltinEmailVerifier, EmailVerifier
from .lead_search import GooglePlacesSearch, LeadSearchProvider, OpenStreetMapSearch
from .website_research import LiveWebsiteResearcher, WebsiteResearcher

# Credentials editable from Settings → Connections, stored under "secret.<name>".
CREDENTIAL_KEYS = [
    "anthropic_api_key",
    "google_places_api_key",
    "smtp_host",
    "smtp_port",
    "smtp_username",
    "smtp_password",
    "smtp_from_email",
    "smtp_from_name",
]


def credential(name: str, db: Session | None = None) -> str:
    """Effective credential value: Settings → Connections first, then .env."""
    if db is not None:
        row = db.query(Setting).filter(Setting.key == f"secret.{name}").first()
        value = row.value.strip() if row else ""
    else:
        session = session_scope()
        try:
            row = session.query(Setting).filter(Setting.key == f"secret.{name}").first()
            value = row.value.strip() if row else ""
        finally:
            session.close()
    return value or str(getattr(get_settings(), name, "") or "").strip()


def ai_configured(db: Session | None = None) -> bool:
    return bool(credential("anthropic_api_key", db))


def search_configured(db: Session | None = None) -> bool:
    return bool(credential("google_places_api_key", db))


def smtp_configured(db: Session | None = None) -> bool:
    return bool(credential("smtp_host", db) and credential("smtp_from_email", db))


def get_lead_search() -> LeadSearchProvider:
    key = credential("google_places_api_key")
    if key:
        return GooglePlacesSearch(key)
    # No key yet: real (if thinner) results via the free OpenStreetMap API,
    # so the engine works out of the box.
    return OpenStreetMapSearch()


def get_website_researcher() -> WebsiteResearcher:
    return LiveWebsiteResearcher()


def get_email_verifier() -> EmailVerifier:
    return BuiltinEmailVerifier()


def get_lead_scorer() -> LeadScorer:
    key = credential("anthropic_api_key")
    if key:
        return AnthropicScorer(key, get_settings().anthropic_model)
    # The heuristic scorer is a real rule-based assessment (not simulated data);
    # adding a Claude API key upgrades scoring automatically.
    return HeuristicScorer()


class UnconfiguredEmailSender(EmailSender):
    """Fails every send with clear guidance instead of pretending to send."""

    name = "Not connected"
    is_real = False

    def send(self, *, to_email: str, subject: str, html: str, text: str) -> SendResult:
        return SendResult(
            "failed",
            "Email sending isn't connected yet. Add your SMTP details in Settings → Connections first.",
        )


def get_email_sender() -> EmailSender:
    if not smtp_configured():
        return UnconfiguredEmailSender()
    try:
        port = int(credential("smtp_port") or "587")
    except ValueError:
        port = 587
    return SmtpEmailSender(
        host=credential("smtp_host"),
        port=port,
        username=credential("smtp_username"),
        password=credential("smtp_password"),
        from_email=credential("smtp_from_email"),
        from_name=credential("smtp_from_name"),
    )

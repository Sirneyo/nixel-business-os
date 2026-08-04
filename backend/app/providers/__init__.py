"""Provider factories.

Each external capability (search, research, verification, AI scoring, email
sending) has a small interface with at least two implementations: a demo
provider that simulates realistic results, and a real provider driven by
environment variables. `DEMO_MODE=true` forces demo providers everywhere.
"""

from ..config import get_settings
from .ai import AnthropicScorer, HeuristicScorer, LeadScorer
from .email_sender import DemoEmailSender, EmailSender, SmtpEmailSender
from .email_verify import BuiltinEmailVerifier, DemoEmailVerifier, EmailVerifier
from .lead_search import DemoLeadSearch, GooglePlacesSearch, LeadSearchProvider
from .website_research import DemoWebsiteResearcher, LiveWebsiteResearcher, WebsiteResearcher


def get_lead_search() -> LeadSearchProvider:
    s = get_settings()
    if not s.demo_mode and s.search_configured:
        return GooglePlacesSearch(s.google_places_api_key)
    return DemoLeadSearch()


def get_website_researcher() -> WebsiteResearcher:
    s = get_settings()
    if not s.demo_mode:
        return LiveWebsiteResearcher()
    return DemoWebsiteResearcher()


def get_email_verifier() -> EmailVerifier:
    s = get_settings()
    if s.demo_mode or s.email_verify_mode == "demo":
        return DemoEmailVerifier()
    return BuiltinEmailVerifier()


def get_lead_scorer() -> LeadScorer:
    s = get_settings()
    if not s.demo_mode and s.ai_configured:
        return AnthropicScorer(s.anthropic_api_key, s.anthropic_model)
    return HeuristicScorer()


def get_email_sender() -> EmailSender:
    s = get_settings()
    if not s.demo_mode and s.smtp_configured:
        return SmtpEmailSender(
            host=s.smtp_host,
            port=s.smtp_port,
            username=s.smtp_username,
            password=s.smtp_password,
            from_email=s.smtp_from_email,
            from_name=s.smtp_from_name,
        )
    return DemoEmailSender()

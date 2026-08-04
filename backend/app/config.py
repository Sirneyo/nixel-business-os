"""Application configuration.

All external connections are driven by environment variables (see
`.env.example`). Nothing is hardcoded; with no configuration at all the app
runs entirely in demo mode with simulated providers.
"""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Core
    database_url: str = "sqlite:///./nixel_starter.db"
    public_base_url: str = "http://localhost:8000"
    cors_origins: str = "http://localhost:5173"
    demo_mode: bool = True

    # Security
    inbound_webhook_key: str = ""

    # AI provider
    anthropic_api_key: str = ""
    anthropic_model: str = "claude-sonnet-5"

    # Lead search
    lead_search_provider: str = ""
    google_places_api_key: str = ""

    # Email verification: "builtin" (syntax + MX) or "demo" (simulated)
    email_verify_mode: str = "builtin"

    # Email sending
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password: str = ""
    smtp_from_email: str = ""
    smtp_from_name: str = ""

    # Scheduler
    scheduler_interval_seconds: int = 30

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def smtp_configured(self) -> bool:
        return bool(self.smtp_host and self.smtp_from_email)

    @property
    def ai_configured(self) -> bool:
        return bool(self.anthropic_api_key)

    @property
    def search_configured(self) -> bool:
        return self.lead_search_provider == "google_places" and bool(self.google_places_api_key)


@lru_cache
def get_settings() -> Settings:
    return Settings()

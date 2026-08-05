"""Application configuration.

Provider credentials can be entered in Settings → Connections (stored in the
database) or supplied here via environment variables (see `.env.example`).
The Settings value wins — see `app/providers/credential()`.
"""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    # Core
    database_url: str = "sqlite:///./nixel_starter.db"
    public_base_url: str = "http://localhost:8000"
    cors_origins: str = "http://localhost:5173"

    # Security
    inbound_webhook_key: str = ""

    # AI provider
    anthropic_api_key: str = ""
    anthropic_model: str = "claude-sonnet-5"

    # Lead search
    google_places_api_key: str = ""

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


@lru_cache
def get_settings() -> Settings:
    return Settings()

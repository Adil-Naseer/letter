from functools import lru_cache
from pathlib import Path
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Smart Study Platform"
    api_prefix: str = "/api"
    secret_key: str = "change-me-in-env"
    access_token_expire_minutes: int = 60 * 24
    database_url: str = "sqlite:///./storage/app.db"
    storage_dir: Path = Path("./storage")
    ai_provider: str = "demo"  # demo|openai|ollama
    openai_api_key: str | None = None
    ollama_base_url: str = "http://localhost:11434"
    max_upload_mb: int = 25
    demo_mode_label: str = "DEMO MODE (deterministic generation)"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


@lru_cache
def get_settings() -> Settings:
    settings = Settings()
    settings.storage_dir.mkdir(parents=True, exist_ok=True)
    return settings

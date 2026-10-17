
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # PostgreSQL connection URL
    DATABASE_URL: str

    # SerpApi key (legacy fallback)
    SERPAPI_API_KEY: str = ""

    # Serper.dev configuration (primary search provider)
    SERPER_API_KEY: str = ""
    SERPER_BASE_URL: str = "https://google.serper.dev"

    model_config = SettingsConfigDict(
        env_file=(".env", "backend/.env", "../.env"),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )


# Create one reusable settings instance
settings = Settings()

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # PostgreSQL connection URL
    DATABASE_URL: str

    # SerpApi key (legacy fallback)
    SERPAPI_API_KEY: str = ""

    # Serper.dev configuration (primary search provider)
    SERPER_API_KEY: str = ""
    SERPER_BASE_URL: str = "https://google.serper.dev"

    # Application environment
    APP_ENV: str = "development"

    # Authentication & JWT
    JWT_SECRET_KEY: str = "sitech-series-lead-intel-jwt-secret-key-change-in-prod-2026"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # 24 hours

    # Demo user
    DEMO_USER_EMAIL: str = "nameismohan123@gmail.com"
    DEMO_USER_NAME: str = "Mohan"

    # SMTP / Email Provider settings (with support for legacy & standard env variable aliases)
    SMTP_HOST: str = Field(
        default="",
        validation_alias=AliasChoices("SMTP_HOST", "MAIL_HOST", "EMAIL_HOST"),
    )
    SMTP_PORT: int = Field(
        default=587,
        validation_alias=AliasChoices("SMTP_PORT", "MAIL_PORT", "EMAIL_PORT"),
    )
    SMTP_USER: str = Field(
        default="",
        validation_alias=AliasChoices("SMTP_USER", "SMTP_USERNAME", "MAIL_USERNAME", "EMAIL_USER"),
    )
    SMTP_PASSWORD: str = Field(
        default="",
        validation_alias=AliasChoices("SMTP_PASSWORD", "MAIL_PASSWORD", "EMAIL_PASSWORD"),
    )
    SMTP_FROM_EMAIL: str = Field(
        default="",
        validation_alias=AliasChoices("SMTP_FROM_EMAIL", "EMAIL_FROM", "MAIL_FROM", "SMTP_SENDER"),
    )
    SMTP_FROM_NAME: str = Field(
        default="Sitech Series Lead Generation",
        validation_alias=AliasChoices("SMTP_FROM_NAME", "EMAIL_FROM_NAME", "MAIL_FROM_NAME"),
    )
    SMTP_USE_TLS: bool = Field(
        default=True,
        validation_alias=AliasChoices("SMTP_USE_TLS", "SMTP_TLS", "MAIL_TLS"),
    )

    # Cloudinary configuration
    CLOUDINARY_CLOUD_NAME: str = ""
    CLOUDINARY_API_KEY: str = ""
    CLOUDINARY_API_SECRET: str = ""

    # Developer OTP helper (only active in development when SMTP credentials are not configured)
    ENABLE_DEV_OTP_CONSOLE: bool = True

    model_config = SettingsConfigDict(
        env_file=(".env", "backend/.env", "../.env"),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )


# Create one reusable settings instance
settings = Settings()

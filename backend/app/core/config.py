from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # PostgreSQL connection URL
    DATABASE_URL: str

    # Search providers
    SERPAPI_API_KEY: str = ""
    SERPER_API_KEY: str
    SERPER_BASE_URL: str

    # Application environment
    APP_ENV: str

    # Authentication & JWT
    JWT_SECRET_KEY: str = Field(min_length=32)
    JWT_ALGORITHM: str
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = Field(gt=0)

    # Demo user
    DEMO_USER_EMAIL: str = ""
    DEMO_USER_NAME: str = ""

    # SMTP / Email Provider settings
    SMTP_HOST: str = Field(
        default="",
        validation_alias=AliasChoices(
            "SMTP_HOST", "MAIL_HOST", "EMAIL_HOST"
        ),
    )

    SMTP_PORT: int = Field(
        default=587,
        validation_alias=AliasChoices(
            "SMTP_PORT", "MAIL_PORT", "EMAIL_PORT"
        ),
    )

    SMTP_USER: str = Field(
        default="",
        validation_alias=AliasChoices(
            "SMTP_USER",
            "SMTP_USERNAME",
            "MAIL_USERNAME",
            "EMAIL_USER",
        ),
    )

    SMTP_PASSWORD: str = Field(
        default="",
        validation_alias=AliasChoices(
            "SMTP_PASSWORD",
            "MAIL_PASSWORD",
            "EMAIL_PASSWORD",
        ),
    )

    SMTP_FROM_EMAIL: str = Field(
        default="",
        validation_alias=AliasChoices(
            "SMTP_FROM_EMAIL",
            "EMAIL_FROM",
            "MAIL_FROM",
            "SMTP_SENDER",
        ),
    )

    SMTP_FROM_NAME: str = Field(
        default="",
        validation_alias=AliasChoices(
            "SMTP_FROM_NAME",
            "EMAIL_FROM_NAME",
            "MAIL_FROM_NAME",
        ),
    )

    SMTP_USE_TLS: bool = Field(
        default=True,
        validation_alias=AliasChoices(
            "SMTP_USE_TLS", "SMTP_TLS", "MAIL_TLS"
        ),
    )

    # Cloudinary configuration
    CLOUDINARY_CLOUD_NAME: str = ""
    CLOUDINARY_API_KEY: str = ""
    CLOUDINARY_API_SECRET: str = ""

    # Development-only OTP helper
    ENABLE_DEV_OTP_CONSOLE: bool = False

    model_config = SettingsConfigDict(
        env_file=(".env", "backend/.env", "../.env"),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )


# Create one reusable settings instance
settings = Settings()
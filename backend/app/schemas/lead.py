
from datetime import datetime

from pydantic import (
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    field_validator,
)


class LeadCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    email: EmailStr

    phone_number: str | None = Field(default=None, max_length=32)
    profession: str | None = Field(default=None, max_length=255)
    university: str | None = Field(default=None, max_length=255)
    country: str | None = Field(default=None, max_length=100)

    website: str | None = None
    linkedin_url: str | None = None
    source_url: str | None = None
    source_title: str | None = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        value = value.strip()

        if not value:
            raise ValueError("Lead name cannot be empty.")

        return value


class LeadResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: EmailStr

    phone_number: str | None = None
    profession: str | None = None
    university: str | None = None
    country: str | None = None

    website: str | None = None
    linkedin_url: str | None = None
    source_url: str | None = None
    source_title: str | None = None

    created_at: datetime
    updated_at: datetime

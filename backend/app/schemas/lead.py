
from datetime import datetime
from typing import Any, Literal

from pydantic import (
    BaseModel,
    ConfigDict,
    EmailStr,
    Field,
    field_validator,
)

LeadStatus = Literal[
    "qualified",
    "needs_review",
    "rejected",
    "extracted",
    "duplicate",
    "failed",
]


class LeadCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255)
    email: EmailStr | None = None

    phone_number: str | None = Field(default=None, max_length=32)
    profession: str | None = Field(default=None, max_length=255)
    department: str | None = Field(default=None, max_length=255)
    research_specialization: str | None = None
    university: str | None = Field(default=None, max_length=255)
    country: str | None = Field(default=None, max_length=100)

    website: str | None = None
    linkedin_url: str | None = None
    source_url: str | None = None
    source_title: str | None = None

    qualification_status: str = "qualified"
    confidence_score: float | None = None
    qualification_reason: str | None = None
    evidence: dict[str, Any] | None = None
    search_job_id: int | None = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError("Lead name cannot be empty.")
        return value


class LeadUpdate(BaseModel):
    name: str | None = None
    email: EmailStr | None = None
    phone_number: str | None = None
    profession: str | None = None
    department: str | None = None
    research_specialization: str | None = None
    university: str | None = None
    country: str | None = None
    website: str | None = None
    linkedin_url: str | None = None
    qualification_status: str | None = None
    qualification_reason: str | None = None


class LeadResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    email: EmailStr | None = None

    phone_number: str | None = None
    profession: str | None = None
    department: str | None = None
    research_specialization: str | None = None
    university: str | None = None
    country: str | None = None

    website: str | None = None
    linkedin_url: str | None = None
    source_url: str | None = None
    source_title: str | None = None

    qualification_status: str = "qualified"
    confidence_score: float | None = None
    qualification_reason: str | None = None
    evidence: dict[str, Any] | None = None
    search_job_id: int | None = None

    created_at: datetime
    updated_at: datetime


class PaginatedLeadsResponse(BaseModel):
    total: int
    page: int
    page_size: int
    total_pages: int
    items: list[LeadResponse]

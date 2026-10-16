
from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


JobStatus = Literal[
    "pending",
    "running",
    "completed",
    "stopped",
    "failed",
]


class SearchJobCreate(BaseModel):
    search_name: str | None = Field(default=None, max_length=255)

    keywords: str = Field(min_length=1)

    search_criteria: dict | None = None

    target_leads: int = Field(gt=0)

    max_serpapi_requests: int = Field(gt=0)


class SearchJobResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    search_name: str | None
    keywords: str
    search_criteria: dict | None

    target_leads: int
    max_serpapi_requests: int
    serpapi_requests_used: int
    qualified_leads_found: int

    status: JobStatus
    error_message: str | None

    created_at: datetime
    started_at: datetime | None
    completed_at: datetime | None


from datetime import datetime
from typing import Any, Literal

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
    search_criteria: dict[str, Any] | None = None
    target_leads: int = Field(gt=0)
    max_serpapi_requests: int = Field(gt=0)


class SearchJobResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    search_name: str | None
    keywords: str
    search_criteria: dict[str, Any] | None

    target_leads: int
    max_serpapi_requests: int
    serpapi_requests_used: int
    qualified_leads_found: int

    status: JobStatus
    error_message: str | None

    created_at: datetime
    started_at: datetime | None
    completed_at: datetime | None


class SearchJobDetailResponse(SearchJobResponse):
    results_count: int = 0
    pending_results_count: int = 0
    processed_results_count: int = 0
    skipped_results_count: int = 0
    failed_results_count: int = 0
    remaining_requests: int = 0
    progress_percentage: float = 0.0


class PaginatedSearchJobsResponse(BaseModel):
    total: int
    page: int
    page_size: int
    total_pages: int
    items: list[SearchJobResponse]

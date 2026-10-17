
from datetime import datetime
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


ResultStatus = Literal[
    "pending",
    "processed",
    "skipped",
    "failed",
]


class SearchResultCreate(BaseModel):
    search_job_id: int = Field(gt=0)
    result_url: str = Field(min_length=1)
    result_title: str | None = None
    result_snippet: str | None = None


class SearchResultResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    search_job_id: int

    result_url: str
    result_title: str | None
    result_snippet: str | None

    status: ResultStatus
    lead_id: int | None
    error_message: str | None
    retry_count: int = 0
    candidate_data: dict[str, Any] | None = None

    processed_at: datetime | None
    created_at: datetime


class PaginatedSearchResultsResponse(BaseModel):
    total: int
    page: int
    page_size: int
    total_pages: int
    items: list[SearchResultResponse]

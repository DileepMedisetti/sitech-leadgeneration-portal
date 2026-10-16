
from datetime import datetime, timezone

from sqlalchemy.orm import Session

from app.models.search_result import SearchResult
from app.repositories.search_result_repository import (
    create_search_result,
    get_search_result_by_url,
)


def record_search_result(
    db: Session,
    search_job_id: int,
    result_url: str,
    result_title: str | None = None,
    result_snippet: str | None = None,
) -> tuple[SearchResult, bool]:
    """
    Record a discovered URL for a search job.

    Returns:
        (result, created)
        created=True if a new result was added.
        created=False if the URL already exists for this job.
    """
    normalized_url = result_url.strip()

    if not normalized_url:
        raise ValueError("Result URL cannot be empty.")

    existing_result = get_search_result_by_url(
        db=db,
        search_job_id=search_job_id,
        result_url=normalized_url,
    )

    if existing_result:
        return existing_result, False

    result_data = {
        "search_job_id": search_job_id,
        "result_url": normalized_url,
        "result_title": result_title,
        "result_snippet": result_snippet,
        "status": "pending",
    }

    search_result = create_search_result(
        db=db,
        result_data=result_data,
    )

    return search_result, True


def mark_result_processed(
    result: SearchResult,
    lead_id: int | None = None,
) -> None:
    """Mark a result as processed and optionally link its lead."""
    result.status = "processed"
    result.lead_id = lead_id
    result.processed_at = datetime.now(timezone.utc)
    result.error_message = None


def mark_result_skipped(
    result: SearchResult,
    reason: str,
) -> None:
    """Mark a result as skipped with an explanation."""
    result.status = "skipped"
    result.error_message = reason
    result.processed_at = datetime.now(timezone.utc)


def mark_result_failed(
    result: SearchResult,
    reason: str,
) -> None:
    """Mark a result as failed with an explanation."""
    result.status = "failed"
    result.error_message = reason
    result.processed_at = datetime.now(timezone.utc)

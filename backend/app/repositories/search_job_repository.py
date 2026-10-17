
import math
from datetime import datetime, timezone
from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session

from app.models.search_job import SearchJob


def create_search_job(
    db: Session,
    job_data: dict,
) -> SearchJob:
    """Create a new search job in the current database session."""
    search_job = SearchJob(**job_data)
    db.add(search_job)
    return search_job


def get_search_job_by_id(
    db: Session,
    job_id: int,
) -> SearchJob | None:
    """Retrieve a search job by its database ID."""
    statement = select(SearchJob).where(SearchJob.id == job_id)
    return db.scalar(statement)


def get_search_jobs(
    db: Session,
    limit: int = 20,
    offset: int = 0,
) -> list[SearchJob]:
    """Retrieve search jobs with basic pagination."""
    statement = (
        select(SearchJob)
        .order_by(SearchJob.created_at.desc(), SearchJob.id.desc())
        .offset(offset)
        .limit(limit)
    )
    return list(db.scalars(statement).all())


def get_search_jobs_paginated(
    db: Session,
    page: int = 1,
    page_size: int = 10,
    status: str | None = None,
) -> tuple[list[SearchJob], int, int]:
    """Retrieve search jobs with page metadata and status filtering."""
    query = select(SearchJob)
    if status and status.strip():
        query = query.where(SearchJob.status == status.strip())

    count_query = select(func.count()).select_from(query.subquery())
    total_count = db.scalar(count_query) or 0

    total_pages = max(1, math.ceil(total_count / page_size)) if page_size > 0 else 1
    offset = (page - 1) * page_size

    paged_query = (
        query.order_by(desc(SearchJob.created_at), desc(SearchJob.id))
        .offset(offset)
        .limit(page_size)
    )
    items = list(db.scalars(paged_query).all())

    return items, total_count, total_pages


def stop_job(db: Session, job_id: int) -> SearchJob | None:
    """Mark a job as stopped."""
    job = get_search_job_by_id(db, job_id)
    if not job or job.status not in {"pending", "running"}:
        return job
    job.status = "stopped"
    job.completed_at = datetime.now(timezone.utc)
    return job


def resume_job(db: Session, job_id: int) -> SearchJob | None:
    """Resume a stopped or failed job if budget and target allow."""
    job = get_search_job_by_id(db, job_id)
    if not job:
        return None
    if job.status not in {"stopped", "failed"}:
        raise ValueError(f"Job with status '{job.status}' cannot be resumed.")
    if job.qualified_leads_found >= job.target_leads:
        raise ValueError("Cannot resume: lead target already achieved.")
    if job.serpapi_requests_used >= job.max_serpapi_requests:
        raise ValueError("Cannot resume: SerpApi request budget exhausted.")
    job.status = "running"
    job.error_message = None
    return job

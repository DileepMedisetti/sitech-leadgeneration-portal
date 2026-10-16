
from sqlalchemy import select
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

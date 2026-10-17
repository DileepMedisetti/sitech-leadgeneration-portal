
import math
from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session

from app.models.search_result import SearchResult


def create_search_result(
    db: Session,
    result_data: dict,
) -> SearchResult:
    """Add a discovered search result to the current session."""
    search_result = SearchResult(**result_data)
    db.add(search_result)
    return search_result


def get_search_result_by_id(
    db: Session,
    result_id: int,
) -> SearchResult | None:
    """Retrieve a search result by its ID."""
    statement = select(SearchResult).where(
        SearchResult.id == result_id
    )
    return db.scalar(statement)


def get_search_result_by_url(
    db: Session,
    search_job_id: int,
    result_url: str,
) -> SearchResult | None:
    """Find a URL already recorded for a particular search job."""
    statement = select(SearchResult).where(
        SearchResult.search_job_id == search_job_id,
        SearchResult.result_url == result_url,
    )
    return db.scalar(statement)


def get_pending_search_results(
    db: Session,
    search_job_id: int,
    limit: int = 50,
) -> list[SearchResult]:
    """Retrieve pending results for resumable processing."""
    statement = (
        select(SearchResult)
        .where(
            SearchResult.search_job_id == search_job_id,
            SearchResult.status == "pending",
        )
        .order_by(SearchResult.id.asc())
        .limit(limit)
    )
    return list(db.scalars(statement).all())


def get_search_results_paginated(
    db: Session,
    search_job_id: int | None = None,
    page: int = 1,
    page_size: int = 20,
    status: str | None = None,
) -> tuple[list[SearchResult], int, int]:
    """Retrieve search results with pagination and filtering."""
    query = select(SearchResult)

    if search_job_id is not None:
        query = query.where(SearchResult.search_job_id == search_job_id)

    if status and status.strip():
        query = query.where(SearchResult.status == status.strip())

    count_query = select(func.count()).select_from(query.subquery())
    total_count = db.scalar(count_query) or 0

    total_pages = max(1, math.ceil(total_count / page_size)) if page_size > 0 else 1
    offset = (page - 1) * page_size

    paged_query = (
        query.order_by(desc(SearchResult.id))
        .offset(offset)
        .limit(page_size)
    )
    items = list(db.scalars(paged_query).all())

    return items, total_count, total_pages


def get_all_search_results_for_job(
    db: Session,
    search_job_id: int,
) -> list[SearchResult]:
    """Retrieve all search results for a specific job, ordered by id."""
    statement = (
        select(SearchResult)
        .where(SearchResult.search_job_id == search_job_id)
        .order_by(SearchResult.id.asc())
    )
    return list(db.scalars(statement).all())


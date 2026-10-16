
from sqlalchemy import select
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

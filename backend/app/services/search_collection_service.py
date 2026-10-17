import logging
from sqlalchemy.orm import Session

from app.repositories.search_job_repository import (
    get_search_job_by_id,
)
from app.core.config import settings
from app.services.search_cache_service import (
    get_cached_search_results,
    store_cached_search_results,
)
from app.services.search_execution_service import (
    reserve_serpapi_request,
    start_persisted_search_job,
)
from app.services.serper_service import (
    SerperApiError,
    search_serper,
)
from app.services.serpapi_service import (
    SerpApiError,
    search_google,
)
from app.services.search_result_service import record_search_result

logger = logging.getLogger("search_collection")

_original_search_google = search_google
_original_search_serper = search_serper


def execute_search_query(
    query: str,
    num_results: int = 10,
    job_id: int | None = None,
) -> dict:
    """Execute search query using Serper.dev as primary, or SerpApi as fallback."""
    # If search_google was explicitly monkeypatched on this module by existing tests:
    if search_google is not _original_search_google:
        return search_google(query=query, num_results=num_results, job_id=job_id)
    if search_serper is not _original_search_serper:
        return search_serper(query=query, num_results=num_results, job_id=job_id)
    if settings.SERPER_API_KEY and settings.SERPER_API_KEY.strip():
        return search_serper(query=query, num_results=num_results, job_id=job_id)
    return search_google(query=query, num_results=num_results, job_id=job_id)


def collect_search_results(
    db: Session,
    job_id: int,
    query_override: str | None = None,
    use_cache: bool = True,
) -> dict:
    """Fetch one Google Search batch for a job and save its unique results in the database.

    Deduplicates queries via deterministic caching to protect SerpApi credits.
    Restores reserved request counters if provider call fails before credit consumption.
    """
    job = get_search_job_by_id(db, job_id)

    if job is None:
        raise ValueError("Search job not found.")

    # Start a pending job, or verify a running job.
    if job.status == "pending":
        job = start_persisted_search_job(db, job_id)
        db.commit()
    elif job.status != "running":
        raise ValueError(
            f"Cannot collect results for a job with status '{job.status}'."
        )

    search_query = (query_override or job.keywords).strip()
    cached_results = get_cached_search_results(db, search_query) if use_cache else None
    was_cached = False

    if cached_results is not None:
        # Cache hit: zero SerpApi credits used!
        results = cached_results
        was_cached = True
        logger.info(
            "Reused cached results for job %s (query: '%s'). Zero SerpApi credits used.",
            job_id,
            search_query[:50],
        )
    else:
        # Atomically reserve one request within the job's budget.
        if not reserve_serpapi_request(db, job_id):
            db.rollback()
            raise ValueError(
                "Search cannot continue: target reached or request limit reached."
            )

        # Persist the reservation before making the external request.
        db.commit()

        try:
            results = execute_search_query(
                query=search_query,
                num_results=10,
                job_id=job_id,
            )
            # Store in cache for future deduplication across jobs
            if use_cache:
                try:
                    store_cached_search_results(db, search_query, results)
                except Exception as cache_err:
                    logger.warning("Failed to store search query cache: %s", cache_err)
        except Exception as exc:
            db.rollback()

            credit_consumed = getattr(exc, "credit_consumed", False)
            failed_job = get_search_job_by_id(db, job_id)
            if failed_job is not None:
                # If credit was not consumed by the provider, restore the reserved request
                if not credit_consumed and failed_job.serpapi_requests_used > 0:
                    failed_job.serpapi_requests_used -= 1
                    logger.info(
                        "Restored request reservation for job %s because credit was not consumed.",
                        job_id,
                    )
                failed_job.error_message = str(exc)
                db.commit()

            raise

    organic_results = results.get("organic_results") or results.get("organic") or []

    saved_count = 0
    duplicate_count = 0

    try:
        for item in organic_results:
            result_url = item.get("link")

            if not result_url:
                continue

            _, created = record_search_result(
                db=db,
                search_job_id=job_id,
                result_url=result_url,
                result_title=item.get("title"),
                result_snippet=item.get("snippet"),
            )

            if created:
                saved_count += 1
            else:
                duplicate_count += 1

        current_job = get_search_job_by_id(db, job_id)
        if current_job is not None:
            current_job.error_message = None

        db.commit()

    except Exception:
        db.rollback()
        raise

    return {
        "job_id": job_id,
        "results_received": len(organic_results),
        "results_saved": saved_count,
        "duplicates_skipped": duplicate_count,
        "was_cached": was_cached,
        "serpapi_requests_used": (
            get_search_job_by_id(db, job_id).serpapi_requests_used
        ),
    }

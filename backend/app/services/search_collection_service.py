
from sqlalchemy.orm import Session

from app.repositories.search_job_repository import (
    get_search_job_by_id,
)
from app.services.search_execution_service import (
    reserve_serpapi_request,
    start_persisted_search_job,
)
from app.services.serpapi_service import search_google
from app.services.search_result_service import record_search_result


def collect_search_results(
    db: Session,
    job_id: int,
) -> dict:
    """
    Fetch one Google Search batch for a job and save
    its unique results in the database.
    """

    job = get_search_job_by_id(db, job_id)

    if job is None:
        raise ValueError("Search job not found.")

    # Start a pending job, or resume a running job.
    if job.status == "pending":
        job = start_persisted_search_job(db, job_id)
        db.commit()
    elif job.status != "running":
        raise ValueError(
            f"Cannot collect results for a job with status '{job.status}'."
        )

    # Atomically reserve one request within the job's budget.
    if not reserve_serpapi_request(db, job_id):
        db.rollback()
        raise ValueError(
            "Search cannot continue: target reached or request limit reached."
        )

    # Persist the reservation before making the external request.
    db.commit()

    try:
        results = search_google(
            query=job.keywords,
            num_results=10,
        )
    except Exception as exc:
        # Keep the request reservation and record the error.
        db.rollback()

        failed_job = get_search_job_by_id(db, job_id)
        if failed_job is not None:
            failed_job.error_message = str(exc)
            db.commit()

        raise

    organic_results = results.get("organic_results", [])

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
        "serpapi_requests_used": (
            get_search_job_by_id(db, job_id).serpapi_requests_used
        ),
    }

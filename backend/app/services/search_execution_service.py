
from sqlalchemy.orm import Session
from app.models.search_job import SearchJob
from datetime import datetime, timezone
from sqlalchemy import update
from sqlalchemy.orm import Session
from app.models.search_job import SearchJob
from app.repositories.search_job_repository import get_search_job_by_id



def can_continue_search(job: SearchJob) -> bool:
    """Return whether a search job is allowed to continue."""
    if job.status not in {"pending", "running"}:
        return False

    if job.qualified_leads_found >= job.target_leads:
        return False

    if job.serpapi_requests_used >= job.max_serpapi_requests:
        return False

    return True


def start_search_job(job: SearchJob) -> None:
    """Mark an eligible search job as running."""
    if job.status != "pending":
        raise ValueError("Only pending search jobs can be started.")

    job.status = "running"

    if job.started_at is None:
        from datetime import datetime, timezone
        job.started_at = datetime.now(timezone.utc)


def record_serpapi_request(job: SearchJob) -> None:
    """Record an attempted request without exceeding the configured budget."""
    if not can_continue_search(job):
        raise ValueError("Search job cannot continue.")

    job.serpapi_requests_used += 1


def record_qualified_lead(job: SearchJob) -> None:
    """Increment the count when a qualified lead is accepted."""
    if job.qualified_leads_found >= job.target_leads:
        raise ValueError("Search target has already been reached.")

    job.qualified_leads_found += 1


def complete_search_job(job: SearchJob) -> None:
    """Mark a running job as completed."""
    if job.status != "running":
        raise ValueError("Only running search jobs can be completed.")

    job.status = "completed"

    from datetime import datetime, timezone
    job.completed_at = datetime.now(timezone.utc)


def stop_search_job(job: SearchJob) -> None:
    """Stop a job when its target or request budget is reached."""
    if job.status not in {"pending", "running"}:
        return

    job.status = "stopped"

    from datetime import datetime, timezone
    job.completed_at = datetime.now(timezone.utc)



def start_persisted_search_job(
    db: Session,
    job_id: int,
) -> SearchJob:
    """Atomically start a pending search job."""
    statement = (
        update(SearchJob)
        .where(
            SearchJob.id == job_id,
            SearchJob.status == "pending",
        )
        .values(
            status="running",
            started_at=datetime.now(timezone.utc),
        )
        .returning(SearchJob.id)
    )

    started_id = db.scalar(statement)

    if started_id is None:
        raise ValueError(
            "Search job does not exist or cannot be started."
        )

    db.flush()

    job = get_search_job_by_id(db, job_id)

    if job is None:
        raise ValueError("Search job could not be loaded.")

    return job


def reserve_serpapi_request(
    db: Session,
    job_id: int,
) -> bool:
    """Reserve a request without exceeding the job's limits."""
    statement = (
        update(SearchJob)
        .where(
            SearchJob.id == job_id,
            SearchJob.status == "running",
            SearchJob.serpapi_requests_used
            < SearchJob.max_serpapi_requests,
            SearchJob.qualified_leads_found
            < SearchJob.target_leads,
        )
        .values(
            serpapi_requests_used=(
                SearchJob.serpapi_requests_used + 1
            ),
        )
        .returning(SearchJob.id)
    )

    reserved_id = db.scalar(statement)
    db.flush()

    return reserved_id is not None


from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.search_job import SearchJob
from app.models.search_result import SearchResult
from app.repositories.search_job_repository import (
    create_search_job,
    get_search_job_by_id,
    get_search_jobs_paginated,
    resume_job,
    stop_job,
)
from app.schemas.search_job import SearchJobCreate, SearchJobDetailResponse


def create_job(
    db: Session,
    job_data: SearchJobCreate,
) -> SearchJob:
    """Validate and prepare a search job for persistence."""
    validated_data = job_data.model_dump()

    validated_data["keywords"] = validated_data["keywords"].strip()

    if not validated_data["keywords"]:
        raise ValueError("Search keywords cannot be empty.")

    if validated_data["target_leads"] <= 0:
        raise ValueError("Target leads must be greater than zero.")

    if validated_data["max_serpapi_requests"] <= 0:
        raise ValueError("SerpApi request limit must be greater than zero.")

    return create_search_job(
        db=db,
        job_data=validated_data,
    )


def list_jobs(
    db: Session,
    page: int = 1,
    page_size: int = 10,
    status: str | None = None,
) -> tuple[list[SearchJob], int, int]:
    """Retrieve search jobs with pagination and optional status filter."""
    return get_search_jobs_paginated(
        db=db,
        page=page,
        page_size=page_size,
        status=status,
    )


def get_job_detail(db: Session, job_id: int) -> dict | None:
    """Get full job details including sub-counts and progress metrics."""
    job = get_search_job_by_id(db, job_id)
    if not job:
        return None

    # Count search results breakdown
    total_results = db.scalar(
        select(func.count(SearchResult.id)).where(SearchResult.search_job_id == job_id)
    ) or 0

    pending_results = db.scalar(
        select(func.count(SearchResult.id)).where(
            SearchResult.search_job_id == job_id,
            SearchResult.status == "pending",
        )
    ) or 0

    processed_results = db.scalar(
        select(func.count(SearchResult.id)).where(
            SearchResult.search_job_id == job_id,
            SearchResult.status == "processed",
        )
    ) or 0

    skipped_results = db.scalar(
        select(func.count(SearchResult.id)).where(
            SearchResult.search_job_id == job_id,
            SearchResult.status == "skipped",
        )
    ) or 0

    failed_results = db.scalar(
        select(func.count(SearchResult.id)).where(
            SearchResult.search_job_id == job_id,
            SearchResult.status == "failed",
        )
    ) or 0

    remaining_requests = max(0, job.max_serpapi_requests - job.serpapi_requests_used)
    progress = (
        min(100.0, round((job.qualified_leads_found / job.target_leads) * 100, 1))
        if job.target_leads > 0
        else 0.0
    )

    return {
        "id": job.id,
        "search_name": job.search_name,
        "keywords": job.keywords,
        "search_criteria": job.search_criteria,
        "target_leads": job.target_leads,
        "max_serpapi_requests": job.max_serpapi_requests,
        "serpapi_requests_used": job.serpapi_requests_used,
        "qualified_leads_found": job.qualified_leads_found,
        "status": job.status,
        "error_message": job.error_message,
        "created_at": job.created_at,
        "started_at": job.started_at,
        "completed_at": job.completed_at,
        "results_count": total_results,
        "pending_results_count": pending_results,
        "processed_results_count": processed_results,
        "skipped_results_count": skipped_results,
        "failed_results_count": failed_results,
        "remaining_requests": remaining_requests,
        "progress_percentage": progress,
    }


from app.services.search_execution_service import start_persisted_search_job


def start_search_job_execution(db: Session, job_id: int) -> SearchJob:
    """Start an eligible pending search job."""
    job = get_search_job_by_id(db, job_id)
    if not job:
        raise ValueError("Search job not found.")
    if job.status == "running":
        raise ValueError("Job is already running.")
    if job.status in {"stopped", "failed"}:
        raise ValueError("Job is stopped. Use resume endpoint instead.")
    if job.status == "completed":
        raise ValueError("Completed job cannot be started.")
    if job.status != "pending":
        raise ValueError(f"Job with status '{job.status}' cannot be started.")

    job = start_persisted_search_job(db, job_id)
    db.commit()
    db.refresh(job)
    return job


def stop_search_job_execution(db: Session, job_id: int) -> SearchJob:
    """Stop a running or pending search job."""
    job = stop_job(db, job_id)
    if not job:
        raise ValueError("Search job not found.")
    db.commit()
    db.refresh(job)
    return job


def resume_search_job_execution(db: Session, job_id: int) -> SearchJob:
    """Resume an eligible stopped or failed search job."""
    job = get_search_job_by_id(db, job_id)
    if not job:
        raise ValueError("Search job not found.")
    if job.status == "pending":
        raise ValueError(
            "Job with status 'pending' cannot be resumed. Use the start action to begin execution."
        )
    if job.status == "running":
        raise ValueError("Job is already running.")
    if job.status == "completed":
        raise ValueError("Completed job cannot be resumed.")

    job = resume_job(db, job_id)
    db.commit()
    db.refresh(job)
    return job


def run_automated_search_job(
    db: Session,
    job_id: int,
    max_extraction_batches: int = 5,
) -> dict:
    """Execute the complete end-to-end automated workflow for a search job:
    1. Validate and start job
    2. Plan high-yield queries based on criteria
    3. Query Serper.dev API (or cache)
    4. Store unique search results
    5. Extract, validate, and qualify real academic persons
    6. Stop early when target is reached or credit budget exhausted
    7. Mark completed when finished
    """
    import logging
    logger = logging.getLogger("search_job_service")

    from app.services.lead_extraction_service import process_pending_results
    from app.services.query_planner import build_search_queries
    from app.services.search_collection_service import collect_search_results
    from app.services.search_execution_service import (
        can_continue_search,
        complete_search_job,
    )

    job = get_search_job_by_id(db, job_id)
    if not job:
        raise ValueError("Search job not found.")

    if job.status == "pending":
        job = start_persisted_search_job(db, job_id)
        db.commit()
        db.refresh(job)
    elif job.status != "running":
        raise ValueError(f"Cannot run job with status '{job.status}'.")

    queries = build_search_queries(job)
    queries_executed = 0
    total_results_saved = 0
    total_leads_created = 0

    for query in queries:
        if not can_continue_search(job):
            break

        try:
            col_res = collect_search_results(
                db=db,
                job_id=job_id,
                query_override=query,
                use_cache=True,
            )
            queries_executed += 1
            total_results_saved += col_res.get("results_saved", 0)
        except Exception as exc:
            logger.warning("Query collection failed during automated job %s: %s", job_id, exc)
            break

        # Extract leads from newly collected batch
        ext_res = process_pending_results(db=db, job_id=job_id, limit=20)
        total_leads_created += ext_res.get("leads_created", 0)

        db.refresh(job)
        if job.qualified_leads_found >= job.target_leads:
            break

    # Process any remaining pending results without extra search requests
    batches = 0
    while (
        job.qualified_leads_found < job.target_leads
        and batches < max_extraction_batches
    ):
        ext_res = process_pending_results(db=db, job_id=job_id, limit=20)
        if ext_res.get("results_processed", 0) == 0:
            break
        total_leads_created += ext_res.get("leads_created", 0)
        batches += 1
        db.refresh(job)

    # Check if target reached or search requests exhausted
    if (
        job.qualified_leads_found >= job.target_leads
        or job.serpapi_requests_used >= job.max_serpapi_requests
    ):
        complete_search_job(job)
        db.commit()
        db.refresh(job)

    return {
        "job_id": job.id,
        "status": job.status,
        "queries_planned": len(queries),
        "queries_executed": queries_executed,
        "results_saved": total_results_saved,
        "leads_created": total_leads_created,
        "qualified_leads_found": job.qualified_leads_found,
        "target_leads": job.target_leads,
        "search_requests_used": job.serpapi_requests_used,
        "max_search_requests": job.max_serpapi_requests,
        "completed": (job.status == "completed"),
    }

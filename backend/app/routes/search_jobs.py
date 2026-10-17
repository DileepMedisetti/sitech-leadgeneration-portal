
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.services.excel_export_service import export_search_results_to_excel
from app.repositories.search_result_repository import get_search_results_paginated
from app.schemas.lead import PaginatedLeadsResponse
from app.schemas.search_job import (
    PaginatedSearchJobsResponse,
    SearchJobCreate,
    SearchJobDetailResponse,
    SearchJobResponse,
)
from app.schemas.search_result import PaginatedSearchResultsResponse
from app.services.lead_service import fetch_leads
from app.services.search_job_service import (
    create_job,
    get_job_detail,
    list_jobs,
    resume_search_job_execution,
    run_automated_search_job,
    start_search_job_execution,
    stop_search_job_execution,
)

router = APIRouter(
    prefix="/api/search-jobs",
    tags=["Search Jobs"],
)

# Keep this name so existing tests can mock it.
create_search_job = create_job


@router.post(
    "",
    response_model=SearchJobResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_search_job_endpoint(
    job_data: SearchJobCreate,
    db: Session = Depends(get_db),
):
    try:
        job = create_search_job(db=db, job_data=job_data)
        db.commit()
        db.refresh(job)
        return job

    except ValueError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc

    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create search job.",
        ) from exc


@router.get(
    "",
    response_model=PaginatedSearchJobsResponse,
)
def list_search_jobs_endpoint(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=100),
    status: str | None = None,
    db: Session = Depends(get_db),
):
    """List search jobs with pagination and optional status filter."""
    items, total, total_pages = list_jobs(
        db=db,
        page=page,
        page_size=page_size,
        status=status,
    )
    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
        "items": items,
    }


@router.get(
    "/{job_id}",
    response_model=SearchJobDetailResponse,
)
def get_search_job_endpoint(
    job_id: int,
    db: Session = Depends(get_db),
):
    """Retrieve detailed progress, budget, and stats for a single search job."""
    detail = get_job_detail(db, job_id)
    if not detail:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Search job not found.",
        )
    return detail


@router.post(
    "/{job_id}/start",
    response_model=SearchJobResponse,
)
def start_search_job_endpoint(
    job_id: int,
    db: Session = Depends(get_db),
):
    """Start an eligible pending search job."""
    try:
        return start_search_job_execution(db, job_id)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND if "not found" in str(exc) else status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc


@router.post(
    "/{job_id}/run",
)
def run_search_job_endpoint(
    job_id: int,
    db: Session = Depends(get_db),
):
    """Execute the end-to-end automated workflow: search queries, extraction, qualification."""
    try:
        return run_automated_search_job(db, job_id)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND if "not found" in str(exc) else status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc


@router.post(
    "/{job_id}/stop",
    response_model=SearchJobResponse,
)
def stop_search_job_endpoint(
    job_id: int,
    db: Session = Depends(get_db),
):
    """Stop an active search job."""
    try:
        return stop_search_job_execution(db, job_id)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND if "not found" in str(exc) else status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc


@router.post(
    "/{job_id}/resume",
    response_model=SearchJobResponse,
)
def resume_search_job_endpoint(
    job_id: int,
    db: Session = Depends(get_db),
):
    """Resume a stopped or failed search job if budget allows."""
    try:
        return resume_search_job_execution(db, job_id)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND if "not found" in str(exc) else status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc


@router.get(
    "/{job_id}/results",
    response_model=PaginatedSearchResultsResponse,
)
def get_search_job_results_endpoint(
    job_id: int,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    status: str | None = None,
    db: Session = Depends(get_db),
):
    """Get paginated search results discovered for this job."""
    items, total, total_pages = get_search_results_paginated(
        db=db,
        search_job_id=job_id,
        page=page,
        page_size=page_size,
        status=status,
    )
    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
        "items": items,
    }


@router.get(
    "/{job_id}/results/export-xlsx",
)
def export_search_job_results_xlsx_endpoint(
    job_id: int,
    db: Session = Depends(get_db),
):
    """Download all stored search/extraction results for this job as a native Microsoft Excel (.xlsx) spreadsheet."""
    job = get_job_detail(db, job_id)
    if not job:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Search job not found.",
        )
    excel_data = export_search_results_to_excel(db=db, job_id=job_id)
    filename = f"extraction_results_job_{job_id}.xlsx"
    return Response(
        content=excel_data,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )



@router.get(
    "/{job_id}/leads",
    response_model=PaginatedLeadsResponse,
)
def get_search_job_leads_endpoint(
    job_id: int,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    status: str | None = None,
    db: Session = Depends(get_db),
):
    """Get leads associated with this specific search job."""
    items, total, total_pages = fetch_leads(
        db=db,
        page=page,
        page_size=page_size,
        status=status,
        job_id=job_id,
    )
    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
        "items": items,
    }


from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.services.lead_extraction_service import (
    process_pending_results,
    requeue_retryable_failed_results,
)

router = APIRouter(
    prefix="/api/search-jobs",
    tags=["Lead Extraction"],
)


@router.post("/{job_id}/extract-leads")
def extract_leads_endpoint(
    job_id: int,
    limit: int = 10,
    db: Session = Depends(get_db),
):
    """Extract qualified leads from pending stored search results."""

    try:
        return process_pending_results(
            db=db,
            job_id=job_id,
            limit=limit,
        )

    except ValueError as exc:
        db.rollback()
        raise HTTPException(
            status_code=422,
            detail=str(exc),
        ) from exc

    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Database error occurred while extracting leads.",
        ) from exc


@router.post("/{job_id}/retry-failed")
def retry_failed_results_endpoint(
    job_id: int,
    limit: int = 10,
    db: Session = Depends(get_db),
):
    """
    Requeue retryable failures.

    This endpoint does not fetch webpages or make SerpApi calls.
    """

    try:
        return requeue_retryable_failed_results(
            db=db,
            job_id=job_id,
            limit=limit,
        )

    except ValueError as exc:
        db.rollback()
        raise HTTPException(
            status_code=422,
            detail=str(exc),
        ) from exc

    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail=(
                "Database error occurred while preparing "
                "failed results for retry."
            ),
        ) from exc

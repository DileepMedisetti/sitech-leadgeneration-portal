
from typing import Any
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.lead import Lead
from app.models.search_job import SearchJob
from app.models.search_result import SearchResult
from app.schemas.lead import LeadResponse, PaginatedLeadsResponse
from app.services.extraction.cleaners import (
    is_generic_contact_email,
    is_valid_email,
)
from app.services.lead_service import fetch_leads

router = APIRouter(prefix="/api/review-queue", tags=["Review Queue"])


class ReviewActionRequest(BaseModel):
    reason: str | None = None


@router.get(
    "",
    response_model=PaginatedLeadsResponse,
)
def get_review_queue_endpoint(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    search: str | None = None,
    job_id: int | None = None,
    db: Session = Depends(get_db),
):
    """List ambiguous candidates awaiting manual verification."""
    items, total, total_pages = fetch_leads(
        db=db,
        page=page,
        page_size=page_size,
        search=search,
        status="needs_review",
        job_id=job_id,
    )
    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
        "items": items,
    }


@router.post(
    "/{lead_id}/approve",
    response_model=LeadResponse,
)
def approve_candidate_endpoint(
    lead_id: int,
    action: ReviewActionRequest | None = None,
    db: Session = Depends(get_db),
):
    """Approve a candidate into qualified status."""
    lead = db.get(Lead, lead_id)
    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lead not found.",
        )

    if not lead.email or not is_valid_email(lead.email) or is_generic_contact_email(lead.email):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Cannot approve lead as qualified without a valid, non-generic personal email address.",
        )

    previous_status = lead.qualification_status
    lead.qualification_status = "qualified"
    lead.qualification_reason = (
        action.reason if action and action.reason else "Manually approved via review queue"
    )
    lead.confidence_score = 1.0

    # If linked to a search job, increment job qualified lead counter if transitioning from non-qualified
    if lead.search_job_id and previous_status != "qualified":
        job = db.get(SearchJob, lead.search_job_id)
        if job and job.qualified_leads_found < job.target_leads:
            job.qualified_leads_found += 1

    db.commit()
    db.refresh(lead)
    return lead


@router.post(
    "/{lead_id}/reject",
    response_model=LeadResponse,
)
def reject_candidate_endpoint(
    lead_id: int,
    action: ReviewActionRequest | None = None,
    db: Session = Depends(get_db),
):
    """Reject an ambiguous candidate."""
    lead = db.get(Lead, lead_id)
    if not lead:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Lead not found.",
        )

    previous_status = lead.qualification_status
    lead.qualification_status = "rejected"
    lead.qualification_reason = (
        action.reason if action and action.reason else "Manually rejected via review queue"
    )

    # If previously counted as qualified, decrement job counter
    if lead.search_job_id and previous_status == "qualified":
        job = db.get(SearchJob, lead.search_job_id)
        if job and job.qualified_leads_found > 0:
            job.qualified_leads_found -= 1

    db.commit()
    db.refresh(lead)
    return lead

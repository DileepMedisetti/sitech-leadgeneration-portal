
from fastapi import APIRouter, Depends
from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.lead import Lead
from app.models.search_job import SearchJob
from app.models.search_result import SearchResult
from app.schemas.lead import LeadResponse
from app.schemas.search_job import SearchJobResponse

router = APIRouter(prefix="/api/dashboard", tags=["Dashboard"])


@router.get("/stats")
def get_dashboard_stats(db: Session = Depends(get_db)):
    """Aggregate statistics for the overview dashboard using live database data."""
    # Lead counts
    total_leads = db.scalar(select(func.count(Lead.id))) or 0
    qualified_leads = db.scalar(
        select(func.count(Lead.id)).where(Lead.qualification_status == "qualified")
    ) or 0
    review_leads = db.scalar(
        select(func.count(Lead.id)).where(Lead.qualification_status == "needs_review")
    ) or 0
    rejected_leads = db.scalar(
        select(func.count(Lead.id)).where(Lead.qualification_status == "rejected")
    ) or 0

    # Job counts
    total_jobs = db.scalar(select(func.count(SearchJob.id))) or 0
    active_jobs = db.scalar(
        select(func.count(SearchJob.id)).where(SearchJob.status.in_(["pending", "running"]))
    ) or 0
    completed_jobs = db.scalar(
        select(func.count(SearchJob.id)).where(SearchJob.status == "completed")
    ) or 0

    # Search result counts
    total_results = db.scalar(select(func.count(SearchResult.id))) or 0
    processed_results = db.scalar(
        select(func.count(SearchResult.id)).where(SearchResult.status == "processed")
    ) or 0
    pending_results = db.scalar(
        select(func.count(SearchResult.id)).where(SearchResult.status == "pending")
    ) or 0
    failed_results = db.scalar(
        select(func.count(SearchResult.id)).where(SearchResult.status == "failed")
    ) or 0
    skipped_results = db.scalar(
        select(func.count(SearchResult.id)).where(SearchResult.status == "skipped")
    ) or 0

    # Credit & efficiency metrics
    total_serpapi_used = db.scalar(select(func.sum(SearchJob.serpapi_requests_used))) or 0
    leads_per_credit = (
        round(qualified_leads / total_serpapi_used, 2)
        if total_serpapi_used > 0
        else 0.0
    )
    extraction_success_rate = (
        round((processed_results / total_results) * 100, 1)
        if total_results > 0
        else 0.0
    )

    # Recent entities
    recent_jobs = list(
        db.scalars(
            select(SearchJob).order_by(desc(SearchJob.created_at)).limit(5)
        ).all()
    )
    recent_leads = list(
        db.scalars(
            select(Lead)
            .where(Lead.qualification_status == "qualified")
            .order_by(desc(Lead.created_at))
            .limit(5)
        ).all()
    )

    return {
        "total_leads": total_leads,
        "qualified_leads": qualified_leads,
        "review_leads": review_leads,
        "rejected_leads": rejected_leads,
        "total_jobs": total_jobs,
        "active_jobs": active_jobs,
        "completed_jobs": completed_jobs,
        "total_results": total_results,
        "processed_results": processed_results,
        "pending_results": pending_results,
        "failed_results": failed_results,
        "skipped_results": skipped_results,
        "serpapi_requests_used": total_serpapi_used,
        "qualified_leads_per_request": leads_per_credit,
        "extraction_success_rate": extraction_success_rate,
        "recent_jobs": [SearchJobResponse.model_validate(j) for j in recent_jobs],
        "recent_qualified_leads": [LeadResponse.model_validate(l) for l in recent_leads],
    }

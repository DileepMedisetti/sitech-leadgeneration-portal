
from fastapi import APIRouter, Depends
from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models.lead import Lead
from app.models.search_job import SearchJob
from app.models.search_result import SearchResult

router = APIRouter(prefix="/api/analytics", tags=["Analytics"])


@router.get("")
def get_analytics_metrics(db: Session = Depends(get_db)):
    """Retrieve deep analytics aggregated directly from production database records."""
    # Leads by country
    country_counts = db.execute(
        select(Lead.country, func.count(Lead.id).label("count"))
        .where(Lead.country.isnot(None), Lead.qualification_status == "qualified")
        .group_by(Lead.country)
        .order_by(desc("count"))
        .limit(10)
    ).all()

    # Leads by university
    uni_counts = db.execute(
        select(Lead.university, func.count(Lead.id).label("count"))
        .where(Lead.university.isnot(None), Lead.qualification_status == "qualified")
        .group_by(Lead.university)
        .order_by(desc("count"))
        .limit(10)
    ).all()

    # Leads by qualification status
    status_counts = db.execute(
        select(Lead.qualification_status, func.count(Lead.id).label("count"))
        .group_by(Lead.qualification_status)
    ).all()

    # Search result outcomes
    result_outcomes = db.execute(
        select(SearchResult.status, func.count(SearchResult.id).label("count"))
        .group_by(SearchResult.status)
    ).all()

    # Efficiency calculations
    total_leads = db.scalar(select(func.count(Lead.id))) or 0
    qualified_leads = db.scalar(
        select(func.count(Lead.id)).where(Lead.qualification_status == "qualified")
    ) or 0
    total_serpapi_used = db.scalar(select(func.sum(SearchJob.serpapi_requests_used))) or 0
    total_urls = db.scalar(select(func.count(SearchResult.id))) or 0

    leads_per_request = (
        round(qualified_leads / total_serpapi_used, 2)
        if total_serpapi_used > 0
        else 0.0
    )

    return {
        "leads_by_country": [{"country": row[0], "count": row[1]} for row in country_counts],
        "leads_by_university": [{"university": row[0], "count": row[1]} for row in uni_counts],
        "leads_by_status": [{"status": row[0], "count": row[1]} for row in status_counts],
        "result_outcomes": [{"status": row[0], "count": row[1]} for row in result_outcomes],
        "efficiency": {
            "total_leads": total_leads,
            "qualified_leads": qualified_leads,
            "total_urls_discovered": total_urls,
            "serpapi_requests_used": total_serpapi_used,
            "leads_per_request": leads_per_request,
        },
    }

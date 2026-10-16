
from sqlalchemy.orm import Session

from app.models.search_job import SearchJob
from app.repositories.search_job_repository import create_search_job
from app.schemas.search_job import SearchJobCreate


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

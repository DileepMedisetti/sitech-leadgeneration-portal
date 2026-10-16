
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.schemas.search_job import SearchJobCreate, SearchJobResponse
from app.services.search_job_service import create_job


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

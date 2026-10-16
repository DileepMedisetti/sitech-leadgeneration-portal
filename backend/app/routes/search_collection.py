
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.services.search_collection_service import collect_search_results


router = APIRouter(
    prefix="/api/search-jobs",
    tags=["Search Collection"],
)


@router.post("/{job_id}/collect")
def collect_results_endpoint(
    job_id: int,
    db: Session = Depends(get_db),
):
    try:
        return collect_search_results(db=db, job_id=job_id)

    except ValueError as exc:
        db.rollback()
        message = str(exc)

        if message == "Search job not found.":
            raise HTTPException(status_code=404, detail=message) from exc

        raise HTTPException(status_code=409, detail=message) from exc

    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(
            status_code=500,
            detail="Database error while collecting search results.",
        ) from exc

    except RuntimeError as exc:
        raise HTTPException(
            status_code=502,
            detail="Search provider request failed.",
        ) from exc

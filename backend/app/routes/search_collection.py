from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.services.search_collection_service import collect_search_results
from app.services.serper_service import (
    SerperApiAuthError,
    SerperApiError,
    SerperApiQueryError,
    SerperApiQuotaError,
    SerperApiRateLimitError,
    SerperApiTimeoutError,
    SerperApiUpstreamError,
    SerperAuthError,
    SerperQueryError,
    SerperQuotaError,
    SerperRateLimitError,
    SerperTimeoutError,
    SerperUpstreamError,
)
from app.services.serpapi_service import (
    SerpApiAuthError,
    SerpApiError,
    SerpApiQueryError,
    SerpApiQuotaError,
    SerpApiRateLimitError,
    SerpApiTimeoutError,
    SerpApiUpstreamError,
)

router = APIRouter(
    prefix="/api/search-jobs",
    tags=["Search Collection"],
)


@router.post("/{job_id}/collect")
def collect_results_endpoint(
    job_id: int,
    query_override: str | None = Query(
        default=None,
        min_length=1,
        description="Optional search query to use instead of the job's keywords.",
    ),
    db: Session = Depends(get_db),
):
    try:
        if query_override is not None:
            query_override = query_override.strip()

            if not query_override:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail="query_override cannot be empty or whitespace.",
                )

        return collect_search_results(
            db=db,
            job_id=job_id,
            query_override=query_override,
        )

    except HTTPException:
        raise

    except ValueError as exc:
        db.rollback()
        message = str(exc)

        if message == "Search job not found.":
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=message,
            ) from exc

        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=message,
        ) from exc

    except (SerperAuthError, SerpApiAuthError) as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(exc),
        ) from exc

    except (SerperQuotaError, SerpApiQuotaError) as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail=str(exc),
        ) from exc

    except (SerperRateLimitError, SerpApiRateLimitError) as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=str(exc),
        ) from exc

    except (SerperTimeoutError, SerpApiTimeoutError) as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail=str(exc),
        ) from exc

    except (SerperQueryError, SerpApiQueryError) as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=str(exc),
        ) from exc

    except (SerperUpstreamError, SerpApiUpstreamError, SerperApiError, SerpApiError) as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc

    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Database error while collecting search results.",
        ) from exc

    except RuntimeError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc

import logging
import httpx

from app.core.config import settings

logger = logging.getLogger("serpapi")
SERPAPI_URL = "https://serpapi.com/search.json"


class SerpApiError(Exception):
    """Base exception for all SerpApi provider failures."""

    def __init__(
        self,
        message: str,
        status_code: int | None = 502,
        credit_consumed: bool = False,
    ):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.credit_consumed = credit_consumed


class SerpApiAuthError(SerpApiError):
    """Raised when authentication with SerpApi fails (invalid or missing key)."""


class SerpApiQuotaError(SerpApiError):
    """Raised when SerpApi account searches run out or credit limit is reached."""


class SerpApiRateLimitError(SerpApiError):
    """Raised when SerpApi rate limit (429) is triggered."""


class SerpApiTimeoutError(SerpApiError):
    """Raised when the HTTP request to SerpApi times out."""


class SerpApiQueryError(SerpApiError):
    """Raised when SerpApi rejects the query syntax or parameters."""


class SerpApiUpstreamError(SerpApiError):
    """Raised when SerpApi returns 5xx server errors or connection breaks."""


def search_google(
    query: str,
    num_results: int = 10,
    job_id: int | None = None,
) -> dict:
    """Search Google through SerpApi with structured error mapping and diagnostics."""
    if not settings.SERPAPI_API_KEY or not settings.SERPAPI_API_KEY.strip():
        logger.error(
            "SerpApi request failed for job %s: SERPAPI_API_KEY is not configured.",
            job_id,
        )
        raise SerpApiAuthError(
            "SERPAPI_API_KEY is not configured on the server.",
            status_code=503,
            credit_consumed=False,
        )

    clean_query = query.strip() if query else ""
    if not clean_query:
        raise SerpApiQueryError(
            "Search query cannot be empty.",
            status_code=422,
            credit_consumed=False,
        )

    if not 1 <= num_results <= 100:
        raise SerpApiQueryError(
            "num_results must be between 1 and 100.",
            status_code=422,
            credit_consumed=False,
        )

    params = {
        "engine": "google",
        "q": clean_query,
        "api_key": settings.SERPAPI_API_KEY,
        "num": num_results,
    }

    try:
        with httpx.Client(timeout=30.0) as client:
            response = client.get(SERPAPI_URL, params=params)
    except httpx.TimeoutException as exc:
        logger.error(
            "SerpApi timeout for job %s: request timed out after 30s. Credit consumed: False.",
            job_id,
        )
        raise SerpApiTimeoutError(
            "Search provider request timed out after 30 seconds. No search credits consumed.",
            status_code=504,
            credit_consumed=False,
        ) from exc
    except httpx.ConnectError as exc:
        logger.error(
            "SerpApi connection failure for job %s: unable to reach host. Credit consumed: False.",
            job_id,
        )
        raise SerpApiUpstreamError(
            "Unable to connect to Google Search provider network. No search credits consumed.",
            status_code=502,
            credit_consumed=False,
        ) from exc
    except httpx.HTTPError as exc:
        logger.error(
            "SerpApi transport error for job %s: %s. Credit consumed: False.",
            job_id,
            type(exc).__name__,
        )
        raise SerpApiUpstreamError(
            "Search provider communication error. No search credits consumed.",
            status_code=502,
            credit_consumed=False,
        ) from exc

    status_code = response.status_code

    try:
        data = response.json()
    except Exception as exc:
        logger.error(
            "SerpApi returned non-JSON payload for job %s: HTTP %s.",
            job_id,
            status_code,
        )
        if status_code >= 500:
            raise SerpApiUpstreamError(
                f"Search provider returned unexpected HTTP {status_code} error.",
                status_code=502,
                credit_consumed=False,
            ) from exc
        raise SerpApiError(
            f"Failed to parse search provider response (HTTP {status_code}).",
            status_code=502,
            credit_consumed=False,
        ) from exc

    error_msg = data.get("error", "") if isinstance(data, dict) else ""
    error_lower = str(error_msg).lower()

    if status_code == 401 or "invalid api key" in error_lower:
        logger.error("SerpApi auth rejection for job %s: HTTP %s", job_id, status_code)
        raise SerpApiAuthError(
            "Search provider authentication failed: Invalid or expired API key.",
            status_code=503,
            credit_consumed=False,
        )

    if (
        status_code == 402
        or "searches have run out" in error_lower
        or "credit limit" in error_lower
        or "monthly search limit" in error_lower
    ):
        logger.error("SerpApi quota exceeded for job %s: HTTP %s", job_id, status_code)
        raise SerpApiQuotaError(
            "Search provider account quota or credit limit exhausted. Please check your SerpApi account.",
            status_code=402,
            credit_consumed=False,
        )

    if (
        status_code == 429
        or "rate limit" in error_lower
        or "too many requests" in error_lower
    ):
        logger.warning("SerpApi rate limit hit for job %s: HTTP %s", job_id, status_code)
        raise SerpApiRateLimitError(
            "Search provider rate limit reached. Please retry after a brief delay.",
            status_code=429,
            credit_consumed=False,
        )

    if status_code == 400 or ("invalid" in error_lower and "query" in error_lower):
        logger.warning("SerpApi rejected query for job %s: %s", job_id, error_msg)
        raise SerpApiQueryError(
            f"Search query was rejected by search provider: {error_msg}",
            status_code=422,
            credit_consumed=False,
        )

    if status_code >= 500:
        logger.error(
            "SerpApi upstream 5xx for job %s: HTTP %s - %s",
            job_id,
            status_code,
            error_msg,
        )
        raise SerpApiUpstreamError(
            f"Search provider service temporarily unavailable (HTTP {status_code}).",
            status_code=502,
            credit_consumed=False,
        )

    if error_msg:
        logger.error("SerpApi error payload for job %s: %s", job_id, error_msg)
        raise SerpApiError(
            f"Search provider error: {error_msg}",
            status_code=502,
            credit_consumed=False,
        )

    return data

import logging
import time
from typing import Any
import httpx

from app.core.config import settings

logger = logging.getLogger("serper")


class SerperApiError(Exception):
    """Base exception for all Serper.dev provider failures."""

    def __init__(
        self,
        message: str,
        status_code: int = 502,
        credit_consumed: bool = False,
    ):
        super().__init__(message)
        self.message = message
        self.status_code = status_code
        self.credit_consumed = credit_consumed


class SerperAuthError(SerperApiError):
    """Raised when authentication with Serper.dev fails (invalid or missing key)."""


class SerperQuotaError(SerperApiError):
    """Raised when Serper.dev credits are exhausted or plan quota reached."""


class SerperRateLimitError(SerperApiError):
    """Raised when Serper.dev rate limit (429) is triggered."""


class SerperTimeoutError(SerperApiError):
    """Raised when the HTTP request to Serper.dev times out."""


class SerperQueryError(SerperApiError):
    """Raised when Serper.dev rejects the query syntax or parameters."""


class SerperUpstreamError(SerperApiError):
    """Raised when Serper.dev returns 5xx server errors or connection breaks."""


# Aliases for consistent naming
SerperApiAuthError = SerperAuthError
SerperApiQuotaError = SerperQuotaError
SerperApiRateLimitError = SerperRateLimitError
SerperApiTimeoutError = SerperTimeoutError
SerperApiQueryError = SerperQueryError
SerperApiUpstreamError = SerperUpstreamError


def search_serper(
    query: str,
    num_results: int = 10,
    job_id: int | None = None,
    max_retries: int = 2,
) -> dict[str, Any]:
    """Execute a Google Search query via Serper.dev API.

    API Contract:
      POST https://google.serper.dev/search
      Headers:
        X-API-KEY: <settings.SERPER_API_KEY>
        Content-Type: application/json
      Body:
        {"q": query, "num": num_results}

    Returns normalized response containing:
      - 'organic': list of organic search items
      - 'organic_results': alias to 'organic' for backward compatibility
      - 'searchParameters': dictionary of query metadata
    """
    api_key = settings.SERPER_API_KEY.strip() if settings.SERPER_API_KEY else ""

    if not api_key:
        logger.error(
            "Serper.dev request failed for job %s: SERPER_API_KEY is not configured.",
            job_id,
        )
        raise SerperAuthError(
            "SERPER_API_KEY is not configured on the server. Please check your environment.",
            status_code=503,
            credit_consumed=False,
        )

    clean_query = query.strip() if query else ""
    if not clean_query:
        raise SerperQueryError(
            "Search query cannot be empty.",
            status_code=422,
            credit_consumed=False,
        )

    if not 1 <= num_results <= 100:
        raise SerperQueryError(
            "num_results must be between 1 and 100.",
            status_code=422,
            credit_consumed=False,
        )

    base_url = settings.SERPER_BASE_URL.rstrip("/") if settings.SERPER_BASE_URL else "https://google.serper.dev"
    endpoint_url = f"{base_url}/search"

    headers = {
        "X-API-KEY": api_key,
        "Content-Type": "application/json",
    }

    payload = {
        "q": clean_query,
        "num": num_results,
    }

    last_exception: Exception | None = None

    for attempt in range(max_retries + 1):
        try:
            with httpx.Client(timeout=20.0) as client:
                response = client.post(endpoint_url, headers=headers, json=payload)
            break
        except httpx.TimeoutException as exc:
            last_exception = exc
            logger.warning(
                "Serper.dev timeout (attempt %s/%s) for job %s: request timed out.",
                attempt + 1,
                max_retries + 1,
                job_id,
            )
            if attempt == max_retries:
                raise SerperTimeoutError(
                    "Search provider request timed out after 20 seconds. No search credits consumed.",
                    status_code=504,
                    credit_consumed=False,
                ) from exc
            time.sleep(0.5 * (2**attempt))
        except httpx.ConnectError as exc:
            last_exception = exc
            logger.warning(
                "Serper.dev connection error (attempt %s/%s) for job %s: unable to reach host.",
                attempt + 1,
                max_retries + 1,
                job_id,
            )
            if attempt == max_retries:
                raise SerperUpstreamError(
                    "Unable to connect to Google Search provider network. No search credits consumed.",
                    status_code=502,
                    credit_consumed=False,
                ) from exc
            time.sleep(0.5 * (2**attempt))
        except httpx.HTTPError as exc:
            last_exception = exc
            logger.warning(
                "Serper.dev transport error (attempt %s/%s) for job %s: %s.",
                attempt + 1,
                max_retries + 1,
                job_id,
                type(exc).__name__,
            )
            if attempt == max_retries:
                raise SerperUpstreamError(
                    f"Search provider transport error ({type(exc).__name__}). No search credits consumed.",
                    status_code=502,
                    credit_consumed=False,
                ) from exc
            time.sleep(0.5 * (2**attempt))

    status_code = response.status_code

    try:
        data = response.json()
    except Exception as exc:
        logger.error(
            "Serper.dev returned non-JSON payload for job %s: HTTP %s.",
            job_id,
            status_code,
        )
        if status_code >= 500:
            raise SerperUpstreamError(
                f"Search provider returned unexpected HTTP {status_code} error.",
                status_code=502,
                credit_consumed=False,
            ) from exc
        raise SerperApiError(
            f"Failed to parse search provider response (HTTP {status_code}).",
            status_code=502,
            credit_consumed=False,
        ) from exc

    error_msg = ""
    if isinstance(data, dict):
        error_msg = str(data.get("message") or data.get("error") or "")
    error_lower = error_msg.lower()

    # 401 / 403 Unauthorized
    if status_code in (401, 403) or "unauthorized" in error_lower or "invalid api key" in error_lower:
        logger.error("Serper.dev auth rejection for job %s: HTTP %s - %s", job_id, status_code, error_msg)
        raise SerperAuthError(
            "Search provider authentication failed: Invalid or unauthorized Serper.dev API key.",
            status_code=503,
            credit_consumed=False,
        )

    # 402 / Quota / Credits exhausted
    if (
        status_code == 402
        or "not enough credits" in error_lower
        or "credit" in error_lower
        or "quota" in error_lower
        or "searches run out" in error_lower
    ):
        logger.error("Serper.dev quota exceeded for job %s: HTTP %s - %s", job_id, status_code, error_msg)
        raise SerperQuotaError(
            "Search provider account quota or credit limit exhausted. Please check your Serper.dev account balance.",
            status_code=402,
            credit_consumed=False,
        )

    # 429 Rate limit
    if status_code == 429 or "rate limit" in error_lower or "too many requests" in error_lower:
        logger.warning("Serper.dev rate limit hit for job %s: HTTP %s", job_id, status_code)
        raise SerperRateLimitError(
            "Search provider rate limit reached. Please retry after a brief delay.",
            status_code=429,
            credit_consumed=False,
        )

    # 400 Bad Request
    if status_code == 400 or ("invalid" in error_lower and "query" in error_lower):
        logger.warning("Serper.dev rejected query for job %s: %s", job_id, error_msg)
        raise SerperQueryError(
            f"Search query was rejected by search provider: {error_msg or 'Invalid request'}",
            status_code=422,
            credit_consumed=False,
        )

    # 5xx Server Error
    if status_code >= 500:
        logger.error("Serper.dev upstream 5xx for job %s: HTTP %s - %s", job_id, status_code, error_msg)
        raise SerperUpstreamError(
            f"Search provider service temporarily unavailable (HTTP {status_code}).",
            status_code=502,
            credit_consumed=False,
        )

    if error_msg and status_code >= 400:
        logger.error("Serper.dev error payload for job %s: %s", job_id, error_msg)
        raise SerperApiError(
            f"Search provider error: {error_msg}",
            status_code=502,
            credit_consumed=False,
        )

    # Normalize response format
    # Serper returns: {"searchParameters": {...}, "organic": [...]}
    raw_organic = data.get("organic", []) if isinstance(data, dict) else []
    normalized_organic: list[dict[str, Any]] = []

    for idx, item in enumerate(raw_organic):
        if not isinstance(item, dict):
            continue
        link = item.get("link")
        if not link:
            continue
        normalized_organic.append({
            "title": item.get("title", ""),
            "link": link,
            "snippet": item.get("snippet", ""),
            "position": item.get("position", idx + 1),
            "sitelinks": item.get("sitelinks", []),
        })

    return {
        "searchParameters": data.get("searchParameters", {"q": clean_query, "num": num_results}),
        "organic": normalized_organic,
        "organic_results": normalized_organic,  # alias for backward compatibility
        "credits_consumed": 1,
    }

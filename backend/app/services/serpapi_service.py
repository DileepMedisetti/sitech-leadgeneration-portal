
import httpx

from app.core.config import settings


SERPAPI_URL = "https://serpapi.com/search.json"


def search_google(
    query: str,
    num_results: int = 10,
) -> dict:
    """
    Search Google through SerpApi and return the JSON response.
    """

    if not settings.SERPAPI_API_KEY:
        raise ValueError("SERPAPI_API_KEY is not configured.")

    if not query or not query.strip():
        raise ValueError("Search query cannot be empty.")

    if not 1 <= num_results <= 100:
        raise ValueError("num_results must be between 1 and 100.")

    params = {
        "engine": "google",
        "q": query.strip(),
        "api_key": settings.SERPAPI_API_KEY,
        "num": num_results,
    }

    try:
        with httpx.Client(timeout=30.0) as client:
            response = client.get(SERPAPI_URL, params=params)
            response.raise_for_status()
            data = response.json()

    except httpx.HTTPError as exc:
        raise RuntimeError(
            "Failed to retrieve Google search results from SerpApi."
        ) from exc

    if data.get("error"):
        raise RuntimeError(f"SerpApi error: {data['error']}")

    return data

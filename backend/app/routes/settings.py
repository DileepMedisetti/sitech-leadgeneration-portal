
from fastapi import APIRouter
from app.core.config import settings

router = APIRouter(prefix="/api/settings", tags=["Settings"])


@router.get("")
def get_safe_settings():
    """Return safe, non-secret system configuration and operational defaults."""
    return {
        "serper_configured": bool(settings.SERPER_API_KEY and settings.SERPER_API_KEY.strip()),
        "serpapi_configured": bool(
            (settings.SERPER_API_KEY and settings.SERPER_API_KEY.strip())
            or (settings.SERPAPI_API_KEY and settings.SERPAPI_API_KEY.strip())
        ),
        "default_target_leads": 20,
        "default_max_serpapi_requests": 5,
        "default_extraction_batch_size": 10,
        "max_retries": 3,
        "request_timeout_seconds": 15,
        "system_version": "2.0.0",
        "supported_countries": [
            "India",
            "United States",
            "United Kingdom",
            "Canada",
            "Australia",
            "Singapore",
            "Germany",
            "France",
        ],
        "common_professions": [
            "Professor",
            "Associate Professor",
            "Assistant Professor",
            "Dean",
            "Department Head",
            "Principal Investigator",
            "Research Scientist",
            "Lecturer",
        ],
    }

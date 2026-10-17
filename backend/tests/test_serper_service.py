from unittest.mock import MagicMock
import httpx
import pytest

from app.core.config import settings
from app.services.serper_service import (
    SerperApiError,
    SerperAuthError,
    SerperQueryError,
    SerperQuotaError,
    SerperRateLimitError,
    SerperTimeoutError,
    SerperUpstreamError,
    search_serper,
)


def test_serper_missing_api_key(monkeypatch):
    monkeypatch.setattr(settings, "SERPER_API_KEY", "")
    with pytest.raises(SerperAuthError) as exc_info:
        search_serper("Stanford Computer Science Faculty")
    assert "SERPER_API_KEY is not configured" in str(exc_info.value)
    assert exc_info.value.credit_consumed is False


def test_serper_empty_query(monkeypatch):
    monkeypatch.setattr(settings, "SERPER_API_KEY", "test_key")
    with pytest.raises(SerperQueryError) as exc_info:
        search_serper("   ")
    assert "cannot be empty" in str(exc_info.value)


def test_serper_successful_search(monkeypatch):
    monkeypatch.setattr(settings, "SERPER_API_KEY", "test_key")

    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.json.return_value = {
        "searchParameters": {"q": "MIT AI Faculty", "num": 10},
        "organic": [
            {
                "title": "Dr. Jane Doe | MIT CSAIL",
                "link": "https://csail.mit.edu/person/jane-doe",
                "snippet": "Professor of EECS specializing in neural algorithms.",
                "position": 1,
            },
            {
                "title": "Dr. John Smith | MIT EECS",
                "link": "https://eecs.mit.edu/people/john-smith",
                "snippet": "Associate Professor in Computer Science.",
                "position": 2,
            },
        ],
    }

    monkeypatch.setattr("httpx.Client.post", lambda *args, **kwargs: mock_resp)

    results = search_serper(query="MIT AI Faculty", num_results=10)

    assert "organic" in results
    assert "organic_results" in results  # backward compatibility alias
    assert len(results["organic"]) == 2
    assert results["organic"][0]["title"] == "Dr. Jane Doe | MIT CSAIL"
    assert results["organic"][0]["link"] == "https://csail.mit.edu/person/jane-doe"
    assert results["organic"][0]["position"] == 1
    assert results["credits_consumed"] == 1


def test_serper_auth_error_401(monkeypatch):
    monkeypatch.setattr(settings, "SERPER_API_KEY", "invalid_key")

    mock_resp = MagicMock()
    mock_resp.status_code = 401
    mock_resp.json.return_value = {"message": "Unauthorized: Invalid API key"}

    monkeypatch.setattr("httpx.Client.post", lambda *args, **kwargs: mock_resp)

    with pytest.raises(SerperAuthError) as exc_info:
        search_serper(query="test", num_results=10)
    assert "Invalid or unauthorized" in str(exc_info.value)
    assert exc_info.value.status_code == 503
    assert exc_info.value.credit_consumed is False


def test_serper_quota_exhausted_402(monkeypatch):
    monkeypatch.setattr(settings, "SERPER_API_KEY", "test_key")

    mock_resp = MagicMock()
    mock_resp.status_code = 402
    mock_resp.json.return_value = {"message": "Not enough credits to perform this request."}

    monkeypatch.setattr("httpx.Client.post", lambda *args, **kwargs: mock_resp)

    with pytest.raises(SerperQuotaError) as exc_info:
        search_serper(query="test", num_results=10)
    assert "quota or credit limit exhausted" in str(exc_info.value)
    assert exc_info.value.status_code == 402
    assert exc_info.value.credit_consumed is False


def test_serper_rate_limit_429(monkeypatch):
    monkeypatch.setattr(settings, "SERPER_API_KEY", "test_key")

    mock_resp = MagicMock()
    mock_resp.status_code = 429
    mock_resp.json.return_value = {"message": "Rate limit exceeded"}

    monkeypatch.setattr("httpx.Client.post", lambda *args, **kwargs: mock_resp)

    with pytest.raises(SerperRateLimitError) as exc_info:
        search_serper(query="test", num_results=10)
    assert "rate limit reached" in str(exc_info.value).lower()
    assert exc_info.value.status_code == 429


def test_serper_timeout_exception(monkeypatch):
    monkeypatch.setattr(settings, "SERPER_API_KEY", "test_key")

    def mock_timeout(*args, **kwargs):
        raise httpx.TimeoutException("Connection timed out")

    monkeypatch.setattr("httpx.Client.post", mock_timeout)

    with pytest.raises(SerperTimeoutError) as exc_info:
        search_serper(query="test", num_results=10, max_retries=0)
    assert "timed out after 20 seconds" in str(exc_info.value)
    assert exc_info.value.credit_consumed is False


def test_serper_upstream_500_error(monkeypatch):
    monkeypatch.setattr(settings, "SERPER_API_KEY", "test_key")

    mock_resp = MagicMock()
    mock_resp.status_code = 500
    mock_resp.json.return_value = {"error": "Internal server error"}

    monkeypatch.setattr("httpx.Client.post", lambda *args, **kwargs: mock_resp)

    with pytest.raises(SerperUpstreamError) as exc_info:
        search_serper(query="test", num_results=10)
    assert "temporarily unavailable" in str(exc_info.value)
    assert exc_info.value.status_code == 502
    assert exc_info.value.credit_consumed is False

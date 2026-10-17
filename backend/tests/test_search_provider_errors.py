from types import SimpleNamespace
from unittest.mock import MagicMock
from fastapi.testclient import TestClient

from app.main import app
from app.db.database import get_db
from app.routes import search_collection, search_jobs
from app.services.serpapi_service import (
    SerpApiAuthError,
    SerpApiQuotaError,
    SerpApiRateLimitError,
    SerpApiTimeoutError,
    SerpApiQueryError,
    SerpApiUpstreamError,
)

client = TestClient(app)


def test_collect_returns_503_on_serpapi_auth_error(monkeypatch):
    mock_db = MagicMock()
    app.dependency_overrides[get_db] = lambda: mock_db

    def mock_collect(db, job_id, query_override=None):
        raise SerpApiAuthError("SERPAPI_API_KEY is not configured on the server.", status_code=503)

    monkeypatch.setattr(search_collection, "collect_search_results", mock_collect)

    res = client.post("/api/search-jobs/1/collect")
    assert res.status_code == 503
    assert "SERPAPI_API_KEY is not configured" in res.json()["detail"]

    app.dependency_overrides.clear()


def test_collect_returns_402_on_serpapi_quota_error(monkeypatch):
    mock_db = MagicMock()
    app.dependency_overrides[get_db] = lambda: mock_db

    def mock_collect(db, job_id, query_override=None):
        raise SerpApiQuotaError("Search provider account quota exhausted.", status_code=402)

    monkeypatch.setattr(search_collection, "collect_search_results", mock_collect)

    res = client.post("/api/search-jobs/1/collect")
    assert res.status_code == 402
    assert "quota exhausted" in res.json()["detail"]

    app.dependency_overrides.clear()


def test_collect_returns_429_on_serpapi_rate_limit(monkeypatch):
    mock_db = MagicMock()
    app.dependency_overrides[get_db] = lambda: mock_db

    def mock_collect(db, job_id, query_override=None):
        raise SerpApiRateLimitError("Rate limit reached. Please wait.", status_code=429)

    monkeypatch.setattr(search_collection, "collect_search_results", mock_collect)

    res = client.post("/api/search-jobs/1/collect")
    assert res.status_code == 429
    assert "Rate limit" in res.json()["detail"]

    app.dependency_overrides.clear()


def test_collect_returns_504_on_serpapi_timeout(monkeypatch):
    mock_db = MagicMock()
    app.dependency_overrides[get_db] = lambda: mock_db

    def mock_collect(db, job_id, query_override=None):
        raise SerpApiTimeoutError("Request timed out after 30 seconds.", status_code=504)

    monkeypatch.setattr(search_collection, "collect_search_results", mock_collect)

    res = client.post("/api/search-jobs/1/collect")
    assert res.status_code == 504
    assert "timed out" in res.json()["detail"]

    app.dependency_overrides.clear()


def test_collect_returns_422_on_serpapi_query_error(monkeypatch):
    mock_db = MagicMock()
    app.dependency_overrides[get_db] = lambda: mock_db

    def mock_collect(db, job_id, query_override=None):
        raise SerpApiQueryError("Search query syntax rejected.", status_code=422)

    monkeypatch.setattr(search_collection, "collect_search_results", mock_collect)

    res = client.post("/api/search-jobs/1/collect")
    assert res.status_code == 422
    assert "syntax rejected" in res.json()["detail"]

    app.dependency_overrides.clear()


def test_collect_returns_502_on_upstream_error(monkeypatch):
    mock_db = MagicMock()
    app.dependency_overrides[get_db] = lambda: mock_db

    def mock_collect(db, job_id, query_override=None):
        raise SerpApiUpstreamError("Search provider service unavailable (HTTP 503).", status_code=502)

    monkeypatch.setattr(search_collection, "collect_search_results", mock_collect)

    res = client.post("/api/search-jobs/1/collect")
    assert res.status_code == 502
    assert "unavailable" in res.json()["detail"]

    app.dependency_overrides.clear()


def test_start_search_job_lifecycle(monkeypatch):
    mock_db = MagicMock()
    app.dependency_overrides[get_db] = lambda: mock_db

    job = SimpleNamespace(
        id=1,
        search_name="Test Job",
        keywords="faculty",
        search_criteria={},
        target_leads=20,
        max_serpapi_requests=5,
        serpapi_requests_used=0,
        qualified_leads_found=0,
        status="running",
        error_message=None,
        created_at="2026-10-16T12:00:00Z",
        started_at="2026-10-16T12:01:00Z",
        completed_at=None,
    )

    monkeypatch.setattr(search_jobs, "start_search_job_execution", lambda db, job_id: job)

    res = client.post("/api/search-jobs/1/start")
    assert res.status_code == 200
    assert res.json()["status"] == "running"

    app.dependency_overrides.clear()


def test_start_search_job_rejects_already_running(monkeypatch):
    mock_db = MagicMock()
    app.dependency_overrides[get_db] = lambda: mock_db

    def mock_start(db, job_id):
        raise ValueError("Job is already running.")

    monkeypatch.setattr(search_jobs, "start_search_job_execution", mock_start)

    res = client.post("/api/search-jobs/1/start")
    assert res.status_code == 400
    assert "already running" in res.json()["detail"]

    app.dependency_overrides.clear()


def test_resume_search_job_rejects_pending_status(monkeypatch):
    mock_db = MagicMock()
    app.dependency_overrides[get_db] = lambda: mock_db

    def mock_resume(db, job_id):
        raise ValueError("Job with status 'pending' cannot be resumed. Use the start action to begin execution.")

    monkeypatch.setattr(search_jobs, "resume_search_job_execution", mock_resume)

    res = client.post("/api/search-jobs/1/resume")
    assert res.status_code == 400
    assert "cannot be resumed" in res.json()["detail"]

    app.dependency_overrides.clear()

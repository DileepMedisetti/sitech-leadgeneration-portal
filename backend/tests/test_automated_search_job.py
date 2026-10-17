from types import SimpleNamespace
from unittest.mock import MagicMock
import pytest
from fastapi.testclient import TestClient

from app.db.database import get_db
from app.main import app
from app.services.search_job_service import run_automated_search_job

client = TestClient(app)


def test_run_automated_search_job_completes_when_target_reached(monkeypatch):
    mock_db = MagicMock()

    job = SimpleNamespace(
        id=10,
        search_name="AI Professors Test",
        keywords="Artificial Intelligence faculty Stanford",
        search_criteria={"university": "Stanford University", "profession": "Professor"},
        target_leads=2,
        max_serpapi_requests=5,
        serpapi_requests_used=0,
        qualified_leads_found=0,
        status="pending",
        started_at=None,
        completed_at=None,
    )

    monkeypatch.setattr(
        "app.services.search_job_service.get_search_job_by_id",
        lambda db, jid: job,
    )
    monkeypatch.setattr(
        "app.services.search_job_service.start_persisted_search_job",
        lambda db, jid: setattr(job, "status", "running") or job,
    )

    # Mock collect_search_results: discovers results and increments requests
    def mock_collect(db, job_id, query_override=None, use_cache=True):
        job.serpapi_requests_used += 1
        return {"job_id": job_id, "results_saved": 5, "was_cache": False}

    monkeypatch.setattr(
        "app.services.search_collection_service.collect_search_results",
        mock_collect,
    )

    # Mock process_pending_results: simulates discovering 2 qualified leads
    def mock_extract(db, job_id, limit=20):
        job.qualified_leads_found += 2
        return {"results_processed": 2, "leads_created": 2, "qualified_leads_counted": 2}

    monkeypatch.setattr(
        "app.services.lead_extraction_service.process_pending_results",
        mock_extract,
    )

    result = run_automated_search_job(mock_db, 10)

    assert result["job_id"] == 10
    assert result["qualified_leads_found"] >= 2
    assert result["completed"] is True
    assert job.status == "completed"
    assert result["search_requests_used"] == 1  # Stopped early! Did not consume all 5 requests.


def test_run_search_job_endpoint(monkeypatch):
    mock_db = MagicMock()
    app.dependency_overrides[get_db] = lambda: mock_db

    monkeypatch.setattr(
        "app.routes.search_jobs.run_automated_search_job",
        lambda db, jid: {
            "job_id": jid,
            "status": "completed",
            "qualified_leads_found": 5,
            "target_leads": 5,
            "search_requests_used": 2,
            "completed": True,
        },
    )

    resp = client.post("/api/search-jobs/1/run")
    assert resp.status_code == 200
    data = resp.json()
    assert data["job_id"] == 1
    assert data["status"] == "completed"
    assert data["completed"] is True

    app.dependency_overrides.clear()

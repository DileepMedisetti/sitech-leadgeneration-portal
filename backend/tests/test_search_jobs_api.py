
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient
from sqlalchemy.exc import SQLAlchemyError

from app.main import app
from app.db.database import get_db
from app.routes import search_jobs as search_jobs_routes


@pytest.fixture
def fake_db():
    return MagicMock()


@pytest.fixture
def client(fake_db):
    def override_get_db():
        yield fake_db

    app.dependency_overrides[get_db] = override_get_db

    try:
        with TestClient(app) as test_client:
            yield test_client
    finally:
        app.dependency_overrides.pop(get_db, None)


def make_fake_search_job():
    now = datetime.now(timezone.utc)

    return SimpleNamespace(
        id=1,
        search_name="Stanford CS Professors",
        keywords="Computer Science Professor",
        search_criteria={
            "country": "United States",
            "university": "Stanford University",
            "profession": "Computer Science Professor",
        },
        target_leads=100,
        max_serpapi_requests=20,
        serpapi_requests_used=0,
        qualified_leads_found=0,
        status="pending",
        error_message=None,
        created_at=now,
        started_at=None,
        completed_at=None,
    )


def test_create_search_job_success(client, fake_db, monkeypatch):
    fake_job = make_fake_search_job()

    def fake_create_search_job(db, job_data):
        assert db is fake_db
        assert job_data.target_leads == 100
        return fake_job

    monkeypatch.setattr(
        search_jobs_routes,
        "create_search_job",
        fake_create_search_job,
    )

    response = client.post(
        "/api/search-jobs",
        json={
            "search_name": "Stanford CS Professors",
            "keywords": "Computer Science Professor",
            "search_criteria": {
                "country": "United States",
                "university": "Stanford University",
                "profession": "Computer Science Professor",
            },
            "target_leads": 100,
            "max_serpapi_requests": 20,
        },
    )

    assert response.status_code == 201
    assert response.json()["id"] == 1
    assert response.json()["status"] == "pending"
    assert response.json()["target_leads"] == 100
    assert response.json()["max_serpapi_requests"] == 20

    fake_db.commit.assert_called_once()
    fake_db.refresh.assert_called_once_with(fake_job)


def test_create_search_job_rejects_invalid_limits(client, monkeypatch):
    def unexpected_call(*args, **kwargs):
        pytest.fail("Service should not run for invalid request data")

    monkeypatch.setattr(
        search_jobs_routes,
        "create_search_job",
        unexpected_call,
    )

    response = client.post(
        "/api/search-jobs",
        json={
            "search_name": "Stanford CS Professors",
            "keywords": "Computer Science Professor",
            "search_criteria": {},
            "target_leads": 0,
            "max_serpapi_requests": 20,
        },
    )

    assert response.status_code == 422


def test_create_search_job_handles_service_validation_error(
    client, fake_db, monkeypatch
):
    def fake_create_search_job(db, job_data):
        raise ValueError("Search keywords cannot be empty.")

    monkeypatch.setattr(
        search_jobs_routes,
        "create_search_job",
        fake_create_search_job,
    )

    response = client.post(
        "/api/search-jobs",
        json={
            "search_name": "Stanford CS Professors",
            "keywords": "Computer Science Professor",
            "search_criteria": {},
            "target_leads": 100,
            "max_serpapi_requests": 20,
        },
    )

    assert response.status_code == 422
    assert response.json()["detail"] == "Search keywords cannot be empty."

    fake_db.rollback.assert_called_once()
    fake_db.commit.assert_not_called()


def test_create_search_job_handles_database_error(
    client, fake_db, monkeypatch
):
    fake_job = make_fake_search_job()

    monkeypatch.setattr(
        search_jobs_routes,
        "create_search_job",
        lambda db, job_data: fake_job,
    )

    fake_db.commit.side_effect = SQLAlchemyError("Database unavailable")

    response = client.post(
        "/api/search-jobs",
        json={
            "search_name": "Stanford CS Professors",
            "keywords": "Computer Science Professor",
            "search_criteria": {},
            "target_leads": 100,
            "max_serpapi_requests": 20,
        },
    )

    assert response.status_code == 500
    assert response.json()["detail"] == "Failed to create search job."

    fake_db.rollback.assert_called_once()

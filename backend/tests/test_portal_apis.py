
from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.db.database import get_db
from app.models.lead import Lead
from app.models.search_job import SearchJob


@pytest.fixture
def fake_db():
    return MagicMock()


@pytest.fixture
def client(fake_db):
    def override_get_db():
        yield fake_db

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.pop(get_db, None)


def test_health_endpoints(client):
    res = client.get("/health")
    assert res.status_code == 200
    assert res.json()["status"] == "healthy"


def test_safe_settings_endpoint(client):
    res = client.get("/api/settings")
    assert res.status_code == 200
    data = res.json()
    assert "serpapi_configured" in data
    assert "default_target_leads" in data
    # Ensure sensitive credentials are NOT exposed
    assert "SERPAPI_API_KEY" not in data
    assert "DATABASE_URL" not in data


def test_dashboard_stats_endpoint(client, fake_db):
    fake_db.scalar.return_value = 10
    fake_db.scalars.return_value.all.return_value = []

    res = client.get("/api/dashboard/stats")
    assert res.status_code == 200
    data = res.json()
    assert "total_leads" in data
    assert "qualified_leads" in data
    assert "total_jobs" in data
    assert "serpapi_requests_used" in data


def test_list_leads_endpoint(client, fake_db, monkeypatch):
    now = datetime.now(timezone.utc)
    mock_lead = SimpleNamespace(
        id=1,
        name="Dr. Ramanathan",
        email="raman@iitb.ac.in",
        phone_number="+91-22-2576-0000",
        profession="Professor",
        department="Computer Science",
        research_specialization="Algorithms",
        university="IIT Bombay",
        country="India",
        website="https://iitb.ac.in",
        linkedin_url="https://linkedin.com/in/ramanathan",
        source_url="https://iitb.ac.in/faculty",
        source_title="Faculty Directory",
        qualification_status="qualified",
        confidence_score=0.95,
        qualification_reason="Verified structured contact",
        evidence={"strategy": "faculty_card"},
        search_job_id=1,
        created_at=now,
        updated_at=now,
    )

    monkeypatch.setattr(
        "app.routes.leads.fetch_leads",
        lambda **kwargs: ([mock_lead], 1, 1),
    )

    res = client.get("/api/leads?status=qualified&search=Ramanathan")
    assert res.status_code == 200
    data = res.json()
    assert data["total"] == 1
    assert data["items"][0]["name"] == "Dr. Ramanathan"
    assert data["items"][0]["email"] == "raman@iitb.ac.in"


def test_export_leads_csv_endpoint(client, fake_db, monkeypatch):
    monkeypatch.setattr(
        "app.routes.leads.export_leads_to_csv",
        lambda **kwargs: "ID,Full Name,Email Address\n1,Dr. Raman,raman@iitb.ac.in\n",
    )

    res = client.get("/api/leads/export")
    assert res.status_code == 200
    assert "text/csv" in res.headers["content-type"]
    assert "Dr. Raman" in res.text


def test_review_queue_endpoint(client, monkeypatch):
    monkeypatch.setattr(
        "app.routes.review_queue.fetch_leads",
        lambda **kwargs: ([], 0, 1),
    )
    res = client.get("/api/review-queue")
    assert res.status_code == 200
    assert res.json()["total"] == 0


from datetime import datetime, timezone
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.db.database import get_db
from app.routes import leads as leads_routes


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


def make_fake_lead():
    now = datetime.now(timezone.utc)

    return SimpleNamespace(
        id=1,
        name="Test Lead",
        email="testlead@example.com",
        phone_number=None,
        profession="AI Engineer",
        university=None,
        country="India",
        website=None,
        linkedin_url=None,
        source_url=None,
        source_title=None,
        created_at=now,
        updated_at=now,
    )


def test_create_lead_success(client, fake_db, monkeypatch):
    fake_lead = make_fake_lead()

    def fake_process_lead(db, lead_data):
        return fake_lead, True

    monkeypatch.setattr(
        leads_routes,
        "process_lead",
        fake_process_lead,
    )

    response = client.post(
        "/api/leads",
        json={
            "name": "Test Lead",
            "email": "testlead@example.com",
            "profession": "AI Engineer",
            "country": "India",
        },
    )

    assert response.status_code == 201
    assert response.json()["id"] == 1
    assert response.json()["email"] == "testlead@example.com"
    fake_db.commit.assert_called_once()
    fake_db.refresh.assert_called_once_with(fake_lead)


def test_create_lead_rejects_invalid_email(client, monkeypatch):
    def unexpected_call(*args, **kwargs):
        pytest.fail("Lead service should not run for invalid input")

    monkeypatch.setattr(
        leads_routes,
        "process_lead",
        unexpected_call,
    )

    response = client.post(
        "/api/leads",
        json={
            "name": "Test Lead",
            "email": "not-an-email",
        },
    )

    assert response.status_code == 422


def test_create_lead_rejects_blank_name(client, monkeypatch):
    def unexpected_call(*args, **kwargs):
        pytest.fail("Lead service should not run for invalid input")

    monkeypatch.setattr(
        leads_routes,
        "process_lead",
        unexpected_call,
    )

    response = client.post(
        "/api/leads",
        json={
            "name": "   ",
            "email": "testlead@example.com",
        },
    )

    # The LeadCreate schema permits whitespace-only names,
    # but the service must reject them.
    assert response.status_code == 422


def test_create_lead_handles_service_value_error(
    client,
    fake_db,
    monkeypatch,
):
    def fake_process_lead(db, lead_data):
        raise ValueError("Lead name cannot be empty.")

    monkeypatch.setattr(
        leads_routes,
        "process_lead",
        fake_process_lead,
    )

    response = client.post(
        "/api/leads",
        json={
            "name": "Test Lead",
            "email": "testlead@example.com",
        },
    )

    assert response.status_code == 422
    assert response.json()["detail"] == "Lead name cannot be empty."
    fake_db.rollback.assert_called_once()
    fake_db.commit.assert_not_called()


def test_audit_leads_endpoint(client, fake_db, monkeypatch):
    def fake_audit(db):
        return {
            "total_audited": 4,
            "reclassified_to_rejected": 1,
            "reclassified_to_review": 1,
            "already_valid": 2,
            "adjusted_jobs": 1,
            "details": [],
        }

    monkeypatch.setattr(
        leads_routes,
        "audit_and_reclassify_leads",
        fake_audit,
    )

    response = client.post("/api/leads/audit")
    assert response.status_code == 200
    data = response.json()
    assert data["total_audited"] == 4
    assert data["adjusted_jobs"] == 1


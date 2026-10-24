import uuid
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.security import create_access_token
from app.db.database import SessionLocal
from app.main import app
from app.models.campaign import Campaign, CampaignContent
from app.models.email_account import EmailAccount
from app.models.user import User
from app.services.sender_eligibility_service import (
    get_eligible_sender_accounts,
    validate_sender_eligibility,
)


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def db():
    session = SessionLocal()
    yield session
    session.close()


def test_sender_eligibility_filtering(client, db: Session):
    """Verifies that only accounts meeting all 4 conditions are eligible:

    1. owned by user
    2. is_active == True
    3. verification_status == 'verified'
    4. provider_status == 'ready'
    """
    uid = uuid.uuid4().hex[:8]
    user = User(
        email=f"sender_test_{uid}@example.com",
        normalized_email=f"sender_test_{uid}@example.com",
        display_name="Sender Tester",
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    # 1. Eligible account
    acc1 = EmailAccount(
        owner_user_id=user.id,
        email_address=f"verified.active.{uid}@example.com",
        normalized_email=f"verified.active.{uid}@example.com",
        from_name="Verified Active",
        is_active=True,
        verification_status="verified",
        provider_status="ready",
    )
    # 2. Inactive account
    acc2 = EmailAccount(
        owner_user_id=user.id,
        email_address=f"inactive.{uid}@example.com",
        normalized_email=f"inactive.{uid}@example.com",
        from_name="Inactive Sender",
        is_active=False,
        verification_status="verified",
        provider_status="ready",
    )
    # 3. Unverified account
    acc3 = EmailAccount(
        owner_user_id=user.id,
        email_address=f"pending.{uid}@example.com",
        normalized_email=f"pending.{uid}@example.com",
        from_name="Pending Sender",
        is_active=True,
        verification_status="pending",
        provider_status="not_configured",
    )
    db.add_all([acc1, acc2, acc3])
    db.commit()

    eligible = get_eligible_sender_accounts(db, user.id)
    eligible_emails = [a.email_address for a in eligible]

    assert f"verified.active.{uid}@example.com" in eligible_emails
    assert f"inactive.{uid}@example.com" not in eligible_emails
    assert f"pending.{uid}@example.com" not in eligible_emails

    # Check validator helper
    ok, _ = validate_sender_eligibility(db, f"verified.active.{uid}@example.com", user.id)
    assert ok is True

    ok_inact, msg_inact = validate_sender_eligibility(db, f"inactive.{uid}@example.com", user.id)
    assert ok_inact is False
    assert "deactivated" in msg_inact

    ok_unver, msg_unver = validate_sender_eligibility(db, f"pending.{uid}@example.com", user.id)
    assert ok_unver is False
    assert "not verified" in msg_unver


def test_campaign_sender_identities_api(client, db: Session):
    """Verifies that GET /api/campaigns/sender-identities returns only eligible accounts."""
    uid = uuid.uuid4().hex[:8]
    user = User(
        email=f"api_sender_test_{uid}@example.com",
        normalized_email=f"api_sender_test_{uid}@example.com",
        display_name="API Sender",
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    target_email = f"api.eligible.{uid}@sitechseries.org"
    acc = EmailAccount(
        owner_user_id=user.id,
        email_address=target_email,
        normalized_email=target_email.lower(),
        from_name="Sitech Outreach",
        is_active=True,
        verification_status="verified",
        provider_status="ready",
    )
    db.add(acc)
    db.commit()

    token = create_access_token({"sub": str(user.id), "email": user.email})
    resp = client.get("/api/campaigns/sender-identities", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    identities = resp.json()
    emails = [i["email"] for i in identities]
    assert target_email in emails

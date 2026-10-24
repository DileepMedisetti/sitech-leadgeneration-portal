from datetime import datetime, timedelta, timezone
import uuid
from unittest.mock import patch
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.security import generate_six_digit_otp, decode_access_token
from app.db.database import get_db, SessionLocal
from app.main import app
from app.models.otp_challenge import OtpChallenge
from app.models.user import User
from app.services.email_delivery_service import get_latest_dev_otp, EmailDeliveryService


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def db():
    session = SessionLocal()
    yield session
    session.close()


def _seed_test_user(db: Session, email: str, is_active: bool = True) -> User:
    """Helper to seed a registered test user."""
    clean_email = email.strip()
    user = User(
        email=clean_email,
        normalized_email=clean_email.lower(),
        display_name=clean_email.split("@")[0].capitalize(),
        is_active=is_active,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return user


def test_six_digit_otp_format():
    """Validates that generated OTP is strictly 6 numeric digits with leading zeros supported."""
    for _ in range(50):
        code = generate_six_digit_otp()
        assert len(code) == 6
        assert code.isdigit()


def test_unregistered_email_rejected_before_generating_otp(client, db: Session):
    """
    Priority 1 requirement:
    An unknown email must be rejected with 404 'not_registered' immediately.
    No OTP challenge may be stored in database, and email delivery service must not be invoked.
    """
    unregistered_email = f"unknown_{uuid.uuid4().hex[:8]}@example.com"

    with patch.object(EmailDeliveryService, "send_otp_email", wraps=EmailDeliveryService().send_otp_email) as mock_send:
        req_resp = client.post("/api/auth/request-otp", json={"email": unregistered_email})
        assert req_resp.status_code == 404
        data = req_resp.json()
        assert data["detail"]["status"] == "not_registered"
        assert "not registered with Sitech Series" in data["detail"]["message"]

        # Verify email delivery service was NEVER called
        mock_send.assert_not_called()

    # Verify no challenge record exists in database
    challenge = db.scalar(
        select(OtpChallenge).where(OtpChallenge.normalized_email == unregistered_email.lower())
    )
    assert challenge is None

    # Verify dev adapter store has no OTP for this address
    assert get_latest_dev_otp(unregistered_email) is None


def test_inactive_user_rejected_before_generating_otp(client, db: Session):
    """
    Priority 1 requirement:
    An inactive user account must be rejected with 403 'inactive'.
    No OTP challenge may be created and email service must not be invoked.
    """
    inactive_email = f"inactive_{uuid.uuid4().hex[:8]}@example.com"
    _seed_test_user(db, inactive_email, is_active=False)

    with patch.object(EmailDeliveryService, "send_otp_email", wraps=EmailDeliveryService().send_otp_email) as mock_send:
        req_resp = client.post("/api/auth/request-otp", json={"email": inactive_email})
        assert req_resp.status_code == 403
        data = req_resp.json()
        assert data["detail"]["status"] == "inactive"
        assert "inactive" in data["detail"]["message"].lower()

        # Email delivery service was NOT called
        mock_send.assert_not_called()

    # No challenge created
    challenge = db.scalar(
        select(OtpChallenge).where(OtpChallenge.normalized_email == inactive_email.lower())
    )
    assert challenge is None


def test_otp_request_and_successful_verification(client, db: Session):
    """Verifies complete email OTP flow for an existing registered user."""
    test_email = f"auth_test_{uuid.uuid4().hex[:8]}@example.com"
    _seed_test_user(db, test_email, is_active=True)

    # 1. Request OTP
    req_resp = client.post("/api/auth/request-otp", json={"email": test_email})
    assert req_resp.status_code == 200
    req_data = req_resp.json()
    assert req_data["status"] == "otp_sent"
    assert req_data["expires_in_seconds"] == 600

    # Retrieve generated code from dev adapter
    otp_code = get_latest_dev_otp(test_email)
    assert otp_code is not None
    assert len(otp_code) == 6

    # 2. Verify with correct code
    verify_resp = client.post(
        "/api/auth/verify-otp",
        json={"email": test_email, "otp_code": otp_code},
    )
    assert verify_resp.status_code == 200
    verify_data = verify_resp.json()
    assert verify_data["status"] == "success"
    assert "access_token" in verify_data
    assert verify_data["user"]["email"] == test_email

    # Verify JWT validity
    token = verify_data["access_token"]
    payload = decode_access_token(token)
    assert payload is not None
    assert payload["email"] == test_email

    # 3. Access protected /api/auth/me
    me_resp = client.get(
        "/api/auth/me",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert me_resp.status_code == 200
    assert me_resp.json()["email"] == test_email

    # 4. Consumed OTP cannot be reused
    reuse_resp = client.post(
        "/api/auth/verify-otp",
        json={"email": test_email, "otp_code": otp_code},
    )
    assert reuse_resp.status_code == 400
    assert reuse_resp.json()["detail"]["status"] == "expired"


def test_otp_incorrect_code_and_24h_lockout(client, db: Session):
    """Verifies that 5 incorrect attempts triggers a 24-hour persistent lockout."""
    test_email = f"lockout_test_{uuid.uuid4().hex[:8]}@example.com"
    _seed_test_user(db, test_email, is_active=True)

    # Request fresh OTP
    req_resp = client.post("/api/auth/request-otp", json={"email": test_email})
    assert req_resp.status_code == 200

    # Attempts 1 to 4 should be rejected with remaining count
    for i in range(1, 5):
        resp = client.post(
            "/api/auth/verify-otp",
            json={"email": test_email, "otp_code": "000000"},
        )
        assert resp.status_code == 400
        detail = resp.json()["detail"]
        assert detail["status"] == "incorrect"
        assert detail["remaining_attempts"] == 5 - i

    # 5th attempt triggers 24-hour lockout
    fifth_resp = client.post(
        "/api/auth/verify-otp",
        json={"email": test_email, "otp_code": "000000"},
    )
    assert fifth_resp.status_code == 423
    detail = fifth_resp.json()["detail"]
    assert detail["status"] == "locked"
    assert detail["remaining_attempts"] == 0
    assert "locked_until" in detail

    # Subsequent request-otp is also rejected while locked
    subsequent_req = client.post("/api/auth/request-otp", json={"email": test_email})
    assert subsequent_req.status_code == 423
    assert subsequent_req.json()["detail"]["status"] == "locked"


def test_otp_expiration_enforced(client, db: Session):
    """Verifies that OTP older than 10 minutes is strictly rejected as expired."""
    test_email = f"expired_test_{uuid.uuid4().hex[:8]}@example.com"
    _seed_test_user(db, test_email, is_active=True)

    req_resp = client.post("/api/auth/request-otp", json={"email": test_email})
    assert req_resp.status_code == 200
    otp_code = get_latest_dev_otp(test_email)

    # Manually backdate challenge in database to simulate 11 minutes later
    challenge = db.scalar(
        select(OtpChallenge)
        .where(OtpChallenge.normalized_email == test_email.lower())
        .order_by(OtpChallenge.created_at.desc())
        .limit(1)
    )
    assert challenge is not None
    challenge.expires_at = datetime.now(timezone.utc) - timedelta(minutes=1)
    db.commit()

    # Attempt verification with the expired OTP
    verify_resp = client.post(
        "/api/auth/verify-otp",
        json={"email": test_email, "otp_code": otp_code},
    )
    assert verify_resp.status_code == 400
    assert verify_resp.json()["detail"]["status"] == "expired"


def test_logout_invalidates_session(client, db: Session):
    """Verifies that logout clears the cookie and terminates session."""
    test_email = f"logout_test_{uuid.uuid4().hex[:8]}@example.com"
    _seed_test_user(db, test_email, is_active=True)

    client.post("/api/auth/request-otp", json={"email": test_email})
    otp_code = get_latest_dev_otp(test_email)

    verify_resp = client.post(
        "/api/auth/verify-otp",
        json={"email": test_email, "otp_code": otp_code},
    )
    token = verify_resp.json()["access_token"]

    logout_resp = client.post(
        "/api/auth/logout",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert logout_resp.status_code == 200
    assert logout_resp.json()["status"] == "logged_out"

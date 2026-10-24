import uuid
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.security import create_access_token
from app.db.database import SessionLocal
from app.main import app
from app.models.email_account import EmailAccount
from app.models.user import User
from app.services.email_delivery_service import get_latest_dev_otp


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def db():
    session = SessionLocal()
    yield session
    session.close()


def create_test_user(db: Session, email: str, name: str) -> tuple[User, str]:
    user = User(
        email=email,
        normalized_email=email.lower(),
        display_name=name,
        is_active=True,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_access_token({"sub": str(user.id), "email": user.email})
    return user, token


def test_authenticated_user_login_email_appears_in_email_accounts(client, db: Session):
    """Requirement 1: Authenticated user's primary login email must automatically appear in Email Accounts."""
    uid = uuid.uuid4().hex[:8]
    user_email = f"primary_login_{uid}@example.com"
    user, token = create_test_user(db, user_email, "Primary User")

    resp = client.get("/api/email-accounts", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code == 200
    accounts = resp.json()

    assert len(accounts) >= 1
    primary_acc = next((a for a in accounts if a["email_address"] == user_email), None)
    assert primary_acc is not None
    assert primary_acc["is_primary"] is True
    assert primary_acc["is_active"] is True
    assert primary_acc["verification_status"] == "verified"
    assert primary_acc["is_eligible_sender"] is True

    # Calling list again does NOT create duplicate records
    resp2 = client.get("/api/email-accounts", headers={"Authorization": f"Bearer {token}"})
    assert len(resp2.json()) == len(accounts)


def test_connect_new_email_flow_and_login_with_additional_email(client, db: Session):
    """Requirements 2 & 4: Adding a new email via ownership verification allows login to the same existing user."""
    uid = uuid.uuid4().hex[:8]
    user_email = f"user_{uid}@example.com"
    user, token = create_test_user(db, user_email, "Multi-Email User")
    auth_headers = {"Authorization": f"Bearer {token}"}

    new_email = f"secondary_{uid}@university.edu"

    # 1. Unverified new email cannot be used for login
    login_attempt_before = client.post("/api/auth/request-otp", json={"email": new_email})
    assert login_attempt_before.status_code == 404

    # 2. Initiate connection flow
    req_code_resp = client.post(
        "/api/email-accounts/connect/request-code",
        json={"email_address": new_email, "from_name": "Secondary Sender"},
        headers=auth_headers,
    )
    assert req_code_resp.status_code == 200
    assert req_code_resp.json()["status"] == "code_sent"

    # Retrieve dev verification OTP
    otp_code = get_latest_dev_otp(new_email)
    assert otp_code is not None

    # 3. Confirm connection with code
    confirm_resp = client.post(
        "/api/email-accounts/connect/verify-code",
        json={"email_address": new_email, "from_name": "Secondary Sender", "otp_code": otp_code},
        headers=auth_headers,
    )
    assert confirm_resp.status_code == 201
    connected_acc = confirm_resp.json()
    assert connected_acc["email_address"] == new_email
    assert connected_acc["is_primary"] is False
    assert connected_acc["verification_status"] == "verified"
    assert connected_acc["is_active"] is True

    # 4. Now user can log in using secondary email
    login_otp_req = client.post("/api/auth/request-otp", json={"email": new_email})
    assert login_otp_req.status_code == 200

    login_code = get_latest_dev_otp(new_email)
    login_verify_resp = client.post(
        "/api/auth/verify-otp",
        json={"email": new_email, "otp_code": login_code},
    )
    assert login_verify_resp.status_code == 200
    verify_data = login_verify_resp.json()

    # Crucial requirement: Must authenticate the SAME user ID, not create a second user
    assert verify_data["user"]["id"] == user.id
    assert verify_data["user"]["email"] == user.email


def test_deactivated_email_cannot_be_used_for_login(client, db: Session):
    """Requirements 3 & 4: Deactivated email cannot be used for login attempts."""
    uid = uuid.uuid4().hex[:8]
    user, token = create_test_user(db, f"deact_test_{uid}@example.com", "Deact User")
    auth_headers = {"Authorization": f"Bearer {token}"}

    sec_email = f"sec_deact_{uid}@example.com"
    client.post(
        "/api/email-accounts/connect/request-code",
        json={"email_address": sec_email, "from_name": "Sec"},
        headers=auth_headers,
    )
    otp = get_latest_dev_otp(sec_email)
    confirm_resp = client.post(
        "/api/email-accounts/connect/verify-code",
        json={"email_address": sec_email, "from_name": "Sec", "otp_code": otp},
        headers=auth_headers,
    )
    account_id = confirm_resp.json()["id"]

    # Deactivate secondary account
    deact_resp = client.post(f"/api/email-accounts/{account_id}/deactivate", headers=auth_headers)
    assert deact_resp.status_code == 200
    assert deact_resp.json()["is_active"] is False

    # Attempting OTP request on deactivated email must be rejected with 403
    login_attempt = client.post("/api/auth/request-otp", json={"email": sec_email})
    assert login_attempt.status_code == 403
    assert login_attempt.json()["detail"]["status"] == "deactivated"


def test_cannot_deactivate_sole_login_email(client, db: Session):
    """Requirement 3: Safeguard against deactivating the only viable login email."""
    uid = uuid.uuid4().hex[:8]
    user, token = create_test_user(db, f"sole_email_{uid}@example.com", "Sole User")
    auth_headers = {"Authorization": f"Bearer {token}"}

    # Fetch accounts so primary is populated
    list_resp = client.get("/api/email-accounts", headers=auth_headers)
    primary_acc = list_resp.json()[0]

    # Trying to deactivate the only email must be rejected with 400
    deact_resp = client.post(f"/api/email-accounts/{primary_acc['id']}/deactivate", headers=auth_headers)
    assert deact_resp.status_code == 400
    assert "at least one active, verified email" in deact_resp.json()["detail"]


def test_deleted_accounts_list_restore_and_permanent_delete(client, db: Session):
    """Requirements 6, 7 & 8: Deleted Accounts page, restoration, and permanent deletion."""
    uid = uuid.uuid4().hex[:8]
    user_a, token_a = create_test_user(db, f"del_user_a_{uid}@example.com", "User A")
    user_b, token_b = create_test_user(db, f"del_user_b_{uid}@example.com", "User B")
    headers_a = {"Authorization": f"Bearer {token_a}"}
    headers_b = {"Authorization": f"Bearer {token_b}"}

    sec_email = f"archived_sec_{uid}@example.com"
    client.post("/api/email-accounts/connect/request-code", json={"email_address": sec_email, "from_name": "Sec"}, headers=headers_a)
    otp = get_latest_dev_otp(sec_email)
    sec_acc = client.post("/api/email-accounts/connect/verify-code", json={"email_address": sec_email, "from_name": "Sec", "otp_code": otp}, headers=headers_a).json()
    account_id = sec_acc["id"]

    # 1. Soft-delete (archive)
    del_resp = client.delete(f"/api/email-accounts/{account_id}", headers=headers_a)
    assert del_resp.status_code == 200

    # Removed from active list
    active_list = client.get("/api/email-accounts", headers=headers_a).json()
    assert all(a["id"] != account_id for a in active_list)

    # 2. Appears in Deleted Accounts
    deleted_list = client.get("/api/email-accounts/deleted", headers=headers_a).json()
    assert any(a["id"] == account_id for a in deleted_list)

    # User B cannot see User A's deleted accounts
    b_deleted = client.get("/api/email-accounts/deleted", headers=headers_b).json()
    assert all(a["id"] != account_id for a in b_deleted)

    # User B cannot restore User A's deleted account
    b_restore = client.post(f"/api/email-accounts/{account_id}/restore", headers=headers_b)
    assert b_restore.status_code in (403, 404)

    # 3. User A restores account
    restore_resp = client.post(f"/api/email-accounts/{account_id}/restore", headers=headers_a)
    assert restore_resp.status_code == 200
    restored = restore_resp.json()
    assert restored["archived_at"] is None
    assert restored["is_active"] is False  # Safe inactive default

    # Back in active list
    active_after = client.get("/api/email-accounts", headers=headers_a).json()
    assert any(a["id"] == account_id for a in active_after)

    # 4. Archive again, then permanently delete
    client.delete(f"/api/email-accounts/{account_id}", headers=headers_a)
    perm_del_resp = client.delete(f"/api/email-accounts/{account_id}/permanent", headers=headers_a)
    assert perm_del_resp.status_code == 200
    assert perm_del_resp.json()["status"] == "permanently_deleted"

    # Completely gone from deleted accounts
    deleted_after = client.get("/api/email-accounts/deleted", headers=headers_a).json()
    assert all(a["id"] != account_id for a in deleted_after)


def test_cross_user_global_email_uniqueness_checks(client, db: Session):
    """Additional Master Requirement: Global email-ownership validation across all users."""
    uid = uuid.uuid4().hex[:8]
    dileep_email = f"dileep_{uid}@example.com"
    dileep, token_dileep = create_test_user(db, dileep_email, "Dileep")
    headers_dileep = {"Authorization": f"Bearer {token_dileep}"}

    mohan, token_mohan = create_test_user(db, f"mohan_{uid}@example.com", "Mohan")
    headers_mohan = {"Authorization": f"Bearer {token_mohan}"}

    # Scenario A: Mohan tries to add Dileep's registered login email
    resp_a = client.post(
        "/api/email-accounts/connect/request-code",
        json={"email_address": dileep_email, "from_name": "Mohan"},
        headers=headers_mohan,
    )
    assert resp_a.status_code == 409
    detail_a = resp_a.json()["detail"]
    assert detail_a["status"] == "email_in_use"
    assert "already in use by another account" in detail_a["message"]

    # Connect a secondary email to Dileep
    dileep_sec = f"dileep.lab_{uid}@example.com"
    client.post("/api/email-accounts/connect/request-code", json={"email_address": dileep_sec, "from_name": "Lab"}, headers=headers_dileep)
    otp = get_latest_dev_otp(dileep_sec)
    dileep_sec_acc = client.post("/api/email-accounts/connect/verify-code", json={"email_address": dileep_sec, "from_name": "Lab", "otp_code": otp}, headers=headers_dileep).json()

    # Mohan tries to add Dileep's connected email (even with extra spaces / uppercase)
    resp_b = client.post(
        "/api/email-accounts/connect/request-code",
        json={"email_address": f"  {dileep_sec.upper()}  ", "from_name": "Mohan"},
        headers=headers_mohan,
    )
    assert resp_b.status_code == 409
    assert resp_b.json()["detail"]["status"] == "email_in_use"

    # Scenario B: Dileep deactivates the secondary email. Mohan still cannot claim it.
    client.post(f"/api/email-accounts/{dileep_sec_acc['id']}/deactivate", headers=headers_dileep)
    resp_deact = client.post(
        "/api/email-accounts/connect/request-code",
        json={"email_address": dileep_sec, "from_name": "Mohan"},
        headers=headers_mohan,
    )
    assert resp_deact.status_code == 409
    assert resp_deact.json()["detail"]["status"] == "email_in_use"

    # Scenario C: Dileep archives the secondary email. Mohan still cannot claim it.
    client.delete(f"/api/email-accounts/{dileep_sec_acc['id']}", headers=headers_dileep)
    resp_arch = client.post(
        "/api/email-accounts/connect/request-code",
        json={"email_address": dileep_sec, "from_name": "Mohan"},
        headers=headers_mohan,
    )
    assert resp_arch.status_code == 409
    assert resp_arch.json()["detail"]["status"] == "email_in_use"

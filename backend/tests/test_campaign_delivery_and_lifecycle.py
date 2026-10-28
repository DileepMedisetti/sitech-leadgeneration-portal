from datetime import datetime, timedelta, timezone
import uuid
import pytest
from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.core.security import create_access_token
from app.db.database import SessionLocal
from app.main import app
from app.models.campaign import (
    Campaign,
    CampaignAudienceList,
    CampaignContent,
    CampaignRecipientSnapshot,
    CampaignReply,
)
from app.models.contact_list import ContactList, ContactListMember
from app.models.email_account import EmailAccount
from app.models.lead import Lead
from app.models.user import User
from app.services.campaign_gate_service import (
    dispatch_campaign_messages,
    process_due_scheduled_campaigns,
)
from app.services.campaign_tracking_service import ingest_inbound_reply
from app.services.email_delivery_service import (
    clear_dispatched_campaign_messages,
    get_dispatched_campaign_messages,
)


@pytest.fixture
def client():
    return TestClient(app)


@pytest.fixture
def db():
    session = SessionLocal()
    yield session
    session.close()


def create_user_and_token(db: Session, email: str, name: str) -> tuple[User, str]:
    user = db.query(User).filter(User.normalized_email == email.lower()).first()
    if not user:
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


def create_verified_email_account(
    db: Session, user: User, email: str, reply_to: str | None = None, receiver_email: str | None = None
) -> EmailAccount:
    acc = db.query(EmailAccount).filter(EmailAccount.normalized_email == email.lower()).first()
    if not acc:
        acc = EmailAccount(
            email_address=email,
            normalized_email=email.lower(),
            from_name=user.display_name,
            reply_to=reply_to,
            receiver_name="Conference Replies",
            receiver_email=receiver_email or reply_to or email,
            provider="smtp",
            is_active=True,
            verification_status="verified",
            provider_status="ready",
            owner_user_id=user.id,
        )
        db.add(acc)
    else:
        acc.owner_user_id = user.id
        acc.is_active = True
        acc.verification_status = "verified"
        acc.provider_status = "ready"
        acc.reply_to = reply_to
        acc.receiver_email = receiver_email or reply_to or email
        acc.archived_at = None
    db.commit()
    db.refresh(acc)
    return acc


def test_automatic_reply_to_and_receiver_population(client, db: Session):
    """Verifies that selecting an EmailAccount automatically defaults reply_to and receiver info."""
    uid = uuid.uuid4().hex[:6]
    user, token = create_user_and_token(db, f"sender_{uid}@sitechseries.org", "Sender User")
    account = create_verified_email_account(
        db,
        user,
        f"outreach_{uid}@sitechseries.org",
        reply_to=f"replies_{uid}@sitechseries.org",
        receiver_email=f"receiver_{uid}@sitechseries.org",
    )

    create_payload = {
        "name": f"Reply-To Auto Test {uid}",
        "description": "Testing automatic reply-to and receiver defaults",
        "email_account_id": account.id,
        "content": {
            "subject": "Symposium Invitation",
            "html_content": "<p>Hello {{name}}</p><p><a href='{{unsubscribe_url}}'>Unsubscribe</a></p>",
            "plain_text": "Hello {{name}}\nUnsubscribe: {{unsubscribe_url}}",
        },
    }

    resp = client.post(
        "/api/campaigns",
        json=create_payload,
        headers={"Authorization": f"Bearer {token}"},
    )
    assert resp.status_code == 201, resp.text
    camp_id = resp.json()["id"]

    # Verify campaign content saved with resolved reply_to and receiver_email
    detail_res = client.get(
        f"/api/campaigns/{camp_id}",
        headers={"Authorization": f"Bearer {token}"},
    )
    assert detail_res.status_code == 200
    detail = detail_res.json()
    assert detail["content"]["from_email"] == account.email_address
    assert detail["content"]["reply_to"] == account.reply_to
    assert detail["content"]["receiver_email"] == account.receiver_email


def test_real_email_delivery_invokes_sender_account_and_records_provider_id(db: Session):
    """Verifies that dispatch actually runs delivery adapter, injects headers, and stores provider IDs."""
    clear_dispatched_campaign_messages()

    uid = uuid.uuid4().hex[:6]
    user, _ = create_user_and_token(db, f"prof_{uid}@sitechseries.org", "Dr. Test")
    account = create_verified_email_account(
        db,
        user,
        f"prof_{uid}@sitechseries.org",
        reply_to=f"chair_{uid}@sitechseries.org",
    )

    # Create campaign
    camp = Campaign(
        name=f"Real Delivery Test {uid}",
        owner_user_id=user.id,
        email_account_id=account.id,
        status="sending",
    )
    db.add(camp)
    db.flush()

    content = CampaignContent(
        campaign_id=camp.id,
        version=1,
        content_fingerprint="fp123",
        subject="Call for Papers 2026",
        from_name="Dr. Test",
        from_email=account.email_address,
        reply_to=account.reply_to,
        receiver_email=account.receiver_email,
        html_content="<p>Dear {{name}}, join our panel.</p><p><a href='{{unsubscribe_url}}'>Unsubscribe</a></p>",
        plain_text="Dear {{name}}, join our panel.\nUnsubscribe: {{unsubscribe_url}}",
    )
    db.add(content)

    lead = Lead(
        name="Dr. Alan Turing",
        email=f"turing_{uid}@example.com",
        qualification_status="qualified",
    )
    db.add(lead)
    db.flush()

    snap = CampaignRecipientSnapshot(
        campaign_id=camp.id,
        lead_id=lead.id,
        normalized_email=lead.email.lower(),
        name=lead.name,
        status="pending",
    )
    db.add(snap)
    db.commit()

    # Execute real dispatch
    dispatched_camp = dispatch_campaign_messages(db, camp.id)
    db.commit()

    assert dispatched_camp.status == "sent"
    assert dispatched_camp.sent_count == 1

    # Verify recipient snapshot received real delivery record
    db.refresh(snap)
    assert snap.status in {"sent", "delivered"}
    assert snap.provider_message_id is not None
    assert snap.provider_message_id.startswith("<") and snap.provider_message_id.endswith(">")
    assert snap.dispatch_attempt_at is not None

    # Verify the message recorded in dev dispatched cache has proper headers
    messages = get_dispatched_campaign_messages()
    assert len(messages) >= 1
    last_msg = messages[-1]
    assert last_msg["to_email"] == f"turing_{uid}@example.com"
    assert last_msg["reply_to"] == f"chair_{uid}@sitechseries.org"
    assert last_msg["from_email"] == account.email_address
    assert "Call for Papers 2026" in last_msg["subject"]
    assert "Dear Dr. Alan Turing" in last_msg["body_html"]


def test_multi_tenant_campaign_ownership_isolation(client, db: Session):
    """Enforces that User B cannot access, update, launch, or delete User A's campaign."""
    uid = uuid.uuid4().hex[:6]
    user_a, token_a = create_user_and_token(db, f"usera_{uid}@sitechseries.org", "User A")
    user_b, token_b = create_user_and_token(db, f"userb_{uid}@sitechseries.org", "User B")

    # User A creates a campaign
    create_res = client.post(
        "/api/campaigns",
        json={"name": f"User A Private Campaign {uid}"},
        headers={"Authorization": f"Bearer {token_a}"},
    )
    assert create_res.status_code == 201
    camp_id = create_res.json()["id"]

    # User B attempts to view User A's campaign -> 403 Forbidden
    get_res = client.get(
        f"/api/campaigns/{camp_id}",
        headers={"Authorization": f"Bearer {token_b}"},
    )
    assert get_res.status_code == 403, get_res.text

    # User B attempts to update User A's campaign -> 403 Forbidden
    patch_res = client.patch(
        f"/api/campaigns/{camp_id}",
        json={"name": "Hacked Name"},
        headers={"Authorization": f"Bearer {token_b}"},
    )
    assert patch_res.status_code == 403

    # User B attempts to delete User A's campaign -> 403 Forbidden
    del_res = client.delete(
        f"/api/campaigns/{camp_id}",
        headers={"Authorization": f"Bearer {token_b}"},
    )
    assert del_res.status_code == 403

    # User B attempts to view User A's report -> 403 Forbidden
    report_res = client.get(
        f"/api/campaigns/{camp_id}/report",
        headers={"Authorization": f"Bearer {token_b}"},
    )
    assert report_res.status_code == 403

    # User B attempts to view User A's replies -> 403 Forbidden
    replies_res = client.get(
        f"/api/campaigns/{camp_id}/replies",
        headers={"Authorization": f"Bearer {token_b}"},
    )
    assert replies_res.status_code == 403

    # User A can view and manage their own campaign
    own_res = client.get(
        f"/api/campaigns/{camp_id}",
        headers={"Authorization": f"Bearer {token_a}"},
    )
    assert own_res.status_code == 200


def test_inbound_reply_matching_and_idempotency(db: Session):
    """Verifies reply matching by In-Reply-To and ensures repeated webhook deliveries are idempotent."""
    uid = uuid.uuid4().hex[:6]
    user, _ = create_user_and_token(db, f"chair_{uid}@sitechseries.org", "Session Chair")

    camp = Campaign(
        name=f"Reply Test Campaign {uid}",
        owner_user_id=user.id,
        status="sent",
        replied_count=0,
    )
    db.add(camp)
    db.flush()

    provider_id = f"<outreach.{camp.id}.{uid}@sitechseries.org>"
    snap = CampaignRecipientSnapshot(
        campaign_id=camp.id,
        normalized_email=f"scholar_{uid}@example.com",
        name="Scholar Jane",
        status="sent",
        provider_message_id=provider_id,
        dispatch_attempt_at=datetime.now(timezone.utc),
    )
    db.add(snap)
    db.commit()

    inbound_payload = {
        "sender_email": f"scholar_{uid}@example.com",
        "recipient_email": "chair@sitechseries.org",
        "subject": "Re: Symposium Invitation",
        "body_snippet": "I would be honored to attend the conference as a speaker.",
        "message_id": f"<incoming.reply.{uid}@mail.example.com>",
        "in_reply_to": provider_id,
    }

    # First delivery
    res1 = ingest_inbound_reply(db, inbound_payload)
    assert res1["matched"] is True
    assert res1["match_type"] == "in_reply_to"
    assert res1["campaign_id"] == camp.id
    assert res1.get("duplicate") is not True

    db.refresh(camp)
    assert camp.replied_count == 1

    # Second delivery with the SAME message_id (e.g. webhook retry)
    res2 = ingest_inbound_reply(db, inbound_payload)
    assert res2["matched"] is True
    assert res2.get("duplicate") is True
    assert res2["match_type"] == "duplicate_idempotent"

    # Counter should not be incremented twice
    db.refresh(camp)
    assert camp.replied_count == 1


def test_scheduled_campaign_worker_claiming_and_dispatch(db: Session):
    """Verifies that future scheduled campaigns are preserved, and due campaigns are claimed and sent."""
    clear_dispatched_campaign_messages()

    uid = uuid.uuid4().hex[:6]
    user, _ = create_user_and_token(db, f"scheduler_{uid}@sitechseries.org", "Scheduler User")
    account = create_verified_email_account(db, user, f"schedule_sender_{uid}@sitechseries.org")

    now = datetime.now(timezone.utc)

    # 1. Future campaign: scheduled 2 hours in the future
    future_camp = Campaign(
        name=f"Future Campaign {uid}",
        owner_user_id=user.id,
        email_account_id=account.id,
        status="scheduled",
        scheduled_at=now + timedelta(hours=2),
    )
    db.add(future_camp)

    # 2. Due campaign: scheduled 5 minutes ago
    due_camp = Campaign(
        name=f"Due Campaign {uid}",
        owner_user_id=user.id,
        email_account_id=account.id,
        status="scheduled",
        scheduled_at=now - timedelta(minutes=5),
    )
    db.add(due_camp)
    db.flush()

    content = CampaignContent(
        campaign_id=due_camp.id,
        version=1,
        content_fingerprint="fp_due",
        subject="Scheduled Outreach Now Due",
        from_name="Scheduler User",
        from_email=account.email_address,
        reply_to=account.reply_to,
        html_content="<p>Scheduled greetings {{name}}</p><p><a href='{{unsubscribe_url}}'>Unsubscribe</a></p>",
        plain_text="Scheduled greetings {{name}}\nUnsubscribe: {{unsubscribe_url}}",
    )
    db.add(content)

    snap = CampaignRecipientSnapshot(
        campaign_id=due_camp.id,
        normalized_email=f"recipient_due_{uid}@example.com",
        name="Due Recipient",
        status="pending",
    )
    db.add(snap)
    db.commit()

    # Run the scheduler worker scan
    claimed_ids = process_due_scheduled_campaigns(db, max_campaigns=10)
    db.commit()

    # The due campaign should be claimed and sent
    assert due_camp.id in claimed_ids
    assert future_camp.id not in claimed_ids

    db.refresh(due_camp)
    assert due_camp.status == "sent"
    assert due_camp.sent_count == 1

    db.refresh(future_camp)
    assert future_camp.status == "scheduled"


def test_campaign_pause_and_resume_lifecycle(client, db: Session):
    """Verifies pausing prevents pending dispatch, and resuming safely reactivates the campaign."""
    uid = uuid.uuid4().hex[:6]
    user, token = create_user_and_token(db, f"lifecycle_{uid}@sitechseries.org", "Lifecycle User")

    camp = Campaign(
        name=f"Lifecycle Test {uid}",
        owner_user_id=user.id,
        status="draft",
    )
    db.add(camp)
    db.commit()

    headers = {"Authorization": f"Bearer {token}"}

    # Transition to scheduled
    camp.status = "scheduled"
    camp.scheduled_at = datetime.now(timezone.utc) + timedelta(hours=1)
    db.commit()

    # Pause campaign
    pause_res = client.post(f"/api/campaigns/{camp.id}/pause", headers=headers)
    assert pause_res.status_code == 200
    assert pause_res.json()["status"] == "paused"

    # Resume campaign
    resume_res = client.post(f"/api/campaigns/{camp.id}/resume", headers=headers)
    assert resume_res.status_code == 200
    assert resume_res.json()["status"] == "scheduled"

    # Cancel campaign
    cancel_res = client.post(f"/api/campaigns/{camp.id}/cancel", headers=headers)
    assert cancel_res.status_code == 200
    assert cancel_res.json()["status"] == "cancelled"


def test_campaign_recipient_unsubscribe_endpoint(client, db: Session):
    """Verifies that visiting the unsubscribe endpoint suppresses the recipient and updates counts."""
    uid = uuid.uuid4().hex[:6]
    user, _ = create_user_and_token(db, f"optout_{uid}@sitechseries.org", "Optout User")

    camp = Campaign(
        name=f"Unsubscribe Test {uid}",
        owner_user_id=user.id,
        status="sent",
        unsubscribed_count=0,
    )
    db.add(camp)
    db.flush()

    lead = Lead(
        name="Dr. Opt Out",
        email=f"optout_{uid}@example.com",
        qualification_status="qualified",
    )
    db.add(lead)
    db.flush()

    snap = CampaignRecipientSnapshot(
        campaign_id=camp.id,
        lead_id=lead.id,
        normalized_email=lead.email.lower(),
        name=lead.name,
        status="sent",
    )
    db.add(snap)
    db.commit()

    # Hit the public unsubscribe link
    resp = client.get(f"/api/campaigns/{camp.id}/unsubscribe?s={snap.id}")
    assert resp.status_code == 200
    assert "You have been unsubscribed" in resp.text

    # Verify recipient snapshot status changed to suppressed
    db.refresh(snap)
    assert snap.status == "suppressed"
    assert "unsubscribed" in snap.error_message.lower()

    # Verify campaign count incremented
    db.refresh(camp)
    assert camp.unsubscribed_count == 1

    # Verify lead qualification was updated
    db.refresh(lead)
    assert lead.qualification_status == "unqualified"

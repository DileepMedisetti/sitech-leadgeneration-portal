import io
import uuid
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.db.database import get_db
from app.models.campaign import Campaign, CampaignContent, CampaignRecipientSnapshot
from app.models.contact_list import ContactList, ContactListMember
from app.models.lead import Lead
from app.models.email_account import EmailAccount
from app.models.user import User

client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_test_environment():
    db = next(get_db())
    try:
        user = db.query(User).filter(User.email == "test_curator@sitechseries.org").first()
        if not user:
            user = User(
                email="test_curator@sitechseries.org",
                normalized_email="test_curator@sitechseries.org",
                display_name="Test Curator",
                is_active=True,
            )
            db.add(user)
            db.commit()
            db.refresh(user)

        acc = db.query(EmailAccount).filter(EmailAccount.normalized_email == "test_curator@sitechseries.org").first()
        if not acc:
            acc = EmailAccount(
                email_address="test_curator@sitechseries.org",
                normalized_email="test_curator@sitechseries.org",
                from_name="Test Curator",
                provider="smtp",
                is_active=True,
                verification_status="verified",
                provider_status="ready",
                owner_user_id=user.id,
            )
            db.add(acc)
            db.commit()

        from app.core.security import create_access_token
        token = create_access_token({"sub": str(user.id), "email": user.email})
        client.headers["Authorization"] = f"Bearer {token}"
    finally:
        db.close()



def test_custom_audience_list_creation_and_duplicate_prevention():
    uid = uuid.uuid4().hex[:6]
    email1 = f"prof.albert.{uid}@example.com"
    email2 = f"dr.marie.{uid}@example.com"

    payload = {
        "name": f"AI Ethics Committee {uid}",
        "description": "Custom selected academic faculty",
        "list_type": "custom",
        "contacts": [
            {
                "name": "Prof. Albert Vance",
                "email": email1,
                "profession": "Professor of AI",
                "university": "Cambridge University",
                "country": "United Kingdom",
            },
            {
                "name": "Dr. Marie Curie",
                "email": email2,
                "profession": "Lead Researcher",
                "university": "Sorbonne",
                "country": "France",
            },
        ],
    }

    res = client.post("/api/audience/lists", json=payload)
    assert res.status_code == 201, res.text
    data = res.json()
    assert data["name"] == payload["name"]
    assert data["list_type"] == "custom"
    assert data["contact_count"] == 2

    # Verify idempotency when creating another list with overlapping email
    payload2 = {
        "name": f"Robotics Reviewers {uid}",
        "list_type": "custom",
        "contacts": [
            {
                "name": "Prof. Albert Vance",
                "email": email1,  # existing email
                "profession": "Professor of AI",
                "university": "Cambridge University",
                "country": "United Kingdom",
            },
            {
                "name": "Dr. Alan Turing",
                "email": f"a.turing.{uid}@example.com",
                "profession": "Cryptanalyst",
                "university": "Manchester",
                "country": "United Kingdom",
            },
        ],
    }
    res2 = client.post("/api/audience/lists", json=payload2)
    assert res2.status_code == 201
    assert res2.json()["contact_count"] == 2


def test_contact_file_validation_endpoint():
    # Build CSV with synonyms and some invalid / duplicate rows
    csv_content = (
        "Full Name,Email Address,Job Title,Institution,Nation\r\n"
        "Alice Smith,alice.smith@university.edu,Professor,MIT,United States\r\n"
        "Bob Jones,bob.jones@lab.org,Director,CERN,Switzerland\r\n"
        "Invalid User,not-an-email,Student,Unknown,Nowhere\r\n"
        "Alice Duplicate,alice.smith@university.edu,Professor,MIT,United States\r\n"
    )

    files = {
        "file": ("contacts_test.csv", io.BytesIO(csv_content.encode("utf-8")), "text/csv")
    }

    res = client.post("/api/audience/import-contacts/validate", files=files)
    assert res.status_code == 200, res.text
    result = res.json()

    assert result["total_rows"] == 4
    assert result["valid_count"] == 2
    assert result["invalid_count"] == 1
    assert result["duplicate_count"] == 1

    # Check partitioned rows
    assert len(result["valid_contacts"]) == 2
    assert result["valid_contacts"][0]["email"] == "alice.smith@university.edu"
    assert "Invalid email" in result["invalid_rows"][0]["reason"]
    assert "Duplicate email" in result["duplicate_rows"][0]["reason"]


def test_campaign_audience_dispatch_and_report_lifecycle():
    uid = uuid.uuid4().hex[:6]
    contact_email = f"lead.recipient.{uid}@example.com"

    # 1. Create custom audience list
    list_payload = {
        "name": f"Symposium Keynotes {uid}",
        "list_type": "custom",
        "contacts": [
            {
                "name": "Dr. Rosalind Franklin",
                "email": contact_email,
                "profession": "Biophysicist",
                "university": "King's College London",
                "country": "United Kingdom",
            }
        ],
    }
    list_res = client.post("/api/audience/lists", json=list_payload)
    assert list_res.status_code == 201
    list_id = list_res.json()["id"]

    # 2. Create campaign draft with compliant content
    camp_res = client.post(
        "/api/campaigns",
        json={
            "name": f"Keynote Invitation {uid}",
            "description": "Exclusive invitation to keynote the Sitech series",
            "content": {
                "subject": "Invitation to Keynote Sitech 2026",
                "preview_text": "We would be honored to host your keynote presentation.",
                "from_name": "Symposium Committee",
                "from_email": "test_curator@sitechseries.org",
                "reply_to": "test_curator@sitechseries.org",
                "html_content": "<p>Dear Dr. Franklin, please join our symposium.</p><p><a href='{{unsubscribe_url}}'>Unsubscribe</a></p>",
                "plain_text": "Dear Dr. Franklin,\nPlease join our symposium.\nSitech Series, Cambridge, MA\nUnsubscribe: {{unsubscribe_url}}",
            },
        },
    )
    assert camp_res.status_code == 201
    camp_id = camp_res.json()["id"]

    # 3. Attach custom audience to campaign
    aud_res = client.post(
        f"/api/campaigns/{camp_id}/audience",
        json={"contact_list_ids": [list_id]},
    )
    assert aud_res.status_code == 200
    aud_data = aud_res.json()
    assert aud_data["eligible_contacts"] == 1
    assert aud_data["unique_contacts"] == 1

    # 4. Run deliverability analysis (required preflight step)
    client.post(f"/api/deliverability/campaigns/{camp_id}/analyze")

    # 5. Launch campaign immediately
    dispatch_res = client.post(
        f"/api/campaigns/{camp_id}/launch",
        json={"send_immediately": True, "confirmed": True, "bypass_warnings": True},
    )
    assert dispatch_res.status_code == 200, dispatch_res.text
    dispatch_data = dispatch_res.json()
    assert dispatch_data["status"] == "sent"
    assert dispatch_data["delivered_count"] == 1

    # 6. Get initial campaign report
    rep_res = client.get(f"/api/campaigns/{camp_id}/report")
    assert rep_res.status_code == 200
    rep = rep_res.json()
    assert rep["campaign_name"] == f"Keynote Invitation {uid}"
    assert rep["metrics"]["emails_attempted"] == 1
    assert rep["metrics"]["delivered_messages"] == 1
    assert rep["metrics"]["unique_opens"] == 0
    assert rep["metrics"]["unique_clickers"] == 0
    assert rep["metrics"]["replies_received"] == 0
    assert rep["metrics"]["open_rate"] == 0.0
    assert rep["metrics"]["click_rate"] == 0.0
    assert rep["metrics"]["bounce_rate"] == 0.0
    assert rep["metric_availability"]["spam_complaints"] is False
    assert rep["metric_availability"]["deferred_messages"] is False

    # 7. Retrieve recipient snapshot ID
    rec_res = client.get(f"/api/campaigns/{camp_id}/report/recipients")
    assert rec_res.status_code == 200
    rec_data = rec_res.json()
    assert rec_data["total"] == 1
    recipient = rec_data["items"][0]
    snapshot_id = recipient["id"]
    provider_msg_id = recipient["provider_message_id"]
    assert provider_msg_id is not None

    # 8. Test open tracking pixel
    open_res = client.get(f"/api/campaigns/{camp_id}/track/open/{snapshot_id}")
    assert open_res.status_code == 200
    assert open_res.headers["content-type"] == "image/gif"
    assert len(open_res.content) == 43  # 1x1 transparent GIF

    # Verify open registered in report
    rep_after_open = client.get(f"/api/campaigns/{camp_id}/report").json()
    assert rep_after_open["metrics"]["unique_opens"] == 1
    assert rep_after_open["metrics"]["open_rate"] == 100.0

    # 9. Test click tracking redirect
    target_url = "https://sitechseries.org/keynotes/confirm"
    click_res = client.get(
        f"/api/campaigns/{camp_id}/track/click/{snapshot_id}",
        params={"url": target_url},
        follow_redirects=False,
    )
    assert click_res.status_code in (302, 307)
    assert click_res.headers["location"] == target_url

    # Verify click registered in report
    rep_after_click = client.get(f"/api/campaigns/{camp_id}/report").json()
    assert rep_after_click["metrics"]["unique_clickers"] == 1
    assert rep_after_click["metrics"]["click_rate"] == 100.0

    # 10. Test inbound reply ingestion (matching by provider_message_id In-Reply-To)
    reply_payload = {
        "campaign_id": camp_id,
        "sender_email": contact_email,
        "subject": "Re: Invitation to Keynote Sitech 2026",
        "body": "Thank you for the invitation. I would be delighted to accept and present our recent findings.",
        "in_reply_to": provider_msg_id,
    }
    reply_res = client.post("/api/campaigns/inbound-reply", json=reply_payload)
    assert reply_res.status_code == 200, reply_res.text
    reply_result = reply_res.json()
    assert reply_result["matched"] is True
    assert reply_result["match_type"] == "in_reply_to"
    assert reply_result["recipient_snapshot_id"] == snapshot_id

    # 11. Verify updated report reflects the reply
    rep_after_reply = client.get(f"/api/campaigns/{camp_id}/report").json()
    assert rep_after_reply["metrics"]["replies_received"] == 1

    # 12. Test recipients table search and filtering
    filtered_rec = client.get(
        f"/api/campaigns/{camp_id}/report/recipients",
        params={"status": "replied", "search": "Rosalind"},
    ).json()
    assert filtered_rec["total"] == 1
    assert filtered_rec["items"][0]["reply_status"] == "Replied"
    assert "delighted to accept" in filtered_rec["items"][0]["reply_snippet"]

    # 13. Test CSV export endpoint
    csv_res = client.get(f"/api/campaigns/{camp_id}/report/export")
    assert csv_res.status_code == 200
    assert "text/csv" in csv_res.headers["content-type"]
    assert "Rosalind" in csv_res.text
    assert contact_email in csv_res.text
    assert "Replied" in csv_res.text


def test_dual_list_creation_options_and_campaign_integration():
    """Explicitly verifies the two distinct audience list creation options:
    - Test A: Custom List (manual entry + spreadsheet import validation)
    - Test B: Existing Data (browse eligible leads + create list from existing records)
    - Test C: Campaign Integration (attach both lists, deduplicate recipients, and launch)
    """
    uid = uuid.uuid4().hex[:6]

    # -------------------------------------------------------------------------
    # TEST B: Existing Data — Use Discovered Leads Already in Database
    # -------------------------------------------------------------------------
    db = next(get_db())
    try:
        # Ensure we have existing qualified leads in database
        lead_a = Lead(
            name="Prof. Arthur Vance",
            email=f"existing.a.{uid}@stanford.edu",
            profession="Full Professor",
            university="Stanford University",
            country="United States",
            qualification_status="qualified",
            confidence_score=0.95,
        )
        lead_b = Lead(
            name="Dr. Eleanor Bennett",
            email=f"existing.b.{uid}@oxford.ac.uk",
            profession="Associate Professor",
            university="Oxford University",
            country="United Kingdom",
            qualification_status="qualified",
            confidence_score=0.92,
        )
        db.add(lead_a)
        db.add(lead_b)
        db.commit()
        db.refresh(lead_a)
        db.refresh(lead_b)
        lead_a_id = lead_a.id
        lead_b_id = lead_b.id
    finally:
        db.close()

    # 1. Query existing eligible leads
    contacts_res = client.get("/api/audience/contacts", params={"search": uid})
    assert contacts_res.status_code == 200
    contacts_data = contacts_res.json()
    assert contacts_data["total"] >= 2
    returned_ids = [c["id"] for c in contacts_data["items"]]
    assert lead_a_id in returned_ids
    assert lead_b_id in returned_ids

    # 2. Create list using Existing Data (Option 2)
    existing_list_payload = {
        "name": f"Stanford & Oxford Leaders {uid}",
        "description": "Created from existing eligible database leads",
        "list_type": "generated",
        "lead_ids": [lead_a_id, lead_b_id],
    }
    create_existing_res = client.post("/api/audience/lists", json=existing_list_payload)
    assert create_existing_res.status_code == 201, create_existing_res.text
    existing_list = create_existing_res.json()
    existing_list_id = existing_list["id"]
    assert existing_list["name"] == existing_list_payload["name"]
    assert existing_list["list_type"] == "generated"
    assert existing_list["contact_count"] == 2

    # 3. Reopen Existing Data list and verify contacts and persistence
    reopen_existing = client.get(f"/api/audience/lists/{existing_list_id}")
    assert reopen_existing.status_code == 200
    assert reopen_existing.json()["contact_count"] == 2
    assert reopen_existing.json()["list_type"] == "generated"

    members_existing = client.get(f"/api/audience/lists/{existing_list_id}/contacts")
    assert members_existing.status_code == 200
    member_emails = [m["email"] for m in members_existing.json()["items"]]
    assert f"existing.a.{uid}@stanford.edu" in member_emails
    assert f"existing.b.{uid}@oxford.ac.uk" in member_emails

    # -------------------------------------------------------------------------
    # TEST A: Custom List — Create Manually & Import
    # -------------------------------------------------------------------------
    custom_email = f"custom.keynote.{uid}@mit.edu"
    custom_list_payload = {
        "name": f"Custom Keynote Roster {uid}",
        "description": "Manually added external keynote prospects",
        "list_type": "custom",
        "contacts": [
            {
                "name": "Prof. Custom Keynote",
                "email": custom_email,
                "profession": "Institute Professor",
                "university": "MIT",
                "country": "United States",
            }
        ],
    }
    create_custom_res = client.post("/api/audience/lists", json=custom_list_payload)
    assert create_custom_res.status_code == 201, create_custom_res.text
    custom_list = create_custom_res.json()
    custom_list_id = custom_list["id"]
    assert custom_list["name"] == custom_list_payload["name"]
    assert custom_list["list_type"] == "custom"
    assert custom_list["contact_count"] == 1

    # Reopen Custom list and verify contacts
    reopen_custom = client.get(f"/api/audience/lists/{custom_list_id}")
    assert reopen_custom.status_code == 200
    assert reopen_custom.json()["contact_count"] == 1
    assert reopen_custom.json()["list_type"] == "custom"

    members_custom = client.get(f"/api/audience/lists/{custom_list_id}/contacts")
    assert members_custom.status_code == 200
    assert members_custom.json()["items"][0]["email"] == custom_email

    # -------------------------------------------------------------------------
    # TEST C: Campaign Integration — Select Lists Created Through Either Option
    # -------------------------------------------------------------------------
    camp_res = client.post(
        "/api/campaigns",
        json={
            "name": f"Dual Audience Outreach Campaign {uid}",
            "description": "Multi-list campaign targeting existing leads and custom contacts",
            "content": {
                "subject": "Joint Faculty Collaboration Invitation",
                "preview_text": "Invitation to join our academic consortium.",
                "from_name": "Academic Committee",
                "from_email": "test_curator@sitechseries.org",
                "reply_to": "test_curator@sitechseries.org",
                "html_content": "<p>Hello {{first_name}}, please join us.</p><p><a href='{{unsubscribe_url}}'>Unsubscribe</a></p>",
                "plain_text": "Hello {{first_name}}, please join us. Sitech Series, Cambridge, MA Unsubscribe: {{unsubscribe_url}}",
            },
        },
    )
    assert camp_res.status_code == 201
    camp_id = camp_res.json()["id"]

    # Attach BOTH lists (generated list + custom list)
    attach_res = client.post(
        f"/api/campaigns/{camp_id}/audience",
        json={"contact_list_ids": [existing_list_id, custom_list_id]},
    )
    assert attach_res.status_code == 200
    aud_info = attach_res.json()
    # 2 leads from existing list + 1 lead from custom list = 3 total eligible contacts
    assert aud_info["eligible_contacts"] == 3
    assert aud_info["unique_contacts"] == 3

    # Run deliverability analysis
    analyze_res = client.post(f"/api/deliverability/campaigns/{camp_id}/analyze")
    assert analyze_res.status_code == 200

    # Launch campaign
    launch_res = client.post(
        f"/api/campaigns/{camp_id}/launch",
        json={"send_immediately": True, "confirmed": True, "bypass_warnings": True},
    )
    assert launch_res.status_code == 200
    launch_data = launch_res.json()
    assert launch_data["status"] == "sent"
    assert launch_data["delivered_count"] == 3

    # Verify recipient snapshots were created for all 3 contacts across both list types
    recipients_res = client.get(f"/api/campaigns/{camp_id}/report/recipients")
    assert recipients_res.status_code == 200
    recipients = recipients_res.json()["items"]
    assert len(recipients) == 3
    emails_in_campaign = {r["email"] for r in recipients}
    assert f"existing.a.{uid}@stanford.edu" in emails_in_campaign
    assert f"existing.b.{uid}@oxford.ac.uk" in emails_in_campaign
    assert custom_email in emails_in_campaign

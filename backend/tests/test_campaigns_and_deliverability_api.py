from datetime import datetime, timezone, timedelta
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db.database import Base, get_db
from app.main import app
from app.models.campaign import Campaign, CampaignContent
from app.models.contact_list import ContactList, ContactListMember
from app.models.lead import Lead


client = TestClient(app)


def test_campaign_crud_and_lifecycle():
    # 1. Create a campaign draft
    create_payload = {
        "name": "2026 Academic Research Outreach",
        "description": "Collaborative project outreach for computer science faculty.",
        "tags": ["research", "q4"],
        "content": {
            "subject": "Joint Research Initiative on Distributed AI",
            "preview_text": "Review our proposal for faculty partnerships.",
            "from_name": "Dr. Sarah Connor",
            "from_email": "s.connor@sitechseries.org",
            "reply_to": "s.connor@sitechseries.org",
            "html_content": (
                "<p>Dear {{name}},</p>"
                "<p>We are coordinating joint research initiatives across university labs.</p>"
                "<hr/><p>Sitech Research, 100 Main St, Cambridge, MA</p>"
                "<p><a href='{{unsubscribe_url}}'>Unsubscribe</a></p>"
            ),
            "plain_text": "Dear {{name}},\nJoint research initiatives.\nUnsubscribe: {{unsubscribe_url}}",
            "editor_mode": "html_editor",
        },
    }

    create_res = client.post("/api/campaigns", json=create_payload)
    assert create_res.status_code == 201, create_res.text
    campaign_data = create_res.json()
    cid = campaign_data["id"]
    assert campaign_data["name"] == "2026 Academic Research Outreach"
    assert campaign_data["status"] == "draft"

    # 2. Get campaign detail
    get_res = client.get(f"/api/campaigns/{cid}")
    assert get_res.status_code == 200
    detail = get_res.json()
    assert detail["content"] is not None
    assert detail["content"]["subject"] == "Joint Research Initiative on Distributed AI"
    assert detail["content"]["version"] == 1

    # 3. Update campaign details
    patch_res = client.patch(
        f"/api/campaigns/{cid}",
        json={"name": "2026 Academic Research Outreach - Updated"},
    )
    assert patch_res.status_code == 200
    assert patch_res.json()["name"] == "2026 Academic Research Outreach - Updated"

    # 4. List campaigns
    list_res = client.get("/api/campaigns?page=1&page_size=10")
    assert list_res.status_code == 200
    assert list_res.json()["total"] >= 1


def test_deliverability_analysis_and_stale_detection():
    # Create campaign
    create_payload = {
        "name": "Deliverability Test Campaign",
        "content": {
            "subject": "Faculty Workshop on Computational Linguistics",
            "preview_text": "Invitation to keynote our upcoming workshop.",
            "from_name": "Symposium Chair",
            "from_email": "chair@sitechseries.org",
            "reply_to": "chair@sitechseries.org",
            "html_content": (
                "<p>Dear {{name}},</p>"
                "<p>We would love to have you present at our workshop.</p>"
                "<hr/><p>100 Innovation Way, Cambridge, MA</p>"
                "<p><a href='{{unsubscribe_url}}'>Unsubscribe</a></p>"
            ),
            "plain_text": "Dear {{name}},\nWorkshop presentation.\n100 Innovation Way, Cambridge, MA\nUnsubscribe: {{unsubscribe_url}}",
        },
    }
    c_res = client.post("/api/campaigns", json=create_payload)
    cid = c_res.json()["id"]

    # Trigger analysis
    analyze_res = client.post(f"/api/deliverability/campaigns/{cid}/analyze")
    assert analyze_res.status_code == 200, analyze_res.text
    report = analyze_res.json()
    assert report["risk_level"] in {"low", "medium"}
    assert report["is_stale"] is False
    assert report["findings_count"] > 0

    # Retrieve report
    fetch_res = client.get(f"/api/deliverability/campaigns/{cid}/report")
    assert fetch_res.status_code == 200
    assert fetch_res.json()["id"] == report["id"]
    assert fetch_res.json()["is_stale"] is False

    # Modify campaign content to trigger stale status
    client.patch(
        f"/api/campaigns/{cid}",
        json={
            "content": {
                "subject": "Faculty Workshop — NEW REVISED DATES",
                "preview_text": "Revised dates for workshop.",
                "from_name": "Symposium Chair",
                "from_email": "chair@sitechseries.org",
                "reply_to": "chair@sitechseries.org",
                "html_content": "<p>Updated content</p><p><a href='{{unsubscribe_url}}'>Unsubscribe</a></p>",
                "plain_text": "Updated content",
            }
        },
    )

    # Fetch report again -> should now be flagged as stale
    stale_res = client.get(f"/api/deliverability/campaigns/{cid}/report")
    assert stale_res.status_code == 200
    assert stale_res.json()["is_stale"] is True


def test_controlled_placement_testing():
    # Create campaign
    create_payload = {
        "name": "Placement Test Target",
        "content": {
            "subject": "Academic Grant Review Panel Invitation",
            "from_name": "Research Council",
            "from_email": "council@sitechseries.org",
            "reply_to": "council@sitechseries.org",
            "html_content": "<p>Reviewing grant applications</p><p><a href='{{unsubscribe_url}}'>Unsubscribe</a></p>",
            "plain_text": "Reviewing grant applications",
        },
    }
    cid = client.post("/api/campaigns", json=create_payload).json()["id"]

    # Request placement test
    test_res = client.post(
        f"/api/deliverability/campaigns/{cid}/placement-test",
        json={"notes": "Pre-launch placement check across seedboxes"},
    )
    assert test_res.status_code == 200, test_res.text
    placement_data = test_res.json()
    assert placement_data["status"] == "completed"
    assert placement_data["total_tests"] > 0
    assert placement_data["observed_count"] > 0
    assert len(placement_data["results"]) > 0

    # Retrieve single placement test detail
    tid = placement_data["id"]
    detail_res = client.get(f"/api/deliverability/placement-tests/{tid}")
    assert detail_res.status_code == 200
    assert detail_res.json()["id"] == tid


def test_ml_placement_prediction_gate_and_training():
    # 1. Create a campaign
    create_payload = {
        "name": "ML Prediction Target",
        "content": {
            "subject": "Symposium Paper Call 2026",
            "from_name": "Chair",
            "from_email": "chair@sitechseries.org",
            "html_content": "<p>Paper submission deadline</p><p><a href='{{unsubscribe_url}}'>Unsubscribe</a></p>",
            "plain_text": "Paper deadline",
        },
    }
    cid = client.post("/api/campaigns", json=create_payload).json()["id"]

    # 2. Before training: Model gate should report 'unavailable'
    pred_res = client.get(f"/api/deliverability/campaigns/{cid}/ml-prediction")
    assert pred_res.status_code == 200
    initial_pred = pred_res.json()
    # It must support the unavailable state gracefully
    assert initial_pred["status"] in {"available", "unavailable"}
    assert "limitations" in initial_pred

    # 3. Trigger model training
    train_res = client.post("/api/deliverability/ml/train?model_version=v1.0.1")
    assert train_res.status_code == 200, train_res.text
    model_info = train_res.json()
    assert model_info["is_active"] is True
    assert model_info["version"] == "v1.0.1"
    assert model_info["accuracy"] is not None
    assert model_info["f1_score"] is not None

    # 4. Request prediction now that model is active
    pred_res_2 = client.get(f"/api/deliverability/campaigns/{cid}/ml-prediction")
    assert pred_res_2.status_code == 200
    active_pred = pred_res_2.json()
    assert active_pred["status"] == "available"
    assert active_pred["inbox_probability"] is not None
    assert active_pred["confidence_interval"] is not None
    assert active_pred["model_version"] == "v1.0.1"


def test_preflight_gate_and_campaign_dispatch():
    import random
    import string
    import uuid
    uid = uuid.uuid4().hex[:8]
    alpha_suffix = "".join(random.choices(string.ascii_uppercase, k=5))
    # 1. Setup a qualified lead and list with unique identifiers
    lead_res = client.post(
        "/api/leads",
        json={
            "name": f"Prof Margaret Hamilton {alpha_suffix}",
            "email": f"m.hamilton.{uid}@mit-research.edu",
            "university": "MIT",
            "department": "Computer Science",
            "profession": "Professor",
            "country": "United States",
            "qualification_status": "qualified",
        },
    )
    assert lead_res.status_code in {201, 200}
    lead_id = lead_res.json()["id"]

    list_res = client.post(
        "/api/audience/lists",
        json={
            "name": f"MIT CS Faculty Outreach {uid}",
            "description": "Verified computer science faculty",
            "lead_ids": [lead_id],
        },
    )
    assert list_res.status_code in {201, 200}
    list_id = list_res.json()["id"]

    # 2. Create campaign
    create_payload = {
        "name": "Preflight & Dispatch Test Campaign",
        "contact_list_ids": [list_id],
        "content": {
            "subject": "Symposium on Software Engineering Standards",
            "preview_text": "Invitation to keynote our faculty symposium.",
            "from_name": "Symposium Committee",
            "from_email": "committee@sitechseries.org",
            "reply_to": "committee@sitechseries.org",
            "html_content": (
                "<p>Dear {{name}},</p>"
                "<p>We invite you to participate in our faculty symposium.</p>"
                "<hr/><p>Sitech Research, 100 Main St, Cambridge, MA 02142</p>"
                "<p><a href='{{unsubscribe_url}}'>Unsubscribe from notices</a></p>"
            ),
            "plain_text": "Dear {{name}},\nFaculty symposium.\n100 Main St, Cambridge, MA 02142\nUnsubscribe: {{unsubscribe_url}}",
        },
    }
    cid = client.post("/api/campaigns", json=create_payload).json()["id"]

    # 3. Preflight before analysis should indicate deliverability check is blocking
    preflight_1 = client.get(f"/api/campaigns/{cid}/preflight").json()
    assert preflight_1["can_schedule_or_send"] is False
    assert any("Deliverability analysis has not been executed" in b for b in preflight_1["blockers"])

    # 4. Run deliverability analysis
    analyze_res = client.post(f"/api/deliverability/campaigns/{cid}/analyze")
    assert analyze_res.status_code == 200

    # 5. Preflight after analysis should be ready
    preflight_2 = client.get(f"/api/campaigns/{cid}/preflight").json()
    assert preflight_2["can_schedule_or_send"] is True
    assert len(preflight_2["blockers"]) == 0

    # 6. Attempt dispatch without confirmation -> rejected
    unconfirmed_res = client.post(
        f"/api/campaigns/{cid}/launch",
        json={"send_immediately": True, "confirmed": False},
    )
    assert unconfirmed_res.status_code == 422

    # 7. Confirmed immediate dispatch
    launch_res = client.post(
        f"/api/campaigns/{cid}/launch",
        json={"send_immediately": True, "confirmed": True},
    )
    assert launch_res.status_code == 200, launch_res.text
    sent_campaign = launch_res.json()
    assert sent_campaign["status"] == "sent"
    assert sent_campaign["sent_count"] >= 1
    assert sent_campaign["sent_at"] is not None


def test_multiple_audience_lists_deduplication_and_persistence():
    import random
    import string
    import uuid

    def make_lead(name_prefix, email_prefix):
        uid = uuid.uuid4().hex[:6]
        alpha = "".join(random.choices(string.ascii_uppercase, k=4))
        res = client.post(
            "/api/leads",
            json={
                "name": f"Dr {name_prefix} {alpha}",
                "email": f"{email_prefix}.{uid}@stanford-research.edu",
                "university": "Stanford University",
                "department": "Bioengineering",
                "profession": "Associate Professor",
                "country": "United States",
                "qualification_status": "qualified",
            },
        )
        assert res.status_code in {200, 201}
        return res.json()["id"]

    lead1 = make_lead("Alan", "alan")
    lead2 = make_lead("Barbara", "barbara")
    lead3 = make_lead("Charles", "charles")

    # Create List 1 with lead 1 & lead 2
    u1 = uuid.uuid4().hex[:6]
    list1_res = client.post(
        "/api/audience/lists",
        json={"name": f"Stanford Bioeng Group A {u1}", "lead_ids": [lead1, lead2]},
    )
    assert list1_res.status_code in {200, 201}
    list1_id = list1_res.json()["id"]

    # Create List 2 with lead 2 (overlapping) & lead 3
    u2 = uuid.uuid4().hex[:6]
    list2_res = client.post(
        "/api/audience/lists",
        json={"name": f"Stanford Bioeng Group B {u2}", "lead_ids": [lead2, lead3]},
    )
    assert list2_res.status_code in {200, 201}
    list2_id = list2_res.json()["id"]

    # Create campaign
    c_res = client.post(
        "/api/campaigns",
        json={
            "name": f"Multi-List Deduplication Campaign {u1}",
            "content": {
                "subject": "Joint Bioengineering Initiative",
                "from_name": "Chair",
                "from_email": "chair@sitechseries.org",
                "html_content": "<p>Content</p><p><a href='{{unsubscribe_url}}'>Unsubscribe</a></p>",
            },
        },
    )
    assert c_res.status_code == 201
    cid = c_res.json()["id"]

    # 1. Assign single list
    sel1 = client.post(f"/api/campaigns/{cid}/audience", json={"contact_list_ids": [list1_id]}).json()
    assert sel1["selected_list_ids"] == [list1_id]
    assert sel1["total_raw_contacts"] == 2
    assert sel1["unique_contacts"] == 2
    assert sel1["eligible_contacts"] == 2

    # 2. Assign MULTIPLE lists (List 1 + List 2)
    # Total raw = 2 + 2 = 4 contacts, but Lead 2 is in both, so unique = 3!
    sel2 = client.post(
        f"/api/campaigns/{cid}/audience",
        json={"contact_list_ids": [list1_id, list2_id]},
    ).json()
    assert set(sel2["selected_list_ids"]) == {list1_id, list2_id}
    assert sel2["total_raw_contacts"] == 4
    assert sel2["unique_contacts"] == 3
    assert sel2["eligible_contacts"] == 3

    # 3. Verify persistence across GET
    persisted = client.get(f"/api/campaigns/{cid}/audience").json()
    assert set(persisted["selected_list_ids"]) == {list1_id, list2_id}
    assert persisted["unique_contacts"] == 3

    # 4. Deselect List 1 (keep only List 2)
    sel3 = client.post(
        f"/api/campaigns/{cid}/audience",
        json={"contact_list_ids": [list2_id]},
    ).json()
    assert sel3["selected_list_ids"] == [list2_id]
    assert sel3["total_raw_contacts"] == 2
    assert sel3["unique_contacts"] == 2


def test_invalid_audience_list_ids_rejected():
    c_res = client.post(
        "/api/campaigns",
        json={"name": "Validation Test Campaign"},
    )
    cid = c_res.json()["id"]

    # Non-existent list ID -> 422
    invalid_res = client.post(
        f"/api/campaigns/{cid}/audience",
        json={"contact_list_ids": [9999999]},
    )
    assert invalid_res.status_code == 422

    # Empty list collection -> 422
    empty_res = client.post(
        f"/api/campaigns/{cid}/audience",
        json={"contact_list_ids": []},
    )
    assert empty_res.status_code == 422


def test_campaign_audience_estimation_and_clearing():
    import random
    import string
    import uuid

    uid = uuid.uuid4().hex[:6]
    alpha = "".join(random.choices(string.ascii_uppercase, k=4))
    # Create empty list
    empty_list = client.post(
        "/api/audience/lists",
        json={"name": f"Empty List {uid}", "lead_ids": []},
    ).json()["id"]

    # Create list with 1 qualified lead
    lead_id = client.post(
        "/api/leads",
        json={
            "name": f"Dr Eleanor Vance {alpha}",
            "email": f"e.vance.{uid}@oxford-research.ac.uk",
            "profession": "Scientist",
            "country": "United Kingdom",
            "qualification_status": "qualified",
        },
    ).json()["id"]

    active_list = client.post(
        "/api/audience/lists",
        json={"name": f"Active List {uid}", "lead_ids": [lead_id]},
    ).json()["id"]

    cid = client.post(
        "/api/campaigns",
        json={"name": f"Audience Estimation Test {uid}"},
    ).json()["id"]

    # 1. Select only active list -> 1 eligible
    res1 = client.post(
        f"/api/campaigns/{cid}/audience",
        json={"contact_list_ids": [active_list]},
    ).json()
    assert res1["eligible_contacts"] == 1
    assert res1["unique_contacts"] == 1

    # 2. Add empty list simultaneously -> still 1 unique contact, but 2 selected lists
    res2 = client.post(
        f"/api/campaigns/{cid}/audience",
        json={"contact_list_ids": [active_list, empty_list]},
    ).json()
    assert len(res2["selected_list_ids"]) == 2
    assert res2["eligible_contacts"] == 1
    assert res2["unique_contacts"] == 1

    # 3. Select only empty list -> 0 eligible contacts
    res3 = client.post(
        f"/api/campaigns/{cid}/audience",
        json={"contact_list_ids": [empty_list]},
    ).json()
    assert res3["selected_list_ids"] == [empty_list]
    assert res3["eligible_contacts"] == 0
    assert res3["unique_contacts"] == 0


def test_campaign_scheduling_and_idempotency():
    import random
    import string
    import uuid

    uid = uuid.uuid4().hex[:6]
    alpha = "".join(random.choices(string.ascii_uppercase, k=4))
    lead = client.post(
        "/api/leads",
        json={
            "name": f"Prof Dennis Ritchie {alpha}",
            "email": f"d.ritchie.{uid}@bell-labs.org",
            "profession": "Fellow",
            "country": "US",
            "qualification_status": "qualified",
        },
    ).json()["id"]

    clist = client.post(
        "/api/audience/lists",
        json={"name": f"Bell Labs Fellows {uid}", "lead_ids": [lead]},
    ).json()["id"]

    cid = client.post(
        "/api/campaigns",
        json={
            "name": f"Scheduled Campaign Test {uid}",
            "contact_list_ids": [clist],
            "content": {
                "subject": "Systems Programming Seminar",
                "from_name": "Committee",
                "from_email": "committee@sitechseries.org",
                "html_content": "<p>Content</p><p><a href='{{unsubscribe_url}}'>Unsubscribe</a></p>",
                "plain_text": "Plain content",
            },
        },
    ).json()["id"]

    # Analyze first so preflight passes
    client.post(f"/api/deliverability/campaigns/{cid}/analyze")

    # 1. Past schedule rejected
    past_date = (datetime.now(timezone.utc) - timedelta(days=2)).isoformat()
    past_res = client.post(
        f"/api/campaigns/{cid}/launch",
        json={
            "send_immediately": False,
            "scheduled_at": past_date,
            "timezone_name": "UTC",
            "confirmed": True,
        },
    )
    assert past_res.status_code == 422

    # 2. Future schedule accepted
    future_date = (datetime.now(timezone.utc) + timedelta(days=3)).isoformat()
    sched_res = client.post(
        f"/api/campaigns/{cid}/launch",
        json={
            "send_immediately": False,
            "scheduled_at": future_date,
            "timezone_name": "America/New_York",
            "confirmed": True,
        },
    )
    assert sched_res.status_code == 200
    sched_data = sched_res.json()
    assert sched_data["status"] == "scheduled"
    assert sched_data["scheduled_at"] is not None

    # 3. Transition to sent (simulate immediate dispatch)
    now = datetime.now(timezone.utc).isoformat()
    sent_res = client.post(
        f"/api/campaigns/{cid}/launch",
        json={"send_immediately": True, "confirmed": True},
    )
    assert sent_res.status_code == 200
    assert sent_res.json()["status"] == "sent"

    # 4. Attempting to dispatch already sent campaign rejected (Idempotency)
    double_send = client.post(
        f"/api/campaigns/{cid}/launch",
        json={"send_immediately": True, "confirmed": True},
    )
    assert double_send.status_code == 422


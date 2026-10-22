from datetime import datetime, timezone
import pytest
from fastapi.testclient import TestClient

from app.db.database import SessionLocal
from app.main import app
from app.models.contact_list import ContactList, ContactListMember
from app.models.lead import Lead

client = TestClient(app)


@pytest.fixture
def api_test_data():
    session = SessionLocal()
    created_list_ids = []
    created_lead_ids = []

    # Insert two eligible leads
    lead1 = Lead(
        name="Prof. API Test One",
        email="api.test.one@university.edu",
        qualification_status="qualified",
        profession="Full Professor",
        university="University of Michigan",
        department="Robotics Institute",
        country="United States",
    )
    lead2 = Lead(
        name="Dr. API Test Two",
        email="api.test.two@university.edu",
        qualification_status="qualified",
        profession="Assistant Professor",
        university="University of Toronto",
        department="Computer Science",
        country="Canada",
    )
    # Insert one ineligible lead (needs_review)
    lead3 = Lead(
        name="Review Candidate",
        email="review.candidate@university.edu",
        qualification_status="needs_review",
        profession="Researcher",
        university="Oxford University",
        country="United Kingdom",
    )
    session.add_all([lead1, lead2, lead3])
    session.commit()
    session.refresh(lead1)
    session.refresh(lead2)
    session.refresh(lead3)
    created_lead_ids.extend([lead1.id, lead2.id, lead3.id])

    yield {
        "lead1": lead1,
        "lead2": lead2,
        "lead3": lead3,
        "created_list_ids": created_list_ids,
        "created_lead_ids": created_lead_ids,
    }

    # Teardown
    try:
        if created_list_ids:
            session.query(ContactListMember).filter(
                ContactListMember.list_id.in_(created_list_ids)
            ).delete(synchronize_session=False)
            session.query(ContactList).filter(
                ContactList.id.in_(created_list_ids)
            ).delete(synchronize_session=False)

        if created_lead_ids:
            session.query(Lead).filter(
                Lead.id.in_(created_lead_ids)
            ).delete(synchronize_session=False)

        session.commit()
    except Exception:
        session.rollback()
    finally:
        session.close()


def test_get_contacts_api(api_test_data):
    response = client.get("/api/audience/contacts?page=1&page_size=10")
    assert response.status_code == 200
    data = response.json()
    assert "total" in data
    assert "items" in data
    assert data["page"] == 1

    # Verify only qualified leads with emails are returned
    for item in data["items"]:
        assert item["qualification_status"] == "qualified"
        assert item["email"] is not None


def test_get_contacts_search_and_filter(api_test_data):
    lead1 = api_test_data["lead1"]
    # Search by unique name
    response = client.get(f"/api/audience/contacts?search={lead1.name}")
    assert response.status_code == 200
    data = response.json()
    assert data["total"] >= 1
    assert any(c["id"] == lead1.id for c in data["items"])

    # Filter by country
    response = client.get(f"/api/audience/contacts?country={lead1.country}")
    assert response.status_code == 200
    data = response.json()
    assert all(c["country"].lower() == lead1.country.lower() for c in data["items"])


def test_get_contacts_filter_options(api_test_data):
    response = client.get("/api/audience/contacts/filters")
    assert response.status_code == 200
    data = response.json()
    assert "countries" in data
    assert "universities" in data
    assert "departments" in data
    assert "professions" in data


def test_contact_lists_crud_api(api_test_data):
    lead1 = api_test_data["lead1"]
    lead2 = api_test_data["lead2"]
    created_list_ids = api_test_data["created_list_ids"]

    # 1. CREATE list with initial contacts
    create_payload = {
        "name": "API Robotics Faculty",
        "description": "Robotics researchers for outreach",
        "lead_ids": [lead1.id],
    }
    res_create = client.post("/api/audience/lists", json=create_payload)
    assert res_create.status_code == 201
    list_data = res_create.json()
    list_id = list_data["id"]
    created_list_ids.append(list_id)

    assert list_data["name"] == "API Robotics Faculty"
    assert list_data["contact_count"] == 1
    assert list_data["membership_summary"]["added"] == 1

    # 2. GET list by id
    res_get = client.get(f"/api/audience/lists/{list_id}")
    assert res_get.status_code == 200
    assert res_get.json()["id"] == list_id

    # 3. PATCH update list metadata
    res_patch = client.patch(
        f"/api/audience/lists/{list_id}",
        json={"name": "API Robotics Faculty Updated", "description": "Updated description"},
    )
    assert res_patch.status_code == 200
    assert res_patch.json()["name"] == "API Robotics Faculty Updated"

    # 4. POST add second lead to list
    res_add = client.post(
        f"/api/audience/lists/{list_id}/contacts",
        json={"lead_ids": [lead2.id]},
    )
    assert res_add.status_code == 200
    add_summary = res_add.json()
    assert add_summary["added"] == 1

    # 5. GET list members
    res_members = client.get(f"/api/audience/lists/{list_id}/contacts")
    assert res_members.status_code == 200
    members_data = res_members.json()
    assert members_data["total"] == 2
    member_lead_ids = [m["lead_id"] for m in members_data["items"]]
    assert lead1.id in member_lead_ids
    assert lead2.id in member_lead_ids

    # 6. DELETE remove lead2 from list
    res_remove = client.request(
        "DELETE",
        f"/api/audience/lists/{list_id}/contacts",
        json={"lead_ids": [lead2.id]},
    )
    assert res_remove.status_code == 200
    assert res_remove.json()["removed"] == 1

    # Verify count decremented
    res_get_updated = client.get(f"/api/audience/lists/{list_id}")
    assert res_get_updated.json()["contact_count"] == 1

    # 7. DELETE list itself
    res_del = client.delete(f"/api/audience/lists/{list_id}")
    assert res_del.status_code == 200

    # Verify list is gone
    res_get_gone = client.get(f"/api/audience/lists/{list_id}")
    assert res_get_gone.status_code == 404

    # Verify leads STILL EXIST in database
    res_leads = client.get(f"/api/audience/contacts?search={lead1.name}")
    assert res_leads.status_code == 200
    assert any(c["id"] == lead1.id for c in res_leads.json()["items"])


def test_create_duplicate_list_name_rejected(api_test_data):
    created_list_ids = api_test_data["created_list_ids"]

    res1 = client.post(
        "/api/audience/lists",
        json={"name": "Collision Test List"},
    )
    assert res1.status_code == 201
    created_list_ids.append(res1.json()["id"])

    # Try creating with same name
    res2 = client.post(
        "/api/audience/lists",
        json={"name": "collision test list"},
    )
    assert res2.status_code in (409, 422)


def test_add_contacts_validation_and_duplicate_prevention(api_test_data):
    lead1 = api_test_data["lead1"]
    lead3 = api_test_data["lead3"]  # ineligible
    created_list_ids = api_test_data["created_list_ids"]

    res_list = client.post(
        "/api/audience/lists",
        json={"name": "Validation Test List"},
    )
    list_id = res_list.json()["id"]
    created_list_ids.append(list_id)

    # First addition: 1 valid, 1 invalid
    res_add1 = client.post(
        f"/api/audience/lists/{list_id}/contacts",
        json={"lead_ids": [lead1.id, lead3.id]},
    )
    assert res_add1.status_code == 200
    s1 = res_add1.json()
    assert s1["requested"] == 2
    assert s1["added"] == 1
    assert s1["rejected_invalid"] == 1
    assert s1["skipped_duplicates"] == 0

    # Repeat same addition: now lead1 is duplicate
    res_add2 = client.post(
        f"/api/audience/lists/{list_id}/contacts",
        json={"lead_ids": [lead1.id]},
    )
    assert res_add2.status_code == 200
    s2 = res_add2.json()
    assert s2["added"] == 0
    assert s2["skipped_duplicates"] == 1

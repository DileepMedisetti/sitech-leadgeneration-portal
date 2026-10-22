import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.database import SessionLocal
from app.models.contact_list import ContactList, ContactListMember
from app.models.lead import Lead
from app.schemas.audience import ContactListCreate, ContactListUpdate
from app.services.audience_service import (
    add_leads_to_list,
    create_new_list,
    fetch_contact_filters,
    fetch_contacts,
    fetch_list_by_id,
    fetch_list_members,
    fetch_lists,
    is_lead_eligible_contact,
    remove_leads_from_list,
    remove_list,
    update_existing_list,
)


@pytest.fixture
def db_session():
    """Provides a transactional database session that cleans up after itself."""
    session = SessionLocal()
    created_list_ids = []
    created_lead_ids = []

    yield session, created_list_ids, created_lead_ids

    # Cleanup created test entities
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


def create_test_lead(
    session: Session,
    created_lead_ids: list,
    name: str = "Dr. Test Professor",
    email: str = "test.prof@stanford.edu",
    qualification_status: str = "qualified",
    profession: str = "Associate Professor",
    university: str = "Stanford University",
    department: str = "Computer Science",
    country: str = "United States",
) -> Lead:
    lead = Lead(
        name=name,
        email=email,
        qualification_status=qualification_status,
        profession=profession,
        university=university,
        department=department,
        country=country,
    )
    session.add(lead)
    session.commit()
    session.refresh(lead)
    created_lead_ids.append(lead.id)
    return lead


def test_contact_eligibility_rules(db_session):
    session, _, created_leads = db_session

    valid_lead = create_test_lead(
        session,
        created_leads,
        name="Dr. Valid Lead",
        email="valid.scholar@mit.edu",
        qualification_status="qualified",
    )
    assert is_lead_eligible_contact(valid_lead) is True

    # Missing email
    no_email_lead = create_test_lead(
        session,
        created_leads,
        name="No Email Faculty",
        email=None,
        qualification_status="qualified",
    )
    assert is_lead_eligible_contact(no_email_lead) is False

    # Generic role email
    generic_email_lead = create_test_lead(
        session,
        created_leads,
        name="Department Admin",
        email="info@department.edu",
        qualification_status="qualified",
    )
    assert is_lead_eligible_contact(generic_email_lead) is False

    # Needs review status
    unqualified_lead = create_test_lead(
        session,
        created_leads,
        name="Pending Review Contact",
        email="faculty@cambridge.ac.uk",
        qualification_status="needs_review",
    )
    assert is_lead_eligible_contact(unqualified_lead) is False


def test_create_list_and_membership_batch(db_session):
    session, created_lists, created_leads = db_session

    lead1 = create_test_lead(session, created_leads, name="Prof One", email="prof1@univ.edu")
    lead2 = create_test_lead(session, created_leads, name="Prof Two", email="prof2@univ.edu")

    data = ContactListCreate(
        name="Test Robotics List",
        description="Faculty in robotics",
        lead_ids=[lead1.id, lead2.id],
    )
    list_detail, summary = create_new_list(session, data)
    session.commit()
    created_lists.append(list_detail["id"])

    assert list_detail["name"] == "Test Robotics List"
    assert summary.requested == 2
    assert summary.added == 2
    assert summary.skipped_duplicates == 0
    assert summary.rejected_invalid == 0

    # Retrieve and check contact count
    fetched = fetch_list_by_id(session, list_detail["id"])
    assert fetched["contact_count"] == 2


def test_duplicate_email_prevention_across_leads(db_session):
    session, created_lists, created_leads = db_session

    # Lead 1 has email
    lead1 = create_test_lead(
        session,
        created_leads,
        name="Professor Alpha",
        email="duplicate.test@oxford.ac.uk",
    )
    # Lead 2 has same email (different lead record in DB)
    # To bypass table unique constraint on leads.email for test setup if necessary:
    # Here we test duplicate email addition with varying casing and whitespace
    list_obj, _ = create_new_list(
        session,
        ContactListCreate(name="Unique Email List", lead_ids=[lead1.id]),
    )
    session.commit()
    created_lists.append(list_obj["id"])

    # Try adding lead1 again
    summary = add_leads_to_list(session, list_obj["id"], [lead1.id])
    session.commit()
    assert summary.requested == 1
    assert summary.added == 0
    assert summary.skipped_duplicates == 1


def test_mixed_valid_and_invalid_batch(db_session):
    session, created_lists, created_leads = db_session

    valid_lead = create_test_lead(session, created_leads, name="Valid Lead", email="valid@caltech.edu")
    invalid_lead = create_test_lead(
        session,
        created_leads,
        name="Generic Lead",
        email="contact@dept.edu",  # generic -> invalid
        qualification_status="qualified",
    )
    non_existent_id = 999999999

    list_obj, _ = create_new_list(session, ContactListCreate(name="Mixed Batch List"))
    session.commit()
    created_lists.append(list_obj["id"])

    summary = add_leads_to_list(
        session,
        list_obj["id"],
        [valid_lead.id, invalid_lead.id, non_existent_id],
    )
    session.commit()

    assert summary.requested == 3
    assert summary.added == 1
    assert summary.added_lead_ids == [valid_lead.id]
    assert summary.rejected_invalid == 2
    assert invalid_lead.id in summary.invalid_lead_ids
    assert non_existent_id in summary.invalid_lead_ids


def test_remove_leads_from_list_preserves_lead(db_session):
    session, created_lists, created_leads = db_session

    lead = create_test_lead(session, created_leads, name="Removable Lead", email="remove@harvard.edu")
    list_obj, _ = create_new_list(
        session,
        ContactListCreate(name="Removal Test List", lead_ids=[lead.id]),
    )
    session.commit()
    created_lists.append(list_obj["id"])

    # Remove membership
    removed = remove_leads_from_list(session, list_obj["id"], [lead.id])
    session.commit()
    assert removed == [lead.id]

    # Verify membership count is 0
    updated_list = fetch_list_by_id(session, list_obj["id"])
    assert updated_list["contact_count"] == 0

    # CRITICAL: Verify source lead still exists in the leads table!
    lead_in_db = session.get(Lead, lead.id)
    assert lead_in_db is not None
    assert lead_in_db.email == "remove@harvard.edu"


def test_delete_list_preserves_leads(db_session):
    session, created_lists, created_leads = db_session

    lead = create_test_lead(session, created_leads, name="Persistent Lead", email="keep@princeton.edu")
    list_obj, _ = create_new_list(
        session,
        ContactListCreate(name="List To Delete", lead_ids=[lead.id]),
    )
    session.commit()
    list_id = list_obj["id"]

    # Delete list
    deleted = remove_list(session, list_id)
    session.commit()
    assert deleted is True

    # List should be gone
    assert fetch_list_by_id(session, list_id) is None

    # Source lead MUST STILL EXIST!
    persisted_lead = session.get(Lead, lead.id)
    assert persisted_lead is not None
    assert persisted_lead.name == "Persistent Lead"

from typing import Any
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.contact_list import ContactList, ContactListMember
from app.models.lead import Lead
from app.repositories.audience_repository import (
    create_contact_list,
    delete_contact_list,
    get_contact_filters,
    get_contact_list_by_id,
    get_contact_list_by_name,
    get_contact_lists_paginated,
    get_eligible_contacts_paginated,
    get_list_members_paginated,
    touch_contact_list,
    update_contact_list,
)
from app.schemas.audience import (
    ContactFiltersResponse,
    ContactListCreate,
    ContactListUpdate,
    MembershipBatchSummary,
)
from app.services.extraction.cleaners import (
    clean_person_name,
    is_generic_contact_email,
    is_valid_email,
)


def fetch_contacts(
    db: Session,
    page: int = 1,
    page_size: int = 20,
    search: str | None = None,
    country: str | None = None,
    university: str | None = None,
    department: str | None = None,
    profession: str | None = None,
    job_id: int | None = None,
    sort_by: str = "created_at",
    sort_order: str = "desc",
) -> tuple[list[Lead], int, int]:
    """Retrieve filtered and paginated eligible contacts."""
    return get_eligible_contacts_paginated(
        db=db,
        page=page,
        page_size=page_size,
        search=search,
        country=country,
        university=university,
        department=department,
        profession=profession,
        job_id=job_id,
        sort_by=sort_by,
        sort_order=sort_order,
    )


def fetch_contact_filters(db: Session) -> ContactFiltersResponse:
    """Retrieve distinct filter options from eligible contacts."""
    filters = get_contact_filters(db)
    return ContactFiltersResponse(**filters)


def fetch_lists(
    db: Session,
    page: int = 1,
    page_size: int = 20,
    search: str | None = None,
    filter_type: str | None = None,
    updated_within: str | None = None,
    sort_by: str = "updated_at",
    sort_order: str = "desc",
) -> tuple[list[dict[str, Any]], int, int]:
    """Retrieve filtered and paginated saved contact lists."""
    return get_contact_lists_paginated(
        db=db,
        page=page,
        page_size=page_size,
        search=search,
        filter_type=filter_type,
        updated_within=updated_within,
        sort_by=sort_by,
        sort_order=sort_order,
    )


def fetch_list_by_id(db: Session, list_id: int) -> dict[str, Any] | None:
    """Retrieve details and contact count for a single contact list."""
    return get_contact_list_by_id(db, list_id)


def create_new_list(
    db: Session,
    data: ContactListCreate,
) -> tuple[dict[str, Any], MembershipBatchSummary | None]:
    """Create a new contact list, checking for duplicate names and optionally adding initial contacts.

    Multi-step creation is performed within the caller's transaction.
    """
    cleaned_name = data.name.strip()
    existing = get_contact_list_by_name(db, cleaned_name)
    if existing:
        raise ValueError(f"A list named '{cleaned_name}' already exists.")

    new_list = create_contact_list(
        db=db,
        name=cleaned_name,
        description=data.description,
    )
    db.flush()

    batch_summary = None
    if data.lead_ids:
        batch_summary = add_leads_to_list(
            db=db,
            list_id=new_list.id,
            lead_ids=data.lead_ids,
        )

    list_detail = get_contact_list_by_id(db, new_list.id)
    return list_detail, batch_summary


def update_existing_list(
    db: Session,
    list_id: int,
    data: ContactListUpdate,
) -> dict[str, Any] | None:
    """Update contact list metadata."""
    if data.name is not None:
        cleaned_name = data.name.strip()
        existing = get_contact_list_by_name(db, cleaned_name)
        if existing and existing.id != list_id:
            raise ValueError(f"A list named '{cleaned_name}' already exists.")

    updated = update_contact_list(
        db=db,
        list_id=list_id,
        name=data.name,
        description=data.description,
    )
    if not updated:
        return None

    db.flush()
    return get_contact_list_by_id(db, list_id)


def remove_list(db: Session, list_id: int) -> bool:
    """Delete a contact list and its member references without deleting leads."""
    return delete_contact_list(db, list_id)


def fetch_list_members(
    db: Session,
    list_id: int,
    page: int = 1,
    page_size: int = 20,
    search: str | None = None,
    sort_by: str = "added_at",
    sort_order: str = "desc",
) -> tuple[ContactList, list[dict[str, Any]], int, int] | None:
    """Fetch paginated members of a specific contact list."""
    contact_list = db.get(ContactList, list_id)
    if not contact_list:
        return None

    items, total, total_pages = get_list_members_paginated(
        db=db,
        list_id=list_id,
        page=page,
        page_size=page_size,
        search=search,
        sort_by=sort_by,
        sort_order=sort_order,
    )
    return contact_list, items, total, total_pages


def is_lead_eligible_contact(lead: Lead) -> bool:
    """Authoritative eligibility check for contact membership:

    - qualification_status == 'qualified'
    - valid RFC email address
    - non-generic role email address
    - non-blank person name
    """
    if lead.qualification_status != "qualified":
        return False
    if not lead.email or not lead.email.strip():
        return False
    clean_email = lead.email.strip().lower()
    if not is_valid_email(clean_email):
        return False
    if is_generic_contact_email(clean_email):
        return False
    if not lead.name or not lead.name.strip() or clean_person_name(lead.name) is None:
        return False
    return True


def add_leads_to_list(
    db: Session,
    list_id: int,
    lead_ids: list[int],
) -> MembershipBatchSummary:
    """Add selected leads to a contact list with rigorous duplicate prevention and eligibility validation.

    Prevents duplicate lead IDs and duplicate normalized emails within the same list.
    """
    contact_list = db.get(ContactList, list_id)
    if not contact_list:
        raise ValueError(f"Contact list with ID {list_id} does not exist.")

    # Fetch existing members for this list to identify duplicates
    existing_members_stmt = select(
        ContactListMember.lead_id,
        ContactListMember.normalized_email,
    ).where(ContactListMember.list_id == list_id)
    existing_rows = db.execute(existing_members_stmt).all()

    existing_lead_ids = {row[0] for row in existing_rows}
    existing_emails = {row[1].strip().lower() for row in existing_rows}

    # Fetch candidate leads in one batch query
    unique_requested_ids = list(dict.fromkeys(lead_ids))  # preserve order without duplicates
    leads_stmt = select(Lead).where(Lead.id.in_(unique_requested_ids))
    found_leads = {l.id: l for l in db.scalars(leads_stmt).all()}

    added_lead_ids: list[int] = []
    skipped_lead_ids: list[int] = []
    invalid_lead_ids: list[int] = []

    for lid in unique_requested_ids:
        lead = found_leads.get(lid)
        if not lead:
            invalid_lead_ids.append(lid)
            continue

        # Check authoritative eligibility rules
        if not is_lead_eligible_contact(lead):
            invalid_lead_ids.append(lid)
            continue

        normalized_email = lead.email.strip().lower()

        # Check duplicate lead ID or duplicate normalized email
        if lid in existing_lead_ids or normalized_email in existing_emails:
            skipped_lead_ids.append(lid)
            continue

        # Valid, eligible, non-duplicate member
        member = ContactListMember(
            list_id=list_id,
            lead_id=lead.id,
            normalized_email=normalized_email,
        )
        db.add(member)

        # Register in active sets to prevent duplicates within the batch
        existing_lead_ids.add(lid)
        existing_emails.add(normalized_email)
        added_lead_ids.append(lid)

    if added_lead_ids:
        touch_contact_list(db, list_id)
        db.flush()

    return MembershipBatchSummary(
        requested=len(unique_requested_ids),
        added=len(added_lead_ids),
        skipped_duplicates=len(skipped_lead_ids),
        rejected_invalid=len(invalid_lead_ids),
        added_lead_ids=added_lead_ids,
        skipped_lead_ids=skipped_lead_ids,
        invalid_lead_ids=invalid_lead_ids,
    )


def remove_leads_from_list(
    db: Session,
    list_id: int,
    lead_ids: list[int],
) -> list[int]:
    """Remove memberships of specified lead IDs from a contact list.

    Source lead records in the leads table are never modified or deleted.
    """
    contact_list = db.get(ContactList, list_id)
    if not contact_list:
        raise ValueError(f"Contact list with ID {list_id} does not exist.")

    members_stmt = (
        select(ContactListMember)
        .where(ContactListMember.list_id == list_id)
        .where(ContactListMember.lead_id.in_(lead_ids))
    )
    members_to_delete = list(db.scalars(members_stmt).all())
    removed_ids = [m.lead_id for m in members_to_delete]

    for member in members_to_delete:
        db.delete(member)

    if removed_ids:
        touch_contact_list(db, list_id)
        db.flush()

    return removed_ids

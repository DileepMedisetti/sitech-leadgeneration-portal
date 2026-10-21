from datetime import datetime, timedelta, timezone
import math
from typing import Any
from sqlalchemy import asc, desc, func, or_, select
from sqlalchemy.orm import Session

from app.models.contact_list import ContactList, ContactListMember
from app.models.lead import Lead


SORTABLE_CONTACT_FIELDS = {
    "created_at": Lead.created_at,
    "name": Lead.name,
    "email": Lead.email,
    "university": Lead.university,
    "country": Lead.country,
    "profession": Lead.profession,
    "confidence_score": Lead.confidence_score,
}

SORTABLE_LIST_FIELDS = {
    "updated_at": ContactList.updated_at,
    "created_at": ContactList.created_at,
    "name": ContactList.name,
}


def base_eligible_contacts_query():
    """Query base for eligible contacts:

    - qualification_status == 'qualified'
    - valid non-empty personal email
    - non-empty person name
    """
    return (
        select(Lead)
        .where(Lead.qualification_status == "qualified")
        .where(Lead.email.isnot(None))
        .where(Lead.email != "")
        .where(Lead.name.isnot(None))
        .where(Lead.name != "")
    )


def get_eligible_contacts_paginated(
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
    """Retrieve paginated eligible contacts with filtering and sorting."""
    try:
        page = max(1, int(page))
    except (TypeError, ValueError):
        page = 1
    try:
        page_size = max(1, min(100, int(page_size)))
    except (TypeError, ValueError):
        page_size = 20

    query = base_eligible_contacts_query()

    if search and search.strip():
        term = f"%{search.strip().lower()}%"
        query = query.where(
            or_(
                func.lower(Lead.name).like(term),
                func.lower(Lead.email).like(term),
                func.lower(Lead.university).like(term),
                func.lower(Lead.department).like(term),
                func.lower(Lead.profession).like(term),
            )
        )

    if country and country.strip():
        query = query.where(func.lower(Lead.country) == country.strip().lower())

    if university and university.strip():
        query = query.where(func.lower(Lead.university).like(f"%{university.strip().lower()}%"))

    if department and department.strip():
        query = query.where(func.lower(Lead.department).like(f"%{department.strip().lower()}%"))

    if profession and profession.strip():
        query = query.where(func.lower(Lead.profession).like(f"%{profession.strip().lower()}%"))

    if job_id:
        query = query.where(Lead.search_job_id == job_id)

    # Count total matching
    count_stmt = select(func.count()).select_from(query.subquery())
    total_count = db.scalar(count_stmt) or 0

    total_pages = max(1, math.ceil(total_count / page_size)) if page_size > 0 else 1
    offset = (page - 1) * page_size

    sort_col = SORTABLE_CONTACT_FIELDS.get(sort_by, Lead.created_at)
    order_func = desc if sort_order.lower() == "desc" else asc

    paged_query = query.order_by(order_func(sort_col), desc(Lead.id)).offset(offset).limit(page_size)
    items = list(db.scalars(paged_query).all())

    return items, total_count, total_pages


def get_contact_filters(db: Session) -> dict[str, list[str]]:
    """Retrieve distinct filter options from eligible contacts."""
    base_query = base_eligible_contacts_query()

    def get_distinct(column):
        stmt = (
            select(column)
            .where(column.isnot(None))
            .where(column != "")
            .where(Lead.id.in_(select(base_query.c.id)))
            .distinct()
            .order_by(column)
            .limit(100)
        )
        return [r for r in db.scalars(stmt).all() if r]

    # Optimized distinct lookups
    country_stmt = (
        select(Lead.country)
        .where(Lead.qualification_status == "qualified")
        .where(Lead.email.isnot(None))
        .where(Lead.country.isnot(None))
        .where(Lead.country != "")
        .distinct()
        .order_by(Lead.country)
        .limit(100)
    )
    univ_stmt = (
        select(Lead.university)
        .where(Lead.qualification_status == "qualified")
        .where(Lead.email.isnot(None))
        .where(Lead.university.isnot(None))
        .where(Lead.university != "")
        .distinct()
        .order_by(Lead.university)
        .limit(100)
    )
    dept_stmt = (
        select(Lead.department)
        .where(Lead.qualification_status == "qualified")
        .where(Lead.email.isnot(None))
        .where(Lead.department.isnot(None))
        .where(Lead.department != "")
        .distinct()
        .order_by(Lead.department)
        .limit(100)
    )
    prof_stmt = (
        select(Lead.profession)
        .where(Lead.qualification_status == "qualified")
        .where(Lead.email.isnot(None))
        .where(Lead.profession.isnot(None))
        .where(Lead.profession != "")
        .distinct()
        .order_by(Lead.profession)
        .limit(100)
    )

    return {
        "countries": [c for c in db.scalars(country_stmt).all() if c],
        "universities": [u for u in db.scalars(univ_stmt).all() if u],
        "departments": [d for d in db.scalars(dept_stmt).all() if d],
        "professions": [p for p in db.scalars(prof_stmt).all() if p],
    }


def get_contact_lists_paginated(
    db: Session,
    page: int = 1,
    page_size: int = 20,
    search: str | None = None,
    filter_type: str | None = None,  # "all", "with_contacts", "empty"
    updated_within: str | None = None,  # "any", "7_days", "30_days"
    sort_by: str = "updated_at",
    sort_order: str = "desc",
) -> tuple[list[dict[str, Any]], int, int]:
    """Retrieve saved contact lists with accurate contact counts, filtering and sorting."""
    try:
        page = max(1, int(page))
    except (TypeError, ValueError):
        page = 1
    try:
        page_size = max(1, min(100, int(page_size)))
    except (TypeError, ValueError):
        page_size = 20
    # Subquery for accurate contact counts
    member_counts = (
        select(
            ContactListMember.list_id,
            func.count(ContactListMember.id).label("contact_count"),
        )
        .group_by(ContactListMember.list_id)
        .subquery()
    )

    query = (
        select(
            ContactList,
            func.coalesce(member_counts.c.contact_count, 0).label("contact_count"),
        )
        .outerjoin(member_counts, ContactList.id == member_counts.c.list_id)
    )

    if search and search.strip():
        term = f"%{search.strip().lower()}%"
        query = query.where(
            or_(
                func.lower(ContactList.name).like(term),
                func.lower(ContactList.description).like(term),
            )
        )

    # Filter by contacts presence
    if filter_type == "with_contacts":
        query = query.where(func.coalesce(member_counts.c.contact_count, 0) > 0)
    elif filter_type == "empty":
        query = query.where(func.coalesce(member_counts.c.contact_count, 0) == 0)

    # Filter by update timeframe
    now = datetime.now(timezone.utc)
    if updated_within == "7_days":
        cutoff = now - timedelta(days=7)
        query = query.where(ContactList.updated_at >= cutoff)
    elif updated_within == "30_days":
        cutoff = now - timedelta(days=30)
        query = query.where(ContactList.updated_at >= cutoff)

    # Count total matching lists
    count_stmt = select(func.count()).select_from(query.subquery())
    total_count = db.scalar(count_stmt) or 0

    total_pages = max(1, math.ceil(total_count / page_size)) if page_size > 0 else 1
    offset = (page - 1) * page_size

    # Sort
    order_func = desc if sort_order.lower() == "desc" else asc
    if sort_by == "contact_count":
        query = query.order_by(order_func("contact_count"), desc(ContactList.id))
    else:
        sort_col = SORTABLE_LIST_FIELDS.get(sort_by, ContactList.updated_at)
        query = query.order_by(order_func(sort_col), desc(ContactList.id))

    rows = db.execute(query.offset(offset).limit(page_size)).all()

    items = []
    for list_obj, count in rows:
        items.append({
            "id": list_obj.id,
            "name": list_obj.name,
            "description": list_obj.description,
            "contact_count": count,
            "created_at": list_obj.created_at,
            "updated_at": list_obj.updated_at,
        })

    return items, total_count, total_pages


def get_contact_list_by_id(db: Session, list_id: int) -> dict[str, Any] | None:
    """Retrieve single contact list by ID with its contact count."""
    member_count_stmt = (
        select(func.count(ContactListMember.id))
        .where(ContactListMember.list_id == list_id)
    )
    count = db.scalar(member_count_stmt) or 0

    list_obj = db.get(ContactList, list_id)
    if not list_obj:
        return None

    return {
        "id": list_obj.id,
        "name": list_obj.name,
        "description": list_obj.description,
        "contact_count": count,
        "created_at": list_obj.created_at,
        "updated_at": list_obj.updated_at,
    }


def get_contact_list_by_name(db: Session, name: str) -> ContactList | None:
    """Find a contact list by case-insensitive trimmed name."""
    clean_name = name.strip().lower()
    stmt = select(ContactList).where(func.lower(ContactList.name) == clean_name)
    return db.scalar(stmt)


def create_contact_list(db: Session, name: str, description: str | None = None) -> ContactList:
    """Create a new contact list record."""
    contact_list = ContactList(
        name=name.strip(),
        description=description.strip() if description else None,
    )
    db.add(contact_list)
    return contact_list


def update_contact_list(
    db: Session,
    list_id: int,
    name: str | None = None,
    description: str | None = None,
) -> ContactList | None:
    """Update contact list metadata."""
    contact_list = db.get(ContactList, list_id)
    if not contact_list:
        return None

    if name is not None:
        contact_list.name = name.strip()
    if description is not None:
        contact_list.description = description.strip() if description else None

    contact_list.updated_at = func.now()
    return contact_list


def delete_contact_list(db: Session, list_id: int) -> bool:
    """Delete a contact list and its memberships without deleting leads."""
    contact_list = db.get(ContactList, list_id)
    if not contact_list:
        return False

    db.delete(contact_list)
    return True


def get_list_members_paginated(
    db: Session,
    list_id: int,
    page: int = 1,
    page_size: int = 20,
    search: str | None = None,
    sort_by: str = "added_at",
    sort_order: str = "desc",
) -> tuple[list[dict[str, Any]], int, int]:
    """Retrieve members of a specific contact list with lead details."""
    try:
        page = max(1, int(page))
    except (TypeError, ValueError):
        page = 1
    try:
        page_size = max(1, min(100, int(page_size)))
    except (TypeError, ValueError):
        page_size = 20
    query = (
        select(ContactListMember, Lead)
        .join(Lead, ContactListMember.lead_id == Lead.id)
        .where(ContactListMember.list_id == list_id)
    )

    if search and search.strip():
        term = f"%{search.strip().lower()}%"
        query = query.where(
            or_(
                func.lower(Lead.name).like(term),
                func.lower(Lead.email).like(term),
                func.lower(Lead.university).like(term),
                func.lower(Lead.department).like(term),
                func.lower(Lead.profession).like(term),
            )
        )

    # Count total members
    count_stmt = select(func.count()).select_from(query.subquery())
    total_count = db.scalar(count_stmt) or 0

    total_pages = max(1, math.ceil(total_count / page_size)) if page_size > 0 else 1
    offset = (page - 1) * page_size

    order_func = desc if sort_order.lower() == "desc" else asc
    if sort_by == "name":
        query = query.order_by(order_func(Lead.name), desc(ContactListMember.id))
    elif sort_by == "email":
        query = query.order_by(order_func(Lead.email), desc(ContactListMember.id))
    else:
        query = query.order_by(order_func(ContactListMember.added_at), desc(ContactListMember.id))

    rows = db.execute(query.offset(offset).limit(page_size)).all()

    items = []
    for member, lead in rows:
        items.append({
            "id": lead.id,
            "lead_id": lead.id,
            "membership_id": member.id,
            "name": lead.name,
            "email": lead.email,
            "phone_number": lead.phone_number,
            "profession": lead.profession,
            "department": lead.department,
            "research_specialization": lead.research_specialization,
            "university": lead.university,
            "country": lead.country,
            "website": lead.website,
            "linkedin_url": lead.linkedin_url,
            "source_url": lead.source_url,
            "qualification_status": lead.qualification_status,
            "confidence_score": lead.confidence_score,
            "added_at": member.added_at,
        })

    return items, total_count, total_pages


def touch_contact_list(db: Session, list_id: int):
    """Update updated_at timestamp on list when memberships change."""
    contact_list = db.get(ContactList, list_id)
    if contact_list:
        contact_list.updated_at = func.now()

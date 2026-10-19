
import math
from typing import Any
from sqlalchemy import desc, func, or_, select
from sqlalchemy.orm import Session

from app.models.lead import Lead
from app.services.extraction.cleaners import (
    is_generic_contact_email,
    is_generic_homepage,
    is_valid_email,
    normalize_linkedin_url,
)

ENRICHMENT_FIELDS = [
    "phone_number",
    "profession",
    "department",
    "research_specialization",
    "university",
    "country",
    "website",
    "linkedin_url",
    "source_url",
    "source_title",
    "qualification_status",
    "confidence_score",
    "qualification_reason",
    "evidence",
    "search_job_id",
]


def normalize_email(email: str) -> str:
    """Normalize an email before database lookup or storage."""
    return email.strip().lower()


def get_lead_by_id(db: Session, lead_id: int) -> Lead | None:
    """Retrieve a lead by its primary key ID."""
    return db.get(Lead, lead_id)


def get_lead_by_email(db: Session, email: str | None) -> Lead | None:
    """Find a lead using its normalized email."""
    if not email:
        return None
    normalized_email = normalize_email(email)
    statement = select(Lead).where(Lead.email == normalized_email)
    return db.scalar(statement)


def get_lead_by_name_and_university(
    db: Session,
    name: str,
    university: str | None = None,
) -> Lead | None:
    """Find an existing lead by exact name and university."""
    if not name or not name.strip():
        return None
    statement = select(Lead).where(func.lower(Lead.name) == name.strip().lower())
    if university and university.strip():
        statement = statement.where(func.lower(Lead.university) == university.strip().lower())
    return db.scalar(statement)


def enrich_existing_lead(
    existing_lead: Lead,
    incoming_data: dict,
) -> bool:
    """Fill missing fields without overwriting existing useful values.

    Returns True if any field was updated; otherwise False.
    """
    updated = False

    for field in ENRICHMENT_FIELDS:
        if field == "evidence":
            continue
        current_value = getattr(existing_lead, field, None)
        incoming_value = incoming_data.get(field)

        # Update empty fields with incoming values
        if (
            current_value is None or not str(current_value).strip()
        ) and incoming_value is not None and str(incoming_value).strip():
            setattr(existing_lead, field, incoming_value)
            updated = True

    # Safe URL upgrade: If existing URL is empty or generic homepage, and incoming is specific
    for url_field in ("source_url", "website"):
        curr_url = getattr(existing_lead, url_field, None)
        inc_url = incoming_data.get(url_field)
        if inc_url and not is_generic_homepage(inc_url):
            if not curr_url or is_generic_homepage(curr_url):
                setattr(existing_lead, url_field, inc_url)
                updated = True

    # If incoming has a valid email and existing does not, attach it
    if not getattr(existing_lead, "email", None) and incoming_data.get("email"):
        existing_lead.email = normalize_email(incoming_data["email"])
        updated = True

    # Safely enrich confidence / status if incoming evidence is stronger
    incoming_conf = incoming_data.get("confidence_score")
    current_conf = getattr(existing_lead, "confidence_score", None)
    if (
        incoming_conf is not None
        and (current_conf is None or incoming_conf > current_conf)
    ):
        existing_lead.confidence_score = incoming_conf
        if incoming_data.get("qualification_status"):
            existing_lead.qualification_status = incoming_data["qualification_status"]
        if incoming_data.get("qualification_reason"):
            existing_lead.qualification_reason = incoming_data["qualification_reason"]
        updated = True

    # Merge evidence dictionary
    incoming_ev = incoming_data.get("evidence")
    if incoming_ev and isinstance(incoming_ev, dict):
        current_ev = getattr(existing_lead, "evidence", None) or {}
        merged_ev = {**current_ev, **incoming_ev}
        existing_lead.evidence = merged_ev
        updated = True

    return updated


def create_or_enrich_lead(
    db: Session,
    incoming_data: dict,
) -> tuple[Lead, bool]:
    """Create a new lead or enrich an existing lead.

    Returns:
        (lead, created)
        created=True  -> a new lead was added to the session.
        created=False -> an existing lead was found.
    """
    raw_email = incoming_data.get("email")
    normalized_email = normalize_email(raw_email) if raw_email else None

    existing_lead = None
    if normalized_email:
        existing_lead = get_lead_by_email(db, normalized_email)

    if not existing_lead and incoming_data.get("name"):
        existing_lead = get_lead_by_name_and_university(
            db=db,
            name=incoming_data["name"],
            university=incoming_data.get("university"),
        )

    if existing_lead:
        enrich_existing_lead(existing_lead, incoming_data)
        return existing_lead, False

    lead_data = incoming_data.copy()
    lead_data["email"] = normalized_email

    # A lead must have a nonblank name.
    if not lead_data.get("name") or not lead_data["name"].strip():
        raise ValueError("Lead name cannot be empty.")

    lead_data["name"] = lead_data["name"].strip()

    # Mandatory personal email validation for qualified leads
    if lead_data.get("qualification_status") == "qualified":
        if not normalized_email or not is_valid_email(normalized_email):
            raise ValueError("A qualified lead must have a valid personal email address.")
        if is_generic_contact_email(normalized_email):
            raise ValueError(f"A qualified lead cannot have a generic role email address: '{normalized_email}'")

    if lead_data.get("linkedin_url"):
        lead_data["linkedin_url"] = normalize_linkedin_url(lead_data["linkedin_url"])

    # Keep only fields supported by the Lead model.
    allowed_fields = {
        "name",
        "email",
        *ENRICHMENT_FIELDS,
    }
    lead_data = {
        key: value
        for key, value in lead_data.items()
        if key in allowed_fields
    }

    new_lead = Lead(**lead_data)
    db.add(new_lead)

    return new_lead, True


def get_leads_paginated(
    db: Session,
    page: int = 1,
    page_size: int = 20,
    search: str | None = None,
    status: str | None = None,
    country: str | None = None,
    university: str | None = None,
    profession: str | None = None,
    job_id: int | None = None,
) -> tuple[list[Lead], int, int]:
    """Fetch paginated leads with filtering and search.

    Returns:
        (items, total_count, total_pages)
    """
    query = select(Lead)

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

    if status and status.strip():
        query = query.where(Lead.qualification_status == status.strip())
        if status.strip() == "qualified":
            query = query.where(Lead.email.isnot(None), Lead.email != "")

    if country and country.strip():
        query = query.where(func.lower(Lead.country) == country.strip().lower())

    if university and university.strip():
        query = query.where(func.lower(Lead.university).like(f"%{university.strip().lower()}%"))

    if profession and profession.strip():
        query = query.where(func.lower(Lead.profession).like(f"%{profession.strip().lower()}%"))

    if job_id:
        query = query.where(Lead.search_job_id == job_id)

    # Count total matching
    count_statement = select(func.count()).select_from(query.subquery())
    total_count = db.scalar(count_statement) or 0

    total_pages = max(1, math.ceil(total_count / page_size)) if page_size > 0 else 1
    offset = (page - 1) * page_size

    paged_query = query.order_by(desc(Lead.created_at), desc(Lead.id)).offset(offset).limit(page_size)
    items = list(db.scalars(paged_query).all())

    return items, total_count, total_pages


def update_lead(
    db: Session,
    lead_id: int,
    update_data: dict[str, Any],
) -> Lead | None:
    """Update fields on a lead."""
    lead = get_lead_by_id(db, lead_id)
    if not lead:
        return None

    for field, val in update_data.items():
        if hasattr(lead, field) and val is not None:
            setattr(lead, field, val)

    return lead

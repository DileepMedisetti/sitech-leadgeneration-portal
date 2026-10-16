
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.lead import Lead


ENRICHMENT_FIELDS = [
    "phone_number",
    "profession",
    "university",
    "country",
    "website",
    "linkedin_url",
    "source_url",
    "source_title",
]


def normalize_email(email: str) -> str:
    """Normalize an email before database lookup or storage."""
    return email.strip().lower()


def get_lead_by_email(db: Session, email: str) -> Lead | None:
    """Find a lead using its normalized email."""
    normalized_email = normalize_email(email)

    statement = select(Lead).where(Lead.email == normalized_email)

    return db.scalar(statement)


def enrich_existing_lead(
    existing_lead: Lead,
    incoming_data: dict,
) -> bool:
    """
    Fill missing fields without overwriting existing useful values.

    Returns True if any field was updated; otherwise False.
    """
    updated = False

    for field in ENRICHMENT_FIELDS:
        current_value = getattr(existing_lead, field)
        incoming_value = incoming_data.get(field)

        if (
            current_value is None or not str(current_value).strip()
        ) and incoming_value is not None and str(incoming_value).strip():
            setattr(existing_lead, field, incoming_value)
            updated = True

    return updated


def create_or_enrich_lead(
    db: Session,
    incoming_data: dict,
) -> tuple[Lead, bool]:
    """
    Create a new lead or enrich an existing lead.

    Returns:
        (lead, created)
        created=True  -> a new lead was added to the session.
        created=False -> an existing lead was found.
    """
    normalized_email = normalize_email(incoming_data["email"])

    existing_lead = get_lead_by_email(db, normalized_email)

    if existing_lead:
        enrich_existing_lead(existing_lead, incoming_data)
        return existing_lead, False

    lead_data = incoming_data.copy()
    lead_data["email"] = normalized_email

    # A lead must have a nonblank name.
    if not lead_data.get("name") or not lead_data["name"].strip():
        raise ValueError("Lead name cannot be empty.")

    lead_data["name"] = lead_data["name"].strip()

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


from sqlalchemy.orm import Session

from app.models.lead import Lead
from app.repositories.lead_repository import create_or_enrich_lead
from app.schemas.lead import LeadCreate


def process_lead(
    db: Session,
    lead_data: LeadCreate,
) -> tuple[Lead, bool]:
    """Validate and process a lead.

    Returns:
        (lead, created)
        created=True if a new lead was added.
        created=False if an existing lead was reused.
    """
    validated_data = lead_data.model_dump()

    validated_data["name"] = validated_data["name"].strip()
    validated_data["email"] = str(validated_data["email"]).strip().lower()

    if not validated_data["name"]:
        raise ValueError("Lead name cannot be empty.")

    lead, created = create_or_enrich_lead(
        db=db,
        incoming_data=validated_data,
    )

    return lead, created

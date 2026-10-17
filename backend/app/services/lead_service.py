
import csv
import io
from typing import Any
from sqlalchemy.orm import Session

from app.models.lead import Lead
from app.models.search_job import SearchJob
from app.repositories.lead_repository import (
    create_or_enrich_lead,
    get_lead_by_id,
    get_leads_paginated,
    update_lead,
)
from app.schemas.lead import LeadCreate, LeadUpdate
from app.services.extraction.cleaners import (
    clean_person_name,
    is_generic_contact_email,
    is_valid_email,
    normalize_linkedin_url,
)


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
    if validated_data.get("email"):
        validated_data["email"] = str(validated_data["email"]).strip().lower()
    else:
        validated_data["email"] = None

    if not validated_data["name"]:
        raise ValueError("Lead name cannot be empty.")

    # Mandatory personal email validation for qualified leads
    if validated_data.get("qualification_status") == "qualified":
        email_val = validated_data.get("email")
        if not email_val:
            raise ValueError("A qualified lead must have a valid personal email address.")
        if not is_valid_email(email_val):
            raise ValueError(f"Invalid email address format: '{email_val}'")
        if is_generic_contact_email(email_val):
            raise ValueError(f"A qualified lead cannot have a generic role email address: '{email_val}'")

    # Clean and normalize LinkedIn URL if present
    if validated_data.get("linkedin_url"):
        validated_data["linkedin_url"] = normalize_linkedin_url(validated_data["linkedin_url"])

    lead, created = create_or_enrich_lead(
        db=db,
        incoming_data=validated_data,
    )

    return lead, created


def fetch_lead_by_id(db: Session, lead_id: int) -> Lead | None:
    """Get single lead by ID."""
    return get_lead_by_id(db, lead_id)


def fetch_leads(
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
    """Get paginated leads matching search filters."""
    return get_leads_paginated(
        db=db,
        page=page,
        page_size=page_size,
        search=search,
        status=status,
        country=country,
        university=university,
        profession=profession,
        job_id=job_id,
    )


def update_lead_record(
    db: Session,
    lead_id: int,
    lead_update: LeadUpdate,
) -> Lead | None:
    """Update fields on an existing lead."""
    data = lead_update.model_dump(exclude_unset=True)
    return update_lead(db, lead_id, data)


def export_leads_to_csv(
    db: Session | None = None,
    status: str | None = "qualified",
    job_id: int | None = None,
    leads: list[Lead] | None = None,
) -> str:
    """Generate a clean CSV string of leads."""
    if leads is None:
        if db is None:
            raise ValueError("db Session is required when leads list is not provided.")
        leads, _, _ = get_leads_paginated(
            db=db,
            page=1,
            page_size=10000,
            status=status,
            job_id=job_id,
        )

    output = io.StringIO()
    writer = csv.writer(output)

    # Header
    writer.writerow([
        "ID",
        "Person Name",
        "Professional Email",
        "Country",
        "University",
        "LinkedIn Profile URL",
        "Academic Designation",
        "Department",
        "Phone Number",
        "Qualification Status",
        "Confidence Score",
        "Source URL",
        "Created At",
    ])

    for lead in leads:
        writer.writerow([
            lead.id,
            lead.name,
            lead.email or "",
            lead.country or "",
            lead.university or "",
            lead.linkedin_url or "",
            lead.profession or "",
            lead.department or "",
            lead.phone_number or "",
            lead.qualification_status,
            f"{lead.confidence_score:.2f}" if lead.confidence_score is not None else "",
            lead.source_url or "",
            lead.created_at.isoformat() if lead.created_at else "",
        ])

    return output.getvalue()
 
 
def audit_and_reclassify_leads(db: Session) -> dict[str, Any]:
    """Audit all stored leads against enhanced name cleaning and generic email rules.

    Safely reclassifies suspicious records without deleting historical data.
    Ensures search job qualified lead counters are adjusted accurately.
    """
    leads = db.query(Lead).all()
    results: dict[str, Any] = {
        "total_audited": len(leads),
        "reclassified_to_rejected": 0,
        "reclassified_to_review": 0,
        "already_valid": 0,
        "adjusted_jobs": 0,
        "details": [],
    }

    job_decrements: dict[int, int] = {}

    for lead in leads:
        name_clean = clean_person_name(lead.name)
        is_generic = is_generic_contact_email(lead.email)
        is_bad_name = (name_clean is None)

        if is_bad_name or is_generic:
            prev_status = lead.qualification_status
            target_status = "rejected" if (is_bad_name and is_generic) else "needs_review"

            # Determine specific audit reason
            if is_bad_name and is_generic:
                reason = (
                    f"Flagged by quality audit: Non-person heading ('{lead.name}') "
                    f"and generic role email ('{lead.email}')"
                )
            elif is_bad_name:
                reason = (
                    f"Flagged by quality audit: Name matches non-person webpage heading "
                    f"or UI text ('{lead.name}')"
                )
            else:
                reason = (
                    f"Flagged by quality audit: Generic/departmental role email ('{lead.email}')"
                )

            # Update evidence with audit flag
            ev = dict(lead.evidence) if isinstance(lead.evidence, dict) else {}
            ev["audit_flag"] = "suspicious_heading" if is_bad_name else "generic_role_email"
            ev["audit_detected_issue"] = reason
            lead.evidence = ev
            lead.qualification_reason = reason

            if prev_status == "qualified":
                lead.qualification_status = target_status
                lead.confidence_score = 0.0 if target_status == "rejected" else 0.50

                if target_status == "rejected":
                    results["reclassified_to_rejected"] += 1
                else:
                    results["reclassified_to_review"] += 1

                if lead.search_job_id:
                    job_decrements[lead.search_job_id] = (
                        job_decrements.get(lead.search_job_id, 0) + 1
                    )

                results["details"].append({
                    "id": lead.id,
                    "name": lead.name,
                    "email": lead.email,
                    "previous_status": prev_status,
                    "new_status": target_status,
                    "reason": reason,
                })
            else:
                # Keep existing non-qualified status or align to target_status
                if target_status == "rejected" and prev_status != "rejected":
                    lead.qualification_status = "rejected"
                    lead.confidence_score = 0.0
                results["details"].append({
                    "id": lead.id,
                    "name": lead.name,
                    "email": lead.email,
                    "previous_status": prev_status,
                    "new_status": lead.qualification_status,
                    "reason": reason,
                })
        else:
            results["already_valid"] += 1

    # Adjust job qualified_leads_found counters where qualified leads were demoted
    for job_id, count in job_decrements.items():
        job = db.get(SearchJob, job_id)
        if job and job.qualified_leads_found > 0:
            job.qualified_leads_found = max(0, job.qualified_leads_found - count)
            results["adjusted_jobs"] += 1

    db.commit()
    return results

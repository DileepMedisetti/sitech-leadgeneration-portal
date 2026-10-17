
from typing import Any

from app.services.extraction.cleaners import (
    check_profession_match,
    is_generic_contact_email,
    is_valid_email,
)


def calculate_qualification_score(
    name: str | None,
    email: str | None,
    strategy: str,
    association_strength: str,  # 'exact_jsonld', 'card_container', 'table_row', 'single_profile'
    profession: str | None = None,
    research_specialization: str | None = None,
    department: str | None = None,
    university: str | None = None,
    country: str | None = None,
    phone: str | None = None,
    linkedin: str | None = None,
    website: str | None = None,
    name_email_correlated: bool = True,
    is_suspicious_name: bool = False,
    is_generic_email: bool = False,
    permit_department_contacts: bool = False,
    requested_profession: str | None = None,
) -> tuple[str, float, str, dict[str, Any]]:
    """Determine qualification status, confidence score, reason, and field provenance.

    Statuses:
        - 'qualified': High-confidence valid individual contact meeting all requirements,
                       including a mandatory personal professional email address.
        - 'needs_review': Candidate has contact information but requires human verification.
        - 'rejected': Candidate has invalid, generic, missing, or unassociated data.

    Returns:
        (status, confidence_score, reason, evidence_dict)
    """
    evidence: dict[str, Any] = {
        "strategy": strategy,
        "association_strength": association_strength,
        "name_email_correlated": name_email_correlated,
        "fields": {},
    }

    if not name or not name.strip():
        return (
            "rejected",
            0.0,
            "Missing required person name",
            evidence,
        )

    has_email = bool(email and email.strip())

    if not has_email:
        evidence["rejection_reason"] = "missing_email"
        evidence["fields"]["name"] = {
            "value": name,
            "source": strategy,
        }
        evidence["fields"]["email"] = {
            "value": None,
            "source": strategy,
            "note": "public_email_not_published",
        }
        if profession:
            evidence["fields"]["profession"] = {"value": profession, "source": strategy}
        if research_specialization:
            evidence["fields"]["research_specialization"] = {"value": research_specialization, "source": strategy}
        if department:
            evidence["fields"]["department"] = {"value": department, "source": strategy}
        if university:
            evidence["fields"]["university"] = {"value": university, "source": "metadata_or_context"}
        if country:
            evidence["fields"]["country"] = {"value": country, "source": "metadata_or_domain"}
        if phone:
            evidence["fields"]["phone"] = {"value": phone}
        if linkedin:
            evidence["fields"]["linkedin"] = {"value": linkedin}
        if website:
            evidence["fields"]["website"] = {"value": website, "source": "direct_profile_url"}

        # A candidate without an email can NEVER be qualified
        score = 0.65
        status = "needs_review"
        reason = (
            f"Verified faculty member at {university or 'institution'} "
            "(Public email not published on profile; email mandatory for qualification)"
        )
        return status, round(score, 2), reason, evidence

    clean_email = email.strip()
    if not is_valid_email(clean_email):
        evidence["rejection_reason"] = "invalid_email_format"
        evidence["fields"]["email"] = {
            "value": email,
            "source": strategy,
            "note": "invalid_format",
        }
        return (
            "rejected",
            0.0,
            f"Rejected: Invalid email format '{email}'",
            evidence,
        )

    if is_suspicious_name:
        evidence["rejection_reason"] = "non_person_name_heading"
        return (
            "rejected",
            0.0,
            f"Rejected: Name '{name}' matches non-person webpage heading or UI text",
            evidence,
        )

    if is_generic_email or is_generic_contact_email(clean_email):
        if permit_department_contacts:
            score = 0.70
            reason = f"Institutional department inbox permitted by search criteria: {clean_email}"
            evidence["contact_type"] = "institutional_department"
            return (
                "needs_review",
                score,
                reason,
                evidence,
            )
        evidence["rejection_reason"] = "generic_role_email"
        return (
            "rejected",
            0.0,
            f"Rejected: Generic role or department inbox '{clean_email}' is not a personal faculty contact",
            evidence,
        )

    # Profession relevance check: reject candidate if their role does not match requested profession
    if requested_profession and requested_profession.strip():
        is_match, mismatch_reason = check_profession_match(
            extracted_profession=profession,
            extracted_specialization=research_specialization,
            requested_profession=requested_profession,
            department=department,
        )
        if not is_match:
            evidence["rejection_reason"] = "profession_mismatch"
            evidence["requested_profession"] = requested_profession
            evidence["fields"]["name"] = {"value": name, "source": strategy}
            evidence["fields"]["email"] = {"value": email, "source": strategy}
            if profession:
                evidence["fields"]["profession"] = {"value": profession, "source": strategy}
            if research_specialization:
                evidence["fields"]["research_specialization"] = {"value": research_specialization, "source": strategy}
            if website:
                evidence["fields"]["website"] = {"value": website, "source": "direct_profile_url"}
            return (
                "rejected",
                0.0,
                f"Rejected: {mismatch_reason}",
                evidence,
            )
        evidence["requested_profession_matched"] = True

    # Base confidence based on association strength
    if association_strength == "exact_jsonld":
        score = 0.95
        reason = "Extracted from explicit Person structured JSON-LD data"
    elif association_strength == "table_row":
        score = 0.90
        reason = "Extracted from dedicated faculty directory table row"
    elif association_strength == "card_container":
        score = 0.88
        reason = "Extracted from co-located faculty profile card container"
    elif association_strength == "single_profile":
        if name_email_correlated:
            score = 0.85
            reason = "Extracted from single-faculty profile with confirmed name-email correlation"
        else:
            score = 0.58
            reason = "Needs Review: Single page contact with unconfirmed name-to-email association"
            evidence["flag"] = "unconfirmed_association"
            evidence["rejection_reason"] = "unassociated_email"
    else:
        score = 0.45
        evidence["flag"] = "ambiguous_association"
        evidence["rejection_reason"] = "unassociated_email"
        return (
            "needs_review",
            score,
            "Ambiguous association between name and email",
            evidence,
        )

    evidence["fields"]["name"] = {
        "value": name,
        "source": strategy,
        "confidence": score,
    }
    evidence["fields"]["email"] = {
        "value": email,
        "source": strategy,
        "confidence": score,
    }

    # Bonus for corroborating fields
    if profession:
        score = min(0.99, score + 0.03)
        evidence["fields"]["profession"] = {
            "value": profession,
            "source": strategy,
        }
    if research_specialization:
        score = min(0.99, score + 0.03)
        evidence["fields"]["research_specialization"] = {
            "value": research_specialization,
            "source": strategy,
        }
    if department:
        score = min(0.99, score + 0.02)
        evidence["fields"]["department"] = {
            "value": department,
            "source": strategy,
        }
    if university:
        evidence["fields"]["university"] = {
            "value": university,
            "source": "metadata_or_context",
        }
    if country:
        evidence["fields"]["country"] = {
            "value": country,
            "source": "metadata_or_domain",
        }
    if phone:
        evidence["fields"]["phone"] = {"value": phone}
    if linkedin:
        evidence["fields"]["linkedin"] = {"value": linkedin}
    if website:
        evidence["fields"]["website"] = {
            "value": website,
            "source": "direct_profile_url",
        }

    if not has_email or not is_valid_email(clean_email) or is_generic_contact_email(clean_email):
        score = min(score, 0.65)
        status = "needs_review"
    elif score >= 0.80:
        status = "qualified"
    elif score >= 0.50:
        status = "needs_review"
    else:
        status = "rejected"

    return status, round(score, 2), reason, evidence

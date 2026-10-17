import pytest
from types import SimpleNamespace
from unittest.mock import MagicMock
from bs4 import BeautifulSoup
from fastapi import HTTPException

from app.models.lead import Lead
from app.models.search_job import SearchJob
from app.models.search_result import SearchResult
from app.schemas.lead import LeadCreate
from app.services.extraction.cleaners import (
    check_linkedin_name_correlation,
    check_name_email_correlation,
    clean_person_name,
    extract_linkedin_urls_from_text,
    is_generic_contact_email,
    is_valid_email,
    normalize_email,
    normalize_linkedin_url,
)
from app.services.extraction.qualifier import calculate_qualification_score
from app.services.extraction.strategies import (
    FacultyCardStrategy,
    IndividualProfileStrategy,
    _extract_linkedin_from_element,
)
from app.services.lead_extraction_service import (
    extract_all_contacts,
    process_pending_results,
)
from app.services.lead_service import process_lead
from app.repositories.lead_repository import create_or_enrich_lead
from app.routes.review_queue import approve_candidate_endpoint


# ==============================================================================
# 1. Candidate with a valid, evidence-supported personal email and LinkedIn URL
#    → save both
# ==============================================================================
def test_candidate_with_valid_email_and_linkedin_saved_both(monkeypatch):
    """Ensure candidate with valid personal email and individual LinkedIn profile saves both."""
    html = """
    <html>
      <body>
        <div class="faculty-card">
          <h3 class="faculty-name">Dr. Margaret Hamilton</h3>
          <p class="role">Director of Software Engineering</p>
          <a href="mailto:hamilton@cs.mit.edu">hamilton@cs.mit.edu</a>
          <a href="https://www.linkedin.com/in/margaret-hamilton-apollo/?trk=profile">LinkedIn</a>
        </div>
      </body>
    </html>
    """
    contacts = extract_all_contacts(html=html, page_url="https://cs.mit.edu/faculty/hamilton")
    assert len(contacts) == 1
    c = contacts[0]
    assert c["name"] == "Dr. Margaret Hamilton"
    assert c["email"] == "hamilton@cs.mit.edu"
    assert c["linkedin_url"] == "https://www.linkedin.com/in/margaret-hamilton-apollo"
    assert c["qualification_status"] == "qualified"

    # Now verify persistence layer saves both fields
    db = MagicMock()
    db.scalar.return_value = None  # No existing lead

    lead_data = LeadCreate(
        name=c["name"],
        email=c["email"],
        profession=c["profession"],
        university="MIT",
        country="United States",
        linkedin_url=c["linkedin_url"],
        qualification_status="qualified",
    )
    saved_lead, created = process_lead(db, lead_data)
    assert created is True
    assert saved_lead.email == "hamilton@cs.mit.edu"
    assert saved_lead.linkedin_url == "https://www.linkedin.com/in/margaret-hamilton-apollo"
    assert saved_lead.qualification_status == "qualified"
    db.add.assert_called_once()


# ==============================================================================
# 2. Candidate with a valid email but no LinkedIn URL
#    → save the lead with an empty LinkedIn URL
# ==============================================================================
def test_candidate_with_valid_email_and_no_linkedin_saved_with_empty_linkedin():
    """Ensure candidate with valid email but without LinkedIn is saved with empty/None linkedin_url."""
    html = """
    <html>
      <body>
        <div class="faculty-card">
          <h3 class="faculty-name">Dr. Grace Hopper</h3>
          <p class="role">Computer Scientist</p>
          <a href="mailto:hopper@navy.mil">hopper@navy.mil</a>
        </div>
      </body>
    </html>
    """
    contacts = extract_all_contacts(html=html, page_url="https://navy.mil/faculty/hopper")
    assert len(contacts) == 1
    c = contacts[0]
    assert c["email"] == "hopper@navy.mil"
    assert c["linkedin_url"] is None
    assert c["qualification_status"] == "qualified"

    db = MagicMock()
    db.scalar.return_value = None

    lead_data = LeadCreate(
        name=c["name"],
        email=c["email"],
        profession=c["profession"],
        university="Yale University",
        country="United States",
        linkedin_url=None,
        qualification_status="qualified",
    )
    saved_lead, created = process_lead(db, lead_data)
    assert created is True
    assert saved_lead.email == "hopper@navy.mil"
    assert saved_lead.linkedin_url is None
    assert saved_lead.qualification_status == "qualified"
    db.add.assert_called_once()


# ==============================================================================
# 3. Candidate without an email → skip and do not save
# ==============================================================================
def test_candidate_without_email_skipped_and_not_saved(monkeypatch):
    """Ensure candidate without an email is NEVER saved as a qualified lead."""
    # 1. Qualifier layer verification
    status, score, reason, evidence = calculate_qualification_score(
        name="Dr. Katherine Johnson",
        email=None,
        strategy="faculty_card",
        association_strength="card_container",
        profession="Research Mathematician",
        university="West Virginia University",
    )
    assert status != "qualified"
    assert status == "needs_review"
    assert "email mandatory" in reason.lower()

    # 2. Service layer verification: process_lead rejects qualified status without email
    db = MagicMock()
    with pytest.raises(ValueError, match="A qualified lead must have a valid personal email address"):
        lead_data = LeadCreate(
            name="Dr. Katherine Johnson",
            email=None,
            profession="Research Mathematician",
            qualification_status="qualified",
        )
        process_lead(db, lead_data)

    # 3. Search pipeline verification: process_pending_results skips candidates with no email
    html_without_email = """
    <html>
      <body>
        <div class="faculty-card">
          <h3 class="faculty-name">Dr. Katherine Johnson</h3>
          <p class="role">Research Mathematician</p>
          <a href="https://www.linkedin.com/in/katherine-johnson">LinkedIn</a>
        </div>
      </body>
    </html>
    """
    job = SimpleNamespace(
        id=1,
        status="running",
        target_leads=5,
        qualified_leads_found=0,
        search_criteria={},
    )
    res_obj = SimpleNamespace(
        id=101,
        search_job_id=1,
        result_url="https://nasa.gov/team/katherine",
        result_title="Katherine Johnson Profile",
        result_snippet="Katherine Johnson at NASA",
        status="pending",
        retry_count=0,
        candidate_data={},
    )

    db_job = MagicMock()
    db_job.get.side_effect = lambda model, obj_id: job if model == SearchJob else res_obj
    db_job.scalars.return_value.all.return_value = [res_obj]

    monkeypatch.setattr(
        "app.services.lead_extraction_service.fetch_webpage",
        lambda url: (url, html_without_email),
    )

    counts = process_pending_results(db_job, job_id=1, limit=10)
    assert counts["leads_created"] == 0
    assert counts["qualified_leads_counted"] == 0
    assert job.qualified_leads_found == 0
    # Candidate was skipped and never persisted to DB
    db_job.add.assert_not_called()


# ==============================================================================
# 4. Candidate with an empty or invalid email → skip and do not save
# ==============================================================================
def test_candidate_with_empty_or_invalid_email_skipped_and_not_saved():
    """Ensure candidate with empty or malformed email is rejected and not saved."""
    invalid_emails = ["", "   ", "not-an-email", "user@", "@domain.com", "name @domain.com"]

    for invalid in invalid_emails:
        assert not is_valid_email(invalid)

        # Qualifier rejects
        status, score, reason, evidence = calculate_qualification_score(
            name="Prof. John Doe",
            email=invalid,
            strategy="individual_profile",
            association_strength="single_profile",
        )
        assert status in ("rejected", "needs_review")
        assert status != "qualified"

        # Persistence rejects
        db = MagicMock()
        with pytest.raises(ValueError):
            lead_data = LeadCreate(
                name="Prof. John Doe",
                email=invalid if invalid.strip() else None,
                qualification_status="qualified",
            )
            process_lead(db, lead_data)


# ==============================================================================
# 5. Candidate with a generic email → skip when personal email is required
# ==============================================================================
def test_candidate_with_generic_email_skipped():
    """Ensure generic department/role emails (info@, contact@, admissions@, etc.) are skipped."""
    generic_emails = [
        "info@cs.cmu.edu",
        "contact@math.stanford.edu",
        "support@mit.edu",
        "admissions@oxford.ac.uk",
        "admin@dept.harvard.edu",
        "help@berkeley.edu",
        "office@cs.princeton.edu",
    ]

    for gen in generic_emails:
        assert is_generic_contact_email(gen) is True

        # Qualifier must reject from qualified
        status, score, reason, evidence = calculate_qualification_score(
            name="Prof. Jane Miller",
            email=gen,
            strategy="individual_profile",
            association_strength="single_profile",
            permit_department_contacts=False,
        )
        assert status == "rejected"
        assert evidence.get("rejection_reason") == "generic_role_email"

        # Persistence must reject qualified status
        db = MagicMock()
        with pytest.raises(ValueError, match="generic role email"):
            lead_data = LeadCreate(
                name="Prof. Jane Miller",
                email=gen,
                qualification_status="qualified",
            )
            process_lead(db, lead_data)


# ==============================================================================
# 6. Candidate with an email that cannot be associated with the person → skip
# ==============================================================================
def test_candidate_with_unassociated_email_skipped(monkeypatch):
    """Ensure candidate where email username cannot be correlated to person is skipped."""
    # Alice Walker vs richard.feynman@univ.edu -> no name/email correlation
    assert check_name_email_correlation("Prof. Alice Walker", "richard.feynman@univ.edu") is False

    status, score, reason, evidence = calculate_qualification_score(
        name="Prof. Alice Walker",
        email="richard.feynman@univ.edu",
        strategy="individual_profile",
        association_strength="single_profile",
        name_email_correlated=False,
    )
    assert status != "qualified"
    assert evidence.get("rejection_reason") == "unassociated_email"

    # In process_pending_results, single profile with unassociated email must be skipped
    html = """
    <html>
      <head><title>Prof. Alice Walker | Physics</title></head>
      <body>
        <h1 class="faculty-name">Prof. Alice Walker</h1>
        <p class="title">Professor of Physics</p>
        <a href="mailto:richard.feynman@univ.edu">Email</a>
      </body>
    </html>
    """
    job = SimpleNamespace(
        id=2,
        status="running",
        target_leads=5,
        qualified_leads_found=0,
        search_criteria={},
    )
    res_obj = SimpleNamespace(
        id=102,
        search_job_id=2,
        result_url="https://univ.edu/physics/walker",
        result_title="Alice Walker Profile",
        result_snippet="Alice Walker Profile",
        status="pending",
        retry_count=0,
        candidate_data={},
    )

    db_job = MagicMock()
    db_job.get.side_effect = lambda model, obj_id: job if model == SearchJob else res_obj
    db_job.scalars.return_value.all.return_value = [res_obj]

    monkeypatch.setattr(
        "app.services.lead_extraction_service.fetch_webpage",
        lambda url: (url, html),
    )

    counts = process_pending_results(db_job, job_id=2, limit=10)
    assert counts["leads_created"] == 0
    assert counts["qualified_leads_counted"] == 0
    assert job.qualified_leads_found == 0
    db_job.add.assert_not_called()


# ==============================================================================
# 7. Candidate with a LinkedIn URL available in source HTML → extract and save it
# ==============================================================================
def test_candidate_with_linkedin_in_source_html_extracted_and_saved(monkeypatch):
    """Ensure LinkedIn URLs in source HTML (anchor, data attributes, text) are extracted and saved."""
    # Pattern A: Anchor tag with tracking parameters and hash
    html_a = """
    <html>
      <body>
        <div class="faculty-card">
          <h3 class="faculty-name">Dr. Dorothy Vaughan</h3>
          <p class="role">Computer Specialist</p>
          <a href="mailto:vaughan@nasa.gov">vaughan@nasa.gov</a>
          <a href="https://www.linkedin.com/in/dorothy-vaughan-cs/?utm_source=share&utm_medium=member_desktop#experience">LinkedIn</a>
        </div>
      </body>
    </html>
    """
    contacts_a = extract_all_contacts(html=html_a, page_url="https://nasa.gov/team/vaughan")
    assert len(contacts_a) == 1
    assert contacts_a[0]["linkedin_url"] == "https://www.linkedin.com/in/dorothy-vaughan-cs"

    # Pattern B: Data attribute (data-linkedin) and scheme-less URL
    soup_b = BeautifulSoup(
        """<div class="card"><div class="name">Dr. Mary Jackson</div><div data-linkedin="www.linkedin.com/in/mary-jackson-aero/"></div></div>""",
        "html.parser",
    )
    extracted_b = _extract_linkedin_from_element(soup_b, "https://nasa.gov", person_name="Dr. Mary Jackson")
    assert extracted_b == "https://www.linkedin.com/in/mary-jackson-aero"

    # Pattern C: Plain text within element
    soup_c = BeautifulSoup(
        """<div class="card"><div class="name">Dr. Mary Jackson</div><p>Connect: linkedin.com/in/mary-jackson-aero</p></div>""",
        "html.parser",
    )
    extracted_c = _extract_linkedin_from_element(soup_c, "https://nasa.gov", person_name="Dr. Mary Jackson")
    assert extracted_c == "https://www.linkedin.com/in/mary-jackson-aero"

    # End-to-end save to DB
    db = MagicMock()
    db.scalar.return_value = None

    lead_data = LeadCreate(
        name="Dr. Dorothy Vaughan",
        email="vaughan@nasa.gov",
        profession="Computer Specialist",
        linkedin_url=contacts_a[0]["linkedin_url"],
        qualification_status="qualified",
    )
    lead, created = process_lead(db, lead_data)
    assert created is True
    assert lead.linkedin_url == "https://www.linkedin.com/in/dorothy-vaughan-cs"
    db.add.assert_called_once()


# ==============================================================================
# 8. Candidate with a company LinkedIn URL instead of an individual profile
#    → do not treat it as a personal profile
# ==============================================================================
def test_candidate_with_company_linkedin_not_treated_as_personal():
    """Ensure company/school/job/search LinkedIn URLs are rejected and not saved as personal profile."""
    company_urls = [
        "https://www.linkedin.com/company/stanford-university/",
        "https://www.linkedin.com/school/harvard-university/",
        "https://www.linkedin.com/jobs/view/123456789",
        "https://www.linkedin.com/search/results/all/?keywords=professor",
        "https://www.linkedin.com/pulse/article-name-author",
    ]

    for c_url in company_urls:
        normalized = normalize_linkedin_url(c_url)
        assert normalized is None, f"Expected {c_url} to be rejected as individual profile"

    # Test in HTML: faculty card with company LinkedIn link
    html_company = """
    <html>
      <body>
        <div class="faculty-card">
          <h3 class="faculty-name">Dr. Leslie Lamport</h3>
          <p class="role">Principal Researcher</p>
          <a href="mailto:lamport@microsoft.com">lamport@microsoft.com</a>
          <a href="https://www.linkedin.com/company/microsoft/">Company LinkedIn</a>
        </div>
      </body>
    </html>
    """
    contacts = extract_all_contacts(html=html_company, page_url="https://research.microsoft.com/lamport")
    assert len(contacts) == 1
    c = contacts[0]
    # Email is valid, so lead qualifies, but linkedin_url MUST be None
    assert c["email"] == "lamport@microsoft.com"
    assert c["linkedin_url"] is None
    assert c["qualification_status"] == "qualified"

    # Persistence verification
    db = MagicMock()
    db.scalar.return_value = None

    lead_data = LeadCreate(
        name=c["name"],
        email=c["email"],
        profession=c["profession"],
        linkedin_url=c["linkedin_url"],
        qualification_status="qualified",
    )
    lead, created = process_lead(db, lead_data)
    assert created is True
    assert lead.email == "lamport@microsoft.com"
    assert lead.linkedin_url is None


# ==============================================================================
# Additional Defense-in-Depth Tests: Review Queue & Repository
# ==============================================================================
def test_review_queue_approve_rejects_missing_or_generic_email():
    """Ensure review queue cannot approve candidate into qualified if email is missing or generic."""
    db = MagicMock()

    # Case A: missing email
    lead_no_email = Lead(id=10, name="No Email Lead", email=None, qualification_status="needs_review")
    db.get.return_value = lead_no_email
    with pytest.raises(HTTPException) as exc_a:
        approve_candidate_endpoint(lead_id=10, action=None, db=db)
    assert exc_a.value.status_code == 422

    # Case B: generic email
    lead_generic = Lead(id=11, name="Generic Lead", email="info@dept.edu", qualification_status="needs_review")
    db.get.return_value = lead_generic
    with pytest.raises(HTTPException) as exc_b:
        approve_candidate_endpoint(lead_id=11, action=None, db=db)
    assert exc_b.value.status_code == 422

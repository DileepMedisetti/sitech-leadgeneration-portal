import csv
import io
from types import SimpleNamespace

from app.models.lead import Lead
from app.services.extraction.cleaners import (
    check_linkedin_name_correlation,
    check_name_email_correlation,
    clean_person_name,
    is_generic_contact_email,
    is_valid_email,
)
from app.services.extraction.coordinator import LeadExtractionCoordinator
from app.services.extraction.qualifier import calculate_qualification_score
from app.services.extraction.strategies import (
    DirectoryTableStrategy,
    FacultyCardStrategy,
    IndividualProfileStrategy,
    JsonLdStrategy,
)
from app.services.lead_extraction_service import (
    IRRELEVANT_RESULT_URL_PATTERN,
    extract_all_contacts,
    extract_contact_details,
)
from app.services.lead_service import export_leads_to_csv


# ----------------------------------------------------------------------
# 1. Valid faculty profile with all 5 required fields
# ----------------------------------------------------------------------
def test_valid_faculty_profile_with_all_5_fields():
    html = """
    <!DOCTYPE html>
    <html>
      <head>
        <title>Dr. Alan Turing | Stanford University</title>
        <meta name="institution" content="Stanford University" />
      </head>
      <body>
        <div class="faculty-profile">
          <h1 class="faculty-name">Dr. Alan Turing</h1>
          <p class="designation">Professor of Computer Science</p>
          <p class="department">Department of Computer Science</p>
          <a href="mailto:turing@cs.stanford.edu">turing@cs.stanford.edu</a>
          <a href="https://www.linkedin.com/in/alan-turing-cs/">LinkedIn Profile</a>
          <a href="tel:+16507232300">+1 650-723-2300</a>
        </div>
      </body>
    </html>
    """
    contacts = extract_all_contacts(
        html=html,
        page_url="https://cs.stanford.edu/faculty/turing",
    )

    assert len(contacts) == 1
    lead = contacts[0]
    assert lead["name"] == "Dr. Alan Turing"
    assert lead["email"] == "turing@cs.stanford.edu"
    assert lead["university"] == "Stanford University"
    assert lead["country"] == "United States"
    assert lead["linkedin_url"] == "https://www.linkedin.com/in/alan-turing-cs"
    assert lead["qualification_status"] == "qualified"
    assert lead["confidence_score"] >= 0.80


# ----------------------------------------------------------------------
# 2. Real person without public email
# ----------------------------------------------------------------------
def test_real_person_without_public_email():
    html = """
    <!DOCTYPE html>
    <html>
      <head>
        <title>Faculty Directory - MIT EECS</title>
        <meta property="og:site_name" content="Massachusetts Institute of Technology" />
      </head>
      <body>
        <table class="directory-table">
          <thead>
            <tr><th>Name</th><th>Title</th><th>Office</th></tr>
          </thead>
          <tbody>
            <tr>
              <td>Prof. Barbara Liskov</td>
              <td>Institute Professor</td>
              <td>32-G942</td>
            </tr>
          </tbody>
        </table>
      </body>
    </html>
    """
    contacts = extract_all_contacts(
        html=html,
        page_url="https://www.eecs.mit.edu/people/faculty",
    )

    assert len(contacts) == 1
    lead = contacts[0]
    assert lead["name"] == "Prof. Barbara Liskov"
    assert lead["email"] is None
    assert lead["profession"] == "Institute Professor"
    assert lead["university"] == "Massachusetts Institute of Technology"
    # Must NOT be rejected as non-person
    assert lead["qualification_status"] in ("qualified", "needs_review")
    assert lead["confidence_score"] >= 0.65


# ----------------------------------------------------------------------
# 3. Person without LinkedIn URL
# ----------------------------------------------------------------------
def test_person_without_linkedin_url():
    html = """
    <div class="faculty-card">
      <h3 class="faculty-name">Dr. Claude Shannon</h3>
      <div class="role">Associate Professor</div>
      <a href="mailto:shannon@mit.edu">shannon@mit.edu</a>
    </div>
    """
    contacts = extract_all_contacts(
        html=html,
        page_url="https://mit.edu/faculty/shannon",
    )

    assert len(contacts) == 1
    lead = contacts[0]
    assert lead["name"] == "Dr. Claude Shannon"
    assert lead["email"] == "shannon@mit.edu"
    assert lead["linkedin_url"] is None
    assert lead["qualification_status"] == "qualified"


# ----------------------------------------------------------------------
# 4. University directory table extraction
# ----------------------------------------------------------------------
def test_university_directory_table_extraction():
    html = """
    <html>
      <head><meta name="institution" content="Princeton University" /></head>
      <body>
        <table>
          <tr>
            <td>John von Neumann</td>
            <td>Professor of Mathematics</td>
            <td><a href="mailto:neumann@ias.edu">Email</a></td>
            <td><a href="https://linkedin.com/in/von-neumann/">LinkedIn</a></td>
          </tr>
          <tr>
            <td>Grace Hopper</td>
            <td>Associate Professor</td>
            <td><a href="mailto:hopper@yale.edu">Email</a></td>
          </tr>
          <tr>
            <td colspan="3">Department Overview and Administrative Guidelines</td>
          </tr>
        </table>
      </body>
    </html>
    """
    contacts = extract_all_contacts(
        html=html,
        page_url="https://math.princeton.edu/faculty",
    )

    assert len(contacts) == 2
    names = {c["name"] for c in contacts}
    assert "John von Neumann" in names
    assert "Grace Hopper" in names
    assert "Department Overview and Administrative Guidelines" not in names

    neumann = next(c for c in contacts if c["name"] == "John von Neumann")
    assert neumann["email"] == "neumann@ias.edu"
    assert neumann["linkedin_url"] == "https://www.linkedin.com/in/von-neumann"

    hopper = next(c for c in contacts if c["name"] == "Grace Hopper")
    assert hopper["email"] == "hopper@yale.edu"
    assert hopper["linkedin_url"] is None


# ----------------------------------------------------------------------
# 5. Navigation labels / footer text rejection
# ----------------------------------------------------------------------
def test_navigation_labels_footer_text_rejection():
    bad_labels = [
        "Main navigation",
        "Subscribe to our Newsletter",
        "Open Faculty Positions",
        "Software Development",
        "Privacy Policy",
        "Quick Links",
        "Terms and Conditions",
        "Campus Map",
        "Site Index",
        "Accessibility Services",
        "Apply Online",
        "Join our Team",
    ]
    for label in bad_labels:
        assert clean_person_name(label) is None, f"Expected '{label}' to be rejected as non-person name"

    html = """
    <div class="nav-container">
      <h2>Main navigation</h2>
      <a href="mailto:webmaster@stanford.edu">Contact Webmaster</a>
    </div>
    """
    contacts = extract_all_contacts(html=html, page_url="https://stanford.edu/nav")
    assert len(contacts) == 0


# ----------------------------------------------------------------------
# 6. Job listings and recruitment email rejection
# ----------------------------------------------------------------------
def test_job_listings_and_recruitment_email_rejection():
    # URL pattern filter
    assert IRRELEVANT_RESULT_URL_PATTERN.search("https://jobs.stanford.edu/faculty-openings")
    assert IRRELEVANT_RESULT_URL_PATTERN.search("https://careers.google.com/jobs/results")
    assert IRRELEVANT_RESULT_URL_PATTERN.search("https://www.indeed.com/viewjob?jk=123")
    assert IRRELEVANT_RESULT_URL_PATTERN.search("https://university.edu/employment/vacancies/")

    # Page content filter
    html = """
    <html>
      <head><title>Open Faculty Positions - Stanford University</title></head>
      <body>
        <h1>Open Faculty Positions</h1>
        <p>We are recruiting tenure-track assistant professors.</p>
        <a href="mailto:faculty-search@stanford.edu">faculty-search@stanford.edu</a>
        <a href="mailto:disability.access@stanford.edu">disability.access@stanford.edu</a>
      </body>
    </html>
    """
    contacts = extract_all_contacts(
        html=html,
        page_url="https://stanford.edu/dept/faculty-search",
    )
    assert len(contacts) == 0


# ----------------------------------------------------------------------
# 7. Newsletter subscription forms rejection
# ----------------------------------------------------------------------
def test_newsletter_subscription_forms_rejection():
    html = """
    <section class="newsletter">
      <h3>Subscribe to our Newsletter</h3>
      <p>Stay up to date with department seminars.</p>
      <a href="mailto:newsletter@cs.cmu.edu">newsletter@cs.cmu.edu</a>
    </section>
    """
    assert clean_person_name("Subscribe to our Newsletter") is None
    assert is_generic_contact_email("newsletter@cs.cmu.edu") is True
    contacts = extract_all_contacts(html=html, page_url="https://cs.cmu.edu/news")
    assert len(contacts) == 0


# ----------------------------------------------------------------------
# 8. Generic department inboxes rejection
# ----------------------------------------------------------------------
def test_generic_department_inboxes_rejection():
    generic_emails = [
        "admissions@cam.ac.uk",
        "cs-admissions@stanford.edu",
        "info@mit.edu",
        "faculty-recruitment@ox.ac.uk",
        "vpue-research@stanford.edu",
        "disability.access@stanford.edu",
        "hr@berkeley.edu",
        "careers@cmu.edu",
        "helpdesk@columbia.edu",
        "contact-us@harvard.edu",
    ]
    for email in generic_emails:
        assert is_generic_contact_email(email) is True, f"Expected '{email}' to be classified as generic"


# ----------------------------------------------------------------------
# 9. Unrelated business emails rejection
# ----------------------------------------------------------------------
def test_unrelated_business_emails_rejection():
    business_emails = [
        "sales@vendor.com",
        "billing@cloudhost.com",
        "support@techsupport.org",
        "inquiries@commercialportal.biz",
    ]
    for email in business_emails:
        assert is_generic_contact_email(email) is True


# ----------------------------------------------------------------------
# 10. Incorrect name/email associations
# ----------------------------------------------------------------------
def test_incorrect_name_email_associations():
    # Correlation checker
    assert not check_name_email_correlation("Dr. Emily Watson", "mark.davis@uni.edu")
    assert not check_name_email_correlation("Prof. Robert Smith", "contact@uni.edu")
    assert check_name_email_correlation("Dr. Emily Watson", "ewatson@uni.edu")
    assert check_name_email_correlation("Dr. Emily Watson", "emily.watson@uni.edu")

    # In single profile strategy, mismatched email gets needs_review flag
    strat = IndividualProfileStrategy()
    from bs4 import BeautifulSoup
    soup = BeautifulSoup("""
    <html>
      <head><title>Dr. Emily Watson Profile</title></head>
      <body>
        <h1 class="faculty-name">Dr. Emily Watson</h1>
        <p class="title">Associate Professor</p>
        <a href="mailto:admin.contact@uni.edu">Contact Admin</a>
      </body>
    </html>
    """, "html.parser")
    # Generic email is excluded; if a non-correlated personal email exists:
    soup2 = BeautifulSoup("""
    <html>
      <head><title>Dr. Emily Watson Profile</title></head>
      <body>
        <h1 class="faculty-name">Dr. Emily Watson</h1>
        <p class="title">Associate Professor</p>
        <a href="mailto:charles.babbage@uni.edu">charles.babbage@uni.edu</a>
      </body>
    </html>
    """, "html.parser")
    res = strat.extract(soup2, "https://uni.edu/profiles/watson", "Dr. Emily Watson Profile")
    assert len(res) == 1
    # Because name Emily Watson does NOT correlate with charles.babbage, status is needs_review
    assert res[0]["qualification_status"] == "needs_review"
    assert res[0]["evidence"].get("flag") == "unconfirmed_association"


# ----------------------------------------------------------------------
# 11. Missing university affiliation handling
# ----------------------------------------------------------------------
def test_missing_university_affiliation_handling():
    html = """
    <div class="faculty-card">
      <h3 class="faculty-name">Dr. Margaret Hamilton</h3>
      <p class="role">Director of Software Engineering</p>
      <a href="mailto:hamilton@mit.edu">hamilton@mit.edu</a>
    </div>
    """
    # When page provides no institution meta, but search_criteria gives one:
    contacts = extract_all_contacts(
        html=html,
        page_url="https://example-archive.org/people/hamilton",
        search_criteria={"university": "Massachusetts Institute of Technology", "country": "United States"},
    )
    assert len(contacts) == 1
    lead = contacts[0]
    assert lead["university"] == "Massachusetts Institute of Technology"
    assert lead["country"] == "United States"


# ----------------------------------------------------------------------
# 12. Duplicate profile deduplication
# ----------------------------------------------------------------------
def test_duplicate_profile_deduplication():
    html = """
    <html>
      <head><title>Faculty Roster</title><meta name="institution" content="Oxford University" /></head>
      <body>
        <!-- Appeared in table -->
        <table>
          <tr>
            <td>Dr. Tim Berners-Lee</td>
            <td>Professor</td>
            <td><a href="mailto:timbl@cs.ox.ac.uk">timbl@cs.ox.ac.uk</a></td>
          </tr>
        </table>
        <!-- Appeared in card below with LinkedIn -->
        <div class="faculty-card">
          <h2 class="name">Dr. Tim Berners-Lee</h2>
          <a href="mailto:timbl@cs.ox.ac.uk">timbl@cs.ox.ac.uk</a>
          <a href="https://linkedin.com/in/tim-berners-lee/">LinkedIn</a>
          <a href="tel:+441865273838">+44 1865 273838</a>
        </div>
      </body>
    </html>
    """
    contacts = extract_all_contacts(
        html=html,
        page_url="https://cs.ox.ac.uk/people/faculty",
    )
    # Deduplication must merge into exactly 1 record
    assert len(contacts) == 1
    lead = contacts[0]
    assert lead["name"] == "Dr. Tim Berners-Lee"
    assert lead["email"] == "timbl@cs.ox.ac.uk"
    assert lead["linkedin_url"] == "https://www.linkedin.com/in/tim-berners-lee"
    assert "+441865273838" in lead["phone_number"].replace(" ", "")


# ----------------------------------------------------------------------
# 13. International names and compound surnames
# ----------------------------------------------------------------------
def test_international_names_and_compound_surnames():
    international_names = [
        "José María Álvarez",
        "Hans-Jürgen Weber",
        "Li Wei",
        "Fatima Al-Zahra",
        "Arun K. Singh",
        "Dr. John M. O'Connor",
        "Marie-Claire Dubois",
    ]
    for name in international_names:
        cleaned = clean_person_name(name)
        assert cleaned is not None, f"Expected '{name}' to be accepted as a valid international person name"
        assert cleaned == name


# ----------------------------------------------------------------------
# 14. Consistent field mappings in CSV export
# ----------------------------------------------------------------------
def test_consistent_field_mappings_in_csv_export():
    leads = [
        SimpleNamespace(
            id=101,
            name="Dr. Alan Turing",
            email="turing@cs.stanford.edu",
            country="United States",
            university="Stanford University",
            linkedin_url="https://www.linkedin.com/in/alan-turing-cs",
            profession="Professor",
            department="Computer Science",
            phone_number="+1 650-723-2300",
            qualification_status="qualified",
            confidence_score=0.95,
            source_url="https://cs.stanford.edu/faculty/turing",
            created_at=None,
        ),
        SimpleNamespace(
            id=102,
            name="Prof. Barbara Liskov",
            email=None,  # Nullable email
            country="United States",
            university="Massachusetts Institute of Technology",
            linkedin_url=None,
            profession="Institute Professor",
            department="EECS",
            phone_number=None,
            qualification_status="qualified",
            confidence_score=0.82,
            source_url="https://www.eecs.mit.edu/people/faculty",
            created_at=None,
        ),
    ]

    csv_data = export_leads_to_csv(leads=leads)
    reader = csv.reader(io.StringIO(csv_data))
    rows = list(reader)

    # First row is header
    header = rows[0]
    expected_top_5 = [
        "Person Name",
        "Professional Email",
        "Country",
        "University",
        "LinkedIn Profile URL",
    ]
    assert header[1:6] == expected_top_5

    # Check row 1 (all 5 fields present)
    row1 = rows[1]
    assert row1[1] == "Dr. Alan Turing"
    assert row1[2] == "turing@cs.stanford.edu"
    assert row1[3] == "United States"
    assert row1[4] == "Stanford University"
    assert row1[5] == "https://www.linkedin.com/in/alan-turing-cs"

    # Check row 2 (missing email & linkedin handled cleanly)
    row2 = rows[2]
    assert row2[1] == "Prof. Barbara Liskov"
    assert row2[2] == ""  # None exported as empty string
    assert row2[3] == "United States"
    assert row2[4] == "Massachusetts Institute of Technology"
    assert row2[5] == ""

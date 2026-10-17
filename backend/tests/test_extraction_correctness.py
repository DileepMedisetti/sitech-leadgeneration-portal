
import pytest
from app.services.lead_extraction_service import (
    extract_all_contacts,
    extract_contact_details,
)
from app.services.extraction.cleaners import (
    clean_person_name,
    is_generic_contact_email,
)


def test_reject_newsletter_and_helpdesk_compound_email():
    """Ensure newsletter heading and compound helpdesk emails are rejected."""
    assert clean_person_name("Subscribe to our Newsletter") is None
    assert clean_person_name("Newsletter") is None
    assert is_generic_contact_email("kuhelpdesk@klyuniv.ac.in") is True
    assert is_generic_contact_email("helpdesk@university.edu") is True
    assert is_generic_contact_email("cs-admissions@college.edu") is True
    assert is_generic_contact_email("career@esparkinfo.com") is True
    assert is_generic_contact_email("careers@company.com") is True

    # Real faculty email should NOT be marked generic
    assert is_generic_contact_email("rsharma@iitd.ac.in") is False
    assert is_generic_contact_email("john.doe@mit.edu") is False


def test_reject_software_development_category():
    """Ensure service category headings are rejected as personal names."""
    assert clean_person_name("Software Development") is None
    assert clean_person_name("Web Development") is None
    assert clean_person_name("Faculty Directory") is None
    assert clean_person_name("Department of Computer Science") is None


def test_accept_valid_academic_names():
    """Ensure legitimate academic names are accepted."""
    assert clean_person_name("Dr. Ramesh Sharma") == "Dr. Ramesh Sharma"
    assert clean_person_name("Prof. Ananya Sen-Gupta") == "Prof. Ananya Sen-Gupta"
    assert clean_person_name("Arun K. Singh") == "Arun K. Singh"
    assert clean_person_name("Dr. John M. O'Connor") == "Dr. John M. O'Connor"


def test_newsletter_with_helpdesk_html_produces_no_leads():
    """Regression test for the observed bug where newsletter and helpdesk were paired."""
    html = """
    <html>
      <head><title>University Newsletter Portal</title></head>
      <body>
        <div class="content">
          <h2>Subscribe to our Newsletter</h2>
          <p>Get latest updates from Kalyani University.</p>
        </div>
        <footer>
          <p>Need help? Contact: <a href="mailto:kuhelpdesk@klyuniv.ac.in">kuhelpdesk@klyuniv.ac.in</a></p>
        </footer>
      </body>
    </html>
    """
    result = extract_contact_details(html, "https://klyuniv.ac.in/newsletter")
    assert result["name"] is None
    assert result["email"] is None


def test_directory_table_extracts_multiple_professors():
    """Ensure HTML table directories extract each row as a distinct, accurate contact."""
    html = """
    <html>
      <head><title>Faculty List | Department of Computer Science</title></head>
      <body>
        <table class="faculty-table">
          <thead>
            <tr><th>Name</th><th>Designation</th><th>Email</th><th>Phone</th></tr>
          </thead>
          <tbody>
            <tr>
              <td>Dr. Amit Patel</td>
              <td>Associate Professor</td>
              <td><a href="mailto:apatel@univ.ac.in">apatel@univ.ac.in</a></td>
              <td>+91-11-26591001</td>
            </tr>
            <tr>
              <td>Prof. Sunita Rao</td>
              <td>Professor & Head</td>
              <td><a href="mailto:srao@univ.ac.in">srao@univ.ac.in</a></td>
              <td>+91-11-26591002</td>
            </tr>
          </tbody>
        </table>
      </body>
    </html>
    """
    contacts = extract_all_contacts(html, "https://univ.ac.in/cs/faculty")
    assert len(contacts) == 2

    c1 = next(c for c in contacts if c["email"] == "apatel@univ.ac.in")
    assert c1["name"] == "Dr. Amit Patel"
    assert "Associate Professor" in c1["profession"]
    assert c1["phone_number"] == "+91-11-26591001"
    assert c1["qualification_status"] == "qualified"

    c2 = next(c for c in contacts if c["email"] == "srao@univ.ac.in")
    assert c2["name"] == "Prof. Sunita Rao"
    assert "Professor" in c2["profession"]
    assert c2["qualification_status"] == "qualified"


def test_faculty_cards_maintain_strict_associations():
    """Ensure faculty cards extract each person's specific email, phone, and LinkedIn."""
    html = """
    <html>
      <head><title>Faculty Directory</title></head>
      <body>
        <div class="faculty-card">
          <h3 class="faculty-name">Dr. Vikram Malhotra</h3>
          <p class="designation">Assistant Professor</p>
          <a href="mailto:vmalhotra@iitb.ac.in">Email</a>
          <a href="https://www.linkedin.com/in/vikram-malhotra-phd/">LinkedIn</a>
          <p>Phone: +91 22 2576 7000</p>
        </div>
        <div class="faculty-card">
          <h3 class="faculty-name">Prof. Priya Sharma</h3>
          <p class="designation">Professor</p>
          <a href="mailto:psharma@iitb.ac.in">Email</a>
          <a href="https://www.linkedin.com/in/priya-sharma-iit/">LinkedIn</a>
        </div>
      </body>
    </html>
    """
    contacts = extract_all_contacts(html, "https://www.iitb.ac.in/faculty")
    assert len(contacts) == 2

    c1 = next(c for c in contacts if c["email"] == "vmalhotra@iitb.ac.in")
    assert c1["name"] == "Dr. Vikram Malhotra"
    assert "Assistant Professor" in c1["profession"]
    assert "vikram-malhotra-phd" in c1["linkedin_url"]
    assert c1["phone_number"] == "+91 22 2576 7000"

    c2 = next(c for c in contacts if c["email"] == "psharma@iitb.ac.in")
    assert c2["name"] == "Prof. Priya Sharma"
    assert "priya-sharma-iit" in c2["linkedin_url"]


def test_json_ld_person_extraction():
    """Ensure structured JSON-LD Person records are parsed with high confidence."""
    html = """
    <html>
      <head>
        <title>Prof. Rajesh V | Profile</title>
        <script type="application/ld+json">
        {
          "@context": "https://schema.org",
          "@type": "Person",
          "name": "Prof. Rajesh V",
          "jobTitle": "Professor of Artificial Intelligence",
          "email": "mailto:rajesh.v@iisc.ac.in",
          "telephone": "+91-80-2293-2000",
          "sameAs": ["https://www.linkedin.com/in/rajesh-v-iisc/"],
          "worksFor": {
            "@type": "CollegeOrUniversity",
            "name": "Indian Institute of Science"
          }
        }
        </script>
      </head>
      <body><h1>Prof. Rajesh V</h1></body>
    </html>
    """
    contacts = extract_all_contacts(html, "https://iisc.ac.in/faculty/rajesh")
    assert len(contacts) == 1
    c = contacts[0]
    assert c["name"] == "Prof. Rajesh V"
    assert c["email"] == "rajesh.v@iisc.ac.in"
    assert c["profession"] == "Professor of Artificial Intelligence"
    assert c["university"] == "Indian Institute of Science"
    assert "rajesh-v-iisc" in c["linkedin_url"]
    assert c["qualification_status"] == "qualified"
    assert c["confidence_score"] >= 0.90


def test_reject_job_headings_and_navigation_labels():
    """Ensure job board headings, navigation text, and admin role emails are rejected."""
    # Headings
    assert clean_person_name("Open Faculty Positions") is None
    assert clean_person_name("Faculty Positions") is None
    assert clean_person_name("Main navigation") is None
    assert clean_person_name("Site Navigation") is None
    assert clean_person_name("Subscribe to our Newsletter") is None
    assert clean_person_name("Software Development") is None
    assert clean_person_name("Faculty Directory") is None
    assert clean_person_name("Department of Computer Science") is None
    assert clean_person_name("All Rights Reserved") is None
    assert clean_person_name("Apply Now") is None

    # Role emails
    assert is_generic_contact_email("disability.access@stanford.edu") is True
    assert is_generic_contact_email("vpue-research@stanford.edu") is True
    assert is_generic_contact_email("career@esparkinfo.com") is True
    assert is_generic_contact_email("kuhelpdesk@klyuniv.ac.in") is True
    assert is_generic_contact_email("faculty-search@harvard.edu") is True
    assert is_generic_contact_email("research-office@ox.ac.uk") is True


def test_job_board_page_with_accessibility_email_produces_no_leads():
    """Regression test for the observed bug where job board heading and accessibility email became a lead."""
    html = """
    <html>
      <head><title>Search Jobs | Stanford University Careers</title></head>
      <body>
        <div class="header">
          <h1>Open Faculty Positions</h1>
          <p>Explore opportunities to join our distinguished faculty.</p>
        </div>
        <div class="job-list">
          <div class="job-item">
            <h3>Assistant/Associate/Full Professor, University Tenure Line, Dermatology</h3>
          </div>
        </div>
        <footer>
          <p>For accommodations, email <a href="mailto:disability.access@stanford.edu">disability.access@stanford.edu</a></p>
        </footer>
      </body>
    </html>
    """
    contacts = extract_all_contacts(html, "https://facultypositions.stanford.edu/jobs/search")
    assert len(contacts) == 0


def test_mentor_letter_page_with_vpue_email_produces_no_leads():
    """Regression test for navigation heading paired with administrative office email."""
    html = """
    <html>
      <head><title>Request Faculty Mentor Letter | Undergrad Research</title></head>
      <body>
        <nav>
          <h2>Main navigation</h2>
          <ul><li><a href="/home">Home</a></li></ul>
        </nav>
        <div class="main">
          <h1>Requesting a Mentor Letter</h1>
          <p>Guidelines for undergraduate research grants.</p>
        </div>
        <footer>
          <p>Questions: <a href="mailto:vpue-research@stanford.edu">vpue-research@stanford.edu</a></p>
        </footer>
      </body>
    </html>
    """
    contacts = extract_all_contacts(html, "https://undergradresearch.stanford.edu/apply/request-faculty-mentor-letter")
    assert len(contacts) == 0


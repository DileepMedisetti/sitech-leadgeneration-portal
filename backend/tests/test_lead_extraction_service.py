
from app.services.lead_extraction_service import (
    extract_contact_details,
    is_valid_email,
    normalize_email,
)


def test_normalize_email():
    assert normalize_email("  SALES@Example.COM ") == "sales@example.com"


def test_validate_email_syntax():
    assert is_valid_email("person@example.com")
    assert not is_valid_email("invalid-email")


def test_extract_contact_details():
    html = """
    <html>
      <head><title>Contact Page</title></head>
      <body>
        <div itemprop="name">Ravi Kumar</div>
        <a href="mailto:Ravi@Example.com">Email Ravi</a>
        <a href="tel:+911234567890">Call</a>
        <a href="https://www.linkedin.com/in/ravi-kumar/">LinkedIn</a>
      </body>
    </html>
    """

    result = extract_contact_details(
        html,
        "https://example.com/contact",
    )

    assert result["name"] == "Ravi Kumar"
    assert result["email"] == "ravi@example.com"
    assert result["phone_number"] == "+911234567890"
    assert "linkedin.com/in/ravi-kumar" in result["linkedin_url"]
    assert result["source_title"] == "Contact Page"


def test_missing_contact_details():
    result = extract_contact_details(
        "<html><body>No contact details</body></html>",
        "https://example.com",
    )

    assert result["name"] is None
    assert result["email"] is None
    assert result["phone_number"] is None
    assert result["linkedin_url"] is None

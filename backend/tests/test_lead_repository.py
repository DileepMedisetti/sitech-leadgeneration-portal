
from types import SimpleNamespace
from unittest.mock import MagicMock
from app.repositories.lead_repository import create_or_enrich_lead
from app.models.lead import Lead
from app.repositories.lead_repository import (
    normalize_email,
    enrich_existing_lead,
)


def test_normalize_email():
    email = "  TEST@Example.com  "

    result = normalize_email(email)

    assert result == "test@example.com"


def test_enrich_existing_lead_fills_missing_fields():
    existing_lead = SimpleNamespace(
        phone_number=None,
        profession="AI Engineer",
        university=None,
        country="India",
        website=None,
        linkedin_url=None,
        source_url=None,
        source_title=None,
    )

    incoming_data = {
        "phone_number": "9876543210",
        "profession": "Data Scientist",
        "university": "ABC University",
        "country": "USA",
        "website": "https://example.com",
        "linkedin_url": "https://linkedin.com/in/example",
        "source_url": "https://source.example.com",
        "source_title": "Example Source",
    }

    updated = enrich_existing_lead(existing_lead, incoming_data)

    assert updated is True
    assert existing_lead.phone_number == "9876543210"
    assert existing_lead.university == "ABC University"
    assert existing_lead.website == "https://example.com"

    # Existing non-empty values must not be overwritten.
    assert existing_lead.profession == "AI Engineer"
    assert existing_lead.country == "India"


def test_enrich_existing_lead_with_no_missing_fields():
    existing_lead = SimpleNamespace(
        phone_number="9876543210",
        profession="AI Engineer",
        university="ABC University",
        country="India",
        website="https://example.com",
        linkedin_url="https://linkedin.com/in/example",
        source_url="https://source.example.com",
        source_title="Example Source",
    )

    incoming_data = {
        "phone_number": "1111111111",
        "profession": "Data Scientist",
        "university": "XYZ University",
        "country": "USA",
        "website": "https://different.example.com",
        "linkedin_url": "https://linkedin.com/in/different",
        "source_url": "https://different-source.example.com",
        "source_title": "Different Source",
    }

    updated = enrich_existing_lead(existing_lead, incoming_data)

    assert updated is False
    assert existing_lead.phone_number == "9876543210"
    assert existing_lead.profession == "AI Engineer"
    assert existing_lead.university == "ABC University"
def test_create_or_enrich_lead_returns_existing_lead():
    db = MagicMock()

    existing_lead = Lead(
        name="Existing Lead",
        email="test@example.com",
        profession="AI Engineer",
    )

    # The repository finds an existing lead by normalized email.
    db.scalar.return_value = existing_lead

    lead_data = {
        "name": "Another Name",
        "email": " TEST@Example.com ",
        "profession": "Data Scientist",
        "phone_number": "9876543210",
    }

    lead, created = create_or_enrich_lead(db, lead_data)

    assert lead is existing_lead
    assert created is False
    assert lead.email == "test@example.com"
    assert lead.name == "Existing Lead"
    assert lead.profession == "AI Engineer"
    assert lead.phone_number == "9876543210"
    db.add.assert_not_called()



def test_create_or_enrich_lead_creates_new_lead():
    db = MagicMock()

    # No existing lead has this email.
    db.scalar.return_value = None

    lead_data = {
        "name": "New Lead",
        "email": "  NEW@Example.com  ",
        "profession": "AI Engineer",
        "country": "India",
    }

    lead, created = create_or_enrich_lead(db, lead_data)

    assert created is True
    assert lead.name == "New Lead"
    assert lead.email == "new@example.com"
    assert lead.profession == "AI Engineer"
    assert lead.country == "India"

    # The new lead should be added to the SQLAlchemy session.
    db.add.assert_called_once_with(lead)

    # The repository adds the object but doesn't commit the transaction.
    db.commit.assert_not_called()


from typing import Any
from urllib.parse import urlparse
from bs4 import BeautifulSoup

from app.services.extraction.cleaners import (
    clean_text,
    extract_country_from_html,
    extract_institution_from_html,
    normalize_email,
)
from app.services.extraction.strategies import (
    DirectoryTableStrategy,
    FacultyCardStrategy,
    IndividualProfileStrategy,
    JsonLdStrategy,
)


class LeadExtractionCoordinator:
    """Coordinates multiple extraction strategies and merges evidence."""

    def __init__(self):
        self.jsonld_strategy = JsonLdStrategy()
        self.table_strategy = DirectoryTableStrategy()
        self.card_strategy = FacultyCardStrategy()
        self.profile_strategy = IndividualProfileStrategy()

    def extract_contacts(
        self,
        html: str,
        page_url: str,
        search_criteria: dict | None = None,
    ) -> list[dict[str, Any]]:
        """Run all strategies, merge evidence, and return deduplicated contacts."""
        if not html or not isinstance(html, str):
            return []

        soup = BeautifulSoup(html, "html.parser")
        page_title = clean_text(soup.title.get_text(" ", strip=True) if soup.title else None)

        # Extract metadata before altering DOM
        detected_uni, uni_src, uni_conf = extract_institution_from_html(soup, page_url, page_title)
        detected_country, country_src, country_conf = extract_country_from_html(soup, page_url)

        # Contextual criteria fallback
        criteria = search_criteria or {}
        if not detected_uni and criteria.get("university"):
            detected_uni = clean_text(criteria.get("university"))
            uni_src = "search_criteria"
        if not detected_country and criteria.get("country"):
            detected_country = clean_text(criteria.get("country"))
            country_src = "search_criteria"

        # 1. JSON-LD extraction
        structured = self.jsonld_strategy.extract(soup, page_url, search_criteria)

        # Clean noise tags for HTML structural extraction
        for tag in soup.select("script, style, noscript, template, svg, nav, footer"):
            tag.decompose()

        # 2. Faculty card extraction
        cards = self.card_strategy.extract(soup, page_url, search_criteria)

        # 3. Directory table extraction
        tables = self.table_strategy.extract(soup, page_url, search_criteria)

        # 4. Individual profile fallback only if structured/cards/tables found nothing
        profiles = []
        if not structured and not cards and not tables:
            profiles = self.profile_strategy.extract(soup, page_url, page_title, search_criteria)

        all_candidates = structured + cards + tables + profiles

        # Merge contacts by identity (email if present, else normalized name + university)
        merged_contacts: dict[str, dict[str, Any]] = {}

        for cand in all_candidates:
            raw_email = cand.get("email")
            clean_email = normalize_email(raw_email) if raw_email else None
            cand["email"] = clean_email

            # Form primary key
            if clean_email:
                key = f"email:{clean_email}"
            else:
                cand_uni = (cand.get("university") or detected_uni or "").lower().strip()
                cand_name = (cand.get("name") or "").lower().strip()
                key = f"name:{cand_name}:{cand_uni}"

            # Check if this person was previously registered under name-only key and now has an email
            cand_name_key = f"name:{(cand.get('name') or '').lower().strip()}:{(cand.get('university') or detected_uni or '').lower().strip()}"
            if clean_email and cand_name_key in merged_contacts and cand_name_key != key:
                existing_without_email = merged_contacts.pop(cand_name_key)
                for fld in (
                    "phone_number", "linkedin_url", "profession",
                    "research_specialization", "department", "website",
                ):
                    if not cand.get(fld) and existing_without_email.get(fld):
                        cand[fld] = existing_without_email[fld]
                merged_contacts[key] = cand
                continue

            if key not in merged_contacts:
                if not cand.get("website"):
                    cand["website"] = page_url
                cand["source_url"] = page_url
                cand["source_title"] = page_title
                if not cand.get("university") and detected_uni:
                    cand["university"] = detected_uni
                if not cand.get("country") and detected_country:
                    cand["country"] = detected_country
                merged_contacts[key] = cand
            else:
                existing = merged_contacts[key]
                if not existing.get("email") and clean_email:
                    existing["email"] = clean_email
                if not existing.get("phone_number") and cand.get("phone_number"):
                    existing["phone_number"] = cand["phone_number"]
                if not existing.get("linkedin_url") and cand.get("linkedin_url"):
                    existing["linkedin_url"] = cand["linkedin_url"]
                if not existing.get("profession") and cand.get("profession"):
                    existing["profession"] = cand["profession"]
                if not existing.get("research_specialization") and cand.get("research_specialization"):
                    existing["research_specialization"] = cand["research_specialization"]
                if not existing.get("department") and cand.get("department"):
                    existing["department"] = cand["department"]
                if not existing.get("website") and cand.get("website"):
                    existing["website"] = cand["website"]
                elif cand.get("website") and cand["website"] != page_url and existing.get("website") == page_url:
                    existing["website"] = cand["website"]
                if cand.get("confidence_score", 0) > existing.get("confidence_score", 0):
                    existing["confidence_score"] = cand["confidence_score"]
                    existing["qualification_status"] = cand["qualification_status"]
                    existing["qualification_reason"] = cand["qualification_reason"]

        return list(merged_contacts.values())

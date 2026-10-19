
import json
import re
from typing import Any
from urllib.parse import urlparse
from bs4 import BeautifulSoup, Tag

from app.services.extraction.cleaners import (
    ACADEMIC_TITLES,
    EMAIL_PATTERN,
    PHONE_PATTERN,
    check_linkedin_name_correlation,
    check_name_email_correlation,
    clean_person_name,
    clean_specialization,
    clean_text,
    extract_designation_and_specialization,
    extract_direct_profile_url,
    extract_linkedin_urls_from_text,
    is_generic_contact_email,
    is_valid_email,
    is_valid_profile_url,
    normalize_email,
    normalize_linkedin_url,
    normalize_phone,
)
from app.services.extraction.qualifier import calculate_qualification_score

NAME_SELECTORS = (
    '[itemprop="name"]',
    '[class*="faculty-name"]',
    '[class*="staff-name"]',
    '[class*="professor-name"]',
    '[class*="person-name"]',
    '[class*="profile-name"]',
    '[class*="member-name"]',
    '[class*="employee-name"]',
    '.name',
    'h2, h3, h4',
)

DESIGNATION_PATTERNS = re.compile(
    r"\b(professor|assoc(?:iate)?\.?\s*prof(?:essor)?|asst\.?\s*prof(?:essor)?|"
    r"assistant\s*professor|associate\s*professor|distinguished\s*professor|"
    r"chair\s*professor|emeritus|visiting\s*professor|adjunct\s*professor|"
    r"lecturer|senior\s*lecturer|principal\s*lecturer|instructor|reader|fellow|"
    r"dean|associate\s*dean|chair|head\s*of\s*department|director|principal\s*investigator|"
    r"researcher|scientist|research\s*scientist|senior\s*scientist|staff\s*scientist|"
    r"dentist|dental\s*surgeon|orthodontist|periodontist|prosthodontist|endodontist|"
    r"neurologist|neurosurgeon|neuroscientist|"
    r"gynecologist|gynaecologist|obstetrician|ob-gyn|ob/gyn|"
    r"doctor|physician|consultant|surgeon|clinical\s*specialist|"
    r"cardiologist|oncologist|dermatologist|pediatrician|psychiatrist|"
    r"ai\s*researcher|computer\s*scientist|data\s*scientist|software\s*engineer)\b",
    re.IGNORECASE,
)


def _extract_emails_from_element(element: Tag) -> set[str]:
    """Find valid, non-generic emails within a specific HTML container."""
    emails: set[str] = set()

    for mailto in element.select('a[href^="mailto:"]'):
        href = mailto.get("href", "")
        clean_addr = href.split(":", 1)[1].split("?", 1)[0].strip()
        if is_valid_email(clean_addr) and not is_generic_contact_email(clean_addr):
            emails.add(normalize_email(clean_addr))

    for candidate in EMAIL_PATTERN.findall(element.get_text(" ", strip=True)):
        if is_valid_email(candidate) and not is_generic_contact_email(candidate):
            emails.add(normalize_email(candidate))

    return emails


def _extract_linkedin_from_element(element: Tag, base_url: str, person_name: str | None = None) -> str | None:
    """Find a personal LinkedIn profile URL within a specific container.

    Checks:
    1. Standard anchor tags with href (case-insensitive, handles scheme-less and relative).
    2. Data attributes and onclick handlers (e.g. data-href, data-url, data-linkedin).
    3. Plain text containing LinkedIn URLs within the element.
    4. Validates personal profile /in/ format and name correlation.
    """
    # 1. Anchor tags
    for a in element.find_all("a", href=True):
        href = a["href"].strip()
        if "linkedin" in href.lower() or href.startswith(("/in/", "in/")):
            clean_li = normalize_linkedin_url(href, base_url)
            if clean_li:
                if person_name and not check_linkedin_name_correlation(clean_li, person_name):
                    continue
                return clean_li

    # 2. Data attributes & onclick
    for tag in element.find_all(True):
        for attr in ("data-href", "data-url", "data-linkedin", "data-link", "content", "onclick"):
            val = tag.get(attr)
            if val and isinstance(val, str) and "linkedin" in val.lower():
                extracted = extract_linkedin_urls_from_text(val)
                for cand in extracted:
                    if person_name and not check_linkedin_name_correlation(cand, person_name):
                        continue
                    return cand
                clean_li = normalize_linkedin_url(val, base_url)
                if clean_li:
                    if person_name and not check_linkedin_name_correlation(clean_li, person_name):
                        continue
                    return clean_li

    # 3. Plain text
    text = element.get_text(" ", strip=True)
    if "linkedin" in text.lower():
        for cand in extract_linkedin_urls_from_text(text):
            if person_name and not check_linkedin_name_correlation(cand, person_name):
                continue
            return cand

    return None


def _extract_phone_from_element(element: Tag) -> str | None:
    """Find a normalized telephone number within a specific container."""
    for tel in element.select('a[href^="tel:"]'):
        href = tel.get("href", "")
        phone = normalize_phone(href)
        if phone:
            return phone

    text = element.get_text(" ", strip=True)
    matches = PHONE_PATTERN.findall(text)
    for m in matches:
        phone = normalize_phone(m)
        if phone:
            return phone

    return None


def _extract_designation_from_element(element: Tag) -> str | None:
    """Extract academic designation/title if present in element."""
    for sel in ('[class*="designation"]', '[class*="title"]', '[class*="role"]', '[class*="position"]', 'td', 'p', 'span'):
        for tag in element.select(sel):
            t = tag.get_text(" ", strip=True)
            if DESIGNATION_PATTERNS.search(t) and len(t) < 80:
                return clean_text(t)
    return None


class JsonLdStrategy:
    """Extract structured Person entities from JSON-LD scripts."""

    def extract(
        self,
        soup: BeautifulSoup,
        page_url: str,
        search_criteria: dict | None = None,
    ) -> list[dict[str, Any]]:
        contacts: list[dict[str, Any]] = []
        crit = search_criteria or {}
        req_prof = (
            crit.get("profession")
            or crit.get("specialization")
            or crit.get("target_discipline")
            or crit.get("department")
            or crit.get("keywords")
        )

        for script in soup.select('script[type="application/ld+json"]'):
            try:
                payload = json.loads(script.string or script.get_text())
            except (TypeError, ValueError, json.JSONDecodeError):
                continue

            def walk(node):
                if isinstance(node, dict):
                    types = node.get("@type", [])
                    types = types if isinstance(types, list) else [types]
                    type_strings = [str(t).casefold() for t in types if isinstance(t, str)]

                    if any(t in {"person", "professor", "scholar", "employee"} for t in type_strings):
                        name = clean_person_name(node.get("name"))
                        if name:
                            raw_email = node.get("email")
                            email = None
                            if isinstance(raw_email, str):
                                raw_email = raw_email.removeprefix("mailto:").strip()
                                if is_valid_email(raw_email) and not is_generic_contact_email(raw_email):
                                    email = normalize_email(raw_email)

                            same_as = node.get("sameAs", [])
                            same_as = same_as if isinstance(same_as, list) else [same_as]
                            if isinstance(node.get("url"), str):
                                same_as.append(node.get("url"))

                            linkedin = None
                            for u in same_as:
                                li = normalize_linkedin_url(u if isinstance(u, str) else "")
                                if li and check_linkedin_name_correlation(li, name):
                                    linkedin = li
                                    break

                            direct_url = None
                            for u_cand in (node.get("url"), node.get("mainEntityOfPage"), node.get("@id")):
                                if isinstance(u_cand, str) and is_valid_profile_url(u_cand) and "linkedin" not in u_cand.lower():
                                    direct_url = u_cand
                                    break
                            if not direct_url:
                                direct_url = page_url

                            job_title = clean_text(node.get("jobTitle"))
                            desig, spec = None, None
                            if job_title:
                                desig, spec = extract_designation_and_specialization(job_title, soup)

                            dept = None
                            raw_dept = node.get("department")
                            if isinstance(raw_dept, dict):
                                dept = clean_text(raw_dept.get("name"))
                            elif isinstance(raw_dept, str):
                                dept = clean_text(raw_dept)

                            if not spec and dept:
                                spec = clean_specialization(dept)

                            knows_about = node.get("knowsAbout")
                            if not spec and knows_about:
                                if isinstance(knows_about, list):
                                    spec = clean_specialization(", ".join(str(k) for k in knows_about[:3]))
                                elif isinstance(knows_about, str):
                                    spec = clean_specialization(knows_about)

                            org = None
                            affiliation = node.get("affiliation") or node.get("worksFor")
                            if isinstance(affiliation, dict):
                                org = clean_text(affiliation.get("name"))
                            elif isinstance(affiliation, str):
                                org = clean_text(affiliation)

                            status, score, reason, evidence = calculate_qualification_score(
                                name=name,
                                email=email,
                                strategy="json_ld",
                                association_strength="exact_jsonld",
                                profession=desig or job_title,
                                research_specialization=spec,
                                department=dept,
                                university=org,
                                phone=normalize_phone(node.get("telephone")),
                                linkedin=linkedin,
                                website=direct_url,
                                requested_profession=req_prof,
                            )

                            contacts.append({
                                "name": name,
                                "email": email,
                                "profession": desig or job_title,
                                "research_specialization": spec,
                                "department": dept,
                                "university": org,
                                "phone_number": normalize_phone(node.get("telephone")),
                                "linkedin_url": linkedin,
                                "website": direct_url,
                                "qualification_status": status,
                                "confidence_score": score,
                                "qualification_reason": reason,
                                "evidence": evidence,
                            })

                    for child in node.values():
                        walk(child)
                elif isinstance(node, list):
                    for child in node:
                        walk(child)

            walk(payload)

        return contacts


class DirectoryTableStrategy:
    """Extract individual faculty contacts from directory table rows (<tr>)."""

    def extract(
        self,
        soup: BeautifulSoup,
        page_url: str,
        search_criteria: dict | None = None,
    ) -> list[dict[str, Any]]:
        contacts: list[dict[str, Any]] = []
        crit = search_criteria or {}
        req_prof = (
            crit.get("profession")
            or crit.get("specialization")
            or crit.get("target_discipline")
            or crit.get("department")
            or crit.get("keywords")
        )

        for table in soup.select("table"):
            for tr in table.select("tr"):
                # Avoid header rows
                if tr.select("th") and not tr.select("td"):
                    continue

                # Find candidate name within this row's cells
                name = None
                for cell in tr.select("td"):
                    cell_text = cell.get_text(" ", strip=True)
                    candidate = clean_person_name(cell_text)
                    if candidate:
                        name = candidate
                        break
                    # Try strong/b or links inside cell
                    for inner in cell.select("a, strong, b, h3, h4, h5"):
                        inner_cand = clean_person_name(inner.get_text(" ", strip=True))
                        if inner_cand:
                            name = inner_cand
                            break
                    if name:
                        break

                if not name:
                    continue

                emails = _extract_emails_from_element(tr)
                email = None
                if len(emails) == 1:
                    email = next(iter(emails))
                elif len(emails) > 1:
                    correlated = [e for e in emails if check_name_email_correlation(name, e)]
                    email = correlated[0] if correlated else next(iter(emails))

                phone = _extract_phone_from_element(tr)
                linkedin = _extract_linkedin_from_element(tr, page_url, person_name=name)
                direct_url = extract_direct_profile_url(tr, page_url, person_name=name)
                designation, specialization = extract_designation_and_specialization(tr, soup)
                if not designation:
                    designation = _extract_designation_from_element(tr)

                # Skip row if it has no email, no designation, no phone, and no linkedin
                if not (email or designation or phone or linkedin):
                    continue

                status, score, reason, evidence = calculate_qualification_score(
                    name=name,
                    email=email,
                    strategy="directory_table",
                    association_strength="table_row",
                    profession=designation,
                    research_specialization=specialization,
                    phone=phone,
                    linkedin=linkedin,
                    website=direct_url,
                    requested_profession=req_prof,
                )

                contacts.append({
                    "name": name,
                    "email": email,
                    "profession": designation,
                    "research_specialization": specialization,
                    "phone_number": phone,
                    "linkedin_url": linkedin,
                    "website": direct_url,
                    "qualification_status": status,
                    "confidence_score": score,
                    "qualification_reason": reason,
                    "evidence": evidence,
                })

        return contacts


class FacultyCardStrategy:
    """Extract faculty members from co-located profile cards/containers."""

    CARD_CONTAINER_CLASSES = (
        "faculty", "staff", "professor", "person", "profile", "member",
        "card", "directory-item", "bio", "team", "teacher",
    )

    def extract(
        self,
        soup: BeautifulSoup,
        page_url: str,
        search_criteria: dict | None = None,
    ) -> list[dict[str, Any]]:
        contacts: list[dict[str, Any]] = []
        crit = search_criteria or {}
        req_prof = (
            crit.get("profession")
            or crit.get("specialization")
            or crit.get("target_discipline")
            or crit.get("department")
            or crit.get("keywords")
        )

        # Find potential card elements
        raw_containers = []
        for tag_name in ("article", "div", "li", "section"):
            for element in soup.find_all(tag_name):
                classes = " ".join(element.get("class", [])).casefold()
                if any(token in classes for token in self.CARD_CONTAINER_CLASSES) or element.get("itemtype") == "http://schema.org/Person":
                    # Ensure container isn't the entire body or a giant page wrapper
                    if len(element.get_text(strip=True)) < 3000:
                        raw_containers.append(element)

        # Filter out parent/collection containers so child cards are not contaminated
        candidate_containers = []
        for c in raw_containers:
            # If c contains 2 or more other candidate containers, it is a list/grid/directory wrapper
            child_candidates = [other for other in raw_containers if other is not c and other in c.descendants]
            if len(child_candidates) >= 2:
                continue

            # If c contains 2 or more distinct person names, it is a multi-person container
            distinct_names = set()
            for sel in NAME_SELECTORS:
                for el in c.select(sel):
                    cand_name = clean_person_name(el.get_text(" ", strip=True))
                    if cand_name:
                        distinct_names.add(cand_name.lower())
            if len(distinct_names) >= 2:
                continue

            # If class indicates a collection/directory and it contains child candidate containers
            classes = " ".join(c.get("class", [])).casefold()
            if any(term in classes for term in ("-directory", "-list", "-grid", "-wrapper", "-container", "-group", "-collection")) and child_candidates:
                continue

            candidate_containers.append(c)

        for container in candidate_containers:
            # Look for a clean name in headings or name classes within this card
            name = None
            for sel in NAME_SELECTORS:
                for el in container.select(sel):
                    cand = clean_person_name(el.get_text(" ", strip=True))
                    if cand:
                        name = cand
                        break
                if name:
                    break

            if not name:
                continue

            emails = _extract_emails_from_element(container)
            email = None
            if len(emails) == 1:
                email = next(iter(emails))
            elif len(emails) > 1:
                correlated = [e for e in emails if check_name_email_correlation(name, e)]
                email = correlated[0] if correlated else next(iter(emails))

            phone = _extract_phone_from_element(container)
            linkedin = _extract_linkedin_from_element(container, page_url, person_name=name)
            direct_url = extract_direct_profile_url(container, page_url, person_name=name)
            designation, specialization = extract_designation_and_specialization(container, soup)
            if not designation:
                designation = _extract_designation_from_element(container)

            # Skip card if it has no email, no designation, no phone, and no linkedin
            if not (email or designation or phone or linkedin):
                continue

            status, score, reason, evidence = calculate_qualification_score(
                name=name,
                email=email,
                strategy="faculty_card",
                association_strength="card_container",
                profession=designation,
                research_specialization=specialization,
                phone=phone,
                linkedin=linkedin,
                website=direct_url,
                requested_profession=req_prof,
            )

            contacts.append({
                "name": name,
                "email": email,
                "profession": designation,
                "research_specialization": specialization,
                "phone_number": phone,
                "linkedin_url": linkedin,
                "website": direct_url,
                "qualification_status": status,
                "confidence_score": score,
                "qualification_reason": reason,
                "evidence": evidence,
            })

        return contacts


NON_PROFILE_PAGE_PATTERN = re.compile(
    r"\b(jobs?|careers?|positions?|vacanc(?:y|ies)|opportunities|openings?|"
    r"search|newsletter|subscribe|bulletin|announcements?|policies|guidelines|"
    r"faq|help|admissions|apply|application|mentor-letter|handbook)\b",
    re.IGNORECASE,
)


class IndividualProfileStrategy:
    """Extract contact from an individual personal faculty profile page."""

    def extract(
        self,
        soup: BeautifulSoup,
        page_url: str,
        page_title: str | None,
        search_criteria: dict | None = None,
    ) -> list[dict[str, Any]]:
        # Discard if URL or title indicates general directory, job board, or policy page
        if NON_PROFILE_PAGE_PATTERN.search(page_url):
            return []
        if page_title and NON_PROFILE_PAGE_PATTERN.search(page_title):
            return []

        # Only applicable if page has exactly one valid personal email across the body
        all_emails = _extract_emails_from_element(soup)
        if len(all_emails) != 1:
            return []
        email = next(iter(all_emails))

        # Check DOM elements for person name: specific name classes first
        candidate_name = None
        for sel in (
            '[itemprop="name"]',
            '[class*="faculty-name"]',
            '[class*="profile-name"]',
            '[class*="person-name"]',
            '[class*="bio-name"]',
        ):
            for el in soup.select(sel):
                cand = clean_person_name(el.get_text(" ", strip=True))
                if cand:
                    candidate_name = cand
                    break
            if candidate_name:
                break

        # Only check h1/h2 if no class-based name was found AND element has strong academic indicator or correlates with email
        if not candidate_name:
            for sel in ("h1", "h2"):
                for el in soup.select(sel):
                    raw = el.get_text(" ", strip=True)
                    cand = clean_person_name(raw)
                    if cand:
                        has_title = any(cand.lower().startswith(t) for t in ACADEMIC_TITLES)
                        has_email_match = check_name_email_correlation(cand, email)
                        if has_title or has_email_match:
                            candidate_name = cand
                            break
                if candidate_name:
                    break

        # Fallback to page title only if title has academic title or email match
        if not candidate_name and page_title:
            parts = [p.strip() for p in re.split(r"\s+[|–—-]\s+", page_title) if p.strip()]
            for part in parts:
                cand = clean_person_name(part)
                if cand:
                    has_title = any(cand.lower().startswith(t) for t in ACADEMIC_TITLES)
                    has_email_match = check_name_email_correlation(cand, email)
                    if has_title or has_email_match:
                        candidate_name = cand
                        break

        if not candidate_name:
            return []

        phone = _extract_phone_from_element(soup)
        linkedin = _extract_linkedin_from_element(soup, page_url, person_name=candidate_name)
        direct_url = extract_direct_profile_url(soup, page_url, person_name=candidate_name) or page_url
        designation, specialization = extract_designation_and_specialization(soup, soup)
        if not designation:
            designation = _extract_designation_from_element(soup)
        correlated = check_name_email_correlation(candidate_name, email)

        criteria = search_criteria or {}
        permit_dept = (
            criteria.get("target_type") == "department"
            or criteria.get("lead_type") == "department"
            or criteria.get("permit_department_contacts", False)
        )
        req_prof = (
            criteria.get("profession")
            or criteria.get("specialization")
            or criteria.get("target_discipline")
            or criteria.get("department")
            or criteria.get("keywords")
        )

        status, score, reason, evidence = calculate_qualification_score(
            name=candidate_name,
            email=email,
            strategy="individual_profile",
            association_strength="single_profile",
            profession=designation,
            research_specialization=specialization,
            phone=phone,
            linkedin=linkedin,
            website=direct_url,
            name_email_correlated=correlated,
            permit_department_contacts=permit_dept,
            requested_profession=req_prof,
        )

        return [{
            "name": candidate_name,
            "email": email,
            "profession": designation,
            "research_specialization": specialization,
            "phone_number": phone,
            "linkedin_url": linkedin,
            "website": direct_url,
            "qualification_status": status,
            "confidence_score": score,
            "qualification_reason": reason,
            "evidence": evidence,
        }]

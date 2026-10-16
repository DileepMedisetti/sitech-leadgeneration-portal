
import ipaddress
import re
import socket
import time
from urllib.parse import urljoin, urlparse

import httpx
from bs4 import BeautifulSoup
from sqlalchemy import select
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.models.lead import Lead
from app.models.search_job import SearchJob
from app.models.search_result import SearchResult
from app.schemas.lead import LeadCreate
from app.services.lead_service import process_lead
from app.services.search_result_service import (
    mark_result_failed,
    mark_result_processed,
    mark_result_skipped,
)


# =========================================================
# EMAIL AND PHONE PATTERNS
# =========================================================

EMAIL_PATTERN = re.compile(
    r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b",
    re.IGNORECASE,
)

PHONE_PATTERN = re.compile(
    r"(?<!\w)(?:\+?\d[\d\s().-]{7,}\d)(?!\w)"
)


# =========================================================
# EMAIL UTILITIES
# =========================================================

def normalize_email(email: str) -> str:
    """Normalize email for consistent deduplication."""
    return email.strip().lower()


def is_valid_email(email: str) -> bool:
    """Check basic email syntax, not mailbox deliverability."""
    return bool(EMAIL_PATTERN.fullmatch(email.strip()))



GENERIC_EMAIL_LOCALPARTS = {
    "admin", "admissions", "admission", "contact", "enquiry", "enquiries",
    "help", "helpdesk", "info", "inquiry", "mail", "office", "registrar",
    "support", "webmaster", "newsletter", "communications",
}


def _is_generic_contact_email(email: str) -> bool:
    """Exclude obvious role inboxes from person-level professor leads."""
    local_part = email.strip().lower().split("@", 1)[0]
    return local_part in GENERIC_EMAIL_LOCALPARTS


# =========================================================
# EXTRACT CONTACT DETAILS
# =========================================================

def _clean_text(value: str | None) -> str | None:
    if not value:
        return None
    value = re.sub(r"\s+", " ", value).strip(" \t\r\n|,:;-")
    return value or None


def _clean_person_name(value: str | None) -> str | None:
    """Reject generic headings and UI labels that are not a person's name."""
    candidate = _clean_text(value)
    if not candidate or len(candidate) > 100 or EMAIL_PATTERN.search(candidate):
        return None

    normalized = re.sub(r"[^a-z ]", "", candidate.casefold()).strip()
    blocked_phrases = (
        "subscribe to our newsletter", "newsletter", "faculty", "our faculty",
        "faculty members", "faculty directory", "faculty profile", "staff",
        "our team", "team", "professor", "professors", "contact", "contact us",
        "admissions", "admission office", "helpdesk", "help desk", "webmaster",
        "editorial board", "read more", "view profile", "view details", "learn more",
        "about us", "home", "login", "sign up", "register", "department",
    )
    if normalized in blocked_phrases:
        return None
    if any(phrase in normalized for phrase in (
        "subscribe to", "newsletter", "helpdesk", "admission office", "contact us",
        "view profile", "read more", "faculty directory",
    )):
        return None

    words = candidate.split()
    if len(words) < 2 or len(words) > 7:
        return None
    if not any(char.isalpha() for char in candidate):
        return None
    # A heading with common page/UI language is not a reliable personal name.
    if re.search(r"\b(university|college|department|faculty|school|directory|profile|newsletter|contact|admission|helpdesk)\b", candidate, re.I):
        return None
    return candidate


def _emails_in_element(element) -> set[str]:
    emails = {
        normalize_email(email)
        for email in EMAIL_PATTERN.findall(element.get_text(" ", strip=True))
        if is_valid_email(email) and not _is_generic_contact_email(email)
    }
    for link in element.select('a[href^="mailto:"]'):
        address = link.get("href", "").split(":", 1)[1].split("?", 1)[0].strip()
        if is_valid_email(address) and not _is_generic_contact_email(address):
            emails.add(normalize_email(address))
    return emails


def _linkedin_in_element(element, base_url: str) -> str | None:
    """Return a LinkedIn personal profile linked from this same contact container."""
    matches = []
    for link in element.select("a[href]"):
        absolute = urljoin(base_url, link.get("href", "").strip())
        parsed = urlparse(absolute)
        host = (parsed.hostname or "").lower()
        if (
            parsed.scheme in {"http", "https"}
            and (host == "linkedin.com" or host.endswith(".linkedin.com"))
            and re.match(r"^/in/[^/]+/?$", parsed.path, re.I)
        ):
            matches.append(absolute.split("?", 1)[0].rstrip("/"))
    unique = sorted(set(matches))
    return unique[0] if len(unique) == 1 else None


def _extract_university(soup: BeautifulSoup, page_url: str, page_title: str | None) -> str | None:
    """Use explicit page metadata/structured data; avoid guessing from a URL slug."""
    for selector in (
        'meta[property="og:site_name"]',
        'meta[name="application-name"]',
        'meta[name="institution"]',
    ):
        meta = soup.select_one(selector)
        if meta and _clean_text(meta.get("content")):
            value = _clean_text(meta.get("content"))
            if value and re.search(r"\b(university|college|institute|school|academy)\b", value, re.I):
                return value

    # Organization name from JSON-LD, when clearly identified as an educational institution.
    import json
    for script in soup.select('script[type="application/ld+json"]'):
        try:
            payload = json.loads(script.string or script.get_text())
        except (TypeError, ValueError):
            continue

        def find_organization(node):
            found = []
            if isinstance(node, dict):
                node_types = node.get("@type", [])
                node_types = node_types if isinstance(node_types, list) else [node_types]
                if any(isinstance(t, str) and t.casefold() in {
                    "collegeoruniversity", "educationalorganization", "university", "college", "school"
                } for t in node_types):
                    name = _clean_text(node.get("name"))
                    if name:
                        found.append(name)
                for child in node.values():
                    found.extend(find_organization(child))
            elif isinstance(node, list):
                for child in node:
                    found.extend(find_organization(child))
            return found

        organizations = list(dict.fromkeys(find_organization(payload)))
        if len(organizations) == 1:
            return organizations[0]

    # Some official pages include the institution in the title, e.g. "Faculty | Example University".
    if page_title:
        title_parts = [part.strip() for part in re.split(r"\s+[|–—-]\s+", page_title) if part.strip()]
        candidates = [part for part in title_parts if re.search(
            r"\b(university|college|institute|academy)\b", part, re.I
        ) and not re.search(r"\b(faculty|directory|profile|contact|newsletter)\b", part, re.I)]
        if candidates:
            return candidates[-1]
    return None


def _extract_country(soup: BeautifulSoup, page_url: str) -> str | None:
    """Use explicit metadata/address or a country-code domain as a cautious fallback."""
    for selector in (
        'meta[name="geo.placename"]',
        'meta[property="og:country-name"]',
        '[itemprop="addressCountry"]',
    ):
        element = soup.select_one(selector)
        value = element.get("content") if element and element.name == "meta" else (
            element.get_text(" ", strip=True) if element else None
        )
        value = _clean_text(value)
        if value:
            return value

    host = (urlparse(page_url).hostname or "").lower()
    # .ac.in / .edu.in are useful India signals; don't infer a country from generic .com/.org.
    if host.endswith((".ac.in", ".edu.in", ".gov.in", ".res.in")):
        return "India"
    return None


def extract_contact_details(
    html: str,
    page_url: str,
    search_criteria: dict | None = None,
) -> dict[str, str | None]:
    """Extract a conservative, internally matched contact from public HTML.

    Name and email must be associated within one profile/card or explicit Person JSON-LD.
    University/country are only returned when supported by metadata, structured data,
    page title, the URL's India academic domain, or the job's explicit criteria.
    """
    soup = BeautifulSoup(html, "html.parser")
    page_title = _clean_text(soup.title.get_text(" ", strip=True) if soup.title else None)

    structured_contacts: list[tuple[str, str, str | None]] = []
    import json
    for script in soup.select('script[type="application/ld+json"]'):
        try:
            payload = json.loads(script.string or script.get_text())
        except (TypeError, ValueError):
            continue

        def walk_jsonld(node):
            if isinstance(node, dict):
                node_type = node.get("@type", [])
                node_type = node_type if isinstance(node_type, list) else [node_type]
                if any(isinstance(t, str) and t.casefold() in {"person", "professor", "employee"} for t in node_type):
                    raw_name, raw_email = node.get("name"), node.get("email")
                    cleaned_name = _clean_person_name(raw_name if isinstance(raw_name, str) else None)
                    cleaned_email = str(raw_email).removeprefix("mailto:").strip() if raw_email else ""
                    same_as = node.get("sameAs", [])
                    same_as = same_as if isinstance(same_as, list) else [same_as]
                    linkedin = None
                    for candidate_url in same_as:
                        if isinstance(candidate_url, str):
                            parsed_same_as = urlparse(candidate_url)
                            host_same_as = (parsed_same_as.hostname or "").lower()
                            if (host_same_as == "linkedin.com" or host_same_as.endswith(".linkedin.com")) and re.match(r"^/in/[^/]+/?$", parsed_same_as.path, re.I):
                                linkedin = candidate_url.split("?", 1)[0].rstrip("/")
                                break
                    if (
                        cleaned_name
                        and is_valid_email(cleaned_email)
                        and not _is_generic_contact_email(cleaned_email)
                    ):
                        structured_contacts.append(
                            (cleaned_name, normalize_email(cleaned_email), linkedin)
                        )
                for child in node.values():
                    walk_jsonld(child)
            elif isinstance(node, list):
                for child in node:
                    walk_jsonld(child)
        walk_jsonld(payload)

    # Capture institution/country metadata before removing scripts or layout sections.
    university = _extract_university(soup, page_url, page_title)
    country = _extract_country(soup, page_url)

    for element in soup.select("script, style, noscript, template, svg, nav, footer, header"):
        # Preserve footer/header only if structured contact data was already read; these areas
        # commonly contain generic support emails and navigation labels.
        element.decompose()

    all_emails = _emails_in_element(soup)
    name_selector = (
        '[itemprop="name"], [class*="faculty-name"], [class*="staff-name"], '
        '[class*="professor-name"], [class*="person-name"], [class*="employee-name"], '
        '[class*="member-name"], [class*="profile-name"], [class*="faculty"] h2, '
        '[class*="faculty"] h3, [class*="staff"] h2, [class*="staff"] h3, '
        '[class*="professor"] h2, [class*="professor"] h3, article h2, article h3, '
        '[itemprop="name"]'
    )
    name_elements = []
    seen = set()
    for element in soup.select(name_selector):
        name = _clean_person_name(element.get_text(" ", strip=True))
        if name and name.casefold() not in seen:
            seen.add(name.casefold())
            name_elements.append((element, name))

    paired_contacts: list[tuple[str, str, str | None]] = []
    for name_element, name in name_elements:
        container = name_element.find_parent(
            lambda tag: getattr(tag, "name", None) in {"article", "li", "tr", "div", "section"}
            and (
                tag.name in {"article", "li", "tr"}
                or any(token in " ".join(tag.get("class", [])).casefold() for token in (
                    "faculty", "staff", "professor", "team-member", "person", "profile",
                    "employee", "member", "contact", "card", "teacher"
                ))
            )
        )
        if container is None:
            continue
        local_emails = _emails_in_element(container)
        if len(local_emails) == 1:
            email = next(iter(local_emails))
            paired_contacts.append((name, email, _linkedin_in_element(container, page_url)))

    # Merge duplicate representations of the same contact by normalized name/email.
    # Prefer a LinkedIn URL only when it was found on that same profile/person record.
    merged_contacts: dict[tuple[str, str], set[str]] = {}
    for contact_name, contact_email, contact_linkedin in structured_contacts + paired_contacts:
        key = (contact_name.casefold(), contact_email.casefold())
        merged_contacts.setdefault(key, set())
        if contact_linkedin:
            merged_contacts[key].add(contact_linkedin)
    if len(merged_contacts) == 1:
        (normalized_name, normalized_email), profile_links = next(iter(merged_contacts.items()))
        matching_contact = next(
            item for item in structured_contacts + paired_contacts
            if item[0].casefold() == normalized_name and item[1].casefold() == normalized_email
        )
        name, email = matching_contact[0], matching_contact[1]
        linkedin_url = sorted(profile_links)[0] if len(profile_links) == 1 else None
    else:
        name, email, linkedin_url = None, None, None

    # Conservative fallback for simple pages with exactly one plausible person
    # and one non-generic email. This supports simple contact pages where the name,
    # mailto link, phone and LinkedIn link are sibling elements rather than a card.
    # Generic role inboxes (helpdesk@, info@, admissions@, etc.) are excluded above.
    if not merged_contacts and len(name_elements) == 1 and len(all_emails) == 1:
        _, candidate_name = name_elements[0]
        candidate_email = next(iter(all_emails))
        if (
            _clean_person_name(candidate_name)
            and is_valid_email(candidate_email)
            and not _is_generic_contact_email(candidate_email)
        ):
            name = candidate_name
            email = candidate_email
            linkedin_url = _linkedin_in_element(soup, page_url)

    parsed_page_url = urlparse(page_url)
    website = f"{parsed_page_url.scheme}://{parsed_page_url.netloc}" if parsed_page_url.scheme and parsed_page_url.netloc else None

    # Extract phone numbers from visible page text and explicit telephone links.
    phone_numbers = {
        phone.strip()
        for phone in PHONE_PATTERN.findall(soup.get_text(" ", strip=True))
        if sum(character.isdigit() for character in phone) >= 9
    }
    for link in soup.select('a[href^="tel:"]'):
        phone = link.get("href", "").removeprefix("tel:").split("?", 1)[0].strip()
        if sum(character.isdigit() for character in phone) >= 9:
            phone_numbers.add(phone)

    criteria_country = (search_criteria or {}).get("country")
    if not country and isinstance(criteria_country, str) and criteria_country.strip():
        country = criteria_country.strip()

    return {
        "name": name,
        "email": email,
        "university": university,
        "country": country,
        "phone_number": sorted(phone_numbers)[0] if phone_numbers else None,
        "linkedin_url": linkedin_url,
        "website": website,
        "source_url": page_url,
        "source_title": page_title,
    }


# =========================================================
# SEARCH RESULT OPERATIONS
# =========================================================

def get_pending_results(
    db: Session,
    job_id: int,
    limit: int = 10,
) -> list[SearchResult]:
    """Fetch pending results for a search job."""

    if limit <= 0:
        raise ValueError("Limit must be greater than zero.")

    statement = (
        select(SearchResult)
        .where(
            SearchResult.search_job_id == job_id,
            SearchResult.status == "pending",
        )
        .order_by(SearchResult.id)
        .limit(limit)
    )

    return list(db.scalars(statement).all())


def validate_job_for_extraction(
    db: Session,
    job_id: int,
) -> SearchJob:
    """Validate that a job exists and permits extraction."""

    job = db.get(SearchJob, job_id)

    if job is None:
        raise ValueError("Search job not found.")

    allowed_statuses = {"running", "stopped", "failed"}

    if job.status not in allowed_statuses:
        raise ValueError(
            f"Cannot extract leads from a job with status '{job.status}'."
        )

    return job


# =========================================================
# PUBLIC URL VALIDATION
# =========================================================

def validate_public_url(url: str) -> str:
    """Allow HTTP(S) URLs resolving exclusively to public IPs."""

    parsed = urlparse(url)

    if parsed.scheme not in {"http", "https"}:
        raise ValueError("Only HTTP and HTTPS URLs are allowed.")

    if not parsed.hostname or parsed.username or parsed.password:
        raise ValueError("Invalid webpage URL.")

    try:
        port = parsed.port or (
            443 if parsed.scheme == "https" else 80
        )

        addresses = socket.getaddrinfo(
            parsed.hostname,
            port,
            type=socket.SOCK_STREAM,
        )

    except (socket.gaierror, ValueError) as exc:
        raise ValueError(
            "Unable to resolve webpage hostname."
        ) from exc

    if not addresses:
        raise ValueError("Hostname has no resolved IP addresses.")

    for address in addresses:
        ip = ipaddress.ip_address(address[4][0])

        if not ip.is_global:
            raise ValueError(
                "Private or non-public IP addresses are not allowed."
            )

    return url


# =========================================================
# FETCH WEBPAGE WITH CONTROLLED RETRIES
# =========================================================

def fetch_webpage(url: str) -> tuple[str, str]:
    """
    Fetch a webpage and return (final_url, html).

    HTTP 403/404:
        Do not retry.

    HTTP 429:
        Retry at most three attempts, respecting numeric
        Retry-After values capped at 30 seconds.

    HTTP 5xx:
        Retry with exponential backoff.

    Network errors/timeouts:
        Retry with exponential backoff.
    """

    max_attempts = 3
    timeout_seconds = 15.0
    max_redirects = 4

    for attempt in range(max_attempts):
        current_url = url
        should_retry = False
        wait_seconds = 0

        try:
            with httpx.Client(
                timeout=timeout_seconds,
                follow_redirects=False,
                headers={
                    "User-Agent": "SitechLeadResearchBot/1.0",
                },
            ) as client:

                for _ in range(max_redirects + 1):
                    current_url = validate_public_url(current_url)

                    response = client.get(current_url)

                    # Validate every redirect destination.
                    if response.is_redirect:
                        location = response.headers.get("location")

                        if not location:
                            raise RuntimeError(
                                "Redirect did not include a destination."
                            )

                        current_url = urljoin(current_url, location)
                        continue

                    status_code = response.status_code

                    # Do not repeatedly retry access restrictions.
                    if status_code in (403, 404):
                        raise RuntimeError(
                            f"HTTP {status_code}: access refused "
                            "or page not found."
                        )

                    # Rate limiting.
                    if status_code == 429:
                        retry_after = response.headers.get("Retry-After")

                        try:
                            wait_seconds = (
                                min(max(int(retry_after), 0), 30)
                                if retry_after is not None
                                else 2 ** attempt
                            )
                        except ValueError:
                            # HTTP-date values fall back to bounded backoff.
                            wait_seconds = 2 ** attempt

                        should_retry = True
                        break

                    # Temporary server errors.
                    if 500 <= status_code <= 599:
                        wait_seconds = 2 ** attempt
                        should_retry = True
                        break

                    response.raise_for_status()

                    content_type = response.headers.get(
                        "content-type", ""
                    ).lower()

                    if (
                        "text/html" not in content_type
                        and "application/xhtml+xml" not in content_type
                    ):
                        raise ValueError(
                            "The webpage does not contain HTML content."
                        )

                    return str(response.url), response.text

                else:
                    raise RuntimeError("Too many webpage redirects.")

            if should_retry:
                if attempt == max_attempts - 1:
                    raise RuntimeError(
                        "Temporary HTTP error persisted after "
                        f"{max_attempts} attempts."
                    )

                time.sleep(wait_seconds)
                continue

        except (httpx.TimeoutException, httpx.NetworkError) as exc:
            if attempt == max_attempts - 1:
                raise RuntimeError(
                    f"Network error after {max_attempts} attempts: "
                    f"{type(exc).__name__}"
                ) from exc

            time.sleep(2 ** attempt)

    raise RuntimeError(
        "Unable to fetch webpage after retry attempts."
    )


# =========================================================
# FAILURE HANDLING
# =========================================================

def _mark_result_as_failed(
    db: Session,
    result_id: int,
    reason: str,
) -> None:
    """Persist a failure after rolling back the current transaction."""

    db.rollback()

    result = db.get(SearchResult, result_id)

    if result is None:
        return

    mark_result_failed(result, reason[:1000])
    db.commit()


# =========================================================
# PROCESS PENDING RESULTS INTO QUALIFIED LEADS
# =========================================================

def process_pending_results(
    db: Session,
    job_id: int,
    limit: int = 10,
) -> dict:
    """
    Process stored URLs without making additional SerpApi calls.

    A qualified lead requires a nonblank name and syntactically
    valid email. Each lead is counted at most once per job.
    """

    if limit <= 0:
        raise ValueError("Limit must be greater than zero.")

    job = validate_job_for_extraction(db, job_id)

    counts = {
        "job_id": job_id,
        "results_processed": 0,
        "leads_created": 0,
        "leads_enriched": 0,
        "qualified_leads_counted": 0,
        "results_skipped": 0,
        "results_failed": 0,
    }

    if job.qualified_leads_found >= job.target_leads:
        counts["message"] = "Qualified lead target already reached."
        return counts

    pending_results = get_pending_results(
        db=db,
        job_id=job_id,
        limit=limit,
    )

    for result in pending_results:
        db.refresh(job)

        if job.qualified_leads_found >= job.target_leads:
            break

        result_id = result.id
        result_url = result.result_url

        # Fetch and parse the webpage.
        try:
            final_url, html = fetch_webpage(result_url)

            details = extract_contact_details(
                html=html,
                page_url=final_url,
                search_criteria=job.search_criteria or {},
            )

        except (
            httpx.HTTPError,
            ValueError,
            RuntimeError,
            OSError,
        ) as exc:
            _mark_result_as_failed(
                db=db,
                result_id=result_id,
                reason=str(exc),
            )

            counts["results_failed"] += 1
            counts["results_processed"] += 1
            continue

        # Validate qualification requirements.
        name = details.get("name")
        email = details.get("email")

        if (
            not isinstance(name, str)
            or not name.strip()
            or not isinstance(email, str)
            or not is_valid_email(email)
        ):
            result = db.get(SearchResult, result_id)

            if result is not None:
                mark_result_skipped(
                    result,
                    "No qualified contact with a valid email was found.",
                )
                db.commit()

            counts["results_skipped"] += 1
            counts["results_processed"] += 1
            continue

        # Save or enrich the lead.
        try:
            lead_data = LeadCreate(
                name=name.strip(),
                email=normalize_email(email),
                university=details.get("university"),
                country=details.get("country"),
                phone_number=details.get("phone_number"),
                linkedin_url=details.get("linkedin_url"),
                website=details.get("website"),
                source_url=details.get("source_url"),
                source_title=details.get("source_title"),
            )

            lead, created = process_lead(
                db=db,
                lead_data=lead_data,
            )

            # Count a lead only once per search job.
            existing_job_result = db.scalar(
                select(SearchResult.id)
                .where(
                    SearchResult.search_job_id == job_id,
                    SearchResult.lead_id == lead.id,
                    SearchResult.status == "processed",
                )
                .limit(1)
            )

            if existing_job_result is None:
                job.qualified_leads_found += 1
                counts["qualified_leads_counted"] += 1

            if created:
                counts["leads_created"] += 1
            else:
                counts["leads_enriched"] += 1

            db.flush()

            result = db.get(SearchResult, result_id)

            if result is None:
                raise ValueError(
                    "Search result disappeared during processing."
                )

            mark_result_processed(result, lead_id=lead.id)

            # Commit lead, result status and job counter together.
            db.commit()

            counts["results_processed"] += 1

        except ValueError as exc:
            _mark_result_as_failed(
                db=db,
                result_id=result_id,
                reason=str(exc),
            )

            counts["results_failed"] += 1
            counts["results_processed"] += 1

        except SQLAlchemyError:
            db.rollback()
            raise

    return counts


# =========================================================
# RETRY POLICY FOR FAILED RESULTS
# =========================================================

RETRYABLE_FAILURE_MARKERS = (
    "temporary http error persisted",
    "network error after",
    "timeout",
    "timed out",
    "connecterror",
    "connecttimeout",
    "readerror",
    "readtimeout",
    "writeerror",
    "writetimeout",
    "remoteprotocolerror",
    "temporarily unavailable",
)


def is_retryable_failure(
    error_message: str | None,
) -> bool:
    """
    Identify known transient failures.

    HTTP 403/404, unsafe URL errors and unknown errors
    are not automatically retried.
    """

    if not error_message:
        return False

    message = error_message.strip().lower()

    if "http 403" in message or "http 404" in message:
        return False

    return any(
        marker in message
        for marker in RETRYABLE_FAILURE_MARKERS
    )


def requeue_retryable_failed_results(
    db: Session,
    job_id: int,
    limit: int = 10,
) -> dict[str, int]:
    """
    Requeue eligible failed results as pending.

    This function makes no HTTP requests and consumes
    no SerpApi credits. Call the extraction endpoint
    separately to process requeued results.
    """

    if limit <= 0:
        raise ValueError("Limit must be greater than zero.")

    validate_job_for_extraction(db, job_id)

    failed_results = list(
        db.scalars(
            select(SearchResult)
            .where(
                SearchResult.search_job_id == job_id,
                SearchResult.status == "failed",
            )
            .order_by(SearchResult.id)
            .limit(limit)
        ).all()
    )

    requeued = 0
    not_retryable = 0

    for result in failed_results:
        if not is_retryable_failure(result.error_message):
            not_retryable += 1
            continue

        result.status = "pending"
        result.error_message = None
        result.processed_at = None
        requeued += 1

    db.commit()

    return {
        "job_id": job_id,
        "failed_results_checked": len(failed_results),
        "results_requeued": requeued,
        "results_not_retryable": not_retryable,
    }

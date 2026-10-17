import ipaddress
import re
import socket
import time
from typing import Any
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
from app.services.extraction.cleaners import (
    EMAIL_PATTERN,
    PHONE_PATTERN,
    check_linkedin_name_correlation,
    check_name_email_correlation,
    clean_person_name,
    clean_text,
    extract_linkedin_urls_from_text,
    is_generic_contact_email,
    is_valid_email,
    normalize_email,
    normalize_linkedin_url,
    normalize_phone,
)
from app.services.extraction.coordinator import LeadExtractionCoordinator
from app.services.lead_service import process_lead
from app.services.search_result_service import (
    mark_result_failed,
    mark_result_processed,
    mark_result_skipped,
)

# Exported helper aliases for backward compatibility with existing tests
_clean_person_name = clean_person_name
_is_generic_contact_email = is_generic_contact_email
_clean_text = clean_text

coordinator = LeadExtractionCoordinator()


def extract_all_contacts(
    html: str,
    page_url: str,
    search_criteria: dict | None = None,
) -> list[dict[str, Any]]:
    """Extract all qualified and candidate contacts discovered on a webpage."""
    return coordinator.extract_contacts(
        html=html,
        page_url=page_url,
        search_criteria=search_criteria,
    )


def extract_contact_details(
    html: str,
    page_url: str,
    search_criteria: dict | None = None,
) -> dict[str, Any]:
    """Extract contact details from public HTML.

    Maintains backward compatibility with tests expecting a single contact dictionary.
    Returns the primary contact or empty structure if no contact found.
    """
    contacts = extract_all_contacts(html, page_url, search_criteria)

    soup = BeautifulSoup(html, "html.parser")
    page_title = clean_text(
        soup.title.get_text(" ", strip=True) if soup.title else None
    )
    parsed_page_url = urlparse(page_url)
    website = (
        f"{parsed_page_url.scheme}://{parsed_page_url.netloc}"
        if parsed_page_url.scheme and parsed_page_url.netloc
        else None
    )

    if not contacts:
        return {
            "name": None,
            "email": None,
            "university": None,
            "country": None,
            "phone_number": None,
            "linkedin_url": None,
            "website": website,
            "source_url": page_url,
            "source_title": page_title,
            "qualification_status": "rejected",
            "confidence_score": 0.0,
            "qualification_reason": "No valid contact found",
            "evidence": None,
        }

    # Prefer the first qualified contact.
    qualified_contacts = [
        contact
        for contact in contacts
        if contact.get("qualification_status") == "qualified"
    ]
    primary = qualified_contacts[0] if qualified_contacts else contacts[0]

    return {
        "name": primary.get("name"),
        "email": primary.get("email"),
        "university": primary.get("university"),
        "country": primary.get("country"),
        "phone_number": primary.get("phone_number"),
        "linkedin_url": primary.get("linkedin_url"),
        "profession": primary.get("profession"),
        "department": primary.get("department"),
        "website": primary.get("website", website),
        "source_url": page_url,
        "source_title": page_title,
        "qualification_status": primary.get("qualification_status", "qualified"),
        "confidence_score": primary.get("confidence_score", 0.85),
        "qualification_reason": primary.get("qualification_reason"),
        "evidence": primary.get("evidence"),
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


def get_counted_lead_ids(db: Session, job_id: int) -> set[int]:
    """Return qualified lead IDs already counted for this search job.

    SearchResult has a single legacy lead_id field. For newly processed
    results, candidate_data also stores all qualified lead IDs found on
    that page.

    This preserves compatibility with existing rows while preventing
    duplicate contacts from inflating the qualified-lead count.
    """
    statement = select(SearchResult).where(
        SearchResult.search_job_id == job_id,
        SearchResult.status == "processed",
    )

    counted_ids: set[int] = set()

    for result in db.scalars(statement).all():
        # Support legacy records that store only one lead_id.
        res_lead_id = getattr(result, "lead_id", None)
        if res_lead_id is not None:
            legacy_lead = db.get(Lead, res_lead_id)

            if (
                legacy_lead is not None
                and legacy_lead.qualification_status == "qualified"
                and legacy_lead.email is not None
                and is_valid_email(legacy_lead.email)
                and not is_generic_contact_email(legacy_lead.email)
            ):
                counted_ids.add(legacy_lead.id)

        candidate_data = getattr(result, "candidate_data", None)


        if isinstance(candidate_data, dict):
            qualified_ids = candidate_data.get("qualified_lead_ids", [])

            if isinstance(qualified_ids, list):
                for lead_id in qualified_ids:
                    try:
                        lead = db.get(Lead, int(lead_id))
                        if (
                            lead is not None
                            and lead.qualification_status == "qualified"
                            and lead.email is not None
                            and is_valid_email(lead.email)
                            and not is_generic_contact_email(lead.email)
                        ):
                            counted_ids.add(int(lead_id))
                    except (TypeError, ValueError):
                        continue

    return counted_ids


def validate_job_for_extraction(
    db: Session,
    job_id: int,
) -> SearchJob:
    """Validate that a job exists and permits extraction."""
    job = db.get(SearchJob, job_id)

    if job is None:
        raise ValueError("Search job not found.")

    allowed_statuses = {"running", "stopped", "failed", "completed"}

    if job.status not in allowed_statuses:
        raise ValueError(
            f"Cannot extract leads from a job with status '{job.status}'."
        )

    return job


# =========================================================
# PUBLIC URL VALIDATION & SSRF MITIGATION
# =========================================================

def validate_public_url(url: str) -> str:
    """Allow HTTP(S) URLs resolving exclusively to public globally-routable IPs."""
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
    """Fetch a webpage safely and return (final_url, html).

    - HTTP 403/404: Do not retry.
    - HTTP 429: Retry with bounded backoff.
    - HTTP 5xx / Network / Timeout: Retry with bounded exponential backoff.
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
                    "User-Agent": (
                        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                        "AppleWebKit/537.36 (KHTML, like Gecko) "
                        "Chrome/120.0.0.0 Safari/537.36 SitechLeadBot/2.0"
                    ),
                    "Accept": (
                        "text/html,application/xhtml+xml,"
                        "application/xml;q=0.9,*/*;q=0.8"
                    ),
                },
            ) as client:

                for _ in range(max_redirects + 1):
                    current_url = validate_public_url(current_url)
                    response = client.get(current_url)

                    # Validate redirect destinations on the next iteration.
                    if response.is_redirect:
                        location = response.headers.get("location")

                        if not location:
                            raise RuntimeError(
                                "Redirect did not include a destination."
                            )

                        current_url = urljoin(current_url, location)
                        continue

                    status_code = response.status_code

                    # Do not retry permanent access restrictions.
                    if status_code in (403, 404):
                        raise RuntimeError(
                            f"HTTP {status_code}: access refused or page not found."
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
                            wait_seconds = 2 ** attempt

                        should_retry = True
                        break

                    # Server errors.
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

    raise RuntimeError("Unable to fetch webpage after retry attempts.")


def _mark_result_as_failed(
    db: Session,
    result_id: int,
    reason: str,
) -> None:
    """Persist a failure after rolling back the transaction."""
    db.rollback()

    result = db.get(SearchResult, result_id)

    if result is None:
        return

    result.retry_count = (result.retry_count or 0) + 1
    mark_result_failed(result, reason[:1000])
    db.commit()


# =========================================================
# PROCESS PENDING RESULTS INTO QUALIFIED LEADS
# =========================================================

IRRELEVANT_RESULT_URL_PATTERN = re.compile(
    r"(indeed\.com|glassdoor\.com|monster\.com|linkedin\.com/jobs|ziprecruiter\.com|"
    r"simplyhired\.com|lever\.co|greenhouse\.io|myworkdayjobs\.com|smartrecruiters\.com|"
    r"//jobs\.[a-z0-9\-]+|//careers\.[a-z0-9\-]+|"
    r"/jobs/|/careers/|/employment/|/job-openings/|/apply/|/vacancies/)",
    re.IGNORECASE,
)


def process_pending_results(
    db: Session,
    job_id: int,
    limit: int = 10,
) -> dict[str, Any]:
    """Process stored URLs without consuming additional SerpApi requests.

    Extracts multi-contact directories, creates or enriches leads,
    enforces qualification criteria, and increments job progress.
    """
    if limit <= 0:
        raise ValueError("Limit must be greater than zero.")

    job = validate_job_for_extraction(db, job_id)

    counts: dict[str, Any] = {
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

    # Track unique qualified leads already counted for this job.
    counted_lead_ids = get_counted_lead_ids(db, job_id)

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

        # Pre-fetch filtering: skip known job boards and non-faculty aggregators
        if IRRELEVANT_RESULT_URL_PATTERN.search(result_url):
            res = db.get(SearchResult, result_id)
            if res is not None:
                mark_result_skipped(
                    res,
                    "Skipped: URL matches non-faculty job portal or employment aggregator pattern.",
                )
                db.commit()
            counts["results_skipped"] += 1
            counts["results_processed"] += 1
            continue

        # If result_url is a direct personal LinkedIn profile
        is_direct_linkedin = bool(normalize_linkedin_url(result_url))
        if is_direct_linkedin:
            res_title_txt = getattr(result, "result_title", "") or ""
            res_snippet_txt = getattr(result, "result_snippet", "") or ""
            text_context = f"{res_title_txt} {res_snippet_txt}"
            emails_in_snippet = [
                e for e in EMAIL_PATTERN.findall(text_context)
                if is_valid_email(e) and not is_generic_contact_email(e)
            ]
            if not emails_in_snippet:
                res = db.get(SearchResult, result_id)
                if res is not None:
                    mark_result_skipped(
                        res,
                        "Skipped: LinkedIn profile search result does not publish a personal email address.",
                    )
                    db.commit()
                counts["results_skipped"] += 1
                counts["results_processed"] += 1
                continue

        try:
            final_url, html = fetch_webpage(result_url)

            contacts = extract_all_contacts(
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

        if not contacts:
            res = db.get(SearchResult, result_id)

            if res is not None:
                mark_result_skipped(
                    res,
                    "No qualified contact with a valid email was found.",
                )
                db.commit()

            counts["results_skipped"] += 1
            counts["results_processed"] += 1
            continue

        # Track every lead saved from this page, as well as qualified leads.
        saved_lead_ids: list[int] = []
        qualified_lead_ids_for_result: list[int] = []

        try:
            for contact in contacts:
                if job.qualified_leads_found >= job.target_leads:
                    break

                raw_name = contact.get("name")
                if not raw_name or not isinstance(raw_name, str) or not raw_name.strip():
                    continue

                cleaned_name = clean_person_name(raw_name)
                if not cleaned_name:
                    continue

                # 2. Email validation: MANDATORY. Reject missing or invalid email addresses.
                raw_email = contact.get("email")
                if not raw_email or not isinstance(raw_email, str) or not raw_email.strip():
                    # Person has no email -> skip completely. Do not insert into PostgreSQL.
                    continue

                clean_email = normalize_email(raw_email)
                if not is_valid_email(clean_email):
                    # Invalid format -> skip completely.
                    continue

                # 3. Reject generic addresses when personal email is required
                if is_generic_contact_email(clean_email):
                    # Generic address (info@, contact@, support@, admissions@, etc.) -> skip completely.
                    continue

                # 4. Association verification:
                # Reject if candidate qualification was rejected or has unconfirmed/ambiguous association
                if contact.get("qualification_status") == "rejected":
                    continue

                evidence = contact.get("evidence") or {}
                if evidence.get("rejection_reason"):
                    continue
                if evidence.get("flag") in {"unconfirmed_association", "ambiguous_association"}:
                    continue

                # Verify email is actually associated with the identified person
                if evidence.get("strategy") == "individual_profile":
                    if not check_name_email_correlation(cleaned_name, clean_email):
                        continue

                # 1. LinkedIn profile URL extraction:
                # Check contact's extracted linkedin_url
                raw_li = contact.get("linkedin_url")
                clean_li = normalize_linkedin_url(raw_li, base_url=final_url) if raw_li else None
                if clean_li and not check_linkedin_name_correlation(clean_li, cleaned_name):
                    clean_li = None

                # If missing from contact HTML, check search result context (result_url, snippet, title)
                if not clean_li:
                    res_url = getattr(result, "result_url", None)
                    if res_url:
                        li_cand = normalize_linkedin_url(res_url)
                        if li_cand and check_linkedin_name_correlation(li_cand, cleaned_name):
                            clean_li = li_cand
                    res_snippet = getattr(result, "result_snippet", None)
                    if not clean_li and res_snippet:
                        for cand_url in extract_linkedin_urls_from_text(res_snippet):
                            if check_linkedin_name_correlation(cand_url, cleaned_name):
                                clean_li = cand_url
                                break
                    res_title = getattr(result, "result_title", None)
                    if not clean_li and res_title:
                        for cand_url in extract_linkedin_urls_from_text(res_title):
                            if check_linkedin_name_correlation(cand_url, cleaned_name):
                                clean_li = cand_url
                                break

                lead_data = LeadCreate(
                    name=cleaned_name,
                    email=clean_email,
                    profession=contact.get("profession"),
                    department=contact.get("department"),
                    research_specialization=contact.get(
                        "research_specialization"
                    ),
                    university=contact.get("university"),
                    country=contact.get("country"),
                    phone_number=contact.get("phone_number"),
                    linkedin_url=clean_li,
                    website=contact.get("website"),
                    source_url=contact.get("source_url") or final_url,
                    source_title=contact.get("source_title") or getattr(result, "result_title", None),
                    qualification_status="qualified",
                    confidence_score=max(0.80, contact.get("confidence_score", 0.85)),
                    qualification_reason=contact.get("qualification_reason") or "Verified individual academic lead with confirmed personal email",
                    evidence=contact.get("evidence"),
                    search_job_id=job_id,
                )

                lead, created = process_lead(
                    db=db,
                    lead_data=lead_data,
                )

                # Keep each lead ID only once for this result.
                if lead.id not in saved_lead_ids:
                    saved_lead_ids.append(lead.id)

                if lead.qualification_status == "qualified":
                    if lead.id not in qualified_lead_ids_for_result:
                        qualified_lead_ids_for_result.append(lead.id)

                    # Count each qualified lead at most once per job.
                    if lead.id not in counted_lead_ids:
                        job.qualified_leads_found += 1
                        counts["qualified_leads_counted"] += 1
                        counted_lead_ids.add(lead.id)

                if created:
                    counts["leads_created"] += 1
                else:
                    counts["leads_enriched"] += 1

            db.flush()

            res = db.get(SearchResult, result_id)

            if res is not None:
                primary_lead_id = (
                    saved_lead_ids[0] if saved_lead_ids else None
                )

                if saved_lead_ids:
                    mark_result_processed(
                        res,
                        lead_id=primary_lead_id,
                    )
                    res.candidate_data = {
                        "contacts_found": len(contacts),
                        "leads_saved": len(saved_lead_ids),
                        "saved_lead_ids": saved_lead_ids,
                        "qualified_lead_ids": qualified_lead_ids_for_result,
                    }
                else:
                    mark_result_skipped(
                        res,
                        "No qualified contact with a valid, person-specific email was found.",
                    )
                    res.candidate_data = {
                        "contacts_found": len(contacts),
                        "leads_saved": 0,
                        "saved_lead_ids": [],
                        "qualified_lead_ids": [],
                    }
                    counts["results_skipped"] += 1

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


def is_retryable_failure(error_message: str | None) -> bool:
    """Identify transient failures eligible for retry."""
    if not error_message:
        return False

    message = error_message.strip().lower()

    if "http 403" in message or "http 404" in message:
        return False

    if "private or non-public" in message:
        return False

    return any(
        marker in message
        for marker in RETRYABLE_FAILURE_MARKERS
    )


def requeue_retryable_failed_results(
    db: Session,
    job_id: int,
    limit: int = 10,
    max_retries: int = 3,
) -> dict[str, int]:
    """Requeue eligible failed results without making HTTP or SerpApi calls."""
    if limit <= 0:
        raise ValueError("Limit must be greater than zero.")

    validate_job_for_extraction(db, job_id)

    failed_results = list(
        db.scalars(
            select(SearchResult)
            .where(
                SearchResult.search_job_id == job_id,
                SearchResult.status == "failed",
                SearchResult.retry_count < max_retries,
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
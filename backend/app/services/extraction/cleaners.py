
import re
from urllib.parse import urljoin, urlparse
from bs4 import BeautifulSoup

# Regex patterns
EMAIL_PATTERN = re.compile(
    r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b",
    re.IGNORECASE,
)

PHONE_PATTERN = re.compile(
    r"(?<!\w)(?:\+?\d{1,4}[-.\s]?)?(?:\(?\d{2,5}\)?[-.\s]?)?\d{3,5}[-.\s]?\d{3,5}(?!\w)"
)

# Known generic email prefixes / compounds / keywords
GENERIC_EMAIL_EXACT = {
    "admin", "administrator", "admissions", "admission", "admit", "alumni", "bursar",
    "career", "careers", "compliance", "contact", "contactus", "copyright", "dean-office",
    "deanoffice", "department", "dept", "development", "disability", "diversity",
    "enquiries", "enquiry", "equal-opportunity", "exam", "examination", "facilities",
    "faculty-search", "facultypositions", "feedback", "finance", "financialaid",
    "frontdesk", "general", "generalcounsel", "grants", "head", "help", "helpdesk",
    "hiring", "hod", "hr", "hr-help", "info", "information", "inquiries", "inquiry",
    "jobs", "jobs-faculty", "legal", "library", "mail", "marketing", "media",
    "newsletter", "no-reply", "noreply", "donotreply", "office", "ombuds", "ombudsperson",
    "operator", "osp", "placement", "police", "president", "press", "principal",
    "privacy", "provost", "queries", "query", "reception", "recruitment", "registrar",
    "rector", "research-admin", "research-office", "sales", "security", "servicedesk",
    "sponsoredprograms", "support", "switchboard", "titleix", "vprovost", "vpue",
    "webmaster", "access", "accessibility", "accommodations", "ada",
}

GENERIC_EMAIL_SUBSTRINGS = (
    "helpdesk", "admissions", "admission", "contact", "enquiry", "inquiry", "support",
    "webmaster", "newsletter", "feedback", "career", "recruitment", "hiring",
    "info@", "sales@", "billing@", "no-reply", "noreply", "donotreply", "office@",
    "disability", "accessibility", "compliance", "research-office", "research.office",
    "research_office", "vpue", "provost", "faculty-search", "facultypositions",
    "switchboard", "operator", "frontdesk", "reception", "generalcounsel",
)

CRITICAL_BLOCKED_NAME_WORDS = {
    "positions", "position", "navigation", "nav", "menu", "sidebar", "footer", "header",
    "newsletter", "subscribe", "subscription", "bulletin", "development", "helpdesk",
    "admissions", "admission", "careers", "career", "jobs", "job", "privacy", "disclaimer",
    "policy", "policies", "terms", "vacancies", "vacancy", "openings", "opening",
    "services", "solutions", "technologies", "technology", "overview", "details",
    "directory", "listings", "listing", "breadcrumbs", "breadcrumb", "guidelines",
    "handbook", "instructions", "portal", "website", "accessibility", "accommodations",
    "map", "maps", "index", "indices", "campus",
}

BLOCKED_NAME_WORDS = {
    "contact", "page", "home", "about", "welcome", "index", "site", "portal",
    "services", "careers", "jobs", "team", "staff", "faculty", "directory",
    "newsletter", "subscribe", "login", "register", "admissions", "helpdesk",
    "support", "department", "school", "college", "university", "software",
    "development", "privacy", "policy", "terms", "conditions", "disclaimer",
    "overview", "details", "profile", "view", "read", "more", "search",
    "menu", "navigation", "footer", "header", "sidebar", "member", "members",
    "positions", "position", "open", "main", "links", "accessibility", "access",
    "vacancies", "vacancy", "openings", "hiring", "recruitment", "solutions",
    "technologies", "news", "articles", "announcements", "bulletin", "updates",
    "map", "maps", "campus",
}

NON_PERSON_PHRASE_REGEX = re.compile(
    r"\b(positions?|openings?|vacanc(?:y|ies)|hiring|recruitment|careers?|opportunities|"
    r"navigation|menu|header|footer|sidebar|breadcrumbs?|quick\s+links|skip\s+to\s+content|"
    r"newsletters?|subscriptions?|bulletins?|stay\s+updated|mailing\s+list|"
    r"software\s+development|web\s+development|mobile\s+development|app\s+development|"
    r"it\s+services|consulting\s+services|solutions\s+and\s+services|technologies|"
    r"all\s+rights\s+reserved|copyright|privacy\s+policy|terms\s+of\s+use|terms\s+and\s+conditions|"
    r"department\s+of|school\s+of|college\s+of|institute\s+of|center\s+for|division\s+of|"
    r"faculty\s+directory|staff\s+directory|personnel\s+directory|open\s+faculty|faculty\s+positions?|"
    r"campus\s+map|site\s+index|accessibility\s+services|apply\s+online|join\s+our\s+team|"
    r"to\s+our|for\s+our|about\s+us|contact\s+us|work\s+with\s+us|how\s+to\s+apply)\b",
    re.IGNORECASE,
)

IMPERATIVE_ACTION_REGEX = re.compile(
    r"^(open|subscribe|apply|join|explore|discover|view|read|learn|click|find|select|"
    r"request|download|login|register|submit|search)\b",
    re.IGNORECASE,
)

ACADEMIC_TITLES = (
    "prof.", "professor", "assoc. prof.", "associate professor",
    "asst. prof.", "assistant professor", "dr.", "doctor", "mr.", "mrs.", "ms.",
    "shri", "smt.", "dean", "chair", "lecturer", "fellow", "postdoc",
)


def normalize_email(email: str) -> str:
    """Normalize email for consistent deduplication and lookup."""
    return email.strip().lower()


def is_valid_email(email: str) -> bool:
    """Verify email format compliance."""
    if not email or not isinstance(email, str):
        return False
    return bool(EMAIL_PATTERN.fullmatch(email.strip()))


def is_generic_contact_email(email: str) -> bool:
    """Detect if an email belongs to a department, helpdesk, or general role inbox."""
    if not email or not isinstance(email, str):
        return True
    cleaned = email.strip().lower()
    if "@" not in cleaned:
        return True
    local_part = cleaned.split("@", 1)[0]

    if local_part in GENERIC_EMAIL_EXACT:
        return True

    for sub in GENERIC_EMAIL_SUBSTRINGS:
        if sub in cleaned or sub in local_part:
            return True

    # Token-based check for delimited local parts (e.g. disability.access, vpue-research)
    tokens = re.split(r"[._\-+]", local_part)
    if any(t in GENERIC_EMAIL_EXACT for t in tokens if t):
        return True

    for role in (
        "helpdesk", "support", "office", "desk", "admissions", "enquiry",
        "careers", "career", "access", "disability", "research-office",
    ):
        if local_part.endswith(role) or local_part.startswith(role):
            return True

    return False


def clean_text(value: str | None) -> str | None:
    """Collapse whitespace and strip punctuation."""
    if not value or not isinstance(value, str):
        return None
    value = re.sub(r"\s+", " ", value).strip(" \t\r\n|,:;-")
    return value or None


def clean_person_name(value: str | None) -> str | None:
    """Validate and clean an extracted individual's name.

    Rejects generic UI text, department headings, newsletter titles,
    job vacancies, and non-person phrases.
    """
    candidate = clean_text(value)
    if not candidate or len(candidate) > 80 or len(candidate) < 3:
        return None

    if EMAIL_PATTERN.search(candidate):
        return None

    # Discard non-person phrases, website sections, action verbs
    if NON_PERSON_PHRASE_REGEX.search(candidate):
        return None

    if IMPERATIVE_ACTION_REGEX.search(candidate):
        return None

    normalized = re.sub(r"[^a-z ]", "", candidate.casefold()).strip()
    words = normalized.split()
    if not words or len(words) < 2 or len(words) > 6:
        return None

    # If any word is in the critical blocked set
    if any(w in CRITICAL_BLOCKED_NAME_WORDS for w in words):
        return None

    # If all or most words are general site vocabulary
    blocked_count = sum(1 for w in words if w in BLOCKED_NAME_WORDS)
    if blocked_count >= 1 and len(words) <= 2:
        return None
    if blocked_count >= len(words) // 2 + 1:
        return None

    # Discard if it contains institutional labels without proper name
    if re.search(r"\b(university|college|department|school|institute)\b", candidate, re.IGNORECASE):
        if not re.search(r"\b(dr\.|prof\.|shri|mr\.|ms\.)\b", candidate, re.IGNORECASE):
            return None
        if re.search(r"^(department|school|faculty|college|university)\b", candidate, re.IGNORECASE):
            return None

    # Remove recognized titles from candidate to examine base name
    working_name = candidate
    for title in ACADEMIC_TITLES:
        working_name = re.sub(rf"^{re.escape(title)}\s+", "", working_name, flags=re.IGNORECASE).strip()

    base_words = [w for w in working_name.split() if any(c.isalpha() for c in w)]
    if len(base_words) < 2 and not any(candidate.lower().startswith(t) for t in ACADEMIC_TITLES):
        return None

    # Must not contain numbers or suspicious symbols
    if re.search(r"[\d@#$%^*_+=\[\]{}<>/\\]", candidate):
        return None

    return candidate


def check_name_email_correlation(name: str | None, email: str | None) -> bool:
    """Verify if the email username shares tokens with the person's name."""
    if not name or not email or "@" not in email:
        return False
    local = email.split("@", 1)[0].lower()
    name_clean = re.sub(r"[^a-zA-Z\s]", " ", name).casefold()
    tokens = [t for t in name_clean.split() if len(t) >= 2]
    if not tokens:
        return False

    # Check for direct token presence (e.g. patel, amit, smith)
    for token in tokens:
        if len(token) >= 3 and token in local:
            return True

    # Check for initial + surname (e.g. apatel, rsharma, jsmith)
    if len(tokens) >= 2:
        initial_plus_last = f"{tokens[0][0]}{tokens[-1]}"
        if initial_plus_last in local:
            return True
        first_plus_initial = f"{tokens[0]}{tokens[-1][0]}"
        if first_plus_initial in local:
            return True

    return False


def normalize_phone(value: str | None) -> str | None:
    """Validate and normalize phone numbers."""
    if not value or not isinstance(value, str):
        return None
    cleaned = clean_text(value)
    if not cleaned:
        return None
    cleaned = re.sub(r"^(tel|phone|call|ph|mobile|contact)\s*:\s*", "", cleaned, flags=re.IGNORECASE).strip()
    digits = [c for c in cleaned if c.isdigit()]
    if len(digits) < 8 or len(digits) > 16:
        return None
    return cleaned


RESERVED_LINKEDIN_PATHS = {
    "company", "companies", "school", "schools", "showcase", "feed",
    "search", "pulse", "jobs", "job", "learning", "login", "signup",
    "help", "settings", "groups", "in", "sharearticle", "messaging",
    "notifications", "mypreferences", "psettings", "safety", "help",
    "uas", "checkpoint", "cap", "m",
}

LINKEDIN_PROFILE_REGEX = re.compile(
    r"(?:https?://)?(?:[a-zA-Z0-9_\-]+\.)?linkedin\.com/in/([a-zA-Z0-9_\-\.%]+)/?(?:\?[^\s\"'<>]*)?",
    re.IGNORECASE,
)


def normalize_linkedin_url(url: str | None, base_url: str = "") -> str | None:
    """Validate, clean, and normalize personal LinkedIn profile URLs.

    - Resolves relative or scheme-less URLs.
    - Strips query parameters, tracking tokens (?trk=, ?utm_=, etc.), and URL fragments.
    - Rejects LinkedIn company pages, school pages, search pages, job postings, and non-personal URLs.
    - Rejects empty profile slugs or reserved directory names.
    - Normalizes canonical individual profile URLs to 'https://www.linkedin.com/in/<username>'.
    - Returns None if not a valid personal LinkedIn profile URL. Never fabricates.
    """
    if not url or not isinstance(url, str):
        return None
    url = url.strip().strip("'\"<>()[]")
    if not url:
        return None

    # Handle scheme-less URLs (e.g. www.linkedin.com/in/... or linkedin.com/in/...)
    if url.startswith("//"):
        url = "https:" + url
    elif not url.startswith(("http://", "https://")):
        if (
            url.lower().startswith(("linkedin.com", "www.linkedin.com"))
            or re.match(r"^[a-z]{2,3}\.linkedin\.com", url.lower())
        ):
            url = "https://" + url

    absolute = urljoin(base_url, url) if base_url else url
    parsed = urlparse(absolute)
    host = (parsed.hostname or "").lower()

    # Must be on a LinkedIn domain
    if not (host == "linkedin.com" or host.endswith(".linkedin.com")):
        return None

    # Reject non-web subdomains
    if host in {"api.linkedin.com", "media.linkedin.com", "static.linkedin.com"}:
        return None

    path = parsed.path.strip()

    # Must contain /in/<slug>
    match = re.match(r"^/in/([a-zA-Z0-9_\-\.%]+)/?$", path, re.IGNORECASE)
    if not match:
        return None

    slug = match.group(1).strip().strip("/")
    if not slug:
        return None

    # Reject reserved directory names that are not individual profiles
    if slug.lower() in RESERVED_LINKEDIN_PATHS:
        return None

    # Slug must not consist purely of punctuation
    if not any(c.isalnum() for c in slug):
        return None

    return f"https://www.linkedin.com/in/{slug.lower()}"


def extract_linkedin_urls_from_text(text: str | None) -> list[str]:
    """Extract and normalize all personal LinkedIn profile URLs found in text."""
    if not text or not isinstance(text, str):
        return []
    matches = LINKEDIN_PROFILE_REGEX.findall(text)
    results = []
    seen = set()
    for m in matches:
        cand = normalize_linkedin_url(f"https://www.linkedin.com/in/{m}")
        if cand and cand not in seen:
            seen.add(cand)
            results.append(cand)
    return results


def check_linkedin_name_correlation(linkedin_url: str | None, person_name: str | None) -> bool:
    """Verify if the LinkedIn personal URL slug correlates with the person's name."""
    if not linkedin_url or not person_name:
        return True
    parsed = urlparse(linkedin_url)
    slug = parsed.path.lower().removeprefix("/in/").rstrip("/")
    if not slug:
        return True

    # Strip academic titles and punctuation from name
    name_clean = re.sub(r"[^a-zA-Z\s]", " ", person_name).casefold()
    tokens = [t for t in name_clean.split() if len(t) >= 2 and t not in ACADEMIC_TITLES]
    if not tokens:
        return True

    slug_parts = set(re.split(r"[-_.]", slug))

    # Direct token match (length >= 3)
    if any(t in slug or t in slug_parts for t in tokens if len(t) >= 3):
        return True

    # Initial + surname correlation (e.g. aturing, jsmith, rsharma)
    if len(tokens) >= 2:
        initial_plus_last = f"{tokens[0][0]}{tokens[-1]}"
        if initial_plus_last in slug or initial_plus_last in slug_parts:
            return True
        first_plus_initial = f"{tokens[0]}{tokens[-1][0]}"
        if first_plus_initial in slug or first_plus_initial in slug_parts:
            return True

    # If all tokens are very short (e.g. "Bo An"), check if any token is in slug
    if all(len(t) < 3 for t in tokens):
        return any(t in slug for t in tokens)

    return False


def clean_institution_name(name: str | None) -> str | None:
    """Strip website section noise from detected institution names."""
    if not name or not isinstance(name, str):
        return None
    cleaned = clean_text(name)
    if not cleaned:
        return None
    cleaned = re.sub(
        r"\s*[-|–—]\s*(careers?|jobs?|positions?|openings?|directory|portal|staff|faculty|vacancies)\b.*$",
        "",
        cleaned,
        flags=re.IGNORECASE,
    ).strip()
    cleaned = re.sub(
        r"\b(careers?|jobs?|positions?|openings?|portal|vacancies)\b",
        "",
        cleaned,
        flags=re.IGNORECASE,
    ).strip(" -|:")
    return clean_text(cleaned)


def extract_institution_from_html(soup: BeautifulSoup, page_url: str, page_title: str | None) -> tuple[str | None, str, float]:
    """Identify the institution from metadata or page structure."""
    for selector, src in (
        ('meta[property="og:site_name"]', "meta_og_site_name"),
        ('meta[name="institution"]', "meta_institution"),
        ('meta[name="application-name"]', "meta_application_name"),
    ):
        meta = soup.select_one(selector)
        if meta and meta.get("content"):
            val = clean_text(meta.get("content"))
            if val and re.search(r"\b(university|college|institute|school|academy|iit|nit|iiit|bits)\b", val, re.IGNORECASE):
                cleaned_val = clean_institution_name(val)
                if cleaned_val:
                    return cleaned_val, src, 0.9

    if page_title:
        parts = [p.strip() for p in re.split(r"\s+[|–—-]\s+", page_title) if p.strip()]
        for p in reversed(parts):
            if re.search(r"\b(university|college|institute|academy|iit|nit|iiit)\b", p, re.IGNORECASE):
                if not re.search(r"\b(faculty|directory|department|profile|contact|admissions)\b", p, re.IGNORECASE):
                    cleaned_p = clean_institution_name(p)
                    if cleaned_p and re.search(r"\b(university|college|institute|academy|iit|nit|iiit)\b", cleaned_p, re.IGNORECASE):
                        return cleaned_p, "page_title", 0.75

    return None, "none", 0.0


def extract_country_from_html(soup: BeautifulSoup, page_url: str) -> tuple[str | None, str, float]:
    """Identify the country from metadata or top-level academic domain."""
    for selector in ('meta[name="geo.placename"]', 'meta[property="og:country-name"]', '[itemprop="addressCountry"]'):
        el = soup.select_one(selector)
        val = el.get("content") if el and el.name == "meta" else (el.get_text(" ", strip=True) if el else None)
        cleaned = clean_text(val)
        if cleaned:
            return cleaned, "metadata", 0.85

    host = (urlparse(page_url).hostname or "").lower()
    if host.endswith((".ac.in", ".edu.in", ".gov.in", ".res.in", ".in")):
        return "India", "academic_domain", 0.8
    if host.endswith((".ac.uk", ".gov.uk")):
        return "United Kingdom", "academic_domain", 0.8
    if host.endswith((".edu.au", ".gov.au")):
        return "Australia", "academic_domain", 0.8
    if host.endswith((".edu.sg", ".gov.sg")):
        return "Singapore", "academic_domain", 0.8
    if host.endswith((".edu.ca", ".gc.ca")):
        return "Canada", "academic_domain", 0.8
    if host.endswith(".edu"):
        return "United States", "academic_domain", 0.7

    return None, "none", 0.0

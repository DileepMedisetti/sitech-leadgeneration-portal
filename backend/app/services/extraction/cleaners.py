
import re
from typing import Any
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


# =========================================================
# DESIGNATION, SPECIALIZATION & DIRECT PROFILE URL HELPERS
# =========================================================

PROFESSION_DOMAINS: dict[str, set[str]] = {
    "dentistry": {
        "dentist", "dentistry", "dental", "orthodontist", "orthodontics",
        "periodontist", "periodontics", "endodontist", "endodontics",
        "prosthodontist", "prosthodontics", "oral surgery", "oral and maxillofacial",
        "pediatric dentistry", "dental surgery", "dental surgeon", "stomatology",
        "oral biology", "oral health",
    },
    "neurology": {
        "neurologist", "neurology", "neuroscientist", "neuroscience",
        "neurosurgeon", "neurosurgery", "neurobiology", "neurophysiology",
        "neuropathology", "neuro", "clinical neurology", "cognitive neurology",
        "neurodevelopment", "neuroimaging", "brain",
    },
    "gynecology": {
        "gynecologist", "gynecology", "gynaecologist", "gynaecology",
        "obstetrician", "obstetrics", "obstetrics and gynecology", "ob-gyn",
        "ob/gyn", "obgyn", "maternal-fetal", "reproductive medicine",
        "fertility specialist", "women's health",
    },
    "computer_science": {
        "computer science", "computing", "software engineering", "computer engineering",
        "artificial intelligence", "machine learning", "deep learning", "data science",
        "cybersecurity", "information technology", "informatics", "nlp", "computer vision",
        "robotics", "algorithms", "ai researcher",
    },
    "engineering": {
        "mechanical engineering", "electrical engineering", "civil engineering",
        "chemical engineering", "aerospace engineering", "biomedical engineering",
        "materials science and engineering", "environmental engineering",
        "industrial engineering",
    },
    "cardiology": {
        "cardiologist", "cardiology", "cardiovascular", "cardiac surgery", "heart",
    },
    "oncology": {
        "oncologist", "oncology", "cancer research", "hematology", "haematology", "radiation oncology",
    },
    "dermatology": {
        "dermatologist", "dermatology", "cutaneous",
    },
    "pediatrics": {
        "pediatrician", "pediatrics", "paediatrician", "paediatrics", "child health",
    },
    "psychiatry": {
        "psychiatrist", "psychiatry", "psychology", "psychologist", "neuropsychiatry", "mental health",
    },
    "biology": {
        "biologist", "biology", "biochemist", "biochemistry", "molecular biology",
        "genetics", "geneticist", "microbiology", "microbiologist",
    },
    "chemistry": {
        "chemist", "chemistry", "chemical biology", "organic chemistry",
    },
    "physics": {
        "physicist", "physics", "astrophysics", "astronomy", "quantum",
    },
    "mathematics": {
        "mathematician", "mathematics", "math", "statistics", "statistician", "biostatistics",
    },
}

DISALLOWED_PROFILE_DOMAINS = {
    "google.com", "google.co.uk", "google.co.in", "bing.com", "yahoo.com", "duckduckgo.com",
    "serper.dev", "serpapi.com", "linkedin.com", "twitter.com", "x.com", "facebook.com",
    "instagram.com", "youtube.com", "wikipedia.org", "wikidata.org", "researchgate.net",
    "academia.edu", "scholar.google.com", "orcid.org", "semanticscholar.org",
}

DISALLOWED_FILE_EXTENSIONS = (
    ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".zip",
    ".tar", ".gz", ".rar", ".7z", ".jpg", ".jpeg", ".png", ".gif", ".svg",
)

TITLE_BOUNDARY_STOPWORDS = (
    r"(?=\s+(?:specialization|speciality|specialty|department|division|school|college|center|institute|"
    r"research|area|expertise|office|email|phone|tel|view|profile|bio|page|homepage|dr\.?|prof\.?|\d|$)|$)"
)

ACADEMIC_COMPOSITE_TITLE_REGEX = re.compile(
    r"\b(professor|associate\s*professor|assistant\s*professor|clinical\s*professor|"
    r"distinguished\s*professor|chair\s*professor|emeritus\s*professor|visiting\s*professor|"
    r"adjunct\s*professor|senior\s*lecturer|principal\s*lecturer|lecturer|reader|instructor|"
    r"senior\s*research\s*fellow|postdoctoral\s*fellow|research\s*fellow|fellow|"
    r"chair|head|director|lead\s*scientist|principal\s*investigator|research\s*scientist|"
    r"scientist|researcher)\s+(?:of|in|for)\s+([A-Za-z\s&/,–-]+?)"
    + TITLE_BOUNDARY_STOPWORDS,
    re.IGNORECASE,
)

EXPLICIT_ROLE_KEYWORDS = {
    # Dental
    "dental surgeon": ("Dental Surgeon", "Dentistry"),
    "dentist": ("Dentist", "Dentistry"),
    "orthodontist": ("Orthodontist", "Dentistry"),
    "periodontist": ("Periodontist", "Dentistry"),
    "prosthodontist": ("Prosthodontist", "Dentistry"),
    "endodontist": ("Endodontist", "Dentistry"),
    "pediatric dentist": ("Pediatric Dentist", "Dentistry"),
    "oral surgeon": ("Oral Surgeon", "Dentistry"),
    # Neurological
    "clinical neurologist": ("Clinical Neurologist", "Neurology"),
    "neurologist": ("Neurologist", "Neurology"),
    "neurosurgeon": ("Neurosurgeon", "Neurology"),
    "neuroscientist": ("Neuroscientist", "Neurology"),
    # Gynecological
    "consultant gynecologist": ("Consultant Gynecologist", "Gynecology"),
    "obstetrician and gynecologist": ("Obstetrician & Gynecologist", "Gynecology"),
    "gynecologist": ("Gynecologist", "Gynecology"),
    "obstetrician": ("Obstetrician", "Gynecology"),
    # Computing & Tech
    "computer science professor": ("Computer Science Professor", "Computer Science"),
    "ai researcher": ("AI Researcher", "Computer Science"),
    "machine learning researcher": ("Machine Learning Researcher", "Computer Science"),
    "computer scientist": ("Computer Scientist", "Computer Science"),
    "data scientist": ("Data Scientist", "Computer Science"),
    # Medical & Clinical
    "consultant physician": ("Consultant Physician", "Internal Medicine"),
    "consultant surgeon": ("Consultant Surgeon", "Surgery"),
    "cardiologist": ("Cardiologist", "Cardiology"),
    "oncologist": ("Oncologist", "Oncology"),
    "dermatologist": ("Dermatologist", "Dermatology"),
    "pediatrician": ("Pediatrician", "Pediatrics"),
    "psychiatrist": ("Psychiatrist", "Psychiatry"),
}


def is_valid_profile_url(url: str | None) -> bool:
    """Validate whether a URL points to a legitimate web page rather than search, social media, or binary file."""
    if not url or not isinstance(url, str):
        return False
    url = url.strip()
    if not url.startswith(("http://", "https://")):
        return False

    parsed = urlparse(url)
    hostname = (parsed.hostname or "").lower()
    if not hostname:
        return False

    for disallowed in DISALLOWED_PROFILE_DOMAINS:
        if hostname == disallowed or hostname.endswith(f".{disallowed}"):
            return False

    path = parsed.path.lower()
    if any(path.endswith(ext) for ext in DISALLOWED_FILE_EXTENSIONS):
        return False

    return True


def extract_direct_profile_url(
    element: Any,
    page_url: str,
    person_name: str | None = None,
) -> str | None:
    """Extract direct individual faculty profile, lab, or anchor URL from an HTML element.

    Priority:
      1. Anchor text matching the person's name or link wrapping the name.
      2. Anchor text containing profile/bio/lab keywords ('View Profile', 'Biography', etc.).
      3. Link href matching individual profile path pattern (/faculty/, /people/, /profile/, etc.).
      4. Anchor matching person's name in slug.
      5. Element container ID / anchor fragment on current page.
      6. Fallback to full page_url (never truncated to domain root).
    """
    if element is None:
        return page_url if is_valid_profile_url(page_url) else None

    # Find all anchor tags with href
    anchors = element.find_all("a", href=True) if hasattr(element, "find_all") else []

    candidate_links: list[tuple[int, str]] = []

    name_tokens = []
    if person_name:
        clean_name = re.sub(r"[^a-zA-Z\s]", " ", person_name).lower()
        name_tokens = [t for t in clean_name.split() if len(t) >= 3 and t not in ACADEMIC_TITLES]

    for a in anchors:
        raw_href = a.get("href", "").strip()
        if not raw_href or raw_href.startswith(("mailto:", "tel:", "javascript:", "#")):
            continue

        resolved = urljoin(page_url, raw_href)
        if not is_valid_profile_url(resolved):
            continue

        a_text = a.get_text(" ", strip=True).lower()
        href_lower = resolved.lower()

        # 1. Exact or partial person name inside anchor text
        if person_name and person_name.lower() in a_text:
            candidate_links.append((100, resolved))
            continue
        if name_tokens and sum(1 for t in name_tokens if t in a_text) >= 2:
            candidate_links.append((90, resolved))
            continue

        # 2. Text containing profile/lab keywords
        if any(kw in a_text for kw in (
            "view profile", "profile", "full bio", "biography", "faculty page",
            "lab website", "lab page", "laboratory", "personal homepage",
            "homepage", "cv", "curriculum vitae", "details", "read more",
        )):
            candidate_links.append((80, resolved))
            continue

        # 3. Path containing profile directories
        if any(token in href_lower for token in (
            "/faculty/", "/people/", "/staff/", "/person/", "/profile/", "/bio/",
            "/members/", "/member/", "/team/", "/author/", "/directory/",
            "profile.php", "person.php", "details.php", "view.php",
        )):
            candidate_links.append((70, resolved))
            continue

        # 4. Slug containing name tokens
        if name_tokens and any(t in href_lower for t in name_tokens):
            candidate_links.append((60, resolved))
            continue

    if candidate_links:
        candidate_links.sort(key=lambda x: x[0], reverse=True)
        return candidate_links[0][1]

    # 5. Check if element itself has an ID for direct anchor navigation
    element_id = element.get("id") if hasattr(element, "get") else None
    if element_id and isinstance(element_id, str) and len(element_id) >= 2:
        clean_base = page_url.split("#", 1)[0]
        return f"{clean_base}#{element_id}"

    # 6. Fallback to the exact page URL (never netloc)
    return page_url if is_valid_profile_url(page_url) else None


def clean_specialization(val: str | None) -> str | None:
    """Clean and standardize specialization and department labels."""
    if not val or not isinstance(val, str):
        return None
    val = clean_text(val)
    if not val or len(val) > 100 or len(val) < 2:
        return None
    # Strip common leading descriptors (with or without colon)
    val = re.sub(
        r"^(?:specialization|speciality|specialty|research\s+interests?|area\s+of\s+research|"
        r"expertise|field\s+of\s+study|department\s+of|division\s+of|center\s+for|school\s+of)(?:\s*:\s*|\s+)",
        "",
        val,
        flags=re.IGNORECASE,
    ).strip(" -|:,;")
    # Strip trailing action links/keywords like 'Profile', 'View Profile', 'Bio', etc.
    val = re.sub(
        r"\s+\b(view\s+profile|profile|bio|biography|homepage|faculty\s+page|details)\b.*$",
        "",
        val,
        flags=re.IGNORECASE,
    ).strip(" -|:,;")
    # Remove email if appended
    val = re.sub(r"\s+[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b.*$", "", val).strip(" -|:,;")
    return clean_text(val)


def extract_designation_and_specialization(
    element: Any,
    page_soup: BeautifulSoup | None = None,
) -> tuple[str | None, str | None]:
    """Extract both academic/clinical Designation and Specialization/Profession from HTML.

    Captures:
      - Composite titles: 'Professor of Dentistry', 'Assistant Professor of Computer Science'
      - Standalone explicit roles: 'Dentist', 'Orthodontist', 'Neurologist', 'AI Researcher'
      - Distinct designation and department/specialization elements
      - Context fallback from page headings/breadcrumbs
    """
    if element is None:
        return None, None

    extracted_designation: str | None = None
    extracted_specialization: str | None = None

    # Step 1: Check targeted designation/role tags first to avoid bleeding from neighboring elements
    if hasattr(element, "select"):
        for sel in (
            '[class*="designation"]', '[class*="title"]', '[class*="role"]',
            '[class*="position"]', '[class*="rank"]', 'h3', 'h4', 'h5', 'p', 'span', 'td',
        ):
            for tag in element.select(sel):
                t = tag.get_text(" ", strip=True)
                if not t or len(t) > 100 or EMAIL_PATTERN.search(t):
                    continue

                # 1A: Check composite regex on tag
                match = ACADEMIC_COMPOSITE_TITLE_REGEX.search(t)
                if match:
                    matched_title = match.group(1).strip().title()
                    matched_field = match.group(2).strip().rstrip(".,;:-")
                    clean_field = re.split(
                        r"\b(specialization|speciality|specialty|department|division|school|college|center|institute|research|area|expertise|office|email|phone|tel|view|profile|bio|page)\b",
                        matched_field,
                        flags=re.IGNORECASE,
                    )[0].strip(" -|:,;")
                    if clean_field and len(clean_field) <= 80:
                        extracted_designation = f"{matched_title} of {clean_field}"
                        extracted_specialization = clean_specialization(clean_field)
                        break

                # 1B: Explicit role keywords in tag
                for kw, (role_name, spec_name) in EXPLICIT_ROLE_KEYWORDS.items():
                    if re.search(rf"\b{re.escape(kw)}\b", t, re.IGNORECASE):
                        extracted_designation = role_name
                        extracted_specialization = spec_name
                        break
                if extracted_designation:
                    break

                # 1C: Standalone academic titles in tag
                for title in (
                    "Distinguished Professor", "Institute Professor", "Associate Professor", "Assistant Professor",
                    "Clinical Professor", "Visiting Professor", "Adjunct Professor",
                    "Chair Professor", "Emeritus Professor",
                    "Professor", "Senior Lecturer", "Principal Lecturer", "Lecturer", "Reader", "Instructor",
                    "Postdoctoral Fellow", "Research Fellow", "Fellow", "Head of Department",
                    "Department Chair", "Dean", "Director", "Research Scientist",
                    "Senior Scientist", "Staff Scientist", "Scientist", "Researcher",
                ):
                    if re.search(rf"\b{re.escape(title)}\b", t, re.IGNORECASE):
                        cleaned_t = clean_text(t)
                        if cleaned_t and len(cleaned_t) <= 60 and not EMAIL_PATTERN.search(cleaned_t):
                            extracted_designation = cleaned_t
                        else:
                            extracted_designation = title
                        break
                if extracted_designation:
                    break
            if extracted_designation:
                break

    # Step 2: If designation not found in targeted tags, check element-wide text
    if not extracted_designation:
        element_text = element.get_text(" ", strip=True) if hasattr(element, "get_text") else str(element)
        match = ACADEMIC_COMPOSITE_TITLE_REGEX.search(element_text)
        if match:
            matched_title = match.group(1).strip().title()
            matched_field = match.group(2).strip().rstrip(".,;:-")
            clean_field = re.split(
                r"\b(specialization|speciality|specialty|department|division|school|college|center|institute|research|area|expertise|office|email|phone|tel|view|profile|bio|page)\b",
                matched_field,
                flags=re.IGNORECASE,
            )[0].strip(" -|:,;")
            if clean_field and len(clean_field) <= 80:
                extracted_designation = f"{matched_title} of {clean_field}"
                extracted_specialization = clean_specialization(clean_field)

        if not extracted_designation:
            for kw, (role_name, spec_name) in EXPLICIT_ROLE_KEYWORDS.items():
                if re.search(rf"\b{re.escape(kw)}\b", element_text, re.IGNORECASE):
                    extracted_designation = role_name
                    extracted_specialization = spec_name
                    break

    # Step 3: Check specific elements for dedicated research / specialization / interest / expertise
    # Dedicated research topics take precedence over general domain titles
    if hasattr(element, "select"):
        dedicated_research_found = False
        for sel in (
            '[class*="specialization"]', '[class*="speciality"]', '[class*="specialty"]',
            '[class*="expertise"]', '[class*="research"]', '[class*="interest"]',
        ):
            for tag in element.select(sel):
                t = tag.get_text(" ", strip=True)
                candidate_spec = clean_specialization(t)
                if candidate_spec and len(candidate_spec) <= 80:
                    extracted_specialization = candidate_spec
                    dedicated_research_found = True
                    break
            if dedicated_research_found:
                break

        # If specialization is still missing, fallback to department/division tags
        if not extracted_specialization:
            for sel in ('[class*="discipline"]', '[class*="department"]', '[class*="division"]'):
                for tag in element.select(sel):
                    t = tag.get_text(" ", strip=True)
                    candidate_spec = clean_specialization(t)
                    if candidate_spec and len(candidate_spec) <= 80:
                        extracted_specialization = candidate_spec
                        break
                if extracted_specialization:
                    break

    # Step 4: Page-level context fallback if designation exists and specialization is missing
    if page_soup and extracted_designation and not extracted_specialization:
        for sel in ("h1", "h2", ".department-name", ".breadcrumb"):
            for el in page_soup.select(sel):
                t = el.get_text(" ", strip=True)
                dept_match = re.search(r"\b(?:Department|Division|School|College|Center)\s+of\s+([A-Za-z\s&/,–-]+)", t, re.IGNORECASE)
                if dept_match:
                    found_spec = clean_specialization(dept_match.group(1))
                    if found_spec and len(found_spec) <= 60:
                        extracted_specialization = found_spec
                        break
                for domain, kws in PROFESSION_DOMAINS.items():
                    if any(kw in t.lower() for kw in kws):
                        extracted_specialization = domain.replace("_", " ").title()
                        break
                if extracted_specialization:
                    break
            if extracted_specialization:
                break

    return clean_text(extracted_designation), clean_specialization(extracted_specialization)


def check_profession_match(
    extracted_profession: str | None,
    extracted_specialization: str | None,
    requested_profession: str | None,
    department: str | None = None,
) -> tuple[bool, str | None]:
    """Verify whether a candidate's extracted role/specialization matches the user's requested profession.

    Returns:
        (is_match, mismatch_reason)
    """
    if not requested_profession or not requested_profession.strip():
        return True, None

    req_clean = requested_profession.strip().lower()

    # Identify target domain(s) from requested_profession
    target_domains: set[str] = set()
    for domain, kws in PROFESSION_DOMAINS.items():
        if any(kw in req_clean for kw in kws):
            target_domains.add(domain)

    # Combine all candidate fields
    cand_tokens = " ".join(
        filter(None, [extracted_profession, extracted_specialization, department])
    ).lower()

    if not cand_tokens.strip():
        return False, f"Candidate has no verified profession to match requested '{requested_profession}'"

    if target_domains:
        # Check if candidate matches any target domain
        has_target_match = False
        for domain in target_domains:
            kws = PROFESSION_DOMAINS[domain]
            if any(kw in cand_tokens for kw in kws):
                has_target_match = True
                break

        if has_target_match:
            return True, None

        # Check if candidate explicitly belongs to a different domain
        competing_domains: set[str] = set()
        for domain, kws in PROFESSION_DOMAINS.items():
            if domain not in target_domains:
                if any(kw in cand_tokens for kw in kws):
                    competing_domains.add(domain.replace("_", " ").title())

        if competing_domains:
            comp_list = ", ".join(sorted(competing_domains))
            return False, f"Candidate role '{extracted_profession or cand_tokens}' is in '{comp_list}', does not match requested profession '{requested_profession}'"

        # Check substantive word overlap
        req_words = {
            w for w in re.split(r"\W+", req_clean)
            if len(w) >= 4 and w not in {"professor", "associate", "assistant", "department", "faculty", "doctor", "researcher", "lecturer"}
        }
        if req_words and any(w in cand_tokens for w in req_words):
            return True, None

        return False, f"Candidate role '{extracted_profession or cand_tokens}' does not match requested profession '{requested_profession}'"

    # Target domain not in dictionary: perform keyword/stem overlap
    req_words = {
        w for w in re.split(r"\W+", req_clean)
        if len(w) >= 4 and w not in {"professor", "associate", "assistant", "department", "faculty", "doctor", "researcher", "lecturer"}
    }
    if not req_words:
        return True, None

    if any(w in cand_tokens for w in req_words):
        return True, None

    # Check if candidate belongs to a known domain that doesn't overlap
    for domain, kws in PROFESSION_DOMAINS.items():
        if any(kw in cand_tokens for kw in kws) and not any(kw in req_clean for kw in kws):
            return False, f"Candidate role '{extracted_profession or cand_tokens}' belongs to '{domain.replace('_', ' ').title()}', does not match requested '{requested_profession}'"

    return False, f"Candidate role '{extracted_profession or cand_tokens}' does not match requested '{requested_profession}'"


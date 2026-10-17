
import re
from typing import Any

from app.models.search_job import SearchJob


EXCLUDE_JOBS_OPERATORS = "-inurl:jobs -inurl:careers"


def build_search_queries(job: SearchJob) -> list[str]:
    """Generate high-yield, targeted search queries for an academic lead job.

    Uses university, department, profession, specialization, and country hints,
    while excluding recruitment portals and job vacancy aggregators.
    """
    criteria: dict[str, Any] = job.search_criteria or {}
    keywords = job.keywords.strip()

    queries = [keywords]

    university = criteria.get("university")
    department = criteria.get("department")
    profession = criteria.get("profession") or "faculty professor"
    country = criteria.get("country")
    specialization = criteria.get("research_specialization")

    # If university is specified
    if university:
        u_clean = re.sub(r"[^\w\s]", "", university).strip()
        dept_str = f'"{department}"' if department else ""
        queries.append(f'"{u_clean}" {profession} {dept_str} email directory {EXCLUDE_JOBS_OPERATORS}'.strip())
        queries.append(f'"{u_clean}" {profession} "faculty profile" mailto {EXCLUDE_JOBS_OPERATORS}'.strip())

    # If department and country are specified
    if department and country:
        queries.append(f'{department} {profession} directory email {country} {EXCLUDE_JOBS_OPERATORS}'.strip())

    # If specialization is specified
    if specialization:
        queries.append(f'{specialization} professor faculty profile email {country or ""} {EXCLUDE_JOBS_OPERATORS}'.strip())

    # Remove duplicates while preserving order
    unique_queries: list[str] = []
    seen = set()
    for q in queries:
        cleaned = re.sub(r"\s+", " ", q).strip()
        if cleaned.lower() not in seen:
            seen.add(cleaned.lower())
            unique_queries.append(cleaned)

    return unique_queries

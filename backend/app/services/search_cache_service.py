
import hashlib
import json
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.search_query_cache import SearchQueryCache


def compute_query_hash(query: str, num_results: int = 10) -> str:
    """Produce deterministic hash for a search query and result count."""
    normalized = f"{query.strip().lower()}::{num_results}"
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()


def get_cached_search_results(
    db: Session,
    query: str,
    num_results: int = 10,
) -> dict | None:
    """Retrieve cached SerpApi results if previously searched."""
    query_hash = compute_query_hash(query, num_results)
    statement = select(SearchQueryCache).where(SearchQueryCache.query_hash == query_hash)
    try:
        cached = db.scalar(statement)
        if isinstance(cached, SearchQueryCache) and isinstance(cached.results_json, dict):
            return cached.results_json
    except Exception:
        return None
    return None


def store_cached_search_results(
    db: Session,
    query: str,
    results: dict,
    num_results: int = 10,
) -> None:
    """Store SerpApi search results in cache to save future credits."""
    if not isinstance(results, dict):
        return
    query_hash = compute_query_hash(query, num_results)
    statement = select(SearchQueryCache).where(SearchQueryCache.query_hash == query_hash)
    try:
        existing = db.scalar(statement)
        if isinstance(existing, SearchQueryCache):
            existing.results_json = results
        else:
            cache_entry = SearchQueryCache(
                query_hash=query_hash,
                query=query.strip(),
                results_json=results,
            )
            db.add(cache_entry)
        db.commit()
    except Exception:
        db.rollback()

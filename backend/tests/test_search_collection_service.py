
from types import SimpleNamespace
from unittest.mock import MagicMock

from app.services import search_collection_service as collection


def test_collect_search_results_saves_unique_results(monkeypatch):
    db = MagicMock()

    job = SimpleNamespace(
        id=1,
        keywords="Python developer companies in India",
        status="running",
        serpapi_requests_used=1,
        error_message=None,
    )

    monkeypatch.setattr(
        collection,
        "get_search_job_by_id",
        lambda db, job_id: job,
    )

    monkeypatch.setattr(
        collection,
        "reserve_serpapi_request",
        lambda db, job_id: True,
    )

    monkeypatch.setattr(
        collection,
        "search_google",
        lambda **kwargs: {
            "organic_results": [
                {
                    "title": "Example Company",
                    "link": "https://example.com",
                    "snippet": "Python development company",
                }
            ]
        },
    )

    monkeypatch.setattr(
        collection,
        "record_search_result",
        lambda **kwargs: (object(), True),
    )

    result = collection.collect_search_results(db, 1)

    assert result["job_id"] == 1
    assert result["results_received"] == 1
    assert result["results_saved"] == 1
    assert result["duplicates_skipped"] == 0
    assert result["serpapi_requests_used"] == 1


def test_collect_search_results_skips_duplicate_urls(monkeypatch):
    db = MagicMock()

    job = SimpleNamespace(
        id=1,
        keywords="Python developers",
        status="running",
        serpapi_requests_used=1,
        error_message=None,
    )

    monkeypatch.setattr(
        collection,
        "get_search_job_by_id",
        lambda db, job_id: job,
    )

    monkeypatch.setattr(
        collection,
        "reserve_serpapi_request",
        lambda db, job_id: True,
    )

    monkeypatch.setattr(
        collection,
        "search_google",
        lambda **kwargs: {
            "organic_results": [
                {
                    "title": "Example",
                    "link": "https://example.com",
                    "snippet": "Example result",
                }
            ]
        },
    )

    monkeypatch.setattr(
        collection,
        "record_search_result",
        lambda **kwargs: (object(), False),
    )

    result = collection.collect_search_results(db, 1)

    assert result["results_saved"] == 0
    assert result["duplicates_skipped"] == 1

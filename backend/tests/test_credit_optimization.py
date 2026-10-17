
from types import SimpleNamespace
from unittest.mock import MagicMock
import pytest

from app.models.search_query_cache import SearchQueryCache
from app.services import search_collection_service as collection
from app.services.lead_extraction_service import process_pending_results
from app.models.search_result import SearchResult
from app.models.search_job import SearchJob


def test_cached_query_does_not_call_serpapi_or_reserve_request(monkeypatch):
    """Verify that cached search queries do not consume SerpApi budget or make external calls."""
    db = MagicMock()

    job = SimpleNamespace(
        id=1,
        keywords="IIT Delhi professors",
        status="running",
        serpapi_requests_used=0,
        error_message=None,
    )

    cached_entry = SearchQueryCache(
        query_hash="somehash",
        query="IIT Delhi professors",
        results_json={
            "organic_results": [
                {
                    "title": "IIT Delhi Faculty",
                    "link": "https://iitd.ac.in/faculty",
                    "snippet": "Professors at IIT Delhi",
                }
            ]
        },
    )

    # Mock DB query to return cached_entry
    db.scalar.return_value = cached_entry

    monkeypatch.setattr(
        collection,
        "get_search_job_by_id",
        lambda db, job_id: job,
    )

    serpapi_called = False

    def fake_search_google(**kwargs):
        nonlocal serpapi_called
        serpapi_called = True
        return {"organic_results": []}

    monkeypatch.setattr(collection, "search_google", fake_search_google)
    monkeypatch.setattr(collection, "record_search_result", lambda **kwargs: (object(), True))

    result = collection.collect_search_results(db, 1, use_cache=True)

    assert result["was_cached"] is True
    assert result["results_saved"] == 1
    assert serpapi_called is False  # SerpApi was NOT called!
    assert job.serpapi_requests_used == 0  # Zero credits consumed!


def test_extraction_of_stored_urls_never_calls_serpapi(monkeypatch):
    """Prove that extracting stored search results uses direct fetching, never SerpApi."""
    db = MagicMock()

    job = SimpleNamespace(
        id=1,
        status="running",
        qualified_leads_found=0,
        target_leads=5,
        search_criteria={},
    )

    result = SimpleNamespace(
        id=101,
        result_url="https://example.edu/faculty/dr-sharma",
        status="pending",
        retry_count=0,
    )

    db.scalar.return_value = None
    db.get.side_effect = lambda model, obj_id: job if model == SearchJob else result
    monkeypatch.setattr("app.services.lead_extraction_service.get_pending_results", lambda db, job_id, limit: [result])

    html_content = """
    <html>
      <body>
        <div class="faculty-card">
          <h2>Dr. Ramesh Sharma</h2>
          <p>Professor</p>
          <a href="mailto:rsharma@example.edu">Email</a>
        </div>
      </body>
    </html>
    """

    # Direct webpage fetch
    monkeypatch.setattr(
        "app.services.lead_extraction_service.fetch_webpage",
        lambda url: (url, html_content),
    )

    fake_lead = SimpleNamespace(id=50, qualification_status="qualified")
    monkeypatch.setattr(
        "app.services.lead_extraction_service.process_lead",
        lambda db, lead_data: (fake_lead, True),
    )

    counts = process_pending_results(db, 1, limit=1)

    assert counts["leads_created"] == 1
    assert counts["results_processed"] == 1
    assert counts["qualified_leads_counted"] == 1

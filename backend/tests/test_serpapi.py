from unittest.mock import MagicMock
from app.services.serpapi_service import search_google


def test_serpapi_connection(monkeypatch):
    """Verify search_google with deterministic mock to prevent consuming live SerpApi credits."""
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "organic_results": [
            {
                "title": "Example Institution Faculty",
                "link": "https://example.edu/faculty",
                "snippet": "Faculty directory of professors and researchers",
            }
        ]
    }

    monkeypatch.setattr("app.core.config.settings.SERPAPI_API_KEY", "test_mock_serpapi_key")
    monkeypatch.setattr("httpx.Client.get", lambda *args, **kwargs: mock_response)

    results = search_google(
        query="Python developer companies in India",
        num_results=5,
    )

    organic_results = results.get("organic_results", [])
    assert len(organic_results) == 1
    assert organic_results[0]["link"] == "https://example.edu/faculty"

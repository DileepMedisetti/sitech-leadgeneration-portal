
import pytest

from app.services.lead_extraction_service import is_retryable_failure


@pytest.mark.parametrize(
    "message",
    [
        "HTTP 403: access refused or page not found.",
        "HTTP 404: access refused or page not found.",
        "Private or non-public IP addresses are not allowed.",
        None,
        "",
        "Some unknown extraction error",
    ],
)
def test_non_transient_failures_are_not_retryable(message):
    assert is_retryable_failure(message) is False


@pytest.mark.parametrize(
    "message",
    [
        "Temporary HTTP error persisted after 3 attempts.",
        "Network error after 3 attempts: ReadTimeout",
        "Request timed out while fetching webpage",
        "ConnectError: connection failed",
        "ReadTimeout while fetching webpage",
        "RemoteProtocolError while reading response",
    ],
)
def test_transient_failures_are_retryable(message):
    assert is_retryable_failure(message) is True

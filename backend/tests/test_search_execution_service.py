
from types import SimpleNamespace
from unittest.mock import MagicMock

import pytest

from app.services.search_execution_service import (
    can_continue_search,
    start_search_job,
    record_serpapi_request,
    record_qualified_lead,
    reserve_serpapi_request,
)


def make_job(**overrides):
    values = {
        "status": "pending",
        "target_leads": 100,
        "qualified_leads_found": 0,
        "max_serpapi_requests": 20,
        "serpapi_requests_used": 0,
        "started_at": None,
    }
    values.update(overrides)
    return SimpleNamespace(**values)


def test_search_stops_at_request_budget():
    job = make_job(
        status="running",
        max_serpapi_requests=20,
        serpapi_requests_used=20,
    )

    assert can_continue_search(job) is False


def test_search_stops_when_target_is_reached():
    job = make_job(
        status="running",
        target_leads=100,
        qualified_leads_found=100,
    )

    assert can_continue_search(job) is False


def test_request_counter_never_exceeds_budget():
    job = make_job(
        status="running",
        max_serpapi_requests=2,
        serpapi_requests_used=1,
    )

    record_serpapi_request(job)

    assert job.serpapi_requests_used == 2

    with pytest.raises(ValueError, match="cannot continue"):
        record_serpapi_request(job)

    assert job.serpapi_requests_used == 2


def test_qualified_lead_counter_respects_target():
    job = make_job(
        status="running",
        target_leads=1,
        qualified_leads_found=0,
    )

    record_qualified_lead(job)

    assert job.qualified_leads_found == 1

    with pytest.raises(
        ValueError,
        match="target has already been reached",
    ):
        record_qualified_lead(job)

    assert job.qualified_leads_found == 1


def test_only_pending_job_can_be_started():
    job = make_job(status="running")

    with pytest.raises(ValueError, match="Only pending"):
        start_search_job(job)


def test_reserve_serpapi_request_success():
    db = MagicMock()
    db.scalar.return_value = 1

    reserved = reserve_serpapi_request(db, job_id=1)

    assert reserved is True
    db.scalar.assert_called_once()
    db.flush.assert_called_once()


def test_reserve_serpapi_request_rejected_when_limit_reached():
    db = MagicMock()

    # No matching database row means the reservation was rejected.
    db.scalar.return_value = None

    reserved = reserve_serpapi_request(db, job_id=1)

    assert reserved is False
    db.scalar.assert_called_once()
    db.flush.assert_called_once()

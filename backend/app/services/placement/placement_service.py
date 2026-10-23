from datetime import datetime, timezone
from typing import Any
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.models.campaign import Campaign, CampaignContent
from app.models.deliverability import PlacementTestJob, PlacementTestSeedResult
from app.repositories.campaign_repository import (
    get_campaign_by_id,
    get_latest_campaign_content,
)
from app.schemas.deliverability import (
    PaginatedPlacementTestsResponse,
    PlacementJobStatus,
    PlacementOutcome,
    PlacementSeedResult,
    PlacementTestCreate,
    PlacementTestResponse,
)
from app.services.placement.base_provider import BasePlacementProvider
from app.services.placement.seedbox_provider import SitechSeedboxProvider


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def get_default_provider() -> BasePlacementProvider:
    return SitechSeedboxProvider()


def request_placement_test(
    db: Session,
    campaign_id: int,
    payload: PlacementTestCreate,
    provider: BasePlacementProvider | None = None,
) -> PlacementTestResponse:
    """Creates and immediately executes a durable placement test job for the campaign's current content."""
    campaign = get_campaign_by_id(db, campaign_id)
    if not campaign:
        raise ValueError(f"Campaign {campaign_id} not found.")

    content = get_latest_campaign_content(db, campaign_id)
    if not content:
        raise ValueError("Campaign does not have any saved email content to test.")

    if not content.subject or not content.html_content:
        raise ValueError("Subject and HTML email content are required to execute a placement test.")

    active_provider = provider or get_default_provider()

    # Check for an existing completed test for this EXACT content fingerprint in the last 10 minutes to avoid duplicate burn
    recent_stmt = (
        select(PlacementTestJob)
        .where(
            PlacementTestJob.campaign_id == campaign_id,
            PlacementTestJob.content_fingerprint == content.content_fingerprint,
            PlacementTestJob.status == "completed",
        )
        .order_by(desc(PlacementTestJob.created_at))
        .limit(1)
    )
    existing_recent = db.scalar(recent_stmt)
    # If completed less than 5 minutes ago and user did not force notes, we can return it or create a fresh one if requested.
    # We will create a fresh test job if requested by the user.

    # 1. Create durable PlacementTestJob in 'running' status
    job = PlacementTestJob(
        campaign_id=campaign_id,
        content_version=content.version,
        content_fingerprint=content.content_fingerprint,
        provider_name=active_provider.name,
        status="running",
        notes=payload.notes,
        total_tests=0,
    )
    db.add(job)
    db.flush()

    try:
        # 2. Get seed targets and execute test
        seed_targets = active_provider.get_seed_targets(payload.mailbox_providers)
        job.total_tests = len(seed_targets)

        results = active_provider.execute_placement_test(
            campaign_id=campaign_id,
            content_version=content.version,
            content_fingerprint=content.content_fingerprint,
            subject=content.subject,
            from_email=content.from_email,
            html_content=content.html_content,
            seed_targets=seed_targets,
        )

        inbox_count = 0
        spam_count = 0
        other_count = 0
        unknown_count = 0
        failed_count = 0
        observed_count = 0

        provider_breakdown: dict[str, dict[str, Any]] = {}
        seed_result_schemas: list[PlacementSeedResult] = []

        for res in results:
            # Persist individual seed record
            seed_row = PlacementTestSeedResult(
                test_job_id=job.id,
                seed_email=res.seed_email,
                mailbox_provider=res.mailbox_provider,
                outcome=res.outcome,
                latency_seconds=res.latency_seconds,
                detail=res.detail,
                observed_at=res.observed_at or _utc_now(),
            )
            db.add(seed_row)

            # Categorize
            if res.outcome == "inbox":
                inbox_count += 1
                observed_count += 1
            elif res.outcome == "spam":
                spam_count += 1
                observed_count += 1
            elif res.outcome == "other":
                other_count += 1
                observed_count += 1
            elif res.outcome == "unknown":
                unknown_count += 1
            elif res.outcome == "failed":
                failed_count += 1

            # Provider breakdown
            mb_p = res.mailbox_provider
            if mb_p not in provider_breakdown:
                provider_breakdown[mb_p] = {
                    "total": 0,
                    "inbox": 0,
                    "spam": 0,
                    "other": 0,
                    "unknown": 0,
                    "failed": 0,
                }
            provider_breakdown[mb_p]["total"] += 1
            if res.outcome in provider_breakdown[mb_p]:
                provider_breakdown[mb_p][res.outcome] += 1

            seed_result_schemas.append(
                PlacementSeedResult(
                    seed_email=res.seed_email,
                    mailbox_provider=res.mailbox_provider,
                    outcome=res.outcome,
                    latency_seconds=res.latency_seconds,
                    detail=res.detail,
                    observed_at=res.observed_at or _utc_now(),
                )
            )

        job.observed_count = observed_count
        job.inbox_count = inbox_count
        job.spam_count = spam_count
        job.other_count = other_count
        job.unknown_count = unknown_count
        job.failed_count = failed_count
        job.provider_breakdown = provider_breakdown
        job.status = "completed"
        job.completed_at = _utc_now()
        db.flush()

        inbox_rate = round(inbox_count / observed_count, 4) if observed_count > 0 else 0.0
        spam_rate = round(spam_count / observed_count, 4) if observed_count > 0 else 0.0

        return PlacementTestResponse(
            id=job.id,
            campaign_id=campaign_id,
            content_version=job.content_version,
            content_fingerprint=job.content_fingerprint,
            provider_name=job.provider_name,
            status=job.status,
            total_tests=job.total_tests,
            observed_count=job.observed_count,
            inbox_count=job.inbox_count,
            spam_count=job.spam_count,
            other_count=job.other_count,
            unknown_count=job.unknown_count,
            failed_count=job.failed_count,
            inbox_rate=inbox_rate,
            spam_rate=spam_rate,
            provider_breakdown=job.provider_breakdown,
            results=seed_result_schemas,
            created_at=job.created_at,
            completed_at=job.completed_at,
        )

    except Exception as exc:
        job.status = "failed"
        job.error_message = str(exc)
        job.completed_at = _utc_now()
        db.flush()
        raise


def get_placement_test_by_id(db: Session, test_id: int) -> PlacementTestResponse | None:
    job = db.get(PlacementTestJob, test_id)
    if not job:
        return None

    seed_rows = list(
        db.scalars(
            select(PlacementTestSeedResult).where(
                PlacementTestSeedResult.test_job_id == test_id
            )
        ).all()
    )

    seed_schemas = [
        PlacementSeedResult(
            seed_email=r.seed_email,
            mailbox_provider=r.mailbox_provider,
            outcome=r.outcome,  # type: ignore
            latency_seconds=r.latency_seconds,
            detail=r.detail,
            observed_at=r.observed_at,
        )
        for r in seed_rows
    ]

    obs = job.observed_count
    inbox_rate = round(job.inbox_count / obs, 4) if obs > 0 else 0.0
    spam_rate = round(job.spam_count / obs, 4) if obs > 0 else 0.0

    return PlacementTestResponse(
        id=job.id,
        campaign_id=job.campaign_id,
        content_version=job.content_version,
        content_fingerprint=job.content_fingerprint,
        provider_name=job.provider_name,
        status=job.status,  # type: ignore
        total_tests=job.total_tests,
        observed_count=job.observed_count,
        inbox_count=job.inbox_count,
        spam_count=job.spam_count,
        other_count=job.other_count,
        unknown_count=job.unknown_count,
        failed_count=job.failed_count,
        inbox_rate=inbox_rate,
        spam_rate=spam_rate,
        provider_breakdown=job.provider_breakdown,
        results=seed_schemas,
        created_at=job.created_at,
        completed_at=job.completed_at,
        error_message=job.error_message,
    )


def get_latest_placement_test(
    db: Session, campaign_id: int
) -> PlacementTestResponse | None:
    stmt = (
        select(PlacementTestJob)
        .where(PlacementTestJob.campaign_id == campaign_id)
        .order_by(desc(PlacementTestJob.created_at))
        .limit(1)
    )
    job = db.scalar(stmt)
    if not job:
        return None
    return get_placement_test_by_id(db, job.id)


def list_campaign_placement_tests(
    db: Session, campaign_id: int, page: int = 1, page_size: int = 10
) -> PaginatedPlacementTestsResponse:
    base_query = (
        select(PlacementTestJob)
        .where(PlacementTestJob.campaign_id == campaign_id)
        .order_by(desc(PlacementTestJob.created_at))
    )

    count_stmt = select(func.count()).select_from(base_query.subquery())
    total = db.scalar(count_stmt) or 0

    offset = max(0, (page - 1) * page_size)
    paginated_query = base_query.offset(offset).limit(page_size)
    jobs = list(db.scalars(paginated_query).all())

    items = []
    for j in jobs:
        obs = j.observed_count
        inbox_rate = round(j.inbox_count / obs, 4) if obs > 0 else 0.0
        spam_rate = round(j.spam_count / obs, 4) if obs > 0 else 0.0
        items.append(
            PlacementTestResponse(
                id=j.id,
                campaign_id=j.campaign_id,
                content_version=j.content_version,
                content_fingerprint=j.content_fingerprint,
                provider_name=j.provider_name,
                status=j.status,  # type: ignore
                total_tests=j.total_tests,
                observed_count=j.observed_count,
                inbox_count=j.inbox_count,
                spam_count=j.spam_count,
                other_count=j.other_count,
                unknown_count=j.unknown_count,
                failed_count=j.failed_count,
                inbox_rate=inbox_rate,
                spam_rate=spam_rate,
                provider_breakdown=j.provider_breakdown,
                created_at=j.created_at,
                completed_at=j.completed_at,
                error_message=j.error_message,
            )
        )

    return PaginatedPlacementTestsResponse(
        total=total,
        page=page,
        page_size=page_size,
        items=items,
    )

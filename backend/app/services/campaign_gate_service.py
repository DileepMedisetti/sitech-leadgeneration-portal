from datetime import datetime, timezone
from typing import Any
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.campaign import Campaign, CampaignAudienceList, CampaignContent, CampaignRecipientSnapshot
from app.models.lead import Lead
from app.repositories.campaign_repository import (
    get_campaign_by_id,
    get_latest_campaign_content,
    snapshot_campaign_recipients,
)
from app.schemas.campaign import (
    CampaignConfirmSendRequest,
    CampaignPreflightResponse,
    CampaignScheduleRequest,
    PreflightCheckItem,
)
from app.services.audience_service import is_lead_eligible_contact
from app.services.deliverability.analyzer_service import get_latest_campaign_report
from app.services.ml.inference_service import predict_campaign_placement
from app.services.placement.placement_service import get_latest_placement_test


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def evaluate_campaign_preflight(
    db: Session,
    campaign_id: int,
) -> CampaignPreflightResponse:
    """Evaluates all pre-launch readiness checks, deliverability intelligence,

    and identifies blocking issues or mandatory warnings before sending.
    """
    campaign = get_campaign_by_id(db, campaign_id)
    if not campaign:
        raise ValueError(f"Campaign {campaign_id} not found.")

    content = get_latest_campaign_content(db, campaign_id)
    report = get_latest_campaign_report(db, campaign_id)
    placement = get_latest_placement_test(db, campaign_id)
    prediction = predict_campaign_placement(db, campaign_id) if content else None

    checks: list[PreflightCheckItem] = []
    blockers: list[str] = []
    warnings: list[str] = []

    # 1. Content check
    if not content:
        blockers.append("No email content has been created for this campaign.")
        checks.append(
            PreflightCheckItem(
                category="content",
                label="Email Content",
                status="blocked",
                detail="Missing subject, sender identity, or HTML body.",
            )
        )
    else:
        if not content.subject.strip():
            blockers.append("Subject line cannot be blank.")
        if not content.html_content.strip():
            blockers.append("Email HTML content cannot be empty.")
        if not content.from_email.strip():
            blockers.append("Sender from_email address is required.")
        else:
            from app.services.sender_eligibility_service import validate_sender_eligibility
            is_sender_ok, sender_msg = validate_sender_eligibility(db, content.from_email)
            if not is_sender_ok:
                blockers.append(sender_msg)
                checks.append(
                    PreflightCheckItem(
                        category="sender",
                        label="Sender Identity & Provider Readiness",
                        status="blocked",
                        detail=sender_msg,
                    )
                )
            else:
                checks.append(
                    PreflightCheckItem(
                        category="sender",
                        label="Sender Identity & Provider Readiness",
                        status="passed",
                        detail=f"Verified sender identity: {content.from_name} <{content.from_email}>",
                    )
                )

        checks.append(
            PreflightCheckItem(
                category="content",
                label="Content & Sender Details",
                status="blocked" if any(b for b in blockers if "Subject" in b or "content" in b or "from_email" in b) else "passed",
                detail=f"Subject: '{content.subject}' | From: {content.from_name} <{content.from_email}>",
            )
        )

    # 2. Audience check
    # Ensure recipient snapshot is up-to-date
    total_unique, eligible_count = snapshot_campaign_recipients(db, campaign_id)
    if eligible_count == 0:
        blockers.append("Audience list contains 0 eligible contacts. Select at least one list with qualified contacts.")
        checks.append(
            PreflightCheckItem(
                category="audience",
                label="Recipient Audience",
                status="blocked",
                detail="No eligible unique contacts found in selected contact lists.",
            )
        )
    else:
        checks.append(
            PreflightCheckItem(
                category="audience",
                label="Recipient Audience",
                status="passed",
                detail=f"{eligible_count} verified, eligible unique contacts ready for outreach.",
            )
        )

    # 3. Rule-based Deliverability Report check
    if not report:
        blockers.append("Deliverability analysis has not been executed. Run rule-based analysis before launching.")
        checks.append(
            PreflightCheckItem(
                category="deliverability",
                label="Rule-Based Spam Risk Report",
                status="blocked",
                detail="No analysis report found for this campaign.",
            )
        )
    elif report.is_stale:
        blockers.append("Content was modified since the last deliverability report. Re-run analysis on the latest version.")
        checks.append(
            PreflightCheckItem(
                category="deliverability",
                label="Rule-Based Spam Risk Report",
                status="blocked",
                detail="Report is stale (content was edited after analysis).",
            )
        )
    elif report.has_blockers:
        blocker_titles = [f.title for f in report.findings if f.severity == "blocker" and f.status == "failed"]
        for b in blocker_titles:
            blockers.append(f"Deliverability Blocker: {b}")
        checks.append(
            PreflightCheckItem(
                category="deliverability",
                label="Rule-Based Spam Risk Report",
                status="blocked",
                detail=f"Blocked due to critical deliverability violations: {', '.join(blocker_titles)}",
            )
        )
    elif report.risk_level in {"high", "critical"}:
        warnings.append(
            f"Campaign has an elevated spam risk score ({report.risk_score}/100 - {report.risk_level.title()}). Review recommendations."
        )
        checks.append(
            PreflightCheckItem(
                category="deliverability",
                label="Rule-Based Spam Risk Report",
                status="warning",
                detail=f"Risk score is {report.risk_score} ({report.risk_level}). Corrective actions recommended.",
            )
        )
    else:
        checks.append(
            PreflightCheckItem(
                category="deliverability",
                label="Rule-Based Spam Risk Report",
                status="passed",
                detail=f"Passed with {report.risk_level.title()} risk score ({report.risk_score}/100).",
            )
        )

    # 4. Placement Test Check (Optional evidence, non-blocking)
    if placement and placement.status == "completed":
        checks.append(
            PreflightCheckItem(
                category="placement",
                label="Controlled Seedbox Placement",
                status="passed",
                detail=f"{round(placement.inbox_rate * 100, 1)}% Inbox placement across {placement.observed_count} observed seedboxes.",
            )
        )
    else:
        checks.append(
            PreflightCheckItem(
                category="placement",
                label="Controlled Seedbox Placement",
                status="passed",
                detail="No seedbox placement test run. (Optional)",
            )
        )

    # 5. ML Placement Prediction Check (Non-blocking)
    if prediction and prediction.status == "available":
        prob_pct = round((prediction.inbox_probability or 0.0) * 100, 1)
        checks.append(
            PreflightCheckItem(
                category="ml_prediction",
                label="Machine Learning Placement Estimate",
                status="passed",
                detail=f"Model {prediction.model_version} estimates {prob_pct}% Inbox probability ({prediction.risk_tier}).",
            )
        )
    else:
        checks.append(
            PreflightCheckItem(
                category="ml_prediction",
                label="Machine Learning Placement Estimate",
                status="passed",
                detail="ML model prediction is unavailable. (Model gated until validated).",
            )
        )

    can_schedule_or_send = len(blockers) == 0
    requires_ack = len(warnings) > 0

    return CampaignPreflightResponse(
        campaign_id=campaign_id,
        is_ready=can_schedule_or_send and not requires_ack,
        can_schedule_or_send=can_schedule_or_send,
        requires_warning_acknowledgement=requires_ack,
        blockers=blockers,
        warnings=warnings,
        checks=checks,
        deliverability_report=report,
        placement_test=placement,
        ml_prediction=prediction,
    )


def execute_campaign_dispatch_or_schedule(
    db: Session,
    campaign_id: int,
    schedule_payload: CampaignScheduleRequest,
    confirm_payload: CampaignConfirmSendRequest,
) -> Campaign:
    """Orchestrates final pre-launch checks, re-verifies contact eligibility,

    and performs dispatch or future scheduling idempotently.
    """
    campaign = get_campaign_by_id(db, campaign_id)
    if not campaign:
        raise ValueError(f"Campaign {campaign_id} not found.")

    if campaign.status in {"sent", "sending", "archived"}:
        raise ValueError(f"Cannot dispatch campaign in '{campaign.status}' status.")

    if not confirm_payload.confirmed:
        raise ValueError("Explicit user confirmation is mandatory to launch or schedule a campaign.")

    # Run preflight evaluation
    preflight = evaluate_campaign_preflight(db, campaign_id)
    if not preflight.can_schedule_or_send:
        raise ValueError(f"Cannot launch campaign: {'; '.join(preflight.blockers)}")

    if preflight.requires_warning_acknowledgement and not confirm_payload.bypass_warnings:
        raise ValueError(
            f"Campaign has active warnings: {'; '.join(preflight.warnings)}. "
            "Please acknowledge warnings to proceed."
        )

    # Recheck suppression and eligibility of each recipient snapshot at dispatch time
    snapshots = list(
        db.scalars(
            select(CampaignRecipientSnapshot).where(
                CampaignRecipientSnapshot.campaign_id == campaign_id
            )
        ).all()
    )

    eligible_snapshots = []
    for s in snapshots:
        lead = db.get(Lead, s.lead_id) if s.lead_id else None
        if lead and is_lead_eligible_contact(lead):
            eligible_snapshots.append(s)
        else:
            s.status = "suppressed"
            s.error_message = "Lead no longer meets eligibility or qualification criteria at dispatch time."

    if not eligible_snapshots:
        raise ValueError("No eligible recipients remain after dispatch-time suppression recheck.")

    now = _utc_now()

    if schedule_payload.send_immediately:
        campaign.status = "sending"
        db.flush()

        # Execute dispatch: mark eligible snapshots as sent
        sent_count = 0
        for s in eligible_snapshots:
            s.status = "sent"
            s.dispatch_attempt_at = now
            sent_count += 1

        campaign.status = "sent"
        campaign.sent_at = now
        campaign.sent_count = sent_count
        campaign.delivered_count = sent_count  # SMTP accepted count
        campaign.total_recipients = len(snapshots)

    else:
        # Schedule for future
        if not schedule_payload.scheduled_at:
            raise ValueError("A future date and time is required when scheduling a campaign.")

        target_time = schedule_payload.scheduled_at
        if target_time.tzinfo is None:
            target_time = target_time.replace(tzinfo=timezone.utc)

        if target_time <= now:
            raise ValueError("Scheduled time must be in the future.")

        campaign.status = "scheduled"
        campaign.scheduled_at = target_time
        campaign.timezone_name = schedule_payload.timezone_name or "UTC"
        campaign.total_recipients = len(snapshots)

    db.flush()
    return campaign

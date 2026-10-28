from datetime import datetime, timezone
import math
import re
from typing import Any
import urllib.parse
from sqlalchemy import desc, func, or_, select
from sqlalchemy.orm import Session

from app.models.campaign import (
    Campaign,
    CampaignEngagementEvent,
    CampaignRecipientSnapshot,
    CampaignReply,
)
from app.models.lead import Lead


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def get_campaign_report(db: Session, campaign_id: int) -> dict[str, Any]:
    """Computes genuine aggregated campaign analytics from real recipient and event records."""
    campaign = db.get(Campaign, campaign_id)
    if not campaign:
        raise ValueError(f"Campaign {campaign_id} not found.")

    snapshots = list(
        db.scalars(
            select(CampaignRecipientSnapshot).where(
                CampaignRecipientSnapshot.campaign_id == campaign_id
            )
        ).all()
    )

    total_recipients = len(snapshots)
    attempted = sum(1 for s in snapshots if s.dispatch_attempt_at is not None)
    submitted = sum(1 for s in snapshots if s.status in {"sent", "delivered"})
    delivered = sum(1 for s in snapshots if s.delivered_at is not None or s.status == "delivered" or (s.status == "sent" and not s.error_message))
    bounced = sum(1 for s in snapshots if s.bounced_at is not None or s.status == "bounced")
    failed = sum(1 for s in snapshots if s.status in {"failed", "suppressed"})
    deferred = 0 # Generic SMTP does not report deferral events

    # Open tracking
    total_opens = sum(s.open_count for s in snapshots)
    unique_opens = sum(1 for s in snapshots if s.opened_at is not None or s.open_count > 0)

    # Click tracking
    total_clicks = sum(s.click_count for s in snapshots)
    unique_clicks = sum(1 for s in snapshots if s.clicked_at is not None or s.click_count > 0)

    # Replies
    replied_count = sum(1 for s in snapshots if s.replied_at is not None)

    # Rate calculations with zero denominators handled safely
    bounce_rate = round((bounced / attempted * 100.0), 2) if attempted > 0 else 0.0
    # Open rate: unique opens / delivered
    open_rate = round((unique_opens / delivered * 100.0), 2) if delivered > 0 else 0.0
    # Click rate: unique clicks / delivered
    click_rate = round((unique_clicks / delivered * 100.0), 2) if delivered > 0 else 0.0

    return {
        "campaign_id": campaign.id,
        "campaign_name": campaign.name,
        "status": campaign.status,
        "sent_at": campaign.sent_at.isoformat() if campaign.sent_at else None,
        "created_at": campaign.created_at.isoformat() if campaign.created_at else None,
        "metrics": {
            "total_eligible_recipients": total_recipients,
            "emails_attempted": attempted,
            "successfully_submitted": submitted,
            "delivered_messages": delivered,
            "bounced_messages": bounced,
            "deferred_messages": deferred,
            "failed_messages": failed,
            "total_tracked_opens": total_opens,
            "unique_opens": unique_opens,
            "total_tracked_clicks": total_clicks,
            "unique_clickers": unique_clicks,
            "bounce_rate": bounce_rate,
            "open_rate": open_rate,
            "click_rate": click_rate,
            "replies_received": replied_count,
            "unsubscribes": campaign.unsubscribed_count,
            "spam_complaints": 0,
        },
        "metric_availability": {
            "delivery_events": True,
            "open_tracking": True,
            "click_tracking": True,
            "reply_tracking": True,
            "unsubscribes": True,
            "spam_complaints": False,  # Labelled unavailable for generic SMTP
            "deferred_messages": False,
        },
        "delivery_breakdown": {
            "sent": submitted,
            "delivered": delivered,
            "opened": unique_opens,
            "clicked": unique_clicks,
            "replied": replied_count,
            "bounced": bounced,
            "failed": failed,
        },
    }


def get_campaign_recipients_report(
    db: Session,
    campaign_id: int,
    page: int = 1,
    page_size: int = 20,
    search: str | None = None,
    status_filter: str | None = None,
) -> dict[str, Any]:
    """Retrieves paginated recipient-level campaign execution records with search and status filter."""
    page = max(1, page)
    page_size = max(1, min(100, page_size))

    query = select(CampaignRecipientSnapshot).where(
        CampaignRecipientSnapshot.campaign_id == campaign_id
    )

    if search and search.strip():
        term = f"%{search.strip().lower()}%"
        query = query.where(
            or_(
                func.lower(CampaignRecipientSnapshot.name).like(term),
                func.lower(CampaignRecipientSnapshot.normalized_email).like(term),
            )
        )

    if status_filter and status_filter.strip() and status_filter != "all":
        sf = status_filter.strip().lower()
        if sf == "opened":
            query = query.where(CampaignRecipientSnapshot.opened_at.is_not(None))
        elif sf == "clicked":
            query = query.where(CampaignRecipientSnapshot.clicked_at.is_not(None))
        elif sf == "replied":
            query = query.where(CampaignRecipientSnapshot.replied_at.is_not(None))
        elif sf == "bounced":
            query = query.where(CampaignRecipientSnapshot.bounced_at.is_not(None))
        else:
            query = query.where(CampaignRecipientSnapshot.status == sf)

    total_count = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    total_pages = max(1, math.ceil(total_count / page_size))
    offset = (page - 1) * page_size

    paged = query.order_by(
        desc(CampaignRecipientSnapshot.replied_at),
        desc(CampaignRecipientSnapshot.opened_at),
        desc(CampaignRecipientSnapshot.dispatch_attempt_at),
        CampaignRecipientSnapshot.id,
    ).offset(offset).limit(page_size)

    items = list(db.scalars(paged).all())

    results = []
    for s in items:
        # Determine human-friendly provider delivery status
        provider_delivery = "accepted" if s.status in {"sent", "delivered"} else (s.status or "pending")
        if s.bounced_at:
            provider_delivery = "bounced"
        elif s.error_message:
            provider_delivery = "failed"

        reply_status = "No reply observed"
        if s.replied_at:
            reply_status = "Replied"

        results.append({
            "id": s.id,
            "provider_message_id": s.provider_message_id,
            "name": s.name,
            "email": s.normalized_email,
            "send_status": s.status,
            "provider_delivery_status": provider_delivery,
            "dispatch_attempt_at": s.dispatch_attempt_at.isoformat() if s.dispatch_attempt_at else None,
            "first_open_timestamp": s.opened_at.isoformat() if s.opened_at else None,
            "unique_open": bool(s.opened_at or s.open_count > 0),
            "open_count": s.open_count,
            "clicked_at": s.clicked_at.isoformat() if s.clicked_at else None,
            "click_count": s.click_count,
            "bounce_status": "bounced" if s.bounced_at else "normal",
            "bounce_reason": s.bounce_reason,
            "reply_status": reply_status,
            "reply_timestamp": s.replied_at.isoformat() if s.replied_at else None,
            "reply_subject": s.reply_subject,
            "reply_snippet": s.reply_snippet,
            "error_message": s.error_message,
        })

    return {
        "campaign_id": campaign_id,
        "total": total_count,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
        "items": results,
    }


def record_open_event(
    db: Session,
    campaign_id: int,
    snapshot_id: int,
    ip_address: str | None = None,
    user_agent: str | None = None,
) -> bool:
    """Records an open tracking event idempotently, updating per-recipient and campaign metrics."""
    snapshot = db.get(CampaignRecipientSnapshot, snapshot_id)
    if not snapshot or snapshot.campaign_id != campaign_id:
        return False

    now = _utc_now()
    if snapshot.opened_at is None:
        snapshot.opened_at = now
    snapshot.open_count += 1

    # Record event log
    event = CampaignEngagementEvent(
        campaign_id=campaign_id,
        recipient_snapshot_id=snapshot_id,
        event_type="open",
        ip_address=ip_address,
        user_agent=user_agent[:500] if user_agent else None,
        created_at=now,
    )
    db.add(event)

    # Sync campaign rollup
    campaign = db.get(Campaign, campaign_id)
    if campaign:
        campaign.opened_count += 1

    db.commit()
    return True


def record_click_event(
    db: Session,
    campaign_id: int,
    snapshot_id: int,
    target_url: str,
    ip_address: str | None = None,
    user_agent: str | None = None,
) -> str:
    """Records a click tracking event and returns the sanitized target URL for redirection."""
    snapshot = db.get(CampaignRecipientSnapshot, snapshot_id)
    now = _utc_now()

    if snapshot and snapshot.campaign_id == campaign_id:
        if snapshot.clicked_at is None:
            snapshot.clicked_at = now
        snapshot.click_count += 1

        event = CampaignEngagementEvent(
            campaign_id=campaign_id,
            recipient_snapshot_id=snapshot_id,
            event_type="click",
            url=target_url[:2000] if target_url else None,
            ip_address=ip_address,
            user_agent=user_agent[:500] if user_agent else None,
            created_at=now,
        )
        db.add(event)

        campaign = db.get(Campaign, campaign_id)
        if campaign:
            campaign.clicked_count += 1

        db.commit()

    # Sanitize and validate target_url (prevent open redirect to dangerous schemes)
    clean_url = target_url.strip() if target_url else ""
    if not (clean_url.startswith("http://") or clean_url.startswith("https://") or clean_url.startswith("/")):
        clean_url = "https://sitechseries.org"
    return clean_url


def ingest_inbound_reply(
    db: Session,
    payload: dict[str, Any],
) -> dict[str, Any]:
    """Ingests an incoming reply, matches it against campaigns using In-Reply-To, Message-ID,
    or sender email, and updates recipient reply records.
    """
    sender_email = str(payload.get("sender_email") or payload.get("from") or "").strip().lower()
    recipient_email = str(payload.get("recipient_email") or payload.get("to") or "").strip().lower()
    subject = str(payload.get("subject") or "Re: Outreach").strip()
    body_snippet = str(payload.get("body_snippet") or payload.get("body") or payload.get("text") or "")[:1000].strip()
    message_id = str(payload.get("message_id") or "").strip() or None
    in_reply_to = str(payload.get("in_reply_to") or "").strip() or None
    references_header = str(payload.get("references") or "").strip() or None
    provider_thread_id = str(payload.get("thread_id") or "").strip() or None
    campaign_id_hint = payload.get("campaign_id")

    if not sender_email:
        raise ValueError("sender_email is required for inbound reply matching.")

    # 0. Deduplicate by message_id if already ingested
    if message_id:
        existing_reply = db.scalar(
            select(CampaignReply).where(CampaignReply.message_id == message_id)
        )
        if existing_reply:
            return {
                "matched": True,
                "match_type": "duplicate_idempotent",
                "campaign_id": existing_reply.campaign_id,
                "recipient_snapshot_id": existing_reply.recipient_snapshot_id,
                "recipient_email": existing_reply.sender_email,
                "reply_id": existing_reply.id,
                "duplicate": True,
            }

    # 1. First priority: match by in_reply_to or references against provider_message_id
    matched_snapshot = None
    match_type = "unmatched"

    if in_reply_to:
        matched_snapshot = db.scalar(
            select(CampaignRecipientSnapshot).where(
                CampaignRecipientSnapshot.provider_message_id == in_reply_to
            )
        )
        if matched_snapshot:
            match_type = "in_reply_to"

    if not matched_snapshot and references_header:
        # Search for any provider_message_id inside references
        snapshots_with_msgid = list(
            db.scalars(
                select(CampaignRecipientSnapshot).where(
                    CampaignRecipientSnapshot.provider_message_id.is_not(None)
                )
            ).all()
        )
        for s in snapshots_with_msgid:
            if s.provider_message_id and s.provider_message_id in references_header:
                matched_snapshot = s
                match_type = "references"
                break

    # 2. Second priority: match by sender_email within specified campaign_id if provided
    if not matched_snapshot and campaign_id_hint:
        matched_snapshot = db.scalar(
            select(CampaignRecipientSnapshot).where(
                CampaignRecipientSnapshot.campaign_id == int(campaign_id_hint),
                CampaignRecipientSnapshot.normalized_email == sender_email,
            )
        )
        if matched_snapshot:
            match_type = "sender_email_with_campaign"

    # 3. Third priority: match by sender_email on most recent sent campaign
    if not matched_snapshot:
        recent_snapshot = db.scalar(
            select(CampaignRecipientSnapshot)
            .join(Campaign, CampaignRecipientSnapshot.campaign_id == Campaign.id)
            .where(
                CampaignRecipientSnapshot.normalized_email == sender_email,
                Campaign.status.in_({"sent", "sending"}),
            )
            .order_by(desc(CampaignRecipientSnapshot.dispatch_attempt_at))
        )
        if recent_snapshot:
            matched_snapshot = recent_snapshot
            match_type = "sender_email_fallback"

    now = _utc_now()
    if matched_snapshot:
        target_campaign_id = matched_snapshot.campaign_id

        # Update snapshot reply fields
        is_first_reply = matched_snapshot.replied_at is None
        matched_snapshot.replied_at = now
        matched_snapshot.reply_subject = subject
        matched_snapshot.reply_snippet = body_snippet

        # Update campaign aggregate (only for first reply from this recipient)
        campaign = db.get(Campaign, target_campaign_id)
        if campaign and is_first_reply:
            campaign.replied_count += 1

        account_email = (
            campaign.email_account.email_address
            if (campaign and campaign.email_account)
            else "outreach@sitechseries.org"
        )
        final_recipient_email = recipient_email or account_email

        # Save reply record
        reply_record = CampaignReply(
            campaign_id=target_campaign_id,
            recipient_snapshot_id=matched_snapshot.id,
            sender_email=sender_email,
            recipient_email=final_recipient_email,
            subject=subject,
            body_snippet=body_snippet,
            message_id=message_id,
            in_reply_to=in_reply_to,
            references_header=references_header,
            provider_thread_id=provider_thread_id,
            received_at=now,
            match_type=match_type,
            created_at=now,
        )
        db.add(reply_record)
        db.commit()

        return {
            "matched": True,
            "match_type": match_type,
            "campaign_id": target_campaign_id,
            "recipient_snapshot_id": matched_snapshot.id,
            "recipient_email": sender_email,
            "reply_id": reply_record.id,
        }
    else:
        return {
            "matched": False,
            "match_type": "none",
            "reason": f"No active campaign recipient found matching sender '{sender_email}' or message references.",
        }


def get_campaign_replies(
    db: Session,
    campaign_id: int,
    owner_user_id: int | None = None,
) -> list[dict[str, Any]]:
    """Retrieve full persisted inbound replies associated with a campaign."""
    campaign = db.get(Campaign, campaign_id)
    if not campaign:
        raise ValueError(f"Campaign {campaign_id} not found.")

    if owner_user_id is not None and campaign.owner_user_id is not None and campaign.owner_user_id != owner_user_id:
        raise PermissionError("Access denied: You do not have permission to view replies for this campaign.")

    replies = list(
        db.scalars(
            select(CampaignReply)
            .where(CampaignReply.campaign_id == campaign_id)
            .order_by(desc(CampaignReply.received_at))
        ).all()
    )

    return [
        {
            "id": r.id,
            "campaign_id": r.campaign_id,
            "recipient_snapshot_id": r.recipient_snapshot_id,
            "sender_email": r.sender_email,
            "recipient_email": r.recipient_email,
            "subject": r.subject,
            "body_snippet": r.body_snippet,
            "message_id": r.message_id,
            "in_reply_to": r.in_reply_to,
            "received_at": r.received_at.isoformat() if r.received_at else None,
            "match_type": r.match_type,
        }
        for r in replies
    ]


def handle_campaign_unsubscribe(
    db: Session,
    campaign_id: int,
    snapshot_id: int,
) -> bool:
    """Processes an unsubscribe request from a recipient, marking them suppressed and updating counts."""
    snapshot = db.get(CampaignRecipientSnapshot, snapshot_id)
    if not snapshot or snapshot.campaign_id != campaign_id:
        return False

    campaign = db.get(Campaign, campaign_id)

    if snapshot.status != "suppressed":
        snapshot.status = "suppressed"
        snapshot.error_message = "Recipient unsubscribed from outreach"
        if campaign:
            campaign.unsubscribed_count += 1

    if snapshot.lead_id:
        lead = db.get(Lead, snapshot.lead_id)
        if lead:
            lead.qualification_status = "unqualified"
            lead.qualification_reason = "Unsubscribed from outreach"

    db.commit()
    return True



def export_recipients_csv(db: Session, campaign_id: int) -> str:
    """Generates a CSV string of recipient engagement statuses."""
    import csv
    import io

    report = get_campaign_recipients_report(db, campaign_id, page=1, page_size=10000)
    items = report["items"]

    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "Recipient Name",
        "Recipient Email",
        "Send Status",
        "Provider Delivery Status",
        "Dispatched At",
        "First Opened At",
        "Open Count",
        "Clicked At",
        "Click Count",
        "Bounce Status",
        "Bounce Reason",
        "Reply Status",
        "Reply Timestamp",
        "Reply Subject",
    ])

    for r in items:
        writer.writerow([
            r["name"],
            r["email"],
            r["send_status"],
            r["provider_delivery_status"],
            r["dispatch_attempt_at"] or "",
            r["first_open_timestamp"] or "",
            r["open_count"],
            r["clicked_at"] or "",
            r["click_count"],
            r["bounce_status"],
            r["bounce_reason"] or "",
            r["reply_status"],
            r["reply_timestamp"] or "",
            r["reply_subject"] or "",
        ])

    return output.getvalue()



# ==============================================================================
# CAMPAIGN TRACKING MODULE EXTENSIONS
# ==============================================================================

import io
from openpyxl.styles import Alignment, Border, Font, PatternFill, Side
from openpyxl.utils import get_column_letter
import openpyxl
from sqlalchemy import asc, and_
from app.models.campaign import CampaignContent
from app.models.email_account import EmailAccount
from app.models.user import User
from app.services.excel_export_service import sanitize_cell_value


def classify_bounce(reason: str | None) -> str:
    """Classifies a bounce message into 'hard', 'soft', or 'unknown'."""
    if not reason:
        return "unknown"
    r = reason.lower()
    hard_keywords = [
        "550", "551", "552", "553", "554", "5.1.1", "5.1.2", "5.1.3", "5.1.4", "5.1.6", "5.2.1",
        "user unknown", "no such user", "mailbox unavailable", "mailbox not found",
        "recipient address rejected", "domain not found", "does not exist",
        "unrouteable address", "disabled", "invalid mailbox", "invalid recipient",
        "permanent failure", "hard bounce", "bad destination", "user not found",
        "recipient not found", "host not found"
    ]
    soft_keywords = [
        "450", "451", "452", "4.2.2", "4.3.1", "4.4.1", "4.4.2", "4.7.1",
        "mailbox full", "quota exceeded", "exceeded storage", "storage full",
        "temporarily deferred", "temporary failure", "try again later",
        "rate limit", "too many connections", "connection timed out",
        "server busy", "soft bounce", "message too large", "greylist"
    ]
    for k in hard_keywords:
        if k in r:
            return "hard"
    for k in soft_keywords:
        if k in r:
            return "soft"
    return "unknown"


def get_completed_campaigns_overview(
    db: Session,
    page: int = 1,
    page_size: int = 10,
    search: str | None = None,
    status_filter: str | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
    owner_user_id: int | None = None,
) -> dict[str, Any]:
    """Lists completed/sent campaigns with server-side pagination, search, and top-level aggregated analytics."""
    page = max(1, page)
    page_size = max(1, min(100, page_size))

    # Base query for completed campaigns: status in 'sent' or 'completed'
    query = select(Campaign)
    if status_filter and status_filter.strip() and status_filter.lower() != "all":
        sf = status_filter.strip().lower()
        if sf in ("sent", "completed"):
            query = query.where(Campaign.status == sf)
        elif sf in ("completed_all", "all_completed"):
            query = query.where(Campaign.status.in_(["sent", "completed"]))
        else:
            query = query.where(Campaign.status == sf)
    else:
        # Default to completed campaigns (sent or completed)
        query = query.where(Campaign.status.in_(["sent", "completed"]))

    if search and search.strip():
        term = f"%{search.strip().lower()}%"
        query = query.where(func.lower(Campaign.name).like(term))

    if start_date and start_date.strip():
        try:
            dt_start = datetime.fromisoformat(start_date.strip().replace("Z", "+00:00"))
            query = query.where(
                or_(
                    Campaign.sent_at >= dt_start,
                    and_(Campaign.sent_at.is_(None), Campaign.created_at >= dt_start),
                )
            )
        except Exception:
            pass

    if end_date and end_date.strip():
        try:
            dt_end = datetime.fromisoformat(end_date.strip().replace("Z", "+00:00"))
            query = query.where(
                or_(
                    Campaign.sent_at <= dt_end,
                    and_(Campaign.sent_at.is_(None), Campaign.created_at <= dt_end),
                )
            )
        except Exception:
            pass

    # Total count matching query
    total_count = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    total_pages = max(1, math.ceil(total_count / page_size))
    offset = (page - 1) * page_size

    # All matching campaigns for aggregate calculations
    all_matching_campaigns = list(db.scalars(query).all())
    completed_campaigns_count = len(all_matching_campaigns)
    total_sent = sum(c.sent_count for c in all_matching_campaigns)
    total_delivered = sum(c.delivered_count for c in all_matching_campaigns)
    total_opens = sum(c.opened_count for c in all_matching_campaigns)
    total_bounces = sum(c.bounced_count for c in all_matching_campaigns)
    total_clicks = sum(c.clicked_count for c in all_matching_campaigns)

    matching_cids = [c.id for c in all_matching_campaigns]
    unique_opened_recipients = 0
    unique_clicks = 0
    if matching_cids:
        unique_opened_recipients = db.scalar(
            select(func.count(CampaignRecipientSnapshot.id)).where(
                CampaignRecipientSnapshot.campaign_id.in_(matching_cids),
                or_(
                    CampaignRecipientSnapshot.opened_at.is_not(None),
                    CampaignRecipientSnapshot.open_count > 0,
                )
            )
        ) or 0
        unique_clicks = db.scalar(
            select(func.count(CampaignRecipientSnapshot.id)).where(
                CampaignRecipientSnapshot.campaign_id.in_(matching_cids),
                or_(
                    CampaignRecipientSnapshot.clicked_at.is_not(None),
                    CampaignRecipientSnapshot.click_count > 0,
                )
            )
        ) or 0

    overall_open_rate = round((unique_opened_recipients / total_delivered * 100.0), 2) if total_delivered > 0 else 0.0
    overall_bounce_rate = round((total_bounces / total_sent * 100.0), 2) if total_sent > 0 else 0.0
    overall_click_rate = round((unique_clicks / total_delivered * 100.0), 2) if total_delivered > 0 else 0.0

    overview_metrics = {
        "completed_campaigns": completed_campaigns_count,
        "total_sent": total_sent,
        "total_delivered": total_delivered,
        "total_opens": total_opens,
        "unique_opened_recipients": unique_opened_recipients,
        "overall_open_rate": overall_open_rate,
        "total_bounces": total_bounces,
        "overall_bounce_rate": overall_bounce_rate,
        "total_clicks": total_clicks,
        "unique_clicks": unique_clicks,
        "overall_click_rate": overall_click_rate,
    }

    # Fetch paginated campaigns
    paged_query = query.order_by(
        desc(Campaign.sent_at),
        desc(Campaign.created_at),
        desc(Campaign.id),
    ).offset(offset).limit(page_size)

    paged_campaigns = list(db.scalars(paged_query).all())
    paged_cids = [c.id for c in paged_campaigns]

    unique_opens_by_cid = {}
    unique_clicks_by_cid = {}
    if paged_cids:
        rows_opens = db.execute(
            select(
                CampaignRecipientSnapshot.campaign_id,
                func.count(CampaignRecipientSnapshot.id),
            )
            .where(
                CampaignRecipientSnapshot.campaign_id.in_(paged_cids),
                or_(
                    CampaignRecipientSnapshot.opened_at.is_not(None),
                    CampaignRecipientSnapshot.open_count > 0,
                ),
            )
            .group_by(CampaignRecipientSnapshot.campaign_id)
        ).all()
        for cid, cnt in rows_opens:
            unique_opens_by_cid[cid] = cnt

        rows_clicks = db.execute(
            select(
                CampaignRecipientSnapshot.campaign_id,
                func.count(CampaignRecipientSnapshot.id),
            )
            .where(
                CampaignRecipientSnapshot.campaign_id.in_(paged_cids),
                or_(
                    CampaignRecipientSnapshot.clicked_at.is_not(None),
                    CampaignRecipientSnapshot.click_count > 0,
                ),
            )
            .group_by(CampaignRecipientSnapshot.campaign_id)
        ).all()
        for cid, cnt in rows_clicks:
            unique_clicks_by_cid[cid] = cnt

    items = []
    for c in paged_campaigns:
        u_opens = unique_opens_by_cid.get(c.id, 0)
        u_clicks = unique_clicks_by_cid.get(c.id, 0)
        deliv = c.delivered_count or c.sent_count
        s_count = c.sent_count
        b_count = c.bounced_count

        op_rate = round((u_opens / deliv * 100.0), 2) if deliv > 0 else 0.0
        cl_rate = round((u_clicks / deliv * 100.0), 2) if deliv > 0 else 0.0
        bo_rate = round((b_count / s_count * 100.0), 2) if s_count > 0 else 0.0

        owner_name = (
            c.owner.display_name or c.owner.email
            if c.owner
            else None
        )
        sender_email = (
            c.email_account.email_address
            if c.email_account
            else None
        )

        items.append({
            "id": c.id,
            "name": c.name,
            "status": c.status,
            "sent_at": c.sent_at.isoformat() if c.sent_at else None,
            "created_at": c.created_at.isoformat() if c.created_at else None,
            "total_recipients": c.total_recipients,
            "sent_count": c.sent_count,
            "delivered_count": c.delivered_count,
            "opened_count": c.opened_count,
            "unique_opens": u_opens,
            "open_rate": op_rate,
            "clicked_count": c.clicked_count,
            "unique_clicks": u_clicks,
            "click_rate": cl_rate,
            "bounced_count": b_count,
            "bounce_rate": bo_rate,
            "owner_name": owner_name,
            "sender_email": sender_email,
        })

    return {
        "items": items,
        "total": total_count,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
        "overview_metrics": overview_metrics,
    }


def get_campaign_tracking_detail_summary(
    db: Session,
    campaign_id: int,
    owner_user_id: int | None = None,
) -> dict[str, Any]:
    """Computes comprehensive campaign tracking summary metrics including immutable historical bounce metrics."""
    campaign = db.get(Campaign, campaign_id)
    if not campaign:
        raise ValueError(f"Campaign {campaign_id} not found.")

    if owner_user_id is not None and campaign.owner_user_id is not None and campaign.owner_user_id != owner_user_id:
        raise PermissionError("Access denied: You do not have permission to view tracking for this campaign.")

    latest_content = None
    if campaign.contents:
        latest_content = sorted(campaign.contents, key=lambda c: c.version, reverse=True)[0]

    sender_name = latest_content.from_name if latest_content else (campaign.email_account.from_name if campaign.email_account else None)
    sender_email = latest_content.from_email if latest_content else (campaign.email_account.email_address if campaign.email_account else None)
    reply_to = latest_content.reply_to if latest_content else (campaign.email_account.reply_to_email if campaign.email_account else None)
    subject = latest_content.subject if latest_content else None
    preview_text = latest_content.preview_text if latest_content else None

    snapshots = list(
        db.scalars(
            select(CampaignRecipientSnapshot).where(
                CampaignRecipientSnapshot.campaign_id == campaign_id
            )
        ).all()
    )

    total_recipients = len(snapshots)
    emails_attempted = max(sum(1 for s in snapshots if s.dispatch_attempt_at is not None), campaign.sent_count, 1)
    sent = campaign.sent_count or sum(1 for s in snapshots if s.status in {"sent", "delivered"})
    delivered = campaign.delivered_count or sum(1 for s in snapshots if s.delivered_at is not None or s.status == "delivered" or (s.status == "sent" and not s.error_message))
    delivery_rate = round((delivered / emails_attempted * 100.0), 2) if emails_attempted > 0 else (100.0 if delivered > 0 else 0.0)

    total_opens = sum(s.open_count for s in snapshots)
    unique_opens = sum(1 for s in snapshots if s.opened_at is not None or s.open_count > 0)
    open_rate = round((unique_opens / delivered * 100.0), 2) if delivered > 0 else 0.0

    total_clicks = sum(s.click_count for s in snapshots)
    unique_clicks = sum(1 for s in snapshots if s.clicked_at is not None or s.click_count > 0)
    click_rate = round((unique_clicks / delivered * 100.0), 2) if delivered > 0 else 0.0

    # HISTORICAL BOUNCE METRICS (IMMUTABLE INVARIANT):
    # Calculated from all snapshots that ever bounced, regardless of is_bounce_listing_deleted
    snapshot_bounced_all = [s for s in snapshots if s.bounced_at is not None or s.status == "bounced"]
    historical_bounced_count = max(len(snapshot_bounced_all), campaign.bounced_count)
    historical_bounce_rate = round((historical_bounced_count / emails_attempted * 100.0), 2) if emails_attempted > 0 else 0.0

    hard_bounces = 0
    soft_bounces = 0
    unknown_bounces = 0
    for s in snapshot_bounced_all:
        b_type = s.bounce_type or classify_bounce(s.bounce_reason)
        if b_type == "hard":
            hard_bounces += 1
        elif b_type == "soft":
            soft_bounces += 1
        else:
            unknown_bounces += 1

    active_bounce_listing_count = sum(1 for s in snapshot_bounced_all if not s.is_bounce_listing_deleted)
    replies_count = sum(1 for s in snapshots if s.replied_at is not None) or campaign.replied_count
    unsubscribes_count = campaign.unsubscribed_count

    return {
        "campaign_id": campaign.id,
        "name": campaign.name,
        "status": campaign.status,
        "sent_at": campaign.sent_at.isoformat() if campaign.sent_at else None,
        "created_at": campaign.created_at.isoformat() if campaign.created_at else None,
        "sender_name": sender_name,
        "sender_email": sender_email,
        "reply_to": reply_to,
        "subject": subject,
        "preview_text": preview_text,
        "metrics": {
            "total_recipients": total_recipients,
            "emails_attempted": emails_attempted,
            "sent": sent,
            "delivered": delivered,
            "delivery_rate": delivery_rate,
            "total_opens": total_opens,
            "unique_opens": unique_opens,
            "open_rate": open_rate,
            "total_clicks": total_clicks,
            "unique_clicks": unique_clicks,
            "click_rate": click_rate,
            "historical_bounced_count": historical_bounced_count,
            "historical_bounce_rate": historical_bounce_rate,
            "hard_bounces": hard_bounces,
            "soft_bounces": soft_bounces,
            "unknown_bounces": unknown_bounces,
            "active_bounce_listing_count": active_bounce_listing_count,
            "replies_count": replies_count,
            "unsubscribes_count": unsubscribes_count,
        },
    }


def get_campaign_opened_recipients(
    db: Session,
    campaign_id: int,
    page: int = 1,
    page_size: int = 20,
    search: str | None = None,
    country: str | None = None,
    profession: str | None = None,
    university: str | None = None,
    sort_by: str | None = "opened_at",
    sort_order: str | None = "desc",
    owner_user_id: int | None = None,
) -> dict[str, Any]:
    """Retrieves paginated recipients who opened emails for the campaign, with lead attributes and filtering."""
    page = max(1, page)
    page_size = max(1, min(100, page_size))

    campaign = db.get(Campaign, campaign_id)
    if not campaign:
        raise ValueError(f"Campaign {campaign_id} not found.")

    if owner_user_id is not None and campaign.owner_user_id is not None and campaign.owner_user_id != owner_user_id:
        raise PermissionError("Access denied: You do not have permission to view opened recipients for this campaign.")

    base_filter = [
        CampaignRecipientSnapshot.campaign_id == campaign_id,
        or_(
            CampaignRecipientSnapshot.opened_at.is_not(None),
            CampaignRecipientSnapshot.open_count > 0,
        ),
    ]

    # Pre-calculate distinct filter attributes across all opened recipients
    all_opened = list(
        db.execute(
            select(CampaignRecipientSnapshot, Lead)
            .outerjoin(Lead, CampaignRecipientSnapshot.lead_id == Lead.id)
            .where(*base_filter)
        ).all()
    )
    available_countries = sorted(list({lead.country for _, lead in all_opened if lead and lead.country}))
    available_professions = sorted(list({lead.profession for _, lead in all_opened if lead and lead.profession}))
    available_universities = sorted(list({lead.university for _, lead in all_opened if lead and lead.university}))

    query = (
        select(CampaignRecipientSnapshot, Lead)
        .outerjoin(Lead, CampaignRecipientSnapshot.lead_id == Lead.id)
        .where(*base_filter)
    )

    if search and search.strip():
        term = f"%{search.strip().lower()}%"
        query = query.where(
            or_(
                func.lower(CampaignRecipientSnapshot.name).like(term),
                func.lower(CampaignRecipientSnapshot.normalized_email).like(term),
            )
        )

    if country and country.strip() and country.strip().lower() != "all":
        query = query.where(func.lower(Lead.country) == country.strip().lower())
    if profession and profession.strip() and profession.strip().lower() != "all":
        query = query.where(func.lower(Lead.profession) == profession.strip().lower())
    if university and university.strip() and university.strip().lower() != "all":
        query = query.where(func.lower(Lead.university) == university.strip().lower())

    total_count = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    total_pages = max(1, math.ceil(total_count / page_size))
    offset = (page - 1) * page_size

    order_col = CampaignRecipientSnapshot.opened_at
    if sort_by == "name":
        order_col = CampaignRecipientSnapshot.name
    elif sort_by == "email":
        order_col = CampaignRecipientSnapshot.normalized_email
    elif sort_by == "open_count":
        order_col = CampaignRecipientSnapshot.open_count
    elif sort_by == "click_count":
        order_col = CampaignRecipientSnapshot.click_count

    if sort_order == "asc":
        query = query.order_by(asc(order_col), asc(CampaignRecipientSnapshot.id))
    else:
        query = query.order_by(desc(order_col), desc(CampaignRecipientSnapshot.id))

    paged_rows = list(db.execute(query.offset(offset).limit(page_size)).all())

    items = []
    for snap, lead in paged_rows:
        items.append({
            "id": snap.id,
            "recipient_name": snap.name,
            "email": snap.normalized_email,
            "profession": lead.profession if lead else None,
            "university": lead.university if lead else None,
            "country": lead.country if lead else None,
            "first_opened_at": snap.opened_at.isoformat() if snap.opened_at else None,
            "last_opened_at": snap.opened_at.isoformat() if snap.opened_at else None,
            "open_count": snap.open_count,
            "click_count": snap.click_count,
        })

    return {
        "items": items,
        "total": total_count,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
        "available_countries": available_countries,
        "available_professions": available_professions,
        "available_universities": available_universities,
    }


def get_campaign_bounced_mails(
    db: Session,
    campaign_id: int,
    page: int = 1,
    page_size: int = 20,
    search: str | None = None,
    bounce_type: str | None = None,
    country: str | None = None,
    profession: str | None = None,
    university: str | None = None,
    start_date: str | None = None,
    end_date: str | None = None,
    owner_user_id: int | None = None,
) -> dict[str, Any]:
    """Retrieves paginated active bounced emails for a campaign with authoritative historical bounce summary."""
    page = max(1, page)
    page_size = max(1, min(100, page_size))

    campaign = db.get(Campaign, campaign_id)
    if not campaign:
        raise ValueError(f"Campaign {campaign_id} not found.")

    if owner_user_id is not None and campaign.owner_user_id is not None and campaign.owner_user_id != owner_user_id:
        raise PermissionError("Access denied: You do not have permission to view bounced mails for this campaign.")

    # IMMUTABLE HISTORICAL SUMMARY:
    # Query all historical bounced snapshots regardless of is_bounce_listing_deleted
    all_bounced_snapshots = list(
        db.execute(
            select(CampaignRecipientSnapshot, Lead)
            .outerjoin(Lead, CampaignRecipientSnapshot.lead_id == Lead.id)
            .where(
                CampaignRecipientSnapshot.campaign_id == campaign_id,
                or_(
                    CampaignRecipientSnapshot.bounced_at.is_not(None),
                    CampaignRecipientSnapshot.status == "bounced",
                ),
            )
        ).all()
    )

    attempted_from_snaps = sum(
        1 for s in db.scalars(
            select(CampaignRecipientSnapshot.id).where(
                CampaignRecipientSnapshot.campaign_id == campaign_id,
                CampaignRecipientSnapshot.dispatch_attempt_at.is_not(None),
            )
        ).all()
    )
    emails_attempted = max(attempted_from_snaps, campaign.sent_count, 1)

    total_historical_bounced = max(len(all_bounced_snapshots), campaign.bounced_count)
    historical_bounce_rate = round((total_historical_bounced / emails_attempted * 100.0), 2) if emails_attempted > 0 else 0.0

    hard_bounces = 0
    soft_bounces = 0
    unknown_bounces = 0
    available_countries_set = set()
    available_professions_set = set()
    available_universities_set = set()

    for snap, lead in all_bounced_snapshots:
        b_type = snap.bounce_type or classify_bounce(snap.bounce_reason)
        if b_type == "hard":
            hard_bounces += 1
        elif b_type == "soft":
            soft_bounces += 1
        else:
            unknown_bounces += 1

        if not snap.is_bounce_listing_deleted:
            if lead and lead.country:
                available_countries_set.add(lead.country)
            if lead and lead.profession:
                available_professions_set.add(lead.profession)
            if lead and lead.university:
                available_universities_set.add(lead.university)

    summary = {
        "total_historical_bounced": total_historical_bounced,
        "historical_bounce_rate": historical_bounce_rate,
        "hard_bounces": hard_bounces,
        "soft_bounces": soft_bounces,
        "unknown_bounces": unknown_bounces,
        "active_listing_count": sum(1 for snap, _ in all_bounced_snapshots if not snap.is_bounce_listing_deleted),
    }

    # Query active (non-deleted) bounced-mail listing records
    query = (
        select(CampaignRecipientSnapshot, Lead)
        .outerjoin(Lead, CampaignRecipientSnapshot.lead_id == Lead.id)
        .where(
            CampaignRecipientSnapshot.campaign_id == campaign_id,
            or_(
                CampaignRecipientSnapshot.bounced_at.is_not(None),
                CampaignRecipientSnapshot.status == "bounced",
            ),
            CampaignRecipientSnapshot.is_bounce_listing_deleted == False,
        )
    )

    if search and search.strip():
        term = f"%{search.strip().lower()}%"
        query = query.where(
            or_(
                func.lower(CampaignRecipientSnapshot.name).like(term),
                func.lower(CampaignRecipientSnapshot.normalized_email).like(term),
                func.lower(CampaignRecipientSnapshot.bounce_reason).like(term),
            )
        )

    if bounce_type and bounce_type.strip() and bounce_type.strip().lower() != "all":
        bt = bounce_type.strip().lower()
        query = query.where(
            or_(
                func.lower(CampaignRecipientSnapshot.bounce_type) == bt,
                and_(
                    CampaignRecipientSnapshot.bounce_type.is_(None),
                    func.lower(CampaignRecipientSnapshot.bounce_reason).like(f"%{bt}%"),
                ),
            )
        )

    if country and country.strip() and country.strip().lower() != "all":
        query = query.where(func.lower(Lead.country) == country.strip().lower())
    if profession and profession.strip() and profession.strip().lower() != "all":
        query = query.where(func.lower(Lead.profession) == profession.strip().lower())
    if university and university.strip() and university.strip().lower() != "all":
        query = query.where(func.lower(Lead.university) == university.strip().lower())

    if start_date and start_date.strip():
        try:
            dt_start = datetime.fromisoformat(start_date.strip().replace("Z", "+00:00"))
            query = query.where(CampaignRecipientSnapshot.bounced_at >= dt_start)
        except Exception:
            pass

    if end_date and end_date.strip():
        try:
            dt_end = datetime.fromisoformat(end_date.strip().replace("Z", "+00:00"))
            query = query.where(CampaignRecipientSnapshot.bounced_at <= dt_end)
        except Exception:
            pass

    total_count = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    total_pages = max(1, math.ceil(total_count / page_size))
    offset = (page - 1) * page_size

    paged_rows = list(
        db.execute(
            query.order_by(
                desc(CampaignRecipientSnapshot.bounced_at),
                desc(CampaignRecipientSnapshot.id),
            ).offset(offset).limit(page_size)
        ).all()
    )

    items = []
    for snap, lead in paged_rows:
        b_type = snap.bounce_type or classify_bounce(snap.bounce_reason)
        items.append({
            "id": snap.id,
            "recipient_name": snap.name,
            "email": snap.normalized_email,
            "profession": lead.profession if lead else None,
            "university": lead.university if lead else None,
            "country": lead.country if lead else None,
            "bounce_type": b_type,
            "bounce_reason": snap.bounce_reason,
            "bounced_at": snap.bounced_at.isoformat() if snap.bounced_at else None,
            "dispatch_attempt_at": snap.dispatch_attempt_at.isoformat() if snap.dispatch_attempt_at else None,
        })

    return {
        "items": items,
        "total": total_count,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
        "summary": summary,
        "available_countries": sorted(list(available_countries_set)),
        "available_professions": sorted(list(available_professions_set)),
        "available_universities": sorted(list(available_universities_set)),
    }


def delete_single_bounced_mail(
    db: Session,
    campaign_id: int,
    record_id: int,
    owner_user_id: int | None = None,
) -> dict[str, Any]:
    """Removes a bounced email from the visible listing while permanently preserving historical bounce statistics."""
    campaign = db.get(Campaign, campaign_id)
    if not campaign:
        raise ValueError(f"Campaign {campaign_id} not found.")

    if owner_user_id is not None and campaign.owner_user_id is not None and campaign.owner_user_id != owner_user_id:
        raise PermissionError("Access denied: You do not have permission to modify this campaign.")

    snapshot = db.scalar(
        select(CampaignRecipientSnapshot).where(
            CampaignRecipientSnapshot.id == record_id,
            CampaignRecipientSnapshot.campaign_id == campaign_id,
            or_(
                CampaignRecipientSnapshot.bounced_at.is_not(None),
                CampaignRecipientSnapshot.status == "bounced",
            ),
        )
    )
    if not snapshot:
        raise ValueError(f"Bounced recipient snapshot {record_id} not found for campaign {campaign_id}.")

    # Mark deleted from active listing only
    snapshot.is_bounce_listing_deleted = True
    db.commit()

    all_bounced_count = db.scalar(
        select(func.count(CampaignRecipientSnapshot.id)).where(
            CampaignRecipientSnapshot.campaign_id == campaign_id,
            or_(
                CampaignRecipientSnapshot.bounced_at.is_not(None),
                CampaignRecipientSnapshot.status == "bounced",
            ),
        )
    ) or campaign.bounced_count

    attempted = campaign.sent_count or 1
    historical_rate = round((all_bounced_count / attempted * 100.0), 2)

    return {
        "success": True,
        "deleted_count": 1,
        "message": "Bounced mail record removed from listing. Historical bounce rate and count remain preserved.",
        "historical_bounced_count": all_bounced_count,
        "historical_bounce_rate": historical_rate,
    }


def delete_all_bounced_mails(
    db: Session,
    campaign_id: int,
    bounce_type: str | None = None,
    owner_user_id: int | None = None,
) -> dict[str, Any]:
    """Removes all active bounced emails from the listing while permanently preserving historical bounce statistics."""
    campaign = db.get(Campaign, campaign_id)
    if not campaign:
        raise ValueError(f"Campaign {campaign_id} not found.")

    if owner_user_id is not None and campaign.owner_user_id is not None and campaign.owner_user_id != owner_user_id:
        raise PermissionError("Access denied: You do not have permission to modify this campaign.")

    query = select(CampaignRecipientSnapshot).where(
        CampaignRecipientSnapshot.campaign_id == campaign_id,
        or_(
            CampaignRecipientSnapshot.bounced_at.is_not(None),
            CampaignRecipientSnapshot.status == "bounced",
        ),
        CampaignRecipientSnapshot.is_bounce_listing_deleted == False,
    )

    if bounce_type and bounce_type.strip() and bounce_type.strip().lower() != "all":
        bt = bounce_type.strip().lower()
        query = query.where(
            or_(
                func.lower(CampaignRecipientSnapshot.bounce_type) == bt,
                and_(
                    CampaignRecipientSnapshot.bounce_type.is_(None),
                    func.lower(CampaignRecipientSnapshot.bounce_reason).like(f"%{bt}%"),
                ),
            )
        )

    snapshots_to_delete = list(db.scalars(query).all())
    deleted_count = len(snapshots_to_delete)

    for s in snapshots_to_delete:
        s.is_bounce_listing_deleted = True

    db.commit()

    all_bounced_count = db.scalar(
        select(func.count(CampaignRecipientSnapshot.id)).where(
            CampaignRecipientSnapshot.campaign_id == campaign_id,
            or_(
                CampaignRecipientSnapshot.bounced_at.is_not(None),
                CampaignRecipientSnapshot.status == "bounced",
            ),
        )
    ) or campaign.bounced_count

    attempted = campaign.sent_count or 1
    historical_rate = round((all_bounced_count / attempted * 100.0), 2)

    return {
        "success": True,
        "deleted_count": deleted_count,
        "message": f"Successfully removed {deleted_count} bounced mail record(s) from listing. Historical bounce rate and count remain preserved.",
        "historical_bounced_count": all_bounced_count,
        "historical_bounce_rate": historical_rate,
    }


def generate_opened_recipients_excel(
    db: Session,
    campaign_id: int,
    search: str | None = None,
    country: str | None = None,
    profession: str | None = None,
    university: str | None = None,
    owner_user_id: int | None = None,
) -> bytes:
    """Generates a professional Excel workbook for recipients who opened campaign emails."""
    report = get_campaign_opened_recipients(
        db=db,
        campaign_id=campaign_id,
        page=1,
        page_size=10000,
        search=search,
        country=country,
        profession=profession,
        university=university,
        owner_user_id=owner_user_id,
    )
    items = report["items"]

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Opened Recipients"
    ws.views.sheetView[0].showGridLines = True

    headers = [
        "Recipient Name",
        "Email Address",
        "Profession / Specialization",
        "University / Institution",
        "Country",
        "First Opened At (UTC)",
        "Last Opened At (UTC)",
        "Total Opens",
        "Total Clicks",
    ]

    header_font = Font(name="Segoe UI", size=11, bold=True, color="FFFFFF")
    header_fill = PatternFill(start_color="1E293B", end_color="1E293B", fill_type="solid")
    header_align = Alignment(horizontal="center", vertical="center", wrap_text=True)

    thin_border_side = Side(style="thin", color="E2E8F0")
    thin_border = Border(
        left=thin_border_side,
        right=thin_border_side,
        top=thin_border_side,
        bottom=thin_border_side,
    )

    ws.row_dimensions[1].height = 28
    for col_idx, header in enumerate(headers, start=1):
        cell = ws.cell(row=1, column=col_idx, value=header)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = header_align
        cell.border = thin_border

    zebra_fill = PatternFill(start_color="F8FAFC", end_color="F8FAFC", fill_type="solid")
    data_font = Font(name="Segoe UI", size=10, color="0F172A")
    regular_align = Alignment(vertical="center")
    center_align = Alignment(horizontal="center", vertical="center")

    for row_idx, item in enumerate(items, start=2):
        ws.row_dimensions[row_idx].height = 22
        is_even = row_idx % 2 == 0
        fill = zebra_fill if is_even else None

        row_values = [
            (sanitize_cell_value(item["recipient_name"]), regular_align),
            (sanitize_cell_value(item["email"]), regular_align),
            (sanitize_cell_value(item["profession"] or "—"), regular_align),
            (sanitize_cell_value(item["university"] or "—"), regular_align),
            (sanitize_cell_value(item["country"] or "—"), center_align),
            (sanitize_cell_value(item["first_opened_at"] or "—"), center_align),
            (sanitize_cell_value(item["last_opened_at"] or "—"), center_align),
            (item["open_count"], center_align),
            (item["click_count"], center_align),
        ]

        for col_idx, (val, align) in enumerate(row_values, start=1):
            cell = ws.cell(row=row_idx, column=col_idx, value=val)
            cell.font = data_font
            cell.alignment = align
            cell.border = thin_border
            if fill:
                cell.fill = fill

    # Auto-width adjustments
    for col in ws.columns:
        col_letter = get_column_letter(col[0].column)
        max_len = 0
        for cell in col:
            val_str = str(cell.value or "")
            if len(val_str) > max_len:
                max_len = len(val_str)
        ws.column_dimensions[col_letter].width = max(max_len + 4, 14)

    bio = io.BytesIO()
    wb.save(bio)
    return bio.getvalue()


def generate_bounced_mails_excel(
    db: Session,
    campaign_id: int,
    search: str | None = None,
    bounce_type: str | None = None,
    country: str | None = None,
    profession: str | None = None,
    university: str | None = None,
    owner_user_id: int | None = None,
) -> bytes:
    """Generates a professional Excel workbook for bounced emails of a campaign."""
    report = get_campaign_bounced_mails(
        db=db,
        campaign_id=campaign_id,
        page=1,
        page_size=10000,
        search=search,
        bounce_type=bounce_type,
        country=country,
        profession=profession,
        university=university,
        owner_user_id=owner_user_id,
    )
    items = report["items"]

    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Bounced Mails"
    ws.views.sheetView[0].showGridLines = True

    headers = [
        "Recipient Name",
        "Email Address",
        "Bounce Type",
        "Bounce Reason / Error",
        "Bounced At (UTC)",
        "Dispatched At (UTC)",
        "Profession",
        "University",
        "Country",
    ]

    header_font = Font(name="Segoe UI", size=11, bold=True, color="FFFFFF")
    header_fill = PatternFill(start_color="1E293B", end_color="1E293B", fill_type="solid")
    header_align = Alignment(horizontal="center", vertical="center", wrap_text=True)

    thin_border_side = Side(style="thin", color="E2E8F0")
    thin_border = Border(
        left=thin_border_side,
        right=thin_border_side,
        top=thin_border_side,
        bottom=thin_border_side,
    )

    ws.row_dimensions[1].height = 28
    for col_idx, header in enumerate(headers, start=1):
        cell = ws.cell(row=1, column=col_idx, value=header)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = header_align
        cell.border = thin_border

    zebra_fill = PatternFill(start_color="F8FAFC", end_color="F8FAFC", fill_type="solid")
    data_font = Font(name="Segoe UI", size=10, color="0F172A")
    regular_align = Alignment(vertical="center")
    center_align = Alignment(horizontal="center", vertical="center")

    for row_idx, item in enumerate(items, start=2):
        ws.row_dimensions[row_idx].height = 22
        is_even = row_idx % 2 == 0
        fill = zebra_fill if is_even else None

        b_type_display = (item["bounce_type"] or "unknown").upper()

        row_values = [
            (sanitize_cell_value(item["recipient_name"]), regular_align),
            (sanitize_cell_value(item["email"]), regular_align),
            (b_type_display, center_align),
            (sanitize_cell_value(item["bounce_reason"] or "—"), regular_align),
            (sanitize_cell_value(item["bounced_at"] or "—"), center_align),
            (sanitize_cell_value(item["dispatch_attempt_at"] or "—"), center_align),
            (sanitize_cell_value(item["profession"] or "—"), regular_align),
            (sanitize_cell_value(item["university"] or "—"), regular_align),
            (sanitize_cell_value(item["country"] or "—"), center_align),
        ]

        for col_idx, (val, align) in enumerate(row_values, start=1):
            cell = ws.cell(row=row_idx, column=col_idx, value=val)
            cell.font = data_font
            cell.alignment = align
            cell.border = thin_border
            if fill:
                cell.fill = fill

    # Auto-width adjustments
    for col in ws.columns:
        col_letter = get_column_letter(col[0].column)
        max_len = 0
        for cell in col:
            val_str = str(cell.value or "")
            if len(val_str) > max_len:
                max_len = len(val_str)
        ws.column_dimensions[col_letter].width = max(max_len + 4, 14)

    bio = io.BytesIO()
    wb.save(bio)
    return bio.getvalue()

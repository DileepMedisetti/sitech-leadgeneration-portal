import hashlib
from datetime import datetime, timezone
from typing import Any
from sqlalchemy import asc, desc, func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.models.campaign import (
    Campaign,
    CampaignAudienceList,
    CampaignContent,
    CampaignRecipientSnapshot,
)
from app.models.contact_list import ContactList, ContactListMember
from app.models.lead import Lead


def compute_content_fingerprint(
    subject: str,
    preview_text: str | None,
    from_name: str,
    from_email: str,
    reply_to: str | None,
    html_content: str,
    plain_text: str | None,
) -> str:
    """Compute a deterministic SHA-256 fingerprint from canonical email content."""
    canonical = (
        f"subj:{subject.strip()}\n"
        f"prev:{(preview_text or '').strip()}\n"
        f"from_n:{from_name.strip()}\n"
        f"from_e:{from_email.strip().lower()}\n"
        f"reply:{(reply_to or '').strip().lower()}\n"
        f"html:{html_content.strip()}\n"
        f"text:{(plain_text or '').strip()}"
    )
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def create_campaign(
    db: Session,
    name: str,
    description: str | None = None,
    tags: list[str] | None = None,
) -> Campaign:
    campaign = Campaign(
        name=name.strip(),
        description=description.strip() if description else None,
        tags=tags or [],
        status="draft",
        current_content_version=1,
    )
    db.add(campaign)
    return campaign


def get_campaign_by_id(db: Session, campaign_id: int) -> Campaign | None:
    return db.get(Campaign, campaign_id)


def get_campaigns_paginated(
    db: Session,
    page: int = 1,
    page_size: int = 10,
    status: str | None = None,
    search: str | None = None,
    sort_by: str = "created_at",
    sort_order: str = "desc",
) -> tuple[list[Campaign], int, int]:
    query = select(Campaign).options(selectinload(Campaign.contents))

    if status and status != "all":
        if status == "inactive":
            query = query.where(Campaign.status.in_(["draft", "paused", "cancelled", "archived"]))
        elif status == "completed":
            query = query.where(Campaign.status == "sent")
        elif status == "scheduled":
            query = query.where(Campaign.status.in_(["scheduled", "sending"]))
        else:
            query = query.where(Campaign.status == status)

    if search and search.strip():
        term = f"%{search.strip().lower()}%"
        query = query.where(
            or_(
                func.lower(Campaign.name).like(term),
                func.lower(Campaign.description).like(term),
            )
        )

    # Count
    count_stmt = select(func.count()).select_from(query.subquery())
    total = db.scalar(count_stmt) or 0

    # Sorting
    sort_column = getattr(Campaign, sort_by, Campaign.created_at)
    order_func = desc if sort_order == "desc" else asc
    query = query.order_by(order_func(sort_column))

    # Pagination
    offset = max(0, (page - 1) * page_size)
    query = query.offset(offset).limit(page_size)

    items = list(db.scalars(query).all())
    for item in items:
        # Populate dynamic presentation attributes
        item.subject = item.contents[0].subject if item.contents else None
        item.open_rate = None  # Explicitly None when no verified open telemetry has been recorded

    total_pages = max(1, (total + page_size - 1) // page_size) if total > 0 else 1

    return items, total, total_pages


def get_campaign_status_counts(db: Session) -> dict[str, int]:
    """Calculate exact real counts for campaign tab filters."""
    rows = db.execute(select(Campaign.status, func.count(Campaign.id)).group_by(Campaign.status)).all()
    status_map = {row[0]: row[1] for row in rows}
    completed = status_map.get("sent", 0)
    scheduled = status_map.get("scheduled", 0) + status_map.get("sending", 0)
    inactive = (
        status_map.get("draft", 0)
        + status_map.get("paused", 0)
        + status_map.get("cancelled", 0)
        + status_map.get("archived", 0)
    )
    all_count = sum(status_map.values())
    return {
        "all": all_count,
        "completed": completed,
        "scheduled": scheduled,
        "inactive": inactive,
    }


def save_campaign_content(
    db: Session,
    campaign_id: int,
    subject: str,
    preview_text: str | None,
    from_name: str,
    from_email: str,
    reply_to: str | None,
    html_content: str,
    plain_text: str | None,
    editor_mode: str = "html_editor",
    template_id: str | None = None,
) -> CampaignContent:
    campaign = db.get(Campaign, campaign_id)
    if not campaign:
        raise ValueError(f"Campaign {campaign_id} not found.")

    fingerprint = compute_content_fingerprint(
        subject=subject,
        preview_text=preview_text,
        from_name=from_name,
        from_email=from_email,
        reply_to=reply_to,
        html_content=html_content,
        plain_text=plain_text,
    )

    # Check latest version
    latest = get_latest_campaign_content(db, campaign_id)

    if latest:
        # If content hasn't changed at all, return existing
        if latest.content_fingerprint == fingerprint:
            return latest

        # If campaign is still a draft and has no external placement tests / reports, we can increment version
        new_version = latest.version + 1
    else:
        new_version = 1

    content = CampaignContent(
        campaign_id=campaign_id,
        version=new_version,
        content_fingerprint=fingerprint,
        editor_mode=editor_mode,
        template_id=template_id,
        subject=subject,
        preview_text=preview_text,
        from_name=from_name,
        from_email=from_email,
        reply_to=reply_to,
        html_content=html_content,
        plain_text=plain_text,
    )
    db.add(content)
    campaign.current_content_version = new_version
    return content


def get_latest_campaign_content(db: Session, campaign_id: int) -> CampaignContent | None:
    stmt = (
        select(CampaignContent)
        .where(CampaignContent.campaign_id == campaign_id)
        .order_by(CampaignContent.version.desc())
        .limit(1)
    )
    return db.scalar(stmt)


def get_campaign_content_by_version(
    db: Session, campaign_id: int, version: int
) -> CampaignContent | None:
    stmt = select(CampaignContent).where(
        CampaignContent.campaign_id == campaign_id,
        CampaignContent.version == version,
    )
    return db.scalar(stmt)


def set_campaign_audience_lists(
    db: Session,
    campaign_id: int,
    contact_list_ids: list[int],
) -> list[CampaignAudienceList]:
    campaign = db.get(Campaign, campaign_id)
    if not campaign:
        raise ValueError(f"Campaign {campaign_id} not found.")

    # Remove existing associations
    delete_stmt = select(CampaignAudienceList).where(CampaignAudienceList.campaign_id == campaign_id)
    for row in db.scalars(delete_stmt).all():
        db.delete(row)
    db.flush()

    unique_list_ids = list(dict.fromkeys(contact_list_ids))
    audience_lists = []
    for lid in unique_list_ids:
        # Verify list exists
        clist = db.get(ContactList, lid)
        if not clist:
            raise ValueError(f"Contact list with ID {lid} does not exist.")
        al = CampaignAudienceList(campaign_id=campaign_id, contact_list_id=lid)
        db.add(al)
        audience_lists.append(al)

    return audience_lists


def get_campaign_audience_lists(db: Session, campaign_id: int) -> list[ContactList]:
    stmt = (
        select(ContactList)
        .join(CampaignAudienceList, CampaignAudienceList.contact_list_id == ContactList.id)
        .where(CampaignAudienceList.campaign_id == campaign_id)
    )
    return list(db.scalars(stmt).all())


def snapshot_campaign_recipients(
    db: Session,
    campaign_id: int,
) -> tuple[int, int]:
    """Snapshots unique, eligible contacts from the selected audience lists into campaign_recipient_snapshots.

    Returns (total_unique_recipients, added_count).
    """
    from app.services.audience_service import is_lead_eligible_contact

    campaign = db.get(Campaign, campaign_id)
    if not campaign:
        raise ValueError(f"Campaign {campaign_id} not found.")

    # Clear prior snapshot for draft campaigns to allow re-selection
    existing_snapshots = list(
        db.scalars(
            select(CampaignRecipientSnapshot).where(
                CampaignRecipientSnapshot.campaign_id == campaign_id
            )
        ).all()
    )
    for snap in existing_snapshots:
        db.delete(snap)
    db.flush()

    # Get selected lists
    selected_lists = get_campaign_audience_lists(db, campaign_id)
    if not selected_lists:
        campaign.total_recipients = 0
        db.flush()
        return 0, 0

    list_ids = [l.id for l in selected_lists]

    # Query all members of selected lists with joined lead data
    members_stmt = (
        select(ContactListMember, Lead)
        .join(Lead, ContactListMember.lead_id == Lead.id)
        .where(ContactListMember.list_id.in_(list_ids))
    )
    rows = db.execute(members_stmt).all()

    seen_emails: set[str] = set()
    added_count = 0

    for member, lead in rows:
        email = (member.normalized_email or lead.email or "").strip().lower()
        if not email or email in seen_emails:
            continue

        if not is_lead_eligible_contact(lead):
            continue

        seen_emails.add(email)
        snapshot = CampaignRecipientSnapshot(
            campaign_id=campaign_id,
            lead_id=lead.id,
            normalized_email=email,
            name=lead.name,
            status="pending",
        )
        db.add(snapshot)
        added_count += 1

    campaign.total_recipients = added_count
    db.flush()
    return len(seen_emails), added_count

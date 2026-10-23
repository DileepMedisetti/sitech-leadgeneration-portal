from datetime import datetime, timezone
from typing import Any
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.campaign import Campaign, CampaignAudienceList, CampaignContent, CampaignRecipientSnapshot
from app.models.contact_list import ContactList, ContactListMember
from app.models.lead import Lead
from app.repositories.campaign_repository import (
    create_campaign as repo_create_campaign,
    get_campaign_by_id,
    get_campaigns_paginated,
    get_latest_campaign_content,
    get_campaign_audience_lists,
    save_campaign_content,
    set_campaign_audience_lists,
    snapshot_campaign_recipients,
)
from app.schemas.campaign import (
    CampaignAudienceSummaryResponse,
    CampaignCreate,
    CampaignDetailResponse,
    CampaignResponse,
    CampaignUpdate,
)
from app.services.audience_service import is_lead_eligible_contact


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def create_new_campaign(db: Session, data: CampaignCreate) -> Campaign:
    """Create a new campaign with optional initial content and audience lists."""
    name = data.name.strip()
    if not name:
        raise ValueError("Campaign name cannot be empty.")

    campaign = repo_create_campaign(
        db=db,
        name=name,
        description=data.description,
        tags=data.tags,
    )
    db.flush()

    if data.content:
        save_campaign_content(
            db=db,
            campaign_id=campaign.id,
            subject=data.content.subject,
            preview_text=data.content.preview_text,
            from_name=data.content.from_name,
            from_email=data.content.from_email,
            reply_to=data.content.reply_to,
            html_content=data.content.html_content,
            plain_text=data.content.plain_text,
            editor_mode=data.content.editor_mode,
            template_id=data.content.template_id,
        )

    if data.contact_list_ids:
        set_campaign_audience_lists(db, campaign.id, data.contact_list_ids)
        snapshot_campaign_recipients(db, campaign.id)

    db.flush()
    return campaign


def update_campaign_details(
    db: Session, campaign_id: int, data: CampaignUpdate
) -> Campaign:
    campaign = get_campaign_by_id(db, campaign_id)
    if not campaign:
        raise ValueError(f"Campaign {campaign_id} not found.")

    if campaign.status in {"sending", "sent", "archived"}:
        raise ValueError(f"Cannot edit campaign in '{campaign.status}' status.")

    if data.name is not None:
        name = data.name.strip()
        if not name:
            raise ValueError("Campaign name cannot be empty.")
        campaign.name = name

    if data.description is not None:
        campaign.description = data.description.strip() if data.description else None

    if data.tags is not None:
        campaign.tags = data.tags

    if data.content is not None:
        save_campaign_content(
            db=db,
            campaign_id=campaign.id,
            subject=data.content.subject,
            preview_text=data.content.preview_text,
            from_name=data.content.from_name,
            from_email=data.content.from_email,
            reply_to=data.content.reply_to,
            html_content=data.content.html_content,
            plain_text=data.content.plain_text,
            editor_mode=data.content.editor_mode,
            template_id=data.content.template_id,
        )

    if data.contact_list_ids is not None:
        set_campaign_audience_lists(db, campaign.id, data.contact_list_ids)
        snapshot_campaign_recipients(db, campaign.id)

    db.flush()
    return campaign


def list_campaigns(
    db: Session,
    page: int = 1,
    page_size: int = 10,
    status: str | None = None,
    search: str | None = None,
    sort_by: str = "created_at",
    sort_order: str = "desc",
) -> tuple[list[Campaign], int, int]:
    return get_campaigns_paginated(
        db=db,
        page=page,
        page_size=page_size,
        status=status,
        search=search,
        sort_by=sort_by,
        sort_order=sort_order,
    )


def get_campaign_audience_summary(
    db: Session, campaign_id: int
) -> CampaignAudienceSummaryResponse:
    campaign = get_campaign_by_id(db, campaign_id)
    if not campaign:
        raise ValueError(f"Campaign {campaign_id} not found.")

    selected_lists = get_campaign_audience_lists(db, campaign_id)
    list_ids = [l.id for l in selected_lists]
    list_names = [l.name for l in selected_lists]

    if not list_ids:
        return CampaignAudienceSummaryResponse(
            campaign_id=campaign_id,
            selected_list_ids=[],
            selected_list_names=[],
            total_raw_contacts=0,
            unique_contacts=0,
            eligible_contacts=0,
            suppressed_or_invalid_contacts=0,
            is_ready_for_dispatch=False,
        )

    members_stmt = (
        select(ContactListMember, Lead)
        .join(Lead, ContactListMember.lead_id == Lead.id)
        .where(ContactListMember.list_id.in_(list_ids))
    )
    rows = db.execute(members_stmt).all()

    total_raw = len(rows)
    seen_unique: set[str] = set()
    eligible_count = 0
    ineligible_count = 0

    for member, lead in rows:
        email = (member.normalized_email or lead.email or "").strip().lower()
        if not email or email in seen_unique:
            continue
        seen_unique.add(email)

        if is_lead_eligible_contact(lead):
            eligible_count += 1
        else:
            ineligible_count += 1

    return CampaignAudienceSummaryResponse(
        campaign_id=campaign_id,
        selected_list_ids=list_ids,
        selected_list_names=list_names,
        total_raw_contacts=total_raw,
        unique_contacts=len(seen_unique),
        eligible_contacts=eligible_count,
        suppressed_or_invalid_contacts=ineligible_count,
        is_ready_for_dispatch=eligible_count > 0,
    )


def transition_campaign_status(
    db: Session, campaign_id: int, target_status: str
) -> Campaign:
    """Safely transitions campaign lifecycle status."""
    campaign = get_campaign_by_id(db, campaign_id)
    if not campaign:
        raise ValueError(f"Campaign {campaign_id} not found.")

    current = campaign.status
    allowed_transitions = {
        "draft": {"scheduled", "sending", "archived"},
        "scheduled": {"draft", "sending", "paused", "cancelled"},
        "sending": {"sent", "paused", "failed"},
        "paused": {"sending", "scheduled", "cancelled", "draft"},
        "sent": {"archived"},
        "failed": {"draft", "scheduled", "archived"},
        "cancelled": {"draft", "archived"},
        "archived": set(),
    }

    if target_status not in allowed_transitions.get(current, set()):
        raise ValueError(
            f"Invalid status transition from '{current}' to '{target_status}'."
        )

    campaign.status = target_status
    if target_status == "sent":
        campaign.sent_at = _utc_now()
    db.flush()
    return campaign


def delete_campaign(db: Session, campaign_id: int) -> bool:
    campaign = get_campaign_by_id(db, campaign_id)
    if not campaign:
        return False
    if campaign.status in {"sending"}:
        raise ValueError("Cannot delete a campaign that is actively sending.")
    db.delete(campaign)
    return True

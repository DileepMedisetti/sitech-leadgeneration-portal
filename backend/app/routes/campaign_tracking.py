from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from fastapi.responses import Response
from sqlalchemy.orm import Session

from app.api.dependencies.current_user import get_optional_current_user
from app.db.database import get_db
from app.models.campaign import Campaign
from app.models.user import User
from app.schemas.campaign_tracking import (
    BouncedMailsResponse,
    BouncedMailsSummary,
    CampaignTrackingDetailSummary,
    CompletedCampaignsListResponse,
    DeleteBouncesResponse,
    OpenedRecipientsResponse,
)
from app.services.campaign_tracking_service import (
    delete_all_bounced_mails,
    delete_single_bounced_mail,
    generate_bounced_mails_excel,
    generate_opened_recipients_excel,
    get_campaign_bounced_mails,
    get_campaign_opened_recipients,
    get_campaign_tracking_detail_summary,
    get_completed_campaigns_overview,
)

router = APIRouter(prefix="/api/campaign-tracking", tags=["Campaign Tracking"])


def _verify_campaign_access(campaign: Campaign, current_user: User | None) -> None:
    if current_user and campaign.owner_user_id is not None and campaign.owner_user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: You do not have permission to view or manage this campaign.",
        )


@router.get("/campaigns", response_model=CompletedCampaignsListResponse)
def list_completed_campaigns_endpoint(
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(10, ge=1, le=100, description="Items per page"),
    search: str | None = Query(None, description="Search by campaign name"),
    status: str | None = Query(None, description="Filter by status: sent, completed, all"),
    start_date: str | None = Query(None, description="Start date filter (ISO format)"),
    end_date: str | None = Query(None, description="End date filter (ISO format)"),
    current_user: User | None = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve completed/sent campaigns with top-level aggregated overview analytics."""
    owner_id = current_user.id if current_user else None
    result = get_completed_campaigns_overview(
        db=db,
        page=page,
        page_size=page_size,
        search=search,
        status_filter=status,
        start_date=start_date,
        end_date=end_date,
        owner_user_id=owner_id,
    )
    return result


@router.get("/campaigns/{campaign_id}/summary", response_model=CampaignTrackingDetailSummary)
def get_campaign_tracking_summary_endpoint(
    campaign_id: int,
    current_user: User | None = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve detailed metrics for a single campaign including immutable historical bounce rates."""
    campaign = db.get(Campaign, campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail=f"Campaign {campaign_id} not found.")

    _verify_campaign_access(campaign, current_user)
    owner_id = current_user.id if current_user else None

    try:
        return get_campaign_tracking_detail_summary(db=db, campaign_id=campaign_id, owner_user_id=owner_id)
    except PermissionError as pe:
        raise HTTPException(status_code=403, detail=str(pe))
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))


@router.get("/campaigns/{campaign_id}/opened-recipients", response_model=OpenedRecipientsResponse)
def get_opened_recipients_endpoint(
    campaign_id: int,
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    search: str | None = Query(None, description="Search recipient name or email"),
    country: str | None = Query(None, description="Filter by country"),
    profession: str | None = Query(None, description="Filter by profession"),
    university: str | None = Query(None, description="Filter by university"),
    sort_by: str | None = Query("opened_at", description="Sort field: opened_at, name, email, open_count, click_count"),
    sort_order: str | None = Query("desc", description="Sort order: asc, desc"),
    current_user: User | None = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve paginated recipients who opened emails for the specified campaign."""
    campaign = db.get(Campaign, campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail=f"Campaign {campaign_id} not found.")

    _verify_campaign_access(campaign, current_user)
    owner_id = current_user.id if current_user else None

    return get_campaign_opened_recipients(
        db=db,
        campaign_id=campaign_id,
        page=page,
        page_size=page_size,
        search=search,
        country=country,
        profession=profession,
        university=university,
        sort_by=sort_by,
        sort_order=sort_order,
        owner_user_id=owner_id,
    )


@router.get("/campaigns/{campaign_id}/opened-recipients/export")
def export_opened_recipients_endpoint(
    campaign_id: int,
    search: str | None = Query(None),
    country: str | None = Query(None),
    profession: str | None = Query(None),
    university: str | None = Query(None),
    current_user: User | None = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
):
    """Download an Excel (.xlsx) file containing opened email recipients."""
    campaign = db.get(Campaign, campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail=f"Campaign {campaign_id} not found.")

    _verify_campaign_access(campaign, current_user)
    owner_id = current_user.id if current_user else None

    excel_bytes = generate_opened_recipients_excel(
        db=db,
        campaign_id=campaign_id,
        search=search,
        country=country,
        profession=profession,
        university=university,
        owner_user_id=owner_id,
    )

    now_tag = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    clean_name = "".join(c for c in campaign.name if c.isalnum() or c in (" ", "_", "-")).strip().replace(" ", "_")
    filename = f"Campaign_{campaign_id}_{clean_name}_Opened_Recipients_{now_tag}.xlsx"

    return Response(
        content=excel_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/campaigns/{campaign_id}/bounces", response_model=BouncedMailsResponse)
def get_bounced_mails_endpoint(
    campaign_id: int,
    page: int = Query(1, ge=1, description="Page number"),
    page_size: int = Query(20, ge=1, le=100, description="Items per page"),
    search: str | None = Query(None, description="Search email, name, or bounce reason"),
    bounce_type: str | None = Query(None, description="Filter: hard, soft, unknown, all"),
    country: str | None = Query(None, description="Filter by country"),
    profession: str | None = Query(None, description="Filter by profession"),
    university: str | None = Query(None, description="Filter by university"),
    start_date: str | None = Query(None, description="Filter start date"),
    end_date: str | None = Query(None, description="Filter end date"),
    current_user: User | None = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve active bounced emails with authoritative historical bounce rate and summary."""
    campaign = db.get(Campaign, campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail=f"Campaign {campaign_id} not found.")

    _verify_campaign_access(campaign, current_user)
    owner_id = current_user.id if current_user else None

    return get_campaign_bounced_mails(
        db=db,
        campaign_id=campaign_id,
        page=page,
        page_size=page_size,
        search=search,
        bounce_type=bounce_type,
        country=country,
        profession=profession,
        university=university,
        start_date=start_date,
        end_date=end_date,
        owner_user_id=owner_id,
    )


@router.get("/campaigns/{campaign_id}/bounces/export")
def export_bounced_mails_endpoint(
    campaign_id: int,
    search: str | None = Query(None),
    bounce_type: str | None = Query(None),
    country: str | None = Query(None),
    profession: str | None = Query(None),
    university: str | None = Query(None),
    current_user: User | None = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
):
    """Download an Excel (.xlsx) file containing bounced email records."""
    campaign = db.get(Campaign, campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail=f"Campaign {campaign_id} not found.")

    _verify_campaign_access(campaign, current_user)
    owner_id = current_user.id if current_user else None

    excel_bytes = generate_bounced_mails_excel(
        db=db,
        campaign_id=campaign_id,
        search=search,
        bounce_type=bounce_type,
        country=country,
        profession=profession,
        university=university,
        owner_user_id=owner_id,
    )

    now_tag = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
    clean_name = "".join(c for c in campaign.name if c.isalnum() or c in (" ", "_", "-")).strip().replace(" ", "_")
    filename = f"Campaign_{campaign_id}_{clean_name}_Bounced_Mails_{now_tag}.xlsx"

    return Response(
        content=excel_bytes,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.delete("/campaigns/{campaign_id}/bounces/{record_id}", response_model=DeleteBouncesResponse)
def delete_single_bounced_mail_endpoint(
    campaign_id: int,
    record_id: int,
    current_user: User | None = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
):
    """Remove a single bounced mail record from the active listing.

    CRITICAL INVARIANT: Does NOT alter or reduce the historical bounce count or historical bounce rate!
    """
    campaign = db.get(Campaign, campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail=f"Campaign {campaign_id} not found.")

    _verify_campaign_access(campaign, current_user)
    owner_id = current_user.id if current_user else None

    try:
        return delete_single_bounced_mail(
            db=db,
            campaign_id=campaign_id,
            record_id=record_id,
            owner_user_id=owner_id,
        )
    except ValueError as ve:
        raise HTTPException(status_code=404, detail=str(ve))


@router.delete("/campaigns/{campaign_id}/bounces", response_model=DeleteBouncesResponse)
def delete_all_bounced_mails_endpoint(
    campaign_id: int,
    bounce_type: str | None = Query(None, description="Optional bounce type to selectively clear"),
    current_user: User | None = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
):
    """Remove active bounced mail records from the listing.

    CRITICAL INVARIANT: Does NOT alter or reduce the campaign's authoritative historical bounce metrics!
    """
    campaign = db.get(Campaign, campaign_id)
    if not campaign:
        raise HTTPException(status_code=404, detail=f"Campaign {campaign_id} not found.")

    _verify_campaign_access(campaign, current_user)
    owner_id = current_user.id if current_user else None

    return delete_all_bounced_mails(
        db=db,
        campaign_id=campaign_id,
        bounce_type=bounce_type,
        owner_user_id=owner_id,
    )


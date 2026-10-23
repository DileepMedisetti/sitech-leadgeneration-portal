from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.repositories.campaign_repository import (
    get_campaign_by_id,
    get_campaign_status_counts,
    get_latest_campaign_content,
    set_campaign_audience_lists,
    snapshot_campaign_recipients,
)
from app.schemas.campaign import (
    CampaignAudienceSelectRequest,
    CampaignAudienceSummaryResponse,
    CampaignConfirmSendRequest,
    CampaignContentResponse,
    CampaignCreate,
    CampaignDetailResponse,
    CampaignLaunchRequest,
    CampaignPreflightResponse,
    CampaignResponse,
    CampaignScheduleRequest,
    CampaignUpdate,
    PaginatedCampaignsResponse,
)
from app.services.campaign_gate_service import (
    evaluate_campaign_preflight,
    execute_campaign_dispatch_or_schedule,
)
from app.services.campaign_service import (
    create_new_campaign,
    delete_campaign,
    get_campaign_audience_summary,
    list_campaigns,
    transition_campaign_status,
    update_campaign_details,
)
from app.services.deliverability.analyzer_service import get_latest_campaign_report
from app.services.ml.inference_service import predict_campaign_placement
from app.services.placement.placement_service import get_latest_placement_test

router = APIRouter(prefix="/api/campaigns", tags=["Campaigns"])


@router.get("", response_model=PaginatedCampaignsResponse)
def get_campaigns_endpoint(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=100),
    status: str | None = Query(default=None),
    search: str | None = Query(default=None),
    sort_by: str = Query(default="created_at"),
    sort_order: str = Query(default="desc", pattern="^(asc|desc)$"),
    db: Session = Depends(get_db),
):
    """Retrieve paginated campaigns with optional filtering by status and title search."""
    items, total, total_pages = list_campaigns(
        db=db,
        page=page,
        page_size=page_size,
        status=status,
        search=search,
        sort_by=sort_by,
        sort_order=sort_order,
    )
    counts = get_campaign_status_counts(db)
    return {
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
        "items": items,
        "counts": counts,
    }


@router.post("", response_model=CampaignResponse, status_code=status.HTTP_201_CREATED)
def create_campaign_endpoint(
    payload: CampaignCreate,
    db: Session = Depends(get_db),
):
    """Create a new campaign draft, optionally with initial content and audience lists."""
    try:
        campaign = create_new_campaign(db, payload)
        db.commit()
        db.refresh(campaign)
        return campaign
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Database error creating campaign.") from exc


@router.get("/{campaign_id}", response_model=CampaignDetailResponse)
def get_campaign_detail_endpoint(
    campaign_id: int,
    db: Session = Depends(get_db),
):
    """Retrieve full campaign workspace details, content snapshot, and deliverability metrics."""
    campaign = get_campaign_by_id(db, campaign_id)
    if not campaign:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Campaign {campaign_id} not found.")

    content = get_latest_campaign_content(db, campaign_id)
    audience = get_campaign_audience_summary(db, campaign_id)
    report = get_latest_campaign_report(db, campaign_id)
    placement = get_latest_placement_test(db, campaign_id)
    prediction = predict_campaign_placement(db, campaign_id) if content else None

    content_data = CampaignContentResponse.model_validate(content) if content else None

    return CampaignDetailResponse(
        id=campaign.id,
        name=campaign.name,
        description=campaign.description,
        status=campaign.status,  # type: ignore
        tags=campaign.tags,
        current_content_version=campaign.current_content_version,
        total_recipients=campaign.total_recipients,
        sent_count=campaign.sent_count,
        delivered_count=campaign.delivered_count,
        bounced_count=campaign.bounced_count,
        unsubscribed_count=campaign.unsubscribed_count,
        scheduled_at=campaign.scheduled_at,
        sent_at=campaign.sent_at,
        created_at=campaign.created_at,
        updated_at=campaign.updated_at,
        content=content_data,
        audience=audience,
        latest_deliverability_report=report,
        latest_placement_test=placement,
        latest_ml_prediction=prediction,
    )


@router.patch("/{campaign_id}", response_model=CampaignResponse)
def update_campaign_endpoint(
    campaign_id: int,
    payload: CampaignUpdate,
    db: Session = Depends(get_db),
):
    """Update campaign metadata, content draft, or audience lists."""
    try:
        campaign = update_campaign_details(db, campaign_id, payload)
        db.commit()
        db.refresh(campaign)
        return campaign
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Database error updating campaign.") from exc


@router.delete("/{campaign_id}")
def delete_campaign_endpoint(
    campaign_id: int,
    db: Session = Depends(get_db),
):
    """Delete a campaign or draft without altering contact records."""
    try:
        deleted = delete_campaign(db, campaign_id)
        if not deleted:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Campaign {campaign_id} not found.")
        db.commit()
        return {"status": "success", "message": f"Campaign {campaign_id} deleted successfully."}
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Database error deleting campaign.") from exc


@router.get("/{campaign_id}/audience", response_model=CampaignAudienceSummaryResponse)
def get_campaign_audience_endpoint(
    campaign_id: int,
    db: Session = Depends(get_db),
):
    """Retrieve audience summary, breakdown of raw vs unique vs eligible contacts."""
    try:
        return get_campaign_audience_summary(db, campaign_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.post("/{campaign_id}/audience", response_model=CampaignAudienceSummaryResponse)
def select_campaign_audience_endpoint(
    campaign_id: int,
    payload: CampaignAudienceSelectRequest,
    db: Session = Depends(get_db),
):
    """Assign contact lists to the campaign and generate recipient snapshot."""
    try:
        set_campaign_audience_lists(db, campaign_id, payload.contact_list_ids)
        snapshot_campaign_recipients(db, campaign_id)
        db.commit()
        return get_campaign_audience_summary(db, campaign_id)
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Database error assigning audience.") from exc


@router.get("/{campaign_id}/preflight", response_model=CampaignPreflightResponse)
def get_campaign_preflight_endpoint(
    campaign_id: int,
    db: Session = Depends(get_db),
):
    """Evaluate pre-launch readiness, rule report status, and identify blockers."""
    try:
        return evaluate_campaign_preflight(db, campaign_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.post("/{campaign_id}/launch", response_model=CampaignResponse)
def launch_or_schedule_campaign_endpoint(
    campaign_id: int,
    payload: CampaignLaunchRequest,
    db: Session = Depends(get_db),
):
    """Schedule or immediately dispatch a campaign with explicit user confirmation."""
    try:
        schedule = CampaignScheduleRequest(
            send_immediately=payload.send_immediately,
            scheduled_at=payload.scheduled_at,
            timezone_name=payload.timezone_name,
        )
        confirm = CampaignConfirmSendRequest(
            confirmed=payload.confirmed,
            bypass_warnings=payload.bypass_warnings,
        )
        campaign = execute_campaign_dispatch_or_schedule(
            db=db,
            campaign_id=campaign_id,
            schedule_payload=schedule,
            confirm_payload=confirm,
        )
        db.commit()
        db.refresh(campaign)
        return campaign
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Database error launching campaign.") from exc


@router.post("/{campaign_id}/pause", response_model=CampaignResponse)
def pause_campaign_endpoint(
    campaign_id: int,
    db: Session = Depends(get_db),
):
    try:
        campaign = transition_campaign_status(db, campaign_id, "paused")
        db.commit()
        db.refresh(campaign)
        return campaign
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/{campaign_id}/resume", response_model=CampaignResponse)
def resume_campaign_endpoint(
    campaign_id: int,
    db: Session = Depends(get_db),
):
    try:
        campaign = transition_campaign_status(db, campaign_id, "scheduled")
        db.commit()
        db.refresh(campaign)
        return campaign
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/{campaign_id}/cancel", response_model=CampaignResponse)
def cancel_campaign_endpoint(
    campaign_id: int,
    db: Session = Depends(get_db),
):
    try:
        campaign = transition_campaign_status(db, campaign_id, "cancelled")
        db.commit()
        db.refresh(campaign)
        return campaign
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc

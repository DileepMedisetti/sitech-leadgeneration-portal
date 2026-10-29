from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from fastapi.responses import HTMLResponse, RedirectResponse
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from app.api.dependencies.current_user import get_current_user, get_optional_current_user
from app.db.database import get_db
from app.models.campaign import Campaign
from app.models.user import User
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
from app.schemas.email_account import SenderIdentityResponse
from app.services.campaign_gate_service import (
    evaluate_campaign_preflight,
    execute_campaign_dispatch_or_schedule,
    process_due_scheduled_campaigns,
)
from app.services.campaign_service import (
    create_new_campaign,
    delete_campaign,
    get_campaign_audience_summary,
    list_campaigns,
    transition_campaign_status,
    update_campaign_details,
)
from app.services.campaign_tracking_service import (
    export_recipients_csv,
    get_campaign_recipients_report,
    get_campaign_replies,
    get_campaign_report,
    handle_campaign_unsubscribe,
    ingest_inbound_reply,
    record_click_event,
    record_open_event,
)
from app.services.deliverability.analyzer_service import get_latest_campaign_report
from app.services.email_account_service import ensure_primary_email_account
from app.services.ml.inference_service import predict_campaign_placement
from app.services.placement.placement_service import get_latest_placement_test
from app.services.sender_eligibility_service import get_eligible_sender_accounts

router = APIRouter(prefix="/api/campaigns", tags=["Campaigns"])


def _check_campaign_ownership(campaign: Campaign, current_user: User) -> None:
    """Enforces tenant ownership. Non-owners are denied access."""
    if (
        campaign.owner_user_id is not None
        and campaign.owner_user_id != current_user.id
    ):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: You do not have permission to access this campaign.",
        )


@router.get("/sender-identities", response_model=list[SenderIdentityResponse])
def get_campaign_sender_identities_endpoint(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve eligible verified sender email accounts for campaign outreach."""
    ensure_primary_email_account(db, current_user)
    db.commit()
    senders = get_eligible_sender_accounts(db, current_user.id)
    return [
        SenderIdentityResponse(
            id=s.id,
            email=s.email_address,
            name=s.from_name,
            verified=s.verification_status == "verified",
            provider_status=s.provider_status,
            is_eligible=True,
            receiver_name=s.receiver_name,
            receiver_email=s.receiver_email,
            reply_to=s.reply_to,
        )
        for s in senders
    ]


@router.get("", response_model=PaginatedCampaignsResponse)
def get_campaigns_endpoint(
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=100),
    status: str | None = Query(default=None),
    search: str | None = Query(default=None),
    sort_by: str = Query(default="created_at"),
    sort_order: str = Query(default="desc", pattern="^(asc|desc)$"),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve paginated campaigns filtered by authenticated user workspace."""
    items, total, total_pages = list_campaigns(
        db=db,
        page=page,
        page_size=page_size,
        status=status,
        search=search,
        sort_by=sort_by,
        sort_order=sort_order,
        owner_user_id=current_user.id,
    )
    counts = get_campaign_status_counts(db, owner_user_id=current_user.id)
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
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Create a new campaign draft owned by the authenticated user."""
    try:
        campaign = create_new_campaign(db, payload, owner_user_id=current_user.id)
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
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve full campaign workspace details, content snapshot, and deliverability metrics."""
    campaign = get_campaign_by_id(db, campaign_id)
    if not campaign:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Campaign {campaign_id} not found.")

    _check_campaign_ownership(campaign, current_user)

    content = get_latest_campaign_content(db, campaign_id)
    audience = get_campaign_audience_summary(db, campaign_id, owner_user_id=current_user.id)
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
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update campaign metadata, content draft, or audience lists."""
    try:
        campaign = update_campaign_details(db, campaign_id, payload, owner_user_id=current_user.id)
        db.commit()
        db.refresh(campaign)
        return campaign
    except PermissionError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Database error updating campaign.") from exc


@router.delete("/{campaign_id}")
def delete_campaign_endpoint(
    campaign_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Delete a campaign or draft without altering contact records."""
    try:
        deleted = delete_campaign(db, campaign_id, owner_user_id=current_user.id)
        if not deleted:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Campaign {campaign_id} not found.")
        db.commit()
        return {"status": "success", "message": f"Campaign {campaign_id} deleted successfully."}
    except PermissionError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Database error deleting campaign.") from exc


@router.get("/{campaign_id}/audience", response_model=CampaignAudienceSummaryResponse)
def get_campaign_audience_endpoint(
    campaign_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve audience summary, breakdown of raw vs unique vs eligible contacts."""
    try:
        return get_campaign_audience_summary(db, campaign_id, owner_user_id=current_user.id)
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.post("/{campaign_id}/audience", response_model=CampaignAudienceSummaryResponse)
def select_campaign_audience_endpoint(
    campaign_id: int,
    payload: CampaignAudienceSelectRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Assign contact lists to the campaign and generate recipient snapshot."""
    campaign = get_campaign_by_id(db, campaign_id)
    if not campaign:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Campaign {campaign_id} not found.")
    _check_campaign_ownership(campaign, current_user)

    try:
        set_campaign_audience_lists(db, campaign_id, payload.contact_list_ids)
        snapshot_campaign_recipients(db, campaign_id)
        db.commit()
        return get_campaign_audience_summary(db, campaign_id, owner_user_id=current_user.id)
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Database error assigning audience.") from exc


@router.get("/{campaign_id}/preflight", response_model=CampaignPreflightResponse)
def get_campaign_preflight_endpoint(
    campaign_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Evaluate pre-launch readiness, rule report status, and identify blockers."""
    campaign = get_campaign_by_id(db, campaign_id)
    if not campaign:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Campaign {campaign_id} not found.")
    _check_campaign_ownership(campaign, current_user)

    try:
        return evaluate_campaign_preflight(db, campaign_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.post("/{campaign_id}/launch", response_model=CampaignResponse)
def launch_or_schedule_campaign_endpoint(
    campaign_id: int,
    payload: CampaignLaunchRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Schedule or immediately dispatch a campaign with explicit user confirmation."""
    campaign = get_campaign_by_id(db, campaign_id)
    if not campaign:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Campaign {campaign_id} not found.")
    _check_campaign_ownership(campaign, current_user)

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
        dispatched_campaign = execute_campaign_dispatch_or_schedule(
            db=db,
            campaign_id=campaign_id,
            schedule_payload=schedule,
            confirm_payload=confirm,
        )
        db.commit()
        db.refresh(dispatched_campaign)
        return dispatched_campaign
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Database error launching campaign.") from exc


@router.post("/{campaign_id}/pause", response_model=CampaignResponse)
def pause_campaign_endpoint(
    campaign_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        campaign = transition_campaign_status(db, campaign_id, "paused", owner_user_id=current_user.id)
        db.commit()
        db.refresh(campaign)
        return campaign
    except PermissionError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/{campaign_id}/resume", response_model=CampaignResponse)
def resume_campaign_endpoint(
    campaign_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        campaign = transition_campaign_status(db, campaign_id, "scheduled", owner_user_id=current_user.id)
        db.commit()
        db.refresh(campaign)
        return campaign
    except PermissionError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/{campaign_id}/cancel", response_model=CampaignResponse)
def cancel_campaign_endpoint(
    campaign_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    try:
        campaign = transition_campaign_status(db, campaign_id, "cancelled", owner_user_id=current_user.id)
        db.commit()
        db.refresh(campaign)
        return campaign
    except PermissionError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


# ==============================================================================
# Campaign Analytics, Event Tracking, Inbound Replies, and Unsubscribe
# ==============================================================================

@router.get("/{campaign_id}/report")
def get_campaign_report_endpoint(
    campaign_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve genuine aggregated campaign execution and deliverability report metrics."""
    campaign = get_campaign_by_id(db, campaign_id)
    if not campaign:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Campaign {campaign_id} not found.")
    _check_campaign_ownership(campaign, current_user)

    try:
        return get_campaign_report(db, campaign_id)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.get("/{campaign_id}/report/recipients")
def get_campaign_recipients_report_endpoint(
    campaign_id: int,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=20, ge=1, le=100),
    search: str | None = Query(default=None),
    status: str | None = Query(default=None),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve paginated recipient-level delivery, open, click, bounce, and reply statuses."""
    campaign = get_campaign_by_id(db, campaign_id)
    if not campaign:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Campaign {campaign_id} not found.")
    _check_campaign_ownership(campaign, current_user)

    return get_campaign_recipients_report(
        db=db,
        campaign_id=campaign_id,
        page=page,
        page_size=page_size,
        search=search,
        status_filter=status,
    )


@router.get("/{campaign_id}/report/export")
def export_campaign_recipients_csv_endpoint(
    campaign_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Export recipient engagement report to a CSV spreadsheet."""
    campaign = get_campaign_by_id(db, campaign_id)
    if not campaign:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Campaign {campaign_id} not found.")
    _check_campaign_ownership(campaign, current_user)

    csv_content = export_recipients_csv(db, campaign_id)
    return Response(
        content=csv_content,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="campaign_{campaign_id}_report.csv"'},
    )


@router.get("/{campaign_id}/replies")
def get_campaign_replies_endpoint(
    campaign_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve all inbound email replies matched and persisted for this campaign."""
    try:
        return get_campaign_replies(db, campaign_id, owner_user_id=current_user.id)
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.post("/process-scheduled")
def process_scheduled_campaigns_endpoint(
    max_campaigns: int = Query(default=5, ge=1, le=50),
    db: Session = Depends(get_db),
):
    """Worker / scheduler hook to claim and process due scheduled campaigns."""
    claimed_ids = process_due_scheduled_campaigns(db, max_campaigns=max_campaigns)
    return {
        "status": "success",
        "processed_count": len(claimed_ids),
        "campaign_ids": claimed_ids,
    }


# 1x1 transparent GIF pixel bytes
_TRACKING_PIXEL_GIF = bytes([
    0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00,
    0x80, 0x00, 0x00, 0xFF, 0xFF, 0xFF, 0x00, 0x00, 0x00, 0x21,
    0xF9, 0x04, 0x01, 0x00, 0x00, 0x00, 0x00, 0x2C, 0x00, 0x00,
    0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0x02, 0x02, 0x44,
    0x01, 0x00, 0x3B
])


@router.get("/{campaign_id}/track/open/{snapshot_id}")
def track_email_open_endpoint(
    campaign_id: int,
    snapshot_id: int,
    request: Request,
    db: Session = Depends(get_db),
):
    """Records an open tracking event and returns a 1x1 transparent GIF."""
    client_ip = request.client.host if request.client else None
    user_agent = request.headers.get("user-agent")
    record_open_event(db, campaign_id, snapshot_id, client_ip, user_agent)
    return Response(
        content=_TRACKING_PIXEL_GIF,
        media_type="image/gif",
        headers={
            "Cache-Control": "no-cache, no-store, must-revalidate",
            "Pragma": "no-cache",
            "Expires": "0",
        },
    )


@router.get("/{campaign_id}/track/click/{snapshot_id}")
def track_email_click_endpoint(
    campaign_id: int,
    snapshot_id: int,
    url: str = Query(..., description="Target destination URL"),
    request: Request = None,
    db: Session = Depends(get_db),
):
    """Records a click tracking event and securely redirects to the target destination URL."""
    client_ip = request.client.host if request and request.client else None
    user_agent = request.headers.get("user-agent") if request else None
    dest_url = record_click_event(db, campaign_id, snapshot_id, url, client_ip, user_agent)
    return RedirectResponse(url=dest_url, status_code=status.HTTP_307_TEMPORARY_REDIRECT)


@router.get("/{campaign_id}/unsubscribe", response_class=HTMLResponse)
def unsubscribe_endpoint(
    campaign_id: int,
    s: int = Query(..., description="Recipient snapshot ID"),
    db: Session = Depends(get_db),
):
    """Records an opt-out / unsubscribe event, updates suppression, and renders confirmation."""
    success = handle_campaign_unsubscribe(db, campaign_id, s)
    if not success:
        return HTMLResponse(
            content="""
            <!DOCTYPE html>
            <html>
            <head><title>Unsubscribe — Sitech Series</title></head>
            <body style="font-family:sans-serif;text-align:center;padding:50px;">
                <h2>Unsubscribe Link Expired or Invalid</h2>
                <p>We could not find the specified recipient subscription record.</p>
            </body>
            </html>
            """,
            status_code=404,
        )
    return HTMLResponse(
        content="""
        <!DOCTYPE html>
        <html>
        <head><title>Unsubscribed — Sitech Series</title></head>
        <body style="font-family:sans-serif;text-align:center;padding:50px;background:#f8fafc;">
            <div style="max-width:500px;margin:auto;background:white;padding:30px;border-radius:8px;box-shadow:0 2px 10px rgba(0,0,0,0.1);">
                <h2 style="color:#0f172a;">You have been unsubscribed</h2>
                <p style="color:#64748b;">You have been successfully removed from this campaign and will not receive further outreach communications.</p>
            </div>
        </body>
        </html>
        """
    )


@router.post("/inbound-reply")
@router.post("/{campaign_id}/inbound-reply")
def inbound_email_reply_webhook_endpoint(
    payload: dict,
    campaign_id: int | None = None,
    db: Session = Depends(get_db),
):
    """Ingests incoming reply messages, performs In-Reply-To and recipient matching,
    and updates recipient engagement records idempotently.
    """
    data = dict(payload)
    if campaign_id is not None:
        data["campaign_id"] = campaign_id
    try:
        result = ingest_inbound_reply(db, data)
        return result
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc

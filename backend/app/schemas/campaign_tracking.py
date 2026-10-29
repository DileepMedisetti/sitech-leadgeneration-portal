from datetime import datetime
from typing import Any
from pydantic import BaseModel, ConfigDict, Field


class CampaignTrackingOverviewMetrics(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    completed_campaigns: int = Field(0, description="Total completed or sent campaigns")
    total_sent: int = Field(0, description="Total emails sent across completed campaigns")
    total_delivered: int = Field(0, description="Total emails successfully delivered")
    total_opens: int = Field(0, description="Total email open events recorded")
    unique_opened_recipients: int = Field(0, description="Unique recipients who opened emails")
    overall_open_rate: float = Field(0.0, description="Overall unique open rate percentage")
    total_bounces: int = Field(0, description="Authoritative historical total bounces")
    overall_bounce_rate: float = Field(0.0, description="Overall historical bounce rate percentage")
    total_clicks: int = Field(0, description="Total link clicks recorded")
    unique_clicks: int = Field(0, description="Unique recipients who clicked links")
    overall_click_rate: float = Field(0.0, description="Overall unique click rate percentage")


class CompletedCampaignItem(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    status: str
    sent_at: str | None = None
    created_at: str | None = None
    total_recipients: int = 0
    sent_count: int = 0
    delivered_count: int = 0
    opened_count: int = 0
    unique_opens: int = 0
    open_rate: float = 0.0
    clicked_count: int = 0
    unique_clicks: int = 0
    click_rate: float = 0.0
    bounced_count: int = 0
    bounce_rate: float = 0.0
    owner_name: str | None = None
    sender_email: str | None = None


class CompletedCampaignsListResponse(BaseModel):
    items: list[CompletedCampaignItem]
    total: int
    page: int
    page_size: int
    total_pages: int
    overview_metrics: CampaignTrackingOverviewMetrics


class CampaignTrackingDetailSummaryMetrics(BaseModel):
    total_recipients: int = 0
    emails_attempted: int = 0
    sent: int = 0
    delivered: int = 0
    delivery_rate: float = 0.0
    total_opens: int = 0
    unique_opens: int = 0
    open_rate: float = 0.0
    total_clicks: int = 0
    unique_clicks: int = 0
    click_rate: float = 0.0
    historical_bounced_count: int = 0
    historical_bounce_rate: float = 0.0
    hard_bounces: int = 0
    soft_bounces: int = 0
    unknown_bounces: int = 0
    active_bounce_listing_count: int = 0
    replies_count: int = 0
    unsubscribes_count: int = 0


class CampaignTrackingDetailSummary(BaseModel):
    campaign_id: int
    name: str
    status: str
    sent_at: str | None = None
    created_at: str | None = None
    sender_name: str | None = None
    sender_email: str | None = None
    reply_to: str | None = None
    subject: str | None = None
    preview_text: str | None = None
    metrics: CampaignTrackingDetailSummaryMetrics


class OpenedRecipientItem(BaseModel):
    id: int
    recipient_name: str
    email: str
    profession: str | None = None
    university: str | None = None
    country: str | None = None
    first_opened_at: str | None = None
    last_opened_at: str | None = None
    open_count: int = 0
    click_count: int = 0


class OpenedRecipientsResponse(BaseModel):
    items: list[OpenedRecipientItem]
    total: int
    page: int
    page_size: int
    total_pages: int
    available_countries: list[str] = []
    available_professions: list[str] = []
    available_universities: list[str] = []


class BouncedMailsSummary(BaseModel):
    total_historical_bounced: int = 0
    historical_bounce_rate: float = 0.0
    hard_bounces: int = 0
    soft_bounces: int = 0
    unknown_bounces: int = 0
    active_listing_count: int = 0


class BouncedMailItem(BaseModel):
    id: int
    recipient_name: str
    email: str
    profession: str | None = None
    university: str | None = None
    country: str | None = None
    bounce_type: str = "unknown"
    bounce_reason: str | None = None
    bounced_at: str | None = None
    dispatch_attempt_at: str | None = None


class BouncedMailsResponse(BaseModel):
    items: list[BouncedMailItem]
    total: int
    page: int
    page_size: int
    total_pages: int
    summary: BouncedMailsSummary
    available_countries: list[str] = []
    available_professions: list[str] = []
    available_universities: list[str] = []


class DeleteBouncesResponse(BaseModel):
    success: bool
    deleted_count: int
    message: str
    historical_bounced_count: int
    historical_bounce_rate: float


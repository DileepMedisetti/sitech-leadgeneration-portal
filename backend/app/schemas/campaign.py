from datetime import datetime
from typing import Any, Literal
from pydantic import BaseModel, ConfigDict, EmailStr, Field

from app.schemas.deliverability import DeliverabilityReportResponse, PlacementTestResponse, MLPredictionResponse

CampaignStatus = Literal[
    "draft",
    "scheduled",
    "sending",
    "sent",
    "paused",
    "cancelled",
    "failed",
    "archived",
]

ContentEditorMode = Literal["template_gallery", "html_editor"]


# ==============================================================================
# Content Schemas
# ==============================================================================


class CampaignContentBase(BaseModel):
    subject: str = Field(..., min_length=1, max_length=500)
    preview_text: str | None = Field(default=None, max_length=500)
    from_name: str = Field(..., min_length=1, max_length=255)
    from_email: str = Field(..., min_length=3, max_length=320)
    reply_to: str | None = Field(default=None, max_length=320)
    html_content: str = Field(..., min_length=1)
    plain_text: str | None = None
    editor_mode: ContentEditorMode = "html_editor"
    template_id: str | None = None


class CampaignContentCreate(CampaignContentBase):
    pass


class CampaignContentResponse(CampaignContentBase):
    model_config = ConfigDict(from_attributes=True)

    id: int
    campaign_id: int
    version: int
    content_fingerprint: str
    created_at: datetime


# ==============================================================================
# Audience Schemas
# ==============================================================================


class CampaignAudienceSelectRequest(BaseModel):
    contact_list_ids: list[int] = Field(..., min_length=1)


class CampaignAudienceSummaryResponse(BaseModel):
    campaign_id: int
    selected_list_ids: list[int]
    selected_list_names: list[str] = []
    total_raw_contacts: int
    unique_contacts: int
    eligible_contacts: int
    suppressed_or_invalid_contacts: int
    is_ready_for_dispatch: bool


# ==============================================================================
# Campaign CRUD Schemas
# ==============================================================================


class CampaignCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: str | None = None
    content: CampaignContentCreate | None = None
    contact_list_ids: list[int] = []
    tags: list[str] = []


class CampaignUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    content: CampaignContentCreate | None = None
    contact_list_ids: list[int] | None = None
    tags: list[str] | None = None


class CampaignScheduleRequest(BaseModel):
    send_immediately: bool = False
    scheduled_at: datetime | None = None
    timezone_name: str = "UTC"


class CampaignConfirmSendRequest(BaseModel):
    confirmed: bool = True
    bypass_warnings: bool = False


class CampaignLaunchRequest(BaseModel):
    send_immediately: bool = False
    scheduled_at: datetime | None = None
    timezone_name: str = "UTC"
    confirmed: bool = True
    bypass_warnings: bool = False


class CampaignResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    description: str | None = None
    subject: str | None = None
    status: CampaignStatus
    tags: list[str] = []
    current_content_version: int | None = None
    total_recipients: int = 0
    sent_count: int = 0
    delivered_count: int = 0
    bounced_count: int = 0
    unsubscribed_count: int = 0
    open_rate: float | None = None
    scheduled_at: datetime | None = None
    sent_at: datetime | None = None
    created_at: datetime
    updated_at: datetime


class CampaignDetailResponse(CampaignResponse):
    content: CampaignContentResponse | None = None
    audience: CampaignAudienceSummaryResponse | None = None
    latest_deliverability_report: DeliverabilityReportResponse | None = None
    latest_placement_test: PlacementTestResponse | None = None
    latest_ml_prediction: MLPredictionResponse | None = None


class PaginatedCampaignsResponse(BaseModel):
    total: int
    page: int
    page_size: int
    total_pages: int
    items: list[CampaignResponse]
    counts: dict[str, int] | None = None


# ==============================================================================
# Pre-launch Gate Schemas
# ==============================================================================


class PreflightCheckItem(BaseModel):
    category: str
    label: str
    status: Literal["passed", "warning", "blocked"]
    detail: str


class CampaignPreflightResponse(BaseModel):
    campaign_id: int
    is_ready: bool
    can_schedule_or_send: bool
    requires_warning_acknowledgement: bool
    blockers: list[str] = []
    warnings: list[str] = []
    checks: list[PreflightCheckItem] = []
    deliverability_report: DeliverabilityReportResponse | None = None
    placement_test: PlacementTestResponse | None = None
    ml_prediction: MLPredictionResponse | None = None

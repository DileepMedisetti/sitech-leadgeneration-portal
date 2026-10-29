from datetime import datetime
from typing import Any, Literal
from pydantic import BaseModel, ConfigDict, Field

RuleCategory = Literal["content", "personalization", "html_links", "authentication", "compliance"]
FindingSeverity = Literal["info", "warning", "error", "blocker"]
CheckStatus = Literal["passed", "failed", "unknown", "not_checked"]
RiskLevel = Literal["low", "medium", "high", "critical"]
PlacementOutcome = Literal["inbox", "spam", "other", "unknown", "failed"]
PlacementJobStatus = Literal["pending", "running", "completed", "failed"]


class DeliverabilityFinding(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    rule_code: str
    category: RuleCategory
    severity: FindingSeverity
    title: str
    explanation: str
    recommendation: str
    status: CheckStatus = "failed"
    risk_points: float = 0.0
    evidence: dict[str, Any] | None = None


class DeliverabilityReportResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int | None = None
    campaign_id: int
    content_version: int
    content_fingerprint: str
    rule_set_version: str = "1.0.0"
    risk_score: float
    risk_level: RiskLevel
    findings_count: int
    passed_count: int
    failed_count: int
    unknown_count: int
    has_blockers: bool
    is_stale: bool = False
    findings: list[DeliverabilityFinding]
    category_scores: dict[str, float] = {}
    created_at: datetime


class AnalyzeContentRequest(BaseModel):
    subject: str = Field(..., min_length=1, max_length=500)
    preview_text: str | None = Field(default=None, max_length=500)
    from_name: str = Field(..., min_length=1, max_length=255)
    from_email: str = Field(..., min_length=3, max_length=320)
    reply_to: str | None = Field(default=None, max_length=320)
    html_content: str = Field(..., min_length=1)
    plain_text: str | None = None
    unsubscribe_url: str | None = None


class ReportComparisonResponse(BaseModel):
    campaign_id: int
    report_a: DeliverabilityReportResponse
    report_b: DeliverabilityReportResponse
    score_delta: float
    fixed_findings: list[str]
    new_findings: list[str]


# ==============================================================================
# Placement Test Schemas
# ==============================================================================


class PlacementSeedResult(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    seed_email: str
    mailbox_provider: str
    outcome: PlacementOutcome
    latency_seconds: float | None = None
    detail: str | None = None
    observed_at: datetime | None = None


class PlacementTestCreate(BaseModel):
    provider_name: str = "sitech_seedbox_network"
    mailbox_providers: list[str] = ["gmail", "outlook", "yahoo", "apple_mail", "corporate_custom"]
    notes: str | None = None


class PlacementTestResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    campaign_id: int
    content_version: int
    content_fingerprint: str
    provider_name: str
    status: PlacementJobStatus
    total_tests: int
    observed_count: int
    inbox_count: int
    spam_count: int
    other_count: int
    unknown_count: int
    failed_count: int
    inbox_rate: float
    spam_rate: float
    provider_breakdown: dict[str, dict[str, Any]] = {}
    results: list[PlacementSeedResult] = []
    created_at: datetime
    completed_at: datetime | None = None
    error_message: str | None = None


class PaginatedPlacementTestsResponse(BaseModel):
    total: int
    page: int
    page_size: int
    items: list[PlacementTestResponse]


# ==============================================================================
# ML Prediction Schemas
# ==============================================================================


class MLModelInfoResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    name: str
    version: str
    algorithm: str
    is_active: bool
    accuracy: float | None = None
    f1_score: float | None = None
    auc_roc: float | None = None
    brier_score: float | None = None
    training_sample_size: int | None = None
    created_at: datetime
    description: str | None = None


class MLPredictionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    status: Literal["available", "unavailable"]
    reason: str | None = None
    campaign_id: int
    content_version: int
    model_version: str | None = None
    predicted_placement: Literal["inbox", "spam", "ambiguous"] | None = None
    inbox_probability: float | None = None
    confidence_interval: tuple[float, float] | None = None
    risk_tier: Literal["low_risk", "moderate_risk", "high_risk"] | None = None
    features_used: dict[str, Any] = {}
    feature_importance: list[dict[str, Any]] = []
    limitations: str
    created_at: datetime

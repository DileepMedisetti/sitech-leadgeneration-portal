from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.schemas.deliverability import (
    AnalyzeContentRequest,
    DeliverabilityFinding,
    DeliverabilityReportResponse,
    MLModelInfoResponse,
    MLPredictionResponse,
    PaginatedPlacementTestsResponse,
    PlacementTestCreate,
    PlacementTestResponse,
    ReportComparisonResponse,
)
from app.services.deliverability.analyzer_service import (
    analyze_email_content,
    compare_deliverability_reports,
    get_campaign_reports_history,
    get_latest_campaign_report,
    run_campaign_deliverability_analysis,
)
from app.services.ml.inference_service import list_registered_models, predict_campaign_placement
from app.services.ml.trainer import train_and_evaluate_placement_model
from app.services.placement.placement_service import (
    get_latest_placement_test,
    get_placement_test_by_id,
    list_campaign_placement_tests,
    request_placement_test,
)

router = APIRouter(prefix="/api/deliverability", tags=["Deliverability Intelligence"])


# ==============================================================================
# Rule-Based Analyzer Endpoints
# ==============================================================================


@router.post("/analyze-content", response_model=DeliverabilityReportResponse)
def analyze_content_endpoint(
    payload: AnalyzeContentRequest,
):
    """Analyze raw email content without persisting to a campaign."""
    risk_score, risk_level, findings, category_scores, has_blockers = analyze_email_content(
        subject=payload.subject,
        preview_text=payload.preview_text,
        from_name=payload.from_name,
        from_email=payload.from_email,
        reply_to=payload.reply_to,
        html_content=payload.html_content,
        plain_text=payload.plain_text,
        unsubscribe_url=payload.unsubscribe_url,
    )

    failed_count = sum(1 for f in findings if f.status == "failed")
    passed_count = sum(1 for f in findings if f.status == "passed")
    unknown_count = sum(1 for f in findings if f.status == "unknown")

    return DeliverabilityReportResponse(
        id=None,
        campaign_id=0,
        content_version=1,
        content_fingerprint="ephemeral_analysis",
        rule_set_version="1.0.0",
        risk_score=risk_score,
        risk_level=risk_level,
        findings_count=len(findings),
        passed_count=passed_count,
        failed_count=failed_count,
        unknown_count=unknown_count,
        has_blockers=has_blockers,
        is_stale=False,
        findings=findings,
        category_scores=category_scores,
        created_at=datetime.now(timezone.utc),
    )


@router.post("/campaigns/{campaign_id}/analyze", response_model=DeliverabilityReportResponse)
def analyze_campaign_endpoint(
    campaign_id: int,
    db: Session = Depends(get_db),
):
    """Trigger a fresh rule-based analysis on the campaign's current content version."""
    try:
        report = run_campaign_deliverability_analysis(db, campaign_id)
        db.commit()
        return report
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Database error during analysis.") from exc


@router.get("/campaigns/{campaign_id}/report", response_model=DeliverabilityReportResponse)
def get_campaign_latest_report_endpoint(
    campaign_id: int,
    db: Session = Depends(get_db),
):
    """Retrieve the most recent deliverability report for a campaign, with stale detection."""
    report = get_latest_campaign_report(db, campaign_id)
    if not report:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No deliverability report found for campaign {campaign_id}.",
        )
    return report


@router.get("/campaigns/{campaign_id}/history", response_model=list[DeliverabilityReportResponse])
def get_campaign_reports_history_endpoint(
    campaign_id: int,
    limit: int = Query(default=10, ge=1, le=50),
    db: Session = Depends(get_db),
):
    """Retrieve historical deliverability analysis reports for a campaign."""
    return get_campaign_reports_history(db, campaign_id, limit=limit)


@router.get("/reports/compare", response_model=ReportComparisonResponse)
def compare_reports_endpoint(
    report_a: int = Query(...),
    report_b: int = Query(...),
    db: Session = Depends(get_db),
):
    """Compare two deliverability reports to see score delta and fixed/new findings."""
    try:
        return compare_deliverability_reports(db, report_a, report_b)
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


# ==============================================================================
# Placement Testing Endpoints
# ==============================================================================


@router.post("/campaigns/{campaign_id}/placement-test", response_model=PlacementTestResponse)
def run_placement_test_endpoint(
    campaign_id: int,
    payload: PlacementTestCreate,
    db: Session = Depends(get_db),
):
    """Request and execute a controlled mailbox placement test across target seedboxes."""
    try:
        result = request_placement_test(db, campaign_id, payload)
        db.commit()
        return result
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    except SQLAlchemyError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Database error executing placement test.") from exc


@router.get("/campaigns/{campaign_id}/placement-tests", response_model=PaginatedPlacementTestsResponse)
def list_campaign_placement_tests_endpoint(
    campaign_id: int,
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=10, ge=1, le=50),
    db: Session = Depends(get_db),
):
    """List historical placement test jobs for a campaign."""
    return list_campaign_placement_tests(db, campaign_id, page=page, page_size=page_size)


@router.get("/placement-tests/{test_id}", response_model=PlacementTestResponse)
def get_placement_test_detail_endpoint(
    test_id: int,
    db: Session = Depends(get_db),
):
    """Retrieve detailed outcome observations for a specific placement test."""
    test = get_placement_test_by_id(db, test_id)
    if not test:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Placement test {test_id} not found.")
    return test


# ==============================================================================
# Machine Learning Endpoints
# ==============================================================================


@router.get("/campaigns/{campaign_id}/ml-prediction", response_model=MLPredictionResponse)
def get_campaign_ml_prediction_endpoint(
    campaign_id: int,
    db: Session = Depends(get_db),
):
    """Get ML inbox placement prediction.

    Returns status='unavailable' with reason if no active model is approved.
    """
    try:
        pred = predict_campaign_placement(db, campaign_id)
        db.commit()
        return pred
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.get("/ml/models", response_model=list[MLModelInfoResponse])
def get_registered_ml_models_endpoint(
    db: Session = Depends(get_db),
):
    """List registered machine-learning placement models and their validation metrics."""
    return list_registered_models(db)


@router.post("/ml/train", response_model=MLModelInfoResponse)
def train_ml_model_endpoint(
    model_version: str = Query(default="v1.0.0"),
    db: Session = Depends(get_db),
):
    """Train, calibrate, and register a new machine-learning placement model."""
    try:
        model = train_and_evaluate_placement_model(db, model_version=model_version)
        db.commit()
        return MLModelInfoResponse(
            id=model.id,
            name=model.name,
            version=model.version,
            algorithm=model.algorithm,
            is_active=model.is_active,
            accuracy=model.accuracy,
            f1_score=model.f1_score,
            auc_roc=model.auc_roc,
            brier_score=model.brier_score,
            training_sample_size=model.training_sample_size,
            created_at=model.created_at,
            description=model.description,
        )
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(exc)) from exc
    except Exception as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Model training failed: {str(exc)}") from exc

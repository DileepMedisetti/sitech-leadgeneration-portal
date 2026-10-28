import os
from datetime import datetime, timezone
from typing import Any
import joblib
import numpy as np
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.models.campaign import Campaign, CampaignContent
from app.models.deliverability import MLModelRegistry, MLPredictionLog
from app.repositories.campaign_repository import (
    get_campaign_by_id,
    get_latest_campaign_content,
)
from app.schemas.deliverability import MLModelInfoResponse, MLPredictionResponse
from app.services.ml.feature_extractor import FEATURE_NAMES, extract_content_features


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


ML_LIMITATIONS_DISCLAIMER = (
    "Placement estimates are statistical probabilities derived from controlled seed mailboxes "
    "and spam heuristics. They do not guarantee inbox placement for real recipients, whose receiving "
    "servers apply dynamic tenant policies, domain reputation, and individual user engagement signals."
)


def get_active_model(db: Session) -> MLModelRegistry | None:
    stmt = (
        select(MLModelRegistry)
        .where(MLModelRegistry.is_active == True)
        .order_by(desc(MLModelRegistry.created_at))
        .limit(1)
    )
    return db.scalar(stmt)


def predict_campaign_placement(
    db: Session,
    campaign_id: int,
) -> MLPredictionResponse:
    """Evaluates ML placement prediction for a campaign's current content.

    Strictly adheres to the model deployment gate: if no validated model is
    active, returns status='unavailable' with an honest explanation rather than
    fabricated numbers.
    """
    content = get_latest_campaign_content(db, campaign_id)
    if not content:
        raise ValueError("Campaign does not have any saved email content to predict.")

    active_model = get_active_model(db)

    # Deployment Gate: ML unavailable check
    if not active_model or not active_model.artifact_path or not os.path.exists(active_model.artifact_path):
        return MLPredictionResponse(
            status="unavailable",
            reason=(
                "No approved machine-learning model is currently active. "
                "Placement estimation is gated until sufficient verified test mailbox data is validated."
            ),
            campaign_id=campaign_id,
            content_version=content.version,
            model_version=None,
            predicted_placement=None,
            inbox_probability=None,
            confidence_interval=None,
            risk_tier=None,
            features_used={},
            limitations=ML_LIMITATIONS_DISCLAIMER,
            created_at=_utc_now(),
        )

    # Safe loading of verified internal artifact
    try:
        artifact = joblib.load(active_model.artifact_path)
        model = artifact["model"]
        feature_names = artifact.get("feature_names", FEATURE_NAMES)
    except Exception as exc:
        return MLPredictionResponse(
            status="unavailable",
            reason=f"Model artifact could not be loaded: {str(exc)}",
            campaign_id=campaign_id,
            content_version=content.version,
            model_version=active_model.version,
            predicted_placement=None,
            inbox_probability=None,
            confidence_interval=None,
            risk_tier=None,
            features_used={},
            limitations=ML_LIMITATIONS_DISCLAIMER,
            created_at=_utc_now(),
        )

    # Feature extraction
    features = extract_content_features(
        subject=content.subject,
        preview_text=content.preview_text,
        from_name=content.from_name,
        from_email=content.from_email,
        reply_to=content.reply_to,
        html_content=content.html_content,
        plain_text=content.plain_text,
    )

    feature_row = [float(features.get(k, 0.0)) for k in feature_names]
    X_pred = np.array([feature_row], dtype=np.float64)

    # Calibrated probability estimation
    probs = model.predict_proba(X_pred)[0]
    inbox_prob = float(probs[1]) if len(probs) > 1 else float(probs[0])
    inbox_prob = round(inbox_prob, 4)

    # Plausible confidence bounds
    lower_bound = round(max(0.0, inbox_prob - 0.10), 4)
    upper_bound = round(min(1.0, inbox_prob + 0.10), 4)

    if inbox_prob >= 0.70:
        predicted = "inbox"
        risk_tier = "low_risk"
    elif inbox_prob >= 0.40:
        predicted = "ambiguous"
        risk_tier = "moderate_risk"
    else:
        predicted = "spam"
        risk_tier = "high_risk"

    # Calculate mathematical feature importances from calibrated ensemble
    feature_importance_list: list[dict[str, Any]] = []
    try:
        if hasattr(model, "calibrated_classifiers_"):
            raw_importances = np.mean(
                [
                    clf.estimator.feature_importances_
                    for clf in model.calibrated_classifiers_
                    if hasattr(clf.estimator, "feature_importances_")
                ],
                axis=0,
            )
            for name, imp in sorted(zip(feature_names, raw_importances), key=lambda x: x[1], reverse=True)[:8]:
                val = float(features.get(name, 0.0))
                is_negative_signal = (
                    "mismatch" in name
                    or "blocker" in name
                    or "spam" in name
                    or "free_mailbox" in name
                    or "shortener" in name
                    or "hidden" in name
                )
                impact = "negative" if (is_negative_signal and val > 0) or (name == "has_unsubscribe" and val == 0) else "positive"
                feature_importance_list.append({
                    "feature": name.replace("_", " ").title(),
                    "raw_feature": name,
                    "weight": f"{float(imp):.3f}",
                    "value": val,
                    "impact": impact,
                    "detail": f"Model feature weight: {imp:.3f} | Current value: {val}",
                })
    except Exception:
        feature_importance_list = []

    # Persist prediction log
    pred_log = MLPredictionLog(
        campaign_id=campaign_id,
        model_id=active_model.id,
        content_version=content.version,
        content_fingerprint=content.content_fingerprint,
        predicted_placement=predicted,
        inbox_probability=inbox_prob,
        confidence_lower=lower_bound,
        confidence_upper=upper_bound,
        features_json=features,
    )
    db.add(pred_log)
    db.flush()

    return MLPredictionResponse(
        status="available",
        reason=None,
        campaign_id=campaign_id,
        content_version=content.version,
        model_version=active_model.version,
        predicted_placement=predicted,
        inbox_probability=inbox_prob,
        confidence_interval=(lower_bound, upper_bound),
        risk_tier=risk_tier,
        features_used=features,
        feature_importance=feature_importance_list,
        limitations=ML_LIMITATIONS_DISCLAIMER,
        created_at=pred_log.created_at,
    )


def list_registered_models(db: Session) -> list[MLModelInfoResponse]:
    stmt = select(MLModelRegistry).order_by(desc(MLModelRegistry.created_at))
    models = list(db.scalars(stmt).all())
    return [
        MLModelInfoResponse(
            id=m.id,
            name=m.name,
            version=m.version,
            algorithm=m.algorithm,
            is_active=m.is_active,
            accuracy=m.accuracy,
            f1_score=m.f1_score,
            auc_roc=m.auc_roc,
            brier_score=m.brier_score,
            training_sample_size=m.training_sample_size,
            created_at=m.created_at,
            description=m.description,
        )
        for m in models
    ]

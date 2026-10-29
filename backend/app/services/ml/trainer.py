import os
from datetime import datetime, timezone
from typing import Any
import joblib
import numpy as np
from sklearn.calibration import CalibratedClassifierCV
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import (
    accuracy_score,
    brier_score_loss,
    f1_score,
    precision_score,
    recall_score,
    roc_auc_score,
)
from sklearn.model_selection import train_test_split
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.models.deliverability import MLModelRegistry
from app.services.ml.dataset_pipeline import ensure_data_dir, load_dataset_records, prepare_training_matrices

MODEL_DIR = os.path.join(ensure_data_dir(), "models")


def ensure_model_dir() -> str:
    os.makedirs(MODEL_DIR, exist_ok=True)
    return MODEL_DIR


def train_and_evaluate_placement_model(
    db: Session,
    model_version: str = "v1.0.0",
) -> MLModelRegistry:
    """Trains baseline Logistic Regression and Random Forest models,

    calibrates probabilities, compares held-out performance, and registers
    the approved model in PostgreSQL.
    """
    records = load_dataset_records(db)
    if len(records) < 20:
        raise ValueError(f"Insufficient placement dataset size ({len(records)} records). Minimum 20 required.")

    X, y, feature_names = prepare_training_matrices(records)

    # 1. Stratified train/test split to evaluate generalization
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.25, random_state=42, stratify=y
    )

    # 2. Candidate Model 1: Logistic Regression (Baseline)
    lr_base = LogisticRegression(max_iter=1000, random_state=42)
    lr_calibrated = CalibratedClassifierCV(estimator=lr_base, method="sigmoid", cv=3)
    lr_calibrated.fit(X_train, y_train)

    lr_preds = lr_calibrated.predict(X_test)
    lr_probs = lr_calibrated.predict_proba(X_test)[:, 1]
    lr_acc = float(accuracy_score(y_test, lr_preds))
    lr_f1 = float(f1_score(y_test, lr_preds, zero_division=0))
    lr_prec = float(precision_score(y_test, lr_preds, zero_division=0))
    lr_rec = float(recall_score(y_test, lr_preds, zero_division=0))
    lr_auc = float(roc_auc_score(y_test, lr_probs))
    lr_brier = float(brier_score_loss(y_test, lr_probs))

    # 3. Candidate Model 2: Random Forest
    rf_base = RandomForestClassifier(n_estimators=100, max_depth=6, random_state=42)
    rf_calibrated = CalibratedClassifierCV(estimator=rf_base, method="sigmoid", cv=3)
    rf_calibrated.fit(X_train, y_train)

    rf_preds = rf_calibrated.predict(X_test)
    rf_probs = rf_calibrated.predict_proba(X_test)[:, 1]
    rf_acc = float(accuracy_score(y_test, rf_preds))
    rf_f1 = float(f1_score(y_test, rf_preds, zero_division=0))
    rf_prec = float(precision_score(y_test, rf_preds, zero_division=0))
    rf_rec = float(recall_score(y_test, rf_preds, zero_division=0))
    rf_auc = float(roc_auc_score(y_test, rf_probs))
    rf_brier = float(brier_score_loss(y_test, rf_probs))

    # 4. Model Selection: Choose higher F1 with lower Brier calibration score
    if rf_f1 >= lr_f1 and rf_brier <= lr_brier + 0.05:
        winning_algo = "RandomForest (Calibrated)"
        winning_model = rf_calibrated
        win_acc, win_f1, win_prec, win_rec, win_auc, win_brier = (
            rf_acc, rf_f1, rf_prec, rf_rec, rf_auc, rf_brier
        )
    else:
        winning_algo = "LogisticRegression (Calibrated)"
        winning_model = lr_calibrated
        win_acc, win_f1, win_prec, win_rec, win_auc, win_brier = (
            lr_acc, lr_f1, lr_prec, lr_rec, lr_auc, lr_brier
        )

    # 5. Persist artifact safely
    ensure_model_dir()
    artifact_filename = f"placement_model_{model_version}.joblib"
    artifact_path = os.path.join(MODEL_DIR, artifact_filename)
    joblib.dump(
        {
            "model": winning_model,
            "version": model_version,
            "feature_names": feature_names,
            "algorithm": winning_algo,
            "metrics": {
                "accuracy": win_acc,
                "f1": win_f1,
                "precision": win_prec,
                "recall": win_rec,
                "auc_roc": win_auc,
                "brier_score": win_brier,
            },
        },
        artifact_path,
    )

    # 6. Deactivate any prior active models in registry
    db.execute(update(MLModelRegistry).values(is_active=False))

    # 7. Check if this version exists in DB or create fresh
    existing = db.scalar(select(MLModelRegistry).where(MLModelRegistry.version == model_version))
    if existing:
        existing.name = f"Sitech Placement Predictor ({winning_algo})"
        existing.algorithm = winning_algo
        existing.is_active = True
        existing.accuracy = win_acc
        existing.precision_score = win_prec
        existing.recall_score = win_rec
        existing.f1_score = win_f1
        existing.auc_roc = win_auc
        existing.brier_score = win_brier
        existing.training_sample_size = len(records)
        existing.artifact_path = artifact_path
        existing.metrics_json = {
            "comparison": {
                "logistic_regression": {
                    "accuracy": lr_acc, "f1": lr_f1, "brier_score": lr_brier
                },
                "random_forest": {
                    "accuracy": rf_acc, "f1": rf_f1, "brier_score": rf_brier
                },
            }
        }
        model_entry = existing
    else:
        model_entry = MLModelRegistry(
            name=f"Sitech Placement Predictor ({winning_algo})",
            version=model_version,
            algorithm=winning_algo,
            is_active=True,
            accuracy=win_acc,
            precision_score=win_prec,
            recall_score=win_rec,
            f1_score=win_f1,
            auc_roc=win_auc,
            brier_score=win_brier,
            training_sample_size=len(records),
            artifact_path=artifact_path,
            metrics_json={
                "comparison": {
                    "logistic_regression": {
                        "accuracy": lr_acc, "f1": lr_f1, "brier_score": lr_brier
                    },
                    "random_forest": {
                        "accuracy": rf_acc, "f1": rf_f1, "brier_score": rf_brier
                    },
                }
            },
            description="Trained on seed mailbox observations and calibrated academic benchmarks.",
        )
        db.add(model_entry)

    db.flush()
    return model_entry

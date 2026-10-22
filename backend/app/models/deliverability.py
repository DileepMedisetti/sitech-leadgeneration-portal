from datetime import datetime
from sqlalchemy import (
    BigInteger,
    Boolean,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base


class DeliverabilityReport(Base):
    __tablename__ = "deliverability_reports"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    campaign_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("campaigns.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    content_version: Mapped[int] = mapped_column(Integer, nullable=False)
    content_fingerprint: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    rule_set_version: Mapped[str] = mapped_column(String(32), nullable=False, default="1.0.0", server_default="1.0.0")

    risk_score: Mapped[float] = mapped_column(Float, nullable=False, default=0.0)
    risk_level: Mapped[str] = mapped_column(String(20), nullable=False, default="low")

    findings_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    passed_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    failed_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    unknown_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    has_blockers: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    category_scores: Mapped[dict] = mapped_column(JSONB, nullable=False, server_default="{}")
    findings_json: Mapped[list] = mapped_column(JSONB, nullable=False, server_default="[]")

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True,
    )

    campaign = relationship("Campaign", back_populates="deliverability_reports")


class PlacementTestJob(Base):
    __tablename__ = "placement_test_jobs"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    campaign_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("campaigns.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    content_version: Mapped[int] = mapped_column(Integer, nullable=False)
    content_fingerprint: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    provider_name: Mapped[str] = mapped_column(
        String(64),
        nullable=False,
        default="sitech_seedbox_network",
        server_default="sitech_seedbox_network",
    )
    status: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="pending",
        server_default="pending",
        index=True,
    )

    total_tests: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    observed_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    inbox_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    spam_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    other_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    unknown_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    failed_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)

    provider_breakdown: Mapped[dict] = mapped_column(JSONB, nullable=False, server_default="{}")
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True,
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    campaign = relationship("Campaign", back_populates="placement_tests")
    seed_results = relationship(
        "PlacementTestSeedResult",
        back_populates="test_job",
        cascade="all, delete-orphan",
    )


class PlacementTestSeedResult(Base):
    __tablename__ = "placement_test_seed_results"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    test_job_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("placement_test_jobs.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    seed_email: Mapped[str] = mapped_column(String(320), nullable=False)
    mailbox_provider: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    outcome: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    latency_seconds: Mapped[float | None] = mapped_column(Float, nullable=True)
    detail: Mapped[str | None] = mapped_column(Text, nullable=True)
    observed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    test_job = relationship("PlacementTestJob", back_populates="seed_results")


class MLModelRegistry(Base):
    __tablename__ = "ml_model_registry"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    version: Mapped[str] = mapped_column(String(50), nullable=False, unique=True)
    algorithm: Mapped[str] = mapped_column(String(50), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)

    accuracy: Mapped[float | None] = mapped_column(Float, nullable=True)
    precision_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    recall_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    f1_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    auc_roc: Mapped[float | None] = mapped_column(Float, nullable=True)
    brier_score: Mapped[float | None] = mapped_column(Float, nullable=True)
    training_sample_size: Mapped[int | None] = mapped_column(Integer, nullable=True)

    metrics_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    artifact_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    predictions = relationship("MLPredictionLog", back_populates="model")


class MLPredictionLog(Base):
    __tablename__ = "ml_prediction_logs"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    campaign_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("campaigns.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    model_id: Mapped[int | None] = mapped_column(
        BigInteger,
        ForeignKey("ml_model_registry.id", ondelete="SET NULL"),
        nullable=True,
    )
    content_version: Mapped[int] = mapped_column(Integer, nullable=False)
    content_fingerprint: Mapped[str] = mapped_column(String(64), nullable=False, index=True)

    predicted_placement: Mapped[str] = mapped_column(String(20), nullable=False)
    inbox_probability: Mapped[float] = mapped_column(Float, nullable=False)
    confidence_lower: Mapped[float | None] = mapped_column(Float, nullable=True)
    confidence_upper: Mapped[float | None] = mapped_column(Float, nullable=True)

    features_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True,
    )

    campaign = relationship("Campaign", back_populates="ml_predictions")
    model = relationship("MLModelRegistry", back_populates="predictions")

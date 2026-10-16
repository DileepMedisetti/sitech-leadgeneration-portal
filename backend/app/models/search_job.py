
from datetime import datetime

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    DateTime,
    Index,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base


class SearchJob(Base):
    __tablename__ = "search_jobs"

    __table_args__ = (
        CheckConstraint(
            "target_leads > 0",
            name="ck_search_jobs_target_leads_positive",
        ),
        CheckConstraint(
            "max_serpapi_requests > 0",
            name="ck_search_jobs_max_requests_positive",
        ),
        CheckConstraint(
            "serpapi_requests_used >= 0",
            name="ck_search_jobs_requests_used_nonnegative",
        ),
        CheckConstraint(
            "serpapi_requests_used <= max_serpapi_requests",
            name="ck_search_jobs_requests_within_budget",
        ),
        CheckConstraint(
            "qualified_leads_found >= 0",
            name="ck_search_jobs_qualified_leads_nonnegative",
        ),
        CheckConstraint(
            "status IN ('pending', 'running', 'completed', 'stopped', 'failed')",
            name="ck_search_jobs_valid_status",
        ),
        Index("ix_search_jobs_status", "status"),
    )

    id: Mapped[int] = mapped_column(
        BigInteger,
        primary_key=True,
        autoincrement=True,
    )

    search_name: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )

    keywords: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    search_criteria: Mapped[dict | None] = mapped_column(
        JSONB,
        nullable=True,
    )

    target_leads: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    max_serpapi_requests: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
    )

    serpapi_requests_used: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        server_default="0",
    )

    qualified_leads_found: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        server_default="0",
    )

    status: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="pending",
        server_default="pending",
    )

    error_message: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    started_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    completed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

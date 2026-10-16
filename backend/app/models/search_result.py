
from datetime import datetime

from sqlalchemy import (
    BigInteger,
    DateTime,
    ForeignKey,
    Index,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base


class SearchResult(Base):
    __tablename__ = "search_results"

    __table_args__ = (
        UniqueConstraint(
            "search_job_id",
            "result_url",
            name="uq_search_results_job_url",
        ),
        Index("ix_search_results_status", "status"),
    )

    id: Mapped[int] = mapped_column(
        BigInteger,
        primary_key=True,
        autoincrement=True,
    )

    search_job_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("search_jobs.id", ondelete="RESTRICT"),
        nullable=False,
    )

    result_url: Mapped[str] = mapped_column(
        Text,
        nullable=False,
    )

    result_title: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    result_snippet: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    status: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="pending",
        server_default="pending",
    )

    lead_id: Mapped[int | None] = mapped_column(
        BigInteger,
        ForeignKey("leads.id", ondelete="RESTRICT"),
        nullable=True,
    )

    error_message: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    processed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True),
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

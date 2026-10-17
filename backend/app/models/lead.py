
from datetime import datetime

from sqlalchemy import (
    BigInteger,
    DateTime,
    Float,
    ForeignKey,
    Index,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.database import Base


class Lead(Base):
    __tablename__ = "leads"

    id: Mapped[int] = mapped_column(
        BigInteger,
        primary_key=True,
        autoincrement=True,
    )

    name: Mapped[str] = mapped_column(String(255), nullable=False)

    # Email must be normalized before inserting or updating a lead.
    email: Mapped[str | None] = mapped_column(
        String(320),
        nullable=True,
        unique=True,
    )

    phone_number: Mapped[str | None] = mapped_column(
        String(32),
        nullable=True,
    )
    profession: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )
    department: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )
    research_specialization: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    university: Mapped[str | None] = mapped_column(
        String(255),
        nullable=True,
    )
    country: Mapped[str | None] = mapped_column(
        String(100),
        nullable=True,
    )

    website: Mapped[str | None] = mapped_column(Text, nullable=True)
    linkedin_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_url: Mapped[str | None] = mapped_column(Text, nullable=True)
    source_title: Mapped[str | None] = mapped_column(Text, nullable=True)

    qualification_status: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="qualified",
        server_default="qualified",
    )
    confidence_score: Mapped[float | None] = mapped_column(
        Float,
        nullable=True,
    )
    qualification_reason: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )
    evidence: Mapped[dict | None] = mapped_column(
        JSONB,
        nullable=True,
    )

    search_job_id: Mapped[int | None] = mapped_column(
        BigInteger,
        ForeignKey("search_jobs.id", ondelete="SET NULL"),
        nullable=True,
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )


Index("ix_leads_name", Lead.name)
Index("ix_leads_country", Lead.country)
Index("ix_leads_profession", Lead.profession)
Index("ix_leads_university", Lead.university)
Index("ix_leads_qualification_status", Lead.qualification_status)
Index("ix_leads_search_job_id", Lead.search_job_id)
Index("ix_leads_created_at", Lead.created_at)

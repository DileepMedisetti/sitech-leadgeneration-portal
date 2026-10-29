from app.models.email_account import EmailAccount
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


class Campaign(Base):
    __tablename__ = "campaigns"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="draft",
        server_default="draft",
        index=True,
    )
    tags: Mapped[list[str]] = mapped_column(JSONB, nullable=False, server_default="[]")
    current_content_version: Mapped[int] = mapped_column(Integer, nullable=False, default=1, server_default="1")
    email_account_id: Mapped[int | None] = mapped_column(
        BigInteger,
        ForeignKey("email_accounts.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    owner_user_id: Mapped[int | None] = mapped_column(
        BigInteger,
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )

    scheduled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)
    timezone_name: Mapped[str] = mapped_column(String(64), nullable=False, default="UTC", server_default="UTC")
    sent_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    total_recipients: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    sent_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    delivered_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    opened_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    clicked_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    replied_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    bounced_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    unsubscribed_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True,
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )

    # Relationships
    email_account = relationship("EmailAccount")
    owner = relationship("User", back_populates="campaigns")
    contents = relationship(
        "CampaignContent",
        back_populates="campaign",
        cascade="all, delete-orphan",
        order_by="CampaignContent.version.desc()",
    )
    audience_lists = relationship(
        "CampaignAudienceList",
        back_populates="campaign",
        cascade="all, delete-orphan",
    )
    recipient_snapshots = relationship(
        "CampaignRecipientSnapshot",
        back_populates="campaign",
        cascade="all, delete-orphan",
    )
    deliverability_reports = relationship(
        "DeliverabilityReport",
        back_populates="campaign",
        cascade="all, delete-orphan",
        order_by="DeliverabilityReport.created_at.desc()",
    )
    placement_tests = relationship(
        "PlacementTestJob",
        back_populates="campaign",
        cascade="all, delete-orphan",
        order_by="PlacementTestJob.created_at.desc()",
    )
    ml_predictions = relationship(
        "MLPredictionLog",
        back_populates="campaign",
        cascade="all, delete-orphan",
        order_by="MLPredictionLog.created_at.desc()",
    )
    replies = relationship(
        "CampaignReply",
        back_populates="campaign",
        cascade="all, delete-orphan",
    )
    engagement_events = relationship(
        "CampaignEngagementEvent",
        back_populates="campaign",
        cascade="all, delete-orphan",
    )


class CampaignContent(Base):
    __tablename__ = "campaign_contents"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    campaign_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("campaigns.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    version: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    content_fingerprint: Mapped[str] = mapped_column(String(64), nullable=False, index=True)

    editor_mode: Mapped[str] = mapped_column(String(32), nullable=False, default="html_editor", server_default="html_editor")
    template_id: Mapped[str | None] = mapped_column(String(100), nullable=True)

    subject: Mapped[str] = mapped_column(String(500), nullable=False)
    preview_text: Mapped[str | None] = mapped_column(String(500), nullable=True)
    from_name: Mapped[str] = mapped_column(String(255), nullable=False)
    from_email: Mapped[str] = mapped_column(String(320), nullable=False)
    reply_to: Mapped[str | None] = mapped_column(String(320), nullable=True)
    receiver_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    receiver_email: Mapped[str | None] = mapped_column(String(320), nullable=True)
    html_content: Mapped[str] = mapped_column(Text, nullable=False)
    plain_text: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    campaign = relationship("Campaign", back_populates="contents")

    __table_args__ = (
        UniqueConstraint("campaign_id", "version", name="uq_campaign_contents_campaign_version"),
    )


class CampaignAudienceList(Base):
    __tablename__ = "campaign_audience_lists"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    campaign_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("campaigns.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    contact_list_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("contact_lists.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    added_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    campaign = relationship("Campaign", back_populates="audience_lists")
    contact_list = relationship("ContactList")

    __table_args__ = (
        UniqueConstraint("campaign_id", "contact_list_id", name="uq_campaign_audience_lists_pair"),
    )


class CampaignRecipientSnapshot(Base):
    __tablename__ = "campaign_recipient_snapshots"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    campaign_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("campaigns.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    lead_id: Mapped[int | None] = mapped_column(
        BigInteger,
        ForeignKey("leads.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    normalized_email: Mapped[str] = mapped_column(String(320), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="pending",
        server_default="pending",
        index=True,
    )
    dispatch_attempt_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    provider_message_id: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    delivered_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    opened_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    open_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    clicked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    click_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0, server_default="0")
    bounced_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    bounce_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    bounce_type: Mapped[str | None] = mapped_column(
        String(30),
        nullable=True,
        default="unknown",
        server_default="unknown",
        index=True,
    )
    is_bounce_listing_deleted: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        server_default="false",
        index=True,
    )
    replied_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    reply_subject: Mapped[str | None] = mapped_column(String(500), nullable=True)
    reply_snippet: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    campaign = relationship("Campaign", back_populates="recipient_snapshots")
    lead = relationship("Lead")
    replies = relationship("CampaignReply", back_populates="recipient_snapshot")
    engagement_events = relationship("CampaignEngagementEvent", back_populates="recipient_snapshot", cascade="all, delete-orphan")

    __table_args__ = (
        UniqueConstraint("campaign_id", "normalized_email", name="uq_campaign_recipient_email"),
    )


class CampaignReply(Base):
    __tablename__ = "campaign_replies"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    campaign_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("campaigns.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    recipient_snapshot_id: Mapped[int | None] = mapped_column(
        BigInteger,
        ForeignKey("campaign_recipient_snapshots.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    sender_email: Mapped[str] = mapped_column(String(320), nullable=False, index=True)
    recipient_email: Mapped[str] = mapped_column(String(320), nullable=False)
    subject: Mapped[str] = mapped_column(String(500), nullable=False)
    body_snippet: Mapped[str | None] = mapped_column(Text, nullable=True)
    message_id: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    in_reply_to: Mapped[str | None] = mapped_column(String(255), nullable=True, index=True)
    references_header: Mapped[str | None] = mapped_column(Text, nullable=True)
    provider_thread_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    received_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    match_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="in_reply_to",
        server_default="in_reply_to",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    campaign = relationship("Campaign", back_populates="replies")
    recipient_snapshot = relationship("CampaignRecipientSnapshot", back_populates="replies")


class CampaignEngagementEvent(Base):
    __tablename__ = "campaign_engagement_events"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    campaign_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("campaigns.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    recipient_snapshot_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("campaign_recipient_snapshots.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    event_type: Mapped[str] = mapped_column(String(30), nullable=False, index=True)
    event_id: Mapped[str | None] = mapped_column(String(255), nullable=True, unique=True)
    url: Mapped[str | None] = mapped_column(Text, nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(64), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    campaign = relationship("Campaign", back_populates="engagement_events")
    recipient_snapshot = relationship("CampaignRecipientSnapshot", back_populates="engagement_events")

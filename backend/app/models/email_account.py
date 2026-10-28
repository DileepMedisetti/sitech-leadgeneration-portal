from datetime import datetime
from sqlalchemy import BigInteger, Boolean, DateTime, ForeignKey, Index, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base


class EmailAccount(Base):
    """Represents a verified sender identity configured by an authenticated workspace user."""

    __tablename__ = "email_accounts"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    owner_user_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    email_address: Mapped[str] = mapped_column(String(320), nullable=False, index=True)
    normalized_email: Mapped[str] = mapped_column(String(320), nullable=False, index=True)
    from_name: Mapped[str] = mapped_column(String(255), nullable=False)
    receiver_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    receiver_email: Mapped[str | None] = mapped_column(String(320), nullable=True)
    reply_to: Mapped[str | None] = mapped_column(String(320), nullable=True)

    is_primary: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False, server_default="false")
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")

    # Verification status: 'pending', 'verified', 'failed'
    verification_status: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="pending",
        server_default="pending",
        index=True,
    )
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Provider status: 'not_configured', 'pending', 'ready', 'blocked'
    provider: Mapped[str] = mapped_column(String(50), nullable=False, default="smtp", server_default="smtp")
    provider_account_ref: Mapped[str | None] = mapped_column(String(255), nullable=True)
    provider_status: Mapped[str] = mapped_column(
        String(30),
        nullable=False,
        default="not_configured",
        server_default="not_configured",
        index=True,
    )

    last_used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True, index=True)

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

    # Relationships
    owner = relationship("User", back_populates="email_accounts")


Index(
    "ix_email_accounts_owner_email",
    EmailAccount.owner_user_id,
    EmailAccount.normalized_email,
)
Index(
    "uq_email_accounts_normalized_email",
    EmailAccount.normalized_email,
    unique=True,
)

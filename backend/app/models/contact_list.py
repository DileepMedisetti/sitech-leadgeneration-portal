
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
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base


class ContactList(Base):
    """Represents a curated list of contacts (references to qualified leads)."""

    __tablename__ = "contact_lists"

    id: Mapped[int] = mapped_column(
        BigInteger,
        primary_key=True,
        autoincrement=True,
    )

    name: Mapped[str] = mapped_column(
        String(255),
        nullable=False,
    )

    description: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
    )

    list_type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="custom",
        server_default="custom",
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

    # Relationships
    memberships = relationship(
        "ContactListMember",
        back_populates="contact_list",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


# Case-insensitive unique index on list name to prevent duplicate lists
Index(
    "ix_contact_lists_lower_name",
    func.lower(ContactList.name),
    unique=True,
)
Index("ix_contact_lists_created_at", ContactList.created_at)
Index("ix_contact_lists_updated_at", ContactList.updated_at)


class ContactListMember(Base):
    """Represents membership of an eligible lead inside a contact list.

    Enforces duplicate-email prevention across leads within the same list.
    Deleting a membership or list NEVER deletes the underlying lead record.
    """

    __tablename__ = "contact_list_members"

    id: Mapped[int] = mapped_column(
        BigInteger,
        primary_key=True,
        autoincrement=True,
    )

    list_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("contact_lists.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    lead_id: Mapped[int] = mapped_column(
        BigInteger,
        ForeignKey("leads.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )

    normalized_email: Mapped[str] = mapped_column(
        String(320),
        nullable=False,
        index=True,
    )

    added_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    # Relationships
    contact_list = relationship(
        "ContactList",
        back_populates="memberships",
    )

    lead = relationship(
        "Lead",
    )

    __table_args__ = (
        # Prevent the same lead ID from being added to the same list twice
        UniqueConstraint("list_id", "lead_id", name="uq_contact_list_members_list_lead"),
        # Prevent the same normalized email from being added twice to the same list
        UniqueConstraint("list_id", "normalized_email", name="uq_contact_list_members_list_email"),
        Index("ix_contact_list_members_added_at", "added_at"),
    )

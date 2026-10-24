from typing import Sequence, Tuple
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.email_account import EmailAccount


def is_account_eligible_sender(account: EmailAccount) -> bool:
    """Verifies all mandatory conditions for a sender account:

    1. Must be active (is_active == True)
    2. Must be verified (verification_status == 'verified')
    3. Provider readiness must be ready (provider_status == 'ready')
    4. Must not be archived/deleted (archived_at is None)
    """
    return (
        account.is_active is True
        and account.verification_status == "verified"
        and account.provider_status == "ready"
        and account.archived_at is None
    )


def get_eligible_sender_accounts(
    db: Session,
    user_id: int,
) -> Sequence[EmailAccount]:
    """Retrieves all eligible sender accounts owned by the given user."""
    stmt = (
        select(EmailAccount)
        .where(
            EmailAccount.owner_user_id == user_id,
            EmailAccount.is_active == True,
            EmailAccount.verification_status == "verified",
            EmailAccount.provider_status == "ready",
            EmailAccount.archived_at.is_(None),
        )
        .order_by(EmailAccount.email_address.asc())
    )
    return db.scalars(stmt).all()


def validate_sender_eligibility(
    db: Session,
    from_email: str,
    user_id: int | None = None,
) -> Tuple[bool, str]:
    """Validates if the provided sender email is eligible for campaign delivery.

    Returns (is_eligible: bool, error_reason: str).
    """
    clean_email = from_email.strip().lower()

    stmt = select(EmailAccount).where(
        EmailAccount.normalized_email == clean_email,
        EmailAccount.archived_at.is_(None),
    )
    if user_id is not None:
        stmt = stmt.where(EmailAccount.owner_user_id == user_id)

    account = db.scalar(stmt)
    if not account:
        return False, f"Sender identity '{clean_email}' is not a registered email account in your workspace."

    if not account.is_active:
        return False, f"Sender account '{clean_email}' is deactivated. Please activate it in Email Accounts."

    if account.verification_status != "verified":
        return False, f"Sender account '{clean_email}' is not verified (status: {account.verification_status})."

    if account.provider_status != "ready":
        return False, f"Sender account '{clean_email}' provider status is '{account.provider_status}'. Provider must be ready."

    return True, "Sender account is verified and eligible."

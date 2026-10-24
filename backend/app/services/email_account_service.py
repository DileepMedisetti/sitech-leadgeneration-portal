from datetime import datetime, timedelta, timezone
import logging
from typing import Sequence
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.security import (
    generate_salt,
    generate_six_digit_otp,
    hash_otp,
    verify_otp_hash,
)
from app.models.email_account import EmailAccount
from app.models.otp_challenge import OtpChallenge
from app.models.user import User
from app.schemas.email_account import EmailAccountCreate, EmailAccountUpdate
from app.services.email_delivery_service import EmailDeliveryService

logger = logging.getLogger(__name__)

CONNECT_OTP_EXPIRATION_MINUTES = 10
RESEND_COOLDOWN_SECONDS = 60


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def ensure_primary_email_account(db: Session, user: User) -> EmailAccount:
    """Ensures the authenticated user's registered login email is represented in EmailAccount.

    Idempotent: Reuses existing record if present; never creates duplicates.
    """
    account = db.scalar(
        select(EmailAccount).where(
            EmailAccount.owner_user_id == user.id,
            EmailAccount.normalized_email == user.normalized_email,
        )
    )

    now = _utc_now()
    if not account:
        account = EmailAccount(
            owner_user_id=user.id,
            email_address=user.email,
            normalized_email=user.normalized_email,
            from_name=user.display_name or user.email.split("@")[0].capitalize(),
            is_primary=True,
            is_active=True,
            verification_status="verified",
            verified_at=user.created_at or now,
            provider="smtp",
            provider_status="ready",
            created_at=now,
            updated_at=now,
        )
        db.add(account)
        db.flush()
    else:
        # Guarantee is_primary flag is accurate
        if not account.is_primary:
            account.is_primary = True
            db.flush()

    return account


def list_user_accounts(db: Session, user_id: int) -> Sequence[EmailAccount]:
    """Retrieves all non-archived email accounts owned by the user.

    Automatically ensures primary login email exists and orders it first.
    """
    user = db.get(User, user_id)
    if user:
        ensure_primary_email_account(db, user)

    stmt = (
        select(EmailAccount)
        .where(
            EmailAccount.owner_user_id == user_id,
            EmailAccount.archived_at.is_(None),
        )
        .order_by(EmailAccount.is_primary.desc(), EmailAccount.created_at.desc())
    )
    return db.scalars(stmt).all()


def list_archived_accounts(db: Session, user_id: int) -> Sequence[EmailAccount]:
    """Retrieves all archived/deleted email accounts belonging strictly to the user."""
    stmt = (
        select(EmailAccount)
        .where(
            EmailAccount.owner_user_id == user_id,
            EmailAccount.archived_at.is_not(None),
        )
        .order_by(EmailAccount.archived_at.desc())
    )
    return db.scalars(stmt).all()


def get_user_account(db: Session, user_id: int, account_id: int, include_archived: bool = False) -> EmailAccount:
    """Retrieves a specific email account, strictly enforcing tenant ownership."""
    account = db.get(EmailAccount, account_id)
    if not account:
        raise ValueError("Email account not found.")

    if not include_archived and account.archived_at is not None:
        raise ValueError("Email account not found or has been archived.")

    if account.owner_user_id != user_id:
        raise PermissionError("Access denied: You do not have permission to view or manage this account.")

    return account


def check_global_email_availability(db: Session, user_id: int, email: str) -> dict:
    """Checks whether an email is available for the user to connect.

    Enforces global ownership across all users' login emails and connected email accounts.
    """
    clean_email = email.strip()
    normalized_email = clean_email.lower()

    # 1. Check against other users' registered primary login email
    other_user = db.scalar(
        select(User).where(
            User.normalized_email == normalized_email,
            User.id != user_id,
        )
    )
    if other_user:
        return {
            "available": False,
            "status": "email_in_use",
            "message": "This email address is already in use by another account. Please use a different email address.",
        }

    # 2. Check against other users' connected email accounts (active, inactive, or archived)
    other_account = db.scalar(
        select(EmailAccount).where(
            EmailAccount.normalized_email == normalized_email,
            EmailAccount.owner_user_id != user_id,
        )
    )
    if other_account:
        return {
            "available": False,
            "status": "email_in_use",
            "message": "This email address is already in use by another account. Please use a different email address.",
        }

    # 3. Check against current user's existing email accounts
    current_account = db.scalar(
        select(EmailAccount).where(
            EmailAccount.normalized_email == normalized_email,
            EmailAccount.owner_user_id == user_id,
        )
    )
    if current_account:
        if current_account.archived_at is not None:
            return {
                "available": False,
                "status": "already_archived",
                "account_id": current_account.id,
                "message": "This email address was previously deleted. You can restore it from Deleted Accounts.",
            }
        elif not current_account.is_active:
            return {
                "available": False,
                "status": "already_inactive",
                "account_id": current_account.id,
                "message": "This email address is already connected to your workspace but is deactivated. You can activate it.",
            }
        else:
            return {
                "available": False,
                "status": "already_active",
                "account_id": current_account.id,
                "message": "This email address is already connected and active in your workspace.",
            }

    # 4. Check against current user's primary login email
    current_user = db.get(User, user_id)
    if current_user and current_user.normalized_email == normalized_email:
        return {
            "available": False,
            "status": "already_active",
            "message": "This email address is already connected as your primary login email.",
        }

    return {
        "available": True,
        "status": "available",
        "message": "Email address is available for connection.",
    }


def request_connect_email_code(
    db: Session,
    user_id: int,
    email: str,
    from_name: str,
    email_service: EmailDeliveryService | None = None,
) -> dict:
    """Initiates an ownership verification challenge for connecting an email to the workspace."""
    clean_email = email.strip()
    normalized_email = clean_email.lower()
    now = _utc_now()
    service = email_service or EmailDeliveryService()

    # Enforce global availability
    check_result = check_global_email_availability(db, user_id, clean_email)
    if not check_result["available"]:
        raise ValueError(check_result["message"])

    # Check cooldown
    latest_challenge = db.scalar(
        select(OtpChallenge)
        .where(OtpChallenge.normalized_email == normalized_email)
        .order_by(OtpChallenge.created_at.desc())
        .limit(1)
    )
    if latest_challenge:
        time_since = (now - latest_challenge.created_at).total_seconds()
        if time_since < RESEND_COOLDOWN_SECONDS and not latest_challenge.is_consumed:
            wait_sec = int(RESEND_COOLDOWN_SECONDS - time_since)
            return {
                "status": "rate_limited",
                "message": f"Please wait {wait_sec} second(s) before requesting another verification code.",
                "cooldown_remaining_seconds": wait_sec,
            }
        if not latest_challenge.is_consumed:
            latest_challenge.is_consumed = True
            latest_challenge.consumed_at = now

    plain_otp = generate_six_digit_otp()
    salt = generate_salt()
    otp_hash = hash_otp(plain_otp, salt)
    expires_at = now + timedelta(minutes=CONNECT_OTP_EXPIRATION_MINUTES)

    challenge = OtpChallenge(
        email=clean_email,
        normalized_email=normalized_email,
        otp_hash=otp_hash,
        salt=salt,
        attempts_count=0,
        expires_at=expires_at,
        created_at=now,
    )

    db.add(challenge)
    db.flush()

    sent_ok, provider_msg = service.send_otp_email(clean_email, plain_otp)
    if not sent_ok:
        db.rollback()
        raise RuntimeError(f"Failed to deliver verification code: {provider_msg}")

    return {
        "status": "code_sent",
        "email_address": clean_email,
        "message": f"A six-digit verification code has been sent to {clean_email}.",
    }


def verify_connect_email_code(
    db: Session,
    user_id: int,
    email: str,
    from_name: str,
    otp_code: str,
) -> EmailAccount:
    """Verifies ownership OTP and connects the verified email identity to the user's workspace."""
    clean_email = email.strip()
    normalized_email = clean_email.lower()
    now = _utc_now()

    # Re-verify availability inside the transaction
    check_result = check_global_email_availability(db, user_id, clean_email)
    if not check_result["available"]:
        raise ValueError(check_result["message"])

    # Retrieve challenge
    challenge = db.scalar(
        select(OtpChallenge)
        .where(
            OtpChallenge.normalized_email == normalized_email,
            OtpChallenge.is_consumed == False,
        )
        .order_by(OtpChallenge.created_at.desc())
        .limit(1)
    )

    if not challenge:
        raise ValueError("No active verification challenge found. Please request a new code.")

    if now > challenge.expires_at:
        challenge.is_consumed = True
        challenge.consumed_at = now
        db.flush()
        raise ValueError("The verification code has expired. Please request a new code.")

    is_valid = verify_otp_hash(otp_code, challenge.salt, challenge.otp_hash)
    if not is_valid:
        challenge.attempts_count += 1
        db.flush()
        raise ValueError("Incorrect verification code. Please check your email and try again.")

    # Mark consumed
    challenge.is_consumed = True
    challenge.consumed_at = now

    # Create verified, active EmailAccount
    account = EmailAccount(
        owner_user_id=user_id,
        email_address=clean_email,
        normalized_email=normalized_email,
        from_name=from_name.strip(),
        is_primary=False,
        is_active=True,
        verification_status="verified",
        verified_at=now,
        last_verified_at=now,
        provider="smtp",
        provider_status="ready",
        created_at=now,
        updated_at=now,
    )
    db.add(account)
    db.flush()
    return account


def create_account(db: Session, user_id: int, payload: EmailAccountCreate) -> EmailAccount:
    """Creates a new sender email account identity for the authenticated user."""
    clean_email = str(payload.email_address).strip()
    normalized_email = clean_email.lower()

    check_result = check_global_email_availability(db, user_id, clean_email)
    if not check_result["available"]:
        raise ValueError(check_result["message"])

    now = _utc_now()
    account = EmailAccount(
        owner_user_id=user_id,
        email_address=clean_email,
        normalized_email=normalized_email,
        from_name=payload.from_name.strip(),
        provider=payload.provider.strip(),
        provider_account_ref=payload.provider_account_ref.strip() if payload.provider_account_ref else None,
        is_primary=False,
        is_active=True,
        verification_status="pending",
        provider_status="not_configured",
        created_at=now,
        updated_at=now,
    )
    db.add(account)
    db.flush()
    return account


def update_account(
    db: Session,
    user_id: int,
    account_id: int,
    payload: EmailAccountUpdate,
) -> EmailAccount:
    """Updates permitted mutable fields on an owned email account."""
    account = get_user_account(db, user_id, account_id)

    if payload.from_name is not None:
        account.from_name = payload.from_name.strip()
    if payload.is_active is not None:
        if not payload.is_active:
            # Enforce safeguard: cannot deactivate if it's the only viable login email
            _enforce_viable_login_email_remains(db, user_id, account_id)
        account.is_active = payload.is_active

    account.updated_at = _utc_now()
    db.flush()
    return account


def _enforce_viable_login_email_remains(db: Session, user_id: int, account_id_being_disabled: int):
    """Safeguard: Verifies that deactivating or archiving this account does not leave the user without a login email."""
    user = db.get(User, user_id)
    if user:
        ensure_primary_email_account(db, user)

    # Count other verified, active, non-archived email accounts
    viable_others = db.scalar(
        select(func.count(EmailAccount.id)).where(
            EmailAccount.owner_user_id == user_id,
            EmailAccount.id != account_id_being_disabled,
            EmailAccount.is_active == True,
            EmailAccount.verification_status == "verified",
            EmailAccount.archived_at.is_(None),
        )
    ) or 0

    if viable_others == 0:
        raise ValueError(
            "Cannot deactivate this email. You must have at least one active, verified email for login."
        )


def activate_account(db: Session, user_id: int, account_id: int) -> EmailAccount:
    """Activates an owned email account.

    Safeguard: Never allows an unverified email to become active or login-eligible.
    """
    account = get_user_account(db, user_id, account_id)
    if account.verification_status != "verified":
        raise ValueError("Cannot activate unverified email account. Please verify ownership first.")

    account.is_active = True
    account.updated_at = _utc_now()
    db.flush()
    return account


def deactivate_account(db: Session, user_id: int, account_id: int) -> EmailAccount:
    """Deactivates an owned email account with safeguard against removing all login options."""
    account = get_user_account(db, user_id, account_id)
    _enforce_viable_login_email_remains(db, user_id, account_id)

    account.is_active = False
    account.updated_at = _utc_now()
    db.flush()
    return account


def archive_account(db: Session, user_id: int, account_id: int) -> EmailAccount:
    """Soft-deletes/archives an account so historical campaigns remain intact."""
    account = get_user_account(db, user_id, account_id)

    if account.is_primary:
        raise ValueError("The primary login email cannot be deleted. Please connect another account first.")

    _enforce_viable_login_email_remains(db, user_id, account_id)

    now = _utc_now()
    account.archived_at = now
    account.is_active = False
    account.updated_at = now
    db.flush()
    return account


def restore_account(db: Session, user_id: int, account_id: int) -> EmailAccount:
    """Restores an archived email account.

    Restores as inactive by default for safety.
    """
    account = get_user_account(db, user_id, account_id, include_archived=True)
    if account.archived_at is None:
        raise ValueError("Email account is not archived.")

    # Re-check uniqueness in case another user claimed or conflict arose
    check_result = check_global_email_availability(db, user_id, account.email_address)
    if not check_result["available"] and check_result.get("status") == "email_in_use":
        raise ValueError(check_result["message"])

    account.archived_at = None
    account.is_active = False  # restored safely as inactive
    account.updated_at = _utc_now()
    db.flush()
    return account


def permanently_delete_account(db: Session, user_id: int, account_id: int) -> None:
    """Permanently deletes an archived email account record.

    Only archived accounts may be permanently deleted.
    """
    account = get_user_account(db, user_id, account_id, include_archived=True)
    if account.archived_at is None:
        raise ValueError("Only archived email accounts can be permanently deleted. Please delete the account first.")

    if account.is_primary:
        raise ValueError("Primary login email cannot be permanently deleted.")

    db.delete(account)
    db.flush()


def verify_account(db: Session, user_id: int, account_id: int) -> EmailAccount:
    """Transitions verification status to verified and provider readiness to ready."""
    account = get_user_account(db, user_id, account_id)
    now = _utc_now()
    account.verification_status = "verified"
    account.verified_at = now
    account.last_verified_at = now
    account.provider_status = "ready"
    account.updated_at = now
    db.flush()
    return account

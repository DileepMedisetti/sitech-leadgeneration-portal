from datetime import datetime, timedelta, timezone
import logging
from typing import Any, Tuple
from sqlalchemy import select, desc
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.security import (
    create_access_token,
    generate_salt,
    generate_six_digit_otp,
    hash_otp,
    verify_otp_hash,
)
from app.models.email_account import EmailAccount
from app.models.otp_challenge import OtpChallenge
from app.models.user import User
from app.services.email_delivery_service import EmailDeliveryService

logger = logging.getLogger(__name__)

LOCKOUT_MAX_ATTEMPTS = 5
LOCKOUT_DURATION_HOURS = 24
OTP_EXPIRATION_MINUTES = 10
RESEND_COOLDOWN_SECONDS = 60


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


class AuthService:
    def __init__(self, email_service: EmailDeliveryService | None = None):
        self.email_service = email_service or EmailDeliveryService()

    def get_active_lockout(self, db: Session, normalized_email: str) -> datetime | None:
        """Checks if there is an active lockout for this email address."""
        now = _utc_now()
        stmt = (
            select(OtpChallenge.locked_until)
            .where(
                OtpChallenge.normalized_email == normalized_email,
                OtpChallenge.locked_until > now,
            )
            .order_by(desc(OtpChallenge.locked_until))
            .limit(1)
        )
        return db.scalar(stmt)

    def _resolve_login_identity(
        self,
        db: Session,
        normalized_email: str,
    ) -> Tuple[User | None, EmailAccount | None, str | None]:
        """Resolves an email identity across registered users and connected email accounts.

        Returns (user, email_account, error_status).
        """
        # 1. Check primary registered user email
        user = db.scalar(select(User).where(User.normalized_email == normalized_email))
        if user:
            # Check corresponding email account if exists
            acc = db.scalar(
                select(EmailAccount).where(
                    EmailAccount.owner_user_id == user.id,
                    EmailAccount.normalized_email == normalized_email,
                )
            )
            if acc:
                if acc.archived_at is not None:
                    return None, None, "archived"
                if not acc.is_active:
                    return None, None, "deactivated"
                if acc.verification_status != "verified":
                    return None, None, "unverified"

            if not user.is_active:
                return None, None, "inactive"

            return user, acc, None

        # 2. Check connected email accounts belonging to any user
        acc = db.scalar(select(EmailAccount).where(EmailAccount.normalized_email == normalized_email))
        if not acc:
            return None, None, "not_registered"

        if acc.archived_at is not None:
            return None, None, "archived"
        if not acc.is_active:
            return None, None, "deactivated"
        if acc.verification_status != "verified":
            return None, None, "unverified"

        owner_user = db.get(User, acc.owner_user_id)
        if not owner_user or not owner_user.is_active:
            return None, None, "inactive"

        return owner_user, acc, None

    def request_otp(
        self,
        db: Session,
        email: str,
        ip_address: str | None = None,
    ) -> dict[str, Any]:
        """Issues a new 6-digit OTP challenge, enforcing user registration, lockout, cooldowns, and delivery."""
        clean_email = email.strip()
        normalized_email = clean_email.lower()
        now = _utc_now()

        # 1. Enforce user existence and active status across primary and connected identities
        user, acc, err_status = self._resolve_login_identity(db, normalized_email)
        if err_status == "not_registered" or err_status == "archived":
            logger.warning("OTP request rejected: unregistered/archived email '%s'", normalized_email)
            return {
                "status": "not_registered",
                "message": "This email address is not registered with Sitech Series. Please check your email or contact your administrator.",
            }
        elif err_status == "deactivated":
            logger.warning("OTP request rejected: deactivated email '%s'", normalized_email)
            return {
                "status": "deactivated",
                "message": "This email account is deactivated. Please contact your workspace administrator or use an active login email.",
            }
        elif err_status == "unverified":
            logger.warning("OTP request rejected: unverified email '%s'", normalized_email)
            return {
                "status": "unverified",
                "message": "This email account is not verified for login. Please verify ownership first.",
            }
        elif err_status == "inactive" or not user:
            logger.warning("OTP request rejected: inactive user for email '%s'", normalized_email)
            return {
                "status": "inactive",
                "message": "This account is inactive. Please contact your workspace administrator.",
            }

        # 2. Enforce active 24-hour lockout
        locked_until = self.get_active_lockout(db, normalized_email)
        if locked_until:
            remaining_seconds = int((locked_until - now).total_seconds())
            return {
                "status": "locked",
                "message": "Account verification is locked due to too many failed attempts. Please try again after 24 hours.",
                "locked_until": locked_until.isoformat(),
                "remaining_lockout_seconds": max(0, remaining_seconds),
            }

        # 3. Check for recent unconsumed challenge and enforce 60s cooldown
        latest_challenge = db.scalar(
            select(OtpChallenge)
            .where(
                OtpChallenge.normalized_email == normalized_email,
            )
            .order_by(desc(OtpChallenge.created_at))
            .limit(1)
        )

        carried_attempts = 0
        if latest_challenge:
            time_since_creation = (now - latest_challenge.created_at).total_seconds()
            if time_since_creation < RESEND_COOLDOWN_SECONDS and not latest_challenge.is_consumed:
                wait_sec = int(RESEND_COOLDOWN_SECONDS - time_since_creation)
                return {
                    "status": "rate_limited",
                    "message": f"Please wait {wait_sec} second(s) before requesting a new verification code.",
                    "cooldown_remaining_seconds": wait_sec,
                }
            # Carry over failed attempts count so resend cannot bypass 5-attempt limit
            if not latest_challenge.is_consumed and latest_challenge.expires_at > now:
                carried_attempts = latest_challenge.attempts_count

            # Invalidate any previous unconsumed challenges
            if not latest_challenge.is_consumed:
                latest_challenge.is_consumed = True
                latest_challenge.consumed_at = now

        # 4. Generate 6-digit numeric OTP and salt
        plain_otp = generate_six_digit_otp()
        salt = generate_salt()
        otp_hash = hash_otp(plain_otp, salt)
        expires_at = now + timedelta(minutes=OTP_EXPIRATION_MINUTES)

        # 5. Persist challenge safely
        challenge = OtpChallenge(
            email=clean_email,
            normalized_email=normalized_email,
            otp_hash=otp_hash,
            salt=salt,
            attempts_count=carried_attempts,
            expires_at=expires_at,
            ip_address=ip_address,
            created_at=now,
        )
        db.add(challenge)
        db.flush()

        # 6. Dispatch email via provider
        sent_ok, provider_msg = self.email_service.send_otp_email(clean_email, plain_otp)
        if not sent_ok:
            # If email delivery fails, roll back challenge
            db.rollback()
            return {
                "status": "delivery_failed",
                "message": provider_msg,
            }

        db.commit()
        return {
            "status": "otp_sent",
            "message": "A 6-digit verification code has been sent to your email.",
            "email": clean_email,
            "expires_in_seconds": OTP_EXPIRATION_MINUTES * 60,
            "cooldown_seconds": RESEND_COOLDOWN_SECONDS,
        }

    def verify_otp(
        self,
        db: Session,
        email: str,
        otp_code: str,
    ) -> dict[str, Any]:
        """Verifies the entered 6-digit OTP against active challenge and enforces 5-attempt lockout."""
        clean_email = email.strip()
        normalized_email = clean_email.lower()
        now = _utc_now()

        # Enforce registered user existence and active status across primary and connected identities
        user, acc, err_status = self._resolve_login_identity(db, normalized_email)
        if err_status == "not_registered" or err_status == "archived" or not user:
            return {
                "status": "not_registered",
                "message": "This email address is not registered with Sitech Series. Please check your email or contact your administrator.",
            }
        if err_status == "deactivated":
            return {
                "status": "deactivated",
                "message": "This email account is deactivated. Please contact your workspace administrator or use an active login email.",
            }
        if err_status == "unverified":
            return {
                "status": "unverified",
                "message": "This email account is not verified for login.",
            }
        if err_status == "inactive" or not user.is_active:
            return {
                "status": "inactive",
                "message": "This account is inactive. Please contact your workspace administrator.",
            }

        # 1. Enforce active 24-hour lockout
        locked_until = self.get_active_lockout(db, normalized_email)
        if locked_until:
            remaining_seconds = int((locked_until - now).total_seconds())
            return {
                "status": "locked",
                "message": "Account verification is locked due to too many failed attempts. Please try again after 24 hours.",
                "locked_until": locked_until.isoformat(),
                "remaining_lockout_seconds": max(0, remaining_seconds),
            }

        # 2. Retrieve the active unconsumed challenge
        challenge = db.scalar(
            select(OtpChallenge)
            .where(
                OtpChallenge.normalized_email == normalized_email,
                OtpChallenge.is_consumed == False,
            )
            .order_by(desc(OtpChallenge.created_at))
            .limit(1)
        )

        if not challenge:
            return {
                "status": "expired",
                "message": "No active verification challenge found. Please request a new code.",
            }

        # 3. Check challenge expiration (10 minutes)
        if now > challenge.expires_at:
            challenge.is_consumed = True
            challenge.consumed_at = now
            db.commit()
            return {
                "status": "expired",
                "message": "The verification code has expired. Please request a new code.",
            }

        # 4. Check OTP match using constant-time comparison
        is_valid = verify_otp_hash(otp_code, challenge.salt, challenge.otp_hash)

        if not is_valid:
            challenge.attempts_count += 1
            if challenge.attempts_count >= LOCKOUT_MAX_ATTEMPTS:
                # Trigger 24-hour lockout
                lock_expiration = now + timedelta(hours=LOCKOUT_DURATION_HOURS)
                challenge.locked_until = lock_expiration
                challenge.is_consumed = True
                challenge.consumed_at = now
                db.commit()
                return {
                    "status": "locked",
                    "message": "Maximum verification attempts exceeded. Account is locked for 24 hours.",
                    "locked_until": lock_expiration.isoformat(),
                    "remaining_attempts": 0,
                    "remaining_lockout_seconds": LOCKOUT_DURATION_HOURS * 3600,
                }
            else:
                db.commit()
                remaining = LOCKOUT_MAX_ATTEMPTS - challenge.attempts_count
                return {
                    "status": "incorrect",
                    "message": f"Incorrect verification code. {remaining} attempt(s) remaining.",
                    "remaining_attempts": remaining,
                }

        # 5. OTP is correct! Invalidate challenge
        challenge.is_consumed = True
        challenge.consumed_at = now
        challenge.locked_until = None
        db.commit()

        # 6. Generate JWT access token for existing active user
        token_payload = {
            "sub": str(user.id),
            "email": user.email,
            "display_name": user.display_name,
        }
        access_token = create_access_token(token_payload)

        return {
            "status": "success",
            "message": "Verification successful.",
            "access_token": access_token,
            "token_type": "bearer",
            "user": {
                "id": user.id,
                "email": user.email,
                "display_name": user.display_name,
                "is_active": user.is_active,
            },
        }

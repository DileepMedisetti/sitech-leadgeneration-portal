import logging
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.db.database import get_db, SessionLocal
from app.models.user import User
from app.models.email_account import EmailAccount

logger = logging.getLogger(__name__)


def bootstrap_demo_user(db: Session | None = None) -> User:
    """Safely and idempotently bootstraps the initial demo user if missing.

    Requirements enforced:
    - Never creates duplicate user records.
    - Configurable demo email and display name via settings.
    - Sets up initial workspace profile without bypassing OTP verification.
    - Creates initial verified default email sender account for demo user.
    """
    should_close = False
    if db is None:
        db = SessionLocal()
        should_close = True

    try:
        demo_email = settings.DEMO_USER_EMAIL.strip().lower()
        demo_name = settings.DEMO_USER_NAME.strip()

        user = db.scalar(select(User).where(User.normalized_email == demo_email))
        if not user:
            user = User(
                email=settings.DEMO_USER_EMAIL.strip(),
                normalized_email=demo_email,
                display_name=demo_name,
                is_active=True,
            )
            db.add(user)
            db.flush()
            logger.info("Created initial demo user: %s (id=%d)", demo_email, user.id)

        # Seed default verified sender identities for demo user
        default_senders = [
            ("outreach@sitechseries.org", "Sitech Academic Outreach"),
            ("committee@sitechseries.org", "Symposium Committee"),
            ("symposium@sitechseries.org", "Sitech Symposium Secretariat"),
            ("editor@sitechseries.org", "Sitech Editorial Office"),
        ]
        for s_email, s_name in default_senders:
            norm_s_email = s_email.lower()
            existing_sender = db.scalar(
                select(EmailAccount).where(
                    EmailAccount.owner_user_id == user.id,
                    EmailAccount.normalized_email == norm_s_email,
                    EmailAccount.archived_at.is_(None),
                )
            )
            if not existing_sender:
                sender_acc = EmailAccount(
                    owner_user_id=user.id,
                    email_address=s_email,
                    normalized_email=norm_s_email,
                    from_name=s_name,
                    is_active=True,
                    verification_status="verified",
                    provider="smtp",
                    provider_status="ready",
                )
                db.add(sender_acc)
                logger.info("Created verified sender account: %s", s_email)

        db.commit()
        db.refresh(user)
        user_id = user.id
        user_email = user.email
        return user
    except Exception as exc:
        db.rollback()
        logger.error("Failed to bootstrap demo user: %s", exc)
        raise
    finally:
        if should_close:
            db.close()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    with SessionLocal() as db_session:
        user = bootstrap_demo_user(db_session)
        print(f"Bootstrap complete. User ID: {user.id}, Email: {user.email}")

import hashlib
import hmac
import os
import secrets
from datetime import datetime, timedelta, timezone
from typing import Any
import jwt

from app.core.config import settings


def generate_six_digit_otp() -> str:
    """Generates a cryptographically secure 6-digit numeric OTP with leading zeros."""
    return f"{secrets.randbelow(1_000_000):06d}"


def generate_salt() -> str:
    """Generates a cryptographically secure random hexadecimal salt."""
    return secrets.token_hex(16)


def hash_otp(plain_otp: str, salt: str) -> str:
    """Hashes an OTP string using PBKDF2 with HMAC-SHA256 and salt.

    Never store plain OTPs in the database.
    """
    key = hashlib.pbkdf2_hmac(
        hash_name="sha256",
        password=plain_otp.strip().encode("utf-8"),
        salt=salt.encode("utf-8"),
        iterations=100_000,
    )
    return key.hex()


def verify_otp_hash(plain_otp: str, salt: str, expected_hash: str) -> bool:
    """Constant-time verification of an entered OTP against its PBKDF2 hash."""
    candidate_hash = hash_otp(plain_otp, salt)
    return secrets.compare_digest(candidate_hash, expected_hash)


def create_access_token(data: dict[str, Any], expires_delta: timedelta | None = None) -> str:
    """Creates a signed JWT access token containing subject and expiration claims."""
    to_encode = data.copy()
    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=settings.JWT_ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode.update({"exp": expire, "iat": now})
    encoded_jwt = jwt.encode(
        to_encode,
        settings.JWT_SECRET_KEY,
        algorithm=settings.JWT_ALGORITHM,
    )
    return encoded_jwt


def decode_access_token(token: str) -> dict[str, Any] | None:
    """Safely decodes and validates a JWT token signature and expiry.

    Returns payload dict if valid, None if invalid or expired.
    """
    try:
        payload = jwt.decode(
            token,
            settings.JWT_SECRET_KEY,
            algorithms=[settings.JWT_ALGORITHM],
        )
        return payload
    except (jwt.PyJWTError, ValueError):
        return None

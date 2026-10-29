from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.dependencies.current_user import get_current_user
from app.db.database import get_db
from app.models.email_account import EmailAccount
from app.models.user import User
from app.schemas.auth import (
    LogoutResponse,
    RequestOtpRequest,
    RequestOtpResponse,
    UserResponse,
    VerifyOtpRequest,
    VerifyOtpResponse,
)
from app.services.auth_service import AuthService

router = APIRouter(prefix="/api/auth", tags=["Authentication"])
auth_service = AuthService()


@router.post("/request-otp", response_model=RequestOtpResponse)
def request_otp_endpoint(
    payload: RequestOtpRequest,
    request: Request,
    db: Session = Depends(get_db),
):
    """Initiates an email OTP challenge with 10-minute validity and rate limiting."""
    client_ip = request.client.host if request.client else None
    result = auth_service.request_otp(
        db=db,
        email=str(payload.email),
        ip_address=client_ip,
    )

    if result.get("status") == "not_registered":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=result,
        )
    if result.get("status") in ("inactive", "deactivated", "unverified"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=result,
        )
    if result.get("status") == "locked":
        raise HTTPException(
            status_code=status.HTTP_423_LOCKED,
            detail=result,
        )
    if result.get("status") == "rate_limited":
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=result,
        )
    if result.get("status") == "delivery_failed":
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=result,
        )

    return result


@router.post("/verify-otp", response_model=VerifyOtpResponse)
def verify_otp_endpoint(
    payload: VerifyOtpRequest,
    response: Response,
    db: Session = Depends(get_db),
):
    """Verifies the 6-digit OTP, enforces the 5-attempt lockout, and establishes session."""
    result = auth_service.verify_otp(
        db=db,
        email=str(payload.email),
        otp_code=payload.otp_code,
    )

    status_name = result.get("status")
    if status_name == "not_registered":
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=result,
        )
    elif status_name in ("inactive", "deactivated", "unverified"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=result,
        )
    elif status_name == "locked":
        raise HTTPException(
            status_code=status.HTTP_423_LOCKED,
            detail=result,
        )
    elif status_name == "expired":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result,
        )
    elif status_name == "incorrect":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=result,
        )

    # Success: set HttpOnly session cookie
    access_token = result.get("access_token")
    if access_token:
        response.set_cookie(
            key="access_token",
            value=access_token,
            httponly=True,
            samesite="lax",
            secure=False,  # Set to True in HTTPS production
            max_age=86400,
        )

    return result


@router.get("/me", response_model=UserResponse)
def get_current_user_profile(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieves safe profile details and email account count for the current user."""
    accounts_count = db.scalar(
        select(func.count(EmailAccount.id)).where(
            EmailAccount.owner_user_id == current_user.id,
            EmailAccount.archived_at.is_(None),
        )
    ) or 0

    return UserResponse(
        id=current_user.id,
        email=current_user.email,
        display_name=current_user.display_name,
        is_active=current_user.is_active,
        email_accounts_count=accounts_count,
    )


@router.post("/logout", response_model=LogoutResponse)
def logout_endpoint(
    response: Response,
    current_user: User = Depends(get_current_user),
):
    """Invalidates the session cookie and signs out the current user."""
    response.delete_cookie(key="access_token")
    return LogoutResponse(
        status="logged_out",
        message="Session successfully terminated.",
    )

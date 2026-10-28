from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.dependencies.current_user import get_current_user
from app.db.database import get_db
from app.models.user import User
from app.schemas.email_account import (
    AccountActionResponse,
    ConnectEmailConfirmRequest,
    ConnectEmailRequest,
    ConnectEmailResponse,
    EmailAccountCreate,
    EmailAccountResponse,
    EmailAccountUpdate,
)
from app.services.email_account_service import (
    activate_account,
    archive_account,
    create_account,
    deactivate_account,
    get_user_account,
    list_archived_accounts,
    list_user_accounts,
    permanently_delete_account,
    request_connect_email_code,
    restore_account,
    update_account,
    verify_account,
    verify_connect_email_code,
)
from app.services.sender_eligibility_service import is_account_eligible_sender

router = APIRouter(prefix="/api/email-accounts", tags=["Email Accounts"])


def _to_response_dto(account) -> EmailAccountResponse:
    dto = EmailAccountResponse.model_validate(account)
    dto.is_eligible_sender = is_account_eligible_sender(account)
    return dto


@router.get("", response_model=list[EmailAccountResponse])
def get_email_accounts_endpoint(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List all sender email accounts owned by the authenticated user, automatically including primary login email."""
    accounts = list_user_accounts(db, current_user.id)
    db.commit()
    return [_to_response_dto(acc) for acc in accounts]


@router.get("/deleted", response_model=list[EmailAccountResponse])
def get_deleted_email_accounts_endpoint(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """List only archived/deleted email accounts belonging to the authenticated user."""
    accounts = list_archived_accounts(db, current_user.id)
    return [_to_response_dto(acc) for acc in accounts]


@router.post("/connect/request-code", response_model=ConnectEmailResponse)
def request_connect_email_code_endpoint(
    payload: ConnectEmailRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Initiates an email ownership verification flow for connecting a new email account."""
    try:
        result = request_connect_email_code(
            db=db,
            user_id=current_user.id,
            email=str(payload.email_address),
            from_name=payload.from_name,
        )
        db.commit()
        return ConnectEmailResponse(
            status=result["status"],
            message=result["message"],
            email_address=result.get("email_address", str(payload.email_address)),
        )
    except ValueError as exc:
        db.rollback()
        error_msg = str(exc)
        # If email is already in use by another user, return 409 Conflict with standardized payload
        if "already in use" in error_msg:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "status": "email_in_use",
                    "message": "This email address is already in use by another account. Please use a different email address.",
                },
            ) from exc
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"status": "validation_error", "message": error_msg},
        ) from exc
    except RuntimeError as exc:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail={"status": "delivery_failed", "message": str(exc)},
        ) from exc


@router.post("/connect/verify-code", response_model=EmailAccountResponse, status_code=status.HTTP_201_CREATED)
def verify_connect_email_code_endpoint(
    payload: ConnectEmailConfirmRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Verifies the ownership code and associates the verified email with the authenticated user."""
    try:
        account = verify_connect_email_code(
            db=db,
            user_id=current_user.id,
            email=str(payload.email_address),
            from_name=payload.from_name,
            otp_code=payload.otp_code,
            receiver_name=payload.receiver_name,
            receiver_email=str(payload.receiver_email) if payload.receiver_email else None,
            reply_to=str(payload.reply_to) if payload.reply_to else None,
        )
        db.commit()
        db.refresh(account)
        return _to_response_dto(account)
    except ValueError as exc:
        db.rollback()
        error_msg = str(exc)
        if "already in use" in error_msg:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "status": "email_in_use",
                    "message": "This email address is already in use by another account. Please use a different email address.",
                },
            ) from exc
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail={"status": "invalid_code", "message": error_msg},
        ) from exc


@router.post("", response_model=EmailAccountResponse, status_code=status.HTTP_201_CREATED)
def create_email_account_endpoint(
    payload: EmailAccountCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Add a new sender email account identity to the workspace."""
    try:
        account = create_account(db, current_user.id, payload)
        db.commit()
        db.refresh(account)
        return _to_response_dto(account)
    except ValueError as exc:
        db.rollback()
        error_msg = str(exc)
        if "already in use" in error_msg:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "status": "email_in_use",
                    "message": "This email address is already in use by another account. Please use a different email address.",
                },
            ) from exc
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=error_msg) from exc


@router.get("/{account_id}", response_model=EmailAccountResponse)
def get_email_account_endpoint(
    account_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Retrieve details of an owned email account."""
    try:
        account = get_user_account(db, current_user.id, account_id)
        return _to_response_dto(account)
    except PermissionError as exc:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except ValueError as exc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc


@router.put("/{account_id}", response_model=EmailAccountResponse)
@router.patch("/{account_id}", response_model=EmailAccountResponse)
def update_email_account_endpoint(
    account_id: int,
    payload: EmailAccountUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Update display name or active state for an owned email account."""
    try:
        account = update_account(db, current_user.id, account_id, payload)
        db.commit()
        db.refresh(account)
        return _to_response_dto(account)
    except PermissionError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/{account_id}/activate", response_model=EmailAccountResponse)
def activate_email_account_endpoint(
    account_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Activate an owned email account."""
    try:
        account = activate_account(db, current_user.id, account_id)
        db.commit()
        db.refresh(account)
        return _to_response_dto(account)
    except PermissionError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/{account_id}/deactivate", response_model=EmailAccountResponse)
def deactivate_email_account_endpoint(
    account_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Deactivate an owned email account with safeguard against removing all login options."""
    try:
        account = deactivate_account(db, current_user.id, account_id)
        db.commit()
        db.refresh(account)
        return _to_response_dto(account)
    except PermissionError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.delete("/{account_id}", response_model=EmailAccountResponse)
def delete_email_account_endpoint(
    account_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Safely archive/delete an owned email account without corrupting campaign history."""
    try:
        account = archive_account(db, current_user.id, account_id)
        db.commit()
        db.refresh(account)
        return _to_response_dto(account)
    except PermissionError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/{account_id}/restore", response_model=EmailAccountResponse)
def restore_email_account_endpoint(
    account_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Restore an archived email account back to the active accounts list."""
    try:
        account = restore_account(db, current_user.id, account_id)
        db.commit()
        db.refresh(account)
        return _to_response_dto(account)
    except PermissionError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.delete("/{account_id}/permanent", response_model=AccountActionResponse)
def permanently_delete_email_account_endpoint(
    account_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Permanently delete an already-archived email account."""
    try:
        permanently_delete_account(db, current_user.id, account_id)
        db.commit()
        return AccountActionResponse(
            status="permanently_deleted",
            message="The email account has been permanently removed.",
        )
    except PermissionError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(exc)) from exc


@router.post("/{account_id}/verify", response_model=EmailAccountResponse)
def verify_email_account_endpoint(
    account_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Verify an owned email account and mark provider status ready."""
    try:
        account = verify_account(db, current_user.id, account_id)
        db.commit()
        db.refresh(account)
        return _to_response_dto(account)
    except PermissionError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail=str(exc)) from exc
    except ValueError as exc:
        db.rollback()
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(exc)) from exc

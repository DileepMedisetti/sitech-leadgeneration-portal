from datetime import datetime
from pydantic import BaseModel, ConfigDict, EmailStr, Field


class EmailAccountCreate(BaseModel):
    email_address: EmailStr = Field(..., description="Email address of sender identity")
    from_name: str = Field(..., min_length=2, max_length=255, description="Display name for outgoing emails")
    provider: str = Field(default="smtp", max_length=50, description="Provider type (smtp, sendgrid, ses)")
    provider_account_ref: str | None = Field(default=None, max_length=255)


class EmailAccountUpdate(BaseModel):
    from_name: str | None = Field(default=None, min_length=2, max_length=255)
    is_active: bool | None = None


class ConnectEmailRequest(BaseModel):
    email_address: EmailStr = Field(..., description="Email address to connect to workspace")
    from_name: str = Field(..., min_length=2, max_length=255, description="Display name for outgoing emails")


class ConnectEmailConfirmRequest(BaseModel):
    email_address: EmailStr = Field(..., description="Email address being connected")
    from_name: str = Field(..., min_length=2, max_length=255, description="Display name for outgoing emails")
    otp_code: str = Field(..., min_length=6, max_length=6, description="6-digit verification code")


class ConnectEmailResponse(BaseModel):
    status: str
    message: str
    email_address: str


class EmailAccountResponse(BaseModel):
    id: int
    owner_user_id: int
    email_address: str
    from_name: str
    is_primary: bool = False
    is_active: bool
    verification_status: str  # 'pending', 'verified', 'failed'
    verified_at: datetime | None = None
    provider: str
    provider_status: str  # 'not_configured', 'pending', 'ready', 'blocked'
    last_used_at: datetime | None = None
    archived_at: datetime | None = None
    is_eligible_sender: bool = False
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class SenderIdentityResponse(BaseModel):
    id: int
    email: str
    name: str
    verified: bool
    provider_status: str
    is_eligible: bool

    model_config = ConfigDict(from_attributes=True)


class AccountActionResponse(BaseModel):
    status: str
    message: str
    account: EmailAccountResponse | None = None

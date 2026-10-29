from pydantic import BaseModel, ConfigDict, EmailStr, Field


class RequestOtpRequest(BaseModel):
    email: EmailStr = Field(..., description="Recipient email address for OTP delivery")


class RequestOtpResponse(BaseModel):
    status: str  # 'otp_sent', 'rate_limited', 'locked', 'delivery_failed'
    message: str
    email: str | None = None
    expires_in_seconds: int | None = None
    cooldown_seconds: int | None = None
    cooldown_remaining_seconds: int | None = None
    locked_until: str | None = None
    remaining_lockout_seconds: int | None = None


class VerifyOtpRequest(BaseModel):
    email: EmailStr = Field(..., description="Email address receiving the OTP")
    otp_code: str = Field(..., min_length=6, max_length=6, description="6-digit numeric verification code")


class UserResponse(BaseModel):
    id: int
    email: str
    display_name: str
    is_active: bool
    email_accounts_count: int = 0

    model_config = ConfigDict(from_attributes=True)


class VerifyOtpResponse(BaseModel):
    status: str  # 'success', 'incorrect', 'expired', 'locked'
    message: str
    access_token: str | None = None
    token_type: str | None = None
    user: UserResponse | None = None
    remaining_attempts: int | None = None
    locked_until: str | None = None
    remaining_lockout_seconds: int | None = None


class LogoutResponse(BaseModel):
    status: str
    message: str

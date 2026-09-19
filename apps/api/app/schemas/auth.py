import re

from pydantic import BaseModel, ConfigDict, Field, field_validator

# Deliberately not a full RFC 5322 implementation: that accepts addresses no
# mail server will route. This rejects what people actually mistype - a
# trailing dot, a missing dot in the domain, spaces, a missing @ - which is
# what matters when an unreachable address means the account never receives a
# confirmation or reset link.
_EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s.]+(\.[^@\s.]+)+$")


def _clean_email(value: str) -> str:
    """Normalise and reject addresses that cannot receive mail."""
    cleaned = value.strip().lower()
    if not _EMAIL_PATTERN.match(cleaned):
        raise ValueError("Enter a valid email address")
    return cleaned


class RegisterRequest(BaseModel):
    email: str
    password: str = Field(min_length=8)
    full_name: str
    workspace_name: str
    @field_validator("email")
    @classmethod
    def _validate_email_RegisterRequest(cls, value: str) -> str:
        return _clean_email(value)



class LoginRequest(BaseModel):
    email: str
    password: str
    @field_validator("email")
    @classmethod
    def _validate_email_LoginRequest(cls, value: str) -> str:
        return _clean_email(value)



class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    email: str
    full_name: str | None = None
    # Lets the interface show the admin section to the people who have it.
    # Not a permission in itself: every admin endpoint checks the flag on the
    # server, because hiding a link is not access control.
    is_superuser: bool = False
    email_verified_at: str | None = None


class WorkspaceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    slug: str
    plan: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut
    workspace: WorkspaceOut


class MeResponse(BaseModel):
    user: UserOut
    workspaces: list[WorkspaceOut]


class ForgotPasswordRequest(BaseModel):
    email: str
    @field_validator("email")
    @classmethod
    def _validate_email_ForgotPasswordRequest(cls, value: str) -> str:
        return _clean_email(value)



class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str = Field(min_length=8, max_length=128)


class VerifyEmailRequest(BaseModel):
    token: str


class AuthActionResponse(BaseModel):
    """Result of an email-driven action.

    `email_sent` is the truth about delivery, not a reassurance: when SMTP is
    unconfigured the interface needs to say so rather than send the user to
    watch an inbox that will never receive anything.
    """

    message: str
    email_sent: bool = False

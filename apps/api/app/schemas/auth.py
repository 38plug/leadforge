from pydantic import BaseModel, ConfigDict, Field


class RegisterRequest(BaseModel):
    email: str
    password: str = Field(min_length=8)
    full_name: str
    workspace_name: str


class LoginRequest(BaseModel):
    email: str
    password: str


class UserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    email: str
    full_name: str | None = None


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

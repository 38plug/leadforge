from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, model_validator


class AdminOverview(BaseModel):
    total_users: int
    active_users: int
    total_workspaces: int
    total_leads: int
    total_companies: int
    active_coupons: int
    paying_subscriptions: int
    # Lets the admin screen say "no payment processor is connected" instead of
    # rendering an empty revenue panel that looks like a loading failure.
    payment_provider_connected: bool


class AdminWorkspaceRef(BaseModel):
    id: str
    name: str
    plan: str
    role: str
    # The plan belongs to the workspace, not to this membership, so changing it
    # from an account row changes it for everyone in that workspace. The count
    # is carried so the interface can say that rather than let an admin find
    # out afterwards.
    member_count: int = 1
    # "stripe" when a real subscription is behind the plan, null when it was
    # granted by hand. The two need different warnings: setting a paying
    # workspace to FREE here does not cancel anything in Stripe.
    payment_provider: str | None = None


class AdminUserOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    email: str
    full_name: str | None
    is_active: bool
    is_superuser: bool
    created_at: datetime
    workspaces: list[AdminWorkspaceRef]


class AdminUserUpdate(BaseModel):
    is_active: bool | None = None
    is_superuser: bool | None = None
    full_name: str | None = None


class AdminWorkspaceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    name: str
    slug: str
    plan: str
    created_at: datetime
    member_count: int
    lead_count: int
    subscription_status: str | None
    payment_provider: str | None


class AdminWorkspaceUpdate(BaseModel):
    plan: str | None = None


class AdminCouponCreate(BaseModel):
    code: str = Field(min_length=3, max_length=64)
    description: str | None = Field(default=None, max_length=255)
    percent_off: int | None = Field(default=None, ge=1, le=100)
    amount_off_cents: int | None = Field(default=None, ge=1)
    max_redemptions: int | None = Field(default=None, ge=1)
    expires_at: str | None = None

    @model_validator(mode="after")
    def exactly_one_discount(self) -> "AdminCouponCreate":
        """A coupon that is both 20% off and $10 off has no defined meaning, and
        one that is neither cannot discount anything."""
        has_percent = self.percent_off is not None
        has_amount = self.amount_off_cents is not None
        if has_percent == has_amount:
            raise ValueError("Set exactly one of percent_off or amount_off_cents")
        return self


class AdminCouponOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    code: str
    description: str | None
    percent_off: int | None
    amount_off_cents: int | None
    max_redemptions: int | None
    redeemed_count: int
    expires_at: str | None
    is_active: bool
    created_at: datetime


# ------------------------------------------------------------ self-service


class ChangePasswordRequest(BaseModel):
    current_password: str
    # Matches the minimum enforced at registration.
    new_password: str = Field(min_length=8, max_length=128)


class DeleteAccountRequest(BaseModel):
    """Deleting an account is irreversible, so it is confirmed with the
    password rather than a checkbox."""

    password: str


class LeadRevealOut(BaseModel):
    """What unlocking a lead returns: the details, and what it cost."""

    lead_id: str
    phone: str | None
    email: str | None
    maps_url: str | None
    website: str | None
    used: int
    limit: int
    # Total unlocks still available: the rest of the weekly allowance plus any
    # purchased pack. Split out below so the interface can say which is which
    # instead of showing a number larger than the plan's own limit with no
    # explanation.
    remaining: int
    included_remaining: int = 0
    credit_balance: int = 0


class QuotaOut(BaseModel):
    plan: str
    used: int
    limit: int
    remaining: int
    included_remaining: int = 0
    credit_balance: int = 0
    exhausted: bool
    period: str

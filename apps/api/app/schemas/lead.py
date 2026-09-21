from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field

from app.models.company import WebsiteStatus
from app.models.lead import LeadPriority, LeadStatus


class ScoreBreakdownItem(BaseModel):
    label: str
    points: int


class LeadScoreOut(BaseModel):
    score: int
    breakdown: list[ScoreBreakdownItem]
    recommendation: str
    priority: LeadPriority


class SocialProfileOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    platform: str
    handle: str
    url: str
    follower_count: int | None = None


class WebsiteOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    website_url: str | None = None
    domain: str | None = None
    http_status: int | None = None
    ssl_status: bool | None = None
    status: WebsiteStatus
    mobile_friendly: bool | None = None
    last_checked_at: str | None = None


class ContactOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    phone: str | None = None
    email: str | None = None
    contact_name: str | None = None


class CompanyOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    niche: str
    country: str
    city: str
    address: str | None = None
    maps_url: str | None = None
    rating: float | None = None
    reviews_count: int | None = None
    hours: str | None = None
    description: str | None = None
    contacts: list[ContactOut] = []
    social_profiles: list[SocialProfileOut] = []
    website: WebsiteOut | None = None


class LeadOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    workspace_id: str
    company: CompanyOut
    # False until this workspace unlocks the lead. While false the contact
    # details above are stripped from the response rather than merely hidden
    # by the interface, so the paywall cannot be read around in devtools.
    contact_revealed: bool = True
    status: LeadStatus
    score: int
    score_breakdown: list[ScoreBreakdownItem]
    score_recommendation: str | None = None
    priority: LeadPriority
    estimated_value: float | None = None
    source: str
    contact_attempts: int
    follow_up_date: str | None = None
    last_contacted_at: str | None = None
    created_at: datetime


class LeadStatusUpdate(BaseModel):
    status: LeadStatus


class LeadSearchFilters(BaseModel):
    country: str | None = None
    city: str | None = None
    niche: str | None = None
    custom_niche: str | None = None
    website_status: WebsiteStatus | None = None
    min_rating: float | None = None
    max_reviews: int | None = None
    min_reviews: int | None = None
    require_phone: bool = False
    require_email: bool = False
    require_instagram: bool = False
    min_score: int = 0
    radius_km: float | None = None
    limit: int = 50


class LeadSearchRequest(BaseModel):
    filters: LeadSearchFilters
    save_search: bool = False
    search_name: str | None = None


class LeadPreview(BaseModel):
    """Preview of a search result before saving. Does not create DB records."""
    external_ref: str
    name: str
    niche: str
    country: str | None = None
    city: str | None = None
    address: str | None = None
    phone: str | None = None
    email: str | None = None
    instagram: str | None = None
    website: str | None = None
    maps_url: str | None = None
    rating: float | None = None
    reviews_count: int | None = None
    hours: str | None = None
    description: str | None = None
    website_status: WebsiteStatus
    score: LeadScoreOut


class LeadSearchResult(BaseModel):
    total_found: int
    leads: list[LeadPreview]


class LeadSaveRequest(BaseModel):
    """Save one or more previewed leads to the workspace."""
    leads: list[LeadPreview] = Field(min_length=1, max_length=50)


class LeadSaveResponse(BaseModel):
    saved: int
    lead_ids: list[str]


class LeadDeleteRequest(BaseModel):
    """The leads a bulk delete should remove.

    Capped so one request cannot ask for an unbounded delete by accident. The
    table's own "select all" is a page at a time, so this is well above any
    selection the interface can produce.
    """

    lead_ids: list[str] = Field(default_factory=list, max_length=1000)


class LeadsDeleted(BaseModel):
    """How many leads the request actually removed.

    Reported rather than assumed: a selection can contain ids already deleted
    in another tab, and the interface should say what happened rather than
    what was asked for.
    """

    deleted: int

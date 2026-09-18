from datetime import datetime

from pydantic import BaseModel, ConfigDict

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


class LeadSearchRequest(BaseModel):
    filters: LeadSearchFilters
    save_search: bool = False
    search_name: str | None = None


class LeadSearchResult(BaseModel):
    total_found: int
    leads: list[LeadOut]

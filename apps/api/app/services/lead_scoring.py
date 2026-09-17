"""
LeadScoreService — the single source of truth for the Opportunity Score.

Scoring logic must never live inside UI components or route handlers.
Every factor and its weight is configurable here so product/business rules
can evolve without touching persistence or presentation code.
"""

from dataclasses import dataclass, field

from app.models.company import WebsiteStatus
from app.models.lead import LeadPriority


@dataclass
class ScoreBreakdownItem:
    label: str
    points: int


@dataclass
class LeadScoreResult:
    score: int
    breakdown: list[ScoreBreakdownItem]
    recommendation: str
    priority: LeadPriority


@dataclass
class ScoringWeights:
    no_website: int = 30
    poor_website: int = 20
    rating_excellent: int = 10  # rating >= 4.5
    rating_good: int = 5  # rating >= 4.0
    reviews_high: int = 10  # reviews >= 100
    reviews_medium: int = 5  # reviews >= 30
    active_social: int = 10
    established_business: int = 10
    phone_available: int = 5
    email_available: int = 5


@dataclass
class ScoringInput:
    website_status: WebsiteStatus
    rating: float | None = None
    reviews_count: int | None = None
    has_active_social: bool = False
    is_established: bool = False
    has_phone: bool = False
    has_email: bool = False


class LeadScoreService:
    def __init__(self, weights: ScoringWeights | None = None):
        self.weights = weights or ScoringWeights()

    def score(self, data: ScoringInput) -> LeadScoreResult:
        breakdown: list[ScoreBreakdownItem] = []
        w = self.weights

        if data.website_status == WebsiteStatus.NO_WEBSITE:
            breakdown.append(ScoreBreakdownItem("No website", w.no_website))
        elif data.website_status in (WebsiteStatus.OUTDATED, WebsiteStatus.INACCESSIBLE):
            breakdown.append(ScoreBreakdownItem("Poor / outdated website", w.poor_website))

        if data.rating is not None:
            if data.rating >= 4.5:
                breakdown.append(ScoreBreakdownItem(f"{data.rating:.1f} rating", w.rating_excellent))
            elif data.rating >= 4.0:
                breakdown.append(ScoreBreakdownItem(f"{data.rating:.1f} rating", w.rating_good))

        if data.reviews_count is not None:
            if data.reviews_count >= 100:
                breakdown.append(ScoreBreakdownItem(f"{data.reviews_count}+ reviews", w.reviews_high))
            elif data.reviews_count >= 30:
                breakdown.append(ScoreBreakdownItem(f"{data.reviews_count}+ reviews", w.reviews_medium))

        if data.has_active_social:
            breakdown.append(ScoreBreakdownItem("Active social presence", w.active_social))

        if data.is_established:
            breakdown.append(ScoreBreakdownItem("Established business", w.established_business))

        if data.has_phone:
            breakdown.append(ScoreBreakdownItem("Phone available", w.phone_available))

        if data.has_email:
            breakdown.append(ScoreBreakdownItem("Email available", w.email_available))

        total = min(100, sum(item.points for item in breakdown))

        if total >= 85:
            priority = LeadPriority.URGENT
            recommendation = "Excellent opportunity — prioritize outreach today."
        elif total >= 70:
            priority = LeadPriority.HIGH
            recommendation = "Strong opportunity — add to this week's outreach."
        elif total >= 50:
            priority = LeadPriority.MEDIUM
            recommendation = "Worth pursuing — queue for the standard sequence."
        else:
            priority = LeadPriority.LOW
            recommendation = "Low priority — revisit later or disqualify."

        return LeadScoreResult(score=total, breakdown=breakdown, recommendation=recommendation, priority=priority)

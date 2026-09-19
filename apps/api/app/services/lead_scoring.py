"""
LeadScoreService - the single source of truth for the Opportunity Score.

Scoring never lives in UI components or route handlers. Every factor and
weight is here so the business rules can change without touching persistence
or presentation.

The score answers one question: **how good a prospect is this business for
someone selling websites?** Two things follow from that.

First, the weights reflect signals this product can actually observe. An
earlier version scored star ratings and review counts, which OpenStreetMap
does not record - so those factors never fired, and a nominal 0-100 scale
topped out at 60 with over half of all leads landing on exactly 30. A scale
that cannot reach its own maximum is not a scale, and it made the dashboard's
"high opportunity" band permanently empty.

Second, the dominant factor is website status, because that is the actual
buying signal. Everything else adjusts how easy the business is to reach and
how real the listing looks.
"""

from dataclasses import dataclass

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
    """Tuned so a realistic best case approaches 100 and a realistic worst
    case approaches 0, using only signals that are actually available."""

    # --- website status: the buying signal -------------------------------
    # No website at all is the clearest opportunity there is, so it carries
    # more than half the score on its own.
    no_website: int = 55
    # A site that will not load is nearly as good a prospect: the business
    # believes it has a web presence and does not.
    broken_website: int = 45
    outdated_website: int = 35
    # A redirect usually means a social page or a parked domain standing in
    # for a real site.
    redirected_website: int = 20
    # A working, current site is not an opportunity for a rebuild pitch.
    active_website: int = 0

    # --- reachability: can this lead actually be contacted? --------------
    # A perfect prospect you cannot reach is not a prospect. These are worth
    # real points because they decide whether outreach is even possible.
    phone_available: int = 15
    email_available: int = 15

    # A business posting on social with no website is a strong signal: it
    # already wants to be found and has nowhere to send people.
    social_without_website: int = 15
    social_with_website: int = 5

    # --- listing quality -------------------------------------------------
    # A listing carrying an address and opening hours is a real, operating
    # business rather than a stale pin. Small weights: supporting evidence,
    # not the reason to call.
    has_address: int = 5
    has_hours: int = 5


@dataclass
class ScoringInput:
    website_status: WebsiteStatus
    has_active_social: bool = False
    has_phone: bool = False
    has_email: bool = False
    has_address: bool = False
    has_hours: bool = False

    # Accepted and ignored. OpenStreetMap records neither, so they are always
    # None; kept so existing callers do not break, and documented so nobody
    # reintroduces a factor that can never fire.
    rating: float | None = None
    reviews_count: int | None = None
    is_established: bool = False


class LeadScoreService:
    def __init__(self, weights: ScoringWeights | None = None):
        self.weights = weights or ScoringWeights()

    def score(self, data: ScoringInput) -> LeadScoreResult:
        breakdown: list[ScoreBreakdownItem] = []
        w = self.weights

        website_points = {
            WebsiteStatus.NO_WEBSITE: ("No website found", w.no_website),
            WebsiteStatus.INACCESSIBLE: ("Website does not load", w.broken_website),
            WebsiteStatus.OUTDATED: ("Website looks outdated", w.outdated_website),
            WebsiteStatus.REDIRECTED: ("Redirects elsewhere", w.redirected_website),
            WebsiteStatus.ACTIVE: ("Has a working website", w.active_website),
        }
        label, points = website_points.get(data.website_status, ("Website status unknown", 15))
        breakdown.append(ScoreBreakdownItem(label, points))

        has_no_real_site = data.website_status in (
            WebsiteStatus.NO_WEBSITE,
            WebsiteStatus.INACCESSIBLE,
        )

        if data.has_phone:
            breakdown.append(ScoreBreakdownItem("Phone number listed", w.phone_available))
        if data.has_email:
            breakdown.append(ScoreBreakdownItem("Email listed", w.email_available))

        if data.has_active_social:
            # Worth more when there is no website behind it: the business is
            # already trying to be found and has nowhere to send anyone.
            if has_no_real_site:
                breakdown.append(
                    ScoreBreakdownItem("On social but no website", w.social_without_website)
                )
            else:
                breakdown.append(ScoreBreakdownItem("Active on social", w.social_with_website))

        if data.has_address:
            breakdown.append(ScoreBreakdownItem("Street address listed", w.has_address))
        if data.has_hours:
            breakdown.append(ScoreBreakdownItem("Opening hours listed", w.has_hours))

        total = max(0, min(100, sum(item.points for item in breakdown)))

        # Bands describe what to do, and are set where the weights actually
        # put leads rather than at round numbers the scale never reaches.
        if total >= 80:
            priority = LeadPriority.URGENT
            recommendation = "No real web presence and easy to reach — contact today."
        elif total >= 60:
            priority = LeadPriority.HIGH
            recommendation = "Strong opportunity — add to this week's outreach."
        elif total >= 45:
            # Above the ceiling a business with a working website can reach on
            # reachability alone, so this band means "there is something wrong
            # with their web presence" rather than "they answer the phone".
            priority = LeadPriority.MEDIUM
            recommendation = "Worth pursuing once the stronger leads are worked."
        else:
            priority = LeadPriority.LOW
            recommendation = "Weak fit — already has a site, or no way to reach them."

        return LeadScoreResult(
            score=total,
            breakdown=breakdown,
            recommendation=recommendation,
            priority=priority,
        )

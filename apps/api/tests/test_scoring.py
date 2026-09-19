"""
The Opportunity Score.

The score exists to rank prospects for someone selling websites, so these
tests are mostly about ordering and range: the best realistic lead should
approach 100, the worst should approach 0, and a business that already has a
working site should never outrank one that has none.

An earlier version scored star ratings and review counts. OpenStreetMap
records neither, so those factors never fired and the nominal 0-100 scale
topped out at 60 - with over half of all real leads landing on exactly 30 and
the "high opportunity" band permanently empty. The range tests below exist to
stop that returning.
"""

from app.models.company import WebsiteStatus
from app.models.lead import LeadPriority
from app.services.lead_scoring import LeadScoreService, ScoringInput

service = LeadScoreService()


def best_realistic_lead() -> ScoringInput:
    """No website, reachable, already visible on social, real listing.

    Everything here is obtainable from OpenStreetMap, which is the point:
    this is the best a real lead can look, not a theoretical maximum.
    """
    return ScoringInput(
        website_status=WebsiteStatus.NO_WEBSITE,
        has_active_social=True,
        has_phone=True,
        has_email=True,
        has_address=True,
        has_hours=True,
    )


# ------------------------------------------------------------------ range


def test_the_best_realistic_lead_scores_near_the_top():
    """A scale whose maximum is unreachable is not a scale."""
    result = service.score(best_realistic_lead())
    assert result.score >= 90, f"best realistic lead only scored {result.score}"
    assert result.priority == LeadPriority.URGENT


def test_a_business_with_a_working_site_and_nothing_else_scores_zero():
    result = service.score(ScoringInput(website_status=WebsiteStatus.ACTIVE))
    assert result.score == 0
    assert result.priority == LeadPriority.LOW


def test_the_score_is_bounded():
    assert service.score(best_realistic_lead()).score <= 100
    assert service.score(ScoringInput(website_status=WebsiteStatus.ACTIVE)).score >= 0


def test_a_lead_with_no_website_alone_is_still_worth_pursuing():
    """The commonest real lead: no site, no contact details published. It
    should not land in the same band as a business that already has a site."""
    result = service.score(ScoringInput(website_status=WebsiteStatus.NO_WEBSITE))
    assert result.score >= 50
    assert result.priority in (LeadPriority.MEDIUM, LeadPriority.HIGH)


# ---------------------------------------------------------------- ordering


def test_no_website_outranks_every_other_website_state():
    scores = {
        status: service.score(ScoringInput(website_status=status)).score
        for status in (
            WebsiteStatus.NO_WEBSITE,
            WebsiteStatus.INACCESSIBLE,
            WebsiteStatus.OUTDATED,
            WebsiteStatus.REDIRECTED,
            WebsiteStatus.ACTIVE,
        )
    }
    assert scores[WebsiteStatus.NO_WEBSITE] > scores[WebsiteStatus.INACCESSIBLE]
    assert scores[WebsiteStatus.INACCESSIBLE] > scores[WebsiteStatus.OUTDATED]
    assert scores[WebsiteStatus.OUTDATED] > scores[WebsiteStatus.REDIRECTED]
    assert scores[WebsiteStatus.REDIRECTED] > scores[WebsiteStatus.ACTIVE]


def test_being_reachable_raises_the_score():
    """A perfect prospect nobody can contact is not a prospect."""
    unreachable = service.score(ScoringInput(website_status=WebsiteStatus.NO_WEBSITE))
    reachable = service.score(
        ScoringInput(website_status=WebsiteStatus.NO_WEBSITE, has_phone=True, has_email=True)
    )
    assert reachable.score > unreachable.score


def test_social_counts_for_more_when_there_is_no_website():
    """A business posting on social with nowhere to send people is a better
    prospect than one that already has a site."""
    without_site = service.score(
        ScoringInput(website_status=WebsiteStatus.NO_WEBSITE, has_active_social=True)
    ).score - service.score(ScoringInput(website_status=WebsiteStatus.NO_WEBSITE)).score
    with_site = service.score(
        ScoringInput(website_status=WebsiteStatus.ACTIVE, has_active_social=True)
    ).score - service.score(ScoringInput(website_status=WebsiteStatus.ACTIVE)).score
    assert without_site > with_site


# ------------------------------------------------- factors that cannot fire


def test_ratings_and_reviews_do_not_affect_the_score():
    """They are accepted for compatibility and ignored. OpenStreetMap records
    neither, so weighting them silently lowered every real lead's ceiling."""
    plain = service.score(ScoringInput(website_status=WebsiteStatus.NO_WEBSITE))
    with_ratings = service.score(
        ScoringInput(
            website_status=WebsiteStatus.NO_WEBSITE,
            rating=4.9,
            reviews_count=900,
            is_established=True,
        )
    )
    assert plain.score == with_ratings.score


# ----------------------------------------------------------- the breakdown


def test_every_lead_explains_its_score():
    """The number is never presented bare, so there is always something to
    show for it."""
    for status in WebsiteStatus:
        result = service.score(ScoringInput(website_status=status))
        assert result.breakdown, f"{status} produced no explanation"
        assert result.recommendation


def test_the_breakdown_adds_up_to_the_score():
    result = service.score(best_realistic_lead())
    assert sum(item.points for item in result.breakdown) >= result.score

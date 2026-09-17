from app.models.company import WebsiteStatus
from app.models.lead import LeadPriority
from app.services.lead_scoring import LeadScoreService, ScoringInput


def test_no_website_high_rating_scores_high():
    service = LeadScoreService()
    result = service.score(
        ScoringInput(
            website_status=WebsiteStatus.NO_WEBSITE,
            rating=4.8,
            reviews_count=400,
            has_active_social=True,
            is_established=True,
            has_phone=True,
            has_email=True,
        )
    )
    # 30 (no website) + 10 (4.8 rating) + 10 (400+ reviews) + 10 (social)
    # + 10 (established) + 5 (phone) + 5 (email) = 80
    assert result.score == 80
    assert result.priority == LeadPriority.HIGH


def test_active_website_no_signals_scores_low():
    service = LeadScoreService()
    result = service.score(ScoringInput(website_status=WebsiteStatus.ACTIVE))
    assert result.score == 0
    assert result.priority == LeadPriority.LOW


def test_score_never_exceeds_100():
    service = LeadScoreService()
    result = service.score(
        ScoringInput(
            website_status=WebsiteStatus.NO_WEBSITE,
            rating=5.0,
            reviews_count=1000,
            has_active_social=True,
            is_established=True,
            has_phone=True,
            has_email=True,
        )
    )
    assert result.score <= 100


def test_outdated_website_scores_lower_than_no_website():
    service = LeadScoreService()
    no_site = service.score(ScoringInput(website_status=WebsiteStatus.NO_WEBSITE))
    outdated = service.score(ScoringInput(website_status=WebsiteStatus.OUTDATED))
    assert no_site.score > outdated.score

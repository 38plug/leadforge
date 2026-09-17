from app.providers.ai import LeadContext, RuleBasedAIProvider
from app.schemas.ai import AILeadAnalysis


def test_mock_ai_provider_output_validates_against_schema():
    provider = RuleBasedAIProvider()
    context = LeadContext(
        company_name="Test Co",
        niche="Cafe",
        city="Testville",
        country="Testland",
        rating=4.8,
        reviews_count=200,
        website_status="NO_WEBSITE",
        has_instagram=True,
        has_phone=True,
        has_email=False,
    )
    result = provider.analyze_lead(context)
    # Round-trips through the Pydantic schema exactly like AIService does —
    # guards against a provider ever returning an un-validatable shape.
    validated = AILeadAnalysis.model_validate(result.model_dump())
    assert 0 <= validated.opportunity_score <= 100
    assert validated.recommended_contact_method in ("Email", "Instagram DM", "Phone")

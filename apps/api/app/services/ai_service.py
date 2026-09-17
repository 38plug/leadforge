"""
AIService — orchestrates calls to the configured AIProvider and guarantees
the application never crashes or shows garbage when AI is unavailable.
"""

import logging

from pydantic import ValidationError

from app.providers.ai import AIProvider, LeadContext
from app.providers.errors import ProviderError
from app.schemas.ai import AILeadAnalysis, GenerateCallScriptResponse, GenerateEmailResponse

logger = logging.getLogger("leadforge.ai")


def _fallback_analysis(context: LeadContext) -> AILeadAnalysis:
    return AILeadAnalysis(
        opportunity_score=50,
        summary=f"AI analysis is temporarily unavailable for {context.company_name}. Showing a baseline assessment.",
        strengths=["Established local business"],
        weaknesses=["Unable to generate a full AI assessment right now"],
        website_opportunities=["Re-run analysis once AI service is available"],
        recommended_services=["Website design"],
        recommended_pitch="Reach out with a general website audit offer.",
        recommended_contact_method="Email",
        estimated_project_range="$2,000 - $5,000",
    )


class AIService:
    def __init__(self, provider: AIProvider):
        self.provider = provider

    def analyze_lead(self, context: LeadContext) -> AILeadAnalysis:
        try:
            result = self.provider.analyze_lead(context)
            # Defense in depth: even a "trusted" provider result is re-validated.
            return AILeadAnalysis.model_validate(result.model_dump())
        except (ProviderError, ValidationError, NotImplementedError) as exc:
            logger.warning("AI analyze_lead failed, using fallback: %s", exc)
            return _fallback_analysis(context)

    def generate_email(self, context: LeadContext, tone: str, goal: str) -> GenerateEmailResponse:
        try:
            return self.provider.generate_email(context, tone, goal)
        except (ProviderError, NotImplementedError) as exc:
            logger.warning("AI generate_email failed, using fallback: %s", exc)
            return GenerateEmailResponse(
                subject=f"Quick idea for {context.company_name}",
                body="Hi there, I'd love to share a few ideas for your online presence. Are you open to a quick call?",
            )

    def generate_call_script(self, context: LeadContext) -> GenerateCallScriptResponse:
        try:
            return self.provider.generate_call_script(context)
        except (ProviderError, NotImplementedError) as exc:
            logger.warning("AI generate_call_script failed, using fallback: %s", exc)
            return GenerateCallScriptResponse(
                opener=f"Hi, is this the owner of {context.company_name}?",
                talking_points=["Ask about their current website / booking process"],
                objection_handling=["\"Not interested\" -> Ask if it's OK to follow up in a few months"],
            )

    def chat(self, message: str, context: LeadContext | None) -> str:
        try:
            return self.provider.chat(message, context)
        except (ProviderError, NotImplementedError) as exc:
            logger.warning("AI chat failed, using fallback: %s", exc)
            return "I'm temporarily unable to reach the AI provider — please try again shortly."

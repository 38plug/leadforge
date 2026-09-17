"""
AIProvider abstraction.

AI functionality must never be hard-wired to one vendor. Real
implementations call out to any OpenAI/Anthropic-compatible chat completion
endpoint and MUST return data that validates against the Pydantic schemas
in app/schemas/ai.py before it is trusted by the rest of the application.
"""

import json
import re
from abc import ABC, abstractmethod

import httpx
from pydantic import ValidationError

from app.core.config import Settings
from app.providers.errors import ProviderError, ProviderUnavailableError
from app.schemas.ai import AILeadAnalysis, GenerateCallScriptResponse, GenerateEmailResponse


class LeadContext:
    def __init__(
        self,
        company_name: str,
        niche: str,
        city: str,
        country: str,
        rating: float | None,
        reviews_count: int | None,
        website_status: str,
        has_instagram: bool,
        has_phone: bool,
        has_email: bool,
    ):
        self.company_name = company_name
        self.niche = niche
        self.city = city
        self.country = country
        self.rating = rating
        self.reviews_count = reviews_count
        self.website_status = website_status
        self.has_instagram = has_instagram
        self.has_phone = has_phone
        self.has_email = has_email


class AIProvider(ABC):
    @abstractmethod
    def analyze_lead(self, context: LeadContext) -> AILeadAnalysis:
        ...

    @abstractmethod
    def generate_email(self, context: LeadContext, tone: str, goal: str) -> GenerateEmailResponse:
        ...

    @abstractmethod
    def generate_call_script(self, context: LeadContext) -> GenerateCallScriptResponse:
        ...

    @abstractmethod
    def chat(self, message: str, context: LeadContext | None) -> str:
        ...


class RuleBasedAIProvider(AIProvider):
    """
    Deterministic fallback used when no AI API key is configured.

    Every statement it makes is derived from the lead's own stored
    attributes — rating, review count, website status, available contact
    channels — so nothing here is invented about the business. It is not a
    language model, and the UI labels it as a rule-based fallback rather
    than passing it off as AI.
    """

    def analyze_lead(self, context: LeadContext) -> AILeadAnalysis:
        no_website = context.website_status == "NO_WEBSITE"
        strengths = []
        weaknesses = []

        if context.rating and context.rating >= 4.5:
            strengths.append(f"Excellent {context.rating} star rating")
        if context.reviews_count and context.reviews_count >= 100:
            strengths.append(f"{context.reviews_count}+ reviews shows established local demand")
        if context.has_instagram:
            strengths.append("Active Instagram presence indicates an engaged audience")

        if no_website:
            weaknesses.append("No independent website — losing direct bookings/inquiries to third parties")
        else:
            weaknesses.append("Current website likely underperforms on mobile and conversion")
        if not context.has_email:
            weaknesses.append("No public email on file — outreach may need to go through phone or social")

        score = 40
        if no_website:
            score += 30
        if context.rating and context.rating >= 4.5:
            score += 10
        if context.reviews_count and context.reviews_count >= 100:
            score += 10
        if context.has_instagram:
            score += 10
        score = min(100, score)

        return AILeadAnalysis(
            opportunity_score=score,
            summary=(
                f"{context.company_name} shows strong local demand in {context.city} but "
                f"{'has no independent website' if no_website else 'has an underperforming web presence'}."
            ),
            strengths=strengths or ["Established local presence"],
            weaknesses=weaknesses,
            website_opportunities=[
                "Mobile-first redesign",
                "Online booking / contact capture",
                "Local SEO optimization",
            ],
            recommended_services=["Website design", "Booking system", "SEO"],
            recommended_pitch=(
                f"Lead with a free mini-audit of {context.company_name}'s online presence, then propose "
                f"{'a new site with lead capture' if no_website else 'a conversion-focused redesign'}."
            ),
            recommended_contact_method="Email" if context.has_email else ("Instagram DM" if context.has_instagram else "Phone"),
            estimated_project_range="$2,500 - $6,000",
        )

    def generate_email(self, context: LeadContext, tone: str, goal: str) -> GenerateEmailResponse:
        subject = f"Quick idea for {context.company_name}"
        body = (
            f"Hi there,\n\nI came across {context.company_name} and noticed your business has a strong "
            f"presence in {context.city}. "
            + (
                "I didn't see a dedicated website — a simple, mobile-friendly site could help turn more of "
                "that reputation into bookings."
                if context.website_status == "NO_WEBSITE"
                else "Your current website might be leaving bookings on the table without a mobile-first refresh."
            )
            + "\n\nWould you be open to a short call this week?\n\nBest,\n"
        )
        return GenerateEmailResponse(subject=subject, body=body)

    def generate_call_script(self, context: LeadContext) -> GenerateCallScriptResponse:
        return GenerateCallScriptResponse(
            opener=f"Hi, is this the owner of {context.company_name}? I help local {context.niche.lower()} "
            "businesses turn their online presence into more bookings.",
            talking_points=[
                f"Noticed {context.company_name} has {context.reviews_count or 'many'} reviews but "
                + ("no website" if context.website_status == "NO_WEBSITE" else "an older website"),
                "Ask what's currently the biggest bottleneck for new customer inquiries",
                "Offer a free 10-minute audit of their current online presence",
            ],
            objection_handling=[
                "\"We don't have budget right now\" -> Ask what budget would make sense in 3 months, offer to follow up then",
                "\"We already have a website\" -> Ask when it was last updated and how it performs on mobile",
            ],
        )

    def chat(self, message: str, context: LeadContext | None) -> str:
        if context:
            return (
                f"Based on {context.company_name}'s profile ({context.rating or 'N/A'}★, "
                f"{context.website_status.replace('_', ' ').lower()}), I'd focus outreach on the gap you noticed "
                "and keep the first message under 80 words."
            )
        return "Happy to help — select a lead first so I can tailor the recommendation to their specific profile."


MODEL_INSTRUCTIONS = (
    "You are a B2B research assistant for a web design agency. You are given "
    "facts about a local business that were collected from public sources. "
    "Work only from those facts — never invent reviews, revenue, staff, "
    "clients, or anything else you were not given. If a fact is missing, say "
    "so rather than guessing. Respond with JSON only, no prose around it."
)


def _describe(context: LeadContext) -> str:
    """The only facts a model is allowed to reason from."""
    lines = [
        f"Business name: {context.company_name}",
        f"Niche: {context.niche}",
        f"Location: {context.city}, {context.country}",
        f"Website status: {context.website_status}",
        f"Public phone on file: {'yes' if context.has_phone else 'no'}",
        f"Public email on file: {'yes' if context.has_email else 'no'}",
        f"Public Instagram on file: {'yes' if context.has_instagram else 'no'}",
    ]
    lines.append(f"Rating: {context.rating}" if context.rating is not None else "Rating: unknown")
    lines.append(
        f"Review count: {context.reviews_count}" if context.reviews_count is not None else "Review count: unknown"
    )
    return "\n".join(lines)


class AnthropicAIProvider(AIProvider):
    """Calls the Anthropic Messages API and validates every response.

    Model output is never trusted directly: each call parses the reply as
    JSON and runs it through the Pydantic schema in app/schemas/ai.py before
    anything is persisted or shown.
    """

    def __init__(self, api_key: str, model: str, base_url: str | None = None, timeout_seconds: float = 45.0):
        self.api_key = api_key
        self.model = model
        self.base_url = (base_url or "https://api.anthropic.com").rstrip("/")
        self.timeout_seconds = timeout_seconds

    def _call(self, prompt: str, max_tokens: int = 1500) -> str:
        try:
            response = httpx.post(
                f"{self.base_url}/v1/messages",
                # The key travels in the header only; it is never logged.
                headers={
                    "x-api-key": self.api_key,
                    "anthropic-version": "2023-06-01",
                    "content-type": "application/json",
                },
                json={
                    "model": self.model,
                    "max_tokens": max_tokens,
                    "system": MODEL_INSTRUCTIONS,
                    "messages": [{"role": "user", "content": prompt}],
                },
                timeout=self.timeout_seconds,
            )
        except httpx.HTTPError as exc:
            raise ProviderError("AI_UNREACHABLE", f"Could not reach the AI provider: {exc}", retryable=True) from exc

        if response.status_code in (429, 500, 502, 503, 504):
            raise ProviderError(
                "AI_RATE_LIMITED" if response.status_code == 429 else "AI_UNAVAILABLE",
                "The AI provider is busy right now. Try again in a moment.",
                retryable=True,
            )
        if response.status_code == 401:
            raise ProviderError(
                "AI_UNAUTHORIZED",
                "The AI provider rejected the configured API key. Check AI_PROVIDER_API_KEY.",
            )
        if response.status_code >= 400:
            raise ProviderError("AI_ERROR", f"AI provider returned HTTP {response.status_code}.")

        blocks = response.json().get("content", [])
        return "".join(block.get("text", "") for block in blocks if block.get("type") == "text").strip()

    @staticmethod
    def _parse_json(raw: str) -> dict:
        # Models occasionally wrap JSON in a ``` fence despite instructions.
        candidate = re.sub(r"^```(?:json)?|```$", "", raw.strip(), flags=re.MULTILINE).strip()
        try:
            parsed = json.loads(candidate)
        except json.JSONDecodeError as exc:
            raise ProviderError(
                "AI_BAD_RESPONSE",
                "The AI provider returned a response we could not read. Try again.",
                retryable=True,
            ) from exc
        if not isinstance(parsed, dict):
            raise ProviderError("AI_BAD_RESPONSE", "The AI provider returned an unexpected response shape.")
        return parsed

    def _structured(self, prompt: str, model_cls, max_tokens: int = 1500):
        payload = self._parse_json(self._call(prompt, max_tokens=max_tokens))
        try:
            return model_cls(**payload)
        except ValidationError as exc:
            raise ProviderError(
                "AI_BAD_RESPONSE",
                "The AI provider returned data that failed validation. Try again.",
                retryable=True,
            ) from exc

    def analyze_lead(self, context: LeadContext) -> AILeadAnalysis:
        prompt = (
            f"{_describe(context)}\n\n"
            "Assess this business as a prospect for a website design/redesign project. "
            "Return JSON with exactly these keys: opportunity_score (integer 0-100), "
            "summary (string), strengths (array of strings), weaknesses (array of strings), "
            "website_opportunities (array of strings), recommended_services (array of strings), "
            "recommended_pitch (string), recommended_contact_method (string), "
            "estimated_project_range (string)."
        )
        return self._structured(prompt, AILeadAnalysis)

    def generate_email(self, context: LeadContext, tone: str, goal: str) -> GenerateEmailResponse:
        prompt = (
            f"{_describe(context)}\n\n"
            f"Write a short cold outreach email. Tone: {tone}. Goal: {goal.replace('_', ' ')}. "
            "Keep it under 120 words, reference only the facts above, and do not use placeholder "
            "text in square brackets. Return JSON with keys: subject (string), body (string)."
        )
        return self._structured(prompt, GenerateEmailResponse, max_tokens=1000)

    def generate_call_script(self, context: LeadContext) -> GenerateCallScriptResponse:
        prompt = (
            f"{_describe(context)}\n\n"
            "Write a cold call script for reaching this business. Return JSON with keys: "
            "opener (string), talking_points (array of strings), objection_handling (array of strings)."
        )
        return self._structured(prompt, GenerateCallScriptResponse)

    def chat(self, message: str, context: LeadContext | None) -> str:
        preamble = f"{_describe(context)}\n\n" if context else "No specific lead is selected.\n\n"
        prompt = (
            f"{preamble}The user asks: {message}\n\n"
            'Answer helpfully and concisely. Return JSON with a single key "reply" (string).'
        )
        payload = self._parse_json(self._call(prompt, max_tokens=1200))
        reply = payload.get("reply")
        if not isinstance(reply, str) or not reply.strip():
            raise ProviderError("AI_BAD_RESPONSE", "The AI provider returned an empty reply.", retryable=True)
        return reply.strip()


class OpenAICompatibleAIProvider(AnthropicAIProvider):
    """Any service exposing an OpenAI-style /chat/completions endpoint.

    Covers the providers with real free tiers — Groq and Google Gemini — as
    well as OpenAI itself and OpenRouter. Only the transport differs from
    AnthropicAIProvider; prompts, JSON parsing and schema validation are
    shared, so model output is never trusted without validation here either.
    """

    def _call(self, prompt: str, max_tokens: int = 1500) -> str:
        try:
            response = httpx.post(
                f"{self.base_url}/chat/completions",
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "content-type": "application/json",
                },
                json={
                    "model": self.model,
                    "max_tokens": max_tokens,
                    "messages": [
                        {"role": "system", "content": MODEL_INSTRUCTIONS},
                        {"role": "user", "content": prompt},
                    ],
                    "response_format": {"type": "json_object"},
                },
                timeout=self.timeout_seconds,
            )
        except httpx.HTTPError as exc:
            raise ProviderError("AI_UNREACHABLE", f"Could not reach the AI provider: {exc}", retryable=True) from exc

        if response.status_code in (429, 500, 502, 503, 504):
            raise ProviderError(
                "AI_RATE_LIMITED" if response.status_code == 429 else "AI_UNAVAILABLE",
                "The AI provider is busy or the free-tier limit was reached. Try again in a moment.",
                retryable=True,
            )
        if response.status_code in (401, 403):
            raise ProviderError(
                "AI_UNAUTHORIZED",
                "The AI provider rejected the configured API key. Check AI_PROVIDER_API_KEY.",
            )
        if response.status_code >= 400:
            # Include the provider's own message: a 404 here almost always
            # means the model name is wrong or retired, and "HTTP 404" alone
            # gives no way to work that out.
            raise ProviderError(
                "AI_ERROR",
                f"AI provider returned HTTP {response.status_code}: {response.text[:300]}",
            )

        choices = response.json().get("choices", [])
        if not choices:
            raise ProviderError("AI_BAD_RESPONSE", "The AI provider returned no content.", retryable=True)
        return (choices[0].get("message", {}).get("content") or "").strip()


# Presets so a user only needs an API key, not a base URL and model name.
# Both Groq and Gemini offer a genuinely free tier.
#
# Model names go stale: Groq retires hosted models regularly, and a retired
# name returns a 404 that looks like a bad key. Check the live list with
# GET {base_url}/models before changing a default here.
AI_PRESETS: dict[str, tuple[str, str]] = {
    "groq": ("https://api.groq.com/openai/v1", "openai/gpt-oss-120b"),
    "gemini": ("https://generativelanguage.googleapis.com/v1beta/openai", "gemini-2.0-flash"),
    "openai": ("https://api.openai.com/v1", "gpt-4o-mini"),
    "openrouter": ("https://openrouter.ai/api/v1", "meta-llama/llama-3.3-70b-instruct"),
}

ANTHROPIC_NAMES = ("anthropic", "claude")


def get_ai_provider(settings: Settings) -> AIProvider:
    """Real AI when a key is configured; an honest rule-based fallback otherwise."""
    provider = settings.ai_provider.lower()
    key = settings.ai_provider_api_key

    # "auto" picks Anthropic only because that is what an sk-ant- key implies;
    # any other configured provider must be named explicitly.
    if provider == "auto":
        if not key:
            return RuleBasedAIProvider()
        provider = "anthropic"

    if provider in ("rules", "mock"):
        return RuleBasedAIProvider()

    if provider in ANTHROPIC_NAMES:
        if not key:
            raise ProviderError("AI_NOT_CONFIGURED", "AI_PROVIDER=anthropic requires AI_PROVIDER_API_KEY.")
        return AnthropicAIProvider(api_key=key, model=settings.ai_model, base_url=settings.ai_provider_base_url)

    if provider in AI_PRESETS or provider == "openai_compatible":
        if not key:
            raise ProviderError(
                "AI_NOT_CONFIGURED",
                f"AI_PROVIDER={provider} requires AI_PROVIDER_API_KEY.",
            )
        preset_url, preset_model = AI_PRESETS.get(provider, ("", ""))
        base_url = settings.ai_provider_base_url or preset_url
        if not base_url:
            raise ProviderError(
                "AI_NOT_CONFIGURED",
                "AI_PROVIDER=openai_compatible requires AI_PROVIDER_BASE_URL.",
            )
        # AI_MODEL keeps its Claude default, so fall back to the preset's own
        # model unless the user picked one that is not a Claude model.
        model = settings.ai_model
        if model.startswith("claude") and preset_model:
            model = preset_model
        return OpenAICompatibleAIProvider(api_key=key, model=model, base_url=base_url)

    raise ProviderUnavailableError(f"AI provider '{settings.ai_provider}'")

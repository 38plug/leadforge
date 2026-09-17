"""Guards against fabricated data reaching a real workspace."""

import pytest

from app.core.config import Settings
from app.providers.ai import (
    AnthropicAIProvider,
    OpenAICompatibleAIProvider,
    RuleBasedAIProvider,
    get_ai_provider,
)
from app.providers.business import MockBusinessProvider, OSMBusinessProvider, get_business_provider
from app.providers.email import RecordingEmailProvider, SMTPEmailProvider, get_email_provider
from app.providers.errors import ProviderError


def make_settings(**overrides) -> Settings:
    """Settings built from defaults only.

    `_env_file=None` keeps the developer's own apps/api/.env — which carries
    real provider choices and credentials — from leaking into assertions.
    """
    return Settings(_env_file=None, **overrides)


def test_business_provider_defaults_to_real_osm_data():
    assert isinstance(get_business_provider(make_settings()), OSMBusinessProvider)


def test_mock_business_provider_is_refused_in_production():
    with pytest.raises(RuntimeError, match="fabricated"):
        get_business_provider(make_settings(business_provider="mock", environment="production"))


def test_mock_business_provider_still_available_for_local_development():
    settings = make_settings(business_provider="mock", environment="development")
    assert isinstance(get_business_provider(settings), MockBusinessProvider)


def test_unknown_business_provider_fails_loudly_instead_of_falling_back_to_mock():
    with pytest.raises(NotImplementedError):
        get_business_provider(make_settings(business_provider="google_places"))


def test_ai_uses_anthropic_when_a_key_is_present():
    settings = make_settings(ai_provider="auto", ai_provider_api_key="test-key")
    assert isinstance(get_ai_provider(settings), AnthropicAIProvider)


def test_ai_falls_back_to_rules_without_a_key():
    assert isinstance(get_ai_provider(make_settings()), RuleBasedAIProvider)


def test_groq_free_tier_uses_the_openai_compatible_transport():
    provider = get_ai_provider(make_settings(ai_provider="groq", ai_provider_api_key="test-key"))
    assert isinstance(provider, OpenAICompatibleAIProvider)
    assert provider.base_url == "https://api.groq.com/openai/v1"


def test_a_preset_overrides_the_default_claude_model_name():
    # AI_MODEL still carries its Claude default, so asking for Gemini must
    # not end up sending "claude-sonnet-5" to Google.
    provider = get_ai_provider(make_settings(ai_provider="gemini", ai_provider_api_key="test-key"))
    assert provider.model == "gemini-2.0-flash"


def test_an_explicit_model_choice_is_respected():
    provider = get_ai_provider(
        make_settings(ai_provider="groq", ai_provider_api_key="test-key", ai_model="qwen/qwen3.8-27b")
    )
    assert provider.model == "qwen/qwen3.8-27b"


def test_a_named_ai_provider_without_a_key_fails_loudly():
    with pytest.raises(ProviderError):
        get_ai_provider(make_settings(ai_provider="groq"))


def test_email_sends_over_smtp_once_credentials_exist():
    settings = make_settings(smtp_host="smtp.gmail.com", smtp_username="u", smtp_password="p")
    assert isinstance(get_email_provider(settings), SMTPEmailProvider)


def test_email_does_not_pretend_to_send_without_smtp():
    assert isinstance(get_email_provider(make_settings()), RecordingEmailProvider)


def test_partial_smtp_config_does_not_count_as_configured():
    # A host with no credentials must not be treated as ready to send.
    assert isinstance(get_email_provider(make_settings(smtp_host="smtp.gmail.com")), RecordingEmailProvider)


def test_there_is_no_seed_script_left_to_inject_demo_leads():
    with pytest.raises(ModuleNotFoundError):
        __import__("app.db.seed")

from app.models.company import WebsiteStatus
from app.providers.website import HttpWebsiteProvider


def test_no_url_returns_no_website_status():
    provider = HttpWebsiteProvider()
    result = provider.detect_website(None)
    assert result.status == WebsiteStatus.NO_WEBSITE
    assert result.website_url is None


def test_unreachable_domain_returns_inaccessible_not_no_website():
    provider = HttpWebsiteProvider(timeout_seconds=2.0)
    result = provider.detect_website("this-domain-should-not-exist-leadforge-test.invalid")
    # A failed request must be classified as INACCESSIBLE, never silently
    # reclassified as "no website" — the business gave us a URL.
    assert result.status == WebsiteStatus.INACCESSIBLE
    assert result.website_url is not None

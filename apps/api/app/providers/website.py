"""
WebsiteProvider abstraction.

Detects whether a business has a live, healthy website. This is a critical
signal for lead scoring, so a single failed request must never be enough
to classify a company as NO_WEBSITE — we only use that status when no
website URL was supplied at all. Everything else is judged on the actual
HTTP response.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime, timezone

import httpx

from app.models.company import WebsiteStatus


@dataclass
class WebsiteCheckResult:
    website_url: str | None
    domain: str | None
    http_status: int | None
    ssl_status: bool | None
    redirect_url: str | None
    title: str | None
    description: str | None
    status: WebsiteStatus
    mobile_friendly: bool | None
    load_time_ms: int | None
    last_checked_at: str


class WebsiteProvider(ABC):
    @abstractmethod
    def detect_website(self, url: str | None) -> WebsiteCheckResult:
        ...

    @abstractmethod
    def analyze_website(self, url: str) -> WebsiteCheckResult:
        ...


def _extract_title(html: str) -> str | None:
    lower = html.lower()
    start = lower.find("<title>")
    end = lower.find("</title>")
    if start == -1 or end == -1:
        return None
    return html[start + 7 : end].strip()[:500] or None


def _normalize_url(url: str) -> str:
    if not url.startswith(("http://", "https://")):
        return f"https://{url}"
    return url


class HttpWebsiteProvider(WebsiteProvider):
    """
    Built-in provider that performs a real HTTP(S) request. Requires no API
    key, so it is always active. More advanced auditing (Lighthouse-style
    performance scoring, full mobile emulation) can be layered in later
    behind the same analyze_website() interface.
    """

    def __init__(self, timeout_seconds: float = 6.0):
        self.timeout_seconds = timeout_seconds

    def detect_website(self, url: str | None) -> WebsiteCheckResult:
        now = datetime.now(timezone.utc).isoformat()
        if not url:
            return WebsiteCheckResult(
                website_url=None, domain=None, http_status=None, ssl_status=None,
                redirect_url=None, title=None, description=None,
                status=WebsiteStatus.NO_WEBSITE, mobile_friendly=None, load_time_ms=None,
                last_checked_at=now,
            )
        return self.analyze_website(url)

    def analyze_website(self, url: str) -> WebsiteCheckResult:
        normalized = _normalize_url(url)
        now = datetime.now(timezone.utc).isoformat()
        try:
            start = datetime.now()
            with httpx.Client(follow_redirects=True, timeout=self.timeout_seconds) as client:
                response = client.get(normalized)
            load_time_ms = int((datetime.now() - start).total_seconds() * 1000)

            redirected = str(response.url) != normalized
            ssl_status = str(response.url).startswith("https://")
            title = _extract_title(response.text) if response.headers.get("content-type", "").startswith("text/html") else None

            if response.status_code >= 500:
                status = WebsiteStatus.INACCESSIBLE
            elif redirected:
                status = WebsiteStatus.REDIRECTED
            elif response.status_code >= 400:
                status = WebsiteStatus.INACCESSIBLE
            else:
                status = WebsiteStatus.ACTIVE

            return WebsiteCheckResult(
                website_url=normalized,
                domain=normalized.split("//")[-1].split("/")[0],
                http_status=response.status_code,
                ssl_status=ssl_status,
                redirect_url=str(response.url) if redirected else None,
                title=title,
                description=None,
                status=status,
                mobile_friendly=None,
                load_time_ms=load_time_ms,
                last_checked_at=now,
            )
        except httpx.RequestError:
            return WebsiteCheckResult(
                website_url=normalized,
                domain=normalized.split("//")[-1].split("/")[0],
                http_status=None,
                ssl_status=None,
                redirect_url=None,
                title=None,
                description=None,
                status=WebsiteStatus.INACCESSIBLE,
                mobile_friendly=None,
                load_time_ms=None,
                last_checked_at=now,
            )


def get_website_provider() -> WebsiteProvider:
    return HttpWebsiteProvider()

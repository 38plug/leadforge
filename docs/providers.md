# Provider Architecture

LeadForge is never tightly coupled to one vendor for business data, website checks, social discovery, AI, or email. Each concern is an abstract interface in `apps/api/app/providers/`, with a deterministic mock implementation that activates automatically whenever the real provider's API key is absent.

| Provider | Interface | File | Free/default | Mock | Paid alternative |
|---|---|---|---|---|---|
| Business search | `BusinessSearchProvider` | `providers/business.py` | `OSMBusinessProvider` — **real** businesses from OpenStreetMap (Nominatim + Overpass), no API key, no signup, no cost | `MockBusinessProvider` — deterministic fake businesses, used when `BUSINESS_PROVIDER=mock` | Google Places, Yelp Fusion, or a licensed business data vendor |
| Website detection | `WebsiteProvider` | `providers/website.py` | `HttpWebsiteProvider` — real HTTP(S) request, no API key required | *(not needed)* | — |
| Social discovery | `SocialProvider` | `providers/social.py` | — | `MockSocialProvider` (default) | Instagram Graph API, Meta APIs, or a social-data vendor — see the caveat below |
| AI | `AIProvider` | `providers/ai.py` | — | `MockAIProvider` — template-based, always returns schema-valid output | Any OpenAI/Anthropic-compatible chat completion endpoint |
| Email | `EmailProvider` | `providers/email.py` | — | `MockEmailProvider` — logs instead of sending | SendGrid, Postmark, SES, Resend, etc. |

## Business search: free by default (OpenStreetMap)

`BUSINESS_PROVIDER=osm` is the default — no signup, no API key, no cost. It geocodes the requested city/country with **Nominatim** (OSM's free geocoder) into a bounding box, then queries **Overpass** (OSM's free query API) for named points of interest tagged with the niche's corresponding OSM tag (e.g. `amenity=restaurant`, `shop=hairdresser`, `office=lawyer` — see `_OSM_NICHE_TAGS` in `business.py`). Returned fields (name, address, phone, website, opening hours, and occasionally a `contact:instagram` tag the business owner added themselves) are real, public OSM data.

**Chain outlets are excluded.** A franchise is a bad lead for a web designer — the site is decided at corporate and there's no local owner to sell to — so results tagged `brand:wikidata` (or `brand`) are dropped; see `_is_chain` in `business.py`. Because the filter runs after the query, the provider deliberately asks Overpass for `OVERFETCH_FACTOR`× the requested rows, so a franchise-heavy city centre still fills a page.

**Trade-offs vs. a paid Places API:**
- No star ratings or review counts — OSM doesn't track them, so those factors don't contribute to a lead's Opportunity Score (the biggest factor, "no website," is unaffected).
- Coverage and data completeness vary by region — dense in most of Europe, thinner in some other areas.
- The public Nominatim/Overpass instances are shared, rate-limited infrastructure (the provider self-throttles to ~1 geocode/sec per their usage policy) — fine for interactive use, not for bulk/high-volume scraping. If you outgrow it, self-host Nominatim/Overpass or switch to a paid provider — no other code changes needed, since routers only depend on the `BusinessSearchProvider` interface.

Set `OSM_CONTACT` (your email or project URL) to identify your traffic to OpenStreetMap per their usage policy — optional for light/occasional use.

**Mirror reliability.** The volunteer-run Overpass instances go busy or down often; in live testing, individual mirrors returned `429`/`504` or simply hung, several times an hour. Three behaviours in `OSMBusinessProvider` exist because of this, and are worth keeping if you touch the search path:

- **Every mirror is tried** (`OVERPASS_URLS`), because a single endpoint's outage otherwise looks to the user like "this city has no businesses".
- **The mirrors share one wall-clock budget** (`OVERPASS_TOTAL_BUDGET_SECONDS`, 60s) rather than each getting the full per-request timeout. Serially waiting out three 45s timeouts kept a user in front of a progress bar for ~108s before the error appeared; any mirror that can't be given at least `MIN_MIRROR_ATTEMPT_SECONDS` is skipped instead of started.
- **The starting mirror rotates** per search, so a saturated primary doesn't cost every search the first slice of its budget — and our load is spread across the volunteers rather than aimed at one of them.

A total failure raises a retryable `ProviderError`, never an empty result list — see "Why the website provider has no mock" below for the same principle applied elsewhere.

## Social discovery: why there's no free real option

Unlike Google Maps data, there's no free (or even paid, for most use cases) way to *search* Instagram for arbitrary public businesses — Meta's Graph API only manages content on accounts you already own, not third-party discovery, and building around that restriction (e.g. scraping) is exactly the kind of anti-bot evasion this project's compliance policy rules out (see `docs/compliance.md`). In practice, a business's Instagram handle is usually already present as a `contact:instagram` OSM tag when the owner has added it (surfaced automatically by `OSMBusinessProvider`) — real data, not scraped. Real programmatic Instagram discovery, if needed later, means a compliant, licensed social-data vendor behind the existing `SocialProvider` interface.

## Why the website provider has no "mock"

Detecting whether a business has a real, live website is core enough to the product that it ships as a genuine implementation (`HttpWebsiteProvider`) from day one — it just performs an HTTP GET and classifies the result. No credentials are required, so it is always active. This also matters for correctness: **a single failed request must never be reclassified as "no website"** — that status is reserved for businesses that had no website URL to check in the first place. A timeout or 5xx becomes `INACCESSIBLE`, a working redirect becomes `REDIRECTED`, and so on. See `tests/test_website_provider.py`.

## Adding a real provider

1. Implement the abstract interface in the relevant `providers/*.py` file (e.g. a `GooglePlacesProvider(BusinessSearchProvider)`).
2. Update the `get_*_provider()` factory function in the same file to return your implementation when `settings.<name>_provider != "mock"`.
3. Set the provider name and API key in `.env` (e.g. `BUSINESS_PROVIDER=google_places`, `BUSINESS_PROVIDER_API_KEY=...`).
4. No other code changes — routers and services depend only on the abstract interface.

## AI output validation

`AIProvider.analyze_lead()` must return an `AILeadAnalysis` (see `app/schemas/ai.py`). `AIService` re-validates the result against that Pydantic schema before it's ever persisted or shown to a user (`services/ai_service.py`), and falls back to a safe, clearly-labeled baseline response if the provider errors or returns something that doesn't validate. **Never trust raw AI output.**

## Error contract

Provider implementations should raise `ProviderError` (or a subclass like `ProviderUnavailableError`) on failure rather than letting arbitrary exceptions propagate. FastAPI's global handler (`app/main.py`) converts these into a structured `{code, message, retryable}` JSON response instead of a bare 500.

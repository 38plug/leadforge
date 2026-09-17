# Compliance & Responsible Data Use

LeadForge is built for legitimate B2B client acquisition using publicly available business information and properly licensed data sources — not mass scraping or spam.

## Data sourcing

- The `BusinessSearchProvider` interface is designed to be backed by licensed APIs (Google Places, Yelp Fusion, a paid business-data vendor) or properly permitted public datasets. It must never be implemented as unauthorized scraping, CAPTCHA bypass, or anti-bot evasion.
- The default provider (`OSMBusinessProvider`, `BUSINESS_PROVIDER=osm`) uses OpenStreetMap data, which is licensed under the **Open Database License (ODbL)**. That license requires attribution wherever the data (or a product derived from it) is publicly displayed — the app must credit **"© OpenStreetMap contributors"** with a link to https://www.openstreetmap.org/copyright on any screen that shows OSM-sourced business data (see the credit line in `apps/web/src/app/(app)/data-sources/page.tsx`). If you switch to a different free/paid provider, drop the OSM attribution and add whatever that provider's terms require instead.
- Requests to OpenStreetMap's shared Nominatim/Overpass infrastructure must stay within their usage policies (a descriptive `User-Agent`, self-imposed rate limiting) — already implemented in `OSMBusinessProvider`. Don't remove that throttling to "search faster"; it's what keeps the free service usable and keeps this app in compliance with the terms that make it free.
- `WebsiteProvider` performs ordinary, low-volume HTTP requests to check whether a business's own stated website is reachable — the same kind of request a browser makes. It does not attempt to bypass authentication or access private areas of a site.
- No feature in this codebase harvests private personal data, bypasses login walls, or targets private individuals. All business records are meant to represent public-facing companies (name, public contact info, public reviews/ratings).

## Outreach compliance

The campaign/email architecture (`Campaign`, `CampaignRecipient`, `SuppressionEntry`, `EmailEvent` models) is designed around compliant sending from the start:

- **Suppression list.** Every send checks `SuppressionEntry` first; unsubscribes, bounces, and manual opt-outs all land there and are respected by future campaigns.
- **Unsubscribe.** Outreach templates are expected to include an unsubscribe mechanism; recipients who unsubscribe are automatically suppressed.
- **Bounce handling.** `CampaignRecipient.bounced_at` and `EmailEvent` record delivery failures so bad addresses stop being retried.
- **Reply detection stops follow-ups.** If a recipient replies, their remaining steps in a follow-up sequence are cancelled — see the sequence rules in `docs/development.md` Phase 5.
- **Sending limits.** `Campaign.daily_send_limit` caps outbound volume per campaign to respect ESP/provider sending limits and avoid spam-like bursts.
- **Duplicate prevention.** A recipient is uniquely tied to one `(campaign_id, lead_id)` pair; the same lead is never enqueued twice in the same campaign.
- **Audit logs.** `LeadActivity` and `EmailEvent` provide a durable trail of what was sent, when, and what happened to it.
- **Clear sender identity.** `Campaign.sender` and `reply_to` are required fields — no anonymous or spoofed sending.

## Data subject rights

Because every business/lead record belongs to a `Workspace`, deleting a workspace's data (export or hard delete) is a well-defined operation scoped to that tenant — no cross-tenant cleanup logic is required. Implement the actual export/delete endpoints as part of Phase 8 (production hardening) before onboarding real customer data.

## What this product will not do

- No credential theft, authentication bypass, or CAPTCHA solving.
- No proxy rotation or fingerprint evasion designed to defeat a platform's anti-bot controls.
- No scraping of private/gated content or private individuals' personal data.
- No sending infrastructure designed to evade spam filters or provider sending policies.

If a future integration would require any of the above, it does not belong in this codebase — find a licensed API or a compliant alternative instead.

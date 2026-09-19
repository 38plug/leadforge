"""
BusinessSearchProvider abstraction.

LeadForge must never be tightly coupled to a single business-data source
(e.g. one maps/places API). Real implementations plug in here behind the
same interface the rest of the app depends on; swapping providers never
requires touching routers, services, or the frontend.
"""

import logging
import random
import time
from abc import ABC, abstractmethod
from collections.abc import Callable
from dataclasses import dataclass, field

import httpx

from app.core.config import Settings
from app.providers.errors import ProviderError

logger = logging.getLogger("leadforge.providers.business")

# Largest bounding box (in degrees) a single search will cover. ~0.24° is
# roughly a 25km box — big enough for a city's commercial core, small enough
# that the free Overpass instance answers within its timeout.
MAX_BBOX_SPAN_DEGREES = 0.24

# A search is an interactive action: the user is watching a progress bar. The
# mirrors therefore share one wall-clock budget rather than each getting the
# full per-request timeout. Trying three mirrors back-to-back at 45s each let a
# failing search hold the user for ~108s (measured against the live mirrors)
# before showing an error — long past the point they'd have given up.
#
# Split across four mirrors this leaves ~22s each. The slowest instance that
# still answers reliably took 21s when measured, and cutting it off just before
# it responds turns a working search into an outage message.
OVERPASS_TOTAL_BUDGET_SECONDS = 90.0

# Below this there isn't enough budget left for a mirror to plausibly answer,
# so the remaining ones are skipped instead of being burned on a doomed attempt
# that would only delay the error the user needs to see.
MIN_MIRROR_ATTEMPT_SECONDS = 12.0

# Chain outlets are filtered out after the query, so more rows are requested
# than the caller asked for. Overpass' cost is dominated by scanning the box,
# not by how many matches it returns, so this is close to free.
# How long a mirror stays deprioritised after it fails. Long enough that a
# burst of searches doesn't keep rediscovering the same dead instance,
# short enough that a mirror which recovers is used again promptly.
MIRROR_COOLDOWN_SECONDS = 300.0

# Widest box a country-level search will use. Beyond this a bounding box stops
# describing anywhere in particular, so the search is centred on the country's
# own coordinates instead. ~24 degrees covers a large populated region while
# still being somewhere rather than everywhere.
MAX_COUNTRY_SPAN_DEGREES = 24.0

OVERFETCH_FACTOR = 3
MAX_OVERPASS_LIMIT = 300


@dataclass
class BusinessSearchFilters:
    country: str | None = None
    city: str | None = None
    niche: str | None = None
    min_rating: float | None = None
    min_reviews: int | None = None
    max_reviews: int | None = None
    limit: int = 25


@dataclass
class GeocodeResult:
    """A resolved place: the (possibly clamped) search box plus the geocoder's
    canonical name for it, used to normalise however the user typed the city."""

    bbox: tuple[float, float, float, float]
    canonical_city: str | None = None


@dataclass
class BusinessResult:
    external_ref: str
    name: str
    niche: str
    country: str
    city: str
    address: str | None = None
    maps_url: str | None = None
    rating: float | None = None
    reviews_count: int | None = None
    phone: str | None = None
    email: str | None = None
    website: str | None = None
    instagram: str | None = None
    hours: str | None = None
    description: str | None = None
    social: dict = field(default_factory=dict)


class BusinessSearchProvider(ABC):
    @abstractmethod
    def search(self, filters: BusinessSearchFilters) -> list[BusinessResult]:
        ...

    @abstractmethod
    def get_details(self, external_ref: str) -> BusinessResult | None:
        ...


class MockBusinessProvider(BusinessSearchProvider):
    """Deterministic, offline business search used whenever no real API key is configured."""

    _NICHES = [
        "Restaurant", "Barber", "Beauty Salon", "Dentist", "Gym", "Hotel", "Real Estate",
        "Auto Repair", "Plumber", "Electrician", "Law Firm", "Accountant", "Photographer",
        "Cleaning", "Cafe", "Retail",
    ]

    def search(self, filters: BusinessSearchFilters) -> list[BusinessResult]:
        rng = random.Random(f"{filters.city}-{filters.niche}-{filters.country}")
        niche = filters.niche or rng.choice(self._NICHES)
        city = filters.city or "Springfield"
        country = filters.country or "United States"
        count = min(filters.limit, rng.randint(5, filters.limit))

        results = []
        for i in range(count):
            has_website = rng.random() > 0.55
            rating = round(rng.uniform(3.6, 5.0), 1)
            reviews = rng.randint(8, 620)
            if filters.min_rating and rating < filters.min_rating:
                continue
            if filters.min_reviews and reviews < filters.min_reviews:
                continue
            if filters.max_reviews and reviews > filters.max_reviews:
                continue
            results.append(
                BusinessResult(
                    external_ref=f"mock-{niche}-{city}-{i}".lower().replace(" ", "-"),
                    name=f"{niche} {['Co.', 'Studio', 'Group', 'Partners', 'House'][i % 5]} #{i + 1}",
                    niche=niche,
                    country=country,
                    city=city,
                    address=f"{100 + i} Main St, {city}",
                    maps_url=f"https://maps.google.com/?q={niche}+{city}+{i}",
                    rating=rating,
                    reviews_count=reviews,
                    phone=f"+1 555 010{i:04d}" if rng.random() > 0.3 else None,
                    email=f"contact{i}@{niche.lower().replace(' ', '')}{i}.com" if rng.random() > 0.5 else None,
                    website=f"{niche.lower().replace(' ', '')}{i}.com" if has_website else None,
                    instagram=f"{niche.lower().replace(' ', '')}{city.lower()}" if rng.random() > 0.4 else None,
                    hours="Mon-Sat 9:00 AM - 6:00 PM",
                    description=f"A local {niche.lower()} business serving {city}.",
                )
            )
        return results

    def get_details(self, external_ref: str) -> BusinessResult | None:
        results = self.search(BusinessSearchFilters(limit=25))
        return next((r for r in results if r.external_ref == external_ref), None)


# OSM tag(s) that best approximate each niche. Values are (key, value) pairs;
# a niche may map to more than one tag (e.g. "Dentist" also appears as a
# clinic in some areas). Unmapped/custom niches fall back to a generic
# "named place of business" query so a search never returns nothing just
# because the niche string is unusual.
_OSM_NICHE_TAGS: dict[str, list[tuple[str, str]]] = {
    "restaurant": [("amenity", "restaurant")],
    "cafe": [("amenity", "cafe")],
    "barber": [("shop", "hairdresser")],
    "beauty salon": [("shop", "beauty"), ("shop", "hairdresser")],
    "dentist": [("amenity", "dentist")],
    "dental clinic": [("amenity", "dentist")],
    "medical clinic": [("amenity", "clinic"), ("amenity", "doctors")],
    "gym": [("leisure", "fitness_centre")],
    "fitness": [("leisure", "fitness_centre")],
    "hotel": [("tourism", "hotel")],
    "real estate": [("office", "estate_agent")],
    "auto repair": [("shop", "car_repair")],
    "plumber": [("craft", "plumber")],
    "electrician": [("craft", "electrician")],
    "law firm": [("office", "lawyer")],
    "accountant": [("office", "accountant")],
    "photographer": [("craft", "photographer"), ("shop", "photo")],
    "construction": [("office", "construction_company"), ("craft", "builder")],
    "cleaning": [("craft", "cleaning")],
    "retail": [("shop", "clothes"), ("shop", "convenience")],
    "professional services": [("office", "company")],
}


class OSMBusinessProvider(BusinessSearchProvider):
    """
    Free, keyless business discovery backed by OpenStreetMap: Nominatim for
    geocoding a city/country into a bounding box, and the Overpass API for
    querying tagged points of interest inside it. No account, no API key,
    no cost.

    Trade-offs vs. a paid Places API: no ratings or review counts (OSM
    doesn't track them), and coverage/data completeness varies by region —
    but name, address, phone, website, hours, and occasionally a business's
    own contact:instagram tag are real, public, and free.
    """

    NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"

    # Overpass is run by volunteers and individual instances go down or get
    # saturated regularly — the main one returns 504 under load. Depending on
    # a single endpoint made routine outages look to the user like "this city
    # has no businesses", so every mirror is tried before giving up.
    OVERPASS_URLS = (
        "https://overpass-api.de/api/interpreter",
        "https://overpass.kumi.systems/api/interpreter",
        "https://overpass.private.coffee/api/interpreter",
        # Slower than the others (~20s) but answering when the rest were not,
        # which is exactly when a fourth mirror earns its place. Regional
        # mirrors are deliberately excluded: overpass.osm.ch, for instance,
        # answers 200 with zero elements outside Switzerland, which would read
        # as "no businesses here" rather than as a failure.
        "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
    )

    _last_nominatim_call: float = 0.0

    # Which mirror the next search starts from. Always starting at the head of
    # the list meant a saturated primary cost every single search the first
    # slice of its budget; rotating spreads our load across the volunteers too.
    _mirror_cursor: int = 0

    # url -> monotonic time of its last failure. Shared across requests so
    # one search's discovery that a mirror is down benefits the next.
    _mirror_failed_at: dict[str, float] = {}

    def __init__(
        self,
        contact: str | None = None,
        timeout_seconds: float = 45.0,
        total_budget_seconds: float = OVERPASS_TOTAL_BUDGET_SECONDS,
    ):
        # Nominatim's usage policy requires a descriptive User-Agent so they
        # can identify (and if needed contact) heavy/misbehaving clients.
        # No personal data is sent — just a project identifier.
        contact_suffix = f" ({contact})" if contact else ""
        self.user_agent = f"LeadForge-App/0.1{contact_suffix}"
        self.timeout_seconds = timeout_seconds
        self.total_budget_seconds = total_budget_seconds

    def _respect_nominatim_rate_limit(self) -> None:
        # Nominatim's free public instance asks for max 1 request/second.
        elapsed = time.monotonic() - OSMBusinessProvider._last_nominatim_call
        if elapsed < 1.1:
            time.sleep(1.1 - elapsed)
        OSMBusinessProvider._last_nominatim_call = time.monotonic()

    def _geocode(self, city: str | None, country: str | None) -> GeocodeResult | None:
        query = ", ".join(part for part in [city, country] if part)
        if not query:
            return None
        self._respect_nominatim_rate_limit()
        try:
            with httpx.Client(timeout=self.timeout_seconds, headers={"User-Agent": self.user_agent}) as client:
                response = client.get(self.NOMINATIM_URL, params={"q": query, "format": "json", "limit": 1})
                response.raise_for_status()
                results = response.json()
        except Exception as exc:  # noqa: BLE001 — a free third-party service must never crash a search
            logger.warning("Nominatim geocoding failed for %r: %s", query, exc)
            return None
        if not results:
            return None
        place = results[0]
        south, north, west, east = (float(v) for v in place["boundingbox"])
        bbox = self._clamp_bbox(
            south,
            west,
            north,
            east,
            centre_lat=float(place["lat"]),
            centre_lon=float(place["lon"]),
        )
        # Nominatim's canonical name for the place, so a lead saved from a
        # search for "koln" is stored as "Köln" rather than whatever casing
        # and accents the user happened to type.
        canonical = str(place.get("display_name", "")).split(",")[0].strip() or None
        return GeocodeResult(bbox=bbox, canonical_city=canonical)

    @staticmethod
    def _clamp_bbox(
        south: float,
        west: float,
        north: float,
        east: float,
        centre_lat: float,
        centre_lon: float,
        max_span: float = MAX_BBOX_SPAN_DEGREES,
    ) -> tuple[float, float, float, float]:
        """
        Shrink an oversized bounding box around the place's own coordinates.

        Some administrative areas are far larger than the city a user has in
        mind — Nominatim's box for "Tokyo" spans Tokyo Metropolis including
        the Ogasawara islands ~1,000km out in the Pacific. Querying all of it
        makes Overpass time out.

        Crucially this clamps around `centre_lat`/`centre_lon` (Nominatim's
        representative point for the place, i.e. the city itself) rather than
        the midpoint of the box: the midpoint of a lopsided box like Tokyo's
        lands in open ocean, which would return zero businesses. Boxes already
        within the limit are returned untouched.
        """
        if north - south <= max_span and east - west <= max_span:
            return south, west, north, east

        half = max_span / 2
        return (
            max(south, centre_lat - half),
            max(west, centre_lon - half),
            min(north, centre_lat + half),
            min(east, centre_lon + half),
        )

    # "Any industry" must mean any business, not one obscure tag. In OSM,
    # shop=yes literally means "a shop whose type nobody recorded" — matching
    # only that missed every restaurant, cafe and hairdresser in the city.
    # A value of None here means "this key exists with any value".
    # Kept deliberately short. Overpass cost scales with the number of
    # statements, and the free instances are slow enough that a long union
    # times out before it returns anything — a broad search that fails is
    # worth less than a slightly narrower one that works.
    _ANY_BUSINESS_TAGS: list[tuple[str, str | None]] = [
        ("shop", None),
        ("office", None),
        ("amenity", "restaurant|cafe|bar|fast_food|pub|dentist|doctors|pharmacy|veterinary"),
    ]

    def _tags_for_niche(self, niche: str | None) -> list[tuple[str, str | None]]:
        if not niche:
            return list(self._ANY_BUSINESS_TAGS)
        return _OSM_NICHE_TAGS.get(niche.strip().lower(), [("office", "company")])

    def _overpass_query(
        self,
        bbox: tuple[float, float, float, float],
        tags: list[tuple[str, str | None]],
        limit: int,
        server_budget_seconds: int,
    ) -> str:
        south, west, north, east = bbox
        clauses = ""
        for key, value in tags:
            if value is None:
                selector = f'["{key}"]'
            elif "|" in value:
                # One regex statement instead of one per value — materially
                # cheaper on a loaded Overpass instance.
                selector = f'["{key}"~"^({value})$"]'
            else:
                selector = f'["{key}"="{value}"]'
            # nwr covers nodes, ways and relations in a single statement,
            # halving the statement count versus separate node/way lines.
            clauses += f'  nwr{selector}["name"]({south},{west},{north},{east});\n'
        # The server-side budget is deliberately shorter than our HTTP
        # timeout, so a slow mirror returns an error we can act on instead of
        # holding the connection open until the client gives up.
        return f"[out:json][timeout:{server_budget_seconds}];\n(\n{clauses});\nout center {limit};"

    def _mirrors_in_rotation(self) -> tuple[str, ...]:
        """The mirrors to try, healthy ones first.

        Rotation alone made every search re-learn which instances are down: a
        user clicking "Find Leads" would spend the whole budget on two dead
        mirrors, see an outage message, and have to click again. Mirrors that
        failed recently are moved to the back instead of being dropped, so a
        recovered instance is still reachable and a total outage still tries
        everything before giving up.
        """
        cls = OSMBusinessProvider
        offset = cls._mirror_cursor % len(cls.OVERPASS_URLS)
        cls._mirror_cursor = offset + 1
        rotated = cls.OVERPASS_URLS[offset:] + cls.OVERPASS_URLS[:offset]

        now = time.monotonic()
        healthy = [u for u in rotated if now - cls._mirror_failed_at.get(u, 0.0) >= MIRROR_COOLDOWN_SECONDS]
        cooling = [u for u in rotated if u not in healthy]
        return tuple(healthy + cooling)

    @classmethod
    def _every_mirror_is_cooling_down(cls) -> bool:
        """True when every mirror failed recently enough to still be in cooldown."""
        now = time.monotonic()
        return all(
            now - cls._mirror_failed_at.get(url, 0.0) < MIRROR_COOLDOWN_SECONDS
            for url in cls.OVERPASS_URLS
        )

    @classmethod
    def _record_mirror_failure(cls, url: str) -> None:
        cls._mirror_failed_at[url] = time.monotonic()

    @classmethod
    def _record_mirror_success(cls, url: str) -> None:
        cls._mirror_failed_at.pop(url, None)

    def _run_overpass(self, build_query: Callable[[int], str]) -> list[dict]:
        """Ask Overpass mirrors in turn, returning the first real answer.

        The mirrors share one wall-clock budget (`total_budget_seconds`), so a
        run of slow/saturated mirrors surfaces an error while the user is still
        watching rather than after minutes of silence. `build_query` is called
        per attempt with the server-side timeout that fits the budget left.

        A failure here is NOT the same as "this city has no matching
        businesses". Reporting an outage as an empty result set would tell
        the user they had exhausted the area when they had not, so once
        every mirror has failed this raises rather than returning [].
        """
        failures: list[str] = []
        deadline = time.monotonic() + self.total_budget_seconds
        mirrors = self._mirrors_in_rotation()

        for index, url in enumerate(mirrors):
            remaining = deadline - time.monotonic()
            if remaining < MIN_MIRROR_ATTEMPT_SECONDS:
                skipped = mirrors[index:]
                failures.append(f"{len(skipped)} mirror(s) skipped — {self.total_budget_seconds:.0f}s budget spent")
                logger.info("Overpass budget exhausted; skipping %s", ", ".join(skipped))
                break

            # Each mirror still waiting gets an equal share of what is left.
            # Giving the first mirror the full per-request timeout let one hung
            # instance eat the whole budget and leave a healthy mirror further
            # down the list untried — the common case, since at any moment
            # some of these volunteer instances are unresponsive.
            mirrors_left = len(mirrors) - index
            attempt_timeout = min(
                self.timeout_seconds,
                max(MIN_MIRROR_ATTEMPT_SECONDS, remaining / mirrors_left),
            )
            # Keep the server's own budget under our HTTP timeout so a slow
            # mirror answers with an error we can act on rather than holding
            # the connection until the client gives up.
            query = build_query(max(10, int(attempt_timeout) - 5))

            try:
                with httpx.Client(
                    timeout=attempt_timeout, headers={"User-Agent": self.user_agent}
                ) as client:
                    response = client.post(url, data={"data": query})

                # 429/5xx mean this mirror is saturated, not that the query
                # is wrong — move on to the next one.
                if response.status_code in (429, 502, 503, 504):
                    self._record_mirror_failure(url)
                    failures.append(f"{url} -> HTTP {response.status_code}")
                    logger.info("Overpass mirror busy (%s): HTTP %s", url, response.status_code)
                    continue

                response.raise_for_status()
                self._record_mirror_success(url)
                return response.json().get("elements", [])
            except Exception as exc:  # noqa: BLE001 — try the next mirror
                self._record_mirror_failure(url)
                failures.append(f"{url} -> {type(exc).__name__}")
                logger.info("Overpass mirror failed (%s): %s", url, exc)

        logger.warning("All Overpass mirrors failed: %s", "; ".join(failures))
        raise ProviderError(
            code="PROVIDER_UNAVAILABLE",
            message=(
                "OpenStreetMap's free search service is not responding right now — this is "
                "an outage on their side, not a problem with your filters. It usually clears "
                "within a few minutes, so try again shortly. A smaller city or a specific "
                "niche also makes the query lighter and more likely to succeed."
            ),
            retryable=True,
        )

    def search(self, filters: BusinessSearchFilters) -> list[BusinessResult]:
        if not filters.city:
            # The bounding box is clamped to ~25km so Overpass can answer at
            # all, which turns a country-wide search into "whatever happens to
            # be near the country's centroid" — 3 rural results for Portugal in
            # live testing. Returning nothing hands the search to a source that
            # can cover a whole country instead of quietly answering the wrong
            # question.
            logger.info("Overpass skipped: no city given, area too large to scan")
            return []

        if self._every_mirror_is_cooling_down():
            # Nothing is learned by spending the whole budget re-confirming an
            # outage discovered moments ago. Handing over immediately turns a
            # 90-second failure into a two-second answer from another source.
            logger.info("Overpass skipped: every mirror failed recently")
            return []

        place = self._geocode(filters.city, filters.country)
        if not place:
            logger.info("OSM search: could not geocode city=%r country=%r", filters.city, filters.country)
            return []

        tags = self._tags_for_niche(filters.niche)
        # Chains are dropped after the query (Overpass can't express "not a
        # chain" cheaply), so ask for more than we need — otherwise a city
        # centre full of franchises returns a nearly empty page of leads.
        overpass_limit = min(filters.limit * OVERFETCH_FACTOR, MAX_OVERPASS_LIMIT)
        elements = self._run_overpass(
            lambda server_budget: self._overpass_query(
                place.bbox, tags, overpass_limit, server_budget
            )
        )

        niche_label = filters.niche or "Business"
        results: list[BusinessResult] = []
        for element in elements:
            tags_dict = element.get("tags", {})
            name = tags_dict.get("name")
            if not name:
                continue
            if self._is_chain(tags_dict):
                continue

            lat = element.get("lat") or element.get("center", {}).get("lat")
            lon = element.get("lon") or element.get("center", {}).get("lon")

            address_parts = [
                tags_dict.get("addr:housenumber"),
                tags_dict.get("addr:street"),
            ]
            address = " ".join(p for p in address_parts if p) or None
            # Prefer the business's own address tag, then the geocoder's
            # canonical place name, and only fall back to the raw user input.
            city_from_tags = (
                tags_dict.get("addr:city") or place.canonical_city or filters.city or ""
            )

            results.append(
                BusinessResult(
                    external_ref=f"osm-{element['type']}-{element['id']}",
                    name=name,
                    niche=niche_label,
                    country=filters.country or tags_dict.get("addr:country") or "",
                    city=city_from_tags,
                    address=address,
                    maps_url=f"https://www.openstreetmap.org/{element['type']}/{element['id']}" if not lat else f"https://maps.google.com/?q={lat},{lon}",
                    rating=None,
                    reviews_count=None,
                    phone=tags_dict.get("contact:phone") or tags_dict.get("phone"),
                    email=tags_dict.get("contact:email") or tags_dict.get("email"),
                    website=tags_dict.get("contact:website") or tags_dict.get("website"),
                    instagram=self._extract_instagram_handle(tags_dict),
                    hours=tags_dict.get("opening_hours"),
                    description=None,
                )
            )
            if len(results) >= filters.limit:
                break

        return results

    @staticmethod
    def _is_chain(tags_dict: dict) -> bool:
        """Is this outlet part of a chain rather than an independent business?

        A Starbucks or a Subway franchise is a bad lead for a web designer:
        the site is decided at corporate, and there's no local owner to sell
        to. A live "any industry" search of central Austin came back led by
        two Starbucks, a Subway and a PetSmart, which is what this filters.

        `brand:wikidata` is the reliable signal — mappers attach it to outlets
        of a known brand, and an independent business essentially never has
        one. `brand` alone is accepted as a weaker fallback for the same idea.
        """
        return bool(tags_dict.get("brand:wikidata") or tags_dict.get("brand"))

    @staticmethod
    def _extract_instagram_handle(tags_dict: dict) -> str | None:
        raw = tags_dict.get("contact:instagram") or tags_dict.get("instagram")
        if not raw:
            return None
        # OSM sometimes stores a full URL, sometimes a bare handle.
        return raw.rstrip("/").split("/")[-1].lstrip("@") or None

    def get_details(self, external_ref: str) -> BusinessResult | None:
        # Overpass has no simple by-id lookup that matches our search shape
        # cheaply; details are already captured at search time and persisted,
        # so this is not on the hot path today.
        return None


# Nominatim answers a category search only for phrases it recognises, and the
# vocabulary is narrower than it looks. Every phrase below was checked against
# central Berlin - dense and well mapped, so a phrase finding nothing there is
# the phrase failing rather than the area being empty.
#
# Several plausible-sounding phrases return nothing at all: "gyms",
# "plumbers", "accountants", "lawyers", "estate agents", "builders",
# "cleaning services", "car repair shops". They are listed here as a warning
# against reintroducing them.
#
# Each niche maps to a list, tried in order until one produces results, so a
# phrase that works in one region can be backed by an alternative elsewhere.
_NOMINATIM_NICHE_PHRASES: dict[str, tuple[str, ...]] = {
    "restaurant": ("restaurants",),
    "cafe": ("cafes", "coffee"),
    "barber": ("hairdressers", "barbers"),
    "beauty salon": ("beauty shops", "hairdressers"),
    "dentist": ("dentists",),
    "dental clinic": ("dentists",),
    "medical clinic": ("clinics", "doctors"),
    # "gyms" and "fitness centres" both return nothing; sports centres is the
    # phrase OSM's data actually answers to.
    "gym": ("sports centres", "fitness"),
    "fitness": ("sports centres", "fitness"),
    "hotel": ("hotels", "guest houses"),
    # "car repair shops" returns nothing; the singular and plural without
    # "shops" both work.
    "auto repair": ("car repairs", "car repair"),
    "photographer": ("photographers", "photo shops"),
    # "laundries" is the closest category OSM records. It is a narrower trade
    # than general cleaning, so it is offered rather than pretended to be the
    # same thing.
    "cleaning": ("laundries",),
    "retail": ("supermarkets", "convenience stores", "clothes shops"),
    "e-commerce": ("offices",),
    "professional services": ("offices",),
    "electrician": ("electricians", "electronics shops"),
}

# Niches OSM records but Nominatim's phrase search cannot reach. Every phrase
# tried for these returned nothing, in every wording. They are still findable
# through Overpass, which queries tags directly (office=lawyer, craft=plumber,
# office=estate_agent), and Overpass runs whenever a city is given - so these
# work in a city search and not in a country-wide one. Naming them lets the
# search say so instead of returning an empty list that reads as "no such
# businesses exist here".
NICHES_NEEDING_A_CITY = frozenset(
    {
        "plumber",
        "accountant",
        "law firm",
        "real estate",
        "construction",
    }
)

# "Any industry" has to mean a genuine cross-section of local business, not
# one trade. Nominatim has no phrase meaning "any business", so a spread of
# categories is queried and the results interleaved.
#
# The list is deliberately varied - food, personal care, health, trade,
# retail, hospitality - because a user choosing "any" is looking for whatever
# is out there, and four food-adjacent categories returned a page of
# restaurants that looked like the search was broken.
#
# Every phrase here is one measured as working; see _NOMINATIM_NICHE_PHRASES
# for the ones that silently return nothing.
_NOMINATIM_ANY_BUSINESS_PHRASES = (
    "restaurants",
    "hairdressers",
    "supermarkets",
    "car repairs",
    "dentists",
    "hotels",
    "clothes shops",
    "cafes",
    "sports centres",
    "bakeries",
    "pharmacies",
    "photographers",
)


class NominatimBusinessProvider(BusinessSearchProvider):
    """
    Business discovery through Nominatim's search API rather than Overpass.

    Overpass is purpose-built for this kind of query and returns far more per
    request, so it stays the primary source. But the volunteer Overpass
    instances are frequently unresponsive - measured against the live service,
    only 3 searches in 5 completed - and a lead finder that fails half the time
    is not a product. Nominatim is a different service on better-provisioned
    infrastructure, and it answers the same question in a few seconds.

    Every search is confined to a bounding box. An unbounded text search for
    "restaurants in Lisbon" returns Lisbon, Iowa: real businesses, wrong
    continent, and nothing in the result to tell the user.
    """

    SEARCH_URL = "https://nominatim.openstreetmap.org/search"

    # Nominatim caps a single response below this; asking for more simply
    # returns everything it has.
    MAX_RESULTS_PER_QUERY = 50

    def __init__(self, contact: str | None = None, timeout_seconds: float = 30.0):
        contact_suffix = f" ({contact})" if contact else ""
        self.user_agent = f"LeadForge-App/0.1{contact_suffix}"
        self.timeout_seconds = timeout_seconds
        # Set while resolving the search area; results outside it are dropped.
        self._expected_country_code: str | None = None

    def _phrases_for_niche(self, niche: str | None) -> tuple[str, ...]:
        """Phrases to try for a niche, in order.

        An unmapped niche falls through to its own text, which still matches
        business names even when it is not a category Nominatim knows.
        """
        if not niche:
            return _NOMINATIM_ANY_BUSINESS_PHRASES
        key = niche.strip().lower()
        return _NOMINATIM_NICHE_PHRASES.get(key, (niche.strip(),))

    @staticmethod
    def needs_a_city(niche: str | None) -> bool:
        """True when this niche is only reachable through a city search."""
        return bool(niche) and niche.strip().lower() in NICHES_NEEDING_A_CITY

    def _place_bbox(self, city: str | None, country: str | None) -> GeocodeResult | None:
        """Resolve the area to search.

        Deliberately NOT clamped the way the Overpass path is: a country-wide
        search is a legitimate request here, and Nominatim is looking places up
        in an index rather than scanning an area.
        """
        query = ", ".join(part for part in [city, country] if part)
        if not query:
            return None

        OSMBusinessProvider._respect_nominatim_rate_limit(self)
        try:
            with httpx.Client(timeout=self.timeout_seconds, headers={"User-Agent": self.user_agent}) as client:
                response = client.get(
                    self.SEARCH_URL,
                    # addressdetails so the country can be read back: a
                    # country's bounding box overlaps its neighbours, and
                    # results must not drift across the border.
                    params={"q": query, "format": "json", "limit": 1, "addressdetails": 1},
                )
                response.raise_for_status()
                results = response.json()
        except Exception as exc:  # noqa: BLE001 - a geocode failure must not crash a search
            logger.warning("Nominatim geocoding failed for %r: %s", query, exc)
            return None
        if not results:
            return None

        place = results[0]
        south, north, west, east = (float(v) for v in place["boundingbox"])
        canonical = str(place.get("display_name", "")).split(",")[0].strip() or None
        self._expected_country_code = ((place.get("address") or {}).get("country_code") or "").lower() or None

        south, west, north, east = self._usable_bbox(
            south, west, north, east, float(place["lat"]), float(place["lon"])
        )
        return GeocodeResult(bbox=(south, west, north, east), canonical_city=canonical)

    @staticmethod
    def _usable_bbox(
        south: float,
        west: float,
        north: float,
        east: float,
        centre_lat: float,
        centre_lon: float,
        max_span: float = MAX_COUNTRY_SPAN_DEGREES,
    ) -> tuple[float, float, float, float]:
        """Return a box that still describes the place when used as a rectangle.

        Some countries have boxes that are useless as rectangles. The United
        States reaches across the antimeridian because of the Aleutians, so its
        box spans nearly the whole planet and a search inside it returned 2
        businesses for the entire country. Russia and New Zealand have the same
        problem.

        Where the box is unusable the search is centred on the country's own
        representative point instead. That covers a populated region rather
        than an ocean, which is the difference between a country-wide search
        returning a usable sample and returning nothing.
        """
        spans_antimeridian = east < west
        too_wide = (east - west) > max_span or (north - south) > max_span

        if not spans_antimeridian and not too_wide:
            return south, west, north, east

        half = max_span / 2
        return (
            max(-90.0, centre_lat - half),
            max(-180.0, centre_lon - half),
            min(90.0, centre_lat + half),
            min(180.0, centre_lon + half),
        )

    def search(self, filters: BusinessSearchFilters) -> list[BusinessResult]:
        place = self._place_bbox(filters.city, filters.country)
        if not place:
            logger.info(
                "Nominatim search: could not resolve city=%r country=%r",
                filters.city,
                filters.country,
            )
            return []

        south, west, north, east = place.bbox
        results: list[BusinessResult] = []
        seen: set[str] = set()

        base_params: dict[str, str | int] = {
            "format": "jsonv2",
            "limit": self.MAX_RESULTS_PER_QUERY,
            "extratags": 1,
            "addressdetails": 1,
        }

        # The viewbox is what actually produces volume: it anchors the search
        # geographically, and Nominatim returns very little without one -
        # filtering by country alone dropped Portugal from 25 results to 2.
        # bounded=1 makes it a hard restriction rather than a preference,
        # without which results leak to a same-named place elsewhere.
        base_params["viewbox"] = f"{west},{north},{east},{south}"
        base_params["bounded"] = 1
        if self._expected_country_code:
            # Belt and braces: the box is a rectangle and a country is not, so
            # this keeps border regions of neighbouring countries out.
            base_params["countrycodes"] = self._expected_country_code

        phrases = self._phrases_for_niche(filters.niche)

        # Results are collected per phrase and interleaved afterwards rather
        # than appended as they arrive. Appending fills the page from whichever
        # category answers first, so a broad search returned one trade and
        # looked broken. Interleaving gives every category a share.
        per_phrase: list[list[BusinessResult]] = []

        # Every phrase queried is a separate request, and Nominatim asks for no
        # more than one a second, so a broad search is paced rather than
        # unbounded. Eight categories is the trade: wide enough to look like a
        # cross-section, quick enough not to feel stalled.
        #
        # There is deliberately no "stop once we have enough" rule here. One
        # category alone returns more than a page, so stopping early filled
        # every result from whichever was queried first - which is exactly the
        # single-trade page this exists to prevent.
        queried = phrases[:8] if len(phrases) > 1 else phrases

        # No single category may dominate the page.
        per_phrase_cap = max(3, filters.limit // 4)

        for phrase in queried:
            OSMBusinessProvider._respect_nominatim_rate_limit(self)
            params = {**base_params, "q": phrase}
            try:
                with httpx.Client(timeout=self.timeout_seconds, headers={"User-Agent": self.user_agent}) as client:
                    response = client.get(self.SEARCH_URL, params=params)
                    response.raise_for_status()
                    payload = response.json()
            except Exception as exc:  # noqa: BLE001 - try the next phrase
                logger.info("Nominatim search failed for %r: %s", phrase, exc)
                continue

            batch: list[BusinessResult] = []
            for entry in payload:
                business = self._to_business(entry, filters, place)
                if business and business.external_ref not in seen:
                    seen.add(business.external_ref)
                    batch.append(business)
            if batch:
                per_phrase.append(batch[:per_phrase_cap])

        # Round-robin: one from each category, then the next from each, so the
        # first page shows the range of what is there.
        index = 0
        while len(results) < filters.limit and any(index < len(b) for b in per_phrase):
            for batch in per_phrase:
                if index < len(batch):
                    results.append(batch[index])
                    if len(results) >= filters.limit:
                        break
            index += 1

        return results

    def _to_business(
        self, entry: dict, filters: BusinessSearchFilters, place: GeocodeResult
    ) -> BusinessResult | None:
        name = entry.get("name")
        if not name:
            return None

        extratags = entry.get("extratags") or {}
        if OSMBusinessProvider._is_chain(extratags):
            return None

        address = entry.get("address") or {}

        # A bounding box is a rectangle, and a country is not: Germany's box
        # covers parts of the Netherlands and France, which is how a search for
        # German businesses returned shops in Blauwestad and Ribeauville.
        entry_country = (address.get("country_code") or "").lower()
        if self._expected_country_code and entry_country and entry_country != self._expected_country_code:
            return None

        street = " ".join(
            part for part in (address.get("house_number"), address.get("road")) if part
        ) or None
        city = (
            address.get("city")
            or address.get("town")
            or address.get("village")
            or place.canonical_city
            or filters.city
            or ""
        )

        # Same identifier shape as the Overpass path, so a business found
        # through either source is recognised as the same company instead of
        # being saved twice.
        external_ref = f"osm-{entry.get('osm_type')}-{entry.get('osm_id')}"

        return BusinessResult(
            external_ref=external_ref,
            name=name,
            niche=filters.niche or str(entry.get("type") or "Business").replace("_", " ").title(),
            country=address.get("country") or filters.country or "",
            city=city,
            address=street,
            maps_url=f"https://maps.google.com/?q={entry.get('lat')},{entry.get('lon')}",
            # OSM carries neither ratings nor review counts, and inventing them
            # would corrupt the opportunity score.
            rating=None,
            reviews_count=None,
            phone=extratags.get("contact:phone") or extratags.get("phone"),
            email=extratags.get("contact:email") or extratags.get("email"),
            website=extratags.get("contact:website") or extratags.get("website"),
            instagram=OSMBusinessProvider._extract_instagram_handle(extratags),
            hours=extratags.get("opening_hours"),
            description=None,
        )

    def get_details(self, external_ref: str) -> BusinessResult | None:
        # Details are captured at search time and persisted; there is no cheap
        # by-id lookup matching the search shape.
        return None


class FallbackBusinessProvider(BusinessSearchProvider):
    """Tries each source in turn, so one service's outage is not the product's.

    A source that raises, or returns nothing, hands over to the next. An error
    surfaces only when every source has failed - and an empty result from all of
    them genuinely means "nothing matched" rather than "the service was down".
    """

    def __init__(self, providers: list[BusinessSearchProvider]):
        if not providers:
            raise ValueError("FallbackBusinessProvider needs at least one provider")
        self.providers = providers

    def search(self, filters: BusinessSearchFilters) -> list[BusinessResult]:
        last_error: ProviderError | None = None

        for provider in self.providers:
            name = type(provider).__name__
            try:
                results = provider.search(filters)
            except ProviderError as exc:
                logger.info("Business source %s unavailable: %s", name, exc.code)
                last_error = exc
                continue
            except Exception as exc:  # noqa: BLE001 - one bad source must not end the search
                logger.warning("Business source %s raised %s", name, type(exc).__name__)
                continue

            if results:
                logger.info("Business source %s returned %d result(s)", name, len(results))
                return results
            logger.info("Business source %s returned nothing; trying the next", name)

        if last_error is not None:
            raise last_error
        return []

    def get_details(self, external_ref: str) -> BusinessResult | None:
        for provider in self.providers:
            details = provider.get_details(external_ref)
            if details is not None:
                return details
        return None


def get_business_provider(settings: Settings) -> BusinessSearchProvider:
    """Resolve the configured provider.

    There is deliberately no fallback to MockBusinessProvider: invented
    businesses must never reach a real workspace, so a misconfigured provider
    fails loudly instead of quietly serving fabricated leads. The mock is
    reachable only by asking for it by name, and only outside production.
    """
    if settings.business_provider == "mock":
        if settings.environment.lower() == "production":
            raise RuntimeError(
                "BUSINESS_PROVIDER=mock returns fabricated businesses and is "
                "refused in production. Use 'osm' (free, no API key)."
            )
        return MockBusinessProvider()
    if settings.business_provider == "osm":
        # Two independent OpenStreetMap services rather than one. Overpass
        # leads because it returns far more per request, but its volunteer
        # instances are down often enough that a lead search backed only by
        # Overpass failed roughly half the time. Nominatim answers the same
        # question from different infrastructure, so an Overpass outage costs
        # coverage instead of costing the user their search.
        return FallbackBusinessProvider(
            [
                OSMBusinessProvider(contact=settings.osm_contact),
                NominatimBusinessProvider(contact=settings.osm_contact),
            ]
        )
    if settings.business_provider == "overpass":
        return OSMBusinessProvider(contact=settings.osm_contact)
    if settings.business_provider == "nominatim":
        return NominatimBusinessProvider(contact=settings.osm_contact)
    raise NotImplementedError(
        f"Business provider '{settings.business_provider}' is not implemented. "
        "Supported: 'osm' (free, worldwide, no API key; Overpass with a "
        "Nominatim fallback), or either source alone as 'overpass' / "
        "'nominatim'. Add new implementations in app/providers/business.py."
    )

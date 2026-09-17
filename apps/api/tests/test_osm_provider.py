import re

import pytest
from unittest.mock import MagicMock, patch

from app.providers.business import (
    MAX_BBOX_SPAN_DEGREES,
    MIN_MIRROR_ATTEMPT_SECONDS,
    BusinessSearchFilters,
    GeocodeResult,
    OSMBusinessProvider,
)
from app.providers.errors import ProviderError


def test_instagram_handle_extracted_from_bare_tag():
    assert OSMBusinessProvider._extract_instagram_handle({"contact:instagram": "somecafe"}) == "somecafe"


def test_instagram_handle_extracted_from_full_url():
    tags = {"contact:instagram": "https://instagram.com/somecafe/"}
    assert OSMBusinessProvider._extract_instagram_handle(tags) == "somecafe"


def test_instagram_handle_missing_returns_none():
    assert OSMBusinessProvider._extract_instagram_handle({}) is None


def test_niche_tag_mapping_known_niche():
    provider = OSMBusinessProvider()
    assert provider._tags_for_niche("Restaurant") == [("amenity", "restaurant")]


def test_niche_tag_mapping_unknown_niche_has_a_fallback():
    provider = OSMBusinessProvider()
    tags = provider._tags_for_niche("Something Made Up")
    assert len(tags) >= 1


def test_geocode_failure_returns_none_not_an_exception():
    provider = OSMBusinessProvider()
    with patch("httpx.Client") as mock_client_cls:
        mock_client = MagicMock()
        mock_client.get.side_effect = ConnectionError("network down")
        mock_client_cls.return_value.__enter__.return_value = mock_client
        assert provider._geocode("Nowhere", "Nowhereland") is None


def test_small_bbox_is_left_untouched():
    bbox = (38.70, -9.20, 38.78, -9.10)  # central Lisbon — already small
    assert OSMBusinessProvider._clamp_bbox(*bbox, centre_lat=38.72, centre_lon=-9.14) == bbox


def test_oversized_bbox_is_clamped_to_the_span_limit():
    # Nominatim's box for "Tokyo" spans Tokyo Metropolis incl. islands ~1000km
    # south; querying all of it makes Overpass time out.
    south, west, north, east = OSMBusinessProvider._clamp_bbox(
        20.0, 135.0, 35.9, 154.0, centre_lat=35.68, centre_lon=139.75
    )
    assert north - south <= MAX_BBOX_SPAN_DEGREES + 1e-9
    assert east - west <= MAX_BBOX_SPAN_DEGREES + 1e-9


def test_oversized_bbox_clamps_around_the_city_not_the_box_midpoint():
    """
    Regression guard: Tokyo's box midpoint (~30°N) is open ocean, so clamping
    to the midpoint returns zero businesses. It must follow the city's own
    coordinates instead.
    """
    tokyo_lat, tokyo_lon = 35.68, 139.75
    south, west, north, east = OSMBusinessProvider._clamp_bbox(
        20.0, 135.0, 35.9, 154.0, centre_lat=tokyo_lat, centre_lon=tokyo_lon
    )
    assert south <= tokyo_lat <= north, "clamped box must still contain the city"
    assert west <= tokyo_lon <= east, "clamped box must still contain the city"


def test_clamped_bbox_stays_inside_the_original():
    original = (20.0, 135.0, 35.9, 154.0)
    south, west, north, east = OSMBusinessProvider._clamp_bbox(
        *original, centre_lat=35.68, centre_lon=139.75
    )
    assert south >= original[0] and west >= original[1]
    assert north <= original[2] and east <= original[3]


def test_overpass_failure_raises_retryable_error_not_empty_results():
    """A provider outage must not masquerade as 'no businesses found'."""
    provider = OSMBusinessProvider()
    with patch.object(provider, "_geocode", return_value=GeocodeResult(bbox=(52.4, 13.3, 52.6, 13.5), canonical_city="Berlin")):
        with patch("httpx.Client") as mock_client_cls:
            mock_client = MagicMock()
            mock_client.post.side_effect = TimeoutError("read timed out")
            mock_client_cls.return_value.__enter__.return_value = mock_client
            with pytest.raises(ProviderError) as excinfo:
                provider.search(BusinessSearchFilters(city="Berlin", country="Germany", niche="Cafe"))
    assert excinfo.value.retryable is True


def test_search_returns_empty_list_when_geocoding_fails():
    provider = OSMBusinessProvider()
    with patch.object(provider, "_geocode", return_value=None):
        result = provider.search(BusinessSearchFilters(city="Nowhere", country="Nowhereland"))
    assert result == []


def test_search_parses_named_elements_and_skips_unnamed():
    provider = OSMBusinessProvider()
    fake_overpass_response = {
        "elements": [
            {
                "type": "node",
                "id": 1,
                "lat": 52.5,
                "lon": 13.4,
                "tags": {
                    "name": "Berliner Backerei",
                    "contact:instagram": "berlinerbackerei",
                    "opening_hours": "Mo-Sa 08:00-18:00",
                },
            },
            {"type": "node", "id": 2, "lat": 52.5, "lon": 13.4, "tags": {}},  # no name -> skipped
        ]
    }
    with patch.object(provider, "_geocode", return_value=GeocodeResult(bbox=(52.4, 13.3, 52.6, 13.5), canonical_city="Berlin")):
        with patch("httpx.Client") as mock_client_cls:
            mock_response = MagicMock()
            mock_response.json.return_value = fake_overpass_response
            mock_response.raise_for_status.return_value = None
            mock_client = MagicMock()
            mock_client.post.return_value = mock_response
            mock_client_cls.return_value.__enter__.return_value = mock_client

            results = provider.search(BusinessSearchFilters(city="Berlin", country="Germany", niche="Cafe"))

    assert len(results) == 1
    assert results[0].name == "Berliner Backerei"
    assert results[0].instagram == "berlinerbackerei"
    assert results[0].rating is None  # OSM has no ratings — must not be fabricated


def test_city_falls_back_to_the_geocoders_canonical_name():
    """
    Searching "koln" should save leads as "Köln", not echo back however the
    user typed it, when the business itself carries no addr:city tag.
    """
    provider = OSMBusinessProvider()
    response_payload = {
        "elements": [{"type": "node", "id": 7, "lat": 50.9, "lon": 6.9, "tags": {"name": "Miyu"}}]
    }
    with patch.object(
        provider, "_geocode", return_value=GeocodeResult(bbox=(50.8, 6.8, 51.0, 7.0), canonical_city="Köln")
    ):
        with patch("httpx.Client") as mock_client_cls:
            mock_response = MagicMock()
            mock_response.json.return_value = response_payload
            mock_response.raise_for_status.return_value = None
            mock_client = MagicMock()
            mock_client.post.return_value = mock_response
            mock_client_cls.return_value.__enter__.return_value = mock_client

            results = provider.search(BusinessSearchFilters(city="koln", country="Germany", niche="Restaurant"))

    assert results[0].city == "Köln"


def test_business_own_address_tag_wins_over_the_canonical_name():
    provider = OSMBusinessProvider()
    response_payload = {
        "elements": [
            {
                "type": "node",
                "id": 8,
                "lat": 50.9,
                "lon": 6.9,
                "tags": {"name": "Suburb Diner", "addr:city": "Leverkusen"},
            }
        ]
    }
    with patch.object(
        provider, "_geocode", return_value=GeocodeResult(bbox=(50.8, 6.8, 51.0, 7.0), canonical_city="Köln")
    ):
        with patch("httpx.Client") as mock_client_cls:
            mock_response = MagicMock()
            mock_response.json.return_value = response_payload
            mock_response.raise_for_status.return_value = None
            mock_client = MagicMock()
            mock_client.post.return_value = mock_response
            mock_client_cls.return_value.__enter__.return_value = mock_client

            results = provider.search(BusinessSearchFilters(city="koln", country="Germany", niche="Restaurant"))

    assert results[0].city == "Leverkusen"


class _FakeClock:
    """A monotonic clock the test advances by hand, so budget behaviour is
    asserted without actually waiting."""

    def __init__(self, start: float = 1000.0):
        self.now = start

    def monotonic(self) -> float:
        return self.now

    def advance(self, seconds: float) -> None:
        self.now += seconds


def _berlin_geocode(provider):
    return patch.object(
        provider,
        "_geocode",
        return_value=GeocodeResult(bbox=(52.4, 13.3, 52.6, 13.5), canonical_city="Berlin"),
    )


def test_mirrors_share_one_wall_clock_budget():
    """
    Regression guard: each mirror used to get the full 45s timeout, so three
    slow ones kept the user staring at a progress bar for ~108s (measured
    against the live mirrors) before the error appeared. The mirrors now share
    a single budget, and whatever doesn't fit is skipped.
    """
    provider = OSMBusinessProvider(timeout_seconds=45.0, total_budget_seconds=60.0)
    clock = _FakeClock()
    timeouts: list[float] = []

    def client_factory(timeout=None, headers=None):
        timeouts.append(timeout)

        def post(url, data=None):
            clock.advance(timeout)  # this mirror hung for the whole attempt
            raise TimeoutError("read timed out")

        client = MagicMock()
        client.post.side_effect = post
        ctx = MagicMock()
        ctx.__enter__.return_value = client
        return ctx

    with _berlin_geocode(provider):
        with patch("app.providers.business.time.monotonic", clock.monotonic):
            with patch("httpx.Client", side_effect=client_factory):
                with pytest.raises(ProviderError) as excinfo:
                    provider.search(
                        BusinessSearchFilters(city="Berlin", country="Germany", niche="Cafe")
                    )

    assert excinfo.value.retryable is True
    assert sum(timeouts) <= 60.0, "mirrors together must not outlast the budget"
    assert timeouts == [45.0, 15.0], "the second attempt gets only the budget left"


def test_mirror_attempt_is_skipped_rather_than_started_without_time_to_finish():
    provider = OSMBusinessProvider(timeout_seconds=45.0, total_budget_seconds=50.0)
    clock = _FakeClock()
    attempts: list[str] = []

    def client_factory(timeout=None, headers=None):
        def post(url, data=None):
            attempts.append(url)
            clock.advance(timeout)
            raise TimeoutError("read timed out")

        client = MagicMock()
        client.post.side_effect = post
        ctx = MagicMock()
        ctx.__enter__.return_value = client
        return ctx

    with _berlin_geocode(provider):
        with patch("app.providers.business.time.monotonic", clock.monotonic):
            with patch("httpx.Client", side_effect=client_factory):
                with pytest.raises(ProviderError):
                    provider.search(
                        BusinessSearchFilters(city="Berlin", country="Germany", niche="Cafe")
                    )

    # 50s budget - 45s first attempt = 5s left, under the minimum worth trying.
    assert len(attempts) == 1
    assert 50.0 - 45.0 < MIN_MIRROR_ATTEMPT_SECONDS


def test_consecutive_searches_start_from_different_mirrors():
    """A saturated primary must not cost every search the first slice of its
    budget — and rotating spreads our load across the volunteer instances."""
    OSMBusinessProvider._mirror_cursor = 0
    provider = OSMBusinessProvider()
    mirror_count = len(OSMBusinessProvider.OVERPASS_URLS)

    rotations = [provider._mirrors_in_rotation() for _ in range(mirror_count)]

    assert {r[0] for r in rotations} == set(OSMBusinessProvider.OVERPASS_URLS)
    for rotation in rotations:
        assert set(rotation) == set(OSMBusinessProvider.OVERPASS_URLS), "no mirror is dropped"
    # The cursor wraps rather than growing without bound.
    assert provider._mirrors_in_rotation() == rotations[0]


def test_server_side_budget_stays_under_the_client_timeout():
    """If Overpass' own timeout outlasted our HTTP timeout we'd abandon the
    connection instead of receiving an error we can report."""
    provider = OSMBusinessProvider(timeout_seconds=45.0)
    sent: list[str] = []

    def post(url, data=None):
        sent.append(data["data"])
        response = MagicMock()
        response.status_code = 200
        response.raise_for_status.return_value = None
        response.json.return_value = {"elements": []}
        return response

    with _berlin_geocode(provider):
        with patch("httpx.Client") as mock_client_cls:
            client = MagicMock()
            client.post.side_effect = post
            mock_client_cls.return_value.__enter__.return_value = client
            provider.search(BusinessSearchFilters(city="Berlin", country="Germany", niche="Cafe"))

    server_budget = int(re.search(r"\[timeout:(\d+)\]", sent[0]).group(1))
    assert 0 < server_budget < 45


def _osm_node(node_id: int, name: str, **extra_tags):
    return {"type": "node", "id": node_id, "lat": 52.5, "lon": 13.4, "tags": {"name": name, **extra_tags}}


def _search_returning(provider, elements, filters=None):
    with _berlin_geocode(provider):
        with patch("httpx.Client") as mock_client_cls:
            response = MagicMock()
            response.status_code = 200
            response.raise_for_status.return_value = None
            response.json.return_value = {"elements": elements}
            client = MagicMock()
            client.post.return_value = response
            mock_client_cls.return_value.__enter__.return_value = client
            return provider.search(
                filters or BusinessSearchFilters(city="Berlin", country="Germany", niche="Cafe")
            )


def test_chain_outlets_are_not_returned_as_leads():
    """A franchise has no local owner to sell a website to — a live search of
    central Austin was led by two Starbucks, a Subway and a PetSmart."""
    provider = OSMBusinessProvider()
    results = _search_returning(
        provider,
        [
            _osm_node(1, "Starbucks", **{"brand:wikidata": "Q37158"}),
            _osm_node(2, "Subway", brand="Subway"),
            _osm_node(3, "Cafe Nord"),  # independent
        ],
    )

    assert [r.name for r in results] == ["Cafe Nord"]


def test_independent_business_with_unrelated_tags_is_kept():
    provider = OSMBusinessProvider()
    results = _search_returning(
        provider,
        [_osm_node(4, "Miyu", operator="Miyu GmbH", cuisine="ramen")],
    )

    assert [r.name for r in results] == ["Miyu"]


def test_more_rows_are_requested_than_asked_for_to_survive_chain_filtering():
    """Without over-fetching, a franchise-heavy city centre returns a nearly
    empty page once chains are dropped."""
    provider = OSMBusinessProvider()
    sent: list[str] = []

    def post(url, data=None):
        sent.append(data["data"])
        response = MagicMock()
        response.status_code = 200
        response.raise_for_status.return_value = None
        response.json.return_value = {"elements": []}
        return response

    with _berlin_geocode(provider):
        with patch("httpx.Client") as mock_client_cls:
            client = MagicMock()
            client.post.side_effect = post
            mock_client_cls.return_value.__enter__.return_value = client
            provider.search(BusinessSearchFilters(city="Berlin", country="Germany", niche="Cafe", limit=25))

    requested = int(re.search(r"out center (\d+);", sent[0]).group(1))
    assert requested > 25


def test_the_callers_limit_is_still_respected_after_over_fetching():
    provider = OSMBusinessProvider()
    results = _search_returning(
        provider,
        [_osm_node(i, f"Independent {i}") for i in range(30)],
        filters=BusinessSearchFilters(city="Berlin", country="Germany", niche="Cafe", limit=5),
    )

    assert len(results) == 5

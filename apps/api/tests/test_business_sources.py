"""
The lead search must work for every user, every time it reasonably can.

These cover the second data source and the chain in front of it, which exist
because a search backed only by Overpass failed roughly half the time against
the live service — and a lead finder that fails half the time is not a product.
"""

from unittest.mock import MagicMock, patch

import pytest

from app.providers.business import (
    MIRROR_COOLDOWN_SECONDS,
    BusinessResult,
    BusinessSearchFilters,
    BusinessSearchProvider,
    FallbackBusinessProvider,
    GeocodeResult,
    NominatimBusinessProvider,
    OSMBusinessProvider,
)
from app.providers.errors import ProviderError


@pytest.fixture(autouse=True)
def _reset_mirror_state():
    OSMBusinessProvider._mirror_failed_at = {}
    OSMBusinessProvider._mirror_cursor = 0
    yield
    OSMBusinessProvider._mirror_failed_at = {}
    OSMBusinessProvider._mirror_cursor = 0


class _StubProvider(BusinessSearchProvider):
    def __init__(self, results=None, error=None):
        self.results = results or []
        self.error = error
        self.called = False

    def search(self, filters):
        self.called = True
        if self.error:
            raise self.error
        return self.results

    def get_details(self, external_ref):
        return None


def _business(name="Cafe Nord"):
    return BusinessResult(
        external_ref=f"osm-node-{abs(hash(name)) % 10000}",
        name=name,
        niche="Cafe",
        country="Portugal",
        city="Lisboa",
    )


# --------------------------------------------------------------- the chain


def test_a_failed_source_hands_over_to_the_next():
    """An outage at one service must not be an outage of the product."""
    down = _StubProvider(error=ProviderError(code="PROVIDER_UNAVAILABLE", message="down", retryable=True))
    up = _StubProvider(results=[_business()])

    results = FallbackBusinessProvider([down, up]).search(BusinessSearchFilters(city="Lisbon"))

    assert [r.name for r in results] == ["Cafe Nord"]
    assert down.called and up.called


def test_a_source_returning_nothing_hands_over_too():
    """Empty is not the same as authoritative: another source may hold the data."""
    empty = _StubProvider(results=[])
    full = _StubProvider(results=[_business()])

    results = FallbackBusinessProvider([empty, full]).search(BusinessSearchFilters(city="Lisbon"))

    assert len(results) == 1
    assert full.called


def test_a_working_source_short_circuits_the_rest():
    first = _StubProvider(results=[_business()])
    second = _StubProvider(results=[_business("Should Not Be Reached")])

    FallbackBusinessProvider([first, second]).search(BusinessSearchFilters(city="Lisbon"))

    assert not second.called, "a satisfied search must not keep querying other services"


def test_an_unexpected_crash_in_one_source_does_not_end_the_search():
    broken = _StubProvider(error=RuntimeError("bad json"))
    working = _StubProvider(results=[_business()])

    results = FallbackBusinessProvider([broken, working]).search(BusinessSearchFilters(city="Lisbon"))

    assert len(results) == 1


def test_the_outage_is_reported_only_when_every_source_has_failed():
    outage = ProviderError(code="PROVIDER_UNAVAILABLE", message="down", retryable=True)
    with pytest.raises(ProviderError) as excinfo:
        FallbackBusinessProvider(
            [_StubProvider(error=outage), _StubProvider(error=outage)]
        ).search(BusinessSearchFilters(city="Lisbon"))
    assert excinfo.value.retryable is True


def test_all_sources_empty_is_no_results_rather_than_an_outage():
    """Telling a user the service is broken when their filters simply matched
    nothing sends them off to retry something that will never succeed."""
    results = FallbackBusinessProvider(
        [_StubProvider(results=[]), _StubProvider(results=[])]
    ).search(BusinessSearchFilters(city="Lisbon"))
    assert results == []


# ------------------------------------------------- searching without a city


def test_overpass_declines_a_search_with_no_city():
    """Its bounding box is clamped to ~25km, so a country-wide search would
    silently become 'whatever is near the country's centroid' — three rural
    results for Portugal when measured live."""
    provider = OSMBusinessProvider()
    assert provider.search(BusinessSearchFilters(country="Portugal", niche="Restaurant")) == []


def test_nominatim_accepts_a_search_with_no_city():
    provider = NominatimBusinessProvider()
    payload = [
        {
            "osm_type": "node",
            "osm_id": 1,
            "name": "Adega do Domingos",
            "lat": "38.7",
            "lon": "-9.1",
            "type": "restaurant",
            "address": {"city": "Lisboa", "country": "Portugal", "country_code": "pt"},
            "extratags": {"phone": "+351 21 000 0000"},
        }
    ]
    with patch.object(
        provider, "_place_bbox", return_value=GeocodeResult(bbox=(36.9, -9.5, 42.2, -6.2), canonical_city="Portugal")
    ):
        with patch("httpx.Client") as client_cls:
            response = MagicMock()
            response.raise_for_status.return_value = None
            response.json.return_value = payload
            client = MagicMock()
            client.get.return_value = response
            client_cls.return_value.__enter__.return_value = client

            results = provider.search(BusinessSearchFilters(country="Portugal", niche="Restaurant"))

    assert [r.name for r in results] == ["Adega do Domingos"]
    assert results[0].phone == "+351 21 000 0000"


# ------------------------------------------------------- geographic accuracy


def test_results_outside_the_requested_country_are_dropped():
    """A bounding box is a rectangle and a country is not: Germany's box covers
    part of the Netherlands, which is how a search for German businesses
    returned shops in Blauwestad and a .nl website."""
    provider = NominatimBusinessProvider()
    provider._expected_country_code = "de"

    german = {
        "osm_type": "node", "osm_id": 1, "name": "Salon 49", "lat": "52.5", "lon": "13.4",
        "type": "hairdresser", "address": {"city": "Berlin", "country_code": "de"}, "extratags": {},
    }
    dutch = {
        "osm_type": "node", "osm_id": 2, "name": "HB Shops", "lat": "53.2", "lon": "7.0",
        "type": "shop", "address": {"city": "Blauwestad", "country_code": "nl"}, "extratags": {},
    }
    filters = BusinessSearchFilters(country="Germany")
    place = GeocodeResult(bbox=(47.2, 5.8, 55.1, 15.0), canonical_city="Deutschland")

    assert provider._to_business(german, filters, place) is not None
    assert provider._to_business(dutch, filters, place) is None, "cross-border result must be dropped"


def test_chain_outlets_are_excluded_from_this_source_too():
    provider = NominatimBusinessProvider()
    entry = {
        "osm_type": "node", "osm_id": 3, "name": "Starbucks", "lat": "38.7", "lon": "-9.1",
        "type": "cafe", "address": {"city": "Lisboa", "country_code": "pt"},
        "extratags": {"brand:wikidata": "Q37158"},
    }
    assert provider._to_business(entry, BusinessSearchFilters(), GeocodeResult(bbox=(0, 0, 1, 1))) is None


def test_both_sources_produce_the_same_identifier_for_one_business():
    """Otherwise the same company is saved twice when a search falls back."""
    provider = NominatimBusinessProvider()
    entry = {
        "osm_type": "node", "osm_id": 878258674, "name": "Saraiva", "lat": "38.7", "lon": "-9.1",
        "type": "restaurant", "address": {"city": "Lisboa", "country_code": "pt"}, "extratags": {},
    }
    business = provider._to_business(entry, BusinessSearchFilters(), GeocodeResult(bbox=(0, 0, 1, 1)))
    assert business.external_ref == "osm-node-878258674", "same shape as the Overpass path"


def test_ratings_are_never_invented_by_this_source():
    provider = NominatimBusinessProvider()
    entry = {
        "osm_type": "node", "osm_id": 4, "name": "Toledo", "lat": "38.7", "lon": "-9.1",
        "type": "restaurant", "address": {"city": "Lisboa", "country_code": "pt"}, "extratags": {},
    }
    business = provider._to_business(entry, BusinessSearchFilters(), GeocodeResult(bbox=(0, 0, 1, 1)))
    assert business.rating is None and business.reviews_count is None


# ------------------------------------------------------------ skipping fast


def test_overpass_is_skipped_while_every_mirror_is_known_to_be_down():
    """Re-confirming an outage discovered seconds ago costs the user 90s and
    teaches nothing."""
    for url in OSMBusinessProvider.OVERPASS_URLS:
        OSMBusinessProvider._record_mirror_failure(url)

    provider = OSMBusinessProvider()
    assert provider._every_mirror_is_cooling_down()
    assert provider.search(BusinessSearchFilters(city="Lisbon", country="Portugal")) == []


def test_overpass_is_used_again_once_the_cooldown_expires():
    from app.providers import business as business_module

    for url in OSMBusinessProvider.OVERPASS_URLS:
        OSMBusinessProvider._record_mirror_failure(url)

    real_monotonic = business_module.time.monotonic
    with patch.object(
        business_module.time, "monotonic", lambda: real_monotonic() + MIRROR_COOLDOWN_SECONDS + 1
    ):
        assert not OSMBusinessProvider()._every_mirror_is_cooling_down()


def test_one_healthy_mirror_keeps_overpass_in_play():
    urls = OSMBusinessProvider.OVERPASS_URLS
    for url in urls[:-1]:
        OSMBusinessProvider._record_mirror_failure(url)

    assert not OSMBusinessProvider()._every_mirror_is_cooling_down()

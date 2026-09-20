"""Tests for Photon, Wikidata, and OpenCage business search providers."""

from unittest.mock import MagicMock, patch

import pytest

from app.providers.business import (
    BusinessSearchFilters,
    FallbackBusinessProvider,
    OpenCageBusinessProvider,
    PhotonBusinessProvider,
    WikidataBusinessProvider,
)


# ================================================================ Photon


class TestPhotonProvider:
    def test_geocode_returns_none_on_network_error(self):
        provider = PhotonBusinessProvider()
        with patch("httpx.Client") as client_cls:
            client = MagicMock()
            client.get.side_effect = ConnectionError("no network")
            client_cls.return_value.__enter__.return_value = client
            assert provider._geocode("Nowhere", "Nowhereland") is None

    def test_geocode_returns_none_on_empty_features(self):
        provider = PhotonBusinessProvider()
        with patch("httpx.Client") as client_cls:
            response = MagicMock()
            response.raise_for_status.return_value = None
            response.json.return_value = {"features": []}
            client = MagicMock()
            client.get.return_value = response
            client_cls.return_value.__enter__.return_value = client
            assert provider._geocode("Nowhere", "Nowhereland") is None

    def test_geocode_extracts_bbox_from_response(self):
        provider = PhotonBusinessProvider()
        with patch("httpx.Client") as client_cls:
            response = MagicMock()
            response.raise_for_status.return_value = None
            response.json.return_value = {
                "features": [{
                    "geometry": {"coordinates": [-9.14, 38.72]},
                    "properties": {"name": "Lisboa", "bbox": [-9.5, 38.6, -9.0, 38.9]},
                }]
            }
            client = MagicMock()
            client.get.return_value = response
            client_cls.return_value.__enter__.return_value = client
            result = provider._geocode("Lisbon", "Portugal")
            assert result is not None
            assert result.canonical_city == "Lisboa"

    def test_geocode_builds_fallback_bbox_without_bbox_field(self):
        provider = PhotonBusinessProvider()
        with patch("httpx.Client") as client_cls:
            response = MagicMock()
            response.raise_for_status.return_value = None
            response.json.return_value = {
                "features": [{
                    "geometry": {"coordinates": [-9.14, 38.72]},
                    "properties": {"name": "Lisboa"},
                }]
            }
            client = MagicMock()
            client.get.return_value = response
            client_cls.return_value.__enter__.return_value = client
            result = provider._geocode("Lisbon", "Portugal")
            assert result is not None

    def test_search_returns_empty_when_geocode_fails(self):
        provider = PhotonBusinessProvider()
        with patch.object(provider, "_geocode", return_value=None):
            results = provider.search(BusinessSearchFilters(city="Nowhere", country="Nowhere"))
            assert results == []


# ================================================================ Wikidata


class TestWikidataProvider:
    def test_categories_for_niche_known(self):
        provider = WikidataBusinessProvider()
        cats = provider._categories_for_niche("restaurant")
        assert "Q2024448" in cats

    def test_categories_for_niche_unknown_falls_back(self):
        provider = WikidataBusinessProvider()
        cats = provider._categories_for_niche("something weird")
        assert len(cats) >= 1

    def test_categories_for_niche_none_returns_generic(self):
        provider = WikidataBusinessProvider()
        cats = provider._categories_for_niche(None)
        assert len(cats) >= 1

    def test_country_entity_resolves_iso_code(self):
        provider = WikidataBusinessProvider()
        assert provider._country_entity("PT") == "Q45"
        assert provider._country_entity("US") == "Q30"

    def test_country_entity_returns_none_for_empty(self):
        provider = WikidataBusinessProvider()
        assert provider._country_entity(None) is None
        assert provider._country_entity("") is None

    def test_country_entity_passes_through_q_codes(self):
        provider = WikidataBusinessProvider()
        assert provider._country_entity("Q45") == "Q45"

    def test_build_sparql_includes_category_filter(self):
        provider = WikidataBusinessProvider()
        sparql = provider._build_sparql(["Q2024448"], "Q45", None, 25)
        assert "wd:Q2024448" in sparql
        assert "wd:Q45" in sparql

    def test_build_sparql_includes_geo_filter_with_bbox(self):
        provider = WikidataBusinessProvider()
        sparql = provider._build_sparql(["Q2024448"], None, (38.6, -9.5, 38.9, -9.0), 25)
        assert "38.6" in sparql
        assert "-9.5" in sparql

    def test_search_returns_empty_on_sparql_failure(self):
        provider = WikidataBusinessProvider()
        with patch("httpx.Client") as client_cls:
            client = MagicMock()
            client.get.side_effect = ConnectionError("timeout")
            client_cls.return_value.__enter__.return_value = client
            results = provider.search(BusinessSearchFilters(city="Lisbon", country="Portugal"))
            assert results == []

    def test_search_parses_results_correctly(self):
        provider = WikidataBusinessProvider()
        sparql_response = {
            "results": {
                "bindings": [
                    {
                        "business": {"value": "Q12345"},
                        "businessLabel": {"value": "Cafe Central"},
                        "lat": {"value": "38.72"},
                        "lon": {"value": "-9.14"},
                        "cityLabel": {"value": "Lisboa"},
                        "countryLabel": {"value": "Portugal"},
                        "website": {"value": "https://cafe.pt"},
                        "phone": {"value": "+351 21 000 0000"},
                    }
                ]
            }
        }
        with patch.object(provider, "_country_entity", return_value="Q45"):
            with patch("app.providers.business.PhotonBusinessProvider") as photon_cls:
                photon_cls.return_value._geocode.return_value = None
                with patch("httpx.Client") as client_cls:
                    response = MagicMock()
                    response.raise_for_status.return_value = None
                    response.json.return_value = sparql_response
                    client = MagicMock()
                    client.get.return_value = response
                    client_cls.return_value.__enter__.return_value = client
                    results = provider.search(BusinessSearchFilters(city="Lisbon", country="Portugal", niche="cafe"))
                    assert len(results) == 1
                    assert results[0].name == "Cafe Central"
                    assert results[0].external_ref == "wikidata-Q12345"
                    assert results[0].phone == "+351 21 000 0000"
                    assert results[0].website == "https://cafe.pt"
                    assert results[0].city == "Lisboa"

    def test_search_deduplicates_by_qid(self):
        provider = WikidataBusinessProvider()
        sparql_response = {
            "results": {
                "bindings": [
                    {"business": {"value": "Q123"}, "businessLabel": {"value": "A"}, "lat": {"value": "0"}, "lon": {"value": "0"}},
                    {"business": {"value": "Q123"}, "businessLabel": {"value": "A dup"}, "lat": {"value": "0"}, "lon": {"value": "0"}},
                    {"business": {"value": "Q456"}, "businessLabel": {"value": "B"}, "lat": {"value": "0"}, "lon": {"value": "0"}},
                ]
            }
        }
        with patch.object(provider, "_country_entity", return_value="Q45"):
            with patch("app.providers.business.PhotonBusinessProvider") as photon_cls:
                photon_cls.return_value._geocode.return_value = None
                with patch("httpx.Client") as client_cls:
                    response = MagicMock()
                    response.raise_for_status.return_value = None
                    response.json.return_value = sparql_response
                    client = MagicMock()
                    client.get.return_value = response
                    client_cls.return_value.__enter__.return_value = client
                    results = provider.search(BusinessSearchFilters(country="Portugal"))
                    assert len(results) == 2
                    assert results[0].name == "A"
                    assert results[1].name == "B"

    def test_search_skips_entries_without_name(self):
        provider = WikidataBusinessProvider()
        sparql_response = {
            "results": {
                "bindings": [
                    {"business": {"value": "Q123"}, "lat": {"value": "0"}, "lon": {"value": "0"}},
                    {"business": {"value": "Q456"}, "businessLabel": {"value": "Named Place"}, "lat": {"value": "0"}, "lon": {"value": "0"}},
                ]
            }
        }
        with patch.object(provider, "_country_entity", return_value="Q45"):
            with patch("app.providers.business.PhotonBusinessProvider") as photon_cls:
                photon_cls.return_value._geocode.return_value = None
                with patch("httpx.Client") as client_cls:
                    response = MagicMock()
                    response.raise_for_status.return_value = None
                    response.json.return_value = sparql_response
                    client = MagicMock()
                    client.get.return_value = response
                    client_cls.return_value.__enter__.return_value = client
                    results = provider.search(BusinessSearchFilters(country="Portugal"))
                    assert len(results) == 1
                    assert results[0].name == "Named Place"


# ================================================================ OpenCage


class TestOpenCageProvider:
    def test_requires_api_key(self):
        with pytest.raises(ValueError, match="requires an API key"):
            OpenCageBusinessProvider(api_key="")

    def test_geocode_returns_none_on_network_error(self):
        provider = OpenCageBusinessProvider(api_key="test-key")
        with patch("httpx.Client") as client_cls:
            client = MagicMock()
            client.get.side_effect = ConnectionError("no network")
            client_cls.return_value.__enter__.return_value = client
            assert provider._geocode("Nowhere", "Nowhereland") is None

    def test_geocode_returns_none_on_empty_results(self):
        provider = OpenCageBusinessProvider(api_key="test-key")
        with patch("httpx.Client") as client_cls:
            response = MagicMock()
            response.raise_for_status.return_value = None
            response.json.return_value = {"results": []}
            client = MagicMock()
            client.get.return_value = response
            client_cls.return_value.__enter__.return_value = client
            assert provider._geocode("Nowhere", "Nowhereland") is None

    def test_geocode_extracts_bounds(self):
        provider = OpenCageBusinessProvider(api_key="test-key")
        with patch("httpx.Client") as client_cls:
            response = MagicMock()
            response.raise_for_status.return_value = None
            response.json.return_value = {
                "results": [{
                    "formatted": "Lisboa, Portugal",
                    "geometry": {"lat": 38.72, "lng": -9.14},
                    "bounds": {
                        "southwest": {"lat": 38.6, "lng": -9.5},
                        "northeast": {"lat": 38.9, "lng": -9.0},
                    },
                }]
            }
            client = MagicMock()
            client.get.return_value = response
            client_cls.return_value.__enter__.return_value = client
            result = provider._geocode("Lisbon", "Portugal")
            assert result is not None
            assert result.canonical_city == "Lisboa"

    def test_geocode_builds_fallback_bbox_without_bounds(self):
        provider = OpenCageBusinessProvider(api_key="test-key")
        with patch("httpx.Client") as client_cls:
            response = MagicMock()
            response.raise_for_status.return_value = None
            response.json.return_value = {
                "results": [{
                    "formatted": "Lisboa, Portugal",
                    "geometry": {"lat": 38.72, "lng": -9.14},
                }]
            }
            client = MagicMock()
            client.get.return_value = response
            client_cls.return_value.__enter__.return_value = client
            result = provider._geocode("Lisbon", "Portugal")
            assert result is not None

    def test_search_returns_empty_when_geocode_fails(self):
        provider = OpenCageBusinessProvider(api_key="test-key")
        with patch.object(provider, "_geocode", return_value=None):
            results = provider.search(BusinessSearchFilters(city="Nowhere", country="Nowhere"))
            assert results == []

    def test_search_sends_api_key(self):
        provider = OpenCageBusinessProvider(api_key="my-secret-key")
        with patch("httpx.Client") as client_cls:
            response = MagicMock()
            response.raise_for_status.return_value = None
            response.json.return_value = {"results": []}
            client = MagicMock()
            client.get.return_value = response
            client_cls.return_value.__enter__.return_value = client
            provider._geocode("Lisbon", "Portugal")
            call_params = client.get.call_args[1]["params"]
            assert call_params["key"] == "my-secret-key"


# ================================================================ Factory / multi


class TestBusinessProviderFactory:
    def test_multi_provider_includes_all_free_sources(self):
        from app.core.config import Settings
        from app.providers.business import get_business_provider

        settings = Settings(business_provider="multi", opencage_api_key=None)
        provider = get_business_provider(settings)
        assert isinstance(provider, FallbackBusinessProvider)
        source_types = [type(p).__name__ for p in provider.providers]
        assert "OSMBusinessProvider" in source_types
        assert "NominatimBusinessProvider" in source_types
        assert "PhotonBusinessProvider" in source_types
        assert "WikidataBusinessProvider" in source_types
        assert "OpenCageBusinessProvider" not in source_types

    def test_multi_provider_includes_opencage_when_key_set(self):
        from app.core.config import Settings
        from app.providers.business import get_business_provider

        settings = Settings(business_provider="multi", opencage_api_key="test-key")
        provider = get_business_provider(settings)
        source_types = [type(p).__name__ for p in provider.providers]
        assert "OpenCageBusinessProvider" in source_types

    def test_photon_provider_includes_osm_fallback(self):
        from app.core.config import Settings
        from app.providers.business import get_business_provider

        settings = Settings(business_provider="photon")
        provider = get_business_provider(settings)
        assert isinstance(provider, FallbackBusinessProvider)
        source_types = [type(p).__name__ for p in provider.providers]
        assert "PhotonBusinessProvider" in source_types
        assert "OSMBusinessProvider" in source_types

    def test_wikidata_provider_is_standalone(self):
        from app.core.config import Settings
        from app.providers.business import get_business_provider

        settings = Settings(business_provider="wikidata")
        provider = get_business_provider(settings)
        assert isinstance(provider, WikidataBusinessProvider)

    def test_opencage_requires_key(self):
        from app.core.config import Settings
        from app.providers.business import get_business_provider

        settings = Settings(business_provider="opencage", opencage_api_key=None)
        with pytest.raises(RuntimeError, match="OPENCAGE_API_KEY"):
            get_business_provider(settings)

    def test_unsupported_provider_raises(self):
        from app.core.config import Settings
        from app.providers.business import get_business_provider

        settings = Settings(business_provider="nonexistent")
        with pytest.raises(NotImplementedError, match="not implemented"):
            get_business_provider(settings)

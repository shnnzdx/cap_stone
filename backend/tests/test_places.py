from __future__ import annotations

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.models import Place
from app.domain.places import geoapify
from app.domain.places import service


def _tokyo_place(identifier: str, name: str) -> geoapify.GeoapifyPlace:
    return geoapify.GeoapifyPlace(
        provider_place_id=identifier,
        name=name,
        city="Tokyo",
        country="Japan",
        latitude=35.6762,
        longitude=139.6503,
        category="tourism.attraction",
        address=f"{name}, Tokyo, Japan",
        image_url=None,
        opening_hours=None,
        english_name=name,
    )


def test_chicago_uses_global_place_service_instead_of_curated_source(
    db: Session, monkeypatch
):
    calls = []

    def fetched(destination: str):
        calls.append(destination)
        return (
            geoapify.GeoapifyPlace(
                provider_place_id="chicago-art-institute",
                name="Art Institute of Chicago",
                city="Chicago",
                country="United States",
                latitude=41.8796,
                longitude=-87.6237,
                category="entertainment.museum",
                address="111 S Michigan Ave, Chicago, Illinois, United States",
                image_url=None,
                opening_hours=None,
                english_name="Art Institute of Chicago",
            ),
        )

    monkeypatch.setattr(geoapify, "fetch_places", fetched)

    places = service.places_for_planner(db, "Chicago, USA", minimum=1)

    assert calls == ["Chicago, USA"]
    assert [place.candidate_id for place in places] == ["geoapify:chicago-art-institute"]
    assert places[0].source == "geoapify"
    assert places[0].price is None
    assert places[0].duration_min is None
    assert places[0].opens is None
    assert places[0].walking_level is None


def test_chicago_reads_existing_geoapify_cache_without_fetching(
    db: Session, monkeypatch
):
    db.add(
        Place(
            provider="geoapify",
            provider_place_id="cached-chicago",
            name="Chicago Cultural Center",
            english_name="Chicago Cultural Center",
            city="Chicago",
            country="United States",
            latitude=41.8837,
            longitude=-87.625,
            category="tourism.attraction",
            address="78 E Washington St, Chicago, Illinois, United States",
        )
    )
    db.flush()

    def unexpected(_destination: str):
        raise AssertionError("Cached Chicago candidates should not call Geoapify")

    monkeypatch.setattr(geoapify, "fetch_places", unexpected)

    places = service.places_for_planner(db, "Chicago, USA", minimum=1)

    assert [place.candidate_id for place in places] == ["geoapify:cached-chicago"]
    assert places[0].name == "Chicago Cultural Center"


def test_washingtondc_is_canonicalized_before_geoapify_lookup(db: Session, monkeypatch):
    requested = []

    def fetched(destination: str):
        requested.append(destination)
        return ()

    monkeypatch.setattr(geoapify, "fetch_places", fetched)

    assert service.places_for_planner(db, "washingtondc", minimum=1) == ()
    assert requested == ["Washington, DC"]


def test_geoapify_feature_normalization_preserves_only_real_values():
    normalized = geoapify.normalize_feature(
        {
            "properties": {
                "place_id": "tokyo-1",
                "name": "Tokyo National Museum",
                "city": "Tokyo",
                "country": "Japan",
                "lat": 35.7188,
                "lon": 139.7765,
                "categories": ["entertainment.museum", "tourism.attraction"],
                "formatted": "13-9 Uenokoen, Taito City, Tokyo, Japan",
            }
        }
    )

    assert normalized is not None
    assert normalized.provider_place_id == "tokyo-1"
    assert normalized.category == "entertainment.museum"
    assert normalized.image_url is None
    assert normalized.opening_hours is None


def test_geoapify_preserves_provider_english_and_non_latin_local_names():
    normalized = geoapify.normalize_feature(
        {
            "properties": {
                "place_id": "nanjing-underwater-world",
                "name": "Nanjing Seabed World",
                "name_international": {"en": "Nanjing Seabed World"},
                "other_names": {"name": "南京海底世界", "name:zh": "南京海底世界"},
                "lat": 32.055,
                "lon": 118.849,
                "categories": ["entertainment.aquarium"],
            }
        }
    )

    assert normalized is not None
    assert normalized.name == "Nanjing Seabed World"
    assert normalized.english_name == "Nanjing Seabed World"
    assert normalized.local_name == "南京海底世界"


def test_city_boundary_name_is_used_as_cache_identity():
    normalized = geoapify.normalize_feature(
        {
            "properties": {
                "place_id": "tokyo-ward-1",
                "name": "Tokyo International Forum",
                "city": "Chiyoda",
                "country": "Japan",
                "lat": 35.6767,
                "lon": 139.7645,
                "categories": ["tourism.attraction"],
            }
        },
        canonical_city="Tokyo",
        canonical_country="Japan",
    )

    assert normalized is not None
    assert normalized.city == "Tokyo"
    assert normalized.country == "Japan"


def test_geoapify_fetches_balanced_category_groups_with_spatial_biases(monkeypatch):
    calls = []
    client_kwargs = {}

    class Response:
        def __init__(self, payload):
            self.payload = payload

        def raise_for_status(self):
            return None

        def json(self):
            return self.payload

    class Client:
        def __init__(self, **kwargs):
            client_kwargs.update(kwargs)

        def __enter__(self):
            return self

        def __exit__(self, *_args):
            return None

        def get(self, url, *, params):
            calls.append((url, params))
            if url == geoapify.GEOCODE_URL:
                return Response({"results": [{
                    "place_id": "paris-boundary",
                    "city": "Paris",
                    "country": "France",
                    "lat": 48.85,
                    "lon": 2.35,
                    "bbox": {"lat1": 48.81, "lat2": 48.90, "lon1": 2.22, "lon2": 2.47},
                }]})
            category = params["categories"]
            index = len(calls)
            return Response({"features": [{"properties": {
                "place_id": f"place-{index}",
                "name": f"Place {index}",
                "lat": 48.8 + index / 100,
                "lon": 2.3 + index / 100,
                "categories": ["building", category],
            }}]})

    monkeypatch.setenv("GEOAPIFY_API_KEY", "configured-for-test")
    monkeypatch.setenv("HTTP_PROXY", "http://127.0.0.1:9")
    monkeypatch.delenv("HTTPS_PROXY", raising=False)
    monkeypatch.delenv("ALL_PROXY", raising=False)
    monkeypatch.setattr(geoapify.httpx, "Client", Client)

    places = geoapify.fetch_places("Paris, France")
    place_calls = [call for call in calls if call[0] == geoapify.PLACES_URL]

    assert client_kwargs["trust_env"] is False
    expected_categories = {
        category
        for _group, categories in geoapify.PLACE_CATEGORY_GROUPS
        for category in categories
    }
    assert len(place_calls) == len(expected_categories) + 5
    assert {call[1]["categories"] for call in place_calls} == expected_categories
    assert all("," not in call[1]["categories"] for call in place_calls)
    assert len({call[1]["bias"] for call in place_calls}) == 6
    assert sum(
        call[1]["categories"] == "catering.restaurant" for call in place_calls
    ) == 6
    assert all(
        sum(call[1]["categories"] == category for call in place_calls) == 1
        for category in expected_categories - {"catering.restaurant"}
    )
    assert all(call[1]["filter"] == "place:paris-boundary" for call in place_calls)
    assert {geoapify.category_group(place.category) for place in places} == {
        group for group, _categories in geoapify.PLACE_CATEGORY_GROUPS
    }


def test_geoapify_keeps_env_proxy_support_when_proxy_is_not_dead_local_port(monkeypatch):
    captured = {}

    class Client:
        def __init__(self, **kwargs):
            captured.update(kwargs)

        def __enter__(self):
            return self

        def __exit__(self, *_args):
            return None

        def get(self, url, *, params):
            if url == geoapify.GEOCODE_URL:
                return type("Response", (), {
                    "raise_for_status": lambda self: None,
                    "json": lambda self: {"results": []},
                })()
            raise AssertionError("Places lookup should stop after empty geocode result")

    monkeypatch.setenv("GEOAPIFY_API_KEY", "configured-for-test")
    monkeypatch.setenv("HTTPS_PROXY", "http://proxy.example.com:8080")
    monkeypatch.delenv("HTTP_PROXY", raising=False)
    monkeypatch.delenv("ALL_PROXY", raising=False)
    monkeypatch.setattr(geoapify.httpx, "Client", Client)

    assert geoapify.fetch_places("Paris, France") == ()
    assert captured["trust_env"] is True


def test_display_formatting_keeps_raw_provider_facts_unchanged():
    row = Place(
        provider="geoapify",
        provider_place_id="charlemagne",
        name="Charlemagne et ses leudes",
        city="Paris",
        country="France",
        latitude=48.853,
        longitude=2.349,
        category="heritage.monument",
        address="Charlemagne et ses leudes, Parvis Notre-Dame, 75004 Paris, France",
    )

    candidate = service._database_place(row)

    assert row.name == "Charlemagne et ses leudes"
    assert row.address.endswith("75004 Paris, France")
    assert candidate.name == "Charlemagne Monument"
    assert candidate.address == "Parvis Notre-Dame"


def test_database_candidate_uses_english_primary_and_local_secondary_name():
    row = Place(
        provider="geoapify",
        provider_place_id="nanjing-underwater-world",
        name="南京海底世界",
        english_name="Nanjing Seabed World",
        local_name="南京海底世界",
        city="Nanjing",
        country="China",
        latitude=32.055,
        longitude=118.849,
        category="entertainment.aquarium",
        address="南京海底世界, 8 四方城西路, Nanjing, China",
    )

    candidate = service._database_place(row)

    assert row.name == "南京海底世界"
    assert candidate.name == "Nanjing Seabed World"
    assert candidate.local_name == "南京海底世界"
    assert candidate.candidate_id == "geoapify:nanjing-underwater-world"


def test_non_latin_place_without_provider_english_name_is_not_sent_to_planner():
    row = Place(
        provider="geoapify",
        provider_place_id="unknown-translation",
        name="没有英文名称",
        city="Nanjing",
        country="China",
        latitude=32.05,
        longitude=118.8,
        category="tourism.attraction",
    )

    assert service._balanced_places([row]) == []


def test_candidate_order_round_robins_tourism_categories():
    rows = [
        Place(
            provider="geoapify",
            provider_place_id=f"place-{index}",
            name=f"Place {index}",
            city="Paris",
            country="France",
            latitude=48.84 + index / 100,
            longitude=2.33 + index / 100,
            category=categories[0],
        )
        for index, (_group, categories) in enumerate(geoapify.PLACE_CATEGORY_GROUPS)
    ]

    ordered = service._balanced_places(rows)

    assert [geoapify.category_group(row.category) for row in ordered] == [
        group for group, _categories in geoapify.PLACE_CATEGORY_GROUPS
    ]


def test_quality_ranking_demotes_vague_provider_names_within_a_category():
    clear = Place(
        provider="geoapify", provider_place_id="museum", name="City History Museum",
        city="Paris", country="France", latitude=48.85, longitude=2.35,
        category="entertainment.museum", address="1 Museum Way",
    )
    vague = Place(
        provider="geoapify", provider_place_id="unnamed", name="Unnamed building",
        city="Paris", country="France", latitude=48.851, longitude=2.351,
        category="entertainment.museum",
    )

    ordered = service._spatially_spread([vague, clear])

    assert ordered[0] is clear
    assert service._place_quality_score(clear) > service._place_quality_score(vague)


def test_legacy_cache_without_language_fields_requests_one_provider_refresh():
    rows = [
        Place(
            provider="geoapify",
            provider_place_id=f"legacy-{index}",
            name=f"Legacy Place {index}",
            city="Tokyo",
            country="Japan",
            latitude=35.0 + index / 100,
            longitude=139.0 + index / 100,
            category="tourism.attraction",
        )
        for index in range(service.DEFAULT_MINIMUM_PLACES)
    ]

    assert service._cache_needs_refresh(rows, minimum=service.DEFAULT_MINIMUM_PLACES)


def test_empty_city_fetches_upserts_and_second_read_uses_cache(
    db: Session, monkeypatch
):
    calls = []

    def fetched(destination: str):
        calls.append(destination)
        return (
            _tokyo_place("tokyo-1", "Tokyo National Museum"),
            _tokyo_place("tokyo-2", "Senso-ji"),
        )

    monkeypatch.setattr(geoapify, "fetch_places", fetched)

    first = service.places_for_planner(db, "Tokyo, Japan", minimum=2)
    second = service.places_for_planner(db, "Tokyo, Japan", minimum=2)

    assert calls == ["Tokyo, Japan"]
    assert {place.name for place in first} == {"Tokyo National Museum", "Senso-ji"}
    assert {place.name for place in second} == {"Tokyo National Museum", "Senso-ji"}
    assert db.scalar(select(func.count()).select_from(Place)) == 2
    assert all(place.price is None for place in first)
    assert all(place.duration_min is None for place in first)
    assert all(place.walking_level is None for place in first)


def test_provider_identity_prevents_duplicate_insert(db: Session, monkeypatch):
    monkeypatch.setattr(
        geoapify,
        "fetch_places",
        lambda _destination: (
            _tokyo_place("same-id", "Old name"),
            _tokyo_place("same-id", "Updated name"),
        ),
    )

    service.places_for_planner(db, "Tokyo, Japan", minimum=1)

    rows = db.scalars(select(Place)).all()
    assert len(rows) == 1
    assert rows[0].name == "Updated name"


def test_geoapify_failure_returns_existing_cache(db: Session, monkeypatch):
    db.add(
        Place(
            provider="geoapify",
            provider_place_id="cached-1",
            name="Cached Tokyo Place",
            city="Tokyo",
            country="Japan",
            latitude=35.0,
            longitude=139.0,
        )
    )
    db.flush()

    def unavailable(_destination: str):
        raise geoapify.GeoapifyUnavailable("timeout")

    monkeypatch.setattr(geoapify, "fetch_places", unavailable)

    places = service.places_for_planner(db, "Tokyo, Japan", minimum=2)

    assert [place.name for place in places] == ["Cached Tokyo Place"]


def test_food_candidates_cover_restaurants_lunch_fallbacks_and_bakeries():
    food_categories = dict(geoapify.PLACE_CATEGORY_GROUPS)["food"]

    assert "catering.restaurant" in food_categories
    assert "catering.cafe" in food_categories
    assert "catering.fast_food" in food_categories
    assert "catering.food_court" in food_categories
    assert "commercial.food_and_drink.bakery" in food_categories


def test_quality_ranking_rewards_reliable_address_information():
    reliable = Place(
        provider="geoapify", provider_place_id="reliable", name="City Art Museum",
        city="Paris", country="France", latitude=48.85, longitude=2.35,
        category="entertainment.museum", address="12 Rue de Rivoli, 75001 Paris, France",
    )
    missing = Place(
        provider="geoapify", provider_place_id="missing", name="City Art Museum",
        city="Paris", country="France", latitude=48.85, longitude=2.35,
        category="entertainment.museum", address=None,
    )

    assert service._place_quality_score(reliable) > service._place_quality_score(missing)

"""Geoapify client and response normalization.

This module is provider-specific. Planner code must depend on ``places.service``
instead of importing this module directly.
"""

from __future__ import annotations

import os
import unicodedata
from dataclasses import dataclass
from math import ceil
from typing import Any

import httpx

from ..http_client import should_trust_env_proxies

GEOCODE_URL = "https://api.geoapify.com/v1/geocode/search"
PLACES_URL = "https://api.geoapify.com/v2/places"
PLACE_CATEGORY_GROUPS = (
    ("major_attractions", ("tourism.attraction", "tourism.sights")),
    ("museums", ("entertainment.museum", "entertainment.culture")),
    ("historic_places", ("heritage", "religion.place_of_worship")),
    (
        "parks",
        ("leisure.park", "leisure.park.garden", "natural.protected_area", "national_park"),
    ),
    (
        "food",
        (
            "catering.restaurant",
            "catering.cafe",
            "catering.fast_food",
            "catering.food_court",
            "commercial.food_and_drink.bakery",
        ),
    ),
    (
        "leisure",
        ("entertainment.aquarium", "entertainment.planetarium", "entertainment.zoo"),
    ),
)


class GeoapifyUnavailable(Exception):
    """The provider cannot currently supply places."""


@dataclass(frozen=True)
class GeoapifyPlace:
    provider_place_id: str
    name: str
    city: str | None
    country: str | None
    latitude: float
    longitude: float
    category: str | None
    address: str | None
    image_url: str | None
    opening_hours: str | None
    english_name: str | None = None
    local_name: str | None = None


def fetch_places(destination: str, *, limit: int = 72) -> tuple[GeoapifyPlace, ...]:
    api_key = os.getenv("GEOAPIFY_API_KEY", "").strip()
    if not api_key:
        raise GeoapifyUnavailable("GEOAPIFY_API_KEY is not configured")

    try:
        with httpx.Client(
            timeout=httpx.Timeout(10.0),
            trust_env=should_trust_env_proxies(),
        ) as client:
            geocode = client.get(
                GEOCODE_URL,
                params={
                    "text": destination,
                    "type": "city",
                    "limit": 1,
                    "format": "json",
                    "lang": "en",
                    "apiKey": api_key,
                },
            )
            geocode.raise_for_status()
            results = geocode.json().get("results") or []
            if not results or not results[0].get("place_id"):
                return ()
            city = results[0]
            features: list[tuple[dict[str, Any], tuple[str, ...]]] = []
            successful_requests = 0
            per_group_limit = max(6, ceil(limit / len(PLACE_CATEGORY_GROUPS)))
            biases = _city_biases(city)
            request_index = 0
            for _group, categories in PLACE_CATEGORY_GROUPS:
                per_category_limit = max(3, ceil(per_group_limit / len(categories)))
                for category in categories:
                    # Restaurants are route anchors and need neighborhood coverage.
                    # Other categories keep one rotating bias so candidate diversity
                    # does not multiply provider calls or collapse into one category.
                    query_biases = biases if category == "catering.restaurant" else (
                        biases[request_index % len(biases)],
                    )
                    for bias in query_biases:
                        try:
                            response = client.get(
                                PLACES_URL,
                                params={
                                    # Geoapify accepts one category hierarchy per
                                    # request; a comma-joined union is rejected.
                                    "categories": category,
                                    "filter": f"place:{city['place_id']}",
                                    "bias": bias,
                                    "limit": per_category_limit,
                                    "lang": "en",
                                    "apiKey": api_key,
                                },
                            )
                            response.raise_for_status()
                            payload = response.json()
                        except (httpx.HTTPError, ValueError, TypeError):
                            request_index += 1
                            continue
                        request_index += 1
                        successful_requests += 1
                        features.extend(
                            (feature, (category,))
                            for feature in payload.get("features") or ()
                            if isinstance(feature, dict)
                        )
            if successful_requests == 0:
                raise GeoapifyUnavailable("Geoapify Places requests failed")
    except (httpx.HTTPError, ValueError, KeyError, TypeError) as exc:
        raise GeoapifyUnavailable("Geoapify request failed") from exc

    canonical_city = _text(city.get("city")) or _text(city.get("name"))
    canonical_country = _text(city.get("country"))
    normalized: dict[str, GeoapifyPlace] = {}
    for feature, requested_categories in features:
        place = normalize_feature(
            feature,
            canonical_city=canonical_city,
            canonical_country=canonical_country,
            requested_categories=requested_categories,
        )
        if place is not None:
            normalized.setdefault(place.provider_place_id, place)
    return tuple(normalized.values())


def normalize_feature(
    feature: dict[str, Any],
    *,
    canonical_city: str | None = None,
    canonical_country: str | None = None,
    requested_categories: tuple[str, ...] = (),
) -> GeoapifyPlace | None:
    properties = feature.get("properties") or {}
    place_id = _text(properties.get("place_id"))
    name = _text(properties.get("name"))
    latitude = _number(properties.get("lat"))
    longitude = _number(properties.get("lon"))
    if latitude is None or longitude is None:
        coordinates = (feature.get("geometry") or {}).get("coordinates") or ()
        if len(coordinates) >= 2:
            longitude = _number(coordinates[0])
            latitude = _number(coordinates[1])
    if not place_id or not name or latitude is None or longitude is None:
        return None

    categories = [str(value) for value in properties.get("categories") or () if value]
    media = properties.get("wiki_and_media") or {}
    image_url = _text(media.get("image")) or _text(properties.get("image"))
    english_name, local_name = _localized_names(properties, raw_name=name)
    return GeoapifyPlace(
        provider_place_id=place_id,
        name=name,
        # The city boundary is authoritative for cache identity. Geoapify may
        # otherwise label every Tokyo result with a special ward (for example,
        # Chiyoda), which makes a later `city = Tokyo` cache lookup miss.
        city=canonical_city or _text(properties.get("city")),
        country=canonical_country or _text(properties.get("country")),
        latitude=latitude,
        longitude=longitude,
        category=_primary_category(categories, requested_categories),
        address=_text(properties.get("formatted")),
        image_url=image_url,
        opening_hours=_text(properties.get("opening_hours")),
        english_name=english_name,
        local_name=local_name,
    )


def _localized_names(
    properties: dict[str, Any], *, raw_name: str
) -> tuple[str | None, str | None]:
    international_value = properties.get("name_international")
    other_value = properties.get("name_other") or properties.get("other_names")
    datasource_value = properties.get("datasource")
    international = international_value if isinstance(international_value, dict) else {}
    other = other_value if isinstance(other_value, dict) else {}
    datasource = datasource_value if isinstance(datasource_value, dict) else {}
    datasource_raw_value = datasource.get("raw")
    datasource_raw = datasource_raw_value if isinstance(datasource_raw_value, dict) else {}

    english_name = _text(international.get("en"))
    if english_name is None and _uses_only_latin_letters(raw_name):
        english_name = raw_name

    local_candidates = (
        other.get("loc_name"),
        other.get("name"),
        next(
            (value for key, value in other.items() if key.startswith("name:") and key != "name:en"),
            None,
        ),
        datasource_raw.get("name"),
        raw_name if not _uses_only_latin_letters(raw_name) else None,
    )
    local_name = next((_text(value) for value in local_candidates if _text(value)), None)
    if local_name and (
        _same_name(local_name, english_name)
        or _uses_only_latin_letters(local_name)
    ):
        local_name = None
    return english_name, local_name


def _uses_only_latin_letters(value: str) -> bool:
    letters = [character for character in value if character.isalpha()]
    return bool(letters) and all(
        "LATIN" in unicodedata.name(character, "") for character in letters
    )


def _same_name(left: str, right: str | None) -> bool:
    if not right:
        return False
    normalize = lambda value: "".join(character.casefold() for character in value if character.isalnum())
    return normalize(left) == normalize(right)


def _text(value: Any) -> str | None:
    if not isinstance(value, str):
        return None
    stripped = value.strip()
    return stripped or None


def _number(value: Any) -> float | None:
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def category_group(category: str | None) -> str:
    if not category:
        return "other"
    for group, categories in PLACE_CATEGORY_GROUPS:
        if any(category == root or category.startswith(f"{root}.") for root in categories):
            return group
    return "other"


def _primary_category(categories: list[str], requested: tuple[str, ...]) -> str | None:
    for root in requested:
        for category in categories:
            if category == root or category.startswith(f"{root}."):
                return category
    return categories[0] if categories else None


def _city_biases(city: dict[str, Any]) -> tuple[str, ...]:
    """Spread category queries around the urban center without trusting huge city bboxes.

    Tokyo's administrative bbox includes distant islands, so offsets are capped to an
    urban-scale radius while the authoritative ``place:`` filter keeps results inside
    the resolved city boundary.
    """
    lat = float(city["lat"])
    lon = float(city["lon"])
    bbox = city.get("bbox") or {}
    lat_half_span = abs(float(bbox.get("lat2", lat)) - float(bbox.get("lat1", lat))) / 2
    lon_half_span = abs(float(bbox.get("lon2", lon)) - float(bbox.get("lon1", lon))) / 2
    lat_offset = min(max(lat_half_span * 0.6, 0.02), 0.08)
    lon_offset = min(max(lon_half_span * 0.6, 0.03), 0.12)
    points = (
        (lon, lat),
        (lon + lon_offset, lat),
        (lon - lon_offset, lat),
        (lon, lat + lat_offset),
        (lon, lat - lat_offset),
        (lon + lon_offset, lat + lat_offset),
    )
    return tuple(f"proximity:{point_lon},{point_lat}" for point_lon, point_lat in points)

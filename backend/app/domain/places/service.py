"""Provider-neutral place library used by Planner."""

from __future__ import annotations

import re
from dataclasses import dataclass

from sqlalchemy import func, select
from sqlalchemy.orm import Session


from ...db.models import Place
from . import geoapify

DEFAULT_MINIMUM_PLACES = 36
MAX_PLACES_PER_CATEGORY = 12
MAX_FOOD_PLACES = 24


class DestinationNotFound(Exception):
    """The provider could not resolve a destination to a city."""

DISPLAY_NAME_ALIASES = {
    "charlemagne et ses leudes": "Charlemagne Monument",
}
DESTINATION_ALIASES = {
    "nyc": "New York City",
    "newyork": "New York City",
    "newyorkcity": "New York City",
    "la": "Los Angeles",
    "losangeles": "Los Angeles",
    "sf": "San Francisco",
    "sanfrancisco": "San Francisco",
    "dc": "Washington, DC",
    "washington": "Washington, DC",
    "washingtondc": "Washington, DC",
}

VAGUE_NAME_WORDS = frozenset({
    "building", "business", "center", "cafe", "coffee", "office", "place",
    "restaurant", "shop", "store", "unnamed", "unknown",
})
HIGH_VALUE_CATEGORY_MARKERS = (
    "tourism", "museum", "heritage", "monument", "aquarium", "planetarium",
    "zoo", "park", "garden", "gallery", "sights",
)


@dataclass(frozen=True)
class PlannerPlace:
    name: str
    location: str
    latitude: float
    longitude: float
    category: str | None
    address: str | None
    image_url: str | None
    opening_hours: str | None
    candidate_id: str = ""
    price: float | None = None
    duration_min: int | None = None
    opens: float | None = None
    closes: float | None = None
    walking_level: str | None = None
    access: tuple[str, ...] = ()
    diet: tuple[str, ...] = ()
    tags: tuple[str, ...] = ()
    source: str = "geoapify"
    local_name: str | None = None


def places_for_planner(
    db: Session,
    destination: str,
    *,
    minimum: int = DEFAULT_MINIMUM_PLACES,
) -> tuple[PlannerPlace, ...]:
    """Return cached/provider-backed global places for Planner."""
    rows = _provider_places_for_destination(db, destination, minimum=minimum)
    return tuple(_database_place(row) for row in _balanced_places(rows))


def places_for_replacement(
    db: Session,
    destination: str,
    *,
    minimum: int = DEFAULT_MINIMUM_PLACES,
) -> tuple[PlannerPlace, ...]:
    """Return provider-backed places for itinerary replacement suggestions."""
    rows = _provider_places_for_destination(db, destination, minimum=minimum)
    ordered = sorted(
        rows,
        key=lambda row: (-_place_quality_score(row), row.name.casefold()),
    )
    return tuple(_database_place(row) for row in ordered)


def _provider_places_for_destination(
    db: Session,
    destination: str,
    *,
    minimum: int,
) -> list[Place]:
    """Shared cache/provider path used by Planner and replacement suggestions."""
    destination = _canonical_destination(destination)

    cached = _cached_places(db, destination)
    if not _cache_needs_refresh(cached, minimum=minimum):
        return cached

    try:
        fetched = geoapify.fetch_places(destination)
        if getattr(fetched, "destination_found", True) is False:
            raise DestinationNotFound("Destination was not found")
    except geoapify.GeoapifyDestinationNotFound as exc:
        raise DestinationNotFound(str(exc)) from exc
    except geoapify.GeoapifyUnavailable:
        return cached

    if fetched:
        _upsert_geoapify(db, fetched)
        cached = _cached_places(db, destination)
        # Some providers normalize the city name differently from the input.
        # The just-fetched rows remain authoritative for this request.
        if not cached:
            ids = [place.provider_place_id for place in fetched]
            cached = db.scalars(
                select(Place)
                .where(Place.provider == "geoapify", Place.provider_place_id.in_(ids))
                .order_by(Place.name)
            ).all()
    return cached


def normalize_destination(destination: str) -> str:
    raw = destination.strip()
    city, separator, remainder = raw.partition(",")
    compact = re.sub(r"[^a-z0-9]", "", city.casefold())
    canonical = DESTINATION_ALIASES.get(compact)
    if not canonical:
        return raw
    suffix = f", {remainder.strip()}" if separator and remainder.strip() else ""
    return f"{canonical}{suffix}"


_canonical_destination = normalize_destination


def _destination_city(destination: str) -> str:
    return destination.split(",", 1)[0].strip()


def _cached_places(db: Session, destination: str) -> list[Place]:
    city = _destination_city(destination)
    if not city:
        return []
    return db.scalars(
        select(Place)
        .where(
            Place.provider == "geoapify",
            func.lower(Place.city) == city.lower(),
        )
        .order_by(Place.name)
    ).all()


def _upsert_geoapify(db: Session, fetched: tuple[geoapify.GeoapifyPlace, ...]) -> None:
    ids = [place.provider_place_id for place in fetched]
    existing = {
        row.provider_place_id: row
        for row in db.scalars(
            select(Place).where(
                Place.provider == "geoapify",
                Place.provider_place_id.in_(ids),
            )
        ).all()
    }
    for place in fetched:
        row = existing.get(place.provider_place_id)
        if row is None:
            row = Place(provider="geoapify", provider_place_id=place.provider_place_id)
            db.add(row)
            existing[place.provider_place_id] = row
        row.name = place.name
        row.english_name = place.english_name
        row.local_name = place.local_name
        row.city = place.city
        row.country = place.country
        row.latitude = place.latitude
        row.longitude = place.longitude
        row.category = place.category
        row.address = place.address
        row.image_url = place.image_url
        row.opening_hours = place.opening_hours
    db.flush()


def _cache_needs_refresh(rows: list[Place], *, minimum: int) -> bool:
    if len(rows) < minimum:
        return True
    # Rows created before localized-name support need one provider refresh so
    # English/local name facts can be populated without deleting the cache.
    if rows and all(row.english_name is None for row in rows):
        return True
    if minimum < DEFAULT_MINIMUM_PLACES:
        return False
    represented = {geoapify.category_group(row.category) for row in rows}
    return len(represented - {"other"}) < 5


def _balanced_places(rows: list[Place]) -> list[Place]:
    """Round-robin provider categories after spreading each category geographically."""
    grouped: dict[str, list[Place]] = {}
    for row in rows:
        # The product UI is English-first. If Geoapify has neither an English
        # name nor a Latin-script response name, do not ask Planner to invent a
        # translation and later persist it as fact.
        if not row.english_name and not geoapify._uses_only_latin_letters(row.name):
            continue
        grouped.setdefault(geoapify.category_group(row.category), []).append(row)
    group_order = [group for group, _categories in geoapify.PLACE_CATEGORY_GROUPS]
    if "other" in grouped:
        group_order.append("other")
    queues = {
        group: _spatially_spread(grouped.get(group, []))[
            : (
                6 if group == "other"
                else MAX_FOOD_PLACES if group == "food"
                else MAX_PLACES_PER_CATEGORY
            )
        ]
        for group in group_order
    }
    balanced: list[Place] = []
    while any(queues.values()):
        for group in group_order:
            if queues[group]:
                balanced.append(queues[group].pop(0))
    return balanced


def _spatially_spread(rows: list[Place]) -> list[Place]:
    """Farthest-point diversity with a quality-aware, deterministic seed.

    Category round-robin remains outside this function, so improving names and
    relevance cannot collapse the complete candidate set into one category.
    """
    if len(rows) < 3:
        return sorted(
            rows,
            key=lambda row: (-_place_quality_score(row), row.name.casefold()),
        )
    remaining = sorted(rows, key=lambda row: row.name.casefold())
    first = max(
        remaining,
        key=lambda row: (_place_quality_score(row), row.name.casefold()),
    )
    ordered = [first]
    remaining.remove(first)
    while remaining:
        next_row = max(
            remaining,
            key=lambda row: (
                min(
                    ((row.latitude - selected.latitude) ** 2
                    + (row.longitude - selected.longitude) ** 2) ** 0.5
                    for selected in ordered
                )
                + 0.002 * _place_quality_score(row),
                _place_quality_score(row),
                row.name.casefold(),
            ),
        )
        ordered.append(next_row)
        remaining.remove(next_row)
    return ordered


def _place_quality_score(row: Place) -> float:
    """Rank provider facts, never invent or translate them."""
    display_name = (row.english_name or row.name or "").strip()
    words = re.findall(r"[a-z0-9]+", display_name.casefold())
    category = (row.category or "").casefold()
    score = 0.0
    if len(display_name) >= 4 and any(char.isalpha() for char in display_name):
        score += 2.0
    if len(words) >= 2:
        score += 1.5
    if row.category and geoapify.category_group(row.category) != "other":
        score += 2.0
    if any(marker in category for marker in HIGH_VALUE_CATEGORY_MARKERS):
        score += 2.0
    score += _address_quality_score(row)
    if row.opening_hours:
        score += 0.5
    if row.image_url:
        score += 0.5
    if not words or set(words).issubset(VAGUE_NAME_WORDS):
        score -= 5.0
    if display_name.casefold().startswith(("unnamed", "unknown")):
        score -= 4.0
    if display_name.isdigit():
        score -= 6.0
    return score


def _address_quality_score(row: Place) -> float:
    """Prefer usable provider addresses without rejecting landmark-style addresses."""
    if not row.address:
        return -1.5
    address = row.address.strip().casefold()
    if address in {
        (row.city or "").strip().casefold(),
        (row.country or "").strip().casefold(),
    }:
        return -2.0
    parts = [part.strip() for part in row.address.split(",") if part.strip()]
    if len(parts) >= 3:
        return 1.0
    if len(parts) >= 2:
        return 0.5
    return -0.5


def _database_place(row: Place) -> PlannerPlace:
    tags = tuple(part for part in (row.category or "").split(".") if part)
    return PlannerPlace(
        candidate_id=f"{row.provider}:{row.provider_place_id}",
        name=_display_name(row.english_name or row.name),
        local_name=_useful_local_name(row.local_name, row.english_name or row.name),
        location=_short_address(row) or row.city or row.country or "Location unavailable",
        latitude=row.latitude,
        longitude=row.longitude,
        category=row.category,
        address=_short_address(row),
        image_url=row.image_url,
        opening_hours=row.opening_hours,
        tags=tags,
        source=row.provider,
    )


def _display_name(raw_name: str) -> str:
    return DISPLAY_NAME_ALIASES.get(raw_name.casefold().strip(), raw_name)


def _useful_local_name(local_name: str | None, english_name: str) -> str | None:
    if not local_name:
        return None
    if local_name.casefold().strip() == english_name.casefold().strip():
        return None
    return local_name


def _short_address(row: Place) -> str | None:
    if not row.address:
        return None
    parts = [part.strip() for part in row.address.split(",") if part.strip()]
    if parts and parts[0].casefold() == row.name.casefold():
        parts.pop(0)
    country = (row.country or "").casefold()
    city = (row.city or "").casefold()
    while parts and (
        parts[-1].casefold() == country
        or parts[-1].casefold() == city
        or (city and parts[-1].casefold().endswith(f" {city}"))
    ):
        parts.pop()
    return ", ".join(parts[:2]) or row.city or row.country

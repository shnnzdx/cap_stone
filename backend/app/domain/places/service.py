"""Provider-neutral place library used by Planner."""

from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from data.poi_chicago import POIS

from ...db.models import Place
from . import geoapify

DEFAULT_MINIMUM_PLACES = 36
MAX_PLACES_PER_CATEGORY = 12

DISPLAY_NAME_ALIASES = {
    "charlemagne et ses leudes": "Charlemagne Monument",
}


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
    """Return curated Chicago data or cached/provider-backed global places."""
    if _is_chicago(destination):
        return _chicago_places()

    cached = _cached_places(db, destination)
    if not _cache_needs_refresh(cached, minimum=minimum):
        return tuple(_database_place(row) for row in _balanced_places(cached))

    try:
        fetched = geoapify.fetch_places(destination)
    except geoapify.GeoapifyUnavailable:
        return tuple(_database_place(row) for row in _balanced_places(cached))

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
    return tuple(_database_place(row) for row in _balanced_places(cached))


def _destination_city(destination: str) -> str:
    return destination.split(",", 1)[0].strip()


def _is_chicago(destination: str) -> bool:
    return _destination_city(destination).casefold() == "chicago"


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
            : (6 if group == "other" else MAX_PLACES_PER_CATEGORY)
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
    if len(rows) < 3:
        return sorted(rows, key=lambda row: row.name.casefold())
    remaining = sorted(rows, key=lambda row: row.name.casefold())
    center_lat = sum(row.latitude for row in remaining) / len(remaining)
    center_lon = sum(row.longitude for row in remaining) / len(remaining)
    first = min(
        remaining,
        key=lambda row: (row.latitude - center_lat) ** 2 + (row.longitude - center_lon) ** 2,
    )
    ordered = [first]
    remaining.remove(first)
    while remaining:
        next_row = max(
            remaining,
            key=lambda row: min(
                (row.latitude - selected.latitude) ** 2
                + (row.longitude - selected.longitude) ** 2
                for selected in ordered
            ),
        )
        ordered.append(next_row)
        remaining.remove(next_row)
    return ordered


def _database_place(row: Place) -> PlannerPlace:
    tags = tuple(part for part in (row.category or "").split(".") if part)
    return PlannerPlace(
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


def _chicago_places() -> tuple[PlannerPlace, ...]:
    return tuple(
        PlannerPlace(
            name=raw[0],
            local_name=None,
            location=raw[1],
            latitude=float(raw[2]),
            longitude=float(raw[3]),
            category=(raw[11] or [None])[0],
            address=raw[1],
            image_url=raw[12] if len(raw) > 12 else None,
            opening_hours=None,
            price=float(raw[4]),
            duration_min=int(raw[5]),
            opens=float(raw[6]),
            closes=float(raw[7]),
            walking_level=raw[8],
            access=tuple(raw[9] or ()),
            diet=tuple(raw[10] or ()),
            tags=tuple(raw[11] or ()),
            source="ai_estimate",
        )
        for raw in POIS
    )

"""Planner -- choose a pleasant day from already-legal POI candidates.

This file is intentionally only the agent shell. The generation pipeline in
domain/plans/generator.py is responsible for collecting constraints, filtering
illegal options, validating the result, retrying, writing the database rows, and
falling back to deterministic rules.

When the project owner fills this in, keep the same four-part agent shape used
by explainer.py:

  1. SCHEMA   -- the exact shape the model must answer in
  2. SYSTEM   -- who the model is and what it may not do
  3. MOCK     -- a fixed answer for MOCK_AI=1, same shape as the real one
  4. one pure function -- input dataclass in, output dataclass out

The agent receives only candidates the pipeline has already deemed legal. It
should choose from that set; it should not re-check constraints or invent POIs.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from typing import Any

from data.poi_chicago import POIS

from . import base


# 1. SCHEMA ---------------------------------------------------------------
# Project owner fills this in with the final JSON schema.
SCHEMA = {}

# 2. SYSTEM ---------------------------------------------------------------
# Project owner fills this in with the final planner instructions.
SYSTEM = ""

# 3. MOCK -----------------------------------------------------------------
# Empty picks exercise the domain fallback without pretending AI logic exists.
MOCK: dict = {"picks": []}


@dataclass(frozen=True)
class PoiOption:
    name: str
    place: str
    price: float
    duration_min: int
    opens: float
    closes: float
    tags: tuple[str, ...]


@dataclass(frozen=True)
class PlanDayInput:
    day_index: int
    candidates: tuple[PoiOption, ...]
    already_used: tuple[str, ...]
    budget_left: float
    interests: tuple[str, ...]


@dataclass(frozen=True)
class Pick:
    poi_name: str
    start_hour: float


def plan_day(payload: PlanDayInput) -> tuple[Pick, ...]:
    """挑三个时段。晚上那个要能吃饭。负责人填。"""
    return ()


# Jiayi planner draft API -------------------------------------------------
# Keep this alongside the existing plan_day() API. The current main branch's
# domain/plans/generator.py still calls plan_day(), while Jiayi's
# domain/planning/service.py calls draft_itinerary().

POI_TITLES = tuple(poi[0] for poi in POIS)


class PlannerDraftInvalid(Exception):
    pass


@dataclass(frozen=True)
class PlannerInput:
    destination: str
    trip_dates: tuple[date, ...]
    interests: tuple[str, ...] = ()
    public_constraints: tuple[str, ...] = ()
    candidate_titles: tuple[str, ...] = POI_TITLES


@dataclass(frozen=True)
class PlannedStop:
    title: str


@dataclass(frozen=True)
class PlannedDay:
    day_index: int
    day_date: date
    stops: tuple[PlannedStop, ...]


@dataclass(frozen=True)
class PlannerDraft:
    days: tuple[PlannedDay, ...]
    note: str
    used_ai: bool


def draft_itinerary(request: PlannerInput) -> PlannerDraft:
    if not request.trip_dates:
        raise ValueError("Planner requires at least one trip date")
    if len(_candidate_titles(request)) < len(request.trip_dates):
        raise ValueError("Planner requires at least one eligible POI per trip date")

    try:
        result = _call_model(request)
        if base.is_mocked():
            return _parse(result, request=request, used_ai=False)

        try:
            draft = _parse(result, request=request, used_ai=True)
        except PlannerDraftInvalid as exc:
            repaired = _call_model(request, repair_error=str(exc))
            draft = _parse(repaired, request=request, used_ai=True)
        return draft
    except (base.AgentUnavailable, PlannerDraftInvalid) as exc:
        failure = exc.__cause__ or exc
        print("========== PLANNER AI FAILED ==========")
        print(repr(failure))
        print("=======================================")
        return _parse(_mock_plan(request), request=request, used_ai=False)


def _call_model(request: PlannerInput, *, repair_error: str | None = None) -> dict[str, Any]:
    user = _prompt(request)
    if repair_error:
        user += (
            "\n\nThe previous draft failed deterministic validation:\n"
            f"{repair_error}\n"
            "Return a corrected full draft. Cover every listed date exactly once, in order."
        )
    return base.call_model(
        system=(
            "You are a trip itinerary planner. Select only from the provided "
            "curated POI names and return a compact structured draft. Do not invent "
            "places, prices, bookings, dates, or private traveler details."
        ),
        user=user,
        schema=_plan_schema(request),
        schema_name="planner_draft",
        mock=_mock_plan(request),
    )


def _plan_schema(request: PlannerInput) -> dict[str, Any]:
    trip_dates = [day.isoformat() for day in request.trip_dates]
    candidate_titles = list(_candidate_titles(request))
    day_count = len(trip_dates)
    return {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "note": {"type": "string"},
            "days": {
                "type": "array",
                "minItems": 1,
                "maxItems": day_count,
                "items": {
                    "type": "object",
                    "additionalProperties": False,
                    "properties": {
                        "day_index": {"type": "integer", "minimum": 1, "maximum": day_count},
                        "date": {"type": "string", "enum": trip_dates},
                        "stops": {
                            "type": "array",
                            "minItems": 1,
                            "maxItems": 4,
                            "items": {
                                "type": "object",
                                "additionalProperties": False,
                                "properties": {
                                    "title": {"type": "string", "enum": candidate_titles},
                                },
                                "required": ["title"],
                            },
                        },
                    },
                    "required": ["day_index", "date", "stops"],
                },
            },
        },
        "required": ["note", "days"],
    }


def _prompt(request: PlannerInput) -> str:
    candidate_titles = set(_candidate_titles(request))
    poi_lines = [
        f'- title="{title}"; area={area}; price={price}; duration_min={minutes}; '
        f"open={opens}; close={closes}; walk={walk}; tags={','.join(tags)}"
        for title, area, _lat, _lng, price, minutes, opens, closes, walk, _access, _diet, tags in POIS
        if title in candidate_titles
    ]
    date_lines = [
        f"- Day {index}: {day.isoformat()}"
        for index, day in enumerate(request.trip_dates, start=1)
    ]
    return "\n".join(
        [
            f"Destination: {request.destination}",
            "Trip dates are inclusive. Produce one day for every date, in this exact order:",
            *date_lines,
            "Traveler interests: " + (", ".join(request.interests) or "not specified"),
            "Public safe constraints: " + ("; ".join(request.public_constraints) or "none"),
            "",
            "Curated POI catalog. Copy only the exact title value:",
            *poi_lines,
            "",
            "Do not force every day to have the same number of activities.",
            "Use 2-4 activities on a full day when appropriate.",
            "The first and last day may have 1-3 activities.",
            "Fewer activities are acceptable when pacing, constraints, opening hours, or the catalog make that better.",
            "When choosing 3-4 activities, combine shorter and longer stops so every selected stop fits its opening hours with a 30-minute gap.",
            "Do not choose three long museums that all close at the same time.",
            "Never repeat a POI only to fill space. Prefer a realistic pace over a full-looking schedule.",
        ]
    )


def _mock_plan(request: PlannerInput) -> dict[str, Any]:
    candidate_titles = _candidate_titles(request)
    counts = _fallback_activity_counts(len(request.trip_dates))
    cursor = 0
    days: list[dict[str, Any]] = []
    for index, (day_date, requested_count) in enumerate(
        zip(request.trip_dates, counts), start=1
    ):
        remaining_days = len(request.trip_dates) - index
        remaining_pois = len(candidate_titles) - cursor
        count = min(requested_count, max(1, remaining_pois - remaining_days))
        titles = candidate_titles[cursor : cursor + count]
        cursor += count
        days.append(
            {
                "day_index": index,
                "date": day_date.isoformat(),
                "stops": [{"title": title} for title in titles],
            }
        )
    return {
        "note": "Fallback draft from curated catalog because AI generation failed.",
        "days": days,
    }


def _fallback_activity_counts(day_count: int) -> tuple[int, ...]:
    if day_count <= 1:
        return (2,)
    if day_count == 2:
        return (2, 1)
    middle = tuple(3 if index % 2 else 2 for index in range(1, day_count - 1))
    return (2, *middle, 1)


def _candidate_titles(request: PlannerInput) -> tuple[str, ...]:
    allowed = set(request.candidate_titles)
    return tuple(title for title in POI_TITLES if title in allowed)


def _parse(result: dict[str, Any], *, request: PlannerInput, used_ai: bool) -> PlannerDraft:
    raw_days = result.get("days") or ()
    expected_dates = request.trip_dates
    if len(raw_days) != len(expected_dates):
        raise PlannerDraftInvalid(
            f"Expected {len(expected_dates)} days but received {len(raw_days)}"
        )
    activity_counts = tuple(len(day.get("stops") or ()) for day in raw_days)
    if len(expected_dates) >= 4 and len(set(activity_counts)) == 1:
        raise PlannerDraftInvalid(
            "Every day has the same activity count. Vary the count to reflect partial first/last days and trip pacing."
        )
    if len(expected_dates) > 1 and (activity_counts[0] > 3 or activity_counts[-1] > 3):
        raise PlannerDraftInvalid("The first and last day may contain at most 3 activities")

    parsed_days: list[PlannedDay] = []
    seen_titles: set[str] = set()
    for expected_index, (raw_day, expected_date) in enumerate(
        zip(raw_days, expected_dates), start=1
    ):
        try:
            day_index = int(raw_day["day_index"])
            day_date = date.fromisoformat(raw_day["date"])
        except (KeyError, TypeError, ValueError) as exc:
            raise PlannerDraftInvalid(f"Invalid day at position {expected_index}") from exc
        if day_index != expected_index:
            raise PlannerDraftInvalid(
                f"Expected day_index {expected_index} but received {day_index}"
            )
        if day_date != expected_date:
            raise PlannerDraftInvalid(
                f"Expected date {expected_date.isoformat()} but received {day_date.isoformat()}"
            )

        raw_stops = raw_day.get("stops") or ()
        if not 1 <= len(raw_stops) <= 4:
            raise PlannerDraftInvalid(
                f"Day {expected_index} must contain between 1 and 4 activities"
            )
        stops: list[PlannedStop] = []
        for raw_stop in raw_stops:
            title = raw_stop.get("title")
            if title not in _candidate_titles(request):
                raise PlannerDraftInvalid(f"Unknown POI title: {title}")
            if title in seen_titles:
                raise PlannerDraftInvalid(f"Repeated POI title: {title}")
            seen_titles.add(title)
            stops.append(PlannedStop(title=title))
        if used_ai and not _all_stops_fit_day(tuple(stop.title for stop in stops)):
            raise PlannerDraftInvalid(
                f"Day {expected_index} activities do not all fit their durations and opening hours"
            )
        parsed_days.append(
            PlannedDay(day_index=day_index, day_date=day_date, stops=tuple(stops))
        )

    return PlannerDraft(
        note=(
            "Generated by Qwen 3.5 from submitted preferences."
            if used_ai
            else result.get("note")
            or "Fallback draft from curated catalog because AI generation failed."
        ),
        used_ai=used_ai,
        days=tuple(parsed_days),
    )


def _all_stops_fit_day(titles: tuple[str, ...]) -> bool:
    poi_by_title = {poi[0]: poi for poi in POIS}
    remaining = [poi_by_title[title] for title in titles]
    current_hour = 9.0
    while remaining:
        feasible = []
        for poi in remaining:
            start = max(current_hour, float(poi[6]))
            end = start + float(poi[5]) / 60
            if end <= min(22.0, float(poi[7])):
                feasible.append((end, start, poi))
        if not feasible:
            return False
        end, _start, poi = min(feasible, key=lambda option: (option[0], option[1]))
        current_hour = end + 0.5
        remaining.remove(poi)
    return True

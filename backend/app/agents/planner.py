"""Planner agents for canonical day generation."""

from __future__ import annotations

import json
from dataclasses import dataclass
from typing import Any

from . import base


SYSTEM = (
    "You are the Planner for a trip itinerary. Select sightseeing activities only from "
    "the supplied candidate records. Each candidate_id is an opaque, immutable reference. "
    "Return candidate_id values exactly as supplied. Never create, translate, rewrite, "
    "combine, or return place names; never derive a title from a category. The backend, "
    "not you, owns english_name and local_name and resolves the selected candidate_id to "
    "the canonical place record. Lunch and dinner are added separately as schedule anchors. "
    "Do not invent places, place metadata, prices, opening hours, or constraints. Assign "
    "start times only within the supplied scheduling rules and candidate facts."
)

# Empty picks exercise the canonical generator's deterministic rules fallback
# without introducing a second runtime fallback inside this adapter.
MOCK: dict[str, Any] = {
    "note": "Mock planner returned no accepted picks.",
    "picks": [],
}

MIN_DAY_ACTIVITIES = 2
MAX_DAY_ACTIVITIES = 4
TIME_WINDOWS = {
    "morning": (9.0, 11.0),
    "lunch": (11.5, 13.25),
    "afternoon": (13.5, 17.0),
    "dinner": (17.5, 20.0),
    "evening": (20.25, 22.5),
}


@dataclass(frozen=True)
class PoiOption:
    candidate_id: str
    name: str
    local_name: str | None
    place: str
    category: str | None
    latitude: float | None
    longitude: float | None
    opening_hours: str | None
    price: float | None
    duration_min: int | None
    opens: float | None
    closes: float | None
    tags: tuple[str, ...]


@dataclass(frozen=True)
class PlanDayInput:
    day_index: int
    candidates: tuple[PoiOption, ...]
    already_used: tuple[str, ...]
    budget_left: float | None
    interests: tuple[str, ...]
    hard_constraints: tuple[str, ...] = ()
    preferred_activity_count: int = 3


@dataclass(frozen=True)
class Pick:
    candidate_id: str
    start_hour: float


@dataclass(frozen=True)
class PlanDayResult:
    picks: tuple[Pick, ...]
    used_ai: bool
    planner_note: str


class PlannerDayInvalid(Exception):
    pass


class PlannerDayUnusable(Exception):
    pass


def plan_day(payload: PlanDayInput) -> PlanDayResult:
    """Plan one day from the supplied legal candidate set."""
    result = _call_day_model(payload)
    if base.is_mocked():
        try:
            return _parse_day_result(result, payload=payload, used_ai=False)
        except PlannerDayInvalid as exc:
            raise PlannerDayUnusable(str(exc)) from exc

    try:
        return _parse_day_result(result, payload=payload, used_ai=True)
    except PlannerDayInvalid as exc:
        repaired = _call_day_model(payload, repair_error=str(exc))
        try:
            return _parse_day_result(repaired, payload=payload, used_ai=True)
        except PlannerDayInvalid as retry_exc:
            raise PlannerDayUnusable(str(retry_exc)) from retry_exc


def _call_day_model(
    payload: PlanDayInput, *, repair_error: str | None = None
) -> dict[str, Any]:
    user = _day_prompt(payload)
    if repair_error:
        user += (
            "\n\nThe previous day plan failed deterministic validation:\n"
            f"{repair_error}\n"
            "Return a corrected full day plan using only the provided candidate_id values "
            "and valid category-aware time windows."
        )
    return base.call_model(
        system=SYSTEM,
        user=user,
        schema=_day_schema(),
        schema_name="planner_day",
        mock=MOCK,
        provider=base.PLANNER_ROUTE,
    )


def _day_schema() -> dict[str, Any]:
    return {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "note": {"type": "string"},
            "picks": {
                "type": "array",
                "minItems": MIN_DAY_ACTIVITIES,
                "maxItems": MAX_DAY_ACTIVITIES,
                "items": {
                    "type": "object",
                    "additionalProperties": False,
                    "properties": {
                        "candidate_id": {"type": "string"},
                        "start_hour": {"type": "number"},
                    },
                    "required": ["candidate_id", "start_hour"],
                },
            },
        },
        "required": ["note", "picks"],
    }


def _day_prompt(payload: PlanDayInput) -> str:
    candidate_lines = [
        json.dumps(
            {
                "candidate_id": candidate.candidate_id,
                "english_name": candidate.name,
                "local_name": candidate.local_name,
                "category": candidate.category,
                "place": candidate.place,
                "latitude": candidate.latitude,
                "longitude": candidate.longitude,
                "price": candidate.price,
                "duration_min": candidate.duration_min,
                "opens": candidate.opens,
                "closes": candidate.closes,
                "opening_hours": candidate.opening_hours,
                "tags": candidate.tags,
            },
            ensure_ascii=False,
        )
        for candidate in payload.candidates
    ]
    return "\n".join(
        [
            f"Plan Day {payload.day_index}.",
            "Choose 2 to 4 sightseeing candidates and give each a start_hour in "
            "15-minute increments.",
            f"Soft target for this day: {payload.preferred_activity_count} sightseeing "
            "activities. "
            "Use fewer or more when the candidates and constraints make that more natural; "
            "never fail the day merely to hit this target.",
            "Decision priority, highest first: (1) hard constraints, (2) fixed or locked "
            "events, (3) trip dates and user availability, (4) opening hours, "
            "(5) geographic feasibility, (6) reasonable timing and transition, "
            "(7) meal timing, (8) soft preferences and interests, (9) daily variety. "
            "Never violate a higher-priority rule to make the itinerary look richer.",
            "This input represents a normal full travel day. Normally start sightseeing "
            "between 9.0 and 10.5. Obey any later required earliest time exactly.",
            "Use morning 9.0-11.0 and afternoon 13.5-17.0 for sightseeing. Lunch is added "
            "separately in the 11.5-14.0 window and dinner in the 17.5-20.0 window; leave "
            "natural space for both and do not schedule sightseeing that obviously conflicts.",
            "An optional evening activity may start from 20.25-22.5 only when the candidate "
            "is explicitly suitable for evenings (for example a show, viewpoint, night market, "
            "river walk, or night attraction), is near the dinner area, and adds real value. "
            "Do not add a weak evening stop merely to lengthen the day.",
            "A normal full day should usually remain active until about 18.0 or later once "
            "the separate dinner anchor is included. Avoid ending the meaningful itinerary "
            "at 14.0-16.0 when legal, worthwhile candidates remain.",
            "Across sightseeing and the separate meal anchors, a full day usually has about "
            "3 to 5 meaningful blocks. Do not force an extra place merely to hit a count, and "
            "do not mechanically use the same count every day.",
            "Respect each candidate's opens, closes, opening_hours, and known duration. If "
            "hours are unknown, do not invent them. A closed museum never outranks an interest.",
            "Allow realistic transition time between activities. Prefer nearby coordinates "
            "and coherent areas; avoid obvious backtracking. Do not fill every minute.",
            "Use each candidate_id and exact start time at most once.",
            "Vary exact start times naturally between days; do not repeat 10.0, "
            "14.0, 19.0 every day.",
            f"Budget left per person: {_known(payload.budget_left)}.",
            "Required planning constraints (sanitized structured facts only): "
            + ("; ".join(payload.hard_constraints) or "none supplied"),
            "Traveler interests: " + (", ".join(payload.interests) or "not specified"),
            "Already used canonical place names elsewhere in the trip (read-only context): "
            + (", ".join(payload.already_used) or "none"),
            "",
            "Candidate records. Names and categories are read-only facts. In picks, return only "
            "the exact candidate_id and start_hour; do not return any name field:",
            *candidate_lines,
        ]
    )


def _known(value: object | None) -> object:
    return "unknown" if value is None else value


def _parse_day_result(
    result: dict[str, Any], *, payload: PlanDayInput, used_ai: bool
) -> PlanDayResult:
    raw_picks = result.get("picks")
    if not isinstance(raw_picks, list) or not raw_picks:
        raise PlannerDayInvalid("Expected between 2 and 4 picks")
    if not MIN_DAY_ACTIVITIES <= len(raw_picks) <= MAX_DAY_ACTIVITIES:
        raise PlannerDayInvalid("Expected between 2 and 4 picks")

    candidates_by_id = {candidate.candidate_id: candidate for candidate in payload.candidates}
    seen_candidate_ids: set[str] = set()
    seen_times: set[float] = set()
    picks: list[Pick] = []

    for raw_pick in raw_picks:
        if not isinstance(raw_pick, dict):
            raise PlannerDayInvalid("Each pick must be an object")
        if set(raw_pick) != {"candidate_id", "start_hour"}:
            raise PlannerDayInvalid(
                "Each pick must contain only candidate_id and start_hour"
            )
        candidate_id = raw_pick.get("candidate_id")
        start_hour = raw_pick.get("start_hour")
        if candidate_id not in candidates_by_id:
            raise PlannerDayInvalid(f"Unknown candidate_id: {candidate_id}")
        if not isinstance(start_hour, int | float) or isinstance(start_hour, bool):
            raise PlannerDayInvalid(f"Unsupported start_hour: {start_hour}")
        start_hour = float(start_hour)
        if not _quarter_hour(start_hour):
            raise PlannerDayInvalid(
                f"start_hour must use 15-minute increments: {start_hour}"
            )
        window = time_window(start_hour)
        if window is None:
            raise PlannerDayInvalid(f"Unsupported start_hour: {start_hour}")
        candidate = candidates_by_id[candidate_id]
        if not category_allows_window(candidate.tags, window):
            raise PlannerDayInvalid(
                f"candidate_id {candidate_id} is not suitable for the {window} window"
            )
        if candidate.opens is not None and start_hour < candidate.opens:
            raise PlannerDayInvalid(f"candidate_id {candidate_id} is not open yet")
        if candidate.closes is not None:
            end_hour = (
                start_hour + candidate.duration_min / 60
                if candidate.duration_min is not None
                else start_hour
            )
            if end_hour > candidate.closes:
                raise PlannerDayInvalid(f"candidate_id {candidate_id} closes too early")
        if candidate_id in seen_candidate_ids:
            raise PlannerDayInvalid(f"Repeated candidate_id: {candidate_id}")
        if start_hour in seen_times:
            raise PlannerDayInvalid(f"Repeated start time: {start_hour}")
        seen_candidate_ids.add(candidate_id)
        seen_times.add(start_hour)
        picks.append(Pick(candidate_id=candidate_id, start_hour=start_hour))

    note = result.get("note")
    if not isinstance(note, str) or not note.strip():
        raise PlannerDayInvalid("Planner note is required")

    return PlanDayResult(
        picks=tuple(sorted(picks, key=lambda pick: pick.start_hour)),
        used_ai=used_ai,
        planner_note=note.strip(),
    )


def time_window(start_hour: float) -> str | None:
    for name, (start, end) in TIME_WINDOWS.items():
        if start <= start_hour <= end:
            return name
    return None


def category_allows_window(tags: tuple[str, ...], window: str) -> bool:
    is_food = is_reliable_meal_candidate(tags)
    normalized = {tag.casefold() for tag in tags}
    evening_markers = {
        "nightlife", "evening", "night", "show", "music", "sunset", "views",
    }
    is_nightlife = "nightlife" in normalized
    if is_food:
        return window in {"lunch", "dinner"}
    if window == "evening":
        return bool(normalized & evening_markers)
    if is_nightlife:
        return window in {"dinner", "evening"}
    return window in {"morning", "afternoon"}


def is_food_category(tags: tuple[str, ...]) -> bool:
    normalized = {tag.casefold() for tag in tags}
    return bool(normalized & {"catering", "restaurant", "cafe"}) or (
        "food" in normalized and "neighborhood" not in normalized
    )


def is_reliable_meal_candidate(tags: tuple[str, ...]) -> bool:
    """Separate actual meal venues from attractions that merely mention food."""
    normalized = {tag.casefold() for tag in tags}
    if not is_food_category(tags):
        return False
    venue_markers = {
        "restaurant",
        "cafe",
        "catering",
        "casual",
        "upscale",
        "brunch",
        "coffee",
    }
    sightseeing_markers = {
        "attraction",
        "tourism",
        "museum",
        "neighborhood",
        "walk",
        "park",
        "historic",
    }
    return bool(normalized & venue_markers) or not bool(normalized & sightseeing_markers)


def _quarter_hour(start_hour: float) -> bool:
    return abs(start_hour * 4 - round(start_hour * 4)) < 1e-9

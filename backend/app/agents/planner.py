"""Planner agents for canonical day generation."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from . import base


SYSTEM = (
    "You are a day planner for a trip itinerary. Choose sightseeing activities only "
    "from the provided candidate POIs and assign natural start times. Lunch and dinner "
    "are added separately as schedule anchors. "
    "Do not invent places, times, prices, or constraints."
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
}


@dataclass(frozen=True)
class PoiOption:
    name: str
    place: str
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
    preferred_activity_count: int = 3


@dataclass(frozen=True)
class Pick:
    poi_name: str
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
            "Return a corrected full day plan using only the provided candidate names "
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
                        "poi_name": {"type": "string"},
                        "start_hour": {"type": "number"},
                    },
                    "required": ["poi_name", "start_hour"],
                },
            },
        },
        "required": ["note", "picks"],
    }


def _day_prompt(payload: PlanDayInput) -> str:
    candidate_lines = [
        f'- poi_name="{candidate.name}"; place={candidate.place}; '
        f"price={_known(candidate.price)}; duration_min={_known(candidate.duration_min)}; "
        f"open={_known(candidate.opens)}; close={_known(candidate.closes)}; "
        f"tags={','.join(candidate.tags)}"
        for candidate in payload.candidates
    ]
    return "\n".join(
        [
            f"Plan Day {payload.day_index}.",
            "Choose 2 to 4 sightseeing POIs and give each a start_hour in 15-minute increments.",
            f"Soft target for this day: {payload.preferred_activity_count} sightseeing activities. "
            "Use fewer or more when the candidates and constraints make that more natural; "
            "never fail the day merely to hit this target.",
            "Use morning 9.0-11.0 and afternoon 13.5-17.0 for sightseeing. "
            "Lunch and dinner are handled outside this selection.",
            "Prefer at least one meaningful sightseeing item at or after 16.0 on a full day.",
            "Avoid unexplained gaps: use a natural morning, lunch-gap, afternoon, "
            "late-afternoon rhythm.",
            "Use each POI and exact start time at most once.",
            "Vary exact start times naturally between days; do not repeat 10.0, "
            "14.0, 19.0 every day.",
            "Prefer a geographically coherent area for this day and varied themes across the trip.",
            f"Budget left per person: {_known(payload.budget_left)}.",
            "Traveler interests: " + (", ".join(payload.interests) or "not specified"),
            "Already used POIs elsewhere in the trip: "
            + (", ".join(payload.already_used) or "none"),
            "",
            "Candidate POIs. Copy only the exact poi_name values:",
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

    candidates_by_name = {candidate.name: candidate for candidate in payload.candidates}
    seen_names: set[str] = set()
    seen_times: set[float] = set()
    picks: list[Pick] = []

    for raw_pick in raw_picks:
        if not isinstance(raw_pick, dict):
            raise PlannerDayInvalid("Each pick must be an object")
        poi_name = raw_pick.get("poi_name")
        start_hour = raw_pick.get("start_hour")
        if poi_name not in candidates_by_name:
            raise PlannerDayInvalid(f"Unknown candidate POI: {poi_name}")
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
        if not category_allows_window(candidates_by_name[poi_name].tags, window):
            raise PlannerDayInvalid(f"{poi_name} is not suitable for the {window} window")
        if poi_name in seen_names:
            raise PlannerDayInvalid(f"Repeated POI: {poi_name}")
        if start_hour in seen_times:
            raise PlannerDayInvalid(f"Repeated start time: {start_hour}")
        seen_names.add(poi_name)
        seen_times.add(start_hour)
        picks.append(Pick(poi_name=poi_name, start_hour=start_hour))

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
    is_nightlife = "nightlife" in normalized
    if is_food:
        return window in {"lunch", "dinner"}
    if is_nightlife:
        return window == "dinner"
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

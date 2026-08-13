"""Planner agents for canonical day generation."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from . import base


SYSTEM = (
    "You are a day planner for a trip itinerary. Choose only from the provided "
    "candidate POIs and assign them to the provided day slots. Do not invent "
    "places, times, prices, or constraints."
)

# Empty picks exercise the canonical generator's deterministic rules fallback
# without introducing a second runtime fallback inside this adapter.
MOCK: dict[str, Any] = {
    "note": "Mock planner returned no accepted picks.",
    "picks": [],
}

DAY_SLOTS = (10.0, 14.0, 19.0)


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
            "and slots."
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
                "minItems": 1,
                "maxItems": len(DAY_SLOTS),
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
        f'- poi_name="{candidate.name}"; place={candidate.place}; price={candidate.price}; '
        f"duration_min={candidate.duration_min}; open={candidate.opens}; "
        f"close={candidate.closes}; tags={','.join(candidate.tags)}"
        for candidate in payload.candidates
    ]
    return "\n".join(
        [
            f"Plan Day {payload.day_index}.",
            "Available slots: 10.0, 14.0, 19.0.",
            "Pick between 1 and 3 POIs. Use each slot at most once and each POI at most once.",
            "The 19.0 slot should be a meal or nightlife option when possible.",
            f"Budget left per person: {payload.budget_left}.",
            "Traveler interests: " + (", ".join(payload.interests) or "not specified"),
            "Already used POIs elsewhere in the trip: "
            + (", ".join(payload.already_used) or "none"),
            "",
            "Candidate POIs. Copy only the exact poi_name values:",
            *candidate_lines,
        ]
    )


def _parse_day_result(
    result: dict[str, Any], *, payload: PlanDayInput, used_ai: bool
) -> PlanDayResult:
    raw_picks = result.get("picks")
    if not isinstance(raw_picks, list) or not raw_picks:
        raise PlannerDayInvalid("Expected between 1 and 3 picks")

    candidate_names = {candidate.name for candidate in payload.candidates}
    seen_names: set[str] = set()
    seen_slots: set[float] = set()
    picks: list[Pick] = []

    for raw_pick in raw_picks:
        if not isinstance(raw_pick, dict):
            raise PlannerDayInvalid("Each pick must be an object")
        poi_name = raw_pick.get("poi_name")
        start_hour = raw_pick.get("start_hour")
        if poi_name not in candidate_names:
            raise PlannerDayInvalid(f"Unknown candidate POI: {poi_name}")
        if start_hour not in DAY_SLOTS:
            raise PlannerDayInvalid(f"Unsupported start_hour: {start_hour}")
        if poi_name in seen_names:
            raise PlannerDayInvalid(f"Repeated POI: {poi_name}")
        if start_hour in seen_slots:
            raise PlannerDayInvalid(f"Repeated slot: {start_hour}")
        seen_names.add(poi_name)
        seen_slots.add(float(start_hour))
        picks.append(Pick(poi_name=poi_name, start_hour=float(start_hour)))

    note = result.get("note")
    if not isinstance(note, str) or not note.strip():
        raise PlannerDayInvalid("Planner note is required")

    return PlanDayResult(
        picks=tuple(picks),
        used_ai=used_ai,
        planner_note=note.strip(),
    )

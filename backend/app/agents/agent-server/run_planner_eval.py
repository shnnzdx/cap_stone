"""Real-AI baseline evaluation harness for the current Planner.

Run from backend/:

    MOCK_AI=0 DISABLE_SCHEDULER=1 .venv/bin/python app/agents/agent-server/run_planner_eval.py

This harness intentionally evaluates only the current real Planner path.
It runs two isolated executions per scenario and reports both runs separately.
"""

from __future__ import annotations

import json
import math
import os
import re
import sys
from collections import Counter, defaultdict
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Iterator

from dotenv import load_dotenv
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker

BACKEND_ROOT = Path(__file__).resolve().parents[3]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

load_dotenv(BACKEND_ROOT / ".env", override=False)

from app.agents import planner  # noqa: E402
from app.db.models import (  # noqa: E402
    Base,
    MemberConstraint,
    Plan,
    PlanItem,
    Trip,
    TripMembership,
    User,
)
from app.domain.constraints.types import (  # noqa: E402
    Constraint,
    ConstraintKind,
    Importance,
)
from app.domain.places import service as place_service  # noqa: E402
from app.domain.plans import generator  # noqa: E402
from app.domain.preferences import service as pref_service  # noqa: E402
from data.poi_chicago import POIS  # noqa: E402


def _slug(value: str) -> str:
    compact = re.sub(r"[^a-z0-9]+", "-", value.casefold()).strip("-")
    return compact or "place"


def _now_utc() -> datetime:
    return datetime.now(timezone.utc)


def _iso_date(day_value: date) -> str:
    return day_value.isoformat()


def _round_time(hour: float) -> float:
    return round(float(hour), 2)


def _distance_km(
    left_lat: float | None,
    left_lng: float | None,
    right_lat: float | None,
    right_lng: float | None,
) -> float | None:
    if None in {left_lat, left_lng, right_lat, right_lng}:
        return None
    radius_km = 6371.0
    lat1, lat2 = math.radians(left_lat), math.radians(right_lat)
    dlat = math.radians(right_lat - left_lat)
    dlng = math.radians(right_lng - left_lng)
    haversine = (
        math.sin(dlat / 2) ** 2
        + math.cos(lat1) * math.cos(lat2) * math.sin(dlng / 2) ** 2
    )
    return 2 * radius_km * math.asin(math.sqrt(haversine))


def _simple_day_spread_km(items: list[PlanItem]) -> float | None:
    located = [item for item in items if item.lat is not None and item.lng is not None]
    if len(located) < 2:
        return 0.0 if located else None
    best = 0.0
    for index, left in enumerate(located):
        for right in located[index + 1:]:
            distance = _distance_km(left.lat, left.lng, right.lat, right.lng)
            if distance is not None:
                best = max(best, distance)
    return round(best, 3)


def _category_from_tags(tags: tuple[str, ...]) -> str:
    normalized = {tag.casefold() for tag in tags}
    if "food" in normalized:
        if "cafe" in normalized or "coffee" in normalized:
            return "catering.cafe"
        return "catering.restaurant"
    if "nightlife" in normalized or "music" in normalized:
        return "entertainment.nightlife"
    if "museum" in normalized or "art" in normalized or "culture" in normalized:
        return "entertainment.museum"
    if "park" in normalized or "garden" in normalized or "outdoor" in normalized:
        return "leisure.park"
    if "shopping" in normalized:
        return "commercial.shopping"
    return "tourism.attraction"


def _chicago_fixture_places() -> tuple[place_service.PlannerPlace, ...]:
    rows: list[place_service.PlannerPlace] = []
    for index, poi in enumerate(POIS, start=1):
        (
            name,
            location,
            latitude,
            longitude,
            price,
            duration_min,
            opens,
            closes,
            walking_level,
            access,
            diet,
            tags,
        ) = poi
        rows.append(
            place_service.PlannerPlace(
                candidate_id=f"fixture:chicago:{index:02d}:{_slug(name)}",
                name=name,
                local_name=None,
                location=location,
                latitude=float(latitude),
                longitude=float(longitude),
                category=_category_from_tags(tuple(tags)),
                address=location,
                image_url=None,
                opening_hours=None,
                price=float(price),
                duration_min=int(duration_min),
                opens=float(opens),
                closes=float(closes),
                walking_level=walking_level,
                access=tuple(str(value) for value in access),
                diet=tuple(str(value) for value in diet),
                tags=tuple(str(value) for value in tags),
                source="fixture_chicago",
            )
        )
    return tuple(rows)


def _tokyo_sparse_places() -> tuple[place_service.PlannerPlace, ...]:
    # Sparse-data baseline: realistic names, coordinates, and broad categories,
    # but intentionally limited operational facts to mimic thinner provider data.
    raw_rows = (
        ("Senso-ji Temple", "Asakusa", 35.7148, 139.7967, ("culture", "temple", "outdoor")),
        ("Nakamise Street Walk", "Asakusa", 35.7127, 139.7966, ("neighborhood", "shopping", "outdoor")),
        ("Sumida Riverside Walk", "Asakusa", 35.7106, 139.8011, ("outdoor", "views", "relaxed")),
        ("Ueno Park", "Ueno", 35.7156, 139.7730, ("outdoor", "park", "relaxed")),
        ("Tokyo National Museum", "Ueno", 35.7188, 139.7765, ("culture", "museum", "indoor")),
        ("Ameyoko Market Walk", "Ueno", 35.7090, 139.7745, ("neighborhood", "shopping", "food")),
        ("Akihabara Electric Town", "Akihabara", 35.6984, 139.7730, ("shopping", "culture", "indoor")),
        ("Kanda Shrine", "Akihabara", 35.7020, 139.7679, ("culture", "temple", "outdoor")),
        ("Imperial Palace East Gardens", "Marunouchi", 35.6852, 139.7528, ("culture", "park", "outdoor")),
        ("Tokyo Station Marunouchi Walk", "Marunouchi", 35.6812, 139.7671, ("architecture", "neighborhood", "indoor")),
        ("Ginza Main Street Walk", "Ginza", 35.6717, 139.7650, ("shopping", "neighborhood", "indoor")),
        ("Hamarikyu Gardens", "Shiodome", 35.6594, 139.7634, ("park", "outdoor", "relaxed")),
        ("Meiji Shrine", "Harajuku", 35.6764, 139.6993, ("culture", "temple", "outdoor")),
        ("Harajuku Backstreets", "Harajuku", 35.6702, 139.7027, ("shopping", "neighborhood", "outdoor")),
        ("Yoyogi Park", "Harajuku", 35.6728, 139.6949, ("park", "outdoor", "relaxed")),
        ("Shibuya Crossing View", "Shibuya", 35.6595, 139.7005, ("views", "signature", "evening")),
        ("Shibuya Stream Walk", "Shibuya", 35.6575, 139.7026, ("neighborhood", "food", "evening")),
        ("Tokyo Tower Viewpoint", "Minato", 35.6586, 139.7454, ("views", "signature", "evening")),
        ("Odaiba Seaside Park", "Odaiba", 35.6304, 139.7767, ("outdoor", "views", "relaxed")),
        ("teamLab Borderless Area", "Odaiba", 35.6251, 139.7768, ("culture", "art", "indoor")),
        ("Asakusa Casual Lunch", "Asakusa", 35.7119, 139.7961, ("food", "casual")),
        ("Ueno Ramen Counter", "Ueno", 35.7132, 139.7774, ("food", "casual", "budget")),
        ("Akihabara Curry House", "Akihabara", 35.6992, 139.7718, ("food", "casual", "budget")),
        ("Marunouchi Bistro", "Marunouchi", 35.6810, 139.7660, ("food", "casual")),
        ("Ginza Sushi Counter", "Ginza", 35.6712, 139.7640, ("food", "upscale", "evening")),
        ("Harajuku Cafe Stop", "Harajuku", 35.6697, 139.7044, ("food", "coffee", "cafe")),
        ("Shibuya Izakaya Alley", "Shibuya", 35.6590, 139.7000, ("food", "casual", "evening")),
        ("Odaiba Bay Dinner", "Odaiba", 35.6299, 139.7758, ("food", "upscale", "evening")),
    )
    rows: list[place_service.PlannerPlace] = []
    for index, (name, location, latitude, longitude, tags) in enumerate(raw_rows, start=1):
        rows.append(
            place_service.PlannerPlace(
                candidate_id=f"fixture:tokyo:{index:02d}:{_slug(name)}",
                name=name,
                local_name=None,
                location=location,
                latitude=float(latitude),
                longitude=float(longitude),
                category=_category_from_tags(tuple(tags)),
                address=location,
                image_url=None,
                opening_hours=None,
                price=None,
                duration_min=None,
                opens=None,
                closes=None,
                walking_level=None,
                access=(),
                diet=(),
                tags=tuple(tags),
                source="fixture_sparse",
            )
        )
    return tuple(rows)


@dataclass(frozen=True)
class ScenarioDefinition:
    slug: str
    name: str
    destination: str
    start_date: date
    days: int
    interests: tuple[str, ...]
    budget_ceiling: float | None
    place_supply: tuple[place_service.PlannerPlace, ...]
    currency: str = "USD"


SCENARIOS = (
    ScenarioDefinition(
        slug="chicago_rich_data",
        name="Chicago rich-data baseline",
        destination="Chicago",
        start_date=date(2026, 10, 20),
        days=4,
        interests=("culture", "food"),
        budget_ceiling=320.0,
        place_supply=_chicago_fixture_places(),
    ),
    ScenarioDefinition(
        slug="tokyo_sparse_fixed",
        name="Fixed sparse-data non-Chicago baseline",
        destination="Tokyo",
        start_date=date(2026, 11, 3),
        days=3,
        interests=("culture", "food"),
        budget_ceiling=None,
        place_supply=_tokyo_sparse_places(),
    ),
)


@dataclass
class RunInstrumentation:
    candidate_attempts: list[dict[str, Any]]
    planner_attempts: list[dict[str, Any]]
    rules_attempts: list[dict[str, Any]]
    build_attempts: list[dict[str, Any]]
    meal_insertions: list[dict[str, Any]]
    final_days: list[dict[str, Any]]


def _parse_failure_code(message: str) -> str:
    if message == "Expected between 2 and 4 picks":
        return "invalid_pick_count"
    if message == "Each pick must be an object":
        return "pick_not_object"
    if message == "Each pick must contain only candidate_id and start_hour":
        return "unexpected_pick_fields"
    if message.startswith("Unknown candidate_id:"):
        return "unknown_candidate_id"
    if message.startswith("Unsupported start_hour:"):
        return "unsupported_start_hour"
    if message.startswith("start_hour must use 15-minute increments:"):
        return "non_quarter_hour_start_time"
    if "is not suitable for the" in message:
        return "category_window_incompatible"
    if message.endswith("is not open yet"):
        return "before_known_open"
    if message.endswith("closes too early"):
        return "ends_after_known_close"
    if message.startswith("Repeated candidate_id:"):
        return "repeated_candidate_id"
    if message.startswith("Repeated start time:"):
        return "repeated_start_time"
    if message == "Planner note is required":
        return "missing_planner_note"
    return "planner_day_invalid"


def _raw_model_snapshot(result: dict[str, Any], *, repair_error: str | None) -> dict[str, Any]:
    raw_picks = result.get("picks")
    safe_picks = []
    if isinstance(raw_picks, list):
        for raw_pick in raw_picks:
            if isinstance(raw_pick, dict):
                safe_picks.append(
                    {
                        "candidate_id": raw_pick.get("candidate_id"),
                        "start_hour": raw_pick.get("start_hour"),
                    }
                )
            else:
                safe_picks.append({"raw": repr(raw_pick)})
    return {
        "repair_error": repair_error,
        "note": result.get("note") if isinstance(result.get("note"), str) else None,
        "raw_pick_count": len(raw_picks) if isinstance(raw_picks, list) else None,
        "raw_picks": safe_picks,
    }


def _constraint_violation_reason(
    item: generator.DraftItem,
    *,
    constraints: tuple[Constraint, ...],
    organizer_id: str,
    trip_total_after: float | None,
    day_walk_after: float | None,
) -> str | None:
    if item.poi.title == "":
        return "empty_title"
    window = planner.time_window(item.start_hour)
    if window is None:
        return "unsupported_time_window"
    if not planner.category_allows_window(item.poi.tags, window):
        return "category_window_incompatible"
    if generator._opening_status(item.poi, item.day_date, item.start_hour) is False:
        return "known_closed"
    if item.poi.opens is not None and item.start_hour < item.poi.opens:
        return "before_known_open"
    if item.poi.closes is not None and item.start_hour > item.poi.closes:
        return "after_known_close"
    if (
        item.poi.closes is not None
        and item.poi.duration_min is not None
        and item.start_hour + item.poi.duration_min / 60 > item.poi.closes
    ):
        return "ends_after_known_close"
    change = generator._change_for(
        day_index=item.day_index,
        day_date=item.day_date,
        slot=item.start_hour,
        poi=item.poi,
        trip_total_after=trip_total_after,
        day_walk_after=day_walk_after,
        organizer_id=organizer_id,
    )
    for constraint in constraints:
        if (
            generator._is_flexible_meal_break(item.poi)
            and constraint.kind is ConstraintKind.DIETARY
        ):
            continue
        if generator.violates(constraint, change):
            return f"constraint_violation:{constraint.kind.value}"
    return None


def _trace_rule_slot(
    candidates: tuple[generator.Poi, ...],
    *,
    slots_left: int,
    start_hour: float,
    day_index: int,
    day_date: date,
    constraints: tuple[Constraint, ...],
    organizer_id: str,
    trip_total_before: float | None,
    day_walk_before: float | None,
    already_used: set[str],
    attempt: int,
    reference_poi: generator.Poi | None,
    interests: tuple[str, ...],
    scheduled_items: tuple[generator.DraftItem, ...],
) -> dict[str, Any]:
    headroom = generator._budget_headroom(constraints, trip_total_before)
    if headroom is not None and slots_left > 0:
        per_slot = headroom / slots_left
        affordable = [
            poi for poi in candidates if poi.price is not None and poi.price <= per_slot
        ]
        pool = (
            sorted(affordable, key=lambda poi: -poi.price)
            if affordable
            else sorted(
                candidates,
                key=lambda poi: poi.price if poi.price is not None else math.inf,
            )
        )
    else:
        pool = list(candidates)
    if reference_poi is not None:
        pool.sort(
            key=lambda poi: (
                generator._poi_distance_km(reference_poi, poi),
                -generator._poi_relevance_score(poi, interests),
                -generator._poi_quality_score(poi),
                poi.title.casefold(),
            )
        )
    else:
        pool.sort(
            key=lambda poi: (
                -generator._poi_relevance_score(poi, interests),
                -generator._poi_quality_score(poi),
                poi.title.casefold(),
            )
        )
    ordered = tuple(pool[attempt:] + pool[:attempt])
    rejection_counts: Counter[str] = Counter()
    rejection_samples: list[dict[str, Any]] = []
    accepted: dict[str, Any] | None = None

    for poi in ordered:
        reason: str | None = None
        window = planner.time_window(start_hour)
        if poi.title in already_used:
            reason = "already_used"
        elif window is None:
            reason = "unsupported_time_window"
        elif not planner.category_allows_window(poi.tags, window):
            reason = "category_window_incompatible"
        elif (
            not poi.is_meal
            and window == "afternoon"
            and start_hour >= 16.0
            and poi.duration_min is not None
            and start_hour + poi.duration_min / 60 > generator.RULE_TIME_OPTIONS["dinner"][-1]
        ):
            reason = "would_overlap_dinner_window"
        else:
            proposed = generator.DraftItem(
                day_index=day_index,
                day_date=day_date,
                start_hour=start_hour,
                poi=poi,
                generated_by="rules",
            )
            if generator._draft_interval_conflicts(proposed, scheduled_items):
                reason = "interval_conflict"
            else:
                reason = _constraint_violation_reason(
                    proposed,
                    constraints=constraints,
                    organizer_id=organizer_id,
                    trip_total_after=generator._add_known(trip_total_before, poi.price),
                    day_walk_after=generator._add_known(day_walk_before, generator._walk_km(poi)),
                )
        if reason is None:
            accepted = {
                "candidate_id": poi.candidate_id,
                "title": poi.title,
                "start_hour": _round_time(start_hour),
            }
            break
        rejection_counts[reason] += 1
        if len(rejection_samples) < 8:
            rejection_samples.append(
                {
                    "candidate_id": poi.candidate_id,
                    "title": poi.title,
                    "reason": reason,
                }
            )
    return {
        "start_hour": _round_time(start_hour),
        "accepted": accepted,
        "rejection_counts": dict(sorted(rejection_counts.items())),
        "rejection_samples": rejection_samples,
    }


@contextmanager
def _fixed_place_supply(
    scenario: ScenarioDefinition,
) -> Iterator[None]:
    original = generator.place_service.places_for_planner

    def fixed_places(_db: Session, destination: str, **_kwargs: Any):
        if destination.strip().casefold() != scenario.destination.strip().casefold():
            raise AssertionError(
                f"Unexpected destination for fixed place supply: {destination!r}"
            )
        return scenario.place_supply

    generator.place_service.places_for_planner = fixed_places
    try:
        yield
    finally:
        generator.place_service.places_for_planner = original


@contextmanager
def _instrument_generator() -> Iterator[RunInstrumentation]:
    capture = RunInstrumentation(
        candidate_attempts=[],
        planner_attempts=[],
        rules_attempts=[],
        build_attempts=[],
        meal_insertions=[],
        final_days=[],
    )

    original_day_candidates = generator._day_candidates
    original_add_meal_anchors = generator._add_meal_anchors
    original_plan_day = planner.plan_day
    original_call_day_model = planner._call_day_model
    original_parse_day_result = planner._parse_day_result
    original_planner_day = generator._planner_day
    original_rules_day = generator._rules_day
    original_build_day = generator._build_day
    current_build_context: dict[str, Any] | None = None
    current_planner_trace: dict[str, Any] | None = None

    def wrapped_day_candidates(*args: Any, **kwargs: Any):
        result = original_day_candidates(*args, **kwargs)
        capture.candidate_attempts.append(
            {
                "day_index": kwargs["day_index"],
                "day_date": _iso_date(kwargs["day_date"]),
                "attempt": kwargs["attempt"],
                "candidate_count": len(result),
                "candidate_ids": [poi.candidate_id for poi in result if not poi.is_meal],
                "known_hours_count": sum(
                    poi.opens is not None or poi.closes is not None or bool(poi.opening_hours)
                    for poi in result
                    if not poi.is_meal
                ),
                "known_duration_count": sum(
                    poi.duration_min is not None for poi in result if not poi.is_meal
                ),
                "known_coordinate_count": sum(
                    poi.lat is not None and poi.lng is not None
                    for poi in result
                    if not poi.is_meal
                ),
            }
        )
        return result

    def wrapped_plan_day(payload: planner.PlanDayInput) -> planner.PlanDayResult:
        nonlocal current_planner_trace
        trace = current_planner_trace
        if trace is not None:
            trace["attempted"] = True
            trace["candidate_count"] = len(payload.candidates)
        try:
            raw_result = original_call_day_model(payload)
        except generator.base.AgentUnavailable as exc:
            if trace is not None:
                trace["fallback_trigger"] = {
                    "code": "provider_or_model_execution_failure",
                    "message": str(exc),
                }
            raise
        if trace is not None:
            trace["model_ok"] = True
            trace["model_responses"].append(
                _raw_model_snapshot(raw_result, repair_error=None)
            )
        if generator.base.is_mocked():
            try:
                parsed = original_parse_day_result(raw_result, payload=payload, used_ai=False)
                if trace is not None:
                    trace["parse_events"].append(
                        {
                            "phase": "initial",
                            "ok": True,
                            "raw_pick_count": len(parsed.picks),
                            "parsed_pick_count": len(parsed.picks),
                            "picked_ids": [pick.candidate_id for pick in parsed.picks],
                            "picked_start_hours": [_round_time(pick.start_hour) for pick in parsed.picks],
                        }
                    )
                return parsed
            except planner.PlannerDayInvalid as exc:
                if trace is not None:
                    trace["parse_events"].append(
                        {
                            "phase": "initial",
                            "ok": False,
                            "code": _parse_failure_code(str(exc)),
                            "message": str(exc),
                        }
                    )
                    trace["fallback_trigger"] = {
                        "code": "planner_day_unusable_after_parse",
                        "message": str(exc),
                    }
                raise planner.PlannerDayUnusable(str(exc)) from exc
        try:
            parsed = original_parse_day_result(raw_result, payload=payload, used_ai=True)
            if trace is not None:
                trace["parse_events"].append(
                    {
                        "phase": "initial",
                        "ok": True,
                        "raw_pick_count": len(parsed.picks),
                        "parsed_pick_count": len(parsed.picks),
                        "picked_ids": [pick.candidate_id for pick in parsed.picks],
                        "picked_start_hours": [_round_time(pick.start_hour) for pick in parsed.picks],
                    }
                )
            return parsed
        except planner.PlannerDayInvalid as exc:
            if trace is not None:
                trace["parse_events"].append(
                    {
                        "phase": "initial",
                        "ok": False,
                        "code": _parse_failure_code(str(exc)),
                        "message": str(exc),
                    }
                )
                trace["repair_used"] = True
            repair_error = str(exc)
        try:
            repaired = original_call_day_model(payload, repair_error=repair_error)
        except generator.base.AgentUnavailable as exc:
            if trace is not None:
                trace["fallback_trigger"] = {
                    "code": "provider_or_model_execution_failure",
                    "message": str(exc),
                }
            raise
        if trace is not None:
            trace["model_ok"] = True
            trace["model_responses"].append(
                _raw_model_snapshot(repaired, repair_error=repair_error)
            )
        try:
            parsed = original_parse_day_result(repaired, payload=payload, used_ai=True)
            if trace is not None:
                trace["parse_events"].append(
                    {
                        "phase": "repair",
                        "ok": True,
                        "raw_pick_count": len(parsed.picks),
                        "parsed_pick_count": len(parsed.picks),
                        "picked_ids": [pick.candidate_id for pick in parsed.picks],
                        "picked_start_hours": [_round_time(pick.start_hour) for pick in parsed.picks],
                    }
                )
            return parsed
        except planner.PlannerDayInvalid as retry_exc:
            if trace is not None:
                trace["parse_events"].append(
                    {
                        "phase": "repair",
                        "ok": False,
                        "code": _parse_failure_code(str(retry_exc)),
                        "message": str(retry_exc),
                    }
                )
                trace["fallback_trigger"] = {
                    "code": "repair_retry_exhausted",
                    "message": str(retry_exc),
                }
            raise planner.PlannerDayUnusable(str(retry_exc)) from retry_exc

    def wrapped_planner_day(*args: Any, **kwargs: Any):
        nonlocal current_planner_trace
        day_index = kwargs["day_index"]
        day_date = kwargs["day_date"]
        candidates = kwargs["candidates"]
        constraints = kwargs["constraints"]
        organizer_id = kwargs["organizer_id"]
        already_selected = kwargs["already_selected"]
        current_total = generator._draft_total(already_selected)
        trace: dict[str, Any] = {
            "day_index": day_index,
            "day_date": _iso_date(day_date),
            "attempt": None if current_build_context is None else current_build_context["attempt"],
            "candidate_count": len(candidates),
            "attempted": False,
            "model_ok": False,
            "repair_used": False,
            "model_responses": [],
            "parse_events": [],
            "accepted_pick_count": 0,
            "accepted_picks": [],
            "rejected_picks": [],
            "fallback_trigger": None,
            "result": None,
        }
        sightseeing_candidates = tuple(poi for poi in candidates if not poi.is_meal)
        candidate_by_id = {poi.candidate_id: poi for poi in sightseeing_candidates}
        if len(sightseeing_candidates) < generator.MIN_DAY_ACTIVITIES:
            trace["fallback_trigger"] = {
                "code": "insufficient_sightseeing_candidates_before_planner",
                "message": f"Only {len(sightseeing_candidates)} sightseeing candidates reached Planner.",
            }
            capture.planner_attempts.append(trace)
            return None
        payload = planner.PlanDayInput(
            day_index=day_index,
            candidates=tuple(
                planner.PoiOption(
                    candidate_id=poi.candidate_id,
                    name=poi.title,
                    local_name=poi.local_title,
                    place=poi.place,
                    category=poi.category,
                    latitude=poi.lat,
                    longitude=poi.lng,
                    opening_hours=poi.opening_hours,
                    price=poi.price,
                    duration_min=poi.duration_min,
                    opens=poi.opens,
                    closes=poi.closes,
                    tags=poi.tags,
                )
                for poi in sightseeing_candidates
            ),
            already_used=tuple(sorted(kwargs["already_used"])),
            budget_left=generator._budget_left(constraints, current_total),
            interests=kwargs["interests"],
            hard_constraints=generator._planner_constraint_summaries(constraints, day_date),
            preferred_activity_count=kwargs["preferred_activity_count"],
        )
        current_planner_trace = trace
        try:
            day_result = planner.plan_day(payload)
        except (generator.base.AgentUnavailable, planner.PlannerDayUnusable) as exc:
            if trace["fallback_trigger"] is None:
                trace["fallback_trigger"] = {
                    "code": "planner_day_unusable_after_parse",
                    "message": str(exc),
                }
            capture.planner_attempts.append(trace)
            return None
        finally:
            current_planner_trace = None

        items: list[generator.DraftItem] = []
        day_used: set[str] = set()
        day_walk = 0.0
        for pick in day_result.picks:
            poi = candidate_by_id.get(pick.candidate_id)
            reason: str | None = None
            if poi is None:
                reason = "candidate_missing_after_parse"
            elif poi.title in day_used:
                reason = "duplicate_title_after_parse"
            else:
                window = planner.time_window(pick.start_hour)
                if window is None:
                    reason = "unsupported_time_window"
                elif not planner.category_allows_window(poi.tags, window):
                    reason = "category_window_incompatible"
                else:
                    item = generator.DraftItem(
                        day_index=day_index,
                        day_date=day_date,
                        start_hour=pick.start_hour,
                        poi=poi,
                        generated_by="planner",
                    )
                    if generator._draft_interval_conflicts(item, tuple(items)):
                        reason = "interval_conflict"
                    else:
                        reason = _constraint_violation_reason(
                            item,
                            constraints=constraints,
                            organizer_id=organizer_id,
                            trip_total_after=generator._add_known(current_total, poi.price),
                            day_walk_after=generator._add_known(day_walk, generator._walk_km(poi)),
                        )
                    if reason is None:
                        items.append(item)
                        day_used.add(poi.title)
                        current_total = generator._add_known(current_total, poi.price)
                        day_walk = generator._add_known(day_walk, generator._walk_km(poi))
                        trace["accepted_picks"].append(
                            {
                                "candidate_id": poi.candidate_id,
                                "title": poi.title,
                                "start_hour": _round_time(pick.start_hour),
                            }
                        )
            if reason is not None:
                trace["rejected_picks"].append(
                    {
                        "candidate_id": pick.candidate_id,
                        "start_hour": _round_time(pick.start_hour),
                        "reason": reason,
                    }
                )

        trace["accepted_pick_count"] = len(trace["accepted_picks"])
        if not items:
            trace["fallback_trigger"] = {
                "code": "insufficient_valid_planner_picks",
                "message": "No planner pick survived deterministic filtering.",
            }
            capture.planner_attempts.append(trace)
            return None
        missing_meal_windows = [
            window
            for window in ("lunch", "dinner")
            if generator._meal_start_hour(window, day_index, tuple(items)) is None
        ]
        if missing_meal_windows:
            trace["fallback_trigger"] = {
                "code": "meal_anchor_window_unavailable_after_planner_items",
                "message": "Planner sightseeing left no legal meal-anchor space.",
                "windows": missing_meal_windows,
            }
            capture.planner_attempts.append(trace)
            return None
        day = generator.DayDraft(
            day_index=day_index,
            items=tuple(items),
            generated_by="planner",
            used_ai=day_result.used_ai,
            planner_note=day_result.planner_note,
        )
        trace["result"] = {
            "generated_by": day.generated_by,
            "used_ai": day.used_ai,
            "planner_note": day.planner_note,
            "picked_ids": [item.poi.candidate_id for item in day.items if not item.poi.is_meal],
            "picked_start_hours": [
                _round_time(item.start_hour)
                for item in day.items
                if not item.poi.is_meal
            ],
        }
        capture.planner_attempts.append(trace)
        return day

    def wrapped_rules_day(*args: Any, **kwargs: Any):
        day_index = kwargs["day_index"]
        day_date = kwargs["day_date"]
        attempt = kwargs["attempt"]
        candidates = kwargs["candidates"]
        constraints = kwargs["constraints"]
        organizer_id = kwargs["organizer_id"]
        already_selected = kwargs["already_selected"]
        already_used = kwargs["already_used"]
        preferred_activity_count = kwargs["preferred_activity_count"]
        interests = kwargs["interests"]

        trace: dict[str, Any] = {
            "day_index": day_index,
            "day_date": _iso_date(day_date),
            "attempt": attempt,
            "candidate_count": len(candidates),
            "preferred_activity_count": preferred_activity_count,
            "slot_attempts": [],
            "result": None,
        }
        items: list[generator.DraftItem] = []
        day_used: set[str] = set()
        current_total = generator._draft_total(already_selected)
        day_walk = 0.0

        sightseeing_candidates = tuple(poi for poi in candidates if not poi.is_meal)
        patterns = generator.SIGHTSEEING_TIME_PATTERNS.get(
            preferred_activity_count, generator.SIGHTSEEING_TIME_PATTERNS[3]
        )
        preferred_times = patterns[(day_index + attempt) % len(patterns)]
        has_evening_candidate = any(
            planner.category_allows_window(poi.tags, "evening")
            for poi in sightseeing_candidates
        )
        if has_evening_candidate and day_index % 3 == 0 and preferred_times:
            preferred_times = preferred_times[:-1] + (20.25,)
        fallback_times = tuple(
            time
            for time in (9.0, 10.0, 14.0, 15.0, 16.0, 16.5)
            if time not in preferred_times
        )
        trace["preferred_times"] = [_round_time(value) for value in preferred_times]
        trace["fallback_times"] = [_round_time(value) for value in fallback_times]
        for candidate_time in preferred_times + fallback_times:
            if len(items) >= preferred_activity_count:
                break
            slot_trace = _trace_rule_slot(
                sightseeing_candidates,
                slots_left=kwargs["slots_left"] - len(items),
                start_hour=candidate_time,
                day_index=day_index,
                day_date=day_date,
                constraints=constraints,
                organizer_id=organizer_id,
                trip_total_before=current_total,
                day_walk_before=day_walk,
                already_used=already_used | day_used,
                attempt=attempt,
                reference_poi=items[-1].poi if items else None,
                interests=interests,
                scheduled_items=tuple(items),
            )
            poi = generator._pick_rule_candidate(
                sightseeing_candidates,
                slots_left=kwargs["slots_left"] - len(items),
                start_hour=candidate_time,
                day_index=day_index,
                day_date=day_date,
                constraints=constraints,
                organizer_id=organizer_id,
                trip_total_before=current_total,
                day_walk_before=day_walk,
                already_used=already_used | day_used,
                attempt=attempt,
                reference_poi=items[-1].poi if items else None,
                interests=interests,
                scheduled_items=tuple(items),
            )
            trace["slot_attempts"].append(slot_trace)
            if poi is None:
                continue
            items.append(
                generator.DraftItem(
                    day_index=day_index,
                    day_date=day_date,
                    start_hour=candidate_time,
                    poi=poi,
                    generated_by="rules",
                )
            )
            day_used.add(poi.title)
            current_total = generator._add_known(current_total, poi.price)
            day_walk = generator._add_known(day_walk, generator._walk_km(poi))

        if len(items) < generator.MIN_DAY_ACTIVITIES:
            trace["result"] = None
            capture.rules_attempts.append(trace)
            return None
        day = generator.DayDraft(
            day_index=day_index,
            items=tuple(items),
            generated_by="rules",
            used_ai=False,
            planner_note=generator.RULES_DAY_NOTE,
        )
        trace["result"] = {
            "generated_by": day.generated_by,
            "picked_ids": [item.poi.candidate_id for item in day.items if not item.poi.is_meal],
            "picked_start_hours": [
                _round_time(item.start_hour)
                for item in day.items
                if not item.poi.is_meal
            ],
        }
        capture.rules_attempts.append(trace)
        return day

    def wrapped_add_meal_anchors(day: generator.DayDraft, *args: Any, **kwargs: Any):
        before_titles = {item.poi.title for item in day.items}
        enriched = original_add_meal_anchors(day, *args, **kwargs)
        inserted = [
            item for item in enriched.items
            if item.poi.is_meal and item.poi.title not in before_titles
        ]
        capture.meal_insertions.append(
            {
                "day_index": day.day_index,
                "inserted_meal_ids": [item.poi.candidate_id for item in inserted],
                "inserted_meal_titles": [item.poi.title for item in inserted],
            }
        )
        return enriched

    def wrapped_build_day(*args: Any, **kwargs: Any):
        nonlocal current_build_context
        accepted_day: generator.DayDraft | None = None
        accepted_attempt_trace: dict[str, Any] | None = None
        for attempt in range(2):
            effective_already_used = (
                set()
                if kwargs["allow_reuse_across_days"] and attempt > 0
                else set(kwargs["already_used"])
            )
            current_build_context = {"day_index": kwargs["day_index"], "attempt": attempt}
            candidates = wrapped_day_candidates(
                day_index=kwargs["day_index"],
                day_date=kwargs["day_date"],
                constraints=kwargs["constraints"],
                organizer_id=kwargs["organizer_id"],
                already_selected=kwargs["already_selected"],
                already_used=effective_already_used,
                attempt=attempt,
                poi_pool=kwargs["poi_pool"],
                interests=kwargs["interests"],
            )
            attempt_trace: dict[str, Any] = {
                "day_index": kwargs["day_index"],
                "day_date": _iso_date(kwargs["day_date"]),
                "attempt": attempt,
                "reuse_reset": bool(kwargs["allow_reuse_across_days"] and attempt > 0),
                "candidate_pool_count": len(candidates),
                "planner_attempt": None,
                "rules_attempt": None,
                "post_meal_day_complete": None,
                "post_meal_validate_items": None,
                "accepted_generated_by": None,
            }
            if not candidates:
                capture.build_attempts.append(attempt_trace)
                continue

            day = wrapped_planner_day(
                day_index=kwargs["day_index"],
                day_date=kwargs["day_date"],
                candidates=candidates,
                constraints=kwargs["constraints"],
                organizer_id=kwargs["organizer_id"],
                already_selected=kwargs["already_selected"],
                already_used=effective_already_used,
                interests=kwargs["interests"],
                preferred_activity_count=kwargs["preferred_activity_count"],
            )
            attempt_trace["planner_attempt"] = capture.planner_attempts[-1]
            if day is None:
                day = wrapped_rules_day(
                    slots_left=kwargs["slots_left"],
                    day_index=kwargs["day_index"],
                    day_date=kwargs["day_date"],
                    candidates=candidates,
                    constraints=kwargs["constraints"],
                    organizer_id=kwargs["organizer_id"],
                    already_selected=kwargs["already_selected"],
                    already_used=effective_already_used,
                    attempt=attempt,
                    preferred_activity_count=kwargs["preferred_activity_count"],
                    interests=kwargs["interests"],
                )
                attempt_trace["rules_attempt"] = capture.rules_attempts[-1]

            if day is not None:
                day = wrapped_add_meal_anchors(
                    day,
                    candidates=candidates,
                    constraints=kwargs["constraints"],
                    organizer_id=kwargs["organizer_id"],
                    already_selected=kwargs["already_selected"],
                    already_used=effective_already_used,
                    meal_budget_cap=kwargs["meal_budget_cap"],
                )
                is_complete = generator._day_complete(day)
                is_valid = generator._validate_items(
                    kwargs["already_selected"] + day.items,
                    kwargs["constraints"],
                    kwargs["organizer_id"],
                    allow_reuse_across_days=kwargs["allow_reuse_across_days"],
                )
                attempt_trace["post_meal_day_complete"] = is_complete
                attempt_trace["post_meal_validate_items"] = is_valid
                if (
                    day.generated_by == "planner"
                    and attempt_trace["planner_attempt"] is not None
                    and attempt_trace["planner_attempt"]["fallback_trigger"] is None
                    and not is_complete
                ):
                    attempt_trace["planner_attempt"]["fallback_trigger"] = {
                        "code": "planner_day_incomplete_after_meal_anchors",
                        "message": "Planner day did not satisfy final completeness checks after meal insertion.",
                    }
                if (
                    day.generated_by == "planner"
                    and attempt_trace["planner_attempt"] is not None
                    and attempt_trace["planner_attempt"]["fallback_trigger"] is None
                    and is_complete
                    and not is_valid
                ):
                    attempt_trace["planner_attempt"]["fallback_trigger"] = {
                        "code": "planner_day_rejected_by_final_validation",
                        "message": "Planner day failed full-trip validation after meal insertion.",
                    }
                if is_complete and is_valid:
                    attempt_trace["accepted_generated_by"] = day.generated_by
                    accepted_day = day
                    accepted_attempt_trace = attempt_trace
                    capture.build_attempts.append(attempt_trace)
                    break
            capture.build_attempts.append(attempt_trace)
        current_build_context = None
        capture.final_days.append(
            {
                "day_index": kwargs["day_index"],
                "day_date": _iso_date(kwargs["day_date"]),
                "result": None
                if accepted_day is None
                else {
                    "generated_by": accepted_day.generated_by,
                    "used_ai": accepted_day.used_ai,
                    "planner_note": accepted_day.planner_note,
                    "item_ids": [item.poi.candidate_id for item in accepted_day.items],
                    "item_titles": [item.poi.title for item in accepted_day.items],
                    "accepted_attempt": None if accepted_attempt_trace is None else accepted_attempt_trace["attempt"],
                },
            }
        )
        return accepted_day

    generator._day_candidates = wrapped_day_candidates
    planner.plan_day = wrapped_plan_day
    generator._planner_day = wrapped_planner_day
    generator._rules_day = wrapped_rules_day
    generator._add_meal_anchors = wrapped_add_meal_anchors
    generator._build_day = wrapped_build_day
    try:
        yield capture
    finally:
        generator._day_candidates = original_day_candidates
        planner.plan_day = original_plan_day
        generator._add_meal_anchors = original_add_meal_anchors
        planner._call_day_model = original_call_day_model
        planner._parse_day_result = original_parse_day_result
        generator._planner_day = original_planner_day
        generator._rules_day = original_rules_day
        generator._build_day = original_build_day


def _seed_trip_for_scenario(
    db: Session,
    scenario: ScenarioDefinition,
    *,
    run_label: str,
) -> dict[str, Any]:
    organizer_user = User(
        name=f"{scenario.slug} organizer {run_label}",
        email=f"{scenario.slug}-organizer-{run_label}@example.com",
    )
    participant_user = User(
        name=f"{scenario.slug} participant {run_label}",
        email=f"{scenario.slug}-participant-{run_label}@example.com",
    )
    db.add_all([organizer_user, participant_user])
    db.flush()

    trip = Trip(
        name=f"{scenario.name} {run_label}",
        destination=scenario.destination,
        preferred_start_date=scenario.start_date,
        preferred_end_date=scenario.start_date + timedelta(days=scenario.days - 1),
        expected_group_size=2,
        currency=scenario.currency,
        status="planning",
        created_by_user_id=organizer_user.id,
    )
    db.add(trip)
    db.flush()

    organizer = TripMembership(
        trip_id=trip.id,
        user_id=organizer_user.id,
        role="organizer",
        status="joined",
    )
    participant = TripMembership(
        trip_id=trip.id,
        user_id=participant_user.id,
        role="participant",
        status="joined",
    )
    db.add_all([organizer, participant])
    db.flush()

    db.add(Plan(trip_id=trip.id, currency=trip.currency))
    db.flush()

    end_date = trip.preferred_end_date
    pref_service.save_mine(
        db,
        organizer,
        pref_service.PreferenceData(
            preferred_start_date=trip.preferred_start_date,
            preferred_end_date=end_date,
            available_start_date=trip.preferred_start_date,
            available_end_date=end_date,
            ideal_budget=120.0 if scenario.budget_ceiling else None,
            maximum_budget=scenario.budget_ceiling,
            currency=scenario.currency,
            top_interests=scenario.interests,
        ),
    )
    pref_service.save_mine(
        db,
        participant,
        pref_service.PreferenceData(
            preferred_start_date=trip.preferred_start_date,
            preferred_end_date=end_date,
            available_start_date=trip.preferred_start_date,
            available_end_date=end_date,
            ideal_budget=120.0 if scenario.budget_ceiling else None,
            maximum_budget=scenario.budget_ceiling,
            currency=scenario.currency,
            top_interests=scenario.interests,
        ),
    )

    db.add_all(
        [
            MemberConstraint(
                trip_membership_id=organizer.id,
                kind="time_window",
                importance="required",
                params={"earliest_hour": 9.0, "latest_hour": 23.5},
            ),
            MemberConstraint(
                trip_membership_id=participant.id,
                kind="date_range",
                importance="required",
                params={
                    "start": trip.preferred_start_date.isoformat(),
                    "end": end_date.isoformat(),
                },
            ),
        ]
    )
    if scenario.budget_ceiling is not None:
        db.add(
            MemberConstraint(
                trip_membership_id=participant.id,
                kind="budget_ceiling",
                importance="required",
                params={"max_total_per_person": scenario.budget_ceiling},
            )
        )
    db.flush()
    return {"trip": trip, "organizer": organizer, "participant": participant}


def _domain_constraint(row: MemberConstraint) -> Constraint:
    params = dict(row.params or {})
    for key in ("start", "end"):
        if isinstance(params.get(key), str):
            params[key] = date.fromisoformat(params[key])
    return Constraint(
        id=row.id,
        membership_id=row.trip_membership_id,
        kind=ConstraintKind(row.kind),
        importance=Importance(row.importance),
        params=params,
    )


def _draft_item_from_plan_item(
    item: PlanItem,
    *,
    generated_by: str,
) -> generator.DraftItem:
    poi = generator.Poi(
        candidate_id=f"persisted:{item.id}",
        title=item.title,
        category=None,
        local_title=item.local_title,
        place=item.place,
        lat=item.lat,
        lng=item.lng,
        price=item.price_per_person,
        duration_min=item.duration_min,
        opens=None,
        closes=None,
        walk=None,
        access=(),
        diet=tuple(item.dietary_tags or ()),
        tags=tuple(item.tags or ()),
        photo_url=item.photo_url,
        source=item.source,
        opening_hours=None,
    )
    return generator.DraftItem(
        day_index=item.day_index,
        day_date=item.day_date,
        start_hour=item.start_hour,
        poi=poi,
        generated_by=generated_by,
    )


def _group_items_by_day(items: list[PlanItem]) -> dict[int, list[PlanItem]]:
    grouped: dict[int, list[PlanItem]] = defaultdict(list)
    for item in items:
        grouped[item.day_index].append(item)
    for day_items in grouped.values():
        day_items.sort(key=lambda row: row.start_hour)
    return dict(grouped)


def _reused_sightseeing_titles(items: list[PlanItem]) -> dict[str, int]:
    counts = Counter(
        item.title for item in items
        if not item.is_meal and "meal_break" not in (item.tags or [])
    )
    return {title: count for title, count in sorted(counts.items()) if count > 1}


def _repeated_sightseeing_patterns(day_items: dict[int, list[PlanItem]]) -> dict[str, list[int]]:
    patterns: dict[tuple[float, ...], list[int]] = defaultdict(list)
    for day_index, items in day_items.items():
        pattern = tuple(
            _round_time(item.start_hour) for item in items
            if not item.is_meal
        )
        patterns[pattern].append(day_index)
    return {
        ", ".join(str(hour) for hour in pattern): day_indexes
        for pattern, day_indexes in patterns.items()
        if len(day_indexes) > 1
    }


def _obvious_day_issues(items: list[PlanItem]) -> list[str]:
    issues: list[str] = []
    sightseeing = [item for item in items if not item.is_meal]
    if len(sightseeing) < generator.MIN_DAY_ACTIVITIES:
        issues.append("too_few_sightseeing_items")
    if len(sightseeing) > generator.MAX_DAY_ACTIVITIES:
        issues.append("too_many_sightseeing_items")
    if len({item.start_hour for item in items}) != len(items):
        issues.append("duplicate_start_hour")
    if len({item.title for item in sightseeing}) != len(sightseeing):
        issues.append("duplicate_sightseeing_title")
    for item in items:
        window = planner.time_window(item.start_hour)
        if window is None:
            issues.append(f"unsupported_time_window:{item.title}")
            continue
        if not planner.category_allows_window(tuple(item.tags or ()), window):
            issues.append(f"invalid_window:{item.title}")
    return sorted(set(issues))


def _required_constraint_violation_count(
    draft: tuple[generator.DraftItem, ...],
    constraints: tuple[Constraint, ...],
    organizer_id: str,
) -> int:
    total = generator._draft_total(draft)
    walk_by_date: dict[date, float | None] = {}
    for item in draft:
        walk_by_date[item.day_date] = generator._add_known(
            walk_by_date.get(item.day_date, 0.0),
            generator._walk_km(item.poi),
        )
    count = 0
    for item in draft:
        if not generator._candidate_valid_after(
            item,
            constraints=constraints,
            organizer_id=organizer_id,
            trip_total_after=total,
            day_walk_after=walk_by_date[item.day_date],
        ):
            count += 1
    return count


def _preferred_targets(
    db: Session,
    trip: Trip,
) -> dict[int, int]:
    dates = generator._trip_dates(trip)
    availability = generator._load_availability_by_date(db, trip.id, dates)
    return {
        day_index: generator._preferred_activity_count(
            day_index,
            availability.get(day_date),
        )
        for day_index, day_date in enumerate(dates, start=1)
    }


def _day_generated_by(day_index: int, capture: RunInstrumentation) -> str | None:
    for entry in capture.final_days:
        if entry["day_index"] == day_index and entry["result"] is not None:
            return str(entry["result"]["generated_by"])
    return None


def _day_used_ai(day_index: int, capture: RunInstrumentation) -> bool | None:
    for entry in capture.final_days:
        if entry["day_index"] == day_index and entry["result"] is not None:
            return bool(entry["result"]["used_ai"])
    return None


def _day_planner_note(day_index: int, capture: RunInstrumentation) -> str | None:
    for entry in capture.final_days:
        if entry["day_index"] == day_index and entry["result"] is not None:
            return entry["result"]["planner_note"]
    return None


def _candidate_attempt_for_day(day_index: int, capture: RunInstrumentation) -> dict[str, Any] | None:
    attempts = [entry for entry in capture.candidate_attempts if entry["day_index"] == day_index]
    return attempts[0] if attempts else None


def _meal_insertion_for_day(day_index: int, capture: RunInstrumentation) -> dict[str, Any] | None:
    for entry in capture.meal_insertions:
        if entry["day_index"] == day_index:
            return entry
    return None


def _build_run_report(
    db: Session,
    scenario: ScenarioDefinition,
    run_label: str,
    seeded: dict[str, Any],
    result: generator.GenerationResult,
    capture: RunInstrumentation,
) -> dict[str, Any]:
    trip = seeded["trip"]
    organizer = seeded["organizer"]
    constraints = tuple(
        _domain_constraint(row)
        for row in db.scalars(
            select(MemberConstraint).join(
                TripMembership,
                TripMembership.id == MemberConstraint.trip_membership_id,
            ).where(TripMembership.trip_id == trip.id)
        ).all()
        if row.importance == "required"
    )
    allow_reuse = not any(
        constraint.kind is ConstraintKind.BUDGET_CEILING for constraint in constraints
    )
    items = db.scalars(
        select(PlanItem)
        .join(Plan, PlanItem.plan_id == Plan.id)
        .where(Plan.trip_id == trip.id)
        .order_by(PlanItem.day_index, PlanItem.start_hour)
    ).all()
    items_by_day = _group_items_by_day(items)
    preferred_targets = _preferred_targets(db, trip)

    draft = tuple(
        _draft_item_from_plan_item(
            item,
            generated_by=_day_generated_by(item.day_index, capture) or "rules",
        )
        for item in items
    )
    final_validation_passed = (
        result.status == "active"
        and generator._validate_items(
            draft,
            constraints,
            organizer.id,
            allow_reuse_across_days=allow_reuse,
        )
    )
    required_violation_count = _required_constraint_violation_count(
        draft,
        constraints,
        organizer.id,
    ) if draft else 0

    day_reports: list[dict[str, Any]] = []
    trip_dates = generator._trip_dates(trip)
    for day_index, day_date in enumerate(trip_dates, start=1):
        day_items = items_by_day.get(day_index, [])
        sightseeing = [item for item in day_items if not item.is_meal]
        meals = [item for item in day_items if item.is_meal]
        target = preferred_targets.get(day_index, generator.MIN_DAY_ACTIVITIES)
        candidate_attempt = _candidate_attempt_for_day(day_index, capture)
        underfilled = (
            bool(day_items)
            and len(sightseeing) < target
            and candidate_attempt is not None
            and int(candidate_attempt["candidate_count"]) >= target
        )
        day_reports.append(
            {
                "day_index": day_index,
                "day_date": _iso_date(day_date),
                "generated_by": _day_generated_by(day_index, capture),
                "used_ai": _day_used_ai(day_index, capture),
                "planner_note": _day_planner_note(day_index, capture),
                "core": {
                    "sightseeing_count": len(sightseeing),
                    "meal_count": len(meals),
                    "underfilled": underfilled,
                    "geographic_spread_km": _simple_day_spread_km(day_items),
                    "obvious_day_issues": _obvious_day_issues(day_items),
                },
                "items": [
                    {
                        "title": item.title,
                        "place": item.place,
                        "start_hour": _round_time(item.start_hour),
                        "duration_min": item.duration_min,
                        "is_meal": item.is_meal,
                        "tags": list(item.tags or []),
                    }
                    for item in day_items
                ],
                "diagnostics": {
                    "target_sightseeing_count": target,
                    "candidate_attempt": candidate_attempt,
                    "meal_insertion": _meal_insertion_for_day(day_index, capture),
                },
            }
        )

    ai_day_count = sum(1 for day in day_reports if day["generated_by"] == "planner")
    rules_day_count = sum(1 for day in day_reports if day["generated_by"] == "rules")

    return {
        "scenario": scenario.slug,
        "scenario_name": scenario.name,
        "mode": "real_ai",
        "run_label": run_label,
        "status": result.status,
        "generated_by": result.generated_by,
        "used_ai": result.used_ai,
        "blocked_reason": result.blocked_reason,
        "core_metrics": {
            "generation_outcome": {
                "status": result.status,
                "blocked_reason": result.blocked_reason,
            },
            "final_legality": {
                "final_validation_passed": final_validation_passed,
                "required_constraint_violation_count": required_violation_count,
                "obvious_illegal_day_issues": {
                    str(day["day_index"]): day["core"]["obvious_day_issues"]
                    for day in day_reports
                    if day["core"]["obvious_day_issues"]
                },
            },
            "ai_survival_fallback": {
                "generated_by_per_day": {
                    str(day["day_index"]): day["generated_by"] for day in day_reports
                },
                "ai_generated_day_count": ai_day_count,
                "rules_fallback_day_count": rules_day_count,
                "used_ai": result.used_ai,
            },
            "day_completeness": {
                "per_day": {
                    str(day["day_index"]): {
                        "sightseeing_count": day["core"]["sightseeing_count"],
                        "meal_count": day["core"]["meal_count"],
                        "underfilled": day["core"]["underfilled"],
                    }
                    for day in day_reports
                }
            },
            "cross_day_variety": {
                "reused_sightseeing_titles": _reused_sightseeing_titles(items),
                "repeated_exact_sightseeing_start_patterns": _repeated_sightseeing_patterns(items_by_day),
            },
            "geographic_coherence": {
                "per_day_spread_km": {
                    str(day["day_index"]): day["core"]["geographic_spread_km"]
                    for day in day_reports
                }
            },
        },
        "days": day_reports,
        "diagnostics": {
            "candidate_attempts": capture.candidate_attempts,
            "planner_attempts": capture.planner_attempts,
            "rules_attempts": capture.rules_attempts,
            "build_attempts": capture.build_attempts,
            "meal_insertions": capture.meal_insertions,
            "final_day_selection": capture.final_days,
            "place_supply": {
                "count": len(scenario.place_supply),
                "fixed_source": sorted({place.source for place in scenario.place_supply}),
                "destination": scenario.destination,
            },
        },
        "generated_item_count": len(items),
        "captured_at": _now_utc().isoformat(),
    }


def _print_run_summary(report: dict[str, Any]) -> None:
    print(f"  {report['run_label']}:")
    print(
        f"    status={report['status']} generated_by={report['generated_by']} "
        f"used_ai={report['used_ai']}"
    )
    if report["blocked_reason"]:
        print(f"    blocked_reason={report['blocked_reason']}")
    legality = report["core_metrics"]["final_legality"]
    print(
        "    legality="
        f"passed={legality['final_validation_passed']} "
        f"required_constraint_violation_count={legality['required_constraint_violation_count']}"
    )
    fallback = report["core_metrics"]["ai_survival_fallback"]
    print(
        "    fallback="
        f"ai_days={fallback['ai_generated_day_count']} "
        f"rules_days={fallback['rules_fallback_day_count']}"
    )
    variety = report["core_metrics"]["cross_day_variety"]
    print(
        "    variety="
        f"reused_titles={len(variety['reused_sightseeing_titles'])} "
        f"repeated_patterns={len(variety['repeated_exact_sightseeing_start_patterns'])}"
    )
    for day in report["days"]:
        print(
            "    "
            f"day {day['day_index']} ({day['generated_by']}): "
            f"sightseeing={day['core']['sightseeing_count']} "
            f"meals={day['core']['meal_count']} "
            f"underfilled={day['core']['underfilled']} "
            f"spread_km={day['core']['geographic_spread_km']}"
        )


def _execute_run(
    engine,
    scenario: ScenarioDefinition,
    *,
    run_label: str,
) -> dict[str, Any]:
    connection = engine.connect()
    transaction = connection.begin()
    session = sessionmaker(bind=connection, future=True)()
    try:
        seeded = _seed_trip_for_scenario(session, scenario, run_label=run_label)
        with _fixed_place_supply(scenario), _instrument_generator() as capture:
            result = generator.generate_plan(
                session,
                seeded["trip"].id,
                seeded["organizer"],
            )
        report = _build_run_report(session, scenario, run_label, seeded, result, capture)
        return report
    finally:
        session.close()
        if transaction.is_active:
            transaction.rollback()
        connection.close()


def main() -> None:
    if os.getenv("MOCK_AI") != "0":
        raise SystemExit(
            "This harness evaluates the real Planner path only. Set MOCK_AI=0 before running."
        )

    database_url = os.getenv(
        "TEST_DATABASE_URL",
        os.getenv("DATABASE_URL", "postgresql+psycopg://localhost/tripsync_test"),
    )
    engine = create_engine(database_url, future=True)
    Base.metadata.create_all(engine)
    try:
        reports: list[dict[str, Any]] = []
        for scenario in SCENARIOS:
            print(f"Scenario: {scenario.name}")
            run_1 = _execute_run(engine, scenario, run_label="run_1")
            _print_run_summary(run_1)
            run_2 = _execute_run(engine, scenario, run_label="run_2")
            _print_run_summary(run_2)
            reports.append(
                {
                    "scenario": scenario.slug,
                    "scenario_name": scenario.name,
                    "runs": [run_1, run_2],
                }
            )
            print()
        print("=== JSON Report ===")
        print(json.dumps(reports, ensure_ascii=False, indent=2, default=str))
    finally:
        engine.dispose()


if __name__ == "__main__":
    main()

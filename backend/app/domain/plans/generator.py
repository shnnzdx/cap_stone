"""Plan generation pipeline plus deterministic rules fallback."""

from __future__ import annotations

import math
from dataclasses import dataclass
from datetime import date, timedelta
from typing import Iterable

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ...agents import base, planner
from ...db.models import (
    MemberConstraint,
    Plan,
    PlanChange,
    PlanItem,
    Preference,
    Trip,
    TripMembership,
)
from ..constraints.engine import violates
from ..constraints.types import (
    Constraint,
    ConstraintKind,
    Importance,
    ItemView,
    ProposedChange,
    Settledness,
)
from ..places import service as place_service

MIN_DAY_ACTIVITIES = planner.MIN_DAY_ACTIVITIES
MAX_DAY_ACTIVITIES = planner.MAX_DAY_ACTIVITIES
DAY_ACTIVITY_PATTERN = (3, 2, 4, 3, 2)
RULE_TIME_OPTIONS = {
    "morning": (9.0, 9.5, 10.0, 10.5),
    "lunch": (11.75, 12.0, 12.5, 13.0),
    "afternoon": (14.0, 14.5, 15.0, 15.5, 16.0),
    "dinner": (17.75, 18.0, 18.5, 19.0, 19.5),
}
SIGHTSEEING_TIME_PATTERNS = {
    2: ((9.5, 16.0), (10.0, 16.5)),
    3: ((9.0, 14.25, 16.5), (9.5, 14.75, 16.75)),
    4: ((9.0, 10.75, 14.25, 16.5), (9.5, 10.5, 14.75, 16.75)),
}
VALIDATION_START_TIMES = tuple(
    start_hour for options in RULE_TIME_OPTIONS.values() for start_hour in options
)
BUDGET_BLOCKED_REASON = (
    "At least one member's budget ceiling cannot be met with the places available."
)
CONSTRAINTS_BLOCKED_REASON = (
    "Cadensy could not build a complete itinerary from the current dates and required constraints."
)
DATES_BLOCKED_REASON = "Trip dates are missing or invalid, so Cadensy cannot build an itinerary."
RULES_DAY_NOTE = "Deterministic rules fallback generated this day."


class TripNotFound(Exception):
    """The requested trip does not exist."""


class OrganizerRequired(Exception):
    """Only the organizer can generate a plan."""


class OrganizerPreferencesRequired(Exception):
    """The organizer must submit preferences before generation."""


class PlanAlreadyHasItems(Exception):
    """Do not regenerate over existing itinerary decisions."""


@dataclass(frozen=True)
class Poi:
    title: str
    place: str
    lat: float | None
    lng: float | None
    price: float | None
    duration_min: int | None
    opens: float | None
    closes: float | None
    walk: str | None
    access: tuple[str, ...]
    diet: tuple[str, ...]
    tags: tuple[str, ...]
    local_title: str | None = None
    photo_url: str | None = None
    source: str = "geoapify"

    @property
    def is_meal(self) -> bool:
        return planner.is_reliable_meal_candidate(self.tags)


@dataclass(frozen=True)
class DraftItem:
    day_index: int
    day_date: date
    start_hour: float
    poi: Poi
    generated_by: str


@dataclass(frozen=True)
class DayDraft:
    day_index: int
    items: tuple[DraftItem, ...]
    generated_by: str
    used_ai: bool = False
    planner_note: str | None = None


@dataclass(frozen=True)
class DayPlannerNote:
    day_index: int
    source: str
    note: str
    used_ai: bool


@dataclass(frozen=True)
class GenerationResult:
    plan: Plan
    status: str
    days: list[dict]
    blocked_reason: str | None
    generated_by: str
    used_ai: bool = False
    planner_note: tuple[DayPlannerNote, ...] | None = None
    items: tuple[PlanItem, ...] = ()


def generate_plan(db: Session, trip_id: str, organizer: TripMembership) -> GenerationResult:
    """Generate, validate, and persist a plan.

    The API layer intentionally delegates all business gates here: organizer
    authorization, organizer preference readiness, regeneration protection,
    candidate filtering, retry, validation, and write behavior.
    """
    trip = db.get(Trip, trip_id)
    if trip is None:
        raise TripNotFound("Trip not found")
    if organizer.trip_id != trip_id or organizer.role != "organizer":
        raise OrganizerRequired("Only the organizer can generate a plan")
    if not _organizer_has_submitted_preferences(db, organizer):
        raise OrganizerPreferencesRequired(
            "The organizer must submit preferences before generating a plan"
        )
    if _trip_has_items(db, trip_id):
        raise PlanAlreadyHasItems("This trip already has plan items")

    plan = _plan_for_trip(db, trip)
    constraints = _load_required_constraints(
        db,
        trip_id,
        enforce_budget_ceilings=_trip_membership_count(db, trip_id) > 1,
    )
    interests = _load_interests(db, trip_id)
    dates = _trip_dates(trip)
    availability_by_date = _load_availability_by_date(db, trip_id, dates)
    preferred_counts = tuple(
        _preferred_activity_count(day_index, availability_by_date.get(day_date))
        for day_index, day_date in enumerate(dates, start=1)
    )
    poi_pool = tuple(
        _as_poi(place)
        for place in place_service.places_for_planner(db, trip.destination)
    )
    blocked_reason = _blocked_reason(dates, constraints)
    allow_reuse_across_days = not any(
        constraint.kind is ConstraintKind.BUDGET_CEILING for constraint in constraints
    )

    draft: list[DraftItem] = []
    used: set[str] = set()
    accepted_days: list[DayDraft] = []

    for day_index, day_date in enumerate(dates, start=1):
        # Count remaining slots in the whole trip so fallback can reserve budget for later days.
        # Otherwise early days pick expensive options and the later days can make the plan blocked.
        slots_left = sum(preferred_counts[day_index - 1:])
        day = _build_day(
            slots_left=slots_left,
            day_index=day_index,
            day_date=day_date,
            constraints=constraints,
            organizer_id=organizer.id,
            already_selected=tuple(draft),
            already_used=used,
            interests=interests,
            preferred_activity_count=preferred_counts[day_index - 1],
            allow_reuse_across_days=allow_reuse_across_days,
            poi_pool=poi_pool,
        )
        if day is None:
            plan.status = "blocked"
            plan.blocked_reason = blocked_reason
            plan.estimated_total_per_person = None
            db.flush()
            return GenerationResult(
                plan=plan,
                status="blocked",
                days=_days_out(dates, ()),
                blocked_reason=blocked_reason,
                generated_by="rules",
                used_ai=False,
                planner_note=None,
            )
        draft.extend(day.items)
        accepted_days.append(day)
        used.update(
            item.poi.title for item in day.items if not _is_flexible_meal_break(item.poi)
        )

    if not _is_complete(dates, tuple(draft)):
        plan.status = "blocked"
        plan.blocked_reason = blocked_reason
        plan.estimated_total_per_person = None
        db.flush()
        return GenerationResult(
            plan=plan,
            status="blocked",
            days=_days_out(dates, ()),
            blocked_reason=blocked_reason,
            generated_by="rules",
            used_ai=False,
            planner_note=None,
        )

    items = _write_items(db, plan, tuple(draft))
    plan.status = "active"
    plan.blocked_reason = None
    plan.estimated_total_per_person = _known_item_total(items)
    db.flush()
    return GenerationResult(
        plan=plan,
        status="active",
        days=_days_out(dates, items),
        blocked_reason=None,
        generated_by=_aggregate_generated_by(tuple(accepted_days)),
        used_ai=any(day.used_ai for day in accepted_days),
        planner_note=_aggregate_planner_note(tuple(accepted_days)),
        items=items,
    )


def _organizer_has_submitted_preferences(db: Session, organizer: TripMembership) -> bool:
    pref = db.scalar(
        select(Preference).where(Preference.trip_membership_id == organizer.id)
    )
    return (
        organizer.status == "preferences_submitted"
        and pref is not None
        and pref.submitted_at is not None
    )


def _trip_has_items(db: Session, trip_id: str) -> bool:
    return db.scalar(
        select(PlanItem.id)
        .join(Plan, PlanItem.plan_id == Plan.id)
        .where(Plan.trip_id == trip_id)
        .limit(1)
    ) is not None


def _plan_for_trip(db: Session, trip: Trip) -> Plan:
    plan = db.scalar(select(Plan).where(Plan.trip_id == trip.id).order_by(Plan.created_at))
    if plan is not None:
        plan.currency = trip.currency
        return plan
    plan = Plan(trip_id=trip.id, currency=trip.currency)
    db.add(plan)
    db.flush()
    return plan


def _trip_dates(trip: Trip) -> tuple[date, ...]:
    if trip.preferred_start_date is None or trip.preferred_end_date is None:
        return ()
    if trip.preferred_end_date < trip.preferred_start_date:
        return ()
    count = (trip.preferred_end_date - trip.preferred_start_date).days + 1
    return tuple(trip.preferred_start_date + timedelta(days=i) for i in range(count))


def _blocked_reason(
    dates: tuple[date, ...], constraints: tuple[Constraint, ...]
) -> str:
    if not dates:
        return DATES_BLOCKED_REASON
    if any(constraint.kind is ConstraintKind.BUDGET_CEILING for constraint in constraints):
        return BUDGET_BLOCKED_REASON
    return CONSTRAINTS_BLOCKED_REASON


def _trip_membership_count(db: Session, trip_id: str) -> int:
    return db.scalar(
        select(func.count())
        .select_from(TripMembership)
        .where(TripMembership.trip_id == trip_id)
    ) or 0


def _load_required_constraints(
    db: Session, trip_id: str, *, enforce_budget_ceilings: bool = True
) -> tuple[Constraint, ...]:
    rows = db.scalars(
        select(MemberConstraint)
        .join(TripMembership, TripMembership.id == MemberConstraint.trip_membership_id)
        .where(
            TripMembership.trip_id == trip_id,
            MemberConstraint.importance == Importance.REQUIRED.value,
        )
        .order_by(MemberConstraint.created_at)
    ).all()
    return tuple(
        Constraint(
            id=row.id,
            membership_id=row.trip_membership_id,
            kind=ConstraintKind(row.kind),
            importance=Importance(row.importance),
            params=_normalize_params(row.params or {}),
        )
        for row in rows
        if enforce_budget_ceilings or row.kind != ConstraintKind.BUDGET_CEILING.value
    )


def _load_interests(db: Session, trip_id: str) -> tuple[str, ...]:
    prefs = db.scalars(
        select(Preference)
        .join(TripMembership, TripMembership.id == Preference.trip_membership_id)
        .where(TripMembership.trip_id == trip_id)
        .order_by(Preference.submitted_at)
    ).all()
    interests: list[str] = []
    seen: set[str] = set()
    for pref in prefs:
        for interest in pref.top_interests or ():
            if interest not in seen:
                interests.append(interest)
                seen.add(interest)
    return tuple(interests)


def _load_availability_by_date(
    db: Session, trip_id: str, dates: tuple[date, ...]
) -> dict[date, tuple[int, int]]:
    """Return submitted-member availability as a soft scheduling signal.

    Missing availability means the member selected the full trip. A partial window
    can make a day lighter, but never invalidates or removes a trip day.
    """
    preferences = db.scalars(
        select(Preference)
        .join(TripMembership, TripMembership.id == Preference.trip_membership_id)
        .where(
            TripMembership.trip_id == trip_id,
            Preference.submitted_at.is_not(None),
        )
    ).all()
    total = len(preferences)
    if total == 0:
        return {}
    return {
        day_date: (
            sum(
                1
                for preference in preferences
                if (
                    preference.available_start_date is None
                    or preference.available_start_date <= day_date
                )
                and (
                    preference.available_end_date is None
                    or day_date <= preference.available_end_date
                )
            ),
            total,
        )
        for day_date in dates
    }


def _preferred_activity_count(
    day_index: int, availability: tuple[int, int] | None
) -> int:
    preferred = DAY_ACTIVITY_PATTERN[(day_index - 1) % len(DAY_ACTIVITY_PATTERN)]
    if availability is not None:
        available, submitted = availability
        if submitted and available < submitted:
            return MIN_DAY_ACTIVITIES
    return preferred


def _normalize_params(params: dict) -> dict:
    normalized = dict(params)
    for key in ("start", "end"):
        value = normalized.get(key)
        if isinstance(value, str):
            normalized[key] = date.fromisoformat(value)
    return normalized


def _build_day(
    *,
    slots_left: int,
    day_index: int,
    day_date: date,
    constraints: tuple[Constraint, ...],
    organizer_id: str,
    already_selected: tuple[DraftItem, ...],
    already_used: set[str],
    interests: tuple[str, ...],
    preferred_activity_count: int,
    allow_reuse_across_days: bool,
    poi_pool: tuple[Poi, ...],
) -> DayDraft | None:
    for attempt in range(2):
        effective_already_used = (
            set()
            if allow_reuse_across_days and attempt > 0
            else set(already_used)
        )
        candidates = _day_candidates(
            day_index=day_index,
            day_date=day_date,
            constraints=constraints,
            organizer_id=organizer_id,
            already_selected=already_selected,
            already_used=effective_already_used,
            attempt=attempt,
            poi_pool=poi_pool,
        )
        if not candidates:
            continue

        day = _planner_day(
            day_index=day_index,
            day_date=day_date,
            candidates=candidates,
            constraints=constraints,
            organizer_id=organizer_id,
            already_selected=already_selected,
            already_used=effective_already_used,
            interests=interests,
            preferred_activity_count=preferred_activity_count,
        )
        if day is None:
            day = _rules_day(
                slots_left=slots_left,
                day_index=day_index,
                day_date=day_date,
                candidates=candidates,
                constraints=constraints,
                organizer_id=organizer_id,
                already_selected=already_selected,
                already_used=effective_already_used,
                attempt=attempt,
                preferred_activity_count=preferred_activity_count,
            )

        if day is not None:
            day = _add_meal_anchors(
                day,
                candidates=candidates,
                constraints=constraints,
                organizer_id=organizer_id,
                already_selected=already_selected,
                already_used=effective_already_used,
            )

        if day is not None and _day_complete(day) and _validate_items(
            already_selected + day.items,
            constraints,
            organizer_id,
            allow_reuse_across_days=allow_reuse_across_days,
        ):
            return day

    return None


def _day_candidates(
    *,
    day_index: int,
    day_date: date,
    constraints: tuple[Constraint, ...],
    organizer_id: str,
    already_selected: tuple[DraftItem, ...],
    already_used: set[str],
    attempt: int,
    poi_pool: tuple[Poi, ...],
) -> tuple[Poi, ...]:
    current_total = _draft_total(already_selected)
    candidates: list[Poi] = []
    for poi in _candidate_order(poi_pool, attempt):
        if poi.title in already_used:
            continue
        if _legal_slots(
            poi,
            day_index=day_index,
            day_date=day_date,
            constraints=constraints,
            organizer_id=organizer_id,
            trip_total_before=current_total,
            day_walk_before=0.0,
        ):
            candidates.append(poi)
    return tuple(candidates)


def _planner_day(
    *,
    day_index: int,
    day_date: date,
    candidates: tuple[Poi, ...],
    constraints: tuple[Constraint, ...],
    organizer_id: str,
    already_selected: tuple[DraftItem, ...],
    already_used: set[str],
    interests: tuple[str, ...],
    preferred_activity_count: int,
) -> DayDraft | None:
    sightseeing_candidates = tuple(poi for poi in candidates if not poi.is_meal)
    candidate_by_name = {poi.title: poi for poi in sightseeing_candidates}
    if len(sightseeing_candidates) < MIN_DAY_ACTIVITIES:
        return None
    payload = planner.PlanDayInput(
        day_index=day_index,
        candidates=tuple(
            planner.PoiOption(
                name=poi.title,
                place=poi.place,
                price=poi.price,
                duration_min=poi.duration_min,
                opens=poi.opens,
                closes=poi.closes,
                tags=poi.tags,
            )
            for poi in sightseeing_candidates
        ),
        already_used=tuple(sorted(already_used)),
        budget_left=_budget_left(constraints, _draft_total(already_selected)),
        interests=interests,
        preferred_activity_count=preferred_activity_count,
    )

    try:
        day_result = planner.plan_day(payload)
    except (base.AgentUnavailable, planner.PlannerDayUnusable):
        return None

    items: list[DraftItem] = []
    day_used: set[str] = set()
    current_total = _draft_total(already_selected)
    day_walk = 0.0
    for pick in day_result.picks:
        poi = candidate_by_name.get(pick.poi_name)
        if poi is None or poi.title in day_used:
            continue
        window = planner.time_window(pick.start_hour)
        if window is None or not planner.category_allows_window(poi.tags, window):
            continue
        item = DraftItem(
            day_index=day_index,
            day_date=day_date,
            start_hour=pick.start_hour,
            poi=poi,
            generated_by="planner",
        )
        if not _candidate_valid_after(
            item,
            constraints=constraints,
            organizer_id=organizer_id,
            trip_total_after=_add_known(current_total, poi.price),
            day_walk_after=_add_known(day_walk, _walk_km(poi)),
        ):
            continue
        items.append(item)
        day_used.add(poi.title)
        current_total = _add_known(current_total, poi.price)
        day_walk = _add_known(day_walk, _walk_km(poi))

    if not items:
        return None
    return DayDraft(
        day_index=day_index,
        items=tuple(items),
        generated_by="planner",
        used_ai=day_result.used_ai,
        planner_note=day_result.planner_note,
    )


def _rules_day(
    *,
    slots_left: int,
    day_index: int,
    day_date: date,
    candidates: tuple[Poi, ...],
    constraints: tuple[Constraint, ...],
    organizer_id: str,
    already_selected: tuple[DraftItem, ...],
    already_used: set[str],
    attempt: int,
    preferred_activity_count: int,
) -> DayDraft | None:
    items: list[DraftItem] = []
    day_used: set[str] = set()
    current_total = _draft_total(already_selected)
    day_walk = 0.0

    sightseeing_candidates = tuple(poi for poi in candidates if not poi.is_meal)
    patterns = SIGHTSEEING_TIME_PATTERNS.get(
        preferred_activity_count, SIGHTSEEING_TIME_PATTERNS[3]
    )
    preferred_times = patterns[(day_index + attempt) % len(patterns)]
    fallback_times = tuple(
        time
        for time in (9.0, 10.0, 14.0, 15.0, 16.0, 16.5)
        if time not in preferred_times
    )
    for candidate_time in preferred_times + fallback_times:
        if len(items) >= preferred_activity_count:
            break
        poi = _pick_rule_candidate(
            sightseeing_candidates,
            slots_left=slots_left - len(items),
            start_hour=candidate_time,
            day_index=day_index,
            day_date=day_date,
            constraints=constraints,
            organizer_id=organizer_id,
            trip_total_before=current_total,
            day_walk_before=day_walk,
            already_used=already_used | day_used,
            attempt=attempt,
        )
        if poi is None:
            continue
        items.append(
            DraftItem(
                day_index=day_index,
                day_date=day_date,
                start_hour=candidate_time,
                poi=poi,
                generated_by="rules",
            )
        )
        day_used.add(poi.title)
        current_total = _add_known(current_total, poi.price)
        day_walk = _add_known(day_walk, _walk_km(poi))

    if len(items) < MIN_DAY_ACTIVITIES:
        return None
    return DayDraft(
        day_index=day_index,
        items=tuple(items),
        generated_by="rules",
        used_ai=False,
        planner_note=RULES_DAY_NOTE,
    )


def _add_meal_anchors(
    day: DayDraft,
    *,
    candidates: tuple[Poi, ...],
    constraints: tuple[Constraint, ...],
    organizer_id: str,
    already_selected: tuple[DraftItem, ...],
    already_used: set[str],
) -> DayDraft:
    """Add honest lunch/dinner opportunities without turning them into hard gates."""
    items = list(day.items)
    used = already_used | {item.poi.title for item in items}
    meal_candidates = tuple(
        poi
        for poi in candidates
        if poi.is_meal
        and poi.title
        and poi.place
        and poi.lat is not None
        and poi.lng is not None
    )

    for window in ("lunch", "dinner"):
        start_hour = _meal_start_hour(window, day.day_index)
        current_draft = already_selected + tuple(items)
        current_total = _draft_total(current_draft)
        day_walk = _day_walk(tuple(items))
        poi = _pick_rule_candidate(
            meal_candidates,
            slots_left=1,
            start_hour=start_hour,
            day_index=day.day_index,
            day_date=items[0].day_date,
            constraints=constraints,
            organizer_id=organizer_id,
            trip_total_before=current_total,
            day_walk_before=day_walk,
            already_used=used,
            attempt=day.day_index,
        )
        if poi is None:
            poi = _flexible_meal_break(window)
            break_item = DraftItem(
                day_index=day.day_index,
                day_date=items[0].day_date,
                start_hour=start_hour,
                poi=poi,
                generated_by="rules",
            )
            if not _candidate_valid_after(
                break_item,
                constraints=constraints,
                organizer_id=organizer_id,
                trip_total_after=current_total,
                day_walk_after=day_walk,
            ):
                continue
        item = DraftItem(
            day_index=day.day_index,
            day_date=items[0].day_date,
            start_hour=start_hour,
            poi=poi,
            generated_by="rules",
        )
        items.append(item)
        used.add(poi.title)

    return DayDraft(
        day_index=day.day_index,
        items=tuple(sorted(items, key=lambda item: item.start_hour)),
        generated_by=day.generated_by,
        used_ai=day.used_ai,
        planner_note=day.planner_note,
    )


def _meal_start_hour(window: str, day_index: int) -> float:
    options = RULE_TIME_OPTIONS[window]
    return options[day_index % len(options)]


def _flexible_meal_break(window: str) -> Poi:
    return Poi(
        title=f"Flexible {window} break",
        place="Choose a convenient option nearby",
        lat=None,
        lng=None,
        price=None,
        duration_min=None,
        opens=None,
        closes=None,
        walk=None,
        access=(),
        diet=(),
        tags=("food", "meal_break"),
        source="schedule",
    )


def _is_flexible_meal_break(poi: Poi) -> bool:
    return "meal_break" in poi.tags


def _day_walk(items: tuple[DraftItem, ...]) -> float | None:
    total: float | None = 0.0
    for item in items:
        total = _add_known(total, _walk_km(item.poi))
    return total


def _budget_headroom(
    constraints: tuple[Constraint, ...], spent: float | None
) -> float | None:
    """Remaining spend, based on the tightest budget ceiling rather than the average.

    Return None when no one has set a budget ceiling."""
    if spent is None:
        return None
    ceilings = [
        c.params.get("max_total_per_person")
        for c in constraints
        if c.kind is ConstraintKind.BUDGET_CEILING
        and c.importance is Importance.REQUIRED
        and c.params.get("max_total_per_person") is not None
    ]
    if not ceilings:
        return None
    return max(0.0, min(ceilings) - spent)


def _pick_rule_candidate(
    candidates: tuple[Poi, ...],
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
) -> Poi | None:
    # Reserve budget for later slots. Without this, greedy selection front-loads cost.
    # If the first two days pick expensive places, the third day can run out of budget and block the plan.
    # Within the reserved budget, choose the most expensive viable option so the plan uses the budget instead of overusing free stops.
    headroom = _budget_headroom(constraints, trip_total_before)
    if headroom is not None and slots_left > 0:
        per_slot = headroom / slots_left
        affordable = [
            poi for poi in candidates
            if poi.price is not None and poi.price <= per_slot
        ]
        pool = sorted(affordable, key=lambda poi: -poi.price) if affordable \
            else sorted(candidates, key=lambda poi: poi.price if poi.price is not None else math.inf)
    else:
        pool = list(candidates)
    ordered = tuple(pool[attempt:] + pool[:attempt])
    for poi in ordered:
        if poi.title in already_used:
            continue
        window = planner.time_window(start_hour)
        if window is None or not planner.category_allows_window(poi.tags, window):
            continue
        if not _candidate_valid_after(
            DraftItem(
                day_index=day_index,
                day_date=day_date,
                start_hour=start_hour,
                poi=poi,
                generated_by="rules",
            ),
            constraints=constraints,
            organizer_id=organizer_id,
            trip_total_after=_add_known(trip_total_before, poi.price),
            day_walk_after=_add_known(day_walk_before, _walk_km(poi)),
        ):
            continue
        return poi
    return None


def _candidate_order(pois: tuple[Poi, ...], attempt: int) -> tuple[Poi, ...]:
    if not pois:
        return ()
    offset = attempt % len(pois)
    return pois[offset:] + pois[:offset]


def _as_poi(raw: place_service.PlannerPlace) -> Poi:
    return Poi(
        title=raw.name,
        local_title=raw.local_name,
        place=raw.address or raw.location,
        lat=raw.latitude,
        lng=raw.longitude,
        price=raw.price,
        duration_min=raw.duration_min,
        opens=raw.opens,
        closes=raw.closes,
        walk=raw.walking_level,
        access=raw.access,
        diet=raw.diet,
        tags=raw.tags,
        photo_url=raw.image_url,
        source=raw.source,
    )


def _legal_slots(
    poi: Poi,
    *,
    day_index: int,
    day_date: date,
    constraints: tuple[Constraint, ...],
    organizer_id: str,
    trip_total_before: float | None,
    day_walk_before: float | None,
) -> tuple[float, ...]:
    return tuple(
        slot
        for slot in VALIDATION_START_TIMES
        if _candidate_valid_after(
            DraftItem(
                day_index=day_index,
                day_date=day_date,
                start_hour=slot,
                poi=poi,
                generated_by="rules",
            ),
            constraints=constraints,
            organizer_id=organizer_id,
            trip_total_after=_add_known(trip_total_before, poi.price),
            day_walk_after=_add_known(day_walk_before, _walk_km(poi)),
        )
    )


def _candidate_valid_after(
    item: DraftItem,
    *,
    constraints: tuple[Constraint, ...],
    organizer_id: str,
    trip_total_after: float | None,
    day_walk_after: float | None,
) -> bool:
    if item.poi.title == "":
        return False
    window = planner.time_window(item.start_hour)
    if window is None or not planner.category_allows_window(item.poi.tags, window):
        return False
    if item.poi.opens is not None and item.start_hour < item.poi.opens:
        return False
    if item.poi.closes is not None and item.start_hour > item.poi.closes:
        return False
    change = _change_for(
        day_index=item.day_index,
        day_date=item.day_date,
        slot=item.start_hour,
        poi=item.poi,
        trip_total_after=trip_total_after,
        day_walk_after=day_walk_after,
        organizer_id=organizer_id,
    )
    return not any(violates(constraint, change) for constraint in constraints)


def _walk_km(poi: Poi) -> float | None:
    return {"low": 0.5, "medium": 1.5, "high": 3.0}.get(poi.walk)


def _change_for(
    *,
    day_index: int,
    day_date: date,
    slot: float,
    poi: Poi,
    trip_total_after: float | None,
    day_walk_after: float | None,
    organizer_id: str,
) -> ProposedChange:
    view = ItemView(
        id=f"draft:{day_index}:{slot}:{poi.title}",
        day_date=day_date,
        start_hour=slot,
        duration_min=poi.duration_min,
        price_per_person=poi.price,
        tags=frozenset(poi.tags),
        dietary_tags=frozenset(poi.diet),
        is_meal=poi.is_meal,
        settledness=Settledness.LOOSE,
    )
    return ProposedChange(
        before=view,
        after=view,
        day_walk_km_after=day_walk_after,
        trip_total_after=trip_total_after,
        requested_by_membership_id=organizer_id,
    )


def _is_complete(dates: tuple[date, ...], draft: tuple[DraftItem, ...]) -> bool:
    if not dates:
        return False
    counts = {day_index: 0 for day_index in range(1, len(dates) + 1)}
    for item in draft:
        if item.day_index not in counts:
            return False
        if not item.poi.is_meal:
            counts[item.day_index] += 1
    return all(MIN_DAY_ACTIVITIES <= count <= MAX_DAY_ACTIVITIES for count in counts.values())


def _day_complete(day: DayDraft) -> bool:
    windows = [planner.time_window(item.start_hour) for item in day.items]
    sightseeing_count = sum(not item.poi.is_meal for item in day.items)
    return (
        MIN_DAY_ACTIVITIES <= sightseeing_count <= MAX_DAY_ACTIVITIES
        and None not in windows
        and len({item.start_hour for item in day.items}) == len(day.items)
    )


def _validate_items(
    draft: tuple[DraftItem, ...],
    constraints: tuple[Constraint, ...],
    organizer_id: str,
    *,
    allow_reuse_across_days: bool = False,
) -> bool:
    total = _draft_total(draft)
    walk_by_date: dict[date, float | None] = {}
    seen_by_day: dict[int, set[float]] = {}
    used_titles_by_day: dict[int, set[str]] = {}
    used_titles: set[str] = set()

    for item in draft:
        day_titles = used_titles_by_day.setdefault(item.day_index, set())
        if item.poi.title in day_titles:
            return False
        day_titles.add(item.poi.title)
        if not allow_reuse_across_days and not _is_flexible_meal_break(item.poi):
            if item.poi.title in used_titles:
                return False
            used_titles.add(item.poi.title)
        slots = seen_by_day.setdefault(item.day_index, set())
        if item.start_hour in slots:
            return False
        slots.add(item.start_hour)
        walk_by_date[item.day_date] = _add_known(
            walk_by_date.get(item.day_date, 0.0), _walk_km(item.poi)
        )

    for item in draft:
        window = planner.time_window(item.start_hour)
        if window is None or not planner.category_allows_window(item.poi.tags, window):
            return False
        if not _candidate_valid_after(
            item,
            constraints=constraints,
            organizer_id=organizer_id,
            trip_total_after=total,
            day_walk_after=walk_by_date[item.day_date],
        ):
            return False
    return True


def _draft_total(draft: tuple[DraftItem, ...]) -> float | None:
    prices = [item.poi.price for item in draft]
    if any(price is None for price in prices):
        return None
    return sum(price for price in prices if price is not None)


def _budget_left(constraints: tuple[Constraint, ...], current_total: float | None) -> float | None:
    if current_total is None:
        return None
    ceilings = [
        constraint.params.get("max_total_per_person")
        for constraint in constraints
        if constraint.kind is ConstraintKind.BUDGET_CEILING
    ]
    numeric = [float(ceiling) for ceiling in ceilings if ceiling is not None]
    if not numeric:
        return math.inf
    return max(0.0, min(numeric) - current_total)


def _aggregate_generated_by(days: tuple[DayDraft, ...]) -> str:
    sources = {day.generated_by for day in days}
    if sources == {"planner"}:
        return "planner"
    if sources == {"rules"}:
        return "rules"
    return "mixed"


def _aggregate_planner_note(
    days: tuple[DayDraft, ...]
) -> tuple[DayPlannerNote, ...] | None:
    if not any(day.generated_by == "planner" for day in days):
        return None
    return tuple(
        DayPlannerNote(
            day_index=day.day_index,
            source=day.generated_by,
            note=day.planner_note or RULES_DAY_NOTE,
            used_ai=day.used_ai,
        )
        for day in days
    )


def _write_items(
    db: Session,
    plan: Plan,
    draft: tuple[DraftItem, ...],
) -> tuple[PlanItem, ...]:
    items: list[PlanItem] = []
    for item in draft:
        poi = item.poi
        row = PlanItem(
            plan_id=plan.id,
            day_index=item.day_index,
            day_date=item.day_date,
            start_hour=item.start_hour,
            duration_min=poi.duration_min,
            title=poi.title,
            local_title=poi.local_title,
            place=poi.place,
            price_per_person=poi.price,
            tags=list(poi.tags),
            dietary_tags=list(poi.diet),
            is_meal=poi.is_meal,
            lat=poi.lat,
            lng=poi.lng,
            photo_url=poi.photo_url,
            source=poi.source,
            settledness="loose",
        )
        db.add(row)
        db.flush()
        origin = "ai_generate" if item.generated_by == "planner" else "rule_generate"
        db.add(
            PlanChange(
                plan_id=plan.id,
                plan_item_id=row.id,
                origin=origin,
                patch=_item_patch(row),
                reason=(
                    "Generated by Planner agent."
                    if item.generated_by == "planner"
                    else "Generated by deterministic rules fallback."
                ),
            )
        )
        items.append(row)
    db.flush()
    return tuple(items)


def _known_item_total(items: tuple[PlanItem, ...]) -> float | None:
    prices = [item.price_per_person for item in items]
    if any(price is None for price in prices):
        return None
    return sum(price for price in prices if price is not None)


def _add_known(left: float | None, right: float | None) -> float | None:
    if left is None or right is None:
        return None
    return left + right


def _item_patch(item: PlanItem) -> dict:
    return {
        "day_index": item.day_index,
        "day_date": item.day_date.isoformat(),
        "start_hour": item.start_hour,
        "duration_min": item.duration_min,
        "title": item.title,
        "local_title": item.local_title,
        "place": item.place,
        "price_per_person": item.price_per_person,
        "tags": item.tags or [],
        "dietary_tags": item.dietary_tags or [],
        "is_meal": item.is_meal,
        "lat": item.lat,
        "lng": item.lng,
        "photo_url": item.photo_url,
        "source": item.source,
    }


def _days_out(dates: tuple[date, ...], items: Iterable[PlanItem]) -> list[dict]:
    by_day: dict[int, list[dict]] = {}
    for item in items:
        by_day.setdefault(item.day_index, []).append(
            {
                "id": item.id,
                "day_index": item.day_index,
                "day_date": item.day_date.isoformat(),
                "start_hour": item.start_hour,
                "title": item.title,
                "local_title": item.local_title,
                "place": item.place,
                "price_per_person": item.price_per_person,
                "source": item.source,
                "lat": item.lat,
                "lng": item.lng,
                "photo_url": item.photo_url,
                "tags": item.tags or [],
            }
        )

    return [
        {
            "day_index": index,
            "day_date": day.isoformat(),
            "items": sorted(by_day.get(index, []), key=lambda row: row["start_hour"]),
        }
        for index, day in enumerate(dates, start=1)
    ]

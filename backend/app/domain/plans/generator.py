"""Plan generation pipeline plus deterministic rules fallback."""

from __future__ import annotations

import math
from dataclasses import dataclass
from datetime import date, timedelta
from typing import Iterable

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from data.poi_chicago import POIS

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

SLOTS = (10.0, 14.0, 19.0)
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
    lat: float
    lng: float
    price: float
    duration_min: int
    opens: float
    closes: float
    walk: str
    access: tuple[str, ...]
    diet: tuple[str, ...]
    tags: tuple[str, ...]
    photo_url: str | None = None

    @property
    def is_meal(self) -> bool:
        return "food" in self.tags and self.price > 0


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
    blocked_reason = _blocked_reason(dates, constraints)
    allow_reuse_across_days = not any(
        constraint.kind is ConstraintKind.BUDGET_CEILING for constraint in constraints
    )

    draft: list[DraftItem] = []
    used: set[str] = set()
    accepted_days: list[DayDraft] = []

    for day_index, day_date in enumerate(dates, start=1):
        # 整趟旅行还剩几个时段 —— 规则兜底要靠它给后面的日子留预算，
        # 不然前两天挑贵的，第三天就没钱了，整份行程被判成 blocked。
        slots_left = (len(dates) - day_index + 1) * len(SLOTS)
        day = _build_day(
            slots_left=slots_left,
            day_index=day_index,
            day_date=day_date,
            constraints=constraints,
            organizer_id=organizer.id,
            already_selected=tuple(draft),
            already_used=set() if allow_reuse_across_days else used,
            interests=interests,
            allow_reuse_across_days=allow_reuse_across_days,
        )
        if day is None:
            plan.status = "blocked"
            plan.blocked_reason = blocked_reason
            plan.estimated_total_per_person = 0
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
        used.update(item.poi.title for item in day.items)

    if not _is_complete(dates, tuple(draft)):
        plan.status = "blocked"
        plan.blocked_reason = blocked_reason
        plan.estimated_total_per_person = 0
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
    plan.estimated_total_per_person = sum(item.price_per_person for item in items)
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
    allow_reuse_across_days: bool,
) -> DayDraft | None:
    for attempt in range(2):
        candidates = _day_candidates(
            day_index=day_index,
            day_date=day_date,
            constraints=constraints,
            organizer_id=organizer_id,
            already_selected=already_selected,
            already_used=already_used,
            attempt=attempt,
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
            already_used=already_used,
            interests=interests,
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
                already_used=already_used,
                attempt=attempt,
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
) -> tuple[Poi, ...]:
    current_total = _draft_total(already_selected)
    candidates: list[Poi] = []
    for poi in _candidate_order(attempt):
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
) -> DayDraft | None:
    candidate_by_name = {poi.title: poi for poi in candidates}
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
            for poi in candidates
        ),
        already_used=tuple(sorted(already_used)),
        budget_left=_budget_left(constraints, _draft_total(already_selected)),
        interests=interests,
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
        if pick.start_hour not in SLOTS:
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
            trip_total_after=current_total + poi.price,
            day_walk_after=day_walk + _walk_km(poi),
        ):
            continue
        items.append(item)
        day_used.add(poi.title)
        current_total += poi.price
        day_walk += _walk_km(poi)

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
) -> DayDraft | None:
    items: list[DraftItem] = []
    day_used: set[str] = set()
    current_total = _draft_total(already_selected)
    day_walk = 0.0

    for slot in SLOTS:
        poi = _pick_rule_candidate(
            candidates,
            slots_left=slots_left - len(items),
            slot=slot,
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
            return None
        items.append(
            DraftItem(
                day_index=day_index,
                day_date=day_date,
                start_hour=slot,
                poi=poi,
                generated_by="rules",
            )
        )
        day_used.add(poi.title)
        current_total += poi.price
        day_walk += _walk_km(poi)

    return DayDraft(
        day_index=day_index,
        items=tuple(items),
        generated_by="rules",
        used_ai=False,
        planner_note=RULES_DAY_NOTE,
    )


def _budget_headroom(
    constraints: tuple[Constraint, ...], spent: float
) -> float | None:
    """还能花多少 —— 按最紧的那条预算上限算，不是平均。

    返回 None 表示没有人设过预算上限。
    """
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
    slot: float,
    day_index: int,
    day_date: date,
    constraints: tuple[Constraint, ...],
    organizer_id: str,
    trip_total_before: float,
    day_walk_before: float,
    already_used: set[str],
    attempt: int,
) -> Poi | None:
    # 给后面的时段留预算。不留的话贪心会前重后轻：
    # 头两天挑贵的，第三天没钱了，整份行程被判成 blocked。
    # 在"留得住"的范围内挑最贵的 —— 把预算用足，而不是排一堆免费的。
    headroom = _budget_headroom(constraints, trip_total_before)
    if headroom is not None and slots_left > 0:
        per_slot = headroom / slots_left
        affordable = [poi for poi in candidates if poi.price <= per_slot]
        pool = sorted(affordable, key=lambda poi: -poi.price) if affordable \
            else sorted(candidates, key=lambda poi: poi.price)
    else:
        pool = list(candidates)
    ordered = tuple(pool[attempt:] + pool[:attempt])
    for poi in ordered:
        if poi.title in already_used:
            continue
        if slot == 19.0 and not _evening_ok(poi):
            continue
        if not _candidate_valid_after(
            DraftItem(
                day_index=day_index,
                day_date=day_date,
                start_hour=slot,
                poi=poi,
                generated_by="rules",
            ),
            constraints=constraints,
            organizer_id=organizer_id,
            trip_total_after=trip_total_before + poi.price,
            day_walk_after=day_walk_before + _walk_km(poi),
        ):
            continue
        return poi
    return None


def _candidate_order(attempt: int) -> tuple[Poi, ...]:
    pois = tuple(_as_poi(raw) for raw in POIS)
    if not pois:
        return ()
    offset = attempt % len(pois)
    return pois[offset:] + pois[:offset]


def _as_poi(raw: tuple) -> Poi:
    return Poi(
        title=raw[0],
        place=raw[1],
        lat=raw[2],
        lng=raw[3],
        price=float(raw[4]),
        duration_min=int(raw[5]),
        opens=float(raw[6]),
        closes=float(raw[7]),
        walk=raw[8],
        access=tuple(raw[9] or ()),
        diet=tuple(raw[10] or ()),
        tags=tuple(raw[11] or ()),
        photo_url=raw[12] if len(raw) > 12 else None,
    )


def _legal_slots(
    poi: Poi,
    *,
    day_index: int,
    day_date: date,
    constraints: tuple[Constraint, ...],
    organizer_id: str,
    trip_total_before: float,
    day_walk_before: float,
) -> tuple[float, ...]:
    return tuple(
        slot
        for slot in SLOTS
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
            trip_total_after=trip_total_before + poi.price,
            day_walk_after=day_walk_before + _walk_km(poi),
        )
    )


def _candidate_valid_after(
    item: DraftItem,
    *,
    constraints: tuple[Constraint, ...],
    organizer_id: str,
    trip_total_after: float,
    day_walk_after: float,
) -> bool:
    if item.poi.title == "":
        return False
    if item.start_hour == 19.0 and not _evening_ok(item.poi):
        return False
    if not (item.poi.opens <= item.start_hour <= item.poi.closes):
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


def _evening_ok(poi: Poi) -> bool:
    return poi.is_meal or "food" in poi.tags or "nightlife" in poi.tags


def _walk_km(poi: Poi) -> float:
    return {"low": 0.5, "medium": 1.5, "high": 3.0}.get(poi.walk, 0.0)


def _change_for(
    *,
    day_index: int,
    day_date: date,
    slot: float,
    poi: Poi,
    trip_total_after: float,
    day_walk_after: float,
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
    return len(draft) == len(dates) * len(SLOTS)


def _day_complete(day: DayDraft) -> bool:
    return len(day.items) == len(SLOTS) and {item.start_hour for item in day.items} == set(SLOTS)


def _validate_items(
    draft: tuple[DraftItem, ...],
    constraints: tuple[Constraint, ...],
    organizer_id: str,
    *,
    allow_reuse_across_days: bool = False,
) -> bool:
    total = _draft_total(draft)
    walk_by_date: dict[date, float] = {}
    seen_by_day: dict[int, set[float]] = {}
    used_titles_by_day: dict[int, set[str]] = {}
    used_titles: set[str] = set()

    for item in draft:
        if allow_reuse_across_days:
            day_titles = used_titles_by_day.setdefault(item.day_index, set())
            if item.poi.title in day_titles:
                return False
            day_titles.add(item.poi.title)
        else:
            if item.poi.title in used_titles:
                return False
            used_titles.add(item.poi.title)
        slots = seen_by_day.setdefault(item.day_index, set())
        if item.start_hour in slots:
            return False
        slots.add(item.start_hour)
        walk_by_date[item.day_date] = walk_by_date.get(item.day_date, 0.0) + _walk_km(item.poi)

    for item in draft:
        if item.start_hour not in SLOTS:
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


def _draft_total(draft: tuple[DraftItem, ...]) -> float:
    return sum(item.poi.price for item in draft)


def _budget_left(constraints: tuple[Constraint, ...], current_total: float) -> float:
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
            place=poi.place,
            price_per_person=poi.price,
            tags=list(poi.tags),
            dietary_tags=list(poi.diet),
            is_meal=poi.is_meal,
            lat=poi.lat,
            lng=poi.lng,
            photo_url=poi.photo_url,
            source="ai_estimate",
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


def _item_patch(item: PlanItem) -> dict:
    return {
        "day_index": item.day_index,
        "day_date": item.day_date.isoformat(),
        "start_hour": item.start_hour,
        "duration_min": item.duration_min,
        "title": item.title,
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
                "place": item.place,
                "price_per_person": item.price_per_person,
                "source": item.source,
                "lat": item.lat,
                "lng": item.lng,
                "photo_url": item.photo_url,
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

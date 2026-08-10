from __future__ import annotations

from dataclasses import dataclass
from datetime import date, timedelta

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from ...agents import planner as planner_agent
from ...db.models import MemberConstraint, Plan, PlanChange, PlanItem, Preference, Trip, TripMembership


class PlannerAccessDenied(Exception):
    pass


class PlannerTripNotFound(Exception):
    pass


class PlannerAlreadyHasItems(Exception):
    pass


class PlannerTripDatesInvalid(Exception):
    pass


class PlannerDraftRejected(Exception):
    pass


@dataclass(frozen=True)
class GeneratedPlan:
    plan: Plan
    items: tuple[PlanItem, ...]
    note: str
    used_ai: bool


@dataclass(frozen=True)
class _PlanningLimits:
    earliest_hour: float = 9.0
    latest_hour: float = 22.0
    maximum_budget: float | None = None
    maximum_walk_km: float | None = None
    dietary_tags: frozenset[str] = frozenset()
    avoid_tags: frozenset[str] = frozenset()


def generate_draft_plan(db: Session, *, trip_id: str, membership: TripMembership) -> GeneratedPlan:
    if membership.trip_id != trip_id or membership.role != "organizer":
        raise PlannerAccessDenied("Only the trip organizer can generate the first draft")

    trip = db.get(Trip, trip_id)
    if trip is None:
        raise PlannerTripNotFound("Trip not found")

    plan = db.scalar(select(Plan).where(Plan.trip_id == trip_id))
    if plan is None:
        plan = Plan(trip_id=trip_id, currency=trip.currency)
        db.add(plan)
        db.flush()

    existing_count = db.scalar(
        select(func.count()).select_from(PlanItem).where(PlanItem.plan_id == plan.id)
    )
    if existing_count:
        raise PlannerAlreadyHasItems("This trip already has an itinerary")

    trip_dates = _trip_dates(trip)
    required_constraints = _required_constraints(db, trip_id)
    limits = _planning_limits(required_constraints)
    _validate_required_dates(trip_dates, required_constraints)
    candidate_titles = _eligible_poi_titles(limits)
    if len(candidate_titles) < len(trip_dates):
        raise PlannerDraftRejected(
            "Not enough eligible catalog POIs to cover every trip date without repeats"
        )
    draft = planner_agent.draft_itinerary(
        planner_agent.PlannerInput(
            destination=trip.destination,
            trip_dates=trip_dates,
            interests=_public_interests(db, trip_id),
            public_constraints=_safe_constraints(db, trip_id),
            candidate_titles=candidate_titles,
        )
    )

    scheduled_days = _validate_and_schedule(draft, trip_dates, limits)

    items: list[PlanItem] = []
    for day, scheduled_stops in scheduled_days:
        for poi, start_hour in scheduled_stops:
            item = _item_from_poi(
                plan.id, day.day_index, day.day_date, start_hour, poi
            )
            db.add(item)
            db.flush()
            db.add(
                PlanChange(
                    plan_id=plan.id,
                    plan_item_id=item.id,
                    origin="ai_generate",
                    actor_membership_id=membership.id,
                    patch={
                        "title": item.title,
                        "place": item.place,
                        "day_date": item.day_date.isoformat(),
                        "start_hour": item.start_hour,
                    },
                    reason=draft.note,
                )
            )
            items.append(item)

    plan.estimated_total_per_person = sum(item.price_per_person for item in items)
    plan.status = "active" if items else "blocked"
    db.flush()
    return GeneratedPlan(plan=plan, items=tuple(items), note=draft.note, used_ai=draft.used_ai)


def _trip_dates(trip: Trip) -> tuple[date, ...]:
    start = trip.preferred_start_date or trip.preferred_end_date or date.today()
    end = trip.preferred_end_date or start
    if end < start:
        raise PlannerTripDatesInvalid("Trip end date cannot be before its start date")
    return tuple(start + timedelta(days=offset) for offset in range((end - start).days + 1))


def _required_constraints(db: Session, trip_id: str) -> tuple[MemberConstraint, ...]:
    return tuple(
        db.scalars(
            select(MemberConstraint)
            .join(TripMembership, TripMembership.id == MemberConstraint.trip_membership_id)
            .where(
                TripMembership.trip_id == trip_id,
                MemberConstraint.importance == "required",
            )
        ).all()
    )


def _planning_limits(rows: tuple[MemberConstraint, ...]) -> _PlanningLimits:
    earliest = 9.0
    latest = 22.0
    budgets: list[float] = []
    walk_limits: list[float] = []
    dietary: set[str] = set()
    avoid: set[str] = set()
    for row in rows:
        if row.kind == "time_window":
            if row.params.get("earliest_hour") is not None:
                earliest = max(earliest, float(row.params["earliest_hour"]))
            if row.params.get("latest_hour") is not None:
                latest = min(latest, float(row.params["latest_hour"]))
        elif row.kind == "budget_ceiling" and row.params.get("max_total_per_person") is not None:
            budgets.append(float(row.params["max_total_per_person"]))
        elif row.kind == "walk_limit" and row.params.get("max_km_per_day") is not None:
            walk_limits.append(float(row.params["max_km_per_day"]))
        elif row.kind == "dietary":
            dietary.update(str(tag).lower() for tag in row.params.get("required_tags", ()))
        elif row.kind == "avoid_tag":
            avoid.update(str(tag).lower() for tag in row.params.get("tags", ()))
    if latest <= earliest:
        raise PlannerDraftRejected("Required time windows leave no usable planning time")
    return _PlanningLimits(
        earliest_hour=earliest,
        latest_hour=latest,
        maximum_budget=min(budgets) if budgets else None,
        maximum_walk_km=min(walk_limits) if walk_limits else None,
        dietary_tags=frozenset(dietary),
        avoid_tags=frozenset(avoid),
    )


def _validate_required_dates(
    trip_dates: tuple[date, ...], rows: tuple[MemberConstraint, ...]
) -> None:
    for row in rows:
        if row.kind != "date_range":
            continue
        start = _coerce_date(row.params.get("start"))
        end = _coerce_date(row.params.get("end"))
        if start and any(day < start for day in trip_dates):
            raise PlannerDraftRejected("Trip dates begin before a required availability window")
        if end and any(day > end for day in trip_dates):
            raise PlannerDraftRejected("Trip dates end after a required availability window")


def _coerce_date(value) -> date | None:
    if value is None or isinstance(value, date):
        return value
    try:
        return date.fromisoformat(str(value))
    except ValueError as exc:
        raise PlannerDraftRejected(f"Invalid required date constraint: {value}") from exc


def _eligible_poi_titles(limits: _PlanningLimits) -> tuple[str, ...]:
    eligible: list[str] = []
    for poi in _pois():
        title, _area, _lat, _lng, price, minutes, opens, closes, walk, _access, diet, tags = poi
        tag_set = {str(tag).lower() for tag in tags}
        diet_set = {str(tag).lower() for tag in diet}
        if limits.avoid_tags.intersection(tag_set):
            continue
        if "food" in tag_set and not limits.dietary_tags.issubset(diet_set):
            continue
        if limits.maximum_budget is not None and float(price) > limits.maximum_budget:
            continue
        if limits.maximum_walk_km is not None and _walk_km(walk) > limits.maximum_walk_km:
            continue
        start = max(limits.earliest_hour, float(opens))
        if start + float(minutes) / 60 > min(limits.latest_hour, float(closes)):
            continue
        eligible.append(title)
    return tuple(eligible)


def _validate_and_schedule(
    draft: planner_agent.PlannerDraft,
    trip_dates: tuple[date, ...],
    limits: _PlanningLimits,
) -> tuple[tuple[planner_agent.PlannedDay, tuple[tuple[tuple, float], ...]], ...]:
    if len(draft.days) != len(trip_dates):
        raise PlannerDraftRejected("Planner draft does not cover every trip date")
    expected = tuple(enumerate(trip_dates, start=1))
    actual = tuple((day.day_index, day.day_date) for day in draft.days)
    if actual != expected:
        raise PlannerDraftRejected("Planner dates are missing, duplicated, or out of order")

    seen_titles: set[str] = set()
    scheduled_days = []
    total_price = 0.0
    for day in draft.days:
        pois = []
        for stop in day.stops:
            if stop.title in seen_titles:
                raise PlannerDraftRejected(f"Planner repeated POI: {stop.title}")
            poi = _poi_by_title(stop.title)
            if poi is None:
                raise PlannerDraftRejected(f"Planner selected unknown POI: {stop.title}")
            seen_titles.add(stop.title)
            pois.append(poi)
        scheduled = _schedule_pois(tuple(pois), limits)
        if not scheduled:
            raise PlannerDraftRejected(f"Day {day.day_index} has no schedulable activities")
        _assert_no_overlap(scheduled)
        total_price += sum(float(poi[4]) for poi, _start in scheduled)
        scheduled_days.append((day, scheduled))

    if limits.maximum_budget is not None and total_price > limits.maximum_budget:
        raise PlannerDraftRejected(
            f"Planner total {total_price:.2f} exceeds required budget {limits.maximum_budget:.2f}"
        )
    return tuple(scheduled_days)


def _schedule_pois(
    pois: tuple[tuple, ...], limits: _PlanningLimits
) -> tuple[tuple[tuple, float], ...]:
    remaining = list(pois)
    scheduled: list[tuple[tuple, float]] = []
    current_hour = limits.earliest_hour
    walked_km = 0.0
    while remaining:
        feasible = []
        for poi in remaining:
            start = max(current_hour, float(poi[6]))
            end = start + float(poi[5]) / 60
            next_walk = walked_km + _walk_km(poi[8])
            if end > min(limits.latest_hour, float(poi[7])):
                continue
            if limits.maximum_walk_km is not None and next_walk > limits.maximum_walk_km:
                continue
            feasible.append((end, start, poi))
        if not feasible:
            break
        _end, start, poi = min(feasible, key=lambda option: (option[0], option[1]))
        scheduled.append((poi, start))
        walked_km += _walk_km(poi[8])
        current_hour = start + float(poi[5]) / 60 + 0.5
        remaining.remove(poi)
    return tuple(scheduled)


def _assert_no_overlap(scheduled: tuple[tuple[tuple, float], ...]) -> None:
    previous_end = None
    for poi, start in scheduled:
        if previous_end is not None and start < previous_end:
            raise PlannerDraftRejected("Planner activities overlap")
        previous_end = start + float(poi[5]) / 60


def _walk_km(level: str) -> float:
    return {"low": 1.0, "medium": 3.0, "high": 6.0}.get(str(level).lower(), 3.0)


def _pois() -> tuple[tuple, ...]:
    from data.poi_chicago import POIS

    return tuple(POIS)


def _public_interests(db: Session, trip_id: str) -> tuple[str, ...]:
    rows = db.scalars(
        select(Preference)
        .join(TripMembership, TripMembership.id == Preference.trip_membership_id)
        .where(TripMembership.trip_id == trip_id)
    ).all()
    seen: list[str] = []
    for row in rows:
        for interest in row.top_interests or []:
            normalized = str(interest).strip().lower()
            if normalized and normalized not in seen:
                seen.append(normalized)
    return tuple(seen[:6])


def _safe_constraints(db: Session, trip_id: str) -> tuple[str, ...]:
    rows = db.scalars(
        select(MemberConstraint)
        .join(TripMembership, TripMembership.id == MemberConstraint.trip_membership_id)
        .where(TripMembership.trip_id == trip_id, MemberConstraint.importance == "required")
    ).all()
    safe: list[str] = []
    for row in rows:
        if row.kind == "time_window":
            earliest = row.params.get("earliest_hour")
            latest = row.params.get("latest_hour")
            if earliest is not None:
                safe.append(f"No activity before {earliest}:00")
            if latest is not None:
                safe.append(f"No activity ending after {latest}:00")
        elif row.kind == "budget_ceiling":
            ceiling = row.params.get("max_total_per_person")
            if ceiling is not None:
                safe.append(f"Keep total per person under {ceiling}")
        elif row.kind == "walk_limit":
            limit = row.params.get("max_km_per_day")
            if limit is not None:
                safe.append(f"Keep walking under {limit} km per day")
        elif row.kind == "dietary":
            tags = ", ".join(row.params.get("required_tags", ()))
            if tags:
                safe.append(f"Meals must support: {tags}")
        elif row.kind == "avoid_tag":
            tags = ", ".join(row.params.get("tags", ()))
            if tags:
                safe.append(f"Avoid: {tags}")
        elif row.kind == "date_range":
            safe.append("Respect required availability windows")
    return tuple(safe[:8])


def _poi_by_title(title: str):
    from data.poi_chicago import POIS

    normalized = title.strip().lower()
    for poi in POIS:
        if poi[0].lower() == normalized:
            return poi
    return None


def _item_from_poi(plan_id: str, day_index: int, day_date: date, start_hour: float, poi) -> PlanItem:
    (
        title,
        area,
        lat,
        lng,
        price,
        minutes,
        _opens,
        _closes,
        _walk,
        _access,
        diet,
        tags,
    ) = poi
    return PlanItem(
        plan_id=plan_id,
        day_index=day_index,
        day_date=day_date,
        start_hour=start_hour,
        duration_min=minutes,
        title=title,
        place=area,
        price_per_person=price,
        tags=list(tags),
        dietary_tags=list(diet),
        is_meal="food" in tags,
        lat=lat,
        lng=lng,
        source="ai_estimate",
        settledness="loose",
    )

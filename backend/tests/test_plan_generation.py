from __future__ import annotations

from datetime import date, timedelta
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session, sessionmaker

from app.agents import base, planner
from app.api import main as api
from app.db.models import MemberConstraint, Plan, PlanChange, PlanItem, Trip, TripMembership, User
from app.domain.constraints.engine import violates
from app.domain.constraints.types import (
    Constraint,
    ConstraintKind,
    Importance,
    ItemView,
    ProposedChange,
    Settledness,
)
from app.domain.plans import generator
from app.domain.preferences import service as pref


@pytest.fixture
def api_session(test_engine):
    connection = test_engine.connect()
    transaction = connection.begin()
    session = sessionmaker(
        bind=connection,
        future=True,
        join_transaction_mode="create_savepoint",
    )()
    try:
        yield session
    finally:
        session.close()
        if transaction.is_active:
            transaction.rollback()
        connection.close()


@pytest.fixture
def client(api_session: Session):
    api.app.dependency_overrides[api.get_session] = lambda: api_session
    with TestClient(api.app) as test_client:
        yield test_client
    api.app.dependency_overrides.clear()


def _make_trip(
    db: Session,
    *,
    days: int = 2,
    organizer_preferences: bool = True,
    budget_ceiling: float = 150.0,
) -> dict:
    stamp = uuid4().hex
    organizer_user = User(name="Mia", email=f"mia-{stamp}@example.com")
    participant_user = User(name="Sam", email=f"sam-{stamp}@example.com")
    db.add_all([organizer_user, participant_user])
    db.flush()

    start = date.today() + timedelta(days=30)
    trip = Trip(
        name="Chicago fallback",
        destination="Chicago",
        preferred_start_date=start,
        preferred_end_date=start + timedelta(days=days - 1),
        currency="USD",
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

    plan = Plan(trip_id=trip.id)
    db.add(plan)
    db.flush()

    if organizer_preferences:
        pref.save_mine(
            db,
            organizer,
            pref.PreferenceData(
                preferred_start_date=trip.preferred_start_date,
                preferred_end_date=trip.preferred_end_date,
                available_start_date=trip.preferred_start_date,
                available_end_date=trip.preferred_end_date,
                ideal_budget=min(budget_ceiling, 100.0),
                maximum_budget=budget_ceiling,
                top_interests=("culture", "food"),
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
                    "end": trip.preferred_end_date.isoformat(),
                },
            ),
            MemberConstraint(
                trip_membership_id=participant.id,
                kind="budget_ceiling",
                importance="required",
                params={"max_total_per_person": budget_ceiling},
            ),
        ]
    )
    db.flush()
    return {
        "trip": trip,
        "plan": plan,
        "organizer": organizer,
        "participant": participant,
    }


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


def _item_view(item: PlanItem) -> ItemView:
    return ItemView(
        id=item.id,
        day_date=item.day_date,
        start_hour=item.start_hour,
        duration_min=item.duration_min,
        price_per_person=item.price_per_person,
        tags=frozenset(item.tags or ()),
        dietary_tags=frozenset(item.dietary_tags or ()),
        is_meal=item.is_meal,
        settledness=Settledness(item.settledness),
    )


def _generated_items(db: Session, plan_id: str) -> list[PlanItem]:
    return db.scalars(
        select(PlanItem)
        .where(PlanItem.plan_id == plan_id)
        .order_by(PlanItem.day_index, PlanItem.start_hour)
    ).all()


def test_organizer_must_submit_preferences_before_generation(
    client: TestClient, api_session: Session
):
    setup = _make_trip(api_session, organizer_preferences=False)

    response = client.post(
        f"/api/trips/{setup['trip'].id}/plans/generate",
        headers={"X-Membership-Id": setup["organizer"].id},
    )

    assert response.status_code == 422
    assert response.json()["detail"]["code"] == "organizer_preference_missing"
    assert api_session.scalar(select(PlanItem)) is None


def test_existing_items_block_regeneration_without_changing_them(
    client: TestClient, api_session: Session
):
    setup = _make_trip(api_session)
    original = PlanItem(
        plan_id=setup["plan"].id,
        day_index=1,
        day_date=setup["trip"].preferred_start_date,
        start_hour=10.0,
        title="Original",
        place="Somewhere",
        price_per_person=12.0,
        source="verified",
    )
    api_session.add(original)
    api_session.flush()
    before = (
        original.title,
        original.place,
        original.start_hour,
        original.price_per_person,
        original.source,
    )

    response = client.post(
        f"/api/trips/{setup['trip'].id}/plans/generate",
        headers={"X-Membership-Id": setup["organizer"].id},
    )

    assert response.status_code == 409
    after = (
        original.title,
        original.place,
        original.start_hour,
        original.price_per_person,
        original.source,
    )
    assert after == before
    assert api_session.query(PlanItem).count() == 1


def test_generated_items_pass_every_required_constraint(db: Session):
    setup = _make_trip(db)

    result = generator.generate_plan(db, setup["trip"].id, setup["organizer"])

    assert result.status == "active"
    items = _generated_items(db, setup["plan"].id)
    total = sum(item.price_per_person for item in items)
    constraints = [
        _domain_constraint(row)
        for row in db.scalars(select(MemberConstraint)).all()
        if row.importance == "required"
    ]
    for item in items:
        view = _item_view(item)
        change = ProposedChange(
            before=view,
            after=view,
            day_walk_km_after=0.0,
            trip_total_after=total,
            requested_by_membership_id=setup["organizer"].id,
        )
        for constraint in constraints:
            assert not violates(constraint, change)


def test_generated_total_stays_under_the_lowest_budget_ceiling(db: Session):
    setup = _make_trip(db, budget_ceiling=150.0)

    result = generator.generate_plan(db, setup["trip"].id, setup["organizer"])

    assert result.status == "active"
    assert sum(item.price_per_person for item in result.items) <= 150.0
    assert result.plan.estimated_total_per_person <= 150.0


def test_generated_items_have_coordinates(db: Session):
    setup = _make_trip(db)

    result = generator.generate_plan(db, setup["trip"].id, setup["organizer"])

    assert result.status == "active"
    assert all(item.lat is not None and item.lng is not None for item in result.items)


def test_planner_exception_falls_back_to_rules(
    client: TestClient, api_session: Session, monkeypatch
):
    setup = _make_trip(api_session)

    def broken(payload: planner.PlanDayInput):
        raise base.AgentUnavailable("planner offline")

    monkeypatch.setattr(planner, "plan_day", broken)

    response = client.post(
        f"/api/trips/{setup['trip'].id}/plans/generate",
        headers={"X-Membership-Id": setup["organizer"].id},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "active"
    assert body["generated_by"] == "rules"
    assert api_session.query(PlanItem).count() == 6
    origins = set(api_session.scalars(select(PlanChange.origin)).all())
    assert origins == {"rule_generate"}


def test_planner_names_outside_candidates_are_dropped(db: Session, monkeypatch):
    setup = _make_trip(db, days=1)

    def fake_planner(payload: planner.PlanDayInput):
        morning = next(
            option for option in payload.candidates if option.opens <= 10.0 <= option.closes
        )
        afternoon = next(
            option
            for option in payload.candidates
            if option.name != morning.name and option.opens <= 14.0 <= option.closes
        )
        evening = next(
            option
            for option in payload.candidates
            if option.name not in {morning.name, afternoon.name}
            and option.opens <= 19.0 <= option.closes
            and ("food" in option.tags or "nightlife" in option.tags)
        )
        return (
            planner.Pick(poi_name="Imaginary Rooftop", start_hour=10.0),
            planner.Pick(poi_name=morning.name, start_hour=10.0),
            planner.Pick(poi_name=afternoon.name, start_hour=14.0),
            planner.Pick(poi_name=evening.name, start_hour=19.0),
        )

    monkeypatch.setattr(planner, "plan_day", fake_planner)

    result = generator.generate_plan(db, setup["trip"].id, setup["organizer"])

    assert result.status == "active"
    assert result.generated_by == "planner"
    titles = [item.title for item in result.items]
    assert "Imaginary Rooftop" not in titles
    assert len(titles) == 3
    origins = set(db.scalars(select(PlanChange.origin)).all())
    assert origins == {"ai_generate"}


def test_unsolvable_budget_blocks_without_writing_items(db: Session):
    setup = _make_trip(db, days=4, budget_ceiling=1.0)

    result = generator.generate_plan(db, setup["trip"].id, setup["organizer"])

    assert result.status == "blocked"
    assert result.blocked_reason == (
        "The required budget limit is too low for the available places."
    )
    assert db.query(PlanItem).count() == 0


def test_blocked_reason_does_not_leak_identity(db: Session):
    setup = _make_trip(db, days=4, budget_ceiling=1.0)

    result = generator.generate_plan(db, setup["trip"].id, setup["organizer"])

    assert "Mia" not in result.blocked_reason
    assert "Sam" not in result.blocked_reason
    assert setup["organizer"].id not in result.blocked_reason
    assert setup["participant"].id not in result.blocked_reason


def test_non_organizer_cannot_generate_plan(client: TestClient, api_session: Session):
    setup = _make_trip(api_session)

    response = client.post(
        f"/api/trips/{setup['trip'].id}/plans/generate",
        headers={"X-Membership-Id": setup["participant"].id},
    )

    assert response.status_code == 403

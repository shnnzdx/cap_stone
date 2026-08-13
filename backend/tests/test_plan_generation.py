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


def _candidate_triplet(
    payload: planner.PlanDayInput,
) -> tuple[planner.PoiOption, planner.PoiOption, planner.PoiOption]:
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
    return morning, afternoon, evening


def _planner_result(
    payload: planner.PlanDayInput,
    *,
    used_ai: bool,
    note: str,
    leading_invalid_name: str | None = None,
) -> planner.PlanDayResult:
    morning, afternoon, evening = _candidate_triplet(payload)
    picks = [
        planner.Pick(poi_name=morning.name, start_hour=10.0),
        planner.Pick(poi_name=afternoon.name, start_hour=14.0),
        planner.Pick(poi_name=evening.name, start_hour=19.0),
    ]
    if leading_invalid_name is not None:
        picks.insert(0, planner.Pick(poi_name=leading_invalid_name, start_hour=10.0))
    return planner.PlanDayResult(
        picks=tuple(picks),
        used_ai=used_ai,
        planner_note=note,
    )


def test_organizer_must_submit_preferences_before_generation(
    client: TestClient, api_session: Session
):
    setup = _make_trip(api_session, organizer_preferences=False)

    response = client.post(
        f"/api/trips/{setup['trip'].id}/plans/generate",
        headers={"X-Membership-Id": setup["organizer"].id},
    )

    assert response.status_code == 422
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
    assert body["used_ai"] is False
    assert body["planner_note"] is None
    assert api_session.query(PlanItem).count() == 6
    origins = set(api_session.scalars(select(PlanChange.origin)).all())
    assert origins == {"rule_generate"}


def test_mocked_planner_path_still_uses_rules_generation_by_default(
    client: TestClient, api_session: Session
):
    setup = _make_trip(api_session)

    response = client.post(
        f"/api/trips/{setup['trip'].id}/plans/generate",
        headers={"X-Membership-Id": setup["organizer"].id},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "active"
    assert body["generated_by"] == "rules"
    assert body["used_ai"] is False
    assert body["planner_note"] is None
    assert body["blocked_reason"] is None
    assert api_session.query(PlanItem).count() == 6
    origins = set(api_session.scalars(select(PlanChange.origin)).all())
    assert origins == {"rule_generate"}


def test_invalid_second_ai_day_output_hands_control_back_to_rules_fallback(
    db: Session, monkeypatch
):
    setup = _make_trip(db, days=1)
    monkeypatch.setenv("MOCK_AI", "0")
    responses = iter(
        [
            {
                "note": "bad first pass",
                "picks": [{"poi_name": "Imaginary Rooftop", "start_hour": 10.0}],
            },
            {
                "note": "still bad",
                "picks": [{"poi_name": "Still Imaginary", "start_hour": 14.0}],
            },
        ]
    )

    def fake_call_model(**kwargs):
        return next(responses)

    monkeypatch.setattr(planner.base, "call_model", fake_call_model)

    result = generator.generate_plan(db, setup["trip"].id, setup["organizer"])

    assert result.status == "active"
    assert result.generated_by == "rules"
    assert result.used_ai is False
    assert result.planner_note is None
    assert len(result.items) == 3
    origins = set(db.scalars(select(PlanChange.origin)).all())
    assert origins == {"rule_generate"}


def test_canonical_generation_retries_one_invalid_ai_day_and_persists_repaired_planner_output(
    db: Session, monkeypatch
):
    setup = _make_trip(db, days=1)
    monkeypatch.setenv("MOCK_AI", "0")
    responses = iter(
        [
            {
                "note": "bad first pass",
                "picks": [{"poi_name": "Imaginary Rooftop", "start_hour": 10.0}],
            },
            {
                "note": "Repaired canonical planner day.",
                "picks": [
                    {"poi_name": "Millennium Park & Cloud Gate", "start_hour": 10.0},
                    {"poi_name": "Chicago Cultural Center", "start_hour": 14.0},
                    {"poi_name": "Girl & the Goat", "start_hour": 19.0},
                ],
            },
        ]
    )
    calls = []

    def fake_call_model(**kwargs):
        calls.append(kwargs)
        return next(responses)

    monkeypatch.setattr(planner.base, "call_model", fake_call_model)

    result = generator.generate_plan(db, setup["trip"].id, setup["organizer"])

    assert result.status == "active"
    assert result.generated_by == "planner"
    assert result.used_ai is True
    assert result.planner_note == (
        generator.DayPlannerNote(
            day_index=1,
            source="planner",
            note="Repaired canonical planner day.",
            used_ai=True,
        ),
    )
    assert len(calls) == 2
    assert "The previous day plan failed deterministic validation" in calls[1]["user"]
    assert [item.title for item in result.items] == [
        "Millennium Park & Cloud Gate",
        "Chicago Cultural Center",
        "Girl & the Goat",
    ]
    origins = set(db.scalars(select(PlanChange.origin)).all())
    assert origins == {"ai_generate"}


def test_valid_ai_day_output_is_accepted_and_persisted(db: Session, monkeypatch):
    setup = _make_trip(db, days=1)

    def fake_planner(payload: planner.PlanDayInput):
        return _planner_result(
            payload,
            used_ai=True,
            note="Focused cultural day with dinner.",
        )

    monkeypatch.setattr(planner, "plan_day", fake_planner)

    result = generator.generate_plan(db, setup["trip"].id, setup["organizer"])

    assert result.status == "active"
    assert result.generated_by == "planner"
    assert result.used_ai is True
    assert result.planner_note == (
        generator.DayPlannerNote(
            day_index=1,
            source="planner",
            note="Focused cultural day with dinner.",
            used_ai=True,
        ),
    )
    titles = [item.title for item in result.items]
    assert len(titles) == 3
    origins = set(db.scalars(select(PlanChange.origin)).all())
    assert origins == {"ai_generate"}


def test_generator_defensively_rejects_picks_outside_candidates(db: Session, monkeypatch):
    setup = _make_trip(db, days=1)

    def fake_planner(payload: planner.PlanDayInput):
        return _planner_result(
            payload,
            used_ai=True,
            note="Includes an invalid pick to prove generator filtering.",
            leading_invalid_name="Imaginary Rooftop",
        )

    monkeypatch.setattr(planner, "plan_day", fake_planner)

    result = generator.generate_plan(db, setup["trip"].id, setup["organizer"])

    assert result.status == "active"
    assert result.generated_by == "planner"
    assert result.used_ai is True
    titles = [item.title for item in result.items]
    assert "Imaginary Rooftop" not in titles
    assert len(titles) == 3
    origins = set(db.scalars(select(PlanChange.origin)).all())
    assert origins == {"ai_generate"}


def test_all_planner_api_response_reports_structured_notes_even_when_used_ai_is_false(
    client: TestClient, api_session: Session, monkeypatch
):
    setup = _make_trip(api_session, days=2)

    def fake_planner(payload: planner.PlanDayInput):
        return _planner_result(
            payload,
            used_ai=False,
            note=f"Planner accepted day {payload.day_index} without real AI.",
        )

    monkeypatch.setattr(planner, "plan_day", fake_planner)

    response = client.post(
        f"/api/trips/{setup['trip'].id}/plans/generate",
        headers={"X-Membership-Id": setup["organizer"].id},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "active"
    assert body["generated_by"] == "planner"
    assert body["used_ai"] is False
    assert body["planner_note"] == [
        {
            "day_index": 1,
            "source": "planner",
            "note": "Planner accepted day 1 without real AI.",
            "used_ai": False,
        },
        {
            "day_index": 2,
            "source": "planner",
            "note": "Planner accepted day 2 without real AI.",
            "used_ai": False,
        },
    ]


def test_mixed_generation_response_reports_structured_notes_and_used_ai_false(
    client: TestClient, api_session: Session, monkeypatch
):
    setup = _make_trip(api_session, days=2)

    def fake_planner(payload: planner.PlanDayInput):
        if payload.day_index == 1:
            return _planner_result(
                payload,
                used_ai=False,
                note="Planner accepted day 1 from a mocked response.",
            )
        raise base.AgentUnavailable("planner offline on day 2")

    monkeypatch.setattr(planner, "plan_day", fake_planner)

    response = client.post(
        f"/api/trips/{setup['trip'].id}/plans/generate",
        headers={"X-Membership-Id": setup["organizer"].id},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "active"
    assert body["generated_by"] == "mixed"
    assert body["used_ai"] is False
    assert body["planner_note"] == [
        {
            "day_index": 1,
            "source": "planner",
            "note": "Planner accepted day 1 from a mocked response.",
            "used_ai": False,
        },
        {
            "day_index": 2,
            "source": "rules",
            "note": generator.RULES_DAY_NOTE,
            "used_ai": False,
        },
    ]


def test_mixed_generation_response_reports_used_ai_when_real_ai_day_persists(
    client: TestClient, api_session: Session, monkeypatch
):
    setup = _make_trip(api_session, days=2)

    def fake_planner(payload: planner.PlanDayInput):
        if payload.day_index == 1:
            return _planner_result(
                payload,
                used_ai=True,
                note="Planner accepted day 1 from real AI.",
            )
        raise base.AgentUnavailable("planner offline on day 2")

    monkeypatch.setattr(planner, "plan_day", fake_planner)

    response = client.post(
        f"/api/trips/{setup['trip'].id}/plans/generate",
        headers={"X-Membership-Id": setup["organizer"].id},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "active"
    assert body["generated_by"] == "mixed"
    assert body["used_ai"] is True
    assert body["planner_note"] == [
        {
            "day_index": 1,
            "source": "planner",
            "note": "Planner accepted day 1 from real AI.",
            "used_ai": True,
        },
        {
            "day_index": 2,
            "source": "rules",
            "note": generator.RULES_DAY_NOTE,
            "used_ai": False,
        },
    ]


def test_unsolvable_budget_blocks_without_writing_items(db: Session):
    setup = _make_trip(db, days=4, budget_ceiling=1.0)

    result = generator.generate_plan(db, setup["trip"].id, setup["organizer"])

    assert result.status == "blocked"
    assert result.generated_by == "rules"
    assert result.used_ai is False
    assert result.planner_note is None
    assert result.blocked_reason
    assert db.query(PlanItem).count() == 0


def test_blocked_api_response_currently_reports_rules_and_writes_no_items(
    client: TestClient, api_session: Session
):
    setup = _make_trip(api_session, days=4, budget_ceiling=1.0)

    response = client.post(
        f"/api/trips/{setup['trip'].id}/plans/generate",
        headers={"X-Membership-Id": setup["organizer"].id},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["status"] == "blocked"
    assert body["generated_by"] == "rules"
    assert body["used_ai"] is False
    assert body["planner_note"] is None
    assert body["blocked_reason"]
    assert body["days"] == [
        {"day_index": 1, "day_date": setup["trip"].preferred_start_date.isoformat(), "items": []},
        {"day_index": 2, "day_date": (setup["trip"].preferred_start_date + timedelta(days=1)).isoformat(), "items": []},
        {"day_index": 3, "day_date": (setup["trip"].preferred_start_date + timedelta(days=2)).isoformat(), "items": []},
        {"day_index": 4, "day_date": (setup["trip"].preferred_start_date + timedelta(days=3)).isoformat(), "items": []},
    ]
    assert api_session.query(PlanItem).count() == 0


def test_blocked_reason_does_not_leak_identity(db: Session):
    setup = _make_trip(db, days=4, budget_ceiling=1.0)

    result = generator.generate_plan(db, setup["trip"].id, setup["organizer"])

    assert "Mia" not in result.blocked_reason
    assert "Sam" not in result.blocked_reason
    assert setup["organizer"].id not in result.blocked_reason
    assert setup["participant"].id not in result.blocked_reason


def test_single_member_budget_ceiling_does_not_block_initial_generation(db: Session):
    setup = _make_trip(db, days=4, budget_ceiling=1.0)
    participant_constraints = db.scalars(
        select(MemberConstraint).where(
            MemberConstraint.trip_membership_id == setup["participant"].id
        )
    ).all()
    for constraint in participant_constraints:
        db.delete(constraint)
    db.delete(setup["participant"])
    db.add(
        MemberConstraint(
            trip_membership_id=setup["organizer"].id,
            kind="budget_ceiling",
            importance="required",
            params={"max_total_per_person": 1.0},
        )
    )
    db.flush()

    result = generator.generate_plan(db, setup["trip"].id, setup["organizer"])

    assert result.status == "active"
    assert result.blocked_reason is None
    assert len(result.items) == 12


def test_long_single_member_trip_can_reuse_places_across_days(db: Session):
    setup = _make_trip(db, days=5, budget_ceiling=800.0)
    participant_constraints = db.scalars(
        select(MemberConstraint).where(
            MemberConstraint.trip_membership_id == setup["participant"].id
        )
    ).all()
    for constraint in participant_constraints:
        db.delete(constraint)
    db.delete(setup["participant"])
    db.flush()

    result = generator.generate_plan(db, setup["trip"].id, setup["organizer"])

    assert result.status == "active"
    assert result.blocked_reason is None
    assert len(result.items) == 15
    for day_index in range(1, 6):
        day_titles = [
            item.title for item in result.items if item.day_index == day_index
        ]
        assert len(day_titles) == len(set(day_titles))


def test_non_organizer_cannot_generate_plan(client: TestClient, api_session: Session):
    setup = _make_trip(api_session)

    response = client.post(
        f"/api/trips/{setup['trip'].id}/plans/generate",
        headers={"X-Membership-Id": setup["participant"].id},
    )

    assert response.status_code == 403

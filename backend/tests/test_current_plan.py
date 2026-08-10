from __future__ import annotations

from datetime import date

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.api import main as api
from app.db.models import Plan, PlanItem, Trip, User
from app.domain.decisions import orchestrator as orch


def test_current_plan_prefers_the_plan_with_items(db: Session):
    user = User(name="Mia", email="mia-current-plan@example.com")
    db.add(user)
    db.flush()
    trip = Trip(name="Chicago", destination="Chicago", created_by_user_id=user.id)
    db.add(trip)
    db.flush()

    empty_plan = Plan(trip_id=trip.id)
    filled_plan = Plan(trip_id=trip.id)
    db.add_all([empty_plan, filled_plan])
    db.flush()
    item = PlanItem(
        plan_id=filled_plan.id,
        day_index=1,
        day_date=date(2026, 8, 14),
        start_hour=10,
        title="Architecture cruise",
        place="Chicago River",
    )
    db.add(item)
    db.flush()

    api.app.dependency_overrides[api.get_session] = lambda: db
    try:
        with TestClient(api.app) as client:
            response = client.get(f"/api/trips/{trip.id}/plans/current")
    finally:
        api.app.dependency_overrides.clear()

    assert response.status_code == 200
    body = response.json()
    assert body["plan_id"] == filled_plan.id
    assert body["days"][0]["items"][0]["title"] == "Architecture cruise"


def test_cross_day_change_moves_item_to_the_target_day_group(db: Session):
    user = User(name="Mia", email="mia-cross-day-plan@example.com")
    db.add(user)
    db.flush()
    trip = Trip(
        name="Chicago",
        destination="Chicago",
        preferred_start_date=date(2026, 8, 14),
        preferred_end_date=date(2026, 8, 17),
        created_by_user_id=user.id,
    )
    db.add(trip)
    db.flush()
    plan = Plan(trip_id=trip.id)
    db.add(plan)
    db.flush()
    item = PlanItem(
        plan_id=plan.id,
        day_index=3,
        day_date=date(2026, 8, 16),
        start_hour=13,
        title="Wicker Park food walk",
        place="Wicker Park",
    )
    db.add(item)
    db.flush()

    orch._apply(db, item, {"day_date": date(2026, 8, 14)})
    db.flush()

    api.app.dependency_overrides[api.get_session] = lambda: db
    try:
        with TestClient(api.app) as client:
            response = client.get(f"/api/trips/{trip.id}/plans/current")
    finally:
        api.app.dependency_overrides.clear()

    assert response.status_code == 200
    body = response.json()
    assert item.day_index == 1
    assert body["days"][0]["day_index"] == 1
    assert body["days"][0]["items"][0]["title"] == "Wicker Park food walk"

from contextlib import contextmanager

from app.db.models import MemberConstraint, Plan, PlanItem, Preference, Trip, TripMembership, User
from app.db import upsert_demo_seed as seed_module


@contextmanager
def _session_override(db):
    yield db


def test_upsert_demo_seed_creates_demo_dataset(db, monkeypatch):
    monkeypatch.setattr(seed_module, "SessionLocal", lambda: _session_override(db))
    monkeypatch.setattr(seed_module, "ensure_cloud_schema", lambda: None)

    result = seed_module.upsert_demo_seed()

    assert result["updated"] is True
    assert result["members"] == 6
    assert result["items"] == 9

    trip = db.get(Trip, result["trip_id"])
    assert trip is not None
    assert trip.name == "Mia's 30th in Chicago"
    assert trip.status == "traveling"

    plan = db.get(Plan, result["plan_id"])
    assert plan is not None

    memberships = db.query(TripMembership).filter(TripMembership.trip_id == trip.id).all()
    assert len(memberships) == 6

    items = db.query(PlanItem).filter(PlanItem.plan_id == plan.id).all()
    assert len(items) == 9

    organizer = db.query(User).filter(User.email == "organizer@cadensy.local").one()
    assert organizer.password_hash

    preferences = (
        db.query(Preference)
        .join(TripMembership, Preference.trip_membership_id == TripMembership.id)
        .filter(TripMembership.trip_id == trip.id)
        .all()
    )
    assert len(preferences) == 6

    constraints = (
        db.query(MemberConstraint)
        .join(TripMembership, MemberConstraint.trip_membership_id == TripMembership.id)
        .filter(TripMembership.trip_id == trip.id)
        .all()
    )
    assert len(constraints) == 3


def test_upsert_demo_seed_is_idempotent(db, monkeypatch):
    monkeypatch.setattr(seed_module, "SessionLocal", lambda: _session_override(db))
    monkeypatch.setattr(seed_module, "ensure_cloud_schema", lambda: None)

    first = seed_module.upsert_demo_seed()
    second = seed_module.upsert_demo_seed()

    assert first["trip_id"] == second["trip_id"]
    assert first["plan_id"] == second["plan_id"]
    assert second["created_users"] == 0
    assert second["created_memberships"] == 0
    assert second["created_items"] == 0
    assert second["updated_items"] == 9

    trips = db.query(Trip).all()
    plans = db.query(Plan).all()
    items = db.query(PlanItem).all()
    memberships = db.query(TripMembership).all()

    assert len(trips) == 1
    assert len(plans) == 1
    assert len(items) == 9
    assert len(memberships) == 6

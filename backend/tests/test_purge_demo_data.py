from contextlib import contextmanager
from datetime import datetime, timedelta, timezone

from sqlalchemy import select

from app.db.models import AuthSession, Plan, PlanItem, Trip, TripMembership, User
from app.db import purge_demo_data as purge_module
from app.db import upsert_demo_seed as seed_module
from app.domain import auth


@contextmanager
def _session_override(db):
    yield db


def test_purge_demo_data_removes_demo_trip_rows_and_preserves_fixed_accounts(db, monkeypatch):
    monkeypatch.setattr(seed_module, "SessionLocal", lambda: _session_override(db))
    monkeypatch.setattr(seed_module, "ensure_cloud_schema", lambda: None)
    monkeypatch.setattr(purge_module, "SessionLocal", lambda: _session_override(db))

    organizer = User(
        name="Organizer Account",
        email="organizer@cadensy.local",
        password_hash=auth.hash_password("12345678"),
    )
    participant = User(
        name="Participant Account",
        email="participant@cadensy.local",
        password_hash=auth.hash_password("12345678"),
    )
    db.add_all([organizer, participant])
    db.flush()

    keeper_trip = Trip(
        name="Real Trip",
        destination="Seoul",
        status="planning",
        created_by_user_id=organizer.id,
    )
    db.add(keeper_trip)
    db.flush()

    db.add(
        TripMembership(
            trip_id=keeper_trip.id,
            user_id=organizer.id,
            role="organizer",
            join_method="creator",
            status="preferences_submitted",
        )
    )
    db.flush()

    seeded = seed_module.upsert_demo_seed()
    db.add(
        AuthSession(
            user_id=organizer.id,
            token_hash="demo-session-token",
            expires_at=datetime.now(timezone.utc) + timedelta(days=7),
        )
    )
    db.add(
        User(
            name="Elena Cruz",
            email="elena@example.com",
            password_hash=auth.hash_password("12345678"),
        )
    )
    db.commit()

    result = purge_module.purge_demo_data()

    assert result["updated"] is True
    assert result["deleted"]["trip"] >= 1
    assert result["deleted"]["user_account"] >= 1

    assert db.get(Trip, keeper_trip.id) is not None
    assert db.scalar(select(User).where(User.email == "organizer@cadensy.local")) is not None
    assert db.scalar(select(User).where(User.email == "participant@cadensy.local")) is not None

    assert db.get(Trip, seeded["trip_id"]) is None
    assert db.get(Plan, seeded["plan_id"]) is None
    assert db.scalar(select(PlanItem.id)) is None
    assert db.scalar(select(AuthSession.id).where(AuthSession.user_id == organizer.id)) is not None
    assert db.scalar(select(User).where(User.email == "elena@example.com")) is None


def test_purge_demo_data_is_idempotent_when_demo_rows_are_absent(db, monkeypatch):
    monkeypatch.setattr(purge_module, "SessionLocal", lambda: _session_override(db))

    first = purge_module.purge_demo_data()
    second = purge_module.purge_demo_data()

    assert first["updated"] is True
    assert second["updated"] is True
    assert sum(second["deleted"].values()) == 0

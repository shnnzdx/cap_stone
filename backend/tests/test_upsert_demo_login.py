from contextlib import contextmanager

from sqlalchemy import select

from app.db.models import Trip, TripMembership, User
from app.db import upsert_demo_login as login_module
from app.domain import auth


@contextmanager
def _session_override(db):
    yield db


def test_upsert_demo_login_keeps_legacy_account_without_recreating_demo_trip(db, monkeypatch):
    monkeypatch.setattr(login_module, "SessionLocal", lambda: _session_override(db))
    monkeypatch.setattr(login_module, "ensure_cloud_schema", lambda: None)

    result = login_module.upsert_demo_login()

    assert result["updated"] is True
    assert result["created_user"] is True
    assert result["created_trip"] is False
    assert result["created_membership"] is False
    assert result["trip_id"] is None
    assert result["membership_id"] is None

    organizer = db.scalar(select(User).where(User.email == "organizer@cadensy.local"))

    assert organizer is not None
    assert auth.verify_password("12345678", organizer.password_hash)
    assert db.scalar(select(Trip.id)) is None
    assert db.scalar(select(TripMembership.id)) is None


from contextlib import contextmanager

from sqlalchemy import select

from app.db.models import User
from app.db import upsert_fixed_accounts as fixed_module
from app.domain import auth


@contextmanager
def _session_override(db):
    yield db


def test_upsert_fixed_accounts_creates_both_real_backend_accounts(db, monkeypatch):
    monkeypatch.setattr(fixed_module, "SessionLocal", lambda: _session_override(db))
    monkeypatch.setattr(fixed_module, "ensure_cloud_schema", lambda: None)

    result = fixed_module.upsert_fixed_accounts()

    assert result["updated"] is True
    assert [account["email"] for account in result["accounts"]] == [
        "organizer@cadensy.local",
        "participant@cadensy.local",
    ]

    organizer = db.scalar(select(User).where(User.email == "organizer@cadensy.local"))
    participant = db.scalar(select(User).where(User.email == "participant@cadensy.local"))

    assert organizer is not None
    assert participant is not None
    assert auth.verify_password("12345678", organizer.password_hash)
    assert auth.verify_password("12345678", participant.password_hash)


def test_upsert_fixed_accounts_is_idempotent(db, monkeypatch):
    monkeypatch.setattr(fixed_module, "SessionLocal", lambda: _session_override(db))
    monkeypatch.setattr(fixed_module, "ensure_cloud_schema", lambda: None)

    first = fixed_module.upsert_fixed_accounts()
    second = fixed_module.upsert_fixed_accounts()

    assert first["updated"] is True
    assert second["updated"] is True
    assert [account["created"] for account in second["accounts"]] == [False, False]
    assert db.query(User).count() == 2

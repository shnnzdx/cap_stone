import pytest

from app.db import seed


def test_destructive_seed_refuses_non_local_database_without_override(monkeypatch):
    monkeypatch.setenv(
        "DATABASE_URL",
        "postgresql+psycopg://user:password@tripsync-prod.example.us-east-1.rds.amazonaws.com:5432/tripsync",
    )
    monkeypatch.delenv("ALLOW_DESTRUCTIVE_SEED", raising=False)

    with pytest.raises(RuntimeError, match="Refusing to run destructive demo seed"):
        seed.require_destructive_seed_allowed()


def test_destructive_seed_allows_local_database(monkeypatch):
    monkeypatch.setenv(
        "DATABASE_URL",
        "postgresql+psycopg://postgres:password@localhost:5432/tripsync",
    )
    monkeypatch.delenv("ALLOW_DESTRUCTIVE_SEED", raising=False)

    seed.require_destructive_seed_allowed()


def test_destructive_seed_can_be_explicitly_overridden(monkeypatch):
    monkeypatch.setenv(
        "DATABASE_URL",
        "postgresql+psycopg://user:password@tripsync-prod.example.us-east-1.rds.amazonaws.com:5432/tripsync",
    )
    monkeypatch.setenv("ALLOW_DESTRUCTIVE_SEED", "1")

    seed.require_destructive_seed_allowed()

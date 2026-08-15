import pytest

from app.db import seed
from tests import conftest as pytest_conftest
from tests import _db_test_harness as test_harness


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


@pytest.mark.parametrize(
    ("database_name", "allowed"),
    [
        ("tripsync_test", True),
        ("test_tripsync", True),
        ("tripsync_pytest", True),
        ("tripsync", False),
        ("cadensy_prod", False),
    ],
)
def test_pytest_database_name_must_be_explicitly_test_only(database_name, allowed):
    assert test_harness.is_explicit_test_database_name(database_name) is allowed


def test_pytest_database_guard_rejects_non_test_database_name():
    with pytest.raises(RuntimeError, match="explicitly test-only database"):
        test_harness.require_safe_test_database_name("tripsync")


def test_pytest_test_database_url_shell_override_wins_over_dotenv(monkeypatch):
    override_url = "postgresql+psycopg://postgres:password@localhost:5432/pytest_override_test"
    monkeypatch.setenv("TEST_DATABASE_URL", override_url)

    assert pytest_conftest._load_test_database_url_from_environment() == override_url

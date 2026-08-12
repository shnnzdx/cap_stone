from __future__ import annotations


def quote_ident(identifier: str) -> str:
    return '"' + identifier.replace('"', '""') + '"'


def is_explicit_test_database_name(database_name: str) -> bool:
    normalized = database_name.strip().lower()
    if not normalized:
        return False
    return (
        normalized == "tripsync_test"
        or normalized.startswith("test_")
        or normalized.endswith("_test")
        or normalized.startswith("pytest_")
        or normalized.endswith("_pytest")
    )


def require_safe_test_database_name(database_name: str) -> None:
    if is_explicit_test_database_name(database_name):
        return
    raise RuntimeError(
        "Refusing destructive pytest database setup because TEST_DATABASE_URL "
        f"does not point at an explicitly test-only database: {database_name!r}"
    )

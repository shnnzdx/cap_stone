"""Small compatibility migrations for local/dev databases.

The project does not have Alembic yet. Tests rebuild the schema from models,
but a developer database can survive across code changes, so additive nullable
columns need to be patched in place.
"""

from __future__ import annotations

from sqlalchemy import text

from .session import engine


def ensure_dev_schema() -> None:
    with engine.begin() as conn:
        conn.execute(text("ALTER TABLE trip ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ"))
        conn.execute(
            text(
                "ALTER TABLE change_proposal "
                "ADD COLUMN IF NOT EXISTS extended_at TIMESTAMPTZ"
            )
        )

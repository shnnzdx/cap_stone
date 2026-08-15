"""Create missing database schema objects without deleting existing data.

This is the temporary production-safe schema entry point until the project adds
Alembic migrations. It intentionally calls create_all() only and never calls
drop_all() or demo seed code.
"""

from __future__ import annotations

from sqlalchemy import text

from .models import Base
from .session import engine


def init_schema() -> dict:
    Base.metadata.create_all(engine)
    # create_all does not relax constraints on an existing installation. These
    # idempotent ALTERs let provider-backed places preserve genuinely unknown
    # planning metadata instead of storing fabricated zero/default values.
    if engine.dialect.name == "postgresql":
        with engine.begin() as connection:
            statements = (
                "ALTER TABLE plan ALTER COLUMN estimated_total_per_person DROP NOT NULL",
                "ALTER TABLE plan_item ALTER COLUMN duration_min DROP NOT NULL",
                "ALTER TABLE plan_item ALTER COLUMN price_per_person DROP NOT NULL",
                "ALTER TABLE plan_item ALTER COLUMN title TYPE VARCHAR(300)",
                "ALTER TABLE plan_item ALTER COLUMN place TYPE VARCHAR(500)",
                "ALTER TABLE plan_item ALTER COLUMN photo_url TYPE VARCHAR(1000)",
                "ALTER TABLE plan_item ADD COLUMN IF NOT EXISTS local_title VARCHAR(300)",
                "ALTER TABLE plan ADD COLUMN IF NOT EXISTS needs_refresh BOOLEAN NOT NULL DEFAULT FALSE",
                "ALTER TABLE place ADD COLUMN IF NOT EXISTS english_name VARCHAR(300)",
                "ALTER TABLE place ADD COLUMN IF NOT EXISTS local_name VARCHAR(300)",
                "ALTER TABLE trip ADD COLUMN IF NOT EXISTS cover_image_url VARCHAR(1500)",
                "ALTER TABLE trip ADD COLUMN IF NOT EXISTS cover_image_source VARCHAR(30)",
                "ALTER TABLE trip ADD COLUMN IF NOT EXISTS cover_attribution_name VARCHAR(200)",
                "ALTER TABLE trip ADD COLUMN IF NOT EXISTS cover_attribution_url VARCHAR(1000)",
                "ALTER TABLE trip ADD COLUMN IF NOT EXISTS cover_source_url VARCHAR(1000)",
                "ALTER TABLE trip ADD COLUMN IF NOT EXISTS cover_image_fetched_at TIMESTAMPTZ",
            )
            for statement in statements:
                connection.execute(text(statement))
    return {"tables": sorted(Base.metadata.tables)}


if __name__ == "__main__":
    print("schema ready:", init_schema())

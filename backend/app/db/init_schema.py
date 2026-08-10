"""Create missing database schema objects without deleting existing data.

This is the temporary production-safe schema entry point until the project adds
Alembic migrations. It intentionally calls create_all() only and never calls
drop_all() or demo seed code.
"""

from __future__ import annotations

from .models import Base
from .session import engine


def init_schema() -> dict:
    Base.metadata.create_all(engine)
    return {"tables": sorted(Base.metadata.tables)}


if __name__ == "__main__":
    print("schema ready:", init_schema())

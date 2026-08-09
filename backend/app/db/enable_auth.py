"""Enable password login on an existing local database without reseeding.

This is intentionally small because the project does not have Alembic yet.
It adds the auth columns/tables if missing and assigns a development password
to the first organizer membership.
"""

from __future__ import annotations

import os

from sqlalchemy import select, text

from ..domain.auth import hash_password
from .models import AuthSession, TripMembership, User
from .session import SessionLocal, engine

ORGANIZER_EMAIL = os.getenv("SEED_ORGANIZER_EMAIL", "organizer@cadensy.local")
ORGANIZER_PASSWORD = os.getenv("SEED_ORGANIZER_PASSWORD", "12345678")
GUEST_EMAIL = os.getenv("SEED_GUEST_EMAIL", "guest@cadensy.local")
GUEST_PASSWORD = os.getenv("SEED_GUEST_PASSWORD", "12345678")


def enable() -> dict:
    AuthSession.__table__.create(engine, checkfirst=True)
    with engine.begin() as connection:
        connection.execute(
            text("ALTER TABLE user_account ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255)")
        )

    with SessionLocal() as db:
        organizer = db.scalar(
            select(TripMembership)
            .where(TripMembership.role == "organizer", TripMembership.user_id.is_not(None))
            .order_by(TripMembership.created_at)
        )
        if organizer is None:
            return {"updated": False, "reason": "No organizer account found"}

        user = db.get(User, organizer.user_id)
        if user is None:
            return {"updated": False, "reason": "Organizer user not found"}

        user.email = ORGANIZER_EMAIL
        user.password_hash = hash_password(ORGANIZER_PASSWORD)

        guest_user = db.scalar(select(User).where(User.email == GUEST_EMAIL))
        if guest_user is not None:
            guest_user.password_hash = hash_password(GUEST_PASSWORD)

        db.commit()
        return {
            "updated": True,
            "email": ORGANIZER_EMAIL,
            "guest_email": GUEST_EMAIL if guest_user is not None else None,
            "trip_id": organizer.trip_id,
            "membership_id": organizer.id,
        }


if __name__ == "__main__":
    print(enable())

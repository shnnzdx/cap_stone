"""Ensure the fixed organizer/participant accounts exist without demo trips.

This is the cloud-safe replacement for the old demo-login helper. It creates or
updates the two fixed backend accounts and stores password hashes in the real
database, but it does not create memberships, trips, or itinerary data.
"""

from __future__ import annotations

import os

from sqlalchemy import func, select

from ..domain.auth import hash_password, normalize_email
from .models import User
from .session import SessionLocal
from .upsert_demo_login import ensure_cloud_schema

ORGANIZER_EMAIL = normalize_email(
    os.getenv("FIXED_ORGANIZER_EMAIL", "organizer@cadensy.local")
)
ORGANIZER_NAME = os.getenv("FIXED_ORGANIZER_NAME", "Organizer Account")
ORGANIZER_PASSWORD = os.getenv("FIXED_ORGANIZER_PASSWORD", "12345678")

PARTICIPANT_EMAIL = normalize_email(
    os.getenv("FIXED_PARTICIPANT_EMAIL", "participant@cadensy.local")
)
PARTICIPANT_NAME = os.getenv("FIXED_PARTICIPANT_NAME", "Participant Account")
PARTICIPANT_PASSWORD = os.getenv("FIXED_PARTICIPANT_PASSWORD", "12345678")


def _ensure_user(db, *, email: str, name: str, password: str) -> tuple[User, bool]:
    user = db.scalar(select(User).where(func.lower(User.email) == email))
    created = user is None
    if user is None:
        user = User(name=name, email=email, avatar=None)
        db.add(user)
        db.flush()
    elif not user.name:
        user.name = name
    user.email = email
    user.password_hash = hash_password(password)
    return user, created


def upsert_fixed_accounts() -> dict:
    ensure_cloud_schema()

    with SessionLocal() as db:
        organizer, created_organizer = _ensure_user(
            db,
            email=ORGANIZER_EMAIL,
            name=ORGANIZER_NAME,
            password=ORGANIZER_PASSWORD,
        )
        participant, created_participant = _ensure_user(
            db,
            email=PARTICIPANT_EMAIL,
            name=PARTICIPANT_NAME,
            password=PARTICIPANT_PASSWORD,
        )
        db.commit()
        return {
            "updated": True,
            "accounts": [
                {
                    "email": organizer.email,
                    "created": created_organizer,
                    "user_id": organizer.id,
                },
                {
                    "email": participant.email,
                    "created": created_participant,
                    "user_id": participant.id,
                },
            ],
        }


if __name__ == "__main__":
    print("fixed accounts ready:", upsert_fixed_accounts())

"""Upsert the shared demo organizer login without destructive seeding.

This is intended for cloud databases where RDS is private and only reachable
from ECS tasks. It creates missing schema objects, creates or updates the demo
organizer account, and ensures the account has at least one organizer
membership. It never drops tables or deletes data.
"""

from __future__ import annotations

import os
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import func, select, text

from ..domain.auth import hash_password, normalize_email
from .models import AuthSession, Base, Plan, Trip, TripMembership, User
from .session import SessionLocal, engine

ORGANIZER_EMAIL = normalize_email(
    os.getenv("SEED_ORGANIZER_EMAIL", "organizer@cadensy.local")
)
ORGANIZER_NAME = os.getenv("SEED_ORGANIZER_NAME", "Mia Chen")
ORGANIZER_PASSWORD = os.getenv("SEED_ORGANIZER_PASSWORD", "12345678")
DEMO_TRIP_NAME = os.getenv("SEED_DEMO_TRIP_NAME", "TripSync Cloud Demo")
DEMO_DESTINATION = os.getenv("SEED_DEMO_DESTINATION", "Chicago")


def ensure_cloud_schema() -> None:
    Base.metadata.create_all(engine)
    AuthSession.__table__.create(engine, checkfirst=True)
    with engine.begin() as connection:
        connection.execute(
            text("ALTER TABLE user_account ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255)")
        )
        connection.execute(
            text(
                "ALTER TABLE change_proposal "
                "ADD COLUMN IF NOT EXISTS extended_at TIMESTAMPTZ"
            )
        )


def upsert_demo_login() -> dict:
    ensure_cloud_schema()

    with SessionLocal() as db:
        user = db.scalar(
            select(User).where(func.lower(User.email) == ORGANIZER_EMAIL)
        )
        created_user = user is None
        if user is None:
            user = User(
                name=ORGANIZER_NAME,
                email=ORGANIZER_EMAIL,
                avatar=None,
            )
            db.add(user)
            db.flush()
        else:
            user.name = user.name or ORGANIZER_NAME
            user.email = ORGANIZER_EMAIL

        user.password_hash = hash_password(ORGANIZER_PASSWORD)

        membership = db.scalar(
            select(TripMembership)
            .where(
                TripMembership.user_id == user.id,
                TripMembership.role == "organizer",
            )
            .order_by(TripMembership.created_at)
        )

        created_trip = False
        created_membership = False
        if membership is None:
            today = date.today()
            trip = Trip(
                name=DEMO_TRIP_NAME,
                destination=DEMO_DESTINATION,
                preferred_start_date=today,
                preferred_end_date=today + timedelta(days=3),
                expected_group_size=4,
                currency="USD",
                preferences_deadline=datetime.now(timezone.utc) + timedelta(days=7),
                status="planning",
                created_by_user_id=user.id,
            )
            db.add(trip)
            db.flush()

            membership = TripMembership(
                trip_id=trip.id,
                user_id=user.id,
                guest_display_name=None,
                role="organizer",
                join_method="creator",
                status="invited",
            )
            db.add(membership)
            db.flush()

            db.add(
                Plan(
                    trip_id=trip.id,
                    status="active",
                    blocked_reason=None,
                    estimated_total_per_person=0,
                    currency="USD",
                )
            )
            created_trip = True
            created_membership = True

        db.commit()

        return {
            "updated": True,
            "email": ORGANIZER_EMAIL,
            "created_user": created_user,
            "created_trip": created_trip,
            "created_membership": created_membership,
            "trip_id": membership.trip_id,
            "membership_id": membership.id,
        }


if __name__ == "__main__":
    result = upsert_demo_login()
    print(
        "demo login ready:",
        {
            "updated": result["updated"],
            "email": result["email"],
            "created_user": result["created_user"],
            "created_trip": result["created_trip"],
            "created_membership": result["created_membership"],
            "trip_id": result["trip_id"],
            "membership_id": result["membership_id"],
        },
    )

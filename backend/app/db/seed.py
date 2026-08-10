"""把 demo 里那趟「Mia's 30th in Chicago」灌进数据库。

跑一次就有真数据可看,不用对着空表干瞪眼。
内容和前端 tripContent.js 对得上,方便两边比对。
"""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone
import os

from sqlalchemy import delete
from sqlalchemy.engine import make_url

from .models import (
    AuthSession,
    Base,
    MemberConstraint,
    MemberConstraintPrivate,
    Plan,
    PlanItem,
    PlanItemComment,
    Preference,
    Trip,
    TripMembership,
    User,
)
from .session import SessionLocal, engine
from ..domain.auth import hash_password

# 这几张是前端 final.css 里已经在用的图（确认能加载），先拿来当占位。
# 真正的配图应该跟着景点库走 —— 每个景点自带一张，AI 生成时直接抄过来。
U = "https://images.unsplash.com/photo-{}?auto=format&fit=crop&w=900&q=75"
PHOTOS = [U.format("1494522358652-f30e61a60313"), U.format("1500530855697-b586d89ba3ee"),
          U.format("1486911278844-a81c5267e227"), U.format("1514893011-72dfa15c5ab3")]

LOCAL_DATABASE_HOSTS = {"", "localhost", "127.0.0.1", "::1"}
DEMO_START = date.today() - timedelta(days=1)
DEMO_END = date.today() + timedelta(days=2)

MEMBERS = [
    ("Mia Chen", "organizer@cadensy.local", "organizer"),
    ("Elena Cruz", "elena@example.com", "participant"),
    ("Sam Osei", "sam@example.com", "participant"),
    ("Priya Raman", "priya@example.com", "participant"),
    ("Tom Baker", "tom@example.com", "participant"),
    ("Yuki Sato", "yuki@example.com", "participant"),
]

# (第几天, 日期, 几点, 时长, 标题, 地点, 每人多少钱, 是不是吃饭, 结实程度, 纬度, 经度)
ITEMS = [
    (1, DEMO_START, 16.0, 60, "Hotel check-in", "River North hotel", 0, False, "loose", 41.8925, -87.6345),
    (1, DEMO_START, 18.0, 90, "Riverwalk sunset", "Chicago Riverwalk", 0, False, "loose", 41.8879, -87.6270),
    (1, DEMO_START, 19.5, 120, "Welcome dinner", "River North", 45, True, "booked", 41.8930, -87.6330),
    (2, DEMO_START + timedelta(days=1), 10.0, 90, "Architecture cruise", "Chicago River dock", 52, False, "booked", 41.8880, -87.6244),
    (2, DEMO_START + timedelta(days=1), 14.0, 150, "Art Institute of Chicago", "Michigan Avenue", 32, False, "loose", 41.8796, -87.6237),
    (2, DEMO_START + timedelta(days=1), 19.0, 150, "Birthday dinner", "River North", 78, True, "booked", 41.8935, -87.6320),
    (3, DEMO_START + timedelta(days=2), 10.5, 90, "Late brunch", "Near the hotel", 28, True, "loose", 41.8920, -87.6350),
    (3, DEMO_START + timedelta(days=2), 13.0, 180, "Wicker Park food walk", "Wicker Park", 40, True, "loose", 41.9088, -87.6796),
    (3, DEMO_START + timedelta(days=2), 18.5, 120, "Group meetup", "West Loop", 35, True, "loose", 41.8836, -87.6500),
]


def is_local_database_url(database_url: str) -> bool:
    try:
        host = make_url(database_url).host or ""
    except Exception:
        return False
    return host in LOCAL_DATABASE_HOSTS


def require_destructive_seed_allowed() -> None:
    if os.getenv("ALLOW_DESTRUCTIVE_SEED") == "1":
        return

    database_url = os.getenv("DATABASE_URL", "postgresql+psycopg://localhost/tripsync")
    if is_local_database_url(database_url):
        return

    raise RuntimeError(
        "Refusing to run destructive demo seed against a non-local DATABASE_URL. "
        "Use migrations/schema initialization for shared or cloud databases. "
        "Set ALLOW_DESTRUCTIVE_SEED=1 only for an explicitly approved disposable database."
    )


def reset_schema() -> None:
    require_destructive_seed_allowed()
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)


def seed() -> dict:
    with SessionLocal() as db:
        for model in (AuthSession, MemberConstraintPrivate, MemberConstraint, Preference, PlanItemComment, PlanItem,
                      Plan, TripMembership, Trip, User):
            db.execute(delete(model))

        organizer_password = os.getenv("SEED_ORGANIZER_PASSWORD", "12345678")
        users = [
            User(
                name=n,
                email=e,
                password_hash=hash_password(organizer_password) if role == "organizer" else None,
            )
            for n, e, role in MEMBERS
        ]
        db.add_all(users)
        db.flush()

        trip = Trip(
            name="Mia's 30th in Chicago",
            destination="Chicago",
            preferred_start_date=DEMO_START,
            preferred_end_date=DEMO_END,
            expected_group_size=6,
            status="traveling",
            created_by_user_id=users[0].id,
            preferences_deadline=datetime.now(timezone.utc) + timedelta(days=2),
        )
        db.add(trip)
        db.flush()

        memberships = [
            TripMembership(
                trip_id=trip.id,
                user_id=user.id,
                role=role,
                join_method="creator" if role == "organizer" else "invite_login",
                status="preferences_submitted",
            )
            for user, (_, _, role) in zip(users, MEMBERS)
        ]
        db.add_all(memberships)
        db.flush()

        # Mia 的私密约束:不早于 9 点。原文和可见性存在另一张表里。
        constraint = MemberConstraint(
            trip_membership_id=memberships[0].id,
            kind="time_window",
            importance="required",
            params={"earliest_hour": 9.0},
        )
        db.add(constraint)
        db.flush()
        db.add(
            MemberConstraintPrivate(
                constraint_id=constraint.id,
                original_text="No activities before 9:00 AM",
                visibility="planning_only",
            )
        )

        # 另外两个人的硬底线:预算上限、走路距离
        for membership, kind, params in (
            (memberships[2], "budget_ceiling", {"max_total_per_person": 650.0}),
            (memberships[4], "walk_limit", {"max_km_per_day": 3.0}),
        ):
            c = MemberConstraint(
                trip_membership_id=membership.id,
                kind=kind,
                importance="required",
                params=params,
            )
            db.add(c)

        db.add_all(
            Preference(
                trip_membership_id=m.id,
                preferred_start_date=DEMO_START,
                preferred_end_date=DEMO_END,
                available_start_date=DEMO_START,
                available_end_date=DEMO_END,
                ideal_budget=500.0,
                maximum_budget=650.0,
                top_interests=["Food", "Culture", "Relaxed"],
                submitted_at=datetime.now(timezone.utc),
            )
            for m in memberships
        )

        plan = Plan(trip_id=trip.id, estimated_total_per_person=310.0)
        db.add(plan)
        db.flush()

        db.add_all(
            PlanItem(
                plan_id=plan.id,
                day_index=day,
                day_date=when,
                start_hour=hour,
                duration_min=mins,
                title=title,
                place=place,
                price_per_person=price,
                is_meal=is_meal,
                settledness=settledness,
                lat=lat,
                lng=lng,
                photo_url=PHOTOS[index % len(PHOTOS)],
                source="mock",
            )
            for index, (day, when, hour, mins, title, place, price, is_meal, settledness, lat, lng) in enumerate(ITEMS)
        )

        db.commit()
        return {
            "trip_id": trip.id,
            "plan_id": plan.id,
            "members": len(memberships),
            "items": len(ITEMS),
        }


if __name__ == "__main__":
    reset_schema()
    print("建表完成:", seed())

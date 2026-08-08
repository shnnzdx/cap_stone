"""测试用的数据库。跑在 tripsync_test 上,不碰你平时看的那个库。"""

from __future__ import annotations

import os
from datetime import date, datetime, timedelta, timezone

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from app.db.models import (
    Base,
    MemberConstraint,
    MemberConstraintPrivate,
    Plan,
    PlanItem,
    Trip,
    TripMembership,
    User,
)

TEST_DATABASE_URL = os.getenv(
    "TEST_DATABASE_URL", "postgresql+psycopg://localhost/tripsync_test"
)


@pytest.fixture(scope="session")
def test_engine():
    engine = create_engine(TEST_DATABASE_URL, future=True)
    Base.metadata.drop_all(engine)
    Base.metadata.create_all(engine)
    yield engine
    engine.dispose()


@pytest.fixture
def db(test_engine) -> Session:
    """每条测试自己一个事务,跑完回滚 —— 测试之间互不影响。"""
    connection = test_engine.connect()
    transaction = connection.begin()
    session = sessionmaker(bind=connection, future=True)()
    try:
        yield session
    finally:
        session.close()
        # 期待 IntegrityError 的测试里,事务已经被数据库自己回滚掉了
        if transaction.is_active:
            transaction.rollback()
        connection.close()


@pytest.fixture
def trip_setup(db: Session) -> dict:
    """一趟最小的旅行:两个成员、一个行程条目。"""
    user = User(name="Mia", email=f"mia-{datetime.now().timestamp()}@example.com")
    other = User(name="Sam", email=f"sam-{datetime.now().timestamp()}@example.com")
    db.add_all([user, other])
    db.flush()

    trip = Trip(name="Test trip", destination="Chicago", created_by_user_id=user.id)
    db.add(trip)
    db.flush()

    organizer = TripMembership(trip_id=trip.id, user_id=user.id, role="organizer")
    participant = TripMembership(trip_id=trip.id, user_id=other.id)
    db.add_all([organizer, participant])
    db.flush()

    plan = Plan(trip_id=trip.id)
    db.add(plan)
    db.flush()

    item = PlanItem(
        plan_id=plan.id,
        day_index=2,
        day_date=date(2026, 8, 15),
        start_hour=14.0,
        duration_min=120,
        title="Art Institute of Chicago",
        place="Michigan Avenue",
    )
    db.add(item)
    db.flush()

    return {
        "trip": trip,
        "plan": plan,
        "item": item,
        "organizer": organizer,
        "participant": participant,
        "deadline": datetime.now(timezone.utc) + timedelta(hours=24),
    }


@pytest.fixture
def full_trip(db: Session) -> dict:
    """一趟完整的旅行:6 个成员、一条 Mia 的硬底线、一个普通条目、一个已订条目。"""
    stamp = datetime.now().timestamp()
    users = [
        User(name=f"M{i}", email=f"m{i}-{stamp}@example.com") for i in range(6)
    ]
    db.add_all(users)
    db.flush()

    trip = Trip(
        name="Mia's 30th in Chicago",
        destination="Chicago",
        status="planning",
        created_by_user_id=users[0].id,
    )
    db.add(trip)
    db.flush()

    members = [
        TripMembership(
            trip_id=trip.id,
            user_id=user.id,
            role="organizer" if i == 0 else "participant",
        )
        for i, user in enumerate(users)
    ]
    db.add_all(members)
    db.flush()

    # Mia 的硬底线:不早于 9 点。原文存在隔离表里。
    constraint = MemberConstraint(
        trip_membership_id=members[0].id,
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

    plan = Plan(trip_id=trip.id, estimated_total_per_person=310.0)
    db.add(plan)
    db.flush()

    art = PlanItem(
        plan_id=plan.id, day_index=2, day_date=date(2026, 8, 15), start_hour=14.0,
        duration_min=150, title="Art Institute of Chicago", place="Michigan Avenue",
        price_per_person=32.0, settledness="loose",
    )
    dinner = PlanItem(
        plan_id=plan.id, day_index=2, day_date=date(2026, 8, 15), start_hour=19.0,
        duration_min=150, title="Birthday dinner", place="River North",
        price_per_person=78.0, is_meal=True, settledness="booked",
    )
    db.add_all([art, dinner])
    db.flush()

    return {
        "trip": trip,
        "plan": plan,
        "art": art,
        "dinner": dinner,
        "members": members,
        "me": members[0],
    }

from __future__ import annotations

from datetime import date
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session, sessionmaker

from app.api import main as api
from app.db.models import Plan, PlanItem, Trip, TripMembership, User


@pytest.fixture
def api_session(test_engine):
    connection = test_engine.connect()
    transaction = connection.begin()
    session = sessionmaker(
        bind=connection,
        future=True,
        join_transaction_mode="create_savepoint",
    )()
    try:
        yield session
    finally:
        session.close()
        if transaction.is_active:
            transaction.rollback()
        connection.close()


@pytest.fixture
def client(api_session: Session):
    api.app.dependency_overrides[api.get_session] = lambda: api_session
    with TestClient(api.app) as test_client:
        yield test_client
    api.app.dependency_overrides.clear()


def _user(db: Session, name: str) -> User:
    user = User(name=name, email=f"{name.lower()}-{uuid4().hex}@example.com")
    db.add(user)
    db.flush()
    return user


def _trip_with_member(
    db: Session,
    user: User,
    *,
    name: str = "Existing trip",
    role: str = "participant",
) -> tuple[Trip, TripMembership]:
    trip = Trip(name=name, destination="Chicago", created_by_user_id=user.id)
    db.add(trip)
    db.flush()

    membership = TripMembership(
        trip_id=trip.id,
        user_id=user.id,
        role=role,
        status="joined",
    )
    db.add(membership)
    db.flush()
    return trip, membership


def test_create_trip_makes_creator_organizer_and_empty_plan(
    client: TestClient, api_session: Session
):
    user = _user(api_session, "Mia")
    _, auth_membership = _trip_with_member(api_session, user)

    response = client.post(
        "/api/trips",
        headers={"X-Membership-Id": auth_membership.id},
        json={
            "name": "Paris birthday",
            "destination": "Paris",
            "preferred_start_date": "2026-10-01",
            "preferred_end_date": "2026-10-05",
            "expected_group_size": 6,
            "currency": "EUR",
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "Paris birthday"
    assert body["destination"] == "Paris"
    assert body["status"] == "planning"
    assert body["plan_id"]

    membership = api_session.scalar(
        select(TripMembership).where(
            TripMembership.trip_id == body["id"],
            TripMembership.user_id == user.id,
        )
    )
    assert membership is not None
    assert membership.role == "organizer"
    assert membership.join_method == "creator"

    plan = api_session.get(Plan, body["plan_id"])
    assert plan is not None
    assert plan.trip_id == body["id"]
    assert api_session.scalar(
        select(PlanItem).where(PlanItem.plan_id == body["plan_id"])
    ) is None


def test_list_trips_returns_only_current_users_trips(
    client: TestClient, api_session: Session
):
    user = _user(api_session, "Mia")
    other_user = _user(api_session, "Sam")
    first_trip, auth_membership = _trip_with_member(
        api_session, user, name="Mine with plan", role="organizer"
    )
    second_trip, _ = _trip_with_member(api_session, user, name="Mine empty")
    _trip_with_member(api_session, other_user, name="Someone else's")

    plan = Plan(trip_id=first_trip.id)
    api_session.add(plan)
    api_session.flush()
    api_session.add_all(
        [
            PlanItem(
                plan_id=plan.id,
                day_index=2,
                day_date=date(2026, 8, 9),
                start_hour=14.0,
                title="Later museum",
                place="Museum",
            ),
            PlanItem(
                plan_id=plan.id,
                day_index=1,
                day_date=date(2026, 8, 8),
                start_hour=9.0,
                title="Morning coffee",
                place="Cafe",
            ),
        ]
    )
    api_session.flush()

    response = client.get(
        "/api/trips",
        headers={"X-Membership-Id": auth_membership.id},
    )

    assert response.status_code == 200
    trips = {trip["id"]: trip for trip in response.json()}
    assert set(trips) == {first_trip.id, second_trip.id}
    assert trips[first_trip.id]["next_item_title"] == "Morning coffee"
    assert trips[first_trip.id]["my_role"] == "organizer"
    assert trips[second_trip.id]["next_item_title"] is None


def test_guest_cannot_list_trips(client: TestClient, api_session: Session):
    user = _user(api_session, "Mia")
    trip, _ = _trip_with_member(api_session, user)
    guest = TripMembership(
        trip_id=trip.id,
        user_id=None,
        guest_display_name="Guest",
        status="joined",
    )
    api_session.add(guest)
    api_session.flush()

    response = client.get(
        "/api/trips",
        headers={"X-Membership-Id": guest.id},
    )

    assert response.status_code == 403


@pytest.mark.parametrize(
    "payload",
    [
        {"destination": "Paris"},
        {"name": "Paris birthday"},
    ],
)
def test_create_trip_requires_name_and_destination(
    client: TestClient, api_session: Session, payload: dict
):
    user = _user(api_session, "Mia")
    _, auth_membership = _trip_with_member(api_session, user)

    response = client.post(
        "/api/trips",
        headers={"X-Membership-Id": auth_membership.id},
        json=payload,
    )

    assert response.status_code == 422


def test_next_item_skips_days_that_already_passed(
    client: TestClient, api_session: Session
):
    """卡片上写的是「下一个」。旅行开始之后不能还显示第一天的事。"""
    from datetime import timedelta

    user = _user(api_session, "Mia")
    trip, auth_membership = _trip_with_member(api_session, user, role="organizer")
    plan = Plan(trip_id=trip.id)
    api_session.add(plan)
    api_session.flush()

    today = date.today()
    api_session.add_all(
        [
            PlanItem(
                plan_id=plan.id, day_index=1, day_date=today - timedelta(days=2),
                start_hour=9.0, title="Already happened", place="Yesterday",
            ),
            PlanItem(
                plan_id=plan.id, day_index=2, day_date=today + timedelta(days=1),
                start_hour=10.0, title="Still ahead", place="Tomorrow",
            ),
        ]
    )
    api_session.flush()

    response = client.get(
        "/api/trips", headers={"X-Membership-Id": auth_membership.id}
    )
    trips = {t["id"]: t for t in response.json()}
    assert trips[trip.id]["next_item_title"] == "Still ahead"


def test_a_finished_trip_has_no_next_item(client: TestClient, api_session: Session):
    from datetime import timedelta

    user = _user(api_session, "Mia")
    trip, auth_membership = _trip_with_member(api_session, user)
    plan = Plan(trip_id=trip.id)
    api_session.add(plan)
    api_session.flush()
    api_session.add(
        PlanItem(
            plan_id=plan.id, day_index=1, day_date=date.today() - timedelta(days=5),
            start_hour=9.0, title="Long gone", place="Past",
        )
    )
    api_session.flush()

    response = client.get(
        "/api/trips", headers={"X-Membership-Id": auth_membership.id}
    )
    trips = {t["id"]: t for t in response.json()}
    assert trips[trip.id]["next_item_title"] is None


def test_a_guest_cannot_create_a_trip(client: TestClient, api_session: Session):
    """访客在这趟旅行里权利和别人一样，但不能自己开新旅行 —— 那是账户层面的事。"""
    user = _user(api_session, "Mia")
    trip, _ = _trip_with_member(api_session, user)
    guest = TripMembership(
        trip_id=trip.id, user_id=None, guest_display_name="Guest", status="joined",
    )
    api_session.add(guest)
    api_session.flush()

    response = client.post(
        "/api/trips",
        headers={"X-Membership-Id": guest.id},
        json={"name": "Sneaky trip", "destination": "Paris"},
    )
    assert response.status_code == 403


# ————————————————————— GET /api/me —————————————————————


def test_me_returns_the_role_of_this_trip_not_the_account(
    client: TestClient, api_session: Session
):
    """同一个人在 A 旅行是组织者、B 旅行是参与者 —— 答案取决于你在哪趟旅行里问。"""
    user = _user(api_session, "Mia Chen")
    _, organizer_here = _trip_with_member(
        api_session, user, name="Trip A", role="organizer"
    )
    _, participant_there = _trip_with_member(
        api_session, user, name="Trip B", role="participant"
    )

    a = client.get("/api/me", headers={"X-Membership-Id": organizer_here.id}).json()
    b = client.get("/api/me", headers={"X-Membership-Id": participant_there.id}).json()

    assert a["role"] == "organizer"
    assert b["role"] == "participant"
    assert a["id"] == b["id"] == user.id     # 同一个人
    assert a["name"] == b["name"] == "Mia Chen"
    assert a["initials"] == "MC"


def test_me_reports_a_guest_as_guest_with_no_email(
    client: TestClient, api_session: Session
):
    user = _user(api_session, "Mia Chen")
    trip, _ = _trip_with_member(api_session, user)
    guest = TripMembership(
        trip_id=trip.id,
        user_id=None,
        guest_display_name="Sam",
        role="participant",     # 就算 membership 上写着 participant
        status="joined",
    )
    api_session.add(guest)
    api_session.flush()

    body = client.get("/api/me", headers={"X-Membership-Id": guest.id}).json()

    assert body["role"] == "guest"      # 也要报成 guest —— 没账户就是访客
    assert body["is_guest"] is True
    assert body["name"] == "Sam"
    assert body["email"] is None
    assert body["id"] == guest.id       # 没账户时给一个稳定的 id


def test_me_needs_an_identity(client: TestClient):
    assert client.get("/api/me").status_code == 401

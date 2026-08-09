from __future__ import annotations

from datetime import date, timedelta
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session, sessionmaker

from app.api import main as api
from app.db.models import Plan, PlanChange, PlanItem, PlanItemComment, Preference, Trip, TripMembership, User


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


def _plan_item(db: Session, trip: Trip) -> tuple[Plan, PlanItem]:
    plan = Plan(trip_id=trip.id)
    db.add(plan)
    db.flush()
    item = PlanItem(
        plan_id=plan.id,
        day_index=1,
        day_date=date.today() + timedelta(days=30),
        start_hour=14.0,
        duration_min=90,
        title="Art Institute of Chicago",
        place="Michigan Avenue",
        settledness="loose",
    )
    db.add(item)
    db.flush()
    return plan, item


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
                day_date=date.today() + timedelta(days=2),
                start_hour=14.0,
                title="Later museum",
                place="Museum",
            ),
            PlanItem(
                plan_id=plan.id,
                day_index=1,
                # 相对今天算，不要写死日期 —— 写死的日期会随着时间流逝变成"过去"，
                # 被"只看未来"的过滤挡掉，测试某天就莫名其妙红了。
                day_date=date.today() + timedelta(days=1),
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


def test_creating_a_trip_returns_the_new_membership(client: TestClient, api_session: Session):
    """不返回它，前端就没法把身份切过去 —— 之后调这趟旅行的任何接口都会 403。"""
    user = _user(api_session, "Mia")
    _, auth = _trip_with_member(api_session, user)

    body = client.post(
        "/api/trips",
        headers={"X-Membership-Id": auth.id},
        json={"name": "Paris", "destination": "Paris"},
    ).json()

    assert body["membership_id"]
    assert body["membership_id"] != auth.id          # 是新 trip 里的那个
    membership = api_session.get(TripMembership, body["membership_id"])
    assert membership.trip_id == body["id"]
    assert membership.role == "organizer"


def test_an_identity_from_another_trip_is_refused_not_silently_answered(
    client: TestClient, api_session: Session
):
    """拿 A 旅行的身份去问 B 旅行的成员名单，必须 403。

    悄悄返回 A 的数据更糟 —— 用户以为在看 B，看到的是别人那趟的人数和进度。
    """
    user = _user(api_session, "Mia")
    trip_a, auth_a = _trip_with_member(api_session, user, name="Trip A")
    trip_b, _ = _trip_with_member(api_session, user, name="Trip B")

    ok = client.get(f"/api/trips/{trip_a.id}/members", headers={"X-Membership-Id": auth_a.id})
    wrong = client.get(f"/api/trips/{trip_b.id}/members", headers={"X-Membership-Id": auth_a.id})

    assert ok.status_code == 200
    assert wrong.status_code == 403


def test_item_comments_are_saved_and_read_back(
    client: TestClient, api_session: Session
):
    user = _user(api_session, "Mia Chen")
    trip, membership = _trip_with_member(api_session, user)
    _, item = _plan_item(api_session, trip)

    created = client.post(
        f"/api/plans/items/{item.id}/comments",
        headers={"X-Membership-Id": membership.id},
        json={"text": "Meet by the main entrance."},
    )
    assert created.status_code == 200
    assert api_session.query(PlanItemComment).count() == 1

    rows = client.get(
        f"/api/trips/{trip.id}/comments",
        headers={"X-Membership-Id": membership.id},
    ).json()
    assert rows[0]["plan_item_id"] == item.id
    assert rows[0]["text"] == "Meet by the main entrance."
    assert rows[0]["name"] == "Mia Chen"


def test_preference_dates_are_saved_and_read_back(
    client: TestClient, api_session: Session
):
    user = _user(api_session, "Mia")
    trip, membership = _trip_with_member(api_session, user)
    start = date.today() + timedelta(days=30)
    end = start + timedelta(days=3)

    saved = client.put(
        f"/api/trips/{trip.id}/preferences/me",
        headers={"X-Membership-Id": membership.id},
        json={
            "preferred_start_date": start.isoformat(),
            "preferred_end_date": end.isoformat(),
            "available_start_date": (start - timedelta(days=1)).isoformat(),
            "available_end_date": (end + timedelta(days=1)).isoformat(),
        },
    )
    assert saved.status_code == 200

    row = api_session.scalar(select(Preference).where(Preference.trip_membership_id == membership.id))
    assert row.preferred_start_date == start
    assert row.preferred_end_date == end
    assert row.available_start_date == start - timedelta(days=1)
    assert row.available_end_date == end + timedelta(days=1)

    body = client.get(
        f"/api/trips/{trip.id}/preferences/me",
        headers={"X-Membership-Id": membership.id},
    ).json()
    assert body["preference"]["preferred_start_date"] == start.isoformat()
    assert body["preference"]["available_end_date"] == (end + timedelta(days=1)).isoformat()


def test_marking_an_item_booked_and_unbooked_is_persistent(
    client: TestClient, api_session: Session
):
    user = _user(api_session, "Mia")
    trip, membership = _trip_with_member(api_session, user)
    _, item = _plan_item(api_session, trip)

    booked = client.patch(
        f"/api/plans/items/{item.id}/booking",
        headers={"X-Membership-Id": membership.id},
        json={"booked": True},
    )
    assert booked.status_code == 200
    api_session.refresh(item)
    assert item.settledness == "booked"
    assert booked.json()["settledness"] == "booked"

    unbooked = client.patch(
        f"/api/plans/items/{item.id}/booking",
        headers={"X-Membership-Id": membership.id},
        json={"booked": False},
    )
    assert unbooked.status_code == 200
    api_session.refresh(item)
    assert item.settledness == "settled"
    assert unbooked.json()["settledness"] == "settled"

    changes = api_session.scalars(
        select(PlanChange).where(PlanChange.plan_item_id == item.id)
    ).all()
    assert [change.patch["settledness"] for change in changes] == ["booked", "settled"]

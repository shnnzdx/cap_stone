from __future__ import annotations

from contextlib import contextmanager

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.api import main as api
from app.db.models import TripMembership, User
from app.domain import auth


@contextmanager
def _client(db: Session):
    api.app.dependency_overrides[api.get_session] = lambda: db
    try:
        with TestClient(api.app) as client:
            yield client
    finally:
        api.app.dependency_overrides.clear()


def test_login_returns_token_and_trip_membership(db: Session, full_trip: dict):
    user = db.get(User, full_trip["members"][0].user_id)
    user.email = "organizer@cadensy.local"
    user.password_hash = auth.hash_password("12345678")
    db.flush()

    with _client(db) as client:
        response = client.post(
            "/api/auth/login",
            json={"email": "organizer@cadensy.local", "password": "12345678"},
        )

    assert response.status_code == 200
    body = response.json()
    assert body["token"]
    assert body["default_membership"]["trip_id"] == full_trip["trip"].id
    assert body["default_membership"]["role"] == "organizer"


def test_bearer_token_uses_membership_for_requested_trip(db: Session, full_trip: dict):
    user = db.get(User, full_trip["members"][0].user_id)
    user.email = "organizer@cadensy.local"
    user.password_hash = auth.hash_password("12345678")
    other_trip = full_trip["trip"].__class__(
        name="Other trip",
        destination="New York",
        created_by_user_id=user.id,
    )
    db.add(other_trip)
    db.flush()
    other_membership = TripMembership(
        trip_id=other_trip.id,
        user_id=user.id,
        role="participant",
        join_method="invite_login",
        status="joined",
    )
    db.add(other_membership)
    db.flush()

    with _client(db) as client:
        login = client.post(
            "/api/auth/login",
            json={"email": "organizer@cadensy.local", "password": "12345678"},
        ).json()
        response = client.get(
            "/api/me",
            headers={
                "Authorization": f"Bearer {login['token']}",
                "X-Trip-Id": other_trip.id,
            },
        )

    assert response.status_code == 200
    assert response.json()["membership_id"] == other_membership.id
    assert response.json()["role"] == "participant"


def test_bad_password_is_rejected(db: Session, full_trip: dict):
    user = db.get(User, full_trip["members"][0].user_id)
    user.email = "organizer@cadensy.local"
    user.password_hash = auth.hash_password("12345678")
    db.flush()

    with _client(db) as client:
        response = client.post(
            "/api/auth/login",
            json={"email": "organizer@cadensy.local", "password": "wrong"},
        )

    assert response.status_code == 401

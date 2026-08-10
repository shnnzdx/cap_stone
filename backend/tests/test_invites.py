from __future__ import annotations

import hashlib
from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import func, select
from sqlalchemy.orm import Session, sessionmaker

from app.api import main as api
from app.db.models import (
    InviteLink,
    MemberConstraint,
    MemberConstraintPrivate,
    Plan,
    PlanItem,
    Preference,
    Trip,
    TripMembership,
    User,
)


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


def _user(db: Session, name: str, email: str | None = None) -> User:
    user = User(name=name, email=email or f"{name.lower()}-{uuid4().hex}@example.com")
    db.add(user)
    db.flush()
    return user


def _trip(db: Session) -> tuple[Trip, TripMembership, TripMembership]:
    organizer_user = _user(db, "Mia")
    participant_user = _user(db, "Sam")
    trip = Trip(
        name="Chicago birthday",
        destination="Chicago",
        preferred_start_date=datetime(2026, 8, 14).date(),
        preferred_end_date=datetime(2026, 8, 17).date(),
        created_by_user_id=organizer_user.id,
    )
    db.add(trip)
    db.flush()
    organizer = TripMembership(
        trip_id=trip.id,
        user_id=organizer_user.id,
        role="organizer",
        status="joined",
    )
    participant = TripMembership(
        trip_id=trip.id,
        user_id=participant_user.id,
        role="participant",
        status="joined",
    )
    db.add_all([organizer, participant])
    db.flush()
    return trip, organizer, participant


def _create_invite(client: TestClient, organizer: TripMembership, trip: Trip) -> dict:
    response = client.post(
        f"/api/trips/{trip.id}/invite",
        headers={"X-Membership-Id": organizer.id},
    )
    assert response.status_code == 200
    return response.json()


def test_opening_invite_does_not_create_membership(client: TestClient, api_session: Session):
    trip, organizer, _ = _trip(api_session)
    invite = _create_invite(client, organizer, trip)
    before = api_session.scalar(
        select(func.count()).select_from(TripMembership).where(TripMembership.trip_id == trip.id)
    )

    response = client.get(f"/api/invites/{invite['token']}")

    assert response.status_code == 200
    after = api_session.scalar(
        select(func.count()).select_from(TripMembership).where(TripMembership.trip_id == trip.id)
    )
    assert after == before


def test_invite_preview_excludes_plan_items_and_preferences(client: TestClient, api_session: Session):
    trip, organizer, _ = _trip(api_session)
    plan = Plan(trip_id=trip.id)
    api_session.add(plan)
    api_session.flush()
    api_session.add(
        PlanItem(
            plan_id=plan.id,
            day_index=1,
            day_date=datetime(2026, 8, 14).date(),
            start_hour=10,
            title="Art Institute of Chicago",
            place="Michigan Avenue",
        )
    )
    constraint = MemberConstraint(
        trip_membership_id=organizer.id,
        kind="time_window",
        importance="required",
        params={"earliest_hour": 9.0},
    )
    api_session.add(constraint)
    api_session.flush()
    api_session.add(
        MemberConstraintPrivate(
            constraint_id=constraint.id,
            original_text="Do not leak this preference",
            visibility="planning_only",
        )
    )
    invite = _create_invite(client, organizer, trip)

    body = client.get(f"/api/invites/{invite['token']}").json()

    assert body == {
        "name": "Chicago birthday",
        "destination": "Chicago",
        "preferred_start_date": "2026-08-14",
        "preferred_end_date": "2026-08-17",
        "member_count": 2,
        "organizer_name": "Mia",
    }
    assert "Art Institute" not in str(body)
    assert "preference" not in str(body).lower()


def test_plain_invite_token_is_never_stored(client: TestClient, api_session: Session):
    trip, organizer, _ = _trip(api_session)
    invite = _create_invite(client, organizer, trip)

    saved = api_session.scalar(select(InviteLink).where(InviteLink.id == invite["invite_id"]))

    assert saved.token_hash != invite["token"]
    assert saved.token_hash == hashlib.sha256(invite["token"].encode("utf-8")).hexdigest()


def test_revoked_invite_returns_404(client: TestClient, api_session: Session):
    trip, organizer, _ = _trip(api_session)
    invite = _create_invite(client, organizer, trip)

    revoke = client.post(
        f"/api/invites/{invite['invite_id']}/revoke",
        headers={"X-Membership-Id": organizer.id},
    )
    assert revoke.status_code == 200

    assert client.get(f"/api/invites/{invite['token']}").status_code == 404
    assert client.post(
        f"/api/invites/{invite['token']}/join",
        json={"display_name": "Lee"},
    ).status_code == 404


def test_expired_invite_returns_404(client: TestClient, api_session: Session):
    trip, organizer, _ = _trip(api_session)
    invite = _create_invite(client, organizer, trip)
    saved = api_session.scalar(select(InviteLink).where(InviteLink.id == invite["invite_id"]))
    saved.expires_at = datetime.now(timezone.utc) - timedelta(minutes=1)
    api_session.flush()

    assert client.get(f"/api/invites/{invite['token']}").status_code == 404


def test_guest_join_creates_participant_without_user(client: TestClient, api_session: Session):
    trip, organizer, _ = _trip(api_session)
    invite = _create_invite(client, organizer, trip)

    response = client.post(
        f"/api/invites/{invite['token']}/join",
        json={"display_name": "Guest Lee"},
    )

    assert response.status_code == 200
    body = response.json()
    membership = api_session.get(TripMembership, body["membership_id"])
    assert body == {"membership_id": membership.id, "trip_id": trip.id, "role": "participant"}
    assert membership.user_id is None
    assert membership.guest_display_name == "Guest Lee"
    assert membership.role == "participant"
    assert membership.join_method == "invite_guest"


def test_guest_join_returns_existing_membership_on_repeat(client: TestClient, api_session: Session):
    trip, organizer, _ = _trip(api_session)
    invite = _create_invite(client, organizer, trip)

    first = client.post(
        f"/api/invites/{invite['token']}/join",
        json={"display_name": "Guest Lee"},
    ).json()
    second = client.post(
        f"/api/invites/{invite['token']}/join",
        json={"display_name": " guest lee "},
    ).json()

    memberships = api_session.scalars(
        select(TripMembership).where(
            TripMembership.trip_id == trip.id,
            TripMembership.user_id.is_(None),
            TripMembership.join_method == "invite_guest",
        )
    ).all()
    assert second["membership_id"] == first["membership_id"]
    assert len(memberships) == 1


def test_account_join_reuses_existing_user(client: TestClient, api_session: Session):
    trip, organizer, _ = _trip(api_session)
    existing_user = _user(api_session, "Alex", email="alex@example.com")
    invite = _create_invite(client, organizer, trip)
    before = api_session.scalar(select(func.count()).select_from(User))

    response = client.post(
        f"/api/invites/{invite['token']}/join",
        json={"display_name": "Alex New", "email": "Alex@Example.com"},
    )

    assert response.status_code == 200
    membership = api_session.get(TripMembership, response.json()["membership_id"])
    after = api_session.scalar(select(func.count()).select_from(User))
    assert after == before
    assert membership.user_id == existing_user.id
    assert membership.role == "participant"
    assert membership.join_method == "invite_login"


def test_account_join_returns_existing_membership_on_repeat(client: TestClient, api_session: Session):
    trip, organizer, _ = _trip(api_session)
    invite = _create_invite(client, organizer, trip)

    first = client.post(
        f"/api/invites/{invite['token']}/join",
        json={"display_name": "Alex", "email": "alex-repeat@example.com"},
    ).json()
    second = client.post(
        f"/api/invites/{invite['token']}/join",
        json={"display_name": "Alex", "email": "alex-repeat@example.com"},
    ).json()

    assert second["membership_id"] == first["membership_id"]


def test_non_organizer_cannot_create_invite(client: TestClient, api_session: Session):
    trip, _, participant = _trip(api_session)

    response = client.post(
        f"/api/trips/{trip.id}/invite",
        headers={"X-Membership-Id": participant.id},
    )

    assert response.status_code == 403


def test_trip_summary_exposes_active_invite_and_onboarding_status(
    client: TestClient, api_session: Session
):
    trip, organizer, _ = _trip(api_session)
    invite = _create_invite(client, organizer, trip)

    response = client.get(f"/api/trips/{trip.id}")

    assert response.status_code == 200
    body = response.json()
    assert body["active_invite"] == {
        "id": invite["invite_id"],
        "invite_id": invite["invite_id"],
        "status": "active",
        "expires_at": None,
    }
    assert body["organizer_preference"]["status"] == "missing"
    assert body["planning_readiness"] == {
        "can_generate_itinerary": False,
        "blocking_reasons": ["organizer_preference_missing"],
        "next_action": "fill_organizer_preferences",
    }


def test_trip_summary_hides_revoked_invite(client: TestClient, api_session: Session):
    trip, organizer, _ = _trip(api_session)
    invite = _create_invite(client, organizer, trip)

    revoke = client.post(
        f"/api/invites/{invite['invite_id']}/revoke",
        headers={"X-Membership-Id": organizer.id},
    )
    assert revoke.status_code == 200

    body = client.get(f"/api/trips/{trip.id}").json()

    assert body["active_invite"] is None


def test_trip_summary_marks_organizer_preferences_complete(
    client: TestClient, api_session: Session
):
    trip, organizer, _ = _trip(api_session)
    organizer.status = "preferences_submitted"
    api_session.add(
        Preference(
            trip_membership_id=organizer.id,
            preferred_start_date=trip.preferred_start_date,
            preferred_end_date=trip.preferred_end_date,
            available_start_date=trip.preferred_start_date,
            available_end_date=trip.preferred_end_date,
            ideal_budget=500,
            maximum_budget=650,
            travel_style="Relaxed",
            top_interests=["Food"],
            submitted_at=datetime.now(timezone.utc),
        )
    )
    api_session.flush()

    body = client.get(f"/api/trips/{trip.id}").json()

    assert body["organizer_preference"]["status"] == "complete"
    assert body["planning_readiness"]["can_generate_itinerary"] is True

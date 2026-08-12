from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest

from app.db.models import (
    ChangeProposal,
    DecisionRound,
    InviteLink,
    Plan,
    PlanItem,
    Trip,
    TripMembership,
    UpdateNotice,
    User,
)
from app.domain.access import (
    ForeignTripAccess,
    ScopedResourceNotFound,
    TripScope,
    for_membership,
)


def _seed_trip(db, label: str) -> dict:
    user = User(name=label, email=f"{label.lower()}-{uuid4().hex}@example.com")
    db.add(user)
    db.flush()

    trip = Trip(name=f"{label} trip", destination="Chicago", created_by_user_id=user.id)
    db.add(trip)
    db.flush()

    membership = TripMembership(
        trip_id=trip.id,
        user_id=user.id,
        role="organizer",
        status="joined",
    )
    teammate = TripMembership(
        trip_id=trip.id,
        user_id=None,
        guest_display_name=f"{label} guest",
        role="participant",
        status="joined",
    )
    db.add_all([membership, teammate])
    db.flush()

    plan = Plan(trip_id=trip.id)
    db.add(plan)
    db.flush()

    item = PlanItem(
        plan_id=plan.id,
        day_index=1,
        day_date=datetime(2026, 8, 20).date(),
        start_hour=10.0,
        duration_min=90,
        title=f"{label} museum",
        place="Loop",
    )
    db.add(item)
    db.flush()

    notice = UpdateNotice(
        trip_id=trip.id,
        plan_item_id=item.id,
        kind="round",
        recipient_membership_id=None,
        title=f"{label} notice",
        body="Heads up",
        can_object=True,
    )
    round_ = DecisionRound(
        plan_item_id=item.id,
        options=[{"id": "keep", "label": "Keep it"}],
        deadline=datetime.now(timezone.utc) + timedelta(hours=2),
        status="open",
    )
    proposal = ChangeProposal(
        plan_item_id=item.id,
        action_type="edit",
        before_json={"title": item.title},
        after_json={"title": f"{label} dinner"},
        requested_by_membership_id=membership.id,
        deadline=datetime.now(timezone.utc) + timedelta(hours=2),
    )
    invite = InviteLink(
        trip_id=trip.id,
        token_hash=f"hash-{uuid4().hex}",
        is_primary=True,
    )
    db.add_all([notice, round_, proposal, invite])
    db.flush()

    return {
        "trip": trip,
        "membership": membership,
        "teammate": teammate,
        "plan": plan,
        "item": item,
        "notice": notice,
        "round": round_,
        "proposal": proposal,
        "invite": invite,
    }


@pytest.fixture
def scoped_trips(db):
    home = _seed_trip(db, "Home")
    foreign = _seed_trip(db, "Foreign")
    return {"home": home, "foreign": foreign}


def test_for_membership_builds_trip_scope(db, scoped_trips):
    scope = for_membership(db, scoped_trips["home"]["membership"])

    assert isinstance(scope, TripScope)
    assert scope.db is db
    assert scope.membership.id == scoped_trips["home"]["membership"].id


def test_require_trip_returns_authorized_trip(db, scoped_trips):
    scope = for_membership(db, scoped_trips["home"]["membership"])

    trip = scope.require_trip(scoped_trips["home"]["trip"].id)

    assert trip.id == scoped_trips["home"]["trip"].id


def test_require_trip_rejects_foreign_path_before_existence_lookup(db, scoped_trips):
    scope = for_membership(db, scoped_trips["home"]["membership"])

    with pytest.raises(ForeignTripAccess):
        scope.require_trip(scoped_trips["foreign"]["trip"].id)

    with pytest.raises(ForeignTripAccess):
        scope.require_trip("trip-that-does-not-belong-to-the-membership")


def test_require_trip_404s_only_when_authorized_trip_is_missing(db):
    membership = TripMembership(id="scoped-member", trip_id="missing-trip")
    scope = for_membership(db, membership)

    with pytest.raises(ScopedResourceNotFound):
        scope.require_trip("missing-trip")


@pytest.mark.parametrize(
    ("loader_name", "resource_key"),
    [
        ("require_plan", "plan"),
        ("require_plan_item", "item"),
        ("require_notice", "notice"),
        ("require_round", "round"),
        ("require_proposal", "proposal"),
        ("require_invite", "invite"),
    ],
)
def test_opaque_loaders_return_resources_in_scope(db, scoped_trips, loader_name, resource_key):
    scope = for_membership(db, scoped_trips["home"]["membership"])
    resource = scoped_trips["home"][resource_key]

    loaded = getattr(scope, loader_name)(resource.id)

    assert loaded.id == resource.id


@pytest.mark.parametrize(
    ("loader_name", "resource_key"),
    [
        ("require_plan", "plan"),
        ("require_plan_item", "item"),
        ("require_notice", "notice"),
        ("require_round", "round"),
        ("require_proposal", "proposal"),
        ("require_invite", "invite"),
    ],
)
def test_opaque_loaders_hide_foreign_resources_as_not_found(
    db, scoped_trips, loader_name, resource_key
):
    scope = for_membership(db, scoped_trips["home"]["membership"])
    resource = scoped_trips["foreign"][resource_key]

    with pytest.raises(ScopedResourceNotFound):
        getattr(scope, loader_name)(resource.id)


@pytest.mark.parametrize(
    "loader_name",
    [
        "require_plan",
        "require_plan_item",
        "require_notice",
        "require_round",
        "require_proposal",
        "require_invite",
    ],
)
def test_opaque_loaders_404_when_resource_is_missing(db, scoped_trips, loader_name):
    scope = for_membership(db, scoped_trips["home"]["membership"])

    with pytest.raises(ScopedResourceNotFound):
        getattr(scope, loader_name)(f"missing-{loader_name}")


def test_require_membership_in_trip_returns_member_in_authorized_trip(db, scoped_trips):
    scope = for_membership(db, scoped_trips["home"]["membership"])

    membership = scope.require_membership_in_trip(
        scoped_trips["home"]["teammate"].id,
        scoped_trips["home"]["trip"].id,
    )

    assert membership.id == scoped_trips["home"]["teammate"].id


def test_require_membership_in_trip_rejects_foreign_explicit_trip(db, scoped_trips):
    scope = for_membership(db, scoped_trips["home"]["membership"])

    with pytest.raises(ForeignTripAccess):
        scope.require_membership_in_trip(
            scoped_trips["foreign"]["teammate"].id,
            scoped_trips["foreign"]["trip"].id,
        )


def test_require_membership_in_trip_404s_foreign_nested_membership_in_authorized_trip(
    db, scoped_trips
):
    scope = for_membership(db, scoped_trips["home"]["membership"])

    with pytest.raises(ScopedResourceNotFound):
        scope.require_membership_in_trip(
            scoped_trips["foreign"]["teammate"].id,
            scoped_trips["home"]["trip"].id,
        )


def test_require_membership_in_trip_404s_missing_nested_membership(db, scoped_trips):
    scope = for_membership(db, scoped_trips["home"]["membership"])

    with pytest.raises(ScopedResourceNotFound):
        scope.require_membership_in_trip(
            "missing-membership",
            scoped_trips["home"]["trip"].id,
        )

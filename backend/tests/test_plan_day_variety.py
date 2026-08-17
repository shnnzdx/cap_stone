from __future__ import annotations

from datetime import date, timedelta
from uuid import uuid4

import pytest
from sqlalchemy.orm import Session

from app.db.models import MemberConstraint, Plan, Trip, TripMembership, User
from app.domain.plans import generator
from app.domain.places.service import PlannerPlace
from app.domain.preferences import service as pref


def _default_solo_places() -> tuple[PlannerPlace, ...]:
    rows = []
    for index in range(18):
        rows.append(
            PlannerPlace(
                candidate_id=f"solo-sight-{index}",
                name=f"Solo Attraction {index}",
                location="Chicago",
                latitude=41.80 + index / 500,
                longitude=-87.60 - index / 500,
                category="tourism.attraction",
                address="Chicago",
                image_url=None,
                opening_hours=None,
                price=12.0,
                duration_min=90,
                opens=9.0,
                closes=21.5,
                tags=("tourism", "attraction"),
            )
        )
    for index in range(10):
        rows.append(
            PlannerPlace(
                candidate_id=f"solo-meal-{index}",
                name=f"Solo Restaurant {index}",
                location="Chicago",
                latitude=41.805 + index / 700,
                longitude=-87.605 - index / 700,
                category="catering.restaurant",
                address="Chicago",
                image_url=None,
                opening_hours=None,
                price=14.0,
                duration_min=60,
                opens=11.0,
                closes=22.0,
                tags=("catering", "restaurant"),
            )
        )
    return tuple(rows)


@pytest.fixture(autouse=True)
def default_places_for_solo_trip(monkeypatch):
    monkeypatch.setattr(
        generator.place_service,
        "places_for_planner",
        lambda *_args: _default_solo_places(),
    )


def _solo_trip(db: Session, *, days: int) -> dict:
    """A single-member trip with no budget ceiling.

    This is the shape every manual test run has, and it is the shape no other
    test in the suite covers: with one member the generator skips budget
    ceilings, which turns on allow_reuse_across_days.
    """
    stamp = uuid4().hex
    organizer_user = User(name="Solo", email=f"solo-{stamp}@example.com")
    db.add(organizer_user)
    db.flush()

    start = date.today() + timedelta(days=30)
    trip = Trip(
        name="Chicago solo",
        destination="Chicago",
        preferred_start_date=start,
        preferred_end_date=start + timedelta(days=days - 1),
        currency="USD",
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
    db.add(organizer)
    db.flush()

    db.add(Plan(trip_id=trip.id))
    db.flush()

    pref.save_mine(
        db,
        organizer,
        pref.PreferenceData(
            preferred_start_date=trip.preferred_start_date,
            preferred_end_date=trip.preferred_end_date,
            available_start_date=trip.preferred_start_date,
            available_end_date=trip.preferred_end_date,
            ideal_budget=100.0,
            maximum_budget=150.0,
            top_interests=("culture", "food"),
        ),
    )
    db.add(
        MemberConstraint(
            trip_membership_id=organizer.id,
            kind="time_window",
            importance="required",
            params={"earliest_hour": 9.0, "latest_hour": 23.5},
        )
    )
    db.flush()
    return {"trip": trip, "organizer": organizer}


def test_solo_trip_days_are_not_carbon_copies_of_each_other(db: Session):
    setup = _solo_trip(db, days=4)

    result = generator.generate_plan(db, setup["trip"].id, setup["organizer"])

    assert result.status == "active"
    titles_by_day = {
        day_index: tuple(
            sorted(item.title for item in result.items if item.day_index == day_index)
        )
        for day_index in (1, 2, 3, 4)
    }
    assert len(set(titles_by_day.values())) == len(titles_by_day), (
        "days repeated the same places verbatim: "
        f"{ {day: titles for day, titles in titles_by_day.items()} }"
    )

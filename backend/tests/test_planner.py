from __future__ import annotations

from datetime import date, timedelta

import pytest

from app.agents import planner


@pytest.mark.parametrize("day_count", [2, 3, 5, 6])
def test_fallback_covers_the_inclusive_trip_dates(monkeypatch, day_count: int):
    monkeypatch.setenv("MOCK_AI", "1")
    start = date(2026, 8, 19)
    trip_dates = tuple(start + timedelta(days=offset) for offset in range(day_count))

    draft = planner.draft_itinerary(
        planner.PlannerInput(destination="Chicago", trip_dates=trip_dates)
    )

    assert draft.used_ai is False
    assert tuple(day.day_date for day in draft.days) == trip_dates
    assert tuple(day.day_index for day in draft.days) == tuple(range(1, day_count + 1))
    titles = [stop.title for day in draft.days for stop in day.stops]
    assert len(titles) == len(set(titles))
    assert all(1 <= len(day.stops) <= 4 for day in draft.days)


def test_six_day_fallback_does_not_force_two_activities_per_day(monkeypatch):
    monkeypatch.setenv("MOCK_AI", "1")
    start = date(2026, 8, 19)
    trip_dates = tuple(start + timedelta(days=offset) for offset in range(6))

    draft = planner.draft_itinerary(
        planner.PlannerInput(destination="Chicago", trip_dates=trip_dates)
    )

    assert [len(day.stops) for day in draft.days] == [2, 3, 2, 3, 2, 1]


def test_real_planner_repairs_a_uniform_activity_count_once(monkeypatch):
    monkeypatch.setenv("MOCK_AI", "0")
    start = date(2026, 8, 19)
    trip_dates = tuple(start + timedelta(days=offset) for offset in range(4))
    responses = iter(
        [
            {
                "note": "uniform",
                "days": [
                    {
                        "day_index": index,
                        "date": day.isoformat(),
                        "stops": [{"title": planner.POI_TITLES[index - 1]}],
                    }
                    for index, day in enumerate(trip_dates, start=1)
                ],
            },
            {
                "note": "repaired",
                "days": [
                    {
                        "day_index": 1,
                        "date": trip_dates[0].isoformat(),
                        "stops": [{"title": "Millennium Park & Cloud Gate"}],
                    },
                    {
                        "day_index": 2,
                        "date": trip_dates[1].isoformat(),
                        "stops": [
                            {"title": "Chicago Cultural Center"},
                            {"title": "Chicago Riverwalk"},
                        ],
                    },
                    {
                        "day_index": 3,
                        "date": trip_dates[2].isoformat(),
                        "stops": [{"title": "Lincoln Park Zoo"}],
                    },
                    {
                        "day_index": 4,
                        "date": trip_dates[3].isoformat(),
                        "stops": [{"title": "Girl & the Goat"}],
                    },
                ],
            },
        ]
    )
    calls = []

    def fake_call_model(**kwargs):
        calls.append(kwargs)
        return next(responses)

    monkeypatch.setattr(planner.base, "call_model", fake_call_model)

    draft = planner.draft_itinerary(
        planner.PlannerInput(destination="Chicago", trip_dates=trip_dates)
    )

    assert draft.used_ai is True
    assert len(calls) == 2
    assert [len(day.stops) for day in draft.days] == [1, 2, 1, 1]

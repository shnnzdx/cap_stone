from __future__ import annotations

import pytest

from app.agents import base, planner


def _day_payload() -> planner.PlanDayInput:
    return planner.PlanDayInput(
        day_index=1,
        candidates=(
            planner.PoiOption(
                name="Millennium Park & Cloud Gate",
                place="Loop",
                price=0.0,
                duration_min=90,
                opens=9.0,
                closes=20.0,
                tags=("culture",),
            ),
            planner.PoiOption(
                name="Chicago Cultural Center",
                place="Loop",
                price=0.0,
                duration_min=90,
                opens=10.0,
                closes=18.0,
                tags=("culture",),
            ),
            planner.PoiOption(
                name="Girl & the Goat",
                place="West Loop",
                price=45.0,
                duration_min=120,
                opens=16.0,
                closes=22.0,
                tags=("food",),
            ),
        ),
        already_used=("Art Institute of Chicago",),
        budget_left=120.0,
        interests=("culture", "food"),
    )


def test_plan_day_accepts_valid_ai_output_and_preserves_day_metadata(monkeypatch):
    monkeypatch.setenv("MOCK_AI", "0")

    def fake_call_model(**kwargs):
        return {
            "note": "Balanced art-first day with dinner in the evening.",
            "picks": [
                {"poi_name": "Millennium Park & Cloud Gate", "start_hour": 10.0},
                {"poi_name": "Chicago Cultural Center", "start_hour": 14.0},
                {"poi_name": "Girl & the Goat", "start_hour": 19.0},
            ],
        }

    monkeypatch.setattr(planner.base, "call_model", fake_call_model)

    result = planner.plan_day(_day_payload())

    assert result.used_ai is True
    assert result.planner_note == "Balanced art-first day with dinner in the evening."
    assert result.picks == (
        planner.Pick(poi_name="Millennium Park & Cloud Gate", start_hour=10.0),
        planner.Pick(poi_name="Chicago Cultural Center", start_hour=14.0),
        planner.Pick(poi_name="Girl & the Goat", start_hour=19.0),
    )


def test_plan_day_retries_once_after_invalid_ai_output_and_accepts_repaired_result(
    monkeypatch,
):
    monkeypatch.setenv("MOCK_AI", "0")
    responses = iter(
        [
            {
                "note": "bad first pass",
                "picks": [
                    {"poi_name": "Imaginary Rooftop", "start_hour": 10.0},
                    {"poi_name": "Chicago Cultural Center", "start_hour": 14.0},
                    {"poi_name": "Girl & the Goat", "start_hour": 19.0},
                ],
            },
            {
                "note": "Repaired to use only provided candidates.",
                "picks": [
                    {"poi_name": "Millennium Park & Cloud Gate", "start_hour": 10.0},
                    {"poi_name": "Chicago Cultural Center", "start_hour": 14.0},
                    {"poi_name": "Girl & the Goat", "start_hour": 19.0},
                ],
            },
        ]
    )
    calls = []

    def fake_call_model(**kwargs):
        calls.append(kwargs)
        return next(responses)

    monkeypatch.setattr(planner.base, "call_model", fake_call_model)

    result = planner.plan_day(_day_payload())

    assert result.used_ai is True
    assert result.planner_note == "Repaired to use only provided candidates."
    assert len(calls) == 2
    assert "The previous day plan failed deterministic validation" in calls[1]["user"]
    assert {
        pick.poi_name for pick in result.picks
    } <= {candidate.name for candidate in _day_payload().candidates}


def test_plan_day_raises_unusable_after_second_invalid_ai_output(monkeypatch):
    monkeypatch.setenv("MOCK_AI", "0")
    responses = iter(
        [
            {
                "note": "bad first pass",
                "picks": [{"poi_name": "Imaginary Rooftop", "start_hour": 10.0}],
            },
            {
                "note": "still bad",
                "picks": [{"poi_name": "Still Imaginary", "start_hour": 14.0}],
            },
        ]
    )
    calls = []

    def fake_call_model(**kwargs):
        calls.append(kwargs)
        return next(responses)

    monkeypatch.setattr(planner.base, "call_model", fake_call_model)

    with pytest.raises(planner.PlannerDayUnusable):
        planner.plan_day(_day_payload())

    assert len(calls) == 2


def test_mocked_plan_day_accepted_output_never_sets_used_ai(monkeypatch):
    monkeypatch.setenv("MOCK_AI", "1")
    monkeypatch.setattr(
        planner,
        "MOCK",
        {
            "note": "Mock planner day.",
            "picks": [
                {"poi_name": "Millennium Park & Cloud Gate", "start_hour": 10.0},
            ],
        },
    )

    result = planner.plan_day(_day_payload())

    assert result.used_ai is False
    assert result.planner_note == "Mock planner day."


def test_plan_day_propagates_model_unavailable_without_retry(monkeypatch):
    monkeypatch.setenv("MOCK_AI", "0")
    calls = []

    def fake_call_model(**kwargs):
        calls.append(kwargs)
        raise base.AgentUnavailable("planner offline")

    monkeypatch.setattr(planner.base, "call_model", fake_call_model)

    with pytest.raises(base.AgentUnavailable):
        planner.plan_day(_day_payload())

    assert len(calls) == 1

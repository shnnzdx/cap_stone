from __future__ import annotations

import pytest

from app.agents import base, planner


def _day_payload() -> planner.PlanDayInput:
    return planner.PlanDayInput(
        day_index=1,
        candidates=(
            planner.PoiOption(
                candidate_id="poi_park",
                name="Millennium Park & Cloud Gate",
                local_name=None,
                place="Loop",
                category="tourism.attraction",
                latitude=41.8826,
                longitude=-87.6226,
                opening_hours="Mo-Su 09:00-20:00",
                price=0.0,
                duration_min=90,
                opens=9.0,
                closes=20.0,
                tags=("culture",),
            ),
            planner.PoiOption(
                candidate_id="poi_cultural_center",
                name="Chicago Cultural Center",
                local_name=None,
                place="Loop",
                category="entertainment.culture",
                latitude=41.8837,
                longitude=-87.625,
                opening_hours="Mo-Su 10:00-18:00",
                price=0.0,
                duration_min=90,
                opens=10.0,
                closes=18.0,
                tags=("culture",),
            ),
            planner.PoiOption(
                candidate_id="poi_restaurant",
                name="Girl & the Goat",
                local_name=None,
                place="West Loop",
                category="catering.restaurant",
                latitude=41.8844,
                longitude=-87.6486,
                opening_hours="Mo-Su 11:00-22:00",
                price=45.0,
                duration_min=120,
                opens=11.0,
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
                {"candidate_id": "poi_park", "start_hour": 10.0},
                {"candidate_id": "poi_cultural_center", "start_hour": 14.0},
                {"candidate_id": "poi_restaurant", "start_hour": 19.0},
            ],
        }

    monkeypatch.setattr(planner.base, "call_model", fake_call_model)

    result = planner.plan_day(_day_payload())

    assert result.used_ai is True
    assert result.planner_note == "Balanced art-first day with dinner in the evening."
    assert result.picks == (
        planner.Pick(candidate_id="poi_park", start_hour=10.0),
        planner.Pick(candidate_id="poi_cultural_center", start_hour=14.0),
        planner.Pick(candidate_id="poi_restaurant", start_hour=19.0),
    )


def test_day_prompt_exposes_activity_count_as_a_soft_target():
    payload = _day_payload()

    prompt = planner._day_prompt(payload)

    assert "Soft target for this day: 3 sightseeing activities" in prompt
    assert "never fail the day merely to hit this target" in prompt
    assert "Decision priority, highest first" in prompt
    assert "Lunch is added separately in the 11.5-14.0 window" in prompt
    assert "dinner in the 17.5-20.0 window" in prompt
    assert "candidate_id" in prompt
    assert "do not return any name field" in prompt
    assert "legal_start_hours" in prompt


def test_day_schema_returns_candidate_id_without_place_names():
    pick_properties = planner._day_schema()["properties"]["picks"]["items"]["properties"]

    assert set(pick_properties) == {"candidate_id", "start_hour"}


def test_parser_rejects_model_returned_place_name_fields():
    with pytest.raises(planner.PlannerDayInvalid, match="only candidate_id and start_hour"):
        planner._parse_day_result(
            {
                "note": "Invalid attempt to rewrite a canonical name.",
                "picks": [
                    {
                        "candidate_id": "poi_park",
                        "start_hour": 10.0,
                        "english_name": "Rewritten Park Name",
                    },
                    {"candidate_id": "poi_cultural_center", "start_hour": 14.0},
                ],
            },
            payload=_day_payload(),
            used_ai=True,
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
                    {"candidate_id": "invented_id", "start_hour": 10.0},
                    {"candidate_id": "poi_cultural_center", "start_hour": 14.0},
                    {"candidate_id": "poi_restaurant", "start_hour": 19.0},
                ],
            },
            {
                "note": "Repaired to use only provided candidates.",
                "picks": [
                    {"candidate_id": "poi_park", "start_hour": 10.0},
                    {"candidate_id": "poi_cultural_center", "start_hour": 14.0},
                    {"candidate_id": "poi_restaurant", "start_hour": 19.0},
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
    assert "legal_start_hours" in calls[1]["user"]
    assert {
        pick.candidate_id for pick in result.picks
    } <= {candidate.candidate_id for candidate in _day_payload().candidates}


def test_candidate_legal_start_hours_respect_open_close_and_window_rules():
    park, cultural_center, restaurant = _day_payload().candidates

    assert 9.0 in planner._candidate_legal_start_hours(park)
    assert 20.25 not in planner._candidate_legal_start_hours(park)

    assert 9.0 not in planner._candidate_legal_start_hours(cultural_center)
    assert 10.0 in planner._candidate_legal_start_hours(cultural_center)

    assert 11.5 in planner._candidate_legal_start_hours(restaurant)
    assert 15.0 not in planner._candidate_legal_start_hours(restaurant)


def test_plan_day_raises_unusable_after_second_invalid_ai_output(monkeypatch):
    monkeypatch.setenv("MOCK_AI", "0")
    responses = iter(
        [
            {
                "note": "bad first pass",
                "picks": [{"candidate_id": "invented_id", "start_hour": 10.0}],
            },
            {
                "note": "still bad",
                "picks": [{"candidate_id": "still_invented", "start_hour": 14.0}],
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
                {"candidate_id": "poi_park", "start_hour": 10.0},
                {"candidate_id": "poi_cultural_center", "start_hour": 14.0},
            ],
        },
    )

    result = planner.plan_day(_day_payload())

    assert result.used_ai is False
    assert result.planner_note == "Mock planner day."


def test_plan_day_accepts_natural_lunch_time_for_food(monkeypatch):
    monkeypatch.setenv("MOCK_AI", "0")
    monkeypatch.setattr(
        planner.base,
        "call_model",
        lambda **_kwargs: {
            "note": "Morning landmark, lunch, and a later cultural stop.",
            "picks": [
                {"candidate_id": "poi_park", "start_hour": 9.5},
                {"candidate_id": "poi_restaurant", "start_hour": 12.25},
                {"candidate_id": "poi_cultural_center", "start_hour": 15.25},
            ],
        },
    )

    result = planner.plan_day(_day_payload())

    assert [pick.start_hour for pick in result.picks] == [9.5, 12.25, 15.25]


def test_plan_day_rejects_food_in_afternoon_attraction_window(monkeypatch):
    monkeypatch.setenv("MOCK_AI", "0")
    monkeypatch.setattr(
        planner.base,
        "call_model",
        lambda **_kwargs: {
            "note": "Invalid food placement.",
            "picks": [
                {"candidate_id": "poi_park", "start_hour": 9.5},
                {"candidate_id": "poi_restaurant", "start_hour": 15.0},
            ],
        },
    )

    with pytest.raises(planner.PlannerDayUnusable, match="not suitable for the afternoon"):
        planner.plan_day(_day_payload())


def test_evening_window_requires_explicit_evening_suitability():
    assert planner.category_allows_window(("tourism", "views", "sunset"), "evening")
    assert planner.category_allows_window(("entertainment", "music"), "evening")
    assert not planner.category_allows_window(("tourism", "museum"), "evening")


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

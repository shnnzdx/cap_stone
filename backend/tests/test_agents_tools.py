from __future__ import annotations

import json
from datetime import date

from app.agents.base import AgentProviderReply, AgentToolCall, call_agent
from app.agents.tools import build_read_only_trip_tools
from app.db.models import (
    ChangeProposal,
    DecisionRound,
    Plan,
    PlanChange,
    PlanItem,
    ProposalDecision,
    UpdateNotice,
    Vote,
)


def _tools_by_name(db, full_trip):
    tools = build_read_only_trip_tools(
        db,
        trip_id=full_trip["trip"].id,
        actor_membership_id=full_trip["me"].id,
    )
    return {tool.name: tool for tool in tools}


def _json_text(value) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True)


def _write_counts(db) -> dict[str, int]:
    return {
        "plan": db.query(Plan).count(),
        "plan_item": db.query(PlanItem).count(),
        "plan_change": db.query(PlanChange).count(),
        "decision_round": db.query(DecisionRound).count(),
        "change_proposal": db.query(ChangeProposal).count(),
        "proposal_decision": db.query(ProposalDecision).count(),
        "vote": db.query(Vote).count(),
        "update_notice": db.query(UpdateNotice).count(),
    }


def test_read_only_trip_tools_return_normal_results(db, full_trip):
    tools = _tools_by_name(db, full_trip)

    plan = tools["get_current_plan"].handler(day="all")
    facts = tools["get_trip_facts"].handler()
    classification = tools["classify_change"].handler(
        item_title="Art Institute of Chicago",
        new_start_hour=8.0,
        day="all",
    )

    assert plan["days"][0]["items"][0]["title"] == "Art Institute of Chicago"
    assert facts["destination"] == "Chicago"
    assert facts["member_count"] == 6
    assert classification["classification"]["path"] == "confirm"
    assert classification["classification"]["findings"][0]["affected_count"] == 1


def test_tool_outputs_do_not_expose_member_identity_or_private_preference_text(db, full_trip):
    """Privacy red line: model-visible tool output must stay anonymized."""
    tools = _tools_by_name(db, full_trip)
    outputs = [
        tools["get_current_plan"].handler(day="all"),
        tools["get_trip_facts"].handler(),
        tools["classify_change"].handler(
            item_title="Art Institute of Chicago",
            new_start_hour=8.0,
            day="all",
        ),
        tools["propose_options"].handler(
            conflict_description="Wednesday feels too crowded.",
            day="all",
        ),
    ]
    combined = _json_text(outputs)

    forbidden = {
        full_trip["me"].id,
        full_trip["members"][0].id,
        "M0",
        "Mia",
        "No activities before 9:00 AM",
        "membership_id",
        "trip_membership_id",
        "original_text",
        "private",
    }
    leaked = [value for value in forbidden if value in combined]
    assert leaked == []


def test_classify_change_guard_rejects_until_current_plan_was_checked(db, full_trip):
    tools = tuple(_tools_by_name(db, full_trip).values())
    result = call_agent(
        system="Use tools.",
        user="Can we move the museum to 8?",
        tools=tools,
        mock_rounds=(
            AgentProviderReply(
                content="",
                tool_calls=(
                    AgentToolCall(
                        id="call-1",
                        name="classify_change",
                        arguments={
                            "item_title": "Art Institute of Chicago",
                            "new_start_hour": 8.0,
                        },
                    ),
                ),
            ),
        ),
        max_rounds=1,
    )

    assert result.tool_results[0]["guard_rejected"] is True
    assert "get_current_plan" in result.tool_results[0]["output"]


def test_propose_options_guard_rejects_until_current_plan_was_checked(db, full_trip):
    tools = tuple(_tools_by_name(db, full_trip).values())
    result = call_agent(
        system="Use tools.",
        user="Suggest options.",
        tools=tools,
        mock_rounds=(
            AgentProviderReply(
                content="",
                tool_calls=(
                    AgentToolCall(
                        id="call-1",
                        name="propose_options",
                        arguments={"conflict_description": "Wednesday is too crowded."},
                    ),
                ),
            ),
        ),
        max_rounds=1,
    )

    assert result.tool_results[0]["guard_rejected"] is True
    assert "get_current_plan" in result.tool_results[0]["output"]


def test_tools_do_not_write_decision_or_plan_tables(db, full_trip):
    tools = _tools_by_name(db, full_trip)
    before = _write_counts(db)

    tools["get_current_plan"].handler(day="all")
    tools["get_trip_facts"].handler()
    tools["classify_change"].handler(
        item_title="Art Institute of Chicago",
        new_start_hour=19.0,
        day="all",
    )
    tools["propose_options"].handler(
        conflict_description="Wednesday feels too crowded.",
        day="all",
    )

    assert _write_counts(db) == before


def test_get_current_plan_can_query_any_day_or_entire_trip(db, full_trip):
    trip = full_trip["trip"]
    trip.preferred_start_date = date(2026, 8, 18)
    trip.preferred_end_date = date(2026, 8, 20)
    plan = full_trip["plan"]
    db.add(
        PlanItem(
            plan_id=plan.id,
            day_index=3,
            day_date=date(2026, 8, 20),
            start_hour=11.0,
            duration_min=90,
            title="Thursday architecture walk",
            place="Riverwalk",
        )
    )
    db.flush()
    tools = _tools_by_name(db, full_trip)

    all_days = tools["get_current_plan"].handler(day="all")
    wednesday = tools["get_current_plan"].handler(day="Wednesday")
    thursday = tools["get_current_plan"].handler(day="Thursday")

    assert len(all_days["days"]) == 2
    assert wednesday["days"][0]["day_date"] == "2026-08-19"
    assert {item["title"] for item in wednesday["days"][0]["items"]} == {
        "Art Institute of Chicago",
        "Birthday dinner",
    }
    assert thursday["days"][0]["items"][0]["title"] == "Thursday architecture walk"


def test_tool_descriptions_explain_return_values_and_decision_paths(db, full_trip):
    tools = _tools_by_name(db, full_trip)

    assert "check_constraints" not in tools
    assert "Returns each item's id, title, place, start time, end time, and duration" in tools["get_current_plan"].description
    classify_description = tools["classify_change"].description
    assert "Returns one of" in classify_description
    assert "notice" in classify_description
    assert "round" in classify_description
    assert "confirm" in classify_description
    assert "set day to the item's CURRENT day" in classify_description
    assert "target date in new_day_date" in classify_description
    propose_description = tools["propose_options"].description
    assert "Returns an options array" in propose_description
    assert "id, kind, label, title, body, tradeoff, item_id, and patch" in propose_description


def test_cross_day_classify_finds_unique_source_item_across_entire_plan(db, full_trip):
    tools = _tools_by_name(db, full_trip)

    result = tools["classify_change"].handler(
        item_title="Art Institute of Chicago",
        new_day_date="2026-08-16",
        day="2026-08-16",
    )

    assert result["item"]["title"] == "Art Institute of Chicago"
    assert result["item"]["day_date"] == "2026-08-15"
    assert result["proposed_patch"]["day_date"] == "2026-08-16"
    assert result["classification"]["path"] in {"notice", "round", "confirm", "reopen_round"}


def test_duplicate_item_title_requires_disambiguation(db, full_trip):
    plan = full_trip["plan"]
    db.add(
        PlanItem(
            plan_id=plan.id,
            day_index=3,
            day_date=date(2026, 8, 16),
            start_hour=10.0,
            duration_min=60,
            title="Art Institute of Chicago",
            place="Michigan Avenue",
        )
    )
    db.flush()
    tools = _tools_by_name(db, full_trip)

    ambiguous = tools["classify_change"].handler(
        item_title="Art Institute of Chicago",
        new_start_hour=11.0,
    )
    narrowed = tools["classify_change"].handler(
        item_title="Art Institute of Chicago",
        new_start_hour=11.0,
        day="2026-08-16",
    )

    assert ambiguous["error"] == "ambiguous_item"
    assert len(ambiguous["matches"]) == 2
    assert narrowed["item"]["day_date"] == "2026-08-16"


def test_get_current_plan_returns_deterministic_end_times(db, full_trip):
    tools = _tools_by_name(db, full_trip)

    plan = tools["get_current_plan"].handler(day="all")
    art = next(
        item
        for day in plan["days"]
        for item in day["items"]
        if item["title"] == "Art Institute of Chicago"
    )

    assert art["id"] == full_trip["art"].id
    assert art["start_time_label"] == "2:00 PM"
    assert art["end_hour"] == 16.5
    assert art["end_time_label"] == "4:30 PM"
    assert art["time_range_label"] == "2:00 PM-4:30 PM"


def test_propose_options_returns_real_item_ids_and_structured_patches(db, full_trip):
    db.add(
        PlanItem(
            plan_id=full_trip["plan"].id,
            day_index=3,
            day_date=date(2026, 8, 16),
            start_hour=10.0,
            duration_min=90,
            title="Thursday architecture walk",
            place="Riverwalk",
        )
    )
    db.flush()
    tools = _tools_by_name(db, full_trip)
    plan = tools["get_current_plan"].handler(day="all")
    real_item_ids = {
        item["id"]
        for day in plan["days"]
        for item in day["items"]
    }

    result = tools["propose_options"].handler(
        conflict_description="Wednesday feels too crowded.",
        day="all",
    )

    assert [option["id"] for option in result["options"]][0] == "keep"
    assert result["options"][-1]["id"] == "split"
    generated = [option for option in result["options"] if option["kind"] == "ai_generated"]
    assert generated
    for option in result["options"]:
        assert option["item_id"] in real_item_ids
        assert isinstance(option["patch"], dict)
    assert any("day_date" in option["patch"] for option in generated)
    assert any("duration_min" in option["patch"] for option in generated)

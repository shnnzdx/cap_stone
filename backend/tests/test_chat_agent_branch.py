from __future__ import annotations

import time
from datetime import date

from sqlalchemy.orm import Session

from app.agents import base
from app.domain.chat import service as chat_service


def test_clear_change_stays_on_legacy_understand_path(monkeypatch, db: Session, full_trip: dict):
    monkeypatch.setenv("MOCK_AI", "1")

    def fail_if_called(**kwargs):
        raise AssertionError("call_agent should not run for a clear single change")

    monkeypatch.setattr(base, "call_agent", fail_if_called)

    result = chat_service.respond_to_trip_chat(
        db,
        trip_id=full_trip["trip"].id,
        membership=full_trip["me"],
        message="Move this to 3 PM",
        item_id=full_trip["art"].id,
    )

    assert result.proposed_change is not None
    assert result.proposed_change.item_id == full_trip["art"].id
    assert result.proposed_change.patch["start_hour"] == 15.0
    assert result.candidate_options == ()


def test_clear_named_change_without_selected_item_stays_on_legacy_path(
    monkeypatch, db: Session, full_trip: dict
):
    monkeypatch.setenv("MOCK_AI", "1")

    def fail_if_called(**kwargs):
        raise AssertionError("call_agent should not run for a clear named change")

    monkeypatch.setattr(base, "call_agent", fail_if_called)

    result = chat_service.respond_to_trip_chat(
        db,
        trip_id=full_trip["trip"].id,
        membership=full_trip["me"],
        message="把周三的 Art Institute 改到下午 3 点",
    )

    assert result.proposed_change is not None
    assert result.proposed_change.item_id == full_trip["art"].id
    assert result.proposed_change.patch["start_hour"] == 15.0


def test_fuzzy_change_uses_agent_branch(monkeypatch, db: Session, full_trip: dict):
    monkeypatch.setenv("MOCK_AI", "1")
    calls = []

    def fake_call_agent(**kwargs):
        calls.append(kwargs)
        return base.AgentRunResult(
            content="Wednesday can be loosened by moving the museum.",
            trace_id="trace",
            rounds=(),
            tool_results=(),
            total_tokens=0,
            total_elapsed_ms=1.0,
        )

    monkeypatch.setattr(base, "call_agent", fake_call_agent)

    result = chat_service.respond_to_trip_chat(
        db,
        trip_id=full_trip["trip"].id,
        membership=full_trip["me"],
        message="周三排得太满了，能不能松一点",
    )

    assert calls
    assert "Wednesday can be loosened" in result.reply
    assert result.proposed_change is None


def test_cross_day_question_without_selected_item_uses_agent_branch(
    monkeypatch, db: Session, full_trip: dict
):
    monkeypatch.setenv("MOCK_AI", "1")
    calls = []

    def fake_call_agent(**kwargs):
        calls.append(kwargs)
        return base.AgentRunResult(
            content="The Art Institute can be checked against Thursday.",
            trace_id="trace",
            rounds=(),
            tool_results=(),
            total_tokens=0,
            total_elapsed_ms=1.0,
        )

    monkeypatch.setattr(base, "call_agent", fake_call_agent)

    result = chat_service.respond_to_trip_chat(
        db,
        trip_id=full_trip["trip"].id,
        membership=full_trip["me"],
        message="周三的 Art Institute 能不能挪到周四",
    )

    assert calls
    assert "Thursday" in result.reply


def test_agent_failure_degrades_without_raising(monkeypatch, db: Session, full_trip: dict):
    monkeypatch.setenv("MOCK_AI", "1")

    def fail_agent(**kwargs):
        raise RuntimeError("agent failed")

    monkeypatch.setattr(base, "call_agent", fail_agent)

    result = chat_service.respond_to_trip_chat(
        db,
        trip_id=full_trip["trip"].id,
        membership=full_trip["me"],
        message="周三排得太满了，能不能松一点",
    )

    assert result.proposed_change is None
    assert "what would you like to change" in result.reply.lower()


def test_agent_timeout_degrades_without_waiting(monkeypatch, db: Session, full_trip: dict):
    monkeypatch.setenv("MOCK_AI", "1")
    monkeypatch.setattr(chat_service, "CHAT_AGENT_TIMEOUT_SECONDS", 0.01)

    def slow_agent(**kwargs):
        time.sleep(0.2)
        return base.AgentRunResult(
            content="too late",
            trace_id="trace",
            rounds=(),
            tool_results=(),
            total_tokens=0,
            total_elapsed_ms=200.0,
        )

    monkeypatch.setattr(base, "call_agent", slow_agent)
    started = time.perf_counter()

    result = chat_service.respond_to_trip_chat(
        db,
        trip_id=full_trip["trip"].id,
        membership=full_trip["me"],
        message="周三排得太满了，能不能松一点",
    )

    assert (time.perf_counter() - started) < 0.15
    assert result.proposed_change is None
    assert "what would you like to change" in result.reply.lower()


def test_agent_multi_options_keeps_first_patch_as_proposed_change(
    monkeypatch, db: Session, full_trip: dict
):
    monkeypatch.setenv("MOCK_AI", "1")

    def fake_call_agent(**kwargs):
        return base.AgentRunResult(
            content="Here are options to loosen Wednesday.",
            trace_id="trace",
            rounds=(),
            tool_results=(
                {
                    "tool": "propose_options",
                    "arguments": {"day": "all"},
                    "output": {
                        "options": [
                            {
                                "id": "keep",
                                "label": "Keep current",
                                "title": "Keep current",
                                "body": "No change.",
                                "tradeoff": "Still busy.",
                                "item_id": full_trip["art"].id,
                                "patch": {},
                            },
                            {
                                "id": "shorten",
                                "label": "Shorten",
                                "title": "Shorten museum",
                                "body": "Cut the museum visit.",
                                "tradeoff": "Less museum time.",
                                "item_id": full_trip["art"].id,
                                "patch": {"duration_min": 90},
                            },
                            {
                                "id": "split",
                                "label": "Split up",
                                "title": "Split up",
                                "body": "Some rest, some go.",
                                "tradeoff": "Group separates.",
                                "item_id": full_trip["art"].id,
                                "patch": {"split": True},
                            },
                        ]
                    },
                    "guard_rejected": False,
                },
            ),
            total_tokens=0,
            total_elapsed_ms=1.0,
        )

    monkeypatch.setattr(base, "call_agent", fake_call_agent)

    result = chat_service.respond_to_trip_chat(
        db,
        trip_id=full_trip["trip"].id,
        membership=full_trip["me"],
        message="周三排得太满了，能不能松一点",
    )

    assert result.proposed_change is not None
    assert result.proposed_change.item_id == full_trip["art"].id
    assert result.proposed_change.patch == {"duration_min": 90}
    assert len(result.candidate_options) == 3


def test_agent_explicit_change_takes_priority_over_followup_options(
    monkeypatch, db: Session, full_trip: dict
):
    monkeypatch.setenv("MOCK_AI", "1")

    def fake_call_agent(**kwargs):
        return base.AgentRunResult(
            content="Moving the museum conflicts, and here are options.",
            trace_id="trace",
            rounds=(),
            tool_results=(
                {
                    "tool": "classify_change",
                    "arguments": {},
                    "output": {
                        "item": {"id": full_trip["art"].id},
                        "proposed_patch": {"day_date": "2026-08-16"},
                    },
                    "guard_rejected": False,
                },
                {
                    "tool": "propose_options",
                    "arguments": {},
                    "output": {
                        "options": [
                            {
                                "id": "shorten-other",
                                "label": "Shorten",
                                "title": "Shorten dinner",
                                "body": "Shorten another item.",
                                "tradeoff": "Less time.",
                                "item_id": full_trip["dinner"].id,
                                "patch": {"duration_min": 60},
                            }
                        ]
                    },
                    "guard_rejected": False,
                },
            ),
            total_tokens=0,
            total_elapsed_ms=1.0,
        )

    monkeypatch.setattr(base, "call_agent", fake_call_agent)

    result = chat_service.respond_to_trip_chat(
        db,
        trip_id=full_trip["trip"].id,
        membership=full_trip["me"],
        message="周三的 Art Institute 能不能挪到周四",
    )

    assert result.proposed_change is not None
    assert result.proposed_change.item_id == full_trip["art"].id
    assert result.proposed_change.patch == {"day_date": date(2026, 8, 16)}
    assert len(result.candidate_options) == 1

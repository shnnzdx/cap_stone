"""Agent 地基的测试 —— 守的是"私密数据进不了 prompt"这条产品承诺。"""

from __future__ import annotations

from datetime import date

import pytest

from app.agents import base
from app.domain.constraints.engine import classify
from app.domain.constraints.types import (
    Constraint,
    ConstraintKind,
    Importance,
    ItemView,
    ProposedChange,
    Settledness,
)

SECRET = "化疗后早上起不来，不想让任何人知道"


def _verdict():
    item = ItemView(
        id="art", day_date=date(2026, 8, 15), start_hour=14.0,
        duration_min=120, price_per_person=30.0, settledness=Settledness.LOOSE,
    )
    change = ProposedChange(
        before=item,
        after=ItemView(
            id="art", day_date=date(2026, 8, 15), start_hour=8.0,
            duration_min=120, price_per_person=30.0,
        ),
        day_walk_km_after=1.4, trip_total_after=480.0,
        requested_by_membership_id="m-mia",
    )
    constraint = Constraint(
        id="c1", membership_id="m-mia", kind=ConstraintKind.TIME_WINDOW,
        importance=Importance.REQUIRED, params={"earliest_hour": 9.0},
        private_note=SECRET,
    )
    return classify(change, [constraint])


def test_safe_context_cannot_carry_identity_or_wording():
    """这条守的是产品承诺:模型永远看不到是谁、也看不到原话。

    连带效果:prompt 里没有私密数据,所以 prompt 注入也套不出来。
    """
    ctx = base.safe_context(_verdict())
    blob = ctx.as_prompt_block() + repr(ctx)

    assert "m-mia" not in blob
    assert SECRET not in blob
    assert "Mia" not in blob
    for field in ("membership_id", "user_id", "name", "private_note"):
        assert not hasattr(ctx, field)


def test_safe_context_still_says_enough_to_be_useful():
    """脱敏不能脱到没信息 —— 模型要知道被什么挡住了、影响几个人。"""
    ctx = base.safe_context(_verdict())

    assert ctx.path == "confirm"
    assert any("required" in b.lower() for b in ctx.blocked_by)
    assert ctx.affected_counts == (1,)
    assert "time window" in ctx.findings[0].lower()


def test_mock_mode_never_touches_the_network(monkeypatch):
    monkeypatch.setenv("MOCK_AI", "1")
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)

    result = base.call_model(
        system="s", user="u", schema={"type": "object"},
        schema_name="t", mock={"kind": "walk_limit"},
    )
    assert result == {"kind": "walk_limit"}


def test_a_missing_key_degrades_instead_of_crashing(monkeypatch):
    """没 key 要抛 AgentUnavailable，让调用方能降级 —— 不是 500。"""
    monkeypatch.delenv("MOCK_AI", raising=False)
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)

    with pytest.raises(base.AgentUnavailable):
        base.call_model(
            system="s", user="u", schema={"type": "object"},
            schema_name="t", mock={},
        )

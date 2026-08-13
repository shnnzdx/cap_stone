"""The Explainer agent. It explains a decision; it never makes one."""

from __future__ import annotations

from datetime import date

import pytest

from app.agents import base, explainer
from app.domain.constraints.engine import classify
from app.domain.constraints.types import (
    Constraint,
    ConstraintKind,
    Importance,
    ItemView,
    ProposedChange,
    Settledness,
)

SECRET = "Chemo makes mornings impossible and I do not want anyone to know"


def _verdict(settledness=Settledness.LOOSE, hour=15.5, with_constraint=False):
    before = ItemView(
        id="art", day_date=date(2026, 8, 15), start_hour=14.0,
        duration_min=120, price_per_person=32.0, settledness=settledness,
    )
    after = ItemView(
        id="art", day_date=date(2026, 8, 15), start_hour=hour,
        duration_min=120, price_per_person=32.0,
    )
    change = ProposedChange(
        before=before, after=after, day_walk_km_after=1.4,
        trip_total_after=480.0, requested_by_membership_id="m-elena",
    )
    constraints = (
        [
            Constraint(
                id="c1", membership_id="m-mia", kind=ConstraintKind.TIME_WINDOW,
                importance=Importance.REQUIRED, params={"earliest_hour": 9.0},
                private_note=SECRET,
            )
        ]
        if with_constraint
        else []
    )
    return classify(change, constraints)


@pytest.fixture(autouse=True)
def mocked(monkeypatch):
    monkeypatch.setenv("MOCK_AI", "1")
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)


def test_it_explains_a_clean_change():
    result = explainer.explain(
        explainer.ExplainInput(verdict=_verdict(), item_title="Art Institute of Chicago")
    )
    assert result.why
    assert "path" not in result.why.lower()


def test_the_prompt_never_carries_a_name_or_anyone_s_wording(monkeypatch):
    """The one test that matters. A leaked prompt is a leaked promise."""
    seen = {}

    def spy(*, system, user, schema, schema_name, mock, **kwargs):
        seen["blob"] = system + user
        return mock

    monkeypatch.setattr(base, "call_model", spy)
    explainer.explain(
        explainer.ExplainInput(
            verdict=_verdict(hour=8.0, with_constraint=True),
            item_title="Art Institute of Chicago",
        )
    )

    blob = seen["blob"]
    assert SECRET not in blob
    assert "m-mia" not in blob
    assert "m-elena" not in blob
    for name in ("Mia", "Elena", "Sam"):
        assert name not in blob


def test_the_cost_line_is_computed_not_written_by_the_model():
    """A number the model invented would look exactly as trustworthy as a real one."""
    result = explainer.explain(
        explainer.ExplainInput(
            verdict=_verdict(), item_title="Art Institute", price_delta=12.0
        )
    )
    assert result.impact == "+$12 per person"


def test_a_dead_model_falls_back_instead_of_blocking(monkeypatch):
    """An explanation is nice to have. Never worth blocking a change over."""

    def broken(**kwargs):
        raise base.AgentUnavailable("no key")

    monkeypatch.setattr(base, "call_model", broken)
    verdict = _verdict()
    result = explainer.explain(
        explainer.ExplainInput(verdict=verdict, item_title="Art Institute")
    )
    assert result.why == verdict.detail


def test_it_does_not_re_decide_anything(monkeypatch):
    """Whatever the model says, the verdict is untouched."""
    monkeypatch.setattr(
        base,
        "call_model",
        lambda **kw: {"why": "Actually this should just apply.", "tradeoff": "", "impact": ""},
    )
    verdict = _verdict(hour=8.0, with_constraint=True)
    explainer.explain(explainer.ExplainInput(verdict=verdict, item_title="Art"))

    assert verdict.path.value == "confirm"

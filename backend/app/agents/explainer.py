"""Explainer -- turn a verdict the engine already computed into one human sentence.

This is the simplest of the five agents, and a good template for the rest.
Every agent in this codebase is the same four things:

  1. SCHEMA   -- the exact shape the model must answer in
  2. SYSTEM   -- who the model is and what it may not do
  3. MOCK     -- a fixed answer for MOCK_AI=1, same shape as the real one
  4. one pure function -- input dataclass in, output dataclass out

The agent never decides anything. `engine.classify()` already decided; this
only says it in a way a person wants to read. If the model is unavailable we
fall back to the engine's own wording -- an explanation is worth having, but
never worth blocking a change over.
"""

from __future__ import annotations

from dataclasses import dataclass

from . import base
from ..domain.constraints.types import Classification

# 1. SCHEMA ---------------------------------------------------------------
# strict + additionalProperties:false means the model cannot invent fields.
# Free-form text would parse fine right up until the day it does not.

SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "required": ["why", "tradeoff", "impact"],
    "properties": {
        "why": {
            "type": "string",
            "description": "One sentence: why this change can go ahead the way it can.",
        },
        "tradeoff": {
            "type": "string",
            "description": "One short clause on what is given up. Empty string if nothing is.",
        },
        "impact": {
            "type": "string",
            "description": "A compact impact line, e.g. '+$12 · 15 min more walking'. Empty string if none.",
        },
    },
}

# 2. SYSTEM ---------------------------------------------------------------
# Everything the model must not do lives here, not in the caller.

SYSTEM = """You explain group travel decisions to the person who just made a change.

The decision has already been made by a rule engine. You never re-decide it,
never argue with it, and never suggest the user route around it.

Hard rules:
- Refer to people only as "one member", "someone", or "they". You are never
  given a name, and inventing one would be worse than saying nothing.
- Describe what a requirement blocks, never why someone might have it.
- Two sentences at most. This sits inside a small card.
- Plain English a traveller would use.

Note on the rules above: they are written as what to do, not as a list of
forbidden words. Naming a banned example here would put that example straight
into your context, which is the opposite of what we want.
"""

# 3. MOCK -----------------------------------------------------------------
# Same shape as the real answer. Tests run against this, so they cost nothing,
# need no network, and never go red because a model version changed.

MOCK = {
    "why": "Nothing hard is affected here, so this applies right away.",
    "tradeoff": "",
    "impact": "",
}

MOCK_BLOCKED = {
    "why": "This runs into a requirement someone already set, so it needs their confirmation first.",
    "tradeoff": "The current plan stays as it is until they agree.",
    "impact": "",
}


@dataclass(frozen=True)
class ExplainInput:
    verdict: Classification
    item_title: str
    before: str = ""
    after: str = ""
    price_delta: float = 0.0


@dataclass(frozen=True)
class Explanation:
    why: str
    tradeoff: str
    impact: str


def _fallback(verdict: Classification) -> Explanation:
    """No model? Use the engine's own wording.

    An explanation is a nice-to-have. Blocking a change because the model is
    down would be trading something that matters for something that does not.
    """
    return Explanation(why=verdict.detail, tradeoff="", impact="")


def explain(payload: ExplainInput) -> Explanation:
    """One sentence about a decision that has already been made."""
    # safe_context is the only way an agent sees a verdict. It cannot carry a
    # membership id or anyone's wording -- the type has nowhere to put them.
    context = base.safe_context(payload.verdict)

    money = ""
    if payload.price_delta:
        sign = "+" if payload.price_delta > 0 else "−"
        money = f"{sign}${abs(payload.price_delta):.0f} per person"

    lines = [f"Block: {payload.item_title}"]
    if payload.before:
        lines.append(f"Before: {payload.before}")
    if payload.after:
        lines.append(f"After: {payload.after}")
    if money:
        lines.append(f"Cost change: {money}")
    lines += ["", context.as_prompt_block()]
    user = "\n".join(lines)

    try:
        answer = base.call_model(
            system=SYSTEM,
            user=user,
            schema=SCHEMA,
            schema_name="explanation",
            mock=MOCK_BLOCKED if context.blocked_by else MOCK,
        )
    except base.AgentUnavailable:
        return _fallback(payload.verdict)

    return Explanation(
        why=answer.get("why", "").strip(),
        tradeoff=answer.get("tradeoff", "").strip(),
        # The cost line is computed, never written by the model -- a number the
        # model made up would look exactly as trustworthy as a real one.
        impact=money or answer.get("impact", "").strip(),
    )

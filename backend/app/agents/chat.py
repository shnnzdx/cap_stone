from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import date
from typing import Any

from . import base
from ..domain.constraints.types import Classification


@dataclass(frozen=True)
class ItemContext:
    id: str
    title: str
    place: str
    day_date: date
    start_hour: float
    duration_min: int

    def prompt_block(self) -> str:
        return (
            f"Item id: {self.id}\n"
            f"Title: {self.title}\n"
            f"Place: {self.place}\n"
            f"Date: {self.day_date.isoformat()}\n"
            f"Start hour: {self.start_hour}\n"
            f"Duration minutes: {self.duration_min}"
        )


@dataclass(frozen=True)
class UnderstandInput:
    message: str
    item: ItemContext | None = None


@dataclass(frozen=True)
class Understanding:
    intent: str
    item_hint: str | None
    patch: dict[str, Any]


@dataclass(frozen=True)
class ReplyInput:
    message: str
    item: ItemContext
    patch: dict[str, Any]
    verdict: Classification


@dataclass(frozen=True)
class Reply:
    text: str


UNDERSTAND_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "intent": {"type": "string", "enum": ["change", "question", "unclear"]},
        "item_hint": {"type": ["string", "null"]},
        "patch": {
            "type": "object",
            "additionalProperties": False,
            "properties": {
                "title": {"type": ["string", "null"]},
                "place": {"type": ["string", "null"]},
                "start_hour": {"type": ["number", "null"], "minimum": 0, "maximum": 24},
                "day_date": {"type": ["string", "null"]},
                "price_per_person": {"type": ["number", "null"], "minimum": 0},
            },
            "required": ["title", "place", "start_hour", "day_date", "price_per_person"],
        },
    },
    "required": ["intent", "item_hint", "patch"],
}

REPLY_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "reply": {"type": "string"},
    },
    "required": ["reply"],
}


def understand(request: UnderstandInput) -> Understanding:
    result = base.call_model(
        system=(
            "You turn a trip-planning chat message into a structured intent. "
            "Return only JSON. Do not decide whether the change is allowed."
        ),
        user=_understand_prompt(request),
        schema=UNDERSTAND_SCHEMA,
        schema_name="chat_understanding",
        mock=_mock_understanding(request),
    )

    result_patch = result.get("patch") or {}

    # Exact time values are deterministic.
    # Do not rely on the LLM to calculate 3:30 PM -> 15.5 correctly.
    exact_hour = _hour_from_text(request.message.lower())

    if exact_hour is not None:
        result_patch["start_hour"] = exact_hour

    patch = {
        key: value
        for key, value in result_patch.items()
        if value is not None
    }

    return Understanding(
        intent=result["intent"],
        item_hint=result.get("item_hint"),
        patch=patch,
    )

def explain(request: ReplyInput) -> Reply:
    safe = base.safe_context(request.verdict)
    result = base.call_model(
        system=(
            "You explain a precomputed itinerary-change verdict to a traveler. "
            "Use plain English. Do not pressure anyone. Do not claim the change "
            "has been submitted."
        ),
        user=_reply_prompt(request, safe),
        schema=REPLY_SCHEMA,
        schema_name="chat_reply",
        mock={"reply": _mock_reply(request.verdict)},
    )
    return Reply(text=result["reply"])


def fallback_unavailable() -> str:
    return (
        "I could not read that reliably right now. You can still choose an item "
        "and enter the change manually."
    )


def ask_which_item() -> str:
    return "Which itinerary item should I change? Pick the item, then send the change again."


def ask_for_change() -> str:
    return "What would you like to change about that item?"


def no_change_reply() -> str:
    return "I can help with that, but I do not see a specific trip change to check yet."


def fallback_explanation(verdict: Classification) -> str:
    return f"{verdict.headline}. {verdict.detail}"


def _understand_prompt(request: UnderstandInput) -> str:
    parts = [
        "Message:",
        request.message,
        "",
        "Allowed patch fields: title, place, start_hour, day_date, price_per_person.",
    ]
    if request.item:
        parts.extend(["", "Current itinerary item:", request.item.prompt_block()])
    else:
        parts.extend(["", "No specific item was selected. If the message does not name an item, item_hint must be null."])
    return "\n".join(parts)


def _reply_prompt(request: ReplyInput, safe: base.SafeContext) -> str:
    patch_lines = [f"{key}: {value}" for key, value in sorted(request.patch.items())]
    return "\n".join(
        [
            "Traveler message:",
            request.message,
            "",
            "Item:",
            request.item.prompt_block(),
            "",
            "Patch:",
            "\n".join(patch_lines) or "No patch",
            "",
            "Safe verdict context:",
            safe.as_prompt_block(),
        ]
    )


def _mock_understanding(request: UnderstandInput) -> dict[str, Any]:
    message = request.message.lower()
    patch = {
        "title": None,
        "place": None,
        "start_hour": _hour_from_text(message),
        "day_date": None,
        "price_per_person": None,
    }
    if "shopping" in message or "shop" in message:
        patch["title"] = "Shopping"
        patch["place"] = "Shopping district"
    elif "dinner" in message and "move" not in message:
        patch["title"] = "Dinner"

    has_change = any(value is not None for value in patch.values()) or any(
        word in message for word in ("move", "replace", "change", "switch", "go to")
    )
    if not has_change:
        return {"intent": "question", "item_hint": None, "patch": patch}

    item_hint = request.item.title if request.item else None
    if item_hint is None:
        if "art institute" in message or "museum" in message:
            item_hint = "Art Institute"
        elif "birthday dinner" in message:
            item_hint = "Birthday dinner"
    return {"intent": "change", "item_hint": item_hint, "patch": patch}


def _hour_from_text(message: str) -> float | None:
    match = re.search(r"\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b", message)
    if match:
        hour = int(match.group(1))
        minute = int(match.group(2) or 0)
        suffix = match.group(3)
        if suffix == "pm" and hour < 12:
            hour += 12
        if suffix == "am" and hour == 12:
            hour = 0
        return hour + minute / 60
    if "afternoon" in message:
        return 15.0
    if "morning" in message:
        return 10.0
    if "evening" in message:
        return 19.0
    return None


def _mock_reply(verdict: Classification) -> str:
    if verdict.path.value == "notice":
        return "I can prepare that change. It does not hit a hard constraint, so it can apply as a notice when you submit it."
    if verdict.path.value in {"round", "reopen_round"}:
        return "I can prepare that change, but this slot needs a group round before it changes."
    return "I can prepare that change, but affected members need to confirm before the current plan changes."

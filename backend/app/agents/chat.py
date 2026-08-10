from __future__ import annotations

import re
from dataclasses import dataclass
from datetime import date
from typing import Any, Literal

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
class HistoryTurn:
    role: Literal["user", "assistant"]
    text: str


@dataclass(frozen=True)
class CandidateContext:
    title: str
    place: str
    price_per_person: float
    lat: float
    lng: float
    opens: float
    closes: float
    tags: tuple[str, ...]

    def prompt_line(self) -> str:
        return (
            f"- {self.title} | {self.place} | ${self.price_per_person:.0f} | "
            f"hours {self.opens:g}-{self.closes:g} | tags: {', '.join(self.tags)}"
        )


@dataclass(frozen=True)
class UnderstandInput:
    message: str
    item: ItemContext | None = None
    history: tuple[HistoryTurn, ...] = ()
    candidates: tuple[CandidateContext, ...] = ()


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
class QuestionInput:
    message: str
    item: ItemContext | None
    itinerary: tuple[ItemContext, ...]


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
                "start_hour": {"type": ["number", "null"], "minimum": 6, "maximum": 24},
                "day_date": {"type": ["string", "null"]},
                "price_per_person": {"type": ["number", "null"], "minimum": 0},
                "lat": {"type": ["number", "null"], "minimum": -90, "maximum": 90},
                "lng": {"type": ["number", "null"], "minimum": -180, "maximum": 180},
            },
            "required": [
                "title", "place", "start_hour", "day_date", "price_per_person", "lat", "lng"
            ],
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
            "Resolve short follow-ups using the conversation history. If the traveler "
            "delegates a choice (for example: choose one, any, 随便, 你选, 可以), choose "
            "one concrete eligible candidate instead of asking again. For a replacement, "
            "never keep the old title while merely changing its area. Use candidate values "
            "exactly and never invent a venue. "
            "Return only JSON. Do not decide whether the change is allowed."
        ),
        user=_understand_prompt(request),
        schema=UNDERSTAND_SCHEMA,
        schema_name="chat_understanding",
        mock=_mock_understanding(request),
        max_tokens=220,
    )
    result_patch = result.get("patch") or {}

    # Exact time values are deterministic. Do not rely on the LLM to calculate
    # "3:30 PM" -> 15.5 correctly.
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
            "Reply in the same language as the traveler's latest message, in no more "
            "than two short sentences. Use only the supplied item, patch, and verdict. "
            "Do not invent a weekday, availability, opening hours, or other facts. "
            "Do not pressure anyone or claim the change has been submitted."
        ),
        user=_reply_prompt(request, safe),
        schema=REPLY_SCHEMA,
        schema_name="chat_reply",
        mock={"reply": _mock_reply(request.verdict)},
        max_tokens=260,
    )
    return Reply(text=result["reply"])


def answer_question(request: QuestionInput) -> Reply:
    result = base.call_model(
        system=(
            "You are Cadensy, a private trip-planning assistant. Answer the "
            "traveler's question using only the shared itinerary context below. "
            "Do not claim to know hidden preferences, private notes, or anyone's "
            "personal reasons. If the traveler asks for a change, say you can help "
            "check a specific change against the plan. Keep the answer brief."
        ),
        user=_question_prompt(request),
        schema=REPLY_SCHEMA,
        schema_name="chat_question_reply",
        mock={"reply": _mock_question_reply(request)},
        max_tokens=220,
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


def replacement_explanation(request: ReplyInput) -> str:
    title = str(request.patch["title"])
    place = str(request.patch.get("place") or "").strip()
    destination = f"{title} ({place})" if place else title
    chinese = bool(re.search(r"[\u4e00-\u9fff]", request.message))
    if request.verdict.path.value == "notice":
        if chinese:
            return f"我建议把 {request.item.title} 换成 {destination}，时间保持不变。检查通过；点击 Apply 后才会提交。"
        return f"I suggest replacing {request.item.title} with {destination} at the same time. It passes the checks; it will only be submitted after you click Apply."
    if request.verdict.path.value in {"round", "reopen_round"}:
        if chinese:
            return f"我建议把 {request.item.title} 换成 {destination}。这个调整需要小组投票，点击 Apply 后才会发起。"
        return f"I suggest replacing {request.item.title} with {destination}. This needs a group round, which starts only after you click Apply."
    if chinese:
        return f"我建议把 {request.item.title} 换成 {destination}。这个调整需要相关成员确认，点击 Apply 后才会提交。"
    return f"I suggest replacing {request.item.title} with {destination}. Affected members must confirm, and it will only be submitted after you click Apply."


def _understand_prompt(request: UnderstandInput) -> str:
    parts = [
        "Recent conversation (oldest to newest):",
        *(
            [f"{turn.role}: {turn.text}" for turn in request.history[-10:]]
            or ["None"]
        ),
        "",
        "Message:",
        request.message,
        "",
        "Allowed patch fields: title, place, start_hour, day_date, price_per_person.",
    ]
    if request.item:
        parts.extend(["", "Current itinerary item:", request.item.prompt_block()])
    else:
        parts.extend(["", "No specific item was selected. If the message does not name an item, item_hint must be null."])
    parts.extend(
        [
            "",
            "Eligible catalog replacements at the current time:",
            *(
                [candidate.prompt_line() for candidate in request.candidates]
                or ["None"]
            ),
            "",
            "A generic area such as downtown is a preference, not a venue title. "
            "When choosing a candidate, copy its title, place, price, lat, and lng exactly.",
        ]
    )
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


def _question_prompt(request: QuestionInput) -> str:
    parts = [
        "Traveler question:",
        request.message,
        "",
    ]
    if request.item:
        parts.extend(["Selected itinerary item:", request.item.prompt_block(), ""])
    parts.append("Shared itinerary:")
    if request.itinerary:
        for item in request.itinerary:
            parts.append(item.prompt_block())
            parts.append("")
    else:
        parts.append("No itinerary items are available yet.")
    return "\n".join(parts).strip()


def _mock_understanding(request: UnderstandInput) -> dict[str, Any]:
    message = request.message.lower()
    patch = {
        "title": None,
        "place": None,
        "start_hour": _hour_from_text(message),
        "day_date": None,
        "price_per_person": None,
        "lat": None,
        "lng": None,
    }
    if "shopping" in message or "shop" in message:
        patch["title"] = "Magnificent Mile shopping"
        patch["place"] = "Magnificent Mile"
    elif "dinner" in message and "move" not in message:
        patch["title"] = "Dinner"

    history_text = " ".join(turn.text.lower() for turn in request.history)
    combined = f"{history_text} {message}".strip()
    has_change = any(value is not None for value in patch.values()) or any(
        word in combined
        for word in ("move", "replace", "change", "switch", "go to", "换", "改", "替换")
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
    if "noon" in message or "中午" in message:
        return 12.0
    match = re.search(r"(?<!\d)(\d{1,2})(?::(\d{2}))?\s*点", message)
    if match:
        hour = int(match.group(1))
        minute = int(match.group(2) or 0)
        # 中文里单说"12点"在旅行改时间语境下更常指中午;别让模型落成凌晨。
        if hour == 12 and not any(word in message for word in ("凌晨", "半夜", "午夜", "上午")):
            return 12 + minute / 60
        return hour + minute / 60
    match = re.search(r"\b(?:at|around|by|to)\s+12(?::(\d{2}))?\b", message)
    if match:
        return 12 + int(match.group(1) or 0) / 60
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


def _mock_question_reply(request: QuestionInput) -> str:
    if request.item:
        return f"{request.item.title} is scheduled at {request.item.start_hour:g}:00 at {request.item.place}."
    return "I can answer questions about the shared itinerary or help prepare a change to a specific block."

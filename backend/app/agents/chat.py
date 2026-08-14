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


REPLY_SCHEMA = {
    "type": "object",
    "additionalProperties": False,
    "properties": {
        "reply": {"type": "string"},
    },
    "required": ["reply"],
}


def explain(request: ReplyInput) -> Reply:
    safe = base.safe_context(request.verdict)
    result = base.call_model(
        system=(
            "You explain a precomputed itinerary-change verdict to a traveler. "
            "Reply in the same language as the traveler's latest message, in no more "
            "than two short sentences. Use only the supplied item, patch, and verdict. "
            "Do not invent a weekday, availability, opening hours, or other facts. "
            "Never say or imply that the Current Plan has changed, been applied, "
            "been submitted, been completed, or taken effect. The change is only a "
            "prepared proposal/check result until the traveler clicks Apply. Always "
            "make clear that the traveler must click Apply before anything is submitted."
        ),
        user=_reply_prompt(request, safe),
        schema=REPLY_SCHEMA,
        schema_name="chat_reply",
        mock={"reply": _mock_reply(request.verdict)},
        max_tokens=260,
        provider=base.CHAT_ROUTE,
    )
    reply = str(result["reply"])
    if _claims_change_completed(reply):
        reply = _safe_pending_explanation(request)
    return Reply(text=reply)


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
        provider=base.CHAT_ROUTE,
    )
    return Reply(text=result["reply"])


def fallback_unavailable() -> str:
    return (
        "I could not read that reliably right now. You can still choose an item "
        "and enter the change manually."
    )


def ask_for_change() -> str:
    return "What would you like to change about that item?"


def no_change_reply() -> str:
    return "I can help with that, but I do not see a specific trip change to check yet."


def fallback_explanation(verdict: Classification) -> str:
    return f"{verdict.headline}. {verdict.detail}"


def _claims_change_completed(text: str) -> bool:
    lowered = text.lower()
    unsafe_english = (
        "has been submitted",
        "was submitted",
        "is submitted",
        "has been applied",
        "was applied",
        "is applied",
        "has been changed",
        "was changed",
        "is changed",
        "has been updated",
        "was updated",
        "is updated",
        "change is live",
        "takes effect",
        "took effect",
        "completed",
        "all set",
    )
    unsafe_chinese = (
        "已生效",
        "已经生效",
        "生效了",
        "已提交",
        "已经提交",
        "提交了",
        "已完成",
        "已经完成",
        "完成了",
        "已更改",
        "已经更改",
        "已修改",
        "已经修改",
        "已更新",
        "已经更新",
        "已经改",
        "改好了",
    )
    return any(phrase in lowered for phrase in unsafe_english) or any(
        phrase in text for phrase in unsafe_chinese
    )


def _safe_pending_explanation(request: ReplyInput) -> str:
    chinese = bool(re.search(r"[\u4e00-\u9fff]", request.message))
    path = request.verdict.path.value
    if chinese:
        if path == "notice":
            return "我可以准备这个改动；检查通过。需要你点击 Apply 后才会提交，当前行程还没有改变。"
        if path in {"round", "reopen_round"}:
            return "我可以准备这个改动；它需要小组投票。需要你点击 Apply 后才会发起，当前行程还没有改变。"
        return "我可以准备这个改动；相关成员需要确认。需要你点击 Apply 后才会提交，当前行程还没有改变。"
    if path == "notice":
        return (
            "I can prepare this change. It passes the checks, and it will only be "
            "submitted after you click Apply; the Current Plan has not changed yet."
        )
    if path in {"round", "reopen_round"}:
        return (
            "I can prepare this change. It needs a group round, which starts only "
            "after you click Apply; the Current Plan has not changed yet."
        )
    return (
        "I can prepare this change. Affected members need to confirm, and it will "
        "only be submitted after you click Apply; the Current Plan has not changed yet."
    )


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


def _hour_from_text(message: str) -> float | None:
    message = message.lower()
    chinese = re.search(
        r"(凌晨|上午|早上|中午|下午|晚上)\s*(\d{1,2})(?:\s*点(?:半|:(\d{2}))?|:(\d{2}))",
        message,
    )
    if chinese:
        prefix = chinese.group(1) or ""
        hour = int(chinese.group(2))
        minute = 30 if "半" in chinese.group(0) else int(chinese.group(3) or chinese.group(4) or 0)
        if prefix in {"下午", "晚上"} and hour < 12:
            hour += 12
        if prefix == "凌晨" and hour == 12:
            hour = 0
        if prefix in {"上午", "早上"} and hour == 12:
            hour = 0
        return hour + minute / 60
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


def _mock_question_reply(request: QuestionInput) -> str:
    if request.item:
        return f"{request.item.title} is scheduled at {request.item.start_hour:g}:00 at {request.item.place}."
    return "I can answer questions about the shared itinerary or help prepare a change to a specific block."

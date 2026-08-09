from __future__ import annotations

from dataclasses import dataclass
from datetime import date
from difflib import SequenceMatcher
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from ...agents import base
from ...agents import chat as chat_agent
from ...db.models import Plan, PlanItem, Trip, TripMembership
from ..constraints.types import Classification
from ..decisions import orchestrator as orch


class ChatAccessDenied(Exception):
    pass


class ChatTripNotFound(Exception):
    pass


class ChatItemNotFound(Exception):
    pass


@dataclass(frozen=True)
class ProposedChatChange:
    item_id: str
    item_title: str
    patch: dict[str, Any]
    verdict: Classification


@dataclass(frozen=True)
class ChatResult:
    reply: str
    proposed_change: ProposedChatChange | None


def respond_to_trip_chat(
    db: Session,
    *,
    trip_id: str,
    membership: TripMembership,
    message: str,
    item_id: str | None = None,
) -> ChatResult:
    if membership.trip_id != trip_id:
        raise ChatAccessDenied("This membership does not belong to this trip")

    trip = db.get(Trip, trip_id)
    if trip is None:
        raise ChatTripNotFound("Trip not found")

    items = _trip_items(db, trip_id)
    selected = _selected_item(items, item_id)
    item_context = _item_context(selected) if selected else None

    if not _looks_like_change_request(message):
        try:
            reply = chat_agent.answer_question(
                chat_agent.QuestionInput(
                    message=message,
                    item=item_context,
                    itinerary=tuple(_item_context(item) for item in items),
                )
            ).text
        except base.AgentUnavailable:
            reply = chat_agent.no_change_reply()
        return ChatResult(reply=reply, proposed_change=None)

    try:
        understanding = chat_agent.understand(
            chat_agent.UnderstandInput(message=message, item=item_context)
        )
    except base.AgentUnavailable:
        return ChatResult(reply=chat_agent.fallback_unavailable(), proposed_change=None)

    if understanding.intent != "change":
        try:
            reply = chat_agent.answer_question(
                chat_agent.QuestionInput(
                    message=message,
                    item=item_context,
                    itinerary=tuple(_item_context(item) for item in items),
                )
            ).text
        except base.AgentUnavailable:
            reply = chat_agent.no_change_reply()
        return ChatResult(reply=reply, proposed_change=None)

    target = selected or _match_item(items, understanding.item_hint)
    if target is None:
        return ChatResult(reply=chat_agent.ask_which_item(), proposed_change=None)

    patch = _normalize_patch(understanding.patch)
    if not patch:
        return ChatResult(reply=chat_agent.ask_for_change(), proposed_change=None)

    verdict = orch.classify_change(db, target, patch, membership.id)
    try:
        reply = chat_agent.explain(
            chat_agent.ReplyInput(
                message=message,
                item=_item_context(target),
                patch=patch,
                verdict=verdict,
            )
        ).text
    except base.AgentUnavailable:
        reply = chat_agent.fallback_explanation(verdict)

    return ChatResult(
        reply=reply,
        proposed_change=ProposedChatChange(
            item_id=target.id,
            item_title=target.title,
            patch=patch,
            verdict=verdict,
        ),
    )


def _trip_items(db: Session, trip_id: str) -> list[PlanItem]:
    plan = db.scalar(select(Plan).where(Plan.trip_id == trip_id))
    if plan is None:
        return []
    return list(
        db.scalars(
            select(PlanItem)
            .where(PlanItem.plan_id == plan.id)
            .order_by(PlanItem.day_index, PlanItem.start_hour)
        )
    )


def _selected_item(items: list[PlanItem], item_id: str | None) -> PlanItem | None:
    if item_id is None:
        return None
    for item in items:
        if item.id == item_id:
            return item
    raise ChatItemNotFound("Item not found")


def _item_context(item: PlanItem) -> chat_agent.ItemContext:
    return chat_agent.ItemContext(
        id=item.id,
        title=item.title,
        place=item.place,
        day_date=item.day_date,
        start_hour=item.start_hour,
        duration_min=item.duration_min,
    )


def _match_item(items: list[PlanItem], hint: str | None) -> PlanItem | None:
    if not hint:
        return None
    normalized = hint.lower().strip()
    best: tuple[float, PlanItem | None] = (0.0, None)
    for item in items:
        candidates = (item.title.lower(), item.place.lower())
        if any(normalized in candidate or candidate in normalized for candidate in candidates):
            return item
        score = max(SequenceMatcher(None, normalized, candidate).ratio() for candidate in candidates)
        if score > best[0]:
            best = (score, item)
    return best[1] if best[0] >= 0.55 else None


def _looks_like_change_request(message: str) -> bool:
    text = message.lower()
    change_words = (
        "change",
        "move",
        "replace",
        "remove",
        "switch",
        "reschedule",
        "shift",
        "edit",
        "skip",
        "cancel",
        "instead",
        "later",
        "earlier",
    )
    if any(word in text for word in change_words):
        return True
    if "can we" in text or "could we" in text or "i want" in text or "let's" in text:
        return True
    return False


def _normalize_patch(patch: dict[str, Any]) -> dict[str, Any]:
    allowed = {"title", "place", "start_hour", "day_date", "price_per_person"}
    normalized: dict[str, Any] = {}
    for key, value in patch.items():
        if key not in allowed or value in (None, ""):
            continue
        if key == "day_date" and isinstance(value, str):
            value = date.fromisoformat(value)
        normalized[key] = value
    return normalized

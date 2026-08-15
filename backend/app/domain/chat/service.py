from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor, TimeoutError
from dataclasses import dataclass
from datetime import date
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from ...agents import base
from ...agents import chat as chat_agent
from ...agents.tools import build_read_only_trip_tools
from ...db.models import Plan, PlanItem, Trip, TripMembership
from ..constraints.types import Classification
from ..decisions import orchestrator as orch

CHAT_AGENT_TIMEOUT_SECONDS = 30.0
CHAT_AGENT_MAX_ROUNDS = 8
# Counted across rounds, and every round re-sends the whole conversation, so this
# grows quadratically with trip size. A four-round exchange on a one-week trip
# measured ~32k. The real ceiling on cost is CHAT_AGENT_MAX_ROUNDS; this is only a
# backstop against a runaway loop.
CHAT_AGENT_MAX_TOTAL_TOKENS = 120000


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
class ChatCandidateOption:
    id: str
    label: str
    title: str
    body: str
    tradeoff: str
    item_id: str
    patch: dict[str, Any]


@dataclass(frozen=True)
class ChatResult:
    reply: str
    proposed_change: ProposedChatChange | None
    candidate_options: tuple[ChatCandidateOption, ...] = ()


def respond_to_trip_chat(
    db: Session,
    *,
    trip_id: str,
    membership: TripMembership,
    message: str,
    item_id: str | None = None,
    history: tuple[chat_agent.HistoryTurn, ...] = (),
) -> ChatResult:
    if membership.trip_id != trip_id:
        raise ChatAccessDenied("This membership does not belong to this trip")

    trip = db.get(Trip, trip_id)
    if trip is None:
        raise ChatTripNotFound("Trip not found")

    items = _trip_items(db, trip_id)
    selected = _selected_item(items, item_id)

    return _respond_with_agent_branch(
        db=db,
        trip_id=trip_id,
        membership=membership,
        message=message,
        items=items,
        selected=selected,
        history=history,
    )


def _respond_with_agent_branch(
    *,
    db: Session,
    trip_id: str,
    membership: TripMembership,
    message: str,
    items: list[PlanItem],
    selected: PlanItem | None = None,
    history: tuple[chat_agent.HistoryTurn, ...] = (),
) -> ChatResult:
    try:
        result = _run_chat_agent_with_timeout(
            db=db,
            trip_id=trip_id,
            membership=membership,
            message=_agent_user_message(message, selected),
            history=history,
        )
    except Exception:
        return _degraded_reply(message, items, selected)

    if result.stopped_reason:
        return _degraded_reply(message, items, selected)
    reply = (result.content or "").strip()
    if not reply:
        return _degraded_reply(message, items, selected)
    if chat_agent._claims_change_completed(reply):
        reply = _safe_pending_agent_reply(message)

    candidates = _candidate_options_from_agent(result.tool_results)
    explicit = _proposed_change_from_agent_classification(
        db=db,
        items=items,
        membership=membership,
        tool_results=result.tool_results,
    )
    if explicit is not None:
        return ChatResult(
            reply=reply,
            proposed_change=explicit,
            candidate_options=candidates,
        )

    proposed = _proposed_change_from_candidates(db, items, membership, candidates)
    return ChatResult(reply=reply, proposed_change=proposed, candidate_options=candidates)


def _agent_user_message(message: str, selected: PlanItem | None) -> str:
    """Carry the UI selection into the agent turn.

    The traveler can click an item and then say "this one". Without the
    selection the agent only sees the pronoun.
    """
    if selected is None:
        return message
    return (
        f'[The traveler has "{selected.title}" selected on screen. Resolve "this" '
        f"or \"it\" to that item unless they name a different one.]\n\n{message}"
    )


def _degraded_reply(
    message: str, items: list[PlanItem], selected: PlanItem | None
) -> ChatResult:
    """Answer without tools when the agent times out, errors, or returns nothing.

    A plain answer built from the itinerary already in hand beats asking the
    traveler to repeat themselves.
    """
    try:
        reply = chat_agent.answer_question(
            chat_agent.QuestionInput(
                message=message,
                item=_item_context(selected) if selected else None,
                itinerary=tuple(_item_context(item) for item in items),
            )
        ).text
    except base.AgentUnavailable:
        reply = chat_agent.no_change_reply()
    return ChatResult(reply=reply, proposed_change=None)


def _safe_pending_agent_reply(message: str) -> str:
    """Replace unsafe agent claims that imply a change already happened.

    Agent-branch replies do not always have a verdict yet, so this safety
    fallback states only the product invariant: the assistant prepared/checks a
    possible change, but nothing is submitted or applied until the traveler
    clicks Apply in the UI.
    """
    if _contains_chinese(message):
        return (
            "我可以帮你准备这个改动，但当前行程还没有改变。需要你点击 Apply "
            "后才会提交，之后才会进入对应的小组流程。"
        )
    return (
        "I can help prepare this change, but the Current Plan has not changed. "
        "It is not submitted until you click Apply in the product UI."
    )


def _contains_chinese(value: str) -> bool:
    return any("\u4e00" <= char <= "\u9fff" for char in value)


def _run_chat_agent_with_timeout(
    *,
    db: Session,
    trip_id: str,
    membership: TripMembership,
    message: str,
    history: tuple[chat_agent.HistoryTurn, ...] = (),
) -> base.AgentRunResult:
    tools = build_read_only_trip_tools(
        db,
        trip_id=trip_id,
        actor_membership_id=membership.id,
    )
    executor = ThreadPoolExecutor(max_workers=1)
    future = executor.submit(
        base.call_agent,
        system=_agent_system_prompt(),
        user=message,
        tools=tools,
        history=tuple(
            {"role": turn.role, "content": turn.text} for turn in history
        ),
        max_rounds=CHAT_AGENT_MAX_ROUNDS,
        max_total_tokens=CHAT_AGENT_MAX_TOTAL_TOKENS,
    )
    try:
        return future.result(timeout=CHAT_AGENT_TIMEOUT_SECONDS)
    except TimeoutError as exc:
        future.cancel()
        raise TimeoutError("chat agent timed out") from exc
    finally:
        executor.shutdown(wait=False, cancel_futures=True)


def _agent_system_prompt() -> str:
    """The one definition of the agent's system prompt.

    The manual trace scripts under app/agents/agent-server/ import this rather
    than keeping their own copy. They used to carry a separate wording, and the
    two drifted apart in both directions, so a scripted validation run was no
    longer evidence about production behavior.
    """
    return (
        "You are Cadensy's read-only trip assistant.\n"
        "\n"
        "Rules:\n"
        "1. Answer in English only.\n"
        "2. Before answering any itinerary question, verify facts with tools. "
        "Do not guess.\n"
        "3. Use only facts returned by tools. Do not invent items, times, dates, "
        "places, member details, membership ids, or private preference wording.\n"
        "4. If suggesting a move to another day, inspect that day before judging "
        "whether it has room.\n"
        "5. For fuzzy requests to make a day easier or to offer compromises, call "
        "propose_options after checking the Current Plan.\n"
        "6. For a specific proposed change, call classify_change and follow its "
        "result. Do not choose a decision path yourself.\n"
        "7. Do not say the Current Plan has changed. Changes require user action "
        "in the product UI.\n"
    )


def _candidate_options_from_agent(
    tool_results: tuple[dict[str, Any], ...]
) -> tuple[ChatCandidateOption, ...]:
    options: list[ChatCandidateOption] = []
    for result in tool_results:
        if result.get("tool") != "propose_options" or result.get("guard_rejected"):
            continue
        output = result.get("output")
        if not isinstance(output, dict):
            continue
        for option in output.get("options") or ():
            if not isinstance(option, dict):
                continue
            patch = option.get("patch") if isinstance(option.get("patch"), dict) else {}
            options.append(
                ChatCandidateOption(
                    id=str(option.get("id") or ""),
                    label=str(option.get("label") or ""),
                    title=str(option.get("title") or ""),
                    body=str(option.get("body") or ""),
                    tradeoff=str(option.get("tradeoff") or ""),
                    item_id=str(option.get("item_id") or ""),
                    patch=_normalize_patch(patch),
                )
            )
    return tuple(options)


def _proposed_change_from_candidates(
    db: Session,
    items: list[PlanItem],
    membership: TripMembership,
    candidates: tuple[ChatCandidateOption, ...],
) -> ProposedChatChange | None:
    item_by_id = {item.id: item for item in items}
    for candidate in candidates:
        target = item_by_id.get(candidate.item_id)
        if target is None or not candidate.patch:
            continue
        verdict = orch.classify_change(db, target, candidate.patch, membership.id)
        return ProposedChatChange(
            item_id=target.id,
            item_title=target.title,
            patch=candidate.patch,
            verdict=verdict,
        )
    return None


def _proposed_change_from_agent_classification(
    *,
    db: Session,
    items: list[PlanItem],
    membership: TripMembership,
    tool_results: tuple[dict[str, Any], ...],
) -> ProposedChatChange | None:
    item_by_id = {item.id: item for item in items}
    for result in reversed(tool_results):
        if result.get("tool") != "classify_change" or result.get("guard_rejected"):
            continue
        output = result.get("output")
        if not isinstance(output, dict):
            continue
        item_payload = output.get("item")
        patch_payload = output.get("proposed_patch")
        if not isinstance(item_payload, dict) or not isinstance(patch_payload, dict):
            continue
        target = item_by_id.get(str(item_payload.get("id") or ""))
        patch = _normalize_patch(patch_payload)
        if target is None or not patch:
            continue
        verdict = orch.classify_change(db, target, patch, membership.id)
        return ProposedChatChange(
            item_id=target.id,
            item_title=target.title,
            patch=patch,
            verdict=verdict,
        )
    return None


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


def _normalize_patch(patch: dict[str, Any]) -> dict[str, Any]:
    allowed = {
        "title",
        "place",
        "start_hour",
        "day_date",
        "duration_min",
        "price_per_person",
        "lat",
        "lng",
    }
    normalized: dict[str, Any] = {}
    for key, value in patch.items():
        if key not in allowed or value in (None, ""):
            continue
        if key == "day_date" and isinstance(value, str):
            try:
                value = date.fromisoformat(value)
            except ValueError:
                continue
        normalized[key] = value
    return normalized

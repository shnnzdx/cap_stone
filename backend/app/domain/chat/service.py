from __future__ import annotations

from concurrent.futures import ThreadPoolExecutor, TimeoutError
from dataclasses import dataclass
from datetime import date
from difflib import SequenceMatcher
from typing import Any

from sqlalchemy import select
from sqlalchemy.orm import Session

from ...agents import base
from ...agents import chat as chat_agent
from ...agents.tools import build_read_only_trip_tools
from data.poi_chicago import POIS
from ...db.models import Plan, PlanItem, Trip, TripMembership
from ..constraints.types import Classification
from ..decisions import orchestrator as orch

CHAT_AGENT_TIMEOUT_SECONDS = 20.0
CHAT_AGENT_MAX_ROUNDS = 8


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
        max_total_tokens=20000,
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


def _needs_agent_resolution(
    *,
    message: str,
    understanding: chat_agent.Understanding,
    selected: PlanItem | None,
) -> bool:
    text = message.lower()
    cross_day = any(
        token in text
        for token in (
            "tomorrow",
            "monday",
            "tuesday",
            "thursday",
            "friday",
            "saturday",
            "sunday",
            "周一",
            "周二",
            "周四",
            "周五",
            "周六",
            "周日",
        )
    ) and any(token in text for token in ("move", "reschedule", "挪", "改到"))
    if cross_day and selected is None:
        return True

    day_value = understanding.patch.get("day_date")
    if isinstance(day_value, str):
        try:
            date.fromisoformat(day_value)
        except ValueError:
            return True
    return False


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


_CHANGE_WORDS = (
    "change",
    "move",
    "replace",
    "remove",
    "switch",
    "reschedule",
    "shift",
    "postpone",
    "edit",
    "skip",
    "cancel",
    "instead",
    "later",
    "earlier",
    "改",
    "挪",
    "换",
    "太满",
    "松一点",
    # Movement expressed as verb + particle. Chinese does not separate these
    # with spaces, so the bare verb is too weak to match on its own.
    "放到",
    "放去",
    "挪到",
    "推到",
    "调到",
    "换到",
    "改到",
    "改成",
    "移到",
    "提前",
    "延后",
    "早点",
    "晚点",
    "早一点",
    "晚一点",
)

_CHANGE_PHRASES = (
    "can we",
    "could we",
    "i want",
    "let's",
    "how about",
    "what if",
    "能不能",
    "能否",
    "可不可以",
    "行不行",
)

# Replies that carry no request of their own. They either agree to what was
# just offered or hand the choice back to us, so the intent has to be
# inherited from what the user asked for earlier in the conversation.
_CONTINUATIONS = frozenset(
    {
        "ok",
        "okay",
        "yes",
        "yep",
        "yeah",
        "sure",
        "y",
        "whatever",
        "anything",
        "you pick",
        "up to you",
        "好",
        "好的",
        "好啊",
        "行",
        "可以",
        "嗯",
        "对",
        "是",
        "同意",
        "随便",
        "都行",
        "都可以",
        "你决定",
        "你选",
        "看你",
    }
)


def _mentions_change(text: str) -> bool:
    lowered = text.lower()
    if any(word in lowered for word in _CHANGE_WORDS):
        return True
    if any(phrase in lowered for phrase in _CHANGE_PHRASES):
        return True
    # "可以…吗" is the most common way to ask for a change in Chinese, but
    # "可以" and "吗" are both far too common to match on their own.
    if "可以" in lowered and "吗" in lowered:
        return True
    return False


def _is_continuation(text: str) -> bool:
    stripped = text.strip().strip(".!?。！？，, ").lower()
    return stripped in _CONTINUATIONS


def _looks_like_change_request(
    message: str, history: tuple[chat_agent.HistoryTurn, ...] = ()
) -> bool:
    """Decide whether this turn should be routed to the change path.

    Only the user's own words count. Matching against assistant replies too
    let the assistant trigger the change path with its own wording.

    A false positive here is cheap: understand() still classifies the intent
    and a non-change lands back on answer_question(). A false negative is not,
    because the model then answers with no tools at all and can only offer to
    look something up it has no way to look up.
    """
    if _mentions_change(message):
        return True
    if _is_continuation(message):
        return any(
            _mentions_change(turn.text) for turn in history if turn.role == "user"
        )
    return False


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


def _replacement_candidates(
    items: list[PlanItem], selected: PlanItem | None
) -> tuple[chat_agent.CandidateContext, ...]:
    if selected is None:
        return ()
    existing_titles = {item.title for item in items if item.id != selected.id}
    end_hour = selected.start_hour + selected.duration_min / 60
    candidates = []
    for title, place, lat, lng, price, _duration, opens, closes, _walk, _access, _diet, tags in POIS:
        if title == selected.title or title in existing_titles:
            continue
        if opens > selected.start_hour or closes < end_hour:
            continue
        candidates.append(
            chat_agent.CandidateContext(
                title=title,
                place=place,
                price_per_person=float(price),
                lat=float(lat),
                lng=float(lng),
                opens=float(opens),
                closes=float(closes),
                tags=tuple(tags),
            )
        )
    return tuple(candidates)


def _resolve_catalog_replacement(
    *,
    target: PlanItem,
    message: str,
    history: tuple[chat_agent.HistoryTurn, ...],
    candidates: tuple[chat_agent.CandidateContext, ...],
    patch: dict[str, Any],
) -> dict[str, Any]:
    text = " ".join([*(turn.text for turn in history), message]).lower()
    replacement = any(word in text for word in ("replace", "switch", "换", "替换", "别的", "other"))
    if not replacement:
        return patch

    exact = next((candidate for candidate in candidates if candidate.title == patch.get("title")), None)
    explicitly_named = exact is not None and exact.title.lower() in text
    generic_or_unchanged = patch.get("title") in (None, target.title)
    delegated = any(
        word in message.lower()
        for word in ("any", "choose", "whatever", "go ahead", "do", "随便", "你选", "可以")
    )
    has_preferences = any(
        word in text
        for word in ("downtown", "市中心", "michigan", "密歇根", "cafe", "coffee", "咖啡")
    )
    if not explicitly_named and not (delegated or has_preferences):
        return {}
    if exact is None and not (generic_or_unchanged or delegated or has_preferences):
        return patch

    chosen = exact if explicitly_named else _rank_candidate(candidates, text)
    if chosen is None:
        return {}
    resolved = dict(patch)
    resolved.update(
        title=chosen.title,
        place=chosen.place,
        price_per_person=chosen.price_per_person,
        lat=chosen.lat,
        lng=chosen.lng,
    )
    return resolved


def _rank_candidate(
    candidates: tuple[chat_agent.CandidateContext, ...], text: str
) -> chat_agent.CandidateContext | None:
    downtown_places = {
        "loop", "michigan avenue", "magnificent mile", "river north", "streeterville",
        "millennium park", "chicago river dock", "chicago riverwalk", "grant park",
    }

    def score(candidate: chat_agent.CandidateContext) -> tuple[int, float, str]:
        value = 0
        is_cafe = "cafe" in candidate.title.lower() or "starbucks" in candidate.title.lower() or "coffee" in candidate.tags
        if any(word in text for word in ("cafe", "coffee", "咖啡")) and is_cafe:
            value += 100
        if any(word in text for word in ("michigan", "密歇根")) and candidate.place.lower() in {
            "michigan avenue", "magnificent mile", "streeterville"
        }:
            value += 60
        if "downtown" in text or "市中心" in text:
            if candidate.place.lower() in downtown_places:
                value += 40
        if "food" in candidate.tags:
            value += 5
        return value, -candidate.price_per_person, candidate.title

    return max(candidates, key=score, default=None)

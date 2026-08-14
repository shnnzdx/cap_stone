"""Read-only domain tools for the tool-calling agent harness.

The functions here bind database identity in Python closures. Model-visible
tool schemas never include membership ids, user ids, names, or raw preference
wording. Every handler returns data that is safe to feed back to the model.
"""

from __future__ import annotations

import json
from datetime import date
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .base import AgentRunState, AgentTool, safe_context
from ..db.models import Plan, PlanItem, Trip, TripMembership
from ..domain.decisions import orchestrator


def build_read_only_trip_tools(
    db: Session, *, trip_id: str, actor_membership_id: str
) -> tuple[AgentTool, ...]:
    """Build read-only tools for one trip and actor.

    The returned tools must not be exposed outside ``call_agent``. They are
    intentionally scoped by closure so the model cannot see, choose, or forge
    ``actor_membership_id``.
    """
    _require_trip_membership(db, trip_id, actor_membership_id)

    def get_current_plan(day: str = "all") -> dict[str, Any]:
        return _get_current_plan(db, trip_id, day)

    def get_trip_facts() -> dict[str, Any]:
        return _get_trip_facts(db, trip_id)

    def classify_change(
        item_title: str,
        new_start_hour: float | None = None,
        day: str | None = None,
        item_id: str | None = None,
        new_day_date: str | None = None,
        new_duration_min: int | None = None,
    ) -> dict[str, Any]:
        found = _find_plan_item(db, trip_id, item_title, day, item_id)
        if isinstance(found, dict):
            return found
        item = found
        patch = _change_patch(
            new_start_hour=new_start_hour,
            new_day_date=new_day_date,
            new_duration_min=new_duration_min,
        )
        verdict = orchestrator.classify_change(
            db,
            item,
            patch,
            actor_membership_id,
        )
        return _classification_result(item, patch, verdict)

    def propose_options(conflict_description: str, day: str = "all") -> dict[str, Any]:
        return _propose_options(db, trip_id, conflict_description, day)

    return (
        AgentTool(
            name="get_current_plan",
            description=(
                "Look up the actual Current Plan for one day or all days. Use this "
                "before answering itinerary questions or checking a requested change. "
                "The day can be an ISO date, a day index such as 'day 2', a weekday "
                "name, or 'all'. Returns each item's id, title, place, start time, "
                "end time, and duration, plus date, settledness, meal flag, price, "
                "and safe tags."
            ),
            parameters={
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "day": {
                        "type": "string",
                        "description": "Day to inspect, for example 'all', 'Wednesday', or '2026-08-19'.",
                    }
                },
                "required": ["day"],
            },
            handler=get_current_plan,
        ),
        AgentTool(
            name="get_trip_facts",
            description=(
                "Return safe trip facts: destination, date window, status, member count, "
                "currency, and Current Plan estimated total. It never returns member identities."
            ),
            parameters={
                "type": "object",
                "additionalProperties": False,
                "properties": {},
                "required": [],
            },
            handler=get_trip_facts,
        ),
        AgentTool(
            name="classify_change",
            description=(
                "Classify a proposed itinerary change and return the required decision "
                "path. Never writes to the database. Returns one of: notice, meaning no "
                "conflict and the change can be applied while the group is notified; "
                "round, meaning the change is contested and the group needs to vote; "
                "reopen_round, meaning a settled choice needs a new group vote; or "
                "confirm, meaning the change hits a hard constraint or confirmed booking "
                "and affected members must confirm first. Pass item_id from "
                "get_current_plan. For a cross-day move, set day to the item's CURRENT "
                "day and put the target date in new_day_date."
            ),
            parameters=_change_parameters(),
            handler=classify_change,
            guard=_requires_current_plan_guard("classify_change"),
        ),
        AgentTool(
            name="propose_options",
            description=(
                "Generate safe, executable compromise options for a scheduling conflict. "
                "Call get_current_plan first. Returns an options array. Each option has "
                "id, kind, label, title, body, tradeoff, item_id, and patch. The response "
                "includes fixed Keep current and Split up options plus targeted options "
                "with real item_id values and patch objects. It never writes a real voting round."
            ),
            parameters={
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "conflict_description": {
                        "type": "string",
                        "description": "Short conflict summary grounded in get_current_plan facts.",
                    },
                    "day": {
                        "type": "string",
                        "description": "Relevant day to loosen or inspect, e.g. Wednesday or all.",
                    },
                },
                "required": ["conflict_description"],
            },
            handler=propose_options,
            guard=_requires_current_plan_guard("propose_options"),
        ),
    )


def _change_parameters() -> dict[str, Any]:
    return {
        "type": "object",
        "additionalProperties": False,
        "properties": {
            "item_title": {
                "type": "string",
                "description": "Exact or close title from get_current_plan.",
            },
            "item_id": {
                "type": "string",
                "description": "Preferred exact item id from get_current_plan.",
            },
            "new_start_hour": {
                "type": "number",
                "description": "Proposed new start hour in 24-hour time, e.g. 10 or 14.5.",
            },
            "new_day_date": {
                "type": "string",
                "description": "Target ISO date for a cross-day move, e.g. 2026-08-20.",
            },
            "new_duration_min": {
                "type": "integer",
                "description": "Target duration in minutes when shortening or lengthening an item.",
            },
            "day": {
                "type": "string",
                "description": "Optional source day used only to disambiguate duplicate item titles.",
            },
        },
        "required": ["item_title"],
    }


def _requires_current_plan_guard(tool_name: str):
    def guard(state: AgentRunState, arguments: dict[str, Any]) -> str | None:
        if any(call.get("name") == "get_current_plan" for call in state.called_tools):
            return None
        day = str(arguments.get("day") or "all")
        return (
            f"Cannot call {tool_name} yet: you have not checked the Current Plan. "
            f"Please call get_current_plan(day='{day}') first, use the real itinerary "
            "facts it returns, then retry."
        )

    return guard


def _require_trip_membership(db: Session, trip_id: str, membership_id: str) -> None:
    membership = db.get(TripMembership, membership_id)
    if membership is None or membership.trip_id != trip_id:
        raise ValueError("Membership does not belong to this trip")


def _active_plan(db: Session, trip_id: str) -> Plan:
    plan = db.scalar(
        select(Plan)
        .where(Plan.trip_id == trip_id, Plan.status == "active")
        .order_by(Plan.created_at.desc())
    )
    if plan is None:
        raise ValueError("No Current Plan exists for this trip")
    return plan


def _get_current_plan(db: Session, trip_id: str, day: str) -> dict[str, Any]:
    plan = _active_plan(db, trip_id)
    trip = db.get(Trip, trip_id)
    items = db.scalars(
        select(PlanItem)
        .where(PlanItem.plan_id == plan.id)
        .order_by(PlanItem.day_index, PlanItem.start_hour, PlanItem.title)
    ).all()
    target = _resolve_day_filter(trip, day)
    if target is not None:
        items = [item for item in items if _item_matches_day(trip, item, target)]

    days: dict[int, list[dict[str, Any]]] = {}
    for item in items:
        days.setdefault(item.day_index, []).append(_safe_item(item))

    return {
        "plan_status": plan.status,
        "day_query": day,
        "days": [
            {
                "day_index": day_index,
                "day_date": _canonical_day_date(trip, day_index, day_items),
                "items": day_items,
            }
            for day_index, day_items in sorted(days.items())
        ],
    }


def _get_trip_facts(db: Session, trip_id: str) -> dict[str, Any]:
    trip = db.get(Trip, trip_id)
    if trip is None:
        raise ValueError("Trip not found")
    plan = db.scalar(select(Plan).where(Plan.trip_id == trip_id, Plan.status == "active"))
    member_count = db.scalar(
        select(func.count()).select_from(TripMembership).where(TripMembership.trip_id == trip_id)
    )
    return {
        "destination": trip.destination,
        "status": trip.status,
        "preferred_start_date": trip.preferred_start_date.isoformat()
        if trip.preferred_start_date
        else None,
        "preferred_end_date": trip.preferred_end_date.isoformat()
        if trip.preferred_end_date
        else None,
        "member_count": int(member_count or 0),
        "currency": trip.currency,
        "estimated_total_per_person": plan.estimated_total_per_person if plan else None,
    }


def _safe_item(item: PlanItem) -> dict[str, Any]:
    end_hour = _end_hour(item.start_hour, item.duration_min)
    return {
        "id": item.id,
        "title": item.title,
        "place": item.place,
        "day_index": item.day_index,
        "day_date": item.day_date.isoformat(),
        "start_hour": item.start_hour,
        "start_time_label": _hour_label(item.start_hour),
        "end_hour": end_hour,
        "end_time_label": _hour_label(end_hour) if end_hour is not None else None,
        "time_range_label": _time_range_label(item.start_hour, end_hour),
        "duration_min": item.duration_min,
        "price_per_person": item.price_per_person,
        "settledness": item.settledness,
        "is_meal": item.is_meal,
        "tags": item.tags or [],
        "dietary_tags": item.dietary_tags or [],
    }


def _change_patch(
    *,
    new_start_hour: float | None,
    new_day_date: str | None,
    new_duration_min: int | None,
) -> dict[str, Any]:
    patch: dict[str, Any] = {}
    if new_start_hour is not None:
        patch["start_hour"] = float(new_start_hour)
    if new_day_date:
        patch["day_date"] = date.fromisoformat(new_day_date)
    if new_duration_min is not None:
        patch["duration_min"] = int(new_duration_min)
    return patch


def _classification_result(item: PlanItem, patch: dict[str, Any], verdict: Any) -> dict[str, Any]:
    safe = safe_context(verdict)
    return {
        "item": _safe_item(item),
        "proposed_patch": _json_safe(patch),
        "classification": {
            "path": safe.path,
            "headline": _model_safe_text(safe.headline),
            "detail": _model_safe_text(safe.detail),
            "blocked_by": list(safe.blocked_by),
            "findings": [
                {"text": text, "affected_count": count}
                for text, count in zip(safe.findings, safe.affected_counts)
            ],
        },
    }


def _tool_error(code: str, message: str) -> dict[str, str]:
    return {"error": code, "message": message}


def _json_safe(value: Any) -> Any:
    return json.loads(json.dumps(value, ensure_ascii=False, default=str))


def _model_safe_text(value: str) -> str:
    return value.replace(
        "Who they are and why stays private.",
        "Individual identities and reasons are not shared.",
    )


def _find_plan_item(
    db: Session,
    trip_id: str,
    item_title: str,
    day: str | None = None,
    item_id: str | None = None,
) -> PlanItem | dict[str, Any]:
    plan = _active_plan(db, trip_id)
    query = (
        select(PlanItem)
        .where(PlanItem.plan_id == plan.id)
        .order_by(PlanItem.day_index, PlanItem.start_hour, PlanItem.title)
    )
    items = list(db.scalars(query).all())
    trip = db.get(Trip, trip_id)
    if item_id:
        matching_id = [item for item in items if item.id == item_id]
        if matching_id:
            return matching_id[0]
        return _tool_error(
            "item_not_found",
            f"No Current Plan item has id '{item_id}'. Call get_current_plan and retry with a real item id.",
        )

    needle = _normalize_title(item_title)
    exact = [item for item in items if _normalize_title(item.title) == needle]
    if len(exact) == 1:
        return exact[0]
    contains = [
        item
        for item in items
        if needle in _normalize_title(item.title) or _normalize_title(item.title) in needle
    ]
    candidates = exact or contains
    if len(candidates) == 1:
        return candidates[0]
    if len(candidates) > 1:
        target = _resolve_day_filter(trip, day or "")
        if target is not None:
            narrowed = [item for item in candidates if _item_matches_day(trip, item, target)]
            if len(narrowed) == 1:
                return narrowed[0]
        return {
            "error": "ambiguous_item",
            "message": (
                f"Multiple Current Plan items match '{item_title}'. Retry with item_id "
                "from get_current_plan, or include the source day."
            ),
            "matches": [_safe_item(item) for item in candidates],
        }
    return _tool_error(
        "item_not_found",
        f"No Current Plan item matches '{item_title}'. Call get_current_plan and retry with an exact title or item_id.",
    )


def _propose_options(
    db: Session, trip_id: str, conflict_description: str, day: str
) -> dict[str, Any]:
    plan = _active_plan(db, trip_id)
    trip = db.get(Trip, trip_id)
    items = list(
        db.scalars(
            select(PlanItem)
            .where(PlanItem.plan_id == plan.id)
            .order_by(PlanItem.day_index, PlanItem.start_hour, PlanItem.title)
        ).all()
    )
    target = _resolve_day_filter(trip, day)
    day_items = [item for item in items if target is None or _item_matches_day(trip, item, target)]
    if not day_items:
        return _tool_error(
            "no_items_for_day",
            f"No Current Plan items were found for day '{day}'. Call get_current_plan and retry.",
        )

    movable = [item for item in day_items if item.settledness != "booked"]
    heaviest = max(movable or day_items, key=lambda item: item.duration_min or 0)
    target_day = _next_trip_date(trip, heaviest.day_date, [item.day_date for item in items])
    options = [
        {
            "id": "keep",
            "kind": "fixed",
            "label": "Keep current",
            "title": "Keep the Current Plan",
            "body": "Leave the itinerary unchanged.",
            "tradeoff": "The day stays as busy as it is now.",
            "item_id": heaviest.id,
            "patch": {},
        }
    ]

    if target_day is not None:
        options.append(
            {
                "id": "move-heaviest-next-day",
                "kind": "ai_generated",
                "label": "Move one activity",
                "title": f"Move {heaviest.title} to {_weekday_label(target_day)}",
                "body": (
                    f"Move {heaviest.title} from {_weekday_label(heaviest.day_date)} "
                    f"to {_weekday_label(target_day)} while keeping its current start time."
                ),
                "tradeoff": "This lightens the crowded day but makes the target day busier.",
                "item_id": heaviest.id,
                "patch": {"day_date": target_day.isoformat()},
            }
        )

    if heaviest.duration_min and heaviest.duration_min > 60:
        shorter = max(60, heaviest.duration_min - 60)
        options.append(
            {
                "id": "shorten-heaviest",
                "kind": "ai_generated",
                "label": "Shorten one activity",
                "title": f"Shorten {heaviest.title}",
                "body": f"Reduce {heaviest.title} from {heaviest.duration_min} minutes to {shorter} minutes.",
                "tradeoff": "The group gets more breathing room but less time at that stop.",
                "item_id": heaviest.id,
                "patch": {"duration_min": shorter},
            }
        )

    options.append(
        {
            "id": "split",
            "kind": "fixed",
            "label": "Split up",
            "title": "Split for this block",
            "body": "Let part of the group keep the activity while others take a break, then regroup afterwards.",
            "tradeoff": "This protects different energy levels but the group separates briefly.",
            "item_id": heaviest.id,
            "patch": {"split": True},
        }
    )
    return {
        "conflict_description": conflict_description,
        "source_day_query": day,
        "source_items": [_safe_item(item) for item in day_items],
        "options": options,
    }


def _resolve_day_filter(trip: Trip | None, day: str) -> date | int | None:
    cleaned = (day or "").strip().lower()
    if not cleaned or cleaned in {"all", "entire trip", "whole trip"}:
        return None
    if cleaned.startswith("day "):
        suffix = cleaned.removeprefix("day ").strip()
        if suffix.isdigit():
            return int(suffix)
    if cleaned.isdigit():
        return int(cleaned)
    try:
        return date.fromisoformat(cleaned)
    except ValueError:
        pass
    if trip and trip.preferred_start_date and trip.preferred_end_date:
        cursor = trip.preferred_start_date
        while cursor <= trip.preferred_end_date:
            if cursor.strftime("%A").lower() == cleaned:
                return cursor
            cursor = date.fromordinal(cursor.toordinal() + 1)
    return cleaned


def _item_matches_day(trip: Trip | None, item: PlanItem, target: date | int | str) -> bool:
    if isinstance(target, int):
        return item.day_index == target
    if isinstance(target, date):
        return _canonical_item_date(trip, item) == target
    weekday = _canonical_item_date(trip, item).strftime("%A").lower()
    return weekday == target or item.day_date.strftime("%A").lower() == target


def _canonical_item_date(trip: Trip | None, item: PlanItem) -> date:
    if trip and trip.preferred_start_date:
        return date.fromordinal(trip.preferred_start_date.toordinal() + item.day_index - 1)
    return item.day_date


def _canonical_day_date(
    trip: Trip | None, day_index: int, items: list[dict[str, Any]]
) -> str | None:
    if trip and trip.preferred_start_date:
        return date.fromordinal(trip.preferred_start_date.toordinal() + day_index - 1).isoformat()
    return items[0]["day_date"] if items else None


def _normalize_title(value: str) -> str:
    return " ".join(value.lower().split())


def _end_hour(start_hour: float, duration_min: int | None) -> float | None:
    if duration_min is None:
        return None
    return round(start_hour + duration_min / 60, 2)


def _hour_label(hour: float | None) -> str | None:
    if hour is None:
        return None
    whole_hour = int(hour)
    minute = int(round((hour - whole_hour) * 60))
    if minute == 60:
        whole_hour += 1
        minute = 0
    display_hour = whole_hour % 12 or 12
    suffix = "AM" if whole_hour < 12 else "PM"
    return f"{display_hour}:{minute:02d} {suffix}"


def _time_range_label(start_hour: float, end_hour: float | None) -> str:
    start = _hour_label(start_hour)
    end = _hour_label(end_hour)
    if end is None:
        return f"{start} start"
    return f"{start}-{end}"


def _next_trip_date(
    trip: Trip | None, current: date, existing_dates: list[date] | None = None
) -> date | None:
    if trip and trip.preferred_end_date:
        candidate = date.fromordinal(current.toordinal() + 1)
        if candidate <= trip.preferred_end_date:
            return candidate
    for candidate in sorted(set(existing_dates or [])):
        if candidate > current:
            return candidate
    return None


def _weekday_label(value: date) -> str:
    return f"{value.strftime('%A')} ({value.isoformat()})"

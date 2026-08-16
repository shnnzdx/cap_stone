"""Read-only domain tools for the tool-calling agent harness.

The functions here bind database identity in Python closures. Model-visible
tool schemas never include membership ids, user ids, names, or raw preference
wording. Every handler returns data that is safe to feed back to the model.
"""

from __future__ import annotations

import json
import re
from datetime import date
from math import cos, radians, sqrt
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .base import AgentRunState, AgentTool, safe_context
from ..db.models import Plan, PlanItem, Trip, TripMembership
from ..domain.decisions import orchestrator
from ..domain.places import service as place_service

# Window a proposed option may move an item into. Options are suggestions the
# group still votes on, so this only has to be a sane waking day.
DAY_START_HOUR = 9.0
DAY_END_HOUR = 21.0
_WEEKDAY_CODES = ("Mo", "Tu", "We", "Th", "Fr", "Sa", "Su")
_REPLACEMENT_KEYWORD_ALIASES = {
    "relaxing": ("park", "garden", "nature", "lake", "waterfront"),
    "park": ("park", "garden", "nature"),
    "cafe": ("cafe", "coffee", "bakery"),
    "viewpoint": ("viewpoint", "lookout", "observation", "sights", "attraction"),
    "museum": ("museum", "gallery", "culture"),
}


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
        new_title: str | None = None,
        new_place: str | None = None,
        new_price_per_person: float | None = None,
        new_lat: float | None = None,
        new_lng: float | None = None,
    ) -> dict[str, Any]:
        found = _find_plan_item(db, trip_id, item_title, day, item_id)
        if isinstance(found, dict):
            return found
        item = found
        replacement_values = {
            "new_title": new_title,
            "new_place": new_place,
            "new_price_per_person": new_price_per_person,
            "new_lat": new_lat,
            "new_lng": new_lng,
        }
        required_replacement_values = {
            "new_title": new_title,
            "new_place": new_place,
            "new_lat": new_lat,
            "new_lng": new_lng,
        }
        if any(value is not None for value in replacement_values.values()) and not all(
            value is not None for value in required_replacement_values.values()
        ):
            missing = [
                key
                for key, value in required_replacement_values.items()
                if value is None
            ]
            return _tool_error(
                "incomplete_replacement",
                (
                    "Replacement venue fields must be provided together: "
                    "new_title, new_place, new_lat, and new_lng. "
                    "new_price_per_person is optional when the real provider result has no price. "
                    f"Missing: {', '.join(missing)}."
                ),
            )
        patch = _change_patch(
            new_start_hour=new_start_hour,
            new_day_date=new_day_date,
            new_duration_min=new_duration_min,
            new_title=new_title,
            new_place=new_place,
            new_price_per_person=new_price_per_person,
            new_lat=new_lat,
            new_lng=new_lng,
        )
        verdict = orchestrator.classify_change(
            db,
            item,
            patch,
            actor_membership_id,
        )
        return _classification_result(item, patch, verdict)

    def propose_options(
        conflict_description: str,
        day: str = "all",
        conflict_item_ids: list[str] | None = None,
        suggestions: list[dict[str, Any]] | None = None,
    ) -> dict[str, Any]:
        return _propose_options(
            db,
            trip_id,
            conflict_description,
            day,
            conflict_item_ids or [],
            suggestions or [],
            actor_membership_id,
        )

    def find_replacement_place(
        item_id: str, keywords: list[str] | None = None
    ) -> dict[str, Any]:
        return _find_replacement_place(db, trip_id, item_id, keywords or [])

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
                "day and put the target date in new_day_date. If the traveler wants to "
                "replace this item with another venue, first call find_replacement_place, "
                "choose a returned candidate, then pass that candidate using new_title, "
                "new_place, new_lat, and new_lng, plus new_price_per_person only when "
                "the tool returned a real price. Do not invent replacement venues or prices."
            ),
            parameters=_change_parameters(),
            handler=classify_change,
            guard=_requires_current_plan_guard("classify_change"),
        ),
        AgentTool(
            name="find_replacement_place",
            description=(
                "Find real replacement venues from the backend place service when the "
                "traveler wants to swap an itinerary item for a different place, not "
                "when they only want to change time, date, or duration. Call "
                "get_current_plan first and pass item_id from it. Returns candidates "
                "with candidate_id, title, place, price_per_person, opening_hours, "
                "opens, closes, lat, lng, and tags. price_per_person may be null when "
                "the provider has no trustworthy price. It excludes the current item, "
                "excludes places already used in the Current Plan, and excludes places "
                "whose known hours do not cover the item's current time block. You may "
                "pass keywords such as relaxing, park, cafe, viewpoint, or museum to "
                "filter candidates loosely; if no keyword matches, the tool returns all "
                "eligible candidates. After choosing a candidate, propose it with "
                "classify_change using new_title, new_place, new_lat, and new_lng, "
                "plus new_price_per_person only when the tool returned a real price."
            ),
            parameters={
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "item_id": {
                        "type": "string",
                        "description": "Exact item id from get_current_plan for the item to replace.",
                    },
                    "keywords": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": "Optional loose filters matched against candidate title, place, or tags.",
                    },
                },
                "required": ["item_id"],
            },
            handler=find_replacement_place,
            guard=_requires_current_plan_guard("find_replacement_place"),
        ),
        AgentTool(
            name="propose_options",
            description=(
                "Generate safe, executable compromise options for a scheduling conflict. "
                "Call get_current_plan first. Write your own options for this specific "
                "conflict in suggestions; they are validated against the real plan and "
                "shown to the group first, and generic fallback options are added after "
                "them. Pass conflict_item_ids with the ids of the "
                "items actually involved, otherwise the options will be built around the "
                "day's longest item, which is only correct when the request is that the "
                "whole day is too full. For an overlap between two items, pass both ids. "
                "Returns an options array where each option has id, kind, label, title, "
                "body, tradeoff, item_id, and patch, plus focus_item_id naming the item "
                "the options act on. Your suggestions are returned as the options; "
                "generic computed ones are only added when you supply none. Keeping "
                "the plan unchanged is always offered. It never writes a real voting round."
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
                    "conflict_item_ids": {
                        "type": "array",
                        "items": {"type": "string"},
                        "description": (
                            "Ids from get_current_plan of the items involved in this "
                            "conflict. Pass both sides of an overlap. Omit only when the "
                            "request is about the whole day being too full."
                        ),
                    },
                    "suggestions": {
                        "type": "array",
                        "description": (
                            "Your own options for this specific conflict, which are "
                            "shown to the group ahead of the generic ones. Each is "
                            "validated against the real plan and silently dropped if it "
                            "names an unknown item, carries no executable change, or "
                            "cannot be classified; check rejected_suggestions in the "
                            "response. Write title, body, and tradeoff in English."
                        ),
                        "items": {
                            "type": "object",
                            "additionalProperties": False,
                            "properties": {
                                "item_id": {
                                    "type": "string",
                                    "description": "Item this option changes, from get_current_plan.",
                                },
                                "start_hour": {
                                    "type": "number",
                                    "description": "New start hour in 24-hour time, e.g. 9.5.",
                                },
                                "day_date": {
                                    "type": "string",
                                    "description": "New ISO date when moving to another day.",
                                },
                                "duration_min": {
                                    "type": "integer",
                                    "description": "New duration in minutes.",
                                },
                                "label": {
                                    "type": "string",
                                    "description": "Two or three word button label, English.",
                                },
                                "title": {
                                    "type": "string",
                                    "description": "One line naming the change, English.",
                                },
                                "body": {
                                    "type": "string",
                                    "description": (
                                        "One or two sentences on what happens, English. "
                                        "Describe ONLY the change this option's own "
                                        "fields make to this one item. An option applies "
                                        "exactly one patch to one item, so never promise "
                                        "that a second item also moves."
                                    ),
                                },
                                "tradeoff": {
                                    "type": "string",
                                    "description": "One sentence on what the group gives up, English.",
                                },
                            },
                            "required": ["item_id", "title"],
                        },
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
            "new_title": {
                "type": "string",
                "description": (
                    "Replacement venue title. Use only when replacing this item with "
                    "another place. Must come from find_replacement_place and must be "
                    "provided together with new_place, new_lat, and new_lng."
                ),
            },
            "new_place": {
                "type": "string",
                "description": (
                    "Replacement venue area/place. Use only with new_title for a "
                    "candidate returned by find_replacement_place."
                ),
            },
            "new_price_per_person": {
                "type": "number",
                "description": (
                    "Replacement venue estimated price per person from "
                    "find_replacement_place. Optional when the provider returned no real "
                    "price. Do not invent this value."
                ),
            },
            "new_lat": {
                "type": "number",
                "description": (
                    "Replacement venue latitude from find_replacement_place. Required "
                    "when new_title is provided."
                ),
            },
            "new_lng": {
                "type": "number",
                "description": (
                    "Replacement venue longitude from find_replacement_place. Required "
                    "when new_title is provided."
                ),
            },
            "day": {
                "type": "string",
                "description": "Optional source day used only to disambiguate duplicate item titles.",
            },
        },
        "required": ["item_title"],
    }


def _inspected_plan_days(state: AgentRunState) -> set[str]:
    days: set[str] = set()
    for call in state.called_tools:
        if call.get("name") != "get_current_plan":
            continue
        arguments = call.get("arguments") if isinstance(call, dict) else {}
        day = "all"
        if isinstance(arguments, dict):
            day = str(arguments.get("day") or "all")
        days.add(day.strip().lower())
    return days


def _requires_current_plan_guard(tool_name: str):
    def guard(state: AgentRunState, arguments: dict[str, Any]) -> str | None:
        checked_days = _inspected_plan_days(state)
        day = str(arguments.get("day") or "all")
        if not checked_days:
            return (
                f"Cannot call {tool_name} yet: you have not checked the Current Plan. "
                f"Please call get_current_plan(day='{day}') first, use the real itinerary "
                "facts it returns, then retry."
            )
        target_day = str(arguments.get("new_day_date") or "").strip().lower()
        if (
            tool_name == "classify_change"
            and target_day
            and "all" not in checked_days
            and target_day not in checked_days
        ):
            return (
                f"Cannot call {tool_name} for a cross-day move yet: you have not checked "
                f"the target day {arguments.get('new_day_date')}. Please call "
                f"get_current_plan(day='{arguments.get('new_day_date')}') first, then retry."
            )
        return None

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
    new_title: str | None = None,
    new_place: str | None = None,
    new_price_per_person: float | None = None,
    new_lat: float | None = None,
    new_lng: float | None = None,
) -> dict[str, Any]:
    patch: dict[str, Any] = {}
    if new_start_hour is not None:
        patch["start_hour"] = float(new_start_hour)
    if new_day_date:
        patch["day_date"] = date.fromisoformat(new_day_date)
    if new_duration_min is not None:
        patch["duration_min"] = int(new_duration_min)
    if new_title is not None:
        patch["title"] = str(new_title)
    if new_place is not None:
        patch["place"] = str(new_place)
    if new_price_per_person is not None:
        patch["price_per_person"] = float(new_price_per_person)
    if new_lat is not None:
        patch["lat"] = float(new_lat)
    if new_lng is not None:
        patch["lng"] = float(new_lng)
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
    db: Session,
    trip_id: str,
    conflict_description: str,
    day: str,
    conflict_item_ids: list[str],
    suggestions: list[dict[str, Any]],
    actor_membership_id: str,
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

    focus = _option_focus(day_items, conflict_item_ids)
    target_day = _next_trip_date(trip, focus.day_date, [item.day_date for item in items])
    options = [
        {
            "id": "keep",
            "kind": "fixed",
            "label": "Keep current",
            "title": "Keep the Current Plan",
            "body": "Leave the itinerary unchanged.",
            "tradeoff": "The day stays as busy as it is now.",
            "item_id": focus.id,
            "patch": {},
        }
    ]

    # Caller-authored options come first: they are the ones written for this
    # specific conflict. Each one is validated against the real plan before it
    # can appear, because whatever ends up here can be applied by a group vote.
    accepted, rejected = _validated_suggestions(
        db, day_items, suggestions, actor_membership_id
    )
    options.extend(accepted)

    # The computed options below are a fallback, not a supplement. When the caller
    # wrote its own options for this specific conflict, adding three generic ones
    # underneath just buries them: a ballot people actually read is a short one.
    if accepted:
        return {
            "conflict_description": conflict_description,
            "source_day_query": day,
            "focus_item_id": focus.id,
            "source_items": [_safe_item(item) for item in day_items],
            "options": options,
            "rejected_suggestions": rejected,
        }

    # A time overlap is usually solved by moving the item within its own day, not
    # by pushing it to another day. Offer the free slot first when one exists.
    free_hour = _free_start_hour(day_items, focus)
    if free_hour is not None:
        options.append(
            {
                "id": "move-within-day",
                "kind": "computed",
                "label": "Use a free time",
                "title": f"Move {focus.title} to {_hour_label(free_hour)}",
                "body": (
                    f"Move {focus.title} from {_hour_label(focus.start_hour)} to "
                    f"{_hour_label(free_hour)} on the same day, where nothing else is booked."
                ),
                "tradeoff": "This keeps the day intact but changes when that stop happens.",
                "item_id": focus.id,
                "patch": {"start_hour": free_hour},
            }
        )

    if target_day is not None:
        options.append(
            {
                "id": "move-next-day",
                "kind": "computed",
                "label": "Move one activity",
                "title": f"Move {focus.title} to {_weekday_label(target_day)}",
                "body": (
                    f"Move {focus.title} from {_weekday_label(focus.day_date)} "
                    f"to {_weekday_label(target_day)} while keeping its current start time."
                ),
                "tradeoff": "This lightens the crowded day but makes the target day busier.",
                "item_id": focus.id,
                "patch": {"day_date": target_day.isoformat()},
            }
        )

    if focus.duration_min and focus.duration_min > 60:
        shorter = max(60, focus.duration_min - 60)
        options.append(
            {
                "id": "shorten",
                "kind": "computed",
                "label": "Shorten one activity",
                "title": f"Shorten {focus.title}",
                "body": f"Reduce {focus.title} from {focus.duration_min} minutes to {shorter} minutes.",
                "tradeoff": "The group gets more breathing room but less time at that stop.",
                "item_id": focus.id,
                "patch": {"duration_min": shorter},
            }
        )

    return {
        "conflict_description": conflict_description,
        "source_day_query": day,
        "focus_item_id": focus.id,
        "source_items": [_safe_item(item) for item in day_items],
        "options": options,
        "rejected_suggestions": rejected,
    }


_SUGGESTION_PATCH_FIELDS = ("start_hour", "day_date", "duration_min")


def _validated_suggestions(
    db: Session,
    day_items: list[PlanItem],
    suggestions: list[dict[str, Any]],
    actor_membership_id: str,
) -> tuple[list[dict[str, Any]], list[dict[str, str]]]:
    """Turn caller-written suggestions into options, dropping anything unusable.

    Whatever survives here can be applied to the real itinerary once the group
    votes for it, so a suggestion has to name a real item, carry a patch this
    backend knows how to execute, and survive classification. Rejections are
    reported back rather than swallowed, so the caller can see what was dropped.
    """
    by_id = {item.id: item for item in day_items}
    accepted: list[dict[str, Any]] = []
    rejected: list[dict[str, str]] = []

    for index, raw in enumerate(suggestions):
        if not isinstance(raw, dict):
            rejected.append({"suggestion": str(index), "reason": "not an object"})
            continue

        item = by_id.get(str(raw.get("item_id") or ""))
        if item is None:
            rejected.append(
                {
                    "suggestion": str(raw.get("title") or index),
                    "reason": "item_id is not an item on this day",
                }
            )
            continue

        patch, problem = _suggestion_patch(raw, item)
        if problem is not None:
            rejected.append(
                {"suggestion": str(raw.get("title") or index), "reason": problem}
            )
            continue

        # Classification reads and compares real rows, so a bad value can abort the
        # transaction. The savepoint keeps one unusable suggestion from poisoning
        # the session for every later tool call in this same agent run.
        savepoint = db.begin_nested()
        try:
            orchestrator.classify_change(
                db, item, _classifiable_patch(patch), actor_membership_id
            )
            savepoint.rollback()
        except Exception:
            savepoint.rollback()
            rejected.append(
                {
                    "suggestion": str(raw.get("title") or index),
                    "reason": "the backend could not classify this change",
                }
            )
            continue

        accepted.append(
            {
                "id": f"suggested-{len(accepted) + 1}",
                "kind": "assistant",
                "label": str(raw.get("label") or "Suggested"),
                "title": str(raw.get("title") or "").strip() or "Suggested change",
                "body": str(raw.get("body") or "").strip(),
                "tradeoff": str(raw.get("tradeoff") or "").strip(),
                "item_id": item.id,
                "patch": patch,
            }
        )

    return accepted, rejected


def _suggestion_patch(
    raw: dict[str, Any], item: PlanItem
) -> tuple[dict[str, Any], str | None]:
    """Build an executable patch, or explain why the suggestion cannot become one."""
    patch: dict[str, Any] = {}

    start_hour = raw.get("start_hour")
    if start_hour is not None:
        try:
            start_hour = float(start_hour)
        except (TypeError, ValueError):
            return {}, "start_hour is not a number"
        if not DAY_START_HOUR <= start_hour <= DAY_END_HOUR:
            return {}, f"start_hour must be between {DAY_START_HOUR} and {DAY_END_HOUR}"
        patch["start_hour"] = start_hour

    day_date = raw.get("day_date")
    if day_date is not None:
        try:
            patch["day_date"] = date.fromisoformat(str(day_date)).isoformat()
        except ValueError:
            return {}, "day_date is not an ISO date"

    duration_min = raw.get("duration_min")
    if duration_min is not None:
        try:
            duration_min = int(duration_min)
        except (TypeError, ValueError):
            return {}, "duration_min is not a whole number"
        if duration_min <= 0:
            return {}, "duration_min must be positive"
        patch["duration_min"] = duration_min

    if not patch:
        return {}, "no executable change: give start_hour, day_date, or duration_min"
    if all(
        _unchanged(patch.get(field), getattr(item, field, None))
        for field in _SUGGESTION_PATCH_FIELDS
    ):
        return {}, "this suggestion does not change anything"
    return patch, None


def _classifiable_patch(patch: dict[str, Any]) -> dict[str, Any]:
    """Options travel as JSON, but classification compares against real columns.

    day_date is an ISO string in the tool output because that is what the caller
    and the frontend read; the decision engine needs a real date.
    """
    ready = dict(patch)
    if isinstance(ready.get("day_date"), str):
        ready["day_date"] = date.fromisoformat(ready["day_date"])
    return ready


def _unchanged(proposed: Any, current: Any) -> bool:
    if proposed is None:
        return True
    if isinstance(current, date):
        return str(proposed) == current.isoformat()
    return proposed == current


def _option_focus(day_items: list[PlanItem], conflict_item_ids: list[str]) -> PlanItem:
    """Pick the item the options should act on.

    The caller names the items actually involved in the conflict. Without that
    the only thing this can do is guess the day's longest item, which is right
    for "this day is too full" and wrong for every specific conflict.
    """
    by_id = {item.id: item for item in day_items}
    named = [by_id[item_id] for item_id in conflict_item_ids if item_id in by_id]
    movable_named = [item for item in named if item.settledness != "booked"]
    pool = movable_named or named
    if not pool:
        # No usable ids: fall back to the heaviest movable item of the day.
        pool = [item for item in day_items if item.settledness != "booked"] or day_items
    return max(pool, key=lambda item: item.duration_min or 0)


def _free_start_hour(day_items: list[PlanItem], focus: PlanItem) -> float | None:
    """Earliest start on the same day where the item fits without overlapping."""
    duration = (focus.duration_min or 60) / 60
    busy = [
        (item.start_hour, item.start_hour + (item.duration_min or 60) / 60)
        for item in day_items
        if item.id != focus.id
    ]
    hour = DAY_START_HOUR
    while hour + duration <= DAY_END_HOUR:
        clear = all(hour >= end or hour + duration <= start for start, end in busy)
        if clear and abs(hour - focus.start_hour) >= 0.25:
            return hour
        hour += 0.25
    return None


def _hour_label(hour: float) -> str:
    whole = int(hour)
    minutes = int(round((hour - whole) * 60))
    suffix = "AM" if whole < 12 else "PM"
    display = whole % 12 or 12
    return f"{display}:{minutes:02d} {suffix}"


def _find_replacement_place(
    db: Session, trip_id: str, item_id: str, keywords: list[str]
) -> dict[str, Any]:
    trip = db.get(Trip, trip_id)
    plan = _active_plan(db, trip_id)
    items = list(
        db.scalars(
            select(PlanItem)
            .where(PlanItem.plan_id == plan.id)
            .order_by(PlanItem.day_index, PlanItem.start_hour, PlanItem.title)
        ).all()
    )
    selected = next((item for item in items if item.id == item_id), None)
    if selected is None:
        return _tool_error(
            "item_not_found",
            f"No Current Plan item has id '{item_id}'. Call get_current_plan and retry with a real item id.",
        )

    destination = (trip.destination if trip is not None else "").strip()
    candidates = _replacement_candidates(
        items,
        selected,
        place_service.places_for_replacement(db, destination),
    )
    filtered = _filter_replacement_candidates(candidates, keywords)
    return {
        "item": _safe_item(selected),
        "keywords": list(keywords),
        "candidates": [_json_safe(_public_replacement_candidate(candidate)) for candidate in filtered],
    }

def _replacement_candidates(
    items: list[PlanItem],
    selected: PlanItem,
    places: tuple[place_service.PlannerPlace, ...],
) -> tuple[dict[str, Any], ...]:
    if selected.duration_min is None:
        return ()
    existing_titles = {_normalize_title(item.title) for item in items if item.id != selected.id}
    candidates: list[dict[str, Any]] = []
    for place in places:
        title = place.name.strip()
        if not title or _normalize_title(title) == _normalize_title(selected.title):
            continue
        if _normalize_title(title) in existing_titles:
            continue
        if _same_coordinates(place.latitude, place.longitude, selected.lat, selected.lng):
            continue
        if any(
            _same_coordinates(place.latitude, place.longitude, item.lat, item.lng)
            for item in items
            if item.id != selected.id
        ):
            continue
        intervals = _opening_intervals_for_date(place.opening_hours, selected.day_date)
        if not _time_block_is_supported(
            intervals,
            selected.start_hour,
            selected.duration_min,
        ):
            continue
        opens = closes = None
        if intervals and len(intervals) == 1:
            opens, closes = intervals[0]
        tags = _replacement_tags(place)
        candidates.append(
            {
                "candidate_id": place.candidate_id,
                "title": title,
                "place": place.location,
                "price_per_person": None,
                "opening_hours": place.opening_hours,
                "opens": opens,
                "closes": closes,
                "lat": float(place.latitude),
                "lng": float(place.longitude),
                "tags": list(tags),
                "_distance_score": _distance_score(
                    selected.lat,
                    selected.lng,
                    place.latitude,
                    place.longitude,
                ),
            }
        )
    return tuple(
        sorted(
            candidates,
            key=lambda candidate: (
                candidate["_distance_score"],
                str(candidate["title"]).casefold(),
            ),
        )
    )


def _filter_replacement_candidates(
    candidates: tuple[dict[str, Any], ...], keywords: list[str]
) -> tuple[dict[str, Any], ...]:
    cleaned = [keyword.strip().lower() for keyword in keywords if keyword.strip()]
    if not cleaned:
        return candidates

    def score(candidate: dict[str, Any]) -> int:
        haystack = " ".join(
            [
                str(candidate.get("title") or ""),
                str(candidate.get("place") or ""),
                str(candidate.get("opening_hours") or ""),
                *[str(tag) for tag in candidate.get("tags") or []],
            ]
        ).lower()
        total = 0
        for keyword in cleaned:
            terms = {keyword, *_REPLACEMENT_KEYWORD_ALIASES.get(keyword, ())}
            if any(term in haystack for term in terms):
                total += 1
        return total

    scored = [(score(candidate), candidate) for candidate in candidates]
    filtered = [candidate for points, candidate in scored if points > 0]
    if not filtered:
        return candidates
    return tuple(
        candidate
        for _points, candidate in sorted(
            ((score(candidate), candidate) for candidate in filtered),
            key=lambda pair: (
                -pair[0],
                pair[1].get("_distance_score", float("inf")),
                str(pair[1].get("title") or "").casefold(),
            ),
        )
    )


def _replacement_tags(place: place_service.PlannerPlace) -> tuple[str, ...]:
    tags = {tag.casefold() for tag in place.tags}
    if place.category:
        tags.add(place.category.casefold())
        tags.update(part.casefold() for part in place.category.split(".") if part)
    if "tourism.sights" in (place.category or "") or "tourism.attraction" in (place.category or ""):
        tags.add("viewpoint")
    return tuple(sorted(tags))


def _public_replacement_candidate(candidate: dict[str, Any]) -> dict[str, Any]:
    public = dict(candidate)
    public.pop("_distance_score", None)
    return public


def _time_block_is_supported(
    intervals: tuple[tuple[float, float], ...] | None,
    start_hour: float,
    duration_min: int,
) -> bool:
    if intervals is None:
        return True
    end_hour = start_hour + duration_min / 60
    return any(start <= start_hour and end_hour <= end for start, end in intervals)


def _same_coordinates(
    left_lat: float | None,
    left_lng: float | None,
    right_lat: float | None,
    right_lng: float | None,
) -> bool:
    if None in {left_lat, left_lng, right_lat, right_lng}:
        return False
    return abs(float(left_lat) - float(right_lat)) < 0.0001 and abs(
        float(left_lng) - float(right_lng)
    ) < 0.0001


def _distance_score(
    base_lat: float | None,
    base_lng: float | None,
    candidate_lat: float,
    candidate_lng: float,
) -> float:
    if base_lat is None or base_lng is None:
        return float("inf")
    lat_scale = 111.0
    lng_scale = 111.0 * max(cos(radians(base_lat)), 0.1)
    lat_delta = (candidate_lat - base_lat) * lat_scale
    lng_delta = (candidate_lng - base_lng) * lng_scale
    return sqrt(lat_delta * lat_delta + lng_delta * lng_delta)


def _opening_intervals_for_date(
    raw: str | None, day_date: date
) -> tuple[tuple[float, float], ...] | None:
    if not raw:
        return None
    value = raw.strip()
    if value == "24/7":
        return ((0.0, 24.0),)
    weekday = _WEEKDAY_CODES[day_date.weekday()]
    matched_day = False
    intervals: list[tuple[float, float]] = []
    for segment in value.split(";"):
        segment = segment.strip()
        parsed = re.match(
            r"^([A-Z][a-z](?:-[A-Z][a-z])?(?:,[A-Z][a-z])*)\s+(.+)$",
            segment,
        )
        if parsed is None or not _weekday_spec_contains(parsed.group(1), weekday):
            continue
        matched_day = True
        hours = parsed.group(2).strip()
        if hours.casefold() in {"off", "closed"}:
            continue
        for start_text, end_text in re.findall(r"(\d{1,2}:\d{2})-(\d{1,2}:\d{2})", hours):
            start = _clock_hour(start_text)
            end = _clock_hour(end_text)
            if start is None or end is None:
                continue
            if end <= start:
                end += 24.0
            intervals.append((start, end))
    if not matched_day:
        return None
    return tuple(intervals)


def _weekday_spec_contains(spec: str, weekday: str) -> bool:
    for part in spec.split(","):
        if "-" not in part:
            if part == weekday:
                return True
            continue
        start, end = part.split("-", 1)
        if start not in _WEEKDAY_CODES or end not in _WEEKDAY_CODES:
            continue
        start_index = _WEEKDAY_CODES.index(start)
        end_index = _WEEKDAY_CODES.index(end)
        day_index = _WEEKDAY_CODES.index(weekday)
        if start_index <= end_index:
            if start_index <= day_index <= end_index:
                return True
        elif day_index >= start_index or day_index <= end_index:
            return True
    return False


def _clock_hour(value: str) -> float | None:
    try:
        hour_text, minute_text = value.split(":", 1)
        hour, minute = int(hour_text), int(minute_text)
    except (TypeError, ValueError):
        return None
    if not (0 <= hour <= 24 and 0 <= minute < 60) or (hour == 24 and minute):
        return None
    return hour + minute / 60


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

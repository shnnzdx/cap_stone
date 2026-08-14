from __future__ import annotations

import json
import os
import re
import sys
import time
from pathlib import Path
from typing import Any

BACKEND_ROOT = Path(__file__).resolve().parents[3]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from openai import OpenAI

from app.agents import base, trace

AGENT_ROUTE = "agent_server"
DEFAULT_PROVIDER = base.DEEPSEEK_PROVIDER
DEFAULT_MAX_ROUNDS = 5

FAKE_PLAN_BY_DAY = {
    "wednesday": [
        {
            "title": "Architecture River Cruise",
            "place": "Chicago Riverwalk",
            "start_hour": 10.0,
            "duration": 90,
        },
        {
            "title": "Art Institute Museum",
            "place": "Michigan Avenue",
            "start_hour": 13.5,
            "duration": 120,
        },
        {
            "title": "Millennium Park walk",
            "place": "Millennium Park",
            "start_hour": 16.0,
            "duration": 60,
        },
        {
            "title": "Birthday dinner",
            "place": "West Loop",
            "start_hour": 18.0,
            "duration": 120,
        },
    ],
    "thursday": [
        {
            "title": "Lincoln Park Zoo",
            "place": "Lincoln Park",
            "start_hour": 10.5,
            "duration": 120,
        },
        {
            "title": "Lakefront picnic",
            "place": "North Avenue Beach",
            "start_hour": 15.0,
            "duration": 90,
        },
    ],
}


def _normalize_day(day: str) -> str:
    lowered = day.strip().lower()
    if lowered in {"all", "entire trip", "whole trip", "all days"} or "全部" in day:
        return "all"
    if "周三" in day or "wednesday" in lowered or "wed" in lowered:
        return "wednesday"
    if "2026-08-19" in lowered:
        return "wednesday"
    if "周四" in day or "thursday" in lowered or "thu" in lowered:
        return "thursday"
    if "2026-08-20" in lowered:
        return "thursday"
    return lowered


def _days_in_text(text: str) -> set[str]:
    lowered = text.lower()
    days = set()
    if "周三" in text or "wednesday" in lowered or "wed" in lowered or "2026-08-19" in lowered:
        days.add("wednesday")
    if "周四" in text or "thursday" in lowered or "thu" in lowered or "2026-08-20" in lowered:
        days.add("thursday")
    return days


def classify_change(item: str, new_time: str) -> str:
    """Classify a proposed itinerary change using deterministic demo rules."""
    item_lower = item.lower()
    time_lower = new_time.lower()

    if "birthday dinner" in item_lower or ("生日" in item and "晚餐" in item):
        return (
            "CONFIRM: This activity has a confirmed booking. "
            "The Current Plan must stay unchanged until affected members confirm."
        )

    if (
        "8" in time_lower
        and ("am" in time_lower or "morning" in time_lower or "早上" in new_time)
    ):
        return (
            "CONFIRM: The requested time violates one member's required constraint. "
            "Do not reveal the member's identity or private reason."
        )

    if (
        "4" in time_lower
        and ("pm" in time_lower or "afternoon" in time_lower or "下午" in new_time)
    ):
        return (
            "ROUND: This time slot already has a competing suggestion. "
            "Open a group decision round instead of overwriting the Current Plan."
        )

    return (
        "NOTICE: No hard constraint, confirmed booking, or existing conflict was found. "
        "This change can be applied and the group can be notified."
    )


def get_current_plan(day: str) -> str:
    """Return fake itinerary items for one day. No database is used."""
    normalized = _normalize_day(day)
    if normalized == "all":
        return json.dumps(
            {
                "days": FAKE_PLAN_BY_DAY,
                "source": "fake_agent_server_data",
            },
            ensure_ascii=False,
        )
    items = FAKE_PLAN_BY_DAY.get(normalized, [])
    return json.dumps(
        {
            "day": normalized,
            "items": items,
            "source": "fake_agent_server_data",
        },
        ensure_ascii=False,
    )


def check_constraints(item_title: str, new_start_hour: float) -> str:
    """Return anonymized fake constraint checks for an item/time proposal."""
    title = item_title.lower()
    if new_start_hour < 9:
        return (
            "CONFLICT: The proposed start time hits 1 member's hard constraint. "
            "Do not reveal the member's identity or private reason."
        )
    if "birthday dinner" in title:
        return (
            "CONFLICT: This item has a confirmed booking. Affected members must "
            "confirm before the Current Plan changes."
        )
    return "CLEAR: No hard constraint or confirmed booking conflict was found."


def propose_options(conflict_description: str) -> str:
    """Generate targeted compromise options for one fake conflict scenario."""
    if base.is_mocked():
        return json.dumps(
            {
                "options": [
                    {
                        "title": "Move the earlier activity shorter",
                        "content": "Keep dinner at the booked time and trim the afternoon museum block by 45 minutes.",
                        "tradeoff": "Less time at the museum, but no booking change.",
                    },
                    {
                        "title": "Split for one block",
                        "content": "People who want the full museum visit stay later; others leave early for dinner.",
                        "tradeoff": "The group separates briefly and needs a clear meeting point.",
                    },
                    {
                        "title": "Swap the low-priority stop",
                        "content": "Drop the optional cafe stop and use that buffer for travel before dinner.",
                        "tradeoff": "Loses the cafe break, but keeps the two higher-value activities.",
                    },
                ]
            },
            ensure_ascii=False,
        )

    config = _provider_config()
    completion = _chat_completion(
        config=config,
        messages=[
            {
                "role": "system",
                "content": (
                    "You generate concrete compromise options for a group travel "
                    "planning conflict. Return one JSON object with an options array. "
                    "Each option must have title, content, and tradeoff. Generate 2 "
                    "or 3 options. Use only itinerary facts present in the conflict "
                    "scenario. Do not invent item counts, start times, durations, "
                    "places, opening hours, or early departure times. Do not mention "
                    "names, membership ids, or private preference wording. Write all "
                    "user-facing option text in English."
                ),
            },
            {
                "role": "user",
                "content": f"Conflict scenario:\n{conflict_description}",
            },
        ],
        tools=None,
        response_format={"type": "json_object"},
    )
    return completion.choices[0].message.content or "{}"


TOOLS = [
    {
        "type": "function",
        "function": {
            "name": "get_current_plan",
            "description": (
                "Look up the actual fake itinerary for a day. Call this before "
                "answering any itinerary question, before checking constraints, "
                "and before proposing options. You can ask for Wednesday, Thursday, "
                "or all days. Do not guess the day's items."
            ),
            "parameters": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "day": {
                        "type": "string",
                        "description": "The day to inspect, e.g. Wednesday or 周三.",
                    }
                },
                "required": ["day"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "check_constraints",
            "description": (
                "Check anonymized fake constraints for a proposed item time. "
                "Use this for a specific proposed time change after you know the item title."
            ),
            "parameters": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "item_title": {
                        "type": "string",
                        "description": "An exact or close item title from get_current_plan.",
                    },
                    "new_start_hour": {
                        "type": "number",
                        "description": "The proposed new start hour in 24-hour time.",
                    },
                },
                "required": ["item_title", "new_start_hour"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "classify_change",
            "description": (
                "Classify an itinerary change as NOTICE, ROUND, or CONFIRM. "
                "Use this after you have enough itinerary context for the item."
            ),
            "parameters": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "item": {
                        "type": "string",
                        "description": "The itinerary item being changed.",
                    },
                    "new_time": {
                        "type": "string",
                        "description": "The requested new time.",
                    },
                },
                "required": ["item", "new_time"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "propose_options",
            "description": (
                "Generate targeted compromise options for a fuzzy or conflicting "
                "schedule request. Use this when a single direct time change is not "
                "clear enough. Include the actual returned itinerary facts in "
                "conflict_description; do not invent item counts or times."
            ),
            "parameters": {
                "type": "object",
                "additionalProperties": False,
                "properties": {
                    "conflict_description": {
                        "type": "string",
                        "description": "A concise conflict scenario without member names or private notes.",
                    }
                },
                "required": ["conflict_description"],
            },
        },
    },
]

TOOL_HANDLERS = {
    "get_current_plan": get_current_plan,
    "check_constraints": check_constraints,
    "classify_change": classify_change,
    "propose_options": propose_options,
}

SYSTEM_PROMPT = """
You are TripSync Coordinator, an AI agent for collaborative group travel.

Use tools instead of guessing:
1. Before answering any itinerary question, call get_current_plan first. Verify instead of guessing.
2. Only use information returned by tools. Do not invent itinerary items, counts, times, places, or available space on another day.
3. If the user request is fuzzy, first understand the current plan, then suggest options grounded in the verified plan.
4. Follow tool results. NOTICE can apply directly, ROUND needs a group decision, CONFIRM needs affected members to confirm.
5. Never reveal private member information.
6. Never claim the Current Plan has already changed.
7. The user must click an action button before anything is applied.

Keep final answers short and clear. User-facing product copy must be in English only, even when the user writes in another language.
"""


def run_agent(message: str, *, max_rounds: int | None = None) -> dict[str, Any]:
    limit = max_rounds or int(os.getenv("AGENT_SERVER_MAX_ROUNDS", DEFAULT_MAX_ROUNDS))
    trace_id = trace.new_trace_id()
    config = _provider_config()
    started = time.perf_counter()
    messages: list[dict[str, Any]] = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": message},
    ]
    trace_events: list[dict[str, Any]] = []
    tool_info: dict[str, Any] | None = None
    path: str | None = None
    options_raw: str | None = None
    tool_state: dict[str, Any] = {
        "called_tools": [],
        "plan_days": set(),
        "guard_rejections": {},
    }

    if base.is_mocked():
        return _run_mock_agent(
            message=message,
            trace_id=trace_id,
            config=config,
            max_rounds=limit,
            started=started,
        )

    for round_index in range(1, limit + 1):
        round_started = time.perf_counter()
        completion = _chat_completion(config=config, messages=messages, tools=TOOLS)
        assistant_message = completion.choices[0].message
        tool_calls = list(assistant_message.tool_calls or [])
        messages.append(assistant_message.model_dump(exclude_none=True))

        if not tool_calls:
            trace_events.append(
                trace.record_agent_round(
                    trace_id=trace_id,
                    route=AGENT_ROUTE,
                    provider=config.name,
                    model=config.model,
                    round_index=round_index,
                    requested_tool=False,
                    tool_name=None,
                    tool_arguments=None,
                    tool_result=None,
                    elapsed_ms=(time.perf_counter() - round_started) * 1000,
                    tokens=trace.extract_token_usage(completion),
                )
            )
            total_elapsed_ms = (time.perf_counter() - started) * 1000
            return {
                "reply": assistant_message.content or "",
                "path": path,
                "tool": tool_info,
                "options_raw": options_raw,
                "trace_id": trace_id,
                "trace": trace_events,
                "total_elapsed_ms": round(total_elapsed_ms, 2),
                "average_round_ms": _average_round_ms(trace_events),
            }

        calls_for_trace = []
        force_stop = None
        for tool_call in tool_calls:
            name = tool_call.function.name
            args = _parse_tool_args(tool_call.function.arguments)
            execution = _run_tool(name, args, state=tool_state)
            result = execution["content"]

            if name == "classify_change" and not execution["guard_rejected"]:
                path = str(result).split(":", 1)[0]
            if name == "propose_options" and not execution["guard_rejected"]:
                options_raw = str(result)

            tool_info = {
                "name": name,
                "arguments": args,
                "result": result,
                "guard_rejected": execution["guard_rejected"],
                "guard_reason": execution["guard_reason"],
            }
            calls_for_trace.append(
                {
                    "name": name,
                    "arguments": _sanitize_for_trace(args),
                    "result": {
                        "output": _sanitize_for_trace(result),
                        "guard_rejected": execution["guard_rejected"],
                        "guard_reason": execution["guard_reason"],
                        "guard_limit_exceeded": execution["guard_limit_exceeded"],
                    },
                }
            )
            messages.append(
                {
                    "role": "tool",
                    "tool_call_id": tool_call.id,
                    "name": name,
                    "content": str(result),
                }
            )
            if execution["guard_limit_exceeded"]:
                force_stop = {
                    "tool": name,
                    "reason": execution["guard_reason"],
                }

        trace_events.append(
            trace.record_agent_round(
                trace_id=trace_id,
                route=AGENT_ROUTE,
                provider=config.name,
                model=config.model,
                round_index=round_index,
                requested_tool=True,
                tool_name=", ".join(call["name"] for call in calls_for_trace),
                tool_arguments={"calls": [call["arguments"] for call in calls_for_trace]},
                tool_result={"calls": [call["result"] for call in calls_for_trace]},
                elapsed_ms=(time.perf_counter() - round_started) * 1000,
                tokens=trace.extract_token_usage(completion),
            )
        )
        if force_stop:
            total_elapsed_ms = (time.perf_counter() - started) * 1000
            return {
                "reply": (
                    "ERROR: Agent stopped because the same tool was rejected by "
                    f"the guard more than 2 times: {force_stop['tool']}. "
                    f"Reason: {force_stop['reason']}"
                ),
                "path": path,
                "tool": tool_info,
                "options_raw": options_raw,
                "trace_id": trace_id,
                "trace": trace_events,
                "total_elapsed_ms": round(total_elapsed_ms, 2),
                "average_round_ms": _average_round_ms(trace_events),
                "error": "guard_rejection_limit_exceeded",
                "guard_limit_exceeded": True,
            }

    total_elapsed_ms = (time.perf_counter() - started) * 1000
    return {
        "reply": f"ERROR: Agent exceeded the {limit}-round tool loop limit.",
        "path": path,
        "tool": tool_info,
        "options_raw": options_raw,
        "trace_id": trace_id,
        "trace": trace_events,
        "total_elapsed_ms": round(total_elapsed_ms, 2),
        "average_round_ms": _average_round_ms(trace_events),
        "error": "tool_loop_limit_exceeded",
    }


def _provider_config() -> base.ProviderConfig:
    provider_name = base._resolve_provider_name(DEFAULT_PROVIDER)
    config = base.provider_catalog().get(provider_name)
    if config is None:
        raise base.AgentUnavailable(f"{provider_name}: provider is unknown")
    if not config.api_key and not base.is_mocked():
        raise base.AgentUnavailable(f"{provider_name} API key is not set")
    if not config.model:
        raise base.AgentUnavailable(f"{provider_name} model is not set")
    return config


def _chat_completion(
    *,
    config: base.ProviderConfig,
    messages: list[dict[str, Any]],
    tools: list[dict[str, Any]] | None,
    response_format: dict[str, Any] | None = None,
):
    client = OpenAI(api_key=config.api_key, base_url=config.base_url, timeout=90.0)
    kwargs: dict[str, Any] = {
        "model": config.model,
        "messages": messages,
        "temperature": 0,
    }
    if tools is not None:
        kwargs["tools"] = tools
        kwargs["tool_choice"] = "auto"
    if response_format is not None:
        kwargs["response_format"] = response_format
    extra_body = base._extra_body(config)
    if extra_body:
        kwargs["extra_body"] = extra_body
    return client.chat.completions.create(**kwargs)


def _parse_tool_args(raw: Any) -> dict[str, Any]:
    if isinstance(raw, dict):
        return raw
    if not raw:
        return {}
    return json.loads(raw)


def _run_tool(name: str, args: dict[str, Any], *, state: dict[str, Any]) -> dict[str, Any]:
    handler = TOOL_HANDLERS.get(name)
    if handler is None:
        return _tool_execution(f"ERROR: Unknown tool {name}")

    guard_reason = _guard_reason(name, args, state)
    if guard_reason:
        rejections = state["guard_rejections"]
        rejections[name] = int(rejections.get(name, 0)) + 1
        return _tool_execution(
            guard_reason,
            guard_rejected=True,
            guard_reason=guard_reason,
            guard_limit_exceeded=rejections[name] > 2,
        )

    result = handler(**args)
    state["called_tools"].append({"name": name, "arguments": args})
    if name == "get_current_plan":
        day = _normalize_day(str(args.get("day", "")))
        if day == "all":
            state["plan_days"].update(FAKE_PLAN_BY_DAY)
        elif day:
            state["plan_days"].add(day)
    return _tool_execution(result)


def _tool_execution(
    content: str,
    *,
    guard_rejected: bool = False,
    guard_reason: str | None = None,
    guard_limit_exceeded: bool = False,
) -> dict[str, Any]:
    return {
        "content": content,
        "guard_rejected": guard_rejected,
        "guard_reason": guard_reason,
        "guard_limit_exceeded": guard_limit_exceeded,
    }


def _guard_reason(name: str, args: dict[str, Any], state: dict[str, Any]) -> str | None:
    plan_days: set[str] = state["plan_days"]
    if name == "get_current_plan":
        return None
    if name == "classify_change" and not plan_days:
        return (
            "Cannot classify this change: you have not checked the itinerary yet. "
            "Please call get_current_plan(day='Wednesday') first, then retry."
        )
    if name == "propose_options":
        conflict_description = str(args.get("conflict_description", ""))
        required_days = _days_in_text(conflict_description)
        if not required_days:
            required_days = {"wednesday"} if "wednesday" in plan_days else set(plan_days)
        missing = sorted(day for day in required_days if day not in plan_days)
        if missing or not plan_days:
            day = missing[0] if missing else "wednesday"
            return (
                f"Cannot provide options: you have not checked the {day} itinerary. "
                f"Please call get_current_plan(day='{day}') first, use the real "
                "returned schedule, then retry propose_options."
            )
    return None


def _average_round_ms(events: list[dict[str, Any]]) -> float:
    if not events:
        return 0.0
    return round(sum(float(event["elapsed_ms"]) for event in events) / len(events), 2)


def _sanitize_for_trace(value: Any) -> Any:
    if isinstance(value, dict):
        cleaned = {}
        for key, child in value.items():
            lowered = key.lower()
            if lowered in {"membership_id", "member_name", "private_note", "preference_text"}:
                cleaned[key] = "[redacted]"
            else:
                cleaned[key] = _sanitize_for_trace(child)
        return cleaned
    if isinstance(value, list):
        return [_sanitize_for_trace(child) for child in value]
    if isinstance(value, str):
        value = re.sub(r"\bm-[A-Za-z0-9_-]+\b", "[redacted-membership-id]", value)
        value = re.sub(r"\bmembership[_ -]?id\s*[:=]\s*\S+", "membership_id=[redacted]", value, flags=re.I)
        return value
    return value


def _run_mock_agent(
    *,
    message: str,
    trace_id: str,
    config: base.ProviderConfig,
    max_rounds: int,
    started: float,
) -> dict[str, Any]:
    round_started = time.perf_counter()
    lower = message.lower()
    if "冲突" in message or "太满" in message or "conflict" in lower:
        args = {"conflict_description": message}
        result = propose_options(**args)
        event = trace.record_agent_round(
            trace_id=trace_id,
            route=AGENT_ROUTE,
            provider=config.name,
            model=config.model,
            round_index=1,
            requested_tool=True,
            tool_name="propose_options",
            tool_arguments=_sanitize_for_trace(args),
            tool_result=_sanitize_for_trace(result),
            elapsed_ms=(time.perf_counter() - round_started) * 1000,
            tokens=trace.TokenUsage(total_tokens=0),
        )
        return {
            "reply": "我准备了几个折中方案，提交前仍需要你选择。",
            "path": "ROUND",
            "tool": {"name": "propose_options", "arguments": args, "result": result},
            "options_raw": result,
            "trace_id": trace_id,
            "trace": [event],
            "total_elapsed_ms": round((time.perf_counter() - started) * 1000, 2),
            "average_round_ms": event["elapsed_ms"],
            "max_rounds": max_rounds,
        }

    item = "Birthday dinner" if "生日" in message or "birthday" in lower else "Wednesday activity"
    new_time = "8 AM" if "8" in message or "早上" in message else "9 PM"
    args = {"item": item, "new_time": new_time}
    result = classify_change(**args)
    path = result.split(":", 1)[0]
    event = trace.record_agent_round(
        trace_id=trace_id,
        route=AGENT_ROUTE,
        provider=config.name,
        model=config.model,
        round_index=1,
        requested_tool=True,
        tool_name="classify_change",
        tool_arguments=_sanitize_for_trace(args),
        tool_result=_sanitize_for_trace(result),
        elapsed_ms=(time.perf_counter() - round_started) * 1000,
        tokens=trace.TokenUsage(total_tokens=0),
    )
    return {
        "reply": f"{path}: 我已经按工具结果判断这次调整的处理路径。",
        "path": path,
        "tool": {"name": "classify_change", "arguments": args, "result": result},
        "options_raw": None,
        "trace_id": trace_id,
        "trace": [event],
        "total_elapsed_ms": round((time.perf_counter() - started) * 1000, 2),
        "average_round_ms": event["elapsed_ms"],
        "max_rounds": max_rounds,
    }

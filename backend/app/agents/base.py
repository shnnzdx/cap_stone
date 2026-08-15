"""所有 agent 共用的地基: 模型调用 + 多 provider 路由 + MOCK 开关 + 脱敏上下文。

这里现在同时支持:

1. legacy `OPENAI_*` 单 provider 配置
2. `DEEPSEEK_*` provider 配置
3. `OLLAMA_CLOUD_*` provider 配置
4. 按 agent 路由到不同 provider

这样本地和云端都可以同时保存两套 key, 但每次具体调用仍然走一条清晰的
provider 路径, 不会把不同厂商的 base URL / model / key 混成一锅。
"""

from __future__ import annotations

import json
import os
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Callable

from dotenv import load_dotenv

from . import trace
from ..domain.constraints.types import Classification

BACKEND_ROOT = Path(__file__).resolve().parents[2]
load_dotenv(BACKEND_ROOT / ".env", override=False)

DEEPSEEK_THINKING = os.getenv("DEEPSEEK_THINKING", "disabled")

LEGACY_PROVIDER = "legacy"
DEEPSEEK_PROVIDER = "deepseek"
OLLAMA_CLOUD_PROVIDER = "ollama_cloud"

CHAT_ROUTE = "chat"
PLANNER_ROUTE = "planner"
EXPLAINER_ROUTE = "explainer"
AGENT_ROUTE = "agent"

ROUTE_PROVIDER_ENV = {
    CHAT_ROUTE: "CHAT_AI_PROVIDER",
    PLANNER_ROUTE: "PLANNER_AI_PROVIDER",
    EXPLAINER_ROUTE: "EXPLAINER_AI_PROVIDER",
    AGENT_ROUTE: "AGENT_AI_PROVIDER",
}

ROUTE_PROVIDER_DEFAULTS = {
    CHAT_ROUTE: OLLAMA_CLOUD_PROVIDER,
    PLANNER_ROUTE: DEEPSEEK_PROVIDER,
    EXPLAINER_ROUTE: DEEPSEEK_PROVIDER,
    AGENT_ROUTE: DEEPSEEK_PROVIDER,
}

PROVIDER_ALIASES = {
    "default": LEGACY_PROVIDER,
    "legacy": LEGACY_PROVIDER,
    "openai": LEGACY_PROVIDER,
    "openai_compatible": LEGACY_PROVIDER,
    "deepseek": DEEPSEEK_PROVIDER,
    "deepseek_cloud": DEEPSEEK_PROVIDER,
    "ollama_cloud": OLLAMA_CLOUD_PROVIDER,
    "ollama-cloud": OLLAMA_CLOUD_PROVIDER,
}


def _clean_env(name: str) -> str | None:
    value = os.getenv(name)
    if value is None:
        return None
    value = value.strip()
    return value or None


@dataclass(frozen=True)
class ProviderConfig:
    name: str
    api_key: str | None
    base_url: str | None
    model: str | None


@dataclass(frozen=True)
class ProviderResult:
    value: dict[str, Any]
    tokens: trace.TokenUsage


@dataclass(frozen=True)
class AgentToolCall:
    id: str
    name: str
    arguments: dict[str, Any]


@dataclass(frozen=True)
class AgentProviderReply:
    content: str
    tool_calls: tuple[AgentToolCall, ...] = ()
    tokens: trace.TokenUsage = trace.TokenUsage()


@dataclass(frozen=True)
class AgentTool:
    """A read-only tool exposed to call_agent.

    Tools must not write to the database or mutate the Current Plan. call_agent
    is a reasoning harness; backend-owned domain services remain the only place
    where persistent effects belong.
    """

    name: str
    description: str
    parameters: dict[str, Any]
    handler: Callable[..., Any]
    guard: Callable[["AgentRunState", dict[str, Any]], str | None] | None = None
    cache: bool = True


@dataclass(frozen=True)
class AgentRunState:
    called_tools: tuple[dict[str, Any], ...]
    tool_call_counts: dict[str, int]


@dataclass(frozen=True)
class AgentRunResult:
    content: str
    trace_id: str
    rounds: tuple[dict[str, Any], ...]
    tool_results: tuple[dict[str, Any], ...]
    total_tokens: int
    total_elapsed_ms: float
    stopped_reason: str | None = None


def _legacy_provider() -> ProviderConfig:
    return ProviderConfig(
        name=LEGACY_PROVIDER,
        api_key=_clean_env("OPENAI_API_KEY"),
        base_url=_clean_env("OPENAI_BASE_URL"),
        model=_clean_env("OPENAI_MODEL") or "gpt-4o-mini",
    )


def _deepseek_provider() -> ProviderConfig:
    api_key = _clean_env("DEEPSEEK_API_KEY")
    base_url = _clean_env("DEEPSEEK_BASE_URL")
    model = _clean_env("DEEPSEEK_MODEL")
    if api_key or base_url or model:
        return ProviderConfig(
            name=DEEPSEEK_PROVIDER,
            api_key=api_key,
            base_url=base_url or "https://api.deepseek.com",
            model=model or "deepseek-v4-flash",
        )
    return ProviderConfig(
        name=DEEPSEEK_PROVIDER,
        api_key=None,
        base_url="https://api.deepseek.com",
        model="deepseek-v4-flash",
    )


def _ollama_cloud_provider() -> ProviderConfig:
    api_key = _clean_env("OLLAMA_CLOUD_API_KEY")
    base_url = _clean_env("OLLAMA_CLOUD_BASE_URL")
    model = _clean_env("OLLAMA_CLOUD_MODEL")
    if api_key or base_url or model:
        return ProviderConfig(
            name=OLLAMA_CLOUD_PROVIDER,
            api_key=api_key,
            base_url=base_url or "https://ollama.com/v1/",
            model=model or "qwen3.5:cloud",
        )
    return ProviderConfig(
        name=OLLAMA_CLOUD_PROVIDER,
        api_key=None,
        base_url="https://ollama.com/v1/",
        model="qwen3.5:cloud",
    )


def provider_catalog() -> dict[str, ProviderConfig]:
    return {
        LEGACY_PROVIDER: _legacy_provider(),
        DEEPSEEK_PROVIDER: _deepseek_provider(),
        OLLAMA_CLOUD_PROVIDER: _ollama_cloud_provider(),
    }


def provider_runtime_state() -> dict[str, dict[str, Any]]:
    state: dict[str, dict[str, Any]] = {}
    for name, config in provider_catalog().items():
        state[name] = {
            "base_url": config.base_url,
            "model": config.model,
            "has_api_key": bool(config.api_key),
        }
    return state


def is_mocked() -> bool:
    """真。断网、超额度、跑测试的时候都靠它。"""
    return os.getenv("MOCK_AI") == "1"


def _canonical_provider_name(name: str | None) -> str:
    cleaned = (name or "").strip().lower()
    if not cleaned:
        return LEGACY_PROVIDER
    return PROVIDER_ALIASES.get(cleaned, cleaned)


def _resolve_provider_name(route_or_provider: str | None) -> str:
    if route_or_provider in ROUTE_PROVIDER_ENV:
        configured = _clean_env(ROUTE_PROVIDER_ENV[route_or_provider])
        return _canonical_provider_name(configured or ROUTE_PROVIDER_DEFAULTS[route_or_provider])
    configured = _clean_env("AI_DEFAULT_PROVIDER")
    return _canonical_provider_name(route_or_provider or configured or LEGACY_PROVIDER)


def _route_name(route_or_provider: str | None) -> str:
    return route_or_provider if route_or_provider in ROUTE_PROVIDER_ENV else "direct"


def _provider_chain(route_or_provider: str | None) -> tuple[str, ...]:
    names = [_resolve_provider_name(route_or_provider)]
    fallback = _canonical_provider_name(_clean_env("AI_FALLBACK_PROVIDER"))
    if fallback and fallback not in names:
        names.append(fallback)
    return tuple(names)


def _uses_json_object_mode(config: ProviderConfig) -> bool:
    """Providers that accept JSON mode but not OpenAI strict json_schema."""
    base_url = (config.base_url or "").lower()
    return any(marker in base_url for marker in ("deepseek", "dashscope", "aliyuncs.com"))


def _extra_body(config: ProviderConfig) -> dict[str, Any] | None:
    """DeepSeek V4 defaults to thinking mode; chat UX needs the fast path."""
    if "deepseek" not in (config.base_url or "").lower():
        return None
    if config.model not in {"deepseek-v4-flash", "deepseek-v4-pro"}:
        return None
    thinking = "enabled" if DEEPSEEK_THINKING == "enabled" else "disabled"
    return {"thinking": {"type": thinking}}


class AgentUnavailable(Exception):
    """模型没答上来。

    捕获它的地方必须能**降级到没有 AI 也能用**:
    判定、投票、确认三条主流程不许因为这个出错而改变行为。
    """


@dataclass(frozen=True)
class SafeContext:
    """能交给模型的全部东西。

    注意这里没有 membership_id、没有姓名、没有偏好原话 ——
    类型上就装不下, 所以任何 agent 都不可能不小心把它们塞进 prompt。
    """

    path: str
    headline: str
    detail: str
    blocked_by: tuple[str, ...]
    findings: tuple[str, ...]
    affected_counts: tuple[int, ...]

    def as_prompt_block(self) -> str:
        lines = [f"Verdict: {self.path}", self.headline, self.detail]
        if self.blocked_by:
            lines.append("Blocked by: " + "; ".join(self.blocked_by))
        for text, count in zip(self.findings, self.affected_counts):
            lines.append(f"- {text} (affects {count} member(s))")
        return "\n".join(lines)


def safe_context(classification: Classification) -> SafeContext:
    """把判定结果变成"可以给模型看"的东西。

    **这是 agent 拿到判定信息的唯一入口。** 别绕过它直接读 Constraint 或数据库,
    那样私密原话就有路径进 prompt 了。
    """
    return SafeContext(
        path=classification.path.value,
        headline=classification.headline,
        detail=classification.detail,
        blocked_by=tuple(c.label for c in classification.checks if c.hit),
        findings=tuple(f.safe_text for f in classification.findings),
        affected_counts=tuple(f.affected_count for f in classification.findings),
    )


def _response_format(
    schema_name: str, schema: dict[str, Any], config: ProviderConfig
) -> dict[str, Any]:
    if _uses_json_object_mode(config):
        return {"type": "json_object"}
    return {
        "type": "json_schema",
        "json_schema": {
            "name": schema_name,
            "strict": True,
            "schema": schema,
        },
    }


def _json_object_system(system: str, schema: dict[str, Any], config: ProviderConfig) -> str:
    if not _uses_json_object_mode(config):
        return system
    return (
        f"{system}\n\n"
        "Return only one valid JSON object. Do not wrap it in markdown. "
        "The object must satisfy this JSON Schema exactly:\n"
        f"{json.dumps(schema, ensure_ascii=False)}"
    )


def _type_matches(value: Any, expected: str) -> bool:
    if expected == "null":
        return value is None
    if expected == "object":
        return isinstance(value, dict)
    if expected == "array":
        return isinstance(value, list)
    if expected == "string":
        return isinstance(value, str)
    if expected == "number":
        return isinstance(value, int | float) and not isinstance(value, bool)
    if expected == "integer":
        return isinstance(value, int) and not isinstance(value, bool)
    if expected == "boolean":
        return isinstance(value, bool)
    return True


def _validate_schema(value: Any, schema: dict[str, Any], path: str = "$") -> None:
    expected = schema.get("type")
    allowed = expected if isinstance(expected, list) else [expected] if expected else []
    if allowed and not any(_type_matches(value, kind) for kind in allowed):
        raise AgentUnavailable(f"Model returned invalid JSON at {path}: expected {expected}")

    if value is None:
        return

    enum = schema.get("enum")
    if enum is not None and value not in enum:
        raise AgentUnavailable(f"Model returned invalid JSON at {path}: expected one of {enum}")

    if isinstance(value, dict):
        properties = schema.get("properties") or {}
        required = schema.get("required") or []
        missing = [key for key in required if key not in value]
        if missing:
            raise AgentUnavailable(f"Model returned invalid JSON at {path}: missing {missing}")
        if schema.get("additionalProperties") is False:
            extra = [key for key in value if key not in properties]
            if extra:
                raise AgentUnavailable(f"Model returned invalid JSON at {path}: extra fields {extra}")
        for key, child_schema in properties.items():
            if key in value:
                _validate_schema(value[key], child_schema, f"{path}.{key}")
        return

    if isinstance(value, list):
        item_schema = schema.get("items")
        if item_schema:
            for index, item in enumerate(value):
                _validate_schema(item, item_schema, f"{path}[{index}]")
        return

    if isinstance(value, int | float) and not isinstance(value, bool):
        minimum = schema.get("minimum")
        maximum = schema.get("maximum")
        if minimum is not None and value < minimum:
            raise AgentUnavailable(f"Model returned invalid JSON at {path}: below minimum")
        if maximum is not None and value > maximum:
            raise AgentUnavailable(f"Model returned invalid JSON at {path}: above maximum")


def _invoke_provider(
    *,
    config: ProviderConfig,
    system: str,
    user: str,
    schema: dict[str, Any],
    schema_name: str,
    max_tokens: int | None,
) -> ProviderResult:
    if not config.api_key:
        raise AgentUnavailable(f"{config.name} API key is not set")
    if not config.model:
        raise AgentUnavailable(f"{config.name} model is not set")

    from openai import OpenAI

    client = OpenAI(api_key=config.api_key, base_url=config.base_url, timeout=60.0)
    kwargs: dict[str, Any] = {
        "model": config.model,
        "messages": [
            {"role": "system", "content": _json_object_system(system, schema, config)},
            {"role": "user", "content": user},
        ],
        "temperature": 0,
        "response_format": _response_format(schema_name, schema, config),
    }
    if not config.base_url:
        kwargs["reasoning_effort"] = "none"
    extra_body = _extra_body(config)
    if extra_body:
        kwargs["extra_body"] = extra_body
    if max_tokens is not None:
        kwargs["max_tokens"] = max_tokens
    completion = client.chat.completions.create(**kwargs)
    result = json.loads(completion.choices[0].message.content)
    _validate_schema(result, schema)
    return ProviderResult(value=result, tokens=trace.extract_token_usage(completion))


def _agent_tool_schema(tool: AgentTool) -> dict[str, Any]:
    return {
        "type": "function",
        "function": {
            "name": tool.name,
            "description": tool.description,
            "parameters": tool.parameters,
        },
    }


def _cache_key(name: str, arguments: dict[str, Any]) -> str:
    return f"{name}:{json.dumps(arguments, ensure_ascii=False, sort_keys=True, default=str)}"


def _stringify_tool_result(value: Any) -> str:
    if isinstance(value, str):
        return value
    return json.dumps(value, ensure_ascii=False, sort_keys=True, default=str)


def _redact_agent_trace(value: Any) -> Any:
    if isinstance(value, dict):
        cleaned: dict[str, Any] = {}
        for key, child in value.items():
            lowered = key.lower()
            if lowered in {
                "membership_id",
                "member_id",
                "member_name",
                "name",
                "private_note",
                "preference_text",
                "raw_preference",
            }:
                cleaned[key] = "[redacted]"
            else:
                cleaned[key] = _redact_agent_trace(child)
        return cleaned
    if isinstance(value, list):
        return [_redact_agent_trace(child) for child in value]
    if isinstance(value, tuple):
        return tuple(_redact_agent_trace(child) for child in value)
    return value


def _agent_state(called_tools: list[dict[str, Any]]) -> AgentRunState:
    counts: dict[str, int] = {}
    for call in called_tools:
        name = str(call.get("name") or "")
        counts[name] = counts.get(name, 0) + 1
    return AgentRunState(called_tools=tuple(called_tools), tool_call_counts=counts)


def _agent_reply_from_completion(completion: Any) -> AgentProviderReply:
    message = completion.choices[0].message
    tool_calls = []
    for index, call in enumerate(getattr(message, "tool_calls", None) or ()):
        raw_args = call.function.arguments
        arguments = raw_args if isinstance(raw_args, dict) else json.loads(raw_args or "{}")
        tool_calls.append(
            AgentToolCall(
                id=getattr(call, "id", None) or f"tool-{index}",
                name=call.function.name,
                arguments=arguments,
            )
        )
    return AgentProviderReply(
        content=getattr(message, "content", None) or "",
        tool_calls=tuple(tool_calls),
        tokens=trace.extract_token_usage(completion),
    )


def _invoke_agent_provider(
    *,
    config: ProviderConfig,
    messages: list[dict[str, Any]],
    tools: tuple[AgentTool, ...],
    max_tokens: int | None,
) -> AgentProviderReply:
    if not config.api_key:
        raise AgentUnavailable(f"{config.name} API key is not set")
    if not config.model:
        raise AgentUnavailable(f"{config.name} model is not set")

    from openai import OpenAI

    client = OpenAI(api_key=config.api_key, base_url=config.base_url, timeout=90.0)
    kwargs: dict[str, Any] = {
        "model": config.model,
        "messages": messages,
        "temperature": 0,
        "tools": [_agent_tool_schema(tool) for tool in tools],
        "tool_choice": "auto",
    }
    extra_body = _extra_body(config)
    if extra_body:
        kwargs["extra_body"] = extra_body
    if max_tokens is not None:
        kwargs["max_tokens"] = max_tokens
    return _agent_reply_from_completion(client.chat.completions.create(**kwargs))


def _next_mock_agent_reply(
    mock_rounds: list[AgentProviderReply], index: int
) -> AgentProviderReply:
    if index < len(mock_rounds):
        return mock_rounds[index]
    return AgentProviderReply(content="")


def _agent_reply_with_fallback(
    *,
    catalog: dict[str, ProviderConfig],
    provider: str | None,
    messages: list[dict[str, Any]],
    tools: tuple[AgentTool, ...],
    max_tokens: int | None,
) -> tuple[AgentProviderReply, ProviderConfig]:
    failures: list[str] = []
    for provider_name in _provider_chain(provider):
        config = catalog.get(provider_name)
        if config is None:
            failures.append(f"{provider_name}: provider is unknown")
            continue
        try:
            return (
                _invoke_agent_provider(
                    config=config,
                    messages=messages,
                    tools=tools,
                    max_tokens=max_tokens,
                ),
                config,
            )
        except AgentUnavailable as exc:
            failures.append(f"{provider_name}: {exc}")
        except Exception as exc:
            failures.append(f"{provider_name}: {exc!r}")
    raise AgentUnavailable(" | ".join(failures) or "No AI provider succeeded")


def call_agent(
    *,
    system: str,
    user: str,
    tools: tuple[AgentTool, ...],
    history: tuple[dict[str, str], ...] = (),
    mock_rounds: tuple[AgentProviderReply, ...] = (),
    max_rounds: int = 5,
    max_total_tokens: int | None = None,
    max_tokens: int | None = None,
    provider: str | None = AGENT_ROUTE,
    guard_reject_limit: int = 2,
) -> AgentRunResult:
    """Run a read-only tool-calling agent loop.

    The caller supplies all tools. This harness must not expose database-writing
    tools or any direct Current Plan mutation capability; persistent effects stay
    behind backend domain services.
    """
    trace_id = trace.new_trace_id()
    route = _route_name(provider)
    catalog = provider_catalog()
    provider_name = _resolve_provider_name(provider)
    config = catalog.get(provider_name) or ProviderConfig(
        name=provider_name,
        api_key=None,
        base_url=None,
        model=None,
    )
    messages: list[dict[str, Any]] = [
        {"role": "system", "content": system},
        # Prior conversation turns, so the agent can resolve "I meant...", "that
        # one", and bare confirmations against what was already said.
        *(
            {"role": turn["role"], "content": turn["content"]}
            for turn in history
            if turn.get("role") in ("user", "assistant") and turn.get("content")
        ),
        {"role": "user", "content": user},
    ]
    tool_by_name = {tool.name: tool for tool in tools}
    called_tools: list[dict[str, Any]] = []
    cache: dict[str, Any] = {}
    guard_rejections: dict[str, int] = {}
    rounds: list[dict[str, Any]] = []
    tool_results: list[dict[str, Any]] = []
    total_tokens = 0
    started = time.perf_counter()
    mock_list = list(mock_rounds)

    for round_index in range(1, max_rounds + 1):
        round_started = time.perf_counter()
        if is_mocked():
            reply = _next_mock_agent_reply(mock_list, round_index - 1)
        else:
            reply, config = _agent_reply_with_fallback(
                catalog=catalog,
                provider=provider,
                messages=messages,
                tools=tools,
                max_tokens=max_tokens,
            )
        total_tokens += reply.tokens.total_tokens or 0

        if not reply.tool_calls:
            event = trace.record_agent_round(
                trace_id=trace_id,
                route=route,
                provider=config.name,
                model=config.model,
                round_index=round_index,
                requested_tool=False,
                tool_name=None,
                tool_arguments=None,
                tool_result=None,
                elapsed_ms=(time.perf_counter() - round_started) * 1000,
                tokens=reply.tokens,
            )
            rounds.append(event)
            # The model answered, so the tokens are already spent. Discarding a
            # finished answer for going over budget wastes what was paid for and
            # leaves the caller with nothing. The budget still stops the loop from
            # starting another round further down.
            return AgentRunResult(
                content=reply.content,
                trace_id=trace_id,
                rounds=tuple(rounds),
                tool_results=tuple(tool_results),
                total_tokens=total_tokens,
                total_elapsed_ms=round((time.perf_counter() - started) * 1000, 2),
                stopped_reason=None,
            )

        messages.append(
            {
                "role": "assistant",
                "content": reply.content or None,
                "tool_calls": [
                    {
                        "id": call.id,
                        "type": "function",
                        "function": {
                            "name": call.name,
                            "arguments": json.dumps(call.arguments, ensure_ascii=False),
                        },
                    }
                    for call in reply.tool_calls
                ],
            }
        )

        call_summaries = []
        force_stop_reason = None
        for call in reply.tool_calls:
            tool = tool_by_name.get(call.name)
            if tool is None:
                output: Any = f"ERROR: Unknown tool {call.name}"
                guard_rejected = False
                guard_reason = None
                guard_limit_exceeded = False
                cached = False
            else:
                state = _agent_state(called_tools)
                guard_reason = tool.guard(state, call.arguments) if tool.guard else None
                guard_rejected = bool(guard_reason)
                guard_limit_exceeded = False
                cached = False
                if guard_rejected:
                    guard_rejections[call.name] = guard_rejections.get(call.name, 0) + 1
                    guard_limit_exceeded = guard_rejections[call.name] > guard_reject_limit
                    output = guard_reason
                    if guard_limit_exceeded:
                        force_stop_reason = "guard_rejection_limit_exceeded"
                else:
                    key = _cache_key(call.name, call.arguments)
                    if tool.cache and key in cache:
                        output = cache[key]
                        cached = True
                    else:
                        output = tool.handler(**call.arguments)
                        if tool.cache:
                            cache[key] = output
                    called_tools.append({"name": call.name, "arguments": call.arguments})

            output_text = _stringify_tool_result(output)
            messages.append(
                {
                    "role": "tool",
                    "tool_call_id": call.id,
                    "name": call.name,
                    "content": output_text,
                }
            )
            result = {
                "tool": call.name,
                "arguments": _redact_agent_trace(call.arguments),
                "output": _redact_agent_trace(output),
                "guard_rejected": guard_rejected,
                "guard_reason": guard_reason,
                "guard_limit_exceeded": guard_limit_exceeded,
                "cached": cached,
            }
            tool_results.append(result)
            call_summaries.append(result)

        event = trace.record_agent_round(
            trace_id=trace_id,
            route=route,
            provider=config.name,
            model=config.model,
            round_index=round_index,
            requested_tool=True,
            tool_name=", ".join(call.name for call in reply.tool_calls),
            tool_arguments={
                "calls": [
                    {
                        "tool": call.name,
                        "arguments": _redact_agent_trace(call.arguments),
                    }
                    for call in reply.tool_calls
                ]
            },
            tool_result={"calls": call_summaries},
            elapsed_ms=(time.perf_counter() - round_started) * 1000,
            tokens=reply.tokens,
        )
        rounds.append(event)

        if force_stop_reason:
            return AgentRunResult(
                content=(
                    "ERROR: Agent stopped because the same tool was rejected by "
                    "the guard too many times."
                ),
                trace_id=trace_id,
                rounds=tuple(rounds),
                tool_results=tuple(tool_results),
                total_tokens=total_tokens,
                total_elapsed_ms=round((time.perf_counter() - started) * 1000, 2),
                stopped_reason=force_stop_reason,
            )
        if max_total_tokens is not None and total_tokens > max_total_tokens:
            return AgentRunResult(
                content="ERROR: Agent stopped because the token cost limit was exceeded.",
                trace_id=trace_id,
                rounds=tuple(rounds),
                tool_results=tuple(tool_results),
                total_tokens=total_tokens,
                total_elapsed_ms=round((time.perf_counter() - started) * 1000, 2),
                stopped_reason="token_limit_exceeded",
            )

    return AgentRunResult(
        content=f"ERROR: Agent exceeded the {max_rounds}-round tool loop limit.",
        trace_id=trace_id,
        rounds=tuple(rounds),
        tool_results=tuple(tool_results),
        total_tokens=total_tokens,
        total_elapsed_ms=round((time.perf_counter() - started) * 1000, 2),
        stopped_reason="round_limit_exceeded",
    )


def call_model(
    *,
    system: str,
    user: str,
    schema: dict[str, Any],
    schema_name: str,
    mock: dict[str, Any],
    max_tokens: int | None = None,
    provider: str | None = None,
) -> dict[str, Any]:
    """调模型, 拿一个符合 schema 的 dict。

    `provider` 可以传:

    - `chat`
    - `planner`
    - `explainer`
    - `legacy`
    - `deepseek`
    - `ollama_cloud`
    """
    if is_mocked():
        return mock

    catalog = provider_catalog()
    trace_id = trace.new_trace_id()
    route = _route_name(provider)
    started = time.perf_counter()
    failures: list[dict[str, str]] = []

    for provider_name in _provider_chain(provider):
        config = catalog.get(provider_name)
        if config is None:
            failures.append({"provider": provider_name, "reason": "provider is unknown"})
            continue
        provider_started = time.perf_counter()
        try:
            result = _invoke_provider(
                config=config,
                system=system,
                user=user,
                schema=schema,
                schema_name=schema_name,
                max_tokens=max_tokens,
            )
            trace.record_model_call(
                trace_id=trace_id,
                route=route,
                provider=provider_name,
                model=config.model,
                provider_elapsed_ms=(time.perf_counter() - provider_started) * 1000,
                total_elapsed_ms=(time.perf_counter() - started) * 1000,
                tokens=result.tokens,
                ok=True,
                fallback_to=provider_name if failures else None,
                failures=failures,
            )
            return result.value
        except AgentUnavailable as exc:
            failures.append({"provider": provider_name, "reason": str(exc)})
        except Exception as exc:
            failures.append({"provider": provider_name, "reason": repr(exc)})

    selected_provider = _resolve_provider_name(provider)
    selected_config = catalog.get(selected_provider)
    trace.record_model_call(
        trace_id=trace_id,
        route=route,
        provider=selected_provider,
        model=selected_config.model if selected_config else None,
        provider_elapsed_ms=None,
        total_elapsed_ms=(time.perf_counter() - started) * 1000,
        tokens=None,
        ok=False,
        failures=failures,
    )
    message = " | ".join(
        f"{failure['provider']}: {failure['reason']}" for failure in failures
    )
    raise AgentUnavailable(message or "No AI provider succeeded")

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
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from dotenv import load_dotenv

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

ROUTE_PROVIDER_ENV = {
    CHAT_ROUTE: "CHAT_AI_PROVIDER",
    PLANNER_ROUTE: "PLANNER_AI_PROVIDER",
    EXPLAINER_ROUTE: "EXPLAINER_AI_PROVIDER",
}

ROUTE_PROVIDER_DEFAULTS = {
    CHAT_ROUTE: OLLAMA_CLOUD_PROVIDER,
    PLANNER_ROUTE: DEEPSEEK_PROVIDER,
    EXPLAINER_ROUTE: DEEPSEEK_PROVIDER,
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
) -> dict[str, Any]:
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
    return result


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
    failures: list[str] = []

    for provider_name in _provider_chain(provider):
        config = catalog.get(provider_name)
        if config is None:
            failures.append(f"{provider_name}: provider is unknown")
            continue
        try:
            return _invoke_provider(
                config=config,
                system=system,
                user=user,
                schema=schema,
                schema_name=schema_name,
                max_tokens=max_tokens,
            )
        except AgentUnavailable as exc:
            failures.append(f"{provider_name}: {exc}")
        except Exception as exc:
            print()
            print(f"========== TRIPSYNC AI ERROR [{provider_name}] ==========")
            print(repr(exc))
            print("===============================================")
            print()
            failures.append(f"{provider_name}: {exc}")

    raise AgentUnavailable(" | ".join(failures) or "No AI provider succeeded")

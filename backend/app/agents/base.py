"""所有 agent 共用的地基:模型调用 + MOCK 开关 + 脱敏上下文。

三件事在这里做死,各个 agent 不用各自小心:

  1. **MOCK_AI=1 就不发网络请求。** 测试和断网演示都靠它。
  2. **所有输出都按 schema 校验。** 支持 strict json_schema 的供应商直接让模型
     约束；DeepSeek 这类只支持 json_object 的供应商,回来后本地校验同一份 schema。
  3. **给模型的上下文由 safe_context() 构造。** 它只认脱敏结论,
     成员 id 和偏好原话根本传不进去 —— 不是"记得过滤",是没有入口。
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

MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
# DeepSeek、通义、本地 Ollama 等都提供 OpenAI 兼容接口 —— 改这一个地址就能换供应商，
# 代码一个字不用动。留空就是 OpenAI 官方。
BASE_URL = os.getenv("OPENAI_BASE_URL") or None
DEEPSEEK_THINKING = os.getenv("DEEPSEEK_THINKING", "disabled")


def is_mocked() -> bool:
    """真。断网、超额度、跑测试的时候都靠它。"""
    return os.getenv("MOCK_AI") == "1"


def _uses_json_object_mode() -> bool:
    """Providers that accept JSON mode but not OpenAI strict json_schema."""
    base_url = (BASE_URL or "").lower()
    return any(marker in base_url for marker in ("deepseek", "dashscope", "aliyuncs.com"))


def _extra_body() -> dict[str, Any] | None:
    """DeepSeek V4 defaults to thinking mode; chat UX needs the fast path."""
    if "deepseek" not in (BASE_URL or "").lower():
        return None
    if MODEL not in {"deepseek-v4-flash", "deepseek-v4-pro"}:
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
    类型上就装不下,所以任何 agent 都不可能不小心把它们塞进 prompt。
    """

    path: str
    headline: str
    detail: str
    blocked_by: tuple[str, ...]      # 命中的判据 label，固定文案
    findings: tuple[str, ...]        # 脱敏结论，例如 "This time falls outside…"
    affected_counts: tuple[int, ...]  # 各影响几人，只有数字

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


def _response_format(schema_name: str, schema: dict[str, Any]) -> dict[str, Any]:
    if _uses_json_object_mode():
        return {"type": "json_object"}
    return {
        "type": "json_schema",
        "json_schema": {
            "name": schema_name,
            "strict": True,
            "schema": schema,
        },
    }


def _json_object_system(system: str, schema: dict[str, Any]) -> str:
    if not _uses_json_object_mode():
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


def call_model(
    *,
    system: str,
    user: str,
    schema: dict[str, Any],
    schema_name: str,
    mock: dict[str, Any],
    max_tokens: int | None = None,
) -> dict[str, Any]:
    """调模型,拿一个符合 schema 的 dict。

    mock 是 MOCK_AI=1 时的固定返回,**形状必须和真返回一致** ——
    否则测试全绿但线上炸。
    """
    if is_mocked():
        return mock

    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise AgentUnavailable("OPENAI_API_KEY is not set")

    try:
        from openai import OpenAI

        client = OpenAI(api_key=api_key, base_url=BASE_URL, timeout=60.0)
        kwargs: dict[str, Any] = {
            "model": MODEL,
            "messages": [
                {"role": "system", "content": _json_object_system(system, schema)},
                {"role": "user", "content": user},
            ],
            "temperature": 0,
            "response_format": _response_format(schema_name, schema),
        }
        if not BASE_URL:
            kwargs["reasoning_effort"] = "none"
        extra_body = _extra_body()
        if extra_body:
            kwargs["extra_body"] = extra_body
        if max_tokens is not None:
            kwargs["max_tokens"] = max_tokens
        completion = client.chat.completions.create(**kwargs)
        result = json.loads(completion.choices[0].message.content)
        _validate_schema(result, schema)
        return result
    except AgentUnavailable:
        raise
    except Exception as exc:  # 超时、限流、改版、网络 —— 一律降级
        print()
        print("========== TRIPSYNC AI ERROR ==========")
        print(repr(exc))
        print("=======================================")
        print()
        raise AgentUnavailable(str(exc)) from exc

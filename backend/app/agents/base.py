"""所有 agent 共用的地基:模型调用 + MOCK 开关 + 脱敏上下文。

三件事在这里做死,各个 agent 不用各自小心:

  1. **MOCK_AI=1 就不发网络请求。** 测试和断网演示都靠它。
  2. **所有输出走 json_schema strict。** 不解析自由文本。
  3. **给模型的上下文由 safe_context() 构造。** 它只认脱敏结论,
     成员 id 和偏好原话根本传不进去 —— 不是"记得过滤",是没有入口。
"""

from __future__ import annotations

import json
import os
from dataclasses import dataclass
from typing import Any

from ..domain.constraints.types import Classification

MODEL = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
# DeepSeek、通义、本地 Ollama 等都提供 OpenAI 兼容接口 —— 改这一个地址就能换供应商，
# 代码一个字不用动。留空就是 OpenAI 官方。
BASE_URL = os.getenv("OPENAI_BASE_URL") or None


def is_mocked() -> bool:
    """真。断网、超额度、跑测试的时候都靠它。"""
    return os.getenv("MOCK_AI") == "1"


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


def call_model(
    *,
    system: str,
    user: str,
    schema: dict[str, Any],
    schema_name: str,
    mock: dict[str, Any],
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

        client = OpenAI(api_key=api_key, base_url=BASE_URL, timeout=20.0)
        completion = client.chat.completions.create(
            model=MODEL,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            response_format={
                "type": "json_schema",
                "json_schema": {
                    "name": schema_name,
                    "strict": True,
                    "schema": schema,
                },
            },
        )
        return json.loads(completion.choices[0].message.content)
    except AgentUnavailable:
        raise
    except Exception as exc:  # 超时、限流、改版、网络 —— 一律降级
        raise AgentUnavailable(str(exc)) from exc

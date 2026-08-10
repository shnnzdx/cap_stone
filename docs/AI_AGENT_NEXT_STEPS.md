# TripSync AI Agent Next Steps

这份文档基于 `/Users/jiayichen/Downloads/CODEX_AI_AGENT_BUILD_GUIDE.md` 和当前项目代码整理。

后续做 AI Agent 时，修改范围默认放在本项目 `/Users/jiayichen/Desktop/cap_stone` 内，不改 Downloads 里的原始说明文件。

## 1. 已学习并沿用的 Agent 原则

当前 TripSync / Cadensy 的 Agent 不是万能聊天机器人，而是 AI-mediated workflow：

```text
User natural language
  -> LLM understands ambiguity
  -> structured output
  -> deterministic domain rules validate
  -> human confirms
  -> backend writes
```

核心边界：

- AI 负责理解、转述、解释、生成候选方案。
- 普通代码负责事实、权限、时间、金额、日期、冲突、投票、确认、数据库写入。
- 所有 Agent 输出都必须走 strict JSON schema。
- 每个 Agent 都要支持 `MOCK_AI=1`，测试和演示不能依赖网络或模型稳定性。
- AI 不直接替用户提交、确认、投票或覆盖 Current Plan。
- 私密原文、membership id、姓名不能进入面向全组或 Agent prompt 的上下文。
- Agent 失败时，判定、投票、确认等核心流程必须照常可用。

当前正式实现已经符合这个方向：

- `backend/app/agents/base.py`：统一模型调用、mock、structured output、safe context。
- `backend/app/agents/chat.py`：自然语言改动 -> structured patch，再解释判定结果。
- `backend/app/domain/chat/service.py`：协调 Chat Agent、目标 item 匹配、patch 规范化、只读 classify。
- `backend/app/domain/constraints/engine.py`：纯确定性判定 NOTICE / ROUND / REOPEN_ROUND / CONFIRM。
- `backend/app/domain/decisions/orchestrator.py`：真正执行改动、投票、确认、通知和流水账。
- `backend/app/domain/preferences/service.py`：偏好和六种约束的读写、隐私隔离、冲突扫描。

## 2. 现在最适合继续做的 Agent

### Priority 1: Preference Agent

这是下一步最值得做的 Agent。

原因：

- 产品文档已经明确它是 AI 出场的核心入口之一。
- 后端已经有 `Preference`、`MemberConstraint`、`MemberConstraintPrivate` 和 `scan_conflicts()`。
- 现在缺的正是 AI 层：把“我腰不好，不想走太多路”翻译成可判定的六种约束之一。
- 它非常适合课堂或 capstone 演示，因为能直接体现“隐私原话只有自己可见，系统只保存可判定规则”。

建议实现：

```text
backend/app/agents/preference.py
  understand_preference(text) -> PreferenceUnderstanding

backend/app/domain/preferences/agent_service.py 或扩展 service.py
  draft_constraint_from_text()
  confirm_drafted_constraint()

backend/app/api/main.py
  POST /api/trips/{trip_id}/constraints/draft
  POST /api/trips/{trip_id}/constraints/confirm
```

结构化输出建议：

```json
{
  "kind": "walk_limit",
  "params": {"max_km_per_day": 3.0},
  "importance": "required",
  "restated": "I will remember this as: keep walking under 3 km per day.",
  "confidence": 0.82,
  "unsupported_reason": null
}
```

如果翻不进六种约束，返回：

```json
{
  "kind": null,
  "params": {},
  "importance": "flexible",
  "restated": "I cannot turn this into a rule the system can enforce.",
  "confidence": 0.2,
  "unsupported_reason": "This does not map to time, budget, date, walking, dietary, or avoid-tag rules."
}
```

关键产品规则：

- 只 draft，不直接写库。
- 用户点确认后才调用现有 `add_constraint()`。
- `original_text` 只能保存在 `MemberConstraintPrivate`，不能传给其他成员视图。
- 新增或改严约束后，只扫描并报告冲突，不自动改行程。

最小测试：

- `MOCK_AI=1` 能 draft 出六种约束之一。
- unsupported 文本返回 `kind: null`。
- draft 不写 `MemberConstraint`。
- confirm 才写 `MemberConstraint` + `MemberConstraintPrivate`。
- prompt 不包含其他人的 private wording、membership id、姓名。
- OpenAI 不可用时，普通 `/preferences/me`、`/constraints`、`/classify` 仍然工作。

### Priority 2: Explainer Agent

这是成本最低、展示效果最快的第二步。

它不需要新业务规则，只把已有 `Classification` 和 patch 解释成用户能看懂的话：

- 为什么是 Notice / Round / Confirm。
- 这次改动影响什么。
- 是否碰到已订项目、硬约束、已定时段、已有争议。
- 只说脱敏结论，不说谁、也不说私密原文。

建议实现：

```text
backend/app/agents/explainer.py
  explain_change(verdict, before, patch) -> Explanation
```

可以先复用 `chat.py` 里的 `explain()`，再把通用解释拆出来，避免 Chat Agent 逐渐变大。

### Priority 3: Options Agent

这个 Agent 适合在 Round 路径里增强产品体验。

现在 `orchestrator._options_for()` 固定给三项：

- Keep current
- New idea
- Split up

后续可以让 Options Agent 基于被争议时段和公开诉求生成更好的 3 个选项，但必须保留：

- `keep`
- `split`
- 最多一个或两个 AI 生成候选

关键边界：

- AI 只生成 options。
- 投票、计票、平票、过半、结算仍由 `orchestrator.py` 做。
- 如果 Agent 挂了，就退回现在的固定三项。

### Priority 4: Mediator Agent

这是最能体现“AI 协调”的 Agent，但实现复杂度比 Preference / Explainer 高。

适合等 Confirm 对话 UI 更完整后做。它可以：

- 把双方公开诉求改写成中性话术。
- 给 2-3 个替代方案。
- 提醒“这个方案还没通过”，但不能施压。
- 建议升级给 organizer，但不能替任何人决定。

红线：

- 不说“就差你一个”。
- 不读取或暴露私密原文。
- 它提出的新方案必须新建 proposal，不能偷偷修改原 proposal。

### Priority 5: Planner Agent

Planner 最有想象力，但也最容易失控，建议放后面。

原因：

- 它需要结合 `backend/data/poi_chicago.py`、预算、日期、营业时间、步行约束、兴趣标签。
- 生成后必须过确定性检查。
- 失败要重试一次；再失败要标记 blocked，而不是硬给一个违规行程。

建议先做“一天一批”的 Planner：

```text
generate_day_plan(day_index, constraints, poi_catalog, previous_days)
  -> PlanItem draft[]
```

每一天生成后立刻验证，只重做失败的那一天。

## 3. 推荐实施顺序

1. Preference Agent：让用户用自然语言填约束，补上产品入口。
2. Explainer Agent：把已有判定变成更清楚的用户解释，最快提升演示质感。
3. Options Agent：让投票选项更像智能协调，而不是固定模板。
4. Mediator Agent：做匿名确认对话里的斡旋能力。
5. Planner Agent：最后做完整行程生成和自动修复。

## 4. 下一步可以直接开的任务

建议下一次从 Preference Agent 开始，做一个最小闭环：

```text
用户输入一句偏好
  -> AI draft 成六种约束之一
  -> 前端展示 restated
  -> 用户确认
  -> 写入 MemberConstraint + MemberConstraintPrivate
  -> scan_conflicts()
  -> 返回冲突列表
```

这个闭环最贴合当前架构，也最能展示 TripSync 的差异化：AI 帮用户表达复杂偏好，但真正保护用户的是可审计、可测试、不会泄露隐私的规则系统。

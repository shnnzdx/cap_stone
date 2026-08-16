# Chat Agent / Planner 观察到的问题

最后更新：2026-08-15

## 背景

这份文档记录在 Plan 页面、Preferences 页面、Plan drawer Chat Agent 和
Planner 生成流程里，从真实用户视角观察到的问题。

最初测试场景是洛杉矶行程里的一个计划项：

```text
Can we replace this with something more relaxing?
```

当时选中的 item 是：

```text
Los Angeles Times Globe Lobby
Day 1, 9:00 AM
```

## 已观察到的问题

### 1. 替换地点能力目前受城市限制

当用户要求把洛杉矶的 item 替换成更放松的地方时，助手解释说当前无法为洛杉矶找到替换地点，因为 replacement place library 目前只支持 curated Chicago trips。

用户影响：

- 助手可以给一些替代方案，但不能真正为洛杉矶提供可用的 replacement venue。
- 非 Chicago trip 会退回到基于时间安排的选项，比如保留当前 item、移动时间、移动到另一天。

预期行为：

- 这个限制应该在回复里明确说明。
- 助手不应该暗示它能在未支持的城市里替换具体地点。

### 2. 数字选项回复会映射到错误选项

助手曾展示：

```text
1. Keep the current plan
2. Move it to 9:15 AM
3. Move it to Tuesday (2026-08-18)
```

用户回复：

```text
2
```

但助手把它理解成选择了 Tuesday move，而不是第二个 9:15 AM 的时间移动。

用户影响：

- 用户用简单数字回复时，可能选中错误选项。
- 助手会准备一个和用户真实意图不一致的 change proposal。

预期行为：

- 回复 `2` 应该精确选择第二个选项。
- assistant history 应保留选项顺序和稳定 option id。
- follow-up selection 应按 stable option identity 解析，而不是重新用自然语言猜一次。

### 3. 粘贴完整选项文本时可以正常工作

当数字回复选错后，用户粘贴完整文本：

```text
2. Move it to 9:15 AM — shift the start slightly later on the same day, where
nothing else is booked.
```

助手随后正确准备了 time-change proposal：

```text
Current: 9:00 AM
Proposed: 9:15 AM
Impact: NOTICE
```

用户影响：

- 底层 time-change proposal 能工作。
- 不稳定的是 compact option selection follow-up，不一定是 time-change classification 本身。

预期行为：

- 用户不应该必须粘贴完整选项文本。
- 点击选项或输入编号应该足够。

### 4. Apply 显示 backend reachability error，但真实原因是后端异常

9:15 AM proposal 准备好后，UI 显示：

```text
I could not reach the backend. Try again in a moment.
```

本地检查显示 backend 当时可达：

```text
GET http://127.0.0.1:8000/api/health -> {"ok": true}
```

进一步复现 Rosalind's Ethiopian Restaurant 的 time-change card 时发现：

```text
POST /api/plans/items/9e1e8448614441a18437f0ab02993503/changes
HTTP/1.1 500 Internal Server Error

TypeError: propose_change() got an unexpected keyword argument 'alternatives'
```

失败路径：

```text
backend/app/api/main.py submit_change()
-> orch.propose_change(..., alternatives=alternatives)
```

但 `backend/app/domain/decisions/orchestrator.py` 里的 `propose_change()` 当前没有 `alternatives` 参数。

用户影响：

- 用户看到的是“连不上后端”，但真实情况可能是后端 500。
- UI 没区分网络失败、后端 500、已知 JSON error。
- 即使助手正确分类为 `NOTICE`，Apply 仍可能失败。

预期行为：

- Apply 失败时应尽量显示更具体的错误。
- 本地测试出现该文案时，应检查 uvicorn/backend traceback。
- backend API 和 decision orchestrator 的函数签名应保持一致。

Status update, 2026-08-15:

- Fixed in `backend/app/api/main.py` and `backend/app/domain/decisions/orchestrator.py`.
- `submit_change()` still validates frontend `options` into backend-safe `alternatives`.
- `orch.propose_change()` now accepts `alternatives`.
- Alternatives are only used for `ROUND` and `REOPEN_ROUND` decision paths.
- `NOTICE` and `CONFIRM` paths still ignore alternatives, so the existing mutation boundary remains unchanged.
- The related time-window constants bug in `_validated_change_options()` was also fixed by importing `DAY_START_HOUR` and `DAY_END_HOUR` from `backend/app/agents/tools.py`.
- Regression coverage was added in `backend/tests/test_trips.py`.
- Additional vote-card cleanup: if the submitted `requested` patch and an assistant alternative patch are identical, the duplicate alternative is filtered out so the vote UI does not show two identical choices.

### 5. 错误文案会掩盖服务端失败

前端会把 missing status 和 500-level failures 映射成宽泛的 backend reachability 文案。

相关前端位置：

```text
trip/src/final/plan-feature/useAssistantChangeRequestFlow.js
trip/src/final/TripAppState.jsx
trip/src/final/FinalApp.jsx
```

用户影响：

- 服务端异常看起来像网络断了。
- 只看 UI 很容易误判问题方向。

预期行为：

- 面向用户的文案可以简洁，但本地日志/开发诊断应保留细节。
- 出现该文案时应检查 backend terminal。

Status update, 2026-08-15:

- Fixed in:

```text
trip/src/final/plan-feature/useAssistantChangeRequestFlow.js
trip/src/final/TripAppState.jsx
trip/src/final/FinalApp.jsx
```

- Missing HTTP status / network failures still use reachability copy.
- HTTP 500-level backend failures now use backend-error copy instead of reachability copy.
- This keeps user-facing text short, but gives developers the correct debugging direction: check backend logs rather than assuming the browser could not connect.

### 6. 偏好更新后没有明确的整计划更新入口

计划已经生成后，用户修改 preferences，会看到类似提示：

```text
Preferences updated
Your current plan was generated using earlier preferences and has not been
changed. Future replans and change proposals will use the latest planning inputs.
Review ->
```

但 Plan 页面没有明确动作让用户 regenerate 或 update 当前 itinerary。

用户影响：

- 用户知道 preferences 改了，但不知道如何让当前 itinerary 应用这些变化。
- 产品说 future replans 会用新输入，但没有把 replan 路径显性展示出来。
- 用户可能期待一个 whole-plan update confirmation flow，却只看到被动提示。

预期行为：

- stale-plan banner 应提供明确动作，比如 `Regenerate plan`、`Update itinerary`、`Review and replan`。
- 应说明当前 plan 在用户确认前不会改变。
- 如果 whole-plan regeneration 还不支持，UI 应直接说明，并引导用户使用已支持的 change proposal 流程。

### 7. Required planning inputs 在生成时可能没有被强制执行

用户在创建或配置 trip 时，可以在 prompt / preference flow 里写 required planning instructions。测试中观察到，有些被写成硬性要求的内容没有反映在生成 itinerary 里。

典型问题：

```text
User input: "Required: no seafood", "Required: avoid museums", or
"Required: start after 11 AM"

Generated itinerary: includes a seafood restaurant, museum-heavy day, or a
morning activity before 11 AM.
```

用户影响：

- 产品让用户相信 Required 是有意义的，但生成结果可能把它当成 soft preference。
- 用户必须手动检查每个生成 item，信任感会下降。
- 对 accessibility、dietary、budget、timing、safety 这类要求尤其严重。

预期行为：

- 任何标为 `Required` 的输入都应该被执行，或者明确报告无法满足。
- 生成计划应避免违反要求，或在接受 itinerary 前显示 blocked / needs-review。
- UI 应区分 hard requirements 和普通偏好。
- planner 无法满足时，应说明哪个 requirement 无法满足以及原因。

用户视角测试方法：

1. 从 fresh trip 开始，避免旧 plan 数据影响判断。
2. 每次只输入一个清晰、肉眼容易检查的 hard requirement：

```text
Required: no seafood restaurants.
Required: no museums.
Required: start every day after 11:00 AM.
Required: keep walking under 1 km per day.
Required: vegetarian meals only.
```

3. Generate itinerary。
4. 检查每天的每个 activity / meal card。
5. 记录生成结果是否违反该 requirement。
6. 同一个 requirement 至少测 3 次，因为 planner 输出可能波动。
7. 再测试两个 requirement 叠加，例如：

```text
Required: no museums.
Required: start every day after 11:00 AM.
```

8. 记录产品是遵守、阻止生成、解释 tradeoff，还是静默违反。

通过标准：

- 没有任何生成 item 违反 `Required` 输入。
- 如果无法生成合法 itinerary，产品明确说明，而不是生成一个违规计划。
- 生成后 requirement 仍然可见或可审计，方便用户对照检查。

失败标准：

- 任意生成 item 直接违反 `Required` 输入。
- 产品把 hard requirement 当成普通 preference。
- 用户只能靠自己看 itinerary 才发现 requirement 被忽略。

### 8. Limited availability 选项可见，但后端 / planner 没有端到端实现

Preferences 页面显示两个 availability 选项：

```text
Yes, all dates
No, I have limited availability
```

用户选择：

```text
No, I have limited availability
```

后，UI 会显示 `My Availability` 的日期窗口卡片。但这个路径看起来没有在 backend / persistence / planner flow 里端到端实现。用户视角看，它像是可选的真实约束，但实际不能信任。

用户影响：

- 用户可以表达 limited availability，但产品可能没有保存或执行它。
- planner 仍可能生成用户不可用日期上的活动。
- UI 暗示这是硬性 scheduling constraint，但后端不支持完整链路。

预期行为：

- 如果 limited availability 未实现，应隐藏或禁用该选项，并说明当前只支持 full-trip availability。
- 如果选项保留可见，后端应保存 selected availability window，planner 应执行它。
- 保存后重新打开 Preferences，应显示相同的 availability 状态。
- 生成 itinerary 不应包含用户不可用日期。

用户视角测试方法：

1. 打开一个跨多天的 trip。
2. 进入 `Preferences`。
3. 选择 `No, I have limited availability`。
4. 选择一个更小的可用窗口，例如五天 trip 中只选两天。
5. 保存 preferences。
6. 刷新浏览器并重新打开 `Preferences`。
7. 检查 `No, I have limited availability` 是否仍被选中，起止日期是否仍显示。
8. Generate / regenerate itinerary。
9. 检查生成 plan 是否包含 selected availability window 之外的活动。

通过标准：

- 选择的 limited availability window 保存后刷新仍存在。
- Planner 输出遵守该窗口。
- 如果不支持 limited availability，UI 在用户依赖它之前就阻止选择。

失败标准：

- 用户能选择 limited availability，但保存后丢失。
- Planner 生成不可用日期上的 itinerary items。
- UI 表示 limited availability 是真实功能，但后端忽略它。

### 9. 初次生成后再修改 preferences，没有 replan / preview 动作

如果用户第一次生成 itinerary 前填写 preferences，生成结果可以反映这些 preferences。但如果 itinerary 已经存在，用户后续再改 preferences，当前 plan 不会更新。UI 只显示 preferences changed 的提示，却没有明确按钮让用户 regenerate、preview differences 或 apply new preferences。

观察到的行为：

```text
1. User creates or opens a trip.
2. User fills preferences.
3. User generates an itinerary.
4. User later changes preferences.
5. The app shows a banner / notice that preferences were updated.
6. The itinerary stays the same.
7. There is no obvious action such as "Regenerate with new preferences" or
   "Preview updated plan".
```

用户影响：

- 用户可能以为 preference edits 坏了，因为 itinerary 没有变化。
- 产品告诉用户 preferences changed，但不给下一步。
- 用户不知道新 preferences 只影响未来小改动、未来 full replan，还是完全不影响。
- 生成前 preferences 很“有用”，生成后却变成被动提示，体验不一致。

预期行为：

- post-generation preferences 改变后，Plan 页面应显示明确动作，例如 `Regenerate with new preferences`、`Preview updated plan`、`Review replan`。
- 应解释当前 itinerary 在用户确认前保持不变。
- 如果 full replanning 未支持，UI 应明确说明 changed preferences 会影响什么。
- 用户应能在替换 itinerary 前比较 old vs new plan impact。

用户视角测试方法：

1. 创建 fresh trip。
2. 填写一组明确偏好，例如：

```text
Top interests: Culture
Preferred pace: Packed
```

3. Generate itinerary，并截图或记录生成内容。
4. 回到 `Preferences`。
5. 改成明显不同的偏好，例如：

```text
Top interests: Nature / Relaxed
Preferred pace: Slow
Required: start after 11 AM
```

6. 保存 preferences。
7. 回到 `Plan`。
8. 检查页面是否提供显性动作，让用户用新 preferences 更新当前 plan。
9. 检查 itinerary 是变化、带清楚解释地保持不变，还是无下一步地保持不变。

通过标准：

- App 明确说明现有 plan 已 stale。
- 用户有明显动作可以 regenerate 或 preview 新 plan。
- 保存新 preferences 后，用户不会被卡在只有提示没有操作的状态。

失败标准：

- App 只显示被动 notice，没有 replan / preview action。
- 用户不知道如何让新 preferences 影响 itinerary。
- 现有 plan 不变且没有明确下一步。

### 10. Item-scoped Ask Cadensy 会丢失 selected item context

用户从某个具体 plan item 打开 `Ask Cadensy`，drawer header 显示选中 item：

```text
Gloria Molina Grand Park
Civic Center, Los Angeles · 3:30 PM
```

Drawer 文案告诉用户可以询问这个 item 或提出修改。但用户输入简单的 item-relative request：

```text
move to 4pm
```

Cadensy 回复：

```text
I don't see that item in the Current Plan yet. Which item do you mean?
```

用户影响：

- 用户已经从具体 item 打开助手，再问 “which item do you mean?” 体验明显错误。
- 在 item-scoped drawer 里，`move to 4pm` 这种短请求应该足够。
- UI 和后端 / agent 看起来没有共享同一个 selected item context。

预期行为：

- 从 item 打开 `Ask Cadensy` 时，应把 item id 传入 chat / classification request。
- 助手应把 `move to 4pm` 理解成对当前 selected item 的修改。
- 如果 selected item 已不存在，应明确提示并刷新 plan，而不是让用户重复 item 名称。
- Drawer header 和 backend context 应一致。

用户视角测试方法：

1. 打开 generated itinerary。
2. 选择一个可见 item，例如：

```text
Gloria Molina Grand Park
3:30 PM
```

3. 点击该 item 的 `Ask Cadensy`。
4. 确认 drawer header 显示同一个 item。
5. 输入：

```text
move to 4pm
```

6. 检查 Cadensy 是为 selected item 准备 time-change proposal，还是反问用户指哪个 item。
7. 换另一个 item，再测：

```text
move this later
make this 30 minutes shorter
move this to tomorrow
```

通过标准：

- 助手使用 drawer selected item 作为上下文。
- 回复识别正确 item，并准备或分类对应 change。
- 用户不需要在 item-scoped drawer 中重复 item 名称。

失败标准：

- Drawer 从具体 item 打开后，Cadensy 仍问用户指哪个 item。
- Cadensy 说 Current Plan 里看不到该 item，但 UI 明明显示它。
- Drawer header item 和 backend-selected item 不一致。

## 当前判断

Chat Agent V1 的高层架构方向仍然是对的：

```text
AI proposes.
Backend rules decide.
Humans apply.
```

现在观察到的问题更具体：

- 非 Chicago replacement coverage 受限。
- 数字选项 follow-up 可能映射错选项。
- Apply failure 文案过于笼统。
- Apply endpoint 把 `alternatives` 传给了当前不接受该参数的 orchestrator 函数。
- backend/server logs 是定位 Apply 失败的必要信息。
- Vote option cards now render the concrete after-state of a proposed patch, and duplicate assistant alternatives are filtered when they are identical to the submitted proposal.
- preferences 更新后会让 plan stale，但缺少 whole-plan update action。
- required prompt / preference inputs 可能没有在 itinerary generation 中强制执行。
- limited availability 在 Preferences UI 中可见，但 backend / planner 没有端到端实现。
- 初次生成后再改 preferences，会 stale 但没有 regenerate / preview action。
- item-scoped `Ask Cadensy` 可能丢失 selected item context，导致助手反问用户指哪个 item。

## 建议修复优先级

1. 修复数字选项选择，确保 option id 和顺序可以可靠 round-trip。
2. 为 candidate options 返回后选择 `2` 添加 regression test。
3. 已修复：对齐 `submit_change()` 和 `orch.propose_change()`，避免包含 frontend candidate options 时 Apply 500。
4. 已修复：改善 Apply error diagnostics，不要把所有 backend 500 都展示成 reachability failure。
5. 在 replacement place library 支持更多城市前，明确保留 non-Chicago 限制说明。
6. Preferences 改变后添加明确 stale-plan action，或说明只有 future replans/change proposals 会使用新 preferences。
7. 为 required inputs 增加用户可见的 planner validation：生成后检查 itinerary 是否违反 hard requirements，违规时 block 或解释。
8. 要么端到端实现 limited availability，要么在 backend persistence 和 planner enforcement 完成前禁用该选项。
9. 增加 post-preference-edit replan flow：existing itinerary 上 preferences 改变后显示 regenerate / preview action。
10. 保留 item-scoped `Ask Cadensy` 的 selected item context，并为 `move to 4pm` 这类相对 prompt 添加 regression test。

# Next Handoff Prompt: Backend And Repo Refactor

Last updated: 2026-08-12

Use the following prompt when handing this repository to the next engineer or AI agent for backend cleanup, codebase consolidation, or further architecture work.

```text
你现在接手的是 `C:\Users\zdxzh\Desktop\capstone\New` 这个仓库。

今天的日期是 2026-08-11。

请先把下面这些内容当作“当前已确认事实”，然后再继续工作。除非你重新核对代码并拿到新证据，否则不要默认这些结论已经失效。

一、先读哪些文件

开始之前，先读这些文件来建立当前真实上下文：

- `README.md`
- `INTEGRATION-ROADMAP.md`
- `交接.md`
- `docs/HANDOFF_PROMPT_2026-08-11.md`
- `docs/navigation-known-wrong-behavior.md`
- `backend/README.md`
- `backend/LOCAL_DEV.md`
- `trip/BACKEND.md`

如果你接下来要整理具体后端架构，再优先看：

- `backend/app/api/main.py`
- `backend/app/domain/constraints/`
- `backend/app/domain/decisions/`
- `backend/app/domain/preferences/`
- `backend/app/domain/chat/`
- `backend/app/domain/planning/`
- `backend/app/agents/`
- `backend/app/db/`
- `backend/app/jobs/`

如果你接下来要整理前后端边界或剩余 frontend/trip 结构，再优先看：

- `shared/trip-navigation-policy/`
- `shared/session-runtime/`
- `trip/src/final/FinalApp.jsx`
- `trip/src/final/plan-feature/`
- `trip/src/final/TripAppState.jsx`
- `frontend/app/trip/page.tsx`

二、当前已经完成、不要随便重开的架构结论

以下 Candidate 已经完成：

- Candidate 1：Trip navigation seam
  - `shared/trip-navigation-policy/` 已经是 workspace destination / route reachability / restoration / invite destination 的统一 owner
- Candidate 2：technical session seam
  - `shared/session-runtime/` 已经是 `tripsync:*`、bearer token、request identity、invite cache、invalidate/logout sequencing 的统一 owner
- Candidate 3：FinalApp / Plan workspace seam
  - `trip/src/final/plan-feature/PlanFeature.jsx` 是唯一公开的 Plan feature 边界
  - `usePlanInteractionRuntime` 拥有 Plan 交互态与效果
  - `useAssistantChangeRequestFlow` 拥有 drawer-local assistant / change-request orchestration
  - `FinalApp` 只保留 route mount、workspace composition、PlanFeature inputs、command execution
- Candidate 4：initial plan generation ownership
  - `POST /plans/generate` 是唯一 canonical 初始行程生成入口
  - `backend/app/domain/plans/generator.py` 是 sole generation workflow owner
- Candidate 5：trip-scoped access boundary
  - trip-owned HTTP 访问边界已经集中到 `TripScope`
  - generic trip/resource scoping 不要再散回 route handler

除非代码证据显示这些边界已经被重新破坏，否则：

- 不要重新设计 Candidate 1
- 不要重新设计 Candidate 2
- 不要把 Candidate 3 再拆成很多浅 wrapper
- 不要把已经沉到深模块里的责任重新搬回 `FinalApp`
- 不要重开 Candidate 4
- 不要重开 Candidate 5

三、当前更适合继续推进的方向

现在更值得做的事情是：

1. 测试基线与构建稳定性维护
2. 后端代码整理
3. API 层、domain 层、agent 层、db 层的职责清理
4. 剩余仓库级整理
5. 删除浅层重复 helper、减轻 blast radius、提高测试定位性

不适合现在做的事情：

- 重开 Candidate 1/2/3 已冻结边界
- 为了“文件太大”就机械拆文件
- 把 `shared/` 继续做成 dumping ground
- 在没有明确 seam 的情况下大规模重命名或搬目录
- 先动实现、后想 ownership

四、你接下来工作的默认方式

默认按这个节奏推进：

第一步：先做 architecture assessment / grilling

- 先不要实现
- 先不要重构
- 先不要给表面化 interface
- 先从“当前代码到底哪里乱、为什么乱、哪里值得动”开始

第二步：只提炼真实 seam

每个候选点都要回答：

- 现在谁在拥有这块逻辑
- 这种 ownership 是否合理
- locality 是否差
- blast radius 是否大
- 是否难测
- 是否存在真实的 deeper module seam
- 如果抽出去，删除测试是否成立

第三步：通过后再设计，再分 phase 落地

不要一上来边分析边改。

五、如果先做后端整理，请遵守这些规则

把后端默认当成下一个主战场来审查。

重点关注：

- `backend/app/api/main.py` 是否承担了过多 orchestration
- `domain/constraints` 与 `domain/decisions` 的边界是否清晰
- `domain/chat` / `agents/` 是否有职责重叠
- `domain/planning` 是否存在“stub + fallback + orchestration”混杂
- `preferences`、`comments`、`booking`、`membership/auth` 是否各自有明确 service owner
- 是否存在 endpoint-specific logic 漏进 domain，或 domain policy 反过来漏进 API
- scheduler / jobs 与 domain execution 的关系是否清晰
- DB models、service shaping、API response shaping 是否过度耦合

你要优先区分：

- transport / HTTP concerns
- domain facts / domain policy
- orchestration / workflow sequencing
- persistence concerns
- AI adapter concerns

六、如果要提出“后端 Candidate”，请优先考虑下面这类真实问题

只在代码证据支持时选择，不要强行套：

- `api/main.py` 过于集中，适合做 deeper route-module seam
- planning/chat/preferences/decisions 某块存在 orchestration owner 混杂
- agent layer 和 domain layer 有双重解释权
- invalid boundary causes repeated tests or duplicated request shaping
- domain logic scattered across endpoint handlers + services + jobs

不要把下面这些当作充分理由：

- “这个文件很长”
- “这个目录名字不好看”
- “可以更优雅”
- “把 helper 挪出去会更整齐”

七、如果要继续 repo 整理，也请按 deletion test 做

允许继续整理：

- 已无意义的浅 helper
- 已被新 seam 取代的旧 glue code
- stale docs
- 与当前 source-of-truth 不一致的说明文档

不允许随便整理：

- 只移动文件位置但不改变 ownership
- 把旧问题从一个目录搬到另一个目录
- 创建很多名字好看但没有深度的 adapter

八、你交付分析结论时，请用这个格式

如果你是在做“下一轮 candidate assessment”，请输出：

1. 当前最值得整理的 1-3 个候选点
2. 每个候选点的真实问题
3. 代码证据
4. ownership 问题
5. deletion test
6. migration risk
7. 是否值得现在做
8. 推荐先 grill 哪一个

如果你是在做“某个 candidate 的 focused grilling”，请输出：

- 当前 responsibility clusters
- 依赖关系
- 哪些应该留下
- 哪些应该移走
- 建议边界
- 风险
- 是否 ready for interface freeze

如果你是在做“phase implementation”，请输出：

- 改了哪些文件
- 保持了什么不变
- 哪些旧逻辑被删掉了
- 跑了什么测试
- 精确结果
- 当前 gate 是否 PASS

九、当前 source-of-truth 提醒

- 主前端是 `frontend/`
- Trip workspace 源码是 `trip/`
- `/trip` 当前仍然是 host shell + embed handoff
- 后端主代码是 `backend/`
- 跨应用深 seam 在 `shared/`
- 编译产物不是 source-of-truth

十、从哪里开始最稳

如果没有新的用户指令，默认下一步建议是：

先确认当前任务是不是确实需要新的 backend architecture candidate。没有明确代码证据时，不要再主动打开 Candidate 6。

截至 2026-08-12，当前已确认事实是：

- Candidate 4 已完成
- Candidate 5 已完成
- 没有额外高价值 backend architecture refactor 目前值得立刻推进
- `api/main.py` 的 presentation / transaction concentration 仍然是已知 maintainability debt，但还不值得在没有新证据时重构

如果用户没有给出新的产品或架构目标，默认更稳的是先做：

- test baseline stabilization audit / implementation
- build stability cleanup
- 小范围的 stale docs / stale glue code 清理

只有在出现新的重复 contract drift、第二套 API surface、或明确 DTO/controller initiative 时，才重开新的 backend architecture assessment。
```

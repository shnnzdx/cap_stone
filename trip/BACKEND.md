# TripSync 后端契约

产品规则的权威文档。**打 ✅ 的已经实现并有测试守着,打 ⬜ 的还没做。**

代码在 [`backend/`](backend/),怎么跑见 [`backend/README.md`](backend/README.md)。
今天做了什么、为什么这么定,见 [`HANDOFF.md`](HANDOFF.md)。

前端仍是有状态的 mock UI,数据在 `src/final/tripContent.js` 和 `TripAppState.jsx` 两个文件里,
还没接后端。接的时候看第五节。

---

## 一、路径判定 ✅

**判定必须在服务端。** 放前端 = 任何人改改浏览器里的代码就能替别人确认。
实现在 `backend/app/domain/constraints/engine.py`,一个纯函数,不碰数据库、不调 AI。

### 每个时段的四档结实程度

| 档 | 怎么到这一档 | 推翻它要什么 |
|---|---|---|
| `loose` | AI 刚生成,没人碰过 | 谁都能改,走 Notice |
| `touched` | 有人改过一次,直接生效了 | 再有人提不同意见 → Round |
| `settled` | 投票结算过 / 全员确认过 | 要写理由,而且要过半数明确支持 |
| `booked` | 真的付钱订了 | 必须 Confirm,所有相关的人点头 |

**Notice 不算"定了"。** Notice 的意思是"暂时没人反对",不是"大家同意了"。
这个区分保证了最便宜那条路不会白白获得共识的地位。

### 判定顺序(从上往下,命中即停)

| 问 | 是 → | 界面上叫 |
|---|---|---|
| ① 已订?违反谁的 required?超预算上限?超日期范围? | `confirm` | Confirm |
| ② 这个时段 `settled` 了? | `reopen_round` | Round(高门槛) |
| ③ 这个时段 `touched` 了? | `round` | Round |
| ④ 都不是 | `notice` | Notice |

顺序不能颠倒:**硬底线永远排最前**,不管这个时段多松。

### 四条路各自的服务端行为 ✅

**Notice · 直接生效**
立即写入 Current Plan,向全体成员推一条**匿名**通知,不产生任何待办。
成员可在通知上表示异议 → 服务端升级为 Round。

**Round · 决策回合**
创建 DecisionRound,候选项**必须包含「分头行动」**。
截止时间:`planning`/`upcoming` 24h,`traveling` 2h。
到点由定时任务结算,按票数落地。平票 → 维持原样。
未投票成员记为没表态,**不得记为同意**,也不得阻塞结算。
全组一票没有到点了也结算成"维持原样",不许永远挂着。

**Round(高门槛) · 重开轮**
只有 `settled` 的时段会走这条。三条门槛:

1. **必须写理由** —— 不写,服务端返回 422 ✅
2. **要过半数明确支持才能推翻** —— 没表态的人算在"维持原样"这边 ✅
3. 同一个时段 48 小时内不能重开第二次 ⬜

第 2 条是核心:**推翻一个已有决定,需要超过总人数一半的人明确支持新方案。**
沉默在首次决定时是中性的,在推翻已有决定时倾向维持现状——懒得理的人显然不觉得需要改。

**Confirm · 逐人确认**
创建 ChangeProposal,发起人的表态创建时直接是 `accepted`。
其余受影响成员各自确认,**全部 accepted 才写入 Current Plan**。
任一成员 declined → 提案作废,Current Plan 不变。

### 防乱规则 ✅

1. `settled` 的时段,单个成员的新意愿不足以直接推翻,必须走重开轮。
   ~~多人联署~~ —— **这个机制已删除**。它要求私下拉票,而拉票正是本产品要消灭的行为。
2. `traveling` 时 Round 截止时间缩到 2 小时。
3. 一个时段**同时只能有一件未决的事**(一轮投票或一个提案)。
   数据库用部分唯一索引强制;应用层提前拦一道,返回 409 而不是 500。
4. 任何路径的对外输出都不得包含成员姓名或偏好原文。

### Trip 状态机 ⬜

`planning` → `upcoming` → `traveling` → `completed`,**按日期自动流转,不需要任何人点按钮**。
让组织者手动切换等于给他一个能改变全组决策成本的开关,违反"组织者不是超级用户"。

**没有 locked 状态。** Current Plan 持续有效,不存在发布/锁定流程。

---

## 一之二、三种角色的权限矩阵 ⬜(数据结构 ✅,接口未做)

**角色属于 TripMembership,不属于账户。** 同一个 User 可以在 A 旅行是 organizer、B 旅行是 participant。
**组织者不是超级用户**,只是多了几个「维护公共框架」的入口。

| 能力 | organizer | participant | guest |
|---|:--:|:--:|:--:|
| 查看 Current Plan | ✅ | ✅ | ✅ |
| 个人 AI 私聊 | ✅ | ✅ | ✅ |
| 提交/修改**自己的**偏好 | ✅ | ✅ | ✅ |
| 参与投票、参与确认 | ✅ | ✅ | ✅ |
| 在行程条目下公开评论 | ✅ | ✅ | ✅ |
| 发起改动(走判定) | ✅ | ✅ | ✅ |
| 查看成员名单 / 催交 / 延长截止 | ✅ | ✕ | ✕ |
| 生成并分享邀请链接 | ✅ | ✕ | ✕ |
| 接收升级上来的僵局 | ✅ | ✕ | ✕ |
| My Trips 仪表盘 / 跨多个 trip | ✅ | ✅ | ✕ |

### 三条不可妥协的规则

1. **组织者的偏好不享有更高权重。** 在约束求解里和其他人完全等权。
2. **组织者读不到私密偏好。** `planning_only` 对组织者和普通成员一视同仁。
   这不是 UI 层的隐藏,是数据层就分开存(见第二节)。
3. **任何角色都不能替别人做决定。** 不能替填偏好、不能替确认提案、
   不能把"未回复"当作同意、不能替人抬预算或改可用日期。

### 僵局出口 ⬜

Confirm 谈不拢时升级给组织者。**组织者唯一能做的是"不做决定"**,两个出口:

- **分头行动** —— 这个时段拆开,两拨人各去各的,之后汇合
- **空出来** —— 这个时段谁都不安排,变成自由活动

他不能选择任何一方的方案。这样死局有出口,但组织者仍然没有替别人做主的权力。

### Guest ⬜

**Guest 不是"缩水的参与者"。** 在这趟旅行内部,权利和有账户的参与者完全相同。
差别只在账户层面:没有 My Trips、不能创建 trip、只能通过邀请链接进入、换设备即失去访问。

**链接就是他的凭证** —— token 必须足够长且不可枚举,并且支持撤销。

**Save to account 的关键要求**:绑定账户时**保留原有的 TripMembership,不创建新成员**。
实现上是把 `trip_membership.user_id` 从 null 更新为新建的 user id,而不是新增一行。

---

## 二、隐私 ✅

**不是"记得过滤",是结构上漏不出去。** 三层:

| 层 | 怎么保证 |
|---|---|
| 数据库 | 用户写的原话在 `member_constraint_private`,判定用的在 `member_constraint`。判定引擎不查前者。 |
| 类型 | 判定结果只含 `AnonymizedFinding`,这个类型**没有** `membership_id`、**没有**原文字段。想漏没地方装。 |
| 通知 | `update_notice` 故意没有"是谁干的"这一栏。存了早晚被某个接口带出去。 |

| 字段 | 规则 |
|---|---|
| `MemberConstraintPrivate.original_text` | **永不下发**,任何角色都不行,包括组织者 |
| 冲突对话中其他成员的 `user_id` / `name` | **永不下发**,只发匿名标签 `Member A` / `Member B` |
| 偏好更新事件的 actor | **不存在这个字段** |

组织者能看到的只能是匿名聚合,例如
`"One accessibility requirement affects this activity"` —— 不含人名、不含原文。

> ⚠️ **已知弱点:6 人小组里匿名是脆的。** "有一条时间要求不能早于 9 点"——组里的人可能一猜就中。
> 这不阻塞开发,但对外不要宣称"完全匿名"。

---

## 三、实体

### User ✅
`id` `name` `email` `avatar` `created_at`

### Trip ✅
`id` `name` `destination` `preferred_start_date` `preferred_end_date`
`expected_group_size` `currency` `preferences_deadline` `status` `created_by_user_id` `created_at`

### TripMembership ✅
`id` `trip_id` `user_id`(guest 时为空) `guest_display_name` `role` `join_method` `status`

`user_id` 非空时,`(trip_id, user_id)` 唯一。

### InviteLink ✅(表)/ ⬜(接口)
`id` `trip_id` `token_hash` `is_primary` `expires_at` `revoked_at`

**存哈希不存明文** —— 数据库被看到也没法拿去冒充别人加入。
打开链接只读取 trip 信息,**不得自动创建 membership**;必须等用户提交昵称并选择 guest / login。

### Preference ✅(表)/ ⬜(接口)
`id` `trip_membership_id`(唯一)
`preferred_start_date` `preferred_end_date` `available_start_date` `available_end_date`
`ideal_budget` `maximum_budget` `currency` `budget_visibility`
`travel_style` `top_interests`(最多 3) `submitted_at`

Preferred 与 Available、Ideal 与 Maximum **必须是分开的字段**,不能合并。
`ideal < 实际 <= maximum` 是"可接受但需说明取舍";`> maximum` 是硬约束,触发 Confirm。

### MemberConstraint ✅ + MemberConstraintPrivate ✅

**这是原契约里 `EssentialNeed` 的替代品。** 自由文本无法被确定性判定,
所以拆成两张表:一张给机器,一张给人。

`MemberConstraint`:`id` `trip_membership_id` `kind` `importance` `params`

`kind` 只有六种:

| kind | params | 例子 |
|---|---|---|
| `time_window` | `earliest_hour` / `latest_hour` | 不早于 9 点 |
| `budget_ceiling` | `max_total_per_person` | 最多 $650 |
| `date_range` | `start` / `end` | 只有 13–18 号有空 |
| `walk_limit` | `max_km_per_day` | 每天走路不超过 3 公里 |
| `dietary` | `required_tags` | 必须有素食 |
| `avoid_tag` | `tags` | 不去夜店 |

`importance`: `required`(违反 → Confirm)| `flexible`(尽量满足,不改变判定)

`MemberConstraintPrivate`:`constraint_id` `original_text` `visibility`

**用户写的原话只存在这里。** 判定引擎不查这张表,面向全组的接口也不查。
只有两个地方读它:用户看自己填的东西,以及 AI 帮忙翻译的那一步。

> **AI 在这里的位置**:用户随便写一句话 → AI 翻译成六种之一 → **给用户确认** → 存下来。
> 以后判定只看存下来的规则,**再也不问 AI**。这样既保留了自由输入,又保证判定确定。

### Plan / PlanItem ✅
Plan: `id` `trip_id` `status`(`active` | `blocked`)`estimated_total_per_person` `currency`

PlanItem: `id` `plan_id` `day_index` `day_date` `start_hour` `duration_min`
`title` `place` `price_per_person` `tags` `dietary_tags` `is_meal`
**`lat` `lng`**(地图坐标,换地点时跟着换)
`source` `settledness` `settled_at` `settled_by_round_id`

`start_hour` 是小数,`14.5` 表示 2:30 PM。
`source`: `verified` | `ai_estimate` | `mock` | `not_verified`
—— **由代码打,不由 AI 自称**。让模型自己标可信度等于没标。

**每天的条目数是变长的。** 不要假设固定 3 条。

### PlanChange ✅ —— 流水账

`id` `plan_id` `plan_item_id` `origin` `patch` `reason`
`actor_membership_id` `source_round_id` `source_proposal_id` `applied_at`

**只追加,不修改,不删除。** 一个条目"现在长什么样"= 原始状态叠加所有改动。

`origin`: `notice` | `round` | `reopen_round` | `confirm` | `ai_generate` | `preference_update`

免费得到:版本号、"谁改的为什么"、可回滚、以及"已接受部分保留率"这个指标。

### DecisionRound ✅ + Vote ✅
Round: `id` `plan_item_id` `kind`(`normal` | `reopen`)`options` `reason`
`opened_at` `deadline` `status` `winning_option_id` `settled_at`

Vote: `id` `round_id` `trip_membership_id` `option_id`

**没有"弃权"这个选项。** 沉默 = 根本没有记录。
存成一条 `status='abstain'` 的记录,早晚有人把它当成一种表态。

### ChangeProposal ✅ + ProposalDecision ✅
Proposal: `id` `plan_item_id` `action_type` `before_json` `after_json`
`status` `requested_by_membership_id`

`status`: `waiting_affected_members` | `applied` | `withdrawn` | `declined`

Decision: `id` `proposal_id` `trip_membership_id` `status`(`accepted` | `declined` | `pending`)

发起人的记录**创建时直接是 `accepted`**。

### UpdateNotice ✅
`id` `trip_id` `plan_item_id` `kind` `title` `body` `can_object`

**故意没有 actor 字段。**

### PlanValidation ⬜
`status`: `passed` | `failed` | `blocked`
`failure_code`: `REQUIRED_CONSTRAINT_VIOLATED` | `BUDGET_LIMIT_EXCEEDED` | `DATE_RANGE_EXCEEDED` |
`SCHEDULE_OVERLAP` | `TRAVEL_TIME_INSUFFICIENT` | `INSUFFICIENT_DATA`

**生成规则**:首次生成失败 → 带着失败原因重新生成**一次** → 仍失败则标记 `blocked`,
向组织者展示匿名阻塞摘要,**不得展示一份看起来正常但实际违规的行程**。

---

## 四、接口

已实现 13 个,全部可在 http://localhost:8000/docs 直接点着试。

```text
GET    /api/health
GET    /api/trips/{trip_id}
GET    /api/trips/{trip_id}/plans/current
GET    /api/trips/{trip_id}/updates
GET    /api/rounds/{round_id}
GET    /api/proposals/{proposal_id}
GET    /api/plans/{plan_id}/changes          ← 流水账

POST   /api/plans/items/{item_id}/classify   ← 只试算，不执行
POST   /api/plans/items/{item_id}/changes    ← 判定 + 执行，一步到位
POST   /api/updates/{notice_id}/object       ← Notice 上的异议，升级为 Round
POST   /api/rounds/{round_id}/votes
POST   /api/rounds/{round_id}/settle         ← 演示用，真实场景由定时任务
POST   /api/proposals/{proposal_id}/decisions
```

**`/classify` 和 `/changes` 收同一个 body,走同一套判定。** 区别只是前者跑完回滚。
所以"试算"和"真做"永远不会给出不一致的答案。

身份目前靠请求头 `X-Membership-Id`。真做登录时**只改 `current_membership()` 一个函数**。

### 还没做的接口 ⬜

```text
GET    /api/me
GET    /api/trips                              My Trips
POST   /api/trips
GET    /api/trips/{id}/members
GET/PUT /api/trips/{id}/preferences/me         ← 偏好 + 六种约束的增删改
POST   /api/trips/{id}/invite
GET/POST /api/invites/{token}
POST   /api/trips/{id}/plans/generate          ← AI 生成
GET    /api/plans/{id}/validation
POST   /api/proposals/{id}/withdraw            ← 逻辑已实现，只差接口
POST   /api/plans/items/{id}/comments
```

---

## 五、前端接后端

`src/final/tripContent.js` —— 每一段替换成:

| 导出 | 换成 | 状态 |
|---|---|---|
| `trip` | `GET /api/trips/{id}` | ✅ 可用 |
| `initialDays` | `GET /api/trips/{id}/plans/current` | ✅ 可用,已含 `coords` |
| `baseUpdates` `personalUpdates` | `GET /api/trips/{id}/updates` | ✅ 可用 |
| `currentUser` | `GET /api/me` | ⬜ |
| `otherTrips` | `GET /api/trips` | ⬜ |
| `routeSegments` | 路段接口 | ⬜ 先 mock |
| `guestDraft` | 删掉 | — |

`src/final/TripAppState.jsx`:

| 现在 | 换成 | 状态 |
|---|---|---|
| `classifyChange()` | `POST .../classify` | ✅ |
| `applyDirectChange` / `openDecisionRound` / `createChangeProposal` | 全部合并成 `POST .../changes` —— **后端自己判定走哪条** | ✅ |
| `castVote` | `POST /api/rounds/{id}/votes` | ✅ |
| `resolveProposal` | `POST /api/proposals/{id}/decisions` | ✅ |
| `objectToNotice` | `POST /api/updates/{id}/object` | ✅ |
| `castVote` 里模拟别人投票的 `setTimeout` | **删掉** —— 服务端定时任务结算 | — |
| `TradeoffThread` 里模拟对方确认的 `setTimeout` | **删掉** —— 对方在自己客户端点 | — |
| `activeRound` / `activeProposal` 是单数 | 改成数组 | — |
| `localStorage('tripsync:createdTrips')` | 删掉 | — |

> 前端最大的一处简化:**不用再自己分三条路了。** 统一提交到 `POST .../changes`,
> 后端回一个 `path` 字段告诉你走了哪条,前端照着渲染就行。

新增字段前端要处理:

- `coords: [lat, lng]` —— 地图直接用,不用再靠地名去网上现查
- `needs_reason: true` —— 弹必填的理由框(重开轮)
- `kind: "reopen"` + `reason` —— 投票卡要显示成"重开"的样子,并写明**没表态 = 维持原样**
- `409` —— 这个时段已经有一轮开着,提示用户去投票或等它结束

---

## 六、还没做的功能

按重要性:

1. **AI 五个活** ⬜ —— 翻译约束 / 生成行程 / 解释与可信度标签 / 出候选项 / 私聊。
   接入方式见 [`HANDOFF.md`](HANDOFF.md)。
2. **偏好接口 + 六种约束的增删改** ⬜ —— 表有了,没有接口能填。也是 AI 翻译那一步的落点。
3. **AI Explanation + 可信度标签** ⬜ —— Why this works / Trade-offs / Verified·AI estimate·Mock。
   **这是"AI 提议、人来决定"唯一能被看见的地方,目前一条都没有。**
4. **预算视图** ⬜ —— 建议不做单独页面,把预算影响挂在每次改动上("+$12"),更符合"活的 Current Plan"。
5. **初始行程生成 + `blocked` 状态** ⬜ —— 依赖景点库。
6. **组织者角色** ⬜ —— 成员名单、催交、延长截止、僵局出口。
7. **登录 / 邀请链接 / Guest 加入** ⬜ —— 建议邮箱 magic link,不做密码。
8. **重开轮的 48 小时冷却期** ⬜ —— 半天的事。
9. **Trip 四状态自动流转** ⬜。

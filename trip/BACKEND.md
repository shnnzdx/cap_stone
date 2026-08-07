# TripSync 后端契约

给接手做后端的人。前端是**有状态的 mock UI**,请把它当接口草图,不是最终代码。

前端唯一的状态层是 `src/final/TripAppState.jsx`,唯一的假数据源是 `src/final/tripContent.js`。
**这两个文件之外没有任何数据**,替换它们即可接上真实后端。

---

## 一、三条路径必须在服务端判定

这是整个产品的核心逻辑,目前实现在 `TripAppState.jsx` 的 `classifyChange()`。

**它必须整个搬到服务端。** 判定和确认状态留在前端 = 任何人改改浏览器里的代码就能替别人确认。

### 判定规则

按顺序问两个问题:

**问题一:碰硬约束了吗?**

| 条件 | 判定 |
|---|---|
| 目标条目已 Booked / 有 locked 预订 | 路径 C |
| 违反任一成员的 Required constraint | 路径 C |
| 超出任一成员的 `maximum_budget` | 路径 C |
| 超出任一成员的 `available_date_range` | 路径 C |

**问题二:这个时段被争夺过吗?**

| 条件 | 判定 |
|---|---|
| 该 slot 已有其他成员表达过不同意愿 | 路径 B |
| 以上都不是 | 路径 A |

### 三条路径的服务端行为

**路径 A · 直接生效**
立即写入 Current Plan,向全体成员推一条**匿名**通知。不产生任何待办。
成员可在通知上表示异议 → 服务端将其升级为路径 B。

**路径 B · 决策回合**
创建 DecisionRound,携带候选项(**必须包含"分头行动"**)和截止时间(Planning 24h / Traveling 2h)。
到截止时间由**服务端定时任务**结算,按票数落地。
未投票成员记为 `no_preference`,**不得记为同意**,也不得阻塞结算。

**路径 C · 冲突对话**
创建 ChangeProposal,发起人状态直接为 `accepted`。
其余受影响成员各自确认,**全部 accepted 才写入 Current Plan**。
任一成员 decline 或发起人 withdraw → 提案作废,Current Plan 不变。

### 防乱规则(服务端强制)

1. 已由路径 B 结算的 slot,单个成员的新意愿**不足以重开**,需触碰硬约束或多人联署。
2. Trip 状态为 `traveling` 时,路径 B 截止时间缩短;可配置为直接降级为路径 A。
3. 任何路径的对外输出都**不得包含**成员姓名或偏好原文。

---

## 一之二、三种角色的权限矩阵

**角色属于 TripMembership,不属于账户。** 同一个 User 可以在 A 旅行是 organizer、B 旅行是 participant。
**组织者不是超级用户**,只是多了几个「维护公共框架」的入口。

| 能力 | organizer | participant | guest |
|---|:--:|:--:|:--:|
| 查看 Current Plan | ✅ | ✅ | ✅ |
| 个人 AI 私聊 | ✅ | ✅ | ✅ |
| 提交/修改**自己的**偏好 | ✅ | ✅ | ✅ |
| 参与决策回合投票(路径 B) | ✅ | ✅ | ✅ |
| 参与冲突对话(路径 C) | ✅ | ✅ | ✅ |
| 在行程条目下公开评论 | ✅ | ✅ | ✅ |
| 发起改动(走三条路径判定) | ✅ | ✅ | ✅ |
| 查看成员名单 / 催交 / 延长截止 | ✅ | ✕ | ✕ |
| 生成并分享邀请链接 | ✅ | ✕ | ✕ |
| Fact check(补充公共事实) | ✅ | ✕ | ✕ |
| 接收升级上来的僵局 | ✅ | ✕ | ✕ |
| My Trips 仪表盘 / 跨多个 trip | ✅ | ✅ | ✕ |
| 绑定账户(Save to account) | — | — | ✅ |

### 三条不可妥协的规则

1. **组织者的偏好不享有更高权重。** 组织者也必须提交自己的偏好,
   在约束求解里和其他人**完全等权**。不得给 organizer 的偏好加权。
2. **组织者读不到私密偏好。** `visibility = planning_only` 对组织者和普通成员**一视同仁**,
   都读不到原文。这不是 UI 层的隐藏,是 API 层就不返回。
3. **任何角色都不能替别人做决定。** 不能替填偏好、不能替确认提案、
   不能把「未回复」当作同意、不能替人抬预算或改可用日期。

### Guest 的特殊之处

**Guest 不是"缩水的参与者"。** 在这趟旅行**内部**,guest 的权利和有账户的参与者**完全相同**。
差别只在账户层面:

- 没有 My Trips 仪表盘(前端直接重定向回他所在的 trip)
- 不能创建 trip、不能成为 organizer
- 只能通过邀请链接进入 —— **这意味着链接就是他的凭证**,
  所以 token 必须足够长且不可枚举,并且应支持撤销
- 数据未绑定账户,换设备即失去访问

**Save to account 的关键要求**:绑定账户时必须
**保留原有的 TripMembership,不创建新成员**。
已提交的偏好、投过的票、确认过的提案全部转移到新账户下。
实现上是把 `trip_membership.user_id` 从 null 更新为新建的 user id,
而不是新增一行 membership。

### 前端如何切换角色(测试用)

改 `src/final/tripContent.js` 里 `currentUser.role` 一行:
`'organizer' | 'participant' | 'guest'`。
**没有做演示用的视角切换器** —— 真做了 auth 之后,角色由登录态 + membership 决定。

---

## 二、隐私:绝对不能下发到客户端的字段

这是硬要求,不是建议。

| 字段 | 规则 |
|---|---|
| `EssentialNeed.text` where `visibility = planning_only` | **永不下发**,任何角色都不行,包括组织者 |
| `Preference.*` where `visibility = planning_only` | 同上 |
| 冲突对话中其他成员的 `user_id` / `name` | **永不下发**,只发匿名标签 `Member A` / `Member B` |
| 偏好更新事件的 `actor` | **永不下发**,通知文案固定为 "A member preference was updated" |

前端已按此实现:冲突对话里当前用户显示 `You`,其他人显示 `Member A`。
**如果后端下发了真名,前端会显示出来** —— 请在 API 层就过滤掉,不要指望前端。

组织者能看到的只能是匿名聚合,例如:
`"One accessibility requirement affects this activity"` —— 不含人名、不含原文。

---

## 三、实体

### User
`id` `name` `email` `avatar` `created_at`
角色不在 User 上,在 TripMembership 上。同一个人可以在 A 旅行是组织者、B 旅行是参与者。

### Trip
`id` `name` `destination` `preferred_start_date` `preferred_end_date`
`expected_group_size` `currency` `shared_assumptions` `preferences_deadline`
`status` `created_by_user_id` `created_at`

`status`: `planning` | `upcoming` | `traveling` | `completed`
**没有 locked 状态。** Current Plan 持续有效,不存在发布/锁定流程。

### TripMembership
`id` `trip_id` `user_id`(guest 时为空) `guest_display_name` `role` `join_method` `status` `created_at`

`role`: `organizer` | `participant`
`join_method`: `creator` | `invite_guest` | `invite_login`
`status`: `invited` | `joined` | `preferences_submitted`

### InviteLink
`id` `trip_id` `token` `is_primary` `expires_at` `revoked_at` `created_at`

**`token` 必须是随机不可猜的**(建议 32 字节)。
前端目前用 `trip-{timestamp}` 当 id,**可被枚举,上线前必须换掉**。
打开链接只读取 trip 信息,**不得自动创建 membership**;必须等用户提交昵称并选择 guest / login。

### Preference
`id` `trip_membership_id`
`preferred_start_date` `preferred_end_date`
`available_start_date` `available_end_date`
`ideal_budget` `maximum_budget` `currency` `budget_visibility`
`travel_style` `top_interests`(最多 3) `anything_to_avoid` `submitted_at`

Preferred 与 Available、Ideal 与 Maximum **必须是分开的字段**,不能合并。
`ideal < 实际 <= maximum` 是"可接受但需说明取舍";`> maximum` 是硬约束,触发路径 C。

### EssentialNeed
`id` `preference_id` `text` `importance` `visibility`

`importance`: `required` | `flexible`
`visibility`: `planning_only` | `organizer` | `everyone`

`required` 永不可违反 —— 判定路径 C 的主要依据。

### Plan / PlanItem
Plan: `id` `trip_id` `version` `status` `estimated_total_per_person` `currency` `created_at`
PlanItem: `id` `plan_id` `day_id` `time` `title` `place` `type` `duration` `status` `source` `confidence` `notes`

**`day.items` 是变长数组。** 不要假设每天固定 3 条,AI 可能生成 2 条或 7 条。
`status` 只有 `booked` 和 `updated` 需要在 UI 上显示,其余不显示状态标签。
`source` / `confidence`: `verified` | `ai_estimate` | `mock` | `not_verified` ← **前端尚未实现,需要补**

### DecisionRound(路径 B)
`id` `plan_item_id` `options_json` `deadline` `status` `winning_option_id` `created_at`
Vote: `id` `round_id` `trip_membership_id` `option_id` `created_at`

`status`: `open` | `closed`
无投票记录的成员 = `no_preference`,**不是同意**。

### ChangeProposal(路径 C)
`id` `plan_item_id` `action_type` `before_json` `after_json`
`status` `requested_by_membership_id` `created_at`

`status`: `waiting_affected_members` | `applied` | `withdrawn` | `declined`
`action_type`: `edit_time` | `move_day` | `replace_place` | `remove_item`

ProposalDecision: `id` `proposal_id` `trip_membership_id` `status`
`status`: `accepted` | `declined` | `pending`
发起人的记录**创建时直接是 `accepted`**。

### PlanValidation
`id` `plan_id` `status` `failure_code` `safe_summary_for_organizer` `internal_details_json`

`status`: `passed` | `failed` | `blocked`
`failure_code`: `REQUIRED_CONSTRAINT_VIOLATED` | `BUDGET_LIMIT_EXCEEDED` | `DATE_RANGE_EXCEEDED` |
`SCHEDULE_OVERLAP` | `TRAVEL_TIME_INSUFFICIENT` | `AGREEMENT_CONFLICT` | `INSUFFICIENT_DATA`

**生成规则**:首次生成失败 → 带着失败原因重新生成**一次** → 仍失败则标记 `blocked`,
向组织者展示匿名阻塞摘要,**不得展示一份看起来正常但实际违规的行程**。

---

## 四、接口

```text
GET    /api/me

GET    /api/trips
POST   /api/trips
GET    /api/trips/:tripId

POST   /api/trips/:tripId/invite
GET    /api/invites/:token
POST   /api/invites/:token/join

GET    /api/trips/:tripId/members
GET    /api/trips/:tripId/preferences/me
PUT    /api/trips/:tripId/preferences/me

POST   /api/trips/:tripId/plans/generate
GET    /api/trips/:tripId/plans/current
GET    /api/plans/:planId/validation

POST   /api/plans/:planId/items/:itemId/classify   ← 三条路径判定,返回 { path, headline, detail }
POST   /api/plans/:planId/items/:itemId/apply      ← 路径 A
POST   /api/plans/:planId/items/:itemId/rounds     ← 路径 B 开一轮
POST   /api/rounds/:roundId/votes                  ← 路径 B 投票
POST   /api/plans/:planId/items/:itemId/proposals  ← 路径 C 建提案
POST   /api/proposals/:proposalId/decisions        ← 路径 C 逐人确认
POST   /api/proposals/:proposalId/withdraw

GET    /api/trips/:tripId/updates
POST   /api/updates/:updateId/object               ← 路径 A 通知上的异议,升级为路径 B
POST   /api/plans/:planId/items/:itemId/comments
```

---

## 五、前端需要替换的具体位置

`src/final/tripContent.js` —— 每一段都标了对应接口:

| 导出 | 替换为 |
|---|---|
| `currentUser` | `GET /api/me` |
| `trip` | `GET /api/trips/:id` |
| `otherTrips` | `GET /api/trips` |
| `initialDays` | `GET /api/trips/:id/plans/current` |
| `routeSegments` | 路段接口(暂无,先 mock) |
| `baseUpdates` `personalUpdates` | `GET /api/trips/:id/updates` |
| `initialComments` | `GET /api/plans/:id/sections/:sid/comments` |
| `guestDraft` | 删掉,真实场景由用户填写 |

`src/final/TripAppState.jsx`:
- `classifyChange()` → 改为调用 `POST .../classify`
- `applyDirectChange` / `openDecisionRound` / `castVote` / `createChangeProposal` / `resolveProposal` → 改为对应接口
- `castVote` 里模拟其他成员投票的 `setTimeout` → 删掉,真实投票由各自客户端提交
- `TradeoffThread` 里模拟对方确认的 `setTimeout` → 同上
- `localStorage('tripsync:createdTrips')` → 删掉

---

## 六、前端尚未实现的功能(需要一起规划)

按重要性:

1. **组织者角色完全不存在** —— Fact Check、补充公共事实、提醒成员、延长 deadline、
   处理路径 C 升级上来的僵局。目前路径 C 谈不拢是死路一条。
2. **成员名单** —— 看不到"6 人里 4 人交了偏好";`preferences_deadline` 目前是个不产生行为的输入框。
3. **AI Explanation + 可信度标签** —— Why this works / Trade-offs / Verified·AI estimate·Mock。
   这是"AI 提议、人来决定"唯一能被看见的地方,目前一条都没有。
4. **预算视图** —— Ideal/Maximum 在偏好表单里很细,但 Plan 页没有任何预算区块,
   改动也不显示 "+$12" 之类的影响。
5. **初始行程生成** —— 新建的 trip 永远停在 "No itinerary yet",没有生成、没有 `blocked` 状态。
6. **Suggestion vs Needs adjustment** 两种反馈没区分,目前只有公开评论。
7. **多个并发决策回合** —— `activeRound` 目前是单数,两个时段同时被争夺会互相覆盖。
8. Guest 的 "Save to account";Trip 四状态目前只是标签,没有状态机。

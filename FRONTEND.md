# TripSync 前端逻辑与控件规格

给接手的人。**先读这份,再读代码。** 后端契约见 [BACKEND.md](BACKEND.md)。

---

## 一、一句话逻辑

组织者创建 Trip 框架 → 成员各自提交带隐私设置的三层 Preference → AI 生成共享 Current Plan。
之后任何人想改动,系统先判定影响范围,**按三条路径分流**:多数直接生效只发通知,
被争夺的开一轮全员投票,碰硬约束的才拉受影响成员进匿名对话。

**没有 Lock,没有 Final 发布。** Current Plan 一直是活的。

---

## 二、数据怎么流动

```
用户在某个行程条目上发起改动
        │
        ▼
  classifyChange()          ← TripAppState.jsx,将来搬到服务端
   问题一:碰硬约束吗?  ── 是 ──▶ 路径 C:createChangeProposal()
   问题二:被争夺过吗?  ── 是 ──▶ 路径 B:openDecisionRound()
        └──── 都不是 ────────▶ 路径 A:applyDirectChange()
        │
        ▼
  appliedPatches[itemId]     ← 三条路径最终都写进这里
        │
        ▼
  Plan 页渲染时: patched(item) = { ...item, ...appliedPatches[item.id] }
```

**关键设计**:Plan 页不直接改 `initialDays`,而是用 `appliedPatches` 覆盖。
这样"原始行程"和"已生效改动"分离,将来换成后端的 PlanItem 版本号很自然。

### 状态清单(全在 `TripAppState.jsx`)

| 状态 | 含义 |
|---|---|
| `appliedPatches` | `{ itemId: patch }`,已生效的改动 |
| `contestedSlots` | 被碰过一次的 slot id,决定下次走 A 还是 B |
| `notices` | 路径 A 产生的匿名通知 |
| `activeRound` | 当前决策回合(**目前只支持一个,需要改成数组**) |
| `activeProposal` | 当前提案(同上) |
| `decisionResolved` | 提案是否已全员确认 |
| `trips` | 用户创建的 trip,持久化在 localStorage |
| `preferences` | 当前用户的三层偏好 |

---

## 二之二、三种角色

角色属于 **TripMembership**,不属于账户。同一个人可以在 A 旅行是组织者、B 旅行是参与者。

**组织者不是超级用户**,只是多了几个「维护公共框架」的入口。
Plan / Chat / Updates / Preferences 三种角色**完全一致**,三条路径的行为和匿名规则也完全一致。

| | 有账户 · 组织者 | 有账户 · 参与者 | 无账户 · Guest |
|---|---|---|---|
| Plan / Chat / Updates / Preferences | ✅ | ✅ | ✅ |
| 参与决策回合、冲突对话 | ✅ | ✅ | ✅ |
| 自己也必须填偏好,**不享有更高权重** | ✅ | ✅ | ✅ |
| `Members` 标签(名单 / 催交 / 延长截止) | ✅ | ✕ | ✕ |
| `Invite` 标签 | ✅ | ✕ | ✕ |
| My Trips 仪表盘、多个 trip | ✅ | ✅ | ✕ 只有这一趟 |
| 顶栏 | Organizer 标记 | 无标记 | Guest 标记 + Save to account |

**Guest 不是"缩水的参与者"。** 在这趟旅行里,guest 的权利和有账户的参与者**完全相同**;
差别只在账户层面(没有仪表盘、没有跨 trip、数据未绑定)。
Guest 随时可以 Save to account,**绑定后保留原 membership,不新建成员**。

### 组织者不能做的事(界面上也要挡住)

- 替任何人填写或修改偏好
- 把"未回复"当作同意
- 读取 `planning_only` 的偏好原文 —— **这条对组织者和普通成员一视同仁**
- 代替别人确认提案
- 强行解除 Blocked

### 怎么切换角色测试

改 `tripContent.js` 里 `currentUser.role` 一行即可(`organizer` / `participant` / `guest`)。
**没有做演示用的视角切换器** —— 真做了 auth 之后,不同人登录自然看到不同视角,
切换器是注定要删的代码。

---

## 三、每个控件该怎么实现

`✅` = 已实现且有真实行为 　`🟡` = 有行为但是模拟的 　`⬜` = 占位,点了没反应

### Dashboard `/`

| 控件 | 当前行为 | 接后端后 |
|---|---|---|
| ✅ Logo | 回 `/` | 不变 |
| ✅ MY TRIPS / NEW TRIP | 路由切换 | 不变 |
| ✅ 🔔 Action inbox | 展开下拉,列出"有回合待投"和"有提案待确认";无事时显示 No trip actions | `GET /api/me/actions`,**跨所有 trip 聚合**。只放需要用户操作的,不放普通动态 |
| ⬜ 头像菜单 7 项 | 全是占位,点了没反应 | Profile/Privacy/Settings 各自成页;Sign out 清 token |
| ✅ Create new trip 横条 | → `/create` | 不变 |
| ✅ 黄色提醒条 | 有回合或提案时出现 → `/trip/:id/updates` | 同 Action inbox 数据源 |
| ✅ Trip 卡片 | → `/trip/:id/plan` | `GET /api/trips`;**注意现在 Lake house 等三张卡没有独立数据,点进去会落到演示 trip** |

### 创建 Trip `/create`

| 控件 | 当前行为 | 接后端后 |
|---|---|---|
| ✅ 全部表单字段 | 受控,值真的被使用 | 不变 |
| ✅ 日期选择器 | 点第一下设起始,第二下设结束;若第二下早于第一下则自动对调 | 不变 |
| ✅ Create trip | 名称+目的地+日期齐全才可点。生成 trip 加进列表 → `/trip/:id/invite` | `POST /api/trips`,用返回的真 id 跳转 |

### 邀请 `/trip/:id/invite` 与 `/join/:id`

| 控件 | 当前行为 | 接后端后 |
|---|---|---|
| ✅ Copy link | 写剪贴板,链接由 `window.location.origin` 动态拼 | 链接里必须换成**不可猜的 token**,不能是 trip id |
| ✅ Start planning | → `/plan` | 不变 |
| ✅ Join and set preferences | → `/preferences` | `POST /api/invites/:token/join`,**成功后才创建 membership**;打开链接本身不入伙 |

### Plan `/trip/:id/plan`

| 控件 | 当前行为 | 接后端后 |
|---|---|---|
| ✅ 顶部 5 个 tab | 路由切换;Updates 上的红点 = 待办数 | 不变 |
| ✅ ✦ Ask TripSync(标题级) | 打开侧栏,mode=`global`,问整体行程 | 接真 LLM |
| ✅ Day 手风琴 | 展开/收起,默认展开 Day 2 | 不变 |
| ✅ 💬 评论 | 展开评论框;已有评论显示条数角标 | `POST .../comments`。**公开评论是署名的**,与匿名偏好是两回事 |
| ✅ ✦ 单条 Ask | 打开侧栏,mode=`ask`,只问这一条 | 接真 LLM |
| ✅ ••• 菜单 | 6 项,点外部关闭 | 见下 |
| ⬜ Route 按钮(条目之间) | 无反应 | 展开真实路线详情;距离文案现在是 mock |
| ✅ 回合卡的 3 个选项 | 投票 | `POST /api/rounds/:id/votes` |
| 🟡 回合卡自动结算 | 投票后 2.6 秒模拟其他人投票并落地 | **删掉定时器**;由服务端定时任务到截止时间结算 |
| ✅ discuss instead | → 冲突对话 | 手动把回合升级成路径 C |

**••• 菜单 6 项的统一流程**(这是产品核心,不要简化):

```
点击菜单项 → 打开侧栏,显示"Current Plan stays unchanged"
          → 用户输入诉求(可留空,用示例)
          → 点 Check impact → classifyChange()
          → 显示判定结果 + 路径阶梯(Notice / Round / Confirm)
          → 点执行按钮:
               路径 A → Apply now           → 立即生效,跳 Updates
               路径 B → Open the round      → 开回合,跳 Updates
               路径 C → Send for confirmation → 建提案,跳冲突对话
```

| 菜单项 | 说明 |
|---|---|
| Edit time | 改时间。若改到 9:00 前会触发 Required 违反 → 路径 C |
| Move to another day | 换天 |
| Replace place | 换地点 |
| Mark as booked | **唯一一个直接生效、不走三路径的操作**。它只标记状态,不改安排 |
| Remove from plan | 删除条目 |
| View details | 只读详情,不走判定流程 |

### 助手侧栏

| 控件 | 当前行为 | 接后端后 |
|---|---|---|
| ✅ 输入框 + Check impact | 触发判定 | `POST .../classify` |
| ✅ 执行按钮 | 按路径分流,执行后禁用 | 对应三个接口 |
| ✅ Cancel / × | 关闭侧栏,不产生任何改动 | 不变 |

### Chat `/trip/:id/chat` 与 `/conflict`

| 控件 | 当前行为 | 接后端后 |
|---|---|---|
| ✅ 会话列表 | TripSync 私聊常驻;冲突对话仅在有提案时出现 | 不变 |
| ✅ 私聊输入 | 发消息,AI 回固定话术 | 接真 LLM。**这个对话是私密的,不进组** |
| ⬜ ＋ 按钮 | 无反应 | 附件/图片 |
| 🟡 冲突对话自动解决 | 进页面 4 秒后模拟对方确认 | **删掉定时器**;对方在自己客户端点 accept |
| ⬜ Suggest another option | 只弹 toast | 让 AI 重新生成候选 |
| ✅ Withdraw | 撤回提案,Current Plan 不变 | `POST /api/proposals/:id/withdraw` |

**冲突对话的匿名规则(不可妥协)**:当前用户显示 `You`,其他人显示 `Member A`/`Member B`。
姓名和偏好原文**不下发到前端**。前端已按此实现,后端也必须在 API 层过滤。

### Updates `/trip/:id/updates`

| 控件 | 当前行为 | 接后端后 |
|---|---|---|
| ✅ All / For you / Actions | 筛选切换 | `GET .../updates?scope=` |
| ✅ Reset demo | 清空所有演示状态 | **上线前删掉这个按钮** |
| ✅ I have a different idea → | 路径 A 的通知升级成路径 B | `POST /api/updates/:id/object` |
| ✅ Open the conversation | → 冲突对话 | 不变 |
| ✅ Withdraw | 撤回提案 | 同上 |

三个 tab 的语义:**All** = 所有动态(只看);**For you** = 提及和回复;
**Actions** = 需要你操作的(回合待投 / 提案待确认)。只有 Actions 会产生红点。

### Preferences `/trip/:id/preferences`

| 控件 | 当前行为 | 接后端后 |
|---|---|---|
| ✅ Preferred dates | 理想日期 | `preferred_start/end_date` |
| ✅ Available range(折叠) | 可接受的最宽窗口 | `available_start/end_date`,**必须与上面分开存** |
| ✅ Ideal / Maximum budget | 两个独立字段 | 同上,超 Maximum 触发路径 C |
| ✅ 预算可见性 | 三档 | `budget_visibility` |
| ✅ Top interests | **最多选 3 个**,超出不响应 | `top_interests` |
| ✅ Essential needs 行 | 文本 + Required/Flexible + 三档可见性,可增删 | 独立 `EssentialNeed` 表,不是一个大文本 |
| ✅ Save preferences | 保存,过滤掉空行 | `PUT .../preferences/me` |

**Required 的行为**:它是路径 C 判定的主要依据。现在代码里演示的是"不早于 9:00",
用户填 `Edit time → 8:00 AM` 就会被判定为违反 Required。

---

## 四、目前是假的东西(接后端时必须处理)

1. `castVote` 里 2.6 秒模拟其他成员投票 —— 删掉
2. `TradeoffThread` 里 4 秒模拟对方确认 —— 删掉
3. `classifyChange` 在前端 —— **搬到服务端**,否则任何人都能替别人确认
4. `localStorage('tripsync:createdTrips')` —— 删掉
5. 路线距离 `routeSegments` —— 换成真实路径数据
6. 地图是 CSS 画的示意图 —— 换成真地图
7. `activeRound` / `activeProposal` 是单数 —— 改成数组
8. Reset demo 按钮 —— 删掉

---

## 五、样式说明

`final.css` 是**追加式**长出来的单文件,有大量 `!important`,同一个类会被定义多次
(`.tripUnifiedTabs` 有 11 处)。**改样式时全文搜索类名,以最后一次出现为准。**
文件头有详细注释。这个文件值得推平重构,但建议等界面定稿后一次性做,
并用 `getComputedStyle` 全站快照做回归比对(截图在自动化环境里不可靠)。

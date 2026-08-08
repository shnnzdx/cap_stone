# TripSync · Living Demo

AI 协调的多人旅行规划工具的前端原型。核心理念:**没有 Final 发布或 Lock 流程**,系统维护一份持续更新的 Current Plan。

**技术栈**:前端 Vite + React 18 + React Router 6(HashRouter,无 UI 框架);
后端 Python + FastAPI + PostgreSQL,在 [`backend/`](backend/)。

> **前端还没接后端。** 前端数据仍是 mock + localStorage;后端已独立跑通(判定、三条路径、
> 投票结算、流水账,13 个接口)。接法见 [BACKEND.md](BACKEND.md) 第五节和 [HANDOFF.md](HANDOFF.md)。

## 快速开始

```bash
npm install
npm run dev
```

打开 http://localhost:5173/trip-app/

其他命令:`npm run build` 打生产包到 `dist/`,`npm run preview` 本地预览生产包。

---

## 核心机制:一个改动怎么进入 Current Plan

这是整个产品最重要的一段逻辑。**每个改动先问两个问题,答案决定它走三条路里的哪一条。默认走最便宜的那条。**

**问题一:碰硬东西了吗?**(违反谁的 Required / 超谁的 Max budget / 动到已 Booked / 超出谁的 Available 日期)
碰了 → 路径 C。没碰 → 继续问第二个。

**问题二:有人跟它抢吗?**(同一时段最近已经有别人表达过不同意愿)
有 → 路径 B。没有 → 路径 A。

判定的权威实现在后端 `backend/app/domain/constraints/engine.py`,前端那份 `classifyChange()` 是等着被删掉的 mock。

**实际有四条路,不是三条**:`settled`(已经投票定过)的时段会走一条门槛更高的重开轮 ——
要写理由,而且要过半数明确支持才能推翻。判定顺序和四档"结实程度"见 [BACKEND.md](BACKEND.md) 第一节。

### 路径 A · 直接生效 + 匿名通知(约 80%)

AI 直接改 Current Plan,在 Updates 发一条通知。**不要求任何人做任何操作。** 通知上有「I have a different idea」,谁点了就升级成路径 B。

### 路径 B · 决策回合(约 15%)

那个时段变成一张**卡片**(不是聊天)。AI 给 3 个候选,**必须包含「分头行动」**。全员一键表态并行进行,显示 `n / 6 responded`,有截止时间(旅行前 24h,旅行中 2h)。到点按票数落地。卡片上有「None of these work — discuss instead」可手动升级到路径 C。

### 路径 C · 冲突对话(约 5%)

只有受影响成员 + AI 进 Chat。**全程匿名**:当前用户显示 You,其他人显示 Member A / Member B,姓名和私密原因都不进前端。发起人默认已同意,其余成员各自确认,**全部确认才写入 Current Plan**。谈不拢升级组织者。

### 四条防乱规则

1. **沉默的含义按路径分档。** 路径 A 的沉默 = 同意(反对只要点一下,成本极低);路径 B/C 的沉默 = 未表态,**不算同意也不阻塞**,到截止就按已有表态落地。
2. **已定的时段,单个人的想法不足以重开。** 需触碰硬约束或多人联署,否则就是无限重新审议。
3. **Traveling 状态整体降级。** 路径 B 截止缩到 2h;街上站着六个人时不跑异步投票。
4. **三条路径都不暴露偏好原文。** 永远只说 "one private constraint",不出现姓名和原因。

### 为什么不默认用聊天

聊天是这套工具里最贵的东西:串行、无截止、参与成本高、没被拉进去的人不知道发生过。而回合是并行的、有 deadline 的、一键完成的。把选择题塞进聊天,等于用最贵的工具解决最便宜的问题,而且会漏人。

**A 想逛街 → B 想去河边 → C 想去艺术馆** 这个场景下,正确流程是:A 的诉求走路径 A 直接生效;B 提出竞争意见时才开一轮,**C 自动在同一轮里**;全程零次聊天。

---

## 目录结构

```
src/
├── main.jsx                入口
├── App.jsx                 HashRouter 外壳
└── final/
    ├── FinalApp.jsx        ★ 全部页面与路由
    ├── TripAppState.jsx    ★ 全局状态 + classifyChange 三路径判定
    ├── tripContent.js      ★ 全部 mock 数据(含 currentUser),每项都标了对应接口
    └── final.css           全站样式(追加式,详见文件头注释)
FRONTEND.md                 ★ 前端逻辑 + 每个按钮的行为规格(接手先读这份)
BACKEND.md                  ★ 后端契约:实体、接口、隐私红线、未实现清单
legacy/                     旧版原型(v4 五阶段版)与旧交接文档,仅存档,不参与构建
```

**接手顺序:[FRONTEND.md](FRONTEND.md) → [BACKEND.md](BACKEND.md) → 代码。**
数据只存在于 `tripContent.js` 和 `TripAppState.jsx` 两个文件里,组件不持有任何业务数据。

## 路由(HashRouter,均在 `#/` 下)

```
/                      My Trips dashboard
/create                创建 Trip(组织者)
/trip/:id/plan         共享 Current Plan(行程 + 路线图 + TripSync 侧栏 + 回合卡)
/trip/:id/chat         Chat:个人 AI 私聊
/trip/:id/conflict     Chat:匿名的冲突对话(仅路径 C)
/trip/:id/updates      Updates:All / For you / Actions
/trip/:id/preferences  三层约束 Preference 表单
/trip/:id/invite       组织者邀请链接页
/join/:id              Guest 通过邀请链接加入
```

## 其他已实现的逻辑

- **三层约束 Preference**:Preferred dates vs Available range、Ideal vs Maximum budget、Essential needs 每条自带 Required/Flexible + 三档可见性(Private / Organizer / Everyone)。Required 会真的触发路径 C。
- **Preference 更新匿名**:共享 feed 里永远不出现"某某更新了偏好",只有匿名系统条目。
- **创建 Trip 是真实的**:表单受控,创建后**新增**一张卡片进 My Trips(localStorage 持久化),不替换演示卡。新 trip 的 Plan 页是 Planning 空状态,不伪造行程。
- **邀请链接**从当前部署地址动态生成;guest 加入后直接进入 Preference 表单。
- Updates 页右上有 **Reset demo**,一键清空演示状态。

## Demo 演示路径

1. Plan → Day 2 → 「Art Institute」三点菜单 → Replace place → **Check impact**
   → 判定 **路径 A**,点 Apply now,直接生效,Updates 只多一条通知,**没有人需要操作**
2. 在那条通知上点 **I have a different idea**
   → 升级 **路径 B**,Actions 出现回合卡,三个选项,投一票后其余成员陆续表态,自动落地并写入 Plan
3. Plan → 「Birthday dinner」(已预订)→ Edit time → **Check impact**
   → 判定 **路径 C**,点 Send for confirmation,进入**匿名**冲突对话(You / Member A),对方确认后才更新

另可演示:`/create` 创建新 trip → 复制邀请链接 → `#/join/:id` 走 guest 加入 → 填三层 Preference。

## 接后端

完整契约见 **[BACKEND.md](BACKEND.md)** 第五节,交接说明见 **[HANDOFF.md](HANDOFF.md)**。

三条红线里,前两条后端已经做掉了:

- ✅ `classifyChange()` 已在服务端。前端那份删掉,改调 `POST /api/plans/items/{id}/changes`。
- ✅ 私密原文和成员姓名**结构上就下发不出去**:原文单独一张表,判定结果的类型里没有姓名字段。
- ⬜ 邀请链接的不可猜 token —— 表已经存哈希了,加入接口还没做。

前端最大的一处简化:**不用再自己分路了。** 统一提交,后端回一个 `path` 告诉你走了哪条。

## 已知未实现

**后端**:AI 五个活、偏好接口、景点库、登录/邀请、组织者功能。详见 [HANDOFF.md](HANDOFF.md) 第五节。

**前端**:组织者角色、成员名单、AI Explanation 与可信度标签、预算视图、初始行程生成与 Blocked 状态、
Suggestion/Needs adjustment 区分。

## 部署到 GitHub Pages

1. `vite.config.js` 里的 `base` 改成 `'/<仓库名>/'`
2. `npm run build`,把 `dist/` 发布到 gh-pages 分支

HashRouter 下子路由都在 `#/` 后,不需要 404 重写。

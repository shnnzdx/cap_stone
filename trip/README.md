# TripSync · 前端逻辑原型 (v4)

AI 协调的多人旅行计划工具。本仓库是**前端逻辑原型**:不追求美观,只追求逻辑链清晰、板块清晰。
界面语言全站英文;代码注释与逻辑说明为中文。

**技术栈**:Vite + React 18 + React Router 6 + CSS Modules(无 UI 框架,无后端)

## 快速开始

```bash
npm install
npm run dev
```

打开 http://localhost:5173

其他命令:`npm run build` 打生产包到 `dist/`,`npm run preview` 本地预览生产包。

## 目录结构

```
src/
├── main.jsx                  应用入口
├── App.jsx                   路由表（= 信息架构）
├── styles/
│   ├── tokens.css            ★ 设计 token：对接 Design System 的唯一改动点
│   └── global.css            重置 + 基础排版 + 少量工具类
├── data/
│   ├── trips.js              旅行列表、阶段定义、阶段三态判定
│   └── seed.js               芝加哥四人组种子数据（计划部分卡、摘要、反馈聚合…）
├── context/
│   └── TripContext.jsx       全局 trip 状态；接后端时只改这里
├── components/               可复用组件
│   ├── primitives.jsx        Card / Badge / CredibilityTag / Chip / Banner / Button …
│   ├── PlanSectionCard.jsx   ★ 计划部分卡（全站核心组件）
│   ├── ReviewPanel.jsx       ★ 满意度与接受分离控件
│   ├── AiNote.jsx            AI 统一可识别样式
│   ├── Sidebar.jsx           主导航
│   ├── SubNav.jsx            二级栏（阶段导航 + 权限闸门）
│   ├── StepStatus.jsx        成员端三行文案
│   ├── TripRow.jsx           列表行
│   ├── DemoSwitch.jsx        △ 演示状态切换器（原型脚手架）
│   └── LogicNote.jsx         △ 逻辑说明块（原型脚手架）
├── layouts/
│   ├── OrganizerLayout.jsx   组织者外壳
│   ├── MemberLayout.jsx      成员外壳
│   └── TripWorkspace.jsx     ★ trip 工作区 + 路由守卫
└── pages/
    ├── HomePage.jsx          原型入口（真实产品由登录态决定，不存在这一页）
    ├── organizer/            TripList / CreateTrip / Collect / Analyze / Plan / Review / Lock
    └── member/               TripList / Invite / Preferences / Review / Confirm
```

★ = 核心,改动前先读注释  △ = 原型脚手架,上线前整组删除

## 路由表(= 信息架构)

```
/                                    入口页（选择进入哪一端）

/organizer                           My Trips
/organizer/archived                  Archived
/organizer/create                    创建旅行
/organizer/trip/:tripId/:stage       stage ∈ collect | analyze | plan | review | lock

/member                              My Trips
/member/archived                     Archived
/member/invite                       邀请落地
/member/trip/:tripId/:stage          stage ∈ preferences | review | confirm
```

**「深链表达意图,不表达位置」** 在 `TripWorkspace.jsx` 落地:

| 深链情况 | 行为 |
|---|---|
| 未指定阶段 | 重定向到「我的下一步动作」所在阶段 |
| 指向未到的阶段 | 降级重定向到当前阶段(越权不报错,只是看不到) |
| 指向已完成阶段 | 放行,但显示只读横幅 +「返回当前阶段」 |
| trip 不存在 | 404 兜底页,不出现空白页 |

## 导航结构(两端一致)

**主导航 = 侧边栏**:My Trips / Archived / 账号设置。点 My Trips → 主内容区出现该分区的旅行列表。

**点进某个 trip → 二级栏出现该 trip 的阶段页**:

- 组织者端:`① Collect → ② Analyze → ③ Plan vN ⇄ ④ Review → ⑤ Lock`
- 成员端:`① Share preferences → ② Review the plan → ③ Confirm the trip`
- 覆盖关系:成员① = 组织者①②;成员② = 组织者③④;成员③ = 组织者⑤

阶段标签三态:**已完成**(✓,可点回看)、**当前**(高亮)、**未到**(🔒,不可点)。

## 核心概念

**锁定(Lock)不是"让 AI 确定方案",而是全组正式拍板。** 锁定标志决策期结束、执行期开始:

| | 决策期(锁定前) | 执行期(锁定后 → 旅行结束) |
|---|---|---|
| 计划性质 | 待议方案 | 大家照着执行的文件 |
| 变更成本 | 重:新版本 + 全员重新表态 | 轻:多数改动不需全员表态 |
| 版本号 | v1 → v2 → v3(协商轮次) | v2.1 → v2.2(执行期调整) |
| 结束 | 全组接受 → 锁定 | 过结束日期 → 转「已结束」,真正只读 |

## 已实现的不可砍项

- **可信度标签**(四种可区分):Mock 数据 / AI 估算 / 人工验证 / 未验证 → `primitives.jsx`
- **部分状态徽章**(五种):已接受 / 待反馈 / 本版已修改 / 违反硬约束(配锁图标)/ 已冻结 ❄
- **满意度与接受分离** → `ReviewPanel.jsx`。条件必填、Reject 必须指认部分,均由提交闸门强制
- **修改摘要卡**:保留 / 改了 / 为什么 / 解决了谁 / 影响
- **修改预案卡**(组织者专属):AI 改前预告,全部取消须填理由
- **硬约束标识**永远配锁图标、永远不点名
- **草稿自动保存**提示(云端,跨设备恢复)
- **AI 统一样式** → `AiNote.jsx`,全站 AI 输出只走这一个组件

## 三条语义原则

1. 全站一个主强调色(`--c-accent`)
2. AI 发言有统一可识别样式(`AiNote`)
3. 硬约束标识永远配锁图标、永远不点名

## 颜色怎么改

**所有颜色集中在 `src/styles/tokens.css`**,业务组件一律只引用 CSS 变量。
Design System 页定稿后,只替换该文件的值即可全站生效,不需要动任何组件。

## 怎么看这份原型

- 每屏顶部有蓝色 **演示状态** 切换器,演示该屏分支(v1/v2/生成失败、锁定前/执行期/已结束、链接四态等)
- 每屏底部有黄色 **📋 逻辑说明** 折叠块:入口、目标、关键分支、出口、对应的边界决策编号
- 种子数据统一为芝加哥四人组(Emma / Noah / Mia / Liam)

上线前删除脚手架:全局搜索 `DemoSwitch` 与 `LogicNote`,连同 `components/DemoSwitch.*`、`components/LogicNote.*` 一起移除。

## 与 v4 文档的差异(需同步文档)

1. **主导航改为侧边栏**,阶段导航上升为 trip 级二级栏 —— 推翻了文档第二节「不设侧边栏、阶段导航由页内 Stepper 承担」。
2. **② Analyze 的组织者权限收窄**:涉及成员私密硬约束的妥协由 AI 私聊该成员本人三选一(调约束/提方案/退出),组织者无按钮、只见匿名结论(决策8);组织者只能改自己创建时设为 Fixed 的字段。任何在该页做出的选择写入 v1 解释行与 Decision Log,成员可在 ④ Review 提条件推翻(防锚定)。

## 部署到 GitHub Pages

1. 把 `vite.config.js` 里的 `base` 改成 `'/<仓库名>/'`
2. `npm run build`,把 `dist/` 内容发布到 `gh-pages` 分支(或用 GitHub Actions)

注意:React Router 用的是 history 模式,GitHub Pages 直接访问子路径会 404。
简单做法是把 `dist/index.html` 复制一份为 `dist/404.html`。

## 待办

- What-if 面板(组织者专属,③ Plan 侧栏)—— 最后实施,未完成则以截图入答辩 PPT(决策13)
- 落地页 Interactive Example 目前用东京,需与组员统一为芝加哥

# 做 AI Agent 需要的一切

动手前把这份读完。产品上每个 agent 负责什么见 [`PRODUCT.md`](PRODUCT.md) 第七节;
本文是**怎么做**:环境、数据形状、接口、红线、目录、测试。

---

## 一、动手前先有这些

| | 状态 | 怎么弄 |
|---|---|---|
| Python 环境 | ✅ | `backend/.venv` |
| PostgreSQL + 数据 | ✅ | `.venv/bin/python -m app.db.seed` |
| 判定引擎 | ✅ | `app/domain/constraints/engine.py`,0.03 秒,不花钱 |
| 三条路径的执行 | ✅ | `app/domain/decisions/orchestrator.py` |
| **策展景点库(49 个)** | ✅ | `backend/data/poi_chicago.py` |
| **OpenAI key** | ⬜ | **你填** —— `cp .env.example .env`,写进 `OPENAI_API_KEY` |
| `openai` 依赖 | ⬜ | `.venv/bin/pip install openai`,并加进 `requirements.txt` |

⚠️ **key 绝不能进代码,也绝不能提交。** `.env` 已经在 `.gitignore` 里。
充了钱的 key 传上 GitHub,几分钟内会被爬虫刷爆——这不是理论风险。

---

## 二、五条红线

违反任何一条,这次改动就是错的。

1. **上下文里永远不含别人的私密原话。**
   只能给脱敏结论(`code` + `safe_text` + `affected_count`)。
   这一条同时挡住隐私泄露和 prompt 注入——prompt 里根本没有私密数据,套也套不出来。

2. **AI 不判定走哪条路。** 判定永远是 `engine.classify()`。
   模型同一个问题问两次可能给不同答案,而这个产品卖的是公平。

3. **AI 不替任何人提交或确认。** 用户点了才调 `/changes` 或 `/decisions`。

4. **可信度标签由代码打,不由 AI 自称。**
   景点来自策展库 = `verified`,AI 编的价格时长 = `ai_estimate`。
   让模型给自己的可信度打分等于没打。

5. **Mediator 不许施压。** 不得输出「就差你一个」这类话。

### 还有一条工程上的

**AI 挂了不能影响主流程。** 判定、投票、确认这三条不依赖 AI。
OpenAI 超时、限流、报错,这三个接口的行为必须一个字不变——写测试守住。

---

## 三、MOCK_AI 不是可选项

```bash
MOCK_AI=1    # 返回固定假回复，不发任何网络请求
```

**必须实现。** 答辩现场断网、超额度、OpenAI 抽风的时候,demo 照样要能走完。

约定:每个 agent 都要有一份固定的假返回,形状和真返回**完全一致**。
测试全部在 `MOCK_AI=1` 下跑,所以跑测试不花钱、不联网、不会因为模型改版而变红。

---

## 四、目录与形状

```
app/agents/
├── base.py          ✅ 客户端 + MOCK_AI 开关 + 脱敏上下文构造
├── chat.py          ✅ 私聊：听懂改动 → 试算 → 说人话（已实现）
├── explainer.py     ✅ 判定结果 → 人话（已实现，是最好的模板）
├── preference.py    ⬜ 人话 → 六种约束
├── mediator.py      ⬜ 冲突对话里的斡旋
├── planner.py       ⬜ 景点库 → 行程（dataclass/stub 已留，函数体待填）
└── options.py       ⬜ 争议时段 → 三个选项

app/domain/plans/
└── generator.py      ✅ 生成管道：过滤合法 candidates → Planner → 规则兜底 → 验证 → 写库
```

**每个 agent 都是纯函数**:输入 dataclass → 输出 dataclass。
不碰数据库、不碰 FastAPI、不自己发起副作用。和判定引擎同样的纪律——
这样才能单测,也才能在 `MOCK_AI=1` 下跑。

副作用(写库、建提案)由调用方做,不在 agent 里。

### 全部输出走结构化 schema

用 OpenAI 的 `response_format={"type":"json_schema", "json_schema":{..., "strict": True}}`。
**不要解析自由文本。** 模型少写一个括号就崩,而且没法测。

---

## 五、你能拿到的东西

### 判定结果(Explainer / Mediator / Options 的输入)

`engine.classify()` 返回,或者 `POST /api/plans/items/{id}/classify` 拿到:

```json
{
  "path": "confirm",
  "headline": "This breaks a required constraint",
  "detail": "...",
  "needs_reason": false,
  "checks": [
    {"id":"booking","label":"Confirmed booking on this item","hit":false,"privateNote":""},
    {"id":"required","label":"Required constraint of a member","hit":true,
     "privateNote":"One member has a required constraint here. Who they are and why stays private."},
    {"id":"settled","label":"...","hit":false,"privateNote":""},
    {"id":"contested","label":"...","hit":false,"privateNote":""}
  ],
  "findings": [
    {"code":"TIME_WINDOW","text":"This time falls outside a required time window.","affected_count":1}
  ]
}
```

**这就是能给 AI 的全部。** 里面没有 membership_id、没有姓名、没有原话——
类型上就装不下,所以你不需要额外过滤。

### 六种约束(Preference 的输出)

| kind | params | 例子 |
|---|---|---|
| `time_window` | `earliest_hour` / `latest_hour` | 不早于 9 点 |
| `budget_ceiling` | `max_total_per_person` | 最多 $650 |
| `date_range` | `start` / `end` | 只有 13–18 号有空 |
| `walk_limit` | `max_km_per_day` | 每天走路不超过 3 公里 |
| `dietary` | `required_tags` | 必须有素食 |
| `avoid_tag` | `tags` | 不去夜店 |

`importance`: `required`(违反 → Confirm)| `flexible`(不改变判定)

**翻不进这六种就返回 `kind: null` + 一句说明**,不许硬塞。
系统会老实告诉用户"这条我保护不了,请写进公开说明"——假装保护比不保护更糟。

### 景点库(Planner 的输入)

`backend/data/poi_chicago.py`,49 条。每条:

```
名字 · 区域 · lat · lng · 每人$ · 分钟 · 开 · 关
walk(low|medium|high) · access[] · diet[] · tags[]
```

`access` / `diet` / `walk` 这三栏是给约束判定用的——用户填了"走不了太多路",
只有景点上有 `walk` 这一栏,程序才判断得出来。

⚠️ 库里价格和营业时间是估算,`source` 一律 `ai_estimate`。人工核实过的才能改 `verified`。

---

## 六、五个 Agent 各自的规格

| | 触发 | 输入 | 输出 | 失败怎么办 |
|---|---|---|---|---|
| **Preference** | 用户在偏好页/私聊里说了一句要求 | 一句自然语言 | `{kind, params, importance, restated, confidence}` | 翻不进六种 → `kind: null` |
| **Explainer** | 每次判定完 · 每条行程条目 | 判定结果 + 改动前后 | 为什么这么排 / 牺牲了什么 / `+$12 · 步行 +15min` | 没把握就不显示,不要编 |
| **Mediator** | 有人被拉进匿名对话 | 脱敏结论 + 双方公开诉求 + 景点库 | 开场说明 · 2–3 个替代方案 · 谈崩时的升级建议 | 退回到只描述现状 |
| **Planner** | 生成初始行程 / 修连锁影响 | 匿名约束集 + 景点库 | `PlanItem[]`,**一天一批** | 重生成一次 → 还不行标 `blocked` |
| **Options** | 判定结果是 Round | 被争的时段 + 双方诉求 | 3 个选项 | 退回「保持原样 / 分头行动」两个 |

### `restated` 是干什么的

Preference 的输出里,`restated` 是给用户看的人话:

> **你**:我腰不好,走不了太多路
> **AI**:我把它记成「每天走路不超过 3 公里」,对吗?  ← 这句就是 restated
> **你**:对 → 才写库

**没有这一步就是 AI 替用户做了决定。**

### Planner 为什么一天一批

失败只重做那一天,不用整个推倒;用户也能看着进度一天天出来。
生成第 2 天时把第 1 天的结果一起给它看,避免两天安排重复的地方。

---

## 七、AI 想改行程,走和人一样的门

**没有后门,也不需要后门。**

```
POST /api/plans/items/{item_id}/changes
X-Membership-Id: <给 AI 建一个 membership>
```

返回里 `path` 告诉你后端把它判成了哪条路:

| path | 意思 | `applied` |
|---|---|---|
| `notice` | **当场就改了** | `true` |
| `round` / `reopen_round` | 开了一轮投票,行程没变 | `false` |
| `confirm` | 建了一个待确认,行程没变 | `false` |

试算用 `/classify`,**同一个 body、同一套判定,跑完回滚**——所以试算和真做永远不会不一致。
不花钱、不慢,可以随便试。

### 两条给自动改动的约束

- **AI 改的东西要署名,不能匿名。** 匿名是为了保护人,AI 不需要保护。
  通知写「TripSync 调整了这里」,不写「一位成员改了」。
- **要有刹车。** 同一个条目不能连着改、一轮不能改超过 2–3 条。
  不然出 bug 会疯狂重排整个行程。

---

## 八、做的顺序

```
1. Preference   ← 先做。没有它用户填不了约束，后面全是空转
2. Explainer    ← 最便宜，而且立刻能演示（卖点终于看得见）
3. Mediator     ← 「AI 协调」这个定位唯一能被看见的地方，不依赖景点库
4. Planner      ← 依赖景点库
5. Options      ← 前三个能演之后再做
```

**别按架构图从左到右做。** Explainer 只是把已经算好的结果说成人话,
不需要景点库、不需要用户确认流程,半天就能看到效果。

---

## 九、每个 agent 至少要有这些测试

```
MOCK_AI=1 下能跑通，且不发任何网络请求
输出一定符合 schema（Preference 的 kind 一定在六种之内，否则是 null）
传给模型的 prompt 里不含任何 membership_id、姓名、私密原话   ← 断言这条
OpenAI 报错时，classify / changes / votes 三个接口行为不变
```

第三条最重要。写法:把构造好的 prompt 字符串抓出来,断言里面找不到
数据库里那条 `MemberConstraintPrivate.original_text`。

跑测试:

```bash
cd backend && DISABLE_SCHEDULER=1 MOCK_AI=1 .venv/bin/python -m pytest -q
```

现在是 230 passed。**加 agent 之后只能变多,不能变少。**

---

## 十、做完更新这几处

- [`PRODUCT.md`](PRODUCT.md) 第七节 —— 每个 agent 的实现状态
- [`../trip/交接.md`](../trip/交接.md) 第五节 —— 进度表
- [`../trip/BACKEND.md`](../trip/BACKEND.md) 第四节 —— 新增的接口

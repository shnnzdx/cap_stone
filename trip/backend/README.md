# TripSync 后端

Python + FastAPI + PostgreSQL。三条路径的判定与执行、行程数据、决策流水账。

产品逻辑以 [`../README.md`](../README.md) 和 [`../BACKEND.md`](../BACKEND.md) 为准。
今天做了什么、接下来怎么接着做,见 [`../HANDOFF.md`](../HANDOFF.md)。

---

## 跑起来

需要 PostgreSQL(本机已装 `postgresql@15`)和 Python 3.13。

```bash
cd trip/backend
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
cp .env.example .env          # 填 DATABASE_URL 和 OPENAI_API_KEY
createdb tripsync && createdb tripsync_test
.venv/bin/python -m app.db.seed      # 建表 + 灌演示数据
.venv/bin/uvicorn app.api.main:app --port 8000 --reload
```

打开 http://localhost:8000/docs —— 所有接口都能直接点着试。

跑测试:

```bash
DISABLE_SCHEDULER=1 .venv/bin/python -m pytest -q
```

`.venv/bin/python -m app.db.seed` 会**先删表再建表**,里面的数据全没。只在开发时用。

## 环境变量

写在 `.env`(已进 `.gitignore`,不会提交)。

| 名字 | 干什么 | 默认 |
|---|---|---|
| `DATABASE_URL` | 数据库地址 | `postgresql+psycopg://localhost/tripsync` |
| `TEST_DATABASE_URL` | 测试库,和上面必须是两个库 | `…/tripsync_test` |
| `OPENAI_API_KEY` | AI 用 | 无 |
| `SETTLE_TICK_SECONDS` | 多久检查一次到期的投票 | `60` |
| `DISABLE_SCHEDULER` | 设成 `1` 关掉定时任务(测试时用) | 无 |

**任何真实的 key 都不能写进代码。** 代码里只出现变量名。

---

## 目录

```
app/
├── domain/                  ← 业务规则全在这里，不依赖 FastAPI、不依赖数据库
│   ├── constraints/
│   │   ├── types.py         数据形状 + 隐私边界
│   │   └── engine.py        classify()：判定一个改动走哪条路
│   └── decisions/
│       └── orchestrator.py  执行三条路径：写行程、开投票、建提案、结算
├── db/
│   ├── models.py            全部表 + 数据库层面的不变量
│   ├── session.py           连接
│   └── seed.py              演示数据（Mia's 30th in Chicago）
├── api/main.py              HTTP 接口。薄层，不写业务判断
└── jobs/scheduler.py        定时结算
tests/                       58 条
```

**依赖方向是单向的**:`api` → `domain` → `db`。`domain/constraints` 谁也不依赖。
反过来 import 会把规则漏进接口层,以后就拆不开了。

---

## 三个模块

### 判定引擎 `domain/constraints`

一个纯函数:

```python
classify(change, constraints) -> Classification   # notice | round | reopen_round | confirm
```

不碰数据库、不发网络请求、**不调 AI**。同样的输入永远同样的输出。

判定顺序(命中即停):

| 问 | 是 → |
|---|---|
| 已订 / 违反谁的 required / 超预算上限 / 超日期 | `confirm` |
| 这个时段已经"定过"了 | `reopen_round` |
| 这个时段被人碰过 | `round` |
| 都不是 | `notice` |

**为什么不用 AI 判定**:大模型同一个问题两次可能给不同答案。一个以"公平"为卖点的产品,规则本身不能是飘的。AI 只在用户**写下**约束的那一刻出场(把人话翻译成六种类型之一),翻译结果存下来,以后判定只看存下来的规则。

### 执行者 `domain/decisions`

判定完了真的去做:改行程、开投票、建提案、到点结算。守着几条不变量:

- 没投票的人记成"没表态",**永远不记成同意**
- 提案要所有受影响的人都点头才写进行程
- 重开轮里没表态的人算"维持原样"
- 三条路径最后都往流水账追加一行,没有例外

### 接口层 `api`

只做三件事:收参数、调 domain、转 JSON。**一条业务判断都不写。**

身份目前靠请求头 `X-Membership-Id` 假装。真做登录时**只需要改 `current_membership()` 一个函数**,其余不动。

---

## 隐私是怎么保证的

不是"记得过滤",是三层结构上就漏不出去:

1. **数据库**:用户写的原话在 `member_constraint_private`,和判定用的 `member_constraint` 是两张表。判定引擎不查前者。
2. **类型**:判定结果里只有 `AnonymizedFinding`,这个类型**没有** `membership_id` 字段、**没有**原文字段。想漏也没地方装。
3. **通知表**:`update_notice` 故意没有"是谁干的"这一栏。存了早晚会被某个接口带出去。

`tests/test_engine.py::test_findings_never_carry_identity_or_wording` 守着这条。

---

## 数据库自己守的规矩

这些不是靠代码记得检查,是数据库直接拦:

| 规矩 | 怎么实现 |
|---|---|
| 一个条目同时只能有一轮开着的投票 | 部分唯一索引 `one_open_round_per_item` |
| 一个条目同时只能有一个待确认提案 | 部分唯一索引 `one_pending_proposal_per_item` |
| 一人一轮一票 | `UNIQUE(round_id, trip_membership_id)` |
| 一人一提案一次表态 | `UNIQUE(proposal_id, trip_membership_id)` |

应用层在 `_guard_not_pending()` 里提前拦一道,给用户一句人话(409)而不是 500。
**两道都要**:应用层管体验,数据库管正确。

## 流水账

`plan_change` 只追加,不修改,不删除。一个条目"现在长什么样"= 原始状态叠加所有改动。

`origin` 记着每次改动怎么来的(`notice` / `round` / `reopen_round` / `confirm` / `ai_generate`)。
`GET /api/plans/{id}/changes` 把它摊开——**这是答辩时最有说服力的一屏**。

---

## 测试

58 条,`pytest -q` 半秒跑完。分四组:

| 文件 | 守什么 |
|---|---|
| `test_engine.py` | 判定规则 + 隐私红线 + 确定性 |
| `test_schema.py` | 数据库自己守的那几条 |
| `test_paths.py` | 三条路径从提出到落地的真实流程 |
| `test_jobs.py` | 定时结算 + 地图坐标 |

有几条测试守的是**产品承诺**,不是代码细节——改它们之前先确认产品真的改了主意:

- `test_findings_never_carry_identity_or_wording` —— 判定结果不带姓名和原文
- `test_silence_is_never_counted_as_agreement` —— 沉默不算同意
- `test_one_missing_confirmation_blocks_the_change` —— 少一个人点头就不落地
- `test_a_minority_cannot_overturn_a_settled_decision` —— 少数推翻不了已定的事
- `test_same_input_always_gives_same_answer` —— 判定不会今天说行明天说不行

# Cadensy / TripSync Handoff Prompt

Last updated: 2026-08-11

Use the following prompt when handing this repository to another engineer or AI agent.

```text
你现在接手的是 `C:\Users\zdxzh\Desktop\capstone\New` 这个仓库。请先把下面内容当作当前事实，再继续工作。除非你重新核对代码，否则不要假设这些状态已经改变。

一、先明确你要看的“真源文件”与“生成产物”

这个仓库里同时有源码、旧原型、构建产物和云部署文档。请优先把这些目录当成 source-of-truth：

- `frontend/`：当前主前端，品牌与文案已经切到 CADENSY
- `backend/`：当前主后端，FastAPI + PostgreSQL
- `shared/`：`frontend/` 和 `trip/` 共用的契约、文案、路径工具
- `AWS/`：当前 AWS 部署说明、runbook、资源链接
- `.github/workflows/`：实际部署/验证工作流
- `docs/`：产品、AI、实现说明
- `trip/`：独立 Trip workspace 源码，仍然是 `/trip` 嵌入内容的来源

不要把这些目录当成主要源码：

- `frontend/node_modules/`
- `frontend/dist/`
- `frontend/build/`
- `frontend/public/trip-app/assets/`：嵌入式 Trip workspace 的编译后静态资源
- `trip/dist/`

`/trip` 当前加载的是静态嵌入内容，不是直接运行 `trip/src`。

二、仓库当前总体状态

这是一个“主站前端 + 嵌入式 Trip workspace + FastAPI 后端 + AWS ECS/RDS 部署文档”混合仓库。

当前真实状态：

- 主站当前以 `frontend/` 为主
- `/login` 已接真实后端登录接口
- `/signup` 仍是前端表单跳转 mock，并没有真实注册后端
- `/trip` 页面当前通过 iframe 加载 `frontend/public/trip-app/index.html#/`
- `trip/` 仍然存在，是嵌入式 workspace 的源代码
- `backend/` 的核心决策逻辑、鉴权、行程、投票、proposal、comments、booking、planner pipeline 已基本完成
- AWS 云端已经有可访问的前端/后端演示环境
- 当前公开云端地址还是 ALB 的 HTTP 地址，不是正式 HTTPS 自定义域名

三、前端当前配置

1. 当前主前端

主前端在 `frontend/`，技术栈是：

- Next 16
- React 19
- Vinext
- Vite
- Cloudflare vite plugin（本地/hosting 兼容）

关键文件：

- `frontend/package.json`
- `frontend/app/page.tsx`
- `frontend/app/login/page.tsx`
- `frontend/app/signup/page.tsx`
- `frontend/app/trip/page.tsx`
- `frontend/app/globals.css`
- `frontend/.openai/hosting.json`
- `frontend/vite.config.ts`

当前主站路由大致是：

- `/`
- `/login`
- `/signup`
- `/how-it-works`
- `/faq`
- `/privacy`
- `/trip`

2. 当前品牌与文案状态

当前主品牌已经切到 `CADENSY`，不是 TripSync。

已经确认切过的页面和元素包括：

- 首页文案
- How It Works
- Privacy
- FAQ
- Footer
- 左上角 logo
- login 页面 logo 与文案
- signup 页面 logo 与文案
- `/trip` 页面 logo 资源

如果发现仓库里还有 `TripSync` 文案，先判断它属于哪一层：

- 主站真实源码
- `trip/` 旧 workspace 原型
- 编译产物
- 历史文档

不要直接在编译产物里改字。

3. 登录与后端连接

`frontend/app/login/page.tsx` 当前会直接请求：

- `process.env.NEXT_PUBLIC_API_BASE_URL`
- 如果没有，则 fallback 到 `http://127.0.0.1:8000`

登录成功后前端会写入 localStorage：

- `tripsync:authToken`
- `tripsync:membershipId`
- `tripsync:tripId`

然后跳转到 `/trip`。

注意：虽然品牌名已经改成 CADENSY，但 localStorage key 仍然是 `tripsync:*`，这是当前实现现状，不要未经确认就全局重命名。

4. `/trip` 的真实运行方式

`frontend/app/trip/page.tsx` 只是一个 iframe shell。

它通过这些共享契约去读嵌入内容：

- `shared/tripsync-preview-contract.js`
- `frontend/app/trip/preview-config.ts`

当前约定：

- base path：`/trip-app`
- 默认 hash route：`#/`
- frame src：`/trip-app/index.html#/`

也就是说：

- 用户看到的 `/trip`
- 实际嵌入的是 `frontend/public/trip-app/` 里的静态 workspace build

5. `trip/` 的角色

`trip/` 仍然是独立的 Vite + React 18 + React Router 6 workspace 工程。

它不是废弃目录，目前仍然是 `/trip` 嵌入内容的源码来源。

如果你改了 `trip/`，要同步到主站嵌入目录，使用：

- `cd frontend && npm run build:trip-preview`

这会：

- build `trip/`
- 把 `trip/dist` 同步到 `frontend/public/trip-app/`
- 写 `embed-manifest.json`

不要手工拷贝单个 hash 产物。

6. `shared/` 当前作用

`shared/` 放的是两套前端共享的真契约，尤其是：

- `shared/tripsync-preview-contract.js`
- `shared/tripsync-domain.js`
- `shared/tripsync-product-content.js`
- `shared/tripsync-demo-data.js`
- `shared/tripsync-preview-theme.css`

涉及共享路径、共享产品文案、嵌入路径、共享演示数据时，优先改 `shared/`，不要两边各改一份。

四、后端当前配置

1. 技术栈与职责

后端在 `backend/`，技术栈：

- FastAPI
- SQLAlchemy
- PostgreSQL
- Uvicorn

主入口：

- `backend/app/api/main.py`

后端不是普通 CRUD API，而是“群体决策引擎”。

核心分层：

- `api/`：HTTP 接口层，尽量薄
- `domain/constraints/`：纯规则判断
- `domain/decisions/`：三条路径执行器
- `domain/preferences/`：偏好与六种约束
- `domain/chat/`：聊天理解与只读判定
- `domain/planning/`：初始行程生成与校验
- `agents/`：AI 理解/解释/规划壳层
- `db/`：模型与 session
- `jobs/`：定时结算

2. 当前后端核心事实

当前已经实现并应当被视为现状的包括：

- Bearer token 登录
- TripMembership 级别权限
- 行程读取与更新
- classify 与 submit change 分离
- notice / round / reopen_round / confirm 四条判定路径
- round 投票与 settle
- proposal 决策
- preferences / constraints CRUD
- members 列表
- comments
- booked / unbooked
- organizer actions：remind / extend / escalate / deadlock
- 初始 draft/generate plan pipeline

3. 当前环境变量模型

参考：

- `backend/.env.example`
- `backend/LOCAL_DEV.md`

关键变量：

- `DATABASE_URL`
- `TEST_DATABASE_URL`
- `OPENAI_API_KEY`
- `OPENAI_BASE_URL`
- `OPENAI_MODEL`
- `MOCK_AI`
- `SETTLE_TICK_SECONDS`
- `DISABLE_SCHEDULER`
- `DEV_ALLOW_MEMBERSHIP_HEADER`
- `FRONTEND_BASE_URL`
- `CORS_ORIGINS`

默认本地示例：

- `DATABASE_URL=postgresql+psycopg://localhost/tripsync`
- `TEST_DATABASE_URL=postgresql+psycopg://localhost/tripsync_test`
- `OPENAI_MODEL=gpt-4o-mini`
- `MOCK_AI=1`
- `DISABLE_SCHEDULER=0`

4. 当前 AI 配置方式

AI 统一走：

- `backend/app/agents/base.py`

它负责：

- MOCK 开关
- OpenAI-compatible base URL
- DeepSeek JSON object fallback
- schema 验证
- safe context

当前设计原则：

- AI 负责理解、解释、建议
- 规则引擎负责最终判定
- orchestrator 负责真正落库

不要把 AI 直接接到数据库写入上。

5. 本地 FastAPI 打开方式

本地默认：

- API：`http://127.0.0.1:8000`
- Docs：`http://127.0.0.1:8000/docs`
- OpenAPI：`http://127.0.0.1:8000/openapi.json`
- Health：`http://127.0.0.1:8000/api/health`

推荐启动方式：

- `cd backend`
- `.\.venv\Scripts\uvicorn.exe app.api.main:app --host 127.0.0.1 --port 8000 --reload`

如果不带 `--reload`，很容易因为旧进程导致“明明改了代码但接口还是旧的”。

6. 本地数据库现实情况

当前本地开发文档明确区分：

- 运行时数据库用 `DATABASE_URL`
- pytest 用 `TEST_DATABASE_URL`

测试数据库必须和运行数据库分离。

本地后端是否连本地库还是云端 RDS，取决于你本机 `backend/.env`。

五、AWS 当前配置

1. AWS 总体结构

当前云端结构是：

- 一个 ALB 作为公网入口
- ECS Fargate backend service
- ECS Fargate frontend service
- private RDS PostgreSQL
- SSM Parameter Store 注入 runtime secrets
- GitHub Actions 负责部署和运维动作

2. 当前已知 AWS 资源名

以 `AWS/TRIPSYNC_AWS_URLS.md` 为准，当前关键资源包括：

- VPC：`tripsync-vpc`
- ALB：`tripsync-backend-alb`
- ECS cluster：`tripsync-cluster`
- backend service：`tripsync-backend-service`
- frontend service：`tripsync-frontend-service`
- backend ECR：`tripsync-backend`
- frontend ECR：`tripsync-frontend`
- backend log group：`/ecs/tripsync-backend`
- frontend log group：`/ecs/tripsync-frontend`
- RDS endpoint：`tripsync-postgres.cqv0oqgogc0p.us-east-1.rds.amazonaws.com`

3. 当前公网演示地址

当前公开 URL 仍然是 ALB 的 HTTP 地址：

- Frontend：`http://tripsync-backend-alb-2124233156.us-east-1.elb.amazonaws.com`
- Login：`http://tripsync-backend-alb-2124233156.us-east-1.elb.amazonaws.com/login`
- Backend health：`http://tripsync-backend-alb-2124233156.us-east-1.elb.amazonaws.com/api/health`

截至 2026-08-11：

- 自定义域名/HTTPS Phase 10 已准备但未正式执行

4. 当前云端 AI runtime 现状

根据 `AWS/BACKEND_AI_RUNTIME_RUNBOOK.md` 与 `AWS/TRIPSYNC_AWS_URLS.md`，云端 backend 当前是：

- `MOCK_AI=0`
- `OPENAI_BASE_URL=https://api.deepseek.com`
- `OPENAI_MODEL=deepseek-v4-flash`
- `OPENAI_API_KEY` 通过 SSM Parameter Store 注入

相关成功 run：

- `https://github.com/shnnzdx/cap_stone/actions/runs/31406205586`

5. 当前云数据库现实

云端数据库是 private RDS。

不要默认尝试：

- 从本机直连 cloud RDS
- 为了图省事把 RDS 开到公网

如果云端需要补 demo login 或 demo seed，走 GitHub Actions：

- `cloud-demo-login-upsert.yml`
- `cloud-demo-seed-upsert.yml`

六、GitHub Actions 当前重点工作流

当前需要优先认识这些 workflow：

- `main.yml`：AWS 身份检查
- `backend-ai-secret-provision.yml`
- `backend-ai-runtime-config.yml`
- `cloud-demo-login-upsert.yml`
- `cloud-demo-seed-upsert.yml`
- `phase5-backend-provision.yml`
- `phase8-frontend-provision.yml`
- `phase9-public-e2e.yml`

如果要理解“现在云上怎么来的”，先读：

- `AWS/README.md`
- `AWS/TRIPSYNC_AWS_MASTER_CONTEXT_FINAL.md`
- `AWS/TRIPSYNC_AWS_URLS.md`
- `AWS/BACKEND_AI_RUNTIME_RUNBOOK.md`
- `AWS/CLOUD_DEMO_LOGIN_RUNBOOK.md`
- `AWS/CLOUD_DEMO_SEED_RUNBOOK.md`

七、当前最容易混淆的点

1. `frontend/` 不等于 `trip/`

当前主站在 `frontend/`。
`trip/` 是独立 workspace 源码。
`/trip` 只是 iframe shell。

2. 改了 `trip/` 不会自动影响 `/trip`

必须重新执行：

- `cd frontend && npm run build:trip-preview`

3. signup 仍未接后端

`/signup` 当前主要是前端 UI + 跳转到 `/login?created=1`，不是完整注册链路。

4. 登录页已是真实 API

`/login` 会打 `POST /api/auth/login`，不是纯 mock。

5. 云端后端和本地后端不是一个环境

本地改代码不会自动改 AWS。
AWS 改 runtime 也不会自动同步你本地 `.env`。

6. localStorage key 还是 `tripsync:*`

品牌已切到 CADENSY，但很多技术 key 还没重命名。
不要直接大范围替换，除非明确决定做一次技术债清理。

7. 文档中仍有旧品牌和旧结构描述

尤其是：

- `trip/README.md`
- `trip/BACKEND.md`
- 根目录 `交接.md`

这些文件里有些内容是有价值的技术合同，有些则反映旧阶段状态。引用前先和当前源码对照。

八、接手时建议的核对顺序

1. 先读：

- `README.md`
- `backend/README.md`
- `AWS/README.md`
- `AWS/TRIPSYNC_AWS_URLS.md`
- `docs/AGENTS.md`

2. 再看主前端：

- `frontend/package.json`
- `frontend/app/`
- `frontend/app/login/page.tsx`
- `frontend/app/trip/page.tsx`
- `frontend/app/trip/preview-config.ts`

3. 再看嵌入式 workspace 与共享契约：

- `trip/package.json`
- `shared/tripsync-preview-contract.js`
- `shared/tripsync-product-content.js`

4. 再看后端核心：

- `backend/app/api/main.py`
- `backend/app/db/models.py`
- `backend/app/db/session.py`
- `backend/app/domain/constraints/engine.py`
- `backend/app/domain/decisions/orchestrator.py`
- `backend/app/domain/preferences/service.py`
- `backend/app/domain/chat/service.py`
- `backend/app/domain/planning/service.py`
- `backend/app/agents/base.py`
- `backend/app/agents/chat.py`
- `backend/app/agents/planner.py`
- `backend/app/jobs/scheduler.py`

5. 最后看云端工作流和 runbook：

- `.github/workflows/`
- `AWS/*.md`

九、不要做的事

- 不要直接改 `frontend/public/trip-app/assets/` 里的编译产物
- 不要把 cloud RDS 随便开公网
- 不要把 secret 明文写进仓库
- 不要默认 signup 已经接上真实注册
- 不要假设 `/trip` 直接运行的是 `trip/src`
- 不要只看历史文档就下结论，要以当前源码和 workflow 为准

十、如果你要继续开发，先回答这三个问题

1. 这次改动属于 `frontend/`、`trip/`、`shared/`、`backend/`、还是 `AWS/`？
2. 这次改动会影响主站页面、嵌入式 workspace、还是后端规则？
3. 如果改了 `trip/`，你是否已经重新 build 并同步到 `frontend/public/trip-app/`？

如果你发现代码和这份交接不一致，请以当前源码为准，并优先更新：

- `README.md`
- `backend/README.md`
- `AWS/TRIPSYNC_AWS_URLS.md`
- 这份 handoff prompt
```

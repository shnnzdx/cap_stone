# TripSync AWS Phase 7 Frontend/Backend Integration

Status: partial completion.

Date: 2026-08-10

Backend ALB:

```text
http://tripsync-backend-alb-2124233156.us-east-1.elb.amazonaws.com
```

Result:

```text
AWS/PHASE7_FRONTEND_BACKEND_INTEGRATION_RESULT.md
GitHub Actions run: https://github.com/shnnzdx/cap_stone/actions/runs/31352265951
result: success
```

---

## 1. Current Constraint

The backend is deployed on AWS and has RDS `DATABASE_URL` injected.

The frontend does not yet have a final AWS public hosting URL. Phase 3 proved the current frontend output is SSR-shaped, not pure static hosting.

Therefore Phase 7 starts with:

```text
local frontend -> AWS backend ALB
backend runtime config workflow ready for future frontend URL
```

Final production CORS and invite URL cannot be locked until the frontend hosting URL exists.

---

## 2. Local Frontend Integration

Ignored local env files were synced:

```text
frontend/.env.local
trip/.env.local
backend/.env
.env
```

Frontend shell:

```text
NEXT_PUBLIC_API_BASE_URL=http://tripsync-backend-alb-2124233156.us-east-1.elb.amazonaws.com
```

Embedded Trip app:

```text
VITE_API_BASE_URL=http://tripsync-backend-alb-2124233156.us-east-1.elb.amazonaws.com
VITE_DEV_ALLOW_MEMBERSHIP_HEADER=0
```

Local backend/frontend values:

```text
FRONTEND_BASE_URL=http://localhost:3000
CORS_ORIGINS=http://localhost:3000,http://localhost:5173,http://127.0.0.1:5173
```

These local env files are ignored and must not be committed.

---

## 3. Backend Runtime Config Workflow

Workflow:

```text
.github/workflows/phase7-backend-runtime-config.yml
```

Manual inputs:

```text
frontend_base_url
cors_origins
```

Default first integration values:

```text
frontend_base_url=http://localhost:3000
cors_origins=http://localhost:3000,http://localhost:5173,http://127.0.0.1:5173
```

The workflow preserves:

```text
current backend image
DATABASE_URL secret injection
cpu=256
memory=512
DISABLE_SCHEDULER=1
MOCK_AI=1
desiredCount=1
```

The workflow updates:

```text
FRONTEND_BASE_URL
CORS_ORIGINS
DEV_ALLOW_MEMBERSHIP_HEADER=0
```

---

## 4. Remaining Work

```text
Choose final frontend AWS hosting path.
Deploy frontend.
Re-run Phase 7 backend runtime config with the real frontend origin.
Set frontend production env to the backend ALB or future backend domain.
Verify login and trip app browser flows end to end.
```

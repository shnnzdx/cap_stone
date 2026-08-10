# TripSync AWS Phase 9 Public E2E Runbook

Status: validated successfully.

Date: 2026-08-10

Public URL:

```text
http://tripsync-backend-alb-2124233156.us-east-1.elb.amazonaws.com
```

---

## Purpose

Phase 9 validates the deployed public application in a real Chromium browser from GitHub Actions.

This workflow does not create, modify, or delete AWS resources.

---

## Workflow

```text
.github/workflows/phase9-public-e2e.yml
```

Trigger:

```text
workflow_dispatch only
```

Expected input:

```text
public_url=http://tripsync-backend-alb-2124233156.us-east-1.elb.amazonaws.com
```

---

## What It Checks

```text
GET /
browser renders the home page
GET /login
browser renders the login form
GET /trip
browser renders the Trip iframe shell
GET /trip-app/index.html
embedded Trip static entry is reachable
GET /api/health
backend returns {"ok":true}
same-origin browser requests do not fail
blocking browser console errors are absent
```

Known non-blocking console noise:

```text
[vinext] RSC prefetch setup error
```

This is currently ignored by the E2E script because the tested pages, iframe shell, embedded Trip entry, and backend health endpoint still load correctly. Revisit it before a production release or if navigation starts failing.

Screenshots are uploaded as a GitHub Actions artifact:

```text
aws-public-e2e-screenshots
```

---

## Local Command

From `frontend/`:

```bash
TRIPSYNC_PUBLIC_URL=http://tripsync-backend-alb-2124233156.us-east-1.elb.amazonaws.com npm run e2e:aws
```

Local Playwright browsers must be installed first:

```bash
npx playwright install chromium
```

---

## Result Handling

If it passes, record the GitHub Actions run in:

```text
AWS/archive/completed-phases/PHASE9_PUBLIC_E2E_RESULT.md
AWS/TRIPSYNC_AWS_URLS.md
AWS/TRIPSYNC_AWS_MASTER_CONTEXT_FINAL.md
```

Current successful run:

```text
https://github.com/shnnzdx/cap_stone/actions/runs/31355307955
```

If it fails, inspect:

```text
frontend/test-results/aws-public-e2e
GitHub Actions logs
browser console errors
failed same-origin requests
CloudWatch logs for /ecs/tripsync-frontend and /ecs/tripsync-backend
```

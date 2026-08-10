# TripSync AWS Phase 9 Public E2E Result

Status: success.

Date: 2026-08-10

GitHub Actions run:

```text
https://github.com/shnnzdx/cap_stone/actions/runs/31355307955
```

Validated public URL:

```text
http://tripsync-backend-alb-2124233156.us-east-1.elb.amazonaws.com
```

Screenshot artifact:

```text
https://github.com/shnnzdx/cap_stone/actions/runs/31355307955/artifacts/9050425261
```

---

## What Was Validated

```text
GET /
home page renders in Chromium
GET /login
login form renders in Chromium
GET /trip
Trip iframe shell renders in Chromium
iframe src = /trip-app/index.html#/
GET /trip-app/index.html
embedded Trip static entry is reachable
GET /trip-app/index.html#/
embedded Trip app renders its unauthenticated state
GET /api/health
backend returns {"ok":true}
same-origin browser requests do not fail
```

---

## Bug Found And Fixed During Phase 9

Before this E2E check, `/trip` embedded:

```text
/trip-app/#/
```

On the deployed Vinext SSR frontend, that path resolved to the frontend 404 route instead of the static Trip app.

The shared preview contract was fixed to embed:

```text
/trip-app/index.html#/
```

Frontend was redeployed successfully after the fix:

```text
https://github.com/shnnzdx/cap_stone/actions/runs/31354836829
```

---

## Known Non-Blocking Note

The browser emits Vinext RSC prefetch console noise:

```text
[vinext] RSC prefetch setup error
```

The E2E script ignores this known non-blocking message because the public pages, Trip iframe/static entry, and backend health endpoint all pass. Revisit before production release or if client-side navigation starts failing.

---

## Remaining Work

```text
Add HTTPS/custom domain with ACM.
Run login/auth functional checks once real demo users are confirmed.
Decide whether localhost should remain in CORS for demo support.
Triage npm audit warnings before production release.
Prepare cost scale-down or cleanup workflow if the stack should not run continuously.
```

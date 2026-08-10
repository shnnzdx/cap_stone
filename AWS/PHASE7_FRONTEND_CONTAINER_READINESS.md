# TripSync AWS Phase 7 Frontend Container Readiness

Status: validated successfully.

Date: 2026-08-10

This is a frontend hosting readiness step only. It does not create ECR, ECS, ALB, DNS, CloudFront, Amplify, S3, IAM, or any other AWS resource.

---

## Purpose

Phase 3 proved that the current `frontend/` output is SSR-shaped rather than pure static hosting output.

This readiness step proves that the merged `frontend/` + `trip/` application can run as a containerized Vinext SSR service:

```text
GitHub Actions runner
-> docker build
-> frontend/Dockerfile
-> build trip preview
-> build Vinext frontend
-> docker run
-> GET /login
-> GET /trip-app/index.html
```

If this passes, the next architecture approval can decide whether to create a frontend ECR repository and frontend ECS Fargate service behind the existing ALB.

---

## Files

```text
frontend/Dockerfile
.dockerignore
.github/workflows/frontend-container-readiness.yml
```

---

## Runtime Shape

The frontend container uses:

```text
node:22-bookworm-slim
npm ci for trip
npm ci for frontend
npm run build:trip-preview
npm run build
npm run start -- --hostname 0.0.0.0 --port 3000
```

The image expects API base URL values at build time:

```text
NEXT_PUBLIC_API_BASE_URL
VITE_API_BASE_URL
```

The readiness workflow passes both values from the manual `api_base_url` workflow input.

Current default:

```text
http://tripsync-backend-alb-2124233156.us-east-1.elb.amazonaws.com
```

---

## Manual Run

GitHub Actions:

```text
Actions
-> Frontend Container Readiness
-> Run workflow
-> api_base_url = http://tripsync-backend-alb-2124233156.us-east-1.elb.amazonaws.com
-> Run workflow
```

Expected successful signs:

```text
Build frontend SSR image: success
Start frontend container: success
Wait for login route: Frontend login route responded
Validate embedded Trip static asset route: Embedded Trip static entry responded
```

Successful validation:

```text
GitHub Actions run: https://github.com/shnnzdx/cap_stone/actions/runs/31353334323
commit: f4dc8772ae9b373a21cc2cbd1551c1c9ca85488e
result: success
/login: responded on attempt 2
/trip-app/index.html: responded
```

---

## What This Does Not Prove

This step does not prove:

```text
public frontend AWS URL
frontend ECR push
frontend ECS service creation
ALB path/host routing
production CORS origin
HTTPS or custom domain
end-to-end browser login flow
```

Those require a separately approved frontend AWS provisioning step.

---

## Residual Notes

The GitHub run showed npm audit warnings during dependency installation. They did not block this readiness proof, but dependency audit triage should be handled separately before a production release.

---

## Next Approval Gate

Do not create frontend AWS resources until the user explicitly approves frontend resource creation.

Candidate next approval phrase:

```text
Approve frontend ECS service creation
```

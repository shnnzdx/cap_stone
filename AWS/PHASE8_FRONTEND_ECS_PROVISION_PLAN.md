# TripSync AWS Phase 8 Frontend ECS Provision Plan

Status: provisioned and verified.

Date: 2026-08-10

Approval phrase received:

```text
Approve frontend ECS service creation
```

Provision result:

```text
AWS/PHASE8_FRONTEND_ECS_PROVISION_RESULT.md
```

---

## Purpose

Deploy the validated Vinext SSR frontend container to ECS Fargate and expose it through the existing TripSync ALB.

This phase reuses the existing backend ALB to avoid creating a second internet-facing load balancer.

---

## First Frontend Architecture

```text
Internet
-> tripsync-backend-alb HTTP :80
   -> path /api/* forwards to tripsync-backend-tg
   -> default action forwards to tripsync-frontend-tg
-> tripsync-frontend-service
-> tripsync-frontend container port 3000
```

The backend public health URL remains:

```text
http://tripsync-backend-alb-2124233156.us-east-1.elb.amazonaws.com/api/health
```

The frontend public URL becomes:

```text
http://tripsync-backend-alb-2124233156.us-east-1.elb.amazonaws.com
```

---

## Resources Created Or Modified

Create or reuse:

```text
Security group: tripsync-frontend-sg
CloudWatch log group: /ecs/tripsync-frontend
ECR repository: tripsync-frontend
ECS task definition family: tripsync-frontend
ECS service: tripsync-frontend-service
ALB target group: tripsync-frontend-tg
```

Modify existing:

```text
ALB listener on tripsync-backend-alb port 80
  -> /api/* rule forwards to tripsync-backend-tg
  -> default action forwards to tripsync-frontend-tg
```

No new VPC, subnet, Internet Gateway, NAT Gateway, RDS, or ALB is created.

---

## Runtime Mode

```text
cpu=256
memory=512 MiB
desiredCount=1
Assign Public IP=ENABLED
health check path=/login
CloudWatch retention=7 days
deployment circuit breaker rollback=enabled
```

Image:

```text
ECR repository: tripsync-frontend
tag: commit SHA
optional convenience tag: latest
```

Frontend build-time API base URL:

```text
http://tripsync-backend-alb-2124233156.us-east-1.elb.amazonaws.com
```

Because the frontend and backend are on the same ALB origin, browser API calls can use `/api/*` on the same public origin.

---

## Validation

The workflow verifies:

```text
GET /
GET /login
GET /trip-app/index.html
GET /api/health
```

Through the same ALB DNS name.

---

## Cost Impact

This phase avoids a second ALB.

New likely ongoing costs:

```text
one additional 256/512 Fargate task
one additional frontend task public IPv4 address
small ECR storage
small CloudWatch Logs storage/ingestion
```

Existing ongoing costs remain:

```text
ALB
backend Fargate task
backend public IPv4
RDS PostgreSQL
CloudWatch Logs
ECR backend storage
```

---

## Rollback

Fast rollback options:

```text
Set tripsync-frontend-service desiredCount=0.
Modify ALB listener default action back to tripsync-backend-tg.
Keep /api/* backend rule in place.
Rollback tripsync-frontend-service to the previous task definition revision.
Rollback image tag to a previous commit SHA.
```

---

## Cleanup Order

```text
1. Modify ALB listener default action back to tripsync-backend-tg if needed.
2. Delete /api/* listener rule only if reverting to backend-only routing.
3. Set tripsync-frontend-service desiredCount=0.
4. Delete tripsync-frontend-service.
5. Delete tripsync-frontend-tg.
6. Delete /ecs/tripsync-frontend log group.
7. Delete tripsync-frontend ECR images and repository.
8. Delete tripsync-frontend-sg after ECS ENIs are gone.
9. Confirm Public IPv4 Insights and Billing no longer show frontend proof resources.
```

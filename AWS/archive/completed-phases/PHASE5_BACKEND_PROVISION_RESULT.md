# TripSync AWS Phase 5 Backend Provision Result

Status: completed.

Date: 2026-08-10

GitHub Actions run:

```text
https://github.com/shnnzdx/cap_stone/actions/runs/31349402435
```

Central URL index:

```text
AWS/TRIPSYNC_AWS_URLS.md
```

Deployed commit:

```text
9ff14d1fa7f5a4babf4b5a50107287c69fde1d21
```

Backend ALB URL:

```text
http://tripsync-backend-alb-2124233156.us-east-1.elb.amazonaws.com
```

Health endpoint:

```text
http://tripsync-backend-alb-2124233156.us-east-1.elb.amazonaws.com/api/health
```

Verified result:

```json
{"ok":true}
```

---

## Created/Used Resource Names

```text
VPC: tripsync-vpc
Public Subnet A: tripsync-public-subnet-a
Public Subnet B: tripsync-public-subnet-b
Private DB Subnet A: tripsync-private-db-subnet-a
Private DB Subnet B: tripsync-private-db-subnet-b
Public route table: tripsync-public-rt
Private DB route table: tripsync-private-db-rt
Internet Gateway: tripsync-igw
ALB security group: tripsync-alb-sg
Backend security group: tripsync-backend-sg
Future RDS security group: tripsync-rds-sg
CloudWatch log group: /ecs/tripsync-backend
ECR repository: tripsync-backend
ECS cluster: tripsync-cluster
ECS task definition family: tripsync-backend
ECS service: tripsync-backend-service
ALB: tripsync-backend-alb
Target group: tripsync-backend-tg
ECS task execution role: tripsync-ecs-execution-role
ECS task role: tripsync-backend-task-role
```

---

## Runtime Mode

The first backend proof is infrastructure-only:

```text
DISABLE_SCHEDULER=1
MOCK_AI=1
desiredCount=1
cpu=256
memory=512 MiB
```

This deployment proves ECR, ECS Fargate, ALB, CloudWatch Logs, and `/api/health`.

It does not prove full TripSync production functionality yet because RDS, runtime secrets, frontend API URL, and production CORS are not connected.

---

## Cost Reminder

These resources may now incur AWS charges while running.

Main cost drivers:

```text
ALB hourly charge
Fargate task runtime
public IPv4 addresses
CloudWatch Logs usage
ECR image storage
```

If the proof is not needed continuously, reduce or remove resources using the cleanup order in:

```text
AWS/archive/completed-phases/PHASE5_BACKEND_DEPLOYMENT_PLAN.md
```

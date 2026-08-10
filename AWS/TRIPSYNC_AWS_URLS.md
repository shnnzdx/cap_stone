# TripSync AWS URL Index

Date: 2026-08-10

Region: us-east-1

This is the compact entry point for TripSync AWS URLs, console links, workflow links, resource names, and current AWS documentation.

## Live Application

```text
Frontend public URL:
http://tripsync-backend-alb-2124233156.us-east-1.elb.amazonaws.com

Frontend login route:
http://tripsync-backend-alb-2124233156.us-east-1.elb.amazonaws.com/login

Embedded Trip static entry:
http://tripsync-backend-alb-2124233156.us-east-1.elb.amazonaws.com/trip-app/index.html

Backend health endpoint:
http://tripsync-backend-alb-2124233156.us-east-1.elb.amazonaws.com/api/health

Expected health response:
{"ok":true}
```

## GitHub

```text
Repository:
https://github.com/shnnzdx/cap_stone

GitHub Actions:
https://github.com/shnnzdx/cap_stone/actions

Phase 9 successful public E2E:
https://github.com/shnnzdx/cap_stone/actions/runs/31355307955

Phase 9 screenshot artifact:
https://github.com/shnnzdx/cap_stone/actions/runs/31355307955/artifacts/9050425261

Cloud Demo Login Upsert workflow:
https://github.com/shnnzdx/cap_stone/actions/workflows/cloud-demo-login-upsert.yml

Cloud Demo Login Upsert successful run:
https://github.com/shnnzdx/cap_stone/actions/runs/31398395569

Cloud Demo Seed Upsert workflow:
https://github.com/shnnzdx/cap_stone/actions/workflows/cloud-demo-seed-upsert.yml

Backend AI Runtime Config workflow:
https://github.com/shnnzdx/cap_stone/actions/workflows/backend-ai-runtime-config.yml

Backend AI Runtime Config successful run:
https://github.com/shnnzdx/cap_stone/actions/runs/31406205586
```

## Current AWS Console Links

```text
AWS Console home:
https://us-east-1.console.aws.amazon.com/console/home?region=us-east-1

ECS cluster:
https://us-east-1.console.aws.amazon.com/ecs/v2/clusters/tripsync-cluster/services?region=us-east-1

Backend service:
https://us-east-1.console.aws.amazon.com/ecs/v2/clusters/tripsync-cluster/services/tripsync-backend-service/health?region=us-east-1

Frontend service:
https://us-east-1.console.aws.amazon.com/ecs/v2/clusters/tripsync-cluster/services/tripsync-frontend-service/health?region=us-east-1

Backend ECR:
https://us-east-1.console.aws.amazon.com/ecr/repositories/private/tripsync-backend?region=us-east-1

Frontend ECR:
https://us-east-1.console.aws.amazon.com/ecr/repositories/private/tripsync-frontend?region=us-east-1

Backend CloudWatch Logs:
https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#logsV2:log-groups/log-group/$252Fecs$252Ftripsync-backend

Frontend CloudWatch Logs:
https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#logsV2:log-groups/log-group/$252Fecs$252Ftripsync-frontend

Application Load Balancers:
https://us-east-1.console.aws.amazon.com/ec2/home?region=us-east-1#LoadBalancers:

Target Groups:
https://us-east-1.console.aws.amazon.com/ec2/home?region=us-east-1#TargetGroups:

Route 53 hosted zones:
https://us-east-1.console.aws.amazon.com/route53/v2/hostedzones

ACM certificates:
https://us-east-1.console.aws.amazon.com/acm/home?region=us-east-1#/certificates/list

Billing and Cost Management:
https://us-east-1.console.aws.amazon.com/billing/home

Public IPv4 Insights:
https://us-east-1.console.aws.amazon.com/vpcconsole/home?region=us-east-1#PublicIpInsights:
```

## Current AWS Resource Names

```text
VPC: tripsync-vpc
ALB: tripsync-backend-alb
ALB security group: tripsync-alb-sg

ECS cluster: tripsync-cluster
Backend ECS service: tripsync-backend-service
Frontend ECS service: tripsync-frontend-service

Backend target group: tripsync-backend-tg
Frontend target group: tripsync-frontend-tg

Backend ECR repository: tripsync-backend
Frontend ECR repository: tripsync-frontend

Backend CloudWatch log group: /ecs/tripsync-backend
Frontend CloudWatch log group: /ecs/tripsync-frontend

Execution role: tripsync-ecs-execution-role
Backend task role: tripsync-backend-task-role

RDS endpoint:
tripsync-postgres.cqv0oqgogc0p.us-east-1.rds.amazonaws.com
```

## Current Documentation

```text
AWS/README.md
AWS/TRIPSYNC_AWS_MASTER_CONTEXT_FINAL.md
AWS/TRIPSYNC_AWS_URLS.md
AWS/PHASE10_HTTPS_CUSTOM_DOMAIN_PLAN.md
AWS/CLOUD_DEMO_LOGIN_RUNBOOK.md
AWS/CLOUD_DEMO_SEED_RUNBOOK.md
AWS/BACKEND_AI_RUNTIME_RUNBOOK.md
AWS/PHASE6_RUNTIME_SECRETS_PLAN.md
```

Completed Phase 3-9 documents:

```text
AWS/archive/completed-phases/
```

## Current Pause Point

Phase 10 HTTPS/custom domain automation is ready but has not been run.

Required before running Phase 10:

```text
domain_name=<owned custom domain, for example app.example.com>
hosted_zone_id=<existing Route 53 public hosted zone ID>
```

No HTTPS/custom domain resources have been created yet.

Cloud RDS remains private. Use `AWS/CLOUD_DEMO_LOGIN_RUNBOOK.md` and the manual `Cloud Demo Login Upsert` workflow if the cloud database needs the demo organizer login:

```text
organizer@cadensy.local
```

Use `AWS/CLOUD_DEMO_SEED_RUNBOOK.md` and the manual `Cloud Demo Seed Upsert`
workflow if the cloud database needs the full demo trip dataset without
destructive reseeding.

Use `AWS/BACKEND_AI_RUNTIME_RUNBOOK.md` and the manual `Backend AI Runtime
Config` workflow if the deployed backend should stop using `MOCK_AI=1` and start
using a real OpenAI-compatible provider.

Current backend AI runtime:

```text
MOCK_AI=0
OPENAI_BASE_URL=https://api.deepseek.com
OPENAI_MODEL=deepseek-v4-flash
```

## Cost Reminder

The live proof can incur charges while running.

Main cost drivers:

```text
ALB hourly charge
Fargate task runtime
public IPv4 addresses
CloudWatch Logs usage
ECR image storage
RDS runtime/storage if left active
Route 53 hosted zone if created later
```

Use the cleanup order in `AWS/archive/completed-phases/PHASE5_BACKEND_DEPLOYMENT_PLAN.md` when the proof is no longer needed.

# TripSync AWS Phase 5 Backend Deployment Plan

Status: plan-only, no AWS resources created.

Date: 2026-08-10

Region: us-east-1

This document defines the proposed backend deployment architecture for TripSync after the completed validation gates:

```text
Phase 1: backend local/cloud readiness prepared
Phase 2: build validation completed
Phase 3: frontend hosting proof completed
Phase 4: database readiness completed
```

Phase 5 does not create infrastructure by itself. It is the approval plan for a later resource-creation phase.

---

## 1. Hard Scope Boundary

Do not perform any of these actions during Phase 5 plan-only work:

```text
aws ecr create-repository
aws ecs create-cluster
aws ecs register-task-definition
aws ecs create-service
aws elbv2 create-load-balancer
aws rds create-db-instance
aws cloudformation deploy
terraform apply
docker push
IAM user/role/policy changes
```

No AWS billable resources should be created until the user explicitly approves the resource creation step.

---

## 2. Recommended Backend Architecture

```text
GitHub Actions
  -> manual future deploy workflow
  -> configure AWS credentials from GitHub Environment: Main
  -> build backend Docker image
  -> push image to ECR
  -> update ECS task definition
  -> update ECS service

AWS us-east-1
  -> ECR repository: tripsync-backend
  -> ECS cluster: tripsync-cluster
  -> ECS Fargate service: tripsync-backend-service
  -> Application Load Balancer
  -> Target group on container port 8000
  -> CloudWatch Logs log group
  -> Future RDS PostgreSQL private database
  -> Future SSM Parameter Store SecureString runtime secrets
```

Backend container:

```text
Image base: python:3.13-slim
Runtime user: non-root appuser
Listen address: 0.0.0.0
Container port: 8000
Health endpoint: GET /api/health
Scheduler policy: runtime-injected, not baked into the Docker image
```

---

## 3. Network Decision

### Option A - Cost-minimal Capstone start

Use public subnets for Fargate tasks with `assignPublicIp: ENABLED`.

Security boundary:

```text
Internet
  -> ALB security group, inbound 80 initially or 443 after ACM
  -> Backend task security group, inbound 8000 only from ALB security group
```

Why this is the recommended first Capstone option:

```text
avoids NAT Gateway cost
avoids needing multiple VPC interface endpoints on day one
keeps the backend protected from direct public inbound traffic by security group rules
is simpler to validate manually
```

Tradeoff:

```text
tasks have public IPs for outbound internet access
production-hardening later should move tasks to private subnets
```

### Option B - More production-style private tasks

Use private subnets for Fargate tasks.

This requires either:

```text
NAT Gateway
```

or all required VPC endpoints for image pull/logging:

```text
ecr.dkr interface endpoint
ecr.api interface endpoint
s3 gateway endpoint
logs interface endpoint
```

For ECS Exec, also add:

```text
ssmmessages interface endpoint
```

This is operationally better, but it adds more AWS resources and likely more cost.

---

## 4. ECS/Fargate Service Shape

Initial service configuration:

```text
launch type: Fargate
networkMode: awsvpc
platformVersion: LATEST
desiredCount: 1
minimumHealthyPercent: 100
maximumPercent: 200
deploymentCircuitBreaker.rollback: true
healthCheckGracePeriodSeconds: 60
```

Initial task size:

```text
cpu: 256
memory: 512 MiB
```

This is the smallest valid Fargate Linux task size and should be enough for the first demo proof. If the container is killed with exit code 137 or metrics show memory pressure, raise to:

```text
cpu: 512
memory: 1024 MiB
```

---

## 5. Load Balancer and Health Checks

ALB target group:

```text
target type: ip
protocol: HTTP
target port: 8000
health check path: /api/health
health check matcher: 200
deregistration delay: 30 seconds
```

ALB listeners:

```text
initial proof: HTTP 80
after domain/certificate: HTTPS 443 with ACM certificate
```

Do not require HTTPS in the first proof unless the domain and ACM certificate are ready.

---

## 6. Security Groups

ALB security group:

```text
inbound 80 from 0.0.0.0/0 for initial proof
inbound 443 from 0.0.0.0/0 after ACM
outbound 8000 to backend task security group
```

Backend task security group:

```text
inbound 8000 only from ALB security group
outbound 443 to internet or AWS service endpoints
outbound 5432 only to future RDS security group
```

Future RDS security group:

```text
inbound 5432 only from backend task security group
no public inbound access
```

---

## 7. IAM Roles

Use separate ECS roles:

```text
execution role:
  pull ECR image
  write CloudWatch logs
  read SSM/Secrets Manager values referenced by task definition

task role:
  permissions for application code only
```

Current backend application does not need AWS API access unless a later feature explicitly adds it, so the initial task role should be minimal.

Never pass `AWS_ACCESS_KEY_ID` or `AWS_SECRET_ACCESS_KEY` into the application container.

---

## 8. Runtime Configuration

Plain environment variables:

```text
APP_ENV=production
DISABLE_SCHEDULER=0 or 1, decided at ECS runtime
FRONTEND_BASE_URL=<future frontend URL>
CORS_ORIGINS=<future frontend origin>
```

Sensitive values:

```text
DATABASE_URL
OPENAI_API_KEY or AI provider keys
JWT/session secrets if added
```

Sensitive values should be stored in SSM Parameter Store SecureString or Secrets Manager and injected through the ECS task definition `secrets` field.

---

## 9. Scheduler Rule

Current Capstone backend model:

```text
desiredCount=1
```

This allows the scheduler to run in the API container if the team chooses.

For CI and health validation:

```text
DISABLE_SCHEDULER=1
```

For production/demo ECS:

```text
Option 1: DISABLE_SCHEDULER=0 with desiredCount=1
Option 2: DISABLE_SCHEDULER=1 until scheduler behavior is explicitly needed
```

Do not enable ECS autoscaling until scheduled work is separated from API tasks or protected by a single-runner design.

---

## 10. Cost Guardrails

Phase 5 should keep the first deployment as small as possible:

```text
one ECR repository
one ECS cluster
one Fargate service
desiredCount=1
smallest valid Fargate task size first
one ALB
no NAT Gateway for the first proof unless explicitly approved
no ECS autoscaling
no WAF
no Multi-AZ RDS
no Provisioned IOPS
```

Cost-sensitive facts to remember:

```text
Fargate is billed by requested vCPU, memory, OS/architecture, storage, and run duration.
ALB has its own hourly and usage-based pricing.
Private subnet Fargate without public IP needs NAT or VPC endpoints for ECR/logs access.
```

Official references:

```text
AWS Fargate pricing:
https://aws.amazon.com/fargate/pricing/

Elastic Load Balancing pricing:
https://aws.amazon.com/elasticloadbalancing/pricing/

ECS outbound networking:
https://docs.aws.amazon.com/AmazonECS/latest/developerguide/networking-outbound.html
```

---

## 11. First Manual Creation Order After Approval

Only after the user explicitly approves resource creation:

```text
1. Confirm AWS account identity and region.
2. Create or select VPC/subnets for the demo architecture.
3. Create security groups.
4. Create CloudWatch log group.
5. Create ECR repository.
6. Build and push backend image.
7. Create ECS cluster.
8. Create ECS task execution role and minimal task role.
9. Register Fargate task definition.
10. Create ALB and target group.
11. Create ECS Fargate service.
12. Wait for service stability.
13. Verify /api/health through the ALB DNS name.
14. Record all created resources and stop/delete procedure.
```

Do not add GitHub Actions deployment automation until the manual backend deployment path is proven.

---

## 12. Approval Gate

Next approval phrase before creating AWS resources:

```text
Approve Phase 5 backend resource creation
```

Without that explicit approval, stay in documentation, review, and planning mode only.

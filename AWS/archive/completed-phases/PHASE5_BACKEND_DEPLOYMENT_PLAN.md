# TripSync AWS Phase 5 Backend Deployment Plan

Status: provisioned and verified.

Date: 2026-08-10

Region: us-east-1

This document defines the approved Phase 5 backend architecture for TripSync.

Provisioning entrypoint:

```text
.github/workflows/phase5-backend-provision.yml
```

This workflow is `workflow_dispatch` only and uses the GitHub Environment `Main` AWS credentials.

Provision result:

```text
AWS/archive/completed-phases/PHASE5_BACKEND_PROVISION_RESULT.md
```

Completed prerequisites:

```text
Phase 1: backend local/cloud readiness prepared
Phase 2: build validation completed
Phase 3: frontend hosting proof completed
Phase 4: database readiness completed
```

---

## 1. Hard Scope Boundary

These actions were approved with:

```text
Approve Phase 5 backend resource creation
```

Do not repeat provisioning, modify IAM, delete resources, or create additional billable resources without a fresh explicit approval.

The approved first proof created or reused the Phase 5 resource set through GitHub Actions.

Original hard-scope list from the pre-approval plan:

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

AWS billable resources may be created only after the user explicitly approves the resource creation step with the approval phrase in this document.

---

## 2. First-Proof Backend Deployment Mode

The first Phase 5 backend provisioning proof is infrastructure-only.

Proof path:

```text
GitHub/manual image build
  -> ECR
  -> ECS Fargate
  -> ALB
  -> GET /api/health
```

Initial runtime:

```text
DISABLE_SCHEDULER=1
MOCK_AI=1
desiredCount=1
```

The first proof does not require functional RDS or OpenAI integration.

Do not describe the full TripSync backend as production-functional until these later pieces are connected:

```text
RDS PostgreSQL
DATABASE_URL runtime secret
OpenAI or AI provider runtime secret
production CORS origin
frontend API base URL
```

The first proof proves only:

```text
container image can be stored in ECR
ECS Fargate can run the backend container
ALB can route traffic to the task
/api/health returns HTTP 200 through the ALB
CloudWatch Logs receives container logs
```

---

## 3. Exact Initial VPC Topology

Initial topology:

```text
one VPC
  -> Public Subnet A in AZ A
  -> Public Subnet B in AZ B
  -> Private DB Subnet A in AZ A
  -> Private DB Subnet B in AZ B
  -> Internet Gateway
  -> public route table with 0.0.0.0/0 -> Internet Gateway
```

Placement:

```text
ALB:
  uses Public Subnet A and Public Subnet B

Initial ECS Fargate service:
  uses public subnet networking
  Assign Public IP = ENABLED
  task security group allows inbound 8000 only from the ALB security group

Future RDS:
  remains private
  uses Private DB Subnet A and Private DB Subnet B as a DB subnet group
```

Do not create these networking resources during plan-only work.

---

## 4. Recommended Backend Architecture

```text
GitHub Actions or manual operator
  -> build backend Docker image
  -> tag image with commit SHA
  -> push image to ECR

AWS us-east-1
  -> VPC with two public subnets and two private DB subnets
  -> ECR repository: tripsync-backend
  -> ECS cluster: tripsync-cluster
  -> ECS Fargate service: tripsync-backend-service
  -> Application Load Balancer
  -> Target group on container port 8000
  -> CloudWatch Logs log group: /ecs/tripsync-backend
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

## 5. Resource Inventory and Proposed Names

These are proposed names only. Do not create them until provisioning is approved.

| Resource | Proposed name |
|---|---|
| VPC | `tripsync-vpc` |
| Public Subnet A | `tripsync-public-subnet-a` |
| Public Subnet B | `tripsync-public-subnet-b` |
| Private DB Subnet A | `tripsync-private-db-subnet-a` |
| Private DB Subnet B | `tripsync-private-db-subnet-b` |
| Public route table | `tripsync-public-rt` |
| Private DB route table | `tripsync-private-db-rt` |
| Internet Gateway | `tripsync-igw` |
| ALB security group | `tripsync-alb-sg` |
| Backend security group | `tripsync-backend-sg` |
| Future RDS security group | `tripsync-rds-sg` |
| CloudWatch log group | `/ecs/tripsync-backend` |
| ECR repository | `tripsync-backend` |
| ECS cluster | `tripsync-cluster` |
| ECS task definition family | `tripsync-backend` |
| ECS service | `tripsync-backend-service` |
| ALB | `tripsync-backend-alb` |
| Target group | `tripsync-backend-tg` |
| ECS task execution role | `tripsync-ecs-execution-role` |
| ECS task role | `tripsync-backend-task-role` |

---

## 6. Network Decision

The first proof uses public-subnet Fargate tasks with `Assign Public IP = ENABLED`.

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

Future private-subnet task path:

```text
Private Fargate tasks require NAT Gateway or these VPC endpoints:
  ecr.dkr interface endpoint
  ecr.api interface endpoint
  s3 gateway endpoint
  logs interface endpoint

For ECS Exec, also add:
  ssmmessages interface endpoint
```

---

## 7. ECS/Fargate Service Shape

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
Assign Public IP: ENABLED
```

Initial task size:

```text
cpu: 256
memory: 512 MiB
```

Upgrade trigger:

```text
upgrade to cpu=512 and memory=1024 MiB if:
  container exits with code 137
  CloudWatch metrics show memory pressure
  /api/health becomes unstable under normal demo traffic
  application startup routinely exceeds the health grace period
```

---

## 8. ECR Image Hygiene

Repository:

```text
tripsync-backend
```

Tagging rule:

```text
required deployment tag: <commit-sha>
optional convenience tag: latest
```

Deployment should reference the commit SHA tag for traceability. `latest` may exist for human convenience, but it should not be the only deployable tag.

Lifecycle recommendation:

```text
keep a limited number of recent commit-SHA images
expire old untagged images quickly
preview lifecycle policy behavior before applying it
```

Initial applied lifecycle policy:

```text
expire untagged images after 7 days
```

The tagged commit-SHA retention cap remains a recommendation for a later refinement so the first provisioning workflow stays simple and less failure-prone.

Reason:

```text
ECR storage is usage-based, so old images and untagged layers should not accumulate forever.
```

---

## 9. CloudWatch Logs

Log group:

```text
/ecs/tripsync-backend
```

Retention:

```text
7 days
```

Task definition log driver:

```text
awslogs
```

Expected log stream naming:

```text
ecs/tripsync-backend/<task-id>
```

Do not log secrets, tokens, passwords, full database URLs, or user-sensitive request payloads to stdout/stderr.

---

## 10. Load Balancer and Health Checks

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

## 11. Security Groups

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

## 12. IAM Roles

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

## 13. Runtime Configuration

First proof plain environment variables:

```text
APP_ENV=production
DISABLE_SCHEDULER=1
MOCK_AI=1
FRONTEND_BASE_URL=<not required for first /api/health proof>
CORS_ORIGINS=<not required for first /api/health proof>
```

Later sensitive values:

```text
DATABASE_URL
OPENAI_API_KEY or AI provider keys
JWT/session secrets if added
```

Sensitive values should be stored in SSM Parameter Store SecureString or Secrets Manager and injected through the ECS task definition `secrets` field.

---

## 14. Scheduler Rule

Current first proof model:

```text
desiredCount=1
DISABLE_SCHEDULER=1
```

This keeps the first backend proof focused on infrastructure health only.

Do not enable ECS autoscaling until scheduled work is separated from API tasks or protected by a single-runner design.

---

## 15. Estimated Monthly Proof Cost

These are estimates for us-east-1 and should be rechecked against current AWS pricing immediately before provisioning.

Assumption:

```text
730 hours/month
one 256 CPU / 512 MiB Fargate task running continuously
one internet-facing ALB across two public subnets
one public IPv4 for the Fargate task
two public IPv4 addresses consumed by the ALB
low demo traffic
small ECR and CloudWatch Logs usage
AWS Free Plan credits may offset eligible charges
```

Continuous hourly costs:

| Resource | Estimate | Notes |
|---|---:|---|
| Fargate task, 0.25 vCPU / 0.5 GiB | about `$9.01/month` | Based on AWS Linux/x86 us-east-1 example rates for vCPU-second and GB-second. |
| ALB hourly charge | about `$16.43/month` | Excludes LCU usage. |
| ALB LCU usage | about `$0-$5.84/month` | Low traffic may be near zero; 1 LCU-hour for 730 hours would be about `$5.84`. |
| Public IPv4 addresses | about `$10.95/month` | Three addresses assumed: two ALB addresses plus one Fargate task public IP. |

Storage and usage-based costs:

| Resource | Estimate | Notes |
|---|---:|---|
| ECR private image storage | about `$0.10-$0.50/month` | Depends on retained image size/count; lifecycle policy should cap growth. |
| CloudWatch Logs ingestion/storage | about `$0-$1/month` for proof traffic | 7-day retention limits stored log volume. |
| Data transfer | usage-based | Usually small for health-check/demo proof, but not zero if public traffic grows. |

Resources with no direct hourly charge:

| Resource | Direct hourly charge |
|---|---:|
| ECS cluster orchestration | `$0` direct ECS management fee |
| VPC | `$0` direct hourly charge |
| Subnets | `$0` direct hourly charge |
| Route tables | `$0` direct hourly charge |
| Security groups | `$0` direct hourly charge |
| Internet Gateway | `$0` direct hourly charge |
| IAM roles | `$0` direct hourly charge |

Estimated first-proof total:

```text
about $37-$44/month before AWS Free Plan credits
```

Main cost drivers:

```text
ALB hourly charge
Fargate runtime
public IPv4 charges
```

Official references:

```text
AWS Fargate pricing:
https://aws.amazon.com/fargate/pricing/

Elastic Load Balancing pricing:
https://aws.amazon.com/elasticloadbalancing/pricing/

Amazon VPC pricing:
https://aws.amazon.com/vpc/pricing/

Amazon ECR pricing:
https://aws.amazon.com/ecr/pricing/

Amazon CloudWatch pricing:
https://aws.amazon.com/cloudwatch/pricing/

Amazon ECS pricing:
https://aws.amazon.com/ecs/pricing/
```

---

## 16. Cost Guardrails

Phase 5 should keep the first deployment as small as possible:

```text
one ECR repository
one ECS cluster
one Fargate service
desiredCount=1
cpu=256
memory=512 MiB
one ALB
no NAT Gateway for the first proof unless explicitly approved
no ECS autoscaling
no WAF
no Multi-AZ RDS
no Provisioned IOPS
CloudWatch Logs retention=7 days
ECR lifecycle policy recommended
```

---

## 17. Rollback Strategy

ECS service rollback:

```text
enable ECS deployment circuit breaker with rollback
minimumHealthyPercent=100
maximumPercent=200
```

Image rollback:

```text
deployment image tag is commit SHA
previous working commit-SHA image remains in ECR
rollback can point the ECS task definition back to the previous image tag
```

Task definition rollback:

```text
keep previous task definition revision
if new revision fails, restore service to previous task definition revision
verify /api/health through ALB after rollback
```

Do not rely only on `latest` for rollback.

---

## 18. First Manual Creation Order After Approval

Only after the user explicitly approves resource creation:

```text
1. Confirm AWS account identity and region.
2. Create VPC and subnets.
3. Create Internet Gateway and public route table.
4. Create security groups.
5. Create CloudWatch log group with 7-day retention.
6. Create ECR repository.
7. Build and push backend image tagged with commit SHA.
8. Create ECS cluster.
9. Create ECS task execution role and minimal task role.
10. Register Fargate task definition.
11. Create ALB and target group.
12. Create ECS Fargate service.
13. Wait for service stability.
14. Verify /api/health through the ALB DNS name.
15. Record all created resources and cleanup procedure.
```

Do not add GitHub Actions deployment automation until the manual backend deployment path is proven.

Current implementation note:

```text
.github/workflows/phase5-backend-provision.yml now performs this proof from GitHub Actions because the local machine has AWS CLI installed but no local AWS credentials, and Docker is not installed locally.
```

---

## 19. Cleanup and Deletion Order

Use this order to remove backend proof resources safely and reduce ongoing charges.

```text
1. Set ECS service desiredCount=0.
2. Wait until running tasks stop.
3. Delete ECS service.
4. Delete ALB listener.
5. Delete target group.
6. Delete ALB.
7. Delete ECS task definition revisions if no longer needed.
8. Delete ECS cluster.
9. Delete ECR images.
10. Delete ECR repository.
11. Delete CloudWatch log group /ecs/tripsync-backend.
12. Delete security groups after dependent ENIs are gone.
13. Detach and delete Internet Gateway.
14. Delete route tables that are not main route tables.
15. Delete public subnets.
16. Delete private DB subnets.
17. Delete VPC.
18. Review Public IPv4 Insights and AWS Billing to confirm no backend proof resources remain.
```

Future RDS cleanup, if RDS is later created, must be handled separately and should include final snapshot/deletion-protection decisions before deletion.

---

## 20. Approval Gate

Next approval phrase before creating AWS resources:

```text
Approve Phase 5 backend resource creation
```

Without that explicit approval, stay in documentation, review, and planning mode only.

# TripSync AWS URL Index

Date: 2026-08-10

Region: us-east-1

This is the central URL index for the current TripSync AWS Phase 5 backend proof.

---

## Live Backend

Backend ALB:

```text
http://tripsync-backend-alb-2124233156.us-east-1.elb.amazonaws.com
```

Backend health endpoint:

```text
http://tripsync-backend-alb-2124233156.us-east-1.elb.amazonaws.com/api/health
```

Expected health response:

```json
{"ok":true}
```

---

## GitHub

Repository:

```text
https://github.com/shnnzdx/cap_stone
```

Phase 5 successful GitHub Actions run:

```text
https://github.com/shnnzdx/cap_stone/actions/runs/31349402435
```

GitHub Actions list:

```text
https://github.com/shnnzdx/cap_stone/actions
```

Phase 5 workflow file:

```text
https://github.com/shnnzdx/cap_stone/blob/main/.github/workflows/phase5-backend-provision.yml
```

Phase 6 readiness workflow file:

```text
https://github.com/shnnzdx/cap_stone/blob/main/.github/workflows/runtime-secrets-readiness.yml
```

Phase 6 successful Runtime Secrets Readiness run:

```text
https://github.com/shnnzdx/cap_stone/actions/runs/31349738285
```

---

## AWS Console Entry Points

AWS Console home for us-east-1:

```text
https://us-east-1.console.aws.amazon.com/console/home?region=us-east-1
```

ECS clusters:

```text
https://us-east-1.console.aws.amazon.com/ecs/v2/clusters?region=us-east-1
```

TripSync ECS cluster:

```text
https://us-east-1.console.aws.amazon.com/ecs/v2/clusters/tripsync-cluster/services?region=us-east-1
```

TripSync ECS backend service:

```text
https://us-east-1.console.aws.amazon.com/ecs/v2/clusters/tripsync-cluster/services/tripsync-backend-service/health?region=us-east-1
```

ECR repository:

```text
https://us-east-1.console.aws.amazon.com/ecr/repositories/private/tripsync-backend?region=us-east-1
```

CloudWatch Logs log group:

```text
https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#logsV2:log-groups/log-group/$252Fecs$252Ftripsync-backend
```

Application Load Balancers:

```text
https://us-east-1.console.aws.amazon.com/ec2/home?region=us-east-1#LoadBalancers:
```

Target Groups:

```text
https://us-east-1.console.aws.amazon.com/ec2/home?region=us-east-1#TargetGroups:
```

VPCs:

```text
https://us-east-1.console.aws.amazon.com/vpcconsole/home?region=us-east-1#vpcs:
```

Subnets:

```text
https://us-east-1.console.aws.amazon.com/vpcconsole/home?region=us-east-1#subnets:
```

Security Groups:

```text
https://us-east-1.console.aws.amazon.com/ec2/home?region=us-east-1#SecurityGroups:
```

IAM roles:

```text
https://us-east-1.console.aws.amazon.com/iam/home#/roles
```

Billing and Cost Management:

```text
https://us-east-1.console.aws.amazon.com/billing/home
```

Public IPv4 Insights:

```text
https://us-east-1.console.aws.amazon.com/vpcconsole/home?region=us-east-1#PublicIpInsights:
```

---

## Local AWS Documentation Files

Phase 5 deployment plan:

```text
AWS/PHASE5_BACKEND_DEPLOYMENT_PLAN.md
```

Phase 5 provision result:

```text
AWS/PHASE5_BACKEND_PROVISION_RESULT.md
```

Phase 6 runtime secrets plan:

```text
AWS/PHASE6_RUNTIME_SECRETS_PLAN.md
```

Phase 6 runtime secrets readiness result:

```text
AWS/PHASE6_RUNTIME_SECRETS_READINESS_RESULT.md
```

Master context:

```text
AWS/TRIPSYNC_AWS_MASTER_CONTEXT_FINAL.md
```

---

## Current Resource Names

```text
VPC: tripsync-vpc
ECS cluster: tripsync-cluster
ECS service: tripsync-backend-service
ECR repository: tripsync-backend
ALB: tripsync-backend-alb
Target group: tripsync-backend-tg
CloudWatch log group: /ecs/tripsync-backend
Execution role: tripsync-ecs-execution-role
Task role: tripsync-backend-task-role
```

---

## Cost Reminder

The live backend proof may incur charges while running.

Main cost drivers:

```text
ALB hourly charge
Fargate task runtime
public IPv4 addresses
CloudWatch Logs usage
ECR image storage
```

Use the cleanup order in `AWS/PHASE5_BACKEND_DEPLOYMENT_PLAN.md` when the proof is no longer needed.

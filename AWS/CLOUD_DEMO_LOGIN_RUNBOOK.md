# TripSync Cloud Demo Login Runbook

Status: completed successfully.

Successful run:

```text
https://github.com/shnnzdx/cap_stone/actions/runs/31398395569
```

Purpose:

```text
Create or update the demo organizer login in the private cloud RDS database
without making RDS publicly accessible.
```

Workflow:

```text
.github/workflows/cloud-demo-login-upsert.yml
```

## Why This Exists

The cloud RDS database is intentionally private:

```text
RDS publicly accessible = No
RDS port 5432 allows only tripsync-backend-sg
ECS injects DATABASE_URL from SSM SecureString
```

That means a laptop may time out when connecting directly to the cloud RDS endpoint. This is expected and should not be fixed by opening RDS to the public internet for a demo login.

## What The Workflow Does

```text
GitHub Actions
-> build current backend image
-> push image to existing tripsync-backend ECR
-> register one-off Fargate task definition
-> run one-off ECS task using existing backend service subnets/security group
-> ECS task receives DATABASE_URL from existing SSM parameter
-> task upserts organizer@cadensy.local in RDS
-> public API login is verified through ALB at /api/auth/login
```

The workflow does not:

```text
make RDS public
add laptop IP ingress to RDS
print DATABASE_URL
print database password
read SSM SecureString plaintext in GitHub logs
drop tables
delete demo data
update the long-running backend ECS service
```

## Login Created Or Updated

```text
email: organizer@cadensy.local
password: 12345678
```

The password is used only by the one-off task and login verification step. The workflow does not print it.

## Manual Run

In GitHub:

```text
Actions
-> Cloud Demo Login Upsert
-> Run workflow
-> organizer_email: organizer@cadensy.local
```

Expected success:

```text
Cloud demo login upsert task completed successfully.
Demo organizer login verified through the public backend API.
```

## Common Failures

`DATABASE_URL secret is not present`

```text
The current backend ECS task definition is missing the SSM DATABASE_URL secret.
Re-run or inspect Phase 6 Runtime Provision.
```

`Cloud demo login ECS task failed to start`

```text
The ECS cluster, task definition, subnet, security group, or Fargate capacity setup needs inspection.
```

`Cloud demo login task failed`

```text
Check /ecs/tripsync-backend CloudWatch Logs for the one-off task.
Common causes are schema drift, missing RDS connectivity from backend SG, or missing SSM read permission on the execution role.
```

`Verify login through public API` fails

```text
The database write may have failed, the backend service may be unhealthy, or the public ALB/backend route may be down.
The expected login endpoint is /api/auth/login.
```

## Security Position

This keeps the approved network model:

```text
laptop -> public ALB -> backend API
ECS task -> private RDS
no laptop -> RDS direct path
```

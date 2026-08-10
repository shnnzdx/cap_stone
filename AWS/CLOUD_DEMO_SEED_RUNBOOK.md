# TripSync Cloud Demo Seed Runbook

Status: ready for use.

Purpose:

```text
Upsert the local demo trip dataset into the private cloud RDS database
through a one-off ECS task, without destructive reseeding.
```

Workflow:

```text
.github/workflows/cloud-demo-seed-upsert.yml
```

## Why This Exists

The current local `backend/app/db/seed.py` flow is destructive:

```text
drop tables / delete rows / recreate demo data
```

That is acceptable for local disposable databases and unacceptable for the
shared cloud RDS database.

The cloud RDS database is also intentionally private:

```text
RDS publicly accessible = No
RDS port 5432 allows only tripsync-backend-sg
ECS injects DATABASE_URL from SSM SecureString
```

So the safe cloud path is:

```text
GitHub Actions
-> build current backend image
-> push image to existing tripsync-backend ECR
-> register one-off Fargate task definition
-> run one-off ECS task using existing backend service subnets/security group
-> ECS task receives DATABASE_URL from existing SSM parameter
-> task runs python -m app.db.upsert_demo_seed
-> public API login and current-plan checks verify success
```

## What The Workflow Writes

It upserts the same demo shape used locally:

```text
organizer@cadensy.local / 12345678
Mia's 30th in Chicago
6 members
preferences
non-negotiable constraints
9 itinerary items
```

The workflow does not:

```text
make RDS public
add laptop IP ingress to RDS
print DATABASE_URL
print database password
read SSM SecureString plaintext in GitHub logs
drop tables
delete existing trips
update the long-running backend ECS service
```

## Manual Run

In GitHub:

```text
Actions
-> Cloud Demo Seed Upsert
-> Run workflow
-> organizer_email: organizer@cadensy.local
```

Expected success:

```text
Cloud demo seed upsert task completed successfully.
Demo seed verified through the public backend API.
```

## Verification

The workflow verifies:

```text
POST /api/auth/login works for organizer@cadensy.local
default_membership.trip_id exists
GET /api/trips/<trip_id>/plans/current returns at least 9 itinerary items
```

## Common Failures

`DATABASE_URL secret is not present`

```text
The current backend ECS task definition is missing the SSM DATABASE_URL secret.
Re-run or inspect Phase 6 Runtime Provision.
```

`Cloud demo seed ECS task failed to start`

```text
The ECS cluster, task definition, subnet, security group, or Fargate capacity setup needs inspection.
```

`Cloud demo seed task failed`

```text
Check /ecs/tripsync-backend CloudWatch Logs for the one-off task.
Common causes are schema drift, missing RDS connectivity from backend SG, or missing SSM read permission on the execution role.
```

`Verify demo plan through public API` fails

```text
The database write may have failed, the backend service may be unhealthy, or the public ALB/backend route may be down.
```

## Security Position

This keeps the approved network model:

```text
laptop -> public ALB -> backend API
ECS task -> private RDS
no laptop -> RDS direct path
```

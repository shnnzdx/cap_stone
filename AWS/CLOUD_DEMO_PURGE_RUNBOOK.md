# TripSync Cloud Demo Purge Runbook

Status: active.

Purpose:

```text
Delete the known demo trip and demo itinerary data from the private cloud RDS
database while preserving the fixed backend accounts.
```

Workflow:

```text
.github/workflows/cloud-demo-purge.yml
```

## Why This Exists

As of Thursday, August 13, 2026, the product no longer depends on a shared demo
trip for entry. Users can self-register and create their own first trip through:

```text
POST /api/auth/register
```

The cloud database should therefore stop carrying the old demo trip data, but
the fixed organizer/participant accounts should remain available in the real
database.

Cloud RDS remains private:

```text
RDS publicly accessible = No
RDS port 5432 allows only tripsync-backend-sg
ECS injects DATABASE_URL from SSM SecureString
```

So the safe purge path is a one-off ECS task inside the existing VPC.

## What The Workflow Removes

Known demo trip names:

```text
Mia's 30th in Chicago
TripSync Cloud Demo
```

The purge removes records attached to those demo trips, including:

```text
trip
trip memberships for that trip
plan
plan items
plan comments
votes / rounds / proposals / notices / change ledger
invites
demo-only seeded users that are left with no memberships afterward
```

The purge preserves:

```text
organizer@cadensy.local
participant@cadensy.local
their account rows
their password hashes
other non-demo trips
other non-demo users
```

## What The Workflow Does

```text
GitHub Actions
-> build current backend image
-> push image to existing tripsync-backend ECR
-> register one-off Fargate task definition
-> run one-off ECS task using existing backend service subnets/security group
-> ECS task receives DATABASE_URL from existing SSM parameter
-> task runs python -m app.db.purge_demo_data
-> public API health is verified
-> organizer fixed login is verified and expected to return zero memberships
```

The workflow does not:

```text
make RDS public
add laptop IP ingress to RDS
drop tables
delete fixed backend accounts
touch the long-running backend ECS service
print DATABASE_URL
print database password
read SSM SecureString plaintext in GitHub logs
```

## Manual Run

In GitHub:

```text
Actions
-> Cloud Demo Purge
-> Run workflow
```

Expected success:

```text
Cloud demo purge task completed successfully.
Fixed organizer login still works and no longer carries a demo membership.
```

## Verification

The workflow verifies:

```text
GET /api/health returns {"ok":true}
POST /api/auth/login works for organizer@cadensy.local
the organizer login returns zero memberships after purge
```

## Security Position

This keeps the approved network model:

```text
laptop -> public ALB -> backend API
ECS task -> private RDS
no laptop -> RDS direct path
```

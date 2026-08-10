# TripSync AWS Phase 6 Runtime Provision Plan

Status: provisioned and verified.

Date: 2026-08-10

Provisioning entrypoint:

```text
.github/workflows/phase6-runtime-provision.yml
```

Provision result:

```text
AWS/archive/completed-phases/PHASE6_RUNTIME_PROVISION_RESULT.md
```

GitHub Environment:

```text
Main
```

Required GitHub Environment secrets:

```text
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
TRIPSYNC_DB_PASSWORD
```

Required GitHub Environment variable:

```text
AWS_REGION=us-east-1
```

---

## 1. Scope

This phase creates or updates:

```text
RDS PostgreSQL instance: tripsync-postgres
RDS DB subnet group: tripsync-private-db-subnet-group
SSM SecureString parameter: /tripsync/backend/prod/database-url
ECS execution role inline policy for ssm:GetParameters on the DATABASE_URL parameter
ECS task definition revision with DATABASE_URL injected through secrets
ECS one-off schema initialization task
ECS backend service update to the runtime task definition
```

It does not connect OpenAI/API provider secrets yet.

The backend remains:

```text
DISABLE_SCHEDULER=1
MOCK_AI=1
desiredCount=1
```

---

## 2. RDS Shape

Initial database shape:

```text
engine=postgres
instance class=db.t4g.micro
allocated storage=20 GiB
storage type=gp3
Single-AZ
publicly accessible=false
database name=tripsync
username=tripsync_app
backup retention=1 day
deletion protection=false
```

The database is placed in the private DB subnet group:

```text
tripsync-private-db-subnet-a
tripsync-private-db-subnet-b
```

Inbound database access remains limited to:

```text
tripsync-backend-sg -> tripsync-rds-sg on tcp/5432
```

---

## 3. Local Environment Sync

After the RDS endpoint is known, sync the generated `DATABASE_URL` into ignored local files only:

```text
C:\Users\ROG\Desktop\capstone\cap_stone-main\backend\.env
C:\Users\ROG\Desktop\capstone\cap_stone-main\.env
```

Do not commit either file.

The DB password is also stored locally under ignored `.local-secrets/` only long enough to sync `.env`.

---

## 4. Validation

The workflow validates:

```text
RDS instance reaches available
DATABASE_URL is stored as SSM SecureString
ECS one-off task runs python -m app.db.init_schema successfully
ECS service becomes stable on the new task definition
ALB /api/health returns success after runtime secret injection
```

---

## 5. Remaining After This Phase

Still not complete after Phase 6:

```text
OpenAI/API provider secret injection
MOCK_AI=0 real AI runtime
frontend API URL integration
production CORS origin
scheduler runtime policy
```

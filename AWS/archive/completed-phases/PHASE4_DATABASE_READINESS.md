# AWS Phase 4 - Database Readiness

Status: code-level readiness implemented; no AWS database resources created.

## Scope

Phase 4 prepares the backend for a future PostgreSQL database on AWS.

This phase does not create:

```text
RDS instances
subnet groups
security groups
Secrets Manager secrets
SSM parameters
CloudFormation stacks
Terraform resources
```

## Current Database Choice

TripSync uses PostgreSQL through SQLAlchemy and psycopg:

```text
DATABASE_URL=postgresql+psycopg://...
```

The future AWS candidate remains RDS for PostgreSQL because it is standard PostgreSQL and keeps the project portable.

## Current Safety Problem

The local demo seed path historically did this:

```text
Base.metadata.drop_all(engine)
Base.metadata.create_all(engine)
seed demo rows
```

That is acceptable only for a local disposable demo database. It must not run automatically against RDS or any shared database.

## Implemented Readiness Changes

Non-destructive schema initialization:

```text
backend/app/db/init_schema.py
```

This calls:

```text
Base.metadata.create_all(engine)
```

It does not call:

```text
drop_all
seed
delete demo data
```

Destructive seed guard:

```text
backend/app/db/seed.py
```

`reset_schema()` now refuses to run against non-local database hosts unless:

```text
ALLOW_DESTRUCTIVE_SEED=1
```

This override is only for an explicitly approved disposable database.

## CI Proof

Manual workflow:

```text
.github/workflows/database-readiness.yml
```

It uses a GitHub Actions PostgreSQL service container and verifies:

```text
python -m app.db.init_schema
python -m pytest -q tests/test_db_safety.py
python -m pytest -q
```

The workflow is validation-only and does not use AWS credentials.

## Future Requirement Before Real RDS

Before production-style RDS schema evolution, add a real migration system such as Alembic.

Current `create_all()` is acceptable only as a short Capstone proof gate for creating missing tables in an empty database. It is not a versioned migration strategy.

## Current Recommendation

Do not create RDS yet.

Next step:

```text
Run the Database Readiness workflow manually in GitHub Actions.
If green, proceed to a no-create RDS architecture plan and cost guardrail review.
```

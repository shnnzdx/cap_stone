# TripSync AWS Documentation

This folder is the AWS source-of-truth area for the TripSync capstone deployment.

## Start Here

Read these files first:

```text
AWS/TRIPSYNC_AWS_MASTER_CONTEXT_FINAL.md
AWS/TRIPSYNC_AWS_URLS.md
AWS/PHASE10_HTTPS_CUSTOM_DOMAIN_PLAN.md
AWS/CLOUD_DEMO_LOGIN_RUNBOOK.md
AWS/CLOUD_DEMO_SEED_RUNBOOK.md
AWS/BACKEND_AI_RUNTIME_RUNBOOK.md
```

Use `TRIPSYNC_AWS_MASTER_CONTEXT_FINAL.md` for the full architecture and deployment history.

Use `TRIPSYNC_AWS_URLS.md` for live URLs, AWS console links, GitHub Actions links, resource names, and current blockers.

Use `PHASE10_HTTPS_CUSTOM_DOMAIN_PLAN.md` when continuing HTTPS/custom domain work.

Use `CLOUD_DEMO_LOGIN_RUNBOOK.md` when the cloud RDS database needs the demo organizer login while RDS remains private.

Use `CLOUD_DEMO_SEED_RUNBOOK.md` when the private cloud RDS database needs the
full demo dataset without running the destructive local `seed.py` flow.

Use `BACKEND_AI_RUNTIME_RUNBOOK.md` when the deployed backend should switch from
`MOCK_AI=1` demo mode to a real OpenAI-compatible provider.

## Current Root Files

```text
README.md
TRIPSYNC_AWS_MASTER_CONTEXT_FINAL.md
TRIPSYNC_AWS_URLS.md
PHASE10_HTTPS_CUSTOM_DOMAIN_PLAN.md
Cloud Demo Login Runbook: CLOUD_DEMO_LOGIN_RUNBOOK.md
Cloud Demo Seed Runbook: CLOUD_DEMO_SEED_RUNBOOK.md
Backend AI Runtime Runbook: BACKEND_AI_RUNTIME_RUNBOOK.md
PHASE6_RUNTIME_SECRETS_PLAN.md
```

`PHASE6_RUNTIME_SECRETS_PLAN.md` intentionally remains in the root because the validation workflow references this exact path.

## Archived Completed Phases

Completed Phase 3-9 planning and result documents are stored in:

```text
AWS/archive/completed-phases/
```

These are kept for audit history and rollback context. They are not the main entry point for new AWS work.

## Current Pause Point

AWS deployment is paused after preparing Phase 10 HTTPS/custom domain automation.

No HTTPS/custom domain AWS resources have been created yet.

Cloud RDS remains private. If the demo organizer login needs to be written to cloud RDS, use the manual `Cloud Demo Login Upsert` GitHub Action instead of opening RDS to direct laptop access.

If the full demo trip dataset needs to be written to cloud RDS, use the manual
`Cloud Demo Seed Upsert` GitHub Action instead of opening RDS to direct laptop
access or running the destructive local `seed.py` flow.

If the deployed backend should start using a real AI provider, use the manual
`Backend AI Runtime Config` GitHub Action instead of editing ECS task
definitions by hand.

Before running Phase 10, provide:

```text
domain_name=<owned custom domain, for example app.example.com>
hosted_zone_id=<existing Route 53 public hosted zone ID>
```

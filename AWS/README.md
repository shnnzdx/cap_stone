# TripSync AWS Documentation

This folder is the AWS source-of-truth area for the TripSync capstone deployment.

## Start Here

Read these files first:

```text
AWS/TRIPSYNC_AWS_MASTER_CONTEXT_FINAL.md
AWS/TRIPSYNC_AWS_URLS.md
AWS/PHASE10_HTTPS_CUSTOM_DOMAIN_PLAN.md
AWS/CLOUD_FIXED_ACCOUNTS_RUNBOOK.md
AWS/CLOUD_DEMO_PURGE_RUNBOOK.md
AWS/BACKEND_AI_RUNTIME_RUNBOOK.md
AWS/CLOUD_DEEPSEEK_CLI_RUNBOOK.md
AWS/CLOUD_DUAL_AI_CLI_RUNBOOK.md
```

Use `TRIPSYNC_AWS_MASTER_CONTEXT_FINAL.md` for the full architecture and deployment history.

Use `TRIPSYNC_AWS_URLS.md` for live URLs, AWS console links, GitHub Actions links, resource names, and current blockers.

Use `PHASE10_HTTPS_CUSTOM_DOMAIN_PLAN.md` when continuing HTTPS/custom domain work.

Use `CLOUD_FIXED_ACCOUNTS_RUNBOOK.md` when the private cloud RDS database
should contain the two fixed backend accounts without creating any demo trip.

Use `CLOUD_DEMO_PURGE_RUNBOOK.md` when the private cloud RDS database should
delete the old demo trip and itinerary while preserving the fixed backend
accounts.

Use `BACKEND_AI_RUNTIME_RUNBOOK.md` when the deployed backend should switch from
`MOCK_AI=1` to a real provider and the AI runtime secret may need to be
provisioned first.

Use `CLOUD_DEEPSEEK_CLI_RUNBOOK.md` when you want the exact local PowerShell +
AWS CLI operator steps for switching the current deployed backend to a
DeepSeek-only runtime by hand.

Use `CLOUD_DUAL_AI_CLI_RUNBOOK.md` when you want the exact local PowerShell +
AWS CLI operator steps for switching the deployed backend to the newer dual-AI
runtime with Ollama Cloud for chat and DeepSeek for planner/explainer.

## Current Manual AWS Workflows

Use only these current manual AWS operator entry points for cloud data and
runtime administration:

```text
.github/workflows/cloud-fixed-accounts-upsert.yml
.github/workflows/cloud-demo-purge.yml
.github/workflows/backend-ai-runtime-config.yml
```

Important:

- all AWS deploy and cloud-admin workflows must be dispatched from `main`
- the workflows now hard-fail if they are started from any other branch
- treat `main` as the only cloud release branch for this repository

## Local AWS CLI Credentials

On this machine, the local operator copy of the AWS CLI credentials lives in:

```text
backend/.env
```

The current local file contains these AWS keys:

```text
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
AWS_REGION
```

Important:

- the repo root `.env` is currently absent on this machine
- AWS CLI does not automatically read `backend/.env`
- a plain `aws sts get-caller-identity` can still fail with `NoCredentials`
  unless the current shell process loads those variables first
- never print, commit, or paste the secret values into docs or chat

PowerShell example for loading only the AWS variables into the current process:

```powershell
Get-Content backend/.env | ForEach-Object {
  if ($_ -match '^\s*#' -or $_ -notmatch '=') { return }
  $name, $value = $_ -split '=', 2
  if ($name -in 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_SESSION_TOKEN', 'AWS_REGION', 'AWS_DEFAULT_REGION') {
    [Environment]::SetEnvironmentVariable($name, $value, 'Process')
  }
}

aws sts get-caller-identity
```

## Current Root Files

```text
README.md
TRIPSYNC_AWS_MASTER_CONTEXT_FINAL.md
TRIPSYNC_AWS_URLS.md
PHASE10_HTTPS_CUSTOM_DOMAIN_PLAN.md
Cloud Fixed Accounts Runbook: CLOUD_FIXED_ACCOUNTS_RUNBOOK.md
Cloud Demo Purge Runbook: CLOUD_DEMO_PURGE_RUNBOOK.md
Backend AI Runtime Runbook: BACKEND_AI_RUNTIME_RUNBOOK.md
Cloud DeepSeek CLI Runbook: CLOUD_DEEPSEEK_CLI_RUNBOOK.md
Cloud Dual AI CLI Runbook: CLOUD_DUAL_AI_CLI_RUNBOOK.md
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

Cloud RDS remains private. If the two fixed backend accounts need to be written
to cloud RDS, use the manual `Cloud Fixed Accounts Upsert` GitHub Action
instead of opening RDS to direct laptop access.

If the old demo trip still exists in cloud RDS and should be removed while
keeping the fixed accounts, use the manual `Cloud Demo Purge` GitHub Action.

If the deployed backend should start using a real AI provider, use the manual
`Backend AI Runtime Config` GitHub Action instead of editing ECS task
definitions by hand.

Before running Phase 10, provide:

```text
domain_name=<owned custom domain, for example app.example.com>
hosted_zone_id=<existing Route 53 public hosted zone ID>
```

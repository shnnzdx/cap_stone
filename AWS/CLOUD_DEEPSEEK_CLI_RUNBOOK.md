# TripSync Cloud DeepSeek CLI Runbook

Date: 2026-08-13

Use this runbook when the deployed AWS backend should run on DeepSeek and you
want to do it manually from the local CLI instead of GitHub Actions.

This is the exact operator path that worked on Thursday, August 13, 2026.

## What This Changes

Today the deployed backend service still reads its cloud AI secret from this SSM
parameter:

```text
/tripsync/backend/prod/openai-api-key
```

And the currently deployed ECS backend task still reads these environment
variables:

```text
OPENAI_BASE_URL=https://api.deepseek.com
OPENAI_MODEL=deepseek-v4-flash
MOCK_AI=0
```

That means a DeepSeek-only cloud switch is currently just:

1. overwrite `/tripsync/backend/prod/openai-api-key` with the real DeepSeek key
2. force a new ECS deployment
3. wait for service stability
4. verify `/api/health`

Important:

- this does not change the database
- this does not change frontend deployment
- this does not change the VPC, RDS, ALB, or HTTPS setup
- this does not yet activate the newer dual-provider cloud routing
- as of 2026-08-13, the cloud runtime is intentionally all DeepSeek

## Before You Start

You need:

- the repository checked out locally
- PowerShell
- AWS CLI installed
- `backend/.env` present locally
- these values present in `backend/.env`:

```text
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
AWS_REGION
DEEPSEEK_API_KEY
```

Do not paste real secret values into docs, screenshots, or commits.

## Step 1: Open PowerShell

Open Windows PowerShell.

Then go to the repo root:


## Step 2: Load AWS Credentials From `backend/.env`

AWS CLI does not auto-read `backend/.env`, so load the AWS variables into the
current shell process first:

```powershell
Get-Content backend/.env | ForEach-Object {
  if ($_ -match '^\s*#' -or $_ -notmatch '=') { return }
  $name, $value = $_ -split '=', 2
  if ($name -in 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_SESSION_TOKEN', 'AWS_REGION', 'AWS_DEFAULT_REGION') {
    [Environment]::SetEnvironmentVariable($name, $value, 'Process')
  }
}
```

## Step 3: Verify AWS Identity

Run:

```powershell
aws sts get-caller-identity
```

Expected shape:

```json
{
  "Account": "448678332746",
  "Arn": "arn:aws:iam::448678332746:user/github-actions-deploy"
}
```

If this fails with `NoCredentials`, the shell did not load the AWS values from
`backend/.env`.

## Step 4: Confirm The Current Backend Service

Check the live backend service:

```powershell
aws ecs describe-services `
  --cluster tripsync-cluster `
  --services tripsync-backend-service `
  --query 'services[0].{taskDefinition:taskDefinition,status:status,desiredCount:desiredCount,runningCount:runningCount}' `
  --output json
```

On 2026-08-13 this returned task definition revision `tripsync-backend:11`.

## Step 5: Optional Inspection Of Current AI Runtime

If you want to inspect the currently deployed AI-related environment and secret
wiring before changing anything:

```powershell
$taskArn = aws ecs describe-services `
  --cluster tripsync-cluster `
  --services tripsync-backend-service `
  --query 'services[0].taskDefinition' `
  --output text

$task = aws ecs describe-task-definition --task-definition $taskArn --output json | ConvertFrom-Json
$container = $task.taskDefinition.containerDefinitions | Where-Object { $_.name -eq 'tripsync-backend' }

$container.environment | Where-Object {
  $_.name -in 'MOCK_AI', 'OPENAI_BASE_URL', 'OPENAI_MODEL', 'DEEPSEEK_BASE_URL', 'DEEPSEEK_MODEL', 'CHAT_AI_PROVIDER', 'PLANNER_AI_PROVIDER', 'EXPLAINER_AI_PROVIDER'
} | Sort-Object name

$container.secrets | Where-Object {
  $_.name -in 'DATABASE_URL', 'OPENAI_API_KEY', 'DEEPSEEK_API_KEY', 'OLLAMA_CLOUD_API_KEY'
} | Sort-Object name
```

For the DeepSeek-only runtime used on 2026-08-13, the important current result
was:

```text
OPENAI_BASE_URL=https://api.deepseek.com
OPENAI_MODEL=deepseek-v4-flash
OPENAI_API_KEY -> /tripsync/backend/prod/openai-api-key
```

## Step 6: Load The Local DeepSeek Key Into A Shell Variable

Do not print the key. Just load it from `backend/.env`:

```powershell
$deepseekKey = $null

Get-Content backend/.env | ForEach-Object {
  if ($_ -match '^\s*DEEPSEEK_API_KEY\s*=\s*(.+)\s*$') {
    $deepseekKey = $matches[1].Trim()
  }
}

if (-not $deepseekKey) {
  throw 'DEEPSEEK_API_KEY not found in backend/.env'
}
```

## Step 7: Overwrite The Cloud SSM Parameter

Write the real DeepSeek key into the SSM parameter the backend already uses:

```powershell
aws ssm put-parameter `
  --name /tripsync/backend/prod/openai-api-key `
  --type SecureString `
  --value $deepseekKey `
  --overwrite
```

Why this works:

- the deployed ECS backend task already reads `OPENAI_API_KEY` from that SSM
  parameter
- the deployed backend task already points at DeepSeek through
  `OPENAI_BASE_URL=https://api.deepseek.com`
- so replacing the key is enough for a DeepSeek-only cloud runtime

## Step 8: Force A New Backend Deployment

Secrets injected through ECS task definition `secrets.valueFrom` are loaded when
the task starts. Changing SSM alone is not enough for already-running tasks.

Force ECS to replace the backend task:

```powershell
aws ecs update-service `
  --cluster tripsync-cluster `
  --service tripsync-backend-service `
  --force-new-deployment
```

## Step 9: Wait For ECS Stability

Wait for the service to finish the rollout:

```powershell
aws ecs wait services-stable `
  --cluster tripsync-cluster `
  --services tripsync-backend-service
```

If the command returns cleanly, ECS considers the service stable.

## Step 10: Verify Backend Health

Check the public backend health endpoint:

```powershell
curl http://tripsync-backend-alb-2124233156.us-east-1.elb.amazonaws.com/api/health
```

Expected response:

```json
{"ok":true}
```

If PowerShell `curl` behaves unexpectedly on your machine, use:

```powershell
Invoke-WebRequest -UseBasicParsing `
  -Uri http://tripsync-backend-alb-2124233156.us-east-1.elb.amazonaws.com/api/health |
  Select-Object -ExpandProperty Content
```

## Fast Path: Exact Minimal Command Sequence

If you already know the service is wired correctly and only want the shortest
repeatable DeepSeek update path:

```powershell
cd C:\Users\zdxzh\Desktop\capstone\New

Get-Content backend/.env | ForEach-Object {
  if ($_ -match '^\s*#' -or $_ -notmatch '=') { return }
  $name, $value = $_ -split '=', 2
  if ($name -in 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_SESSION_TOKEN', 'AWS_REGION', 'AWS_DEFAULT_REGION') {
    [Environment]::SetEnvironmentVariable($name, $value, 'Process')
  }
}

$deepseekKey = $null
Get-Content backend/.env | ForEach-Object {
  if ($_ -match '^\s*DEEPSEEK_API_KEY\s*=\s*(.+)\s*$') {
    $deepseekKey = $matches[1].Trim()
  }
}
if (-not $deepseekKey) { throw 'DEEPSEEK_API_KEY not found in backend/.env' }

aws ssm put-parameter `
  --name /tripsync/backend/prod/openai-api-key `
  --type SecureString `
  --value $deepseekKey `
  --overwrite

aws ecs update-service `
  --cluster tripsync-cluster `
  --service tripsync-backend-service `
  --force-new-deployment

aws ecs wait services-stable `
  --cluster tripsync-cluster `
  --services tripsync-backend-service

curl http://tripsync-backend-alb-2124233156.us-east-1.elb.amazonaws.com/api/health
```

## If Something Fails

### `NoCredentials`

You did not load the AWS variables from `backend/.env` into the current shell.
Go back to Step 2.

### `DEEPSEEK_API_KEY not found in backend/.env`

Your local file is missing the DeepSeek key or the variable name is wrong.

The correct local variable name is:

```text
DEEPSEEK_API_KEY
```

### `services-stable` never completes

Inspect ECS service events:

```powershell
aws ecs describe-services `
  --cluster tripsync-cluster `
  --services tripsync-backend-service `
  --query 'services[0].events[0:10].[createdAt,message]' `
  --output table
```

Inspect backend logs:

```powershell
https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#logsV2:log-groups/log-group/$252Fecs$252Ftripsync-backend
```

### Health Check Fails

Verify:

- ECS service is stable
- backend task is running
- the application still answers `/api/health`

Useful URL:

```text
http://tripsync-backend-alb-2124233156.us-east-1.elb.amazonaws.com/api/health
```

## Current Position

This runbook is still useful as the simplest fallback path when you want to
force the entire cloud runtime back onto DeepSeek only.

As of Thursday, August 13, 2026, the live cloud runtime has already been moved
forward to the newer dual-provider setup documented in:

```text
AWS/CLOUD_DUAL_AI_CLI_RUNBOOK.md
```

That means this file should now be treated as the manual rollback or
single-provider fallback guide, not the primary day-to-day cloud AI runbook.

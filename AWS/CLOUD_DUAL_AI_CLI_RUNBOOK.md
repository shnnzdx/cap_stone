# TripSync Cloud Dual AI CLI Runbook

Date: 2026-08-13

Use this runbook when the deployed AWS backend should run with:

```text
chat      -> ollama_cloud
planner   -> deepseek
explainer -> deepseek
```

and you want to do the full switch manually from the local CLI instead of using
GitHub Actions.

## Current Verified Reality On 2026-08-13

The repository `main` branch already contains the newer dual-provider backend
code and newer AWS workflows.

The cloud runtime was not switched immediately because the Ollama Cloud key had
not been verified yet.

That verification has now been done:

```text
Ollama Cloud key authentication test:
GET https://ollama.com/v1/models -> HTTP 200
```

Important account-specific result:

```text
the current Ollama account does NOT expose qwen3.5:cloud
the current Ollama account DOES expose qwen3.5:397b
```

So for this account, the recommended Ollama chat model is currently:

```text
qwen3.5:397b
```

Do not blindly use `qwen3.5:cloud` unless you re-check model availability later.

## What This Runbook Changes

This runbook moves the AWS backend from the old single-provider cloud runtime to
the newer dual-provider cloud runtime.

It does all of the following:

1. stores DeepSeek and Ollama Cloud keys in two SSM parameters
2. updates the ECS execution role inline policy so the backend task can read both
3. registers a new ECS task definition revision
4. injects both provider secrets into the backend task
5. injects provider-specific runtime env vars
6. sets routing:
   `CHAT_AI_PROVIDER=ollama_cloud`
   `PLANNER_AI_PROVIDER=deepseek`
   `EXPLAINER_AI_PROVIDER=deepseek`
7. redeploys the backend ECS service
8. verifies `/api/health`

## Before You Start

You need:

- the repository checked out locally
- PowerShell
- AWS CLI installed
- `backend/.env` present locally
- these values available locally:

```text
AWS_ACCESS_KEY_ID
AWS_SECRET_ACCESS_KEY
AWS_REGION
DEEPSEEK_API_KEY
OPENAI_API_KEY or OLLAMA_CLOUD_API_KEY
```

Current local repo reality on 2026-08-13:

```text
the verified Ollama key is currently stored in backend/.env as OPENAI_API_KEY
```

Preferred long-term local naming:

```text
OLLAMA_CLOUD_API_KEY
OLLAMA_CLOUD_BASE_URL
OLLAMA_CLOUD_MODEL
```

## Step 1: Open PowerShell

Open Windows PowerShell.

Then go to the repo root:

```powershell
cd C:\Users\zdxzh\Desktop\capstone\New
```

## Step 2: Load AWS Credentials Into The Current Shell

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

```powershell
aws sts get-caller-identity
```

Expected account on 2026-08-13:

```json
{
  "Account": "448678332746",
  "Arn": "arn:aws:iam::448678332746:user/github-actions-deploy"
}
```

## Step 4: Load The Two Provider Keys From `backend/.env`

This step loads:

- DeepSeek from `DEEPSEEK_API_KEY`
- Ollama Cloud from `OLLAMA_CLOUD_API_KEY` if present
- otherwise Ollama Cloud from the currently verified local fallback `OPENAI_API_KEY`

```powershell
$deepseekKey = $null
$ollamaKey = $null

Get-Content backend/.env | ForEach-Object {
  if ($_ -match '^\s*DEEPSEEK_API_KEY\s*=\s*(.+)\s*$') {
    $deepseekKey = $matches[1].Trim()
  }
  elseif ($_ -match '^\s*OLLAMA_CLOUD_API_KEY\s*=\s*(.+)\s*$') {
    $ollamaKey = $matches[1].Trim()
  }
  elseif (-not $ollamaKey -and $_ -match '^\s*OPENAI_API_KEY\s*=\s*(.+)\s*$') {
    $ollamaKey = $matches[1].Trim()
  }
}

if (-not $deepseekKey) { throw 'DEEPSEEK_API_KEY not found in backend/.env' }
if (-not $ollamaKey) { throw 'No Ollama Cloud key found in OLLAMA_CLOUD_API_KEY or OPENAI_API_KEY' }
```

## Step 5: Optional Verification Of The Ollama Cloud Key

This is a safe read-only authentication test:

```powershell
$response = Invoke-WebRequest -UseBasicParsing `
  -Uri 'https://ollama.com/v1/models' `
  -Headers @{ Authorization = "Bearer $ollamaKey" }

$json = $response.Content | ConvertFrom-Json
$json.data | Select-Object -ExpandProperty id
```

On 2026-08-13 this succeeded with HTTP 200 and showed:

```text
qwen3.5:397b
```

and did not show:

```text
qwen3.5:cloud
```

## Step 6: Write The Two Provider Keys Into SSM Parameter Store

The new dual-provider runtime uses these parameter names:

```text
/tripsync/backend/prod/deepseek-api-key
/tripsync/backend/prod/ollama-cloud-api-key
```

Write them:

```powershell
aws ssm put-parameter `
  --name /tripsync/backend/prod/deepseek-api-key `
  --type SecureString `
  --value $deepseekKey `
  --overwrite

aws ssm put-parameter `
  --name /tripsync/backend/prod/ollama-cloud-api-key `
  --type SecureString `
  --value $ollamaKey `
  --overwrite
```

## Step 7: Get The Parameter ARNs

```powershell
$deepseekArn = aws ssm get-parameter `
  --name /tripsync/backend/prod/deepseek-api-key `
  --query 'Parameter.ARN' `
  --output text

$ollamaArn = aws ssm get-parameter `
  --name /tripsync/backend/prod/ollama-cloud-api-key `
  --query 'Parameter.ARN' `
  --output text

$databaseArn = aws ssm get-parameter `
  --name /tripsync/backend/prod/database-url `
  --query 'Parameter.ARN' `
  --output text
```

## Step 8: Update The ECS Execution Role Inline Policy

The execution role must be able to read all three SSM parameters at task start.

```powershell
$policyPath = Join-Path $env:TEMP 'tripsync-ecs-ssm-read-policy.json'

@"
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "ssm:GetParameters",
      "Resource": [
        "$databaseArn",
        "$deepseekArn",
        "$ollamaArn"
      ]
    }
  ]
}
"@ | Set-Content -Path $policyPath -Encoding utf8

aws iam put-role-policy `
  --role-name tripsync-ecs-execution-role `
  --policy-name tripsync-read-runtime-parameters `
  --policy-document file:///$policyPath
```

## Step 9: Discover The Current Backend Task Definition

```powershell
$taskArn = aws ecs describe-services `
  --cluster tripsync-cluster `
  --services tripsync-backend-service `
  --query 'services[0].taskDefinition' `
  --output text

$task = aws ecs describe-task-definition --task-definition $taskArn --output json | ConvertFrom-Json
$container = $task.taskDefinition.containerDefinitions | Where-Object { $_.name -eq 'tripsync-backend' }
```

## Step 10: Build The New Backend Container Definition

This keeps the current container image and base service wiring, but changes the
AI runtime to dual-provider mode.

Recommended routing for 2026-08-13:

```text
CHAT_AI_PROVIDER=ollama_cloud
PLANNER_AI_PROVIDER=deepseek
EXPLAINER_AI_PROVIDER=deepseek
```

Recommended models for 2026-08-13:

```text
DEEPSEEK_MODEL=deepseek-v4-flash
OLLAMA_CLOUD_MODEL=qwen3.5:397b
```

```powershell
$container | Add-Member -NotePropertyName environment -NotePropertyValue @($container.environment) -Force
$container | Add-Member -NotePropertyName secrets -NotePropertyValue @($container.secrets) -Force

$container.healthCheck = $null
$container.environment = @($container.environment | Where-Object { $_.name -notin @(
  'OPENAI_BASE_URL',
  'OPENAI_MODEL',
  'DEEPSEEK_BASE_URL',
  'DEEPSEEK_MODEL',
  'OLLAMA_CLOUD_BASE_URL',
  'OLLAMA_CLOUD_MODEL',
  'CHAT_AI_PROVIDER',
  'PLANNER_AI_PROVIDER',
  'EXPLAINER_AI_PROVIDER',
  'AI_FALLBACK_PROVIDER'
) })

$container.environment += @(
  @{ name = 'MOCK_AI'; value = '0' },
  @{ name = 'DEEPSEEK_BASE_URL'; value = 'https://api.deepseek.com' },
  @{ name = 'DEEPSEEK_MODEL'; value = 'deepseek-v4-flash' },
  @{ name = 'OLLAMA_CLOUD_BASE_URL'; value = 'https://ollama.com/v1/' },
  @{ name = 'OLLAMA_CLOUD_MODEL'; value = 'qwen3.5:397b' },
  @{ name = 'CHAT_AI_PROVIDER'; value = 'ollama_cloud' },
  @{ name = 'PLANNER_AI_PROVIDER'; value = 'deepseek' },
  @{ name = 'EXPLAINER_AI_PROVIDER'; value = 'deepseek' }
)

$container.secrets = @($container.secrets | Where-Object { $_.name -notin @(
  'OPENAI_API_KEY',
  'DEEPSEEK_API_KEY',
  'OLLAMA_CLOUD_API_KEY'
) })

$container.secrets += @(
  @{ name = 'DEEPSEEK_API_KEY'; valueFrom = $deepseekArn },
  @{ name = 'OLLAMA_CLOUD_API_KEY'; valueFrom = $ollamaArn }
)
```

## Step 11: Register A New Task Definition Revision

```powershell
$taskDefBody = @{
  family = 'tripsync-backend'
  networkMode = 'awsvpc'
  requiresCompatibilities = @('FARGATE')
  cpu = $task.taskDefinition.cpu
  memory = $task.taskDefinition.memory
  executionRoleArn = $task.taskDefinition.executionRoleArn
  taskRoleArn = $task.taskDefinition.taskRoleArn
  containerDefinitions = @($container)
} | ConvertTo-Json -Depth 20

$taskDefPath = Join-Path $env:TEMP 'tripsync-backend-dual-ai-taskdef.json'
$taskDefBody | Set-Content -Path $taskDefPath -Encoding utf8

$newTaskArn = aws ecs register-task-definition `
  --cli-input-json file:///$taskDefPath `
  --query 'taskDefinition.taskDefinitionArn' `
  --output text

$newTaskArn
```

## Step 12: Update The ECS Service To The New Revision

```powershell
aws ecs update-service `
  --cluster tripsync-cluster `
  --service tripsync-backend-service `
  --task-definition $newTaskArn `
  --desired-count 1 `
  --deployment-configuration "minimumHealthyPercent=100,maximumPercent=200,deploymentCircuitBreaker={enable=true,rollback=true}" `
  --health-check-grace-period-seconds 60
```

## Step 13: Wait For Service Stability

```powershell
aws ecs wait services-stable `
  --cluster tripsync-cluster `
  --services tripsync-backend-service
```

## Step 14: Verify Health

```powershell
curl http://tripsync-backend-alb-2124233156.us-east-1.elb.amazonaws.com/api/health
```

Expected response:

```json
{"ok":true}
```

## Step 15: Optional Runtime Verification

Confirm the new runtime wiring:

```powershell
$taskArn = aws ecs describe-services `
  --cluster tripsync-cluster `
  --services tripsync-backend-service `
  --query 'services[0].taskDefinition' `
  --output text

$task = aws ecs describe-task-definition --task-definition $taskArn --output json | ConvertFrom-Json
$container = $task.taskDefinition.containerDefinitions | Where-Object { $_.name -eq 'tripsync-backend' }

$container.environment | Where-Object {
  $_.name -in 'MOCK_AI', 'DEEPSEEK_BASE_URL', 'DEEPSEEK_MODEL', 'OLLAMA_CLOUD_BASE_URL', 'OLLAMA_CLOUD_MODEL', 'CHAT_AI_PROVIDER', 'PLANNER_AI_PROVIDER', 'EXPLAINER_AI_PROVIDER'
} | Sort-Object name

$container.secrets | Where-Object {
  $_.name -in 'DATABASE_URL', 'DEEPSEEK_API_KEY', 'OLLAMA_CLOUD_API_KEY'
} | Sort-Object name
```

Expected shape:

```text
MOCK_AI=0
CHAT_AI_PROVIDER=ollama_cloud
PLANNER_AI_PROVIDER=deepseek
EXPLAINER_AI_PROVIDER=deepseek
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-v4-flash
OLLAMA_CLOUD_BASE_URL=https://ollama.com/v1/
OLLAMA_CLOUD_MODEL=qwen3.5:397b
DEEPSEEK_API_KEY -> /tripsync/backend/prod/deepseek-api-key
OLLAMA_CLOUD_API_KEY -> /tripsync/backend/prod/ollama-cloud-api-key
```

## If Something Fails

### Ollama auth test fails with 401

The local Ollama key is invalid, expired, or not actually an API key.

### `qwen3.5:cloud` is missing

Do not use it.

For this account on 2026-08-13, the verified available `qwen3.5` model is:

```text
qwen3.5:397b
```

### ECS deployment does not stabilize

Inspect ECS events:

```powershell
aws ecs describe-services `
  --cluster tripsync-cluster `
  --services tripsync-backend-service `
  --query 'services[0].events[0:10].[createdAt,message]' `
  --output table
```

Inspect backend logs:

```text
https://us-east-1.console.aws.amazon.com/cloudwatch/home?region=us-east-1#logsV2:log-groups/log-group/$252Fecs$252Ftripsync-backend
```

## Safer Alternative

If you do not want to hand-build the task definition, the repository now already
contains the newer dual-provider workflows on `main`:

```text
.github/workflows/backend-ai-secret-provision.yml
.github/workflows/backend-ai-runtime-config.yml
```

Those workflows are the safer repeatable operator path once GitHub `Main`
environment secrets are set correctly.

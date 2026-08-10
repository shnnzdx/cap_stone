# TripSync Backend AI Runtime Runbook

Status: ready for use.

Purpose:

```text
Switch the deployed backend between MOCK_AI demo mode and a real
OpenAI-compatible provider without changing the private RDS network model.
```

Workflow:

```text
.github/workflows/backend-ai-runtime-config.yml
```

Supporting secret/bootstrap workflow:

```text
.github/workflows/backend-ai-secret-provision.yml
```

## Why This Exists

The current deployed backend still uses:

```text
MOCK_AI=1
DISABLE_SCHEDULER=1
desiredCount=1
```

That means login, database writes, trip data, comments, votes, and proposals can
work, but model-backed planner/chat behavior is still running the local mock
path.

The backend code already supports real OpenAI-compatible runtime inputs:

```text
OPENAI_API_KEY
OPENAI_BASE_URL
OPENAI_MODEL
MOCK_AI
```

The missing piece is a safe ECS runtime update path that:

```text
preserves DATABASE_URL secret injection
preserves current frontend/CORS runtime config
adds or removes OPENAI_API_KEY secret injection
switches MOCK_AI between 1 and 0
```

## What The Workflow Does

```text
GitHub Actions
-> read the current backend ECS task definition
-> keep current image, health check, logs, DATABASE_URL secret, frontend URL, CORS, scheduler flag
-> optionally look up the SSM parameter metadata for the AI API key
-> register a new backend task definition revision
-> update the existing backend ECS service
-> wait for ECS service stability
-> verify /api/health through the public ALB
```

The workflow does not:

```text
print OPENAI_API_KEY
print DATABASE_URL
read plaintext SSM SecureString values into logs
change RDS networking
change the frontend ECS service
change HTTPS/custom-domain resources
change desiredCount beyond the current backend service shape
```

## Required Runtime Secret

Expected sensitive SSM parameter name:

```text
/tripsync/backend/prod/openai-api-key
```

This workflow checks only the parameter metadata path. It does not print the
secret value.

Expected GitHub `Main` environment secret used to provision that SSM parameter:

```text
TRIPSYNC_OPENAI_API_KEY
```

The provisioning workflow writes the SSM SecureString and updates the ECS
execution role inline policy so the backend task can read both runtime
parameters:

```text
/tripsync/backend/prod/database-url
/tripsync/backend/prod/openai-api-key
```

## Provision Secret First

In GitHub:

```text
Actions
-> Backend AI Secret Provision
-> Run workflow
```

Typical input:

```text
openai_api_key_parameter=/tripsync/backend/prod/openai-api-key
```

## Manual Run

In GitHub:

```text
Actions
-> Backend AI Runtime Config
-> Run workflow
```

Typical real AI run:

```text
mock_ai=false
openai_api_key_parameter=/tripsync/backend/prod/openai-api-key
openai_base_url=
openai_model=gpt-4o-mini
```

Typical OpenAI-compatible provider run:

```text
mock_ai=false
openai_api_key_parameter=/tripsync/backend/prod/openai-api-key
openai_base_url=https://api.deepseek.com
openai_model=deepseek-chat
```

Rollback to mock mode:

```text
mock_ai=true
openai_api_key_parameter=/tripsync/backend/prod/openai-api-key
openai_base_url=
openai_model=gpt-4o-mini
```

## Verification

The workflow verifies:

```text
ECS service reaches stable
GET /api/health returns {"ok":true}
```

After a successful run, planner/chat requests should stop using mock responses
when `mock_ai=false`.

## Common Failures

`SSM parameter /tripsync/backend/prod/openai-api-key was not found`

```text
The AI provider key parameter does not exist yet, or the workflow input name is
wrong. Run Backend AI Secret Provision first, then re-run Backend AI Runtime
Config.
```

`DATABASE_URL secret is not present on the current backend task definition`

```text
The current backend task definition drifted away from the Phase 6 runtime layout.
Inspect Phase 6 Runtime Provision and the active ECS task definition.
```

`Backend health check passed after AI runtime config update` is missing

```text
The ECS deployment did not stabilize or the backend is unhealthy after startup.
Check the ECS service events and /ecs/tripsync-backend CloudWatch Logs.
```

## Current Product Reality

Real-time product behavior is currently:

```text
database writes happen immediately through API requests
frontend refreshes current state through polling
no websocket/SSE transport is deployed yet
```

Turning `MOCK_AI=0` enables real model calls. It does not change the transport
model for comments, votes, proposals, or trip updates.

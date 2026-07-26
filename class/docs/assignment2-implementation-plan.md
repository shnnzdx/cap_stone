# Assignment 2 Implementation Plan

## 1. Task Summary

This document defines the implementation plan for Module 5: Capstone Project Management Assignment 2.

The capstone project is:

**Human-in-the-Loop Adaptive Alert Noise Reduction System for Backend Reliability Monitoring**

The current frontend already demonstrates the product direction through Dashboard, Alerts, Evaluation, and Admin views. For Assignment 2, the main work should focus on the backend:

- Design backend REST APIs.
- Design and implement a PostgreSQL database.
- Connect APIs to the database.
- Prepare API test cases and test results.
- Demonstrate that each REST API operation updates or reads the database correctly.

The frontend does not need to fully load real production-scale data yet. For this milestone, the recommended approach is to use seeded sample data in the database and expose it through backend APIs.

## 2. Assignment Requirements

The assignment asks for the following deliverables:

1. A list of backend APIs needed to support the capstone solution.
2. Expected input and output for each API.
3. Sample JSON request and response for each API.
4. A database design and implemented tables for the capstone application.
5. Test case documentation and API test results.
6. Working backend API code fully integrated with the database.
7. A GitHub repository link containing code and documentation.
8. A 6-10 minute demo video showing:
   - backend solution
   - code walkthrough
   - API tests
   - database and tables
   - issues encountered and how they were resolved
   - database updates after each REST API operation

Grading weight:

| Area | Points |
| --- | ---: |
| API List with Expected Input/Output + Test Case Documentation | 20 |
| Database Design and Implementation | 20 |
| API Testing Results and Live Demonstration | 60 |

## 3. Current Design Alignment

The original proposal in `class/week1/v2.docx` describes a system with:

- backend job metrics ingestion
- baseline alert generation
- suppression and deduplication
- human feedback labels
- adaptive alert scoring
- explainability
- admin configuration
- evaluation dashboard

The current frontend already supports this direction:

- `Dashboard`: alert quality, alert queue, noise breakdown, strategy snapshot, feedback impact
- `Alerts`: alert review, alert detail, feedback submission, suppression audit
- `Evaluation`: comparison between feedback ranking, fixed threshold, and rule-only suppression
- `Admin`: planned area for thresholds, suppression rules, roles, recommendations, and audit logs

Therefore, the backend should be designed to support these frontend areas.

## 4. Data Loading Decision

### Recommendation

Do not load the full AIOps 2020 or AIOps 2018 datasets for this milestone.

For Assignment 2, use a smaller seeded PostgreSQL dataset that represents realistic backend reliability monitoring data.

### Why

The assignment focuses on API design, database implementation, API testing, and live demonstration. Large public datasets are useful for final evaluation, but they add complexity that is not required for this milestone.

### What Data Is Needed Now

Create seed/sample data for:

- services
- backend jobs
- alert events
- alert decisions
- human feedback
- suppression rules
- threshold configurations
- recommendations
- evaluation results
- users and roles
- audit logs

Suggested seed size:

| Table | Suggested Records |
| --- | ---: |
| users | 3-5 |
| services | 4-6 |
| backend_jobs | 10-15 |
| alert_events | 25-50 |
| alert_feedback | 8-15 |
| suppression_rules | 3-5 |
| threshold_configs | 3-5 |
| recommendations | 2-4 |
| evaluation_runs | 3 |
| audit_logs | 10-20 |

This is enough to demonstrate API behavior, database changes, dashboard metrics, and feedback workflow.

## 5. Backend Technology Plan

Use the same technology direction as the Week 4/5 course examples:

- Python
- Flask
- Flask-SQLAlchemy
- Flask-Marshmallow
- PostgreSQL
- python-dotenv
- psycopg2
- optional Swagger / Flasgger for API documentation

Recommended folder:

```text
C:\Users\ROG\Desktop\capstone\backend
```

Recommended structure:

```text
backend/
  app/
    __init__.py
    extensions.py
    models.py
    schemas.py
    routes/
      services.py
      jobs.py
      alerts.py
      dashboard.py
      rules.py
      thresholds.py
      evaluation.py
      audit.py
    services/
      alert_scoring.py
      suppression_engine.py
      dashboard_metrics.py
      audit_service.py
  seed.py
  run.py
  requirements.txt
  .env.example
  docs/
    API_DOCUMENTATION.md
    DATABASE_DESIGN.md
    API_TEST_CASES.md
    API_TEST_RESULTS.md
    DEMO_SCRIPT.md
  postman/
    capstone-api.postman_collection.json
```

Keep `.env`, `venv/`, `__pycache__/`, `.pytest_cache/`, and local database dumps out of GitHub. The repository should include `.env.example`, not real credentials.

## 6. Database Design

### Core Tables

#### users

Stores reviewers, admins, and operators.

Key fields:

- id
- name
- email
- role
- created_at

Roles:

- operator
- sre
- admin

#### services

Stores backend services or workflow groups.

Key fields:

- id
- name
- owner_team
- criticality
- description
- created_at

#### backend_jobs

Stores backend job executions.

Key fields:

- id
- service_id
- job_name
- worker_id
- status
- duration_ms
- api_latency_ms
- retry_count
- error_count
- queue_delay_ms
- processed_count
- failed_count
- timeout_count
- throughput_per_minute
- started_at
- completed_at
- created_at

Statuses:

- completed
- failed
- completed_with_failures
- timeout

#### alert_events

Stores alert candidates and final alert decisions.

Key fields:

- id
- job_id
- severity
- score
- utility
- decision
- decision_reason
- applied_rules_json
- confidence
- status
- is_duplicate
- duplicate_of_alert_id
- duplicate_group_key
- is_actionable
- archived
- created_at
- acknowledged_at

Decisions:

- promote
- suppress

Statuses:

- open
- acknowledged
- escalated
- closed

#### alert_feedback

Stores human-in-the-loop review labels.

Key fields:

- id
- alert_id
- user_id
- outcome
- operator_action
- note
- applied_to_ranking
- created_at

Outcomes:

- real_incident
- useful
- false_positive
- duplicate
- expected_behavior
- noisy
- needs_more_information

Operator actions:

- confirm
- escalate
- close

#### suppression_rules

Stores admin-created suppression and deduplication rules.

Key fields:

- id
- service_id
- rule_name
- rule_type
- condition_json
- active
- created_by
- created_at

Rule types:

- duplicate_grouping
- expected_maintenance
- transient_retry
- low_severity_noise

#### threshold_configs

Stores fixed threshold and adaptive recommendation settings.

Key fields:

- id
- service_id
- metric_name
- threshold_value
- strategy
- version
- status
- active
- recommended_by
- approved_by
- effective_from
- effective_to
- created_at
- updated_at

Strategies:

- threshold
- rules
- feedback

#### evaluation_runs

Stores evaluation comparison results.

Key fields:

- id
- strategy
- alerts_sent
- false_positives
- duplicate_rate
- alert_reduction
- precision
- recall
- mean_time_to_acknowledge
- created_at

#### audit_logs

Stores admin and operator actions.

Key fields:

- id
- user_id
- action
- entity_type
- entity_id
- before_json
- after_json
- created_at

#### recommendations

Stores adaptive threshold or suppression recommendations that require admin review before becoming active.

Key fields:

- id
- service_id
- recommendation_type
- current_value_json
- recommended_value_json
- reason
- confidence
- status
- reviewed_by
- created_at
- reviewed_at

Statuses:

- pending
- approved
- rejected

### Database Relationships

Recommended relationships:

- `services` 1 to many `backend_jobs`
- `services` 1 to many `suppression_rules`
- `services` 1 to many `threshold_configs`
- `services` 1 to many `recommendations`
- `backend_jobs` 1 to many `alert_events`
- `alert_events` 1 to many `alert_feedback`
- `alert_events` 1 to many `audit_logs`
- `alert_events` 1 to many duplicate alert references through `duplicate_of_alert_id`
- `users` 1 to many `alert_feedback`
- `users` 1 to many `suppression_rules`
- `users` 1 to many `threshold_configs`
- `users` 1 to many `recommendations`
- `users` 1 to many `audit_logs`

Do not store `service_id` directly on `alert_events` for the first implementation. Use `alert_events.job_id -> backend_jobs.service_id` to prevent service mismatch, such as an alert pointing to job 21 while the alert's service field points to another service.

### Required Constraints and Types

Recommended PostgreSQL types:

- `TIMESTAMPTZ` for timestamps.
- `JSONB` for `condition_json`, `before_json`, `after_json`, `applied_rules_json`, `current_value_json`, and `recommended_value_json`.
- `NUMERIC(5,4)` for score-like values such as `score`, `utility`, `confidence`, `precision`, and `recall`.
- `INTEGER` for counters and millisecond durations.
- `BOOLEAN` for `active`, `archived`, `is_duplicate`, `is_actionable`, and `applied_to_ranking`.

Minimum constraints:

- `users.email` must be `UNIQUE NOT NULL`.
- `services.name` must be `UNIQUE NOT NULL`.
- `severity` must be between 1 and 5.
- `score`, `utility`, and `confidence` must be between 0 and 1.
- `duration_ms`, `api_latency_ms`, `retry_count`, `error_count`, and `queue_delay_ms` must be greater than or equal to 0.
- Foreign keys must be defined for jobs, alerts, feedback, rules, thresholds, recommendations, and audit logs.
- Add indexes on common filters: `alert_events.status`, `alert_events.decision`, `alert_events.created_at`, `backend_jobs.service_id`, `alert_feedback.outcome`, and `suppression_rules.active`.

## 7. API Implementation Plan

Use `/api/v1` as the API prefix for the backend.

Each final API document should include:

- API name
- purpose
- HTTP method
- endpoint
- path parameters
- query parameters
- request body
- required fields
- optional fields
- successful status code
- successful response JSON
- possible error status codes
- error response JSON
- database tables affected

Use a consistent error response format:

```json
{
  "error": {
    "code": "SERVICE_NOT_FOUND",
    "message": "Service with id 999 was not found"
  }
}
```

Expected error categories:

- `400 Bad Request`
- `404 Not Found`
- `409 Conflict`
- `422 Validation Error`
- `500 Internal Server Error`

### Required Alert Decision Flow

The project should not only save manually submitted alert decisions. The backend must include a real deterministic alert decision flow that reads job data, applies simple scoring logic, creates an alert event, and returns explainability information.

Required core API:

#### POST `/api/v1/jobs/{job_id}/evaluate`

Purpose: evaluate a backend job and let the backend automatically create an alert decision.

The API should:

1. Read `backend_jobs`.
2. Read the job's related `services.criticality`.
3. Read active `threshold_configs`.
4. Check active `suppression_rules`.
5. Calculate alert score.
6. Decide `promote` or `suppress`.
7. Detect duplicate grouping when possible.
8. Create an `alert_events` record.
9. Return decision explanation and applied rules.

Sample request:

```json
{
  "strategy": "feedback"
}
```

Sample response:

```json
{
  "job_id": 21,
  "alert_created": true,
  "alert": {
    "id": 31,
    "severity": 4,
    "score": 0.87,
    "utility": 0.82,
    "decision": "promote",
    "confidence": 0.91,
    "decision_reason": [
      "Job exceeded timeout threshold",
      "Retry count was greater than configured threshold",
      "Service criticality is high"
    ],
    "applied_rules": [],
    "duplicate_group_key": null
  }
}
```

Assignment 2 does not require complex machine learning. Use a deterministic formula first:

```text
score =
  severity_weight
  + service_criticality_weight
  + retry_weight
  + timeout_weight
  + queue_delay_weight
  - historical_false_positive_penalty
```

This allows the video demo to show a real backend decision process:

1. Create a backend job.
2. Run the evaluate API.
3. Show that the backend generated the alert score, decision, and explanation.
4. Show the new `alert_events` row in PostgreSQL.

### Health and Setup

#### GET `/api/v1/health`

Purpose: confirm backend is running.

Sample response:

```json
{
  "status": "ok",
  "message": "Alert Triage Engine API is running"
}
```

#### POST `/api/v1/seed`

Purpose: insert sample data for demo and testing.

This API is development and demonstration only. It should be disabled in production. The preferred reset mechanism is a command-line script:

```text
python seed.py --reset
```

Sample response:

```json
{
  "message": "Seed data inserted",
  "services": 5,
  "jobs": 12,
  "alerts": 30
}
```

### Services

#### GET `/api/v1/services`

Purpose: list monitored backend services.

Sample response:

```json
[
  {
    "id": 1,
    "name": "payment-worker",
    "owner_team": "platform",
    "criticality": "high"
  }
]
```

#### POST `/api/v1/services`

Purpose: create a monitored service.

Sample request:

```json
{
  "name": "inventory-sync",
  "owner_team": "operations",
  "criticality": "medium",
  "description": "Nightly inventory synchronization workflow"
}
```

Sample response:

```json
{
  "id": 6,
  "name": "inventory-sync",
  "owner_team": "operations",
  "criticality": "medium"
}
```

### Backend Jobs

#### GET `/api/v1/jobs`

Purpose: list backend job executions.

Optional query filters:

- service_id
- status

Sample request:

```text
GET /api/v1/jobs?service_id=1&status=timeout
```

Sample response:

```json
{
  "items": [
    {
      "id": 21,
      "service_id": 1,
      "job_name": "payment-settlement",
      "worker_id": "worker-07",
      "status": "timeout",
      "duration_ms": 12400,
      "retry_count": 4,
      "created_at": "2026-07-26T14:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "page_size": 20,
    "total": 1
  }
}
```

#### POST `/api/v1/jobs`

Purpose: ingest a backend job execution record.

Sample request:

```json
{
  "service_id": 1,
  "job_name": "payment-settlement",
  "worker_id": "worker-07",
  "status": "timeout",
  "duration_ms": 12400,
  "api_latency_ms": 830,
  "retry_count": 4,
  "error_count": 2,
  "queue_delay_ms": 1800
}
```

Sample response:

```json
{
  "id": 21,
  "service_id": 1,
  "job_name": "payment-settlement",
  "status": "timeout"
}
```

### Alerts

#### GET `/api/v1/alerts`

Purpose: list alert events for Dashboard and Alerts pages.

Optional query filters:

- status
- service_id
- decision
- severity_min

Request body: none.

Sample request:

```text
GET /api/v1/alerts?status=open&service_id=1&decision=promote
```

Sample response:

```json
{
  "items": [
    {
      "id": 12,
      "job_id": 8,
      "service_id": 1,
      "service_name": "payment-worker",
      "severity": 4,
      "score": 0.87,
      "decision": "promote",
      "status": "open",
      "created_at": "2026-07-26T14:30:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "page_size": 20,
    "total": 1
  }
}
```

#### GET `/api/v1/alerts/{id}`

Purpose: get full details for one alert.

Sample response:

```json
{
  "id": 12,
  "service": "payment-worker",
  "job_id": 8,
  "severity": 4,
  "score": 0.87,
  "decision": "promote",
  "decision_reason": "High latency, repeated retries, and high service criticality",
  "confidence": 0.91,
  "status": "open",
  "is_duplicate": false,
  "is_actionable": true
}
```

#### POST `/api/v1/alerts`

Purpose: create an alert event manually for admin/testing only.

For the main business workflow, prefer `POST /api/v1/jobs/{job_id}/evaluate`, because that endpoint demonstrates backend scoring and alert decision logic.

Sample request:

```json
{
  "job_id": 21,
  "severity": 4,
  "score": 0.87,
  "utility": 0.82,
  "decision": "promote",
  "decision_reason": "Timeout and retry count exceeded baseline",
  "confidence": 0.91,
  "is_duplicate": false,
  "is_actionable": true
}
```

#### PATCH `/api/v1/alerts/{id}`

Purpose: partially update alert status or archive flag.

Sample request:

```json
{
  "status": "acknowledged"
}
```

Sample response:

```json
{
  "id": 12,
  "previous_status": "open",
  "status": "acknowledged",
  "message": "Alert updated"
}
```

Physical delete should not be a core business API for alerts because alerts are reliability and audit records. Use `status: closed` or `archived: true` instead.

Alternative archive request:

```json
{
  "archived": true
}
```

### Feedback

#### POST `/api/v1/alerts/{id}/feedback`

Purpose: submit human feedback for an alert and update related records in one database transaction.

This endpoint must be implemented as a transaction. The backend should:

1. Insert a row into `alert_feedback`.
2. Update `alert_events.status` if `operator_action` requires it.
3. Insert an `audit_logs` row.
4. Commit only if all steps succeed.
5. Roll back all changes if any step fails.

Sample request:

```json
{
  "user_id": 2,
  "outcome": "false_positive",
  "operator_action": "close",
  "note": "Known retry burst after scheduled maintenance",
  "applied_to_ranking": true
}
```

Sample response:

```json
{
  "feedback": {
    "id": 9,
    "alert_id": 12,
    "outcome": "false_positive",
    "operator_action": "close",
    "applied_to_ranking": true
  },
  "alert": {
    "id": 12,
    "previous_status": "open",
    "current_status": "closed"
  },
  "message": "Feedback submitted and alert status updated"
}
```

#### GET `/api/v1/feedback`

Purpose: list submitted feedback.

### Dashboard

#### GET `/api/v1/dashboard/summary`

Purpose: provide KPI cards for Dashboard.

Dashboard summary should be calculated in real time from `alert_events`, `alert_feedback`, and related tables. The Evaluation page should read historical experiment rows from `evaluation_runs`.

Metric formulas:

```text
false_positive_rate =
  false_positive_feedback_count / reviewed_alert_count

duplicate_alert_rate =
  duplicate_alert_count / total_alert_count

precision =
  true_positive_count / (true_positive_count + false_positive_count)

recall =
  true_actionable_surfaced_count / true_actionable_total_count

alert_reduction =
  1 - promoted_alert_count / baseline_candidate_count

actionability_rate =
  useful_or_real_incident_feedback_count / reviewed_alert_count

feedback_acceptance_rate =
  accepted_recommendation_feedback_count / reviewed_alert_count
```

Proposal metrics not fully required for Milestone 2:

- `mean_time_to_detect`
- `mean_time_to_acknowledge`
- `admin_approved_recommendation_rate`

These should be documented as final evaluation or later enhancement metrics if they are not implemented in Assignment 2.

Sample response:

```json
{
  "alert_reduction": 0.34,
  "false_positive_rate": 0.21,
  "duplicate_alert_rate": 0.18,
  "precision": 0.76,
  "recall": 0.89,
  "open_alerts": 14,
  "reviewed_alerts": 11
}
```

#### GET `/api/v1/dashboard/noise-breakdown`

Purpose: show how noise was reduced.

Sample response:

```json
{
  "duplicate_alerts_grouped": 8,
  "expected_maintenance_suppressed": 5,
  "transient_retry_noise_suppressed": 7,
  "low_severity_false_positives_suppressed": 4
}
```

### Suppression Rules

#### GET `/api/v1/suppression-rules`

Purpose: list suppression rules.

#### POST `/api/v1/suppression-rules`

Purpose: create a new suppression rule.

Sample request:

```json
{
  "service_id": 1,
  "rule_name": "Suppress retry bursts under maintenance window",
  "rule_type": "expected_maintenance",
  "condition_json": {
    "retry_count_gte": 3,
    "maintenance_window": true
  },
  "active": true,
  "created_by": 3
}
```

#### PATCH `/api/v1/suppression-rules/{id}`

Purpose: activate, deactivate, or update a rule.

### Threshold Configs

#### GET `/api/v1/threshold-configs`

Purpose: list threshold versions and active threshold settings.

#### POST `/api/v1/threshold-configs`

Purpose: create a new threshold version.

#### PATCH `/api/v1/threshold-configs/{id}`

Purpose: approve, deactivate, or update part of a threshold config.

### Recommendations

#### GET `/api/v1/recommendations`

Purpose: list pending, approved, and rejected adaptive recommendations.

#### PATCH `/api/v1/recommendations/{id}`

Purpose: approve or reject a recommendation.

### Evaluation

#### GET `/api/v1/evaluation/runs`

Purpose: list saved strategy comparison results.

#### POST `/api/v1/evaluation/runs`

Purpose: save one evaluation result.

Sample request:

```json
{
  "strategy": "feedback",
  "alerts_sent": 42,
  "false_positives": 9,
  "duplicate_rate": 0.13,
  "alert_reduction": 0.36,
  "precision": 0.79,
  "recall": 0.91,
  "mean_time_to_acknowledge": 142
}
```

### Audit Logs

#### GET `/api/v1/audit-logs`

Purpose: show system changes for admin review and demo evidence.

## 8. API Testing Plan

Use Postman, Swagger, curl, or a simple test script.

Each test case should record:

- test case ID
- API endpoint
- method
- input JSON
- expected result
- actual result
- HTTP status code
- pass/fail
- database evidence

Example format:

| Test ID | API | Method | Purpose | Expected Status | Result | Database Evidence |
| --- | --- | --- | --- | ---: | --- | --- |
| TC-001 | `/api/v1/health` | GET | Check API server | 200 | Pass | N/A |
| TC-002 | `/api/v1/services` | POST | Create service | 201 | Pass | New row in `services` |
| TC-003 | `/api/v1/jobs` | POST | Insert job execution | 201 | Pass | New row in `backend_jobs` |
| TC-004 | `/api/v1/jobs/{id}/evaluate` | POST | Evaluate job and generate alert | 201 | Pass | New row in `alert_events` with backend-generated score and decision |
| TC-005 | `/api/v1/alerts/{id}` | PATCH | Acknowledge alert | 200 | Pass | `alert_events.status` changed to `acknowledged` and audit row inserted |
| TC-006 | `/api/v1/alerts/{id}/feedback` | POST | Submit feedback transaction | 201 | Pass | New row in `alert_feedback`, alert status changed, audit row inserted |
| TC-007 | `/api/v1/dashboard/summary` | GET | Get KPI metrics | 200 | Pass | Aggregated from alerts and feedback |
| TC-008 | `/api/v1/suppression-rules` | POST | Create suppression rule | 201 | Pass | New row in `suppression_rules` |

## 9. Frontend Integration Plan

For this milestone, frontend integration can be staged.

### Phase 1: Backend-only demo

Use Postman or Swagger to demonstrate:

- API requests
- JSON responses
- database row changes

This is enough for Assignment 2.

### Phase 2: Partial frontend API connection

Connect only one or two frontend areas to the backend:

- Dashboard KPI summary
- Alert queue
- Feedback submission

This is optional for Assignment 2 but useful for the final project.

### Phase 3: Full frontend integration

Replace the synthetic frontend simulation with real API calls:

- Dashboard reads from `/api/v1/dashboard/summary` and `/api/v1/alerts`.
- Alerts page reads from `/api/v1/alerts`.
- Feedback form posts to `/api/v1/alerts/{id}/feedback`.
- Evaluation page reads from `/api/v1/evaluation/runs`.
- Admin page manages `/api/v1/suppression-rules`, `/api/v1/threshold-configs`, and `/api/v1/recommendations`.

## 10. Demo Video Script

Target length: 6-10 minutes.

### Suggested Flow

1. Introduce project goal.
   - "This project is a human-in-the-loop adaptive alert noise reduction system for backend reliability monitoring."

2. Show project architecture.
   - React frontend
   - Flask backend API
   - PostgreSQL database

3. Show database tables.
   - services
   - backend_jobs
   - alert_events
   - alert_feedback
   - suppression_rules
   - evaluation_runs
   - audit_logs

4. Show backend code.
   - app setup
   - models
   - schemas
   - routes
   - database connection

5. Run API tests.
   - health check
   - create service
   - create job
   - evaluate job and create backend-generated alert decision
   - update alert status
   - submit feedback transaction
   - get dashboard summary

6. After each write operation, show database evidence.
   - After POST service: show new service row.
   - After POST job: show new backend job row.
   - After POST job evaluation: show new alert row with generated score, decision, and reason.
   - After PATCH alert: show changed alert status and audit row.
   - After POST feedback: show new feedback row, changed alert status, and audit row from one transaction.

7. Discuss issues and resolutions.
   - Example: database connection string setup
   - Example: JSON validation
   - Example: table relationships
   - Example: ensuring alert feedback updates are persisted

8. Close with next steps.
   - connect frontend to backend APIs
   - load larger AIOps dataset later
   - expand admin workflow and evaluation reports

## 11. Implementation Order

Recommended execution sequence:

1. Create `backend` folder.
2. Create Flask application and health endpoint.
3. Configure PostgreSQL connection through `.env`.
4. Define SQLAlchemy models.
5. Create database tables.
6. Create seed data script.
7. Implement service and job APIs.
8. Implement deterministic alert scoring and `POST /api/v1/jobs/{id}/evaluate`.
9. Implement alert read and patch APIs.
10. Implement feedback transaction API.
11. Implement dashboard summary APIs with documented formulas.
12. Implement suppression rule APIs.
13. Implement threshold config APIs.
14. Implement evaluation APIs.
15. Implement audit log API.
16. Write API documentation.
17. Write database design documentation.
18. Write API test cases and test results.
19. Record video demo.
20. Push final code and docs to GitHub.

## 12. Minimum Viable Scope

If time is limited, the minimum passing backend should include:

- PostgreSQL database connection
- `services` table
- `backend_jobs` table
- `alert_events` table
- `alert_feedback` table
- `suppression_rules` table
- `threshold_configs` table
- `audit_logs` table
- `GET /api/v1/health`
- `GET /api/v1/services`
- `POST /api/v1/services`
- `GET /api/v1/jobs`
- `POST /api/v1/jobs`
- `POST /api/v1/jobs/{id}/evaluate`
- `GET /api/v1/alerts`
- `GET /api/v1/alerts/{id}`
- `PATCH /api/v1/alerts/{id}`
- `POST /api/v1/alerts/{id}/feedback`
- `GET /api/v1/feedback`
- `GET /api/v1/dashboard/summary`
- `GET /api/v1/dashboard/noise-breakdown`
- `GET /api/v1/suppression-rules`
- `POST /api/v1/suppression-rules`
- `PATCH /api/v1/suppression-rules/{id}`
- `GET /api/v1/threshold-configs`
- `POST /api/v1/threshold-configs`
- `PATCH /api/v1/threshold-configs/{id}`
- `GET /api/v1/evaluation/runs`
- `POST /api/v1/evaluation/runs`
- `GET /api/v1/audit-logs`
- documented API test results
- demo showing database changes after each write operation

This minimum scope directly supports the assignment rubric and aligns with the existing frontend design.

Recommended but optional for Milestone 2:

- `GET /api/v1/recommendations`
- `PATCH /api/v1/recommendations/{id}`

Can be deferred:

- full user authentication
- full user and role CRUD
- Celery background workers
- full AIOps dataset import
- complex machine learning model
- complete frontend integration
- Docker or cloud deployment

## 13. Later Enhancements

After Assignment 2, the following can be added:

- real AIOps 2020 and AIOps 2018 data import
- background scoring workers
- richer adaptive threshold recommendation engine
- full Admin page implementation
- frontend-to-backend API integration
- Docker Compose deployment
- final evaluation report with strategy comparison

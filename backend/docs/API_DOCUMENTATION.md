# API Documentation — Alert Triage Engine

Base URL: `http://localhost:5000/api/v1`

All responses follow the JSON format described below.

**Error format (consistent across all endpoints):**

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable description"
  }
}
```

---

## 1. Health

### `GET /api/v1/health`

Confirm the backend is running.

**Response 200:**

```json
{
  "status": "ok",
  "message": "Alert Triage Engine API is running"
}
```

---

## 2. Services

### `GET /api/v1/services`

List all monitored services.

**Response 200:**

```json
[
  {
    "id": 1,
    "name": "payment-worker",
    "owner_team": "platform",
    "criticality": "critical",
    "description": "Real-time payment processing worker",
    "created_at": "2026-07-26T12:00:00Z",
    "jobs_count": 3,
    "alerts_count": 3
  }
]
```

### `POST /api/v1/services`

Create a new monitored service.

**Request Body:**

```json
{
  "name": "inventory-sync",
  "owner_team": "operations",
  "criticality": "medium",
  "description": "Nightly inventory synchronization workflow"
}
```

**Response 201:**

```json
{
  "id": 6,
  "name": "inventory-sync",
  "owner_team": "operations",
  "criticality": "medium"
}
```

**Errors:** 422 (missing name), 409 (duplicate name)

### `GET /api/v1/services/{id}`

Get a single service by ID.

**Errors:** 404 if not found.

---

## 3. Backend Jobs

### `GET /api/v1/jobs`

List backend job executions.

**Query params:** `service_id`, `status`, `page`, `page_size`

**Response 200:**

```json
{
  "items": [
    {
      "id": 1,
      "service_id": 1,
      "service_name": "payment-worker",
      "job_name": "payment-settlement",
      "worker_id": "worker-01",
      "status": "timeout",
      "duration_ms": 12400,
      "retry_count": 4,
      "created_at": "2026-07-26T14:30:00Z"
    }
  ],
  "pagination": { "page": 1, "page_size": 20, "total": 1 }
}
```

### `POST /api/v1/jobs`

Ingest a backend job execution record.

**Request Body:**

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

**Response 201:**

```json
{
  "id": 21,
  "service_id": 1,
  "job_name": "payment-settlement",
  "status": "timeout"
}
```

### `POST /api/v1/jobs/{job_id}/evaluate`

**Core business API.** Evaluate a backend job and generate an alert decision.

Steps performed by the backend:
1. Read `backend_jobs` + `services.criticality`
2. Read active `threshold_configs`
3. Check active `suppression_rules`
4. Calculate deterministic alert score
5. Decide `promote` or `suppress`
6. Detect duplicate grouping
7. Create `alert_events` row
8. Return decision explanation + applied rules

**Request Body:**

```json
{
  "strategy": "feedback"
}
```

`strategy` options: `feedback`, `threshold`, `rules`

**Response 201:**

```json
{
  "job_id": 1,
  "alert_created": true,
  "alert": {
    "id": 1,
    "severity": 3,
    "score": 0.67,
    "utility": 0.58,
    "decision": "promote",
    "confidence": 0.19,
    "decision_reason": [
      "Job status is timeout",
      "Retry count (4) exceeded threshold",
      "Service criticality is critical"
    ],
    "applied_rules": [],
    "duplicate_group_key": null
  }
}
```

**Scoring formula (deterministic):**

```
score = severity_weight
      + service_criticality_weight
      + retry_weight (retry_count × 0.04, capped at 0.30)
      + timeout_weight (0.28/0.20/0.12 based on status)
      + queue_delay_weight (queue_delay / 20000, capped at 0.15)
      - historical_false_positive_penalty
```

---

## 4. Alerts

### `GET /api/v1/alerts`

List alert events.

**Query params:** `status`, `service_id`, `decision`, `severity_min`, `page`, `page_size`

**Response 200:**

```json
{
  "items": [
    {
      "id": 1,
      "job_id": 1,
      "service_id": 1,
      "service_name": "payment-worker",
      "severity": 3,
      "score": 0.67,
      "decision": "promote",
      "status": "open",
      "created_at": "2026-07-26T14:30:00Z"
    }
  ],
  "pagination": { "page": 1, "page_size": 20, "total": 1 }
}
```

### `GET /api/v1/alerts/{id}`

Get full alert detail including feedback history.

**Response 200:**

```json
{
  "id": 1,
  "service_name": "payment-worker",
  "job_id": 1,
  "severity": 3,
  "score": 0.67,
  "decision": "promote",
  "decision_reason": "Job status is timeout; Retry count (4) exceeded threshold; ...",
  "confidence": 0.1900,
  "status": "escalated",
  "is_duplicate": false,
  "is_actionable": true,
  "feedbacks": [
    {
      "id": 1,
      "outcome": "real_incident",
      "operator_action": "escalate",
      "reviewer_name": "Bob Martinez"
    }
  ]
}
```

### `POST /api/v1/alerts`

Manually create an alert (admin/testing only). Prefer `POST /api/v1/jobs/{id}/evaluate` for the business workflow.

**Request Body:**

```json
{
  "job_id": 1,
  "severity": 4,
  "score": 0.87,
  "utility": 0.82,
  "decision": "promote",
  "decision_reason": "Manual alert for testing",
  "confidence": 0.91,
  "is_duplicate": false,
  "is_actionable": true
}
```

### `PATCH /api/v1/alerts/{id}`

Partially update alert status or archive flag.

**Request Body:**

```json
{
  "user_id": 2,
  "status": "acknowledged"
}
```

or

```json
{
  "user_id": 2,
  "archived": true
}
```

**Response 200:**

```json
{
  "id": 1,
  "previous_status": "open",
  "status": "acknowledged",
  "message": "Alert updated"
}
```

**Database effects:**

- Updates `alert_events.status` or `alert_events.archived`.
- Inserts one row into `audit_logs`.
- `user_id` is required so the audit log has an actor.

---

## 5. Feedback

### `POST /api/v1/alerts/{alert_id}/feedback`

Submit human feedback for an alert. **Runs in a database transaction:**

1. Insert `alert_feedback` row
2. Update `alert_events.status` if `operator_action` requires it
3. Insert `audit_logs` row
4. All or nothing (rollback on failure)

**Request Body:**

```json
{
  "user_id": 2,
  "outcome": "false_positive",
  "operator_action": "close",
  "note": "Known retry burst after scheduled maintenance",
  "applied_to_ranking": true
}
```

**Response 201:**

```json
{
  "feedback": {
    "id": 1,
    "alert_id": 1,
    "outcome": "false_positive",
    "operator_action": "close",
    "applied_to_ranking": true
  },
  "alert": {
    "id": 1,
    "previous_status": "open",
    "current_status": "closed"
  },
  "message": "Feedback submitted and alert status updated"
}
```

### `GET /api/v1/feedback`

List all submitted feedback.

**Query params:** `page`, `page_size`

---

## 6. Dashboard

### `GET /api/v1/dashboard/summary`

Get KPI metrics computed from live database data.

**Response 200:**

```json
{
  "alert_reduction": 0.3333,
  "false_positive_rate": 0.2000,
  "duplicate_alert_rate": 0.0000,
  "precision": 0.7143,
  "recall": 0.7143,
  "open_alerts": 3,
  "reviewed_alerts": 10
}
```

### `GET /api/v1/dashboard/noise-breakdown`

Get noise reduction breakdown.

**Response 200:**

```json
{
  "duplicate_alerts_grouped": 0,
  "expected_maintenance_suppressed": 2,
  "transient_retry_noise_suppressed": 4,
  "low_severity_false_positives_suppressed": 0
}
```

---

## 7. Suppression Rules

### `GET /api/v1/suppression-rules`

List suppression rules. Query: `service_id`

### `POST /api/v1/suppression-rules`

Create a suppression rule.

**Request Body:**

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
  "created_by": 1
}
```

**Response 201:** Rule object with `id`.

### `PATCH /api/v1/suppression-rules/{id}`

Activate, deactivate, or update a rule.

**Request Body:**

```json
{
  "active": false
}
```

---

## 8. Threshold Configs

### `GET /api/v1/threshold-configs`

List threshold configs. Query: `service_id`

### `POST /api/v1/threshold-configs`

Create a threshold config version.

### `PATCH /api/v1/threshold-configs/{id}`

Approve, deactivate, or update threshold config.

---

## 9. Evaluation

### `GET /api/v1/evaluation/runs`

List evaluation runs. Query: `strategy`

### `POST /api/v1/evaluation/runs`

Save an evaluation result.

**Request Body:**

```json
{
  "strategy": "feedback",
  "alerts_sent": 35,
  "false_positives": 7,
  "duplicate_rate": 0.10,
  "alert_reduction": 0.36,
  "precision": 0.79,
  "recall": 0.91,
  "mean_time_to_acknowledge": 142
}
```

---

## 10. Recommendations

### `GET /api/v1/recommendations`

List recommendations. Query: `status`

### `PATCH /api/v1/recommendations/{id}`

Approve or reject a recommendation.

**Request Body:**

```json
{
  "status": "approved",
  "reviewed_by": 1
}
```

---

## 11. Audit Logs

### `GET /api/v1/audit-logs`

List audit log entries. Query: `user_id`, `entity_type`, `page`, `page_size`

**Response 200:**

```json
{
  "items": [
    {
      "id": 1,
      "user_id": 2,
      "actor_name": "Bob Martinez",
      "action": "feedback_close",
      "entity_type": "alert_event",
      "entity_id": 1,
      "before_json": { "status": "open" },
      "after_json": { "status": "closed", "outcome": "false_positive" },
      "created_at": "2026-07-26T14:30:00Z"
    }
  ],
  "pagination": { "page": 1, "page_size": 20, "total": 1 }
}
```

---

## Endpoint Summary

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/health` | Health check |
| GET | `/services` | List services |
| POST | `/services` | Create service |
| GET | `/services/{id}` | Get service detail |
| GET | `/jobs` | List jobs |
| POST | `/jobs` | Ingest job |
| POST | `/jobs/{id}/evaluate` | Evaluate job → alert |
| GET | `/alerts` | List alerts |
| GET | `/alerts/{id}` | Alert detail |
| POST | `/alerts` | Create alert (manual) |
| PATCH | `/alerts/{id}` | Update alert |
| POST | `/alerts/{id}/feedback` | Submit feedback (transaction) |
| GET | `/feedback` | List feedback |
| GET | `/dashboard/summary` | Dashboard KPIs |
| GET | `/dashboard/noise-breakdown` | Noise breakdown |
| GET | `/suppression-rules` | List rules |
| POST | `/suppression-rules` | Create rule |
| PATCH | `/suppression-rules/{id}` | Update rule |
| GET | `/threshold-configs` | List thresholds |
| POST | `/threshold-configs` | Create threshold |
| PATCH | `/threshold-configs/{id}` | Update threshold |
| GET | `/evaluation/runs` | List evaluations |
| POST | `/evaluation/runs` | Save evaluation |
| GET | `/recommendations` | List recommendations |
| PATCH | `/recommendations/{id}` | Approve/reject recommendation |
| GET | `/audit-logs` | List audit logs |

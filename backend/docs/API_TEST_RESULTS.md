# API Test Results

Test environment:

- OS: Windows 11
- Python: 3.13 virtual environment at `backend/venv`
- PostgreSQL: 18.4 local database
- Database: `capstone_alerting`
- API layer: Flask app `/api/v1` routes tested with Flask test client against real PostgreSQL
- Date: 2026-07-26

Before testing, the database was reset and seeded with:

```text
python seed.py --reset
```

Seed baseline:

| Table | Baseline Count |
| --- | ---: |
| users | 4 |
| services | 6 |
| backend_jobs | 15 |
| alert_events | 15 |
| alert_feedback | 10 |
| suppression_rules | 5 |
| threshold_configs | 5 |
| recommendations | 3 |
| evaluation_runs | 3 |
| audit_logs | 0 |

---

## Test Results Table

| Test ID | Endpoint | Method | Purpose | Expected | Actual | Status |
| --- | --- | --- | --- | ---: | ---: | --- |
| TC-001 | `/api/v1/health` | GET | Health check | 200 | 200 | Pass |
| TC-002 | `/api/v1/services` | POST | Create service | 201 | 201 | Pass |
| TC-003 | `/api/v1/services` | GET | List services | 200 | 200 | Pass |
| TC-004 | `/api/v1/jobs` | POST | Ingest job | 201 | 201 | Pass |
| TC-005 | `/api/v1/jobs?service_id=1&status=timeout` | GET | Filter jobs | 200 | 200 | Pass |
| TC-006 | `/api/v1/jobs/16/evaluate` | POST | Evaluate job and create backend-generated alert | 201 | 201 | Pass |
| TC-007 | `/api/v1/alerts/16` | GET | Alert detail | 200 | 200 | Pass |
| TC-008 | `/api/v1/alerts?status=open&decision=promote` | GET | Filter alerts | 200 | 200 | Pass |
| TC-009 | `/api/v1/alerts/16` | PATCH | Acknowledge alert | 200 | 200 | Pass |
| TC-010 | `/api/v1/alerts/16/feedback` | POST | Submit feedback transaction | 201 | 201 | Pass |
| TC-011 | `/api/v1/dashboard/summary` | GET | KPI summary | 200 | 200 | Pass |
| TC-012 | `/api/v1/dashboard/noise-breakdown` | GET | Noise breakdown | 200 | 200 | Pass |
| TC-013 | `/api/v1/suppression-rules` | POST | Create rule | 201 | 201 | Pass |
| TC-014 | `/api/v1/suppression-rules/6` | PATCH | Update rule | 200 | 200 | Pass |
| TC-015 | `/api/v1/threshold-configs` | GET | List thresholds | 200 | 200 | Pass |
| TC-016 | `/api/v1/threshold-configs` | POST | Create threshold | 201 | 201 | Pass |
| TC-017 | `/api/v1/evaluation/runs` | GET | List evaluations | 200 | 200 | Pass |
| TC-018 | `/api/v1/evaluation/runs` | POST | Save evaluation | 201 | 201 | Pass |
| TC-019 | `/api/v1/audit-logs` | GET | List audit logs | 200 | 200 | Pass |
| TC-020 | `/api/v1/recommendations` | GET | List recommendations | 200 | 200 | Pass |
| TC-021 | `/api/v1/recommendations/1` | PATCH | Approve recommendation | 200 | 200 | Pass |
| TC-022 | `/api/v1/services` | POST | Validation error for missing service name | 422 | 422 | Pass |
| TC-023 | `/api/v1/alerts/9999` | GET | Not found error | 404 | 404 | Pass |

---

## Database Evidence

| Operation | Database Evidence |
| --- | --- |
| `POST /api/v1/services` | `services` count changed from 6 to 7; created service id `7`. |
| `POST /api/v1/jobs` | `backend_jobs` count changed from 15 to 16; created job id `16`. |
| `POST /api/v1/jobs/16/evaluate` | `alert_events` count changed from 15 to 16; created alert id `16` with backend-generated decision `suppress` and score `0.9850`. |
| `PATCH /api/v1/alerts/16` | `alert_events.id=16` status changed from `open` to `acknowledged`; `audit_logs` count changed from 0 to 1. |
| `POST /api/v1/alerts/16/feedback` | `alert_feedback` count changed from 10 to 11; `alert_events.id=16` status changed from `acknowledged` to `closed`; `audit_logs` count changed from 1 to 2. |
| `GET /api/v1/dashboard/summary` | Returned database-computed metrics: `open_alerts=8`, `reviewed_alerts=11`, `precision=0.625`. |
| `POST /api/v1/suppression-rules` | `suppression_rules` count changed from 5 to 6; created rule id `6`. |
| `POST /api/v1/threshold-configs` | `threshold_configs` count changed from 5 to 6; created threshold config id `6`. |
| `POST /api/v1/evaluation/runs` | `evaluation_runs` count changed from 3 to 4; created evaluation run id `4`. |
| `PATCH /api/v1/recommendations/1` | `recommendations.id=1` status changed to `approved`; `reviewed_by=1`; `reviewed_at` was set. |

---

## Feedback Transaction Result

The feedback transaction test used:

```json
{
  "user_id": 2,
  "outcome": "false_positive",
  "operator_action": "close",
  "note": "Test feedback",
  "applied_to_ranking": true
}
```

One API call produced three database changes:

1. Inserted one row into `alert_feedback`.
2. Updated `alert_events.id=16` from `acknowledged` to `closed`.
3. Inserted one row into `audit_logs`.

This confirms that the feedback API supports the required human-in-the-loop workflow and records auditable state changes.

---

## Error Handling Results

| Test ID | Scenario | Expected | Actual | Result |
| --- | --- | ---: | ---: | --- |
| TC-022 | Missing required service `name` | 422 | 422 | Pass |
| TC-023 | Alert id `9999` does not exist | 404 | 404 | Pass |

Example validation error:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Service name is required"
  }
}
```

Example not found error:

```json
{
  "error": {
    "code": "ALERT_NOT_FOUND",
    "message": "Alert with id 9999 was not found"
  }
}
```

---

## Summary

All 23 planned API test cases passed against the local PostgreSQL database. The test sequence demonstrated service creation, job ingestion, backend-generated alert decision making, alert status updates, feedback transaction behavior, dashboard aggregation, rule/config/evaluation writes, recommendation approval, audit log retrieval, and error handling.

# API Test Cases

Test environment: Flask dev server → PostgreSQL → localhost:5000

---

## TC-001: Health Check

| Field | Value |
|-------|-------|
| **Test ID** | TC-001 |
| **Endpoint** | `GET /api/v1/health` |
| **Purpose** | Verify API server is running |
| **Request Body** | None |
| **Expected Status** | 200 |
| **Expected Response** | `{"status":"ok","message":"Alert Triage Engine API is running"}` |
| **Database Evidence** | N/A |

---

## TC-002: Create Service

| Field | Value |
|-------|-------|
| **Test ID** | TC-002 |
| **Endpoint** | `POST /api/v1/services` |
| **Purpose** | Create a new monitored service |
| **Request Body** | `{"name":"inventory-sync","owner_team":"operations","criticality":"medium","description":"Nightly inventory synchronization"}` |
| **Expected Status** | 201 |
| **Expected Response** | `{"id":7,"name":"inventory-sync","owner_team":"operations","criticality":"medium"}` |
| **Database Evidence** | New row in `services` table with id=7 |

---

## TC-003: List Services

| Field | Value |
|-------|-------|
| **Test ID** | TC-003 |
| **Endpoint** | `GET /api/v1/services` |
| **Purpose** | List all services |
| **Request Body** | None |
| **Expected Status** | 200 |
| **Expected Response** | JSON array with ≥1 service |
| **Database Evidence** | Matches `SELECT * FROM services` |

---

## TC-004: Create Job

| Field | Value |
|-------|-------|
| **Test ID** | TC-004 |
| **Endpoint** | `POST /api/v1/jobs` |
| **Purpose** | Ingest a backend job record |
| **Request Body** | `{"service_id":1,"job_name":"payment-settlement","worker_id":"worker-07","status":"timeout","duration_ms":12400,"api_latency_ms":830,"retry_count":4,"error_count":2,"queue_delay_ms":1800}` |
| **Expected Status** | 201 |
| **Expected Response** | `{"id":16,"service_id":1,"job_name":"payment-settlement","status":"timeout"}` |
| **Database Evidence** | New row in `backend_jobs` with id=16 |

---

## TC-005: List Jobs with filter

| Field | Value |
|-------|-------|
| **Test ID** | TC-005 |
| **Endpoint** | `GET /api/v1/jobs?service_id=1&status=timeout` |
| **Purpose** | Filter jobs by service and status |
| **Request Body** | None |
| **Expected Status** | 200 |
| **Expected Response** | `{"items":[...],"pagination":{"page":1,"page_size":20,"total":≥1}}` |
| **Database Evidence** | Matches filtered query |

---

## TC-006: Evaluate Job (Core API)

| Field | Value |
|-------|-------|
| **Test ID** | TC-006 |
| **Endpoint** | `POST /api/v1/jobs/16/evaluate` |
| **Purpose** | Evaluate a job and let backend generate alert decision |
| **Request Body** | `{"strategy":"feedback"}` |
| **Expected Status** | 201 |
| **Expected Response** | `{"job_id":16,"alert_created":true,"alert":{"id":...,"decision":"promote","decision_reason":[...],"score":...,"utility":...}}` |
| **Database Evidence** | New row in `alert_events` with backend-generated score, utility, decision, and reason |

---

## TC-007: Get Alert Detail

| Field | Value |
|-------|-------|
| **Test ID** | TC-007 |
| **Endpoint** | `GET /api/v1/alerts/1` |
| **Purpose** | Get full alert details with feedback |
| **Request Body** | None |
| **Expected Status** | 200 |
| **Expected Response** | Alert object with `feedbacks` array |
| **Database Evidence** | Matches `alert_events` + joined `alert_feedback` |

---

## TC-008: List Alerts with filter

| Field | Value |
|-------|-------|
| **Test ID** | TC-008 |
| **Endpoint** | `GET /api/v1/alerts?status=open&decision=promote` |
| **Purpose** | Filter alerts |
| **Request Body** | None |
| **Expected Status** | 200 |
| **Expected Response** | Filtered list |
| **Database Evidence** | Matches filtered query |

---

## TC-009: Patch Alert (acknowledge)

| Field | Value |
|-------|-------|
| **Test ID** | TC-009 |
| **Endpoint** | `PATCH /api/v1/alerts/5` |
| **Purpose** | Update alert status to acknowledged |
| **Request Body** | `{"status":"acknowledged"}` |
| **Expected Status** | 200 |
| **Expected Response** | `{"id":5,"previous_status":"open","status":"acknowledged","message":"Alert updated"}` |
| **Database Evidence** | `alert_events.status` changed to `acknowledged` for id=5 |

---

## TC-010: Submit Feedback (Transaction)

| Field | Value |
|-------|-------|
| **Test ID** | TC-010 |
| **Endpoint** | `POST /api/v1/alerts/3/feedback` |
| **Purpose** | Submit human feedback → creates feedback, updates alert, creates audit |
| **Request Body** | `{"user_id":2,"outcome":"false_positive","operator_action":"close","note":"Test feedback","applied_to_ranking":true}` |
| **Expected Status** | 201 |
| **Expected Response** | `{"feedback":{"id":...},"alert":{"id":3,"previous_status":"...","current_status":"closed"},"message":"Feedback submitted and alert status updated"}` |
| **Database Evidence** | ① New row in `alert_feedback` ② `alert_events.status` changed to `closed` ③ New row in `audit_logs` |

---

## TC-011: Dashboard Summary

| Field | Value |
|-------|-------|
| **Test ID** | TC-011 |
| **Endpoint** | `GET /api/v1/dashboard/summary` |
| **Purpose** | Get KPI metrics computed from database |
| **Request Body** | None |
| **Expected Status** | 200 |
| **Expected Response** | `{"alert_reduction":...,"false_positive_rate":...,"precision":...,"recall":...,"open_alerts":...,"reviewed_alerts":...}` |
| **Database Evidence** | Aggregated from `alert_events` and `alert_feedback` |

---

## TC-012: Dashboard Noise Breakdown

| Field | Value |
|-------|-------|
| **Test ID** | TC-012 |
| **Endpoint** | `GET /api/v1/dashboard/noise-breakdown` |
| **Purpose** | Noise reduction categories |
| **Request Body** | None |
| **Expected Status** | 200 |
| **Database Evidence** | Computed from suppressed alerts |

---

## TC-013: Create Suppression Rule

| Field | Value |
|-------|-------|
| **Test ID** | TC-013 |
| **Endpoint** | `POST /api/v1/suppression-rules` |
| **Purpose** | Create a suppression rule |
| **Request Body** | `{"service_id":1,"rule_name":"Test rule","rule_type":"transient_retry","condition_json":{"max_retry_count":1},"active":true,"created_by":1}` |
| **Expected Status** | 201 |
| **Database Evidence** | New row in `suppression_rules` |

---

## TC-014: Patch Suppression Rule

| Field | Value |
|-------|-------|
| **Test ID** | TC-014 |
| **Endpoint** | `PATCH /api/v1/suppression-rules/1` |
| **Purpose** | Deactivate a rule |
| **Request Body** | `{"active":false}` |
| **Expected Status** | 200 |
| **Database Evidence** | `suppression_rules.active` changed to `false` |

---

## TC-015: List Threshold Configs

| Field | Value |
|-------|-------|
| **Test ID** | TC-015 |
| **Endpoint** | `GET /api/v1/threshold-configs` |
| **Purpose** | List all threshold configurations |
| **Request Body** | None |
| **Expected Status** | 200 |
| **Database Evidence** | Matches `SELECT * FROM threshold_configs` |

---

## TC-016: Create Threshold Config

| Field | Value |
|-------|-------|
| **Test ID** | TC-016 |
| **Endpoint** | `POST /api/v1/threshold-configs` |
| **Purpose** | Create a threshold config |
| **Request Body** | `{"service_id":1,"metric_name":"score","threshold_value":0.5,"strategy":"threshold","version":"v1.1","status":"active","active":true}` |
| **Expected Status** | 201 |
| **Database Evidence** | New row in `threshold_configs` |

---

## TC-017: List Evaluation Runs

| Field | Value |
|-------|-------|
| **Test ID** | TC-017 |
| **Endpoint** | `GET /api/v1/evaluation/runs` |
| **Purpose** | List evaluation comparison results |
| **Request Body** | None |
| **Expected Status** | 200 |
| **Database Evidence** | Matches `SELECT * FROM evaluation_runs` |

---

## TC-018: Save Evaluation Run

| Field | Value |
|-------|-------|
| **Test ID** | TC-018 |
| **Endpoint** | `POST /api/v1/evaluation/runs` |
| **Purpose** | Save one evaluation result |
| **Request Body** | `{"strategy":"feedback","alerts_sent":35,"false_positives":7,"duplicate_rate":0.10,"alert_reduction":0.36,"precision":0.79,"recall":0.91,"mean_time_to_acknowledge":142}` |
| **Expected Status** | 201 |
| **Database Evidence** | New row in `evaluation_runs` |

---

## TC-019: List Audit Logs

| Field | Value |
|-------|-------|
| **Test ID** | TC-019 |
| **Endpoint** | `GET /api/v1/audit-logs` |
| **Purpose** | List audit log entries |
| **Request Body** | None |
| **Expected Status** | 200 |
| **Database Evidence** | Matches `SELECT * FROM audit_logs` |

---

## TC-020: List Recommendations

| Field | Value |
|-------|-------|
| **Test ID** | TC-020 |
| **Endpoint** | `GET /api/v1/recommendations` |
| **Purpose** | List pending recommendations |
| **Request Body** | None |
| **Expected Status** | 200 |
| **Database Evidence** | Matches `SELECT * FROM recommendations` |

---

## TC-021: Approve Recommendation

| Field | Value |
|-------|-------|
| **Test ID** | TC-021 |
| **Endpoint** | `PATCH /api/v1/recommendations/1` |
| **Purpose** | Approve a recommendation |
| **Request Body** | `{"status":"approved","reviewed_by":1}` |
| **Expected Status** | 200 |
| **Database Evidence** | `recommendations.status` changed to `approved`, `reviewed_at` set |

---

## TC-022: Validation Error — Missing Name

| Field | Value |
|-------|-------|
| **Test ID** | TC-022 |
| **Endpoint** | `POST /api/v1/services` |
| **Purpose** | Verify validation error response |
| **Request Body** | `{"owner_team":"platform"}` |
| **Expected Status** | 422 |
| **Expected Response** | `{"error":{"code":"VALIDATION_ERROR","message":"Service name is required"}}` |

---

## TC-023: Not Found Error

| Field | Value |
|-------|-------|
| **Test ID** | TC-023 |
| **Endpoint** | `GET /api/v1/alerts/9999` |
| **Purpose** | Verify 404 error response |
| **Request Body** | None |
| **Expected Status** | 404 |
| **Expected Response** | `{"error":{"code":"ALERT_NOT_FOUND","message":"Alert with id 9999 was not found"}}` |

---

## Test Result Summary

| Test ID | Endpoint | Method | Purpose | Expected | Result |
|---------|----------|--------|---------|----------|--------|
| TC-001 | /health | GET | Health check | 200 | |
| TC-002 | /services | POST | Create service | 201 | |
| TC-003 | /services | GET | List services | 200 | |
| TC-004 | /jobs | POST | Ingest job | 201 | |
| TC-005 | /jobs | GET | Filter jobs | 200 | |
| TC-006 | /jobs/{id}/evaluate | POST | Evaluate job | 201 | |
| TC-007 | /alerts/{id} | GET | Alert detail | 200 | |
| TC-008 | /alerts | GET | Filter alerts | 200 | |
| TC-009 | /alerts/{id} | PATCH | Acknowledge alert | 200 | |
| TC-010 | /alerts/{id}/feedback | POST | Submit feedback tx | 201 | |
| TC-011 | /dashboard/summary | GET | KPI summary | 200 | |
| TC-012 | /dashboard/noise-breakdown | GET | Noise breakdown | 200 | |
| TC-013 | /suppression-rules | POST | Create rule | 201 | |
| TC-014 | /suppression-rules/{id} | PATCH | Update rule | 200 | |
| TC-015 | /threshold-configs | GET | List thresholds | 200 | |
| TC-016 | /threshold-configs | POST | Create threshold | 201 | |
| TC-017 | /evaluation/runs | GET | List evaluations | 200 | |
| TC-018 | /evaluation/runs | POST | Save evaluation | 201 | |
| TC-019 | /audit-logs | GET | List audit logs | 200 | |
| TC-020 | /recommendations | GET | List recommendations | 200 | |
| TC-021 | /recommendations/{id} | PATCH | Approve rec | 200 | |
| TC-022 | /services | POST | Validation error | 422 | |
| TC-023 | /alerts/9999 | GET | Not found error | 404 | |

# Database Design

## Overview

The **Alert Triage Engine** uses PostgreSQL with the following ten tables to support backend reliability monitoring, human-in-the-loop feedback, and adaptive alert noise reduction.

---

## Entity-Relationship Summary

```
users ──1:N──> alert_feedback
users ──1:N──> suppression_rules
users ──1:N──> threshold_configs (recommended_by / approved_by)
users ──1:N──> recommendations (reviewed_by)
users ──1:N──> audit_logs

services ──1:N──> backend_jobs
services ──1:N──> suppression_rules
services ──1:N──> threshold_configs
services ──1:N──> recommendations

backend_jobs ──1:N──> alert_events

alert_events ──1:N──> alert_feedback
alert_events ──1:N──> audit_logs
alert_events ──1:N──> alert_events (self-ref: duplicate_of_alert_id)
```

> **Design note:** `alert_events` does not store `service_id` directly. Instead, `alert_events.job_id → backend_jobs.service_id` is used to prevent service mismatch (an alert pointing to job 21 while the alert's service field points to another service).

---

## Table Details

### 1. users

Stores reviewers, SREs, and admins.

| Column | Type | Constraints |
|--------|------|-------------|
| id | INTEGER | PK, auto-increment |
| name | VARCHAR(120) | NOT NULL |
| email | VARCHAR(255) | UNIQUE NOT NULL |
| role | VARCHAR(20) | NOT NULL, default 'operator' |
| created_at | TIMESTAMPTZ | NOT NULL, default now() |

**Roles:** `operator`, `sre`, `admin`

---

### 2. services

Stores monitored backend services/workflows.

| Column | Type | Constraints |
|--------|------|-------------|
| id | INTEGER | PK |
| name | VARCHAR(180) | UNIQUE NOT NULL |
| owner_team | VARCHAR(120) | NOT NULL, default 'platform' |
| criticality | VARCHAR(20) | NOT NULL, default 'medium' |
| description | TEXT | |
| created_at | TIMESTAMPTZ | NOT NULL |

**Criticality:** `low`, `medium`, `high`, `critical`

---

### 3. backend_jobs

Stores backend job execution records.

| Column | Type | Constraints |
|--------|------|-------------|
| id | INTEGER | PK |
| service_id | INTEGER | FK → services.id, NOT NULL, INDEX |
| job_name | VARCHAR(200) | NOT NULL |
| worker_id | VARCHAR(100) | NOT NULL |
| status | VARCHAR(30) | NOT NULL |
| duration_ms | INTEGER | NOT NULL, CHECK ≥ 0 |
| api_latency_ms | INTEGER | NOT NULL, CHECK ≥ 0 |
| retry_count | INTEGER | NOT NULL, CHECK ≥ 0 |
| error_count | INTEGER | NOT NULL, CHECK ≥ 0 |
| queue_delay_ms | INTEGER | NOT NULL, CHECK ≥ 0 |
| processed_count | INTEGER | NOT NULL |
| failed_count | INTEGER | NOT NULL |
| timeout_count | INTEGER | NOT NULL |
| throughput_per_minute | INTEGER | NOT NULL |
| started_at | TIMESTAMPTZ | |
| completed_at | TIMESTAMPTZ | |
| created_at | TIMESTAMPTZ | NOT NULL |

**Statuses:** `completed`, `failed`, `completed_with_failures`, `timeout`

---

### 4. alert_events

Stores alert candidates and final decisions.

| Column | Type | Constraints |
|--------|------|-------------|
| id | INTEGER | PK |
| job_id | INTEGER | FK → backend_jobs.id, NOT NULL, INDEX |
| severity | INTEGER | NOT NULL, CHECK 1–5 |
| score | NUMERIC(5,4) | NOT NULL, CHECK 0–1 |
| utility | NUMERIC(5,4) | NOT NULL, CHECK 0–1 |
| decision | VARCHAR(10) | NOT NULL ('promote'/'suppress'), INDEX |
| decision_reason | TEXT | |
| applied_rules_json | JSONB | |
| confidence | NUMERIC(5,4) | NOT NULL, CHECK 0–1 |
| status | VARCHAR(20) | NOT NULL, default 'open', INDEX |
| is_duplicate | BOOLEAN | NOT NULL |
| duplicate_of_alert_id | INTEGER | FK → alert_events.id |
| duplicate_group_key | VARCHAR(120) | |
| is_actionable | BOOLEAN | NOT NULL |
| archived | BOOLEAN | NOT NULL, default false |
| created_at | TIMESTAMPTZ | NOT NULL, INDEX |
| acknowledged_at | TIMESTAMPTZ | |

**Decisions:** `promote`, `suppress`
**Statuses:** `open`, `acknowledged`, `escalated`, `closed`

---

### 5. alert_feedback

Stores human-in-the-loop review labels.

| Column | Type | Constraints |
|--------|------|-------------|
| id | INTEGER | PK |
| alert_id | INTEGER | FK → alert_events.id, NOT NULL, INDEX |
| user_id | INTEGER | FK → users.id, NOT NULL |
| outcome | VARCHAR(30) | NOT NULL, INDEX |
| operator_action | VARCHAR(20) | NOT NULL |
| note | TEXT | |
| applied_to_ranking | BOOLEAN | NOT NULL, default false |
| created_at | TIMESTAMPTZ | NOT NULL |

**Outcomes:** `real_incident`, `useful`, `false_positive`, `duplicate`, `expected_behavior`, `noisy`, `needs_more_information`

**Operator actions:** `confirm`, `escalate`, `close`

---

### 6. suppression_rules

Stores admin-created suppression/deduplication rules.

| Column | Type | Constraints |
|--------|------|-------------|
| id | INTEGER | PK |
| service_id | INTEGER | FK → services.id, NOT NULL, INDEX |
| rule_name | VARCHAR(200) | NOT NULL |
| rule_type | VARCHAR(40) | NOT NULL |
| condition_json | JSONB | NOT NULL |
| active | BOOLEAN | NOT NULL, default true, INDEX |
| created_by | INTEGER | FK → users.id, NOT NULL |
| created_at | TIMESTAMPTZ | NOT NULL |

**Rule types:** `duplicate_grouping`, `expected_maintenance`, `transient_retry`, `low_severity_noise`

---

### 7. threshold_configs

Stores threshold settings for alert scoring.

| Column | Type | Constraints |
|--------|------|-------------|
| id | INTEGER | PK |
| service_id | INTEGER | FK → services.id, NOT NULL, INDEX |
| metric_name | VARCHAR(120) | NOT NULL |
| threshold_value | NUMERIC(8,4) | NOT NULL |
| strategy | VARCHAR(20) | NOT NULL, default 'threshold' |
| version | VARCHAR(40) | NOT NULL |
| status | VARCHAR(20) | NOT NULL |
| active | BOOLEAN | NOT NULL |
| recommended_by | INTEGER | FK → users.id |
| approved_by | INTEGER | FK → users.id |
| effective_from | TIMESTAMPTZ | |
| effective_to | TIMESTAMPTZ | |
| created_at | TIMESTAMPTZ | NOT NULL |
| updated_at | TIMESTAMPTZ | NOT NULL |

**Strategies:** `threshold`, `rules`, `feedback`

---

### 8. recommendations

Stores adaptive threshold/suppression recommendations for admin review.

| Column | Type | Constraints |
|--------|------|-------------|
| id | INTEGER | PK |
| service_id | INTEGER | FK → services.id, NOT NULL, INDEX |
| recommendation_type | VARCHAR(40) | NOT NULL |
| current_value_json | JSONB | NOT NULL |
| recommended_value_json | JSONB | NOT NULL |
| reason | TEXT | |
| confidence | NUMERIC(5,4) | NOT NULL, CHECK 0–1 |
| status | VARCHAR(20) | NOT NULL, default 'pending' |
| reviewed_by | INTEGER | FK → users.id |
| created_at | TIMESTAMPTZ | NOT NULL |
| reviewed_at | TIMESTAMPTZ | |

**Statuses:** `pending`, `approved`, `rejected`

---

### 9. evaluation_runs

Stores strategy comparison results.

| Column | Type | Constraints |
|--------|------|-------------|
| id | INTEGER | PK |
| strategy | VARCHAR(20) | NOT NULL |
| alerts_sent | INTEGER | NOT NULL |
| false_positives | INTEGER | NOT NULL |
| duplicate_rate | NUMERIC(5,4) | NOT NULL |
| alert_reduction | NUMERIC(5,4) | NOT NULL |
| precision | NUMERIC(5,4) | NOT NULL |
| recall | NUMERIC(5,4) | NOT NULL |
| mean_time_to_acknowledge | INTEGER | NOT NULL |
| created_at | TIMESTAMPTZ | NOT NULL |

---

### 10. audit_logs

Stores admin and operator action history.

| Column | Type | Constraints |
|--------|------|-------------|
| id | INTEGER | PK |
| user_id | INTEGER | FK → users.id, NOT NULL, INDEX |
| action | VARCHAR(80) | NOT NULL |
| entity_type | VARCHAR(40) | NOT NULL |
| entity_id | INTEGER | NOT NULL |
| before_json | JSONB | |
| after_json | JSONB | |
| created_at | TIMESTAMPTZ | NOT NULL, INDEX |

---

## Indexes

| Table | Index |
|-------|-------|
| alert_events | status, decision, created_at |
| backend_jobs | service_id |
| alert_feedback | outcome |
| suppression_rules | active |

## Check Constraints

| Table | Constraint |
|-------|-----------|
| alert_events | severity ∈ [1,5]; score, utility, confidence ∈ [0,1] |
| backend_jobs | duration_ms, api_latency_ms, retry_count, error_count, queue_delay_ms ≥ 0 |
| users | email UNIQUE |
| services | name UNIQUE |

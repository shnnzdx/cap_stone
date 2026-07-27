# Oral Presentation Script

## 1. Introduction

Hi everyone. Today, I’m going to demonstrate my Module 5 Capstone Project Management Assignment 2.

My capstone project is called **Human-in-the-Loop Adaptive Alert Noise Reduction System for Backend Reliability Monitoring**.

The main purpose of this project is to reduce unnecessary backend monitoring alerts. These can include false positives, duplicate alerts, expected maintenance alerts, and temporary retry errors.

At the same time, the system needs to make sure that real reliability incidents are still visible and are not accidentally suppressed.

For this milestone, I focused mainly on the backend part of the project.

I developed a Flask REST API and connected it to a local PostgreSQL database. The backend supports monitored services, backend jobs, alert evaluation, alert review, human feedback, suppression rules, threshold settings, evaluation results, recommendations, and audit logs.

In this presentation, I’ll first explain the system architecture and database design. Then I’ll demonstrate the main API workflow and briefly discuss my testing results, development issues, and next steps.

---

## 2. System Architecture

Let me start with a quick overview of the system architecture.

The system has three main layers.

The first layer is the frontend.

The frontend is a React prototype for the Alert Triage Engine. It includes pages for the Dashboard, Alerts, Evaluation, and Admin workflows.

The second layer is the backend API, which is the main focus of this assignment.

I built the backend using Python, Flask, Flask-SQLAlchemy, and Flask-Marshmallow.

The third layer is the PostgreSQL database.

The database stores all persistent project data, including services, jobs, alerts, feedback, suppression rules, threshold configurations, recommendations, evaluation runs, and audit logs.

One important point is that this backend is not just a basic CRUD API.

It includes an actual alert decision workflow.

The backend can read a backend job, evaluate the job information, calculate an alert score, decide whether the alert should be promoted or suppressed, and save the result to the database.

This means the main alert decision is made by the backend instead of being manually provided by the frontend.

---

## 3. Database Design

Next, I’ll briefly explain the database.

I created a local PostgreSQL database called `capstone_alerting`.

The database contains several main tables.

These include:

* `users`
* `services`
* `backend_jobs`
* `alert_events`
* `alert_feedback`
* `suppression_rules`
* `threshold_configs`
* `recommendations`
* `evaluation_runs`
* `audit_logs`

The main relationship begins with a monitored service.

One service can have multiple backend jobs. Each backend job can generate one or more alert events, and each alert event can receive human feedback.

Important changes, such as alert status updates and feedback submissions, are also recorded in the audit log.

I included suppression rules and threshold configurations because the original project proposal requires the system to support rule-based suppression, fixed thresholds, and adaptive scoring based on human feedback.

Before testing the system, I reset and seeded the database with this command:

[Show command on screen]

`python seed.py --reset`

This command clears the existing sample data and creates a new set of test records.

After running the seed script, the database contains sample users, services, backend jobs, alert events, feedback records, suppression rules, threshold configurations, recommendations, and evaluation results.

This gives me consistent and reproducible data for the API demonstration.

---

## 4. API Overview

Now I’ll move on to the API.

All API endpoints use the `/api/v1` prefix.

Some of the main endpoints include:

* `GET /api/v1/health`
* `GET /api/v1/services`
* `POST /api/v1/services`
* `GET /api/v1/jobs`
* `POST /api/v1/jobs`
* `POST /api/v1/jobs/{job_id}/evaluate`
* `GET /api/v1/alerts`
* `PATCH /api/v1/alerts/{alert_id}`
* `POST /api/v1/alerts/{alert_id}/feedback`
* `GET /api/v1/dashboard/summary`
* `GET /api/v1/audit-logs`

The most important endpoint in this project is the job evaluation endpoint:

[Show endpoint on screen]

`POST /api/v1/jobs/{job_id}/evaluate`

This endpoint demonstrates the main backend logic.

The frontend does not send a final score or tell the backend whether the alert should be promoted or suppressed.

Instead, the backend reads the job data, checks the service criticality, checks the suppression rules, calculates an alert score, and makes the final promote-or-suppress decision.

It then creates and saves a new alert event in PostgreSQL.

---

## 5. Live Demonstration

Now I’ll demonstrate the main backend workflow.

### Step 1: Check the API health

First, I’ll call the health endpoint:

[Run request]

`GET /api/v1/health`

This confirms that the Flask application is running and that the API is available.

### Step 2: Review the database

Next, I’ll show some of the seeded tables in PostgreSQL.

For example, we can see that the database already contains monitored services, backend jobs, alert events, human feedback, suppression rules, and other supporting records.

### Step 3: Create a backend job

Next, I’ll create a new backend job using:

[Run request]

`POST /api/v1/jobs`

The request contains information about the service and the job, such as its status, duration, retry count, and error information.

After the request is completed, a new row is inserted into the `backend_jobs` table.

### Step 4: Evaluate the job

After creating the job, I’ll evaluate it using:

[Run request]

`POST /api/v1/jobs/{job_id}/evaluate`

This is the core workflow of the backend.

The backend retrieves the job information, calculates an alert score, and decides whether the alert should be promoted or suppressed.

It then creates a new row in the `alert_events` table.

The API response also shows the calculated score and the final decision.

### Step 5: Update the alert status

Next, I’ll update the alert using:

[Run request]

`PATCH /api/v1/alerts/{alert_id}`

For example, I can change the alert status from `open` to `acknowledged`.

When this happens, the backend also creates an audit log record.

This means the status change is traceable, and we can see when the change happened and what action was performed.

### Step 6: Submit human feedback

Finally, I’ll submit human feedback using:

[Run request]

`POST /api/v1/alerts/{alert_id}/feedback`

This endpoint represents the human-in-the-loop part of the project.

A user can review an alert and label it as useful, a real incident, a false positive, a duplicate, or another feedback category supported by the system.

This workflow is implemented as a database transaction.

In a single API request, the backend inserts a new feedback record, updates the alert status, and creates an audit log record.

If any part of this process fails, the entire transaction is rolled back.

This prevents the database from being left in an inconsistent state.

---

## 6. Dashboard Metrics

The backend also provides summary metrics for the dashboard.

The endpoint is:

[Show endpoint]

`GET /api/v1/dashboard/summary`

This endpoint calculates several metrics directly from the database.

These include:

* alert reduction
* false-positive rate
* duplicate-alert rate
* precision
* recall
* the number of open alerts
* the number of reviewed alerts

For example, the false-positive rate is calculated using the human feedback labels.

Precision is calculated by comparing alerts identified as useful or real incidents with alerts identified as false positives.

For this milestone, the dashboard summary is calculated in real time using the current database records.

The Evaluation page uses previously saved results from the `evaluation_runs` table.

---

## 7. API Testing

After completing the backend, I tested 23 API cases against the local PostgreSQL database.

All 23 test cases passed.

The tests covered the major parts of the system, including:

* the health check
* service creation and listing
* backend job creation and filtering
* backend job evaluation
* alert details and filtering
* alert status updates
* the feedback transaction
* dashboard summaries
* noise breakdown results
* suppression rules
* threshold configurations
* evaluation runs
* audit logs
* recommendations
* validation errors
* not-found errors

The most important test was the human feedback transaction test.

In that test, one API request created a new row in the `alert_feedback` table, changed the alert status to `closed`, and inserted a new row into the `audit_logs` table.

This confirms that the complete feedback workflow updates the database correctly.

It also confirms that the transaction keeps the related database changes consistent.

---

## 8. Development Issues and Solutions

During development, I ran into several issues.

The first issue was related to the `.env` file.

The seed script was not loading the environment variables correctly, so it tried to connect to PostgreSQL using the default database password.

I fixed this by loading the `.env` file inside the Flask application factory.

Now both `run.py` and `seed.py` use the same database configuration.

The second issue was related to the Windows terminal.

The terminal could not display some emoji characters used by the seed script.

I fixed this by replacing the emoji output with plain ASCII text.

The third issue was a dependency conflict between Flask-Marshmallow and Marshmallow.

The installed Marshmallow version was too new and was not fully compatible with the other dependencies.

I resolved this by pinning Marshmallow to version `3.23.3`.

The fourth issue involved the database timestamp fields.

I updated the models to use `db.DateTime(timezone=True)` instead of a nonstandard timestamp type.

This made the models more reliable when working with Flask-SQLAlchemy and PostgreSQL.

I also improved the alert update and feedback workflows so that important state changes are automatically recorded in the audit log.

---

## 9. Current Project Status

At this point, the backend API is working correctly with PostgreSQL.

The database has been created and seeded with sample data.

The main alert evaluation and human feedback workflows are implemented.

All 23 API test cases have passed.

The project also includes documentation for the API design, database design, test cases, test results, and the backend demonstration.

The React frontend prototype is already available.

However, for this milestone, the main grading focus is the backend API and its integration with the PostgreSQL database.

---

## 10. Next Steps

The next step is to connect more of the React frontend to the backend API.

For example, the Dashboard page can retrieve data from the dashboard summary endpoint.

The Alerts page can use the alert listing, status update, and feedback endpoints.

The Evaluation page can retrieve saved results from the evaluation runs endpoint.

In a later stage, I can also use larger datasets, such as the AIOps 2020 or AIOps 2018 datasets, to perform a more realistic evaluation.

For this milestone, I used seeded sample data because it makes the API and database behavior easier to test, demonstrate, and reproduce.

That completes my backend solution demonstration for Assignment 2.

Thank you.

# Demo Video Script (6-10 minutes)

## Outline

### 1. Introduction (30 sec)
- Project: Human-in-the-Loop Adaptive Alert Noise Reduction System
- Stack: React frontend → Flask REST API → PostgreSQL

### 2. Architecture Overview (1 min)
- Show project folder structure
- Explain: backend/app → models, routes, services, schemas
- `python run.py` to start Flask server
- `GET /api/v1/health` to verify

### 3. Database Tables (2 min)
- Open pgAdmin / psql
- Show `\dt` → all 10 tables
- Walk through each table with `\d table_name`
- Key relationships: services → jobs → alerts → feedback

### 4. Seed Data (1 min)
- Run `python seed.py --reset`
- Show row counts for all tables

### 5. API Walkthrough (3-4 min)

#### Write Operations (with database evidence after each):

1. **POST /services** → new service row
2. **POST /jobs** → new backend_jobs row
3. **POST /jobs/{id}/evaluate** → new alert_events row (backend-generated score, decision, reason)
4. **PATCH /alerts/{id}** → alert status changed
5. **POST /alerts/{id}/feedback** → 3 changes in 1 transaction:
   - new alert_feedback row
   - alert_events.status updated
   - new audit_logs row

#### Read Operations:
6. **GET /services**, **GET /jobs**, **GET /alerts** → filtered lists
7. **GET /dashboard/summary** → real-time KPI metrics
8. **GET /dashboard/noise-breakdown** → noise categories

### 6. Code Walkthrough (1 min)
- `alert_scoring.py` → deterministic formula
- `suppression_engine.py` → rule checking
- `routes/alerts.py` → feedback transaction with rollback

### 7. Issues & Resolutions (30 sec)
- Database connection setup → `.env` + `python-dotenv`
- JSON column type → `db.JSON` (not `db.JSONB`)
- Circular imports → factory pattern with `create_app()`
- Transaction integrity → try/except with `db.session.rollback()`

### 8. Next Steps (30 sec)
- Connect frontend to backend APIs
- Load larger AIOps 2020 dataset
- Expand admin workflow
- Deploy with Docker Compose

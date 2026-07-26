# API Test Results

Test environment:
- OS: Windows 11
- Python: 3.12
- PostgreSQL: 16
- Flask dev server: localhost:5000
- Date: TBD

---

## Test Results Table

| Test ID | Endpoint | Method | Purpose | Expected | Actual | Status |
|---------|----------|--------|---------|----------|--------|--------|
| TC-001 | /health | GET | Health check | 200 | | ⬜ |
| TC-002 | /services | POST | Create service | 201 | | ⬜ |
| TC-003 | /services | GET | List services | 200 | | ⬜ |
| TC-004 | /jobs | POST | Ingest job | 201 | | ⬜ |
| TC-005 | /jobs | GET | Filter jobs | 200 | | ⬜ |
| TC-006 | /jobs/{id}/evaluate | POST | Evaluate job | 201 | | ⬜ |
| TC-007 | /alerts/{id} | GET | Alert detail | 200 | | ⬜ |
| TC-008 | /alerts | GET | Filter alerts | 200 | | ⬜ |
| TC-009 | /alerts/{id} | PATCH | Acknowledge alert | 200 | | ⬜ |
| TC-010 | /alerts/{id}/feedback | POST | Submit feedback tx | 201 | | ⬜ |
| TC-011 | /dashboard/summary | GET | KPI summary | 200 | | ⬜ |
| TC-012 | /dashboard/noise-breakdown | GET | Noise breakdown | 200 | | ⬜ |
| TC-013 | /suppression-rules | POST | Create rule | 201 | | ⬜ |
| TC-014 | /suppression-rules/{id} | PATCH | Update rule | 200 | | ⬜ |
| TC-015 | /threshold-configs | GET | List thresholds | 200 | | ⬜ |
| TC-016 | /threshold-configs | POST | Create threshold | 201 | | ⬜ |
| TC-017 | /evaluation/runs | GET | List evaluations | 200 | | ⬜ |
| TC-018 | /evaluation/runs | POST | Save evaluation | 201 | | ⬜ |
| TC-019 | /audit-logs | GET | List audit logs | 200 | | ⬜ |
| TC-020 | /recommendations | GET | List recommendations | 200 | | ⬜ |
| TC-021 | /recommendations/{id} | PATCH | Approve rec | 200 | | ⬜ |
| TC-022 | /services | POST | Validation error | 422 | | ⬜ |
| TC-023 | /alerts/9999 | GET | Not found error | 404 | | ⬜ |

---

## Database Evidence Screenshots

| Operation | Before | After |
|-----------|--------|-------|
| POST /services | | |
| POST /jobs | | |
| POST /jobs/{id}/evaluate | | |
| PATCH /alerts/{id} | | |
| POST /alerts/{id}/feedback | | |

---

## Notes

- Fill in the "Actual" and "Status" columns after running tests.
- For each DB write operation, take a screenshot of the relevant table showing the before/after state.
- The feedback transaction (TC-010) should show 3 DB changes from one API call.

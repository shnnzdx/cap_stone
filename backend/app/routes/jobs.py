"""Backend job ingestion + evaluate routes."""
from flask import Blueprint, request, jsonify
from ..extensions import db
from ..models import BackendJob, Service, AlertEvent
from ..schemas import BackendJobSchema, AlertEventSchema
from ..services.alert_scoring import evaluate_job
from ..services.suppression_engine import check_suppression_rules

jobs_bp = Blueprint("jobs", __name__)
job_schema = BackendJobSchema()
jobs_schema = BackendJobSchema(many=True)
alert_schema = AlertEventSchema()

# reuse error helper pattern
from .services import _error


@jobs_bp.get("/jobs")
def list_jobs():
    """GET /api/v1/jobs — list backend jobs."""
    page = request.args.get("page", 1, type=int)
    page_size = request.args.get("page_size", 20, type=int)
    q = BackendJob.query

    service_id = request.args.get("service_id", type=int)
    status = request.args.get("status")

    if service_id:
        q = q.filter_by(service_id=service_id)
    if status:
        q = q.filter_by(status=status)

    total = q.count()
    items = q.order_by(BackendJob.id.desc()).offset((page - 1) * page_size).limit(page_size).all()

    return jsonify({
        "items": jobs_schema.dump(items),
        "pagination": {
            "page": page,
            "page_size": page_size,
            "total": total,
        },
    })


@jobs_bp.post("/jobs")
def create_job():
    """POST /api/v1/jobs — ingest a backend job record."""
    data = request.get_json(silent=True) or {}

    service_id = data.get("service_id")
    if not service_id or not Service.query.get(service_id):
        return _error("VALIDATION_ERROR", "A valid service_id is required", 422)

    job_name = data.get("job_name", "").strip()
    if not job_name:
        return _error("VALIDATION_ERROR", "job_name is required", 422)

    job = BackendJob(
        service_id=service_id,
        job_name=job_name,
        worker_id=data.get("worker_id", ""),
        status=data.get("status", "completed"),
        duration_ms=data.get("duration_ms", 0),
        api_latency_ms=data.get("api_latency_ms", 0),
        retry_count=data.get("retry_count", 0),
        error_count=data.get("error_count", 0),
        queue_delay_ms=data.get("queue_delay_ms", 0),
        processed_count=data.get("processed_count", 0),
        failed_count=data.get("failed_count", 0),
        timeout_count=data.get("timeout_count", 0),
        throughput_per_minute=data.get("throughput_per_minute", 0),
    )
    db.session.add(job)
    db.session.commit()

    return jsonify(job_schema.dump(job)), 201


@jobs_bp.post("/jobs/<int:job_id>/evaluate")
def evaluate_job_route(job_id: int):
    """POST /api/v1/jobs/{id}/evaluate — score a job and create an alert event."""
    job = BackendJob.query.get(job_id)
    if not job:
        return _error("JOB_NOT_FOUND", f"Job with id {job_id} was not found", 404)

    service = Service.query.get(job.service_id)
    if not service:
        return _error("SERVICE_NOT_FOUND", "Associated service not found", 404)

    data = request.get_json(silent=True) or {}
    strategy = data.get("strategy", "feedback")

    # 1. Deterministic scoring
    result = evaluate_job(job, service, strategy)

    # 2. Suppression rule check
    suppression = check_suppression_rules(job, result)

    # 3. If suppression rules matched, override decision to suppress
    if suppression["suppress"]:
        result["decision"] = "suppress"
        result["applied_rules"] = suppression["matched"]

    # 4. Create alert event
    alert = AlertEvent(
        job_id=job.id,
        severity=result["severity"],
        score=result["score"],
        utility=result["utility"],
        decision=result["decision"],
        decision_reason="; ".join(result["decision_reason"]),
        applied_rules_json=result["applied_rules"],
        confidence=result["confidence"],
        status="open",
        is_duplicate=len(suppression.get("matched", [])) > 0,
        duplicate_group_key=suppression.get("duplicate_group_key"),
        is_actionable=result["is_actionable"],
    )
    db.session.add(alert)
    db.session.commit()

    return jsonify({
        "job_id": job.id,
        "alert_created": True,
        "alert": {
            "id": alert.id,
            "severity": alert.severity,
            "score": round(result["score"], 4),
            "utility": round(result["utility"], 4),
            "decision": alert.decision,
            "confidence": round(result["confidence"], 4),
            "decision_reason": result["decision_reason"],
            "applied_rules": result["applied_rules"],
            "duplicate_group_key": alert.duplicate_group_key,
        },
    }), 201

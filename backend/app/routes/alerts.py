"""Alert event + feedback routes."""
from flask import Blueprint, request, jsonify
from ..extensions import db
from ..models import AlertEvent, AlertFeedback, BackendJob, AuditLog
from ..schemas import AlertEventSchema, AlertEventDetailSchema, AlertFeedbackSchema
from ..services.audit_service import write_audit_log

alerts_bp = Blueprint("alerts", __name__)
alert_schema = AlertEventSchema()
alert_detail_schema = AlertEventDetailSchema()
alerts_schema = AlertEventSchema(many=True)
feedback_schema = AlertFeedbackSchema()
feedbacks_schema = AlertFeedbackSchema(many=True)

from .services import _error


# ---------------------------------------------------------------------------
# Alerts
# ---------------------------------------------------------------------------
@alerts_bp.get("/alerts")
def list_alerts():
    """GET /api/v1/alerts — list alert events with optional filters."""
    page = request.args.get("page", 1, type=int)
    page_size = request.args.get("page_size", 20, type=int)

    q = AlertEvent.query

    status = request.args.get("status")
    decision = request.args.get("decision")
    severity_min = request.args.get("severity_min", type=int)
    service_id = request.args.get("service_id", type=int)

    if status:
        q = q.filter_by(status=status)
    if decision:
        q = q.filter_by(decision=decision)
    if severity_min is not None:
        q = q.filter(AlertEvent.severity >= severity_min)
    if service_id is not None:
        # Join via job
        q = q.join(BackendJob, AlertEvent.job_id == BackendJob.id).filter(
            BackendJob.service_id == service_id
        )

    total = q.count()
    items = q.order_by(AlertEvent.id.desc()).offset((page - 1) * page_size).limit(page_size).all()

    return jsonify({
        "items": alerts_schema.dump(items),
        "pagination": {
            "page": page,
            "page_size": page_size,
            "total": total,
        },
    })


@alerts_bp.get("/alerts/<int:alert_id>")
def get_alert(alert_id: int):
    """GET /api/v1/alerts/{id} — full alert detail."""
    alert = AlertEvent.query.get(alert_id)
    if not alert:
        return _error("ALERT_NOT_FOUND", f"Alert with id {alert_id} was not found", 404)
    return jsonify(alert_detail_schema.dump(alert))


@alerts_bp.post("/alerts")
def create_alert():
    """POST /api/v1/alerts — create an alert event manually (admin/testing)."""
    data = request.get_json(silent=True) or {}
    job_id = data.get("job_id")
    if not job_id:
        return _error("VALIDATION_ERROR", "job_id is required", 422)

    job = BackendJob.query.get(job_id)
    if not job:
        return _error("JOB_NOT_FOUND", f"Job with id {job_id} was not found", 404)

    alert = AlertEvent(
        job_id=job_id,
        severity=data.get("severity", 1),
        score=data.get("score", 0),
        utility=data.get("utility", 0),
        decision=data.get("decision", "promote"),
        decision_reason=data.get("decision_reason", ""),
        confidence=data.get("confidence", 0),
        is_duplicate=data.get("is_duplicate", False),
        is_actionable=data.get("is_actionable", True),
    )
    db.session.add(alert)
    db.session.commit()
    return jsonify(alert_schema.dump(alert)), 201


@alerts_bp.patch("/alerts/<int:alert_id>")
def patch_alert(alert_id: int):
    """PATCH /api/v1/alerts/{id} — partially update alert (status/archive)."""
    alert = AlertEvent.query.get(alert_id)
    if not alert:
        return _error("ALERT_NOT_FOUND", f"Alert with id {alert_id} was not found", 404)

    data = request.get_json(silent=True) or {}
    previous_status = alert.status
    updated = False

    if "status" in data:
        if data["status"] not in ("open", "acknowledged", "escalated", "closed"):
            return _error("VALIDATION_ERROR", "Invalid status value", 422)
        alert.status = data["status"]
        from datetime import datetime, timezone
        alert.acknowledged_at = datetime.now(timezone.utc)
        updated = True

    if "archived" in data:
        alert.archived = bool(data["archived"])
        updated = True

    if not updated:
        return _error("VALIDATION_ERROR", "No valid fields to update (status, archived)", 422)

    db.session.commit()

    return jsonify({
        "id": alert.id,
        "previous_status": previous_status,
        "status": alert.status,
        "message": "Alert updated",
    })


# ---------------------------------------------------------------------------
# Feedback (nested under alerts)
# ---------------------------------------------------------------------------
@alerts_bp.post("/alerts/<int:alert_id>/feedback")
def submit_feedback(alert_id: int):
    """POST /api/v1/alerts/{id}/feedback — submit feedback in a transaction.

    Transaction steps:
    1. Insert alert_feedback row.
    2. Update alert_events.status if operator_action requires it.
    3. Insert audit_logs row.
    """
    alert = AlertEvent.query.get(alert_id)
    if not alert:
        return _error("ALERT_NOT_FOUND", f"Alert with id {alert_id} was not found", 404)

    data = request.get_json(silent=True) or {}
    user_id = data.get("user_id")
    outcome = data.get("outcome")
    operator_action = data.get("operator_action", "confirm")
    note = data.get("note", "")
    applied_to_ranking = data.get("applied_to_ranking", False)

    if not user_id:
        return _error("VALIDATION_ERROR", "user_id is required", 422)
    if not outcome:
        return _error("VALIDATION_ERROR", "outcome is required", 422)

    allowed_outcomes = [
        "real_incident", "useful", "false_positive", "duplicate",
        "expected_behavior", "noisy", "needs_more_information",
    ]
    if outcome not in allowed_outcomes:
        return _error("VALIDATION_ERROR", f"Invalid outcome. Allowed: {allowed_outcomes}", 422)

    allowed_actions = ["confirm", "escalate", "close"]
    if operator_action not in allowed_actions:
        return _error("VALIDATION_ERROR", f"Invalid operator_action. Allowed: {allowed_actions}", 422)

    previous_status = alert.status

    try:
        # Step 1 — feedback
        feedback = AlertFeedback(
            alert_id=alert.id,
            user_id=user_id,
            outcome=outcome,
            operator_action=operator_action,
            note=note,
            applied_to_ranking=applied_to_ranking,
        )
        db.session.add(feedback)

        # Step 2 — update alert status from operator action
        if operator_action == "close":
            alert.status = "closed"
        elif operator_action == "escalate":
            alert.status = "escalated"

        # Step 3 — audit log
        write_audit_log(
            user_id=user_id,
            action=f"feedback_{operator_action}",
            entity_type="alert_event",
            entity_id=alert.id,
            before={"status": previous_status},
            after={"status": alert.status, "outcome": outcome},
        )

        db.session.commit()

        return jsonify({
            "feedback": {
                "id": feedback.id,
                "alert_id": alert.id,
                "outcome": feedback.outcome,
                "operator_action": feedback.operator_action,
                "applied_to_ranking": feedback.applied_to_ranking,
            },
            "alert": {
                "id": alert.id,
                "previous_status": previous_status,
                "current_status": alert.status,
            },
            "message": "Feedback submitted and alert status updated",
        }), 201

    except Exception:
        db.session.rollback()
        return _error("INTERNAL_ERROR", "Feedback transaction failed", 500)


@alerts_bp.get("/feedback")
def list_feedback():
    """GET /api/v1/feedback — list submitted feedback."""
    page = request.args.get("page", 1, type=int)
    page_size = request.args.get("page_size", 20, type=int)

    q = AlertFeedback.query.order_by(AlertFeedback.id.desc())
    total = q.count()
    items = q.offset((page - 1) * page_size).limit(page_size).all()

    return jsonify({
        "items": feedbacks_schema.dump(items),
        "pagination": {
            "page": page,
            "page_size": page_size,
            "total": total,
        },
    })

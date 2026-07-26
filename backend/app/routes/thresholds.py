"""Threshold config CRUD routes."""
from flask import Blueprint, request, jsonify
from ..extensions import db
from ..models import ThresholdConfig, Service
from ..schemas import ThresholdConfigSchema

thresholds_bp = Blueprint("thresholds", __name__)
threshold_schema = ThresholdConfigSchema()
thresholds_schema = ThresholdConfigSchema(many=True)

from .services import _error


@thresholds_bp.get("/threshold-configs")
def list_thresholds():
    """GET /api/v1/threshold-configs — list threshold configs."""
    service_id = request.args.get("service_id", type=int)
    q = ThresholdConfig.query
    if service_id:
        q = q.filter_by(service_id=service_id)
    return jsonify(thresholds_schema.dump(q.order_by(ThresholdConfig.id).all()))


@thresholds_bp.post("/threshold-configs")
def create_threshold():
    """POST /api/v1/threshold-configs — create a threshold config."""
    data = request.get_json(silent=True) or {}

    service_id = data.get("service_id")
    if not service_id or not Service.query.get(service_id):
        return _error("VALIDATION_ERROR", "A valid service_id is required", 422)

    threshold = ThresholdConfig(
        service_id=service_id,
        metric_name=data.get("metric_name", "score"),
        threshold_value=data.get("threshold_value", 0.5),
        strategy=data.get("strategy", "threshold"),
        version=data.get("version", "v1"),
        status=data.get("status", "active"),
        active=data.get("active", True),
        recommended_by=data.get("recommended_by"),
        approved_by=data.get("approved_by"),
    )
    db.session.add(threshold)
    db.session.commit()
    return jsonify(threshold_schema.dump(threshold)), 201


@thresholds_bp.patch("/threshold-configs/<int:threshold_id>")
def patch_threshold(threshold_id: int):
    """PATCH /api/v1/threshold-configs/{id} — approve, deactivate, or update."""
    tc = ThresholdConfig.query.get(threshold_id)
    if not tc:
        return _error("THRESHOLD_NOT_FOUND", f"Threshold config with id {threshold_id} was not found", 404)

    data = request.get_json(silent=True) or {}
    updated = False

    if "status" in data:
        tc.status = data["status"]
        updated = True
    if "active" in data:
        tc.active = bool(data["active"])
        updated = True
    if "threshold_value" in data:
        tc.threshold_value = data["threshold_value"]
        updated = True
    if "approved_by" in data:
        tc.approved_by = data["approved_by"]
        updated = True

    if not updated:
        return _error("VALIDATION_ERROR", "No valid fields to update", 422)

    db.session.commit()
    return jsonify(threshold_schema.dump(tc))

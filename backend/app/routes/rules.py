"""Suppression rules CRUD routes."""
from flask import Blueprint, request, jsonify
from ..extensions import db
from ..models import SuppressionRule, Service
from ..schemas import SuppressionRuleSchema

rules_bp = Blueprint("rules", __name__)
rule_schema = SuppressionRuleSchema()
rules_schema = SuppressionRuleSchema(many=True)

from .services import _error


@rules_bp.get("/suppression-rules")
def list_rules():
    """GET /api/v1/suppression-rules — list all suppression rules."""
    service_id = request.args.get("service_id", type=int)
    q = SuppressionRule.query
    if service_id:
        q = q.filter_by(service_id=service_id)
    return jsonify(rules_schema.dump(q.order_by(SuppressionRule.id).all()))


@rules_bp.post("/suppression-rules")
def create_rule():
    """POST /api/v1/suppression-rules — create a suppression rule."""
    data = request.get_json(silent=True) or {}

    service_id = data.get("service_id")
    if not service_id or not Service.query.get(service_id):
        return _error("VALIDATION_ERROR", "A valid service_id is required", 422)

    rule_name = data.get("rule_name", "").strip()
    rule_type = data.get("rule_type", "").strip()
    if not rule_name:
        return _error("VALIDATION_ERROR", "rule_name is required", 422)
    if rule_type not in ("duplicate_grouping", "expected_maintenance", "transient_retry", "low_severity_noise"):
        return _error("VALIDATION_ERROR", f"Invalid rule_type: {rule_type}", 422)

    rule = SuppressionRule(
        service_id=service_id,
        rule_name=rule_name,
        rule_type=rule_type,
        condition_json=data.get("condition_json", {}),
        active=data.get("active", True),
        created_by=data.get("created_by", 1),
    )
    db.session.add(rule)
    db.session.commit()
    return jsonify(rule_schema.dump(rule)), 201


@rules_bp.patch("/suppression-rules/<int:rule_id>")
def patch_rule(rule_id: int):
    """PATCH /api/v1/suppression-rules/{id} — activate/deactivate/update a rule."""
    rule = SuppressionRule.query.get(rule_id)
    if not rule:
        return _error("RULE_NOT_FOUND", f"Suppression rule with id {rule_id} was not found", 404)

    data = request.get_json(silent=True) or {}
    updated = False

    if "active" in data:
        rule.active = bool(data["active"])
        updated = True
    if "rule_name" in data:
        rule.rule_name = data["rule_name"].strip()
        updated = True
    if "condition_json" in data:
        rule.condition_json = data["condition_json"]
        updated = True

    if not updated:
        return _error("VALIDATION_ERROR", "No valid fields to update", 422)

    db.session.commit()
    return jsonify(rule_schema.dump(rule))

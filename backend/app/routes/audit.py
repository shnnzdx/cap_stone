"""Audit log routes."""
from flask import Blueprint, request, jsonify
from ..models import AuditLog
from ..schemas import AuditLogSchema

audit_bp = Blueprint("audit", __name__)
audit_schema = AuditLogSchema()
audits_schema = AuditLogSchema(many=True)


@audit_bp.get("/audit-logs")
def list_audit_logs():
    """GET /api/v1/audit-logs — list audit log entries."""
    page = request.args.get("page", 1, type=int)
    page_size = request.args.get("page_size", 20, type=int)
    user_id = request.args.get("user_id", type=int)
    entity_type = request.args.get("entity_type")

    q = AuditLog.query
    if user_id:
        q = q.filter_by(user_id=user_id)
    if entity_type:
        q = q.filter_by(entity_type=entity_type)

    total = q.count()
    items = q.order_by(AuditLog.id.desc()).offset((page - 1) * page_size).limit(page_size).all()

    return jsonify({
        "items": audits_schema.dump(items),
        "pagination": {
            "page": page,
            "page_size": page_size,
            "total": total,
        },
    })

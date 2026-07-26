"""Service CRUD routes."""
from flask import Blueprint, request, jsonify
from ..extensions import db
from ..models import Service
from ..schemas import ServiceSchema

services_bp = Blueprint("services", __name__)
service_schema = ServiceSchema()
services_schema = ServiceSchema(many=True)


@services_bp.get("/services")
def list_services():
    """GET /api/v1/services — list all monitored services."""
    services = Service.query.order_by(Service.id).all()
    return jsonify(services_schema.dump(services))


@services_bp.post("/services")
def create_service():
    """POST /api/v1/services — create a new monitored service."""
    data = request.get_json(silent=True) or {}

    name = data.get("name", "").strip()
    if not name:
        return _error("VALIDATION_ERROR", "Service name is required", 422)

    if Service.query.filter_by(name=name).first():
        return _error("CONFLICT", f"Service '{name}' already exists", 409)

    service = Service(
        name=name,
        owner_team=data.get("owner_team", "platform"),
        criticality=data.get("criticality", "medium"),
        description=data.get("description", ""),
    )
    db.session.add(service)
    db.session.commit()

    return jsonify(service_schema.dump(service)), 201


@services_bp.get("/services/<int:service_id>")
def get_service(service_id: int):
    """GET /api/v1/services/{id} — get a single service."""
    service = Service.query.get(service_id)
    if not service:
        return _error("SERVICE_NOT_FOUND", f"Service with id {service_id} was not found", 404)
    return jsonify(service_schema.dump(service))


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _error(code: str, message: str, status: int):
    return jsonify({"error": {"code": code, "message": message}}), status

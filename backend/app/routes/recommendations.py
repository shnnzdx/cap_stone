"""Recommendation routes."""
from flask import Blueprint, request, jsonify
from ..extensions import db
from ..models import Recommendation
from ..schemas import RecommendationSchema

recommendations_bp = Blueprint("recommendations", __name__)
rec_schema = RecommendationSchema()
recs_schema = RecommendationSchema(many=True)

from .services import _error


@recommendations_bp.get("/recommendations")
def list_recommendations():
    """GET /api/v1/recommendations — list adaptive recommendations."""
    status = request.args.get("status")
    q = Recommendation.query
    if status:
        q = q.filter_by(status=status)
    return jsonify(recs_schema.dump(q.order_by(Recommendation.id.desc()).all()))


@recommendations_bp.patch("/recommendations/<int:rec_id>")
def patch_recommendation(rec_id: int):
    """PATCH /api/v1/recommendations/{id} — approve or reject."""
    rec = Recommendation.query.get(rec_id)
    if not rec:
        return _error("REC_NOT_FOUND", f"Recommendation with id {rec_id} was not found", 404)

    data = request.get_json(silent=True) or {}
    new_status = data.get("status")

    if new_status not in ("approved", "rejected"):
        return _error("VALIDATION_ERROR", "status must be 'approved' or 'rejected'", 422)

    rec.status = new_status
    rec.reviewed_by = data.get("reviewed_by", rec.reviewed_by)
    from datetime import datetime, timezone
    rec.reviewed_at = datetime.now(timezone.utc)

    db.session.commit()
    return jsonify(rec_schema.dump(rec))

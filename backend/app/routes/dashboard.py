"""Dashboard summary routes."""
from flask import Blueprint, jsonify
from ..services.dashboard_metrics import compute_summary, compute_noise_breakdown

dashboard_bp = Blueprint("dashboard", __name__)


@dashboard_bp.get("/dashboard/summary")
def dashboard_summary():
    """GET /api/v1/dashboard/summary — KPI cards."""
    return jsonify(compute_summary())


@dashboard_bp.get("/dashboard/noise-breakdown")
def dashboard_noise_breakdown():
    """GET /api/v1/dashboard/noise-breakdown — noise categories."""
    return jsonify(compute_noise_breakdown())

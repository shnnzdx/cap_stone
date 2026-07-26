"""Evaluation CRUD routes."""
from flask import Blueprint, request, jsonify
from ..extensions import db
from ..models import EvaluationRun
from ..schemas import EvaluationRunSchema

evaluation_bp = Blueprint("evaluation", __name__)
eval_schema = EvaluationRunSchema()
evals_schema = EvaluationRunSchema(many=True)

from .services import _error


@evaluation_bp.get("/evaluation/runs")
def list_runs():
    """GET /api/v1/evaluation/runs — list evaluation results."""
    strategy = request.args.get("strategy")
    q = EvaluationRun.query
    if strategy:
        q = q.filter_by(strategy=strategy)
    return jsonify(evals_schema.dump(q.order_by(EvaluationRun.id.desc()).all()))


@evaluation_bp.post("/evaluation/runs")
def create_run():
    """POST /api/v1/evaluation/runs — save an evaluation result."""
    data = request.get_json(silent=True) or {}

    run = EvaluationRun(
        strategy=data.get("strategy", "feedback"),
        alerts_sent=data.get("alerts_sent", 0),
        false_positives=data.get("false_positives", 0),
        duplicate_rate=data.get("duplicate_rate", 0),
        alert_reduction=data.get("alert_reduction", 0),
        precision=data.get("precision", 0),
        recall=data.get("recall", 0),
        mean_time_to_acknowledge=data.get("mean_time_to_acknowledge", 0),
    )
    db.session.add(run)
    db.session.commit()
    return jsonify(eval_schema.dump(run)), 201

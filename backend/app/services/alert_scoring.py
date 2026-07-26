"""Deterministic alert scoring engine.

Formulas follow the assignment spec:

    score = severity_weight
          + service_criticality_weight
          + retry_weight
          + timeout_weight
          + queue_delay_weight
          - historical_false_positive_penalty

"""
from decimal import Decimal
from ..models import BackendJob, Service, AlertEvent, AlertFeedback, db


CRITICALITY_WEIGHT = {
    "low": Decimal("0.05"),
    "medium": Decimal("0.10"),
    "high": Decimal("0.20"),
    "critical": Decimal("0.30"),
}


def _safe_decimal(value, default="0"):
    if value is None:
        return Decimal(default)
    return Decimal(str(value))


def _historical_false_positive_rate(service_id: int) -> Decimal:
    """Compute false-positive rate from feedback on alerts belonging to a service."""
    alert_ids_subq = (
        db.session.query(AlertEvent.id)
        .join(BackendJob, AlertEvent.job_id == BackendJob.id)
        .filter(BackendJob.service_id == service_id)
        .subquery()
    )
    total = (
        db.session.query(AlertFeedback)
        .filter(AlertFeedback.alert_id.in_(db.session.query(alert_ids_subq.c.id)))
        .count()
    )
    if total == 0:
        return Decimal("0")
    fps = (
        db.session.query(AlertFeedback)
        .filter(
            AlertFeedback.alert_id.in_(db.session.query(alert_ids_subq.c.id)),
            AlertFeedback.outcome.in_(["false_positive", "noisy", "duplicate", "expected_behavior"]),
        )
        .count()
    )
    return Decimal(str(fps)) / Decimal(str(total))


def evaluate_job(job: BackendJob, service: Service, strategy: str = "feedback") -> dict:
    """
    Deterministic alert scoring for a single backend job.

    Returns a dict suitable for creating an AlertEvent record.
    """
    # ----- Severity weight (1–5 mapped to 0.05–0.35) -----
    severity_base = _safe_decimal(
        max(1, min(5, 1 + (job.retry_count or 0) // 2 + (1 if job.status in ("timeout", "failed") else 0)))
    )
    severity_weight = severity_base * Decimal("0.07")

    # ----- Service criticality -----
    criticality = (service.criticality or "medium").lower()
    criticality_weight = CRITICALITY_WEIGHT.get(criticality, Decimal("0.10"))

    # ----- Retry pressure -----
    retry_count = _safe_decimal(job.retry_count)
    retry_weight = min(Decimal("0.30"), retry_count * Decimal("0.04"))

    # ----- Timeout / failure weight -----
    status = job.status or "completed"
    timeout_weight = Decimal("0")
    if status == "timeout":
        timeout_weight = Decimal("0.28")
    elif status == "failed":
        timeout_weight = Decimal("0.20")
    elif status == "completed_with_failures":
        timeout_weight = Decimal("0.12")

    # ----- Queue delay -----
    queue_delay = _safe_decimal(job.queue_delay_ms)
    queue_delay_weight = min(Decimal("0.15"), queue_delay / Decimal("20000"))

    # ----- Historical false-positive penalty -----
    fp_rate = _historical_false_positive_rate(service.id)
    fp_penalty = fp_rate * Decimal("0.25")

    raw_score = (
        severity_weight
        + criticality_weight
        + retry_weight
        + timeout_weight
        + queue_delay_weight
        - fp_penalty
    )
    score = max(Decimal("0"), min(Decimal("1"), raw_score))

    # ----- Utility (separate dimension — "how useful is it to show this alert?") -----
    error_count = _safe_decimal(job.error_count)
    duration = _safe_decimal(job.duration_ms)
    utility = (
        retry_weight * Decimal("0.4")
        + min(Decimal("0.30"), error_count * Decimal("0.05"))
        + min(Decimal("0.15"), duration / Decimal("60000"))
        + (Decimal("0.12") if job.status in ("timeout", "failed") else Decimal("0"))
        + (Decimal("0.15") - fp_penalty * Decimal("0.6"))
    )
    utility = max(Decimal("0"), min(Decimal("1"), utility))

    # ----- Decision -----
    if strategy == "threshold":
        threshold = Decimal("0.58")
        decision = "promote" if score >= threshold else "suppress"
        confidence = float(abs(score - threshold))
    elif strategy == "feedback":
        threshold = Decimal("0.48")
        combined = score * Decimal("0.42") + utility * Decimal("0.58")
        decision = "promote" if combined >= threshold else "suppress"
        confidence = float(abs(combined - threshold))
    else:
        # rules — always promote (rules are checked separately by suppression engine)
        decision = "promote"
        confidence = 0.5

    # ----- Build reason list -----
    reasons = []
    if status in ("timeout", "failed"):
        reasons.append(f"Job status is {status}")
    if retry_count >= 3:
        reasons.append(f"Retry count ({int(retry_count)}) exceeded threshold")
    if queue_delay > 5000:
        reasons.append(f"Queue delay ({int(queue_delay)}ms) is elevated")
    if criticality in ("high", "critical"):
        reasons.append(f"Service criticality is {criticality}")
    if not reasons:
        reasons.append("No threshold exceeded — baseline alert")

    return {
        "score": float(score),
        "utility": float(utility),
        "severity": int(severity_base),
        "decision": decision,
        "confidence": round(confidence, 4),
        "decision_reason": reasons,
        "is_actionable": utility > Decimal("0.40"),
        "applied_rules": [],
    }

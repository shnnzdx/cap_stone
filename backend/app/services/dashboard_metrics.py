"""Dashboard metrics computation.

Reads real data from the database and computes KPI metrics matching
the formulas in the assignment spec.
"""
from ..models import AlertEvent, AlertFeedback, BackendJob, db
from sqlalchemy import func


def compute_summary() -> dict:
    """Return the dashboard KPI summary."""
    total_alerts = AlertEvent.query.count()
    promoted = AlertEvent.query.filter_by(decision="promote").count()
    suppressed = AlertEvent.query.filter_by(decision="suppress").count()
    open_alerts = AlertEvent.query.filter_by(status="open").count()

    # Reviewed alerts = those with at least one feedback row
    reviewed_subq = (
        db.session.query(AlertFeedback.alert_id)
        .distinct()
        .subquery()
    )
    reviewed = db.session.query(func.count(reviewed_subq.c.alert_id)).scalar() or 0

    # False positive count
    false_positives = (
        AlertFeedback.query
        .filter(AlertFeedback.outcome.in_(["false_positive", "noisy"]))
        .count()
    )

    # Duplicate count (alerts marked as duplicate)
    duplicate_count = AlertEvent.query.filter_by(is_duplicate=True).count()

    # Precision = TP / (TP + FP)
    # TP = feedbacks with useful/real_incident
    true_positives = (
        AlertFeedback.query
        .filter(AlertFeedback.outcome.in_(["real_incident", "useful"]))
        .count()
    )
    precision = true_positives / max(1, true_positives + false_positives)

    # Recall = actionable surfaced / total actionable (heuristic)
    actionable_surfaced = AlertEvent.query.filter_by(
        decision="promote", is_actionable=True
    ).count()
    actionable_total = AlertEvent.query.filter_by(is_actionable=True).count()
    recall = actionable_surfaced / max(1, actionable_total)

    # Alert reduction
    alert_reduction = 1 - (promoted / max(1, total_alerts))

    # False positive rate
    false_positive_rate = false_positives / max(1, reviewed)

    # Duplicate alert rate
    duplicate_alert_rate = duplicate_count / max(1, total_alerts)

    return {
        "alert_reduction": round(alert_reduction, 4),
        "false_positive_rate": round(false_positive_rate, 4),
        "duplicate_alert_rate": round(duplicate_alert_rate, 4),
        "precision": round(precision, 4),
        "recall": round(recall, 4),
        "open_alerts": open_alerts,
        "reviewed_alerts": reviewed,
    }


def compute_noise_breakdown() -> dict:
    """Return how noise was categorised."""
    suppressed = AlertEvent.query.filter_by(decision="suppress").all()

    duplicate_grouped = sum(1 for a in suppressed if a.is_duplicate)
    # heuristic — low utility + completed_with_failures
    expected_maint = sum(
        1 for a in suppressed
        if a.job and a.job.status == "completed_with_failures" and float(a.utility or 0) < 0.42
    )
    transient_retry = sum(
        1 for a in suppressed
        if a.job and (a.job.retry_count or 0) <= 1 and (a.job.error_count or 0) <= 1
    )
    low_severity = sum(
        1 for a in suppressed
        if (a.severity or 0) < 3 and not (a.is_actionable or False)
    )

    return {
        "duplicate_alerts_grouped": duplicate_grouped,
        "expected_maintenance_suppressed": expected_maint,
        "transient_retry_noise_suppressed": transient_retry,
        "low_severity_false_positives_suppressed": low_severity,
    }

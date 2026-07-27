"""Dashboard metrics computation.

Reads real data from the database and computes KPI metrics matching
the formulas in the assignment spec.
"""
from ..models import AlertEvent, AlertFeedback


def compute_summary() -> dict:
    """Return the dashboard KPI summary."""
    total_alerts = AlertEvent.query.count()
    promoted = AlertEvent.query.filter_by(decision="promote").count()
    suppressed = AlertEvent.query.filter_by(decision="suppress").count()
    open_alerts = AlertEvent.query.filter_by(status="open").count()

    latest_feedback = _latest_feedback_by_alert()
    reviewed = len(latest_feedback)

    # False positive count based on each alert's latest review label.
    false_positives = sum(
        1 for feedback in latest_feedback.values()
        if feedback.outcome in ("false_positive", "noisy")
    )

    # Duplicate count (alerts marked as duplicate)
    duplicate_count = AlertEvent.query.filter_by(is_duplicate=True).count()

    # Precision = TP / (TP + FP)
    # TP = feedbacks with useful/real_incident
    true_positives = sum(
        1 for feedback in latest_feedback.values()
        if feedback.outcome in ("real_incident", "useful")
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


def _latest_feedback_by_alert() -> dict:
    """Return the latest feedback row for each reviewed alert."""
    rows = AlertFeedback.query.order_by(AlertFeedback.alert_id, AlertFeedback.created_at).all()
    latest = {}
    for row in rows:
        latest[row.alert_id] = row
    return latest


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

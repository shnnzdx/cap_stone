"""Suppression rule evaluation engine.

Checks active suppression rules against a job/alert context and returns
whether the alert should be suppressed and why.
"""
import json
from ..models import SuppressionRule, BackendJob, AlertEvent, db


def check_suppression_rules(job: BackendJob, alert_candidate: dict = None) -> dict:
    """
    Evaluate all *active* suppression rules for the given service.

    Returns:
        {
            "suppress": bool,
            "matched": [rule dicts],
            "duplicate_group_key": str | None,
        }
    """
    rules = (
        SuppressionRule.query
        .filter_by(service_id=job.service_id, active=True)
        .all()
    )

    matched = []
    duplicate_group_key = None

    for rule in rules:
        condition = rule.condition_json or {}

        if rule.rule_type == "duplicate_grouping":
            # Check if a similar alert was generated recently (last 5 min)
            if _is_duplicate(job):
                matched.append({
                    "rule_id": rule.id,
                    "rule_name": rule.rule_name,
                    "reason": "Duplicate pattern detected — same job + same status",
                })
                duplicate_group_key = f"svc-{job.service_id}|status-{job.status}|err-{job.error_count}"

        elif rule.rule_type == "expected_maintenance":
            if _match_expected_maintenance(job, condition):
                matched.append({
                    "rule_id": rule.id,
                    "rule_name": rule.rule_name,
                    "reason": "Matches expected-maintenance window rule",
                })

        elif rule.rule_type == "transient_retry":
            if _match_transient_retry(job, condition):
                matched.append({
                    "rule_id": rule.id,
                    "rule_name": rule.rule_name,
                    "reason": "Transient retry burst — likely self-healing",
                })

        elif rule.rule_type == "low_severity_noise":
            if _match_low_severity_noise(job, condition):
                matched.append({
                    "rule_id": rule.id,
                    "rule_name": rule.rule_name,
                    "reason": "Low-severity noise pattern",
                })

    return {
        "suppress": len(matched) > 0,
        "matched": matched,
        "duplicate_group_key": duplicate_group_key,
    }


def _is_duplicate(job: BackendJob) -> bool:
    """Check if a recent alert with the same job_id + status already exists (within 5 min)."""
    from datetime import datetime, timezone, timedelta
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=5)
    existing = (
        AlertEvent.query
        .filter(
            AlertEvent.job_id == job.id,
            AlertEvent.created_at >= cutoff,
        )
        .first()
    )
    return existing is not None


def _match_expected_maintenance(job: BackendJob, condition: dict) -> bool:
    retry_gte = condition.get("retry_count_gte")
    maintenance = condition.get("maintenance_window", False)
    if not maintenance:
        return False
    if retry_gte is not None and (job.retry_count or 0) < retry_gte:
        return False
    return True


def _match_transient_retry(job: BackendJob, condition: dict) -> bool:
    max_retry = condition.get("max_retry_count", 2)
    max_error = condition.get("max_error_count", 2)
    return (
        (job.retry_count or 0) <= max_retry
        and (job.error_count or 0) <= max_error
    )


def _match_low_severity_noise(job: BackendJob, condition: dict) -> bool:
    threshold = condition.get("score_lt", 0.35)
    return job.status == "completed" and (job.error_count or 0) <= 1

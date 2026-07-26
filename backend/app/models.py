"""SQLAlchemy models for Alert Triage Engine."""
from datetime import datetime, timezone
from .extensions import db


def _utcnow():
    return datetime.now(timezone.utc)


# ---------------------------------------------------------------------------
# users
# ---------------------------------------------------------------------------
class User(db.Model):
    __tablename__ = "users"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(255), unique=True, nullable=False)
    role = db.Column(db.String(20), nullable=False, default="operator")  # operator | sre | admin
    created_at = db.Column(db.TIMESTAMPTZ, nullable=False, default=_utcnow)

    # relationships
    feedbacks = db.relationship("AlertFeedback", backref="reviewer", lazy="dynamic")
    suppression_rules = db.relationship("SuppressionRule", backref="creator", lazy="dynamic",
                                        foreign_keys="SuppressionRule.created_by")
    threshold_configs_created = db.relationship("ThresholdConfig", backref="recommender",
                                                lazy="dynamic",
                                                foreign_keys="ThresholdConfig.recommended_by")
    threshold_configs_approved = db.relationship("ThresholdConfig", backref="approver",
                                                 lazy="dynamic",
                                                 foreign_keys="ThresholdConfig.approved_by")
    recommendations = db.relationship("Recommendation", backref="reviewer", lazy="dynamic",
                                      foreign_keys="Recommendation.reviewed_by")
    audit_logs = db.relationship("AuditLog", backref="actor", lazy="dynamic")


# ---------------------------------------------------------------------------
# services
# ---------------------------------------------------------------------------
class Service(db.Model):
    __tablename__ = "services"

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(180), unique=True, nullable=False)
    owner_team = db.Column(db.String(120), nullable=False, default="platform")
    criticality = db.Column(db.String(20), nullable=False, default="medium")  # low | medium | high | critical
    description = db.Column(db.Text, default="")
    created_at = db.Column(db.TIMESTAMPTZ, nullable=False, default=_utcnow)

    # relationships
    jobs = db.relationship("BackendJob", backref="service", lazy="dynamic")
    suppression_rules = db.relationship("SuppressionRule", backref="service", lazy="dynamic")
    threshold_configs = db.relationship("ThresholdConfig", backref="service", lazy="dynamic")
    recommendations = db.relationship("Recommendation", backref="service", lazy="dynamic")


# ---------------------------------------------------------------------------
# backend_jobs
# ---------------------------------------------------------------------------
class BackendJob(db.Model):
    __tablename__ = "backend_jobs"

    id = db.Column(db.Integer, primary_key=True)
    service_id = db.Column(db.Integer, db.ForeignKey("services.id"), nullable=False, index=True)
    job_name = db.Column(db.String(200), nullable=False)
    worker_id = db.Column(db.String(100), nullable=False)
    status = db.Column(db.String(30), nullable=False)  # completed | failed | completed_with_failures | timeout
    duration_ms = db.Column(db.Integer, nullable=False, default=0)
    api_latency_ms = db.Column(db.Integer, nullable=False, default=0)
    retry_count = db.Column(db.Integer, nullable=False, default=0)
    error_count = db.Column(db.Integer, nullable=False, default=0)
    queue_delay_ms = db.Column(db.Integer, nullable=False, default=0)
    processed_count = db.Column(db.Integer, nullable=False, default=0)
    failed_count = db.Column(db.Integer, nullable=False, default=0)
    timeout_count = db.Column(db.Integer, nullable=False, default=0)
    throughput_per_minute = db.Column(db.Integer, nullable=False, default=0)
    started_at = db.Column(db.TIMESTAMPTZ, nullable=True)
    completed_at = db.Column(db.TIMESTAMPTZ, nullable=True)
    created_at = db.Column(db.TIMESTAMPTZ, nullable=False, default=_utcnow)

    # relationships
    alert_events = db.relationship("AlertEvent", backref="job", lazy="dynamic")

    __table_args__ = (
        db.CheckConstraint("duration_ms >= 0", name="ck_jobs_duration_positive"),
        db.CheckConstraint("api_latency_ms >= 0", name="ck_jobs_latency_positive"),
        db.CheckConstraint("retry_count >= 0", name="ck_jobs_retry_positive"),
        db.CheckConstraint("error_count >= 0", name="ck_jobs_error_positive"),
        db.CheckConstraint("queue_delay_ms >= 0", name="ck_jobs_queue_positive"),
    )


# ---------------------------------------------------------------------------
# alert_events
# ---------------------------------------------------------------------------
class AlertEvent(db.Model):
    __tablename__ = "alert_events"

    id = db.Column(db.Integer, primary_key=True)
    job_id = db.Column(db.Integer, db.ForeignKey("backend_jobs.id"), nullable=False, index=True)
    severity = db.Column(db.Integer, nullable=False, default=1)
    score = db.Column(db.Numeric(5, 4), nullable=False, default=0)
    utility = db.Column(db.Numeric(5, 4), nullable=False, default=0)
    decision = db.Column(db.String(10), nullable=False)  # promote | suppress
    decision_reason = db.Column(db.Text, default="")
    applied_rules_json = db.Column(db.JSON, default=[])
    confidence = db.Column(db.Numeric(5, 4), nullable=False, default=0)
    status = db.Column(db.String(20), nullable=False, default="open")  # open | acknowledged | escalated | closed
    is_duplicate = db.Column(db.Boolean, nullable=False, default=False)
    duplicate_of_alert_id = db.Column(db.Integer, db.ForeignKey("alert_events.id"), nullable=True)
    duplicate_group_key = db.Column(db.String(120), nullable=True)
    is_actionable = db.Column(db.Boolean, nullable=False, default=True)
    archived = db.Column(db.Boolean, nullable=False, default=False)
    created_at = db.Column(db.TIMESTAMPTZ, nullable=False, default=_utcnow, index=True)
    acknowledged_at = db.Column(db.TIMESTAMPTZ, nullable=True)

    # relationships
    feedbacks = db.relationship("AlertFeedback", backref="alert", lazy="dynamic")
    audit_logs = db.relationship("AuditLog", backref="alert", lazy="dynamic",
                                 foreign_keys="AuditLog.entity_id",
                                 primaryjoin="AlertEvent.id == foreign(AuditLog.entity_id)")
    duplicate_of = db.relationship("AlertEvent", remote_side=[id], backref="duplicates")

    __table_args__ = (
        db.CheckConstraint("severity >= 1 AND severity <= 5", name="ck_alerts_severity_range"),
        db.CheckConstraint("score >= 0 AND score <= 1", name="ck_alerts_score_range"),
        db.CheckConstraint("utility >= 0 AND utility <= 1", name="ck_alerts_utility_range"),
        db.CheckConstraint("confidence >= 0 AND confidence <= 1", name="ck_alerts_confidence_range"),
        db.Index("ix_alerts_decision", "decision"),
        db.Index("ix_alerts_status", "status"),
    )


# ---------------------------------------------------------------------------
# alert_feedback
# ---------------------------------------------------------------------------
class AlertFeedback(db.Model):
    __tablename__ = "alert_feedback"

    id = db.Column(db.Integer, primary_key=True)
    alert_id = db.Column(db.Integer, db.ForeignKey("alert_events.id"), nullable=False, index=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    outcome = db.Column(db.String(30), nullable=False)
    # real_incident | useful | false_positive | duplicate |
    # expected_behavior | noisy | needs_more_information
    operator_action = db.Column(db.String(20), nullable=False)  # confirm | escalate | close
    note = db.Column(db.Text, default="")
    applied_to_ranking = db.Column(db.Boolean, nullable=False, default=False)
    created_at = db.Column(db.TIMESTAMPTZ, nullable=False, default=_utcnow)

    __table_args__ = (
        db.Index("ix_feedback_outcome", "outcome"),
    )


# ---------------------------------------------------------------------------
# suppression_rules
# ---------------------------------------------------------------------------
class SuppressionRule(db.Model):
    __tablename__ = "suppression_rules"

    id = db.Column(db.Integer, primary_key=True)
    service_id = db.Column(db.Integer, db.ForeignKey("services.id"), nullable=False, index=True)
    rule_name = db.Column(db.String(200), nullable=False)
    rule_type = db.Column(db.String(40), nullable=False)
    # duplicate_grouping | expected_maintenance | transient_retry | low_severity_noise
    condition_json = db.Column(db.JSON, nullable=False, default={})
    active = db.Column(db.Boolean, nullable=False, default=True, index=True)
    created_by = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False)
    created_at = db.Column(db.TIMESTAMPTZ, nullable=False, default=_utcnow)


# ---------------------------------------------------------------------------
# threshold_configs
# ---------------------------------------------------------------------------
class ThresholdConfig(db.Model):
    __tablename__ = "threshold_configs"

    id = db.Column(db.Integer, primary_key=True)
    service_id = db.Column(db.Integer, db.ForeignKey("services.id"), nullable=False, index=True)
    metric_name = db.Column(db.String(120), nullable=False)
    threshold_value = db.Column(db.Numeric(8, 4), nullable=False)
    strategy = db.Column(db.String(20), nullable=False, default="threshold")  # threshold | rules | feedback
    version = db.Column(db.String(40), nullable=False)
    status = db.Column(db.String(20), nullable=False, default="active")  # active | inactive | pending
    active = db.Column(db.Boolean, nullable=False, default=True)
    recommended_by = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    approved_by = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    effective_from = db.Column(db.TIMESTAMPTZ, nullable=True)
    effective_to = db.Column(db.TIMESTAMPTZ, nullable=True)
    created_at = db.Column(db.TIMESTAMPTZ, nullable=False, default=_utcnow)
    updated_at = db.Column(db.TIMESTAMPTZ, nullable=False, default=_utcnow)


# ---------------------------------------------------------------------------
# recommendations
# ---------------------------------------------------------------------------
class Recommendation(db.Model):
    __tablename__ = "recommendations"

    id = db.Column(db.Integer, primary_key=True)
    service_id = db.Column(db.Integer, db.ForeignKey("services.id"), nullable=False, index=True)
    recommendation_type = db.Column(db.String(40), nullable=False)  # threshold | suppression | strategy
    current_value_json = db.Column(db.JSON, nullable=False, default={})
    recommended_value_json = db.Column(db.JSON, nullable=False, default={})
    reason = db.Column(db.Text, default="")
    confidence = db.Column(db.Numeric(5, 4), nullable=False, default=0)
    status = db.Column(db.String(20), nullable=False, default="pending")  # pending | approved | rejected
    reviewed_by = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)
    created_at = db.Column(db.TIMESTAMPTZ, nullable=False, default=_utcnow)
    reviewed_at = db.Column(db.TIMESTAMPTZ, nullable=True)


# ---------------------------------------------------------------------------
# evaluation_runs
# ---------------------------------------------------------------------------
class EvaluationRun(db.Model):
    __tablename__ = "evaluation_runs"

    id = db.Column(db.Integer, primary_key=True)
    strategy = db.Column(db.String(20), nullable=False)  # threshold | rules | feedback
    alerts_sent = db.Column(db.Integer, nullable=False, default=0)
    false_positives = db.Column(db.Integer, nullable=False, default=0)
    duplicate_rate = db.Column(db.Numeric(5, 4), nullable=False, default=0)
    alert_reduction = db.Column(db.Numeric(5, 4), nullable=False, default=0)
    precision = db.Column(db.Numeric(5, 4), nullable=False, default=0)
    recall = db.Column(db.Numeric(5, 4), nullable=False, default=0)
    mean_time_to_acknowledge = db.Column(db.Integer, nullable=False, default=0)
    created_at = db.Column(db.TIMESTAMPTZ, nullable=False, default=_utcnow)


# ---------------------------------------------------------------------------
# audit_logs
# ---------------------------------------------------------------------------
class AuditLog(db.Model):
    __tablename__ = "audit_logs"

    id = db.Column(db.Integer, primary_key=True)
    user_id = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=False, index=True)
    action = db.Column(db.String(80), nullable=False)
    entity_type = db.Column(db.String(40), nullable=False)
    entity_id = db.Column(db.Integer, nullable=False)
    before_json = db.Column(db.JSON, nullable=True)
    after_json = db.Column(db.JSON, nullable=True)
    created_at = db.Column(db.TIMESTAMPTZ, nullable=False, default=_utcnow, index=True)

"""Marshmallow schemas for serialisation."""
from .extensions import ma
from .models import (
    User, Service, BackendJob, AlertEvent, AlertFeedback,
    SuppressionRule, ThresholdConfig, Recommendation,
    EvaluationRun, AuditLog,
)


# ---------------------------------------------------------------------------
# User
# ---------------------------------------------------------------------------
class UserSchema(ma.SQLAlchemyAutoSchema):
    class Meta:
        model = User
        load_instance = True
        include_fk = True


# ---------------------------------------------------------------------------
# Service
# ---------------------------------------------------------------------------
class ServiceSchema(ma.SQLAlchemyAutoSchema):
    class Meta:
        model = Service
        load_instance = True

    jobs_count = ma.Method("get_jobs_count")
    alerts_count = ma.Method("get_alerts_count")

    def get_jobs_count(self, obj):
        return obj.jobs.count() if obj.jobs else 0

    def get_alerts_count(self, obj):
        from .models import AlertEvent, BackendJob
        return (
            AlertEvent.query.join(BackendJob)
            .filter(BackendJob.service_id == obj.id)
            .count()
        )


# ---------------------------------------------------------------------------
# BackendJob
# ---------------------------------------------------------------------------
class BackendJobSchema(ma.SQLAlchemyAutoSchema):
    class Meta:
        model = BackendJob
        load_instance = True
        include_fk = True

    service_name = ma.String(dump_only=True, attribute="service.name")


# ---------------------------------------------------------------------------
# AlertEvent
# ---------------------------------------------------------------------------
class AlertEventSchema(ma.SQLAlchemyAutoSchema):
    class Meta:
        model = AlertEvent
        load_instance = True
        include_fk = True

    service_id = ma.Method("get_service_id")
    service_name = ma.Method("get_service_name")

    def get_service_id(self, obj):
        job = obj.job
        return job.service_id if job else None

    def get_service_name(self, obj):
        job = obj.job
        return job.service.name if job and job.service else None


class AlertEventDetailSchema(AlertEventSchema):
    """Full alert detail including related feedback."""
    feedbacks = ma.Nested("AlertFeedbackSchema", many=True, dump_only=True)


# ---------------------------------------------------------------------------
# AlertFeedback
# ---------------------------------------------------------------------------
class AlertFeedbackSchema(ma.SQLAlchemyAutoSchema):
    class Meta:
        model = AlertFeedback
        load_instance = True
        include_fk = True

    reviewer_name = ma.String(dump_only=True, attribute="reviewer.name")


# ---------------------------------------------------------------------------
# SuppressionRule
# ---------------------------------------------------------------------------
class SuppressionRuleSchema(ma.SQLAlchemyAutoSchema):
    class Meta:
        model = SuppressionRule
        load_instance = True
        include_fk = True

    service_name = ma.String(dump_only=True, attribute="service.name")
    creator_name = ma.String(dump_only=True, attribute="creator.name")


# ---------------------------------------------------------------------------
# ThresholdConfig
# ---------------------------------------------------------------------------
class ThresholdConfigSchema(ma.SQLAlchemyAutoSchema):
    class Meta:
        model = ThresholdConfig
        load_instance = True
        include_fk = True

    service_name = ma.String(dump_only=True, attribute="service.name")


# ---------------------------------------------------------------------------
# Recommendation
# ---------------------------------------------------------------------------
class RecommendationSchema(ma.SQLAlchemyAutoSchema):
    class Meta:
        model = Recommendation
        load_instance = True
        include_fk = True

    service_name = ma.String(dump_only=True, attribute="service.name")


# ---------------------------------------------------------------------------
# EvaluationRun
# ---------------------------------------------------------------------------
class EvaluationRunSchema(ma.SQLAlchemyAutoSchema):
    class Meta:
        model = EvaluationRun
        load_instance = True


# ---------------------------------------------------------------------------
# AuditLog
# ---------------------------------------------------------------------------
class AuditLogSchema(ma.SQLAlchemyAutoSchema):
    class Meta:
        model = AuditLog
        load_instance = True
        include_fk = True

    actor_name = ma.String(dump_only=True, attribute="actor.name")

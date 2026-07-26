"""Seed the database with sample data for demo and testing.

Usage:
    python seed.py          # inserts seed data
    python seed.py --reset   # drops and re-creates all tables, then seeds
"""
import sys
from app import create_app
from app.extensions import db
from app.models import (
    User, Service, BackendJob, AlertEvent, AlertFeedback,
    SuppressionRule, ThresholdConfig, Recommendation,
    EvaluationRun,
)
from app.services.alert_scoring import evaluate_job
from app.services.suppression_engine import check_suppression_rules


def seed(app):
    with app.app_context():
        # ------------------------------------------------------------------
        # Users
        # ------------------------------------------------------------------
        users = [
            User(name="Alice Chen", email="alice@example.com", role="admin"),
            User(name="Bob Martinez", email="bob@example.com", role="sre"),
            User(name="Carol Wu", email="carol@example.com", role="operator"),
            User(name="Dan Park", email="dan@example.com", role="operator"),
        ]
        db.session.add_all(users)
        db.session.flush()

        # ------------------------------------------------------------------
        # Services
        # ------------------------------------------------------------------
        services = [
            Service(name="payment-worker", owner_team="platform", criticality="critical",
                    description="Real-time payment processing worker"),
            Service(name="retailer-sync", owner_team="integration", criticality="high",
                    description="Retailer inventory & catalog sync pipeline"),
            Service(name="address-normalizer", owner_team="logistics", criticality="medium",
                    description="Address validation and geocoding service"),
            Service(name="billing-worker", owner_team="finance", criticality="high",
                    description="Daily billing and invoice generation"),
            Service(name="queue-drain", owner_team="platform", criticality="medium",
                    description="Dead-letter queue drain and replay worker"),
            Service(name="inventory-sync", owner_team="operations", criticality="medium",
                    description="Nightly inventory synchronization workflow"),
        ]
        db.session.add_all(services)
        db.session.flush()

        # ------------------------------------------------------------------
        # Backend Jobs (15 rows)
        # ------------------------------------------------------------------
        job_data = [
            (1, "payment-settlement", "worker-01", "timeout", 12400, 830, 4, 2, 1800, 1200, 5, 0, 18),
            (1, "payment-settlement", "worker-01", "completed", 3200, 210, 0, 0, 120, 1200, 5, 0, 22),
            (1, "payment-refund", "worker-02", "failed", 8900, 1450, 3, 4, 3200, 800, 3, 1, 14),
            (2, "catalog-price-sync", "worker-03", "timeout", 15200, 920, 5, 3, 2400, 1100, 6, 1, 16),
            (2, "catalog-price-sync", "worker-03", "completed_with_failures", 6400, 480, 2, 2, 800, 900, 4, 0, 20),
            (2, "inventory-snapshot", "worker-04", "completed", 2800, 180, 0, 0, 90, 1300, 7, 0, 25),
            (3, "address-validation", "worker-05", "timeout", 13800, 1100, 4, 3, 2100, 950, 5, 1, 15),
            (3, "geocode-batch", "worker-05", "completed_with_failures", 7200, 560, 3, 1, 1100, 1000, 4, 0, 19),
            (3, "geocode-batch", "worker-06", "completed", 2600, 160, 0, 1, 100, 1400, 8, 0, 28),
            (4, "invoice-generation", "worker-07", "timeout", 14600, 1050, 5, 5, 2600, 700, 3, 2, 11),
            (4, "invoice-generation", "worker-07", "failed", 9200, 890, 4, 4, 1800, 850, 4, 0, 17),
            (4, "billing-export", "worker-08", "completed", 3500, 240, 0, 0, 150, 1500, 6, 0, 24),
            (5, "dlq-drain", "worker-08", "completed_with_failures", 5800, 390, 2, 3, 950, 1100, 5, 0, 21),
            (5, "dlq-replay", "worker-08", "timeout", 15100, 1280, 5, 4, 3000, 780, 4, 1, 13),
            (1, "payment-settlement", "worker-02", "completed", 3100, 200, 0, 0, 80, 1600, 9, 0, 30),
        ]
        jobs = []
        for (svc_id, name, worker, status, dur, lat, retry, err, qdelay,
             proc, fail, timeout, tput) in job_data:
            job = BackendJob(
                service_id=svc_id, job_name=name, worker_id=worker,
                status=status, duration_ms=dur, api_latency_ms=lat,
                retry_count=retry, error_count=err, queue_delay_ms=qdelay,
                processed_count=proc, failed_count=fail,
                timeout_count=timeout, throughput_per_minute=tput,
            )
            db.session.add(job)
            jobs.append(job)
        db.session.flush()

        # ------------------------------------------------------------------
        # Alert events (evaluate all jobs)
        # ------------------------------------------------------------------
        alerts = []
        for job in jobs:
            svc = next(s for s in services if s.id == job.service_id)
            result = evaluate_job(job, svc, "feedback")
            suppression = check_suppression_rules(job, result)
            if suppression["suppress"]:
                result["decision"] = "suppress"
                result["applied_rules"] = [r["rule_name"] for r in suppression["matched"]]

            alert = AlertEvent(
                job_id=job.id,
                severity=result["severity"],
                score=result["score"],
                utility=result["utility"],
                decision=result["decision"],
                decision_reason="; ".join(result["decision_reason"]),
                applied_rules_json=result["applied_rules"],
                confidence=result["confidence"],
                status="open",
                is_duplicate=len(suppression.get("matched", [])) > 0,
                duplicate_group_key=suppression.get("duplicate_group_key"),
                is_actionable=result["is_actionable"],
            )
            db.session.add(alert)
            alerts.append(alert)
        db.session.flush()

        # ------------------------------------------------------------------
        # Alert Feedback (10 rows)
        # ------------------------------------------------------------------
        feedbacks = [
            AlertFeedback(alert_id=alerts[0].id, user_id=2, outcome="real_incident",
                          operator_action="escalate", note="Payment timeout requires immediate investigation",
                          applied_to_ranking=True),
            AlertFeedback(alert_id=alerts[2].id, user_id=3, outcome="false_positive",
                          operator_action="close", note="Refund failure was expected during maintenance",
                          applied_to_ranking=True),
            AlertFeedback(alert_id=alerts[3].id, user_id=2, outcome="real_incident",
                          operator_action="escalate", note="Catalog sync timeout blocking downstream jobs",
                          applied_to_ranking=True),
            AlertFeedback(alert_id=alerts[6].id, user_id=3, outcome="noisy",
                          operator_action="close", note="Address validation timeout — transient network issue",
                          applied_to_ranking=True),
            AlertFeedback(alert_id=alerts[9].id, user_id=2, outcome="real_incident",
                          operator_action="escalate", note="Billing timeout affecting finance reports",
                          applied_to_ranking=True),
            AlertFeedback(alert_id=alerts[4].id, user_id=4, outcome="expected_behavior",
                          operator_action="confirm",
                          note="Completed with failures is normal for this sync job",
                          applied_to_ranking=True),
            AlertFeedback(alert_id=alerts[7].id, user_id=4, outcome="duplicate",
                          operator_action="close", note="Same geocode batch failure already under investigation",
                          applied_to_ranking=True),
            AlertFeedback(alert_id=alerts[10].id, user_id=2, outcome="useful",
                          operator_action="confirm",
                          note="Invoice generation failure pattern identified",
                          applied_to_ranking=True),
            AlertFeedback(alert_id=alerts[12].id, user_id=3, outcome="needs_more_information",
                          operator_action="confirm",
                          note="DLQ drain completed with failures — need to check downstream",
                          applied_to_ranking=False),
            AlertFeedback(alert_id=alerts[13].id, user_id=2, outcome="real_incident",
                          operator_action="escalate", note="DLQ replay timeout critical for queue health",
                          applied_to_ranking=True),
        ]
        db.session.add_all(feedbacks)
        # Update alert statuses for closed/escalated feedbacks
        for fb in feedbacks:
            alert = AlertEvent.query.get(fb.alert_id)
            if fb.operator_action == "close":
                alert.status = "closed"
            elif fb.operator_action == "escalate":
                alert.status = "escalated"
        db.session.flush()

        # ------------------------------------------------------------------
        # Suppression Rules
        # ------------------------------------------------------------------
        rules = [
            SuppressionRule(
                service_id=1, rule_name="Suppress retry bursts under maintenance window",
                rule_type="expected_maintenance",
                condition_json={"retry_count_gte": 3, "maintenance_window": True},
                active=True, created_by=1,
            ),
            SuppressionRule(
                service_id=2, rule_name="Group duplicate catalog sync failures",
                rule_type="duplicate_grouping",
                condition_json={"same_status": True, "window_minutes": 10},
                active=True, created_by=1,
            ),
            SuppressionRule(
                service_id=3, rule_name="Suppress transient address validation retries",
                rule_type="transient_retry",
                condition_json={"max_retry_count": 2, "max_error_count": 2},
                active=True, created_by=2,
            ),
            SuppressionRule(
                service_id=5, rule_name="Suppress low-severity DLQ noise",
                rule_type="low_severity_noise",
                condition_json={"score_lt": 0.35},
                active=True, created_by=1,
            ),
            SuppressionRule(
                service_id=4, rule_name="Group duplicate billing failures",
                rule_type="duplicate_grouping",
                condition_json={"same_status": True, "window_minutes": 15},
                active=False, created_by=1,
            ),
        ]
        db.session.add_all(rules)
        db.session.flush()

        # ------------------------------------------------------------------
        # Threshold Configs
        # ------------------------------------------------------------------
        thresholds = [
            ThresholdConfig(
                service_id=1, metric_name="score", threshold_value=0.58,
                strategy="threshold", version="v1.0", status="active",
                active=True, recommended_by=1, approved_by=1,
            ),
            ThresholdConfig(
                service_id=2, metric_name="score", threshold_value=0.55,
                strategy="threshold", version="v2.0", status="active",
                active=True, recommended_by=2, approved_by=1,
            ),
            ThresholdConfig(
                service_id=3, metric_name="score", threshold_value=0.50,
                strategy="feedback", version="v1.5", status="active",
                active=True, recommended_by=1, approved_by=1,
            ),
            ThresholdConfig(
                service_id=4, metric_name="retry_count", threshold_value=3.0,
                strategy="threshold", version="v1.0", status="active",
                active=True, recommended_by=1, approved_by=2,
            ),
            ThresholdConfig(
                service_id=5, metric_name="queue_delay_ms", threshold_value=2000.0,
                strategy="rules", version="v1.0", status="active",
                active=True, recommended_by=2, approved_by=1,
            ),
        ]
        db.session.add_all(thresholds)
        db.session.flush()

        # ------------------------------------------------------------------
        # Recommendations
        # ------------------------------------------------------------------
        recs = [
            Recommendation(
                service_id=1, recommendation_type="threshold",
                current_value_json={"score": 0.58},
                recommended_value_json={"score": 0.48},
                reason="Feedback-driven analysis suggests lowering threshold for payment-worker",
                confidence=0.82, status="pending",
            ),
            Recommendation(
                service_id=2, recommendation_type="strategy",
                current_value_json={"strategy": "threshold"},
                recommended_value_json={"strategy": "feedback"},
                reason="Retailer-sync shows high correlation with feedback labels — feedback strategy recommended",
                confidence=0.76, status="pending",
            ),
            Recommendation(
                service_id=3, recommendation_type="suppression",
                current_value_json={"active_rules": 1},
                recommended_value_json={"active_rules": 2},
                reason="Address normalizer has a new transient retry pattern — additional suppression rule suggested",
                confidence=0.68, status="approved", reviewed_by=1,
            ),
        ]
        db.session.add_all(recs)
        db.session.flush()

        # ------------------------------------------------------------------
        # Evaluation Runs
        # ------------------------------------------------------------------
        eval_runs = [
            EvaluationRun(strategy="threshold", alerts_sent=42, false_positives=11,
                          duplicate_rate=0.15, alert_reduction=0.24, precision=0.72,
                          recall=0.86, mean_time_to_acknowledge=210),
            EvaluationRun(strategy="rules", alerts_sent=38, false_positives=9,
                          duplicate_rate=0.13, alert_reduction=0.30, precision=0.76,
                          recall=0.89, mean_time_to_acknowledge=165),
            EvaluationRun(strategy="feedback", alerts_sent=35, false_positives=7,
                          duplicate_rate=0.10, alert_reduction=0.36, precision=0.79,
                          recall=0.91, mean_time_to_acknowledge=142),
        ]
        db.session.add_all(eval_runs)

        # ------------------------------------------------------------------
        # Commit all
        # ------------------------------------------------------------------
        db.session.commit()

        print("✅ Seed data inserted!")
        print(f"   users:              {User.query.count()}")
        print(f"   services:           {Service.query.count()}")
        print(f"   backend_jobs:       {BackendJob.query.count()}")
        print(f"   alert_events:       {AlertEvent.query.count()}")
        print(f"   alert_feedback:     {AlertFeedback.query.count()}")
        print(f"   suppression_rules:  {SuppressionRule.query.count()}")
        print(f"   threshold_configs:  {ThresholdConfig.query.count()}")
        print(f"   recommendations:    {Recommendation.query.count()}")
        print(f"   evaluation_runs:    {EvaluationRun.query.count()}")


if __name__ == "__main__":
    app = create_app()

    if "--reset" in sys.argv:
        with app.app_context():
            db.drop_all()
            print("🗑️  All tables dropped.")
            db.create_all()
            print("🏗️  All tables re-created.")
    else:
        with app.app_context():
            db.create_all()
            print("🏗️  Tables created (if not exist).")

    seed(app)

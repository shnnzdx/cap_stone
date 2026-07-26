"""Alert Triage Engine — Flask application factory."""
import os
from flask import Flask
from .extensions import db, ma, cors


def create_app(test_config=None):
    app = Flask(__name__)

    # Configuration
    app.config["SQLALCHEMY_DATABASE_URI"] = os.getenv(
        "DATABASE_URL", "postgresql://postgres:password@localhost:5432/capstone_alerting"
    )
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    app.config["SECRET_KEY"] = os.getenv("SECRET_KEY", "dev-secret-key")
    app.config["JSON_SORT_KEYS"] = False

    if test_config:
        app.config.update(test_config)

    # Init extensions
    db.init_app(app)
    ma.init_app(app)
    cors.init_app(app)

    # Register blueprints
    from .routes.services import services_bp
    from .routes.jobs import jobs_bp
    from .routes.alerts import alerts_bp
    from .routes.dashboard import dashboard_bp
    from .routes.rules import rules_bp
    from .routes.thresholds import thresholds_bp
    from .routes.evaluation import evaluation_bp
    from .routes.audit import audit_bp
    from .routes.recommendations import recommendations_bp

    app.register_blueprint(services_bp, url_prefix="/api/v1")
    app.register_blueprint(jobs_bp, url_prefix="/api/v1")
    app.register_blueprint(alerts_bp, url_prefix="/api/v1")
    app.register_blueprint(dashboard_bp, url_prefix="/api/v1")
    app.register_blueprint(rules_bp, url_prefix="/api/v1")
    app.register_blueprint(thresholds_bp, url_prefix="/api/v1")
    app.register_blueprint(evaluation_bp, url_prefix="/api/v1")
    app.register_blueprint(audit_bp, url_prefix="/api/v1")
    app.register_blueprint(recommendations_bp, url_prefix="/api/v1")

    # Health check
    @app.get("/api/v1/health")
    def health():
        return {"status": "ok", "message": "Alert Triage Engine API is running"}

    return app

"""Audit log helper."""
import json
from ..extensions import db
from ..models import AuditLog
from datetime import datetime, timezone


def write_audit_log(user_id: int, action: str, entity_type: str, entity_id: int,
                    before: dict = None, after: dict = None) -> AuditLog:
    """Create an audit log entry and return it."""
    log = AuditLog(
        user_id=user_id,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        before_json=before,
        after_json=after,
        created_at=datetime.now(timezone.utc),
    )
    db.session.add(log)
    return log

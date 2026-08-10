from __future__ import annotations

from contextlib import contextmanager

from fastapi.testclient import TestClient
from sqlalchemy.orm import Session

from app.api import main as api
from app.db.models import ChangeProposal
from app.domain.decisions import orchestrator as orch


@contextmanager
def _client(db: Session):
    api.app.dependency_overrides[api.get_session] = lambda: db
    try:
        with TestClient(api.app) as client:
            yield client
    finally:
        api.app.dependency_overrides.clear()


def test_get_proposal_includes_deadline(db: Session, full_trip: dict):
    outcome = orch.propose_change(
        db, full_trip["dinner"], {"start_hour": 20.0}, full_trip["me"].id
    )
    proposal = db.get(ChangeProposal, outcome.proposal_id)

    with _client(db) as client:
        response = client.get(
            f"/api/proposals/{proposal.id}",
            headers={"X-Membership-Id": full_trip["me"].id},
        )

    assert response.status_code == 200
    body = response.json()
    assert body["deadline"] == proposal.deadline.isoformat()


def test_extend_proposal_api_returns_deadline_and_rejects_second_extend(
    db: Session, full_trip: dict
):
    outcome = orch.propose_change(
        db, full_trip["dinner"], {"start_hour": 20.0}, full_trip["me"].id
    )
    proposal = db.get(ChangeProposal, outcome.proposal_id)

    with _client(db) as client:
        first = client.post(
            f"/api/proposals/{proposal.id}/extend",
            headers={"X-Membership-Id": full_trip["me"].id},
        )
        second = client.post(
            f"/api/proposals/{proposal.id}/extend",
            headers={"X-Membership-Id": full_trip["me"].id},
        )

    assert first.status_code == 200
    body = first.json()
    assert body["deadline"]
    assert body["extended_at"]
    assert second.status_code == 409

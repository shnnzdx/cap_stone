from __future__ import annotations

import re
from contextlib import contextmanager
from datetime import date, datetime

from fastapi.testclient import TestClient
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api import main as api
from app.agents import base
from app.db.models import ChangeProposal, DecisionRound, PlanItem


@contextmanager
def _client(db: Session):
    api.app.dependency_overrides[api.get_session] = lambda: db
    try:
        with TestClient(api.app) as client:
            yield client
    finally:
        api.app.dependency_overrides.clear()


def _headers(membership_id: str) -> dict:
    return {"X-Membership-Id": membership_id}


def _snapshot(db: Session, model) -> list[tuple]:
    rows = db.scalars(select(model).order_by(model.id)).all()
    cols = list(model.__table__.columns)
    return [
        tuple((col.name, _stable(getattr(row, col.name))) for col in cols)
        for row in rows
    ]


def _stable(value):
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    if isinstance(value, (dict, list)):
        return repr(value)
    return value


def test_chat_mock_flow_returns_reply_change_and_verdict(monkeypatch, db: Session, full_trip: dict):
    monkeypatch.setenv("MOCK_AI", "1")
    with _client(db) as client:
        response = client.post(
            f"/api/trips/{full_trip['trip'].id}/chat",
            headers=_headers(full_trip["me"].id),
            json={
                "message": "I want to go shopping this afternoon",
                "item_id": full_trip["art"].id,
            },
        )

    assert response.status_code == 200
    body = response.json()
    assert not re.search(r"[\u4e00-\u9fff]", body["reply"])
    assert body["proposed_change"]["item_id"] == full_trip["art"].id
    assert body["proposed_change"]["item_title"] == "Art Institute of Chicago"
    assert body["proposed_change"]["patch"]["title"] == "Magnificent Mile shopping"
    assert body["proposed_change"]["patch"]["place"] == "Magnificent Mile"
    assert body["proposed_change"]["verdict"]["path"] == "notice"


def test_chat_is_read_only(monkeypatch, db: Session, full_trip: dict):
    monkeypatch.setenv("MOCK_AI", "1")
    before = {
        PlanItem: _snapshot(db, PlanItem),
        DecisionRound: _snapshot(db, DecisionRound),
        ChangeProposal: _snapshot(db, ChangeProposal),
    }

    with _client(db) as client:
        response = client.post(
            f"/api/trips/{full_trip['trip'].id}/chat",
            headers=_headers(full_trip["me"].id),
            json={
                "message": "Move this to 3:30 PM and make it shopping",
                "item_id": full_trip["art"].id,
            },
        )

    assert response.status_code == 200
    assert response.json()["proposed_change"]["verdict"]["path"] == "notice"
    assert {
        PlanItem: _snapshot(db, PlanItem),
        DecisionRound: _snapshot(db, DecisionRound),
        ChangeProposal: _snapshot(db, ChangeProposal),
    } == before


def test_chat_asks_when_it_cannot_identify_the_item(monkeypatch, db: Session, full_trip: dict):
    monkeypatch.setenv("MOCK_AI", "1")

    with _client(db) as client:
        response = client.post(
            f"/api/trips/{full_trip['trip'].id}/chat",
            headers=_headers(full_trip["me"].id),
            json={"message": "I want to go shopping on Tuesday afternoon"},
        )

    assert response.status_code == 200
    body = response.json()
    assert body["proposed_change"] is None
    assert "which itinerary item" in body["reply"].lower()
    assert not re.search(r"[\u4e00-\u9fff]", body["reply"])


def test_chat_prompt_does_not_include_identity_or_private_wording(
    monkeypatch, db: Session, full_trip: dict
):
    monkeypatch.setenv("MOCK_AI", "1")
    prompts: list[str] = []
    original = base.call_model

    def capturing_call_model(**kwargs):
        prompts.append(kwargs["user"])
        return original(**kwargs)

    monkeypatch.setattr(base, "call_model", capturing_call_model)

    with _client(db) as client:
        response = client.post(
            f"/api/trips/{full_trip['trip'].id}/chat",
            headers=_headers(full_trip["me"].id),
            json={
                "message": "Move Art Institute to 8 AM",
                "item_id": full_trip["art"].id,
            },
        )

    assert response.status_code == 200
    blob = "\n".join(prompts)
    assert "No activities before 9:00 AM" not in blob
    for membership in full_trip["members"]:
        assert membership.id not in blob
    assert "M0" not in blob
    assert "M1" not in blob


def test_chat_degrades_when_openai_is_unavailable_and_classify_still_works(
    monkeypatch, db: Session, full_trip: dict
):
    monkeypatch.delenv("MOCK_AI", raising=False)
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)

    with _client(db) as client:
        chat_response = client.post(
            f"/api/trips/{full_trip['trip'].id}/chat",
            headers=_headers(full_trip["me"].id),
            json={
                "message": "Move this to 3:30 PM",
                "item_id": full_trip["art"].id,
            },
        )
        classify_response = client.post(
            f"/api/plans/items/{full_trip['art'].id}/classify",
            headers=_headers(full_trip["me"].id),
            json={"start_hour": 15.5, "request": "Move this to 3:30 PM"},
        )

    assert chat_response.status_code == 200
    assert chat_response.json()["proposed_change"] is None
    assert "could not read" in chat_response.json()["reply"].lower()
    assert not re.search(r"[\u4e00-\u9fff]", chat_response.json()["reply"])
    assert classify_response.status_code == 200
    assert classify_response.json()["path"] == "notice"

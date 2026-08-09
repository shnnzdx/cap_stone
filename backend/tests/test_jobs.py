"""定时结算和地图坐标。"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from app.db.models import DecisionRound, PlanChange
from app.domain.constraints.types import Settledness
from app.domain.decisions import orchestrator as orch


def _open_round(db, full_trip):
    full_trip["art"].settledness = Settledness.TOUCHED.value
    db.flush()
    outcome = orch.propose_change(
        db, full_trip["art"], {"title": "购物"}, full_trip["me"].id
    )
    return db.get(DecisionRound, outcome.round_id)


def test_nothing_settles_before_the_deadline(db, full_trip):
    _open_round(db, full_trip)
    assert orch.settle_due_rounds(db) == []


def test_an_overdue_round_settles_on_its_own(db, full_trip):
    """到点了没人管,系统自己结算 —— 不需要谁点按钮。"""
    round_ = _open_round(db, full_trip)
    orch.cast_vote(db, round_, full_trip["members"][0].id, "requested")
    round_.deadline = datetime.now(timezone.utc) - timedelta(seconds=1)
    db.flush()

    assert orch.settle_due_rounds(db) == [round_.id]
    assert round_.status == "closed"
    assert full_trip["art"].settledness == Settledness.SETTLED.value


def test_running_the_job_twice_does_not_double_apply(db, full_trip):
    """定时任务重复跑是常态,不能改两次行程。"""
    round_ = _open_round(db, full_trip)
    orch.cast_vote(db, round_, full_trip["members"][0].id, "requested")
    round_.deadline = datetime.now(timezone.utc) - timedelta(seconds=1)
    db.flush()

    orch.settle_due_rounds(db)
    log_len = db.query(PlanChange).count()
    assert orch.settle_due_rounds(db) == []
    assert db.query(PlanChange).count() == log_len


def test_a_round_with_zero_votes_keeps_the_current_plan(db, full_trip):
    """全组都没投,到点了也得有个结果 —— 维持原样,不能永远挂着。"""
    round_ = _open_round(db, full_trip)
    round_.deadline = datetime.now(timezone.utc) - timedelta(seconds=1)
    db.flush()

    orch.settle_due_rounds(db)
    assert round_.winning_option_id == "keep"
    assert full_trip["art"].title == "Art Institute of Chicago"


# ————————————————————— 地图坐标 —————————————————————


def test_changing_a_place_moves_the_map_pin(db, full_trip):
    item = full_trip["art"]
    item.lat, item.lng = 41.8796, -87.6237
    db.flush()

    orch.propose_change(
        db, item,
        {"title": "Millennium Park", "place": "Millennium Park",
         "lat": 41.8826, "lng": -87.6226},
        full_trip["me"].id,
    )

    assert (item.lat, item.lng) == (41.8826, -87.6226)


def test_coordinates_never_affect_which_path_a_change_takes(db, full_trip):
    """挪地图上的点不是"碰硬底线",不该把改动顶成最贵那条路。"""
    from app.domain.constraints.types import Path

    outcome = orch.propose_change(
        db, full_trip["art"], {"lat": 41.9, "lng": -87.7}, full_trip["me"].id
    )
    assert outcome.classification.path is Path.NOTICE

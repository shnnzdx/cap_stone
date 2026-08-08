"""偏好、六种约束、以及"改严了撞到什么"的扫描。"""

from __future__ import annotations

from datetime import date

import pytest
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.db.models import MemberConstraint, MemberConstraintPrivate, PlanItem
from app.domain.preferences import service as pref


def _add(db, membership, kind, params, text="", importance="required"):
    return pref.add_constraint(
        db, membership, kind=kind, params=params,
        importance=importance, original_text=text,
    )


# ————————————————————— 只能碰自己的 —————————————————————


def test_you_cannot_touch_someone_elses_constraint(db: Session, full_trip: dict):
    row, _ = _add(db, full_trip["members"][0], "time_window", {"earliest_hour": 9.0})

    with pytest.raises(pref.NotYours):
        pref.update_constraint(db, full_trip["members"][1], row.id, params={})
    with pytest.raises(pref.NotYours):
        pref.delete_constraint(db, full_trip["members"][1], row.id)


def test_a_missing_constraint_and_someone_elses_look_identical(db, full_trip):
    """不存在和不是你的，回同一句话 —— 别让人靠错误信息试探出别人有哪些约束。"""
    row, _ = _add(db, full_trip["members"][0], "dietary", {"required_tags": ["vegan"]})

    with pytest.raises(pref.NotYours) as theirs:
        pref.delete_constraint(db, full_trip["members"][1], row.id)
    with pytest.raises(pref.NotYours) as missing:
        pref.delete_constraint(db, full_trip["members"][1], "does-not-exist")

    assert str(theirs.value) == str(missing.value)


def test_only_the_six_kinds_are_accepted(db, full_trip):
    with pytest.raises(pref.UnknownConstraintKind):
        _add(db, full_trip["me"], "must_be_sunny", {})


# ————————————————————— 原话只有自己看得到 —————————————————————


def test_my_own_wording_comes_back_to_me(db, full_trip):
    secret = "My back is bad, I cannot walk far"
    row, _ = _add(db, full_trip["me"], "walk_limit", {"max_km_per_day": 3.0}, text=secret)

    mine = pref.read_mine(db, full_trip["me"])
    found = next(c for c in mine["constraints"] if c["id"] == row.id)
    assert found["original_text"] == secret


def test_the_member_list_never_carries_wording_or_params(db, full_trip):
    """名单只回答"交没交"，绝不回答"交了什么"。"""
    secret = "Chemo makes mornings impossible"
    _add(db, full_trip["me"], "time_window", {"earliest_hour": 9.0}, text=secret)
    pref.save_mine(db, full_trip["me"], pref.PreferenceData())

    blob = repr(pref.list_members(db, full_trip["members"][1]))

    assert secret not in blob
    assert "earliest_hour" not in blob
    assert "time_window" not in blob


# ————————————————————— 交没交，组织者看得到 —————————————————————


def test_saving_preferences_marks_you_as_submitted(db, full_trip):
    assert full_trip["me"].status != "preferences_submitted"

    pref.save_mine(db, full_trip["me"], pref.PreferenceData())

    assert full_trip["me"].status == "preferences_submitted"
    roster = pref.list_members(db, full_trip["me"])
    assert roster["submitted"] == 1
    assert roster["total"] == 6


def test_top_interests_are_capped_at_three(db, full_trip):
    """什么都想要等于没有偏好。"""
    saved = pref.save_mine(
        db, full_trip["me"],
        pref.PreferenceData(top_interests=("food", "art", "nature", "nightlife")),
    )
    assert len(saved["preference"]["top_interests"]) == 3


# ————————————————————— 改严了：只报告，不自动改 —————————————————————


def test_a_stricter_rule_reports_what_it_hits(db, full_trip):
    """Art Institute 在 14:00。加一条"不晚于 12 点"就该撞上它。"""
    _, conflicts = _add(db, full_trip["me"], "time_window", {"latest_hour": 12.0})

    hit = [c for c in conflicts if c["item_id"] == full_trip["art"].id]
    assert hit, conflicts
    assert hit[0]["code"] == "TIME_WINDOW"
    assert hit[0]["item_title"] == "Art Institute of Chicago"
    assert hit[0]["settledness"] == "loose"


def test_reporting_a_conflict_does_not_touch_the_plan(db, full_trip):
    """这条守的是"只报告不自动改"。自动修复要等 Planner agent。"""
    before = {i.id: (i.title, i.start_hour) for i in db.scalars(select(PlanItem))}

    _add(db, full_trip["me"], "time_window", {"latest_hour": 12.0})

    after = {i.id: (i.title, i.start_hour) for i in db.scalars(select(PlanItem))}
    assert before == after


def test_a_looser_rule_hits_nothing(db, full_trip):
    _, conflicts = _add(db, full_trip["me"], "time_window", {"earliest_hour": 5.0})
    assert conflicts == []


def test_a_flexible_rule_is_not_scanned(db, full_trip):
    """flexible 是"尽量满足"，不该报成冲突。"""
    _, conflicts = _add(
        db, full_trip["me"], "time_window", {"latest_hour": 12.0},
        importance="flexible",
    )
    assert conflicts == []


def test_relaxing_a_rule_clears_its_conflicts(db, full_trip):
    row, conflicts = _add(db, full_trip["me"], "time_window", {"latest_hour": 12.0})
    assert conflicts

    _, after = pref.update_constraint(db, full_trip["me"], row.id, params={"latest_hour": 23.0})
    assert after == []


def test_deleting_a_constraint_takes_its_wording_with_it(db, full_trip):
    row, _ = _add(db, full_trip["me"], "dietary", {"required_tags": ["vegan"]}, text="private")
    pref.delete_constraint(db, full_trip["me"], row.id)

    assert db.get(MemberConstraint, row.id) is None
    assert db.get(MemberConstraintPrivate, row.id) is None

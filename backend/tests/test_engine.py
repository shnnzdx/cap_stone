"""判定引擎的测试。

每条测试对应分流图里的一条边。图改了,这里必须跟着改——反过来也一样。
"""

from datetime import date

import pytest

from app.domain.constraints.engine import classify
from app.domain.constraints.types import (
    Constraint,
    ConstraintKind,
    Importance,
    ItemView,
    Path,
    ProposedChange,
    Settledness,
)

DAY = date(2026, 8, 15)


def item(**overrides) -> ItemView:
    base = dict(
        id="item-art-institute",
        day_date=DAY,
        start_hour=14.0,
        duration_min=120,
        price_per_person=30.0,
    )
    base.update(overrides)
    return ItemView(**base)


def change(before: ItemView, after: ItemView, **overrides) -> ProposedChange:
    base = dict(
        before=before,
        after=after,
        day_walk_km_after=1.4,
        trip_total_after=480.0,
        requested_by_membership_id="m1",
    )
    base.update(overrides)
    return ProposedChange(**base)


def required(kind: ConstraintKind, params: dict, membership_id="m2") -> Constraint:
    return Constraint(
        id=f"c-{kind.value}",
        membership_id=membership_id,
        kind=kind,
        importance=Importance.REQUIRED,
        params=params,
        private_note="填这条的人不想让别人知道原因",
    )


# ---------- ④ 都不是 → 直接改 ----------


def test_untouched_slot_with_no_conflict_applies_directly():
    result = classify(change(item(), item(start_hour=15.5)), [])
    assert result.path is Path.NOTICE


# ---------- ③ 有人碰过 → 普通轮 ----------


def test_touched_slot_opens_a_round():
    before = item(settledness=Settledness.TOUCHED)
    result = classify(change(before, item(start_hour=15.5)), [])
    assert result.path is Path.ROUND


# ---------- ② 定过了 → 重开轮 ----------


def test_settled_slot_opens_a_reopen_round_and_demands_a_reason():
    before = item(settledness=Settledness.SETTLED)
    result = classify(change(before, item(start_hour=15.5)), [])
    assert result.path is Path.REOPEN_ROUND
    assert result.needs_reason is True


# ---------- ① 硬底线 → 确认 ----------


def test_booked_item_always_needs_confirmation():
    before = item(settledness=Settledness.BOOKED)
    result = classify(change(before, item(start_hour=15.5)), [])
    assert result.path is Path.CONFIRM


def test_booking_wins_even_when_nothing_else_is_wrong():
    """已订的东西不管改成什么样都要确认,不会因为"没别的问题"就放行。"""
    before = item(settledness=Settledness.BOOKED)
    result = classify(change(before, before), [])
    assert result.path is Path.CONFIRM


@pytest.mark.parametrize(
    "kind, params, after_kwargs, extra",
    [
        (ConstraintKind.TIME_WINDOW, {"earliest_hour": 9.0}, {"start_hour": 8.0}, {}),
        (ConstraintKind.TIME_WINDOW, {"latest_hour": 22.0}, {"start_hour": 21.5}, {}),
        (ConstraintKind.DATE_RANGE, {"end": DAY}, {"day_date": date(2026, 8, 18)}, {}),
        (
            ConstraintKind.BUDGET_CEILING,
            {"max_total_per_person": 650.0},
            {},
            {"trip_total_after": 700.0},
        ),
        (
            ConstraintKind.WALK_LIMIT,
            {"max_km_per_day": 3.0},
            {},
            {"day_walk_km_after": 5.2},
        ),
        (
            ConstraintKind.AVOID_TAG,
            {"tags": ["nightlife"]},
            {"tags": frozenset({"nightlife"})},
            {},
        ),
        (
            ConstraintKind.DIETARY,
            {"required_tags": ["vegetarian"]},
            {"is_meal": True, "dietary_tags": frozenset()},
            {},
        ),
    ],
)
def test_each_required_constraint_forces_confirmation(kind, params, after_kwargs, extra):
    result = classify(
        change(item(), item(**after_kwargs), **extra), [required(kind, params)]
    )
    assert result.path is Path.CONFIRM
    assert result.findings[0].code == kind.value.upper()


def test_hard_constraint_beats_settledness():
    """碰了硬底线,不管这个时段多松都要走确认——顺序不能颠倒。"""
    result = classify(
        change(item(settledness=Settledness.LOOSE), item(start_hour=8.0)),
        [required(ConstraintKind.TIME_WINDOW, {"earliest_hour": 9.0})],
    )
    assert result.path is Path.CONFIRM


def test_required_date_range_params_accept_iso_strings():
    result = classify(
        change(item(), item(day_date=date(2026, 8, 18))),
        [required(ConstraintKind.DATE_RANGE, {"start": "2026-08-14", "end": "2026-08-17"})],
    )

    assert result.path is Path.CONFIRM
    assert result.findings[0].code == "DATE_RANGE"


def test_flexible_constraint_does_not_force_confirmation():
    """flexible 只是"尽量满足",违反了不该把改动顶成最贵的那条路。"""
    soft = Constraint(
        id="c-soft",
        membership_id="m2",
        kind=ConstraintKind.TIME_WINDOW,
        importance=Importance.FLEXIBLE,
        params={"earliest_hour": 9.0},
    )
    result = classify(change(item(), item(start_hour=8.0)), [soft])
    assert result.path is Path.NOTICE


def test_dietary_constraint_ignores_non_meal_items():
    result = classify(
        change(item(), item(is_meal=False)),
        [required(ConstraintKind.DIETARY, {"required_tags": ["vegetarian"]})],
    )
    assert result.path is Path.NOTICE


# ---------- 隐私红线 ----------


def test_findings_never_carry_identity_or_wording():
    """这条测试守的是产品承诺,不是代码细节。

    判定结果里出现姓名或偏好原文,就是把"匿名"这个卖点当场作废。
    """
    constraint = required(
        ConstraintKind.TIME_WINDOW, {"earliest_hour": 9.0}, membership_id="m-mia"
    )
    result = classify(change(item(), item(start_hour=8.0)), [constraint])

    blob = repr(result)
    assert "m-mia" not in blob
    assert constraint.private_note not in blob
    for finding in result.findings:
        assert not hasattr(finding, "membership_id")
        assert finding.affected_count == 1


def test_same_kind_hit_by_two_members_is_reported_once():
    """两个人都被同一种约束挡住,只出一条结论,数字说明有几个人受影响。"""
    result = classify(
        change(item(), item(start_hour=8.0)),
        [
            required(ConstraintKind.TIME_WINDOW, {"earliest_hour": 9.0}, "m2"),
            required(ConstraintKind.TIME_WINDOW, {"earliest_hour": 10.0}, "m3"),
        ],
    )
    assert len(result.findings) == 1
    assert result.findings[0].affected_count == 2


# ---------- 确定性 ----------


def test_same_input_always_gives_same_answer():
    """引擎不能有"今天说行明天说不行"。跑一百遍必须一模一样。"""
    payload = change(item(settledness=Settledness.TOUCHED), item(start_hour=15.5))
    answers = {classify(payload, []).path for _ in range(100)}
    assert answers == {Path.ROUND}


# ---------- 判据清单:"看得见为什么" ----------


def test_every_verdict_returns_all_four_checks():
    """四条判据每次都全给,不管走哪条路 —— 用户要看见哪些过了、哪条拦了他。"""
    result = classify(change(item(), item(start_hour=15.5)), [])
    assert [c.id for c in result.checks] == ["booking", "required", "settled", "contested"]
    assert all(c.hit is False for c in result.checks)


def test_the_hit_check_matches_the_path_taken():
    result = classify(
        change(item(), item(start_hour=8.0)),
        [required(ConstraintKind.TIME_WINDOW, {"earliest_hour": 9.0})],
    )
    hit = [c for c in result.checks if c.hit]
    assert [c.id for c in hit] == ["required"]
    assert result.path is Path.CONFIRM


def test_checks_are_returned_in_judgement_order():
    """已订的东西同时也可能违反 required,但顺序决定 booking 排前面。"""
    result = classify(
        change(item(settledness=Settledness.BOOKED), item(start_hour=8.0)),
        [required(ConstraintKind.TIME_WINDOW, {"earliest_hour": 9.0})],
    )
    ids = [c.id for c in result.checks]
    assert ids.index("booking") < ids.index("required")
    assert result.path is Path.CONFIRM
    assert result.headline == "This touches a confirmed booking"


def test_a_private_note_appears_only_on_a_hit_and_never_carries_content():
    constraint = required(
        ConstraintKind.TIME_WINDOW, {"earliest_hour": 9.0}, membership_id="m-mia"
    )
    result = classify(change(item(), item(start_hour=8.0)), [constraint])

    notes = {c.id: c.private_note for c in result.checks}
    assert notes["required"]                      # 命中的那条有提示语
    assert notes["contested"] == ""               # 没命中的没有
    assert "m-mia" not in notes["required"]
    assert constraint.private_note not in notes["required"]

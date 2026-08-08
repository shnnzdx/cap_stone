"""数据库自己守的规矩。

这些测试证明的不是"代码记得检查",而是"就算代码忘了检查,数据库也会拦下来"。
应用层的 bug 会有;这一层的保证不会。
"""

from __future__ import annotations

import pytest
from sqlalchemy.exc import IntegrityError

from app.db.models import (
    ChangeProposal,
    DecisionRound,
    MemberConstraint,
    MemberConstraintPrivate,
    PlanChange,
    ProposalDecision,
    Vote,
)


# ————————— 一个条目同时只能有一个未决决策 —————————


def test_one_item_cannot_have_two_open_rounds(db, trip_setup):
    """前端 activeRound 是单数的毛病,在这里被彻底堵死。"""
    for _ in range(2):
        db.add(
            DecisionRound(
                plan_item_id=trip_setup["item"].id,
                options=[{"id": "keep"}, {"id": "split"}],
                deadline=trip_setup["deadline"],
                status="open",
            )
        )
    with pytest.raises(IntegrityError):
        db.flush()


def test_a_closed_round_does_not_block_a_new_one(db, trip_setup):
    """结算过的轮不占位置 —— 同一个时段以后还能再开一轮。"""
    db.add(
        DecisionRound(
            plan_item_id=trip_setup["item"].id,
            options=[],
            deadline=trip_setup["deadline"],
            status="closed",
        )
    )
    db.flush()
    db.add(
        DecisionRound(
            plan_item_id=trip_setup["item"].id,
            options=[],
            deadline=trip_setup["deadline"],
            status="open",
        )
    )
    db.flush()  # 不该报错


def test_one_item_cannot_have_two_pending_proposals(db, trip_setup):
    for _ in range(2):
        db.add(
            ChangeProposal(
                plan_item_id=trip_setup["item"].id,
                action_type="edit_time",
                requested_by_membership_id=trip_setup["organizer"].id,
                status="waiting_affected_members",
            )
        )
    with pytest.raises(IntegrityError):
        db.flush()


# ————————— 一人一票,一人一次表态 —————————


def test_a_member_cannot_vote_twice_in_one_round(db, trip_setup):
    round_ = DecisionRound(
        plan_item_id=trip_setup["item"].id,
        options=[],
        deadline=trip_setup["deadline"],
    )
    db.add(round_)
    db.flush()

    db.add(Vote(round_id=round_.id, trip_membership_id=trip_setup["organizer"].id, option_id="keep"))
    db.flush()
    db.add(Vote(round_id=round_.id, trip_membership_id=trip_setup["organizer"].id, option_id="split"))
    with pytest.raises(IntegrityError):
        db.flush()


def test_a_member_cannot_decide_twice_on_one_proposal(db, trip_setup):
    proposal = ChangeProposal(
        plan_item_id=trip_setup["item"].id,
        action_type="edit_time",
        requested_by_membership_id=trip_setup["organizer"].id,
    )
    db.add(proposal)
    db.flush()

    db.add(ProposalDecision(proposal_id=proposal.id, trip_membership_id=trip_setup["participant"].id, status="accepted"))
    db.flush()
    db.add(ProposalDecision(proposal_id=proposal.id, trip_membership_id=trip_setup["participant"].id, status="declined"))
    with pytest.raises(IntegrityError):
        db.flush()


def test_no_vote_means_no_record_at_all(db, trip_setup):
    """沉默不是一条 status='abstain' 的记录,是**根本没有记录**。

    存成记录早晚会有人把它当成一种表态。
    """
    round_ = DecisionRound(
        plan_item_id=trip_setup["item"].id, options=[], deadline=trip_setup["deadline"]
    )
    db.add(round_)
    db.flush()
    db.add(Vote(round_id=round_.id, trip_membership_id=trip_setup["organizer"].id, option_id="keep"))
    db.flush()

    votes = db.query(Vote).filter_by(round_id=round_.id).all()
    assert len(votes) == 1
    assert {v.trip_membership_id for v in votes} == {trip_setup["organizer"].id}


# ————————— 私密原文和判定数据是两张表 —————————


def test_private_wording_lives_in_a_separate_table(db, trip_setup):
    """判定引擎读的那张表里,查不到用户写的那句话。"""
    constraint = MemberConstraint(
        trip_membership_id=trip_setup["organizer"].id,
        kind="time_window",
        importance="required",
        params={"earliest_hour": 9.0},
    )
    db.add(constraint)
    db.flush()
    db.add(
        MemberConstraintPrivate(
            constraint_id=constraint.id,
            original_text="化疗后早上起不来",
            visibility="planning_only",
        )
    )
    db.flush()

    fetched = db.query(MemberConstraint).filter_by(id=constraint.id).one()
    assert not hasattr(fetched, "original_text")
    assert fetched.params == {"earliest_hour": 9.0}

    columns = {c.name for c in MemberConstraint.__table__.columns}
    assert "original_text" not in columns
    assert "visibility" not in columns


# ————————— 流水账 —————————


def test_changes_accumulate_instead_of_overwriting(db, trip_setup):
    """三条路径都只往流水账追加,不覆盖。改了几次、每次怎么来的,永远查得到。"""
    for origin, patch in (
        ("ai_generate", {"title": "Art Institute of Chicago"}),
        ("notice", {"start_hour": 15.5}),
        ("round", {"title": "Park + café break"}),
    ):
        db.add(
            PlanChange(
                plan_id=trip_setup["plan"].id,
                plan_item_id=trip_setup["item"].id,
                origin=origin,
                patch=patch,
            )
        )
    db.flush()

    log = (
        db.query(PlanChange)
        .filter_by(plan_item_id=trip_setup["item"].id)
        .order_by(PlanChange.applied_at)
        .all()
    )
    assert [c.origin for c in log] == ["ai_generate", "notice", "round"]

    current = {}
    for entry in log:
        current.update(entry.patch)
    assert current == {"title": "Park + café break", "start_hour": 15.5}


def test_notices_do_not_store_who_did_it(db, trip_setup):
    """通知表故意没有 actor 字段 —— 存了早晚会被某个接口带出去。"""
    from app.db.models import UpdateNotice

    columns = {c.name for c in UpdateNotice.__table__.columns}
    assert "actor_membership_id" not in columns
    assert "actor_id" not in columns
    assert "user_id" not in columns

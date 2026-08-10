"""三条路径从提出到落地的完整测试。

这些测试跑的是真流程:改动进去 → 判定 → 执行 → 行程真的变了 / 真的没变。
"""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

import pytest

from app.db.models import (
    ChangeProposal,
    DecisionRound,
    PlanChange,
    ProposalDecision,
    UpdateNotice,
    Vote,
)
from app.domain.constraints.types import Path, Settledness
from app.domain.decisions import orchestrator as orch


# ————————————————————— 路径 A:直接改 —————————————————————


def test_a_clean_change_applies_immediately(db, full_trip):
    item = full_trip["art"]
    outcome = orch.propose_change(
        db, item, {"start_hour": 15.5}, full_trip["me"].id, request="晚一点开始"
    )

    assert outcome.classification.path is Path.NOTICE
    assert outcome.applied is True
    assert item.start_hour == 15.5
    assert item.settledness == Settledness.TOUCHED.value


def test_a_direct_change_notifies_everyone_but_asks_nothing(db, full_trip):
    orch.propose_change(db, full_trip["art"], {"start_hour": 15.5}, full_trip["me"].id)

    notice = db.query(UpdateNotice).filter_by(plan_item_id=full_trip["art"].id).one()
    assert notice.can_object is True          # 谁不同意点一下就能升级
    assert db.query(DecisionRound).count() == 0   # 但没有人被要求做任何事
    assert db.query(ChangeProposal).count() == 0


def test_every_path_writes_one_line_to_the_log(db, full_trip):
    orch.propose_change(db, full_trip["art"], {"start_hour": 15.5}, full_trip["me"].id)
    entry = db.query(PlanChange).filter_by(plan_item_id=full_trip["art"].id).one()
    assert entry.origin == "notice"
    assert entry.patch == {"start_hour": 15.5}


def test_objecting_to_a_notice_opens_a_round(db, full_trip):
    orch.propose_change(db, full_trip["art"], {"start_hour": 15.5}, full_trip["me"].id)
    notice = db.query(UpdateNotice).filter_by(plan_item_id=full_trip["art"].id).one()

    outcome = orch.object_to_notice(db, notice, request="想去河边")

    assert outcome.round_id is not None
    assert notice.can_object is False


# ————————————————————— 路径 B:投票 —————————————————————


def test_a_contested_slot_opens_a_round_instead_of_applying(db, full_trip):
    item = full_trip["art"]
    item.settledness = Settledness.TOUCHED.value
    db.flush()

    outcome = orch.propose_change(db, item, {"title": "购物"}, full_trip["me"].id)

    assert outcome.classification.path is Path.ROUND
    assert outcome.applied is False
    assert item.title == "Art Institute of Chicago"   # 行程还没变


def test_round_options_always_include_splitting_up(db, full_trip):
    full_trip["art"].settledness = Settledness.TOUCHED.value
    db.flush()
    outcome = orch.propose_change(db, full_trip["art"], {"title": "购物"}, full_trip["me"].id)

    round_ = db.get(DecisionRound, outcome.round_id)
    assert "split" in {o["id"] for o in round_.options}


def test_silence_is_never_counted_as_agreement(db, full_trip):
    """6 个人里只有 2 个投票,结算按投了的人算,另外 4 个不算同意也不阻塞。"""
    full_trip["art"].settledness = Settledness.TOUCHED.value
    db.flush()
    outcome = orch.propose_change(db, full_trip["art"], {"title": "购物"}, full_trip["me"].id)
    round_ = db.get(DecisionRound, outcome.round_id)

    orch.cast_vote(db, round_, full_trip["members"][0].id, "requested")
    orch.cast_vote(db, round_, full_trip["members"][1].id, "requested")
    winner = orch.settle_round(db, round_)

    assert winner == "requested"
    assert db.query(Vote).filter_by(round_id=round_.id).count() == 2
    assert full_trip["art"].settledness == Settledness.SETTLED.value


def test_a_tie_keeps_the_current_plan(db, full_trip):
    full_trip["art"].settledness = Settledness.TOUCHED.value
    db.flush()
    outcome = orch.propose_change(db, full_trip["art"], {"title": "购物"}, full_trip["me"].id)
    round_ = db.get(DecisionRound, outcome.round_id)

    orch.cast_vote(db, round_, full_trip["members"][0].id, "requested")
    orch.cast_vote(db, round_, full_trip["members"][1].id, "split")

    assert orch.settle_round(db, round_) == "keep"


def test_settling_twice_changes_nothing(db, full_trip):
    """定时任务可能重复跑。结算必须是幂等的。"""
    full_trip["art"].settledness = Settledness.TOUCHED.value
    db.flush()
    outcome = orch.propose_change(db, full_trip["art"], {"title": "购物"}, full_trip["me"].id)
    round_ = db.get(DecisionRound, outcome.round_id)
    orch.cast_vote(db, round_, full_trip["members"][0].id, "requested")

    first = orch.settle_round(db, round_)
    log_len = db.query(PlanChange).count()
    second = orch.settle_round(db, round_)

    assert first == second
    assert db.query(PlanChange).count() == log_len


def test_only_overdue_rounds_get_settled(db, full_trip):
    full_trip["art"].settledness = Settledness.TOUCHED.value
    db.flush()
    outcome = orch.propose_change(db, full_trip["art"], {"title": "购物"}, full_trip["me"].id)
    round_ = db.get(DecisionRound, outcome.round_id)

    assert orch.settle_due_rounds(db) == []          # 还没到期

    round_.deadline = datetime.now(timezone.utc) - timedelta(minutes=1)
    db.flush()
    assert orch.settle_due_rounds(db) == [round_.id]


# ————————————————————— 重开轮 —————————————————————


def test_reopening_a_settled_block_demands_a_reason(db, full_trip):
    full_trip["art"].settledness = Settledness.SETTLED.value
    db.flush()

    with pytest.raises(orch.ReasonRequired):
        orch.propose_change(db, full_trip["art"], {"title": "购物"}, full_trip["me"].id)


def test_reopening_with_a_reason_opens_a_high_bar_round(db, full_trip):
    full_trip["art"].settledness = Settledness.SETTLED.value
    db.flush()

    outcome = orch.propose_change(
        db, full_trip["art"], {"title": "购物"}, full_trip["me"].id, reason="下雨了"
    )

    assert outcome.classification.path is Path.REOPEN_ROUND
    round_ = db.get(DecisionRound, outcome.round_id)
    assert round_.kind == "reopen"
    assert round_.reason == "下雨了"


def test_a_minority_cannot_overturn_a_settled_decision(db, full_trip):
    """6 个人里 2 个想改 —— 不够。没表态的人算在"别折腾"那边。"""
    full_trip["art"].settledness = Settledness.SETTLED.value
    db.flush()
    outcome = orch.propose_change(
        db, full_trip["art"], {"title": "购物"}, full_trip["me"].id, reason="下雨了"
    )
    round_ = db.get(DecisionRound, outcome.round_id)

    orch.cast_vote(db, round_, full_trip["members"][0].id, "requested")
    orch.cast_vote(db, round_, full_trip["members"][1].id, "requested")

    assert orch.settle_round(db, round_) == "keep"


def test_a_clear_majority_can_overturn_a_settled_decision(db, full_trip):
    """6 个人里 4 个明确要改 —— 过半,改。"""
    full_trip["art"].settledness = Settledness.SETTLED.value
    db.flush()
    outcome = orch.propose_change(
        db, full_trip["art"], {"title": "购物"}, full_trip["me"].id, reason="下雨了"
    )
    round_ = db.get(DecisionRound, outcome.round_id)

    for member in full_trip["members"][:4]:
        orch.cast_vote(db, round_, member.id, "requested")

    assert orch.settle_round(db, round_) == "requested"


# ————————————————————— 路径 C:确认 —————————————————————


def test_touching_a_booking_needs_everyone_to_confirm(db, full_trip):
    dinner = full_trip["dinner"]
    outcome = orch.propose_change(db, dinner, {"start_hour": 20.0}, full_trip["me"].id)

    assert outcome.classification.path is Path.CONFIRM
    assert outcome.proposal_id is not None
    assert dinner.start_hour == 19.0    # 行程一个字没变


def test_the_proposer_counts_as_already_agreed(db, full_trip):
    outcome = orch.propose_change(
        db, full_trip["dinner"], {"start_hour": 20.0}, full_trip["me"].id
    )
    mine = (
        db.query(ProposalDecision)
        .filter_by(proposal_id=outcome.proposal_id, trip_membership_id=full_trip["me"].id)
        .one()
    )
    assert mine.status == "accepted"


def test_one_missing_confirmation_blocks_the_change(db, full_trip):
    outcome = orch.propose_change(
        db, full_trip["dinner"], {"start_hour": 20.0}, full_trip["me"].id
    )
    proposal = db.get(ChangeProposal, outcome.proposal_id)

    for member in full_trip["members"][:-1]:      # 差最后一个人
        applied = orch.decide_proposal(db, proposal, member.id, "accepted")

    assert applied is False
    assert full_trip["dinner"].start_hour == 19.0


def test_the_change_lands_only_when_the_last_person_agrees(db, full_trip):
    outcome = orch.propose_change(
        db, full_trip["dinner"], {"start_hour": 20.0}, full_trip["me"].id
    )
    proposal = db.get(ChangeProposal, outcome.proposal_id)

    applied = False
    for member in full_trip["members"]:
        applied = orch.decide_proposal(db, proposal, member.id, "accepted")

    assert applied is True
    assert proposal.status == "applied"
    assert full_trip["dinner"].start_hour == 20.0


def test_a_single_no_kills_the_proposal(db, full_trip):
    outcome = orch.propose_change(
        db, full_trip["dinner"], {"start_hour": 20.0}, full_trip["me"].id
    )
    proposal = db.get(ChangeProposal, outcome.proposal_id)

    orch.decide_proposal(db, proposal, full_trip["members"][0].id, "accepted")
    orch.decide_proposal(db, proposal, full_trip["members"][1].id, "declined")

    assert proposal.status == "declined"
    assert full_trip["dinner"].start_hour == 19.0


def test_withdrawing_leaves_the_plan_untouched(db, full_trip):
    outcome = orch.propose_change(
        db, full_trip["dinner"], {"start_hour": 20.0}, full_trip["me"].id
    )
    proposal = db.get(ChangeProposal, outcome.proposal_id)
    orch.withdraw_proposal(db, proposal)

    assert proposal.status == "withdrawn"
    assert full_trip["dinner"].start_hour == 19.0


def test_a_required_constraint_forces_confirmation_too(db, full_trip):
    """Mia 填了「不早于9点」,谁想把活动挪到 8 点都得走确认。"""
    outcome = orch.propose_change(
        db, full_trip["art"], {"start_hour": 8.0}, full_trip["me"].id
    )
    assert outcome.classification.path is Path.CONFIRM
    assert outcome.classification.findings[0].code == "TIME_WINDOW"


# ————————————————————— 旅行中降级 —————————————————————


def test_deadlines_shrink_once_the_trip_starts(db, full_trip):
    """人都在街上了,不跑 24 小时的异步投票。"""
    full_trip["art"].settledness = Settledness.TOUCHED.value
    full_trip["trip"].status = "traveling"
    db.flush()

    outcome = orch.propose_change(db, full_trip["art"], {"title": "购物"}, full_trip["me"].id)
    round_ = db.get(DecisionRound, outcome.round_id)
    hours = (round_.deadline - datetime.now(timezone.utc)).total_seconds() / 3600

    assert 1.5 < hours < 2.5


# ————————————————————— 一个时段同时只能有一件未决的事 —————————————————————


def test_a_second_change_on_a_busy_block_is_refused_politely(db, full_trip):
    """已经有一轮开着的时候再提改动,要给一句人话,不是 500。"""
    full_trip["art"].settledness = Settledness.TOUCHED.value
    db.flush()
    orch.propose_change(db, full_trip["art"], {"title": "购物"}, full_trip["me"].id)

    with pytest.raises(orch.AlreadyPending):
        orch.propose_change(db, full_trip["art"], {"title": "看电影"}, full_trip["members"][1].id)


def test_a_block_waiting_for_confirmations_is_also_busy(db, full_trip):
    orch.propose_change(db, full_trip["dinner"], {"start_hour": 20.0}, full_trip["me"].id)

    with pytest.raises(orch.AlreadyPending):
        orch.propose_change(db, full_trip["dinner"], {"start_hour": 21.0}, full_trip["members"][1].id)


def test_once_the_round_closes_the_block_is_free_again(db, full_trip):
    full_trip["art"].settledness = Settledness.TOUCHED.value
    db.flush()
    outcome = orch.propose_change(db, full_trip["art"], {"title": "购物"}, full_trip["me"].id)
    orch.settle_round(db, db.get(DecisionRound, outcome.round_id))

    again = orch.propose_change(
        db, full_trip["art"], {"title": "看电影"}, full_trip["me"].id, reason="换个想法"
    )
    assert again.round_id is not None


# ————————————————————— 确认也有截止时间 —————————————————————


def test_a_proposal_gets_a_deadline(db, full_trip):
    outcome = orch.propose_change(
        db, full_trip["dinner"], {"start_hour": 20.0}, full_trip["me"].id
    )
    proposal = db.get(ChangeProposal, outcome.proposal_id)
    days = (proposal.deadline - datetime.now(timezone.utc)).total_seconds() / 86400
    assert 6.9 < days < 7.1           # 规划中 7 天


def test_the_proposal_deadline_halves_once_the_trip_starts(db, full_trip):
    full_trip["trip"].status = "traveling"
    db.flush()
    outcome = orch.propose_change(
        db, full_trip["dinner"], {"start_hour": 20.0}, full_trip["me"].id
    )
    proposal = db.get(ChangeProposal, outcome.proposal_id)
    days = (proposal.deadline - datetime.now(timezone.utc)).total_seconds() / 86400
    assert 1.9 < days < 2.1           # 旅行中 2 天


def test_an_expired_proposal_is_voided_not_approved(db, full_trip):
    """这条守的是最不能破的一条:到期作废，绝不到期通过。

    到期通过 = 把没回复算成同意。
    """
    outcome = orch.propose_change(
        db, full_trip["dinner"], {"start_hour": 20.0}, full_trip["me"].id
    )
    proposal = db.get(ChangeProposal, outcome.proposal_id)
    # 只有发起人点了头，其他 5 个人没动
    proposal.deadline = datetime.now(timezone.utc) - timedelta(seconds=1)
    db.flush()

    assert orch.expire_due_proposals(db) == [proposal.id]
    assert proposal.status == "expired"
    assert full_trip["dinner"].start_hour == 19.0      # 行程一个字没变


def test_expiring_frees_the_block_for_someone_else(db, full_trip):
    """作废之后这个时段要能重新被人提 —— 否则等于被永久占住。"""
    outcome = orch.propose_change(
        db, full_trip["dinner"], {"start_hour": 20.0}, full_trip["me"].id
    )
    proposal = db.get(ChangeProposal, outcome.proposal_id)
    proposal.deadline = datetime.now(timezone.utc) - timedelta(seconds=1)
    db.flush()
    orch.expire_due_proposals(db)

    again = orch.propose_change(
        db, full_trip["dinner"], {"start_hour": 21.0}, full_trip["members"][1].id
    )
    assert again.proposal_id is not None


def test_an_already_accepted_proposal_is_not_expired(db, full_trip):
    """已经全员点头落地的，定时任务不许再动它。"""
    outcome = orch.propose_change(
        db, full_trip["dinner"], {"start_hour": 20.0}, full_trip["me"].id
    )
    proposal = db.get(ChangeProposal, outcome.proposal_id)
    for member in full_trip["members"]:
        orch.decide_proposal(db, proposal, member.id, "accepted")
    proposal.deadline = datetime.now(timezone.utc) - timedelta(seconds=1)
    db.flush()

    assert orch.expire_due_proposals(db) == []
    assert proposal.status == "applied"


# ————————————————————— 只拉真的被影响的人 —————————————————————


def test_only_the_blocked_member_is_pulled_into_the_conversation(db, full_trip):
    """碰到一个人的硬底线，就只该问那一个人 —— 不是全组 6 个。

    拉太宽的后果是提案永远凑不齐，那个时段被无限期占住。
    """
    outcome = orch.propose_change(
        db, full_trip["art"], {"start_hour": 8.0}, full_trip["members"][1].id
    )
    decisions = (
        db.query(ProposalDecision).filter_by(proposal_id=outcome.proposal_id).all()
    )
    involved = {d.trip_membership_id for d in decisions}

    # Mia（members[0]）填了"不早于9点"，发起人是 members[1]
    assert involved == {full_trip["members"][0].id, full_trip["members"][1].id}
    assert len(involved) == 2


def test_a_booking_still_needs_the_whole_group(db, full_trip):
    """已订的东西钱是大家出的，取消费用大家担 —— 这个要全组点头。"""
    outcome = orch.propose_change(
        db, full_trip["dinner"], {"start_hour": 20.0}, full_trip["me"].id
    )
    decisions = (
        db.query(ProposalDecision).filter_by(proposal_id=outcome.proposal_id).all()
    )
    assert len(decisions) == len(full_trip["members"])


def test_two_people_agreeing_is_enough_when_only_two_are_involved(db, full_trip):
    """被影响的人点完头就落地，不用等其他 4 个不相干的人。"""
    outcome = orch.propose_change(
        db, full_trip["art"], {"start_hour": 8.0}, full_trip["members"][1].id
    )
    proposal = db.get(ChangeProposal, outcome.proposal_id)

    applied = orch.decide_proposal(db, proposal, full_trip["members"][0].id, "accepted")

    assert applied is True
    assert proposal.status == "applied"
    assert full_trip["art"].start_hour == 8.0


def test_who_was_affected_never_reaches_the_verdict(db, full_trip):
    """判定结果里仍然没有身份 —— 拉谁进对话是另一条通道，不走 Classification。"""
    outcome = orch.propose_change(
        db, full_trip["art"], {"start_hour": 8.0}, full_trip["members"][1].id
    )
    blob = repr(outcome.classification)
    for member in full_trip["members"]:
        assert member.id not in blob

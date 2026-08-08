"""HTTP 接口层。

这一层**很薄**,故意的:它只做三件事 —— 收参数、调 domain、把结果转成 JSON。
所有规则都在 domain/ 里,这里一条业务判断都不写。

身份验证目前是临时的:请求头 X-Membership-Id 说自己是谁。
真的登录(邮箱 magic link)以后替换,只需要改 current_membership 这一个函数。
"""

from __future__ import annotations

import os
from contextlib import asynccontextmanager
from datetime import date

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from ..db.models import (
    ChangeProposal,
    DecisionRound,
    Plan,
    PlanChange,
    PlanItem,
    Trip,
    TripMembership,
    UpdateNotice,
    Vote,
)
from ..db.session import get_session
from ..domain.decisions import orchestrator as orch

@asynccontextmanager
async def lifespan(app: FastAPI):
    """后端一启动,定时结算就在后台转起来了 —— 不用另外开一个进程。"""
    from ..jobs import scheduler

    task = None
    if os.getenv("DISABLE_SCHEDULER") != "1":
        task = scheduler.start(app)
    yield
    if task:
        task.cancel()


app = FastAPI(title="TripSync API", version="0.1.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_methods=["*"],
    allow_headers=["*"],
)


def current_membership(
    db: Session = Depends(get_session),
    x_membership_id: str | None = Header(default=None),
) -> TripMembership:
    """临时身份。真做了登录之后,这里改成从 token 解析。"""
    if not x_membership_id:
        raise HTTPException(401, "Missing X-Membership-Id header")
    membership = db.get(TripMembership, x_membership_id)
    if membership is None:
        raise HTTPException(401, "Unknown membership")
    return membership


# ————————————————————— 输入输出的形状 —————————————————————


class ChangeRequest(BaseModel):
    title: str | None = None
    place: str | None = None
    start_hour: float | None = Field(default=None, ge=0, le=24)
    day_date: date | None = None
    price_per_person: float | None = Field(default=None, ge=0)
    # 换地点时把新坐标一起带上,地图跟着动
    lat: float | None = Field(default=None, ge=-90, le=90)
    lng: float | None = Field(default=None, ge=-180, le=180)
    request: str = ""
    reason: str | None = None

    def patch(self) -> dict:
        return {
            k: v
            for k, v in self.model_dump(exclude={"request", "reason"}).items()
            if v is not None
        }


class VoteRequest(BaseModel):
    option_id: str


class DecisionRequest(BaseModel):
    status: str = Field(pattern="^(accepted|declined)$")


def _item_out(item: PlanItem) -> dict:
    return {
        "id": item.id,
        "day_index": item.day_index,
        "day_date": item.day_date.isoformat(),
        "start_hour": item.start_hour,
        "duration_min": item.duration_min,
        "title": item.title,
        "place": item.place,
        "price_per_person": item.price_per_person,
        "source": item.source,
        "settledness": item.settledness,
        # 地图直接用这两个数字画点。换地点时它俩跟着变。
        "coords": [item.lat, item.lng] if item.lat is not None else None,
    }


def _outcome_out(outcome: orch.Outcome) -> dict:
    """判定结果转 JSON。

    注意 findings 里只有脱敏后的说法 —— 类型上就没有姓名和原文,
    所以这里不需要"记得过滤"。
    """
    verdict = outcome.classification
    return {
        "path": verdict.path.value,
        "headline": verdict.headline,
        "detail": verdict.detail,
        "needs_reason": verdict.needs_reason,
        "findings": [
            {"code": f.code, "text": f.safe_text, "affected_count": f.affected_count}
            for f in verdict.findings
        ],
        "applied": outcome.applied,
        "round_id": outcome.round_id,
        "proposal_id": outcome.proposal_id,
    }


# ————————————————————— 读 —————————————————————


@app.get("/api/health")
def health() -> dict:
    return {"ok": True}


@app.get("/api/trips/{trip_id}")
def get_trip(trip_id: str, db: Session = Depends(get_session)) -> dict:
    trip = db.get(Trip, trip_id)
    if trip is None:
        raise HTTPException(404, "Trip not found")
    return {
        "id": trip.id,
        "name": trip.name,
        "destination": trip.destination,
        "status": trip.status,
        "member_count": len(
            db.scalars(select(TripMembership).where(TripMembership.trip_id == trip_id)).all()
        ),
    }


@app.get("/api/trips/{trip_id}/plans/current")
def get_current_plan(trip_id: str, db: Session = Depends(get_session)) -> dict:
    plan = db.scalar(select(Plan).where(Plan.trip_id == trip_id))
    if plan is None:
        raise HTTPException(404, "No plan yet")
    items = db.scalars(
        select(PlanItem)
        .where(PlanItem.plan_id == plan.id)
        .order_by(PlanItem.day_index, PlanItem.start_hour)
    ).all()
    days: dict[int, list] = {}
    for item in items:
        days.setdefault(item.day_index, []).append(_item_out(item))
    return {
        "plan_id": plan.id,
        "status": plan.status,
        "estimated_total_per_person": plan.estimated_total_per_person,
        "days": [{"day_index": d, "items": v} for d, v in sorted(days.items())],
    }


@app.get("/api/trips/{trip_id}/updates")
def get_updates(trip_id: str, db: Session = Depends(get_session)) -> list[dict]:
    notices = db.scalars(
        select(UpdateNotice)
        .where(UpdateNotice.trip_id == trip_id)
        .order_by(UpdateNotice.created_at.desc())
    ).all()
    return [
        {
            "id": n.id,
            "kind": n.kind,
            "title": n.title,
            "body": n.body,
            "can_object": n.can_object,
            "plan_item_id": n.plan_item_id,
        }
        for n in notices
    ]


@app.get("/api/rounds/{round_id}")
def get_round(round_id: str, db: Session = Depends(get_session)) -> dict:
    round_ = db.get(DecisionRound, round_id)
    if round_ is None:
        raise HTTPException(404, "Round not found")
    item = db.get(PlanItem, round_.plan_item_id)
    votes = db.scalars(select(Vote).where(Vote.round_id == round_id)).all()
    total = len(
        db.scalars(
            select(TripMembership).where(TripMembership.trip_id == item.plan.trip_id)
        ).all()
    )
    tally: dict[str, int] = {}
    for vote in votes:
        tally[vote.option_id] = tally.get(vote.option_id, 0) + 1
    return {
        "id": round_.id,
        "kind": round_.kind,
        "item_title": item.title,
        "options": round_.options,
        "reason": round_.reason,
        "deadline": round_.deadline.isoformat(),
        "status": round_.status,
        "winning_option_id": round_.winning_option_id,
        "responded": len(votes),
        "total_members": total,
        # 只给票数,不给谁投的 —— 投票是匿名的
        "tally": tally,
    }


@app.get("/api/plans/{plan_id}/changes")
def get_change_log(plan_id: str, db: Session = Depends(get_session)) -> list[dict]:
    """流水账。这趟旅行的每个决定是怎么来的。"""
    changes = db.scalars(
        select(PlanChange)
        .where(PlanChange.plan_id == plan_id)
        .order_by(PlanChange.applied_at)
    ).all()
    return [
        {
            "id": c.id,
            "plan_item_id": c.plan_item_id,
            "origin": c.origin,
            "patch": c.patch,
            "reason": c.reason,
            "applied_at": c.applied_at.isoformat(),
        }
        for c in changes
    ]


# ————————————————————— 写 —————————————————————


@app.post("/api/plans/items/{item_id}/classify")
def classify_only(
    item_id: str,
    body: ChangeRequest,
    db: Session = Depends(get_session),
    me: TripMembership = Depends(current_membership),
) -> dict:
    """只试算,不执行 —— AI 私聊里的"我帮你算了一下"就用这个。

    不花钱、不慢,因为判定不靠 AI。
    """
    item = db.get(PlanItem, item_id)
    if item is None:
        raise HTTPException(404, "Item not found")
    savepoint = db.begin_nested()
    try:
        outcome = orch.propose_change(
            db, item, body.patch(), me.id, request=body.request, reason="dry run"
        )
        return _outcome_out(outcome)
    except orch.AlreadyPending as exc:
        raise HTTPException(409, str(exc)) from exc
    finally:
        savepoint.rollback()


@app.post("/api/plans/items/{item_id}/changes")
def submit_change(
    item_id: str,
    body: ChangeRequest,
    db: Session = Depends(get_session),
    me: TripMembership = Depends(current_membership),
) -> dict:
    """真的提交一个改动。判定 + 执行一步到位。"""
    item = db.get(PlanItem, item_id)
    if item is None:
        raise HTTPException(404, "Item not found")
    try:
        outcome = orch.propose_change(
            db, item, body.patch(), me.id, request=body.request, reason=body.reason
        )
    except orch.ReasonRequired as exc:
        raise HTTPException(422, str(exc)) from exc
    except orch.AlreadyPending as exc:
        raise HTTPException(409, str(exc)) from exc
    db.commit()
    return _outcome_out(outcome)


@app.post("/api/updates/{notice_id}/object")
def object_to_notice(
    notice_id: str,
    db: Session = Depends(get_session),
    me: TripMembership = Depends(current_membership),
) -> dict:
    """在通知上说「我有别的想法」→ 升级成投票。"""
    notice = db.get(UpdateNotice, notice_id)
    if notice is None or not notice.can_object:
        raise HTTPException(404, "Nothing to object to")
    outcome = orch.object_to_notice(db, notice)
    db.commit()
    return _outcome_out(outcome)


@app.post("/api/rounds/{round_id}/votes")
def vote(
    round_id: str,
    body: VoteRequest,
    db: Session = Depends(get_session),
    me: TripMembership = Depends(current_membership),
) -> dict:
    round_ = db.get(DecisionRound, round_id)
    if round_ is None or round_.status != "open":
        raise HTTPException(404, "Round is not open")
    orch.cast_vote(db, round_, me.id, body.option_id)
    db.commit()
    return get_round(round_id, db)


@app.post("/api/rounds/{round_id}/settle")
def settle(round_id: str, db: Session = Depends(get_session)) -> dict:
    """手动结算。真实场景由定时任务调 settle_due_rounds,这个接口给演示用。"""
    round_ = db.get(DecisionRound, round_id)
    if round_ is None:
        raise HTTPException(404, "Round not found")
    orch.settle_round(db, round_)
    db.commit()
    return get_round(round_id, db)


@app.post("/api/proposals/{proposal_id}/decisions")
def decide(
    proposal_id: str,
    body: DecisionRequest,
    db: Session = Depends(get_session),
    me: TripMembership = Depends(current_membership),
) -> dict:
    proposal = db.get(ChangeProposal, proposal_id)
    if proposal is None:
        raise HTTPException(404, "Proposal not found")
    applied = orch.decide_proposal(db, proposal, me.id, body.status)
    db.commit()
    return {"proposal_status": proposal.status, "applied": applied}


@app.get("/api/proposals/{proposal_id}")
def get_proposal(proposal_id: str, db: Session = Depends(get_session)) -> dict:
    """提案详情。**其他成员一律匿名** —— 当前用户是 You,其余是 Member A/B/C。"""
    from ..db.models import ProposalDecision

    proposal = db.get(ChangeProposal, proposal_id)
    if proposal is None:
        raise HTTPException(404, "Proposal not found")
    decisions = db.scalars(
        select(ProposalDecision).where(ProposalDecision.proposal_id == proposal_id)
    ).all()
    labels = [f"Member {chr(65 + i)}" for i in range(len(decisions))]
    return {
        "id": proposal.id,
        "status": proposal.status,
        "before": proposal.before_json,
        "after": proposal.after_json,
        "members": [
            {"label": label, "status": d.status}
            for label, d in zip(labels, decisions)
        ],
        "privacy_note": (
            "Everyone in this conversation is anonymous. "
            "Names and private reasons are never shown."
        ),
    }

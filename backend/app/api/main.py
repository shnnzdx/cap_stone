"""HTTP 接口层。

这一层**很薄**,故意的:它只做三件事 —— 收参数、调 domain、把结果转成 JSON。
所有规则都在 domain/ 里,这里一条业务判断都不写。

身份验证走邮箱密码登录后的 bearer token；本地开发可以用
DEV_ALLOW_MEMBERSHIP_HEADER=1 暂时保留 X-Membership-Id 调试入口。
"""

from __future__ import annotations

import os
from contextlib import asynccontextmanager
from datetime import date

from fastapi import Depends, FastAPI, Header, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from ..db.models import (
    ChangeProposal,
    DecisionRound,
    Plan,
    PlanChange,
    PlanItem,
    PlanItemComment,
    Trip,
    TripMembership,
    UpdateNotice,
    User,
    Vote,
)
from ..db.session import get_session
from ..domain import auth as auth_service
from ..domain.chat import service as chat_service
from ..domain.decisions import orchestrator as orch
from ..domain.decisions import organizer as org_actions
from ..domain.plans import generator as plan_generator
from ..domain.preferences import service as pref_service
from ..domain.trips import service as trip_service


DEFAULT_CORS_ORIGINS = (
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "http://localhost:3000",
)


def parse_cors_origins(raw: str | None = None) -> list[str]:
    value = raw if raw is not None else os.getenv("CORS_ORIGINS", "")
    origins = [origin.strip().rstrip("/") for origin in value.split(",") if origin.strip()]
    return origins or list(DEFAULT_CORS_ORIGINS)


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
    allow_origins=parse_cors_origins(),
    allow_methods=["*"],
    allow_headers=["*"],
)


def _same_trip(membership: TripMembership, trip_id: str) -> None:
    """路径里的旅行必须就是你身份所属的那一趟。

    不查的话，拿 A 旅行的身份去问 B 旅行，接口会**默默返回 A 的数据** ——
    用户以为看的是 B，看到的却是别人那趟的人数和进度。
    """
    if membership.trip_id != trip_id:
        raise HTTPException(403, "This identity belongs to a different trip")


def current_membership(
    db: Session = Depends(get_session),
    authorization: str | None = Header(default=None),
    x_trip_id: str | None = Header(default=None),
    x_membership_id: str | None = Header(default=None),
) -> TripMembership:
    """Authenticated trip identity.

    Real login uses a bearer token for the account, then X-Trip-Id chooses the
    membership for this trip. The old membership header is kept behind a local
    dev flag so two-window demos can still switch roles quickly.
    """
    token = _bearer_token(authorization)
    if token:
        try:
            user = auth_service.user_for_token(db, token)
            return auth_service.membership_for_trip(db, user, x_trip_id)
        except auth_service.AuthRequired as exc:
            raise HTTPException(401, str(exc)) from exc
        except auth_service.TripMembershipRequired as exc:
            raise HTTPException(403, str(exc)) from exc

    if os.getenv("DEV_ALLOW_MEMBERSHIP_HEADER", "1") == "1" and x_membership_id:
        membership = db.get(TripMembership, x_membership_id)
        if membership is not None:
            return membership

    raise HTTPException(401, "Login required")


def _bearer_token(authorization: str | None) -> str | None:
    if not authorization:
        return None
    scheme, _, token = authorization.partition(" ")
    if scheme.lower() != "bearer" or not token.strip():
        return None
    return token.strip()


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


class BookingRequest(BaseModel):
    booked: bool


class DecisionRequest(BaseModel):
    status: str = Field(pattern="^(accepted|declined)$")


class PreferenceRequest(BaseModel):
    preferred_start_date: date | None = None
    preferred_end_date: date | None = None
    available_start_date: date | None = None
    available_end_date: date | None = None
    ideal_budget: float | None = Field(default=None, ge=0)
    maximum_budget: float | None = Field(default=None, ge=0)
    currency: str = Field(default="USD", min_length=1, max_length=8)
    budget_visibility: str = Field(
        default="planning_only", pattern="^(planning_only|organizer|everyone)$"
    )
    travel_style: str | None = None
    top_interests: list[str] = Field(default_factory=list)


class ConstraintRequest(BaseModel):
    # 只有六种。填不进去的，系统老实说保护不了，不硬塞。
    kind: str = Field(
        pattern="^(time_window|budget_ceiling|date_range|walk_limit|dietary|avoid_tag)$"
    )
    params: dict = Field(default_factory=dict)
    importance: str = Field(default="required", pattern="^(required|flexible)$")
    original_text: str = ""
    visibility: str = Field(
        default="planning_only", pattern="^(planning_only|organizer|everyone)$"
    )


class ConstraintPatch(BaseModel):
    params: dict | None = None
    importance: str | None = Field(default=None, pattern="^(required|flexible)$")


class TripCreateRequest(BaseModel):
    name: str = Field(min_length=1)
    destination: str = Field(min_length=1)
    preferred_start_date: date | None = None
    preferred_end_date: date | None = None
    expected_group_size: int = Field(default=0, ge=0)
    currency: str = Field(default="USD", min_length=1, max_length=8)


class ChatRequest(BaseModel):
    message: str = Field(min_length=1)
    item_id: str | None = None


class CommentRequest(BaseModel):
    text: str = Field(min_length=1, max_length=1000)


class InviteJoinRequest(BaseModel):
    display_name: str = Field(min_length=1, max_length=120)
    email: str | None = Field(default=None, max_length=255)


class LoginRequest(BaseModel):
    email: str = Field(min_length=1, max_length=255)
    password: str = Field(min_length=1, max_length=255)


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
        # 没有配图时给 null，前端有占位框兜着，不要在这里编一张
        "photoUrl": item.photo_url,
    }


def _initials(name: str) -> str:
    parts = [part for part in name.split() if part]
    if len(parts) >= 2:
        return (parts[0][0] + parts[1][0]).upper()
    return (parts[0][:2] if parts else "?").upper()


def _member_name(db: Session, membership: TripMembership) -> str:
    user = db.get(User, membership.user_id) if membership.user_id else None
    return user.name if user else (membership.guest_display_name or "Guest")


def _comment_out(db: Session, comment: PlanItemComment, me: TripMembership) -> dict:
    membership = db.get(TripMembership, comment.trip_membership_id)
    name = _member_name(db, membership) if membership else "Guest"
    return {
        "id": comment.id,
        "plan_item_id": comment.plan_item_id,
        "membership_id": comment.trip_membership_id,
        "name": name,
        "initials": _initials(name),
        "text": comment.body,
        "created_at": comment.created_at.isoformat() if comment.created_at else None,
        "is_me": comment.trip_membership_id == me.id,
    }


def _outcome_out(outcome: orch.Outcome) -> dict:
    """判定结果转 JSON。

    注意 findings 里只有脱敏后的说法 —— 类型上就没有姓名和原文,
    所以这里不需要"记得过滤"。
    """
    verdict = outcome.classification
    result = _classification_out(verdict)
    result.update(
        {
            "applied": outcome.applied,
            "round_id": outcome.round_id,
            "proposal_id": outcome.proposal_id,
        }
    )
    return result


def _classification_out(verdict) -> dict:
    return {
        "path": verdict.path.value,
        "headline": verdict.headline,
        "detail": verdict.detail,
        "needs_reason": verdict.needs_reason,
        # 四条判据全给,命中的那条 hit=true —— 前端直接渲染成"为什么是这条路"的清单
        "checks": [
            {
                "id": c.id,
                "label": c.label,
                "hit": c.hit,
                "privateNote": c.private_note,
            }
            for c in verdict.checks
        ],
        "findings": [
            {"code": f.code, "text": f.safe_text, "affected_count": f.affected_count}
            for f in verdict.findings
        ],
    }


def _round_out(db: Session, round_: DecisionRound, me: TripMembership | None = None) -> dict:
    item = db.get(PlanItem, round_.plan_item_id)
    votes = db.scalars(select(Vote).where(Vote.round_id == round_.id)).all()
    total = len(
        db.scalars(
            select(TripMembership).where(TripMembership.trip_id == item.plan.trip_id)
        ).all()
    )
    tally: dict[str, int] = {}
    for vote in votes:
        tally[vote.option_id] = tally.get(vote.option_id, 0) + 1
    my_vote = None
    if me is not None:
        my_vote = next((vote.option_id for vote in votes if vote.trip_membership_id == me.id), None)
    return {
        "id": round_.id,
        "kind": round_.kind,
        "plan_item_id": round_.plan_item_id,
        "item_title": item.title,
        "options": round_.options,
        "reason": round_.reason,
        "deadline": round_.deadline.isoformat(),
        "status": round_.status,
        "winning_option_id": round_.winning_option_id,
        "responded": len(votes),
        "total_members": total,
        "tally": tally,
        "my_vote": my_vote,
    }


def _proposal_out(db: Session, proposal: ChangeProposal) -> dict:
    from ..db.models import ProposalDecision

    decisions = db.scalars(
        select(ProposalDecision).where(ProposalDecision.proposal_id == proposal.id)
    ).all()
    labels = [f"Member {chr(65 + i)}" for i in range(len(decisions))]
    return {
        "id": proposal.id,
        "status": proposal.status,
        "plan_item_id": proposal.plan_item_id,
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


# ————————————————————— 读 —————————————————————


@app.get("/api/health")
def health() -> dict:
    return {"ok": True}


@app.post("/api/auth/login")
def login(body: LoginRequest, db: Session = Depends(get_session)) -> dict:
    try:
        result = auth_service.login(
            db,
            email=body.email,
            password=body.password,
        )
    except auth_service.InvalidCredentials as exc:
        raise HTTPException(401, str(exc)) from exc
    db.commit()
    default_membership = result.memberships[0] if result.memberships else None
    return {
        "token": result.token,
        "user": {
            "id": result.user.id,
            "name": result.user.name,
            "email": result.user.email,
            "initials": _initials(result.user.name),
        },
        "memberships": result.memberships,
        "default_membership": default_membership,
    }


@app.post("/api/auth/logout")
def logout(
    db: Session = Depends(get_session),
    authorization: str | None = Header(default=None),
) -> dict:
    token = _bearer_token(authorization)
    if token:
        auth_service.revoke_token(db, token)
        db.commit()
    return {"ok": True}


@app.get("/api/me")
def get_me(
    db: Session = Depends(get_session),
    me: TripMembership = Depends(current_membership),
) -> dict:
    """我是谁 —— 前端的 currentUser 从这里来,不再写死。

    角色属于 membership,所以换 X-Membership-Id 就等于换一个人登录,
    界面会自动变成那个人的视角。
    """
    return trip_service.describe_me(db, me)


@app.get("/api/trips")
def list_trips(
    db: Session = Depends(get_session),
    me: TripMembership = Depends(current_membership),
) -> list[dict]:
    try:
        return trip_service.list_user_trips(db, me)
    except trip_service.GuestTripAccessDenied as exc:
        raise HTTPException(403, str(exc)) from exc


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
        "blocked_reason": plan.blocked_reason,
        "estimated_total_per_person": plan.estimated_total_per_person,
        "days": [{"day_index": d, "items": v} for d, v in sorted(days.items())],
    }


@app.get("/api/trips/{trip_id}/comments")
def get_trip_comments(
    trip_id: str,
    db: Session = Depends(get_session),
    me: TripMembership = Depends(current_membership),
) -> list[dict]:
    """Public group notes for itinerary items in this trip."""
    _same_trip(me, trip_id)
    comments = db.scalars(
        select(PlanItemComment)
        .join(PlanItem, PlanItemComment.plan_item_id == PlanItem.id)
        .join(Plan, PlanItem.plan_id == Plan.id)
        .where(Plan.trip_id == trip_id)
        .order_by(PlanItemComment.created_at, PlanItemComment.id)
    ).all()
    return [_comment_out(db, comment, me) for comment in comments]


@app.get("/api/trips/{trip_id}/updates")
def get_updates(
    trip_id: str,
    db: Session = Depends(get_session),
    me: TripMembership = Depends(current_membership),
) -> list[dict]:
    """The trip feed.

    A notice with a recipient is private to that member -- reminders are a
    nudge, not a public callout. Everything else is group-wide and anonymous.
    """
    notices = db.scalars(
        select(UpdateNotice)
        .where(
            UpdateNotice.trip_id == trip_id,
            or_(
                UpdateNotice.recipient_membership_id.is_(None),
                UpdateNotice.recipient_membership_id == me.id,
            ),
        )
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


@app.get("/api/trips/{trip_id}/actions")
def get_trip_actions(
    trip_id: str,
    db: Session = Depends(get_session),
    me: TripMembership = Depends(current_membership),
) -> dict:
    """Open decisions for this trip.

    Polling uses this instead of scraping notices: notices are activity history,
    while rounds/proposals are current actions that may need buttons.
    """
    if me.trip_id != trip_id:
        raise HTTPException(403, "Membership does not belong to this trip")

    rounds = db.scalars(
        select(DecisionRound)
        .join(PlanItem, DecisionRound.plan_item_id == PlanItem.id)
        .join(Plan, PlanItem.plan_id == Plan.id)
        .where(Plan.trip_id == trip_id, DecisionRound.status == "open")
        .order_by(DecisionRound.opened_at.desc())
    ).all()
    proposals = db.scalars(
        select(ChangeProposal)
        .join(PlanItem, ChangeProposal.plan_item_id == PlanItem.id)
        .join(Plan, PlanItem.plan_id == Plan.id)
        .where(
            Plan.trip_id == trip_id,
            ChangeProposal.status.in_(("waiting_affected_members", "escalated")),
        )
        .order_by(ChangeProposal.created_at.desc())
    ).all()
    return {
        "rounds": [_round_out(db, round_, me) for round_ in rounds],
        "proposals": [_proposal_out(db, proposal) for proposal in proposals],
    }


@app.get("/api/invites/{token}")
def get_invite(token: str, db: Session = Depends(get_session)) -> dict:
    try:
        return trip_service.invite_preview(db, token)
    except trip_service.InviteNotFound as exc:
        raise HTTPException(404, "Invite not found") from exc


@app.post("/api/trips/{trip_id}/chat")
def chat_with_trip(
    trip_id: str,
    body: ChatRequest,
    db: Session = Depends(get_session),
    me: TripMembership = Depends(current_membership),
) -> dict:
    """Natural-language trip chat.

    Read-only by design: the agent understands a message, the domain layer runs
    classify(), and the response tells the frontend what it could submit later.
    This endpoint never calls propose_change().
    """
    try:
        result = chat_service.respond_to_trip_chat(
            db,
            trip_id=trip_id,
            membership=me,
            message=body.message,
            item_id=body.item_id,
        )
    except chat_service.ChatAccessDenied as exc:
        raise HTTPException(403, str(exc)) from exc
    except (chat_service.ChatTripNotFound, chat_service.ChatItemNotFound) as exc:
        raise HTTPException(404, str(exc)) from exc

    proposed = None
    if result.proposed_change is not None:
        proposed = {
            "item_id": result.proposed_change.item_id,
            "item_title": result.proposed_change.item_title,
            "patch": result.proposed_change.patch,
            "verdict": _classification_out(result.proposed_change.verdict),
        }
    return {"reply": result.reply, "proposed_change": proposed}


def _round_payload(db: Session, round_id: str, membership_id: str | None) -> dict:
    """路由内部要复用这段就调它,别直接调路由函数 ——
    路由的默认值是 Header(...) 这类依赖对象,直接调会把它当成真实参数传下去。
    """
    round_ = db.get(DecisionRound, round_id)
    if round_ is None:
        raise HTTPException(404, "Round not found")
    me = db.get(TripMembership, membership_id) if membership_id else None
    return _round_out(db, round_, me)


@app.get("/api/rounds/{round_id}")
def get_round(
    round_id: str,
    db: Session = Depends(get_session),
    x_membership_id: str | None = Header(default=None),
) -> dict:
    return _round_payload(db, round_id, x_membership_id)


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


@app.post("/api/trips")
def create_trip(
    body: TripCreateRequest,
    db: Session = Depends(get_session),
    me: TripMembership = Depends(current_membership),
) -> dict:
    try:
        created = trip_service.create_trip(
            db,
            me,
            trip_service.TripCreateData(**body.model_dump()),
        )
    except trip_service.GuestTripAccessDenied as exc:
        raise HTTPException(403, str(exc)) from exc
    db.commit()
    return {
        "id": created.trip.id,
        "name": created.trip.name,
        "destination": created.trip.destination,
        "status": created.trip.status,
        "plan_id": created.plan.id,
        # 创建者在新 trip 里是另一个 membership。不返回它，前端就没法把身份切过去，
        # 之后调这趟旅行的任何接口都会因为"身份属于别的旅行"被拒。
        "membership_id": created.membership.id,
    }


@app.post("/api/trips/{trip_id}/invite")
def create_invite(
    trip_id: str,
    db: Session = Depends(get_session),
    me: TripMembership = Depends(current_membership),
) -> dict:
    try:
        created = trip_service.create_invite(db, trip_id, me)
    except trip_service.OrganizerRequired as exc:
        raise HTTPException(403, str(exc)) from exc
    except trip_service.InviteNotFound as exc:
        raise HTTPException(404, "Trip not found") from exc
    db.commit()
    frontend_base = os.getenv("FRONTEND_BASE_URL", "http://localhost:5173").rstrip("/")
    return {
        "id": created.invite.id,
        "invite_id": created.invite.id,
        "token": created.token,
        "url": f"{frontend_base}/#/join/{created.token}",
    }


@app.post("/api/invites/{token}/join")
def join_invite(
    token: str,
    body: InviteJoinRequest,
    db: Session = Depends(get_session),
) -> dict:
    if not body.display_name.strip():
        raise HTTPException(422, "Display name is required")
    try:
        joined = trip_service.join_invite(
            db,
            token,
            display_name=body.display_name,
            email=body.email,
        )
    except trip_service.InviteNotFound as exc:
        raise HTTPException(404, "Invite not found") from exc
    db.commit()
    return {
        "membership_id": joined.membership.id,
        "trip_id": joined.trip_id,
        "role": "participant",
    }


@app.post("/api/invites/{invite_id}/revoke")
def revoke_invite(
    invite_id: str,
    db: Session = Depends(get_session),
    me: TripMembership = Depends(current_membership),
) -> dict:
    try:
        trip_service.revoke_invite(db, invite_id, me)
    except trip_service.OrganizerRequired as exc:
        raise HTTPException(403, str(exc)) from exc
    except trip_service.InviteNotFound as exc:
        raise HTTPException(404, "Invite not found") from exc
    db.commit()
    return {"revoked": True}


@app.post("/api/trips/{trip_id}/plans/generate")
def generate_trip_plan(
    trip_id: str,
    db: Session = Depends(get_session),
    me: TripMembership = Depends(current_membership),
) -> dict:
    try:
        result = plan_generator.generate_plan(db, trip_id, me)
    except plan_generator.OrganizerRequired as exc:
        raise HTTPException(403, str(exc)) from exc
    except plan_generator.OrganizerPreferencesRequired as exc:
        raise HTTPException(422, str(exc)) from exc
    except plan_generator.PlanAlreadyHasItems as exc:
        raise HTTPException(409, str(exc)) from exc
    except plan_generator.TripNotFound as exc:
        raise HTTPException(404, str(exc)) from exc
    db.commit()
    return {
        "plan_id": result.plan.id,
        "status": result.status,
        "days": result.days,
        "blocked_reason": result.blocked_reason,
        "generated_by": result.generated_by,
    }


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


@app.post("/api/plans/items/{item_id}/comments")
def add_item_comment(
    item_id: str,
    body: CommentRequest,
    db: Session = Depends(get_session),
    me: TripMembership = Depends(current_membership),
) -> dict:
    item = db.get(PlanItem, item_id)
    if item is None:
        raise HTTPException(404, "Item not found")
    _same_trip(me, item.plan.trip_id)
    text = body.text.strip()
    if not text:
        raise HTTPException(422, "Comment cannot be empty")
    comment = PlanItemComment(
        plan_item_id=item.id,
        trip_membership_id=me.id,
        body=text,
    )
    db.add(comment)
    db.commit()
    db.refresh(comment)
    return _comment_out(db, comment, me)


@app.patch("/api/plans/items/{item_id}/booking")
def set_item_booking(
    item_id: str,
    body: BookingRequest,
    db: Session = Depends(get_session),
    me: TripMembership = Depends(current_membership),
) -> dict:
    item = db.get(PlanItem, item_id)
    if item is None:
        raise HTTPException(404, "Item not found")
    try:
        updated = orch.set_booking_status(db, item, me, body.booked)
    except orch.WrongTrip as exc:
        raise HTTPException(403, str(exc)) from exc
    db.commit()
    db.refresh(updated)
    return _item_out(updated)


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
    try:
        outcome = orch.object_to_notice(db, notice)
    except orch.AlreadyPending as exc:
        raise HTTPException(409, str(exc)) from exc
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
    return _round_payload(db, round_id, me.id)


@app.post("/api/rounds/{round_id}/settle")
def settle(round_id: str, db: Session = Depends(get_session)) -> dict:
    """手动结算。真实场景由定时任务调 settle_due_rounds,这个接口给演示用。"""
    round_ = db.get(DecisionRound, round_id)
    if round_ is None:
        raise HTTPException(404, "Round not found")
    orch.settle_round(db, round_)
    db.commit()
    return _round_payload(db, round_id, None)


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
    proposal = db.get(ChangeProposal, proposal_id)
    if proposal is None:
        raise HTTPException(404, "Proposal not found")
    return _proposal_out(db, proposal)


# ————————————————————— 偏好与六种约束 —————————————————————
#
# 路径里没有"别人"这个位置 —— 想读别人的得先改 URL 设计，
# 不是靠权限判断挡住的。


@app.get("/api/trips/{trip_id}/preferences/me")
def get_my_preferences(
    trip_id: str,
    me: TripMembership = Depends(current_membership),
    db: Session = Depends(get_session),
) -> dict:
    return pref_service.read_mine(db, me)


@app.put("/api/trips/{trip_id}/preferences/me")
def save_my_preferences(
    trip_id: str,
    body: PreferenceRequest,
    me: TripMembership = Depends(current_membership),
    db: Session = Depends(get_session),
) -> dict:
    result = pref_service.save_mine(
        db, me, pref_service.PreferenceData(**body.model_dump())
    )
    db.commit()
    return result


@app.post("/api/trips/{trip_id}/constraints")
def add_my_constraint(
    trip_id: str,
    body: ConstraintRequest,
    me: TripMembership = Depends(current_membership),
    db: Session = Depends(get_session),
) -> dict:
    try:
        row, conflicts = pref_service.add_constraint(db, me, **body.model_dump())
    except pref_service.UnknownConstraintKind as exc:
        raise HTTPException(422, f"Unsupported constraint kind: {exc}") from exc
    db.commit()
    return {"id": row.id, "conflicts": conflicts}


@app.patch("/api/constraints/{constraint_id}")
def patch_my_constraint(
    constraint_id: str,
    body: ConstraintPatch,
    me: TripMembership = Depends(current_membership),
    db: Session = Depends(get_session),
) -> dict:
    try:
        row, conflicts = pref_service.update_constraint(
            db, me, constraint_id, params=body.params, importance=body.importance
        )
    except pref_service.NotYours as exc:
        raise HTTPException(404, str(exc)) from exc
    db.commit()
    return {"id": row.id, "conflicts": conflicts}


@app.delete("/api/constraints/{constraint_id}")
def delete_my_constraint(
    constraint_id: str,
    me: TripMembership = Depends(current_membership),
    db: Session = Depends(get_session),
) -> dict:
    try:
        pref_service.delete_constraint(db, me, constraint_id)
    except pref_service.NotYours as exc:
        raise HTTPException(404, str(exc)) from exc
    db.commit()
    return {"deleted": True}


@app.get("/api/trips/{trip_id}/members")
def list_members(
    trip_id: str,
    me: TripMembership = Depends(current_membership),
    db: Session = Depends(get_session),
) -> dict:
    """谁在这趟旅行里，交没交偏好。**只说交没交，不说交了什么。**"""
    _same_trip(me, trip_id)
    return pref_service.list_members(db, me)


# ————————————————————— Organizer actions —————————————————————
#
# All three maintain the shared frame. None of them decides for anyone else.


class DeadlockRequest(BaseModel):
    # Two exits, and both decline to decide. There is deliberately no third.
    action: str = Field(pattern="^(split|clear)$")


def _organizer_error(exc: Exception) -> HTTPException:
    if isinstance(exc, org_actions.OrganizerOnly):
        return HTTPException(403, str(exc))
    if isinstance(exc, org_actions.TooSoonToRemind):
        return HTTPException(429, str(exc))
    if isinstance(exc, org_actions.AlreadyExtended):
        return HTTPException(409, str(exc))
    return HTTPException(404, str(exc))


@app.post("/api/trips/{trip_id}/members/{membership_id}/remind")
def remind_member(
    trip_id: str,
    membership_id: str,
    me: TripMembership = Depends(current_membership),
    db: Session = Depends(get_session),
) -> dict:
    try:
        notice = org_actions.remind(db, me, membership_id)
    except Exception as exc:
        raise _organizer_error(exc) from exc
    db.commit()
    return {"sent": True, "notice_id": notice.id}


@app.post("/api/rounds/{round_id}/extend")
def extend_round(
    round_id: str,
    me: TripMembership = Depends(current_membership),
    db: Session = Depends(get_session),
) -> dict:
    try:
        round_ = org_actions.extend_round(db, me, round_id)
    except Exception as exc:
        raise _organizer_error(exc) from exc
    db.commit()
    return {"id": round_.id, "deadline": round_.deadline.isoformat()}


@app.post("/api/proposals/{proposal_id}/escalate")
def escalate_proposal(
    proposal_id: str,
    me: TripMembership = Depends(current_membership),
    db: Session = Depends(get_session),
) -> dict:
    """Any affected member can escalate, not just the proposer."""
    try:
        proposal = org_actions.escalate(db, me, proposal_id)
    except Exception as exc:
        raise _organizer_error(exc) from exc
    db.commit()
    return {"id": proposal.id, "status": proposal.status}


@app.post("/api/proposals/{proposal_id}/deadlock")
def resolve_deadlock(
    proposal_id: str,
    body: DeadlockRequest,
    me: TripMembership = Depends(current_membership),
    db: Session = Depends(get_session),
) -> dict:
    try:
        item = org_actions.resolve_deadlock(db, me, proposal_id, body.action)
    except Exception as exc:
        raise _organizer_error(exc) from exc
    db.commit()
    return {"item_id": item.id, "title": item.title, "action": body.action}

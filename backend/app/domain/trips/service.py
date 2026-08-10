"""Trip dashboard and creation rules.

API handlers stay thin; this module owns the cross-trip membership lookups and
the side effects required when a user creates a new trip.
"""

from __future__ import annotations

import hashlib
import secrets
from dataclasses import dataclass
from datetime import date, datetime, timezone

from sqlalchemy import func, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from ...db.models import InviteLink, Plan, PlanItem, Trip, TripMembership, User


class GuestTripAccessDenied(Exception):
    """Guests do not have an account-level dashboard or creator identity."""


class OrganizerRequired(Exception):
    """Only the trip organizer can manage invite links."""


class InviteNotFound(Exception):
    """Invalid, expired, or revoked invite token."""


def _initials(name: str) -> str:
    """取名字的首字母。中文名取前两个字。"""
    parts = [p for p in name.split() if p]
    if len(parts) >= 2:
        return (parts[0][0] + parts[1][0]).upper()
    return (parts[0][:2] if parts else "?").upper()


def describe_me(db: Session, membership: TripMembership) -> dict:
    """当前登录者在**这趟旅行里**是谁。

    角色属于 membership,不属于账户 —— 同一个人可以在 A 旅行是组织者、
    B 旅行是参与者。所以这个接口的答案取决于你在哪趟旅行里问。

    访客没有账户,名字来自加入时填的昵称,没有邮箱。
    """
    user = db.get(User, membership.user_id) if membership.user_id else None
    is_guest = user is None
    name = user.name if user else (membership.guest_display_name or "Guest")

    return {
        "membership_id": membership.id,
        # 访客没有账户,前端需要一个稳定 id 时用 membership id
        "id": user.id if user else membership.id,
        "name": name,
        "initials": _initials(name),
        "email": user.email if user else None,
        # organizer | participant | guest —— 访客的角色不看 membership.role
        "role": "guest" if is_guest else membership.role,
        "trip_id": membership.trip_id,
        "is_guest": is_guest,
    }


@dataclass(frozen=True)
class TripCreateData:
    name: str
    destination: str
    preferred_start_date: date | None
    preferred_end_date: date | None
    expected_group_size: int
    currency: str


@dataclass(frozen=True)
class CreatedTrip:
    trip: Trip
    plan: Plan
    membership: TripMembership


def create_trip(
    db: Session, creator: TripMembership, data: TripCreateData
) -> CreatedTrip:
    if creator.user_id is None:
        raise GuestTripAccessDenied("Guests cannot create trips")

    trip = Trip(
        name=data.name,
        destination=data.destination,
        preferred_start_date=data.preferred_start_date,
        preferred_end_date=data.preferred_end_date,
        expected_group_size=data.expected_group_size,
        currency=data.currency,
        status="planning",
        created_by_user_id=creator.user_id,
    )
    db.add(trip)
    db.flush()

    membership = TripMembership(
        trip_id=trip.id,
        user_id=creator.user_id,
        role="organizer",
        join_method="creator",
        status="joined",
    )
    plan = Plan(
        trip_id=trip.id,
        estimated_total_per_person=0,
        currency=data.currency,
    )
    db.add_all([membership, plan])
    db.flush()

    return CreatedTrip(trip=trip, plan=plan, membership=membership)


def list_user_trips(db: Session, membership: TripMembership) -> list[dict]:
    if membership.user_id is None:
        raise GuestTripAccessDenied("Guests do not have a trip dashboard")

    memberships = db.scalars(
        select(TripMembership)
        .where(TripMembership.user_id == membership.user_id)
        .order_by(TripMembership.created_at)
    ).all()

    trips: list[dict] = []
    for my_membership in memberships:
        trip = db.get(Trip, my_membership.trip_id)
        if trip is None:
            continue

        member_count = db.scalar(
            select(func.count())
            .select_from(TripMembership)
            .where(TripMembership.trip_id == trip.id)
        )
        plan = db.scalar(select(Plan).where(Plan.trip_id == trip.id))
        next_item = None
        if plan is not None:
            # 卡片上写的是「下一个」，不是「第一个」——旅行开始之后，
            # 不加这个日期条件就会一直显示第一天的事，那已经过去了。
            next_item = db.scalar(
                select(PlanItem)
                .where(PlanItem.plan_id == plan.id, PlanItem.day_date >= date.today())
                .order_by(PlanItem.day_date, PlanItem.start_hour)
                .limit(1)
            )

        trips.append(
            {
                "id": trip.id,
                "name": trip.name,
                "destination": trip.destination,
                "status": trip.status,
                "member_count": member_count or 0,
                "next_item_title": next_item.title if next_item else None,
                "my_role": my_membership.role,
            }
        )
    return trips


def _token_hash(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _require_organizer(db: Session, trip_id: str, membership: TripMembership) -> None:
    if membership.trip_id != trip_id or membership.role != "organizer":
        raise OrganizerRequired("Only the organizer can manage this trip invite")


@dataclass(frozen=True)
class CreatedInvite:
    invite: InviteLink
    token: str


def create_invite(db: Session, trip_id: str, organizer: TripMembership) -> CreatedInvite:
    _require_organizer(db, trip_id, organizer)
    if db.get(Trip, trip_id) is None:
        raise InviteNotFound("Trip not found")

    db.execute(
        update(InviteLink)
        .where(InviteLink.trip_id == trip_id, InviteLink.is_primary.is_(True))
        .values(is_primary=False)
    )
    token = secrets.token_urlsafe(32)
    invite = InviteLink(
        trip_id=trip_id,
        token_hash=_token_hash(token),
        is_primary=True,
    )
    db.add(invite)
    db.flush()
    return CreatedInvite(invite=invite, token=token)


def _valid_invite(db: Session, token: str) -> InviteLink:
    invite = db.scalar(select(InviteLink).where(InviteLink.token_hash == _token_hash(token)))
    if invite is None or invite.revoked_at is not None:
        raise InviteNotFound("Invite not found")
    if invite.expires_at is not None and invite.expires_at <= _now():
        raise InviteNotFound("Invite not found")
    return invite


def invite_preview(db: Session, token: str) -> dict:
    invite = _valid_invite(db, token)
    trip = db.get(Trip, invite.trip_id)
    if trip is None:
        raise InviteNotFound("Invite not found")

    organizer = db.scalar(
        select(TripMembership).where(
            TripMembership.trip_id == trip.id,
            TripMembership.role == "organizer",
        )
    )
    organizer_user = db.get(User, organizer.user_id) if organizer and organizer.user_id else None
    member_count = db.scalar(
        select(func.count())
        .select_from(TripMembership)
        .where(TripMembership.trip_id == trip.id)
    )
    return {
        "name": trip.name,
        "destination": trip.destination,
        "preferred_start_date": trip.preferred_start_date.isoformat() if trip.preferred_start_date else None,
        "preferred_end_date": trip.preferred_end_date.isoformat() if trip.preferred_end_date else None,
        "member_count": member_count or 0,
        "organizer_name": organizer_user.name if organizer_user else "Organizer",
    }


@dataclass(frozen=True)
class JoinedInvite:
    membership: TripMembership
    trip_id: str


def join_invite(
    db: Session,
    token: str,
    *,
    display_name: str,
    email: str | None = None,
) -> JoinedInvite:
    invite = _valid_invite(db, token)
    name = display_name.strip()
    normalized_email = (email or "").strip().lower() or None

    if normalized_email is None:
        membership = TripMembership(
            trip_id=invite.trip_id,
            user_id=None,
            guest_display_name=name,
            role="participant",
            join_method="invite_guest",
            status="joined",
        )
        db.add(membership)
        db.flush()
        return JoinedInvite(membership=membership, trip_id=invite.trip_id)

    user = db.scalar(select(User).where(func.lower(User.email) == normalized_email))
    if user is None:
        user = User(name=name, email=normalized_email)
        db.add(user)
        db.flush()

    existing = db.scalar(
        select(TripMembership).where(
            TripMembership.trip_id == invite.trip_id,
            TripMembership.user_id == user.id,
        )
    )
    if existing is not None:
        return JoinedInvite(membership=existing, trip_id=invite.trip_id)

    try:
        with db.begin_nested():
            membership = TripMembership(
                trip_id=invite.trip_id,
                user_id=user.id,
                role="participant",
                join_method="invite_login",
                status="joined",
            )
            db.add(membership)
            db.flush()
    except IntegrityError:
        existing = db.scalar(
            select(TripMembership).where(
                TripMembership.trip_id == invite.trip_id,
                TripMembership.user_id == user.id,
            )
        )
        if existing is None:
            raise
        membership = existing
    return JoinedInvite(membership=membership, trip_id=invite.trip_id)


def revoke_invite(db: Session, invite_id: str, organizer: TripMembership) -> None:
    invite = db.get(InviteLink, invite_id)
    if invite is None:
        raise InviteNotFound("Invite not found")
    _require_organizer(db, invite.trip_id, organizer)
    invite.revoked_at = _now()
    invite.is_primary = False
    db.flush()

"""The three things an organizer can do: remind, extend a round, break a deadlock.

The organizer is not a super user. All three maintain the shared frame; none of
them decides anything on another member's behalf:

  - a reminder nudges, it cannot fill the form in
  - an extension buys time, it cannot cast a vote
  - the deadlock exit has exactly two options and **both of them are
    "decline to decide"** -- split the block, or clear it. The organizer can
    never pick either side's proposal.

That last rule is the whole reason this module exists. Without an exit, a
confirmation that cannot reach agreement is a dead end; but handing the
organizer a tiebreaker would break "the organizer's preferences carry no
extra weight".
"""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from ...db.models import (
    ChangeProposal,
    DecisionRound,
    PlanChange,
    PlanItem,
    Trip,
    TripMembership,
    UpdateNotice,
)
from ..trips import service as trip_service
from .orchestrator import deadline_for_window

# One reminder per member per day. A nudge, not a nag.
REMIND_COOLDOWN = timedelta(hours=24)
# A round can be extended once. More time is fine; never settling is not.
EXTEND_PLANNING = timedelta(hours=24)
EXTEND_TRAVELING = timedelta(hours=2)


class OrganizerOnly(Exception):
    """Organizer-only action."""


class NothingToDo(Exception):
    """Gone, or no longer in a state that needs handling."""


class AlreadyExtended(Exception):
    """A round can only be extended once, otherwise it never settles."""


class TooSoonToRemind(Exception):
    """Reminded too recently."""


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _require_organizer(membership: TripMembership) -> None:
    if membership.role != "organizer":
        raise OrganizerOnly("Only the organizer can do this")


# ————————————————————— Reminders —————————————————————


def remind(db: Session, organizer: TripMembership, target_id: str) -> UpdateNotice:
    """Nudge one member to fill in their preferences.

    Writes a notice addressed to that person only -- never a public callout.
    Naming someone in front of the group turns "has not answered yet" into
    pressure, and this product's whole position is that silence is not leverage.
    """
    _require_organizer(organizer)
    target = db.get(TripMembership, target_id)
    if target is None or target.trip_id != organizer.trip_id:
        raise NothingToDo("Member not found")
    if target.status == "preferences_submitted":
        raise NothingToDo("This member has already submitted")

    recent = db.scalar(
        select(UpdateNotice)
        .where(
            UpdateNotice.trip_id == organizer.trip_id,
            UpdateNotice.recipient_membership_id == target_id,
            UpdateNotice.kind == "reminder",
        )
        .order_by(UpdateNotice.created_at.desc())
    )
    if recent is not None and recent.created_at > _now() - REMIND_COOLDOWN:
        raise TooSoonToRemind("This member was reminded in the last 24 hours")

    notice = UpdateNotice(
        trip_id=organizer.trip_id,
        recipient_membership_id=target_id,
        kind="reminder",
        title="Your preferences are still open",
        body=(
            "The plan is checked against what everyone needs. Yours is not in yet, "
            "so nothing of yours is being protected."
        ),
    )
    db.add(notice)
    db.flush()
    return notice


# ————————————————————— Extending a round —————————————————————


def extend_round(db: Session, organizer: TripMembership, round_id: str) -> DecisionRound:
    """Buy a round more time. The whole group is told -- the rules just changed."""
    _require_organizer(organizer)
    round_ = db.get(DecisionRound, round_id)
    if round_ is None or round_.status != "open":
        raise NothingToDo("No open round here")
    if round_.extended_at is not None:
        raise AlreadyExtended("This round has already been extended once")

    item = db.get(PlanItem, round_.plan_item_id)
    if item is None or item.plan.trip_id != organizer.trip_id:
        raise NothingToDo("No open round here")
    trip = db.get(Trip, item.plan.trip_id)
    status = trip_service.trip_status(trip, _now().date()) if trip else "planning"
    window = EXTEND_TRAVELING if status == "traveling" else EXTEND_PLANNING

    now = _now()
    # 延长是补足一段新窗口,不是把剩余时间继续往上叠。
    # 刚开轮就点 Extend,应该仍然接近 24h/2h,不能变成 48h/4h。
    round_.deadline = deadline_for_window(window, item, current=round_.deadline)
    round_.extended_at = now
    db.add(
        UpdateNotice(
            trip_id=item.plan.trip_id,
            plan_item_id=item.id,
            kind="round",
            title=f"More time to weigh in on {item.title}",
            body=(
                "The organizer extended this round. Members who do not respond are "
                "still recorded as no preference, never as agreement."
            ),
        )
    )
    db.flush()
    return round_


def extend_proposal(
    db: Session, organizer: TripMembership, proposal_id: str
) -> ChangeProposal:
    """Buy a confirmation more time, without changing what silence means."""
    _require_organizer(organizer)
    proposal = db.get(ChangeProposal, proposal_id)
    if proposal is None or proposal.status not in ("waiting_affected_members", "escalated"):
        raise NothingToDo("No active proposal here")
    if proposal.extended_at is not None:
        raise AlreadyExtended("This proposal has already been extended once")

    item = db.get(PlanItem, proposal.plan_item_id)
    if item is None or item.plan.trip_id != organizer.trip_id:
        raise NothingToDo("No active proposal here")
    trip = db.get(Trip, item.plan.trip_id)
    status = trip_service.trip_status(trip, _now().date()) if trip else "planning"
    window = EXTEND_TRAVELING if status == "traveling" else EXTEND_PLANNING

    proposal.deadline = deadline_for_window(window, item, current=proposal.deadline)
    proposal.extended_at = _now()
    db.add(
        UpdateNotice(
            trip_id=item.plan.trip_id,
            plan_item_id=item.id,
            kind="proposal",
            title=f"More time to confirm {item.title}",
            body=(
                "The organizer extended this confirmation. If it still expires, "
                "the proposal is void and the current plan stays unchanged."
            ),
        )
    )
    db.flush()
    return proposal


# ————————————————————— The deadlock exit —————————————————————


def escalate(db: Session, membership: TripMembership, proposal_id: str) -> ChangeProposal:
    """Hand a stuck confirmation to the organizer.

    Any affected member can escalate, not just the proposer -- the person who
    is stuck is usually the one who disagrees.
    """
    proposal = db.get(ChangeProposal, proposal_id)
    if proposal is None or proposal.status != "waiting_affected_members":
        raise NothingToDo("Nothing to escalate")
    proposal.status = "escalated"
    db.flush()
    return proposal


def resolve_deadlock(
    db: Session, organizer: TripMembership, proposal_id: str, action: str
) -> PlanItem:
    """The organizer breaks a deadlock. Two exits, and both decline to decide.

    `split` -- the block splits; each group goes its own way and regroups after
    `clear` -- nothing is scheduled here; it becomes free time

    **There is deliberately no third option.** The organizer cannot adopt the
    proposal, and cannot substitute some other plan of their own. Either would
    decide on behalf of the member who did not agree.
    """
    _require_organizer(organizer)
    if action not in ("split", "clear"):
        raise NothingToDo("An organizer can only split the block or clear it")

    proposal = db.get(ChangeProposal, proposal_id)
    if proposal is None or proposal.status != "escalated":
        raise NothingToDo("This proposal is not waiting on the organizer")

    item = db.get(PlanItem, proposal.plan_item_id)
    if action == "split":
        patch = {"title": "Split for this block", "place": "Two groups, regroup after"}
    else:
        patch = {"title": "Free time", "place": "Nothing scheduled"}

    for field, value in patch.items():
        setattr(item, field, value)
    item.settledness = "settled"
    item.settled_at = _now()

    proposal.status = "resolved_by_organizer"
    db.add(
        PlanChange(
            plan_id=item.plan_id,
            plan_item_id=item.id,
            origin=f"deadlock_{action}",
            patch=patch,
            source_proposal_id=proposal.id,
            reason="The affected members could not agree, so the block was not decided either way.",
        )
    )
    db.add(
        UpdateNotice(
            trip_id=item.plan.trip_id,
            plan_item_id=item.id,
            kind="proposal",
            title=(
                "This block was split" if action == "split" else "This block was cleared"
            ),
            body=(
                "The affected members could not agree. Rather than picking a side, the "
                "block is now open: "
                + (
                    "two groups go their own way and regroup after."
                    if action == "split"
                    else "nothing is scheduled here."
                )
            ),
        )
    )
    db.flush()
    return item

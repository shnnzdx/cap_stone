"""Executor for the decision paths.

The classifier only says which path to take. This module performs the real effects: writing plan
changes, opening rounds, creating proposals, and settling deadlines.

Rules it must never break:

  - Non-voters are recorded as no response, **never as agreement**.
  - Proposals write to the plan only after every affected person approves.
  - In reopened rounds, non-response counts toward keeping the current decision.
  - Every path appends to the decision log, with no exceptions."""

from __future__ import annotations

from collections import Counter
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
import re

from sqlalchemy import select
from sqlalchemy.orm import Session

from data.poi_chicago import POIS

from ...db.models import (
    ChangeProposal,
    DecisionRound,
    MemberConstraint,
    PlanChange,
    PlanItem,
    ProposalDecision,
    Trip,
    TripMembership,
    UpdateNotice,
    Vote,
)
from ..constraints.engine import affected_membership_ids, classify
from ..constraints.types import (
    Classification,
    Constraint,
    ConstraintKind,
    Importance,
    ItemView,
    Path,
    ProposedChange,
    Settledness,
)

KEEP_CURRENT = "keep"
SPLIT_UP = "split"

PLANNING_WINDOW = timedelta(hours=24)
TRAVELING_WINDOW = timedelta(hours=2)

# Confirm also needs a deadline, or one non-response can hold a slot indefinitely.
# It is shorter than voting because Confirm involves only affected members, not the whole group.
PROPOSAL_PLANNING_WINDOW = timedelta(days=7)
PROPOSAL_TRAVELING_WINDOW = timedelta(days=2)


class ReasonRequired(Exception):
    """Reopening an already-settled slot requires a written reason."""


class AlreadyPending(Exception):
    """This slot already has an open round or a proposal waiting for confirmation.

    The database can block it, but that is the last defense. Blocking here gives users a readable
    message instead of a 500."""


class WrongTrip(Exception):
    """This identity does not belong to this trip."""


@dataclass
class Outcome:
    """Result of processing one change. The API layer serializes it directly to the frontend."""

    classification: Classification
    round_id: str | None = None
    proposal_id: str | None = None
    applied: bool = False


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _view(item: PlanItem, **overrides) -> ItemView:
    base = dict(
        id=item.id,
        day_date=item.day_date,
        start_hour=item.start_hour,
        duration_min=item.duration_min,
        price_per_person=item.price_per_person,
        tags=frozenset(item.tags or ()),
        dietary_tags=frozenset(item.dietary_tags or ()),
        is_meal=item.is_meal,
        settledness=Settledness(item.settledness),
    )
    base.update(overrides)
    return ItemView(**base)


def _load_constraints(db: Session, trip_id: str) -> list[Constraint]:
    """Read the group's hard constraints. This does **not** touch the raw private wording table."""
    rows = db.scalars(
        select(MemberConstraint)
        .join(TripMembership, TripMembership.id == MemberConstraint.trip_membership_id)
        .where(TripMembership.trip_id == trip_id)
    ).all()
    return [
        Constraint(
            id=row.id,
            membership_id=row.trip_membership_id,
            kind=ConstraintKind(row.kind),
            importance=Importance(row.importance),
            params=row.params or {},
        )
        for row in rows
    ]


def _member_count(db: Session, trip_id: str) -> int:
    return len(db.scalars(select(TripMembership).where(TripMembership.trip_id == trip_id)).all())


def _deadline_for(trip: Trip) -> datetime:
    """Do not run a 24-hour asynchronous vote while people are already on the street."""
    window = TRAVELING_WINDOW if trip.status == "traveling" else PLANNING_WINDOW
    return _now() + window


def _proposal_deadline_for(trip: Trip) -> datetime:
    """Confirmation deadline. Once travel starts, waiting time is shortened using the same rule as voting."""
    window = (
        PROPOSAL_TRAVELING_WINDOW
        if trip.status == "traveling"
        else PROPOSAL_PLANNING_WINDOW
    )
    return _now() + window


def _option_time_label(hour: float) -> str:
    whole_hour = int(hour)
    minute = int(round((hour - whole_hour) * 60))
    display_hour = whole_hour % 12 or 12
    suffix = "AM" if whole_hour < 12 else "PM"
    return f"{display_hour}:{minute:02d} {suffix}"


def _options_for(item: PlanItem, request: str, patch: dict | None = None) -> list[dict]:
    """Options **must include split-up**. This is a product rule, not optional."""
    requested = {
        "id": "requested",
        "label": "Suggested change",
        "title": request[:60] or "Suggested change",
        "body": "Apply the most recent suggestion to this block.",
    }
    if patch:
        requested["patch"] = _json_patch(_patch_with_poi_metadata(item, patch))
    return [
        {
            "id": KEEP_CURRENT,
            "label": "Keep current",
            "title": item.title,
            "body": f"Keep this card as it is: {item.place} at {_option_time_label(item.start_hour)}.",
        },
        requested,
        {"id": SPLIT_UP, "label": "Split up", "title": "Split for this block",
         "body": "Both options run in parallel and the group regroups afterwards."},
    ]


def _log(db: Session, item: PlanItem, origin: str, patch: dict, **extra) -> None:
    db.add(
        PlanChange(
            plan_id=item.plan_id,
            plan_item_id=item.id,
            origin=origin,
            patch=_json_patch(patch),
            **extra,
        )
    )


def _apply(db: Session, item: PlanItem, patch: dict) -> dict:
    applied = _patch_with_poi_metadata(item, patch)
    if "day_date" in applied:
        applied["day_index"] = _day_index_for_date(db, item, applied["day_date"])
    for field, value in applied.items():
        setattr(item, field, value)
    return applied


def _day_index_for_date(db: Session, item: PlanItem, day_date: date) -> int:
    trip = db.get(Trip, item.plan.trip_id)
    if trip and trip.preferred_start_date:
        return max(1, (day_date - trip.preferred_start_date).days + 1)

    dates = list(
        db.scalars(
            select(PlanItem.day_date)
            .where(PlanItem.plan_id == item.plan_id)
            .distinct()
            .order_by(PlanItem.day_date)
        )
    )
    if day_date not in dates:
        dates.append(day_date)
        dates.sort()
    return dates.index(day_date) + 1


def _patch_with_poi_metadata(item: PlanItem, patch: dict) -> dict:
    applied = dict(patch)
    if not ({"title", "place"} & applied.keys()):
        return applied
    poi = _match_poi(applied.get("title", item.title), applied.get("place", item.place))
    if poi is None:
        return applied
    applied["lat"] = poi["lat"]
    applied["lng"] = poi["lng"]
    applied["photo_url"] = poi["photo_url"]
    return applied


def _match_poi(title: str | None, place: str | None) -> dict | None:
    title_key = _poi_key(title)
    place_key = _poi_key(place)
    rows = [_poi_row(raw) for raw in POIS]

    for row in rows:
        if title_key and title_key == row["title_key"]:
            return row
    for row in rows:
        if title_key and _meaningful_overlap(title_key, row["title_key"]):
            return row
    for row in rows:
        if place_key and place_key in {row["title_key"], row["area_key"]}:
            return row
    for row in rows:
        if place_key and (
            _meaningful_overlap(place_key, row["title_key"])
            or _meaningful_overlap(place_key, row["area_key"])
        ):
            return row
    return None


def _poi_row(raw: tuple) -> dict:
    return {
        "title": raw[0],
        "area": raw[1],
        "title_key": _poi_key(raw[0]),
        "area_key": _poi_key(raw[1]),
        "lat": raw[2],
        "lng": raw[3],
        "photo_url": raw[12] if len(raw) > 12 else None,
    }


def _poi_key(value: str | None) -> str:
    return re.sub(r"[^a-z0-9]+", " ", str(value or "").lower()).strip()


def _meaningful_overlap(left: str, right: str) -> bool:
    return len(left) >= 6 and len(right) >= 6 and (left in right or right in left)


def _json_patch(patch: dict) -> dict:
    return {
        key: value.isoformat() if hasattr(value, "isoformat") else value
        for key, value in patch.items()
    }


def _patch_from_json(patch: dict | None) -> dict:
    converted = dict(patch or {})
    if isinstance(converted.get("day_date"), str):
        converted["day_date"] = date.fromisoformat(converted["day_date"])
    return converted


def _guard_not_pending(db: Session, item: PlanItem) -> None:
    """A slot can have only one pending decision. First one must finish; no cutting in line."""
    if db.scalar(
        select(DecisionRound).where(
            DecisionRound.plan_item_id == item.id, DecisionRound.status == "open"
        )
    ):
        raise AlreadyPending(
            "A round is already open on this block. Vote in it, or wait for it to close."
        )
    if db.scalar(
        select(ChangeProposal).where(
            ChangeProposal.plan_item_id == item.id,
            ChangeProposal.status == "waiting_affected_members",
        )
    ):
        raise AlreadyPending(
            "A change on this block is already waiting for confirmations."
        )


def _changed_item_window(item: PlanItem, patch: dict) -> tuple[date, float, float | None]:
    day_date = patch.get("day_date", item.day_date)
    start_hour = float(patch.get("start_hour", item.start_hour))
    duration_value = patch.get("duration_min", item.duration_min)
    duration_min = int(duration_value) if duration_value is not None else None
    if duration_min is None:
        return day_date, start_hour, None
    return day_date, start_hour, start_hour + duration_min / 60


def _overlaps(left_start: float, left_end: float, right_start: float, right_end: float) -> bool:
    return left_start < right_end and left_end > right_start


def _schedule_conflict_item(db: Session, item: PlanItem, patch: dict) -> PlanItem | None:
    day_date, start_hour, end_hour = _changed_item_window(item, patch)
    if end_hour is None:
        return None
    peers = db.scalars(
        select(PlanItem)
        .where(
            PlanItem.plan_id == item.plan_id,
            PlanItem.id != item.id,
            PlanItem.day_date == day_date,
        )
        .order_by(PlanItem.start_hour)
    ).all()
    for peer in peers:
        if peer.duration_min is None:
            continue
        peer_end = peer.start_hour + peer.duration_min / 60
        if _overlaps(start_hour, end_hour, peer.start_hour, peer_end):
            return peer
    return None


def _schedule_conflict_classification(conflict: PlanItem) -> Classification:
    return Classification(
        path=Path.ROUND,
        headline="This time already has another plan",
        detail=(
            f"{conflict.title} is already scheduled at this time. The group should "
            "choose how to handle the overlap instead of silently stacking two plans."
        ),
    )


# -------------------- Entry points --------------------


def propose_change(
    db: Session,
    item: PlanItem,
    patch: dict,
    actor_membership_id: str,
    request: str = "",
    reason: str | None = None,
    trip_total_after: float | None = None,
    day_walk_km_after: float = 0.0,
) -> Outcome:
    """Someone wants to change an item. Classify and execute in one step."""
    _guard_not_pending(db, item)
    plan = item.plan
    trip = db.get(Trip, plan.trip_id)

    change = ProposedChange(
        before=_view(item),
        after=_view(item, **{k: v for k, v in patch.items() if k in _VIEW_FIELDS}),
        day_walk_km_after=day_walk_km_after,
        trip_total_after=(
            trip_total_after
            if trip_total_after is not None
            else plan.estimated_total_per_person
        ),
        requested_by_membership_id=actor_membership_id,
    )
    constraints = _load_constraints(db, trip.id)
    verdict = classify(change, constraints)
    if verdict.path is Path.NOTICE:
        conflict = _schedule_conflict_item(db, item, patch)
        if conflict is not None:
            verdict = _schedule_conflict_classification(conflict)

    if verdict.path is Path.NOTICE:
        return _do_notice(db, item, patch, actor_membership_id, verdict)
    if verdict.path is Path.ROUND:
        return _do_round(db, item, trip, request, verdict, kind="normal", patch=patch)
    if verdict.path is Path.REOPEN_ROUND:
        if not (reason or "").strip():
            raise ReasonRequired(
                "Reopening a settled block needs a written reason."
            )
        return _do_round(db, item, trip, request, verdict, kind="reopen", reason=reason, patch=patch)
    return _do_confirm(
        db, item, patch, actor_membership_id, trip, verdict,
        affected=affected_membership_ids(change, constraints),
    )


def classify_change(
    db: Session,
    item: PlanItem,
    patch: dict,
    actor_membership_id: str,
    trip_total_after: float | None = None,
    day_walk_km_after: float = 0.0,
) -> Classification:
    """Only classify a proposed patch.

    This is the read-only path for AI chat. It deliberately does not call
    propose_change(), so it cannot create notices, rounds, proposals, votes, or
    plan changes.
    """
    plan = item.plan
    trip = db.get(Trip, plan.trip_id)
    change = ProposedChange(
        before=_view(item),
        after=_view(item, **{k: v for k, v in patch.items() if k in _VIEW_FIELDS}),
        day_walk_km_after=day_walk_km_after,
        trip_total_after=(
            trip_total_after
            if trip_total_after is not None
            else plan.estimated_total_per_person
        ),
        requested_by_membership_id=actor_membership_id,
    )
    verdict = classify(change, _load_constraints(db, trip.id))
    if verdict.path is Path.NOTICE:
        conflict = _schedule_conflict_item(db, item, patch)
        if conflict is not None:
            return _schedule_conflict_classification(conflict)
    return verdict


def set_booking_status(
    db: Session, item: PlanItem, membership: TripMembership, booked: bool
) -> PlanItem:
    """Mark an item as booked or remove that booking marker.

    This is not a plan-change proposal: it records real-world booking state for
    an already scheduled item. Removing the marker leaves the block settled,
    because the group still picked this plan even if the reservation was
    cancelled.
    """
    trip = db.get(Trip, item.plan.trip_id)
    if membership.trip_id != trip.id:
        raise WrongTrip("Membership does not belong to this trip")

    before = item.settledness
    after = Settledness.BOOKED.value if booked else Settledness.SETTLED.value
    if before == after:
        return item

    item.settledness = after
    item.settled_at = _now() if booked else None
    patch = {"settledness": after}
    _log(db, item, "booking", patch, actor_membership_id=membership.id)
    db.add(
        UpdateNotice(
            trip_id=trip.id,
            plan_item_id=item.id,
            kind="plan",
            title=f"{item.title} booking {'added' if booked else 'removed'}",
            body=(
                "This block is now marked as a confirmed booking."
                if booked
                else "The booking marker was removed; the plan itself is still kept."
            ),
        )
    )
    db.flush()
    return item


_VIEW_FIELDS = {
    "day_date", "start_hour", "duration_min", "price_per_person",
    "tags", "dietary_tags", "is_meal",
}


# -------------------- Path A: direct apply --------------------


def _do_notice(db, item, patch, actor_membership_id, verdict) -> Outcome:
    applied_patch = _apply(db, item, patch)
    item.settledness = Settledness.TOUCHED.value
    _log(db, item, "notice", applied_patch, actor_membership_id=actor_membership_id)
    db.add(
        UpdateNotice(
            trip_id=item.plan.trip_id,
            plan_item_id=item.id,
            kind="plan",
            title=f"{item.title} was updated",
            body=(
                "Applied directly — nothing hard was affected and nobody else had "
                "asked about this slot. Say something if it does not work for you."
            ),
            can_object=True,
        )
    )
    db.flush()
    return Outcome(classification=verdict, applied=True)


def object_to_notice(db: Session, notice: UpdateNotice, request: str = "") -> Outcome:
    """Someone clicked "I have a different idea" on a notice, so escalate to a vote."""
    item = db.get(PlanItem, notice.plan_item_id)
    trip = db.get(Trip, notice.trip_id)
    # Use the same guard as propose_change when this slot already has an open round or proposal.
    # Users should see a humane message instead of hitting one_open_round_per_item as a 500.
    _guard_not_pending(db, item)
    notice.can_object = False
    notice.body = "Escalated to a group round after an objection."
    verdict = Classification(
        path=Path.ROUND,
        headline="Someone already has a different idea for this slot",
        detail="Everyone weighs in at once and the slot is settled in a single round.",
    )
    return _do_round(db, item, trip, request, verdict, kind="normal")


# -------------------- Path B: voting --------------------


def _do_round(db, item, trip, request, verdict, *, kind, reason=None, patch=None) -> Outcome:
    round_ = DecisionRound(
        plan_item_id=item.id,
        kind=kind,
        options=_options_for(item, request, patch),
        reason=reason,
        deadline=_deadline_for(trip),
        status="open",
    )
    db.add(round_)
    if item.settledness == Settledness.LOOSE.value:
        item.settledness = Settledness.TOUCHED.value
    db.flush()
    return Outcome(classification=verdict, round_id=round_.id)


def cast_vote(db: Session, round_: DecisionRound, membership_id: str, option_id: str) -> Vote:
    """Vote or change vote. There is no abstain option; not voting means no record."""
    existing = db.scalar(
        select(Vote).where(
            Vote.round_id == round_.id, Vote.trip_membership_id == membership_id
        )
    )
    if existing:
        existing.option_id = option_id
        db.flush()
        return existing
    vote = Vote(round_id=round_.id, trip_membership_id=membership_id, option_id=option_id)
    db.add(vote)
    db.flush()
    return vote


def _winner(round_: DecisionRound, votes: list[Vote], member_count: int) -> str:
    """Compute what this round settles.

    Ordinary round: most votes wins; ties keep the current item. Non-voters do not affect the result.
    Reopened round: overturning a settled decision requires support from **more than half of all members**.
    Non-response counts toward keeping the current decision."""
    tally = Counter(v.option_id for v in votes)
    if not tally:
        return KEEP_CURRENT

    if round_.kind == "reopen":
        top_option, top_votes = tally.most_common(1)[0]
        if top_option == KEEP_CURRENT:
            return KEEP_CURRENT
        return top_option if top_votes * 2 > member_count else KEEP_CURRENT

    ranked = tally.most_common()
    if len(ranked) > 1 and ranked[0][1] == ranked[1][1]:
        return KEEP_CURRENT
    return ranked[0][0]


def settle_round(db: Session, round_: DecisionRound) -> str:
    """Settle one round. Repeated calls are idempotent."""
    if round_.status == "closed":
        return round_.winning_option_id

    item = db.get(PlanItem, round_.plan_item_id)
    trip_id = item.plan.trip_id
    votes = db.scalars(select(Vote).where(Vote.round_id == round_.id)).all()
    winner = _winner(round_, votes, _member_count(db, trip_id))

    option = next((o for o in round_.options if o["id"] == winner), None)
    patch = {} if winner == KEEP_CURRENT else _patch_from_json(option.get("patch") or {"title": option["title"]})
    if patch:
        patch = _apply(db, item, patch)

    item.settledness = Settledness.SETTLED.value
    item.settled_at = _now()
    item.settled_by_round_id = round_.id
    round_.status = "closed"
    round_.winning_option_id = winner
    round_.settled_at = _now()

    _log(db, item, "reopen_round" if round_.kind == "reopen" else "round",
         patch, source_round_id=round_.id, reason=round_.reason)
    db.add(
        UpdateNotice(
            trip_id=trip_id,
            plan_item_id=item.id,
            kind="round",
            title=f"{item.title} was settled by a group round",
            body=(
                f"{len(votes)} of {_member_count(db, trip_id)} took part. Members who "
                "did not respond are recorded as no preference, not as agreement."
            ),
        )
    )
    db.flush()
    return winner


def expire_due_proposals(db: Session, now: datetime | None = None) -> list[str]:
    """Expire proposals that do not collect enough approvals by the deadline.

    Expiry is neither rejection nor approval. The plan stays unchanged and the proposer can submit again.
    Auto-approval on expiry is forbidden because it treats silence as consent."""
    now = now or _now()
    due = db.scalars(
        select(ChangeProposal).where(
            ChangeProposal.status.in_(("waiting_affected_members", "escalated")),
            ChangeProposal.deadline.is_not(None),
            ChangeProposal.deadline <= now,
        )
    ).all()
    for proposal in due:
        proposal.status = "expired"
        proposal.expired_at = now
        item = db.get(PlanItem, proposal.plan_item_id)
        db.add(
            UpdateNotice(
                trip_id=item.plan.trip_id,
                plan_item_id=item.id,
                kind="proposal",
                title=f"A proposed change to {item.title} expired",
                body=(
                    "Not everyone affected confirmed in time, so the Current Plan is "
                    "unchanged. Anyone can propose it again."
                ),
            )
        )
    db.flush()
    return [p.id for p in due]


def settle_due_rounds(db: Session, now: datetime | None = None) -> list[str]:
    """Only scheduler entry point: settle all due rounds. Safe to run repeatedly."""
    now = now or _now()
    due = db.scalars(
        select(DecisionRound).where(
            DecisionRound.status == "open", DecisionRound.deadline <= now
        )
    ).all()
    for round_ in due:
        settle_round(db, round_)
    return [r.id for r in due]


# -------------------- Path C: confirmation --------------------


def _do_confirm(
    db, item, patch, actor_membership_id, trip, verdict, affected=frozenset()
) -> Outcome:
    after_patch = _patch_with_poi_metadata(item, patch)
    proposal = ChangeProposal(
        plan_item_id=item.id,
        action_type="edit",
        before_json={
            "title": item.title, "place": item.place,
            "start_hour": item.start_hour, "day_date": item.day_date.isoformat(),
        },
        after_json=_json_patch(after_patch),
        requested_by_membership_id=actor_membership_id,
        status="waiting_affected_members",
        deadline=_proposal_deadline_for(trip),
    )
    db.add(proposal)
    db.flush()

    # Who must approve: include only genuinely affected people, not the whole group.
    #   Booked item: shared money is involved, so the whole group approves.
    #   Member hard constraint: only those members plus the proposer approve.
    # Pulling too broadly makes proposals impossible to complete and holds the slot indefinitely.
    everyone = list(
        db.scalars(select(TripMembership).where(TripMembership.trip_id == trip.id))
    )
    if item.settledness == Settledness.BOOKED.value:
        involved = everyone
    else:
        involved = [
            m for m in everyone if m.id in affected or m.id == actor_membership_id
        ]

    for membership in involved:
        db.add(
            ProposalDecision(
                proposal_id=proposal.id,
                trip_membership_id=membership.id,
                status="accepted" if membership.id == actor_membership_id else "pending",
            )
        )
    db.flush()

    if all(membership.id == actor_membership_id for membership in involved):
        decide_proposal(db, proposal, actor_membership_id, "accepted")
        return Outcome(classification=verdict, applied=True)

    return Outcome(classification=verdict, proposal_id=proposal.id)


def decide_proposal(
    db: Session, proposal: ChangeProposal, membership_id: str, status: str
) -> bool:
    """Record one member's decision on a proposal and return whether it applied after that decision.

    The plan changes only when **everyone accepted**. Any declined decision expires the proposal."""
    decision = db.scalar(
        select(ProposalDecision).where(
            ProposalDecision.proposal_id == proposal.id,
            ProposalDecision.trip_membership_id == membership_id,
        )
    )
    if decision is None or proposal.status != "waiting_affected_members":
        return False
    decision.status = status
    db.flush()

    decisions = db.scalars(
        select(ProposalDecision).where(ProposalDecision.proposal_id == proposal.id)
    ).all()

    if any(d.status == "declined" for d in decisions):
        proposal.status = "declined"
        db.flush()
        return False

    if not all(d.status == "accepted" for d in decisions):
        return False

    item = db.get(PlanItem, proposal.plan_item_id)
    patch = _patch_from_json(proposal.after_json)
    patch = _apply(db, item, patch)
    item.settledness = Settledness.SETTLED.value
    item.settled_at = _now()
    proposal.status = "applied"
    _log(db, item, "confirm", patch, source_proposal_id=proposal.id)
    db.add(
        UpdateNotice(
            trip_id=item.plan.trip_id,
            plan_item_id=item.id,
            kind="proposal",
            title=f"{item.title} was updated after everyone confirmed",
            body="Every affected member accepted. Names and private reasons stay hidden.",
        )
    )
    db.flush()
    return True


def withdraw_proposal(db: Session, proposal: ChangeProposal) -> None:
    """The proposer withdraws. The plan stays unchanged."""
    proposal.status = "withdrawn"
    db.flush()

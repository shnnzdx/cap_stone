from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy import select
from sqlalchemy.orm import Session

from ...db.models import (
    ChangeProposal,
    DecisionRound,
    InviteLink,
    Plan,
    PlanItem,
    Trip,
    TripMembership,
    UpdateNotice,
)


class ForeignTripAccess(Exception):
    """The caller is authenticated, but scoped to a different trip."""


class ScopedResourceNotFound(Exception):
    """The requested resource is missing from the caller's scoped trip view."""


@dataclass(slots=True)
class TripScope:
    db: Session
    membership: TripMembership

    def require_trip(self, trip_id: str) -> Trip:
        self._require_path_trip(trip_id)
        trip = self.db.get(Trip, trip_id)
        if trip is None:
            raise ScopedResourceNotFound(f"Trip {trip_id} not found")
        return trip

    def require_plan(self, plan_id: str) -> Plan:
        return self._require_owned(
            select(Plan, Plan.trip_id).where(Plan.id == plan_id),
            resource_name="Plan",
            resource_id=plan_id,
        )

    def require_plan_item(self, item_id: str) -> PlanItem:
        return self._require_owned(
            select(PlanItem, Plan.trip_id)
            .join(Plan, Plan.id == PlanItem.plan_id)
            .where(PlanItem.id == item_id),
            resource_name="Plan item",
            resource_id=item_id,
        )

    def require_notice(self, notice_id: str) -> UpdateNotice:
        return self._require_owned(
            select(UpdateNotice, UpdateNotice.trip_id).where(UpdateNotice.id == notice_id),
            resource_name="Notice",
            resource_id=notice_id,
        )

    def require_round(self, round_id: str) -> DecisionRound:
        return self._require_owned(
            select(DecisionRound, Plan.trip_id)
            .join(PlanItem, PlanItem.id == DecisionRound.plan_item_id)
            .join(Plan, Plan.id == PlanItem.plan_id)
            .where(DecisionRound.id == round_id),
            resource_name="Decision round",
            resource_id=round_id,
        )

    def require_proposal(self, proposal_id: str) -> ChangeProposal:
        return self._require_owned(
            select(ChangeProposal, Plan.trip_id)
            .join(PlanItem, PlanItem.id == ChangeProposal.plan_item_id)
            .join(Plan, Plan.id == PlanItem.plan_id)
            .where(ChangeProposal.id == proposal_id),
            resource_name="Change proposal",
            resource_id=proposal_id,
        )

    def require_invite(self, invite_id: str) -> InviteLink:
        return self._require_owned(
            select(InviteLink, InviteLink.trip_id).where(InviteLink.id == invite_id),
            resource_name="Invite",
            resource_id=invite_id,
        )

    def require_membership_in_trip(
        self, membership_id: str, trip_id: str
    ) -> TripMembership:
        self._require_path_trip(trip_id)
        membership = self.db.scalar(
            select(TripMembership).where(
                TripMembership.id == membership_id,
                TripMembership.trip_id == trip_id,
            )
        )
        if membership is None:
            raise ScopedResourceNotFound(
                f"Trip membership {membership_id} not found in trip {trip_id}"
            )
        return membership

    def _require_path_trip(self, trip_id: str) -> None:
        if self.membership.trip_id != trip_id:
            raise ForeignTripAccess(
                f"Membership {self.membership.id} is not scoped to trip {trip_id}"
            )

    def _require_owned(self, statement, *, resource_name: str, resource_id: str):
        row = self.db.execute(statement).first()
        if row is None:
            raise ScopedResourceNotFound(f"{resource_name} {resource_id} not found")
        resource, owning_trip_id = row
        if owning_trip_id != self.membership.trip_id:
            raise ScopedResourceNotFound(f"{resource_name} {resource_id} not found")
        return resource


def for_membership(db: Session, membership: TripMembership) -> TripScope:
    return TripScope(db=db, membership=membership)

"""Manual DeepSeek validation for the real read-only trip tools.

Run from backend/:

    MOCK_AI=0 DISABLE_SCHEDULER=1 .venv/bin/python app/agents/agent-server/run_real_trip_tools_trace.py

The script seeds a temporary trip inside one test-database transaction and
rolls it back at the end. It does not write persistent data.
"""

from __future__ import annotations

import json
import os
import sys
from datetime import date
from pathlib import Path
from typing import Any

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

BACKEND_ROOT = Path(__file__).resolve().parents[3]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

load_dotenv(BACKEND_ROOT / ".env", override=False)

from app.agents.base import call_agent  # noqa: E402
from app.agents.tools import build_read_only_trip_tools  # noqa: E402
from app.domain.chat.service import _agent_system_prompt  # noqa: E402
from app.db.models import (  # noqa: E402
    Base,
    MemberConstraint,
    MemberConstraintPrivate,
    Plan,
    PlanItem,
    Trip,
    TripMembership,
    User,
)


SCENARIOS = [
    # Fuzzy and specific change requests. These are what the agent path exists for.
    "周三排得太满了，能不能松一点",
    "周三的 Art Institute 能不能挪到周四",
    "把周三的 Millennium Park walk 改到 11 点会有问题吗",
    # Plain questions. These currently never reach the agent at all, so their cost
    # here is the number to weigh when deciding whether the fast path earns its keep.
    "周三下午有什么安排",
    "给我介绍一下 Art Institute",
]

SYSTEM_PROMPT = _agent_system_prompt()


def main() -> None:
    database_url = os.getenv(
        "TEST_DATABASE_URL",
        os.getenv("DATABASE_URL", "postgresql+psycopg://localhost/tripsync_test"),
    )
    engine = create_engine(database_url, future=True)
    Base.metadata.create_all(engine)
    connection = engine.connect()
    transaction = connection.begin()
    session = sessionmaker(bind=connection, future=True)()
    try:
        fixture = _seed_trip(session)
        tools = build_read_only_trip_tools(
            session,
            trip_id=fixture["trip"].id,
            actor_membership_id=fixture["actor"].id,
        )
        plan_snapshot = next(
            tool.handler(day="all") for tool in tools if tool.name == "get_current_plan"
        )
        print("=== Real get_current_plan(day='all') ===")
        print(json.dumps(plan_snapshot, ensure_ascii=False, indent=2, default=str))

        summaries = []
        for index, message in enumerate(SCENARIOS, start=1):
            print(f"\n=== Scenario {index} ===")
            print(message)
            result = call_agent(
                system=SYSTEM_PROMPT,
                user=message,
                tools=tools,
                max_rounds=8,
                max_total_tokens=20000,
            )
            payload: dict[str, Any] = {
                "trace_id": result.trace_id,
                "content": result.content,
                "stopped_reason": result.stopped_reason,
                "rounds": result.rounds,
                "tool_results": result.tool_results,
                "total_elapsed_ms": result.total_elapsed_ms,
                "total_tokens": result.total_tokens,
            }
            print(json.dumps(payload, ensure_ascii=False, indent=2, default=str))
            summaries.append(
                {
                    "scenario": index,
                    "rounds": len(result.rounds),
                    "total_elapsed_ms": result.total_elapsed_ms,
                    "guard_rejections": sum(
                        1 for event in result.rounds if event.get("guard_rejected")
                    ),
                    "tools": [
                        item["tool"]
                        for item in result.tool_results
                        if not item.get("guard_rejected")
                    ],
                }
            )

        print("\n=== Summary ===")
        print(json.dumps(summaries, ensure_ascii=False, indent=2))
    finally:
        session.close()
        if transaction.is_active:
            transaction.rollback()
        connection.close()
        engine.dispose()


def _seed_trip(session) -> dict[str, Any]:
    users = [
        User(name="Validation Member A", email="agent-validation-a@example.com"),
        User(name="Validation Member B", email="agent-validation-b@example.com"),
    ]
    session.add_all(users)
    session.flush()

    trip = Trip(
        name="Validation Chicago trip",
        destination="Chicago",
        preferred_start_date=date(2026, 8, 19),
        preferred_end_date=date(2026, 8, 20),
        expected_group_size=2,
        status="planning",
        created_by_user_id=users[0].id,
    )
    session.add(trip)
    session.flush()

    actor = TripMembership(trip_id=trip.id, user_id=users[0].id, role="organizer")
    other = TripMembership(trip_id=trip.id, user_id=users[1].id, role="participant")
    session.add_all([actor, other])
    session.flush()

    constraint = MemberConstraint(
        trip_membership_id=other.id,
        kind="time_window",
        importance="required",
        params={"earliest_hour": 9.0},
    )
    session.add(constraint)
    session.flush()
    session.add(
        MemberConstraintPrivate(
            constraint_id=constraint.id,
            original_text="I cannot do activities before 9 because of medication timing.",
            visibility="planning_only",
        )
    )

    plan = Plan(trip_id=trip.id, status="active", estimated_total_per_person=420.0)
    session.add(plan)
    session.flush()
    session.add_all(
        [
            PlanItem(
                plan_id=plan.id,
                day_index=1,
                day_date=date(2026, 8, 19),
                start_hour=9.0,
                duration_min=90,
                title="Millennium Park walk",
                place="Millennium Park",
                price_per_person=0.0,
                settledness="loose",
            ),
            PlanItem(
                plan_id=plan.id,
                day_index=1,
                day_date=date(2026, 8, 19),
                start_hour=12.0,
                duration_min=75,
                title="Lunch near the Loop",
                place="The Loop",
                price_per_person=28.0,
                is_meal=True,
                settledness="loose",
            ),
            PlanItem(
                plan_id=plan.id,
                day_index=1,
                day_date=date(2026, 8, 19),
                start_hour=14.0,
                duration_min=150,
                title="Art Institute of Chicago",
                place="Michigan Avenue",
                price_per_person=32.0,
                settledness="loose",
                tags=["museum"],
            ),
            PlanItem(
                plan_id=plan.id,
                day_index=1,
                day_date=date(2026, 8, 19),
                start_hour=19.0,
                duration_min=120,
                title="Birthday dinner",
                place="River North",
                price_per_person=95.0,
                is_meal=True,
                settledness="booked",
            ),
            PlanItem(
                plan_id=plan.id,
                day_index=2,
                day_date=date(2026, 8, 20),
                start_hour=10.0,
                duration_min=90,
                title="Chicago River architecture cruise",
                place="Chicago Riverwalk",
                price_per_person=48.0,
                settledness="loose",
            ),
            PlanItem(
                plan_id=plan.id,
                day_index=2,
                day_date=date(2026, 8, 20),
                start_hour=15.0,
                duration_min=120,
                title="Wicker Park free time",
                place="Wicker Park",
                price_per_person=0.0,
                settledness="loose",
            ),
        ]
    )
    session.flush()
    return {"trip": trip, "actor": actor}


if __name__ == "__main__":
    main()

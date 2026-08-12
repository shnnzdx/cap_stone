"""Call the canonical day planner directly against the configured model endpoint."""

from __future__ import annotations

import os
import sys
from pathlib import Path

from dotenv import load_dotenv


BACKEND_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_ROOT))
load_dotenv(BACKEND_ROOT / ".env")

from app.agents import base, planner  # noqa: E402


def main() -> None:
    print("Planner diagnostic configuration:")
    print(f"  MOCK_AI={os.getenv('MOCK_AI')}")
    print(f"  OPENAI_MODEL={base.MODEL}")
    print(f"  OPENAI_BASE_URL={base.BASE_URL}")
    print(f"  OPENAI_API_KEY set={bool(os.getenv('OPENAI_API_KEY'))}")
    print()

    payload = planner.PlanDayInput(
        day_index=1,
        candidates=(
            planner.PoiOption(
                name="Millennium Park & Cloud Gate",
                place="Loop",
                price=0.0,
                duration_min=90,
                opens=9.0,
                closes=20.0,
                tags=("culture",),
            ),
            planner.PoiOption(
                name="Chicago Cultural Center",
                place="Loop",
                price=0.0,
                duration_min=90,
                opens=10.0,
                closes=18.0,
                tags=("culture",),
            ),
            planner.PoiOption(
                name="Girl & the Goat",
                place="West Loop",
                price=45.0,
                duration_min=120,
                opens=16.0,
                closes=22.0,
                tags=("food",),
            ),
        ),
        already_used=("Art Institute of Chicago",),
        budget_left=120.0,
        interests=("museums", "food"),
    )
    result = planner.plan_day(payload)
    print()
    print(f"used_ai={result.used_ai}")
    print(f"note={result.planner_note}")
    for pick in result.picks:
        print(f"pick: {pick.poi_name} at {pick.start_hour}")


if __name__ == "__main__":
    main()

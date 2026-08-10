"""Call the Planner Agent directly against the configured Ollama endpoint."""

from __future__ import annotations

import os
import sys
from datetime import date, timedelta
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

    request = planner.PlannerInput(
        destination="Chicago, Illinois",
        trip_dates=tuple(date(2026, 8, 19) + timedelta(days=offset) for offset in range(6)),
        interests=("museums", "food"),
        public_constraints=("Keep the pace relaxed",),
    )
    draft = planner.draft_itinerary(request)
    print()
    print(f"used_ai={draft.used_ai}")
    print(f"note={draft.note}")
    for day in draft.days:
        print(f"day {day.day_index}: {[stop.title for stop in day.stops]}")


if __name__ == "__main__":
    main()

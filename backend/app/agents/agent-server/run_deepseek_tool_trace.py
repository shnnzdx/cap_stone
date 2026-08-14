from __future__ import annotations

import json
import os
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[3]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from agent import run_agent


SCENARIOS = [
    {
        "name": "schedule_pressure_options",
        "message": "周三排得太满了，能不能松一点",
    },
    {
        "name": "museum_time_change_check",
        "message": "把周三的博物馆改到早上10点会有问题吗",
    },
    {
        "name": "wednesday_afternoon_plan",
        "message": "周三下午有什么安排",
    },
    {
        "name": "move_one_activity_to_thursday",
        "message": "周三的活动能不能挪一个到周四",
    },
]


def main() -> None:
    print(
        "agent-server DeepSeek tool trace",
        json.dumps(
            {
                "MOCK_AI": os.getenv("MOCK_AI", ""),
                "DEEPSEEK_THINKING": os.getenv("DEEPSEEK_THINKING", "disabled"),
                "AGENT_SERVER_MAX_ROUNDS": os.getenv("AGENT_SERVER_MAX_ROUNDS", "5"),
            },
            ensure_ascii=False,
        ),
    )
    summaries = []
    for index, scenario in enumerate(SCENARIOS, start=1):
        print(f"\n=== Scenario {index}: {scenario['name']} ===")
        print(scenario["message"])
        result = run_agent(scenario["message"])
        print(json.dumps(result, ensure_ascii=False, indent=2))
        if result.get("options_raw"):
            print("\n--- raw propose_options output ---")
            print(result["options_raw"])
        summaries.append(
            {
                "name": scenario["name"],
                "trace_id": result.get("trace_id"),
                "path": result.get("path"),
                "total_elapsed_ms": result.get("total_elapsed_ms"),
                "average_round_ms": result.get("average_round_ms"),
                "rounds": len(result.get("trace") or []),
                "guard_rejections": sum(
                    1 for event in (result.get("trace") or []) if event.get("guard_rejected")
                ),
                "tool_sequence": [
                    event.get("tool_name")
                    for event in (result.get("trace") or [])
                    if event.get("requested_tool")
                ],
            }
        )

    print("\n=== Latency summary ===")
    print(json.dumps(summaries, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()

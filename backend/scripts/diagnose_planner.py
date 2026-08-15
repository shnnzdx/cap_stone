"""Superseded Planner diagnostic entry point.

This repository now uses:

    app/agents/agent-server/run_planner_eval.py

for repeatable Planner baseline evaluation.

The old single-day diagnostic script had drifted out of sync with the current
Planner types and no longer represented the real generation pipeline.
"""

from __future__ import annotations


def main() -> None:
    raise SystemExit(
        "diagnose_planner.py is superseded. Run "
        "`$env:MOCK_AI='0'; $env:DISABLE_SCHEDULER='1'; "
        ".\\.venv\\Scripts\\python.exe -u app/agents/agent-server/run_planner_eval.py` "
        "from backend/ instead."
    )


if __name__ == "__main__":
    main()

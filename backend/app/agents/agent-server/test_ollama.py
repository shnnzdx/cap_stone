"""Manual compatibility demo for the rescued DeepSeek agent-server."""

from __future__ import annotations

import json

from agent import run_agent


if __name__ == "__main__":
    result = run_agent("Can we move the Art Institute to 3:30 PM?")
    print(json.dumps(result, ensure_ascii=False, indent=2))

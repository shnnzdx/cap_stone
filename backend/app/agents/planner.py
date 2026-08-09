"""Planner -- choose a pleasant day from already-legal POI candidates.

This file is intentionally only the agent shell. The generation pipeline in
domain/plans/generator.py is responsible for collecting constraints, filtering
illegal options, validating the result, retrying, writing the database rows, and
falling back to deterministic rules.

When the project owner fills this in, keep the same four-part agent shape used
by explainer.py:

  1. SCHEMA   -- the exact shape the model must answer in
  2. SYSTEM   -- who the model is and what it may not do
  3. MOCK     -- a fixed answer for MOCK_AI=1, same shape as the real one
  4. one pure function -- input dataclass in, output dataclass out

The agent receives only candidates the pipeline has already deemed legal. It
should choose from that set; it should not re-check constraints or invent POIs.
"""

from __future__ import annotations

from dataclasses import dataclass


# 1. SCHEMA ---------------------------------------------------------------
# Project owner fills this in with the final JSON schema.
SCHEMA = {}

# 2. SYSTEM ---------------------------------------------------------------
# Project owner fills this in with the final planner instructions.
SYSTEM = ""

# 3. MOCK -----------------------------------------------------------------
# Empty picks exercise the domain fallback without pretending AI logic exists.
MOCK: dict = {"picks": []}


@dataclass(frozen=True)
class PoiOption:
    name: str
    place: str
    price: float
    duration_min: int
    opens: float
    closes: float
    tags: tuple[str, ...]


@dataclass(frozen=True)
class PlanDayInput:
    day_index: int
    candidates: tuple[PoiOption, ...]
    already_used: tuple[str, ...]
    budget_left: float
    interests: tuple[str, ...]


@dataclass(frozen=True)
class Pick:
    poi_name: str
    start_hour: float


def plan_day(payload: PlanDayInput) -> tuple[Pick, ...]:
    """挑三个时段。晚上那个要能吃饭。负责人填。"""
    return ()

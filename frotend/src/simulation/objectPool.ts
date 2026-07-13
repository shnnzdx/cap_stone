import type { AlertLifecycleState, FinalDecision, VisualUnit, VisualUnitKind } from "./alertTypes";

const offscreen: [number, number, number] = [-9, -9, -9];

export function createVisualPool(kind: VisualUnitKind, count: number): VisualUnit[] {
  return Array.from({ length: count }, (_, index) => ({
    id: `${kind}-${index}`,
    kind,
    active: false,
    lifecycleState: "waiting" as AlertLifecycleState,
    progress: 0,
    score: 0,
    severity: 0,
    utility: 0,
    isActionable: false,
    isDuplicate: false,
    finalDecision: "suppress" as FinalDecision,
    currentPosition: [...offscreen],
    targetPosition: [...offscreen],
    startTime: 0,
    duration: 1,
    phaseOffset: index * 0.37,
    laneIndex: index % 3,
    bufferSlot: index,
    visualScale: 1,
  }));
}

export function resetVisualUnit(unit: VisualUnit) {
  unit.active = false;
  unit.lifecycleState = "waiting";
  unit.progress = 0;
  unit.score = 0;
  unit.severity = 0;
  unit.utility = 0;
  unit.isActionable = false;
  unit.isDuplicate = false;
  unit.finalDecision = "suppress";
  unit.feedbackType = undefined;
  unit.currentPosition = [...offscreen];
  unit.targetPosition = [...offscreen];
  unit.startTime = 0;
  unit.duration = 1;
  unit.laneIndex = 0;
  unit.bufferSlot = 0;
  unit.visualScale = 1;
}

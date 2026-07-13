export type StrategyMode = "feedback" | "threshold" | "rules";

export type AlertLifecycleState =
  | "waiting"
  | "job_ingestion"
  | "signal_extraction"
  | "candidate_buffer"
  | "queued"
  | "compressing"
  | "absorbing"
  | "ranking"
  | "promoted"
  | "suppressed"
  | "feedback"
  | "recycling";

export type JobStatus = "completed" | "failed" | "completed_with_failures" | "timeout";

export type FeedbackType = "acknowledged" | "useful" | "ignored" | "false_positive" | "escalated" | "resolved";

export type FinalDecision = "promote" | "suppress";

export type SimulatedJob = {
  id: string;
  workerId: string;
  durationMs: number;
  apiLatencyMs: number;
  retryCount: number;
  errorCount: number;
  status: JobStatus;
  retailerFailureRate: number;
  addressFailureRate: number;
  missingTelemetry: boolean;
  trueActionable: boolean;
  alertUtility: number;
};

export type AlertCandidate = {
  id: string;
  job: SimulatedJob;
  score: number;
  severity: number;
  utility: number;
  isActionable: boolean;
  isDuplicate: boolean;
  finalDecision: FinalDecision;
  feedbackType?: FeedbackType;
};

export type AlertDecision = {
  decision: FinalDecision;
  confidence: number;
  reason: string;
};

export type StrategyContext = {
  feedbackMemory: Map<string, number>;
  processedCount: number;
};

export type AlertDecisionStrategy = {
  mode: StrategyMode;
  name: string;
  evaluate(candidate: AlertCandidate, context: StrategyContext): AlertDecision;
};

export type VisualUnitKind = "job" | "signal" | "candidate" | "feedback";

export type CorePhase = "filling" | "compressing" | "ranking" | "releasing" | "recovering";

export type VisualUnit = {
  id: string;
  kind: VisualUnitKind;
  active: boolean;
  lifecycleState: AlertLifecycleState;
  progress: number;
  score: number;
  severity: number;
  utility: number;
  isActionable: boolean;
  isDuplicate: boolean;
  finalDecision: FinalDecision;
  feedbackType?: FeedbackType;
  currentPosition: [number, number, number];
  targetPosition: [number, number, number];
  startTime: number;
  duration: number;
  phaseOffset: number;
  laneIndex: number;
  bufferSlot: number;
  visualScale: number;
};

export type SimulationMetrics = {
  jobsProcessed: number;
  rawAlertCandidates: number;
  actionableAlertsSent: number;
  lowValueAlertsSuppressed: number;
  alertReduction: number;
  recall: number;
  precision: number;
  feedbackEvents: number;
  p95JobDuration: number;
  activeWorkers: number;
  lowValueCandidates: number;
  lowValueAlertsSent: number;
  trueActionableTotal: number;
  trueActionableSurfaced: number;
};

export type ActiveAlert = {
  id: string;
  workerId: string;
  status: JobStatus;
  score: number;
  utility: number;
  reason: string;
};

export type CoreVisualState = {
  phase: CorePhase;
  fillLevel: number;
  compressionProgress: number;
  rankingProgress: number;
  releaseProgress: number;
  feedbackPulse: number;
  occupiedSlots: Array<{
    slotId: number;
    candidateId: string;
    score: number;
    utility: number;
    decision: FinalDecision;
    state: "docking" | "docked" | "ranking" | "releasing";
  }>;
};

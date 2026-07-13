import type { FinalDecision, JobStatus, StrategyMode } from "./alertTypes";

export type DashboardFeedbackType =
  | "useful"
  | "noisy"
  | "duplicate"
  | "expected"
  | "false_positive"
  | "real_incident";

export type ReviewOutcome =
  | "real_incident"
  | "false_positive"
  | "duplicate"
  | "expected_behavior"
  | "non_actionable"
  | "needs_more_information";

export type OperatorAction = "confirm" | "escalate" | "close";

export type ReviewStatus = "unreviewed" | "reviewing" | "reviewed";

export type ReviewFeedback = {
  outcome: ReviewOutcome;
  reviewer: string;
  note?: string;
  submittedAt: number;
  operatorAction: OperatorAction;
  appliedToRanking: boolean;
  rankingEffect?: string;
};

export type DashboardAlertRecord = {
  id: string;
  service: string;
  jobId: string;
  workerId: string;
  severity: number;
  status: JobStatus;
  score: number;
  utility: number;
  decision: FinalDecision;
  decisionReason: string;
  confidence: number;
  decisionBoundary: number;
  feedbackStatus: DashboardFeedbackType | ReviewOutcome | "none";
  reviewStatus: ReviewStatus;
  escalated: boolean;
  createdTime: number;
  ageSeconds: number;
  relatedSignals: Array<{ label: string; value: string }>;
  scoreBreakdown: Array<{ label: string; value: number }>;
  reviewScoreBreakdown: Array<{ feature: string; contribution: number }>;
  durationMs: number;
  apiLatencyMs: number;
  retryCount: number;
  errorCount: number;
  retailerFailureRate: number;
  addressFailureRate: number;
  similarCandidateCount: number;
  missingTelemetry: boolean;
  lastSuccessfulRunAgeSeconds?: number;
  isActionable: boolean;
  isDuplicate: boolean;
  isLowValue: boolean;
  feedback?: ReviewFeedback;
};

export type FeedbackEffect = {
  id: string;
  timestamp: number;
  service: string;
  description: string;
  feedbackType: DashboardFeedbackType | ReviewOutcome;
};

export type StrategyComparisonRow = {
  mode: StrategyMode;
  strategy: string;
  alertsSent: number;
  falsePositives: number;
  precision: number;
  recall: number;
  alertReduction: number;
};

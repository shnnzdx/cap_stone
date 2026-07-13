import type { StrategyMode } from "../simulation/alertTypes";

export type NoiseCategoryMetrics = {
  duplicateCandidates: number;
  duplicateSuppressed: number;
  transientRetryCandidates: number;
  transientRetrySuppressed: number;
  expectedBehaviorCandidates: number;
  expectedBehaviorSuppressed: number;
  lowSeverityFalsePositiveCandidates: number;
  lowSeverityFalsePositiveSuppressed: number;
  incompleteTelemetryCandidates: number;
  incompleteTelemetrySuppressed: number;
};

export type StrategyRunMetrics = {
  seed: number;
  rawCandidates: number;
  alertsSent: number;
  alertReduction: number;
  trueActionableTotal: number;
  trueActionableSurfaced: number;
  nonActionableTotal: number;
  nonActionableSurfaced: number;
  precision: number;
  recall: number;
  falsePositiveRate: number;
  duplicateAlertsSurfaced: number;
  duplicateAlertRate: number;
  lowValueCandidates: number;
  lowValueAlertsSuppressed: number;
  lowValueAlertsSent: number;
  lowValueSuppressionRate: number;
  highRiskSuppressions: number;
  actionableAlertsSuppressed: number;
  operatorOverrides: number;
  noiseCategories: NoiseCategoryMetrics;
};

export type AggregatedMetric = {
  mean: number;
  min: number;
  max: number;
  standardDeviation: number;
};

export type AggregatedStrategyMetrics = {
  rawCandidates: AggregatedMetric;
  alertsSent: AggregatedMetric;
  alertReduction: AggregatedMetric;
  precision: AggregatedMetric;
  recall: AggregatedMetric;
  falsePositiveRate: AggregatedMetric;
  duplicateAlertRate: AggregatedMetric;
  lowValueCandidates: AggregatedMetric;
  lowValueAlertsSuppressed: AggregatedMetric;
  lowValueAlertsSent: AggregatedMetric;
  lowValueSuppressionRate: AggregatedMetric;
  highRiskSuppressions: AggregatedMetric;
  actionableAlertsSuppressed: AggregatedMetric;
  operatorOverrides: AggregatedMetric;
};

export type StrategyExperimentResult = {
  strategy: StrategyMode;
  runs: StrategyRunMetrics[];
  aggregate: AggregatedStrategyMetrics;
  noiseCategoryAggregate: NoiseCategoryMetrics;
  guardrailPassed: boolean;
};

export type ExperimentDefinition = {
  id: string;
  name: string;
  calibrationSeeds: number[];
  evaluationSeeds: number[];
  jobsPerRun: number;
  recallGuardrail: number;
  feedbackRounds: number;
  inconclusiveRelativeMargin: number;
  groundTruthSource: "synthetic_controlled_labels";
  createdAt: number;
};

export type FeedbackRoundResult = {
  round: number;
  feedbackEventsApplied: number;
  lowValueAlertsSent: number;
  precision: number;
  recall: number;
  duplicateAlertsSent: number;
  operatorOverrides: number;
};

export type FeedbackWeightChange = {
  key: string;
  service?: string;
  workerId?: string;
  pattern: string;
  previousWeight: number;
  nextWeight: number;
  delta: number;
  feedbackSource: string;
};

export type ExperimentConclusion = {
  status: "winner" | "inconclusive" | "guardrail_failed";
  bestStrategy?: StrategyMode;
  strongestEligibleBaseline?: StrategyMode;
  primaryMetricImprovement?: number;
  precisionDifferencePoints?: number;
  recallDifferencePoints?: number;
  summary: string;
};

export type ExperimentResult = {
  definition: ExperimentDefinition;
  status: "running" | "completed" | "failed";
  totalJobs: number;
  totalCandidates: number;
  strategies: StrategyExperimentResult[];
  feedbackBefore: StrategyRunMetrics;
  feedbackAfter: StrategyRunMetrics;
  feedbackProgression: FeedbackRoundResult[];
  feedbackWeightChanges: FeedbackWeightChange[];
  conclusion: ExperimentConclusion;
};

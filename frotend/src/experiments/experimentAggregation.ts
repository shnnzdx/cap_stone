import type { AggregatedMetric, AggregatedStrategyMetrics, NoiseCategoryMetrics, StrategyRunMetrics } from "./experimentTypes";

function aggregate(values: number[]): AggregatedMetric {
  const mean = values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / Math.max(1, values.length);
  return {
    mean,
    min: Math.min(...values),
    max: Math.max(...values),
    standardDeviation: Math.sqrt(variance),
  };
}

function sumNoiseCategories(runs: StrategyRunMetrics[]): NoiseCategoryMetrics {
  return runs.reduce<NoiseCategoryMetrics>(
    (total, run) => ({
      duplicateCandidates: total.duplicateCandidates + run.noiseCategories.duplicateCandidates,
      duplicateSuppressed: total.duplicateSuppressed + run.noiseCategories.duplicateSuppressed,
      transientRetryCandidates: total.transientRetryCandidates + run.noiseCategories.transientRetryCandidates,
      transientRetrySuppressed: total.transientRetrySuppressed + run.noiseCategories.transientRetrySuppressed,
      expectedBehaviorCandidates: total.expectedBehaviorCandidates + run.noiseCategories.expectedBehaviorCandidates,
      expectedBehaviorSuppressed: total.expectedBehaviorSuppressed + run.noiseCategories.expectedBehaviorSuppressed,
      lowSeverityFalsePositiveCandidates: total.lowSeverityFalsePositiveCandidates + run.noiseCategories.lowSeverityFalsePositiveCandidates,
      lowSeverityFalsePositiveSuppressed: total.lowSeverityFalsePositiveSuppressed + run.noiseCategories.lowSeverityFalsePositiveSuppressed,
      incompleteTelemetryCandidates: total.incompleteTelemetryCandidates + run.noiseCategories.incompleteTelemetryCandidates,
      incompleteTelemetrySuppressed: total.incompleteTelemetrySuppressed + run.noiseCategories.incompleteTelemetrySuppressed,
    }),
    {
      duplicateCandidates: 0,
      duplicateSuppressed: 0,
      transientRetryCandidates: 0,
      transientRetrySuppressed: 0,
      expectedBehaviorCandidates: 0,
      expectedBehaviorSuppressed: 0,
      lowSeverityFalsePositiveCandidates: 0,
      lowSeverityFalsePositiveSuppressed: 0,
      incompleteTelemetryCandidates: 0,
      incompleteTelemetrySuppressed: 0,
    },
  );
}

export function aggregateRuns(runs: StrategyRunMetrics[]): { aggregate: AggregatedStrategyMetrics; noiseCategoryAggregate: NoiseCategoryMetrics } {
  return {
    aggregate: {
      rawCandidates: aggregate(runs.map((run) => run.rawCandidates)),
      alertsSent: aggregate(runs.map((run) => run.alertsSent)),
      alertReduction: aggregate(runs.map((run) => run.alertReduction)),
      precision: aggregate(runs.map((run) => run.precision)),
      recall: aggregate(runs.map((run) => run.recall)),
      falsePositiveRate: aggregate(runs.map((run) => run.falsePositiveRate)),
      duplicateAlertRate: aggregate(runs.map((run) => run.duplicateAlertRate)),
      lowValueCandidates: aggregate(runs.map((run) => run.lowValueCandidates)),
      lowValueAlertsSuppressed: aggregate(runs.map((run) => run.lowValueAlertsSuppressed)),
      lowValueAlertsSent: aggregate(runs.map((run) => run.lowValueAlertsSent)),
      lowValueSuppressionRate: aggregate(runs.map((run) => run.lowValueSuppressionRate)),
      highRiskSuppressions: aggregate(runs.map((run) => run.highRiskSuppressions)),
      actionableAlertsSuppressed: aggregate(runs.map((run) => run.actionableAlertsSuppressed)),
      operatorOverrides: aggregate(runs.map((run) => run.operatorOverrides)),
    },
    noiseCategoryAggregate: sumNoiseCategories(runs),
  };
}

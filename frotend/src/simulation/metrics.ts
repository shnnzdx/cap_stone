import type { SimulationMetrics, SimulatedJob } from "./alertTypes";

export function createEmptyMetrics(): SimulationMetrics {
  return {
    jobsProcessed: 0,
    rawAlertCandidates: 0,
    actionableAlertsSent: 0,
    lowValueAlertsSuppressed: 0,
    alertReduction: 0,
    recall: 0,
    precision: 0,
    feedbackEvents: 0,
    p95JobDuration: 0,
    activeWorkers: 0,
    lowValueCandidates: 0,
    lowValueAlertsSent: 0,
    trueActionableTotal: 0,
    trueActionableSurfaced: 0,
  };
}

export function computeDerivedMetrics(metrics: SimulationMetrics, durations: number[], workers: Set<string>) {
  const sorted = [...durations].sort((a, b) => a - b);
  const p95Index = Math.max(0, Math.ceil(sorted.length * 0.95) - 1);

  return {
    ...metrics,
    alertReduction:
      metrics.lowValueCandidates > 0 ? metrics.lowValueAlertsSuppressed / metrics.lowValueCandidates : 0,
    recall: metrics.trueActionableTotal > 0 ? metrics.trueActionableSurfaced / metrics.trueActionableTotal : 1,
    precision: metrics.actionableAlertsSent > 0 ? metrics.trueActionableSurfaced / metrics.actionableAlertsSent : 1,
    p95JobDuration: sorted[p95Index] ?? 0,
    activeWorkers: workers.size,
  };
}

export function isLowValue(job: SimulatedJob) {
  return !job.trueActionable || job.alertUtility < 0.5;
}

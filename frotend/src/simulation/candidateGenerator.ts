import type { AlertCandidate, FinalDecision, SimulatedJob } from "./alertTypes";

export function createCandidate(job: SimulatedJob, index: number): AlertCandidate {
  const score =
    job.errorCount * 0.11 +
    job.retryCount * 0.07 +
    job.apiLatencyMs / 9000 +
    (job.status === "timeout" ? 0.28 : 0) +
    (job.status === "failed" ? 0.2 : 0) +
    (job.status === "completed_with_failures" ? 0.12 : 0) +
    (job.missingTelemetry ? 0.1 : 0);
  const severity =
    job.status === "timeout"
      ? 0.9
      : job.status === "failed"
        ? 0.72
        : job.status === "completed_with_failures"
          ? 0.52
          : 0.22;

  return {
    id: `cand-${job.id}-${index}`,
    job,
    score: Math.max(0, Math.min(1, score)),
    severity,
    utility: job.alertUtility,
    isActionable: job.trueActionable,
    isDuplicate: index % 7 === 0 || (job.retryCount > 3 && job.errorCount < 3),
    finalDecision: "suppress" as FinalDecision,
  };
}

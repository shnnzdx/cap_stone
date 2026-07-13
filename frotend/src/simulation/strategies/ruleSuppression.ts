import type { AlertCandidate, AlertDecision, AlertDecisionStrategy } from "./strategyTypes";

export const ruleSuppressionStrategy: AlertDecisionStrategy = {
  mode: "rules",
  name: "Rule-Only Suppression",
  evaluate(candidate: AlertCandidate): AlertDecision {
    const duplicate = candidate.isDuplicate;
    const transient = candidate.job.retryCount <= 1 && candidate.job.errorCount <= 1;
    const expectedFailure = candidate.job.status === "completed_with_failures" && candidate.utility < 0.42;
    const missingLowValue = candidate.job.missingTelemetry && candidate.utility < 0.5;
    const suppress = duplicate || transient || expectedFailure || missingLowValue;

    return {
      decision: suppress ? "suppress" : "promote",
      confidence: suppress ? 0.35 : 0.24,
      reason: suppress ? "matched suppression rule" : "no suppression rule hit",
    };
  },
};

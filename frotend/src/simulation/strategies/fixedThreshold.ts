import type { AlertCandidate, AlertDecision, AlertDecisionStrategy } from "./strategyTypes";

export const fixedThresholdStrategy: AlertDecisionStrategy = {
  mode: "threshold",
  name: "Fixed Threshold",
  evaluate(candidate: AlertCandidate): AlertDecision {
    const threshold = 0.58;
    const decision = candidate.score >= threshold ? "promote" : "suppress";
    return {
      decision,
      confidence: Math.abs(candidate.score - threshold),
      reason: decision === "promote" ? "score above threshold" : "score below threshold",
    };
  },
};

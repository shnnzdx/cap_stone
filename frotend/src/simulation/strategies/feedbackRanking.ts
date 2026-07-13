import type { AlertCandidate, AlertDecision, AlertDecisionStrategy, StrategyContext } from "./strategyTypes";

export const feedbackRankingStrategy: AlertDecisionStrategy = {
  mode: "feedback",
  name: "Feedback-Driven Ranking",
  evaluate(candidate: AlertCandidate, context: StrategyContext): AlertDecision {
    const workerMemory = context.feedbackMemory.get(candidate.job.workerId) ?? 0;
    const feedbackBoost = Math.max(-0.16, Math.min(0.18, workerMemory));
    const adjustedUtility = candidate.utility + feedbackBoost - (candidate.isDuplicate ? 0.2 : 0);
    const adjustedScore = candidate.score * 0.42 + adjustedUtility * 0.58;
    const decision = adjustedScore > 0.48 ? "promote" : "suppress";

    return {
      decision,
      confidence: Math.abs(adjustedScore - 0.48),
      reason: decision === "promote" ? "ranked high utility" : "low utility or duplicate",
    };
  },
};
